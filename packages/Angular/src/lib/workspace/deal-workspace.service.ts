/**
 * @fileoverview All data access for the deal workspace, so the component itself does none.
 *
 * The workspace component stays presentational: it takes lookups and a draft, and emits a save. That
 * split is copied from bizapps-contracts, and the payoff is that the surface can be rendered and
 * reasoned about without a provider behind it.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { Injectable } from '@angular/core';
import { RunView, RunViewParams } from '@memberjunction/core';
import {
    DealDraft,
    SalesSaveDealOperation,
    type SalesDealIssue,
} from '@mj-biz-apps/sales-entities';

import {
    EmptyLookups,
    type DealLookup,
    type DealStatusLookup,
    type DealWorkspaceLookups,
    type LineTypeLookup,
    type PipelineLookup,
    type StageLookup,
} from './deal-workspace.types';

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
const E_DEAL_LINE = 'MJ_BizApps_Sales: Deal Lines';
const E_SCHEDULE = 'MJ_BizApps_Sales: Deal Payment Schedules';

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
    ExpectedCloseDate: string | null;
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
    ExpectedCloseDate: string | null; Pipeline: string | null; PipelineStage: string | null;
    DealType: string | null; DealStatusType: string | null; OwnerEmployee: string | null;
    ForecastCategoryType: string | null; DealStatusTypeID: string | null;
}

/** What a save attempt reports back. Mirrors the operation's own output rather than flattening it. */
export interface DealSaveOutcome {
    Success: boolean;
    DealID: string | null;
    Created: boolean;
    /** Structured, so the caller can badge tabs and mark fields. Never a joined string. */
    Issues: SalesDealIssue[];
    /** Set only when the call itself failed (transport, auth) rather than the draft being invalid. */
    ErrorMessage: string | null;
}

/** Row shapes as they come back from RunView with `ResultType: 'simple'`. */
interface PipelineRow { ID: string; Name: string; CompanyID: string; Company: string | null }
interface StageRow { ID: string; Name: string; PipelineID: string; DisplayOrder: number; Probability: number | null; ForecastCategoryTypeID: string | null }
interface NamedRow { ID: string; Name: string }
interface LineTypeRow extends NamedRow { IsRecurring: boolean }
interface StatusRow extends NamedRow { IsOpen: boolean; IsClosed: boolean; IsWon: boolean; IsLost: boolean }
interface ContactRow { ID: string; FirstName: string | null; LastName: string | null; Email: string | null }
interface EmployeeRow { ID: string; FirstLast: string | null }
interface DealRow {
    ID: string; Name: string; PipelineID: string; PipelineStageID: string | null; DealTypeID: string | null;
    DealStatusTypeID: string | null; AccountID: string | null; PrimaryContactID: string | null;
    BillingContactID: string | null; CompanyID: string; OwnerEmployeeID: string | null;
    Amount: number | null; TermMonths: number | null; EstimatedProjectWeeks: number | null;
    ExecutionDate: string | null; StartDate: string | null; ExpectedCloseDate: string | null;
    Probability: number | null; ForecastCategoryTypeID: string | null; AutoRenew: boolean;
    AnnualIncreasePctOverride: number | null; CancellationNoticeDaysOverride: number | null;
    PaymentMethod: string | null; ContractVariances: string | null; Description: string | null;
    NextStep: string | null; NextStepDate: string | null;
}
interface DealLineRow {
    ID: string; ProductID: string | null; ProductName: string | null; DealLineTypeID: string | null;
    Quantity: number; RequestedDiscountPct: number | null; OverrideUnitPrice: number | null;
    AnnualGrossFees: number | null; DiscountAmount: number | null; Total: number | null;
    TermMonths: number | null; ServicePeriodStart: string | null; ServicePeriodEnd: string | null;
    Description: string | null; DisplayOrder: number;
}
interface ScheduleRow {
    ID: string; PaymentDate: string | null; Amount: number | null; Description: string | null; DisplayOrder: number;
}

/** A DATE column arrives as a full timestamp; the `<input type="date">` wants only the day part. */
function toDateInput(value: string | null): string | null {
    if (!value) {
        return null;
    }
    return value.length >= 10 ? value.slice(0, 10) : value;
}

@Injectable({ providedIn: 'root' })
export class DealWorkspaceService {
    /**
     * Loads every picker's contents in ONE round trip.
     *
     * `RunViews` (plural) rather than nine awaited `RunView` calls — the house rule against querying in
     * a loop applies just as much to a fixed list of nine as to an unbounded one.
     */
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
     * Reads an existing deal into a draft — header, lines and schedule together.
     *
     * Returns null when the deal cannot be read, rather than an empty draft: an empty draft would look
     * like a deal with no lines, and saving it would then DELETE the real ones, because the operation
     * treats a present array as the complete desired set.
     */
    public async LoadDraft(dealID: string): Promise<DealDraft | null> {
        const rv = new RunView();
        const results = await rv.RunViews([
            { EntityName: E_DEAL, ExtraFilter: `ID = '${dealID}'`, ResultType: 'simple' },
            { EntityName: E_DEAL_LINE, ExtraFilter: `DealID = '${dealID}'`, OrderBy: 'DisplayOrder ASC', ResultType: 'simple' },
            { EntityName: E_SCHEDULE, ExtraFilter: `DealID = '${dealID}'`, OrderBy: 'DisplayOrder ASC', ResultType: 'simple' },
        ]);

        if (!results?.[0]?.Success || !results[1]?.Success || !results[2]?.Success) {
            return null;
        }
        const deal = ((results[0].Results ?? []) as DealRow[])[0];
        if (!deal) {
            return null;
        }

        const draft = new DealDraft({
            ID: deal.ID,
            Name: deal.Name,
            PipelineID: deal.PipelineID,
            PipelineStageID: deal.PipelineStageID,
            DealTypeID: deal.DealTypeID,
            DealStatusTypeID: deal.DealStatusTypeID,
            AccountID: deal.AccountID,
            PrimaryContactID: deal.PrimaryContactID,
            BillingContactID: deal.BillingContactID,
            CompanyID: deal.CompanyID,
            OwnerEmployeeID: deal.OwnerEmployeeID,
            Amount: deal.Amount,
            TermMonths: deal.TermMonths,
            EstimatedProjectWeeks: deal.EstimatedProjectWeeks,
            ExecutionDate: toDateInput(deal.ExecutionDate),
            StartDate: toDateInput(deal.StartDate),
            ExpectedCloseDate: toDateInput(deal.ExpectedCloseDate),
            Probability: deal.Probability,
            ForecastCategoryTypeID: deal.ForecastCategoryTypeID,
            AutoRenew: deal.AutoRenew === true,
            AnnualIncreasePctOverride: deal.AnnualIncreasePctOverride,
            CancellationNoticeDaysOverride: deal.CancellationNoticeDaysOverride,
            PaymentMethod: deal.PaymentMethod,
            ContractVariances: deal.ContractVariances,
            Description: deal.Description,
            NextStep: deal.NextStep,
            NextStepDate: toDateInput(deal.NextStepDate),
        });

        for (const line of (results[1].Results ?? []) as DealLineRow[]) {
            draft.AddLine({
                ID: line.ID,
                ProductID: line.ProductID,
                ProductName: line.ProductName,
                DealLineTypeID: line.DealLineTypeID,
                Quantity: line.Quantity,
                RequestedDiscountPct: line.RequestedDiscountPct,
                OverrideUnitPrice: line.OverrideUnitPrice,
                AnnualGrossFees: line.AnnualGrossFees,
                DiscountAmount: line.DiscountAmount,
                Total: line.Total,
                TermMonths: line.TermMonths,
                ServicePeriodStart: toDateInput(line.ServicePeriodStart),
                ServicePeriodEnd: toDateInput(line.ServicePeriodEnd),
                Description: line.Description,
            });
        }

        for (const row of (results[2].Results ?? []) as ScheduleRow[]) {
            draft.AddScheduleRow({
                ID: row.ID,
                PaymentDate: toDateInput(row.PaymentDate),
                Amount: row.Amount,
                Description: row.Description,
            });
        }

        return draft;
    }

    /**
     * Sends the whole draft through `Sales.SaveDeal` — one transactional call, all-or-none.
     *
     * A draft the server refuses comes back as `Success: false` WITH issues, which is an ordinary
     * outcome and not an error. Only a transport or auth failure produces `ErrorMessage`.
     */
    public async Save(draft: DealDraft): Promise<DealSaveOutcome> {
        try {
            const op = new SalesSaveDealOperation();
            const result = await op.Execute(draft.ToSaveInput());
            const output = result?.Output;

            if (!output) {
                return {
                    Success: false, DealID: null, Created: false, Issues: [],
                    ErrorMessage: result?.ErrorMessage ?? 'The deal could not be saved.',
                };
            }

            if (output.Success) {
                // Fold the server's IDs back into the SAME draft instance, so the surface keeps editing
                // the record it just created instead of a rebuilt copy.
                draft.ApplySaveResult(output);
            }

            return {
                Success: output.Success === true,
                DealID: output.DealID ?? null,
                Created: output.Created === true,
                Issues: output.Issues ?? [],
                ErrorMessage: null,
            };
        } catch (err) {
            return {
                Success: false, DealID: null, Created: false, Issues: [],
                ErrorMessage: err instanceof Error ? err.message : String(err),
            };
        }
    }
}
