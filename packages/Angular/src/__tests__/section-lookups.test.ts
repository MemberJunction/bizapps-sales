import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunView, type RunViewParams, type RunViewResult } from '@memberjunction/core';
import {
    ALL_LOOKUP_KEYS,
    DealWorkspaceService,
    PIPELINE_LIST_FILTER,
    SECTION_LOOKUP_KEYS,
} from '../lib/workspace/deal-workspace.service';

/**
 * bizapps-sales#209: the Sales section loaded every account and every contact on each open, for name
 * pickers only the deal workspace shows. These tests read the entity names the service actually sends
 * to `RunViews`, so a list that creeps back into the section's batch fails here.
 */

const PIPELINES = 'MJ_BizApps_Sales: Pipelines';
const PIPELINE_COMPANIES = 'MJ_BizApps_Sales: Pipeline Companies';

/**
 * One row for an entity. A `PipelineCompany` row links the one pipeline row to one company: a pipeline
 * with no link is left out of the list, so without it the Pipelines list would be empty.
 */
function rowFor(p: RunViewParams): Record<string, string> {
    return p.EntityName === PIPELINE_COMPANIES
        ? { PipelineID: `id-${PIPELINES}`, CompanyID: 'c-1', Company: 'Company One' }
        : { ID: `id-${p.EntityName}`, Name: `name-${p.EntityName}` };
}

/** Records the params of every `RunViews` call and answers each view with one row. */
function recordRunViews(): RunViewParams[][] {
    const calls: RunViewParams[][] = [];
    vi.spyOn(RunView.prototype, 'RunViews').mockImplementation(async (params: RunViewParams[]) => {
        calls.push(params);
        return params.map((p) => ({ Success: true, Results: [rowFor(p)] }) as RunViewResult);
    });
    return calls;
}

const entities = (params: RunViewParams[]): string[] => params.map((p) => p.EntityName ?? '');

afterEach(() => vi.restoreAllMocks());

describe('Sales section lookups (#209)', () => {
    it('reads only pipelines, stages, statuses and company names, never accounts or contacts', async () => {
        const calls = recordRunViews();
        const lookups = await new DealWorkspaceService().LoadLookups(SECTION_LOOKUP_KEYS);

        expect(calls).toHaveLength(1);
        const read = entities(calls[0]);
        expect(read).toEqual([
            'MJ_BizApps_Sales: Pipelines',
            // Joined to the pipelines: a pipeline serves every company it is linked to.
            'MJ_BizApps_Sales: Pipeline Companies',
            'MJ_BizApps_Sales: Pipeline Stages',
            'MJ_BizApps_Sales: Deal Status Types',
            // The filter bar's company names (bc-aidp-next-golive#350): a short list, unlike accounts.
            'MJ: Companies',
        ]);
        expect(read).not.toContain('MJ_BizApps_Sales: Sales Accounts');
        expect(read).not.toContain('MJ_BizApps_Sales: Sales Contacts');

        // Each result lands in the list it was asked for, not in its neighbour.
        expect(lookups.Pipelines.map((p) => `${p.ID}/${p.CompanyID}/${p.CompanyName}`)).toEqual([
            'id-MJ_BizApps_Sales: Pipelines/c-1/Company One',
        ]);
        expect(lookups.Stages.map((s) => s.ID)).toEqual(['id-MJ_BizApps_Sales: Pipeline Stages']);
        expect(lookups.DealStatusTypes.map((s) => s.ID)).toEqual(['id-MJ_BizApps_Sales: Deal Status Types']);
        expect(lookups.Companies.map((c) => c.ID)).toEqual(['id-MJ: Companies']);
        expect(lookups.Accounts).toEqual([]);
        expect(lookups.Contacts).toEqual([]);
    });

    it('still loads every list for the deal workspace when no keys are given', async () => {
        const calls = recordRunViews();
        const lookups = await new DealWorkspaceService().LoadLookups();

        // One read per list, plus the Pipelines list's joined read of its company links.
        expect(calls[0]).toHaveLength(ALL_LOOKUP_KEYS.length + 1);
        expect(entities(calls[0])).toContain('MJ_BizApps_Sales: Sales Accounts');
        expect(entities(calls[0])).toContain('MJ_BizApps_Sales: Sales Contacts');
        expect(lookups.Accounts.map((a) => a.ID)).toEqual(['id-MJ_BizApps_Sales: Sales Accounts']);
        expect(lookups.LossReasons.map((r) => r.ID)).toEqual(['id-MJ_BizApps_Sales: Loss Reasons']);
    });

    it('leaves a failed list empty without shifting the others', async () => {
        vi.spyOn(RunView.prototype, 'RunViews').mockImplementation(async (params: RunViewParams[]) =>
            params.map((p) =>
                (p.EntityName === 'MJ_BizApps_Sales: Pipeline Stages'
                    ? { Success: false, Results: [], ErrorMessage: 'boom' }
                    : { Success: true, Results: [rowFor(p)] }) as RunViewResult,
            ),
        );
        const lookups = await new DealWorkspaceService().LoadLookups(SECTION_LOOKUP_KEYS);

        expect(lookups.Stages).toEqual([]);
        expect(lookups.Pipelines.map((p) => p.ID)).toEqual(['id-MJ_BizApps_Sales: Pipelines']);
        expect(lookups.DealStatusTypes.map((s) => s.ID)).toEqual(['id-MJ_BizApps_Sales: Deal Status Types']);
    });

    /** A failed link read leaves the pipelines with no company to sell as, but shifts nothing after it. */
    it('leaves Pipelines empty when its company links cannot be read, and the next list intact', async () => {
        vi.spyOn(RunView.prototype, 'RunViews').mockImplementation(async (params: RunViewParams[]) =>
            params.map((p) =>
                (p.EntityName === PIPELINE_COMPANIES
                    ? { Success: false, Results: [], ErrorMessage: 'boom' }
                    : { Success: true, Results: [rowFor(p)] }) as RunViewResult,
            ),
        );
        const lookups = await new DealWorkspaceService().LoadLookups(SECTION_LOOKUP_KEYS);

        expect(lookups.Pipelines).toEqual([]);
        expect(lookups.Stages.map((s) => s.ID)).toEqual(['id-MJ_BizApps_Sales: Pipeline Stages']);
    });

    it('lists a pipeline shared by two companies once per company', async () => {
        vi.spyOn(RunView.prototype, 'RunViews').mockImplementation(async (params: RunViewParams[]) =>
            params.map((p) =>
                (p.EntityName === PIPELINE_COMPANIES
                    ? {
                          Success: true,
                          Results: [
                              { PipelineID: `id-${PIPELINES}`, CompanyID: 'c-1', Company: 'Company One' },
                              { PipelineID: `id-${PIPELINES}`, CompanyID: 'c-2', Company: 'Company Two' },
                          ],
                      }
                    : { Success: true, Results: [rowFor(p)] }) as RunViewResult,
            ),
        );
        const lookups = await new DealWorkspaceService().LoadLookups(SECTION_LOOKUP_KEYS);

        expect(lookups.Pipelines.map((p) => `${p.ID}/${p.CompanyID}`).sort()).toEqual([
            'id-MJ_BizApps_Sales: Pipelines/c-1',
            'id-MJ_BizApps_Sales: Pipelines/c-2',
        ]);
    });
});

describe('which pipelines the Sales section lists (bc-aidp-next-golive#423)', () => {
    // A retired pipeline is deactivated so no deal can be put in it, but kept in the forecast so the
    // dashboard filters and the board still reach its won and lost deals.
    it('reads active pipelines and those kept in the forecast', async () => {
        const calls = recordRunViews();
        await new DealWorkspaceService().LoadLookups(SECTION_LOOKUP_KEYS);
        const pipelines = calls[0].find((p) => p.EntityName === 'MJ_BizApps_Sales: Pipelines');
        expect(pipelines?.ExtraFilter).toBe(PIPELINE_LIST_FILTER);
        expect(PIPELINE_LIST_FILTER).toBe('(IsActive = 1 OR IncludeInForecast = 1)');
    });
});
