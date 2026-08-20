/**
 * @fileoverview The hourly entry point — what a `MJ: Scheduled Jobs` row invokes.
 *
 * ── WHY THIS IS A RUNNER AND NOT A SEEDED JOB ───────────────────────────────────────────────────
 *
 * MJ's `SchedulingEngine` is the mechanism: a `ScheduledJob` row of type **Action**
 * (`ActionScheduledJobDriver`) on a six-field cron — `0 0 * * * *` for hourly. No external cron, and
 * nothing here schedules itself.
 *
 * What is deliberately NOT done is seeding that row. Every source available today either refuses (the
 * Graph source, until a tenant policy exists) or is a fixture (which has no business running in a
 * deployment). An `Active` hourly job would therefore write to `ActivitySyncConnection.LastError` once an
 * hour, forever, and the operator surface that exists to make a broken sync visible would be permanently
 * red for a sync that was never switched on. A row that cannot succeed is worse than no row.
 *
 * So this is the callable half, complete and tested. Turning it on is: create the Action metadata, create
 * the `ScheduledJob` row pointing at it, and flip a connection to `Active`. Recorded as D-23 with the
 * exact field values.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { LogStatus, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';

import { ActivityIngestService, type IngestRunResult } from './ActivityIngestService.js';
import { E_ACTIVITY_SYNC_CONNECTION, SOURCE_SYSTEM_M365 } from './activity-vocabulary.js';
import type { IActivitySource } from './ActivitySource.js';

export interface SyncJobResult {
    /** True when every connection attempted succeeded. A run with no connections is a success. */
    Success: boolean;
    ConnectionsAttempted: number;
    /** Per-connection outcomes, so a job log says which mailbox did what. */
    Runs: { ConnectionID: string; Mailbox: string | null; Result: IngestRunResult }[];
    Issues: string[];
}

/**
 * Builds the source for one connection.
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
}) => IActivitySource | null;

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
            const source = factory(connection);
            if (!source) {
                result.Issues.push(
                    `No source could be built for connection ${connection.ID} (${connection.Mailbox ?? 'no mailbox'}).`,
                );
                result.Success = false;
                continue;
            }

            result.ConnectionsAttempted++;
            const run = await this.ingest.RunSync(connection.ID, source, provider, contextUser, limit);
            result.Runs.push({ ConnectionID: connection.ID, Mailbox: connection.Mailbox, Result: run });
            if (!run.Success) {
                result.Success = false;
                result.Issues.push(`Connection ${connection.ID} failed: ${run.Issues.join(' | ')}`);
            }
        }

        return result;
    }
}
