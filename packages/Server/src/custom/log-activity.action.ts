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
import { Metadata, RunView, type UserInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { ActivityWriterService, type ResolvedParty } from '@mj-biz-apps/sales-core-entities-server';
import { E_DEAL, E_ORGANIZATION, E_PERSON, type ActivityTypeCode } from '@mj-biz-apps/sales-entities';

const P_DEAL_ID = 'DealID';
const P_TYPE_CODE = 'TypeCode';
const P_TITLE = 'Title';
const P_NOTES = 'Notes';
const P_STARTED_AT = 'StartedAt';
const P_PARTIES = 'Parties';

/** A bound on one call's fan-out: a person ticks a handful of people, never hundreds. */
export const MAX_PARTIES = 50;

/** One person or organization the browser asks to link. The role is not the browser's to choose. */
export type ChosenParty = Pick<ResolvedParty, 'Kind' | 'RecordID'>;

/** The parsed `Parties` param: absent (null), the chosen list, or a refusal naming the bad entry. */
type PartiesRead = { Parties: ChosenParty[] | null; Refusal: null } | { Parties?: undefined; Refusal: string };

/** The codes a person may log by hand. A meeting arrives from the calendar, not from this form. */
const LOGGABLE: readonly ActivityTypeCode[] = ['Call', 'Meeting', 'Note', 'Email'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/**
 * Reads `Parties`: a JSON array of `{ Kind: 'Person' | 'Organization', RecordID }`.
 *
 * ABSENT IS NOT EMPTY. Absent means "the service decides from the deal", which is every caller before
 * #408. An empty array means the rep unticked everyone, so only the deal is linked.
 */
export function readParties(params: RunActionParams): PartiesRead {
    const raw = readParam(params, P_PARTIES);
    if (raw === null || raw === undefined || (typeof raw === 'string' && !raw.trim())) {
        return { Parties: null, Refusal: null };
    }
    let list: unknown = raw;
    if (typeof raw === 'string') {
        try {
            list = JSON.parse(raw);
        } catch {
            return { Refusal: 'Parties is not valid JSON.' };
        }
    }
    if (!Array.isArray(list)) {
        return { Refusal: 'Parties must be a list.' };
    }
    if (list.length > MAX_PARTIES) {
        return { Refusal: `Parties lists ${list.length} entries; at most ${MAX_PARTIES} are accepted.` };
    }
    const parties: ChosenParty[] = [];
    for (const [i, entry] of list.entries()) {
        const e = (entry ?? {}) as { Kind?: unknown; RecordID?: unknown };
        if (e.Kind !== 'Person' && e.Kind !== 'Organization') {
            return { Refusal: `Parties entry ${i + 1}: '${String(e.Kind)}' is not Person or Organization.` };
        }
        if (typeof e.RecordID !== 'string' || !UUID.test(e.RecordID)) {
            return { Refusal: `Parties entry ${i + 1}: '${String(e.RecordID)}' is not a record ID.` };
        }
        parties.push({ Kind: e.Kind, RecordID: e.RecordID });
    }
    return { Parties: parties, Refusal: null };
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
    /**
     * Lets any signed-in user run this through the `RunAction` mutation, which otherwise runs an action
     * with no `MJ: Action Authorizations` link for Owners only. Every rep logs activities, so Owner-only
     * broke the deal pane for everyone else.
     *
     * The action makes its own decision instead: the caller must be able to read the deal
     * (`callerCanReadDeal`), and the Activity and its links are saved as the caller, so their own
     * entity permissions decide the write.
     */
    public static readonly AuthorizesCaller = true;

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
        if (!UUID.test(dealID)) {
            return { Success: false, ResultCode: 'BAD_INPUT', Message: `'${dealID}' is not a deal ID.` };
        }

        /**
         * WHO GETS LINKED IS NOW THE BROWSER'S CHOICE (#408), so every ID it names is checked here, before
         * anything is written: well-formed, a Person or an Organization, and readable by the caller. A bad
         * entry refuses the whole call and is named; it is never dropped quietly.
         */
        const chosen = readParties(params);
        if (chosen.Refusal !== null) {
            return { Success: false, ResultCode: 'BAD_INPUT', Message: chosen.Refusal };
        }

        /**
         * THE CALLER MUST BE ABLE TO SEE THE DEAL. The writer links the activity to whatever deal ID it is
         * given, so without this a caller could attach activities to a deal hidden from them.
         */
        if (!(await this.callerCanReadDeal(dealID, params.ContextUser))) {
            return { Success: false, ResultCode: 'NOT_FOUND', Message: 'No deal you can see has that ID.' };
        }

        const unreadable = chosen.Parties ? await this.firstUnreadable(chosen.Parties, params.ContextUser) : null;
        if (unreadable) {
            return {
                Success: false,
                ResultCode: 'NOT_FOUND',
                Message: `No ${unreadable.Kind.toLowerCase()} you can see has the ID '${unreadable.RecordID}'.`,
            };
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
                    Message: `'${rawStarted}' is not a date and time that can be read. Use a format such as 2026-10-16T14:30:00Z.`,
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
                 * Without `Parties` (any caller before #408): TRUE, so the deal's account and primary contact
                 * become participants -- "where relevant to the account and contact" (S-US9).
                 *
                 * With `Parties`: FALSE, and the list is exactly what gets linked. The compose form sends the
                 * deal's own account and contact itself, ticked or not, so unticking one really drops it.
                 */
                IncludeDealParties: chosen.Parties === null,
                Parties: chosen.Parties?.map((p) => ({ ...p, Role: 'Participant' as const })),
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

    /**
     * The first chosen party the caller cannot read, or null when every one comes back for them.
     * One `RunViews` round trip: people and organizations side by side.
     */
    private async firstUnreadable(parties: ChosenParty[], contextUser: UserInfo): Promise<ChosenParty | null> {
        const inList = (kind: ChosenParty['Kind']): string =>
            parties.filter((p) => p.Kind === kind).map((p) => `'${p.RecordID}'`).join(', ') || 'NULL';
        const [people, orgs] = await new RunView().RunViews(
            [
                { EntityName: E_PERSON, ExtraFilter: `ID IN (${inList('Person')})`, ResultType: 'simple', Fields: ['ID'] },
                { EntityName: E_ORGANIZATION, ExtraFilter: `ID IN (${inList('Organization')})`, ResultType: 'simple', Fields: ['ID'] },
            ],
            contextUser,
        );
        const ids = (r: typeof people, kind: ChosenParty['Kind']): string[] =>
            r?.Success ? ((r.Results ?? []) as { ID: string }[]).map((row) => `${kind}:${String(row.ID).toLowerCase()}`) : [];
        const visible = new Set([...ids(people, 'Person'), ...ids(orgs, 'Organization')]);
        return parties.find((p) => !visible.has(`${p.Kind}:${p.RecordID.toLowerCase()}`)) ?? null;
    }

    /** True when the deal comes back for the caller, so their read permission and row-level filters apply. */
    private async callerCanReadDeal(dealID: string, contextUser: UserInfo): Promise<boolean> {
        const r = await new RunView().RunView<{ ID: string }>(
            { EntityName: E_DEAL, ExtraFilter: `ID = '${dealID}'`, ResultType: 'simple', Fields: ['ID'] },
            contextUser,
        );
        return r.Success && (r.Results ?? []).length > 0;
    }
}

/** Anti-tree-shaking anchor — `@RegisterClass` is a side effect of import. */
export function LoadLogActivityAction(): void {
    void LogActivityAction;
}
