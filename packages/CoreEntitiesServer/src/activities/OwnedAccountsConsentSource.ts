/**
 * @fileoverview `Sales.OwnedAccounts` — sales' answer to "whose correspondence has this mailbox owner
 * already agreed to have logged?": the accounts that person owns.
 *
 * Common's Activity Sync captures an email or meeting on a Tagged connection when the owner tags it.
 * A connection that also names this source in `Settings.Consent.Sources` captures, with no tag, items
 * that have a participant on a domain of an account the owner owns. Common never learns
 * what an account is: it asks for domains and labels, and applies every rule about what they may
 * capture itself (Private marks, exclusions, free-mail and internal domains, the skip tag).
 *
 * ── THIS CLASS RETURNS DATA AND DECIDES NOTHING ──────────────────────────────────────────────
 *
 * It never sees a mail item, and it does not filter the list for safety: an account whose "website"
 * is gmail.com is returned as it is, and Common drops and reports it. One place owns that rule.
 *
 * ── AN ACCOUNT HAS MORE DOMAINS THAN ITS WEBSITE ─────────────────────────────────────────────
 *
 * The website domain alone misses too much: in AIDP production (2026-11-19) a contact wrote from a
 * different domain at about half of the owned accounts, and 2,800 owned accounts had no website at
 * all. So an owned account also counts for the email domain of each person with an Active `Employee`
 * relationship to it, which is the link Common's own `vwPeople.CurrentOrganizationID` reads and the
 * only kind of person-to-account link production holds.
 *
 * The database returns ONE contact per (account, email domain), not a row per contact. In production
 * the largest owners have 50,000 to 62,000 contact rows and about 2,400 distinct domains among them:
 * a row per contact took over 8 seconds for one owner and overran the row cap, which would have cut
 * the list short for exactly the people this is for.
 *
 * A contact on a free-mail domain is left out here, and that is NOT the safety rule moving: Common
 * still drops free-mail domains whatever this class returns. It is left out because Common reports
 * every entry it drops, and a contact with a gmail address is ordinary data, not a fault to report
 * on every run. A free-mail WEBSITE is a data fault, so that one is still returned and reported.
 *
 * ── A FAILED READ THROWS; "OWNS NOTHING" IS AN EMPTY LIST ────────────────────────────────────
 *
 * Both would otherwise be an empty list, and only one of them is true. A throw fails that
 * connection's run before its mailbox is read; an empty list leaves the tag working.
 *
 * Ownership is `SalesAccount.OwnerEmployeeID`, and the mailbox owner is a user, so the path is
 * `ActivitySyncConnection.OwnerUserID` → `MJ: Users.EmployeeID` → accounts. `WebsiteDomain` is
 * Common's computed column on Organization, which SalesAccount is (IsA, same ID). `EmailDomain` is
 * the same kind of column on Person.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { RunView, type EntityInfo, type RunViewParams } from '@memberjunction/core';
import type { MJUserEntity } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import {
    BaseActivityConsentSource,
    FREE_MAIL_DOMAINS,
    type StandingConsent,
    type StandingConsentDomain,
    type StandingConsentRequest,
} from '@mj-biz-apps/common-activity-sync';
import type { mjBizAppsCommonPersonEntity, mjBizAppsCommonRelationshipEntity } from '@mj-biz-apps/common-entities';
import type { mjBizAppsSalesSalesAccountEntity } from '@mj-biz-apps/sales-entities';

const E_USER = 'MJ: Users';
const E_SALES_ACCOUNT = 'MJ_BizApps_Sales: Sales Accounts';
const E_RELATIONSHIP = 'MJ_BizApps_Common: Relationships';
const E_PERSON = 'MJ_BizApps_Common: People';
const SOURCE_KEY = 'Sales.OwnedAccounts';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accounts read per owner. More than this is reported, never silently cut. */
export const MAX_OWNED_ACCOUNTS = 5000;
/** (Account, contact email domain) pairs read per owner. More than this is reported, never silently cut. */
export const MAX_CONTACT_DOMAINS = 20000;

type UserRow = Pick<MJUserEntity, 'ID' | 'EmployeeID'>;
type AccountRow = Pick<mjBizAppsSalesSalesAccountEntity, 'Name' | 'WebsiteDomain'>;
type RelationshipRow = Pick<mjBizAppsCommonRelationshipEntity, 'FromPersonID' | 'ToOrganization'>;
type PersonRow = Pick<mjBizAppsCommonPersonEntity, 'ID' | 'EmailDomain'>;

@RegisterClass(BaseActivityConsentSource, SOURCE_KEY)
export class OwnedAccountsConsentSource extends BaseActivityConsentSource {
    public async StandingConsent(request: StandingConsentRequest): Promise<StandingConsent> {
        const owner = request.OwnerUserID;
        if (!UUID.test(owner)) {
            throw new Error(`${SOURCE_KEY}: owner user id ${JSON.stringify(owner)} is not a record id.`);
        }
        const usersView = requireEntity(request, E_USER);
        const accountsView = requireEntity(request, E_SALES_ACCOUNT);
        const relationshipsView = requireEntity(request, E_RELATIONSHIP);
        const peopleView = requireEntity(request, E_PERSON);
        // The employee is resolved inside each filter (a subquery over the Users base view), so no read
        // waits on another and all four go in one round trip. The user row is read only to say WHY a list is empty.
        const ownerIs = `OwnerEmployeeID IS NOT NULL AND OwnerEmployeeID IN (SELECT EmployeeID FROM ${viewOf(usersView)} WHERE ID = '${owner}')`;
        // One (relationship, person) per account and email domain. Not limited to accounts with a website:
        // a contact is how an account with no website grants at all.
        // The cap is cut HERE, in one order, and not left to each read's MaxRows: the two reads share no
        // order, so over the cap each would keep its own "first N" and a relationship would lose its person.
        const onePerAccountAndDomain = (column: 'RID' | 'PID'): string =>
            `SELECT y.${column} FROM (SELECT x.RID, x.PID, ROW_NUMBER() OVER (ORDER BY x.RID) AS N FROM (SELECT r.ID AS RID, r.FromPersonID AS PID, ` +
            `ROW_NUMBER() OVER (PARTITION BY r.ToOrganizationID, p.EmailDomain ORDER BY r.ID) AS RN ` +
            `FROM ${viewOf(relationshipsView)} r INNER JOIN ${viewOf(peopleView)} p ON p.ID = r.FromPersonID ` +
            `WHERE r.Status = 'Active' AND r.RelationshipType = 'Employee' AND p.Status = 'Active' AND p.EmailDomain IS NOT NULL ` +
            `AND r.ToOrganizationID IN (SELECT ID FROM ${viewOf(accountsView)} WHERE IsActive = 1 AND ${ownerIs})) x WHERE x.RN = 1) y ` +
            `WHERE y.N <= ${MAX_CONTACT_DOMAINS + 1}`;
        const views: RunViewParams[] = [
            { EntityName: E_USER, ExtraFilter: `ID = '${owner}'`, Fields: ['ID', 'EmployeeID'], MaxRows: 1, ResultType: 'simple' },
            {
                EntityName: E_SALES_ACCOUNT,
                ExtraFilter: `IsActive = 1 AND WebsiteDomain IS NOT NULL AND ${ownerIs}`,
                Fields: ['Name', 'WebsiteDomain'],
                OrderBy: 'Name',
                MaxRows: MAX_OWNED_ACCOUNTS + 1,
                ResultType: 'simple',
            },
            {
                EntityName: E_RELATIONSHIP,
                ExtraFilter: `ID IN (${onePerAccountAndDomain('RID')})`,
                Fields: ['FromPersonID', 'ToOrganization'],
                MaxRows: MAX_CONTACT_DOMAINS + 1,
                ResultType: 'simple',
            },
            { EntityName: E_PERSON, ExtraFilter: `ID IN (${onePerAccountAndDomain('PID')})`, Fields: ['ID', 'EmailDomain'], MaxRows: MAX_CONTACT_DOMAINS + 1, ResultType: 'simple' },
        ];
        const [users, accounts, relationships, people] = await RunView.FromMetadataProvider(request.Provider).RunViews(views, request.ContextUser);
        if (!users?.Success) throw readFailed(E_USER, request, users?.ErrorMessage);
        if (!accounts?.Success) throw readFailed(E_SALES_ACCOUNT, request, accounts?.ErrorMessage);
        if (!relationships?.Success) throw readFailed(E_RELATIONSHIP, request, relationships?.ErrorMessage);
        if (!people?.Success) throw readFailed(E_PERSON, request, people?.ErrorMessage);
        return toConsent(
            (users.Results ?? []) as UserRow[],
            (accounts.Results ?? []) as AccountRow[],
            { Relationships: (relationships.Results ?? []) as RelationshipRow[], People: (people.Results ?? []) as PersonRow[] },
            owner,
        );
    }
}

/** Throws rather than guessing a view name: a wrong guess is a failed read on every run. */
function requireEntity(request: StandingConsentRequest, name: string): EntityInfo {
    const entity = request.Provider.EntityByName(name);
    if (!entity) {
        throw new Error(`${SOURCE_KEY}: ${name} is missing from metadata, so owned accounts cannot be read for owner user ${request.OwnerUserID}.`);
    }
    return entity;
}

function viewOf(entity: EntityInfo): string {
    return `[${entity.SchemaName}].[${entity.BaseView}]`;
}

function readFailed(entity: string, request: StandingConsentRequest, message: string | undefined): Error {
    return new Error(
        `${SOURCE_KEY} could not read ${entity} for owner user ${request.OwnerUserID} (connection ${request.ConnectionID}): ` +
            `${message?.trim() || 'no error message'}. Owned accounts were not determined.`,
    );
}

interface ContactRows {
    Relationships: readonly RelationshipRow[];
    People: readonly PersonRow[];
}

function toConsent(users: readonly UserRow[], accounts: readonly AccountRow[], contacts: ContactRows, owner: string): StandingConsent {
    const user = users[0];
    if (!user) return { Domains: [], Issues: [`owner user ${owner} was not found, so no account is owned.`] };
    if (!user.EmployeeID) return { Domains: [], Issues: [`owner user ${owner} is not linked to an employee, so no account is owned.`] };
    const issues: string[] = [];
    if (accounts.length > MAX_OWNED_ACCOUNTS) {
        issues.push(`employee ${user.EmployeeID} owns more than ${MAX_OWNED_ACCOUNTS} accounts; only the first ${MAX_OWNED_ACCOUNTS} by name grant standing consent.`);
    }
    if (contacts.Relationships.length > MAX_CONTACT_DOMAINS || contacts.People.length > MAX_CONTACT_DOMAINS) {
        issues.push(`employee ${user.EmployeeID}'s accounts have more than ${MAX_CONTACT_DOMAINS} contact email domains; the rest grant nothing.`);
    }
    const websites = accounts.slice(0, MAX_OWNED_ACCOUNTS).flatMap((a) => (a.WebsiteDomain ? [{ Domain: a.WebsiteDomain, Label: a.Name }] : []));
    const domains = distinct([...websites, ...contactDomains(contacts)]);
    if (domains.length === 0) {
        issues.push(`employee ${user.EmployeeID} (user ${owner}) owns no active account with a website domain or a contact email domain.`);
    }
    return { Domains: domains, Issues: issues };
}

/** One entry per row: the person's email domain under the account that person works at. */
function contactDomains(contacts: ContactRows): StandingConsentDomain[] {
    const domainOfPerson = new Map<string, string>();
    for (const person of contacts.People.slice(0, MAX_CONTACT_DOMAINS)) {
        const domain = person.EmailDomain?.trim().toLowerCase();
        if (domain && !FREE_MAIL_DOMAINS.has(domain)) domainOfPerson.set(person.ID.toLowerCase(), domain);
    }
    return contacts.Relationships.slice(0, MAX_CONTACT_DOMAINS).flatMap((relationship) => {
        const domain = relationship.FromPersonID ? domainOfPerson.get(relationship.FromPersonID.toLowerCase()) : undefined;
        return domain && relationship.ToOrganization ? [{ Domain: domain, Label: relationship.ToOrganization }] : [];
    });
}

/** First occurrence wins, compared without case, so the website entry keeps its place and its spelling. */
function distinct(domains: readonly StandingConsentDomain[]): StandingConsentDomain[] {
    const seen = new Set<string>();
    return domains.filter((entry) => {
        const key = `${entry.Domain.trim().toLowerCase()}\u0000${entry.Label}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
