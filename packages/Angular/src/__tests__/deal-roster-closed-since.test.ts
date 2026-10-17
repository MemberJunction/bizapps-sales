import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunQuery, type RunQueryParams, type RunQueryResult } from '@memberjunction/core';

import { DealWonInPeriodWhere } from '../lib/pages/deal-views';
import { DealWorkspaceService } from '../lib/workspace/deal-workspace.service';

/**
 * bizapps-sales#209: the roster is read with `ClosedSince`, and the Won list is filtered on the server.
 */

afterEach(() => vi.restoreAllMocks());

/** Records what `RunQuery` was asked, and answers with `result`. */
function recordRunQuery(result: Partial<RunQueryResult>): RunQueryParams[] {
    const calls: RunQueryParams[] = [];
    vi.spyOn(RunQuery.prototype, 'RunQuery').mockImplementation(async (params: RunQueryParams) => {
        calls.push(params);
        return result as RunQueryResult;
    });
    return calls;
}

describe('LoadRoster', () => {
    it('passes ClosedSince when given, and no parameters when not', async () => {
        const calls = recordRunQuery({ Success: true, Results: [] });
        const service = new DealWorkspaceService();

        await service.LoadRoster('2026-07-01');
        await service.LoadRoster();

        expect(calls[0].Parameters).toEqual({ ClosedSince: '2026-07-01' });
        expect(calls[1].Parameters).toBeUndefined();
    });

    it('throws with the reason when the query fails, rather than returning an empty roster', async () => {
        // What MJ answers when a host's query definition predates the parameter.
        recordRunQuery({ Success: false, ErrorMessage: "Unknown parameter: 'ClosedSince'" });

        await expect(new DealWorkspaceService().LoadRoster('2026-07-01')).rejects.toThrow("Unknown parameter: 'ClosedSince'");
    });
});

describe('DealWonInPeriodWhere', () => {
    const STATUS = { SchemaName: '__mj_BizAppsSales', BaseView: 'vwDealStatusTypes' };
    const WON = 'DealStatusTypeID IN (SELECT ID FROM [__mj_BizAppsSales].[vwDealStatusTypes] WHERE IsWon = 1)';

    it('bounds ActualCloseDate by the window, as WonCount does', () => {
        expect(DealWonInPeriodWhere(STATUS, { Key: 'quarter', Label: 'This quarter', Start: '2026-07-01', End: '2026-09-30' })).toBe(
            `${WON} AND ActualCloseDate >= '2026-07-01' AND ActualCloseDate <= '2026-09-30'`,
        );
    });

    it('matches every won deal, undated ones included, when the window is unbounded (All time)', () => {
        expect(DealWonInPeriodWhere(STATUS, { Key: 'alltime', Label: 'All time', Start: null, End: null })).toBe(WON);
        expect(DealWonInPeriodWhere(STATUS)).toBe(WON);
    });
});
