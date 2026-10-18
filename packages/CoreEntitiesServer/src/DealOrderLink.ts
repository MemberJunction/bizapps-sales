/**
 * @fileoverview Sales' answer to Orders' question: which deal created this order?
 *
 * ── WHAT THIS IS ────────────────────────────────────────────────────────────────────────────────
 *
 * Orders reviews an order by trigger (bc-aidp-next-golive#320 §5). Its `NoDeal` trigger sends a
 * hand-entered order to review, and a deal order confirms without one: the deal is where the price and
 * the terms were agreed. To tell the two apart Orders needs the deal, and it has no link to follow:
 * `Deal.OrderID` points at the order, and `OrderHeader` carries no `DealID`. So Orders asks through
 * `RegisterOrderDealLink`, as it does for the confirm veto, and this is the app that can answer.
 *
 * On a host where nothing registers, Orders counts every order as having no deal. With `NoDeal`
 * switched on, every deal order then goes to review: safe, but it is exactly the review §5 says deal
 * orders skip. Registering this is what stops it.
 *
 * ── THE SEAM SHIPS IN A LATER ORDERS RELEASE THAN THE ONE SALES BUILDS AGAINST ──────────────────
 *
 * `RegisterOrderDealLink` arrives in `@mj-biz-apps/orders-entities` 5.36.0 (bizapps-orders#912). Sales
 * anchors 5.30.0 and declares `^5.30.0`, so a host may run either. The register function is therefore
 * looked up on the module at bootstrap rather than imported by name: with an older orders it is absent,
 * nothing registers, and the host logs that it runs without the link. The interfaces below restate the
 * seam's shape for the same reason, since 5.30.0 exports no `OrderDealLink` type to implement.
 *
 * When sales raises its orders floor to 5.36.0 or later, import `RegisterOrderDealLink` and
 * `OrderDealLink` from `@mj-biz-apps/orders-entities` directly and delete the lookup and the restated
 * types: they are the only part of this file that exists for the version gap.
 *
 * ── FAILING TO ANSWER THROWS, AS THE SEAM ASKS ──────────────────────────────────────────────────
 *
 * The seam says "throw when it cannot tell", and Orders refuses the confirm with the fault named. A
 * failed read answering null would read as "no deal", and so would raise a `NoDeal` review against an
 * order a deal did create. That is the safe direction, but it would hide a broken read behind a review
 * nobody can explain, so this logs and throws instead, the same trade `DealNotWonConfirmVeto` makes.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */

import { LogError, LogStatus, RunView, type UserInfo } from '@memberjunction/core';
import * as OrdersEntities from '@mj-biz-apps/orders-entities';

const DEAL_ENTITY = 'MJ_BizApps_Sales: Deals';

/** The orders-entities release that first exports `RegisterOrderDealLink`. */
export const ORDER_DEAL_LINK_MIN_ORDERS_VERSION = '5.36.0';

/**
 * The deal an order came from: `OrderDeal` in `@mj-biz-apps/orders-entities` 5.36.0, restated (see the
 * file header).
 */
export interface DealOrderLinkAnswer {
    DealID: string;
    DealNumber: string | null;
}

/** `OrderDealLink` in `@mj-biz-apps/orders-entities` 5.36.0, restated (see the file header). */
export interface DealOrderLinkSeam {
    /** The deal the order came from, or null when none did. Throws when it cannot tell. */
    DealForOrder(orderHeaderID: string, contextUser: UserInfo | null): Promise<DealOrderLinkAnswer | null>;
}

/** `RegisterOrderDealLink`'s signature. Passing null clears the registration. */
export type RegisterOrderDealLinkFunction = (link: DealOrderLinkSeam | null) => void;

export class DealOrderLink implements DealOrderLinkSeam {
    /**
     * The deal whose `OrderID` is this order, or null when no deal points at it.
     *
     * `Deal.OrderID` carries no unique index, so two deals pointing at one order is a shape the
     * database permits. Orders asks only whether a deal created the order, and either one did, so the
     * first by `ID` is returned: ordered so the same data gives the same answer every time.
     */
    public async DealForOrder(orderHeaderID: string, contextUser: UserInfo | null): Promise<DealOrderLinkAnswer | null> {
        if (!orderHeaderID?.trim()) {
            throw new Error('DealOrderLink: an order id is required to find the deal that created the order');
        }
        const result = await new RunView().RunView<{ ID: string; DealNumber: string | null }>(
            {
                EntityName: DEAL_ENTITY,
                ExtraFilter: `OrderID = '${SafeID(orderHeaderID)}'`,
                Fields: ['ID', 'DealNumber'],
                OrderBy: 'ID',
                ResultType: 'simple',
            },
            contextUser ?? undefined,
        );
        if (!result.Success) {
            LogError(`DealOrderLink: could not read the deal for order ${orderHeaderID}: ${result.ErrorMessage}`);
            throw new Error(`the deal behind this order could not be read: ${result.ErrorMessage ?? 'unknown error'}`);
        }
        const first = (result.Results ?? [])[0];
        if (!first) {
            return null;
        }
        return { DealID: first.ID, DealNumber: first.DealNumber?.trim() || null };
    }
}

/** Single-quote escaping for an id interpolated into an `ExtraFilter`. */
function SafeID(id: string): string {
    return String(id).replace(/'/g, "''");
}

/**
 * `RegisterOrderDealLink` from the orders-entities module this host resolved, or null when that
 * release predates it. Takes the module as a parameter so a test can hand it either shape.
 */
export function FindRegisterOrderDealLink(ordersModule: object = OrdersEntities): RegisterOrderDealLinkFunction | null {
    const candidate = (ordersModule as { RegisterOrderDealLink?: unknown }).RegisterOrderDealLink;
    return typeof candidate === 'function' ? (candidate as RegisterOrderDealLinkFunction) : null;
}

/**
 * Registers this app's answer. Called at bootstrap beside the other orders registrations.
 *
 * Returns whether it registered. False means the orders release on this host has no such seam: it is
 * logged, not thrown, because that host's orders does not review by trigger either, so nothing there
 * asks the question. Last-call-wins in the registry, so a host that boots twice ends up with one link.
 */
export function LoadDealOrderLink(ordersModule: object = OrdersEntities): boolean {
    const register = FindRegisterOrderDealLink(ordersModule);
    if (!register) {
        LogStatus(
            `DealOrderLink: @mj-biz-apps/orders-entities on this host predates RegisterOrderDealLink ` +
                `(${ORDER_DEAL_LINK_MIN_ORDERS_VERSION}), so orders is not told which deal created an order.`,
        );
        return false;
    }
    register(new DealOrderLink());
    return true;
}
