import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import type { BaseEntity, EntityFieldInfo, EntityInfo } from '@memberjunction/core';
import type { FormContext } from '@memberjunction/ng-base-forms';

import {
    ACCOUNT_CREATE_FIELDS,
    CONTACT_CREATE_FIELDS,
    CreateFieldType,
    CreateFields,
    MoreDetailFields,
} from '../lib/form-panels/party-create';
import { OwnAccountValues } from '../lib/form-panels/party-create-data';
import { CreateCardContext, GENERATED_DETAILS_SECTION } from '../lib/custom/party-create-forms.component';

/**
 * NEW ACCOUNT AND CONTACT FORMS SHOWED EVERY RAW FIELD (bc-aidp-next-golive#435).
 *
 * The create card asks for the agreed fields first (g435.1 A, g435.3 A) and lists the rest under
 * "More details", read from metadata. These pin the lists, the "rest" rule, and that the generated
 * Details section is hidden only while the record is new.
 */

type FieldShape = Partial<EntityFieldInfo> & { Name: string };

function field(f: FieldShape, sequence: number): EntityFieldInfo {
    return {
        Type: 'nvarchar', Length: 200, AllowUpdateAPI: true, IsPrimaryKey: false, IsVirtual: false,
        RelatedEntity: null, Description: null, Sequence: sequence, ...f,
    } as EntityFieldInfo;
}

function entity(fields: FieldShape[]): EntityInfo {
    return { Fields: fields.map((f, i) => field(f, i + 1)) } as EntityInfo;
}

const ACCOUNT = entity([
    { Name: 'ID', IsPrimaryKey: true, AllowUpdateAPI: false, Type: 'uniqueidentifier' },
    { Name: 'OwnerEmployeeID', Type: 'uniqueidentifier', RelatedEntity: 'MJ: Employees' },
    { Name: 'AccountTypeID', Type: 'uniqueidentifier', RelatedEntity: 'MJ_BizApps_Sales: Account Types' },
    { Name: 'Territory' },
    { Name: 'FirstClosedWonDate', Type: 'date' },
    { Name: 'IsActive', Type: 'bit' },
    { Name: '__mj_CreatedAt', Type: 'datetimeoffset', AllowUpdateAPI: false },
    { Name: 'Name', IsVirtual: true },
    { Name: 'ParentID', IsVirtual: true, Type: 'uniqueidentifier', RelatedEntity: 'MJ_BizApps_Common: Organizations' },
    { Name: 'Website', IsVirtual: true },
    { Name: 'Description', IsVirtual: true, Length: -1 },
    { Name: 'Phone', IsVirtual: true },
    { Name: 'TaxID', IsVirtual: true, Description: 'Only needed for invoicing.' },
    { Name: 'AccountType', IsVirtual: true, AllowUpdateAPI: false },
]);

describe('the new account card', () => {
    it('asks for the agreed six fields in the agreed order', () => {
        expect(CreateFields(ACCOUNT, ACCOUNT_CREATE_FIELDS).map((f) => f.Name)).toEqual([
            'Name', 'AccountTypeID', 'OwnerEmployeeID', 'Website', 'Phone', 'ParentID',
        ]);
    });

    it('keeps every other field a person may set under More details, Tax ID with its help text', () => {
        const more = MoreDetailFields(ACCOUNT, ACCOUNT_CREATE_FIELDS);
        expect(more.map((f) => f.Name)).toEqual(['Territory', 'IsActive', 'Description', 'TaxID']);
        expect(more.find((f) => f.Name === 'TaxID')?.Help).toBe('Only needed for invoicing.');
    });

    it('leaves out the key, system columns, joined names and the server-stamped first-won date', () => {
        const names = MoreDetailFields(ACCOUNT, ACCOUNT_CREATE_FIELDS).map((f) => f.Name);
        for (const absent of ['ID', '__mj_CreatedAt', 'AccountType', 'FirstClosedWonDate']) {
            expect(names).not.toContain(absent);
        }
    });

    it('draws foreign keys as record pickers', () => {
        const owner = CreateFields(ACCOUNT, ACCOUNT_CREATE_FIELDS).find((f) => f.Name === 'OwnerEmployeeID');
        expect(owner?.LinkType).toBe('Record');
    });
});

describe('the new contact card', () => {
    it('asks for first, last, email, phone and title; the account is a Relationship, not a field', () => {
        expect(CONTACT_CREATE_FIELDS).toEqual(['FirstName', 'LastName', 'Email', 'Phone', 'Title']);
    });
});

describe('CreateFieldType', () => {
    it.each([
        ['bit', 200, 'checkbox'],
        ['date', 3, 'datepicker'],
        ['datetimeoffset', 10, 'datepicker'],
        ['nvarchar', -1, 'textarea'],
        ['nvarchar', 200, 'textbox'],
    ])('%s(%i) is a %s', (type, length, expected) => {
        expect(CreateFieldType(field({ Name: 'X', Type: type, Length: length }, 1))).toBe(expected);
    });
});

describe('CreateCardContext', () => {
    const context = { hiddenSectionKeys: ['other'] } as FormContext;

    it('hides the generated Details section while the record is new', () => {
        const hidden = CreateCardContext(context, { IsSaved: false } as BaseEntity).hiddenSectionKeys;
        expect(hidden).toEqual(['other', GENERATED_DETAILS_SECTION]);
    });

    it('leaves a saved record on the generated layout', () => {
        expect(CreateCardContext(context, { IsSaved: true } as BaseEntity)).toBe(context);
    });
});

describe('OwnAccountValues', () => {
    it("copies only the account's own typed fields onto an existing organization", () => {
        const fields = [
            { Name: 'AccountTypeID', Dirty: true, Value: 't1', EntityFieldInfo: field({ Name: 'AccountTypeID' }, 1) },
            { Name: 'Territory', Dirty: false, Value: null, EntityFieldInfo: field({ Name: 'Territory' }, 2) },
            { Name: 'Name', Dirty: true, Value: 'Typed', EntityFieldInfo: field({ Name: 'Name', IsVirtual: true }, 3) },
            { Name: 'ID', Dirty: true, Value: 'x', EntityFieldInfo: field({ Name: 'ID', IsPrimaryKey: true }, 4) },
        ];
        expect(OwnAccountValues({ Fields: fields } as unknown as BaseEntity)).toEqual({ AccountTypeID: 't1' });
    });
});
