/**
 * @fileoverview `Sales.LogActivity` — the server side of S-US9's "log an activity" button.
 *
 * ── WHY THIS EXISTS, AND WHY IT IS AN ACTION ────────────────────────────────────────────────────
 *
 * `ActivityWriterService` is the canonical composition: one `Activity`, N `ActivityLink` rows, one
 * transaction, the deal's parties resolved, `LoggedByUserID` stamped. Its own header warned that if the
 * composition also lived in the pane, "the ingest would grow its own copy, and the two would drift."
 *
 * They did. The pane wrote its own reduced version and **omitted `LoggedByUserID`**, which is NOT NULL
 * with no default — so every attempt to log an activity from the UI failed at the database with a raw
 * constraint error, for the whole life of the feature. It also saved the activity and its link as two
 * independent statements, so a link failure left a committed activity no surface could reach.
 *
 * The fix is not to add the missing field to the pane. It is to delete the pane's copy, which is what
 * this Action makes possible.
 *
 * ── AN ACTION, NOT A REMOTE OPERATION, AND THAT IS A CONSTRAINT NOT A PREFERENCE ────────────────
 *
 * A remote operation would read more naturally beside `Sales.CloseDeal`. But operation shells are
 * CodeGen output, and CodeGen is not a tool this repository runs to close a gap — three partially-failed
 * runs are recorded in `docs/CODEGEN-PARTIAL-RUNS.md`. An Action needs only a metadata row and a
 * `@RegisterClass`, which is why the two scheduled jobs are Actions too.
 *
 * It is also genuinely callable from the browser: `GraphQLActionClient.RunAction(actionID, params)`, the
 * same path MJ's own `interactive-form-apply.service.ts` uses. So the pane can reach the real
 * composition without a transaction it cannot open and without a duplicate it will drift from.
 *
 * @module @mj-biz-apps/sales-server
 */
import { BaseAction } from '@memberjunction/actions';
import type { ActionParam, ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { Metadata } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { ActivityWriterService } from '@mj-biz-apps/sales-core-entities-server';
import type { ActivityTypeCode } from '@mj-biz-apps/sales-entities';

const P_DEAL_ID = 'DealID';
const P_TYPE_CODE = 'TypeCode';
const P_TITLE = 'Title';
const P_NOTES = 'Notes';
const P_STARTED_AT = 'StartedAt';

/** The codes a person may log by hand. A meeting arrives from the calendar, not from this form. */
const LOGGABLE: readonly ActivityTypeCode[] = ['Call', 'Meeting', 'Note', 'Email'];

function readParam(params: RunActionParams, name: string): unknown {
    return params.Params?.find((p) => p.Name?.toLowerCase() === name.toLowerCase())?.Value;
}

function readText(params: RunActionParams, name: string): string | null {
    const raw = readParam(params, name);
    if (raw === null || raw === undefined) {
        return null;
    }
    const s = String(raw).trim();
    return s ? s : null;
}

function setOutput(params: RunActionParams, name: string, value: unknown): void {
    const existing = params.Params?.find((p) => p.Name?.toLowerCase() === name.toLowerCase());
    if (existing) {
        existing.Value = value;
        return;
    }
    params.Params = params.Params ?? [];
    params.Params.push({ Name: name, Value: value, Type: 'Output' } as ActionParam);
}

@RegisterClass(BaseAction, 'Sales.LogActivity')
export class LogActivityAction extends BaseAction {
    protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
        try {
            return await this.log(params);
        } catch (error) {
            return {
                Success: false,
                ResultCode: 'ERROR',
                Message: `The activity could not be logged: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            };
        }
    }

    private async log(params: RunActionParams): Promise<ActionResultSimple> {
        const dealID = readText(params, P_DEAL_ID);
        const title = readText(params, P_TITLE);
        const rawCode = readText(params, P_TYPE_CODE);

        if (!dealID) {
            return { Success: false, ResultCode: 'BAD_INPUT', Message: 'A deal is required.' };
        }
        if (!title) {
            return { Success: false, ResultCode: 'BAD_INPUT', Message: 'A subject is required.' };
        }

        /**
         * THE CODE IS VALIDATED AGAINST THE LOGGABLE SET, not passed through.
         *
         * A caller supplying `SMS` or an invented string would otherwise reach the writer's own lookup and
         * come back "no ActivityType with Code 'X'", which reads like a missing seed rather than a bad
         * request. Refusing here names the actual mistake, and keeps the browser from being the thing that
         * decides what a person may log.
         */
        const code = LOGGABLE.find((c) => c === rawCode);
        if (!code) {
            return {
                Success: false,
                ResultCode: 'BAD_INPUT',
                Message: `'${rawCode ?? '(none)'}' is not a loggable activity type. Expected one of: `
                    + `${LOGGABLE.join(', ')}.`,
            };
        }

        /**
         * A SUPPLIED TIME IS PARSED OR REFUSED, never defaulted quietly. Falling back to "now" for an
         * unparseable value would file the activity at the wrong moment and put it in the wrong place on a
         * timeline ordered by `StartedAt` -- with nothing to indicate it had been moved.
         */
        const rawStarted = readText(params, P_STARTED_AT);
        let startedAt = new Date();
        if (rawStarted) {
            const parsed = new Date(rawStarted);
            if (Number.isNaN(parsed.getTime())) {
                return {
                    Success: false,
                    ResultCode: 'BAD_INPUT',
                    Message: `'${rawStarted}' is not a date/time this can read.`,
                };
            }
            startedAt = parsed;
        }

        const result = await new ActivityWriterService().LogActivity(
            {
                DealID: dealID,
                TypeCode: code,
                Title: title,
                Description: readText(params, P_NOTES),
                StartedAt: startedAt,
                Direction: 'Internal',
                Status: 'Logged',
                Source: 'Manual',
                /**
                 * TRUE, which is the point of routing through the service. The deal's account and primary
                 * contact become participants -- "where relevant to the account and contact" (S-US9) -- and
                 * the pane's own version attached neither.
                 */
                IncludeDealParties: true,
            },
            Metadata.Provider,
            params.ContextUser,
        );

        setOutput(params, 'ActivityID', result.ActivityID);
        setOutput(params, 'LinkCount', result.LinkCount);
        setOutput(params, 'Issues', JSON.stringify(result.Issues));

        if (!result.Success) {
            return {
                Success: false,
                ResultCode: 'REFUSED',
                Message: result.Issues.join(' | ') || 'The activity could not be written.',
            };
        }
        return {
            Success: true,
            ResultCode: 'SUCCESS',
            Message: `Logged ${code} with ${result.LinkCount} link(s).`
                + (result.Issues.length ? ` Notes: ${result.Issues.join(' | ')}` : ''),
        };
    }
}

/** Anti-tree-shaking anchor — `@RegisterClass` is a side effect of import. */
export function LoadLogActivityAction(): void {
    void LogActivityAction;
}
