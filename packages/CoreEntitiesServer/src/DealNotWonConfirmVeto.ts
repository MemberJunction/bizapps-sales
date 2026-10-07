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

/** A deal an order came from, as this check reads it. */
type OwningDeal = { DealID: string; DealNumber: string | null; DealStatusTypeID: string | null };

export class DealNotWonConfirmVeto implements OrderConfirmVeto {
    public async MayConfirm(context: OrderConfirmContext): Promise<string | null> {
        const owners = await this.owningDeals(context.OrderHeaderID, context.ContextUser);
        if (owners.length === 0) {
            return null;
        }
        /**
         * EVERY owning deal has to be Won, not just the first one read.
         *
         * `Deal.OrderID` carries no unique index, so two deals pointing at one order is a shape the
         * database permits — none do on the reporting host today, but "none today" is not a rule.
         * Reading one row and deciding from it made the verdict depend on which row came back
         * first, and a view with no ORDER BY does not promise that twice running. Same data,
         * different answer, is the worst kind of bug to be handed.
         *
         * Refusing while ANY of them is open is also the honest reading of the rule: a booked order
         * settles the ledger for every deal that minted it, and one of those still being open is
         * exactly the harm (golive#323). A deal with no status at all cannot be Won either — that
         * is a state nobody can read, and booking against it would be a decision made by absence.
         */
        const won = await this.wonStatusIDs(
            [...new Set(owners.map((o) => o.DealStatusTypeID).filter((id): id is string => !!id))],
            context.ContextUser,
        );
        const open = owners
            .filter((o) => !o.DealStatusTypeID || !won.has(o.DealStatusTypeID))
            .map((o) => o.DealNumber?.trim() || o.DealID);
        if (open.length === 0) {
            return null;
        }
        const named = open.length === 1 ? `Deal ${open[0]} is` : `Deals ${open.join(', ')} are`;
        return (
            `${named} not Won, so this order cannot be confirmed yet. Close the deal as Won ` +
            'first — confirming now would book an order against a deal that is still open.'
        );
    }

    /**
     * Every deal pointing at this order. `Deal.OrderID` is the only link between the two.
     *
     * Ordered by `ID` so a host that somehow holds two reads them the same way twice, and so a
     * refusal names them in a stable order rather than whatever the view happened to return.
     */
    private async owningDeals(orderID: string, user: UserInfo | null): Promise<OwningDeal[]> {
        const result = await new RunView().RunView<{ ID: string; DealNumber: string | null; DealStatusTypeID: string | null }>(
            {
                EntityName: DEAL_ENTITY,
                ExtraFilter: `OrderID = '${SafeID(orderID)}'`,
                Fields: ['ID', 'DealNumber', 'DealStatusTypeID'],
                OrderBy: 'ID',
                ResultType: 'simple',
            },
            user ?? undefined,
        );
        if (!result.Success) {
            throw new Error(`the deal behind this order could not be read: ${result.ErrorMessage ?? 'unknown error'}`);
        }
        return (result.Results ?? []).map((row) => ({
            DealID: row.ID,
            DealNumber: row.DealNumber ?? null,
            DealStatusTypeID: row.DealStatusTypeID ?? null,
        }));
    }

    /**
     * Which of these statuses are winning ones, read in ONE view rather than one per deal.
     *
     * MJ's UI guide says to batch reads rather than issue them in a loop, and this sits in the
     * critical section of every confirm: a query per owning deal would put the round trips on the
     * save path for no gain, since one `IN` answers them together. Two reads now, whatever the
     * number of owners.
     *
     * A read that fails THROWS rather than defaulting either way. Defaulting to "won" would confirm
     * on an unreadable deal; defaulting to "not won" would refuse every confirm on this host the
     * moment the view broke. The caller turns the throw into a refusal that names the fault, which
     * is both safe and diagnosable.
     *
     * A status id with no row back is simply absent from the set, which reads as not-won — as
     * unanswerable as a missing id, and not a win.
     */
    private async wonStatusIDs(statusIDs: string[], user: UserInfo | null): Promise<Set<string>> {
        if (statusIDs.length === 0) {
            return new Set();
        }
        const list = statusIDs.map((id) => `'${SafeID(id)}'`).join(', ');
        const result = await new RunView().RunView<{ ID: string; IsWon: boolean }>(
            {
                EntityName: DEAL_STATUS_ENTITY,
                ExtraFilter: `ID IN (${list})`,
                Fields: ['ID', 'IsWon'],
                ResultType: 'simple',
            },
            user ?? undefined,
        );
        if (!result.Success) {
            throw new Error(`the deal's status could not be read: ${result.ErrorMessage ?? 'unknown error'}`);
        }
        return new Set((result.Results ?? []).filter((row) => row.IsWon === true).map((row) => row.ID));
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
