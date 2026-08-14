/**
 * @fileoverview `DealEntityServer` — the rules that need a database, on the one path every write takes.
 *
 * WHAT CHANGED, AND WHY THIS FILE GOT MUCH SMALLER. A deal is not one row, and until MJ v6 this class
 * had to compose the tree itself: transient `Lines` / `PaymentSchedule` arrays, a deletion queue, a
 * re-sequencer, and a `Save()` override that walked header → deletions → children inside an explicit
 * `BeginTransaction` / `CommitTransaction`. All of that is now **Related Record Collections** —
 * declared in metadata, generated onto `mjBizAppsSalesDealEntity`, and executed by MJ's
 * `EntitySavePlan` inside one `EntityTransactionScope`. The framework does header-before-children and
 * deletions-before-inserts because those orderings are inherent to the problem, not to this app.
 *
 * Deleting a hand-rolled implementation in favour of the framework's is only worth it when the
 * framework's is at least as careful. It is: `RelatedRecordCollection.Load()` throws on a failed read
 * AND refuses to load over unsaved children, which is the same "a failed load and an empty collection
 * must never look alike" contract the hand-written `LoadLines` documented — plus a guard against a
 * stray reload discarding work mid-edit, which the hand-written one did not have.
 *
 * WHAT REMAINS HERE IS EXACTLY WHAT NEEDS A DATABASE:
 *   - `DealNumber` — a gap-free counter taken from a locked row, inside the save's transaction.
 *   - The OWNER STAMP — `Deal.OwnerEmployeeID` derived from the `DealTeamMember` carrying the owner
 *     role, resolved from `DealRole.IsOwnerRole` rather than from any role name.
 *
 * WHAT THIS FILE MUST NEVER DO. Arithmetic on money. No summing lines into `Amount`, no applying
 * `RequestedDiscountPct`, no checking that the payment schedule adds up. `Amount` is a cached answer
 * from `Orders.PreviewOrder` carrying its own provenance; the signed figures on a line are
 * transcriptions.
 *
 * The form-shaped rules are NOT here — they are on {@link DealEntity} in `sales-entities`, which this
 * class extends, so they run in the browser as well as on the server. Extending `DealEntity` rather
 * than the generated entity is load-bearing: extend the generated one and every rule in that file
 * silently stops applying on the server.
 *
 * ── STILL TO COME (deliberately not stubbed) ────────────────────────────────────────────────────
 *   - S4: the CLOSE LOCK. When the deal's status has `DealStatusType.LocksDeal = 1`, the header
 *     (except Description / NextStep), its lines and its team become immutable, and reopening goes
 *     through `Sales.ReopenDeal` with a recorded reason.
 *   - S4: `DealStageEvent` append on stage transition, stamping `AmountAtTransition` and
 *     `ProbabilityAtTransition`. **This is the one to be careful with** — see the note on
 *     {@link DealEntityServer.Save} about where it has to go.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import {
    BaseEntity,
    DatabaseProviderBase,
    EntitySaveOptions,
    IMetadataProvider,
    IRunViewProvider,
    LogError,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { DealEntity } from '@mj-biz-apps/sales-entities';

import { getNextDealNumber } from './SequenceService.js';

const DEAL_ENTITY = 'MJ_BizApps_Sales: Deals';
const PIPELINE_ENTITY = 'MJ_BizApps_Sales: Pipelines';

/**
 * The one column the pipeline lookup selects. `CompanyID` is NOT NULL on `Pipeline`, so a successful read
 * always carries one.
 */
interface PipelineCompanyRow {
    CompanyID: string;
}

@RegisterClass(BaseEntity, DEAL_ENTITY)
export class DealEntityServer extends DealEntity {
    /**
     * Async validation always runs on this path. The base class defaults to skipping it; a deal that
     * carries a whole graph of children is exactly the case where you want it, and silently skipping
     * validation on the one code path every write takes would defeat the point of putting rules here.
     */
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    /**
     * Prepares the deal, then hands the whole graph to the framework.
     *
     * ── THIS METHOD IS CALLED TWICE PER COMPOSITE SAVE. Read this before adding anything to it. ──
     *
     * When a deal has children, `BaseEntity.Save()` routes to a save graph: it opens a transaction and
     * then executes the ROOT node by calling this record's `Save()` again with `IsGraphNodeSave` set.
     * So the sequence is:
     *
     *   1. `Save()`            — no flag. Preparation happens here.
     *   2. `Save()` internally — routes to the graph, which opens the transaction.
     *   3. `Save({IsGraphNodeSave})` — re-enters HERE, and must do nothing but write its own row.
     *
     * Anything unguarded would therefore run twice. The early return on `IsGraphNodeSave` is what
     * makes this method idempotent, and it is the reason a childless deal (which never takes the graph
     * path, so step 3 never happens) still gets its number: preparation lives on the outer call, which
     * always happens exactly once.
     *
     * **The S4 stage-event append must go in the `IsGraphNodeSave` branch, not the outer one** — it
     * needs to be inside the graph's transaction, so a rolled-back save cannot leave an event behind
     * claiming a transition that did not happen.
     */
    public override async Save(options?: EntitySaveOptions): Promise<boolean> {
        // The graph is executing our own row inside a transaction it already opened. Preparation ran
        // on the outer call; doing it again here would double it.
        if (options?.IsGraphNodeSave) {
            return super.Save(options);
        }

        try {
            await this.stampCompanyFromPipeline();
            await this.stampOwnerFromTeam();
        } catch (err) {
            LogError(`DealEntityServer.Save: could not resolve a server-maintained stamp: ${err}`);
            return false;
        }

        // Nothing to number: an existing deal, or one that already has a number. A number is only ever
        // assigned once — it appears in contracts, orders and people's email, so re-saving a deal must
        // never renumber it.
        if (this.IsSaved || this.DealNumber) {
            return super.Save(options);
        }

        return this.saveWithNewDealNumber(options);
    }

    /**
     * Takes the next deal number and saves, with both inside ONE transaction.
     *
     * The transaction is what makes the counter gap-free: `spAssignNextDealNumber` increments a locked
     * row, so a save that then fails must roll the increment back or the number is consumed by a deal
     * that does not exist. `BeginEntityTransaction` JOINS an ambient transaction rather than opening a
     * second one, so the graph's own scope nests inside this as a savepoint and the whole thing settles
     * together.
     *
     * The number is assigned BEFORE the header is written, because `DealNumber` carries a filtered
     * UNIQUE index and assigning it afterwards would mean a second write to a row that is already
     * visible.
     */
    private async saveWithNewDealNumber(options?: EntitySaveOptions): Promise<boolean> {
        const provider = this.ProviderToUse as unknown as DatabaseProviderBase;
        if (!provider?.BeginEntityTransaction) {
            throw new Error(
                'DealEntityServer.Save: the provider cannot open a transaction, so a deal number cannot be ' +
                'assigned safely. This class is server-only — it must run against a database provider.',
            );
        }

        const scope = await provider.BeginEntityTransaction();
        try {
            this.DealNumber = await getNextDealNumber(
                this.ContextCurrentUser,
                this.ProviderToUse as unknown as IMetadataProvider,
            );
            const saved = await super.Save(options);
            if (!saved) {
                await scope.Rollback();
                return false;
            }
            await scope.Commit();
            return true;
        } catch (err) {
            LogError(`Exception during DealEntityServer.Save(): ${err}`);
            try {
                await scope.Rollback();
            } catch (rollbackErr) {
                LogError(`Failed to roll back after a failed DealEntityServer.Save(): ${rollbackErr}`);
            }
            return false;
        }
    }

    /* ── Selling company ────────────────────────────────────────────────────── */

    /**
     * Forces `Deal.CompanyID` to the pipeline's company, ignoring whatever the caller supplied.
     *
     * THE PIPELINE IS THE ONLY SOURCE THAT CAN BE RIGHT. A deal belongs to the company that owns the
     * pipeline it sits in, and a CHECK constraint cannot express that — it cannot reach across the
     * foreign key to compare the two. So it is resolved on the write path instead, on every save, for
     * every caller.
     *
     * An explicitly supplied value is OVERWRITTEN rather than rejected. A client that gets this wrong is
     * not making a choice the app should honour or argue with; it is stating something it has no standing
     * to know, and the correct answer is available here.
     *
     * A missing pipeline is left alone: `Validate()` already refuses a deal without one, and raising a
     * second, vaguer complaint here would just bury the specific message the user needs.
     */
    private async stampCompanyFromPipeline(): Promise<void> {
        if (!this.PipelineID) {
            return;
        }

        const viewProvider = this.ProviderToUse as unknown as IRunViewProvider;
        const result = await viewProvider.RunView<PipelineCompanyRow>(
            {
                EntityName: PIPELINE_ENTITY,
                ExtraFilter: `ID = '${this.PipelineID}'`,
                ResultType: 'simple',
                Fields: ['CompanyID'],
            },
            this.ContextCurrentUser,
        );
        if (!result.Success) {
            throw new Error(`DealEntityServer: could not read the pipeline's company: ${result.ErrorMessage}`);
        }

        const pipeline = (result.Results ?? [])[0];
        if (!pipeline?.CompanyID) {
            throw new Error(
                `DealEntityServer: pipeline ${this.PipelineID} could not be read, so the selling company is unknown.`,
            );
        }
        this.CompanyID = pipeline.CompanyID;
    }

    /* ── Owner stamp (§5.1) ─────────────────────────────────────────────────── */

    /**
     * Maintains `Deal.OwnerEmployeeID` from whichever team member holds the owner role.
     *
     * `SetOwner` — the intent-expressing half — is on {@link DealEntity}, because the workspace's owner
     * picker has to express the same thing. What is server-only is this: keeping the DENORMALIZED stamp
     * true. `DealTeamMember` is the source of truth; the stamp exists only so "my deals" and per-rep
     * boards need no join, and nothing outside this hierarchy may write it.
     *
     * GUARDED ON THE COLLECTION BEING AUTHORITATIVE, which is the whole subtlety. A save that never
     * touched the roster has an empty, never-loaded `Team` — and deriving "no owner" from that would
     * silently CLEAR the stamp on every ordinary header edit. So the stamp is only rewritten when the
     * collection was actually loaded, or actually appended to.
     *
     * Both conditions are needed because `Add()` and `Create()` do not mark a collection loaded: a new
     * deal whose roster was composed in the browser arrives with `IsLoaded === false` and `Count > 0`.
     */
    private async stampOwnerFromTeam(): Promise<void> {
        if (!this.Team.IsLoaded && this.Team.Count === 0) {
            return; // the roster is not part of this save; leave the stamp alone
        }

        const ownerRoleID = await this.ResolveOwnerRoleID();
        const owner = this.Team.Items.find((m) => m.DealRoleID === ownerRoleID);
        this.OwnerEmployeeID = owner?.EmployeeID ?? null;
    }
}
