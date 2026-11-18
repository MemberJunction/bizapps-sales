import { BaseAgent } from '@memberjunction/ai-agents';
import type { AgentConfiguration, BaseAgentNextStep, ExecuteAgentParams } from '@memberjunction/ai-core-plus';
import { RegisterClass } from '@memberjunction/global';
import { RunLapsedCloseDateDigest, type DigestRunOptions, type DigestRunResult } from '@mj-biz-apps/sales-core-entities-server';

/** What a finished run reports in the step's payload, for a person reading the scheduled-job log. */
export interface LapsedCloseDateDigestPayload {
    totalLapsedDeals: number;
    truncated: boolean;
    sent: number;
    skippedEmpty: number;
    errors: string[];
    renderedEmails: DigestRunResult['RenderedEmails'];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const asBoolean = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined);

const asNonEmptyString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim().length > 0 ? value : undefined;

/** Both halves or nothing: a recipient with a name and no address would send to nobody, or to the wrong one. */
function parseRecipientOverride(value: unknown): DigestRunOptions['recipientOverride'] {
    if (!isRecord(value)) return undefined;
    const name = asNonEmptyString(value.name);
    const email = asNonEmptyString(value.email);
    return name && email ? { name, email } : undefined;
}

/**
 * The payload is untrusted: a Scheduled Job's StartingPayload or a person running the agent by hand.
 * Unknown fields are ignored, anything of the wrong type becomes `undefined` (the run's default), and
 * nothing here throws.
 */
export function ParseDigestPayload(payload: unknown): DigestRunOptions {
    const source = isRecord(payload) ? payload : {};
    return {
        dryRun: asBoolean(source.dryRun),
        captureRenderedEmails: asBoolean(source.captureRenderedEmails),
        recipientOverride: parseRecipientOverride(source.recipientOverride),
    };
}

const failed = (message: string): { finalStep: BaseAgentNextStep<LapsedCloseDateDigestPayload>; stepCount: number } => ({
    finalStep: { terminate: true, step: 'Failed', message, errorMessage: message },
    stepCount: 1,
});

/**
 * Sends the lapsed close date digest. A Scheduled Job invokes it; every rule (who is lapsed, who gets
 * what, how it is rendered and sent) lives in `RunLapsedCloseDateDigest`. This class only translates
 * between the agent contract and that function.
 */
@RegisterClass(BaseAgent, 'Sales.LapsedCloseDateDigest')
export class LapsedCloseDateDigestAgent extends BaseAgent {
    protected override async executeAgentInternal<P = LapsedCloseDateDigestPayload>(
        params: ExecuteAgentParams,
        _config: AgentConfiguration,
    ): Promise<{ finalStep: BaseAgentNextStep<P>; stepCount: number }> {
        if (!params.contextUser) {
            return failed('The lapsed close date digest needs a context user and none was supplied.') as never;
        }

        let outcome: DigestRunResult;
        try {
            outcome = await RunLapsedCloseDateDigest(params.contextUser, ParseDigestPayload(params.payload));
        } catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            return failed(`The lapsed close date digest run threw: ${reason}`) as never;
        }

        const payload: LapsedCloseDateDigestPayload = {
            totalLapsedDeals: outcome.TotalLapsedDeals,
            truncated: outcome.Truncated,
            sent: outcome.Sent,
            skippedEmpty: outcome.SkippedEmpty,
            errors: outcome.Errors,
            renderedEmails: outcome.RenderedEmails,
        };

        if (!outcome.Success || outcome.Errors.length > 0) {
            const message = `The lapsed close date digest reported ${outcome.Errors.length} error(s): ${outcome.Errors.join('; ')}`;
            return {
                finalStep: { terminate: true, step: 'Failed', message, errorMessage: message, newPayload: payload as P },
                stepCount: 1,
            };
        }

        const message = `Lapsed close date digest: ${outcome.TotalLapsedDeals} lapsed deal(s), ${outcome.Sent} sent, ${outcome.SkippedEmpty} skipped as empty.`
            + (outcome.Truncated ? ' The lapsed-deal list was truncated.' : '');
        return { finalStep: { terminate: true, step: 'Success', message, newPayload: payload as P }, stepCount: 1 };
    }
}

/** Anti-tree-shaking anchor — `@RegisterClass` is a side effect of import. */
export function LoadLapsedCloseDateDigestAgent(): void {
    void LapsedCloseDateDigestAgent;
}
