import { describe, expect, it, vi, afterEach } from 'vitest';

/**
 * `LogError` is captured rather than left to the console, so a failed read can be ASSERTED to reach
 * the log and not merely be thrown. The module is mocked the way the sibling veto's suite mocks it,
 * and the real `RunView` class is spread through untouched — this file patches its prototype, so it
 * has to be the same class object the subject constructs.
 *
 * Both imports are dynamic for the usual reason: the hoisted factory below runs when the mocked
 * module is first imported, and a static import at the top would reach `logged` before it exists.
 */
const logged: string[] = [];
vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return { ...actual, LogError: (message: unknown) => { logged.push(String(message)); } };
});

const { RunView } = await import('@memberjunction/core');
const { UserCache } = await import('@memberjunction/sqlserver-dataprovider');
const { DealNotWonConfirmVeto } = await import('../DealNotWonConfirmVeto.js');

/**
 * AN ORDER WHOSE DEAL IS NOT WON MAY NOT BE CONFIRMED (bc-aidp-next-golive#323).
 *
 * A deal closed Won mints an order. The deal is reopened to Open, and twenty seconds later the order
 * is confirmed from the order screen and books: a booking entry, a subscription and twelve
 * recognition entries, against a deal sitting Open at 75%. Sales already refuses the reverse —
 * `Sales.ReopenDeal` will not reopen a deal whose order has booked. This is that rule facing the
 * other way, answered through Orders' confirm seam.
 *
 * `RunView.prototype` is patched rather than the module mocked, which keeps the class's own wiring
 * real and matches how `vocabulary-list-order` and the server suites shadow a method.
 */

const ORDER = 'oooooooo-0000-4000-8000-000000000001';
const DEAL = 'dddddddd-0000-4000-8000-000000000001';
const WON = 'ssssssss-0000-4000-8000-00000000win1';
const OPEN = 'ssssssss-0000-4000-8000-0000000open1';

const original = RunView.prototype.RunView;
afterEach(() => { RunView.prototype.RunView = original; logged.length = 0; });

type Deal = { ID: string; DealNumber: string | null; DealStatusTypeID: string | null };

/**
 * @param deal the row `Deal WHERE OrderID = ...` returns, or null for an order no deal points at.
 * @param statuses IsWon by status id.
 */
function withData(deal: Deal | Deal[] | null, statuses: Record<string, boolean>, fail?: 'deal' | 'status') {
    const asked: string[] = [];
    /**
     * The WHOLE argument object and the user, not just the two fields the branching needs.
     *
     * While this captured only `EntityName` and `ExtraFilter`, four mutations lived through the suite:
     * deleting `OrderBy: 'ID'`, dropping `.trim()` on `DealNumber`, removing the quote-doubling in
     * `SafeID` and replacing `user ?? undefined` with a bare `undefined`. Each is a property the
     * header argues for, and none of them was reachable from an assertion.
     */
    const calls: { args: Record<string, unknown>; user: unknown }[] = [];
    RunView.prototype.RunView = (async (args: { EntityName: string; ExtraFilter: string }, user: unknown) => {
        const { EntityName, ExtraFilter } = args;
        asked.push(EntityName);
        calls.push({ args, user });
        if (EntityName.includes('Deal Status Types')) {
            if (fail === 'status') return { Success: false, ErrorMessage: 'status view is down', Results: [] };
            // Handles both `ID = 'x'` and the batched `ID IN ('x', 'y')`.
            const ids = [...String(ExtraFilter).matchAll(/'([^']+)'/g)].map((m) => m[1]);
            return {
                Success: true,
                Results: ids.filter((id) => id in statuses).map((id) => ({ ID: id, IsWon: statuses[id] })),
            };
        }
        if (fail === 'deal') return { Success: false, ErrorMessage: 'deal view is down', Results: [] };
        return { Success: true, Results: deal ? (Array.isArray(deal) ? deal : [deal]) : [] };
    }) as unknown as typeof RunView.prototype.RunView;
    return { asked, calls };
}

const ctx = { OrderHeaderID: ORDER, FromStatus: 'Quoted', ContextUser: null };
const veto = () => new DealNotWonConfirmVeto();

describe('an order whose deal is won', () => {
    it('may be confirmed', async () => {
        withData({ ID: DEAL, DealNumber: 'DEAL-002148', DealStatusTypeID: WON }, { [WON]: true });
        expect(await veto().MayConfirm(ctx)).toBeNull();
    });
});

describe('an order whose deal is not won', () => {
    it('is refused', async () => {
        withData({ ID: DEAL, DealNumber: 'DEAL-002148', DealStatusTypeID: OPEN }, { [OPEN]: false });
        expect(await veto().MayConfirm(ctx)).not.toBeNull();
    });

    it('names the deal, so the rep knows which one to close', async () => {
        withData({ ID: DEAL, DealNumber: 'DEAL-002148', DealStatusTypeID: OPEN }, { [OPEN]: false });
        const refusal = (await veto().MayConfirm(ctx)) ?? '';
        expect(refusal).toContain('DEAL-002148');
        expect(refusal, 'and says what to do').toContain('Close the deal as Won');
    });

    it('falls back to the deal id when it has no number', async () => {
        withData({ ID: DEAL, DealNumber: null, DealStatusTypeID: OPEN }, { [OPEN]: false });
        expect((await veto().MayConfirm(ctx)) ?? '').toContain(DEAL);
    });

    /** A deal with no status cannot be Won; booking against it would be a decision made by absence. */
    it('is refused when the deal has no status at all', async () => {
        withData({ ID: DEAL, DealNumber: 'DEAL-1', DealStatusTypeID: null }, {});
        expect(await veto().MayConfirm(ctx)).not.toBeNull();
    });

    /** An absent status ROW is as unanswerable as a missing id, and is not a win. */
    it('is refused when the status row has gone', async () => {
        withData({ ID: DEAL, DealNumber: 'DEAL-1', DealStatusTypeID: OPEN }, {});
        expect(await veto().MayConfirm(ctx)).not.toBeNull();
    });
});

/**
 * BY FLAG, NEVER BY NAME. "Won" is not the only winning status a deployment may run, and a renamed
 * one would silently stop matching. This asserts the flag decides — a status NAMED nothing like a win
 * still allows the confirm when `IsWon` is true.
 */
describe('the decision is the IsWon flag', () => {
    it('allows a winning status whatever it is called', async () => {
        withData({ ID: DEAL, DealNumber: 'DEAL-1', DealStatusTypeID: 'ssssssss-0000-4000-8000-00000closed' }, {
            'ssssssss-0000-4000-8000-00000closed': true,
        });
        expect(await veto().MayConfirm(ctx)).toBeNull();
    });

    it('reads the status types entity, not a name on the deal', async () => {
        const { asked } = withData({ ID: DEAL, DealNumber: 'DEAL-1', DealStatusTypeID: WON }, { [WON]: true });
        await veto().MayConfirm(ctx);
        expect(asked.some((e) => e.includes('Deal Status Types'))).toBe(true);
    });
});

/**
 * TWO DEALS POINTING AT ONE ORDER.
 *
 * `Deal.OrderID` carries no unique index, so the database permits it even though no order on the
 * reporting host has two. Reading only the first row made the verdict depend on which row came back
 * first, which a view with no ORDER BY does not promise twice running. Every owner is checked, and
 * one still open refuses — a booked order settles the ledger for every deal that minted it.
 */
describe('an order two deals point at', () => {
    const A = { ID: DEAL, DealNumber: 'DEAL-A', DealStatusTypeID: WON };
    const B = { ID: 'dddddddd-0000-4000-8000-000000000002', DealNumber: 'DEAL-B', DealStatusTypeID: OPEN };

    it('is allowed only when BOTH are won', async () => {
        withData([A, { ...B, DealStatusTypeID: WON }], { [WON]: true });
        expect(await veto().MayConfirm(ctx)).toBeNull();
    });

    it('is refused when either one is open, whichever is read first', async () => {
        withData([A, B], { [WON]: true, [OPEN]: false });
        const first = await veto().MayConfirm(ctx);
        withData([B, A], { [WON]: true, [OPEN]: false });
        const second = await veto().MayConfirm(ctx);
        expect(first, 'the open one decides, not the row order').not.toBeNull();
        expect(second).toEqual(first);
    });

    it('names only the deal that is actually open', async () => {
        withData([A, B], { [WON]: true, [OPEN]: false });
        const refusal = (await veto().MayConfirm(ctx)) ?? '';
        expect(refusal).toContain('DEAL-B');
        expect(refusal, "the deal that IS won is not what blocks the confirm").not.toContain('DEAL-A');
    });

    /**
     * ONE status read, not one per deal. MJ's UI guide says to batch rather than loop, and this sits
     * in the critical section of every confirm — a query per owner would put round trips on the save
     * path for nothing, since a single `IN` answers them together.
     */
    it('reads every status in ONE view, not one per deal', async () => {
        const { asked } = withData([A, B], { [WON]: true, [OPEN]: false });
        await veto().MayConfirm(ctx);
        const statusReads = asked.filter((e) => e.includes('Deal Status Types')).length;
        expect(statusReads, 'two owning deals must still cost one status read').toBe(1);
    });

    it('names both when both are open, and reads as plural', async () => {
        withData([{ ...A, DealStatusTypeID: OPEN }, B], { [OPEN]: false });
        const refusal = (await veto().MayConfirm(ctx)) ?? '';
        expect(refusal).toContain('DEAL-A');
        expect(refusal).toContain('DEAL-B');
        expect(refusal).toContain('Deals ');
        expect(refusal).toContain(' are not Won');
    });
});

/**
 * AN ORDER WITH NO DEAL IS NOT THIS APP'S BUSINESS. Orders are created directly too — most on the
 * reporting host were. Refusing those would make installing Sales break ordinary ordering, which is
 * the failure a seam exists to avoid.
 */
describe('an order no deal points at', () => {
    it('is allowed without comment', async () => {
        withData(null, {});
        expect(await veto().MayConfirm(ctx)).toBeNull();
    });

    it('does not even look up a status', async () => {
        const { asked } = withData(null, {});
        await veto().MayConfirm(ctx);
        expect(asked.some((e) => e.includes('Deal Status Types'))).toBe(false);
    });
});

/**
 * A READ THAT FAILS THROWS, and the seam turns that into a refusal naming the fault. Returning null
 * would confirm on "could not tell", which books against a possibly-open deal — the outcome this
 * exists to prevent, by another route.
 */
describe('when a read fails', () => {
    it('throws rather than allowing, when the deal cannot be read', async () => {
        withData(null, {}, 'deal');
        await expect(veto().MayConfirm(ctx)).rejects.toThrow(/deal behind this order could not be read/);
    });

    it('throws rather than allowing, when the status cannot be read', async () => {
        withData({ ID: DEAL, DealNumber: 'DEAL-1', DealStatusTypeID: WON }, {}, 'status');
        await expect(veto().MayConfirm(ctx)).rejects.toThrow(/status could not be read/);
    });
});

/**
 * WHAT THE READS THEMSELVES PROMISE.
 *
 * The cases above all assert the VERDICT, which leaves the arguments behind it free to drift: four
 * mutations to this file's subject survived the suite because nothing looked at them. These do.
 * Each one pins a property the header argues for, and each fails if that property is removed.
 */
describe('the reads the veto makes', () => {
    it('orders the deal read by ID, because the refusal names deals in a stable order', async () => {
        const { calls } = withData(
            [
                { ID: 'dddddddd-0000-4000-8000-000000000002', DealNumber: 'DEAL-B', DealStatusTypeID: OPEN },
                { ID: DEAL, DealNumber: 'DEAL-A', DealStatusTypeID: OPEN },
            ],
            { [OPEN]: false },
        );
        await veto().MayConfirm(ctx);
        const dealRead = calls.find((c) => String(c.args.EntityName).includes('Deals'));
        expect(dealRead, 'the deal read must happen at all').toBeTruthy();
        expect(dealRead!.args.OrderBy, 'without an ORDER BY a view promises nothing twice running').toBe('ID');
    });

    /**
     * #423: a role that may confirm orders but cannot read Deals had every confirm refused, because the
     * read ran as that role and failed. The rule is the server's, so it reads as the system user.
     */
    it('reads as the system user when the cache holds one, whatever the caller may read', async () => {
        const system = { ID: 'system', Name: 'System' } as never;
        const spy = vi.spyOn(UserCache.Instance, 'GetSystemUser').mockReturnValue(system);
        try {
            const user = { ID: 'finance-1', Name: 'Orders-only finance' } as never;
            const { calls } = withData({ ID: DEAL, DealNumber: 'DEAL-1', DealStatusTypeID: WON }, { [WON]: true });
            expect(await veto().MayConfirm({ OrderHeaderID: ORDER, FromStatus: 'Quoted', ContextUser: user })).toBeNull();
            expect(calls.length, 'both reads happen').toBe(2);
            for (const c of calls) {
                expect(c.user, 'the veto is not the caller\'s to answer').toBe(system);
            }
        } finally {
            spy.mockRestore();
        }
    });

    it('falls back to the signed-in user when no system user is cached', async () => {
        const user = { ID: 'user-1', Name: 'A Rep' } as never;
        const { calls } = withData({ ID: DEAL, DealNumber: 'DEAL-1', DealStatusTypeID: OPEN }, { [OPEN]: false });
        await veto().MayConfirm({ OrderHeaderID: ORDER, FromStatus: 'Quoted', ContextUser: user });
        expect(calls.length, 'both reads happen').toBe(2);
        for (const c of calls) {
            expect(c.user, 'a read made as nobody is not the same read').toBe(user);
        }
    });

    it('passes undefined rather than null when there is no user, which is what RunView expects', async () => {
        const { calls } = withData({ ID: DEAL, DealNumber: 'DEAL-1', DealStatusTypeID: OPEN }, { [OPEN]: false });
        await veto().MayConfirm(ctx);
        expect(calls[0].user).toBeUndefined();
    });

    it('doubles a quote in the order id instead of building a filter that breaks', async () => {
        const { calls } = withData(null, {});
        await veto().MayConfirm({ OrderHeaderID: "abc' OR 1=1 --", FromStatus: 'Quoted', ContextUser: null });
        expect(calls[0].args.ExtraFilter).toContain("abc'' OR 1=1 --");
    });

    it('trims a padded deal number, so the refusal reads as the rep would write it', async () => {
        withData({ ID: DEAL, DealNumber: '  DEAL-002148  ', DealStatusTypeID: OPEN }, { [OPEN]: false });
        const refusal = (await veto().MayConfirm(ctx)) ?? '';
        expect(refusal).toContain('Deal DEAL-002148 is');
        expect(refusal, 'the padding must not survive into the sentence').not.toContain('  DEAL-002148');
    });

    it('falls back to the id when the deal number is only whitespace', async () => {
        withData({ ID: DEAL, DealNumber: '   ', DealStatusTypeID: OPEN }, { [OPEN]: false });
        const refusal = (await veto().MayConfirm(ctx)) ?? '';
        expect(refusal, 'a blank name is no name — the id is what the rep can search on').toContain(DEAL);
    });
});

/**
 * A REFUSAL CAUSED BY AN UNREADABLE DEAL LEAVES A TRACE ON THE HOST THAT REFUSED IT.
 *
 * The throw becomes a refusal in Orders, so without a line here the Sales host that actually failed
 * the read logs nothing: an operator sees a confirm blocked by "a check from another app could not
 * be completed" and has nowhere to look for the cause. The sibling veto logs for the same reason.
 */
describe('a read failure reaches the log, not only the caller', () => {
    it('logs the deal read failure, naming the order', async () => {
        withData(null, {}, 'deal');
        await expect(veto().MayConfirm(ctx)).rejects.toThrow();
        expect(logged.join(' ')).toContain('DealNotWonConfirmVeto');
        expect(logged.join(' '), 'the order is the thing to look up').toContain(ORDER);
        expect(logged.join(' '), 'and the underlying error, not just that one happened').toContain('deal view is down');
    });

    it('logs the status read failure too', async () => {
        withData({ ID: DEAL, DealNumber: 'DEAL-1', DealStatusTypeID: WON }, {}, 'status');
        await expect(veto().MayConfirm(ctx)).rejects.toThrow();
        expect(logged.join(' ')).toContain('status view is down');
    });

    it('logs NOTHING on an ordinary refusal — that is a verdict, not a fault', async () => {
        withData({ ID: DEAL, DealNumber: 'DEAL-1', DealStatusTypeID: OPEN }, { [OPEN]: false });
        expect(await veto().MayConfirm(ctx)).not.toBeNull();
        expect(logged, 'a refused confirm is the veto working, and must not read as an error').toEqual([]);
    });
});
