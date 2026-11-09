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
import { EscapeSQLString } from '@memberjunction/global';
import type { BizAppsRelatedLink, ResolvedRelatedChip } from '@mj-biz-apps/common-ng';
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
    /**
     * The contract row the panel read (golive#445): `Deal.ContractID`'s, or the one found by
     * {@link ContractLookupFilter}'s fallback. Absent when no read was made, the read failed, or no
     * contract exists. When present, the panel draws the contract chip itself, with number and status.
     */
    Contract?: OrderContractRow | null;
    /** The contract's executed-agreement file, when one is linked and readable. */
    Agreement?: OrderAgreementFile | null;
    /** The deal's `DealStatusType.IsWon`. Unknown (absent) when the status could not be read. */
    DealIsWon?: boolean | null;
    /**
     * `true` once the contract lookup ANSWERED, found or not. A refused or thrown read leaves it unset,
     * and the warning then stays silent rather than claiming a contract is missing.
     */
    ContractRead?: boolean;
    /**
     * `true` when the order is a reversal, so the deal was found through the order it reverses
     * ({@link DealLookupOrderID}). The deal's chips still show; the warning does not, since the deal
     * names the original order, not this one.
     */
    ViaReversedOrder?: boolean;
    /** `true` when the order is voided. A voided order sends no invoice, so the warning does not apply. */
    OrderVoided?: boolean;
}

/** The columns of `vwContracts` the order header shows. */
export interface OrderContractRow {
    ID: string;
    ContractNumber: string | null;
    /** `vwContracts.State`: Draft, Executed, Active, Expired, Superseded or Terminated. */
    State: string | null;
    /**
     * `vwContracts.IsAwaitingDocument`: the contract's type requires executed paper and no file in the
     * Executed Agreement category is linked. Always false for a type that needs no paper (Payment Link).
     */
    IsAwaitingDocument: boolean | null;
}

/** The `MJ: Files` row that holds a contract's executed agreement. */
export interface OrderAgreementFile {
    ID: string;
    Name: string;
}

/**
 * The file category that marks a contract's executed agreement. Spelled exactly as contracts seeds it
 * (`V202609010100__v0.2.x__IsAwaitingDocument_executed_agreement.sql`) and as `vwContracts` matches it.
 * Sales does not depend on `@mj-biz-apps/contracts-entities`, which exports the same constant, so the
 * spelling is repeated here and pinned by a test.
 */
export const EXECUTED_AGREEMENT_FILE_CATEGORY = 'Executed Agreement';

/** The entity name contracts stamps in `CreatingEntityID` for a contract a deal's close created. */
const DEAL_ENTITY_NAME = MJS_ENTITIES.Deal;

/** `true` for a value that actually names a record. */
function holds(id: string | null | undefined): id is string {
    return id != null && String(id).trim().length > 0;
}

/**
 * Which order's id to look the deal up by: the order itself, or — for a reversal — the order it reverses.
 *
 * A REVERSAL HAS NO DEAL OF ITS OWN (MemberJunction/bizapps-orders#740). A return, cancellation or
 * credit memo is a new order that points back through `ReversesOrderHeaderID`; `Deal.OrderID` still
 * names the original. Looking the deal up by the reversal's own id finds nothing, so the reversal's
 * header went blank. One hop back reaches the deal that produced what is being reversed.
 *
 * One hop, not a walk to the root: a reversal of a reversal points at an order that has no deal
 * either, and following the chain further would be guessing at a relationship the data does not hold.
 */
export function DealLookupOrderID(order: { ID?: string | null; ReversesOrderHeaderID?: string | null } | null | undefined): string | null {
    const reverses = order?.ReversesOrderHeaderID;
    if (holds(reverses)) return reverses;
    const own = order?.ID;
    return holds(own) ? own : null;
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
    if (holds(state.ContractID) && !state.Contract) {
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
    const contract = state.Contract;
    return [
        recordID ?? '',
        state.DealID ?? '',
        state.ContractID ?? '',
        contract?.ID ?? '',
        contract?.ContractNumber ?? '',
        contract?.State ?? '',
        contract?.IsAwaitingDocument ? '1' : '0',
        state.Agreement?.ID ?? '',
        state.DealIsWon ? 'won' : '',
        state.ContractRead ? 'read' : '',
        state.ViaReversedOrder ? 'reversal' : '',
        state.OrderVoided ? 'voided' : '',
    ].join(':');
}

/**
 * The filter that finds the contract behind a deal (golive#445).
 *
 * `Deal.ContractID` first: it is the link the close wrote. When it is empty, the contract the deal's
 * close created is still findable by its polymorphic provenance pair, `CreatingEntity` = Deals and
 * `CreatingRecordID` = the deal (`LiveContractsSeam` stamps both). An empty `ContractID` with a contract
 * behind it is a deal whose link was never written, which is the case the issue suspects for
 * ORD-004297. `null` when there is no deal to look by.
 */
export function ContractLookupFilter(deal: { DealID?: string | null; ContractID?: string | null }): string | null {
    if (holds(deal.ContractID)) {
        return `ID = '${EscapeSQLString(deal.ContractID)}'`;
    }
    if (!holds(deal.DealID)) {
        return null;
    }
    return `CreatingEntity = '${EscapeSQLString(DEAL_ENTITY_NAME)}' AND CreatingRecordID = '${EscapeSQLString(deal.DealID)}'`;
}

/** The filter on `MJ: File Entity Record Links` that lists the files linked to one contract. */
export function ContractFileLinksFilter(contractID: string): string {
    return `Entity = '${EscapeSQLString(MJS_FOREIGN_ENTITIES.Contract)}' AND RecordID = '${EscapeSQLString(contractID)}'`;
}

/**
 * The filter on `MJ: Files` that picks the executed agreement among a contract's linked files, or
 * `null` when nothing is linked and no read is needed. Matches the category by NAME, as the view does.
 */
export function ExecutedAgreementFileFilter(fileIDs: readonly string[]): string | null {
    const ids = fileIDs.filter(holds);
    if (ids.length === 0) {
        return null;
    }
    const list = ids.map((id) => `'${EscapeSQLString(id)}'`).join(',');
    return `Category = '${EscapeSQLString(EXECUTED_AGREEMENT_FILE_CATEGORY)}' AND ID IN (${list})`;
}

/**
 * Whether the panel needs to look for the agreement file at all. A contract the view reports as
 * awaiting has, by the view's own definition, no such file, so the two reads are skipped.
 */
export function ShouldReadAgreement(contract: OrderContractRow | null | undefined): contract is OrderContractRow {
    return !!contract && contract.IsAwaitingDocument !== true;
}

/** What the header shows for the contract and its executed agreement. */
export interface OrderContractView {
    /** The contract chip, then the agreement chip when a file is linked. Opened like any related chip. */
    Chips: ResolvedRelatedChip[];
    /** "Awaiting signed agreement" when the contract's type needs paper and none is linked; else null. */
    AwaitingNote: string | null;
    /** The "No executed agreement" warning for a won deal's order (golive#443); replaces the note. */
    Warning: OrderAgreementWarning | null;
}

/** The warning chip's text and its longer explanation. */
export interface OrderAgreementWarning {
    Label: string;
    Detail: string;
}

/** The contract chip's text: its number and status, e.g. `CTR-000123 · Active`. */
export function ContractChipName(contract: OrderContractRow): string {
    return [contract.ContractNumber, contract.State].filter(holds).join(' · ');
}

/**
 * The contract part of the From row (golive#445).
 *
 * Built here rather than by `bizapps-related-chips` because the chip has to say the contract's number
 * AND status, and the shared row shows only the record's name field. The panel already read the row
 * to learn `IsAwaitingDocument`, so nothing is re-read. Both chips exist only for rows the reader's
 * own read returned, so neither can point at a record they cannot open.
 *
 * The agreement opens the `MJ: Files` record, whose form previews the file and offers it to download.
 *
 * A contract that needs no paper (its type's `RequiresExecutedDocument = 0`, a Payment Link) and has
 * none linked shows neither the agreement chip nor the note: nothing is missing.
 */
export function OrderContractChips(state: OrderRelatedLinkState): OrderContractView {
    const contract = state.Contract;
    const warning = NoExecutedAgreementWarning(state);
    if (!holds(state.DealID) || !contract) {
        return { Chips: [], AwaitingNote: null, Warning: warning };
    }
    const name = ContractChipName(contract) || 'Open';
    const chips: ResolvedRelatedChip[] = [chip('contract', 'Contract', name, 'fa-solid fa-file-contract', MJS_FOREIGN_ENTITIES.Contract, contract.ID)];
    const agreement = state.Agreement;
    if (agreement && holds(agreement.ID)) {
        chips.push(chip('agreement', 'Executed agreement', agreement.Name || 'Open', 'fa-solid fa-file-signature', MJS_FOREIGN_ENTITIES.File, agreement.ID));
    }
    const awaiting = contract.IsAwaitingDocument === true && !agreement && !warning;
    return { Chips: chips, AwaitingNote: awaiting ? 'Awaiting signed agreement' : null, Warning: warning };
}

/**
 * The "No executed agreement" warning (bc-aidp-next-golive#443, g443.1 A: warn, sending unchanged).
 *
 * The finance report of orders missing a deal, contract or executed agreement is a sales query of
 * its own (bc-aidp-next-golive#388); this chip is the order form's half of the same control.
 *
 * - ONLY FOR AN ORDER A WON DEAL NAMES (g443.2 A). The panel only finds a deal through `Deal.OrderID`,
 *   so renewals, checkout orders and conversions never reach this. An open or lost deal has no
 *   agreement to expect yet. A reversal reaches the deal through the order it reverses and is
 *   skipped: the deal names the original order, and the warning belongs there.
 * - NOT FOR A VOIDED ORDER, which sends no invoice, so "Invoices still send" would be untrue.
 * - THE GAP is no contract, or a contract `vwContracts` reports as awaiting its executed agreement. A
 *   contract type that needs no paper (`RequiresExecutedDocument = 0`, Payment Link) never reports
 *   awaiting, so it counts as covered.
 * - SILENT WHEN UNSURE. A deal status or contract lookup that did not answer produces no warning: a
 *   chip saying "no contract" because a read was refused would be a false alarm finance learns to skip.
 *
 * Apart from voided, the order's status is not consulted: the chip also warns on a draft order of a
 * won deal, which is when the gap can still be closed before sending.
 */
export function NoExecutedAgreementWarning(state: OrderRelatedLinkState): OrderAgreementWarning | null {
    if (!holds(state.DealID) || state.DealIsWon !== true || state.ContractRead !== true) {
        return null;
    }
    if (state.ViaReversedOrder === true || state.OrderVoided === true) {
        return null;
    }
    const contract = state.Contract;
    if (!contract) {
        return { Label: 'No executed agreement', Detail: 'This order comes from a won deal with no contract. Invoices still send.' };
    }
    if (contract.IsAwaitingDocument === true) {
        return { Label: 'No executed agreement', Detail: 'The contract has no file marked as its executed agreement. Invoices still send.' };
    }
    return null;
}

function chip(key: string, label: string, name: string, icon: string, entityName: string, recordID: string): ResolvedRelatedChip {
    return { Key: key, Label: label, Name: name, Icon: icon, EntityName: entityName, PrimaryKeyField: 'ID', RecordID: recordID, AriaLabel: `Open ${label} ${name}` };
}
