import { describe, expect, it } from 'vitest';
import { DealContactsSummary, type DealContactSummaryPart } from '../lib/form-panels/deal-contacts-summary';

/**
 * The line above the deal's Customer contacts grid (golive#428). A name is printed only when it is the
 * viewer's to read and is the saved contact's name.
 */
const part = (label: string, over: Partial<DealContactSummaryPart> = {}): DealContactSummaryPart => ({
    Label: label, Name: null, Readable: true, Changed: false, ...over,
});

describe('the deal contacts summary', () => {
    it('names both contacts', () => {
        expect(DealContactsSummary([
            part('Primary contact', { Name: 'Pat Primary' }),
            part('Billing contact', { Name: 'Bo Billing' }),
        ])).toBe('Primary contact: Pat Primary · Billing contact: Bo Billing');
    });

    it('says none for a contact the deal does not have', () => {
        expect(DealContactsSummary([part('Primary contact', { Name: 'Pat Primary' }), part('Billing contact')]))
            .toBe('Primary contact: Pat Primary · Billing contact: none');
        expect(DealContactsSummary([part('Primary contact', { Name: '' })])).toBe('Primary contact: none');
    });

    it('does not print the saved name of a contact that has an unsaved change', () => {
        // The ID changed; the name column still holds the previous person until the deal is saved.
        const text = DealContactsSummary([
            part('Primary contact', { Name: 'Previous Person', Changed: true }),
            part('Billing contact', { Name: null, Changed: true }),
        ]);
        expect(text).toBe('Primary contact: changed, not saved yet · Billing contact: changed, not saved yet');
        expect(text).not.toContain('Previous Person');
        expect(text).not.toContain('none');
    });

    it('leaves out a contact the viewer may not read', () => {
        expect(DealContactsSummary([
            part('Primary contact', { Name: 'Pat Primary' }),
            part('Billing contact', { Name: 'Bo Billing', Readable: false }),
        ])).toBe('Primary contact: Pat Primary');
    });

    it('is absent when the viewer may read neither', () => {
        expect(DealContactsSummary([
            part('Primary contact', { Readable: false }),
            part('Billing contact', { Readable: false }),
        ])).toBeNull();
    });
});
