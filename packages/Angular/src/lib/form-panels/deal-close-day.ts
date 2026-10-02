import { BusinessTimeZoneEngine, CalendarDayIn, IsCalendarDay } from '@mj-biz-apps/common-entities';

/**
 * The BUSINESS day an instant fell on, for `companyID` (bc-aidp-next-golive#168).
 *
 * `__mj_CreatedAt` and `ClosedAt` are instants. `ActualCloseDate` is a calendar day stamped in the
 * business zone, so subtracting the UTC day of an instant from it mixes two zones: a deal created at
 * 8 PM Central on the 30th has a UTC day of the 1st, and a cycle ending on the 30th read as "—" or a day
 * short. Taking the instant's day in the same zone keeps both ends of a day count comparable.
 *
 * A bare `YYYY-MM-DD` is already a day and is returned as it is. Synchronous, so it relies on the caller
 * having configured the engine (`BusinessTimeZoneEngine.Instance.Config`); unconfigured, the zone is UTC.
 */
export function BusinessDayOf(
    value: Date | string | null | undefined,
    companyID: string | null | undefined,
): string | null {
    if (!value) return null;
    if (IsCalendarDay(value)) return value;
    const instant = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(instant.getTime())) return null;
    return CalendarDayIn(instant, BusinessTimeZoneEngine.Instance.Resolve(companyID ?? undefined));
}

/**
 * The business day a deal closed on: `ActualCloseDate`, or — on a legacy row carrying only the instant —
 * `ClosedAt`'s day in the business zone, so the fallback is the same kind of day (golive#168).
 *
 * ONE answer for every close figure on the form. The overview's sales cycle and close variance and the
 * close-date labels on the overview and the hero all read this, so a legacy row cannot show "Closed
 * Oct 1" beside an "on time" counted from 30 September. The result is a `DATE`-shaped value (UTC
 * midnight) or a `YYYY-MM-DD` string; both format to the right day with `timeZone: 'UTC'`.
 */
export function DealCloseDay(
    deal: { ActualCloseDate?: Date | string | null; ClosedAt?: Date | string | null; CompanyID?: string | null } | null | undefined,
): Date | string | null {
    if (!deal) return null;
    return deal.ActualCloseDate ?? BusinessDayOf(deal.ClosedAt, deal.CompanyID);
}
