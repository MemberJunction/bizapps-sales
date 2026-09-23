/**
 * THE PICKER'S DEFAULT DAY — the call site, not the filter it calls.
 *
 * ── WHY THIS IS SEPARATE FROM `product-filter.test.ts` ─────────────────────────────────────────
 *
 * That file proves `ProductFilterFor` interpolates the day it is GIVEN. This one proves
 * `LoadProducts` gives it the BUSINESS day. Measured on this branch: reverting the default back to
 * the UTC day left all 539 tests green, because nothing drove the call site — which is where
 * bc-aidp-next-golive#168's defect actually lived. A pure function proved by argument says nothing
 * about the caller that supplies the argument (CLAUDE.md rule 8).
 *
 * ── THE ENGINE'S REAL `Today()` RUNS ──────────────────────────────────────────────────────────
 *
 * Only the ZONE is stubbed, not the day. `Today()` then does its own `Intl` arithmetic against a
 * pinned clock, so this exercises `TodayIn` -> `CalendarDayIn` -> `ProductFilterFor` end to end and
 * the assertion is about a day nothing in the test computed for it.
 *
 * `America/Chicago` at `2026-09-01T02:00:00Z` is 21:00 on 31 August — the spec's §7 discriminating
 * pair, west of Greenwich, where the business day (`2026-08-31`) and the UTC day (`2026-09-01`) are
 * different days AND different months. At an instant where they agree this file is vacuous.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Metadata, RunView } from '@memberjunction/core';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';
import { E_ORDERS_PRODUCT } from '@mj-biz-apps/sales-entities';

import { DealWorkspaceService } from '../lib/workspace/deal-workspace.service';

const BUSINESS_ZONE = 'America/Chicago';

/** 21:00 on 31 August in Chicago; already 1 September in UTC. The evening the defect lived in. */
const EVENING_IN_CHICAGO = new Date('2026-09-01T02:00:00.000Z');

/** Records the filter the picker asked the database for. Returns no rows — the SQL is the subject. */
function captureFilter(): { readonly Filters: string[] } {
    const filters: string[] = [];
    vi.spyOn(RunView.prototype, 'RunView').mockImplementation(
        async (params?: { ExtraFilter?: string }) => {
            filters.push(String(params?.ExtraFilter ?? ''));
            return { Success: true, Results: [] } as never;
        },
    );
    return { get Filters() { return filters; } };
}

beforeEach(() => {
    // `Date` only: the service awaits, and faking timers wholesale would stall its own promises.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(EVENING_IN_CHICAGO);

    // Orders IS installed here — an absent entity is a supported state that returns [] before the
    // filter is ever built, so this check would be vacuous without it.
    vi.spyOn(Metadata.prototype, 'Entities', 'get').mockReturnValue([{ Name: E_ORDERS_PRODUCT }] as never);

    vi.spyOn(BusinessTimeZoneEngine.prototype, 'Config').mockResolvedValue(undefined);
    vi.spyOn(BusinessTimeZoneEngine.prototype, 'Zone', 'get').mockReturnValue(BUSINESS_ZONE);
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('LoadProducts judges availability on the business day', () => {
    /**
     * THE PREMISE, ASSERTED RATHER THAN ASSUMED. If the two zones ever named the same day at this
     * instant, every assertion below would pass against the UTC default it exists to rule out.
     */
    it('the pinned instant really is a different DAY in the two zones', () => {
        expect(BusinessTimeZoneEngine.Instance.Today()).toBe('2026-08-31');
        expect(new Date().toISOString().slice(0, 10)).toBe('2026-09-01');
    });

    it('defaults to today in the business zone, not the UTC day', async () => {
        const seen = captureFilter();

        await new DealWorkspaceService().LoadProducts();

        expect(seen.Filters, 'the picker must have issued exactly one query').toHaveLength(1);
        expect(seen.Filters[0]).toContain("AvailableFrom <= '2026-08-31'");
        expect(seen.Filters[0]).toContain("AvailableTo >= '2026-08-31'");
        expect(seen.Filters[0], 'the UTC day must not appear anywhere in the filter').not.toContain('2026-09-01');
    });

    /**
     * The parameter still wins, which is what makes the default a DEFAULT rather than a hardcoding —
     * and what `PP4` relies on to ask the catalogue what it offered in 2025.
     */
    it('uses the day it is handed, when a caller means a different one', async () => {
        const seen = captureFilter();

        await new DealWorkspaceService().LoadProducts('2025-06-01');

        expect(seen.Filters[0]).toContain("AvailableFrom <= '2025-06-01'");
        expect(seen.Filters[0]).not.toContain('2026-08-31');
    });

    /**
     * THE ENGINE IS ASKED, not read from a cached module value. `LoadProducts` awaits `Config` before
     * it asks what day it is — without that the engine answers UTC with a warning on a host whose
     * zone row has never been read, which is silently the old behaviour.
     */
    it('configures the engine before asking it what day it is', async () => {
        captureFilter();
        const config = vi.spyOn(BusinessTimeZoneEngine.prototype, 'Config').mockResolvedValue(undefined);

        await new DealWorkspaceService().LoadProducts();

        expect(config).toHaveBeenCalled();
    });
});
