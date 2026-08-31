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
import { Metadata, RunView } from '@memberjunction/core';
import type { EntityInfo } from '@memberjunction/core';
import type { MJUserViewEntityExtended } from '@memberjunction/core-entities';
import { MJS_ENTITIES } from '../data/entity-names';

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
 * Load the shared pipeline view, overlaying an optional extra WhereClause without saving.
 * Falls back to an in-memory view with the same GridState when the metadata row is not pushed yet.
 */
export async function LoadDealPipelineView(
    entity: EntityInfo,
    whereClause?: string,
): Promise<MJUserViewEntityExtended> {
    const named = await loadViewByName(SALES_PIPELINE_VIEW_NAME);
    if (named) {
        if (whereClause != null) named.WhereClause = whereClause;
        return named;
    }
    const grid = DealPipelineGridState();
    return {
        EntityID: entity.ID,
        Entity: entity.Name,
        Name: SALES_PIPELINE_VIEW_NAME,
        WhereClause: whereClause ?? '',
        GridState: JSON.stringify(grid),
        GridStateObject: grid,
        OrderByClause: 'ExpectedCloseDate ASC',
    } as unknown as MJUserViewEntityExtended;
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
    const rv = new RunView();
    const found = await rv.RunView<{ ID: string }>({
        EntityName: 'MJ: User Views',
        ExtraFilter: `Name = '${name.replace(/'/g, "''")}'`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
    });
    const id = found.Success ? found.Results?.[0]?.ID : undefined;
    if (!id) return null;
    const md = new Metadata();
    const view = await md.GetEntityObject<MJUserViewEntityExtended>('MJ: User Views');
    const ok = await view.Load(id);
    return ok ? view : null;
}

export function DealInListWhere(ids: readonly string[]): string {
    const clean = ids.filter(Boolean);
    if (!clean.length) return '1 = 0';
    return `ID IN (${clean.map((id) => `'${id.replace(/'/g, "''")}'`).join(',')})`;
}

export { MJS_ENTITIES };
