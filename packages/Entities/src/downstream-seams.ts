/**
 * @fileoverview The typed seams sales calls when a deal closes — and the honest state of each.
 *
 * WHY THIS FILE EXISTS RATHER THAN DIRECT CALLS. `Sales.CloseDeal` routes a won deal to a contract
 * and/or an order, and it must work whether or not those apps are installed. The seam is the boundary
 * that makes both true: one interface, a LIVE implementation per downstream, and a stub for a
 * deployment that has neither.
 *
 * BOTH DOWNSTREAMS ARE LIVE NOW, and this header used to say the opposite:
 *
 *   · ORDERS — `LiveOrdersSeam` creates the order through orders' own ENTITY GRAPH
 *     (`OrderEntityServer.Save()`), because orders ships no create-order operation on `next`;
 *     `Orders.CreateOrderInState` was on a branch that never merged. Money comes back from
 *     `Orders.PriceOrder`.
 *   · CONTRACTS — `LiveContractsSeam` calls `Contracts.SaveContract` and `Contracts.RenewTerm`. Both
 *     operations EXIST. Earlier revisions of this file said they did not, and the stub still said so
 *     long after it stopped being true; a message that misstates why a route did not fire sends the
 *     reader to fix the wrong thing.
 *
 * SO WHAT THE STUB MEANS NOW is narrower and it is the only thing it should claim: the sibling app is
 * **not installed in this deployment**. Not missing, not unbuilt — absent from this host. Every stub
 * method returns `Success: false` with that reason and fabricates nothing, so a close still commits and
 * still records its routing intent while `Executed` comes back false.
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
 * ORDERS — the shape `LiveOrdersSeam` sends into orders' entity graph
 * ──────────────────────────────────────────────────────────────────────────── */

/** The order header sales can state. Everything financial is absent by design. */

export interface OrdersOrderHeaderSeamInput {
    CompanyID: string;
    /** The buying organization — sales' `Deal.AccountID` is an IsA child of common's Organization. */
    OrganizationID?: string | null;
    PersonID?: string | null;
    CurrencyID?: string | null;
    Description?: string | null;
}


/* ────────────────────────────────────────────────────────────────────────────
 * CONTRACTS — the interface sales expects; served by `Contracts.SaveContract` when installed
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * What sales hands contracts when a won deal needs an agreement.
 *
 * Shaped from §7.2 and contracts' plans. The two properties that matter for review:
 *
 *   · the contract is created **Draft** and NOTHING fires from it, so a close cannot accidentally
 *     start billing. `Draft`, not `Pending`: §7.2 asks for a status that fires nothing, and `Pending`
 *     is a TERM status which violates `CK_Contract_Status` on the contract itself. Pinned by CT3;
 *     earlier revisions of this comment said Pending and were wrong about contracts, not about intent;
 *   · it carries the deal's negotiated red-lines (`ContractVariances`) so the human legal review has
 *     the context the AD typed, rather than a contract that silently drops it.
 */
export interface ContractsCreateFromDealSeamInput {
    DealID: string;
    CompanyID: string;
    /**
     * Which contract type to create, resolved by contracts. Sales does not know contract types and
     * must not bake their UUIDs, which is why this is a string and not an ID.
     *
     * -- THE NAME SAYS `Code`, AND TODAY IT IS MATCHED ON `Name`. READ THIS BEFORE RENAMING IT. --
     *
     * `ContractType` has no `Code` column as of contracts `origin/next` @ d2f64e3; it is identified by
     * `Name` (unique) plus a fixed seeded UUID. So `LiveContractsSeam` probes the metadata and matches
     * on whichever identifier contracts actually offers, and says which one it used in the message it
     * returns -- the answer is never ambiguous at the call site.
     *
     * The name is therefore aspirational rather than wrong: a `Code` is what this SHOULD carry, it is
     * what the seam already prefers the moment the column appears, and asking for that column is an
     * open request to contracts (D-12) for exactly the reason bizapps-tasks added `TaskType.Code` --
     * a display name that can be renamed is not an identifier.
     *
     * Renaming this key is a bigger change than it looks: it is part of the published
     * `Sales.CloseDeal` remote-operation contract and appears in generated code. Not worth doing to
     * describe a state that is meant to be temporary.
     *
     * WHATEVER VALUE GOES HERE MUST NAME A TYPE THAT STANDS ALONE. A type whose
     * `ParentStatusRequirement` is `'Required'` -- Change Order -- is refused by contracts' own
     * validation when nothing names its parent, and a close-won has no parent contract to give it.
     */
    ContractTypeCode?: string | null;
    TermMonths?: number | null;
    /** The AD's red-line summary, verbatim. Input to a human review; nothing parses it. */
    ContractVariances?: string | null;
    /**
     * Did this deal move off the standard agreement? Becomes the contract's `HasModifications`.
     *
     * A SEPARATE FACT FROM `ContractVariances`, not a summary of it. The variances field being empty
     * means nothing was written down, which is not the same claim as nothing having been negotiated —
     * and contracts' review task branches on the difference: a true flag means capture each deviation
     * as a `ContractTemplateModification`, a false one still means read the document, because the rep
     * may have forgotten to raise it. Deriving one from the other would hand finance a guess.
     */
    StandardAgreementModified?: boolean;
    AutoRenew?: boolean;
    AnnualIncreasePctOverride?: number | null;
    CancellationNoticeDaysOverride?: number | null;
    ExecutionDate?: string | null;
    StartDate?: string | null;
    /**
     * The buying party. `AccountID` is sales' `Deal.AccountID`, an IsA child of common's Organization,
     * which is what contracts stores as `CustomerOrganizationID`.
     */
    AccountID?: string | null;
    PrimaryContactID?: string | null;
    /** How the term bills. A CODE contracts understands; sales does not invent billing schedules. */
    BillingFrequency?: string | null;
    /**
     * What the customer COMMITS to spend over the term — a negotiated undertaking, not a price.
     * Contracts requires it and treats zero as a valid answer meaning "no minimum". Sales never
     * computes it; it is only ever passed through when a deal actually negotiated one.
     */
    CommittedAmount?: number | null;
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
    /** The contract's status on creation — `Draft`, the status that fires nothing. See above. */
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
    /**
     * THE ORDER METHODS ARE GONE. `PreviewOrderMoney` and `CreateOrder` described a route close-won no
     * longer takes: the order is embedded on the deal from creation, so there is nothing to create and
     * nothing to price at close. They were exported, typechecked and documented, and called by nobody.
     *
     * `readonly IsLive: boolean` went with them. Nothing read it. Note that `IActivitySource.IsLive`
     * and `IForecastSource.IsLive` are DIFFERENT flags on different interfaces and are load-bearing —
     * the ingest refuses to write `Source: 'Integration'` from a fixture source — so do not read this
     * removal as a verdict on those.
     *
     * RENEWAL STAYS. `RenewContractTerm` currently reports an unexecuted plan, because the contracts
     * rebuild removed `ContractTerm` and `Contracts.RenewTerm` with it. It is kept rather than pruned
     * because a renewal User Story is coming and the route is the shape it will land in.
     */
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
    /** Everything the close flow tried to send, in call order — for the run report and for tests. */
    public readonly Attempts: Array<{ Target: string; Payload: unknown }> = [];

    public async CreateContractFromDeal(input: ContractsCreateFromDealSeamInput): Promise<ContractsSeamResult> {
        this.Attempts.push({ Target: 'Contract', Payload: input });
        return {
            Success: false,
            Message:
                'The contract route was planned but not executed: bizapps-contracts is not installed in ' +
                'this deployment, so its entities cannot be resolved.',
        };
    }

    public async RenewContractTerm(input: ContractsRenewTermSeamInput): Promise<ContractsSeamResult> {
        this.Attempts.push({ Target: 'ContractRenewal', Payload: input });
        return {
            Success: false,
            Message:
                'The renewal route was planned but not executed: bizapps-contracts is not installed in ' +
                'this deployment, so its entities cannot be resolved.',
        };
    }
}

/* ────────────────────────────────────────────────────────────────────────────
 * `OrdersOrderHandoffInput` and `OrdersOrderLineSeamInput` USED TO BE HERE.
 *
 * They described the payload for creating an order from a won deal. That route is gone: the order is
 * embedded on the deal from creation, so `LiveOrdersSeam.CreateOrder` and `PreviewOrderMoney` were
 * deleted and nothing constructs these any more. The last thing keeping them alive was a type-only
 * import in `CloseDealOperation.ts`, which is removed in the same commit as this.
 *
 * ⚠ IF ANYTHING LIKE THEM COMES BACK, `DiscountPct` NEEDS UNITS IN ITS NAME OR ITS TYPE. These carried a
 * bare `DiscountPct?: number` while orders stores a FRACTION and the caller sent a rep-entered
 * PERCENTAGE. The two methods that passed it straight through would have recorded a 50% discount for a
 * half-percent one — under 1% it slipped past `CK_OrderLine_DiscountPct` and saved cleanly.
 * `scripts/assert-discount-conversion.mjs` is what a revival has to satisfy.
 * ──────────────────────────────────────────────────────────────────────────── */
