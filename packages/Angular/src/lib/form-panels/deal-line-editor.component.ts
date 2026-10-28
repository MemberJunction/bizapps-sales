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
 * Lines used to be composed in the deal workspace. Commit `9d6ef9e` ("Replace the in-rail deal
 * workspace with Explorer OpenEntityRecord") unmounted it, and it was later deleted (#291), so the deal
 * FORM is the only surface that edits lines.
 *
 * What this must not do is re-derive the RULES, and it does not: product eligibility, the
 * percent/fraction discount conversion and the term-start question all come from
 * `@mj-biz-apps/sales-entities`. Only the markup is local.
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
 * Unit price and line total are READ-ONLY displays, priced by orders. A discount is STORED as a
 * percent, never on `DiscountAmount` (D-DL2 — that column is an input channel that reads 0 exactly
 * when a percentage discount exists). The rep may TYPE it in dollars (D-DL2, revised): the amount is
 * converted to a percent of orders' list amount by `DiscountAmountToPercent` and lands on
 * `DiscountPct`, so the precision, bounds and concession rules are the percent's. Nothing here
 * multiplies, discounts, prorates, sums or rounds: the read-only figures are whatever orders last wrote.
 *
 * ── CHOOSING AMONG ORDERS' OWN PRICES (golive#270) ──────────────────────────────────────────────
 *
 * A product can carry several named prices — a default plus overrides. The rep may pick one of them
 * with orders' shared `mjo-line-price-picker`, the same control the order line uses, gated by the same
 * `MJ.BizApps.Orders.Price.OverrideList` / `OverrideAny` grants. `AllowCustomAmount` is on, so a rep
 * holding `OverrideAny` may also type a custom amount (D-DL2, revised); the picker itself withholds that
 * row from `OverrideList` holders. Any pick away from the default asks for a reason, and the ORDER's
 * save refuses a flagged line without one. The picker's list, its default and the figures beside it
 * all come from orders; this file only passes them through.
 *
 * ── A DISCOUNT IS RECORDED AS A CONCESSION (golive#305) ─────────────────────────────────────────
 *
 * Discount % writes `OrderLine.DiscountPct`, and orders' confirm gate holds the order until an
 * Approved Price concession covers it. So a discount that goes UP asks for a reason here, and once
 * the order has saved the line, the reason is recorded as that concession. Orders values it and
 * decides it: inside the rep's Sales Authority it is Approved on save, outside it the rep is told the
 * order waits for approval. A failure to record it does not undo the saved line; the rep is told the
 * confirm will be held until one is recorded.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { Metadata } from '@memberjunction/core';
import { UUIDsEqual } from '@memberjunction/global';
import { FormsModule } from '@angular/forms';
import {
    AsDateValue,
    HoldingSubscriberFor,
    IsLinePriceOverridden,
    LineNeedsOverrideReason,
    ListApplicablePrices,
    LoadOrdersEngine,
    OrdersEngine,
    TodayAsDateValue,
    loadApplicabilityContext,
    userPriceOverrideKind,
    type ApplicablePrice,
    type LineEngineDefault,
    type PriceOverrideKind,
    type ServicePeriodSource,
    type mjBizAppsOrdersOrderLineEntity as OrderLineEntity,
} from '@mj-biz-apps/orders-entities';
import {
    ContinuationStartFrom,
    GetExistingHolding,
    MJODatePipe,
    MJOLinePricePickerComponent,
    type MJOExistingHolding,
} from '@mj-biz-apps/orders-ng';
import { RankDealProducts } from './deal-product-ranking';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import {
    DiscountAmountToPercent,
    DiscountFractionToPercent,
    DiscountNeedsConcession,
    DiscountPercentToFraction,
    DiscountReasonCategories,
    EffectiveTermStart,
    HasExplicitTermStart as StoresOwnTermStart,
    PricedLineListAmount,
    IsSubscriptionProduct,
    ResolveDealLockState,
    RoundDiscountPercent,
    RecordDiscountConcession,
    ShouldOfferTermStart,
    type DiscountReasonCategory,
    type ProductLookup,
} from '@mj-biz-apps/sales-entities';
import { DealWorkspaceService } from '../workspace/deal-workspace.service';
import { FormatDealMoney } from './deal-money';

/** `<input type="date">` wants `yyyy-MM-dd`, and nothing else renders; `mjoDate` reads the same day value. */
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
    BillToPersonID?: string | null;
    BillToOrganizationID?: string | null;
    OrderDate?: string | null;
    Lines: Array<{
        ProductID: string;
        Quantity: number;
        /** Omitted to have orders resolve it; supplied, it PINS the price, exactly as on a real line. */
        UnitPrice?: number | null;
        DiscountPct?: number | null;
        ServicePeriodStart?: string | null;
        ServicePeriodEnd?: string | null;
    }>;
}

interface PriceOrderOutput {
    Success: boolean;
    Message?: string | null;
    Lines: Array<{
        ProductID: string;
        UnitPrice: number;
        LineTotalNet: number;
        /** The line's whole discount as orders priced it; with the net it gives the list amount. */
        DiscountAmount?: number | null;
        /** What the rules say for the line regardless of a pinned price — the picker's Default row. */
        Default?: LineEngineDefault | null;
    }>;
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
    imports: [CommonModule, FormsModule, A11yModule, MJOLinePricePickerComponent, MJODatePipe],
    template: `
        <div class="mjs-le__scrim" (click)="Cancel()"></div>
        <!-- Keyboard (#371 item 3): focus is trapped inside while open, Escape cancels, the first
             field takes focus once the line has loaded, and focus returns to the opener on close
             (ngOnDestroy). -->
        <div class="mjs-le" role="dialog" aria-modal="true" data-testid="line-editor" [attr.aria-label]="Title"
             tabindex="-1" cdkTrapFocus (keydown.escape)="OnEscape($event)">
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
                    <div class="mjs-le__field">
                        <label class="mjs-le__label" for="mjs-le-product">Product</label>
                        <!-- A type-ahead over the catalogue, ranked by orders' RankCatalogMatches: a name that
                             starts with the text, then a SKU that does, then either containing it, with the
                             DEAL's company first within each (golive#360). Filtered by ProductFilterFor to
                             Active and to the availability window as of today IN THE BUSINESS TIME ZONE
                             (#168), and NOT filtered by company: a deal may sell any company's product, and
                             the LINE takes its company from whichever is chosen. Each row names its owner
                             because two companies can both sell an "Onboarding Fee". -->
                        <!-- Locked while the price is off its default: a pick belongs to one product's
                             rules, and carrying it onto another product would pin a price nobody chose. -->
                        <input id="mjs-le-product" data-testid="line-product" type="text" autocomplete="off"
                               role="combobox" aria-autocomplete="list" aria-controls="mjs-le-product-list"
                               [attr.aria-expanded]="PickerOpen" [attr.data-product-id]="Working.ProductID || null"
                               placeholder="Type a name or SKU…"
                               [ngModel]="ProductQuery" (ngModelChange)="OnProductQuery($event)"
                               (focus)="OnPickerFocus($event)" (click)="OpenPicker()" (blur)="ClosePicker()" (keydown)="OnPickerKey($event)"
                               [disabled]="IsLocked || ProductLockedByPrice"
                               [title]="ProductSelectTitle" />
                        @if (PickerOpen) {
                            <div class="mjs-le__picks" id="mjs-le-product-list" role="listbox"
                                 data-testid="line-product-options" aria-label="Products">
                                @for (p of PickerResults; track p.ID; let i = $index) {
                                    <!-- mousedown, not click: click lands after the input's blur closed the list. -->
                                    <button type="button" class="mjs-le__pick" role="option" tabindex="-1"
                                            data-testid="line-product-option"
                                            [class.is-cursor]="i === PickerCursor" [attr.aria-selected]="i === PickerCursor"
                                            (mousedown)="ChooseProduct(p, $event)">
                                        <span class="mjs-le__pick-name">{{ p.Name }}</span>
                                        <span class="mjs-le__pick-meta">
                                            @if (p.SKU) { <span>{{ p.SKU }}</span> }
                                            @if (PriceLabel(p); as price) { <span>{{ price }}</span> }
                                            @if (p.Company) {
                                                <span class="mjs-le__pick-co" [class.is-foreign]="IsForeignProduct(p)">
                                                    <i class="fa-solid fa-building" aria-hidden="true"></i> {{ p.Company }}
                                                </span>
                                            }
                                        </span>
                                    </button>
                                } @empty {
                                    <div class="mjs-le__pick-empty">
                                        {{ Products.length ? 'No product matches that.' : 'No products to offer.' }}
                                    </div>
                                }
                                @if (PickerHidden > 0) {
                                    <div class="mjs-le__pick-empty" data-testid="line-product-more">
                                        {{ PickerHidden }} more — keep typing to narrow the list.
                                    </div>
                                }
                            </div>
                        }
                        @if (ForeignCompanyWarning; as warning) {
                            <span class="mjs-le__warn" data-testid="line-product-foreign" role="status">
                                <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> {{ warning }}
                            </span>
                        }
                        @if (ProductLoadError) {
                            <span class="mjs-le__error" data-testid="line-product-error">{{ ProductLoadError }}</span>
                        }
                    </div>

                    <div class="mjs-le__row">
                        <label class="mjs-le__field">
                            <span class="mjs-le__label">Quantity</span>
                            <!-- min="1", NOT 0: orders' CK_OrderLine_Quantity is 'Quantity <> 0', so a
                                 floor of zero offers the one value the database forbids. Negative is
                                 legal to orders as its reversal mechanism, but a reversal is not
                                 something a deal line expresses. -->
                            <input type="number" data-testid="line-quantity" min="1" step="1" [ngModel]="Working.Quantity"
                                   (ngModelChange)="SetQuantity($event)"
                                   [disabled]="IsLocked" [title]="BlockedReason" />
                            @if (QuantityInvalid) {
                                <span class="mjs-le__error" data-testid="line-quantity-error">{{ QuantityInvalidMessage }}</span>
                            }
                        </label>

                        <div class="mjs-le__field">
                            <div class="mjs-le__label-row">
                                <label class="mjs-le__label" [for]="DiscountUnit === 'Percent' ? 'mjs-le-discount' : 'mjs-le-discount-amount'">
                                    Discount {{ DiscountUnit === 'Percent' ? '%' : '$' }}
                                </label>
                                <!-- The rep states the discount in whichever unit the signed form uses.
                                     A dollar amount is converted to the percent the line stores. -->
                                <div class="mjs-le__unit" role="group" aria-label="Discount unit">
                                    <button type="button" data-testid="line-discount-unit-percent"
                                            [class.is-selected]="DiscountUnit === 'Percent'"
                                            [attr.aria-pressed]="DiscountUnit === 'Percent'"
                                            [disabled]="IsLocked" (click)="SetDiscountUnit('Percent')">%</button>
                                    <button type="button" data-testid="line-discount-unit-amount"
                                            [class.is-selected]="DiscountUnit === 'Amount'"
                                            [attr.aria-pressed]="DiscountUnit === 'Amount'"
                                            [disabled]="IsLocked" (click)="SetDiscountUnit('Amount')">$</button>
                                </div>
                            </div>
                            @if (DiscountUnit === 'Percent') {
                                <!-- Percent in, FRACTION stored. step is 0.01 because that is what
                                     OrderLine.DiscountPct DECIMAL(7,4) holds: a hundredth of one percent.
                                     The conversion refuses an ambiguous value rather than guessing. -->
                                <input id="mjs-le-discount" type="number" data-testid="line-discount" min="0" max="100" step="0.01"
                                       [ngModel]="DiscountPercent" (ngModelChange)="SetDiscountPercent($event)"
                                       [disabled]="IsLocked" [title]="BlockedReason" />
                            } @else {
                                <!-- Dollars off the whole line, converted to a percent of orders' list
                                     amount and stored as DiscountPct, so the percent rules still apply. -->
                                <input id="mjs-le-discount-amount" type="number" data-testid="line-discount-amount" min="0" step="0.01"
                                       [ngModel]="DiscountAmountInput" (ngModelChange)="SetDiscountAmount($event)"
                                       [disabled]="IsLocked" [title]="BlockedReason" />
                                @if (!DiscountRefusal && DiscountAmountInput !== null && ListAmount !== null) {
                                    <small class="mjs-le__hint" data-testid="line-discount-derived">
                                        {{ DiscountPercent }}% of {{ Money(ListAmount) }}
                                        @if (DiscountAmountRounded) {
                                            · held to 0.01%, so Orders discounts {{ Money(PricedDiscount) }}
                                        }
                                    </small>
                                }
                            }
                            @if (DiscountRefusal) {
                                <span class="mjs-le__error">{{ DiscountRefusal }}</span>
                            }
                        </div>
                    </div>

                    <!-- A RAISED DISCOUNT IS A CONCESSION, and orders will not confirm the order
                         until one is approved. The reason is asked for here so it can be recorded
                         the moment the line is saved. -->
                    @if (NeedsDiscountReason) {
                        <div class="mjs-le__row">
                            <label class="mjs-le__field">
                                <span class="mjs-le__label">Discount reason category</span>
                                <select data-testid="line-discount-category" [(ngModel)]="DiscountCategory"
                                        [disabled]="IsLocked">
                                    <option [ngValue]="null" disabled>Choose one</option>
                                    @for (c of ReasonCategories; track c) {
                                        <option [ngValue]="c">{{ c }}</option>
                                    }
                                </select>
                            </label>
                            <label class="mjs-le__field">
                                <span class="mjs-le__label">Discount reason</span>
                                <textarea data-testid="line-discount-reason" rows="2" [(ngModel)]="DiscountReason"
                                          [disabled]="IsLocked"
                                          placeholder="Why value is given away on this line"></textarea>
                            </label>
                        </div>
                        <small class="mjs-le__hint">
                            Inside your Sales Authority the discount is approved when you save. Outside it, the
                            order cannot be confirmed until an approver approves it.
                        </small>
                    }

                    @if (ShowPricePicker) {
                        <div class="mjs-le__field">
                            <span class="mjs-le__label">Price</span>
                            <!-- Orders' named prices, plus a typed custom amount for an OverrideAny
                                 holder (D-DL2, revised). The picker withholds the custom row from
                                 OverrideList holders and asks for a reason on any pick off the default. -->
                            <mjo-line-price-picker
                                [Line]="Working"
                                [OverrideKind]="OverrideKind"
                                [AllowCustomAmount]="true"
                                [Applicable]="Applicable"
                                [EngineDefault]="EngineDefault"
                                [DefaultUnit]="DefaultUnit"
                                [PriceSource]="EngineDefault?.PriceName ?? null"
                                [PricedUnit]="DisplayUnitPrice"
                                (PriceChanged)="SchedulePrice()"></mjo-line-price-picker>
                        </div>
                    }

                    @if (ShowTermStart) {
                        @if (TermStartFollowsHolding && Holding; as holding) {
                            <!-- Orders starts an added term the day after the existing coverage ends,
                                 whatever the line states, so the start it will use is shown, not offered.
                                 The line's own start is kept for a switch back to a new subscription. -->
                            <div class="mjs-le__field" data-testid="line-term-start-continuation">
                                <span class="mjs-le__label">Term start</span>
                                <span class="mjs-le__ro-val">{{ HoldingContinuationStart | mjoDate }}</span>
                                <small class="mjs-le__hint">next term of {{ holding.SubscriptionNumber }}</small>
                            </div>
                        } @else {
                            <label class="mjs-le__field">
                                <span class="mjs-le__label">Term start</span>
                                <input type="date" data-testid="line-term-start" [ngModel]="TermStartInput" (ngModelChange)="SetTermStart($event)"
                                       [disabled]="IsLocked" [title]="BlockedReason" />
                                @if (!HasExplicitTermStart) {
                                    <small class="mjs-le__hint">order date</small>
                                }
                            </label>
                        }
                    }

                    <!-- SERVICE PERIOD: the product's recognition type earns over a window and nothing
                         else dates this line (orders' ServicePeriodSource is 'Line'). Orders refuses to
                         confirm the order until both dates are set, so they are asked for here. -->
                    @if (ShowServicePeriod) {
                        <div class="mjs-le__field" role="group" aria-label="Service period" data-testid="line-service-period">
                            <div class="mjs-le__row">
                                <label class="mjs-le__field">
                                    <span class="mjs-le__label">Service start</span>
                                    <input type="date" data-testid="line-service-start" [ngModel]="ServicePeriodInput('Start')"
                                           (ngModelChange)="SetServicePeriod('Start', $event)"
                                           [disabled]="IsLocked" [title]="BlockedReason" />
                                </label>
                                <label class="mjs-le__field">
                                    <span class="mjs-le__label">Service end</span>
                                    <input type="date" data-testid="line-service-end" [ngModel]="ServicePeriodInput('End')"
                                           (ngModelChange)="SetServicePeriod('End', $event)"
                                           [disabled]="IsLocked" [title]="BlockedReason" />
                                </label>
                            </div>
                            @if (ServicePeriodBackwards) {
                                <small class="mjs-le__error">The service end is before the start.</small>
                            } @else if (ServicePeriodMissing) {
                                <small class="mjs-le__hint">Both dates are needed before the order can be confirmed.</small>
                            }
                        </div>
                    }

                    <!-- The customer already holds this product (golive #318): the same question the
                         order line asks. Unanswered, Close Won refuses the deal, except on a renewal
                         deal, which adds the line as the next term. -->
                    @if (Holding; as holding) {
                        <div class="mjs-le__field" role="group" data-testid="line-subscription-choice"
                             [attr.aria-label]="'Existing subscription ' + holding.SubscriptionNumber">
                            <span class="mjs-le__label">Existing subscription</span>
                            <span class="mjs-le__muted">
                                The customer already holds {{ holding.SubscriptionNumber }} for this product
                                @if (HoldingCoverageEnd) { (covered through {{ HoldingCoverageEnd | mjoDate }}) }.
                            </span>
                            <div class="mjs-le__choices">
                                <button type="button" class="mjs-le__btn mjs-le__choice" data-testid="line-subscription-extend"
                                        [class.is-selected]="Working.SubscriptionAction === 'ExtendExisting'"
                                        [attr.aria-pressed]="Working.SubscriptionAction === 'ExtendExisting'"
                                        [disabled]="IsLocked" [title]="BlockedReason"
                                        (click)="SetSubscriptionAction('ExtendExisting')">
                                    Add as next term
                                    @if (HoldingContinuationStart) { (starts {{ HoldingContinuationStart | mjoDate }}) }
                                </button>
                                <button type="button" class="mjs-le__btn mjs-le__choice" data-testid="line-subscription-new"
                                        [class.is-selected]="Working.SubscriptionAction === 'CreateNew'"
                                        [attr.aria-pressed]="Working.SubscriptionAction === 'CreateNew'"
                                        [disabled]="IsLocked" [title]="BlockedReason"
                                        (click)="SetSubscriptionAction('CreateNew')">
                                    New subscription (keeps this line's dates)
                                </button>
                            </div>
                            <small class="mjs-le__hint" [class.mjs-le__error]="!Working.SubscriptionAction">
                                @if (Working.SubscriptionAction === 'CreateNew') {
                                    Starts a separate subscription on this line's term start.
                                } @else if (Working.SubscriptionAction === 'ExtendExisting') {
                                    Adds a term to {{ holding.SubscriptionNumber }}, starting the day after its coverage ends.
                                } @else {
                                    Not chosen. Close Won asks for this, unless the deal is a renewal, which adds it as the next term.
                                }
                            </small>
                        </div>
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
                            } @else if (ShowPricePicker) {
                                Priced by Orders. Choose another of the product's prices above, or record a discount.
                            } @else {
                                Priced by Orders. Change the price with a discount — it is recorded as one.
                            }
                        </p>
                    </div>

                    @if (Error) { <p class="mjs-le__error">{{ Error }}</p> }
                </div>

                @if (Notice) { <p class="mjs-le__notice" data-testid="line-notice">{{ Notice }}</p> }

                <!-- Confirm LEFT, cancel RIGHT (CLAUDE.md). -->
                <footer class="mjs-le__foot">
                    @if (Notice) {
                        <!-- The line is saved; the rep has read what happens next. -->
                        <button type="button" class="mjs-le__btn mjs-le__btn--primary" data-testid="line-done"
                                (click)="Saved.emit()">Done</button>
                    } @else {
                    <button type="button" class="mjs-le__btn mjs-le__btn--primary" data-testid="line-save"
                            [disabled]="!CanSave || Saving" (click)="Save()">
                        {{ Saving ? 'Saving…' : 'Save' }}
                    </button>
                    <button type="button" class="mjs-le__btn" [disabled]="Saving" (click)="Cancel()">Cancel</button>
                    @if (!CanSave && !Saving) {
                        <span class="mjs-le__muted">{{ BlockedReason }}</span>
                    }
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
                                <button type="button" class="mjs-le__btn mjs-le__btn--danger" data-testid="line-remove-confirm"
                                        [disabled]="Saving" (click)="Remove()">
                                    {{ Saving ? 'Removing…' : 'Remove' }}
                                </button>
                                <button type="button" class="mjs-le__btn" [disabled]="Saving"
                                        (click)="Confirming = false">Keep</button>
                            </span>
                        } @else {
                            <button type="button" class="mjs-le__btn mjs-le__btn--quiet" data-testid="line-remove"
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
        .mjs-le:focus { outline: none; }
        .mjs-le {
            position: fixed; z-index: 1001; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: min(560px, calc(100vw - 32px)); max-height: calc(100vh - 64px); overflow: auto;
            display: flex; flex-direction: column;
            background: var(--mj-bg-surface-card); color: var(--mj-text-primary);
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
        .mjs-le__x:hover { background: var(--mj-bg-surface-hover); color: var(--mj-text-primary); }
        .mjs-le__body {
            padding: var(--mj-space-5); display: flex; flex-direction: column; gap: var(--mj-space-4);
        }
        .mjs-le__row { display: flex; gap: var(--mj-space-4); flex-wrap: wrap; }
        .mjs-le__row > .mjs-le__field { flex: 1 1 180px; }
        .mjs-le__field { display: flex; flex-direction: column; gap: 4px; }
        .mjs-le__notice {
            margin: 0 var(--mj-space-5) var(--mj-space-3); padding: var(--mj-space-3);
            border: 1px solid var(--mj-border-default); border-radius: var(--mj-radius-md, 8px);
            background: var(--mj-bg-surface-sunken);
        }
        .mjs-le__label {
            font-size: var(--mj-text-xs); text-transform: uppercase; letter-spacing: .04em;
            color: var(--mj-text-muted); font-weight: 700;
        }
        .mjs-le__field input, .mjs-le__field select, .mjs-le__field textarea {
            padding: 8px 10px; border: 1px solid var(--mj-border-default);
            border-radius: var(--mj-radius-md, 8px); background: var(--mj-bg-surface);
            color: var(--mj-text-primary); font: inherit; width: 100%;
        }
        .mjs-le__readonly {
            display: flex; gap: var(--mj-space-5); flex-wrap: wrap; align-items: flex-start;
            padding: var(--mj-space-4); border-radius: var(--mj-radius-md, 8px);
            background: var(--mj-bg-surface-hover);
        }
        .mjs-le__readonly > div { display: flex; flex-direction: column; gap: 4px; }
        .mjs-le__ro-val { font-weight: 650; font-variant-numeric: tabular-nums; }
        .mjs-le__readonly .mjs-le__muted { flex: 1 1 100%; margin: 0; }
        .mjs-le__muted { color: var(--mj-text-muted); font-size: var(--mj-text-sm); }
        .mjs-le__hint { color: var(--mj-text-muted); font-size: var(--mj-text-xs); }
        .mjs-le__error { color: var(--mj-status-error-text); font-size: var(--mj-text-sm); }
        .mjs-le__warn {
            display: flex; gap: 6px; align-items: baseline; padding: 6px 10px; font-size: var(--mj-text-sm);
            color: var(--mj-status-warning-text); background: var(--mj-status-warning-bg);
            border: 1px solid var(--mj-status-warning-border); border-radius: var(--mj-radius-md, 8px);
        }
        .mjs-le__picks {
            display: flex; flex-direction: column; max-height: 280px; overflow-y: auto;
            border: 1px solid var(--mj-border-default); border-radius: var(--mj-radius-md, 8px);
            background: var(--mj-bg-surface-elevated); box-shadow: var(--mj-shadow-md);
        }
        .mjs-le__pick {
            display: flex; flex-direction: column; gap: 2px; text-align: left; padding: 8px 10px;
            border: 0; border-bottom: 1px solid var(--mj-border-subtle); background: transparent;
            color: var(--mj-text-primary); font: inherit; cursor: pointer;
        }
        .mjs-le__pick:hover, .mjs-le__pick.is-cursor { background: var(--mj-bg-surface-hover); }
        .mjs-le__pick-name { font-weight: 600; }
        .mjs-le__pick-meta {
            display: flex; flex-wrap: wrap; gap: 4px 12px; color: var(--mj-text-muted); font-size: var(--mj-text-xs);
        }
        .mjs-le__pick-co.is-foreign { color: var(--mj-status-warning-text); font-weight: 600; }
        .mjs-le__pick-empty { padding: 8px 10px; color: var(--mj-text-muted); font-size: var(--mj-text-sm); }
        .mjs-le__foot {
            display: flex; align-items: center; gap: var(--mj-space-3);
            padding: var(--mj-space-4) var(--mj-space-5); border-top: 1px solid var(--mj-border-subtle);
            flex-wrap: wrap;
        }
        .mjs-le__btn {
            padding: 8px 16px; border-radius: var(--mj-radius-md, 8px); cursor: pointer; font: inherit;
            font-weight: 600; border: 1px solid var(--mj-border-default);
            background: var(--mj-bg-surface); color: var(--mj-text-primary);
        }
        .mjs-le__btn--primary {
            background: var(--mj-brand-primary); border-color: var(--mj-brand-primary);
            color: #fff;
        }
        .mjs-le__btn[disabled] { opacity: .55; cursor: not-allowed; }
        .mjs-le__btn--quiet { margin-left: auto; color: var(--mj-status-error, #b3261e); }
        .mjs-le__btn--danger {
            background: var(--mj-status-error, #b3261e); color: #fff; border-color: transparent;
        }
        .mjs-le__confirm { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; }
        .mjs-le__label-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .mjs-le__unit {
            display: inline-flex; border: 1px solid var(--mj-border-default);
            border-radius: var(--mj-radius-md, 8px); overflow: hidden;
        }
        .mjs-le__unit button {
            border: 0; background: var(--mj-bg-surface); color: var(--mj-text-muted); cursor: pointer;
            font: inherit; font-size: var(--mj-text-xs); font-weight: 700; padding: 2px 10px;
        }
        .mjs-le__unit button + button { border-left: 1px solid var(--mj-border-default); }
        .mjs-le__unit button.is-selected { background: var(--mj-brand-primary); color: #fff; }
        .mjs-le__unit button[disabled] { opacity: .55; cursor: not-allowed; }
        .mjs-le__choices { display: flex; gap: var(--mj-space-2, 8px); flex-wrap: wrap; }
        .mjs-le__choice.is-selected {
            border-color: var(--mj-brand-primary); color: var(--mj-brand-primary);
        }
        @media (max-width: 480px) {
            .mjs-le__row { flex-direction: column; }
        }
    `],
})
export class MJSDealLineEditorComponent implements OnInit, AfterViewInit, OnDestroy {
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
    private readonly host = inject(ElementRef<HTMLElement>);
    /** What had focus when the dialog opened, so closing it can hand focus back. */
    private readonly opener: HTMLElement | null =
        typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null;

    public Products: ProductLookup[] = [];
    /** Set when orders' catalogue could not be read; shown under the product select. */
    public ProductLoadError: string | null = null;
    /** What the product box shows: the chosen product's label, or what the rep is typing. */
    public ProductQuery = '';
    public PickerOpen = false;
    /** The highlighted row, moved by the arrow keys and taken by Enter. */
    public PickerCursor = 0;
    public PickerResults: ProductLookup[] = [];
    /** How many matches are past the list's cap — named so the rep knows to keep typing. */
    public PickerHidden = 0;
    /** Each product's catalog price, for the picker label — read from orders, keyed by product id. */
    private readonly productPriceLabels = new Map<string, string>();
    /** The signed-in rep's price-override grant; `'none'` hides the price picker. */
    public OverrideKind: PriceOverrideKind = 'none';
    /** The product's applicable named prices, from orders' `ListApplicablePrices`. */
    public Applicable: ApplicablePrice[] = [];
    /** The rules' answer for this line, from the last `Orders.PriceOrder`. Undefined until one reports it. */
    public EngineDefault: LineEngineDefault | null | undefined = undefined;
    public Working: OrderLineEntity | null = null;
    /** The live subscription the line's customer already holds for its product, or null. */
    public Holding: MJOExistingHolding | null = null;
    public Loading = true;
    public Saving = false;
    public Error: string | null = null;
    /** Set when the typed percent could not be converted — see `DiscountPercentToFraction`. */
    public DiscountRefusal: string | null = null;
    /** Whether this dialog created the line, so cancelling must take it back off the collection. */
    private IsNewLine = false;

    /** The `DiscountPct` the line carried when it was last saved — what a raise is measured from. */
    private savedDiscountPct: number | null = null;
    private reasonCategories: DiscountReasonCategory[] | null = null;
    public DiscountCategory: DiscountReasonCategory | null = null;
    public DiscountReason = '';
    /** What the rep must know after a save that recorded, or failed to record, a concession. */
    public Notice: string | null = null;

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

            await this.loadProducts();
            await this.loadProductPriceLabels();
            this.OverrideKind = this.resolveOverrideKind();

            /**
             * RESOLVE THE FK, AND DECIDE, BEFORE `Ensure()` IS ALLOWED TO RUN (DN-17).
             *
             * `OrderID_EnsureObject()` returns the deal's real order only when `EmbeddedRecord` has
             * been exposed -- by a load, a save, or a wire deserialize. Reached with a deal whose
             * `OrderID` names a real row but whose peer never hydrated, it calls `NewRecord()` and
             * hands back a BLANK order instead. The dialog then prices a line against it and the save
             * inserts a SECOND header with no `CompanyID`, dying two apps away on `Failed to save order
             * header: Company cannot be null` while burning an order number.
             *
             * ── WHY THE DECISION CANNOT COME AFTER `Ensure()` ──────────────────────────────────────
             *
             * Because `Ensure()` is not a read. `NewRecord()` mints a `uuidv4()` for a single
             * uniqueidentifier primary key, and `stampOwnerKey()` then writes that id into the OWNER's
             * foreign key -- `this.Deal.OrderID` -- before returning. So by the time a post-`Ensure()`
             * guard could refuse, the deal this dialog SHARES with the form is already repointed at a
             * blank, unsaved order. Closing the dialog and saving the deal then fails on `CompanyID`,
             * against an order the user never saw: exactly the error this guard exists to prevent,
             * moved one screen away.
             *
             * The same stamping is why the test for a deal with NO order has to model it. A deal that
             * arrives with a null `OrderID` acquires one from `Ensure()`, so a guard phrased as "the FK
             * is set and the order is not saved" fires on the legitimate unsaved-deal case too. Asking
             * BEFORE `Ensure()` cannot: at that point `OrderID` still means what the caller meant by it.
             *
             * `DealEntity.Save()` already carries the equivalent guard for the post-save path; this is
             * the load path, which it cannot reach. `OrderID_LoadObject()` is the safe question --
             * it resolves a peer the FK already names, which `Ensure()` deliberately refuses to do.
             *
             * Upstream: MemberJunction/MJ#4739 tracks the two core behaviours this works around.
             */
            if (this.Deal?.OrderID && !this.Deal.OrderID_Object) {
                await this.Deal.OrderID_LoadObject();
            }

            /**
             * Still unresolved means this client genuinely cannot read the order -- a permissions
             * refusal, or a generated type that no longer matches the entity metadata the client builds
             * its query from (MemberJunction/bizapps-orders#238). Refuse while `Deal.OrderID` still
             * points where it did.
             *
             * The test is the PEER, not the object `Ensure()` would hand back: it asks "did the order
             * this deal names come back", which is the thing the rest of this dialog depends on.
             */
            if (this.Deal?.OrderID && !this.Deal.OrderID_Object) {
                this.Error =
                    'This deal\'s order could not be loaded, so a product cannot be added to it. ' +
                    'Reload the page and try again; if it persists, the order exists but this app ' +
                    'cannot read it, and that needs an administrator rather than a retry.';
                return;
            }

            const order = this.Deal?.OrderID_EnsureObject();
            if (!order) {
                this.Error = 'This deal has no order yet. Save the deal first.';
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
            this.savedDiscountPct = this.Working.DiscountPct ?? null;
            this.ProductQuery = this.chosenProductLabel();
            void this.refreshHolding();
            if (this.ShowPricePicker) {
                // The picker's Default row needs orders' answer before anything is changed, and its list
                // needs the applicable prices; a saved line otherwise opens with Default disabled.
                void this.refreshApplicable();
                this.SchedulePrice();
            }
        } catch (err) {
            this.Error = `This line could not be opened: ${err instanceof Error ? err.message : String(err)}`;
        } finally {
            this.Loading = false;
            this.cdr.detectChanges();
            this.focusFirstField();
        }
    }

    /**
     * Orders' catalogue, or a message saying it could not be read. A failed read leaves the picker
     * empty but says why, so a rep can tell "nothing to sell" from "the load failed" (#380); the rest of
     * the dialog still opens, since a saved line can be edited without choosing a new product.
     */
    private async loadProducts(): Promise<void> {
        this.ProductLoadError = null;
        try {
            this.Products = await this.service.LoadProducts();
        } catch (err) {
            this.Products = [];
            const reason = err instanceof Error ? err.message : String(err);
            this.ProductLoadError =
                `${reason.replace(/\.?\s*$/, '.')} Reload the page and try again; if it persists, an administrator needs to check ` +
                `access to Orders' products.`;
        }
    }

    /** Focus the dialog itself while it loads, so the trap and Escape work from the first frame. */
    public ngAfterViewInit(): void {
        this.dialogElement()?.focus();
    }

    /** Escape cancels, unless a save is in flight; the X and Cancel buttons are disabled then too. */
    public OnEscape(event: Event): void {
        event.stopPropagation();
        if (!this.Saving) {
            this.Cancel();
        }
    }

    private dialogElement(): HTMLElement | null {
        const root = this.host?.nativeElement as HTMLElement | undefined;
        return root?.querySelector<HTMLElement>('.mjs-le') ?? null;
    }

    /**
     * The first enabled control in the body, or the dialog when there is none (a locked line, a
     * failed load). Run after the loaded body has rendered.
     */
    private focusFirstField(): void {
        const dialog = this.dialogElement();
        if (!dialog) return;
        const first = dialog.querySelector<HTMLElement>(
            '.mjs-le__body select:not([disabled]), .mjs-le__body input:not([disabled]), .mjs-le__body textarea:not([disabled])',
        );
        (first ?? dialog).focus();
    }

    public ProductOptionLabel(p: ProductLookup): string {
        const sku = p.SKU ? ` (${p.SKU})` : '';
        // The price is named because two products can share a name and differ only in their price band
        // (golive#270); the company because the choice decides which company's books the revenue lands in.
        const price = this.productPriceLabels.get(p.ID);
        const name = price ? `${p.Name}${sku} · ${price}` : `${p.Name}${sku}`;
        return p.Company ? `${name} — ${p.Company}` : name;
    }

    /* ── The product type-ahead (golive#360) ───────────────────────────────────── */

    /** Rows the list shows at once. The catalogue runs to hundreds; past this the rep narrows by typing. */
    private static readonly PickerLimit = 50;

    /** The catalog price beside a product in the list, when orders has one. */
    public PriceLabel(p: ProductLookup): string | null {
        return this.productPriceLabels.get(p.ID) ?? null;
    }

    /** True when the product is owned by a company other than the deal's. */
    public IsForeignProduct(p: ProductLookup): boolean {
        const dealCompanyID = this.Deal?.CompanyID;
        return !!p.CompanyID && !!dealCompanyID && !UUIDsEqual(p.CompanyID, dealCompanyID);
    }

    /**
     * The warning under the box when the chosen product belongs to another company.
     *
     * Cross-company selling is allowed (#29), so this warns rather than refuses: the line's revenue books
     * to the product's company, which is easy to miss when two companies sell similar names.
     */
    public get ForeignCompanyWarning(): string | null {
        const product = this.SelectedProduct;
        if (!product || !this.IsForeignProduct(product)) return null;
        const owner = product.Company || 'another company';
        const dealCompany = this.Deal?.Company ? ` (${this.Deal.Company})` : '';
        return `Sold by ${owner}, not this deal's company${dealCompany}. This line's revenue books to ${owner}.`;
    }

    /** Opens the list on focus only when nothing is chosen yet; a chosen product opens it on click or typing. */
    public OnPickerFocus(event: FocusEvent): void {
        (event.target as HTMLInputElement | null)?.select();
        if (!this.Working?.ProductID) this.OpenPicker();
    }

    public OpenPicker(): void {
        if (this.PickerOpen) return;
        this.PickerOpen = true;
        this.rankPicker(this.Working?.ProductID ? '' : this.ProductQuery);
    }

    /** Closing without a choice puts the chosen product's label back, so the box never shows stray text. */
    public ClosePicker(): void {
        this.PickerOpen = false;
        this.ProductQuery = this.chosenProductLabel();
    }

    public OnProductQuery(text: string): void {
        this.ProductQuery = text;
        this.PickerOpen = true;
        this.rankPicker(text);
    }

    public OnPickerKey(event: KeyboardEvent): void {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!this.PickerOpen) {
                this.OpenPicker();
                return;
            }
            const last = this.PickerResults.length - 1;
            const step = event.key === 'ArrowDown' ? 1 : -1;
            this.PickerCursor = Math.max(0, Math.min(last, this.PickerCursor + step));
        } else if (event.key === 'Enter' && this.PickerOpen) {
            event.preventDefault();
            const product = this.PickerResults[this.PickerCursor];
            if (product) this.ChooseProduct(product);
        } else if (event.key === 'Escape' && this.PickerOpen) {
            // The list closes first; a second Escape reaches the dialog and cancels it.
            event.stopPropagation();
            this.ClosePicker();
        }
    }

    public ChooseProduct(product: ProductLookup, event?: Event): void {
        event?.preventDefault();
        this.PickerOpen = false;
        if (!UUIDsEqual(product.ID, this.Working?.ProductID ?? '')) {
            this.OnProductChange(product.ID);
        }
        this.ProductQuery = this.chosenProductLabel();
        this.cdr.detectChanges();
    }

    private rankPicker(query: string): void {
        const ranked = RankDealProducts(this.Products, query, this.Deal?.CompanyID ?? null);
        this.PickerResults = ranked.slice(0, MJSDealLineEditorComponent.PickerLimit);
        this.PickerHidden = ranked.length - this.PickerResults.length;
        this.PickerCursor = 0;
    }

    private chosenProductLabel(): string {
        const product = this.SelectedProduct;
        return product ? this.ProductOptionLabel(product) : '';
    }

    /**
     * The rep's price-override grant. A grant that cannot be read hides the picker rather than
     * stopping the line from opening: the picker is optional, the line is not.
     */
    private resolveOverrideKind(): PriceOverrideKind {
        try {
            return userPriceOverrideKind(Metadata.Provider.CurrentUser, Metadata.Provider);
        } catch {
            return 'none';
        }
    }

    /**
     * Each product's catalog price, as orders' catalog holds it — its active base-channel
     * `ProductPrice` rows. One row reads as its amount, several as "From" the lowest.
     *
     * READ, NOT COMPUTED: these are the catalog's own amounts, chosen between, never multiplied or
     * adjusted. A failed read only drops the prices from the labels; the picker still works.
     */
    private async loadProductPriceLabels(): Promise<void> {
        this.productPriceLabels.clear();
        if (!this.Products.length) return;
        try {
            await LoadOrdersEngine(Metadata.Provider, Metadata.Provider.CurrentUser);
            for (const p of this.Products) {
                const amounts = OrdersEngine.Instance.BaseProductPrices(p.ID)
                    .map((row) => Number(row.Amount))
                    .filter((n) => Number.isFinite(n));
                if (!amounts.length) continue;
                const lowest = Math.min(...amounts);
                const label = this.Money(lowest);
                this.productPriceLabels.set(p.ID, amounts.every((n) => n === lowest) ? label : `From ${label}`);
            }
        } catch {
            this.productPriceLabels.clear();
        }
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
        this.clearServicePeriodForProductChange(productID);
        this.Working.ProductID = productID ?? '';
        const product = this.Products.find((p) => p.ID === productID) ?? null;
        if (product) {
            this.Working.CompanyID = product.CompanyID;
        }
        // The previous product's default, named prices and subscription answer say nothing about this one.
        this.EngineDefault = undefined;
        this.Applicable = [];
        this.Working.SubscriptionAction = null;
        void this.refreshApplicable();
        void this.refreshHolding();
        this.cdr.detectChanges();
    }

    /* ── Choosing among orders' prices (golive#270) ─────────────────────────────── */

    /** Offered to a rep holding an override grant, on an open deal, once a product is chosen. */
    public get ShowPricePicker(): boolean {
        return !this.IsLocked && this.OverrideKind !== 'none' && !!this.Working?.ProductID;
    }

    /** True while the line's price is off its default — see the product select. */
    public get ProductLockedByPrice(): boolean {
        return !!this.Working && IsLinePriceOverridden(this.Working, this.EngineDefault);
    }

    /**
     * Why the product select is disabled. A line off its default price names the remedy only to a rep
     * who has the price picker; a rep without an override grant has no Default to put it back on, so
     * they are told the line carries a special price and who can change it (#408). The lock outranks
     * both, as it does in `BlockedReason`.
     */
    public get ProductSelectTitle(): string {
        if (this.IsLocked || !this.ProductLockedByPrice) return this.BlockedReason;
        if (this.ShowPricePicker) return 'Put the price back on Default before changing the product.';
        return 'This line has a special price set on the order. Someone who can override prices has to put it ' +
            'back on Default before the product can be changed.';
    }

    /** The default unit price: orders' answer when it has given one, else the unpinned priced figure. */
    public get DefaultUnit(): number | null {
        if (this.EngineDefault !== undefined) return this.EngineDefault?.UnitPrice ?? null;
        return this.ProductLockedByPrice ? null : this.DisplayUnitPrice;
    }

    /**
     * The product's applicable named prices, asked of orders with the order's own parties and date —
     * the same context the order line's picker uses, so the two list the same rules.
     */
    private async refreshApplicable(): Promise<void> {
        const line = this.Working;
        const order = this.Deal?.OrderID_Object;
        const user = Metadata.Provider.CurrentUser;
        if (!this.ShowPricePicker || !line?.ProductID || !order || !user) {
            this.Applicable = [];
            return;
        }
        // Not asked for a quantity the rep has not entered; Save is blocked until they do.
        if (this.QuantityInvalid) return;
        const productID = String(line.ProductID);
        try {
            await LoadOrdersEngine(Metadata.Provider, user);
            const product = OrdersEngine.Instance.ProductByID(productID);
            const companyID = product?.CompanyID ?? order.CompanyID;
            if (!companyID) return;
            const applicable = await ListApplicablePrices(
                {
                    ProductID: productID,
                    ProductCategoryID: product?.ProductCategoryID ?? null,
                    CompanyID: companyID,
                    Quantity: Number(line.Quantity ?? 0),
                    AsOf: AsDateValue(order.OrderDate) ?? TodayAsDateValue(),
                    OrganizationID: order.BillToOrganizationID ?? null,
                    PersonID: order.BillToPersonID ?? null,
                    ApplicabilityContext: await loadApplicabilityContext(
                        {
                            OrderHeaderID: order.IsSaved ? order.ID : null,
                            ProductID: productID,
                            BillToPersonID: order.BillToPersonID ?? null,
                            BillToOrganizationID: order.BillToOrganizationID ?? null,
                            ShipToPersonID: order.ShipToPersonID ?? null,
                            ShipToOrganizationID: order.ShipToOrganizationID ?? null,
                            BillToAddressID: order.BillToAddressID ?? null,
                            ShipToAddressID: order.ShipToAddressID ?? null,
                        },
                        Metadata.Provider,
                        user,
                    ),
                },
                Metadata.Provider,
                user,
            );
            // A reply for a product the rep has since moved off is dropped rather than shown.
            if (this.Working?.ProductID === productID) this.Applicable = applicable;
        } catch {
            this.Applicable = [];
        } finally {
            this.cdr.detectChanges();
        }
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

    /* ── A discount stated in dollars ─────────────────────────────────────────── */

    /** The unit the rep types the discount in. The line stores a percent either way. */
    public DiscountUnit: 'Percent' | 'Amount' = 'Percent';
    /** The dollar discount as typed, while the unit is Amount. Never stored: the line keeps the percent. */
    public DiscountAmountInput: number | null = null;

    public SetDiscountUnit(unit: 'Percent' | 'Amount'): void {
        if (this.IsLocked || unit === this.DiscountUnit) return;
        this.DiscountUnit = unit;
        this.DiscountRefusal = null;
        // A discounted line opens the amount box on orders' figure for its current percent.
        this.DiscountAmountInput = unit === 'Amount' && this.DiscountPercent > 0 ? this.pricedDiscount : null;
        // The conversion needs orders' list amount, so a line nobody has priced yet is priced now.
        if (unit === 'Amount' && this.pricedTotal === null) this.SchedulePrice();
    }

    public SetDiscountAmount(amount: number | null): void {
        this.DiscountAmountInput = amount === null || amount === undefined || String(amount) === '' ? null : Number(amount);
        this.applyDiscountAmount();
    }

    /**
     * Turns the typed amount into the percent the line stores, by the shared conversion. Run again
     * after each reprice, because a new quantity or product changes the list amount the dollars are a
     * share of; the dollars are what the rep stated, so they hold and the percent follows.
     */
    private applyDiscountAmount(): void {
        if (!this.Working || this.DiscountUnit !== 'Amount') return;
        const converted = DiscountAmountToPercent(this.DiscountAmountInput, this.ListAmount);
        if (!converted.Ok) {
            this.DiscountRefusal = converted.Reason;
            return;
        }
        this.DiscountRefusal = null;
        if (converted.Fraction === (this.Working.DiscountPct ?? 0)) return;
        this.Working.DiscountPct = converted.Fraction;
        this.SchedulePrice();   // a priced input changed — ask Orders again
    }

    /** The line's amount before any discount, as orders last priced it. Null until it has. */
    public get ListAmount(): number | null {
        return PricedLineListAmount(this.pricedTotal, this.pricedDiscount);
    }

    public get PricedDiscount(): number | null {
        return this.pricedDiscount;
    }

    /** Whether orders' discount differs from the typed dollars, because the percent is held to 0.01%. */
    public get DiscountAmountRounded(): boolean {
        return !this.pricePending && this.pricedDiscount !== null && this.DiscountAmountInput !== null &&
            this.pricedDiscount !== this.DiscountAmountInput;
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

    /* ── Service period on lines nothing else dates ─────────────────────────────── */

    /**
     * Whether the rep has to state this line's service period: orders' own rule, so the deal asks for
     * exactly the lines the order's Confirm refuses without one. Event and subscription lines are
     * dated by orders at confirm and are not asked.
     */
    public get ShowServicePeriod(): boolean {
        return !!this.Working?.ProductID && this.ServicePeriodSourceFor(this.Working.ProductID) === 'Line';
    }

    public ServicePeriodInput(end: 'Start' | 'End'): string | null {
        return toDateInput(end === 'Start' ? this.Working?.ServicePeriodStart : this.Working?.ServicePeriodEnd);
    }

    /** An emptied control clears that end of the window. */
    public SetServicePeriod(end: 'Start' | 'End', value: string): void {
        this.SchedulePrice();   // a priced input changed — ask Orders again
        if (!this.Working) return;
        const date = value ? new Date(`${value}T00:00:00Z`) : null;
        if (end === 'Start') this.Working.ServicePeriodStart = date;
        else this.Working.ServicePeriodEnd = date;
    }

    /** Refused at save; the line's own validation and CK_OrderLine_ServicePeriod would refuse it too. */
    public get ServicePeriodBackwards(): boolean {
        const start = this.Working?.ServicePeriodStart;
        const end = this.Working?.ServicePeriodEnd;
        return this.ShowServicePeriod && !!start && !!end && new Date(end).getTime() < new Date(start).getTime();
    }

    /** Not a save blocker: orders only needs the dates at confirm, and a deal is often quoted before they are known. */
    public get ServicePeriodMissing(): boolean {
        return this.ShowServicePeriod && (!this.Working?.ServicePeriodStart || !this.Working?.ServicePeriodEnd);
    }

    /**
     * Dates stated for the product being left say nothing about the one replacing it, so both columns
     * are cleared unless the new product can use them. Left on an event line they stop orders stamping
     * the event's dates (`applyEventServicePeriod` skips a line that already has either date), and the
     * confirm then fails for want of a service period.
     *
     * Two cases clear:
     * · Leaving a product the rep dates (`Line` source) for one that is not: the window would read as
     *   a term start on a subscription, or block an event's dates.
     * · Moving to a product in the catalogue that is not a subscription (#374): a term start cannot
     *   carry over. Leaving a subscription reports `Subscription`, not `Line`, so the first case never
     *   caught it. Both dates go, because orders' guard is `Start || End`.
     *
     * A window moving between two dated products is kept, and nothing is cleared for a product the
     * catalogue does not list, since whether it is a subscription is unknown.
     */
    private clearServicePeriodForProductChange(nextProductID: string | null): void {
        if (!this.Working) return;
        const leavingDated = this.ServicePeriodSourceFor(this.Working.ProductID) === 'Line';
        const enteringDated = this.ServicePeriodSourceFor(nextProductID) === 'Line';
        if (leavingDated && enteringDated) return;
        const next = this.Products.find((p) => p.ID === nextProductID) ?? null;
        const enteringNonSubscription = !!next && !IsSubscriptionProduct(next);
        if (!leavingDated && !enteringNonSubscription) return;
        this.Working.ServicePeriodStart = null;
        this.Working.ServicePeriodEnd = null;
    }

    /** `NotRequired` until orders' cache has loaded, which is orders' own answer for an unknown product. */
    private ServicePeriodSourceFor(productID: string | null | undefined): ServicePeriodSource {
        return productID ? OrdersEngine.Instance.ServicePeriodSource(productID) : 'NotRequired';
    }

    /* ── The customer already holds this product (golive #318) ─────────────────────── */

    /**
     * The subscription this line would extend at confirm, read with orders' rule so the deal and the
     * order screen ask about the same lines. Renewal lines and one-time products are not asked. A failed
     * read hides the question; Close Won still asks, because it reads the same rule on the server.
     */
    private async refreshHolding(): Promise<void> {
        const line = this.Working;
        const subscriber = line ? HoldingSubscriberFor(line, this.Deal?.OrderID_Object ?? null) : null;
        if (!line?.ProductID || line.RenewsSubscriptionID || !this.SelectedProduct?.SubscriptionTypeID || !subscriber) {
            this.Holding = null;
            this.cdr.detectChanges();
            return;
        }
        const productID = String(line.ProductID);
        const holding = await GetExistingHolding(productID, subscriber.OrganizationID, subscriber.PersonID);
        // A reply for a product the rep has since moved off is dropped rather than shown.
        if (this.Working?.ProductID === productID) this.Holding = holding;
        this.cdr.detectChanges();
    }

    /** Where the existing coverage ends, for the prompt: a `yyyy-MM-dd` day, displayed with `mjoDate`. */
    public get HoldingCoverageEnd(): string | null {
        return toDateInput(this.Holding?.LatestTermEnd ?? null);
    }

    /** The start an extension would get: the day after the existing coverage ends, as `yyyy-MM-dd`. */
    public get HoldingContinuationStart(): string | null {
        return toDateInput(ContinuationStartFrom(this.Holding));
    }

    /**
     * Whether Term start shows the continuation start instead of an input: "Add as next term" is
     * chosen and the start is known. Orders' `SubscriptionBehavior.Decide` starts an extension at the
     * end of the existing coverage over any stated start, so an editable date here would be ignored.
     */
    public get TermStartFollowsHolding(): boolean {
        return this.Working?.SubscriptionAction === 'ExtendExisting' && !!this.HoldingContinuationStart;
    }

    public SetSubscriptionAction(action: 'ExtendExisting' | 'CreateNew'): void {
        if (this.IsLocked || !this.Working) return;
        this.Working.SubscriptionAction = action;
    }

    /** A figure in the deal's currency, with cents (#371 items 4 and 5). */
    public Money(n: number | null | undefined): string {
        return FormatDealMoney(n, this.Deal?.CurrencyID, 'cents') || '—';
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
    private pricedDiscount: number | null = null;
    /** Set from the moment a reprice is scheduled until its answer lands, so a stale answer is not quoted. */
    private pricePending = false;
    public PricingNote: string | null = null;
    private priceTimer: ReturnType<typeof setTimeout> | null = null;

    /** Orders' answer when there is one, otherwise whatever the saved line already carries. */
    public get DisplayUnitPrice(): number | null {
        if (this.QuantityInvalid) return null;
        return this.pricedUnit ?? (this.Working?.UnitPrice as number | null | undefined) ?? null;
    }

    public get DisplayLineTotal(): number | null {
        if (this.QuantityInvalid) return null;
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
        // Back to whatever opened the dialog, if it is still on the page (#371 item 3).
        if (this.opener?.isConnected) {
            this.opener.focus();
        }
    }

    public get QuantityInvalidMessage(): string { return 'Enter a quantity greater than 0.'; }

    /**
     * Blank, zero, negative or not a number. Fractions are legal: orders stores `DECIMAL(18,4)` and
     * forbids only zero, and a deal line expresses no reversal. The input's `min` limits only the
     * spinner, so a cleared or typed value reaches here as 0 or a negative.
     */
    public get QuantityInvalid(): boolean {
        if (!this.Working) return false;
        const q = this.Working.Quantity as number | null | undefined;
        return q == null || !Number.isFinite(Number(q)) || Number(q) <= 0;
    }

    /** Quantity is a priced input, so it cannot be a plain two-way binding. */
    public SetQuantity(value: number | null): void {
        if (!this.Working) return;
        this.Working.Quantity = Number(value);
        this.SchedulePrice();
        // A named price can be banded by quantity, so the list is asked for again.
        void this.refreshApplicable();
    }

    /**
     * Debounced because a rep types: a quantity of 12 passes through 1 on its way there, and three
     * round trips to price a number nobody meant is three chances to show them a figure for it.
     */
    public SchedulePrice(): void {
        if (this.priceTimer) clearTimeout(this.priceTimer);
        this.pricePending = true;
        this.priceTimer = setTimeout(() => {
            this.priceTimer = null;
            void this.refreshPrice();
        }, 350);
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
        const order = this.Deal?.OrderID_Object;
        if (!line?.ProductID || !companyID) {
            this.pricedUnit = null;
            this.pricedTotal = null;
            this.pricedDiscount = null;
            this.EngineDefault = undefined;
            this.PricingNote = null;
            this.pricePending = false;
            this.cdr.detectChanges();
            return;
        }
        // No price for a quantity the rep did not enter: never a one-unit figure in its place.
        if (this.QuantityInvalid) {
            this.pricedUnit = null;
            this.pricedTotal = null;
            this.EngineDefault = undefined;
            this.PricingNote = this.QuantityInvalidMessage;
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
                    // The buyer and the date steer which rule is the default, so they are sent: without
                    // them the picker's Default row could name a different rule than the order's save.
                    BillToPersonID: order?.BillToPersonID ?? null,
                    BillToOrganizationID: order?.BillToOrganizationID ?? null,
                    OrderDate: this.IsoOrNull(order?.OrderDate),
                    Lines: [{
                        ProductID: String(line.ProductID),
                        Quantity: Number(line.Quantity),
                        // A picked price PINS the line, as it will on the order's save; otherwise orders
                        // resolves it.
                        UnitPrice: IsLinePriceOverridden(line, this.EngineDefault) ? Number(line.UnitPrice) : null,
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
                this.pricedDiscount = null;
                this.EngineDefault = undefined;
                this.PricingNote = 'Orders could not price this line yet. It is priced on save.';
                return;
            }
            this.pricedUnit = row.UnitPrice;
            this.pricedTotal = row.LineTotalNet;
            this.pricedDiscount = row.DiscountAmount ?? 0;
            this.EngineDefault = row.Default;
            this.applyDiscountAmount();
        } catch {
            this.pricedUnit = null;
            this.pricedTotal = null;
            this.pricedDiscount = null;
            this.EngineDefault = undefined;
            this.PricingNote = 'Orders could not price this line yet. It is priced on save.';
        } finally {
            this.Pricing = false;
            // A reprice scheduled while this one was in flight is still pending.
            this.pricePending = this.priceTimer !== null;
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
        return (
            !!this.Working?.ProductID &&
            !this.QuantityInvalid &&
            !this.DiscountRefusal &&
            !!this.Deal?.OrderID_Object &&
            !LineNeedsOverrideReason(this.Working, this.EngineDefault) &&
            !this.MissingDiscountReason &&
            !this.ServicePeriodBackwards
        );
    }

    /** Whether the discount went up since the line was saved, so it needs a concession behind it. */
    public get NeedsDiscountReason(): boolean {
        return !!this.Working && DiscountNeedsConcession(this.savedDiscountPct, this.Working.DiscountPct);
    }

    /** Orders' concession reason categories, read from its entity metadata when first shown. */
    public get ReasonCategories(): DiscountReasonCategory[] {
        this.reasonCategories ??= DiscountReasonCategories();
        return this.reasonCategories;
    }

    private get MissingDiscountReason(): boolean {
        return this.NeedsDiscountReason && (!this.DiscountCategory || !this.DiscountReason.trim());
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
        if (this.QuantityInvalid) return this.QuantityInvalidMessage;
        if (LineNeedsOverrideReason(this.Working, this.EngineDefault)) return 'Enter a reason for the price override.';
        if (this.MissingDiscountReason) return 'Choose a category and enter a reason for the discount.';
        if (this.ServicePeriodBackwards) return 'Set a service end on or after the service start.';
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
        return !!this.LineID && !this.IsLocked && !!this.Deal?.OrderID_Object && !this.Notice;
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
     * it. Sales carried a blanket refusal for that (`ShouldRefuseLineRemoval`, deleted with the deal
     * workspace in #291). The orders fix landed with golive#187, and `save-deal.SD6` is the tripwire that said
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
            const notice = await this.recordDiscountConcession();
            if (notice) {
                // The line IS saved. Hold the dialog open on what happens next; Done reports the save.
                this.Notice = notice;
                return;
            }
            this.Saved.emit();
        } catch (err) {
            this.Error = err instanceof Error ? err.message : String(err);
        } finally {
            this.Saving = false;
            this.cdr.detectChanges();
        }
    }

    /**
     * Records a raised discount as the Price concession orders' confirm gate holds on. Runs after the
     * order's save, because a concession names a persisted line and orders values it from what that
     * line stores. Returns what the rep must be told, or null when the discount was approved.
     */
    private async recordDiscountConcession(): Promise<string | null> {
        if (!this.Working || !this.NeedsDiscountReason || !this.DiscountCategory) return null;
        const outcome = await RecordDiscountConcession({
            OrderLineID: this.Working.ID,
            ReasonCategory: this.DiscountCategory,
            Reason: this.DiscountReason,
        });
        this.savedDiscountPct = this.Working.DiscountPct ?? null;
        if (!outcome.Recorded) {
            return (
                `The line is saved, but its discount could not be recorded for approval: ${outcome.Message} ` +
                `The order cannot be confirmed until a concession covering the discount is approved.`
            );
        }
        if (outcome.AwaitingApproval) {
            return (
                'The line is saved. Its discount is outside your Sales Authority and is waiting for approval; ' +
                'the order cannot be confirmed until it is approved.'
            );
        }
        return null;
    }

    /**
     * Cancelling a NEW line must take it back off the collection.
     *
     * `Create()` appended it, so simply closing the dialog would leave an unsaved, product-less line
     * attached to the order — and the next save of that order would try to write it. `Remove()` is the
     * collection's own withdrawal (never a splice), which is what the workspace uses for the same
     * reason.
     *
     * Cancelling an EXISTING line must undo its edit. `Working` is the live line in the order's
     * collection, not a copy, and MJ rolls a dirty embedded line up into the deal's `Dirty`; left as
     * it was, the deal's next save would write the cancelled values to the order. `Revert()` puts
     * every field back to its last-saved value, which also covers a refused save followed by Cancel.
     *
     * A `Notice` means the line IS saved and the dialog is only holding open on what happens next, so
     * every close (X, scrim) reports the save as Done does: the panel refreshes its cards and the
     * deal's Amount. Checked first, so a saved line is never reverted.
     */
    public Cancel(): void {
        if (this.Notice) {
            this.Saved.emit();
            return;
        }
        if (this.Working) {
            if (this.IsNewLine) {
                this.Deal?.OrderID_Object?.Lines.Remove(this.Working);
                this.IsNewLine = false;
            } else {
                this.Working.Revert();
            }
        }
        this.DiscountCategory = null;
        this.DiscountReason = '';
        this.DiscountRefusal = null;
        this.Closed.emit();
    }
}
