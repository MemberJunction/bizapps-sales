import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { DealFormComponentExtended } from '../lib/custom/deal-form.component';

/**
 * THE FORM LETS A MISSING STATUS BE REPAIRED, AND NOTHING ELSE (#402).
 *
 * A deal whose status row no longer exists is locked. The server exempts one write from that lock,
 * the status itself, so the orphan can be set to an open status. The form's own pre-save check has to
 * make the same exemption, or it refuses the repair the lock notice asks for before the server sees it.
 */
function form(opts: { missing: boolean; dirty: string[] }) {
    const f = Object.create(DealFormComponentExtended.prototype) as DealFormComponentExtended;
    Object.defineProperty(f, 'record', {
        value: { Fields: opts.dirty.map((Name) => ({ Name, Dirty: true, Value: 'x' })) },
    });
    f.IsLocked = true;
    f.IsLost = false;
    f.IsStatusMissing = opts.missing;
    // The generated form's own Validate, shadowed: it needs a live record.
    const base = Object.getPrototypeOf(Object.getPrototypeOf(f));
    Object.defineProperty(base, 'Validate', {
        value: () => ({ Success: true, Errors: [] }),
        writable: true,
        configurable: true,
    });
    return f;
}

describe('saving a status repair on a deal whose status row is gone', () => {
    it('lets the status through', () => {
        expect(form({ missing: true, dirty: ['DealStatusTypeID'] }).Validate().Success).toBe(true);
    });

    it('still refuses every other frozen field', () => {
        const result = form({ missing: true, dirty: ['DealStatusTypeID', 'Amount'] }).Validate();
        expect(result.Success).toBe(false);
        expect(result.Errors.map((e) => e.Source)).toEqual(['Amount']);
    });

    it('does not extend the exemption to a deal whose status row exists', () => {
        // A closed deal's status moves through the reopen, never through a bare write.
        expect(form({ missing: false, dirty: ['DealStatusTypeID'] }).Validate().Success).toBe(false);
    });
});
