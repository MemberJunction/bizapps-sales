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
import { BaseEntity, Metadata, RunView } from '@memberjunction/core';
import type { EntityInfo } from '@memberjunction/core';
import type { MJUserViewEntityExtended } from '@memberjunction/core-entities';
import { MJS_ENTITIES } from '../data/entity-names';
import type { PeriodWindow } from './dashboard-period';

export const SALES_PIPELINE_VIEW_NAME = 'Sales: Pipeline';

type GridCol = {
    Name: string;
    DisplayName: string;
    orderIndex: number;
    width: number;
    pinned?: 'left' | 'right' | null;
    format?: Record<string, unknown>;
};

export function DealPipelineGridState(): { sortSettings: { field: string; dir: 'asc' | 'desc' }[]; columnSettings: GridCol[] } {
    return {
        sortSettings: [{ field: 'ExpectedCloseDate', dir: 'asc' }],
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
            { Name: 'Probability', DisplayName: 'Prob', orderIndex: 7, width: 80, format: { type: 'number', decimals: 0, align: 'right' } },
            { Name: 'ExpectedCloseDate', DisplayName: 'Close', orderIndex: 8, width: 120, format: { type: 'date', dateFormat: 'medium' } },
            { Name: 'OwnerEmployee', DisplayName: 'Owner', orderIndex: 9, width: 140 },
            { Name: 'ForecastCategoryType', DisplayName: 'Forecast', orderIndex: 10, width: 130 },
            { Name: 'NextStep', DisplayName: 'Next step', orderIndex: 11, width: 200 },
        ],
    };
}

export function DealActivityGridState(): { sortSettings: { field: string; dir: 'asc' | 'desc' }[]; columnSettings: GridCol[] } {
    return {
        sortSettings: [{ field: 'StartedAt', dir: 'desc' }],
        columnSettings: [
            { Name: 'StartedAt', DisplayName: 'When', orderIndex: 0, width: 160, format: { type: 'datetime', dateFormat: 'medium' } },
            { Name: 'ActivityType', DisplayName: 'Type', orderIndex: 1, width: 110 },
            { Name: 'Title', DisplayName: 'Subject', orderIndex: 2, width: 280, pinned: 'left' },
            { Name: 'Direction', DisplayName: 'Dir', orderIndex: 3, width: 90 },
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
        OrderByClause: 'ExpectedCloseDate ASC',
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

/**
 * The deals the Won tile counts, as a filter on the Deals view (bizapps-sales#209).
 *
 * The same predicate as `WonCount` in `dashboard-summary.sql`: the status's `IsWon` FLAG, and
 * `ActualCloseDate` inside the window when it has bounds. With no bounds ("All time") every won deal
 * matches, including one with no close date; with bounds such a deal does not. Applied on the server,
 * so the list no longer depends on the browser holding every won deal.
 *
 * `statusTable` is the Deal Status Types entity's schema and base table, read from metadata so the
 * schema name is not hardcoded here.
 */
export function DealWonInPeriodWhere(
    statusTable: { SchemaName: string; BaseTable: string },
    window?: PeriodWindow,
): string {
    const parts = [
        `DealStatusTypeID IN (SELECT ID FROM [${statusTable.SchemaName}].[${statusTable.BaseTable}] WHERE IsWon = 1)`,
    ];
    if (window?.Start) parts.push(`ActualCloseDate >= ${sqlString(window.Start)}`);
    if (window?.End) parts.push(`ActualCloseDate <= ${sqlString(window.End)}`);
    return parts.join(' AND ');
}

export { MJS_ENTITIES };
