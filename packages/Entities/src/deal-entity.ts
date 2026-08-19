/**
 * @fileoverview The shared `Deal` entity subclasses — the rules a FORM can honestly check, living on
 * the entity itself so both tiers run the same code.
 *
 * WHY THESE EXIST, AND WHAT REPLACED WHAT. A deal is not one row: it is a header, its lines and its
 * payment schedule, and they must land together or not at all. Until MJ v6 a browser could not express
 * that — the class the client held was the generated `mjBizAppsSalesDealEntity`, which had no child
 * collections, so the app carried a `DealDraft` view-model and a `Sales.SaveDeal` remote operation that
 * rehydrated its payload into a server-side entity tree.
 *
 * **Related Record Collections removed the need for both.** `Deal` now declares `Lines`,
 * `PaymentSchedule` and `Team` as typed collections (see `metadata/entity-relationships/README.md`), so
 * the same object graph exists on both tiers, travels over `MJ.SaveEntityGraph`, and persists inside one
 * transaction. The draft and the operation are gone; what they knew that was worth keeping is here.
 *
 * ── WHAT IS HERE AND WHY IT IS HERE RATHER THAN IN THE UI ───────────────────────────────────────
 *
 * `Validate()` on an entity subclass runs in the browser AND on the server, on the one path every write
 * takes. That is the whole reason these rules moved out of a UI-side model: a form-shaped validator can
 * be bypassed by an Action, an agent, or a second surface built next year, and a rule that can be
 * bypassed is a rule that eventually is.
 *
 * `RelatedRecordCollection.Validate()` fans out to the children and re-labels their errors as
 * `Lines[0].ProductName`, so a failing line says *which* line. Nothing here needs to know its own index.
 *
 * ── WHAT THIS FILE MUST NEVER DO ────────────────────────────────────────────────────────────────
 *
 * ARITHMETIC ON MONEY. No multiplying quantity by price, no applying a discount percentage, no summing
 * lines into a header total, no rounding. In particular:
 *
 *   - `Total` is NOT checked against `AnnualGrossFees - DiscountAmount`. All three are figures
 *     TRANSCRIBED from a signed document; asserting the relationship would be this app computing money
 *     by the back door, and the subtraction on the page belongs to the customer and the account
 *     director.
 *   - The instalments are NOT checked to sum to the deal amount, for the same reason. The authoritative
 *     total lives in orders.
 *
 * Everything reported here is a REQUIREMENT the user must satisfy before the server will look at the
 * record — never a judgement about whether the deal is commercially sound.
 *
 * The close lock, owner-role uniqueness, company/pipeline agreement and deal numbering are NOT here.
 * They need a database, so they live in `DealEntityServer` on the server tier only. A second
 * implementation next to the UI is the one that eventually disagrees with the first, and the
 * disagreement surfaces as a deal the form said was fine and the server refused.
 *
 * @module @mj-biz-apps/sales-entities
 */
import {
    BaseEntity,
    IRunViewProvider,
    ValidationErrorInfo,
    ValidationErrorType,
    ValidationResult,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';

// THE PEER'S GENERATED CLASS, imported across the app boundary. This is the first hard import from
// another BizApp in this repo, and it is deliberate: the standalone-Sales premise is retired (Amith —
// sales has a hard dependency on orders), so the import-free seam no longer has to be preserved.
// `mj-app.json` has always declared `mj-bizapps-orders`; this makes the code say so too.
//
// The TYPE is the generated class. The RUNTIME class is whatever `ClassFactory` resolves — the browser
// gets orders' client subclass, the server gets `OrderEntityServer` — so the pricing and booking walk
// still belong to orders. Sales never becomes the thing that computes money.
import { mjBizAppsOrdersOrderHeaderEntity } from '@mj-biz-apps/orders-entities';

import {
    mjBizAppsSalesDealEntity,
    mjBizAppsSalesDealPaymentScheduleEntity,
} from './generated/entity_subclasses';

/** The house default the form pre-fills for a new deal's payment method. */
export const DEAL_DEFAULT_PAYMENT_METHOD = 'ACH';

/** The one column the owner-role lookup selects. `ResultType: 'simple'` returns plain rows, not entities. */
interface DealRoleIDRow {
    ID: string;
}

/**
 * Records a blocking problem. Separated from {@link warn} because only a failure clears
 * `result.Success`, and the difference is what lets a surface distinguish "you cannot save this" from
 * "have a look at this".
 */
function fail(result: ValidationResult, field: string, message: string, value: unknown): void {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo(field, message, value, ValidationErrorType.Failure));
}

/**
 * Records a non-blocking observation.
 *
 * ONLY USED ON THE HEADER, deliberately. `RelatedRecordCollection.Validate()` pushes a child's errors
 * *only when the child's own result failed*, so a warning on an otherwise-valid line is dropped before
 * it ever reaches the parent's result. Rather than emit warnings that silently vanish, per-line advice
 * is presentational and lives with the surface that shows it.
 */
function warn(result: ValidationResult, field: string, message: string, value: unknown): void {
    result.Errors.push(new ValidationErrorInfo(field, message, value, ValidationErrorType.Warning));
}

/** Inclusive bounds check that treats null as "not stated" rather than as zero. */
function outsideRange(value: number | null, min: number, max: number): boolean {
    return value !== null && value !== undefined && (value < min || value > max);
}

/** Below-minimum check that treats null as "not stated". */
function below(value: number | null, min: number): boolean {
    return value !== null && value !== undefined && value < min;
}

/**
 * A deal, with the header rules a form can check without a database.
 *
 * Registered on BOTH tiers. `DealEntityServer` extends THIS class rather than the generated one, so the
 * server keeps every rule below and adds the ones that need a database on top.
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Deals')
export class DealEntity extends mjBizAppsSalesDealEntity {
    /**
     * THE DEAL'S ORDER, as a 1:1 embedded peer joined by `OrderID`.
     *
     * One order per deal, created in Draft at deal creation, and from then on the only place line items
     * live — the deal holds none (S-US4). Loading a deal loads its order; saving a deal saves the order
     * and its lines in the same transaction, because an `EmbeddedRecord` is a save-graph participant.
     *
     * ── WHY THIS IS HAND-DECLARED AND NOT GENERATED ──
     *
     * CodeGen can emit this from an `EntityField.EmbeddedRecord` metadata row, and that is the normal
     * route. It does not work here yet. CodeGen resolves the peer's import package through
     * `entityPackageName`, which carries two incompatible meanings on one key: with a plain string every
     * non-core schema resolves to THIS package, so orders' import comes out as `sales-entities`; with a
     * schema map, `getExternalEntitySchemas()` returns the map's keys and CodeGen then excludes those
     * schemas from every artifact it emits — so adding sales' own schema to get its own imports right
     * makes sales stop generating its own entities entirely. Measured, both ways: the map-with-orders
     * variant kept all 22 entity classes but emitted `from 'mj_generatedentities'`; the map-with-both
     * variant emitted 0 classes, 0 GraphQL types, and deleted the generated Angular forms.
     *
     * So the declaration lives here instead. `DeclareEmbeddedRecord` is `protected` on `BaseEntity`
     * precisely so a subclass can call it, which is the same mechanism the generated code uses — this is
     * a different author, not a different pattern. If MJ separates those two meanings later, this moves
     * to a metadata row and the accessors below are deleted; nothing else changes.
     *
     * ── OnClear: 'refuse' ──
     *
     * The three modes are `orphan` (default — null the FK, leave the row), `delete`, and `refuse`.
     *
     * `orphan` is wrong: the order holds every line item, so a detached order is the record of what was
     * being sold with nothing pointing at it. `delete` is worse once the order matters — finance reviews
     * and advances this order after Closed Won, and a Confirmed order has journal entries behind it.
     * `refuse` says the link is not the kind of thing you unset: nothing in S-US4/S-US5 describes a deal
     * legitimately shedding its order, and `FK_Deal_OrderHeader` carries no cascade in either direction
     * for the same reason.
     */
    private readonly __embeddedOrder = this.DeclareEmbeddedRecord<mjBizAppsOrdersOrderHeaderEntity>({
        ForeignKeyField: 'OrderID',
        RelatedEntity: 'MJ_BizApps_Orders: Order Headers',
        OnClear: 'refuse',
    });

    /**
     * The embedded order, or null when this deal has none yet.
     *
     * Named to match what CodeGen would emit for `OrderID` (`{Field}_Object`), so a later move to the
     * generated declaration is a deletion here rather than a rename at every call site.
     */
    public get OrderID_Object(): mjBizAppsOrdersOrderHeaderEntity | null {
        return this.__embeddedOrder.Value;
    }

    /**
     * The embedded order, creating it in memory if this deal has none. Idempotent.
     *
     * This is the hook deal creation uses to mint the Draft order: `Ensure()` provisions the peer, orders'
     * own `NewRecord()` defaults `Status` to `'Draft'` and stamps `OrderDate`, and the row is written when
     * the deal is saved. Sales sets no price and no status — it asks for an order to exist.
     */
    public OrderID_EnsureObject(): mjBizAppsOrdersOrderHeaderEntity {
        return this.__embeddedOrder.Ensure();
    }

    /**
     * @remarks
     * `super.Validate()` is what fans out to the child collections, so it must be called and its result
     * built upon rather than replaced. Calling it second, or building a fresh `ValidationResult`, would
     * silently discard every line and instalment error.
     */
    public override Validate(): ValidationResult {
        const result = super.Validate();

        if (!this.Name || !this.Name.trim()) {
            fail(result, 'Name', 'A deal needs a name.', this.Name);
        }
        if (!this.PipelineID) {
            fail(
                result,
                'PipelineID',
                'Choose a pipeline. It determines the stages and the selling company.',
                this.PipelineID,
            );
        }
        if (outsideRange(this.Probability, 0, 100)) {
            fail(result, 'Probability', 'Probability must be between 0 and 100.', this.Probability);
        }
        if (outsideRange(this.AnnualIncreasePctOverride, 0, 100)) {
            fail(
                result,
                'AnnualIncreasePctOverride',
                'Annual increase must be between 0 and 100%.',
                this.AnnualIncreasePctOverride,
            );
        }
        if (below(this.CancellationNoticeDaysOverride, 0)) {
            fail(
                result,
                'CancellationNoticeDaysOverride',
                'Cancellation notice cannot be negative.',
                this.CancellationNoticeDaysOverride,
            );
        }
        if (below(this.TermMonths, 0)) {
            fail(result, 'TermMonths', 'Term cannot be negative.', this.TermMonths);
        }
        if (below(this.EstimatedProjectWeeks, 0)) {
            fail(result, 'EstimatedProjectWeeks', 'Estimated timeline cannot be negative.', this.EstimatedProjectWeeks);
        }

        // A WARNING, not a failure: the schema allows a deal with no account, and an early-stage
        // opportunity legitimately has none yet. Worth flagging because it is almost always an omission.
        if (!this.AccountID) {
            warn(
                result,
                'AccountID',
                'No customer chosen yet — this deal is not attached to an account.',
                this.AccountID,
            );
        }

        // DELIBERATELY NOT CHECKED: ExecutionDate against StartDate. Work that begins before signature
        // is common and legitimate, and the database does not constrain them either.

        return result;
    }

    /* ── The owner (§5.1) ───────────────────────────────────────────────────── */

    /**
     * Assigns the deal's owner by editing the `Team` collection, leaving persistence to the next
     * `Save()`.
     *
     * `DealTeamMember` IS the source of truth for who is on a deal, including the owner;
     * `Deal.OwnerEmployeeID` exists only so "my deals" and per-rep boards need no join. So this works
     * through the roster and lets the stamp be DERIVED from it, rather than the other way round — which
     * is why nothing outside this class hierarchy should assign `OwnerEmployeeID` directly.
     *
     * REPLACING AN OWNER IS A REMOVE PLUS AN ADD, not an edit. `DealTeamMember` is unique on
     * *(deal, employee, role)* and *(deal, person, role)*, so re-pointing an existing owner row at a
     * different employee can land on a key another row already holds. The collection contributes its
     * deletions BEFORE its insertions inside the transaction, which is what makes the swap safe in one
     * save.
     *
     * THIS LIVES ON THE SHARED CLASS, NOT THE SERVER ONE, deliberately. The workspace's owner picker has
     * to express the same intent the server does, and two implementations of "make this person the owner"
     * would disagree about the unique index eventually. The stamp is set optimistically here so the form
     * shows the choice immediately; the server re-derives it from the roster on save, and the two agree
     * because they read the same collection.
     *
     * @param employeeID - The employee who should own this deal, or null to leave it unowned.
     */
    public async SetOwner(employeeID: string | null): Promise<void> {
        const ownerRoleID = await this.ResolveOwnerRoleID();

        // Loading makes this a modification of the real roster rather than a blind append. It throws
        // rather than silently emptying if the read fails, and it is a no-op once loaded, so calling this
        // twice does not re-read — nor does it discard roster edits already staged.
        await this.Team.Load();

        const existing = this.Team.Items.filter((m) => m.DealRoleID === ownerRoleID);
        if (existing.length === 1 && existing[0].EmployeeID === employeeID) {
            this.OwnerEmployeeID = employeeID;
            return; // already the owner — nothing to write
        }

        // Exactly one member may hold the owner role, so every current holder goes.
        for (const member of existing) {
            this.Team.Remove(member);
        }

        if (employeeID) {
            const member = await this.Team.Create();
            member.EmployeeID = employeeID;
            member.PersonID = null;
            member.DealRoleID = ownerRoleID;
            member.IsActive = true;
        }

        this.OwnerEmployeeID = employeeID;
    }

    /**
     * The owner role is whichever `DealRole` carries `IsOwnerRole` — resolved from the FLAG, never from a
     * role name. That is what lets a deployment rename "Owner" to "Account Executive" with no code
     * change, and it is the rule the CI vocabulary grep enforces.
     *
     * Protected so the server subclass derives the stamp from the same resolution rather than its own.
     */
    protected async ResolveOwnerRoleID(): Promise<string> {
        const provider = this.ProviderToUse as unknown as IRunViewProvider;
        const result = await provider.RunView<DealRoleIDRow>(
            {
                EntityName: 'MJ_BizApps_Sales: Deal Roles',
                ExtraFilter: 'IsOwnerRole = 1 AND IsActive = 1',
                ResultType: 'simple',
                Fields: ['ID'],
            },
            this.ContextCurrentUser,
        );
        if (!result.Success) {
            throw new Error(`DealEntity: could not resolve the owner role: ${result.ErrorMessage}`);
        }
        const ownerRole = (result.Results ?? [])[0];
        if (!ownerRole?.ID) {
            throw new Error(
                'DealEntity: no active DealRole has IsOwnerRole = 1. Seed one before assigning an owner.',
            );
        }
        return ownerRole.ID;
    }
}

/**
 * `DealLineEntity` was here. RETIRED with the table: the deal holds no line items, so there are no
 * line rules for it to carry. Every invariant it enforced is accounted for in docs/DECISIONS.md
 * D-DL1 — most relocated to orders' own CHECK constraints, two of them with changed semantics
 * (negative quantities become legal; the discount is a FRACTION there, not a percentage).
 *
 * The pricing-provenance guard went with it, and correctly: it existed because sales held columns
 * carrying the engine's answer that sales was not allowed to author. It now holds none.
 */

/**
 * One negotiated instalment. No rows at all is the normal case — standard terms.
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Deal Payment Schedules')
export class DealPaymentScheduleEntity extends mjBizAppsSalesDealPaymentScheduleEntity {
    public override Validate(): ValidationResult {
        const result = super.Validate();

        // An empty row is a row the user started and abandoned. Requiring one of the two means it can
        // be a placeholder ("balance on delivery", amount TBD) without being blank.
        if ((this.Amount === null || this.Amount === undefined) && !this.Description) {
            fail(result, 'Amount', 'An instalment needs at least an amount or a description.', this.Amount);
        }

        // DELIBERATELY NOT CHECKED: whether the instalments sum to the deal amount.

        return result;
    }
}

/**
 * Anchor that keeps the three registrations above from being tree-shaken.
 *
 * THIS LOOKS POINTLESS AND IS NOT. `@RegisterClass` registers as a side effect of the module being
 * imported, and nothing references these classes by name — so a bundler is entirely correct to elide
 * the import, at which point the class factory resolves the GENERATED entity instead and every rule in
 * this file quietly stops applying. Touching the symbols is what keeps the import alive.
 */
export function LoadSalesDealEntities(): void {
    const anchors: unknown[] = [DealEntity, DealPaymentScheduleEntity];
    if (anchors.length === 0) {
        throw new Error('LoadSalesDealEntities: registration anchors were tree-shaken away.');
    }
}
