import { describe, expect, it } from 'vitest';
import { KeptOnDealNote, ReadOutcome, ToOrderRow } from '../deal-schedule-to-order.js';

/**
 * THE DEAL'S SCHEDULE REACHES ITS ORDER (bc-aidp-next-golive#290) — the two pure halves of the copy:
 * how a deal row is handed to orders, and how orders' answer is read. The database half is the
 * close-deal integration checks.
 */
describe('ToOrderRow', () => {
    it('sends the calendar day the row names, whatever shape it was read in', () => {
        expect(ToOrderRow({ PaymentDate: new Date('2026-10-15T00:00:00Z'), Amount: 2500, Description: 'Q1' })).toEqual({
            DueDate: '2026-10-15',
            Amount: 2500,
            Description: 'Q1',
        });
        expect(ToOrderRow({ PaymentDate: '2026-10-15T00:00:00.000Z', Amount: 2500.03, Description: null }).DueDate).toBe('2026-10-15');
    });

    it('sends an incomplete row as it is, so orders refuses it by name', () => {
        const row = ToOrderRow({ PaymentDate: null, Amount: null, Description: 'balance on delivery' });
        expect(row.DueDate).toBe('');
        expect(Number.isNaN(row.Amount)).toBe(true);
    });
});

describe('ReadOutcome', () => {
    const base = { Rows: [], Kept: 0, Written: 0, Removed: 0, WasPreview: false };

    it('reads success from the OUTPUT, not the envelope', () => {
        expect(ReadOutcome({ ...base, Success: true, Changed: true })).toEqual({ Kind: 'Synced', Changed: true });
        expect(ReadOutcome(null, 'not registered')).toEqual({
            Kind: 'Hard',
            Message: "The deal's payment schedule could not be sent to its order: not registered",
        });
    });

    it.each(['TIE_FAILED', 'INVALID_ROW'] as const)('treats %s as soft: the deal edit stands', (Code) => {
        expect(ReadOutcome({ ...base, Success: false, Changed: false, Code, Message: 'off by 0.01' })).toEqual({ Kind: 'Soft', Message: 'off by 0.01' });
    });

    it.each(['INVOICED_ROW_CHANGED', 'ORDER_VOIDED', 'BILLED_WITHOUT_SCHEDULE', 'SCHEDULE_REQUIRED', 'PER_COMPANY_SCHEDULE', 'WRITE_FAILED'] as const)(
        'treats %s as hard: the deal edit is rolled back',
        (Code) => {
            expect(ReadOutcome({ ...base, Success: false, Changed: false, Code, Message: 'no' }).Kind).toBe('Hard');
        },
    );

    it('says what happened when the edit is kept', () => {
        expect(KeptOnDealNote('off by 0.01.')).toContain('its order still has the previous schedule: off by 0.01.');
    });
});
