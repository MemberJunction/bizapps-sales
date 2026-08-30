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
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { LogError } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import type { mjBizAppsCommonActivityLinkEntity } from '@mj-biz-apps/common-entities';
import {
    BaseActivitySyncExtension,
    type ActivityWriteContext,
} from '@mj-biz-apps/common-activity-sync';

import { E_ACTIVITY_LINK, E_DEAL } from '@mj-biz-apps/sales-entities';
import { DealMatcher, type KnownAddress } from './DealMatcher.js';

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

        const dealEntityID = this.resolveDealEntityID(context);
        for (const match of result.Matches) {
            await this.addRegardingLink(context, match.DealID, dealEntityID);
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

    /** The `MJ: Entities` ID for Deals, which `ActivityLink.EntityID` points at. */
    private resolveDealEntityID(context: ActivityWriteContext): string {
        const entity = context.Provider.Entities.find((e) => e.Name === E_DEAL);
        if (!entity) {
            LogError(`Sales.DealLinker: entity "${E_DEAL}" is not registered in this host's metadata.`);
            throw new Error(`Sales.DealLinker: entity "${E_DEAL}" not found — cannot link an activity.`);
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
        const row = await context.Provider.GetEntityObject<mjBizAppsCommonActivityLinkEntity>(
            E_ACTIVITY_LINK,
            context.ContextUser,
        );
        row.NewRecord();
        row.ActivityID = context.Activity.ID;
        row.Role = 'Regarding';
        row.Sequence = context.Links.length + 1;
        // The XOR: the resolved pair is set and the identity pair is explicitly nulled.
        row.EntityID = dealEntityID;
        row.RecordID = dealID;
        row.IdentityKind = null;
        row.IdentityValue = null;

        if (!(await row.Save())) {
            throw new Error(
                `Sales.DealLinker failed to link activity ${context.Activity.ID} to deal ${dealID}: ` +
                    `${row.LatestResult?.CompleteMessage ?? 'unknown'}`,
            );
        }
        context.Links.push(row);
    }
}

/** Anti-tree-shaking anchor — registration is a side effect of import. */
export function LoadDealLinkerExtension(): void {
    // intentionally empty
}
