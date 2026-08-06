/**
 * ============================================================================
 * WHY THE SHARED SHAPES LIVE IN THIS FILE
 * ============================================================================
 * CodeGen emits each operation's `InputTypeDefinition` / `OutputTypeDefinition`
 * **verbatim** into one `remote_operations.ts`, de-duplicating by exact text and
 * resolving NO imports. So a definition file cannot `import` a sibling — every
 * name it uses must be declared in some definition that also gets emitted.
 *
 * `SaveDeal` takes the whole draft, so the deal family's shared shapes are
 * declared once, here, in the definition of the operation that is their natural
 * home. TypeScript hoists interfaces, so later operations can reference these
 * names freely regardless of emission order.
 *
 * NO `import` statements in this file. Ever. They would be emitted verbatim and
 * break the generated module.
 * ============================================================================
 *
 * WHAT THIS OPERATION IS FOR. A browser holds the GENERATED `DealEntity`, not
 * `DealEntityServer`, so `.Lines` does not exist client-side and transient child
 * collections have no way to cross the entity-save boundary as scalar fields. The
 * only alternative is saving the deal, then each line, then each schedule row as
 * separate round trips — and a failure partway leaves a numbered deal with nothing
 * under it. bizapps-orders and bizapps-contracts both hit this and both answered it
 * this way; this is that pattern applied to a deal.
 */

/**
 * A deal line as the CLIENT states it. Everything the pricing engine derives is
 * absent by design — `ResolvedUnitPrice`, `ResolvedExtendedAmount`,
 * `PriceComponentsJSON` and `PricedAt` are write-only from an Orders.PreviewOrder
 * response and are not accepted here at any point.
 */
export interface SalesDealLineInput {
    /**
     * Client-side identity so a result row can be matched back to the form row that
     * produced it. NOT persisted, and not the record ID.
     */
    ClientKey?: string;
    /** Present = update that line. Absent = insert a new one. */
    ID?: string | null;
    /**
     * SOFT reference to the bizapps-orders catalog, which is not installed yet.
     * Optional for exactly that reason.
     */
    ProductID?: string | null;
    /** The product/service name as written on the signed document. See the column note. */
    ProductName?: string | null;
    /** FK to DealLineType. Branch on that row's IsRecurring, never on its name. */
    DealLineTypeID?: string | null;
    Quantity: number;
    /** A percentage, 0-100. An INPUT to the pricing engine. */
    RequestedDiscountPct?: number | null;
    /** A negotiated unit price. An INPUT to the engine, never a replacement for it. */
    OverrideUnitPrice?: number | null;

    /**
     * THE SIGNED FIGURES — transcribed from the executed document, never derived.
     * The server stores these three exactly as sent. It does NOT compute Total from
     * the other two, does not validate that it equals their difference, and does not
     * back-fill any of them: the subtraction on the PDF is the customer's and the
     * AD's, not this app's.
     */
    AnnualGrossFees?: number | null;
    DiscountAmount?: number | null;
    Total?: number | null;

    TermMonths?: number | null;
    /** ISO date strings (YYYY-MM-DD). Everything persisted is UTC. */
    ServicePeriodStart?: string | null;
    ServicePeriodEnd?: string | null;
    Description?: string | null;
    /**
     * Optional. The server RE-SEQUENCES from array order on every save, exactly as
     * accounting re-sequences JournalEntryLine.LineNumber, so array position is the
     * truth and sending this is never required.
     */
    DisplayOrder?: number;
}

/**
 * One instalment of a negotiated payment schedule. Sending NO rows is the normal
 * case and means standard terms — 100% on execution. Rows exist only where the
 * customer negotiated something else.
 */
export interface SalesDealPaymentScheduleInput {
    ClientKey?: string;
    /** Present = update. Absent = insert. */
    ID?: string | null;
    /** ISO date string (YYYY-MM-DD). May be null for a milestone with no fixed date. */
    PaymentDate?: string | null;
    /**
     * Unconstrained in sign — a refund or credit instalment is legitimately negative.
     * The server does NOT check that instalments sum to the deal amount: that is
     * computing money, and the authoritative total lives in orders, not here.
     */
    Amount?: number | null;
    Description?: string | null;
    /** Optional; re-sequenced from array order on save. */
    DisplayOrder?: number;
}

/**
 * The whole deal draft, as one payload. Create and update are the SAME operation:
 * omit `ID` to create, send it to update. That is deliberate — a deal being created
 * is just a draft whose ID is null, and two separate operations would drift.
 */
export interface SalesSaveDealInput {
    /** Absent = create a new deal. Present = update that deal. */
    ID?: string | null;

    Name: string;
    PipelineID: string;
    PipelineStageID?: string | null;
    DealTypeID?: string | null;
    DealStatusTypeID?: string | null;

    AccountID?: string | null;
    PrimaryContactID?: string | null;
    /** NULL means "same as the primary contact" — a real default, not "unknown". */
    BillingContactID?: string | null;

    /**
     * The SELLING company. Optional: when omitted the server takes it from the
     * pipeline, which is the only value that can be correct — Deal.CompanyID must
     * match Pipeline.CompanyID and the server enforces that either way.
     */
    CompanyID?: string | null;

    /**
     * INTENT, not the stamp. `Deal.OwnerEmployeeID` is a server-maintained
     * denormalized column and must never be hand-set; DealTeamMember is the source
     * of truth for who is on a deal, including the owner. Sending this asks the
     * server to materialize a DealTeamMember row under the role where
     * DealRole.IsOwnerRole = 1, and to stamp the denormalized column itself.
     */
    OwnerEmployeeID?: string | null;

    /**
     * Only meaningful for a SIMPLE (header-only) deal, where a human states the value
     * and `AmountIsComputed` stays 0. For a deal carrying lines, the amount is a
     * cached answer from Orders.PreviewOrder and this app never computes it — so
     * sending an amount alongside lines does not make it authoritative, and the
     * provenance columns will say so.
     */
    Amount?: number | null;
    CurrencyID?: string | null;

    /** A subscription COMMITMENT in months. Distinct from the SOW estimate below. */
    TermMonths?: number | null;
    /** A project FORECAST in weeks, from the SOW template. Drives no renewal date. */
    EstimatedProjectWeeks?: number | null;

    /** ISO date strings. Deliberately not ordered against each other. */
    ExecutionDate?: string | null;
    StartDate?: string | null;
    ExpectedCloseDate?: string | null;

    Probability?: number | null;
    ForecastCategoryTypeID?: string | null;
    LeadSourceTypeID?: string | null;

    /**
     * Negotiated contract terms. The two *Override fields are nullable BY DESIGN:
     * null means "use the standard term", whose default lives on the contracts
     * ContractType (5% / 90 days), not here. Sending the standard value explicitly
     * is a different statement and will be stored as one.
     */
    AutoRenew?: boolean;
    AnnualIncreasePctOverride?: number | null;
    CancellationNoticeDaysOverride?: number | null;
    /** A LABEL, defaulting to ACH. No code branches on it. See the column note. */
    PaymentMethod?: string | null;
    /** Free-text red-line summary. The input to a human legal review. */
    ContractVariances?: string | null;

    Description?: string | null;
    NextStep?: string | null;
    NextStepDate?: string | null;

    /**
     * THE COMPLETE DESIRED SET of lines, not a delta — any existing line whose ID is
     * absent from this array is DELETED.
     *
     * UNDEFINED AND EMPTY MEAN DIFFERENT THINGS, and the distinction is load-bearing:
     * omitting the property entirely leaves existing lines untouched (so a header-only
     * save cannot wipe them by accident), while sending `[]` explicitly removes every
     * line. A form that always sends its current state gets the right behaviour for
     * free; a form that patches one header field must omit the property.
     */
    Lines?: SalesDealLineInput[];

    /** Same complete-set / undefined-vs-empty semantics as `Lines`. */
    PaymentSchedule?: SalesDealPaymentScheduleInput[];
}
