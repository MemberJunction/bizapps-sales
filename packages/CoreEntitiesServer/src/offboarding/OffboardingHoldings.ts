/**
 * @fileoverview What a departed user holds in sales, and moving it to a successor (golive #297).
 *
 * Common's Offboarding screen runs every active Action in the "Offboarding Holdings" category. Sales
 * answers with two: `Sales.ListOffboardingHoldings` (this file's `ListSalesOffboardingHoldings`) and
 * `Sales.ReassignOffboardingHoldings` (`ReassignSalesOffboardingHoldings`). The JSON shapes are the
 * shared contract every app follows, so the screen needs no compile-time knowledge of sales.
 *
 * WHAT COUNTS AS A HOLDING. Only open, forward-looking responsibility:
 *   - DEAL_OWNER: an OPEN deal whose owner stamp is the leaver's Employee.
 *   - DEAL_TEAM_MEMBER: an active, non-owner team row naming the leaver's Employee, on an OPEN deal.
 *     The owner-role row is DEAL_OWNER's, so it is not listed twice.
 *   - ACCOUNT_OWNER / CONTACT_OWNER: a sales account or contact the leaver's Employee owns.
 *   - PIPELINE_CLOSE_WON_ASSIGNEE: a pipeline whose close-won tasks go to the leaver's Person.
 * "Open" is the deal status type's `IsOpen` flag, the definition the workspace, the board and the
 * pipeline summary query use; a deal with no status, or a status that cannot be found, is not open.
 * Closed deals, forecast snapshots and stage events are history and are never read here, let alone
 * written.
 *
 * WHO MAY MOVE THEM. The leaver's supervisor (`MJ: Employees`.SupervisorID of the leaver's Employee is
 * the caller's Employee) or a holder of the Sales Admin role. Listing needs only read access; the
 * `CanReassign` flag on each row tells the screen what this caller may do, and the reassign re-checks it
 * on the server.
 *
 * HOW THEY MOVE. One record at a time, as the calling user, through each entity's own `Save()`, so the
 * deal's owner stamp, team-role rules and entity permissions all apply. A refused save is reported in
 * `Skipped` with the entity's own message, never retried another way. A deal's owner moves through
 * `DealEntity.SetOwner`, the same roster swap the owner picker uses, because `OwnerEmployeeID` is
 * derived from the team and a direct write to it is refused.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import {
    CompositeKey,
    RunView,
    type BaseEntity,
    type IMetadataProvider,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
} from '@memberjunction/core';
import { UUIDsEqual } from '@memberjunction/global';
import type { DealEntity } from '@mj-biz-apps/sales-entities';

import { UserEmployeeID } from '../deal-delete.js';

/** The MJ role whose holders may move any leaver's sales items (g297.5). */
export const SALES_ADMIN_ROLE = 'Sales Admin';

export const SALES_HOLDING_KIND = {
    DealOwner: 'DEAL_OWNER',
    DealTeamMember: 'DEAL_TEAM_MEMBER',
    AccountOwner: 'ACCOUNT_OWNER',
    ContactOwner: 'CONTACT_OWNER',
    PipelineCloseWonAssignee: 'PIPELINE_CLOSE_WON_ASSIGNEE',
} as const;

export type SalesHoldingKind = (typeof SALES_HOLDING_KIND)[keyof typeof SALES_HOLDING_KIND];

const KIND_LABEL: Record<SalesHoldingKind, string> = {
    DEAL_OWNER: 'Deal owner',
    DEAL_TEAM_MEMBER: 'Deal team member',
    ACCOUNT_OWNER: 'Account owner',
    CONTACT_OWNER: 'Contact owner',
    PIPELINE_CLOSE_WON_ASSIGNEE: 'Close-won task assignee',
};

/** Kinds that move to the successor's Employee; the rest move to their Person. */
const EMPLOYEE_KINDS: ReadonlySet<SalesHoldingKind> = new Set<SalesHoldingKind>([
    'DEAL_OWNER',
    'DEAL_TEAM_MEMBER',
    'ACCOUNT_OWNER',
    'CONTACT_OWNER',
]);

const E_USER = 'MJ: Users';
const E_EMPLOYEE = 'MJ: Employees';
const E_PERSON = 'MJ_BizApps_Common: People';
const E_DEAL = 'MJ_BizApps_Sales: Deals';
const E_DEAL_STATUS = 'MJ_BizApps_Sales: Deal Status Types';
const E_DEAL_TEAM_MEMBER = 'MJ_BizApps_Sales: Deal Team Members';
const E_DEAL_ROLE = 'MJ_BizApps_Sales: Deal Roles';
const E_SALES_ACCOUNT = 'MJ_BizApps_Sales: Sales Accounts';
const E_SALES_CONTACT = 'MJ_BizApps_Sales: Sales Contacts';
const E_PIPELINE = 'MJ_BizApps_Sales: Pipelines';

/** The role that supplies the entity rights a reassign's saves need (g297.8). It never authorizes a move. */
export const SALES_OFFBOARDING_ROLE = 'Sales Offboarding';

export interface EntityRights { CanCreate: boolean; CanRead: boolean; CanUpdate: boolean; CanDelete: boolean }

/**
 * The rights each move needs, by entity. The Sales Offboarding role's entity permissions grant exactly
 * these (pinned against metadata by a test). Deal Team Members also need create and delete because a
 * deal's owner moves through `SetOwner`, which removes the owner row and adds a new one.
 */
export const SALES_OFFBOARDING_RIGHTS: Readonly<Record<string, EntityRights>> = {
    [E_DEAL]: { CanCreate: false, CanRead: true, CanUpdate: true, CanDelete: false },
    [E_DEAL_TEAM_MEMBER]: { CanCreate: true, CanRead: true, CanUpdate: true, CanDelete: true },
    [E_SALES_ACCOUNT]: { CanCreate: false, CanRead: true, CanUpdate: true, CanDelete: false },
    [E_SALES_CONTACT]: { CanCreate: false, CanRead: true, CanUpdate: true, CanDelete: false },
    [E_PIPELINE]: { CanCreate: false, CanRead: true, CanUpdate: true, CanDelete: false },
};

/** The entities whose rights moving one kind needs: a deal owner swap saves the deal and its team rows. */
const KIND_ENTITIES: Record<SalesHoldingKind, string[]> = {
    DEAL_OWNER: [E_DEAL, E_DEAL_TEAM_MEMBER],
    DEAL_TEAM_MEMBER: [E_DEAL_TEAM_MEMBER, E_DEAL],
    ACCOUNT_OWNER: [E_SALES_ACCOUNT],
    CONTACT_OWNER: [E_SALES_CONTACT],
    PIPELINE_CLOSE_WON_ASSIGNEE: [E_PIPELINE],
};

/**
 * A note for a caller who may move this kind but lacks the entity rights to save it, or null. Reads the
 * caller's effective permissions per entity; `rightsOf` returns null when the entity is unknown.
 */
export function MissingRightsNote(kind: SalesHoldingKind, rightsOf: (entityName: string) => EntityRights | null): string | null {
    const lacking = KIND_ENTITIES[kind].some((entity) => {
        const need = SALES_OFFBOARDING_RIGHTS[entity];
        const have = rightsOf(entity);
        return !have || (['CanCreate', 'CanUpdate', 'CanDelete'] as const).some((k) => need[k] && !have[k]);
    });
    return lacking ? `You may reassign this, but you lack the rights to save it. Needs the ${SALES_OFFBOARDING_ROLE} role.` : null;
}

const GUID_SHAPE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/* ── The shared contract ─────────────────────────────────────────────────────────────────────── */

/** One row of the `Holdings` output, in the shape every app's List action returns. */
export interface OffboardingHolding {
    App: 'Sales';
    Domain: 'Sales';
    Kind: SalesHoldingKind;
    KindLabel: string;
    EntityName: string;
    RecordID: string;
    Label: string;
    CanReassign: boolean;
    Note: string | null;
}

/** One row of the `Skipped` output. */
export interface OffboardingSkip {
    Kind: string;
    EntityName: string;
    RecordID: string;
    Reason: string;
}

export interface OffboardingLeaverInput {
    LeaverUserID?: string | null;
    LeaverEmployeeID?: string | null;
}

export interface OffboardingReassignInput extends OffboardingLeaverInput {
    SuccessorUserID?: string | null;
    /** Restrict to these Kind codes; null or empty means every kind. */
    Kinds?: string[] | null;
    /** Restrict to these record IDs; null or empty means every record. */
    RecordIDs?: string[] | null;
}

export type OffboardingListOutcome = 'SUCCESS' | 'INVALID_INPUT' | 'ERROR';
export type OffboardingReassignOutcome = 'SUCCESS' | 'NOT_AUTHORIZED' | 'INVALID_INPUT' | 'ERROR';

export interface OffboardingListResult {
    Outcome: OffboardingListOutcome;
    Holdings: OffboardingHolding[];
    Message: string;
}

export interface OffboardingReassignResult {
    Outcome: OffboardingReassignOutcome;
    Moved: number;
    Skipped: OffboardingSkip[];
    Message: string;
}

/* ── Pure rules ──────────────────────────────────────────────────────────────────────────────── */

/** A user, their Employee and their Person, as far as each resolves. */
export interface OffboardingParty {
    UserID: string | null;
    EmployeeID: string | null;
    PersonID: string | null;
    /** The Employee's supervisor (`MJ: Employees`.SupervisorID); null when there is no Employee. */
    SupervisorEmployeeID: string | null;
    UserIsActive: boolean;
    Name: string;
}

/** Whether `user` holds the Sales Admin role. Role names compare without case or outer spaces. */
export function HoldsSalesAdminRole(user: UserInfo | null | undefined): boolean {
    const wanted = SALES_ADMIN_ROLE.toLowerCase();
    return (user?.UserRoles ?? []).some((r) => (r.Role ?? '').trim().toLowerCase() === wanted);
}

/**
 * Whether `caller` may move the leaver's sales items (g297.5): the leaver's supervisor, or a Sales
 * Admin. The supervisor branch needs both Employees; a leaver with no Employee has no supervisor.
 */
export function CanReassignSalesHoldings(caller: UserInfo | null | undefined, leaver: Pick<OffboardingParty, 'SupervisorEmployeeID'>): boolean {
    if (!caller) return false;
    if (HoldsSalesAdminRole(caller)) return true;
    const callerEmployeeID = UserEmployeeID(caller);
    return !!callerEmployeeID && !!leaver.SupervisorEmployeeID && UUIDsEqual(callerEmployeeID, leaver.SupervisorEmployeeID);
}

/** The status types whose `IsOpen` flag is set, as lower-case IDs. */
export function OpenStatusIDs(statuses: ReadonlyArray<{ ID: string; IsOpen: boolean | null }>): Set<string> {
    return new Set(statuses.filter((s) => s.IsOpen === true).map((s) => s.ID.toLowerCase()));
}

/**
 * Whether a deal is open: its status type carries `IsOpen`. No status, or one not in the set, is not
 * open, so an unreadable deal is treated as history and left alone.
 */
export function IsOpenDeal(deal: { DealStatusTypeID: string | null }, openStatusIDs: ReadonlySet<string>): boolean {
    return !!deal.DealStatusTypeID && openStatusIDs.has(deal.DealStatusTypeID.toLowerCase());
}

export interface DealRow { ID: string; DealNumber: string | null; Name: string | null; DealStatusTypeID: string | null }
export interface TeamRow { ID: string; DealID: string; DealRoleID: string | null; DealRole: string | null; IsActive: boolean | null }
export interface NamedRow { ID: string; Name: string | null }
export interface ContactRow { ID: string; FirstName: string | null; LastName: string | null; Email: string | null }

/** Everything the holdings are built from, read in one pass. */
export interface SalesHoldingFacts {
    Statuses: Array<{ ID: string; IsOpen: boolean | null }>;
    OwnedDeals: DealRow[];
    TeamRows: TeamRow[];
    /** The deals the team rows sit on, to read their status. */
    TeamDeals: DealRow[];
    OwnerRoleIDs: string[];
    Accounts: NamedRow[];
    Contacts: ContactRow[];
    Pipelines: NamedRow[];
}

function dealLabel(deal: DealRow | undefined, fallbackID: string): string {
    if (!deal) return `Deal ${fallbackID}`;
    const name = (deal.Name ?? '').trim();
    return deal.DealNumber ? `${deal.DealNumber}${name ? ` ${name}` : ''}` : name || `Deal ${deal.ID}`;
}

function contactLabel(c: ContactRow): string {
    const name = [c.FirstName, c.LastName].map((p) => (p ?? '').trim()).filter(Boolean).join(' ');
    return name || (c.Email ?? '').trim() || `Contact ${c.ID}`;
}

/**
 * Turn the facts into holdings. Pure, so which rows count as open and which as history is testable on
 * its own: closed deals and team rows on them are dropped, as are inactive team rows and the owner-role
 * row (listed as DEAL_OWNER instead).
 */
export function BuildSalesHoldings(
    facts: SalesHoldingFacts,
    permission: { CanReassign: boolean; Note: string | null },
): OffboardingHolding[] {
    const open = OpenStatusIDs(facts.Statuses);
    const teamDeals = new Map(facts.TeamDeals.map((d) => [d.ID.toLowerCase(), d]));
    const ownerRoles = new Set(facts.OwnerRoleIDs.map((id) => id.toLowerCase()));
    const row = (Kind: SalesHoldingKind, EntityName: string, RecordID: string, Label: string): OffboardingHolding => ({
        App: 'Sales',
        Domain: 'Sales',
        Kind,
        KindLabel: KIND_LABEL[Kind],
        EntityName,
        RecordID,
        Label,
        CanReassign: permission.CanReassign,
        Note: permission.Note,
    });

    const holdings: OffboardingHolding[] = [];
    for (const deal of facts.OwnedDeals) {
        if (IsOpenDeal(deal, open)) {
            holdings.push(row('DEAL_OWNER', E_DEAL, deal.ID, dealLabel(deal, deal.ID)));
        }
    }
    for (const member of facts.TeamRows) {
        if (member.IsActive === false) continue;
        if (member.DealRoleID && ownerRoles.has(member.DealRoleID.toLowerCase())) continue;
        const deal = teamDeals.get(member.DealID.toLowerCase());
        if (!deal || !IsOpenDeal(deal, open)) continue;
        const role = (member.DealRole ?? '').trim();
        holdings.push(row('DEAL_TEAM_MEMBER', E_DEAL_TEAM_MEMBER, member.ID, `${dealLabel(deal, member.DealID)}${role ? ` (${role})` : ''}`));
    }
    for (const account of facts.Accounts) {
        holdings.push(row('ACCOUNT_OWNER', E_SALES_ACCOUNT, account.ID, (account.Name ?? '').trim() || `Account ${account.ID}`));
    }
    for (const contact of facts.Contacts) {
        holdings.push(row('CONTACT_OWNER', E_SALES_CONTACT, contact.ID, contactLabel(contact)));
    }
    for (const pipeline of facts.Pipelines) {
        holdings.push(row('PIPELINE_CLOSE_WON_ASSIGNEE', E_PIPELINE, pipeline.ID, (pipeline.Name ?? '').trim() || `Pipeline ${pipeline.ID}`));
    }
    return holdings;
}

/** The note on every row the caller may not move, or null when they may. */
export function PermissionNote(canReassign: boolean, leaverName: string): string | null {
    if (canReassign) return null;
    const whose = leaverName ? `${leaverName}'s` : "the leaver's";
    return `Only ${whose} supervisor or a Sales Admin can reassign sales items.`;
}

/** Keep the holdings the request names. An empty or missing filter keeps everything. */
export function FilterRequestedHoldings(
    holdings: readonly OffboardingHolding[],
    kinds: readonly string[] | null | undefined,
    recordIDs: readonly string[] | null | undefined,
): OffboardingHolding[] {
    const kindSet = kinds?.length ? new Set(kinds.map((k) => k.trim().toUpperCase())) : null;
    return holdings.filter(
        (h) => (!kindSet || kindSet.has(h.Kind)) && (!recordIDs?.length || recordIDs.some((id) => UUIDsEqual(id, h.RecordID))),
    );
}

/**
 * Parse an optional JSON array of strings, as the `Kinds` and `RecordIDs` params carry it. Accepts an
 * array as well, for a caller that passes one directly. `null` means not given; `undefined` means it
 * could not be read.
 */
export function ParseStringList(value: unknown): string[] | null | undefined {
    if (value === null || value === undefined) return null;
    let parsed: unknown = value;
    if (typeof value === 'string') {
        if (!value.trim()) return null;
        try {
            parsed = JSON.parse(value);
        } catch {
            return undefined;
        }
    }
    if (!Array.isArray(parsed)) return undefined;
    if (!parsed.every((v): v is string => typeof v === 'string')) return undefined;
    return parsed.map((v) => v.trim()).filter(Boolean);
}

/* ── Reads ───────────────────────────────────────────────────────────────────────────────────── */

function cleanID(id: string | null | undefined): string | null {
    const trimmed = (id ?? '').trim();
    return trimmed ? trimmed : null;
}

function isGuid(id: string | null): boolean {
    return !!id && GUID_SHAPE.test(id);
}

async function readAll(params: RunViewParams[], user: UserInfo): Promise<RunViewResult[]> {
    if (params.length === 0) return [];
    const results = await new RunView().RunViews(params, user);
    if (results?.length !== params.length) throw new Error('the reads returned no result');
    results.forEach((r, i) => {
        if (!r?.Success) throw new Error(`reading ${params[i].EntityName} failed: ${r?.ErrorMessage || 'no result'}`);
    });
    return results;
}

const simple = (EntityName: string, ExtraFilter: string, Fields: string[]): RunViewParams => ({
    EntityName,
    ExtraFilter,
    Fields,
    ResultType: 'simple',
    IgnoreMaxRows: true,
});

interface UserRow { ID: string; Name: string | null; EmployeeID: string | null; IsActive: boolean | null }
interface EmployeeRow { ID: string; FirstName: string | null; LastName: string | null; SupervisorID: string | null }
interface PersonRow { ID: string }

const USER_FIELDS = ['ID', 'Name', 'EmployeeID', 'IsActive'];
const EMPLOYEE_FIELDS = ['ID', 'FirstName', 'LastName', 'SupervisorID'];

/**
 * Resolve a party from a User ID, an Employee ID or both. Returns null when neither resolves. The
 * missing half comes from `MJ: Users`.EmployeeID; the Person from `People`.LinkedUserID.
 */
export async function ResolveOffboardingParty(
    input: { UserID?: string | null; EmployeeID?: string | null },
    user: UserInfo,
): Promise<OffboardingParty | null> {
    const userID = cleanID(input.UserID);
    const employeeID = cleanID(input.EmployeeID);
    if ((userID && !isGuid(userID)) || (employeeID && !isGuid(employeeID)) || (!userID && !employeeID)) return null;

    const first: RunViewParams[] = [];
    if (userID) first.push(simple(E_USER, `ID = '${userID}'`, USER_FIELDS));
    if (employeeID) {
        first.push(simple(E_USER, `EmployeeID = '${employeeID}'`, USER_FIELDS));
        first.push(simple(E_EMPLOYEE, `ID = '${employeeID}'`, EMPLOYEE_FIELDS));
    }
    const reads = await readAll(first, user);
    let i = 0;
    const byID = userID ? ((reads[i++].Results ?? []) as UserRow[])[0] : undefined;
    const byEmployee = employeeID ? ((reads[i++].Results ?? []) as UserRow[])[0] : undefined;
    let employee = employeeID ? ((reads[i++].Results ?? []) as EmployeeRow[])[0] : undefined;

    const userRow = byID ?? byEmployee;
    const resolvedEmployeeID = employee?.ID ?? cleanID(userRow?.EmployeeID);
    if (!userRow && !employee) return null;

    const second: RunViewParams[] = [];
    const needEmployee = !employee && isGuid(resolvedEmployeeID);
    if (needEmployee) second.push(simple(E_EMPLOYEE, `ID = '${resolvedEmployeeID}'`, EMPLOYEE_FIELDS));
    if (userRow) second.push(simple(E_PERSON, `LinkedUserID = '${userRow.ID}'`, ['ID']));
    const more = await readAll(second, user);
    let j = 0;
    if (needEmployee) employee = ((more[j++].Results ?? []) as EmployeeRow[])[0];
    const person = userRow ? ((more[j++].Results ?? []) as PersonRow[])[0] : undefined;

    const employeeName = employee ? [employee.FirstName, employee.LastName].map((p) => (p ?? '').trim()).filter(Boolean).join(' ') : '';
    return {
        UserID: userRow?.ID ?? null,
        EmployeeID: employee?.ID ?? null,
        PersonID: person?.ID ?? null,
        SupervisorEmployeeID: cleanID(employee?.SupervisorID),
        UserIsActive: userRow?.IsActive === true,
        Name: employeeName || (userRow?.Name ?? '').trim(),
    };
}

/** Read what the leaver holds. Every read runs as the caller. */
export async function ReadSalesHoldingFacts(leaver: OffboardingParty, user: UserInfo): Promise<SalesHoldingFacts> {
    const facts: SalesHoldingFacts = {
        Statuses: [], OwnedDeals: [], TeamRows: [], TeamDeals: [], OwnerRoleIDs: [], Accounts: [], Contacts: [], Pipelines: [],
    };
    const employeeID = isGuid(leaver.EmployeeID) ? leaver.EmployeeID : null;
    const personID = isGuid(leaver.PersonID) ? leaver.PersonID : null;
    const params: RunViewParams[] = [];
    const slots: Array<(r: RunViewResult) => void> = [];
    const add = (p: RunViewParams, take: (r: RunViewResult) => void) => { params.push(p); slots.push(take); };

    if (employeeID) {
        add(simple(E_DEAL_STATUS, '', ['ID', 'IsOpen']), (r) => { facts.Statuses = r.Results as SalesHoldingFacts['Statuses']; });
        add(simple(E_DEAL, `OwnerEmployeeID = '${employeeID}'`, ['ID', 'DealNumber', 'Name', 'DealStatusTypeID']), (r) => { facts.OwnedDeals = r.Results as DealRow[]; });
        add(simple(E_DEAL_TEAM_MEMBER, `EmployeeID = '${employeeID}'`, ['ID', 'DealID', 'DealRoleID', 'DealRole', 'IsActive']), (r) => { facts.TeamRows = r.Results as TeamRow[]; });
        add(simple(E_DEAL_ROLE, 'IsOwnerRole = 1', ['ID']), (r) => { facts.OwnerRoleIDs = (r.Results as Array<{ ID: string }>).map((x) => x.ID); });
        add(simple(E_SALES_ACCOUNT, `OwnerEmployeeID = '${employeeID}'`, ['ID', 'Name']), (r) => { facts.Accounts = r.Results as NamedRow[]; });
        add(simple(E_SALES_CONTACT, `OwnerEmployeeID = '${employeeID}'`, ['ID', 'FirstName', 'LastName', 'Email']), (r) => { facts.Contacts = r.Results as ContactRow[]; });
    }
    if (personID) {
        add(simple(E_PIPELINE, `CloseWonAssigneePersonID = '${personID}'`, ['ID', 'Name']), (r) => { facts.Pipelines = r.Results as NamedRow[]; });
    }
    const reads = await readAll(params, user);
    reads.forEach((r, i) => slots[i](r));

    const dealIDs = [...new Set(facts.TeamRows.map((t) => t.DealID).filter((id) => isGuid(id)))];
    if (dealIDs.length) {
        const [teamDeals] = await readAll(
            [simple(E_DEAL, `ID IN (${dealIDs.map((id) => `'${id}'`).join(', ')})`, ['ID', 'DealNumber', 'Name', 'DealStatusTypeID'])],
            user,
        );
        facts.TeamDeals = teamDeals.Results as DealRow[];
    }
    return facts;
}

/* ── The two operations ──────────────────────────────────────────────────────────────────────── */

const NO_LEAVER = 'Neither LeaverUserID nor LeaverEmployeeID names a user or employee.';

async function holdingsFor(leaver: OffboardingParty, caller: UserInfo): Promise<OffboardingHolding[]> {
    const canReassign = CanReassignSalesHoldings(caller, leaver);
    const facts = await ReadSalesHoldingFacts(leaver, caller);
    return BuildSalesHoldings(facts, { CanReassign: canReassign, Note: PermissionNote(canReassign, leaver.Name) });
}

/**
 * The caller's effective rights on an entity, from the provider's metadata, or null when the entity is
 * not known there.
 */
function rightsReader(provider: IMetadataProvider | null | undefined, caller: UserInfo): (entityName: string) => EntityRights | null {
    return (entityName) => {
        const entity = provider?.Entities?.find((e) => e.Name === entityName);
        return entity ? entity.GetUserPermisions(caller) : null;
    };
}

/** Add the missing-rights note to rows the caller may move but could not save. */
export function NoteMissingRights(
    holdings: OffboardingHolding[],
    rightsOf: (entityName: string) => EntityRights | null,
): OffboardingHolding[] {
    return holdings.map((h) => {
        if (!h.CanReassign) return h;
        const note = MissingRightsNote(h.Kind, rightsOf);
        return note ? { ...h, Note: note } : h;
    });
}

/** `Sales.ListOffboardingHoldings`. Never throws. */
export async function ListSalesOffboardingHoldings(
    input: OffboardingLeaverInput,
    caller: UserInfo,
    provider?: IMetadataProvider | null,
): Promise<OffboardingListResult> {
    try {
        const leaver = await ResolveOffboardingParty({ UserID: input.LeaverUserID, EmployeeID: input.LeaverEmployeeID }, caller);
        if (!leaver) return { Outcome: 'INVALID_INPUT', Holdings: [], Message: NO_LEAVER };
        const holdings = provider
            ? NoteMissingRights(await holdingsFor(leaver, caller), rightsReader(provider, caller))
            : await holdingsFor(leaver, caller);
        return { Outcome: 'SUCCESS', Holdings: holdings, Message: `${holdings.length} sales item(s) held.` };
    } catch (err) {
        return { Outcome: 'ERROR', Holdings: [], Message: `Listing sales holdings failed: ${err instanceof Error ? err.message : String(err)}` };
    }
}

/** Why a single move did not happen, or null when the record saved. */
type Mover = (holding: OffboardingHolding) => Promise<string | null>;

function saveRefusal(entity: BaseEntity): string {
    const result = entity.LatestResult;
    return result?.CompleteMessage || result?.Message || 'the save was refused';
}

type Parties = { Leaver: OffboardingParty; Successor: OffboardingParty };

function reassignFailure(Outcome: OffboardingReassignOutcome, Message: string): OffboardingReassignResult {
    return { Outcome, Moved: 0, Skipped: [], Message };
}

/** Resolve the leaver and the successor, or say why the request is invalid. */
async function resolveParties(input: OffboardingReassignInput, caller: UserInfo): Promise<Parties | string> {
    const successorUserID = cleanID(input.SuccessorUserID);
    if (!successorUserID) return 'SuccessorUserID is required.';
    const leaver = await ResolveOffboardingParty({ UserID: input.LeaverUserID, EmployeeID: input.LeaverEmployeeID }, caller);
    if (!leaver) return NO_LEAVER;
    const successor = await ResolveOffboardingParty({ UserID: successorUserID }, caller);
    if (!successor?.UserID) return `SuccessorUserID ${successorUserID} is not a user.`;
    const sameUser = !!leaver.UserID && UUIDsEqual(leaver.UserID, successor.UserID);
    const sameEmployee = !!leaver.EmployeeID && !!successor.EmployeeID && UUIDsEqual(leaver.EmployeeID, successor.EmployeeID);
    if (sameUser || sameEmployee) return 'The successor is the leaver.';
    if (!successor.UserIsActive) return `${successor.Name || 'The successor'} is not an active user.`;
    return { Leaver: leaver, Successor: successor };
}

/** Why `holding` cannot move to `successor` before any save is tried, or null. */
export function PreSaveSkipReason(holding: OffboardingHolding, successor: OffboardingParty, takenSeats: ReadonlySet<string>): string | null {
    const who = successor.Name || 'The successor';
    if (!holding.CanReassign) return holding.Note ?? 'Not authorized.';
    if (holding.Kind === 'PIPELINE_CLOSE_WON_ASSIGNEE' && !successor.PersonID) {
        return `${who} has no Person record, so close-won tasks cannot be routed to them.`;
    }
    if (EMPLOYEE_KINDS.has(holding.Kind) && !successor.EmployeeID) {
        return `${who} has no Employee record.`;
    }
    if (holding.Kind === 'DEAL_TEAM_MEMBER' && takenSeats.has(holding.RecordID.toLowerCase())) {
        return `${who} already holds this role on the deal.`;
    }
    return null;
}

/** `Sales.ReassignOffboardingHoldings`. Never throws. */
export async function ReassignSalesOffboardingHoldings(
    input: OffboardingReassignInput,
    provider: IMetadataProvider,
    caller: UserInfo,
): Promise<OffboardingReassignResult> {
    try {
        const parties = await resolveParties(input, caller);
        if (typeof parties === 'string') return reassignFailure('INVALID_INPUT', parties);
        const { Leaver: leaver, Successor: successor } = parties;

        const requested = FilterRequestedHoldings(await holdingsFor(leaver, caller), input.Kinds, input.RecordIDs);
        if (requested.length === 0) return { Outcome: 'SUCCESS', Moved: 0, Skipped: [], Message: 'Nothing to move.' };
        const permitted = requested.filter((h) => h.CanReassign);
        if (permitted.length === 0) {
            return reassignFailure('NOT_AUTHORIZED', PermissionNote(false, leaver.Name) ?? 'Not authorized.');
        }
        if (!successor.EmployeeID && permitted.some((h) => EMPLOYEE_KINDS.has(h.Kind))) {
            return reassignFailure(
                'INVALID_INPUT',
                `${successor.Name || 'The successor'} has no Employee record, so deals, accounts and contacts cannot move to them.`,
            );
        }
        const taken = await successorTeamSeats(permitted, successor.EmployeeID, caller);
        return await moveEach(requested, buildMovers(provider, caller, successor), (h) => PreSaveSkipReason(h, successor, taken));
    } catch (err) {
        return reassignFailure('ERROR', `Reassigning sales holdings failed: ${err instanceof Error ? err.message : String(err)}`);
    }
}

/** Move each holding in turn; one refusal never stops the rest. */
async function moveEach(
    holdings: readonly OffboardingHolding[],
    movers: Record<SalesHoldingKind, Mover>,
    preSkip: (h: OffboardingHolding) => string | null,
): Promise<OffboardingReassignResult> {
    const skipped: OffboardingSkip[] = [];
    let moved = 0;
    for (const holding of holdings) {
        let reason = preSkip(holding);
        if (!reason) {
            try {
                reason = await movers[holding.Kind](holding);
            } catch (err) {
                reason = err instanceof Error ? err.message : String(err);
            }
        }
        if (reason) skipped.push({ Kind: holding.Kind, EntityName: holding.EntityName, RecordID: holding.RecordID, Reason: reason });
        else moved++;
    }
    return {
        Outcome: 'SUCCESS',
        Moved: moved,
        Skipped: skipped,
        Message: `Moved ${moved} of ${holdings.length} sales item(s)${skipped.length ? `; ${skipped.length} skipped` : ''}.`,
    };
}

/**
 * The leaver's team rows whose (deal, role) the successor already holds. Moving those would collide
 * with the team's unique key, so they are skipped with a reason instead of failing in the database.
 */
async function successorTeamSeats(
    holdings: readonly OffboardingHolding[],
    successorEmployeeID: string | null,
    caller: UserInfo,
): Promise<Set<string>> {
    const memberIDs = holdings.filter((h) => h.Kind === 'DEAL_TEAM_MEMBER' && isGuid(h.RecordID)).map((h) => h.RecordID);
    if (!memberIDs.length || !isGuid(successorEmployeeID)) return new Set();
    type SeatRow = { ID: string; DealID: string; DealRoleID: string | null };
    const [leaverRead] = await readAll(
        [simple(E_DEAL_TEAM_MEMBER, `ID IN (${memberIDs.map((id) => `'${id}'`).join(', ')})`, ['ID', 'DealID', 'DealRoleID'])],
        caller,
    );
    const leaverRows = leaverRead.Results as SeatRow[];
    const dealIDs = [...new Set(leaverRows.map((r) => r.DealID).filter((id) => isGuid(id)))];
    if (!dealIDs.length) return new Set();
    const [successorRead] = await readAll(
        [simple(
            E_DEAL_TEAM_MEMBER,
            `EmployeeID = '${successorEmployeeID}' AND DealID IN (${dealIDs.map((id) => `'${id}'`).join(', ')})`,
            ['ID', 'DealID', 'DealRoleID'],
        )],
        caller,
    );
    const seat = (r: SeatRow) => `${r.DealID.toLowerCase()}|${(r.DealRoleID ?? '').toLowerCase()}`;
    const held = new Set((successorRead.Results as SeatRow[]).map(seat));
    return new Set(leaverRows.filter((r) => held.has(seat(r))).map((r) => r.ID.toLowerCase()));
}

function buildMovers(provider: IMetadataProvider, caller: UserInfo, successor: OffboardingParty): Record<SalesHoldingKind, Mover> {
    const load = async <T extends BaseEntity>(h: OffboardingHolding): Promise<T | string> => {
        const entity = await provider.GetEntityObject<T>(h.EntityName, caller);
        return (await entity.InnerLoad(CompositeKey.FromID(h.RecordID))) ? entity : `${h.Label} could not be loaded.`;
    };
    const setField = (field: string, value: () => string | null): Mover => async (h) => {
        const entity = await load<BaseEntity>(h);
        if (typeof entity === 'string') return entity;
        entity.Set(field, value());
        return (await entity.Save()) ? null : saveRefusal(entity);
    };
    return {
        DEAL_OWNER: async (h) => {
            const deal = await load<DealEntity>(h);
            if (typeof deal === 'string') return deal;
            await deal.SetOwner(successor.EmployeeID);
            return (await deal.Save()) ? null : saveRefusal(deal);
        },
        DEAL_TEAM_MEMBER: setField('EmployeeID', () => successor.EmployeeID),
        ACCOUNT_OWNER: setField('OwnerEmployeeID', () => successor.EmployeeID),
        CONTACT_OWNER: setField('OwnerEmployeeID', () => successor.EmployeeID),
        PIPELINE_CLOSE_WON_ASSIGNEE: setField('CloseWonAssigneePersonID', () => successor.PersonID),
    };
}
