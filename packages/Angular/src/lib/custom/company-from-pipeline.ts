/**
 * @fileoverview Supplying `Deal.CompanyID` on a new deal, so the form can be saved at all.
 *
 * ── THE DEFECT THIS EXISTS FOR ──────────────────────────────────────────────────────────────────
 *
 * A new deal could not be saved through the form. `Deal.CompanyID` is `NOT NULL` with no default, the
 * form renders it as a server-maintained field (correctly — a rep must not choose the selling company),
 * and `DealEntityServer.stampCompanyFromPipeline()` fills it on save. But `BaseFormComponent.SaveRecord`
 * runs `Validate()` FIRST and returns early when it fails, so the save never reached the server that was
 * going to supply the value. Required, unsettable, and filled too late: the record was unsaveable.
 *
 * It worked in the deal workspace because `SelectPipeline` stamped it client-side — "so the record
 * validates locally", in its own words. Unmounting the workspace (9d6ef9e) took the only code that did
 * this with it, and the form was never given the equivalent. That is the whole bug.
 *
 * ── WHY THE CLIENT MAY WRITE A SERVER-OWNED FIELD HERE, WHICH LOOKS WRONG ───────────────────────
 *
 * It is not the client DECIDING the selling company. It is the client pre-filling the answer the server
 * is about to write, read from the SAME authority the server reads — the pipeline. `stampCompanyFromPipeline`
 * overwrites whatever arrives, so the two cannot disagree: if this stamps the wrong value the server
 * replaces it, and if it stamps the right one the server writes it again. The pipeline remains the only
 * thing that can be correct about which company is selling.
 *
 * That is also why this does not make `CompanyID` editable. `deal-form.panels.ts` keeps it
 * `serverMaintained: true` and `server-owned-fields.ts` refuses a user's edit to it. Those stay exactly
 * as they were — what changes is that the value now arrives without a user having to supply one.
 *
 * ── KEYED ON THE CAUSE, NOT ON `IsSaved` ────────────────────────────────────────────────────────
 *
 * The obvious guard is "new deals only". The cause is not newness, it is an ABSENT CompanyID with a
 * pipeline available to resolve it — so that is what is tested. A saved deal always has one (the column
 * is NOT NULL), so the extra breadth costs nothing today and survives a path that creates a deal some
 * other way tomorrow. A guard keyed on a threshold gets outgrown; one keyed on a cause does not.
 *
 * @module @mj-biz-apps/sales-ng
 */

/**
 * The one column read off a pipeline. CodeGen generates no `PipelineEntity` subclass, and this only
 * ever reads — so the view runs `ResultType: 'simple'` and the row is typed here rather than borrowed.
 */
export interface PipelineCompanyRow {
    CompanyID: string | null;
}

/** What the decision needs to know. Kept flat so it can be tested without an entity or a DOM. */
export interface CompanyStampState {
    /** True when the form actually holds a record. */
    HasRecord: boolean;
    /** The pipeline the deal is in, as currently chosen. */
    PipelineID: string | null;
    /** The company currently on the deal, if any. */
    CompanyID: string | null;
}

/**
 * Whether `CompanyID` should be resolved from the pipeline and stamped.
 *
 * Pure and exported so the rule can be pinned without a database. Each clause is a way the stamp would
 * be wrong:
 *
 *  - no record, nothing to stamp;
 *  - no pipeline chosen yet, so there is no authority to read the company FROM — the rep has not made
 *    the choice that decides it, and inventing one would be the client deciding after all;
 *  - a company already present is left alone. On a saved deal that is the stored value, and overwriting
 *    it here would make this code an authority it is explicitly not.
 */
export function ShouldStampCompanyFromPipeline(state: CompanyStampState): boolean {
    if (!state.HasRecord) {
        return false;
    }
    if (!isSet(state.PipelineID)) {
        return false;
    }
    return !isSet(state.CompanyID);
}

/**
 * A GUID field counts as absent when it is null, undefined, or blank.
 *
 * The empty string matters: a picker that has been opened and cleared leaves `''`, not null, and a
 * truthiness test alone would have treated `'   '` as a real company id.
 */
function isSet(value: string | null | undefined): boolean {
    return typeof value === 'string' && value.trim().length > 0;
}
