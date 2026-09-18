import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * SALES' ANSWER TO ORDERS' QUESTION (golive#206 item 1).
 *
 * These drive the real `DealLockOrderLineVeto` against a stubbed `RunView`, so the lookup chain, the
 * flag reading and the failure behaviour are all exercised for real. Only the database is replaced.
 *
 * `RunView` is stubbed at the module boundary because the class constructs its own, the way the other
 * non-entity services in this package do. The stub records every query, which is what makes the
 * round-trip assertions possible — the cost of asking per line is a property worth pinning, not an
 * implementation detail.
 */
const runView = vi.fn();
vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return { ...actual, LogError: () => undefined, RunView: class { public RunView = runView; } };
});

const { DealLockOrderLineVeto, DealLockRefusal } = await import('../DealLockOrderLineVeto.js');

const ORDER = 'b1c2d3e4-0000-4000-8000-000000000001';
const DEAL = 'b1c2d3e4-0000-4000-8000-000000000002';
const STATUS = 'b1c2d3e4-0000-4000-8000-000000000003';
const USER = { ID: 'user-1' } as never;

afterEach(() => {
    runView.mockReset();
});

/** Queue the two reads the veto makes: the deal behind the order, then that status' flag. */
function answers(opts: { deal?: { ID: string; DealStatusTypeID: string | null } | null; locks?: boolean }) {
    runView.mockImplementation(async ({ EntityName }: { EntityName: string }) => {
        if (EntityName === 'MJ_BizApps_Sales: Deals') {
            return { Success: true, Results: opts.deal === null ? [] : [opts.deal ?? { ID: DEAL, DealStatusTypeID: STATUS }] };
        }
        return { Success: true, Results: opts.locks === undefined ? [] : [{ LocksDeal: opts.locks }] };
    });
}

const ctx = (kind: 'create' | 'update' | 'delete' = 'update') => ({
    OrderHeaderID: ORDER,
    OrderLineID: null,
    Kind: kind,
    ContextUser: USER,
});

describe('a closed deal refuses edits to its order lines', () => {
    it('refuses when the status carries the lock flag', async () => {
        answers({ locks: true });
        const refusal = await new DealLockOrderLineVeto().MayEdit(ctx());
        expect(refusal).toBe('This deal is closed. Set the status back to Open before changing what was sold.');
    });

    it('names the gesture, because the seam passes it', async () => {
        answers({ locks: true });
        const v = new DealLockOrderLineVeto();
        expect(await v.MayEdit(ctx('create'))).toMatch(/before adding a product/);
        expect(await v.MayEdit(ctx('delete'))).toMatch(/before removing a product/);
    });

    it('reads the FLAG, never the status name', async () => {
        answers({ locks: true });
        await new DealLockOrderLineVeto().MayEdit(ctx());
        const statusQuery = runView.mock.calls.find(
            ([p]) => p.EntityName === 'MJ_BizApps_Sales: Deal Status Types',
        )?.[0];
        // "Won" and "Lost" and "Abandoned" all lock, and a deployment may add another. A rule that
        // matched names would quietly stop covering it.
        expect(statusQuery?.Fields, 'the lock is a flag on the status row').toContain('LocksDeal');
    });
});

describe('an open deal, and orders Sales has no claim on', () => {
    it('allows the edit when the status does not lock', async () => {
        answers({ locks: false });
        expect(await new DealLockOrderLineVeto().MayEdit(ctx())).toBeNull();
    });

    it('allows it when no deal owns the order at all', async () => {
        // Orders exist without deals. Saying "not mine" is not the same as approving anything.
        answers({ deal: null });
        expect(await new DealLockOrderLineVeto().MayEdit(ctx())).toBeNull();
    });

    it('allows it when the deal has no status to read', async () => {
        answers({ deal: { ID: DEAL, DealStatusTypeID: null } });
        expect(await new DealLockOrderLineVeto().MayEdit(ctx())).toBeNull();
    });

    it('does not lock on a status row that is missing', async () => {
        // The deal points at a status that does not exist. That is a data fault for the close lock to
        // report, not a reason to freeze somebody's order.
        answers({ locks: undefined });
        expect(await new DealLockOrderLineVeto().MayEdit(ctx())).toBeNull();
    });
});

describe('a lookup that cannot answer is not an approval', () => {
    it('THROWS when the deal read fails, so the seam turns it into a refusal', async () => {
        runView.mockResolvedValue({ Success: false, ErrorMessage: 'connection reset' });
        await expect(new DealLockOrderLineVeto().MayEdit(ctx())).rejects.toThrow(/could not be read/);
    });

    it('THROWS when the status read fails', async () => {
        runView.mockImplementation(async ({ EntityName }: { EntityName: string }) =>
            EntityName === 'MJ_BizApps_Sales: Deals'
                ? { Success: true, Results: [{ ID: DEAL, DealStatusTypeID: STATUS }] }
                : { Success: false, ErrorMessage: 'connection reset' },
        );
        await expect(new DealLockOrderLineVeto().MayEdit(ctx())).rejects.toThrow(/status could not be read/);
    });

    it('refuses an id that is not a usable record id, rather than building a filter from it', async () => {
        answers({ locks: true });
        await expect(
            new DealLockOrderLineVeto().MayEdit({ ...ctx(), OrderHeaderID: "x' OR '1'='1" }),
        ).rejects.toThrow(/not a usable record id/);
        expect(runView, 'nothing should have been queried').not.toHaveBeenCalled();
    });
});

describe('nothing is remembered, and that is the point', () => {
    it('re-reads the STATUS every time, so a deal that closes mid-session starts refusing', async () => {
        const v = new DealLockOrderLineVeto();
        answers({ locks: false });
        expect(await v.MayEdit(ctx()), 'open to begin with').toBeNull();

        // The same order, after the deal closed. A memo of the verdict would still say null here,
        // which is the dangerous direction: edits to a just-closed deal would keep going through.
        answers({ locks: true });
        expect(await v.MayEdit(ctx()), 'and refuses once it closes').toMatch(/This deal is closed/);
    });

    it('costs two reads per line, every line', async () => {
        // Orders asks ONCE PER LINE, so this is the real cost: a fifty-line save is a hundred round
        // trips. Pinned deliberately. An "optimisation" that makes it cheaper by remembering a
        // verdict would break the test above, which is the point -- that memo is the unsafe one.
        const v = new DealLockOrderLineVeto();
        answers({ locks: true });

        await v.MayEdit(ctx());
        expect(runView, 'the deal, then its status').toHaveBeenCalledTimes(2);

        runView.mockClear();
        await v.MayEdit(ctx());
        await v.MayEdit(ctx());
        expect(runView, 'and the same again for each further line').toHaveBeenCalledTimes(4);
    });
});

describe('the refusal wording', () => {
    it('opens with the sentence the rest of the lock already uses', () => {
        // The deal form's field refusal and the workspace's Add hint both begin this way (golive#207),
        // so a rep meets one voice across three screens rather than three descriptions of one rule.
        for (const kind of ['create', 'update', 'delete'] as const) {
            expect(DealLockRefusal(kind)).toMatch(/^This deal is closed\. Set the status back to Open before /);
        }
    });
});
