import '@angular/compiler';
import { describe, it, expect, afterEach } from 'vitest';
import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { RunView } from '@memberjunction/core';
import type { mjBizAppsOrdersOrderHeaderEntity } from '@mj-biz-apps/orders-entities';
import { MJSOrderRelatedPanel } from '../lib/form-panels/order-related.panel';

/**
 * bc-aidp-next-golive#443: the order header's "No executed agreement" warning, through the panel.
 *
 * `NoExecutedAgreementWarning` is tested on its own in `order-related-links.test.ts`. What these pin is
 * the panel FEEDING it: that a contract read the server refused is not reported as "no contract", and
 * that a reversal or a voided order gets no warning. `RunView.prototype` is patched rather than the
 * module mocked, so the panel's own reads and wiring stay real.
 */

const ORDER = 'O0000000-0000-4000-8000-000000000001';
const ORIGINAL = 'O0000000-0000-4000-8000-000000000002';
const DEAL = 'D1B0F0A6-0000-4000-8000-000000000001';
const WON = 'S0000000-0000-4000-8000-000000000001';

const originalRunView = RunView.prototype.RunView;
const originalRunViews = RunView.prototype.RunViews;
afterEach(() => {
    RunView.prototype.RunView = originalRunView;
    RunView.prototype.RunViews = originalRunViews;
});

/**
 * A won deal names the order; the contract read answers with `contracts`. `Success: false` is a refusal.
 */
function stubReads(contracts: { Success: boolean; Results: unknown[] }): void {
    RunView.prototype.RunView = (async () => ({
        Success: true,
        Results: [{ ID: DEAL, ContractID: null, DealStatusTypeID: WON }],
    })) as unknown as typeof RunView.prototype.RunView;
    RunView.prototype.RunViews = (async () => [
        contracts,
        { Success: true, Results: [{ ID: WON, IsWon: true }] },
    ]) as unknown as typeof RunView.prototype.RunViews;
}

async function loadPanel(order: Partial<mjBizAppsOrdersOrderHeaderEntity>): Promise<MJSOrderRelatedPanel> {
    const injector = Injector.create({ providers: [{ provide: ChangeDetectorRef, useValue: { detectChanges: () => undefined } }] });
    const panel = runInInjectionContext(injector, () => new MJSOrderRelatedPanel());
    panel.Record = { ID: ORDER, Status: 'Confirmed', ReversesOrderHeaderID: null, ...order } as unknown as mjBizAppsOrdersOrderHeaderEntity;
    await (panel as unknown as { load(): Promise<void> }).load();
    return panel;
}

describe('#443 — the panel feeds the warning only what it learned', () => {
    it('warns when the contract read answered with no contract', async () => {
        stubReads({ Success: true, Results: [] });
        const panel = await loadPanel({});
        expect(panel.ContractView.Warning?.Label).toBe('No executed agreement');
    });

    /** A refusal is not evidence the contract is missing: warning would tell finance something untrue. */
    it('says nothing when the contract read was refused', async () => {
        stubReads({ Success: false, Results: [] });
        const panel = await loadPanel({});
        expect(panel.ContractView.Warning).toBeNull();
        expect(panel.Links.map((l) => l.Key)).toContain('deal');
    });

    /** The deal names the original order; a reversal of it is not missing anything of its own. */
    it('says nothing for a reversal of a won deal\'s order', async () => {
        stubReads({ Success: true, Results: [] });
        const panel = await loadPanel({ ReversesOrderHeaderID: ORIGINAL });
        expect(panel.ContractView.Warning).toBeNull();
        expect(panel.Links.map((l) => l.Key)).toContain('deal');
    });

    /** A voided order sends no invoice, so "Invoices still send" would be untrue. */
    it('says nothing for a voided order', async () => {
        stubReads({ Success: true, Results: [] });
        const panel = await loadPanel({ Status: 'Voided' });
        expect(panel.ContractView.Warning).toBeNull();
    });
});
