import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    DealPaymentColumns,
    DealPipelineGridState,
    WON_DEAL_PAYMENTS_VIEW_NAME,
    WonDealPaymentsGridState,
} from '../lib/pages/deal-views';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const read = (path: string): string => readFileSync(join(REPO, path), 'utf8');

type SavedView = { fields: { Name: string; GridState: string; WhereClause?: string } };
const savedGrid = (file: string, name: string): ReturnType<typeof WonDealPaymentsGridState> => {
    const rows = JSON.parse(read(file)) as SavedView[];
    const row = rows.find((r) => r.fields.Name === name);
    if (!row) throw new Error(`no saved view named ${name} in ${file}`);
    return JSON.parse(row.fields.GridState) as ReturnType<typeof WonDealPaymentsGridState>;
};

const PAYMENT_FIELDS = ['PaymentStatus', 'OutstandingBalance', 'InvoiceCount', 'InvoicedAmount', 'PaidAmount', 'NextPaymentDueDate'];

/**
 * WON DEALS SHOW WHETHER THEIR INVOICES ARE PAID (bc-aidp-next-golive#487).
 *
 * The columns live in two places a grid reads: the saved views in metadata/user-views, and the fallback
 * grid states here that stand in until the metadata is pushed. These pin the two together.
 */
describe('deal payment columns (bc-aidp-next-golive#487)', () => {
    it('All Deals shows payment and balance due and keeps the other payment columns one click away', () => {
        const pay = DealPipelineGridState().columnSettings.filter((c) => PAYMENT_FIELDS.includes(c.Name));
        expect(pay.map((c) => c.Name)).toEqual(PAYMENT_FIELDS);
        expect(pay.filter((c) => !c.hidden).map((c) => c.Name)).toEqual(['PaymentStatus', 'OutstandingBalance']);
    });

    it('numbers every column of both grids in order', () => {
        for (const grid of [DealPipelineGridState(), WonDealPaymentsGridState()]) {
            expect(grid.columnSettings.map((c) => c.orderIndex)).toEqual(grid.columnSettings.map((_, i) => i));
        }
    });

    it('shows every payment column in the won deals view, sorted on a column the grid holds', () => {
        const grid = WonDealPaymentsGridState();
        const names = grid.columnSettings.map((c) => c.Name);
        expect(names).toEqual(expect.arrayContaining(PAYMENT_FIELDS));
        expect(grid.columnSettings.some((c) => c.hidden)).toBe(false);
        for (const s of grid.sortSettings) expect(names).toContain(s.field);
    });

    it('formats the money columns as currency', () => {
        const money = DealPaymentColumns(0).filter((c) => ['OutstandingBalance', 'InvoicedAmount', 'PaidAmount'].includes(c.Name));
        expect(money).toHaveLength(3);
        for (const c of money) expect(c.format).toMatchObject({ type: 'currency' });
    });

    it('ships the same payment columns in the Sales: Pipeline saved view', () => {
        const saved = savedGrid('metadata/user-views/.sales-pipeline-view.json', 'Sales: Pipeline');
        const fromCode = DealPipelineGridState().columnSettings.filter((c) => PAYMENT_FIELDS.includes(c.Name));
        expect(saved.columnSettings.filter((c) => PAYMENT_FIELDS.includes(c.Name))).toEqual(fromCode);
    });

    it('ships the won deals view as the code defines it, filtered by the payment columns, not a status name', () => {
        expect(savedGrid('metadata/user-views/.won-deal-payments-view.json', WON_DEAL_PAYMENTS_VIEW_NAME)).toEqual(WonDealPaymentsGridState());
        const rows = JSON.parse(read('metadata/user-views/.won-deal-payments-view.json')) as SavedView[];
        expect(rows[0].fields.WhereClause).toBe('PaymentStatus IS NOT NULL');
    });
});

describe('one payment status rule (bc-aidp-next-golive#487)', () => {
    const migration = read('migrations/V202611170200__v6.32.x__Deal_Payment_Status.sql');
    const ddl = migration.split('CODEGEN OUTPUT')[0];
    const query = read('metadata/queries/SQL/won-deal-payments.sql');

    it('writes each status once, in fnDealPaymentStatus, and both the rows and the deal roll-up call it', () => {
        for (const status of ['Not invoiced', 'Partly paid', 'Outstanding', 'Paid']) {
            expect(ddl.match(new RegExp(`THEN N'${status}'`, 'g'))).toHaveLength(1);
        }
        expect(ddl.match(/\[fnDealPaymentStatus\]\(/g)).toHaveLength(2);
    });

    it('reads won deals by the IsWon flag and leaves canceled and written-off instalments out', () => {
        expect(ddl).toContain('st.IsWon = 1');
        expect(ddl).toContain("s.Status NOT IN (N'Canceled', N'WrittenOff')");
        // No overdue status until due dates are reliable (bc-aidp-next-golive#481); comments may say so.
        const code = ddl.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
        expect(code).not.toMatch(/Overdue/i);
    });

    it('lists the invoices the deal columns sum, with the deal roster filter bar', () => {
        expect(query).toContain('vwWonDealInvoices');
        expect(query).not.toMatch(/'(Paid|Outstanding|Partly paid|Not invoiced)'/);
        const roster = read('metadata/queries/SQL/deal-roster.sql');
        for (const p of ['CompanyID', 'CompanyIDs', 'PipelineID', 'PipelineIDs', 'OwnerEmployeeID', 'OwnerEmployeeIDs', 'ProductCompanyIDs']) {
            expect(roster).toContain(`{% if ${p} %}`);
            expect(query).toContain(`{% if ${p} %}`);
        }
    });
});
