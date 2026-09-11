import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import { MJSDealOverviewPanel } from '../lib/form-panels/deal-form.panels';

/**
 * bc-aidp-next-golive#206 item 4: the Overview keeps coaching a deal that is finished.
 *
 * A closed deal was still showing the amber warning list, a Next move empty state, an overdue flag and
 * a Close tile reading "N days past". Every one of those asks somebody to act on a decision that has
 * already been taken — re-date the close, assign an owner, write a next step — on a record the lock
 * will refuse to change anyway.
 *
 * WHAT DECIDES "CLOSED" HERE, and it is not the status. The panel reads the CLOSE STAMPS, because those
 * are what the server writes when the close actually runs. Keying on the status would call a deal closed
 * the moment somebody picked Won, which is the state #205 exists to stop being a thing.
 *
 * Instantiated through `Object.create` like its sibling suite: these getters read `Record` and each
 * other, so an injector would add ceremony without adding assurance.
 */
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

const overviewWith = (record: DealEntity | null) => {
    const panel = Object.create(MJSDealOverviewPanel.prototype) as MJSDealOverviewPanel;
    Object.defineProperty(panel, 'Record', { value: record, configurable: true });
    return panel;
};

/** A deal with everything the briefing would otherwise complain about. */
const needy = (over: Partial<Record<string, unknown>> = {}) =>
    deal({
        OwnerEmployeeID: null,
        NextStep: null,
        AccountID: null,
        ExpectedCloseDate: '2020-01-01',
        NextStepDate: '2020-01-01',
        Amount: 5000,
        Probability: null,
        ...over,
    });

describe('IsClosed reads the close stamps, not the status', () => {
    it('is false on an open deal', () => {
        expect(overviewWith(deal()).IsClosed).toBe(false);
    });

    it('is true on either stamp alone, since a legacy row may carry only one', () => {
        expect(overviewWith(deal({ ActualCloseDate: '2026-09-01' })).IsClosed).toBe(true);
        expect(overviewWith(deal({ ClosedAt: '2026-09-01T10:00:00Z' })).IsClosed).toBe(true);
    });
});

describe('#206 item 4 — the Overview stops coaching once a deal is closed', () => {
    it('reports every gap while the deal is still open', () => {
        // The control. Without this, a version that always returned [] would pass the next test.
        const open = overviewWith(needy());
        expect(open.Health.length).toBeGreaterThan(0);
        expect(open.NextStepOverdue).toBe(true);
    });

    it('says nothing at all once it is closed, on the same deal', () => {
        const closed = overviewWith(needy({ ActualCloseDate: '2026-09-01' }));
        expect(closed.Health).toEqual([]);
    });

    it('drops the overdue flag, because nothing is overdue on a finished deal', () => {
        expect(overviewWith(needy({ ActualCloseDate: '2026-09-01' })).NextStepOverdue).toBe(false);
    });
});

describe('#206 item 4 — the Close tile shows when it closed, not how late it was', () => {
    it('counts days against the expected date while open', () => {
        const open = overviewWith(deal({ ExpectedCloseDate: '2020-01-01' }));
        expect(open.CloseClock.label).toMatch(/past/);
        expect(open.CloseClock.tone).toBe('warning');
    });

    it('shows the close DATE once closed, even with an expected date long gone', () => {
        const closed = overviewWith(
            deal({ ExpectedCloseDate: '2020-01-01', ActualCloseDate: '2026-09-01' }),
        );
        expect(closed.CloseClock.label).not.toMatch(/past/);
        expect(closed.CloseClock.label).toMatch(/2026/);
        expect(closed.CloseClock.tone).toBe('success');
    });

    it('does the same for Days to close, which had the same "past" wording', () => {
        const closed = overviewWith(
            deal({ ExpectedCloseDate: '2020-01-01', ActualCloseDate: '2026-09-01' }),
        );
        expect(closed.DaysToCloseLabel).not.toMatch(/past/);
        expect(closed.DaysToCloseLabel).toMatch(/2026/);
    });
});

describe('#206 item 4 — the Forecast tile shows the outcome once there is one', () => {
    it('shows the forecast category while the deal is open', () => {
        const open = overviewWith(
            deal({ Get: (f: string) => (f === 'ForecastCategoryType' ? 'Commit' : 'Open') }),
        );
        expect(open.ForecastHeadline).toBe('Commit');
    });

    it('shows the status once closed — Won is not a forecast', () => {
        const closed = overviewWith(
            deal({
                ActualCloseDate: '2026-09-01',
                Get: (f: string) => (f === 'ForecastCategoryType' ? 'Commit' : 'Won'),
            }),
        );
        expect(closed.ForecastHeadline).toBe('Won');
    });

    it('falls back to a dash rather than rendering an empty tile', () => {
        expect(overviewWith(deal({ Get: () => null })).ForecastHeadline).toBe('—');
    });
});
