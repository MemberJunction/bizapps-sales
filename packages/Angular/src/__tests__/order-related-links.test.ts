import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
    ContractChipName,
    ContractFileLinksFilter,
    ContractLookupFilter,
    DealLookupOrderID,
    EXECUTED_AGREEMENT_FILE_CATEGORY,
    ExecutedAgreementFileFilter,
    NoExecutedAgreementWarning,
    OrderContractChips,
    OrderRelatedLinks,
    OrderRelatedLinksKey,
    ShouldReadAgreement,
    type OrderContractRow,
} from '../lib/form-panels/order-related-links';
import { MJS_ENTITIES, MJS_FOREIGN_ENTITIES } from '../lib/data/entity-names';

/**
 * bc-aidp-next-golive#227: an order that came from a deal said nothing about it. The header names the
 * status, type, company, dates and parties, and nothing pointed back at what caused the order to
 * exist.
 *
 * WHAT IS PINNED HERE AND WHAT IS NOT. Whether a chip may be DRAWN — the entity missing from the
 * catalog, the record that is not there, the read the server refused, the name that would otherwise
 * be a raw id — belongs to `bizapps-related-chips` and is pinned by common's own `related-links`
 * tests. What is ours, and what these cover, is which relationships an order HAS: that the contract
 * is reached through the deal and cannot appear without it, and that the row is empty rather than
 * decorative for an order nobody raised from a deal.
 */
const DEAL = 'D1B0F0A6-0000-4000-8000-000000000001';
const CONTRACT = 'C0A7E3B2-0000-4000-8000-000000000002';

describe('#227 — what an order offers to open', () => {
    it('offers the deal that produced it', () => {
        const links = OrderRelatedLinks({ DealID: DEAL });
        expect(links).toHaveLength(1);
        expect(links[0]).toMatchObject({
            Key: 'deal',
            EntityName: MJS_ENTITIES.Deal,
            RecordID: DEAL,
            Label: 'Deal',
        });
    });

    it('offers the contract reached through that deal, after it', () => {
        const links = OrderRelatedLinks({ DealID: DEAL, ContractID: CONTRACT });
        expect(links.map((l) => l.Key)).toEqual(['deal', 'contract']);
        expect(links[1]).toMatchObject({
            EntityName: MJS_FOREIGN_ENTITIES.Contract,
            RecordID: CONTRACT,
            Label: 'Contract',
        });
    });

    /**
     * The ordinary case for an open deal: it has produced an order to price against and no agreement
     * yet. One chip, not one chip and a gap.
     */
    it('offers only the deal when that deal has no contract', () => {
        expect(OrderRelatedLinks({ DealID: DEAL, ContractID: null }).map((l) => l.Key)).toEqual(['deal']);
    });

    /**
     * The one that matters most. An order keyed directly has no provenance to show, and the row must
     * be ABSENT rather than an empty strip above the header — the chip row renders nothing for an
     * empty list, so returning one is the whole of that behaviour.
     */
    it('offers nothing for an order that came from no deal', () => {
        expect(OrderRelatedLinks({})).toEqual([]);
    });

    /**
     * A contract id can only have come from a deal row, so there is no honest state in which one
     * appears alone. Pinned because the day someone passes a contract id from somewhere else, a chip
     * claiming a relationship the data model does not record is worse than no chip.
     */
    it('never offers a contract without the deal it was reached through', () => {
        expect(OrderRelatedLinks({ ContractID: CONTRACT })).toEqual([]);
    });

    it('treats a blank id as no record rather than as one', () => {
        expect(OrderRelatedLinks({ DealID: '   ' })).toEqual([]);
        expect(OrderRelatedLinks({ DealID: DEAL, ContractID: '  ' }).map((l) => l.Key)).toEqual(['deal']);
    });
});

/**
 * The key is what stops the chip row from clearing and re-reading on every record refresh, so it has
 * to move when — and only when — the links would differ.
 */
describe('#227 — the links key', () => {
    it('is stable for the same order and the same provenance', () => {
        const state = { DealID: DEAL, ContractID: CONTRACT };
        expect(OrderRelatedLinksKey('order-1', state)).toBe(OrderRelatedLinksKey('order-1', { ...state }));
    });

    /**
     * A form container reuses one panel instance across records. Without the order id in the key, an
     * order with no deal opened after one with a deal would keep the first order's chips — a click
     * that opens the provenance of a record the reader has left.
     */
    it('moves when the form navigates to another order', () => {
        const state = { DealID: DEAL };
        expect(OrderRelatedLinksKey('order-1', state)).not.toBe(OrderRelatedLinksKey('order-2', state));
    });

    it('moves when a contract appears on the deal behind the order', () => {
        expect(OrderRelatedLinksKey('order-1', { DealID: DEAL })).not.toBe(
            OrderRelatedLinksKey('order-1', { DealID: DEAL, ContractID: CONTRACT }),
        );
    });
});

describe('bizapps-orders#740 — a reversal finds the deal of the order it reverses', () => {
    it('looks an ordinary order up by its own id', () => {
        expect(DealLookupOrderID({ ID: 'order-1', ReversesOrderHeaderID: null })).toBe('order-1');
    });

    it('looks a reversal up by the order it reverses', () => {
        expect(DealLookupOrderID({ ID: 'rev-1', ReversesOrderHeaderID: 'order-1' })).toBe('order-1');
    });

    it('treats a blank origin as no origin', () => {
        expect(DealLookupOrderID({ ID: 'order-1', ReversesOrderHeaderID: '  ' })).toBe('order-1');
    });

    it('answers null for an order with no id yet', () => {
        expect(DealLookupOrderID({ ID: null, ReversesOrderHeaderID: null })).toBeNull();
        expect(DealLookupOrderID(null)).toBeNull();
    });
});

/**
 * bc-aidp-next-golive#445: reviewing an order meant going deal → contract → back, and the signed paper
 * was never on the order at all. The From row now names the contract by number and status, opens its
 * executed agreement, and says when the agreement is still missing.
 */
const FILE = 'F11E0000-0000-4000-8000-000000000003';
const ACTIVE: OrderContractRow = { ID: CONTRACT, ContractNumber: 'CTR-000123', State: 'Active', IsAwaitingDocument: false };
const AWAITING: OrderContractRow = { ...ACTIVE, State: 'Draft', IsAwaitingDocument: true };

describe('#445 — finding the contract behind the deal', () => {
    it('uses Deal.ContractID when the deal holds one', () => {
        expect(ContractLookupFilter({ DealID: DEAL, ContractID: CONTRACT })).toBe(`ID = '${CONTRACT}'`);
    });

    /** The case the issue suspects: a contract the close created, with the deal's link never written. */
    it('falls back to the contract the deal created when Deal.ContractID is empty', () => {
        expect(ContractLookupFilter({ DealID: DEAL, ContractID: null })).toBe(
            `CreatingEntity = '${MJS_ENTITIES.Deal}' AND CreatingRecordID = '${DEAL}'`,
        );
        expect(ContractLookupFilter({ DealID: DEAL, ContractID: '  ' })).toContain('CreatingRecordID');
    });

    it('looks for nothing without a deal', () => {
        expect(ContractLookupFilter({})).toBeNull();
    });

    it('escapes quotes in the ids it embeds', () => {
        expect(ContractLookupFilter({ DealID: "a'b" })).toContain("CreatingRecordID = 'a''b'");
    });
});

describe('#445 — finding the executed agreement', () => {
    it('lists the files linked to the contract by entity name and record', () => {
        expect(ContractFileLinksFilter(CONTRACT)).toBe(`Entity = '${MJS_FOREIGN_ENTITIES.Contract}' AND RecordID = '${CONTRACT}'`);
    });

    it('picks the linked file in the Executed Agreement category', () => {
        expect(ExecutedAgreementFileFilter([FILE, 'other'])).toBe(`Category = 'Executed Agreement' AND ID IN ('${FILE}','other')`);
    });

    it('reads no files when none is linked', () => {
        expect(ExecutedAgreementFileFilter([])).toBeNull();
        expect(ExecutedAgreementFileFilter(['  '])).toBeNull();
    });

    /** The view says awaiting exactly when no such file exists, so the two reads would find nothing. */
    it('skips the file reads for a contract the view reports as awaiting', () => {
        expect(ShouldReadAgreement(AWAITING)).toBe(false);
        expect(ShouldReadAgreement(ACTIVE)).toBe(true);
        expect(ShouldReadAgreement(null)).toBe(false);
    });

    /** Same spelling as contracts' seed and vwContracts, or every contract reads as having no agreement. */
    it('spells the category as the contracts migration seeds it', () => {
        expect(EXECUTED_AGREEMENT_FILE_CATEGORY).toBe('Executed Agreement');
    });
});

describe('#445 — what the From row shows for the contract', () => {
    it('names the contract by number and status', () => {
        const view = OrderContractChips({ DealID: DEAL, ContractID: CONTRACT, Contract: ACTIVE });
        const contract = view.Chips.find((c) => c.Key === 'contract');
        expect(contract).toMatchObject({ EntityName: MJS_FOREIGN_ENTITIES.Contract, RecordID: CONTRACT, Label: 'Contract', Name: 'CTR-000123 · Active' });
    });

    it('opens the executed agreement file when one is linked', () => {
        const view = OrderContractChips({ DealID: DEAL, Contract: ACTIVE, Agreement: { ID: FILE, Name: 'Signed SOW.pdf' } });
        const agreement = view.Chips.find((c) => c.Key === 'agreement');
        expect(agreement).toMatchObject({ EntityName: MJS_FOREIGN_ENTITIES.File, RecordID: FILE, Label: 'Executed agreement', Name: 'Signed SOW.pdf' });
        expect(view.AwaitingNote).toBeNull();
    });

    it('says "Awaiting signed agreement" when the contract needs paper and has none', () => {
        const view = OrderContractChips({ DealID: DEAL, Contract: AWAITING });
        expect(view.Chips.map((c) => c.Key)).toEqual(['contract']);
        expect(view.AwaitingNote).toBe('Awaiting signed agreement');
    });

    /** A Payment Link needs no paper: nothing is missing, so nothing is said. */
    it('says nothing about an agreement the contract type does not require', () => {
        const view = OrderContractChips({ DealID: DEAL, Contract: ACTIVE, Agreement: null });
        expect(view.Chips.map((c) => c.Key)).toEqual(['contract']);
        expect(view.AwaitingNote).toBeNull();
    });

    it('draws no contract chip without a contract row or a deal', () => {
        expect(OrderContractChips({ DealID: DEAL, ContractID: CONTRACT })).toEqual({ Chips: [], AwaitingNote: null, Warning: null });
        expect(OrderContractChips({ Contract: ACTIVE })).toEqual({ Chips: [], AwaitingNote: null, Warning: null });
    });

    /** One contract chip, never two: with the row read, the shared row's plain contract link is dropped. */
    it('drops the plain contract link once the contract row is read', () => {
        expect(OrderRelatedLinks({ DealID: DEAL, ContractID: CONTRACT, Contract: ACTIVE }).map((l) => l.Key)).toEqual(['deal']);
    });

    it('keeps the plain contract link when the contract row could not be read', () => {
        expect(OrderRelatedLinks({ DealID: DEAL, ContractID: CONTRACT, Contract: null }).map((l) => l.Key)).toEqual(['deal', 'contract']);
    });

    it('shows a number alone, or a status alone, without a stray separator', () => {
        expect(ContractChipName({ ...ACTIVE, State: null })).toBe('CTR-000123');
        expect(ContractChipName({ ...ACTIVE, ContractNumber: null })).toBe('Active');
    });

    it('moves the links key when the contract status or agreement changes', () => {
        const base = { DealID: DEAL, ContractID: CONTRACT, Contract: AWAITING };
        expect(OrderRelatedLinksKey('order-1', base)).not.toBe(OrderRelatedLinksKey('order-1', { ...base, Contract: ACTIVE }));
        expect(OrderRelatedLinksKey('order-1', { ...base, Contract: ACTIVE })).not.toBe(
            OrderRelatedLinksKey('order-1', { ...base, Contract: ACTIVE, Agreement: { ID: FILE, Name: 'x' } }),
        );
    });
});

/** The panel template must reach these chips; pinned so a template edit cannot drop them silently. */
describe('#445 — the panel renders the contract view', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const panel = readFileSync(resolve(here, '../lib/form-panels/order-related.panel.ts'), 'utf8');
    it('binds the contract chips and the awaiting note', () => {
        expect(panel).toContain('ContractView.Chips');
        expect(panel).toContain('ContractView.AwaitingNote');
        expect(panel).toContain('this.ContractView = OrderContractChips(state)');
    });
});

/**
 * bc-aidp-next-golive#443: an invoice could go to Bill.com for an order whose contract had no signed
 * agreement, and nothing said so. g443.1 A: warn, sending unchanged. g443.2 A: won-deal orders only.
 */
describe('#443 — the "No executed agreement" warning', () => {
    const won = { DealID: DEAL, DealIsWon: true, ContractRead: true };

    it('warns for a won deal with no contract', () => {
        const warning = NoExecutedAgreementWarning({ ...won, Contract: null });
        expect(warning?.Label).toBe('No executed agreement');
        expect(warning?.Detail).toContain('no contract');
    });

    it('warns for a won deal whose contract awaits its executed agreement', () => {
        expect(NoExecutedAgreementWarning({ ...won, Contract: AWAITING })?.Label).toBe('No executed agreement');
    });

    it('says nothing when the executed agreement is linked', () => {
        expect(NoExecutedAgreementWarning({ ...won, Contract: ACTIVE, Agreement: { ID: FILE, Name: 'x' } })).toBeNull();
    });

    /** Payment Link: its type needs no paper, so vwContracts never reports it awaiting. Counted as covered. */
    it('treats a contract whose type needs no paper as covered', () => {
        expect(NoExecutedAgreementWarning({ ...won, Contract: ACTIVE, Agreement: null })).toBeNull();
    });

    /** g443.2 A: an open or lost deal has no agreement to expect yet. */
    it('says nothing for a deal that is not won, or whose status is unknown', () => {
        expect(NoExecutedAgreementWarning({ ...won, DealIsWon: false, Contract: null })).toBeNull();
        expect(NoExecutedAgreementWarning({ ...won, DealIsWon: null, Contract: null })).toBeNull();
    });

    /** Renewals, checkout orders and conversions reach the panel with no deal at all. */
    it('says nothing for an order no deal names', () => {
        expect(NoExecutedAgreementWarning({ DealIsWon: true, ContractRead: true, Contract: null })).toBeNull();
    });

    /** The deal names the order a reversal reverses; the warning belongs on that order, not this one. */
    it('says nothing for a reversal reached through the order it reverses', () => {
        expect(NoExecutedAgreementWarning({ ...won, Contract: null, ViaReversedOrder: true })).toBeNull();
    });

    /** A voided order sends no invoice, so "Invoices still send" would be untrue. */
    it('says nothing for a voided order', () => {
        expect(NoExecutedAgreementWarning({ ...won, Contract: AWAITING, OrderVoided: true })).toBeNull();
    });

    it('moves the links key when the order becomes voided', () => {
        const base = { ...won, Contract: null };
        expect(OrderRelatedLinksKey('o', base)).not.toBe(OrderRelatedLinksKey('o', { ...base, OrderVoided: true }));
    });

    /** A refused or thrown contract read is not evidence that the contract is missing. */
    it('says nothing when the contract lookup did not answer', () => {
        expect(NoExecutedAgreementWarning({ DealID: DEAL, DealIsWon: true, Contract: null })).toBeNull();
    });

    it('replaces the muted awaiting note with the warning, keeping the contract chip', () => {
        const view = OrderContractChips({ ...won, ContractID: CONTRACT, Contract: AWAITING });
        expect(view.Chips.map((c) => c.Key)).toEqual(['contract']);
        expect(view.AwaitingNote).toBeNull();
        expect(view.Warning?.Label).toBe('No executed agreement');
    });

    it('keeps the muted note for an awaiting contract on a deal that is not won', () => {
        const view = OrderContractChips({ DealID: DEAL, DealIsWon: false, ContractRead: true, Contract: AWAITING });
        expect(view.AwaitingNote).toBe('Awaiting signed agreement');
        expect(view.Warning).toBeNull();
    });

    it('warns with no contract chip when the won deal has no contract', () => {
        const view = OrderContractChips({ ...won, Contract: null });
        expect(view.Chips).toEqual([]);
        expect(view.Warning?.Label).toBe('No executed agreement');
    });

    it('moves the links key when the deal is won or the contract read answers', () => {
        const base = { DealID: DEAL, Contract: null };
        expect(OrderRelatedLinksKey('o', base)).not.toBe(OrderRelatedLinksKey('o', { ...base, DealIsWon: true }));
        expect(OrderRelatedLinksKey('o', { ...base, DealIsWon: true })).not.toBe(
            OrderRelatedLinksKey('o', { ...base, DealIsWon: true, ContractRead: true }),
        );
    });
});
