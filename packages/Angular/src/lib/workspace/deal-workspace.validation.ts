/**
 * @fileoverview Projects an entity `ValidationResult` onto the workspace's panes.
 *
 * WHY A PROJECTION EXISTS AT ALL. The rules live on the entity (`DealEntity`, `DealLineEntity`,
 * `DealPaymentScheduleEntity`) so they run in the browser AND on the server. What comes back is MJ's
 * `ValidationResult`: a flat list of `{ Source, Message, Value, Type }`. It has no notion of a tab,
 * because an entity should not know one exists.
 *
 * A tabbed surface needs three things the flat list only implies: which PANE owns an issue, which ROW
 * owns it, and whether it BLOCKS the save. Deriving them is presentational work, so it lives here rather
 * than being pushed into the entity — which is also what keeps the entity reusable by an Action, an
 * agent, or a future surface with different panes.
 *
 * WHAT MAKES IT RELIABLE. `RelatedRecordCollection.Validate()` re-labels a child's errors as
 * `Lines[0].ProductName` — the collection name, the index, then the field. That prefix is the entire
 * mechanism this file depends on: it is how a failing line is attributed to a row rather than reported
 * as an anonymous "Quantity must be zero or more" on a twenty-line deal.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { ValidationErrorType, type ValidationResult } from '@memberjunction/core';

/**
 * Which pane of the workspace an issue belongs to.
 *
 * These strings are ALSO the pane keys in `DEAL_WORKSPACE_PANES`, so one validation pass drives the tab
 * badges and the field markers with no second mapping table.
 */
export type DealWorkspaceSection = 'party' | 'lines' | 'schedule' | 'terms' | 'variances';

export type DealWorkspaceSeverity = 'error' | 'warning';

/** One problem with the deal, addressed to the part of the UI that can fix it. */
export interface DealWorkspaceIssue {
    Section: DealWorkspaceSection;
    /** The offending field, where one field owns the problem. Null for whole-record issues. */
    Field: string | null;
    /**
     * For a line or instalment issue: its position in the collection. Null for a header issue.
     *
     * The INDEX rather than a client-generated key, because the collection is the model now — the grid
     * iterates `Lines.Items`, so position is what both sides already agree on. The retired draft needed
     * a `ClientKey` because its rows existed before any collection did.
     */
    RowIndex: number | null;
    Severity: DealWorkspaceSeverity;
    /** Human-readable and safe to show verbatim. */
    Message: string;
}

export interface DealWorkspaceValidation {
    /** False when at least one issue is an error. Warnings alone never block a save. */
    IsValid: boolean;
    Issues: DealWorkspaceIssue[];
}

export function EmptyValidation(): DealWorkspaceValidation {
    return { IsValid: true, Issues: [] };
}

/**
 * Which pane owns each header field.
 *
 * Only fields a pane actually renders are listed. Anything else — including a `cannot be null` raised by
 * the base class for a column no pane exposes — falls through to the default below.
 */
const HEADER_FIELD_SECTION: Readonly<Record<string, DealWorkspaceSection>> = {
    Name: 'party',
    PipelineID: 'party',
    PipelineStageID: 'party',
    DealTypeID: 'party',
    DealStatusTypeID: 'party',
    AccountID: 'party',
    PrimaryContactID: 'party',
    BillingContactID: 'party',
    ExecutionDate: 'party',
    StartDate: 'party',
    ExpectedCloseDate: 'party',
    NextStepDate: 'party',
    Amount: 'terms',
    TermMonths: 'terms',
    EstimatedProjectWeeks: 'terms',
    Probability: 'terms',
    ForecastCategoryTypeID: 'terms',
    AutoRenew: 'terms',
    AnnualIncreasePctOverride: 'terms',
    CancellationNoticeDaysOverride: 'terms',
    PaymentMethod: 'terms',
    ContractVariances: 'variances',
    Description: 'variances',
    NextStep: 'variances',
};

/**
 * The pane an unrecognised field lands on.
 *
 * Party info rather than nothing, DELIBERATELY. An issue with no pane is an issue the user cannot see,
 * and a save that refuses with no visible reason is the worst outcome available here — worse than an
 * issue shown on a slightly surprising tab. This is the fallback for a `NOT NULL` on a column no pane
 * renders, which is exactly the case that would otherwise be invisible.
 */
const DEFAULT_SECTION: DealWorkspaceSection = 'party';

/** Maps a collection name to the pane that renders it. */
const COLLECTION_SECTION: Readonly<Record<string, DealWorkspaceSection>> = {
    Lines: 'lines',
    PaymentSchedule: 'schedule',
};

/** `Lines[3].ProductName` → collection, index, field. Null when the source is not a child error. */
function parseChildSource(source: string): { Collection: string; Index: number; Field: string | null } | null {
    const match = /^([A-Za-z]+)\[(\d+)\](?:\.(.+))?$/.exec(source);
    if (!match) {
        return null;
    }
    return { Collection: match[1], Index: Number(match[2]), Field: match[3] ?? null };
}

/**
 * Turns an entity validation result into pane-addressed issues.
 *
 * @param result - What `DealEntity.Validate()` returned, children included.
 * @returns The same problems, each attributed to a pane and — for a child — to a row.
 */
export function ProjectValidation(result: ValidationResult | null): DealWorkspaceValidation {
    if (!result) {
        return EmptyValidation();
    }

    const issues: DealWorkspaceIssue[] = (result.Errors ?? []).map<DealWorkspaceIssue>((e) => {
        const source = e.Source ?? '';
        const child = parseChildSource(source);
        const severity: DealWorkspaceSeverity =
            e.Type === ValidationErrorType.Warning ? 'warning' : 'error';

        if (child) {
            return {
                Section: COLLECTION_SECTION[child.Collection] ?? DEFAULT_SECTION,
                Field: child.Field,
                RowIndex: child.Index,
                Severity: severity,
                Message: e.Message,
            };
        }

        return {
            Section: HEADER_FIELD_SECTION[source] ?? DEFAULT_SECTION,
            Field: source || null,
            RowIndex: null,
            Severity: severity,
            Message: e.Message,
        };
    });

    // Derived from the issues rather than copied from `result.Success`, because the two can legitimately
    // disagree: a result carrying only warnings has Success true, and a caller that merged results would
    // otherwise have to keep a separate flag in step by hand.
    return { IsValid: !issues.some((i) => i.Severity === 'error'), Issues: issues };
}
