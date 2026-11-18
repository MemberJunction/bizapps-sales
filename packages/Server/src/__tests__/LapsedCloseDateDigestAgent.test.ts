/**
 * `Sales.LapsedCloseDateDigest` is a thin shell over `RunLapsedCloseDateDigest`: it validates the context
 * user, parses an UNTRUSTED payload (a Scheduled Job's StartingPayload, or a person running it by hand),
 * and maps the run's outcome onto the agent's final step. The run is stubbed; its behaviour is proved in
 * sales-core-entities-server. What is pinned here is the mapping and that parsing never throws.
 *
 * The agent is held with `Object.create(prototype)` so no MJ metadata is stood up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentConfiguration, ExecuteAgentParams } from '@memberjunction/ai-core-plus';

const run = vi.fn();
vi.mock('@mj-biz-apps/sales-core-entities-server', () => ({ RunLapsedCloseDateDigest: run }));

const { LapsedCloseDateDigestAgent } = await import('../custom/lapsed-close-date-digest.agent.js');

/** Exposes the protected entry point without widening the class. */
class Harness extends LapsedCloseDateDigestAgent {
    public Execute(params: ExecuteAgentParams) {
        return this.executeAgentInternal(params, {} as AgentConfiguration);
    }
}

const agent = (): Harness => Object.create(Harness.prototype) as Harness;
const user = { ID: 'user-1' };

function params(payload: unknown, contextUser: unknown = user): ExecuteAgentParams {
    return { payload, contextUser } as never;
}

function result(overrides: Record<string, unknown> = {}) {
    return {
        Success: true, TotalLapsedDeals: 12, Truncated: false, Sent: 3, SkippedEmpty: 1, Errors: [], RenderedEmails: [],
        ...overrides,
    };
}

beforeEach(() => {
    run.mockReset();
    run.mockResolvedValue(result());
});

describe('LapsedCloseDateDigestAgent', () => {
    it('terminates with an error when there is no context user', async () => {
        const { finalStep, stepCount } = await agent().Execute(params({}, null));
        expect(finalStep.terminate).toBe(true);
        expect(finalStep.step).toBe('Failed');
        expect(finalStep.errorMessage).toMatch(/context user/i);
        expect(stepCount).toBe(1);
        expect(run).not.toHaveBeenCalled();
    });

    it('parses dryRun, captureRenderedEmails and recipientOverride from the payload', async () => {
        await agent().Execute(params({
            dryRun: true, captureRenderedEmails: true, recipientOverride: { name: 'Tester', email: 'tester@example.com' },
            somethingElse: 'ignored',
        }));
        expect(run).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledWith(user, {
            dryRun: true, captureRenderedEmails: true, recipientOverride: { name: 'Tester', email: 'tester@example.com' },
        });
    });

    it('ignores a malformed recipientOverride rather than throwing', async () => {
        const malformed: unknown[] = [
            { name: 'No Email' }, { email: 'no-name@example.com' }, { name: 1, email: 2 }, { name: '', email: '' },
            'tester@example.com', 42, [], null,
        ];
        for (const recipientOverride of malformed) {
            run.mockClear();
            const { finalStep } = await agent().Execute(params({ recipientOverride }));
            expect(finalStep.step).toBe('Success');
            expect(run.mock.calls[0][1].recipientOverride).toBeUndefined();
        }
    });

    it('survives a payload that is not an object, and only honours booleans for the flags', async () => {
        for (const payload of [undefined, null, 'dryRun', 7, ['dryRun']]) {
            run.mockClear();
            const { finalStep } = await agent().Execute(params(payload));
            expect(finalStep.step).toBe('Success');
            expect(run).toHaveBeenCalledWith(user, { dryRun: undefined, captureRenderedEmails: undefined, recipientOverride: undefined });
        }
        run.mockClear();
        await agent().Execute(params({ dryRun: 'true', captureRenderedEmails: 1 }));
        expect(run.mock.calls[0][1].dryRun).toBeUndefined();
        expect(run.mock.calls[0][1].captureRenderedEmails).toBeUndefined();
    });

    it('returns step Failed when the run reports errors', async () => {
        run.mockResolvedValue(result({ Success: false, Errors: ['audience A: boom', 'audience B: bang'] }));
        const { finalStep } = await agent().Execute(params({}));
        expect(finalStep.terminate).toBe(true);
        expect(finalStep.step).toBe('Failed');
        expect(finalStep.errorMessage).toContain('audience A: boom');
        expect(finalStep.errorMessage).toContain('audience B: bang');
        expect(finalStep.message).toContain('audience A: boom');
    });

    it('names the truncation when a truncated run fails with no errors recorded', async () => {
        run.mockResolvedValue(result({ Success: false, Truncated: true, Errors: [] }));
        const { finalStep } = await agent().Execute(params({}));
        expect(finalStep.step).toBe('Failed');
        expect(finalStep.errorMessage).toMatch(/truncated/i);
        expect(finalStep.errorMessage).not.toMatch(/0 error/);
        expect(finalStep.errorMessage).not.toMatch(/: $/);
    });

    it('still fails, with a cause, when Success is true but errors were recorded', async () => {
        run.mockResolvedValue(result({ Success: true, Errors: ['audience C: late'] }));
        const { finalStep } = await agent().Execute(params({}));
        expect(finalStep.step).toBe('Failed');
        expect(finalStep.errorMessage).toContain('audience C: late');
    });

    it('returns step Failed, not a throw, when the run itself throws', async () => {
        run.mockRejectedValue(new Error('database unreachable'));
        const { finalStep, stepCount } = await agent().Execute(params({}));
        expect(finalStep.step).toBe('Failed');
        expect(finalStep.errorMessage).toContain('database unreachable');
        expect(stepCount).toBe(1);
    });

    it('returns step Success and the tallies in newPayload when the run is clean', async () => {
        const { finalStep, stepCount } = await agent().Execute(params({}));
        expect(finalStep.terminate).toBe(true);
        expect(finalStep.step).toBe('Success');
        expect(finalStep.newPayload).toEqual({
            totalLapsedDeals: 12, truncated: false, sent: 3, skippedEmpty: 1, errors: [], renderedEmails: [],
        });
        expect(stepCount).toBe(1);
    });
});
