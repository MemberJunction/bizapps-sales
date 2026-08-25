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
 * ---------------------------------------------------------------------------------------------------
 * KNOWN BLIND SPOT, measured rather than assumed.
 *
 * Audited by injecting eight deliberate violations: it catches seven. The one it cannot catch is a
 * comparison where NEITHER the variable nor the property carries a vocabulary word:
 *
 *     return 'Closed Won' === s.Name;        // `s` and `Name` — no textual signal at all
 *
 * Detecting that would mean treating any `.Name` comparison as suspect, which would fire on
 * `user.firstName`, `product.Name` and every other legitimate name check in the codebase — noise that
 * would get the whole gate ignored. So this is a deliberate limit, not an oversight: the grep is a
 * high-value tripwire for the tempting shortcut, not a proof of absence. Code review still owns the
 * cases where a rep-named local hides the vocabulary.
 *
 * Verified NOT to fire on legitimate code: `deploymentStage === 'build'`, `o.stageName === 'x'`,
 * `u.firstName === 'Dana'`, `t.statusCode === 404`, and — importantly — `s.IsWon === true`, since
 * comparing a behaviour FLAG is precisely what this rule wants people to do.
 * ---------------------------------------------------------------------------------------------------
 *
 * Usage: node scripts/assert-no-vocabulary-comparisons.mjs
 * Exit 0 = clean. Exit 1 = violations, listed with file:line.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/**
 * EVERY package that carries hand-written source — not just the server ones.
 *
 * This listed four of six. `packages/Angular/src` and `packages/Entities/src` were absent, so rule
 * two held where the gate looked and was simply unverified everywhere else — and the UI is exactly
 * where "show the name" slides into "branch on the name", because both look like rendering.
 *
 * The old comment said the UI may show a name but may not BRANCH on one. That is the right rule,
 * and it was being enforced on the half of the codebase least likely to break it.
 */
const SEARCH_ROOTS = [
    'packages/Server/src',
    'packages/CoreEntitiesServer/src',
    'packages/Actions/src',
    'packages/IntegrationTests/src',
    'packages/Angular/src',
    'packages/Entities/src',
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

/**
 * CASE-INSENSITIVE, AND THAT IS NOT COSMETIC — it was a real hole, found by auditing the gate against
 * deliberately-injected violations rather than by reading it.
 *
 * The vocabulary token is as likely to appear in a LOWERCASE variable name as in a PascalCase property:
 * `stage.Name === 'Closed Won'` and `d.status === 'Won'` are exactly what real code looks like, and a
 * case-sensitive matcher sails straight past both. The capitalised `Stage.Name === 'Closed Won'` was
 * caught while its lowercase twin was not — meaning the gate missed the very example master plan §3
 * uses to state the rule.
 *
 * The `\b…\b` boundaries keep this from over-reaching: `stage` does not match inside `deploymentStage`
 * or `stageName`, so an unrelated build-stage comparison stays quiet. Where it does fire on something
 * genuinely unrelated, the `vocabulary-grep-allow:` escape hatch is the intended answer.
 */
const PATTERNS = [
    {
        // deal.Status === 'Won'   |   stage.Name !== "Closed Won"   |   d.status == 'Won'
        re: new RegExp(`\\b(?:${VOCAB_ALT})\\b(?:\\s*\\.\\s*(?:Name|Code|Label))?\\s*(?:===|!==|==(?!=)|!=(?!=))\\s*['"\`]`, 'i'),
        why: 'compares a vocabulary value to a string literal',
    },
    {
        // 'Won' === deal.Status   |   'Closed Won' === stage.Name
        re: new RegExp(`['"\`]\\s*(?:===|!==|==(?!=)|!=(?!=))\\s*[A-Za-z_$][\\w$]*(?:\\s*\\.\\s*[\\w$]+)*\\b(?:${VOCAB_ALT})\\b|['"\`]\\s*(?:===|!==|==(?!=)|!=(?!=))\\s*\\b(?:${VOCAB_ALT})\\b(?:\\s*\\.\\s*(?:Name|Code|Label))?`, 'i'),
        why: 'compares a string literal to a vocabulary value',
    },
    {
        // ['Won','Lost'].includes(deal.Status)
        re: new RegExp(`\\[[^\\]]*['"\`][^\\]]*\\]\\s*\\.\\s*includes\\s*\\(\\s*[^)]*\\b(?:${VOCAB_ALT})\\b`, 'i'),
        why: 'tests a vocabulary value for membership in a literal list',
    },
    {
        // switch (deal.Status) — the multi-arm form of the same mistake
        re: new RegExp(`\\bswitch\\s*\\(\\s*[^)]*\\b(?:${VOCAB_ALT})\\b(?:\\s*\\.\\s*(?:Name|Code|Label))?\\s*\\)`, 'i'),
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
        } else if (/\.html$/.test(name)) {
            /**
            * ANGULAR TEMPLATES, which were invisible to this gate at any root.
            *
            * `@if (row.DealStatusType === 'Closed Won')` in a template is the same violation as
            * in a component, so adding the Angular root while walking only `.ts` would still
            * have missed it. A template IS source; splitting a component across two files is an
            * Angular implementation detail, not a statement about what counts as code.
            */
            yield full;
        }
    }
}

const violations = [];
let scanned = 0;
/** Per-root tally, so a root that silently matches nothing is detectable. */
const perRoot = new Map();

for (const searchRoot of SEARCH_ROOTS) {
    let rootCount = 0;
    for (const file of walk(join(ROOT, searchRoot))) {
        scanned++;
        rootCount++;
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
    perRoot.set(searchRoot, rootCount);
}


/**
 * ── AN EMPTY SCAN IS NOT A PASS, AND NEITHER IS A PARTIAL ONE ──────────────────────────────────
 *
 * This gate is a HARD CI gate: it is what makes "enforced by a grep" true rather than aspirational.
 * Until this block existed it could report `clean` having read nothing at all. `walk()` swallows a
 * missing directory with a bare `catch { return; }` — correct in itself, a package that has not been
 * scaffolded is not a violation — and the success path below tested only `violations.length`. So a
 * package rename, a move of `src/`, or a sparse checkout skipped every root and CI went green on a
 * gate measuring nothing. The file contained no `process.exit(2)` anywhere.
 *
 * TWO GUARDS, BECAUSE THERE ARE TWO WAYS TO MEASURE LESS THAN YOU CLAIM:
 *
 *   1. Nothing scanned at all. The loud case, and the one the sibling money gate already caught.
 *   2. A root that contributed ZERO files while others contributed plenty. The quiet case: delete one
 *      of six roots and the scan silently loses about a sixth of the codebase, while the summary line
 *      still says `clean` and the number beside it still looks reassuringly large.
 *
 * The second is why a per-root count exists rather than just a total. A root is DECLARED here, so a
 * root that yields nothing is a fact about the declaration, not about the code — either the path moved
 * and this list is stale, or the package is gone and the list should say so. Both are edits somebody
 * should make deliberately and a reviewer should see. Neither is something a gate may decide to
 * tolerate on its own.
 *
 * Exit 2, not 1: "checks failed" and "the checker did not run" are different outcomes and CI should be
 * able to tell them apart. Same convention as the money gate, the drift gate, the spec gate and the
 * integration runner.
 */
if (scanned === 0) {
    console.error(`\nvocabulary-grep: ERROR — no source files found under any of:`);
    for (const r of SEARCH_ROOTS) console.error(`    ${r}`);
    console.error('\nA gate that measures nothing must not report success. Nothing was checked.\n');
    process.exit(2);
}

const emptyRoots = SEARCH_ROOTS.filter((r) => (perRoot.get(r) ?? 0) === 0);
if (emptyRoots.length > 0) {
    console.error(`\nvocabulary-grep: ERROR — ${emptyRoots.length} of ${SEARCH_ROOTS.length} declared root(s) matched no files:`);
    for (const r of emptyRoots) console.error(`    ${r}`);
    console.error(`\nThe other roots scanned ${scanned} file(s), so this would have printed "clean" while`);
    console.error('silently covering less of the codebase than it claims. Either the path moved and this');
    console.error("list is stale, or the package is gone and this list should say so — both are edits to");
    console.error('make on purpose, in SEARCH_ROOTS, where a reviewer can see them.\n');
    process.exit(2);
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
