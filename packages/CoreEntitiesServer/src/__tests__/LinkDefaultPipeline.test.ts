/**
 * Linking the default pipeline to every company that has no link to it (#327).
 *
 * Reads are stubbed at the `@memberjunction/core` boundary and entities are in-memory fakes, so what
 * runs for real is the plan (who gets a link) and what each link carries.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runViews = vi.fn();
vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return {
        ...actual,
        LogError: () => undefined,
        RunView: class { public RunViews = runViews; },
    };
});

const { LinkDefaultPipelineToCompanies, PlanPipelineLinks } = await import('../pipelines/LinkDefaultPipeline.js');

const USER = { ID: 'user-1' } as never;
const HOME = 'C0DEFA17-0000-4000-A000-000000000001';
const ACME = 'aaaaaaaa-0000-4000-8000-000000000001';
const BETA = 'BBBBBBBB-0000-4000-8000-000000000001';

/** The slice of BaseEntity the link touches. */
class FakeLink {
    public static Saved: FakeLink[] = [];
    public static FailCompany: string | null = null;
    public readonly Values: Record<string, unknown> = {};
    public LatestResult: { Message: string } | null = null;
    public Set(name: string, value: unknown): void { this.Values[name] = value; }
    public NewRecord(): void { /* fields start empty */ }
    public async Save(): Promise<boolean> {
        if (this.Values.CompanyID === FakeLink.FailCompany) {
            this.LatestResult = { Message: 'refused by the database' };
            return false;
        }
        FakeLink.Saved.push(this);
        return true;
    }
}

const PROVIDER = { GetEntityObject: async () => new FakeLink() } as never;

function reads(opts: { defaults?: string[]; companies?: string[]; links?: Array<{ PipelineID: string; CompanyID: string }> } = {}) {
    runViews.mockResolvedValue([
        { Success: true, Results: (opts.defaults ?? ['P-DEFAULT']).map((ID) => ({ ID })) },
        { Success: true, Results: (opts.companies ?? [HOME, ACME, BETA]).map((ID) => ({ ID })) },
        { Success: true, Results: opts.links ?? [{ PipelineID: 'P-DEFAULT', CompanyID: HOME }, { PipelineID: 'P-OTHER', CompanyID: ACME }] },
    ]);
}

beforeEach(() => {
    runViews.mockReset();
    FakeLink.Saved = [];
    FakeLink.FailCompany = null;
});

describe('the plan', () => {
    it('links every company not yet linked, comparing ids in any case', () => {
        const plan = PlanPipelineLinks([HOME, ACME, BETA], [HOME.toLowerCase(), BETA.toLowerCase()]);
        expect(plan).toEqual({ LinkTo: [ACME], AlreadyLinked: [HOME, BETA] });
    });
});

describe('the links', () => {
    it('links the default pipeline to each company without a link to it, ignoring other pipelines\' links', async () => {
        reads();
        const result = await LinkDefaultPipelineToCompanies(PROVIDER, USER);

        expect(result).toMatchObject({ Success: true, Outcome: 'LINKED', Companies: 3, Linked: 2, AlreadyLinked: 1 });
        expect(FakeLink.Saved.map((l) => l.Values)).toEqual([
            { PipelineID: 'P-DEFAULT', CompanyID: ACME, IsActive: true },
            { PipelineID: 'P-DEFAULT', CompanyID: BETA, IsActive: true },
        ]);
    });

    it('does nothing on a second run', async () => {
        reads({ links: [HOME, ACME, BETA].map((CompanyID) => ({ PipelineID: 'P-DEFAULT', CompanyID })) });
        const result = await LinkDefaultPipelineToCompanies(PROVIDER, USER);
        expect(result).toMatchObject({ Success: true, Outcome: 'NOTHING_TO_LINK', Linked: 0, AlreadyLinked: 3 });
        expect(FakeLink.Saved).toHaveLength(0);
    });
});

describe('failures', () => {
    it('reports a company whose link fails, and still links the others', async () => {
        reads();
        FakeLink.FailCompany = ACME;
        const result = await LinkDefaultPipelineToCompanies(PROVIDER, USER);

        expect(result).toMatchObject({ Success: false, Outcome: 'PARTIAL', Linked: 1 });
        expect(result.Issues[0]).toContain('the link did not save: refused by the database');
    });

    it('reads only an active default pipeline, so an inactive one is never linked', async () => {
        reads();
        await LinkDefaultPipelineToCompanies(PROVIDER, USER);
        const pipelineRead = runViews.mock.calls[0][0][0] as { EntityName: string; ExtraFilter: string };
        expect(pipelineRead.EntityName).toBe('MJ_BizApps_Sales: Pipelines');
        expect(pipelineRead.ExtraFilter).toMatch(/\bIsActive = 1\b/);
        expect(pipelineRead.ExtraFilter).toMatch(/\bIsDefault = 1\b/);
    });

    it('refuses when no pipeline is the default', async () => {
        reads({ defaults: [] });
        const result = await LinkDefaultPipelineToCompanies(PROVIDER, USER);
        expect(result).toMatchObject({ Success: false, Outcome: 'NO_DEFAULT' });
        expect(FakeLink.Saved).toHaveLength(0);
    });

    it('refuses when two pipelines are the default, rather than guessing', async () => {
        reads({ defaults: ['P-1', 'P-2'] });
        const result = await LinkDefaultPipelineToCompanies(PROVIDER, USER);
        expect(result).toMatchObject({ Success: false, Outcome: 'AMBIGUOUS_DEFAULT' });
    });

    it('refuses when a read fails', async () => {
        runViews.mockResolvedValue([{ Success: false, ErrorMessage: 'timeout', Results: [] }, { Success: true, Results: [] }, { Success: true, Results: [] }]);
        const result = await LinkDefaultPipelineToCompanies(PROVIDER, USER);
        expect(result).toMatchObject({ Success: false, Outcome: 'READ_FAILED', Linked: 0 });
        expect(result.Issues[0]).toContain('timeout');
        expect(FakeLink.Saved).toHaveLength(0);
    });
});
