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

import {
    mjBizAppsSalesDealEntity,
    mjBizAppsSalesDealLineEntity,
    mjBizAppsSalesDealPaymentScheduleEntity,
} from './generated/entity_subclasses';

/** The house default the form pre-fills for a new deal's payment method. */
export const DEAL_DEFAULT_PAYMENT_METHOD = 'ACH';

/** The one column the owner-role lookup selects. `ResultType: 'simple'` returns plain rows, not entities. */
interface DealRoleIDRow {
    ID: string;
}

/**
 * The pricing-provenance block on `DealLine` — WRITE-ONLY from an `Orders.PreviewOrder` response.
 *
 * These four columns hold the answer the pricing engine gave, its explanation, and the moment it gave
 * it. Nothing in this app may compute them, and nothing outside the sanctioned pricing path may set
 * them: a hand-edited `ResolvedUnitPrice` is a number that looks authoritative and carries a provenance
 * stamp saying it came from the engine, when it did not. That is worse than an obviously wrong number,
 * because every downstream reader has been told it can trust this one.
 *
 * @see DealLineEntity.Validate — the guard, and why it lives there rather than in field permissions.
 */
const PRICING_PROVENANCE_FIELDS = [
    'ResolvedUnitPrice',
    'ResolvedExtendedAmount',
    'PriceComponentsJSON',
    'PricedAt',
] as const;

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
 * A deal line, with the rules a form can check.
 *
 * Reached through `Deal.Lines`, which builds its children with `GetEntityObject` — so this subclass is
 * resolved by the class factory and these rules apply to every line in the graph.
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Deal Lines')
export class DealLineEntity extends mjBizAppsSalesDealLineEntity {
    public override Validate(): ValidationResult {
        const result = super.Validate();
        const label = this.ProductName?.trim() || 'this line';

        if (!this.ProductName || !this.ProductName.trim()) {
            fail(result, 'ProductName', 'Every line needs a product or service name.', this.ProductName);
        }
        if (this.Quantity === null || this.Quantity === undefined || this.Quantity < 0) {
            fail(result, 'Quantity', `Quantity on ${label} must be zero or more.`, this.Quantity);
        }
        if (outsideRange(this.RequestedDiscountPct, 0, 100)) {
            fail(
                result,
                'RequestedDiscountPct',
                `Requested discount on ${label} must be between 0 and 100%.`,
                this.RequestedDiscountPct,
            );
        }
        if (below(this.AnnualGrossFees, 0)) {
            fail(result, 'AnnualGrossFees', `Annual gross fees on ${label} cannot be negative.`, this.AnnualGrossFees);
        }
        if (below(this.DiscountAmount, 0)) {
            fail(
                result,
                'DiscountAmount',
                `Discount on ${label} cannot be negative — a surcharge belongs on its own line.`,
                this.DiscountAmount,
            );
        }
        // Compared as DATES rather than as `yyyy-MM-dd` strings, which is what the retired draft did.
        // The entity's own field type is what makes this correct for both a date-only and a full
        // timestamp value, with no dependency on a normalizing boundary upstream.
        if (this.ServicePeriodStart && this.ServicePeriodEnd && this.ServicePeriodEnd < this.ServicePeriodStart) {
            fail(
                result,
                'ServicePeriodEnd',
                `Service period on ${label} ends before it starts.`,
                this.ServicePeriodEnd,
            );
        }

        // DELIBERATELY NOT CHECKED: whether Total equals AnnualGrossFees - DiscountAmount. See the
        // file header — all three are transcriptions, and asserting the relationship is computing money.

        this.RefusePricingProvenanceEdits(result);

        return result;
    }

    /**
     * Refuses any caller-originated change to the four write-only pricing-provenance columns.
     *
     * ── WHY THIS EXISTS, AND WHY IT IS NEW ──────────────────────────────────────────────────────
     *
     * Until Related Record Collections landed, the only way a browser could write a deal line was the
     * `Sales.SaveDeal` remote operation, which copied a LISTED set of fields — and the four below were
     * deliberately absent from that list. Retiring the operation retired the list with it. Saving a line
     * is now an ordinary entity save, and an ordinary entity save had nothing stopping it.
     *
     * THE HOLE WAS ALREADY WIDER THAN THAT, which is the part worth knowing: the generated Deal Lines
     * form has always exposed these columns as editable inputs, so any Explorer user could type into
     * them long before this change. Putting the rule on the ENTITY closes both doors at once, which
     * neither a restored whitelist nor a UI change would do.
     *
     * ── WHY NOT FIELD PERMISSIONS ───────────────────────────────────────────────────────────────
     *
     * `AllowUpdateAPI = 0` looks like the obvious answer and is the wrong one: `EntityFieldInfo`
     * excludes such fields from the `spCreate` / `spUpdate` parameter list entirely, so the S2 pricing
     * bridge — the one caller that MUST write these — would be locked out too and would need raw SQL to
     * do its job. Refusing at validation keeps the column writable by design and closed by rule.
     *
     * ── WHY THE TEST IS "NEW WITH A VALUE, **OR** DIRTY" ────────────────────────────────────────
     *
     * A dirty-check alone is NOT sufficient, and the reason is a genuine trap. `EntityField`'s setter
     * treats the FIRST write to a never-set field as record setup and copies the incoming value into
     * `_OldValue` as well as `_Value`:
     *
     *     if (this._NeverSet && (value !== null || this._OldValue !== null)) this._OldValue = value;
     *
     * So on a brand-new line, `line.ResolvedUnitPrice = 4200` leaves old and new equal and `Dirty`
     * reports **false**. A guard built on `Dirty` alone would pass every forged value on a create — the
     * exact case that matters most — while looking correct. This was caught by the check below failing,
     * not by reading the code.
     *
     * The two conditions together are correct in all four quadrants:
     *   · new + value set        → refused (the create case `Dirty` cannot see)
     *   · new + untouched        → allowed (null, as it must be)
     *   · loaded + changed       → refused (`Dirty` is reliable once a record has been loaded)
     *   · loaded + unchanged     → allowed, so an already-priced line re-saves cleanly
     *
     * ── THE SEAM FOR S2 ─────────────────────────────────────────────────────────────────────────
     *
     * When the pricing bridge lands, `DealLineEntityServer` overrides this to permit the write when it
     * originates from a verified `Orders.PreviewOrder` response — that server-only subclass is the
     * sanctioned path, and it does not exist yet precisely because nothing may write these columns until
     * it does. Until then the rule is absolute, which is the correct state rather than a gap.
     */
    protected RefusePricingProvenanceEdits(result: ValidationResult): void {
        const isNew = !this.IsSaved;

        for (const name of PRICING_PROVENANCE_FIELDS) {
            const field = this.GetFieldByName(name);
            if (!field) {
                continue;
            }
            const hasValue = field.Value !== null && field.Value !== undefined;
            if ((isNew && hasValue) || field.Dirty) {
                fail(
                    result,
                    name,
                    `${name} is written only from an Orders.PreviewOrder response — it cannot be set here. `
                    + 'This app records what the pricing engine answered; it never computes or edits it.',
                    field.Value,
                );
            }
        }
    }
}

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
    const anchors: unknown[] = [DealEntity, DealLineEntity, DealPaymentScheduleEntity];
    if (anchors.length === 0) {
        throw new Error('LoadSalesDealEntities: registration anchors were tree-shaken away.');
    }
}
