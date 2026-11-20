/**
 * @fileoverview Money on the deal form, labelled in the deal's own currency (#371 items 4 and 5).
 *
 * Every figure the form shows is a stored value formatted for display: nothing here adds, multiplies
 * or rounds a stored amount (rule 1). The currency CODE comes from accounting through the same read
 * and the same `CurrencyCodeFor` rule the deal roster uses, and falls back to the display default
 * when the deal names no currency or accounting is not installed.
 *
 * ── WHOLE UNITS IN THE HEADER, CENTS EVERYWHERE ELSE ──────────────────────────────────────────────
 *
 * The hero is a briefing, read at a glance, so it shows whole units. Every other place on the form,
 * the Overview included, shows cents: a rep comparing the Overview with the Commercial section or a
 * line card must see the same figure in both.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { signal } from '@angular/core';
import { CurrencyCodeFor, DEFAULT_DISPLAY_CURRENCY, ReadCurrencyCodes } from '../workspace/deal-workspace.service';

/** Whole units (the hero) or cents (everywhere else on the form). */
export type DealMoneyPrecision = 'whole' | 'cents';

/**
 * The codes, as a signal so a template that formatted with the display default repaints when the
 * read lands, OnPush hosts included, without each panel needing a `ChangeDetectorRef`.
 */
const currencyCodes = signal<ReadonlyMap<string, string>>(new Map());
/** The read in flight or done; reset after a failure so the next form load tries again. */
let loaded: Promise<void> | null = null;
let attemptedFromTemplate = false;

/**
 * Read the currency codes once per session. A failed read is not kept, so calling this on each form
 * load (the hero does) retries it; a successful one costs nothing after the first.
 */
export function RefreshDealCurrencyCodes(): Promise<void> {
    if (!loaded) {
        loaded = ReadCurrencyCodes().then((codes) => {
            if (codes === null) {
                loaded = null;
                return;
            }
            currencyCodes.set(codes);
        });
    }
    return loaded;
}

/** The code a deal's money is shown in: its own currency, or the display default. */
export function DealCurrencyCode(currencyID: string | null | undefined): string {
    // Once from here: a template calls this on every pass, and a failed read must not be retried on
    // each of them. The hero's per-load refresh is what retries.
    if (!attemptedFromTemplate) {
        attemptedFromTemplate = true;
        void RefreshDealCurrencyCodes();
    }
    return CurrencyCodeFor(currencyID ?? null, currencyCodes());
}

/**
 * A stored amount formatted in the deal's currency, or '' when there is no amount.
 *
 * A code the browser does not recognise falls back to the display default rather than throwing out
 * of a template binding.
 */
export function FormatDealMoney(
    amount: number | null | undefined,
    currencyID: string | null | undefined,
    precision: DealMoneyPrecision,
): string {
    if (amount == null || !Number.isFinite(Number(amount))) return '';
    const digits = precision === 'whole'
        ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    const code = DealCurrencyCode(currencyID);
    try {
        return Number(amount).toLocaleString(undefined, { style: 'currency', currency: code, ...digits });
    } catch {
        return Number(amount).toLocaleString(undefined, { style: 'currency', currency: DEFAULT_DISPLAY_CURRENCY, ...digits });
    }
}
