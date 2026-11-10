/**
 * @fileoverview `party-lookup` — PL1–PL6. The Deal form's Account and Contact pickers
 * (bc-aidp-next-golive#372), run through `RunQuery` by name exactly as `bizapps-party-field` calls them.
 *
 * The fixture is built so a wrong query returns a WRONG ROW rather than no row: a person whose last name
 * only CONTAINS the term (contains vs prefix), a person and an organization with no SalesContact /
 * SalesAccount row (the subtype restriction), and a name that `%`, `_` or `[a]` would match as a pattern (escaping).
 * Every name carries a per-run token, so seeded data cannot satisfy or spoil an assertion.
 *
 * Needs common's `Person.EmailDomain`, `Organization.WebsiteDomain` and `Organization.Acronym` columns
 * (common's party lookup and acronym migrations) and the two `Sales: Party Lookup *` queries pushed from `metadata/queries`.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { RunQuery } from '@memberjunction/core';
import { Assert, IntegrationCheckRegistry, type NamedCheck } from '@memberjunction/testing-integration';

import { InRolledBackTransaction, SALES_SCHEMA, TxOne } from '../fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

const COMMON_SCHEMA = '__mj_BizAppsCommon';
const Q_CONTACTS = 'Sales: Party Lookup Contacts';
const Q_ACCOUNTS = 'Sales: Party Lookup Accounts';

interface Fixture {
    Token: string;
    /** LastName starts with the token; has a SalesContact. */
    Contact: string;
    /** LastName starts with the token; NO SalesContact. */
    PersonOnly: string;
    /** LastName contains the token but does not start with it; has a SalesContact. */
    ContainsOnly: string;
    /** LastName is token + 'axb': the terms token + 'a%b', 'a_b' and '[a]xb' match it only as patterns. */
    Wildcard: string;
    /** Name starts with the token; has a SalesAccount. */
    Account: string;
    /** Name starts with the token; NO SalesAccount. */
    OrgOnly: string;
    /** Acronym of both organizations: the token upper-cased, so a match is case-insensitive. */
    Acronym: string;
}

/** A lower-case token no seeded row starts with. */
function newToken(): string {
    return `zq${Math.random().toString(36).slice(2, 8).replace(/[0-9]/g, 'k')}`;
}

/** Inserts one row and returns its ID, inside the check's transaction. */
async function insertID(ctx: Ctx, sql: string): Promise<string> {
    const row = await TxOne<{ ID: string }>(ctx, sql);
    return String(row.ID).toLowerCase();
}

async function person(ctx: Ctx, first: string, last: string, email: string, salesContact: boolean): Promise<string> {
    const id = await insertID(ctx, `
        INSERT INTO ${COMMON_SCHEMA}.Person (FirstName, LastName, Email)
        OUTPUT inserted.ID VALUES (N'${first}', N'${last}', N'${email}')`);
    if (salesContact) {
        await insertID(ctx, `INSERT INTO ${SALES_SCHEMA}.SalesContact (ID) OUTPUT inserted.ID VALUES ('${id}')`);
    }
    return id;
}

async function organization(ctx: Ctx, name: string, website: string, acronym: string, salesAccount: boolean): Promise<string> {
    const id = await insertID(ctx, `
        INSERT INTO ${COMMON_SCHEMA}.Organization (Name, Website, Acronym)
        OUTPUT inserted.ID VALUES (N'${name}', N'${website}', N'${acronym}')`);
    if (salesAccount) {
        await insertID(ctx, `INSERT INTO ${SALES_SCHEMA}.SalesAccount (ID) OUTPUT inserted.ID VALUES ('${id}')`);
    }
    return id;
}

async function seed(ctx: Ctx): Promise<Fixture> {
    const t = newToken();
    const acronym = `A${t.toUpperCase()}`;
    return {
        Token: t,
        Contact: await person(ctx, 'Pat', `${t}son`, `pat@${t}dom.test`, true),
        PersonOnly: await person(ctx, 'Lee', `${t}ley`, `lee@${t}dom.test`, false),
        ContainsOnly: await person(ctx, 'Ann', `Mc${t}`, `ann@other-${t}.test`, true),
        Wildcard: await person(ctx, 'Wil', `${t}axb`, `wil@other-${t}.test`, true),
        Account: await organization(ctx, `${t} Holdings`, `https://www.${t}corp.test/about`, acronym, true),
        OrgOnly: await organization(ctx, `${t} Partners`, `${t}partners.test`, acronym, false),
        Acronym: acronym,
    };
}

/** The IDs a party lookup query returns, failing the check if it did not run. */
async function lookup(ctx: Ctx, query: string, term: string, domain?: string): Promise<string[]> {
    const parameters: Record<string, string> = { Term: term };
    if (domain) {
        parameters['Domain'] = domain;
    }
    const r = await new RunQuery().RunQuery({ QueryName: query, Parameters: parameters }, ctx.User);
    Assert(r?.Success === true, `'${query}' with Term=${term} did not run — ${r?.ErrorMessage ?? 'no reason given'}`);
    return ((r.Results ?? []) as { ID: string }[]).map((row) => String(row.ID).toLowerCase());
}

function seedCheck(id: string, name: string, body: (ctx: Ctx, f: Fixture) => Promise<void>): NamedCheck {
    return {
        Id: `party-lookup.${id}`,
        Name: `${id}: ${name}`,
        RequiresMutation: true,
        Fn: async (ctx) => InRolledBackTransaction(ctx, async () => body(ctx, await seed(ctx))),
    };
}

export const PartyLookupChecks: NamedCheck[] = [
    seedCheck('PL1', 'a last-name prefix finds sales contacts only, and never a mid-name match', async (ctx, f) => {
        const ids = await lookup(ctx, Q_CONTACTS, f.Token);
        Assert(ids.includes(f.Contact), 'the sales contact whose last name starts with the term is missing');
        Assert(!ids.includes(f.PersonOnly), 'a person with no SalesContact row was offered; the Deal cannot store it');
        Assert(!ids.includes(f.ContainsOnly), 'a last name that only CONTAINS the term matched; the search must be prefix');
    }),
    seedCheck('PL2', 'an email prefix and an email domain each find the contact', async (ctx, f) => {
        const byEmail = await lookup(ctx, Q_CONTACTS, `pat@${f.Token}`, `pat@${f.Token}`);
        Assert(byEmail.includes(f.Contact), 'an email prefix did not find the contact');
        const byDomain = await lookup(ctx, Q_CONTACTS, `@${f.Token}dom.test`, `${f.Token}dom.test`);
        Assert(byDomain.includes(f.Contact), 'the email domain did not find the contact (Person.EmailDomain)');
        Assert(!byDomain.includes(f.PersonOnly), 'a domain match offered a person with no SalesContact row');
    }),
    seedCheck('PL3', 'a name prefix finds sales accounts only', async (ctx, f) => {
        const ids = await lookup(ctx, Q_ACCOUNTS, f.Token);
        Assert(ids.includes(f.Account), 'the sales account whose name starts with the term is missing');
        Assert(!ids.includes(f.OrgOnly), 'an organization with no SalesAccount row was offered; the Deal cannot store it');
    }),
    seedCheck('PL4', 'a website domain (scheme, www and path stripped) finds the account', async (ctx, f) => {
        const ids = await lookup(ctx, Q_ACCOUNTS, `${f.Token}corp.test`, `${f.Token}corp.test`);
        Assert(ids.includes(f.Account), 'the website domain did not find the account (Organization.WebsiteDomain)');
    }),
    seedCheck('PL6', 'an acronym prefix finds sales accounts only, with acronym · domain as the detail', async (ctx, f) => {
        const r = await new RunQuery().RunQuery({ QueryName: Q_ACCOUNTS, Parameters: { Term: f.Acronym.toLowerCase() } }, ctx.User);
        Assert(r?.Success === true, `'${Q_ACCOUNTS}' by acronym did not run — ${r?.ErrorMessage ?? 'no reason given'}`);
        const rows = (r.Results ?? []) as { ID: string; Detail: string | null }[];
        const account = rows.find((row) => String(row.ID).toLowerCase() === f.Account);
        Assert(account !== undefined, 'the acronym did not find the sales account (Organization.Acronym)');
        Assert(!rows.some((row) => String(row.ID).toLowerCase() === f.OrgOnly), 'an acronym match offered an organization with no SalesAccount row');
        Assert(account?.Detail === `${f.Acronym} · ${f.Token}corp.test`, `Detail was '${account?.Detail}', expected acronym · domain`);
    }),
    /**
     * Each wildcard sits MID-term: sqlLikeBegins strips a TRAILING '%' before escaping, so `token%`
     * is a plain prefix search and could never show whether '%' is escaped.
     */
    seedCheck('PL5', "%, _, [ and ' in a term match literally and never error", async (ctx, f) => {
        for (const term of [`${f.Token}a%b`, `${f.Token}a_b`, `${f.Token}[a]xb`]) {
            const ids = await lookup(ctx, Q_CONTACTS, term);
            Assert(!ids.includes(f.Wildcard), `'${term}' matched '${f.Token}axb' as a pattern; sqlLikeBegins must escape it`);
        }
        await lookup(ctx, Q_CONTACTS, `o'${f.Token}`);
    }),
];

for (const check of PartyLookupChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

IntegrationCheckRegistry.Instance.RegisterLifecycle('party-lookup', {
    Setup: async () => {
        // Nothing to create: every check seeds its own rows inside its rolled-back transaction.
    },
    Teardown: async () => {
        // Nothing to sweep: the transaction rollback removes every fixture row.
    },
});
