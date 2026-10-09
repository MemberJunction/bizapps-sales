/**
 * @fileoverview The part of `mutate-checks.mjs` that is not about mutants: running the build and the
 * suite, and leaving the tree as it was found however the run ends.
 *
 * ── THREE WAYS A RUN ENDS, AND WHAT EACH ONE LEAVES ────────────────────────────────────────────
 *
 *   1. It finishes. The driver's own `finally` restores each mutant and rebuilds `dist/`.
 *   2. It is SIGNALLED -- Ctrl-C, SIGTERM, Ctrl-Break on Windows. The handlers here kill the build or
 *      suite's whole process tree, restore the source, rebuild `dist/`, remove the temp backups and exit
 *      130 / 143 / 149. A second signal skips the rebuild; the next run does it instead.
 *   3. It is killed in a way no handler sees -- SIGKILL, a closed window, Windows' TerminateProcess.
 *      Nothing in this process can run, so the cleanup moves to the NEXT start: the run marker below
 *      names the mutant and its backup, and a later run whose marker names a dead PID restores and
 *      rebuilds before it measures anything.
 *
 * Before any of this, an interrupted run left its mutant in the working tree and in `dist/`, and
 * `test-harnesses/playwright/README.md` records three such strandings that read as unrelated test
 * failures.
 *
 * ── THE MARKER IS ALSO HOW A LIVE RUN IS TOLD APART FROM A STRANDED ONE ────────────────────────
 *
 * The documented hand recovery (`git checkout --` plus a rebuild) corrupts a run that is still alive,
 * and an agent's ten-minute tool timeout DETACHES a run rather than killing it, so "my run stopped" was
 * repeatedly wrong. `.mutate-checks.run.json` at the repo root exists for exactly as long as a run may
 * have a mutant applied or a mutated `dist/`, and names the PID that owns it. A start that finds a LIVE
 * PID there refuses to run: two drivers mutating one tree measure each other.
 *
 * ── WHY THE COMMANDS ARE SPAWNED, NOT `execSync`'d ─────────────────────────────────────────────
 *
 * `execSync` blocks the event loop, so a signal handler cannot run until the child exits on its own --
 * by which point the process has already been killed by the signal's default action. The commands also
 * run `detached`, in their own process group, because the work happens in GRANDCHILDREN (`npm` starts
 * `turbo` starts `tsc`) that killing the direct child never reaches. POSIX kills the group with
 * `process.kill(-pid)`; Windows has no process groups, so it kills the tree with `taskkill /T /F`.
 *
 * ── TEST SEAMS ──────────────────────────────────────────────────────────────────────────────────
 *
 * `MUTATE_CHECKS_BUILD_COMMAND` and `MUTATE_CHECKS_TEST_COMMAND` replace `npm run build:packages` and
 * the integration suite, so `mutate-checks.spec.mjs` can interrupt a run with no database. Either one
 * set prints a warning, because a stray value reports results the real suite never produced.
 */
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const MARKER_NAME = '.mutate-checks.run.json';
export const REAL_BUILD_COMMAND = 'npm run build:packages';
const REAL_TEST_COMMAND = 'node test-harnesses/integration.mjs';

/** 128 + the signal number, the shell's convention. SIGBREAK exists only on Windows. */
const EXIT_CODES = { SIGINT: 130, SIGTERM: 143, SIGBREAK: 149 };

/** How long a killed tree gets to go before it is killed without asking. */
const KILL_GRACE_MS = 5_000;

/** Restores from the byte-for-byte copy and PROVES it. Never `git checkout`. */
export function restore(abs, backup) {
    copyFileSync(backup, abs);
    if (readFileSync(abs, 'utf8') !== readFileSync(backup, 'utf8')) {
        console.error(`\n✖ RESTORE FAILED for ${abs}\n  The original is still at ${backup} — copy it back by hand before doing anything else.\n`);
        process.exit(3);
    }
}

/**
 * Starts a run in `repo`: installs the signal handlers, recovers a stranded run if the marker names a
 * dead one, refuses if it names a live one, then writes this run's marker. Call once, before the
 * first mutant.
 */
export async function startMutationRun(repo) {
    const ctx = {
        markerPath: join(repo, MARKER_NAME),
        commands: readCommands(),
        procs: createProcessTracker(repo),
        state: null,
    };
    installSignalHandlers(ctx);
    await recoverStrandedRun(ctx);

    ctx.state = {
        pid: process.pid,
        startedAt: new Date().toISOString(),
        safety: mkdtempSync(join(tmpdir(), 'mj-mutate-')),
        mutant: null,
        file: null,
        backup: null,
        distDirty: false,
    };
    writeMarker(ctx);
    return createRunHandle(ctx);
}

/** What the driver calls as it goes. Each state change is written to the marker before it matters. */
function createRunHandle(ctx) {
    const update = (patch) => {
        Object.assign(ctx.state, patch);
        writeMarker(ctx);
    };
    return {
        commands: ctx.commands,
        safety: ctx.state.safety,
        exec: ctx.procs.exec,
        /** Before the edit: from here on the source may hold this mutant. */
        mutating: ({ id, abs, backup }) => update({ mutant: id, file: abs, backup }),
        /** Before the build: from here on `dist/` may hold the mutant. */
        building: () => update({ distDirty: true }),
        restored: () => update({ mutant: null, file: null, backup: null }),
        rebuilt: () => update({ distDirty: false }),
        /** The marker stays while `dist/` may hold a mutant, so the next run rebuilds first. */
        finish: () => {
            rmSync(ctx.state.safety, { recursive: true, force: true });
            if (ctx.state.distDirty) {
                console.error(`\n  ⚠️  dist/ may still hold a mutant. The next run rebuilds it first, or run \`${REAL_BUILD_COMMAND}\`.`);
                return;
            }
            rmSync(ctx.markerPath, { force: true });
        },
    };
}

function readCommands() {
    const build = process.env.MUTATE_CHECKS_BUILD_COMMAND;
    const test = process.env.MUTATE_CHECKS_TEST_COMMAND;
    if (build) console.error(`WARNING: MUTATE_CHECKS_BUILD_COMMAND is set to "${build}" -- mutants are NOT being built by the real build.`);
    if (test) console.error(`WARNING: MUTATE_CHECKS_TEST_COMMAND is set to "${test}" -- mutants are NOT being measured by the real suite.`);
    return { build: build ?? REAL_BUILD_COMMAND, test: test ?? REAL_TEST_COMMAND, testSeamed: Boolean(test) };
}

function writeMarker(ctx) {
    writeFileSync(ctx.markerPath, `${JSON.stringify(ctx.state, null, 2)}\n`);
}

// ── processes ──────────────────────────────────────────────────────────────────────────────────

/**
 * Runs commands as killable trees and remembers the one in flight. Once `freeze()` is called the
 * driver's loop never resumes, because every await in it ends at a command: so it cannot write a
 * mutant over a tree the signal handler has just restored, or restore from a backup the handler has
 * already deleted.
 */
function createProcessTracker(repo) {
    let active = null;
    let frozen = false;

    function spawnTree(command, extraEnv = {}) {
        const child = spawn(command, {
            cwd: repo, shell: true, detached: true, windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...extraEnv },
        });
        active = child;
        const done = new Promise((resolve) => {
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (chunk) => { stdout += chunk; });
            child.stderr.on('data', (chunk) => { stderr += chunk; });
            const settle = (code, note = '') => {
                if (active === child) active = null;
                resolve({ code, stdout, stderr: stderr + note });
            };
            child.once('error', (err) => settle(1, `could not run "${command}": ${err.message}`));
            // 'close', not 'exit': stdio can still be open at 'exit', which truncates the output.
            child.once('close', (code) => settle(code ?? 1));
        });
        return { child, done };
    }

    const never = () => new Promise(() => {});
    return {
        /**
         * Resolves `{ code, stdout, stderr }` on any exit code; never rejects. After `freeze()` it never
         * settles, including for the command the signal handler just killed.
         */
        exec: (command, extraEnv) => (frozen
            ? never()
            : spawnTree(command, extraEnv).done.then((result) => (frozen ? never() : result))),
        spawnTree,
        freeze: () => { frozen = true; },
        active: () => active,
    };
}

/** Signals a whole tree. ESRCH (already gone) is expected; anything else is surfaced. */
function killTree(child, signal) {
    if (!child) return;
    if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
        return;
    }
    try {
        process.kill(-child.pid, signal);
    } catch (err) {
        if (err.code !== 'ESRCH') console.error(`  could not signal the process group ${child.pid}: ${err.message}`);
    }
}

/** Waits for a signalled tree to close, and kills it outright if it outlasts the grace period. */
function waitForTree(child) {
    if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
    return new Promise((resolve) => {
        const timer = setTimeout(() => killTree(child, 'SIGKILL'), KILL_GRACE_MS);
        child.once('close', () => {
            clearTimeout(timer);
            resolve();
        });
    });
}

// ── signals ────────────────────────────────────────────────────────────────────────────────────

function installSignalHandlers(ctx) {
    // `… | tee log` is the documented way to run this, and Ctrl-C kills tee too. Writing to its
    // closed pipe must not crash the handler before it restores the tree.
    process.stdout.on('error', () => {});
    process.stderr.on('error', () => {});

    let shuttingDown = false;
    for (const [signal, exitCode] of Object.entries(EXIT_CODES)) {
        if (signal === 'SIGBREAK' && process.platform !== 'win32') continue;
        process.on(signal, () => {
            if (shuttingDown) {
                abandonRebuild(ctx, exitCode);
                return;
            }
            shuttingDown = true;
            void shutDown(ctx, signal, exitCode);
        });
    }
}

/**
 * Everything up to the rebuild is synchronous, so a second signal can only ever arrive after the
 * source is back. The rebuild is the one slow step, and the only one a second signal skips.
 */
async function shutDown(ctx, signal, exitCode) {
    ctx.procs.freeze();
    const child = ctx.procs.active();
    killTree(child, signal);
    console.error(`\n${signal} — stopping the run and putting the tree back.`);

    const { state } = ctx;
    if (state?.file) {
        restore(state.file, state.backup);
        Object.assign(state, { mutant: null, file: null, backup: null });
        writeMarker(ctx);
        console.error('  source restored.');
    }
    await waitForTree(child);

    if (state?.distDirty) {
        console.error(`  rebuilding so dist/ does not keep the mutant. Interrupt again to skip; the next run rebuilds instead.`);
        const rebuild = await ctx.procs.spawnTree(ctx.commands.build).done;
        if (rebuild.code !== 0) {
            console.error(`  ⚠️  REBUILD FAILED. dist/ may still hold the mutant — run \`${REAL_BUILD_COMMAND}\`.\n${rebuild.stdout}${rebuild.stderr}`);
            process.exit(exitCode);
        }
        state.distDirty = false;
    }
    if (state) rmSync(state.safety, { recursive: true, force: true });
    // No state yet means the signal landed during recovery, whose marker must survive for the next try.
    if (state) rmSync(ctx.markerPath, { force: true });
    process.exit(exitCode);
}

/** The second signal: the source is already back, so only the rebuild is left, and the marker keeps it. */
function abandonRebuild(ctx, exitCode) {
    killTree(ctx.procs.active(), 'SIGKILL');
    if (ctx.state) rmSync(ctx.state.safety, { recursive: true, force: true });
    console.error(`\n  rebuild skipped. Source is restored; dist/ may still hold the mutant. The next run rebuilds it first, or run \`${REAL_BUILD_COMMAND}\`.`);
    process.exit(exitCode);
}

// ── recovery ───────────────────────────────────────────────────────────────────────────────────

/** EPERM means it exists and belongs to someone else, which is still alive. */
function isAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (err) {
        return err.code === 'EPERM';
    }
}

async function recoverStrandedRun(ctx) {
    if (!existsSync(ctx.markerPath)) return;
    const prior = JSON.parse(readFileSync(ctx.markerPath, 'utf8'));
    if (isAlive(prior.pid)) refuseLiveRun(ctx, prior);

    console.log(`  recovering a run that ended without cleaning up (PID ${prior.pid}, started ${prior.startedAt}).`);
    if (prior.file) {
        if (!prior.backup || !existsSync(prior.backup)) {
            console.error(`\n✖ ${prior.file} may still hold mutant ${prior.mutant}, and its backup (${prior.backup}) is gone.`
                + `\n  Read \`git diff\` on that file and undo the mutant by hand, then delete ${ctx.markerPath}. Nothing was run.\n`);
            process.exit(3);
        }
        restore(prior.file, prior.backup);
        console.log(`  restored ${prior.file} (mutant ${prior.mutant}).`);
    }
    if (prior.distDirty) {
        console.log('  rebuilding, because dist/ may still hold the mutant.');
        const rebuild = await ctx.procs.exec(ctx.commands.build);
        if (rebuild.code !== 0) {
            console.error(`\n✖ REBUILD FAILED during recovery; the marker is kept so the next run tries again.\n${rebuild.stdout}${rebuild.stderr}`);
            process.exit(3);
        }
    }
    if (prior.safety) rmSync(prior.safety, { recursive: true, force: true });
    rmSync(ctx.markerPath, { force: true });
}

/** Two drivers mutating one tree measure each other, and the other run is not ours to stop. */
function refuseLiveRun(ctx, prior) {
    console.error(`\n✖ another mutation run is live in this tree: PID ${prior.pid}, started ${prior.startedAt}`
        + (prior.mutant ? `, with mutant ${prior.mutant} applied to ${prior.file}.` : '.')
        + '\n  Wait for it to report. Do not restore or rebuild under it, and do not kill a run you cannot prove you own.'
        + `\n  If that PID is a different, unrelated process, delete ${ctx.markerPath}. Nothing was run.\n`);
    process.exit(2);
}
