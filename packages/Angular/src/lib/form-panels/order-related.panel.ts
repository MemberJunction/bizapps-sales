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
import { EscapeSQLString, RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel } from '@memberjunction/ng-base-forms';
import {
    RelatedChipNavigation,
    RelatedChipsComponent,
    type BizAppsRelatedLink,
    type ResolvedRelatedChip,
} from '@mj-biz-apps/common-ng';
import type { mjBizAppsOrdersOrderHeaderEntity } from '@mj-biz-apps/orders-entities';
import { MJS_ENTITIES, MJS_FOREIGN_ENTITIES } from '../data/entity-names';
import {
    ContractFileLinksFilter,
    ContractLookupFilter,
    DealLookupOrderID,
    ExecutedAgreementFileFilter,
    OrderContractChips,
    OrderRelatedLinks,
    OrderRelatedLinksKey,
    ShouldReadAgreement,
    type OrderAgreementFile,
    type OrderContractRow,
    type OrderContractView,
    type OrderRelatedLinkState,
} from './order-related-links';

/** The one row this panel reads: the deal that names this order, its contract id and its status type. */
interface DealProvenanceRow {
    ID: string;
    ContractID: string | null;
    DealStatusTypeID: string | null;
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
                <!-- The contract and its executed agreement (golive#445). Drawn here, in the shared
                     chip's own classes, because the contract chip shows number AND status. -->
                @for (chip of ContractView.Chips; track chip.Key) {
                    <button
                        type="button"
                        class="bizapps-related__chip"
                        [attr.data-testid]="'order-related-' + chip.Key"
                        [attr.aria-label]="chip.AriaLabel"
                        (click)="OpenChip(chip, $event)">
                        @if (chip.Icon) {
                            <i [class]="chip.Icon" aria-hidden="true"></i>
                        }
                        <span class="bizapps-related__label">{{ chip.Label }}</span>
                        <span class="bizapps-related__name">{{ chip.Name }}</span>
                    </button>
                }
                @if (ContractView.Warning; as warning) {
                    <span class="mjs-order-related__warning" role="status" data-testid="order-related-no-agreement"
                          [attr.title]="warning.Detail">
                        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                        {{ warning.Label }}
                        <span class="mjs-order-related__sr">{{ warning.Detail }}</span>
                    </span>
                }
                @if (ContractView.AwaitingNote) {
                    <span class="mjs-order-related__note" data-testid="order-related-awaiting">
                        <i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>
                        {{ ContractView.AwaitingNote }}
                    </span>
                }
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
            .mjs-order-related__warning {
                display: inline-flex;
                align-items: center;
                gap: var(--mj-space-1-5);
                padding: var(--mj-space-1) var(--mj-space-3);
                font-size: var(--mj-text-xs);
                font-weight: var(--mj-font-semibold);
                color: var(--mj-status-warning-text);
                background: var(--mj-status-warning-bg);
                border: 1px solid var(--mj-status-warning-border);
                border-radius: var(--mj-radius-full);
            }
            .mjs-order-related__sr {
                position: absolute;
                width: 1px;
                height: 1px;
                overflow: hidden;
                clip: rect(0 0 0 0);
                white-space: nowrap;
            }
            .mjs-order-related__note {
                display: inline-flex;
                align-items: center;
                gap: var(--mj-space-1-5);
                font-size: var(--mj-text-xs);
                color: var(--mj-text-secondary);
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

    /** The contract chip, the agreement chip and the awaiting note. Rebuilt with {@link Links}. */
    public ContractView: OrderContractView = { Chips: [], AwaitingNote: null, Warning: null };

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

    /** A contract or agreement chip click: the same navigation event the shared chip row emits. */
    public OpenChip(chip: ResolvedRelatedChip, event: MouseEvent): void {
        this.FormComponent?.OnFormNavigate(RelatedChipNavigation(chip, event));
    }

    /**
     * Resolve the deal behind this order, then its contract and executed agreement.
     *
     * Up to four reads, each needing the one before it: the deal (for its ids), the contract (number,
     * status, `IsAwaitingDocument`), the contract's file links, and the linked file in the Executed
     * Agreement category. The last two are skipped when the view already says the paper is missing.
     *
     * A THROWN DEAL READ PUBLISHES NOTHING: the throw cost us the ids, so there is nothing left to
     * open. A throw after the deal was read keeps the deal and the plain contract link, which is what
     * the row showed before golive#445.
     */
    private async load(): Promise<void> {
        const generation = ++this.generation;
        const orderID = this.Record?.ID;
        if (!orderID) {
            this.publish(generation, null, {});
            return;
        }

        // A reversal is looked up by the order it reverses: see `DealLookupOrderID`.
        const dealOrderID = DealLookupOrderID(this.Record) ?? orderID;
        let state: OrderRelatedLinkState = {};
        try {
            const deal = await this.readDeal(String(dealOrderID));
            state = deal.State;
            if (state.DealID) {
                state = { ...state, ...(await this.readContractAndStatus(state, deal.StatusTypeID)) };
                state.Agreement = ShouldReadAgreement(state.Contract) ? await this.readAgreement(state.Contract.ID) : null;
            }
        } catch {
            // The deal's ids, once read, stay published: a failed contract read leaves the plain
            // contract link to `bizapps-related-chips`, which applies its own refusal rules, and no
            // warning, since nothing was learned about the contract.
            state = { DealID: state.DealID, ContractID: state.ContractID };
        }
        state.ViaReversedOrder = String(dealOrderID) !== String(orderID);
        state.OrderVoided = this.Record.Status === 'Voided'; // vocabulary-grep-allow: orders' fixed lifecycle, no flag table behind it

        this.publish(generation, orderID, state);
    }

    private get runView(): RunView {
        return RunView.FromMetadataProvider(this.Provider);
    }

    /** The deal whose `OrderID` names this order. Empty state when there is none. */
    private async readDeal(dealOrderID: string): Promise<{ State: OrderRelatedLinkState; StatusTypeID: string | null }> {
        const result = await this.runView.RunView<DealProvenanceRow>({
            EntityName: MJS_ENTITIES.Deal,
            Fields: ['ID', 'ContractID', 'DealStatusTypeID'],
            ExtraFilter: `OrderID = '${EscapeSQLString(dealOrderID)}'`,
            // `Deal.OrderID` is documented as a 1:1 peer, but this is a REVERSE read and nothing in
            // the schema enforces the one. Ordering makes the row that wins the same row on every
            // render rather than whichever the server happened to return first.
            OrderBy: '__mj_CreatedAt ASC',
            MaxRows: 1,
            ResultType: 'simple',
        });
        const row = result?.Success ? result.Results?.[0] : undefined;
        return {
            State: row ? { DealID: row.ID, ContractID: row.ContractID } : {},
            StatusTypeID: row?.DealStatusTypeID ?? null,
        };
    }

    /**
     * The contract behind the deal and whether the deal is won, in one batch: they are independent.
     *
     * The contract comes by `Deal.ContractID` or by the close's provenance pair
     * (`ContractLookupFilter`), newest first, so a deal whose close was re-run shows its latest.
     * `ContractRead` is set only when that read answered, so the warning never rests on a refusal.
     * Won is `DealStatusType.IsWon`, never a status name.
     */
    private async readContractAndStatus(state: OrderRelatedLinkState, statusID: string | null): Promise<Partial<OrderRelatedLinkState>> {
        const filter = ContractLookupFilter(state);
        if (!filter) return {};
        const [contracts, statuses] = await this.runView.RunViews([
            {
                EntityName: MJS_FOREIGN_ENTITIES.Contract,
                Fields: ['ID', 'ContractNumber', 'State', 'IsAwaitingDocument'],
                ExtraFilter: filter,
                OrderBy: '__mj_CreatedAt DESC',
                MaxRows: 1,
                ResultType: 'simple',
            },
            {
                EntityName: MJS_ENTITIES.DealStatusType,
                Fields: ['ID', 'IsWon'],
                ExtraFilter: statusID ? `ID = '${EscapeSQLString(statusID)}'` : '1 = 0',
                MaxRows: 1,
                ResultType: 'simple',
            },
        ]);
        const contract = (contracts?.Success ? (contracts.Results?.[0] as OrderContractRow | undefined) : undefined) ?? null;
        const status = statuses?.Success ? (statuses.Results?.[0] as { IsWon?: boolean } | undefined) : undefined;
        return {
            Contract: contract,
            ContractRead: contracts?.Success === true,
            DealIsWon: status ? status.IsWon === true : null,
        };
    }

    /**
     * The contract's executed agreement: its linked files, then the one in the Executed Agreement
     * category, the same test `vwContracts.IsAwaitingDocument` applies. `null` when none is linked or
     * the reader may not read files.
     */
    private async readAgreement(contractID: string): Promise<OrderAgreementFile | null> {
        const links = await this.runView.RunView<{ FileID: string }>({
            EntityName: MJS_FOREIGN_ENTITIES.FileEntityRecordLink,
            Fields: ['FileID'],
            ExtraFilter: ContractFileLinksFilter(contractID),
            ResultType: 'simple',
        });
        const filter = ExecutedAgreementFileFilter(links?.Success ? links.Results.map((l) => l.FileID) : []);
        if (!filter) return null;
        const files = await this.runView.RunView<OrderAgreementFile>({
            EntityName: MJS_FOREIGN_ENTITIES.File,
            Fields: ['ID', 'Name'],
            ExtraFilter: filter,
            OrderBy: '__mj_CreatedAt DESC',
            MaxRows: 1,
            ResultType: 'simple',
        });
        return (files?.Success ? files.Results?.[0] : undefined) ?? null;
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
        this.ContractView = OrderContractChips(state);
        this.cdr.detectChanges();
    }
}
