/**
 * @fileoverview Shapes the deal workspace binds to.
 *
 * Two conventions here are load-bearing rather than stylistic:
 *
 * 1. **The pane keys ARE the `DealWorkspaceSection` keys.** `ProjectValidation()` tags every issue with a
 *    `Section`, and the tabs below key off the same strings, so one validation pass drives both the tab
 *    badges and the field markers with no mapping table in between. Rename a key here and you must
 *    rename it in `deal-workspace.validation.ts`; anything else silently stops badging.
 *
 * 2. **Lookups are plain `{ ID, Name }`.** The workspace never queries — the service loads reference
 *    data once and hands it in, mirroring how bizapps-contracts keeps its workspace presentational.
 *    That is what makes the surface cheap to render repeatedly and testable without a provider.
 *
 * @module @mj-biz-apps/sales-ng
 */
import type { DealWorkspaceSection } from './deal-workspace.validation';

/** The minimum a picker needs. Anything richer belongs in a dedicated shape below. */
export interface DealLookup {
    ID: string;
    Name: string;
}

/** A pipeline carries its company, because `Deal.CompanyID` is derived from it and never chosen. */
export interface PipelineLookup extends DealLookup {
    CompanyID: string;
    CompanyName: string | null;
}

/** Stages are filtered by pipeline, so the pipeline has to travel with them. */
export interface StageLookup extends DealLookup {
    PipelineID: string;
    DisplayOrder: number;
    Probability: number | null;
    ForecastCategoryTypeID: string | null;
    /**
     * The status this stage lands a deal in. Stages carry NO IsWon/IsClosed of their own -- they point at
     * a `DealStatusType` that does, which is what makes "Closed Won" a label a pipeline may rename.
     * Needed by any surface that must know whether arriving here would LOCK the deal.
     */
    DealStatusTypeID: string | null;
}


/**
 * A deal status plus its BEHAVIOUR FLAGS.
 *
 * The flags are here because the dashboard has to answer "how many are open" and "how many did we win",
 * and the only permitted way to do that is to read `IsOpen` / `IsWon` off this row. Comparing a status
 * NAME is exactly what `npm run test:vocabulary-gate` exists to catch, and it is also just wrong: a
 * deployment can rename "Won" to "Signed" and every name-based count silently reports zero.
 */
export interface DealStatusLookup extends DealLookup {
    IsOpen: boolean;
    IsClosed: boolean;
    IsWon: boolean;
    IsLost: boolean;
    /** Entering this status freezes the deal, its lines and its team. Enforced server-side. */
    LocksDeal: boolean;
}

/**
 * A loss reason plus the flag that decides whether notes are mandatory.
 *
 * `RequiresNotes` is read as a FLAG for the same reason every other behaviour here is: a deployment
 * renames its reasons freely, and "Price" meaning "explain yourself" is a property of the row, not of
 * the word. The close panel makes LossNotes required from this, and the server enforces the same rule.
 */
export interface LossReasonLookup extends DealLookup {
    RequiresNotes: boolean;
}

/** Everything the surface needs to render its pickers. Loaded once per session. */
export interface DealWorkspaceLookups {
    Pipelines: PipelineLookup[];
    Stages: StageLookup[];
    DealTypes: DealLookup[];
    DealStatusTypes: DealStatusLookup[];
    LossReasons: LossReasonLookup[];
    ForecastCategoryTypes: DealLookup[];
    Accounts: DealLookup[];
    Contacts: DealLookup[];
    Employees: DealLookup[];
}

export function EmptyLookups(): DealWorkspaceLookups {
    return {
        Pipelines: [],
        Stages: [],
        DealTypes: [],
        DealStatusTypes: [],
        LossReasons: [],
        ForecastCategoryTypes: [],
        Accounts: [],
        Contacts: [],
        Employees: [],
    };
}

/** One pane of the workspace. `Key` matches a `DealWorkspaceSection` exactly — see the file header. */
export interface DealWorkspacePane {
    Key: DealWorkspaceSection;
    Label: string;
    Icon: string;
}

/**
 * The panes, in reading order: who the deal is with, what is being sold, how it gets paid, on what
 * terms, and what was negotiated away.
 */
export const DEAL_WORKSPACE_PANES: readonly DealWorkspacePane[] = [
    { Key: 'party', Label: 'Party info', Icon: 'fa-solid fa-handshake' },
    { Key: 'lines', Label: 'Product lines', Icon: 'fa-solid fa-list' },
    { Key: 'schedule', Label: 'Payment schedule', Icon: 'fa-solid fa-calendar-days' },
    { Key: 'terms', Label: 'Terms', Icon: 'fa-solid fa-file-contract' },
    { Key: 'variances', Label: 'Variances', Icon: 'fa-solid fa-pen-nib' },
] as const;

/**
 * The standard terms, shown as PLACEHOLDER text and never written into a draft.
 *
 * These live on the contracts `ContractType`, not on a deal. A deal stores an OVERRIDE, and null means
 * "use the standard" — a different fact from "we agreed a number that happens to equal today's
 * standard", and the only one of the two that survives a later policy change. So the form displays
 * them to tell the AD what they are departing from, and sends null unless something was typed.
 */
export const STANDARD_ANNUAL_INCREASE_PCT = 5;
export const STANDARD_CANCELLATION_NOTICE_DAYS = 90;
