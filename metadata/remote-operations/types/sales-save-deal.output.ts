/**
 * Output shapes for the Sales operation family. Declared here rather than repeated
 * per operation — see the header of `sales-save-deal.input.ts` for why definition
 * files may not import one another.
 */

/** Which pane of the deal workspace an issue belongs to. Matches the tab keys EXACTLY. */
export type SalesDealSection = 'deal' | 'party' | 'lines' | 'schedule' | 'terms' | 'variances';

/** Separates "you cannot save this" from "look at this". */
export type SalesDealSeverity = 'error' | 'warning';

/**
 * ONE ISSUE, STRUCTURED — never a joined string.
 *
 * `Section` is what lets a tab show a badge; `Field` is what lets the field itself
 * show a marker; `Severity` separates a blocker from an advisory. A joined error
 * string can do none of those, which is why every UI that starts with one ends up
 * parsing it back apart.
 */
export interface SalesDealIssue {
    Section: SalesDealSection;
    /** The offending field, where one field owns the problem. Null for whole-section issues. */
    Field?: string | null;
    /** For a line or instalment issue: which row, by the ClientKey the caller sent. */
    ClientKey?: string | null;
    Severity: SalesDealSeverity;
    /** Human-readable, and safe to show verbatim. */
    Message: string;
}

/** What became of one submitted line. */
export interface SalesSaveDealLineResult {
    /** Echoed back so the client can match this to the form row that produced it. */
    ClientKey?: string | null;
    ID: string;
    DisplayOrder: number;
}

/** What became of one submitted instalment. */
export interface SalesSaveDealScheduleResult {
    ClientKey?: string | null;
    ID: string;
    DisplayOrder: number;
}

/**
 * The result of composing a deal.
 *
 * `Success = false` with `Issues` carrying at least one `error` is the ORDINARY
 * outcome of a draft that is not yet valid — not an exception. Nothing was written
 * in that case: the whole save is one transaction, so it either all landed or none
 * of it did, and there is never a numbered deal with nothing under it.
 */
export interface SalesSaveDealOutput {
    Success: boolean;
    /** Null when nothing was written. */
    DealID?: string | null;
    /** The assigned DEAL-{seq}, once the sequence generator exists. Null before then. */
    DealNumber?: string | null;
    /** True when this call CREATED the deal rather than updating one. */
    Created: boolean;
    /** Empty on a clean save. Warnings may be present even when Success is true. */
    Issues: SalesDealIssue[];
    Lines: SalesSaveDealLineResult[];
    PaymentSchedule: SalesSaveDealScheduleResult[];
}
