#!/usr/bin/env node
/**
 * PLAYWRIGHT STRIPS TYPES; IT DOES NOT CHECK THEM. This is the gate for that.
 *
 * Playwright compiles a spec by ERASING its TypeScript annotations. Nothing type-checks the result, so
 * a spec that calls a function it never imported, or passes two arguments to a function that takes
 * three, transpiles happily and ships. The error arrives only when that exact line executes — as a
 * `ReferenceError` inside a running test, several frames from the assertion that was supposed to be
 * reporting.
 *
 * Twenty-one spec files had never been type-checked once. The first run of `tsc` over them found THREE
 * real defects sitting in committed code:
 *
 *     90-workspace-tab-state:386   expectNoConsoleErrors called and never imported — a ReferenceError
 *                                  on the last line of test 3, so the test died at the finish post
 *     41-deal-roundtrip:310        expectOnlyKnownErrors missing its `context` argument
 *     79-embedded-order-refresh:135  expectNoConsoleErrors missing its `context` argument
 *
 * None of them is a type nit. The first is a crash; the other two silently lose the context string that
 * tells a failing run WHICH spec produced the console errors.
 *
 * ── THIS IS THE SECOND ERROR CLASS THAT ONLY SURFACED WHEN A SPEC FINALLY RAN ───────────────────
 *
 * The first was a locator that matched nothing and timed out inside a helper two frames from the
 * reporting assertion. Both were invisible for the same reason — the specs were not running — and that
 * is being fixed separately. A gate is what keeps it fixed once it is: specs that are not running still
 * get compiled here, every time, in the same place as the other gates.
 *
 * ── WHAT THIS READS: SOURCES. DO NOT 'FIX' IT INTO READING BUILD OUTPUT. ────────────────────────
 *
 * `test-harnesses/playwright/tsconfig.json` includes `specs/**\/*.ts` and `lib/**\/*.ts` and sets
 * `noEmit`. The harness has no build output and must never acquire one for this gate's sake.
 *
 * This repo has been bitten by the stale-artefact hazard from BOTH directions already:
 *
 *   · a mutation survived in `dist/` after its source had been restored, and an Explorer spec spent
 *     three runs failing on a defect that was already fixed;
 *   · a junctioned `node_modules` silently resolved `@mj-biz-apps/sales-entities` to a DIFFERENT
 *     checkout's pre-change `dist/`, so a whole verification pass measured code nobody had edited.
 *
 * A checker pointed at generated output tests the generator. Point it at what a human just wrote.
 *
 * ── AN EMPTY SCAN IS A FAILURE, NOT A PASS ─────────────────────────────────────────────────────
 *
 * The same lesson as this repo's comment-drift gate, which pointed at an absolute path on one machine,
 * scanned nothing everywhere else, and reported success for years of runs. If the spec directory moves
 * or the glob stops matching, this exits non-zero and says so rather than printing a cheerful zero.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HARNESS = join(REPO_ROOT, 'test-harnesses', 'playwright');
const TSCONFIG = join(HARNESS, 'tsconfig.json');
const SPECS = join(HARNESS, 'specs');

/** Every spec must be covered, so the count is asserted rather than assumed. */
const MINIMUM_SPECS = 1;

if (!existsSync(TSCONFIG)) {
    console.error(`\nspec-typecheck: ERROR — no tsconfig at ${TSCONFIG}.`);
    console.error('The gate cannot check what it cannot configure. Restore it rather than skipping.\n');
    process.exit(2);
}

let specFiles = [];
try {
    specFiles = readdirSync(SPECS).filter((f) => f.endsWith('.spec.ts'));
} catch {
    console.error(`\nspec-typecheck: ERROR — cannot read ${SPECS}.`);
    console.error('A gate that measures nothing must not report success.\n');
    process.exit(2);
}

if (specFiles.length < MINIMUM_SPECS) {
    console.error(`\nspec-typecheck: ERROR — found ${specFiles.length} spec file(s) under ${SPECS}.`);
    console.error('Either the specs moved or the glob broke. Either way nothing was checked.\n');
    process.exit(2);
}

/**
 * TSC IS RUN THROUGH `node`, NOT THROUGH `npx` — and `--noEmit` is passed TWICE.
 *
 * The flag is in the tsconfig and on the command line both. Belt and braces: if someone later edits
 * the config for another purpose, this still cannot write build output into a harness whose whole
 * point is that it has none.
 *
 * `npx` resolves to `npx.cmd` on Windows, and current Node refuses to spawn a `.cmd` without a shell
 * (`spawnSync npx.cmd EINVAL`). The usual workaround is `shell: true`, which hands the whole argv to a
 * command interpreter and starts caring about quoting on paths that contain spaces -- `C:\Program
 * Files` is on this path. Resolving the compiler's own entry point and running it under the SAME node
 * that is running this gate avoids the shell entirely and pins which TypeScript does the checking.
 */
const require = createRequire(import.meta.url);
let tscBin;
try {
    tscBin = require.resolve('typescript/bin/tsc');
} catch {
    console.error('\nspec-typecheck: ERROR — cannot resolve `typescript`.');
    console.error('The gate cannot type-check without a compiler; run `npm install` at the repo root.\n');
    process.exit(2);
}

let output = '';
let failed = false;
try {
    output = execFileSync(
        process.execPath,
        [tscBin, '--noEmit', '-p', TSCONFIG],
        { cwd: HARNESS, encoding: 'utf8', stdio: 'pipe' },
    );
} catch (err) {
    failed = true;
    output = String(err.stdout ?? '') + String(err.stderr ?? '');
}

const errorLines = output.split(/\r?\n/).filter((l) => /error TS\d+/.test(l));

if (!failed && errorLines.length === 0) {
    console.log(
        `spec-typecheck: clean — ${specFiles.length} spec file(s) and the shared lib/ type-check `
            + 'against SOURCES.',
    );
    process.exit(0);
}

console.error(`\nspec-typecheck: ${errorLines.length || 'unknown'} type error(s) in the Explorer harness.\n`);
console.error('Playwright would have transpiled these anyway and failed at RUNTIME instead — as a');
console.error('ReferenceError or a missing argument inside a running test, frames away from the');
console.error('assertion meant to be reporting. Fix them here, where the message names the line.\n');
for (const line of errorLines.length ? errorLines : output.split(/\r?\n/).slice(0, 20)) {
    console.error(`  ✖ ${line.trim()}`);
}
console.error('');
process.exit(1);
