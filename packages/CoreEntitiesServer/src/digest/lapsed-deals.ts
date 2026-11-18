import { RunView, type UserInfo } from '@memberjunction/core';
import { EscapeSQLString } from '@memberjunction/global';
import { ToCalendarDay, type CalendarDay } from '@mj-biz-apps/common-entities';

import { ComputeDaysLapsed, type LapsedDeal } from './audience.js';
import { DEAL_ENTITY, EMPLOYEE_ENTITY, lower } from './shared.js';

const STATUS_ENTITY = 'MJ_BizApps_Sales: Deal Status Types';
const PIPELINE_ENTITY = 'MJ_BizApps_Sales: Pipelines';

/** The most deals one run reads. Past it the digest says so rather than quietly listing a subset. */
export const MAX_DEALS_PER_RUN = 5000;

/**
 * By company, then close date oldest first, with deals that never had a close date LAST. SQL Server sorts
 * NULLs first, so the CASE puts them after the dated ones, which is also the more useful order: a dated
 * deal is actionable by its age. The same expression sorts the same way on PostgreSQL.
 */
export const ORDER_BY = 'Company, CASE WHEN ExpectedCloseDate IS NULL THEN 1 ELSE 0 END, ExpectedCloseDate';

export interface LapsedDealsResult { Deals: LapsedDeal[]; Truncated: boolean }

interface DealRow {
    ID: string; Name: string; CompanyID: string; Company: string | null;
    OwnerEmployeeID: string | null; Amount: number | null; CurrencyID: string | null; ExpectedCloseDate: unknown; PipelineStage: string | null;
}
interface EmployeeRow { ID: string; FirstName: string; LastName: string }

const quoted = (id: string): string => `'${EscapeSQLString(String(id))}'`;
const inList = (ids: readonly string[]): string => ids.map(quoted).join(', ');

async function readIDs(rv: RunView, entity: string, filter: string, contextUser: UserInfo): Promise<string[]> {
    const r = await rv.RunView<{ ID: string }>({
        EntityName: entity, ExtraFilter: filter, ResultType: 'simple', Fields: ['ID'],
    }, contextUser);
    if (!r.Success) throw new Error(`Could not read ${entity} (${filter}): ${r.ErrorMessage}`);
    return (r.Results ?? []).map((row) => String(row.ID));
}

/**
 * The filter for "open and lapsed". Not closed is `IsClosed = 0` read through the status types, never
 * `IsOpen = 1`: On Hold is neither open nor closed, and it is the status most likely to hold a stale
 * date. A deal with no status counts as not closed. The close-date comparison is strict (`<`): a deal
 * closing today has not lapsed.
 */
function lapsedFilter(notClosedStatusIDs: readonly string[], excludedPipelineIDs: readonly string[], today: CalendarDay): string {
    const status = notClosedStatusIDs.length > 0
        ? `(DealStatusTypeID IS NULL OR DealStatusTypeID IN (${inList(notClosedStatusIDs)}))`
        : '(DealStatusTypeID IS NULL)';
    const clauses = [status];
    if (excludedPipelineIDs.length > 0) clauses.push(`PipelineID NOT IN (${inList(excludedPipelineIDs)})`);
    clauses.push(`(ExpectedCloseDate IS NULL OR ExpectedCloseDate < ${quoted(today)})`);
    return clauses.join(' AND ');
}

/** One batched read of the owners' names. A missing owner reads "Unassigned" rather than failing the run. */
async function readOwnerNames(rv: RunView, rows: readonly DealRow[], contextUser: UserInfo): Promise<Map<string, string>> {
    const ids = [...new Set(rows.map((r) => r.OwnerEmployeeID).filter((id): id is string => !!id).map(String))];
    if (ids.length === 0) return new Map();
    const r = await rv.RunView<EmployeeRow>({
        EntityName: EMPLOYEE_ENTITY, ExtraFilter: `ID IN (${inList(ids)})`,
        ResultType: 'simple', Fields: ['ID', 'FirstName', 'LastName'],
    }, contextUser);
    if (!r.Success) throw new Error(`Could not read the deal owners: ${r.ErrorMessage}`);
    return new Map((r.Results ?? []).map((e) => [lower(String(e.ID)), `${e.FirstName} ${e.LastName}`.trim()]));
}

/**
 * Every open deal whose expected close date is before `today` or was never set, in one read.
 *
 * TRUNCATION IS CHECKED TWO WAYS. Asking for MAX_DEALS_PER_RUN rows is not enough: a `RunView` is also
 * capped by the entity's own UserViewMaxRows (1000 unless changed), so a request for 5000 can return
 * 1000 with no error, and a check against 5000 alone never fires. `TotalRowCount` (a number unless
 * `SkipTotalRowCount` is passed, which this must not) is the count before any cap.
 *
 * Throws when a read fails, so a broken read cannot pass for "nothing lapsed".
 */
export async function LoadLapsedDeals(contextUser: UserInfo, today: CalendarDay): Promise<LapsedDealsResult> {
    const rv = new RunView();
    const notClosedStatusIDs = await readIDs(rv, STATUS_ENTITY, 'IsClosed = 0', contextUser);
    const excludedPipelineIDs = await readIDs(rv, PIPELINE_ENTITY, 'IncludeInForecast = 0', contextUser);

    const filter = lapsedFilter(notClosedStatusIDs, excludedPipelineIDs, today);
    const r = await rv.RunView<DealRow>({
        EntityName: DEAL_ENTITY, ExtraFilter: filter, OrderBy: ORDER_BY,
        ResultType: 'simple', MaxRows: MAX_DEALS_PER_RUN,
        Fields: ['ID', 'Name', 'CompanyID', 'Company', 'OwnerEmployeeID', 'Amount', 'CurrencyID', 'ExpectedCloseDate', 'PipelineStage'],
    }, contextUser);
    if (!r.Success) throw new Error(`Could not read the lapsed deals: ${r.ErrorMessage}`);
    const rows = r.Results ?? [];

    const owners = await readOwnerNames(rv, rows, contextUser);
    const Deals: LapsedDeal[] = rows.map((row) => {
        const closeDate = ToCalendarDay(row.ExpectedCloseDate);
        return {
            ID: String(row.ID), Name: row.Name, CompanyID: String(row.CompanyID), CompanyName: row.Company ?? '',
            OwnerName: owners.get(lower(row.OwnerEmployeeID)) ?? 'Unassigned',
            Amount: row.Amount ?? null, CurrencyID: row.CurrencyID ? String(row.CurrencyID) : null,
            ExpectedCloseDate: closeDate, DaysLapsed: ComputeDaysLapsed(closeDate, today),
            StageName: row.PipelineStage ?? '',
        };
    });

    const capped = typeof r.TotalRowCount === 'number' && r.TotalRowCount > rows.length;
    return { Deals, Truncated: rows.length >= MAX_DEALS_PER_RUN || capped };
}
