import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * A DEAL WITH AN ORDER BUT NO CACHED AMOUNT COULD NEVER GET ONE.
 *
 * `amountMayHaveMoved` decides whether a save re-reads the order's `TotalGross`. Its three original
 * tests were `order.Dirty`, `order.Lines.Dirty` and `AmountIsComputed === true` — and the last is what
 * `refreshAmountFromOrder` STAMPS once it has cached a figure. A deal that never had one is false on
 * all three, forever.
 *
 * The line dialog saves the ORDER, not the deal, so by the time anything saves the deal the order is
 * clean. Measured: an order with `TotalGross` 229 against a deal reading `Amount` NULL, with no save
 * able to move it.
 *
 * The rule is reproduced here rather than imported because it is one expression inside `Save()`, and
 * extracting it to make it reachable would change the code to suit the test. What this pins is the
 * DECISION TABLE — every state and what it should answer — so a change to the expression that alters
 * any of them shows up as a failure with the state named.
 */
function amountMayHaveMoved(s: {
    /** The IN-MEMORY embedded order. Null on most saves — nothing loads it unless asked. */
    hasOrder: boolean;
    /** The FK. Present on any deal that has an order at all, loaded or not. */
    orderID?: boolean;
    orderDirty?: boolean;
    linesDirty?: boolean;
    amountIsComputed?: boolean;
    amount?: number | null;
}): boolean {
    const orderID = s.orderID ?? s.hasOrder;
    return (!!s.hasOrder && (!!s.orderDirty || !!s.linesDirty))
        || (!!orderID && (s.amountIsComputed === true || (s.amount ?? null) === null));
}

describe('when a deal re-reads its order total', () => {
    it('bootstraps a deal that has an order and no amount at all', () => {
        expect(amountMayHaveMoved({ hasOrder: true, amount: null, amountIsComputed: false })).toBe(true);
    });

    it('keeps re-reading once a figure has been cached', () => {
        expect(amountMayHaveMoved({ hasOrder: true, amount: 229, amountIsComputed: true })).toBe(true);
    });

    /**
     * THE CASE THAT MUST NOT POLL. A header-only deal with a TYPED amount has no computed figure and no
     * business reading the order on every save — the note in `Save()` rejects exactly that. Its amount
     * is non-null, which is what keeps it out.
     */
    it('leaves a typed header-only amount alone', () => {
        expect(amountMayHaveMoved({ hasOrder: true, amount: 5000, amountIsComputed: false })).toBe(false);
    });

    it('still reacts to an order edited in this save', () => {
        expect(amountMayHaveMoved({ hasOrder: true, amount: 5000, orderDirty: true })).toBe(true);
        expect(amountMayHaveMoved({ hasOrder: true, amount: 5000, linesDirty: true })).toBe(true);
    });

    it('does nothing at all without an order', () => {
        expect(amountMayHaveMoved({ hasOrder: false, orderID: false, amount: null })).toBe(false);
    });

    /**
     * THE CASE THAT MADE THE WHOLE GUARD INERT. `OrderID_Object` is the in-memory embedded order and is
     * null on a plain save from the form, so an `!!order &&` prefix short-circuited every other test.
     * A deal with an order it has not loaded must still re-read.
     */
    it('re-reads a deal whose order is not loaded in this session', () => {
        expect(amountMayHaveMoved({ hasOrder: false, orderID: true, amount: null })).toBe(true);
        expect(amountMayHaveMoved({ hasOrder: false, orderID: true, amount: 229, amountIsComputed: true })).toBe(true);
    });
});

/**
 * AND THE COPY IS TIED TO THE ORIGINAL.
 *
 * The table above reproduces the rule, which is the thing this repo keeps finding fault with: two
 * copies agree until one moves. This reads the shipped expression and asserts every term of it, so a
 * change there fails here rather than leaving a table that describes code nobody runs any more.
 */
describe('the table describes the code that actually runs', () => {
    const SOURCE = readFileSync(new URL('../DealEntityServer.ts', import.meta.url), 'utf8');

    it('pins each term of the shipped expression', () => {
        const at = SOURCE.indexOf('const amountMayHaveMoved =');
        expect(at, 'the guard must still exist under this name').toBeGreaterThan(-1);
        const expr = SOURCE.slice(at, SOURCE.indexOf(';', at));
        for (const term of [
            'order.Dirty',
            'order.Lines.Dirty',
            'this.AmountIsComputed === true',
            'this.Amount === null',
            'this.OrderID',   // the state tests must ask the FK, not the in-memory object
        ]) {
            expect(expr, `the guard no longer tests ${term}`).toContain(term);
        }
    });

    /** The bootstrap must be an OR beside the others, not a replacement for them. */
    it('adds the bootstrap without dropping what was there', () => {
        const at = SOURCE.indexOf('const amountMayHaveMoved =');
        const expr = SOURCE.slice(at, SOURCE.indexOf(';', at));
        expect((expr.match(/\|\|/g) ?? []).length, 'dirtiness pair, state pair, joined').toBe(3);
    });
});
