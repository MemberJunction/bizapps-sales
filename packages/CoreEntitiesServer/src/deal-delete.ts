/**
 * @fileoverview Who may delete a deal, and what goes with it (golive#429).
 *
 * THE RULES. A deal may be deleted only while it is open and has never been closed, and only by:
 *   - a holder of `MJ.BizApps.Sales.Deal.Delete` (the Sales Admin role, and Developer): any such deal;
 *   - a holder of `MJ.BizApps.Sales.Deal.DeleteOwn` (the Sales User role): only a deal they own, read
 *     off `Deal.OwnerEmployeeID` against the user's own `EmployeeID`.
 * Its embedded order goes with it, and a Confirmed order blocks the delete: a booked order is
 * corrected with a reversal order, never deleted, and orders refuses the delete on its own as well.
 *
 * "NEVER BEEN CLOSED" IS READ FROM THE STAGE HISTORY, not from the current status. A deal closed and
 * then reopened is open today, but it has already produced the close's side effects (a contract, an
 * order status change, finance tasks), so deleting it would orphan them. The history row carries the
 * status it moved to, and the status type says whether that status locks the deal; no status name is
 * compared (CLAUDE.md rule 2).
 *
 * FAILS CLOSED. An authorization missing from the catalog is held by nobody, and a read that fails is
 * a refusal, never a guess. Before this app's metadata is pushed nobody can delete a deal, which is what
 * every host already sees.
 *
 * WHY THE DEAL'S OWN CHILD ROWS GO BY SQL. `DealStageEvent` refuses a delete through its entity on
 * purpose, and the team-member and payment-schedule entities re-stamp or re-sync the deal after each
 * row they remove, which would re-save the deal this delete is removing. These four tables belong to the
 * deal and nothing else, the caller has already passed the deal's own delete check, and the whole delete
 * runs in one transaction, so removing them directly is the narrow path. The order is deleted through
 * orders' own entity, which owns its rules.
 */
import {
    AuthorizationEvaluator,
    type AuthorizationInfo,
    type IMetadataProvider,
    type IRunViewProvider,
    type RunViewParams,
    type UserInfo,
} from '@memberjunction/core';
import { UUIDsEqual } from '@memberjunction/global';
import { IsBooked } from '@mj-biz-apps/orders-entities';
import type { SQLServerDataProvider } from '@memberjunction/sqlserver-dataprovider';

import { SALES_SCHEMA } from './SequenceService.js';

export const DEAL_DELETE_AUTH = {
    /** Delete any open deal that was never closed. Parent of `Own`, so it implies it. */
    Any: 'MJ.BizApps.Sales.Deal.Delete',
    /** Delete an open, never-closed deal the user owns. */
    Own: 'MJ.BizApps.Sales.Deal.DeleteOwn',
} as const;

export type DealDeleteScope = 'any' | 'own' | 'none';

/** What the delete check needs to know about one deal, all read before anything is removed. */
export interface DealDeleteFacts {
    Scope: DealDeleteScope;
    UserEmployeeID: string | null;
    OwnerEmployeeID: string | null;
    /** The deal's current status locks it (Won or Lost). */
    ClosedNow: boolean;
    /** A stage event moved the deal into a locking status at some point, even if it was reopened. */
    ClosedBefore: boolean;
    /** The embedded order's status, or null when the deal has no order. */
    OrderStatus: string | null;
}

/** The subject of the check, as the deal entity holds it. */
export interface DealDeleteSubject {
    DealID: string;
    DealName: string;
    StatusID: string | null;
    OwnerEmployeeID: string | null;
    OrderID: string | null;
}

const DEAL_STATUS_ENTITY = 'MJ_BizApps_Sales: Deal Status Types';
const DEAL_STAGE_EVENT_ENTITY = 'MJ_BizApps_Sales: Deal Stage Events';
const ORDER_HEADER_ENTITY = 'MJ_BizApps_Orders: Order Headers';
const GUID_SHAPE = /^[0-9a-fA-F-]{36}$/;

/** The deal's own child tables, in the order they are removed. None of them is referenced by another. */
const DEAL_CHILD_TABLES = ['DealStageEvent', 'DealContactRole', 'DealPaymentSchedule', 'DealTeamMember'] as const;

/**
 * Which delete grant `user` holds. `Any` is checked on its own; `Own` with ancestors, so a holder of
 * `Any` passes it too.
 */
export function UserDealDeleteScope(user: UserInfo | null | undefined, authorizations: AuthorizationInfo[]): DealDeleteScope {
    if (!user) return 'none';
    const evaluator = new AuthorizationEvaluator();
    const any = authorizations.find((a) => a.Name === DEAL_DELETE_AUTH.Any);
    if (any && evaluator.UserCanExecute(any, user)) return 'any';
    const own = authorizations.find((a) => a.Name === DEAL_DELETE_AUTH.Own);
    if (own && evaluator.UserCanExecuteWithAncestors(own, user, authorizations)) return 'own';
    return 'none';
}

/** The reason a delete is refused, or null when it may go ahead. Pure, so each rule is testable alone. */
export function DealDeleteRefusal(facts: DealDeleteFacts, dealName: string): string | null {
    const deal = dealName ? `Deal "${dealName}"` : 'This deal';
    if (facts.Scope === 'none') {
        return `${deal} was not deleted: deleting a deal needs the Sales User or Sales Admin role.`;
    }
    if (facts.Scope === 'own' && !ownsDeal(facts)) {
        return `${deal} was not deleted: the Sales User role can delete only deals you own. Ask a Sales Admin to delete it.`;
    }
    if (facts.ClosedNow) {
        return `${deal} was not deleted: it is closed. A closed deal cannot be deleted.`;
    }
    if (facts.ClosedBefore) {
        return `${deal} was not deleted: it was closed before and reopened, so its close may already have created a contract or changed its order.`;
    }
    if (facts.OrderStatus && IsBooked(facts.OrderStatus)) {
        return `${deal} was not deleted: its order is ${facts.OrderStatus}. A confirmed order is corrected with a reversal order, not deleted.`;
    }
    return null;
}

function ownsDeal(facts: DealDeleteFacts): boolean {
    return !!facts.UserEmployeeID && !!facts.OwnerEmployeeID && UUIDsEqual(facts.UserEmployeeID, facts.OwnerEmployeeID);
}

/**
 * The user's Employee, or null. Read as a string: `UserInfo.EmployeeID` is typed `number` in
 * `@memberjunction/core`, but the column is a uniqueidentifier (see `creatorEmployeeID` on the deal).
 */
export function UserEmployeeID(user: UserInfo | null | undefined): string | null {
    const id = (user as unknown as { EmployeeID?: string | number | null } | null)?.EmployeeID;
    return typeof id === 'string' && id.trim().length > 0 ? id : null;
}

/**
 * Read everything the check needs in one round trip: the locking status types, the deal's stage
 * history and its order's status. Throws on a failed read so the caller refuses.
 */
export async function ReadDealDeleteFacts(
    subject: DealDeleteSubject,
    provider: IMetadataProvider,
    user: UserInfo,
): Promise<DealDeleteFacts> {
    requireGuid(subject.DealID, 'deal');
    if (subject.OrderID) requireGuid(subject.OrderID, 'order');
    const views = provider as unknown as IRunViewProvider;
    const params: RunViewParams[] = [
        { EntityName: DEAL_STATUS_ENTITY, ExtraFilter: 'LocksDeal = 1', ResultType: 'simple', Fields: ['ID'] },
        { EntityName: DEAL_STAGE_EVENT_ENTITY, ExtraFilter: `DealID = '${subject.DealID}'`, ResultType: 'simple', Fields: ['ToDealStatusTypeID'] },
    ];
    if (subject.OrderID) {
        params.push({ EntityName: ORDER_HEADER_ENTITY, ExtraFilter: `ID = '${subject.OrderID}'`, ResultType: 'simple', Fields: ['Status'] });
    }
    const reads = await views.RunViews(params, user);
    if (reads?.length !== params.length) throw new Error('the reads returned no result');
    for (const read of reads) {
        if (!read?.Success) throw new Error(read?.ErrorMessage || 'a read returned no result');
    }
    const [locking, history, order] = reads;
    const lockingIDs = (locking.Results as Array<{ ID: string }>).map((r) => r.ID);
    const locks = (id: string | null | undefined) => !!id && lockingIDs.some((l) => UUIDsEqual(l, id));
    const orderRow = order ? (order.Results as Array<{ Status: string | null }>)[0] : undefined;
    if (subject.OrderID && !orderRow) throw new Error(`its order ${subject.OrderID} could not be found`);
    return {
        Scope: UserDealDeleteScope(user, provider.Authorizations ?? []),
        UserEmployeeID: UserEmployeeID(user),
        OwnerEmployeeID: subject.OwnerEmployeeID,
        ClosedNow: locks(subject.StatusID),
        ClosedBefore: (history.Results as Array<{ ToDealStatusTypeID: string | null }>).some((e) => locks(e.ToDealStatusTypeID)),
        OrderStatus: orderRow?.Status ?? null,
    };
}

/** Remove the deal's own child rows. Must run inside the delete's transaction. */
export async function DeleteDealChildRows(dealID: string, provider: IMetadataProvider, user: UserInfo): Promise<void> {
    requireGuid(dealID, 'deal');
    const sql = DEAL_CHILD_TABLES.map((t) => `DELETE FROM ${SALES_SCHEMA}.${t} WHERE DealID = @DealID;`).join('\n');
    await (provider as unknown as SQLServerDataProvider).ExecuteSQL(
        sql,
        { DealID: dealID },
        { isMutation: true, description: 'Delete a deal: its child rows' },
        user,
    );
}

function requireGuid(id: string, what: string): void {
    if (!GUID_SHAPE.test(id)) throw new Error(`the ${what} id "${id}" is not a valid id`);
}
