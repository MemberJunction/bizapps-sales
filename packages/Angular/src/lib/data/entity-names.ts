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
    SalesAccount: 'MJ_BizApps_Sales: Sales Accounts',
    SalesContact: 'MJ_BizApps_Sales: Sales Contacts',
} as const;

/** Common (and MJ core) entities this app contributes onto — we do not own these forms. */
export const MJS_FOREIGN_ENTITIES = {
    Organization: 'MJ_BizApps_Common: Organizations',
    Person: 'MJ_BizApps_Common: People',
    Employee: 'MJ: Employees',
    OrderLine: 'MJ_BizApps_Orders: Order Lines',
    Activity: 'MJ_BizApps_Common: Activities',
    ActivityLink: 'MJ_BizApps_Common: Activity Links',
} as const;
