import { describe, it, expect } from 'vitest';
import { DealRelatedLinks, DealRelatedLinksKey } from '../lib/form-panels/deal-related-links';

/**
 * bc-aidp-next-golive#226 — what the Deal header offers to open, and what it must not.
 *
 * WHAT IS TESTED HERE AND WHAT IS NOT. The chip row itself belongs to `@mj-biz-apps/common-ng`, and
 * its own rules — no chip for an entity this host lacks, none for a record that is not there, never
 * a raw id where a name belongs — are pinned by that package's tests. Re-asserting them here would
 * be testing someone else's code through a layer.
 *
 * What sales owns is WHICH relationships a deal has, and that is what these pin. The one that
 * matters most is the negative: item 4 asks for the order to be UNREACHABLE from an open deal,
 * because the order is still a draft nobody should be editing directly. A rule that quietly started
 * emitting the order link on every deal would look completely normal on the won deal everyone tests.
 */
const ORDER = 'MJ_BizApps_Orders: Order Headers';
const CONTRACT = 'MJ_BizApps_Contracts: Contracts';

/** A won deal that has everything — the case each test below removes one thing from. */
const wonWithEverything = {
    IsWon: true,
    OrderID: 'order-1',
    ContractID: 'contract-1',
    RenewsContractID: 'contract-0',
};

const keysOf = (links: { Key: string }[]) => links.map((l) => l.Key);

describe('#226 — a won deal reaches its order and its contract', () => {
    it('offers Order and Contract', () => {
        const links = DealRelatedLinks({ IsWon: true, OrderID: 'order-1', ContractID: 'contract-1' });
        expect(keysOf(links)).toEqual(['order', 'contract']);
    });

    it('points each link at the right entity and id', () => {
        const links = DealRelatedLinks(wonWithEverything);
        expect(links.find((l) => l.Key === 'order')).toMatchObject({ EntityName: ORDER, RecordID: 'order-1' });
        expect(links.find((l) => l.Key === 'contract')).toMatchObject({ EntityName: CONTRACT, RecordID: 'contract-1' });
    });

    /**
     * A won deal whose close could not raise the downstream record — `LiveOrdersSeam` and
     * `LiveContractsSeam` both commit the close and report `Executed: false` when the sibling app is
     * not installed. The deal is genuinely won and genuinely has no contract, so the chip that would
     * name one must not appear.
     */
    it('offers only what the deal actually holds', () => {
        expect(keysOf(DealRelatedLinks({ IsWon: true, OrderID: 'order-1', ContractID: null }))).toEqual(['order']);
        expect(keysOf(DealRelatedLinks({ IsWon: true, OrderID: null, ContractID: 'contract-1' }))).toEqual(['contract']);
    });

    /** A blank id is an absent record, not a record named "   ". */
    it('treats a blank id as no record', () => {
        expect(DealRelatedLinks({ IsWon: true, OrderID: '   ', ContractID: '' })).toEqual([]);
    });
});

describe('#226 item 4 — an open deal cannot reach its draft order', () => {
    /**
     * THE ONE THIS FILE EXISTS FOR. The tester found an order link on open deals, "where the order is
     * still a draft nobody should be editing directly". Reps price inside the deal; the order becomes
     * reachable once the deal is won. The hero's chips are the only order link on the form now — the
     * Motion panel's `OrderID` link came off in the same change — so this assertion is the whole of
     * that behaviour, not a decoration on it.
     */
    it('offers no order chip, even though the deal holds an OrderID', () => {
        const links = DealRelatedLinks({ IsWon: false, OrderID: 'order-1' });
        expect(keysOf(links)).not.toContain('order');
    });

    it('offers no contract chip either', () => {
        const links = DealRelatedLinks({ IsWon: false, OrderID: 'order-1', ContractID: 'contract-1' });
        expect(links).toEqual([]);
    });

    /**
     * A LOST deal is the other half of "neither chip appears on open or lost deals". It reaches the
     * same rule by the same route — `IsWon` is false — and is asserted separately because a future
     * edit that gated on `IsLocked` instead would pass every open-deal test above and light both
     * chips up on every lost deal.
     */
    it('offers nothing on a lost deal, which is closed but not won', () => {
        expect(DealRelatedLinks({ IsWon: false, OrderID: 'order-1', ContractID: 'contract-1' })).toEqual([]);
    });
});

describe('#226 item 2 — a renewal shows what it renews, at any status', () => {
    it('offers the renewed contract on an OPEN deal', () => {
        const links = DealRelatedLinks({ IsWon: false, RenewsContractID: 'contract-0' });
        expect(keysOf(links)).toEqual(['renews']);
        expect(links[0]).toMatchObject({ EntityName: CONTRACT, RecordID: 'contract-0' });
    });

    it('keeps it alongside the other two on a won renewal', () => {
        expect(keysOf(DealRelatedLinks(wonWithEverything))).toEqual(['order', 'contract', 'renews']);
    });

    /**
     * The renewed contract and the contract the win produced are two DIFFERENT records of the SAME
     * entity. Nothing may collapse them: a chip row tracks by `Key`, so two links sharing one would
     * render a single chip and silently drop the other.
     */
    it('distinguishes the contract produced from the contract renewed', () => {
        const links = DealRelatedLinks(wonWithEverything);
        const ids = links.filter((l) => l.EntityName === CONTRACT).map((l) => l.RecordID);
        expect(ids).toEqual(['contract-1', 'contract-0']);
        expect(new Set(keysOf(links)).size).toBe(links.length);
    });
});

describe('the cache key moves exactly when the answer does', () => {
    /**
     * The chip row re-resolves on a new array reference, so the hero caches its links and rebuilds
     * only when this key changes. A key that missed a field would leave the previous deal's chips on
     * screen — a click that opens a record belonging to a deal the reader has left.
     */
    it('changes when the outcome changes', () => {
        const open = DealRelatedLinksKey('deal-1', { IsWon: false, OrderID: 'order-1' });
        const won = DealRelatedLinksKey('deal-1', { IsWon: true, OrderID: 'order-1' });
        expect(open).not.toBe(won);
    });

    it('changes when the form moves to another deal', () => {
        const a = DealRelatedLinksKey('deal-1', wonWithEverything);
        const b = DealRelatedLinksKey('deal-2', wonWithEverything);
        expect(a).not.toBe(b);
    });

    it('changes when any one of the three ids changes', () => {
        const base = DealRelatedLinksKey('deal-1', wonWithEverything);
        expect(DealRelatedLinksKey('deal-1', { ...wonWithEverything, OrderID: 'order-2' })).not.toBe(base);
        expect(DealRelatedLinksKey('deal-1', { ...wonWithEverything, ContractID: 'contract-2' })).not.toBe(base);
        expect(DealRelatedLinksKey('deal-1', { ...wonWithEverything, RenewsContractID: 'contract-2' })).not.toBe(base);
    });

    it('holds still when nothing changed, so the row is not re-resolved on every pass', () => {
        expect(DealRelatedLinksKey('deal-1', wonWithEverything)).toBe(DealRelatedLinksKey('deal-1', wonWithEverything));
    });
});
