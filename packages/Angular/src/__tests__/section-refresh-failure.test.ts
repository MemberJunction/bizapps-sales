import '@angular/compiler';
import { Metadata } from '@memberjunction/core';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MJSSalesSectionComponent, REFRESH_FAILED } from '../lib/sections/sales-section.component';

/**
 * A REFRESH THAT THROWS STILL ENDS.
 *
 * MJ's GraphQL provider throws on a transport failure (a gateway 504, a 5xx, a dropped connection)
 * instead of returning `Success: false`. `Refresh()` used to clear `Loading` only at the end of the
 * happy path, so one rejected read left every page behind the spinner with no reason given.
 *
 * Built with `Object.create`, as the sibling suites do: the subject is what `Refresh()` does with a
 * rejected read, and the service, the change detector and the views are stand-ins.
 */

type Section = {
    Refresh(): Promise<void>;
    Loading: boolean;
    LoadError: string | null;
};

const EMPTY_LOOKUPS = { Pipelines: [], Stages: [], DealStatusTypes: [] };
const GATEWAY_TIMEOUT = new Error('GraphQL Error (Code: 504): Gateway Timeout');

function section(lookups: () => Promise<typeof EMPTY_LOOKUPS>) {
    const c = Object.create(MJSSalesSectionComponent.prototype) as Section;
    const props: Record<string, unknown> = {
        Loading: true,
        LoadError: null,
        Message: '',
        RosterError: null,
        Period: 'alltime',
        refreshToken: 0,
        cdr: { detectChanges: () => undefined },
        service: {
            LoadFiscalYearStart: async () => ({ Start: { Month: 1, Day: 1 }, Basis: 'profile' }),
            LoadRoster: async () => [],
            LoadLookups: lookups,
            LoadDashboardSummary: async () => null,
            RunNamedQuery: async () => [],
        },
        refreshInspectView: async () => undefined,
        refreshAllDealsView: async () => undefined,
        applyWinRate: () => undefined,
    };
    for (const [k, v] of Object.entries(props)) {
        Object.defineProperty(c, k, { value: v, writable: true });
    }
    return c;
}

describe('Refresh() when a read throws', () => {
    beforeEach(() => {
        vi.spyOn(BusinessTimeZoneEngine.Instance, 'Config').mockResolvedValue(undefined);
        vi.spyOn(Metadata.prototype, 'Entities', 'get').mockReturnValue([]);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('clears Loading and says the load failed, instead of spinning', async () => {
        const c = section(async () => {
            throw GATEWAY_TIMEOUT;
        });
        await expect(c.Refresh()).resolves.toBeUndefined();

        expect(c.Loading).toBe(false);
        expect(c.LoadError).toBe(REFRESH_FAILED);
    });

    it('clears a previous failure when the retry succeeds', async () => {
        let fail = true;
        const c = section(async () => {
            if (fail) {
                throw GATEWAY_TIMEOUT;
            }
            return EMPTY_LOOKUPS;
        });
        await c.Refresh();
        fail = false;
        await c.Refresh();

        expect(c.Loading).toBe(false);
        expect(c.LoadError).toBeNull();
    });

    it('lets only the newest refresh clear Loading', async () => {
        let release: (v: typeof EMPTY_LOOKUPS) => void = () => undefined;
        const calls: Array<() => Promise<typeof EMPTY_LOOKUPS>> = [
            async () => {
                throw GATEWAY_TIMEOUT;
            },
            () => new Promise((resolve) => (release = resolve)),
        ];
        let n = 0;
        const c = section(() => calls[n++]());

        const first = c.Refresh();
        const second = c.Refresh();
        await first;
        // The first refresh failed, but a newer one is still loading: the spinner stays.
        expect(c.Loading).toBe(true);
        expect(c.LoadError).toBeNull();

        release(EMPTY_LOOKUPS);
        await second;
        expect(c.Loading).toBe(false);
    });
});
