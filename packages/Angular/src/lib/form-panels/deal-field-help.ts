/**
 * @fileoverview What the help icon beside each deal field says (golive #421).
 *
 * EVERY SENTENCE HERE DESCRIBES SOMETHING THE CODE DOES. A field that is only stored says it is for
 * reference rather than borrowing a purpose from its name: "Start Date" does not start anything, and
 * saying it did is how a rep ends up setting the wrong field. When a field's behaviour changes, its
 * line here changes in the same PR.
 *
 * Written for the person filling in the deal: what the field is, then what setting it does. No
 * entity, column or setting names.
 */

/** Help for the fields on the deal form, by field name. */
const DEAL_FIELD_HELP: Readonly<Record<string, string>> = {
    // Account & people
    AccountID:
        'The customer organization. Required to close the deal as won. Choosing an account sets any empty primary or billing contact to the account\'s default.',
    CompanyID:
        'The selling company. Determines the deal\'s default currency and the time zone for its close date.',
    OwnerEmployeeID:
        'The person responsible for the deal. Changing the owner updates the owner role on the Internal team.',
    PrimaryContactID:
        'Your main contact at the account. Becomes the contract\'s primary contact when the deal is won, and receives the invoice when no billing contact is set.',
    BillingContactID:
        'The person who receives the invoice. Leave empty to bill the primary contact. Changes made after the order is confirmed do not update that order.',

    // Pipeline
    PipelineCompany:
        'The selling company. A deal can use only the pipelines linked to its company, so changing the company can move the deal to another pipeline.',
    PipelineID:
        'The sales process the deal follows. Determines the available stages and the checks that run when the deal is closed as won.',
    PipelineStageID:
        'The deal\'s current step in its pipeline. Changing the stage resets Probability and Forecast Category to the new stage\'s defaults, unless you change them in the same save. Use Status to close the deal.',
    DealStatusTypeID:
        'Whether the deal is open or closed. Choosing a closing status closes and locks the deal. Choosing an open status reopens a closed deal.',
    DealTypeID:
        'The kind of sale, such as new business or a renewal. Winning a renewal deal adds each subscription product as the next term of the customer\'s existing subscription.',
    ForecastCategoryTypeID:
        'Your confidence that the deal closes in its period, such as Commit or Best Case. Determines which forecast totals include the deal. Changing the stage resets it.',
    Probability:
        'The chance of winning the deal, from 0 to 100 percent. Weighted pipeline multiplies the amount by this percent. Changing the stage resets it, and closing the deal sets it automatically.',
    CreationDate:
        'The date the opportunity began. Defaults to the day the deal was created. Change it if the opportunity started earlier.',
    ExpectedCloseDate:
        'The day you expect the deal to close. Places the deal in a forecast period. The dashboard and the deal overview flag an open deal once this date passes.',
    LeadSourceTypeID:
        'How the deal originated, such as a referral or an event. For reference only.',
    LeadSourceDetail:
        'The specific source, such as the event name or the referring person. For reference only.',

    // Commercial
    Amount:
        'The deal\'s total value. Once the deal has products, the amount is calculated automatically and replaces any typed value. Type an amount only on a deal without products.',
    CurrencyID:
        'The currency of the deal\'s amounts. Defaults to the selling company\'s currency.',
    TermMonths:
        'The agreement length in months. For reference only. Each product determines its own subscription term.',
    EstimatedProjectWeeks:
        'The estimated project length in weeks, per the statement of work. For reference only. Does not affect terms or renewal dates.',
    MRR:
        'Monthly recurring revenue. Entered manually, not calculated.',
    ARR:
        'Annual recurring revenue. Entered manually, not calculated.',
    StartDate:
        'The expected service start. For reference only. A subscription starts on its product line\'s Term start, not on this date.',
    ExecutionDate:
        'The date the agreement was signed. For reference only. Can fall after the start date when work begins before signature.',
    AutoRenew:
        'Whether the agreement renews automatically when its term ends. Winning the deal copies it to the contract.',
    PaymentMethod:
        'How the customer expects to pay, for example ACH. For reference only. Does not change how the order is invoiced.',
    Description:
        'Notes about the deal. Remains editable after the deal is closed.',

    // Motion
    NextStep:
        'The next action that advances the deal. Appears in the deal header. The overview flags a deal that has none.',
    NextStepDate:
        'The due date for the next step. The overview flags the deal once this date passes.',
    OrderID:
        'The order that holds the deal\'s products and pricing. Saving the deal creates it.',
    ContractID:
        'The deal\'s contract. Winning the deal creates it when the pipeline calls for one.',
    RenewsContractID:
        'The existing contract that this deal renews, if any.',
    ContractVariances:
        'Terms that differ from the standard agreement. Winning the deal copies them to the contract\'s description.',

    // Close
    ActualCloseDate:
        'The business day the deal closed, in the selling company\'s time zone. Closing the deal sets it; reopening clears it. Determines the reporting period of a won deal.',
    ClosedAt:
        'The date and time the deal closed. Closing the deal sets it; reopening clears it.',
    ClosedByUserID:
        'The person who closed the deal. Closing the deal sets it; reopening clears it.',
    LossReasonID:
        'Why the deal was lost. Required to close a deal as lost.',
    LossNotes:
        'Details on why the deal was lost. Some loss reasons require them. Remains editable after the deal is closed.',
    StandardAgreementModified:
        'Turn on when the customer\'s agreement differs from the standard one. Winning the deal copies it to the contract, where it flags the changes for review.',
    AnnualIncreasePctOverride:
        'The annual price increase agreed for this deal, from 0 to 100 percent. Leave empty to use the contract type\'s standard increase. Winning the deal copies it to the contract.',
    CancellationNoticeDaysOverride:
        'The cancellation notice period agreed for this deal, in days. Leave empty to use the contract type\'s standard period. Winning the deal copies it to the contract.',
};

/** The help for one deal field, or null for a field with none. */
export function DealFieldHelp(fieldName: string): string | null {
    return DEAL_FIELD_HELP[fieldName] ?? null;
}

/** Every deal field that has help, for the test that holds the form's fields against this list. */
export function DealFieldsWithHelp(): string[] {
    return Object.keys(DEAL_FIELD_HELP);
}

/** Help for the fields of a deal's product line: the line editor and the line cards. */
export const DEAL_LINE_HELP = {
    Product:
        'The product or service sold. Lists only active products currently available for sale.',
    Quantity:
        'The number of units sold, such as seats or licenses. The line total is the quantity times the unit price. Some products change price at higher quantities.',
    Discount:
        'A discount on this line, as a percent or a dollar amount. Adding or raising a discount requires a reason, and the order cannot be confirmed until the discount is approved.',
    DiscountReasonCategory:
        'The type of reason for the discount. Required when you add or raise a discount.',
    DiscountReason:
        'Why you are giving the discount. Required when you add or raise a discount.',
    Price:
        'The price this line uses. Defaults to the product\'s standard price. Any other price requires an explanation.',
    TermStart:
        'The day the subscription begins. Leave empty to start on the day the deal closes, unless the product has a delayed or fixed start date. Leave empty for a renewal: the new term starts the day after current coverage ends. Enter a date only when a different start was agreed.',
    TermStartRenewal:
        'This line renews an existing subscription, so its term starts the day after current coverage ends. The date cannot be changed here.',
    ServiceStart:
        'The first day of service delivery. Revenue recognition uses the service period, so the order cannot be confirmed without both dates.',
    ServiceEnd:
        'The last day of service delivery. Must fall on or after the service start.',
    ExistingSubscription:
        'The customer already has a subscription for this product. Choose whether this line renews it or starts a separate subscription. Unless the deal is a renewal, you must choose before closing it as won.',
    UnitPrice:
        'The price of one unit, calculated from the product\'s pricing. To change it, select another price or apply a discount.',
    LineTotal:
        'Quantity times unit price, less any discount.',
} as const;
