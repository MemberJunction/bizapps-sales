/**
 * `Sales.OwnedAccounts`: which domains a mailbox owner has standing consent for, read from the
 * accounts that person owns.
 *
 * The failure this guards hardest: a read that FAILED being reported as "owns no accounts", which would
 * let a broken database look like a quiet mailbox.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IMetadataProvider, RunViewParams, UserInfo } from '@memberjunction/core';

const OWNER = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const EMPLOYEE = '11111111-2222-4333-8444-555555555555';
const CONN = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

interface ViewAnswer {
    Success: boolean;
    Results?: Array<Record<string, unknown>>;
    ErrorMessage?: string;
}

const calls: Array<{ Params: RunViewParams[]; User: unknown; Provider: unknown }> = [];
let users: ViewAnswer = { Success: true, Results: [] };
let accounts: ViewAnswer = { Success: true, Results: [] };
let relationships: ViewAnswer = { Success: true, Results: [] };
let people: ViewAnswer = { Success: true, Results: [] };

const E_ACCOUNTS = 'MJ_BizApps_Sales: Sales Accounts';
const E_RELATIONSHIPS = 'MJ_BizApps_Common: Relationships';
const E_PEOPLE = 'MJ_BizApps_Common: People';
const P1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const P2 = 'aaaaaaaa-0000-4000-8000-000000000002';

function answerFor(entity: string): ViewAnswer {
    if (entity === 'MJ: Users') return users;
    if (entity === E_RELATIONSHIPS) return relationships;
    if (entity === E_PEOPLE) return people;
    return accounts;
}

vi.mock('@memberjunction/core', () => ({
    RunView: class {
        public static FromMetadataProvider(provider: unknown) {
            return {
                RunViews: async (params: RunViewParams[], user: unknown): Promise<ViewAnswer[]> => {
                    calls.push({ Params: params, User: user, Provider: provider });
                    return params.map((p) => answerFor(p.EntityName ?? ''));
                },
            };
        }
    },
    LogError: () => undefined,
}));

import { BaseActivityConsentSource, type StandingConsentRequest } from '@mj-biz-apps/common-activity-sync';
import { MJGlobal } from '@memberjunction/global';

import { MAX_CONTACT_DOMAINS, MAX_OWNED_ACCOUNTS, OwnedAccountsConsentSource } from '../activities/OwnedAccountsConsentSource.js';

const VIEWS: Record<string, { SchemaName: string; BaseView: string }> = {
    'MJ: Users': { SchemaName: '__mj', BaseView: 'vwUsers' },
    [E_ACCOUNTS]: { SchemaName: '__mj_BizAppsSales', BaseView: 'vwSalesAccounts' },
    [E_RELATIONSHIPS]: { SchemaName: '__mj_BizAppsCommon', BaseView: 'vwRelationships' },
    [E_PEOPLE]: { SchemaName: '__mj_BizAppsCommon', BaseView: 'vwPeople' },
};
const provider = { EntityByName: (name: string) => VIEWS[name] } as unknown as IMetadataProvider;
const contextUser = { ID: 'ctx-user' } as UserInfo;

function request(overrides: Partial<StandingConsentRequest> = {}): StandingConsentRequest {
    return { ConnectionID: CONN, OwnerUserID: OWNER, Mailbox: 'rep@tenant.test', ContextUser: contextUser, Provider: provider, ...overrides };
}

describe('OwnedAccountsConsentSource', () => {
    beforeEach(() => {
        calls.length = 0;
        users = { Success: true, Results: [{ ID: OWNER, EmployeeID: EMPLOYEE }] };
        accounts = { Success: true, Results: [{ Name: 'Acme Corp', WebsiteDomain: 'acme.com' }, { Name: 'Globex', WebsiteDomain: 'globex.org' }] };
        relationships = { Success: true, Results: [] };
        people = { Success: true, Results: [] };
    });

    it('is registered under the key a connection names in Settings.Consent.Sources', () => {
        const created = MJGlobal.Instance.ClassFactory.TryCreateInstance<BaseActivityConsentSource>(BaseActivityConsentSource, 'Sales.OwnedAccounts');
        expect(created.Resolved).toBe(true);
        expect(created.Instance).toBeInstanceOf(OwnedAccountsConsentSource);
    });

    it('returns each owned account\'s website domain, labelled with the account name', async () => {
        const consent = await new OwnedAccountsConsentSource().StandingConsent(request());
        expect(consent).toEqual({
            Domains: [{ Domain: 'acme.com', Label: 'Acme Corp' }, { Domain: 'globex.org', Label: 'Globex' }],
            Issues: [],
        });
    });

    it('reads in ONE round trip, through the request\'s provider and context user', async () => {
        await new OwnedAccountsConsentSource().StandingConsent(request());
        expect(calls).toHaveLength(1);
        expect(calls[0].Provider).toBe(provider);
        expect(calls[0].User).toBe(contextUser);
        expect(calls[0].Params.map((p) => p.EntityName)).toEqual(['MJ: Users', E_ACCOUNTS, E_RELATIONSHIPS, E_PEOPLE]);
    });

    it('asks only for ACTIVE accounts this user\'s employee owns that have a website domain', async () => {
        await new OwnedAccountsConsentSource().StandingConsent(request());
        const filter = calls[0].Params[1].ExtraFilter ?? '';
        expect(filter).toContain('IsActive = 1');
        expect(filter).toContain('WebsiteDomain IS NOT NULL');
        expect(filter).toContain(`OwnerEmployeeID IN (SELECT EmployeeID FROM [__mj].[vwUsers] WHERE ID = '${OWNER}')`);
        expect(calls[0].Params[1].Fields).toEqual(['Name', 'WebsiteDomain']);
        expect(calls[0].Params[1].ResultType).toBe('simple');
    });

    it('a user not linked to an employee owns nothing: an empty list and an issue, not an error', async () => {
        users = { Success: true, Results: [{ ID: OWNER, EmployeeID: null }] };
        accounts = { Success: true, Results: [] };
        const consent = await new OwnedAccountsConsentSource().StandingConsent(request());
        expect(consent.Domains).toEqual([]);
        expect(consent.Issues.join(' ')).toMatch(new RegExp(`${OWNER}.*not linked to an employee`));
    });

    it('an employee who owns no account with a domain: an empty list and an issue', async () => {
        accounts = { Success: true, Results: [] };
        const consent = await new OwnedAccountsConsentSource().StandingConsent(request());
        expect(consent.Domains).toEqual([]);
        expect(consent.Issues.join(' ')).toMatch(/owns no active account with a website domain or a contact email domain/);
    });

    it('an owner user that cannot be found is an issue, not an error', async () => {
        users = { Success: true, Results: [] };
        accounts = { Success: true, Results: [] };
        const consent = await new OwnedAccountsConsentSource().StandingConsent(request());
        expect(consent.Domains).toEqual([]);
        expect(consent.Issues.join(' ')).toMatch(/was not found/);
    });

    it('a failed account read THROWS with context: it is never "owns no accounts"', async () => {
        accounts = { Success: false, ErrorMessage: 'Invalid object name vwSalesAccounts' };
        await expect(new OwnedAccountsConsentSource().StandingConsent(request())).rejects.toThrow(
            new RegExp(`Sales\\.OwnedAccounts.*${OWNER}.*Invalid object name vwSalesAccounts`),
        );
    });

    it('a failed user read throws too', async () => {
        users = { Success: false, ErrorMessage: 'timeout' };
        await expect(new OwnedAccountsConsentSource().StandingConsent(request())).rejects.toThrow(/Sales\.OwnedAccounts.*timeout/);
    });

    it('refuses an owner id that is not a record id before building any SQL', async () => {
        await expect(new OwnedAccountsConsentSource().StandingConsent(request({ OwnerUserID: "x' OR 1=1 --" }))).rejects.toThrow(/not a record id/);
        expect(calls).toHaveLength(0);
    });

    it('throws when MJ: Users is missing from metadata rather than guessing its view', async () => {
        const bare = { EntityByName: () => undefined } as unknown as IMetadataProvider;
        await expect(new OwnedAccountsConsentSource().StandingConsent(request({ Provider: bare }))).rejects.toThrow(/MJ: Users/);
    });

    it('throws when the Relationships entity is missing from metadata rather than skipping contacts', async () => {
        const partial = { EntityByName: (name: string) => (name === E_RELATIONSHIPS ? undefined : VIEWS[name]) } as unknown as IMetadataProvider;
        await expect(new OwnedAccountsConsentSource().StandingConsent(request({ Provider: partial }))).rejects.toThrow(/MJ_BizApps_Common: Relationships/);
        expect(calls).toHaveLength(0);
    });

    describe('contact email domains', () => {
        it('adds the email domain of a contact employed at an owned account, labelled with the account name', async () => {
            relationships = { Success: true, Results: [{ FromPersonID: P1, ToOrganization: 'Acme Corp' }] };
            people = { Success: true, Results: [{ ID: P1, EmailDomain: 'acme-group.com' }] };
            const consent = await new OwnedAccountsConsentSource().StandingConsent(request());
            expect(consent.Domains).toEqual([
                { Domain: 'acme.com', Label: 'Acme Corp' },
                { Domain: 'globex.org', Label: 'Globex' },
                { Domain: 'acme-group.com', Label: 'Acme Corp' },
            ]);
            expect(consent.Issues).toEqual([]);
        });

        it('an owned account with NO website still grants through its contact', async () => {
            accounts = { Success: true, Results: [] };
            relationships = { Success: true, Results: [{ FromPersonID: P1, ToOrganization: 'No Site Inc' }] };
            people = { Success: true, Results: [{ ID: P1, EmailDomain: 'nosite.io' }] };
            const consent = await new OwnedAccountsConsentSource().StandingConsent(request());
            expect(consent).toEqual({ Domains: [{ Domain: 'nosite.io', Label: 'No Site Inc' }], Issues: [] });
        });

        it('leaves out a contact on a free-mail domain, and reports nothing: that is ordinary data', async () => {
            relationships = { Success: true, Results: [{ FromPersonID: P1, ToOrganization: 'Acme Corp' }] };
            people = { Success: true, Results: [{ ID: P1, EmailDomain: 'GMail.com' }] };
            const consent = await new OwnedAccountsConsentSource().StandingConsent(request());
            expect(consent.Domains.map((d) => d.Domain)).toEqual(['acme.com', 'globex.org']);
            expect(consent.Issues).toEqual([]);
        });

        it('returns one entry for a domain and account that appear more than once', async () => {
            relationships = { Success: true, Results: [{ FromPersonID: P1, ToOrganization: 'Acme Corp' }, { FromPersonID: P2, ToOrganization: 'Acme Corp' }] };
            people = { Success: true, Results: [{ ID: P1, EmailDomain: 'ACME.com' }, { ID: P2.toUpperCase(), EmailDomain: 'acme-group.com' }] };
            const consent = await new OwnedAccountsConsentSource().StandingConsent(request());
            expect(consent.Domains).toEqual([
                { Domain: 'acme.com', Label: 'Acme Corp' },
                { Domain: 'globex.org', Label: 'Globex' },
                { Domain: 'acme-group.com', Label: 'Acme Corp' },
            ]);
        });

        it('ignores a relationship whose person was not returned (inactive, or no email domain)', async () => {
            relationships = { Success: true, Results: [{ FromPersonID: P1, ToOrganization: 'Acme Corp' }] };
            const consent = await new OwnedAccountsConsentSource().StandingConsent(request());
            expect(consent.Domains).toHaveLength(2);
            expect(consent.Issues).toEqual([]);
        });

        // Production (2026-11-19): the three largest owners have 50,000 to 62,000 contact rows each and
        // about 2,400 distinct domains. Reading a row per contact is slow and overruns any sane cap, so
        // the database returns ONE contact per (account, email domain).
        it('asks for ONE active Employee contact per account and email domain, at accounts this user owns', async () => {
            await new OwnedAccountsConsentSource().StandingConsent(request());
            const owned =
                `SELECT ID FROM [__mj_BizAppsSales].[vwSalesAccounts] WHERE IsActive = 1 AND OwnerEmployeeID IS NOT NULL ` +
                `AND OwnerEmployeeID IN (SELECT EmployeeID FROM [__mj].[vwUsers] WHERE ID = '${OWNER}')`;
            const onePerPair = (column: string): string =>
                `SELECT x.${column} FROM (SELECT r.ID AS RID, r.FromPersonID AS PID, ` +
                `ROW_NUMBER() OVER (PARTITION BY r.ToOrganizationID, p.EmailDomain ORDER BY r.ID) AS RN ` +
                `FROM [__mj_BizAppsCommon].[vwRelationships] r INNER JOIN [__mj_BizAppsCommon].[vwPeople] p ON p.ID = r.FromPersonID ` +
                `WHERE r.Status = 'Active' AND r.RelationshipType = 'Employee' AND p.Status = 'Active' AND p.EmailDomain IS NOT NULL ` +
                `AND r.ToOrganizationID IN (${owned})) x WHERE x.RN = 1`;
            const rel = calls[0].Params[2];
            expect(rel.ExtraFilter).toBe(`ID IN (${onePerPair('RID')})`);
            expect(rel.ExtraFilter).not.toContain('WebsiteDomain');
            expect(rel.Fields).toEqual(['FromPersonID', 'ToOrganization']);
            const ppl = calls[0].Params[3];
            expect(ppl.ExtraFilter).toBe(`ID IN (${onePerPair('PID')})`);
            expect(ppl.Fields).toEqual(['ID', 'EmailDomain']);
            expect([rel.ResultType, ppl.ResultType]).toEqual(['simple', 'simple']);
            expect([rel.MaxRows, ppl.MaxRows]).toEqual([MAX_CONTACT_DOMAINS + 1, MAX_CONTACT_DOMAINS + 1]);
        });

        it('throws when the People entity is missing from metadata rather than skipping contacts', async () => {
            const partial = { EntityByName: (name: string) => (name === E_PEOPLE ? undefined : VIEWS[name]) } as unknown as IMetadataProvider;
            await expect(new OwnedAccountsConsentSource().StandingConsent(request({ Provider: partial }))).rejects.toThrow(/MJ_BizApps_Common: People/);
            expect(calls).toHaveLength(0);
        });

        it('a failed relationship read THROWS: it is never "no contacts"', async () => {
            relationships = { Success: false, ErrorMessage: 'deadlock victim' };
            await expect(new OwnedAccountsConsentSource().StandingConsent(request())).rejects.toThrow(/Sales\.OwnedAccounts.*Relationships.*deadlock victim/);
        });

        it('a failed people read throws too', async () => {
            people = { Success: false, ErrorMessage: 'timeout' };
            await expect(new OwnedAccountsConsentSource().StandingConsent(request())).rejects.toThrow(/Sales\.OwnedAccounts.*People.*timeout/);
        });

        it('says so when there are more account and domain pairs than one read returns', async () => {
            relationships = {
                Success: true,
                Results: Array.from({ length: MAX_CONTACT_DOMAINS + 1 }, () => ({ FromPersonID: P1, ToOrganization: 'Acme Corp' })),
            };
            people = { Success: true, Results: [{ ID: P1, EmailDomain: 'acme-group.com' }] };
            const consent = await new OwnedAccountsConsentSource().StandingConsent(request());
            expect(consent.Issues.join(' ')).toMatch(new RegExp(`more than ${MAX_CONTACT_DOMAINS} contact email domains`));
        });
    });

    it('says so when the owner has more accounts than one read returns', async () => {
        accounts = { Success: true, Results: Array.from({ length: MAX_OWNED_ACCOUNTS + 1 }, (_, i) => ({ Name: `A${i}`, WebsiteDomain: `a${i}.com` })) };
        const consent = await new OwnedAccountsConsentSource().StandingConsent(request());
        expect(consent.Domains).toHaveLength(MAX_OWNED_ACCOUNTS);
        expect(consent.Issues.join(' ')).toMatch(/more than/);
    });
});
