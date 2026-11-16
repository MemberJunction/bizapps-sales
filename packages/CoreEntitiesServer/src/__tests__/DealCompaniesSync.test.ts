import { describe, expect, it } from 'vitest';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';
import { AddMissingDealCompanies, DEAL_COMPANY_ENTITY } from '../deal-companies-sync.js';

/**
 * THE DEAL'S COMPANY LIST HOLDS ITS BILLING COMPANY AND EVERY LINE'S COMPANY (golive #484).
 *
 * The provider is faked: the reads return the rows given, and every inserted row is recorded. The
 * database half (the rows really landing inside the deal save's transaction) is unverified here.
 */

const DEAL = '11111111-0000-4000-8000-000000000001';
const ORDER = '22222222-0000-4000-8000-000000000002';
const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';
const C = 'cccccccc-0000-4000-8000-000000000003';

type Params = { EntityName: string; ExtraFilter: string };

function fakeProvider(listed: string[], lineCompanies: string[], opts: { failRead?: boolean; failSave?: boolean } = {}) {
    const inserted: Array<{ DealID: string; CompanyID: string }> = [];
    const reads: Params[][] = [];
    const provider = {
        RunViews: async (params: Params[]) => {
            reads.push(params);
            return params.map((p) => {
                if (opts.failRead) return { Success: false, ErrorMessage: 'boom', Results: [] };
                const ids = p.EntityName === DEAL_COMPANY_ENTITY ? listed : lineCompanies;
                return { Success: true, Results: ids.map((CompanyID) => ({ CompanyID })) };
            });
        },
        GetEntityObject: async () => {
            const row = {
                DealID: '',
                CompanyID: '',
                NewRecord: () => true,
                LatestResult: { CompleteMessage: 'refused' },
                Save: async () => {
                    if (opts.failSave) return false;
                    inserted.push({ DealID: row.DealID, CompanyID: row.CompanyID });
                    return true;
                },
            };
            return row;
        },
    };
    return { provider: provider as unknown as IMetadataProvider, inserted, reads };
}

const user = {} as UserInfo;

describe('AddMissingDealCompanies', () => {
    it('adds the billing company and each missing line company once', async () => {
        const { provider, inserted } = fakeProvider([], [B, B, C]);
        const added = await AddMissingDealCompanies({ DealID: DEAL, CompanyID: A, OrderID: ORDER }, provider, user);
        expect(added).toEqual([A, B, C]);
        expect(inserted).toEqual([A, B, C].map((CompanyID) => ({ DealID: DEAL, CompanyID })));
    });

    it('adds nothing when every required company is listed, whatever the case', async () => {
        const { provider, inserted } = fakeProvider([A.toUpperCase(), B], [B]);
        expect(await AddMissingDealCompanies({ DealID: DEAL, CompanyID: A, OrderID: ORDER }, provider, user)).toEqual([]);
        expect(inserted).toEqual([]);
    });

    it('never removes a listed company the deal does not require', async () => {
        const { provider, inserted } = fakeProvider([C], []);
        expect(await AddMissingDealCompanies({ DealID: DEAL, CompanyID: A, OrderID: ORDER }, provider, user)).toEqual([A]);
        expect(inserted).toEqual([{ DealID: DEAL, CompanyID: A }]);
    });

    it('reads no lines for a deal with no order', async () => {
        const { provider, reads } = fakeProvider([], []);
        await AddMissingDealCompanies({ DealID: DEAL, CompanyID: A, OrderID: null }, provider, user);
        expect(reads[0].map((p) => p.EntityName)).toEqual([DEAL_COMPANY_ENTITY]);
    });

    it('filters both reads by the deal and its order', async () => {
        const { provider, reads } = fakeProvider([], []);
        await AddMissingDealCompanies({ DealID: DEAL, CompanyID: A, OrderID: ORDER }, provider, user);
        expect(reads[0].map((p) => p.ExtraFilter)).toEqual([`DealID = '${DEAL}'`, `OrderHeaderID = '${ORDER}'`]);
    });

    it('throws on a failed read, so the save rolls back', async () => {
        const { provider } = fakeProvider([], [], { failRead: true });
        await expect(AddMissingDealCompanies({ DealID: DEAL, CompanyID: A, OrderID: ORDER }, provider, user)).rejects.toThrow(/boom/);
    });

    it('throws on a refused insert, so the save rolls back', async () => {
        const { provider } = fakeProvider([], [], { failSave: true });
        await expect(AddMissingDealCompanies({ DealID: DEAL, CompanyID: A, OrderID: null }, provider, user)).rejects.toThrow(/refused/);
    });

    it('refuses an id that is not a GUID before it reaches a filter', async () => {
        const { provider } = fakeProvider([], []);
        await expect(AddMissingDealCompanies({ DealID: "x' OR 1=1 --", CompanyID: A, OrderID: null }, provider, user)).rejects.toThrow(/not a valid id/);
    });
});
