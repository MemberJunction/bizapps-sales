# DECISIONS NEEDED

Choices made overnight on `feature/embed-order-on-deal` where a second reading was defensible. Each one
was **decided and implemented** — the rule for the run was "if two options are equally defensible, take
the one that touches fewer files, record the other here, and move on." So none of these blocks anything;
they are here so the rejected option is visible rather than lost.

Anything genuinely undecidable without Josue or Amith is marked **OPEN**.

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

