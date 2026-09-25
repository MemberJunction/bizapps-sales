import { describe, expect, it } from 'vitest';
import { DealEntityServer } from '../DealEntityServer.js';
import { CloseDealOperation } from '../CloseDealOperation.js';

/**
 * A STATUS ROW THAT IS ABSENT LOCKS THE DEAL (bizapps-sales#103).
 *
 * `readStatusLockFlags` fails closed when the read FAILS. A read that succeeds and finds no row used
 * to fall through to `LocksDeal: false`, so a closed deal whose status row had gone became editable.
 * An absent row is as unanswerable as a failed read: nothing proves the deal is open.
 *
 * The repair path stays open. The deal may be moved to an open status as an ordinary write, and may
 * not be closed from the missing status, since nothing says whether it was already closed.
 *
 * `Object.create` holds the server entity without standing up metadata, as `StatusReadFailure` does.
 */

const OPEN = 'aaaaaaaa-0000-4000-8000-000000000001';
const WON = 'aaaaaaaa-0000-4000-8000-000000000002';
const GONE = 'aaaaaaaa-0000-4000-8000-00000000dead';

type Row = { LocksDeal: boolean; IsLost: boolean };
const LOCKING: Row = { LocksDeal: true, IsLost: false };
const OPENING: Row = { LocksDeal: false, IsLost: false };
const ROWS: Record<string, Row> = { [OPEN]: OPENING, [WON]: LOCKING };

/** A RunView double: a listed ID returns its row, anything else returns an empty, SUCCESSFUL read. */
function statusView(rows: Record<string, Row>) {
    return async ({ ExtraFilter }: { ExtraFilter: string }) => {
        const id = /ID = '([^']+)'/.exec(ExtraFilter)?.[1] ?? '';
        const row = rows[id];
        return row ? { Success: true, Results: [{ ID: id, ...row }] } : { Success: true, Results: [] };
    };
}

type Harness = {
    planStatusTransition(): Promise<{ Kind: string } | null>;
    checkCloseLock(): Promise<string | null>;
    saveDeclared(): Promise<boolean>;
    LatestResult: { Message?: string } | null;
    _lockedAtSave: boolean;
    SetCalls: string[];
};

/**
 * @param dirty the fields this save changed. `DealStatusTypeID` is dirty only when listed.
 */
function deal(opts: { persisted: string; target?: string; dirty: string[] }): Harness {
    const instance = Object.create(DealEntityServer.prototype) as Harness;
    const setCalls: string[] = [];
    const statusDirty = opts.dirty.includes('DealStatusTypeID');
    for (const [k, v] of Object.entries({
        IsSaved: true,
        _declaredTransition: null,
        _reopenInProgress: false,
        _orderStatusWarnings: [],
        _orderJustProvisioned: false,
        _lockedAtSave: false,
        _lastStageEventID: null,
        _resultHistory: [],
        DealStatusTypeID: opts.target ?? opts.persisted,
        ContextCurrentUser: { ID: 'u1' },
        GetFieldByName: (name: string) =>
            name === 'DealStatusTypeID' ? { Dirty: statusDirty, OldValue: opts.persisted } : undefined,
        Fields: opts.dirty.map((Name) => ({ Name, CodeName: Name, Dirty: true, OldValue: null })),
        Companions: [],
        RosterDrivesThisSave: false,
        ProviderToUse: { RunView: statusView(ROWS) },
        Set: (field: string) => {
            setCalls.push(field);
        },
    })) {
        Object.defineProperty(instance, k, { value: v, writable: true });
    }
    Object.defineProperty(instance, 'SetCalls', { get: () => setCalls });
    return instance;
}

describe('the close lock on a deal whose status row is absent', () => {
    it('refuses a frozen field, which the lock used to let through', async () => {
        const d = deal({ persisted: GONE, dirty: ['Amount'] });
        const refusal = await d.checkCloseLock();

        expect(refusal, 'an absent status must lock the deal').not.toBeNull();
        expect(refusal).toContain('could not be found');
        expect(refusal).toContain('Amount');
        expect(d._lockedAtSave).toBe(true);
    });

    it('keeps the ordinary locked set editable, the same as a read failure', async () => {
        const d = deal({ persisted: GONE, dirty: ['Description', 'NextStep'] });
        expect(await d.checkCloseLock()).toBeNull();
    });

    it('keeps Loss Notes frozen, since nothing says the deal was lost', async () => {
        const d = deal({ persisted: GONE, dirty: ['LossNotes'] });
        expect(await d.checkCloseLock()).toContain('Loss Notes');
    });

    it('lets the status itself be written, which is the repair path', async () => {
        const d = deal({ persisted: GONE, target: OPEN, dirty: ['DealStatusTypeID'] });
        expect(await d.checkCloseLock()).toBeNull();
    });

    it('does not extend the status exemption to a deal whose status row exists', async () => {
        // A bare status write on a really closed deal stays refused: that move runs through the flow.
        const d = deal({ persisted: WON, target: OPEN, dirty: ['DealStatusTypeID'] });
        expect(await d.checkCloseLock()).toContain('Deal Status');
    });

    it('leaves a deal whose status row exists and does not lock unlocked', async () => {
        const d = deal({ persisted: OPEN, dirty: ['Amount'] });
        expect(await d.checkCloseLock()).toBeNull();
        expect(d._lockedAtSave).toBe(false);
    });
});

describe('a status move away from an absent status', () => {
    it('plans nothing for a move to an open status, so it saves as an ordinary write', async () => {
        // Read as locking, this move would plan a Reopen; the repair path is a plain status write.
        const d = deal({ persisted: GONE, target: OPEN, dirty: ['DealStatusTypeID'] });
        expect(await d.planStatusTransition()).toBeNull();
    });

    it('refuses a move to a locking status instead of closing', async () => {
        const d = deal({ persisted: GONE, target: WON, dirty: ['DealStatusTypeID'] });
        expect((await d.planStatusTransition())?.Kind).toBe('PriorMissing');
    });

    it('refuses that save, before reverting the status', async () => {
        const d = deal({ persisted: GONE, target: WON, dirty: ['DealStatusTypeID'] });

        expect(await d.saveDeclared(), 'a close from a missing status must not save').toBe(false);
        expect(d.LatestResult?.Message).toContain('no longer exists');
        expect(d.SetCalls, 'the status must not have been reverted on the refused path').not.toContain(
            'DealStatusTypeID',
        );
    });
});

describe('Sales.CloseDeal on a deal whose current status row is absent', () => {
    function closeWith(current: string, rows: Record<string, Row>) {
        const provider = {
            GetEntityObject: async () => ({ Load: async () => true, DealStatusTypeID: current }),
            RunView: statusView(rows),
        };
        const op = new CloseDealOperation() as unknown as {
            InternalExecute(
                input: { DealID: string; DealStatusTypeID: string },
                provider: unknown,
                user: unknown,
            ): Promise<{ Success: boolean; Issues: { Message: string }[] }>;
        };
        return op.InternalExecute({ DealID: 'd1', DealStatusTypeID: WON }, provider, { ID: 'u1' });
    }

    it('refuses, because nothing says whether the deal is already closed', async () => {
        const result = await closeWith(GONE, ROWS);

        expect(result.Success).toBe(false);
        expect(result.Issues.map((i) => i.Message).join(' ')).toContain('could not be read or no longer exists');
    });
});
