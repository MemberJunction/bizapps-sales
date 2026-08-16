/**
 * Output shapes for the close family. Declared here rather than repeated per operation — see the
 * header of `sales-close-deal.input.ts` for why definition files may not import one another.
 */

/** Which pane of the deal workspace an issue belongs to. Matches the workspace's tab keys exactly. */
export type SalesCloseSection = 'deal' | 'party' | 'lines' | 'schedule' | 'terms' | 'variances';

export type SalesCloseSeverity = 'error' | 'warning';

/**
 * ONE ISSUE, STRUCTURED — never a joined string. `Section` is what lets a tab badge itself, `Field`
 * what lets a field mark itself. The same shape `Sales.SaveDeal` already returns, so a UI handles
 * both operations' refusals with one code path.
 */
export interface SalesCloseIssue {
    Section: SalesCloseSection;
    Field?: string | null;
    Severity: SalesCloseSeverity;
    Message: string;
}

/**
 * What the policy decided, per downstream target.
 *
 * RETURNED EVEN WHEN THE CALL WAS STUBBED, and `Executed` is what says which. Today both downstreams
 * are stubs (CLOSE-FLOW-DECISIONS.md D-CF3/D-CF4), so a close reports `Planned: true,
 * Executed: false` with a reason — the intent is auditable now and the flag flips to true when the
 * seam lands, with no shape change.
 */
export interface SalesCloseRoutingResult {
    /** `Contract` | `Order` | `Subscription`. */
    Target: string;
    /** The policy said this should happen. */
    Planned: boolean;
    /** It actually happened. False while the downstream is stubbed. */
    Executed: boolean;
    /** How many deal lines were routed here. */
    LineCount: number;
    /** The created record, when one was created. */
    RecordID?: string | null;
    /** Why it did not execute, when it did not. Shown verbatim. */
    Reason?: string | null;
}

export interface SalesCloseDealOutput {
    Success: boolean;
    /** Empty on a clean close. Warnings may be present even when Success is true. */
    Issues: SalesCloseIssue[];

    /** True when the target status carried `IsWon` — resolved from the FLAG, never a name. */
    IsWon: boolean;
    /** True when the target status carried `IsLost`. */
    IsLost: boolean;
    /** True when the deal is now immutable, i.e. the target status had `LocksDeal`. */
    Locked: boolean;

    /** The policy actually applied: pipeline default with the caller's overrides merged over it. */
    EffectivePolicy?: SalesCloseWonPolicy;
    /** One entry per downstream the policy named. */
    Routing: SalesCloseRoutingResult[];

    /** The append-only provenance row this close wrote. Absent on a preview. */
    DealStageEventID?: string | null;
    ClosedAt?: string | null;

    /** True when nothing was written because the caller asked for a preview. */
    WasPreview: boolean;
}

export interface SalesReopenDealOutput {
    Success: boolean;
    Issues: SalesCloseIssue[];
    /** The deal is editable again. */
    Unlocked: boolean;
    /** The append-only row recording the reopen and its reason. */
    DealStageEventID?: string | null;
}
