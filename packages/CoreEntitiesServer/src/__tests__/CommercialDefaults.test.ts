import { describe, expect, it } from 'vitest';
import { DealEntityServer } from '../DealEntityServer.js';
import { CloseTermMonths, PipelineDefaultTermMonths, PlanCommercialDefaults } from '../deal-commercial-defaults.js';

/**
 * golive #486: a deal's empty term and start date fill from the pipeline and the expected close date,
 * and the deal's own term beats the pipeline's at close.
 */

const PIPELINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const CLOSE = new Date(Date.UTC(2026, 11, 15));

describe('the pipeline default term', () => {
    it('reads TermMonths from the Close Won Policy', () => {
        expect(PipelineDefaultTermMonths('{"CreateContract":true,"TermMonths":24}')).toBe(24);
    });

    it('is null for no policy, bad JSON, or a term that is not a positive whole number', () => {
        for (const policy of [null, undefined, '', '{', '[]', '{"TermMonths":0}', '{"TermMonths":1.5}', '{"TermMonths":"12"}', '{}']) {
            expect(PipelineDefaultTermMonths(policy), String(policy)).toBeNull();
        }
    });
});

describe('which empty fields fill', () => {
    it('fills an empty term and start date', () => {
        expect(PlanCommercialDefaults({ TermMonths: null, StartDate: null, ExpectedCloseDate: CLOSE }, 12))
            .toEqual({ TermMonths: 12, StartDate: CLOSE });
    });

    it('never overwrites a value', () => {
        const typed = new Date(Date.UTC(2027, 0, 1));
        expect(PlanCommercialDefaults({ TermMonths: 36, StartDate: typed, ExpectedCloseDate: CLOSE }, 12)).toEqual({});
    });

    it('fills nothing it has no source for', () => {
        expect(PlanCommercialDefaults({ TermMonths: null, StartDate: null, ExpectedCloseDate: null }, null)).toEqual({});
    });
});

describe('the term a close sends downstream', () => {
    it('is the deal term when there is one', () => {
        expect(CloseTermMonths(36, 12)).toBe(36);
    });

    it('falls back to the policy, then to nothing', () => {
        expect(CloseTermMonths(null, 12)).toBe(12);
        expect(CloseTermMonths(undefined, undefined)).toBeNull();
    });
});

type Opts = { locked?: boolean; values?: Record<string, unknown>; policy?: string | null; readSucceeds?: boolean };

function deal(opts: Opts) {
    const values: Record<string, unknown> = {
        PipelineID: PIPELINE, TermMonths: null, StartDate: null, ExpectedCloseDate: CLOSE, ...(opts.values ?? {}),
    };
    const reads: string[] = [];
    const instance = Object.create(DealEntityServer.prototype) as { defaultEmptyTermAndStart(): Promise<void> };
    for (const name of Object.keys(values)) {
        Object.defineProperty(instance, name, {
            get: () => values[name], set: (v: unknown) => { values[name] = v; }, configurable: true,
        });
    }
    Object.defineProperty(instance, '_lockedAtSave', { value: opts.locked ?? false });
    Object.defineProperty(instance, 'ContextCurrentUser', { value: {} });
    Object.defineProperty(instance, 'ProviderToUse', {
        value: {
            RunView: async (params: { EntityName: string }) => {
                reads.push(params.EntityName);
                return opts.readSucceeds === false
                    ? { Success: false, Results: [] }
                    : { Success: true, Results: [{ CloseWonPolicy: opts.policy ?? null }] };
            },
        },
    });
    return { instance, values, reads };
}

describe('DealEntityServer fills empty commercial terms on save', () => {
    it('takes the term from the pipeline and the start from the expected close', async () => {
        const d = deal({ policy: '{"TermMonths":12}' });
        await d.instance.defaultEmptyTermAndStart();
        expect(d.values.TermMonths).toBe(12);
        expect(d.values.StartDate).toBe(CLOSE);
    });

    it('does not read the pipeline when the term is already set', async () => {
        const d = deal({ values: { TermMonths: 24 }, policy: '{"TermMonths":12}' });
        await d.instance.defaultEmptyTermAndStart();
        expect(d.values.TermMonths).toBe(24);
        expect(d.reads).toEqual([]);
    });

    it('leaves the term empty when the pipeline cannot be read', async () => {
        const d = deal({ readSucceeds: false });
        await d.instance.defaultEmptyTermAndStart();
        expect(d.values.TermMonths).toBeNull();
        expect(d.values.StartDate).toBe(CLOSE);
    });

    it('touches nothing on a locked deal', async () => {
        const d = deal({ locked: true, policy: '{"TermMonths":12}' });
        await d.instance.defaultEmptyTermAndStart();
        expect(d.values).toMatchObject({ TermMonths: null, StartDate: null });
        expect(d.reads).toEqual([]);
    });
});
