import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExistingAccountLinkWhere, PERSON_TO_ORGANIZATION_TYPES_WHERE } from '../lib/form-panels/account-contacts';

/**
 * #443: the Sales Account's Contacts panel listed people but could not link one. "Link person" writes
 * a Common Relationship From the person To the account, after checking no active link exists already.
 */
const PERSON = 'B0222222-0000-4000-B000-000000000002';
const ACCOUNT = 'A0111111-0000-4000-A000-000000000001';

describe('#443 — the duplicate-link check', () => {
    const where = ExistingAccountLinkWhere(PERSON, ACCOUNT);

    it('finds a link stored From the person To the account', () => {
        expect(where).toContain(`(FromPersonID = '${PERSON}' AND ToOrganizationID = '${ACCOUNT}')`);
    });

    it('finds the same fact stored the other way round, From the account To the person', () => {
        expect(where).toContain(`(FromOrganizationID = '${ACCOUNT}' AND ToPersonID = '${PERSON}')`);
    });

    it('ORs the two directions under one active-only condition', () => {
        expect(where).toBe(
            `Status = 'Active' AND ((FromPersonID = '${PERSON}' AND ToOrganizationID = '${ACCOUNT}')` +
                ` OR (FromOrganizationID = '${ACCOUNT}' AND ToPersonID = '${PERSON}'))`,
        );
    });

    it('quotes both IDs, so a stray quote cannot end the literal', () => {
        expect(ExistingAccountLinkWhere("p'x", "a'y")).toContain("'p''x'");
        expect(ExistingAccountLinkWhere("p'x", "a'y")).toContain("'a''y'");
    });

    it('offers active person-to-organization types, not types chosen by name', () => {
        expect(PERSON_TO_ORGANIZATION_TYPES_WHERE).toBe("Category = 'PersonToOrganization' AND IsActive = 1");
    });
});

/**
 * The panel's chrome, read from the template source the way `unsaved-record-empty-states` does: the
 * branch is Angular control flow decided by one field, so the source is what to pin.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const PANEL = readFileSync(join(HERE, '..', 'lib', 'form-panels', 'account-contacts.panel.ts'), 'utf8');

describe('#443 — the Link person button', () => {
    const saved = PANEL.indexOf('@if (Record.IsSaved) {');
    const unsaved = PANEL.indexOf('} @else {\n                <p class="mjs-deal-empty">');
    const button = PANEL.indexOf('data-testid="account-contacts-link-person"');

    it('is drawn only inside the saved-account branch, so an unsaved account has none', () => {
        expect(saved).toBeGreaterThan(-1);
        expect(unsaved).toBeGreaterThan(saved);
        expect(button).toBeGreaterThan(saved);
        expect(button).toBeLessThan(unsaved);
    });

    it('picks Sales Contacts only, and never offers to create one', () => {
        expect(PANEL).toContain("CONTACT_LOOKUP_QUERY = 'Sales: Party Lookup Contacts'");
        expect(PANEL).toContain('[AllowCreate]="false"');
    });

    it('stores the link From the person To the account', () => {
        expect(PANEL).toContain('FieldName="FromPersonID"');
        expect(PANEL).toContain('draft.ToOrganizationID = accountId');
    });

    it('shows a refused save\'s own message', () => {
        expect(PANEL).toContain('draft.LatestResult?.Message');
    });

    it('puts Link left of Cancel', () => {
        expect(PANEL.indexOf('(click)="SaveLink()"')).toBeLessThan(PANEL.indexOf('(click)="CancelLink()"'));
    });
});
