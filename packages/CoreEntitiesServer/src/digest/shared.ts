/**
 * @fileoverview The few things the digest's files all need: entity names, the case-folding every ID
 * comparison uses, and the one deal counter. Nothing else belongs here.
 */
import type { CompanyGroup } from './audience.js';

export const DEAL_ENTITY = 'MJ_BizApps_Sales: Deals';
export const EMPLOYEE_ENTITY = 'MJ: Employees';
export const AUDIENCE_ENTITY = 'MJ_BizApps_Sales: Deal Digest Audience Types';
export const RECIPIENT_ENTITY = 'MJ_BizApps_Sales: Deal Digest Recipients';

/** SQL Server returns GUIDs upper case and other providers lower; every ID comparison folds case first. */
export const lower = (id: string | null | undefined): string => (id ?? '').toLowerCase();

/** How many deals a recipient's groups hold. The one definition: the render and the run must agree. */
export function CountDeals(groups: readonly CompanyGroup[]): number {
    return groups.reduce((n, g) => n + g.Deals.length, 0);
}
