import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DealFieldLabel } from '../close-lock';

/**
 * THE LOCK NOTICE NAMES FIELDS BY THE LABELS THE FORM SHOWS (#387).
 *
 * `DealFieldLabel` builds the field list in the closed-deal notice and the server's refusal. The form's
 * labels come from metadata, and `metadata/entity-fields/.deal-field-labels.json` relabelled "Deal
 * Status Type" to "Status"; the notice kept saying "Deal Status", a field the user could not find.
 * This reads that file and requires every relabel to agree with `DealFieldLabel`.
 *
 * A relabel targets either a column (`BillingContactID`, `MRR`) or the VIRTUAL name field of a foreign
 * key (`DealStatusType`, for `DealStatusTypeID`), because the form reads the virtual one when there is
 * one. The lock always names the column, so a row on a virtual name field is checked against `<name>ID`.
 */
interface LabelRow {
    fields: { DisplayName?: string };
    primaryKey: { ID: string };
}

const rows = JSON.parse(
    readFileSync(new URL('../../../../metadata/entity-fields/.deal-field-labels.json', import.meta.url), 'utf8'),
) as LabelRow[];

/** The deal field a metadata row relabels, and the column the lock would name for it. */
function lockColumn(row: LabelRow): string {
    const name = row.primaryKey.ID.split('Name=')[1];
    const isColumn = name.endsWith('ID') || name === name.toUpperCase();
    return isColumn ? name : `${name}ID`;
}

describe('the lock notice labels agree with metadata', () => {
    it('reads the Deal rows it is meant to, so the checks below are not vacuous', () => {
        const dealRows = rows.filter((r) => r.primaryKey.ID.includes('Entity=MJ_BizApps_Sales: Deals&'));
        expect(dealRows.map(lockColumn)).toContain('DealStatusTypeID');
    });

    for (const row of rows) {
        const column = lockColumn(row);
        const label = row.fields.DisplayName;
        if (!label) continue;
        it(`${column} reads "${label}", as the form shows it`, () => {
            expect(DealFieldLabel(column)).toBe(label);
        });
    }
});
