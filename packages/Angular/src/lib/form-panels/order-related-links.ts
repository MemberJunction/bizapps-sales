/**
 * @fileoverview Which records an ORDER offers to open from its header — the rule, without a component.
 *
 * WHAT THIS FILE IS AND IS NOT. It decides WHICH relationships an order has worth a chip. It does not
 * resolve a name, read a record, or decide whether a link can be drawn at all — those belong to
 * `bizapps-related-chips` in `@mj-biz-apps/common-ng`, which already refuses to draw a chip for an
 * entity this host does not have, for a record that is not there, and for anything it would have to
 * label with a raw id. golive#225 built that row precisely so three apps would stop each solving a
 * slice of it differently; this is the order half of sales' share, and it is deliberately small.
 *
 * Plain functions rather than methods, for the same reason `deal-related-links.ts` is: every line
 * here is a decision about whether a link appears, which is exactly what a test should pin, and a
 * rule declared inside an Angular component cannot be exercised without standing up DI that this
 * repo's node-environment vitest deliberately does not do.
 *
 * ── THE RULE (bc-aidp-next-golive#227) ──────────────────────────────────────────────────────────
 *
 * A UAT tester opened an order that had come from a deal and found nothing on it saying so. The
 * order header names its status, type, company, dates and parties, and no part of it points back at
 * what caused the order to exist.
 *
 * Both chips are UNGATED, which is the one place this rule differs from the deal's. On the deal form
 * the order chip waits for the win, because before it the order is a draft nobody should be editing
 * directly. Here the order already exists and is being looked at; the question a reader has is where
 * it came from, and the answer does not become truer or safer at some later status.
 *
 * ── WHY SALES OWNS AN ORDER-FORM RULE ───────────────────────────────────────────────────────────
 *
 * The link exists in one direction only. `Deal.OrderID` is a real foreign key into orders and
 * `Deal.ContractID` is a soft reference into contracts; `OrderHeader` holds no `DealID` and no
 * `ContractID`, and is not going to — `mj-app.json` has sales depending on orders and contracts,
 * with neither depending on sales. So the knowledge that an order HAS a deal is sales' knowledge,
 * and the panel that renders it is contributed onto the order form from here rather than built into
 * an app that must not know this app exists.
 *
 * @module @mj-biz-apps/sales-ng
 */
import type { BizAppsRelatedLink } from '@mj-biz-apps/common-ng';
import { MJS_ENTITIES, MJS_FOREIGN_ENTITIES } from '../data/entity-names';

/**
 * What the rule needs to know about the deal behind an order, as the deal row holds it.
 *
 * BOTH IDS COME FROM THE DEAL, not from the order, and that is the whole reason this state exists as
 * a type of its own. The contract is a SECOND HOP — order → deal → contract — so a caller has to
 * have read the deal before it can ask this function anything. `order-related.panel.ts` is what does
 * that read; this file is what decides what the answer means.
 *
 * Blank, null and undefined all mean "no such record", which is why the presence test below is not a
 * truthiness check on a string that could be `'   '`.
 */
export interface OrderRelatedLinkState {
    /** The deal whose `OrderID` names this order. */
    DealID?: string | null;
    /** That deal's `ContractID` — the contract the win produced, reached THROUGH the deal. */
    ContractID?: string | null;
}

/** `true` for a value that actually names a record. */
function holds(id: string | null | undefined): id is string {
    return id != null && String(id).trim().length > 0;
}

/**
 * The relationships this order offers, in reading order, for `bizapps-related-chips`.
 *
 * ORDER IS THE CHAIN WALKED BACKWARDS: the deal is what produced the order, and the contract is what
 * the deal also produced. A reader following the chips is retracing the sale.
 *
 * A CONTRACT WITHOUT A DEAL IS NOT REPRESENTABLE, and the signature is what makes that true rather
 * than a check: the contract id can only have come from a deal row, so there is no state in which
 * this returns a contract chip alone. Anything else would be claiming a relationship nothing in the
 * data model records.
 *
 * Returns an empty array rather than null when nothing applies — the chip row renders nothing for an
 * empty list, so an order keyed directly, with no deal behind it, has an unchanged header.
 */
export function OrderRelatedLinks(state: OrderRelatedLinkState): BizAppsRelatedLink[] {
    const links: BizAppsRelatedLink[] = [];

    if (!holds(state.DealID)) {
        return links;
    }

    links.push({
        Key: 'deal',
        EntityName: MJS_ENTITIES.Deal,
        RecordID: state.DealID,
        Label: 'Deal',
        Icon: 'fa-solid fa-handshake',
    });

    /**
     * THE SECOND HOP, and the reason the issue words it as "reached through that deal".
     *
     * `Deal.ContractID` is a soft reference with no FK metadata behind it, so nothing resolves this
     * automatically and no amount of relationship configuration on the order would. It is also
     * frequently absent: a deal that has not closed has produced no contract, and one closed by a
     * route that raises no agreement never will.
     */
    if (holds(state.ContractID)) {
        links.push({
            Key: 'contract',
            EntityName: MJS_FOREIGN_ENTITIES.Contract,
            RecordID: state.ContractID,
            Label: 'Contract',
            Icon: 'fa-solid fa-file-contract',
        });
    }

    return links;
}

/**
 * A key that changes exactly when {@link OrderRelatedLinks} would return something different.
 *
 * WHY A CALLER NEEDS THIS. `bizapps-related-chips` re-resolves whenever its `Links` input is a NEW
 * ARRAY REFERENCE, and clears the row before it re-reads. Republishing an equal array — which is
 * what a naive refresh handler does — therefore blanks the chips and reads them again for no change
 * the reader can see. The panel rebuilds the array only when this key moves.
 *
 * The order's id is in the key because a form container reuses one panel instance across records:
 * without it, navigating from an order that came from a deal to one that did not would keep the
 * first order's chips, offering a click that opens the provenance of a record the reader has left.
 */
export function OrderRelatedLinksKey(recordID: string | null | undefined, state: OrderRelatedLinkState): string {
    return [recordID ?? '', state.DealID ?? '', state.ContractID ?? ''].join(':');
}
