/**
 * @fileoverview The Payment schedule panel's running total (bc-aidp-next-golive#290).
 *
 * The panel listed instalments and compared them with nothing, so a schedule a cent short of the deal
 * saved with no total, no remainder and no warning. Orders refuses a schedule that does not add up to
 * the order's total (at Close Won the close is refused; after Won the order keeps its previous
 * schedule), and the rep had no way to see that coming. This is the figure that lets them.
 *
 * DISPLAY ONLY. Nothing here refuses, saves or sends anything: the tie that governs is orders' own,
 * reached through `Orders.ReplacePaymentSchedule`.
 *
 * ── RULE ONE ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Sales never computes money: no price, discount, tax, proration, header total or rounding of a
 * figure. This adds up instalment amounts a rep typed and compares the sum with `Deal.Amount`, which
 * is a cached copy of the order's total. Nothing is priced and nothing is written to a money column.
 * The conversion to cents changes no value: both columns are DECIMAL(18,2), so each amount is already a
 * whole number of cents, and the conversion only removes the float noise that adding them would
 * otherwise introduce (1000.1 + 1000.2 is not 2000.3 in floating point).
 *
 * ── THE TOLERANCE IS ORDERS' TOLERANCE ──────────────────────────────────────────────────────────
 *
 * Half a cent, which is what orders' schedule tie check uses for the same reason. In integer cents
 * that means the sums must be equal.
 *
 * @module @mj-biz-apps/sales-ng
 */

/** One instalment as the panel reads it. Both columns are nullable on the deal. */
export interface DealScheduleRowFigures {
    Amount: number | null | undefined;
    PaymentDate: string | Date | null | undefined;
}

/** What the panel shows under the grid. */
export interface DealScheduleTotal {
    /** Rows on the deal. The panel shows nothing when there are none. */
    RowCount: number;
    /** The rows' amounts added up. */
    Scheduled: number;
    /** The deal's own amount, or null when it has none yet. */
    DealAmount: number | null;
    /** Deal amount minus scheduled: positive when some is unscheduled, negative when over. Null with no deal amount. */
    Remainder: number | null;
    /** Rows the order would refuse: no date, no amount, or an amount of zero or less. */
    Incomplete: number;
    /** True with no rows, or when the rows are complete and add up to the deal amount (or there is no amount to tie to). */
    Ties: boolean;
}

/** A DECIMAL(18,2) amount as whole cents, so a sum of them is exact. */
function toCents(value: number): number {
    return Math.round(value * 100);
}

function isIncomplete(row: DealScheduleRowFigures): boolean {
    const amount = row.Amount == null ? NaN : Number(row.Amount);
    return !row.PaymentDate || !Number.isFinite(amount) || amount <= 0;
}

/** Reads the deal's rows against the deal's amount. */
export function ReadDealScheduleTotal(
    rows: readonly DealScheduleRowFigures[],
    dealAmount: number | null | undefined,
): DealScheduleTotal {
    const incomplete = rows.filter(isIncomplete).length;
    // money-grep-allow: adds instalment amounts a rep typed, for display beside the deal amount; not a derivation (rule one, see the file header).
    const scheduledCents = rows.reduce((sum, row) => sum + toCents(Number(row.Amount ?? 0) || 0), 0);
    const deal = dealAmount == null || !Number.isFinite(Number(dealAmount)) ? null : Number(dealAmount);
    const remainderCents = deal === null ? null : toCents(deal) - scheduledCents;
    return {
        RowCount: rows.length,
        Scheduled: scheduledCents / 100,
        DealAmount: deal,
        Remainder: remainderCents === null ? null : remainderCents / 100,
        Incomplete: incomplete,
        // No rows is no schedule (the order bills in one amount), not a schedule that fails to tie.
        Ties: rows.length === 0 || (incomplete === 0 && (remainderCents === null || remainderCents === 0)),
    };
}

const ORDER_RULE = 'the order accepts a payment schedule only when every instalment has a date and an amount and they add up to its total';

/**
 * One sentence explaining why the schedule does not tie, or null when it does.
 *
 * A row missing its date or amount is named first: typing the missing amount changes the gap.
 */
export function ExplainDealScheduleGap(total: DealScheduleTotal, formatMoney: (amount: number) => string): string | null {
    if (total.Ties || total.RowCount === 0) return null;
    if (total.Incomplete > 0) {
        const rows = total.Incomplete === 1 ? '1 instalment has' : `${total.Incomplete} instalments have`;
        return `${rows} no date or no amount above zero, and ${ORDER_RULE}.`;
    }
    if (total.Remainder === null || total.Remainder === 0) return null;
    return total.Remainder > 0
        ? `${formatMoney(total.Remainder)} of the deal amount is not scheduled, and ${ORDER_RULE}.`
        : `The instalments come to ${formatMoney(-total.Remainder)} more than the deal amount, and ${ORDER_RULE}.`;
}
