import { describe, expect, it } from 'vitest';
import { pickContractType } from '../LiveContractsSeam.js';

/**
 * WHICH CONTRACT TYPE A CLOSE-WON POLICY NAMES.
 *
 * The policy value is matched against contracts' `ContractType.Code` first and its `Name` second, so
 * the lookup keeps working across releases of the two apps: before contracts had a `Code`, after it
 * gained one, and while a policy still names the label. These cases pin that order.
 */

const ORDER_FORM = '33333333-0000-4000-8000-000000001001';
const OTHER = '33333333-0000-4000-8000-000000009999';

describe('pickContractType', () => {
    it('matches a Code', () => {
        const rows = [{ ID: ORDER_FORM, Code: 'ORDER_FORM', Name: 'Order Form' }];
        expect(pickContractType(rows, 'ORDER_FORM', true)).toEqual({ ID: ORDER_FORM, By: '' });
    });

    it('falls back to Name when no Code matches, and says so', () => {
        const rows = [{ ID: ORDER_FORM, Code: 'ORDER_FORM', Name: 'Order Form' }];
        const picked = pickContractType(rows, 'Order Form', true);
        expect(picked.ID).toBe(ORDER_FORM);
        expect(picked.By).toContain('matched on Name');
    });

    it('prefers the Code match when one type has the value as its Code and another as its Name', () => {
        const rows = [
            { ID: OTHER, Code: 'LEGACY', Name: 'ORDER_FORM' },
            { ID: ORDER_FORM, Code: 'ORDER_FORM', Name: 'Order Form' },
        ];
        expect(pickContractType(rows, 'ORDER_FORM', true)).toEqual({ ID: ORDER_FORM, By: '' });
    });

    it('matches on Name when contracts has no Code column', () => {
        const rows = [{ ID: ORDER_FORM, Name: 'Order Form' }];
        const picked = pickContractType(rows, 'Order Form', false);
        expect(picked.ID).toBe(ORDER_FORM);
        expect(picked.By).toContain('no Code column');
    });

    it('ignores case, as SQL Server did when it returned the rows', () => {
        const rows = [{ ID: ORDER_FORM, Code: 'ORDER_FORM', Name: 'Order Form' }];
        expect(pickContractType(rows, 'order_form', true).ID).toBe(ORDER_FORM);
        expect(pickContractType(rows, 'order form', true).ID).toBe(ORDER_FORM);
    });

    it('returns no ID when nothing matches', () => {
        expect(pickContractType([], 'ORDER_FORM', true)).toEqual({ ID: null, By: '' });
    });
});
