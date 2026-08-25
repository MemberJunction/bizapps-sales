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
import { createHash } from 'node:crypto';

import { RegisterClass } from '@memberjunction/global';
// ORDERS' OWN RULE, imported rather than restated. `CanTransition` is the same function
// `OrderEntityServer.passesStatusTransition()` consults, so a refusal here and a refusal there cannot
// disagree — and the reason string the warning carries is orders' wording, not this app's guess at it.
import { CanTransition, type OrderStatus } from '@mj-biz-apps/orders-entities';
import {
    DEAL_FIELDS_EDITABLE_WHILE_LOCKED,
    DealEntity,
    type mjBizAppsSalesDealStageEventEntity,
} from '@mj-biz-apps/sales-entities';

import { SALES_SCHEMA, getNextDealNumber } from './SequenceService.js';

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

const STAGE_ENTITY = 'MJ_BizApps_Sales: Pipeline Stages';
const ORDER_HEADER_ENTITY = 'MJ_BizApps_Orders: Order Headers';

/** The one column the order lookup selects for the amount cache. */
interface OrderTotalRow {
    TotalGross: number | null;
}

/** The one column the stage lookup selects for the order rule. */
interface StageOrderStatusRow {
    OrderStatusOnEntry: string | null;
}

/**
 * What entering a stage asks of the deal's order — resolved before the transaction, applied inside it.
 *
 * A plan exists ONLY when there is something to do: the stage actually changed, and the new stage names
 * a status. Everything else is `null`, so the ordinary save path is untouched by this feature.
 */
/**
 * What a stage says a deal's forecast fields should become on entry.
 *
 * `null` on either field is a real answer — a stage that states no probability leaves the deal's at null
 * rather than inventing one — so this carries the values rather than a "should apply" flag.
 */
interface StageDefaultsPlan {
    Probability: number | null;
    ForecastCategoryTypeID: string | null;
    /**
     * The status the stage declares. `PipelineStage.DealStatusTypeID` is seeded on every stage — the open
     * ones by `@lookup:…Code=OPEN` — and the pipeline board already reads it as authoritative when it
     * derives `IsClosing`. So the column exists for this, is populated, and has a consumer; this makes the
     * write path agree with the reader.
     */
    DealStatusTypeID: string | null;
}

interface StageOrderPlan {
    StageID: string;
    Target: OrderStatus;
}

/**
 * The persisted state a deal held on the way OUT of a stage — what `DealStageEvent` records.
 *
 * A snapshot rather than a read at write time, because by then `super.Save()` has overwritten the
 * values. See {@link DealEntityServer.planStageEvent}.
 */
/**
 * The kinds of governed transition a remote operation can declare. Both are transactional acts that own
 * their own provenance — `Sales.CloseDeal` and `Sales.ReopenDeal`. An ordinary stage move declares
 * nothing; it is detected, not announced.
 */
export type DealTransitionKind = 'Close' | 'Reopen';

interface DeclaredTransition {
    Kind: DealTransitionKind;
    Note: string | null;
}

interface StageMoveSnapshot {
    StageID: string | null;
    StatusID: string | null;
    Amount: number | null;
    /**
     * Whether {@link Amount} came from the orders engine, as of the moment BEFORE this transition.
     *
     * Read from `OldValue` for the same reason the amount is: the stamp describes what the deal was worth
     * and where that figure came from on the way OUT, not what it acquired by arriving.
     */
    AmountIsComputed: boolean | null;
    Probability: number | null;
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
     * The mechanism that still works is the one {@link DealEntityServer.saveWithinScope} uses: open a
     * scope with `BeginEntityTransaction()`, do the work, then call `super.Save(options)` inside it. The
     * graph's own scope JOINS an ambient transaction rather than opening a second one, so the append and
     * every row in the graph commit or roll back together.
     *
     * **That append now exists** (D-BD2) and shares its scope with two other jobs. `saveWithinScope` is
     * where the ordering between them is decided and is the only place this class opens a transaction.
     */
    public override async Save(options?: EntitySaveOptions): Promise<boolean> {
        // Per-save, so a caller reading them after `Save()` sees this save's warnings and not the last
        // one's. Cleared before the close lock can return early — an abandoned save has no warnings.
        this._orderStatusWarnings.length = 0;
        this._orderJustProvisioned = false;
        this._lockedAtSave = false;
        this._lastStageEventID = null;

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

        /**
         * THE OWNER STAMP IS NOT A FIELD ANYONE MAY SET (S-US1: "cannot be edited directly").
         *
         * Refused here, beside the close lock, and for the same reason it is: the UI already hides the
         * field, and a rule that only the UI enforces is not a rule. Runs before the stamps below so a
         * refused save costs nothing.
         */
        const ownerRefusal = this.ownerStampEditRefusal();
        if (ownerRefusal) {
            LogError(`DealEntityServer.Save refused: ${ownerRefusal}`);
            return false;
        }

        try {
            await this.stampCompanyFromPipeline();
            await this.stampOwnerFromTeam();
        } catch (err) {
            LogError(`DealEntityServer.Save: could not resolve a server-maintained stamp: ${err}`);
            return false;
        }

        /**
         * AFTER the company stamp, deliberately — and NOT AT ALL on a locked deal.
         *
         * The lock check above has already run, so `_lockedAtSave` is trustworthy here. A locked deal
         * that reaches this point is one making a PERMITTED edit (Description, NextStep), and permitted
         * does not mean "and also create an order for it": a closed deal's order is either already there
         * or was never going to be, and minting one now rewrites `Deal.OrderID` on a row whose whole
         * purpose is to be the frozen record of what was agreed.
         *
         * A legacy closed deal therefore keeps its NULL OrderID. That is the honest outcome — SD24 gives
         * it one the moment it is legitimately reopened and saved, which is the path that is allowed to
         * change it.
         */
        if (!this._lockedAtSave) {
            this.provisionEmbeddedOrder();
        }

        /**
         * WHAT THIS STAGE CHANGE ASKS OF THE ORDER (S-US5) — resolved here, applied inside the
         * transaction.
         *
         * BESIDE `provisionEmbeddedOrder()`, not inside it. Provisioning happens once, on creation;
         * this happens on every stage change for the rest of the deal's life. Folding them together
         * would tie a rule about movement to a rule about birth.
         *
         * The READ happens before any transaction opens, for the same reason the close lock does: it is
         * one lookup, and work that might not be needed should not lengthen a critical section.
         */
        const stageOrder = this._lockedAtSave ? null : await this.planStageOrderStatus();

        /**
         * AND WHAT IT OWES THE APPEND-ONLY LOG — snapshotted here, for the same reason.
         *
         * Two features arrived at this hook within a day of each other: the stage-order writer (D-OS1)
         * and `DealStageEvent` provenance on an ordinary move (D-BD2). They key on the SAME trigger,
         * `PipelineStageID` changing, and each opened its own `BeginEntityTransaction`. Merging them as
         * two sibling scope-openers would have produced a save that took whichever branch was written
         * last and silently skipped the other — the routing line was the merge conflict, and resolving
         * it textually would have shipped exactly that bug.
         *
         * So there is one scope now, and {@link saveWithinScope} owns the ORDERING, which is the part
         * that actually matters and the part neither branch could state alone.
         */
        const stageMove = this.planStageEvent();

        /**
         * AND WHETHER THE AMOUNT CACHE COULD HAVE MOVED — a DIFFERENT trigger from the other three.
         *
         * The other three key on the stage changing. `Deal.Amount` keys on the ORDER changing, because
         * that is what it caches: a rep adding a line does not touch the stage, and an amount that only
         * refreshed on stage moves would be stale for exactly the action that changes it most.
         *
         * Drift caused by someone else — finance editing the order directly, which S-US5 explicitly
         * allows — is deliberately NOT chased here. That is what `AmountSourceHash` is for: a surface
         * holding the order can recompute the fingerprint and say "stale, reprice". Polling the order on
         * every unrelated deal save would be a read per keystroke for a guarantee the hash already gives.
         */
        const order = this.OrderID_Object;
        const amountMayHaveMoved = !!order && (order.Dirty || order.Lines.Dirty);

        // The stage's forecast defaults, on the same trigger as the three above. Read here, applied
        // inside the scope, for the same reason the others are: work that might not be needed should not
        // lengthen a critical section.
        /**
         * NEITHER STAGE WRITER RUNS ON A LOCKED DEAL. The stage cannot legitimately move on one — the
         * closing transition itself is the save where the status is still OPEN in the database, so it
         * passes the lock and reaches here with `_lockedAtSave === false`. Anything that gets here WITH
         * the flag set is a permitted edit to a frozen deal, and re-deriving its probability or re-
         * stamping its order from the closing stage would be exactly the corruption the lock exists to
         * stop.
         */
        /**
         * AND NEITHER RUNS ON A DECLARED TRANSITION. See `DeclareTransition`: a close's probability and a
         * reopen's are the caller's considered figures, already stamped onto the event, and re-deriving
         * them from the arriving stage is how a reopen came to disagree with its own provenance row.
         */
        const stageDefaults =
            this._lockedAtSave || this._declaredTransition ? null : await this.planStageDefaults();

        // Nothing to number: an existing deal, or one that already has a number. A number is only ever
        // assigned once — it appears in contracts, orders and people's email, so re-saving a deal must
        // never renumber it.
        /**
         * ── COMPUTED ONCE, BECAUSE SPLITTING IT ACROSS THE ARMS GOT IT WRONG ──────────────────
         *
         * The arms below route on NUMBERING — "has this deal already got a number" — and the status
         * default is a question about CREATION. Those are not the same question, and treating them as
         * one hard-coded the default OFF for the exact case the early-return guard was written to cover.
         *
         * A create that supplies its own `DealNumber` — an importer does precisely this — is not
         * saved, so it still needs a status; but `this.IsSaved || this.DealNumber` is truthy, so it took
         * the first arm and got `needsStatusDefault: false`. The guard term in `saveWithinScope` says in
         * its own comment that it exists so such a create "would not take the fast path and land NULL
         * again", and the caller then guaranteed it landed NULL anyway. The term and its caller
         * contradicted each other, and the importer was the case that lost.
         *
         * `!this.IsSaved` is the whole test: an update never needs a default (it either has a status or
         * the rep cleared it deliberately — SD37), and every create does unless one was supplied.
         */
        const needsStatusDefault = !this.IsSaved && !this.DealStatusTypeID;

        const saved = this.IsSaved || this.DealNumber
            ? await this.saveWithinScope(options, {
                  stageOrder, stageMove, stageDefaults, amountMayHaveMoved, assignNumber: false,
                  needsStatusDefault,
              })
            : await this.saveWithinScope(options, {
                  stageOrder, stageMove, stageDefaults, amountMayHaveMoved, assignNumber: true,
                  needsStatusDefault,
              });

        // A declaration governs ONE save. Left standing, it would suppress the stage defaults on the next
        // unrelated edit to the same in-memory record and put its note on that edit's event.
        this._declaredTransition = null;

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
     * The snapshot an ordinary stage move owes the append-only log, or null when the deal did not move.
     *
     * ── THE PERSISTED VALUES, read before the save overwrites them ──
     *
     * `OldValue` is what is on disk, which is the only thing that makes a transition detectable — the
     * same discipline the close lock uses when it asks whether the deal was ALREADY locked rather than
     * whether it is about to be.
     *
     * ── THE STAMPS COME FROM THE PRIOR VALUES, NOT THE NEW ONES ──
     *
     * That is the whole point of the table. A board drag applies the target stage's probability default,
     * so reading the current value here would record the number the deal acquired by ARRIVING rather
     * than the one it held on the way out — and every velocity report built on it would be quietly
     * wrong.
     *
     * A brand-new deal has no prior stage and owes no event: `priorStageID` is null, so it is not a
     * MOVE. It is a birth, and `DealStageEvent` is a log of movement.
     */
    private planStageEvent(): StageMoveSnapshot | null {
        /**
         * A DEAL BEING CREATED OWES NO EVENT, and `OldValue === null` is not a reliable way to ask.
         *
         * `NewDeal()` preselects a pipeline and its first stage; the rep then picks the stage they
         * actually want. That is TWO assignments before the first save, so the first becomes `OldValue`
         * and the guard below saw a "transition" from a stage the deal was never in — and wrote it into
         * an append-only log, where it cannot be corrected afterwards.
         *
         * `IsSaved` is the question that holds however many times the field was touched. `DealStageEvent`
         * is a log of MOVEMENT, and nothing has moved until there is a row to move from.
         */
        if (!this.IsSaved) {
            return null;
        }

        const priorStageID = (this.GetFieldByName('PipelineStageID')?.OldValue as string | null) ?? null;
        /**
         * COMPARED CASE-INSENSITIVELY, like every other id comparison in this class.
         *
         * `planStageOrderStatus` and `planStageDefaults` both lowercase before comparing; this one did
         * not. SQL Server hands back uppercase GUIDs and client code generates lowercase, so a caller
         * that normalised its ids — an importer, an Action, anything round-tripping through JSON — got a
         * SELF-TRANSITION recorded: an append-only row saying the deal moved from a stage to itself.
         * Three writers on one trigger and only two of them agreed on how to compare a key.
         */
        const stageMoved =
            priorStageID !== null &&
            priorStageID.toLowerCase() !== String(this.PipelineStageID ?? '').toLowerCase();

        /**
         * A DECLARED TRANSITION IS OWED AN EVENT WHETHER OR NOT THE STAGE MOVED.
         *
         * `Sales.CloseDeal` without a `ClosingStageID` changes the STATUS only, and that is still the most
         * consequential thing that ever happens to a deal. It owes a row. This is the case that made the
         * close operation hand-write its own event, and writing it here instead is what removes the second
         * row for the case where the stage DID move.
         */
        if (!stageMoved && !this._declaredTransition) {
            return null;
        }
        return {
            StageID: priorStageID,
            StatusID: (this.GetFieldByName('DealStatusTypeID')?.OldValue as string | null) ?? null,
            Amount: (this.GetFieldByName('Amount')?.OldValue as number | null) ?? null,
            AmountIsComputed:
                (this.GetFieldByName('AmountIsComputed')?.OldValue as boolean | null | undefined) ?? null,
            Probability: (this.GetFieldByName('Probability')?.OldValue as number | null) ?? null,
        };
    }

    /**
     * The ONE place a save opens a transaction, and the one place the ordering is decided.
     *
     * Four jobs share this scope, and each has a reason to be where it is:
     *
     * 1. **The deal number**, BEFORE the header is written — `DealNumber` carries a filtered UNIQUE
     *    index, and assigning it afterwards would mean a second write to a row already visible. The
     *    transaction is what keeps the counter gap-free: `spAssignNextDealNumber` increments a locked
     *    row, so a save that then fails must roll the increment back.
     * 2. **The order status**, BEFORE the header is written, because an unsaved order is INSERTED in the
     *    target status rather than created and then moved — one row, one state, no history of a status
     *    it was never really in.
     * 3. **The stage event**, AFTER, because it is provenance for a move that has actually happened.
     *    An event for a save that then failed is worse than no event: it is a claim about history.
     * 4. **The `Deal.Amount` cache**, LAST, because `OrderHeader.TotalGross` is trigger-maintained and
     *    only reflects this save's lines once they are written. Its trigger is the ORDER changing rather
     *    than the stage, which is why the caller decides separately whether it runs.
     *
     * **BOTH-OR-NEITHER, ACROSS ALL THREE.** A moved deal with no event is a hole in an append-only
     * log. A numbered deal that does not exist consumes a number nobody can account for. And a stage
     * change visible while the order it moved is not would be a worse outcome than either alone.
     *
     * `BeginEntityTransaction` JOINS an ambient transaction rather than opening a second, so a caller
     * already in one — `Sales.CloseDeal`, or an integration check — gets a savepoint and everything
     * still settles together.
     *
     * **A save with nothing to do here takes no transaction at all** (see the caller). The overwhelming
     * majority of deal saves are edits to a field nobody is watching, and wrapping those in a scope
     * would be a cost paid on every keystroke for a guarantee they do not need.
     */
    private async saveWithinScope(
        options: EntitySaveOptions | undefined,
        work: {
            stageOrder: StageOrderPlan | null;
            stageMove: StageMoveSnapshot | null;
            stageDefaults: StageDefaultsPlan | null;
            amountMayHaveMoved: boolean;
            assignNumber: boolean;
            needsStatusDefault: boolean;
        },
    ): Promise<boolean> {
        if (
            !work.assignNumber &&
            !work.stageOrder &&
            !work.stageMove &&
            !work.stageDefaults &&
            !work.amountMayHaveMoved &&
            // Without this term a create that supplied its own DealNumber and touched no stage would take
            // the fast path and land NULL again -- the exact gap this closes, through the one door left open.
            !work.needsStatusDefault
        ) {
            return super.Save(options);
        }

        const provider = this.ProviderToUse as unknown as DatabaseProviderBase;
        if (!provider?.BeginEntityTransaction) {
            throw new Error(
                'DealEntityServer.Save: the provider cannot open a transaction, so a deal number, an order ' +
                'status and a stage event cannot be written atomically. This class is server-only — it must ' +
                'run against a database provider.',
            );
        }

        const scope = await provider.BeginEntityTransaction();
        try {
            if (work.assignNumber) {
                this.DealNumber = await getNextDealNumber(
                    this.ContextCurrentUser,
                    this.ProviderToUse as unknown as IMetadataProvider,
                );
            }
            /**
             * BEFORE the order status and before the save, because these are columns on the DEAL and the
             * save is what persists them. The order-status writer talks to another app's record and the
             * stage event is appended afterwards; this one has to be in place by the time `super.Save`
             * runs or it writes nothing.
             */
            if (work.stageDefaults) {
                this.applyStageDefaults(work.stageDefaults);
            }
            /**
             * AFTER the stage defaults, and the order is load-bearing rather than tidy.
             *
             * `applyStageDefaults` decides whether to take the stage's status by asking
             * `callerSuppliedValue`, and on a CREATE that question is only "is there a value". Setting a
             * fallback first would therefore look exactly like a rep's own choice and suppress the
             * stage's legitimate opening status for good. Running last means this fills only what the
             * stage could not: a deal with no stage, or one whose stage declares a status that locks.
             */
            if (work.needsStatusDefault && !this.DealStatusTypeID) {
                this.DealStatusTypeID = await this.defaultOpeningStatusID();
            }
            if (work.stageOrder) {
                await this.applyStageOrderStatus(work.stageOrder);
            }

            const saved = await super.Save(options);
            if (!saved) {
                await scope.Rollback();
                /**
                 * ── THE NUMBER GOES BACK TOO, OR THE DEAL BECOMES UNSAVEABLE ────────────────────────
                 *
                 * `DealNumber` was drawn from the sequence INSIDE this scope. The rollback returns the
                 * counter, but the value stayed on the in-memory record — and `Save()` decides whether to
                 * draw one by asking `this.IsSaved || this.DealNumber`. So the retry took the
                 * `assignNumber: false` branch and re-inserted a number the sequence had already
                 * re-issued to somebody else.
                 *
                 * The deal was then unsaveable for the life of the tab, and the error named a unique index
                 * on DealNumber rather than whatever had actually failed the first time — so the rep saw a
                 * duplicate-key message about a field they had never touched.
                 *
                 * Cleared only when THIS scope drew it: a retry of an already-numbered deal must keep its
                 * number, because that number is in contracts, orders and people's email.
                 */
                if (work.assignNumber) {
                    this.DealNumber = null;
                }
                return false;
            }

            if (work.stageMove) {
                await this.appendStageEvent(work.stageMove);
            }

            // LAST, because it reads a total the trigger only produced a moment ago. See the method.
            if (work.amountMayHaveMoved || work.assignNumber) {
                await this.refreshAmountFromOrder();
            }

            await scope.Commit();
            return true;
        } catch (err) {
            LogError(`DealEntityServer.saveWithinScope failed for deal ${this.ID}: ${err}`);
            try {
                await scope.Rollback();
            } catch (rollbackErr) {
                LogError(`Failed to roll back after a failed deal save: ${rollbackErr}`);
            }
            /**
             * ── THE SAME COMPENSATION AS THE `!saved` BRANCH, AND FOR THE SAME REASON ──────────────
             *
             * The branch above documents this exactly and then only half of the exits performed it. A
             * `return false` from the save cleared the number; a THROW did not, and the rollback still
             * returned the counter — so the value stayed on the in-memory record, `Save()` asked
             * `this.IsSaved || this.DealNumber`, found it truthy, took the `assignNumber: false` arm and
             * re-inserted a number the sequence had already re-issued. Duplicate key, deal unsaveable for
             * the life of the tab, and an error naming a field the rep never touched. Precisely the
             * failure the comment above says was fixed.
             *
             * THE THROWING PATHS ARE REAL, not hypothetical. `getNextDealNumber()` runs inside this
             * scope, and at least three later statements throw rather than return false:
             * `defaultOpeningStatusID()`'s RunView, `applyStageOrderStatus()` whose
             * `BeginEntityTransaction` sits outside its own try/catch, and the post-save
             * `appendStageEvent()`. Any of them lands here.
             *
             * Guarded by `work.assignNumber` for the reason the other branch gives: a retry of an
             * ALREADY-numbered deal must keep its number, because that number is in contracts, orders
             * and people's email. Only the scope that drew one may give it back.
             */
            if (work.assignNumber) {
                this.DealNumber = null;
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
    private async appendStageEvent(prior: StageMoveSnapshot): Promise<void> {
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
        /**
         * ── AND WHOSE NUMBER IT WAS, STAMPED BESIDE IT ──────────────────────────────────────────────
         *
         * Finance reads close amounts out of this table and could not classify them. The amount was
         * stamped; its provenance was not — and the flag that carries it, `Deal.AmountIsComputed`, is on a
         * row that keeps changing. So a deal repriced after its close made its own close amount
         * unclassifiable, and there was no way to tell an engine-priced booking from a typed one after the
         * fact.
         *
         * `Set` rather than a typed property: the column is registered as an `EntityField` by an additive
         * migration, and the generated entity subclass does not carry it until CodeGen next runs — which
         * cannot be run against this database (see that migration's header for why). The field exists in
         * metadata, so this writes through the same path every other field does.
         *
         * NOT BACKFILLABLE, which is the whole argument for adding it now: every row already written has
         * NULL here and always will, because the answer for those transitions is genuinely unknown. Its
         * value starts today.
         */
        event.Set('AmountAtTransitionIsComputed', prior.AmountIsComputed);
        event.ProbabilityAtTransition = prior.Probability;
        // A declared transition's reason — the close's routing note, the reopen's justification. An
        // ordinary stage move carries none, which is why this is null far more often than not.
        event.Notes = this._declaredTransition?.Note ?? null;

        if (!(await event.Save())) {
            // THROWN, not returned: the caller's scope must roll the deal move back with it.
            throw new Error(
                `the stage event could not be written: ${event.LatestResult?.CompleteMessage ?? 'unknown error'}`,
            );
        }

        // Read back by `Sales.CloseDeal` / `Sales.ReopenDeal` for their `DealStageEventID` result. They
        // used to have it because they wrote the row; this is what replaces that.
        this._lastStageEventID = event.ID;
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
     * ── WHY THE GUARD IS `IsSaved`, AND NOT `IsSaved || OrderID` ──
     *
     * It was the second form, and that was a real bug rather than a stylistic choice. `Ensure()` assigns
     * the new peer's key to `OrderID` immediately, so a caller that reached the order BEFORE saving --
     * the workspace's `AddLine()`, an importer building a deal and its lines for one `Save()`, or any of
     * the line checks in `save-deal` -- arrived here with `OrderID` already populated. The guard then
     * returned early, the stamps below never ran, and the save died inside orders on
     * `CompanyID cannot be null`: a NOT NULL complaint about a column two apps away from the mistake.
     *
     * Idempotent twice over all the same: `Ensure()` returns any existing peer, `IsSaved` means a re-save
     * never re-provisions, and an order that is ALREADY PERSISTED is left untouched (below) so attaching
     * an existing order stays a legitimate thing to do.
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
        /**
         * ── THE TEST IS "HAS A REAL ORDER", NOT "IS A NEW DEAL" ──
         *
         * This used to return early on `IsSaved`, which meant provisioning could only ever happen on a
         * deal's FIRST save. Every deal that already existed without an order was therefore unable to
         * acquire one — for good: every SQL-seeded demo deal, and every deal created before S-US4
         * landed. Reaching for `OrderID_EnsureObject()` on one of those built an UNSTAMPED order and the
         * save died inside orders on `CompanyID cannot be null`, two apps away from the cause. Found by
         * `scripts/seed-demo-lines.mjs` failing on four of five deals.
         *
         * Asking about the ORDER instead covers both: a deal with a persisted order is left alone (the
         * S-US5 rule — finance may already have worked on it), and a deal without one gets one whenever
         * it is next saved, however old it is. The check is on `IsSaved` OF THE ORDER and not on
         * `this.OrderID`, because `Ensure()` assigns the new peer's key immediately — which is the DN-7
         * trap, and testing the FK here would walk straight back into it.
         */
        if (this.OrderID_Object?.IsSaved) {
            return;
        }
        if (!this.CompanyID) {
            // The pipeline stamp resolved no company, so an order cannot be inserted. Say nothing and
            // let the deal's own validation report the missing pipeline -- failing later inside orders
            // would name a column instead of the actual mistake.
            return;
        }

        const order = this.OrderID_EnsureObject();
        this._orderJustProvisioned = true;
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

    /* ── The stage → order status writer (S-US5 / S-US7 / S-US8, D-OS1) ─────── */

    /**
     * Warnings from the last `Save()` about what did NOT happen to the order, and why.
     *
     * A channel rather than a thrown error, because that is the whole ruling: *"The Deal stage is the
     * salesperson's record of the sales process; it should never be held hostage by order-side rules"*
     * (Andrew, D-OS1). So a refused order update is not a failure of the save — it is a fact about the
     * save, and something has to be able to say it out loud.
     *
     * `Sales.ReopenDeal` and `Sales.CloseDeal` copy these into their `Issues` with
     * `Severity: 'warning'`, which is how a caller sees them. A plain `deal.Save()` from the board's
     * drag leaves them here and in the server log; see `DECISIONS-NEEDED.md` DN-12, because a warning
     * only a server log carries is one a rep never reads.
     */
    private readonly _orderStatusWarnings: string[] = [];

    public get OrderStatusWarnings(): readonly string[] {
        return this._orderStatusWarnings;
    }

    /**
     * Resolves what this save's stage change asks of the order. Reads only; opens nothing.
     *
     * ── WHAT COUNTS AS "CHANGING STAGE" ──
     *
     * `OldValue` versus the current value, the same mechanism {@link checkCloseLock} keys on. A save
     * that does not touch `PipelineStageID` plans nothing, so an ordinary edit — a rename, a nudge to
     * `NextStep` — never reaches the order. That matters more than it looks: an order that got
     * re-Quoted on every save of its deal would be a write amplification nobody asked for, and on a
     * Confirmed order it would be a refusal warning on every single save.
     *
     * A BRAND-NEW deal also counts as entering its first stage. `CanTransition` treats a null `from` as
     * "may be created in any legal state", so a new deal on a stage naming `Quoted` gets an order
     * created Quoted rather than created Draft and then moved — one row, one state, no history of a
     * status it was never really in.
     */
    /**
     * What the stage says this deal's probability and forecast category become — read BEFORE the
     * transaction, like every other plan in this class.
     *
     * ── WHY THIS IS ON THE WRITE PATH AND NOT IN THE WORKSPACE ──────────────────────────────────
     *
     * It was in the workspace: `DealWorkspaceComponent.ApplyStageDefaults`, called from the stage picker.
     * So a stage set by an agent, by the S6 HubSpot importer, by an Action or by any API caller got
     * NEITHER value — the deal landed with whatever probability the caller happened to supply, or null,
     * while the pipeline designer's answer sat unused in the stage row. Exactly the shape of the order
     * provisioning that used to live in the workspace and now lives in `Save()`: a rule the UI enforces
     * is a rule only the UI obeys.
     *
     * ── SAME TRIGGER AS THE OTHER THREE, DELIBERATELY A SEPARATE READ ───────────────────────────
     *
     * Keyed on `PipelineStageID` changing, like the order-status writer and the stage event. It reads the
     * stage row a second time rather than widening `planStageOrderStatus`, and that is a considered
     * trade: one extra read on a stage change — a rare event — against touching a method whose exact
     * behaviour is pinned by `close-won-order.CO3`, `CO5` and three mutants. Cheap insurance beats a
     * clever saving here.
     *
     * ── IT DOES NOT FIRE ON PROVISIONING, unlike the order-status writer ────────────────────────
     *
     * `planStageOrderStatus` also runs when an existing deal acquires an order (`_orderJustProvisioned`,
     * SD25), because an order that has just come into existence has never been told anything. These
     * fields are different: the deal has held them all along, and re-applying a stage default to a deal
     * whose stage did not move would overwrite a number a rep tuned by hand.
     */
    private async planStageDefaults(): Promise<StageDefaultsPlan | null> {
        const stageID = this.PipelineStageID;
        if (!stageID) {
            return null;
        }
        if (this.IsSaved) {
            const previous = this.GetFieldByName('PipelineStageID')?.OldValue as string | null | undefined;
            if (previous && String(previous).toLowerCase() === String(stageID).toLowerCase()) {
                return null;   // the stage did not move; these fields are not this save's business
            }
        }

        const view = this.ProviderToUse as unknown as IRunViewProvider;
        const result = await view.RunView<{
            Probability: number | null;
            ForecastCategoryTypeID: string | null;
            DealStatusTypeID: string | null;
        }>(
            {
                EntityName: STAGE_ENTITY,
                ExtraFilter: `ID = '${stageID}'`,
                ResultType: 'simple',
                Fields: ['Probability', 'ForecastCategoryTypeID', 'DealStatusTypeID'],
            },
            this.ContextCurrentUser,
        );
        if (!result.Success) {
            // Not fatal, for the same reason the order-status read is not: a stage lookup that fails must
            // not stop a rep moving a card. Recorded as a warning like anything else that did not happen.
            this._orderStatusWarnings.push(
                `Stage defaults were not applied: the stage could not be read ` +
                `(${result.ErrorMessage ?? 'unknown error'}).`,
            );
            return null;
        }

        const row = (result.Results ?? [])[0];
        if (!row) {
            return null;
        }

        /**
         * ── A STAGE MAY NAME THE STATUS A DEAL SITS IN. IT MAY NOT CLOSE ONE ────────────────────────
         *
         * Deriving the status from the stage without this gate broke the rule this app exists to uphold.
         * The seeded pipelines declare a LOCKING status on their winning and losing stages — "Signed" ->
         * Won, "Lost" -> Lost — so an ordinary save that moved a deal into one of those stages CLOSED IT
         * BY SIDE EFFECT: locked, `IsWon` set, no `DealStageEvent` naming a close, no routing evaluated,
         * no contract, no tasks, and `Sales.CloseDeal` never invoked. A board drag would have booked
         * revenue.
         *
         * That is precisely what the master plan forbids: stages carry no `IsWon`/`IsClosed` of their own
         * and point at a status that does, so that "Closed Won" is a LABEL — and closing stays an explicit
         * act even when the stage a deal enters is the one a pipeline calls Signed.
         *
         * Found by `71-lost-and-reopen`, which moves a deal into the losing stage with a plain save before
         * closing it through the panel: the deal arrived at the close already locked, so the close could
         * not stamp its loss reason. A green integration suite did not see it — no check moved a deal into
         * a closing stage, because until now nothing about a stage could close one. `SD35` does now.
         *
         * The gate reads `LocksDeal` off the status row, never a name (§3). A stage whose status locks
         * contributes nothing here; the deal keeps whatever status it had and only `Sales.CloseDeal` can
         * change that.
         */
        const stageStatusID = row.DealStatusTypeID ?? null;
        let derivableStatusID: string | null = null;
        if (stageStatusID) {
            const status = await view.RunView<{ LocksDeal: boolean }>(
                {
                    EntityName: DEAL_STATUS_ENTITY,
                    ExtraFilter: `ID = '${stageStatusID}'`,
                    ResultType: 'simple',
                    Fields: ['LocksDeal'],
                },
                this.ContextCurrentUser,
            );
            const flags = (status.Results ?? [])[0];
            // Unreadable is treated as "do not derive". Failing closed here costs a rep one dropdown; the
            // other direction closes deals nobody asked to close.
            if (status.Success && flags && flags.LocksDeal !== true) {
                derivableStatusID = stageStatusID;
            }
        }

        return {
            Probability: row.Probability ?? null,
            ForecastCategoryTypeID: row.ForecastCategoryTypeID ?? null,
            DealStatusTypeID: derivableStatusID,
        };
    }

    /**
     * Fills the forecast fields from the stage, WITHOUT overwriting a value this save set deliberately.
     *
     * ── THE RULE IS THE AMOUNT CACHE'S RULE ─────────────────────────────────────────────────────
     *
     * `Deal.Amount` distinguishes a computed figure from a stated one and never overwrites the stated
     * one (SD22). The same distinction applies here and is read the same way: a field the caller TOUCHED
     * in this save is theirs, and a field they did not touch is the stage's to fill.
     *
     * `Dirty` is what expresses that. It is true only when this save changed the value, so:
     *
     *   · A rep dragging a card sets no probability -> not dirty -> the stage's number lands.
     *   · A rep who moves the stage AND types 85 -> dirty -> 85 stands, which is the point of the
     *     workspace comment promising both stay editable.
     *   · THERE IS NO UI COPY ANY MORE. The claim that stood here — that the workspace's own
     *     `ApplyStageDefaults` set both fields before saving, so they arrived dirty and were respected,
     *     so "the UI copy and this one cannot fight" — was WRONG, in the damaging direction. Arriving
     *     dirty is precisely what made this method respect a number the UI had ALREADY overwritten.
     *     Two copies did it, the workspace's and the board's, and BD6 stayed green because it drives the
     *     entity layer and never touches either. Both are deleted; this is the only writer.
     *   · An importer that supplies a historical probability keeps it; one that supplies none inherits
     *     the pipeline's design instead of landing on null.
     */
    /**
     * Did the CALLER put this value here in this save, or is it mine to fill?
     *
     * ── TWO OF MJ'S SEMANTICS BITE ON CREATE, AND THE ANSWER DIFFERS BECAUSE OF THEM ─────────────
     *
     * On an UPDATE, `Dirty` is exactly the question: it is true when this save changed the value.
     *
     * On a CREATE it is useless. A first assignment does not mark a field dirty, and the first write
     * BECOMES the `OldValue` — so `Dirty` is false for a value the caller definitely supplied, and
     * `OldValue` is a value that was never on disk. Asking `Dirty` on a new record therefore says "not
     * theirs" about everything the caller just set.
     *
     * `applyStageDefaults` already knew this and guarded with `creating = !this.IsSaved`. Two other
     * places did not, and both were wrong in the same direction:
     *
     *   · `planStageEvent` inferred a birth from `OldValue === null`. But a new deal whose stage is set
     *     TWICE before the first save — `NewDeal()` preselects a pipeline and its first stage, the rep
     *     then picks a different one — has a non-null `OldValue` holding a stage the deal was NEVER IN.
     *     It appended a transition event for it, into an append-only log. `BD1` asserts against exactly
     *     that and passes only because it assigns the stage once.
     *   · `ownerStampEditRefusal` asked `Dirty`, so an importer doing `NewRecord()` ->
     *     `OwnerEmployeeID = X` -> `Save()` slipped straight through the refusal and created a deal whose
     *     owner column and owner-role roster name different people — the state SD26 exists to forbid.
     *
     * So the question lives here now, once, and the callers ask it rather than each re-deriving it.
     */
    private callerSuppliedValue(fieldName: string, current: unknown): boolean {
        if (!this.IsSaved) {
            return current !== null && current !== undefined && current !== '';
        }
        return !!this.GetFieldByName(fieldName)?.Dirty;
    }

    private applyStageDefaults(plan: StageDefaultsPlan): void {
        /**
         * ── TWO DIFFERENT TESTS, BECAUSE `Dirty` DOES NOT MEAN THE SAME THING ON A NEW RECORD ───────
         *
         * The first version used `Dirty` for both cases and `board-move.BD2` caught it immediately: a
         * deal CREATED with probability 30 had it silently replaced by its stage's 10, because on a new
         * record a field the caller assigned is not reported dirty. The stage event then stamped 10 as
         * the departure value and BD2 said so — expected 30, got 10. Exactly the check doing its job.
         *
         * So the question is asked the way it actually differs:
         *
         *   CREATING  — respect any value the caller supplied, fill only what they left empty. `Dirty` is
         *               not usable here, and "is it null" is precisely the intent anyway.
         *   MOVING    — respect a value set in THIS save, otherwise take the stage's. This is the case the
         *               feature exists for: dragging a card should move the probability with it, and
         *               `Dirty` is exactly "the caller touched it this time".
         */
        // The create-versus-update distinction now lives in `callerSuppliedValue`. It was written out
        // twice here first, which is how two other places came to get it wrong independently.
        if (!this.callerSuppliedValue('Probability', this.Probability)) {
            this.Probability = plan.Probability;
        }
        if (!this.callerSuppliedValue('ForecastCategoryTypeID', this.ForecastCategoryTypeID)) {
            this.ForecastCategoryTypeID = plan.ForecastCategoryTypeID;
        }

        /**
         * ── THE STATUS COMES FROM THE STAGE, AND A DEAL WITH NO STATUS IS INVISIBLE ──────────────────
         *
         * `DealWorkspaceService.NewDeal()` is `NewRecord()` and nothing else, and `DealStatusTypeID` is
         * nullable with no column default. So a rep who never touched the Status select saved a deal that
         * every `IsOpen`/`IsWon` rollup skipped — and while the roster and summary queries still INNER
         * JOINed that FK, such a deal was invisible to every surface in the app. It was also what made
         * `71-lost-and-reopen` fail on a JOIN rather than on its subject.
         *
         * The answer was already three-quarters built. `PipelineStage.DealStatusTypeID` is seeded on every
         * stage, `StageRow` loads it, and `deal-board.component.ts` derives `IsClosing` from it — reading
         * it as the source of truth. All that was missing was the write path agreeing.
         *
         * ── WHAT THE `callerSuppliedValue` GUARD BUYS, AND ONE THING IT DOES NOT ─────────────────────
         *
         * A status the caller supplied IN THIS SAVE wins: it arrives dirty (or, on a create, simply
         * present), so a rep who picked one keeps it. That is the same rule probability and forecast
         * category follow, and it is why this belongs here rather than in a fourth writer.
         *
         * What it does NOT do is protect a status set in an EARLIER save from a later stage move. `Dirty`
         * is per-save, so dragging a card re-derives the status from the arriving stage exactly as it
         * re-derives the probability. For probability that is the designed behaviour; for status it is
         * worth knowing, and it is reported rather than special-cased — every stage is seeded with an OPEN
         * status today, so the observable effect is nil until somebody seeds two different open statuses
         * across one pipeline's stages.
         *
         * ── AND THE CLOSE IS NOT AFFECTED, STRUCTURALLY RATHER THAN BY LUCK ──────────────────────────
         *
         * `Sales.CloseDeal` sets the closing status and may move the stage with it. It does not race this
         * writer: a DECLARED TRANSITION suppresses stage defaults entirely (see `DeclareTransition`), so
         * `planStageDefaults()` is never even called on a close or reopen. The closing status wins because
         * this code does not run, not because dirty-tracking happened to favour it.
         */
        if (!this.callerSuppliedValue('DealStatusTypeID', this.DealStatusTypeID)) {
            // Only when the stage actually declares one. A stage with no status must not blank a deal's.
            if (plan.DealStatusTypeID) {
                this.DealStatusTypeID = plan.DealStatusTypeID;
            }
        }
    }

    /**
     * The status a BRAND-NEW deal starts in when nothing else supplied one.
     *
     * ── WHY A DEAL WITH NO STATUS IS WORSE THAN A DEAL WITH A WRONG ONE ──────────────────────────────
     *
     * `Deal.DealStatusTypeID` is nullable with no column default, and until now nothing in the write path
     * required it. A deal saved without touching Status landed NULL, and every measure that reads the
     * status through `JOIN DealStatusType` silently did not count it — a tile that under-reports rather
     * than one that errors. It also cost a misdiagnosis: `71-lost-and-reopen` failed with
     * `Cannot read properties of undefined (reading 'IsLost')`, which reads as a bad field and was the
     * JOIN dropping the row.
     *
     * ── NEVER DERIVED FROM THE STAGE, AND THE NUMBERS SAY WHY ────────────────────────────────────
     *
     * The obvious-looking fix — take the stage's status — closes deals by side effect. Measured on this
     * host: `Booked` → Won, `Signed` → Won and `Lost` → Lost all carry `LocksDeal = 1`. A deal created
     * in one of those stages would be born closed and locked, and a board drag would book revenue. That
     * is why {@link planStageDefaults} gates its own stage-derived status on `LocksDeal`, and why this
     * fallback asks the VOCABULARY what an opening status is instead of asking the stage.
     *
     * ── THE THIRD CONDITION IS NOT REDUNDANT ────────────────────────────────────────────────────
     *
     * `IsActive = 1 AND IsOpen = 1 AND LocksDeal = 0`. Today every `IsOpen = 1` row also has
     * `LocksDeal = 0`, so the third term selects nothing extra — but that is a property of the seeded
     * data, not an invariant the schema enforces. Nothing stops a tenant declaring an open status that
     * also locks, and since the entire hazard here is closing a deal by side effect, the guard says so
     * rather than relying on the coincidence holding.
     *
     * `DisplayRank` makes the choice deterministic when a tenant defines several opening statuses.
     *
     * ── AND IT LEAVES NULL RATHER THAN REFUSING ──────────────────────────────────────────────────
     *
     * If no active, open, non-locking status exists the vocabulary is misconfigured — but refusing the
     * save would block ALL deal creation on that tenant, which is a worse failure than the gap being
     * closed. Returning null preserves exactly today's behaviour for that case and nothing more.
     */
    private async defaultOpeningStatusID(): Promise<string | null> {
        const view = this.ProviderToUse as unknown as IRunViewProvider;
        const result = await view.RunView<{ ID: string }>(
            {
                EntityName: DEAL_STATUS_ENTITY,
                ExtraFilter: 'IsActive = 1 AND IsOpen = 1 AND LocksDeal = 0',
                OrderBy: 'DisplayRank ASC',
                ResultType: 'simple',
                Fields: ['ID'],
            },
            this.ContextCurrentUser,
        );
        if (!result.Success) {
            // Unreadable vocabulary is treated as "no default", for the same reason the stage gate fails
            // closed: a missing status costs a rollup one row, a guessed one corrupts the pipeline.
            return null;
        }
        return (result.Results ?? [])[0]?.ID ?? null;
    }

    private async planStageOrderStatus(): Promise<StageOrderPlan | null> {
        const stageID = this.PipelineStageID;
        if (!stageID) {
            return null;
        }
        if (this.IsSaved && !this._orderJustProvisioned) {
            const previous = this.GetFieldByName('PipelineStageID')?.OldValue as string | null | undefined;
            if (previous && String(previous).toLowerCase() === String(stageID).toLowerCase()) {
                return null;   // the stage did not move; the order is not this save's business
            }
        }

        /**
         * `_orderJustProvisioned` is what lets a BIRTH ask the question a MOVE asks.
         *
         * An order that has just been created has never been told anything about the deal's stage, so
         * the stage gets to speak once — even though nothing moved. Without this, an existing deal
         * sitting at a stage that declares `Quoted` acquired an order in `Draft` and stayed there until
         * somebody happened to drag the card, which is a state the board displays without complaint.
         *
         * It cannot loop: the flag is set only by `OrderID_EnsureObject()` inside
         * `provisionEmbeddedOrder()`, and cleared at the top of every `Save()`.
         */

        const view = this.ProviderToUse as unknown as IRunViewProvider;
        const result = await view.RunView<StageOrderStatusRow>(
            {
                EntityName: STAGE_ENTITY,
                ExtraFilter: `ID = '${stageID}'`,
                ResultType: 'simple',
                Fields: ['OrderStatusOnEntry'],
            },
            this.ContextCurrentUser,
        );
        if (!result.Success) {
            // Not fatal, and deliberately so: a stage lookup that fails must not stop a rep moving a
            // card. It is recorded as a warning like any other thing that did not happen.
            this._orderStatusWarnings.push(
                `The order was not updated: the stage's OrderStatusOnEntry could not be read ` +
                `(${result.ErrorMessage ?? 'unknown error'}).`,
            );
            return null;
        }

        const target = (result.Results ?? [])[0]?.OrderStatusOnEntry;
        if (!target) {
            return null;   // this stage says nothing about the order. The common case.
        }
        return { StageID: stageID, Target: target as OrderStatus };
    }

    /**
     * Applies the plan to the deal's order, and NEVER lets a refusal reach the caller as a failure.
     *
     * ── WHY THE TRANSITION IS CHECKED BEFORE IT IS ATTEMPTED ──
     *
     * `CanTransition` is orders' own table of legal moves. Asking it first means the ordinary refusal —
     * `Voided → Quoted` on a reopened lost deal, which S-US8 says WILL happen — costs no write and
     * produces orders' own explanation. Attempting the save and reading the failure would also work,
     * but it would leave the in-memory order holding a status the database refused, and that object is
     * a participant in this deal's save graph.
     *
     * ── WHY THE SAVE STILL RUNS IN ITS OWN SCOPE ──
     *
     * A legal transition can still fail for reasons this app does not model — confirming books journal
     * entries and needs a payer. `BeginEntityTransaction` joins the ambient transaction as a savepoint,
     * so rolling this one back undoes the order write and leaves the deal's own transaction intact.
     * Without that, one order-side failure would take the stage change down with it, which is exactly
     * what D-OS1 forbids.
     *
     * ── THE UNSAVED ORDER ──
     *
     * A new deal's order has not been written yet, so there is nothing to transition and nothing to
     * roll back: setting `Status` means it is INSERTED in that state by the graph a moment later.
     */
    private async applyStageOrderStatus(plan: StageOrderPlan): Promise<void> {
        const order = this.OrderID_Object;
        if (!order) {
            // No order to update. Not a refusal and not worth a warning: a deal without one predates
            // the embedded order, and provisioning is what fixes that, not this.
            return;
        }

        if (!order.IsSaved) {
            order.Status = plan.Target;
            return;
        }

        const from = order.Status;
        if (from === plan.Target) {
            return;   // already there; a no-op write would only dirty the row
        }

        const verdict = CanTransition(from, plan.Target);
        if (!verdict.Allowed) {
            this._orderStatusWarnings.push(
                `The deal moved stage, but its order stayed ${from}: ${verdict.Reason ?? 'orders refused the move.'} ` +
                `The stage change was kept — a sales stage is not held hostage by an order-side rule.`,
            );
            LogError(
                `DealEntityServer: stage ${plan.StageID} asked for order status '${plan.Target}' on order ` +
                `${order.ID} (currently '${from}') and orders refused it: ${verdict.Reason ?? 'no reason given'}. ` +
                'The deal\'s stage change proceeds (D-OS1).',
            );
            return;
        }

        const provider = this.ProviderToUse as unknown as DatabaseProviderBase;
        const scope = await provider.BeginEntityTransaction();
        try {
            order.Status = plan.Target;
            if (await order.Save()) {
                await scope.Commit();
                return;
            }
            throw new Error(order.LatestResult?.CompleteMessage ?? 'the order save was refused with no message');
        } catch (err) {
            try {
                await scope.Rollback();
            } catch (rollbackErr) {
                LogError(`DealEntityServer: rolling back the order status update failed: ${rollbackErr}`);
            }
            // Put the in-memory value back, or the deal's save graph will try to write the status the
            // database has just refused and take the whole save down with it.
            order.Status = from;
            this._orderStatusWarnings.push(
                `The deal moved stage, but its order stayed ${from}: the move to ${plan.Target} was legal ` +
                `but did not complete (${err instanceof Error ? err.message : String(err)}). The stage change was kept.`,
            );
            LogError(`DealEntityServer: the order status update to '${plan.Target}' failed: ${err}`);
        }
    }


    /**
     * Re-establishes `Deal.Amount` from the order, as a CACHE with honest provenance.
     *
     * ── WHAT BROKE, AND WHY IT WAS INVISIBLE ──
     *
     * `Amount` was a cached `Orders.PreviewOrder` answer and `AmountSourceHash` fingerprinted the
     * `DealLine` set it came from. `DealLine` is retired, so the fingerprint describes a table that does
     * not exist and NOTHING repopulated the number. It did not go blank — it kept whatever it last held,
     * which is the failure mode that survives review: a dashboard and a board reporting a pipeline
     * figure with no relationship to the order underneath it.
     *
     * ── WHY `OrderHeader.TotalGross` AND NOT A SUM HERE ──
     *
     * Rule 1. Orders maintains `TotalGross` with its own rollup trigger (their D41 —
     * trigger-maintained, deliberately not a computed column), so this reads ONE number that orders
     * already stands behind. There is no multiplication, no addition and no rounding in this method, and
     * there must never be: the moment sales sums `LineTotalGross` itself, the quote and the invoice can
     * disagree.
     *
     * ── WHY IT IS CACHED ONTO THE DEAL ──
     *
     * The roster and the board read `Deal.Amount` as a column. Reading through the embedded order per
     * row would turn one roster query into one-plus-N, on the hottest read in the app. Same argument as
     * `OwnerEmployeeID`: a denormalised stamp exists so a list does not need a join.
     *
     * ── WHY IT RUNS LAST, INSIDE THE SCOPE ──
     *
     * `TotalGross` is trigger-maintained, so the value only reflects this save's lines AFTER
     * `super.Save()` has written them. Reading earlier caches the PREVIOUS line set — the exact staleness
     * this method exists to end. It writes with a targeted `UPDATE` rather than a second `Save()`: the
     * row is already written in this transaction, and re-entering `Save()` would re-run the close lock,
     * the stamps and the stage-event planner for a three-column cache refresh.
     *
     * ── THE PROVENANCE RULE, WHICH IS THE PART TO GET RIGHT ──
     *
     * `AmountIsComputed = 0` means a human typed this figure and is owed no explanation (L-2, the SIMPLE
     * deal). Such an amount is NEVER overwritten. But the column defaults to 0, so "0" alone cannot mean
     * hand-typed — a brand-new deal has never been touched by anyone. The distinction is whether an
     * amount is actually THERE:
     *
     *   | `AmountIsComputed` | `Amount` | what it means | what happens |
     *   |---|---|---|---|
     *   | 1 | anything | a cache | refreshed |
     *   | 0 | NULL | nobody has said | filled, and marked computed |
     *   | 0 | a number | **a human typed it** | **left alone, always** |
     *
     * And a `TotalGross` of NULL means the order has no priced lines, so there is no answer to cache —
     * that leaves the amount alone too, rather than writing a zero that would read as "priced at nil".
     */
    private async refreshAmountFromOrder(): Promise<void> {
        if (!this.OrderID) {
            return;
        }
        // A hand-typed figure. Not ours, ever.
        if (this.AmountIsComputed === false && this.Amount !== null && this.Amount !== undefined) {
            return;
        }

        const view = this.ProviderToUse as unknown as IRunViewProvider;
        const result = await view.RunView<OrderTotalRow>(
            {
                EntityName: ORDER_HEADER_ENTITY,
                ExtraFilter: `ID = '${this.OrderID}'`,
                ResultType: 'simple',
                Fields: ['TotalGross'],
            },
            this.ContextCurrentUser,
        );
        if (!result.Success) {
            // Not fatal: a stale amount is worse than a missing refresh, but neither is worth failing a
            // save the rep asked for. Recorded where the order warnings go, because that is what it is.
            this._orderStatusWarnings.push(
                `The deal saved, but its amount could not be refreshed from the order ` +
                `(${result.ErrorMessage ?? 'unknown error'}), so it may be stale.`,
            );
            return;
        }

        /**
         * A FINITE NUMBER OR NOTHING — and the `Number.isFinite` is not defensive padding.
         *
         * `RunView` returns a clean `null` for a NULL decimal when the row is already committed, so a
         * `=== null` test looks sufficient. It is not: reading a row this transaction has only just
         * INSERTED went through a different path and produced a value that was neither `null` nor
         * `undefined` and that `mssql` then bound as NULL — so the cache wrote `Amount = NULL` while
         * stamping `AmountIsComputed = 1` and a source hash. A deal claiming a computed amount of
         * nothing, which is worse than either honest answer. SD23 is the check that found it.
         *
         * So the rule is the one a money cache should have had from the start: cache a finite number, or
         * do not touch the columns.
         */
        const raw = (result.Results ?? [])[0]?.TotalGross;
        const total = raw === null || raw === undefined ? null : Number(raw);
        if (total === null || !Number.isFinite(total)) {
            return;   // no usable answer — see the note above; this still guards the mid-transaction read
        }

        /**
         * ── "NO PRICED LINES" IS NOT REACHABLE ON THIS SCHEMA, AND THE COMMENT ABOVE OVERCLAIMED ───────
         *
         * A review flagged that the guard above cannot cover "no priced lines", on the grounds that
         * orders' rollup is `SUM(ISNULL(l.LineTotal, 0))` and so returns 0 rather than NULL. Measured
         * against the live schema, that case cannot arise:
         *
         *   · `OrderLine.UnitPrice` is **NOT NULL**, so a line cannot exist unpriced. Zero rows carry a
         *     null total today, and none can.
         *   · `OrderHeader.TotalGross` is **NULL** for an order with no lines — `SUM` over no rows is
         *     NULL regardless of any inner `ISNULL` — so the `total === null` guard above already fires,
         *     correctly, for the empty-order case.
         *
         * A guard was written here for the 0-with-lines case and then removed rather than shipped: it was
         * dead code for a state the schema forbids, and dead code in a money path is worse than none
         * because the next reader trusts it. If `UnitPrice` ever becomes nullable this becomes reachable,
         * and the guard to add then is "is any line priced", not "are there lines".
         *
         * `save-deal.SD28` pins the empty-order behaviour from a NULL starting amount, which is the case
         * SD23 does not reach.
         */

        /**
         * The fingerprint, so a surface can say "stale, reprice" instead of showing an untraceable
         * number. It covers the ORDER and the TOTAL, which is exactly what the cache was derived from —
         * a reader holding the order can recompute this and compare without a second table.
         */
        const hash = createHash('sha256').update(`${this.OrderID}|${total}`).digest('hex');
        if (Number(this.Amount) === Number(total) && this.AmountSourceHash === hash && this.AmountIsComputed) {
            return;   // already current; a no-op write would only churn the row
        }

        const now = new Date();
        const sql = this.ProviderToUse as unknown as {
            ExecuteSQL: (
                sql: string,
                params: Record<string, unknown>,
                options: { isMutation: boolean; description: string },
                user: unknown,
            ) => Promise<unknown>;
        };
        await sql.ExecuteSQL(
            `UPDATE ${SALES_SCHEMA}.Deal
                SET Amount = @amount, AmountIsComputed = 1, AmountComputedAt = @at, AmountSourceHash = @hash
              WHERE ID = @id`,
            { amount: total, at: now, hash, id: this.ID },
            { isMutation: true, description: 'DealEntityServer: refresh Deal.Amount from OrderHeader.TotalGross' },
            this.ContextCurrentUser,
        );

        // The in-memory record follows, so a caller reading the entity back after `Save()` sees the
        // cache it just wrote rather than the value it came in with.
        this.Amount = total;
        this.AmountIsComputed = true;
        this.AmountComputedAt = now;
        this.AmountSourceHash = hash;
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
     * True when THIS save built the deal's order, rather than finding one already there.
     *
     * It exists so the stage's `OrderStatusOnEntry` can be applied to an order that has just come into
     * existence. The status writer otherwise keys on `PipelineStageID` CHANGING, which is right for a
     * move and wrong for a birth: a deal that is already at Proposal when its order is provisioned
     * never moved, so nothing asked the stage what the order should be, and the order stayed Draft
     * while its stage plainly declared Quoted. Found by the story audit against seeded data
     * (`DEAL-9003`), and it would have hit every deal the HubSpot import lands past Proposal.
     */
    private _orderJustProvisioned = false;

    /**
     * Whether the PERSISTED status locks this deal — set by {@link checkCloseLock} on every save.
     *
     * The lock used to answer one question ("may this edit proceed?") and nothing else, so the writers
     * further down the save could not tell a frozen deal from a live one. `provisionEmbeddedOrder` in
     * particular ran unconditionally, and Description is deliberately editable while locked — so editing
     * the description of a closed legacy deal INSERTED an empty Draft order, rewrote `Deal.OrderID` on a
     * frozen row, and let the stage writer stamp that order from the CLOSING stage (`Voided`, for a lost
     * deal). Every one of those is a write to provenance that is supposed to be immutable.
     *
     * So the lock now reports what it found. Nothing else may recompute it: two places deciding whether a
     * deal is locked is how they come to disagree.
     */
    /**
     * ── ONE WRITER FOR THE STAGE LOG, AND CALLERS DECLARE INSTEAD OF WRITING ────────────────────────
     *
     * `PipelineStageID` had FOUR writers by the end of the last round — this class's event appender and
     * defaults applier, plus `Sales.CloseDeal` and `Sales.ReopenDeal`, each hand-writing a
     * `DealStageEvent` and then moving the stage. The sequence was never audited whole, and all three
     * consequences were of the same kind:
     *
     *   · **Two rows for one transition.** `stampClose` wrote its event, then set
     *     `deal.PipelineStageID = input.ClosingStageID`, and the save that followed saw a stage change and
     *     appended a SECOND row. `close-deal.CD4` could not see it because it never passes
     *     `ClosingStageID` — the only input that makes the stage move. Reopen had it too, identically.
     *   · **A self-transition.** `planStageEvent` compared stage ids case-sensitively while the two
     *     writers beside it lowercased first, so a caller that normalised its ids got an append-only row
     *     saying the deal moved from a stage to itself.
     *   · **A reopen losing its probability.** `ReopenDeal` passing a `StageID` silently invoked the
     *     DEFAULTS writer, which re-derived `Probability` from the arriving stage — after the reopen
     *     event had already stamped the old one. The stamp said 60 and the deal said 10.
     *
     * The fix is not a fourth special case behind a wider gate. A caller now DECLARES that this save is a
     * governed transition and supplies the note that belongs on it; the entity remains the only thing that
     * writes to `DealStageEvent`, and it reads the declaration to answer the two questions the callers
     * were each answering for themselves:
     *
     *   · **Is an event owed?** Yes if the stage moved — and also yes if a transition is declared, which
     *     is what makes a close that does NOT move the stage still leave provenance. That case was the
     *     reason `stampClose` wrote its own row in the first place.
     *   · **Do the stage's defaults apply?** No. A declared transition's probability is the caller's
     *     considered value — a close's final number, a reopen's hand-tuned one — and re-deriving it from
     *     the pipeline would overwrite the very figure the event just stamped.
     *
     * Declared per save and cleared when it finishes, like every other per-save field here: a declaration
     * that outlived its save would silently suppress the defaults on the next unrelated edit.
     */
    public DeclareTransition(kind: DealTransitionKind, note: string | null): void {
        this._declaredTransition = { Kind: kind, Note: note };
    }

    /** The id of the `DealStageEvent` the last save appended, or null if it owed none. */
    public get LastStageEventID(): string | null {
        return this._lastStageEventID;
    }

    private _declaredTransition: DeclaredTransition | null = null;
    private _lastStageEventID: string | null = null;
    private _lockedAtSave = false;

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

        // FROM HERE THE DEAL IS LOCKED, whatever this particular edit turns out to be. Recorded before
        // the field-by-field verdict below, because the writers downstream care about the LOCK, not about
        // whether this one edit was permitted.
        this._lockedAtSave = true;

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
    /**
     * Why a direct write to `OwnerEmployeeID` is refused, or null when this save is not doing that.
     *
     * ── THE HOLE THIS CLOSES, AND WHY IT WAS NOT OBVIOUS ────────────────────────────────────────
     *
     * {@link stampOwnerFromTeam} is guarded on the roster having participated in the save, and that
     * guard is correct — without it, an ordinary header edit would derive "no owner" from an unloaded
     * collection and CLEAR the stamp. But its consequence was two paths and a refusal on neither: a
     * save carrying the roster silently DISCARDED a hand-set stamp, and a header-only save silently
     * KEPT one. The second is the damaging half. It left the app able to hold a deal whose owner column
     * and owner-role team row name different people, reached by a plain `BaseEntity.Save()` with no
     * error and no warning — and the stamp exists precisely so per-rep rollups need no join, so a
     * rollup could disagree with the roster it was meant to shortcut. Proven against the database by
     * `scripts/audit-story-evidence.mjs` (E3) before this existed.
     *
     * ── WHY REFUSE RATHER THAN QUIETLY RE-DERIVE ────────────────────────────────────────────────
     *
     * Because the caller believed they were setting the owner. Correcting them in silence produces the
     * same wrong outcome as before — the owner is not who they said — with no way to notice. The
     * message names {@link DealEntity.SetOwner}, which is the operation they actually wanted.
     *
     * ── WHY `SetOwner` IS NOT CAUGHT BY THIS ────────────────────────────────────────────────────
     *
     * It calls `Team.Load()` first, so `IsLoaded` is true by the time it assigns the stamp: the roster
     * IS part of that save, and the server re-derives the same value from it a moment later. The two
     * conditions mirror `stampOwnerFromTeam`'s guard exactly, which is what keeps them from disagreeing.
     */
    private ownerStampEditRefusal(): string | null {
        if (this.Team.IsLoaded || this.Team.Count > 0) {
            return null;   // the roster is part of this save; the stamp is derived from it below
        }
        if (!this.callerSuppliedValue('OwnerEmployeeID', this.OwnerEmployeeID)) {
            return null;   // nobody supplied it. The common case.
        }
        return (
            'Deal.OwnerEmployeeID is a server-maintained stamp derived from the DealTeamMember holding ' +
            'the owner role, and cannot be set directly — a save that changed it without the roster ' +
            'would leave the column and the team disagreeing about who owns the deal. Use ' +
            'DealEntity.SetOwner(employeeID), which edits the roster and lets the stamp follow.'
        );
    }

    private async stampOwnerFromTeam(): Promise<void> {
        if (!this.Team.IsLoaded && this.Team.Count === 0) {
            return; // the roster is not part of this save; leave the stamp alone
        }

        const ownerRoleID = await this.ResolveOwnerRoleID();
        const owner = this.Team.Items.find((m) => m.DealRoleID === ownerRoleID);
        this.OwnerEmployeeID = owner?.EmployeeID ?? null;
    }
}
