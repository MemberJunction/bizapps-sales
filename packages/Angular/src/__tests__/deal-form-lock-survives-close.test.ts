import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { DealFormComponentExtended } from '../lib/custom/deal-form.component';

/**
 * THE LOCK MUST BE RE-RESOLVED AFTER A SAVE, NOT ONLY AT OPEN.
 *
 * `resolveCloseLock()` ran once, in `ngOnInit`, and reads the PERSISTED status
 * (`GetFieldByName('DealStatusTypeID').OldValue`). So a deal CLOSED in the form kept the `IsLocked`
 * it had when the form opened — false — for the rest of the session. The hero's Locked chip was
 * right the whole time because it reads the record; the form component did not.
 *
 * That is not cosmetic. `IsLocked` is what this form reasons from: `FieldEditable()` returns
 * `!locked || IsDealFieldEditableWhileLocked(...)`, so a stale false makes EVERY field report
 * editable; `EditableFieldNames()` returns null instead of the locked carve-outs; and
 * `ValidateAsync` reads it, with nothing else producing that signal.
 *
 * ── WHY THIS TEST EXISTS, AND WHAT IT CAN HONESTLY SEE ──────────────────────────────────────────
 *
 * The review on sales#156 noted there was no automated test, and suggested confirming it in UAT.
 * The end-to-end proof is `60-close-deal`'s "a closed deal renders its frozen fields read-only",
 * which passes with this fix and fails without it — but that spec travels in a different PR, so on
 * THIS branch the behaviour had nothing pinning it at all.
 *
 * What a unit test can prove is the WIRING: that both events are subscribed, and that each one
 * re-runs the resolve. It cannot prove the resolve reads the right thing — `resolveCloseLock` needs
 * a provider — and it does not try to. The resolve is stubbed and counted, which is exactly the part
 * that was missing: before the fix, zero re-runs, however many times the record saved.
 */

type Emitter = { subscribe(fn: () => void): void; fire(): void };

function emitter(): Emitter {
    const subs: Array<() => void> = [];
    return { subscribe: (fn) => { subs.push(fn); }, fire: () => { for (const f of subs) f(); } };
}

/** The component with its two resolves stubbed, so the test counts wiring rather than behaviour. */
function form() {
    const instance = Object.create(DealFormComponentExtended.prototype) as {
        ngOnInit(): Promise<void>;
        RecordSaved: Emitter;
        RecordRefreshed: Emitter;
        Resolves: number;
    };
    let resolves = 0;

    for (const [k, v] of Object.entries({
        RecordSaved: emitter(),
        RecordRefreshed: emitter(),
        // `super.ngOnInit()` — shadowed, because standing up the base form needs a provider.
        resolveCloseLock: async () => { resolves += 1; },
        resolveAmountFreshness: async () => undefined,
        cdr: { detectChanges: () => undefined },
    })) {
        Object.defineProperty(instance, k, { value: v, writable: true });
    }
    Object.defineProperty(instance, 'Resolves', { get: () => resolves });

    // Shadow the base class's ngOnInit, two links up the prototype chain.
    const base = Object.getPrototypeOf(Object.getPrototypeOf(instance));
    Object.defineProperty(base, 'ngOnInit', { value: async () => undefined, writable: true, configurable: true });
    return instance;
}

describe('the deal form resolves its lock', () => {
    it('once at init, as it always did', async () => {
        const f = form();
        await f.ngOnInit();
        expect(f.Resolves, 'opening the form must settle the lock').toBe(1);
    });

    it('AGAIN after a save — the close that invalidated it', async () => {
        const f = form();
        await f.ngOnInit();
        f.RecordSaved.fire();
        await Promise.resolve();
        expect(f.Resolves, 'a deal closed in the form must stop reporting itself unlocked').toBe(2);
    });

    it('AGAIN after a refresh', async () => {
        const f = form();
        await f.ngOnInit();
        f.RecordRefreshed.fire();
        await Promise.resolve();
        expect(f.Resolves).toBe(2);
    });

    it('every time, not just the first — a deal can close and reopen in one session', async () => {
        const f = form();
        await f.ngOnInit();
        f.RecordSaved.fire();
        f.RecordRefreshed.fire();
        f.RecordSaved.fire();
        await Promise.resolve();
        expect(f.Resolves, 'golive#206 item 2 allows reopening, so this cannot be a one-shot').toBe(4);
    });
});
