/**
 * @fileoverview The REAL orders handoff — the implementation `StubDownstreamSeam` stands in for.
 *
 * ── WHY THIS CREATES THE ORDER THROUGH THE ENTITY GRAPH ─────────────────────────────────────────
 *
 * The obvious objection is that sales writes another app's entities directly. It is worth answering,
 * because the answer is what makes this the non-divergent choice rather than a shortcut.
 *
 * Orders ships **no create-order operation**. `Orders.CreateOrderInState` — which this seam was
 * originally written against — lives only on the unmerged `origin/mjdev/orders-flow`; orders' `next`
 * registers eleven operations and not one of them creates an order. Orders' own canonical creation
 * path IS the entity graph: `order-builder.ts` gets an `Order Headers` entity, sets the payer, adds
 * lines and saves, and `OrderEntityServer.Save()` does the rest — mints the order number, prices the
 * lines through orders' engine, raises the initial payment.
 *
 * So this class does exactly what orders does. Every invariant orders enforces on creation runs,
 * because it is orders' own server code running. Calling anything else would be the divergence.
 *
 * ── THE MONEY BOUNDARY, RESTATED WHERE IT IS EASIEST TO BREAK ───────────────────────────────────
 *
 * Sales sends `ProductID`, `Quantity`, a requested `DiscountPct` and a service period. It does not
 * send a price, and there is no arithmetic anywhere in this file — no multiply, no sum, no round.
 *
 * `UnitPrice` is omitted ENTIRELY when unset rather than sent as 0, because 0 means "free", which is a
 * different statement from "you decide". When it IS set it is a negotiated override — an INPUT to the
 * pricing engine, never a replacement for it.
 *
 * The amount that comes back from `PreviewOrderMoney` is orders' number, carried verbatim.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import {
    BaseRemotableOperation,
    Metadata,
    RunView,
    type BaseEntity,
    type IMetadataProvider,
    type UserInfo,
} from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import {
    type IDownstreamSeam,
    type OrdersOrderHandoffInput,
    type OrdersPreviewResult,
    type OrdersSeamResult,
    type ContractsCreateFromDealSeamInput,
    type ContractsRenewTermSeamInput,
    type ContractsSeamResult,
    StubDownstreamSeam,
} from '@mj-biz-apps/sales-entities';

/** Orders' entity names, in one place so a rename is one edit rather than a hunt. */
const E_ORDER_HEADER = 'MJ_BizApps_Orders: Order Headers';
const E_ORDER_LINE = 'MJ_BizApps_Orders: Order Lines';

/**
 * The operation that prices a draft — orders' CLASS REGISTRATION key, not its display name.
 *
 * Metadata calls it "Price Order"; the ClassFactory key is `Orders.PriceOrder`. Invoking by key keeps
 * this a SOFT dependency: sales names a string, never imports orders' TypeScript, so a deployment
 * without orders still compiles and runs.
 */
const OP_PRICE_ORDER = 'Orders.PriceOrder';

/**
 * The slice of orders' `OrderHeader` this file touches.
 *
 * Structural rather than imported. `mjBizAppsOrdersOrderHeaderEntity` would be a hard build-time
 * dependency on a sibling that may not be installed, which is exactly what `DealLine.ProductID` being
 * a soft reference exists to avoid. The generated subclass declares `Lines` as a related-record
 * collection; this describes only what is used.
 */
interface RelatedRecordCollectionLike {
    Create(): Promise<BaseEntity>;
}
interface OrderHeaderLike extends BaseEntity {
    readonly Lines: RelatedRecordCollectionLike;
}

/**
 * True when orders is actually installed here.
 *
 * Checked against METADATA rather than by catching an error, for the same reason the product picker
 * does: `RunView`/`GetEntityObject` against an unregistered entity does not fail cleanly — it logs and
 * leaves the caller guessing. Sales is designed to run standalone, so orders being absent is a
 * supported state, not a fault.
 */
export function OrdersIsInstalled(): boolean {
    const md = new Metadata();
    return md.Entities.some((e) => e.Name === E_ORDER_HEADER) && md.Entities.some((e) => e.Name === E_ORDER_LINE);
}

export class LiveOrdersSeam implements IDownstreamSeam {
    public readonly IsLive = true;

    /**
     * The contract half is delegated to whatever the composer supplied — the live contracts seam when
     * contracts is installed, the stub when it is not. This class owns ORDERS and nothing else; it used
     * to hold a private stub, which quietly made it the authority on a downstream it knows nothing
     * about. See `CompositeDownstreamSeam`.
     */
    private readonly contracts: Pick<IDownstreamSeam, 'CreateContractFromDeal' | 'RenewContractTerm'>;

    public constructor(
        private readonly user: UserInfo,
        private readonly provider: IMetadataProvider,
        contracts?: Pick<IDownstreamSeam, 'CreateContractFromDeal' | 'RenewContractTerm'>,
    ) {
        this.contracts = contracts ?? new StubDownstreamSeam();
    }

    /**
     * Ask orders what this draft costs, creating nothing.
     *
     * `OrderHeaderID` is deliberately absent from the payload: `PriceOrder` accepts a draft that was
     * never persisted, which is what makes a genuine PREVIEW possible rather than a create-then-read.
     */
    public async PreviewOrderMoney(input: OrdersOrderHandoffInput): Promise<OrdersPreviewResult> {
        if (!OrdersIsInstalled()) {
            return { Success: false, Message: 'bizapps-orders is not installed in this deployment.' };
        }

        const op = MJGlobal.Instance.ClassFactory.CreateInstance<BaseRemotableOperation>(
            BaseRemotableOperation,
            OP_PRICE_ORDER,
        );
        if (!op) {
            return { Success: false, Message: `${OP_PRICE_ORDER} is not registered in this process.` };
        }

        const result = await op.ExecuteServer(
            {
                CompanyID: input.Header.CompanyID,
                BillToOrganizationID: input.Header.OrganizationID ?? null,
                BillToPersonID: input.Header.PersonID ?? null,
                OrderDate: input.OrderDate ?? null,
                Lines: input.Lines.map((l) => ({
                    ProductID: l.ProductID,
                    Quantity: l.Quantity,
                    ...(l.UnitPrice === undefined ? {} : { UnitPrice: l.UnitPrice }),
                    ...(l.DiscountPct === undefined ? {} : { DiscountPct: l.DiscountPct }),
                    ServicePeriodStart: l.ServicePeriodStart ?? null,
                    ServicePeriodEnd: l.ServicePeriodEnd ?? null,
                })),
            },
            // `emitProgress` is required by the context and unused by a Sync operation.
            { provider: this.provider, user: this.user, emitProgress: () => undefined },
        );

        if (!result?.Success) {
            return { Success: false, Message: result?.ErrorMessage ?? 'Orders.PriceOrder failed.' };
        }
        /**
         * `Totals.Gross` is ORDERS' own field name (`PriceOrderOutput.Totals`), carried back untouched.
         * Gross rather than Net on purpose: it is what the customer owes, and it is what the booked
         * order's `TotalGross` holds — so the preview and the booking are comparable without sales
         * adding, subtracting or rounding anything to make them line up.
         */
        const payload = (result.Output ?? {}) as {
            Totals?: { Gross?: number };
            CurrencyID?: string;
        };
        return { Success: true, Amount: payload.Totals?.Gross ?? null, CurrencyID: payload.CurrencyID ?? null };
    }

    /**
     * Create and book the order, through orders' own entity graph.
     *
     * The save is ONE call on the header. Lines are attached as related records so orders sees a single
     * composite save and its server code runs once over the whole graph — which is what mints the
     * number, prices the lines and raises the payment. Saving lines separately afterwards would produce
     * an order that was briefly headerless-but-real, and would run orders' hooks in the wrong order.
     */
    public async CreateOrder(input: OrdersOrderHandoffInput): Promise<OrdersSeamResult> {
        if (!OrdersIsInstalled()) {
            return { Success: false, Message: 'bizapps-orders is not installed in this deployment.' };
        }

        const header = await this.provider.GetEntityObject<OrderHeaderLike>(E_ORDER_HEADER, this.user);
        header.NewRecord();
        header.Set('CompanyID', input.Header.CompanyID);
        header.Set('OrderDate', input.OrderDate ?? new Date().toISOString().slice(0, 10));
        header.Set('OrderType', input.OrderType);
        header.Set('Status', input.Status);
        if (input.Header.OrganizationID) header.Set('BillToOrganizationID', input.Header.OrganizationID);
        if (input.Header.PersonID) header.Set('BillToPersonID', input.Header.PersonID);
        if (input.Header.CurrencyID) header.Set('CurrencyID', input.Header.CurrencyID);
        if (input.Header.Description) header.Set('Description', input.Header.Description);

        for (const line of input.Lines) {
            // Through ORDERS' OWN collection, so its sequencing and join-field handling apply.
            const ol = await header.Lines.Create();
            ol.Set('ProductID', line.ProductID);
            ol.Set('Quantity', line.Quantity);
            // NO UnitPrice unless it was negotiated — see the money boundary in the file header.
            if (line.UnitPrice !== undefined) ol.Set('UnitPrice', line.UnitPrice);
            if (line.DiscountPct !== undefined) ol.Set('DiscountPct', line.DiscountPct);
            if (line.ServicePeriodStart) ol.Set('ServicePeriodStart', line.ServicePeriodStart);
            if (line.ServicePeriodEnd) ol.Set('ServicePeriodEnd', line.ServicePeriodEnd);
            if (line.Description) ol.Set('Description', line.Description);
        }

        const saved = await header.Save();
        if (!saved) {
            const errors = header.LatestResult?.Message ?? 'unknown error';
            return { Success: false, Message: `orders refused the order: ${errors}` };
        }

        return {
            Success: true,
            OrderID: String(header.Get('ID')),
            Status: String(header.Get('Status') ?? input.Status),
            Message: `Order ${String(header.Get('OrderNumber') ?? header.Get('ID'))} created by Sales.CloseDeal.`,
        };
    }

    public CreateContractFromDeal(input: ContractsCreateFromDealSeamInput): Promise<ContractsSeamResult> {
        return this.contracts.CreateContractFromDeal(input);
    }

    public RenewContractTerm(input: ContractsRenewTermSeamInput): Promise<ContractsSeamResult> {
        return this.contracts.RenewContractTerm(input);
    }
}

/** Anti-tree-shaking anchor, in the house style. */
export function LoadLiveOrdersSeam(): void {
    /* keeps the import alive */
}

/** Kept for the seam test, which reads back what orders actually wrote. */
export { E_ORDER_HEADER, E_ORDER_LINE, RunView };
