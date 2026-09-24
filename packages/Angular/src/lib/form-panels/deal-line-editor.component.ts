/**
 * @fileoverview The restricted line editor the deal form opens instead of the generic Order Line form.
 *
 * ── WHY THIS EXISTS (bc-aidp-next-golive#229) ───────────────────────────────────────────────────
 *
 * "What's being sold" was an `mj-explorer-entity-data-grid` bound straight to `OrderLine`, so New and a
 * row double-click fell through to whatever form is registered for that entity — in bizapps-orders, the
 * CodeGen-generated full-entity form. That form shows Order Header, Reverses Order Line, Journal Entry,
 * Fulfillment Status, the ship-to trio and about a dozen related sections, none of which mean anything
 * to a rep pricing a deal.
 *
 * And it renders **Unit Price as a plain editable field**. A rep could type any price, with no discount
 * recorded and no override reason — which is the exact thing `docs/DECISIONS.md` D-DL2 says must be
 * impossible: *"S-US4 is explicit that no price field is enterable by the rep."*
 *
 * ── WHY IT IS BUILT HERE RATHER THAN REUSED ─────────────────────────────────────────────────────
 *
 * `deal-form.component.ts` opens by saying composing a deal is the deal WORKSPACE's job and that
 * duplicating it here would give us two surfaces that must agree forever. That reasoning was right when
 * it was written and no longer applies: commit `9d6ef9e` ("Replace the in-rail deal workspace with
 * Explorer OpenEntityRecord") unmounted `mjs-deal-workspace`, and nothing has rendered it since —
 * the selector appears in no template anywhere in the repo. So its line editor, and with it D-DL2's
 * guarantee, has been unreachable code since 2026-08-31, and the deal FORM is the only live surface.
 *
 * There is therefore no second surface to disagree with. What this must not do is re-derive the RULES,
 * and it does not: product eligibility, the percent/fraction discount conversion and the term-start
 * question all come from `@mj-biz-apps/sales-entities`, the same helpers the workspace called. Only the
 * markup is new.
 *
 * ── WHAT IT DELIBERATELY DOES NOT OFFER ─────────────────────────────────────────────────────────
 *
 * ── THE LINE IS CREATED ON THE ORDER'S COLLECTION, NOT AS A STANDALONE ENTITY ───────────────────
 *
 * An earlier version built the line with `GetEntityObject` + `NewRecord()` and called `Save()` on it.
 * That fails, and the two reasons are both invisible from here:
 *
 *  - `LineNumber` is NOT NULL with no default, and it is stamped by `applySequence()`, which
 *    `OrderEntityServer` re-runs by array index on every `Add()` and `Create()` OF THE COLLECTION. A
 *    line that never joins the collection is never numbered.
 *  - `UnitPrice` is NOT NULL with no default, and it is resolved by `OrderPricingService` during the
 *    ORDER's save -- the same service that answers `Orders.PriceOrder`. A line saved on its own is
 *    never priced, and sales must not price it (rule 1).
 *
 * The server's refusal arrived with NO MESSAGE, so the dialog showed a bare "The line could not be
 * saved." and the actual cause was nowhere on screen. That is why the failure text below digs.
 *
 * So the editor states INTENT on a line belonging to the order, and saves the ORDER. Orders then
 * numbers it and prices it, which is the division of labour the whole app is built on. The deal's
 * cached `Deal.Amount` is refreshed on the DEAL's next save, and until then the stale-amount notice
 * (golive#230) says so in as many words -- which is exactly what that notice is for.
 *
 * Unit price and line total are READ-ONLY displays, priced by orders. A discount is expressed as a
 * PERCENT and never as an amount (D-DL2 — `DiscountAmount` is an input channel that reads 0 exactly
 * when a percentage discount exists, so showing it would be a lie). Nothing here multiplies, discounts,
 * prorates, sums or rounds: the read-only figures are whatever orders last wrote.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Metadata } from '@memberjunction/core';
import { FormsModule } from '@angular/forms';
import type { mjBizAppsOrdersOrderLineEntity as OrderLineEntity } from '@mj-biz-apps/orders-entities';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import {
    DiscountFractionToPercent,
    DiscountPercentToFraction,
    EffectiveTermStart,
    HasExplicitTermStart as StoresOwnTermStart,
    ResolveDealLockState,
    RoundDiscountPercent,
    ShouldOfferTermStart,
    type ProductLookup,
} from '@mj-biz-apps/sales-entities';
import { DealWorkspaceService } from '../workspace/deal-workspace.service';

/** `<input type="date">` wants `yyyy-MM-dd`, and nothing else renders. */
function toDateInput(d: Date | string | null | undefined): string | null {
    if (!d) return null;
    const iso = d instanceof Date
        ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
        : String(d).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

/**
 * `Orders.PriceOrder`, narrowed to what this dialog sends and reads.
 *
 * Declared here rather than imported: the operation lives in `orders-core-entities-server`, which pulls
 * node built-ins and cannot be bundled for a browser — the same reason the lock refusal copy is
 * repeated rather than imported. What crosses the wire is a contract, so it is stated as one.
 */
interface PriceOrderInput {
    CompanyID: string;
    Lines: Array<{
        ProductID: string;
        Quantity: number;
        DiscountPct?: number | null;
        ServicePeriodStart?: string | null;
        ServicePeriodEnd?: string | null;
    }>;
}

interface PriceOrderOutput {
    Success: boolean;
    Message?: string | null;
    Lines: Array<{ ProductID: string; UnitPrice: number; LineTotalNet: number }>;
}

/** `RouteOperation` is on `ProviderBase`, not on the `IMetadataProvider` interface. */
interface RemoteOperationRouter {
    RouteOperation<TInput, TOutput>(
        operationKey: string,
        input: TInput,
    ): Promise<{ Success: boolean; Output?: TOutput; ErrorMessage?: string }>;
}

@Component({
    selector: 'mjs-deal-line-editor',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <div class="mjs-le__scrim" (click)="Cancel()"></div>
        <div class="mjs-le" role="dialog" aria-modal="true" [attr.aria-label]="Title">
            <header class="mjs-le__head">
                <h2>{{ Title }}</h2>
                <button type="button" class="mjs-le__x" (click)="Cancel()" aria-label="Close">
                    <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
            </header>

            @if (Loading) {
                <div class="mjs-le__body"><p class="mjs-le__muted">Loading…</p></div>
            } @else if (!Working) {
                <div class="mjs-le__body"><p class="mjs-le__error">{{ Error || 'This line could not be opened.' }}</p></div>
            } @else {
                <div class="mjs-le__body">
                    <label class="mjs-le__field">
                        <span class="mjs-le__label">Product</span>
                        <!-- Filtered by ProductFilterFor to Active and to the availability window as of
                             today IN THE BUSINESS TIME ZONE (#168), and NOT filtered by company: a deal
                             may sell any company's product, and the LINE takes its company from whichever
                             is chosen. Each option names its owner because two companies can both sell an
                             "Onboarding Fee". -->
                        <select [ngModel]="Working.ProductID" (ngModelChange)="OnProductChange($event)"
                                [disabled]="IsLocked" [title]="BlockedReason">
                            <option [ngValue]="null">— choose a product —</option>
                            @for (p of Products; track p.ID) {
                                <option [ngValue]="p.ID">{{ ProductOptionLabel(p) }}</option>
                            }
                        </select>
                    </label>

                    <div class="mjs-le__row">
                        <label class="mjs-le__field">
                            <span class="mjs-le__label">Quantity</span>
                            <!-- min="1", NOT 0: orders' CK_OrderLine_Quantity is 'Quantity <> 0', so a
                                 floor of zero offers the one value the database forbids. Negative is
                                 legal to orders as its reversal mechanism, but a reversal is not
                                 something a deal line expresses. -->
                            <input type="number" min="1" step="1" [ngModel]="Working.Quantity"
                                   (ngModelChange)="SetQuantity($event)"
                                   [disabled]="IsLocked" [title]="BlockedReason" />
                        </label>

                        <label class="mjs-le__field">
                            <span class="mjs-le__label">Discount %</span>
                            <!-- Percent in, FRACTION stored. step is 0.01 because that is what
                                 OrderLine.DiscountPct DECIMAL(7,4) holds: a hundredth of one percent.
                                 The conversion refuses an ambiguous value rather than guessing. -->
                            <input type="number" min="0" max="100" step="0.01"
                                   [ngModel]="DiscountPercent" (ngModelChange)="SetDiscountPercent($event)"
                                   [disabled]="IsLocked" [title]="BlockedReason" />
                            @if (DiscountRefusal) {
                                <span class="mjs-le__error">{{ DiscountRefusal }}</span>
                            }
                        </label>
                    </div>

                    @if (ShowTermStart) {
                        <label class="mjs-le__field">
                            <span class="mjs-le__label">Term start</span>
                            <input type="date" [ngModel]="TermStartInput" (ngModelChange)="SetTermStart($event)"
                                   [disabled]="IsLocked" [title]="BlockedReason" />
                            @if (!HasExplicitTermStart) {
                                <small class="mjs-le__hint">order date</small>
                            }
                        </label>
                    }

                    <!-- PRICED BY ORDERS, NEVER ENTERED HERE. This is the whole point of the issue:
                         sales states intent, orders states price. -->
                    <div class="mjs-le__readonly">
                        <div>
                            <span class="mjs-le__label">Unit price</span>
                            <span class="mjs-le__ro-val">{{ Pricing ? '…' : Money(DisplayUnitPrice) }}</span>
                        </div>
                        <div>
                            <span class="mjs-le__label">Line total</span>
                            <span class="mjs-le__ro-val">{{ Pricing ? '…' : Money(DisplayLineTotal) }}</span>
                        </div>
                        <p class="mjs-le__muted">
                            @if (PricingNote) {
                                {{ PricingNote }}
                            } @else {
                                Priced by Orders. Change the price with a discount — it is recorded as one.
                            }
                        </p>
                    </div>

                    @if (Error) { <p class="mjs-le__error">{{ Error }}</p> }
                </div>

                <!-- Confirm LEFT, cancel RIGHT (CLAUDE.md). -->
                <footer class="mjs-le__foot">
                    <button type="button" class="mjs-le__btn mjs-le__btn--primary"
                            [disabled]="!CanSave || Saving" (click)="Save()">
                        {{ Saving ? 'Saving…' : 'Save' }}
                    </button>
                    <button type="button" class="mjs-le__btn" [disabled]="Saving" (click)="Cancel()">Cancel</button>
                    @if (!CanSave && !Saving) {
                        <span class="mjs-le__muted">{{ BlockedReason }}</span>
                    }
                    <!--
                         REMOVE SITS APART FROM THE PAIR ABOVE, pushed right by its own margin. Confirm
                         left and cancel right is the rule for the two choices that END this dialog
                         normally; a destructive third option next to Save is how a rep removes a
                         product they meant to keep.

                         OFFERED ONLY FOR A LINE THAT EXISTS. A line being composed has nothing to
                         remove — Cancel already discards it.
                    -->
                    @if (CanRemove) {
                        @if (Confirming) {
                            <span class="mjs-le__confirm">
                                <span class="mjs-le__muted">Remove this product?</span>
                                <button type="button" class="mjs-le__btn mjs-le__btn--danger"
                                        [disabled]="Saving" (click)="Remove()">
                                    {{ Saving ? 'Removing…' : 'Remove' }}
                                </button>
                                <button type="button" class="mjs-le__btn" [disabled]="Saving"
                                        (click)="Confirming = false">Keep</button>
                            </span>
                        } @else {
                            <button type="button" class="mjs-le__btn mjs-le__btn--quiet"
                                    [disabled]="Saving" (click)="Confirming = true">Remove</button>
                        }
                    }
                </footer>
            }
        </div>
    `,
    styles: [`
        .mjs-le__scrim {
            position: fixed; inset: 0; background: rgba(0, 0, 0, .35); z-index: 1000;
        }
        .mjs-le {
            position: fixed; z-index: 1001; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: min(560px, calc(100vw - 32px)); max-height: calc(100vh - 64px); overflow: auto;
            display: flex; flex-direction: column;
            background: var(--mj-bg-surface-card); color: var(--mj-text-default);
            border: 1px solid var(--mj-border-default); border-radius: var(--mj-radius-xl, 16px);
            box-shadow: var(--mj-shadow-lg, 0 12px 32px rgba(0, 0, 0, .22));
        }
        .mjs-le__head {
            display: flex; align-items: center; justify-content: space-between; gap: var(--mj-space-3);
            padding: var(--mj-space-4) var(--mj-space-5); border-bottom: 1px solid var(--mj-border-subtle);
        }
        .mjs-le__head h2 { margin: 0; font-size: var(--mj-text-lg); font-weight: 700; }
        .mjs-le__x {
            border: 0; background: transparent; cursor: pointer; color: var(--mj-text-muted);
            font-size: var(--mj-text-lg); padding: 4px 8px; border-radius: var(--mj-radius-md, 8px);
        }
        .mjs-le__x:hover { background: var(--mj-bg-surface-hover); color: var(--mj-text-default); }
        .mjs-le__body {
            padding: var(--mj-space-5); display: flex; flex-direction: column; gap: var(--mj-space-4);
        }
        .mjs-le__row { display: flex; gap: var(--mj-space-4); flex-wrap: wrap; }
        .mjs-le__row > .mjs-le__field { flex: 1 1 180px; }
        .mjs-le__field { display: flex; flex-direction: column; gap: 4px; }
        .mjs-le__label {
            font-size: var(--mj-text-xs); text-transform: uppercase; letter-spacing: .04em;
            color: var(--mj-text-muted); font-weight: 700;
        }
        .mjs-le__field input, .mjs-le__field select {
            padding: 8px 10px; border: 1px solid var(--mj-border-default);
            border-radius: var(--mj-radius-md, 8px); background: var(--mj-bg-surface);
            color: var(--mj-text-default); font: inherit; width: 100%;
        }
        .mjs-le__readonly {
            display: flex; gap: var(--mj-space-5); flex-wrap: wrap; align-items: flex-start;
            padding: var(--mj-space-4); border-radius: var(--mj-radius-md, 8px);
            background: var(--mj-bg-surface-subtle, var(--mj-bg-surface-hover));
        }
        .mjs-le__readonly > div { display: flex; flex-direction: column; gap: 4px; }
        .mjs-le__ro-val { font-weight: 650; font-variant-numeric: tabular-nums; }
        .mjs-le__readonly .mjs-le__muted { flex: 1 1 100%; margin: 0; }
        .mjs-le__muted { color: var(--mj-text-muted); font-size: var(--mj-text-sm); }
        .mjs-le__hint { color: var(--mj-text-muted); font-size: var(--mj-text-xs); }
        .mjs-le__error { color: var(--mj-text-danger, #b3261e); font-size: var(--mj-text-sm); }
        .mjs-le__foot {
            display: flex; align-items: center; gap: var(--mj-space-3);
            padding: var(--mj-space-4) var(--mj-space-5); border-top: 1px solid var(--mj-border-subtle);
            flex-wrap: wrap;
        }
        .mjs-le__btn {
            padding: 8px 16px; border-radius: var(--mj-radius-md, 8px); cursor: pointer; font: inherit;
            font-weight: 600; border: 1px solid var(--mj-border-default);
            background: var(--mj-bg-surface); color: var(--mj-text-default);
        }
        .mjs-le__btn--primary {
            background: var(--mj-color-primary, #1268cf); border-color: var(--mj-color-primary, #1268cf);
            color: #fff;
        }
        .mjs-le__btn[disabled] { opacity: .55; cursor: not-allowed; }
        .mjs-le__btn--quiet { margin-left: auto; color: var(--mj-status-error, #b3261e); }
        .mjs-le__btn--danger {
            background: var(--mj-status-error, #b3261e); color: #fff; border-color: transparent;
        }
        .mjs-le__confirm { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; }
        @media (max-width: 480px) {
            .mjs-le__row { flex-direction: column; }
        }
    `],
})
export class MJSDealLineEditorComponent implements OnInit, OnDestroy {
    /**
     * The DEAL whose order this line belongs to.
     *
     * The deal rather than an order id, because the line has to be created ON the order's `Lines`
     * collection for orders to number and price it — see the file header.
     */
    @Input() Deal: DealEntity | null = null;
    /** The line to edit. Null opens a new one. */
    @Input() LineID: string | null = null;

    /** Emitted after a successful save, so the panel can refresh its grid. */
    /**
     * Whether the deal's PERSISTED status locks it, resolved by this component from the deal it was
     * handed — deliberately not an `@Input`.
     *
     * An input would have to be remembered by every caller, and the defect this closes was exactly a
     * caller that did not: the deal form's lines grid renders outside its own `@if (!IsLocked)` block,
     * so a row double-click opened this editor on a closed deal with all four fields typeable. The
     * save was then refused by `DealLockOrderLineVeto` — offered, taken, refused, which is the shape
     * golive#206 exists to delete.
     *
     * Resolving it here means the guard travels with the component. A second entry point added later
     * inherits the refusal instead of reopening the hole, which is the failure this repo keeps
     * finding: a check that was true at the one exit that had it.
     */
    public IsLocked = false;

    @Output() Saved = new EventEmitter<void>();
    /** Emitted when the dialog should close without saving. */
    @Output() Closed = new EventEmitter<void>();

    private readonly service = inject(DealWorkspaceService);
    private readonly cdr = inject(ChangeDetectorRef);

    public Products: ProductLookup[] = [];
    public Working: OrderLineEntity | null = null;
    public Loading = true;
    public Saving = false;
    public Error: string | null = null;
    /** Set when the typed percent could not be converted — see `DiscountPercentToFraction`. */
    public DiscountRefusal: string | null = null;
    /** Whether this dialog created the line, so cancelling must take it back off the collection. */
    private IsNewLine = false;

    public get Title(): string { return this.LineID ? 'Edit line' : 'Add a product'; }

    public async ngOnInit(): Promise<void> {
        try {
            /**
             * THE PERSISTED STATUS, matching the server and the deal form: a deal being closed right
             * now still has an open status in the database, and reading the in-memory value would make
             * a deal impossible to close. `ResolveDealLockState` is the shared rule, so this editor and
             * the form cannot answer the question differently.
             */
            const persisted = this.Deal?.GetFieldByName('DealStatusTypeID')?.OldValue as string | null | undefined;
            this.IsLocked = (await ResolveDealLockState(persisted)).IsLocked;

            this.Products = await this.service.LoadProducts();

            /**
             * HYDRATE BEFORE ENSURING, because `Ensure()` MINTS when the peer is absent (DN-17).
             *
             * `OrderID_EnsureObject()` returns the real order only when `EmbeddedRecord` has been
             * exposed -- by a load, a save, or a wire deserialize. Reached with a deal whose `OrderID`
             * names a real row but whose peer never hydrated, it calls `NewRecord()` and hands back a
             * BLANK order instead. Nothing about that is visible here: the dialog then prices a line
             * against it, and the save inserts a SECOND header that has no `CompanyID`, dying two apps
             * away on `Failed to save order header: Company cannot be null` while burning an order
             * number. `DealEntity.Save()` already carries the same guard for the post-save path; this
             * is the load path, which it cannot reach.
             *
             * So the FK is resolved first. `OrderID_LoadObject()` is the safe question -- it resolves a
             * peer the FK already names, which `Ensure()` deliberately refuses to do.
             */
            if (this.Deal?.OrderID && !this.Deal.OrderID_Object) {
                await this.Deal.OrderID_LoadObject();
            }

            const order = this.Deal?.OrderID_EnsureObject();
            if (!order) {
                this.Error = 'This deal has no order yet. Save the deal first.';
                return;
            }

            /**
             * AND REFUSE RATHER THAN MINT, when the deal names an order that did not come back.
             *
             * The load above fixes the case where the peer was merely unhydrated. What it cannot fix is
             * an order this client genuinely cannot read -- a permissions refusal, or a generated type
             * that no longer matches the entity metadata the client builds its query from
             * (MemberJunction/bizapps-orders#238). In that case `Ensure()` has just minted a blank
             * order, and going on would write a second header and orphan the rep's line on it.
             *
             * The test is `IsSaved`, not an error string: it asks whether the object in hand IS the
             * persisted order, which is the thing the rest of this dialog depends on, rather than
             * guessing at why it is not.
             */
            if (this.Deal?.OrderID && !order.IsSaved) {
                this.Error =
                    'This deal\'s order could not be loaded, so a product cannot be added to it. ' +
                    'Reload the page and try again; if it persists, the order exists but this app ' +
                    'cannot read it, and that needs an administrator rather than a retry.';
                return;
            }
            // The collection must be populated before a line can be found in it OR appended to it.
            await order.Lines.Load(true);

            if (this.LineID) {
                this.Working = order.Lines.Items.find((l) => l.ID === this.LineID) ?? null;
                if (!this.Working) {
                    this.Error = 'This line could not be loaded.';
                    return;
                }
            } else {
                // `Create()` is what stamps LineNumber, via the collection's applySequence().
                this.Working = await order.Lines.Create();
                this.IsNewLine = true;
                // Orders' CK_OrderLine_Quantity forbids zero, so a new line starts at the smallest
                // legal value rather than at the one the database refuses.
                this.Working.Quantity = 1;
            }
        } catch (err) {
            this.Error = `This line could not be opened: ${err instanceof Error ? err.message : String(err)}`;
        } finally {
            this.Loading = false;
            this.cdr.detectChanges();
        }
    }

    public ProductOptionLabel(p: ProductLookup): string {
        const sku = p.SKU ? ` (${p.SKU})` : '';
        // The company is named because two companies can each sell an identically-named product, and
        // the choice decides which company's books the revenue lands in.
        return p.Company ? `${p.Name}${sku} — ${p.Company}` : `${p.Name}${sku}`;
    }

    private get SelectedProduct(): ProductLookup | null {
        return this.Products.find((p) => p.ID === this.Working?.ProductID) ?? null;
    }

    /**
     * The line's company comes from the PRODUCT, never from the deal.
     *
     * Orders' `OrderLineEntityServer` overwrites it from the product at save regardless; stamping it
     * here makes the browser agree with that rather than guess, which matters because client-side
     * validation runs where that server subclass does not exist.
     */
    public OnProductChange(productID: string | null): void {
        this.SchedulePrice();   // a priced input changed — ask Orders again
        if (!this.Working) return;
        this.Working.ProductID = productID ?? '';
        const product = this.Products.find((p) => p.ID === productID) ?? null;
        if (product) {
            this.Working.CompanyID = product.CompanyID;
        }
        this.cdr.detectChanges();
    }

    /** Stored as a fraction, shown as a percent. */
    public get DiscountPercent(): number {
        return DiscountFractionToPercent(this.Working?.DiscountPct);
    }

    public SetDiscountPercent(percent: number | null): void {
        this.SchedulePrice();   // a priced input changed — ask Orders again
        if (!this.Working) return;
        // An unchanged value is not a new claim, so a re-render must not resurrect a cleared refusal.
        if (percent !== null && RoundDiscountPercent(percent) === this.DiscountPercent) {
            this.DiscountRefusal = null;
            return;
        }
        const converted = DiscountPercentToFraction(percent);
        if (!converted.Ok) {
            this.DiscountRefusal = converted.Reason;
            return;
        }
        this.DiscountRefusal = null;
        this.Working.DiscountPct = converted.Fraction;
    }

    /**
     * Whether this line offers a term start at all — orders' own test, via the shared rule: the product
     * carries a `SubscriptionTypeID`, which is what decides whether confirm builds a term for the line.
     */
    public get ShowTermStart(): boolean {
        return ShouldOfferTermStart(
            !!this.Working?.ProductID,
            this.SelectedProduct,
            this.Working?.ServicePeriodStart,
        );
    }

    /** The order date stands in until the line stores one of its own; it is displayed, never written. */
    public get TermStartInput(): string | null {
        return toDateInput(
            EffectiveTermStart(this.Working?.ServicePeriodStart, this.Deal?.OrderID_Object?.OrderDate ?? null),
        );
    }

    public get HasExplicitTermStart(): boolean {
        return StoresOwnTermStart(this.Working?.ServicePeriodStart);
    }

    public SetTermStart(value: string): void {
        this.SchedulePrice();   // a priced input changed — ask Orders again
        if (!this.Working) return;
        // An emptied control means "use the order date", which is NULL in the column -- not the epoch.
        this.Working.ServicePeriodStart = value ? new Date(`${value}T00:00:00Z`) : null;
    }

    public Money(n: number | null | undefined): string {
        if (n == null || !Number.isFinite(Number(n))) return '—';
        return Number(n).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
    }

    /* ── What the line comes to, answered by Orders (S2) ─────────────────────────── */

    /**
     * SALES ASKS; IT DOES NOT WORK IT OUT. `Orders.PriceOrder` runs `OrderPricingService` — the same
     * service `OrderEntityServer.Save()` runs — and persists nothing, so the figure on screen and the
     * figure in the ledger come from one implementation. Multiplying quantity by price here would be
     * the second implementation CLAUDE.md's first rule exists to prevent.
     *
     * WHY THE DIALOG WAS BLANK. `UnitPrice` and `LineTotalNet` are resolved during the ORDER's save,
     * so on a line being composed they are null — and the caption underneath read "Priced by Orders",
     * which a rep reasonably took to mean the price should already be there. The values were not
     * missing; they did not exist yet.
     *
     * An earlier `Orders.PreviewOrder` could not have fixed this: it ran the real save in a transaction
     * that always rolled back, so it fired the whole booking walk on every keystroke. Orders withdrew it
     * and shipped `PriceOrder` — the decide step without the write — which is what makes asking cheap
     * enough to do while someone types.
     */
    public Pricing = false;
    private pricedUnit: number | null = null;
    private pricedTotal: number | null = null;
    public PricingNote: string | null = null;
    private priceTimer: ReturnType<typeof setTimeout> | null = null;

    /** Orders' answer when there is one, otherwise whatever the saved line already carries. */
    public get DisplayUnitPrice(): number | null {
        return this.pricedUnit ?? (this.Working?.UnitPrice as number | null | undefined) ?? null;
    }

    public get DisplayLineTotal(): number | null {
        return this.pricedTotal ?? (this.Working?.LineTotalNet as number | null | undefined) ?? null;
    }

    /**
     * Cancels a pending price request when the dialog goes away.
     *
     * The debounce timer was only ever cleared by RESCHEDULING it, so a rep who typed a quantity and
     * clicked Cancel within 350ms left a timer that fired against a destroyed component: a pointless
     * `Orders.PriceOrder` round trip, and a `detectChanges()` on a view Angular had already torn down.
     * The dialog lives inside `@if (EditorOpen)`, so it is genuinely destroyed on both Save and Cancel.
     *
     * `Saving` is not reset here on purpose — the component is going away, and an in-flight `Remove`
     * or `Save` owns its own `finally`.
     */
    public ngOnDestroy(): void {
        if (this.priceTimer) {
            clearTimeout(this.priceTimer);
            this.priceTimer = null;
        }
    }

    /** Quantity is a priced input, so it cannot be a plain two-way binding. */
    public SetQuantity(value: number | null): void {
        if (!this.Working) return;
        this.Working.Quantity = Number(value);
        this.SchedulePrice();
    }

    /**
     * Debounced because a rep types: a quantity of 12 passes through 1 on its way there, and three
     * round trips to price a number nobody meant is three chances to show them a figure for it.
     */
    public SchedulePrice(): void {
        if (this.priceTimer) clearTimeout(this.priceTimer);
        this.priceTimer = setTimeout(() => { void this.refreshPrice(); }, 350);
    }

    /**
     * Asks Orders what this line comes to.
     *
     * NOTHING IS WRITTEN TO THE LINE. These are display values; the order's own save resolves the real
     * ones. Writing them here would make this a second author of a priced figure, and a stale one the
     * moment the rep changed anything.
     *
     * Every failure is silent in the sense that matters — it never blocks the save. A price nobody
     * could fetch is shown as unknown, which is honest; refusing to let a rep record what they sold
     * because a pricing call timed out would not be.
     */
    private async refreshPrice(): Promise<void> {
        const line = this.Working;
        const companyID = this.Deal?.CompanyID as string | null | undefined;
        if (!line?.ProductID || !companyID) {
            this.pricedUnit = null;
            this.pricedTotal = null;
            this.PricingNote = null;
            this.cdr.detectChanges();
            return;
        }

        this.Pricing = true;
        this.PricingNote = null;
        this.cdr.detectChanges();
        try {
            const router = Metadata.Provider as unknown as RemoteOperationRouter;
            const envelope = await router.RouteOperation<PriceOrderInput, PriceOrderOutput>(
                'Orders.PriceOrder',
                {
                    CompanyID: companyID,
                    Lines: [{
                        ProductID: String(line.ProductID),
                        Quantity: Number(line.Quantity) || 1,
                        DiscountPct: (line.DiscountPct as number | null | undefined) ?? null,
                        ServicePeriodStart: this.IsoOrNull(line.ServicePeriodStart),
                        ServicePeriodEnd: this.IsoOrNull(line.ServicePeriodEnd),
                    }],
                },
            );

            /**
             * TWO LAYERS OF SUCCESS. The envelope says the operation RAN; `Output.Success` says pricing
             * worked. Checking only the outer one is a mistake this repo has already made once, on the
             * contracts seam, where it reported a contract that was never written.
             */
            const priced = envelope.Success ? envelope.Output : null;
            const row = priced?.Success ? priced.Lines?.[0] : null;
            if (!row) {
                this.pricedUnit = null;
                this.pricedTotal = null;
                this.PricingNote = 'Orders could not price this line yet. It is priced on save.';
                return;
            }
            this.pricedUnit = row.UnitPrice;
            this.pricedTotal = row.LineTotalNet;
        } catch {
            this.pricedUnit = null;
            this.pricedTotal = null;
            this.PricingNote = 'Orders could not price this line yet. It is priced on save.';
        } finally {
            this.Pricing = false;
            this.cdr.detectChanges();
        }
    }

    /** Dates cross the wire as `yyyy-MM-dd`; a Date instance does not survive the trip. */
    private IsoOrNull(value: unknown): string | null {
        if (!value) return null;
        const d = value instanceof Date ? value : new Date(String(value));
        return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }

    public get CanSave(): boolean {
        if (this.IsLocked) return false;
        return !!this.Working?.ProductID && !this.DiscountRefusal && !!this.Deal?.OrderID_Object;
    }

    /**
     * Why Save is disabled, in the words a rep needs.
     *
     * THE LOCK IS TESTED FIRST, because it is the reason that outranks the others: on a closed deal a
     * missing product is not what the rep has to fix, and telling them to choose one invites work the
     * save would refuse anyway.
     *
     * The sentence is `DealLockRefusal('update')`'s, word for word, and is repeated rather than
     * imported: that function lives in `sales-core-entities-server`, which pulls `node:crypto` and
     * cannot be bundled for a browser — the same reason the deal workspace carries its own copy. The
     * three copies are pinned by `deal-lock-refusal-copy` so they cannot drift apart silently.
     */
    public get BlockedReason(): string {
        if (this.IsLocked) return 'This deal is closed. Set the status back to Open before changing what was sold.';
        if (!this.Deal?.OrderID_Object) return 'Save the deal first — a product line needs its order.';
        if (!this.Working?.ProductID) return 'Choose a product.';
        return this.DiscountRefusal ?? '';
    }

    /**
     * Whether this line can be taken off the deal.
     *
     * A line being COMPOSED is not removable — there is nothing to remove, and Cancel already discards
     * it. A locked deal refuses for the same reason it refuses every other change to what was sold, and
     * golive#206 item 1 names deleting alongside adding and editing.
     */
    public get CanRemove(): boolean {
        return !!this.LineID && !this.IsLocked && !!this.Deal?.OrderID_Object;
    }

    /** Two-step, because removing a product a rep meant to keep costs them a re-entry. */
    public Confirming = false;

    /**
     * Takes the line off the ORDER, which is the only thing that can take it off the deal.
     *
     * THROUGH THE COLLECTION, NOT A DIRECT DELETE. `order.Lines.Remove()` then `order.Save()` is the
     * path orders drains: `OrderEntityServer` reads `Lines.Removed` during its save, renumbers the
     * survivors and recomputes the header. Deleting the `OrderLine` record straight from a grid skips
     * all of it — which is why the grid's own delete button stays off, the same reason its New does.
     *
     * THIS BECAME POSSIBLE ONLY RECENTLY. Orders did not drain `Lines.Removed` at all, so a removal was
     * silently dropped and then, once it started refusing, cost the rep every other edit staged beside
     * it. Sales carried a blanket refusal for that (`ShouldRefuseLineRemoval`, still in the unmounted
     * workspace). The orders fix landed with golive#187, and `save-deal.SD6` is the tripwire that said
     * so.
     *
     * It emits `Saved` rather than a removal-specific event: what the panel has to do afterwards is
     * identical — re-read the grid and force a deal save so the amount follows the order down.
     */
    public async Remove(): Promise<void> {
        const order = this.Deal?.OrderID_Object;
        if (!this.Working || !this.CanRemove || !order) {
            return;
        }
        this.Saving = true;
        this.Error = null;
        this.cdr.detectChanges();
        try {
            order.Lines.Remove(this.Working);
            const ok = await order.Save();
            if (!ok) {
                // Put it back: a refused save must not leave the collection claiming a removal that
                // did not happen, or the next save would retry it against a rep who has moved on.
                await order.Lines.Load(true);
                this.Error = order.LatestResult?.Message || 'The product could not be removed.';
                return;
            }
            this.Saved.emit();
        } catch (err) {
            this.Error = err instanceof Error ? err.message : String(err);
        } finally {
            this.Saving = false;
            this.Confirming = false;
            this.cdr.detectChanges();
        }
    }

    public async Save(): Promise<void> {
        if (!this.Working || !this.CanSave) return;
        this.Saving = true;
        this.Error = null;
        this.cdr.detectChanges();
        try {
            /**
             * THE ORDER IS SAVED, NOT THE LINE. Orders numbers and prices the line during this save;
             * see the file header for why saving the line alone cannot work.
             */
            const order = this.Deal?.OrderID_Object;
            if (!order) {
                this.Error = 'This deal has no order yet. Save the deal first.';
                return;
            }
            const ok = await order.Save();
            if (!ok) {
                /**
                 * `Save()` returns false rather than throwing, so without this check the dialog would
                 * close over a line that was never written. The message is dug out rather than
                 * defaulted: the first version showed a bare "The line could not be saved." and the
                 * actual cause -- two NOT NULL columns nobody had filled -- was nowhere on screen.
                 */
                this.Error =
                    order.LatestResult?.Message ||
                    (order.LatestResult?.Errors ?? []).map((e) => e.Message).filter(Boolean).join('; ') ||
                    this.Working?.LatestResult?.Message ||
                    'The line could not be saved, and the server gave no reason.';
                return;
            }
            this.IsNewLine = false;
            this.Saved.emit();
        } catch (err) {
            this.Error = err instanceof Error ? err.message : String(err);
        } finally {
            this.Saving = false;
            this.cdr.detectChanges();
        }
    }

    /**
     * Cancelling a NEW line must take it back off the collection.
     *
     * `Create()` appended it, so simply closing the dialog would leave an unsaved, product-less line
     * attached to the order — and the next save of that order would try to write it. `Remove()` is the
     * collection's own withdrawal (never a splice), which is what the workspace uses for the same
     * reason.
     */
    public Cancel(): void {
        if (this.IsNewLine && this.Working) {
            this.Deal?.OrderID_Object?.Lines.Remove(this.Working);
            this.IsNewLine = false;
        }
        this.Closed.emit();
    }
}
