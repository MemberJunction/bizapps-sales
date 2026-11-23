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

/** No payload at all. A Scheduled Job with no `StartingPayload` is the normal Monday, and arrives here. */
const isAbsent = (value: unknown): boolean =>
    value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const asNonEmptyString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim().length > 0 ? value : undefined;

/** A short rendering of a rejected value, so the operator can see what they actually typed. */
function describe(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'an array';
    let text: string;
    try {
        text = JSON.stringify(value) ?? String(value);
    } catch {
        text = String(value);
    }
    if (text.length > 60) text = `${text.slice(0, 57)}...`;
    return typeof value === 'object' ? `the object ${text}` : `the ${typeof value} ${text}`;
}

/** Both halves or nothing: a recipient with a name and no address would send to nobody, or to the wrong one. */
function parseRecipientOverride(value: unknown): DigestRunOptions['recipientOverride'] | null {
    if (!isRecord(value)) return null;
    const name = asNonEmptyString(value.name);
    const email = asNonEmptyString(value.email);
    return name && email ? { name, email } : null;
}

/**
 * The outcome of a parse: `refusal` is the reason the run must not start, set only when it must not.
 *
 * Not a `{ ok: true } | { ok: false }` union, which would read better: `strict` is off in this repo, and
 * without `strictNullChecks` TypeScript does not narrow a union by a boolean literal discriminant, so
 * reading `message` after `if (!parsed.ok)` fails to compile (TS2339). One shape, one invariant instead:
 * when `refusal` is set, `options` is the empty default and must not be used.
 */
export interface ParsedDigestPayload {
    refusal?: string;
    options: DigestRunOptions;
}

const refuse = (refusal: string): ParsedDigestPayload => ({ refusal, options: {} });

/**
 * The payload is untrusted: a Scheduled Job's StartingPayload, or a person running the agent by hand.
 *
 * Unknown fields are ignored and an ABSENT field takes the run's default, but a field that is PRESENT
 * and cannot be read REFUSES the run instead of falling back to that default. `dryRun` and
 * `recipientOverride` exist to stop a real send, so reading `{"dryRun": "true"}` — a string, which a
 * hand-typed `StartingPayload` produces easily (QA-GUIDE steps 4 and 5) — as "no dry run" would mail
 * every CEO, CFO, CTO and company leader on the roster, and mail cannot be recalled. The same goes for
 * a `recipientOverride` missing its `name`: ignored, it would send to the real recipients. Fail closed.
 *
 * `captureRenderedEmails` is held to the same rule, though it sends nothing either way: a payload
 * written by hand is read by hand, and "one field was silently dropped, the other two were honoured"
 * is not a contract anyone can hold in their head at the moment they are about to mail the executives.
 *
 * Nothing here throws: an unreadable payload comes back as a refusal naming the field, which the agent
 * turns into a `Failed` step.
 */
export function ParseDigestPayload(payload: unknown): ParsedDigestPayload {
    if (isAbsent(payload)) return { options: {} };
    if (!isRecord(payload)) {
        return refuse('The lapsed close date digest was not run: its payload must be a JSON object holding the run\'s '
            + `options, and this one is ${describe(payload)}. Nothing was sent. Supply {"dryRun": true} to rehearse, `
            + 'or no payload at all for a real run.');
    }

    const problems: string[] = [];
    const options: DigestRunOptions = {};
    for (const flag of ['dryRun', 'captureRenderedEmails'] as const) {
        const raw = payload[flag];
        if (raw === undefined) continue;
        if (typeof raw !== 'boolean') {
            problems.push(`"${flag}" must be true or false, and it is ${describe(raw)}`);
            continue;
        }
        options[flag] = raw;
    }
    if (payload.recipientOverride !== undefined) {
        const override = parseRecipientOverride(payload.recipientOverride);
        if (override === null) {
            problems.push('"recipientOverride" must be an object with a non-empty "name" and a non-empty "email", and it is '
                + describe(payload.recipientOverride));
        } else {
            options.recipientOverride = override;
        }
    }
    if (problems.length > 0) {
        return refuse(`The lapsed close date digest was not run, because its payload could not be read: ${problems.join('; ')}. `
            + 'Nothing was sent. A payload that cannot be read is refused rather than ignored, because ignoring one of '
            + 'these fields means a real send to every recipient. Fix the payload and run again.');
    }
    return { options };
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

        // Before the run, not inside it: a payload that cannot be read must not reach a send path at all.
        const parsed = ParseDigestPayload(params.payload);
        if (parsed.refusal) {
            return failed(parsed.refusal) as never;
        }

        let outcome: DigestRunResult;
        try {
            outcome = await RunLapsedCloseDateDigest(params.contextUser, parsed.options);
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

        // `|| Errors.length > 0` guards against a drifted `Success` computation: any recorded error fails the step.
        if (!outcome.Success || outcome.Errors.length > 0) {
            // A truncated run fails loudly and must say why in the log alone, even if the truncation notice
            // ever moves out of `Errors` and `Truncated` is the only thing holding `Success` false.
            const reasons = [
                ...(outcome.Truncated ? ['the lapsed-deal list was truncated'] : []),
                ...outcome.Errors,
            ];
            const message = reasons.length > 0
                ? `The lapsed close date digest failed: ${reasons.join('; ')}`
                : 'The lapsed close date digest failed without reporting a cause.';
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
