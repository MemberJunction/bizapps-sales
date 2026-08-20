/**
 * @fileoverview `Sales.SyncActivities` — the MJ Action a `ScheduledJob` fires hourly.
 *
 * ── WHERE THIS LIVES, AND WHY NOT IN `packages/Actions` ─────────────────────────────────────────
 *
 * `packages/Actions` holds only CodeGen output. Orders puts its hand-written actions in
 * `packages/Server/src/custom/*.action.ts` — `Orders.GenerateInvoice`, `Orders.SendDocument` — and this
 * follows that exactly, because the alternative is a second convention for the same thing in the same
 * workspace. Sales had no action of its own before this one, so there was nothing local to match.
 *
 * ── WHAT IT DOES, AND WHAT IT DELIBERATELY DOES NOT DECIDE ──────────────────────────────────────
 *
 * It calls `ActivitySyncJob.Run()` with whatever source factory is currently registered, and reports the
 * tallies. It does NOT choose the source: that is `CurrentActivitySourceFactory()`, whose default is an
 * empty fixture, and swapping it is the single change a scoped mailbox credential requires. An action
 * that picked its own source would put that decision behind a metadata row nobody reads.
 *
 * @module @mj-biz-apps/sales-server
 */
import { BaseAction } from '@memberjunction/actions';
import type { ActionParam, ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { Metadata } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { ActivitySyncJob, CurrentActivitySourceFactory } from '@mj-biz-apps/sales-core-entities-server';

/** The one input: how many items to pull per mailbox per run. */
const P_LIMIT = 'Limit';

/** Default matching `ActivitySyncJob.Run`'s own, so metadata and code cannot disagree silently. */
const DEFAULT_LIMIT = 100;

function readParam(params: RunActionParams, name: string): unknown {
    return params.Params?.find((p) => p.Name?.toLowerCase() === name.toLowerCase())?.Value;
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

@RegisterClass(BaseAction, 'Sales.SyncActivities')
export class SyncActivitiesAction extends BaseAction {
    /**
     * AN ACTION MUST NOT THROW AT ITS CALLER. The scheduler, a workflow and a manual "run now" all want a
     * result they can branch on; an exception loses the tallies from the mailboxes that did succeed. So
     * the whole body runs behind this and every failure comes back as `Success: false` with a code.
     */
    protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
        try {
            return await this.sync(params);
        } catch (error) {
            return {
                Success: false,
                ResultCode: 'ERROR',
                Message: `The activity sync failed: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }

    private async sync(params: RunActionParams): Promise<ActionResultSimple> {
        const raw = readParam(params, P_LIMIT);
        const parsed = raw === null || raw === undefined || raw === '' ? DEFAULT_LIMIT : Number(raw);
        const limit = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_LIMIT;

        /**
         * `Metadata.Provider` rather than an injected provider, because there is exactly ONE provider per
         * server process — the bootstrapped one. That is also what makes the writes join any ambient
         * transaction, which is what lets the integration checks drive this inside a rollback.
         */
        const provider = Metadata.Provider;

        const result = await new ActivitySyncJob().Run(
            CurrentActivitySourceFactory(),
            provider,
            params.ContextUser,
            limit,
        );

        const totals = result.Runs.reduce(
            (sum, run) => ({
                Fetched: sum.Fetched + run.Result.Fetched,
                Relevant: sum.Relevant + run.Result.Relevant,
                Written: sum.Written + run.Result.Written,
                Duplicates: sum.Duplicates + run.Result.Duplicates,
                Unattributed: sum.Unattributed + run.Result.Unattributed,
            }),
            { Fetched: 0, Relevant: 0, Written: 0, Duplicates: 0, Unattributed: 0 },
        );

        setOutput(params, 'ConnectionsAttempted', result.ConnectionsAttempted);
        setOutput(params, 'Fetched', totals.Fetched);
        setOutput(params, 'Written', totals.Written);
        setOutput(params, 'Duplicates', totals.Duplicates);
        setOutput(params, 'Unattributed', totals.Unattributed);
        setOutput(params, 'Issues', JSON.stringify(result.Issues));

        /**
         * ZERO CONNECTIONS IS A SUCCESS, and the message says so rather than leaving a bare "0 written"
         * to be read as a failure. A deployment that has not been given a mailbox is the ordinary state
         * today, and an hourly job that reports failure for it would train everyone to ignore the job log
         * before there was ever anything in it worth reading.
         */
        if (result.ConnectionsAttempted === 0) {
            return {
                Success: true,
                ResultCode: 'NO_CONNECTIONS',
                Message:
                    'No Active Microsoft365 sync connection exists, so nothing was read. The chain is wired; '
                    + 'it has no mailbox to point at.',
            };
        }

        return {
            Success: result.Success,
            ResultCode: result.Success ? 'SUCCESS' : 'PARTIAL',
            Message:
                `${result.ConnectionsAttempted} connection(s): fetched ${totals.Fetched}, `
                + `relevant ${totals.Relevant}, written ${totals.Written}, `
                + `duplicates ${totals.Duplicates}, unattributed ${totals.Unattributed}.`
                + (result.Issues.length ? ` Issues: ${result.Issues.join(' | ')}` : ''),
        };
    }
}

/**
 * WITHOUT THIS ANCHOR the class is tree-shaken out of the bundle, the `@RegisterClass` decorator never
 * runs, and `ActionEngine` finds no implementation for `Sales.SyncActivities` — which surfaces as an
 * action that exists in metadata, is scheduled, fires, and does nothing at all.
 */
export function LoadSyncActivitiesAction(): void {
    void SyncActivitiesAction;
}
