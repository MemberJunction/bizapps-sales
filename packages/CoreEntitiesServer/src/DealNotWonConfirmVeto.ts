/**
 * @fileoverview Sales' answer to Orders' question: may this order be confirmed?
 *
 * ── WHAT THIS IS ────────────────────────────────────────────────────────────────────────────────
 *
 * bc-aidp-next-golive#323. A deal closed Won mints an order. The deal is then REOPENED, putting it
 * back to Open — and twenty seconds later the order was confirmed from the order screen and booked:
 * a booking entry, a subscription and twelve recognition entries. The deal sat Open at 75% on a
 * booked order until it was closed Won again.
 *
 * Sales already refuses the reverse — `Sales.ReopenDeal` will not reopen a deal whose order has
 * booked, because the ledger has moved. This is that rule facing the other way.
 *
 * Orders cannot enforce it alone, and not only for the dependency reason the line-edit veto gives:
 * there is NO LINK TO FOLLOW. `Deal.OrderID` points at the order; `OrderHeader` carries no `DealID`,
 * only an `Origin` that reads `Direct` on every row. So Orders asks, via `RegisterOrderConfirmVeto`,
 * and this is the app that can answer.
 *
 * ── BY FLAG, NEVER BY NAME ──────────────────────────────────────────────────────────────────────
 *
 * `DealStatusType.IsWon`, the same flag `CloseDealOperation` reads to decide what a close means. Not
 * the status NAME: a deployment may add a won-shaped status, rename one, or run several, and a rule
 * matching names would quietly stop covering it. `vwDeals` exposes the name as a string and it is
 * deliberately not used here. This is the same choice `DealLockOrderLineVeto` makes with `LocksDeal`.
 *
 * ── AN ORDER WITH NO DEAL IS NOT THIS APP'S BUSINESS ────────────────────────────────────────────
 *
 * Orders are created directly too, and most on this host were. A confirm of an order no deal points
 * at is allowed without comment — refusing it would make installing Sales break ordinary ordering,
 * which is the failure mode a seam exists to avoid.
 *
 * ── FAILING TO ANSWER IS A REFUSAL, AND THAT IS THE SEAM'S RULE, NOT OURS ───────────────────────
 *
 * `ResolveOrderConfirmRefusal` turns a thrown vetoer into a refusal naming the fault, so this throws
 * rather than returning null when a read fails. A lookup that could not run has not said the deal is
 * Won, and confirming on "could not tell" books against a deal that may be open — the exact outcome
 * this exists to prevent, reached by a different route. Same trade as `DealLockOrderLineVeto`.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */

import { RunView, type UserInfo } from '@memberjunction/core';
import {
    RegisterOrderConfirmVeto,
    type OrderConfirmContext,
    type OrderConfirmVeto,
} from '@mj-biz-apps/orders-entities';

const DEAL_ENTITY = 'MJ_BizApps_Sales: Deals';
const DEAL_STATUS_ENTITY = 'MJ_BizApps_Sales: Deal Status Types';

/** The deal an order came from, as this check reads it. Null when no deal points at the order. */
type OwningDeal = { DealID: string; DealNumber: string | null; DealStatusTypeID: string | null } | null;

export class DealNotWonConfirmVeto implements OrderConfirmVeto {
    public async MayConfirm(context: OrderConfirmContext): Promise<string | null> {
        const owner = await this.owningDeal(context.OrderHeaderID, context.ContextUser);
        if (!owner) {
            return null;
        }
        /**
         * A deal with no status cannot be Won, so this refuses. The deal is in a state nobody can
         * read, and booking against it would be a decision made by absence.
         */
        if (owner.DealStatusTypeID && (await this.statusIsWon(owner.DealStatusTypeID, context.ContextUser))) {
            return null;
        }
        const named = owner.DealNumber?.trim() || owner.DealID;
        return (
            `Deal ${named} is not Won, so this order cannot be confirmed yet. Close the deal as Won ` +
            'first — confirming now would book an order against a deal that is still open.'
        );
    }

    /** The deal pointing at this order, if any. `Deal.OrderID` is the only link between the two. */
    private async owningDeal(orderID: string, user: UserInfo | null): Promise<OwningDeal> {
        const result = await new RunView().RunView<{ ID: string; DealNumber: string | null; DealStatusTypeID: string | null }>(
            {
                EntityName: DEAL_ENTITY,
                ExtraFilter: `OrderID = '${SafeID(orderID)}'`,
                Fields: ['ID', 'DealNumber', 'DealStatusTypeID'],
                ResultType: 'simple',
            },
            user ?? undefined,
        );
        if (!result.Success) {
            throw new Error(`the deal behind this order could not be read: ${result.ErrorMessage ?? 'unknown error'}`);
        }
        const row = (result.Results ?? [])[0];
        return row
            ? { DealID: row.ID, DealNumber: row.DealNumber ?? null, DealStatusTypeID: row.DealStatusTypeID ?? null }
            : null;
    }

    /**
     * Whether that status is a winning one.
     *
     * A read that fails THROWS rather than defaulting either way. Defaulting to "won" would confirm
     * on an unreadable deal; defaulting to "not won" would refuse every confirm on this host the
     * moment the view broke. The caller turns the throw into a refusal that names the fault, which
     * is both safe and diagnosable.
     */
    private async statusIsWon(statusID: string, user: UserInfo | null): Promise<boolean> {
        const result = await new RunView().RunView<{ IsWon: boolean }>(
            {
                EntityName: DEAL_STATUS_ENTITY,
                ExtraFilter: `ID = '${SafeID(statusID)}'`,
                Fields: ['IsWon'],
                ResultType: 'simple',
            },
            user ?? undefined,
        );
        if (!result.Success) {
            throw new Error(`the deal's status could not be read: ${result.ErrorMessage ?? 'unknown error'}`);
        }
        const row = (result.Results ?? [])[0];
        // An absent status row is as unanswerable as a failed read, and is not a win.
        return row?.IsWon === true;
    }
}

/** Single-quote escaping for an id interpolated into an `ExtraFilter`. */
function SafeID(id: string): string {
    return String(id).replace(/'/g, "''");
}

/**
 * Registers this app's answer. Called at bootstrap beside the other registrations.
 *
 * Last-call-wins in the registry, so a host that boots twice in one process ends up with one vetoer.
 */
export function LoadDealNotWonConfirmVeto(): void {
    RegisterOrderConfirmVeto(new DealNotWonConfirmVeto());
}
