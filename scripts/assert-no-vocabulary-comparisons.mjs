#!/usr/bin/env node
/**
 * THE VOCABULARY GREP — enforcement for the app's second rule.
 *
 * Master plan §3: "no server file may contain `Status === 'Won'` or `Stage.Name === 'Closed Won'`.
 * It reads `DealStatusType.IsWon`. This is enforceable with a grep in CI and worth adding, because
 * the shortcut is tempting exactly once and permanent thereafter."
 *
 * This is that grep, added at S1 — BEFORE there is any server logic to violate it. That ordering is
 * deliberate: a rule introduced alongside the code it constrains gets argued with, while a rule that
 * was already green when the code arrived simply holds. It currently passes trivially. Its job is to
 * still be passing at S4, when `Sales.CloseDeal` is written and the temptation is real.
 *
 * WHAT IT LOOKS FOR: a comparison between a status/stage/category/role-shaped expression and a
 * STRING LITERAL. Behaviour must come from a type-table flag (`IsWon`, `IsLost`, `LocksDeal`,
 * `IncludeInCommit`, `IsOwnerRole`, ...), never from a name.
 *
 * WHY A REGEX AND NOT A TYPE: the values are rows in a database, so there is no compile-time type to
 * make illegal. A lint of the source text is the only thing that can see this class of mistake.
 *
 * Deliberately narrow — it flags comparisons against the NAME-BEARING properties of the vocabulary
 * (Status, Stage, DealStatus, ForecastCategory, DealRole, LifecycleStage, LossReason, ...), not every
 * string comparison in the codebase. A false positive is a real cost here: the fastest way to kill a
 * CI rule is to make it noisy enough that people learn to skip it.
 *
 * Usage: node scripts/assert-no-vocabulary-comparisons.mjs
 * Exit 0 = clean. Exit 1 = violations, listed with file:line.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** Server-side source only. The UI may legitimately show a name; it may not BRANCH on one. */
const SEARCH_ROOTS = [
    'packages/Server/src',
    'packages/CoreEntitiesServer/src',
    'packages/Actions/src',
    'packages/IntegrationTests/src',
];

/** Never generated code, never build output, never tests' own fixture vocabulary. */
const SKIP_DIR = new Set(['generated', 'node_modules', 'dist', '__tests__']);

/**
 * The vocabulary-bearing accessors. A comparison between one of these and a string literal is the
 * violation: it means behaviour is keyed on what something is CALLED.
 */
const VOCAB = [
    'Status',
    'DealStatus',
    'DealStatusType',
    'Stage',
    'PipelineStage',
    'ForecastCategory',
    'ForecastCategoryType',
    'DealType',
    'DealRole',
    'LifecycleStage',
    'LifecycleStageType',
    'LossReason',
    'BuyingRole',
    'BuyingRoleType',
    'AccountType',
    'LeadSourceType',
];

/**
 * `<vocab>[.Name] ===|!==|==|!= 'literal'` and the reversed operand order, plus the
 * `['a','b'].includes(<vocab>)` and `switch (<vocab>)` shapes that smuggle the same thing past a
 * naive equality check.
 */
const VOCAB_ALT = VOCAB.join('|');
const PATTERNS = [
    {
        // deal.Status === 'Won'   |   stage.Name !== "Closed Won"
        re: new RegExp(`\\b(?:${VOCAB_ALT})\\b(?:\\s*\\.\\s*(?:Name|Code|Label))?\\s*(?:===|!==|==(?!=)|!=(?!=))\\s*['"\`]`),
        why: 'compares a vocabulary value to a string literal',
    },
    {
        // 'Won' === deal.Status
        re: new RegExp(`['"\`]\\s*(?:===|!==|==(?!=)|!=(?!=))\\s*\\b(?:${VOCAB_ALT})\\b`),
        why: 'compares a string literal to a vocabulary value',
    },
    {
        // ['Won','Lost'].includes(deal.Status)
        re: new RegExp(`\\[[^\\]]*['"\`][^\\]]*\\]\\s*\\.\\s*includes\\s*\\(\\s*[^)]*\\b(?:${VOCAB_ALT})\\b`),
        why: 'tests a vocabulary value for membership in a literal list',
    },
    {
        // switch (deal.Status) — the multi-arm form of the same mistake
        re: new RegExp(`\\bswitch\\s*\\(\\s*[^)]*\\b(?:${VOCAB_ALT})\\b(?:\\s*\\.\\s*(?:Name|Code|Label))?\\s*\\)`),
        why: 'switches on a vocabulary value',
    },
];

/** An explicit, reviewed escape hatch. A line ending in this comment is exempt and must say why. */
const ALLOW = 'vocabulary-grep-allow:';

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
        }
    }
}

const violations = [];
let scanned = 0;

for (const searchRoot of SEARCH_ROOTS) {
    for (const file of walk(join(ROOT, searchRoot))) {
        scanned++;
        const lines = readFileSync(file, 'utf8').split(/\r?\n/);
        lines.forEach((line, i) => {
            const code = line.trim();
            if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) return;
            if (line.includes(ALLOW)) return;
            for (const { re, why } of PATTERNS) {
                if (re.test(line)) {
                    violations.push({
                        file: relative(ROOT, file).split(sep).join('/'),
                        line: i + 1,
                        why,
                        text: code.slice(0, 140),
                    });
                    return;
                }
            }
        });
    }
}

if (violations.length === 0) {
    console.log(`vocabulary-grep: clean — ${scanned} server file(s) scanned, no name comparisons.`);
    process.exit(0);
}

console.error(`\nvocabulary-grep: ${violations.length} violation(s).\n`);
console.error('Domain vocabulary is DATA, not code. Behaviour must come from a type-table flag');
console.error("(DealStatusType.IsWon, .IsLost, .LocksDeal, ForecastCategoryType.IncludeInCommit,");
console.error('DealRole.IsOwnerRole, ...) — never from what a status or stage is CALLED. Renaming');
console.error('"Closed Won" to "Signed" must not change behaviour, and a name comparison breaks that.\n');
for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.why}`);
    console.error(`    ${v.text}`);
}
console.error(`\nIf a line is genuinely a legitimate exception, append a "${ALLOW} <reason>" comment.\n`);
process.exit(1);
