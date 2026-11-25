import { describe, expect, it } from 'vitest';
import { DealEntityServer } from '../DealEntityServer.js';

/**
 * A TYPED AMOUNT IS REPLACED BY THE ORDER TOTAL WHEN THE DEAL CLOSES (#643).
 *
 * A deal whose Amount was typed (`AmountIsComputed` false) and whose lines were then edited from the
 * order form is never saved with a dirty order, so no ordinary save re-reads the total. The close is
 * the last save before the lock freezes the figure (#351), so it re-reads; so does the reopen.
 *
 * This drives the real `saveDeclared` and captures what it hands `saveWithinScope`, so the decision is
 * the shipped one, not a copy. Every check before it is stubbed to pass; `checkCloseLock` sets
 * `_lockedAtSave` the way the real one does for a deal persisted in a locking status.
 * `Object.create` holds the server entity without standing up metadata, as `ReopenWithFrozenEdit` does.
 */

const ORDER = 'eeeeeeee-0000-4000-8000-000000000001';
const OPEN = 'dddddddd-0000-4000-8000-000000000001';
const WON = 'dddddddd-0000-4000-8000-000000000002';

type Plan = { Kind: 'Close' | 'Reopen'; TargetStatusID: string; PriorStatusID: string; TargetIsLost: boolean };
type Work = { amountMayHaveMoved: boolean };
type Harness = { saveDeclared(): Promise<boolean>; BeginReopen<T>(body: () => Promise<T>): Promise<T> };

function deal(opts: {
    /** The persisted status locks the deal. */
    locked: boolean;
    /** What a status write on this save plans: a close, a reopen, or nothing. */
    statusWrite?: Plan | null;
    /** What `Sales.CloseDeal` / `Sales.ReopenDeal` declared, if this save is theirs. */
    declared?: 'Close' | 'Reopen' | null;
    orderID?: string | null;
}): { instance: Harness; captured: Work[] } {
    const captured: Work[] = [];
    const instance = Object.create(DealEntityServer.prototype) as Harness;
    const values: Record<string, unknown> = {
        IsSaved: true,
        DealNumber: 'D-1',
        OrderID: opts.orderID === undefined ? ORDER : opts.orderID,
        OrderID_Object: null,
        Amount: 5000,
        AmountIsComputed: false,
        DealStatusTypeID: opts.locked ? WON : OPEN,
        LossReasonID: null,
        _declaredTransition: opts.declared ? { Kind: opts.declared, Note: null } : null,
        _reopenInProgress: false,
        _closeInProgress: false,
        _orderStatusWarnings: [],
        _ownerStampWarnings: [],
        _orderJustProvisioned: false,
        _lockedAtSave: false,
        _lastStageEventID: null,
        _committed: false,
        _revertedStatusTarget: null,
        _resultHistory: [],
        ContextCurrentUser: { ID: 'u1' },
        Set: () => undefined,
        planStatusTransition: async () => opts.statusWrite ?? null,
        closeStampEditRefusal: () => null,
        checkCloseLock: async function (this: { _lockedAtSave: boolean }) {
            if (opts.locked) this._lockedAtSave = true;
            return null;
        },
        overrideSuppliedOwnerStamp: async () => undefined,
        stageBelongsToPipelineRefusal: async () => null,
        missingPartyRefusal: async () => null,
        teamRoleRulesRefusal: async () => null,
        companyLinkedToPipelineRefusal: async () => null,
        stampOwnerFromTeam: async () => undefined,
        defaultCurrencyOnCreate: async () => undefined,
        defaultCreationDateOnCreate: () => undefined,
        isBornClosedWithoutOrder: async () => true,
        moveDraftOrderDateToToday: async () => undefined,
        planStageOrderStatus: async () => null,
        planOrderBillTo: () => null,
        planStageEvent: () => null,
        planStageDefaults: async () => null,
        planScheduleSync: async () => null,
        seedOwnerOnCreate: async () => undefined,
        saveWithinScope: async (_options: unknown, work: Work) => {
            captured.push(work);
            return true;
        },
        runStatusTransition: async () => true,
    };
    for (const [k, v] of Object.entries(values)) {
        Object.defineProperty(instance, k, { value: v, writable: true });
    }
    return { instance, captured };
}

const closePlan: Plan = { Kind: 'Close', TargetStatusID: WON, PriorStatusID: OPEN, TargetIsLost: false };
const reopenPlan: Plan = { Kind: 'Reopen', TargetStatusID: OPEN, PriorStatusID: WON, TargetIsLost: false };

async function refreshes(d: { instance: Harness; captured: Work[] }): Promise<boolean> {
    expect(await d.instance.saveDeclared(), 'the save must reach saveWithinScope').toBe(true);
    expect(d.captured).toHaveLength(1);
    return d.captured[0].amountMayHaveMoved;
}

describe('a typed amount with a clean order', () => {
    it('is refreshed on the status write that closes the deal', async () => {
        expect(await refreshes(deal({ locked: false, statusWrite: closePlan }))).toBe(true);
    });

    it('is refreshed on the save Sales.CloseDeal makes', async () => {
        expect(await refreshes(deal({ locked: false, declared: 'Close' }))).toBe(true);
    });

    it('is refreshed on the save Sales.ReopenDeal makes', async () => {
        const d = deal({ locked: true, declared: 'Reopen' });
        expect(d.captured).toHaveLength(0);
        expect(await d.instance.BeginReopen(() => d.instance.saveDeclared())).toBe(true);
        expect(d.captured[0].amountMayHaveMoved).toBe(true);
    });

    /** No polling: an ordinary save of a typed amount still leaves the order unread. */
    it('is not refreshed on an ordinary save of an open deal', async () => {
        expect(await refreshes(deal({ locked: false }))).toBe(false);
    });

    it('is not refreshed when the deal has no order', async () => {
        expect(await refreshes(deal({ locked: false, statusWrite: closePlan, orderID: null }))).toBe(false);
    });
});

describe('a locked deal (#351)', () => {
    it('is not refreshed on a permitted edit', async () => {
        expect(await refreshes(deal({ locked: true }))).toBe(false);
    });

    /**
     * The status-write reopen's own save still sees the persisted locked status; the `Sales.ReopenDeal`
     * save it then runs is the one that refreshes (above).
     */
    it('is not refreshed by the locked save that asks for a reopen', async () => {
        expect(await refreshes(deal({ locked: true, statusWrite: reopenPlan }))).toBe(false);
    });
});
