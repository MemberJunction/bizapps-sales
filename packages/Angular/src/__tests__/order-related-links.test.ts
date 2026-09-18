import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { OrderRelatedLinks, OrderRelatedLinksKey } from '../lib/form-panels/order-related-links';
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
