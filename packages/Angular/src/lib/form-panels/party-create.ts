/**
 * @fileoverview What the new Sales Account and Sales Contact forms ask for first (bc-aidp-next-golive#435).
 *
 * A new account or contact opened the generated form: one section listing every column of the record
 * and of the Organization or Person it extends (Tax ID, Logo URL, Date of Birth, Linked User ...).
 * The create cards ask for the agreed fields first and keep the rest in a collapsed "More details".
 * The lists and the rules live here so they can be tested without Angular.
 *
 * @module @mj-biz-apps/sales-ng
 */
import type { EntityFieldInfo, EntityInfo } from '@memberjunction/core';

/** g435.1 A: what a new account asks for, in this order. */
export const ACCOUNT_CREATE_FIELDS: readonly string[] = [
    'Name',
    'AccountTypeID',
    'OwnerEmployeeID',
    'Website',
    'Phone',
    'ParentID',
];

/** The account fields that come from the Organization, so an existing organization already fills them. */
export const ACCOUNT_ORGANIZATION_FIELDS: readonly string[] = ['Name', 'Website', 'Phone', 'ParentID'];

/** g435.3 A: what a new contact asks for, in this order. The account is a Relationship, not a field. */
export const CONTACT_CREATE_FIELDS: readonly string[] = ['FirstName', 'LastName', 'Email', 'Phone', 'Title'];

/**
 * Fields the server stamps, left out of "More details" so a new record does not offer them.
 * FirstClosedWonDate is set when the account's first deal closes won.
 */
const SERVER_STAMPED_FIELDS: ReadonlySet<string> = new Set(['FirstClosedWonDate']);

export type CreateFieldType = 'textbox' | 'textarea' | 'datepicker' | 'checkbox';

export interface CreateFieldSpec {
    Name: string;
    Type: CreateFieldType;
    /** 'Record' for a foreign key, so `mj-form-field` offers the related record's picker. */
    LinkType: 'Record' | 'None';
    /** The field's metadata description, shown under it as help text. */
    Help: string | null;
}

/** How `mj-form-field` should draw a field, from its SQL type. */
export function CreateFieldType(field: EntityFieldInfo): CreateFieldType {
    const sqlType = (field.Type ?? '').toLowerCase();
    if (sqlType === 'bit') return 'checkbox';
    if (sqlType === 'date' || sqlType.startsWith('datetime')) return 'datepicker';
    if (field.Length === -1) return 'textarea';
    return 'textbox';
}

function toSpec(field: EntityFieldInfo): CreateFieldSpec {
    const help = (field.Description ?? '').trim();
    return {
        Name: field.Name,
        Type: CreateFieldType(field),
        LinkType: field.RelatedEntity ? 'Record' : 'None',
        Help: help || null,
    };
}

/** A field a person may set on a new record: writable, not the key, not a system or server-stamped column. */
function isUserEditable(field: EntityFieldInfo): boolean {
    return (
        field.AllowUpdateAPI &&
        !field.IsPrimaryKey &&
        !field.Name.startsWith('__mj_') &&
        !SERVER_STAMPED_FIELDS.has(field.Name)
    );
}

/** The listed fields that exist on the entity, in the listed order. */
export function CreateFields(entity: EntityInfo, names: readonly string[]): CreateFieldSpec[] {
    return names
        .map((name) => entity.Fields.find((f) => f.Name === name))
        .filter((f): f is EntityFieldInfo => !!f && isUserEditable(f))
        .map(toSpec);
}

/**
 * Every other field a person may set, in the entity's field order. Read from metadata rather than
 * listed, so a column added later shows up here without a code change.
 */
export function MoreDetailFields(entity: EntityInfo, first: readonly string[]): CreateFieldSpec[] {
    const taken = new Set(first);
    return [...entity.Fields]
        .sort((a, b) => a.Sequence - b.Sequence)
        .filter((f) => isUserEditable(f) && !taken.has(f.Name))
        .map(toSpec);
}
