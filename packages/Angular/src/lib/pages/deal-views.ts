/**
 * @fileoverview Named-view helpers for Deal grids.
 *
 * `mj-entity-viewer` reads columns from `UserView.GridState`, falling back to
 * `EntityField.DefaultInView`. The inspect strip and All Deals both bind a view
 * named {@link SALES_PIPELINE_VIEW_NAME} so column order, currency, and status
 * colour live in one place — metadata when pushed, this fallback until then.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { BaseEntity, CompositeKey, Metadata, RunView } from '@memberjunction/core';
import type { EntityInfo } from '@memberjunction/core';
import type { MJUserViewEntityExtended } from '@memberjunction/core-entities';
import type { ViewRelatedRecordNavigation } from '@memberjunction/ng-entity-viewer';
import { MJS_ENTITIES } from '../data/entity-names';
import type { PeriodWindow } from './dashboard-period';
import { GRID_DAY_FORMAT } from './dashboard-dates';
import { InspectDateBounds, NO_OWNER_ARG, PERIOD_BOUND_KEYS, type InspectKey } from './dashboard-inspect';
import { NO_FILTERS, type DashboardFilters } from './dashboard-filters';

export const SALES_PIPELINE_VIEW_NAME = 'Sales: Pipeline';

type GridCol = {
    Name: string;
    DisplayName: string;
    orderIndex: number;
    width: number;
    pinned?: 'left' | 'right' | null;
    hidden?: boolean;
    format?: Record<string, unknown>;
};

export function DealPipelineGridState(): { sortSettings: { field: string; dir: 'asc' | 'desc' }[]; columnSettings: GridCol[] } {
    return {
        // Matches the saved view: open deals (no ClosedAt) first, then Expected Close (bizapps-sales#371).
        sortSettings: [{ field: 'ClosedAt', dir: 'asc' }, { field: 'ExpectedCloseDate', dir: 'asc' }],
        columnSettings: [
            { Name: 'Name', DisplayName: 'Deal', orderIndex: 0, width: 260, pinned: 'left' },
            { Name: 'DealNumber', DisplayName: 'Number', orderIndex: 1, width: 120 },
            { Name: 'Account', DisplayName: 'Customer', orderIndex: 2, width: 180 },
            { Name: 'Pipeline', DisplayName: 'Pipeline', orderIndex: 3, width: 140 },
            { Name: 'PipelineStage', DisplayName: 'Stage', orderIndex: 4, width: 130 },
            {
                Name: 'DealStatusType', DisplayName: 'Status', orderIndex: 5, width: 110,
                format: {
                    type: 'text',
                    conditionalRules: [
                        { condition: 'contains', value: 'Won', style: { color: '#047857', backgroundColor: '#d1fae5', bold: true } },
                        { condition: 'contains', value: 'Lost', style: { color: '#b45309', backgroundColor: '#fef3c7' } },
                        { condition: 'equals', value: 'Open', style: { color: '#1d4ed8', backgroundColor: '#dbeafe' } },
                    ],
                },
            },
            { Name: 'Amount', DisplayName: 'Amount', orderIndex: 6, width: 120, format: { type: 'currency', currencyCode: 'USD', decimals: 0, align: 'right' } },
            // Stored as 0-100; the grid's percent format divides by 100, so 40 renders "40%" (bizapps-sales#371).
            { Name: 'Probability', DisplayName: 'Prob', orderIndex: 7, width: 80, format: { type: 'percent', decimals: 0, align: 'right' } },
            /**
             * TWO DATE COLUMNS, because a grid column binds one field (bizapps-sales#371). A single "Close"
             * column showed the forecast day even on a won or lost deal. "Expected close" is the forecast;
             * "Closed on" is the day a closed deal closed and is empty on an open one.
             */
            { Name: 'ExpectedCloseDate', DisplayName: 'Expected close', orderIndex: 8, width: 130, format: { type: 'date', dateFormat: GRID_DAY_FORMAT } },
            { Name: 'ActualCloseDate', DisplayName: 'Closed on', orderIndex: 9, width: 120, format: { type: 'date', dateFormat: GRID_DAY_FORMAT } },
            { Name: 'OwnerEmployee', DisplayName: 'Owner', orderIndex: 10, width: 140 },
            { Name: 'ForecastCategoryType', DisplayName: 'Forecast', orderIndex: 11, width: 130 },
            { Name: 'NextStep', DisplayName: 'Next step', orderIndex: 12, width: 200 },
            /**
             * Hidden, and here only because it is the first sort key (bizapps-sales#371). The grid can
             * show a sort only on one of its columns; with ClosedAt missing, its sort never matched
             * the saved one, it reported the difference as a user's sort, and the viewer then re-sorted
             * by Expected close and rebuilt the columns with the entity's own headers.
             */
            { Name: 'ClosedAt', DisplayName: 'Closed at', orderIndex: 13, width: 120, hidden: true },
        ],
    };
}

export function DealActivityGridState(): { sortSettings: { field: string; dir: 'asc' | 'desc' }[]; columnSettings: GridCol[] } {
    return {
        sortSettings: [{ field: 'StartedAt', dir: 'desc' }],
        columnSettings: [
            { Name: 'StartedAt', DisplayName: 'When', orderIndex: 0, width: 160, format: { type: 'datetime', dateFormat: GRID_DAY_FORMAT } },
            { Name: 'ActivityType', DisplayName: 'Type', orderIndex: 1, width: 110 },
            { Name: 'Title', DisplayName: 'Subject', orderIndex: 2, width: 280, pinned: 'left' },
            { Name: 'Direction', DisplayName: 'Direction', orderIndex: 3, width: 90 },
            { Name: 'Status', DisplayName: 'Status', orderIndex: 4, width: 110 },
            { Name: 'SourceSystem', DisplayName: 'Source', orderIndex: 5, width: 120 },
        ],
    };
}

/**
 * Read the shared pipeline view once. Falls back to an in-memory view with the same GridState when the
 * metadata row is not pushed yet.
 *
 * ── ONE READ, MANY GRIDS (bizapps-sales#261) ────────────────────────────────────────────────────
 *
 * The inspect strip and All Deals each used to read this view by name, one after the other, after
 * every other read on the section had finished, and the inspect strip read it again on every slice
 * click. The view does not change between those reads, so the caller reads it once and gives each grid
 * its own copy through {@link DealPipelineViewWith}, which costs no round trip.
 */
export async function LoadDealPipelineViewTemplate(entity: EntityInfo): Promise<MJUserViewEntityExtended> {
    const named = await loadViewByName(SALES_PIPELINE_VIEW_NAME);
    if (named) {
        return named;
    }
    const grid = DealPipelineGridState();
    return {
        EntityID: entity.ID,
        Entity: entity.Name,
        Name: SALES_PIPELINE_VIEW_NAME,
        WhereClause: '',
        GridState: JSON.stringify(grid),
        GridStateObject: grid,
        OrderByClause: 'ClosedAt ASC, ExpectedCloseDate ASC',
    } as unknown as MJUserViewEntityExtended;
}

/**
 * A copy of `template` with `whereClause` overlaid, never saved. With no clause the copy keeps the
 * template's own.
 *
 * A COPY, not the template itself: each grid re-runs when its `ViewEntity` changes identity, and two
 * grids holding one object would share one WhereClause. The saved view is copied through
 * `LoadFromData`, which reads nothing from the server.
 */
export async function DealPipelineViewWith(
    template: MJUserViewEntityExtended,
    whereClause?: string,
): Promise<MJUserViewEntityExtended> {
    // The fallback view is a plain object typed as the entity, so the type system cannot see this branch.
    const copy = template instanceof BaseEntity
        ? await copyEntity(template)
        : ({ ...(template as object) } as MJUserViewEntityExtended);
    if (whereClause != null) {
        copy.WhereClause = whereClause;
    }
    return copy;
}

async function copyEntity(template: MJUserViewEntityExtended): Promise<MJUserViewEntityExtended> {
    const copy = await new Metadata().GetEntityObject<MJUserViewEntityExtended>('MJ: User Views');
    await copy.LoadFromData(template.GetAll());
    return copy;
}

export function SyntheticActivityView(entity: EntityInfo, whereClause: string): MJUserViewEntityExtended {
    const grid = DealActivityGridState();
    return {
        EntityID: entity.ID,
        Entity: entity.Name,
        Name: 'Deal activities',
        WhereClause: whereClause,
        GridState: JSON.stringify(grid),
        GridStateObject: grid,
        OrderByClause: 'StartedAt DESC',
    } as unknown as MJUserViewEntityExtended;
}

async function loadViewByName(name: string): Promise<MJUserViewEntityExtended | null> {
    // One round trip: the row comes back as the entity object, rather than an ID to `Load` afterwards.
    const rv = new RunView();
    const found = await rv.RunView<MJUserViewEntityExtended>({
        EntityName: 'MJ: User Views',
        ExtraFilter: `Name = '${name.replace(/'/g, "''")}'`,
        MaxRows: 1,
        ResultType: 'entity_object',
    });
    return found.Success ? (found.Results?.[0] ?? null) : null;
}

export function DealInListWhere(ids: readonly string[]): string {
    const clean = ids.filter(Boolean);
    if (!clean.length) return '1 = 0';
    return `ID IN (${clean.map((id) => `'${id.replace(/'/g, "''")}'`).join(',')})`;
}

const sqlString = (value: string): string => `'${value.replace(/'/g, "''")}'`;
const sqlList = (values: readonly string[]): string => `(${values.map(sqlString).join(', ')})`;

/** An entity's schema and base view, read from metadata so no schema name is hardcoded here. MJAPI accepts a subquery only on a base view. */
export interface SqlTable {
    SchemaName: string;
    BaseView: string;
}

const tableRef = (t: SqlTable): string => `[${t.SchemaName}].[${t.BaseView}]`;

/** The tables an Inspect filter reads flags and product companies from. */
export interface InspectTables {
    Status: SqlTable;
    Pipeline: SqlTable;
    Forecast: SqlTable;
    /** Orders' order lines, for the Product company filter. Needed only while that filter is set. */
    OrderLine?: SqlTable | null;
}

/** What narrows an Inspect list beside its own slice: the period, the filter bar, and an argument. */
export interface InspectScope {
    /** The selected period. Applied only to the keys in `PERIOD_BOUND_KEYS`. */
    Window?: PeriodWindow;
    Filters?: DashboardFilters;
    /** The stage ID for `stage`; the owner's employee ID, or `NO_OWNER_ARG`, for `owner`. */
    Arg?: string | null;
}

/** The Inspect slices {@link InspectCriteriaWhere} expresses as criteria. `idle` is a list of IDs. */
export type CriteriaInspectKey = Exclude<InspectKey, 'idle'>;

/**
 * The filter bar's lists as criteria on the Deals view, the same rule each dashboard query applies.
 * Product company keeps a deal when one line of its order belongs to a selected company.
 */
function filterParts(filters: DashboardFilters, tables: InspectTables): string[] {
    const parts: string[] = [];
    if (filters.CompanyIDs.length) parts.push(`CompanyID IN ${sqlList(filters.CompanyIDs)}`);
    if (filters.OwnerEmployeeIDs.length) parts.push(`OwnerEmployeeID IN ${sqlList(filters.OwnerEmployeeIDs)}`);
    if (filters.PipelineIDs.length) parts.push(`PipelineID IN ${sqlList(filters.PipelineIDs)}`);
    if (filters.ProductCompanyIDs.length) {
        // Without the order-line table no deal can be shown to match, so the list says so by matching
        // none rather than ignoring the filter and listing deals the figure did not count.
        parts.push(tables.OrderLine
            ? `OrderID IN (SELECT OrderHeaderID FROM ${tableRef(tables.OrderLine)} WHERE CompanyID IN ${sqlList(filters.ProductCompanyIDs)})`
            : '1 = 0');
    }
    return parts;
}

/** `column` inside the window. A null bound is no bound; a NULL date fails a bounded window. */
function windowParts(column: string, window: PeriodWindow | undefined): string[] {
    const parts: string[] = [];
    if (window?.Start) parts.push(`${column} >= ${sqlString(window.Start)}`);
    if (window?.End) parts.push(`${column} <= ${sqlString(window.End)}`);
    return parts;
}

/**
 * An Inspect slice as a filter on the Deals view, built from the slice's own criteria (bizapps-sales#449).
 *
 * Each case is the server-side form of the same case in `FilterInspect` and of the matching column in
 * `dashboard-summary.sql` / `win-rate.sql`, so the grid lists the deals the figure counted:
 *
 *  - open slices are OPEN deals (the status's `IsOpen` flag) in pipelines that count toward the forecast
 *    (`Pipeline.IncludeInForecast`), unless the Pipeline filter names pipelines, which includes them;
 *  - forecast slices read the category's `IncludeInCommit` / `IncludeInBestCase` / `IncludeInPipeline`
 *    flags; a deal with no category counts toward the pipeline, as the roster's `ISNULL(…, 1)` does;
 *  - the period bounds open slices on `ExpectedCloseDate` and `won` / `closed` on `ActualCloseDate`
 *    (bc-aidp-next-golive#350). The attention slices and `closing` ignore it;
 *  - date buckets compare `ExpectedCloseDate` with the same business-day bounds the buckets use;
 *  - the filter bar's lists narrow every slice.
 */
export function InspectCriteriaWhere(
    key: CriteriaInspectKey,
    tables: InspectTables,
    today: string,
    scope: InspectScope = {},
): string {
    const filters = scope.Filters ?? NO_FILTERS;
    const bounded = PERIOD_BOUND_KEYS.includes(key) ? scope.Window : undefined;
    const status = (flag: string): string => `DealStatusTypeID IN (SELECT ID FROM ${tableRef(tables.Status)} WHERE ${flag} = 1)`;
    if (key === 'won' || key === 'closed') {
        return [status(key === 'won' ? 'IsWon' : 'IsClosed'), ...windowParts('ActualCloseDate', bounded), ...filterParts(filters, tables)].join(' AND ');
    }
    const open = [
        status('IsOpen'),
        // Naming pipelines in the filter includes them, as the summary query's PipelineIDs does.
        ...(filters.PipelineIDs.length ? [] : [`PipelineID IN (SELECT ID FROM ${tableRef(tables.Pipeline)} WHERE IncludeInForecast = 1)`]),
    ];
    return [...open, ...sliceParts(key, tables, today, scope.Arg ?? null), ...windowParts('ExpectedCloseDate', bounded), ...filterParts(filters, tables)]
        .join(' AND ');
}

/** The criteria one open slice adds to "open, in the forecast". */
function sliceParts(key: Exclude<CriteriaInspectKey, 'won' | 'closed'>, tables: InspectTables, today: string, arg: string | null): string[] {
    const category = (flags: string): string => `ForecastCategoryTypeID IN (SELECT ID FROM ${tableRef(tables.Forecast)} WHERE ${flags})`;
    const notCategory = (flags: string): string =>
        `(ForecastCategoryTypeID IS NULL OR ForecastCategoryTypeID NOT IN (SELECT ID FROM ${tableRef(tables.Forecast)} WHERE ${flags}))`;
    const inPipeline = notCategory('IncludeInPipeline = 0');
    const bounds = InspectDateBounds(today);
    switch (key) {
        case 'closing':
            return [`ExpectedCloseDate >= ${sqlString(today)}`, `ExpectedCloseDate <= ${sqlString(bounds.ClosingEnd)}`];
        case 'commit':
            return [inPipeline, category('IncludeInCommit = 1')];
        case 'best':
            return [inPipeline, notCategory('IncludeInCommit = 1'), category('IncludeInBestCase = 1')];
        case 'pipe':
        case 'weighted':
            return [inPipeline];
        case 'remainder':
            return [notCategory('IncludeInPipeline = 0 OR IncludeInCommit = 1 OR IncludeInBestCase = 1')];
        case 'slipped':
            return ['ExpectedCloseDate IS NOT NULL', `ExpectedCloseDate < ${sqlString(today)}`];
        case 'noowner':
            return ['OwnerEmployeeID IS NULL'];
        case 'nodate':
            return ['ExpectedCloseDate IS NULL'];
        case 'week':
            return [`ExpectedCloseDate >= ${sqlString(today)}`, `ExpectedCloseDate <= ${sqlString(bounds.WeekEnd)}`];
        case 'month':
            return [`ExpectedCloseDate > ${sqlString(bounds.WeekEnd)}`, `ExpectedCloseDate <= ${sqlString(bounds.MonthEnd)}`];
        case 'later':
            return [`ExpectedCloseDate > ${sqlString(bounds.LaterFrom)}`];
        case 'stage':
            return stageParts(arg);
        case 'owner':
            return [
                inPipeline,
                category('IncludeInCommit = 1'),
                !arg || arg === NO_OWNER_ARG ? 'OwnerEmployeeID IS NULL' : `OwnerEmployeeID = ${sqlString(arg)}`,
            ];
    }
}

/** A `stage` argument as criteria: a stage ID, or `unstaged:<pipeline ID>` for that pipeline's unstaged deals. */
function stageParts(arg: string | null): string[] {
    if (!arg || arg.toLowerCase().startsWith('unstaged')) {
        const pipeline = (arg ?? '').slice('unstaged:'.length);
        return ['PipelineStageID IS NULL', ...(pipeline ? [`PipelineID = ${sqlString(pipeline)}`] : [])];
    }
    return [`PipelineStageID = ${sqlString(arg)}`];
}

/**
 * The deals the Won tile counts, as a filter on the Deals view (bizapps-sales#209).
 *
 * The same predicate as `WonCount` in `dashboard-summary.sql`: the status's `IsWon` FLAG, and
 * `ActualCloseDate` inside the window when it has bounds. `ActualCloseDate` is a DATE column, so
 * `<= End` includes every deal won on the last day. With no bounds ("All time") every won deal matches,
 * including one with no close date; with bounds such a deal does not. A thin wrapper over
 * {@link InspectCriteriaWhere}'s `won` case, kept for its callers.
 */
export function DealWonInPeriodWhere(
    statusTable: SqlTable,
    window?: PeriodWindow,
    filters: DashboardFilters = NO_FILTERS,
    orderLineTable: SqlTable | null = null,
): string {
    const tables: InspectTables = { Status: statusTable, Pipeline: statusTable, Forecast: statusTable, OrderLine: orderLineTable };
    return InspectCriteriaWhere('won', tables, '', { Window: window, Filters: filters });
}

/**
 * The record behind a grid's linked cell, or null when it cannot be opened.
 *
 * `mj-entity-viewer` does not open a linked cell's record itself: it emits `OpenRelatedRecordRequested`
 * and leaves routing to the host. This is the resolution MJ's own Explorer hosts do: the related entity
 * can be any entity, so the key is read against its metadata rather than assumed to be `ID`. An entity
 * this host does not know, or a missing key, is not a click that can be honoured.
 */
export function RelatedRecordTarget(
    nav: ViewRelatedRecordNavigation | null | undefined,
): { EntityName: string; Key: CompositeKey } | null {
    if (!nav?.entityName || nav.recordKey === null || nav.recordKey === undefined || nav.recordKey === '') {
        return null;
    }
    const entity = new Metadata().Entities.find((e) => e.Name === nav.entityName);
    if (!entity) {
        return null;
    }
    return { EntityName: entity.Name, Key: CompositeKey.FromURLSegment(entity, String(nav.recordKey)) };
}

export { MJS_ENTITIES };
