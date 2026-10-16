import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Metadata, RunView, type EntityInfo, type RunViewResult } from '@memberjunction/core';

import { CALENDAR_YEAR_START, DescribeFiscalBasis } from '../lib/pages/dashboard-period';
import { DealWorkspaceService } from '../lib/workspace/deal-workspace.service';

/**
 * A user who cannot read accounting company profiles was told no profile sets a fiscal year. A
 * failed or thrown read now reports that the start could not be read.
 */

beforeEach(() => {
    vi.spyOn(Metadata.prototype, 'Entities', 'get').mockReturnValue([
        { Name: 'MJ_BizApps_Accounting: Accounting Company Profiles' },
    ] as unknown as EntityInfo[]);
});

afterEach(() => vi.restoreAllMocks());

describe('LoadFiscalYearStart', () => {
    it("reports 'unreadable' when the read is refused", async () => {
        vi.spyOn(RunView.prototype, 'RunView').mockResolvedValue({
            Success: false,
            ErrorMessage: 'User does not have read permission',
            Results: [],
        } as unknown as RunViewResult);

        const resolution = await new DealWorkspaceService().LoadFiscalYearStart();

        expect(resolution).toEqual({ Start: CALENDAR_YEAR_START, Basis: 'unreadable' });
        expect(DescribeFiscalBasis(resolution)).toBe('calendar year (fiscal year start could not be read)');
    });

    it("reports 'unreadable' when the read throws", async () => {
        vi.spyOn(RunView.prototype, 'RunView').mockRejectedValue(new Error('Received status code 504'));

        expect((await new DealWorkspaceService().LoadFiscalYearStart()).Basis).toBe('unreadable');
    });

    it("still reports 'no-profiles' when the read succeeds with no rows", async () => {
        vi.spyOn(RunView.prototype, 'RunView').mockResolvedValue({ Success: true, Results: [] } as unknown as RunViewResult);

        expect((await new DealWorkspaceService().LoadFiscalYearStart()).Basis).toBe('no-profiles');
    });
});
