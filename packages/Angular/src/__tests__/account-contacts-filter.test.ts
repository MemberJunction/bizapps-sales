import { describe, it, expect } from 'vitest';
import { AccountContactsWhere, ContactAccountsWhere } from '../lib/form-panels/account-contacts';

/**
 * bizapps-sales#301: an account listed nobody who works there. Sales Contacts carry no account
 * column, so the account's Contacts panel selects the people on the other end of an active Common
 * Relationship with it. These pin which rows that filter admits; the panel's chrome is pinned with the
 * other related panels in `unsaved-record-empty-states`.
 */
const ACCOUNT = 'A0111111-0000-4000-A000-000000000001';
const VIEW = { SchemaName: '__mj_BizAppsCommon', BaseView: 'vwRelationships' };

describe('#301 — the people an account lists', () => {
    const where = AccountContactsWhere(ACCOUNT, VIEW);

    it('selects contacts by person ID, from the Relationships base view metadata names', () => {
        expect(where.startsWith('(ID IN (')).toBe(true);
        expect(where.endsWith(')')).toBe(true);
        expect(where).toContain('[__mj_BizAppsCommon].[vwRelationships]');
    });

    /** MJAPI refuses an ExtraFilter subquery over a base table, and the Contacts grid fails to load. */
    it('reads the base view, never the base table', () => {
        expect(where).not.toContain('[Relationship]');
    });

    /** MJ refuses UNION anywhere in a caller-supplied filter, so the two directions are ORed. */
    it('joins the two directions with OR, not UNION', () => {
        expect(where).not.toMatch(/\bUNION\b/i);
        expect(where).toContain(') OR ID IN (');
    });

    it('takes a person linked TO the account ("is employee of")', () => {
        expect(where).toContain(`SELECT FromPersonID FROM [__mj_BizAppsCommon].[vwRelationships] WHERE ToOrganizationID = '${ACCOUNT}'`);
    });

    it('takes a person the account is linked to ("employs"), the same fact stored the other way', () => {
        expect(where).toContain(`SELECT ToPersonID FROM [__mj_BizAppsCommon].[vwRelationships] WHERE FromOrganizationID = '${ACCOUNT}'`);
    });

    /** An organization-to-organization row has no person on the far side and must not add a NULL. */
    it('skips rows whose far side is not a person', () => {
        expect(where).toContain('FromPersonID IS NOT NULL');
        expect(where).toContain('ToPersonID IS NOT NULL');
    });

    /** Someone who has left (Ended) or is paused (Inactive) does not work there now. */
    it('admits only active links, in both directions', () => {
        expect(where.match(/Status = 'Active'/g)).toHaveLength(2);
    });

    /** The type is data. Filtering on "Employee" would drop consultants and board members on a deal. */
    it('does not choose relationship types by name', () => {
        expect(where).not.toContain('RelationshipType');
    });

    it('quotes the account ID, so a stray quote cannot end the literal', () => {
        expect(AccountContactsWhere("x'; DROP TABLE y; --", VIEW)).toContain("'x''; DROP TABLE y; --'");
    });
});

/**
 * #442: a Sales Contact showed no employer. The contact's Accounts panel reads the same Relationship
 * rows from the person's end, so the two panels agree on who works where.
 */
const CONTACT = 'C0111111-0000-4000-A000-000000000001';

describe('#442 — the accounts a contact lists', () => {
    const where = ContactAccountsWhere(CONTACT, VIEW);

    it('selects accounts by organization ID, from the Relationships base view', () => {
        expect(where.startsWith('(ID IN (')).toBe(true);
        expect(where).toContain('[__mj_BizAppsCommon].[vwRelationships]');
        expect(where).not.toContain('[Relationship]');
        expect(where).not.toMatch(/\bUNION\b/i);
    });

    it('takes an organization the contact is linked TO ("is employee of")', () => {
        expect(where).toContain(`SELECT ToOrganizationID FROM [__mj_BizAppsCommon].[vwRelationships] WHERE FromPersonID = '${CONTACT}'`);
    });

    it('takes an organization linked to the contact ("employs"), stored the other way', () => {
        expect(where).toContain(`SELECT FromOrganizationID FROM [__mj_BizAppsCommon].[vwRelationships] WHERE ToPersonID = '${CONTACT}'`);
    });

    it('skips rows whose far side is not an organization, and admits only active links', () => {
        expect(where).toContain('ToOrganizationID IS NOT NULL');
        expect(where).toContain('FromOrganizationID IS NOT NULL');
        expect(where.match(/Status = 'Active'/g)).toHaveLength(2);
        expect(where).not.toContain('RelationshipType');
    });

    it('quotes the contact ID', () => {
        expect(ContactAccountsWhere("x'; --", VIEW)).toContain("'x''; --'");
    });
});
