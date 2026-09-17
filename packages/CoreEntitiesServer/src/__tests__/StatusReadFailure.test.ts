import { describe, expect, it } from 'vitest';
import { DealEntityServer } from '../DealEntityServer.js';

/**
 * A STATUS ROW THAT CANNOT BE READ MUST NOT BE ASSUMED TO CLOSE A DEAL.
 *
 * `readStatusLockFlags` fails closed — `LocksDeal: true` — which is right for the close lock: an
 * unreadable status means we cannot prove the deal is unlocked, so refuse the edit.
 *
 * `planStatusTransition` reads that same value to mean "the target status closes the deal". Under the
 * same default, a transient failure on one row therefore produced a Close plan and ran a REAL close:
 * stage event, contract, finance tasks, a voided order, on a save that asked for none of it. One
 * default, two readings, opposite consequences.
 *
 * Guessing the other way is no better. A status that really does lock would then be written with no
 * close behind it, which is the defect golive#205 was filed about. So neither guess is taken and the
 * save is refused.
 *
 * `Object.create` holds the server entity without standing up metadata, the same way the orders veto
 * tests do. Only what `planStatusTransition` touches is shadowed.
 */

const OPEN = 'aaaaaaaa-0000-4000-8000-000000000001';
const WON = 'aaaaaaaa-0000-4000-8000-000000000002';

type Row = { LocksDeal: boolean; IsLost: boolean };

/**
 * @param rows what the status lookup returns, by ID. A missing entry means the read FAILED.
 */
function deal(opts: { target: string; prior: string | null; rows: Record<string, Row>; failAll?: boolean }) {
    const instance = Object.create(DealEntityServer.prototype) as {
        planStatusTransition(): Promise<{ Kind: string; TargetStatusID: string } | null>;
        Reads: string[];
    };
    const reads: string[] = [];

    Object.defineProperty(instance, 'IsSaved', { value: true, writable: true });
    Object.defineProperty(instance, '_declaredTransition', { value: null, writable: true });
    Object.defineProperty(instance, 'DealStatusTypeID', { value: opts.target, writable: true });
    Object.defineProperty(instance, 'ContextCurrentUser', { value: { ID: 'u1' }, writable: true });
    Object.defineProperty(instance, 'GetFieldByName', {
        value: () => ({ Dirty: true, OldValue: opts.prior }),
        writable: true,
    });
    Object.defineProperty(instance, 'ProviderToUse', {
        value: {
            RunView: async ({ ExtraFilter }: { ExtraFilter: string }) => {
                const id = /ID = '([^']+)'/.exec(ExtraFilter)?.[1] ?? '';
                reads.push(id);
                // A read that FAILS is `Success: false` — the case this file is about. A read that
                // succeeds but matches nothing returns an empty set, which is a different thing.
                if (opts.failAll) return { Success: false, ErrorMessage: 'connection reset' };
                const row = opts.rows[id];
                return row ? { Success: true, Results: [row] } : { Success: true, Results: [] };
            },
        },
        writable: true,
    });
    Object.defineProperty(instance, 'Reads', { get: () => reads });
    return instance;
}

const LOCKING: Row = { LocksDeal: true, IsLost: false };
const OPENING: Row = { LocksDeal: false, IsLost: false };

describe('when the target status cannot be read', () => {
    it('refuses instead of closing the deal', async () => {
        // THE DEFECT. Before this, the fail-closed `LocksDeal: true` read as "the target closes it",
        // and an ordinary pipeline save ran a full close on a database blip.
        const d = deal({ target: WON, prior: OPEN, rows: {}, failAll: true });
        const plan = await d.planStatusTransition();

        expect(plan, 'a failed read must still produce a plan, not a silent null').not.toBeNull();
        expect(plan?.Kind, 'and it must be the one the save refuses').toBe('Unreadable');
    });

    it('does not go on to read the prior status, having already given up', async () => {
        // Not cosmetic: the prior read is the one whose fail-closed default would have masked this,
        // by making both sides look locking and returning null — a silent proceed.
        const d = deal({ target: WON, prior: OPEN, rows: {}, failAll: true });
        await d.planStatusTransition();
        expect(d.Reads).toEqual([WON]);
    });
});

describe('a status that reads cleanly is unaffected', () => {
    it('still plans a Close for open -> locking', async () => {
        const d = deal({ target: WON, prior: OPEN, rows: { [WON]: LOCKING, [OPEN]: OPENING } });
        expect((await d.planStatusTransition())?.Kind).toBe('Close');
    });

    it('still plans a Reopen for locking -> open', async () => {
        const d = deal({ target: OPEN, prior: WON, rows: { [OPEN]: OPENING, [WON]: LOCKING } });
        expect((await d.planStatusTransition())?.Kind).toBe('Reopen');
    });

    it('still plans nothing for a move that crosses no boundary', async () => {
        const d = deal({ target: OPEN, prior: OPEN, rows: { [OPEN]: OPENING } });
        expect(await d.planStatusTransition()).toBeNull();
    });

    it('treats a status the lookup does not FIND as unreadable too', async () => {
        // `Success: true` with no rows is not a failure, but it is equally unanswerable: there is no
        // row to say whether this status closes a deal. Refusing beats guessing, and the foreign key
        // would refuse the write a moment later anyway — with a worse message.
        const d = deal({ target: 'aaaaaaaa-0000-4000-8000-00000000dead', prior: OPEN, rows: { [OPEN]: OPENING } });
        expect((await d.planStatusTransition())?.Kind).toBe('Unreadable');
    });
});
