/**
 * `Sales.LinkDefaultPipelineToCompanies` reports the link job's outcome as the Action result (#327).
 *
 * The job is stubbed; its own behaviour is proved in sales-core-entities-server. What is pinned here is
 * the mapping an admin reads: a refused or partial run is a failed run, and a second run says so.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunActionParams } from '@memberjunction/actions-base';

const link = vi.fn();
vi.mock('@mj-biz-apps/sales-core-entities-server', () => ({ LinkDefaultPipelineToCompanies: link }));
vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return { ...actual, Metadata: { Provider: {} } };
});

const { LinkDefaultPipelineToCompaniesAction } = await import('../custom/link-default-pipeline.action.js');

/** Exposes the protected entry point without widening the class. */
class Harness extends LinkDefaultPipelineToCompaniesAction {
    public Run(params: RunActionParams) {
        return this.InternalRunAction(params);
    }
}

function params(): RunActionParams {
    return { Params: [], ContextUser: { ID: 'user-1' } } as never;
}

function outcome(overrides: Record<string, unknown>) {
    return { Success: true, Outcome: 'LINKED', Companies: 3, Linked: 2, AlreadyLinked: 1, Issues: [], ...overrides };
}

afterEach(() => link.mockReset());

describe('the Action result', () => {
    it('reports the links with their tallies as outputs', async () => {
        link.mockResolvedValue(outcome({}));
        const p = params();
        const result = await new Harness().Run(p);
        expect(result).toMatchObject({ Success: true, ResultCode: 'LINKED' });
        expect(result.Message).toMatch(/to 2 of 3 company\(ies\); 1 already had a link/);
        expect(p.Params.find((x) => x.Name === 'Linked')?.Value).toBe(2);
    });

    it('reports a second run as nothing to link', async () => {
        link.mockResolvedValue(outcome({ Outcome: 'NOTHING_TO_LINK', Linked: 0, AlreadyLinked: 3 }));
        const result = await new Harness().Run(params());
        expect(result).toMatchObject({ Success: true, ResultCode: 'NOTHING_TO_LINK' });
    });

    it('fails a partial run and names the company that failed', async () => {
        link.mockResolvedValue(outcome({ Success: false, Outcome: 'PARTIAL', Linked: 1, Issues: ['Company X: the link did not save'] }));
        const result = await new Harness().Run(params());
        expect(result).toMatchObject({ Success: false, ResultCode: 'PARTIAL' });
        expect(result.Message).toMatch(/Company X/);
    });

    it('fails with the reason when there is no default pipeline', async () => {
        link.mockResolvedValue(outcome({ Success: false, Outcome: 'NO_DEFAULT', Linked: 0, Issues: ['No active pipeline is marked IsDefault'] }));
        const result = await new Harness().Run(params());
        expect(result).toMatchObject({ Success: false, ResultCode: 'NO_DEFAULT', Message: 'No active pipeline is marked IsDefault' });
    });

    it('fails, without throwing, when the job throws', async () => {
        link.mockRejectedValue(new Error('provider gone'));
        const result = await new Harness().Run(params());
        expect(result).toMatchObject({ Success: false, ResultCode: 'ERROR' });
        expect(result.Message).toMatch(/provider gone/);
    });
});
