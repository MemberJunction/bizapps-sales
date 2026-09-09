import { describe, it, expect } from 'vitest';
import { IsBareCloseWrite, type StatusTransitionFacts } from '../close-lock';

/**
 * bc-aidp-next-golive#205: setting Deal Status to Won or Lost on the form locked the deal and ran
 * none of the close — no stage event, no contract, no finance tasks, no loss reason, an order left
 * live — and then the lock refused the status field, so it could not be undone either.
 *
 * The close lock could not catch it because it reads the PERSISTED status: Open -> Won is a save on
 * an unlocked deal. This rule is the missing half, and it is the transition rather than the field
 * that identifies a legitimate close.
 */
const bareWonWrite: StatusTransitionFacts = {
    IsSaved: true,
    HasDeclaredTransition: false,
    StatusIsDirty: true,
    TargetLocks: true,
    PriorLocks: false,
};

describe('a status write that would lock the deal without closing it', () => {
    it('is refused — the reported defect', () => {
        expect(IsBareCloseWrite(bareWonWrite)).toBe(true);
    });

    it('is allowed when a close declared itself', () => {
        // `Sales.CloseDeal` calls stampClose immediately before saving, and that declares the
        // transition. This is the single fact separating the real close from the form write.
        expect(IsBareCloseWrite({ ...bareWonWrite, HasDeclaredTransition: true })).toBe(false);
    });

    it('ignores a save that does not touch the status', () => {
        expect(IsBareCloseWrite({ ...bareWonWrite, StatusIsDirty: false })).toBe(false);
    });

    it('ignores ordinary pipeline movement into a status that does not lock', () => {
        expect(IsBareCloseWrite({ ...bareWonWrite, TargetLocks: false })).toBe(false);
    });

    it('leaves a REOPEN attempt to the close lock, which words it better', () => {
        // Won -> Open. Refusing here too would give one edit two refusals, and the close lock's
        // message is the one that names Sales.ReopenDeal.
        expect(
            IsBareCloseWrite({ ...bareWonWrite, PriorLocks: true, TargetLocks: false }),
        ).toBe(false);
    });

    it('leaves a lock-to-lock move to the close lock as well', () => {
        // Won -> Lost on an already-closed deal is an edit to a frozen record, not a close.
        expect(IsBareCloseWrite({ ...bareWonWrite, PriorLocks: true, TargetLocks: true })).toBe(false);
    });

    it('does not fire on creation', () => {
        // A deal born closed has no transition to have run, and the opening-status default would
        // otherwise read as one.
        expect(IsBareCloseWrite({ ...bareWonWrite, IsSaved: false })).toBe(false);
    });

    it('treats a first status with no prior as a close like any other', () => {
        expect(IsBareCloseWrite({ ...bareWonWrite, PriorLocks: null })).toBe(true);
    });
});
