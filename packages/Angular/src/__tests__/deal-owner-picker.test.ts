import '@angular/compiler';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import { MJSDealPartyPanel } from '../lib/form-panels/deal-form.panels';

/**
 * The deal's owner can be changed from the Account & people panel (#253).
 *
 * `OwnerEmployeeID` is a server-maintained stamp derived from the deal team's owner-role row, so the
 * picker never writes the column: it calls `DealEntity.SetOwner`, which swaps that team row, and the
 * server derives the stamp from it on save. Company stays read-only and points at the Pipeline panel's
 * Company control, which is what changes it.
 */

const BOB = 'bbbbbbbb-0000-4000-8000-000000000002';
const OWNER = { name: 'OwnerEmployeeID', type: 'textbox' } as const;

function dealStub(isSaved: boolean, failWith?: Error): DealEntity & { Owners: Array<string | null> } {
    const stub = {
        IsSaved: isSaved,
        Owners: [] as Array<string | null>,
        async SetOwner(employeeID: string | null): Promise<void> {
            if (failWith) throw failWith;
            stub.Owners.push(employeeID);
        },
    };
    return stub as unknown as DealEntity & { Owners: Array<string | null> };
}

function panel(deal: DealEntity, editMode: boolean): MJSDealPartyPanel {
    const p = new MJSDealPartyPanel();
    p.Record = deal;
    Object.defineProperty(p, 'EditMode', { value: editMode, configurable: true });
    return p;
}

describe('deal form: the owner picker', () => {
    it('a pick goes through SetOwner, the deal-team path', async () => {
        const deal = dealStub(true);
        await panel(deal, true).OnOwnerChange(BOB);
        expect(deal.Owners).toEqual([BOB]);
    });

    it('reports a failed change instead of dropping it', async () => {
        const p = panel(dealStub(true, new Error('no owner role')), true);
        await p.OnOwnerChange(BOB);
        expect(p.OwnerError()).toMatch(/no owner role/);
    });

    it('shows on a saved deal in edit mode only', () => {
        expect(panel(dealStub(true), true).ShowsOwnerPicker(OWNER)).toBe(true);
        expect(panel(dealStub(true), false).ShowsOwnerPicker(OWNER), 'read mode').toBe(false);
        expect(panel(dealStub(false), true).ShowsOwnerPicker(OWNER), 'unsaved deal').toBe(false);
        expect(panel(dealStub(true), true).ShowsOwnerPicker({ name: 'CompanyID', type: 'textbox' })).toBe(false);
    });

    it('labels the picker Owner, not the column name', () => {
        expect(panel(dealStub(true), true).OwnerLabel).toBe('Owner');
    });

    it('never makes the owner or company column itself editable', () => {
        const p = panel(dealStub(true), true);
        expect(p.FieldEditable('OwnerEmployeeID')).toBe(false);
        expect(p.FieldEditable('CompanyID')).toBe(false);
    });
});

describe('deal form: the Company field points at the control that changes it', () => {
    const source = readFileSync(new URL('../lib/form-panels/deal-form.panels.ts', import.meta.url), 'utf8');

    it('names the Pipeline panel\'s Company control', () => {
        const hint = source.match(/data-testid="deal-company-hint">([^<]+)</)?.[1];
        expect(hint, 'a Company hint').toBeDefined();
        expect(hint).toMatch(/Set by the pipeline/);
        expect(hint).toMatch(/Company on the Pipeline panel/);
    });
});
