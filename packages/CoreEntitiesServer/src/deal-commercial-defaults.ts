/**
 * @fileoverview Defaults for a deal's empty commercial terms (golive #486).
 *
 * A deal's term, start date and currency were blank unless a rep typed them. Currency defaulted once,
 * at create; the term defaulted only at close, from the pipeline's Close Won Policy, and nothing set a
 * start date. `DealEntityServer.Save()` now fills each of them when it is empty, on every save of an
 * open deal (adding products saves the deal, so that is covered too), and never overwrites a value:
 *
 *   - TermMonths from the pipeline's Close Won Policy `TermMonths`, the value the close already used.
 *   - StartDate from ExpectedCloseDate. ExecutionDate is left blank: it records when the agreement was
 *     signed, which no default can know.
 *   - CurrencyID from the selling company, as before (`DealEntityServer.defaultCurrencyOnCreate`).
 *
 * The rules are pure so they can be tested without a database; the reads stay in the entity server.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */

/** The deal fields these defaults read and write. */
export interface CommercialDefaultsInput {
    TermMonths: number | null;
    StartDate: Date | null;
    ExpectedCloseDate: Date | null;
}

/** What to set. A key is present only when that field is empty and a default exists. */
export interface CommercialDefaultsPlan {
    TermMonths?: number;
    StartDate?: Date;
}

/**
 * The default term a pipeline's Close Won Policy states, or null.
 *
 * Null for a missing or unparseable policy and for a `TermMonths` that is not a positive whole number:
 * a default that cannot be read is no default, and never a reason to refuse a save. The pipeline's own
 * save validates the policy (`PipelineEntityServer`), so a bad value here is one saved before that check.
 */
export function PipelineDefaultTermMonths(closeWonPolicy: string | null | undefined): number | null {
    if (!closeWonPolicy) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(closeWonPolicy);
    } catch {
        return null;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const term = (parsed as { TermMonths?: unknown }).TermMonths;
    return typeof term === 'number' && Number.isInteger(term) && term > 0 ? term : null;
}

/**
 * Which empty commercial fields to fill, and with what.
 *
 * @param deal the deal's current values
 * @param pipelineTermMonths {@link PipelineDefaultTermMonths} for the deal's pipeline, or null
 */
export function PlanCommercialDefaults(
    deal: CommercialDefaultsInput,
    pipelineTermMonths: number | null,
): CommercialDefaultsPlan {
    const plan: CommercialDefaultsPlan = {};
    if (deal.TermMonths == null && pipelineTermMonths != null) {
        plan.TermMonths = pipelineTermMonths;
    }
    if (deal.StartDate == null && deal.ExpectedCloseDate != null) {
        plan.StartDate = deal.ExpectedCloseDate;
    }
    return plan;
}

/**
 * The term a won close sends downstream: the deal's own term when it has one, else the effective
 * policy's (golive #486). The deal's term used to lose to the pipeline's, which overrode a term the
 * account director had typed.
 */
export function CloseTermMonths(dealTermMonths: number | null | undefined, policyTermMonths: number | null | undefined): number | null {
    return dealTermMonths ?? policyTermMonths ?? null;
}
