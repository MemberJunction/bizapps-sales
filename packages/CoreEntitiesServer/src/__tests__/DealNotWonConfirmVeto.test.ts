import { describe, expect, it, vi, afterEach } from 'vitest';
import { RunView } from '@memberjunction/core';
import { DealNotWonConfirmVeto } from '../DealNotWonConfirmVeto.js';

/**
 * AN ORDER WHOSE DEAL IS NOT WON MAY NOT BE CONFIRMED (bc-aidp-next-golive#323).
 *
 * A deal closed Won mints an order. The deal is reopened to Open, and twenty seconds later the order
 * is confirmed from the order screen and books: a booking entry, a subscription and twelve
 * recognition entries, against a deal sitting Open at 75%. Sales already refuses the reverse —
 * `Sales.ReopenDeal` will not reopen a deal whose order has booked. This is that rule facing the
 * other way, answered through Orders' confirm seam.
 *
 * `RunView.prototype` is patched rather than the module mocked, which keeps the class's own wiring
 * real and matches how `vocabulary-list-order` and the server suites shadow a method.
 */

const ORDER = 'oooooooo-0000-4000-8000-000000000001';
const DEAL = 'dddddddd-0000-4000-8000-000000000001';
const WON = 'ssssssss-0000-4000-8000-00000000win1';
const OPEN = 'ssssssss-0000-4000-8000-0000000open1';

const original = RunView.prototype.RunView;
afterEach(() => { RunView.prototype.RunView = original; });

type Deal = { ID: string; DealNumber: string | null; DealStatusTypeID: string | null };

/**
 * @param deal the row `Deal WHERE OrderID = ...` returns, or null for an order no deal points at.
 * @param statuses IsWon by status id.
 */
function withData(deal: Deal | null, statuses: Record<string, boolean>, fail?: 'deal' | 'status') {
    const asked: string[] = [];
    RunView.prototype.RunView = (async ({ EntityName, ExtraFilter }: { EntityName: string; ExtraFilter: string }) => {
        asked.push(EntityName);
        if (EntityName.includes('Deal Status Types')) {
            if (fail === 'status') return { Success: false, ErrorMessage: 'status view is down', Results: [] };
            const id = /ID = '([^']+)'/.exec(ExtraFilter)?.[1] ?? '';
            return { Success: true, Results: id in statuses ? [{ IsWon: statuses[id] }] : [] };
        }
        if (fail === 'deal') return { Success: false, ErrorMessage: 'deal view is down', Results: [] };
        return { Success: true, Results: deal ? [deal] : [] };
    }) as unknown as typeof RunView.prototype.RunView;
    return { asked };
}

const ctx = { OrderHeaderID: ORDER, FromStatus: 'Quoted', ContextUser: null };
const veto = () => new DealNotWonConfirmVeto();

describe('an order whose deal is won', () => {
    it('may be confirmed', async () => {
        withData({ ID: DEAL, DealNumber: 'DEAL-002148', DealStatusTypeID: WON }, { [WON]: true });
        expect(await veto().MayConfirm(ctx)).toBeNull();
    });
});

describe('an order whose deal is not won', () => {
    it('is refused', async () => {
        withData({ ID: DEAL, DealNumber: 'DEAL-002148', DealStatusTypeID: OPEN }, { [OPEN]: false });
        expect(await veto().MayConfirm(ctx)).not.toBeNull();
    });

    it('names the deal, so the rep knows which one to close', async () => {
        withData({ ID: DEAL, DealNumber: 'DEAL-002148', DealStatusTypeID: OPEN }, { [OPEN]: false });
        const refusal = (await veto().MayConfirm(ctx)) ?? '';
        expect(refusal).toContain('DEAL-002148');
        expect(refusal, 'and says what to do').toContain('Close the deal as Won');
    });

    it('falls back to the deal id when it has no number', async () => {
        withData({ ID: DEAL, DealNumber: null, DealStatusTypeID: OPEN }, { [OPEN]: false });
        expect((await veto().MayConfirm(ctx)) ?? '').toContain(DEAL);
    });

    /** A deal with no status cannot be Won; booking against it would be a decision made by absence. */
    it('is refused when the deal has no status at all', async () => {
        withData({ ID: DEAL, DealNumber: 'DEAL-1', DealStatusTypeID: null }, {});
        expect(await veto().MayConfirm(ctx)).not.toBeNull();
    });

    /** An absent status ROW is as unanswerable as a missing id, and is not a win. */
    it('is refused when the status row has gone', async () => {
        withData({ ID: DEAL, DealNumber: 'DEAL-1', DealStatusTypeID: OPEN }, {});
        expect(await veto().MayConfirm(ctx)).not.toBeNull();
    });
});

/**
 * BY FLAG, NEVER BY NAME. "Won" is not the only winning status a deployment may run, and a renamed
 * one would silently stop matching. This asserts the flag decides — a status NAMED nothing like a win
 * still allows the confirm when `IsWon` is true.
 */
describe('the decision is the IsWon flag', () => {
    it('allows a winning status whatever it is called', async () => {
        withData({ ID: DEAL, DealNumber: 'DEAL-1', DealStatusTypeID: 'ssssssss-0000-4000-8000-00000closed' }, {
            'ssssssss-0000-4000-8000-00000closed': true,
        });
        expect(await veto().MayConfirm(ctx)).toBeNull();
    });

    it('reads the status types entity, not a name on the deal', async () => {
        const { asked } = withData({ ID: DEAL, DealNumber: 'DEAL-1', DealStatusTypeID: WON }, { [WON]: true });
        await veto().MayConfirm(ctx);
        expect(asked.some((e) => e.includes('Deal Status Types'))).toBe(true);
    });
});

/**
 * AN ORDER WITH NO DEAL IS NOT THIS APP'S BUSINESS. Orders are created directly too — most on the
 * reporting host were. Refusing those would make installing Sales break ordinary ordering, which is
 * the failure a seam exists to avoid.
 */
describe('an order no deal points at', () => {
    it('is allowed without comment', async () => {
        withData(null, {});
        expect(await veto().MayConfirm(ctx)).toBeNull();
    });

    it('does not even look up a status', async () => {
        const { asked } = withData(null, {});
        await veto().MayConfirm(ctx);
        expect(asked.some((e) => e.includes('Deal Status Types'))).toBe(false);
    });
});

/**
 * A READ THAT FAILS THROWS, and the seam turns that into a refusal naming the fault. Returning null
 * would confirm on "could not tell", which books against a possibly-open deal — the outcome this
 * exists to prevent, by another route.
 */
describe('when a read fails', () => {
    it('throws rather than allowing, when the deal cannot be read', async () => {
        withData(null, {}, 'deal');
        await expect(veto().MayConfirm(ctx)).rejects.toThrow(/deal behind this order could not be read/);
    });

    it('throws rather than allowing, when the status cannot be read', async () => {
        withData({ ID: DEAL, DealNumber: 'DEAL-1', DealStatusTypeID: WON }, {}, 'status');
        await expect(veto().MayConfirm(ctx)).rejects.toThrow(/status could not be read/);
    });
});
