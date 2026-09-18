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

describe('the save itself, which is where the refusal lives', () => {
    /**
     * THE GUARD, DRIVEN. Everything above asserts the PLAN is `Unreadable`; this asserts what
     * `saveDeclared` does about it, which is the actual fix and the actual defect.
     *
     * Without this, replacing `if (transition?.Kind === 'Unreadable')` with `if (false)` — restoring
     * the defect exactly — kills nothing, because no test reaches the save. A plan nobody acts on is
     * not a refusal, and "it must be the one the save refuses" was an assertion about a caller that
     * no check ran.
     *
     * `saveDeclared` touches four fields before the guard and then calls `planStatusTransition`, so
     * the same fixture reaches it. `refuseSave` records through `RegisterResultHistoryEntry`, which
     * is why `Fields` and the result history are shadowed: core reads both.
     */
    function saving(opts: Parameters<typeof deal>[0]) {
        const setCalls: string[] = [];
        const d = deal(opts) as ReturnType<typeof deal> & {
            saveDeclared(): Promise<boolean>;
            LatestResult: { Message?: string } | null;
            SetCalls: string[];
        };
        for (const [k, v] of Object.entries({
            _orderStatusWarnings: [],
            _orderJustProvisioned: false,
            _lockedAtSave: false,
            _lastStageEventID: null,
            Fields: [],
            _resultHistory: [],
            /**
             * THE REVERT, MADE OBSERVABLE — and note this stub is why the two checks below exist.
             *
             * Without it, `this.Set('DealStatusTypeID', ...)` throws on this double, so moving the
             * refusal to AFTER the revert was killed by a TypeError rather than by an assertion. That
             * is a kill by accident: anyone completing this fixture — one line, exactly this line —
             * would have removed the only thing standing between the suite and that mutation, with
             * nothing failing to say so. Measured: with `Set` stubbed and no check below, the mutation
             * passes all eight tests.
             */
            Set: (field: string) => {
                setCalls.push(field);
            },
        })) {
            Object.defineProperty(d, k, { value: v, writable: true });
        }
        Object.defineProperty(d, 'SetCalls', { get: () => setCalls });
        return d;
    }

    it('REFUSES the save when the status could not be read', async () => {
        const d = saving({ target: WON, prior: OPEN, rows: {}, failAll: true });

        expect(await d.saveDeclared(), 'an unreadable status must not save').toBe(false);
        expect(d.LatestResult?.Message, 'and the operator is told what to do about it').toContain(
            'could not be read',
        );
    });

    /**
     * THE ORDERING, PINNED. The description calls this "the whole of why the retry works" and nothing
     * checked it.
     *
     * The revert exists so the lock and `super.Save()` do not write a status the transition is about
     * to move. On this path nothing downstream runs, so reverting would serve nothing and would cost
     * the retry: a reverted field is CLEAN, so re-saving the same object yields
     * `planStatusTransition() === null` on `!field?.Dirty` — no close, the other edits committed, and
     * `Save()` returning TRUE. A save that silently skips the close is exactly what this PR prevents.
     *
     * Asserting "the field is still dirty" would NOT do: `GetFieldByName` on this double returns a
     * fresh `{ Dirty: true }` every call, so that assertion can never fail. Whether `Set` ran is the
     * observable that actually separates the two orderings.
     */
    it('refuses BEFORE reverting the status, so a retry still sees the change', async () => {
        const d = saving({ target: WON, prior: OPEN, rows: {}, failAll: true });

        expect(await d.saveDeclared()).toBe(false);
        expect(d.SetCalls, 'the status must NOT have been reverted on the refused path').not.toContain(
            'DealStatusTypeID',
        );
    });

    it('does NOT refuse when the status reads cleanly', async () => {
        // The other half. Without it, a guard that refused every save would also pass the first.
        const d = saving({ target: WON, prior: OPEN, rows: { [WON]: LOCKING, [OPEN]: OPENING } });

        /**
         * POSITIVELY, not by absence. The previous form initialised `refused = false` and also set
         * `false` in its `catch`, so a `saveDeclared` that threw BEFORE reaching the guard passed
         * while never exercising it — the assertion and its fixture could drift apart silently.
         *
         * Reaching the revert is the proof that execution got PAST the guard, so it is asserted
         * directly. What happens beyond the revert is the close path's own subject, hence the catch.
         */
        try {
            await d.saveDeclared();
        } catch {
            /* the close path beyond the revert is not this file's business */
        }
        expect(d.LatestResult?.Message ?? '', 'a readable status must not hit the unreadable refusal')
            .not.toContain('could not be read');
        expect(d.SetCalls, 'and execution must actually have reached the revert, past the guard').toContain(
            'DealStatusTypeID',
        );
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
