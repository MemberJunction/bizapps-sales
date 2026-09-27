/**
 * @fileoverview `AssertRosterColumns` — a roster row missing a column the mapper reads is an error.
 *
 * The case it exists for (bizapps-sales#137): a database upgraded without the release that carried the
 * new `Sales: Deal Roster` SQL returns rows with no `PipelineIncludeInForecast`. The mapper read that as
 * `false`, `InForecast` dropped every open deal, and Weighted open read $0 with no error anywhere.
 */
import { describe, expect, it } from 'vitest';

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
