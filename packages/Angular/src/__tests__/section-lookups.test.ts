import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunView, type RunViewParams, type RunViewResult } from '@memberjunction/core';
import {
    ALL_LOOKUP_KEYS,
    DealWorkspaceService,
    SECTION_LOOKUP_KEYS,
} from '../lib/workspace/deal-workspace.service';

/**
 * bizapps-sales#209: the Sales section loaded every account and every contact on each open, for name
 * pickers only the deal workspace shows. These tests read the entity names the service actually sends
 * to `RunViews`, so a list that creeps back into the section's batch fails here.
 */

/** Records the params of every `RunViews` call and answers each view with one row. */
function recordRunViews(): RunViewParams[][] {
    const calls: RunViewParams[][] = [];
    vi.spyOn(RunView.prototype, 'RunViews').mockImplementation(async (params: RunViewParams[]) => {
        calls.push(params);
        return params.map(
            (p) => ({ Success: true, Results: [{ ID: `id-${p.EntityName}`, Name: `name-${p.EntityName}` }] }) as RunViewResult,
        );
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
            'MJ_BizApps_Sales: Pipeline Stages',
            'MJ_BizApps_Sales: Deal Status Types',
            // The filter bar's company names (bc-aidp-next-golive#350): a short list, unlike accounts.
            'MJ: Companies',
        ]);
        expect(read).not.toContain('MJ_BizApps_Sales: Sales Accounts');
        expect(read).not.toContain('MJ_BizApps_Sales: Sales Contacts');

        // Each result lands in the list it was asked for, not in its neighbour.
        expect(lookups.Pipelines.map((p) => p.ID)).toEqual(['id-MJ_BizApps_Sales: Pipelines']);
        expect(lookups.Stages.map((s) => s.ID)).toEqual(['id-MJ_BizApps_Sales: Pipeline Stages']);
        expect(lookups.DealStatusTypes.map((s) => s.ID)).toEqual(['id-MJ_BizApps_Sales: Deal Status Types']);
        expect(lookups.Companies.map((c) => c.ID)).toEqual(['id-MJ: Companies']);
        expect(lookups.Accounts).toEqual([]);
        expect(lookups.Contacts).toEqual([]);
    });

    it('still loads every list for the deal workspace when no keys are given', async () => {
        const calls = recordRunViews();
        const lookups = await new DealWorkspaceService().LoadLookups();

        expect(calls[0]).toHaveLength(ALL_LOOKUP_KEYS.length);
        expect(entities(calls[0])).toContain('MJ_BizApps_Sales: Sales Accounts');
        expect(entities(calls[0])).toContain('MJ_BizApps_Sales: Sales Contacts');
        expect(lookups.Accounts.map((a) => a.ID)).toEqual(['id-MJ_BizApps_Sales: Sales Accounts']);
        expect(lookups.LossReasons.map((r) => r.ID)).toEqual(['id-MJ_BizApps_Sales: Loss Reasons']);
    });

    it('leaves a failed list empty without shifting the others', async () => {
        vi.spyOn(RunView.prototype, 'RunViews').mockImplementation(async (params: RunViewParams[]) =>
            params.map((p, i) =>
                (i === 1
                    ? { Success: false, Results: [], ErrorMessage: 'boom' }
                    : { Success: true, Results: [{ ID: `id-${p.EntityName}`, Name: 'n' }] }) as RunViewResult,
            ),
        );
        const lookups = await new DealWorkspaceService().LoadLookups(SECTION_LOOKUP_KEYS);

        expect(lookups.Stages).toEqual([]);
        expect(lookups.Pipelines.map((p) => p.ID)).toEqual(['id-MJ_BizApps_Sales: Pipelines']);
        expect(lookups.DealStatusTypes.map((s) => s.ID)).toEqual(['id-MJ_BizApps_Sales: Deal Status Types']);
    });
});
