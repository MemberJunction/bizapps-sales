/**
 * @fileoverview All data access for the deal workspace, so the component itself does none.
 *
 * The workspace component stays presentational: it takes lookups and a `DealEntity`, and asks this
 * service to save it. That split is copied from bizapps-contracts, and the payoff is that the surface can
 * be rendered and reasoned about without a provider behind it.
 *
 * WHAT CHANGED WITH RELATED RECORD COLLECTIONS. This service used to build a `DealDraft` — a UI-side
 * model with its own line and instalment arrays — and send it through the `Sales.SaveDeal` remote
 * operation, because the entity a browser held had no child collections to save. It does now, so the
 * service hands out the real entity and its children, and saving is `deal.Save()`. The two places that
 * needed care are both here rather than in the component: LOADING the collections exactly once
 * ({@link DealWorkspaceService.LoadDeal}) and forcing a full write-out on save
 * ({@link DealWorkspaceService.Save}).
 *
 * @module @mj-biz-apps/sales-ng
 */
import { Injectable } from '@angular/core';
import { EntitySaveOptions, LogError, Metadata, RunQuery, RunView, RunViewParams } from '@memberjunction/core';
import { DealEntity } from '@mj-biz-apps/sales-entities';

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
import { E_ORDERS_PRODUCT, ProductFilterFor, type ProductLookup } from '@mj-biz-apps/sales-entities';

const E_PIPELINE = 'MJ_BizApps_Sales: Pipelines';
const E_STAGE = 'MJ_BizApps_Sales: Pipeline Stages';
const E_DEAL_TYPE = 'MJ_BizApps_Sales: Deal Types';
const E_STATUS_TYPE = 'MJ_BizApps_Sales: Deal Status Types';
const E_FORECAST_TYPE = 'MJ_BizApps_Sales: Forecast Category Types';
const E_ACCOUNT = 'MJ_BizApps_Sales: Sales Accounts';
const E_CONTACT = 'MJ_BizApps_Sales: Sales Contacts';
const E_EMPLOYEE = 'MJ: Employees';
const E_DEAL = 'MJ_BizApps_Sales: Deals';
const E_LOSS_REASON = 'MJ_BizApps_Sales: Loss Reasons';

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
    OpenAmount: number;
    OpenCount: number;
    TotalCount: number;
    PastExpectedCloseCount: number;
    WonCount: number;
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
    /** Virtual name columns that DO resolve on the Deal view. */
    Pipeline: string | null;
    PipelineStage: string | null;
    DealType: string | null;
    DealStatusType: string | null;
    OwnerEmployee: string | null;
    ForecastCategoryType: string | null;
    /** Kept so anything downstream can branch on the STATUS FLAGS rather than the status name. */
    DealStatusTypeID: string | null;
    /** Grouping keys for the board. Names render; IDs group. */
    PipelineID: string | null;
    PipelineStageID: string | null;
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
     * The currency `Amount` is denominated in. NULL means UNKNOWN, not "the display default" -- it is
     * unpopulated on every deal today. A consumer must not total a set containing more than one
     * distinct value; the board refuses to.
     */
    CurrencyID: string | null;
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
interface PipelineRow { ID: string; Name: string; CompanyID: string; Company: string | null }
interface StageRow { ID: string; Name: string; PipelineID: string; DisplayOrder: number; Probability: number | null; ForecastCategoryTypeID: string | null; DealStatusTypeID: string | null }
interface NamedRow { ID: string; Name: string }
interface StatusRow extends NamedRow { IsOpen: boolean; IsClosed: boolean; IsWon: boolean; IsLost: boolean; LocksDeal: boolean }
interface LossReasonRow extends NamedRow { RequiresNotes: boolean }
interface ContactRow { ID: string; FirstName: string | null; LastName: string | null; Email: string | null }
interface EmployeeRow { ID: string; FirstLast: string | null }
/**
 * The collections the workspace edits, named once.
 *
 * Passed to `LoadRelatedRecords` so the load is EXPLICIT about what it wants rather than taking
 * "everything declared". A collection added to the entity later should not start being fetched by a
 * surface that does not render it.
 */
// 'Lines' is NOT here: the deal holds none. Its order's lines arrive with the embedded order.
const WORKSPACE_COLLECTIONS = ['PaymentSchedule', 'Team'] as const;

@Injectable({ providedIn: 'root' })
export class DealWorkspaceService {
    /**
     * Loads every picker's contents in ONE round trip.
     *
     * `RunViews` (plural) rather than nine awaited `RunView` calls — the house rule against querying in
     * a loop applies just as much to a fixed list of nine as to an unbounded one.
     */
    /**
     * The human-facing NUMBER of a record a close routed to.
     *
     * `SalesCloseRoutingResult.RecordID` is an ID; a user needs the number orders or contracts minted.
     * Soft-resolved by target so the workspace degrades to showing nothing rather than erroring when the
     * downstream app is not installed — the routing result already explains that case in its own words.
     *
     * This is a READ of the downstream record's own value. Nothing is computed here; see the money rule.
     */
    public async LookupRoutedRecordNumber(target: string, recordID: string): Promise<string | null> {
        const map: Record<string, { Entity: string; Field: string }> = {
            Order: { Entity: 'MJ_BizApps_Orders: Order Headers', Field: 'OrderNumber' },
            Contract: { Entity: 'MJ_BizApps_Contracts: Contracts', Field: 'ContractNumber' },
        };
        const spec = map[target];
        if (!spec) {
            return null;
        }
        try {
            const r = await new RunView().RunView<Record<string, unknown>>({
                EntityName: spec.Entity,
                ExtraFilter: `ID = '${recordID.replace(/'/g, "''")}'`,
                ResultType: 'simple',
                Fields: ['ID', spec.Field],
            });
            const row = r?.Success ? (r.Results ?? [])[0] : undefined;
            const value = row?.[spec.Field];
            return typeof value === 'string' && value.length ? value : null;
        } catch {
            return null;
        }
    }

    public async LoadLookups(): Promise<DealWorkspaceLookups> {
        const rv = new RunView();
        const params: RunViewParams[] = [
            { EntityName: E_PIPELINE, ExtraFilter: 'IsActive = 1', OrderBy: 'DisplayRank ASC, Name ASC', ResultType: 'simple', Fields: ['ID', 'Name', 'CompanyID', 'Company'] },
            { EntityName: E_STAGE, ExtraFilter: 'IsActive = 1', OrderBy: 'DisplayOrder ASC', ResultType: 'simple', Fields: ['ID', 'Name', 'PipelineID', 'DisplayOrder', 'Probability', 'ForecastCategoryTypeID', 'DealStatusTypeID'] },
            { EntityName: E_DEAL_TYPE, ExtraFilter: 'IsActive = 1', OrderBy: 'DisplayRank ASC', ResultType: 'simple', Fields: ['ID', 'Name'] },
            // The FLAGS come back with the status, because the dashboard counts open/won deals and the
            // only permitted way to decide either is to read the flag. Comparing a status name is what
            // the vocabulary gate forbids, and it also breaks the moment somebody renames "Won".
            { EntityName: E_STATUS_TYPE, ExtraFilter: 'IsActive = 1', OrderBy: 'DisplayRank ASC', ResultType: 'simple', Fields: ['ID', 'Name', 'IsOpen', 'IsClosed', 'IsWon', 'IsLost', 'LocksDeal'] },
            { EntityName: E_FORECAST_TYPE, ExtraFilter: 'IsActive = 1', OrderBy: 'DisplayRank ASC', ResultType: 'simple', Fields: ['ID', 'Name'] },
            // KI-8: a Deal row cannot resolve its own account or contact name, because both FKs point at
            // IsA CHILDREN whose Name lives on the parent and CodeGen generates no lookup join through
            // that edge. So they are loaded here and resolved client-side. This is the reason the
            // customer-context header exists as a lookup rather than a field on the deal.
            { EntityName: E_ACCOUNT, ExtraFilter: 'IsActive = 1', OrderBy: 'Name ASC', ResultType: 'simple', Fields: ['ID', 'Name'] },
            { EntityName: E_CONTACT, OrderBy: 'LastName ASC', ResultType: 'simple', Fields: ['ID', 'FirstName', 'LastName', 'Email'] },
            { EntityName: E_EMPLOYEE, ExtraFilter: 'Active = 1', OrderBy: 'LastName ASC', ResultType: 'simple', Fields: ['ID', 'FirstLast'] },
            // Index 9 — loss reasons, for the close panel. `RequiresNotes` travels with them because the
            // panel decides whether LossNotes is mandatory from the FLAG on the chosen row.
            { EntityName: E_LOSS_REASON, ExtraFilter: 'IsActive = 1', OrderBy: 'DisplayRank ASC, Name ASC', ResultType: 'simple', Fields: ['ID', 'Name', 'RequiresNotes'] },
        ];

        const results = await rv.RunViews(params);

        /**
         * `RunViews` answers POSITIONALLY, and hand-typed indexes drift the moment a query is added or
         * removed. This file has already been bitten by it: a picker that read as EMPTY because every
         * index after an insertion point was off by one -- which looks like "no rows", not like a bug.
         * Deleting the Deal Line Types query above would have shifted four more.
         *
         * So the order is declared ONCE and every reader asks by NAME. Adding a query means adding its
         * name here beside the param; nothing else moves.
         */
        const ORDER = [
            'Pipelines', 'Stages', 'DealTypes', 'DealStatusTypes', 'ForecastCategoryTypes',
            'Accounts', 'Contacts', 'Employees', 'LossReasons',
        ] as const;
        const at = (key: (typeof ORDER)[number]): number => ORDER.indexOf(key);
        if (results && results.length !== ORDER.length) {
            // Each block below already degrades on its own, so this is not fatal -- but a mismatch means
            // ORDER and `params` have drifted apart, and every picker past the drift is reading the
            // wrong query. Say so rather than let it be discovered as an empty dropdown.
            LogError(
                `DealWorkspaceService.LoadLookups: ${results.length} result(s) for ${ORDER.length} ` +
                'named lookups -- ORDER and the params array have drifted.',
            );
        }
        const lookups = EmptyLookups();

        // RunViews does not throw; an unsuccessful view yields an empty list rather than an exception,
        // so each block checks Success independently. A missing picker degrades that one control
        // instead of blanking the whole surface.
        const rows = <T>(index: number): T[] => {
            const r = results?.[index];
            return r?.Success ? ((r.Results ?? []) as T[]) : [];
        };

        lookups.Pipelines = rows<PipelineRow>(at('Pipelines')).map<PipelineLookup>((p) => ({
            ID: p.ID, Name: p.Name, CompanyID: p.CompanyID, CompanyName: p.Company ?? null,
        }));
        lookups.Stages = rows<StageRow>(at('Stages')).map<StageLookup>((s) => ({
            ID: s.ID, Name: s.Name, PipelineID: s.PipelineID, DisplayOrder: s.DisplayOrder,
            Probability: s.Probability, ForecastCategoryTypeID: s.ForecastCategoryTypeID,
            DealStatusTypeID: s.DealStatusTypeID ?? null,
        }));
        lookups.DealTypes = rows<NamedRow>(at('DealTypes')).map<DealLookup>((r) => ({ ID: r.ID, Name: r.Name }));
        lookups.DealStatusTypes = rows<StatusRow>(at('DealStatusTypes')).map<DealStatusLookup>((r) => ({
            ID: r.ID,
            Name: r.Name,
            IsOpen: r.IsOpen === true,
            IsClosed: r.IsClosed === true,
            IsWon: r.IsWon === true,
            IsLost: r.IsLost === true,
            LocksDeal: r.LocksDeal === true,
        }));
        lookups.ForecastCategoryTypes = rows<NamedRow>(at('ForecastCategoryTypes')).map<DealLookup>((r) => ({ ID: r.ID, Name: r.Name }));
        // Index 9 — the loss reasons queried above. The close panel cannot demand a reason it has no
        // list to offer, and an empty dropdown fails as a TIMEOUT rather than as a missing list, which
        // is a slow way to find out.
        lookups.LossReasons = rows<LossReasonRow>(at('LossReasons')).map<LossReasonLookup>((r) => ({
            ID: r.ID, Name: r.Name, RequiresNotes: r.RequiresNotes === true,
        }));
        lookups.Accounts = rows<NamedRow>(at('Accounts')).map<DealLookup>((r) => ({ ID: r.ID, Name: r.Name }));
        lookups.Contacts = rows<ContactRow>(at('Contacts')).map<DealLookup>((c) => ({
            ID: c.ID,
            Name: [c.FirstName, c.LastName].filter(Boolean).join(' ').trim() || c.Email || '(unnamed contact)',
        }));
        lookups.Employees = rows<EmployeeRow>(at('Employees')).map<DealLookup>((e) => ({
            ID: e.ID, Name: e.FirstLast ?? '(unnamed employee)',
        }));

        return lookups;
    }

    /**
     * The deal roster — what the dashboard and the list both read.
     *
     * ONE `RunViews` call for deals AND accounts. The account read exists only to resolve customer
     * names (KI-8); doing it per row would be the "never query in a loop" rule broken in the most
     * expensive possible place.
     *
     * Returns an empty array on failure rather than throwing, because a roster that cannot load should
     * render as an empty list with a message, not take the whole section down.
     */
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
     */
    public async LoadRoster(): Promise<DealRosterRow[]> {
        const result = await new RunQuery().RunQuery({
            QueryName: 'Sales: Deal Roster',
            CategoryPath: 'Sales',
        });
        if (!result?.Success) {
            LogError(`Sales: Deal Roster failed - ${result?.ErrorMessage ?? 'unknown error'}`);
            return [];
        }

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
        return ((result.Results ?? []) as Record<string, unknown>[]).map<DealRosterRow>((d) => ({
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
            Pipeline: (d['PipelineName'] as string | null) ?? null,
            PipelineStage: (d['StageName'] as string | null) ?? null,
            DealType: (d['DealTypeName'] as string | null) ?? null,
            DealStatusType: (d['StatusName'] as string | null) ?? null,
            OwnerEmployee: (d['OwnerName'] as string | null) ?? null,
            ForecastCategoryType: (d['ForecastCategoryName'] as string | null) ?? null,
            DealStatusTypeID: (d['DealStatusTypeID'] as string | null) ?? null,
            PipelineID: (d['PipelineID'] as string | null) ?? null,
            PipelineStageID: (d['PipelineStageID'] as string | null) ?? null,
            CurrencyID: (d['CurrencyID'] as string | null) ?? null,
            IsOpen: bool(d['IsOpen']),
            IsWon: bool(d['IsWon']),
            IsLost: bool(d['IsLost']),
            IsClosed: bool(d['IsClosed']),
            IsPastExpectedClose: bool(d['IsPastExpectedClose']),
        }));
    }

    /**
     * The products a rep may put on a line, for one selling company.
     *
     * SEPARATE FROM `LoadLookups`, deliberately. The other pickers are session-wide and load once; this
     * one depends on the DEAL'S company, so it is fetched when a deal opens and again if its pipeline
     * changes. Folding it into the session lookups would either fetch every company's catalogue or
     * silently show the first deal's.
     *
     * Returns an empty list on failure rather than throwing: a picker that cannot load should offer
     * nothing and let the rest of the line editor keep working. The consequence — a rep unable to select
     * a product — is visible, whereas a half-loaded catalogue silently missing rows is not.
     */
    public async LoadProducts(companyID: string | null, asOf: Date = new Date()): Promise<ProductLookup[]> {
        if (!companyID) {
            return [];
        }

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

        const rv = new RunView();
        const result = await rv.RunView<ProductLookup>({
            EntityName: E_ORDERS_PRODUCT,
            ExtraFilter: ProductFilterFor(companyID, asOf),
            OrderBy: 'Name ASC',
            ResultType: 'simple',
            Fields: ['ID', 'Name', 'SKU'],
        });
        return result?.Success ? (result.Results ?? []) : [];
    }

    /** A blank deal, ready to bind to. Its collections start empty and are never loaded — there is nothing to load. */
    public async NewDeal(): Promise<DealEntity> {
        const md = new Metadata();
        const deal = await md.GetEntityObject<DealEntity>(E_DEAL);
        deal.NewRecord();
        return deal;
    }

    /**
     * Reads an existing deal and everything the workspace shows — header, schedule, roster, and the
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

        await deal.LoadRelatedRecords(...WORKSPACE_COLLECTIONS);

        // A collection only reports IsLoaded once its rows actually arrived, so this catches the silent
        // failure above. An empty deal and an unreadable one must never look the same.
        if (!deal.PaymentSchedule.IsLoaded || !deal.Team.IsLoaded) {
            return null;
        }

        /**
         * THE LINES LIVE ON THE ORDER, so they need a load of their own.
         *
         * `WORKSPACE_COLLECTIONS` covers the deal's OWN collections; the embedded order is a separate
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
     * `IgnoreDirtyState` is deliberate and load-bearing: without it, a child that is loaded and unchanged
     * contributes no work, which is normally right — but this surface re-sequences `DisplayOrder` from
     * array position on every add and remove, so a row that merely MOVED is clean by field-comparison and
     * would keep its old position in the database.
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

            // The SAME instance now carries the server's IDs, so the surface keeps editing the record it
            // just created rather than a rebuilt copy — the job `ApplySaveResult` used to do by hand.
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
    public async LoadDashboardSummary(): Promise<DealDashboardSummary | null> {
        const result = await new RunQuery().RunQuery({
            QueryName: 'Sales: Dashboard Summary',
            CategoryPath: 'Sales',
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
            TotalCount: num(row['TotalCount']),
            PastExpectedCloseCount: num(row['PastExpectedCloseCount']),
            WonCount: num(row['WonCount']),
            OpenPricedAmount: num(row['OpenPricedAmount']),
            OpenStatedAmount: num(row['OpenStatedAmount']),
            OpenNoAmountCount: num(row['OpenNoAmountCount']),
        };
    }
}
