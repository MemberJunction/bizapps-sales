/**
 * ============================================================================
 * WHY THE SHARED CLOSE SHAPES LIVE IN THIS FILE
 * ============================================================================
 * CodeGen emits each operation's `InputTypeDefinition` / `OutputTypeDefinition`
 * **verbatim** into one `remote_operations.ts`, de-duplicating by exact text and
 * resolving NO imports. A definition file cannot `import` a sibling — every name
 * it uses must be declared in some definition that also gets emitted.
 *
 * `CloseDeal` carries the policy and routing shapes, so they are declared once
 * here. `ReopenDeal` references them freely: TypeScript hoists interfaces, so
 * emission order does not matter.
 *
 * NO `import` statements in this file. Ever.
 * ============================================================================
 */

/**
 * `Pipeline.CloseWonPolicy`, parsed — master plan §7.1.
 *
 * THE POLICY IS THE ONLY THING THAT DECIDES ROUTING. Nothing in the close flow
 * may branch on a pipeline's name, a status's name, or the words "B2B"/"D2C":
 * a deployment renames those freely, and a rename must not change what happens
 * when a deal is won. Behaviour comes from this JSON plus the `DealStatusType`
 * flags, and from nowhere else.
 *
 * Every field is optional because a pipeline may declare a partial policy; the
 * resolver supplies defaults and the effective policy is what gets recorded.
 */
export interface SalesCloseWonPolicy {
    /** Create an agreement for this deal. Routes to Contracts.CreateFromDeal (or RenewTerm). */
    CreateContract?: boolean;
    /** Which contract type the agreement takes. A CODE, resolved by contracts, not by sales. */
    ContractTypeCode?: string | null;
    /** Default term for the created agreement. */
    TermMonths?: number | null;
    /** Where recurring lines go. `Contract` | `Subscription` | `None`. */
    SubscriptionLinesTo?: string | null;
    /** Where one-time lines go. `Order` | `Contract` | `None`. */
    OneTimeLinesTo?: string | null;
    /** The state a created order lands in. `Draft` | `Confirmed`. */
    OrderState?: string | null;
    /** When set, the close raises an approval task of this type rather than completing. */
    RequireApprovalTaskTypeCode?: string | null;
}

/**
 * What the caller asks for.
 *
 * NAMED FOR THE OUTCOME TYPE, NOT FOR "WON". The operation resolves everything from the target
 * status's flags (`IsWon` / `IsLost` / `LocksDeal`), so a deployment that calls its winning status
 * "Signed" needs no code change — master plan §7.2.
 */
export interface SalesCloseDealInput {
    DealID: string;
    /** The status to close INTO. Its flags decide the whole path. */
    DealStatusTypeID: string;

    /**
     * Required when the target status has `IsLost`. Loss reason is this app's only mandatory field,
     * and the friction is deliberate: it is the highest-value, most consistently-skipped data in any
     * CRM (§7.2).
     */
    LossReasonID?: string | null;
    /** Required when the chosen loss reason has `RequiresNotes`. */
    LossNotes?: string | null;

    /**
     * Per-deal overrides merged OVER the pipeline's policy. This is how §7.1's "a deal may override
     * it" is expressed without a per-deal policy column — see CLOSE-FLOW-DECISIONS.md D-CF6.
     */
    PolicyOverrides?: SalesCloseWonPolicy;

    /** The stage to land in. Optional: when omitted the operation keeps the deal's current stage. */
    ClosingStageID?: string | null;

    /** Recorded on the DealStageEvent. Free text, for the human record. */
    Notes?: string | null;

    /**
     * Validate and report what WOULD happen without writing anything. Nothing is committed, no lock
     * is applied, and the routing plan comes back in the output — so a UI can show the consequences
     * of a close before asking for confirmation.
     */
    PreviewOnly?: boolean;
}

/** What the caller asks for when undoing a close — §7.3. */
export interface SalesReopenDealInput {
    DealID: string;
    /**
     * REQUIRED. §7.3 makes reopening reason-gated on purpose: a lock exists because the deal is the
     * provenance of a contract and an order, so undoing it is an event that has to be explainable.
     */
    Reason: string;
    /** The status to reopen INTO. Must be a status whose `LocksDeal` is not set. */
    DealStatusTypeID?: string | null;
    /** The stage to return to. Defaults to the deal's current stage. */
    StageID?: string | null;
}
