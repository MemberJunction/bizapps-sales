import { describe, it, expect } from 'vitest';

import { expectOrder } from './helpers/call-order';

/**
 * The ordering helper the two reopen suites depend on, checked against the shapes it exists to reject.
 *
 * A test helper that is quietly too weak is worse than none: every suite using it reports green while
 * asserting less than it claims. `expectOrder` had exactly that fault — it compared the FIRST index of
 * both calls, so a save ADDED after the operation slipped through while a save MOVED after it was
 * caught. The reopen suites' own headers name the added-save sequence as the worse bug.
 */
describe('expectOrder', () => {
    it('accepts the correct order', () => {
        expect(() => expectOrder(['Save', 'Reopen'], 'Save', 'Reopen')).not.toThrow();
    });

    it('rejects the reversed order', () => {
        expect(() => expectOrder(['Reopen', 'Save'], 'Save', 'Reopen')).toThrow();
    });

    it('rejects a SECOND before-call that lands after the operation', () => {
        // The regression this helper was rewritten for. `indexOf('Save') < indexOf('Reopen')` holds
        // here, and the sequence still contains a save writing over a row the operation has moved.
        expect(() => expectOrder(['Save', 'Reopen', 'Save'], 'Save', 'Reopen')).toThrow();
    });

    it('rejects a missing call rather than passing on -1', () => {
        expect(() => expectOrder(['Reopen'], 'Save', 'Reopen')).toThrow();
        expect(() => expectOrder(['Save'], 'Save', 'Reopen')).toThrow();
    });
});
