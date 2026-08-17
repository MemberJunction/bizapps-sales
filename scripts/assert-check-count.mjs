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
 * Usage:  node scripts/assert-check-count.mjs [integration-log]
 *         (defaults to the log the runner writes: test-harnesses/.integration-log.txt)
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_LOG = join(root, 'test-harnesses', '.integration-log.txt');
const logPath = process.argv[2] ?? DEFAULT_LOG;

if (!existsSync(logPath)) {
    console.error(
        `\n✖ no integration log at ${logPath}\n\n` +
            '  The gate reads the log the runner writes. Produce one first:\n\n' +
            '      RUN_MUTATION_TESTS=1 pnpm run test:integration\n',
    );
    process.exit(2);
}

const manifest = JSON.parse(readFileSync(join(root, 'scripts', 'expected-check-counts.json'), 'utf8'));
const log = readFileSync(logPath, 'utf8');

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
    if (spec.requires === null || linked.has(spec.requires)) {
        expected.set(bundle, spec);
    }
}

const expectedTotal = [...expected.values()].reduce((a, b) => a + b.count, 0);
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

const skippedBundles = Object.keys(manifest.bundles).filter((b) => !expected.has(b));
console.log(
    `✓ coverage assertion passed — ${ran} checks ran across ${expected.size} bundles ` +
        `(${passed} passed, ${failed} failed)` +
        (skippedBundles.length
            ? `\n  not expected on this host (app not linked): ${skippedBundles.join(', ')}`
            : ''),
);
