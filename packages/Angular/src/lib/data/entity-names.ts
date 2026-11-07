/**
 * @fileoverview Entity names as constants. MJ addresses entities by NAME as a string — a typo
 * compiles and fails at runtime as an empty grid.
 *
 * @module @mj-biz-apps/sales-ng
 */

export const MJS_ENTITIES = {
    Deal: 'MJ_BizApps_Sales: Deals',
    DealTeamMember: 'MJ_BizApps_Sales: Deal Team Members',
    DealContactRole: 'MJ_BizApps_Sales: Deal Contact Roles',
    DealStageEvent: 'MJ_BizApps_Sales: Deal Stage Events',
    DealPaymentSchedule: 'MJ_BizApps_Sales: Deal Payment Schedules',
    Pipeline: 'MJ_BizApps_Sales: Pipelines',
    /** A pipeline's selling companies. Read to offer a company's pipelines and to pre-fill a deal's company. */
    PipelineCompany: 'MJ_BizApps_Sales: Pipeline Companies',
    SalesAccount: 'MJ_BizApps_Sales: Sales Accounts',
    SalesContact: 'MJ_BizApps_Sales: Sales Contacts',
} as const;

/** Common (and MJ core) entities this app contributes onto — we do not own these forms. */
export const MJS_FOREIGN_ENTITIES = {
    Organization: 'MJ_BizApps_Common: Organizations',
    Person: 'MJ_BizApps_Common: People',
    Employee: 'MJ: Employees',
    OrderHeader: 'MJ_BizApps_Orders: Order Headers',
    OrderLine: 'MJ_BizApps_Orders: Order Lines',
    /** Read to warn when a deal's account has no Bill.com customer. See `billcom-customer.ts`. */
    PaymentProviderType: 'MJ_BizApps_Orders: Payment Provider Types',
    PaymentProvider: 'MJ_BizApps_Orders: Payment Providers',
    ExternalCustomer: 'MJ_BizApps_Orders: External Customers',
    /**
     * Contracts' agreement. A deal holds TWO soft references to it — the contract the win produced
     * and the contract a renewal renews — and neither is a database FK, which is what left both
     * rendering as raw GUIDs until golive#226. Nothing resolves them in either direction, which is
     * also why the contract behind an ORDER can only be reached through that order's deal
     * (golive#227), by reading the deal row.
     */
    Contract: 'MJ_BizApps_Contracts: Contracts',
    /**
     * MJ core's file table and its polymorphic record link. A contract's executed agreement is the
     * file linked to it whose category is 'Executed Agreement' (golive#445); contracts ships no FK for
     * it, so it is found the way `vwContracts.IsAwaitingDocument` finds it.
     */
    File: 'MJ: Files',
    FileEntityRecordLink: 'MJ: File Entity Record Links',
    Activity: 'MJ_BizApps_Common: Activities',
    ActivityLink: 'MJ_BizApps_Common: Activity Links',
    /** Common's person/organization link. The only record of who works at an account (#301). */
    Relationship: 'MJ_BizApps_Common: Relationships',
} as const;
