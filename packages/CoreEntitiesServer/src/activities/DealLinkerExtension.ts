/**
 * @fileoverview `Sales.DealLinker` — sales' half of the Activity Sync Engine, as a registered
 * extension rather than a stage of an ingest sales owns.
 *
 * Common's engine is on `next` (bizapps-common#93). Local M5 links
 * `@mj-biz-apps/common-activity-sync`; publish of common + sales together is release work.
 * See MemberJunction/bizapps-common `plans/activity-sync-engine.md` §8.
 *
 * ── WHAT CHANGED, AND WHAT DELIBERATELY DID NOT ──────────────────────────────────────────────
 *
 * `DealMatcher` is UNCHANGED and stays in sales. Which deal an item belongs to is sales' question,
 * expressed against sales' entities and sales' `DealStatusType.IsOpen` flag — Common must never
 * learn what a deal is. What moves to Common is the machinery around it: fetching, normalizing,
 * qualifying, resolving parties, writing the Activity, advancing the watermark.
 *
 * So this class is thin on purpose. It is the seam between "an activity was written" and "sales
 * knows something about it", and nothing more.
 *
 * ── WHY IN-STREAM RATHER THAN AN ENTITY ACTION ──────────────────────────────────────────────
 *
 * An activity's links are what make it reachable — every read starts from a link. An activity that
 * commits without its deal link is observably unattributed until a second transaction catches up.
 * Running here, inside the engine's write transaction, keeps the activity and its attribution a
 * single atomic fact.
 *
 * ── AND WHY IT NEVER SUPPRESSES ANYTHING ──────────────────────────────────────────────────
 *
 * Extensions enrich; they never veto. Qualification already ran in Common. An item involving a
 * known contact but matching no open deal is still a legitimate activity — it is filed against the
 * parties with no `Regarding` link, which is the honest description of it. That is S-US10, and it
 * is only expressible because `CK_ActivityLink_Target` has an unresolved-identity half.
 *
 * ── DEAL PARTIES ARE SNAPSHOTTED, NOT RE-DERIVED LATER ────────────────────────────────────
 *
 * Ingest already links whoever was ON THE MESSAGE (email → ContactMethod → Person XOR Org).
 * That is not enough for a Person/Org reverse timeline, and it is not enough as history:
 * the deal's primary contact can change, and a person can change employer. So for every
 * matched deal this extension also writes `LoggedFor` links to that deal's `AccountID`
 * (Organization) and `PrimaryContactID` (Person) as they stood at ingest time. Shared-PK
 * IsA means those IDs are used verbatim under Common's entity names. A party already
 * linked from the message (any role) is not duplicated.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { LogError } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import type { mjBizAppsCommonActivityLinkEntity } from '@mj-biz-apps/common-entities';
import {
    BaseActivitySyncExtension,
    type ActivityWriteContext,
} from '@mj-biz-apps/common-activity-sync';

import { E_ACTIVITY_LINK, E_DEAL, E_ORGANIZATION, E_PERSON } from '@mj-biz-apps/sales-entities';
import { DealMatcher, type DealMatch, type KnownAddress } from './DealMatcher.js';

@RegisterClass(BaseActivitySyncExtension, 'Sales.DealLinker')
export class DealLinkerExtension extends BaseActivitySyncExtension {
    private readonly matcher: DealMatcher;

    constructor(matcher: DealMatcher = new DealMatcher()) {
        super();
        this.matcher = matcher;
    }

    public async Enrich(context: ActivityWriteContext): Promise<void> {
        const parties = this.toKnownAddresses(context);
        if (parties.length === 0) {
            return; // No party Common could resolve — nothing sales can attribute.
        }

        const result = await this.matcher.MatchOpenDeals(parties, context.ContextUser);

        /**
         * A FAILED READ IS NOT "NO MATCHES", and conflating them is the bug this branch exists to
         * prevent. `DealMatchResult` carries `ReadFailed` precisely because both cases produced an
         * empty `Matches` array, so a transient database blip got filed as "involves a known
         * contact but matches no open deal" — an item reported as considered when it had not been
         * looked at.
         *
         * Throwing hands the decision to the REGISTRATION rather than making it here: with the
         * default `FailurePolicy = 'Skip'` the activity still commits, unattributed, with the error
         * recorded; a deployment that would rather lose the activity than mis-attribute it sets
         * `Abort`. Either way it is visible.
         */
        if (result.ReadFailed) {
            throw new Error(
                `Sales.DealLinker could not read open deals for activity ${context.Activity.ID} ` +
                    `(${parties.length} resolved part${parties.length === 1 ? 'y' : 'ies'}); ` +
                    `attribution was not determined.`,
            );
        }

        const dealEntityID = this.resolveEntityID(context, E_DEAL);
        /**
         * Partial attribution under Skip is the stated choice, not a side effect.
         *
         * Links save one by one inside the open write transaction. If the second of three
         * matched deals fails, the first link is already in `context.Links` and Skip lets
         * the activity commit with that partial Regarding set. Rolling the activity back
         * because one deal link failed would hide the message from every deal — worse than
         * an incomplete set. A deployment that would rather lose the activity sets
         * FailurePolicy Abort on the registration.
         */
        const personEntityID = this.resolveEntityID(context, E_PERSON);
        const orgEntityID = this.resolveEntityID(context, E_ORGANIZATION);

        for (const match of result.Matches) {
            if (context.Signal?.aborted) {
                throw new Error(
                    `Sales.DealLinker timed out while linking activity ${context.Activity.ID}; ` +
                        'remaining deals were not attributed.',
                );
            }
            await this.addRegardingLink(context, match.DealID, dealEntityID);
            await this.snapshotDealParties(context, match, personEntityID, orgEntityID);
        }
    }

    /**
     * Persist the deal's account and primary contact as they were when this activity was filed.
     * Role `LoggedFor` (not From/To): these people may not have been on the message; they were
     * on the deal. Skip a party already linked from ingest (any role) — the reverse lookup
     * is by EntityID+RecordID, so a second LoggedFor row would not add reachability.
     */
    private async snapshotDealParties(
        context: ActivityWriteContext,
        match: DealMatch,
        personEntityID: string,
        orgEntityID: string,
    ): Promise<void> {
        if (match.PrimaryContactID) {
            await this.addPartyLink(context, personEntityID, match.PrimaryContactID, 'LoggedFor');
        }
        if (match.AccountID) {
            await this.addPartyLink(context, orgEntityID, match.AccountID, 'LoggedFor');
        }
    }

    /**
     * Common's resolved parties in the shape `DealMatcher` already speaks.
     *
     * `Address` is empty on purpose: Common has already done the address→party resolution, and
     * matching here is by record ID. Carrying the address through so this could re-derive it would
     * be a second, divergent answer to a question already settled.
     */
    private toKnownAddresses(context: ActivityWriteContext): KnownAddress[] {
        return context.ResolvedParties.map((party) => ({
            Address: '',
            PersonID: party.Kind === 'Person' ? party.RecordID : null,
            OrganizationID: party.Kind === 'Organization' ? party.RecordID : null,
        }));
    }

    /** The `MJ: Entities` ID for a name, which `ActivityLink.EntityID` points at. */
    private resolveEntityID(context: ActivityWriteContext, entityName: string): string {
        const entity = context.Provider.Entities.find((e) => e.Name === entityName);
        if (!entity) {
            LogError(`Sales.DealLinker: entity "${entityName}" is not registered in this host's metadata.`);
            throw new Error(`Sales.DealLinker: entity "${entityName}" not found — cannot link an activity.`);
        }
        return entity.ID;
    }

    /**
     * One `Regarding` link per matched deal.
     *
     * Several deals is a correct outcome, not a tie to break: a customer with two live pursuits
     * emails about both, and choosing one would hide the message from the other. Picking between
     * them would mean reading the message, which is a model call — and the engine has already
     * finished the stage where those are allowed.
     */
    private async addRegardingLink(
        context: ActivityWriteContext,
        dealID: string,
        dealEntityID: string,
    ): Promise<void> {
        await this.addResolvedLink(context, dealEntityID, dealID, 'Regarding');
    }

    private alreadyLinked(context: ActivityWriteContext, entityID: string, recordID: string): boolean {
        const want = recordID.toLowerCase();
        return context.Links.some(
            (link) =>
                (link.EntityID ?? '').toLowerCase() === entityID.toLowerCase() &&
                (link.RecordID ?? '').toLowerCase() === want,
        );
    }

    private async addPartyLink(
        context: ActivityWriteContext,
        entityID: string,
        recordID: string,
        role: 'LoggedFor',
    ): Promise<void> {
        if (this.alreadyLinked(context, entityID, recordID)) {
            return;
        }
        await this.addResolvedLink(context, entityID, recordID, role);
    }

    private async addResolvedLink(
        context: ActivityWriteContext,
        entityID: string,
        recordID: string,
        role: 'Regarding' | 'LoggedFor',
    ): Promise<void> {
        const row = await context.Provider.GetEntityObject<mjBizAppsCommonActivityLinkEntity>(
            E_ACTIVITY_LINK,
            context.ContextUser,
        );
        row.NewRecord();
        row.ActivityID = context.Activity.ID;
        row.Role = role;
        row.Sequence = context.Links.length + 1;
        // The XOR: the resolved pair is set and the identity pair is explicitly nulled.
        row.EntityID = entityID;
        row.RecordID = recordID;
        row.IdentityKind = null;
        row.IdentityValue = null;

        if (!(await row.Save())) {
            throw new Error(
                `Sales.DealLinker failed to link activity ${context.Activity.ID} as ${role} to ${recordID}: ` +
                    `${row.LatestResult?.CompleteMessage ?? 'unknown'}`,
            );
        }
        context.Links.push(row);
    }
}

/** Anti-tree-shaking anchor — registration is a side effect of import. */
export function LoadDealLinkerExtension(): void {
    void DealLinkerExtension;
}
