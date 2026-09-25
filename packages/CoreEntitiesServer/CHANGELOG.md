# @mj-biz-apps/sales-core-entities-server

## 6.8.1

### Patch Changes

- 024fb67: A deal whose status row is absent is now locked (#103).

  The close lock treated a status read that succeeded and found no row as "does not lock", so a closed
  deal whose `DealStatusType` row had gone became fully editable. It now locks, with the ordinary
  editable set of a deal that is not lost, the same as a failed read. `ResolveDealLockState` reports the
  same to the form and workspace, with its own notice.

  The deal can still be repaired: its status may be set to an open one as an ordinary save. Closing it
  from the missing status is refused, both by a status write and by `Sales.CloseDeal`, because nothing
  says whether it was already closed. `Sales.CloseDeal` now also refuses when the deal's current status
  cannot be read at all.

- Updated dependencies [024fb67]
  - @mj-biz-apps/sales-entities@6.8.1

## 6.8.0

### Minor Changes

- 17bd633: Product availability and forecast periods are judged on the business day (bc-aidp-next-golive#168).

  `ProductFilterFor` took an instant and chose the UTC day inside, so at 8 PM Central a product
  available from tomorrow was already offered and one whose last day was today had already gone. It now
  takes a calendar day — validated before it is interpolated into SQL — and `LoadProducts` passes today
  in the instance's business time zone from bizapps-common's `BusinessTimeZoneEngine`, defaulting to it
  rather than to `new Date()`.

  `CurrentMonthPeriod` chose the month with `getUTCMonth()`, so a nightly forecast job running in the
  evening of the last day of a month had already rolled over to the next one and the closing month was
  never snapshotted. It now takes an optional zone (UTC by default, which is what every existing caller
  gets) and `RunForecastSnapshot` passes the business zone. The re-run guard compares `CapturedAt` on
  the business day for the same reason.

  The period BOUNDARIES are unchanged and deliberately so: `PeriodStart`/`PeriodEnd` are `DATE` values,
  which are calendar days, and they are still built and read as UTC midnight. A zone conversion applied
  to a stored day moves it back one day west of Greenwich.

  The deal workspace's date boundary (`ToDateInput` / `IsUnparseableDate` / `FromDateInput`) delegates
  to the shared calendar-day helpers with its contract unchanged and its tests untouched; it is now
  also strict about days that do not exist, so a stored `2026-02-30` reports as unreadable instead of
  rendering an empty box.

  The dashboard and the deal form move onto the same day. `TodayUtc()` rolled over at UTC midnight, so
  from 19:00 Central the fiscal window, the close buckets and the inspect lists were already on
  tomorrow — and once the picker was fixed they disagreed with it on the same screen. The deal form's
  close countdown, its close clock and its next-step-overdue flag measured from the UTC day for the
  same reason, so a deal closing today read "1 day overdue" all evening.

  New: `ProductWindowCovers(from, to, day)` on `sales-entities` — the TypeScript reading of the same
  availability rule `ProductFilterFor` emits as SQL, for a caller holding the window's two columns.
  It exists because the integration check that derives PP2's expectation open-coded that comparison
  against a `DATE` column returned as a `Date`, where `String(value).slice(0, 10)` is `'Thu Aug 13'`:
  every windowed product fell out of the expectation and `AvailableTo` never bound anything.

  Breaking for direct callers: `ProductFilterFor(asOf: Date)` is now `ProductFilterFor(asOfDay:
CalendarDay)`, `DealWorkspaceService.LoadProducts(asOf?: Date)` is now
  `LoadProducts(asOfDay?: CalendarDay)`, and `TodayUtc()` is removed in favour of `BusinessToday()`.
  The last one is a rename rather than an alias on purpose: a name stating a zone it no longer uses is
  worse than a compile error.

  Requires `@mj-biz-apps/common-entities` 5.44.0, declared as `^5.44.0` — a floor with an upper
  bound, not an exact pin — in every manifest that names the `@mj-biz-apps/common-*` family
  (`common-entities`, `common-ng`, `common-activity-sync`).

  An exact pin is what a SIBLING app must not use here, and that is measured rather than assumed. The
  family self-pins in lockstep: `common-ng@X` and `common-activity-sync@X` each declare
  `common-entities@X` EXACTLY. So a caret on all three is coherent — whichever version the resolver
  settles on, it drags `common-entities` to the matching one, and there is one copy. What splits the
  family is an exact `common-entities` held at one version while a sibling floats: orders ships
  `orders-ng`/`orders-core-entities-server` declaring `common-ng >=5.44.0` and `common-entities

  > =5.44.0`, so a host installing sales beside orders can resolve `common-ng`5.46.0, which hard-requires`common-entities`5.46.0 — irreconcilable with an exact 5.44.0, and the resolver nests a second copy.
Two copies of`common-entities`is two`BusinessTimeZoneEngine`classes competing for one class-name
key in`BaseSingleton`'s global store, which makes the resolved zone depend on import order: this
  > release's own defect, arriving through the dependency graph instead of the code.

  That is bc-aidp-next-golive#258 in a different package. There, sales pinned `orders-entities` exactly
  at 5.13.0 while orders shipped 5.14.0; no resolver can satisfy two different exact pins from one copy,
  the nested copy re-ran every module-scope `@RegisterClass` in it, and `OrderNumber` stopped being
  minted. A sibling's exact pin is correct only while its number happens to equal the owner's, and
  nothing maintains that equality. The owner of a package may pin it exactly; a consumer in another repo
  should declare a range and let the owner's pin win.

  `@mj-biz-apps/orders-entities` is `^5.14.0`, which arrived from `next` in #126 — the same rule applied
  to the package where golive#258 actually happened. That pin belongs to that fix, not this one; this
  branch only carries it through the merge.

  `pnpm.overrides` holds all three `common-*` members at 5.44.0 for THIS workspace and CI. Exact is
  right there and wrong in a manifest for the same reason: overrides are not published. It forces a
  single copy where a manifest range only permits one, it pins the version the 637-test suite is
  actually measured against, and all three move together so a caret can never pair `common-ng` 5.46.0
  with `common-entities` 5.44.0. What travels to a consumer is the range in each `package.json`, which
  is what lets a host dedupe instead of nesting.

  The deal form's Overview panel now configures `BusinessTimeZoneEngine` in its own `ngOnInit` rather
  than relying on MJ's startup sequence having reached a lazily loaded `sales-ng` chunk. The engine fails
  open to UTC by design, so an unconfigured read is not a neutral default — it is silently the defect
  this release fixes, with one logged warning nobody reads.

### Patch Changes

- 9852aae: `@mj-biz-apps/orders-entities` is declared as `^5.14.0` rather than pinned exactly, so the pin stops
  needing a human to chase orders' releases (bc-aidp-next-golive#258).

  WHY THE EXACT PIN CANNOT HOLD. Orders OWNS `orders-entities` and pins it exactly inside `orders-ng`,
  `orders-server` and `orders-core-entities-server`, rewriting those pins on every release. Sales'
  declaration lives in another repo, so nothing moves it. Two different exact pins is precisely what no
  resolver can satisfy from one copy: it nests a second `orders-entities` under the sales packages, that
  copy re-runs every module-scope `@RegisterClass` in it, `ClassFactory` auto-increments priority so the
  duplicate `OrderHeaderEntity` outranks `OrderEntityServer`, and `OrderNumber` is never minted. Every
  new order header then fails its NOT NULL insert — the Orders screen, and every Deal that provisions an
  embedded order. It is silent, because the collision warning compares class NAMES.

  No repo's CI can see that drift. Sales resolves one copy of whatever it pins, orders is internally
  consistent, and both are green; the duplicate exists only in a host that installs BOTH.

  THE DRIFT HAD ALREADY RECURRED. #258 was fixed on 2026-09-22 by moving the pin 5.13.0 → 5.14.0. Orders
  has since shipped 5.15.0 and 5.16.0 and pins 5.16.0 internally, so a host installing today's published
  sales beside today's published orders nests three copies. Measured:

      sales declares `5.14.0`   ->  2 copies  (5.14.0 nested under sales, 5.16.0 at the root)
      sales declares `^5.14.0`  ->  1 copy    (5.16.0)

  A range defers to the owner's pin, which is what actually produces the single copy. The general rule,
  and the reason this is worth stating beyond one package: the OWNER of a package may pin it exactly; a
  CONSUMER in another repo declares a range and lets the owner's pin win. `mj-app.json` already declared
  its app-level dependencies this way (`mj-bizapps-orders: ">=5.1.0 <6.0.0"`); only the npm manifests
  had diverged.

  The floor is 5.14.0 because that is where the order-line veto seam was verified, not where a resolver
  happened to land — `dist/order-line-edit-veto.js`, its three exports and the `index.d.ts` re-export are
  present and identical in the 5.13.0, 5.14.0, 5.15.0 and 5.16.0 tarballs. `LoadDealLockOrderLineVeto`'s
  own documentation argued for the exact pin and is rewritten; leaving it would have left the repo's
  stated rule contradicting its manifests.

  The lockfile is deliberately NOT moved: this changes policy, not versions, so the only churn is the
  five specifier strings. Verified separately that `orders-entities` 5.16.0 builds and passes all 587
  tests with every other package held constant, so the range is safe across its whole span.

- 35092cf: A reopened deal could be left pointing at a voided order, in silence.

  golive#205 asks that reopening a deal "return the order to Quoted or Draft". The order follows
  `PipelineStage.OrderStatusOnEntry`, and a reopen restores the stage the deal was in BEFORE the close
  — so the order only came back if THAT stage declared something. `Proposal`, `Negotiation` and
  `Signed` declare `Quoted` and did. `Discovery` and `Qualification` declare nothing, so a deal lost
  from an early stage reopened with its order still `Voided`, and no Issue said so.

  Measured before the fix: DEAL-9002, lost from Qualification, reopened `Open` with ORD-000293 left at
  `Voided` and zero Issues raised. That is the silent half of D-OS1 — the deal neither followed nor
  complained.

  `DealEntityServer.recoverOrderOnReopen` now returns the order to `Draft` when a restored stage
  declares nothing, a reopen is in progress, and the order is neither editable nor booked. It lives in
  the entity server so the form, the status field, an importer and an agent all get it, and is keyed on
  the reopen scope so the ordinary backwards move — Proposal to Qualification — still leaves a live
  `Quoted` order alone. Declaring a status on the early stages would have fixed the reopen and broken
  that move.

  This also sweeps a premise recorded across **nine files**: that "Voided is TERMINAL in orders", so a
  reopen into `Proposal` would ask for a move orders refuses and warn. Orders says otherwise by its own
  API — `TRANSITIONS.Voided` is `['Draft', 'Quoted']`, `IsTerminal('Voided')` is false, and `Confirmed`
  is the terminal status. The refusal that rationale predicted never happens.

  The root cause is KI-27: orders collapsed its order lifecycle on 2026-08-25, which inverted which
  status is the dead end. Three checks were repaired at the time — `close-deal.CD24`,
  `close-won-order.CO5` and `71-lost-and-reopen`'s step 3 — but the prose around them was not, so two
  files ended up asserting the old premise a few paragraphs above the block that disproves it.

  The files this branch corrects: eight rows in `docs/STORY-AUDIT.md`; the deal workspace component, the
  deal form, `71-lost-and-reopen` and `docs/DECISIONS.md` (D-OS2's ruling and its own escape clause), two
  lines each; and one each in `CloseDealOperation`, CO5's intro, `DECISIONS-NEEDED.md` DN-18, and — the
  one no count had reached — the `_comments` block on the **Lost stage row in shipped metadata**, which
  named it as the reason the reopen warns.

  **Stated as files because the earlier counts were wrong, which is this section's own defect.** The PR
  said "eight places" and this note said "eleven"; the enumeration named `DealEntityServer` and the seed
  script's stage commentary, and neither carried the premise at all — `DealEntityServer`'s entire diff
  against `next` is one changed import. "Places" was never checkable, and an unverifiable count is how
  the premise spread in the first place. Files are countable: `git diff next...HEAD` and grep.

  The ruling is now recorded once, in `docs/DECISIONS.md` **D-OS4**, and the comments cite that rather
  than KI-27 — KI-27 is the lifecycle collapse that caused the inversion, not the transition fact.

  ***

  **The loss reason is a close stamp too, and a reopen now clears it.**

  It stayed set on a reopened deal, which was wrong twice. The form showed "LOSS REASON" on a deal that
  is Open, and `validateClose` reads `input.LossReasonID ?? deal.LossReasonID` — so the stale value
  satisfied the _next_ close. Measured: a deal closed Lost with a reason, reopened, then closed Lost
  again supplying **no** reason succeeded with zero Issues and silently re-used `Price`. golive#205 asks
  that "Lost should require a loss reason" and `close-deal.CD8` asserts that refusal; both were bypassed
  for the rest of the deal's life after its first loss, which is why CD8 never caught it — it opens a
  fresh deal that has never been lost.

  `DealStageEvent` has no loss columns and record-change tracking captured nothing for this field, so
  clearing alone would have destroyed the reason rather than moved it. The reopen now folds the reason
  into its own append-only event note first, then clears the header field.

  **`LossNotes` deliberately stays.** The symmetry is tempting and wrong: `close-lock.ts` keeps it — and
  only it — editable on a locked lost deal, because _"notes are the channel for corrections"_. Clearing
  it would destroy the one thing a rep is invited to write after a close, and alongside golive#224 it
  turns perverse: that change saves an in-progress note precisely because losing typed work is the bug
  it fixes, and this would then null it, leaving the text only in an event the rep never sees.

  The stale-value argument does not rescue it either. `validate()` reads
  `input.LossNotes ?? deal.LossNotes`, so a stale note can satisfy a `RequiresNotes` reason — but that is
  the **same** `??` fallback as the reason's, and clearing on reopen closes one route into a fallback
  rather than the fallback. It is ticketed separately and fixes both halves. The reason earned its
  clearing on a measured, silent bypass of a field a rep cannot correct by hand; free text they can
  overwrite is not the same case. `close-deal.CD32` asserts the notes SURVIVE, so the tidier-looking rule
  cannot be reintroduced quietly.

  ***

  **The close event now records which reason was chosen, which `close-lock.ts` already claimed it did.**

  `LossReasonID` is frozen on every lost deal on the stated grounds that _"the close event records which
  reason was chosen, and rewriting it would make that event dishonest"_. It did not. `routingNote()`
  wrote the caller's note and the routing outcomes and nothing else, so the only copy of the reason was
  the deal header — one field, frozen on the strength of a record that was never written.

  That matters most for the deal this issue does not otherwise touch: one that stays LOST and is never
  reopened. It has no reopen event, so before this change nothing recorded what it was lost for at the
  moment it was lost.

  The name is resolved where the reason is already validated — `validate()` is the only place that reads
  the `LossReason` row, so this adds a column to an existing query rather than a query. It is read there
  rather than from the denormalized `deal.LossReason` because the id being closed with is
  `input.LossReasonID ?? deal.LossReasonID`: when a caller supplies one, the denormalized name still
  describes the reason the deal happened to be carrying. `close-deal.CD35` closes with a reason that
  differs from the header's and asserts the other name is ABSENT as well as the right one present.

  `lossTrailFor` still puts the reason on the reopen event too. That is deliberate: the reopen row
  records the CLEARING, and a reader asking why the header is empty should not have to find the close row
  to learn what was removed.

- Updated dependencies [17bd633]
- Updated dependencies [9852aae]
- Updated dependencies [a8716f3]
  - @mj-biz-apps/sales-entities@6.8.0

## 6.7.1

### Patch Changes

- 52c10a4: Fix six field-level problems a tester hit creating a deal (bc-aidp-next-golive#259).

  - A new deal now takes its currency from the selling company's `AccountingCompanyProfile.FunctionalCurrencyCode`, falling back to USD. Create-only, never over a supplied value, and it cannot refuse a save: a host without accounting creates deals with no currency exactly as before.
  - `Deal.CurrencyID` ships a soft foreign key to accounting's currency table, so the Commercial section offers a picker and a name instead of an empty text box.
  - `Amount`, `MRR` and `ARR` render as currency while reading. Editing still goes through `mj-form-field`; there is no currency type to ask it for, and the platform gap is filed separately.
  - Six Deal labels drop their trailing "ID", and `MRR` / `ARR` stop reading as "Mrr" and "Arr".
  - The native `<select>` controls the deal form draws itself — Status, and the two loss-reason pickers — match the shared control's typography and underline instead of the browser's defaults.
  - Sales Contacts gains three picker columns, so two contacts with the same name and email can be told apart in a lookup.

- cc8452e: Move the exact `@mj-biz-apps/orders-entities` pin from `5.13.0` to `5.14.0`, in all five
  declarations.

  The pin has to be exact — `orders-entities` keeps its order-line veto registry in a module-scoped
  variable, so it is per-copy rather than per-process — and it has to match what orders pins inside
  its own packages, or the host app resolves two copies. Orders published `5.14.0` and rewrote its
  internal pins; this one is in another repo, so nothing moved it.

  What the drift cost: npm cannot satisfy two exact pins from one copy, so it nested a second
  `orders-entities` under the sales packages. That copy re-ran every module-scope `@RegisterClass` in
  it, including the generated `OrderHeaderEntity` for `MJ_BizApps_Orders: Order Headers`. Registration
  priority auto-increments, so the later copy outranked `OrderEntityServer` — and `OrderNumber`, which
  only that server subclass mints, was never assigned. Every new order header then failed its NOT NULL
  insert, on the Orders screen and on every Deal that provisions an embedded order.

  No behaviour in this package changes. Verified against the published `5.14.0` tarball rather than the
  version number: `order-line-edit-veto.js` is present and `index.d.ts` re-exports it, which is the path
  this package imports through.

- Updated dependencies [cc8452e]
  - @mj-biz-apps/sales-entities@6.7.1

## 6.7.0

### Patch Changes

- Updated dependencies [77278d7]
  - @mj-biz-apps/sales-entities@6.7.0

## 6.6.0

### Minor Changes

- 91ba029: Adding a product now updates the deal's amount and weighted amount.

  `Deal.Amount` is a cached copy of its order's `TotalGross`, refreshed only during a DEAL save. The line dialog saves the ORDER, so adding a product left the deal reading no amount and no weighted amount while its order carried a real total. Measured on a test deal: order `TotalGross` 229, deal `Amount` NULL, and no subsequent save able to move it.

  **The guard was a bootstrap failure, not a missing poll.** `amountMayHaveMoved` tested `order.Dirty`, `order.Lines.Dirty` and `AmountIsComputed === true` — and the last is what `refreshAmountFromOrder` _stamps_ once it has cached a figure. A deal that never had one is false on all three, permanently; by the time anything saves the deal, the order the dialog committed is clean.

  The added term is `Amount === null` — the unbootstrapped state itself, not a comparison between the two figures. It costs one read per save for exactly that state and stops as soon as a figure is cached, because `AmountIsComputed` then carries it.

  It does **not** reintroduce polling, which the note in `Save()` rejects for good reason. A header-only deal with a typed amount is non-null and never read; one with no amount reads an order whose `TotalGross` is NULL — `SUM` over no rows — and `refreshAmountFromOrder` returns without touching a column. Drift caused by someone editing the order directly is still not chased here; that remains what `AmountSourceHash` is for.

  **And the deal is saved when a line commits**, so the figure appears while the rep is looking at it rather than after some later unrelated save. A full save rather than a targeted amount write: `Amount` has one author — `refreshAmountFromOrder`, where the provenance stamps are set together — and a panel reaching in to write it is how a cached figure and its fingerprint start disagreeing. The stated cost is that other unsaved edits commit with it, which is the right answer while composing.

  **And the deal save had to be forced past the dirty check**, which is what made the first two attempts look like they had changed nothing. A line save changes the ORDER; the deal's own columns are untouched, so it is not dirty — and `BaseEntity.Save()` skips the provider entirely when nothing is dirty. `FormComponent.SaveRecord()` takes no `EntitySaveOptions` and so cannot ask otherwise, so the request never left the browser and the entity server never ran. The seam calls `Record.Save()` with `IgnoreDirtyState`, still a full deal save.

  **The guard also had to stop asking the wrong question.** `OrderID_Object` is the IN-MEMORY embedded order and is null on any save that did not load it — which is most of them — so an `!!order &&` prefix short-circuited every other test. The note claiming lined deals "re-read TotalGross on every save" was therefore true only when the order happened to be in memory. The dirtiness tests, which genuinely need the object, stay behind it; the state tests ask `OrderID` instead, which is all `refreshAmountFromOrder` needs.

  None of the three works alone: without the forced save nothing reaches the server, without the FK-keyed guard the save refreshes nothing, and without the bootstrap term a deal that never had an amount can never acquire one.

  Found by measurement rather than reading, after two confident and wrong diagnoses: deal `__mj_UpdatedAt` 00:32:43 against its order at 00:39:08 with three lines totalling 1057. A deal timestamp older than its order's says the save never ran, which no amount of studying the guard would have revealed.

  The guard's decision table is reproduced in tests rather than extracted — changing code to suit a test is its own problem — and a second test reads the shipped expression and asserts every term of it, so the copy cannot drift from the original unnoticed.

- 926ac7a: A new deal is born with an owner: the account's owner when it has one, otherwise whoever created it.

  Nothing populated `DealTeamMember` — not the deal type, not the pipeline, not the account — so `stampOwnerFromTeam()` had nothing to derive from, and the Overview reported _"No owner assigned."_ on a deal created seconds earlier. The form's team panel is gated on the deal being saved, so at the moment of creation there was no way to supply one either: every new deal was unowned and stayed that way until somebody noticed.

  **Why the entity and not the form.** `DealTeamMember` is the source of truth for who is on a deal and `Deal.OwnerEmployeeID` is a stamp derived from it, so a form that wrote either would be a second authority on membership. In `Save()`, an Action, an agent and the HubSpot importer all get the same default from the same code.

  **Why the account first.** A deal on an existing customer belongs to whoever runs that customer, whether a rep, an SE or an admin typed it in — so it beats the creator, who is merely the person at the keyboard. The creator is the fallback for a deal with no account yet, or an account nobody owns.

  It calls the existing `SetOwner()` rather than writing roster code: `DealTeamMember` is unique on _(deal, employee, role)_, so replacing an owner is a remove plus an add, and the collection contributes deletions before insertions. Restating that would have been a second implementation of the same intent.

  **It is a default, not a rule.** Each of these leaves the deal exactly as the caller left it: an update rather than a create, a caller that already supplied a roster (guarded on `RosterDrivesThisSave`, the same test `stampOwnerFromTeam` uses, so the two cannot disagree), and nothing resolving at all — `System` and `Anonymous` have no linked Employee, and an unowned deal is the honest outcome. A failed read of the account is also not fatal. The one thing this must never do is cost someone a deal they were creating.

  Two details worth recording. `UserInfo.EmployeeID` is typed `number` in `@memberjunction/core` while the column is a `uniqueidentifier` — verified against the database — so it is read as a string and anything else is ignored rather than written into a foreign key. And it does not reuse the veto's `SafeID`, which throws: that is right where ids arrive from Orders, and wrong on our own field on a deal somebody is creating.

  Ten tests cover both resolution paths and every way it declines; all four guards are mutation-checked.

- b15ec15: Sales answers Orders' question about order lines, so a closed deal's lines are actually frozen.

  `orders-entities` asks whether an order line may be edited — `RegisterOrderLineEditVeto` — and refuses
  nothing until something registers. Nothing ever has. The seam shipped inert on purpose, because Sales
  resolves `orders-entities` from npm and could not call a function that had not been published yet.
  This is the app with the stake answering, and it is what closes golive#206 item 1.

  **By flag, never by name.** The lock is `DealStatusType.LocksDeal`, the same flag the board, the deal
  form and `DealEntityServer` already read. Won, Lost and Abandoned all lock, a deployment may add
  another, and a rule matching status names would quietly stop covering it. `vwDeals` exposes
  `DealStatusType` as a string and it is deliberately unused.

  **The refusal names the gesture**, because the seam passes create/update/delete: _"before adding a
  product"_, _"before removing a product"_, _"before changing what was sold"_. Each opens with the
  sentence golive#207 settled and the deal form and workspace already use, so a rep meets one voice
  across three screens rather than three descriptions of one rule.

  **A lookup that cannot answer is not an approval.** A failed read throws, and
  `ResolveOrderLineEditRefusal` turns that into a refusal naming the fault. Returning null would let a
  frozen line change because the thing guarding it was briefly unreachable — the same trade
  `DealEntityServer.readStatusLockFlags` already makes for the close lock.

  **Nothing is cached, and the cost is two reads per line.** Orders asks once per line, so a fifty-line
  order graph save costs a hundred round trips. A memo of the verdict would be wrong: the registry holds
  one instance for the life of the process, so it outlives the truth — a deal reopened a moment ago
  would keep refusing, and a deal just closed would keep allowing. An earlier draft memoed only the
  order-to-deal mapping, which cannot go stale that way; it also saved nothing, because the deal row
  still has to be re-read for its current status. **The test asserting the cost is what caught that.**
  If the cost ever bites, the fix belongs in the seam — asking once per save — not in a cache here that
  has to be right about when a deal changed.

  **Where the registration lives matters.** It is called from `sales-core-entities-server`, which
  DECLARES `@mj-biz-apps/orders-entities`. `sales-server` does not, and resolves that name transitively
  to whatever is published — measured locally, it resolves to the npm build while the declaring package
  resolves to the workspace. Putting the import in the package that owns the dependency is what lets
  the version requirement be stated at all.

  **And it is now stated exactly.** orders#206 merged and published `orders-entities@5.13.0`, which
  carries the seam; every `@mj-biz-apps/orders-entities` declaration in this repo -- the four packages
  and the root -- is pinned at **`5.13.0`**, and the lockfile resolves a single copy.

  **Exact, not a caret, and that is the load-bearing part.** The registry is a module-scoped
  `let hostVeto` in `orders-entities`, so it is per-COPY rather than per-process: if Sales ever
  resolved a different version than the `orders-core-entities-server` that reads it, the registration
  would land in one copy and the lookup in the other, and the veto would refuse nothing while every
  test here still passed. Every orders package pins `5.13.0` exactly; matching that is what keeps it
  to one copy. A caret would compile and then silently do nothing, which is strictly worse than the
  honest build failure this replaced. It was two copies for a moment during this change -- the four
  package declarations moved first and the ROOT one was still `^5.2.1`, which the lockfile duly
  resolved alongside 5.13.0 -- so this is measured rather than theoretical.

  13 tests, 7 mutations all killed: the flag never locking (the defect), every status locking, an
  order with no deal falling through, each of the two failed reads allowing instead of refusing, a
  hostile id reaching the filter, and the create gesture getting the wrong words.

  Driven end to end against a real database as well: a real deal and the order it owns, open then
  closed, with the registered vetoer — the grid path refused, the order-graph path refused, a delete
  refused, Orders' own writes still allowed, and a `ContextUser` on every call.

### Patch Changes

- Updated dependencies [40d8f7d]
- Updated dependencies [f1ecd20]
- Updated dependencies [ad9191c]
- Updated dependencies [2f1a3ea]
- Updated dependencies [c3b23cc]
  - @mj-biz-apps/sales-entities@6.6.0

## 6.5.0

### Patch Changes

- 079111d: Integration checks compile against `common-activity-sync` 5.43.0, which is what the host already runs.

  `packages/IntegrationTests` did not build against 5.43.0. CI was green only because `pnpm-lock.yaml`
  pinned **5.37.0** — the declared range was `^5.37.0`, which resolves 5.43.0 on any install that does not
  honour the lockfile, and on any workspace with a local `bizapps-common` checkout linked in.

  **It silently disabled the mutation harness.** `mutate-checks.mjs` builds before applying each mutation,
  so every mutation reported `BUILD FAILED` and then `skipped` — a skip, not a failure, which is the exact
  shape `docs/CHECK-MUTATION-EVIDENCE.md` exists to warn about. The harness is how this repo proves a check
  can fail, and it could not run at all for anyone resolving 5.43.

  Two breaking changes had landed in common between 5.37 and 5.43, both inside a **minor** bump:

  - **`NormalizedItem.HasAttachments` became required** (`4ad78ac`, _"honour IncludeAttachments instead of
    ignoring it"_). The `item()` fixture built the object without it; it now passes `false`, the honest
    default for a fixture carrying no attachments.
  - **`MSGraphCalendarSyncProvider`'s second constructor argument is now an `ActivityMessageTransport`**
    (`Describe` / `IsLive` / `Fetch` returning a `RawBatch`) rather than a Graph client exposing
    `GetEvents()`. AC21's stub is rewritten to that seam, carrying the same raw Graph event, so what the
    check claims is unchanged — only the seam moved. `IsLive: true` is deliberate: before 5.43 the provider
    hard-coded it, and `FetchRaw` refuses only when live AND not allowed, so `false` would take the other
    branch and quietly stop testing the path AC21 was written for.

  The range moves to `^5.43.0` and the lockfile follows, so the declared dependency now says what the code
  actually requires. The MJ host in the linking spike already runs 5.43.0, so sales' server code was
  executing against 5.43 while its tests compiled against 5.37 — those should not disagree.

  No behaviour change: two test fixtures and a dependency range.

- aaf9189: Five defects the deal-lock stack (sales#72, #73, #78, #79, #80) merged with, and the three checks that were looking the wrong way.

  **A refused save put the caller's status back.** `saveDeclared` reverts `DealStatusTypeID` to its persisted value so the close lock sees a clean field — correct for a save that proceeds, a trap for one that refuses. A caller who read the refusal, fixed what it named and saved the SAME object got `planStatusTransition() === null` on `!field?.Dirty`: no close ran, the other edits committed, and `Save()` returned **true**. An open deal carrying a loss reason, and a caller told it worked. Restored in `refuseSave` rather than at each `return false`, for the same reason the `finally` above it exists — there are four exits and the bug is always the one added later.

  **A stamp failure was silent.** The `catch` around `stampCompanyFromPipeline`/`stampOwnerFromTeam` was `LogError` + `return false`, so `ResolveOwnerRoleID`'s "no active DealRole has IsOwnerRole = 1. Seed one before assigning an owner." — a message that names its own remedy — reached the user as "Unknown error creating record" (bc-aidp-next-golive#216). It now goes through `refuseSave`; the log line still contains the exact substring that issue tells people to grep for.

  **Row 18 printed column names.** `DEAL_FIELD_LABELS` holds exactly the editable-while-locked set plus `DealStatusTypeID` — the fields row 16 lists. Row 18 names the FROZEN fields, none of which were in the map, so every one fell through to its raw column name. The fallback now splits the column name and drops a trailing `ID`, so the map is an override rather than the only source of a label and a column added tomorrow cannot regress it.

  **The reopen test only ever saw one of two panels.** `source.indexOf('public async ConfirmReopen...')` returned the Pipeline panel's copy, so `MJSDealClosePanel` was invisible to it — permanently. That is how the Close panel shipped a reopen which never left edit mode under a green test named for exactly that. It now finds every declaration and asserts about each, and accepts either spelling of the reload (`RefreshRecord()` directly, or `refreshQuietly()`), because pinning one would have failed the panel that does it correctly. Verified against sales#72's tree, where it correctly fails `MJSDealClosePanel`.

  **A Playwright assertion outlived its string.** sales#79 rewrote the closing column's lock title to "Deals cannot be moved here."; `80-board-drag.spec.ts` still asserted `/closes and locks/i`. The Explorer harness is deliberately out of CI, so nothing caught it. `COVERAGE-MAP.md`'s row for that step had drifted independently — it claimed `/workspace/i` where the spec asserts `/form/i` — and now matches.

- 83ca517: A failure after the save now tells the caller what happened, instead of contradicting itself.

  Two paths returned `false` AFTER `super.Save()` had already registered a SUCCESS result: the status-write transition failing, and the `saveWithinScope` catch. `this.Load(this.ID)` does not clear the history — core guards its `init()` with `if (!this.IsSaved)` and the deal is saved — so a caller doing the obvious thing read `Save() === false` beside `LatestResult.Success === true` and a `CompleteMessage` of `undefined`, which the resolver renders as "Unknown error". A caller following exactly the pattern `deal-workspace.service.ts` uses was told the save succeeded. That is worse than silent: the last entry on the history contradicted the return value. Since golive#205 made the status-write trigger the primary close path for importers and agents, it is also the path most likely to hit it.

  `reportPostSaveFailure` is a sibling to `refuseSave` rather than a reuse, because two things genuinely differ. It does **not** restore the caller's status — `refuseSave` does that because nothing was written and a retry must still carry it, whereas here the row has already moved and `Load()` has resynced this object to it, so re-dirtying a field to a value the database just rejected would invite the same failure again. And it carries `CloseDealOperation`'s structured `Issues`, which were being joined into a `LogError` and dropped; those sentences are the only thing that says why the close refused.

  The transition message names both halves — the field edits were saved, the status did not move — because "the save failed" is as wrong as "it worked", and a caller who cannot tell the difference will either re-send edits that already landed or assume a close that never happened. The scope-catch message says whether the rollback itself succeeded, since a clean rollback means retry and a failed one means the row needs looking at first.

  **A transaction was considered and is not available.** The transition reaches bizapps-contracts and bizapps-orders through seams, so there is no single database to be atomic in; `CloseDealOperation` is a remote operation owning its own scope and rollback; and it loads its own copy of the deal, which is why it must run after the commit rather than inside it. Narrowing the window belongs upstream, in the pre-flight that already refuses a lost close with no loss reason before a single row moves.

  `M-CD30` is re-aimed. Its anchor was the registration line plus its `return false`, which stopped being unique the moment the new helper was added beside `refuseSave` — and two matches means the driver SKIPS and exits 1, so CD30 would have lost its proof while reading exactly as before. It now targets `failed.Message`, the line only `refuseSave` has, and isolates what CD30 actually claims: that the refusal's sentence reaches the caller.

- 8f82990: Two defects on a closed deal: the owner could not be reassigned from the workspace, and a refused save told the caller nothing.

  Both were found by writing the check golive#206 item 2 had been missing. Neither would have been found by reading the code, and neither failed any existing check.

  **1. `SetOwner()` was refused on a locked deal.** golive#206 item 2 says reassigning a rep after close is record-keeping and must be allowed, and it held on one surface and not the other. The deal form's Internal team panel edits `DealTeamMember` rows, leaving `Deal.OwnerEmployeeID` clean, so it passed the lock. The deal workspace's owner picker calls `DealEntity.SetOwner()`, which loads the roster and then assigns the stamp itself — so the field arrived at `checkCloseLock` dirty, was counted as an edit to a frozen field, and the save was refused.

  `ownerStampEditRefusal` already knew that assignment was legitimate when the roster drives it; `checkCloseLock` never asked. The condition is now a single `RosterDrivesThisSave` predicate with three readers, which is what stops them disagreeing again — it was spelled out twice and omitted once, and the omission was the bug.

  The carve-out is narrow and grants nothing: `SD26`'s rule stands, a caller who hand-sets `OwnerEmployeeID` without touching the roster is still refused, and `stampOwnerFromTeam` re-derives the stamp from the roster afterwards regardless of what was supplied. `CD29` asserts both directions.

  **2. Every refusal in `Save()` was `LogError`'d and nothing else.** The caller got a bare `false` and the reason went to the server log.

  golive#207 row 18 is explicit about who that message is for: row 17 is what the form shows a person, and row 18 is _"what the save returns to whoever asked — the form, an import, an agent or a raw API call"_. Logged, it returned to nobody. The form looked correct only because `DealFormComponentExtended.Validate()` produces row 17 for itself; every other caller got silence.

  The three refusals now go through a `refuseSave` helper that registers a failed `BaseEntityResult`, so the sentence lands on `LatestResult` where a caller reads it. Registered rather than assigned, because `LatestResult` returns `null` on an empty history while typing itself non-null — the same mistake that reached production in orders' line delete.

  **A source-level test could not have caught this.** `deal-lock-server-refusal-copy.test.ts` proves row 18's sentence is in the file, and it was — every word of it, correct and unreachable. `CD30` runs a real save and reads the message off the result, and it is the only check that does: `M-CD30` returns the refusal to log-only and fells CD30 **alone**, with all 129 other checks still green. That is the measurement of how unread the message was.

  `M-CD6` was re-aimed in passing, because the frozen-field filter it anchored on became a named predicate when the owner carve-out was added. Same mutation, new anchor. Anchor sweep: 97 of 97, 0 skips. Count bumped to 30 / CD1-CD30.

- fe8d94a: A deal status that cannot be read no longer closes the deal.

  `readStatusLockFlags` fails closed — it returns `LocksDeal: true` when the read fails. That is right for the close lock: an unreadable status means we cannot prove the deal is unlocked, so the edit is refused, and an unreadable status refuses more, never less.

  `planStatusTransition` reads the same value to mean _"the target status closes the deal"_. Under the same default, a transient failure on one status row produced a **Close plan** and ran a real close — stage event, contract, finance tasks, a voided order — on a save that asked for none of it. One default, two readings, opposite consequences. The fail-closed instinct that protects the lock is what fires the close.

  Guessing the other way is no better: a status that really does lock would then be written with no close behind it, which is the defect golive#205 was filed about. So neither guess is taken. `readStatusLockFlags` now reports whether it actually read the row, and the trigger refuses the save when it did not — the same instinct `planStageDefaults` already states for its own read, _"Unreadable is treated as do not derive"_, and the same trade: a rep retries one save, rather than a deal closing that nobody asked to close.

  A status the lookup succeeds at but does not **find** is treated the same way. `Success: true` with no rows is not a failure, but it is equally unanswerable — there is no row to say whether that status closes a deal — and the foreign key would refuse the write a moment later with a worse message.

  **The refusal runs BEFORE the status is reverted, and that ordering is what makes the retry work.** The revert exists so the close lock and `super.Save()` do not write a status the transition is about to move; on this path nothing downstream runs, so reverting would serve nothing and would cost the one thing the message asks for. A reverted field is clean, so a caller who reads "try again" and re-saves the same object would get `planStatusTransition() === null` on `!field?.Dirty` — no close, the other edits committed, and `Save()` returning true. Left dirty, the retry reads the status again, which is exactly what a transient failure needs.

  Eight tests, three mutations, all killed: removing the guard (which restores the defect exactly), making the read always claim success, and making the failure path claim success. The three that would have shipped it.

  **Two of those tests were added after re-running the mutations, because the first one was not killed.** Every original test drove `planStatusTransition` and asserted the PLAN was `Unreadable`; none drove `saveDeclared`, where the guard actually lives. So replacing `if (transition?.Kind === 'Unreadable')` with `if (false)` — the defect, exactly — failed nothing. One test even carried the words _"and it must be the one the save refuses"_ while asserting only the plan's Kind. A plan nobody acts on is not a refusal.

  The lock's own behaviour is unchanged — `statusLocksDeal` still fails closed, and a status row that is merely absent still reads as not-locking there, exactly as before.

- Updated dependencies [9404cfc]
- Updated dependencies [dd4a8d4]
- Updated dependencies [aaf9189]
  - @mj-biz-apps/sales-entities@6.5.0

## 6.4.0

### Minor Changes

- 8e041da: Deal form: plain-English copy on the Overview, header and save refusals (#207).

  Rewrites sixteen strings on the Deal form into the wording the tester specified verbatim on
  bc-aidp-next-golive#207 — the six Overview warnings, the green all-clear line, the Amount and
  Forecast tile subtexts, the Close tile's undated label, the Situation card owner, the Next move
  empty state, the "What's being sold" empty state, the stale-amount flag on both the header and the
  form, and the server's owner-edit refusal. None of the phrasing is ours.

  Copy only: which message appears and when is unchanged.

  Five rows of the tester's table are deliberately not done, following the sequencing notes on the
  issue itself. The three lock messages say "set the status back to Open", which is only true once the
  close/reopen work lands, so they keep their current wording until it does. The Close tile's day
  counts wait on the DATE to DATETIMEOFFSET conversion (golive#168, still open) — rewording first
  would have converted deals reading "46272 days overdue" in full prose. The two field labels are
  metadata rather than a string in a panel and travel separately.

### Patch Changes

- @mj-biz-apps/sales-entities@6.4.0

## 6.3.3

### Patch Changes

- @mj-biz-apps/sales-entities@6.3.3

## 6.3.2

### Patch Changes

- @mj-biz-apps/sales-entities@6.3.2

## 6.3.1

### Patch Changes

- d40fd69: License declarations now agree on BUSL-1.1 everywhere.

  The Open App manifest (`mj-app.json`) declared `"license": "ISC"` and the README badge
  advertised ISC, while `LICENSE` and every `package.json` declared BUSL-1.1. The manifest is
  what an MJ deployment reads on install and the badge is the first thing a reader sees, so
  between them they were the repo's loudest license statement — and the wrong one. The badge
  now links to `LICENSE`.

- Updated dependencies [d40fd69]
  - @mj-biz-apps/sales-entities@6.3.1

## 6.3.0

### Patch Changes

- Updated dependencies [11b3613]
  - @mj-biz-apps/sales-entities@6.3.0

## 6.2.0

### Patch Changes

- Updated dependencies [4fc8b40]
  - @mj-biz-apps/sales-entities@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [0e6b1a3]
- Updated dependencies [f76f9c9]
  - @mj-biz-apps/sales-entities@6.1.0

## 6.0.0

### Patch Changes

- 2b6c4ca: When DealLinker attributes an activity to a deal, also snapshot the deal's Account (Organization) and Primary Contact (Person) as `LoggedFor` links. Reverse lookup on Person/Org survives a later contact or employer change.
- 6d46c4a: Lined deals cache `OrderHeader.TotalGross` onto `Deal.Amount` (sales copies, never sums). A typed figure survives only on a header-only deal.
- Updated dependencies [c2d8e5a]
  - @mj-biz-apps/sales-entities@6.0.0

## 5.2.0

### Minor Changes

- 1fa15da: Ship BizApps Sales as an installable Open App.

  The npm packages have been published since 5.1.0, but the app itself could not be installed: there
  was no release workflow, no `vX.Y.Z` tag for the Open App resolver to find, two dependency ranges
  that no published version could satisfy, and — the substantive one — no metadata seed.

  - **`migrations/V202608251930__v5.2.x__Metadata_Sync.sql`.** MJ never reads `mj-app.json`'s
    `metadata.directory` at install; seeding happens exclusively through `migrations/`. Until this
    file, all 22 directories under `metadata/` shipped nowhere, so a clean `mj app install` produced
    every table, view and CRUD proc and no deal status types, no pipelines, no stages, no queries, no
    actions, no remote operations and no application. Every install step reported success. 424
    creates, all with hardcoded UUIDs; 50 updates, every one keyed to an ID the baseline pins.
  - **`migrations-teardown/V001__Retire_Sales_Core_Rows.sql`** retires that payload from the shared
    core schema on `mj app remove`, so a reinstall does not collide on the same fixed UUIDs. The
    seeded placeholder `Company` is deliberately excluded — 30 NOT NULL keys point at `Company`
    across core, accounting and orders — and the seed's one `spCreateCompany` is guarded instead.
  - **`scripts/check-distribution-seed.mjs`** (+ self-test, + `Distribution Gate` workflow) fails the
    build when metadata changes without the seed being regenerated, and when shipped SQL carries a
    placeholder `mj app install` cannot resolve.
  - **Dependency ranges corrected.** `mj-bizapps-common` asked for `>=1.0.0 <2.0.0` and
    `mj-bizapps-orders` for `>=0.1.0 <1.0.0`; the only published versions are `5.x` in both cases, so
    install would have failed at resolution. `mj-bizapps-tasks` is raised to `>=1.2.0` because the
    seed writes `TaskType.Code`, which arrives in 1.2.x.
  - **`fixed` versioning + `publish.yml`**, so a release cuts one `vX.Y.Z` tag — the form the Open App
    version resolver reads — instead of five per-package tags.

### Patch Changes

- Updated dependencies [1fa15da]
  - @mj-biz-apps/sales-entities@5.2.0

## 5.1.0

### Minor Changes

- 0691454: Close-won now creates a real contract — the D-CF4 stub retires completely.

  `LiveContractsSeam` calls `Contracts.SaveContract` and `Contracts.RenewTerm` by ClassFactory key, so both
  close-won paths are live. Import-free: no `@mj-biz-apps/contracts-*` import or dependency, and Sales
  builds, passes CI and behaves identically when contracts is absent.

  The two downstreams now resolve INDEPENDENTLY. All four deployments are real — neither sibling, orders
  only, contracts only, both — and a single seam that assumed they arrive together would have disabled the
  contract path on any host without orders.

  Money boundary holds: Sales sends product, quantity and term structure and sets no price.
  `CommittedAmount` is a negotiated commitment stated as zero, never `Deal.Amount` — that is orders' cached
  figure for the whole deal and would both overstate the contract and launder an orders number into a
  contracts field.

  Verified end to end against a seven-app isolated stack: **42/42** integration checks, including new
  CT1–CT4. See `docs/KNOWN-ISSUES.md` KI-13 for the contracts-side defects found along the way.

- 1da61e1: Closing a won deal now creates a real, booked order.

  The D-CF3 seam was written against `Orders.CreateOrderInState`, transcribed from `origin/mjdev/orders-flow`.
  That branch never merged: orders' `next` ships eleven operations and **no create-order operation of any
  name**. Orders' own canonical creation path is the entity graph — `OrderEntityServer.Save()`, which is what
  `order-builder.ts` drives — so sales now creates the order exactly the way orders does, and orders' server
  code mints the number, prices the lines and posts them to the ledger.

  `PreviewOrderMoney` delegates money to `Orders.PriceOrder`, which accepts a draft with no `OrderHeaderID`
  and so prices something that was never persisted. Sales sends `ProductID`, `Quantity` and a requested
  discount; it sends no price, and there is no arithmetic in the handoff.

  The seam selects itself from the DEPLOYMENT: live when orders' entities are registered, stub when they are
  not. Sales still installs standalone — `DealLine.ProductID` remains a soft reference and no sales package
  imports orders' TypeScript. `Orders.PriceOrder` is invoked by ClassFactory key, a string.

  The deal→contract path (D-CF4) stays stubbed and clearly marked. Contracts is not in the workspace, so it
  cannot be proved end-to-end, and half-wiring it would be worse than leaving it honest.

  New `close-won-handoff` bundle (CW1–CW4), verified 4/4 against a live six-app host: the order is created and
  its number minted by orders, its lines carry the picker-set `ProductID`s, every line is priced by orders'
  engine and posted to a journal entry, and the booked total equals an independent `Orders.PriceOrder` preview
  of the same draft. Held out of the default gate, like `product-picker`, because it requires orders.

- 57d29f0: Add `CloseWonTaskService` — the finance tasks a won deal raises (S-US2 #34, S-US3 #35).

  Both pipelines get an order-review task linked to the deal's order; a pipeline whose
  `CloseWonPolicy.CreateContract` flag is set also gets a contract-processing task.
  Pinned by WT1–WT6.

  NOT wired into `Sales.CloseDeal` — that file is mid-rework for the embedded-order
  redesign, and the wiring lands after it.

  Sales now depends on `@mj-biz-apps/tasks-core` and `@mj-biz-apps/tasks-entities`.

- b309a07: A deal and its children are Related Record Collections. `DealDraft` and `Sales.SaveDeal` are retired.

  `Deal` now declares **`Lines`**, **`PaymentSchedule`** and **`Team`** in `EntityRelationship` metadata, so
  CodeGen puts typed, writable collections on the generated entity. The same object graph therefore exists in
  the browser and on the server, travels over `MJ.SaveEntityGraph`, and persists through `EntitySavePlan`
  inside one transaction — header first, then removals, then children.

  **Two things existed only to work around the absence of that, and are gone.** `DealDraft` was a UI-side
  model with its own line and instalment arrays; `Sales.SaveDeal` was a remote operation whose whole job was
  to rehydrate the draft's payload into a server-side entity tree, because the entity a browser held had no
  child collections to save. `DealEntityServer` no longer hand-rolls collections, a deletion queue, a
  re-sequencer or an explicit transaction either.

  **BREAKING for anyone importing `DealDraft` or `SalesSaveDealOperation`** from
  `@mj-biz-apps/sales-entities`, and for any caller of `Sales.SaveDeal`: build a `DealEntity`, add children
  through `deal.Lines` / `deal.PaymentSchedule` / `deal.Team`, and call `deal.Save()`.

  **Removal is now EXPLICIT, and this is the one behaviour change rather than a refactor.** `Sales.SaveDeal`
  treated a submitted `Lines` array as the complete desired set and deleted anything missing from it. A
  collection deletes only what was explicitly `Remove()`d — so a header-only save (an Action renaming a deal,
  an agent nudging `NextStep`) can no longer destroy children by not mentioning them, which under the old
  contract was silent data loss. Integration checks SD6 and SD13 pin both halves.

  `DisplayOrder` sequences **contiguously from 1** rather than 10/20/30: the collection's sequencer has no
  increment option, and the old step was cosmetic because every add and remove re-sequenced the whole
  collection anyway.

  **The validation rules moved onto the entities** — `DealEntity`, `DealLineEntity`,
  `DealPaymentScheduleEntity` — so they run in the browser _and_ on the server, on the one path every write
  takes, instead of in a model an Action or an agent bypassed. `DealEntity.SetOwner` is shared for the same
  reason. What still needs a database stays server-only: deal numbering, and the `CompanyID` and
  `OwnerEmployeeID` stamps — two rules that turned out to be enforced _only_ by the retired operation.

- be23e16: The demo now shows a priced deal and a stated one, and provisioning reaches deals that already exist.

  `Deal.Amount` became a cache of `OrderHeader.TotalGross`, and the provenance rule holds: a hand-typed
  figure is never overwritten. But every seeded deal WAS hand-typed, so the cache was invisible and so was
  the argument it makes. `scripts/seed-demo-lines.mjs` now drives the entity layer for five of the seven
  seeded deals — lines by product and quantity only, priced by orders — and leaves two stated on purpose.
  Run from `seed-demo-data.sh`, separately re-runnable, and allowed to fail without failing the seed.

  **It found a real defect.** `provisionEmbeddedOrder()` returned early on `this.IsSaved`, so an order could
  only ever be provisioned on a deal's FIRST save — every deal that already existed without one was
  permanently unable to acquire one, and reaching for the embedded order built an unstamped record that died
  two apps away on `CompanyID cannot be null`. It now asks whether the ORDER is saved, which covers both the
  new deal and the old one. Pinned by `save-deal.SD24`, mutant `M-PV1`.

  **And the seeded close-won policy named a contract type that has never existed.** It said `Standard`;
  contracts ships 'Order Form', 'Statement of Work', 'Payment Link' and 'Change Order'. Every B2B close-won
  would have planned a contract the seam could not create. Found because contracts became readable and
  `close-won-contract.CT1` resolved against the live table for the first time.

  CT0, the tripwire that replaced the earlier CT1–CT4, has done its job and is retired. **CT1 and CT4 are
  now real**: contracts mints the `ContractNumber` sales never sends, and an unresolvable type is refused
  loudly with nothing written. `M-CT1` proves the second one — flipping one boolean makes the seam report a
  successful create for a contract that does not exist, and only CT4 notices.

  49 checks, 0 failed, 0 skipped. Thirty-one mutants, twenty isolating exactly one check.

- The §9 read models, the ForecastSnapshot daily job, and a cancelled meeting that was being stored as
  Completed.

  Two branch heads had moved past what the previous integration captured, and between them they carried
  both halves of #40. The 13 MJ Queries now ship as metadata under `metadata/queries/` with their SQL, and
  the ForecastSnapshot daily job runs behind a query seam with FS1–FS10 covering it.

  **The D-25 fix is a live bug, not a refinement.** A cancelled Outlook meeting was being ingested with
  `Status: 'Completed'` — so a meeting that did not happen appeared in the activity history as one that did,
  and any measure counting completed meetings counted it. `CK_Activity_Status` already allowed `'Cancelled'`,
  so the fix needed no new vocabulary. `activities.AC18` asserts it.

  92 checks across 9 bundles, 0 failed, 0 skipped.

- 7f84812: Drop the graph-node guard from `DealEntityServer.Save()`, which no longer compiles
  against MJ `next`.

  MJ removed `EntitySaveOptions.IsGraphNodeSave` in `47ff71d68b` so application code
  cannot skip companions through a public flag, and moved the node path to a private
  `BaseEntity.saveAsGraphNode`. The graph now executes every node — root included —
  without re-entering the public `Save()`, so the double-call the guard existed for
  cannot happen and `Save()` runs exactly once per save.

  Adds SD17, which pins that on the composite path: a deal saved together with its
  lines must consume exactly ONE deal number. SD11 only ever covered childless deals,
  which never build a save plan at all, so nothing was watching the graph path.

- 9f9fa15: MemberJunction v6 and pnpm.

  Every `@memberjunction/*` dependency moves to **6.1.0-edge.2** and the repo moves from npm to
  **pnpm 10.33.0** (`packageManager`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`; `package-lock.json` deleted,
  npm's `overrides` moved to `pnpm.overrides`). `@mj-biz-apps/common-*` goes to `^5.33.2` — the 5.x version
  number is misleading, that build's published peers already require MJ `^6.1.0-edge.0`. `mj-app.json`'s
  `mjVersionRange` is now `>=6.0.0 <7.0.0`, and CI runs under pnpm.

  **`apps/` is retired.** Sales no longer ships its own MJAPI and MJExplorer, because an Open App runs
  _inside_ an MJ host — and because those shells were named `mj_api`/`mj_explorer`, colliding with the host's
  own in a linked workspace. Consumers who ran `pnpm run start:api` / `start:explorer` must now start the
  host's servers instead; see `docs/QA-GUIDE.md`.

  **Three v6 behaviour fixes**, all one root cause: v6 hands back `Date` objects where v5 handed back ISO
  strings. `.slice()` on a date threw and took the dashboard down; `toDateInput` returned a `Date` an
  `<input type="date">` renders blank; and the roster's `date` pipe formatted UTC-midnight values in local
  time, showing the wrong day. Date handling now accepts either shape with UTC getters throughout, and the
  row types say `string | Date | null` because that is what actually arrives.

- 36ef1a4: `Deal.OwnerEmployeeID` now refuses a direct edit instead of silently keeping it.

  S-US1 says the owner column "cannot be edited directly", and it could. `stampOwnerFromTeam()` only
  re-derives the stamp when the roster took part in the save — which is correct, because otherwise an
  ordinary header edit would read an unloaded collection as "no owner" and clear it. The consequence was
  two paths and a refusal on neither: a save carrying the roster silently discarded a hand-set stamp, and a
  header-only save silently **kept** one. So the app could hold a deal whose owner column and owner-role
  team row named different people, reached by a plain `BaseEntity.Save()` with no error. The stamp exists so
  per-rep rollups need no join, which means a rollup could disagree with the roster it was meant to
  shortcut.

  `ownerStampEditRefusal()` refuses the save, with a message naming `SetOwner` — the operation the caller
  actually wanted. Refusing beats silently re-deriving: quietly correcting someone who believed they were
  setting the owner produces the same wrong outcome with nothing to notice.

  `SetOwner()` is unaffected, and not by luck: it loads the roster before assigning the stamp, so the roster
  is part of that save. The guard's conditions mirror `stampOwnerFromTeam`'s exactly.

  `save-deal.SD26` asserts the refusal, that nothing was written, and that the refusal is **narrow** — the
  same header-only save with an ordinary field must still succeed. Mutant `M-OW1` removes the guard and
  fails SD26 alone.

  53 checks, 0 failed, 0 skipped. Thirty-five mutants, twenty-four isolating exactly one check.

- 9cbd3e1: Phase 1 — the fields a deal needs to become a contract, and the first hand-authored surface

  An account director can now compose a complete deal — party info, product lines, a negotiated payment
  schedule and contract terms — through a custom form, and it persists as one transaction.

  **Schema.** `Deal` gains nine columns (`BillingContactID`, `ExecutionDate`, `StartDate`,
  `EstimatedProjectWeeks`, `AutoRenew`, `AnnualIncreasePctOverride`, `CancellationNoticeDaysOverride`,
  `PaymentMethod`, `ContractVariances`). `DealLine` gains `ProductName`, `DealLineTypeID`,
  `AnnualGrossFees`, `DiscountAmount` and `Total`, and loses the free-text `LineType`. Two new tables:
  `DealLineType` (a type table whose `IsRecurring` flag is what code branches on) and
  `DealPaymentSchedule` (the exception schedule — no rows means standard terms).

  The three signed figures are **transcribed inputs, never derived**. Nothing in the app computes `Total`
  from `AnnualGrossFees - DiscountAmount`, or checks that they agree, or sums the payment schedule: the
  arithmetic on a signed order form belongs to the customer, not to this app.

  **Vocabulary re-seeded to master plan §4.2** — `DealType` is now `New` / `Upsell` / `Renewal` and the
  pipelines are `B2B` / `D2C`. Pure metadata edits with no code impact, which is the vocabulary rule
  paying for itself.

  **`Sales.SaveDeal`.** A browser holds the generated `DealEntity`, not the server subclass, so a deal
  and its children cannot cross the entity-save boundary together. `DealDraft` (framework-free, in the
  entities package) plus this remote operation is how they do: one transactional call, all-or-none, with
  structured `Section`/`Field`/`Severity` issues so a tab can badge itself and a field can mark itself.
  `DealEntityServer` composes header, lines and schedule inside one transaction and derives
  `Deal.OwnerEmployeeID` from the `DealTeamMember` row rather than accepting it as a field.

  **The deal workspace** (`@mj-biz-apps/sales-ng`) is one surface for viewing, editing and creating —
  a deal being created is just a draft whose ID is null. Reached from a new hand-authored **Sales**
  application; the generated entity browser is untouched. Deliberately basic.

  **Three latent schema bugs fixed.** `UNIQUE` over a nullable column allows exactly one NULL on SQL
  Server and unlimited on PostgreSQL, so the schema was enforcing a stricter rule in dev than in
  production. In practice: only one unnumbered deal could exist at a time, a second Sales Engineer could
  not be added to a deal despite `AllowsMultiplePerDeal`, and the D-6 partner-rep path was blocked. All
  four such constraints are now filtered unique indexes, which state the real invariant and make both
  databases agree.

- 38bc458: Phase 2 — the family's app layout, deal numbering, and a committed integration suite

  **`/app/sales` now reads as an app.** A section shell matching bizapps-contracts and bizapps-orders —
  `mj-page-layout` > `mj-page-header` > `mj-page-body` row > `mj-left-nav` + one `mj-page-body-interior` —
  with three rail pages: a dashboard, a deal roster, and the workspace. Every roster row opens that deal
  in the workspace, which closes the Phase 1 gap where a deal could be created but never re-opened. The
  information architecture is declared as data in `nav/sales-nav.model.ts`, so adding a section later is a
  nav item plus a resource rather than a change to a component.

  Nothing new needed vendoring: every shell primitive ships in `@memberjunction/ng-ui-components`, already
  a peer dependency. `mj-workspace-card` remains the only vendored component.

  **Deals are numbered `DEAL-{seq}` on insert.** A singleton `DealSequence` counter plus an atomic
  `spAssignNextDealNumber`, matching contracts' and orders' singletons rather than accounting's
  per-company-per-fiscal-year scope — a ledger number must name its legal entity and year, an internal
  deal handle should be short and globally unique. The number is taken inside the caller's transaction, so
  a rolled-back save releases it and the series stays gap-free, and it is never regenerated: a deal number
  travels to contracts, orders and people's email.

  **`Sales.SaveDeal` now has a committed integration suite** — `save-deal`, SD1–SD12, against a live
  database with nothing mocked. It covers the three-table transaction, the pipeline-derived company, the
  owner stamp derived from `DealTeamMember`, the `Resolved*` columns staying NULL, the signed `Total`
  stored verbatim, complete-set line semantics, numbering and gap-freedom, and the structured refusal
  shape. Each check rolls back, so the suite is re-runnable and leaves no rows.

  `RUN_MUTATION_TESTS=1` is mandatory and the guard is inside the runner: selecting zero checks exits
  non-zero with an explanation instead of reporting a pass for having done nothing.

- 03a5fcc: Pipeline board, and stage-transition provenance behind it.

  A **Board** page joins Dashboard / All deals / Workspace in the Deals rail. Columns are the selected
  pipeline's `PipelineStage` rows in `DisplayOrder`, with a pipeline switcher; cards are the deals in each
  stage and open in the workspace exactly as a roster row does. Column headers show a count and a
  `SUM(Deal.Amount)` of stored amounts — summed over deals, never over `DealTeamMember`, and nothing is
  priced.

  Dragging a card moves the deal and applies the target stage's probability and forecast defaults, which
  stay editable. **`Sales.SaveDeal` now appends an append-only `DealStageEvent`** whenever it sees the stage
  change, stamping the amount and probability the deal held _on the way out_ — the save and the append share
  one transaction, so a move cannot land without its provenance.

  A drag **never** closes a deal: a stage whose `DealStatusType.LocksDeal` is set refuses drops and says
  why, and closing remains the explicit `Sales.CloseDeal`. No orders or contracts seam is invoked.

  Uses `@angular/cdk/drag-drop`, already this package's drag primitive for workspace tab reordering — MJ has
  no generic kanban component at v5.51.0 despite the docs listing one. No schema change; every column
  already existed.

- 7f92b70: **BREAKING — `DealLine` and `DealLineType` are retired.** A deal no longer holds lines. It holds an
  `OrderHeader`, embedded and provisioned on the deal's first save, and the lines live on that order
  (S-US4). The baseline migration drops both tables; `docs/DECISIONS.md` D-DL1 records the invariant
  reconciliation that went with each deletion.

  What moved, and what that means for a caller:

  - **`deal.Lines` is gone.** Read `deal.OrderID_Object.Lines`, and remember it is declared
    `Load: 'explicit'` on the ORDER — `deal.LoadRelatedRecords(...)` does not reach it. Missing that second
    hop is a deal that renders with no lines rather than an error, which is why `save-deal.SD20` exists.
  - **A rep supplies product and quantity, nothing else.** `UnitPrice`, `CompanyID` and `LineNumber` come
    back from orders. The `DealLine.Resolved*` provenance block is gone with the table; Rule 1 is now
    asserted positively by `save-deal.SD19`.
  - **A discount is a PERCENT, never an amount** (D-DL2, and `npm run test:discount-gate` enforces the
    conversion in both directions).
  - **Close-won no longer creates an order.** The deal already has one, and a won close leaves it alone —
    unchanged in status, still editable, so finance can correct it before the Confirm that books it
    (S-US5/S-US6). `close-won-order` CO1–CO5 assert that inverse; the two bundles that asserted the
    opposite are deleted.
  - **Orders is now a HARD dependency, including for the check suite.** A deal cannot be saved without it,
    so every bundle is marked `requires: "orders"` and the coverage gate fails on an empty expectation.

  Three live risks this surfaces are recorded rather than papered over: **KI-20** (removing an order line
  is silently dropped, so the workspace's delete-line affordance does not work), **KI-21** (a host must
  register orders' server package or no deal with an order can be opened) and **KI-22** (orders' generated
  resolvers are behind the database). None is fixable from this repo; `DECISIONS-NEEDED.md` carries the
  open calls.

- 55088ad: S0 bootstrap + S1 baseline schema — 19 tables, CRUD-verified end to end

  First code in this repo: it goes from a README-only spec to a working CRUD-level Sales app on MJ
  Explorer. Schema and CodeGen only — no business logic.

  **S0.** `mj-app.json` (schema `__mj_BizAppsSales`, entity prefix `MJ_BizApps_Sales:`, ports 4141/4341),
  `mj.config.cjs`, `codegen-schema-info.json`, and the house 6-package layout plus `apps/MJAPI` +
  `apps/MJExplorer`. `.mj-links.json` is deliberately empty — `bizapps-common` is published, and the
  unpublished siblings are not needed until the S2 pricing bridge.

  **S1.** 19 tables, type tables first: nine vocabulary type tables carrying the behaviour flags the engine
  branches on; `SalesAccount`/`SalesContact` as IsA extensions of common's `Organization`/`Person` (shared
  UUID, the primary key _is_ the foreign key); `Pipeline`/`PipelineStage`; `Deal`/`DealLine`/
  `DealStageEvent`/`DealContactRole`; `DealTeamMember`; `ForecastSnapshot`. 47 foreign keys and 19 CHECK
  constraints — structural invariants only, never domain vocabulary. 51 seeded vocabulary rows ship as
  metadata with hardcoded UUIDs rather than SQL `INSERT`s.

  `Deal.Amount` carries its three provenance columns (`AmountIsComputed`, `AmountComputedAt`,
  `AmountSourceHash`) and `DealLine`'s four `Resolved*` columns are write-only from an
  `Orders.PreviewOrder` response, so the "sales never computes money" guarantee is structural from the
  first migration rather than retrofitted.

  Cross-app references are soft wherever the target app may be absent (DG-6), which is what lets this
  baseline stand up with only `bizapps-common` present.

  **Enforcement.** `scripts/assert-no-vocabulary-comparisons.mjs` is the CI grep master plan §3 asks for,
  added before any server logic exists so it starts green and stays green: no server file may compare a
  status or stage _name_.

  Verified at three layers — generated stored procedures (including both `DealTeamMember` D-6 arms and
  CHECK constraints refusing bad rows), GraphQL create/read/update/delete, and the real Explorer UI via a
  Playwright harness that creates a Pipeline and a Deal through generated forms, reads them back with
  foreign keys resolved to display names, updates, and deletes both.

- 838188f: S4 close flow: `Sales.CloseDeal`, `Sales.ReopenDeal` and the close lock.

  Closing a deal is now one atomic transaction that validates what the close requires, resolves the
  effective `CloseWonPolicy`, routes lines downstream, and stamps the close with an append-only
  `DealStageEvent`. The path is resolved from `DealStatusType` flags — `IsWon`, `IsLost`, `LocksDeal` —
  and routing from the pipeline's policy; no name is compared anywhere, so a deployment can rename its
  statuses and pipelines without changing what a close does.

  The close lock is enforced in `DealEntityServer.Save()` rather than the UI, so an Action, an agent and a
  raw `BaseEntity.Save()` all hit the same refusal. `Description` and `NextStep` stay editable per §7.3,
  and `Sales.ReopenDeal` is the only exit — it requires a reason and preserves the close in the event log.

  **The lock covers the CHILD COLLECTIONS as well as the header**, which matters because a deal's lines are
  exactly what the contract and the order were derived from. `Lines`, `PaymentSchedule` and `Team` are
  companions rather than fields, so they never appear in the entity's field list — a lock built only on
  dirty fields would refuse a renamed deal and accept a deleted line, the more damaging of the two. Any
  dirty companion now refuses the save, enumerated generically so a collection added later is protected
  without anyone remembering to add it.

  The check is keyed on the **persisted** status, so the closing transition itself may still carry final
  collection state: a close that writes its last line is legal, and editing that line tomorrow is not.

  The downstream seams to orders and contracts are typed and STUBBED: neither sibling is reachable yet.
  `StubDownstreamSeam` reports the real blocker instead of a fabricated record ID, and the routing intent
  is preserved in the stage event's notes. `SetDownstreamSeam()` is the swap point.

  No schema change — every column §7 stamps already existed.

- 070bfb8: A stage's probability and forecast category are now applied on the write path, not only in the workspace.

  `ApplyStageDefaults` lived in `DealWorkspaceComponent` and ran from the stage picker, so a stage set by an
  agent, an Action, the S6 HubSpot importer or any API caller got neither value: the pipeline designer's
  answer sat unused in the stage row while the deal landed with whatever the caller supplied, or null. The
  same shape as the order provisioning that used to live in the workspace — a rule the UI enforces is a rule
  only the UI obeys.

  It now runs in `DealEntityServer.saveWithinScope`, on the same `PipelineStageID` trigger and in the same
  transaction as the order-status writer, the stage event and the amount cache.

  **It fills; it does not overwrite** — the amount cache's rule. A value the caller stated in this save is
  theirs; one they did not state is the stage's to supply. The two cases are asked differently because
  `Dirty` does not mean the same thing on a new record as on an update, and `board-move.BD2` caught the
  version that ignored that.

  `BD5` proves the defaults arrive through the entity layer with no UI involved; `BD6` proves a stated
  probability survives while the field the caller left alone still fills. Mutants `M-BD1`, `M-BD2`, `M-BD3`.

- 7744ea8: DealStageEvent gains AmountAtTransitionIsComputed, close-won tasks get a due date, and a close derives its
  closing stage. Adds two migrations (the column plus the view rebind it needs), so this is a minor bump
  under the repo's migration rule.
- f5c95d9: **BREAKING — `CloseWonPolicy.OrderState` is removed from the published input contract.** A deployment
  setting it is configuring nothing; what it used to say is now said by the STAGE.

  `PipelineStage.OrderStatusOnEntry` (nullable, `Draft | Quoted | Confirmed | Voided`) is the new home for
  "what does this mean for the deal's order" — S-US5, ruled by Andrew in `docs/DECISIONS.md` D-OS1. It
  mirrors `DealStatusTypeID`, which already answers the same question for the deal's own status from the
  same table, and unlike a close-time policy key it speaks on every stage change rather than only at the
  moment of a won close.

  - **The writer is on the WRITE PATH** — `DealEntityServer.Save()`, keyed on `PipelineStageID` changing,
    beside `provisionEmbeddedOrder()` and inside a transaction that commits with the deal. Not the UI: a
    stage change arrives from the board's drag, an importer or an agent (D-OS3).
  - **A refused order update never blocks the stage change** (D-OS2). `CanTransition` — orders' own table
    of legal moves, imported rather than restated — is asked first, so the guaranteed refusal
    (`Voided → Quoted` on a reopened lost deal) costs no write and the warning carries orders' wording.
    Warnings surface as `Issues` with `Severity: 'warning'` from `Sales.CloseDeal` and `Sales.ReopenDeal`.
  - **`Posted` and `Fulfilled` are not available to a stage.** They are finance and fulfilment outcomes;
    a stage that could name them would let the board post to the ledger.
  - **Seeded:** `Quoted` from Proposal onward including the winning stage, `Voided` on Lost, nothing on the
    early stages. `Confirmed` is seeded nowhere on purpose — see `DECISIONS-NEEDED.md` DN-10, which is one
    field on one row.

  This completes S-US7 (a lost deal voids its order) and S-US8 (a reopened deal warns instead of
  un-voiding — the intended behaviour, not a gap).

- b85293a: A provisioned order now takes the status its stage declares, instead of always Draft.

  The order-status writer keyed on `PipelineStageID` **changing**, which is right for a move and wrong for a
  birth. A deal already at or above the agreement threshold when its order was provisioned never triggered
  it, so the order stayed `Draft` while its stage plainly declared `Quoted` — and the board displays that
  mismatch without complaint. Found by the story audit reading the database rather than the code:
  `DEAL-9003` at Proposal with a Draft order. It would have hit every open deal the HubSpot import lands
  past Proposal in S6.

  `_orderJustProvisioned` lets a birth ask the question a move asks. Pinned by `save-deal.SD25`, which
  gives a stage an opinion, strands a saved deal without an order, and then saves it **without moving the
  stage** — so a pass cannot come from a move. Mutant `M-PV2` reverts the gate and fails SD25 alone.

  Also: the dashboard's `ClosingSoon` now sorts on `ExpectedCloseDate` rather than trusting the roster
  query's `ORDER BY` to stay what it is today. Same output, but the comment claiming "soonest first" is
  enforced by the code beneath it instead of by a clause in another file.

  52 checks, 0 failed, 0 skipped. Thirty-four mutants, twenty-three isolating exactly one check.

- 0ffb950: `Deal.StandardAgreementModified` — one column that closes a criterion in two stories.

  S-US1 lists a "standard agreement modified" flag among the fields a rep supplies, and no such column
  existed. S-US2 says the contract's `HasModifications` is copied from it, which is why the contracts seam
  hardcoded `false` — there was nothing to copy. Both are now real: `BIT NOT NULL DEFAULT 0` on `Deal`,
  on the variances pane of the deal workspace, carried through `buildContractInput` into
  `LiveContractsSeam`.

  **It is deliberately not derived from `ContractVariances`.** An empty variances box means nobody wrote
  anything down, which is a different claim from nothing having been negotiated — and contracts' review
  task branches on the difference: a true flag means capture each deviation as a
  `ContractTemplateModification`, a false one still means read the document, because the rep may have
  forgotten to raise it. Inferring the flag from whether somebody typed a paragraph would hand finance a
  guess and call it a fact.

  Two checks, because the wiring has two hops. `CT5` proves the seam writes both values and reads an
  absent flag as false. `CT6` drives the whole close and reads the contract the close created — and it
  exists because mutating the first hop alone (`M-CT3`) left all fifty other checks green.

  **CT6 also caught the `'Standard'` contract type a second time**, in the seeded `CloseWonPolicy` the
  integration fixture resolves. Same defect as the one CT1 found in the metadata file, in a different
  place, and it would have made every B2B close-won plan a contract that could not be created.

  51 checks, 0 failed, 0 skipped. Thirty-three mutants, twenty-two isolating exactly one check.

### Patch Changes

- 07dc10e: Four UAT-facing defects, each with the check that would have caught it.

  **The close raised no order-review task for any deal that did not already have an order.** Provisioning
  moved into `DealEntityServer.Save()`; the task call sat twenty lines earlier and read `deal.OrderID`. So
  every seeded, legacy and imported deal closed with a warning saying it had no order — while `Save()`
  created one a moment later. Finance got nothing and the warning said the opposite of what happened. The
  task block now runs after the save, still inside the transaction.

  **No contract-processing task ever linked its contract.** `ContractID` was never passed, so the service's
  `if (input.ContractID)` branch was unreachable from production and its fallback message was dead code.

  **A refused discount did not block Save.** The refusal lived in a map only the template read. A rep typed
  `0.5`, saw the refusal, and saved a line still holding `0.10`.

  **Every order-line error landed on the wrong pane.** `EmbeddedRecord.prefixError` emits
  `OrderID_Object.Lines[3].Quantity` and the parser anchored on `[A-Za-z]+`, so errors fell through to
  Party info with no row marked.

  New: `close-won-tasks.WT13`/`WT14`, mutants `M-TK1`/`M-TK2`, and `scripts/assert-workspace-validation.mjs`
  — wired into `verify` and into CI, which also now runs the discount gate for the first time.

- b054bb3: Per-entity Explorer forms (#89 P3) — metadata for layout, three subclasses for behaviour.

  Nineteen of the twenty-two Sales entities get their form chrome from metadata
  (`metadata/entities/.form-chrome.json` plus the relationship file). Layout is data; it does not belong in
  a component. Those files are **committed but not yet applied**: `Entity.Configuration` does not exist on
  the MJ version this repo pins, so they land when MJ is upgraded. `metadata/entities/README.md` names the
  two upstream migrations that add it.

  Three entities have a hand-authored form, registered at **explicit priority 2** rather than relying on
  bundler import order, and only because behaviour — not layout — required it:

  - **Deals** refuses a locked edit before the round trip and says which fields are frozen, and warns when
    `Deal.Amount` predates the lines it claims to describe. The lock's field list now lives in ONE place,
    `DEAL_FIELDS_EDITABLE_WHILE_LOCKED`, read by both the form and `DealEntityServer.Save()`. New check
    **CD14** pins it in both directions, so the constant cannot drift from the wall it protects users from.
  - **Deal Lines** refuses edits to the pricing provenance, using the same list the entity server refuses.
  - **Deal Stage Events** refuses edit mode outright — the record is append-only.

  Honest limitation, recorded rather than papered over: `BaseFormComponent` has no per-field read-only hook
  and MJ metadata has no field-level UI config, so these forms cannot grey individual fields out. They move
  the refusal to the moment of saving and name the field, instead of forking a generated template that would
  drift on the next CodeGen run.

- Updated dependencies [0691454]
- Updated dependencies [1da61e1]
- Updated dependencies [c31077b]
- Updated dependencies [b309a07]
- Updated dependencies [a2abcfd]
- Updated dependencies [da0f69f]
- Updated dependencies [b054bb3]
- Updated dependencies [9f9fa15]
- Updated dependencies [9cbd3e1]
- Updated dependencies [7f92b70]
- Updated dependencies [55088ad]
- Updated dependencies [838188f]
- Updated dependencies [7744ea8]
- Updated dependencies [f5c95d9]
- Updated dependencies [0ffb950]
  - @mj-biz-apps/sales-entities@5.1.0
