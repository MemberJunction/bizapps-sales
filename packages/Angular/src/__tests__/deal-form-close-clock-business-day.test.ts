/**
 * THE CLOSE COUNTDOWN COUNTS FROM THE BUSINESS DAY (bc-aidp-next-golive#168).
 *
 * `daysFrom` measured against `new Date().getUTC*()`, so from 19:00 Central every figure it feeds
 * jumped a day early: a deal expected to close TOMORROW read "today", one closing today read
 * "1 day overdue", and `NextStepOverdue` went amber on a next step that was still due. #168 fixed
 * the product picker and left this behind, so the same deal form disagreed with the same app's
 * picker about what day it was.
 *
 * ── WHAT IS PINNED, AND WHERE ──────────────────────────────────────────────────────────────────
 *
 * `daysFrom` is module-private, so these drive the four getters that consume it — which is the right
 * altitude anyway: a day-count helper proved in isolation says nothing about the label a rep reads.
 *
 * `America/Chicago` at `2026-09-01T02:00:00Z` is 21:00 on 31 August: business day `2026-08-31`, UTC
 * day `2026-09-01`. Every expectation below is one day different under the UTC read, and the labels
 * are asserted as STRINGS because a boundary that shifts by one is invisible in a plausible number.
 *
 * `Object.create` holds the panel without an injector, as its sibling suites do: these getters read
 * `Record` and each other and nothing else.
 *
 * ── ONE MUTATION THIS FILE CANNOT KILL, RECORDED RATHER THAN PAPERED OVER ──────────────────────
 *
 * Making `daysFrom` read a stored `Date` from its LOCAL parts instead of its UTC parts is killed only
 * on a host WEST of Greenwich. Measured: it dies under `TZ=America/Chicago` and SURVIVES under both
 * `TZ=UTC` (what CI runs) and `TZ=Pacific/Kiritimati`. The reason is arithmetic, not weak assertions —
 * a stored day arrives as UTC midnight, and reading 00:00Z in a zone at +14 still lands on the same
 * calendar day; only a negative offset moves it back one. It is why the spec's §7 rule says to pin
 * test zones west of Greenwich, and why a host-zone-independent check cannot reach this one.
 *
 * It is the same gap already recorded against `deal-workspace-dates.test.ts`, and it is owned there.
 * What CAN be pinned under UTC is the other half of the same rule — that a STRING value is taken as
 * written rather than re-parsed as an instant — so that is asserted below, and a re-parse mutation
 * dies under every host zone including UTC.
 */
import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';

import { MJSDealOverviewPanel } from '../lib/form-panels/deal-form.panels';

const BUSINESS_ZONE = 'America/Chicago';

/** 21:00 on 31 August in Chicago; already 1 September in UTC. */
const EVENING_IN_CHICAGO = new Date('2026-09-01T02:00:00.000Z');

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

const overviewWith = (record: DealEntity) => {
    const panel = Object.create(MJSDealOverviewPanel.prototype) as MJSDealOverviewPanel;
    Object.defineProperty(panel, 'Record', { value: record, configurable: true });
    return panel;
};

/** A `DATE` column as the driver hands it back: a `Date` at UTC midnight. */
const storedDay = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(EVENING_IN_CHICAGO);
    vi.spyOn(BusinessTimeZoneEngine.prototype, 'Config').mockResolvedValue(undefined);
    vi.spyOn(BusinessTimeZoneEngine.prototype, 'Zone', 'get').mockReturnValue(BUSINESS_ZONE);
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('the countdown is measured from the business day', () => {
    /** The premise, asserted — at an instant where the zones agree this file proves nothing. */
    it('the pinned instant is 31 August for the business and 1 September for UTC', () => {
        expect(BusinessTimeZoneEngine.Instance.Today()).toBe('2026-08-31');
        expect(new Date().toISOString().slice(0, 10)).toBe('2026-09-01');
    });

    it('a deal closing on the business day reads "today", not "1 day overdue"', () => {
        expect(overviewWith(deal({ ExpectedCloseDate: storedDay('2026-08-31') })).DaysToCloseLabel).toBe('today');
    });

    it('a deal closing tomorrow reads "1 day", not "today"', () => {
        expect(overviewWith(deal({ ExpectedCloseDate: storedDay('2026-09-01') })).DaysToCloseLabel).toBe('1 day');
    });

    it('and yesterday is still overdue, so the fix did not simply shift everything', () => {
        expect(overviewWith(deal({ ExpectedCloseDate: storedDay('2026-08-30') })).DaysToCloseLabel)
            .toBe('1 day overdue');
    });

    /**
     * THE TILE, which is the surface a rep actually reads. `today` and `in 1 day` are one UTC hour
     * apart in this code and a whole business day apart in meaning.
     */
    it('the close clock reads "today" on the business day and "in 1 day" on the next', () => {
        expect(overviewWith(deal({ ExpectedCloseDate: storedDay('2026-08-31') })).CloseClock)
            .toEqual({ label: 'today', tone: 'warning' });
        expect(overviewWith(deal({ ExpectedCloseDate: storedDay('2026-09-01') })).CloseClock)
            .toEqual({ label: 'in 1 day', tone: 'warning' });
        expect(overviewWith(deal({ ExpectedCloseDate: storedDay('2026-08-30') })).CloseClock)
            .toEqual({ label: '1 day overdue', tone: 'warning' });
    });

    /**
     * NEXT STEP DUE TODAY IS NOT OVERDUE. Under the UTC read this went amber at 19:00 on the day it
     * was due — a warning about work the rep still had the evening to do.
     */
    it('a next step due on the business day is not overdue', () => {
        expect(overviewWith(deal({ NextStepDate: storedDay('2026-08-31') })).NextStepOverdue).toBe(false);
        expect(overviewWith(deal({ NextStepDate: storedDay('2026-08-30') })).NextStepOverdue).toBe(true);
    });

    /**
     * THE HEALTH BRIEFING reads the same helper, and it is the surface a rep sees first. A close date
     * of today must not be reported as passed.
     */
    it('the briefing does not say the close date has passed on the day it falls', () => {
        const today = overviewWith(deal({ ExpectedCloseDate: storedDay('2026-08-31') }));
        expect(today.Health).not.toContain('The expected close date has passed. Update the date or close the deal.');

        // The pairing that gives the check above its value: one day earlier and it DOES say so.
        const yesterday = overviewWith(deal({ ExpectedCloseDate: storedDay('2026-08-30') }));
        expect(yesterday.Health).toContain('The expected close date has passed. Update the date or close the deal.');
    });

    /**
     * A STORED STRING IS TAKEN AS WRITTEN, never re-parsed and re-based.
     *
     * `2026-08-31T23:00:00-05:00` is the 31st as stored; `new Date(...)` puts that instant at
     * 04:00 on 1 September UTC, so re-parsing it would render tomorrow and move the countdown a day.
     * Unlike the `Date` case above, this one discriminates under `TZ=UTC` as well — both the
     * as-written read and the re-parse are host-zone independent, and they disagree.
     */
    it('a stored string with an offset is the day it begins with, not the day it re-parses to', () => {
        expect(overviewWith(deal({ ExpectedCloseDate: '2026-08-31T23:00:00-05:00' })).DaysToCloseLabel)
            .toBe('today');
        expect(overviewWith(deal({ NextStepDate: '2026-08-31T23:00:00-05:00' })).NextStepOverdue)
            .toBe(false);
    });

    /** Unreadable and absent both stay "no date", as they were — the helper's other contract. */
    it('reports no countdown for an absent or unreadable date', () => {
        expect(overviewWith(deal({ ExpectedCloseDate: null })).DaysToCloseLabel).toBe('—');
        expect(overviewWith(deal({ ExpectedCloseDate: '2026-02-30' })).DaysToCloseLabel).toBe('—');
        expect(overviewWith(deal({ ExpectedCloseDate: 'not a date' })).DaysToCloseLabel).toBe('—');
    });
});
