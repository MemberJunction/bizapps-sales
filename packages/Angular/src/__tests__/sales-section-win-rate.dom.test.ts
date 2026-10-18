// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Metadata } from '@memberjunction/core';

import type { MJSSalesSectionComponent } from '../lib/sections/sales-section.component';
import {
    configureSection,
    initSectionTestEnvironment,
    mountSection as mount,
    stubService,
    Summary,
    visiblePage,
    type StubService,
} from './helpers/sales-section-mount';

/**
 * A WIN RATE THAT DID NOT RUN READ AS "0 won / 0 closed".
 *
 * A failed query and a period with nothing closed rendered the same text. The Win rate tile now says
 * "figures unavailable" when the query did not run, as the other tiles do.
 */

let service: StubService;

beforeAll(initSectionTestEnvironment);

beforeEach(() => {
    service = stubService();
    service.LoadDashboardSummary.mockResolvedValue(Summary());
    vi.spyOn(Metadata.prototype, 'Entities', 'get').mockReturnValue([]);
    configureSection(service);
});

afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
});

function winRateCard(fixture: ComponentFixture<MJSSalesSectionComponent>): string {
    fixture.detectChanges();
    const card = visiblePage(fixture).querySelector('[data-testid="sales-kpi-closed"]')?.closest('.kpi');
    return card?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('the Win rate tile', () => {
    it('says the figures are unavailable when the query fails on load', async () => {
        service.LoadWinRate.mockResolvedValue(null);
        const fixture = await mount();
        const text = winRateCard(fixture);
        expect(text).toContain('figures unavailable');
        expect(text).not.toContain('0 won');
        expect(text).toContain('—');
    });

    it('still shows zero closed deals as a count when the query ran', async () => {
        service.LoadWinRate.mockResolvedValue([]);
        const fixture = await mount();
        expect(winRateCard(fixture)).toContain('0 won / 0 closed');
    });

    it('says unavailable after a period change that throws, and clears it after one that succeeds', async () => {
        service.LoadWinRate.mockResolvedValue([{ ClosedCount: 4, WonCount: 3, WonAmount: 300, LostAmount: 100 }]);
        const fixture = await mount();
        expect(winRateCard(fixture)).toContain('3 won / 4 closed');

        service.LoadWinRate.mockRejectedValueOnce(new Error('Received status code 504'));
        await fixture.componentInstance.SetPeriod('alltime');
        expect(fixture.componentInstance.WinRateUnavailable).toBe(true);
        expect(winRateCard(fixture)).toContain('figures unavailable');

        await fixture.componentInstance.SetPeriod('year');
        expect(fixture.componentInstance.WinRateUnavailable).toBe(false);
        expect(winRateCard(fixture)).toContain('3 won / 4 closed');
    });
});
