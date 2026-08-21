/**
 * @fileoverview The ingest run: source → filter → match → write, with the watermark and failure state.
 *
 * Everything here is behind `IActivitySource`, so this whole file is exercised by the fixture source and
 * needs no mailbox. Order is not negotiable and is enforced by the shape of the method:
 *
 *   1. `Fetch`      — the source hands over normalized items
 *   2. `Apply`      — the relevance filter discards anything involving no known contact
 *   3. `MatchOpenDeals` — resolve which deal, if any
 *   4. `LogActivity`    — write, idempotently
 *   5. watermark    — advance `LastSyncAt` only if the run got that far
 *
 * Step 2 is the privacy boundary. No model call may be inserted before it; see `RelevanceFilter`.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { LogError, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import type { mjBizAppsCommonActivitySyncConnectionEntity } from '@mj-biz-apps/common-entities';

import { ActivityWriterService, escapeSql, type UnresolvedParty } from './ActivityWriterService.js';
import { DealMatcher } from './DealMatcher.js';
import { RelevanceFilter, type RelevanceVerdict } from './RelevanceFilter.js';
import { E_ACTIVITY_SYNC_CONNECTION, E_ACTIVITY_SYNC_RULE } from './activity-vocabulary.js';
import type { IActivitySource, NormalizedItem } from './ActivitySource.js';
import type { ActivityLinkRole } from './activity-vocabulary.js';

export interface IngestRunResult {
    Success: boolean;
    Fetched: number;
    /** Passed the relevance filter. */
    Relevant: number;
    /** Discarded because no participant was a known contact. Not a failure — the filter working. */
    Irrelevant: number;
    Written: number;
    /** Matched an existing `(SourceSystem, ExternalID)`; nothing written. The idempotency count. */
    Duplicates: number;
    /** Relevant, but matched no open deal. Filed against the parties only. */
    Unattributed: number;
    WatermarkAdvancedTo: Date | null;
    Issues: string[];
}

/** One include/exclude rule, as stored. */
interface SyncRuleRow {
    ID: string;
    IsEnabled: boolean;
    Sequence: number;
    Action: 'Include' | 'Exclude';
    ActivityTypeID: string | null;
    Direction: 'Inbound' | 'Outbound' | 'Internal' | null;
    DateFrom: string | Date | null;
    DateTo: string | Date | null;
    Filter: string | null;
}

interface ConnectionRow {
    ID: string;
    /** JSON. Holds the CALENDAR watermark; see `watermarkFor`. */
    Settings: string | null;
    Provider: string;
    Status: string;
    Mailbox: string | null;
    LastSyncAt: string | Date | null;
}

export class ActivityIngestService {
    private readonly writer = new ActivityWriterService();
    private readonly filter = new RelevanceFilter();
    private readonly matcher = new DealMatcher();

    /**
     * Runs one sync for one connection.
     *
     * ── WHY FAILURE LANDS ON THE CONNECTION ROW AND NOT IN A LOG ──
     *
     * `ActivitySyncConnection` has `Status` (Active/Paused/Error/Disabled) and `LastError` because a sync
     * that has been failing for a week is an operational fact somebody has to see. A log line is seen by
     * whoever happens to be tailing it. So a failed run sets `Status = 'Error'` with the reason, and a
     * successful one clears both — which means the row answers "is this working" without anyone reading
     * anything else.
     */
    public async RunSync(
        connectionID: string,
        source: IActivitySource,
        provider: IMetadataProvider,
        contextUser: UserInfo,
        limit = 100,
    ): Promise<IngestRunResult> {
        const result: IngestRunResult = {
            Success: false,
            Fetched: 0,
            Relevant: 0,
            Irrelevant: 0,
            Written: 0,
            Duplicates: 0,
            Unattributed: 0,
            WatermarkAdvancedTo: null,
            Issues: [],
        };

        const connection = await this.loadConnection(connectionID, contextUser);
        if (!connection) {
            result.Issues.push(`No ActivitySyncConnection with ID '${connectionID}' exists.`);
            return result;
        }

        /**
         * ONLY `Active` RUNS. Paused, Error and Disabled all mean "do not read this mailbox", and the
         * distinction between them is for a human — an operator paused it, a run failed, an admin turned
         * it off. Treating any of them as runnable would make pausing advisory.
         */
        /*
         * WHY THIS IS EXEMPT FROM THE VOCABULARY GATE, which correctly flagged it.
         *
         * `ActivitySyncConnection.Status` is a CHECK-constrained OPERATIONAL state in another app's
         * schema, not domain vocabulary: there is no companion type table and no behaviour flag to read
         * instead -- the column IS the state, and `recordFailure` below writes it. Renaming a value is a
         * migration in bizapps-common, not somebody editing a lookup row, so the hazard the gate guards
         * against -- a rename silently changing behaviour -- cannot arise here.
         */
        if (connection.Status !== 'Active') { // vocabulary-grep-allow: operational state, not vocabulary
            result.Issues.push(
                `Connection '${connectionID}' is ${connection.Status}, not Active, so no sync was attempted.`,
            );
            return result;
        }
        if (connection.Provider !== source.ProviderName) {
            result.Issues.push(
                `Connection provider '${connection.Provider}' does not match the source '${source.ProviderName}'.`,
            );
            return result;
        }
        if (!connection.Mailbox) {
            result.Issues.push(`Connection '${connectionID}' names no mailbox.`);
            await this.recordFailure(connectionID, 'No mailbox is configured.', provider, contextUser);
            return result;
        }

        try {
            /**
             * ONE WATERMARK PER SURFACE, and this is a correctness requirement rather than tidiness.
             *
             * A connection has two sources -- messages and calendar -- and they advance independently. A
             * shared `LastSyncAt` would take the max of both, so a meeting older than the newest email
             * would be considered already-seen and SKIPPED FOREVER: the watermark moved past it without
             * the calendar source ever having been asked. Nothing would error and no row would be
             * missing from anything anyone counts.
             *
             * `LastSyncAt` stays the MESSAGE watermark, so nothing about existing behaviour changes, and
             * the calendar's lives in `Settings` -- an existing nullable JSON column on the connection.
             * That avoids a migration in another app's schema for a field only this app reads.
             */
            const since = this.watermarkFor(connection, source.Kind);
            const batch = await source.Fetch({ Mailbox: connection.Mailbox, Since: since, Limit: limit });
            result.Fetched = batch.Items.length;
            result.Issues.push(...batch.Issues);

            const rules = await this.loadRules(connectionID, contextUser);
            const allowed = batch.Items.filter((item) => this.rulesAllow(item, rules));
            if (allowed.length !== batch.Items.length) {
                result.Issues.push(
                    `${batch.Items.length - allowed.length} item(s) were excluded by ActivitySyncRule rows.`,
                );
            }

            // ── THE PRIVACY BOUNDARY. Nothing above this line has looked at content for meaning. ──
            const verdicts = await this.filter.Apply(allowed, contextUser);
            const relevant = verdicts.filter((v) => v.IsRelevant);
            result.Relevant = relevant.length;
            result.Irrelevant = verdicts.length - relevant.length;

            for (const verdict of relevant) {
                await this.fileItem(verdict, connection, source, provider, contextUser, result);
            }

            /**
             * THE WATERMARK ADVANCES ON A SUCCESSFUL RUN ONLY, and to the newest item the SOURCE reported
             * rather than the newest one written. An item the filter discarded has still been seen, and
             * not advancing past it would re-read and re-discard it forever.
             */
            if (batch.HighWatermark) {
                await this.advanceWatermark(
                    connectionID,
                    batch.HighWatermark,
                    source.Kind,
                    provider,
                    contextUser,
                    result,
                );
            }

            await this.clearFailure(connectionID, provider, contextUser);
            result.Success = true;
            return result;
        } catch (err) {
            LogError(`ActivityIngestService.RunSync failed for connection ${connectionID}: ${err}`);
            result.Issues.push(`The sync failed: ${String(err)}`);
            await this.recordFailure(connectionID, String(err), provider, contextUser);
            return result;
        }
    }

    /**
     * Writes one relevant item — once per matched deal, or once against the parties when none matched.
     *
     * ── THE UNATTRIBUTED CASE IS THE POINT, NOT THE FALLBACK ──
     *
     * S-US10's third criterion is that items link to account and contact "even where no deal match
     * exists". The writer needs a `DealID`, so an unattributed item cannot go through the same path —
     * instead the parties are recorded as UNRESOLVED IDENTITIES on the deal-less side. That keeps the
     * evidence without inventing a stub Person, which the common migration forbids.
     */
    private async fileItem(
        verdict: RelevanceVerdict,
        connection: ConnectionRow,
        source: IActivitySource,
        provider: IMetadataProvider,
        contextUser: UserInfo,
        result: IngestRunResult,
    ): Promise<void> {
        const item = verdict.Item;
        const deals = await this.matcher.MatchOpenDeals(verdict.Matches, contextUser);

        if (deals.length === 0) {
            result.Unattributed++;
            result.Issues.push(
                `"${truncate(item.Subject)}" involves a known contact but matches no open deal, so it was `
                    + 'not filed. Its participants are known; a later matcher can attribute it.',
            );
            return;
        }

        for (const match of deals) {
            const written = await this.writer.LogActivity(
                {
                    DealID: match.DealID,
                    TypeCode: item.TypeCode,
                    Title: item.Subject,
                    Description: item.Body,
                    StartedAt: item.StartedAt,
                    EndedAt: item.EndedAt,
                    Location: item.Location,
                    Direction: item.Direction,
                    /**
                     * D-25, DECIDED: a cancelled meeting is `Cancelled`, not `Completed`.
                     *
                     * A meeting that did not happen is not a completed activity, and anyone reading a
                     * timeline would be misled by one that says it was. `CK_Activity_Status` already
                     * allows `'Cancelled'`, so this needs no new vocabulary -- the value was there and
                     * the earlier version simply was not using it.
                     *
                     * `Outcome` is deliberately left NULL. The nearest seeded outcome is `NoShow`, and
                     * that is a DIFFERENT fact: a no-show is a meeting that went ahead and somebody
                     * failed to attend. Reusing it for a meeting called off in advance would put a
                     * false claim in a column reports read.
                     */
                    Status: item.Cancelled ? 'Cancelled' : 'Completed',
                    /**
                     * `Integration`, never `Manual` — and only when the source actually contacted a
                     * remote. A fixture run writes `System`, so a database can never be read as holding
                     * real ingested mail when it holds test data.
                     */
                    Source: source.IsLive ? 'Integration' : 'System',
                    SourceSystem: source.ProviderName,
                    ExternalID: item.ExternalID,
                    ExternalThreadID: item.ExternalThreadID,
                    ActivitySyncConnectionID: connection.ID,
                    Details: safeStringify(item.Raw),
                    /**
                     * The deal's own parties are NOT added. Attaching the deal's contact to a message they
                     * were not on would be a fabricated fact — the participants below are the ones who
                     * were actually on it.
                     */
                    IncludeDealParties: false,
                    Parties: verdict.Matches.flatMap((known) => {
                        const role = roleFor(item, known.Address);
                        const parties = [];
                        if (known.PersonID) {
                            parties.push({ Kind: 'Person' as const, RecordID: known.PersonID, Role: role });
                        }
                        if (known.OrganizationID) {
                            parties.push({
                                Kind: 'Organization' as const,
                                RecordID: known.OrganizationID,
                                Role: 'Participant' as ActivityLinkRole,
                            });
                        }
                        return parties;
                    }),
                    /** Everyone on the message we do not know, kept as identities for a later matcher. */
                    UnresolvedParties: verdict.Unmatched.map<UnresolvedParty>((address) => ({
                        Kind: 'Email',
                        Value: address,
                        Role: roleFor(item, address),
                    })),
                },
                provider,
                contextUser,
            );

            if (written.AlreadyPresent) {
                result.Duplicates++;
            } else if (written.Success) {
                result.Written++;
            } else {
                result.Issues.push(`"${truncate(item.Subject)}" could not be filed: ${written.Issues.join(' | ')}`);
            }

            /**
             * ONE ROW, MANY DEALS — so only the FIRST deal writes it. `(SourceSystem, ExternalID)` is
             * unique, so a second deal would hit the idempotency short-circuit and count as a duplicate
             * rather than gaining a second `Regarding` link. Linking one activity to several deals needs a
             * writer that appends links to an existing row, which is a real gap: see D-20.
             */
            break;
        }
    }

    /**
     * Whether the stored rules allow this item.
     *
     * `Sequence` order, LAST MATCH WINS, default include. That is the ordinary firewall convention and
     * the one a reader of `Sequence` + `Action` would expect — but nothing in the schema states it, so it
     * is a choice recorded here rather than a fact read off the table. See D-21.
     *
     * `Filter` is NOT evaluated. It is a free-text column with no stated grammar, and inventing one here
     * would mean every future consumer had to match an undocumented dialect.
     */
    private rulesAllow(item: NormalizedItem, rules: SyncRuleRow[]): boolean {
        let allowed = true;
        for (const rule of rules) {
            if (!rule.IsEnabled) {
                continue;
            }
            if (rule.Direction && rule.Direction !== item.Direction) {
                continue;
            }
            if (rule.DateFrom && item.StartedAt < new Date(rule.DateFrom)) {
                continue;
            }
            if (rule.DateTo && item.StartedAt > new Date(rule.DateTo)) {
                continue;
            }
            allowed = rule.Action === 'Include';
        }
        return allowed;
    }

    private async loadConnection(id: string, contextUser: UserInfo): Promise<ConnectionRow | null> {
        const r = await new RunView().RunView<ConnectionRow>(
            {
                EntityName: E_ACTIVITY_SYNC_CONNECTION,
                ExtraFilter: `ID = '${escapeSql(id)}'`,
                ResultType: 'simple',
                Fields: ['ID', 'Provider', 'Status', 'Mailbox', 'LastSyncAt', 'Settings'],
            },
            contextUser,
        );
        return r.Success ? ((r.Results ?? [])[0] ?? null) : null;
    }

    private async loadRules(connectionID: string, contextUser: UserInfo): Promise<SyncRuleRow[]> {
        const r = await new RunView().RunView<SyncRuleRow>(
            {
                EntityName: E_ACTIVITY_SYNC_RULE,
                ExtraFilter: `ActivitySyncConnectionID = '${escapeSql(connectionID)}'`,
                OrderBy: 'Sequence ASC',
                ResultType: 'simple',
            },
            contextUser,
        );
        return r.Success ? (r.Results ?? []) : [];
    }

    /** The key in `Settings` holding the calendar watermark. */
    private static readonly CALENDAR_WATERMARK = 'CalendarLastSyncAt';

    /** The watermark for one surface. Messages use the column; the calendar uses `Settings`. */
    private watermarkFor(connection: ConnectionRow, kind: 'Message' | 'Calendar'): Date | null {
        if (kind === 'Message') {
            return connection.LastSyncAt ? new Date(connection.LastSyncAt) : null;
        }
        const stored = readSettings(connection.Settings)[ActivityIngestService.CALENDAR_WATERMARK];
        if (typeof stored !== 'string' || !stored) {
            return null;
        }
        const parsed = new Date(stored);
        /**
         * AN UNPARSEABLE WATERMARK IS TREATED AS ABSENT, not as an error. Hand-edited JSON is the likely
         * cause, and the recovery -- re-read the window and let dedupe absorb it -- costs one extra fetch.
         * Failing the run instead would leave the calendar permanently stuck on a typo.
         */
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    private async advanceWatermark(
        connectionID: string,
        to: Date,
        kind: 'Message' | 'Calendar',
        provider: IMetadataProvider,
        contextUser: UserInfo,
        result: IngestRunResult,
    ): Promise<void> {
        const row = await this.connectionEntity(connectionID, provider, contextUser);
        if (!row) {
            result.Issues.push('The watermark could not be advanced — the connection row would not load.');
            return;
        }

        if (kind === 'Message') {
            row.LastSyncAt = to;
        } else {
            /**
             * MERGED, NOT OVERWRITTEN. `Settings` is a shared JSON bag on another app's row -- anything
             * else keeping state there must survive this write, and replacing the object would delete it
             * silently.
             */
            const settings = readSettings(row.Settings);
            settings[ActivityIngestService.CALENDAR_WATERMARK] = to.toISOString();
            row.Settings = JSON.stringify(settings);
        }

        if (await row.Save()) {
            result.WatermarkAdvancedTo = to;
        } else {
            result.Issues.push(
                `The watermark could not be advanced: ${row.LatestResult?.CompleteMessage ?? 'unknown error'}. `
                    + 'The next run will re-read this window; dedupe will absorb it.',
            );
        }
    }
    private async recordFailure(
        connectionID: string,
        reason: string,
        provider: IMetadataProvider,
        contextUser: UserInfo,
    ): Promise<void> {
        const row = await this.connectionEntity(connectionID, provider, contextUser);
        if (!row) {
            return;
        }
        row.Status = 'Error';
        row.LastError = reason.slice(0, 4000);
        if (!(await row.Save())) {
            LogError(`Could not record the sync failure on connection ${connectionID}.`);
        }
    }

    /** A clean run clears the error, so `Status` reflects the LAST run rather than the worst one. */
    private async clearFailure(
        connectionID: string,
        provider: IMetadataProvider,
        contextUser: UserInfo,
    ): Promise<void> {
        const row = await this.connectionEntity(connectionID, provider, contextUser);
        if (!row || !row.LastError) {
            return;
        }
        row.LastError = null;
        row.Status = 'Active';
        await row.Save();
    }

    private async connectionEntity(
        id: string,
        provider: IMetadataProvider,
        contextUser: UserInfo,
    ): Promise<mjBizAppsCommonActivitySyncConnectionEntity | null> {
        const row = await provider.GetEntityObject<mjBizAppsCommonActivitySyncConnectionEntity>(
            E_ACTIVITY_SYNC_CONNECTION,
            contextUser,
        );
        return (await row.Load(id)) ? row : null;
    }
}

/**
 * `ActivitySyncConnection.Settings` parsed, or an empty bag.
 *
 * Never throws: the column is free-form JSON on a row this app does not own, so unparseable content is
 * somebody else's problem to fix and not a reason to fail a sync.
 */
function readSettings(raw: string | null | undefined): Record<string, unknown> {
    if (!raw) {
        return {};
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}

/** The role an address earned on this item, defaulting to `Participant` when it is not listed. */
function roleFor(item: NormalizedItem, address: string): ActivityLinkRole {
    const match = item.Participants.find((p) => p.Address.trim().toLowerCase() === address.trim().toLowerCase());
    return match ? match.Role : 'Participant';
}

/** `Details` is nvarchar(max); a payload that will not stringify must not take the whole run down. */
function safeStringify(value: Record<string, unknown>): string | null {
    try {
        return JSON.stringify(value);
    } catch {
        return null;
    }
}

function truncate(value: string, max = 60): string {
    return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
