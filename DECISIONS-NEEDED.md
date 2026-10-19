# DECISIONS NEEDED

Calls made while building sales where a second reading was defensible, kept so the rejected option
stays visible, and the questions that still need someone to rule. App-wide rulings live in
[`docs/DECISIONS.md`](docs/DECISIONS.md).

Most entries were decided and built when they were written. [Open questions](#open-questions) come
first; [Status of every entry](#status-of-every-entry) gives the state of the rest.

## IDs

- **Two series.** `DN-n` began on the embedded-order rework and `D-n` on the close-won-tasks branch.
  Both were kept when the branches merged, because code, metadata and commit messages cite both.
- **One entry per ID.** DN-16 to DN-21, D-31 and D-32 had each been used twice by sessions that had
  not merged. On 2026-10-11 the entry the repository cites kept its number, and the other was
  renumbered or folded into a related entry; see [Renumbered IDs](#renumbered-ids). A renumbered entry
  names its old ID under its heading.
- **`D-3`, `D-4` and `D-6` are the master plan's.** Migrations, seeds and code use them that way, so
  this file's own D-3, D-4 and D-6 were renumbered or retired. Their rulings are `docs/DECISIONS.md`
  D2, D5 and "Master plan D-6".
- **The other series are in `docs/DECISIONS.md`:** `D1`–`D7` (no hyphen), `I1`–`I10`, and the
  prefixed `D-OS`, `D-RRC`, `D-CF`, `D-BD`, `D-UX`, `D-DL` and `D-FY`. A bare `Dn` cited as orders'
  (`D8`, `D53`) is orders' own log.
- **New entries** take the next free number: `DN-29`, `D-35`.

## Open questions

Each needs a ruling, or work in another repository. A question that needs a person to rule stays here
as a written question rather than becoming a GitHub issue.

| ID | Question | Waiting on |
|---|---|---|
| DN-10 | Should the winning stage declare `Confirmed` instead of `Quoted`, so that entering it books the order? | Finance |
| DN-11 | Remove the dead `OneTimeLinesTo` policy key, and the `BillingFrequency` and `CommittedAmount` seam fields sales never sends? | Product; it narrows a published input |
| DN-12 | How does an order-status warning from a board drag reach the rep? | Product |
| DN-25 | `mj sync push` cannot re-push a query's parameters. | MJ core, MJ#4545 |
| DN-27 | Is a per-deal attribution-coverage report worth its own query? | Product |
| DN-28 | Should a parked status (`On Hold`) survive a later stage move? | Product |
| D-5 | Confirm that every stage move appends a `DealStageEvent`, and decide whether an importer gets an audited way to suppress it. | Product |
| D-11 | Is a renewal a new child contract, or one that supersedes the original? | Contracts |
| D-12 | Add `ContractType.Code`, so the seam stops matching on `Name`. | Contracts, [bizapps-contracts#96](https://github.com/MemberJunction/bizapps-contracts/issues/96) |
| D-13 | Seed `TaskTypeStatus` for Contract Processing once finance confirms its steps? | Finance |
| D-14 | Bound `Contract.AnnualIncreasePercent` at 100, or state that it stores a fraction. | Contracts |
| D-28 | Is forecasting monthly? | Finance |
| D-30 | Should the forecast measures get their own sanity checks, and where? | Owner of the queries |
| D-34 | Rename `Pipeline.RequiresDealLines`, or correct its description. | Sales |

DN-19's sales workarounds are removed (#207): MJ 6.1.6 sends the written key on an IsA create. What
remains is #202.

## Status of every entry

**Open** needs a ruling or work. **Decided**, **Built**, **Fixed** and **Resolved** are settled.
**Superseded** was overtaken by a later entry or change. **Tracked** continues as GitHub issues.
**Moved** belongs to bizapps-common, which has owned the Outlook ingest since 2026-08-30. **Note**
records a trap or a measurement rather than a decision.

| ID | Status | Subject |
|---|---|---|
| DN-1 | Decided | Every check bundle requires bizapps-orders |
| DN-2 | Decided | Four save-deal checks retired; SD19 replaces them |
| DN-3 | Decided | Embedded-order lines insert, edit and remove through `deal.Save()` |
| DN-4 | Fixed | CD13 read a column it did not select |
| DN-5 | Decided | `Deal.Amount` caches the order's total, with provenance (D-2) |
| DN-6 | Decided | KI-20 was fixed in bizapps-orders |
| DN-7 | Fixed | The order-provisioning guard |
| DN-8 | Resolved | Deals with an order open again |
| DN-9 | Decided | A product line needs a saved deal |
| DN-10 | Open | Which stage, if any, declares `Confirmed` |
| DN-11 | Open | Dead `OneTimeLinesTo` and unsent contracts-seam fields |
| DN-12 | Open | A board-drag warning has nowhere to go |
| DN-13 | Fixed | The mutation driver restored from `HEAD` |
| DN-14 | Resolved | KI-22's cause: orders' push order and a CodeGen self-import |
| DN-15 | Resolved | The demo seeds priced and stated deals |
| DN-16 | Resolved | Contracts became usable; CT1 and CT4 written |
| DN-17 | Fixed | A first line was written to an orphan order |
| DN-18 | Resolved | A reopen restores the stage and the order |
| DN-19 | Tracked | An inline-created customer bound to an unwritten id |
| DN-20 | Built | A booked order refuses the reopen |
| DN-21 | Decided | What the demo's attribution values prove |
| DN-22 | Note | SD25 and AC9 measured; neither reproduced |
| DN-23 | Decided | One writer for the stage log; transitions are declared |
| DN-24 | Note | `mj sync push` resets the seeded pipelines to Default Company |
| DN-25 | Open | `mj sync push` cannot re-push query parameters |
| DN-26 | Fixed | `Sales: Slipped Deals` could never return a row |
| DN-27 | Open | A per-deal attribution-coverage report |
| DN-28 | Open | A parked status does not survive a later stage move |
| D-1 | Superseded | Which stage means "agreement or higher" (D-OS1) |
| D-2 | Decided | A lined deal's `Amount` caches `OrderHeader.TotalGross` |
| D-5 | Open | The stage-event append on every write path |
| D-7 | Resolved | The contracts seam had nowhere to run |
| D-8 | Resolved | Task-type metadata pushes once tasks has migrated |
| D-9 | Resolved | Renewal defaults for a contract created at Closed Won |
| D-10 | Resolved | Contracts chooses the current template |
| D-11 | Open | What shape a renewal takes |
| D-12 | Open | `ContractType` has no `Code` |
| D-13 | Open | Review steps as `TaskTypeStatus` rather than prose |
| D-14 | Open | The domain of the annual increase |
| D-15 | Moved | The ingest's dedupe key |
| D-16 | Moved | Meetings through MJ's provider or a direct Graph call |
| D-17 | Moved | `GetMessages` had no date filter |
| D-18 | Moved | Direction is inferred, and there is no Bcc |
| D-19 | Fixed | The relevance filter folds case in the query |
| D-20 | Resolved | One activity links to every matched deal |
| D-21 | Moved | Sync-rule precedence |
| D-22 | Resolved | The activity pane writes through `Sales.LogActivity` |
| D-23 | Superseded | Sales' scheduled sync job was retired |
| D-24 | Note | `QuoteSchemaAndView` error at harness start |
| D-25 | Decided | A cancelled meeting is stored `Cancelled` |
| D-26 | Moved | The calendar watermark lives in `Settings` |
| D-27 | Moved | An index on `LOWER(ContactMethod.Value)` |
| D-28 | Open | Is forecasting monthly? |
| D-29 | Decided | A same-day re-run skips |
| D-30 | Open | Sanity checks for the forecast measures |
| D-31 | Decided | One `ForecastSnapshot` writer: the Action |
| D-32 | Built | The daily snapshot reads `Sales: Forecast by Owner` by default |
| D-33 | Note | Open and won deals sit on different date columns |
| D-34 | Open | `Pipeline.RequiresDealLines` outlived `DealLine` |

## Renumbered IDs

Changed on 2026-10-11. Commit messages written before then may use the old ID; "earlier" and "later"
are the two entries' order in this file.

| Was | Now | Entry |
|---|---|---|
| DN-16, the later entry | DN-23 | the `PipelineStageID` trigger has one writer |
| DN-17, the earlier entry | DN-24 | `mj sync push` resets the seeded pipelines to Default Company |
| DN-18, the earlier entry | DN-25 | `mj sync push` cannot re-push query parameters |
| DN-19, the earlier entry | DN-26 | `Sales: Slipped Deals` could never return a row |
| DN-20, the earlier entry | DN-27 | the involvement report's coverage column |
| DN-21, the later entry | DN-28 | `SelectableStatuses()`, and whether parking survives a stage move |
| D-3 | D-34 | `Pipeline.RequiresDealLines` |
| D-4 | retired | demo order numbers; superseded by DN-15, after which orders' own sequence mints them |
| D-6 | retired | `board-move` as an unconditional bundle; answered by DN-1 |
| D-31, the earlier entry | folded into D-8 | MJ_V6_Host's tasks schema |
| D-32, the earlier entry | folded into D-8 | what the tasks migration changed |

---


## DN-1 — Every check bundle now requires bizapps-orders

**Taken:** flipped `save-deal` and `close-deal` from `requires: null` to `requires: "orders"` in
`scripts/expected-check-counts.json`, and made `save-deal`'s `Setup` refuse a host without orders.

**Why:** `DealEntityServer.provisionEmbeddedOrder()` runs inside `Save()` with no install check, so a
deal cannot be saved at all without orders. `mj-app.json` already declares `mj-bizapps-orders` a hard
dependency, which makes a sales-only host misconfigured rather than minimal. Marking those bundles `null`
would have had the coverage gate demand two bundles that cannot pass there.

**Rejected:** gating the provisioning on `OrdersIsInstalled()`, so a deal on a sales-only host simply has
no order. That is quieter and touches the entity server rather than a manifest — but it produces a deal
missing the thing S-US4 says every deal has, with nothing complaining. Loud beat quiet.

**Consequence, and it is the reason this is written down:** no bundle is unconditional any more, so a host
with nothing linked expects ZERO bundles and the gate would have passed while running nothing. That hole
is now closed — `assert-check-count.mjs` fails on an empty expectation. Worth re-reading if a future
bundle goes back to `requires: null`.

---

## DN-2 — Four save-deal checks retired rather than rewritten

**Taken:** deleted SD4, SD5, SD12 and SD16. Their IDs are **not** reused.

| Check | Asserted | Why it could not move |
|---|---|---|
| SD4 | `DealLine.Resolved*` stayed NULL | those four columns do not exist |
| SD16 | a caller-set `Resolved*` was refused | same, and the rule is orders' now |
| SD5 | a transcribed `Total` was stored verbatim | sales transcribes no line money at all |
| SD12 | a line's type carried `IsRecurring` | `DealLineType` is retired; nothing routes by line kind |

**What replaced the requirement:** Rule 1 (sales never computes money) is now asserted **positively** by
the new **SD19** — sales sends product and quantity, and `UnitPrice`, `CompanyID` and `LineNumber` come
back on a row it never wrote. That is a stronger claim than "the columns we own stayed empty."

**Judgement call inside SD19, worth a second opinion:** it asserts `UnitPrice` is **non-null**, not that
it equals a figure. Asserting a number would mean this repo knowing a price. The cost is that a
catalogue product with no price would store `0` and still pass. Tightening it would mean sales reading
orders' price tables, which is exactly what Rule 1 forbids — so it stands, but it is the softest
assertion in the bundle.

**Also dropped:** SD15's second half, which proved `DealLine.Quantity` defaulted to 1. The line is an
order line now, so that default is orders' metadata. Sales asserting a neighbouring app's column
defaults is a check that fails when another team makes a decision that is theirs to make. The deal half
of SD15 (`PaymentMethod` defaults from metadata) is untouched.

---

## DN-3 — The two-level save graph: insert, edit and remove all go through `deal.Save()`

**Taken:** rewrote SD6, SD13 and SD14 against `deal.OrderID_Object.Lines` — the collection belongs to the
deal's **embedded order**, while `Save()` is still issued on the **deal**. Then ran them, which is the
part that mattered.

| Verb | Through `deal.Save()` | Check |
|---|---|---|
| INSERT | ✅ | SD1, SD19, SD20 |
| EDIT | ✅ | SD14 |
| REMOVE | ✅ since KI-20 was fixed in bizapps-orders (DN-6) | SD6 |

So an embedded record joins the parent's save plan for all three verbs. Until the KI-20 fix a removal
was silently dropped while the save returned true, through `order.Save()` as well, and SD6 was its
tripwire.

---

## DN-4 — `CD13` was reading a column it did not select — **fixed, no decision needed**

Recorded because it is worth knowing it happened. An earlier mechanical pass retargeted CD13 from deal
lines onto the payment schedule by replacing `SELECT Quantity` with `SELECT Amount`, and left the type
parameter and the expected value behind: `TxOne<{ Quantity: number }>` over `SELECT Amount`, then
`AssertEqual(Number(row.Quantity), 41)` against a stored `41000`. `Number(undefined)` is `NaN`, so the
check would have failed for a reason that had nothing to do with the close lock. Its `children()` helper
was likewise still reading `DealLine` under a comment that said instalments.

**The lesson, not the fix:** a find-and-replace across a check file changes what is READ without changing
what is ASSERTED, and the two disagree silently. Anything converted that way needs the assertion read
back, not just the query.

---

## DN-5 — DECIDED by D-2: `Deal.Amount` is a cached copy of the order's total

The §6 definition-of-done check — a lined deal's `Deal.Amount` equals what orders computes for the same
draft — was unbuilt, and it turned on one question: is `Amount` still a cached answer with provenance,
or a read-through of the order's total that makes `AmountIsComputed`, `AmountComputedAt` and
`AmountSourceHash` dead weight?

Answered on 2026-08-31 by D-2 (shape 2): a lined deal caches `OrderHeader.TotalGross`, and the three
columns stay as its provenance; the hash fingerprints the order and its total. `save-deal.SD21` asserts
the amount equals the order's total and that the provenance is stamped; `SD22` and `SD41` cover a
hand-typed figure.

---

## DN-6 — DECIDED: KI-20 was fixed in bizapps-orders

The deal's delete-line affordance reported success and the line came back on reload, because orders'
save never processed the collection's pending removals (KI-20). Three options were recorded:

- **A. Fix it in bizapps-orders**, so every caller gets it. Needs care, because it is the booking path.
- **B. Work around it in sales** by deleting the removed line rows here. Rejected: it puts a second app
  in charge of deleting orders' rows, and would duplicate whatever rule orders writes.
- **C. Leave it**, with SD6 as a tripwire.

**A was taken.** `OrderEntityServer.Save()` now drains `Lines.Removed`, renumbers the survivors and
recomputes the header (golive#187, closed 2026-09-14). `save-deal.SD6` asserts the removal and the
re-sequencing, and the deal form removes a line through `Lines.Remove()` + `order.Save()`.

---

## DN-7 — The provisioning guard was wrong, and every line check found it at once

**Not a decision — a fix, recorded because the failure shape is worth recognising.**
`DealEntityServer.provisionEmbeddedOrder()` guarded on `IsSaved || OrderID`. But `Ensure()` assigns the
new peer's key to `OrderID` immediately, so any caller that reached the order BEFORE saving — an importer
building a deal and its lines for one `Save()`, or nine of these checks — arrived with `OrderID` already
populated. The guard returned early, the stamps never ran, and the save died inside orders on
`CompanyID cannot be null`: a NOT NULL complaint about a column two apps away from the mistake.

It is now `IsSaved` alone, plus a second guard that leaves an ALREADY-PERSISTED order untouched, so
attaching an existing order stays legitimate. Nine failing checks became zero.

The reason it survived until now: in the UI a deal is always saved before a line is added, so the broken
branch was unreachable from the only path anyone had exercised.

---

## DN-8 — RESOLVED: deals with an order open again; both causes were outside this repo

**Explorer pass, 2026-08-20.** A deal with an order could be created but not reopened, and since every
deal has an order, that was every deal. Two causes, KI-21 and KI-22 in `docs/KNOWN-ISSUES.md`:

- **KI-21.** A host running sales must also register orders' server package in `mj.config.cjs` →
  `dynamicPackages.server[]`, which `mj app install` writes; otherwise orders' resolvers never enter the
  GraphQL schema. An install rule rather than a defect.
- **KI-22.** Orders' generated code was behind the database. Re-running orders' CodeGen, the fix this
  entry proposed, was not the cause. DN-14 found it: orders' metadata push order, fixed in
  bizapps-orders, and a CodeGen self-import, fixed in MJ on 2026-08-26.

This entry held back from running CodeGen partly because CLAUDE.md then said a second CodeGen pass
corrupts a database. That rule was reversed on 2026-09-20: run CodeGen until it reports
`success: true` and per-entity parity is clean.

---

## DN-9 — DECIDED: a product line needs a SAVED deal, and the button now says so

**The workspace could not save a product line at all.** `CanSave` is gated on `deal.Validate()`, which
fans out into the embedded order — and in the browser nothing has stamped the server-derived NOT NULL
columns. A rep filled in every field they could see and the Save button stayed disabled reading
"Company ID cannot be null", against a Party info tab where nothing was wrong.

Three required columns, three different answers:

| Column | Who supplies it | What was done |
|---|---|---|
| `OrderLine.CompanyID` | `OrderLineEntityServer`, from the product | **`AddLine()` now sets it** from the pipeline lookup — the same row the server reads |
| `OrderHeader.CompanyID` / `OrderType` | `provisionEmbeddedOrder()` | **`AddLine()` now sets both** on an unsaved order |
| `OrderHeader.OrderNumber` | `OrderEntityServer.assignOrderNumber()` — server only | **cannot be supplied**, and must not be invented |

Because of the third, an order that exists only in memory can never validate. So **`Add line` is disabled
until the deal is saved**, with the reason on screen: *"Save the deal first — its order is created on the
first save, and a product line needs it."* That is also the sequence S-US4 describes, so it is not a
workaround dressed as a feature.

**What was rejected:** relaxing `CanSave` to skip companion validation. It would have unblocked both
cases at the cost of the thing that gating buys — a rep learning about a refusal before they lose their
work. Worth revisiting only if pre-save line entry turns out to matter.

**Verified since.** Once DN-8 cleared, `79-embedded-order-refresh` added a line to a just-saved deal
through the browser and found it on the deal's own order (DN-17). The deal form's line editor keeps the
same gate: *"Save the deal first — a product line needs its order."*

---

## DN-10 — OPEN, and it is one field: which stage carries `Confirmed`?

Andrew's normative sentence says Proposal or higher **"including Closed Won"** is `Quoted`. A later
example in the same message says Closed Won → `Confirmed`. We asked which he intends and proceeded with
**`Quoted` on the winning stage**, per the instruction to assume and note.

**Why it is not a coin toss.** `Confirmed` is the irreversible step in orders: it books journal entries
(their D8), freezes every line with trigger 51003, and nothing leaves it — orders gives `Confirmed` no
onward status, so undoing one takes a reversal order (their D53). Seeding it on the winning stage means
**a rep dragging a card to Closed Won posts to the ledger**. That may be exactly what the request meant —
back-office entry does confirm directly — but it is a different sentence from "a quote becomes a signed
quote", and the two readings are one seeded field apart.

`Confirmed` is therefore seeded **nowhere** today. To change it, set `OrderStatusOnEntry` on the `SIGNED`
stage in `metadata/pipeline-stages/.sales-pipeline-stages.json`, plus the matching literal in
`scripts/seed-demo-data.sh`. The code needs no change — that is the point of D-OS1. CO3 and CO5 assert
the MECHANISM and stay green either way, which is why they were reframed.

The stories record the same open decision: golive#35 (S-US3) and golive#115 (S-US5).

---

## DN-11 — `OneTimeLinesTo` is the last dead key in `CloseWonPolicy`

`OrderState` is gone from the published input contract. `OneTimeLinesTo` is equally dead — it steered
one-time lines to the Order route, and close-won creates no order — but it is still declared, still
defaulted to `'None'`, and still in both seeded policy JSONs.

It was left because Andrew's ruling named `OrderState` and narrowing a published remote-operation
contract is its own decision. Removing it is a five-minute change of exactly the shape just completed.
**A deployment setting it is configuring nothing**, which is the argument for removing it rather than
documenting it.

**More joined it on 2026-08-20**, from the v6 contracts-seam merge: `ContractsCreateFromDealSeamInput`
declared `BillingFrequency`, `CommittedAmount` and `Lines`, and `buildContractInput()` sends none of them.
They were `ContractTerm` and `ContractLine` columns, and contracts deleted both tables — so unlike
`OneTimeLinesTo` these have nowhere to go rather than merely being unread. `Lines` has since been
removed; `BillingFrequency` and `CommittedAmount` are still declared. Same decision, three fields now:
narrow the shapes in one pass, or leave them documented. Leaving them has a real cost — a reader of the
interface reasonably concludes sales can send a committed amount, and it cannot.

---

## DN-12 — a board-drag warning has nowhere to go

`Sales.CloseDeal` and `Sales.ReopenDeal` return the order-status warnings as `Issues` with
`Severity: 'warning'`, so a caller of either sees them. A plain `deal.Save()` — which is what the
pipeline board's drag does, and the path D-OS3 insists the writer live on — leaves them on
`DealEntityServer.OrderStatusWarnings` and in the server log.

**A warning only a server log carries is one a rep never reads.** And the S-US8 case guarantees a real
one: reopen a lost deal and the order stays voided, silently, from the board.

Options, cheapest first: have the board read the property back off the saved entity (it is a server
class, so this needs a channel through GraphQL that does not exist yet); return warnings on a
`Sales.MoveDealStage` operation the board would call instead of saving directly; or accept the log for
now and surface it only on the two operations. Not decided.

---

## DN-13 — FIXED: the mutation driver restored with `git checkout --`, which means HEAD

Recorded because it cost real work tonight. The driver applies a mutation, builds, runs the suite, then
restores the file with `git checkout -- <path>`. That restores to **HEAD** — so running it over
UNCOMMITTED work silently deletes the work rather than the mutation.

It ate `DealEntityServer.ts`'s entire stage-order writer once. Recovering was only cheap because the
edit had been applied by a scripted patch that could simply be re-run.

**Fixed the same day, and it did not need the rule.** The driver is now committed as
`test-harnesses/mutate-checks.mjs`: it copies each file aside before touching it, restores from that
copy byte for byte, and verifies the restore — printing the backup path and exiting 3 if that ever
fails. So "commit before mutating" is no longer required; running against a dirty tree is safe, which
is when the tool is most useful.

Proven rather than asserted: a comment was appended to `DealEntityServer.ts`, `M-SD18` was run, and the
file's checksum was identical before and after with the mutation applied and reverted in between.

The earlier idea — refuse to run against a dirty tree — was rejected. It protects the work by denying
the tool at exactly the moment a new check most needs proving.

---

## DN-14 — RESOLVED: KI-22 was orders' metadata push order plus a CodeGen self-import

DN-8 guessed that re-running orders' CodeGen file pass was all it would take. Tried twice, it was not:
each pass fixed one symptom and exposed the next, because the host had never received orders'
metadata (`EntityField.EmbeddedRecord`, `RelatedRecordCollection`, and whatever drives
`entityPackageName`), so no regeneration could reproduce orders' committed code.

**The cause was one line of JSON.** Orders' `metadata/.mj-sync.json` listed 7 of 23 directories in
`directoryOrder`, so `queries` sorted ahead of `query-categories` and `mj sync push` halted at 14 of 23
directories; the nine after it, `entity-fields` and `entity-relationships` among them, never ran.
Listing `query-categories` before `queries` took the push to 23 of 23 with 0 errors. That order is on
bizapps-orders `next`.

**Regenerating then hit an MJ CodeGen bug:** orders' `entity_subclasses.ts` imported from its own
package. MJ fixed it on 2026-08-26 by importing peer entity classes through `entityImportPackages`.

---

## DN-15 — RESOLVED 2026-08-20: the seeded demo now shows both a priced deal and a stated one

**It was built, and the answer to "is it worth it" turned out to be yes for a reason that only showed up
once it worked:** with every deal hand-typed, the amount cache was invisible, and so was the argument the
app exists to make. Five of the seven seeded deals now carry order lines and come back engine-priced; two
stay deliberately hand-typed. The distinction between *stated* and *priced* is now a thing you can point
at on a screen rather than a paragraph in a README.

`scripts/seed-demo-lines.mjs` does it, driven from the bottom of `scripts/seed-demo-data.sh` and
separately re-runnable. It drives the ENTITY layer — adds lines by product and quantity only, and lets
orders answer — because a SQL seed would have to invent the money it is meant to prove sales never
invents.

**Three things it does that a reader would not guess, each for a stated reason:**

* **It clears `Amount` first.** The SQL seed types a figure onto every deal, and SD22 rightly forbids
  overwriting a human's number with a computed one. So the seeder RETRACTS the stated figure before
  asking — a declaration that this deal's number is now the engine's, not a workaround for the guard.
* **It deletes four child tables before clearing order lines.** Orders records an
  `OrderLinePriceComponent` per line, so a bare line delete hits `FK_OLPC_OrderLine`. Subscription,
  entitlement and payment rows only arise from CONFIRMING an order, so if the seed ever fails on one of
  those, it has started booking — which is a bug, not a seeding problem.
* **It lifts the close lock in SQL for the two closed deals, then restores it.** Deliberately NOT via
  `Sales.ReopenDeal`: a demo fixture inventing audit history is worse than none.

**Verified against the database, not the screen** — five `AmountIsComputed = 1` with a timestamp and a
hash, two untouched:

```
DEAL-9001  PRICED  amount=124400  lines=2  order=Draft   stampedAt=yes hash=yes
DEAL-9002  PRICED  amount= 16240  lines=1  order=Draft   stampedAt=yes hash=yes
DEAL-9003  PRICED  amount= 73080  lines=1  order=Draft   stampedAt=yes hash=yes
DEAL-9004  stated  amount= 28000  lines=0  order=Draft   stampedAt=no  hash=no
DEAL-9005  PRICED  amount= 27480  lines=1  order=Quoted  stampedAt=yes hash=yes
DEAL-9006  PRICED  amount= 12180  lines=1  order=Voided  stampedAt=yes hash=yes
DEAL-9007  stated  amount=  9500  lines=0  order=Draft   stampedAt=no  hash=no
```

Note DEAL-9005 sitting at `Quoted` and DEAL-9006 at `Voided`: those came from their stages'
`OrderStatusOnEntry`, so the seed also demonstrates D-OS1 rather than just the amount cache.

**And it found a real defect on the way**, which is the part worth keeping. Four of the five deals failed
with `CompanyID cannot be null` from inside orders, because `provisionEmbeddedOrder()` returned early on
`this.IsSaved` — provisioning could only ever happen on a deal's FIRST save, so every deal that already
existed without an order was permanently unable to get one. Fixed to ask about the ORDER instead. Pinned
by `save-deal.SD24` and its mutant `M-PV1`.

---

## DN-25 — OPEN upstream (MJ#4545): `mj sync push` cannot re-push `MJ: Query Parameters`

*Numbered DN-18 until 2026-10-11.*

Pushing `metadata/queries` fails with `Failed to save MJ: Query Parameters record at MJ: Queries[0]/MJ:
Query Parameters[0]: Error executing SQL`, and **rolls back cleanly** — nothing is half-written. The
queries and their parameters land on a clean database; every push after that fails, so a change to a
query definition cannot be pushed.

**The mechanism, found later:** MJ's push extracts parameters from the Nunjucks template and inserts
them, then inserts the file's own declarations and hits `UQ_QueryParameter_QueryID_Name`. Parameter
persistence should upsert on `(QueryID, Name)`. Filed as MJ#4545.

**Meanwhile** a change to a query's SQL reaches a database only by updating `__mj.Query.SQL` directly,
as DN-26's fix did. That does not scale to a parameter change.

---

## DN-26 — RESOLVED: `Sales: Slipped Deals` could never have returned a row

*Numbered DN-19 until 2026-10-11.*

**A real defect, found by fixing the seed rather than by reading the query.** The join was

```sql
INNER JOIN vwDeals d ON d.ID = s.RecordID
```

and `__mj.RecordChange.RecordID` is a **composite-key string** — `'ID|93111111-0000-...'`, not a GUID.
That does not merely fail to match: SQL Server converts toward `uniqueidentifier` and the statement dies
with `Conversion failed when converting from a character string to uniqueidentifier`.

**It looked healthy because nothing qualified.** No seeded deal had ever had its `ExpectedCloseDate`
changed, so the CTE was empty, the join never evaluated, and the report returned zero rows — which reads
as "nothing has slipped". The error appeared the instant the demo recorded its first real date move.

A query that cannot run, hidden behind empty input, is indistinguishable from a query that is working and
has nothing to say. That is the whole argument for seeding data these reports can actually answer, and it
paid for itself on the first one.

Fixed by extracting the id in the CTE with `TRY_CONVERT` over the `Field|Value` form. `TRY_CONVERT`
rather than `CONVERT` deliberately: a future entity with a multi-column key yields NULL and is dropped by
the join, instead of taking the whole report down again.

**No other query reads `RecordChange`** — checked, it is the only one.

---

## DN-27 — OPEN: the involvement report promised a column it does not ship, and coverage is the wrong grain

*Numbered DN-20 until 2026-10-11.*

`deal-involvement-by-rep.sql`'s header said `AttributionCoveragePct` "exposes that ratio per deal-set".
**There is no such column.** The SELECT ships `AvgAttributionPct` and `UnstatedAttributionCount`. Found by
seeding the data the report reads and then looking at the output instead of the comment.

The comment is corrected rather than the column added, because **coverage is a property of a DEAL and this
query groups by REP**. "Do this deal's members' shares total 100?" cannot be answered on a row that says
"this rep averaged 27.5%". Adding a column at the wrong grain would have made the promise true and the
number useless.

**The decision needed:** whether a per-deal attribution-coverage report is worth its own query. §9.4's
concern is real and the demo data now contains a live instance of it — `DEAL-9006` carries 100 + 30 = 130
— but nothing surfaces it as a coverage figure. Not built, because inventing a fourteenth read model to
satisfy a comment is the wrong order of operations.

---

## DN-21 — DECIDED: what the demo's attribution values are chosen to prove

Recorded because the numbers look arbitrary and are not.

`DEAL-9005` (won) carries 60 / 25 / 15. Measured on the live database, the weighted report splits its
27,480 into 16,488 / 6,870 / 4,122 — **which adds back to 27,480 exactly**, while bookings-by-owner
credits the whole amount to the AE once. Two true answers to two different questions, reconciling.

The same three rows each carry `WonAmountOfDealsTouched = 27,480`. Summing that column gives **82,440 for a
27,480 deal** — §9.4's triple-count, visible on screen in a report that is otherwise correct. That is a
better demonstration than the prose, and it is the reason the clean split went on the WON deal.

`DEAL-9006` (lost) carries 100 + 30 = 130. **Be precise about what this does and does not show:** because
the deal was lost it contributes no money, so the 130 surfaces only through `AvgAttributionPct` and the
involvement counts, not as an inflated amount. Demonstrating over-attribution on real revenue would need
a second won deal, and adding one to make a rhetorical point is not what a demo is for. What it does
prove is that a LOSS carries a team, which is what makes win rate by rep answerable at all.

**Only one closed won deal exists**, so a clean split and an inflated split cannot both be shown on
money. The reconciliation was judged the more valuable of the two. That is the trade, stated.

---

## DN-24 — NOT A DECISION, A TRAP: `mj sync push` resets the seeded pipelines to Default Company

*Numbered DN-17 until 2026-10-11.*

Recorded because it cost a confusing suite run and will do so again. `metadata/pipelines/` seeds the
B2B and D2C pipelines against `Default Company` — the only company a bare install is guaranteed to
have — and `scripts/seed-demo-data.sh` repoints them at the two dev companies afterwards.

**A metadata push undoes the repoint.** Both are correct: the push restores what metadata declares,
and metadata cannot declare a company that only exists on this machine. The symptom is not a
pipeline problem, though — it is **18 integration checks failing on `the host needs at least 1
sellable product(s) for company C0DEFA17-...`**, because the fixture resolves its pipelines by
policy and then looks for products belonging to whatever company they now name.

After any `mj sync push --dir metadata`, re-point them:

```sql
UPDATE __mj_BizAppsSales.Pipeline SET CompanyID = 'C0A5E100-0001-4A01-9E11-5B7C3D2F8A01'
 WHERE ID = '90111111-0000-4000-A000-000000000001';   -- B2B  -> Blue Cypress (Local Dev)
UPDATE __mj_BizAppsSales.Pipeline SET CompanyID = 'B0111111-0000-4000-A000-000000000002'
 WHERE ID = '90111111-0000-4000-A000-000000000002';   -- D2C  -> BC Education Group (Local Dev)
```

Or re-run `scripts/seed-demo-data.sh`, which does the same two updates. No decision needed; this is a
note for whoever meets the 18 failures next.

---

## DN-16 — RESOLVED 2026-08-20: contracts became usable, and CT1/CT4 are written

Found by CT0 firing. Contracts' seven v2 tables and seven entities are on this host as of 2026-08-20,
and nothing can read them:

* `View or function '__mj_BizAppsContracts.vwContracts' has more column names specified than columns
  defined` — the generated view is malformed, so every read of the entity fails at the SQL level.
* `ContractType` is unseeded, so `LiveContractsSeam` has no type to resolve and refuses before it starts.

Both are the KI-21/KI-22 shape once more: a schema migrated onto a host whose metadata never followed.
The fix is in contracts — regenerate its views against this database and push its metadata — and it is
worth doing deliberately rather than by another CLI's side effect, because a malformed view that nothing
reads is invisible until something does.

Both were fixed outside this repo the same day. `vwContracts` reads, four contract types are seeded, CT0
went red on cue, and CT1/CT4 are written — transcription from CT0's own failure message, as intended.

**Two surprises in the writing, both worth recording because each cost a run.**

`ContractType` has no `IsActive` column; it has `Status`. Asking for the wrong one fails at the SQL layer
and surfaces through `RunView` as a bare `Error executing SQL`, which names nothing.

And **the seeded `CloseWonPolicy` named a contract type that has never existed on any host.** It said
`"ContractTypeCode":"Standard"`; contracts ships 'Order Form', 'Statement of Work', 'Payment Link' and
'Change Order'. Every close-won on the B2B pipeline would have planned a contract the seam could not
create — a real defect in metadata this branch shipped, found only because CT1 forced a resolution
against the live table. Now `Order Form`.

CT1 resolves a STANDALONE type by reading `ParentStatusRequirement`, not by excluding the name
'Change Order' — that type requires a `ParentContractID` and a close-won has no parent. Contracts put
that column there for exactly this reason, and its own seed comment says its subclass used to compare the
name and broke on a rename. Same discipline, another app's vocabulary.


---


## D-1 · SUPERSEDED by D-OS1: which pipeline stage means "agreement or higher"?

The seed set every embedded order to `Draft`, because nothing in the schema named the threshold stage
and comparing a stage name in code fails the vocabulary gate. The answer arrived as data on each stage,
`PipelineStage.OrderStatusOnEntry` (`docs/DECISIONS.md` D-OS1): on the seeded B2B pipeline, Proposal,
Negotiation and Signed declare `Quoted`. Whether any stage should declare `Confirmed` is DN-10.

---

## D-2 · DECIDED: a lined deal's `Amount` is a cached copy of the order's `TotalGross`

Once a deal's lines moved onto its embedded order, nothing reconciled `Deal.Amount` with them, and the
board summed `Deal.Amount`. On the reseeded demo data the two were 43–50% apart on every lined deal, so
the board's column totals were precise and wrong. Three shapes were on the table:

1. a read-through of the order's total, retiring `AmountIsComputed`, `AmountComputedAt` and
   `AmountSourceHash`;
2. a cached copy whose hash fingerprints the order rather than the retired deal lines, so a surface can
   still say the figure is stale;
3. a human estimate the board stops summing, showing an order-derived total instead.

**Decided: shape 2 (2026-08-31).** A lined deal caches `OrderHeader.TotalGross` onto `Deal.Amount`,
copied, never summed in sales. A typed figure survives only while the order has no priced total
(`save-deal.SD21`, `SD22`, `SD41`). This also answers DN-5.

---

## D-34 · `Pipeline.RequiresDealLines` survived a table that did not

*Numbered D-3 until 2026-10-11; `D-3` is the master plan's quota question.*

The column still exists post-rework and the seed still sets it (`0` on the header-only pipeline).
Its description still reads *"whether deals carry catalog lines"*, which now has to be read as "whether
the deal's embedded ORDER carries lines" — the flag outlived the table it was named for.

**Interim choice:** kept, used, and its narrative updated in the seed to say what it now means.

**What is needed:** either a rename (`RequiresOrderLines`) or an updated column description. Low
urgency, but the current name will mislead exactly once per newcomer.

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

## D-7 · RESOLVED: the contracts seam has somewhere to run

When `LiveContractsSeam` was rewritten onto the v6 entity path, neither local database had contracts
installed, so none of its body had executed and every call stopped at *"bizapps-contracts is not
installed in this deployment"*. Contracts was installed and seeded on MJ_V6_Host on 2026-08-20 (DN-16).
`close-won-contract.CT1` now creates a contract through the seam, and `CT7` saves an Order Form carrying
contracts' current template.

---

## D-8 · RESOLVED: the task-type metadata pushes once tasks has migrated

`metadata/task-types/` declares `TaskType.Code`. Until the bizapps-tasks migration that adds the column
was applied, `mj sync push` refused the directory at validation, before writing anything, and pushes
ran with `--exclude task-types`. Once it was applied to MJ_V6_Host (2026-08-20), a full push with no
exclusion ran 15 of 15 directories with 0 errors. `task-types` reported no changes, because the
migration's name-derived fallback produced the same codes this repo declares. `CloseWonTaskService`
still matches on `Name` on a host without the column, and `WT12` covers both paths.

**Two notes on that host, from applying it** (the earlier D-31 and D-32 until 2026-10-11). MJ_V6_Host's
tasks schema came from MJ core's migrations rather than bizapps-tasks', so the migration was applied by
hand and no Flyway history row was invented; an MJ core migration adding the same column would fail
there. It also adds two foreign keys from the tasks schema into `__mj.Action`. A rebuilt host is
unaffected.

---

## D-9 · RESOLVED: a contract created at Closed Won takes its type's renewal defaults

Sales' renewal columns are named `…Override` because NULL means *"use the standard"*, a different fact
from *"we negotiated a number that equals today's standard"*; only the NULL survives a later change to
policy. When this was raised, contracts' `ContractType` had no default columns, so the seam passes an
override through when the deal states one and populates nothing otherwise.

Contracts added `DefaultAutoRenew`, `DefaultRenewalNoticeDays`, `DefaultCancellationWindowDays` and
`DefaultAnnualIncreasePercent` on 2026-09-14 (golive#217). They are a starting point, not a rule:
`ContractEntity.SeedRenewalDefaultsFromType()` copies them onto an unsaved contract when its form picks
a type, and nothing applies them at save time. The seam does not call it, so a contract created at
Closed Won still has NULL renewal terms unless the deal negotiated them.

**Ruling (bizapps-contracts#97):** yes, and the caller asks for it. Contracts keeps seeding out of its
server save, because a form save reaches the server without the form's record of which fields the user
answered, and seeding there would overwrite those answers. The seam writes what the deal states, marks
those fields (always including `AutoRenew`, since the deal's checkbox is an answer), then calls
`SeedRenewalDefaultsFromType()`, so the type fills only what the deal left unset. Sales still copies no
default value itself, and a null override still means "use the standard". `close-won-contract.CT8`
asserts both halves.

The unmounted deal workspace still hardcodes placeholders for the same standards
(`STANDARD_ANNUAL_INCREASE_PCT = 5` and `STANDARD_CANCELLATION_NOTICE_DAYS = 90` in
`deal-workspace.types.ts`).

---

## D-10 · RESOLVED: contracts chooses the current template

`ContractTemplate` had no way to say which template was current, and picking the newest by
`IntroducedDate` would attach next year's paper to this year's deal. The seam honours a supplied
`ContractTemplateID` and never selects one. Contracts now defaults the newest published, usable
template itself (golive#218), including for a contract the close creates (golive#269);
`close-won-contract.CT7` asserts an Order Form saves with it.

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
becomes a real defect rather than a latent one. One line either way. Related to D-9: contracts'
`DefaultAnnualIncreasePercent`, added since, has the same open upper bound.

---

# ACTIVITIES AND THE OUTLOOK INGEST — D-15 … D-27

Raised while building S-US9 (golive#119) and the ingest behind S-US10 (golive#120). **The ingest moved
to bizapps-common's Activity Sync engine on 2026-08-30** (084591a). Sales keeps `DealMatcher`, the
`Sales.DealLinker` extension, manual logging and the deal timeline. The entries marked MOVED are
common's to answer and stay here as the record of what was raised.

---

## D-15 · MOVED to bizapps-common: the dedupe key is Graph's message id, not the RFC-822 `Message-ID`

Graph's message id is per mailbox, so one email ingested from two mailboxes made two `Activity` rows.
Whether multi-mailbox ingestion is in scope, and so whether the key becomes the RFC `Message-ID`, is
common's question now.

---

## D-16 · MOVED to bizapps-common: meetings through MJ's provider, or a direct Graph call

MJ's `BaseCommunicationProvider` had no calendar method, so sales built meetings on a direct Graph
`/events` call as a working assumption, behind the same source interface as mail so it could be swapped
in one file. MJ's provider contract gained calendar retrieval on 2026-09-07. Where the calendar code
lives is common's question now.

---

## D-17 · MOVED to bizapps-common: `GetMessages` had no date filter, so incremental sync was fetch-and-discard

`GetMessagesParams` had no "since", so each run fetched the newest `NumMessages` and dropped what the
watermark had passed. More arrivals between two runs than the limit lost the oldest for good, and the
interim answer was a per-run limit plus an issue raised when a full batch was entirely newer than the
watermark. MJ's `GetMessages` has had date bounds since 2026-09-04; whether common's source uses them
is common's to check.

---

## D-18 · MOVED to bizapps-common: direction is inferred, and there is no Bcc

MJ's message type carries no inbound or outbound flag and no Bcc field, so direction was inferred by
comparing the sender with the mailbox read, which files a delegate's sent mail as inbound. The ask, a
direction signal on MJ's message type or confirmation that delegate mail is out of scope, moved with
the ingest.

---

## D-19 · RESOLVED: the relevance filter folds case in the query

`ContactMethod.Value` is not normalized, SQL Server's default collation ignores case and PostgreSQL's
does not, and production is PostgreSQL. A bare `Value IN (…)` would therefore have missed a
differently-cased address there with no error. The filter now matches `LOWER(Value) IN (…)` on both
engines.

**How this was nearly missed.** The first check asserted the behaviour and stayed green with the fix
reverted, because SQL Server's collation did the work either way: it measured the database, not the
code. `AC12` asserts the SQL itself contains `LOWER(Value)`, and goes red on that mutant. `LOWER()` is
non-sargable, so the index that restores performance is D-27.

---

## D-20 · RESOLVED: one activity is linked to every deal it belongs to

`DealMatcher` returns every open deal a participant points at, but the writer keyed on the unique
`(SourceSystem, ExternalID)` and filed the message against the first deal only. Under common's engine,
`Sales.DealLinker` adds a `Regarding` link for every match on the one `Activity`.

---

## D-21 · MOVED to bizapps-common: the sync-rule precedence is a convention, not a stated one

`ActivitySyncRule` has `Sequence`, `Action`, `Direction`, a date range and a free-text `Filter`, and
nothing states how rules combine. Sales applied them in `Sequence` order, last match wins, default
include, and did not evaluate `Filter`. Stating the precedence, and a grammar for `Filter`, is common's
now.

---

## D-22 · RESOLVED: the activity pane writes through `Sales.LogActivity`

An Angular package cannot import the server's `ActivityWriterService`, so the timeline wrote an
`Activity` and its `Regarding` link by hand, without party links, an external key or dedupe. It now
calls the `Sales.LogActivity` Action, which wraps the writer (0f2ee0a, 2026-08-21).

---

## D-23 · SUPERSEDED: sales' scheduled sync job was retired

`Sales.SyncActivities` and its hourly `ScheduledJob` were seeded Active over two empty fixtures, so the
chain fired every hour and wrote nothing. Both were retired on 2026-08-30 (bcea2ef) when the ingest
moved to bizapps-common, whose engine owns the trigger.

---

## D-24 · `provider.QuoteSchemaAndView is not a function` on harness startup

Not a decision so much as an observation that should not get lost. Running the integration harness from
this worktree logs `TypeError: provider.QuoteSchemaAndView is not a function` during
`setupSQLServerClient`, then continues; all 11 checks run and pass.

Almost certainly local: this worktree's `Entities`/`Server` dists were compiled here against the store's
`@memberjunction/core`, while the shared tree's were built earlier. It did not appear on the sibling
branches.

**What is needed:** nothing yet — but if it appears in CI or on a clean install it is a version-skew
symptom rather than a code fault, and this is where it was first seen.

---

## D-25 · DECIDED: a cancelled meeting is stored `Cancelled`

The ingest hardcoded `Activity.Status = 'Completed'`, so a cancelled meeting read as one that happened.
`CK_Activity_Status` already allows `'Cancelled'`, so this was a bug fixed rather than vocabulary
invented. `Outcome` stays NULL: the nearest seeded value, `NoShow`, is a different fact (a meeting that
went ahead without someone), and nothing in `CK_Activity_Outcome` means "did not occur". Cancelled
meetings are still filed, because "they cancelled" belongs on the timeline. `AC18` asserts both
directions.

---

## D-26 · MOVED to bizapps-common: the calendar watermark lives in `Settings`, a shared bag

Mail advanced `ActivitySyncConnection.LastSyncAt`; the calendar kept its own `CalendarLastSyncAt` key in
the JSON `Settings` column, because one watermark for both skips any meeting older than the newest
email (`AC14`). The risk is two consumers choosing the same key; whether common would rather own a
second column is its call.

---

## D-27 · MOVED to bizapps-common: an index on `LOWER(ContactMethod.Value)`

D-19's case fold makes the per-participant lookup non-sargable. The fix is in common's schema: a
functional index (a computed column plus an index on SQL Server), or lower-casing `Value` at write time
so a plain index works.

---

# FORECAST SNAPSHOT — D-28 … D-33

The daily `ForecastSnapshot` capture and the queries it reads.

---

## D-28 · The snapshot period is the calendar month, because nothing stores a fiscal one

When no period is supplied, the job snapshots the current calendar month. Since golive#168 the month is
chosen in the business time zone; it was UTC before.

**This is a choice, not a derivation.** Sales has no fiscal calendar — no `FiscalPeriod` table, nothing on
`Company` naming a year end, nothing anywhere that says when a quarter begins. So "the current period"
has no stored answer, and the calendar month is the only window that needs no invented configuration.

Monthly is very likely right; most forecasting is. But if Blue Cypress forecasts on a fiscal calendar
offset from January, every snapshot is filed against the wrong window — and the rows would look
perfectly reasonable, because a period is just two dates.

**Interim choice:** the calendar month. FS7 asserts the boundary with a fixed instant late on a month end
and both a leap and a common February.

**What is needed:** confirmation that forecasting is monthly and calendar-aligned, or a fiscal calendar to
read from. The Action already accepts an explicit `PeriodStart`/`PeriodEnd` pair, so a caller who knows
better can override it today — both or neither, never one.

> **UPDATE (golive#232) — half of this is now answered, and the half that matters is not.**
>
> "A fiscal calendar to read from" exists after all, one app over:
> `__mj_BizAppsAccounting.AccountingCompanyProfile.FiscalYearStartMonth` / `FiscalYearStartDay`,
> per-company, which `JournalEntryEntityServer.deriveFiscalYear()` has been reading all along. The
> dashboard's new period selector reads it (`docs/DECISIONS.md` D-FY1), so the claim above — that
> nothing anywhere says when a year begins — was true of *sales* and never true of the workspace.
>
> **What stays open is the question this entry was actually asking:** whether forecasting is MONTHLY.
> A fiscal year start fixes where a year begins; it says nothing about whether a snapshot should be
> captured per month, per quarter or per fiscal year, and `CurrentMonthPeriod()` is a claim about the
> second. So `ForecastSnapshotJob` is deliberately unchanged here.
>
> It should not be changed casually when it is: `ForecastSnapshot.PeriodStart`/`PeriodEnd` are stored
> on every captured row, so moving the boundary re-files history against windows the existing rows
> were never captured for, and four checks in `packages/IntegrationTests/src/checks/forecast.checks.ts`
> assert the month boundary directly.

---

## D-29 · DECIDED: a same-day re-run skips, rather than replaces, a capture

`ForecastSnapshot` has no unique index, correctly: the table is a series, and `CapturedAt` keeps "what
did we think on the 1st" answerable. To stop a double run adding two captures minutes apart,
`ForecastSnapshotJob` skips a grain already captured today and counts it.

**Skip, not replace.** `scripts/capture-forecast-snapshot.sql` replaces instead, arguing that duplicate
captures double every movement calculation in `forecast-history.sql`, whose `LAG` windows step by
`CapturedAt`. That is true and does not discriminate: both leave one row per day. What decides is what
`CapturedAt` is for, which holds only if the first capture survives. A replace rewrites recorded
history and leaves nothing to notice; a duplicate is at least visible.

`FS3` asserts that a second capture carrying a different figure leaves the original standing. Intra-day
movement, if it is ever wanted, needs both this guard and the daily schedule changed.

---

## D-30 · Two forecast sources could disagree and nothing would notice

`IForecastSource` returns rows for a period, and the writer stores them. Nothing validates that a
company-wide row equals the sum of its per-pipeline rows, or that `CommitAmount <= BestCaseAmount`.

**Deliberate.** Sales does not compute these, so it cannot check them without computing them — and a
reconciliation here would be a second implementation of the measures, which is exactly what routing them
through a query was meant to avoid. If the query says commit exceeds best case, that is the query's answer
and this app is not the place to argue.

**But it means a wrong query produces confident-looking rows**, and the only signal is `SnapshotJSON`
naming the source. Worth knowing before somebody reads a forecast series as verified.

**What is needed:** a decision on whether the measures get their own sanity assertions somewhere — most
naturally as checks against the queries themselves, on the session that owns them, rather than here.

---

## D-31 · DECIDED: one writer for `ForecastSnapshot`, and it is the Action

On `a2abcfd`, the first tree carrying both, two writers existed: the `Sales.CaptureForecastSnapshot`
Action on a seeded daily `ScheduledJob`, and `scripts/capture-forecast-snapshot.sql`, which nothing
ran. They differ in grain (the script adds the owner) and in a same-day re-run (the script replaces;
the Action skips, D-29).

**Ruling: the Action is the writer.** The script stays as an unseeded manual tool, because it is the
only per-owner capture and shows what an owner-grain source must project (D-32). Its header now says so
first, and three claims in it were corrected: that a nightly job ran it (none was ever seeded), that a
plain script was chosen over an Action (written before the Action existed), and its replace-on-re-run
behaviour, now marked as losing to D-29. Running both would make `ForecastSnapshot` mean different
things on different days.

The Action reads `Sales: Forecast by Owner` by default; see D-32.

---

## D-32 · BUILT: the daily snapshot reads `Sales: Forecast by Owner` by default

`forecast-history.sql` partitions its `LAG` windows by `OwnerEmployeeID` and joins `Employee` for an
owner name, so it expects owner-grained rows. `Sales: Forecast by Category` groups by company and
pipeline only, so a snapshot read from it carries `OwnerEmployeeID = null`, meaning "across all owners"
(asserted by `FS11`), and the history renders thin rather than broken.

**A companion query, not a reshape.** `Sales: Forecast by Category` is published and the dashboard reads
it, so the owner grain belongs in a second query rather than in a changed row shape:
`Sales: Forecast by Owner` (172a6d8) projects `CompanyID`, `PipelineID` and `OwnerEmployeeID`.

**Built (#216):** until then nothing pointed the capture at it. The source factory defaulted to none,
only tests replaced it, and the daily job reported success while writing nothing. The factory's default
in `ForecastSnapshotJob.ts` now returns a `QueryForecastSource` for `DEFAULT_FORECAST_QUERY`
(`Sales: Forecast by Owner`). It is set in the package rather than at server startup, so MJAPI and the
integration checks capture through the same source. `FS13` asserts the default by name; `FS15` runs the
default path and compares the stored rows to the query's own, by company, pipeline and owner.

---

## D-33 · `Sales: Forecast by Category` places open and won deals on different date columns

Not a defect — the query documents it — but it changes what a snapshot's period means, and anyone reading
`ForecastSnapshot.PeriodStart`/`PeriodEnd` should know.

Open deals are filtered on `ExpectedCloseDate`; won deals on `ActualCloseDate`. So one snapshot row mixes
two date dimensions: `CommitAmount`/`BestCaseAmount`/`PipelineAmount` describe deals *expected* to land in
the window, while `ClosedWonAmount` describes deals that *actually* landed in it. The query's own comment
says so and gives the reason — "each row uses the date that actually answers its question" — which is
right for a forecast review reading attainment against the same window.

The consequence for the stored snapshot is that `PeriodStart`/`PeriodEnd` are not one filter over one
column, and a consumer computing anything across the four amounts is combining two populations. Nothing
does today.

**Verified on the demo data:** `ExpectedCloseDate` spans 2026-07-15 → 2026-11-30 and `ActualCloseDate`
spans 2026-07-14 → 2026-07-28, so the two dimensions genuinely differ in range — a period covering only
August would report pipeline figures and zero closed, which is correct and could easily be read as a
capture failure.

**What is needed:** nothing in code. It belongs in whatever documents the snapshot table, so the first
person to see a zero `ClosedAmount` beside a large `PipelineAmount` does not treat it as a bug.

---

## DN-23 — DECIDED: the `PipelineStageID` trigger has ONE writer now, and the phase is DECLARED

*Numbered DN-16 until 2026-10-11.*

**Decided here, not deferred**, because the alternative was a fifth clause on a gate nobody could read
whole. Recorded because the shape is a precedent, not because anything is outstanding.

**The state that prompted it.** Four separate pieces of code wrote to the stage log or keyed off the stage
changing: `DealEntityServer`'s event appender and its stage-defaults applier, plus `Sales.CloseDeal` and
`Sales.ReopenDeal`, each hand-writing a `DealStageEvent` and then moving the stage. Every one was correct
read alone. Read together they produced three defects, and all three had the same cause — a decision taken
in four places with no shared statement of what it depended on:

- a close or reopen that named a stage wrote **two rows for one transition**, into an append-only log;
- one of the three comparisons was **case-sensitive**, so a caller that normalised its GUIDs was recorded
  as moving a deal to the stage it was already in;
- a reopen naming a stage **silently invoked the defaults writer**, re-deriving a probability the reopen's
  own event had just stamped.

**The ruling.** `DealStageEvent` has exactly one writer — `DealEntityServer.appendStageEvent`. A caller
that owns a governed transition calls `DeclareTransition(kind, note)` and supplies only what the entity
cannot derive: the note. The entity then answers both questions once — *is an event owed* (yes if the stage
moved, and yes if a transition is declared, which is what preserves a status-only close) and *do the
stage's defaults apply* (no on a declared transition, because that probability is a human's figure).

**Why declaring beats a flag.** A flag says "skip the defaults"; a declaration says *what is happening*,
and the entity decides what follows from it. The next phase — a re-forecast, a bulk stage migration — adds
a kind and states its consequences in one place, instead of a fifth clause on a gate that four callers each
have to reason about correctly.

**The generalisation underneath it, which was a separate defect in two more places.** "Is this value the
caller's, or mine to fill?" now lives in `callerSuppliedValue()`. On an update the answer is `Dirty`; on a
create `Dirty` is *useless* — a first assignment does not mark a field dirty, and the first write becomes
the `OldValue`. `applyStageDefaults` knew this; `planStageEvent` and `ownerStampEditRefusal` did not, and
both were wrong in the same direction. See `save-deal.SD30`–`SD32` and `close-deal.CD15`–`CD16`, and
`M-ST1`–`M-ST4` / `M-OW2` for the mutants that prove they can fail.

**What is worth knowing before extending this.** `close-deal.CD1`–`CD14` never passed `ClosingStageID`, so
fourteen checks watched the close path while the input that makes it move a stage went unexercised for a
whole phase. When adding an operation input, the question to ask is not "is it covered" but "does any check
actually SUPPLY it".

---

## DN-17 — ✅ FIXED — A rep's FIRST line was written to an orphan order

**Fixed 2026-08-21 in `DealEntity.Save()`; `79-embedded-order-refresh.spec.ts` is green and was proven
able to fail.** The record below is kept because the diagnosis was wrong twice before it was right, and
the wrong versions are the instructive part.

**Found by the Explorer pass on 2026-08-21, in a browser, on the primary create path. This is OUR bug,
in this repo, and it loses data a rep entered.** Filed here rather than in `KNOWN-ISSUES.md` because
that file is for things this repo cannot fix, and this is squarely ours.

### What happens

1. A rep creates a deal and saves. `DealEntityServer.Save()` provisions the embedded `OrderHeader` and
   writes `Deal.OrderID` — server-side.
2. Without leaving the tab, the rep opens **Product lines**, adds a line, picks a product, states a
   quantity, and saves. The Save button is enabled; validation passes; no error appears; the workspace
   reports success.
3. **The line is not on the deal's order.** It is on a SECOND `OrderHeader` that nothing references.
   `Deal.OrderID` still points at the empty provisioned order, so the workspace shows no lines,
   `Deal.Amount` can never be refreshed from what the rep entered, and orders is left holding an orphan
   with real priced rows in it.

### Why — and the first answer was WRONG in a way worth keeping

The original write-up said *"`OrderID` is now written by the server and the client instance never learns
it."* **That is false, and measuring it is what produced the real fix.** Read through Angular's dev hooks
immediately after a create, the client holds `OrderID = DA871180-…`, exactly matching the row on disk. The
framework already keeps `Save()`'s promise for the FIELD.

What it does not carry is the **companion**. `EmbeddedRecord` gates `Value` on a private `exposed` flag,
and only three things set it: `Ensure()`, `LoadEager()` (called from `InnerLoad`), and `Deserialize()` of a
wire payload. A header-only create reaches none of them:

- `OnOwnerNewRecord` leaves a **nullable** FK unexposed — correct, there is no order yet.
- The companion payload travels only on the `MJ.SaveEntityGraph` remote operation, and `BaseEntity.Save()`
  routes there only when `plan.NodeCount > 1`. A deal saved with no lines and no instalments is **one
  node**, so the ordinary mutation runs and no companion comes back. *This is why the bug hid: a rep who
  adds a line before the first save makes that save multi-node, and it works.*
- `LoadEager` runs from `InnerLoad`, and a create never loads.

So `OrderID` pointed at a real order while `OrderID_Object` was null, and `OrderID_EnsureObject()`
concluded there was no order and minted one. Both halves behaved as designed; nothing owned the gap.

**This is the same defect class as the `CloseWonTaskService` call site fixed in `07dc10e`** — a caller
reading `deal.OrderID` around a `Save()` that now provisions it. That one was server-side and a check
caught it. This one is only reachable across the wire.

### Measured, not inferred

Four probe runs, each adding one line straight after create: **zero** `OrderLine` rows on `Deal.OrderID`
every time, and four orphan `OrderHeader` rows (ORD-000069, 72, 74, 77). Inserting a reload at exactly
that point made the identical line persist onto the deal's own order, priced by orders at 229. The
contrast between those two runs is the whole diagnosis. All probe rows were removed afterwards and the
host is back to 7 deals / 57 orders / 63 lines.

### Why 108 green integration checks did not see it

They drive the entity graph **in process**, where the server's `Save()` sets `this.OrderID` on the very
instance the check then reads. There is no serialization boundary, so the value is always present.
`SD24` asserts an existing deal gets an order on its next save and is correct; it cannot see this.

### The fix as APPLIED, and why this one of the three

Three options were on the table: reload after save; give `DeclareEmbeddedRecord` a load policy; or have
the save path put the server-written `OrderID` onto the instance.

**The third turned out to be already done** — the field does come back, as measured above. So the only
thing left to restore was the companion, and it is fixed in `DealEntity.Save()`:

```ts
const saved = await super.Save(options);
if (saved && this.OrderID && !this.OrderID_Object) {
    await this.OrderID_LoadObject();   // LoadEager from the persisted FK
}
```

- **In the ENTITY, not the workspace.** The workspace is the surface that happened to find it; the board,
  a client-side Action and an importer all reach the same state through plain `entity.Save()`. "My FK and
  my peer agree" belongs on the entity, so it is fixed once for every caller.
- **The guard is the design.** `this.OrderID && !this.OrderID_Object` fires in exactly the broken case: a
  deal whose peer is already exposed (every server-side save, and every client save that took the graph
  path) skips it, so it costs nothing and cannot clobber a peer holding unsaved edits. `DealEntityServer`
  reaches it through `super.Save()` with the peer exposed by `provisionEmbeddedOrder()`, so the server path
  is a no-op by construction rather than by luck.
- **NOT a reload.** `Save()`'s comment is right that the instance should become an edit of a real record;
  reloading would have conceded the point instead of restoring it.

**The general fix still belongs upstream.** `DeclareEmbeddedRecord` has no load policy, so no declaration
can say "resolve this peer from a persisted FK", and `Ensure()` cannot help — its own comment rightly says
re-attachment "is not Ensure's job". Every app that embeds a record on a **nullable** FK will meet this,
and each will fix it in its own entity. Worth proposing to MJ as either a load policy on the declaration
or a post-save companion sync in `BaseEntity`. Recorded here as an upstream ask, not worked around twice.

Whichever is chosen, the comment in `Save()` must change with it — it is currently the reason the bug
looks intentional.

### The tripwire, and the workaround that was deleted with the fix

- `79-embedded-order-refresh.spec.ts` is **green**, and proven able to fail: reverting the guard to
  `if (false && …)`, rebuilding and re-running reports `Expected: 1, Received: 0` on the line assertion —
  the original symptom exactly.
- `ComposeDeal`'s roster reload, added to get the other specs past this, is **removed**. Keeping it would
  have masked a DN-17 regression in every spec except 79. `ComposeDealWithoutReload` is gone with it.
- The fix also unblocked `70-lifecycle` and `78-line-removal-tripwire`, both of which had been failing on
  line persistence and are now green.

### One more thing this exposed

**The harness teardown cannot clean up after this defect.** It deletes orders reachable from a
`PW-VERIFY%` deal, and an orphan is reachable from nothing. The four orphans had to be removed by hand.
Any run that hits this leaks an order.

---

## DN-18 — RESOLVED: a reopen restores the stage, and asks for the order back

Found by `71-lost-and-reopen` on 2026-08-21. Close a deal as lost into a stage declaring
`OrderStatusOnEntry = 'Voided'`, reopen it, and the order stayed `Voided` with nothing on screen saying
so: a deal that looks workable, pointing at an order that cannot be revived. The order-status writer
keys on the stage changing, and neither the browser's close nor its reopen moved the stage. The first
write-up blamed orders for refusing to un-void; orders never refused, which is why nothing was
reported.

Resolved in three parts:

- **The reopen restores the prior stage.** With no `StageID`, `Sales.ReopenDeal` lands on the close
  event's `DealStageEvent.FromStageID` (`close-deal.CD18`, mutants `M-RO1` and `M-RO2`). `CD19` pins the
  status-only close, where there is nothing to restore.
- **The close moves the stage.** With no `ClosingStageID`, `Sales.CloseDeal` moves into the stage whose
  declared status matches the outcome (`CD22`, mutant `M-CS1`), so a close from the browser leaves the
  reopen something to restore. `SD35` and `CD17` keep the closing status authoritative when it does.
- **The order comes back.** `Voided` is not terminal in orders, so after the stage plan a reopen returns
  a voided, unbooked order to `Draft` (`docs/DECISIONS.md` D-OS4, `CD31`, `CD33`). A refusal orders does
  make still reaches the rep as a warning.

---

## DN-19 — CAUSE FOUND (#188): the "intermittent" wrong id after an inline create happens on every IsA create

Found while diagnosing `72-inline-create` on 2026-08-21. A customer created from the slide-in was bound
to an id present in neither `Organization` nor `SalesAccount`, while the row was written under another
id. The picker showed the right name, so the deal pointed at nothing behind a form that looked
finished. It reproduced on one run in three.

**The cause, found on 2026-10-06 (#188).** MJ 6.1.4 creates an IsA child over GraphQL without sending
its key: the client mints one, the server mints another and writes both tables under it, and the client
goes on reporting its own. That happens on every create. It looked intermittent because the picker
usually recovers the real row by its name, and binds nothing only when its reload has not caught up.
`SalesContact` and `Person` have the same shape.

**Workaround removed (#207).** Sales used to rebind an inline-created customer or contact to the key it
was written under (the deal form's party fields), and to bind only an id it could show exists (the deal
workspace, since deleted in #291). Both are gone because MJ 6.1.6 sends the written key on an IsA create,
so the key the browser reports is the one in the database. The server still refuses a deal whose
customer does not exist, which also covers a pick from a stale list. A new deal that still will not save
after an inline create is #202.

---

## DN-20 — BUILT: a reopen is refused once the order has booked

Raised by Finance: once the order has booked, the ledger has moved, and the instrument is an
order-side one rather than an edited deal. Built on 2026-08-24 (35eb8f5) as a fifth refusal in
`Sales.ReopenDeal`, before its transaction opens (`CloseDealOperation.ts`, "A BOOKED ORDER REFUSES THE
REOPEN OUTRIGHT").

- **It reads orders' own `IsBooked`** rather than restating the rule. When this was built that meant
  `Confirmed`, `Posted` or `Fulfilled`; since orders collapsed its lifecycle (KI-27) it means
  `Confirmed`. A `ConfirmedAt IS NOT NULL` test would also refuse an order confirmed and later voided,
  which CD24 asserts is allowed.
- **The message names the order and hands off to orders.** It names no remedy, because the right
  instrument depends on the order's status and is orders' to say.
- **An unreadable order is refused too**, since its ledger state is unknown.

`close-deal.CD24` asserts both directions, and mutants `M-RB1` and `M-RB2` prove it can fail.

---

## DN-28 — OPEN: a parked status does not survive a later stage move

*Numbered DN-21 until 2026-10-11, as "REPORT ONLY: does `SelectableStatuses()` still need to offer
anything?"*

**Where this stands.** The workspace picker below is no longer mounted; the deal form's status control
offers every status, and a locking pick runs the close (`close-deal.CD27`). The question that stands is
the write path's, in the recommendation: a parked status is overwritten by the next stage move.

Asked while deriving the deal's status from its stage, and **not changed** — this is a UI question.

Today:

```ts
public SelectableStatuses(): DealStatusLookup[] {
    return this.Lookups.DealStatusTypes.filter((s) => !s.IsWon && !s.IsLost);
}
```

With the status derived from the stage, the Status select's remaining job is narrow. On the seeded
vocabulary it offers exactly two rows — the open status every stage already declares, and `On Hold`
(`IsOpen = 0`, `IsWon = 0`, `IsLost = 0`, `LocksDeal = 0`), which no stage declares. So:

- **The open option is now redundant**: picking it re-states what the stage would have filled anyway.
- **`On Hold` is the only thing the picker adds** — a deliberate parking state that is not a close and
  belongs to no stage. That is a real capability and the argument for keeping the control.

Three options, in the order I would consider them:

1. **Keep it, and let it mean "override the stage".** Cheapest, and it is already how it behaves. But an
   open deal now shows a control whose only useful setting is a state most reps will never want.
2. **Offer only the statuses no stage declares.** The picker becomes "park this deal", which is what it is
   actually for once the stage supplies the norm. Needs a label change, not just a filter.
3. **Remove it from the header** and surface parking as an explicit action. Truest to "the stage declares
   the status", and the most work.

Worth noting for whoever decides: a status set through this control survives only until the next stage
move, because `callerSuppliedValue` is per-save (see the note in `applyStageDefaults`). If parking is meant
to be sticky across stage moves, that is a different mechanism — a flag on the deal, not a status.

### RECOMMENDATION (2026-08-21) — the per-save note above is not a footnote, it decides the question

Asked to recommend rather than build. Nothing below is implemented.

**The question "is parking a status or an action" is already answered by the write path, and the answer is
that it is not a status — not today.** Verified in the merged tree rather than inferred:

`DealEntityServer.applyStageDefaults()` re-derives `DealStatusTypeID` from the arriving stage whenever
`callerSuppliedValue('DealStatusTypeID', …)` is false, and on a saved deal that function is exactly
`GetFieldByName('DealStatusTypeID')?.Dirty` — dirty **in this save**. So:

1. A rep picks `On Hold`. The field is dirty, the stage stands down, `On Hold` persists. Correct.
2. Anyone later moves the stage — a workspace stage picker, a board drag, an importer, an agent, a plain
   `BaseEntity.Save()`. In that save the status is not dirty, so the arriving stage's declared status
   overwrites `On Hold`.

**A rep who parks a deal and then drags its card has silently un-parked it.** No message, no refusal, no
issue on the result. The one trace is `DealStageEvent.FromDealStatusTypeID = On Hold` beside
`ToDealStatusTypeID = <open>` — so it is auditable after the fact and invisible at the time, which is the
worse half of that pair.

**The existing check already says this out loud.** `save-deal.SD34` is titled *"a status the caller STATED
survives a stage move **in the same save**"*, and it picks its status by flag — not open, not won, not
lost, not locking — which on the seeded vocabulary is `On Hold` itself. So the guarantee is scoped
correctly and honestly, and there is no check for surviving a LATER move because there is no such
behaviour. That gap is a true reflection of the code, not an oversight in the suite.

**One comment in the source needs correcting whichever way this is decided.** `applyStageDefaults` says
status re-derivation's *"observable effect is nil until somebody seeds two different open statuses across
one pipeline's stages."* `On Hold` is not an open status — `IsOpen: false, IsClosed: false`, deliberately
neither, per its own seeded description — and it is seeded now. The effect is therefore observable today,
through the one control this DN is about.

#### The root cause, stated once

**A deal has nowhere to record that its status was CHOSEN rather than DERIVED.** `Dirty` is a proxy for
that intent which survives exactly one save. Every option below is a different answer to where that bit
lives.

| | Where "chosen" lives | Cost | What it gets wrong |
|---|---|---|---|
| **A** | a `Parked` flag/column on `Deal` | new column, new vocabulary question, rollups updated | two places now describe one state; `On Hold` either retires or becomes a derived read |
| **B** | inferred: *no stage declares this status* | one predicate in `applyStageDefaults` | cannot express "the rep deliberately chose the OPEN status"; needs an explicit un-park |
| **C** | an explicit `DealStatusIsOverridden` bit | one column, one guard | says exactly what is meant and costs a migration |

**Recommended: B, with option 2 from the list above.** Two reasons it is more than the cheap answer.

*It makes the picker and the write path agree by construction.* Option 2 filters the control down to
"statuses no stage declares", which is precisely the set B would protect. The filter that makes the
control meaningful and the predicate that makes parking stick are the same sentence, so they cannot drift
apart. Under A or C the picker's contents and the write path's rule remain two independent decisions.

*It stays inside rule 2.* "Does any stage in this pipeline declare this status" is a query against
`PipelineStage.DealStatusTypeID` — data, not a name comparison, and no new flag to seed. A and C both add
a column that then needs its own answer to "what does a rollup asking *still live* do with it".

**The wrinkle B has and the others do not, stated plainly:** un-parking becomes an act the rep has to
perform, because a parked deal no longer follows its stage. The control therefore cannot offer *only*
undeclared statuses — it needs a "follow the stage" entry that clears the override back to derived. That
is a third state in a two-state control, and it is the part of B most likely to feel awkward in the UI. If
that reads badly enough to reject, **C is the honest fallback**: it is the same behaviour with the
override made explicit instead of inferred, at the price of a migration.

**Do not pick option 1** (keep it, let it mean "override the stage"). It is the only option that leaves
the current defect in place, because "override" is exactly what it does not do past the next save. It also
reads as a decision when it is the absence of one.

**Whichever is chosen, it needs a check the suite does not have:** park a deal, move its stage in a
SEPARATE save, and assert the status. Today that check would go red, which is the point — it is the
regression this DN exists to prevent, and `SD34` proves only the same-save half. Name it by flags, as
`SD34` does, so it survives a vocabulary rename.

**Out of scope on purpose:** the redundant open row can be dropped from the picker today under any of the
three, since the stage fills it either way. That is a one-line filter and does not need this decision.

---

## DN-22 — SD25 and AC9: measured, and NEITHER is what the hypothesis said

**Investigated 2026-08-21 after both appeared in two consecutive full-suite captures. Ten runs across
four conditions. Neither reproduced once.** Recorded because a failure that will not reproduce is a
standing tax on every future red, and the next person should start from these measurements rather than
repeat them.

### What was measured

| Condition | Runs | Result |
|---|---|---|
| `activities` bundle alone | 3 | 22/22 every time |
| `save-deal` + `activities` | 2 | 53/53 both — **SD25 green** |
| `close-won-tasks` + `activities` | 2 | 36/36 both |
| Full suite, quiet host | 4 | 121/0 ×3 at 90–91s; 120/1 once (AC3) at 93s |
| Full suite immediately after a Playwright run | 1 | 121/0 at 95s |
| Full suite under a concurrent full `turbo build` | 1 | 121/0 at 102s |

**AC9 never failed again. SD25 never failed again.** They failed together in the two captures taken
earlier the same day, which is what made them look like the two real ones.

### The watermark hypothesis is DISPROVED, not merely unconfirmed

The reasoning was that AC9 asserts a watermark, a watermark is persistent cross-run state, so its starting
conditions are what a teardown change would alter. Reading the check settles it the other way:

- `AC9` runs inside `InRolledBackTransaction` and creates its OWN connection via `makeConnection(ctx, null)`.
  The watermark it advances belongs to a row it just made and which is rolled back.
- The host carries **zero** residue to be state-dependent on: `Activity` = 0,
  `ActivitySyncConnection` = 0, `ActivitySyncRule` = 0.

So there is no cross-run watermark for a sweep to perturb.

### And the sweep is not implicated either

The caution was right that the sweep lives in the Playwright harness and can only touch the integration
checks when a Playwright run falls between two captures — which is exactly what happened. So it was
tested directly: a Playwright run (whose global teardown invokes the sweep) followed immediately by a full
capture came back **121/0**. One trial, so not conclusive, but it is evidence against rather than for.

### What the evidence does point at, and the gap in it

Every run measured here sat in the **fast band, 90–102s**, and every one was clean or lost a single check.
The two sessions that characterised this host found the bad runs take **170–187s against ~120s**. So the
correlation with duration holds in my data too, from the other end: I never observed a slow run, and I
never reproduced a multi-check failure.

**The gap is mine: I did not time the bad captures.** The failing counts (4, 6, 11) are recorded and their
durations are not, so I cannot put those runs in a band. That is the one thing a repeat of this
investigation must not do.

`test-harnesses/integration.mjs` now prints the run duration on every invocation, and prints an explicit
warning when a run BOTH fails and exceeds 150s. That turns the discriminator from something argued from
memory into something on the same line as the red.

### Calibration, added 2026-08-21 evening

**The floor moves about 30% between conditions both called quiet** — 90–91s earlier in the day, 63s that
evening, same machine, same person's judgement of "nothing else running". So the duration reported by the
harness is currently only good for COMPARATIVE use: this run against the next, in one session.

Two bands are defensible and nothing between them is: **over ~150s with a failure** has correlated with the
multi-check red, and **60–102s** has correlated with clean. Reading a 130s run as "slow" would be inventing
a threshold rather than reporting one. The 150s warning in `integration.mjs` sits clear of both observed
bands deliberately, and the note in that file says so.

### What to do with SD25 specifically

Another session watched it lose to a deadlock repeatedly on the same day. It is the write-heaviest check in
the write-heaviest bundle — it provisions a deal and reads the order back — so it is the most likely victim
of contention rather than the cause of anything. It passed in all six full runs and both `save-deal` pair
runs here. **Do not change it on the strength of the two captures**; if it recurs, capture the duration and
check `sys.dm_tran_locks` / the deadlock graph while it is failing, because "deadlock victim" is a claim
about the other transaction, not about this check.
