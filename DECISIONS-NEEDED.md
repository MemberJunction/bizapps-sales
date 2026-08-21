# Decisions needed

Raised while rewriting `scripts/seed-demo-data.sh` for the embedded-order model, and while
assessing the `feature/pipeline-board` rebase. Nothing here is blocking tonight's work — each item
has a defensible interim choice recorded in the code — but each is a call someone else should make.

---

## D-1 · Which pipeline stage means "agreement or higher"?

**Where it bites:** the seed script sets every embedded order to `Draft`.

The model says an order advances to `Quoted` when its deal reaches the agreement stage or higher.
Nothing in the schema says which stage that is. `PipelineStage` has `DisplayOrder`, so "or higher" is
expressible as arithmetic, but identifying the *threshold* stage would mean comparing a stage name in
code — which `npm run test:vocabulary-gate` fails the build over, correctly.

Neither seeded pipeline even has a stage called Agreement: B2B runs Discovery → Qualification →
Proposal → Negotiation → Signed → Lost, and D2C runs Introduced → Evaluating → Booked.

**Interim choice:** seed every order `Draft`. It is what deal creation genuinely produces, and it is
what an unadvanced order actually is — so the demo is honest rather than aspirational.

**What is needed:** a behaviour flag on `PipelineStage` (a `QuotesOrder BIT` set on every stage at or
above the threshold keeps "or higher" out of code entirely), plus a ruling on which stages carry it
per pipeline. Once that exists, the seed should set `Quoted` on the deals sitting at or beyond it —
DEAL-9001 is at Negotiation and is the obvious candidate.

---

## D-2 · `Deal.Amount` is no longer maintained by anything

**Where it bites:** the seeded header amounts, and the pipeline board's column totals.

`Deal.Amount` is seeded as a human's stated figure with `AmountIsComputed = 0`, which was always the
design. What changed is that the line items which used to sit beside it now live on the embedded
order, and **nothing reconciles the two**. A deal can carry `Amount = 185000` while its order lines
say something else entirely, and no code notices.

The pipeline board sums `Deal.Amount` for its column totals, so it will show figures that are
unpriced, stale, or both — silently.

**Now measured, on the reseeded demo data.** The board sums `Deal.Amount`; the embedded order lines say
something else entirely:

| Deal | `Deal.Amount` (what the board shows) | Order lines (what is being sold) |
|---|---|---|
| DEAL-9001 | 185,000 | 106,080 |
| DEAL-9003 | 96,000 | 73,080 |
| DEAL-9007 | 9,500 | 4,775 |

That is a 43–50% divergence on every lined deal, and nothing anywhere reconciles it. The board's column
totals are therefore confidently wrong rather than obviously missing, which is the worse failure — a
blank total invites a question, a precise one does not.

**Interim choice:** seeded amounts left as-is and deliberately NOT reconciled to the order lines. The
figures differ, visibly, which is more useful than quietly making them agree in seed data and
discovering the gap in production.

**What is needed:** a decision on what `Deal.Amount` means now. Three shapes, and they are not
equivalent:

1. a read-through of the embedded order's total — one number, always current, and the three
   provenance columns (`AmountIsComputed`, `AmountComputedAt`, `AmountSourceHash`) retire with it;
2. a cached answer whose hash fingerprints the ORDER's lines rather than the retired deal lines, so
   the UI can still say *"stale, reprice"*;
3. it stays a human's estimate and the board stops summing it, showing an order-derived total instead.

---

## D-3 · `Pipeline.RequiresDealLines` survived a table that did not

The column still exists post-rework and the seed still sets it (`0` on the header-only pipeline).
Its description still reads *"whether deals carry catalog lines"*, which now has to be read as "whether
the deal's embedded ORDER carries lines" — the flag outlived the table it was named for.

**Interim choice:** kept, used, and its narrative updated in the seed to say what it now means.

**What is needed:** either a rename (`RequiresOrderLines`) or an updated column description. Low
urgency, but the current name will mislead exactly once per newcomer.

---

## D-4 · Demo order numbers are a reserved prefix, not sequence-minted

Real orders take their number from orders' own sequence (`ORD-000035`). The seed cannot reach that —
it is `sqlcmd` with no provider — so demo orders are `ORD-DEMO-9001/9003/9007`.

**Interim choice:** the `ORD-DEMO-9%` prefix. It keeps the seed idempotent, lets teardown match
exactly its own rows, and can never collide with a sequence-minted number.

**What is needed:** confirmation that a visibly-fake order number is acceptable in the demo. If it is
not, the alternative is provisioning through the entity layer, which means the seed stops being a SQL
script — a much larger change.

---

## D-5 · The stage-event append is now on every write path, including ones that never had it

**Raised by:** moving the board's append out of the deleted `SaveDealOperation` and into
`DealEntityServer.Save()`.

This is a genuine behaviour change and worth being explicit about rather than discovering. Previously
only a stage move made through `Sales.SaveDeal` produced a `DealStageEvent`. Now every stage move does —
an Action, an agent, a fixture, a raw `BaseEntity.Save()`, a data fix run from a script.

That is almost certainly what was always wanted: an append-only provenance log with a hole in it for
whichever callers bypassed one operation is not really a log. But it means **any bulk or migration
script that moves deals between stages will now generate one event per deal**, and a HubSpot import that
replays historical stage history will write events as a side effect of loading.

**Interim choice:** the append fires on every path, because a partial log is worse than a noisy one.

**What is needed:** confirmation, plus a decision on whether an importer needs a documented way to
suppress it — the same shape as the close-lock bypass the importer already needs (CLAUDE.md rule 3
gives it 'an explicit, audited path'), rather than a general-purpose off switch.

---

## D-6 · `board-move` is registered as an unconditional bundle

I added `board-move` to `scripts/expected-check-counts.json` with `requires: null`, so the coverage gate
expects it on every host. BD1–BD4 drive a deal through the entity and read `DealStageEvent`; they touch
no sibling app directly.

**But saving a deal now provisions its embedded order**, which does need orders. On a host without
orders the save may refuse and all four would fail for a reason none of them are about.

**Interim choice:** `requires: null`, because it is true of what the checks themselves read, and it was
correct on the host I verified against.

**What is needed:** a decision on whether every bundle that saves a deal now implicitly requires orders.
If so, `board-move` should be `requires: "orders"` — and so should `save-deal`.
---

## D-7 · The contracts seam has nowhere to run, on any database here

**Raised by:** rewriting `LiveContractsSeam` onto the v6 entity path.

Measured, not assumed. Both local databases:

| | `__mj_BizAppsContracts` tables | `MJ_BizApps_Contracts%` entities |
|---|---|---|
| MJ_V6_Host | 0 | 0 |
| MJ_V6_Tasks2 | 0 | 0 |

So every call to `CreateContractFromDeal` returns *"bizapps-contracts is not installed in this
deployment"* and stops at the guard. The rewrite is typechecked and vocabulary-clean, and **not one
line of its body has ever executed.**

This matters more than it sounds, because it is the second half of the same story: the seam's previous
version dispatched `Contracts.SaveContract`, an operation deleted in the 2026-08-18 rebuild, and got
back *"not registered in this process"* every time. Two different failures, one indistinguishable
symptom — the contract route never runs — which is why it kept being read as a stack-configuration
problem. The dispatch bug is now fixed. The *environment* half is not.

**Interim choice:** the seam refuses honestly and the close records an unexecuted plan with a reason,
which is the same shape every other unroutable target uses.

**What is needed:** contracts installed in a database somebody can point a harness at. Until then the
only assurance available is that the code matches the schema on `origin/next` (`d2f64e3`), which is
what this rewrite is. Note the local contracts checkout sits on `local/pnpm-v6-conversion` and was
deliberately not disturbed — installing it is a separate, deliberate act.

---

## D-8 · The task-type metadata cannot be pushed until tasks migrates

**Raised by:** moving Order Review and Contract Processing into `metadata/task-types/`.

The rows carry `Code`, which bizapps-tasks PR #42 added on 2026-08-20. Neither local database has that
migration applied, and `mj sync push` refuses the whole directory:

```
1. Field "Code" does not exist on entity "MJ_BizApps_Tasks: Task Types"
2. Field "Code" does not exist on entity "MJ_BizApps_Tasks: Task Types"
✗ Validation failed with 2 error(s)
```

It fails at VALIDATION, before writing anything, so there is no partial state to clean up — the good
outcome, and worth recording because it means the dependency is explicit rather than silent.

**Interim choice:** ship the rows with `Code`. Writing them without it would produce metadata that
pushes today and is wrong tomorrow, and `TaskType.Code` is NOT NULL, so a row seeded without one
cannot exist on a migrated database anyway.

**What is needed:** the PR #42 migration applied wherever these rows are wanted — which is an ordering
constraint on deployment, not a code change. `CloseWonTaskService` already tolerates the older shape at
runtime by matching on `Name`; it is only the PUSH that is blocked.

---

## D-9 · `ContractType` has no renewal-default columns, and nothing applies defaults

Sales' own column descriptions say the standards live in contracts: *"the standard annual increase,
whose default (5%) lives on the contracts ContractType"* and *"the standard cancellation-notice period
(default 90 days, owned by the contracts ContractType)"*. As of `origin/next` @ `d2f64e3` they do not.
`ContractType` carries Name, Description, RequiresExecutedDocument, ParentStatusRequirement and Status
— nothing else — and `applyContractTypeDefaults()` went with the v1 rebuild.

This is why sales' columns are named `…Override`: NULL means *"use the standard"*, which is a different
fact from *"we negotiated a number that happens to equal today's standard"*. Only the NULL survives a
later change to policy.

**Interim choice:** the seam passes an override through when the deal states one and populates nothing
when it does not. A null therefore reaches contracts as a null, which is the honest handoff — and it
means the defaults, when they exist, land in one place rather than being pre-empted by a value sales
invented.

**What is needed:** the columns on `ContractType`, and something that applies them. Until then a
contract auto-created at Closed Won has NULL renewal terms unless the deal negotiated them explicitly,
and nothing anywhere fills that in.

---

## D-10 · `ContractTemplate` has no `Status`, so the current template cannot be chosen

`ContractTemplate` carries Name, VersionLabel, `IntroducedDate`, SourceURL and Description. There is no
way to ask which one is current.

`IntroducedDate` is deliberately NOT used. Picking the newest by date is exactly the date-guessing the
`Status` column Andrew asked for exists to eliminate, and it would silently attach next year's paper to
this year's deal the day somebody loads a draft template.

There is a stronger reason to leave this alone, and it is contracts' own: `ContractTemplateID` is
*"nullable because a contract created automatically at Closed Won has none until finance reads the
PDF"*. That describes this call site exactly. A template arrives when a human establishes which one was
signed — which is, not coincidentally, one of the steps the Contract Processing task exists to carry.

**Interim choice:** the seam honours a supplied `ContractTemplateID` and never selects one. Nothing in
sales supplies one today.

**What is needed:** `ContractTemplate.Status`, if template selection is ever supposed to be automatic.
If it is not — and contracts' column note suggests it is not — then this is closed rather than pending,
and the note should say so.

---

## D-11 · A renewal has no shape to take on the v2 schema

`Contracts.RenewTerm` was deleted with `SaveContract`, and it did not simply move: `ContractTerm` was
dropped as a table. "Add a term to an existing contract" no longer describes anything that exists, so
`Deal.RenewsContractID` currently routes to a door with nothing behind it.

Two shapes could express a renewal on the v2 header, and **they are not equivalent**:

1. a NEW contract carrying `ParentContractID` — both agreements stay in the lineage;
2. the existing contract stamped `SupersededByContractID` — one retires the other.

Which is right decides what a renewal *is* in reporting, and it is contracts' modelling call, not
sales'. Guessing would produce contract records that look correct and mean the wrong thing.

**Interim choice:** `RenewContractTerm` returns an unexecuted plan naming both candidates, so a renewal
close reports honestly instead of appearing to succeed.

**What is needed:** a ruling from Marcelo or Andrew on which shape a renewal takes. One sentence
unblocks the seam.

---

## D-12 · `ContractType` has no `Code`, so the type lookup matches on `Name`

Sales' policy field is `CloseWonPolicy.ContractTypeCode`, and resolving a CODE is the right shape —
sales does not know contracts' vocabulary and must not bake its UUIDs. But `ContractType` is identified
only by `Name` (unique) and a fixed seeded UUID. **The previous seam filtered on `Code`, a column that
does not exist**, so that lookup could only ever fail — one more reason this path never ran.

Contracts' own seed comment is pointed about the underlying hazard: *"Neither is ever branched on by
NAME — that was the defect this column replaced."* That is about branching on a name, which nothing
here does; the string arrives from configuration, is looked up, and yields an ID. But it is the same
instinct, and the same fix applies.

**Interim choice:** the seam probes metadata for `Code`, uses it when present, matches on `Name`
otherwise, and says in its returned message which it used — so the answer is never ambiguous.

**What is needed:** `ContractType.Code`, exactly as bizapps-tasks just added to `TaskType` and for the
same reason. It is a one-column migration on their side and deletes a branch on ours.

---

## D-13 · Should the review/correct/advance steps live in `TaskTypeStatus` rather than prose?

**Raised by:** PR #42 adding `TaskTypeStatus` — a per-type lifecycle with `Code`, `Sequence`,
`IsDefault`, `IsTerminal`, `MacroStatus` (Open/InProgress/Blocked/Completed/Cancelled),
`OnEnterActionID`/`OnExitActionID` — plus `Task.TaskTypeStatusID`. This reopens a decision that was
deliberately deferred when there was nowhere better to put the steps.

**The case for moving them is strong, and it is this app's own thesis.** Steps written into a
`Description` are domain knowledge trapped in text: nobody can filter on them, nothing can act on them,
and they drift from what people actually do with no way to notice. That is precisely what the ten type
tables exist to prevent. Statuses would make *"which order reviews are stuck being corrected"* a query
instead of a conversation, and `OnEnterActionID` would let **advance** fire the order confirm as a hook
rather than relying on somebody remembering that advancing is what books the journal entries.

**But the two tasks are not the same shape, and that is the finding.**

- **Contract Processing genuinely is a lifecycle.** Attach the executed document → confirm the
  agreement version → record the dates → validate whether the template was modified → move the contract
  to active. Five distinct states, strictly ordered, each observably done or not. `Sequence` and
  `IsTerminal` fit it exactly.
- **Order Review is not.** Review → correct → advance is one action with a loop in the middle, not
  three states: a reviewer may correct nothing, or correct five times. Modelling a loop as a sequence
  makes the data lie about how the work happens, and `MacroStatus` forces a second guess on top —
  is "being corrected" `InProgress` or `Blocked`? `Blocked` implies waiting on someone else, which is
  sometimes true and sometimes not.

**Interim choice:** left as prose in both descriptions, and the metadata file says why. The asymmetry
is the reason to wait rather than split the difference now: a wrong paragraph is edited, a wrong
lifecycle is migrated, because live tasks will be carrying `TaskTypeStatusID` values by then.

**Recommendation, if a decision is wanted:** seed statuses for **Contract Processing only**, once
finance confirms those five steps are the real ones, and leave Order Review with a status set of its
own shape — plausibly just `Reviewing` / `Advanced` with correction as an activity rather than a state.
Do not derive one from the other for symmetry.

**What is needed:** finance to confirm the Contract Processing steps, and a ruling on whether sales
seeding a second tasks child table (`TaskTypeStatus`, after `TaskType`) is the intended reading of
Amith's "the metadata rows will be created by the sales open app", or one table further than he meant.

---

## D-14 · Sales and contracts disagree on the domain of the annual increase

**Raised by:** review of the pass-through in `LiveContractsSeam.annualIncrease()`. The behaviour is
correct; the reason recorded for it was not, and the real reason exposes a gap neither app owns.

| | column | CHECK | type |
|---|---|---|---|
| sales | `Deal.AnnualIncreasePctOverride` | `>= 0 AND <= 100` | `DECIMAL(5,2)` |
| contracts | `Contract.AnnualIncreasePercent` | `>= 0` — **no upper bound** | `DECIMAL(7,4)` |

Both call it a percent, and `5` means five per cent on both sides today, so the handoff is right and
nothing needs converting. But the wider column accepts values sales would have refused, and **neither
side states the unit as a rule rather than as a habit**. A future writer — an importer, an integration,
a second app — can put `0.05` in the contracts column meaning five per cent and no constraint will
object.

**This is the same shape as the discount-unit trap** already recorded in `docs/DECISIONS.md`, where
0–100 became 0–1 across the sales→orders boundary: *"the one that would have become a silent
hundred-fold bug"*. That one was caught because orders' CHECK rejects anything above 1, so a raw
percentage fails loudly. Here there is no equivalent guard — contracts' bound is open at the top, so
the same mistake lands silently and stays.

**Interim choice:** pass through unconverted, and say so in the code. The pass-through is not justified
by the domains matching — it is justified by the OVERRIDE semantics: sales' description says NULL means
*"use the standard"*, whose default lives on contracts' `ContractType`, and that copying the default in
at write time would freeze this year's terms into next year's renewals. A stated number travels; a null
stays a null. Adding a conversion on suspicion would be precisely the computation this app must not
perform, and would break the handoff that currently works.

**What is needed, from Marcelo:** an upper bound on `CK_Contract_AnnualIncrease` matching sales' 0–100,
or an explicit statement that contracts stores a fraction — in which case sales must convert and this
becomes a real defect rather than a latent one. One line either way. Related to D-9: the same column is
where the missing `ContractType` default would land.

### Addendum to D-9 — the workspace constants become reads

`packages/Angular/src/lib/workspace/deal-workspace.types.ts` carries two placeholders:

```ts
export const STANDARD_ANNUAL_INCREASE_PCT = 5;
export const STANDARD_CANCELLATION_NOTICE_DAYS = 90;
```

They are shown as **placeholder text only** and never written into a draft, which is what makes the
override/null distinction survive to the database — the file's own comment says so and it is correct.
But they are hardcoded copies of values that are supposed to live on contracts' `ContractType`, and
`ContractType` has no such columns (D-9). So today the deal workspace tells an AD what they are
departing from using a number sales invented.

**When Marcelo adds the renewal-default columns, both constants become reads** — the workspace resolves
them from the contract type rather than declaring them — and `LiveContractsSeam.setNegotiatedTerms()`
picks the defaults up on the same change. Until then a policy change in contracts would leave these two
numbers stale, and nothing would notice: the form would display last year's standard while the database
held this year's.

Noted here rather than fixed because there is nothing to read from yet, and because a placeholder that
is never persisted is a display bug at worst — the deal itself stays honest.

---
---

# D-8 — RESOLVED, and one thing about MJ_V6_Host that outlives it

## The push exclusion is gone

`metadata/task-types/` declared `TaskType.Code` against a host that lacked the column, so
`mj sync push --dir metadata` failed validation and had to be run with `--exclude task-types`.

**bizapps-tasks PR #42 has now been applied to MJ_V6_Host and the exclusion is unnecessary.** Verified by
running the full push with no exclusion: 15 of 15 directories, `task-types` processed as *2 records, no
changes*, 0 errors.

*No changes* rather than *2 updated* is worth noticing — the migration's own fallback
(`UPDATE TaskType SET Code = UPPER(REPLACE(Name,' ','_')) WHERE Code IS NULL`) derived `ORDER_REVIEW` and
`CONTRACT_PROCESSING` for the two sales-owned rows, which is exactly what this repo declares. The two
conventions agreed without being coordinated, so the push had nothing to do.

### The instruction that still needs editing, and why not by me

`docs/INTEGRATION-LOG.md` lines 98–101 in the **shared** worktree still says to push with
`--exclude task-types`. That file was added after this branch's point and lives in another session's
working tree, which is off limits here — so the edit is named rather than made. It should become:

> * **`metadata/task-types/` pushes cleanly.** It declares `TaskType.Code`, which bizapps-tasks PR #42
>   added; that migration is applied to MJ_V6_Host, so `mj sync push --dir metadata` needs no
>   `--exclude`. `CloseWonTaskService` resolves task types by `Code` on this host — verified by WT11,
>   which asserts the probe follows what `EntityField` metadata offers. The `Name` fallback remains for
>   hosts that predate the migration and is exercised on MJ_V6_Tasks2.

---

## D-31 · MJ_V6_Host's tasks schema is managed by MJ core, and PR #42 was applied out-of-band

**Found while applying it, and it matters more than the migration itself.**

The Flyway history on MJ_V6_Host records four tasks migrations and **all four are MJ core's**, under
`v6/V2026…__v6.1.x__…` names. None of bizapps-tasks' own migrations — not even its baseline
`B202604011500__v1.0.x_Schema_and_Tables.sql` — has ever been applied there.

So `mj migrate` from bizapps-tasks is **not** the tool for this host: it would try to run that baseline
over tables that already exist. The PR #42 script was therefore applied directly, with its two
placeholders substituted (`${flyway:defaultSchema}` → `__mj_BizAppsTasks`, `${mjSchema}` → `__mj`), under
`sqlcmd -b` so it would stop on the first error. It did not stop; every statement succeeded.

**No Flyway history row was fabricated for it,** deliberately. Inventing one under bizapps-tasks'
versioning would claim a history this host does not have, and inventing one under MJ core's would claim
MJ shipped something it has not. The honest state is that the schema change is present and untracked.

**The consequence, which somebody will meet:** the migration is **not idempotent** — its first statement
is a bare `ALTER TABLE … ADD Code` with no existence guard. If MJ core later ships an equivalent
migration, it will fail on this host because the column is already there. That is a five-minute fix when
it happens (mark it applied, or guard the ALTER) but it is invisible until it happens, which is why it is
written down here.

A rebuild from zero is unaffected: whichever source ships the tasks schema will bring `Code` with it.

---

## D-32 · What PR #42 actually did, for the record

Read before applying, and it does more than add a column. Nothing was unexpected, and two things are
worth naming.

**Structural:**

| Change | Detail |
|---|---|
| `TaskType.Code` | `NVARCHAR(50)`, backfilled, then set `NOT NULL` with `UQ_TaskType_Code` |
| `TaskType` action hooks | `OnCreateActionID`, `OnStatusChangeActionID` |
| `TaskTypeStatus` | new table + entity (19 `EntityField` rows), per-type lifecycle |
| `Task.TaskTypeStatusID` | nullable FK to the new table |
| Generated half | 34 `DROP` + recreate of tasks' own views, sprocs, functions and triggers |

**The two worth naming:**

1. **It adds cross-schema foreign keys into MJ core.** `FK_TaskType_OnCreateAction` and
   `FK_TaskType_OnStatusChangeAction` both reference `__mj.Action(ID)`. That is the intended "workflow
   action hooks" feature, but it is a new structural dependency from the tasks schema onto MJ core, and it
   is the only thing this migration does outside its own schema besides metadata registration.

2. **The generated half drops and recreates 34 objects.** That is the same class of statement that took
   out contracts' views and procedures, so it was checked rather than assumed: **all 34 DROPs are
   `${flyway:defaultSchema}`-qualified**, no statement names a hardcoded schema, and every `DELETE FROM`
   is inside a generated `spDelete…` body rather than at top level. Only two schemas are referenced in the
   whole 5,257-line script — tasks' own and `__mj` — and the only entity registered is
   `MJ_BizApps_Tasks: Task Type Status`. Nothing reaches another app.

**Pre-flight checks run before applying,** because `UQ_TaskType_Code` is UNIQUE and the fallback derives
codes from names: no collisions among the seven rows, none over 50 characters, and all five hardcoded
backfill IDs matched real rows on this host — which is what gives `Follow-up` the correct `FOLLOW_UP`
rather than the hyphenated `FOLLOW-UP` the fallback would have produced.

A `COPY_ONLY` full backup was taken first and verified with `RESTORE VERIFYONLY … WITH CHECKSUM`:
`MJ_V6_Host_preTasksPR42_20260821T005446Z.bak`. `COPY_ONLY` because the database is in FULL recovery and
two other sessions are working against it — a normal full backup would have reset their differential base.
