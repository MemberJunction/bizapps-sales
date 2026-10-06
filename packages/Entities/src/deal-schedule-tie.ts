/**
 * @fileoverview Does a deal's payment schedule tie to the deal's amount? (bc-aidp-next-golive#290)
 *
 * The Deal form's Payment schedule panel accepts instalment rows and never checked them against
 * anything. A schedule a penny short of the deal saved with no total, no remainder and no warning,
 * and the rows never reached the order at Close Won — so the order booked and invoiced its full
 * value in one amount while the deal showed four instalments.
 *
 * ── RULE ONE, AND WHY THIS IS NOT A BREACH OF IT ────────────────────────────────────────────────
 *
 * CLAUDE.md §1: sales NEVER computes money. The forbidden list is derivations — multiply quantity by
 * price, apply a discount, compute tax, prorate, SUM LINES INTO A HEADER TOTAL, round. This does none
 * of those. It adds up amounts a human typed into schedule rows and compares the sum with
 * `Deal.Amount`, which is itself a cached copy of `OrderHeader.TotalGross`. Nothing here produces a
 * price, and nothing here is written back to a money column: the result is a warning and a refusal.
 *
 * The money gate is a heuristic that cannot tell a rollup from a derivation, so the one sum below
 * carries a `money-grep-allow` annotation. That annotation is the reviewable record the gate exists
 * to leave behind — it is not an exemption, and the reasoning above is what it points at.
 *
 * ── THE TOLERANCE IS ORDERS' TOLERANCE ──────────────────────────────────────────────────────────
 *
 * Half a penny, because both `DealPaymentSchedule.Amount` and `OrderHeaderPaymentSchedule.Amount`
 * are `DECIMAL(18,2)`. Orders' own tie check (`ScheduleShortfalls`) uses the same figure for the same
 * reason. It is restated rather than imported: that function lives in
 * `@mj-biz-apps/orders-core-entities-server`, which sales does not depend on — sales takes only
 * `@mj-biz-apps/orders-entities` — and it answers a different question anyway (per-company, against
 * order lines). What is deliberately kept aligned is the WORDING, so a rep who sees the refusal here
 * and the refusal at confirm reads the same sentence about the same problem.
 *
 * @module @mj-biz-apps/sales-entities
 */

/** A schedule row as the tie check reads it. Both columns are nullable on the deal. */
export interface DealScheduleRow {
    Amount: number | null | undefined;
    PaymentDate: string | Date | null | undefined;
}

/** What the panel shows and what the close refusal reads. */
export interface DealScheduleTie {
    /** Rows present at all. No rows is not a broken schedule — it is no schedule. */
    RowCount: number;
    /** The rows' amounts added up, to the cent. */
    Scheduled: number;
    /** The deal's own amount, carried so nothing downstream has to reconstruct it by adding. */
    DealAmount: number | null;
    /** `Deal.Amount − Scheduled`: positive when money is unscheduled, negative when over-scheduled. */
    Remainder: number;
    /** True when the schedule may stand: no rows at all, or rows that tie and are complete. */
    Ties: boolean;
    /**
     * Rows missing a date or an amount.
     *
     * NOT a nicety. `OrderHeaderPaymentSchedule.DueDate` and `.Amount` are both NOT NULL, while the
     * deal's are nullable — so a row with either one blank cannot become an order row at all. Left
     * unchecked, the copy at Close Won would have to either drop the row or invent a value, and both
     * of those are worse than refusing while the rep is still looking at the panel.
     */
    Incomplete: number;
}

/** Cents, so a sum of two-decimal columns does not drift into float noise. */
function cents(n: number): number {
    return Math.round(n * 100);
}

/**
 * Reads the schedule against the deal's amount.
 *
 * `dealAmount` null means the deal has no amount yet, so there is nothing to tie TO. That reports as
 * tying: a schedule on an unpriced deal is premature, not wrong, and refusing it would block the rep
 * from entering one before the order comes back.
 */
export function ReadDealScheduleTie(rows: readonly DealScheduleRow[], dealAmount: number | null | undefined): DealScheduleTie {
    const incomplete = rows.filter((r) => r.Amount === null || r.Amount === undefined || !r.PaymentDate).length;
    // money-grep-allow: rollup of typed schedule amounts for the tie check, not a derivation — see the module comment.
    const scheduledCents = rows.reduce((sum, r) => sum + cents(Number(r.Amount ?? 0)), 0);
    const scheduled = scheduledCents / 100;

    if (!rows.length) {
        return { RowCount: 0, Scheduled: 0, DealAmount: dealAmount ?? null, Remainder: 0, Ties: true, Incomplete: 0 };
    }
    if (dealAmount === null || dealAmount === undefined) {
        return { RowCount: rows.length, Scheduled: scheduled, DealAmount: null, Remainder: 0, Ties: incomplete === 0, Incomplete: incomplete };
    }

    const remainderCents = cents(Number(dealAmount)) - scheduledCents;
    return {
        RowCount: rows.length,
        Scheduled: scheduled,
        DealAmount: Number(dealAmount),
        Remainder: remainderCents / 100,
        // Half a penny, as DECIMAL(18,2) demands and as orders' own check uses.
        Ties: Math.abs(remainderCents) < 0.5 && incomplete === 0,
        Incomplete: incomplete,
    };
}

/**
 * The refusal, in words a rep can act on, shaped after orders' `ExplainShortfalls` so the same
 * problem reads the same way at Close Won and at confirm.
 */
export function ExplainDealScheduleTie(tie: DealScheduleTie): string | null {
    if (tie.Ties) return null;
    if (tie.Incomplete > 0) {
        const rows = tie.Incomplete === 1 ? 'row is' : 'rows are';
        return (
            `${tie.Incomplete} payment schedule ${rows} missing a date or an amount. ` +
            'Every instalment needs both before the deal can close, because the order copies them as they stand.'
        );
    }
    const direction =
        tie.Remainder > 0
            ? `${tie.Remainder.toFixed(2)} unscheduled`
            : `${(-tie.Remainder).toFixed(2)} over-scheduled`;
    return (
        `The payment schedule does not tie to the deal amount — ${tie.Scheduled.toFixed(2)} scheduled ` +
        `against ${(tie.DealAmount ?? 0).toFixed(2)} on the deal (${direction}). ` +
        'Fix the schedule, or remove it to bill the deal as one instalment.'
    );
}
