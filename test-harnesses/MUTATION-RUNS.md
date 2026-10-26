# Mutation runs — recovery and the agent-process rules

How to recover from an interrupted run of the mutation driver (`test-harnesses/mutate-checks.mjs`), and
the process rules for agent sessions that run it. Moved here from `playwright/README.md`, which now covers
the Explorer harness only. The driver itself, and what each mutant is for, is documented in its header.

There is no separate anchor validator script. The driver checks each mutant's anchor when it runs that
mutant, and reports a drifted anchor as a skip.

## A killed mutation run leaves the mutant behind — `git status` before trusting a clean tree

`test-harnesses/mutate-checks.mjs` copies a source file aside, edits it, builds, runs the suite, and
restores from the copy in a `finally`. Kill the process between the edit and the restore and **the
mutation stays in the working tree and in `dist/`**.

It has happened three times. Each looked like a puzzling test failure rather than a stranded edit,
because `git diff` on a file nobody remembers touching is not where anyone looks first.

**The driver now cleans up after itself** (`test-harnesses/mutation-run.mjs`). Ctrl-C, SIGTERM, closing
the terminal or Ctrl-Break kills the build/suite's process tree, restores the source and rebuilds; a
second Ctrl-C skips the rebuild. A kill no handler sees (SIGKILL, or a Windows console window closed
before the rebuild finishes) is repaired by the **next** run, which restores and rebuilds before
measuring anything. A marker that cannot be read, or that names paths outside the run's own files,
stops the start with instructions instead of being acted on.

**`.mutate-checks.run.json` at the repo root means a run may have a mutant applied.** It names the PID
that owns it. If that PID is alive, the run is live: leave the tree alone (the driver itself refuses to
start). If it is dead, start the driver again and it recovers. The steps below are only for when
recovery reports that the backup is gone:

```bash
git status --porcelain          # a modified source file you did not edit IS the mutant
git checkout -- <that file>
npm run build:packages          # restoring the SOURCE is not enough; dist/ still holds it
```

> ### ⚠️ BUT FIRST CHECK IT IS NOT STILL RUNNING — a tool timeout DETACHES, it does not kill
>
> **This is the correction that matters most on this page.** An agent Bash call that hits its
> ten-minute ceiling reports a timeout and *leaves the process running*. The recovery above then
> becomes actively destructive: `git checkout --` plus a rebuild overwrites a **live** experiment's
> mutated source and rebuilds its `dist/` out from under it, so the run compiles and tests
> **unmutated** code and reports a confident, wrong result.
>
> That is how a false `MISS` was published: six runs up to two hours old were still alive, each
> holding or queuing on the suite application lock, so every fresh attempt queued behind an earlier
> one **from the same session**. The full procedure is below. Run it before touching the tree.

### And rebuild after restoring a stranded mutant -- `git status` clean is not enough

This bit for real. Three killed runs were recovered with `git checkout --` on the source, and the tree
read clean. `dist/` still held the mutation, so the next full suite reported **119 passed, 6 failed**
against a tree whose source was correct -- five task checks and one close check, which looks exactly
like a regression and is not. `npm run build:packages` restored 125/0. The rebuild is not optional.

### Diagnose a killed run with `tee`, never `>`

Node block-buffers stdout when it is redirected to a file. Kill the process -- a tool timeout, a
Ctrl-C -- and **everything it printed is lost**, so the log reads as zero bytes.

Four killed mutation runs produced empty files, which was read as "the driver hangs before printing"
and sent the diagnosis to host contention. It was measured and disproved before the truth emerged:
the runs were printing fine and the buffer was discarded. Piping through `tee` showed the output
immediately.

```bash
node test-harnesses/mutate-checks.mjs M-XX 2>&1 | tee /tmp/run.txt   # survives a kill
node test-harnesses/mutate-checks.mjs M-XX > /tmp/run.txt 2>&1       # loses everything on a kill
```

## Check a mutant's anchor AFTER an edit, not before — or it lies to you

**A source edit that touches a line a mutant anchors on has silently disarmed that mutant.** The driver
matches `from` EXACTLY; a missed match is reported as a SKIP, and a skip reads as anchor drift against a
moved tree rather than as the edit you just made.

Measured on myself. Changing `routingIssues(routing)` to `routingIssues(routing, false)` — a two-token
change to give the preview branch its own semantics — disarmed `M-RI1`, which anchors on that exact
line. I had checked the anchors BEFORE the edit, so it was green, and nothing said otherwise until a merge
several commits later ran it again for an unrelated reason.

**The ordering is the whole difference between the check working and the check lying.** Running it
first tells you the state you are leaving; running it after tells you the state you are creating.

No standalone validator is committed, so the check is running the mutant whose anchor your edit touched.
Its `from` must match its file exactly once, or the run reports SKIP. That costs a build and a suite run,
not a second:

```bash
node test-harnesses/mutate-checks.mjs M-XX 2>&1 | tee <scratch>/run.txt
```

The same rule applies to a merge, and for the same reason: whoever merges last owns every anchor in the
result, not just the ones their own branch touched.

## Orphaned runs: the procedure

Three facts, each of which cost real time on 2026-08-24. The first is the one nobody had written down.

### 1. The ten-minute tool ceiling DETACHES the process; it does not kill it

An agent Bash call that times out reports a timeout and returns. **The command keeps running.** Six
mutation runs survived this way, the oldest close to two hours, each holding or queuing on the suite
application lock — so every new attempt queued behind an earlier attempt *from the same session*,
which looked exactly like a busy neighbour.

Consequences worth stating plainly:

- A "killed" run is still writing to your worktree and still holding locks.
- Recovering a "stranded" mutation while its run is alive **corrupts a live experiment** and produces
  a confident wrong result — see the box above.
- Waits get progressively worse across an evening, because orphans accumulate.

### 2. `ps -W` prints no command-line arguments, so it cannot find a run by script name

```bash
ps -W | grep mutate-checks      # matches NOTHING, even while the run is executing
```

`ps -W` emits PID, PPID and an executable path. `mutate-checks.mjs` is an *argument* to `node`, so it
never appears. Any liveness check written this way has been silently blind — and reporting
`live procs: 0` while six were running is what sent a whole evening's diagnosis to the wrong cause.

Use the process table that carries arguments:

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'mutate-checks|integration\.mjs' } |
  ForEach-Object { "{0}  {1}" -f $_.ProcessId, $_.CommandLine }
```

### 3. NEVER kill a process you cannot prove you own

There are **20+ `claude.exe` processes** on this machine. Walking a parent chain until it reaches *a*
`claude.exe` proves nothing whatsoever. A session killed another session's suite runs this way.

The test is to compare that `claude.exe` PID against **your own session's**:

```powershell
# your own session: the claude.exe ancestor of THIS shell
$mine = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID").ParentProcessId

# for a candidate process, walk up until claude.exe and compare
$cur = Get-CimInstance Win32_Process -Filter "ProcessId=$candidate"
while ($cur) {
  $par = Get-CimInstance Win32_Process -Filter "ProcessId=$($cur.ParentProcessId)"
  if (-not $par) { break }
  if ($par.Name -eq 'claude.exe') {
    if ($par.ProcessId -eq $mine) { 'MINE — safe to kill' } else { 'ANOTHER SESSION — leave it' }
    break
  }
  $cur = $par
}
```

If ownership is not provable, **leave it alone and say so in your session status file**. A run you
cannot attribute is someone's work in progress; killing it destroys results that may have taken hours,
and the person who lost them has no way to know why.

### The order to do this in

1. **List** candidates with `Get-CimInstance`, never `ps -W`.
2. **Prove ownership** of each against your own `claude.exe` PID.
3. **Kill only what is provably yours.**
4. **Then** recover the tree: `git status --porcelain`, `git checkout -- <file>`,
   `npm run build:packages`.
5. Verify: no stray mutation in `dist/`, and the suite application lock released.
6. **Record anything you killed that you could not attribute** in your session status file, so the
   session that lost it learns why rather than re-diagnosing it.
