/**
 * @fileoverview S-US9's write half — one `Activity` plus N `ActivityLink` rows, atomically.
 *
 * A SERVICE, NOT A COMPONENT, and that is the load-bearing choice rather than a style preference. Three
 * callers need this exact write: the workspace pane, the Outlook ingest, and any future automation that
 * records a system-generated activity. If the composition lived in the pane, the ingest would grow its
 * own copy, and the two would drift on the details that matter least visibly and most in aggregate —
 * which link roles get written, whether the deal link is present, which parties are attached.
 *
 * ── WHY ONE UNIT ──
 *
 * An `Activity` with no `ActivityLink` is unreachable: every read starts from a link, so a half-written
 * activity is invisible rather than wrong, which is worse — nothing surfaces it and nothing cleans it
 * up. `BeginEntityTransaction` JOINS an ambient transaction as a savepoint, so a caller already inside
 * one (`Sales.CloseDeal`, an integration check) gets everything settled together.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import {
    LogError,
    RunView,
    type DatabaseProviderBase,
    type IMetadataProvider,
    type UserInfo,
} from '@memberjunction/core';
import type {
    mjBizAppsCommonActivityEntity,
    mjBizAppsCommonActivityLinkEntity,
} from '@mj-biz-apps/common-entities';

import {
    E_ACTIVITY,
    E_ACTIVITY_LINK,
    E_ACTIVITY_TYPE,
    E_DEAL,
    E_ORGANIZATION,
    E_PERSON,
    type ActivityDirection,
    type ActivityIdentityKind,
    type ActivityLinkRole,
    type ActivityOutcome,
    type ActivitySource,
    type ActivityStatus,
    type ActivityTypeCode,
    type ActivityVisibility,
} from '@mj-biz-apps/sales-entities';

/** A party we know the identity of — a common `Person` or `Organization`. See the convention note. */
export interface ResolvedParty {
    Kind: 'Person' | 'Organization';
    RecordID: string;
    Role: ActivityLinkRole;
}

/**
 * A party we do NOT know, recorded so a later matcher can resolve it.
 *
 * `CK_ActivityLink_Target` is a strict exclusive-or: a link carries EITHER `EntityID` + `RecordID` or
 * `IdentityKind` + `IdentityValue`, never both and never neither. So an unknown participant is a
 * first-class row rather than a dropped one — which is what makes S-US10's "link to account and contact
 * even where no deal match exists" expressible without inventing a Person.
 */
export interface UnresolvedParty {
    Kind: ActivityIdentityKind;
    Value: string;
    Role: ActivityLinkRole;
}

export interface LogActivityInput {
    /** The deal this is about. Always linked, always role `Regarding`. */
    DealID: string;
    /** Resolved by CODE against the seeded `ActivityType` rows. */
    TypeCode: ActivityTypeCode;
    Title: string;
    StartedAt: Date;
    EndedAt?: Date | null;
    Description?: string | null;
    Direction?: ActivityDirection;
    Status?: ActivityStatus;
    Outcome?: ActivityOutcome | null;
    Visibility?: ActivityVisibility;
    Source?: ActivitySource;
    Location?: string | null;
    /** Free-form provider payload. The RFC-822 Message-ID lives here — there is no column for it. */
    Details?: string | null;
    /**
     * The dedupe key, and both halves or neither: `CK_Activity_External`.
     *
     * Supplying them makes the write IDEMPOTENT — a matching row short-circuits to
     * `AlreadyPresent` rather than racing the unique index.
     */
    SourceSystem?: string | null;
    ExternalID?: string | null;
    ExternalThreadID?: string | null;
    ActivitySyncConnectionID?: string | null;
    Parties?: ResolvedParty[];
    UnresolvedParties?: UnresolvedParty[];
    /**
     * Attach the deal's own account and primary contact as participants.
     *
     * Defaults TRUE for manual logging, because "where relevant to the account and contact" (S-US9) is
     * what a rep means by logging a call on a deal. The ingest passes false and supplies the actual
     * message participants instead — attaching the deal's contact to an email they were not on would be
     * a fabricated fact.
     */
    IncludeDealParties?: boolean;
}

export interface LogActivityResult {
    Success: boolean;
    ActivityID: string | null;
    LinkCount: number;
    /** An existing row matched `(SourceSystem, ExternalID)`; nothing was written. */
    AlreadyPresent: boolean;
    Issues: string[];
}

/** One `ActivityLink` to write, before it becomes a row. */
interface PendingLink {
    Role: ActivityLinkRole;
    EntityName?: string;
    RecordID?: string;
    IdentityKind?: ActivityIdentityKind;
    IdentityValue?: string;
}

export class ActivityWriterService {
    /**
     * Writes one activity and its links, or explains why it did not.
     *
     * Never throws for a business reason. A caller mid-ingest wants a report it can accumulate across a
     * batch, not an exception that loses the twelve messages it had already filed.
     */
    public async LogActivity(
        input: LogActivityInput,
        provider: IMetadataProvider,
        contextUser: UserInfo,
    ): Promise<LogActivityResult> {
        const result: LogActivityResult = {
            Success: false,
            ActivityID: null,
            LinkCount: 0,
            AlreadyPresent: false,
            Issues: [],
        };

        if (!input.DealID) {
            result.Issues.push('An activity needs the deal it is about.');
            return result;
        }
        if (!input.Title?.trim()) {
            result.Issues.push('An activity needs a title.');
            return result;
        }
        if (!this.commonIsInstalled(provider)) {
            result.Issues.push(
                'bizapps-common is not installed on this host, so there is no Activity entity to write to.',
            );
            return result;
        }

        const typeID = await this.resolveTypeByCode(input.TypeCode, contextUser);
        if (!typeID) {
            result.Issues.push(
                `No ActivityType with Code '${input.TypeCode}' exists. The six codes are seeded by `
                    + 'bizapps-common; this host is missing them.',
            );
            return result;
        }

        // IDEMPOTENCY BEFORE THE TRANSACTION, so a re-run costs one read rather than a rolled-back write.
        const existing = await this.findByExternalKey(input.SourceSystem, input.ExternalID, contextUser);
        if (existing) {
            result.Success = true;
            result.ActivityID = existing;
            result.AlreadyPresent = true;
            return result;
        }

        const links = await this.planLinks(input, provider, contextUser, result);

        const db = provider as unknown as DatabaseProviderBase;
        if (!db?.BeginEntityTransaction) {
            result.Issues.push(
                'This provider cannot open a transaction, so an activity and its links cannot be written '
                    + 'atomically. ActivityWriterService is server-only.',
            );
            return result;
        }

        const scope = await db.BeginEntityTransaction();
        try {
            const activity = await provider.GetEntityObject<mjBizAppsCommonActivityEntity>(E_ACTIVITY, contextUser);
            activity.NewRecord();
            activity.ActivityTypeID = typeID;
            activity.Title = input.Title.trim();
            activity.StartedAt = input.StartedAt;
            activity.EndedAt = input.EndedAt ?? null;
            activity.Description = input.Description ?? null;
            activity.Direction = input.Direction ?? 'Internal';
            activity.Status = input.Status ?? 'Logged';
            activity.Outcome = input.Outcome ?? null;
            activity.Visibility = input.Visibility ?? 'Internal';
            activity.Source = input.Source ?? 'Manual';
            activity.Location = input.Location ?? null;
            activity.Details = input.Details ?? null;
            activity.ExternalThreadID = input.ExternalThreadID ?? null;
            activity.ActivitySyncConnectionID = input.ActivitySyncConnectionID ?? null;

            /**
             * BOTH OR NEITHER, enforced here as well as by the constraint. Setting one alone fails at the
             * database naming `CK_Activity_External`, which tells a caller nothing about which half they
             * forgot.
             */
            const hasKey = !!input.SourceSystem && !!input.ExternalID;
            activity.SourceSystem = hasKey ? input.SourceSystem! : null;
            activity.ExternalID = hasKey ? input.ExternalID! : null;

            /** NOT NULL. Who filed it, which for the ingest is the account the scheduled job runs as. */
            activity.LoggedByUserID = contextUser.ID;

            if (!(await activity.Save())) {
                await scope.Rollback();
                result.Issues.push(
                    `The activity could not be saved: ${activity.LatestResult?.CompleteMessage ?? 'unknown error'}`,
                );
                return result;
            }

            let sequence = 0;
            for (const link of links) {
                const written = await this.writeLink(link, activity.ID, ++sequence, provider, contextUser);
                if (!written) {
                    await scope.Rollback();
                    result.Issues.push(
                        `The activity was rolled back because a link could not be written (role ${link.Role}). `
                            + 'An activity with no links is unreachable, so a partial write is not an option.',
                    );
                    return result;
                }
                result.LinkCount++;
            }

            await scope.Commit();
            result.Success = true;
            result.ActivityID = activity.ID;
            return result;
        } catch (err) {
            LogError(`ActivityWriterService.LogActivity failed for deal ${input.DealID}: ${err}`);
            try {
                await scope.Rollback();
            } catch (rollbackErr) {
                LogError(`Failed to roll back a partial activity write: ${rollbackErr}`);
            }
            result.Issues.push(`The activity could not be written: ${String(err)}`);
            return result;
        }
    }

    /**
     * Every link this activity owes, in write order.
     *
     * The deal is always first and always `Regarding` — it is the anchor every read starts from, so an
     * activity without it is invisible on the only surface that shows activities.
     */
    private async planLinks(
        input: LogActivityInput,
        provider: IMetadataProvider,
        contextUser: UserInfo,
        result: LogActivityResult,
    ): Promise<PendingLink[]> {
        const links: PendingLink[] = [
            { Role: 'Regarding', EntityName: E_DEAL, RecordID: input.DealID },
        ];

        if (input.IncludeDealParties !== false) {
            const parties = await this.dealParties(input.DealID, contextUser);
            /**
             * `Deal.AccountID` IS the Organization ID and `Deal.PrimaryContactID` IS the Person ID —
             * shared-PK IsA, so these values cross straight over with no translation. See the convention
             * note in `activity-vocabulary.ts`.
             */
            if (parties.AccountID) {
                links.push({ Role: 'Participant', EntityName: E_ORGANIZATION, RecordID: parties.AccountID });
            }
            if (parties.ContactID) {
                links.push({ Role: 'Participant', EntityName: E_PERSON, RecordID: parties.ContactID });
            }
        }

        for (const party of input.Parties ?? []) {
            if (!party.RecordID) {
                continue;
            }
            links.push({
                Role: party.Role,
                EntityName: party.Kind === 'Person' ? E_PERSON : E_ORGANIZATION,
                RecordID: party.RecordID,
            });
        }

        for (const party of input.UnresolvedParties ?? []) {
            if (!party.Value?.trim()) {
                continue;
            }
            links.push({ Role: party.Role, IdentityKind: party.Kind, IdentityValue: party.Value.trim() });
        }

        /**
         * DEDUPED BY TARGET, not by role. The deal's own contact is very often also a message
         * participant, and writing them twice would double them in any count built on links. First
         * occurrence wins, so an explicit role from the caller beats the generic `Participant` the deal
         * parties contribute only when the caller's link is planned first — which is why deal parties are
         * added before the caller's and the caller's roles overwrite nothing.
         */
        const seen = new Set<string>();
        const deduped: PendingLink[] = [];
        for (const link of links) {
            const key = link.RecordID
                ? `r:${link.EntityName}:${String(link.RecordID).toLowerCase()}`
                : `i:${link.IdentityKind}:${String(link.IdentityValue).toLowerCase()}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            deduped.push(link);
        }

        if (deduped.length === 1) {
            result.Issues.push(
                'The activity is linked to the deal only — no participant could be attached. It is still '
                    + 'reachable from the deal, but nobody is recorded as having been involved.',
            );
        }
        return deduped;
    }

    /** One `ActivityLink` row, on whichever half of `CK_ActivityLink_Target` the caller supplied. */
    private async writeLink(
        link: PendingLink,
        activityID: string,
        sequence: number,
        provider: IMetadataProvider,
        contextUser: UserInfo,
    ): Promise<boolean> {
        const entityID = link.EntityName
            ? provider.Entities.find((e) => e.Name === link.EntityName)?.ID
            : undefined;
        if (link.EntityName && !entityID) {
            LogError(`ActivityWriterService: entity '${link.EntityName}' is not registered on this host.`);
            return false;
        }

        const row = await provider.GetEntityObject<mjBizAppsCommonActivityLinkEntity>(E_ACTIVITY_LINK, contextUser);
        row.NewRecord();
        row.ActivityID = activityID;
        row.Role = link.Role;
        row.Sequence = sequence;
        // The XOR: exactly one pair is set, and the other is explicitly nulled.
        row.EntityID = entityID ?? null;
        row.RecordID = link.RecordID ?? null;
        row.IdentityKind = link.IdentityKind ?? null;
        row.IdentityValue = link.IdentityValue ?? null;

        if (await row.Save()) {
            return true;
        }
        LogError(`ActivityWriterService: link save failed — ${row.LatestResult?.CompleteMessage ?? 'unknown'}`);
        return false;
    }

    /** The deal's account and primary contact, as the IDs they share with common's parents. */
    private async dealParties(
        dealID: string,
        contextUser: UserInfo,
    ): Promise<{ AccountID: string | null; ContactID: string | null }> {
        const r = await new RunView().RunView<{ AccountID: string | null; PrimaryContactID: string | null }>(
            {
                EntityName: E_DEAL,
                ExtraFilter: `ID = '${escapeSql(dealID)}'`,
                ResultType: 'simple',
                Fields: ['AccountID', 'PrimaryContactID'],
            },
            contextUser,
        );
        const row = (r.Results ?? [])[0];
        return {
            AccountID: r.Success ? (row?.AccountID ?? null) : null,
            ContactID: r.Success ? (row?.PrimaryContactID ?? null) : null,
        };
    }

    /** The `ActivityType` for a code. Never a name — see `ActivityTypeCode`. */
    private async resolveTypeByCode(code: ActivityTypeCode, contextUser: UserInfo): Promise<string | null> {
        const r = await new RunView().RunView<{ ID: string }>(
            {
                EntityName: E_ACTIVITY_TYPE,
                ExtraFilter: `Code = '${escapeSql(code)}'`,
                ResultType: 'simple',
                Fields: ['ID'],
            },
            contextUser,
        );
        return r.Success ? ((r.Results ?? [])[0]?.ID ?? null) : null;
    }

    /**
     * An already-ingested row for this external key, or null.
     *
     * Reads the same `(SourceSystem, ExternalID)` pair `UQ_Activity_External` enforces, so this and the
     * index cannot disagree about what a duplicate is.
     */
    private async findByExternalKey(
        sourceSystem: string | null | undefined,
        externalID: string | null | undefined,
        contextUser: UserInfo,
    ): Promise<string | null> {
        if (!sourceSystem || !externalID) {
            return null;
        }
        const r = await new RunView().RunView<{ ID: string }>(
            {
                EntityName: E_ACTIVITY,
                ExtraFilter: `SourceSystem = '${escapeSql(sourceSystem)}' AND ExternalID = '${escapeSql(externalID)}'`,
                ResultType: 'simple',
                Fields: ['ID'],
            },
            contextUser,
        );
        return r.Success ? ((r.Results ?? [])[0]?.ID ?? null) : null;
    }

    private commonIsInstalled(provider: IMetadataProvider): boolean {
        return provider.Entities.some((e) => e.Name === E_ACTIVITY);
    }
}

/** Single-quote escaping for an `ExtraFilter` literal. */
export function escapeSql(value: string): string {
    return String(value).replace(/'/g, "''");
}
