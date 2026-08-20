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
---

# ACTIVITIES AND THE OUTLOOK INGEST — D-15 … D-24

Raised while building S-US9 (#119) and the ingest behind S-US10 (#120), on
`feature/activities-and-ingest`, pinned to `ba07f7e`.

> **Two numbering series live in this file, deliberately.** The `DN-n` items above are the
> embedded-order rework's. The `D-n` items below continue a series that started at D-1 on
> `feature/closewon-tasks` and `feature/contracts-seam-v6`; D-1…D-14 are on those branches and only
> D-9…D-12 have merged here. Renumbering either series would break the cross-references already written
> into code comments on three branches, and would collide the moment both branches add an item. The
> prefixes keep them apart at no cost.

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
