# DECISIONS NEEDED

Choices made where a second reading was defensible. Each one was **decided and implemented** — the rule
was "if two options are equally defensible, take the one that touches fewer files, record the other here,
and move on." So none of these blocks anything; they are here so the rejected option is visible rather
than lost.

Anything genuinely undecidable without Josue or Amith is marked **OPEN**.

## TWO NUMBERING SCHEMES, DELIBERATELY NOT RECONCILED

This file was written twice, independently, on two branches that had not met: `DN-n` on
`feature/embed-order-on-deal`, and `D-n` on `feature/closewon-tasks` (raised while rewriting the demo
seed and assessing the pipeline-board rebase). Both are kept, under their original numbers.

**Renumbering would have been the tidier merge and the wrong one.** These identifiers are cited from
commit messages, from code comments and from `docs/DECISIONS.md`, none of which a renumber can reach —
so a tidy file would have silently invalidated every reference pointing into it. Two prefixes is a
smaller cost than a corpus of dangling citations.

They are not duplicates of each other. Where they touch the same subject they reached the same answer
from different directions, and both readings are worth having: `DN-11` and `D-1` are both about which
stage means "agreement or higher", and `D-3` and this audit's backlog both flag
`Pipeline.RequiresDealLines` as the last surviving echo of a retired table.

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

## DN-3 — The two-level save graph: insert and edit work, REMOVE does not

**Taken:** rewrote SD6, SD13 and SD14 against `deal.OrderID_Object.Lines` — the collection belongs to the
deal's **embedded order**, while `Save()` is still issued on the **deal**. Then ran them, which is the
part that mattered.

**Result — and the first draft of this entry guessed it wrong, which is why the run happened:**

| Verb | Through `deal.Save()` | Check |
|---|---|---|
| INSERT | ✅ | SD1, SD19, SD20 |
| EDIT | ✅ | SD14 |
| **REMOVE** | ❌ **silently dropped, save returns true** | SD6, now a tripwire |

So an embedded record DOES join the parent's save plan — for two verbs out of three. The third is
**KI-20**, and it is not about embedding at all: the same removal fails through `order.Save()` too, while
removing one of the deal's OWN instalments deletes fine. `test-harnesses/prove-line-removal.mjs` prints
that whole matrix, including the control, and cleans up after itself.

**Cause, located:** `OrderEntityServer.Save()` in bizapps-orders passes `SkipRelatedCollections: true`
(correctly — lines must not insert before they are priced) and its hand-rolled `savePendingLines()`
iterates `this.Lines.Items`. Inserts and updates, off the survivors. Nothing ever asks the collection for
its pending removals.

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

## DN-5 — OPEN: the header roll-up is still unasserted

The §6 definition-of-done check — `Deal.Amount` for a lined deal equals what `Orders.PreviewOrder`
returns for the same draft — is **still not built**, and the rework changed its shape rather than
removing it. The per-line half is covered by SD19. What nothing asserts is the deal-level number:
`Deal.Amount`, `AmountIsComputed`, `AmountComputedAt`, `AmountSourceHash`.

**The question for Josue/Amith:** with the order embedded and orders owning every line figure, is
`Deal.Amount` still a cached PreviewOrder answer with provenance — or is it now simply a read-through of
the order's total, making the three provenance columns dead weight? The answer decides whether that
check gets written or those columns get dropped. Not something to infer from the code.

---

## DN-6 — OPEN, and the one worth waking up to: who fixes KI-20?

**The user-visible consequence:** the deal workspace's delete-line affordance does not work. A rep removes
a line, the row disappears from the grid, the save reports success — and the line is back on reload. This
is in sales' own UI, on a surface that is part of the demo.

Nothing was changed to work around it tonight. Three options, and the choice is not mine to make:

**A. Fix it in bizapps-orders** — `savePendingLines()` (or `persistPreparedLines()`) processes the
collection's pending deletions. Correct place, one app, one method, and it fixes every consumer rather
than just sales. Needs care: it is the booking path, and trigger 51003 freezes a line on a Confirmed
order, so the deletion has to be scoped to the states where it is legal. **My recommendation.**

**B. Work around it in sales** — `DealWorkspaceService` deletes the removed line rows itself. Fast, and
entirely inside this repo. Rejected as a default because it puts a second app in charge of deleting
orders' rows and would silently duplicate whatever rule orders eventually writes. Also does nothing for
any other caller.

**C. Leave it** — SD6 stays a tripwire, the delete affordance stays broken, KI-20 stays open. Defensible
only if line deletion is not in the near-term demo path.

**Why this is not a judgement call I made unilaterally:** option A is a change in another repo, tonight's
brief scopes me to this one, and my one previous rebuild of orders disrupted a second instance's checks.
Option B is a change I could have made and deliberately did not, because it is the kind of workaround that
is very hard to remove later.

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

## DN-8 — OPEN: the deal workspace cannot reopen a deal, and the fix is in another repo

**Explorer pass, 2026-08-20.** Creating a deal works; its order is provisioned; the numbers land in the
database. **Reopening it does not** — and since every deal now has an order, that is every deal.

Two causes, found in sequence, both outside this repo. Full detail in `docs/KNOWN-ISSUES.md`:

* **KI-21 — orders was never installed as an Open App on this host.** Its schema was migrated and its
  entities registered, but `mj.config.cjs` → `dynamicPackages.server[]` listed only sales, so orders'
  resolvers never entered the GraphQL schema. **Fixed locally** by adding the entry by hand; the proper
  fix is `mj app install` for bizapps-orders. This one matters for the AWS install: a dependency
  declaration in `mj-app.json` does not make a host register that dependency's server package.
* **KI-22 — orders' generated resolvers are behind the database.** ⚠️ **UPDATED 2026-08-20 — see DN-14; the fix below was tried and does not work.** `vwOrderHeaders` and `EntityField`
  both carry `RootReversesOrderHeaderID` (MJ's recursive-hierarchy column for the self-referencing
  `ReversesOrderHeaderID`); orders' committed generated code does not. The client builds its selection
  set from metadata, so every Order Header read asks for a field the schema lacks. **NOT fixed.**

**The decision:** re-running orders' CodeGen file pass and rebuilding it (`npm run mj:codegen:files &&
npm run build` in bizapps-orders) is almost certainly all it takes. It was not run because it is another
repo, on a database shared with a second working session, and CLAUDE.md records a measured case of a
second CodeGen pass corrupting a database. That is a call for Josue, in the morning, with the stack quiet
— not something to do unattended at 07:40.

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

**Still unverified**, because DN-8 blocks it: that adding a line to an ALREADY-SAVED deal now works
end-to-end through the UI. The blocker was identified from metadata (`CompanyID` was the only line-level
refusal; `UnitPrice` initialises to 0 and does not trip validation), and `save-deal.SD19` covers the same
write through the entity layer — but the UI path itself has not been seen green. **It is the first thing
to re-check once KI-22 is fixed.**

---

## DN-10 — OPEN, and it is one field: which stage carries `Confirmed`?

Andrew's normative sentence says Proposal or higher **"including Closed Won"** is `Quoted`. A later
example in the same message says Closed Won → `Confirmed`. We asked which he intends and proceeded with
**`Quoted` on the winning stage**, per the instruction to assume and note.

**Why it is not a coin toss.** `Confirmed` is the irreversible step in orders: it books journal entries
(their D8), freezes every line with trigger 51003, and is reachable only forward or to `Voided`
afterwards. Seeding it on the winning stage means **a rep dragging a card to Closed Won posts to the
ledger**. That may be exactly what Andrew wants — back-office entry does confirm directly — but it is a
different sentence from "a quote becomes a signed quote", and the two readings are one seeded field
apart.

`Confirmed` is therefore seeded **nowhere** today. To change it:

```sql
UPDATE __mj_BizAppsSales.PipelineStage SET OrderStatusOnEntry = N'Confirmed' WHERE Code = 'SIGNED';
```

plus the matching literal in `scripts/seed-demo-data.sh`. The code needs no change — that is the point of
D-OS1. CO3 and CO5 assert the MECHANISM and stay green either way, which is why they were reframed.

---

## DN-11 — `OneTimeLinesTo` is the last dead key in `CloseWonPolicy`

`OrderState` is gone from the published input contract. `OneTimeLinesTo` is equally dead — it steered
one-time lines to the Order route, and close-won creates no order — but it is still declared, still
defaulted to `'None'`, and still in both seeded policy JSONs.

It was left because Andrew's ruling named `OrderState` and narrowing a published remote-operation
contract is its own decision. Removing it is a five-minute change of exactly the shape just completed.
**A deployment setting it is configuring nothing**, which is the argument for removing it rather than
documenting it.

**Three more joined it on 2026-08-20**, from the v6 contracts-seam merge:
`ContractsCreateFromDealSeamInput` still declares `BillingFrequency`, `CommittedAmount` and `Lines`, and
`buildContractInput()` no longer sends any of them. They were `ContractTerm` and `ContractLine` columns,
and contracts deleted both tables — so unlike `OneTimeLinesTo` these have nowhere to go rather than
merely being unread. Same decision, four fields now: narrow the seam shape in one pass, or leave it
documented. Leaving it has a real cost — a reader of the interface reasonably concludes sales can send a
committed amount, and it cannot.

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

## DN-14 — ROOT CAUSE FOUND (2026-08-20). Was: KI-22 is an INSTALL problem, not a CodeGen one

DN-8 said orders' CodeGen files pass was "almost certainly all it takes". **It was tried, twice, and it
is not.** Full detail in `docs/KNOWN-ISSUES.md` KI-22; the short version:

* Round 1 (files only) restored `RootReversesOrderHeaderID` and **removed**
  `OrderHeaderEntity.InitialPaymentDetailID_Object`. `orders-entities` stopped compiling.
* Round 2 (after setting the missing `EntityField.EmbeddedRecord` rows by hand) restored the embeds and
  produced a **self-import** in `entity_subclasses.ts` plus the loss of `OrderHeader.Lines`.

Everything was restored — orders' generated files to HEAD, the seven metadata rows to NULL — and orders
builds again with its `dist` matching its committed source. A full database backup was taken first and
still exists: `/var/opt/mssql/data/MJ_V6_Host_pre_orderstatusonentry.bak`.

**What this establishes:** MJ_V6_Host is missing at least three classes of orders' metadata —
`EntityField.EmbeddedRecord` (zero rows host-wide), `RelatedRecordCollection` (`OrderHeader.Lines`), and
whatever drives `entityPackageName`. No regeneration against this host can reproduce orders' committed
code, because the host was never given orders' metadata. `mj sync push --dir metadata` in bizapps-orders
gets 14 of 23 directories in and stops on a missing `MJ: Query Categories` row named `Orders`.

**That was the right shape and the wrong depth. The blocker turned out to be one line of JSON.**

Andrew's hypothesis, measured: orders' `metadata/.mj-sync.json` listed 7 of 23 directories in
`directoryOrder`, and `query-categories` was not one of them — so it fell to alphabetical ordering, where
`queries` sorts first ('i' < 'y' at index 4) and every query was pushed ahead of the category it
references. `sync push` halted there, and the NINE directories after it never ran, including
`entity-fields` and `entity-relationships`. Adding `query-categories` before `queries` takes the push
from 14 of 23 to **23 of 23, 0 errors**, and restores every piece of metadata KI-22 was about.

**Regenerating then works too, except for one line:** CodeGen emits
`import { mjBizAppsCommonAddressEntity } from '@mj-biz-apps/orders-entities'` — a self-import, which is
the `entityPackageName` limitation `packages/Entities/src/deal-entity.ts` documents at length. Corrected
by hand as a diagnostic, all four orders packages build, `DEAL-9001` opens in the workspace, and its
order lines render with orders' prices (Qty 3 × 229 = 687), matching the database exactly, with zero
console errors.

**What is left to decide, and it is now small and specific:**

1. **Land the `.mj-sync.json` fix in orders.** One line; it is in the orders working tree, uncommitted.
   This is the whole install fix and it is not controversial.
2. **The `entityPackageName` self-import is an MJ CodeGen bug** and needs fixing there. Do NOT reach for
   the schema-map variant — measured both ways, it makes CodeGen exclude those schemas from generation
   entirely (`deal-entity.ts`). Until it is fixed, orders cannot be regenerated cleanly on any host
   carrying common's schema, and the hand-correction on this host is a diagnostic that the next CodeGen
   run will wipe.

DN-8's premise — "almost certainly all it takes" — was wrong about the mechanism and right that it was
small. What made it look deep was that each attempt fixed one symptom and exposed the next.

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

## DN-18 — OPEN: `mj sync push` cannot write `MJ: Query Parameters` on this host

Pushing `metadata/queries` fails with `Failed to save MJ: Query Parameters record at MJ: Queries[0]/MJ:
Query Parameters[0]: Error executing SQL`, and **rolls back cleanly** — nothing is half-written.

**The 13 queries and their 58 parameters are already in the database and complete**, so this is not a
blocker for reading the reports. It is a blocker for CHANGING them: the file is now the only correct copy
until this is fixed, and a push cannot carry an edit across.

Two observations, and I am deliberately not claiming the mechanism:

* The push attempts to **CREATE** parameters that already exist, with freshly generated UUIDs, rather
  than matching them. So even without the SQL error, re-pushing would duplicate rather than update.
  Whether the definitions should carry stable parameter UUIDs is a real question for whoever owns them.
* The error output includes a table definition listing `__mj_CreatedAt`, `__mj_UpdatedAt`, `CreatedAt`
  AND `UpdatedAt`, which looks like the `@ResultTable`-versus-columns mismatch CLAUDE.md documents. I
  checked and could NOT substantiate it: `spCreateQueryParameter` declares no such columns and the
  entity's registered fields match the view exactly. So the four-timestamp table comes from somewhere
  else in MJ core's save path and I stopped rather than guess further.

**Needs someone with MJ core context.** Everything above is what a reader needs to not repeat the
investigation.

**Meanwhile:** `metadata/queries/SQL/slippage.sql` was fixed (see below) and the live `Query.SQL` was
updated with a targeted `UPDATE __mj.Query SET SQL = <file contents>` — the same content the push would
have written, verified by executing the stored SQL afterwards. That is a workaround and it is recorded as
one; it does not scale to a parameter or definition change.

---

## DN-19 — RESOLVED: `Sales: Slipped Deals` could never have returned a row

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

## DN-20 — OPEN: the involvement report promised a column it does not ship, and coverage is the wrong grain

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

The same three rows each carry `UnweightedWonAmount = 27,480`. Summing that column gives **82,440 for a
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

## DN-17 — NOT A DECISION, A TRAP: `mj sync push` resets the seeded pipelines to Default Company

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

# ACTIVITIES AND THE OUTLOOK INGEST — D-15 … D-24

Raised while building S-US9 (#119) and the ingest behind S-US10 (#120), on
`feature/activities-and-ingest`, pinned to `ba07f7e`.

> **Two numbering series live in this file, deliberately.** The `DN-n` items are the embedded-order
> rework's; the `D-n` items are one continuous series begun on `feature/closewon-tasks`. As of the
> three-way integration **all of D-1…D-24 are here**, so the caveat this note used to carry — that
> only D-9…D-12 had merged — is spent. Renumbering either series would break cross-references already
> written into code comments on three branches and reachable by no rename, so the prefixes stay.
>
> The overlaps are worth knowing rather than deduplicating: `DN-11`/`D-1` both ask which stage means
> "agreement or higher" and reached the same answer from opposite ends, and `D-9`/`D-10` are the
> contracts-side gaps this branch's audit re-derived independently from the schema.

Each item below has a defensible interim choice already in the code. None blocks the work.

---

## D-15 · The dedupe key is Graph's message id, not the RFC-822 `Message-ID`

`UQ_Activity_External` is unique on `(SourceSystem, ExternalID)`, and the ingest keys on
`('Microsoft365', <graph message id>)` — as briefed, and the right key for one mailbox.

**What it bounds:** a Graph message id is per-mailbox. The RFC-822 `Message-ID` header is the same string
for every recipient of the same message. So **the same email ingested from two mailboxes produces two
Activity rows**, and dedupe cannot see they are one message. Today one mailbox is in scope, so nothing is
wrong; the day a second is added, every internal thread involving two colleagues doubles.

**Interim choice:** the Graph id, with `IncludeHeaders: true` on the fetch so the RFC header reaches
`Activity.Details` and a later migration could promote it.

**What is needed:** a ruling on whether multi-mailbox ingestion is in scope. If it is, the key becomes the
RFC `Message-ID` where present — which means a column, because `Details` is not indexable, plus a decision
about rows already keyed the other way.

---

## D-16 · Meetings need either an MJ provider extension or a direct Graph call

**Verified, not assumed.** `BaseCommunicationProvider`'s abstract surface is `SendSingleMessage`,
`GetMessages`, `ForwardMessage`, `ReplyToMessage`, `CreateDraft`. There is **no event or calendar method
of any kind**, so meetings cannot be fetched through the Communication abstraction as it stands.

Two routes, not equivalent:

1. **Extend MJ's provider base** with a calendar surface. Right in the long run, benefits every app, and
   is a change to MJ core this repository cannot make alone.
2. **Call Graph `/events` directly from sales**, outside the abstraction. Available immediately, and
   permanently a second way of doing the same thing — the duplication `BaseCommunicationProvider` exists
   to prevent.

**Interim choice:** neither, and the interface is shaped so either fits. `NormalizedItem` already carries
`TypeCode`, `EndedAt` and `Location`, and `IActivitySource.Kind` is `'Message' | 'Calendar'`, so a calendar
source satisfies the same interface and slots in beside the message source with no redesign. Nothing about
meetings is half-built.

**What is needed:** a ruling on route 1 vs route 2. S-US10 asks for meetings explicitly — "Meetings
involving a deal's contacts appear on the deal" — so this is an acceptance criterion, not a nicety.

---

## D-17 · `GetMessages` has no date filter, so incremental sync is fetch-and-discard

`GetMessagesParams` is `{ Identifier, NumMessages, UnreadOnly, IncludeHeaders, ContextData }`. There is no
"since". A Graph-backed source cannot ask for "messages after the watermark" — it fetches the most recent
`NumMessages` and the caller discards what it has already seen.

**What it bounds:** if more messages arrive between two runs than the limit, the oldest are **missed and
never retried**, because the watermark advances past them. The window is `limit` messages per run per
mailbox against an hourly schedule.

**Interim choice:** the caller-side discard, plus an explicit issue when every fetched message was newer
than the watermark AND the batch was full — the one observable signature of that overflow. The fixture
source applies the watermark properly, so it is deliberately the stricter of the two.

**What is needed:** either a date-filtered fetch on MJ's provider (`GetMessagesParams.Since`), or an
agreed limit and cadence with the overflow signal wired to something that notices. A busy shared mailbox
on an hourly run at limit 100 is the case to size against.

---

## D-18 · Direction is inferred, and there is no Bcc

`GetMessageMessage` carries `From`, `To`, `ToRecipients`, `CCRecipients`, `ReplyTo` — nothing stating
inbound versus outbound, and no Bcc field at all.

**Interim choice:** `Direction` is inferred by comparing the sender to the mailbox being read. Correct for
ordinary mail. **Wrong for a message sent by a delegate** on somebody else's behalf, which lands as
Inbound to the delegate's mailbox. Bcc recipients are not dropped so much as never delivered by the
contract.

**What is needed:** confirmation that delegate-sent mail is out of scope, or a direction signal on MJ's
message type. The Bcc gap is probably acceptable — a Bcc is deliberately invisible to recipients — but it
should be an accepted absence rather than an unnoticed one.

---

## D-19 · `ContactMethod.Value` is not normalized at write time

The relevance filter matches an address against `ContactMethod.Value` with an `IN` list, then re-folds case
in memory. The `IN` keeps whatever index exists on `Value`; the in-memory fold is what makes the match
certain.

**Why it matters:** SQL Server's default collation is case-insensitive, so `Ada@Example.com` matches today.
**PostgreSQL's is not**, and production is Postgres. Wrapping the column in `LOWER()` would be portable but
non-sargable, discarding the index on the one query that runs against every participant of every message.

**Interim choice:** `IN` plus the in-memory fold. Correct on SQL Server; on Postgres a differently-cased
stored address is a genuine miss — a relevant message quietly treated as irrelevant, which is the failure
direction that produces no error at all.

**What is needed:** `ContactMethod.Value` normalized (lower-cased) at write time in bizapps-common, or a
functional index on `LOWER(Value)`. **This is the one item here that becomes a real defect at the Postgres
conversion** rather than at some later feature.

---

## D-20 · One message that belongs to two deals is filed against only the first

`DealMatcher` deliberately returns EVERY open deal a participant points at, because a customer with two
live pursuits emails about both and picking one would hide the message from the other.

But the writer keys on `(SourceSystem, ExternalID)`, which is unique — so the second deal hits the
idempotency short-circuit and is counted as a duplicate rather than gaining its own `Regarding` link. The
loop breaks after the first deal, which is at least honest about what happened.

**Interim choice:** file against the first match. The only alternative available today would be to
fabricate a distinct `ExternalID` per deal, which defeats dedupe entirely — the same message would
re-import on every run once its deal set changed.

**What is needed:** a writer that APPENDS a link to an existing activity when the external key already
exists, rather than short-circuiting. Small change to `ActivityWriterService`, plus a decision about
whether one activity linked to two deals is the intended model — it is the shape `ActivityLink` supports,
but nothing has said it is wanted.

---

## D-21 · The sync-rule precedence is a convention, not a stated one

`ActivitySyncRule` has `Sequence`, `Action` (Include/Exclude), `Direction`, `DateFrom`/`DateTo` and a
free-text `Filter`. Nothing in the schema or its descriptions says how the rules combine.

**Interim choice:** `Sequence` order, **last match wins, default include** — the ordinary firewall
convention and what a reader of those two columns would expect. `Filter` is **not evaluated at all**: it is
free text with no stated grammar, and inventing one here would oblige every future consumer to match an
undocumented dialect.

**What is needed:** the precedence written down wherever `ActivitySyncRule` is documented, and either a
grammar for `Filter` or an agreement that it is operator notes rather than a predicate.

---

## D-22 · The workspace writes activities directly rather than through the writer service

`ActivityWriterService` is the canonical composition — one `Activity`, N `ActivityLink` rows, one
transaction, dedupe, party resolution. It is server-side, and an Angular component must not import a server
package.

So the timeline component writes the same two records by hand: an `Activity` and its `Regarding` link, and
**nothing else** — no party links, no external key, no dedupe. Those are exactly the parts that need the
deal's account and contact resolved, and exactly the parts the ingest depends on being right.

**Interim choice:** the manual path's minimum. A hand-logged activity is reachable from its deal and
correctly typed; it just does not carry the account and contact as participants, which the service would
have added.

**What is needed:** a thin remote operation — `Sales.LogActivity` — wrapping the writer, so the browser
uses the real composition instead of a reduced copy. That is the pattern the close flow already uses, and
it would delete the duplication rather than manage it.

---

## D-23 · The scheduled job is written but not seeded

MJ's `SchedulingEngine` is the mechanism, as briefed — no external cron. `ActivitySyncJob.Run()` is the
callable half and is complete: it enumerates Active Microsoft365 connections and runs each independently,
so one failing mailbox cannot stop the others.

**What is deliberately not done is seeding the `ScheduledJob` row.** Every source available today either
refuses (the Graph source, until the tenant policy exists) or is a fixture, which has no business running
in a deployment. An `Active` hourly job would write to `ActivitySyncConnection.LastError` once an hour
forever, and the operator surface that exists to make a broken sync visible would be permanently red for a
sync nobody switched on.

**What turning it on takes**, for whoever does it:

| Field | Value |
|---|---|
| `JobTypeID` | `3B94DD43-E961-4D85-B7F4-B6783D748766` — the seeded **Action** type (`ActionScheduledJobDriver`) |
| `CronExpression` | `0 0 * * * *` — hourly. Six fields; seconds come first in this dialect |
| `Status` | `Active` (`CK_ScheduledJob_Status`: Pending/Active/Paused/Disabled/Expired) |
| `ConcurrencyMode` | `Skip` — a run overlapping the previous one would double-fetch the same window |
| `MissedRunPolicy` | `RunOnce`, not `RunAll` — catching up ten missed hours would fetch the same recent messages ten times |
| `Configuration` | JSON naming the per-run limit; must satisfy `CK_ScheduledJob_Configuration_IsJson` |

**What is needed first:** an MJ Action wrapping `ActivitySyncJob.Run()`. Sales' `Actions` package is
currently empty — this would be its first — so there is no local precedent for the metadata shape, which is
why it is a decision rather than a guess. And it is downstream of the tenant policy in any case: until that
exists there is nothing for an hourly job to read.

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
---

# UPDATES — what shipped since D-15…D-24 were written

Three of the items above have moved. Recorded here rather than edited in place, so the reasoning that
was current when a decision was taken stays readable next to what was done about it.

---

## D-16 — UPDATED: meetings are BUILT, on a recorded assumption

Previously: "neither route taken, the interface is shaped so either fits."

**Now built.** `MSGraphCalendarSource` calls Graph `/events` **directly**, outside MJ's Communication
abstraction. This is **route 2, taken as a working assumption and not as a ruling** — the reason being
that there is nothing to extend today: every abstract method on `BaseCommunicationProvider` is
message-shaped, so route 1 would mean shipping no meetings at all while waiting on another repository.

**It remains reversible for one file.** The calendar source sits behind `IActivitySource` exactly as the
message source does; the relevance filter, the deal matcher, the writer, the dedupe, the watermark, the
Action and the scheduled job neither know nor care which produced an item. If Amith rules that a calendar
surface belongs in MJ core, `MSGraphCalendarSource` is replaced and nothing else moves.

**One thing found while building it that argues FOR the direct call:** unlike `GetMessages`, `/events`
accepts a date filter. So the calendar has none of D-17's fetch-and-discard overflow risk — it can ask
for "events since the watermark" and get exactly that. A provider-base surface would have to expose the
same, or meetings would regress to the mail behaviour.

**Still needed:** the ruling. This is now a question of where the code lives, not whether meetings work.

---

## D-19 — RESOLVED, and the check had to be rebuilt to prove it

The filter now folds case in the query: `LOWER(Value) IN (…)`. Correct on both engines.

**Worth recording HOW this was nearly missed.** The first version of the check asserted the behaviour —
a mixed-case address matching a lower-case stored value. It passed. Then the mutation pass reverted the
fix, and **all seventeen checks stayed green**, because SQL Server's default collation is
case-insensitive and does the work either way. The check was measuring the database, not the code.

So the filter is built by an exported `BuildContactMethodFilter()` and AC12 asserts the SQL itself
contains `LOWER(Value)`. White-box, deliberately: on this engine the SQL is the *only* observable
difference, and a check that cannot fail until production is not a check. Re-ran the mutant afterwards
and AC12 goes red.

**Still recommended, and now only a performance matter rather than a correctness one:** a functional
index on `LOWER(Value)` in bizapps-common. `LOWER()` is non-sargable, so any plain index on `Value` is
now unusable for this read. That is somebody else's schema, and the read is per-participant-per-message,
so it is worth doing before volume arrives.

---

## D-23 — SUPERSEDED: the job IS seeded, and Active

Previously: "the callable half is complete; the row is deliberately not seeded, because an Active hourly
job would write to `LastError` once an hour forever."

**That objection was answered by changing the default source rather than by leaving the row out.** The
factory's default is now two EMPTY fixtures — one per surface — so the hourly run does the whole
pipeline and writes nothing. The job log reads as an hourly success that fetched zero items, and
`LastError` stays clean. AC17 asserts exactly that, so replacing the default with anything that reads
goes red rather than quietly writing fabricated activities into a real database every hour.

**Shipped, in `metadata/`:**

| Row | Value |
|---|---|
| Action Category | `Sales` — sales had none; MJ's ~50 seeded categories are its own connectors |
| Action | `Sync Activities`, DriverClass `Sales.SyncActivities`, Type Custom, Active |
| Action Param | `Limit`, Input, default 100 — see D-17 for why it is not just a performance dial |
| ScheduledJob | Action type, `0 0 * * * *`, UTC, Active, ConcurrencyMode `Skip`, MissedRunPolicy `RunOnce`, MaxRuntimeMinutes 20 |

Pushed to MJ_V6_Host and verified: four rows created, `Configuration.ActionID` resolves to the real
Action, DriverClass matches the registered class. AC15 asserts that agreement, because the one silent
failure mode here is a dangling `ActionID` — the job fires on time, resolves nothing, and reports no
error.

`NextRunAt` is null until the SchedulingEngine's first tick computes it; that is the engine's job, not a
seed value, and an MJAPI restart populates it.

**Still needed:** nothing to make the chain fire. Only a real source for it to read.

---

## D-25 · A cancelled meeting is captured, but its status is not modelled

`MSGraphCalendarSource` reads `isCancelled` and carries it into `Activity.Details` as `Cancelled: true`,
so the fact survives and a surface can badge it. But `Activity.Status` is hardcoded `'Completed'` by the
ingest for every item, so a cancelled meeting is stored as completed.

**Interim choice:** capture it and leave the status alone. Dropping cancelled meetings would be wrong —
"they cancelled" is exactly the kind of thing a rep wants on a timeline — and `CK_Activity_Status` does
allow `'Cancelled'`, so the value exists.

**What is needed:** a ruling on whether a cancelled meeting should read as `Cancelled` (accurate about
the meeting, but it then looks like a *task* that was cancelled in any generic activity view) or as
`Completed` with a badge (accurate about the record, vaguer about the world). It is one line in the
ingest either way, and it wants a product answer rather than a developer's guess.

---

## D-26 · The per-surface watermark uses `Settings`, which is a shared bag

Messages advance `ActivitySyncConnection.LastSyncAt`; the calendar advances a `CalendarLastSyncAt` key
inside `Settings`, an existing nullable JSON column.

**Why it is split at all:** one watermark for both surfaces takes the max of the two, so a meeting older
than the newest email is judged already-seen and **skipped forever** — the calendar source never even
being asked for it. No error, and no row missing from anything anyone counts. AC14 is the regression
test.

**Why `Settings` rather than a column:** a column means a migration in bizapps-common for a field only
this app reads. The write merges rather than replaces, so anything else keeping state there survives.

**What is needed:** agreement that `Settings` is a legitimate place for a consumer's own state, or a
second watermark column if bizapps-common would rather own it explicitly. The risk of the current shape
is collision — two apps choosing the same key — and it is small but real.

---
---

# ROUND TWO — D-25 decided, D-27…D-30

---

## D-25 — DECIDED: a cancelled meeting is `Cancelled`

**Ruling taken here, not deferred.** A meeting that did not happen is not a completed activity, and
anyone reading a timeline would be misled by one that says it was.

**And no vocabulary had to be invented,** which is the part worth recording: `CK_Activity_Status` already
allows `'Cancelled'`. The value was there the whole time and the earlier version simply was not using it
— it hardcoded `'Completed'` for every ingested item. So this is a bug fixed rather than a model
extended.

`NormalizedItem.Cancelled` is now a first-class field rather than a marker buried in `Raw`, because the
ingest branches on it and a fact nothing can act on without knowing which provider shape to look inside
is not really recorded. Messages always report false: a sent mail cannot be un-sent.

**`Outcome` is deliberately left NULL.** The nearest seeded value is `NoShow`, and that is a *different
fact*: a no-show is a meeting that went ahead and somebody failed to attend. Reusing it for a meeting
called off in advance would put a false claim in a column reports read, which is worse than an empty one.
Nothing in `CK_Activity_Outcome` means "did not occur", and inventing a value was explicitly off the
table.

AC18 asserts both directions and that neither gains an outcome. Cancelled meetings are still **filed** —
"they cancelled" is a fact a rep wants on the timeline, not something to drop.

---

## D-27 · UPSTREAM (bizapps-common): a functional index on `LOWER(ContactMethod.Value)`

**Not built here, by instruction — it is another repository's schema and we are not touching other
repos.** Recorded with the reasoning so it can go upstream intact.

**What changed and why the index is now needed.** The relevance filter matches a message participant's
address against `ContactMethod.Value`. It used a bare `Value IN (…)`, which relies on the database
collation being case-insensitive: true on SQL Server, **false on PostgreSQL**, and production is Postgres.
On Postgres a differently-cased stored address simply would not come back, the message would be judged
irrelevant, and it would never link — no error, no missing row anyone counts. So the filter now folds
case explicitly: `LOWER(Value) IN (…)`.

**The cost, stated plainly.** `LOWER(Value)` is non-sargable, so any plain index on `Value` is no longer
usable for this read — and this is the read that runs for **every participant of every message on every
sync run**, which is the highest-frequency query the ingest makes. It is correct now and it will not
scale.

**The fix, for whoever owns bizapps-common:**

```sql
CREATE INDEX IX_ContactMethod_ValueLower ON __mj_BizAppsCommon.ContactMethod (LOWER(Value));
```

SQL Server needs a computed column plus an index on it; Postgres supports the expression index directly.
Either way it restores the index for this pattern without changing any consumer.

**A second, better option worth putting to them:** normalize `Value` to lower case at write time in
`ContactMethodEntityServer`. Then a plain index works, every consumer's comparison gets simpler, and the
case question stops existing. It is a bigger change — existing rows need a backfill — and it is theirs to
weigh.

**Why this is not urgent yet:** no `ActivitySyncConnection` is Active anywhere, so the query runs only in
checks. It becomes a real performance matter on the day a mailbox is connected, which is the same day the
tenant policy lands.

---

## D-28 · The snapshot period is the calendar month, because nothing stores a fiscal one

`CurrentMonthPeriod()` returns the current calendar month in UTC when no period is supplied.

**This is a choice, not a derivation.** Sales has no fiscal calendar — no `FiscalPeriod` table, nothing on
`Company` naming a year end, nothing anywhere that says when a quarter begins. So "the current period"
has no stored answer, and the calendar month is the only window that needs no invented configuration.

Monthly is very likely right; most forecasting is. But if Blue Cypress forecasts on a fiscal calendar
offset from January, every snapshot is filed against the wrong window — and the rows would look
perfectly reasonable, because a period is just two dates.

**Interim choice:** calendar month, UTC, computed with `getUTC*` throughout. FS7 asserts the boundary with
a fixed instant late on a month end (which is already the next month east of Greenwich) and both a leap
and a common February.

**What is needed:** confirmation that forecasting is monthly and calendar-aligned, or a fiscal calendar to
read from. The Action already accepts an explicit `PeriodStart`/`PeriodEnd` pair, so a caller who knows
better can override it today — both or neither, never one.

---

## D-29 · A snapshot is skipped once per day per grain, rather than versioned

`ForecastSnapshot` has no unique index, correctly: the table is a series and `CapturedAt` distinguishes
captures, so "what did we think on the 1st" stays answerable.

But that means nothing stops a double-run adding two captures minutes apart, which is noise rather than
history. So the writer skips a grain already captured **today** and counts it.

**Skipped rather than updated**, because overwriting a capture edits provenance — the one thing rule 3
forbids — and a second measurement of the same day is not more true than the first. FS3 asserts the
original figure survives a second run carrying a different one.

**What is needed:** confirmation that one capture per day per grain is the intended granularity. If
somebody wants intra-day forecast movement the guard has to go, and then the daily cron and the guard are
both wrong rather than just one of them.

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

### The edit `docs/INTEGRATION-LOG.md` needs, and why not by me

That file was added after this branch's point and lives in another session's working tree, so the block
below is written out rather than applied. It replaces the `--exclude task-types` bullet at lines 98–101.

**It deliberately says two things, because saying only the first would mislead.** The task-types
exclusion is gone; query re-push is a *separate* open defect. Somebody who hits the second and reads a
note claiming pushes are clean would reasonably conclude the first had regressed.

> ### Known-incomplete, deliberately
>
> * **`metadata/task-types/` now pushes cleanly — the `--exclude` is gone.** It declares
>   `TaskType.Code`, which bizapps-tasks PR #42 added, and that migration is applied to MJ_V6_Host.
>   `mj sync push --dir metadata` needs no exclusion: verified at 15/15 directories, 0 errors, with
>   `task-types` reporting *2 records, no changes*. No changes rather than 2 updated because the
>   migration's own name-derived fallback produced `ORDER_REVIEW` and `CONTRACT_PROCESSING`, which is
>   exactly what this repo declares — the two conventions agreed without being coordinated.
>   `CloseWonTaskService` resolves by `Code` on this host; `WT12` asserts the probe follows what
>   `EntityField` metadata offers, in both directions, so the `Name` fallback stays covered for hosts
>   that predate the migration (exercised on MJ_V6_Tasks2).
>
> * **`MJ: Query Parameters` still fails on re-push, and it is a different problem.** MJ's push extracts
>   query parameters from the Nunjucks template and then collides with the files' own explicit
>   declarations, hitting `UQ_QueryParameter_QueryID_Name` and rolling the whole push back. So the 13
>   queries land once on a clean database and fail on every push after. An open MJ defect, unrelated to
>   task-types — **do not read it as the exclusion having regressed.** Verify the queries with a count,
>   not with the push's exit code.
>
> ### Environment debt on MJ_V6_Host, from applying PR #42
>
> * **The tasks schema there is managed by MJ core, and PR #42 is applied but untracked.** The Flyway
>   history records four tasks migrations and all four are MJ core's (`v6/V2026…__v6.1.x__…`); none of
>   bizapps-tasks' own has ever run, not even its baseline. So `mj migrate` from bizapps-tasks is the
>   wrong tool for this host — it would try to create tables that already exist. PR #42 was applied
>   directly instead, placeholders substituted, and **no Flyway row was fabricated**: claiming a history
>   under bizapps-tasks' versioning would be false, and claiming one under MJ core's would assert MJ
>   shipped something it has not.
>
>   **The consequence:** the migration's first statement is a bare `ALTER TABLE … ADD Code` with no
>   existence guard, so **a future equivalent from MJ core will fail on this host**. Five minutes to fix
>   when it happens — mark it applied, or guard the ALTER — but invisible until then, which is the worst
>   shape for environment debt. A rebuild from zero is unaffected.
>
> * **PR #42 adds cross-schema foreign keys from an app schema into MJ core.**
>   `FK_TaskType_OnCreateAction` and `FK_TaskType_OnStatusChangeAction` both reference
>   `__mj.Action(ID)`. That is the intended workflow-hooks feature, but it is a change to the dependency
>   graph rather than just a column: the tasks schema now has a structural dependency on MJ core's
>   `Action` table, and anything that drops or reorders those objects has to account for it.


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
