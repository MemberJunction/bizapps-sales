import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { MJSDealLineEditorComponent } from '../lib/form-panels/deal-line-editor.component';

/**
 * THE ADD-PRODUCT DIALOG MUST NOT INVENT AN ORDER (DN-17, and golive#251's second symptom).
 *
 * `OrderID_EnsureObject()` returns the deal's real order only when `EmbeddedRecord` has been EXPOSED --
 * by a load, a save, or a wire deserialize. Reached with a deal whose `OrderID` names a real row but
 * whose peer never hydrated, it calls `NewRecord()` and hands back a BLANK order instead. That is not
 * an error anywhere: the dialog prices a line against it and the save writes a SECOND header.
 *
 * ── WHY THIS IS WORTH A TEST RATHER THAN A COMMENT ─────────────────────────────────────────────
 *
 * Both outcomes are silent in different ways, and the repo has now met each of them:
 *
 *   - On the deal FORM the second header has no `CompanyID`, so the insert dies two apps away on
 *     `Failed to save order header: Company cannot be null` -- a NOT NULL complaint about a column no
 *     human can see, while an order NUMBER is drawn and rolled back on every attempt.
 *   - On the WORKSPACE the header IS stamped with a company, so the save SUCCEEDS and the rep's line
 *     lands on an order nothing points at. `79-embedded-order-refresh.spec.ts` guards that half.
 *
 * `DealEntity.Save()` already resolves the peer after a SAVE. Neither of the above goes through a save,
 * so that guard cannot reach them -- this is the LOAD path, and it needs its own.
 *
 * ── WHAT THESE CHECKS PIN ──────────────────────────────────────────────────────────────────────
 *
 * The ORDER of the two calls, not merely that a load happened. Loading AFTER `Ensure()` is useless:
 * the blank has already been minted and `Ensure()` is idempotent, so it would return that blank
 * forever. A test that only asserted "load was called" would stay green through that rewrite.
 */

const ORDER_ID = '762de12a-0000-4000-8000-000000000001';

interface Harness {
    e: MJSDealLineEditorComponent;
    calls: string[];
}

/**
 * @param opts.orderID      what `Deal.OrderID` holds -- null means a deal with no order at all.
 * @param opts.hydrated     whether the peer is already exposed before ngOnInit runs.
 * @param opts.loadSucceeds whether `OrderID_LoadObject()` manages to hydrate it.
 */
function harness(opts: { orderID?: string | null; hydrated?: boolean; loadSucceeds?: boolean }): Harness {
    const { orderID = ORDER_ID, hydrated = false, loadSucceeds = true } = opts;
    const calls: string[] = [];

    let exposed = hydrated;
    const realOrder = {
        IsSaved: true,
        Lines: {
            Load: async () => { calls.push('Lines.Load'); },
            Create: async () => { calls.push('Lines.Create'); return { Quantity: 0 }; },
            Items: [] as unknown[],
        },
    };
    /** What `Ensure()` mints when the peer was never exposed: a NEW, unsaved, company-less order. */
    const blankOrder = {
        IsSaved: false,
        Lines: {
            Load: async () => { calls.push('Lines.Load'); },
            Create: async () => { calls.push('Lines.Create'); return { Quantity: 0 }; },
            Items: [] as unknown[],
        },
    };

    const deal = {
        OrderID: orderID,
        get OrderID_Object() { return exposed ? realOrder : null; },
        OrderID_LoadObject: async () => {
            calls.push('LoadObject');
            if (loadSucceeds) exposed = true;
            return exposed ? realOrder : null;
        },
        OrderID_EnsureObject: () => {
            calls.push('EnsureObject');
            // Faithful to EmbeddedRecord.Ensure(): the real peer only when exposed, else a blank.
            return exposed ? realOrder : blankOrder;
        },
        // Status is unread here, so ResolveDealLockState short-circuits without a provider.
        GetFieldByName: () => ({ OldValue: null }),
    };

    const e = Object.create(MJSDealLineEditorComponent.prototype) as MJSDealLineEditorComponent;
    Object.defineProperty(e, 'Deal', { value: deal, writable: true, configurable: true });
    Object.defineProperty(e, 'LineID', { value: null, writable: true, configurable: true });
    Object.defineProperty(e, 'service', {
        value: { LoadProducts: async () => [] },
        writable: true, configurable: true,
    });
    Object.defineProperty(e, 'cdr', { value: { detectChanges: () => undefined }, configurable: true });
    // `Object.create` skips field initializers, so `Error` would start `undefined` rather than the
    // `null` the constructed component has. Restore it, or every no-error assertion tests the harness.
    e.Error = null;

    return { e, calls };
}

describe('the add-product dialog resolves the deal’s own order before it can mint one', () => {
    it('LE1: hydrates the peer, and does so BEFORE Ensure() can mint a blank', async () => {
        const { e, calls } = harness({ hydrated: false, loadSucceeds: true });

        await e.ngOnInit();

        expect(calls, 'the FK must be resolved').toContain('LoadObject');
        expect(calls, 'and Ensure must still run').toContain('EnsureObject');
        expect(
            calls.indexOf('LoadObject'),
            `loading after Ensure() is useless — the blank is already minted. got ${JSON.stringify(calls)}`,
        ).toBeLessThan(calls.indexOf('EnsureObject'));
        expect(e.Error, 'a deal whose order resolves is not an error').toBeNull();
    });

    it('LE2: refuses, rather than composing a line against a blank order', async () => {
        // The order genuinely cannot be read — a permissions refusal, or the generated-type mismatch in
        // bizapps-orders#238. `Ensure()` has just minted a blank; going on writes a second header.
        const { e, calls } = harness({ hydrated: false, loadSucceeds: false });

        await e.ngOnInit();

        expect(e.Error, 'the rep must be told, not handed a phantom order').toBeTruthy();
        expect(
            calls,
            'a line composed here would be priced against, and saved to, an order nothing points at',
        ).not.toContain('Lines.Create');
    });

    it('LE3: says the order could not be READ, not that the deal has none', async () => {
        // These are different problems with different remedies, and the old copy only had words for the
        // second. A rep looking at a deal that plainly shows an order is not helped by "save the deal".
        const { e } = harness({ hydrated: false, loadSucceeds: false });

        await e.ngOnInit();

        expect(String(e.Error)).toMatch(/could not be loaded/i);
        expect(String(e.Error), 'this deal HAS an order').not.toMatch(/has no order yet/i);
    });

    it('LE4: an already-hydrated deal is not re-loaded', async () => {
        // The control. Without it the guard could be an unconditional load — correct, but a round trip
        // on every open of the dialog.
        const { e, calls } = harness({ hydrated: true });

        await e.ngOnInit();

        expect(calls, 'the peer was already there').not.toContain('LoadObject');
        expect(calls, 'and the dialog proceeds').toContain('Lines.Create');
        expect(e.Error).toBeNull();
    });

    it('LE5: a deal with NO order is left alone — the guard keys on the FK, not on IsSaved', async () => {
        /**
         * The second control, and the one that stops the refusal being too broad.
         *
         * A deal with no `OrderID` has an order that exists only in memory, and that is legitimate --
         * the workspace composes lines on one before the first save. Keying the refusal on `IsSaved`
         * ALONE would refuse exactly that case. It is keyed on `Deal.OrderID` being set as well, which
         * is the statement "this deal names an order that should have come back".
         */
        const { e, calls } = harness({ orderID: null });

        await e.ngOnInit();

        expect(calls, 'there is no FK to resolve').not.toContain('LoadObject');
        expect(e.Error, 'an in-memory order is not a failure').toBeFalsy();
        expect(calls, 'and the line is composed as before').toContain('Lines.Create');
    });
});
