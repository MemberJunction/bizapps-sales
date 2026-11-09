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
/** The filter bar, its own component since the Board shares it (bc-aidp-next-golive#351). */
const BAR_HTML = readFileSync(new URL('../lib/sections/sales-filter-bar.component.html', import.meta.url), 'utf8');

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
        expect(dashboardCopy()).toContain('Open deals by stage');
        expect(getterLiterals('Attention')).toContain('Open deals with no employee in the owner role');
        expect(getterLiterals('InspectLabel')).toContain('Closing in the next 30 days');
    });

    it('page text and tooltips are plain English', () => {
        const offenders = dashboardCopy().filter((s) => fieldNamesIn(s).length > 0);
        expect(offenders).toEqual([]);
    });

    it('the deal list title and the Needs attention rows are plain English', () => {
        const offenders = [...getterLiterals('InspectLabel'), ...getterLiterals('Attention')].filter((s) => fieldNamesIn(s).length > 0);
        expect(offenders).toEqual([]);
    });

    it('the fiscal-year note is plain English for every basis', () => {
        const bases: FiscalBasis[] = ['pending', 'profile', 'no-accounting', 'no-profiles', 'unreadable', 'mixed'];
        for (const Basis of bases) {
            expect(fieldNamesIn(DescribeFiscalBasis({ Start: CALENDAR_YEAR_START, Basis })), Basis).toEqual([]);
        }
    });
});

/**
 * THE COPY TABLE OF bc-aidp-next-golive#350, part 5. Each pair is (today, proposed); the old string
 * must be gone from what a reader sees and the new one present.
 */
describe('the dashboard says it in the words the forecast is read in (bc-aidp-next-golive#350)', () => {
    const shown = (): string => [...dashboardCopy(), ...getterLiterals('InspectLabel'), ...getterLiterals('Attention')].join('\n');

    it.each([
        ['Forecast stack', 'Forecast'],
        ['Commit (open)', 'Commit deals'],
        ['Commit by owner', 'Commit by deal owner'],
        ['Best Case only', 'Best case'],
        ['Remainder', 'Pipeline'],
        ['Weighted open', 'Weighted pipeline'],
        ['Needs a person', 'Needs attention'],
        ['Close date slipped', 'Past close date'],
        ['Close-date buckets', 'Expected to close'],
        ['Stage mix', 'Open deals by stage'],
        ['won amount ÷ closed amount', 'Share of closed deal value that was won'],
        ['Inspect', 'Deals'],
        ['Open deals closing soonest', 'Closing in the next 30 days'],
    ])('"%s" reads "%s"', (before, after) => {
        const text = shown() + '\n' + TS;
        expect(shown()).not.toContain(before);
        expect(text).toContain(after);
    });

    it('gives every forecast category a one-sentence tooltip', () => {
        const titles = [...HTML.matchAll(/class="stack__seg[^"]*"[\s\S]*?title="([^"]*)"/g)].map((m) => m[1]);
        expect(titles).toEqual([
            'Won: deals won in the period, by the day they closed.',
            'Commit: open deals in a Commit forecast category, expected to close in the period.',
            'Best case: not counting deals already in Commit.',
            'Pipeline: open deals not in Commit or Best case.',
        ]);
    });

    it('moves the fiscal year line into the Period tooltip', () => {
        expect(HTML).not.toContain('period__basis');
        expect(BAR_HTML).toContain('[title]="State.PeriodTooltip"');
    });
});
