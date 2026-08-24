# Mutation evidence — which integration checks have been proven able to FAIL, and which have not

## ⚠️ EVERY `MISS` IN THIS FILE IS SUSPECT UNTIL RE-RUN (2026-08-24)

A `MISS` is the strongest claim this ledger makes: a mutation broke the code a check names, and the
check stayed green — so the check may be vacuous. **Some of them were not measurements at all.**

`M-WT2R` was reported `MISS failed=-` at 125 passed / 0 failed. The identical mutation applied by
hand, verified present in `dist/`, gave **119 passed / 6 failed** — WT1, WT2, WT3, WT9, WT10, CD23 —
which is also the exact six-check signature seen earlier when that same mutation was stranded in
`dist/`. Two independent observations. The driver had run the mutant against **unmutated compiled
code**: the suite loads `dist/`, the mutation is applied to `src/`, and nothing asserted the edit
survived the build in between.

WT2 would have been filed as unproven on the strength of that.

**A false MISS is worse than a skip.** A skip announces itself; a MISS looks like a finding.

### What is affected, and what is not

| | |
|---|---|
| `OK` results | **Unaffected.** A mutant that felled its declared target demonstrably reached the running code — the kill is the proof. |
| `MISS` results | **Suspect.** Cannot be distinguished from "the build did not carry it" without a re-run. |
| `SKIPPED` results | **Unaffected.** An anchor that did not match never ran, and says so. |

**Named misses now carrying this caveat:** `M-SD20` (round: bucket-b analysis), `M-AP2` (round 6),
`M-AC4` (round 7), and `M-WT2R`/`M-WT6T` from the WT batch. Each remains recorded — the reasoning in
those sections may still be right — but **none may be quoted as evidence of a vacuous check until
re-run under the guard.**

`M-SD20` deserves a specific note: its section argues the integration suite is server-side and
structurally cannot exercise a client-path guard, which is an argument from the code rather than from
the run. That reasoning stands on its own. The *measurement* it cites does not, yet.

### The guard that closes it

`mutate-checks.mjs` now fingerprints the compiled file before mutating and again after building, and
refuses the run as `dist-unchanged` if they match — so this class of false MISS is now a loud failure
rather than a result. Proven with a type-only mutation that compiles to identical JS.

---

## EVERY FIGURE IN THIS FILE IS STAMPED WITH THE COMMIT IT DESCRIBES

A number here describes ONE tree. The tree has moved out from under a measurement three separate times
now, and each time the figure survived the move and went on being quoted — so an unstamped number in
this file should be treated as unsourced rather than merely old.

The rule is therefore: **no figure without the SHA it was measured against.** A round that cannot name
its commit is not evidence.

| | |
|---|---|
| Latest full campaign | **`6d3add4`** — 2026-08-21 22:00 → 2026-08-22 00:06 |
| Tree these counts describe | **`b9e73d4`** — the consolidated line |
| Checks registered across 9 bundles | **124** at `33dd263` (123 at `b9e73d4`, 121 at `6d3add4`) |
| Mutants defined | **82** at `33dd263` (80 at `b9e73d4`, 75 at `6d3add4`) |

### The headline, restated against 123

| | at `6d3add4` | at `b9e73d4` |
|---|---|---|
| Checks in the suite | 121 | **123** |
| Declared kills — mutation aimed at it, it fell | 70 | 70 *(carried, not re-measured)* |
| Collateral credited under the path rule | 11 | 11 *(carried)* |
| Newly demonstrated by round 9 (measured at `b9e73d4`) | — | **+3** — AC22, SD23, SD28 |
| Newly demonstrated by round 10 (measured at `9724489`) | — | **+4** — WT1, WT4, WT15, WT16 |
| Newly demonstrated by round 11 (measured at `33dd263`) | — | **+1** — CD23 |
| **Demonstrated able to fail** | **81 of 121** | **89 of 124** |
| Not demonstrated | 40 | **35** |

> ### The denominator moved under this document between writing and landing
>
> This ledger was cut from `9724489` and measured 123 checks. It merged onto a line that had already
> taken `feature/route-refusal-warning`, which adds **`CD23`** — so the tree it now lives on has **124**,
> and the ledger arrived one check stale through nobody's mistake.
>
> `CD23` is demonstrated, and by the stricter standard: **two** mutants, one per half of its claim, both
> measured on this line. `M-RI1` removes the warning from `Issues`; `M-RI2` makes a refused route fail the
> close, which is the regression that actually matters — somebody reading a warning-severity Issue as a
> defect and "fixing" it by failing a won deal. `M-RI1` isolated `CD23`; `M-RI2` felled `CD23` and `CD7`,
> the latter as collateral because it also asserts success on a close.
>
> Recorded here rather than left for the next reader to trip over, because a stamped figure that is
> *correct for its own SHA* still misleads anyone reading it on a later one. That is the same failure the
> stamping rule exists to prevent, one level up: the stamp tells you when a number was true, and it is
> still worth saying when it stopped being true.

**`84` IS A CROSS-TREE UNION, NOT A MEASUREMENT.** 81 of it was measured at `6d3add4` and is carried
forward unverified; 3 were measured at `b9e73d4` in round 9. No single run has ever produced 84. It is
the best current estimate and is written as such — collapsing it into one unqualified number is exactly
the drift the stamping rule exists to stop.

**The two extra checks are CARRIED, not re-measured.** `close-won-tasks` went 14 → 16 between the two
trees. Nothing in this file claims they were tested.

**The two extra checks are not proven and are not assumed to be.** `close-won-tasks` went 14 → 16
between the two trees. Carrying 81 forward across a tree change is exactly the drift this file now
stamps against, so it is written as *carried, not re-measured* — the campaign that would settle it is
deliberately deferred to the tree we ship, once.

### Why the campaign figure is 81 and not 88

The driver's summary reported 70 declared kills and 18 further checks that fell only ever as collateral.
Adding those gives 88. **Seven of the 18 do not survive the path rule and are not counted:**

`SD1`, `SD6`, `SD7`, `SD13`, `SD14`, `SD19`, `SD20` all fell under `M-PP1`/`M-PP3`, which mutate
`ProductFilterFor`. That function has exactly two consumers — the Angular product picker, and the
checks' own setup helper `sellableProducts()` at `save-deal.checks.ts:248`, which asserts
*"setup: the host needs at least N sellable product(s)"*. Those checks died IN SETUP, before reaching
the behaviour they name. Crediting them would claim `SD1` can detect a regression in
one-save-writes-the-graph, which the campaign did not show.

`SD17` survives the same cull because `M-SD11` (SequenceService) also felled it, and `SD17` is about
deal numbering — genuinely on its path.

The eleven credited: `BD1`, `BD3`, `BD4`, `BD6`, `CD3`, `CD12`, `CD17`, `CD19`, `SD17`, `WT10`, `WT11`.

### The driver's own summary did NOT disagree

Worth recording because it nearly went in as a correction. An independent tally gave 33 collateral
against the driver's 18. They count different things: the driver counts checks that fell but were
**never a declared kill anywhere**; the independent pass counted **per-mutant** collateral, which
includes checks another mutant declares. Under its own definition the driver's 18 is exact, and the two
agree on 68 ran, 70 declared kills, 44 mutants isolating exactly one check. **No correction was needed
— the path rule is what moved the number, not an arithmetic error.**

### Per bundle, at `6d3add4`

| Bundle | Checks | Proven | Not proven |
|---|---|---|---|
| `save-deal` | 31 | 22 | 9 |
| `close-deal` | 22 | 19 | 3 |
| `product-picker` | 4 | 4 | — |
| `close-won-order` | 5 | 3 | 2 |
| `close-won-contract` | 4 | 3 | 1 |
| `board-move` | 6 | 5 | 1 (BD3) |
| `close-won-tasks` | 14 | 3 | **11** |
| `activities` | 22 | 12 | 10 |
| `forecast` | 13 | 6 | 7 |

*(This table describes `6d3add4`. `close-won-tasks` is 16 at `b9e73d4`; the split has not been
re-measured.)*


---


---

## The two bundles that had NO mutant at all — CLOSED 2026-08-21, and the failure mode worth keeping

`activities` (22) and `forecast` (13) — **35 checks, 30% of the suite — had never been shown able to
fail.** 15 mutants now cover them (`M-AC1`–`M-AC10`, `M-FS1`–`M-FS5`); the run is round 7 below. 18 of the
35 are proven, 17 are not, and the remaining gap is itemised there rather than summarised away.

**The rest of this section is kept as written, because how the wrong claim got in matters more than the
claim.**

This needs saying precisely, because the merged history looks like it was fixed. Commit `1352b2c` on
`feature/forecast-query-source` is titled *"mutants for activities and forecast, and four checks that
could not fail"*. Its diff touches four files:

```
packages/.../activities/ActivityIngestService.ts     |  30 +++-
packages/IntegrationTests/src/checks/activities.checks.ts | 153 +++++++++++
packages/IntegrationTests/src/checks/forecast.checks.ts    |  44 +++-
scripts/expected-check-counts.json                        |   2 +-
```

**`test-harnesses/mutate-checks.mjs` is not among them.** The commit added CHECKS to both bundles — four
of them, AC19–AC22 — and repaired four that could not fail. It added no mutant. There is no `M-AC*` or
`M-FS*` entry in the driver on any branch in this merge, and no mutant's `expect` list names an `AC` or
`FS` id. Verified by listing the driver rather than by reading the title.

That is not a criticism of the work — the checks it added are real and the four repairs are exactly the
kind this file exists to prompt. It is a warning about *this document's* sourcing: a title is not evidence,
and the previous two versions of this file both inherited the claim.

`close-won-tasks` is the third notable gap: 14 checks, 3 proven (WT11, WT13, WT14), 11 unproven.

---

## What "proven" means here, and the one place it is softer than it looks

**Method.** For each mutation: change the PRODUCT code (never the check), rebuild, run the whole suite,
record which check ids failed, restore the file from a copy-aside, **rebuild again**. The whole suite runs
each time rather than one bundle, so a mutation that breaks something unintended shows up instead of
hiding.

The final rebuild is new and was added after it cost real time — see Round 5.

**Declared versus measured.** 57 of the 59 are the mutants' own `expect` lists: each was run at least once
and the named check fell. The other 2 (BD1, BD4) are collateral kills recorded from an actual `M-ST1` run.
One mutant — `M-AP2` — is a standing MISS and is counted in neither figure; see Round 6.

Where this file says "proven", it means a run was observed — not that the campaign was re-run end to end
against the merged tree. **It has not been.** The six Round 6 mutants ran against the merged code; the
other 54 predate the merge. Re-running all 60 is roughly two hours and is the obvious next verification;
until then, treat the per-bundle table as a claim about the code each mutation was run against.

---

## Round 9 (2026-08-23) — `b9e73d4` — AC22 made reachable, and seven drifted anchors repaired

**Every figure in this section was measured against `b9e73d4`.** Branch `feature/mutant-repair`.

### AC22 was never vacuous — it was UNREACHABLE

The `6d3add4` campaign felled AC22 with nothing, which made it read as the strongest vacuous-pass
candidate in the suite. It is the opposite. AC22 carries six assertions and pins the distinction the
branch exists for: `Failed: 2`, not `Irrelevant: 2`, because a failed lookup means the items were never
JUDGED, which is a different fact from being judged irrelevant.

No mutation reached it because **AC22 injects its own collaborator** — it subclasses `RelevanceFilter`
inline and overrides `Apply` outright, so every mutation of the real filter is invisible to it. Its own
docblock says this is deliberate: it is the one check that injects rather than drives, to reach a branch
no arrangement of real data can produce.

`M-AC11` therefore aims at the CONSUMER of that signal instead —
`ActivityIngestService.RunSync`'s `LookupFailed` branch, where `result.Failed += allowed.length` is the
line that holds the watermark (`Success` is `Failed === 0`, and the watermark only moves on a successful
run). Booking the batch as Irrelevant makes a transient database blip look exactly like a mailbox of
personal mail — the original defect, restored in one token.

| Mutant | Fells | Result |
|---|---|---|
| `M-AC11` | AC22 | **122 passed, 1 failed** — isolates it exactly |

**The irony is the point:** AC22 exists because a mutation found this gap, and it had since become
unreachable by the same tool. A check that cannot be falsified is indistinguishable from one that
asserts nothing, however good it is.

### The seven drifted anchors — all repaired, none retired

Every one had MOVED rather than vanished, so none needed retiring.

| Mutant | Why it drifted | Re-anchored to |
|---|---|---|
| `M-CD4` | the stamping moved file entirely, `deal.Amount` → `prior.Amount` | `DealEntityServer.ts:588` |
| `M-OS1` | the line gained a `_lockedAtSave` guard | `stageOrder = this._lockedAtSave ? null : …` |
| `M-AM3` | trailing comment reworded | `if (total === null \|\| !Number.isFinite(total)) {` |
| `M-WT1` | its two anchor lines are no longer adjacent | `if (target.IsWon) {` + `ReadCloseWonTaskConfig` |
| `M-BD2` | `probabilityIsTheirs` replaced by `callerSuppliedValue` | the `!this.IsSaved` create branch |
| `M-BD3` | same refactor | `if (!this.callerSuppliedValue('Probability', …))` |
| `M-ST7` | anchor line now appears twice (close + reopen) | disambiguated by `const now = new Date();` |

`M-BD2`/`M-BD3` looked like the unrecoverable pair — `probabilityIsTheirs` is gone from the repo
entirely — but the concept moved into `callerSuppliedValue`, which still draws the same
create-versus-update distinction BD2 caught the first time.

### Per-mutant results, `failed=` read rather than summed

| Mutant | Target | `failed=` | Collateral on the failing check's path? |
|---|---|---|---|
| `M-CD4` | CD4 | BD2, CD20, CD4 | **Yes.** BD2 asserts *the event stamps the amount … on the way out*; CD20 asserts *whose number the amount was*. The mutation nulls `event.AmountAtTransition` — squarely both. |
| `M-OS1` | CO3, CO5 | CO3, CO5, SD25 | **Yes.** SD25 is *a provisioned order takes the status its STAGE declares*; the mutation removes the stage-order plan outright. |
| `M-AM3` | SD23 | SD23, SD28 | **Yes.** SD28 is *an order with NO LINES is not "priced at zero"*; the mutation deletes the no-usable-total guard that protects exactly that. |
| `M-WT1` | WT11 | WT11 | Clean single kill. |
| `M-BD2` | BD2 | BD2, SD31, SD33 | **Yes.** `callerSuppliedValue` gates the SD31 OwnerEmployeeID refusal (`:1590`) and the SD33 status default (`:1008`). Breaking its create branch reaches both by construction. |
| `M-BD3` | BD6 | BD2, BD6 | **Yes.** Same probability-defaults code BD2 is about. |
| `M-ST7` | CD17 | CD4, CD5, CD13, CD14, CD17, CD18, CD20 | **Yes, and broad by design** — the mutation stops the close setting the status, so every check asserting a close outcome falls. Its note said so before the run. |

**No setup-only kills in this batch.** Unlike `M-PP1`/`M-PP3`, whose seven save-deal casualties died
inside `sellableProducts()` in their own fixture, every collateral above executes the mutated line as
part of the behaviour the check names.

### What actually changed status — 3 checks, not 18

Read the `failed=` column rather than summing it, and most of this batch is REDUNDANT coverage: 15 of
the 18 checks these mutants fell were already credited at `6d3add4` by other mutants.

- **Newly demonstrated: `AC22` (M-AC11), `SD23` (M-AM3), `SD28` (M-AM3 collateral).**
- **`CD4` was NOT restored from unproven.** An earlier report in this session said CD4 was unproven
  while `M-CD4` was skipping. That was wrong: `M-ST1` declares CD4 and felled it at `6d3add4`
  (`expect=CD4,CD15,BD2`). Re-anchoring `M-CD4` restores the TARGETED mutation for CD4 rather than
  leaving it to `M-ST1`'s broad one — better evidence, not a status change.

The re-anchoring is still worth having: a targeted mutation is stronger evidence than a broad one, and a
silently-skipping mutant proves nothing at all. But the headline moves by 3, not by 18.

---

## The 35 not demonstrated, sorted — `9724489`

Counting an unreachable check as "not demonstrated" understates the suite, so the number is split. The
old bucket (a) conflated two states that mean OPPOSITE things and is now split in two.

| Bucket | Count | Checks |
|---|---|---|
| **(a1)** a mutant RAN and did not kill its declared target | **0** | — |
| **(a2)** a mutant declares it but has never been RUN | **0** | — |
| **(b)** no mutant was ever written for it | **35** | AC1, AC2, AC4, AC5, AC9, AC10, AC12, AC15, AC16, AC17, CO2, CO4, CT1, FS1, FS2, FS4, FS5, FS9, FS10, FS13, SD1, SD6, SD7, SD13, SD14, SD19, SD20, WT2, WT3, WT5, WT6, WT7, WT8, WT9, WT12 |
| **(c)** unfellable by source mutation — injects its own collaborator | **0** | *(AC22 was the only member in all 123; round 9 emptied it)* |

**WHY (a1) AND (a2) MUST NOT BE ONE BUCKET.** They are the two most different states in this file:

- **(a1) is the alarming case.** A mutant ran, broke the code its check names, and the check stayed
  green. That is either a mis-aimed mutation or a vacuous check — and finding vacuous checks is the
  entire reason this harness exists.
- **(a2) is merely unmeasured.** Nothing is known either way. It is a gap in the ledger, not a defect.

An earlier version of this table listed WT1, WT4, WT15 and WT16 as *"a mutant declares it, it did not
fall"* — bucket (a1) language for what were all (a2) cases. That classification was derived from the
`6d3add4` campaign, where `M-TN1`, `M-TL1`, `M-WT1O` and `M-WT4L` **did not yet exist**. Reading a
missing mutant as a failed one buries the exact signal the harness is built to surface.

### Round 10 (2026-08-23) — `9724489` — all four ran, all four fell

Measured on `feature/bucket-b` at `9724489`. **A single-mutant run is evidence on the same terms as a
campaign run** — the rule is provenance, not which harness produced it, so these carry their SHA and
count.

| Mutant | Target | `failed=` | Collateral on the failing check's path? |
|---|---|---|---|
| `M-TN1` | WT15 | WT15 | clean single kill |
| `M-TL1` | WT16 | WT16 | clean single kill |
| `M-WT1O` | WT1 | WT1, WT10, WT13 | **Yes.** The mutation points the review task at the deal instead of the order; WT13 is *"linked to the order the close created"* and WT10 drives the same task creation end to end. |
| `M-WT4L` | WT4 | WT4, WT14 | **Yes.** WT14 is *"the contract-processing task links the CONTRACT, not the deal"* — the mutation strips exactly that link. |

Both `M-TN1` and `M-TL1` reproduce the result another session measured individually, independently.

---

## Bucket (b): the seven save-deal checks, analysed — `9724489`

SD1, SD6, SD7, SD13, SD14, SD19 and SD20 fell during the `6d3add4` campaign under `M-PP1`/`M-PP3` and
were rejected under the path rule: those mutate `ProductFilterFor`, which these checks reach only
through `sellableProducts()` in their own fixture setup, so they died before touching the behaviour they
name. That makes replacing them a DESIGN problem — the mutant has to reach the behaviour the check is
about, not the scaffolding that gets it there.

**The finding is that most of them assert behaviour sales does not own.** None of these checks is
vacuous; each asserts something real and valuable. They are simply not reachable by mutating sales
source, which is a different statement from "weak".

| Check | What it asserts | Reachable by mutating sales? |
|---|---|---|
| `SD6` | *removing an order line is silently DROPPED* — a KI-20 tripwire | **No.** Its own message names the owner: *"orders has fixed `savePendingLines()`"*. The behaviour, and the eventual fix, live in bizapps-orders. Sales has nothing to mutate, and the check asserts the ABSENCE of a fix there. |
| `SD7` | *children are sequenced from collection position, contiguously from 1* | **No.** Sequencing is declared in CodeGen output — `Sequence: { Field: 'DisplayOrder', From: 1 }` in `packages/Entities/src/generated/entity_subclasses.ts` — and executed by the MJ framework. Mutating generated code is both forbidden and pointless, since CodeGen restores it. |
| `SD20` | *reopening a deal brings its order lines back* | **Measured: no.** See below — a mutant was written, run, and MISSED. |
| `SD1`, `SD13`, `SD14`, `SD19` | one-save cascade, omission-is-not-deletion, two-level round trip, orders owns everything but product and quantity | **Analysed, not measured.** Each asserts framework cascade (`SaveEntityGraph`), MJ collection load semantics, or orders' stamping of `UnitPrice`/`CompanyID`. No sales-owned branch was found whose mutation would reach them. Stated as analysis, not as a measured result. |

### The measured one: `M-SD20` was written, run, and MISSED — and that is the finding

`DealEntity.Save()` overrides `super.Save()` to re-hydrate the embedded order when the FK was written but
the peer was never exposed — the DN-17 defect, where adding a line straight after creating a deal wrote
it to a SECOND `OrderHeader` that nothing referenced: invisible to the rep, uncounted by `Deal.Amount`,
an orphan left in orders. Disabling that guard restores the defect exactly.

> ⚠️ **This MISS predates the dist-change guard and has not been re-run.** See the banner at the top:
> a mutation that never reached `dist/` produces exactly this line. The ARGUMENT below — that a
> server-side suite cannot exercise a client-only path — is independent of the run and still stands.
> The measurement is not yet evidence.

**Result: `M-SD20 MISS failed=- expect=SD20` — 123 passed, 0 failed.** The whole suite stayed green with
the guard disabled.

That is not a bad anchor. The guard's own docblock explains it:

> `DealEntityServer` calls this through `super.Save()` and reaches the guard with its peer exposed by
> `provisionEmbeddedOrder()`, so the server path is a no-op **by construction** rather than by luck.

**The integration suite is server-side, so it cannot exercise this guard at all.** The DN-17 fix — a real
defect, found through Angular's dev hooks on a real create — has NO integration coverage, and no mutant
can give it any. Covering it needs a client-path test through the Explorer harness, where a plain
`BaseEntity.Save()` produces the single-node mutation the bug hides behind.

The mutant was REMOVED rather than left in place. A permanently-missing mutant trains readers to skim
past the MISS list, which is where the real findings appear.

---

## Bucket (b), the remaining 28: a named target for each — `8c60610`

The seven save-deal checks were accounted for earlier. These are the other 28: every check with no
mutant and, until now, no analysis. For each, the sales-owned branch a mutant could aim at — or the
plain statement that there isn't one.

**Line numbers below were read from the source, not remembered.** Where only a file and function are
named, that is because the branch is a whole function rather than one line, and it is said that way
rather than dressed up with a number.

### close-won-tasks — 8 checks, 7 targets

`packages/CoreEntitiesServer/src/CloseWonTaskService.ts`

| Check | Target |
|---|---|
| WT2 | `route()` and its caller's `if (!assignmentID)` at `:555` — routing produces an assignment or reports it did not |
| WT3 | `if (await this.policyRaisesContractTask(...))` at `:332` — the branch that decides a contract task is raised at all |
| WT5 | `if (input.ContractID)` at `:354` and `if (contractsAvailable)` at `:355` — the fallback to the deal when no contract exists |
| WT6 | `if (contractTypeID)` at `:339` — the refusal path when the contract task type is missing |
| WT7 | `route()` returning null, reached from `:555` — created but unrouted, and saying so |
| WT8 | `if (!input.OrderID)` at `:299`, and the `input.OrderID && orderReviewTypeID` guard at `:309` |
| WT12 | `ResolveTaskTypeColumn` at `:230` — `…some((f) => f.Name === 'Code') === true ? 'Code' : 'Name'`, and its use at `:433` |
| **WT9** | **No branch.** *"task writes JOIN the transaction of the caller"* asserts that this service opens NO transaction of its own — it uses the `provider` it is handed. There is no line to mutate, because the behaviour is an absence. Giving it one would mean ADDING a transaction boundary, which is writing a defect rather than mutating code. |

### activities — 10 checks, 8 targets

| Check | Target |
|---|---|
| AC1 | `ActivityWriterService.ts:273` — `{ Role: 'Regarding', EntityName: E_DEAL, RecordID: input.DealID }`, the link that is always written |
| AC2 | `ActivityWriterService.resolveTypeByCode()` at `:394`, called from `:162` — resolution by CODE, which is what survives a rename |
| AC4 | `ActivityWriterService.ts:284`–`:287` — the `Participant` links, and the branch that makes an unknown party an identity link instead of a stub `Person` |
| AC5 | `ActivityReader.ts:155` `OrderBy: 'StartedAt DESC'` for newest-first, and the deal-anchor exclusion at `:227` |
| AC9 | `ActivityIngestService.ts:255` — `if (batch.HighWatermark && result.Failed === 0)`, the advance itself |
| AC10 | `DealMatcher`, injected at `ActivityIngestService.ts:97` — the "known contact, no open deal" path is its result being empty |
| AC12 | `ActivityIngestService.ts:607` — the address comparison that lower-cases both sides (D-19) |
| AC16 | `ActivitySyncJob.ts:83` — `let activitySourceFactory: ActivitySourceFactory = …`, the one line a swap changes |
| AC17 | The same `:83` default — that it writes nothing is a property of the default value |
| **AC15** | **No branch.** *"the seeded ScheduledJob points at the seeded Action, hourly, Skip/RunOnce"* asserts METADATA ROWS under `metadata/`, not code. A mutant would have to edit a seed file, which is a different tool than a source mutation. |

### forecast — 6 checks, 5 targets

`packages/CoreEntitiesServer/src/forecast/ForecastSnapshotJob.ts`

| Check | Target |
|---|---|
| FS1 | `:42` — the default factory `() => null`, plus the no-source path that still returns success |
| FS2 | The per-row write loop ending `if (await snapshot.Save())` at `:182` — one snapshot per measure row, amounts and period stored verbatim |
| FS4 | `if (existing.has(key))` at `:149`, and the composition of `key` — the guard is per grain, so the grain must be IN the key |
| FS5 | Wherever `SnapshotJSON` is assigned in the same loop — which source produced the numbers, and whether it was live |
| FS10 | `SetForecastSourceFactory` at `:45`, `forecastSourceFactory = factory` at `:47` |
| FS13 | The same `:42` default — that it is still the empty fixture |
| **FS9** | **No branch.** Like AC15, it asserts seeded metadata: the daily job points at the seeded forecast Action. |

### close-won-order and close-won-contract — 3 checks, 3 targets

| Check | Target |
|---|---|
| CO2 | `CloseDealOperation.ts:830` — `if (routing.length === 0)`, the clean close that routes nothing |
| CO4 | `CloseDealOperation.ts:433`–`:434` — `OrderID` read AFTER the save because provisioning happens inside it; a second order is what breaks if that ordering moves |
| CT1 | `LiveContractsSeam.ts:196` `if (!(await contract.Save()))` and `:204` reading `ContractNumber` — contracts mints the number, sales does not |

### What the 28 add up to

| | Count |
|---|---|
| Have a named sales-owned branch a mutant could aim at | **25** |
| **No branch — the behaviour is an absence or lives in metadata** | **3** — WT9, AC15, FS9 |

**So the real ceiling is lower than 123, and now it is countable.** Adding the earlier seven save-deal
checks, **10 of the 123 cannot be reached by mutating sales source at all**: WT9, AC15, FS9, and the
seven analysed above (SD6 belongs to orders, SD7 to CodeGen output, SD20 to a client-only path, and
SD1/SD13/SD14/SD19 to framework cascade and orders' stamping).

That is not a gap to close with more mutants. It is the honest boundary of what this tool can prove,
and three of those ten — AC15, FS9, and the seeded-job half of the others — would be better served by a
metadata gate than by a mutation.

---

## Round 1–3 (2026-08-20) — the original campaign

*Pre-dates the stamping rule: attributable to the date above, NOT to a commit. Treat its figures as historical.*

26 mutations, extended the same day with `M-OS1`–`M-OS3` for the stage → order-status writer. Against
`MJ_V6_Host` with bizapps-orders and bizapps-accounting linked and bizapps-contracts absent. Three rounds
were needed, and the reason there were three is the point: round 1's misses were findings, not retries.

### What it found

1. **`close-deal.CD4` was asserting nothing.** It read `Assert('AmountAtTransition' in last, …)` — always
   true of a `RunView` row whose `Fields` names the column. Replacing
   `event.AmountAtTransition = deal.Amount` with `= null` left every check green. It was invisible for a
   second reason: a seeded deal carries no amount, so null-versus-null was indistinguishable even to a
   stricter assertion. CD4 now gives the deal real figures and compares the stamped values.
2. **`IsDealFieldEditableWhileLocked()` is not what the server calls.** Mutating it to `return true`
   changed nothing: `DealEntityServer` reads the `DEAL_FIELDS_EDITABLE_WHILE_LOCKED` set directly, so the
   helper is used only by the Angular workspace. Not a defect — but anyone reasoning about the lock from
   the helper is reading the wrong half.
3. **The line checks are sensitive to the CATALOGUE, not just the save.** Widening the product filter
   failed PP1/PP3/PP4 *and* all seven order-line checks: they discover their products through that same
   filter, so a non-sellable product gets selected and orders refuses the line.

---

## Round 4 (2026-08-21) — four writers on one trigger, and MJ's create semantics

*Pre-dates the stamping rule: attributable to the date above, NOT to a commit. Treat its figures as historical.*

Five mutations against `DealEntityServer.ts`, each reverting one decision of the mechanism that replaced
four separate writers on the `PipelineStageID` trigger.

| Mutant | What it reverts | Checks it fells |
|---|---|---|
| `M-ST1` | one writer for the stage log — calls the appender twice | BD1, BD2, BD4, CD4, CD11, CD15, CD16 |
| `M-ST2` | the case-insensitive stage compare | **SD32** |
| `M-ST3` | a declared transition suppressing the stage defaults | **CD16** |
| `M-ST4` | the create guard on the stage log | **SD30** |
| `M-OW2` | `callerSuppliedValue` on the owner stamp, back to `Dirty` | **SD31** |

Four of the five isolate exactly one check. `M-ST1` is broad by nature — doubling every event breaks every
count-based assertion — and that breadth is the finding: **seven checks were counting stage events and not
one could see a duplicated row**, because the only input that makes a close move the stage
(`ClosingStageID`) was never passed by any of them. `CD15` exists to pass it. BD1 and BD4 had been green
and unproven since S3 and fell here, to a mutation aimed elsewhere — which is the argument for running the
whole suite per mutation.

**What this round could not express as a mutation.** The original defect was TWO writers. With one writer
left, "two rows" cannot be reintroduced by a one-line edit; re-adding a writer is a thirty-line insertion.
`M-ST1` reproduces the symptom faithfully by calling the single writer twice, and its note in the driver
says so. It is a proxy, labelled as one, exactly like `M-TK1`.

> **This is the round both predecessor documents numbered "Round 4".** The forecast branch's version
> described a different set — its driver held 36 mutants where this one holds 54, all of its ids being a
> subset of these. Nothing is lost by renumbering: the mutants themselves merged cleanly because one file
> was a superset of the other.

---

## Round 5 (2026-08-21) — the stage declares the status, and the reopen restores the stage

*Pre-dates the stamping rule: attributable to the date above, NOT to a commit. Treat its figures as historical.*

| Mutant | What it reverts | Checks it fells |
|---|---|---|
| `M-ST5` | deriving `DealStatusTypeID` from the stage | **SD33** |
| `M-ST6` | the `callerSuppliedValue` guard on the status | **SD34** |
| `M-ST8` | the `LocksDeal` gate on the derived status | **SD35** |
| `M-RO1` | deriving the reopen's landing stage from the close event | **CD18** |
| `M-RO2` | reads `ToStageID` instead of `FromStageID` | **CD18** |
| `M-ST7` | the close setting the status at all | CD4, CD5, CD13, CD14, **CD17**, CD18 |

### CD17 cannot be felled by a single edit, and that is the finding

`CD17` asserts the closing status beats the status the closing stage declares. **Two independent
mechanisms protect it**, so no one-line mutation of the status writer can break it: a declared transition
suppresses stage defaults entirely, *and* the closing status is assigned before the save so it arrives
dirty. Measured rather than argued — `M-ST3` removes the suppression and **CD17 stays green**. `M-ST7`
therefore stops the close setting a status at all, which proves CD17 is not vacuous at the cost of felling
five sibling checks. CD17 is a regression guard against a future change, not a live single-point defence.

### CD19 has no mutant of its own, deliberately

`CD19` pins the other direction — after a status-only close the stage never moved, so there is nothing to
restore and nothing fires. `M-RO2` **cannot** fell it: on a status-only close `FromStageID === ToStageID`,
so swapping them is invisible there. That is exactly why CD18 catches it and why CD19 alone would be
insufficient. The pair is the assertion, not either half.

### The round that nearly shipped a rule violation

`SD33` broke the rule the app exists to uphold on its first version. The seeded pipelines declare a
LOCKING status on their winning and losing stages, so an ordinary save into one of those stages closed the
deal by side effect: locked, `IsWon` set, no close event, no routing, no contract, no tasks,
`Sales.CloseDeal` never invoked. **A board drag would have booked revenue.** The whole suite stayed green,
because until then nothing about a stage could close a deal and so no check ever moved one into a closing
stage. `SD35` does now.

### And the driver bug it exposed

It was found by an Explorer spec, and finding it took three false starts, because **the driver restored the
source but never rebuilt.** After a mutation session `dist/` still held the last mutant while the source
was clean and `git diff` was empty — so MJAPI served mutated code and a browser spec failed three times on
a defect that had already been fixed, through two API restarts and a wrong hypothesis, until the compiled
output was read. The driver now rebuilds in its `finally` block, alongside the copy-aside restore. A tool
whose job is to break things on purpose must not be able to leave them broken.

---

## Round 7 (2026-08-21) — the activities and forecast mutants, landed and run

*Pre-dates the stamping rule: attributable to the date above, NOT to a commit. Treat its figures as historical.*

**15 mutants, 14 killed, 1 standing miss.** `M-AC1`–`M-AC10` and `M-FS1`–`M-FS5`, named for the check
family they target as `M-CD*`/`M-CT*` are. Every anchor was re-verified against this merged tree rather
than carried across from the by-hand campaign, because the merge moved code under several of them.

| Mutant | What it breaks | Killed |
|---|---|---|
| `M-AC1` | the external-key dedupe read's answer is ignored | AC8, AC13 |
| `M-AC2` | party links land under the sales child, not common's parent | AC3, AC13, AC18, AC22 |
| `M-AC3` | relevance fails OPEN — nothing is irrelevant | AC6, AC7 |
| `M-AC4` | a failed contact-method read reported as a successful one | **nothing — standing miss** |
| `M-AC5` | a cancelled meeting stored as one that happened | AC18 |
| `M-AC6` | the watermark advances past items whose write failed | AC20 |
| `M-AC7` | a sync with failures in it reports success | AC20 |
| `M-AC8` | the fixture stops mirroring each surface's real watermark rule | AC14, AC19 |
| `M-AC9` | the live Graph calendar reports the newest event start as its watermark | AC21 |
| `M-AC10` | the tenant-admin gate on a live mailbox read is removed | AC11 |
| `M-FS1` | a query that could not run reads like a period with no deals | FS8 |
| `M-FS2` | the `ClosedWonAmount` → `ClosedAmount` mapping dropped | FS11, FS12 |
| `M-FS3` | a second run the same day writes a second snapshot | FS3 |
| `M-FS4` | a reversed period reaches the CHECK constraint | FS6 |
| `M-FS5` | the month boundary read in the host's timezone | FS7 |

### `M-AC4` is a standing miss, in the shape `M-AP2` already uses

> ⚠️ **Predates the dist-change guard; not re-run.** Both `M-AC4` and `M-AP2` are MISSes recorded
> before anything asserted the mutation reached the compiled output. Re-run both before quoting
> either as evidence.

It reverts `RelevanceFilter.lookup`'s failure report from `failed: true` to `failed: false`, so a
`ContactMethod` read that blipped is filed as *"nothing was relevant"* — and the watermark advances over a
batch of real mail that can never be fetched again, because `GetMessages` has no date filter to re-fetch
it with (D-17).

Nothing in this repository can kill it, and that is measured rather than assumed. Provoking a real
`RunView` failure against a registered entity means revoking a permission, dropping a view or killing the
connection: none is available inside a rolled-back transaction, and each would take the rest of the suite
with it. `AC22` covers the CONSEQUENCE by INJECTING a filter that reports a failed lookup, which is
exactly why `AC22` cannot fall to this mutant — it never calls the real `lookup`.

So the handling is proven and the reporting is not. Its `expect` names `AC22` deliberately, so the driver
reports MISS on every run and exits 1. **The gap is stated rather than implied by an absence.**

`AC22` *is* nonetheless proven able to fail — collaterally, by `M-AC2`. Worth separating: a check can be
provably falsifiable while the specific guard a mutant aims at remains untested.

### Four cross-bundle failures that are NOT attributed, and how that was decided

Three runs reported failures outside the bundle they mutated: `SD25` (twice), `FS2`, `FS3`, `FS5` and
`WT13`. None is counted as proven, on two independent grounds.

**Causality.** A check is credited only where the mutated symbol is in its path. `M-AC4`'s mutation is
unreachable without a genuine read failure — that is the whole standing-miss argument above — so it cannot
have felled `FS2` or `SD25`. `M-AC3` mutates `RelevanceFilter`, which no forecast or save-deal check
touches. And `M-AC2` mutates `E_PERSON`, consumed only by `ActivityReader`, `ActivityWriterService` and
the activities checks; `close-won-tasks.checks.ts` declares its **own** `E_PEOPLE` literal at line 41, so
`WT13` is out of reach of that edit.

**Reproduction.** The suite was then run **four consecutive times against the clean tree: 121 passed, 0
failed, every time.** None of those checks fails on its own.

What the six failures do correlate with is duration: the three runs that produced them took 170s, 171s and
187s against ~120s for the other twelve. That points at contention on the shared host — `MJ_V6_Host` is
worked by more than one session — rather than at anything in the code.

**The rule this establishes for the driver's output:** the driver prints every check that went red, which
is right, and it also summarised "22 checks proven able to fail" for this run. The honest figure is 18.
A collateral kill is evidence only when the mutated code is in the failing check's path; otherwise it is
noise, and on a shared database noise is expected. Read the `failed=` column, do not sum it.

---

## ⚠️ A COUNTING RULE, because this file's headline drifted upward once already

**"Proven" means a mutant DECLARED that check and that check then fell.** Nothing else counts, and the
distinction is not pedantry — it is the difference between a claim someone wrote down and confirmed, and a
side effect nobody predicted.

A mutation disturbs the whole suite. `M-ST1` doubles every stage event and fells **seven** checks having
been aimed at three. `M-ST7` stops the close setting a status and fells six. `M-AC2` fells four. Counting
every failure as proof asserts that the mutated code is on each failing check's path, which is exactly what
has not been established.

`mutate-checks.mjs` used to print `new Set(everything that failed).size` as its headline, and on a real run
that read **22 where 18 was defensible**. The driver now reports the two separately:

```
  N mutations ran · N checks proven able to fail (declared and fell) · N isolated exactly one
  + N more fell as COLLATERAL -- a weaker claim, since the mutation was not aimed at them
```

This file's own headline inherited that overcount at the last merge and read **77**; the declared figure is
**75**, with BD1 and BD4 as the two collateral kills — kept, because a collateral kill IS how those two
were first shown able to fail, but recorded as the weaker claim it is.

**When a collateral kill matters, promote it deliberately:** read the `failed=` column, confirm the mutated
code is genuinely on that check's path, and then give the check a mutant of its own. Promoting it by
arithmetic is how a coverage figure grows without anyone deciding it should.

---

## What this file does NOT establish

That the suite is adequate. It establishes that **75 of 121 checks fail for the reason they claim to**,
each against a specific mutation, on the code that mutation was run against. The 44 unproven are now
concentrated rather than wholesale — eleven of fourteen close-won-task checks, ten of twenty-two
activities, seven of thirteen forecast, nine of thirty-one save-deal — and every one of those figures is
counted from a recorded run rather than from a commit message. And no mutation campaign says anything about
behaviour no check covers at all — for that, see the Explorer specs under
`test-harnesses/playwright/specs/`, which is where DN-17, DN-18 and DN-19 came from.
