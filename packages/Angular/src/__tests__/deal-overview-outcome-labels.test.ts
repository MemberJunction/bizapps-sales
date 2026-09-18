import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import { MJSDealOverviewPanel } from '../lib/form-panels/deal-form.panels';

/**
 * bc-aidp-next-golive#231 — a closed deal was still labeled as an open forecast.
 *
 * #206 item 4 fixed the tile VALUES and left the static labels alone, which produced the worst of both:
 * correct data under headings that promise something else. "Forecast: Won" is not a forecast, and
 * "Days to close: 14 Mar" is not a count of days.
 *
 * WHAT THESE CHECKS ARE BUILT TO CATCH, per CLAUDE.md rule 8: an implementation that gets the label
 * right and the value wrong, or vice versa, passes a check that only looks at one of them. So every
 * assertion below pins the label AND the value it sits over, as a pair.
 *
 * WON AND LOST COME FROM FLAGS ON THE STATUS ROW, never from its name (rule 2) — the panel reads them
 * off the form component, so the fixture supplies them the same way.
 */
const deal = (over: Partial<Record<string, unknown>> = {}) =>
    ({
        IsSaved: true,
        ExpectedCloseDate: null,
        ActualCloseDate: null,
        ClosedAt: null,
        StartDate: null,
        ExecutionDate: null,
        TermMonths: null,
        LossNotes: null,
        Amount: null,
        Probability: null,
        Get: (f: string) => (over as Record<string, unknown>)[`get:${f}`] ?? null,
        ...over,
    }) as unknown as DealEntity;

/** `IsWon` / `IsLost` reach the panel through the form component, exactly as in the app. */
const panelFor = (record: DealEntity | null, lock: { IsWon?: boolean; IsLost?: boolean } = {}) => {
    const panel = Object.create(MJSDealOverviewPanel.prototype) as MJSDealOverviewPanel;
    Object.defineProperty(panel, 'Record', { value: record, configurable: true });
    Object.defineProperty(panel, 'FormComponent', { value: lock, configurable: true });
    return panel;
};

const won = (over: Partial<Record<string, unknown>> = {}) =>
    panelFor(deal({ ActualCloseDate: '2026-03-14', ...over }), { IsWon: true });

const lost = (over: Partial<Record<string, unknown>> = {}) =>
    panelFor(deal({ ActualCloseDate: '2026-03-14', ...over }), { IsLost: true });

describe('an OPEN deal still forecasts', () => {
    const open = () => panelFor(deal({ ExpectedCloseDate: '2026-03-14', 'get:DealStatusType': 'Open' }));

    it('labels the outcome tile "Forecast", not "Outcome"', () => {
        expect(open().OutcomeTileLabel).toBe('Forecast');
    });

    it('labels the close tile "Closes"', () => {
        expect(open().CloseTileLabel).toBe('Closes');
    });

    it('shows no closed row and keeps the delivery rows', () => {
        expect(open().IsClosed).toBe(false);
        expect(open().ShowDeliveryRows).toBe(true);
        expect(open().ShowLossReason).toBe(false);
    });
});

/**
 * THE STATE THE UNGATED `IsWon` MAKES REACHABLE.
 *
 * `DealLockState.IsWon` is deliberately NOT gated on `LocksDeal` (golive#226, so the header's chips
 * survive a winning status that does not freeze the deal). That means an OPEN deal can now arrive here
 * with `IsWon` true, which was impossible while the flag was only set on the locked path.
 *
 * Every getter below tests the CLOSE STAMPS first, so the answer is unchanged — but that is a property
 * worth pinning rather than re-deriving, because the failure would be a deal announcing "Won" while it
 * is still being worked.
 */
describe('an OPEN deal with a winning status still forecasts', () => {
    const openWon = () => panelFor(deal({ ExpectedCloseDate: '2026-03-14' }), { IsWon: true });

    it('reads "Closes", not "Won"', () => {
        expect(openWon().CloseTileLabel).toBe('Closes');
    });

    it('still labels the outcome tile "Forecast"', () => {
        expect(openWon().OutcomeTileLabel).toBe('Forecast');
    });

    it('and shows no closed row', () => {
        expect(openWon().IsClosed).toBe(false);
    });
});

describe('a WON deal reports the outcome', () => {
    it('labels the outcome tile "Outcome"', () => {
        expect(won().OutcomeTileLabel).toBe('Outcome');
    });

    it('labels the close tile "Won" over the close DATE', () => {
        const p = won();
        expect(p.CloseTileLabel).toBe('Won');
        // The pairing is the point: a label of "Won" over a countdown would still be wrong.
        expect(p.CloseClock.label).toBe(p.ClosedDateLabel);
    });

    it('names the stage it closed from', () => {
        expect(won({ 'get:PipelineStage': 'Negotiation' }).OutcomeTileSub).toBe('from Negotiation');
    });

    it('labels the Timing row "Closed won"', () => {
        expect(won().ClosedRowLabel).toBe('Closed won');
    });

    it('keeps the delivery rows and shows no loss reason', () => {
        expect(won().ShowDeliveryRows).toBe(true);
        expect(won().ShowLossReason).toBe(false);
    });
});

describe('the close variance reads against the expected date', () => {
    it('on time when they match', () => {
        expect(won({ ExpectedCloseDate: '2026-03-14' }).CloseVariance).toBe('on time');
    });

    it('early when it closed first', () => {
        expect(won({ ExpectedCloseDate: '2026-03-18' }).CloseVariance).toBe('4 days early');
    });

    it('late when it closed after', () => {
        expect(won({ ExpectedCloseDate: '2026-03-11' }).CloseVariance).toBe('3 days late');
    });

    it('says nothing at all when there was no expectation to miss', () => {
        expect(won({ ExpectedCloseDate: null }).CloseVariance).toBe('');
    });

    it('singularises one day', () => {
        expect(won({ ExpectedCloseDate: '2026-03-15' }).CloseVariance).toBe('1 day early');
    });
});

describe('a LOST deal reports the loss', () => {
    it('labels the close tile "Lost"', () => {
        expect(lost().CloseTileLabel).toBe('Lost');
    });

    it('puts the loss reason under the close date', () => {
        expect(lost({ 'get:LossReason': 'Price' }).CloseTileSub).toBe('Price');
    });

    it('says so plainly when no reason was recorded', () => {
        expect(lost().CloseTileSub).toBe('No reason recorded');
    });

    it('labels the Timing row "Closed lost"', () => {
        expect(lost().ClosedRowLabel).toBe('Closed lost');
    });

    it('shows the loss reason row', () => {
        expect(lost().ShowLossReason).toBe(true);
    });

    it('hides Term / Start / Executed, which describe a deal being delivered', () => {
        expect(lost().ShowDeliveryRows).toBe(false);
    });

    it('but NEVER hides one that is actually set — that would conceal real data', () => {
        expect(lost({ StartDate: '2026-04-01' }).ShowDeliveryRows).toBe(true);
        expect(lost({ TermMonths: 12 }).ShowDeliveryRows).toBe(true);
        expect(lost({ ExecutionDate: '2026-04-01' }).ShowDeliveryRows).toBe(true);
    });
});

describe('a locking status that is NEITHER won nor lost is not called Won', () => {
    /**
     * The check that makes `IsWon` worth threading through `DealLockState`. An implementation reading
     * `!IsLost` as "won" passes every other check in this file and fails only this one.
     */
    it('falls back to "Closed" rather than claiming a win', () => {
        const p = panelFor(deal({ ActualCloseDate: '2026-03-14' }), {});
        expect(p.CloseTileLabel).toBe('Closed');
        expect(p.ClosedRowLabel).toBe('Closed');
    });
});

describe('the sales cycle measures creation to close', () => {
    it('counts the days between', () => {
        expect(won({ 'get:__mj_CreatedAt': '2026-02-12', ActualCloseDate: '2026-03-14' }).SalesCycleLabel)
            .toBe('30 days');
    });

    it('singularises one day', () => {
        expect(won({ 'get:__mj_CreatedAt': '2026-03-13', ActualCloseDate: '2026-03-14' }).SalesCycleLabel)
            .toBe('1 day');
    });

    it('says nothing when the close predates the creation, rather than printing a negative cycle', () => {
        expect(won({ 'get:__mj_CreatedAt': '2026-03-20', ActualCloseDate: '2026-03-14' }).SalesCycleLabel)
            .toBe('—');
    });

    it('says nothing when there is no creation stamp', () => {
        expect(won().SalesCycleLabel).toBe('—');
    });
});

describe('the open-deal countdown is spelled out, not abbreviated', () => {
    const openIn = (expected: string) =>
        panelFor(deal({ ExpectedCloseDate: expected }));

    it('no close date', () => {
        expect(panelFor(deal()).CloseClock.label).toBe('No close date');
    });

    it('reads as English rather than "12d" / "3d past"', () => {
        const future = new Date(Date.now() + 12 * 86_400_000).toISOString().slice(0, 10);
        const past = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
        expect(openIn(future).CloseClock.label).toBe('in 12 days');
        expect(openIn(past).CloseClock.label).toBe('3 days overdue');
        expect(openIn(new Date().toISOString().slice(0, 10)).CloseClock.label).toBe('today');
    });
});
