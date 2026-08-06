/**
 * @fileoverview Shapes the deal workspace binds to.
 *
 * Two conventions here are load-bearing rather than stylistic:
 *
 * 1. **The pane keys ARE the `DealDraftSection` keys.** `DealDraft.Validate()` tags every issue with a
 *    `Section`, and the tabs below key off the same strings, so one validation pass drives both the tab
 *    badges and the field markers with no mapping table in between. Rename a key here and you must
 *    rename it in `deal-draft.ts`; anything else silently stops badging.
 *
 * 2. **Lookups are plain `{ ID, Name }`.** The workspace never queries — the service loads reference
 *    data once and hands it in, mirroring how bizapps-contracts keeps its workspace presentational.
 *    That is what makes the surface cheap to render repeatedly and testable without a provider.
 *
 * @module @mj-biz-apps/sales-ng
 */
import type { DealDraftSection } from '@mj-biz-apps/sales-entities';

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
}

/** A line type plus the one flag anything downstream actually branches on. */
export interface LineTypeLookup extends DealLookup {
    IsRecurring: boolean;
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
}

/** Everything the surface needs to render its pickers. Loaded once per session. */
export interface DealWorkspaceLookups {
    Pipelines: PipelineLookup[];
    Stages: StageLookup[];
    DealTypes: DealLookup[];
    DealStatusTypes: DealStatusLookup[];
    ForecastCategoryTypes: DealLookup[];
    LineTypes: LineTypeLookup[];
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
        ForecastCategoryTypes: [],
        LineTypes: [],
        Accounts: [],
        Contacts: [],
        Employees: [],
    };
}

/** One pane of the workspace. `Key` matches a `DealDraftSection` exactly — see the file header. */
export interface DealWorkspacePane {
    Key: DealDraftSection;
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
