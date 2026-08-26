/**
 * @fileoverview S-US9's read half — a deal's activities, newest first, with their parties.
 *
 * ── WHY THIS IS TWO VIEWS AND NOT A JOIN ──
 *
 * The natural query is "activities linked to this deal", which is a join from `ActivityLink` to
 * `Activity`. `RunView` reads one entity, so this reads the links, then the activities, then the links
 * again for the parties — three round trips, batched, rather than one per activity. The alternative is a
 * new database view, which means a migration in bizapps-common: another app's schema, for a query sales
 * can already express. Not worth it at a deal's scale, where the row count is tens.
 *
 * `RunViews` (plural) is the batching rule and is used for the two independent reads. The first read
 * cannot be batched with them, because the activity IDs it returns are what the others filter on.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';

import { escapeSql } from './ActivityWriterService.js';
import {
    E_ACTIVITY,
    E_ACTIVITY_LINK,
    E_DEAL,
    E_ORGANIZATION,
    E_PERSON,
    type ActivityDirection,
    type ActivityIdentityKind,
    type ActivityLinkRole,
    type ActivitySource,
    type ActivityStatus,
} from '@mj-biz-apps/sales-entities';

/** One party on an activity, resolved or not. */
export interface TimelineParty {
    Role: ActivityLinkRole;
    /** Set when the link named a record. `'Person' | 'Organization' | 'Deal' | 'Other'`. */
    Kind: 'Person' | 'Organization' | 'Deal' | 'Other' | 'Identity';
    RecordID: string | null;
    /** Set instead when the link carried an unresolved identity. */
    IdentityKind: ActivityIdentityKind | null;
    IdentityValue: string | null;
}

export interface TimelineEntry {
    ID: string;
    /** The TYPE's display name, resolved through the denormalized view column. */
    TypeName: string | null;
    Title: string;
    Description: string | null;
    StartedAt: Date | string;
    EndedAt: Date | string | null;
    Direction: ActivityDirection;
    Status: ActivityStatus;
    Source: ActivitySource;
    /** Non-null only on ingested rows. Present so a surface can badge "from Outlook". */
    SourceSystem: string | null;
    ExternalThreadID: string | null;
    Location: string | null;
    Parties: TimelineParty[];
}

export interface TimelineResult {
    Success: boolean;
    Entries: TimelineEntry[];
    Issues: string[];
}

/** Raw shapes off the two views, kept local so nothing leaks an untyped row. */
interface LinkRow {
    ActivityID: string;
    Role: ActivityLinkRole;
    EntityID: string | null;
    RecordID: string | null;
    IdentityKind: ActivityIdentityKind | null;
    IdentityValue: string | null;
    Sequence: number;
}

interface ActivityRow {
    ID: string;
    ActivityType: string | null;
    Title: string;
    Description: string | null;
    StartedAt: Date | string;
    EndedAt: Date | string | null;
    Direction: ActivityDirection;
    Status: ActivityStatus;
    Source: ActivitySource;
    SourceSystem: string | null;
    ExternalThreadID: string | null;
    Location: string | null;
}

export class ActivityReader {
    /**
     * Every activity linked to a deal, newest first.
     *
     * ORDERED BY `StartedAt`, not by created-at. "Chronological order" (S-US9) means when the call
     * happened, not when somebody got round to filing it — and an ingest backfilling last week's mail
     * would otherwise land the whole week at the top of the timeline.
     */
    public async TimelineForDeal(
        dealID: string,
        provider: IMetadataProvider,
        contextUser: UserInfo,
        limit = 200,
    ): Promise<TimelineResult> {
        const result: TimelineResult = { Success: false, Entries: [], Issues: [] };

        if (!dealID) {
            result.Issues.push('A timeline needs a deal.');
            return result;
        }
        const dealEntityID = provider.Entities.find((e) => e.Name === E_DEAL)?.ID;
        if (!dealEntityID) {
            result.Issues.push(`The entity '${E_DEAL}' is not registered on this host.`);
            return result;
        }
        if (!provider.Entities.some((e) => e.Name === E_ACTIVITY)) {
            /**
             * NOT AN ERROR. Sales runs standalone by design, so common being absent means "no activities
             * here", which an empty timeline says perfectly well. Returning failure would make the pane
             * render an error state on a working deployment.
             */
            result.Success = true;
            return result;
        }

        const anchors = await new RunView().RunView<LinkRow>(
            {
                EntityName: E_ACTIVITY_LINK,
                ExtraFilter: `EntityID = '${escapeSql(dealEntityID)}' AND RecordID = '${escapeSql(dealID)}'`,
                ResultType: 'simple',
                Fields: ['ActivityID'],
            },
            contextUser,
        );
        if (!anchors.Success) {
            result.Issues.push(`Reading the deal's activity links failed: ${anchors.ErrorMessage}`);
            return result;
        }

        const ids = [...new Set((anchors.Results ?? []).map((r) => String(r.ActivityID)))];
        if (ids.length === 0) {
            result.Success = true;
            return result;
        }

        const idList = ids.map((id) => `'${escapeSql(id)}'`).join(', ');
        const batched = await new RunView().RunViews(
            [
                {
                    EntityName: E_ACTIVITY,
                    ExtraFilter: `ID IN (${idList})`,
                    OrderBy: 'StartedAt DESC',
                    ResultType: 'simple',
                    MaxRows: limit,
                },
                {
                    EntityName: E_ACTIVITY_LINK,
                    ExtraFilter: `ActivityID IN (${idList})`,
                    OrderBy: 'Sequence ASC',
                    ResultType: 'simple',
                },
            ],
            contextUser,
        );

        const activityView = batched?.[0];
        const linkView = batched?.[1];
        if (!activityView?.Success) {
            result.Issues.push(`Reading the activities failed: ${activityView?.ErrorMessage ?? 'unknown error'}`);
            return result;
        }
        if (!linkView?.Success) {
            result.Issues.push(
                `Reading the activity parties failed: ${linkView?.ErrorMessage ?? 'unknown error'}. `
                    + 'Entries are returned without parties.',
            );
        }

        const partiesByActivity = this.groupParties(
            (linkView?.Success ? (linkView.Results as LinkRow[] | undefined) : undefined) ?? [],
            provider,
            dealEntityID,
        );

        for (const row of (activityView.Results as ActivityRow[] | undefined) ?? []) {
            result.Entries.push({
                ID: row.ID,
                TypeName: row.ActivityType ?? null,
                Title: row.Title,
                Description: row.Description ?? null,
                StartedAt: row.StartedAt,
                EndedAt: row.EndedAt ?? null,
                Direction: row.Direction,
                Status: row.Status,
                Source: row.Source,
                SourceSystem: row.SourceSystem ?? null,
                ExternalThreadID: row.ExternalThreadID ?? null,
                Location: row.Location ?? null,
                Parties: partiesByActivity.get(String(row.ID).toLowerCase()) ?? [],
            });
        }

        result.Success = true;
        return result;
    }

    /**
     * Parties grouped by activity, with the deal's own anchor link dropped.
     *
     * The `Regarding` link to the deal is how the activity was found — repeating it in the party list of
     * every entry would be noise on a surface that is already showing that deal.
     */
    private groupParties(
        links: LinkRow[],
        provider: IMetadataProvider,
        dealEntityID: string,
    ): Map<string, TimelineParty[]> {
        const personEntityID = provider.Entities.find((e) => e.Name === E_PERSON)?.ID?.toLowerCase();
        const orgEntityID = provider.Entities.find((e) => e.Name === E_ORGANIZATION)?.ID?.toLowerCase();
        const dealID = dealEntityID.toLowerCase();

        const grouped = new Map<string, TimelineParty[]>();
        for (const link of links) {
            const entityID = link.EntityID ? String(link.EntityID).toLowerCase() : null;
            if (entityID === dealID) {
                continue;
            }

            const kind: TimelineParty['Kind'] = !entityID
                ? 'Identity'
                : entityID === personEntityID
                    ? 'Person'
                    : entityID === orgEntityID
                        ? 'Organization'
                        : 'Other';

            const key = String(link.ActivityID).toLowerCase();
            const list = grouped.get(key) ?? [];
            list.push({
                Role: link.Role,
                Kind: kind,
                RecordID: link.RecordID ?? null,
                IdentityKind: link.IdentityKind ?? null,
                IdentityValue: link.IdentityValue ?? null,
            });
            grouped.set(key, list);
        }
        return grouped;
    }
}
