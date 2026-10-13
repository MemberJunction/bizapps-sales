import { expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUSTOM_ELEMENTS_SCHEMA, ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { NavigationService } from '@memberjunction/ng-shared';
import type { MJLeftNavItem } from '@memberjunction/ng-ui-components';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';

import { MJSSalesSectionComponent } from '../../lib/sections/sales-section.component';
import { DealWorkspaceService } from '../../lib/workspace/deal-workspace.service';

/**
 * Mounts the Sales section's REAL template in jsdom with a stubbed service, for suites that assert on
 * what the reader sees. Shared by the load-failure (bizapps-sales#195) and first-load (#209) suites.
 *
 * The MJ chrome (`mj-page-layout`, `mj-loading`, the entity viewer, the board) is left as unknown
 * elements: the subject is which branch this template renders, not how MJ draws it.
 */

/** The component's own directory, which its `templateUrl` and `styleUrls` are relative to. */
const SECTION_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'lib', 'sections');
const SECTION_FILES = new Set(['./sales-section.component.html', './sales-section.component.css']);

/** The service, with every read the section makes on load. Each test overrides what it needs. */
export function stubService() {
    return {
        LoadFiscalYearStart: vi.fn().mockResolvedValue({ Start: { Month: 1, Day: 1 }, Basis: 'no-accounting' }),
        LoadRoster: vi.fn().mockResolvedValue([]),
        LoadLookups: vi.fn().mockResolvedValue({ Pipelines: [], Stages: [], DealStatusTypes: [] }),
        LoadDashboardSummary: vi.fn().mockResolvedValue(null),
        RunNamedQuery: vi.fn().mockResolvedValue([]),
    };
}

export type StubService = ReturnType<typeof stubService>;

/** Once per suite, in `beforeAll`. */
export async function initSectionTestEnvironment(): Promise<void> {
    TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
    /**
     * The section's real template and stylesheet, read from disk the way the Angular CLI inlines them.
     * This resolves every component imported so far, and the resolver is given only the relative URL,
     * so the other components' files (the board's, which these suites never render) resolve to empty.
     */
    await resolveComponentResources((url) =>
        Promise.resolve(SECTION_FILES.has(url) ? readFileSync(join(SECTION_DIR, url), 'utf8') : ''),
    );
}

/**
 * Per test, in `beforeEach`. The caller spies on `Metadata.prototype.Entities` itself, because what
 * entities exist differs between suites.
 */
export function configureSection(service: StubService): void {
    vi.spyOn(BusinessTimeZoneEngine.prototype, 'Config').mockResolvedValue(undefined);
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
}

/**
 * Mounts the section, waits for its first load to settle, then moves to `page` through the rail.
 *
 * The first `detectChanges` is what runs `ngOnInit`, as in the app. The page is changed through
 * `OnNav` rather than by setting `Page`: the component is OnPush, and `OnNav` is how a reader gets
 * there and is what re-renders it.
 */
export async function mountSection(page = 'dashboard'): Promise<ComponentFixture<MJSSalesSectionComponent>> {
    const fixture = TestBed.createComponent(MJSSalesSectionComponent);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.Loading).toBe(false));
    fixture.componentInstance.OnNav({ id: page } as MJLeftNavItem);
    return fixture;
}

/** The visible page's wrapper, so a branch on a hidden page cannot satisfy an assertion. */
export function visiblePage(fixture: ComponentFixture<MJSSalesSectionComponent>): HTMLElement {
    const shown = Array.from(fixture.nativeElement.querySelectorAll('.wrap') as NodeListOf<HTMLElement>).filter(
        (el) => !el.hidden,
    );
    expect(shown, 'exactly one page is visible').toHaveLength(1);
    return shown[0];
}
