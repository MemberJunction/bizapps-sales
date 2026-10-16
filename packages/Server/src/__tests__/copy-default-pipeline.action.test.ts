/**
 * `Sales.CopyDefaultPipelineToCompanies` reports the copy job's outcome as the Action result (#327).
 *
 * The job is stubbed; its own behaviour is proved in sales-core-entities-server. What is pinned here is
 * the mapping an admin reads: a refused or partial copy is a failed run, and a second run says so.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunActionParams } from '@memberjunction/actions-base';

const copy = vi.fn();
vi.mock('@mj-biz-apps/sales-core-entities-server', () => ({ CopyDefaultPipelineToCompanies: copy }));
vi.mock('@memberjunction/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@memberjunction/core')>();
    return { ...actual, Metadata: { Provider: {} } };
});

const { CopyDefaultPipelineToCompaniesAction } = await import('../custom/copy-default-pipeline.action.js');

/** Exposes the protected entry point without widening the class. */
class Harness extends CopyDefaultPipelineToCompaniesAction {
    public Run(params: RunActionParams) {
        return this.InternalRunAction(params);
    }
}

function params(): RunActionParams {
    return { Params: [], ContextUser: { ID: 'user-1' } } as never;
}

function outcome(overrides: Record<string, unknown>) {
    return { Success: true, Outcome: 'COPIED', Companies: 3, Created: 2, AlreadyHad: 1, StagesCopied: 12, Issues: [], ...overrides };
}

afterEach(() => copy.mockReset());

describe('the Action result', () => {
    it('reports a copy with its tallies as outputs', async () => {
        copy.mockResolvedValue(outcome({}));
        const p = params();
        const result = await new Harness().Run(p);
        expect(result).toMatchObject({ Success: true, ResultCode: 'COPIED' });
        expect(result.Message).toMatch(/to 2 of 3 company\(ies\) \(12 stages\); 1 already had it/);
        expect(p.Params.find((x) => x.Name === 'Created')?.Value).toBe(2);
    });

    it('reports a second run as nothing to copy', async () => {
        copy.mockResolvedValue(outcome({ Outcome: 'NOTHING_TO_COPY', Created: 0, AlreadyHad: 3, StagesCopied: 0 }));
        const result = await new Harness().Run(params());
        expect(result).toMatchObject({ Success: true, ResultCode: 'NOTHING_TO_COPY' });
    });

    it('fails a partial copy and names the company that failed', async () => {
        copy.mockResolvedValue(outcome({ Success: false, Outcome: 'PARTIAL', Created: 1, Issues: ['Company X: stage "Signed" did not save'] }));
        const result = await new Harness().Run(params());
        expect(result).toMatchObject({ Success: false, ResultCode: 'PARTIAL' });
        expect(result.Message).toMatch(/Company X/);
    });

    it('fails with the reason when there is no default pipeline', async () => {
        copy.mockResolvedValue(outcome({ Success: false, Outcome: 'NO_DEFAULT', Created: 0, Issues: ['No active pipeline is marked IsDefault'] }));
        const result = await new Harness().Run(params());
        expect(result).toMatchObject({ Success: false, ResultCode: 'NO_DEFAULT', Message: 'No active pipeline is marked IsDefault' });
    });

    it('fails, without throwing, when the job throws', async () => {
        copy.mockRejectedValue(new Error('provider gone'));
        const result = await new Harness().Run(params());
        expect(result).toMatchObject({ Success: false, ResultCode: 'ERROR' });
        expect(result.Message).toMatch(/provider gone/);
    });
});
