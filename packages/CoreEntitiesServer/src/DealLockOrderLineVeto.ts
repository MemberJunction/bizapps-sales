/**
 * @fileoverview Sales' answer to Orders' question: may this order line be edited?
 *
 * ── WHAT THIS IS ────────────────────────────────────────────────────────────────────────────────
 *
 * golive#206 item 1. A deal that has closed is locked, because a contract was derived from its terms
 * and the order's lines are exactly what that contract was derived from. Editing one after the close
 * falsifies the same provenance the deal lock protects.
 *
 * Orders cannot know that. It does not depend on Sales, and Sales depends on IT — so Orders asks, via
 * `RegisterOrderLineEditVeto`, and this is the app with the stake answering. Without something
 * registered, `orders-entities` refuses nothing: the seam is inert on any host that does not run
 * Sales, and it was inert on every host until this landed.
 *
 * ── BY FLAG, NEVER BY NAME ──────────────────────────────────────────────────────────────────────
 *
 * The lock is `DealStatusType.LocksDeal`, the same flag the board, the form and `DealEntityServer`
 * all read. Not the status NAME: "Won" and "Lost" and "Abandoned" all lock, a deployment may add
 * another, and a rule that matched names would quietly stop covering it. `vwDeals` exposes
 * `DealStatusType` as a string and it is deliberately not used here.
 *
 * ── NOTHING IS CACHED, AND THE COST IS TWO READS PER LINE ───────────────────────────────────────
 *
 * Orders asks ONCE PER LINE, so a fifty-line order graph save asks fifty times and this costs a
 * hundred round trips. That is worth knowing and it is not worth fixing with a memo.
 *
 * `RegisterOrderLineEditVeto` holds ONE instance for the life of the process, so a memo of the
 * verdict outlives the truth: a deal reopened a moment ago would keep refusing, and — the dangerous
 * direction — a deal just closed would keep allowing. A first version of this file memoed only the
 * order-to-deal mapping, which cannot go stale that way. It also saved nothing: the deal row still has
 * to be re-read for its CURRENT status, so both reads happened anyway. The test asserting the cost is
 * what caught that.
 *
 * The one read that would help is a single query joining the deal to its status flag, and expressing
 * it through `RunView` means naming the schema in a subquery. That works, and it couples this file to
 * `__mj_BizAppsSales` for a 2x saving nobody has reported needing. If the cost ever bites, the fix
 * belongs in the seam — asking once per SAVE rather than once per line — not in a cache here that has to
 * be right about when a deal changed.
 *
 * ── FAILING TO ANSWER IS A REFUSAL, AND THAT IS THE SEAM'S RULE, NOT OURS ───────────────────────
 *
 * `ResolveOrderLineEditRefusal` turns a thrown vetoer into a refusal naming the fault. That is why
 * this throws rather than returning null when a read fails: a lookup that could not run has not said
 * the deal is open, and treating "could not tell" as "go ahead" is how a frozen record gets edited.
 * It is the same trade `DealEntityServer.readStatusLockFlags` already makes for the close lock.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { LogError, RunView, type UserInfo } from '@memberjunction/core';
import {
    RegisterOrderLineEditVeto,
    type OrderLineEditContext,
    type OrderLineEditKind,
    type OrderLineEditVeto,
} from '@mj-biz-apps/orders-entities';

const DEAL_ENTITY = 'MJ_BizApps_Sales: Deals';
const DEAL_STATUS_ENTITY = 'MJ_BizApps_Sales: Deal Status Types';

/**
 * The refusal, in the words golive#207 settled for the rest of the lock.
 *
 * Tailored per gesture because the seam passes the kind, and "set the status back to Open before
 * adding a product" is the instruction a rep can act on; a bare "not permitted" sends them hunting
 * through Orders for a rule that lives in Sales. The first sentence matches the deal form's field
 * refusal and the workspace's Add hint word for word, so a rep meets one voice across three screens.
 */
export function DealLockRefusal(kind: OrderLineEditKind): string {
    const action =
        kind === 'create' ? 'adding a product'
        : kind === 'delete' ? 'removing a product'
        : 'changing what was sold';
    return `This deal is closed. Set the status back to Open before ${action}.`;
}

/** What one lookup of the owning deal found. `null` means no deal owns this order. */
type OwningDeal = { DealID: string; DealStatusTypeID: string | null } | null;

export class DealLockOrderLineVeto implements OrderLineEditVeto {
    public async MayEdit(context: OrderLineEditContext): Promise<string | null> {
        const owner = await this.owningDeal(context.OrderHeaderID, context.ContextUser);
        if (!owner || !owner.DealStatusTypeID) {
            // No deal owns this order, or it has no status. Orders' own rules still apply; Sales has
            // no claim on it, and saying so is not the same as approving anything.
            return null;
        }
        return (await this.statusLocks(owner.DealStatusTypeID, context.ContextUser))
            ? DealLockRefusal(context.Kind)
            : null;
    }

    /** Which deal owns this order, and what status it is in right now. */
    private async owningDeal(orderID: string, user: UserInfo | null): Promise<OwningDeal> {
        const result = await new RunView().RunView<{ ID: string; DealStatusTypeID: string | null }>(
            {
                EntityName: DEAL_ENTITY,
                ExtraFilter: `OrderID = '${SafeID(orderID)}'`,
                Fields: ['ID', 'DealStatusTypeID'],
                MaxRows: 1,
                ResultType: 'simple',
            },
            user ?? undefined,
        );
        if (!result.Success) {
            // Throwing is the seam's way of saying "could not tell"; the caller turns it into a
            // refusal that names the fault. Returning null here would allow the edit instead.
            LogError(`DealLockOrderLineVeto: could not read the deal for order ${orderID}: ${result.ErrorMessage}`);
            throw new Error(`the deal behind this order could not be read: ${result.ErrorMessage ?? 'unknown error'}`);
        }
        const row = (result.Results ?? [])[0];
        return row ? { DealID: row.ID, DealStatusTypeID: row.DealStatusTypeID ?? null } : null;
    }

    /**
     * Does this status close a deal? The FLAG, read fresh every time.
     *
     * A read that fails throws rather than defaulting. `DealEntityServer` defaults to `LocksDeal: true`
     * in the same situation, which is right THERE because it is deciding whether to refuse an edit it
     * already holds. Here the caller turns a throw into that same refusal AND names the fault, which
     * is strictly more useful than silently refusing with the ordinary lock message.
     */
    private async statusLocks(statusID: string, user: UserInfo | null): Promise<boolean> {
        const result = await new RunView().RunView<{ LocksDeal: boolean }>(
            {
                EntityName: DEAL_STATUS_ENTITY,
                ExtraFilter: `ID = '${SafeID(statusID)}'`,
                Fields: ['LocksDeal'],
                MaxRows: 1,
                ResultType: 'simple',
            },
            user ?? undefined,
        );
        if (!result.Success) {
            LogError(`DealLockOrderLineVeto: could not read status ${statusID}: ${result.ErrorMessage}`);
            throw new Error(`the deal's status could not be read: ${result.ErrorMessage ?? 'unknown error'}`);
        }
        const row = (result.Results ?? [])[0];
        // A status row that is absent is not a lock. The deal points at a status that does not exist,
        // which is a data fault for the close lock to report, not a reason to freeze someone's order.
        return row?.LocksDeal === true;
    }
}

/**
 * Ids reach this from Orders, so they are not ours to trust. A UUID has no quotes in it; anything
 * that does is not one, and it is not going into a filter string.
 */
function SafeID(id: string): string {
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
        throw new Error(`not a usable record id: ${JSON.stringify(id)}`);
    }
    return id;
}

/**
 * Register this host's answer. Called from `LoadBizAppsSalesServer` at MJAPI startup.
 *
 * It lives HERE rather than in `sales-server` because this is the package that declares
 * `@mj-biz-apps/orders-entities`. `sales-server` resolves that name transitively to whatever is
 * published, so a call from there compiles only by accident of hoisting — and not at all until orders
 * ships the version carrying the seam. Keeping the import in the package that owns the dependency is
 * what lets the version requirement be stated here at all, and it is now stated exactly: `5.14.0`,
 * pinned without a caret.
 *
 * THE EXACT PIN IS LOAD-BEARING. `hostVeto` is a module-scoped variable, so the registry is
 * per-COPY, not per-process. Resolving a different version here than the `orders-core-entities-server`
 * that reads it would put the registration in one copy and the lookup in another -- the veto would
 * refuse nothing, and every test in this package would still pass. Orders pins `orders-entities`
 * exactly in all of its own packages; matching that version is what keeps this to one copy.
 *
 * ── AND THAT MATCH IS NOT SELF-MAINTAINING, WHICH IS HOW IT BROKE ───────────────────────────────
 *
 * Orders' release rewrites its own internal pins on every version. This one lives in another repo,
 * so nothing moves it, and no repo's CI can see the drift: sales resolves one copy of whatever it
 * pins, orders is internally consistent, and both are green. The duplicate appears only in the host
 * app that installs BOTH, where npm cannot satisfy two exact pins from one copy and nests a second
 * `orders-entities` under this package.
 *
 * THE DAMAGE IS NOT LIMITED TO THE VETO. That nested copy re-runs every module-scope
 * `@RegisterClass` in `orders-entities`, including the generated `OrderHeaderEntity` for
 * `MJ_BizApps_Orders: Order Headers`. `ClassFactory` auto-increments priority, so the later
 * registration outranks `OrderEntityServer` -- and `OrderNumber`, which only that server subclass
 * mints, is never assigned. Every new order header then fails its NOT NULL insert: the Orders
 * screen, and every Deal that provisions an embedded order. It is silent, because the collision
 * warning compares class NAMES and both copies are `OrderHeaderEntity`.
 *
 * So when orders publishes a new version, this pin moves with it in the same pass.
 *
 * Last-call-wins in the registry, so a host that boots twice in one process ends up with one vetoer.
 */
export function LoadDealLockOrderLineVeto(): void {
    RegisterOrderLineEditVeto(new DealLockOrderLineVeto());
}
