import { NormalizeUUID, UUIDsEqual } from '@memberjunction/global';
import { FromCalendarDay, type CalendarDay } from '@mj-biz-apps/common-entities';

/** One row of the digest audience table; the seeded rows are COMPANY_LEADER, CEO, CFO and CTO. */
export interface DigestAudience {
    ID: string; Code: string; Name: string;
    IsPortfolioWide: boolean; MinDaysLapsed: number | null;
    IncludeMissingCloseDate: boolean; SendWhenEmpty: boolean;
    GroupByCompany: boolean;
    SubjectTemplate: string | null; IntroTemplate: string | null; EmptyMessage: string | null;
    DisplayRank: number;
}

/** An open deal whose expected close date has passed or was never set. `StageName` is for display only. */
export interface LapsedDeal {
    ID: string; Name: string; CompanyID: string; CompanyName: string;
    OwnerName: string; Amount: number | null;
    /** Soft reference to accounting's Currencies; null when the deal has none. */
    CurrencyID: string | null;
    ExpectedCloseDate: CalendarDay | null; DaysLapsed: number | null;
    StageName: string;
}

export interface CompanyGroup { CompanyID: string; CompanyName: string; Deals: LapsedDeal[] }

const MS_PER_DAY = 86_400_000;

/**
 * Whole days from the close date to today, or null when the close date was never set.
 * Both days become UTC-midnight instants, so the difference is exact and DST cannot perturb it.
 */
export function ComputeDaysLapsed(closeDate: CalendarDay | null, today: CalendarDay): number | null {
    if (closeDate === null || closeDate === undefined) return null;
    const ms = FromCalendarDay(today).getTime() - FromCalendarDay(closeDate).getTime();
    return Math.max(0, ms / MS_PER_DAY);
}

/**
 * The deals this audience receives, grouped by company and sorted by company name.
 * MinDaysLapsed is a strict floor; a never-set close date is judged only by IncludeMissingCloseDate.
 */
export function SelectForAudience(
    deals: readonly LapsedDeal[],
    audience: DigestAudience,
    recipientCompanyID: string | null,
): CompanyGroup[] {
    const kept = deals.filter(d => {
        if (!audience.IsPortfolioWide && !UUIDsEqual(d.CompanyID, recipientCompanyID)) return false;
        if (d.DaysLapsed === null || d.DaysLapsed === undefined) return audience.IncludeMissingCloseDate;
        if (audience.MinDaysLapsed === null || audience.MinDaysLapsed === undefined) return true;
        return d.DaysLapsed > audience.MinDaysLapsed;
    });

    const byCompany = new Map<string, CompanyGroup>();
    for (const d of kept) {
        const key = NormalizeUUID(d.CompanyID);
        let group = byCompany.get(key);
        if (!group) {
            group = { CompanyID: d.CompanyID, CompanyName: d.CompanyName, Deals: [] };
            byCompany.set(key, group);
        }
        group.Deals.push(d);
    }
    return [...byCompany.values()].sort((a, b) =>
        a.CompanyName.localeCompare(b.CompanyName, undefined, { sensitivity: 'base' }));
}
