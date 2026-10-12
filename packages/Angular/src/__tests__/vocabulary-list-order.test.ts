import '@angular/compiler';
import { describe, it, expect, afterEach } from 'vitest';
import { RunView } from '@memberjunction/core';
import { MJSDealPipelinePanel } from '../lib/form-panels/deal-form.panels';

/**
 * THE FORM AND THE WORKSPACE MUST OFFER THE SAME LIST IN THE SAME ORDER (sales#146's review).
 *
 * The Deal form listed pipelines alphabetically while `deal-workspace.service.ts` lists them by
 * `DisplayRank ASC, Name ASC`. A rep who uses both sees the same two pipelines in two orders on any
 * host where rank and alphabet do not coincide — and `DisplayRank` exists precisely so a seed can say
 * which pipeline a team reaches for first.
 *
 * ── WHY THIS ASSERTS THE QUERY AND NOT THE RESULT ───────────────────────────────────────────────
 *
 * On the seed this was found against, the two orderings AGREE: B2B is rank 10 and D2C is rank 20, so
 * alphabetical and ranked give the same two rows. A test that loaded the list and checked the names
 * would have passed before the fix and after it, on this host, forever — proving nothing and quietly
 * rotting. The ordering is a property of the QUERY, so the query is what is pinned.
 *
 * `RunView.prototype` is patched rather than the module mocked, which keeps the panel's own wiring
 * real and matches how the server-side suites shadow a base-class method.
 */

const original = RunView.prototype.RunView;
afterEach(() => { RunView.prototype.RunView = original; });

/** Every RunView the panel issues while initialising, by entity name. */
async function ordersRequestedOnInit(): Promise<Map<string, string | undefined>> {
    const seen = new Map<string, string | undefined>();
    RunView.prototype.RunView = (async (params: { EntityName: string; OrderBy?: string }) => {
        seen.set(params.EntityName, params.OrderBy);
        return { Success: true, Results: [] };
    }) as unknown as typeof RunView.prototype.RunView;

    const panel = Object.create(MJSDealPipelinePanel.prototype) as { ngOnInit(): Promise<void> };
    // The signals ngOnInit writes into. `Object.create` runs no field initialisers, so each is stubbed
    // with the only thing that is called on it.
    for (const sig of ['statuses', 'LossReasons', 'pipelines', 'stages']) {
        Object.defineProperty(panel, sig, { value: { set: () => undefined }, writable: true });
    }
    for (const [k, v] of Object.entries({
        ActionFailed: false,
        ActionMessage: '',
        businessZoneLoaded: true,
        Fail: () => undefined,
        ActivityEntity: '',
        refreshView: () => undefined,
    })) {
        Object.defineProperty(panel, k, { value: v, writable: true });
    }
    await panel.ngOnInit();
    return seen;
}

describe('the vocabulary lists the Deal form loads', () => {
    it('orders pipelines by DisplayRank, the way the workspace does', async () => {
        const orders = await ordersRequestedOnInit();
        const pipeline = [...orders.entries()].find(([name]) => /Pipelines$/i.test(name));
        expect(pipeline, 'the panel must load pipelines at all').toBeTruthy();
        expect(
            pipeline?.[1],
            'alphabetical here and ranked in the workspace is the same list in two orders',
        ).toBe('DisplayRank ASC, Name ASC');
    });

    it('still orders stages by DisplayOrder — a stage sequence is not alphabetical', async () => {
        const orders = await ordersRequestedOnInit();
        const stage = [...orders.entries()].find(([name]) => /Pipeline Stages$/i.test(name));
        expect(stage?.[1], 'the stages of a pipeline are a process, in order').toMatch(/^DisplayOrder ASC/);
    });
});
