/**
 * Slipped Deals reads `__mj.RecordChange.ChangesJSON`, and that column holds text that is not JSON:
 * MJ core's own migrations leave entries cut off at 4,000 characters. SQL Server may evaluate
 * `JSON_VALUE` before the `ISJSON` test in the WHERE clause, so one such row anywhere in the table
 * failed the whole query with Msg 13609. A `CASE WHEN ISJSON(...) = 1` is evaluated in order, so
 * every `JSON_VALUE` must sit inside one.
 *
 * STATIC, because the query runs against a live database that unit tests do not have
 * (`test-harnesses/verify-queries.mjs` runs it live). Comments are stripped first, so prose about the
 * guard cannot satisfy the test.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../../../../metadata/queries/SQL/slippage.sql', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '');

const GUARDED = /CASE\s+WHEN\s+ISJSON\(rc\.ChangesJSON\)\s*=\s*1\s+THEN\s+JSON_VALUE\(/g;

describe('Slipped Deals survives RecordChange rows that are not JSON', () => {
    it('reads ChangesJSON with JSON_VALUE at all', () => {
        expect(sql).toMatch(/JSON_VALUE\(/);
    });

    it('guards every JSON_VALUE with CASE WHEN ISJSON(...) = 1', () => {
        const all = sql.match(/JSON_VALUE\(/g) ?? [];
        const guarded = sql.match(GUARDED) ?? [];
        expect(guarded.length).toBe(all.length);
    });
});
