/**
 * @fileoverview The writes behind the create cards (bc-aidp-next-golive#435).
 *
 * A Sales Account is an IsA child of Organization (same ID). An account for an organization that
 * already exists is the organization's Sales Account row, not a second organization: the existing
 * Organization is loaded and `EnsureISAChild` adds the child to it, so every Organization field is
 * inherited as it is. A new contact's account is a Relationship row from the person to the
 * organization, written once the contact exists.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { Metadata, RunView, type BaseEntity } from '@memberjunction/core';
import type { mjBizAppsCommonOrganizationEntity } from '@mj-biz-apps/common-entities';

import { MJS_ENTITIES, MJS_FOREIGN_ENTITIES } from '../data/entity-names';

export interface PartyWriteResult {
    Success: boolean;
    /** The saved record's ID, when it saved. */
    ID: string | null;
    Message: string | null;
}

export interface RelationshipTypeOption {
    ID: string;
    Name: string;
}

const sqlString = (value: string): string => `'${value.replace(/'/g, "''")}'`;

/** The fields typed on the new record that belong to the Sales Account itself, not to the Organization. */
export function OwnAccountValues(record: BaseEntity): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const field of record.Fields) {
        const info = field.EntityFieldInfo;
        if (field.Dirty && !info.IsVirtual && !info.IsPrimaryKey && info.AllowUpdateAPI) {
            values[field.Name] = field.Value;
        }
    }
    return values;
}

/** Whether the organization already has a Sales Account row. */
export async function IsSalesAccount(organizationID: string): Promise<boolean> {
    const result = await new RunView().RunView<{ ID: string }>({
        EntityName: MJS_ENTITIES.SalesAccount,
        ExtraFilter: `ID = ${sqlString(organizationID)}`,
        Fields: ['ID'],
        ResultType: 'simple',
        MaxRows: 1,
    });
    return result.Success && (result.Results ?? []).length > 0;
}

/** Adds a Sales Account to an existing Organization, with the account's own fields from `values`. */
export async function SalesAccountFromOrganization(
    organizationID: string,
    values: Record<string, unknown>,
): Promise<PartyWriteResult> {
    const md = new Metadata();
    const organization = await md.GetEntityObject<mjBizAppsCommonOrganizationEntity>(MJS_FOREIGN_ENTITIES.Organization);
    if (!(await organization.Load(organizationID))) {
        return { Success: false, ID: null, Message: 'The organization could not be read.' };
    }
    const account = await organization.EnsureISAChild(MJS_ENTITIES.SalesAccount);
    if (!account) {
        return { Success: false, ID: null, Message: 'The organization cannot take a sales account.' };
    }
    for (const [name, value] of Object.entries(values)) {
        account.Set(name, value);
    }
    if (!(await account.Save())) {
        return { Success: false, ID: null, Message: account.LatestResult?.Message || 'The sales account was not saved.' };
    }
    return { Success: true, ID: organizationID, Message: null };
}

/** The relationship types a person can have with an organization, active ones only, by name. */
export async function PersonToOrganizationTypes(): Promise<RelationshipTypeOption[]> {
    const result = await new RunView().RunView<RelationshipTypeOption>({
        EntityName: MJS_FOREIGN_ENTITIES.RelationshipType,
        // Category is a fixed set held by a CHECK constraint on Common's table, like Relationship.Status.
        ExtraFilter: `Category = 'PersonToOrganization' AND IsActive = 1`,
        OrderBy: 'Name',
        Fields: ['ID', 'Name'],
        ResultType: 'simple',
    });
    return result.Success ? (result.Results ?? []).map((r) => ({ ID: String(r.ID), Name: String(r.Name) })) : [];
}

/** Links a saved contact to an account with an active Relationship from the person to the organization. */
export async function LinkContactToAccount(
    contactID: string,
    accountID: string,
    relationshipTypeID: string,
    title: string | null,
): Promise<PartyWriteResult> {
    const relationship = await new Metadata().GetEntityObject<BaseEntity>(MJS_FOREIGN_ENTITIES.Relationship);
    relationship.NewRecord();
    relationship.Set('RelationshipTypeID', relationshipTypeID);
    relationship.Set('FromPersonID', contactID);
    relationship.Set('ToOrganizationID', accountID);
    relationship.Set('Status', 'Active');
    if (title) relationship.Set('Title', title);
    if (!(await relationship.Save())) {
        return { Success: false, ID: null, Message: relationship.LatestResult?.Message || 'The account link was not saved.' };
    }
    return { Success: true, ID: String(relationship.Get('ID')), Message: null };
}
