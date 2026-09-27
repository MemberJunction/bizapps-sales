/**
 * @fileoverview `AssertRosterColumns` — a roster row missing a column the mapper reads is an error.
 *
 * The case it exists for (bizapps-sales#137): a database upgraded without the release that carried the
 * new `Sales: Deal Roster` SQL returns rows with no `PipelineIncludeInForecast`. The mapper read that as
 * `false`, `InForecast` dropped every open deal, and Weighted open read $0 with no error anywhere.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { TileSummary } from '../lib/pages/dashboard-inspect';
import {
    AssertRosterColumns,
    DEAL_ROSTER_COLUMNS,
    MissingRosterColumns,
} from '../lib/workspace/deal-roster.columns';

/** A row carrying every expected column, all NULL. */
function fullRow(): Record<string, unknown> {
    return Object.fromEntries(DEAL_ROSTER_COLUMNS.map((column) => [column, null]));
}

/** The same row as returned by a query definition that predates `PipelineIncludeInForecast`. */
function olderDefinitionRow(): Record<string, unknown> {
    const row = fullRow();
    delete row['PipelineIncludeInForecast'];
    return row;
}

describe('MissingRosterColumns', () => {
    it('reports nothing for a row with every column, even when every value is NULL', () => {
        expect(MissingRosterColumns(fullRow())).toEqual([]);
    });

    it('names the column an older query definition does not return', () => {
        expect(MissingRosterColumns(olderDefinitionRow())).toEqual(['PipelineIncludeInForecast']);
    });
});

describe('AssertRosterColumns', () => {
    it('passes a current roster', () => {
        expect(() => AssertRosterColumns([fullRow(), fullRow()])).not.toThrow();
    });

    it('throws, naming the column, on a roster from an older query definition', () => {
        expect(() => AssertRosterColumns([olderDefinitionRow()])).toThrow(/PipelineIncludeInForecast/);
    });

    it('does not check an empty roster, which has nothing to mis-compute', () => {
        expect(() => AssertRosterColumns([])).not.toThrow();
    });
});

describe('TileSummary', () => {
    const summary = { OpenAmount: 1_200_000, OpenCount: 40 };

    it('shows the summary while the roster loads', () => {
        expect(TileSummary(summary, null)).toBe(summary);
    });

    it('shows no summary while the roster is refused, whichever load produced it', () => {
        // A refresh and a period change both set the summary through this. Before, the period change
        // assigned it directly and put figures back above a refused, empty roster.
        expect(TileSummary(summary, 'Sales: Deal Roster returned no PipelineIncludeInForecast column.')).toBeNull();
    });
});

describe('the dashboard sets its summary only through TileSummary', () => {
    /**
     * TileSummary only helps where it is called, and the defect it fixes was a second assignment that
     * bypassed the rule. Scans the component so an assignment added later cannot bypass it either.
     */
    const source = readFileSync(join(__dirname, '../lib/sections/sales-section.component.ts'), 'utf8');
    const assignments = [...source.matchAll(/this\.summary\s*=\s*([^;]+);/g)].map((m) => m[1].trim());

    it('finds the assignments it is checking', () => {
        expect(assignments.filter((a) => a.startsWith('TileSummary(')).length).toBeGreaterThanOrEqual(2);
    });

    it('assigns nothing but TileSummary(...) or null', () => {
        expect(assignments.filter((a) => a !== 'null' && !a.startsWith('TileSummary('))).toEqual([]);
    });
});
