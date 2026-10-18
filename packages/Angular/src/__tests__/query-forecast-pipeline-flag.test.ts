/**
 * Every query that reports OPEN deals as part of the forecast leaves out the open deals of pipelines
 * flagged `IncludeInForecast = 0`, unless the caller names that pipeline (#404). Deal Type Mix counted
 * them, so its open figures disagreed with Pipeline Summary and the dashboard.
 *
 * STATIC, because the queries run against a live database that unit tests do not have
 * (`test-harnesses/verify-queries.mjs` runs them live). Comments are stripped first, so prose about the
 * flag cannot satisfy the test.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sqlOf = (name: string): string =>
    readFileSync(new URL(`../../../../metadata/queries/SQL/${name}`, import.meta.url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/--.*$/gm, '');

/** The `{% else %}` of the `{% if PipelineID %}` branch: what an unfiltered run applies. */
function unfilteredPipelineBranch(sql: string): string {
    const match = /\{%\s*if PipelineID\s*%\}(?:(?!\{%\s*endif)[\s\S])*?\{%\s*else\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/.exec(sql);
    return match?.[1] ?? '';
}

const FORECAST_QUERIES = [
    'pipeline-summary.sql',
    'dashboard-summary.sql',
    'forecast-by-owner.sql',
    'forecast-by-category.sql',
    'deal-type-mix.sql',
];

describe('forecast queries leave out the open deals of pipelines flagged out of the forecast', () => {
    for (const file of FORECAST_QUERIES) {
        it(`${file}: an unfiltered run applies IncludeInForecast = 1`, () => {
            expect(unfilteredPipelineBranch(sqlOf(file))).toMatch(/\bp\.IncludeInForecast\s*=\s*1\b/);
        });
    }

    it('deal-type-mix.sql keeps the closed deals of a flagged pipeline', () => {
        expect(unfilteredPipelineBranch(sqlOf('deal-type-mix.sql'))).toMatch(
            /\(\s*st\.IsOpen\s*=\s*0\s+OR\s+p\.IncludeInForecast\s*=\s*1\s*\)/,
        );
    });
});
