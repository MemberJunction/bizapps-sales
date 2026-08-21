#!/usr/bin/env node
/**
 * RULE ONE: SALES NEVER COMPUTES MONEY. This is the gate for it.
 *
 * CLAUDE.md puts it first, and until now nothing checked it. That is how this shipped in the board and
 * was caught by review rather than by CI:
 *
 *     Total: cards.reduce((sum, d) => sum + (d.Amount ?? 0), 0)
 *
 * — a per-column money figure that no order and no query produced, assembled by browser arithmetic.
 * The rule it breaks is the one the app exists to uphold, and it had no automated defender at all.
 *
 * ── WHAT THIS CAN AND CANNOT DO ─────────────────────────────────────────────────────────────────
 *
 * It is a HEURISTIC: arithmetic operators applied to money-shaped identifiers. It cannot know whether
 * a given sum is a forbidden derivation or a legitimate rollup of stored answers — that is a judgement
 * about intent, and a regex does not have one.
 *
 * So it is deliberately noisy in one direction. A legitimate case is ANNOTATED, not excused by
 * weakening the pattern:
 *
 *     const total = rows.reduce((s, r) => s + r.Amount, 0);   // money-grep-allow: rollup of stored PreviewOrder answers, not a derivation
 *
 * That trade is the point. A gate tuned until it never fires on real code is a gate that will not fire
 * on the next violation either, and the annotation leaves a reviewable record of every place someone
 * decided the rule did not apply.
 *
 * ── WHAT IT DOES NOT COVER, STATED SO NOBODY ASSUMES OTHERWISE ─────────────────────────────────
 *
 *   · SQL. The §9 read models sum stored amounts in T-SQL by design and are not scanned; their money
 *     position is argued in `metadata/queries/README.md` instead.
 *   · Money laundered through a neutral name — `const v = line.UnitPrice; total += v;` — because the
 *     second statement mentions nothing money-shaped.
 *   · Arithmetic split across lines, since matching is per-line.
 *
 * A pass means "no obvious money arithmetic", not "rule one is upheld".
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** Every package with hand-written source, matching the vocabulary gate's roots. */
const SEARCH_ROOTS = [
    'packages/Server/src',
    'packages/CoreEntitiesServer/src',
    'packages/Actions/src',
    'packages/IntegrationTests/src',
    'packages/Angular/src',
    'packages/Entities/src',
];

const SKIP_DIR = new Set(['generated', 'node_modules', 'dist', '__tests__']);

/**
 * MONEY-SHAPED IDENTIFIERS.
 *
 * Named for what they hold rather than where they live, because the same value flows through a deal,
 * an order line and a report row under the same name. `Probability` and `Quantity` are deliberately
 * ABSENT: multiplying a quantity is orders' job and sales never sees it, and a probability weighting
 * is a forecast statistic that master plan §9.3 names as a measure.
 */
const MONEY = [
    'Amount',
    'UnitPrice',
    'LineTotal[A-Za-z]*',
    'Discount[A-Za-z]*',
    'Total[A-Za-z]*',
    '[A-Za-z]*Gross',
    '[A-Za-z]*Net',
    '[A-Za-z]*Price',
    'Balance',
    'Subtotal',
    'Tax[A-Za-z]*',
];
const MONEY_ALT = MONEY.join('|');

/** A money identifier, optionally reached through a property chain: `d.Amount`, `row.LineTotalNet`. */
const M = `(?:[A-Za-z_$][\\w$]*\\s*(?:\\?\\.|\\.)\\s*)*(?:${MONEY_ALT})\\b`;

const PATTERNS = [
    {
        // `sum + d.Amount`, `total += line.UnitPrice`, `a.Amount - b.Amount`
        re: new RegExp(`[-+*/]=\\s*[^;]*\\b${M}|\\b${M}\\s*[-+*/]\\s*[^=]|[-+*/]\\s*\\(?\\s*${M}`),
        why: 'arithmetic on a money value',
    },
    {
        // `.reduce(...)` anywhere near a money identifier — the board's exact shape
        re: new RegExp(`\\.reduce\\s*\\([^)]*\\b(?:${MONEY_ALT})\\b`, 'i'),
        why: 'reduces over money values',
    },
    {
        // `Math.round(total * 100)`, and the rounding rule-one forbids outright
        re: new RegExp(`Math\\.(?:round|floor|ceil|abs)\\s*\\([^)]*\\b(?:${MONEY_ALT})\\b`, 'i'),
        why: 'rounds a money value',
    },
    {
        // `.toFixed(2)` on a money value — formatting that silently derives a new figure
        re: new RegExp(`\\b${M}\\s*(?:\\?\\.)?\\.toFixed\\s*\\(`),
        why: 'toFixed on a money value — formatting that alters the stored figure',
    },
];

/** An explicit, reviewed escape hatch. A line ending in this comment is exempt and must say why. */
const ALLOW = 'money-grep-allow:';

function* walk(dir) {
    let entries;
    try {
        entries = readdirSync(dir);
    } catch {
        return; // a package that has not been scaffolded yet is not a failure
    }
    for (const name of entries) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            if (!SKIP_DIR.has(name)) yield* walk(full);
        } else if (/\.(ts|mts|cts)$/.test(name) && !/\.d\.ts$/.test(name)) {
            yield full;
        } else if (/\.html$/.test(name)) {
            // A template can do arithmetic too: `{{ a.Amount + b.Amount | currency }}`.
            yield full;
        }
    }
}

const violations = [];
const allowed = [];
let scanned = 0;

for (const searchRoot of SEARCH_ROOTS) {
    for (const file of walk(join(ROOT, searchRoot))) {
        scanned++;
        const lines = readFileSync(file, 'utf8').split(/\r?\n/);
        lines.forEach((line, i) => {
            const code = line.trim();
            // Comments in BOTH languages this walks. Missing the HTML form made a comment ABOUT the
            // money rule -- "Deal.Amount is a cached answer from orders" -- read as a violation of it.
            if (
                code.startsWith('//') ||
                code.startsWith('*') ||
                code.startsWith('/*') ||
                code.startsWith('<!--') ||
                code.startsWith('-->')
            ) {
                return;
            }
            const rel = relative(ROOT, file).split(sep).join('/');
            for (const { re, why } of PATTERNS) {
                if (re.test(line)) {
                    // Counted, not silently dropped: an exemption nobody can see is a weakened gate.
                    if (line.includes(ALLOW)) allowed.push({ file: rel, line: i + 1 });
                    else violations.push({ file: rel, line: i + 1, why, text: code.slice(0, 140) });
                    return;
                }
            }
        });
    }
}

/**
 * AN EMPTY SCAN IS NOT A PASS — the lesson from this repo's own comment-drift gate, which pointed at
 * an absolute path on one machine, scanned nothing everywhere else, and reported success.
 */
if (scanned === 0) {
    console.error(`\nmoney-grep: ERROR — no source files found under ${SEARCH_ROOTS.join(', ')}.`);
    console.error('A gate that measures nothing must not report success.\n');
    process.exit(2);
}

if (violations.length === 0) {
    const note = allowed.length ? `, ${allowed.length} annotated exemption(s)` : '';
    console.log(`money-grep: clean — ${scanned} file(s) scanned, no money arithmetic${note}.`);
    process.exit(0);
}

console.error(`\nmoney-grep: ${violations.length} violation(s).\n`);
console.error('Sales records INTENT and asks Orders for the number. It never multiplies quantity by');
console.error('price, applies a discount, computes tax, prorates a period, sums lines into a header');
console.error('total, or rounds anything. Every figure comes back from PreviewOrder and is stored.\n');
console.error('If this is a legitimate rollup of values that are already answers, annotate the line:');
console.error(`    ${ALLOW} <why this is not a derivation>\n`);
for (const v of violations) {
    console.error(`  ✖ ${v.file}:${v.line}  — ${v.why}`);
    console.error(`      ${v.text}`);
}
console.error('');
process.exit(1);
