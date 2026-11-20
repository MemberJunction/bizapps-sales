/**
 * @fileoverview The few things the digest's files all need: entity names and the one deal counter.
 * UUID comparisons use `UUIDsEqual` and UUID map/set keys use `NormalizeUUID` from `@memberjunction/global`.
 */
import type { CompanyGroup } from './audience.js';

export const DEAL_ENTITY = 'MJ_BizApps_Sales: Deals';
export const EMPLOYEE_ENTITY = 'MJ: Employees';
export const AUDIENCE_ENTITY = 'MJ_BizApps_Sales: Deal Digest Audience Types';
export const RECIPIENT_ENTITY = 'MJ_BizApps_Sales: Deal Digest Recipients';

/** How many deals a recipient's groups hold. The one definition: the render and the run must agree. */
export function CountDeals(groups: readonly CompanyGroup[]): number {
    return groups.reduce((n, g) => n + g.Deals.length, 0);
}
