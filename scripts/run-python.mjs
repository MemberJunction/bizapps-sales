#!/usr/bin/env node
/**
 * Runs a Python script with whichever interpreter this machine actually has.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────────
 *
 * `test:drift-gate` ran `python scripts/assert-no-comment-drift.py`. On macOS there is NO `python` --
 * Apple removed the Python 2 shim, and Homebrew installs `python3` only -- so the gate exited 127
 * with `sh: python: command not found`.
 *
 * THAT IS THE DANGEROUS SHAPE, not the inconvenience. A gate that cannot run is indistinguishable at a
 * glance from a gate that ran and found nothing: `npm run verify` chains with `&&`, so the failure
 * stopped the chain, but anyone reading a CI log or running the gate alone sees a non-zero exit with no
 * finding and reasonably concludes the tooling is broken rather than that the audit never happened. It
 * is the same family as the vacuous-run problem `assert-check-count.mjs` was written for, and as the
 * `.env` parser that reported `SKIPPED` while sweeping nothing.
 *
 * Hardcoding `python3` would merely move the breakage: this repo is developed on Windows too (see
 * CLAUDE.md rule 6), where a python.org install provides `python` and the `py` launcher but often no
 * `python3` on PATH. So the interpreter is RESOLVED, once, here -- and both callers (package.json and
 * `.github/workflows/ci.yml`) go through this one place rather than each guessing.
 *
 * A candidate is accepted only if it reports **Python 3**, which also rejects the Windows Store stub
 * that exists on PATH, prints an advertisement and exits non-zero.
 */
import { spawnSync } from 'node:child_process';

/** Tried in order. `py -3` is the Windows launcher, which is present when `python3` is not. */
const CANDIDATES = [
    { cmd: 'python3', pre: [] },
    { cmd: 'python', pre: [] },
    { cmd: 'py', pre: ['-3'] },
];

/** True when this candidate answers `--version` with a Python 3. */
function isPython3(cmd, pre) {
    const probe = spawnSync(cmd, [...pre, '--version'], { encoding: 'utf8', shell: false });
    if (probe.error || probe.status !== 0) {
        return false;
    }
    // Python 2 wrote the version to stderr, 3 writes it to stdout; read both rather than pick.
    return /^Python 3\./m.test(`${probe.stdout ?? ''}${probe.stderr ?? ''}`);
}

const script = process.argv[2];
if (!script) {
    console.error('run-python.mjs: no script given. Usage: node scripts/run-python.mjs <script.py> [args...]');
    process.exit(2);
}
const forwarded = process.argv.slice(3);

const found = CANDIDATES.find((c) => isPython3(c.cmd, c.pre));
if (!found) {
    console.error(
        '\n✖ No Python 3 interpreter found.\n\n' +
            `  Tried: ${CANDIDATES.map((c) => [c.cmd, ...c.pre].join(' ')).join(', ')}\n\n` +
            '  This gate audits comments against the code they describe, so a missing interpreter means\n' +
            '  the audit did not run -- it is NOT a clean result. Install Python 3 and re-run.\n' +
            '    macOS:  brew install python\n' +
            '    Ubuntu: sudo apt-get install -y python3\n',
    );
    process.exit(127);
}

const run = spawnSync(found.cmd, [...found.pre, script, ...forwarded], { stdio: 'inherit', shell: false });
if (run.error) {
    console.error(`run-python.mjs: failed to run ${found.cmd}: ${run.error.message}`);
    process.exit(1);
}
// A signal death has a null status; reporting 0 there would call a killed audit a pass.
process.exit(run.status === null ? 1 : run.status);
