import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/**
 * bc-aidp-next-golive#443: the query, the shared user view and the order header's warning chip state one
 * rule three times — a won deal's confirmed or invoiced order whose contract (Deal.ContractID, else the
 * contract the close created) has no executed agreement. The SQL cannot share code with the chip, so
 * each part of the rule is pinned in both SQL texts here, and a change to one that is not made to the
 * other fails.
 */
const root = new URL('../../../../metadata/', import.meta.url);
const sql = readFileSync(new URL('queries/SQL/orders-invoiced-without-executed-agreement.sql', root), 'utf8');
const query = JSON.parse(readFileSync(new URL('queries/.orders-invoiced-without-executed-agreement.json', root), 'utf8')) as Array<{
    fields: Record<string, unknown>;
    primaryKey: { ID: string };
    sync?: unknown;
}>;
const view = JSON.parse(readFileSync(new URL('user-views/.orders-invoiced-without-executed-agreement.json', root), 'utf8')) as Array<{
    fields: Record<string, unknown>;
    primaryKey: { ID: string };
    sync?: unknown;
}>;
const where = String(view[0].fields.WhereClause);

/** Collapse whitespace and the N'' prefix so the two texts compare on content, not layout. */
const norm = (text: string): string => text.replace(/N'/g, "'").replace(/\s+/g, ' ');

const RULE: Array<[string, string]> = [
    ['won is the IsWon flag', 'st.IsWon = 1'],
    ['the order a won deal names', 'OrderID IS NOT NULL'],
    ['confirmed', "Status = 'Confirmed'"],
    ['or a sent Bill.com invoice', "Status = 'Sent'"],
    ['covered means not awaiting', 'IsAwaitingDocument = 0'],
    ['the fallback contract a close created', "CreatingEntity = 'MJ_BizApps_Sales: Deals'"],
    ['matched by the deal id', 'CreatingRecordID = CAST('],
];

describe('#443 — query and user view state the same rule', () => {
    for (const [what, token] of RULE) {
        it(`both carry: ${what}`, () => {
            expect(norm(sql)).toContain(token);
            expect(norm(where)).toContain(token);
        });
    }

    it('both read the contract through Deal.ContractID first', () => {
        expect(norm(sql)).toContain('c.ID = w.ContractID');
        expect(norm(where)).toContain('c.ID = d.ContractID');
    });

    it('both test coverage over every candidate contract, not one picked row', () => {
        expect(norm(sql)).toContain('NOT EXISTS');
        expect(norm(where)).toContain('NOT EXISTS');
    });

    /** Without CustomWhereClause, MJUserViewEntityExtended rebuilds WhereClause on save and lists every order. */
    it('keeps the hand-written WhereClause', () => {
        expect(view[0].fields.CustomWhereClause).toBe(true);
        expect(view[0].fields.EntityID).toBe('@lookup:MJ: Entities.Name=MJ_BizApps_Orders: Order Headers');
        expect(view[0].fields.IsShared).toBe(true);
    });

    it('files the query under the Sales category with the SQL from its file', () => {
        expect(query[0].fields.CategoryID).toBe('@lookup:MJ: Query Categories.Name=Sales');
        expect(query[0].fields.SQL).toBe('@file:SQL/orders-invoiced-without-executed-agreement.sql');
    });

    /** CLAUDE.md: metadata PRs contribute declarative JSON only — no sync block. */
    it('ships no sync block', () => {
        expect(query[0].sync).toBeUndefined();
        expect(view[0].sync).toBeUndefined();
    });
});
