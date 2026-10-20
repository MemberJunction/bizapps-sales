/**
 * @fileoverview Data access for the Sales section, the board and the deal line editor: the lookup
 * lists, the roster, a deal load and save, the product catalogue, the fiscal year start and the
 * dashboard figures.
 *
 * Named for the deal workspace, the surface it was written for. That component is deleted (#291); the
 * section, the board and the line editor kept the reads and the save they share with it.
 *
 * A deal's related-record collections save with it: saving is `deal.Save()`. The two places that need
 * care are both here: LOADING the collections exactly once ({@link DealWorkspaceService.LoadDeal}) and
 * forcing a full write-out on save ({@link DealWorkspaceService.Save}).
 *
 * @module @mj-biz-apps/sales-ng
 */
import { Injectable } from '@angular/core';
import { EntitySaveOptions, LogError, LogStatus, Metadata, RunQuery, RunView, RunViewParams, type RunViewResult } from '@memberjunction/core';
import { DealEntity } from '@mj-biz-apps/sales-entities';

import { OrderPipelinesByCompany } from '../data/company-pipelines';
import { AssertRosterColumns } from './deal-roster.columns';

import {
    EmptyLookups,
    type DealLookup,
    type DealStatusLookup,
    type LossReasonLookup,
    type DealWorkspaceLookups,
    type PipelineLookup,
    type StageLookup,
} from './deal-workspace.types';
import {
    EmptyValidation,
    ProjectValidation,
    type DealWorkspaceValidation,
} from './deal-workspace.validation';
import { BusinessTimeZoneEngine, CalendarDayIn, type CalendarDay } from '@mj-biz-apps/common-entities';
import { E_ORDERS_PRODUCT, PRODUCT_LOOKUP_FIELDS, ProductFilterFor, type ProductLookup } from '@mj-biz-apps/sales-entities';
import {
    CALENDAR_YEAR_START,
    PeriodParameters,
    ResolveFiscalYearStart,
    type FiscalYearStart,
    type FiscalYearStartResolution,
    type PeriodWindow,
} from '../pages/dashboard-period';
import { CleanIDs, FilterParameters, NO_FILTERS, type DashboardFilters } from '../pages/dashboard-filters';

/**
 * A query's parameters: the period's bounds, the filter bar's lists and anything the caller adds, or
 * undefined when there are none. An unbounded edge and an "All" list are left out, never sent empty.
 */
function queryParameters(
    window: PeriodWindow | undefined,
    filters: DashboardFilters,
    extra: Record<string, string> = {},
): Record<string, string | string[]> | undefined {
    const parameters: Record<string, string | string[]> = { ...(PeriodParameters(window) ?? {}), ...FilterParameters(filters), ...extra };
    return Object.keys(parameters).length ? parameters : undefined;
}

const E_PIPELINE = 'MJ_BizApps_Sales: Pipelines';
const E_STAGE = 'MJ_BizApps_Sales: Pipeline Stages';
const E_DEAL_TYPE = 'MJ_BizApps_Sales: Deal Types';
const E_STATUS_TYPE = 'MJ_BizApps_Sales: Deal Status Types';
const E_FORECAST_TYPE = 'MJ_BizApps_Sales: Forecast Category Types';
const E_ACCOUNT = 'MJ_BizApps_Sales: Sales Accounts';
const E_CONTACT = 'MJ_BizApps_Sales: Sales Contacts';
const E_EMPLOYEE = 'MJ: Employees';
const E_COMPANY = 'MJ: Companies';
const E_DEAL = 'MJ_BizApps_Sales: Deals';
const E_LOSS_REASON = 'MJ_BizApps_Sales: Loss Reasons';
const E_STAGE_EVENT = 'MJ_BizApps_Sales: Deal Stage Events';

/**
 * Accounting's per-company profile — where the FISCAL YEAR START lives.
 *
 * Another app's entity, read and never written, for the same reason `E_ORDERS_PRODUCT` is: the fact
 * belongs to that app and duplicating it here would give one fact two homes. `mj-app.json` already
 * declares `mj-bizapps-accounting` as a dependency, so this is not a new coupling — and the read is
 * still guarded on metadata, because sales is built to run standalone.
 */
const E_ACCOUNTING_COMPANY_PROFILE = 'MJ_BizApps_Accounting: Accounting Company Profiles';

/**
 * Accounting's currencies, read for their three-letter codes. `Deal.CurrencyID` is a soft reference to
 * this entity, so the roster carries an ID that only accounting can turn into "USD". Read, never
 * written, and guarded on metadata like the profile above.
 */
const E_ACCOUNTING_CURRENCY = 'MJ_BizApps_Accounting: Currencies';

/**
 * What a figure is LABELLED as when no deal states a currency, or names one this host cannot resolve.
 *
 * A display default, not a fact about the money. It is here as one named constant rather than three
 * hardcoded 'USD' literals so that the assumption is stated once, in a place a reader meets it.
 */
export const DEFAULT_DISPLAY_CURRENCY = 'USD';

/**
 * The currency code a roster row is shown in: the code `currencyID` names in `codes`, or the display
 * default when the deal has none or names one this host cannot resolve (accounting not installed, or
 * not readable by this user). `codes` is keyed by upper-cased ID, since SQL Server returns GUIDs upper
 * case and the browser may hold either.
 */
export function CurrencyCodeFor(currencyID: string | null, codes: ReadonlyMap<string, string>): string {
    return (currencyID && codes.get(currencyID.toUpperCase())) || DEFAULT_DISPLAY_CURRENCY;
}

/**
 * One read of accounting's currency codes, keyed by upper-cased ID: empty when accounting is not
 * installed, null when the read failed (so a caller can decline to cache it). Never throws.
 *
 * A module function so the deal form, whose panels are built without an injection context, reads
 * codes the same way the roster does. Callers cache; see `DealWorkspaceService.LoadCurrencyCodes`
 * and `form-panels/deal-money.ts`.
 */
export async function ReadCurrencyCodes(): Promise<Map<string, string> | null> {
    // Everything inside the try, the metadata check included: a label lookup must never take the
    // roster down with it.
    try {
        if (!new Metadata().Entities.some((e) => e.Name === E_ACCOUNTING_CURRENCY)) {
            return new Map();
        }
        const result = await new RunView().RunView<{ ID: string; Code: string }>({
            EntityName: E_ACCOUNTING_CURRENCY,
            ResultType: 'simple',
            Fields: ['ID', 'Code'],
        });
        if (result?.Success) {
            return new Map((result.Results ?? []).map((c) => [String(c.ID).toUpperCase(), String(c.Code).trim()]));
        }
        // At status, not error: a rep without accounting permissions is an ordinary deployment.
        // See LoadFiscalYearStart.
        LogStatus(`${E_ACCOUNTING_CURRENCY} read failed, showing ${DEFAULT_DISPLAY_CURRENCY} - ${result?.ErrorMessage ?? 'unknown error'}`);
    } catch (e) {
        LogStatus(`${E_ACCOUNTING_CURRENCY} read threw, showing ${DEFAULT_DISPLAY_CURRENCY} - ${e instanceof Error ? e.message : String(e)}`);
    }
    return null;
}

/**
 * One row of the deal roster.
 *
 * `CustomerName` is resolved by this service, not read off the deal: `AccountID` points at an IsA child
 * whose `Name` lives on the parent, and CodeGen generates no lookup join across that edge (KI-8). So the
 * roster reads accounts once and joins in memory — which is also why this lives here rather than in the
 * component, so the workaround exists in exactly one place.
 */
/**
 * The four dashboard headline figures, already reduced.
 *
 * Returned by the `Sales: Dashboard Summary` query rather than computed in the browser. Master plan
 * §9.5 requires read models to be MJ Queries so Skip, the query builder and report snapshots can all
 * reach them; a measure that only exists inside a component getter is reachable by nothing else.
 */
export interface DealDashboardSummary {
    /** Open pipeline deals expected to close in the period, summed. The Open pipeline tile. */
    OpenAmount: number;
    /** Open deals expected to close in the period, Omitted ones included. */
    OpenCount: number;
    /** Open deals in a forecast category left out of the pipeline (Omitted); counted in `OpenCount` only. */
    OpenOmittedCount: number;
    /** The forecast's open segments: each open pipeline deal in the period once, in its highest category. */
    CommitAmount: number;
    CommitCount: number;
    BestCaseOnlyAmount: number;
    PipelineOnlyAmount: number;
    /** Amount × Probability over the Open pipeline deals. The Weighted pipeline tile. */
    WeightedAmount: number;
    TotalCount: number;
    /** Needs attention: about the open book today, not bounded by the period. */
    PastExpectedCloseCount: number;
    NoOwnerCount: number;
    NoCloseDateCount: number;
    WonCount: number;
    /** The amounts of the deals `WonCount` counts: the forecast's Won segment. */
    WonAmount: number;
    /** Deals in scope whose order carries no line: what a Product company filter leaves out. */
    NoLinesDealCount: number;
    /** How much of the open figure the orders engine priced, and how much a person typed. */
    OpenPricedAmount: number;
    OpenStatedAmount: number;
    OpenNoAmountCount: number;
}

export interface DealRosterRow {
    ID: string;
    DealNumber: string | null;
    Name: string;
    AccountID: string | null;
    CustomerName: string;
    Amount: number | null;
    AmountIsComputed: boolean;
    Probability: number | null;
    ExpectedCloseDate: string | Date | null;
    /**
     * When the deal actually closed. NULL on every open deal, and on a closed one that never recorded
     * it.
     *
     * Carried so the client-side Won predicate (`WonInPeriod`) can bound a win by the day it LANDED
     * rather than the day it was expected to. The Won figures themselves come from the summary query.
     */
    ActualCloseDate: string | Date | null;
    /** Virtual name columns that DO resolve on the Deal view. */
    Pipeline: string | null;
    PipelineStage: string | null;
    DealType: string | null;
    DealStatusType: string | null;
    OwnerEmployee: string | null;
    /** The owner's employee ID: what the Deal owner filter and the Commit by deal owner rows key on. */
    OwnerEmployeeID: string | null;
    /** The selling company, `Deal.CompanyID`. */
    CompanyID: string | null;
    /** The distinct companies on the deal's order lines; empty for a deal with no lines. */
    ProductCompanyIDs: string[];
    ForecastCategoryType: string | null;
    /** Kept so anything downstream can branch on the STATUS FLAGS rather than the status name. */
    DealStatusTypeID: string | null;
    /** Grouping keys for the board. Names render; IDs group. */
    PipelineID: string | null;
    PipelineStageID: string | null;
    /**
     * `Pipeline.IncludeInForecast`. False for a pipeline that only holds historical deals: its open
     * deals still render on the board but are left out of every current-book figure on the dashboard.
     * See `InForecast`.
     */
    PipelineIncludeInForecast: boolean;
    /**
     * STATUS FLAGS, APPLIED SERVER-SIDE, so no consumer has to resolve them from a second fetch.
     *
     * `Sales: Deal Roster` returns these per row. Before, the section loaded every DealStatusType
     * separately and looked each row's status up by ID to read a flag -- correct, but it made every
     * consumer of a roster row responsible for carrying a lookup table alongside it.
     */
    IsOpen: boolean;
    IsWon: boolean;
    IsLost: boolean;
    IsClosed: boolean;
    /** Open, and its expected close date has gone by. Computed against the SERVER's UTC date. */
    IsPastExpectedClose: boolean;
    /**
     * ForecastCategoryType flags from `Sales: Deal Roster`. The dashboard slices the stacked bar
     * from these — never from the category NAME.
     */
    IncludeInCommit: boolean;
    IncludeInBestCase: boolean;
    /**
     * `ForecastCategoryType.IncludeInPipeline`; true when the deal has no category. False (Omitted)
     * leaves an open deal out of the dashboard's pipeline money figures, as the forecast queries do.
     */
    IncludeInPipeline: boolean;
    /** Amount × Probability / 100, computed in the roster query. Display only — not a price. */
    WeightedAmount: number | null;
    /** PipelineStage.DisplayOrder, for the funnel. */
    StageOrder: number | null;
    /** The currency record `Amount` is denominated in; a soft reference to accounting's Currency. */
    CurrencyID: string | null;
    /**
     * `CurrencyID` as a three-letter code ("USD"), for display. Deals created before currencies were
     * stamped carry no ID and read as the display default. A consumer must not total a set containing
     * more than one distinct code; the board refuses to.
     */
    CurrencyCode: string;
}

/** Raw roster shape before the account name is joined in. */
interface DealRosterQueryRow {
    ID: string; DealNumber: string | null; Name: string; AccountID: string | null;
    Amount: number | null; AmountIsComputed: boolean; Probability: number | null;
    ExpectedCloseDate: string | Date | null; Pipeline: string | null; PipelineStage: string | null;
    DealType: string | null; DealStatusType: string | null; OwnerEmployee: string | null;
    ForecastCategoryType: string | null; DealStatusTypeID: string | null;
    PipelineID: string | null; PipelineStageID: string | null;
}

/** What a save attempt reports back. Structured, so the caller can badge tabs and mark fields. */
export interface DealSaveOutcome {
    Success: boolean;
    DealID: string | null;
    Created: boolean;
    /** Pane-addressed problems, when the record was refused for being invalid. Never a joined string. */
    Validation: DealWorkspaceValidation;
    /** Set only when the save itself failed (transport, a database error) rather than being invalid. */
    ErrorMessage: string | null;
}

/** Row shapes as they come back from RunView with `ResultType: 'simple'`. */
interface PipelineRow { ID: string; Name: string; Code: string; CompanyID: string; Company: string | null; IsDefault: boolean; DisplayRank: number }
interface StageRow { ID: string; Name: string; PipelineID: string; DisplayOrder: number; Probability: number | null; ForecastCategoryTypeID: string | null; DealStatusTypeID: string | null; RottingDays: number | null }
interface NamedRow { ID: string; Name: string }
/** A stage event, as {@link DealWorkspaceService.LoadStageEntries} reads it. */
export interface StageEventRow { DealID: string; ToStageID: string | null; ChangedAt: string | Date }
/** An open deal, as {@link DealWorkspaceService.LoadStageEntries} reads it. */
export interface StageDealRow { ID: string; PipelineStageID: string | null; __mj_CreatedAt: string | Date }

const sameID = (a: string | null | undefined, b: string | null | undefined): boolean =>
    !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * The day each deal entered its current stage, keyed by lower-cased deal ID. `events` are newest
 * first. See {@link DealWorkspaceService.LoadStageEntries} for the rule.
 */
export function StageEntryDays(events: readonly StageEventRow[], deals: readonly StageDealRow[]): Map<string, string> {
    const newest = new Map<string, StageEventRow>();
    for (const e of events) {
        const key = e.DealID.toLowerCase();
        if (!newest.has(key)) {
            newest.set(key, e);
        }
    }
    const days = new Map<string, string>();
    for (const d of deals) {
        const key = d.ID.toLowerCase();
        const event = newest.get(key);
        if (!event) {
            days.set(key, instantDay(d.__mj_CreatedAt));
        } else if (sameID(event.ToStageID, d.PipelineStageID)) {
            days.set(key, instantDay(event.ChangedAt));
        }
    }
    return days;
}

/**
 * Whether a successful read returned fewer rows than matched its filter. A row cap reports success
 * and returns the first N, so `Success` alone cannot tell a short read from a complete one.
 */
export function IsTruncatedRead(result: { Results?: readonly unknown[] | null; TotalRowCount?: number | null }): boolean {
    return result.TotalRowCount != null && (result.Results?.length ?? 0) < result.TotalRowCount;
}

/**
 * The business day an instant fell on, `YYYY-MM-DD`. A stage change is a moment, so a zone decides
 * its day, the same one that decides what day it is now.
 */
function instantDay(value: string | Date): string {
    return CalendarDayIn(value instanceof Date ? value : new Date(value), BusinessTimeZoneEngine.Instance.Zone);
}
interface StatusRow extends NamedRow { IsOpen: boolean; IsClosed: boolean; IsWon: boolean; IsLost: boolean; LocksDeal: boolean }
interface LossReasonRow extends NamedRow { RequiresNotes: boolean }
export interface ContactRow {
    ID: string;
    FirstName: string | null;
    LastName: string | null;
    Email: string | null;
    DisplayNameAndEmail: string | null;
}

/**
 * A contact's label in the `Contacts` lookup list: "Name (email)", the same text the deal form's
 * contact picker shows (#254). A native select can only jump to an option by its first letters, so
 * the email cannot be searched here, but it tells two people with the same name apart.
 *
 * `DisplayNameAndEmail` comes from vwSalesContacts. The fallbacks cover a row without it.
 */
export function ContactOptionLabel(c: ContactRow): string {
    return (
        c.DisplayNameAndEmail?.trim() ||
        [c.FirstName, c.LastName].filter(Boolean).join(' ').trim() ||
        c.Email ||
        '(unnamed contact)'
    );
}
interface EmployeeRow { ID: string; FirstLast: string | null }

/** One named lookup list. */
export type LookupKey = keyof DealWorkspaceLookups;

/** How one lookup list is read, and where its rows land. */
interface LookupRead {
    Params: RunViewParams;
    Apply: (rows: unknown[], into: DealWorkspaceLookups) => void;
}

/** Typed constructor for a {@link LookupRead}: rows of `T` mapped and assigned. */
function lookupRead<T>(params: RunViewParams, apply: (rows: T[], into: DealWorkspaceLookups) => void): LookupRead {
    return { Params: params, Apply: (rows, into) => apply(rows as T[], into) };
}

/**
 * Every lookup list, keyed by the field it fills.
 *
 * A `Record` over {@link LookupKey}, so a field added to `DealWorkspaceLookups` without a read here does
 * not compile. Callers ask for lists by name, and the params and the results are built from the same
 * key array, so a position cannot drift between them.
 */
const LOOKUP_READS: Record<LookupKey, LookupRead> = {
    Pipelines: lookupRead<PipelineRow>(
        { EntityName: E_PIPELINE, ExtraFilter: 'IsActive = 1', OrderBy: 'DisplayRank ASC, Name ASC', ResultType: 'simple', Fields: ['ID', 'Name', 'Code', 'CompanyID', 'Company', 'IsDefault', 'DisplayRank'] },
        (rows, into) => {
            // Grouped by company, default company first (#327): the same order the form and the board use.
            into.Pipelines = OrderPipelinesByCompany(rows.map<PipelineLookup>((p) => ({
                ID: p.ID,
                Name: p.Name,
                Code: p.Code ?? '',
                CompanyID: p.CompanyID,
                CompanyName: p.Company ?? null,
                IsDefault: !!p.IsDefault,
                DisplayRank: Number(p.DisplayRank ?? 0),
            })));
        },
    ),
    Stages: lookupRead<StageRow>(
        { EntityName: E_STAGE, ExtraFilter: 'IsActive = 1', OrderBy: 'DisplayOrder ASC', ResultType: 'simple', Fields: ['ID', 'Name', 'PipelineID', 'DisplayOrder', 'Probability', 'ForecastCategoryTypeID', 'DealStatusTypeID', 'RottingDays'] },
        (rows, into) => {
            into.Stages = rows.map<StageLookup>((s) => ({
                ID: s.ID, Name: s.Name, PipelineID: s.PipelineID, DisplayOrder: s.DisplayOrder,
                Probability: s.Probability, ForecastCategoryTypeID: s.ForecastCategoryTypeID,
                DealStatusTypeID: s.DealStatusTypeID ?? null,
                RottingDays: s.RottingDays == null ? null : Number(s.RottingDays),
            }));
        },
    ),
    DealTypes: lookupRead<NamedRow>(
        { EntityName: E_DEAL_TYPE, ExtraFilter: 'IsActive = 1', OrderBy: 'DisplayRank ASC', ResultType: 'simple', Fields: ['ID', 'Name'] },
        (rows, into) => {
            into.DealTypes = rows.map<DealLookup>((r) => ({ ID: r.ID, Name: r.Name }));
        },
    ),
    // The FLAGS come back with the status, because the dashboard counts open/won deals and the
    // only permitted way to decide either is to read the flag. Comparing a status name is what
    // the vocabulary gate forbids, and it also breaks the moment somebody renames "Won".
    DealStatusTypes: lookupRead<StatusRow>(
        { EntityName: E_STATUS_TYPE, ExtraFilter: 'IsActive = 1', OrderBy: 'DisplayRank ASC', ResultType: 'simple', Fields: ['ID', 'Name', 'IsOpen', 'IsClosed', 'IsWon', 'IsLost', 'LocksDeal'] },
        (rows, into) => {
            into.DealStatusTypes = rows.map<DealStatusLookup>((r) => ({
                ID: r.ID,
                Name: r.Name,
                IsOpen: r.IsOpen === true,
                IsClosed: r.IsClosed === true,
                IsWon: r.IsWon === true,
                IsLost: r.IsLost === true,
                LocksDeal: r.LocksDeal === true,
            }));
        },
    ),
    ForecastCategoryTypes: lookupRead<NamedRow>(
        { EntityName: E_FORECAST_TYPE, ExtraFilter: 'IsActive = 1', OrderBy: 'DisplayRank ASC', ResultType: 'simple', Fields: ['ID', 'Name'] },
        (rows, into) => {
            into.ForecastCategoryTypes = rows.map<DealLookup>((r) => ({ ID: r.ID, Name: r.Name }));
        },
    ),
    // KI-8: a Deal row cannot resolve its own account or contact name, because both FKs point at
    // IsA CHILDREN whose Name lives on the parent and CodeGen generates no lookup join through
    // that edge. So they are loaded here and resolved client-side. This is the reason the
    // customer-context header exists as a lookup rather than a field on the deal.
    // Filtered on the inherited Organization Status, the one the account form shows; the form hides
    // SalesAccount.IsActive.
    Accounts: lookupRead<NamedRow>(
        { EntityName: E_ACCOUNT, ExtraFilter: "Status = 'Active'", OrderBy: 'Name ASC', ResultType: 'simple', Fields: ['ID', 'Name'] },
        (rows, into) => {
            into.Accounts = rows.map<DealLookup>((r) => ({ ID: r.ID, Name: r.Name }));
        },
    ),
    Contacts: lookupRead<ContactRow>(
        {
            EntityName: E_CONTACT,
            OrderBy: 'LastName ASC',
            ResultType: 'simple',
            Fields: ['ID', 'FirstName', 'LastName', 'Email', 'DisplayNameAndEmail'],
        },
        (rows, into) => {
            into.Contacts = rows.map<DealLookup>((c) => ({ ID: c.ID, Name: ContactOptionLabel(c) }));
        },
    ),
    Employees: lookupRead<EmployeeRow>(
        { EntityName: E_EMPLOYEE, ExtraFilter: 'Active = 1', OrderBy: 'LastName ASC', ResultType: 'simple', Fields: ['ID', 'FirstLast'] },
        (rows, into) => {
            into.Employees = rows.map<DealLookup>((e) => ({ ID: e.ID, Name: e.FirstLast ?? '(unnamed employee)' }));
        },
    ),
    Companies: lookupRead<NamedRow>(
        { EntityName: E_COMPANY, OrderBy: 'Name ASC', ResultType: 'simple', Fields: ['ID', 'Name'] },
        (rows, into) => {
            into.Companies = rows.map<DealLookup>((r) => ({ ID: r.ID, Name: r.Name }));
        },
    ),
    // Loss reasons, for the close panel. `RequiresNotes` travels with them because the panel decides
    // whether LossNotes is mandatory from the FLAG on the chosen row. The close panel cannot demand a
    // reason it has no list to offer, and an empty dropdown fails as a TIMEOUT rather than as a
    // missing list, which is a slow way to find out.
    LossReasons: lookupRead<LossReasonRow>(
        { EntityName: E_LOSS_REASON, ExtraFilter: 'IsActive = 1', OrderBy: 'DisplayRank ASC, Name ASC', ResultType: 'simple', Fields: ['ID', 'Name', 'RequiresNotes'] },
        (rows, into) => {
            into.LossReasons = rows.map<LossReasonLookup>((r) => ({ ID: r.ID, Name: r.Name, RequiresNotes: r.RequiresNotes === true }));
        },
    ),
};

/**
 * Every lookup list: what `LoadLookups` reads when no keys are passed. Companies is the dashboard
 * filter bar's alone: a deal takes its company from its pipeline, so a deal load does not read it.
 */
export const ALL_LOOKUP_KEYS = (Object.keys(LOOKUP_READS) as LookupKey[]).filter((key) => key !== 'Companies');

/**
 * The lists the Sales section reads: the board's columns, the status pill, and the company names the
 * dashboard's filter bar labels its choices with. Accounts, contacts, employees and loss reasons were the
 * deal workspace's pickers, and accounts and contacts grow with the customer base, so the section does
 * not load them.
 */
export const SECTION_LOOKUP_KEYS: readonly LookupKey[] = ['Pipelines', 'Stages', 'DealStatusTypes', 'Companies'];
/**
 * The collections a deal load reads, named once.
 *
 * Passed to `LoadRelatedRecords` so the load is EXPLICIT about what it wants rather than taking
 * "everything declared". A collection added to the entity later should not start being fetched by a
 * surface that does not render it.
 */
// 'Lines' is NOT here: the deal holds none. Its order's lines arrive with the embedded order.
const DEAL_COLLECTIONS = ['PaymentSchedule', 'Team'] as const;

@Injectable({ providedIn: 'root' })
export class DealWorkspaceService {
    /**
     * The named lookup lists, in one `RunViews` batch. Defaults to every list;
     * the Sales section passes {@link SECTION_LOOKUP_KEYS}. Lists not asked for stay empty.
     */
    public async LoadLookups(keys: readonly LookupKey[] = ALL_LOOKUP_KEYS): Promise<DealWorkspaceLookups> {
        const results = await new RunView().RunViews(keys.map((key) => LOOKUP_READS[key].Params));
        if (results && results.length !== keys.length) {
            // Each list below already degrades on its own, so this is not fatal -- but a mismatch means
            // results cannot be matched to the lists asked for. Say so rather than let it be discovered
            // as an empty dropdown.
            LogError(`DealWorkspaceService.LoadLookups: ${results.length} result(s) for ${keys.length} named lookups.`);
        }
        const lookups = EmptyLookups();
        // RunViews does not throw; an unsuccessful view yields an empty list rather than an exception,
        // so each list checks Success independently. A missing picker degrades that one control
        // instead of blanking the whole surface.
        keys.forEach((key, index) => {
            const r = results?.[index];
            LOOKUP_READS[key].Apply(r?.Success ? (r.Results ?? []) : [], lookups);
        });
        return lookups;
    }

    /**
     * The day each OPEN deal entered its current stage, by deal ID (bizapps-sales#450). The Board flags
     * a card that has sat in its stage past the stage's `RottingDays`.
     *
     * One `RunViews` batch: the stage events of open deals, newest first, and the open deals' creation
     * times. A deal's day is its newest event INTO its current stage; a deal with no event has been in
     * its stage since it was created (a new deal's first stage records no event). A deal whose newest
     * event names a different stage is left out rather than guessed.
     *
     * "Open" is the status's `IsOpen` FLAG. Throws when either read fails or comes back short, so the caller can say the
     * flags are unavailable instead of showing none.
     */
    public async LoadStageEntries(): Promise<Map<string, string>> {
        const md = new Metadata();
        const deal = md.Entities.find((e) => e.Name === E_DEAL);
        const status = md.Entities.find((e) => e.Name === E_STATUS_TYPE);
        if (!deal || !status) {
            return new Map();
        }
        const openDeals = `SELECT ID FROM [${deal.SchemaName}].[${deal.BaseView}] WHERE DealStatusTypeID IN `
            + `(SELECT ID FROM [${status.SchemaName}].[${status.BaseView}] WHERE IsOpen = 1)`;
        // IgnoreMaxRows: both entities carry a UserViewMaxRows cap, and a capped event read drops a
        // deal's newest event, so the deal would date from its creation and be flagged as long idle.
        const [events, deals] = await new RunView().RunViews([
            { EntityName: E_STAGE_EVENT, ExtraFilter: `DealID IN (${openDeals})`, OrderBy: 'ChangedAt DESC', ResultType: 'simple', Fields: ['DealID', 'ToStageID', 'ChangedAt'], IgnoreMaxRows: true },
            { EntityName: E_DEAL, ExtraFilter: `ID IN (${openDeals})`, ResultType: 'simple', Fields: ['ID', 'PipelineStageID', '__mj_CreatedAt'], IgnoreMaxRows: true },
        ]);
        if (!events?.Success || !deals?.Success) {
            throw new Error(events?.ErrorMessage || deals?.ErrorMessage || 'The deals\' stage history could not be read.');
        }
        // A read that still came back short is unknown history, not old history: flag nothing.
        if (IsTruncatedRead(events) || IsTruncatedRead(deals)) {
            throw new Error('The deals\' stage history came back incomplete.');
        }
        return StageEntryDays(
            (events.Results ?? []) as StageEventRow[],
            (deals.Results ?? []) as StageDealRow[],
        );
    }

    /**
     * The deal roster, from the `Sales: Deal Roster` MJ Query.
     *
     * -- WHAT THIS REPLACED, AND WHY IT IS NOT JUST A RELOCATION --
     *
     * It was two RunViews: every deal, plus every account, joined in the browser with a Map to fill
     * in a customer name. The query does that join in SQL, so the second read and the client-side
     * join both go away -- and with them a whole class of drift, because the roster the dashboard
     * shows and the roster the §9 aggregates are built on are now literally the same definition.
     *
     * It also carries the STATUS FLAGS and IsPastExpectedClose per row, which is what lets the section
     * drop its separate status fetch for flag resolution and its hand-built UTC date comparison.
     *
     * Master plan §9.5 is the rule this satisfies: read models are MJ Queries, so Skip, the query
     * builder and report snapshots reach the same definitions the UI does.
     *
     * COLUMN NAMES ARE MAPPED, NOT PASSED THROUGH. The query names things for a report reader
     * (DealName, AccountName, StageName); DealRosterRow names them for a component (Name,
     * CustomerName, PipelineStage). Mapping here keeps both audiences served and means renaming a
     * column on either side is a one-file change.
     *
     * `closedSince` drops closed deals that closed before it, and `closedUntil` those that closed after
     * it; open deals always come back (bizapps-sales#209, bc-aidp-next-golive#351). Omitted, every deal
     * comes back. `filters` narrows the rows by the section's filter bar in the query itself
     * (bc-aidp-next-golive#350).
     *
     * THROWS WHEN THE QUERY FAILS, rather than returning an empty roster. An empty roster reads as a
     * database with no deals. The likeliest failure once `closedSince` is passed is a host whose query
     * definition predates the parameter, which MJ refuses as an unknown parameter; the section shows the
     * reason instead of an empty dashboard.
     */
    public async LoadRoster(
        closedSince?: string | null,
        filters: DashboardFilters = NO_FILTERS,
        closedUntil: string | null = null,
    ): Promise<DealRosterRow[]> {
        const extra: Record<string, string> = {};
        if (closedSince) extra['ClosedSince'] = closedSince;
        if (closedUntil) extra['ClosedUntil'] = closedUntil;
        const parameters = queryParameters(undefined, filters, extra);
        const [result, codes] = await Promise.all([
            new RunQuery().RunQuery({
                QueryName: 'Sales: Deal Roster',
                CategoryPath: 'Sales',
                ...(parameters ? { Parameters: parameters } : {}),
            }),
            this.LoadCurrencyCodes(),
        ]);
        if (!result?.Success) {
            throw new Error(`Sales: Deal Roster failed - ${result?.ErrorMessage ?? 'unknown error'}`);
        }
        const rows = (result.Results ?? []) as Record<string, unknown>[];
        // Throws on a query definition older than this mapper, rather than letting bool() read the
        // absent column as false. See deal-roster.columns.ts.
        AssertRosterColumns(rows);

        const bool = (v: unknown): boolean => v === true || v === 1 || v === '1';
        /**
         * COERCE THE NUMERICS. They were CAST -- `as number | null` -- which tells TypeScript to trust
         * and enforces nothing at runtime.
         *
         * Measured on this provider today, `Amount` and `Probability` do come back as `number`, so the
         * cast is currently accurate. It is still the wrong construct: `bool()` above exists because
         * this codebase has already met a SQL scalar arriving as `1` rather than `true`, the dashboard
         * loader wraps every numeric in its own `num()`, and the browser reaches these rows over
         * GraphQL rather than in-process -- a different transport that nothing here has verified.
         *
         * The failure mode if that assumption ever breaks is not a type error. `deal-board` reduces
         * these with `+`, so a string turns addition into concatenation: two cards become
         * "027480.000015000.0000", the currency pipe cannot parse it, and the board render dies with
         * InvalidPipeArgumentError. Coercing costs nothing and removes the whole class.
         */
        const num = (v: unknown): number | null => {
            if (v === null || v === undefined || v === '') {
                return null;
            }
            const n = Number(v);
            // NaN would propagate silently through every sum and total. A value that is not a number
            // is reported as absent, which every consumer already handles.
            return Number.isFinite(n) ? n : null;
        };
        return rows.map<DealRosterRow>((d) => ({
            ID: String(d['DealID'] ?? ''),
            DealNumber: (d['DealNumber'] as string | null) ?? null,
            Name: String(d['DealName'] ?? ''),
            AccountID: (d['AccountID'] as string | null) ?? null,
            // Still an em dash rather than a blank: an unattached deal is a STATE, and an empty cell
            // reads as a rendering fault.
            CustomerName: (d['AccountName'] as string | null) ?? '—',
            Amount: num(d['Amount']),
            AmountIsComputed: bool(d['AmountIsComputed']),
            Probability: num(d['Probability']),
            ExpectedCloseDate: (d['ExpectedCloseDate'] as string | Date | null) ?? null,
            ActualCloseDate: (d['ActualCloseDate'] as string | Date | null) ?? null,
            Pipeline: (d['PipelineName'] as string | null) ?? null,
            PipelineStage: (d['StageName'] as string | null) ?? null,
            DealType: (d['DealTypeName'] as string | null) ?? null,
            DealStatusType: (d['StatusName'] as string | null) ?? null,
            OwnerEmployee: (d['OwnerName'] as string | null) ?? null,
            OwnerEmployeeID: (d['OwnerEmployeeID'] as string | null) ?? null,
            CompanyID: (d['CompanyID'] as string | null) ?? null,
            ProductCompanyIDs: CleanIDs(String(d['ProductCompanyIDs'] ?? '').split(',')),
            ForecastCategoryType: (d['ForecastCategoryName'] as string | null) ?? null,
            DealStatusTypeID: (d['DealStatusTypeID'] as string | null) ?? null,
            PipelineID: (d['PipelineID'] as string | null) ?? null,
            PipelineStageID: (d['PipelineStageID'] as string | null) ?? null,
            PipelineIncludeInForecast: bool(d['PipelineIncludeInForecast']),
            CurrencyID: (d['CurrencyID'] as string | null) ?? null,
            CurrencyCode: CurrencyCodeFor((d['CurrencyID'] as string | null) ?? null, codes),
            IsOpen: bool(d['IsOpen']),
            IsWon: bool(d['IsWon']),
            IsLost: bool(d['IsLost']),
            IsClosed: bool(d['IsClosed']),
            IsPastExpectedClose: bool(d['IsPastExpectedClose']),
            IncludeInCommit: bool(d['IncludeInCommit']),
            IncludeInBestCase: bool(d['IncludeInBestCase']),
            IncludeInPipeline: bool(d['IncludeInPipeline']),
            WeightedAmount: num(d['WeightedAmount']),
            StageOrder: num(d['StageOrder']),
        }));
    }

    /** Accounting's currency codes by upper-cased ID, read once per session. See `LoadCurrencyCodes`. */
    private currencyCodes: Promise<Map<string, string>> | null = null;

    /**
     * Accounting's currency codes, keyed by upper-cased ID. Read once and cached: currencies are a
     * short reference list that changes rarely.
     *
     * Read here rather than joined in `deal-roster.sql`, because sales must load on a host without
     * accounting, and a join to accounting's table would make the roster query fail there. Empty when
     * accounting is not installed or the read fails, so every deal reads as the display default; a
     * failed read is not cached, so the next roster load tries again.
     */
    public LoadCurrencyCodes(): Promise<Map<string, string>> {
        if (!this.currencyCodes) {
            this.currencyCodes = this.readCurrencyCodes();
        }
        return this.currencyCodes;
    }

    private async readCurrencyCodes(): Promise<Map<string, string>> {
        const codes = await ReadCurrencyCodes();
        if (codes === null) {
            // A failed read is not cached, so the next roster load tries again.
            this.currencyCodes = null;
            return new Map();
        }
        return codes;
    }

    /**
     * The win rate rows for a period, from `Sales: Win Rate by Count and Value`.
     *
     * NULL means the query did not run, as with {@link LoadDashboardSummary}. An empty list means it
     * ran and nothing closed; the card renders those two differently, so a failure does not read as
     * "0 won / 0 closed".
     */
    public async LoadWinRate(window?: PeriodWindow, filters: DashboardFilters = NO_FILTERS): Promise<Record<string, unknown>[] | null> {
        const parameters = queryParameters(window, filters);
        const result = await new RunQuery().RunQuery({
            QueryName: 'Sales: Win Rate by Count and Value',
            CategoryPath: 'Sales',
            ...(parameters ? { Parameters: parameters } : {}),
        });
        if (!result?.Success) {
            LogError(`Sales: Win Rate by Count and Value failed - ${result?.ErrorMessage ?? 'unknown error'}`);
            return null;
        }
        return (result.Results ?? []) as Record<string, unknown>[];
    }

    /**
     The products a rep may put on a line — from EVERY company, since #29.
     *
     * SEPARATE FROM `LoadLookups`, though the original reason has expired. It used to depend on the
     * deal's company, so it had to be refetched when a deal opened or its pipeline changed. The
     * catalogue is now session-wide like the other lookups, and folding it in would be a fair
     * simplification — one worth making deliberately rather than as a side effect of #29, since it
     * changes when the fetch happens for every caller.
     *
     * A FAILED READ THROWS, after logging orders' reason. It used to return an empty list, so a picker
     * whose query failed (a permissions refusal, a column an older orders install lacks) looked exactly
     * like a catalogue with nothing in it, and nothing was logged (#380). The line editor catches it and
     * says the catalogue could not be loaded, and the rest of the dialog keeps working. An empty list
     * now means only what it says: orders is absent, or offers nothing today.
     *
     * THE AVAILABILITY WINDOW IS JUDGED ON THE BUSINESS DAY (bc-aidp-next-golive#168). It took a `Date`
     * defaulting to `new Date()` and `ProductFilterFor` read the UTC day out of it, so from 7 PM Central
     * the picker was already offering tomorrow's products and had dropped today's last ones. The engine
     * reads one instance configuration row and caches it; `Config(false)` is a no-op after the first
     * call, and it falls back to UTC rather than throwing when the row is missing, so a host that has
     * not set a zone behaves exactly as this did before.
     *
     * @param asOfDay - The day to judge availability on. Defaults to today in the business zone; passed
     *   explicitly only by a caller that means a different day, which is what makes this testable.
     */
    public async LoadProducts(asOfDay?: CalendarDay): Promise<ProductLookup[]> {
        /**
         * ORDERS MAY NOT BE PRESENT AT ALL, and that is a supported state rather than an error.
         *
         * Sales is designed to run standalone: `DealLine.ProductID` is a SOFT reference and no foreign
         * key crosses into orders' schema, so a deployment can install Sales without orders and every
         * other part of this surface still works. Asking `RunView` for an unregistered entity does not
         * return `Success: false` — it logs `Entity ... not found in metadata`, and the Playwright
         * keystone (correctly) treats a console error as a broken screen. That is how this was found:
         * the picker took the whole workspace gate down on a host where orders is absent.
         *
         * So the entity is checked in metadata FIRST, and its absence simply means no picker.
         */
        const md = new Metadata();
        const known = md.Entities.some((e) => e.Name === E_ORDERS_PRODUCT);
        if (!known) {
            return [];
        }

        await BusinessTimeZoneEngine.Instance.Config(false);
        const day = asOfDay ?? BusinessTimeZoneEngine.Instance.Today();

        const rv = new RunView();
        const result = await rv.RunView<ProductLookup>({
            EntityName: E_ORDERS_PRODUCT,
            ExtraFilter: ProductFilterFor(day),
            OrderBy: 'Name ASC',
            ResultType: 'simple',
            // Shared with the check that guards it, so the two cannot drift — see PRODUCT_LOOKUP_FIELDS.
            Fields: [...PRODUCT_LOOKUP_FIELDS],
        });
        if (!result?.Success) {
            const reason = result?.ErrorMessage || 'no reason was given';
            LogError(`The product catalogue could not be loaded - ${reason}`);
            throw new Error(`The product catalogue could not be loaded: ${reason}`);
        }
        return result.Results ?? [];
    }

    /**
     * Reads an existing deal and its collections — header, schedule, roster, and the
     * lines, which belong to the deal's embedded order rather than to the deal.
     *
     * THIS IS THE ONLY PLACE THE COLLECTIONS ARE LOADED, and that is a data-loss guard rather than a
     * tidiness preference. Every one of them is declared `Load: 'explicit'`, so nothing populates them
     * lazily;
     * a second load arriving mid-edit is what would replace the user's unsaved rows with whatever is in
     * the database. `LoadRelatedRecords` is itself guarded — it skips a collection that is already loaded
     * or holds staged work — and it batches all three into ONE `RunViews` rather than three round trips.
     *
     * Returns null when the deal or any of its collections could not be read. That distinction matters:
     * `LoadRelatedRecords` logs a failed collection and leaves it EMPTY rather than throwing, so without
     * the `IsLoaded` check below, a failed read would present as a deal that genuinely has no lines.
     */
    public async LoadDeal(dealID: string): Promise<DealEntity | null> {
        const md = new Metadata();
        const deal = await md.GetEntityObject<DealEntity>(E_DEAL);
        if (!(await deal.Load(dealID))) {
            return null;
        }

        await deal.LoadRelatedRecords(...DEAL_COLLECTIONS);

        // A collection only reports IsLoaded once its rows actually arrived, so this catches the silent
        // failure above. An empty deal and an unreadable one must never look the same.
        if (!deal.PaymentSchedule.IsLoaded || !deal.Team.IsLoaded) {
            return null;
        }

        /**
         * THE LINES LIVE ON THE ORDER, so they need a load of their own.
         *
         * `DEAL_COLLECTIONS` covers the deal's OWN collections; the embedded order is a separate
         * entity instance and its `Lines` is declared `Load: 'explicit'` just like the deal's are. Nothing
         * populates it lazily, so without this a saved deal with lines opens showing NONE -- and reads as
         * a deal nobody has quoted yet.
         *
         * ── THREE OUTCOMES, AND THEY MUST STAY DISTINGUISHABLE ──
         *
         * The whole point of the `IsLoaded` check above is that a failed read must not look like an empty
         * one. That guarantee has to extend here, and there is a third case now:
         *
         *   1. no `OrderID` at all      -- legitimate. A deal saved before the embed landed, or one whose
         *                                  order could not be provisioned. There are no lines to fail to
         *                                  read, so this is NOT an error: the deal opens, empty.
         *   2. `OrderID` set, order absent -- a FAILURE. The FK names a row and the peer did not arrive,
         *                                  which means the read broke or the order was deleted out from
         *                                  under the deal. Returning the deal here would show zero lines
         *                                  for an order that has them.
         *   3. order present, lines unread -- a FAILURE, for the same reason the collections above are
         *                                  checked: `LoadRelatedRecords` logs and leaves the collection
         *                                  empty rather than throwing.
         *
         * Only (1) returns a deal with no lines. (2) and (3) return null, which is what the caller already
         * treats as "could not read this deal" rather than rendering it.
         */
        if (deal.OrderID) {
            const order = deal.OrderID_Object;
            if (!order) {
                LogError(
                    `DealWorkspaceService.LoadDeal: deal ${dealID} points at order ${deal.OrderID} but the ` +
                    'embedded record did not resolve. Refusing to render it as a deal with no lines.',
                );
                return null;
            }
            await order.LoadRelatedRecords('Lines');
            if (!order.Lines.IsLoaded) {
                LogError(
                    `DealWorkspaceService.LoadDeal: could not read the lines of order ${deal.OrderID} for ` +
                    `deal ${dealID}. An unreadable line set must not present as an empty one.`,
                );
                return null;
            }
        }

        return deal;
    }

    /**
     * Saves the deal and its children as ONE unit of work.
     *
     * `Save()` on a record carrying related-record collections is not a single-row write: MJ builds a
     * save plan, ships the whole graph in one `MJ.SaveEntityGraph` mutation, and the server executes it
     * inside one transaction — header first, then removals, then children. So either the deal and
     * everything under it landed, or nothing did. There is no path here that leaves a numbered deal with
     * nothing beneath it, which is exactly what the retired `Sales.SaveDeal` operation existed to
     * guarantee.
     *
     * `IgnoreDirtyState` was set for the deal workspace (deleted, #291), which re-sequenced
     * `DisplayOrder` from array position on every add and remove, so a row that merely MOVED was clean
     * by field-comparison and would have kept its old position. The board, the remaining caller, changes
     * only the stage, so for it the flag rewrites unchanged children. Kept until that is measured.
     *
     * A record the server refuses for being invalid is an ORDINARY outcome, reported through `Validation`
     * rather than `ErrorMessage`. Only a transport or database failure produces the latter.
     */
    public async Save(deal: DealEntity): Promise<DealSaveOutcome> {
        const wasNew = !deal.IsSaved;
        try {
            const validation = ProjectValidation(deal.Validate());
            if (!validation.IsValid) {
                return {
                    Success: false,
                    DealID: deal.IsSaved ? deal.ID : null,
                    Created: false,
                    Validation: validation,
                    ErrorMessage: null,
                };
            }

            const options = new EntitySaveOptions();
            options.IgnoreDirtyState = true;

            const saved = await deal.Save(options);
            if (!saved) {
                return {
                    Success: false,
                    DealID: deal.IsSaved ? deal.ID : null,
                    Created: false,
                    Validation: EmptyValidation(),
                    ErrorMessage: deal.LatestResult?.CompleteMessage ?? 'The deal could not be saved.',
                };
            }

            // The SAME instance now carries the server's IDs, so a caller keeps the record it just
            // saved rather than a rebuilt copy.
            return {
                Success: true,
                DealID: deal.ID,
                Created: wasNew,
                Validation: EmptyValidation(),
                ErrorMessage: null,
            };
        } catch (err) {
            return {
                Success: false,
                DealID: deal.IsSaved ? deal.ID : null,
                Created: false,
                Validation: EmptyValidation(),
                ErrorMessage: err instanceof Error ? err.message : String(err),
            };
        }
    }

    /**
     * The dashboard's four figures, from the `Sales: Dashboard Summary` MJ Query.
     *
     * -- WHY A QUERY AND NOT A GETTER --
     *
     * These were computed in `sales-section.component.ts` by reducing over the loaded roster. The
     * answers were right; the mechanism was the problem. Master plan §9.5: read models belong in MJ
     * Queries rather than hand-rolled Angular aggregation, so Skip, the query builder and report
     * snapshots all get them for free. A measure living in a component getter is reachable by exactly
     * one caller, and silently diverges the moment a second surface needs the same number.
     *
     * It also stops the tiles depending on the roster being fully loaded to be correct: the old
     * TotalCount was `this.Deals.length`, so any future paging or filtering of the roster would have
     * quietly changed a headline figure that is supposed to describe the whole book.
     *
     * Proven equivalent BEFORE the switch: `test-harnesses/compare-dashboard-measures.mjs` runs both
     * implementations over the same data and fails on any disagreement. All eight comparisons agreed,
     * including the closing-soon ORDER and the slipped set by deal identity rather than by count.
     */
    /**
     * The fiscal year start the dashboard's period selector reckons from.
     *
     * -- READ FROM ACCOUNTING, NEVER STORED HERE --
     *
     * `AccountingCompanyProfile` is an IsA child of `__mj.Company` carrying `FiscalYearStartMonth` /
     * `FiscalYearStartDay`, and bizapps-accounting already derives its fiscal year from exactly those
     * two columns. Sales declares accounting as a dependency and its own dev seed writes them. A
     * second copy in this app would give one fact two homes and let two apps disagree about what
     * "FY26" means while both looked right.
     *
     * -- THE METADATA CHECK COMES FIRST, AND IT IS NOT DEFENSIVE TIDINESS --
     *
     * Sales is designed to run standalone. Asking `RunView` for an unregistered entity does NOT come
     * back `Success: false`; it logs `Entity ... not found in metadata`, and the Playwright keystone
     * (correctly) treats a console error as a broken screen. That is how the product picker once took
     * the whole workspace gate down on a host without orders -- see {@link LoadProducts}. So absence
     * is established from metadata before any read is attempted, and it is reported as its own basis
     * rather than as an empty result, because "accounting is not installed" and "nobody has filled in
     * a profile" call for different fixes.
     *
     * Returns a resolution rather than a bare start so the caller can SAY which case it hit. What it
     * never does is throw or pick arbitrarily: see {@link ResolveFiscalYearStart} for why a
     * disagreement between companies falls back instead of choosing a winner.
     */
    public async LoadFiscalYearStart(): Promise<FiscalYearStartResolution> {
        const md = new Metadata();
        if (!md.Entities.some((e) => e.Name === E_ACCOUNTING_COMPANY_PROFILE)) {
            return ResolveFiscalYearStart(null);
        }

        /**
         * CAUGHT, BECAUSE THIS READ IS AWAITED BEFORE EVERYTHING ELSE THE SECTION LOADS.
         *
         * `Refresh()` has to resolve the fiscal start before it can compute the window it sends to
         * the windowed queries, so this call sits ahead of the roster, the lookups and the summary.
         * A rejection here therefore does not degrade one figure -- it aborts the whole load and
         * leaves the section on its spinner, with no board, no roster and no deals, over a value
         * that has a documented fallback two lines below. `Success: false` was already handled; a
         * THROW (transport failure, a provider that rejects on a permission denial) was not.
         */
        let result: RunViewResult<FiscalYearStart & { IsActive: boolean }> | null = null;
        try {
            result = await new RunView().RunView<FiscalYearStart & { IsActive: boolean }>({
                EntityName: E_ACCOUNTING_COMPANY_PROFILE,
                // Only companies still trading define the year the dashboard reports on. A retired
                // subsidiary's January start should not put the whole dashboard into 'mixed'.
                ExtraFilter: 'IsActive = 1',
                ResultType: 'simple',
                Fields: ['FiscalYearStartMonth', 'FiscalYearStartDay'],
            });
        } catch (e) {
            LogStatus(`${E_ACCOUNTING_COMPANY_PROFILE} read threw, falling back to the calendar year - ${e instanceof Error ? e.message : String(e)}`);
            return { Start: CALENDAR_YEAR_START, Basis: 'unreadable' };
        }
        if (!result?.Success) {
            /**
             * LOGGED AT STATUS, NOT ERROR, AND THAT IS THE WHOLE POINT OF THE METADATA GUARD ABOVE.
             *
             * `LogError` reaches `console.error`. The guard only establishes that the entity is
             * REGISTERED; it says nothing about whether this user may read it, and a sales rep whose
             * roles carry no accounting permissions is an ordinary deployment, not a fault. Logging
             * that at error level would put a console error on every dashboard load for those users
             * -- which `75-dashboard.spec.ts` fails on via `expectNoConsoleErrors`, and which is
             * exactly the breakage the guard was added to prevent (see {@link LoadProducts}).
             *
             * A FAILED read is still not an absent app, nor a host with no profiles. It falls back to
             * the calendar year as 'unreadable', so the basis line says the start could not be read
             * rather than telling the reader to configure something that may already be configured.
             */
            LogStatus(`${E_ACCOUNTING_COMPANY_PROFILE} read failed, falling back to the calendar year - ${result?.ErrorMessage ?? 'unknown error'}`);
            return { Start: CALENDAR_YEAR_START, Basis: 'unreadable' };
        }

        const rows = (result.Results ?? []) as unknown as Record<string, unknown>[];
        const starts = rows
            .map((r) => ({ Month: Number(r['FiscalYearStartMonth']), Day: Number(r['FiscalYearStartDay']) }))
            // A row whose columns did not arrive as numbers cannot define a boundary. Dropping it is
            // right: counting it would make every host with one bad row read as 'mixed', which reports
            // a disagreement between companies that does not exist.
            .filter((s) => Number.isFinite(s.Month) && Number.isFinite(s.Day) && s.Month >= 1 && s.Month <= 12);
        return ResolveFiscalYearStart(starts);
    }

    /**
     * @param window Bounds Won on `ActualCloseDate` and the open figures on `ExpectedCloseDate`; the
     * attention counts are never bounded (see `dashboard-summary.sql`). A null bound is passed as no
     * parameter at all, which is how the Nunjucks `{% if %}` blocks drop the clause.
     * @param filters The filter bar's lists, applied by the query to every figure.
     */
    public async LoadDashboardSummary(window?: PeriodWindow, filters: DashboardFilters = NO_FILTERS): Promise<DealDashboardSummary | null> {
        const parameters = queryParameters(window, filters);
        const result = await new RunQuery().RunQuery({
            QueryName: 'Sales: Dashboard Summary',
            CategoryPath: 'Sales',
            ...(parameters ? { Parameters: parameters } : {}),
        });
        if (!result?.Success) {
            LogError(`Sales: Dashboard Summary failed - ${result?.ErrorMessage ?? 'unknown error'}`);
            return null;
        }
        const row = (result.Results ?? [])[0] as Record<string, unknown> | undefined;
        if (!row) {
            return null;
        }
        // The query aggregates, so it returns a row even over an empty table. A null from here means
        // the query did not RUN, which is a different thing from a database with no deals -- and the
        // caller renders those two states differently.
        const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
        return {
            OpenAmount: num(row['OpenAmount']),
            OpenCount: num(row['OpenCount']),
            OpenOmittedCount: num(row['OpenOmittedCount']),
            CommitAmount: num(row['CommitAmount']),
            CommitCount: num(row['CommitCount']),
            BestCaseOnlyAmount: num(row['BestCaseOnlyAmount']),
            PipelineOnlyAmount: num(row['PipelineOnlyAmount']),
            WeightedAmount: num(row['WeightedAmount']),
            TotalCount: num(row['TotalCount']),
            PastExpectedCloseCount: num(row['PastExpectedCloseCount']),
            NoOwnerCount: num(row['NoOwnerCount']),
            NoCloseDateCount: num(row['NoCloseDateCount']),
            WonCount: num(row['WonCount']),
            WonAmount: num(row['WonAmount']),
            NoLinesDealCount: num(row['NoLinesDealCount']),
            OpenPricedAmount: num(row['OpenPricedAmount']),
            OpenStatedAmount: num(row['OpenStatedAmount']),
            OpenNoAmountCount: num(row['OpenNoAmountCount']),
        };
    }
}
