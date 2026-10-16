// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Metadata } from '@memberjunction/core';

import { MJSSalesSectionComponent } from '../lib/sections/sales-section.component';
import {
    configureSection,
    initSectionTestEnvironment,
    mountSection as mount,
    stubService,
    visiblePage,
    type StubService,
} from './helpers/sales-section-mount';

/**
 * A FAILED LOAD LEFT THE SALES SECTION ON ITS SPINNER FOR GOOD (bizapps-sales#195).
 *
 * MJ's GraphQL provider throws on a transport failure (a gateway 504, a timeout, a dropped
 * connection) instead of returning `Success: false`. `Refresh()` set `Loading = false` only after
 * every read had resolved, so one rejected read left `<mj-loading>` on every page, and the rejection
 * surfaced nowhere but the console.
 *
 * RENDERED, NOT READ FROM SOURCE. The defect is what the reader SEES: a spinner that never leaves.
 * A check on the `Loading` field alone would pass with a template that still shows the spinner on
 * some other condition, so these mount the component's real template in jsdom and assert on the DOM.
 * The mount is shared with the first-load suite (`helpers/sales-section-mount.ts`).
 */

/** What a gateway timeout looks like by the time it reaches the section: a thrown error. */
const GATEWAY_TIMEOUT = 'Response not successful: Received status code 504';

let service: StubService;

beforeAll(initSectionTestEnvironment);

beforeEach(() => {
    service = stubService();
    // No deal entity: the section then skips both entity-viewer reads, which are not under test.
    vi.spyOn(Metadata.prototype, 'Entities', 'get').mockReturnValue([]);
    configureSection(service);
});

afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
});

describe('a read that throws during load', () => {
    /**
     * Each read the section makes, broken in turn. The roster is absent on purpose: it already had
     * its own catch (bizapps-sales#137) and degrades to unavailable tiles rather than a failed load.
     */
    const reads: Array<[string, (s: StubService) => void]> = [
        ['the fiscal year start', (s) => s.LoadFiscalYearStart.mockRejectedValue(new Error(GATEWAY_TIMEOUT))],
        ['the lookups', (s) => s.LoadLookups.mockRejectedValue(new Error(GATEWAY_TIMEOUT))],
        ['the dashboard summary', (s) => s.LoadDashboardSummary.mockRejectedValue(new Error(GATEWAY_TIMEOUT))],
        ['the win rate', (s) => s.LoadWinRate.mockRejectedValue(new Error(GATEWAY_TIMEOUT))],
    ];

    it.each(reads)('clears the spinner and shows the failure when %s fails', async (_name, breakIt) => {
        breakIt(service);
        const fixture = await mount();
        const page = visiblePage(fixture);

        expect(page.querySelector('mj-loading'), 'the spinner must not outlive the load').toBeNull();
        const alert = page.querySelector('[data-testid="sales-load-failed"]');
        expect(alert, 'the failure must be on screen').not.toBeNull();
        expect(alert?.getAttribute('role')).toBe('alert');
        expect(alert?.textContent).toContain(GATEWAY_TIMEOUT);
        expect(page.querySelector('[data-testid="sales-load-retry"]'), 'with a way to try again').not.toBeNull();
    });

    it('does not reject ngOnInit, so nothing escapes as an unhandled rejection', async () => {
        service.LoadLookups.mockRejectedValue(new Error(GATEWAY_TIMEOUT));
        const fixture = TestBed.createComponent(MJSSalesSectionComponent);
        await expect(fixture.componentInstance.ngOnInit()).resolves.toBeUndefined();
    });

    it.each(['list', 'board'])('shows the same failure on the %s page instead of its spinner', async (pageId) => {
        service.LoadLookups.mockRejectedValue(new Error(GATEWAY_TIMEOUT));
        const page = visiblePage(await mount(pageId));

        expect(page.querySelector('mj-loading')).toBeNull();
        expect(page.querySelector('[data-testid="sales-load-failed"]')).not.toBeNull();
    });
});

describe('Retry', () => {
    it('loads again and, when that succeeds, replaces the failure with the dashboard', async () => {
        service.LoadLookups.mockRejectedValueOnce(new Error(GATEWAY_TIMEOUT));
        const fixture = await mount();

        const retry = fixture.nativeElement.querySelector('[data-testid="sales-load-retry"]') as HTMLButtonElement | null;
        expect(retry, 'the Retry button is rendered').not.toBeNull();
        retry?.click();
        await vi.waitFor(() => {
            expect(service.LoadLookups).toHaveBeenCalledTimes(2);
            expect(fixture.componentInstance.Loading).toBe(false);
        });

        const page = visiblePage(fixture);
        expect(page.querySelector('[data-testid="sales-load-failed"]'), 'the failure is cleared').toBeNull();
        expect(page.querySelector('mj-loading')).toBeNull();
        expect(page.querySelector('.kpis'), 'and the dashboard renders').not.toBeNull();
    });
});

describe('a load that succeeds', () => {
    it('renders the dashboard with no failure shown', async () => {
        const page = visiblePage(await mount());

        expect(page.querySelector('mj-loading')).toBeNull();
        expect(page.querySelector('[data-testid="sales-load-failed"]')).toBeNull();
        expect(page.querySelector('.kpis')).not.toBeNull();
    });
});
