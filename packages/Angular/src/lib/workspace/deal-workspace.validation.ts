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

/**
 * `Lines[3].ProductName` → collection, index, field. Null when the source is not a child error.
 *
 * ── THE PREFIX IS THE WHOLE FIX, AND EVERY LINE ERROR LANDED ON THE WRONG PANE WITHOUT IT ────────
 *
 * The pattern used to anchor the collection on `[A-Za-z]+`, which was right when a child error read
 * `Lines[3].Quantity`. It does not any more: `EmbeddedRecord.prefixError` emits
 *
 *     OrderID_Object.Lines[3].Quantity
 *
 * and neither `_` nor `.` is in `[A-Za-z]`. So the match failed, the error fell through to
 * `DEFAULT_SECTION` with a null row index, and the result was the worst combination available: Save
 * disabled, the Lines badge reading 0, no row marked, and the message shown on **Party info** — a pane
 * that has nothing to do with it. `COLLECTION_SECTION.Lines` became unreachable, which is the tell.
 *
 * ── WHY THE LAST SEGMENT RATHER THAN THE WHOLE PATH ─────────────────────────────────────────────
 *
 * The path names how the collection was REACHED; `COLLECTION_SECTION` is keyed by what the collection
 * IS. `OrderID_Object.Lines` and a future `SomethingElse.Lines` are the same grid to a reader, so the
 * last segment is the part that answers "which pane renders this". Taking the whole path would put the
 * embed's field name in a lookup table that has no business knowing it.
 *
 * Both shapes are accepted deliberately: the un-prefixed form is what a direct child of the deal still
 * produces, and a regex that only understood the new shape would move the bug rather than fix it.
 */
function parseChildSource(source: string): { Collection: string; Index: number; Field: string | null } | null {
    const match = /^([A-Za-z0-9_.]+)\[(\d+)\](?:\.(.+))?$/.exec(source);
    if (!match) {
        return null;
    }
    const path = match[1];
    const collection = path.slice(path.lastIndexOf('.') + 1);
    if (!collection) {
        return null;
    }
    return { Collection: collection, Index: Number(match[2]), Field: match[3] ?? null };
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


/**
 * A refused discount, as a BLOCKING issue on the row that carries it.
 *
 * ── WHY THIS IS NOT A WARNING ───────────────────────────────────────────────────────────────────
 *
 * `SetDiscountPercent` refuses an ambiguous figure — is `0.5` half a percent or fifty? — and leaves the
 * entity holding its previous value. The refusal was recorded in a map the TEMPLATE read, and nothing
 * else. `CanSave` never saw it.
 *
 * So the sequence a rep actually hit was: type `0.5`, see the refusal, and watch the input keep showing
 * `0.5` while the entity still held `0.10`. Save stayed enabled. The quote went out at ten percent,
 * with a screen that had said so nowhere. A hundred-fold discount error is not a crash; it is a number
 * nobody questions.
 *
 * `LineAdvisories` deliberately produces warnings that never gate the save, and folding refusals in
 * there would have kept the bug. These are errors, and `MergeValidation` is what makes them count.
 */
export function DiscountRefusalIssues(
    refusals: readonly { RowIndex: number | null; Reason: string }[],
): DealWorkspaceIssue[] {
    return refusals.map((r) => ({
        Section: 'lines' as DealWorkspaceSection,
        Field: 'DiscountPct',
        RowIndex: r.RowIndex,
        Severity: 'error' as const,
        Message: r.Reason,
    }));
}

/**
 * A line that has not been given a product yet, as a blocking issue on its own row.
 *
 * ── WHY VALIDATION AND NOT REMOVING THE PICKER'S "not linked" OPTION ────────────────────────────
 *
 * Both were on the table and they answer different questions. Removing the option asserts that "not
 * linked" was never a legal state; validating asserts it is a state you can be in briefly and cannot
 * save. **The second one is true, and the code says so plainly:** `AddLine()` calls
 * `order.Lines.Create()` and sets `CompanyID` and nothing else — it never touches `ProductID`. So a
 * line is unlinked from the instant the rep clicks Add, before the picker has been opened at all.
 *
 * Removing the option therefore would not remove the state. It would only remove the ability to SEE
 * it: an Angular `<select>` whose model matches no option renders an implicit blank, so the rep would
 * get an empty dropdown with no label saying why, on a row that still cannot be saved. That is a worse
 * screen and the same defect.
 *
 * ── AND WHY IT IS AN ERROR RATHER THAN A WARNING ────────────────────────────────────────────────
 *
 * `OrderLine.ProductID` is `UNIQUEIDENTIFIER NOT NULL` with a real FK. The save does not merely
 * misbehave without it — the database refuses the whole statement, and the rep gets a constraint name.
 * That is the KI-20 shape: an ordinary gesture answered by raw SQL. Blocking here means the Save button
 * is disabled with the reason on the row, which is the same trade the refused-discount fix made one
 * function above.
 *
 * Note this is deliberately NOT a check on whether the product is still SELLABLE. A line quoted before
 * a product was withdrawn keeps a valid `ProductID` and must stay saveable; `ProductLabel()` marks it
 * "(no longer offered)" and that is a hint, not a block. The two rules look adjacent and are opposites:
 * one is about a value being absent, the other about a value being old.
 */
export function UnlinkedLineIssues(
    lines: readonly { ProductID?: string | null }[],
): DealWorkspaceIssue[] {
    const issues: DealWorkspaceIssue[] = [];
    lines.forEach((line, index) => {
        if (!line?.ProductID) {
            issues.push({
                Section: 'lines' as DealWorkspaceSection,
                Field: 'ProductID',
                RowIndex: index,
                Severity: 'error' as const,
                Message: 'Choose a product for this line. A line without one cannot be saved.',
            });
        }
    });
    return issues;
}


/**
 * Combines the entity's own verdict with warnings and with issues that must BLOCK the save.
 *
 * The component used to assemble this inline as `IsValid: entity.IsValid`, with a comment explaining
 * that advisories are warnings and therefore never change savability. True of advisories, and it is
 * exactly the line a blocking issue has to get past — so the combination now lives here, where the
 * three inputs are named and a gate can assert what happens to each.
 *
 * ORDER OF `Issues` IS NOT COSMETIC: blocking issues come before warnings, because `SaveBlockedReason`
 * shows the FIRST error it finds and a rep reading a disabled Save wants the reason that disabled it.
 */
export function MergeValidation(
    entity: DealWorkspaceValidation,
    warnings: readonly DealWorkspaceIssue[],
    blocking: readonly DealWorkspaceIssue[],
): DealWorkspaceValidation {
    return {
        IsValid: entity.IsValid && blocking.length === 0,
        Issues: [...entity.Issues, ...blocking, ...warnings],
    };
}
