# playwright/ — Explorer GUI harness (bizapps-sales)

Drives the real MJ Explorer UI against a live host and, wherever the UI writes, reads the database
rather than the screen. A generated form can fail to render a field, a lookup can fail to resolve, a
save can silently no-op — and all three look identical to a passing API test.

Re-runnable, self-cleaning, and it needs a human **once** (to log in) and never again.
`COVERAGE-MAP.md` has one row per spec — what it drives, asserts and does not assert — and the latest
measured run.

## Run it

```bash
# from the repo root — the MJ host's MJAPI and MJExplorer must already be up
pnpm run test:explorer:auth     # ONE TIME: headed, you complete the login. Saves .auth/user.json
pnpm run test:explorer          # the suite — no login, headed so you can watch
PW_HEADLESS=1 pnpm run test:explorer      # unattended
pnpm run test:explorer:report   # open the HTML report
```

The harness does **not** start servers. `docs/QA-GUIDE.md` §2 has their ports and how Explorer's
identity provider is chosen. `lib/global-setup.ts` checks both servers are reachable before any test
runs and fails with the fix if not.

| Setting | Effect |
|---|---|
| `MJAPI_PORT` / `MJAPI_URL`, `MJEXPLORER_PORT` / `MJEXPLORER_URL` | Point at servers off the defaults in `lib/env.ts` |
| `MJ_API_KEY` | Lets the preflight confirm MJAPI serves this app's metadata; the check is skipped without it |
| `PW_HEADLESS=1` | Run the suite without a window |
| `PW_FORCE_LOGIN=1` | Ignore the saved session and open a headed login — use it when a session has expired |
| `PW_LOGIN_TIMEOUT_MS` | How long the login waits for a human (default 5 minutes) |
| `PW_AUTH_ASSIST_PICK_ACCOUNT=1` | Clicks an account tile the identity provider already shows as signed in; types nothing |
| `PW_SLOWMO=<ms>` | Pause between gestures so a person can follow the run |
| `PW_WORKERS=<n>` | More than one worker; an experiment, see `run-suite.sh` |
| `PW_NO_EPHEMERAL=1` | Use the signed-in user's saved Explorer workspace instead of a throwaway one |
| `PW_PROBE=1` | Run the diagnostic probe specs `01`–`03` |

## Auth — how login works, and why it is the way it is

**A human logs in once; the session is reused after that.** The setup project opens a headed browser,
waits up to 5 minutes for the authenticated app shell to appear, and saves the browser session to
`.auth/user.json`. It types nothing into the login form and stores no username or password.

**`storageState` reuse works here because MJ's MSAL and Auth0 providers cache in `localStorage`**
(`cacheLocation` in `@memberjunction/ng-auth-services`). Once captured, `auth-setup` short-circuits: it is
seeded with the saved state, detects "already authenticated", and exits in seconds without opening a
window. An expired session is still a file on disk, so the setup then runs headless and waits for a
login nobody can see; `PW_FORCE_LOGIN=1` replaces it.

> **This is the opposite of the `bizapps-accounting` harness, deliberately.** That one authenticates
> with an MJ magic-link token, which lives in **sessionStorage** — `storageState` cannot capture it, so
> every one of its specs re-consumes the link. Same family, different auth mechanics, different correct
> design. Do not "align" one with the other.

The harness is **provider-agnostic** — it waits for the app shell, not for a particular login form — so
any provider works. Which one Explorer uses, and the redirect origin it needs, are in
`docs/QA-GUIDE.md` §2.

## Navigation

The specs use two routes:

- **`/app/sales`** — the hand-built Deals section: Dashboard, All deals and Board on its left rail. A
  deal opens as an Explorer record tab on the Deal form (`mjs-deal-form`); New deal opens an unsaved one.
- **`/app/mjbizappssales`** — the CodeGen entity browser, one generated grid and form per entity. Specs
  `00`–`04`, `10`, `20` and `30` drive it, and `40` reads its saved deal back there.

`specs/00-recon.spec.ts` re-derives the route from the shell to an editable Deal at runtime and prints
it. Run it first when anything below stops matching — it is the map, and it is cheaper than guessing.

## Files

| Path | Role |
|---|---|
| `playwright.config.ts` | Two projects: `auth-setup` (headed, human login, once) and `crud` (every spec, reusing the session). One worker unless `PW_WORKERS` says otherwise. |
| `auth.setup.ts` | One-time interactive auth capture, plus a recon dump to `.auth/recon.json`. |
| `lib/env.ts` | Ports, URLs, entity names, the `PW-VERIFY` prefix, the seeded dev company. All env-overridable. |
| `lib/global-setup.ts` | Preflight: servers reachable, MJAPI serving this app's metadata, plus a **pre-clean**. |
| `lib/global-teardown.ts` | Unconditional cleanup, so a failed run never poisons the next one. |
| `lib/cleanup.mjs` | FK-ordered SQL delete of every row named with a harness prefix (`PW-`, `TS-`, `BD-`, `AT-`, `CL-`, `RT-`), sparing the seeded `DEAL-90*` deals. Also runnable directly. |
| `lib/test.ts` | The specs' `test`: each browser context gets a throwaway Explorer workspace, so a run never reads or writes the signed-in user's tabs. |
| `lib/explorer.ts` | The console-error **keystone**, navigation, and the generated-form helpers. |
| `lib/deal-form.ts` | Drives the Deal record form: fields by `data-field`, actions by `data-testid`, panels expanded and sections revealed before use. |
| `lib/deal-flow.ts` | Compose, add lines, close, reopen and purge a deal through the Deal form; `AssertBaseline` checks the seeded deals are untouched. |
| `lib/db.ts` | Read-only database queries the specs assert against. |
| `lib/mssql.d.ts` | Types for `mssql`, which ships none. |
| `specs/` | 26 spec files. `COVERAGE-MAP.md` has one row per spec. |
| `run-suite.sh` | Runs the suite in two phases: most specs at several workers, then the three that share seeded deals one at a time. Its header records that the split is not validated; one worker stays the default. |
| `probe-cause3.mjs`, `probe-clear-recent.mjs`, `probe-recent-control.mjs` | One-off diagnostics from the August investigation of a deleted record that Explorer kept restoring. Not part of the suite. |
| `package.json`, `tsconfig.json` | `type: module`, which Playwright needs to load `lib/env.ts`; and the typecheck-only config `test:spec-gate` uses. |

### Traps these specs have hit

None of them looks like a selector bug when it fires — they read as data bugs, which is why they cost
real time:

1. **Pages and record tabs are hidden, not removed.** The Sales section keeps every rail page in the DOM
   with `[hidden]`, and Explorer keeps every open record tab's form. The dashboard's Inspect card and All
   deals are both `mj-entity-viewer`, so scope a locator to its page (`.wrap--list`, `.wrap--dashboard`,
   as `50-sales-shell` does) and to the visible record (the hidden-tab rule below).
2. **The Deal form shows one section at a time.** `OpenSection` expands a panel but does not move the
   form's section rail, so a `:visible` locator for a control in another section finds nothing and the
   failure reads like missing data. Call `RevealInForm` (`lib/deal-form.ts`) first.
3. **A related grid loads only while its section is open.** The Internal team grid binds its loading to
   the section being expanded, so after `OpenSection` alone it holds zero rows.
   `76-team-roster-owner-stamp` opens the section through the form's rail button for that reason.
4. **Angular bindings do not always reach the DOM.** A `<select>` bound with `[ngValue]` writes option
   values as `"<index>: <value>"`, so an empty choice reads `"0: null"`, which is truthy; `74` pulls the
   GUID out with a pattern. A radio's `[value]` binding never reaches `input.value`, which reads `"on"`;
   the Close panel adds `data-status-id` for that reason (`60`).

Specs remove the rows they create in `afterAll`, by their own run tag, and `lib/cleanup.mjs` sweeps
every harness prefix before and after a run. `70-lifecycle`, `71`, `78`, `80-cross-company-products`
and `82` also check that the seeded deals are untouched (`AssertBaseline`).

`.auth/`, `artifacts/`, `playwright-report/` and `test-results/` are all gitignored.
**`.auth/user.json` is a live bearer token for a real account — never commit it.**

## The keystone

A UI that renders but logs a console error is broken in a way presence assertions cannot see, so every
run captures `console.error` + `pageerror` and asserts the list is empty. Two scoped lists in
`lib/explorer.ts` each tolerate one documented shape and nothing else: `KNOWN_POST_DELETE_ERRORS` for
the delete steps (finding 2 below), and `KNOWN_DEAD_RECORD_RESTORE_ERRORS` for Explorer restoring a
record that has since been deleted.

The global allowlist in `lib/explorer.ts` is deliberately tight. Four entries earn their place — the data
provider's `MISSING FIELDS` notice for IsA children, an Angular `NG0100` scoped to MJ core's home-page
widget, the Font Awesome kit's 403 on localhost, and MSAL's 404 for a user with no Graph profile photo.
A 404 on a *static asset* is noise; a 404 on anything else stays a real signal, because a blanket 404
filter would mask genuine backend failures.

## Findings from building this

Things the harness surfaced that are worth knowing, and are not bugs in this app's schema:

1. **Delete is a SOFT delete.** After deleting, the grid gains a `Recycle Bin · N deleted records`
   chip. So "the row left the grid" is the correct UI-level assertion — not absence from the database.
2. **Deleting a record whose tab is still open logs an error**:
   `Error in BaseEntity.Load(MJ_BizApps_Sales: Deals, Key: ID=…)`. MJ Explorer's tab manager re-Loads
   the now-deleted record. Reproducible for every entity; the delete itself succeeds. An MJ-core
   tab-lifecycle concern — scoped in `KNOWN_POST_DELETE_ERRORS` rather than globally ignored.
3. **The generated grid has no Delete control**, even with a row selected. Deletion is a
   **record-level** action: open the record, then `button[title="Delete this Record"]` — behind the
   record toolbar's "More actions" unless the user pinned it — then a "Confirm Deletion" dialog.
4. **There are two "Delete" buttons in the DOM.** One is a hidden, pre-rendered confirmation button that
   still reports a non-zero bounding box — so "visible and sized" heuristics accept it and the click
   then times out. The real one carries a trash icon; the harness discriminates on that.
5. **NOT NULL surfaces in the UI.** Required-but-empty fields get
   `.mj-forms-field--required-empty`, which the spec asserts for `Deal.Pipeline`, `Deal.Company` and
   `Pipeline.Company` — a real check that the generated form honours the schema.
6. **View mode omits NULL fields entirely.** It is not a read-only copy of the edit form, so a nullable
   field can only be asserted to render in edit mode. This is why the provenance trio
   (`Amount Is Computed` / `Amount Computed At` / `Amount Source Hash`) is checked after
   `enterEditMode`.
7. **Soft cross-app references surface as raw UUID text boxes** — `Currency ID`, `Campaign ID`,
   `Contract ID`, `Renews Contract ID` — because they carry no FK (DG-6), so CodeGen cannot offer a
   lookup.
8. **`MRR`/`ARR` render as "Mrr"/"Arr".** CodeGen's PascalCase word-splitting does not know they are
   acronyms. Cosmetic; fixable with a `DisplayName` in entity-field metadata.

## A killed mutation run leaves the mutant behind — `git status` before trusting a clean tree

`test-harnesses/mutate-checks.mjs` copies a source file aside, edits it, builds, runs the suite, and
restores from the copy in a `finally`. Kill the process between the edit and the restore and **the
mutation stays in the working tree and in `dist/`**.

It has happened three times. Each looked like a puzzling test failure rather than a stranded edit,
because `git diff` on a file nobody remembers touching is not where anyone looks first.

**The driver now cleans up after itself** (`test-harnesses/mutation-run.mjs`). Ctrl-C, SIGTERM or
Ctrl-Break kills the build/suite's process tree, restores the source and rebuilds; a second Ctrl-C skips
the rebuild. A kill no handler sees (SIGKILL, a closed window) is repaired by the **next** run, which
restores and rebuilds before measuring anything.

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

### Read the gate before committing, not beside it

The spec typecheck gate caught a backtick inside a JavaScript template literal in a patch to
`lib/deal-flow.ts` -- the gate working exactly as designed. It was still committed, because the commit
was chained after the gate in one command rather than gated on it, and the broken version needed a
follow-up. Run the gate, READ it, then commit.

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

## Run the anchor validator AFTER an edit, not before — or it lies to you

**A source edit that touches a line a mutant anchors on has silently disarmed that mutant.** The driver
matches `from` EXACTLY; a missed match is reported as a SKIP, and a skip reads as anchor drift against a
moved tree rather than as the edit you just made.

Measured on myself. Changing `routingIssues(routing)` to `routingIssues(routing, false)` — a two-token
change to give the preview branch its own semantics — disarmed `M-RI1`, which anchors on that exact
line. I had run the validator BEFORE the edit, so it was green, and nothing said otherwise until a merge
several commits later ran it again for an unrelated reason.

**The ordering is the whole difference between the validator working and the validator lying.** Running
it first tells you the state you are leaving; running it after tells you the state you are creating. It
costs a second:

```bash
node <scratch>/verify-anchors.mjs      # every mutant's `from` must match its file EXACTLY ONCE
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

## Editing these files — run the edit in the FOREGROUND

**A scripted edit run inside a backgrounded command can fail invisibly.** If its anchor does not match,
the assertion fires, nothing is written, and the failure message goes to a log nobody reads — while the
run you launched in the same command carries on against the OLD file and reports a result you will
attribute to the new one.

That happened here twice in one round, compounding: an LF anchor was matched against a CRLF file so it
matched zero times, the edit silently did nothing, and the SECOND edit then anchored on the first one's
expected output and failed for the same invisible reason. Two runs were reported as testing a fix that
was never applied, and one of them passed by luck.

**The rule: anything whose success you would report goes in the foreground, and you check it landed.**
Print the anchor count, and confirm with `git status` before drawing a conclusion from a run.

Two specifics worth knowing when writing one:

- **These files are CRLF.** Normalise before matching (`s.replace('

', '
')`) and restore on write,
  or every multi-line anchor silently matches nothing.
- **`lib/cleanup.mjs` holds its SQL in a JS template literal**, so a backtick anywhere in it — including
  inside a comment, like `` `__mj.UserRecordLog` `` — terminates the string. `node --check` catches it.

## THE HIDDEN-TAB RULE — scope every locator to what is VISIBLE

**MJ's shell keeps every open tab's form in the DOM and merely HIDES the inactive ones.** A spec that has
opened two records is holding two record views at once, and only the front one can be interacted with.

So an unscoped `.first()` is not "the obvious one" — it is a lottery weighted towards the OLDEST tab,
because that is the one earliest in document order.

**The rule: any locator that could match a form field, a record control, or a grid row must be scoped to
the visible copy.** Either form works:

```ts
page.locator('button[title="Delete this Record"]:visible').first()   // CSS pseudo-class
page.getByText(DEAL_NAME).filter({ visible: true }).first()          // filter, for getByText/getByRole
```

This is not a style preference. It has cost real time three separate ways, and every one of them looked
like a product defect:

- **`fieldLabelVisible`** matched the DEAL form's hidden `Name` input while a "New Deals Record" tab was
  still open, and asserted against the wrong form's value.
- **`deleteRecordViaRecordView`** resolved `button[title="Delete this Record"]` **36 times, every one
  `hidden`**, and failed with *"the record view must expose Delete this Record"* — about a record view
  that exposes it perfectly well. Until the locator was scoped, the delete step never executed.
- **A reload wait** written *while fixing the delete locator* made the identical mistake one step later:
  a bare `getByText(DEAL_NAME).first()` matched a hidden tab's copy and waited 30s for something that
  could never become visible.

That last one is the reason this is a README rule and not a comment on two locators. Knowing about the
trap is not enough to avoid it; the habit has to be "scope it" every time.

**The tell:** a failure whose call log says the locator *resolved* — often many times — and reports
`hidden` or `element(s) not found` for something you can plainly see on screen. That is this, not the app.
