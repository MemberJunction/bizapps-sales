/**
 * @fileoverview Which records a deal offers to open from its header — the rule, without a component.
 *
 * WHAT THIS FILE IS AND IS NOT. It decides WHICH relationships a deal has worth a chip. It does not
 * resolve a name, read a record, or decide whether a link can be drawn at all — those belong to
 * `bizapps-related-chips` in `@mj-biz-apps/common-ng`, which already refuses to draw a chip for an
 * entity this host does not have, for a record that is not there, and for anything it would have to
 * label with a raw id. golive#225 built that row precisely so three apps would stop each solving a
 * slice of it differently; this is sales' half of the split, and it is deliberately small.
 *
 * It is a plain function rather than a method for the same reason `related-links.ts` is: every line
 * here is a decision about whether a link appears, which is exactly what a test should pin, and a
 * rule declared inside an Angular component cannot be exercised without standing up DI that this
 * repo's node-environment vitest deliberately does not do.
 *
 * ── THE RULE (bc-aidp-next-golive#226) ──────────────────────────────────────────────────────────
 *
 * A UAT tester closed a deal as Won and had no way to reach either the order or the contract from
 * the header. What they must NOT be given is the other half of the same issue: an order link on an
 * OPEN deal, where the order is still a draft nobody should be editing directly. Reps price inside
 * the deal; the order becomes reachable once the deal is won.
 *
 * So Order and Contract are gated on the win. The contract a RENEWAL renews is not — it is context
 * for the negotiation in progress, and a rep needs it precisely while the deal is still open.
 *
 * @module @mj-biz-apps/sales-ng
 */
import type { BizAppsRelatedLink } from '@mj-biz-apps/common-ng';
import { MJS_FOREIGN_ENTITIES } from '../data/entity-names';

/**
 * What the rule needs to know about a deal. Ids as the record holds them — blank, null and undefined
 * all mean "no such record", which is why the presence test below is not a truthiness check on a
 * string that could be `'   '`.
 */
export interface DealRelatedLinkState {
    /**
     * Whether the PERSISTED status carries `IsWon`, from `ResolveDealLockState`.
     *
     * A FLAG, never a status name. A deployment may call its winning status "Signed" (§3), and
     * `test:vocabulary-gate` is what stops this file from ever growing a comparison to one.
     */
    IsWon: boolean;
    OrderID?: string | null;
    ContractID?: string | null;
    RenewsContractID?: string | null;
}

/** `true` for a value that actually names a record. */
function holds(id: string | null | undefined): id is string {
    return id != null && String(id).trim().length > 0;
}

/**
 * The relationships this deal offers, in reading order, for `bizapps-related-chips`.
 *
 * ORDER IS THE SEQUENCE THE WIN PRODUCED: the order is what the close created, the contract is what
 * the order became, and the renewed contract is the thing that came before all of it.
 *
 * Returns an empty array rather than null when nothing applies — the chip row renders nothing for an
 * empty list, so an open deal's header is simply unchanged.
 */
export function DealRelatedLinks(state: DealRelatedLinkState): BizAppsRelatedLink[] {
    const links: BizAppsRelatedLink[] = [];

    /**
     * ORDER AND CONTRACT ARE BOTH GATED ON THE WIN, and the order's gate is the one with teeth: item
     * 4 of the issue asks for the order to be UNREACHABLE from an open deal, not merely undecorated.
     * This is the only order link on the form now — the Motion panel's own link came off with it —
     * so the gate here is the whole of that behaviour.
     *
     * Worth saying plainly: this is discoverability, not a lock. The draft order is still reachable
     * by search, and anything that must actually refuse belongs in the entity server.
     */
    if (state.IsWon && holds(state.OrderID)) {
        links.push({
            Key: 'order',
            EntityName: MJS_FOREIGN_ENTITIES.OrderHeader,
            RecordID: state.OrderID,
            Label: 'Order',
            Icon: 'fa-solid fa-receipt',
        });
    }

    if (state.IsWon && holds(state.ContractID)) {
        links.push({
            Key: 'contract',
            EntityName: MJS_FOREIGN_ENTITIES.Contract,
            RecordID: state.ContractID,
            Label: 'Contract',
            Icon: 'fa-solid fa-file-contract',
        });
    }

    /**
     * NOT GATED ON THE WIN, deliberately — the issue asks for it "regardless of the deal's status".
     *
     * The renewed contract is what the renewal is arguing about: its term, its rate, what it did and
     * did not include. A rep needs it while the deal is OPEN, which is the entire time the other two
     * chips are absent. `DealType.RequiresRenewalSource` is what makes the field mandatory on a
     * renewal; nothing here reads the deal type, because a deal that holds the id wants the link
     * whatever type it claims to be.
     */
    if (holds(state.RenewsContractID)) {
        links.push({
            Key: 'renews',
            EntityName: MJS_FOREIGN_ENTITIES.Contract,
            RecordID: state.RenewsContractID,
            Label: 'Renews',
            Icon: 'fa-solid fa-rotate',
        });
    }

    return links;
}

/**
 * A key that changes exactly when {@link DealRelatedLinks} would return something different.
 *
 * WHY A CALLER NEEDS THIS. `bizapps-related-chips` re-resolves whenever its `Links` input is a NEW
 * ARRAY REFERENCE, and it reads that input on every change-detection pass. A getter that built a
 * fresh array each pass would therefore put the row in a permanent re-read loop, so the caller
 * caches the array and rebuilds it only when this key moves. Same idiom as `bizapps-contracts`'
 * Contract hero, and the reason its `RelatedLinks` getter says "returns a STABLE array".
 *
 * The record id is in the key because a form container reuses one panel instance across records:
 * without it, navigating from a won deal to an open one would keep the first deal's chips, offering
 * a click that opens a record belonging to a deal the reader has left.
 */
export function DealRelatedLinksKey(recordID: string | null | undefined, state: DealRelatedLinkState): string {
    return [
        recordID ?? '',
        state.IsWon ? 'won' : 'open',
        state.OrderID ?? '',
        state.ContractID ?? '',
        state.RenewsContractID ?? '',
    ].join(':');
}
