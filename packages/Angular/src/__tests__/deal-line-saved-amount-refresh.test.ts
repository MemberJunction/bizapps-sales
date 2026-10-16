import '@angular/compiler';
import { readFileSync } from 'node:fs';
import { EventEmitter } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { MJSDealLinesPanel } from '../lib/form-panels/deal-form.panels';
import { DealFormComponentExtended } from '../lib/custom/deal-form.component';

/**
 * After a product is saved, the deal save that refreshes its amount is checked (#271).
 *
 * The products panel saves the deal with `IgnoreDirtyState` so the entity server pulls the order's new
 * total into `Amount`. That save's result was thrown away, and because it bypasses `SaveRecord`, nothing
 * else reported a refusal or re-checked the stale-amount notices either.
 */

interface SaveStub {
    Save(): Promise<boolean>;
    LatestResult: { CompleteMessage: string } | null;
}

function panel(record: SaveStub, form: Record<string, unknown> = {}): MJSDealLinesPanel {
    const p = new MJSDealLinesPanel();
    Object.defineProperty(p, 'Record', { value: record, configurable: true });
    Object.defineProperty(p, 'FormComponent', { value: form, configurable: true });
    Object.defineProperty(p, 'lineCards', { value: { Refresh: async () => {} }, configurable: true });
    return p;
}

describe('the products panel checks the deal save after a line save', () => {
    it('says so beside the products when the deal save is refused', async () => {
        const p = panel({ Save: async () => false, LatestResult: { CompleteMessage: 'Close date is required.' } });

        await p.OnLineSaved();

        const message = p.AmountRefreshError();
        expect(message, 'a refused save must not be silent').not.toBeNull();
        expect(message).toMatch(/product is saved/);
        expect(message).toMatch(/deal amount could not be updated/);
        expect(message, 'the reason the save gave').toMatch(/Close date is required/);
        expect(message, 'no doubled full stop after the reason').not.toMatch(/\.\./);
    });

    it('tells the form on success, so its notices and the hero re-check', async () => {
        let refreshed = 0;
        const p = panel(
            { Save: async () => true, LatestResult: null },
            { RefreshDealState: async () => { refreshed++; } },
        );

        await p.OnLineSaved();

        expect(refreshed).toBe(1);
        expect(p.AmountRefreshError()).toBeNull();
    });

    it('does not tell the form when the save was refused', async () => {
        let refreshed = 0;
        const p = panel(
            { Save: async () => false, LatestResult: null },
            { RefreshDealState: async () => { refreshed++; } },
        );

        await p.OnLineSaved();

        expect(refreshed).toBe(0);
        expect(p.AmountRefreshError(), 'a fallback reason when the result carries none').toMatch(/save was refused/);
    });

    it('clears the message on the next line save', async () => {
        let ok = false;
        const p = panel({ Save: async () => ok, LatestResult: null });
        await p.OnLineSaved();
        expect(p.AmountRefreshError()).not.toBeNull();

        ok = true;
        await p.OnLineSaved();
        expect(p.AmountRefreshError()).toBeNull();
    });

    it('clears the message when the form saves the deal', async () => {
        const recordSaved = new EventEmitter<unknown>();
        const p = panel({ Save: async () => false, LatestResult: null }, { RecordSaved: recordSaved });
        p.ngOnInit();
        await p.OnLineSaved();
        expect(p.AmountRefreshError()).not.toBeNull();

        recordSaved.emit({});
        expect(p.AmountRefreshError()).toBeNull();
        p.ngOnDestroy();
    });
});

describe('the deal form re-resolves its state on request', () => {
    it('re-resolves the lock and amount notices, then tells the panels', async () => {
        const calls: string[] = [];
        const form = Object.create(DealFormComponentExtended.prototype) as DealFormComponentExtended;
        Object.defineProperty(form, 'DealStateRefreshed', { value: new EventEmitter<void>() });
        Object.defineProperty(form, 'resolveDealState', { value: async () => { calls.push('resolve'); } });
        form.DealStateRefreshed.subscribe(() => calls.push('emit'));

        await form.RefreshDealState();

        expect(calls).toEqual(['resolve', 'emit']);
    });

    it('the hero listens for it', () => {
        const source = readFileSync(new URL('../lib/form-panels/deal-hero.panel.ts', import.meta.url), 'utf8');
        expect(source).toMatch(/DealStateRefreshed\?\.subscribe\(\(\) => \{\s*void this\.refreshNotices\(\);/);
        expect(source, 'and stops listening when destroyed').toMatch(/dealStateSubscription\?\.unsubscribe\(\)/);
    });
});
