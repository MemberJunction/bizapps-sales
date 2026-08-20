/**
 * @fileoverview The hourly entry point — what a `MJ: Scheduled Jobs` row invokes.
 *
 * ── THE WHOLE CHAIN IS WIRED AND FIRING ────────────────────────────────────────────────────────
 *
 * MJ's `SchedulingEngine` is the mechanism: a `ScheduledJob` row of type **Action**
 * (`ActionScheduledJobDriver`) on a six-field cron -- `0 0 * * * *` for hourly. No external cron, and
 * nothing here schedules itself.
 *
 * The job row IS seeded, `Active`, and it fires. What makes that safe rather than noisy is the default
 * source: an EMPTY fixture. The run does the whole pipeline every hour and writes nothing, so the job
 * log reads as an hourly success that fetched zero items -- which is the truthful description of a
 * deployment with no mailbox yet. See `activitySourceFactory` below for why the two alternatives are
 * both worse.
 *
 * So a real credential changes exactly one thing: which source the factory returns. Nothing in this file,
 * the ingest, the filter, the matcher or the writer moves.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { LogStatus, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';

import { ActivityIngestService, type IngestRunResult } from './ActivityIngestService.js';
import { E_ACTIVITY_SYNC_CONNECTION, SOURCE_SYSTEM_M365 } from './activity-vocabulary.js';
import { FixtureActivitySource } from './FixtureActivitySource.js';
import type { IActivitySource } from './ActivitySource.js';

export interface SyncJobResult {
    /** True when every connection attempted succeeded. A run with no connections is a success. */
    Success: boolean;
    ConnectionsAttempted: number;
    /** Per-connection outcomes, so a job log says which mailbox did what. */
    Runs: {
        ConnectionID: string;
        Mailbox: string | null;
        /** Which surface this run read. One connection produces one entry per surface. */
        Surface: 'Message' | 'Calendar';
        Result: IngestRunResult;
    }[];
    Issues: string[];
}

/**
 * Builds the source for one connection.
 *
 * RETURNS A LIST, because one mailbox has TWO surfaces — messages and calendar — and both are read on
 * the same schedule against the same connection. Returning one source would have made meetings a
 * second job with a second row and a second cron to keep in step.
 *
 * A FACTORY, not a source, because one job run may cover several mailboxes and each needs its own
 * credential. It is also the seam's outermost point: a deployment that has scoped its app registration
 * supplies a factory returning `MSGraphActivitySource`, and a check supplies one returning
 * `FixtureActivitySource`. Nothing else in this file changes between those two worlds.
 */
export type ActivitySourceFactory = (connection: {
    ID: string;
    Mailbox: string | null;
    CredentialsRef: string | null;
}) => IActivitySource[];

/**
 * THE PROCESS-WIDE SOURCE FACTORY, and the single line a real credential changes.
 *
 * ── WHY THE DEFAULT IS AN EMPTY FIXTURE ──
 *
 * The scheduled job has to be real and Active for the chain to be proved firing, and an Active job
 * needs a source that neither invents data nor fails. An empty fixture is exactly that: the run does the
 * whole pipeline -- reads the connection, applies the rules, calls the filter, advances nothing -- and
 * writes zero rows. The job log shows an hourly success with nothing fetched, which is the truthful
 * description of a deployment that has not been given a mailbox yet.
 *
 * The alternatives are both worse. A populated fixture would write fabricated activities into a real
 * database every hour. A Graph source would refuse every hour and paint
 * `ActivitySyncConnection.LastError` red for a sync nobody switched on.
 *
 * ── AND WHY IT IS A MODULE-LEVEL SETTER ──
 *
 * Same shape as `SetDownstreamSeam` in the close flow: an MJ Action is constructed by the ClassFactory
 * with no arguments, so there is nowhere to inject a factory. Replacing it is a deployment act -- a
 * bootstrap that has confirmed the tenant policy calls this with a Graph-backed factory -- and a check
 * calls it with a populated fixture. Nothing else in the chain knows the difference.
 */
let activitySourceFactory: ActivitySourceFactory = () => [
    new FixtureActivitySource([], 'Message'),
    new FixtureActivitySource([], 'Calendar'),
];

/** Replace the process-wide factory. Returns the previous one, so a check can restore it. */
export function SetActivitySourceFactory(factory: ActivitySourceFactory): ActivitySourceFactory {
    const previous = activitySourceFactory;
    activitySourceFactory = factory;
    return previous;
}

/** The factory in force. What the Action calls; never captured at import time. */
export function CurrentActivitySourceFactory(): ActivitySourceFactory {
    return activitySourceFactory;
}

export class ActivitySyncJob {
    private readonly ingest = new ActivityIngestService();

    /**
     * Runs every Active Microsoft365 connection once.
     *
     * ── ONE FAILING MAILBOX DOES NOT STOP THE OTHERS ──
     *
     * Each connection is independent, and its failure is recorded on its own row by the ingest service.
     * Aborting the loop would mean a single misconfigured mailbox silently stopped every other person's
     * mail from being ingested — a failure whose blast radius is invisible from the row that caused it.
     */
    public async Run(
        factory: ActivitySourceFactory,
        provider: IMetadataProvider,
        contextUser: UserInfo,
        limit = 100,
    ): Promise<SyncJobResult> {
        const result: SyncJobResult = { Success: true, ConnectionsAttempted: 0, Runs: [], Issues: [] };

        const connections = await new RunView().RunView<{
            ID: string;
            Mailbox: string | null;
            CredentialsRef: string | null;
        }>(
            {
                EntityName: E_ACTIVITY_SYNC_CONNECTION,
                /**
                 * Only Active, and only this provider. Gmail is a permitted `Provider` value in the schema
                 * and is explicitly out of scope — filtering here rather than skipping later means an
                 * unrelated connector cannot be picked up by accident the day somebody adds one.
                 */
                ExtraFilter: `Status = 'Active' AND Provider = '${SOURCE_SYSTEM_M365}'`,
                ResultType: 'simple',
                Fields: ['ID', 'Mailbox', 'CredentialsRef'],
            },
            contextUser,
        );

        if (!connections.Success) {
            result.Success = false;
            result.Issues.push(`Could not read the sync connections: ${connections.ErrorMessage}`);
            return result;
        }

        const rows = connections.Results ?? [];
        if (rows.length === 0) {
            /**
             * NOT A FAILURE. No Active connection is the ordinary state of a deployment that has not
             * switched ingestion on, and reporting it as an error would make the job red by default.
             */
            LogStatus('ActivitySyncJob: no Active Microsoft365 connections, so nothing was synced.');
            return result;
        }

        for (const connection of rows) {
            const sources = factory(connection);
            if (sources.length === 0) {
                result.Issues.push(
                    `No source could be built for connection ${connection.ID} (${connection.Mailbox ?? 'no mailbox'}).`,
                );
                result.Success = false;
                continue;
            }

            result.ConnectionsAttempted++;
            /**
             * EACH SURFACE IS ITS OWN RUN against its own watermark. Sequential rather than concurrent on
             * purpose: both writes touch the same connection row to advance a watermark, and two
             * concurrent saves would race, with the loser's advance silently lost.
             */
            for (const source of sources) {
                const run = await this.ingest.RunSync(connection.ID, source, provider, contextUser, limit);
                result.Runs.push({
                    ConnectionID: connection.ID,
                    Mailbox: connection.Mailbox,
                    Surface: source.Kind,
                    Result: run,
                });
                if (!run.Success) {
                    result.Success = false;
                    result.Issues.push(
                        `Connection ${connection.ID} (${source.Kind}) failed: ${run.Issues.join(' | ')}`,
                    );
                }
            }
        }

        return result;
    }
}
