/**
 * @fileoverview The typed seams sales calls when a deal closes — and the honest state of each.
 *
 * WHY THIS FILE EXISTS RATHER THAN DIRECT CALLS. `Sales.CloseDeal` routes a won deal to a contract
 * and/or an order, but **neither downstream is callable today**:
 *
 *   · `Contracts.CreateFromDeal` and `Contracts.RenewTerm` DO NOT EXIST — contracts ships neither
 *     operation. The shapes below are what §7 and contracts' plans say sales should expect.
 *   · `Orders.CreateOrderInState` DOES exist (`origin/mjdev/orders-flow`), and the input shape below
 *     is transcribed from its real `orders-create-order-in-state.input.ts` — but orders is not built
 *     as a peer, its C0 seam (`Subscription.BillingMode`) is still missing, and, decisively, its
 *     `OrderLineInput.ProductID` is REQUIRED while every `DealLine.ProductID` we hold is NULL.
 *
 * So the close flow is built against these interfaces and the calls are stubbed. That is a deliberate
 * decision (CLOSE-FLOW-DECISIONS.md D-CF3/D-CF4), and it is what makes connecting them later a
 * DELETION rather than a redesign: the operation already speaks the right contract.
 *
 * ── THE RULE THIS FILE PROTECTS ─────────────────────────────────────────────────────────────────
 *
 * Sales passes INTENT — product, quantity, requested discount, term. Orders computes the money. There
 * is no price, no total and no tax anywhere in these shapes on the way out, and nothing in sales may
 * add one.
 *
 * @module @mj-biz-apps/sales-entities
 */

/* ────────────────────────────────────────────────────────────────────────────
 * ORDERS — transcribed from bizapps-orders @ origin/mjdev/orders-flow
 * metadata/remote-operations/types/orders-create-order-in-state.input.ts
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * One line as ORDERS requires it.
 *
 * ⚠️ `ProductID` IS REQUIRED BY ORDERS, and this is the single hardest blocker on the D2C path: sales'
 * `DealLine.ProductID` is a nullable soft reference to the orders catalog, and it is NULL in every row
 * we have — the workspace captures `ProductName` as transcription precisely because that catalog is
 * not installed. A deal therefore cannot currently produce a valid order line, and that is a DATA
 * problem (populate `DealLine.ProductID` from a real catalog), not a build problem.
 */
export interface OrdersOrderLineSeamInput {
    ClientKey?: string;
    ProductID: string;
    Quantity: number;
    /** An INPUT to the pricing engine, never a replacement for it. Omitted entirely when unset. */
    UnitPrice?: number;
    DiscountPct?: number;
    ServicePeriodStart?: string | null;
    ServicePeriodEnd?: string | null;
    Description?: string | null;
}

/** The order header sales can state. Everything financial is absent by design. */
export interface OrdersOrderHeaderSeamInput {
    CompanyID: string;
    /** The buying organization — sales' `Deal.AccountID` is an IsA child of common's Organization. */
    OrganizationID?: string | null;
    PersonID?: string | null;
    CurrencyID?: string | null;
    Description?: string | null;
}

export interface OrdersOrderDraftSeamInput {
    Header: OrdersOrderHeaderSeamInput;
    Lines: OrdersOrderLineSeamInput[];
}

/** Mirrors `OrdersCreateOrderInStateInput`. `TargetStatus` carries the policy's `OrderState`. */
export interface OrdersCreateOrderInStateSeamInput {
    Draft: OrdersOrderDraftSeamInput;
    /** `Draft` | `Confirmed` — supplied by `CloseWonPolicy.OrderState`. */
    TargetStatus: string;
    OrderDate?: string | null;
    Reason?: string | null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * CONTRACTS — the interface sales expects; the operation does not exist yet
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * What sales hands contracts when a won deal needs an agreement.
 *
 * Shaped from §7.2 and contracts' plans. The two properties that matter for review:
 *
 *   · the contract is created **Pending** and NOTHING fires until Pending → Approved, so a close
 *     cannot accidentally start billing;
 *   · it carries the deal's negotiated red-lines (`ContractVariances`) so the human legal review has
 *     the context the AD typed, rather than a contract that silently drops it.
 */
export interface ContractsCreateFromDealSeamInput {
    DealID: string;
    CompanyID: string;
    /** A CODE, resolved by contracts. Sales does not know contract types. */
    ContractTypeCode?: string | null;
    TermMonths?: number | null;
    /** The AD's red-line summary, verbatim. Input to a human review; nothing parses it. */
    ContractVariances?: string | null;
    AutoRenew?: boolean;
    AnnualIncreasePctOverride?: number | null;
    CancellationNoticeDaysOverride?: number | null;
    ExecutionDate?: string | null;
    StartDate?: string | null;
    /** Recurring lines, when the policy routes them to the contract. */
    Lines?: OrdersOrderLineSeamInput[];
}

/** Renewal path: used INSTEAD of CreateFromDeal when `DealType.RequiresRenewalSource` is set (§7.2). */
export interface ContractsRenewTermSeamInput {
    /** The contract being renewed — sales' `Deal.RenewsContractID`. */
    ContractID: string;
    DealID: string;
    TermMonths?: number | null;
}

/** What either contracts call returns. */
export interface ContractsSeamResult {
    Success: boolean;
    ContractID?: string | null;
    /** Expected to be the contract's Pending status on creation. */
    Status?: string | null;
    Message?: string | null;
}

/** What the orders call returns. */
export interface OrdersSeamResult {
    Success: boolean;
    OrderID?: string | null;
    Status?: string | null;
    Message?: string | null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * The seam interface the close operation depends on
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * The downstream calls, behind one interface.
 *
 * `CloseDealOperation` depends on THIS, not on the sibling apps, which is what lets the close flow be
 * written, built and tested tonight while both downstreams are unavailable — and lets a real
 * implementation be registered later without the operation changing at all.
 */
export interface IDownstreamSeam {
    /** True when this implementation actually reaches the sibling app. */
    readonly IsLive: boolean;
    CreateOrderInState(input: OrdersCreateOrderInStateSeamInput): Promise<OrdersSeamResult>;
    CreateContractFromDeal(input: ContractsCreateFromDealSeamInput): Promise<ContractsSeamResult>;
    RenewContractTerm(input: ContractsRenewTermSeamInput): Promise<ContractsSeamResult>;
}

/**
 * The stub. Records what WOULD have been sent and refuses to pretend it happened.
 *
 * Every method returns `Success: false` with a reason naming the real blocker — never a fake success
 * and never a fabricated ID. A close using this stub still commits and still records its routing
 * intent (D-CF1), but `SalesCloseRoutingResult.Executed` comes back **false**, so no report, test or
 * UI can mistake a planned contract for a created one.
 */
export class StubDownstreamSeam implements IDownstreamSeam {
    public readonly IsLive = false;

    /** Everything the close flow tried to send, in call order — for the run report and for tests. */
    public readonly Attempts: Array<{ Target: string; Payload: unknown }> = [];

    public async CreateOrderInState(input: OrdersCreateOrderInStateSeamInput): Promise<OrdersSeamResult> {
        this.Attempts.push({ Target: 'Order', Payload: input });
        return {
            Success: false,
            Message:
                'Orders.CreateOrderInState is not wired: bizapps-orders is not built as a peer, its ' +
                'Subscription.BillingMode (C0) seam is missing, and OrderLineInput.ProductID is required ' +
                'while DealLine.ProductID is null on every line. See CLOSE-FLOW-DECISIONS.md D-CF3.',
        };
    }

    public async CreateContractFromDeal(input: ContractsCreateFromDealSeamInput): Promise<ContractsSeamResult> {
        this.Attempts.push({ Target: 'Contract', Payload: input });
        return {
            Success: false,
            Message:
                'Contracts.CreateFromDeal does not exist yet — contracts ships no such operation. ' +
                'See CLOSE-FLOW-DECISIONS.md D-CF4.',
        };
    }

    public async RenewContractTerm(input: ContractsRenewTermSeamInput): Promise<ContractsSeamResult> {
        this.Attempts.push({ Target: 'ContractRenewal', Payload: input });
        return {
            Success: false,
            Message: 'Contracts.RenewTerm does not exist yet. See CLOSE-FLOW-DECISIONS.md D-CF4.',
        };
    }
}
