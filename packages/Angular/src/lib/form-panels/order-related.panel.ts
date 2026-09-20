/**
 * @fileoverview The provenance row on the ORDER form — where this order came from.
 *
 * Pattern 1 (`BaseFormPanel` in `before-fields`), contributed onto an entity this app does not own,
 * exactly as `party-deals.panels.ts` contributes Deals onto Common's Person and Organization forms.
 * The orders repo is not modified and does not learn that sales exists; `mj-app.json` has the
 * dependency running the other way and it stays that way.
 *
 * WHERE IT LANDS, AND WHY NOT INSIDE THE HERO. `order-header-form.component.html` is a full custom
 * form, and the slots it offers are `before-fields`, `after-fields`, `after-related` and
 * `after-everything`. `before-fields` is emitted first, above the order's own hero card, so this row
 * reads as the line above the header rather than a panel further down the page. Putting chips INSIDE
 * that hero would mean either editing the orders template — inverting the dependency — or adding a
 * slot name to MJ for one app's header. The row above the hero costs neither.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { ChangeDetectorRef, Component, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Metadata, RunView, type IMetadataProvider } from '@memberjunction/core';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel } from '@memberjunction/ng-base-forms';
import { RelatedChipsComponent, type BizAppsRelatedLink } from '@mj-biz-apps/common-ng';
import type { mjBizAppsOrdersOrderHeaderEntity } from '@mj-biz-apps/orders-entities';
import { MJS_ENTITIES, MJS_FOREIGN_ENTITIES } from '../data/entity-names';
import { OrderRelatedLinks, OrderRelatedLinksKey, type OrderRelatedLinkState } from './order-related-links';

/** The one row this panel reads: the deal that names this order, and the contract it points at. */
interface DealProvenanceRow {
    ID: string;
    ContractID: string | null;
}

/** Single-quote escaping for a value going into an `ExtraFilter`, as every other filter here does. */
function quote(value: string): string {
    return value.replace(/'/g, "''");
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:order-related',
    skipNullKeyWarning: true,
    metadata: {
        entity: MJS_FOREIGN_ENTITIES.OrderHeader,
        slot: 'before-fields',
        sortKey: 100,
        contributionKey: 'provenance',
    },
})
@Component({
    selector: 'mjs-order-related-panel',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, RelatedChipsComponent],
    template: `
        @if (Links.length > 0) {
            <div class="mjs-order-related">
                <span class="mjs-order-related__lead">From</span>
                <bizapps-related-chips
                    [Links]="Links"
                    [Provider]="Provider"
                    (Navigate)="FormComponent.OnFormNavigate($event)" />
            </div>
        }
    `,
    styles: [
        `
            /* A LINE, NOT A CARD. The order's own hero sits directly below this and is a bordered,
               shadowed card; a second card above it would read as a competing header rather than as
               the sentence that introduces one. Hence no background and no border — the chips carry
               their own, from the shared component. */
            .mjs-order-related {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: var(--mj-space-2);
                margin-bottom: var(--mj-space-3);
            }
            .mjs-order-related__lead {
                font-size: var(--mj-text-xs);
                font-weight: 700;
                letter-spacing: 0.04em;
                text-transform: uppercase;
                color: var(--mj-text-muted);
            }
        `,
    ],
})
export class MJSOrderRelatedPanel extends BaseFormPanel<mjBizAppsOrdersOrderHeaderEntity> {
    private readonly cdr = inject(ChangeDetectorRef);

    /**
     * The links currently published to the chip row.
     *
     * A FIELD RATHER THAN A GETTER, and assigned only when {@link OrderRelatedLinksKey} moves. The
     * chip row treats a new array reference as "these are different links", clearing what is on
     * screen and reading again; a getter that built an array per change-detection pass would put it
     * in a permanent re-read loop, and one that rebuilt on every refresh would blank the row for no
     * visible change.
     */
    public Links: BizAppsRelatedLink[] = [];

    /** The key the published links were built from. `null` until the first read completes. */
    private linksFor: string | null = null;

    /**
     * Guards against a slower read for a PREVIOUS order landing after the form moved on — a form
     * container reusing this instance across records is the ordinary way that happens.
     */
    private generation = 0;

    /**
     * Read through the form's provider, so the chips resolve against the same database the order
     * came from. The chip row takes this too; in a host with more than one provider the ambient
     * fallback reads the wrong database, and a wrong database here is a wrong ANSWER, not an error.
     */
    public get Provider(): IMetadataProvider {
        return this.FormComponent?.ProviderToUse ?? Metadata.Provider;
    }

    public ngOnInit(): void {
        void this.load();
    }

    public override OnRecordRefreshed(_record: mjBizAppsOrdersOrderHeaderEntity): void {
        void this.load();
    }

    /**
     * Resolve the deal behind this order, and through it the contract.
     *
     * ONE READ, NOT TWO. The chip row can find a record from a filter as happily as from an id — the
     * reverse link is why `BizAppsRelatedLink.Filter` exists — so the deal chip alone would need no
     * read here at all. The CONTRACT is what forces one: its id lives on the deal row, a second hop
     * the chip row cannot take on the caller's behalf, and the only alternative would be a filter
     * carrying a subquery across into the sales schema. So the deal is read once, for the two ids,
     * and both chips are then ordinary forward links.
     *
     * A THROWN READ PUBLISHES NOTHING, which is the same answer the shared component gives a reverse
     * link that threw, and for the same reason: the throw cost us the ids, so there is nothing left
     * to open. An order whose deal simply does not exist takes the same path, one line earlier.
     */
    private async load(): Promise<void> {
        const generation = ++this.generation;
        const orderID = this.Record?.ID;
        if (!orderID) {
            this.publish(generation, null, {});
            return;
        }

        let state: OrderRelatedLinkState = {};
        try {
            const result = await RunView.FromMetadataProvider(this.Provider).RunView<DealProvenanceRow>({
                EntityName: MJS_ENTITIES.Deal,
                Fields: ['ID', 'ContractID'],
                ExtraFilter: `OrderID = '${quote(String(orderID))}'`,
                // `Deal.OrderID` is documented as a 1:1 peer, but this is a REVERSE read and nothing in
                // the schema enforces the one. Ordering makes the row that wins the same row on every
                // render rather than whichever the server happened to return first.
                OrderBy: '__mj_CreatedAt ASC',
                MaxRows: 1,
                ResultType: 'simple',
            });
            const row = result?.Success ? result.Results?.[0] : undefined;
            if (row) {
                state = { DealID: row.ID, ContractID: row.ContractID };
            }
        } catch {
            state = {};
        }

        this.publish(generation, orderID, state);
    }

    /** Publish only when this read is still the current one AND the links would actually differ. */
    private publish(generation: number, orderID: string | null, state: OrderRelatedLinkState): void {
        if (this.generation !== generation) {
            return;
        }
        const key = OrderRelatedLinksKey(orderID, state);
        if (this.linksFor === key) {
            return;
        }
        this.linksFor = key;
        this.Links = OrderRelatedLinks(state);
        this.cdr.detectChanges();
    }
}
