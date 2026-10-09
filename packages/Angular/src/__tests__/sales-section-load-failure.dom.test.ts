// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUSTOM_ELEMENTS_SCHEMA, ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { Metadata } from '@memberjunction/core';
import { NavigationService } from '@memberjunction/ng-shared';
import type { MJLeftNavItem } from '@memberjunction/ng-ui-components';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';

import { MJSSalesSectionComponent } from '../lib/sections/sales-section.component';
import { DealWorkspaceService } from '../lib/workspace/deal-workspace.service';

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
 * The MJ chrome (`mj-page-layout`, `mj-loading`, the entity viewer) is left as unknown elements: the
 * subject is which branch this template renders, not how MJ draws it.
 */

/** The component's own directory, which its `templateUrl` and `styleUrls` are relative to. */
const SECTION_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'sections');
const SECTION_FILES = new Set(['./sales-section.component.html', './sales-section.component.css']);

/** What a gateway timeout looks like by the time it reaches the section: a thrown error. */
const GATEWAY_TIMEOUT = 'Response not successful: Received status code 504';

/** The service, with every read the section makes on load. Each test breaks one. */
function stubService() {
    return {
        LoadFiscalYearStart: vi.fn().mockResolvedValue({ Start: { Month: 1, Day: 1 }, Basis: 'no-accounting' }),
        LoadRoster: vi.fn().mockResolvedValue([]),
        LoadLookups: vi.fn().mockResolvedValue({ Pipelines: [], Stages: [], DealStatusTypes: [] }),
        LoadDashboardSummary: vi.fn().mockResolvedValue(null),
        RunNamedQuery: vi.fn().mockResolvedValue([]),
    };
}

let service: ReturnType<typeof stubService>;

beforeAll(async () => {
    TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
    /**
     * The section's real template and stylesheet, read from disk the way the Angular CLI inlines them.
     * This resolves every component imported so far, and the resolver is given only the relative URL,
     * so the other components' files (the board's, which this suite never renders) resolve to empty.
     */
    await resolveComponentResources((url) =>
        Promise.resolve(SECTION_FILES.has(url) ? readFileSync(join(SECTION_DIR, url), 'utf8') : ''),
    );
});

beforeEach(() => {
    service = stubService();
    vi.spyOn(BusinessTimeZoneEngine.prototype, 'Config').mockResolvedValue(undefined);
    // No deal entity: the section then skips both entity-viewer reads, which are not under test.
    vi.spyOn(Metadata.prototype, 'Entities', 'get').mockReturnValue([]);
    TestBed.configureTestingModule({
        imports: [MJSSalesSectionComponent],
        providers: [
            { provide: DealWorkspaceService, useValue: service },
            { provide: NavigationService, useValue: { OpenEntityRecord: vi.fn(), OpenNewEntityRecord: vi.fn() } },
        ],
    });
    TestBed.overrideComponent(MJSSalesSectionComponent, {
        /**
         * The template again, inline: an override recompiles the component from its decorator, which
         * still names `templateUrl`, so the resolution above does not carry over to the recompile.
         */
        set: {
            template: readFileSync(join(SECTION_DIR, 'sales-section.component.html'), 'utf8'),
            templateUrl: undefined,
            styleUrls: undefined,
            styles: [],
            imports: [CommonModule],
            schemas: [CUSTOM_ELEMENTS_SCHEMA],
        },
    });
});

afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
});

/**
 * Mounts the section, waits for its first load to settle, then moves to `page` through the rail.
 *
 * The first `detectChanges` is what runs `ngOnInit`, as in the app. The page is changed through
 * `OnNav` rather than by setting `Page`: the component is OnPush, and `OnNav` is how a reader gets
 * there and is what re-renders it.
 */
async function mount(page = 'dashboard'): Promise<ComponentFixture<MJSSalesSectionComponent>> {
    const fixture = TestBed.createComponent(MJSSalesSectionComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.Loading).toBe(false));
    fixture.componentInstance.OnNav({ id: page } as MJLeftNavItem);
    return fixture;
}

/** The visible page's wrapper, so a branch on a hidden page cannot satisfy an assertion. */
function visiblePage(fixture: ComponentFixture<MJSSalesSectionComponent>): HTMLElement {
    const shown = Array.from(fixture.nativeElement.querySelectorAll('.wrap') as NodeListOf<HTMLElement>).filter(
        (el) => !el.hidden,
    );
    expect(shown, 'exactly one page is visible').toHaveLength(1);
    return shown[0];
}

describe('a read that throws during load', () => {
    /**
     * Each read the section makes, broken in turn. The roster is absent on purpose: it already had
     * its own catch (bizapps-sales#137) and degrades to unavailable tiles rather than a failed load.
     */
    const reads: Array<[string, (s: ReturnType<typeof stubService>) => void]> = [
        ['the fiscal year start', (s) => s.LoadFiscalYearStart.mockRejectedValue(new Error(GATEWAY_TIMEOUT))],
        ['the lookups', (s) => s.LoadLookups.mockRejectedValue(new Error(GATEWAY_TIMEOUT))],
        ['the dashboard summary', (s) => s.LoadDashboardSummary.mockRejectedValue(new Error(GATEWAY_TIMEOUT))],
        ['the win rate', (s) => s.RunNamedQuery.mockRejectedValue(new Error(GATEWAY_TIMEOUT))],
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
