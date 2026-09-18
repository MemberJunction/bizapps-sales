import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { DealWorkspaceComponent } from '../lib/workspace/deal-workspace.component';
import { ShouldRefuseLineRemoval } from '../lib/workspace/deal-workspace.validation';

/**
 * ADDING A PRODUCT TO A CLOSED DEAL, FROM THE WORKSPACE (golive#206 item 1).
 *
 * Item 1 asks for a line on a closed deal to be refused "whichever screen or API path it comes from",
 * and names the deal FORM's grid for the affordance half. The workspace has its own Add button, which
 * the issue never mentions, and it was gated only on the deal being saved — so a rep could add a
 * product to a Won deal here while the form's grid refused the same gesture one screen over.
 *
 * The server is the rule, and orders enforces it now: a line saved through the order graph outside
 * booking is asked, and a frozen deal refuses. This is the affordance. Without it the gesture is
 * offered, taken, and fails at save time as a thrown error, which is the shape item 1 replaces.
 *
 * Built with `Object.create` rather than TestBed: these are two getters over two fields, and standing
 * up the component's providers would test the harness.
 */

function workspace(opts: { saved: boolean; locked: boolean }) {
    const c = Object.create(DealWorkspaceComponent.prototype) as {
        CanAddLine: boolean;
        AddLineBlockedReason: string | null;
    };
    Object.defineProperty(c, 'Deal', { value: { IsSaved: opts.saved }, writable: true });
    Object.defineProperty(c, 'Lock', {
        value: { IsLocked: opts.locked, StatusName: opts.locked ? 'Won' : null, IsLost: false, Notice: null },
        writable: true,
    });
    return c;
}

describe('the workspace Add-product button on a closed deal', () => {
    it('is disabled', () => {
        expect(workspace({ saved: true, locked: true }).CanAddLine).toBe(false);
    });

    it('says why, in the words the rest of the lock copy uses', () => {
        // golive#207's voice: state the condition and what to do. "Set the status back to Open" is the
        // same instruction the header notice and the server refusal give.
        const reason = workspace({ saved: true, locked: true }).AddLineBlockedReason;
        expect(reason).toBe('This deal is closed. Set the status back to Open before adding a product.');
    });

    it('still allows it on an open saved deal', () => {
        // The control. Without this the gate could be "always disabled" and every assertion above
        // would still pass.
        const open = workspace({ saved: true, locked: false });
        expect(open.CanAddLine).toBe(true);
        expect(open.AddLineBlockedReason).toBeNull();
    });

    it('keeps the unsaved-deal message when the deal is not locked', () => {
        // The pre-existing reason must not be swallowed by the new one — they are different problems
        // with different remedies, and a rep who has not saved yet is not being told about a lock.
        const unsaved = workspace({ saved: false, locked: false });
        expect(unsaved.CanAddLine).toBe(false);
        expect(unsaved.AddLineBlockedReason).toMatch(/Save the deal first/);
    });

    it('prefers the LOCK message when a deal is both unsaved and locked', () => {
        // Not reachable through the UI — a deal cannot be closed before it is saved — but the getter
        // has to choose, and the lock is the condition a rep cannot resolve by saving.
        expect(workspace({ saved: false, locked: true }).AddLineBlockedReason).toMatch(/This deal is closed/);
    });
});

describe('removal needs no second rule here', () => {
    it('already declines every SAVED line, whatever the lock says', () => {
        // `ShouldRefuseLineRemoval` is `!!line.IsSaved`, for KI-20's reasons rather than the lock's.
        // A rep on a closed deal meets the same wall either way, and a second rule would be two
        // messages for one refusal. Asserted so that if KI-20 is ever fixed and this relaxes, the
        // lock gap it currently hides becomes a failing test rather than a silent regression.
        expect(ShouldRefuseLineRemoval({ IsSaved: true })).toBe(true);
        expect(ShouldRefuseLineRemoval({ IsSaved: false })).toBe(false);
    });
});
