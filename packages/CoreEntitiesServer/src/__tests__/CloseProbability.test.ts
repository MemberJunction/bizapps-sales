/**
 * A close writes its own probability and forecast category (bc-aidp-next-golive#345).
 *
 * A close declares its transition, which switches the stage defaults off, so before this nothing wrote
 * either field and every closed deal kept the figures it had while open. `resolveClosing` decides the
 * figures and `stampClose` writes them; the reads go through the provider's `RunView`, answered here by
 * entity name so each case states the rows it depends on.
 *
 * The live behaviour, including the stage event still stamping the pre-close value and the reopen
 * restoring it, is proven by `close-deal.CD36`-`CD38` against a database.
 */
import { describe, expect, it } from 'vitest';

import { CloseDealOperation, ReopenDealOperation } from '../CloseDealOperation.js';

const WON = { ID: 'won', IsWon: true, IsLost: false, IsClosed: true, LocksDeal: true };
const LOST = { ID: 'lost', IsWon: false, IsLost: true, IsClosed: true, LocksDeal: true };

interface StageRow {
    ID: string;
    Probability: number | null;
    ForecastCategoryTypeID: string | null;
    DealStatusTypeID: string | null;
}

interface StatusRow {
    ID: string;
    IsWon: boolean;
    IsLost: boolean;
}

interface Resolved {
    StageID: string | null;
    Probability: number | null;
    ForecastCategoryTypeID: string | null;
    Issues: { Severity: string; Field?: string | null; Message: string }[];
}

type Resolver = {
    resolveClosing(
        deal: { PipelineID: string; Pipeline: string; PipelineStage: string | null },
        input: { DealID: string; DealStatusTypeID: string; ClosingStageID?: string },
        target: typeof WON,
        provider: unknown,
        user: unknown,
    ): Promise<Resolved>;
    closingStageForOutcome: (...args: unknown[]) => Promise<string | null>;
};

/** A provider whose `RunView` answers from the given rows, matching on `ID = '...'` filters. */
function providerWith(stages: StageRow[], statuses: StatusRow[]): unknown {
    return {
        RunView: async (params: { EntityName: string; ExtraFilter: string }) => {
            const id = /ID = '([^']+)'/.exec(params.ExtraFilter)?.[1];
            const rows: Record<string, unknown>[] = params.EntityName.endsWith('Pipeline Stages')
                ? stages.filter((s) => s.ID === id)
                : statuses.filter((s) => s.ID === id);
            return { Success: true, Results: rows };
        },
    };
}

const STATUSES: StatusRow[] = [
    { ID: 'st-won', IsWon: true, IsLost: false },
    { ID: 'st-lost', IsWon: false, IsLost: true },
    { ID: 'st-open', IsWon: false, IsLost: false },
];

const DEAL = { PipelineID: 'p1', Pipeline: 'Direct', PipelineStage: 'Proposal' };

async function resolve(
    target: typeof WON,
    derivedStageID: string | null,
    stages: StageRow[],
    closingStageID?: string,
): Promise<Resolved> {
    const op = Object.create(CloseDealOperation.prototype) as Resolver;
    op.closingStageForOutcome = async () => derivedStageID;
    return op.resolveClosing(
        DEAL,
        { DealID: 'd1', DealStatusTypeID: target.ID, ...(closingStageID ? { ClosingStageID: closingStageID } : {}) },
        target,
        providerWith(stages, STATUSES),
        { ID: 'u1' },
    );
}

describe('resolveClosing: the figures a close writes', () => {
    it('takes the closing stage\'s probability and forecast category when its status declares the same outcome', async () => {
        const r = await resolve(WON, 'signed', [
            { ID: 'signed', Probability: 100, ForecastCategoryTypeID: 'fc-closed', DealStatusTypeID: 'st-won' },
        ]);
        expect(r).toEqual({ StageID: 'signed', Probability: 100, ForecastCategoryTypeID: 'fc-closed', Issues: [] });
    });

    it('uses a stage value that is not 100, so the number really comes from the stage', async () => {
        const r = await resolve(WON, 'signed', [
            { ID: 'signed', Probability: 95, ForecastCategoryTypeID: 'fc-closed', DealStatusTypeID: 'st-won' },
        ]);
        expect(r.Probability).toBe(95);
    });

    it('falls back to 100 for a won close when the stage carries no probability', async () => {
        const r = await resolve(WON, 'signed', [
            { ID: 'signed', Probability: null, ForecastCategoryTypeID: 'fc-closed', DealStatusTypeID: 'st-won' },
        ]);
        expect(r.Probability).toBe(100);
        expect(r.ForecastCategoryTypeID).toBe('fc-closed');
    });

    it('falls back to 0 for a lost close with no stage, leaves the category alone, and warns', async () => {
        const r = await resolve(LOST, null, []);
        expect(r.StageID).toBeNull();
        expect(r.Probability).toBe(0);
        expect(r.ForecastCategoryTypeID).toBeNull();
        expect(r.Issues).toHaveLength(1);
        expect(r.Issues[0].Severity).toBe('warning');
        expect(r.Issues[0].Field).toBe('PipelineStageID');
        expect(r.Issues[0].Message).toContain('no active lost stage');
        expect(r.Issues[0].Message).toContain('Direct');
        expect(r.Issues[0].Message).toContain('Proposal');
    });

    it('ignores the stage\'s figures when its status contradicts the close (lost into a won stage)', async () => {
        const r = await resolve(
            LOST,
            null,
            [{ ID: 'signed', Probability: 100, ForecastCategoryTypeID: 'fc-closed', DealStatusTypeID: 'st-won' }],
            'signed',
        );
        expect(r.StageID).toBe('signed');
        expect(r.Probability).toBe(0);
        expect(r.ForecastCategoryTypeID).toBeNull();
        expect(r.Issues).toEqual([]);
    });

    it('ignores an open stage the caller named, and does not warn because the caller chose a stage', async () => {
        const r = await resolve(
            WON,
            null,
            [{ ID: 'proposal', Probability: 50, ForecastCategoryTypeID: 'fc-best', DealStatusTypeID: 'st-open' }],
            'proposal',
        );
        expect(r.Probability).toBe(100);
        expect(r.ForecastCategoryTypeID).toBeNull();
        expect(r.Issues).toEqual([]);
    });

    it('a close that is neither won nor lost writes no probability', async () => {
        const closedOther = { ID: 'other', IsWon: false, IsLost: false, IsClosed: true, LocksDeal: true };
        const r = await resolve(closedOther, null, []);
        expect(r.Probability).toBeNull();
        expect(r.Issues).toEqual([]);
    });
});

describe('stampClose writes the resolved figures', () => {
    type Stamp = {
        stampClose(
            deal: Record<string, unknown>,
            input: { DealID: string; DealStatusTypeID: string },
            target: { ID: string },
            routing: never[],
            user: { ID: string },
            closing: Resolved,
            lossReasonName: string | null,
        ): void;
    };

    function stamp(closing: Resolved): Record<string, unknown> {
        const deal: Record<string, unknown> = {
            CompanyID: 'c1',
            PipelineStageID: 'proposal',
            Probability: 50,
            ForecastCategoryTypeID: 'fc-best',
            DeclareTransition: () => undefined,
        };
        const op = Object.create(CloseDealOperation.prototype) as Stamp;
        op.stampClose(deal, { DealID: 'd1', DealStatusTypeID: 'won' }, { ID: 'won' }, [], { ID: 'u1' }, closing, null);
        return deal;
    }

    it('moves the stage and writes the probability and category', () => {
        const deal = stamp({ StageID: 'signed', Probability: 100, ForecastCategoryTypeID: 'fc-closed', Issues: [] });
        expect(deal.PipelineStageID).toBe('signed');
        expect(deal.Probability).toBe(100);
        expect(deal.ForecastCategoryTypeID).toBe('fc-closed');
    });

    it('leaves what the close has nothing to say about', () => {
        const deal = stamp({ StageID: null, Probability: null, ForecastCategoryTypeID: null, Issues: [] });
        expect(deal.PipelineStageID).toBe('proposal');
        expect(deal.Probability).toBe(50);
        expect(deal.ForecastCategoryTypeID).toBe('fc-best');
    });
});

describe('reopenLanding: where a reopened deal goes', () => {
    type Landing = {
        reopenLanding(
            requestedStageID: string | null,
            undone: { FromStageID: string | null } | null,
            currentStageID: string | null,
        ): { StageID: string | null; StageMoves: boolean; ClearsStage: boolean };
    };
    const op = Object.create(ReopenDealOperation.prototype) as Landing;

    it('clears the stage of a deal that had none before the close', () => {
        expect(op.reopenLanding(null, { FromStageID: null }, 'signed')).toEqual({
            StageID: null,
            StageMoves: true,
            ClearsStage: true,
        });
    });

    it('restores the stage the close event left', () => {
        expect(op.reopenLanding(null, { FromStageID: 'proposal' }, 'signed')).toEqual({
            StageID: 'proposal',
            StageMoves: true,
            ClearsStage: false,
        });
    });

    it('takes the stage the caller named over the close event', () => {
        expect(op.reopenLanding('discovery', { FromStageID: null }, 'signed').StageID).toBe('discovery');
    });

    it('leaves the stage alone when no close event was found', () => {
        expect(op.reopenLanding(null, null, 'signed')).toEqual({ StageID: null, StageMoves: false, ClearsStage: false });
    });

    it('has nothing to clear when the close left the deal without a stage', () => {
        expect(op.reopenLanding(null, { FromStageID: null }, null).ClearsStage).toBe(false);
    });

    it('does not count a restore into the current stage as a move, in any case', () => {
        expect(op.reopenLanding(null, { FromStageID: 'SIGNED' }, 'signed').StageMoves).toBe(false);
    });
});
