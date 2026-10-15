import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CALENDAR_YEAR_START, DescribeFiscalBasis, type FiscalBasis } from '../lib/pages/dashboard-period';

/**
 * bizapps-sales#263: the Sales dashboard spoke in column names.
 *
 * Its queue notes, card notes and Inspect titles read "DealRole.IsOwnerRole empty", "IncludeInCommit $"
 * and "IsWon · all time" — the first screen of the app, in every demo. The rewrite is plain English on
 * screen with the exact rule in a tooltip, and these tests keep a column name from coming back.
 *
 * ── WHAT COUNTS AS A COLUMN NAME ─────────────────────────────────────────────────────────────────
 *
 * A PascalCase compound (`ExpectedCloseDate`, `IncludeInCommit`), a dotted path (`DealRole.IsOwnerRole`)
 * or a bare `$` standing in for "amount". Product names that are themselves PascalCase are allowed by
 * name below, so a new one has to be added on purpose rather than slipping through a looser pattern.
 */

const ALLOWED = new Set(['BizApps']);
const FIELD_NAME = /\b[A-Z][a-z]+(?:[A-Z][a-z]*)+\b|\b\w+\.[A-Z]\w*|\$(?!\{)/g;

function fieldNamesIn(text: string): string[] {
    return [...text.matchAll(FIELD_NAME)].map((m) => m[0]).filter((m) => !ALLOWED.has(m));
}

const HTML = readFileSync(new URL('../lib/sections/sales-section.component.html', import.meta.url), 'utf8');
const TS = readFileSync(new URL('../lib/sections/sales-section.component.ts', import.meta.url), 'utf8');

/**
 * What a user reads on the dashboard page: text between tags and `title` values. Comments, Angular
 * blocks and `{{ }}` bindings are dropped first, because they hold member names by design.
 */
function dashboardCopy(): string[] {
    const start = HTML.indexOf('═ DASHBOARD ═');
    const end = HTML.indexOf('═ ALL DEALS ═');
    expect(start, 'the dashboard block marker moved').toBeGreaterThan(-1);
    expect(end, 'the all-deals block marker moved').toBeGreaterThan(start);
    const block = HTML.slice(start, end)
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/\{\{[\s\S]*?\}\}/g, ' ');
    const titles = [...block.matchAll(/\btitle="([^"]*)"/g)].map((m) => m[1]);
    const text = block
        .replace(/<[^>]*>/g, '\n')
        .replace(/@(?:if|else|for|switch|case)\b[^{]*\{|\}/g, '\n')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    return [...titles, ...text];
}

/** The string literals a getter returns, `${}` substitutions elided — `InspectLabel` builds the Inspect grid's title. */
function getterLiterals(name: string): string[] {
    const start = TS.indexOf(`public get ${name}()`);
    expect(start, `${name} getter not found`).toBeGreaterThan(-1);
    const body = TS.slice(start, TS.indexOf('\n    }\n', start));
    return [...body.matchAll(/'([^']*)'|`([^`]*)`/g)]
        .map((m) => (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, '…'))
        .filter((s) => / /.test(s));
}

describe('the Sales dashboard names no columns', () => {
    it('finds the copy it is checking', () => {
        // Without this, a parser that matched nothing would pass every test below.
        const copy = dashboardCopy();
        expect(copy).toContain('Open deals with no owner on the deal team');
        expect(getterLiterals('InspectLabel')).toContain('Open deals marked for commit');
    });

    it('page text and tooltips are plain English', () => {
        const offenders = dashboardCopy().filter((s) => fieldNamesIn(s).length > 0);
        expect(offenders).toEqual([]);
    });

    it('the Inspect grid title is plain English for every filter', () => {
        const offenders = getterLiterals('InspectLabel').filter((s) => fieldNamesIn(s).length > 0);
        expect(offenders).toEqual([]);
    });

    it('the fiscal-year note is plain English for every basis', () => {
        const bases: FiscalBasis[] = ['pending', 'profile', 'no-accounting', 'no-profiles', 'mixed'];
        for (const Basis of bases) {
            expect(fieldNamesIn(DescribeFiscalBasis({ Start: CALENDAR_YEAR_START, Basis })), Basis).toEqual([]);
        }
    });
});

describe('the Commit queue says what it counts', () => {
    it('does not promise a period it ignores', () => {
        // `CommitCount` counts every open Commit deal; Commit is deliberately not tied to the period.
        const copy = dashboardCopy();
        expect(copy).toContain('Commit (open)');
        expect(copy.filter((s) => /commit this period/i.test(s))).toEqual([]);
    });
});
