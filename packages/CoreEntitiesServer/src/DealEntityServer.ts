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
 *   - The CLOSE LOCK (S4). Once the deal's status carries `DealStatusType.LocksDeal = 1`, the header
 *     (except Description / NextStep), its lines, its instalments and its team are immutable, and
 *     reopening goes through `Sales.ReopenDeal`, which records a reason.
 *
 * ── STILL TO COME (deliberately not stubbed) ────────────────────────────────────────────────────
 *   - `DealStageEvent` append on ORDINARY stage transition, stamping `AmountAtTransition` and
 *     `ProbabilityAtTransition`. `Sales.CloseDeal` already stamps the CLOSE transition; consolidating
 *     the two into a single writer here is D-BD2. It must be inside the graph's transaction, which
 *     since MJ `47ff71d68b` means a scope opened around `super.Save()` rather than a graph-node
 *     branch — see the note on {@link DealEntityServer.Save}.
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
import {
    DEAL_FIELDS_EDITABLE_WHILE_LOCKED,
    DealEntity,
    type mjBizAppsSalesDealStageEventEntity,
} from '@mj-biz-apps/sales-entities';

import { getNextDealNumber } from './SequenceService.js';

const DEAL_ENTITY = 'MJ_BizApps_Sales: Deals';
const PIPELINE_ENTITY = 'MJ_BizApps_Sales: Pipelines';
const DEAL_STATUS_ENTITY = 'MJ_BizApps_Sales: Deal Status Types';

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
     * ── THIS METHOD RUNS EXACTLY ONCE PER SAVE, COMPOSITE OR NOT. ──
     *
     * That is a guarantee of MJ's, not an accident of ours, and it is worth knowing why because it used
     * to be false. When a deal has children, `BaseEntity.Save()` builds a save plan and routes to
     * `saveGraph`, which opens the transaction and executes every node — **the root included** — through
     * the private `BaseEntity.saveAsGraphNode`, which calls `_InnerSave` directly:
     *
     *     SaveSelfOnly: (entity, opts) => entity.saveAsGraphNode(opts)
     *
     * `_InnerSave` is BELOW this override, so the graph never re-enters `Save()`. Preparation therefore
     * happens once by construction, on the only call there is, and a childless deal (which never builds
     * a plan at all) takes the same single path.
     *
     * ── DO NOT RE-ADD A GRAPH-NODE GUARD ──
     *
     * Until MJ `47ff71d68b` the graph executed the root by calling this record's public `Save()` again
     * with `EntitySaveOptions.IsGraphNodeSave` set, so this method DID run twice and needed an early
     * return to stay idempotent. MJ deleted that flag deliberately — *"so application code cannot skip
     * companions by passing a public flag"* — and made the node path private. There is no successor
     * property and none is wanted: the re-entrancy the guard defended against no longer happens.
     *
     * `EntitySaveOptions.SkipRelatedCollections` is NOT that successor. It suppresses the caller's own
     * collections on the way in (orders' `OrderEntityServer` uses it to hold its lines back until the
     * header has a key); it says nothing about who is calling. Reaching for it here would skip the
     * deal's lines and team entirely.
     *
     * ── WHERE THE S4 STAGE-EVENT APPEND HAS TO GO (this changed too) ──
     *
     * `DealStageEvent` is append-only provenance, so a rolled-back save must not leave an event behind
     * claiming a transition that did not happen — the append has to be inside the same transaction as
     * the write. The old answer was "put it in the `IsGraphNodeSave` branch", because that branch ran
     * inside the graph's transaction. **That branch is gone, and code placed here now runs BEFORE the
     * graph opens anything.**
     *
     * The mechanism that still works is the one `saveWithNewDealNumber` below already uses: open a scope
     * with `BeginEntityTransaction()`, do the work, then call `super.Save(options)` inside it. The
     * graph's own scope JOINS an ambient transaction rather than opening a second one, so the append and
     * every row in the graph commit or roll back together.
     */
    public override async Save(options?: EntitySaveOptions): Promise<boolean> {
        /**
         * THE CLOSE LOCK (L-17, master plan §7.3) — enforced HERE and nowhere else.
         *
         * Once a deal enters a status where `DealStatusType.LocksDeal = 1` it is the provenance of a
         * contract and an order, and editing it retroactively falsifies both. Putting the check in the
         * entity server rather than the UI is the whole point: an Action, an agent and a raw
         * `BaseEntity.Save()` all hit the same wall.
         *
         * IT RUNS ONCE PER SAVE, and that is now structural rather than something this code arranges:
         * MJ executes graph nodes through a private path that never re-enters this override, so there is
         * exactly one call to be on. A composite deal and a childless one take the same single path.
         *
         * Runs BEFORE any transaction opens: a refused save should cost nothing.
         */
        if (this.IsSaved && !this._reopenInProgress) {
            const refusal = await this.checkCloseLock();
            if (refusal) {
                LogError(`DealEntityServer.Save refused: ${refusal}`);
                return false;
            }
        }

        try {
            await this.stampCompanyFromPipeline();
            await this.stampOwnerFromTeam();
        } catch (err) {
            LogError(`DealEntityServer.Save: could not resolve a server-maintained stamp: ${err}`);
            return false;
        }

        // AFTER the company stamp, deliberately. See the method for why it cannot be earlier and why
        // it does not belong in the workspace.
        this.provisionEmbeddedOrder();

        // Nothing to number: an existing deal, or one that already has a number. A number is only ever
        // assigned once — it appears in contracts, orders and people's email, so re-saving a deal must
        // never renumber it.
        const saved = this.IsSaved || this.DealNumber
            ? await this.saveWithStageEvent(options)
            : await this.saveWithNewDealNumber(options);

        if (!saved) {
            this.explainOrderProvisioningFailure();
        }
        return saved;
    }

    /* ── STAGE PROVENANCE ─────────────────────────────────────────────────────────────────────────
     *
     * Deliberately its own block, and deliberately not folded into `provisionEmbeddedOrder` or the
     * numbering path. These are three unrelated jobs that happen to share a save, and keeping them
     * separate is what makes the next merge here a merge rather than an archaeology exercise.
     */

    /**
     * Saves, and appends a `DealStageEvent` when the deal moved stage — both or neither.
     *
     * ── WHY THIS LIVES HERE NOW ──
     *
     * It used to live in `Sales.SaveDeal`, which no longer exists. That is not just a relocation: an
     * operation could only stamp moves that came through IT, so a stage change made by an Action, an
     * agent, a fixture or a raw `BaseEntity.Save()` left no trace. On the entity server it is the one
     * path every write takes — the same reasoning that puts the close lock here.
     *
     * ── BOTH OR NEITHER ──
     *
     * A moved deal with no event is a hole in an append-only log; an event for a move that failed is
     * worse, because it is a claim about history that never happened. So the two share one scope.
     * `BeginEntityTransaction` JOINS an ambient transaction rather than opening a second, so a caller
     * already in one — `Sales.CloseDeal`, or an integration check — gets a savepoint and everything
     * still settles together.
     *
     * A save that does NOT move the stage takes no transaction at all. The overwhelming majority of
     * deal saves are edits to a field nobody is watching, and wrapping those in a scope would be a cost
     * paid on every keystroke for a guarantee they do not need.
     */
    private async saveWithStageEvent(options?: EntitySaveOptions): Promise<boolean> {
        /**
         * THE PERSISTED VALUES, read before the save overwrites them.
         *
         * `OldValue` is what is on disk, which is the only thing that makes a transition detectable —
         * and the same discipline the close lock uses when it asks whether the deal was ALREADY locked
         * rather than whether it is about to be.
         */
        const priorStageID = (this.GetFieldByName('PipelineStageID')?.OldValue as string | null) ?? null;
        const stageChanged = priorStageID !== null && priorStageID !== (this.PipelineStageID ?? null);

        if (!stageChanged) {
            return super.Save(options);
        }

        const prior = {
            StageID: priorStageID,
            StatusID: (this.GetFieldByName('DealStatusTypeID')?.OldValue as string | null) ?? null,
            /**
             * THE STAMPS COME FROM THE PRIOR VALUES, NOT THE NEW ONES, and that is the whole point of
             * the table. A board drag applies the target stage's probability default, so reading the
             * current value here would record the number the deal acquired by ARRIVING rather than the
             * one it held on the way out — and every velocity report built on it would be quietly wrong.
             */
            Amount: (this.GetFieldByName('Amount')?.OldValue as number | null) ?? null,
            Probability: (this.GetFieldByName('Probability')?.OldValue as number | null) ?? null,
        };

        const provider = this.ProviderToUse as unknown as DatabaseProviderBase;
        if (!provider?.BeginEntityTransaction) {
            throw new Error(
                'DealEntityServer.Save: the provider cannot open a transaction, so a stage move cannot be ' +
                'recorded atomically. This class is server-only — it must run against a database provider.',
            );
        }

        const scope = await provider.BeginEntityTransaction();
        try {
            const saved = await super.Save(options);
            if (!saved) {
                await scope.Rollback();
                return false;
            }
            await this.appendStageEvent(prior);
            await scope.Commit();
            return true;
        } catch (err) {
            LogError(`DealEntityServer.saveWithStageEvent failed for deal ${this.ID}: ${err}`);
            try {
                await scope.Rollback();
            } catch (rollbackErr) {
                LogError(`Failed to roll back after a failed stage-event append: ${rollbackErr}`);
            }
            return false;
        }
    }

    /**
     * Writes the one `DealStageEvent` a move owes.
     *
     * APPEND-ONLY — never edited, never deleted. Note what is NOT here: no close, no routing, no
     * downstream call. A stage change is a stage change; closing is `Sales.CloseDeal` and stays an
     * explicit act, even when the stage a deal moves into is the one a pipeline calls Signed.
     */
    private async appendStageEvent(
        prior: { StageID: string | null; StatusID: string | null; Amount: number | null; Probability: number | null },
    ): Promise<void> {
        const provider = this.ProviderToUse as unknown as IMetadataProvider;
        const user = this.ContextCurrentUser;
        const event = await provider.GetEntityObject<mjBizAppsSalesDealStageEventEntity>(
            'MJ_BizApps_Sales: Deal Stage Events',
            user,
        );
        event.NewRecord();
        event.DealID = this.ID;
        event.FromStageID = prior.StageID;
        event.ToStageID = this.PipelineStageID;
        event.FromDealStatusTypeID = prior.StatusID;
        event.ToDealStatusTypeID = this.DealStatusTypeID;
        event.ChangedByUserID = user?.ID ?? null;
        event.ChangedAt = new Date();
        event.AmountAtTransition = prior.Amount;
        event.ProbabilityAtTransition = prior.Probability;

        if (!(await event.Save())) {
            // THROWN, not returned: the caller's scope must roll the deal move back with it.
            throw new Error(
                `the stage event could not be written: ${event.LatestResult?.CompleteMessage ?? 'unknown error'}`,
            );
        }
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

    /**
     * Gives a brand-new deal its embedded order, in Draft, on the deal's FIRST save.
     *
     * ── WHY THE ENTITY SERVER AND NOT THE WORKSPACE ──
     *
     * The workspace called `OrderID_EnsureObject()` from `AddLine()`, so a deal only got an order when
     * somebody added a line THROUGH THE UI. An agent, an importer, a remote operation or a plain
     * `BaseEntity.Save()` each produced a deal with no order at all -- and S-US4 puts the order at
     * creation, not at first line. Same reasoning as the close lock below: a rule the UI enforces holds
     * only until something that is not the UI writes.
     *
     * ── WHY FIRST SAVE AND NOT NewRecord() ──
     *
     * `OrderHeader.CompanyID` is NOT NULL, and a deal does not know its company until
     * `stampCompanyFromPipeline()` has run: the caller supplies a PipelineID and the selling company is
     * derived from it (D-4). Provisioning in `NewRecord()` would mean inventing a company or building an
     * order that cannot be inserted. So it happens here, after the stamps, on the one call where
     * `IsSaved` is still false.
     *
     * Idempotent twice over: `Ensure()` returns any existing peer, and the guard below means a re-save
     * never re-provisions and a deal that already carries an `OrderID` is left alone.
     *
     * ── WHAT SALES STATES, AND WHAT IT DOES NOT ──
     *
     * Company, type, and who to bill. NOT a status: orders' own `NewRecord()` defaults it to Draft, and
     * restating that here would be sales asserting an order lifecycle it does not own. NOT an
     * `OrderNumber`: the server subclass in orders mints it, which is what the diagnostic below is about.
     *
     * `BillToOrganizationID` and `BillToPersonID` are BOTH set, and unlike the contract case that is
     * legal -- `OrderHeader` has no XOR across them, checked against `sys.check_constraints`. Do not
     * carry the contract's exactly-one rule across by analogy; it is that table's rule, not a house style.
     * `Deal.AccountID` is a `SalesAccount`, an IsA child of common's `Organization`, so its key IS an
     * organization key; `PrimaryContactID` is a `SalesContact`, an IsA child of `Person`.
     */
    private provisionEmbeddedOrder(): void {
        if (this.IsSaved || this.OrderID) {
            return;
        }
        if (!this.CompanyID) {
            // The pipeline stamp resolved no company, so an order cannot be inserted. Say nothing and
            // let the deal's own validation report the missing pipeline -- failing later inside orders
            // would name a column instead of the actual mistake.
            return;
        }

        const order = this.OrderID_EnsureObject();
        order.CompanyID = this.CompanyID;
        order.OrderType = 'Sale';
        order.BillToOrganizationID = this.AccountID ?? null;
        order.BillToPersonID = this.PrimaryContactID ?? null;
    }

    /**
     * Turns the one failure this provisioning can cause into a message that names its cause.
     *
     * `OrderNumber` is NOT NULL and is minted by the SERVER subclass in orders. If that class is not
     * registered in the process, `ClassFactory` resolves the generated `OrderHeader` instead, nothing
     * mints a number, and the insert dies on a NOT NULL violation raised inside the save graph. What
     * reaches the caller is `Save failed for OrderID_Object (MJ_BizApps_Orders: Order Headers): Error
     * executing SQL` -- which names the entity, not the reason, and reads like a database fault rather
     * than a missing import.
     *
     * SALES MUST NOT FIX THAT BY DEPENDING ON ORDERS' SERVER PACKAGE. Neither `sales-server` nor
     * `sales-core-entities-server` does, and neither should start: loading another app's server classes
     * from inside this one is how two registrations for one key end up decided by import order. MJAPI
     * owns that -- MJ declares orders' server packages itself, which is why the running app works. A
     * bare node harness has to call `LoadBizAppsOrdersServer()` on its own.
     *
     * So this cannot repair anything. It exists to stop the next person debugging the wrong layer.
     */
    private explainOrderProvisioningFailure(): void {
        const order = this.OrderID_Object;
        if (!order || order.IsSaved || order.OrderNumber) {
            return;   // whatever failed, it was not this
        }
        LogError(
            'DealEntityServer.Save: the embedded order was not written and has no OrderNumber. That ' +
            'column is NOT NULL and is minted by the server subclass in orders, so this is what it looks ' +
            'like when OrderEntityServer is not registered in this process and ClassFactory fell back to ' +
            'the generated OrderHeader. In MJAPI it arrives through the dependencies MJ declares; in a ' +
            'script, call LoadBizAppsOrdersServer() before saving. Not a database or constraint problem.',
        );
    }

    /* ── The close lock (L-17, master plan §7.3) ────────────────────────────── */

    /**
     * Set only for the duration of {@link BeginReopen}, which is the ONE audited path through the lock.
     *
     * Deliberately NOT public: a caller that could set this could bypass the lock, which would make the
     * lock advisory. `Sales.ReopenDeal` records a reason; nothing else may get through.
     */
    private _reopenInProgress = false;

    /**
     * The fields that stay editable on a locked deal — read from the SHARED rule, not redeclared.
     *
     * It moved to `@mj-biz-apps/sales-entities` so the Explorer Deal form can apply the same list. A
     * second copy here would drift, and the drift would only ever surface as a user typing into a field
     * the server then refuses. See `close-lock.ts` for the reasoning; CD14 pins it to real behaviour.
     */
    private static readonly LOCK_EDITABLE_FIELDS = DEAL_FIELDS_EDITABLE_WHILE_LOCKED;

    /**
     * Runs `body` with the close lock suppressed, and always restores it.
     *
     * The `finally` is the point: an exception inside the reopen must not leave the lock disabled for
     * the rest of this entity's life, which would silently turn every later save into an unguarded one.
     */
    public async BeginReopen<T>(body: () => Promise<T>): Promise<T> {
        this._reopenInProgress = true;
        try {
            return await body();
        } finally {
            this._reopenInProgress = false;
        }
    }

    /**
     * Why this save is refused, or null if it is allowed.
     *
     * KEYED ON THE **PERSISTED** STATUS, via `OldValue` — not on the in-memory one. That is what makes
     * the closing transition itself legal: a deal moving open → closed still has an OPEN status in the
     * database, so it passes, and only saves made once the deal is ALREADY closed are refused. Reading
     * the current value instead would make a deal impossible to close.
     */
    private async checkCloseLock(): Promise<string | null> {
        const persistedStatusID = this.GetFieldByName('DealStatusTypeID')?.OldValue as string | null | undefined;
        if (!persistedStatusID) {
            return null;
        }
        if (!(await this.statusLocksDeal(persistedStatusID))) {
            return null;
        }

        const changed = this.Fields.filter(
            (f) => f.Dirty && !DealEntityServer.LOCK_EDITABLE_FIELDS.has(f.Name),
        ).map((f) => f.Name);

        /**
         * THE CHILD COLLECTIONS COUNT AS CHANGES TOO, and this half did not exist when the lock was
         * written — the collections did not exist either.
         *
         * A deal's lines are exactly what a contract and an order were derived from, so editing or
         * removing one on a closed deal falsifies the same provenance the header lock protects. But
         * `Lines`, `PaymentSchedule` and `Team` are COMPANIONS, not fields: they never appear in
         * `this.Fields`, so the header check above cannot see them. Without this the lock would refuse a
         * renamed deal and happily accept a deleted line, which is the more damaging edit of the two.
         *
         * Enumerated as `Companions` rather than as the three collections by name, deliberately: anything
         * that contributes work to this record's save is something the lock has to see, and naming them
         * individually would mean a collection added later is silently unprotected.
         *
         * Guarded by the same already-closed test, so the closing transition may still carry final
         * collection state — a close that writes its last line is legal; editing that line tomorrow is
         * not.
         */
        const dirtyCollections = this.Companions
            .filter((c) => c.Dirty)
            .map((c) => c.Name);

        const all = [...changed, ...dirtyCollections];
        if (all.length === 0) {
            return null;
        }
        return (
            `this deal is closed and locked; ${all.join(', ')} cannot be changed. ` +
            `Reopen it through Sales.ReopenDeal, which records a reason.`
        );
    }

    /**
     * Whether a status carries `LocksDeal`.
     *
     * THE FLAG, never the name — a deployment may call its winning status "Signed", and this must keep
     * working. It is also why the lock is a property of the STATUS TYPE rather than of the stage.
     */
    private async statusLocksDeal(statusID: string): Promise<boolean> {
        const provider = this.ProviderToUse as unknown as IRunViewProvider;
        const result = await provider.RunView(
            {
                EntityName: DEAL_STATUS_ENTITY,
                ExtraFilter: `ID = '${statusID}'`,
                ResultType: 'simple',
                Fields: ['LocksDeal'],
            },
            this.ContextCurrentUser,
        );
        if (!result.Success) {
            // FAIL CLOSED. If the status cannot be read we cannot prove the deal is unlocked, and
            // wrongly allowing an edit to a closed deal is the more expensive mistake.
            LogError(`DealEntityServer.statusLocksDeal: could not read status ${statusID}: ${result.ErrorMessage}`);
            return true;
        }
        const row = (result.Results ?? [])[0] as { LocksDeal?: boolean } | undefined;
        return row?.LocksDeal === true;
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
