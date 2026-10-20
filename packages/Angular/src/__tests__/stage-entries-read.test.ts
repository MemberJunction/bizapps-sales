import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * THE IDLE FLAG READS THE WHOLE STAGE HISTORY, OR NONE OF IT (bizapps-sales#450).
 *
 * Deal Stage Events and Deals both carry `UserViewMaxRows = 1000`. A capped event read reports success
 * and drops the older deals' newest events, so those deals date from their creation and the Board flags
 * them as idle for hundreds of days. These pin that the read lifts the cap, and that a read which still
 * comes back short throws (no card flagged) instead of dating deals from creation.
 */

const runViews = vi.fn();

vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return {
        ...actual,
        Metadata: class {
            public get Entities() {
                return ['MJ_BizApps_Sales: Deals', 'MJ_BizApps_Sales: Deal Status Types']
                    .map((Name) => ({ Name, SchemaName: 's', BaseView: 'vw' }));
            }
        },
        RunView: class { public RunViews = runViews; },
    };
});

const { DealWorkspaceService, IsTruncatedRead } = await import('../lib/workspace/deal-workspace.service');

const EVENT = { DealID: 'D1', ToStageID: 'S1', ChangedAt: '2026-10-17T15:00:00Z' };
const DEAL = { ID: 'D1', PipelineStageID: 'S1', __mj_CreatedAt: '2025-06-01T15:00:00Z' };

afterEach(() => runViews.mockReset());

describe('LoadStageEntries', () => {
    it('reads both lists without the entity row cap', async () => {
        runViews.mockResolvedValue([
            { Success: true, Results: [EVENT], TotalRowCount: 1 },
            { Success: true, Results: [DEAL], TotalRowCount: 1 },
        ]);
        const days = await new DealWorkspaceService().LoadStageEntries();
        expect(days.get('d1')).toBe('2026-10-17');
        const params = runViews.mock.calls[0][0] as { IgnoreMaxRows?: boolean }[];
        expect(params.map((p) => p.IgnoreMaxRows)).toEqual([true, true]);
    });

    it('throws on a short event read rather than dating the deal from its creation', async () => {
        runViews.mockResolvedValue([
            { Success: true, Results: [], TotalRowCount: 1 },
            { Success: true, Results: [DEAL], TotalRowCount: 1 },
        ]);
        await expect(new DealWorkspaceService().LoadStageEntries()).rejects.toThrow(/incomplete/);
    });
});

describe('IsTruncatedRead', () => {
    it('is true only when fewer rows came back than matched', () => {
        expect(IsTruncatedRead({ Results: [1, 2], TotalRowCount: 3 })).toBe(true);
        expect(IsTruncatedRead({ Results: [1, 2], TotalRowCount: 2 })).toBe(false);
        expect(IsTruncatedRead({ Results: [], TotalRowCount: 0 })).toBe(false);
        expect(IsTruncatedRead({ Results: [1] })).toBe(false);
    });
});
