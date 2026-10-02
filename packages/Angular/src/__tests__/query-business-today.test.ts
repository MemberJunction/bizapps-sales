/**
 * The dashboard's "past expected close" and the roster's `IsPastExpectedClose` are judged against the
 * BUSINESS day, and cycle time starts on one (bc-aidp-next-golive#168).
 *
 * Both queries compared `ExpectedCloseDate < CAST(SYSUTCDATETIME() AS DATE)` — the UTC day, which is
 * already tomorrow from 7 PM Central — so every evening a deal due TODAY was counted past due on the
 * dashboard tile, flagged on the roster, and badged in the nav. The client side of the same dashboard
 * already took "today" from `BusinessTimeZoneEngine`, so the tile and the list beside it disagreed.
 *
 * Cycle time measured from a start instant CAST to a DATE (the UTC day) to an `ActualCloseDate` that
 * is now stamped on the business day, so the two ends of the subtraction were in different zones.
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
            expect(sql).toMatch(/d\.ExpectedCloseDate < bt\.Today/);
            expect(sql).not.toMatch(/SYSUTCDATETIME|GETUTCDATE|GETDATE|SYSDATETIME/i);
        });
    }
});

describe('cycle time starts on the business day, like the close it is measured to', () => {
    it('converts the start instant AT TIME ZONE the business SqlZone before taking its day', () => {
        const sql = sqlOf('deal-cycle-time.sql');
        expect(sql).toMatch(BUSINESS_TODAY);
        expect(sql).toMatch(/AT TIME ZONE bt\.SqlZone AS DATE\) AS StartedAt/);
    });
});
