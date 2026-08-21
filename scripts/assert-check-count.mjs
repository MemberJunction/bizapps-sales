#!/usr/bin/env node
/**
 * Fail the build when fewer checks RAN than the registry declares.
 *
 * ── WHY THIS EXISTS, and it is not belt-and-braces paranoia ─────────────────────────────────────
 *
 * Every check in this suite is `RequiresMutation`, and the runner contains
 *
 *     const checks = all.filter((c) => (c.RequiresMutation ? RUN_MUTATIONS : true));
 *
 * so a run WITHOUT `RUN_MUTATION_TESTS=1` executes nothing and finishes with `0 failed`. Read quickly,
 * that is a green run. It means "every check was skipped". The same shape arrives by other routes: a
 * bundle whose Setup throws is one failure and its checks never run; a bundle dropped from the runner's
 * list simply vanishes; a check silently deleted lowers the total and nothing complains.
 *
 * All of those look like success. This turns them into a failure that names the gap.
 *
 * Ported from bizapps-orders, with three differences that the port could not keep:
 *
 * 1. **The counts live in `expected-check-counts.json`, not in a unit test.** Orders parses its
 *    `registry-parity.test.ts`; sales has no such test, and inventing one purely to be scraped would be
 *    a second source of truth wearing a disguise. One JSON file is read by this gate AND by the runner.
 *
 * 2. **Bundles are CONDITIONAL.** Orders expects every bundle unconditionally. Sales runs standalone,
 *    and three of its bundles need orders while a fourth needs contracts — so a straight port fails on a
 *    sales-only host by demanding bundles that cannot exist there. Expectation follows what the run
 *    actually had linked, which the runner reports in its `downstream packages ->` line.
 *
 * 3. **The header format differs.** Sales prints `=== bundle (N of M checks) ===`, which carries both
 *    the number that RAN and the number REGISTERED. That is strictly more information than orders' `(N
 *    checks)`, and it lets this gate catch the skip directly rather than inferring it from a total.
 *
 * -- IT RUNS THE SUITE. IT USED TO READ A FILE, WHICH WAS THE BUG IT EXISTS TO CATCH ------------
 *
 * The gate read `test-harnesses/.integration-log.txt`, whatever had written it last. Two failure modes,
 * and the quiet one is the dangerous one:
 *
 *   - A MUTATION RUN leaves a deliberately red log there, so the gate reports a failure that no longer
 *     exists and no rebuild can clear. Noisy; cost an hour twice on 2026-08-20.
 *   - A STALE GREEN LOG lets the gate PASS code it never saw. That is the vacuous pass -- a green tally
 *     measuring nothing -- reproduced INSIDE the gate written to prevent it. Silent, and it would have
 *     signed off any amount of untested work.
 *
 * So by default it executes the runner itself and judges that output, which cannot be stale. A log path
 * may still be passed (CI reusing one run for several assertions), and then the log must be NEWER than
 * every source file the checks are built from, or it is refused rather than trusted.
 *
 * Usage:  node scripts/assert-check-count.mjs            -- runs the suite (recommended)
 *         node scripts/assert-check-count.mjs <log>      -- judges an existing log, if it is fresh
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'scripts', 'expected-check-counts.json'), 'utf8'));

/** Newest mtime under a tree, ignoring build output, dependencies and dotfiles. */
function newestMtime(dir, newest = 0) {
    let out = newest;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
            continue;
        }
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            out = newestMtime(full, out);
        } else if (['.ts', '.mjs', '.js', '.json'].includes(extname(entry.name))) {
            out = Math.max(out, statSync(full).mtimeMs);
        }
    }
    return out;
}

/**
 * Everything a check's behaviour can come from: `packages` holds the checks AND the code under test,
 * `test-harnesses` holds the runner, and the manifest is what the counts are judged against.
 */
function newestSourceMtime() {
    return Math.max(
        newestMtime(join(root, 'packages')),
        newestMtime(join(root, 'test-harnesses')),
        statSync(join(root, 'scripts', 'expected-check-counts.json')).mtimeMs,
    );
}

function runSuite() {
    console.log('running the integration suite (this gate no longer trusts a log off disk)...');
    try {
        return execFileSync('node', [join(root, 'test-harnesses', 'integration.mjs')], {
            cwd: root,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
            // RUN_MUTATION_TESTS is mandatory: without it the runner skips every check and reports a
            // green nothing. MJ_INTEGRATION_LOG is redirected so this run does not clobber the log a
            // human may be reading -- the verdict comes from stdout, never from disk.
            env: {
                ...process.env,
                RUN_MUTATION_TESTS: '1',
                MJ_INTEGRATION_LOG: join(root, 'test-harnesses', '.integration-log.gate.txt'),
            },
        });
    } catch (err) {
        // A failing suite exits non-zero, and its output is exactly what this gate must report on.
        return String(err.stdout ?? '') + String(err.stderr ?? '');
    }
}

function readFreshLog(logPath) {
    if (!existsSync(logPath)) {
        console.error(
            `\n✖ no integration log at ${logPath}\n\n` +
                '  Pass a log the runner wrote, or pass nothing and let this gate run the suite.\n',
        );
        process.exit(2);
    }
    const logAge = statSync(logPath).mtimeMs;
    const sourceAge = newestSourceMtime();
    if (logAge < sourceAge) {
        const seconds = Math.round((sourceAge - logAge) / 1000);
        console.error(
            `\n✖ REFUSED: the log at ${logPath} is OLDER than the source it would judge` +
                ` (by ${seconds}s).\n\n` +
                '  A stale log makes this gate pass code it never saw, which is the vacuous pass it\n' +
                '  exists to catch. Re-run the suite, or invoke this gate with no argument so that it\n' +
                '  runs the suite itself.\n',
        );
        process.exit(2);
    }
    return readFileSync(logPath, 'utf8');
}

const log = process.argv[2] ? readFreshLog(process.argv[2]) : runSuite();

/**
 * Which sibling apps the RUN had available.
 *
 * Taken from the runner's own `downstream packages -> pkg: loaded | pkg: absent` line rather than by
 * probing this process, so the expectation is judged against the environment the checks actually ran
 * in. A gate that probed its own node_modules could demand bundles from a run that never had them.
 */
function linkedApps() {
    const line = log.match(/downstream packages -> (.*)$/m);
    const linked = new Set();
    if (!line) {
        return { linked, reported: false };
    }
    for (const [app, pkg] of Object.entries(manifest.probes)) {
        if (new RegExp(`${pkg.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')}:\\s*loaded`).test(line[1])) {
            linked.add(app);
        }
    }
    return { linked, reported: true };
}

const { linked, reported } = linkedApps();

/** The bundles this host is expected to have run, and how many checks each must register. */
const expected = new Map();
for (const [bundle, spec] of Object.entries(manifest.bundles)) {
    /**
     * `$`-PREFIXED KEYS ARE COMMENTS, SKIPPED ON PURPOSE RATHER THAN BY LUCK.
     *
     * The manifest carries per-bundle notes inline — `$comment_close_won_tasks` explains a count that
     * looked wrong for a day. Those entries were already being excluded, but only as a side effect: an
     * array has no `.requires`, so `undefined === null` is false and `linked.has(undefined)` is false, and
     * the entry fell out. That works until someone writes a note as an OBJECT, at which point
     * `requires` is undefined, `count` is undefined, and the gate starts demanding a bundle named
     * `$comment_...` that can never run. Stating the rule costs one line.
     */
    if (bundle.startsWith('$')) {
        continue;
    }
    if (spec.requires === null || linked.has(spec.requires)) {
        expected.set(bundle, spec);
    }
}

const expectedTotal = [...expected.values()].reduce((a, b) => a + b.count, 0);

/**
 * AN EMPTY EXPECTATION IS A FAILURE, not a clean run.
 *
 * Every bundle in the manifest now names a sibling app it requires -- saving a deal provisions its
 * embedded order, so even `save-deal` needs orders. That makes zero expected bundles reachable: on a
 * host with nothing linked, `expected` is empty, `expectedTotal` is 0, and every comparison below
 * passes while the suite has executed nothing. That is the vacuous pass this whole script exists to
 * catch, arriving through the one door it did not have a check on.
 */
if (expected.size === 0) {
    console.error(
        `\n\u2716 Integration coverage assertion FAILED\n\n` +
            `  \u00b7 NO bundles were expected on this host. Every bundle in the manifest requires a` +
            ` sibling app, and this run reported none linked (${[...linked].join(", ") || "none"}).\n` +
            `    A run that expects nothing passes while measuring nothing.\n\n` +
            `  Link the sibling apps and re-run -- see docs/WORKSPACE-SETUP.md.\n`,
    );
    process.exit(1);
}
/**
 * One line per check that RAN.
 *
 * The two-space indent is load-bearing: the runner prints results as `  ✔ Name (12ms)`, while its own
 * error banners start a line with `✖` at column zero. A looser `^\s*[✔✖]` counts the banner
 * "✖ ZERO CHECKS RAN" as a check that ran, which is precisely backwards on the run this gate exists to
 * catch.
 */
const ran = (log.match(/^ {2,}[✔✖] /gmu) ?? []).length;
const tally = log.match(/(\d+)\s+passed,\s+(\d+)\s+failed,\s+(\d+)\s+skipped/);
const passed = tally ? Number(tally[1]) : 0;
const failed = tally ? Number(tally[2]) : 0;
const skipped = tally ? Number(tally[3]) : 0;

const problems = [];

if (!reported) {
    problems.push(
        'the log has no "downstream packages ->" line, so which siblings were linked cannot be ' +
            'determined — this log did not come from test-harnesses/integration.mjs',
    );
}
if (!tally) {
    problems.push('the run produced no final tally — it did not finish');
}
if (skipped > 0) {
    problems.push(
        `${skipped} checks were SKIPPED. Every check here is RequiresMutation, so the cause is almost ` +
            'always RUN_MUTATION_TESTS being unset — and a run that skips everything still reports ' +
            '"0 failed".',
    );
}
if (ran < expectedTotal) {
    problems.push(
        `only ${ran} checks ran; this host's linked apps (${[...linked].join(', ') || 'none'}) mean ` +
            `${expectedTotal} were expected — ${expectedTotal - ran} are missing, which a passing tally ` +
            'would have hidden.',
    );
}
if (failed > 0) {
    problems.push(`${failed} checks failed`);
}

// Per bundle, so the message names the gap rather than only the total.
for (const [bundle, spec] of expected) {
    const header = log.match(new RegExp(`=== ${bundle} \\((\\d+) of (\\d+) check`));
    if (!header) {
        problems.push(
            `bundle '${bundle}' never ran${spec.requires ? ` (${spec.requires} IS linked, so it should have)` : ''}` +
                ' — is it missing from the runner\'s list?',
        );
        continue;
    }
    const [, actuallyRan, registered] = header.map(Number);
    if (registered !== spec.count) {
        problems.push(
            `bundle '${bundle}' registers ${registered} checks, expected ${spec.count} (${spec.ids}) — ` +
                'a check was added or deleted without updating scripts/expected-check-counts.json',
        );
    }
    if (actuallyRan < registered) {
        problems.push(`bundle '${bundle}' registered ${registered} checks but ran only ${actuallyRan}`);
    }
}

// A bundle that ran but is NOT expected here is worth saying out loud: it means the run reached
// something this host was not supposed to be able to reach, which is a linkage claim we should not
// silently accept.
for (const bundle of Object.keys(manifest.bundles)) {
    if (!expected.has(bundle) && new RegExp(`=== ${bundle} \\(`).test(log)) {
        problems.push(
            `bundle '${bundle}' ran, but ${manifest.bundles[bundle].requires} is not reported as linked ` +
                '— the run and the manifest disagree about what this host has',
        );
    }
}

if (problems.length) {
    console.error('\n✖ Integration coverage assertion FAILED\n');
    for (const p of problems) console.error(`  · ${p}`);
    console.error(
        '\nA green tally is not evidence on its own. This gate exists because every check in this ' +
            'suite is RequiresMutation, and a run with mutation disabled skips them all and still ' +
            'reports "0 failed".\n',
    );
    process.exit(1);
}

// Same `$` rule as the expectation loop above: a comment key is not an unlinked bundle, and
// reporting it as one turns a passing gate into a line that reads like a missing app.
const skippedBundles = Object.keys(manifest.bundles).filter((b) => !b.startsWith('$') && !expected.has(b));
console.log(
    `✓ coverage assertion passed — ${ran} checks ran across ${expected.size} bundles ` +
        `(${passed} passed, ${failed} failed)` +
        (skippedBundles.length
            ? `\n  not expected on this host (app not linked): ${skippedBundles.join(', ')}`
            : ''),
);
