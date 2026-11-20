import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import type { BaseEntity } from '@memberjunction/core';

import { DealFormComponentExtended } from '../lib/custom/deal-form.component';
import type { DealSave } from '../lib/data/deal-saves';
import { MJS_ENTITIES } from '../lib/data/entity-names';

/**
 * A REOPENED DEAL SHOWED THE STAGE IT HAD WHEN ITS TAB FIRST OPENED (bc-aidp-next-golive#419).
 *
 * Explorer re-focuses a deal's open tab rather than loading the deal again, and the board's stage move
 * saves its own copy of the deal. The form now reloads when another copy of its deal is saved. These
 * tests pin when it may: the reload must never land on top of the user's own unsaved work.
 *
 * `RefreshRecord` is counted rather than run: running it needs a provider, and what is under test is
 * the decision to call it.
 */

interface FormState {
    EditMode?: boolean;
    Dirty?: boolean;
    PendingDirty?: boolean;
    AdditionalUnsaved?: boolean;
}

function form(state: FormState = {}) {
    const record = { Get: (field: string) => (field === 'ID' ? 'DEAL-1' : null), Dirty: state.Dirty ?? false };
    const instance = Object.create(DealFormComponentExtended.prototype) as DealFormComponentExtended & { Refreshes: number };
    let refreshes = 0;
    for (const [k, v] of Object.entries({
        record,
        EditMode: state.EditMode ?? false,
        PendingRecordsDirty: () => state.PendingDirty ?? false,
        RefreshRecord: async () => { refreshes += 1; return true; },
    })) {
        Object.defineProperty(instance, k, { value: v, writable: true });
    }
    Object.defineProperty(instance, 'HasAdditionalUnsavedChanges', { get: () => state.AdditionalUnsaved ?? false });
    Object.defineProperty(instance, 'Refreshes', { get: () => refreshes });
    return { instance, record: record as unknown as BaseEntity };
}

function saveOf(dealID: string, entityName: string = MJS_ENTITIES.Deal, record?: BaseEntity): DealSave {
    return { EntityName: entityName, DealID: dealID, Record: record ?? ({} as BaseEntity) };
}

describe('the deal form reloads when its deal is saved elsewhere', () => {
    it('reloads after another copy of the same deal was saved, as the board does on a stage move', async () => {
        const { instance } = form();
        expect(await instance.OnDealSaved(saveOf('deal-1'))).toBe(true);
        expect(instance.Refreshes).toBe(1);
    });

    it('ignores a save of a different deal', async () => {
        const { instance } = form();
        await instance.OnDealSaved(saveOf('DEAL-2'));
        expect(instance.Refreshes).toBe(0);
    });

    it('ignores its own save, which already holds the saved values', async () => {
        const { instance, record } = form();
        await instance.OnDealSaved(saveOf('DEAL-1', MJS_ENTITIES.Deal, record));
        expect(instance.Refreshes).toBe(0);
    });

    it('ignores a team row save; the deal save that follows it is the one that changes the owner', async () => {
        const { instance } = form();
        await instance.OnDealSaved(saveOf('DEAL-1', MJS_ENTITIES.DealTeamMember));
        expect(instance.Refreshes).toBe(0);
    });
});

describe('the reload never lands on unsaved work', () => {
    const cases: Array<[string, FormState]> = [
        ['in edit mode', { EditMode: true }],
        ['with a dirty record', { Dirty: true }],
        ['with dirty pending records', { PendingDirty: true }],
        ['with unsaved changes outside the record', { AdditionalUnsaved: true }],
    ];
    for (const [label, state] of cases) {
        it(`does not reload ${label}`, async () => {
            const { instance } = form(state);
            expect(await instance.OnDealSaved(saveOf('DEAL-1'))).toBe(false);
            expect(instance.Refreshes).toBe(0);
        });
    }
});
