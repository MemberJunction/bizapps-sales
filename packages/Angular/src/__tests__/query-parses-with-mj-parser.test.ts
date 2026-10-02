/**
 * The queries this app's business-day work touched still PARSE with MemberJunction's SQL parser
 * (bc-aidp-next-golive#168, adversarial review of bizapps-sales#154).
 *
 * `MJQueryEntityServer` runs `SQLParser` over a query's SQL on every save, to validate the dialect and
 * to extract the tables and select columns it records as Query Entities and Query Fields. node-sql-parser
 * cannot read T-SQL's `AT TIME ZONE`, and an inline `... AT TIME ZONE bt.SqlZone AS DATE` in
 * `deal-cycle-time.sql` made the full parse fail: the regex fallback reported tables named `creation`
 * and `the` and ZERO select columns. Nothing failed loudly; the query's extracted metadata was simply
 * wrong. The business-day conversion is now `[__mj_BizAppsCommon].[fnBusinessDayOf]()`, which parses.
 *
 * THE PARSER IS THE ONE MJ USES, resolved through `@memberjunction/core-entities-server`'s own
 * dependencies rather than a copy this repo declares, so the version measured is the version that runs.
 *
 * SCOPED TO THE FILES #154 TOUCHED. `bookings-by-period.sql` already fails the same way on `next`
 * (zero select columns) for an unrelated reason; it is reported, not fixed, here.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

interface TableRef { TableName: string }
interface Parser {
    ExtractTableRefs(sql: string, dialect: unknown): TableRef[];
    ExtractSelectColumns(sql: string, dialect: unknown): unknown[];
}

const sqlOf = (name: string): string =>
    readFileSync(new URL(`../../../../metadata/queries/SQL/${name}`, import.meta.url), 'utf8');

let parser: Parser;
let dialect: unknown;

beforeAll(async () => {
    const host = createRequire(import.meta.url).resolve('@memberjunction/core-entities-server');
    const fromHost = createRequire(host);
    const parserModule = (await import(pathToFileURL(fromHost.resolve('@memberjunction/sql-parser')).href)) as {
        SQLParser: Parser;
    };
    const dialectModule = (await import(pathToFileURL(fromHost.resolve('@memberjunction/sql-dialect')).href)) as {
        SQLServerDialect: new () => unknown;
    };
    parser = parserModule.SQLParser;
    dialect = new dialectModule.SQLServerDialect();
});

const EXPECTED: Record<string, { tables: string[]; columns: number }> = {
    'deal-cycle-time.sql': { tables: ['vwDeals', 'DealStatusType', 'DealStageEvent', 'closed', 'ranked'], columns: 10 },
    'won-deals-order-not-confirmed.sql': { tables: ['vwDeals', 'DealStatusType', 'won', 'vwOrderHeaders'], columns: 18 },
    'dashboard-summary.sql': { tables: ['Deal', 'DealStatusType', 'Pipeline'], columns: 9 },
    'deal-roster.sql': {
        tables: ['vwDeals', 'DealStatusType', 'Pipeline', 'PipelineStage', 'ForecastCategoryType'],
        columns: 39,
    },
};

describe("MJ's SQL parser reads the business-day queries in full", () => {
    for (const [file, want] of Object.entries(EXPECTED)) {
        it(`${file}: every select column and only real tables`, () => {
            const sql = sqlOf(file);
            expect(parser.ExtractSelectColumns(sql, dialect)).toHaveLength(want.columns);
            expect(parser.ExtractTableRefs(sql, dialect).map((t) => t.TableName).sort()).toEqual([...want.tables].sort());
        });
    }
});
