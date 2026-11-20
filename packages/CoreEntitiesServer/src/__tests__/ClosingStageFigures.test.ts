import { describe, expect, it } from 'vitest';
import { DealEntityServer } from '../DealEntityServer.js';

/**
 * A plain save that moves an open deal into a stage whose status locks takes none of that stage's
 * figures: no probability, no forecast category, no order status. Only a save that closes the deal into
 * the stage (a declared close, or a create that is already closed) applies them.
 *
 * `Object.create` holds the server entity without metadata; the stage and status reads are answered from
 * in-memory rows.
 */

const OPEN = 'aaaaaaaa-0000-4000-8000-000000000001';
const WON = 'aaaaaaaa-0000-4000-8000-000000000002';
const OPEN_STAGE = 'bbbbbbbb-0000-4000-8000-000000000001';
const WON_STAGE = 'bbbbbbbb-0000-4000-8000-000000000002';
const PRIOR_STAGE = 'bbbbbbbb-0000-4000-8000-000000000003';

const STAGES: Record<string, Record<string, unknown>> = {
    [OPEN_STAGE]: { Probability: 30, ForecastCategoryTypeID: 'fc-pipeline', DealStatusTypeID: OPEN, OrderStatusOnEntry: 'Quoted' },
    [WON_STAGE]: { Probability: 100, ForecastCategoryTypeID: 'fc-closed', DealStatusTypeID: WON, OrderStatusOnEntry: 'Quoted' },
};
const STATUSES: Record<string, { LocksDeal: boolean; IsLost: boolean }> = {
    [OPEN]: { LocksDeal: false, IsLost: false },
    [WON]: { LocksDeal: true, IsLost: false },
};

type Plans = {
    planStageDefaults(): Promise<{ Probability: number | null; ForecastCategoryTypeID: string | null; DealStatusTypeID: string | null } | null>;
    planStageOrderStatus(): Promise<{ StageID: string; Target: string } | null>;
};

function deal(opts: {
    stage: string;
    saved?: boolean;
    status?: string | null;
    declared?: 'Close' | 'Reopen' | null;
    previous?: string;
}): Plans {
    const instance = Object.create(DealEntityServer.prototype) as Plans;
    const define = (name: string, value: unknown) => Object.defineProperty(instance, name, { value, writable: true });
    define('IsSaved', opts.saved ?? true);
    define('PipelineStageID', opts.stage);
    define('DealStatusTypeID', opts.status ?? OPEN);
    define('_declaredTransition', opts.declared ? { Kind: opts.declared, Note: null } : null);
    define('_orderJustProvisioned', false);
    define('_orderStatusWarnings', []);
    define('ContextCurrentUser', { ID: 'u1' });
    define('GetFieldByName', () => ({ Dirty: true, OldValue: opts.previous ?? PRIOR_STAGE }));
    define('ProviderToUse', {
        RunView: async ({ EntityName, ExtraFilter }: { EntityName: string; ExtraFilter: string }) => {
            const id = /ID = '([^']+)'/.exec(ExtraFilter)?.[1] ?? '';
            const row = EntityName.endsWith('Pipeline Stages') ? STAGES[id] : STATUSES[id];
            return { Success: true, Results: row ? [row] : [] };
        },
    });
    return instance;
}

describe('a plain move into a stage whose status locks', () => {
    it('takes none of the stage defaults, so the deal keeps its own probability and forecast category', async () => {
        expect(await deal({ stage: WON_STAGE }).planStageDefaults()).toBeNull();
    });

    it('leaves the order status alone', async () => {
        expect(await deal({ stage: WON_STAGE }).planStageOrderStatus()).toBeNull();
    });

    it('still leaves the order alone on a declared reopen', async () => {
        expect(await deal({ stage: WON_STAGE, declared: 'Reopen' }).planStageOrderStatus()).toBeNull();
    });
});

describe('a save that closes the deal into the stage', () => {
    it('applies the order status on a declared close', async () => {
        expect(await deal({ stage: WON_STAGE, declared: 'Close' }).planStageOrderStatus()).toEqual({
            StageID: WON_STAGE,
            Target: 'Quoted',
        });
    });

    it('applies the order status on a declared close into the stage the deal already sits in', async () => {
        const parked = deal({ stage: WON_STAGE, declared: 'Close', previous: WON_STAGE });
        expect(await parked.planStageOrderStatus()).toEqual({ StageID: WON_STAGE, Target: 'Quoted' });
    });

    it('applies the figures, but not the status, to a create that is already closed', async () => {
        const created = deal({ stage: WON_STAGE, saved: false, status: WON });
        expect(await created.planStageDefaults()).toEqual({
            Probability: 100,
            ForecastCategoryTypeID: 'fc-closed',
            DealStatusTypeID: null,
        });
        expect(await created.planStageOrderStatus()).toEqual({ StageID: WON_STAGE, Target: 'Quoted' });
    });

    it('takes nothing for a create that is open', async () => {
        const created = deal({ stage: WON_STAGE, saved: false, status: OPEN });
        expect(await created.planStageDefaults()).toBeNull();
        expect(await created.planStageOrderStatus()).toBeNull();
    });
});

describe('a move into an open stage is unchanged', () => {
    it('asks nothing of the order when the stage did not move', async () => {
        expect(await deal({ stage: OPEN_STAGE, previous: OPEN_STAGE }).planStageOrderStatus()).toBeNull();
    });

    it('takes the stage figures and status', async () => {
        expect(await deal({ stage: OPEN_STAGE }).planStageDefaults()).toEqual({
            Probability: 30,
            ForecastCategoryTypeID: 'fc-pipeline',
            DealStatusTypeID: OPEN,
        });
    });

    it('takes the order status', async () => {
        expect(await deal({ stage: OPEN_STAGE }).planStageOrderStatus()).toEqual({
            StageID: OPEN_STAGE,
            Target: 'Quoted',
        });
    });
});
