/**
 * @fileoverview Shared `DealRole` rules for team rows saved on their own (`DealTeamMemberEntityServer`)
 * or inside a deal's graph (`DealEntityServer`).
 *
 * `BaseEntity.Save()` on a deal with children routes through `saveGraph` -> `saveAsGraphNode` ->
 * `_InnerSave`, which never enters `DealTeamMemberEntityServer.Save()`. Sharing the checks here ensures
 * a team row added through `deal.Team` obeys the same single-holder (`AllowsMultiplePerDeal = 0`) and
 * employee-only owner (`IsOwnerRole = 1`) rules as a row saved from the Internal team grid.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import type { IRunViewProvider, UserInfo } from '@memberjunction/core';
import { UUIDsEqual } from '@memberjunction/global';

const DEAL_TEAM_MEMBER_ENTITY = 'MJ_BizApps_Sales: Deal Team Members';
const DEAL_ROLE_ENTITY = 'MJ_BizApps_Sales: Deal Roles';

/** The `DealRole` columns the save checks read. */
export type DealRoleRules = {
    Name: string | null;
    AllowsMultiplePerDeal: boolean | null;
    IsOwnerRole: boolean | null;
};

/** The team-member fields `CheckTeamGraphRoleRules` inspects on each row in `deal.Team.Items`. */
export interface TeamGraphMemberCandidate {
    ID?: string | null;
    IsSaved?: boolean;
    Dirty?: boolean;
    DealRoleID?: string | null;
    EmployeeID?: string | null;
    Employee?: string | null;
}

/**
 * Reads the `DealRole` rules for `roleID`. Returns `null` when `roleID` is empty or the role row is
 * absent; throws when the read itself fails so the caller fails closed.
 */
export async function ReadDealRoleRules(
    roleID: string | null | undefined,
    view: IRunViewProvider,
    user: UserInfo | undefined,
): Promise<DealRoleRules | null> {
    if (!roleID) {
        return null;
    }
    const roleRead = await view.RunView<DealRoleRules>(
        {
            EntityName: DEAL_ROLE_ENTITY,
            ExtraFilter: `ID = '${roleID}'`,
            ResultType: 'simple',
            Fields: ['Name', 'AllowsMultiplePerDeal', 'IsOwnerRole'],
        },
        user,
    );
    if (!roleRead.Success) {
        throw new Error(`could not read the deal role: ${roleRead.ErrorMessage}`);
    }
    return (roleRead.Results ?? [])[0] ?? null;
}

/**
 * Refuses an owner-role row that names a Person instead of an Employee.
 *
 * Read from `DealRole.IsOwnerRole`, the same flag `stampOwnerFromTeam` resolves the owner role by.
 */
export function OwnerWithoutEmployeeRefusal(
    role: DealRoleRules | null,
    employeeID: string | null | undefined,
): string | null {
    if (!role?.IsOwnerRole || employeeID) {
        return null;
    }
    const roleName = role.Name ?? 'owner';
    return (
        `The ${roleName} must be an employee, because the deal's owner is read from the Employee field. `
        + `Choose them in Employee and leave Person empty.`
    );
}

/** Formats the single-holder refusal message for `role`. */
export function DuplicateRoleMessage(role: DealRoleRules, holderName?: string | null): string {
    const inRole = role.Name ? `the ${role.Name} role` : 'that role';
    const who = holderName ? ` (${holderName})` : '';
    return (
        `This deal already has someone in ${inRole}${who}. Change that row's employee instead `
        + `of adding a second one.`
    );
}

/**
 * Refuses a second holder of a role with `AllowsMultiplePerDeal = 0` by checking persisted
 * `DealTeamMember` rows on the deal.
 */
export async function PersistedDuplicateRoleRefusal(params: {
    dealID: string | null | undefined;
    roleID: string | null | undefined;
    role: DealRoleRules | null;
    excludeMemberID?: string | null;
    view: IRunViewProvider;
    user: UserInfo | undefined;
}): Promise<string | null> {
    const { dealID, roleID, role, excludeMemberID, view, user } = params;
    if (!dealID || !roleID || !role || role.AllowsMultiplePerDeal) {
        return null;
    }

    const notSelf = excludeMemberID ? ` AND ID <> '${excludeMemberID}'` : '';
    const held = await view.RunView<{ Employee: string | null }>(
        {
            EntityName: DEAL_TEAM_MEMBER_ENTITY,
            ExtraFilter: `DealID = '${dealID}' AND DealRoleID = '${roleID}'${notSelf}`,
            ResultType: 'simple',
            Fields: ['Employee'],
        },
        user,
    );
    if (!held.Success) {
        throw new Error(`could not check the deal's existing ${role.Name ?? 'role'} rows: ${held.ErrorMessage}`);
    }
    const existing = (held.Results ?? [])[0];
    if (!existing) {
        return null;
    }
    return DuplicateRoleMessage(role, existing.Employee);
}

/**
 * Checks team rows staged on a deal graph save against `DealRole` rules (`IsOwnerRole` requires an
 * `EmployeeID`, and `AllowsMultiplePerDeal = 0` admits at most one holder per deal).
 *
 * When `teamIsLoaded` is true (or the deal is unsaved), `items` is the complete post-save roster — any
 * previously persisted row removed via `Team.Remove()` is queued for deletion in the same graph save —
 * so duplicate-holder collisions are checked across `items`. When `dealIsSaved && !teamIsLoaded`, the
 * caller staged rows without loading the existing team, so persisted rows on `dealID` are checked too.
 */
export async function CheckTeamGraphRoleRules(params: {
    dealID: string | null | undefined;
    dealIsSaved: boolean;
    teamIsLoaded: boolean;
    items: readonly TeamGraphMemberCandidate[];
    view: IRunViewProvider;
    user: UserInfo | undefined;
}): Promise<string | null> {
    const { dealID, dealIsSaved, teamIsLoaded, items, view, user } = params;
    if (!items.some((m) => !m.IsSaved || m.Dirty)) {
        return null;
    }

    const roleCache = new Map<string, DealRoleRules | null>();
    const readRole = async (roleID: string): Promise<DealRoleRules | null> => {
        const key = roleID.toLowerCase();
        if (roleCache.has(key)) {
            return roleCache.get(key) ?? null;
        }
        const role = await ReadDealRoleRules(roleID, view, user);
        roleCache.set(key, role);
        return role;
    };

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const roleID = item.DealRoleID ?? null;
        if (!roleID) {
            continue;
        }
        const role = await readRole(roleID);
        const ownerRefusal = OwnerWithoutEmployeeRefusal(role, item.EmployeeID);
        if (ownerRefusal) {
            return ownerRefusal;
        }

        if (!role || role.AllowsMultiplePerDeal) {
            continue;
        }

        const earlier = items
            .slice(0, i)
            .find((prior) => UUIDsEqual(prior.DealRoleID, roleID));
        if (earlier) {
            return DuplicateRoleMessage(role, earlier.Employee ?? null);
        }

        if (dealIsSaved && !teamIsLoaded && dealID) {
            const persistedRefusal = await PersistedDuplicateRoleRefusal({
                dealID,
                roleID,
                role,
                excludeMemberID: item.IsSaved ? (item.ID ?? null) : null,
                view,
                user,
            });
            if (persistedRefusal) {
                return persistedRefusal;
            }
        }
    }

    return null;
}
