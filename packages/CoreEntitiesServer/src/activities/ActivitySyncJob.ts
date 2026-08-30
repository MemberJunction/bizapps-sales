/**
 * @fileoverview The hourly entry point — a thin loop over Common's ActivitySyncEngine.
 *
 * MJ's SchedulingEngine fires `Sales.SyncActivities`, which calls this. Common owns fetch,
 * qualification, write, watermark and extension dispatch. Sales owns the factory (which source
 * each mailbox reads) and `Sales.DealLinker`, which the engine runs inside the write
 * transaction because the class is registered here.
 *
 * The default factory is two EMPTY fixtures — one message, one calendar — so the seeded
 * hourly job is safe to ship Active: the run is real and writes nothing. A real credential
 * changes this factory, nothing else.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { LogStatus, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import {
    ActivitySyncEngine,
    FixtureActivitySyncProvider,
    type BaseActivitySyncProvider,
    type SyncEngineResult,
} from '@mj-biz-apps/common-activity-sync';

import { E_ACTIVITY_SYNC_CONNECTION, SOURCE_SYSTEM_M365 } from '@mj-biz-apps/sales-entities';

export interface SyncJobResult {
    /** True when every connection attempted succeeded. A run with no connections is a success. */
    Success: boolean;
    ConnectionsAttempted: number;
    Runs: {
        ConnectionID: string;
        Mailbox: string | null;
        Surface: BaseActivitySyncProvider['Kind'];
        Result: SyncEngineResult;
    }[];
    Issues: string[];
}

export type ActivitySourceFactory = (connection: {
    ID: string;
    Mailbox: string | null;
    CredentialsRef: string | null;
}) => BaseActivitySyncProvider[];

let activitySourceFactory: ActivitySourceFactory = () => [
    new FixtureActivitySyncProvider([], 'Message'),
    new FixtureActivitySyncProvider([], 'Calendar'),
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
    private readonly engine = new ActivitySyncEngine();

    /**
     * Runs every Active-or-Error Microsoft365 connection once per surface.
     *
     * `Error` retries: it is a record of the last run, not a person switching the mailbox
     * off. `Paused` and `Disabled` are not selected. One failing mailbox does not stop the
     * others.
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
                ExtraFilter:
                    `(Status = 'Active' OR Status = 'Error') AND Provider = '${SOURCE_SYSTEM_M365}'`, // vocabulary-grep-allow: operational state, not vocabulary
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
            for (const source of sources) {
                const run = await this.engine.Run(
                    connection.ID,
                    { DryRun: false, TriggerType: 'Scheduled', Limit: limit },
                    provider,
                    contextUser,
                    source,
                );
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
