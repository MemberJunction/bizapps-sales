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
import { EntitySaveOptions, Metadata, RunView, RunViewParams } from '@memberjunction/core';
import { DealEntity } from '@mj-biz-apps/sales-entities';

import {
    EmptyLookups,
    type DealLookup,
    type DealStatusLookup,
    type LossReasonLookup,
    type DealWorkspaceLookups,
    type LineTypeLookup,
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
const E_LINE_TYPE = 'MJ_BizApps_Sales: Deal Line Types';
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
}

/** Raw roster shape before the account name is joined in. */
interface DealRosterQueryRow {
    ID: string; DealNumber: string | null; Name: string; AccountID: string | null;
    Amount: number | null; AmountIsComputed: boolean; Probability: number | null;
    ExpectedCloseDate: string | Date | null; Pipeline: string | null; PipelineStage: string | null;
    DealType: string | null; DealStatusType: string | null; OwnerEmployee: string | null;
    ForecastCategoryType: string | null; DealStatusTypeID: string | null;
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
interface StageRow { ID: string; Name: string; PipelineID: string; DisplayOrder: number; Probability: number | null; ForecastCategoryTypeID: string | null }
interface NamedRow { ID: string; Name: string }
interface LineTypeRow extends NamedRow { IsRecurring: boolean }
interface StatusRow extends NamedRow { IsOpen: boolean; IsClosed: boolean; IsWon: boolean; IsLost: boolean }
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
const WORKSPACE_COLLECTIONS = ['Lines', 'PaymentSchedule', 'Team'] as const;

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
            { EntityName: E_STAGE, ExtraFilter: 'IsActive = 1', OrderBy: 'DisplayOrder ASC', ResultType: 'simple', Fields: ['ID', 'Name', 'PipelineID', 'DisplayOrder', 'Probability', 'ForecastCategoryTypeID'] },
            { EntityName: E_DEAL_TYPE, ExtraFilter: 'IsActive = 1', OrderBy: 'DisplayRank ASC', ResultType: 'simple', Fields: ['ID', 'Name'] },
            // The FLAGS come back with the status, because the dashboard counts open/won deals and the
            // only permitted way to decide either is to read the flag. Comparing a status name is what
            // the vocabulary gate forbids, and it also breaks the moment somebody renames "Won".
            { EntityName: E_STATUS_TYPE, ExtraFilter: 'IsActive = 1', OrderBy: 'DisplayRank ASC', ResultType: 'simple', Fields: ['ID', 'Name', 'IsOpen', 'IsClosed', 'IsWon', 'IsLost'] },
            { EntityName: E_FORECAST_TYPE, ExtraFilter: 'IsActive = 1', OrderBy: 'DisplayRank ASC', ResultType: 'simple', Fields: ['ID', 'Name'] },
            { EntityName: E_LINE_TYPE, ExtraFilter: 'IsActive = 1', OrderBy: 'DisplayRank ASC', ResultType: 'simple', Fields: ['ID', 'Name', 'IsRecurring'] },
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
        const lookups = EmptyLookups();

        // RunViews does not throw; an unsuccessful view yields an empty list rather than an exception,
        // so each block checks Success independently. A missing picker degrades that one control
        // instead of blanking the whole surface.
        const rows = <T>(index: number): T[] => {
            const r = results?.[index];
            return r?.Success ? ((r.Results ?? []) as T[]) : [];
        };

        lookups.Pipelines = rows<PipelineRow>(0).map<PipelineLookup>((p) => ({
            ID: p.ID, Name: p.Name, CompanyID: p.CompanyID, CompanyName: p.Company ?? null,
        }));
        lookups.Stages = rows<StageRow>(1).map<StageLookup>((s) => ({
            ID: s.ID, Name: s.Name, PipelineID: s.PipelineID, DisplayOrder: s.DisplayOrder,
            Probability: s.Probability, ForecastCategoryTypeID: s.ForecastCategoryTypeID,
        }));
        lookups.DealTypes = rows<NamedRow>(2).map<DealLookup>((r) => ({ ID: r.ID, Name: r.Name }));
        lookups.DealStatusTypes = rows<StatusRow>(3).map<DealStatusLookup>((r) => ({
            ID: r.ID,
            Name: r.Name,
            IsOpen: r.IsOpen === true,
            IsClosed: r.IsClosed === true,
            IsWon: r.IsWon === true,
            IsLost: r.IsLost === true,
        }));
        lookups.ForecastCategoryTypes = rows<NamedRow>(4).map<DealLookup>((r) => ({ ID: r.ID, Name: r.Name }));
        // Index 9 — the loss reasons queried above. The close panel cannot demand a reason it has no
        // list to offer, and an empty dropdown fails as a TIMEOUT rather than as a missing list, which
        // is a slow way to find out.
        lookups.LossReasons = rows<LossReasonRow>(9).map<LossReasonLookup>((r) => ({
            ID: r.ID, Name: r.Name, RequiresNotes: r.RequiresNotes === true,
        }));
        lookups.LineTypes = rows<LineTypeRow>(5).map<LineTypeLookup>((r) => ({
            ID: r.ID, Name: r.Name, IsRecurring: r.IsRecurring === true,
        }));
        lookups.Accounts = rows<NamedRow>(6).map<DealLookup>((r) => ({ ID: r.ID, Name: r.Name }));
        lookups.Contacts = rows<ContactRow>(7).map<DealLookup>((c) => ({
            ID: c.ID,
            Name: [c.FirstName, c.LastName].filter(Boolean).join(' ').trim() || c.Email || '(unnamed contact)',
        }));
        lookups.Employees = rows<EmployeeRow>(8).map<DealLookup>((e) => ({
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
    public async LoadRoster(): Promise<DealRosterRow[]> {
        const rv = new RunView();
        const results = await rv.RunViews([
            {
                EntityName: E_DEAL,
                OrderBy: 'ExpectedCloseDate ASC, Name ASC',
                ResultType: 'simple',
                Fields: [
                    'ID', 'DealNumber', 'Name', 'AccountID', 'Amount', 'AmountIsComputed', 'Probability',
                    'ExpectedCloseDate', 'Pipeline', 'PipelineStage', 'DealType', 'DealStatusType',
                    'OwnerEmployee', 'ForecastCategoryType', 'DealStatusTypeID',
                ],
            },
            { EntityName: E_ACCOUNT, ResultType: 'simple', Fields: ['ID', 'Name'] },
        ]);

        if (!results?.[0]?.Success) {
            return [];
        }
        const accounts = new Map<string, string>(
            (results[1]?.Success ? ((results[1].Results ?? []) as NamedRow[]) : []).map((a) => [a.ID, a.Name]),
        );

        return ((results[0].Results ?? []) as DealRosterQueryRow[]).map<DealRosterRow>((d) => ({
            ...d,
            AmountIsComputed: d.AmountIsComputed === true,
            // "—" rather than a blank cell: an unattached deal is a state, and an empty cell reads as a
            // rendering fault.
            CustomerName: (d.AccountID ? accounts.get(d.AccountID) : null) ?? '—',
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
     * Reads an existing deal and its children — header, lines, schedule and roster together.
     *
     * THIS IS THE ONLY PLACE THE COLLECTIONS ARE LOADED, and that is a data-loss guard rather than a
     * tidiness preference. All three are declared `Load: 'explicit'`, so nothing populates them lazily;
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
        if (!deal.Lines.IsLoaded || !deal.PaymentSchedule.IsLoaded || !deal.Team.IsLoaded) {
            return null;
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
}
