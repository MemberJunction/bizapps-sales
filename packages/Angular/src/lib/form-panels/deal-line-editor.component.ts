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
 * Unit price and line total are READ-ONLY displays, priced by orders. A discount is expressed as a
 * PERCENT and never as an amount (D-DL2 — `DiscountAmount` is an input channel that reads 0 exactly
 * when a percentage discount exists, so showing it would be a lie). Nothing here multiplies, discounts,
 * prorates, sums or rounds: the read-only figures are whatever orders last wrote.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Metadata } from '@memberjunction/core';
import type { mjBizAppsOrdersOrderLineEntity as OrderLineEntity } from '@mj-biz-apps/orders-entities';
import {
    DiscountFractionToPercent,
    DiscountPercentToFraction,
    EffectiveTermStart,
    HasExplicitTermStart as StoresOwnTermStart,
    RoundDiscountPercent,
    ShouldOfferTermStart,
    type ProductLookup,
} from '@mj-biz-apps/sales-entities';
import { DealWorkspaceService } from '../workspace/deal-workspace.service';
import { MJS_FOREIGN_ENTITIES } from '../data/entity-names';

/** `<input type="date">` wants `yyyy-MM-dd`, and nothing else renders. */
function toDateInput(d: Date | string | null | undefined): string | null {
    if (!d) return null;
    const iso = d instanceof Date
        ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
        : String(d).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
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
                        <!-- Filtered to Active and today's availability window by ProductFilterFor, and
                             NOT filtered by company: a deal may sell any company's product, and the LINE
                             takes its company from whichever is chosen. Each option names its owner
                             because two companies can both sell an "Onboarding Fee". -->
                        <select [ngModel]="Working.ProductID" (ngModelChange)="OnProductChange($event)">
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
                            <input type="number" min="1" step="1" [(ngModel)]="Working.Quantity" />
                        </label>

                        <label class="mjs-le__field">
                            <span class="mjs-le__label">Discount %</span>
                            <!-- Percent in, FRACTION stored. step is 0.01 because that is what
                                 OrderLine.DiscountPct DECIMAL(7,4) holds: a hundredth of one percent.
                                 The conversion refuses an ambiguous value rather than guessing. -->
                            <input type="number" min="0" max="100" step="0.01"
                                   [ngModel]="DiscountPercent" (ngModelChange)="SetDiscountPercent($event)" />
                            @if (DiscountRefusal) {
                                <span class="mjs-le__error">{{ DiscountRefusal }}</span>
                            }
                        </label>
                    </div>

                    @if (ShowTermStart) {
                        <label class="mjs-le__field">
                            <span class="mjs-le__label">Term start</span>
                            <input type="date" [ngModel]="TermStartInput" (ngModelChange)="SetTermStart($event)" />
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
                            <span class="mjs-le__ro-val">{{ Money(Working.UnitPrice) }}</span>
                        </div>
                        <div>
                            <span class="mjs-le__label">Line total</span>
                            <span class="mjs-le__ro-val">{{ Money(Working.LineTotalNet) }}</span>
                        </div>
                        <p class="mjs-le__muted">
                            Priced by Orders. Change the price with a discount — it is recorded as one.
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
        @media (max-width: 480px) {
            .mjs-le__row { flex-direction: column; }
        }
    `],
})
export class MJSDealLineEditorComponent implements OnInit {
    /** The order the line belongs to. Set on a new line and never shown — it comes from the deal. */
    @Input() OrderID: string | null = null;
    /** The order's date, which a term start defaults to when the line stores none of its own. */
    @Input() OrderDate: Date | string | null = null;
    /** The line to edit. Null opens a new one. */
    @Input() LineID: string | null = null;

    /** Emitted after a successful save, so the panel can refresh its grid. */
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

    public get Title(): string { return this.LineID ? 'Edit line' : 'Add a product'; }

    public async ngOnInit(): Promise<void> {
        try {
            this.Products = await this.service.LoadProducts();
            const md = new Metadata();
            const line = await md.GetEntityObject<OrderLineEntity>(MJS_FOREIGN_ENTITIES.OrderLine);
            if (this.LineID) {
                const loaded = await line.Load(this.LineID);
                if (!loaded) {
                    this.Error = 'This line could not be loaded.';
                    this.Working = null;
                    return;
                }
            } else {
                line.NewRecord();
                line.OrderHeaderID = this.OrderID ?? '';
                // Orders' CK_OrderLine_Quantity forbids zero, so a new line starts at the smallest
                // legal value rather than at the one the database refuses.
                line.Quantity = 1;
            }
            this.Working = line;
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
        return toDateInput(EffectiveTermStart(this.Working?.ServicePeriodStart, this.OrderDate));
    }

    public get HasExplicitTermStart(): boolean {
        return StoresOwnTermStart(this.Working?.ServicePeriodStart);
    }

    public SetTermStart(value: string): void {
        if (!this.Working) return;
        // An emptied control means "use the order date", which is NULL in the column -- not the epoch.
        this.Working.ServicePeriodStart = value ? new Date(`${value}T00:00:00Z`) : null;
    }

    public Money(n: number | null | undefined): string {
        if (n == null || !Number.isFinite(Number(n))) return '—';
        return Number(n).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
    }

    public get CanSave(): boolean {
        return !!this.Working?.ProductID && !this.DiscountRefusal && !!this.OrderID;
    }

    /** Why Save is disabled, in the words a rep needs. */
    public get BlockedReason(): string {
        if (!this.OrderID) return 'Save the deal first — a product line needs its order.';
        if (!this.Working?.ProductID) return 'Choose a product.';
        return this.DiscountRefusal ?? '';
    }

    public async Save(): Promise<void> {
        if (!this.Working || !this.CanSave) return;
        this.Saving = true;
        this.Error = null;
        this.cdr.detectChanges();
        try {
            const ok = await this.Working.Save();
            if (!ok) {
                // `Save()` returns false rather than throwing, so a missing check here would close the
                // dialog on a line that was never written.
                this.Error = this.Working.LatestResult?.Message || 'The line could not be saved.';
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

    public Cancel(): void {
        this.Closed.emit();
    }
}
