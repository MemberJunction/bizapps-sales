import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import { StageMoveHintsFor, type StageMoveState } from '../lib/form-panels/deal-stage-preview';
import { MJSDealPipelinePanel, type PipelineStageOption } from '../lib/form-panels/deal-form.panels';

/**
 * sales#247: move a saved deal to another stage and Probability kept showing the old number until the
 * save replaced it with the stage's, with nothing on the form saying so. The Pipeline panel now says
 * what the save will write — and still does not write it, because the server is the one writer.
 *
 * The hint has to agree with `DealEntityServer.applyStageDefaults` or it misleads in a new way: on a
 * saved deal an untouched field takes the stage's value, null included, only when the stage moved.
 */

const STAGES: PipelineStageOption[] = [
    { ID: 's-disc', Name: 'Discovery', PipelineID: 'p', Probability: 10, ForecastCategoryTypeID: 'fc-pipe', ForecastCategoryType: 'Pipeline' },
    { ID: 's-prop', Name: 'Proposal', PipelineID: 'p', Probability: 50, ForecastCategoryTypeID: 'fc-best', ForecastCategoryType: 'Best case' },
    { ID: 's-none', Name: 'Parked', PipelineID: 'p', Probability: null, ForecastCategoryTypeID: null, ForecastCategoryType: null },
];

const MOVED: StageMoveState = {
    IsSaved: true,
    LoadedStageID: 's-disc',
    PipelineStageID: 's-prop',
    ProbabilityEdited: false,
    ForecastCategoryEdited: false,
    Probability: 10,
    ForecastCategoryTypeID: 'fc-pipe',
};

const hints = (over: Partial<StageMoveState>) => StageMoveHintsFor({ ...MOVED, ...over }, STAGES);

describe('the rule', () => {
    it('names what the save will write after a stage move', () => {
        const h = hints({});
        expect(h.Probability).toBe('Becomes 50% on save, from Proposal. Type a value to keep your own.');
        expect(h.ForecastCategoryTypeID).toBe('Becomes Best case on save, from Proposal. Pick one to keep your own.');
    });

    it('says nothing when the stage did not move — the server leaves both fields alone then', () => {
        expect(hints({ PipelineStageID: 's-disc' })).toEqual({ Probability: null, ForecastCategoryTypeID: null });
    });

    it('says nothing about a field the rep edited — the server keeps it', () => {
        expect(hints({ ProbabilityEdited: true, ForecastCategoryEdited: true }))
            .toEqual({ Probability: null, ForecastCategoryTypeID: null });
    });

    it('says nothing when the value already matches the stage', () => {
        expect(hints({ Probability: 50 }).Probability).toBeNull();
    });

    it('warns that a stage with no defaults clears them, because the server writes that null too', () => {
        const h = hints({ PipelineStageID: 's-none' });
        expect(h.Probability).toBe('Becomes empty on save, from Parked. Type a value to keep your own.');
        expect(h.ForecastCategoryTypeID).toBe('Becomes empty on save, from Parked. Pick one to keep your own.');
    });

    it('says nothing on a new deal — the panel does not show these fields until it is saved', () => {
        expect(hints({ IsSaved: false, LoadedStageID: null })).toEqual({ Probability: null, ForecastCategoryTypeID: null });
    });

    it('compares ids without regard to case, as they round-trip through JSON', () => {
        expect(hints({ PipelineStageID: 'S-DISC' }).Probability).toBeNull();
    });
});

/** A saved deal, as far as the panel reads it: values, plus each field's OldValue and Dirty. */
function savedDeal(loadedStage: string, values: { PipelineStageID: string; Probability: number | null; ForecastCategoryTypeID: string | null }, dirty: string[] = []) {
    const old: Record<string, unknown> = { PipelineStageID: loadedStage };
    return {
        IsSaved: true,
        PipelineID: 'p',
        ...values,
        GetFieldByName: (name: string) => ({ OldValue: old[name] ?? null, Dirty: dirty.includes(name) || name === 'PipelineStageID' }),
    } as unknown as DealEntity;
}

function panelFor(record: DealEntity) {
    const panel = new MJSDealPipelinePanel();
    Object.defineProperty(panel, 'Record', { value: record, configurable: true, writable: true });
    (panel as unknown as { stages: { set(v: PipelineStageOption[]): void } }).stages.set(STAGES);
    return panel;
}

describe('the Pipeline panel', () => {
    it('reads the deal\'s loaded stage and edits, and hints under the two fields only', () => {
        const panel = panelFor(savedDeal('s-disc', { PipelineStageID: 's-prop', Probability: 10, ForecastCategoryTypeID: 'fc-pipe' }));
        expect(panel.StageMoveHint('Probability')).toBe('Becomes 50% on save, from Proposal. Type a value to keep your own.');
        expect(panel.StageMoveHint('ForecastCategoryTypeID')).toContain('Best case');
        expect(panel.StageMoveHint('DealTypeID')).toBeNull();
    });

    it('drops the hint for a field the rep has typed into', () => {
        const panel = panelFor(savedDeal('s-disc', { PipelineStageID: 's-prop', Probability: 20, ForecastCategoryTypeID: 'fc-pipe' }, ['Probability']));
        expect(panel.StageMoveHint('Probability')).toBeNull();
    });

    it('still writes nothing on a stage change', () => {
        const record = savedDeal('s-disc', { PipelineStageID: 's-disc', Probability: 10, ForecastCategoryTypeID: 'fc-pipe' });
        panelFor(record).SetStage('s-prop');
        expect(record.Probability).toBe(10);
        expect(record.ForecastCategoryTypeID).toBe('fc-pipe');
    });

    it('binds the hint in the template', () => {
        const source = readFileSync(
            resolve(dirname(fileURLToPath(import.meta.url)), '../lib/form-panels/deal-form.panels.ts'),
            'utf8',
        );
        expect(source).toContain('StageMoveHint(f.name)');
    });
});
