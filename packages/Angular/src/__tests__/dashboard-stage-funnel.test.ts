/**
 * @fileoverview The Stage mix card shows one pipeline's stages at a time, in that pipeline's order.
 *
 * It used to key on the stage NAME and sort every pipeline's stages into one sequence, so two
 * pipelines interleaved and stages sharing a name merged.
 */
import { describe, expect, it } from 'vitest';

import { FunnelPipelines, StageFunnel } from '../lib/pages/dashboard-inspect';
import type { CompanyPipeline } from '../lib/data/company-pipelines';
import { RosterRow } from './helpers/roster-row';

const b2b = (stageID: string | null, stage: string | null, order: number | null, ID = stageID ?? 'none') =>
    RosterRow({ ID: `b2b-${ID}`, IsOpen: true, Amount: 10, PipelineID: 'P-B2B', Pipeline: 'B2B', PipelineStageID: stageID, PipelineStage: stage, StageOrder: order });
const d2c = (stageID: string, stage: string, order: number) =>
    RosterRow({ ID: `d2c-${stageID}`, IsOpen: true, Amount: 5, PipelineID: 'P-D2C', Pipeline: 'D2C', PipelineStageID: stageID, PipelineStage: stage, StageOrder: order });

const ROSTER = [
    b2b('S-B-QUAL', 'Qualify', 1),
    b2b('S-B-PROP', 'Proposal', 3),
    b2b(null, null, null),
    d2c('S-D-QUAL', 'Qualify', 1),
    d2c('S-D-TRIAL', 'Trial', 2),
    RosterRow({ ID: 'won', IsWon: true, PipelineID: 'P-B2B', PipelineStageID: 'S-B-WON', PipelineStage: 'Won', StageOrder: 9 }),
];

const pipeline = (ID: string, Name: string, IsDefault: boolean, DisplayRank: number): CompanyPipeline =>
    ({ ID, Name, Code: Name, CompanyID: 'CO-1', CompanyName: 'Company', IsDefault, DisplayRank });

describe('StageFunnel', () => {
    it('keeps same-named stages of two pipelines apart', () => {
        const b = StageFunnel(ROSTER, 'P-B2B');
        const d = StageFunnel(ROSTER, 'P-D2C');
        expect(b.find((s) => s.Label === 'Qualify')?.Count).toBe(1);
        expect(d.find((s) => s.Label === 'Qualify')?.Count).toBe(1);
        expect(b.map((s) => s.Key)).not.toContain('s-d-qual');
    });

    it("follows each pipeline's own stage order, with unstaged deals last", () => {
        expect(StageFunnel(ROSTER, 'P-B2B').map((s) => s.Label)).toEqual(['Qualify', 'Proposal', 'Unstaged']);
        expect(StageFunnel(ROSTER, 'P-D2C').map((s) => s.Label)).toEqual(['Qualify', 'Trial']);
    });

    it('matches the pipeline ID whatever its case', () => {
        expect(StageFunnel(ROSTER, 'p-d2c')).toHaveLength(2);
    });
});

describe('FunnelPipelines', () => {
    it('lists the pipelines with open deals, default pipeline first', () => {
        const lookups = [pipeline('P-B2B', 'B2B', false, 10), pipeline('P-D2C', 'D2C', true, 20), pipeline('P-EMPTY', 'Empty', false, 30)];
        expect(FunnelPipelines(ROSTER, lookups).map((p) => p.ID)).toEqual(['P-D2C', 'P-B2B']);
    });

    it('works from the roster alone before the lookups load', () => {
        expect(FunnelPipelines(ROSTER).map((p) => p.Name)).toEqual(['B2B', 'D2C']);
    });
});
