#!/usr/bin/env node
/**
 * @fileoverview Generates `docs/CHECK-MUTATION-EVIDENCE.md` from the live check bundles,
 * `scripts/expected-check-counts.json`, and `test-harnesses/mutate-checks.mjs` (#429).
 *
 * Usage:
 *   node scripts/write-mutation-evidence.mjs           # writes docs/CHECK-MUTATION-EVIDENCE.md
 *   node scripts/write-mutation-evidence.mjs --check   # exits 1 if the doc or any mutant anchor drifted
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');

/**
 * Historical per-mutant run outcomes carried forward from recorded runs.
 * A newly registered mutant defaults to `—` until a live campaign records its run.
 */
const RECORDED_RUNS = new Map([
    ['M-CD4', 'OK — fell BD2, CD20, CD4 · `b9e73d4`, 2026-08-23'],
    ['M-CD5', 'OK — 124 passed, 16 failed · `a9bc0e0`, 2026-09-17'],
    ['M-CD6', 'OK — 125 passed, 15 failed · `a9bc0e0`, 2026-09-17'],
    ['M-CD13', 'OK — fell CD13, CD28 · 2026-09-17, no SHA'],
    ['M-CD28', 'OK — fell CD28 alone · 2026-09-17, no SHA'],
    ['M-CD26', 'OK — 127 passed, 13 failed · `2e79c37`, 2026-09-16'],
    ['M-CD27', 'OK — 126 passed, 14 failed · `2e79c37`, 2026-09-16'],
    ['M-OS1', 'OK — fell CO3, CO5, SD25 · `b9e73d4`, 2026-08-23'],
    ['M-AM2', 'OK — 127 passed, 13 failed · `a9bc0e0`, 2026-09-16'],
    ['M-AM3', 'OK — 123 passed, 17 failed · `a9bc0e0`, 2026-09-16'],
    ['M-WT1', 'OK — fell WT11 alone · `b9e73d4`, 2026-08-23'],
    ['M-BD2', 'OK — fell BD2, SD31, SD33 · `b9e73d4`, 2026-08-23'],
    ['M-BD3', 'OK — fell BD2, BD6 · `b9e73d4`, 2026-08-23'],
    ['M-ST1', 'OK — fell BD1, BD2, BD4, CD4, CD11, CD15, CD16 · 2026-08-21, no SHA'],
    ['M-ST2', 'OK — fell SD32 · 2026-08-21, no SHA'],
    ['M-ST3', 'OK — fell CD16 · 2026-08-21, no SHA'],
    ['M-ST4', 'OK — fell SD30 · 2026-08-21, no SHA'],
    ['M-OW2', 'OK — fell SD31 · 2026-08-21, no SHA'],
    ['M-ST5', 'OK — fell SD33 · 2026-08-21, no SHA'],
    ['M-ST6', 'OK — fell SD34 · 2026-08-21, no SHA'],
    ['M-RO1', 'OK — fell CD18 · 2026-08-21, no SHA'],
    ['M-RO2', 'OK — fell CD18 · 2026-08-21, no SHA'],
    ['M-ST8', 'OK — fell SD35 · 2026-08-21, no SHA'],
    [
        'M-AP2',
        'MISS, standing: CD20 saves the flag before closing, so it cannot see this mutation (the note in the driver) · 2026-08-21, before the dist-change guard',
    ],
    [
        'M-WT2R',
        'MISS · 2026-08-24, not a measurement: the run tested unmutated code. Applied by hand it fell WT1, WT2, WT3, WT9, WT10, CD23',
    ],
    ['M-WT6T', 'MISS · 2026-08-24, before the dist-change guard; re-run before quoting it'],
    [
        'M-DS3',
        'Expected to miss on seeded data: the driver reports EXPECTED-MISS, and UNEXPECTED-HIT (exit 1) once an open-and-locking status is seeded',
    ],
    ['M-ST7', 'OK — fell CD4, CD5, CD13, CD14, CD17, CD18, CD20 · `b9e73d4`, 2026-08-23'],
    ['M-TN1', 'OK — fell WT15 alone · `9724489`, 2026-08-23'],
    ['M-TL1', 'OK — fell WT16 alone · `9724489`, 2026-08-23'],
    ['M-WT1O', 'OK — fell WT1, WT10, WT13 · `9724489`, 2026-08-23'],
    ['M-WT4L', 'OK — fell WT4, WT14 · `9724489`, 2026-08-23'],
    ['M-RI1', 'OK — fell CD23 alone · `33dd263`, 2026-08-23'],
    ['M-RI2', 'OK — fell CD23, CD7 · `33dd263`, 2026-08-23'],
    ['M-AC1', 'OK — fell AC8, AC13 · 2026-08-21, no SHA'],
    ['M-AC2', 'OK — fell AC3, AC13, AC18, AC22 · 2026-08-21, no SHA'],
    ['M-FS1', 'OK — fell FS8 · 2026-08-21, no SHA'],
    ['M-FS2', 'OK — fell FS11, FS12 · 2026-08-21, no SHA'],
    ['M-FS3', 'OK — fell FS3 · 2026-08-21, no SHA'],
    ['M-FS4', 'OK — fell FS6 · 2026-08-21, no SHA'],
    ['M-FS5', 'OK — fell FS7 · 2026-08-21, no SHA'],
]);

/**
 * Extracts `MUTATIONS` from `test-harnesses/mutate-checks.mjs` without starting a mutation run.
 */
export function LoadRegisteredMutations(repoRoot = REPO) {
    const src = readFileSync(join(repoRoot, 'test-harnesses/mutate-checks.mjs'), 'utf8');
    const idx = src.indexOf('const undeclared =');
    if (idx < 0) {
        throw new Error('Could not find `const undeclared =` in test-harnesses/mutate-checks.mjs');
    }
    const prefix = src
        .slice(0, idx)
        .replace(/^import .*?\n/gm, '')
        .replace(
            "const REPO = new URL('..', import.meta.url).pathname.replace(/^\\/([A-Za-z]:)/, '$1');",
            'const REPO = "";',
        );
    const fn = new Function(`${prefix}\nreturn MUTATIONS;`);
    return fn();
}

/**
 * Verifies every mutant in `MUTATIONS` matches its target file exactly once.
 */
export function VerifyMutationAnchors(repoRoot = REPO) {
    const mutations = LoadRegisteredMutations(repoRoot);
    const drifted = [];
    for (const m of mutations) {
        const fileContent = readFileSync(join(repoRoot, m.file), 'utf8');
        const hits = fileContent.split(m.from).length - 1;
        if (hits !== 1) {
            drifted.push({ id: m.id, file: m.file, hits });
        }
    }
    return { mutations, drifted };
}

/**
 * Reads all check bundles in `packages/IntegrationTests/src/checks/*.checks.ts` and verifies
 * counts against `scripts/expected-check-counts.json`.
 */
export function LoadRegisteredChecks(repoRoot = REPO) {
    const expected = JSON.parse(readFileSync(join(repoRoot, 'scripts/expected-check-counts.json'), 'utf8'));
    const expectedCounts = Object.fromEntries(
        Object.entries(expected.bundles)
            .filter(([k, v]) => !k.startsWith('$') && typeof v === 'object' && v !== null && typeof v.count === 'number')
            .map(([k, v]) => [k, v.count]),
    );
    const checksDir = join(repoRoot, 'packages/IntegrationTests/src/checks');
    const files = readdirSync(checksDir)
        .filter((f) => f.endsWith('.checks.ts'))
        .sort();
    const bundles = [];
    for (const file of files) {
        const bundle = file.replace(/\.checks\.ts$/, '');
        const content = readFileSync(join(checksDir, file), 'utf8');
        const directIds = [...content.matchAll(/Id:\s*['"][a-z-]+\.([A-Z]+\d+)['"]/g)].map((m) => m[1]);
        const helperIds = [...content.matchAll(/seedCheck\(\s*['"]([A-Z]+\d+)['"]/g)].map((m) => m[1]);
        const ids = [...directIds, ...helperIds];
        bundles.push({ bundle, ids });
    }
    return { expected, expectedCounts, bundles };
}

/**
 * Renders the full contents of `docs/CHECK-MUTATION-EVIDENCE.md`.
 */
export function RenderMutationEvidenceDoc(repoRoot = REPO) {
    const { mutations } = VerifyMutationAnchors(repoRoot);
    const { expectedCounts, bundles } = LoadRegisteredChecks(repoRoot);

    const declaredSet = new Set();
    for (const m of mutations) {
        for (const checkId of m.expect) {
            declaredSet.add(checkId);
        }
    }

    const totalChecks = Object.values(expectedCounts).reduce((sum, n) => sum + n, 0);
    const bundleCount = Object.keys(expectedCounts).length;

    const bundleOrder = [
        'save-deal',
        'close-deal',
        'product-picker',
        'close-won-order',
        'close-won-contract',
        'close-won-schedule',
        'board-move',
        'close-won-tasks',
        'discount-concession',
        'activities',
        'forecast',
        'party-lookup',
        'pipeline-copy',
        'term-start',
    ];
    const byBundle = new Map(bundles.map((b) => [b.bundle, b.ids]));

    const undeclaredRows = [];
    let undeclaredCount = 0;
    for (const bundle of bundleOrder) {
        const ids = byBundle.get(bundle) ?? [];
        const undeclared = ids.filter((id) => !declaredSet.has(id));
        undeclaredCount += undeclared.length;
        if (undeclared.length > 0) {
            undeclaredRows.push(`| \`${bundle}\` | ${undeclared.join(', ')} |`);
        }
    }

    const mutantRows = mutations.map((m) => {
        const fileBase = basename(m.file);
        const declares = m.expectMiss ? '— (`expectMiss`)' : m.expect.join(', ');
        const run = RECORDED_RUNS.get(m.id) ?? '—';
        return `| \`${m.id}\` | \`${fileBase}\` | ${declares} | ${run} |`;
    });

    return `# Mutation evidence — which integration checks have been shown able to FAIL

\`test-harnesses/mutate-checks.mjs\` breaks one piece of product code, rebuilds, runs the whole
integration suite, and restores the file. It prints one line per mutant: \`OK\` (every check it declares
fell), \`MISS\` (a declared check stayed green) or \`INCOMPLETE\` (the suite printed no tally), each with
\`failed=\`, \`expect=\` and the suite's tally — or a skip, when the anchor did not match, the build failed,
or the build left \`dist/\` unchanged.

Generated by \`node scripts/write-mutation-evidence.mjs\` (\`--check\` verifies the table and anchors).
\`node test-harnesses/mutate-checks.mjs --list\` prints the registry the table follows, with full file
paths. The round-by-round narratives behind these results are in this file's history, last at commit
\`fe8d94a\`.

## Current state

| | |
|---|---|
| Checks registered | **${totalChecks}** in ${bundleCount} bundles (\`scripts/expected-check-counts.json\`) |
| Mutants registered | **${mutations.length}** |
| Last full campaign | 2026-08-21/22: 68 mutants against a 121-check suite. It recorded totals, not per-mutant results, and its commit (\`6d3add4\`) is not in this repository |
| Since then | single mutants only, recorded below |
| Checks no mutant declares | **${undeclaredCount}** of ${totalChecks}, listed below the table |

## Per mutant

The latest itemized run of each mutant; **—** means none is itemized. "Fell" lists every check that
went red, declared or not. Tallies from September runs include twelve checks that failed on that host
with nothing mutated: AC6, AC8, AC12, AC13, AC16, AC19, CT1, CT5, CT6, SD6, WT10 and WT14.

| Mutant | File | Declares | Last recorded run |
|---|---|---|---|
${mutantRows.join('\n')}

A \`MISS\` recorded before the dist-change guard landed (2026-08-24) is suspect: until then a run could
measure unmutated code and report a miss. \`OK\` results are unaffected, because a kill shows the mutation
reached the running code.

## Checks no mutant declares

| Bundle | Checks |
|---|---|
${undeclaredRows.join('\n')}

Some of these have fallen under a mutant aimed elsewhere — BD1 and BD4 under \`M-ST1\`, SD28 under
\`M-AM3\`. By the counting rule below that is the weaker claim until a mutant declares them. Others
exercise cross-repo engines (\`bizapps-common\` ActivitySync for AC6, AC7, AC11, AC14, AC18–AC22;
\`bizapps-orders\` line/cascade rules for PP5, SD1, SD6, SD7, SD13, SD14, SD19; \`bizapps-contracts\`
numbering and template rules for CT1, CT7), database queries or metadata (\`party-lookup\` PL1–PL5,
FS9, FS14), or compile-time completeness guards (TS5, TS6). An analysis of which sales-owned branch a
mutant could aim at for the remainder, and which cannot be reached by mutating sales source at all, is
in this file's history at commit \`e10c78a\`.

---

## The counting rule

**"Proven" means a mutant DECLARED that check and that check then fell.** Nothing else counts. A
mutation disturbs the whole suite: \`M-ST1\` doubles every stage event and fells seven checks having been
aimed at three. Counting every failure as proof asserts that the mutated code is on each failing check's
path, which is exactly what has not been established.

The driver reports the two separately:

\`\`\`
  N mutations ran · N checks proven able to fail (declared and fell) · N isolated exactly one
  + N more fell as COLLATERAL -- a weaker claim, since the mutation was not aimed at them
\`\`\`

**When a collateral kill matters, promote it deliberately:** read the \`failed=\` column, confirm the
mutated code is on that check's path, and give the check a mutant of its own. Read \`failed=\` per mutant;
do not sum it. Every result in this file carries the commit it was measured against, or says it has
none: a figure without one describes no tree in particular.

## What this file does NOT establish

That the suite is adequate. An \`OK\` here shows that the checks a mutant declares fail for the reason
they claim, against that one mutation, on the commit it ran against. Most recorded runs predate the
current tree, and ${undeclaredCount} of the ${totalChecks} checks have no declared mutant. And no mutation run says anything about
behaviour no check covers — for that, see the Explorer specs under \`test-harnesses/playwright/specs/\`
(\`COVERAGE-MAP.md\`).
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const { drifted } = VerifyMutationAnchors(REPO);
    if (drifted.length > 0) {
        console.error(
            `✖ ${drifted.length} mutant anchor(s) do not match exactly once:\n` +
                drifted.map((d) => `  ${d.id} (${d.file}): ${d.hits} match(es)`).join('\n'),
        );
        process.exit(1);
    }
    const rendered = RenderMutationEvidenceDoc(REPO);
    const docPath = join(REPO, 'docs/CHECK-MUTATION-EVIDENCE.md');
    if (process.argv.includes('--check')) {
        const current = readFileSync(docPath, 'utf8');
        if (current !== rendered) {
            console.error(
                '✖ docs/CHECK-MUTATION-EVIDENCE.md is out of sync with mutate-checks.mjs and the check bundles.\n' +
                    '  Run: node scripts/write-mutation-evidence.mjs',
            );
            process.exit(1);
        }
        console.log('✔ docs/CHECK-MUTATION-EVIDENCE.md is in sync and all mutant anchors match once.');
        process.exit(0);
    }
    writeFileSync(docPath, rendered);
    console.log('✔ Updated docs/CHECK-MUTATION-EVIDENCE.md');
}
