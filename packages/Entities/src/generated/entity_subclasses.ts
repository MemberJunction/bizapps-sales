import { BaseEntity, EntitySaveOptions, EntityDeleteOptions, CompositeKey, ValidationResult, ValidationErrorInfo, ValidationErrorType, Metadata, ProviderType, DatabaseProviderBase } from "@memberjunction/core";
import { RegisterClass } from "@memberjunction/global";
import { z } from "zod";

export const loadModule = () => {
  // no-op, only used to ensure this file is a valid module and to allow easy loading
}

     
 
/**
 * zod schema definition for the entity MJ_BizApps_Sales: Account Types
 */
export const mjBizAppsSalesAccountTypeSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Code
        * * SQL Data Type: nvarchar(40)`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)`),
    IsCustomer: z.boolean().describe(`
        * * Field Name: IsCustomer
        * * Display Name: Is Customer
        * * SQL Data Type: bit
        * * Default Value: 0`),
    IsProspect: z.boolean().describe(`
        * * Field Name: IsProspect
        * * Display Name: Is Prospect
        * * SQL Data Type: bit
        * * Default Value: 0`),
    IsPartner: z.boolean().describe(`
        * * Field Name: IsPartner
        * * Display Name: Is Partner
        * * SQL Data Type: bit
        * * Default Value: 0`),
    DisplayRank: z.number().describe(`
        * * Field Name: DisplayRank
        * * Display Name: Display Rank
        * * SQL Data Type: int
        * * Default Value: 0`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
});

export type mjBizAppsSalesAccountTypeEntityType = z.infer<typeof mjBizAppsSalesAccountTypeSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Sales: Buying Role Types
 */
export const mjBizAppsSalesBuyingRoleTypeSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Code
        * * SQL Data Type: nvarchar(40)`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)`),
    IsDecisionMaker: z.boolean().describe(`
        * * Field Name: IsDecisionMaker
        * * Display Name: Is Decision Maker
        * * SQL Data Type: bit
        * * Default Value: 0`),
    IsBlocker: z.boolean().describe(`
        * * Field Name: IsBlocker
        * * Display Name: Is Blocker
        * * SQL Data Type: bit
        * * Default Value: 0`),
    InfluenceWeight: z.number().nullable().describe(`
        * * Field Name: InfluenceWeight
        * * Display Name: Influence Weight
        * * SQL Data Type: decimal(5, 2)`),
    DisplayRank: z.number().describe(`
        * * Field Name: DisplayRank
        * * Display Name: Display Rank
        * * SQL Data Type: int
        * * Default Value: 0`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
});

export type mjBizAppsSalesBuyingRoleTypeEntityType = z.infer<typeof mjBizAppsSalesBuyingRoleTypeSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Sales: Deal Contact Roles
 */
export const mjBizAppsSalesDealContactRoleSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    DealID: z.string().describe(`
        * * Field Name: DealID
        * * Display Name: Deal ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deals (vwDeals.ID)`),
    SalesContactID: z.string().describe(`
        * * Field Name: SalesContactID
        * * Display Name: Sales Contact ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Sales Contacts (vwSalesContacts.ID)`),
    BuyingRoleTypeID: z.string().nullable().describe(`
        * * Field Name: BuyingRoleTypeID
        * * Display Name: Buying Role Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Buying Role Types (vwBuyingRoleTypes.ID)`),
    Influence: z.number().nullable().describe(`
        * * Field Name: Influence
        * * Display Name: Influence
        * * SQL Data Type: decimal(5, 2)`),
    Notes: z.string().nullable().describe(`
        * * Field Name: Notes
        * * Display Name: Notes
        * * SQL Data Type: nvarchar(MAX)`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Deal: z.string().describe(`
        * * Field Name: Deal
        * * Display Name: Deal
        * * SQL Data Type: nvarchar(500)`),
    BuyingRoleType: z.string().nullable().describe(`
        * * Field Name: BuyingRoleType
        * * Display Name: Buying Role Type
        * * SQL Data Type: nvarchar(200)`),
});

export type mjBizAppsSalesDealContactRoleEntityType = z.infer<typeof mjBizAppsSalesDealContactRoleSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Sales: Deal Line Types
 */
export const mjBizAppsSalesDealLineTypeSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Code
        * * SQL Data Type: nvarchar(40)`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)`),
    IsRecurring: z.boolean().describe(`
        * * Field Name: IsRecurring
        * * Display Name: Is Recurring
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: The behaviour flag. 1 for lines that carry into MRR/ARR and become a renewable subscription; 0 for lines billed once. Branch on this, never on Name or Code.`),
    DisplayRank: z.number().describe(`
        * * Field Name: DisplayRank
        * * Display Name: Display Rank
        * * SQL Data Type: int
        * * Default Value: 0`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
});

export type mjBizAppsSalesDealLineTypeEntityType = z.infer<typeof mjBizAppsSalesDealLineTypeSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Sales: Deal Lines
 */
export const mjBizAppsSalesDealLineSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    DealID: z.string().describe(`
        * * Field Name: DealID
        * * Display Name: Deal ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deals (vwDeals.ID)`),
    ProductID: z.string().nullable().describe(`
        * * Field Name: ProductID
        * * Display Name: Product ID
        * * SQL Data Type: uniqueidentifier
        * * Description: SOFT reference (no FK) to a bizapps-orders Product. Soft because orders' migrations may not have run — which is exactly what lets this app stand up independently.`),
    ProductName: z.string().nullable().describe(`
        * * Field Name: ProductName
        * * Display Name: Product Name
        * * SQL Data Type: nvarchar(500)
        * * Description: The product/service name AS WRITTEN ON THE SIGNED DOCUMENT — transcription, not a denormalized cache of the catalog name, and never auto-synced from it. Needed twice over: ProductID points at the orders catalog, which is not installed yet, so without this a line is an unreadable GUID; and once orders IS present, renaming a catalog product must not retroactively reword what a customer signed.`),
    Quantity: z.number().describe(`
        * * Field Name: Quantity
        * * Display Name: Quantity
        * * SQL Data Type: decimal(19, 4)
        * * Default Value: 1`),
    RequestedDiscountPct: z.number().nullable().describe(`
        * * Field Name: RequestedDiscountPct
        * * Display Name: Requested Discount Pct
        * * SQL Data Type: decimal(5, 2)`),
    OverrideUnitPrice: z.number().nullable().describe(`
        * * Field Name: OverrideUnitPrice
        * * Display Name: Override Unit Price
        * * SQL Data Type: decimal(19, 4)
        * * Description: A negotiated unit price. An INPUT to the pricing engine, never a replacement for it — the line still goes through Orders.PreviewOrder.`),
    TermMonths: z.number().nullable().describe(`
        * * Field Name: TermMonths
        * * Display Name: Term Months
        * * SQL Data Type: int`),
    ServicePeriodStart: z.date().nullable().describe(`
        * * Field Name: ServicePeriodStart
        * * Display Name: Service Period Start
        * * SQL Data Type: date`),
    ServicePeriodEnd: z.date().nullable().describe(`
        * * Field Name: ServicePeriodEnd
        * * Display Name: Service Period End
        * * SQL Data Type: date`),
    DealLineTypeID: z.string().nullable().describe(`
        * * Field Name: DealLineTypeID
        * * Display Name: Deal Line Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deal Line Types (vwDealLineTypes.ID)
        * * Description: Whether this line is a one-time charge or a recurring one. A FK to DealLineType, replacing what was a free-text LineType column: recurring lines are what produce MRR/ARR and a renewal, and the moment code needs to tell them apart a string forces exactly the name comparison the vocabulary rule forbids. Branch on DealLineType.IsRecurring, never on the name.`),
    DisplayOrder: z.number().describe(`
        * * Field Name: DisplayOrder
        * * Display Name: Display Order
        * * SQL Data Type: int
        * * Default Value: 0`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)`),
    AnnualGrossFees: z.number().nullable().describe(`
        * * Field Name: AnnualGrossFees
        * * Display Name: Annual Gross Fees
        * * SQL Data Type: decimal(19, 4)
        * * Description: Annual gross fees for this line AS WRITTEN ON THE SIGNED DOCUMENT. An INPUT the AD transcribes, not a figure this app derives. Once orders is wired in, Orders.PreviewOrder's answer lands in the Resolved* columns and becomes the authority on what the deal is worth; this remains the record of what was signed.`),
    DiscountAmount: z.number().nullable().describe(`
        * * Field Name: DiscountAmount
        * * Display Name: Discount Amount
        * * SQL Data Type: decimal(19, 4)
        * * Description: The discount as a CURRENCY AMOUNT, as the order form expresses it. Coexists with RequestedDiscountPct deliberately — the template speaks in amounts, the pricing engine takes a percent — and there is no exactly-one-of constraint, because a deal can legitimately carry a negotiated percentage as engine input AND the figure printed on the signed page.`),
    Total: z.number().nullable().describe(`
        * * Field Name: Total
        * * Display Name: Total
        * * SQL Data Type: decimal(19, 4)
        * * Description: THE SIGNED FIGURE for this line, transcribed from the executed document. On the PDF it equals AnnualGrossFees minus DiscountAmount, but THAT SUBTRACTION IS THE CUSTOMER'S AND THE AD'S, NOT THIS APP'S: nothing here computes, defaults or back-fills it, which is how the no-arithmetic rule stays literally true. Deliberately unconstrained in sign — a credit or concession line is legitimately negative, and bounding it would mean asserting the arithmetic.`),
    ResolvedUnitPrice: z.number().nullable().describe(`
        * * Field Name: ResolvedUnitPrice
        * * Display Name: Resolved Unit Price
        * * SQL Data Type: decimal(19, 4)
        * * Description: WRITE-ONLY from this app's perspective: populated only from an Orders.PreviewOrder response, never computed locally, never hand-edited.`),
    ResolvedExtendedAmount: z.number().nullable().describe(`
        * * Field Name: ResolvedExtendedAmount
        * * Display Name: Resolved Extended Amount
        * * SQL Data Type: decimal(19, 4)
        * * Description: WRITE-ONLY, from Orders.PreviewOrder. Never quantity x price computed here.`),
    PriceComponentsJSON: z.string().nullable().describe(`
        * * Field Name: PriceComponentsJSON
        * * Display Name: Price Components JSON
        * * SQL Data Type: nvarchar(MAX)
        * * Description: The explanation trail Orders.PreviewOrder returns (base, rules, adjustments, charges, tax), so a rep can answer "why is it this price" without a support ticket.`),
    PricedAt: z.date().nullable().describe(`
        * * Field Name: PricedAt
        * * Display Name: Priced At
        * * SQL Data Type: datetimeoffset`),
    CompanyID: z.string().nullable().describe(`
        * * Field Name: CompanyID
        * * Display Name: Company ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
        * * Description: DENORMALIZED stamp of the product's owning company at price time, mirroring OrderLine.CompanyID. This is what lets a cross-company deal materialize into orders with correct per-line company ownership. Server-maintained; never hand-set.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Deal: z.string().describe(`
        * * Field Name: Deal
        * * Display Name: Deal
        * * SQL Data Type: nvarchar(500)`),
    DealLineType: z.string().nullable().describe(`
        * * Field Name: DealLineType
        * * Display Name: Deal Line Type
        * * SQL Data Type: nvarchar(200)`),
    Company: z.string().nullable().describe(`
        * * Field Name: Company
        * * Display Name: Company
        * * SQL Data Type: nvarchar(50)`),
});

export type mjBizAppsSalesDealLineEntityType = z.infer<typeof mjBizAppsSalesDealLineSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Sales: Deal Payment Schedules
 */
export const mjBizAppsSalesDealPaymentScheduleSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    DealID: z.string().describe(`
        * * Field Name: DealID
        * * Display Name: Deal ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deals (vwDeals.ID)`),
    PaymentDate: z.date().nullable().describe(`
        * * Field Name: PaymentDate
        * * Display Name: Payment Date
        * * SQL Data Type: date`),
    Amount: z.number().nullable().describe(`
        * * Field Name: Amount
        * * Display Name: Amount
        * * SQL Data Type: decimal(19, 4)
        * * Description: The instalment amount as agreed. Unconstrained in sign: a refund or credit instalment is legitimately negative, and this table records what was agreed rather than asserting a shape for it.`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(1000)`),
    DisplayOrder: z.number().describe(`
        * * Field Name: DisplayOrder
        * * Display Name: Display Order
        * * SQL Data Type: int
        * * Default Value: 0
        * * Description: Explicit ordering, because instalment order is not always date order — "on execution" and "on signature of SOW 2" can share a date or have none yet. Server-maintained and re-sequenced on every save, mirroring how accounting re-sequences JournalEntryLine.LineNumber.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Deal: z.string().describe(`
        * * Field Name: Deal
        * * Display Name: Deal
        * * SQL Data Type: nvarchar(500)`),
});

export type mjBizAppsSalesDealPaymentScheduleEntityType = z.infer<typeof mjBizAppsSalesDealPaymentScheduleSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Sales: Deal Roles
 */
export const mjBizAppsSalesDealRoleSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Code
        * * SQL Data Type: nvarchar(40)`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)`),
    IsOwnerRole: z.boolean().describe(`
        * * Field Name: IsOwnerRole
        * * Display Name: Is Owner Role
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: Identifies the role that DEFINES ownership. Exactly one team member per deal may hold a role with this flag, enforced server-side, and Deal.OwnerEmployeeID is the denormalized stamp of whoever does.`),
    AllowsMultiplePerDeal: z.boolean().describe(`
        * * Field Name: AllowsMultiplePerDeal
        * * Display Name: Allows Multiple Per Deal
        * * SQL Data Type: bit
        * * Default Value: 1
        * * Description: Whether two people may hold this role on one deal. Two sales engineers, yes; two owners, no. Enforced server-side FROM THIS FLAG, never hardcoded against a role name.`),
    DefaultAttributionPct: z.number().nullable().describe(`
        * * Field Name: DefaultAttributionPct
        * * Display Name: Default Attribution Pct
        * * SQL Data Type: decimal(5, 2)`),
    IsQuotaCarrying: z.boolean().describe(`
        * * Field Name: IsQuotaCarrying
        * * Display Name: Is Quota Carrying
        * * SQL Data Type: bit
        * * Default Value: 0`),
    DisplayRank: z.number().describe(`
        * * Field Name: DisplayRank
        * * Display Name: Display Rank
        * * SQL Data Type: int
        * * Default Value: 0`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
});

export type mjBizAppsSalesDealRoleEntityType = z.infer<typeof mjBizAppsSalesDealRoleSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Sales: Deal Stage Events
 */
export const mjBizAppsSalesDealStageEventSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    DealID: z.string().describe(`
        * * Field Name: DealID
        * * Display Name: Deal ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deals (vwDeals.ID)`),
    FromStageID: z.string().nullable().describe(`
        * * Field Name: FromStageID
        * * Display Name: From Stage ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Pipeline Stages (vwPipelineStages.ID)`),
    ToStageID: z.string().nullable().describe(`
        * * Field Name: ToStageID
        * * Display Name: To Stage ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Pipeline Stages (vwPipelineStages.ID)`),
    FromDealStatusTypeID: z.string().nullable().describe(`
        * * Field Name: FromDealStatusTypeID
        * * Display Name: From Deal Status Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deal Status Types (vwDealStatusTypes.ID)`),
    ToDealStatusTypeID: z.string().nullable().describe(`
        * * Field Name: ToDealStatusTypeID
        * * Display Name: To Deal Status Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deal Status Types (vwDealStatusTypes.ID)`),
    ChangedByUserID: z.string().nullable().describe(`
        * * Field Name: ChangedByUserID
        * * Display Name: Changed By User ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)`),
    ChangedAt: z.date().describe(`
        * * Field Name: ChangedAt
        * * Display Name: Changed At
        * * SQL Data Type: datetimeoffset
        * * Default Value: sysutcdatetime()
        * * Description: The ORIGINAL time of the transition, not the row's insert time. A distinct column rather than a reliance on __mj_CreatedAt because the HubSpot import must preserve historical timestamps — a 2023 transition has to land as 2023.`),
    DaysInPreviousStage: z.number().nullable().describe(`
        * * Field Name: DaysInPreviousStage
        * * Display Name: Days In Previous Stage
        * * SQL Data Type: int`),
    AmountAtTransition: z.number().nullable().describe(`
        * * Field Name: AmountAtTransition
        * * Display Name: Amount At Transition
        * * SQL Data Type: decimal(19, 4)
        * * Description: Deal.Amount as it stood at this transition. Point-in-time truth: "what did we think the forecast was on the 1st" is unanswerable from Deal alone once amounts change.`),
    ProbabilityAtTransition: z.number().nullable().describe(`
        * * Field Name: ProbabilityAtTransition
        * * Display Name: Probability At Transition
        * * SQL Data Type: decimal(5, 2)`),
    Notes: z.string().nullable().describe(`
        * * Field Name: Notes
        * * Display Name: Notes
        * * SQL Data Type: nvarchar(MAX)`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Deal: z.string().describe(`
        * * Field Name: Deal
        * * Display Name: Deal
        * * SQL Data Type: nvarchar(500)`),
    FromStage: z.string().nullable().describe(`
        * * Field Name: FromStage
        * * Display Name: From Stage
        * * SQL Data Type: nvarchar(200)`),
    ToStage: z.string().nullable().describe(`
        * * Field Name: ToStage
        * * Display Name: To Stage
        * * SQL Data Type: nvarchar(200)`),
    FromDealStatusType: z.string().nullable().describe(`
        * * Field Name: FromDealStatusType
        * * Display Name: From Deal Status Type
        * * SQL Data Type: nvarchar(200)`),
    ToDealStatusType: z.string().nullable().describe(`
        * * Field Name: ToDealStatusType
        * * Display Name: To Deal Status Type
        * * SQL Data Type: nvarchar(200)`),
    ChangedByUser: z.string().nullable().describe(`
        * * Field Name: ChangedByUser
        * * Display Name: Changed By User
        * * SQL Data Type: nvarchar(100)`),
});

export type mjBizAppsSalesDealStageEventEntityType = z.infer<typeof mjBizAppsSalesDealStageEventSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Sales: Deal Status Types
 */
export const mjBizAppsSalesDealStatusTypeSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Code
        * * SQL Data Type: nvarchar(40)
        * * Description: Stable identifier the engine and metadata seeds key on. Renaming Name is cosmetic; renaming Code changes an identifier.`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)`),
    IsOpen: z.boolean().describe(`
        * * Field Name: IsOpen
        * * Display Name: Is Open
        * * SQL Data Type: bit
        * * Default Value: 0`),
    IsClosed: z.boolean().describe(`
        * * Field Name: IsClosed
        * * Display Name: Is Closed
        * * SQL Data Type: bit
        * * Default Value: 0`),
    IsWon: z.boolean().describe(`
        * * Field Name: IsWon
        * * Display Name: Is Won
        * * SQL Data Type: bit
        * * Default Value: 0`),
    IsLost: z.boolean().describe(`
        * * Field Name: IsLost
        * * Display Name: Is Lost
        * * SQL Data Type: bit
        * * Default Value: 0`),
    LocksDeal: z.boolean().describe(`
        * * Field Name: LocksDeal
        * * Display Name: Locks Deal
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: When 1, a deal in this status FREEZES: the header (except Description and NextStep), its lines and its team members become immutable, enforced in DealEntityServer.Save() — not in the UI, so an Action, an agent or a raw BaseEntity.Save() hits the same wall. Mirrors journal-entry immutability in accounting, and for the same reason: the deal is now the provenance of a contract and an order.`),
    DisplayRank: z.number().describe(`
        * * Field Name: DisplayRank
        * * Display Name: Display Rank
        * * SQL Data Type: int
        * * Default Value: 0`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
});

export type mjBizAppsSalesDealStatusTypeEntityType = z.infer<typeof mjBizAppsSalesDealStatusTypeSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Sales: Deal Team Members
 */
export const mjBizAppsSalesDealTeamMemberSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    DealID: z.string().describe(`
        * * Field Name: DealID
        * * Display Name: Deal ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deals (vwDeals.ID)`),
    EmployeeID: z.string().nullable().describe(`
        * * Field Name: EmployeeID
        * * Display Name: Employee ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Employees (vwEmployees.ID)
        * * Description: The internal rep, as an MJ Employee. Exactly one of EmployeeID / PersonID is set. Employee is the common case.`),
    PersonID: z.string().nullable().describe(`
        * * Field Name: PersonID
        * * Display Name: Person ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Common: People (vwPeople.ID)
        * * Description: A NON-EMPLOYEE team member — a partner rep or contractor — as a common.Person. Exactly one of EmployeeID / PersonID is set (D-6). Needed because Partner Manager is a seeded DealRole and an Employee row cannot express someone outside the company.`),
    DealRoleID: z.string().describe(`
        * * Field Name: DealRoleID
        * * Display Name: Deal Role ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deal Roles (vwDealRoles.ID)`),
    AttributionPct: z.number().nullable().describe(`
        * * Field Name: AttributionPct
        * * Display Name: Attribution Pct
        * * SQL Data Type: decimal(5, 2)
        * * Description: This member's share of the deal for by-rep rollups. When any member of a deal has a value set, the app validates that active members sum to 100. Leave NULL to fall back to owner-role attribution.`),
    StartDate: z.date().nullable().describe(`
        * * Field Name: StartDate
        * * Display Name: Start Date
        * * SQL Data Type: date`),
    EndDate: z.date().nullable().describe(`
        * * Field Name: EndDate
        * * Display Name: End Date
        * * SQL Data Type: date`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1`),
    Notes: z.string().nullable().describe(`
        * * Field Name: Notes
        * * Display Name: Notes
        * * SQL Data Type: nvarchar(MAX)`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Deal: z.string().describe(`
        * * Field Name: Deal
        * * Display Name: Deal
        * * SQL Data Type: nvarchar(500)`),
    Employee: z.string().nullable().describe(`
        * * Field Name: Employee
        * * Display Name: Employee
        * * SQL Data Type: nvarchar(81)`),
    Person: z.string().nullable().describe(`
        * * Field Name: Person
        * * Display Name: Person
        * * SQL Data Type: nvarchar(201)`),
    DealRole: z.string().describe(`
        * * Field Name: DealRole
        * * Display Name: Deal Role
        * * SQL Data Type: nvarchar(200)`),
});

export type mjBizAppsSalesDealTeamMemberEntityType = z.infer<typeof mjBizAppsSalesDealTeamMemberSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Sales: Deal Types
 */
export const mjBizAppsSalesDealTypeSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Code
        * * SQL Data Type: nvarchar(40)`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)`),
    RequiresContract: z.boolean().describe(`
        * * Field Name: RequiresContract
        * * Display Name: Requires Contract
        * * SQL Data Type: bit
        * * Default Value: 0`),
    RequiresRenewalSource: z.boolean().describe(`
        * * Field Name: RequiresRenewalSource
        * * Display Name: Requires Renewal Source
        * * SQL Data Type: bit
        * * Default Value: 0`),
    DefaultPipelineID: z.string().nullable().describe(`
        * * Field Name: DefaultPipelineID
        * * Display Name: Default Pipeline ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Pipelines (vwPipelines.ID)`),
    DisplayRank: z.number().describe(`
        * * Field Name: DisplayRank
        * * Display Name: Display Rank
        * * SQL Data Type: int
        * * Default Value: 0`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    DefaultPipeline: z.string().nullable().describe(`
        * * Field Name: DefaultPipeline
        * * Display Name: Default Pipeline
        * * SQL Data Type: nvarchar(200)`),
});

export type mjBizAppsSalesDealTypeEntityType = z.infer<typeof mjBizAppsSalesDealTypeSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Sales: Deals
 */
export const mjBizAppsSalesDealSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    DealNumber: z.string().nullable().describe(`
        * * Field Name: DealNumber
        * * Display Name: Deal Number
        * * SQL Data Type: nvarchar(50)`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(500)`),
    PipelineID: z.string().describe(`
        * * Field Name: PipelineID
        * * Display Name: Pipeline ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Pipelines (vwPipelines.ID)`),
    PipelineStageID: z.string().nullable().describe(`
        * * Field Name: PipelineStageID
        * * Display Name: Pipeline Stage ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Pipeline Stages (vwPipelineStages.ID)`),
    DealTypeID: z.string().nullable().describe(`
        * * Field Name: DealTypeID
        * * Display Name: Deal Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deal Types (vwDealTypes.ID)`),
    DealStatusTypeID: z.string().nullable().describe(`
        * * Field Name: DealStatusTypeID
        * * Display Name: Deal Status Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deal Status Types (vwDealStatusTypes.ID)`),
    AccountID: z.string().nullable().describe(`
        * * Field Name: AccountID
        * * Display Name: Account ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Sales Accounts (vwSalesAccounts.ID)`),
    PrimaryContactID: z.string().nullable().describe(`
        * * Field Name: PrimaryContactID
        * * Display Name: Primary Contact ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Sales Contacts (vwSalesContacts.ID)`),
    BillingContactID: z.string().nullable().describe(`
        * * Field Name: BillingContactID
        * * Display Name: Billing Contact ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Sales Contacts (vwSalesContacts.ID)
        * * Description: The contact who receives the invoice, which is routinely NOT the person negotiating. NULL means the billing contact IS the primary contact — a real default, not "unknown" — so an AD never types the same name twice and changing the primary contact leaves no stale billing copy.`),
    CompanyID: z.string().describe(`
        * * Field Name: CompanyID
        * * Display Name: Company ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
        * * Description: The SELLING company. Must match Pipeline.CompanyID; enforced by the entity server, since a CHECK cannot reach across the FK to compare them. FK to __mj.Company.`),
    OwnerEmployeeID: z.string().nullable().describe(`
        * * Field Name: OwnerEmployeeID
        * * Display Name: Owner Employee ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Employees (vwEmployees.ID)
        * * Description: DENORMALIZED, SERVER-MAINTAINED. The Employee holding the role where DealRole.IsOwnerRole = 1, written by DealEntityServer.Save() whenever team membership changes. DealTeamMember is the source of truth; this exists so "my deals" and per-rep boards need no join. NEVER SET THIS DIRECTLY — it will diverge.`),
    Amount: z.number().nullable().describe(`
        * * Field Name: Amount
        * * Display Name: Amount
        * * SQL Data Type: decimal(19, 4)
        * * Description: The deal value. A CACHED ANSWER returned by Orders.PreviewOrder for this deal's line set — NOT computed here. For a simple (header-only) deal it is hand-entered and AmountIsComputed is 0. Never sum DealLine rows into this column; sales does no arithmetic.`),
    AmountIsComputed: z.boolean().describe(`
        * * Field Name: AmountIsComputed
        * * Display Name: Amount Is Computed
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: 1 when Amount came from Orders.PreviewOrder; 0 when a human typed it (a simple, header-only deal). Distinguishes a traceable figure from a stated one.`),
    AmountComputedAt: z.date().nullable().describe(`
        * * Field Name: AmountComputedAt
        * * Display Name: Amount Computed At
        * * SQL Data Type: datetimeoffset`),
    AmountSourceHash: z.string().nullable().describe(`
        * * Field Name: AmountSourceHash
        * * Display Name: Amount Source Hash
        * * SQL Data Type: nvarchar(128)
        * * Description: Fingerprint of the DealLine set Amount was computed from. Compare it against the current lines to detect a STALE amount, so the UI can say "this figure is stale, reprice" instead of showing a number nobody can trace. Without this column Amount becomes a hand-edited field within a month.`),
    CurrencyID: z.string().nullable().describe(`
        * * Field Name: CurrencyID
        * * Display Name: Currency ID
        * * SQL Data Type: uniqueidentifier`),
    MRR: z.number().nullable().describe(`
        * * Field Name: MRR
        * * Display Name: Mrr
        * * SQL Data Type: decimal(19, 4)`),
    ARR: z.number().nullable().describe(`
        * * Field Name: ARR
        * * Display Name: Arr
        * * SQL Data Type: decimal(19, 4)`),
    TermMonths: z.number().nullable().describe(`
        * * Field Name: TermMonths
        * * Display Name: Term Months
        * * SQL Data Type: int`),
    EstimatedProjectWeeks: z.number().nullable().describe(`
        * * Field Name: EstimatedProjectWeeks
        * * Display Name: Estimated Project Weeks
        * * SQL Data Type: int
        * * Description: Estimated project timeline in WEEKS, from the SOW template. A separate column from TermMonths on purpose: a subscription term is a COMMITMENT that drives renewal dates and escalation, a project estimate is a FORECAST that drives neither. One column plus a unit flag would force every consumer to branch on the unit before using the number.`),
    ExecutionDate: z.date().nullable().describe(`
        * * Field Name: ExecutionDate
        * * Display Name: Execution Date
        * * SQL Data Type: date
        * * Description: The date the agreement was signed. Deliberately NOT constrained against StartDate: work that begins before signature is common and legitimate, so ordering the two would reject real deals.`),
    StartDate: z.date().nullable().describe(`
        * * Field Name: StartDate
        * * Display Name: Start Date
        * * SQL Data Type: date
        * * Description: The date service or the subscription actually begins (order-form / SOW start). May precede ExecutionDate for backdated work — see that column.`),
    ExpectedCloseDate: z.date().nullable().describe(`
        * * Field Name: ExpectedCloseDate
        * * Display Name: Expected Close Date
        * * SQL Data Type: date`),
    ActualCloseDate: z.date().nullable().describe(`
        * * Field Name: ActualCloseDate
        * * Display Name: Actual Close Date
        * * SQL Data Type: date`),
    Probability: z.number().nullable().describe(`
        * * Field Name: Probability
        * * Display Name: Probability
        * * SQL Data Type: decimal(5, 2)`),
    ForecastCategoryTypeID: z.string().nullable().describe(`
        * * Field Name: ForecastCategoryTypeID
        * * Display Name: Forecast Category Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Forecast Category Types (vwForecastCategoryTypes.ID)`),
    LossReasonID: z.string().nullable().describe(`
        * * Field Name: LossReasonID
        * * Display Name: Loss Reason ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Loss Reasons (vwLossReasons.ID)`),
    LossNotes: z.string().nullable().describe(`
        * * Field Name: LossNotes
        * * Display Name: Loss Notes
        * * SQL Data Type: nvarchar(MAX)`),
    LeadSourceTypeID: z.string().nullable().describe(`
        * * Field Name: LeadSourceTypeID
        * * Display Name: Lead Source Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Lead Source Types (vwLeadSourceTypes.ID)`),
    CampaignID: z.string().nullable().describe(`
        * * Field Name: CampaignID
        * * Display Name: Campaign ID
        * * SQL Data Type: uniqueidentifier`),
    ContractID: z.string().nullable().describe(`
        * * Field Name: ContractID
        * * Display Name: Contract ID
        * * SQL Data Type: uniqueidentifier
        * * Description: SOFT reference (no FK) to a bizapps-contracts Contract. The link points DOWN the dependency graph; there is deliberately no Contract.DealID, because it is ONE contract to MANY deals — the original sale, every renewal, every expansion.`),
    RenewsContractID: z.string().nullable().describe(`
        * * Field Name: RenewsContractID
        * * Display Name: Renews Contract ID
        * * SQL Data Type: uniqueidentifier
        * * Description: SOFT reference (no FK) to the contract this deal RENEWS. What makes the renewal chain navigable from the sales side without contracts knowing anything about it. Required when DealType.RequiresRenewalSource is set.`),
    AutoRenew: z.boolean().describe(`
        * * Field Name: AutoRenew
        * * Display Name: Auto Renew
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: Whether the resulting agreement renews automatically at the end of its term.`),
    AnnualIncreasePctOverride: z.number().nullable().describe(`
        * * Field Name: AnnualIncreasePctOverride
        * * Display Name: Annual Increase Pct Override
        * * SQL Data Type: decimal(5, 2)
        * * Description: An OVERRIDE, and NULL is meaningful: it means "use the standard annual increase", whose default (5%) lives on the contracts ContractType, not here. That is a different fact from "we negotiated a number that happens to equal today's standard", and only the NULL survives a later change to policy. Copying the default in at write time would freeze this year's terms into next year's renewals silently.`),
    CancellationNoticeDaysOverride: z.number().nullable().describe(`
        * * Field Name: CancellationNoticeDaysOverride
        * * Display Name: Cancellation Notice Days Override
        * * SQL Data Type: int
        * * Description: An OVERRIDE of the standard cancellation-notice period (default 90 days, owned by the contracts ContractType). NULL means "use the standard" — see AnnualIncreasePctOverride for why that distinction is load-bearing.`),
    PaymentMethod: z.string().nullable().describe(`
        * * Field Name: PaymentMethod
        * * Display Name: Payment Method
        * * SQL Data Type: nvarchar(50)
        * * Default Value: ACH
        * * Description: PLACEHOLDER LABEL (default ACH), and a string only for as long as nothing branches on it. Payment method becomes vocabulary the moment code cares — ACH and card differ in settlement timing and fees — but ORDERS owns that concept and will expose PaymentType. Pointing at orders' vocabulary later beats standing up a competing copy here and reconciling two. No code may branch on this value.`),
    ContractVariances: z.string().nullable().describe(`
        * * Field Name: ContractVariances
        * * Display Name: Contract Variances
        * * SQL Data Type: nvarchar(MAX)
        * * Description: Free-text summary of what this deal negotiated AWAY from standard terms — the red-line list, in the AD's own words. The input to a human legal review; nothing should attempt to parse it.`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)`),
    NextStep: z.string().nullable().describe(`
        * * Field Name: NextStep
        * * Display Name: Next Step
        * * SQL Data Type: nvarchar(1000)`),
    NextStepDate: z.date().nullable().describe(`
        * * Field Name: NextStepDate
        * * Display Name: Next Step Date
        * * SQL Data Type: date`),
    ClosedAt: z.date().nullable().describe(`
        * * Field Name: ClosedAt
        * * Display Name: Closed At
        * * SQL Data Type: datetimeoffset`),
    ClosedByUserID: z.string().nullable().describe(`
        * * Field Name: ClosedByUserID
        * * Display Name: Closed By User ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Pipeline: z.string().describe(`
        * * Field Name: Pipeline
        * * Display Name: Pipeline
        * * SQL Data Type: nvarchar(200)`),
    PipelineStage: z.string().nullable().describe(`
        * * Field Name: PipelineStage
        * * Display Name: Pipeline Stage
        * * SQL Data Type: nvarchar(200)`),
    DealType: z.string().nullable().describe(`
        * * Field Name: DealType
        * * Display Name: Deal Type
        * * SQL Data Type: nvarchar(200)`),
    DealStatusType: z.string().nullable().describe(`
        * * Field Name: DealStatusType
        * * Display Name: Deal Status Type
        * * SQL Data Type: nvarchar(200)`),
    Company: z.string().describe(`
        * * Field Name: Company
        * * Display Name: Company
        * * SQL Data Type: nvarchar(50)`),
    OwnerEmployee: z.string().nullable().describe(`
        * * Field Name: OwnerEmployee
        * * Display Name: Owner Employee
        * * SQL Data Type: nvarchar(81)`),
    ForecastCategoryType: z.string().nullable().describe(`
        * * Field Name: ForecastCategoryType
        * * Display Name: Forecast Category Type
        * * SQL Data Type: nvarchar(200)`),
    LossReason: z.string().nullable().describe(`
        * * Field Name: LossReason
        * * Display Name: Loss Reason
        * * SQL Data Type: nvarchar(200)`),
    LeadSourceType: z.string().nullable().describe(`
        * * Field Name: LeadSourceType
        * * Display Name: Lead Source Type
        * * SQL Data Type: nvarchar(200)`),
    ClosedByUser: z.string().nullable().describe(`
        * * Field Name: ClosedByUser
        * * Display Name: Closed By User
        * * SQL Data Type: nvarchar(100)`),
});

export type mjBizAppsSalesDealEntityType = z.infer<typeof mjBizAppsSalesDealSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Sales: Forecast Category Types
 */
export const mjBizAppsSalesForecastCategoryTypeSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Code
        * * SQL Data Type: nvarchar(40)`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)`),
    IncludeInCommit: z.boolean().describe(`
        * * Field Name: IncludeInCommit
        * * Display Name: Include In Commit
        * * SQL Data Type: bit
        * * Default Value: 0`),
    IncludeInBestCase: z.boolean().describe(`
        * * Field Name: IncludeInBestCase
        * * Display Name: Include In Best Case
        * * SQL Data Type: bit
        * * Default Value: 0`),
    IncludeInPipeline: z.boolean().describe(`
        * * Field Name: IncludeInPipeline
        * * Display Name: Include In Pipeline
        * * SQL Data Type: bit
        * * Default Value: 0`),
    DisplayRank: z.number().describe(`
        * * Field Name: DisplayRank
        * * Display Name: Display Rank
        * * SQL Data Type: int
        * * Default Value: 0`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
});

export type mjBizAppsSalesForecastCategoryTypeEntityType = z.infer<typeof mjBizAppsSalesForecastCategoryTypeSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Sales: Forecast Snapshots
 */
export const mjBizAppsSalesForecastSnapshotSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    CompanyID: z.string().describe(`
        * * Field Name: CompanyID
        * * Display Name: Company ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)`),
    PipelineID: z.string().nullable().describe(`
        * * Field Name: PipelineID
        * * Display Name: Pipeline ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Pipelines (vwPipelines.ID)`),
    OwnerEmployeeID: z.string().nullable().describe(`
        * * Field Name: OwnerEmployeeID
        * * Display Name: Owner Employee ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Employees (vwEmployees.ID)`),
    PeriodStart: z.date().describe(`
        * * Field Name: PeriodStart
        * * Display Name: Period Start
        * * SQL Data Type: date`),
    PeriodEnd: z.date().describe(`
        * * Field Name: PeriodEnd
        * * Display Name: Period End
        * * SQL Data Type: date`),
    CapturedAt: z.date().describe(`
        * * Field Name: CapturedAt
        * * Display Name: Captured At
        * * SQL Data Type: datetimeoffset
        * * Default Value: sysutcdatetime()`),
    CommitAmount: z.number().nullable().describe(`
        * * Field Name: CommitAmount
        * * Display Name: Commit Amount
        * * SQL Data Type: decimal(19, 4)
        * * Description: Total of deals in forecast categories flagged IncludeInCommit as at CapturedAt. Named CommitAmount rather than the plan's Commit because COMMIT is a reserved word in both T-SQL and PostgreSQL, and production is PostgreSQL.`),
    BestCaseAmount: z.number().nullable().describe(`
        * * Field Name: BestCaseAmount
        * * Display Name: Best Case Amount
        * * SQL Data Type: decimal(19, 4)`),
    PipelineAmount: z.number().nullable().describe(`
        * * Field Name: PipelineAmount
        * * Display Name: Pipeline Amount
        * * SQL Data Type: decimal(19, 4)`),
    ClosedAmount: z.number().nullable().describe(`
        * * Field Name: ClosedAmount
        * * Display Name: Closed Amount
        * * SQL Data Type: decimal(19, 4)`),
    SnapshotJSON: z.string().nullable().describe(`
        * * Field Name: SnapshotJSON
        * * Display Name: Snapshot JSON
        * * SQL Data Type: nvarchar(MAX)
        * * Description: The full breakdown behind the four bucket totals, so a snapshot can be interrogated rather than merely displayed.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Company: z.string().describe(`
        * * Field Name: Company
        * * Display Name: Company
        * * SQL Data Type: nvarchar(50)`),
    Pipeline: z.string().nullable().describe(`
        * * Field Name: Pipeline
        * * Display Name: Pipeline
        * * SQL Data Type: nvarchar(200)`),
    OwnerEmployee: z.string().nullable().describe(`
        * * Field Name: OwnerEmployee
        * * Display Name: Owner Employee
        * * SQL Data Type: nvarchar(81)`),
});

export type mjBizAppsSalesForecastSnapshotEntityType = z.infer<typeof mjBizAppsSalesForecastSnapshotSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Sales: Lead Source Types
 */
export const mjBizAppsSalesLeadSourceTypeSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Code
        * * SQL Data Type: nvarchar(40)`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)`),
    IsInbound: z.boolean().describe(`
        * * Field Name: IsInbound
        * * Display Name: Is Inbound
        * * SQL Data Type: bit
        * * Default Value: 0`),
    IsPaid: z.boolean().describe(`
        * * Field Name: IsPaid
        * * Display Name: Is Paid
        * * SQL Data Type: bit
        * * Default Value: 0`),
    AttributionWindowDays: z.number().nullable().describe(`
        * * Field Name: AttributionWindowDays
        * * Display Name: Attribution Window Days
        * * SQL Data Type: int`),
    DisplayRank: z.number().describe(`
        * * Field Name: DisplayRank
        * * Display Name: Display Rank
        * * SQL Data Type: int
        * * Default Value: 0`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
});

export type mjBizAppsSalesLeadSourceTypeEntityType = z.infer<typeof mjBizAppsSalesLeadSourceTypeSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Sales: Lifecycle Stage Types
 */
export const mjBizAppsSalesLifecycleStageTypeSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Code
        * * SQL Data Type: nvarchar(40)`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)`),
    IsMarketingQualified: z.boolean().describe(`
        * * Field Name: IsMarketingQualified
        * * Display Name: Is Marketing Qualified
        * * SQL Data Type: bit
        * * Default Value: 0`),
    IsSalesQualified: z.boolean().describe(`
        * * Field Name: IsSalesQualified
        * * Display Name: Is Sales Qualified
        * * SQL Data Type: bit
        * * Default Value: 0`),
    IsCustomer: z.boolean().describe(`
        * * Field Name: IsCustomer
        * * Display Name: Is Customer
        * * SQL Data Type: bit
        * * Default Value: 0`),
    DisplayRank: z.number().describe(`
        * * Field Name: DisplayRank
        * * Display Name: Display Rank
        * * SQL Data Type: int
        * * Default Value: 0`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
});

export type mjBizAppsSalesLifecycleStageTypeEntityType = z.infer<typeof mjBizAppsSalesLifecycleStageTypeSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Sales: Loss Reasons
 */
export const mjBizAppsSalesLossReasonSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Code
        * * SQL Data Type: nvarchar(40)`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)`),
    Category: z.string().nullable().describe(`
        * * Field Name: Category
        * * Display Name: Category
        * * SQL Data Type: nvarchar(100)`),
    RequiresNotes: z.boolean().describe(`
        * * Field Name: RequiresNotes
        * * Display Name: Requires Notes
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: When 1, Sales.CloseDeal refuses a close against this reason unless Deal.LossNotes is supplied.`),
    IsCompetitive: z.boolean().describe(`
        * * Field Name: IsCompetitive
        * * Display Name: Is Competitive
        * * SQL Data Type: bit
        * * Default Value: 0`),
    DisplayRank: z.number().describe(`
        * * Field Name: DisplayRank
        * * Display Name: Display Rank
        * * SQL Data Type: int
        * * Default Value: 0`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
});

export type mjBizAppsSalesLossReasonEntityType = z.infer<typeof mjBizAppsSalesLossReasonSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Sales: Pipeline Stages
 */
export const mjBizAppsSalesPipelineStageSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    PipelineID: z.string().describe(`
        * * Field Name: PipelineID
        * * Display Name: Pipeline ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Pipelines (vwPipelines.ID)`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Code
        * * SQL Data Type: nvarchar(40)`),
    DisplayOrder: z.number().describe(`
        * * Field Name: DisplayOrder
        * * Display Name: Display Order
        * * SQL Data Type: int
        * * Default Value: 0`),
    Probability: z.number().nullable().describe(`
        * * Field Name: Probability
        * * Display Name: Probability
        * * SQL Data Type: decimal(5, 2)`),
    ForecastCategoryTypeID: z.string().nullable().describe(`
        * * Field Name: ForecastCategoryTypeID
        * * Display Name: Forecast Category Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Forecast Category Types (vwForecastCategoryTypes.ID)`),
    DealStatusTypeID: z.string().nullable().describe(`
        * * Field Name: DealStatusTypeID
        * * Display Name: Deal Status Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deal Status Types (vwDealStatusTypes.ID)
        * * Description: The status a deal takes on when it ENTERS this stage. The stage names the vocabulary; the status carries the behaviour flags.`),
    RottingDays: z.number().nullable().describe(`
        * * Field Name: RottingDays
        * * Display Name: Rotting Days
        * * SQL Data Type: int
        * * Description: Days without activity before the board flags a deal in this stage as rotting.`),
    EntryCriteria: z.string().nullable().describe(`
        * * Field Name: EntryCriteria
        * * Display Name: Entry Criteria
        * * SQL Data Type: nvarchar(MAX)`),
    ExitCriteria: z.string().nullable().describe(`
        * * Field Name: ExitCriteria
        * * Display Name: Exit Criteria
        * * SQL Data Type: nvarchar(MAX)
        * * Description: Declarative JSON predicate evaluated SERVER-SIDE before a deal may leave this stage. A stage that cannot be exited without a signed mutual action plan is a config row, not a code branch.`),
    RequiredFields: z.string().nullable().describe(`
        * * Field Name: RequiredFields
        * * Display Name: Required Fields
        * * SQL Data Type: nvarchar(MAX)`),
    GuidanceMarkdown: z.string().nullable().describe(`
        * * Field Name: GuidanceMarkdown
        * * Display Name: Guidance Markdown
        * * SQL Data Type: nvarchar(MAX)
        * * Description: "What good looks like at this stage", shown in the deal workspace. Sales enablement as a config field.`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Pipeline: z.string().describe(`
        * * Field Name: Pipeline
        * * Display Name: Pipeline
        * * SQL Data Type: nvarchar(200)`),
    ForecastCategoryType: z.string().nullable().describe(`
        * * Field Name: ForecastCategoryType
        * * Display Name: Forecast Category Type
        * * SQL Data Type: nvarchar(200)`),
    DealStatusType: z.string().nullable().describe(`
        * * Field Name: DealStatusType
        * * Display Name: Deal Status Type
        * * SQL Data Type: nvarchar(200)`),
});

export type mjBizAppsSalesPipelineStageEntityType = z.infer<typeof mjBizAppsSalesPipelineStageSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Sales: Pipelines
 */
export const mjBizAppsSalesPipelineSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    CompanyID: z.string().describe(`
        * * Field Name: CompanyID
        * * Display Name: Company ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
        * * Description: The owning company. NOT NULL by design — this is what makes every forecast and bookings rollup sliceable by company for free, and every deal inherits it. FK to __mj.Company.`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Code
        * * SQL Data Type: nvarchar(40)
        * * Description: Stable identifier, unique PER COMPANY rather than globally: two operating companies may each run a pipeline they both call NEWBIZ.`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)`),
    DealTypeID: z.string().nullable().describe(`
        * * Field Name: DealTypeID
        * * Display Name: Deal Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deal Types (vwDealTypes.ID)`),
    DefaultForecastCategoryTypeID: z.string().nullable().describe(`
        * * Field Name: DefaultForecastCategoryTypeID
        * * Display Name: Default Forecast Category Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Forecast Category Types (vwForecastCategoryTypes.ID)`),
    RequiresDealLines: z.boolean().describe(`
        * * Field Name: RequiresDealLines
        * * Display Name: Requires Deal Lines
        * * SQL Data Type: bit
        * * Default Value: 1
        * * Description: Pipeline-level default for whether deals carry catalog lines (priced mode) or are header-only with a hand-entered Amount (simple mode). Overridable per deal. Partner-referral and sponsorship pipelines may never carry lines.`),
    CloseWonPolicy: z.string().nullable().describe(`
        * * Field Name: CloseWonPolicy
        * * Display Name: Close Won Policy
        * * SQL Data Type: nvarchar(MAX)
        * * Description: JSON declaring the DEFAULT outcome of winning a deal in this pipeline: whether to create a contract, which contract type, where subscription lines go, where one-time lines go, and what state the resulting order lands in. A deal may override it; one remote operation (Sales.CloseDeal) reads and executes it. JSON rather than columns because the policy shape is still being learned.`),
    IsDefault: z.boolean().describe(`
        * * Field Name: IsDefault
        * * Display Name: Is Default
        * * SQL Data Type: bit
        * * Default Value: 0`),
    DisplayRank: z.number().describe(`
        * * Field Name: DisplayRank
        * * Display Name: Display Rank
        * * SQL Data Type: int
        * * Default Value: 0`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Company: z.string().describe(`
        * * Field Name: Company
        * * Display Name: Company
        * * SQL Data Type: nvarchar(50)`),
    DealType: z.string().nullable().describe(`
        * * Field Name: DealType
        * * Display Name: Deal Type
        * * SQL Data Type: nvarchar(200)`),
    DefaultForecastCategoryType: z.string().nullable().describe(`
        * * Field Name: DefaultForecastCategoryType
        * * Display Name: Default Forecast Category Type
        * * SQL Data Type: nvarchar(200)`),
});

export type mjBizAppsSalesPipelineEntityType = z.infer<typeof mjBizAppsSalesPipelineSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Sales: Sales Accounts
 */
export const mjBizAppsSalesSalesAccountSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Common: Organizations (vwOrganizations.ID)
        * * Description: Same value as the parent __mj_BizAppsCommon.Organization.ID. The primary key IS the foreign key; this is not a separate surrogate identity.`),
    OwnerEmployeeID: z.string().nullable().describe(`
        * * Field Name: OwnerEmployeeID
        * * Display Name: Owner Employee ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Employees (vwEmployees.ID)`),
    AccountTypeID: z.string().nullable().describe(`
        * * Field Name: AccountTypeID
        * * Display Name: Account Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Account Types (vwAccountTypes.ID)`),
    LifecycleStageTypeID: z.string().nullable().describe(`
        * * Field Name: LifecycleStageTypeID
        * * Display Name: Lifecycle Stage Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Lifecycle Stage Types (vwLifecycleStageTypes.ID)`),
    LeadSourceTypeID: z.string().nullable().describe(`
        * * Field Name: LeadSourceTypeID
        * * Display Name: Lead Source Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Lead Source Types (vwLeadSourceTypes.ID)`),
    Territory: z.string().nullable().describe(`
        * * Field Name: Territory
        * * Display Name: Territory
        * * SQL Data Type: nvarchar(100)
        * * Description: A LABEL, not a routing engine. Territory assignment as a rules engine is a product in its own right and is on the not-doing list.`),
    Tier: z.string().nullable().describe(`
        * * Field Name: Tier
        * * Display Name: Tier
        * * SQL Data Type: nvarchar(50)`),
    ICPFitScore: z.number().nullable().describe(`
        * * Field Name: ICPFitScore
        * * Display Name: ICP Fit Score
        * * SQL Data Type: int`),
    IndustryCode: z.string().nullable().describe(`
        * * Field Name: IndustryCode
        * * Display Name: Industry Code
        * * SQL Data Type: nvarchar(50)`),
    EmployeeCountBand: z.string().nullable().describe(`
        * * Field Name: EmployeeCountBand
        * * Display Name: Employee Count Band
        * * SQL Data Type: nvarchar(50)
        * * Description: A BAND, not a number, for the same reason as AnnualRevenueBand.`),
    AnnualRevenueBand: z.string().nullable().describe(`
        * * Field Name: AnnualRevenueBand
        * * Display Name: Annual Revenue Band
        * * SQL Data Type: nvarchar(50)
        * * Description: A BAND, not a number ("$1M-$5M"), on purpose. A rep's guess stored as an exact figure is false precision that later gets treated as fact.`),
    HealthStatus: z.string().nullable().describe(`
        * * Field Name: HealthStatus
        * * Display Name: Health Status
        * * SQL Data Type: nvarchar(50)`),
    FirstClosedWonDate: z.date().nullable().describe(`
        * * Field Name: FirstClosedWonDate
        * * Display Name: First Closed Won Date
        * * SQL Data Type: date`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(255)`),
    LegalName: z.string().nullable().describe(`
        * * Field Name: LegalName
        * * Display Name: Legal Name
        * * SQL Data Type: nvarchar(255)`),
    OrganizationTypeID: z.string().nullable().describe(`
        * * Field Name: OrganizationTypeID
        * * Display Name: Organization Type ID
        * * SQL Data Type: uniqueidentifier`),
    ParentID: z.string().nullable().describe(`
        * * Field Name: ParentID
        * * Display Name: Parent ID
        * * SQL Data Type: uniqueidentifier`),
    Website: z.string().nullable().describe(`
        * * Field Name: Website
        * * Display Name: Website
        * * SQL Data Type: nvarchar(1000)`),
    LogoURL: z.string().nullable().describe(`
        * * Field Name: LogoURL
        * * Display Name: Logo URL
        * * SQL Data Type: nvarchar(1000)`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)`),
    Email: z.string().nullable().describe(`
        * * Field Name: Email
        * * Display Name: Email
        * * SQL Data Type: nvarchar(255)`),
    Phone: z.string().nullable().describe(`
        * * Field Name: Phone
        * * Display Name: Phone
        * * SQL Data Type: nvarchar(50)`),
    FoundedDate: z.date().nullable().describe(`
        * * Field Name: FoundedDate
        * * Display Name: Founded Date
        * * SQL Data Type: date`),
    TaxID: z.string().nullable().describe(`
        * * Field Name: TaxID
        * * Display Name: Tax ID
        * * SQL Data Type: nvarchar(50)`),
    Status: z.string().describe(`
        * * Field Name: Status
        * * Display Name: Status
        * * SQL Data Type: nvarchar(50)`),
    OwnerEmployee: z.string().nullable().describe(`
        * * Field Name: OwnerEmployee
        * * Display Name: Owner Employee
        * * SQL Data Type: nvarchar(81)`),
    AccountType: z.string().nullable().describe(`
        * * Field Name: AccountType
        * * Display Name: Account Type
        * * SQL Data Type: nvarchar(200)`),
    LifecycleStageType: z.string().nullable().describe(`
        * * Field Name: LifecycleStageType
        * * Display Name: Lifecycle Stage Type
        * * SQL Data Type: nvarchar(200)`),
    LeadSourceType: z.string().nullable().describe(`
        * * Field Name: LeadSourceType
        * * Display Name: Lead Source Type
        * * SQL Data Type: nvarchar(200)`),
});

export type mjBizAppsSalesSalesAccountEntityType = z.infer<typeof mjBizAppsSalesSalesAccountSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Sales: Sales Contacts
 */
export const mjBizAppsSalesSalesContactSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Common: People (vwPeople.ID)
        * * Description: Same value as the parent __mj_BizAppsCommon.Person.ID. The primary key IS the foreign key.`),
    OwnerEmployeeID: z.string().nullable().describe(`
        * * Field Name: OwnerEmployeeID
        * * Display Name: Owner Employee ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Employees (vwEmployees.ID)`),
    LifecycleStageTypeID: z.string().nullable().describe(`
        * * Field Name: LifecycleStageTypeID
        * * Display Name: Lifecycle Stage Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Lifecycle Stage Types (vwLifecycleStageTypes.ID)`),
    BuyingRoleTypeID: z.string().nullable().describe(`
        * * Field Name: BuyingRoleTypeID
        * * Display Name: Buying Role Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Buying Role Types (vwBuyingRoleTypes.ID)
        * * Description: The contact's DEFAULT buying role. The role that matters per-deal lives on DealContactRole, because one contact holds different roles on different deals.`),
    LeadSourceTypeID: z.string().nullable().describe(`
        * * Field Name: LeadSourceTypeID
        * * Display Name: Lead Source Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Lead Source Types (vwLeadSourceTypes.ID)`),
    Seniority: z.string().nullable().describe(`
        * * Field Name: Seniority
        * * Display Name: Seniority
        * * SQL Data Type: nvarchar(50)`),
    OptedOutOfOutreach: z.boolean().describe(`
        * * Field Name: OptedOutOfOutreach
        * * Display Name: Opted Out Of Outreach
        * * SQL Data Type: bit
        * * Default Value: 0`),
    DoNotContactReason: z.string().nullable().describe(`
        * * Field Name: DoNotContactReason
        * * Display Name: Do Not Contact Reason
        * * SQL Data Type: nvarchar(500)`),
    LastEngagedAt: z.date().nullable().describe(`
        * * Field Name: LastEngagedAt
        * * Display Name: Last Engaged At
        * * SQL Data Type: datetimeoffset`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    FirstName: z.string().describe(`
        * * Field Name: FirstName
        * * Display Name: First Name
        * * SQL Data Type: nvarchar(100)`),
    LastName: z.string().describe(`
        * * Field Name: LastName
        * * Display Name: Last Name
        * * SQL Data Type: nvarchar(100)`),
    MiddleName: z.string().nullable().describe(`
        * * Field Name: MiddleName
        * * Display Name: Middle Name
        * * SQL Data Type: nvarchar(100)`),
    Prefix: z.string().nullable().describe(`
        * * Field Name: Prefix
        * * Display Name: Prefix
        * * SQL Data Type: nvarchar(20)`),
    Suffix: z.string().nullable().describe(`
        * * Field Name: Suffix
        * * Display Name: Suffix
        * * SQL Data Type: nvarchar(20)`),
    PreferredName: z.string().nullable().describe(`
        * * Field Name: PreferredName
        * * Display Name: Preferred Name
        * * SQL Data Type: nvarchar(100)`),
    Title: z.string().nullable().describe(`
        * * Field Name: Title
        * * Display Name: Title
        * * SQL Data Type: nvarchar(200)`),
    Email: z.string().nullable().describe(`
        * * Field Name: Email
        * * Display Name: Email
        * * SQL Data Type: nvarchar(255)`),
    Phone: z.string().nullable().describe(`
        * * Field Name: Phone
        * * Display Name: Phone
        * * SQL Data Type: nvarchar(50)`),
    DateOfBirth: z.date().nullable().describe(`
        * * Field Name: DateOfBirth
        * * Display Name: Date Of Birth
        * * SQL Data Type: date`),
    Gender: z.string().nullable().describe(`
        * * Field Name: Gender
        * * Display Name: Gender
        * * SQL Data Type: nvarchar(50)`),
    PhotoURL: z.string().nullable().describe(`
        * * Field Name: PhotoURL
        * * Display Name: Photo URL
        * * SQL Data Type: nvarchar(1000)`),
    Bio: z.string().nullable().describe(`
        * * Field Name: Bio
        * * Display Name: Bio
        * * SQL Data Type: nvarchar(MAX)`),
    LinkedUserID: z.string().nullable().describe(`
        * * Field Name: LinkedUserID
        * * Display Name: Linked User ID
        * * SQL Data Type: uniqueidentifier`),
    Status: z.string().describe(`
        * * Field Name: Status
        * * Display Name: Status
        * * SQL Data Type: nvarchar(50)`),
    OwnerEmployee: z.string().nullable().describe(`
        * * Field Name: OwnerEmployee
        * * Display Name: Owner Employee
        * * SQL Data Type: nvarchar(81)`),
    LifecycleStageType: z.string().nullable().describe(`
        * * Field Name: LifecycleStageType
        * * Display Name: Lifecycle Stage Type
        * * SQL Data Type: nvarchar(200)`),
    BuyingRoleType: z.string().nullable().describe(`
        * * Field Name: BuyingRoleType
        * * Display Name: Buying Role Type
        * * SQL Data Type: nvarchar(200)`),
    LeadSourceType: z.string().nullable().describe(`
        * * Field Name: LeadSourceType
        * * Display Name: Lead Source Type
        * * SQL Data Type: nvarchar(200)`),
});

export type mjBizAppsSalesSalesContactEntityType = z.infer<typeof mjBizAppsSalesSalesContactSchema>;
 
 

/**
 * MJ_BizApps_Sales: Account Types - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: AccountType
 * * Base View: vwAccountTypes
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Account Types')
export class mjBizAppsSalesAccountTypeEntity extends BaseEntity<mjBizAppsSalesAccountTypeEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Account Types record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Account Types record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesAccountTypeEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Code
    * * SQL Data Type: nvarchar(40)
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: IsCustomer
    * * Display Name: Is Customer
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get IsCustomer(): boolean {
        return this.Get('IsCustomer');
    }
    set IsCustomer(value: boolean) {
        this.Set('IsCustomer', value);
    }

    /**
    * * Field Name: IsProspect
    * * Display Name: Is Prospect
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get IsProspect(): boolean {
        return this.Get('IsProspect');
    }
    set IsProspect(value: boolean) {
        this.Set('IsProspect', value);
    }

    /**
    * * Field Name: IsPartner
    * * Display Name: Is Partner
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get IsPartner(): boolean {
        return this.Get('IsPartner');
    }
    set IsPartner(value: boolean) {
        this.Set('IsPartner', value);
    }

    /**
    * * Field Name: DisplayRank
    * * Display Name: Display Rank
    * * SQL Data Type: int
    * * Default Value: 0
    */
    get DisplayRank(): number {
        return this.Get('DisplayRank');
    }
    set DisplayRank(value: number) {
        this.Set('DisplayRank', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }
}


/**
 * MJ_BizApps_Sales: Buying Role Types - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: BuyingRoleType
 * * Base View: vwBuyingRoleTypes
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Buying Role Types')
export class mjBizAppsSalesBuyingRoleTypeEntity extends BaseEntity<mjBizAppsSalesBuyingRoleTypeEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Buying Role Types record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Buying Role Types record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesBuyingRoleTypeEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Code
    * * SQL Data Type: nvarchar(40)
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: IsDecisionMaker
    * * Display Name: Is Decision Maker
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get IsDecisionMaker(): boolean {
        return this.Get('IsDecisionMaker');
    }
    set IsDecisionMaker(value: boolean) {
        this.Set('IsDecisionMaker', value);
    }

    /**
    * * Field Name: IsBlocker
    * * Display Name: Is Blocker
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get IsBlocker(): boolean {
        return this.Get('IsBlocker');
    }
    set IsBlocker(value: boolean) {
        this.Set('IsBlocker', value);
    }

    /**
    * * Field Name: InfluenceWeight
    * * Display Name: Influence Weight
    * * SQL Data Type: decimal(5, 2)
    */
    get InfluenceWeight(): number | null {
        return this.Get('InfluenceWeight');
    }
    set InfluenceWeight(value: number | null) {
        this.Set('InfluenceWeight', value);
    }

    /**
    * * Field Name: DisplayRank
    * * Display Name: Display Rank
    * * SQL Data Type: int
    * * Default Value: 0
    */
    get DisplayRank(): number {
        return this.Get('DisplayRank');
    }
    set DisplayRank(value: number) {
        this.Set('DisplayRank', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }
}


/**
 * MJ_BizApps_Sales: Deal Contact Roles - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: DealContactRole
 * * Base View: vwDealContactRoles
 * * @description The buying committee on the CUSTOMER side: which contact plays which role on this deal. A junction rather than a field on SalesContact because one contact holds different roles on different deals.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Deal Contact Roles')
export class mjBizAppsSalesDealContactRoleEntity extends BaseEntity<mjBizAppsSalesDealContactRoleEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Deal Contact Roles record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Deal Contact Roles record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesDealContactRoleEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: DealID
    * * Display Name: Deal ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deals (vwDeals.ID)
    */
    get DealID(): string {
        return this.Get('DealID');
    }
    set DealID(value: string) {
        this.Set('DealID', value);
    }

    /**
    * * Field Name: SalesContactID
    * * Display Name: Sales Contact ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Sales Contacts (vwSalesContacts.ID)
    */
    get SalesContactID(): string {
        return this.Get('SalesContactID');
    }
    set SalesContactID(value: string) {
        this.Set('SalesContactID', value);
    }

    /**
    * * Field Name: BuyingRoleTypeID
    * * Display Name: Buying Role Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Buying Role Types (vwBuyingRoleTypes.ID)
    */
    get BuyingRoleTypeID(): string | null {
        return this.Get('BuyingRoleTypeID');
    }
    set BuyingRoleTypeID(value: string | null) {
        this.Set('BuyingRoleTypeID', value);
    }

    /**
    * * Field Name: Influence
    * * Display Name: Influence
    * * SQL Data Type: decimal(5, 2)
    */
    get Influence(): number | null {
        return this.Get('Influence');
    }
    set Influence(value: number | null) {
        this.Set('Influence', value);
    }

    /**
    * * Field Name: Notes
    * * Display Name: Notes
    * * SQL Data Type: nvarchar(MAX)
    */
    get Notes(): string | null {
        return this.Get('Notes');
    }
    set Notes(value: string | null) {
        this.Set('Notes', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Deal
    * * Display Name: Deal
    * * SQL Data Type: nvarchar(500)
    */
    get Deal(): string {
        return this.Get('Deal');
    }

    /**
    * * Field Name: BuyingRoleType
    * * Display Name: Buying Role Type
    * * SQL Data Type: nvarchar(200)
    */
    get BuyingRoleType(): string | null {
        return this.Get('BuyingRoleType');
    }
}


/**
 * MJ_BizApps_Sales: Deal Line Types - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: DealLineType
 * * Base View: vwDealLineTypes
 * * @description Whether a deal line is a ONE-TIME charge or a RECURRING one. A type table rather than a string column because recurring lines are what produce MRR/ARR and a renewal while one-time lines produce neither — so the distinction is behaviour, and behaviour belongs in a flag. IsRecurring is what the engine reads, which is what lets a customer call the concept Subscription or Implementation with no code aware of the rename.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Deal Line Types')
export class mjBizAppsSalesDealLineTypeEntity extends BaseEntity<mjBizAppsSalesDealLineTypeEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Deal Line Types record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Deal Line Types record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesDealLineTypeEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Code
    * * SQL Data Type: nvarchar(40)
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: IsRecurring
    * * Display Name: Is Recurring
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: The behaviour flag. 1 for lines that carry into MRR/ARR and become a renewable subscription; 0 for lines billed once. Branch on this, never on Name or Code.
    */
    get IsRecurring(): boolean {
        return this.Get('IsRecurring');
    }
    set IsRecurring(value: boolean) {
        this.Set('IsRecurring', value);
    }

    /**
    * * Field Name: DisplayRank
    * * Display Name: Display Rank
    * * SQL Data Type: int
    * * Default Value: 0
    */
    get DisplayRank(): number {
        return this.Get('DisplayRank');
    }
    set DisplayRank(value: number) {
        this.Set('DisplayRank', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }
}


/**
 * MJ_BizApps_Sales: Deal Lines - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: DealLine
 * * Base View: vwDealLines
 * * @description A requested line on a deal. Stores INTENT (product, quantity, requested discount, override price, term); the Resolved* columns are WRITE-ONLY from an Orders.PreviewOrder response. Sales never multiplies quantity by price, applies a discount, computes tax, prorates a period, sums a total or rounds anything.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Deal Lines')
export class mjBizAppsSalesDealLineEntity extends BaseEntity<mjBizAppsSalesDealLineEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Deal Lines record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Deal Lines record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesDealLineEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: DealID
    * * Display Name: Deal ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deals (vwDeals.ID)
    */
    get DealID(): string {
        return this.Get('DealID');
    }
    set DealID(value: string) {
        this.Set('DealID', value);
    }

    /**
    * * Field Name: ProductID
    * * Display Name: Product ID
    * * SQL Data Type: uniqueidentifier
    * * Description: SOFT reference (no FK) to a bizapps-orders Product. Soft because orders' migrations may not have run — which is exactly what lets this app stand up independently.
    */
    get ProductID(): string | null {
        return this.Get('ProductID');
    }
    set ProductID(value: string | null) {
        this.Set('ProductID', value);
    }

    /**
    * * Field Name: ProductName
    * * Display Name: Product Name
    * * SQL Data Type: nvarchar(500)
    * * Description: The product/service name AS WRITTEN ON THE SIGNED DOCUMENT — transcription, not a denormalized cache of the catalog name, and never auto-synced from it. Needed twice over: ProductID points at the orders catalog, which is not installed yet, so without this a line is an unreadable GUID; and once orders IS present, renaming a catalog product must not retroactively reword what a customer signed.
    */
    get ProductName(): string | null {
        return this.Get('ProductName');
    }
    set ProductName(value: string | null) {
        this.Set('ProductName', value);
    }

    /**
    * * Field Name: Quantity
    * * Display Name: Quantity
    * * SQL Data Type: decimal(19, 4)
    * * Default Value: 1
    */
    get Quantity(): number {
        return this.Get('Quantity');
    }
    set Quantity(value: number) {
        this.Set('Quantity', value);
    }

    /**
    * * Field Name: RequestedDiscountPct
    * * Display Name: Requested Discount Pct
    * * SQL Data Type: decimal(5, 2)
    */
    get RequestedDiscountPct(): number | null {
        return this.Get('RequestedDiscountPct');
    }
    set RequestedDiscountPct(value: number | null) {
        this.Set('RequestedDiscountPct', value);
    }

    /**
    * * Field Name: OverrideUnitPrice
    * * Display Name: Override Unit Price
    * * SQL Data Type: decimal(19, 4)
    * * Description: A negotiated unit price. An INPUT to the pricing engine, never a replacement for it — the line still goes through Orders.PreviewOrder.
    */
    get OverrideUnitPrice(): number | null {
        return this.Get('OverrideUnitPrice');
    }
    set OverrideUnitPrice(value: number | null) {
        this.Set('OverrideUnitPrice', value);
    }

    /**
    * * Field Name: TermMonths
    * * Display Name: Term Months
    * * SQL Data Type: int
    */
    get TermMonths(): number | null {
        return this.Get('TermMonths');
    }
    set TermMonths(value: number | null) {
        this.Set('TermMonths', value);
    }

    /**
    * * Field Name: ServicePeriodStart
    * * Display Name: Service Period Start
    * * SQL Data Type: date
    */
    get ServicePeriodStart(): Date | null {
        return this.Get('ServicePeriodStart');
    }
    set ServicePeriodStart(value: Date | null) {
        this.Set('ServicePeriodStart', value);
    }

    /**
    * * Field Name: ServicePeriodEnd
    * * Display Name: Service Period End
    * * SQL Data Type: date
    */
    get ServicePeriodEnd(): Date | null {
        return this.Get('ServicePeriodEnd');
    }
    set ServicePeriodEnd(value: Date | null) {
        this.Set('ServicePeriodEnd', value);
    }

    /**
    * * Field Name: DealLineTypeID
    * * Display Name: Deal Line Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deal Line Types (vwDealLineTypes.ID)
    * * Description: Whether this line is a one-time charge or a recurring one. A FK to DealLineType, replacing what was a free-text LineType column: recurring lines are what produce MRR/ARR and a renewal, and the moment code needs to tell them apart a string forces exactly the name comparison the vocabulary rule forbids. Branch on DealLineType.IsRecurring, never on the name.
    */
    get DealLineTypeID(): string | null {
        return this.Get('DealLineTypeID');
    }
    set DealLineTypeID(value: string | null) {
        this.Set('DealLineTypeID', value);
    }

    /**
    * * Field Name: DisplayOrder
    * * Display Name: Display Order
    * * SQL Data Type: int
    * * Default Value: 0
    */
    get DisplayOrder(): number {
        return this.Get('DisplayOrder');
    }
    set DisplayOrder(value: number) {
        this.Set('DisplayOrder', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: AnnualGrossFees
    * * Display Name: Annual Gross Fees
    * * SQL Data Type: decimal(19, 4)
    * * Description: Annual gross fees for this line AS WRITTEN ON THE SIGNED DOCUMENT. An INPUT the AD transcribes, not a figure this app derives. Once orders is wired in, Orders.PreviewOrder's answer lands in the Resolved* columns and becomes the authority on what the deal is worth; this remains the record of what was signed.
    */
    get AnnualGrossFees(): number | null {
        return this.Get('AnnualGrossFees');
    }
    set AnnualGrossFees(value: number | null) {
        this.Set('AnnualGrossFees', value);
    }

    /**
    * * Field Name: DiscountAmount
    * * Display Name: Discount Amount
    * * SQL Data Type: decimal(19, 4)
    * * Description: The discount as a CURRENCY AMOUNT, as the order form expresses it. Coexists with RequestedDiscountPct deliberately — the template speaks in amounts, the pricing engine takes a percent — and there is no exactly-one-of constraint, because a deal can legitimately carry a negotiated percentage as engine input AND the figure printed on the signed page.
    */
    get DiscountAmount(): number | null {
        return this.Get('DiscountAmount');
    }
    set DiscountAmount(value: number | null) {
        this.Set('DiscountAmount', value);
    }

    /**
    * * Field Name: Total
    * * Display Name: Total
    * * SQL Data Type: decimal(19, 4)
    * * Description: THE SIGNED FIGURE for this line, transcribed from the executed document. On the PDF it equals AnnualGrossFees minus DiscountAmount, but THAT SUBTRACTION IS THE CUSTOMER'S AND THE AD'S, NOT THIS APP'S: nothing here computes, defaults or back-fills it, which is how the no-arithmetic rule stays literally true. Deliberately unconstrained in sign — a credit or concession line is legitimately negative, and bounding it would mean asserting the arithmetic.
    */
    get Total(): number | null {
        return this.Get('Total');
    }
    set Total(value: number | null) {
        this.Set('Total', value);
    }

    /**
    * * Field Name: ResolvedUnitPrice
    * * Display Name: Resolved Unit Price
    * * SQL Data Type: decimal(19, 4)
    * * Description: WRITE-ONLY from this app's perspective: populated only from an Orders.PreviewOrder response, never computed locally, never hand-edited.
    */
    get ResolvedUnitPrice(): number | null {
        return this.Get('ResolvedUnitPrice');
    }
    set ResolvedUnitPrice(value: number | null) {
        this.Set('ResolvedUnitPrice', value);
    }

    /**
    * * Field Name: ResolvedExtendedAmount
    * * Display Name: Resolved Extended Amount
    * * SQL Data Type: decimal(19, 4)
    * * Description: WRITE-ONLY, from Orders.PreviewOrder. Never quantity x price computed here.
    */
    get ResolvedExtendedAmount(): number | null {
        return this.Get('ResolvedExtendedAmount');
    }
    set ResolvedExtendedAmount(value: number | null) {
        this.Set('ResolvedExtendedAmount', value);
    }

    /**
    * * Field Name: PriceComponentsJSON
    * * Display Name: Price Components JSON
    * * SQL Data Type: nvarchar(MAX)
    * * Description: The explanation trail Orders.PreviewOrder returns (base, rules, adjustments, charges, tax), so a rep can answer "why is it this price" without a support ticket.
    */
    get PriceComponentsJSON(): string | null {
        return this.Get('PriceComponentsJSON');
    }
    set PriceComponentsJSON(value: string | null) {
        this.Set('PriceComponentsJSON', value);
    }

    /**
    * * Field Name: PricedAt
    * * Display Name: Priced At
    * * SQL Data Type: datetimeoffset
    */
    get PricedAt(): Date | null {
        return this.Get('PricedAt');
    }
    set PricedAt(value: Date | null) {
        this.Set('PricedAt', value);
    }

    /**
    * * Field Name: CompanyID
    * * Display Name: Company ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
    * * Description: DENORMALIZED stamp of the product's owning company at price time, mirroring OrderLine.CompanyID. This is what lets a cross-company deal materialize into orders with correct per-line company ownership. Server-maintained; never hand-set.
    */
    get CompanyID(): string | null {
        return this.Get('CompanyID');
    }
    set CompanyID(value: string | null) {
        this.Set('CompanyID', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Deal
    * * Display Name: Deal
    * * SQL Data Type: nvarchar(500)
    */
    get Deal(): string {
        return this.Get('Deal');
    }

    /**
    * * Field Name: DealLineType
    * * Display Name: Deal Line Type
    * * SQL Data Type: nvarchar(200)
    */
    get DealLineType(): string | null {
        return this.Get('DealLineType');
    }

    /**
    * * Field Name: Company
    * * Display Name: Company
    * * SQL Data Type: nvarchar(50)
    */
    get Company(): string | null {
        return this.Get('Company');
    }
}


/**
 * MJ_BizApps_Sales: Deal Payment Schedules - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: DealPaymentSchedule
 * * Base View: vwDealPaymentSchedules
 * * @description The EXCEPTION payment schedule for a deal. THE ABSENCE OF ROWS IS THE COMMON CASE and that is the design: the standard term is 100% payable on execution, so a deal on standard terms carries no rows here and rows exist only where something else was negotiated. Storing the default on every deal would let a later change to "default" silently rewrite history, and would turn "did this deal negotiate payment terms?" into arithmetic instead of a row count. This app does NOT check that the schedule sums to the deal amount — that is computing money, and the authoritative total lives in orders.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Deal Payment Schedules')
export class mjBizAppsSalesDealPaymentScheduleEntity extends BaseEntity<mjBizAppsSalesDealPaymentScheduleEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Deal Payment Schedules record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Deal Payment Schedules record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesDealPaymentScheduleEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: DealID
    * * Display Name: Deal ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deals (vwDeals.ID)
    */
    get DealID(): string {
        return this.Get('DealID');
    }
    set DealID(value: string) {
        this.Set('DealID', value);
    }

    /**
    * * Field Name: PaymentDate
    * * Display Name: Payment Date
    * * SQL Data Type: date
    */
    get PaymentDate(): Date | null {
        return this.Get('PaymentDate');
    }
    set PaymentDate(value: Date | null) {
        this.Set('PaymentDate', value);
    }

    /**
    * * Field Name: Amount
    * * Display Name: Amount
    * * SQL Data Type: decimal(19, 4)
    * * Description: The instalment amount as agreed. Unconstrained in sign: a refund or credit instalment is legitimately negative, and this table records what was agreed rather than asserting a shape for it.
    */
    get Amount(): number | null {
        return this.Get('Amount');
    }
    set Amount(value: number | null) {
        this.Set('Amount', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(1000)
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: DisplayOrder
    * * Display Name: Display Order
    * * SQL Data Type: int
    * * Default Value: 0
    * * Description: Explicit ordering, because instalment order is not always date order — "on execution" and "on signature of SOW 2" can share a date or have none yet. Server-maintained and re-sequenced on every save, mirroring how accounting re-sequences JournalEntryLine.LineNumber.
    */
    get DisplayOrder(): number {
        return this.Get('DisplayOrder');
    }
    set DisplayOrder(value: number) {
        this.Set('DisplayOrder', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Deal
    * * Display Name: Deal
    * * SQL Data Type: nvarchar(500)
    */
    get Deal(): string {
        return this.Get('Deal');
    }
}


/**
 * MJ_BizApps_Sales: Deal Roles - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: DealRole
 * * Base View: vwDealRoles
 * * @description The roles internal people hold on a deal (Owner/AE, Sales Engineer, SDR, Executive Sponsor, Partner Manager, CS Lead).
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Deal Roles')
export class mjBizAppsSalesDealRoleEntity extends BaseEntity<mjBizAppsSalesDealRoleEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Deal Roles record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Deal Roles record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesDealRoleEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Code
    * * SQL Data Type: nvarchar(40)
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: IsOwnerRole
    * * Display Name: Is Owner Role
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: Identifies the role that DEFINES ownership. Exactly one team member per deal may hold a role with this flag, enforced server-side, and Deal.OwnerEmployeeID is the denormalized stamp of whoever does.
    */
    get IsOwnerRole(): boolean {
        return this.Get('IsOwnerRole');
    }
    set IsOwnerRole(value: boolean) {
        this.Set('IsOwnerRole', value);
    }

    /**
    * * Field Name: AllowsMultiplePerDeal
    * * Display Name: Allows Multiple Per Deal
    * * SQL Data Type: bit
    * * Default Value: 1
    * * Description: Whether two people may hold this role on one deal. Two sales engineers, yes; two owners, no. Enforced server-side FROM THIS FLAG, never hardcoded against a role name.
    */
    get AllowsMultiplePerDeal(): boolean {
        return this.Get('AllowsMultiplePerDeal');
    }
    set AllowsMultiplePerDeal(value: boolean) {
        this.Set('AllowsMultiplePerDeal', value);
    }

    /**
    * * Field Name: DefaultAttributionPct
    * * Display Name: Default Attribution Pct
    * * SQL Data Type: decimal(5, 2)
    */
    get DefaultAttributionPct(): number | null {
        return this.Get('DefaultAttributionPct');
    }
    set DefaultAttributionPct(value: number | null) {
        this.Set('DefaultAttributionPct', value);
    }

    /**
    * * Field Name: IsQuotaCarrying
    * * Display Name: Is Quota Carrying
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get IsQuotaCarrying(): boolean {
        return this.Get('IsQuotaCarrying');
    }
    set IsQuotaCarrying(value: boolean) {
        this.Set('IsQuotaCarrying', value);
    }

    /**
    * * Field Name: DisplayRank
    * * Display Name: Display Rank
    * * SQL Data Type: int
    * * Default Value: 0
    */
    get DisplayRank(): number {
        return this.Get('DisplayRank');
    }
    set DisplayRank(value: number) {
        this.Set('DisplayRank', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }
}


/**
 * MJ_BizApps_Sales: Deal Stage Events - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: DealStageEvent
 * * Base View: vwDealStageEvents
 * * @description APPEND-ONLY transition log, never edited. The source for stage conversion, velocity, dwell time, slippage and skipped-stage analysis. Stamping the amount and probability AT each transition is what lets historical roll-ups reconstruct correctly after a deal's amount changes.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Deal Stage Events')
export class mjBizAppsSalesDealStageEventEntity extends BaseEntity<mjBizAppsSalesDealStageEventEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Deal Stage Events record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Deal Stage Events record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesDealStageEventEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: DealID
    * * Display Name: Deal ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deals (vwDeals.ID)
    */
    get DealID(): string {
        return this.Get('DealID');
    }
    set DealID(value: string) {
        this.Set('DealID', value);
    }

    /**
    * * Field Name: FromStageID
    * * Display Name: From Stage ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Pipeline Stages (vwPipelineStages.ID)
    */
    get FromStageID(): string | null {
        return this.Get('FromStageID');
    }
    set FromStageID(value: string | null) {
        this.Set('FromStageID', value);
    }

    /**
    * * Field Name: ToStageID
    * * Display Name: To Stage ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Pipeline Stages (vwPipelineStages.ID)
    */
    get ToStageID(): string | null {
        return this.Get('ToStageID');
    }
    set ToStageID(value: string | null) {
        this.Set('ToStageID', value);
    }

    /**
    * * Field Name: FromDealStatusTypeID
    * * Display Name: From Deal Status Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deal Status Types (vwDealStatusTypes.ID)
    */
    get FromDealStatusTypeID(): string | null {
        return this.Get('FromDealStatusTypeID');
    }
    set FromDealStatusTypeID(value: string | null) {
        this.Set('FromDealStatusTypeID', value);
    }

    /**
    * * Field Name: ToDealStatusTypeID
    * * Display Name: To Deal Status Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deal Status Types (vwDealStatusTypes.ID)
    */
    get ToDealStatusTypeID(): string | null {
        return this.Get('ToDealStatusTypeID');
    }
    set ToDealStatusTypeID(value: string | null) {
        this.Set('ToDealStatusTypeID', value);
    }

    /**
    * * Field Name: ChangedByUserID
    * * Display Name: Changed By User ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
    */
    get ChangedByUserID(): string | null {
        return this.Get('ChangedByUserID');
    }
    set ChangedByUserID(value: string | null) {
        this.Set('ChangedByUserID', value);
    }

    /**
    * * Field Name: ChangedAt
    * * Display Name: Changed At
    * * SQL Data Type: datetimeoffset
    * * Default Value: sysutcdatetime()
    * * Description: The ORIGINAL time of the transition, not the row's insert time. A distinct column rather than a reliance on __mj_CreatedAt because the HubSpot import must preserve historical timestamps — a 2023 transition has to land as 2023.
    */
    get ChangedAt(): Date {
        return this.Get('ChangedAt');
    }
    set ChangedAt(value: Date) {
        this.Set('ChangedAt', value);
    }

    /**
    * * Field Name: DaysInPreviousStage
    * * Display Name: Days In Previous Stage
    * * SQL Data Type: int
    */
    get DaysInPreviousStage(): number | null {
        return this.Get('DaysInPreviousStage');
    }
    set DaysInPreviousStage(value: number | null) {
        this.Set('DaysInPreviousStage', value);
    }

    /**
    * * Field Name: AmountAtTransition
    * * Display Name: Amount At Transition
    * * SQL Data Type: decimal(19, 4)
    * * Description: Deal.Amount as it stood at this transition. Point-in-time truth: "what did we think the forecast was on the 1st" is unanswerable from Deal alone once amounts change.
    */
    get AmountAtTransition(): number | null {
        return this.Get('AmountAtTransition');
    }
    set AmountAtTransition(value: number | null) {
        this.Set('AmountAtTransition', value);
    }

    /**
    * * Field Name: ProbabilityAtTransition
    * * Display Name: Probability At Transition
    * * SQL Data Type: decimal(5, 2)
    */
    get ProbabilityAtTransition(): number | null {
        return this.Get('ProbabilityAtTransition');
    }
    set ProbabilityAtTransition(value: number | null) {
        this.Set('ProbabilityAtTransition', value);
    }

    /**
    * * Field Name: Notes
    * * Display Name: Notes
    * * SQL Data Type: nvarchar(MAX)
    */
    get Notes(): string | null {
        return this.Get('Notes');
    }
    set Notes(value: string | null) {
        this.Set('Notes', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Deal
    * * Display Name: Deal
    * * SQL Data Type: nvarchar(500)
    */
    get Deal(): string {
        return this.Get('Deal');
    }

    /**
    * * Field Name: FromStage
    * * Display Name: From Stage
    * * SQL Data Type: nvarchar(200)
    */
    get FromStage(): string | null {
        return this.Get('FromStage');
    }

    /**
    * * Field Name: ToStage
    * * Display Name: To Stage
    * * SQL Data Type: nvarchar(200)
    */
    get ToStage(): string | null {
        return this.Get('ToStage');
    }

    /**
    * * Field Name: FromDealStatusType
    * * Display Name: From Deal Status Type
    * * SQL Data Type: nvarchar(200)
    */
    get FromDealStatusType(): string | null {
        return this.Get('FromDealStatusType');
    }

    /**
    * * Field Name: ToDealStatusType
    * * Display Name: To Deal Status Type
    * * SQL Data Type: nvarchar(200)
    */
    get ToDealStatusType(): string | null {
        return this.Get('ToDealStatusType');
    }

    /**
    * * Field Name: ChangedByUser
    * * Display Name: Changed By User
    * * SQL Data Type: nvarchar(100)
    */
    get ChangedByUser(): string | null {
        return this.Get('ChangedByUser');
    }
}


/**
 * MJ_BizApps_Sales: Deal Status Types - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: DealStatusType
 * * Base View: vwDealStatusTypes
 * * @description The OUTCOME vocabulary for deals (Open, Won, Lost, Abandoned, On Hold ...). Behaviour comes from the flags on this row, NEVER from the Name — Sales.CloseDeal is named for the outcome type rather than a hardcoded "won" precisely so it can resolve everything from IsWon/IsLost/LocksDeal. Renaming a status is a metadata change with no code impact.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Deal Status Types')
export class mjBizAppsSalesDealStatusTypeEntity extends BaseEntity<mjBizAppsSalesDealStatusTypeEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Deal Status Types record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Deal Status Types record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesDealStatusTypeEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Code
    * * SQL Data Type: nvarchar(40)
    * * Description: Stable identifier the engine and metadata seeds key on. Renaming Name is cosmetic; renaming Code changes an identifier.
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: IsOpen
    * * Display Name: Is Open
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get IsOpen(): boolean {
        return this.Get('IsOpen');
    }
    set IsOpen(value: boolean) {
        this.Set('IsOpen', value);
    }

    /**
    * * Field Name: IsClosed
    * * Display Name: Is Closed
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get IsClosed(): boolean {
        return this.Get('IsClosed');
    }
    set IsClosed(value: boolean) {
        this.Set('IsClosed', value);
    }

    /**
    * * Field Name: IsWon
    * * Display Name: Is Won
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get IsWon(): boolean {
        return this.Get('IsWon');
    }
    set IsWon(value: boolean) {
        this.Set('IsWon', value);
    }

    /**
    * * Field Name: IsLost
    * * Display Name: Is Lost
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get IsLost(): boolean {
        return this.Get('IsLost');
    }
    set IsLost(value: boolean) {
        this.Set('IsLost', value);
    }

    /**
    * * Field Name: LocksDeal
    * * Display Name: Locks Deal
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: When 1, a deal in this status FREEZES: the header (except Description and NextStep), its lines and its team members become immutable, enforced in DealEntityServer.Save() — not in the UI, so an Action, an agent or a raw BaseEntity.Save() hits the same wall. Mirrors journal-entry immutability in accounting, and for the same reason: the deal is now the provenance of a contract and an order.
    */
    get LocksDeal(): boolean {
        return this.Get('LocksDeal');
    }
    set LocksDeal(value: boolean) {
        this.Set('LocksDeal', value);
    }

    /**
    * * Field Name: DisplayRank
    * * Display Name: Display Rank
    * * SQL Data Type: int
    * * Default Value: 0
    */
    get DisplayRank(): number {
        return this.Get('DisplayRank');
    }
    set DisplayRank(value: number) {
        this.Set('DisplayRank', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }
}


/**
 * MJ_BizApps_Sales: Deal Team Members - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: DealTeamMember
 * * Base View: vwDealTeamMembers
 * * @description The internal people on a deal and the role each holds — the SINGLE SOURCE OF TRUTH for deal membership, INCLUDING the owner (the member whose DealRole has IsOwnerRole = 1). WATCH THE ATTRIBUTION DOUBLE-COUNT: a deal with an AE, an SE and an SDR has three rows, so summing Deal.Amount across this table triple-counts the deal. Every by-rep rollup must either filter to the owner role or weight by AttributionPct.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Deal Team Members')
export class mjBizAppsSalesDealTeamMemberEntity extends BaseEntity<mjBizAppsSalesDealTeamMemberEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Deal Team Members record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Deal Team Members record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesDealTeamMemberEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: DealID
    * * Display Name: Deal ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deals (vwDeals.ID)
    */
    get DealID(): string {
        return this.Get('DealID');
    }
    set DealID(value: string) {
        this.Set('DealID', value);
    }

    /**
    * * Field Name: EmployeeID
    * * Display Name: Employee ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Employees (vwEmployees.ID)
    * * Description: The internal rep, as an MJ Employee. Exactly one of EmployeeID / PersonID is set. Employee is the common case.
    */
    get EmployeeID(): string | null {
        return this.Get('EmployeeID');
    }
    set EmployeeID(value: string | null) {
        this.Set('EmployeeID', value);
    }

    /**
    * * Field Name: PersonID
    * * Display Name: Person ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Common: People (vwPeople.ID)
    * * Description: A NON-EMPLOYEE team member — a partner rep or contractor — as a common.Person. Exactly one of EmployeeID / PersonID is set (D-6). Needed because Partner Manager is a seeded DealRole and an Employee row cannot express someone outside the company.
    */
    get PersonID(): string | null {
        return this.Get('PersonID');
    }
    set PersonID(value: string | null) {
        this.Set('PersonID', value);
    }

    /**
    * * Field Name: DealRoleID
    * * Display Name: Deal Role ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deal Roles (vwDealRoles.ID)
    */
    get DealRoleID(): string {
        return this.Get('DealRoleID');
    }
    set DealRoleID(value: string) {
        this.Set('DealRoleID', value);
    }

    /**
    * * Field Name: AttributionPct
    * * Display Name: Attribution Pct
    * * SQL Data Type: decimal(5, 2)
    * * Description: This member's share of the deal for by-rep rollups. When any member of a deal has a value set, the app validates that active members sum to 100. Leave NULL to fall back to owner-role attribution.
    */
    get AttributionPct(): number | null {
        return this.Get('AttributionPct');
    }
    set AttributionPct(value: number | null) {
        this.Set('AttributionPct', value);
    }

    /**
    * * Field Name: StartDate
    * * Display Name: Start Date
    * * SQL Data Type: date
    */
    get StartDate(): Date | null {
        return this.Get('StartDate');
    }
    set StartDate(value: Date | null) {
        this.Set('StartDate', value);
    }

    /**
    * * Field Name: EndDate
    * * Display Name: End Date
    * * SQL Data Type: date
    */
    get EndDate(): Date | null {
        return this.Get('EndDate');
    }
    set EndDate(value: Date | null) {
        this.Set('EndDate', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: Notes
    * * Display Name: Notes
    * * SQL Data Type: nvarchar(MAX)
    */
    get Notes(): string | null {
        return this.Get('Notes');
    }
    set Notes(value: string | null) {
        this.Set('Notes', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Deal
    * * Display Name: Deal
    * * SQL Data Type: nvarchar(500)
    */
    get Deal(): string {
        return this.Get('Deal');
    }

    /**
    * * Field Name: Employee
    * * Display Name: Employee
    * * SQL Data Type: nvarchar(81)
    */
    get Employee(): string | null {
        return this.Get('Employee');
    }

    /**
    * * Field Name: Person
    * * Display Name: Person
    * * SQL Data Type: nvarchar(201)
    */
    get Person(): string | null {
        return this.Get('Person');
    }

    /**
    * * Field Name: DealRole
    * * Display Name: Deal Role
    * * SQL Data Type: nvarchar(200)
    */
    get DealRole(): string {
        return this.Get('DealRole');
    }
}


/**
 * MJ_BizApps_Sales: Deal Types - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: DealType
 * * Base View: vwDealTypes
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Deal Types')
export class mjBizAppsSalesDealTypeEntity extends BaseEntity<mjBizAppsSalesDealTypeEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Deal Types record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Deal Types record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesDealTypeEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Code
    * * SQL Data Type: nvarchar(40)
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: RequiresContract
    * * Display Name: Requires Contract
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get RequiresContract(): boolean {
        return this.Get('RequiresContract');
    }
    set RequiresContract(value: boolean) {
        this.Set('RequiresContract', value);
    }

    /**
    * * Field Name: RequiresRenewalSource
    * * Display Name: Requires Renewal Source
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get RequiresRenewalSource(): boolean {
        return this.Get('RequiresRenewalSource');
    }
    set RequiresRenewalSource(value: boolean) {
        this.Set('RequiresRenewalSource', value);
    }

    /**
    * * Field Name: DefaultPipelineID
    * * Display Name: Default Pipeline ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Pipelines (vwPipelines.ID)
    */
    get DefaultPipelineID(): string | null {
        return this.Get('DefaultPipelineID');
    }
    set DefaultPipelineID(value: string | null) {
        this.Set('DefaultPipelineID', value);
    }

    /**
    * * Field Name: DisplayRank
    * * Display Name: Display Rank
    * * SQL Data Type: int
    * * Default Value: 0
    */
    get DisplayRank(): number {
        return this.Get('DisplayRank');
    }
    set DisplayRank(value: number) {
        this.Set('DisplayRank', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: DefaultPipeline
    * * Display Name: Default Pipeline
    * * SQL Data Type: nvarchar(200)
    */
    get DefaultPipeline(): string | null {
        return this.Get('DefaultPipeline');
    }
}


/**
 * MJ_BizApps_Sales: Deals - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: Deal
 * * Base View: vwDeals
 * * @description A deal (opportunity). Amount is a CACHED answer from Orders.PreviewOrder carrying its own provenance, never a locally computed total — this app performs no pricing arithmetic of any kind. Closing a deal is a transaction that CREATES a contract and/or orders, not a notification that someone should.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Deals')
export class mjBizAppsSalesDealEntity extends BaseEntity<mjBizAppsSalesDealEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Deals record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Deals record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesDealEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: DealNumber
    * * Display Name: Deal Number
    * * SQL Data Type: nvarchar(50)
    */
    get DealNumber(): string | null {
        return this.Get('DealNumber');
    }
    set DealNumber(value: string | null) {
        this.Set('DealNumber', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(500)
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: PipelineID
    * * Display Name: Pipeline ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Pipelines (vwPipelines.ID)
    */
    get PipelineID(): string {
        return this.Get('PipelineID');
    }
    set PipelineID(value: string) {
        this.Set('PipelineID', value);
    }

    /**
    * * Field Name: PipelineStageID
    * * Display Name: Pipeline Stage ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Pipeline Stages (vwPipelineStages.ID)
    */
    get PipelineStageID(): string | null {
        return this.Get('PipelineStageID');
    }
    set PipelineStageID(value: string | null) {
        this.Set('PipelineStageID', value);
    }

    /**
    * * Field Name: DealTypeID
    * * Display Name: Deal Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deal Types (vwDealTypes.ID)
    */
    get DealTypeID(): string | null {
        return this.Get('DealTypeID');
    }
    set DealTypeID(value: string | null) {
        this.Set('DealTypeID', value);
    }

    /**
    * * Field Name: DealStatusTypeID
    * * Display Name: Deal Status Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deal Status Types (vwDealStatusTypes.ID)
    */
    get DealStatusTypeID(): string | null {
        return this.Get('DealStatusTypeID');
    }
    set DealStatusTypeID(value: string | null) {
        this.Set('DealStatusTypeID', value);
    }

    /**
    * * Field Name: AccountID
    * * Display Name: Account ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Sales Accounts (vwSalesAccounts.ID)
    */
    get AccountID(): string | null {
        return this.Get('AccountID');
    }
    set AccountID(value: string | null) {
        this.Set('AccountID', value);
    }

    /**
    * * Field Name: PrimaryContactID
    * * Display Name: Primary Contact ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Sales Contacts (vwSalesContacts.ID)
    */
    get PrimaryContactID(): string | null {
        return this.Get('PrimaryContactID');
    }
    set PrimaryContactID(value: string | null) {
        this.Set('PrimaryContactID', value);
    }

    /**
    * * Field Name: BillingContactID
    * * Display Name: Billing Contact ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Sales Contacts (vwSalesContacts.ID)
    * * Description: The contact who receives the invoice, which is routinely NOT the person negotiating. NULL means the billing contact IS the primary contact — a real default, not "unknown" — so an AD never types the same name twice and changing the primary contact leaves no stale billing copy.
    */
    get BillingContactID(): string | null {
        return this.Get('BillingContactID');
    }
    set BillingContactID(value: string | null) {
        this.Set('BillingContactID', value);
    }

    /**
    * * Field Name: CompanyID
    * * Display Name: Company ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
    * * Description: The SELLING company. Must match Pipeline.CompanyID; enforced by the entity server, since a CHECK cannot reach across the FK to compare them. FK to __mj.Company.
    */
    get CompanyID(): string {
        return this.Get('CompanyID');
    }
    set CompanyID(value: string) {
        this.Set('CompanyID', value);
    }

    /**
    * * Field Name: OwnerEmployeeID
    * * Display Name: Owner Employee ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Employees (vwEmployees.ID)
    * * Description: DENORMALIZED, SERVER-MAINTAINED. The Employee holding the role where DealRole.IsOwnerRole = 1, written by DealEntityServer.Save() whenever team membership changes. DealTeamMember is the source of truth; this exists so "my deals" and per-rep boards need no join. NEVER SET THIS DIRECTLY — it will diverge.
    */
    get OwnerEmployeeID(): string | null {
        return this.Get('OwnerEmployeeID');
    }
    set OwnerEmployeeID(value: string | null) {
        this.Set('OwnerEmployeeID', value);
    }

    /**
    * * Field Name: Amount
    * * Display Name: Amount
    * * SQL Data Type: decimal(19, 4)
    * * Description: The deal value. A CACHED ANSWER returned by Orders.PreviewOrder for this deal's line set — NOT computed here. For a simple (header-only) deal it is hand-entered and AmountIsComputed is 0. Never sum DealLine rows into this column; sales does no arithmetic.
    */
    get Amount(): number | null {
        return this.Get('Amount');
    }
    set Amount(value: number | null) {
        this.Set('Amount', value);
    }

    /**
    * * Field Name: AmountIsComputed
    * * Display Name: Amount Is Computed
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: 1 when Amount came from Orders.PreviewOrder; 0 when a human typed it (a simple, header-only deal). Distinguishes a traceable figure from a stated one.
    */
    get AmountIsComputed(): boolean {
        return this.Get('AmountIsComputed');
    }
    set AmountIsComputed(value: boolean) {
        this.Set('AmountIsComputed', value);
    }

    /**
    * * Field Name: AmountComputedAt
    * * Display Name: Amount Computed At
    * * SQL Data Type: datetimeoffset
    */
    get AmountComputedAt(): Date | null {
        return this.Get('AmountComputedAt');
    }
    set AmountComputedAt(value: Date | null) {
        this.Set('AmountComputedAt', value);
    }

    /**
    * * Field Name: AmountSourceHash
    * * Display Name: Amount Source Hash
    * * SQL Data Type: nvarchar(128)
    * * Description: Fingerprint of the DealLine set Amount was computed from. Compare it against the current lines to detect a STALE amount, so the UI can say "this figure is stale, reprice" instead of showing a number nobody can trace. Without this column Amount becomes a hand-edited field within a month.
    */
    get AmountSourceHash(): string | null {
        return this.Get('AmountSourceHash');
    }
    set AmountSourceHash(value: string | null) {
        this.Set('AmountSourceHash', value);
    }

    /**
    * * Field Name: CurrencyID
    * * Display Name: Currency ID
    * * SQL Data Type: uniqueidentifier
    */
    get CurrencyID(): string | null {
        return this.Get('CurrencyID');
    }
    set CurrencyID(value: string | null) {
        this.Set('CurrencyID', value);
    }

    /**
    * * Field Name: MRR
    * * Display Name: Mrr
    * * SQL Data Type: decimal(19, 4)
    */
    get MRR(): number | null {
        return this.Get('MRR');
    }
    set MRR(value: number | null) {
        this.Set('MRR', value);
    }

    /**
    * * Field Name: ARR
    * * Display Name: Arr
    * * SQL Data Type: decimal(19, 4)
    */
    get ARR(): number | null {
        return this.Get('ARR');
    }
    set ARR(value: number | null) {
        this.Set('ARR', value);
    }

    /**
    * * Field Name: TermMonths
    * * Display Name: Term Months
    * * SQL Data Type: int
    */
    get TermMonths(): number | null {
        return this.Get('TermMonths');
    }
    set TermMonths(value: number | null) {
        this.Set('TermMonths', value);
    }

    /**
    * * Field Name: EstimatedProjectWeeks
    * * Display Name: Estimated Project Weeks
    * * SQL Data Type: int
    * * Description: Estimated project timeline in WEEKS, from the SOW template. A separate column from TermMonths on purpose: a subscription term is a COMMITMENT that drives renewal dates and escalation, a project estimate is a FORECAST that drives neither. One column plus a unit flag would force every consumer to branch on the unit before using the number.
    */
    get EstimatedProjectWeeks(): number | null {
        return this.Get('EstimatedProjectWeeks');
    }
    set EstimatedProjectWeeks(value: number | null) {
        this.Set('EstimatedProjectWeeks', value);
    }

    /**
    * * Field Name: ExecutionDate
    * * Display Name: Execution Date
    * * SQL Data Type: date
    * * Description: The date the agreement was signed. Deliberately NOT constrained against StartDate: work that begins before signature is common and legitimate, so ordering the two would reject real deals.
    */
    get ExecutionDate(): Date | null {
        return this.Get('ExecutionDate');
    }
    set ExecutionDate(value: Date | null) {
        this.Set('ExecutionDate', value);
    }

    /**
    * * Field Name: StartDate
    * * Display Name: Start Date
    * * SQL Data Type: date
    * * Description: The date service or the subscription actually begins (order-form / SOW start). May precede ExecutionDate for backdated work — see that column.
    */
    get StartDate(): Date | null {
        return this.Get('StartDate');
    }
    set StartDate(value: Date | null) {
        this.Set('StartDate', value);
    }

    /**
    * * Field Name: ExpectedCloseDate
    * * Display Name: Expected Close Date
    * * SQL Data Type: date
    */
    get ExpectedCloseDate(): Date | null {
        return this.Get('ExpectedCloseDate');
    }
    set ExpectedCloseDate(value: Date | null) {
        this.Set('ExpectedCloseDate', value);
    }

    /**
    * * Field Name: ActualCloseDate
    * * Display Name: Actual Close Date
    * * SQL Data Type: date
    */
    get ActualCloseDate(): Date | null {
        return this.Get('ActualCloseDate');
    }
    set ActualCloseDate(value: Date | null) {
        this.Set('ActualCloseDate', value);
    }

    /**
    * * Field Name: Probability
    * * Display Name: Probability
    * * SQL Data Type: decimal(5, 2)
    */
    get Probability(): number | null {
        return this.Get('Probability');
    }
    set Probability(value: number | null) {
        this.Set('Probability', value);
    }

    /**
    * * Field Name: ForecastCategoryTypeID
    * * Display Name: Forecast Category Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Forecast Category Types (vwForecastCategoryTypes.ID)
    */
    get ForecastCategoryTypeID(): string | null {
        return this.Get('ForecastCategoryTypeID');
    }
    set ForecastCategoryTypeID(value: string | null) {
        this.Set('ForecastCategoryTypeID', value);
    }

    /**
    * * Field Name: LossReasonID
    * * Display Name: Loss Reason ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Loss Reasons (vwLossReasons.ID)
    */
    get LossReasonID(): string | null {
        return this.Get('LossReasonID');
    }
    set LossReasonID(value: string | null) {
        this.Set('LossReasonID', value);
    }

    /**
    * * Field Name: LossNotes
    * * Display Name: Loss Notes
    * * SQL Data Type: nvarchar(MAX)
    */
    get LossNotes(): string | null {
        return this.Get('LossNotes');
    }
    set LossNotes(value: string | null) {
        this.Set('LossNotes', value);
    }

    /**
    * * Field Name: LeadSourceTypeID
    * * Display Name: Lead Source Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Lead Source Types (vwLeadSourceTypes.ID)
    */
    get LeadSourceTypeID(): string | null {
        return this.Get('LeadSourceTypeID');
    }
    set LeadSourceTypeID(value: string | null) {
        this.Set('LeadSourceTypeID', value);
    }

    /**
    * * Field Name: CampaignID
    * * Display Name: Campaign ID
    * * SQL Data Type: uniqueidentifier
    */
    get CampaignID(): string | null {
        return this.Get('CampaignID');
    }
    set CampaignID(value: string | null) {
        this.Set('CampaignID', value);
    }

    /**
    * * Field Name: ContractID
    * * Display Name: Contract ID
    * * SQL Data Type: uniqueidentifier
    * * Description: SOFT reference (no FK) to a bizapps-contracts Contract. The link points DOWN the dependency graph; there is deliberately no Contract.DealID, because it is ONE contract to MANY deals — the original sale, every renewal, every expansion.
    */
    get ContractID(): string | null {
        return this.Get('ContractID');
    }
    set ContractID(value: string | null) {
        this.Set('ContractID', value);
    }

    /**
    * * Field Name: RenewsContractID
    * * Display Name: Renews Contract ID
    * * SQL Data Type: uniqueidentifier
    * * Description: SOFT reference (no FK) to the contract this deal RENEWS. What makes the renewal chain navigable from the sales side without contracts knowing anything about it. Required when DealType.RequiresRenewalSource is set.
    */
    get RenewsContractID(): string | null {
        return this.Get('RenewsContractID');
    }
    set RenewsContractID(value: string | null) {
        this.Set('RenewsContractID', value);
    }

    /**
    * * Field Name: AutoRenew
    * * Display Name: Auto Renew
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: Whether the resulting agreement renews automatically at the end of its term.
    */
    get AutoRenew(): boolean {
        return this.Get('AutoRenew');
    }
    set AutoRenew(value: boolean) {
        this.Set('AutoRenew', value);
    }

    /**
    * * Field Name: AnnualIncreasePctOverride
    * * Display Name: Annual Increase Pct Override
    * * SQL Data Type: decimal(5, 2)
    * * Description: An OVERRIDE, and NULL is meaningful: it means "use the standard annual increase", whose default (5%) lives on the contracts ContractType, not here. That is a different fact from "we negotiated a number that happens to equal today's standard", and only the NULL survives a later change to policy. Copying the default in at write time would freeze this year's terms into next year's renewals silently.
    */
    get AnnualIncreasePctOverride(): number | null {
        return this.Get('AnnualIncreasePctOverride');
    }
    set AnnualIncreasePctOverride(value: number | null) {
        this.Set('AnnualIncreasePctOverride', value);
    }

    /**
    * * Field Name: CancellationNoticeDaysOverride
    * * Display Name: Cancellation Notice Days Override
    * * SQL Data Type: int
    * * Description: An OVERRIDE of the standard cancellation-notice period (default 90 days, owned by the contracts ContractType). NULL means "use the standard" — see AnnualIncreasePctOverride for why that distinction is load-bearing.
    */
    get CancellationNoticeDaysOverride(): number | null {
        return this.Get('CancellationNoticeDaysOverride');
    }
    set CancellationNoticeDaysOverride(value: number | null) {
        this.Set('CancellationNoticeDaysOverride', value);
    }

    /**
    * * Field Name: PaymentMethod
    * * Display Name: Payment Method
    * * SQL Data Type: nvarchar(50)
    * * Default Value: ACH
    * * Description: PLACEHOLDER LABEL (default ACH), and a string only for as long as nothing branches on it. Payment method becomes vocabulary the moment code cares — ACH and card differ in settlement timing and fees — but ORDERS owns that concept and will expose PaymentType. Pointing at orders' vocabulary later beats standing up a competing copy here and reconciling two. No code may branch on this value.
    */
    get PaymentMethod(): string | null {
        return this.Get('PaymentMethod');
    }
    set PaymentMethod(value: string | null) {
        this.Set('PaymentMethod', value);
    }

    /**
    * * Field Name: ContractVariances
    * * Display Name: Contract Variances
    * * SQL Data Type: nvarchar(MAX)
    * * Description: Free-text summary of what this deal negotiated AWAY from standard terms — the red-line list, in the AD's own words. The input to a human legal review; nothing should attempt to parse it.
    */
    get ContractVariances(): string | null {
        return this.Get('ContractVariances');
    }
    set ContractVariances(value: string | null) {
        this.Set('ContractVariances', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: NextStep
    * * Display Name: Next Step
    * * SQL Data Type: nvarchar(1000)
    */
    get NextStep(): string | null {
        return this.Get('NextStep');
    }
    set NextStep(value: string | null) {
        this.Set('NextStep', value);
    }

    /**
    * * Field Name: NextStepDate
    * * Display Name: Next Step Date
    * * SQL Data Type: date
    */
    get NextStepDate(): Date | null {
        return this.Get('NextStepDate');
    }
    set NextStepDate(value: Date | null) {
        this.Set('NextStepDate', value);
    }

    /**
    * * Field Name: ClosedAt
    * * Display Name: Closed At
    * * SQL Data Type: datetimeoffset
    */
    get ClosedAt(): Date | null {
        return this.Get('ClosedAt');
    }
    set ClosedAt(value: Date | null) {
        this.Set('ClosedAt', value);
    }

    /**
    * * Field Name: ClosedByUserID
    * * Display Name: Closed By User ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
    */
    get ClosedByUserID(): string | null {
        return this.Get('ClosedByUserID');
    }
    set ClosedByUserID(value: string | null) {
        this.Set('ClosedByUserID', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Pipeline
    * * Display Name: Pipeline
    * * SQL Data Type: nvarchar(200)
    */
    get Pipeline(): string {
        return this.Get('Pipeline');
    }

    /**
    * * Field Name: PipelineStage
    * * Display Name: Pipeline Stage
    * * SQL Data Type: nvarchar(200)
    */
    get PipelineStage(): string | null {
        return this.Get('PipelineStage');
    }

    /**
    * * Field Name: DealType
    * * Display Name: Deal Type
    * * SQL Data Type: nvarchar(200)
    */
    get DealType(): string | null {
        return this.Get('DealType');
    }

    /**
    * * Field Name: DealStatusType
    * * Display Name: Deal Status Type
    * * SQL Data Type: nvarchar(200)
    */
    get DealStatusType(): string | null {
        return this.Get('DealStatusType');
    }

    /**
    * * Field Name: Company
    * * Display Name: Company
    * * SQL Data Type: nvarchar(50)
    */
    get Company(): string {
        return this.Get('Company');
    }

    /**
    * * Field Name: OwnerEmployee
    * * Display Name: Owner Employee
    * * SQL Data Type: nvarchar(81)
    */
    get OwnerEmployee(): string | null {
        return this.Get('OwnerEmployee');
    }

    /**
    * * Field Name: ForecastCategoryType
    * * Display Name: Forecast Category Type
    * * SQL Data Type: nvarchar(200)
    */
    get ForecastCategoryType(): string | null {
        return this.Get('ForecastCategoryType');
    }

    /**
    * * Field Name: LossReason
    * * Display Name: Loss Reason
    * * SQL Data Type: nvarchar(200)
    */
    get LossReason(): string | null {
        return this.Get('LossReason');
    }

    /**
    * * Field Name: LeadSourceType
    * * Display Name: Lead Source Type
    * * SQL Data Type: nvarchar(200)
    */
    get LeadSourceType(): string | null {
        return this.Get('LeadSourceType');
    }

    /**
    * * Field Name: ClosedByUser
    * * Display Name: Closed By User
    * * SQL Data Type: nvarchar(100)
    */
    get ClosedByUser(): string | null {
        return this.Get('ClosedByUser');
    }
}


/**
 * MJ_BizApps_Sales: Forecast Category Types - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: ForecastCategoryType
 * * Base View: vwForecastCategoryTypes
 * * @description How a deal rolls into the forecast (Omitted, Pipeline, Best Case, Commit, Closed). The Include* flags are read directly by the forecast measures; a query that compared a category NAME would be exactly the violation the CI grep exists to catch.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Forecast Category Types')
export class mjBizAppsSalesForecastCategoryTypeEntity extends BaseEntity<mjBizAppsSalesForecastCategoryTypeEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Forecast Category Types record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Forecast Category Types record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesForecastCategoryTypeEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Code
    * * SQL Data Type: nvarchar(40)
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: IncludeInCommit
    * * Display Name: Include In Commit
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get IncludeInCommit(): boolean {
        return this.Get('IncludeInCommit');
    }
    set IncludeInCommit(value: boolean) {
        this.Set('IncludeInCommit', value);
    }

    /**
    * * Field Name: IncludeInBestCase
    * * Display Name: Include In Best Case
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get IncludeInBestCase(): boolean {
        return this.Get('IncludeInBestCase');
    }
    set IncludeInBestCase(value: boolean) {
        this.Set('IncludeInBestCase', value);
    }

    /**
    * * Field Name: IncludeInPipeline
    * * Display Name: Include In Pipeline
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get IncludeInPipeline(): boolean {
        return this.Get('IncludeInPipeline');
    }
    set IncludeInPipeline(value: boolean) {
        this.Set('IncludeInPipeline', value);
    }

    /**
    * * Field Name: DisplayRank
    * * Display Name: Display Rank
    * * SQL Data Type: int
    * * Default Value: 0
    */
    get DisplayRank(): number {
        return this.Get('DisplayRank');
    }
    set DisplayRank(value: number) {
        this.Set('DisplayRank', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }
}


/**
 * MJ_BizApps_Sales: Forecast Snapshots - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: ForecastSnapshot
 * * Base View: vwForecastSnapshots
 * * @description A point-in-time capture of the forecast, written by a Scheduled Job. Snapshots matter more than the live number: "what did we think on the first of the month" is the question a forecast review actually asks, and it is unanswerable after the fact without them. The live figure reads Deal; the historical one reads this table.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Forecast Snapshots')
export class mjBizAppsSalesForecastSnapshotEntity extends BaseEntity<mjBizAppsSalesForecastSnapshotEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Forecast Snapshots record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Forecast Snapshots record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesForecastSnapshotEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: CompanyID
    * * Display Name: Company ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
    */
    get CompanyID(): string {
        return this.Get('CompanyID');
    }
    set CompanyID(value: string) {
        this.Set('CompanyID', value);
    }

    /**
    * * Field Name: PipelineID
    * * Display Name: Pipeline ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Pipelines (vwPipelines.ID)
    */
    get PipelineID(): string | null {
        return this.Get('PipelineID');
    }
    set PipelineID(value: string | null) {
        this.Set('PipelineID', value);
    }

    /**
    * * Field Name: OwnerEmployeeID
    * * Display Name: Owner Employee ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Employees (vwEmployees.ID)
    */
    get OwnerEmployeeID(): string | null {
        return this.Get('OwnerEmployeeID');
    }
    set OwnerEmployeeID(value: string | null) {
        this.Set('OwnerEmployeeID', value);
    }

    /**
    * * Field Name: PeriodStart
    * * Display Name: Period Start
    * * SQL Data Type: date
    */
    get PeriodStart(): Date {
        return this.Get('PeriodStart');
    }
    set PeriodStart(value: Date) {
        this.Set('PeriodStart', value);
    }

    /**
    * * Field Name: PeriodEnd
    * * Display Name: Period End
    * * SQL Data Type: date
    */
    get PeriodEnd(): Date {
        return this.Get('PeriodEnd');
    }
    set PeriodEnd(value: Date) {
        this.Set('PeriodEnd', value);
    }

    /**
    * * Field Name: CapturedAt
    * * Display Name: Captured At
    * * SQL Data Type: datetimeoffset
    * * Default Value: sysutcdatetime()
    */
    get CapturedAt(): Date {
        return this.Get('CapturedAt');
    }
    set CapturedAt(value: Date) {
        this.Set('CapturedAt', value);
    }

    /**
    * * Field Name: CommitAmount
    * * Display Name: Commit Amount
    * * SQL Data Type: decimal(19, 4)
    * * Description: Total of deals in forecast categories flagged IncludeInCommit as at CapturedAt. Named CommitAmount rather than the plan's Commit because COMMIT is a reserved word in both T-SQL and PostgreSQL, and production is PostgreSQL.
    */
    get CommitAmount(): number | null {
        return this.Get('CommitAmount');
    }
    set CommitAmount(value: number | null) {
        this.Set('CommitAmount', value);
    }

    /**
    * * Field Name: BestCaseAmount
    * * Display Name: Best Case Amount
    * * SQL Data Type: decimal(19, 4)
    */
    get BestCaseAmount(): number | null {
        return this.Get('BestCaseAmount');
    }
    set BestCaseAmount(value: number | null) {
        this.Set('BestCaseAmount', value);
    }

    /**
    * * Field Name: PipelineAmount
    * * Display Name: Pipeline Amount
    * * SQL Data Type: decimal(19, 4)
    */
    get PipelineAmount(): number | null {
        return this.Get('PipelineAmount');
    }
    set PipelineAmount(value: number | null) {
        this.Set('PipelineAmount', value);
    }

    /**
    * * Field Name: ClosedAmount
    * * Display Name: Closed Amount
    * * SQL Data Type: decimal(19, 4)
    */
    get ClosedAmount(): number | null {
        return this.Get('ClosedAmount');
    }
    set ClosedAmount(value: number | null) {
        this.Set('ClosedAmount', value);
    }

    /**
    * * Field Name: SnapshotJSON
    * * Display Name: Snapshot JSON
    * * SQL Data Type: nvarchar(MAX)
    * * Description: The full breakdown behind the four bucket totals, so a snapshot can be interrogated rather than merely displayed.
    */
    get SnapshotJSON(): string | null {
        return this.Get('SnapshotJSON');
    }
    set SnapshotJSON(value: string | null) {
        this.Set('SnapshotJSON', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Company
    * * Display Name: Company
    * * SQL Data Type: nvarchar(50)
    */
    get Company(): string {
        return this.Get('Company');
    }

    /**
    * * Field Name: Pipeline
    * * Display Name: Pipeline
    * * SQL Data Type: nvarchar(200)
    */
    get Pipeline(): string | null {
        return this.Get('Pipeline');
    }

    /**
    * * Field Name: OwnerEmployee
    * * Display Name: Owner Employee
    * * SQL Data Type: nvarchar(81)
    */
    get OwnerEmployee(): string | null {
        return this.Get('OwnerEmployee');
    }
}


/**
 * MJ_BizApps_Sales: Lead Source Types - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: LeadSourceType
 * * Base View: vwLeadSourceTypes
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Lead Source Types')
export class mjBizAppsSalesLeadSourceTypeEntity extends BaseEntity<mjBizAppsSalesLeadSourceTypeEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Lead Source Types record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Lead Source Types record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesLeadSourceTypeEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Code
    * * SQL Data Type: nvarchar(40)
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: IsInbound
    * * Display Name: Is Inbound
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get IsInbound(): boolean {
        return this.Get('IsInbound');
    }
    set IsInbound(value: boolean) {
        this.Set('IsInbound', value);
    }

    /**
    * * Field Name: IsPaid
    * * Display Name: Is Paid
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get IsPaid(): boolean {
        return this.Get('IsPaid');
    }
    set IsPaid(value: boolean) {
        this.Set('IsPaid', value);
    }

    /**
    * * Field Name: AttributionWindowDays
    * * Display Name: Attribution Window Days
    * * SQL Data Type: int
    */
    get AttributionWindowDays(): number | null {
        return this.Get('AttributionWindowDays');
    }
    set AttributionWindowDays(value: number | null) {
        this.Set('AttributionWindowDays', value);
    }

    /**
    * * Field Name: DisplayRank
    * * Display Name: Display Rank
    * * SQL Data Type: int
    * * Default Value: 0
    */
    get DisplayRank(): number {
        return this.Get('DisplayRank');
    }
    set DisplayRank(value: number) {
        this.Set('DisplayRank', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }
}


/**
 * MJ_BizApps_Sales: Lifecycle Stage Types - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: LifecycleStageType
 * * Base View: vwLifecycleStageTypes
 * * @description Where a Person or Organization sits on the journey from stranger to evangelist. This table is what makes "Lead" a STAGE rather than an entity: a lead is a common.Person carrying a LifecycleStageTypeID, not a second identity table for humans.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Lifecycle Stage Types')
export class mjBizAppsSalesLifecycleStageTypeEntity extends BaseEntity<mjBizAppsSalesLifecycleStageTypeEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Lifecycle Stage Types record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Lifecycle Stage Types record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesLifecycleStageTypeEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Code
    * * SQL Data Type: nvarchar(40)
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: IsMarketingQualified
    * * Display Name: Is Marketing Qualified
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get IsMarketingQualified(): boolean {
        return this.Get('IsMarketingQualified');
    }
    set IsMarketingQualified(value: boolean) {
        this.Set('IsMarketingQualified', value);
    }

    /**
    * * Field Name: IsSalesQualified
    * * Display Name: Is Sales Qualified
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get IsSalesQualified(): boolean {
        return this.Get('IsSalesQualified');
    }
    set IsSalesQualified(value: boolean) {
        this.Set('IsSalesQualified', value);
    }

    /**
    * * Field Name: IsCustomer
    * * Display Name: Is Customer
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get IsCustomer(): boolean {
        return this.Get('IsCustomer');
    }
    set IsCustomer(value: boolean) {
        this.Set('IsCustomer', value);
    }

    /**
    * * Field Name: DisplayRank
    * * Display Name: Display Rank
    * * SQL Data Type: int
    * * Default Value: 0
    */
    get DisplayRank(): number {
        return this.Get('DisplayRank');
    }
    set DisplayRank(value: number) {
        this.Set('DisplayRank', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }
}


/**
 * MJ_BizApps_Sales: Loss Reasons - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: LossReason
 * * Base View: vwLossReasons
 * * @description Why a deal was lost. Loss reason is this app's ONLY mandatory field and the friction is deliberate: loss reasons are the highest-value and most consistently-skipped data in any CRM.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Loss Reasons')
export class mjBizAppsSalesLossReasonEntity extends BaseEntity<mjBizAppsSalesLossReasonEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Loss Reasons record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Loss Reasons record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesLossReasonEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Code
    * * SQL Data Type: nvarchar(40)
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: Category
    * * Display Name: Category
    * * SQL Data Type: nvarchar(100)
    */
    get Category(): string | null {
        return this.Get('Category');
    }
    set Category(value: string | null) {
        this.Set('Category', value);
    }

    /**
    * * Field Name: RequiresNotes
    * * Display Name: Requires Notes
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: When 1, Sales.CloseDeal refuses a close against this reason unless Deal.LossNotes is supplied.
    */
    get RequiresNotes(): boolean {
        return this.Get('RequiresNotes');
    }
    set RequiresNotes(value: boolean) {
        this.Set('RequiresNotes', value);
    }

    /**
    * * Field Name: IsCompetitive
    * * Display Name: Is Competitive
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get IsCompetitive(): boolean {
        return this.Get('IsCompetitive');
    }
    set IsCompetitive(value: boolean) {
        this.Set('IsCompetitive', value);
    }

    /**
    * * Field Name: DisplayRank
    * * Display Name: Display Rank
    * * SQL Data Type: int
    * * Default Value: 0
    */
    get DisplayRank(): number {
        return this.Get('DisplayRank');
    }
    set DisplayRank(value: number) {
        this.Set('DisplayRank', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }
}


/**
 * MJ_BizApps_Sales: Pipeline Stages - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: PipelineStage
 * * Base View: vwPipelineStages
 * * @description An ordered stage within a pipeline. Stages carry NO IsWon/IsClosed of their own — they point at a DealStatusType that does. That indirection is what makes "Closed Won" a label rather than a behaviour, and lets a pipeline call its winning stage Signed, Booked or Enrolled with no code aware of the difference.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Pipeline Stages')
export class mjBizAppsSalesPipelineStageEntity extends BaseEntity<mjBizAppsSalesPipelineStageEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Pipeline Stages record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Pipeline Stages record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesPipelineStageEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: PipelineID
    * * Display Name: Pipeline ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Pipelines (vwPipelines.ID)
    */
    get PipelineID(): string {
        return this.Get('PipelineID');
    }
    set PipelineID(value: string) {
        this.Set('PipelineID', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Code
    * * SQL Data Type: nvarchar(40)
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: DisplayOrder
    * * Display Name: Display Order
    * * SQL Data Type: int
    * * Default Value: 0
    */
    get DisplayOrder(): number {
        return this.Get('DisplayOrder');
    }
    set DisplayOrder(value: number) {
        this.Set('DisplayOrder', value);
    }

    /**
    * * Field Name: Probability
    * * Display Name: Probability
    * * SQL Data Type: decimal(5, 2)
    */
    get Probability(): number | null {
        return this.Get('Probability');
    }
    set Probability(value: number | null) {
        this.Set('Probability', value);
    }

    /**
    * * Field Name: ForecastCategoryTypeID
    * * Display Name: Forecast Category Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Forecast Category Types (vwForecastCategoryTypes.ID)
    */
    get ForecastCategoryTypeID(): string | null {
        return this.Get('ForecastCategoryTypeID');
    }
    set ForecastCategoryTypeID(value: string | null) {
        this.Set('ForecastCategoryTypeID', value);
    }

    /**
    * * Field Name: DealStatusTypeID
    * * Display Name: Deal Status Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deal Status Types (vwDealStatusTypes.ID)
    * * Description: The status a deal takes on when it ENTERS this stage. The stage names the vocabulary; the status carries the behaviour flags.
    */
    get DealStatusTypeID(): string | null {
        return this.Get('DealStatusTypeID');
    }
    set DealStatusTypeID(value: string | null) {
        this.Set('DealStatusTypeID', value);
    }

    /**
    * * Field Name: RottingDays
    * * Display Name: Rotting Days
    * * SQL Data Type: int
    * * Description: Days without activity before the board flags a deal in this stage as rotting.
    */
    get RottingDays(): number | null {
        return this.Get('RottingDays');
    }
    set RottingDays(value: number | null) {
        this.Set('RottingDays', value);
    }

    /**
    * * Field Name: EntryCriteria
    * * Display Name: Entry Criteria
    * * SQL Data Type: nvarchar(MAX)
    */
    get EntryCriteria(): string | null {
        return this.Get('EntryCriteria');
    }
    set EntryCriteria(value: string | null) {
        this.Set('EntryCriteria', value);
    }

    /**
    * * Field Name: ExitCriteria
    * * Display Name: Exit Criteria
    * * SQL Data Type: nvarchar(MAX)
    * * Description: Declarative JSON predicate evaluated SERVER-SIDE before a deal may leave this stage. A stage that cannot be exited without a signed mutual action plan is a config row, not a code branch.
    */
    get ExitCriteria(): string | null {
        return this.Get('ExitCriteria');
    }
    set ExitCriteria(value: string | null) {
        this.Set('ExitCriteria', value);
    }

    /**
    * * Field Name: RequiredFields
    * * Display Name: Required Fields
    * * SQL Data Type: nvarchar(MAX)
    */
    get RequiredFields(): string | null {
        return this.Get('RequiredFields');
    }
    set RequiredFields(value: string | null) {
        this.Set('RequiredFields', value);
    }

    /**
    * * Field Name: GuidanceMarkdown
    * * Display Name: Guidance Markdown
    * * SQL Data Type: nvarchar(MAX)
    * * Description: "What good looks like at this stage", shown in the deal workspace. Sales enablement as a config field.
    */
    get GuidanceMarkdown(): string | null {
        return this.Get('GuidanceMarkdown');
    }
    set GuidanceMarkdown(value: string | null) {
        this.Set('GuidanceMarkdown', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Pipeline
    * * Display Name: Pipeline
    * * SQL Data Type: nvarchar(200)
    */
    get Pipeline(): string {
        return this.Get('Pipeline');
    }

    /**
    * * Field Name: ForecastCategoryType
    * * Display Name: Forecast Category Type
    * * SQL Data Type: nvarchar(200)
    */
    get ForecastCategoryType(): string | null {
        return this.Get('ForecastCategoryType');
    }

    /**
    * * Field Name: DealStatusType
    * * Display Name: Deal Status Type
    * * SQL Data Type: nvarchar(200)
    */
    get DealStatusType(): string | null {
        return this.Get('DealStatusType');
    }
}


/**
 * MJ_BizApps_Sales: Pipelines - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: Pipeline
 * * Base View: vwPipelines
 * * @description A sales pipeline, owned by exactly one company. A company may have any number of pipelines; a pipeline may have any number of deals.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Pipelines')
export class mjBizAppsSalesPipelineEntity extends BaseEntity<mjBizAppsSalesPipelineEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Pipelines record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Pipelines record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesPipelineEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: CompanyID
    * * Display Name: Company ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
    * * Description: The owning company. NOT NULL by design — this is what makes every forecast and bookings rollup sliceable by company for free, and every deal inherits it. FK to __mj.Company.
    */
    get CompanyID(): string {
        return this.Get('CompanyID');
    }
    set CompanyID(value: string) {
        this.Set('CompanyID', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Code
    * * SQL Data Type: nvarchar(40)
    * * Description: Stable identifier, unique PER COMPANY rather than globally: two operating companies may each run a pipeline they both call NEWBIZ.
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: DealTypeID
    * * Display Name: Deal Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Deal Types (vwDealTypes.ID)
    */
    get DealTypeID(): string | null {
        return this.Get('DealTypeID');
    }
    set DealTypeID(value: string | null) {
        this.Set('DealTypeID', value);
    }

    /**
    * * Field Name: DefaultForecastCategoryTypeID
    * * Display Name: Default Forecast Category Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Forecast Category Types (vwForecastCategoryTypes.ID)
    */
    get DefaultForecastCategoryTypeID(): string | null {
        return this.Get('DefaultForecastCategoryTypeID');
    }
    set DefaultForecastCategoryTypeID(value: string | null) {
        this.Set('DefaultForecastCategoryTypeID', value);
    }

    /**
    * * Field Name: RequiresDealLines
    * * Display Name: Requires Deal Lines
    * * SQL Data Type: bit
    * * Default Value: 1
    * * Description: Pipeline-level default for whether deals carry catalog lines (priced mode) or are header-only with a hand-entered Amount (simple mode). Overridable per deal. Partner-referral and sponsorship pipelines may never carry lines.
    */
    get RequiresDealLines(): boolean {
        return this.Get('RequiresDealLines');
    }
    set RequiresDealLines(value: boolean) {
        this.Set('RequiresDealLines', value);
    }

    /**
    * * Field Name: CloseWonPolicy
    * * Display Name: Close Won Policy
    * * SQL Data Type: nvarchar(MAX)
    * * Description: JSON declaring the DEFAULT outcome of winning a deal in this pipeline: whether to create a contract, which contract type, where subscription lines go, where one-time lines go, and what state the resulting order lands in. A deal may override it; one remote operation (Sales.CloseDeal) reads and executes it. JSON rather than columns because the policy shape is still being learned.
    */
    get CloseWonPolicy(): string | null {
        return this.Get('CloseWonPolicy');
    }
    set CloseWonPolicy(value: string | null) {
        this.Set('CloseWonPolicy', value);
    }

    /**
    * * Field Name: IsDefault
    * * Display Name: Is Default
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get IsDefault(): boolean {
        return this.Get('IsDefault');
    }
    set IsDefault(value: boolean) {
        this.Set('IsDefault', value);
    }

    /**
    * * Field Name: DisplayRank
    * * Display Name: Display Rank
    * * SQL Data Type: int
    * * Default Value: 0
    */
    get DisplayRank(): number {
        return this.Get('DisplayRank');
    }
    set DisplayRank(value: number) {
        this.Set('DisplayRank', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Company
    * * Display Name: Company
    * * SQL Data Type: nvarchar(50)
    */
    get Company(): string {
        return this.Get('Company');
    }

    /**
    * * Field Name: DealType
    * * Display Name: Deal Type
    * * SQL Data Type: nvarchar(200)
    */
    get DealType(): string | null {
        return this.Get('DealType');
    }

    /**
    * * Field Name: DefaultForecastCategoryType
    * * Display Name: Default Forecast Category Type
    * * SQL Data Type: nvarchar(200)
    */
    get DefaultForecastCategoryType(): string | null {
        return this.Get('DefaultForecastCategoryType');
    }
}


/**
 * MJ_BizApps_Sales: Sales Accounts - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: SalesAccount
 * * Base View: vwSalesAccounts
 * * @description CRM attributes for an organization we sell to. An IsA extension of __mj_BizAppsCommon.Organization sharing its UUID — the account and the organization ARE one record, so a customer that is also a vendor and a member stays one row in the Organization graph.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Sales Accounts')
export class mjBizAppsSalesSalesAccountEntity extends BaseEntity<mjBizAppsSalesSalesAccountEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Sales Accounts record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Sales Accounts record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesSalesAccountEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Common: Organizations (vwOrganizations.ID)
    * * Description: Same value as the parent __mj_BizAppsCommon.Organization.ID. The primary key IS the foreign key; this is not a separate surrogate identity.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: OwnerEmployeeID
    * * Display Name: Owner Employee ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Employees (vwEmployees.ID)
    */
    get OwnerEmployeeID(): string | null {
        return this.Get('OwnerEmployeeID');
    }
    set OwnerEmployeeID(value: string | null) {
        this.Set('OwnerEmployeeID', value);
    }

    /**
    * * Field Name: AccountTypeID
    * * Display Name: Account Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Account Types (vwAccountTypes.ID)
    */
    get AccountTypeID(): string | null {
        return this.Get('AccountTypeID');
    }
    set AccountTypeID(value: string | null) {
        this.Set('AccountTypeID', value);
    }

    /**
    * * Field Name: LifecycleStageTypeID
    * * Display Name: Lifecycle Stage Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Lifecycle Stage Types (vwLifecycleStageTypes.ID)
    */
    get LifecycleStageTypeID(): string | null {
        return this.Get('LifecycleStageTypeID');
    }
    set LifecycleStageTypeID(value: string | null) {
        this.Set('LifecycleStageTypeID', value);
    }

    /**
    * * Field Name: LeadSourceTypeID
    * * Display Name: Lead Source Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Lead Source Types (vwLeadSourceTypes.ID)
    */
    get LeadSourceTypeID(): string | null {
        return this.Get('LeadSourceTypeID');
    }
    set LeadSourceTypeID(value: string | null) {
        this.Set('LeadSourceTypeID', value);
    }

    /**
    * * Field Name: Territory
    * * Display Name: Territory
    * * SQL Data Type: nvarchar(100)
    * * Description: A LABEL, not a routing engine. Territory assignment as a rules engine is a product in its own right and is on the not-doing list.
    */
    get Territory(): string | null {
        return this.Get('Territory');
    }
    set Territory(value: string | null) {
        this.Set('Territory', value);
    }

    /**
    * * Field Name: Tier
    * * Display Name: Tier
    * * SQL Data Type: nvarchar(50)
    */
    get Tier(): string | null {
        return this.Get('Tier');
    }
    set Tier(value: string | null) {
        this.Set('Tier', value);
    }

    /**
    * * Field Name: ICPFitScore
    * * Display Name: ICP Fit Score
    * * SQL Data Type: int
    */
    get ICPFitScore(): number | null {
        return this.Get('ICPFitScore');
    }
    set ICPFitScore(value: number | null) {
        this.Set('ICPFitScore', value);
    }

    /**
    * * Field Name: IndustryCode
    * * Display Name: Industry Code
    * * SQL Data Type: nvarchar(50)
    */
    get IndustryCode(): string | null {
        return this.Get('IndustryCode');
    }
    set IndustryCode(value: string | null) {
        this.Set('IndustryCode', value);
    }

    /**
    * * Field Name: EmployeeCountBand
    * * Display Name: Employee Count Band
    * * SQL Data Type: nvarchar(50)
    * * Description: A BAND, not a number, for the same reason as AnnualRevenueBand.
    */
    get EmployeeCountBand(): string | null {
        return this.Get('EmployeeCountBand');
    }
    set EmployeeCountBand(value: string | null) {
        this.Set('EmployeeCountBand', value);
    }

    /**
    * * Field Name: AnnualRevenueBand
    * * Display Name: Annual Revenue Band
    * * SQL Data Type: nvarchar(50)
    * * Description: A BAND, not a number ("$1M-$5M"), on purpose. A rep's guess stored as an exact figure is false precision that later gets treated as fact.
    */
    get AnnualRevenueBand(): string | null {
        return this.Get('AnnualRevenueBand');
    }
    set AnnualRevenueBand(value: string | null) {
        this.Set('AnnualRevenueBand', value);
    }

    /**
    * * Field Name: HealthStatus
    * * Display Name: Health Status
    * * SQL Data Type: nvarchar(50)
    */
    get HealthStatus(): string | null {
        return this.Get('HealthStatus');
    }
    set HealthStatus(value: string | null) {
        this.Set('HealthStatus', value);
    }

    /**
    * * Field Name: FirstClosedWonDate
    * * Display Name: First Closed Won Date
    * * SQL Data Type: date
    */
    get FirstClosedWonDate(): Date | null {
        return this.Get('FirstClosedWonDate');
    }
    set FirstClosedWonDate(value: Date | null) {
        this.Set('FirstClosedWonDate', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(255)
    * * IS-A Source: Inherited from MJ_BizApps_Common: Organizations
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: LegalName
    * * Display Name: Legal Name
    * * SQL Data Type: nvarchar(255)
    * * IS-A Source: Inherited from MJ_BizApps_Common: Organizations
    */
    get LegalName(): string | null {
        return this.Get('LegalName');
    }
    set LegalName(value: string | null) {
        this.Set('LegalName', value);
    }

    /**
    * * Field Name: OrganizationTypeID
    * * Display Name: Organization Type ID
    * * SQL Data Type: uniqueidentifier
    * * IS-A Source: Inherited from MJ_BizApps_Common: Organizations
    */
    get OrganizationTypeID(): string | null {
        return this.Get('OrganizationTypeID');
    }
    set OrganizationTypeID(value: string | null) {
        this.Set('OrganizationTypeID', value);
    }

    /**
    * * Field Name: ParentID
    * * Display Name: Parent ID
    * * SQL Data Type: uniqueidentifier
    * * IS-A Source: Inherited from MJ_BizApps_Common: Organizations
    */
    get ParentID(): string | null {
        return this.Get('ParentID');
    }
    set ParentID(value: string | null) {
        this.Set('ParentID', value);
    }

    /**
    * * Field Name: Website
    * * Display Name: Website
    * * SQL Data Type: nvarchar(1000)
    * * IS-A Source: Inherited from MJ_BizApps_Common: Organizations
    */
    get Website(): string | null {
        return this.Get('Website');
    }
    set Website(value: string | null) {
        this.Set('Website', value);
    }

    /**
    * * Field Name: LogoURL
    * * Display Name: Logo URL
    * * SQL Data Type: nvarchar(1000)
    * * IS-A Source: Inherited from MJ_BizApps_Common: Organizations
    */
    get LogoURL(): string | null {
        return this.Get('LogoURL');
    }
    set LogoURL(value: string | null) {
        this.Set('LogoURL', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    * * IS-A Source: Inherited from MJ_BizApps_Common: Organizations
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: Email
    * * Display Name: Email
    * * SQL Data Type: nvarchar(255)
    * * IS-A Source: Inherited from MJ_BizApps_Common: Organizations
    */
    get Email(): string | null {
        return this.Get('Email');
    }
    set Email(value: string | null) {
        this.Set('Email', value);
    }

    /**
    * * Field Name: Phone
    * * Display Name: Phone
    * * SQL Data Type: nvarchar(50)
    * * IS-A Source: Inherited from MJ_BizApps_Common: Organizations
    */
    get Phone(): string | null {
        return this.Get('Phone');
    }
    set Phone(value: string | null) {
        this.Set('Phone', value);
    }

    /**
    * * Field Name: FoundedDate
    * * Display Name: Founded Date
    * * SQL Data Type: date
    * * IS-A Source: Inherited from MJ_BizApps_Common: Organizations
    */
    get FoundedDate(): Date | null {
        return this.Get('FoundedDate');
    }
    set FoundedDate(value: Date | null) {
        this.Set('FoundedDate', value);
    }

    /**
    * * Field Name: TaxID
    * * Display Name: Tax ID
    * * SQL Data Type: nvarchar(50)
    * * IS-A Source: Inherited from MJ_BizApps_Common: Organizations
    */
    get TaxID(): string | null {
        return this.Get('TaxID');
    }
    set TaxID(value: string | null) {
        this.Set('TaxID', value);
    }

    /**
    * * Field Name: Status
    * * Display Name: Status
    * * SQL Data Type: nvarchar(50)
    * * IS-A Source: Inherited from MJ_BizApps_Common: Organizations
    */
    get Status(): string {
        return this.Get('Status');
    }
    set Status(value: string) {
        this.Set('Status', value);
    }

    /**
    * * Field Name: OwnerEmployee
    * * Display Name: Owner Employee
    * * SQL Data Type: nvarchar(81)
    */
    get OwnerEmployee(): string | null {
        return this.Get('OwnerEmployee');
    }

    /**
    * * Field Name: AccountType
    * * Display Name: Account Type
    * * SQL Data Type: nvarchar(200)
    */
    get AccountType(): string | null {
        return this.Get('AccountType');
    }

    /**
    * * Field Name: LifecycleStageType
    * * Display Name: Lifecycle Stage Type
    * * SQL Data Type: nvarchar(200)
    */
    get LifecycleStageType(): string | null {
        return this.Get('LifecycleStageType');
    }

    /**
    * * Field Name: LeadSourceType
    * * Display Name: Lead Source Type
    * * SQL Data Type: nvarchar(200)
    */
    get LeadSourceType(): string | null {
        return this.Get('LeadSourceType');
    }
}


/**
 * MJ_BizApps_Sales: Sales Contacts - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: SalesContact
 * * Base View: vwSalesContacts
 * * @description CRM attributes for a person we sell to. An IsA extension of __mj_BizAppsCommon.Person sharing its UUID. There is deliberately no Lead entity — a lead is a Person at a lifecycle stage.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Sales Contacts')
export class mjBizAppsSalesSalesContactEntity extends BaseEntity<mjBizAppsSalesSalesContactEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Sales Contacts record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Sales: Sales Contacts record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesSalesContactEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Common: People (vwPeople.ID)
    * * Description: Same value as the parent __mj_BizAppsCommon.Person.ID. The primary key IS the foreign key.
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: OwnerEmployeeID
    * * Display Name: Owner Employee ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Employees (vwEmployees.ID)
    */
    get OwnerEmployeeID(): string | null {
        return this.Get('OwnerEmployeeID');
    }
    set OwnerEmployeeID(value: string | null) {
        this.Set('OwnerEmployeeID', value);
    }

    /**
    * * Field Name: LifecycleStageTypeID
    * * Display Name: Lifecycle Stage Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Lifecycle Stage Types (vwLifecycleStageTypes.ID)
    */
    get LifecycleStageTypeID(): string | null {
        return this.Get('LifecycleStageTypeID');
    }
    set LifecycleStageTypeID(value: string | null) {
        this.Set('LifecycleStageTypeID', value);
    }

    /**
    * * Field Name: BuyingRoleTypeID
    * * Display Name: Buying Role Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Buying Role Types (vwBuyingRoleTypes.ID)
    * * Description: The contact's DEFAULT buying role. The role that matters per-deal lives on DealContactRole, because one contact holds different roles on different deals.
    */
    get BuyingRoleTypeID(): string | null {
        return this.Get('BuyingRoleTypeID');
    }
    set BuyingRoleTypeID(value: string | null) {
        this.Set('BuyingRoleTypeID', value);
    }

    /**
    * * Field Name: LeadSourceTypeID
    * * Display Name: Lead Source Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Lead Source Types (vwLeadSourceTypes.ID)
    */
    get LeadSourceTypeID(): string | null {
        return this.Get('LeadSourceTypeID');
    }
    set LeadSourceTypeID(value: string | null) {
        this.Set('LeadSourceTypeID', value);
    }

    /**
    * * Field Name: Seniority
    * * Display Name: Seniority
    * * SQL Data Type: nvarchar(50)
    */
    get Seniority(): string | null {
        return this.Get('Seniority');
    }
    set Seniority(value: string | null) {
        this.Set('Seniority', value);
    }

    /**
    * * Field Name: OptedOutOfOutreach
    * * Display Name: Opted Out Of Outreach
    * * SQL Data Type: bit
    * * Default Value: 0
    */
    get OptedOutOfOutreach(): boolean {
        return this.Get('OptedOutOfOutreach');
    }
    set OptedOutOfOutreach(value: boolean) {
        this.Set('OptedOutOfOutreach', value);
    }

    /**
    * * Field Name: DoNotContactReason
    * * Display Name: Do Not Contact Reason
    * * SQL Data Type: nvarchar(500)
    */
    get DoNotContactReason(): string | null {
        return this.Get('DoNotContactReason');
    }
    set DoNotContactReason(value: string | null) {
        this.Set('DoNotContactReason', value);
    }

    /**
    * * Field Name: LastEngagedAt
    * * Display Name: Last Engaged At
    * * SQL Data Type: datetimeoffset
    */
    get LastEngagedAt(): Date | null {
        return this.Get('LastEngagedAt');
    }
    set LastEngagedAt(value: Date | null) {
        this.Set('LastEngagedAt', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: FirstName
    * * Display Name: First Name
    * * SQL Data Type: nvarchar(100)
    * * IS-A Source: Inherited from MJ_BizApps_Common: People
    */
    get FirstName(): string {
        return this.Get('FirstName');
    }
    set FirstName(value: string) {
        this.Set('FirstName', value);
    }

    /**
    * * Field Name: LastName
    * * Display Name: Last Name
    * * SQL Data Type: nvarchar(100)
    * * IS-A Source: Inherited from MJ_BizApps_Common: People
    */
    get LastName(): string {
        return this.Get('LastName');
    }
    set LastName(value: string) {
        this.Set('LastName', value);
    }

    /**
    * * Field Name: MiddleName
    * * Display Name: Middle Name
    * * SQL Data Type: nvarchar(100)
    * * IS-A Source: Inherited from MJ_BizApps_Common: People
    */
    get MiddleName(): string | null {
        return this.Get('MiddleName');
    }
    set MiddleName(value: string | null) {
        this.Set('MiddleName', value);
    }

    /**
    * * Field Name: Prefix
    * * Display Name: Prefix
    * * SQL Data Type: nvarchar(20)
    * * IS-A Source: Inherited from MJ_BizApps_Common: People
    */
    get Prefix(): string | null {
        return this.Get('Prefix');
    }
    set Prefix(value: string | null) {
        this.Set('Prefix', value);
    }

    /**
    * * Field Name: Suffix
    * * Display Name: Suffix
    * * SQL Data Type: nvarchar(20)
    * * IS-A Source: Inherited from MJ_BizApps_Common: People
    */
    get Suffix(): string | null {
        return this.Get('Suffix');
    }
    set Suffix(value: string | null) {
        this.Set('Suffix', value);
    }

    /**
    * * Field Name: PreferredName
    * * Display Name: Preferred Name
    * * SQL Data Type: nvarchar(100)
    * * IS-A Source: Inherited from MJ_BizApps_Common: People
    */
    get PreferredName(): string | null {
        return this.Get('PreferredName');
    }
    set PreferredName(value: string | null) {
        this.Set('PreferredName', value);
    }

    /**
    * * Field Name: Title
    * * Display Name: Title
    * * SQL Data Type: nvarchar(200)
    * * IS-A Source: Inherited from MJ_BizApps_Common: People
    */
    get Title(): string | null {
        return this.Get('Title');
    }
    set Title(value: string | null) {
        this.Set('Title', value);
    }

    /**
    * * Field Name: Email
    * * Display Name: Email
    * * SQL Data Type: nvarchar(255)
    * * IS-A Source: Inherited from MJ_BizApps_Common: People
    */
    get Email(): string | null {
        return this.Get('Email');
    }
    set Email(value: string | null) {
        this.Set('Email', value);
    }

    /**
    * * Field Name: Phone
    * * Display Name: Phone
    * * SQL Data Type: nvarchar(50)
    * * IS-A Source: Inherited from MJ_BizApps_Common: People
    */
    get Phone(): string | null {
        return this.Get('Phone');
    }
    set Phone(value: string | null) {
        this.Set('Phone', value);
    }

    /**
    * * Field Name: DateOfBirth
    * * Display Name: Date Of Birth
    * * SQL Data Type: date
    * * IS-A Source: Inherited from MJ_BizApps_Common: People
    */
    get DateOfBirth(): Date | null {
        return this.Get('DateOfBirth');
    }
    set DateOfBirth(value: Date | null) {
        this.Set('DateOfBirth', value);
    }

    /**
    * * Field Name: Gender
    * * Display Name: Gender
    * * SQL Data Type: nvarchar(50)
    * * IS-A Source: Inherited from MJ_BizApps_Common: People
    */
    get Gender(): string | null {
        return this.Get('Gender');
    }
    set Gender(value: string | null) {
        this.Set('Gender', value);
    }

    /**
    * * Field Name: PhotoURL
    * * Display Name: Photo URL
    * * SQL Data Type: nvarchar(1000)
    * * IS-A Source: Inherited from MJ_BizApps_Common: People
    */
    get PhotoURL(): string | null {
        return this.Get('PhotoURL');
    }
    set PhotoURL(value: string | null) {
        this.Set('PhotoURL', value);
    }

    /**
    * * Field Name: Bio
    * * Display Name: Bio
    * * SQL Data Type: nvarchar(MAX)
    * * IS-A Source: Inherited from MJ_BizApps_Common: People
    */
    get Bio(): string | null {
        return this.Get('Bio');
    }
    set Bio(value: string | null) {
        this.Set('Bio', value);
    }

    /**
    * * Field Name: LinkedUserID
    * * Display Name: Linked User ID
    * * SQL Data Type: uniqueidentifier
    * * IS-A Source: Inherited from MJ_BizApps_Common: People
    */
    get LinkedUserID(): string | null {
        return this.Get('LinkedUserID');
    }
    set LinkedUserID(value: string | null) {
        this.Set('LinkedUserID', value);
    }

    /**
    * * Field Name: Status
    * * Display Name: Status
    * * SQL Data Type: nvarchar(50)
    * * IS-A Source: Inherited from MJ_BizApps_Common: People
    */
    get Status(): string {
        return this.Get('Status');
    }
    set Status(value: string) {
        this.Set('Status', value);
    }

    /**
    * * Field Name: OwnerEmployee
    * * Display Name: Owner Employee
    * * SQL Data Type: nvarchar(81)
    */
    get OwnerEmployee(): string | null {
        return this.Get('OwnerEmployee');
    }

    /**
    * * Field Name: LifecycleStageType
    * * Display Name: Lifecycle Stage Type
    * * SQL Data Type: nvarchar(200)
    */
    get LifecycleStageType(): string | null {
        return this.Get('LifecycleStageType');
    }

    /**
    * * Field Name: BuyingRoleType
    * * Display Name: Buying Role Type
    * * SQL Data Type: nvarchar(200)
    */
    get BuyingRoleType(): string | null {
        return this.Get('BuyingRoleType');
    }

    /**
    * * Field Name: LeadSourceType
    * * Display Name: Lead Source Type
    * * SQL Data Type: nvarchar(200)
    */
    get LeadSourceType(): string | null {
        return this.Get('LeadSourceType');
    }
}
