# What the Explorer suite actually covers — and what it doesn't

A walkthrough log, written while running each spec **headed** with `PW_SLOWMO=300` so the gestures can be
followed on screen. One spec file at a time.

The column that matters is **"Does NOT assert"**. A suite of 22 spec files with no coverage map is hard
to reason about, and the useful question is not "is it green" but *what does this cover that a human walk
would not, and what does a human walk cover that this can't*.

How to read it: **Drives** is the literal gesture. **Why** is the requirement the step exists for.
**Asserts** quotes the assertion message. **Does NOT assert** is what a reader might reasonably assume is
covered and isn't.

Run it yourself:

```bash
MJAPI_PORT=4143 PW_SLOWMO=300 npx playwright test specs/10-deal-crud.spec.ts --project=crud --reporter=list
```

`PW_SLOWMO` pauses between gestures so a human can track the run; it is not a timing fix and is off by
default, so unattended runs are unchanged.

---

## 10-deal-crud — "Deal CRUD through the Explorer UI"

The full create → read → update → delete walk for two entities, driven entirely through generated forms.
This is the spec that proves the generated UI is usable at all: a form can fail to render a field, a
lookup can fail to resolve, and a save can silently no-op, and all three look identical to a passing
GraphQL test.

| # | Drives | Why | Asserts | Does NOT assert |
|---|---|---|---|---|
| 1 | Opens the Pipelines grid, clicks **New** | the generated form is reachable from the entity list | `entity "Pipelines" must be listed in the app` | that the grid's *columns* are right — that's 30's job |
| 2 | Reads the empty form's required markers | NOT NULL columns must surface as required *before* a save, not as a server error after | `Pipeline.Company is NOT NULL and must render required` | that any *other* NOT NULL column is marked — only `Company` is checked |
| 3 | Types Name + Code, picks **Company** via the FK type-ahead | an FK lookup must resolve a real record, not just store a UUID | `Company should be populated after save` | that the *right* company was stored — only that the field is no longer required-empty |
| 4 | Saves | a save must persist | `Name should have persisted` | that `Code` persisted — it is typed and never read back |
| 5 | Opens Deals, clicks **New**, reads required markers | same NOT NULL guarantee on the central entity | `Deal.Pipeline is NOT NULL and must render required`, `Deal.Company is NOT NULL…` | — |
| 6 | Types **Amount 120000**, Probability 20, Term Months 12, Next Step; picks Pipeline + Company; saves | a rep can create a deal end to end | `Deal name should have persisted` | **the app's central rule.** The spec *types an Amount by hand.* Nothing here asks whether `Amount` is a cached answer with provenance, and no `PreviewOrder` is involved. Rule 1 is not exercised by this spec at all |
| 7 | Reloads, reads `body.innerText()` | the generated base view's denormalised FK columns must resolve to names | `the Pipeline FK resolves to its name, not a UUID`, `the Company FK resolves to its name` | — |
| 8 | Same read | values survive a round trip | `Amount survives a reload`, `Probability survives a reload`, `Next Step survives a reload` | **these are substring matches on the whole page.** `toContain('20')` for Probability matches any `20` anywhere on screen — a date, a row count, `2026`. Probability could be blank and this would still pass |
| 9 | Enters edit mode, looks for three labels | the money-provenance trio must be visible to a human, or the guarantee is unenforceable in the UI | `the provenance field "Amount Is Computed" must render on the edit form` (+ `Amount Computed At`, `Amount Source Hash`) | **their values.** It checks the labels are *rendered*, never that `AmountIsComputed` is false for a hand-typed amount — which is the thing the fields exist to record |
| 10 | Looks for related-entity surfaces | CodeGen must wire the child relationships | `related-entity surface "Deal Team Members" must be reachable` (+ Stage Events, Contact Roles) | **that any of them contain anything.** A tab label is visible; no row is ever opened. Whether saving a deal created a `DealStageEvent`, or stamped `OwnerEmployeeID`, is not checked here or anywhere in this file |
| 11 | Edits Amount → 185000, Probability → 45, Term → 24, saves, reloads | an update must persist and replace | `updated Amount must persist across a reload`, `the OLD amount must be gone` | that the *update* left provenance alone, or produced a stage event |
| 12 | Returns to the grid | the record is findable by a human | `the grid should report at least one record` | that the deal is on the *first page*, or findable by filtering — it reads page text, deliberately, because the breadcrumb bar overlays the filter box |
| 13 | Deletes the Deal, then the Pipeline, via the record view | delete must work through the UI and leave nothing | `no grid row for the Pipeline may remain` | **cascade.** Nothing checks what happened to the deal's team members, stage events or contact roles. A delete that orphaned children would pass |

**Not covered by this file at all:** deal lines (descoped — D-DL1, issues #36–#39 closed as not planned),
pricing, closing, the workspace, the board, and anything a second user would see.

**Result: FAILED at step 13 (delete) — harness defect, not product.** Steps 1–12 passed, including the
FK reads and the provenance labels. The delete step failed with `the record view must expose "Delete this
Record"` — and the button is *there*: Playwright resolved it **36 times** and reported `hidden` every
time.

That is the trap this same file already documents for `fieldLabelVisible`: MJ's shell keeps every open
tab's form in the DOM and merely HIDES the inactive ones, so a `.first()` without a visibility filter
matches a background tab's control. `deleteRecordViaRecordView` (`lib/explorer.ts:696`) uses
`locator('button[title="Delete this Record"]').first()` with no such filter. The product exposes the
affordance correctly; the harness is looking at the wrong copy of it.

Worth saying plainly: **this spec has never proved deletion works through the UI.** It fails before it
gets there, so item 13's "does NOT assert" note about cascade is academic — nothing about delete is
covered today.

---

## 20-demo-tour — "every screen the demo shows, with its seeded data"

Ten grid screens plus the workspace's Product lines pane. This is the demo path, so what it does and
doesn't check is the closest thing we have to a rehearsal.

Every grid step goes through one helper, `tour(entityLabel, screenshot, mustContain[])`, which does the
same four things each time. The table below gives that shape once, then what varies.

| Step | Drives | Why | Asserts | Does NOT assert |
|---|---|---|---|---|
| *(helper)* | Enters the app, opens the entity list, clicks the entity card, screenshots | every demo screen must be reachable and populated | `"X" must be listed in the app`; `the grid heading should become "X"`; `"X" should have seeded rows for the demo` (count > 0) | **which rows.** The count comes from `/(\d+)\s+records?/` — the *first* match in the whole page's text. Spec 10 just proved hidden tabs stay in the DOM, so that number can belong to a different grid |
| 1 | home | the shell renders | — (screenshot only) | anything |
| 2 | Deals | the pipeline has deals | `"Deals" grid should show "Northwind Health"` (+ Cascade) | **any column value.** `toContain` searches the entire page, so an Amount, stage or close date could be blank or wrong and this passes. No money is ever read on the demo path |
| 3 | Pipeline Stages | Rule 2 — a stage called "Signed" is a *label*, and no code compares it | `should show "Discovery"`, `"Signed"` | **that the stage points at a `DealStatusType` with the right flags.** The whole point — that "Signed" wins because `IsWon` is set on the type it references, not because of its name — is not checked. The screen shows names; the guarantee is about flags |
| 4 | Pipelines | one per company | `should show "B2B"`, `"D2C"` | that either pipeline has stages, or belongs to the company shown |
| 5 | Sales Accounts | the IsA Organization chain resolves | `should show "Northwind Health Group"` | that the IsA parent actually chained — a name renders, the subtype relationship is not inspected. This is the app's single riskiest dependency (KI-1) and the demo does not touch it |
| 6 | Sales Contacts | IsA Person | `should show "Whitfield"` | same as above |
| 7 | Deal Team Members | the D-6 partner rep exists | *(no needles)* — rows > 0 only | **attribution.** The named double-count trap — three team rows per deal, `AttributionPct`, `IsOwnerRole` — is never read. A demo could show this grid and say "bookings by AE" while the data triple-counts |
| 8 | **Product lines** (workspace pane, not a grid) | Rule 1 made visible: the rep supplies product + quantity, price comes back read-only | `the workspace must offer a Product lines pane`; `the seeded deal must show its product lines`; `unit price and line total must render READ-ONLY` (exactly 2 `td.dw-readonly`) | **the numbers themselves.** It asserts the cells are read-only, never that `Resolved*` are empty or that any price is right. The demo point — signed figures beside empty engine columns — is asserted as *shape*, not as content |
| 9 | Deal Stage Events | Rule 3, provenance is append-only | rows > 0 | **that the stamps are there.** `AmountAtTransition` / `ProbabilityAtTransition` are what make the row worth keeping, and neither is read. Nor is append-only-ness tested |
| 10 | Deal Status Types | the behaviour flags are data | `should show "Won"`, `"On Hold"` | **the flags.** `IsWon`, `LocksDeal` — the columns the engine branches on — are never read |
| 11 | Opens a Deal record | show a record view | **nothing — and the spec says so.** It logs `record view: Pipeline FK resolved to its name` or `did not open (shell state)` and moves on | everything. This is the only step that opens a record, and it is deliberately `REPORTED, NOT ASSERTED` |
| 12 | — | no console errors while touring | `touring the demo screens` (via `expectNoConsoleErrors`) | — |

**The shape of this spec's coverage:** it proves **every demo screen loads and is not empty**. That is
worth having — it catches a broken route, an unseeded table, a form that won't render. It proves almost
nothing about *values*, and nothing at all about the three rules the app exists to uphold: no money is
read, no behaviour flag is read, no provenance stamp is read.

**What a human walk covers that this can't:** whether the numbers on screen are *right*, whether the
screens tell a coherent story in sequence, and whether anything looks wrong in a way no assertion was
written for.

**What this covers that a human walk wouldn't:** that all ten screens still load after a change — quickly,
repeatedly, and without anyone remembering to check the boring ones.

**Result: all ten grid screens PASSED. FAILED at step 8 (Product lines) — spec defect, and it is mine.**

`railItem(page, 'All deals')` timed out: no such button inside `mj-left-nav`. The cause is a surface
mix-up in my own rewrite of this step. `openSalesApp` opens the **entity browser** (MJ's DataExplorer),
whereas the workspace roster and its "All deals" rail live on the app's `Deals` nav item — the surface
`lib/workspace.ts` reaches at `/app/sales/Deals`. The step enters one surface and then looks for the
other's furniture.

Worth being precise about what this does and does not say. The ten screens the demo actually tours are
green. The step that fails is the one I *added* to replace the retired `Deal Lines` grid step — so the
demo path is in better shape than the red tick suggests, and the one genuinely new claim in this file
(that Rule 1 is visible as read-only cells on a real deal) is the one not currently running.

---

## 40-deal-workspace — the deal workspace, five panes, one transactional save

The richest spec in the suite and the one closest to what a rep actually does: build a deal in the
workspace, give it product lines, save once, read it back. It is also where the embedded order lives, so
it is the surface the S2 pricing bridge will land on.

| Step | Drives | Why | Asserts | Does NOT assert |
|---|---|---|---|---|
| 1 | Opens the app on the deal workspace | the workspace is the app's front door | `the deal workspace component must render` | — |
| 2 | Counts pane tabs | all five panes exist | `pane tab "X" must be present` ×5 | that any pane has content before it is opened |
| 3 | Picks account / contact, fills party info | a deal needs a customer | `the customer-context header must show the chosen account` | that the account is the one the *deal* will be saved against — only that the header echoes the pick |
| 4 | **First save** | KI-20's ordering: a deal must be saved before it can take lines | `Save must be ENABLED once party info is complete`; `the save must report something`; `and it must not be an error` | **what was written.** "Not an error" is the whole claim. No amount, no order, no id is read back at this point |
| 5 | Clicks **Add line** twice, picks two different products, types quantity and discount % into each | intent: the rep supplies product + quantity + requested discount | `Add line must be enabled once the deal is saved`; `two line rows must exist`; `the two rows must reference DIFFERENT products` | **the price that came back.** Unit price and line total are read-only cells sitting between the two inputs, and the spec fills *around* them without ever reading them. Rule 1's round trip — intent in, engine's number out — is not verified anywhere in this file |
| 6 | Adds two payment-schedule rows | the exception case: rows mean negotiated terms | row count is 2 | any amount or date in them |
| 7 | Fills terms and variances | the deal's commercial shape | **nothing — this step has no assertions at all.** It types into fields and moves on | everything it typed; it is covered only indirectly, if the later read-back happens to include it |
| 8 | Switches panes and comes back | unsaved state must survive navigation — this is where DN-21-style bugs live | `the deal name must survive switching panes`; `the lines must survive switching panes` (count 2) | that the *values inside* the lines survived — quantity and discount are not re-read, only the row count |
| 9 | **Second save** | one transactional save must write the header and both child collections | `Save must be ENABLED — a valid draft that cannot be saved is the bug`; `a save confirmation must appear` (/created\|saved/); `the save must not have failed` | again, what was written |
| 10 | Goes to the Deals grid, opens the record | the save is visible outside the workspace that made it | `the saved deal must appear in the Deals grid`; `the record view must show the deal`; `the pipeline FK must resolve to its name on the record` | — |
| 11 | Expands the order-lines section on the record | the children round-tripped through a surface that did not write them | `the order lines must read back on the record, identified by the product each references` | **conditionally nothing.** If the section header is not found the spec *logs* `child read-back not asserted here` and passes. The strongest claim in the file is the one that can quietly not run |
| 12 | — | no console errors | via `expectNoConsoleErrors` | — |

**The shape of this spec's coverage:** it proves the workspace can *build and persist a deal with
children through one save*, and that the result is visible elsewhere. That is the most valuable thing the
suite does.

**The gap worth naming:** this spec drives every input around the price and never reads the price. A
pricing bridge that returned zeros, stale numbers, or nothing at all would pass this file — because the
only pricing assertion in the whole suite (20's) checks that the cells are *read-only*, not what is in
them. When S2 lands, that is the hole it lands in.

**Result: steps 1-9 PASSED, FAILED at step 10 (read-back navigation) — spec defect, not product.**

The workspace half worked: it picked a customer, saved, added two product lines with quantities and
discounts, added payment-schedule rows, survived pane switching, and saved again — all green. It then
failed trying to *leave* the workspace to verify the result, on
`getByText(/^\s*Deals\s*$/i)` timing out.

Same class as 20's failure: a bare text locator for the "Deals" entity card, which exists on the entity
BROWSER surface, while the spec is standing on the workspace. This one is pre-existing rather than
something I introduced.

**What that costs is the important part.** Steps 10 and 11 are the read-back — the only place this file
checks that one transactional save actually wrote the header *and* the children through a surface that
did not write them. So today spec 40 proves the workspace can compose and save a deal, and does **not**
prove the children round-trip. Combined with step 11's `if`-guard (which logs and passes when the section
header is missing), the strongest claim in this file is currently not running at all.

---

## 60-close-deal — closing, the lock, refusal, and reopen

**The strongest spec in the suite, and the only one that reads the database.** Everything above asserts
what the screen shows; this one closes a deal through the UI and then goes and looks at what was actually
written. That difference is worth more than the rest of the coverage combined.

| Step | Drives | Why | Asserts | Does NOT assert |
|---|---|---|---|---|
| 1 | Builds a deal fixture through the workspace and saves | needs a real deal to close | `fixture: "X" reported saved but no row exists` — *the UI's success message is checked against the database* | — |
| 2 | Closes it as **Won** | the close is a single transactional remote operation | `closed as won` in the UI, then **from the DB**: `the deal must be in a WON status` (`IsWon`), `a won deal must be locked` (`LocksDeal`) | — |
| 3 | Reads the stage events | Rule 3: a close without provenance is unauditable | `closing must APPEND a stage event — without it the close has no provenance` (count > 0) | **the stamps on it.** `AmountAtTransition` / `ProbabilityAtTransition` are the reason the row is kept, and neither is read here — only that *a* row appeared. (They **are** asserted, on the drag path, by `80-board-drag` — see below. So the stamps are covered; they are just not covered on the *close* path, which is the one that matters most) |
| 4 | Looks for the routing panel | the user must be told what happened downstream, not have to read a stage event | `close-routing` is visible | **what it says.** Visibility only; the routing text, and whether it matches what actually happened, are not checked |
| 5 | Re-opens the closed deal | Rule 3: the lock is enforced in the entity server, so the UI must reflect it | `a locked deal must say so` (lock notice); `the deal name is frozen on a closed deal` (disabled); `status is frozen on a closed deal` | — |
| 6 | Tries to edit and save a locked deal | **the false-success case** — a save that silently no-ops looks identical to a save that worked | the message must **not** be `Deal saved.`; and from the DB, `LocksDeal` is still true | — |
| 7 | Closes as **Lost** with no reason | a lost close must be refused without a reason | an error surface is visible; and from the DB, `a refused close must NOT have closed the deal` (`IsLost` false) | — |
| 8 | Closes as Lost **with** a reason | the refusal is about the reason, not the path | `with a reason the close must succeed` (`IsLost` true, from the DB) | — |
| 9 | Reopens a closed deal | reopening goes through `Sales.ReopenDeal` and must record why | `reopened` in the UI; from the DB `a reopened deal must no longer be locked`; and the stage-event count is **at least one higher than after the close** | **the reason it recorded.** `ReopenDeal` takes a reason and the point is that it is captured; the spec counts rows rather than reading the reason back |
| — | *(deliberately deleted)* | — | a retired assertion that closing creates an **order** — removed under `docs/DECISIONS.md` D-OS1, because the order is provisioned with the deal on first save, not at close. The deletion is documented in place, which is the right way to retire a claim | — |

**The shape of this spec's coverage:** it is the only place the app's three rules are actually tested as
*behaviour* — vocabulary flags read from the type tables, the close lock enforced below the UI, and
provenance appended rather than edited. It is also the only spec that would catch a UI that reports
success while writing nothing.

**What a human walk cannot do here at all:** step 6. A human clicking Save on a locked deal sees a
message and moves on; only a database read distinguishes "saved" from "silently didn't". If one spec in
this suite is worth keeping green, it is this one.

**Result: ALL FOUR TESTS PASS (1.7m).** Close + lock + stage event; read-only rendering with no false
success; close-lost refused without a reason and accepted with one; reopen unlocks and the close event
survives. Run with `RUN_MUTATION_TESTS=1` so the checks are not vacuous.

**One honesty note.** The first test is still titled *"a UI close creates an order, appends a stage
event, and locks the deal"* — but the order assertion was deliberately deleted under `docs/DECISIONS.md`
D-OS1, because the order is provisioned with the deal on first save, not at close. The body is correct
and the deletion is documented in place; the **title** is stale and now claims more than the test checks.
Anyone reading the run output sees "creates an order" go green and would reasonably believe that was
verified. It was not.

---

## 75-dashboard — the four tiles, closing-soon, and the priced/stated distinction

Reads the database first, then checks the screen agrees with it. That is the right shape for a dashboard
spec, and it is rare in this suite.

| Step | Drives | Why | Asserts | Does NOT assert |
|---|---|---|---|---|
| 1 | Runs a baseline query before touching the UI | a dashboard assertion is only worth what it is compared against | `the database must answer the baseline query`; `the host needs seeded deals or this spec proves nothing` | — |
| 2 | Opens Dashboard from the left nav | the surface is reachable | `the Sales left-nav must offer Dashboard` | — |
| 3 | Reads the four tiles | the measures must be the *vocabulary flags'* answer, not a name match | `Open pipeline must equal the SUM of Amount over deals whose status carries IsOpen`; `Open deals must equal the COUNT of IsOpen deals`; `Past expected close must equal open deals whose ExpectedCloseDate has gone`; `Won must equal the COUNT of deals whose status carries IsWon` | **the attribution trap.** These are deal-level sums, so they are safe — but nothing here covers a by-rep or by-role rollup, which is exactly where the triple-count lives. The dashboard does not yet have such a tile; when it gets one, this file has no guard for it |
| 4 | Reads the closing-soon table | a rep's next action is time-ordered | `the closing-soon table must render rows`; `the closing-soon list must be soonest-expected-close first` (compared to a DB-derived order) | how many rows, or whether the list is truncated |
| 5 | Looks for "stated" markers | **Rule 1 made visible**: a hand-typed amount must be visibly distinguished from a priced one | `every hand-typed amount in the visible rows must carry the "stated" marker, and no priced one may`; `and at least one must be marked, or the distinction is invisible` | the *amount* itself — the marker is checked, not the number beside it |

**This is the only spec that asserts anything about Rule 1 that has teeth.** It does not read a price, but
it does prove the UI tells a human which numbers the engine produced and which a person typed — and the
second assertion guards against the check passing vacuously because nothing was marked.

**Result: PASSED (12.0s).** All four tiles matched the database, the closing-soon list was in
soonest-first order, and the priced/stated markers were present and correctly placed.

Fast, too — 12 seconds for the most valuable Rule-1 assertion in the suite, because it reads the DB and
the screen once each rather than driving a long UI walk.

---

## 80-board-drag — dragging a card between stages

**The most rigorous spec in the suite.** It drags a card, then verifies the consequence in the database
along three independent axes: the stage changed, provenance was *appended* with departing values, and the
embedded order followed.

| Step | Drives | Why | Asserts | Does NOT assert |
|---|---|---|---|---|
| 1 | Renders the board, takes bounding boxes | a drag needs real geometry, and a missing box is a rendering failure not a drag failure | `the card has no bounding box — it is not rendered`; same for the target column | — |
| 2 | **Drags a card to another stage**, waits for the busy indicator to clear | the board is the demo's most visual gesture | the deal's stage changed | — |
| 3 | Reads the appended stage event | Rule 3, and the stamps that make it worth keeping | `FromStageID` = the old stage, `ToStageID` = the target; `the event must stamp the probability the deal held on the way OUT`; and `AmountAtTransition` = the **departing** amount | — |
| 4 | Compares the event list before and after | **append-only, proved properly**: the first *n* event IDs must be identical afterwards | prior events are byte-for-byte the same rows | — |
| 5 | Checks the deal's order | a stage move must move the order's status with it | `the deal points at an order that does not exist` (order resolves), and its state moved | — |
| 6 | Drags toward a **closing** column | closing is `Sales.CloseDeal`, an explicit act — never a side effect of a drag | `a drag must NEVER land a deal in a closing stage`; `whatever column it did land in must be a non-closing one, so nothing locked the deal`; `no stage event may record a transition INTO the closing stage` | — |
| 7 | Reads the closing column's hint | the refusal must be explained where the user is, not after the fact | the lock affordance carries a `title` matching `/closes and locks/i` **and** `/workspace/i` | — |
| 8 | — | console clean during a drag | `no console errors during a drag` | — |

**Step 4 is the assertion I would keep above all others in this suite.** "Provenance is append-only" is
easy to state and almost never tested; comparing the prefix of the event list before and after is what
turns it from a comment into a guarantee. Step 6 is the second — proving a gesture *cannot* cause an
irreversible act is worth more than proving one can.

**Result: BOTH TESTS PASS (1.5m).** The drag changed the stage, appended exactly one event carrying the
departing amount and probability, left the earlier events untouched, and moved the order. The closing
column refused entry, explained itself in its `title`, and no event recorded a transition into it.

---

# The map, in one place

## What the suite covers that a human walk would not

- **Silent no-ops.** `60` step 6 edits a locked deal, saves, and checks the database. A human sees a
  message and moves on; only a DB read separates "saved" from "silently didn't". Nothing else in this
  project catches that class of bug.
- **Append-only provenance.** `80` step 4 compares the stage-event list before and after a drag and
  requires the earlier rows to be the *same rows*. A human cannot eyeball immutability.
- **A gesture that must not work.** `80` step 6 proves a drag *cannot* close a deal. Absence of an
  effect is invisible to a walkthrough — you'd have to know to try it, and then know what to check.
- **Vocabulary flags rather than names.** `75` computes each tile from `IsOpen` / `IsWon` and compares.
  A human reading "Open pipeline: £1.2m" cannot tell whether the code branched on a flag or a label —
  which is the whole of Rule 2.
- **Required-field marking before save.** `10` steps 2 and 5 read the required-empty markers on an
  untouched form. A human fills the form in and never sees the state being asserted.
- **The boring screens, every time.** `20` tours ten grids without anyone remembering to check the
  unglamorous ones.

## What a human walk covers that the suite cannot

- **Whether the numbers are right.** No spec reads a price. `20` checks the price cells are read-only;
  `40` fills the inputs on either side of them; `75` checks a "stated" marker, not an amount. **A
  pricing bridge returning zeros, stale values, or nothing would pass every spec in this suite.** That
  is the single largest hole, and S2 lands directly in it.
- **Whether the story hangs together.** Each spec enters the app fresh. Nothing tests the demo as a
  *sequence*, so an ordering that makes no sense to a viewer is invisible here.
- **Whether anything looks wrong.** Overlapping controls, a mis-aligned column, an amount rendered
  without its currency, dark mode — no assertion was written for any of it.
- **Whether the language reads.** "Signed" vs "Closed Won" is a demo talking point; a spec can only
  check the string is present.

## Where the two overlap least usefully

Both the suite and a human walk verify that screens load and contain seeded rows. That is most of what
`20` does, and it is the cheapest thing to check either way. The suite's value is concentrated in `60`,
`75` and `80` — the three that read the database — and those are the three a human walk replaces least.

## Honest state of the six specs walked

| Spec | Result | Product or spec? |
|---|---|---|
| `10-deal-crud` | steps 1–12 pass, **fails at delete** | **spec** — `.first()` matched a hidden background tab's delete button |
| `20-demo-tour` | all ten grid screens pass, **fails at Product lines** | **spec, mine** — the step enters the entity browser then looks for the workspace's rail |
| `40-deal-workspace` | steps 1–9 pass, **fails at read-back navigation** | **spec** — bare `Deals` text locator, wrong surface |
| `60-close-deal` | **4/4 pass** | — |
| `75-dashboard` | **pass** | — |
| `80-board-drag` | **2/2 pass** | — |

**Three failures, three harness defects, zero product defects.** Every failure in this walkthrough is the
harness losing track of *which screen it is on* — a hidden background tab's delete button in `10`, and
entity-browser-versus-workspace confusion in `20` and `40`. That is the same root cause as the
landing-state work earlier tonight, so the remaining harness debt is concentrated in one place rather
than scattered.

**The split is the striking part.** The three specs that read the DATABASE — `60`, `75`, `80` — are
**green, fast, and assert the things that matter**: the close lock, the false-success case, tiles derived
from behaviour flags, append-only provenance, and a gesture that must not work. The three that drive long
UI walks and assert on page text — `10`, `20`, `40` — are the ones that break, and they break on
navigation rather than on any claim about the product.

That suggests where effort belongs. The DB-reading specs earn their keep; the page-text ones are
expensive to keep alive and assert the least. `10` step 8 is the clearest example — `toContain('20')` for
a probability matches any `20` anywhere on the page, including a date or a row count.

## If you fix three things, fix these

1. **Read a price somewhere.** Nothing in 22 spec files reads a number that came back from the pricing
   engine. `40` is the natural home: it already has a saved deal with two lines. Until then, "we tested
   the pricing bridge" cannot be said.
2. **One navigation helper, used by everyone.** Three of tonight's failures are three different files
   each finding their own way between the entity browser and the workspace. `lib/workspace.ts` already
   knows the workspace route; `lib/explorer.ts` knows the browser. Nothing owns *crossing between them*.
3. **Make `40` step 11 unconditional.** The child read-back is the strongest claim in the file and it
   sits behind an `if` that logs and passes when the affordance is missing.

---

# Round 2 — closing the gaps this map found

Same five-column shape. The point of this section is to show things **leaving** the "does NOT assert"
column, and what it cost to move them.

Every assertion below was proven able to FAIL before its green was trusted — by temporarily inverting it
and watching it fire on real data. The received values are recorded, because they are the evidence that
the assertion reads something real rather than passing on a technicality.

## Gap 1 — read a price (spec 40, and its server-side twin)

| Drives | Why | Asserts | Was previously | Result |
|---|---|---|---|---|
| After the save, opens Product lines and reads the two read-only cells | Rule 1 is a round trip: sales states intent, **the engine answers**. Only the asking was ever checked | `the unit price cell never carried a real figure — a dash or 0.00 here means the pricing engine did not price the line`; `the line total must be a real figure too`; and on a multi-quantity line, the two must be **different answers** | nothing — `20` checked the cells were read-only, `40` filled the inputs on either side of them | **PASS.** `engine priced line 1: unit=229 total=20610` — 229 × 100 × 0.9, matching the qty-100 line at 10% off |

**Proven failable:** threshold raised to `> 1e9` → fired with `Received: 229`.

**The server-side twin was worse than weak — it was vacuous.** `save-deal.SD19` asserted
`row.UnitPrice !== null`, and `__mj_BizAppsOrders.OrderLine.UnitPrice` is **NOT NULL in the schema**
(verified live). The database guaranteed it before any code ran; the check could not fail. It now asserts
`Number(row.UnitPrice) > 0` — the strongest claim sales can make without knowing a price. Proven failable
the same way: `> 1e9` → `✖ 0 passed, 1 failed`; restored → `✔ 1 passed`.

**Why not assert a figure:** that would mean this repo knowing a price, which is the accretion Rule 1
exists to stop. `> 0` says a real number came back without saying which.

## Gap 2 — spec 40's child read-back

| Drives | Why | Asserts | Was previously | Result |
|---|---|---|---|---|
| Reads the embedded order's lines from the database after the save | the file's strongest claim: **one** transactional save wrote the header *and* its children | `BOTH lines must have reached the database from ONE save`; and each line carries a real engine price | inside `if (section visible) { assert } else { console.log }` | **PASS** |

**Proven failable:** expected count set to 3 → fired with `Expected: 3, Received: 2`.

**It could never have fired, not merely "sometimes didn't".** The guard looked for a section titled
`Deal Lines` — an entity that no longer exists under D-DL1. Making it strict would have produced a
permanent red for a UI that is correct, so the claim moved to the database: a genuinely different surface
from the workspace that wrote it, held to the same standard as `60` and `80`.

**Two things that fell out of doing it:**
- My first version joined orders via `OrderHeader.Description`, which `CloseDealOperation` only sets **at
  close**. Most orders on this host have a null description, so an unclosed deal would have found
  nothing. Now joined through `Deal.OrderID`. `lib/db.ts`'s docblock claiming there is no such column is
  stale — there is one.
- The step originally sat downstream of the navigation defect this map documents, so it still never ran.
  A database read needs no navigation, so it moved ahead of that point — the right dependency shape, not
  a workaround.

## Gap 3 — the stage event's stamps on the CLOSE path

| Drives | Why | Asserts | Was previously | Result |
|---|---|---|---|---|
| Closes a deal, reads the appended event | Rule 3's payload. A count proves something was written; the stamps prove it is worth keeping | `the close event must stamp the amount the deal held on the way out — a null stamp is a row that answers no question later`; the probability is stamped and in range; `the close event must record the stage the deal moved INTO` | count > 0 only | **PASS** (all 5 tests green) |

**Proven failable:** amount bar raised to `> 1e9` → fired with `Received: 458`.

`StageEventsFor` did not select the stamps at all, so no browser spec *could* assert them. Provenance was
proven on the drag path (`80`) and not on the close path — the one that records a booking.

## Gap 5 — the false test name

`a UI close creates an order, appends a stage event, and locks the deal` →
**`a UI close appends a STAMPED stage event and locks the deal`**. The order assertion was removed under
D-OS1; the title went on claiming it and ran green. A passing test with a false name is worse than a red
one, because nobody goes looking.

## Gap 4 — spec 10's delete step: **still not executed**

The locator defect is fixed and the diagnosis confirmed from the headed run's call log:
`button[title="Delete this Record"]` **resolved 36 times, every one `hidden`**. MJ keeps every open tab's
form in the DOM and hides the inactive ones, so an unscoped `.first()` was a lottery weighted toward the
oldest tab. Both locators in `deleteRecordViaRecordView` are now scoped with `:visible` — the same fix
`40` already applies to its row locator and this file already documents for `fieldLabelVisible`.

**I then made the identical mistake myself** in the reload wait added the round before — a bare
`getByText(DEAL_NAME).first()` matching a hidden tab's copy — now `filter({ visible: true })`.

**But delete still has not run,** because the spec now fails one step earlier on its console keystone:

```
console.error: Error in BaseEntity.Load(MJ_BizApps_Sales: Pipelines, Key: ID=3B3686AB-…)
console.error: Error in BaseEntity.Load(MJ_BizApps_Sales: Deals, Key: ID=23549B45-…)
```

**Both IDs no longer exist in the database** (checked). These are records a previous run created and the
cleanup sweep deleted, whose references survive in **`__mj.UserRecordLog`** — 9 orphaned Deal rows and 6
orphaned Pipeline rows. The app faithfully restores them, fails to load them, and logs an error. The
product is behaving correctly; the harness is deleting rows it still points at.

This is the same root cause as the dead-record recovery in `openSalesApp`, and the proper fix is one line
in the cleanup sweep: **remove the `UserRecordLog` rows for the records it deletes.** That file is landed
and out of scope tonight, so the orphans are recorded rather than cleared.

### RESOLVED — spec 10 passes end to end, delete included

**The delete step has now executed, and `10-deal-crud` passes in full for the first time.**

Two things had to happen. The console keystone was tolerating nothing, so it stopped the run before
delete; the ONE fully-diagnosed shape is now allowlisted by
`KNOWN_DEAD_RECORD_RESTORE_ERRORS` — Explorer re-Loading records from `recentRecords` in
`DataExplorer.State`, which lives behind `UserInfoEngine`'s cache and cannot be cleared from this repo.
The allowlist names its mechanism, `expectOnlyKnownErrors` PRINTS what it tolerated, and every other
console error still fails the spec.

Then the actual defect, which only a headed run could show. **The row click was landing on the selection
CHECKBOX, not opening the record.** What opens is a slide-in *Details* panel carrying an
**"Open Full Record"** button, and until that is pressed there is no record view — and so no
"Delete this Record" anywhere on the page.

That closes the loop on the whole history of this step: before the visibility fix the locator matched
**36 hidden** copies of the button and failed on visibility; after it, the honest answer came back —
*not found* — because the screen genuinely has none. The `:visible` fix did not break anything; it turned
a misleading failure into a truthful one.

**The proof is in the sweep, not the tick.** On the previous run the teardown reported
`will_delete: PW-VERIFY Deal` — the sweep cleaning up what the UI had failed to remove. On this run
there is **no `will_delete` line at all**: the sweep found nothing, because the UI delete had already
done it. The database agrees — 0 `PW-VERIFY` deals, 0 pipelines, and the seeded 7 untouched.

So the row in the table above — *"does NOT assert: cascade"* — stops being academic. Deletion is now
exercised, and what it does not check (what became of the deal's team members, stage events and contact
roles) is a real, nameable gap rather than a note about a step that never ran.
