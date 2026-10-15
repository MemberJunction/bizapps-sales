/**
 * @fileoverview Which Sales Contacts belong to a Sales Account (bizapps-sales#301).
 *
 * Sales Contacts carry no account column. The one place a person is tied to an organization is
 * Common's Relationship row, so the account's contacts are the people on the other end of an active
 * Relationship with it. Sales Accounts is an IsA child of Organizations and Sales Contacts an IsA child
 * of People (TPT), so the account ID is the Organization ID and a contact's ID is the Person ID.
 *
 * Both directions count. "Dana is an employee of Northwind" is stored From the person To the
 * organization; "Northwind employs Dana" is the same fact stored the other way round, and both are
 * legal rows. Every relationship type counts: who matters on a deal is not always an employee, and the
 * type is data, so this does not pick types by name.
 *
 * Kept out of the panel so the filter can be tested without Angular.
 *
 * @module @mj-biz-apps/sales-ng
 */

const sqlString = (value: string): string => `'${value.replace(/'/g, "''")}'`;

/**
 * The filter on the Sales Contacts view that selects an account's contacts.
 *
 * `relationshipTable` is the Relationships entity's schema and base table, read from metadata so the
 * schema name is not hardcoded here. `Status` is a fixed set held by a CHECK constraint on Common's
 * table (Active / Inactive / Ended), not a type table, so naming the active value is the only way to
 * leave out a person who has left.
 */
export function AccountContactsWhere(
    accountId: string,
    relationshipTable: { SchemaName: string; BaseTable: string },
): string {
    const table = `[${relationshipTable.SchemaName}].[${relationshipTable.BaseTable}]`;
    const id = sqlString(accountId);
    return (
        `ID IN (` +
        `SELECT FromPersonID FROM ${table} WHERE ToOrganizationID = ${id} AND FromPersonID IS NOT NULL AND Status = 'Active' ` +
        `UNION ` +
        `SELECT ToPersonID FROM ${table} WHERE FromOrganizationID = ${id} AND ToPersonID IS NOT NULL AND Status = 'Active'` +
        `)`
    );
}
