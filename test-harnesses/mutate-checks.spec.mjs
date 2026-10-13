/**
 * Proves `mutate-checks.mjs` leaves the tree as it found it however a run ends -- see the header of
 * `mutation-run.mjs` for the three endings and why each needs its own cleanup.
 *
 * Every test runs the driver against a TEMP COPY of the repository's shape: the two harness files and
 * every source file a mutant names. Nothing here touches this checkout, and nothing needs a database:
 * `MUTATE_CHECKS_BUILD_COMMAND` and `MUTATE_CHECKS_TEST_COMMAND` swap the real build and suite for
 * two fixture scripts that record what happened.
 *
 * NO MUTANT ID IS NAMED. The driver runs its whole list and the tests wait for whichever mutant first
 * applies. A test pinned to one mutant would start failing the day that mutant's anchor drifts, for a
 * reason that has nothing to do with cleanup.
 *
 * TIMING. Process deaths are POLLED with a deadline, never checked once: the same test in
 * bizapps-common checked a grandchild a few milliseconds after the driver exited and failed 1 run in
 * 5 locally and 1 in 2 in CI.
 *
 * Run: node --test test-harnesses/mutate-checks.spec.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const MARKER = '.mutate-checks.run.json';
const SIGNAL_EXIT = { SIGINT: 130, SIGTERM: 143 };
const NO_POSIX_SIGNALS = process.platform === 'win32'
    && 'Windows cannot deliver SIGINT/SIGTERM to another process; Ctrl-C there is checked by hand';

/** The source files the mutants edit, read from the driver's own `--list`. */
function mutantFiles() {
    const list = spawnSync(process.execPath, [join(HERE, 'mutate-checks.mjs'), '--list'], { encoding: 'utf8' });
    assert.equal(list.status, 0, list.stderr);
    const files = new Set(list.stdout.split('\n').map((line) => line.match(/^\S+\s+(\S+)\s+expect /)?.[1]).filter(Boolean));
    assert.ok(files.size > 0, 'expected --list to name at least one mutant file');
    return [...files];
}

const FILES = mutantFiles();

/**
 * The fixture build logs `start <fingerprint>` and `done <fingerprint>` of the mutant files as it
 * found them, and sleeps between the two when `slow-rebuild` exists and the tree is back to its
 * original. The fixture suite starts a long-lived grandchild, records both PIDs, and either hangs
 * (`hang` exists) or prints a tally and exits.
 */
const FINGERPRINT = `
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const files = JSON.parse(readFileSync('files.json', 'utf8'));
export const fingerprint = () => createHash('sha256').update(files.map((f) => readFileSync(f)).join('\\0')).digest('hex');
`;
const BUILD = `
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { fingerprint } from './fingerprint.mjs';
const fp = fingerprint();
appendFileSync('builds.log', \`start \${fp}\\n\`);
if (existsSync('slow-rebuild') && fp === readFileSync('original.fp', 'utf8')) await new Promise((r) => setTimeout(r, 30_000));
appendFileSync('builds.log', \`done \${fp}\\n\`);
`;
const SUITE = `
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000);'], { stdio: 'ignore' });
writeFileSync('pids.json', JSON.stringify({ suite: process.pid, grandchild: grandchild.pid }));
if (existsSync('hang')) {
    setInterval(() => {}, 1000);
} else {
    grandchild.kill();
    console.log('  1 passed, 0 failed, 0 skipped');
}
`;

function makeFixture({ hang = true } = {}) {
    const root = mkdtempSync(join(tmpdir(), 'mutate-checks-spec-'));
    mkdirSync(join(root, 'test-harnesses'));
    for (const name of ['mutate-checks.mjs', 'mutation-run.mjs']) cpSync(join(HERE, name), join(root, 'test-harnesses', name));
    for (const file of FILES) {
        mkdirSync(dirname(join(root, file)), { recursive: true });
        cpSync(join(REPO, file), join(root, file));
    }
    writeFileSync(join(root, 'files.json'), JSON.stringify(FILES));
    writeFileSync(join(root, 'fingerprint.mjs'), FINGERPRINT);
    writeFileSync(join(root, 'build.mjs'), BUILD);
    writeFileSync(join(root, 'suite.mjs'), SUITE);
    if (hang) writeFileSync(join(root, 'hang'), '');
    const fixture = { root, original: fingerprintOf(root) };
    writeFileSync(join(root, 'original.fp'), fixture.original);
    return fixture;
}

function fingerprintOf(root) {
    return createHash('sha256').update(FILES.map((f) => readFileSync(join(root, f))).join('\0')).digest('hex');
}

/** With no IDs the driver runs every mutant, so a test waits for whichever applies first. */
function startDriver(root, ids = []) {
    const child = spawn(process.execPath, [join(root, 'test-harnesses', 'mutate-checks.mjs'), ...ids], {
        cwd: root,
        env: {
            ...process.env,
            MUTATE_CHECKS_BUILD_COMMAND: `"${process.execPath}" build.mjs`,
            MUTATE_CHECKS_TEST_COMMAND: `"${process.execPath}" suite.mjs`,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.output = '';
    child.stdout.on('data', (chunk) => { child.output += chunk; });
    child.stderr.on('data', (chunk) => { child.output += chunk; });
    child.exited = new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
    return child;
}

async function waitFor(what, predicate, timeoutMs = 15_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.fail(`timed out waiting for ${what}`);
}

async function waitForExit(child, timeoutMs = 15_000) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`driver did not exit:\n${child.output}`)), timeoutMs);
    });
    try {
        return await Promise.race([child.exited, timeout]);
    } finally {
        clearTimeout(timer);
    }
}

function isAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (err) {
        return err.code === 'EPERM';
    }
}

const readPids = (root) => JSON.parse(readFileSync(join(root, 'pids.json'), 'utf8'));
const builds = (root) => (existsSync(join(root, 'builds.log')) ? readFileSync(join(root, 'builds.log'), 'utf8').trim().split('\n') : []);
const readMarker = (root) => JSON.parse(readFileSync(join(root, MARKER), 'utf8'));
const backupDirs = () => new Set(readdirSync(tmpdir()).filter((name) => name.startsWith('mj-mutate-')));

/** Waits until a mutant is on disk AND the suite has started against it. */
async function waitForSuite(fixture) {
    await waitFor('a mutant to be applied', () => fingerprintOf(fixture.root) !== fixture.original);
    await waitFor('the fixture suite to start', () => existsSync(join(fixture.root, 'pids.json')));
}

/** Best effort, so a failing test does not leave a sleeping process on the machine. */
function cleanUp(fixture, dirsBefore) {
    if (existsSync(join(fixture.root, 'pids.json'))) {
        for (const pid of Object.values(readPids(fixture.root))) {
            try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
        }
    }
    for (const name of backupDirs()) if (!dirsBefore.has(name)) rmSync(join(tmpdir(), name), { recursive: true, force: true });
    rmSync(fixture.root, { recursive: true, force: true });
}

for (const signal of Object.keys(SIGNAL_EXIT)) {
    test(`${signal} mid-suite kills the process tree, restores the source, rebuilds, and leaves nothing behind`, { skip: NO_POSIX_SIGNALS }, async () => {
        const fixture = makeFixture();
        const dirsBefore = backupDirs();
        try {
            const driver = startDriver(fixture.root);
            await waitForSuite(fixture);
            const { grandchild } = readPids(fixture.root);

            driver.kill(signal);
            const { code } = await waitForExit(driver);

            assert.equal(code, SIGNAL_EXIT[signal], driver.output);
            assert.equal(fingerprintOf(fixture.root), fixture.original, 'every mutant file must be byte-identical to before the run');
            await waitFor('the grandchild to die', () => !isAlive(grandchild), 5_000);
            assert.equal(builds(fixture.root).at(-1), `done ${fixture.original}`, 'the last build must be a completed rebuild of the restored source');
            assert.ok(!existsSync(join(fixture.root, MARKER)), 'the run marker must be removed');
            const leaked = [...backupDirs()].filter((name) => !dirsBefore.has(name));
            assert.deepEqual(leaked, [], `backup dir(s) leaked: ${leaked.join(', ')}`);
        } finally {
            cleanUp(fixture, dirsBefore);
        }
    });
}

test('a second signal skips the rebuild, keeps the marker, and the next run finishes the rebuild', { skip: NO_POSIX_SIGNALS }, async () => {
    const fixture = makeFixture();
    const dirsBefore = backupDirs();
    try {
        writeFileSync(join(fixture.root, 'slow-rebuild'), '');
        const driver = startDriver(fixture.root);
        await waitForSuite(fixture);
        const { mutant } = readMarker(fixture.root);

        driver.kill('SIGTERM');
        await waitFor('the rebuild to start', () => builds(fixture.root).includes(`start ${fixture.original}`));
        driver.kill('SIGTERM');
        const { code } = await waitForExit(driver);

        assert.equal(code, 143, driver.output);
        assert.equal(fingerprintOf(fixture.root), fixture.original, 'the source is restored before the rebuild starts');
        const marker = readMarker(fixture.root);
        assert.equal(marker.distDirty, true, 'the marker must record that dist/ was not rebuilt');
        assert.equal(marker.file, null, 'the marker must record that the source is already restored');

        rmSync(join(fixture.root, 'slow-rebuild'));
        rmSync(join(fixture.root, 'hang'));
        rmSync(join(fixture.root, 'builds.log'));
        const next = startDriver(fixture.root, [mutant]);
        await waitForExit(next);

        assert.match(next.output, /recovering a run that ended without cleaning up/);
        assert.equal(builds(fixture.root)[1], `done ${fixture.original}`, 'the next run rebuilds the restored source before its first mutant');
        assert.ok(!existsSync(join(fixture.root, MARKER)), 'the marker must be gone once the next run finishes');
    } finally {
        cleanUp(fixture, dirsBefore);
    }
});

test('a run killed past any handler is restored and rebuilt by the next start', async () => {
    const fixture = makeFixture();
    const dirsBefore = backupDirs();
    try {
        const driver = startDriver(fixture.root);
        await waitForSuite(fixture);
        driver.kill('SIGKILL');
        await waitForExit(driver);
        for (const pid of Object.values(readPids(fixture.root))) {
            try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
        }

        assert.notEqual(fingerprintOf(fixture.root), fixture.original, 'precondition: SIGKILL leaves the mutant on disk');
        const { mutant, backup } = readMarker(fixture.root);
        assert.ok(mutant && existsSync(backup), 'the marker must name the mutant and a backup that still exists');

        rmSync(join(fixture.root, 'hang'));
        rmSync(join(fixture.root, 'builds.log'));
        const next = startDriver(fixture.root, [mutant]);
        await waitForExit(next);

        assert.match(next.output, new RegExp(`restored .* \\(mutant ${mutant}\\)`));
        assert.equal(builds(fixture.root)[1], `done ${fixture.original}`, 'recovery rebuilds before the first mutant');
        assert.equal(fingerprintOf(fixture.root), fixture.original);
        assert.ok(!existsSync(join(fixture.root, MARKER)));
    } finally {
        cleanUp(fixture, dirsBefore);
    }
});

test('a marker naming a live PID refuses to run and changes nothing', async () => {
    const fixture = makeFixture();
    const dirsBefore = backupDirs();
    try {
        const live = { pid: process.pid, startedAt: 'earlier', safety: null, mutant: 'M-LIVE', file: join(fixture.root, FILES[0]), backup: null, distDirty: true };
        writeFileSync(join(fixture.root, MARKER), JSON.stringify(live));

        const driver = startDriver(fixture.root);
        const { code } = await waitForExit(driver);

        assert.equal(code, 2, driver.output);
        assert.match(driver.output, new RegExp(`another mutation run is live in this tree: PID ${process.pid}`));
        assert.deepEqual(readMarker(fixture.root), live, 'the live run\'s marker must be left alone');
        assert.equal(fingerprintOf(fixture.root), fixture.original);
        assert.deepEqual(builds(fixture.root), [], 'nothing may build under a live run');
    } finally {
        cleanUp(fixture, dirsBefore);
    }
});
