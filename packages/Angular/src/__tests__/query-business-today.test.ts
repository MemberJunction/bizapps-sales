/**
 * The dashboard's "past expected close" and the roster's `IsPastExpectedClose` are judged against the
 * BUSINESS day, and cycle time starts on one (bc-aidp-next-golive#168).
 *
 * Both queries compared `ExpectedCloseDate < CAST(SYSUTCDATETIME() AS DATE)` — the UTC day, which is
 * already tomorrow from 6 PM Central (7 PM in daylight time) — so every evening a deal due TODAY was counted past due on the
 * dashboard tile, flagged on the roster, and badged in the nav. The client side of the same dashboard
 * already took "today" from `BusinessTimeZoneEngine`, so the tile and the list beside it disagreed.
 *
 * Cycle time measured from a start instant CAST to a DATE (the UTC day) to an `ActualCloseDate` that
 * is now stamped on the business day, so the two ends of the subtraction were in different zones. The
 * won-deals exception list fell back to the same UTC day of `ClosedAt` when `ActualCloseDate` was null.
 * Both now use `[__mj_BizAppsCommon].[fnBusinessDayOf]()`.
 *
 * STATIC, because these run as MJ Queries against a live database that unit tests do not have.
 * Comments are stripped first: both files now explain the old predicate in prose, and a test that a
 * comment could satisfy would pass through a revert of the code beneath it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sqlOf = (name: string): string =>
    readFileSync(new URL(`../../../../metadata/queries/SQL/${name}`, import.meta.url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/--.*$/gm, '');

const BUSINESS_TODAY = /CROSS JOIN \[__mj_BizAppsCommon\]\.\[fnBusinessToday\]\(\) AS bt/;

describe('"past expected close" is judged on the business day', () => {
    for (const file of ['dashboard-summary.sql', 'deal-roster.sql']) {
        it(`${file} compares ExpectedCloseDate to fnBusinessToday(), not the UTC day`, () => {
            const sql = sqlOf(file);
            expect(sql).toMatch(BUSINESS_TODAY);
            // The summary compares its scoped rows (`s.`), the roster the deal view (`d.`).
            expect(sql).toMatch(/[ds]\.ExpectedCloseDate < bt\.Today/);
            expect(sql).not.toMatch(/SYSUTCDATETIME|GETUTCDATE|GETDATE|SYSDATETIME/i);
        });
    }
});

describe('cycle time starts on the business day, like the close it is measured to', () => {
    it('takes the start instant\'s business day with fnBusinessDayOf() before subtracting', () => {
        const sql = sqlOf('deal-cycle-time.sql');
        expect(sql).toMatch(
            /SELECT \[__mj_BizAppsCommon\]\.\[fnBusinessDayOf\]\(\s*CASE WHEN ev\.FirstEventAt[\s\S]*?END\) AS StartedAt/,
        );
        // AT TIME ZONE is what MJ's SQL parser cannot read; see query-parses-with-mj-parser.test.ts.
        expect(sql).not.toMatch(/AT TIME ZONE/i);
        expect(sql).not.toMatch(/CAST\([\s\S]*?__mj_CreatedAt[\s\S]*?AS DATE\)/);
    });
});

describe('a won deal with only ClosedAt falls back to its business day', () => {
    it('won-deals-order-not-confirmed.sql takes fnBusinessDayOf(ClosedAt), not CAST(ClosedAt AS DATE)', () => {
        const sql = sqlOf('won-deals-order-not-confirmed.sql');
        expect(sql).toMatch(
            /COALESCE\(d\.ActualCloseDate, \[__mj_BizAppsCommon\]\.\[fnBusinessDayOf\]\(d\.ClosedAt\)\) AS CloseDate/,
        );
        expect(sql).not.toMatch(/CAST\(d\.ClosedAt AS DATE\)/i);
    });
});

/**
 * #289: a DATETIMEOFFSET column compared to a date-only period parameter put each bound at UTC
 * midnight, so an evening (Central) event on the last day of the window fell out and one from the
 * evening before it fell in. Each bound is now judged on the column's business day, beside a padded
 * UTC range that is there only so an index can narrow the scan.
 */
const PERIOD_BOUNDS: { file: string; column: string; bounds: string[] }[] = [
    { file: 'slippage.sql', column: 'rc.ChangedAt', bounds: ['PeriodStart', 'PeriodEnd'] },
    { file: 'stage-conversion-and-dwell.sql', column: 'e.ChangedAt', bounds: ['PeriodStart', 'PeriodEnd'] },
    { file: 'forecast-history.sql', column: 'fs.CapturedAt', bounds: ['CapturedOnOrBefore'] },
];

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('timestamp period filters are judged on the business day', () => {
    for (const { file, column, bounds } of PERIOD_BOUNDS) {
        it(`${file} filters ${column} by fnBusinessDayOf(), never against a bare date`, () => {
            const sql = sqlOf(file);
            const col = escape(column);
            for (const bound of bounds) {
                const op = bound === 'PeriodStart' ? '>=' : '<=';
                expect(sql).toMatch(
                    new RegExp(`\\[__mj_BizAppsCommon\\]\\.\\[fnBusinessDayOf\\]\\(${col}\\) ${op} \\{\\{ ${bound} \\| sqlString \\}\\}`),
                );
            }
            // The UTC column compared straight to a date parameter is the bug itself.
            expect(sql).not.toMatch(new RegExp(`${col}\\s*<=\\s*\\{\\{`));
            expect(sql).not.toMatch(new RegExp(`${col}\\s*>=\\s*\\{\\{`));
            expect(sql).not.toMatch(/AT TIME ZONE/i);
        });
    }
});
