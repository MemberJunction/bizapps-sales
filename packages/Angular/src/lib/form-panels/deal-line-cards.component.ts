/**
 * @fileoverview The deal form's "What's being sold" list: one card per order line, laid out like the
 * order form's line cards in bizapps-orders, so a rep and an order clerk read the same line the same way.
 *
 * ── WHY CARDS AND NOT THE GRID ──────────────────────────────────────────────────────────────────────
 *
 * The panel was an `mj-explorer-entity-data-grid` over `OrderLine` with four columns. A grid shows the
 * stored figures and nothing about them: not the SKU or type that tell two same-named products apart,
 * not whether a price was overridden or a discount requested, not which company's books the revenue
 * lands in, not a subscription's term start. Those are the facts a rep is asked about in a deal review,
 * and the order form already shows them on each line card.
 *
 * ── WHAT IT READS, AND WHAT IT NEVER DOES ───────────────────────────────────────────────────────────
 *
 * Every figure is orders' own stored field, displayed as stored (rule 1): unit price, line total and
 * the discount fraction, which is shown as a percent only through `DiscountFractionToPercent`. Nothing
 * here multiplies, sums or rounds money. Editing still goes through the restricted line editor
 * (`mjs-deal-line-editor`): this list only says which line to open.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RunView } from '@memberjunction/core';
import { EscapeSQLString } from '@memberjunction/global';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { MJOConsequenceChipComponent, MJODatePipe } from '@mj-biz-apps/orders-ng';
import {
    DiscountFractionToPercent,
    E_ORDERS_PRODUCT,
    EffectiveTermStart,
    HasExplicitTermStart,
    type DealEntity,
} from '@mj-biz-apps/sales-entities';
import { MJS_FOREIGN_ENTITIES } from '../data/entity-names';
import { FormatDealMoney } from './deal-money';

/** The order line columns a card reads. Virtual name fields (`Product`, `Company`, `ProductPrice`) come with the view. */
const LINE_FIELDS = [
    'ID',
    'ProductID',
    'Product',
    'CompanyID',
    'Company',
    'Quantity',
    'UnitPrice',
    'LineTotalNet',
    'DiscountPct',
    'PriceOverridden',
    'PriceOverrideReason',
    'ProductPrice',
    'ServicePeriodStart',
] as const;

/** One order line, as the card shows it. */
export interface DealLineCardRow {
    ID: string;
    ProductID: string;
    Product: string | null;
    CompanyID: string;
    Company: string | null;
    Quantity: number;
    UnitPrice: number | null;
    LineTotalNet: number | null;
    DiscountPct: number | null;
    PriceOverridden: boolean;
    PriceOverrideReason: string | null;
    ProductPrice: string | null;
    ServicePeriodStart: string | null;
}

/** The product facts a card shows beside the line. */
export interface DealLineCardProduct {
    ID: string;
    SKU: string | null;
    ProductType: string | null;
    IsTaxable: boolean | null;
    SubscriptionTypeID: string | null;
}

/** `yyyy-MM-dd` from whatever a date field arrived as, for `mjoDate`. */
function DayOf(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const day = String(value).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

@Component({
    selector: 'mjs-deal-line-cards',
    standalone: true,
    imports: [CommonModule, SharedGenericModule, MJOConsequenceChipComponent, MJODatePipe],
    template: `
        <div class="mjs-lc" data-testid="deal-lines">
            @if (Loading && Lines.length === 0) {
                <mj-loading text="Loading products…" size="small"></mj-loading>
            } @else if (Error) {
                <p class="mjs-lc__error" role="alert">{{ Error }}</p>
            } @else {
                @for (line of Lines; track line.ID) {
                    <div class="mjs-lc-card" data-testid="deal-line" [class.is-editable]="!Locked"
                        (dblclick)="OpenLine(line)">
                        <div class="mjs-lc-card__top">
                            <div class="mjs-lc-card__id">
                                <div class="mjs-lc-card__name">{{ line.Product || 'Product' }}</div>
                                <div class="mjs-lc-card__meta">{{ MetaFor(line) }}</div>
                            </div>

                            <!-- Visible captions (#371 item 9): three bare figures in a row did not say
                                 which was the quantity, the unit price or the total. -->
                            <div class="mjs-lc-card__qtycol">
                                <span class="mjs-lc-cap">Qty</span>
                                <div class="mjs-lc-qty">{{ line.Quantity }}</div>
                            </div>

                            <div class="mjs-lc-card__price">
                                <span class="mjs-lc-cap">Unit price</span>
                                <div class="mjs-lc-card__amt">{{ Money(line.UnitPrice) }}</div>
                                @if (line.PriceOverridden) {
                                    <span class="mjs-lc-pill is-override">overridden</span>
                                } @else if (line.ProductPrice) {
                                    <span class="mjs-lc-source" title="Priced from {{ line.ProductPrice }}">
                                        <i class="fa-solid fa-tag" aria-hidden="true"></i> {{ line.ProductPrice }}
                                    </span>
                                }
                                @if (DiscountPercent(line); as pct) {
                                    <span class="mjs-lc-pill is-discount" title="Requested discount on this line">−{{ pct }}%</span>
                                }
                            </div>

                            <div class="mjs-lc-card__tot">
                                <span class="mjs-lc-cap">Total</span>
                                <div>{{ Money(line.LineTotalNet) }}</div>
                            </div>

                            @if (!Locked) {
                                <button type="button" class="mjs-lc-iconbtn" data-testid="line-edit"
                                    (click)="OpenLine(line)" [attr.aria-label]="'Edit ' + (line.Product || 'line')">
                                    <i class="fa-solid fa-pencil" aria-hidden="true"></i>
                                </button>
                            }
                        </div>

                        @if (HasChips(line)) {
                            <div class="mjs-lc-card__chips">
                                @if (IsUntaxable(line)) {
                                    <mjo-consequence-chip Kind="untaxable">Untaxable</mjo-consequence-chip>
                                }
                                @if (BooksElsewhere(line)) {
                                    <mjo-consequence-chip Kind="company">Revenue to {{ line.Company }}</mjo-consequence-chip>
                                }
                            </div>
                        }

                        @if (line.PriceOverridden && line.PriceOverrideReason) {
                            <div class="mjs-lc-card__why">{{ line.PriceOverrideReason }}</div>
                        }

                        @if (ShowsTermStart(line)) {
                            <div class="mjs-lc-term">
                                <span class="mjs-lc-term__label">Term start</span>
                                <span class="mjs-lc-term__value">{{ (TermStartDay(line) | mjoDate) || 'With the order date' }}</span>
                                <span class="mjs-lc-term__hint">
                                    @if (HasOwnTermStart(line)) {
                                        Stated on this line, so a later change to the order date leaves it alone.
                                    } @else {
                                        Following the order date.
                                    }
                                </span>
                            </div>
                        }
                    </div>
                } @empty {
                    <div class="mjs-lc-empty">
                        <i class="fa-solid fa-cart-plus" aria-hidden="true"></i>
                        <div class="mjs-lc-empty__title">Nothing on this deal yet</div>
                        @if (!Locked) {
                            <div>Add a product to start pricing it.</div>
                        }
                    </div>
                }
            }

            @if (!Locked) {
                <button type="button" class="mjs-lc-add" data-testid="lines-add" (click)="Add.emit()">
                    <i class="fa-solid fa-plus" aria-hidden="true"></i> Add a product
                </button>
            }
        </div>
    `,
    styles: [`
        :host { display: block; }
        .mjs-lc { display: flex; flex-direction: column; gap: var(--mj-space-2); padding: var(--mj-space-3) var(--mj-space-5) var(--mj-space-4); }
        .mjs-lc__error { margin: 0; color: var(--mj-status-error-text); }

        .mjs-lc-card {
            border: 1px solid var(--mj-border-default); background: var(--mj-bg-surface);
            border-radius: var(--mj-radius-md); padding: var(--mj-space-3);
        }
        .mjs-lc-card.is-editable:hover { border-color: var(--mj-border-strong); }
        .mjs-lc-card__top { display: flex; align-items: flex-start; gap: var(--mj-space-3); }
        .mjs-lc-card__id { flex: 1; min-width: 0; }
        .mjs-lc-card__name { font-size: var(--mj-text-sm); font-weight: var(--mj-font-semibold); color: var(--mj-text-primary); }
        .mjs-lc-card__meta { font-size: var(--mj-text-xs); color: var(--mj-text-muted); margin-top: 2px; }

        .mjs-lc-qty {
            flex: none; min-width: 46px; height: 28px; padding: 0 10px;
            display: inline-flex; align-items: center; justify-content: center;
            border: 1px solid var(--mj-border-default); border-radius: var(--mj-radius-md);
            font-variant-numeric: tabular-nums;
        }

        .mjs-lc-card__price { flex: none; min-width: 108px; display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .mjs-lc-card__amt, .mjs-lc-card__tot {
            font-variant-numeric: tabular-nums; font-weight: var(--mj-font-semibold);
            font-size: var(--mj-text-sm); line-height: 28px;
        }
        .mjs-lc-card__tot { flex: none; min-width: 104px; text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
        .mjs-lc-card__qtycol { flex: none; display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .mjs-lc-cap {
            font-size: 10.5px; font-weight: var(--mj-font-semibold); line-height: 1.2;
            color: var(--mj-text-muted); white-space: nowrap;
        }
        .mjs-lc-source { font-size: 10.5px; color: var(--mj-text-muted); white-space: nowrap; }
        .mjs-lc-pill { padding: 1px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; letter-spacing: 0.02em; }
        .mjs-lc-pill.is-override { color: var(--mj-status-warning-text); background: color-mix(in srgb, var(--mj-status-warning-text) 16%, transparent); }
        .mjs-lc-pill.is-discount { color: var(--mj-status-info-text); background: color-mix(in srgb, var(--mj-status-info-text) 16%, transparent); }

        .mjs-lc-iconbtn {
            flex: none; width: 28px; height: 28px; border: 0; border-radius: var(--mj-radius-sm);
            background: transparent; color: var(--mj-text-muted); cursor: pointer;
        }
        .mjs-lc-iconbtn:hover { background: var(--mj-bg-surface-hover); color: var(--mj-text-link); }

        .mjs-lc-card__chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: var(--mj-space-2); }
        .mjs-lc-card__why { margin-top: 6px; font-size: var(--mj-text-xs); color: var(--mj-text-secondary); line-height: 1.35; }

        .mjs-lc-term { display: flex; align-items: center; gap: var(--mj-space-2); flex-wrap: wrap; margin-top: var(--mj-space-2); }
        .mjs-lc-term__label, .mjs-lc-term__hint { font-size: var(--mj-text-xs); color: var(--mj-text-muted); }
        .mjs-lc-term__value { font-size: var(--mj-text-sm); color: var(--mj-text-primary); font-variant-numeric: tabular-nums; }

        .mjs-lc-empty {
            display: flex; flex-direction: column; align-items: center; gap: var(--mj-space-1);
            padding: var(--mj-space-4) var(--mj-space-3); color: var(--mj-text-muted);
            font-size: var(--mj-text-sm); text-align: center;
        }
        .mjs-lc-empty i { font-size: var(--mj-text-2xl); color: var(--mj-brand-primary); }
        .mjs-lc-empty__title { font-weight: var(--mj-font-semibold); color: var(--mj-text-primary); }

        .mjs-lc-add {
            display: flex; align-items: center; gap: 8px; width: 100%;
            padding: var(--mj-space-2) var(--mj-space-3); cursor: pointer;
            border: 1px dashed var(--mj-border-strong); border-radius: var(--mj-radius-md);
            background: transparent; color: var(--mj-text-secondary); font: inherit; font-size: var(--mj-text-sm);
        }
        .mjs-lc-add:hover { border-color: var(--mj-brand-primary); color: var(--mj-text-primary); background: var(--mj-bg-surface-hover); }
    `],
})
export class MJSDealLineCardsComponent implements OnChanges {
    private readonly cdr = inject(ChangeDetectorRef);

    /** The deal whose order's lines are listed. */
    @Input() Deal: DealEntity | null = null;
    /** A locked deal shows its lines and offers no way to change them. */
    @Input() Locked = false;

    /** The rep asked to add a product. */
    @Output() Add = new EventEmitter<void>();
    /** The rep asked to edit a line; carries its ID. */
    @Output() Edit = new EventEmitter<string>();
    /** How many lines the order holds, after each load, for the panel's badge. */
    @Output() Loaded = new EventEmitter<number>();

    public Lines: DealLineCardRow[] = [];
    public Loading = false;
    public Error: string | null = null;
    private products = new Map<string, DealLineCardProduct>();
    private loadedOrderID: string | null = null;

    public ngOnChanges(changes: SimpleChanges): void {
        if (changes['Deal'] && this.Deal?.OrderID !== this.loadedOrderID) {
            void this.Refresh();
        }
    }

    /** Re-reads the order's lines and their products. Called on load and after the editor saves. */
    public async Refresh(): Promise<void> {
        const orderID = this.Deal?.OrderID ?? null;
        this.loadedOrderID = orderID;
        if (!orderID) {
            this.setLines([], new Map());
            return;
        }
        this.Loading = true;
        this.Error = null;
        this.cdr.detectChanges();
        try {
            const lines = await this.loadLines(orderID);
            const products = await this.loadProducts(lines);
            if (this.loadedOrderID === orderID) this.setLines(lines, products);
        } catch (e) {
            this.Error = `The products on this deal could not be loaded: ${e instanceof Error ? e.message : String(e)}`;
        } finally {
            this.Loading = false;
            this.cdr.detectChanges();
        }
    }

    private setLines(lines: DealLineCardRow[], products: Map<string, DealLineCardProduct>): void {
        this.Lines = lines;
        this.products = products;
        this.Loaded.emit(lines.length);
    }

    /** In `LineNumber` order: orders stamps it, so it is the order the order itself keeps the lines in. */
    private async loadLines(orderID: string): Promise<DealLineCardRow[]> {
        const result = await new RunView().RunView<DealLineCardRow>({
            EntityName: MJS_FOREIGN_ENTITIES.OrderLine,
            ExtraFilter: `OrderHeaderID = '${EscapeSQLString(orderID)}'`,
            OrderBy: 'LineNumber',
            ResultType: 'simple',
            Fields: [...LINE_FIELDS],
        });
        if (!result.Success) throw new Error(result.ErrorMessage || 'the order lines could not be read');
        return result.Results ?? [];
    }

    /** The products behind the lines, for SKU, type, taxability and whether each is a subscription. */
    private async loadProducts(lines: DealLineCardRow[]): Promise<Map<string, DealLineCardProduct>> {
        const ids = [...new Set(lines.map((l) => l.ProductID).filter(Boolean))];
        if (ids.length === 0) return new Map();
        const result = await new RunView().RunView<DealLineCardProduct>({
            EntityName: E_ORDERS_PRODUCT,
            ExtraFilter: `ID IN (${ids.map((id) => `'${EscapeSQLString(id)}'`).join(',')})`,
            ResultType: 'simple',
            Fields: ['ID', 'SKU', 'ProductType', 'IsTaxable', 'SubscriptionTypeID'],
        });
        // A failed product read costs the card its SKU line and chips, not its line.
        const rows = result.Success ? (result.Results ?? []) : [];
        return new Map(rows.map((p) => [p.ID, p]));
    }

    /** A stored line figure in the deal's currency, with cents (#371 items 4 and 5). */
    public Money(amount: number | null): string {
        return FormatDealMoney(amount, this.Deal?.CurrencyID, 'cents') || '—';
    }

    public OpenLine(line: DealLineCardRow): void {
        if (!this.Locked) this.Edit.emit(line.ID);
    }

    public ProductFor(line: DealLineCardRow): DealLineCardProduct | null {
        return this.products.get(line.ProductID) ?? null;
    }

    /** "SKU · Type", leaving out whichever the product does not carry. */
    public MetaFor(line: DealLineCardRow): string {
        const p = this.ProductFor(line);
        return [p?.SKU, p?.ProductType].filter((v) => !!v).join(' · ');
    }

    /** The stored fraction as the percent a rep entered; null when there is none, so the pill hides. */
    public DiscountPercent(line: DealLineCardRow): number | null {
        const pct = DiscountFractionToPercent(line.DiscountPct);
        return pct > 0 ? pct : null;
    }

    /** Unset counts as untaxable, as it does on the order form's cards. Unknown product: no claim either way. */
    public IsUntaxable(line: DealLineCardRow): boolean {
        const p = this.ProductFor(line);
        return !!p && !p.IsTaxable;
    }

    /** The line books to a company other than the deal's own: compared by ID, never by name. */
    public BooksElsewhere(line: DealLineCardRow): boolean {
        return !!this.Deal?.CompanyID && !!line.CompanyID && line.CompanyID !== this.Deal.CompanyID;
    }

    public HasChips(line: DealLineCardRow): boolean {
        return this.IsUntaxable(line) || this.BooksElsewhere(line);
    }

    /**
     * Subscription lines only, as on the order form. Narrower than the editor's `ShouldOfferTermStart`,
     * which also offers it whenever a date is stored: an event line stores its event's dates there, and
     * calling those a term start would misdescribe the line.
     */
    public ShowsTermStart(line: DealLineCardRow): boolean {
        return !!this.ProductFor(line)?.SubscriptionTypeID;
    }

    public HasOwnTermStart(line: DealLineCardRow): boolean {
        return HasExplicitTermStart(line.ServicePeriodStart);
    }

    public TermStartDay(line: DealLineCardRow): string | null {
        return DayOf(EffectiveTermStart(line.ServicePeriodStart, this.Deal?.OrderID_Object?.OrderDate ?? null));
    }
}
