/**
 * Copying the default pipeline and its stages onto every company that lacks one (#327).
 *
 * Reads are stubbed at the `@memberjunction/core` boundary and entities are in-memory fakes, so what
 * runs for real is the plan (who gets a copy), the field copy (what a copy carries) and the per-company
 * transaction (a stage that fails takes its pipeline with it).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runViews = vi.fn();
const runView = vi.fn();
vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return {
        ...actual,
        LogError: () => undefined,
        RunView: class { public RunViews = runViews; public RunView = runView; },
    };
});

const { CopyDefaultPipelineToCompanies, CopyableFieldNames, PlanPipelineCopies } = await import('../pipelines/CopyDefaultPipeline.js');

const USER = { ID: 'user-1' } as never;
const HOME = 'C0DEFA17-0000-4000-A000-000000000001';
const ACME = 'aaaaaaaa-0000-4000-8000-000000000001';
const BETA = 'BBBBBBBB-0000-4000-8000-000000000001';

type Field = { Name: string; IsPrimaryKey: boolean; IsVirtual: boolean };
const stored = (name: string): Field => ({ Name: name, IsPrimaryKey: false, IsVirtual: false });
const PIPELINE_FIELDS: Field[] = [
    { Name: 'ID', IsPrimaryKey: true, IsVirtual: false },
    ...['CompanyID', 'Name', 'Code', 'CloseWonPolicy', 'IsDefault', 'DisplayRank', 'IsActive', '__mj_CreatedAt'].map(stored),
    { Name: 'Company', IsPrimaryKey: false, IsVirtual: true },
];
const STAGE_FIELDS: Field[] = [
    { Name: 'ID', IsPrimaryKey: true, IsVirtual: false },
    ...['PipelineID', 'Name', 'DisplayOrder', 'Probability', 'DealStatusTypeID'].map(stored),
    { Name: 'Pipeline', IsPrimaryKey: false, IsVirtual: true },
];

/** The slice of BaseEntity the copy touches. */
class FakeEntity {
    public static Saved: FakeEntity[] = [];
    public static FailStageNamed: string | null = null;
    public readonly Values: Record<string, unknown>;
    public LatestResult: { Message: string } | null = null;
    constructor(public readonly Kind: 'pipeline' | 'stage', values: Record<string, unknown> = {}) {
        this.Values = { ...values };
    }
    public get EntityInfo() {
        return { Fields: this.Kind === 'pipeline' ? PIPELINE_FIELDS : STAGE_FIELDS };
    }
    public Get(name: string): unknown { return this.Values[name]; }
    public Set(name: string, value: unknown): void { this.Values[name] = value; }
    public NewRecord(): void { /* fields start empty */ }
    public async Save(): Promise<boolean> {
        if (this.Kind === 'stage' && this.Values.Name === FakeEntity.FailStageNamed) {
            this.LatestResult = { Message: 'refused by the database' };
            return false;
        }
        this.Values.ID = `new-${this.Kind}-${FakeEntity.Saved.length}`;
        FakeEntity.Saved.push(this);
        return true;
    }
}

const DEFAULT = new FakeEntity('pipeline', {
    ID: 'P-DEFAULT', CompanyID: HOME, Name: 'B2B', Code: 'B2B', CloseWonPolicy: '{"CreateContract":true}',
    IsDefault: true, DisplayRank: 10, IsActive: true, __mj_CreatedAt: 'then', Company: 'Home Co',
});
const STAGES = [
    new FakeEntity('stage', { ID: 'S-1', PipelineID: 'P-DEFAULT', Name: 'Discovery', DisplayOrder: 10, Probability: 10, DealStatusTypeID: 'OPEN', Pipeline: 'B2B' }),
    new FakeEntity('stage', { ID: 'S-2', PipelineID: 'P-DEFAULT', Name: 'Signed', DisplayOrder: 50, Probability: 100, DealStatusTypeID: 'WON', Pipeline: 'B2B' }),
];

/** Records how each company's transaction ended. */
const settled: string[] = [];
const PROVIDER = {
    GetEntityObject: async (name: string) => new FakeEntity(name.endsWith('Pipeline Stages') ? 'stage' : 'pipeline'),
    BeginEntityTransaction: async () => ({
        Commit: async () => { settled.push('commit'); },
        Rollback: async () => { settled.push('rollback'); },
    }),
} as never;

function reads(opts: { defaults?: FakeEntity[]; existing?: Array<{ CompanyID: string; Code: string }>; companies?: string[] } = {}) {
    runViews.mockResolvedValue([
        { Success: true, Results: opts.defaults ?? [DEFAULT] },
        { Success: true, Results: opts.existing ?? [{ CompanyID: HOME, Code: 'B2B' }, { CompanyID: HOME, Code: 'D2C' }] },
        { Success: true, Results: (opts.companies ?? [HOME, ACME, BETA]).map((ID) => ({ ID })) },
    ]);
    runView.mockResolvedValue({ Success: true, Results: STAGES });
}

beforeEach(() => {
    runViews.mockReset();
    runView.mockReset();
    FakeEntity.Saved = [];
    FakeEntity.FailStageNamed = null;
    settled.length = 0;
});

describe('the plan', () => {
    it('copies to every company without the default pipeline\'s Code, never to the default\'s own company', () => {
        const plan = PlanPipelineCopies({ CompanyID: HOME, Code: 'B2B' }, [HOME, ACME, BETA], []);
        expect(plan).toEqual({ CopyTo: [ACME, BETA], AlreadyHave: [HOME] });
    });

    it('skips a company that already has the Code, in any case, whatever its other pipelines', () => {
        const plan = PlanPipelineCopies(
            { CompanyID: HOME, Code: 'B2B' },
            [HOME, ACME, BETA],
            [{ CompanyID: ACME.toUpperCase(), Code: 'b2b' }, { CompanyID: BETA, Code: 'BETA-LEGACY' }],
        );
        expect(plan).toEqual({ CopyTo: [BETA], AlreadyHave: [HOME, ACME] });
    });
});

describe('what a copy carries', () => {
    it('takes every stored column except the key, audit stamps, virtual names and the ones it sets', () => {
        expect(CopyableFieldNames(PIPELINE_FIELDS, ['CompanyID', 'IsDefault']))
            .toEqual(['Name', 'Code', 'CloseWonPolicy', 'DisplayRank', 'IsActive']);
    });

    it('gives each company a non-default pipeline with the stages in order', async () => {
        reads();
        const result = await CopyDefaultPipelineToCompanies(PROVIDER, USER);

        expect(result).toMatchObject({ Success: true, Outcome: 'COPIED', Companies: 3, Created: 2, AlreadyHad: 1, StagesCopied: 4 });
        const pipelines = FakeEntity.Saved.filter((e) => e.Kind === 'pipeline');
        expect(pipelines.map((p) => p.Values.CompanyID)).toEqual([ACME, BETA]);
        for (const p of pipelines) {
            expect(p.Values).toMatchObject({ Name: 'B2B', Code: 'B2B', CloseWonPolicy: '{"CreateContract":true}', IsDefault: false });
            expect(p.Values).not.toHaveProperty('__mj_CreatedAt');
            expect(p.Values).not.toHaveProperty('Company');
            const stages = FakeEntity.Saved.filter((e) => e.Kind === 'stage' && e.Values.PipelineID === p.Values.ID);
            expect(stages.map((s) => s.Values.Name)).toEqual(['Discovery', 'Signed']);
            expect(stages[1].Values).toMatchObject({ Probability: 100, DealStatusTypeID: 'WON' });
        }
        expect(settled).toEqual(['commit', 'commit']);
    });

    it('does nothing on a second run', async () => {
        reads({ existing: [{ CompanyID: HOME, Code: 'B2B' }, { CompanyID: ACME, Code: 'B2B' }, { CompanyID: BETA, Code: 'B2B' }] });
        const result = await CopyDefaultPipelineToCompanies(PROVIDER, USER);
        expect(result).toMatchObject({ Success: true, Outcome: 'NOTHING_TO_COPY', Created: 0, AlreadyHad: 3 });
        expect(FakeEntity.Saved).toHaveLength(0);
    });
});

describe('failures', () => {
    it('rolls a company back when one of its stages fails, and still copies the others', async () => {
        reads({ companies: [HOME, ACME] });
        FakeEntity.FailStageNamed = 'Signed';
        const result = await CopyDefaultPipelineToCompanies(PROVIDER, USER);

        expect(result).toMatchObject({ Success: false, Outcome: 'PARTIAL', Created: 0 });
        expect(result.Issues[0]).toContain('stage "Signed" did not save: refused by the database');
        expect(settled).toEqual(['rollback']);
    });

    it('refuses when no pipeline is the default', async () => {
        reads({ defaults: [] });
        const result = await CopyDefaultPipelineToCompanies(PROVIDER, USER);
        expect(result).toMatchObject({ Success: false, Outcome: 'NO_DEFAULT' });
        expect(FakeEntity.Saved).toHaveLength(0);
    });

    it('refuses when two pipelines are the default, rather than guessing', async () => {
        reads({ defaults: [DEFAULT, DEFAULT] });
        const result = await CopyDefaultPipelineToCompanies(PROVIDER, USER);
        expect(result).toMatchObject({ Success: false, Outcome: 'AMBIGUOUS_DEFAULT' });
    });

    it('refuses when a read fails', async () => {
        runViews.mockResolvedValue([{ Success: false, ErrorMessage: 'timeout', Results: [] }, { Success: true, Results: [] }, { Success: true, Results: [] }]);
        const result = await CopyDefaultPipelineToCompanies(PROVIDER, USER);
        expect(result.Success).toBe(false);
        expect(result.Issues[0]).toContain('timeout');
    });
});
