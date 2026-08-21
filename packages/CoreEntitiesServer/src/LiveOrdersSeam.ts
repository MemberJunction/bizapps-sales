/**
 * @fileoverview What is left of the orders handoff: a wrapper that forwards the CONTRACT route.
 *
 * ── THIS CLASS NO LONGER TOUCHES ORDERS, AND THAT IS THE POINT ─────────────────────────────────
 *
 * It used to create the order a won deal earned, through orders' own entity graph. Close-won does not
 * create an order any more — the order is embedded on the deal from creation — so `CreateOrder` and
 * `PreviewOrderMoney` described a route that no longer exists. Both are gone, along with the money
 * boundary essay that justified them.
 *
 * ── ONE OF THEM WAS A LIVE HAZARD, NOT JUST DEAD WEIGHT ────────────────────────────────────────
 *
 * Both passed `DiscountPct` straight through to `OrderLine`, and the seam input documented no units.
 * Orders stores a FRACTION (0.25 for a quarter off); the caller that used to feed this sent a rep-
 * entered PERCENTAGE (25). With the caller deleted the conversion went with it, leaving two exported,
 * typechecked methods that would write a 25% discount as 2500% — except `CK_OrderLine_DiscountPct`
 * caps it, so the realistic outcome was a 50% discount recorded for a half-percent one, saved
 * cleanly, with nothing to notice.
 *
 * That is precisely what `scripts/assert-discount-conversion.mjs` exists to prevent, and it was
 * sitting on a published interface with no test on it since the CW and D check bundles were retired.
 * Deleting the methods removes the hazard outright rather than documenting it.
 *
 * ── WHY THE CLASS SURVIVES AT ALL ──────────────────────────────────────────────────────────────
 *
 * `CreateContractFromDeal` and `RenewContractTerm` below are pure delegation to the contracts seam it
 * is handed. So this is now a pass-through, and `CloseDealOperation.resolveSeam` could return that
 * contracts seam directly instead of wrapping it — at which point this whole file goes. That edit is
 * in `CloseDealOperation.ts`, which another session is merging, so it is left stated rather than made.
 *
 * `OrdersIsInstalled()` is the one thing here still doing work: the close reads it to decide whether
 * an orders-dependent route is available at all.
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
