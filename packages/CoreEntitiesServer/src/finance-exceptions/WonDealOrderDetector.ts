/**
 * Nightly detector for finance exception type 3, WON_DEAL_ORDER_NOT_CONFIRMED (golive #279).
 *
 * A deal closed Won whose order is missing or never confirmed is never billed. The saved query
 * `Sales: Won Deals With Unconfirmed Orders` finds them; this raises one finance exception per deal
 * through accounting, keyed on the deal so a deal found again tomorrow is not raised twice.
 *
 * The threshold (`MinDaysSinceClose`) is read from the exception type's Configuration in accounting.
 * A missing or inactive type means the check is switched off, and the run skips. It never falls back
 * to a default of its own.
 */
import { LogStatus, RunQuery, RunView, type IMetadataProvider, type RunViewParams, type UserInfo } from '@memberjunction/core';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';
import {
    DescribeFinanceExceptionErrors,
    GetFinanceExceptionTypes,
    RaiseFinanceExceptions,
    type FinanceExceptionToRaise,
    type FinanceExceptionTypeInfo,
    type RaiseFinanceExceptionsOutput,
} from './FinanceExceptionBridge.js';

export const WON_DEAL_ORDER_NOT_CONFIRMED = 'WON_DEAL_ORDER_NOT_CONFIRMED';
export const WON_DEALS_QUERY_NAME = 'Sales: Won Deals With Unconfirmed Orders';
export const WON_DEALS_QUERY_CATEGORY = 'Sales';
export const DEAL_ENTITY_NAME = 'MJ_BizApps_Sales: Deals';
const USER_ENTITY_NAME = 'MJ: Users';
/** Keeps each user lookup's IN list well inside SQL Server's parameter and statement limits. */
const USER_LOOKUP_CHUNK = 500;
const SUMMARY_MAX = 1000;

export type WonDealDetectionOutcome =
    | 'RAISED'
    | 'NONE_FOUND'
    | 'SKIPPED'
    | 'TYPES_UNREADABLE'
    | 'CONFIG_INVALID'
    | 'QUERY_FAILED'
    | 'USER_LOOKUP_FAILED'
    | 'RAISE_FAILED';

export interface WonDealDetectionResult {
    Success: boolean;
    Outcome: WonDealDetectionOutcome;
    /** Deals the query returned. */
    Found: number;
    /** Exceptions accounting created on this run. */
    Created: number;
    /** Deals that already had an exception of this type, in any status. */
    AlreadyRaised: number;
    /** Exceptions accounting skipped, which it does when the type is inactive. */
    SkippedByAccounting: number;
    /** Deals whose owner has no single linked login. */
    CreatorUnresolved: number;
    Issues: string[];
}

/** One query row, read defensively: a provider can hand back a number as a string. */
interface WonDealRow {
    DealID: string;
    DealNumber: string | null;
    CompanyID: string;
    OwnerEmployeeID: string | null;
    OwnerName: string | null;
    CloseDate: string | null;
    DaysSinceClose: number | null;
    DealAmount: number | null;
    OrderID: string | null;
    OrderStatus: string | null;
}

/** The owner's login, or why there is not exactly one. */
interface CreatorResolution {
    UserID: string | null;
    Unresolved: boolean;
    LinkedLogins: number;
}

function emptyResult(outcome: WonDealDetectionOutcome, success: boolean, issue?: string): WonDealDetectionResult {
    return {
        Success: success,
        Outcome: outcome,
        Found: 0,
        Created: 0,
        AlreadyRaised: 0,
        SkippedByAccounting: 0,
        CreatorUnresolved: 0,
        Issues: issue ? [issue] : [],
    };
}

function text(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }
    const s = String(value).trim();
    return s === '' ? null : s;
}

function numberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function dayText(value: unknown): string | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
    }
    const s = text(value);
    return s ? s.slice(0, 10) : null;
}

/** GUIDs compare case-insensitively; SQL Server returns upper case, JavaScript callers often lower. */
function idKey(id: string): string {
    return id.trim().toLowerCase();
}

/** The threshold from the type's Configuration, or null when it is absent or not a whole non-negative number. */
export function ReadMinDaysSinceClose(type: FinanceExceptionTypeInfo): number | null {
    const raw = type.Configuration?.MinDaysSinceClose;
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
    return Number.isInteger(n) && n >= 0 ? n : null;
}

export function ReadWonDealRow(raw: Record<string, unknown>): WonDealRow | null {
    const dealID = text(raw.DealID);
    const companyID = text(raw.CompanyID);
    if (!dealID || !companyID) {
        return null;
    }
    return {
        DealID: dealID,
        DealNumber: text(raw.DealNumber),
        CompanyID: companyID,
        OwnerEmployeeID: text(raw.OwnerEmployeeID),
        OwnerName: text(raw.OwnerName),
        CloseDate: dayText(raw.CloseDate),
        DaysSinceClose: numberOrNull(raw.DaysSinceClose),
        DealAmount: numberOrNull(raw.DealAmount),
        OrderID: text(raw.OrderID),
        OrderStatus: text(raw.OrderStatus),
    };
}

/**
 * Plain description of the defect in the data: the deal number, never the deal or account name.
 * When the owner's login cannot be resolved the owner is named, because accounting shows this
 * summary when it refuses to clear the row, and whoever sees it needs to know whose login to link.
 */
export function BuildWonDealSummary(row: WonDealRow, creator: CreatorResolution): string {
    const deal = row.DealNumber ? `Deal ${row.DealNumber}` : `Deal ${row.DealID}`;
    const closed = row.CloseDate
        ? ` closed Won on ${row.CloseDate}${row.DaysSinceClose === null ? '' : ` (${row.DaysSinceClose} days ago)`}`
        : ' closed Won';
    const order = !row.OrderID
        ? 'has no order'
        : row.OrderStatus
          ? `has an order that is ${row.OrderStatus}, not Confirmed`
          : 'has an order that could not be read';
    let summary = `${deal}${closed} and ${order}, so it will not be billed.`;
    const owner = row.OwnerName ? `The deal owner, ${row.OwnerName},` : 'The deal owner';
    if (creator.LinkedLogins > 1) {
        summary += ` ${owner} is linked to ${creator.LinkedLogins} logins, so the creator could not be resolved to one; `
            + 'leave exactly one login linked to their employee record.';
    } else if (creator.Unresolved) {
        summary += ` ${owner} has no linked login; link their employee record to their login.`;
    }
    return summary.length > SUMMARY_MAX ? `${summary.slice(0, SUMMARY_MAX - 1)}…` : summary;
}

/** Read the type; a null result with an outcome means the run stops there. */
async function readType(
    provider: IMetadataProvider,
    user: UserInfo,
): Promise<{ Threshold: number } | WonDealDetectionResult> {
    const types = await GetFinanceExceptionTypes({ Codes: [WON_DEAL_ORDER_NOT_CONFIRMED] }, provider, user);
    if (!types.Success) {
        return emptyResult(
            'TYPES_UNREADABLE',
            false,
            `Accounting could not read the finance exception types. ${DescribeFinanceExceptionErrors(types.Errors)}`,
        );
    }
    const type = (types.Types ?? []).find((t) => t.Code === WON_DEAL_ORDER_NOT_CONFIRMED);
    if (!type || !type.IsActive) {
        const why = !type ? 'does not exist' : 'is inactive';
        const message = `Finance exception type ${WON_DEAL_ORDER_NOT_CONFIRMED} ${why}; the won-deal check was skipped.`;
        LogStatus(message);
        return emptyResult('SKIPPED', true, message);
    }
    const threshold = ReadMinDaysSinceClose(type);
    if (threshold === null) {
        return emptyResult(
            'CONFIG_INVALID',
            false,
            `Finance exception type ${WON_DEAL_ORDER_NOT_CONFIRMED} has no usable MinDaysSinceClose in its `
                + 'Configuration (a whole number of days, 0 or more). Nothing was checked.',
        );
    }
    return { Threshold: threshold };
}

async function runQuery(
    threshold: number,
    user: UserInfo,
): Promise<{ Rows: WonDealRow[]; Issues: string[] } | WonDealDetectionResult> {
    const result = await new RunQuery().RunQuery(
        {
            QueryName: WON_DEALS_QUERY_NAME,
            CategoryPath: WON_DEALS_QUERY_CATEGORY,
            Parameters: { MinDaysSinceClose: threshold },
        },
        user,
    );
    if (!result?.Success) {
        return emptyResult(
            'QUERY_FAILED',
            false,
            `The query '${WON_DEALS_QUERY_NAME}' did not run: ${result?.ErrorMessage ?? 'unknown error'}`,
        );
    }
    const rows: WonDealRow[] = [];
    const issues: string[] = [];
    for (const raw of result.Results ?? []) {
        const row = ReadWonDealRow(raw as Record<string, unknown>);
        if (row) {
            rows.push(row);
        } else {
            issues.push('A query row carried no DealID or CompanyID and was not raised.');
        }
    }
    return { Rows: rows, Issues: issues };
}

/**
 * Every login linked to each owner, in one batched lookup (chunked only to bound the IN list).
 * Returns a map from employee key to the linked user IDs, or an error message.
 */
export async function LoadLoginsByEmployee(
    employeeIDs: string[],
    user: UserInfo,
): Promise<Map<string, string[]> | string> {
    const unique = [...new Map(employeeIDs.map((id) => [idKey(id), id])).values()];
    const byEmployee = new Map<string, string[]>();
    if (unique.length === 0) {
        return byEmployee;
    }
    const params: RunViewParams[] = [];
    for (let i = 0; i < unique.length; i += USER_LOOKUP_CHUNK) {
        const list = unique
            .slice(i, i + USER_LOOKUP_CHUNK)
            .map((id) => `'${id.replace(/'/g, "''")}'`)
            .join(',');
        params.push({
            EntityName: USER_ENTITY_NAME,
            ExtraFilter: `EmployeeID IN (${list})`,
            Fields: ['ID', 'EmployeeID'],
            ResultType: 'simple',
        });
    }
    const results = await new RunView().RunViews(params, user);
    for (const r of results) {
        if (!r.Success) {
            return `The owner login lookup failed: ${r.ErrorMessage ?? 'unknown error'}`;
        }
        for (const u of (r.Results ?? []) as Array<{ ID: string; EmployeeID: string | null }>) {
            if (!u.EmployeeID) {
                continue;
            }
            const key = idKey(u.EmployeeID);
            byEmployee.set(key, [...(byEmployee.get(key) ?? []), u.ID]);
        }
    }
    return byEmployee;
}

export function ResolveCreator(ownerEmployeeID: string | null, logins: Map<string, string[]>): CreatorResolution {
    if (!ownerEmployeeID) {
        return { UserID: null, Unresolved: false, LinkedLogins: 0 };
    }
    const linked = logins.get(idKey(ownerEmployeeID)) ?? [];
    if (linked.length === 1) {
        return { UserID: linked[0], Unresolved: false, LinkedLogins: 1 };
    }
    return { UserID: null, Unresolved: true, LinkedLogins: linked.length };
}

function buildException(row: WonDealRow, creator: CreatorResolution, today: string): FinanceExceptionToRaise {
    return {
        TypeCode: WON_DEAL_ORDER_NOT_CONFIRMED,
        SourceEntityName: DEAL_ENTITY_NAME,
        SourceRecordID: row.DealID,
        CompanyID: row.CompanyID,
        Amount: row.DealAmount,
        ExceptionDate: today,
        Summary: BuildWonDealSummary(row, creator),
        DedupeKey: row.DealID,
        SourceCreatedByUserID: creator.UserID,
        CreatorUnresolved: creator.Unresolved,
    };
}

/** Fold accounting's answer into the run's tallies. Errors are named by deal, not by array index. */
function applyRaiseOutput(
    result: WonDealDetectionResult,
    output: RaiseFinanceExceptionsOutput,
    rows: WonDealRow[],
): WonDealDetectionResult {
    if (!output.Success) {
        const detail = (output.Errors ?? [])
            .map((e) => {
                const row = e.Index === undefined ? undefined : rows[e.Index];
                return `${row ? `deal ${row.DealNumber ?? row.DealID}: ` : ''}${e.Code}: ${e.Message}`;
            })
            .join('; ');
        return {
            ...result,
            Success: false,
            Outcome: 'RAISE_FAILED',
            Issues: [...result.Issues, `Accounting refused the batch and wrote nothing. ${detail || 'No detail given.'}`],
        };
    }
    for (const r of output.Results ?? []) {
        if (r.Skipped) {
            result.SkippedByAccounting++;
        } else if (r.Created) {
            result.Created++;
        } else {
            result.AlreadyRaised++;
        }
    }
    return { ...result, Success: true, Outcome: 'RAISED' };
}

/**
 * Detect won deals with unconfirmed orders and raise one finance exception per deal.
 * Throws only when accounting's operations are not registered or do not execute.
 */
export async function DetectWonDealsWithUnconfirmedOrders(
    provider: IMetadataProvider,
    user: UserInfo,
): Promise<WonDealDetectionResult> {
    const type = await readType(provider, user);
    if ('Outcome' in type) {
        return type;
    }
    const query = await runQuery(type.Threshold, user);
    if ('Outcome' in query) {
        return query;
    }
    const result: WonDealDetectionResult = { ...emptyResult('NONE_FOUND', true), Found: query.Rows.length, Issues: query.Issues };
    if (query.Rows.length === 0) {
        return result;
    }

    const owners = query.Rows.map((r) => r.OwnerEmployeeID).filter((id): id is string => id !== null);
    const logins = await LoadLoginsByEmployee(owners, user);
    if (typeof logins === 'string') {
        return { ...result, Success: false, Outcome: 'USER_LOOKUP_FAILED', Issues: [...result.Issues, logins] };
    }

    await BusinessTimeZoneEngine.Instance.Config(false, user, provider);
    const exceptions = query.Rows.map((row) => {
        const creator = ResolveCreator(row.OwnerEmployeeID, logins);
        if (creator.Unresolved) {
            result.CreatorUnresolved++;
        }
        return buildException(row, creator, BusinessTimeZoneEngine.Instance.Today(row.CompanyID));
    });

    const output = await RaiseFinanceExceptions({ Exceptions: exceptions }, provider, user);
    return applyRaiseOutput(result, output, query.Rows);
}
