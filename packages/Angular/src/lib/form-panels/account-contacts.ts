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
 * `relationshipView` is the Relationships entity's schema and base view, read from metadata so the
 * schema name is not hardcoded here. It must be the base view, not the base table: MJAPI refuses an
 * ExtraFilter subquery that reads anything other than an entity base view, and the whole grid then
 * fails to load. The two directions are two `IN` subqueries joined by OR rather than one UNION,
 * because MJ refuses UNION anywhere in a caller-supplied filter. `Status` is a fixed set held by a CHECK constraint on Common's
 * table (Active / Inactive / Ended), not a type table, so naming the active value is the only way to
 * leave out a person who has left.
 */
export function AccountContactsWhere(
    accountId: string,
    relationshipView: { SchemaName: string; BaseView: string },
): string {
    const view = `[${relationshipView.SchemaName}].[${relationshipView.BaseView}]`;
    const id = sqlString(accountId);
    return (
        `(ID IN (SELECT FromPersonID FROM ${view} WHERE ToOrganizationID = ${id} AND FromPersonID IS NOT NULL AND Status = 'Active')` +
        ` OR ` +
        `ID IN (SELECT ToPersonID FROM ${view} WHERE FromOrganizationID = ${id} AND ToPersonID IS NOT NULL AND Status = 'Active'))`
    );
}

/**
 * The filter on the Sales Accounts view that selects the accounts a contact works at (#442): the same
 * Relationship rows read from the person's end. Same rules as {@link AccountContactsWhere}: both
 * directions, every relationship type, active links only, base view, OR rather than UNION. An
 * organization that is not a Sales Account is left out, because the rows are Sales Accounts.
 */
export function ContactAccountsWhere(
    contactId: string,
    relationshipView: { SchemaName: string; BaseView: string },
): string {
    const view = `[${relationshipView.SchemaName}].[${relationshipView.BaseView}]`;
    const id = sqlString(contactId);
    return (
        `(ID IN (SELECT ToOrganizationID FROM ${view} WHERE FromPersonID = ${id} AND ToOrganizationID IS NOT NULL AND Status = 'Active')` +
        ` OR ` +
        `ID IN (SELECT FromOrganizationID FROM ${view} WHERE ToPersonID = ${id} AND FromOrganizationID IS NOT NULL AND Status = 'Active'))`
    );
}

/**
 * The filter on the Relationships view that finds an ACTIVE link between one person and one account,
 * in either direction (#443). The Contacts panel reads it before linking a person, so the same person
 * is not linked twice: both directions, because {@link AccountContactsWhere} lists a person stored
 * either way round, and active only, because an ended link is history and does not list the person.
 */
export function ExistingAccountLinkWhere(personId: string, accountId: string): string {
    const person = sqlString(personId);
    const account = sqlString(accountId);
    return (
        `Status = 'Active' AND (` +
        `(FromPersonID = ${person} AND ToOrganizationID = ${account})` +
        ` OR ` +
        `(FromOrganizationID = ${account} AND ToPersonID = ${person}))`
    );
}

/**
 * The relationship types offered when linking a person to an account: active person-to-organization
 * types. `Category` is a fixed set held by a CHECK constraint on Common's table, like `Status`, so this
 * names a structural category, not a type by name; which types exist is still data.
 */
export const PERSON_TO_ORGANIZATION_TYPES_WHERE = "Category = 'PersonToOrganization' AND IsActive = 1";
