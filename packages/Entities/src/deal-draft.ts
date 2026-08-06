/**
 * @fileoverview `DealDraft` — the client-side model of a deal being composed.
 *
 * WHY THIS EXISTS. `DealEntityServer` composes a whole deal — header, lines, payment schedule — and
 * writes it in one transaction. A browser cannot use any of that. The class the client holds is the
 * GENERATED `mjBizAppsSalesDealEntity`, not the server subclass, so `.Lines` does not exist there and
 * the transient children have no way to cross the entity-save boundary as scalar fields. The only
 * alternative is what a UI does when it has no other option: save the deal, then each line, then each
 * instalment, as separate round trips — and a failure partway leaves a numbered deal with nothing
 * under it.
 *
 * `DealDraft` is the other half of the answer: something the UI holds and mutates that knows how to
 * become the payload `Sales.SaveDeal` accepts, which the server then rehydrates into the real entity
 * tree. bizapps-orders solved this with `OrderDraft` and bizapps-contracts with `ContractDraft`; this
 * is that pattern applied to a deal.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ────────────────────────────────────────────────────────────
 *
 * IT DOES NOT PRICE ANYTHING, and it does not re-implement a single business rule. This app's first
 * rule is that sales never computes money: no multiplying quantity by price, no applying a discount
 * percentage, no summing lines into a header total, no rounding. That rule holds here too. In
 * particular `Total` is NOT derived from `AnnualGrossFees - DiscountAmount` — those three are figures
 * transcribed from a signed document, and the subtraction on the page belongs to the customer and the
 * account director, not to this class. `Validate()` does not check that they are consistent with each
 * other either, because doing so would be asserting the arithmetic by the back door.
 *
 * Likewise the close lock, owner-role uniqueness, company/pipeline agreement and deal numbering all
 * live in the entity subclasses on the server, on the one path every write takes. A second
 * implementation living next to the UI is the thing that eventually disagrees with the first, and the
 * disagreement surfaces as a deal the form said was fine and the server refused.
 *
 * What {@link DealDraft.Validate} checks is only what a form can honestly check without a database:
 * is a required field filled in, do these dates make sense against each other, does this line have a
 * product name. Everything it reports is a REQUIREMENT the user must satisfy before the server will
 * even look at the record — never a judgement about whether the deal is sound.
 *
 * ── FRAMEWORK-FREE ON PURPOSE ───────────────────────────────────────────────────────────────────
 *
 * No Angular, no DOM, no MJ provider. Three consequences that all matter: the create surface and the
 * edit surface can bind to the SAME instance rather than to copies that drift; the whole model is
 * unit-testable with no harness; and the validation shape below can be lifted into MJ core later
 * without dragging a UI framework behind it.
 *
 * @module @mj-biz-apps/sales-entities
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Validation — the shape the UI reads
 *
 * A STRUCTURED LIST, never a string. `Section` is what lets a tab show a badge;
 * `Field` is what lets the field itself show a marker; `Severity` separates
 * "you cannot save this" from "look at this". A joined error string can do none
 * of those, which is why every UI that starts with one ends up parsing it back
 * apart.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Which pane of the deal workspace an issue belongs to. Matches the tab keys EXACTLY. */
export type DealDraftSection = 'party' | 'lines' | 'schedule' | 'terms' | 'variances';

export type DealDraftSeverity = 'error' | 'warning';

/** One problem with the draft, addressed to the part of the UI that can fix it. */
export interface DealDraftIssue {
    Section: DealDraftSection;
    /** The offending field, where one field owns the problem. Null for whole-section issues. */
    Field: string | null;
    /** For a line or instalment issue: which row, by its ClientKey. */
    ClientKey: string | null;
    Severity: DealDraftSeverity;
    /** Human-readable and safe to show verbatim. */
    Message: string;
}

export interface DealDraftValidation {
    /** False when at least one issue is an error. Warnings alone do not block a save. */
    IsValid: boolean;
    Issues: DealDraftIssue[];
}

/* ────────────────────────────────────────────────────────────────────────────
 * The rows
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * A line being composed. `ClientKey` is the identity the FORM uses — it exists from the moment the
 * row is added, whereas `ID` only exists after a save, and a grid needs a stable key before then.
 */
export interface DealDraftLine {
    ClientKey: string;
    /** Null until this line has been saved at least once. */
    ID: string | null;
    ProductID: string | null;
    ProductName: string | null;
    DealLineTypeID: string | null;
    Quantity: number;
    RequestedDiscountPct: number | null;
    OverrideUnitPrice: number | null;
    /** The signed figures. Transcribed, never derived — see the file header. */
    AnnualGrossFees: number | null;
    DiscountAmount: number | null;
    Total: number | null;
    TermMonths: number | null;
    ServicePeriodStart: string | null;
    ServicePeriodEnd: string | null;
    Description: string | null;
}

/** One negotiated instalment. No rows at all is the normal case — standard terms. */
export interface DealDraftScheduleRow {
    ClientKey: string;
    ID: string | null;
    PaymentDate: string | null;
    Amount: number | null;
    Description: string | null;
}

/** The deal header, as the form holds it. */
export interface DealDraftHeader {
    ID: string | null;
    Name: string;
    PipelineID: string | null;
    PipelineStageID: string | null;
    DealTypeID: string | null;
    DealStatusTypeID: string | null;
    AccountID: string | null;
    PrimaryContactID: string | null;
    BillingContactID: string | null;
    CompanyID: string | null;
    OwnerEmployeeID: string | null;
    Amount: number | null;
    CurrencyID: string | null;
    TermMonths: number | null;
    EstimatedProjectWeeks: number | null;
    ExecutionDate: string | null;
    StartDate: string | null;
    ExpectedCloseDate: string | null;
    Probability: number | null;
    ForecastCategoryTypeID: string | null;
    LeadSourceTypeID: string | null;
    AutoRenew: boolean;
    AnnualIncreasePctOverride: number | null;
    CancellationNoticeDaysOverride: number | null;
    PaymentMethod: string | null;
    ContractVariances: string | null;
    Description: string | null;
    NextStep: string | null;
    NextStepDate: string | null;
}

/**
 * The house defaults the form pre-fills. `AnnualIncreasePctOverride` and
 * `CancellationNoticeDaysOverride` are NOT among them, deliberately: their real defaults (5% / 90
 * days) live on the contracts ContractType, and null here means "use the standard term". Writing 5
 * and 90 into every draft would freeze this year's policy into next year's renewals. The FORM may
 * display 5 and 90 as placeholder text — that is presentation — but the draft must send null unless
 * the AD actually typed something else.
 */
export const DEAL_DRAFT_DEFAULT_PAYMENT_METHOD = 'ACH';

/* ────────────────────────────────────────────────────────────────────────────
 * The draft
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * A deal being composed, whether it is new or being edited. The create surface and the edit surface
 * bind to the same class on purpose: a deal being created is just a draft whose `ID` is null, and two
 * separate models would drift apart within a release.
 */
export class DealDraft {
    public Header: DealDraftHeader;
    public Lines: DealDraftLine[] = [];
    public Schedule: DealDraftScheduleRow[] = [];

    /**
     * Monotonic counter behind {@link NextClientKey}. Not an ID and never persisted — it only has to
     * be unique within one editing session, which is all a grid key needs.
     */
    private _keySeq = 0;

    constructor(header?: Partial<DealDraftHeader>) {
        this.Header = {
            ID: null,
            Name: '',
            PipelineID: null,
            PipelineStageID: null,
            DealTypeID: null,
            DealStatusTypeID: null,
            AccountID: null,
            PrimaryContactID: null,
            BillingContactID: null,
            CompanyID: null,
            OwnerEmployeeID: null,
            Amount: null,
            CurrencyID: null,
            TermMonths: null,
            EstimatedProjectWeeks: null,
            ExecutionDate: null,
            StartDate: null,
            ExpectedCloseDate: null,
            Probability: null,
            ForecastCategoryTypeID: null,
            LeadSourceTypeID: null,
            AutoRenew: false,
            AnnualIncreasePctOverride: null,
            CancellationNoticeDaysOverride: null,
            PaymentMethod: DEAL_DRAFT_DEFAULT_PAYMENT_METHOD,
            ContractVariances: null,
            Description: null,
            NextStep: null,
            NextStepDate: null,
            ...header,
        };
    }

    /** True when this draft has never been saved — what the UI reads to say "New Deal". */
    public get IsNew(): boolean {
        return !this.Header.ID;
    }

    /** A session-unique key for a new row. See {@link _keySeq}. */
    public NextClientKey(prefix: string): string {
        this._keySeq += 1;
        return `${prefix}-${this._keySeq}`;
    }

    /* ── Lines ──────────────────────────────────────────────────────────── */

    /** Appends an empty line and returns it, so the caller can bind to it immediately. */
    public AddLine(seed?: Partial<DealDraftLine>): DealDraftLine {
        const line: DealDraftLine = {
            ClientKey: this.NextClientKey('line'),
            ID: null,
            ProductID: null,
            ProductName: null,
            DealLineTypeID: null,
            Quantity: 1,
            RequestedDiscountPct: null,
            OverrideUnitPrice: null,
            AnnualGrossFees: null,
            DiscountAmount: null,
            Total: null,
            TermMonths: null,
            ServicePeriodStart: null,
            ServicePeriodEnd: null,
            Description: null,
            ...seed,
        };
        this.Lines.push(line);
        return line;
    }

    /**
     * Removes a line from the draft. No deleted-row bookkeeping is needed here — unlike the server
     * subclass, the draft sends its lines as the COMPLETE desired set, so a row that is gone from the
     * array is gone from the payload, and the server deletes whatever is no longer named.
     */
    public RemoveLine(lineOrKey: DealDraftLine | string): boolean {
        const key = typeof lineOrKey === 'string' ? lineOrKey : lineOrKey.ClientKey;
        const idx = this.Lines.findIndex((l) => l.ClientKey === key);
        if (idx < 0) {
            return false;
        }
        this.Lines.splice(idx, 1);
        return true;
    }

    /* ── Payment schedule ───────────────────────────────────────────────── */

    /** Appends an empty instalment and returns it. */
    public AddScheduleRow(seed?: Partial<DealDraftScheduleRow>): DealDraftScheduleRow {
        const row: DealDraftScheduleRow = {
            ClientKey: this.NextClientKey('pay'),
            ID: null,
            PaymentDate: null,
            Amount: null,
            Description: null,
            ...seed,
        };
        this.Schedule.push(row);
        return row;
    }

    public RemoveScheduleRow(rowOrKey: DealDraftScheduleRow | string): boolean {
        const key = typeof rowOrKey === 'string' ? rowOrKey : rowOrKey.ClientKey;
        const idx = this.Schedule.findIndex((r) => r.ClientKey === key);
        if (idx < 0) {
            return false;
        }
        this.Schedule.splice(idx, 1);
        return true;
    }

    /* ── Validation ─────────────────────────────────────────────────────── */

    /**
     * What a form can honestly check with no database behind it. Every issue here is a REQUIREMENT
     * the server will reject the draft for anyway — never a judgement about the commercial sense of
     * the deal, and never anything that needs arithmetic.
     */
    public Validate(): DealDraftValidation {
        const issues: DealDraftIssue[] = [];

        const err = (Section: DealDraftSection, Field: string | null, Message: string, ClientKey: string | null = null): void => {
            issues.push({ Section, Field, ClientKey, Severity: 'error', Message });
        };
        const warn = (Section: DealDraftSection, Field: string | null, Message: string, ClientKey: string | null = null): void => {
            issues.push({ Section, Field, ClientKey, Severity: 'warning', Message });
        };

        // ── Party ──
        if (!this.Header.Name || !this.Header.Name.trim()) {
            err('party', 'Name', 'A deal needs a name.');
        }
        if (!this.Header.PipelineID) {
            err('party', 'PipelineID', 'Choose a pipeline. It determines the stages and the selling company.');
        }
        if (!this.Header.AccountID) {
            // A warning, not an error: the schema allows a deal with no account, and an early-stage
            // opportunity legitimately has none yet. Worth flagging because it is almost always an
            // omission rather than an intent.
            warn('party', 'AccountID', 'No customer chosen yet — this deal is not attached to an account.');
        }

        // ── Terms / dates ──
        // Only orderings the schema itself would reject, or that are unambiguously wrong. Note there
        // is deliberately NO check of ExecutionDate against StartDate: work that begins before
        // signature is common and legitimate, and the database does not constrain them either.
        if (this.Header.Probability !== null && (this.Header.Probability < 0 || this.Header.Probability > 100)) {
            err('terms', 'Probability', 'Probability must be between 0 and 100.');
        }
        if (this.Header.AnnualIncreasePctOverride !== null
            && (this.Header.AnnualIncreasePctOverride < 0 || this.Header.AnnualIncreasePctOverride > 100)) {
            err('terms', 'AnnualIncreasePctOverride', 'Annual increase must be between 0 and 100%.');
        }
        if (this.Header.CancellationNoticeDaysOverride !== null && this.Header.CancellationNoticeDaysOverride < 0) {
            err('terms', 'CancellationNoticeDaysOverride', 'Cancellation notice cannot be negative.');
        }
        if (this.Header.TermMonths !== null && this.Header.TermMonths < 0) {
            err('terms', 'TermMonths', 'Term cannot be negative.');
        }
        if (this.Header.EstimatedProjectWeeks !== null && this.Header.EstimatedProjectWeeks < 0) {
            err('terms', 'EstimatedProjectWeeks', 'Estimated timeline cannot be negative.');
        }

        // ── Lines ──
        for (const line of this.Lines) {
            const label = line.ProductName?.trim() || 'this line';
            if (!line.ProductName || !line.ProductName.trim()) {
                err('lines', 'ProductName', 'Every line needs a product or service name.', line.ClientKey);
            }
            if (line.Quantity === null || line.Quantity === undefined || line.Quantity < 0) {
                err('lines', 'Quantity', `Quantity on ${label} must be zero or more.`, line.ClientKey);
            }
            if (line.RequestedDiscountPct !== null && (line.RequestedDiscountPct < 0 || line.RequestedDiscountPct > 100)) {
                err('lines', 'RequestedDiscountPct', `Requested discount on ${label} must be between 0 and 100%.`, line.ClientKey);
            }
            if (line.AnnualGrossFees !== null && line.AnnualGrossFees < 0) {
                err('lines', 'AnnualGrossFees', `Annual gross fees on ${label} cannot be negative.`, line.ClientKey);
            }
            if (line.DiscountAmount !== null && line.DiscountAmount < 0) {
                err('lines', 'DiscountAmount', `Discount on ${label} cannot be negative — a surcharge belongs on its own line.`, line.ClientKey);
            }
            if (line.ServicePeriodStart && line.ServicePeriodEnd && line.ServicePeriodEnd < line.ServicePeriodStart) {
                err('lines', 'ServicePeriodEnd', `Service period on ${label} ends before it starts.`, line.ClientKey);
            }
            if (!line.DealLineTypeID) {
                warn('lines', 'DealLineTypeID', `${label} has no type set — recurring and one-time lines behave differently downstream.`, line.ClientKey);
            }
            // NOT CHECKED, on purpose: whether Total equals AnnualGrossFees - DiscountAmount. All
            // three are transcribed from a signed document; asserting the relationship would be this
            // app computing money, which is the one thing it must never do.
        }

        // ── Payment schedule ──
        for (const row of this.Schedule) {
            if (row.Amount === null && !row.Description) {
                err('schedule', 'Amount', 'An instalment needs at least an amount or a description.', row.ClientKey);
            }
        }
        // NOT CHECKED: whether the instalments sum to the deal amount. Summing them and comparing is
        // computing money, and the authoritative total lives in orders, not here.

        return { IsValid: !issues.some((i) => i.Severity === 'error'), Issues: issues };
    }

    /** Issues for one section — what a tab reads to decide whether to show a badge. */
    public IssuesFor(section: DealDraftSection, validation?: DealDraftValidation): DealDraftIssue[] {
        const v = validation ?? this.Validate();
        return v.Issues.filter((i) => i.Section === section);
    }

    /* ── Serialization ──────────────────────────────────────────────────── */

    /**
     * Becomes the `Sales.SaveDeal` input. Returns a plain object rather than anything MJ-aware, so
     * this class stays testable and the caller stays in charge of transport.
     *
     * `Lines` and `PaymentSchedule` are ALWAYS included, even when empty, because the operation
     * treats a present array as the complete desired set and an absent one as "leave the children
     * alone". A workspace that holds the whole tree always means the former — if it is showing the
     * user zero lines, zero lines is the intent.
     *
     * Return type is intentionally left to inference against the operation's generated input type:
     * see `SalesSaveDealInput` in the generated remote operations.
     */
    public ToSaveInput(): {
        ID?: string | null;
        Name: string;
        PipelineID: string;
        Lines: Array<Record<string, unknown>>;
        PaymentSchedule: Array<Record<string, unknown>>;
        [key: string]: unknown;
    } {
        if (!this.Header.PipelineID) {
            throw new Error('DealDraft.ToSaveInput: PipelineID is required. Call Validate() first and show the issues.');
        }

        const h = this.Header;
        return {
            ID: h.ID,
            Name: h.Name,
            PipelineID: h.PipelineID,
            PipelineStageID: h.PipelineStageID,
            DealTypeID: h.DealTypeID,
            DealStatusTypeID: h.DealStatusTypeID,
            AccountID: h.AccountID,
            PrimaryContactID: h.PrimaryContactID,
            BillingContactID: h.BillingContactID,
            CompanyID: h.CompanyID,
            OwnerEmployeeID: h.OwnerEmployeeID,
            Amount: h.Amount,
            CurrencyID: h.CurrencyID,
            TermMonths: h.TermMonths,
            EstimatedProjectWeeks: h.EstimatedProjectWeeks,
            ExecutionDate: h.ExecutionDate,
            StartDate: h.StartDate,
            ExpectedCloseDate: h.ExpectedCloseDate,
            Probability: h.Probability,
            ForecastCategoryTypeID: h.ForecastCategoryTypeID,
            LeadSourceTypeID: h.LeadSourceTypeID,
            AutoRenew: h.AutoRenew,
            AnnualIncreasePctOverride: h.AnnualIncreasePctOverride,
            CancellationNoticeDaysOverride: h.CancellationNoticeDaysOverride,
            PaymentMethod: h.PaymentMethod,
            ContractVariances: h.ContractVariances,
            Description: h.Description,
            NextStep: h.NextStep,
            NextStepDate: h.NextStepDate,
            Lines: this.Lines.map((l) => ({
                ClientKey: l.ClientKey,
                ID: l.ID,
                ProductID: l.ProductID,
                ProductName: l.ProductName,
                DealLineTypeID: l.DealLineTypeID,
                Quantity: l.Quantity,
                RequestedDiscountPct: l.RequestedDiscountPct,
                OverrideUnitPrice: l.OverrideUnitPrice,
                AnnualGrossFees: l.AnnualGrossFees,
                DiscountAmount: l.DiscountAmount,
                Total: l.Total,
                TermMonths: l.TermMonths,
                ServicePeriodStart: l.ServicePeriodStart,
                ServicePeriodEnd: l.ServicePeriodEnd,
                Description: l.Description,
            })),
            PaymentSchedule: this.Schedule.map((r) => ({
                ClientKey: r.ClientKey,
                ID: r.ID,
                PaymentDate: r.PaymentDate,
                Amount: r.Amount,
                Description: r.Description,
            })),
        };
    }

    /**
     * Folds a successful save result back in, so the same instance keeps being the live model instead
     * of the caller rebuilding one. Matching is by `ClientKey` — which is exactly why the operation
     * echoes it back.
     */
    public ApplySaveResult(result: {
        DealID?: string | null;
        Lines?: Array<{ ClientKey?: string | null; ID: string }>;
        PaymentSchedule?: Array<{ ClientKey?: string | null; ID: string }>;
    }): void {
        if (result.DealID) {
            this.Header.ID = result.DealID;
        }
        for (const r of result.Lines ?? []) {
            const line = this.Lines.find((l) => l.ClientKey === r.ClientKey);
            if (line) {
                line.ID = r.ID;
            }
        }
        for (const r of result.PaymentSchedule ?? []) {
            const row = this.Schedule.find((s) => s.ClientKey === r.ClientKey);
            if (row) {
                row.ID = r.ID;
            }
        }
    }
}
