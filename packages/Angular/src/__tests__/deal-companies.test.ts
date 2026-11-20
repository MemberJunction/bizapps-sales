import { describe, expect, it } from 'vitest';
import { DealCompanyRows } from '../lib/form-panels/deal-companies';

/** The deal form's Companies panel rows (golive #484). */

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';
const C = 'cccccccc-0000-4000-8000-000000000003';
const NAMES = [{ ID: A, Name: 'Alpha' }, { ID: B, Name: 'Beta' }, { ID: C, Name: 'Gamma' }];

describe('DealCompanyRows', () => {
    it('shows the billing company first, then line companies, then the rest, each once', () => {
        const rows = DealCompanyRows(A, [C], [B, A, C], NAMES);
        expect(rows.map((r) => r.Name)).toEqual(['Alpha', 'Gamma', 'Beta']);
    });

    it('marks the billing company and the line companies so they cannot be removed', () => {
        const rows = DealCompanyRows(A, [C], [B], NAMES);
        expect(rows.find((r) => r.Name === 'Alpha')).toMatchObject({ IsBilling: true, HasProducts: false });
        expect(rows.find((r) => r.Name === 'Gamma')).toMatchObject({ IsBilling: false, HasProducts: true });
        expect(rows.find((r) => r.Name === 'Beta')).toMatchObject({ IsBilling: false, HasProducts: false });
    });

    it('shows a required company before its row is saved', () => {
        expect(DealCompanyRows(A, [], [], NAMES).map((r) => r.CompanyID)).toEqual([A]);
    });

    it('names a company it cannot find rather than dropping it', () => {
        expect(DealCompanyRows(null, [], ['dddddddd-0000-4000-8000-000000000004'], NAMES)[0].Name).toBe('Unknown company');
    });
});
