import { describe, expect, it } from 'vitest';
import { DealEntityServer } from '../DealEntityServer.js';

/**
 * ONE SAVE THAT REOPENS A CLOSED DEAL AND CHANGES A FROZEN FIELD (#390).
 *
 * The reopen runs after the save, against the committed row, so the close lock still sees the deal as
 * closed and refuses the frozen field. The refusal used to say the field "cannot be changed until the
 * status is set back to Open", which is what the caller had just done. It now says to save the status
 * change first. The edit itself stays refused: applying it before the reopen would write a frozen
 * field on a closed deal.
 *
 * `Object.create` holds the server entity without standing up metadata, as `AbsentStatusLock` does.
 */

const OPEN = 'dddddddd-0000-4000-8000-000000000001';
const WON = 'dddddddd-0000-4000-8000-000000000002';

type Row = { LocksDeal: boolean; IsLost: boolean };
const ROWS: Record<string, Row> = {
    [OPEN]: { LocksDeal: false, IsLost: false },
    [WON]: { LocksDeal: true, IsLost: false },
};

function statusView() {
    return async ({ ExtraFilter }: { ExtraFilter: string }) => {
        const id = /ID = '([^']+)'/.exec(ExtraFilter)?.[1] ?? '';
        const row = ROWS[id];
        return row ? { Success: true, Results: [{ ID: id, ...row }] } : { Success: true, Results: [] };
    };
}

type Harness = {
    saveDeclared(): Promise<boolean>;
    LatestResult: { Message?: string } | null;
};

/** A deal persisted as Won. `dirty` lists the fields this save changed besides the status. */
function wonDeal(opts: { target: string; dirty: string[] }): Harness {
    const instance = Object.create(DealEntityServer.prototype) as Harness;
    const statusDirty = opts.target !== WON;
    for (const [k, v] of Object.entries({
        IsSaved: true,
        _declaredTransition: null,
        _reopenInProgress: false,
        _closeInProgress: false,
        _orderStatusWarnings: [],
        _ownerStampWarnings: [],
        _orderJustProvisioned: false,
        _lockedAtSave: false,
        _lastStageEventID: null,
        _resultHistory: [],
        DealStatusTypeID: opts.target,
        ContextCurrentUser: { ID: 'u1' },
        GetFieldByName: (name: string) =>
            name === 'DealStatusTypeID' ? { Dirty: statusDirty, OldValue: WON } : undefined,
        // The status is reverted before the lock runs, so it is clean by then; only the others stay dirty.
        Fields: opts.dirty.map((Name) => ({ Name, CodeName: Name, Dirty: true, OldValue: null })),
        Companions: [],
        RosterDrivesThisSave: false,
        ProviderToUse: { RunView: statusView() },
        Set: () => undefined,
    })) {
        Object.defineProperty(instance, k, { value: v, writable: true });
    }
    return instance;
}

describe('a save that reopens a closed deal and changes a frozen field', () => {
    it('is refused, and says to save the status change first', async () => {
        const d = wonDeal({ target: OPEN, dirty: ['Amount'] });

        expect(await d.saveDeclared(), 'the frozen edit must not land on a closed deal').toBe(false);
        const message = d.LatestResult?.Message ?? '';
        expect(message).toContain('Amount');
        expect(message).toContain('in the same save that reopens it');
        expect(message, 'must not ask for what the caller just did').not.toContain('set back to Open');
    });

    it('keeps the ordinary wording when the save does not touch the status', async () => {
        const d = wonDeal({ target: WON, dirty: ['Amount'] });

        expect(await d.saveDeclared()).toBe(false);
        expect(d.LatestResult?.Message).toContain('cannot be changed until the status is set back to Open');
    });
});
