import { BaseEntity, EntitySaveOptions, EntityDeleteOptions, CompositeKey, ValidationResult, ValidationErrorInfo, ValidationErrorType, Metadata, ProviderType, DatabaseProviderBase, RunView } from "@memberjunction/core";
import { RegisterClass } from "@memberjunction/global";
import { z } from "zod";

     
 
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
    SalesContact: z.string().describe(`
        * * Field Name: SalesContact
        * * Display Name: Sales Contact
        * * SQL Data Type: nvarchar(704)`),
    BuyingRoleType: z.string().nullable().describe(`
        * * Field Name: BuyingRoleType
        * * Display Name: Buying Role Type
        * * SQL Data Type: nvarchar(200)`),
});

export type mjBizAppsSalesDealContactRoleEntityType = z.infer<typeof mjBizAppsSalesDealContactRoleSchema>;

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
        * * Description: The instalment amount as agreed. Can be negative for a refund or credit.`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(1000)`),
    DisplayOrder: z.number().describe(`
        * * Field Name: DisplayOrder
        * * Display Name: Display Order
        * * SQL Data Type: int
        * * Default Value: 0
        * * Description: Position of the instalment in the schedule, for instalments that share a date or have none yet.`),
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
        * * Description: Marks the role that owns the deal. Only one team member per deal can hold it, and that person is shown as the deal's owner.`),
    AllowsMultiplePerDeal: z.boolean().describe(`
        * * Field Name: AllowsMultiplePerDeal
        * * Display Name: Allows Multiple Per Deal
        * * SQL Data Type: bit
        * * Default Value: 1
        * * Description: Whether more than one person can hold this role on the same deal, for example two sales engineers.`),
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
 * zod schema definition for the entity MJ_BizApps_Sales: Deal Sequences
 */
export const mjBizAppsSalesDealSequenceSchema = z.object({
    ID: z.number().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: int
        * * Default Value: 1`),
    NextSequenceNumber: z.number().describe(`
        * * Field Name: NextSequenceNumber
        * * Display Name: Next Sequence Number
        * * SQL Data Type: int
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

export type mjBizAppsSalesDealSequenceEntityType = z.infer<typeof mjBizAppsSalesDealSequenceSchema>;

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
        * * Description: When the stage change happened. For imported deals this is the original date, not the import date.`),
    DaysInPreviousStage: z.number().nullable().describe(`
        * * Field Name: DaysInPreviousStage
        * * Display Name: Days In Previous Stage
        * * SQL Data Type: int`),
    AmountAtTransition: z.number().nullable().describe(`
        * * Field Name: AmountAtTransition
        * * Display Name: Amount At Transition
        * * SQL Data Type: decimal(19, 4)
        * * Description: The deal amount at the time of this stage change.`),
    AmountAtTransitionIsComputed: z.boolean().nullable().describe(`
        * * Field Name: AmountAtTransitionIsComputed
        * * Display Name: Amount At Transition Is Computed
        * * SQL Data Type: bit
        * * Description: On when the amount at this stage change was the order total, off when it was entered by hand. Empty for changes recorded before this was tracked.`),
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
        * * Description: Short fixed identifier for the status. Renaming the status is safe; changing its code is not.`),
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
        * * Description: When on, a deal in this status is locked until it is reopened: its lines, payment schedule, team and every field except Description and Next Step become read-only.`),
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
        * * Description: The team member, when they are an employee. Set this or Person, not both.`),
    PersonID: z.string().nullable().describe(`
        * * Field Name: PersonID
        * * Display Name: Person ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Common: People (vwPeople.ID)
        * * Description: The team member, when they are not an employee, such as a partner rep. Set this or Employee, not both.`),
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
        * * Display Name: Primary Contact
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Sales Contacts (vwSalesContacts.ID)`),
    BillingContactID: z.string().nullable().describe(`
        * * Field Name: BillingContactID
        * * Display Name: Billing Contact
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Sales Contacts (vwSalesContacts.ID)
        * * Description: The contact who receives the invoice. Leave empty to use the primary contact.`),
    CompanyID: z.string().describe(`
        * * Field Name: CompanyID
        * * Display Name: Company ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Companies (vwCompanies.ID)
        * * Description: The company selling the deal. It must match the pipeline's company.`),
    OwnerEmployeeID: z.string().nullable().describe(`
        * * Field Name: OwnerEmployeeID
        * * Display Name: Owner Employee ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Employees (vwEmployees.ID)
        * * Description: The deal owner: the team member in the owner role. Updated automatically from the deal team.`),
    Amount: z.number().nullable().describe(`
        * * Field Name: Amount
        * * Display Name: Amount
        * * SQL Data Type: decimal(19, 4)
        * * Description: The deal value. For a deal with product lines it is the order total calculated by Orders; for a deal without lines it is entered by hand.`),
    AmountIsComputed: z.boolean().describe(`
        * * Field Name: AmountIsComputed
        * * Display Name: Amount Is Computed
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: On when Amount is the order total calculated by Orders; off when it was entered by hand.`),
    AmountComputedAt: z.date().nullable().describe(`
        * * Field Name: AmountComputedAt
        * * Display Name: Amount Computed At
        * * SQL Data Type: datetimeoffset`),
    AmountSourceHash: z.string().nullable().describe(`
        * * Field Name: AmountSourceHash
        * * Display Name: Amount Source Hash
        * * SQL Data Type: nvarchar(128)
        * * Description: Fingerprint of the order lines the amount was calculated from, used to tell when the amount is out of date.`),
    CurrencyID: z.string().nullable().describe(`
        * * Field Name: CurrencyID
        * * Display Name: Currency
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Currencies (vwCurrencies.ID)`),
    MRR: z.number().nullable().describe(`
        * * Field Name: MRR
        * * Display Name: MRR
        * * SQL Data Type: decimal(19, 4)`),
    ARR: z.number().nullable().describe(`
        * * Field Name: ARR
        * * Display Name: ARR
        * * SQL Data Type: decimal(19, 4)`),
    TermMonths: z.number().nullable().describe(`
        * * Field Name: TermMonths
        * * Display Name: Term Months
        * * SQL Data Type: int`),
    EstimatedProjectWeeks: z.number().nullable().describe(`
        * * Field Name: EstimatedProjectWeeks
        * * Display Name: Estimated Project Weeks
        * * SQL Data Type: int
        * * Description: Estimated project length in weeks, from the statement of work. It does not affect the term or renewal dates.`),
    ExecutionDate: z.date().nullable().describe(`
        * * Field Name: ExecutionDate
        * * Display Name: Execution Date
        * * SQL Data Type: date
        * * Description: The date the agreement was signed. It can be after the start date when work begins before signature.`),
    StartDate: z.date().nullable().describe(`
        * * Field Name: StartDate
        * * Display Name: Start Date
        * * SQL Data Type: date
        * * Description: The date the service or subscription begins. It can be before the execution date.`),
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
        * * Display Name: Campaign
        * * SQL Data Type: uniqueidentifier`),
    ContractID: z.string().nullable().describe(`
        * * Field Name: ContractID
        * * Display Name: Contract
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Contracts: Contracts (vwContracts.ID)
        * * Description: The contract this deal belongs to, in BizApps Contracts.`),
    RenewsContractID: z.string().nullable().describe(`
        * * Field Name: RenewsContractID
        * * Display Name: Renews Contract
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Contracts: Contracts (vwContracts.ID)
        * * Description: The contract this deal renews. Required for deal types that are renewals.`),
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
        * * Description: Annual price increase agreed for this deal, as a percent. Leave empty to use the contract type's standard increase.`),
    CancellationNoticeDaysOverride: z.number().nullable().describe(`
        * * Field Name: CancellationNoticeDaysOverride
        * * Display Name: Cancellation Notice Days Override
        * * SQL Data Type: int
        * * Description: Cancellation notice period agreed for this deal, in days. Leave empty to use the contract type's standard notice period.`),
    PaymentMethod: z.string().nullable().describe(`
        * * Field Name: PaymentMethod
        * * Display Name: Payment Method
        * * SQL Data Type: nvarchar(50)
        * * Default Value: ACH
        * * Description: How the customer expects to pay, for example ACH. For reference only.`),
    StandardAgreementModified: z.boolean().describe(`
        * * Field Name: StandardAgreementModified
        * * Display Name: Standard Agreement Modified
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: Whether the deal moved off the standard agreement. Copied to the contract when the deal is won, where it tells finance to review the changes.`),
    ContractVariances: z.string().nullable().describe(`
        * * Field Name: ContractVariances
        * * Display Name: Contract Variances
        * * SQL Data Type: nvarchar(MAX)
        * * Description: Summary of the terms negotiated away from the standard agreement, for legal review.`),
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
    OrderID: z.string().nullable().describe(`
        * * Field Name: OrderID
        * * Display Name: Order ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Orders: Order Headers (vwOrderHeaders.ID)`),
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
    PredictedWinProbability: z.number().nullable().describe(`
        * * Field Name: PredictedWinProbability
        * * Display Name: Predicted Win Probability
        * * SQL Data Type: decimal(5, 4)
        * * Description: 0.0000 to 1.0000 probability that the deal will close as Won.`),
    PredictedWinRiskBand: z.union([z.literal('Critical'), z.literal('High'), z.literal('Low'), z.literal('Medium')]).nullable().describe(`
        * * Field Name: PredictedWinRiskBand
        * * Display Name: Predicted Win Risk Band
        * * SQL Data Type: nvarchar(20)
    * * Value List Type: List
    * * Possible Values 
    *   * Critical
    *   * High
    *   * Low
    *   * Medium
        * * Description: Categorical priority/risk tier derived from deal win probability: Low, Medium, High, Critical.`),
    PredictedWinScoredAt: z.date().nullable().describe(`
        * * Field Name: PredictedWinScoredAt
        * * Display Name: Predicted Win Scored At
        * * SQL Data Type: datetimeoffset
        * * Description: Timestamp when the deal was last scored by the predictive deal win propensity model.`),
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
        * * Display Name: Status
        * * SQL Data Type: nvarchar(200)`),
    Account: z.string().nullable().describe(`
        * * Field Name: Account
        * * Display Name: Account
        * * SQL Data Type: nvarchar(255)`),
    PrimaryContact: z.string().nullable().describe(`
        * * Field Name: PrimaryContact
        * * Display Name: Primary Contact
        * * SQL Data Type: nvarchar(704)`),
    BillingContact: z.string().nullable().describe(`
        * * Field Name: BillingContact
        * * Display Name: Billing Contact
        * * SQL Data Type: nvarchar(704)`),
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
        * * Display Name: Forecast Category
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
    Order: z.string().nullable().describe(`
        * * Field Name: Order
        * * Display Name: Order
        * * SQL Data Type: nvarchar(40)`),
    WinOutcome: z.number().nullable().describe(`
        * * Field Name: WinOutcome
        * * Display Name: Win Outcome
        * * SQL Data Type: int`),
    DaysToExpectedClose: z.number().nullable().describe(`
        * * Field Name: DaysToExpectedClose
        * * Display Name: Days To Expected Close
        * * SQL Data Type: int`),
    HasPaymentSchedule: z.number().describe(`
        * * Field Name: HasPaymentSchedule
        * * Display Name: Has Payment Schedule
        * * SQL Data Type: int`),
    TeamMemberCount: z.number().describe(`
        * * Field Name: TeamMemberCount
        * * Display Name: Team Member Count
        * * SQL Data Type: int`),
    HasPartnerInvolved: z.number().describe(`
        * * Field Name: HasPartnerInvolved
        * * Display Name: Has Partner Involved
        * * SQL Data Type: int`),
    IsEnterpriseTier: z.number().describe(`
        * * Field Name: IsEnterpriseTier
        * * Display Name: Is Enterprise Tier
        * * SQL Data Type: int`),
    AutoRenewFlag: z.number().describe(`
        * * Field Name: AutoRenewFlag
        * * Display Name: Auto Renew Flag
        * * SQL Data Type: int`),
    StandardAgreementModifiedFlag: z.number().describe(`
        * * Field Name: StandardAgreementModifiedFlag
        * * Display Name: Standard Agreement Modified Flag
        * * SQL Data Type: int`),
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
        * * Description: Total of deals in commit forecast categories when the snapshot was taken.`),
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
        * * Description: The detail behind the snapshot's totals, stored as JSON.`),
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
        * * Description: When on, a deal closed as lost with this reason must also have loss notes.`),
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
        * * Description: The status a deal takes on when it enters this stage.`),
    OrderStatusOnEntry: z.union([z.literal('Confirmed'), z.literal('Draft'), z.literal('Quoted'), z.literal('Voided')]).nullable().describe(`
        * * Field Name: OrderStatusOnEntry
        * * Display Name: Order Status On Entry
        * * SQL Data Type: nvarchar(20)
    * * Value List Type: List
    * * Possible Values 
    *   * Confirmed
    *   * Draft
    *   * Quoted
    *   * Voided`),
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
        * * Description: Conditions for leaving this stage, stored as JSON for reference. The app does not check them.`),
    RequiredFields: z.string().nullable().describe(`
        * * Field Name: RequiredFields
        * * Display Name: Required Fields
        * * SQL Data Type: nvarchar(MAX)`),
    GuidanceMarkdown: z.string().nullable().describe(`
        * * Field Name: GuidanceMarkdown
        * * Display Name: Guidance Markdown
        * * SQL Data Type: nvarchar(MAX)
        * * Description: Guidance for reps on what a deal should have at this stage, in Markdown.`),
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
        * * Description: The company that owns this pipeline. Every deal in the pipeline belongs to this company.`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Code
        * * SQL Data Type: nvarchar(40)
        * * Description: Short identifier for the pipeline, unique within its company.`),
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
        * * Description: Whether deals in this pipeline carry product lines priced by Orders, or a single amount entered by hand.`),
    CloseWonPolicy: z.string().nullable().describe(`
        * * Field Name: CloseWonPolicy
        * * Display Name: Close Won Policy
        * * SQL Data Type: nvarchar(MAX)
        * * Description: What happens when a deal in this pipeline is won, stored as JSON: whether a contract is created and of which type, and which follow-up tasks are raised.`),
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
    IncludeInForecast: z.boolean().describe(`
        * * Field Name: IncludeInForecast
        * * Display Name: Include In Forecast
        * * SQL Data Type: bit
        * * Default Value: 1
        * * Description: Whether open deals in this pipeline count toward open and weighted pipeline, the forecast buckets and the dashboard's open-deal figures. Set to 0 for a pipeline that only holds historical deals. Closed deals count toward bookings, win rate and other history regardless.`),
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
        * * Description: The account's ID, the same as its organization's ID.`),
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
        * * Description: Sales territory label for the account. It is not used to route or assign accounts.`),
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
        * * Description: Approximate number of employees as a range, for example 50-200.`),
    AnnualRevenueBand: z.string().nullable().describe(`
        * * Field Name: AnnualRevenueBand
        * * Display Name: Annual Revenue Band
        * * SQL Data Type: nvarchar(50)
        * * Description: Approximate annual revenue as a range, for example $1M-$5M.`),
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
    DefaultPrimaryContactID: z.string().nullable().describe(`
        * * Field Name: DefaultPrimaryContactID
        * * Display Name: Default Primary Contact ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Sales Contacts (vwSalesContacts.ID)
        * * Description: Contact a new deal for this account starts with as its Primary Contact. Copied onto a deal only when the deal's Primary Contact is empty; the deal's value stays editable.`),
    DefaultBillingContactID: z.string().nullable().describe(`
        * * Field Name: DefaultBillingContactID
        * * Display Name: Default Billing Contact ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Sales: Sales Contacts (vwSalesContacts.ID)
        * * Description: Contact a new deal for this account starts with as its Billing Contact. Copied onto a deal only when the deal's Billing Contact is empty; the deal's value stays editable. Empty means the deal's billing contact follows its primary contact.`),
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
        * * Display Name: Organization Type
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Common: Organization Types (vwOrganizationTypes.null)`),
    ParentID: z.string().nullable().describe(`
        * * Field Name: ParentID
        * * Display Name: Parent Organization
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Common: Organizations (vwOrganizations.null)`),
    Website: z.string().nullable().describe(`
        * * Field Name: Website
        * * Display Name: Website
        * * SQL Data Type: nvarchar(1000)`),
    LogoURL: z.string().nullable().describe(`
        * * Field Name: LogoURL
        * * Display Name: Logo URL
        * * SQL Data Type: nvarchar(MAX)`),
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
        * * Display Name: Owner
        * * SQL Data Type: nvarchar(81)`),
    AccountType: z.string().nullable().describe(`
        * * Field Name: AccountType
        * * Display Name: Account Type
        * * SQL Data Type: nvarchar(200)`),
    LifecycleStageType: z.string().nullable().describe(`
        * * Field Name: LifecycleStageType
        * * Display Name: Lifecycle Stage
        * * SQL Data Type: nvarchar(200)`),
    LeadSourceType: z.string().nullable().describe(`
        * * Field Name: LeadSourceType
        * * Display Name: Lead Source
        * * SQL Data Type: nvarchar(200)`),
    DefaultPrimaryContact: z.string().nullable().describe(`
        * * Field Name: DefaultPrimaryContact
        * * Display Name: Default Primary Contact
        * * SQL Data Type: nvarchar(704)`),
    DefaultBillingContact: z.string().nullable().describe(`
        * * Field Name: DefaultBillingContact
        * * Display Name: Default Billing Contact
        * * SQL Data Type: nvarchar(704)`),
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
        * * Description: The contact's ID, the same as its person's ID.`),
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
        * * Description: The contact's usual buying role. The role on a particular deal is set in that deal's buying team.`),
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
        * * SQL Data Type: nvarchar(MAX)`),
    Bio: z.string().nullable().describe(`
        * * Field Name: Bio
        * * Display Name: Bio
        * * SQL Data Type: nvarchar(MAX)`),
    LinkedUserID: z.string().nullable().describe(`
        * * Field Name: LinkedUserID
        * * Display Name: Linked User
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Users (vwUsers.null)`),
    Status: z.string().describe(`
        * * Field Name: Status
        * * Display Name: Status
        * * SQL Data Type: nvarchar(50)`),
    SeniorityLevelID: z.string().nullable().describe(`
        * * Field Name: SeniorityLevelID
        * * Display Name: Seniority Level
        * * SQL Data Type: uniqueidentifier`),
    OwnerEmployee: z.string().nullable().describe(`
        * * Field Name: OwnerEmployee
        * * Display Name: Owner
        * * SQL Data Type: nvarchar(81)`),
    LifecycleStageType: z.string().nullable().describe(`
        * * Field Name: LifecycleStageType
        * * Display Name: Lifecycle Stage
        * * SQL Data Type: nvarchar(200)`),
    BuyingRoleType: z.string().nullable().describe(`
        * * Field Name: BuyingRoleType
        * * Display Name: Buying Role
        * * SQL Data Type: nvarchar(200)`),
    LeadSourceType: z.string().nullable().describe(`
        * * Field Name: LeadSourceType
        * * Display Name: Lead Source
        * * SQL Data Type: nvarchar(200)`),
    DisplayNameAndEmail: z.string().describe(`
        * * Field Name: DisplayNameAndEmail
        * * Display Name: Name and Email
        * * SQL Data Type: nvarchar(704)
        * * Description: The contact's display name, followed by their primary email in brackets when they have one. Derived in vwSalesContacts; this is what lookups to a Sales Contact show instead of a GUID.`),
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
 * * @description The customer's buying team: which contact plays which role on a deal.
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
    * * Field Name: SalesContact
    * * Display Name: Sales Contact
    * * SQL Data Type: nvarchar(704)
    */
    get SalesContact(): string {
        return this.Get('SalesContact');
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
 * MJ_BizApps_Sales: Deal Payment Schedules - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: DealPaymentSchedule
 * * Base View: vwDealPaymentSchedules
 * * @description Payment instalments agreed for a deal when they differ from the standard terms. A deal on standard terms has no rows here.
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
    * * Description: The instalment amount as agreed. Can be negative for a refund or credit.
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
    * * Description: Position of the instalment in the schedule, for instalments that share a date or have none yet.
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
    * * Description: Marks the role that owns the deal. Only one team member per deal can hold it, and that person is shown as the deal's owner.
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
    * * Description: Whether more than one person can hold this role on the same deal, for example two sales engineers.
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
 * MJ_BizApps_Sales: Deal Sequences - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: DealSequence
 * * Base View: vwDealSequences
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Deal Sequences')
export class mjBizAppsSalesDealSequenceEntity extends BaseEntity<mjBizAppsSalesDealSequenceEntityType> {
    /**
    * Loads the MJ_BizApps_Sales: Deal Sequences record from the database
    * @param ID: number - primary key value to load the MJ_BizApps_Sales: Deal Sequences record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsSalesDealSequenceEntity
    * @method
    * @override
    */
    public async Load(ID: number, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: int
    * * Default Value: 1
    */
    get ID(): number {
        return this.Get('ID');
    }
    set ID(value: number) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: NextSequenceNumber
    * * Display Name: Next Sequence Number
    * * SQL Data Type: int
    * * Default Value: 1
    */
    get NextSequenceNumber(): number {
        return this.Get('NextSequenceNumber');
    }
    set NextSequenceNumber(value: number) {
        this.Set('NextSequenceNumber', value);
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
 * * @description A record of a deal moving from one stage to another, with the amount and probability at that moment. These rows are never edited.
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
    * * Description: When the stage change happened. For imported deals this is the original date, not the import date.
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
    * * Description: The deal amount at the time of this stage change.
    */
    get AmountAtTransition(): number | null {
        return this.Get('AmountAtTransition');
    }
    set AmountAtTransition(value: number | null) {
        this.Set('AmountAtTransition', value);
    }

    /**
    * * Field Name: AmountAtTransitionIsComputed
    * * Display Name: Amount At Transition Is Computed
    * * SQL Data Type: bit
    * * Description: On when the amount at this stage change was the order total, off when it was entered by hand. Empty for changes recorded before this was tracked.
    */
    get AmountAtTransitionIsComputed(): boolean | null {
        return this.Get('AmountAtTransitionIsComputed');
    }
    set AmountAtTransitionIsComputed(value: boolean | null) {
        this.Set('AmountAtTransitionIsComputed', value);
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
 * * @description The outcomes a deal can be in, such as Open, Won, Lost or On Hold. The flags on each status decide how a deal in it behaves.
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
    * * Description: Short fixed identifier for the status. Renaming the status is safe; changing its code is not.
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
    * * Description: When on, a deal in this status is locked until it is reopened: its lines, payment schedule, team and every field except Description and Next Step become read-only.
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
 * * @description The internal people on a deal and the role each holds, including the owner. Totals by rep must count only the owner role or weight by attribution, or a deal is counted once per member.
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
    * * Description: The team member, when they are an employee. Set this or Person, not both.
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
    * * Description: The team member, when they are not an employee, such as a partner rep. Set this or Employee, not both.
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
 * * @description A sales opportunity with an account. Its amount comes from the deal's order, and winning it follows the pipeline's close-won policy.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Deals')
export class mjBizAppsSalesDealEntity extends BaseEntity<mjBizAppsSalesDealEntityType> {

  /**
  * Related records: MJ_BizApps_Sales: Deal Team Members
  *
  * Loads, validates and persists as one unit with this MJ_BizApps_Sales: Deals record — see
  * guides/TRANSACTIONS_AND_BATCHING_GUIDE.md. Declared by the RelatedRecordCollection metadata on
  * the 'MJ_BizApps_Sales: Deals → MJ_BizApps_Sales: Deal Team Members' relationship; edit that row, not this file.
  *
  */
  public readonly Team = this.DeclareRelatedRecords<mjBizAppsSalesDealTeamMemberEntity>({
      Name: 'Team',
        RelatedEntity: 'MJ_BizApps_Sales: Deal Team Members',
        RelatedEntityJoinField: 'DealID',
        OrderBy: '__mj_CreatedAt ASC',
        Load: 'explicit',
        OnRemove: 'delete',
        Source: 'database',
  });


  /**
  * Related records: MJ_BizApps_Sales: Deal Payment Schedules
  *
  * Loads, validates and persists as one unit with this MJ_BizApps_Sales: Deals record — see
  * guides/TRANSACTIONS_AND_BATCHING_GUIDE.md. Declared by the RelatedRecordCollection metadata on
  * the 'MJ_BizApps_Sales: Deals → MJ_BizApps_Sales: Deal Payment Schedules' relationship; edit that row, not this file.
  *
  */
  public readonly PaymentSchedule = this.DeclareRelatedRecords<mjBizAppsSalesDealPaymentScheduleEntity>({
      Name: 'PaymentSchedule',
        RelatedEntity: 'MJ_BizApps_Sales: Deal Payment Schedules',
        RelatedEntityJoinField: 'DealID',
        OrderBy: 'DisplayOrder ASC',
        Load: 'explicit',
        OnRemove: 'delete',
        Source: 'database',
        Sequence: { Field: 'DisplayOrder', From: 1 },
  });

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
    * * Display Name: Primary Contact
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
    * * Display Name: Billing Contact
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Sales Contacts (vwSalesContacts.ID)
    * * Description: The contact who receives the invoice. Leave empty to use the primary contact.
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
    * * Description: The company selling the deal. It must match the pipeline's company.
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
    * * Description: The deal owner: the team member in the owner role. Updated automatically from the deal team.
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
    * * Description: The deal value. For a deal with product lines it is the order total calculated by Orders; for a deal without lines it is entered by hand.
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
    * * Description: On when Amount is the order total calculated by Orders; off when it was entered by hand.
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
    * * Description: Fingerprint of the order lines the amount was calculated from, used to tell when the amount is out of date.
    */
    get AmountSourceHash(): string | null {
        return this.Get('AmountSourceHash');
    }
    set AmountSourceHash(value: string | null) {
        this.Set('AmountSourceHash', value);
    }

    /**
    * * Field Name: CurrencyID
    * * Display Name: Currency
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Accounting: Currencies (vwCurrencies.ID)
    */
    get CurrencyID(): string | null {
        return this.Get('CurrencyID');
    }
    set CurrencyID(value: string | null) {
        this.Set('CurrencyID', value);
    }

    /**
    * * Field Name: MRR
    * * Display Name: MRR
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
    * * Display Name: ARR
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
    * * Description: Estimated project length in weeks, from the statement of work. It does not affect the term or renewal dates.
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
    * * Description: The date the agreement was signed. It can be after the start date when work begins before signature.
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
    * * Description: The date the service or subscription begins. It can be before the execution date.
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
    * * Display Name: Campaign
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
    * * Display Name: Contract
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Contracts: Contracts (vwContracts.ID)
    * * Description: The contract this deal belongs to, in BizApps Contracts.
    */
    get ContractID(): string | null {
        return this.Get('ContractID');
    }
    set ContractID(value: string | null) {
        this.Set('ContractID', value);
    }

    /**
    * * Field Name: RenewsContractID
    * * Display Name: Renews Contract
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Contracts: Contracts (vwContracts.ID)
    * * Description: The contract this deal renews. Required for deal types that are renewals.
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
    * * Description: Annual price increase agreed for this deal, as a percent. Leave empty to use the contract type's standard increase.
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
    * * Description: Cancellation notice period agreed for this deal, in days. Leave empty to use the contract type's standard notice period.
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
    * * Description: How the customer expects to pay, for example ACH. For reference only.
    */
    get PaymentMethod(): string | null {
        return this.Get('PaymentMethod');
    }
    set PaymentMethod(value: string | null) {
        this.Set('PaymentMethod', value);
    }

    /**
    * * Field Name: StandardAgreementModified
    * * Display Name: Standard Agreement Modified
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: Whether the deal moved off the standard agreement. Copied to the contract when the deal is won, where it tells finance to review the changes.
    */
    get StandardAgreementModified(): boolean {
        return this.Get('StandardAgreementModified');
    }
    set StandardAgreementModified(value: boolean) {
        this.Set('StandardAgreementModified', value);
    }

    /**
    * * Field Name: ContractVariances
    * * Display Name: Contract Variances
    * * SQL Data Type: nvarchar(MAX)
    * * Description: Summary of the terms negotiated away from the standard agreement, for legal review.
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
    * * Field Name: OrderID
    * * Display Name: Order ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Orders: Order Headers (vwOrderHeaders.ID)
    */
    get OrderID(): string | null {
        return this.Get('OrderID');
    }
    set OrderID(value: string | null) {
        this.Set('OrderID', value);
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
    * * Field Name: PredictedWinProbability
    * * Display Name: Predicted Win Probability
    * * SQL Data Type: decimal(5, 4)
    * * Description: 0.0000 to 1.0000 probability that the deal will close as Won.
    */
    get PredictedWinProbability(): number | null {
        return this.Get('PredictedWinProbability');
    }
    set PredictedWinProbability(value: number | null) {
        this.Set('PredictedWinProbability', value);
    }

    /**
    * * Field Name: PredictedWinRiskBand
    * * Display Name: Predicted Win Risk Band
    * * SQL Data Type: nvarchar(20)
    * * Value List Type: List
    * * Possible Values 
    *   * Critical
    *   * High
    *   * Low
    *   * Medium
    * * Description: Categorical priority/risk tier derived from deal win probability: Low, Medium, High, Critical.
    */
    get PredictedWinRiskBand(): 'Critical' | 'High' | 'Low' | 'Medium' | null {
        return this.Get('PredictedWinRiskBand');
    }
    set PredictedWinRiskBand(value: 'Critical' | 'High' | 'Low' | 'Medium' | null) {
        this.Set('PredictedWinRiskBand', value);
    }

    /**
    * * Field Name: PredictedWinScoredAt
    * * Display Name: Predicted Win Scored At
    * * SQL Data Type: datetimeoffset
    * * Description: Timestamp when the deal was last scored by the predictive deal win propensity model.
    */
    get PredictedWinScoredAt(): Date | null {
        return this.Get('PredictedWinScoredAt');
    }
    set PredictedWinScoredAt(value: Date | null) {
        this.Set('PredictedWinScoredAt', value);
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
    * * Display Name: Status
    * * SQL Data Type: nvarchar(200)
    */
    get DealStatusType(): string | null {
        return this.Get('DealStatusType');
    }

    /**
    * * Field Name: Account
    * * Display Name: Account
    * * SQL Data Type: nvarchar(255)
    */
    get Account(): string | null {
        return this.Get('Account');
    }

    /**
    * * Field Name: PrimaryContact
    * * Display Name: Primary Contact
    * * SQL Data Type: nvarchar(704)
    */
    get PrimaryContact(): string | null {
        return this.Get('PrimaryContact');
    }

    /**
    * * Field Name: BillingContact
    * * Display Name: Billing Contact
    * * SQL Data Type: nvarchar(704)
    */
    get BillingContact(): string | null {
        return this.Get('BillingContact');
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
    * * Display Name: Forecast Category
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

    /**
    * * Field Name: Order
    * * Display Name: Order
    * * SQL Data Type: nvarchar(40)
    */
    get Order(): string | null {
        return this.Get('Order');
    }

    /**
    * * Field Name: WinOutcome
    * * Display Name: Win Outcome
    * * SQL Data Type: int
    */
    get WinOutcome(): number | null {
        return this.Get('WinOutcome');
    }

    /**
    * * Field Name: DaysToExpectedClose
    * * Display Name: Days To Expected Close
    * * SQL Data Type: int
    */
    get DaysToExpectedClose(): number | null {
        return this.Get('DaysToExpectedClose');
    }

    /**
    * * Field Name: HasPaymentSchedule
    * * Display Name: Has Payment Schedule
    * * SQL Data Type: int
    */
    get HasPaymentSchedule(): number {
        return this.Get('HasPaymentSchedule');
    }

    /**
    * * Field Name: TeamMemberCount
    * * Display Name: Team Member Count
    * * SQL Data Type: int
    */
    get TeamMemberCount(): number {
        return this.Get('TeamMemberCount');
    }

    /**
    * * Field Name: HasPartnerInvolved
    * * Display Name: Has Partner Involved
    * * SQL Data Type: int
    */
    get HasPartnerInvolved(): number {
        return this.Get('HasPartnerInvolved');
    }

    /**
    * * Field Name: IsEnterpriseTier
    * * Display Name: Is Enterprise Tier
    * * SQL Data Type: int
    */
    get IsEnterpriseTier(): number {
        return this.Get('IsEnterpriseTier');
    }

    /**
    * * Field Name: AutoRenewFlag
    * * Display Name: Auto Renew Flag
    * * SQL Data Type: int
    */
    get AutoRenewFlag(): number {
        return this.Get('AutoRenewFlag');
    }

    /**
    * * Field Name: StandardAgreementModifiedFlag
    * * Display Name: Standard Agreement Modified Flag
    * * SQL Data Type: int
    */
    get StandardAgreementModifiedFlag(): number {
        return this.Get('StandardAgreementModifiedFlag');
    }
}


/**
 * MJ_BizApps_Sales: Forecast Category Types - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: ForecastCategoryType
 * * Base View: vwForecastCategoryTypes
 * * @description How a deal counts in the forecast: Omitted, Pipeline, Best Case, Commit or Closed. The Include flags on each category decide which forecast totals it adds to.
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
 * * @description The forecast for a pipeline and owner as captured on a given day, so past forecasts can be compared with today's.
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
    * * Description: Total of deals in commit forecast categories when the snapshot was taken.
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
    * * Description: The detail behind the snapshot's totals, stored as JSON.
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
 * * @description Where a person or organization is in the customer journey, from Subscriber to Customer. A lead is a contact at the Lead stage, not a separate record.
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
 * * @description Why a deal was lost. Closing a deal as lost requires one.
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
    * * Description: When on, a deal closed as lost with this reason must also have loss notes.
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
 * * @description An ordered stage within a pipeline. Each stage sets the status a deal takes on when it enters the stage.
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
    * * Description: The status a deal takes on when it enters this stage.
    */
    get DealStatusTypeID(): string | null {
        return this.Get('DealStatusTypeID');
    }
    set DealStatusTypeID(value: string | null) {
        this.Set('DealStatusTypeID', value);
    }

    /**
    * * Field Name: OrderStatusOnEntry
    * * Display Name: Order Status On Entry
    * * SQL Data Type: nvarchar(20)
    * * Value List Type: List
    * * Possible Values 
    *   * Confirmed
    *   * Draft
    *   * Quoted
    *   * Voided
    */
    get OrderStatusOnEntry(): 'Confirmed' | 'Draft' | 'Quoted' | 'Voided' | null {
        return this.Get('OrderStatusOnEntry');
    }
    set OrderStatusOnEntry(value: 'Confirmed' | 'Draft' | 'Quoted' | 'Voided' | null) {
        this.Set('OrderStatusOnEntry', value);
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
    * * Description: Conditions for leaving this stage, stored as JSON for reference. The app does not check them.
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
    * * Description: Guidance for reps on what a deal should have at this stage, in Markdown.
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
    * * Description: The company that owns this pipeline. Every deal in the pipeline belongs to this company.
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
    * * Description: Short identifier for the pipeline, unique within its company.
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
    * * Description: Whether deals in this pipeline carry product lines priced by Orders, or a single amount entered by hand.
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
    * * Description: What happens when a deal in this pipeline is won, stored as JSON: whether a contract is created and of which type, and which follow-up tasks are raised.
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
    * * Field Name: IncludeInForecast
    * * Display Name: Include In Forecast
    * * SQL Data Type: bit
    * * Default Value: 1
    * * Description: Whether open deals in this pipeline count toward open and weighted pipeline, the forecast buckets and the dashboard's open-deal figures. Set to 0 for a pipeline that only holds historical deals. Closed deals count toward bookings, win rate and other history regardless.
    */
    get IncludeInForecast(): boolean {
        return this.Get('IncludeInForecast');
    }
    set IncludeInForecast(value: boolean) {
        this.Set('IncludeInForecast', value);
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
 * * @description Sales details for an organization you sell to. The account and its organization are one record.
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
    * * Description: The account's ID, the same as its organization's ID.
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
    * * Description: Sales territory label for the account. It is not used to route or assign accounts.
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
    * * Description: Approximate number of employees as a range, for example 50-200.
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
    * * Description: Approximate annual revenue as a range, for example $1M-$5M.
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
    * * Field Name: DefaultPrimaryContactID
    * * Display Name: Default Primary Contact ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Sales Contacts (vwSalesContacts.ID)
    * * Description: Contact a new deal for this account starts with as its Primary Contact. Copied onto a deal only when the deal's Primary Contact is empty; the deal's value stays editable.
    */
    get DefaultPrimaryContactID(): string | null {
        return this.Get('DefaultPrimaryContactID');
    }
    set DefaultPrimaryContactID(value: string | null) {
        this.Set('DefaultPrimaryContactID', value);
    }

    /**
    * * Field Name: DefaultBillingContactID
    * * Display Name: Default Billing Contact ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Sales: Sales Contacts (vwSalesContacts.ID)
    * * Description: Contact a new deal for this account starts with as its Billing Contact. Copied onto a deal only when the deal's Billing Contact is empty; the deal's value stays editable. Empty means the deal's billing contact follows its primary contact.
    */
    get DefaultBillingContactID(): string | null {
        return this.Get('DefaultBillingContactID');
    }
    set DefaultBillingContactID(value: string | null) {
        this.Set('DefaultBillingContactID', value);
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
    * * Display Name: Organization Type
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Common: Organization Types (vwOrganizationTypes.null)
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
    * * Display Name: Parent Organization
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Common: Organizations (vwOrganizations.null)
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
    * * SQL Data Type: nvarchar(MAX)
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
    * * Display Name: Owner
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
    * * Display Name: Lifecycle Stage
    * * SQL Data Type: nvarchar(200)
    */
    get LifecycleStageType(): string | null {
        return this.Get('LifecycleStageType');
    }

    /**
    * * Field Name: LeadSourceType
    * * Display Name: Lead Source
    * * SQL Data Type: nvarchar(200)
    */
    get LeadSourceType(): string | null {
        return this.Get('LeadSourceType');
    }

    /**
    * * Field Name: DefaultPrimaryContact
    * * Display Name: Default Primary Contact
    * * SQL Data Type: nvarchar(704)
    */
    get DefaultPrimaryContact(): string | null {
        return this.Get('DefaultPrimaryContact');
    }

    /**
    * * Field Name: DefaultBillingContact
    * * Display Name: Default Billing Contact
    * * SQL Data Type: nvarchar(704)
    */
    get DefaultBillingContact(): string | null {
        return this.Get('DefaultBillingContact');
    }
}


/**
 * MJ_BizApps_Sales: Sales Contacts - strongly typed entity sub-class
 * * Schema: __mj_BizAppsSales
 * * Base Table: SalesContact
 * * Base View: vwSalesContacts
 * * @description Sales details for a person you sell to. The contact and its person are one record.
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
    * * Description: The contact's ID, the same as its person's ID.
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
    * * Description: The contact's usual buying role. The role on a particular deal is set in that deal's buying team.
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
    * * SQL Data Type: nvarchar(MAX)
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
    * * Display Name: Linked User
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Users (vwUsers.null)
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
    * * Field Name: SeniorityLevelID
    * * Display Name: Seniority Level
    * * SQL Data Type: uniqueidentifier
    * * IS-A Source: Inherited from MJ_BizApps_Common: People
    */
    get SeniorityLevelID(): string | null {
        return this.Get('SeniorityLevelID');
    }
    set SeniorityLevelID(value: string | null) {
        this.Set('SeniorityLevelID', value);
    }

    /**
    * * Field Name: OwnerEmployee
    * * Display Name: Owner
    * * SQL Data Type: nvarchar(81)
    */
    get OwnerEmployee(): string | null {
        return this.Get('OwnerEmployee');
    }

    /**
    * * Field Name: LifecycleStageType
    * * Display Name: Lifecycle Stage
    * * SQL Data Type: nvarchar(200)
    */
    get LifecycleStageType(): string | null {
        return this.Get('LifecycleStageType');
    }

    /**
    * * Field Name: BuyingRoleType
    * * Display Name: Buying Role
    * * SQL Data Type: nvarchar(200)
    */
    get BuyingRoleType(): string | null {
        return this.Get('BuyingRoleType');
    }

    /**
    * * Field Name: LeadSourceType
    * * Display Name: Lead Source
    * * SQL Data Type: nvarchar(200)
    */
    get LeadSourceType(): string | null {
        return this.Get('LeadSourceType');
    }

    /**
    * * Field Name: DisplayNameAndEmail
    * * Display Name: Name and Email
    * * SQL Data Type: nvarchar(704)
    * * Description: The contact's display name, followed by their primary email in brackets when they have one. Derived in vwSalesContacts; this is what lookups to a Sales Contact show instead of a GUID.
    */
    get DisplayNameAndEmail(): string {
        return this.Get('DisplayNameAndEmail');
    }
}
