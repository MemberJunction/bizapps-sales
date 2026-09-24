/**
 * THE DEAL FORM CONFIGURES THE BUSINESS ZONE ITSELF (bc-aidp-next-golive#168).
 *
 * ── WHY THIS FILE EXISTS SEPARATELY FROM `deal-form-close-clock-business-day.test.ts` ──────────
 *
 * That file stubs `Zone` (via `Setting`) to the business zone unconditionally, which is the right
 * shape for proving the ARITHMETIC — but it means the panel there is answering from a zone it never
 * asked for. Every assertion in it passes with `Config()` deleted from the source, because the stub
 * hands out `America/Chicago` to a configured and an unconfigured engine alike.
 *
 * `BusinessTimeZoneEngine` FAILS OPEN TO UTC by documented design: unconfigured, no configuration
 * row, or no read permission all resolve to UTC with one logged warning. So an unconfigured engine
 * does not announce itself — it silently answers with the exact day the #168 defect answered with.
 * On a lazily loaded `sales-ng` chunk, where MJ's `@RegisterForStartup()` boot sequence is not a
 * guarantee the deal form can lean on, that is the whole bug back with a passing test suite over it.
 *
 * So this file models the fail-open instead of stubbing past it: `Setting` reports UTC until `Config`
 * has actually been awaited. A panel that never calls `Config` therefore reads UTC and the
 * expectations below fail — which is the property being pinned. Delete the
 * `await BusinessTimeZoneEngine.Instance.Config(false)` from `MJSDealOverviewPanel.ngOnInit` and
 * every "after init" case here goes red; the countdown suite next door stays green.
 *
 * The panel is built with `new`, not `Object.create`, because the thing under test IS the instance
 * lifecycle — `ngOnInit` and the signal it sets. `MJSDealOverviewPanel` takes no injected
 * dependencies, which is what keeps that possible (see the note on `businessZoneLoaded`).
 */
import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';

import { MJSDealOverviewPanel } from '../lib/form-panels/deal-form.panels';

const BUSINESS_ZONE = 'America/Chicago';

/** 21:00 on 31 August in Chicago; already 1 September in UTC. The two zones must disagree here. */
const EVENING_IN_CHICAGO = new Date('2026-09-01T02:00:00.000Z');

/** A `DATE` column as the driver hands it back: a `Date` at UTC midnight. */
const storedDay = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

const deal = (over: Partial<Record<string, unknown>> = {}) =>
    ({
        IsSaved: true,
        ExpectedCloseDate: null,
        ActualCloseDate: null,
        ClosedAt: null,
        OwnerEmployeeID: 'emp-1',
        NextStep: 'Call them',
        NextStepDate: null,
        AccountID: 'acct-1',
        Amount: null,
        Probability: null,
        Get: () => null,
        ...over,
    }) as unknown as DealEntity;

const overviewWith = (record: DealEntity): MJSDealOverviewPanel => {
    const panel = new MJSDealOverviewPanel();
    panel.Record = record;
    return panel;
};

/** Flipped by the `Config` stub, read by the `Setting` stub — the engine's real fail-open, modelled. */
let configured = false;
let configCalls = 0;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(EVENING_IN_CHICAGO);
    configured = false;
    configCalls = 0;

    vi.spyOn(BusinessTimeZoneEngine.prototype, 'Config').mockImplementation(async () => {
        configCalls += 1;
        configured = true;
    });

    /**
     * `Setting` rather than `Zone`, because `Setting` is where the real fallback lives — `Zone` is
     * `Setting.Iana` and `Today()` reaches it through `Resolve()`. Stubbing the source of the
     * fallback keeps the modelled failure the same shape as the shipped one.
     */
    vi.spyOn(BusinessTimeZoneEngine.prototype, 'Setting', 'get').mockImplementation(() =>
        configured
            ? { Iana: BUSINESS_ZONE, Sql: 'Central Standard Time', Source: 'Business.TimeZone' as const }
            : { Iana: 'UTC', Sql: 'UTC', Source: 'fallback' as const },
    );
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('the overview panel loads the business zone before it counts a day', () => {
    /**
     * THE PREMISE, ASSERTED. Without this the rest of the file could pass against an engine whose
     * two branches happen to agree, and prove nothing at all.
     */
    it('an unconfigured engine answers UTC and a configured one answers the business zone', () => {
        expect(BusinessTimeZoneEngine.Instance.Today()).toBe('2026-09-01');
        configured = true;
        expect(BusinessTimeZoneEngine.Instance.Today()).toBe('2026-08-31');
    });

    /**
     * THE DEFECT, STILL REACHABLE — and this is the case the sibling suite cannot see. A panel that
     * has not run `ngOnInit` reads the UTC day, so a deal closing on the business day reads overdue.
     * It is asserted rather than avoided: it is what makes the pair below a measurement.
     */
    it('before init the countdown is the old UTC answer, not a neutral default', () => {
        const panel = overviewWith(deal({ ExpectedCloseDate: storedDay('2026-08-31') }));
        expect(panel.DaysToCloseLabel).toBe('1 day overdue');
        expect(panel.CloseClock).toEqual({ label: '1 day overdue', tone: 'warning' });
    });

    it('ngOnInit configures the engine', async () => {
        const panel = overviewWith(deal({ ExpectedCloseDate: storedDay('2026-08-31') }));
        await panel.ngOnInit();
        expect(configCalls).toBe(1);
    });

    /**
     * THE PROPERTY, at the surface a rep reads rather than at the helper. `toHaveBeenCalled` above
     * dies on a deleted `Config()` too, but it is a statement about a call; these are statements
     * about the label on the tile, and they would also catch a `Config()` that ran somewhere the
     * countdown does not benefit from.
     */
    it('after init the close clock reads the business day', async () => {
        const panel = overviewWith(deal({ ExpectedCloseDate: storedDay('2026-08-31') }));
        await panel.ngOnInit();
        expect(panel.DaysToCloseLabel).toBe('today');
        expect(panel.CloseClock).toEqual({ label: 'today', tone: 'warning' });
    });

    it('after init tomorrow is still tomorrow, so init did not simply shift everything', async () => {
        const panel = overviewWith(deal({ ExpectedCloseDate: storedDay('2026-09-01') }));
        await panel.ngOnInit();
        expect(panel.DaysToCloseLabel).toBe('1 day');
        expect(panel.CloseClock).toEqual({ label: 'in 1 day', tone: 'warning' });
    });

    /** The next-step warning reads the same helper, so it is covered by the same `Config()`. */
    it('after init a next step due on the business day is not overdue', async () => {
        const panel = overviewWith(deal({ NextStepDate: storedDay('2026-08-31') }));
        expect(panel.NextStepOverdue).toBe(true); // the UTC answer, before init
        await panel.ngOnInit();
        expect(panel.NextStepOverdue).toBe(false);
    });

    /** And the health briefing, which is the first thing on the panel. */
    it('after init the briefing does not say the close date has passed on the day it falls', async () => {
        const panel = overviewWith(deal({ ExpectedCloseDate: storedDay('2026-08-31') }));
        const passed = 'The expected close date has passed. Update the date or close the deal.';
        expect(panel.Health).toContain(passed); // the UTC answer, before init
        await panel.ngOnInit();
        expect(panel.Health).not.toContain(passed);
    });

    /**
     * `Config(false)` — NOT `Config(true)`. The engine caches one instance configuration row; a forced
     * refresh would re-read it on every deal form a rep opens, which is the difference between a
     * no-op and a query per mount. The two other call sites in this app pass `false` for the same
     * reason and this one must not drift from them.
     */
    it('asks for the cached configuration, never a forced refresh', async () => {
        const spy = vi.spyOn(BusinessTimeZoneEngine.prototype, 'Config');
        await overviewWith(deal()).ngOnInit();
        expect(spy).toHaveBeenCalledWith(false);
    });
});
