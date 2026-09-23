# @mj-biz-apps/sales-ng

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

- ad9191c: Regenerated code: `vwDeals` and `vwDealContactRoles` now carry the contact name columns.

  Giving `Sales Contacts` a name field (`DisplayNameAndEmail`) means every view with a foreign key to it gains a name column — `PrimaryContact` and `BillingContact` on Deals, `SalesContact` on Deal Contact Roles. This is the CodeGen output that registers them, so metadata and the views agree.

  **CodeGen lags by exactly one pass when a new FK-name column appears, and the second pass repairs it.** Measured:

  |        | Deals                      | Deal Contact Roles | Result                        |
  | ------ | -------------------------- | ------------------ | ----------------------------- |
  | Pass 1 | 59 fields / **61** columns | 10 / **11**        | `success: false`              |
  | Pass 2 | **61 / 61**                | **11 / 11**        | `success: true`, 0 mismatches |

  `createNewEntityFieldsFromSchema` builds `EntityField` rows by reading the base view's columns, so on the pass that CREATES those columns they are not yet visible to it. The next pass sees them, registers them and fixes the sequences.

  **This contradicts the warning in `CLAUDE.md`**, which says a full second pass corrupts the database. In this case the second pass is what repaired it; the first pass left the corruption. The documented incident is the same lag seen from the other side — whichever pass introduces a new virtual column leaves metadata one behind. The safe rule is _run until it reports success and field/column parity is clean_, verified per entity, not _never run twice_.

  **Why the intermediate state is dangerous, stated precisely.** The `Deal` TABLE never changes. `spCreateDeal` ends in `SELECT * FROM vwDeals`, and the client-side provider declares a `@ResultTable` with one column per `EntityField`, filled by a POSITIONAL `INSERT ... EXEC`. A 61-column result into a 59-column table fails with _"Column name or number of supplied values does not match table definition"_ — so it is the save-capture width that breaks, not anything about the table.

  CodeGen also moved the generated entities to a per-schema layout: `entity_subclasses.ts` is now a barrel re-exporting `entities/__mj_BizAppsSales.ts`, with the GraphQL schema split the same way.

  Also converts the one dynamic `await import()` in the test suite to a static import. That test failed twice in full runs and could not be reproduced in twelve attempts afterwards; the cause was never identified, so this is not a fix presented as one — it removes the single construct that made the test different from its neighbours.

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

- 10f3a5c: The New Deal form works, the Sales Contact picker shows people instead of GUIDs, and a closed deal's lines can no longer be edited from the form.

  Four UAT defects (bc-aidp-next-golive#244) plus the half of golive#206 item 1 that sales#110 fixed on the wrong surface. `minor` rather than `patch` because two migrations ship with it.

  **A new deal could not be saved at all.** `Deal.CompanyID` is `NOT NULL` with no default, the form renders it server-maintained — correctly, a rep must not choose the selling company — and `DealEntityServer.stampCompanyFromPipeline()` fills it on save. But `BaseFormComponent.SaveRecord` runs `Validate()` first and returns early when it fails, so the save never reached the server that was going to supply the value. Required, unsettable, filled too late.

  It worked in the deal workspace, which stamped it client-side _"so the record validates locally"_. Unmounting the workspace (9d6ef9e) took that with it and the form was never given the equivalent. The form now resolves the pipeline's company and stamps it before the base save.

  This is not the client deciding the company: it reads the same authority the server reads, and the server overwrites on arrival, so the two cannot disagree. `CompanyID` stays read-only and `server-owned-fields.ts` still refuses a user's edit to it. The rule is keyed on the CAUSE — an absent company with a pipeline to resolve it — not on `IsSaved`, so a path that creates a deal some other way is covered without anyone remembering to widen a guard.

  **Products still need a saved deal, and now the form says so.** A deal mints its order on first save, so there is genuinely nowhere to put a product until then. Combined with the above that was a deadlock. The sequence is now stated twice: a guidance flag in the hero on any unsaved deal, and fuller copy in the panel. Styled as guidance, not the warning tone the lock uses — telling a rep in orange that naming a new deal has gone wrong is not the message.

  **The Sales Contact picker showed raw GUIDs.** `Sales Contacts` had no name field at all — `IsNameField` false on all 30 registered fields — so every lookup to it rendered an id.

  An IS-A asymmetry, not a missing setting: `vwSalesAccounts` inherits `Name` from Organization and CodeGen auto-marks it, while Person's name field is `DisplayName`, which is COMPUTED in `vwPeople` rather than stored on the Person table. The generated child view joins the TABLE, so the child inherited FirstName, LastName and Email and could not inherit the one column that names the person. CodeGen correctly found nothing to mark.

  Two migrations move the entity to a layered base view (the pattern contracts established, MJ#3419): CodeGen owns `vwSalesContactsGenerated`, and sales owns `vwSalesContacts` as a wrapper adding `DisplayNameAndEmail` — the display name, plus the primary email in brackets when there is one.

  It reads common's `vwPeople` rather than re-deriving either half, because `PrimaryEmail` is a contact-method lookup with a fallback and copying that into sales would drift the first time common changed it. `AutoUpdateIsNameField` is off, or the next CodeGen run would re-derive the flag from the schema — which is what produced no name field in the first place — and the pickers would go back to GUIDs with nothing in the diff to explain it. The string is built with `CONCAT`: `NULL + ' ('` is NULL in T-SQL, which would have produced a blank name field in the one case nobody seeds data for.

  **The new-record header no longer briefs on a record that does not exist.** Account, owner, amount, stage and next step rendered as a grid of dashes under the name still being typed. Gated on `IsSaved`, not `EditMode` — a saved deal being edited still has all of it to show.

  **A closed deal's lines can no longer be edited from the form.** sales#110 closed this on the deal WORKSPACE, a component no template has mounted since 9d6ef9e. The form still offered it: the lines grid renders outside the panel's `@if (!IsLocked)` block — deliberately, because a locked deal must still SHOW what was sold — so hiding the Add button did not take the row double-click with it. All four fields were typeable on a Won deal, and the refusal arrived from `DealLockOrderLineVeto` after Save. Offered, taken, refused: the shape golive#206 exists to delete.

  Closed in two layers, because gating only the entry point is how this reopens. The panel declines to open the editor and says why where the Add button used to be; the editor refuses on its own account, resolving the lock itself from the deal it was handed rather than taking an `@Input` a future caller could forget. It reads the PERSISTED status, matching the server — a deal being closed right now still reads open.

  The refusal sentence now exists on four surfaces, so `deal-lock-refusal-copy` derives it from `DealLockRefusal('update')` in the server source, as text, and checks every copy against it. Reading the file sidesteps the bundling problem that forces the duplication — `sales-core-entities-server` pulls `node:crypto` and cannot go in a browser bundle — and keeps the server the one that decides.

  **Creating a deal happens on one screen — the one it opens on.** Pipeline, Deal Type, Account and both contacts now render together on the Pipeline section while the deal is unsaved. Left-nav shows one section at a time and opens a new deal on Pipeline, so composing one otherwise meant setting the name in the header, the pipeline in one rail item and the customer in another.

  It also corrects something backwards: on a new deal that section used to show Forecast Category and Probability — which the server derives from the stage on create — and not the fields a rep actually chooses. Offering a derived field invites someone to set a value that is immediately overwritten, so those two are suppressed while unsaved.

  `PipelineStageID` is offered, and briefly was not. It was suppressed on the same reasoning, which was half right and therefore wrong: `applyStageDefaults` fills probability and forecast category _from_ a stage, and `planStageDefaults` returns null the moment the stage is null. Nothing anywhere picks it. One missing control produced three blank fields — no stage, so no probability, so no weighted amount — which is how it was reported. Derived-from-the-stage is not the same as derived-without-one.

  The party panel drops exactly the borrowed fields for as long as the Pipeline section shows them, filtered through the same shared lists that section iterates. Two separate lists would agree today and drift the first time somebody added a fourth contact field, which is the shape golive#189/#190 already cost a round of UAT — a test asks it as a set intersection, in BOTH saved and unsaved states, so neither direction can regress and a later addition is covered without anyone remembering.

  The server-maintained stamps are never borrowed: a rep cannot set either, so two permanently-blank read-only boxes among the creation fields would ask a question with no answer. Routing these through the Pipeline panel also means they inherit the shared `FieldEditable` rule — server-maintained and close-lock handling — rather than a one-off copy.

  Absence is not the same state as unsaved, and getting that wrong hid fields from a panel that had no deal at all. Both getters key on `!this.Record || this.Record.IsSaved`.

  **The Amount / Weighted / Situation block is hidden until the deal exists**, for the reason the hero briefing is: on a record nobody has saved it renders zeroes and dashes under the fields still being filled in.

  **Three rail items showed a blank page on a new deal.** Selecting "What's being sold", "Internal team" or "Buying team" rendered the header and nothing else. Each already carried an @else branch explaining that the deal must be saved first, and none of it was reachable: all three are `[DefaultExpanded]="false"`, and a collapsed panel in left-nav renders no body. The explanation existed and could not be read — a correct message nothing displays, which is the same defect class as a correct getter nothing consumes. They now open while the deal is unsaved and collapse as before once it is saved.

  **What this does not fix.** The left nav still lists every section on a new record. MJ resolves section inclusion statically, with no notion of record state, and `BaseFormPolicy.DecorateChrome` is explicitly forbidden from changing membership — `plans/form-chrome-layering.md` makes inclusion a static `Primary | More | None` at all three layers. Filed upstream as MemberJunction/MJ#4618.

- e2b93e7: The add-product dialog shows what the line comes to, before it is saved.

  Unit price and line total sat blank under a caption reading "Priced by Orders", which a rep reasonably took to mean the price should already be there. The values were not missing: `UnitPrice` and `LineTotalNet` are resolved by `OrderPricingService` during the ORDER's save, so on a line still being composed they do not exist yet.

  Sales may not work them out — multiplying quantity by price here would be the second implementation of pricing that the first rule in `CLAUDE.md` exists to prevent. So the dialog asks **`Orders.PriceOrder`**, which runs that same service and persists nothing. One implementation, so the figure on screen and the figure in the ledger cannot drift.

  This was not possible until recently. The earlier `Orders.PreviewOrder` ran the real save inside a transaction that always rolled back, firing the whole booking walk — journal entries, subscription decisions, entitlement grants — on every keystroke and discarding all of it. Orders withdrew it and shipped `PriceOrder`, the decide step without the write, which is what makes asking cheap enough to do while somebody types.

  It re-asks on every priced input (product, quantity, discount, term start), debounced: a quantity of 12 passes through 1 on its way there, and pricing each is a chance to show a figure for a number nobody meant.

  **Nothing is written to the line.** These are display values; the order's own save resolves the real ones. Writing them here would make the dialog a second author of a priced figure, stale the moment the rep changed anything.

  **No failure blocks the save.** An unreachable operation, a refused pricing run, or a thrown call all show "It is priced on save" and leave the figures unknown. Refusing to let a rep record what they sold because a pricing call timed out would not be honest about which of the two matters.

  The two-layer result is checked: the envelope says the operation RAN, `Output.Success` says pricing worked. The test for that was written vacuously first — a failed output with no lines produced the same result either way, so a mutation dropping the inner check survived it. It now supplies a refused run that still carries a figure, which is the only shape that tells the two apart.

- f4c780f: A product can be taken off a deal.

  The third of golive#206 item 1's three verbs — _"adding, editing or deleting a line on a locked deal"_ — and the one that was impossible rather than merely ungated. There was no delete affordance anywhere on the deal form.

  **It was blocked by orders, and no longer is.** `OrderEntityServer` did not drain `Lines.Removed` at all, so a removal was silently dropped, and once it started refusing it cost the rep every other edit staged beside it. Sales carried a blanket refusal for that — `ShouldRefuseLineRemoval`, which declines every saved line and still sits in the unmounted workspace. The orders fix landed with golive#187 and `OrderEntityServer` now reads `Lines.Removed`, renumbers the survivors and recomputes the header. `save-deal.SD6` is the tripwire that announced it.

  **Through the collection, not a direct delete.** `Lines.Remove()` then `order.Save()` is the path orders drains. Deleting the `OrderLine` record straight from a grid skips the renumbering and the header recompute, which is why the grid's own delete button stays off — the same reason its New button does.

  It lives on the restricted line editor rather than as a row control: that dialog already resolves the close lock for itself, so removal inherits the refusal instead of needing its own copy of it. Offered only for a line that exists — a line being composed has nothing to remove, and Cancel already discards it — and never on a closed deal.

  Two-step, because removing a product a rep meant to keep costs them a re-entry, and placed apart from Save/Cancel: confirm-left-cancel-right is the rule for the two choices that end the dialog normally, and a destructive third option beside Save is how the wrong one gets clicked.

  A refused save puts the line back by re-reading the collection. Leaving it claiming a removal that did not happen would mean the next save retries it against a rep who has moved on.

  It emits the same `Saved` event an edit does, because what follows is identical: re-read the grid, and force a deal save so the cached amount follows the order down.

- 2f1a3ea: Deal form: reach the order and the contract from a won deal's header, and stop offering the draft order on an open one (golive#226).

  A tester closed a deal as Won and could not get from it to either the order or the contract. The header carried Account, Owner, Stage and Amount and nothing else; the Motion panel showed **Contract ID** and **Renews Contract ID** as raw GUIDs in text boxes; and the one order link on the form appeared on **open** deals too, where the order is still a draft nobody should be editing directly.

  **The header row is not ours.** It is `bizapps-related-chips` from `@mj-biz-apps/common-ng` (golive#225), which is the row contracts and orders use as well. All this app decides is which relationships a deal has — Order and Contract on a won deal, the renewed contract at any status, because a rep needs to see what a renewal is renegotiating precisely while the deal is still open. Reading each record's name, and deciding when a chip must not be drawn at all (the sibling app is not installed, the record is not there, the user may not read it), belongs to the shared component and is tested there. That rule lives in `deal-related-links.ts` rather than in the panel, so a test can reach it without standing up DI.

  **The GUIDs were structural, not cosmetic.** `Deal.ContractID` and `Deal.RenewsContractID` are deliberately soft references — the link points down the dependency graph and contracts knows nothing about sales — so there is no FK, `EntityField.RelatedEntity` was unset, and `mj-form-field` had no name to show and nowhere to go. They now ship as MJ **soft foreign keys**: declarative metadata under `metadata/entity-fields/`, plus a matching declaration in `codegen-schema-info.json` so a rebuild-from-zero re-applies them instead of silently regressing the form to GUIDs. No constraint, no cascade, nothing to violate — the database is untouched. Both fields now render the contract number as a link, and `RenewsContractID` gains an FK search in edit mode instead of asking a rep to paste a UUID.

  **The order link came off the Motion panel entirely.** The header chip is the only route to the order now, and it is gated on the win, which is what item 4 asks for. Worth saying plainly in case it is ever read as more than it is: this is discoverability, not a lock. The draft order is still reachable by search, and anything that must actually refuse belongs in the entity server.

  `ResolveDealLockState` gained `IsWon`, read off the same status row it already fetches, by flag — a deployment may call its winning status "Signed". It is the one member of that shape **not** gated on `LocksDeal`: the rest answer "what may still be edited", a question only a locked deal has, while this answers "did we win", and tying a header decision to a field-editing one would drop the chips on a won deal whose status does not freeze it, with nothing on screen to explain the absence.

  20 tests. The one that matters most is a negative — no order chip on an open deal that holds an `OrderID` — because a rule that quietly started emitting it would look completely normal on the won deal everyone tests. Lost deals are asserted separately from open ones for the same reason: a future edit that gated on `IsLocked` instead of `IsWon` would pass every open-deal case and light both chips up on every lost deal.

### Patch Changes

- f1ecd20: Deal Overview and header: a closed deal now reports what happened instead of forecasting (golive#231).

  golive#206 item 4 fixed the tile VALUES on a closed deal and left the static labels alone, which produced
  the worst of both: correct data under headings that promise something else. A won deal read
  "Forecast: Won" — Won is not a forecast — and the Timing card showed a close DATE under a row labeled
  "Days to close".

  **Labels now move with the outcome.** The Close tile reads Won / Lost / Closes; the Forecast tile becomes
  Outcome once there is one, with the stage the deal closed from beneath it. The header's Close stat, which
  rendered `ExpectedCloseDate` unconditionally with no reference to the close stamps at all, becomes
  "Closed" with the real date.

  **The Timing card reports rather than counts.** A closed deal gains a "Closed won" / "Closed lost" row
  and a **Sales cycle** (creation to close), and loses the countdown; "Expected close" is kept either way so
  the variance stays legible, which is what the Close tile's new sub-line reports — "on time", "4 days
  early", "3 days late". A lost deal gains a **Loss reason** row with its notes, and hides Term / Start /
  Executed, which describe a deal being delivered — but never hides one that is actually set, since that
  would conceal real data.

  **Won and Lost are read as FLAGS, and `IsWon` is now carried on `DealLockState` rather than inferred.**
  They are not complements: `Abandoned` carries `IsLost` alongside `Lost`, and a status can lock a deal
  while carrying neither — so `!IsLost` would print "Won" over a deal nobody won, a lie that reads
  perfectly. One check fails only against that inferred version. This keeps "Closed Won" a label a pipeline
  can rename, per the vocabulary rule.

  The open-deal countdown is also spelled out — "in 12 days", "today", "3 days overdue" rather than "12d"
  and "3d past" — since the tile is read at a glance by someone not holding the convention in their head.

  27 new checks. Each pins a label AND the value it sits over, as a pair: a check that looked at only one
  of them would pass against exactly the half-fixed state this issue is about.

- 615e25a: Deal form: adding or editing a product line no longer opens the full Order Line form (golive#229).

  "What's being sold" was an `mj-explorer-entity-data-grid` bound straight to `OrderLine`, so New and a row
  double-click both fell through to whatever form is registered for that entity — in bizapps-orders, the
  CodeGen-generated full-entity form. It shows Order Header, Reverses Order Line, Parent Order Line, Journal
  Entry, Price Overridden, Fulfillment Status, the ship-to trio and about a dozen related sections, none of
  which mean anything to a rep pricing a deal.

  **And it renders Unit Price as a plain editable field.** A rep could type any price, with no discount
  recorded and no override reason — the exact thing `docs/DECISIONS.md` D-DL2 says must be impossible:
  _"S-US4 is explicit that no price field is enterable by the rep."_

  A compact restricted editor now opens instead, offering exactly what the deal workspace allowed —
  Product, Quantity, Discount percent, Term start — with unit price and line total as read-only displays,
  and Order Header set from the deal and never shown.

  **Both `ShowNewButton` and `NavigateOnDoubleClick` are off, and the pair is the fix**: either one left on
  re-opens the generic form, and the tester reached it both ways.

  **Why this is built in the form rather than reusing the deal workspace.** `deal-form.component.ts` says
  composing a deal is the workspace's job and that duplicating it here would give us two surfaces that must
  agree forever. That was right when written and no longer applies: commit `9d6ef9e` ("Replace the in-rail
  deal workspace with Explorer OpenEntityRecord") unmounted `mjs-deal-workspace`, and the selector appears
  in no template anywhere in the repo. **So D-DL2's guarantee has been enforced only in unreachable code
  since 2026-08-31**, and the deal form is the only live surface — there is no second surface to disagree
  with.

  The RULES are not re-derived. Product eligibility, the percent/fraction discount conversion and the
  term-start question all come from the same `@mj-biz-apps/sales-entities` helpers the workspace called;
  only the markup is new. A discount stays a PERCENT and never an amount, per D-DL2 — `DiscountAmount` reads
  0 exactly when a percentage discount exists.

  #206's requirement that a locked deal offer no way to add a line is preserved and moved onto the new Add
  button, since the binding it used to assert is now deliberately gone.

  14 checks, including that no input anywhere binds `UnitPrice` or `LineTotalNet`.

- ca01757: The deal's product lines are listed in line-number order.

  The grid's view parameters carried no `OrderBy`, so rows arrived in whatever order the view produced — a rep who added three products saw them as 2, 3, 1.

  Sorted by `LineNumber` rather than a created-at stamp: orders stamps it through the collection's `applySequence()` and re-stamps by array index when lines move, so it is the sequence the order itself considers its lines to be in. Sorting by creation time would show a resequenced order in the order it was typed rather than the order it now has.

- 078824c: A deal moves to the Overview once it has been saved for the first time.

  A new deal opens on Pipeline — that panel declares `leadsWhenUnsaved`, deliberately (golive#188), because a summary of a record with no data is a page of blanks. Once the deal is saved that reasoning inverts: the summary has something to summarise, and the rep has just finished what Pipeline was for.

  MJ persists the active group only for a SAVED record (`ShouldPersistChromeActiveGroup`), so nothing moved the rail on that transition and a rep was left looking at the form they had just completed.

  It lives in the hero rather than the Pipeline panel for two reasons, the second load-bearing: the hero renders for every section, so it sees the save wherever the rep is, and `MJSDealPipelinePanel` deliberately avoids `inject()` so `new MJSDealPipelinePanel()` keeps working in its tests.

  Keyed on the unsaved→saved CROSSING, not on `IsSaved`: an already-saved deal must never be dragged to Overview, or a rep could not stay on another section for the rest of its life. That single test also makes it fire exactly once — a separate once-per-record flag was written first, and a mutation proved it inert.

- e473a26: A new deal's "What's being sold" panel says what to do, instead of rendering nothing.

  golive#216, the first half. A tester creating a deal reported: _"It is empty, with no add button and no
  message"_ — and could not tell whether products were unavailable, broken, or somewhere else.

  The panel had two branches:

  ```
  @if      (Record.IsSaved && Record.OrderID)  -> the lines grid
  @else if (Record.IsSaved)                    -> "Save the deal to add products."
  ```

  So a **saved** deal was told to save, and a **brand-new** one — the only case that hint exists for —
  matched neither branch and rendered empty. The condition was inverted against its own message.

  Three branches now, covering every combination of the two fields it reads: the grid when there is a
  saved deal and an order to hang lines on; _"Save the deal first. Products are added to the order it
  creates."_ when it is not saved; and, for a saved deal with no order, a message that says that rather
  than repeating the wrong instruction one case over. That last case is the legacy row that closed before
  deals minted their own order — `DealEntityServer` deliberately does not mint one for a deal whose whole
  point has passed — so telling that rep to save would be the same error again.

  Five tests, four mutations all killed, including the defect restored exactly. The tests are anchored on
  the branch conditions **and their order**, so a message moved under the wrong condition fails even
  though every string is still present — which is the failure this panel actually had.

  **This is the panel half of #216 only.** The other two halves are covered elsewhere and are not in this
  PR: the silent `Save()` refusals that produce _"Unknown error creating record"_ are converted to
  readable messages by #81, and the Owner and Company fields that the form offers while the server
  refuses or overwrites them are made read-only by #92.

- 3ac4c36: Records that KI-20 is fixed, and stops the workarounds written for it reading as current.

  `docs/KNOWN-ISSUES.md` KI-20 described removing an order line as impossible — first silently dropped, later refused outright on a unique-key violation. Orders fixed it: `OrderEntityServer.Save()` drains `Lines.Removed`, renumbers the survivors and recomputes the header, with `OrderLineRemoval.test.ts` covering both failures. bc-aidp-next-golive#187 is closed.

  `save-deal.SD6` was the tripwire for exactly this, and it worked — `docs/CHECK-MUTATION-EVIDENCE.md` records it firing on `next`. Nobody read it for some weeks, which is the part worth keeping: a red tripwire nobody reads is the same as no tripwire.

  The entry is marked closed with the original kept below it, because the shape recurs — a downstream app's save path silently skipping a companion-collection step.

  `ShouldRefuseLineRemoval` is annotated as obsolete rather than deleted. Its only caller is the deal workspace, which no template has mounted since 9d6ef9e, so removing it would change the behaviour of a component nobody can reach and cannot be tested end to end, on a surface whose fate is still open. The note says so, and says who should delete it. The same correction is applied where the workspace and its test describe the defect as live — including a citation of `DECISIONS-NEEDED.md` DN-6, a file that does not exist in this repo.

  Also restores `Metadata.Provider` after each pricing test. It is a singleton the helper replaces, and the suite went red once on an unrelated test before passing on the next runs — shared global state, caught before it became a recurring mystery.

- 3855966: Cancels a pending price request when the line dialog closes, and grants SELECT on the layered `vwSalesContacts`.

  **The debounce timer outlived the dialog.** It was cleared only by being RESCHEDULED, so a rep who typed a quantity and clicked Cancel within 350ms left a timer firing against a destroyed component — a pointless `Orders.PriceOrder` round trip and a `detectChanges()` on a view Angular had already torn down. The dialog sits inside `@if (EditorOpen)`, so it is genuinely destroyed on both Save and Cancel. The component now implements `OnDestroy`.

  **`vwSalesContacts` is granted explicitly.** The migration that creates the layered wrapper DROPs the previous view, and dropping a view discards its permissions.

  This is insurance rather than a repair: CodeGen re-grants on exactly this kind of object — its own guard is described as being for _"objects CodeGen refreshes or GRANTS ON but does NOT create — specifically the application-owned outer view of a layered entity"_ — and a run duly restored all three roles. On the documented install sequence the grants arrive without this file. It ships for the window in between, and for any path that applies migrations without a CodeGen run afterwards, where no application role can read Sales Contacts. The failure is invisible to anyone testing as `sa`, which is how it went unnoticed. bizapps-contracts grants explicitly in its own layering migration for the same reason.

  The grants live in the migration that creates the view, not a follow-up. That migration was written today and exists only on this branch — the additive-only rule protects migrations applied to databases you do not control, and there are none. Verified by re-applying it: the DROP discarded the grants and the new block restored them.

- 1e12126: Show where an order came from, on the order form's header.

  A UAT tester opened an order that had been raised from a deal and found nothing on it saying so
  (`bc-aidp-next-golive#227`). The header names the status, type, company, dates and parties, and no
  part of it pointed back at the deal that caused the order to exist, or at the contract that deal
  produced.

  A row of chips now sits above the order header: the **Deal**, and the **Contract** reached through
  that deal. It is `bizapps-related-chips` from `@mj-biz-apps/common-ng` — the shared row built for
  `golive#225` precisely so orders, sales and contracts would stop each solving a slice of this
  differently — so the rules about when a chip must not be drawn at all come from there: nothing for
  an entity this host does not have or this user cannot read, nothing for a record that is not there,
  and never a raw id where a name belongs.

  **Sales owns an order-form panel because the link only exists in one direction.** `Deal.OrderID` is
  a foreign key into orders and `Deal.ContractID` a soft reference into contracts; `OrderHeader` holds
  neither, and `mj-app.json` has sales depending on orders and contracts with neither depending on
  sales. So the knowledge that an order HAS a deal is this app's, and the panel is contributed onto
  the order form through MJ's `before-fields` slot rather than built into an app that must not know
  this one exists. The orders repo is unmodified.

  **One read, and the contract is why.** The chip row can find a record from a filter as happily as
  from an id, so the deal chip alone would need no read here. The contract is a second hop — order →
  deal → contract — that the row cannot take on a caller's behalf, and the only alternative would be a
  filter carrying a subquery across into the sales schema. The panel reads the deal once for both ids
  and hands over two ordinary forward links.

  Which relationships an order has lives in `order-related-links.ts` as plain functions, testable
  without Angular DI, the same split `deal-related-links.ts` and common's own `related-links.ts` use.
  Both chips are ungated, unlike the deal form's: the order already exists and is being looked at, and
  where it came from does not become truer at a later status.

- 1783cef: Eight more related panels say what to do on an unsaved record, instead of rendering nothing.

  golive#216 was filed about ONE panel: a tester creating a deal expanded "What's being sold" and found
  it _"empty, with no add button and no message"_, and could not tell whether products were unavailable,
  broken, or somewhere else. That panel is fixed separately.

  **Eight sibling panels had exactly the same shape**, and were found by sweeping for it rather than by
  waiting for the next ticket:

  ```
  @if (Record.IsSaved) { <grid> }     // ...and nothing at all otherwise
  ```

  | panel                     | an unsaved record now reads                            |
  | ------------------------- | ------------------------------------------------------ |
  | Internal team             | _Team members are recorded against it once it exists._ |
  | Buying team               | _Contacts are linked to it once it exists._            |
  | Activity                  | _Activity is logged against it from then on._          |
  | Stage history             | _Stage changes are recorded from then on._             |
  | Payment schedule          | _Payments are scheduled against it once it exists._    |
  | Deals, on an organization | _Deals are linked to it once it exists._               |
  | Deals, on a person        | _Deals are linked to them once they exist._            |
  | Deal team, on a person    | _Their role on a deal is recorded once they exist._    |

  Each opens with the instruction the lines panel uses — "Save the deal first." — so a rep meets one
  voice across every panel on the form. The three on the Organization and Person forms name **those**
  records rather than sales' own vocabulary: they are `MJ_BizApps_Common: Organizations` and `People`,
  and a panel contributed onto someone else's form should not rename the record it is sitting on.

  **Not one of the eight carried a comment saying the blank was deliberate**, which is what settles them
  as the same defect rather than a design choice. The judgement was made per panel rather than by
  find-and-replace; Activity is the one where a blank could be argued for, and it gets a message on the
  same grounds as the rest — a rep cannot tell "nothing yet" from "broken" by looking at nothing.

  **The style is part of the fix, not decoration.** `.mjs-deal-empty` is scoped per component under
  emulated encapsulation, so a panel that gains the markup without the style renders the hint as
  unstyled body text. `FIELD_STYLES` already records that happening once with `dw-field__hint`. Every
  panel touched here therefore carries `EMPTY_STATE_STYLES` in its own decorator, and a test asserts it
  per panel — a panel could otherwise pass every copy assertion and still look broken.

  17 tests: the message and its branch ORDER for each of the eight, the style for each of the eight, and
  a sweep tripwire for the shape itself.

  **The tripwire reads the form-panels DIRECTORY, not the two files this changes**, and that distinction
  is load-bearing. The next instance is most likely to arrive in a NEW file — which is exactly what
  happened while this was open, when `order-related.panel.ts` landed from another PR. A tripwire pinned
  to two hardcoded sources would have been watching the wrong place and still reported green. Proved by
  dropping a new panel file written to the old shape into that directory: the tripwire fails and names
  the file. (That panel is not itself an offender — it renders no labelled section when it has nothing,
  so nobody expands it and finds a blank.)

- 1853c4b: The deal workspace no longer offers Add product on a closed deal.

  golive#206 item 1 asks for a line on a closed deal to be refused "whichever screen or API path it comes from", and names the deal **form's** grid for the affordance half. The workspace has its own Add button, which the issue never mentions, and it was gated only on the deal being saved — so a rep could add a product to a Won deal here while the form's grid refused the same gesture one screen over.

  The server is the rule and orders enforces it: a line saved through the order graph outside booking is asked, and a frozen deal refuses. This is the affordance half. Without it the gesture is offered, taken, and then fails at save time as a thrown error, which is the shape item 1 exists to replace.

  **Removal needs no second rule here.** `ShouldRefuseLineRemoval` is `!!line.IsSaved`, so every saved line is already declined at the gesture — for KI-20's reasons rather than the lock's, but a rep on a closed deal meets the same wall either way, and a second rule would be two messages for one refusal. That is asserted rather than assumed, so if KI-20 is ever fixed and this relaxes, the lock gap it currently hides surfaces as a failing test instead of a silent regression.

  The message follows golive#207's voice and gives the same instruction as the header notice and the server refusal: _"This deal is closed. Set the status back to Open before adding a product."_ No template change — the button already binds `[disabled]="!CanAddLine"` and renders `AddLineBlockedReason` as its hint.

  Six tests, three mutations all killed: removing the gate (which restores the defect exactly), never choosing the lock message, and blocking unconditionally. The third matters because without it a gate that always refused would pass every other assertion.

- 7cd03e8: A closed deal's existing product lines can no longer be edited from the workspace.

  **This is the half sales#84 missed, and its reviewer caught it.** #84 stopped this pane _offering_
  Add on a closed deal. The review then pointed out that the same pane still let a rep change product,
  quantity, discount and term start on one — and golive#206 item 1 covers edits, not just additions:
  _"Adding, **editing** or deleting a line on a locked deal should be refused at the server, whichever
  screen or API path it comes from."_

  Those four inputs carried no `disabled` binding at all. `UnitPrice` and `LineTotalNet` were already
  read-only — Sales must not price — so the gap was exactly the four a rep can type into.

  **Not gated on `IsSaved`, deliberately, and that is the difference from `CanAddLine`.** Adding needs a
  saved deal because the order is minted on first save. An unsaved deal is precisely where a rep
  composes its lines, and nothing is frozen until a status locks it, so gating edits the same way would
  break normal composition. A test pins that difference rather than leaving it to be re-derived.

  **No second visible paragraph.** On a locked deal `AddLineBlockedReason` already renders _"This deal
  is closed…"_ beneath this grid. A second sentence saying the same thing about a different gesture
  would be two messages for one condition — the reasoning #84 used to leave removal alone. The refusal
  reaches a rep who hovers a greyed field through `title`, and the pane-level explanation is already on
  screen. The product select keeps `ProductLabel` while editable, since the product name is what is
  wanted there, and falls back to the refusal only while locked.

  The wording is `This deal is closed. Set the status back to Open before changing what was sold.` —
  golive#207 row 17's sentence, shared with the deal form's field refusal and this pane's Add hint, and
  word-for-word what the server-side `DealLockRefusal('update')` produces in sales#98. A rep meets one
  sentence wherever the same lock refuses them.

  **Removal still needs nothing here.** `ShouldRefuseLineRemoval` is `!!line?.IsSaved`, so every saved
  line is already declined at the gesture — for KI-20's reasons rather than the lock's, but the wall is
  the same either way.

  **Two more ways into the same fields, found in review of this PR.** Disabling what a rep can _type
  into_ left two controls that write without typing, and the requirement quoted above covers both:

  - **The term-start reset.** The date input beside it was disabled; the button that clears it was not.
    `ResetTermStart` nulls `ServicePeriodStart` **and** `ServicePeriodEnd`, so the one control this
    change first missed was the one that wrote most. It now carries the same binding, keeping its own
    hint while editable exactly as the product select keeps `ProductLabel`.
  - **The full line detail.** `OpenLineDetail` opened the generated Order Line form with
    `EditMode: true` unconditionally — the service period, term, product reference and description,
    every one of them editable on a frozen line. It now passes `EditMode: this.CanEditLines`.

    The button is still **offered** on a closed deal, and read-only rather than withheld: a closed deal
    is what people go back and inspect, and those four fields have no other surface, so withholding it
    would cost the reading to prevent the editing. `CreateRelated` already gated a `forms.Open` the same
    way, stated the other way round — _a locked deal must not create a record it then cannot attach._

    This stops the **workspace** from requesting edit on a frozen line. Whether the generated form's own
    chrome still offers an Edit toggle in view mode is an MJ-level question, identical in every
    read-only context; `DealLockOrderLineVeto` (sales#98) refuses the save either way.

  13 tests, 8 mutations all killed, including the defect as reported and both ways of losing a binding.
  **Five of the thirteen assert the bindings exist**, which is the point: unlike #84, where the button
  already bound `[disabled]` and only a getter changed, these bindings are new — and a correct getter
  that nothing consumes would pass every behavioural assertion while a rep edited a frozen line. The
  slide-in is asserted on **behaviour** instead, because there the defect is not a missing binding but a
  value handed to a service: a version that read `CanEditLines` and passed `true` anyway would survive
  any grep of the template.

- Updated dependencies [40d8f7d]
- Updated dependencies [f1ecd20]
- Updated dependencies [ad9191c]
- Updated dependencies [2f1a3ea]
- Updated dependencies [c3b23cc]
  - @mj-biz-apps/sales-entities@6.6.0

## 6.5.0

### Minor Changes

- ffa2600: Sales dashboard: a reporting period, defaulting to the current fiscal quarter, bounding the Won tile, the forecast stack's Closed segment and win rate — and nothing else (golive#232).

  The Won KPI counted every won deal ever while the three tiles beside it described the current book, so the forecast stack added an all-time figure to open segments and produced a total that answered no question. UAT read the mismatch off the footnote ("closed won to date") and filed it.

  **The report's premise was half right, and the correction matters.** `Commit` and `Best Case` were drawn from the same unfiltered roster as `Closed`, so the entire stack was all-time, not just its Closed segment. Requirement 3 of the issue says open-deal figures stay unwindowed, so the stack now deliberately mixes a windowed Closed with the current open book — the same mixed-dimension caveat `DECISIONS-NEEDED.md` D-33 already records for `Sales: Forecast by Category` — and the card header says so instead of leaving a reader to add four bars that do not belong to one question.

  **"Fiscal quarter" reads a configuration that already existed, one app over.** `AccountingCompanyProfile.FiscalYearStartMonth`/`FiscalYearStartDay` is per-company, sales already declares accounting as a dependency, its own dev seed already writes those columns, and `deriveFiscalYear()` already reads them — so this adds **no table, no column, no migration**, and the year label follows accounting's convention (labelled by the calendar year it starts in). A copy in sales would have given one fact two homes and let the ledger and the dashboard disagree about FY26 while both looked right. Recorded as `docs/DECISIONS.md` D-FY1; D-28 is annotated, because a fiscal start being readable answers half of what it asked and not the half about monthly capture.

  Accounting may be absent — sales runs standalone — so the read is guarded on metadata first, exactly as the product picker is for orders. And because the setting is per-company while the dashboard is not company-scoped, **profiles that disagree fall back to the calendar year rather than picking one**, which is `deal-board`'s mixed-currency rule applied to a boundary. All four cases are named beside the selector.

  **The window is applied inside the `WonCount` CASE, never in the query's `WHERE`.** A `WHERE` would narrow every column: open pipeline would drop deals closing outside the window and `TotalCount` would stop describing the whole book. Omitting both parameters reproduces the previous all-time count exactly, which is what "All time" selects. `win-rate.sql` already took `PeriodStart`/`PeriodEnd` on the same `ActualCloseDate` dimension; one line of it did change, because it also carried an unconditional `ActualCloseDate IS NOT NULL` that contradicted its own stated denominator of closed deals and dropped an undated win from the all-time rate while the Won tile beside it counted one. A NULL comparison is UNKNOWN, so the window excludes an undated deal without that guard — the two figures now describe the same set under every period. The roster is deliberately _not_ parameterised: its filter is `COALESCE(ActualCloseDate, ExpectedCloseDate)`, which would have windowed the open deals the issue asks to leave alone.

  50 unit tests over the boundary arithmetic and the slices, plus the dashboard spec rewritten so the selector is the thing under test — it reads the window the tile _prints_ and holds the database to it, rather than re-deriving the quarter and proving only that two implementations agree. Two mutations checked: removing the month-end clamp (a 31 January year start putting Q2 on "31 April") fails exactly one test, and the won-deal fall-through fails two. The second of those initially passed against the mutation, because every fixture had `IsWon` and `IsOpen` mutually exclusive and the `else if` branch was unreachable — `IsOpen`/`IsWon` are independent columns on a vocabulary table, so a fixture setting both was added and the check now kills it.

  **Three defects found in review, fixed here.** A period change had no in-flight guard, so two quick clicks could leave the tile and the rate showing a superseded period's figures under the new period's label, permanently — each response is now matched against the selection current when it lands, a throw no longer escapes as an unhandled rejection, and the two period-bound figures render as pending rather than as last period's numbers under this period's dates. The fiscal-start read was logged at error level and awaited ahead of everything else the section loads, so a user without accounting permissions put a `console.error` on every dashboard load (which `expectNoConsoleErrors` fails on) and a thrown read took the whole section down for a value that has a documented fallback; it now logs at status and catches. And the basis line was seeded with `no-accounting`, telling every reader on an accounting host that the app was not installed until the read resolved — there is now a `pending` basis for the state before an answer exists.

  `dashboard-inspect` and `dashboard-period` imported each other; the two UTC date-only primitives both sides need have moved to a leaf `dashboard-dates` module, so the cycle is gone and `dashboard-inspect` re-exports them for every existing import path.

- e122765: Deal form: close and reopen a deal through actions, not by typing into the Status field (#205).

  The Status control offers the open lifecycle only, filtered by the `LocksDeal` flag the server's own
  refusal reads. Closing and reopening are actions on the Close panel: the close offers the real closing
  statuses by name and collects the loss reason and notes the operation demands; the reopen collects the
  reason `Sales.ReopenDeal` requires. Both surface the operation's warnings on success, not just on
  failure — a close whose contract was stubbed or whose finance task could not be routed now says so.

  The reopen is new here. The issue reported two defects, not one: a status write that closed a deal
  without closing it, and no way back afterwards. Filtering the statuses fixed the first and left the
  second, while the Status hint told the user to reopen a deal the form gave them no way to reopen.

- c931c6c: Deal form: reopening a deal no longer throws away what the user had typed (sales#73 review).

  Both reopen paths **on the deal form** ended by reloading the record, and a reload overwrites the
  in-memory one. Anything
  edited and not yet saved went with it — no prompt, no warning, no message. A locked deal is not a
  read-only deal: `DealFieldsEditableWhileLocked` keeps six fields open, seven on a lost one, and the
  panels render them, so a rep could legitimately be mid-sentence in Description when they decided to
  reopen from the Status control. The Description was gone when the form came back.

  **The reopen now saves first**, which the code previously said out loud that it must not do. The old
  comment's reasoning was that "the close lock would refuse the save and turn a legal reopen into a
  refusal". The lock refuses less than that: `DealEntityServer.checkCloseLock` filters
  `f.Dirty && !editable.has(f.Name)`, so only a dirty FROZEN field is refused, and a save carrying
  nothing but the carve-out fields passes straight through. Those are the only fields these panels let
  anyone type into — `FieldEditable` renders the rest read-only — so the case the comment was defending
  against is the one the form cannot produce, and the case it was preventing was the everyday one.

  When a frozen field IS dirty the save is refused, and the reopen is then **abandoned rather than run
  over the top**: `DealFormComponentExtended.Validate()` names the field before any round trip, the deal
  is left closed, and the typing is still on screen to correct. Discarding it to get the operation
  through would be the same defect wearing a different costume.

  **The order is the load-bearing part, and it is why this is not simply "save on the way past".** The
  save goes BEFORE the operation. Once `Sales.ReopenDeal` commits, the record in the browser still holds
  the CLOSED status in both `Value` and `OldValue` — the operation moved the row, not the copy — so a
  save at that point writes that closing status back over the reopened row.

  Nothing would refuse it, which is what makes the order a correctness matter rather than a tidiness
  one. Both halves of the status field are equal, so it is clean: `planStatusTransition` returns null on
  `!field?.Dirty`, the golive#205 trigger never sees it, and the update writes the column anyway because
  MJ sends every `AllowUpdateAPI` field and applies no dirty filter. The result is a silently re-closed
  deal with `ClosedAt` still cleared by the reopen. A check that only proved a save happened would stay
  green through that rearrangement, so every ordering assertion in the new suite names both calls and
  their positions.

  **The Close panel's reopen is fixed too**, because it carried the same wrong premise in its own
  comment. Its symptom differed rather than being absent: that button is not inside `@if (EditMode)`, so
  in edit mode it reopened the deal and then reloaded **nothing at all** — `canRefreshRecord()` is false
  while edit mode is on, and it returns false rather than throwing — leaving a reopened deal still drawn
  as closed and locked. It now saves, ends edit mode and reloads, the same way the Status control does.

  A clean record is still not saved. The reopen control renders only inside `@if (EditMode)`, so
  `ConfirmClose`'s `EditMode || Dirty` condition would have written to a locked row on every reopen for
  no reason; `Record.Dirty` is the question actually being asked, and it covers companions and the IsA
  parent as well as fields.

  9 tests, three mutations checked: skipping the save entirely (the original defect) fails 6 of them,
  moving the save after the operation fails 2, and saving unconditionally fails 2.

  **Scope, added after review: the deal WORKSPACE is not covered.** Its `ReopenDeal()` still goes
  straight to `RouteOperation` and then `ReloadActiveDeal()`, with no save-when-dirty — and
  `ReloadActiveDeal()` also calls `MarkClean(tabId)`, so the tab-strip dirty marker is cleared and the
  user loses even the after-the-fact signal. `Description` is editable on a closed deal there too, and
  the Reopen button sits in the lock banner directly above it. The workspace's own `ConfirmClose`
  already saves when dirty, so the fix is a mirror of the pattern established here. Tracked separately;
  this changeset said "both reopen paths" unqualified, which would have read in the CHANGELOG as if the
  whole class were closed.

### Patch Changes

- 21f30ab: Pipeline board and command-center dashboard: the plain-English pass from golive#207, on the two surfaces it did not reach.

  #207 is written about the Deal form, and every row of its replacement table landed there. The same strings were still live elsewhere, so the form read **"Entered manually"** while the board's Amount icon said **"Stated by a person, not priced by the orders engine"** about the same number — which is the complaint #207 was filed about, one screen over. The board's other provenance tooltip said "Priced by the orders engine" where the form says "Priced by Orders"; the dashboard's owner chart bucketed ownerless deals under "Unowned" where the form's Situation card now says "No owner".

  **One of these was not a copy problem.** The lock icon on a closing board column carried:

  > Arriving here closes and locks the deal — close it from the deal form.

  That is not developer voice, it is wrong. `planStageDefaults` gates the stage-derived status on `LocksDeal` and contributes nothing when it is set, so a deal moved into such a stage keeps the status it had — its own comment says "the deal keeps whatever status it had and only `Sales.CloseDeal` can change that". And the move cannot happen anyway: `CanDropInto` returns false for a closing column, with a second guard behind it. A rep reading the old text would have believed a drag closes a deal, which is the same wrong belief golive#205 was filed about. It now says what the lock icon means — the column is not a destination — and points where the empty state below it already points.

  Scope is deliberately narrow: four user-visible strings. Left alone on purpose are `sales-section.component.ts`, where "Unowned" is in a code comment, and `metadata/queries/.forecast-by-owner.json`, which renders ownerless deals as "(unassigned)" with its own documented reasoning and would need a metadata migration to change. Both are worth a decision, neither is this change.

  7 tests, five mutations checked, all killed: reverting each of the four strings, plus swapping the owner fallback from `||` to `??` — which keeps the label correct but stops a blank owner name reaching it, and is the one that proves the blank-owner check is not vacuous. The dashboard half is tested through `OwnerCoverage` itself rather than against the source, because it is a pure function and the label can be read off what it returns.

- 9404cfc: Deal form: a closed deal no longer shows a permanent, unactionable stale-amount warning (golive#230).

  Every Won deal carried "A line has changed since this amount was last priced. Reprice the order to
  update the total." — forever, and with nothing the reader could do about it. The deal is locked, so the
  amount cannot change; and there is no reprice control anywhere in this codebase, so the sentence asked
  for an action that does not exist.

  **The check was keyed on a proxy rather than on the thing it cared about.** Both surfaces read the
  newest `__mj_UpdatedAt` across the order's lines and called the amount stale if it was later than
  `AmountComputedAt` — which asks "was a line TOUCHED", not "has the number moved". Closing a deal books
  the order, which moves every line's status and stamps `__mj_UpdatedAt` without a figure changing, so the
  close itself guaranteed the warning and the lock guaranteed nobody could clear it.

  That is CLAUDE.md rule 8's shape exactly: a claim that was true when it was written — a touched line
  usually did mean a moved price — and stayed asserted after the close flow started touching lines for its
  own reasons. A proxy can be outgrown; the number cannot.

  **Now it compares the number.** `ResolveDealAmountFreshness` in `sales-entities` tests the cached
  `Deal.Amount` against the order's current `TotalGross`, which is the SAME test
  `DealEntityServer.refreshAmountFromOrder()` uses to decide the cache is already current — so the surface
  and the server agree by construction rather than by coincidence: if the server would rewrite the cache,
  this says stale; if it would no-op, this says fresh. Still a comparison of two stored figures, never
  arithmetic.

  **A locked deal returns fresh before anything else**, and does not even read the order. The amount is
  frozen, so there is no edit that could resolve the notice and no reason to ask.

  **The copy now names an action that exists**: "The products on this deal changed after the amount was
  calculated. Save the deal to update it." Verified rather than assumed — `DealEntityServer.Save()` sets
  `amountMayHaveMoved` when `AmountIsComputed === true`, which is precisely the state the notice appears
  in, and then re-reads `OrderHeader.TotalGross` into the cache.

  The rule is shared so the Deal form and the deal hero cannot answer it differently, the same reason
  `ResolveDealLockState` is. 12 checks, each no-warning case paired with one that DOES warn on the same
  input — a suite that only proved "a locked deal is quiet" would pass against an implementation that
  never warned at all.

- d79ef5b: Deal form: the two server-maintained stamps are no longer offered for editing.

  The Account & people panel rendered `CompanyID` and `OwnerEmployeeID` as editable on any unlocked deal, and neither is a field a caller may set. `stampCompanyFromPipeline()` overwrites a supplied `CompanyID` from the pipeline's company; `ownerStampEditRefusal()` refuses a supplied `OwnerEmployeeID` outright, because the owner comes from the deal team via `stampOwnerFromTeam()`. CLAUDE.md states it directly — "written by entity-server code. Never hand-set them."

  So a rep could pick a company or an owner, press Save, and have the choice silently discarded or the save refused. That is the "accepts typing, refuses on save" behaviour golive#206 item 3 exists to delete, on a panel nobody had revisited.

  Both fields stay **rendered and navigable** — `link: 'Record'` is untouched, so the company and the owner are still visible and still open their records. What goes away is the invitation to type into them.

  The flag is consulted BEFORE the close lock, deliberately: the lock is not the reason. A server stamp is frozen on an open deal too, and checking it after the lock would leave exactly the case that matters — an unlocked deal — still editable.

  Not to be confused with the `''`-into-`uniqueidentifier` bug also found on this panel's neighbours: these five fields all carry `RelatedEntityID` and render as FK pickers, so they never had that defect. That one was the generated Sales Accounts form, fixed separately.

- dd4a8d4: Deal form — all three lock messages, in plain English (golive#207 rows 16, 17 and 18).

  These were the tester's own deferrals from the last copy round: they wait on the close/reopen work,
  because both replacements tell the user to "set the status back to Open" and until golive#205 landed
  that was not something the form could do. It is now.

  **The header lock notice** said the deal was "closed (Won) and locked", explained that a contract or
  an order was derived from it, and told the reader to "reopen the deal, which records a reason". The
  replacement names what can still be edited and the one action that unblocks them. The provenance
  argument is gone: a person who has just been stopped wants to know what they can do, and the reason
  is one click away in the close history.

  **The form save refusal** said "Frozen: this deal is closed and locked. Reopen it through
  Sales.ReopenDeal, which records a reason, if this genuinely needs to change." — the word "frozen"
  three times over before anything actionable, and an API operation named to someone who had just typed
  into a form field.

  **The editable list is DERIVED, not the three names the tester wrote.** They wrote "Deal Status,
  Description and Next Step" when the editable set held two fields; golive#206 item 3 expands it. A
  hardcoded sentence would have started lying the moment that landed, and it would have read perfectly
  while doing it. The notice composes the set through a label map, so it stays true as the set changes.

  **MINOR, not patch, because `sales-entities` breaks.** The exported constant
  `DEAL_FIELDS_EDITABLE_WHILE_LOCKED` is gone and `IsDealFieldEditableWhileLocked` takes a second
  argument now. golive#206 item 3 made the editable set depend on whether the deal was LOST, so a
  constant could no longer answer the question and a one-argument predicate could no longer ask it.
  Consumers outside this repo would not compile.

  **Deal Status is listed but is not in the editable-while-locked set**, which looks like a
  contradiction and is not. That set is what the SERVER accepts in a bare save, and golive#205 asks for
  a bare status write to be refused on every path — the status moves through `Sales.CloseDeal` and
  `Sales.ReopenDeal`, which the form's status control routes to. The field is editable to a person and
  not writable by a raw save, and one set cannot say both. The notice is the one that describes people.

  **Row 18, the SERVER refusal**, said "this deal is closed and locked; {fields} cannot be changed.
  Reopen it through Sales.ReopenDeal, which records a reason." It is row 17's sibling: row 17 is what
  the form shows a person, row 18 is what the save returns to whoever asked — the form, an import, an
  agent or a raw API call. Its `{fields}` stays interpolated for the same reason the notice composes
  its list: golive#206 item 3 grows that set.

  Row 18 began on sales#73, the golive#205 branch, because that is where its sentence became TRUE —
  until the trigger landed, a status write could not reopen a deal and the refusal genuinely had
  nowhere else to send an integrator. It moved here so that one PR owns one issue. The sequencing is
  unchanged and was the tester's own: "the three lock messages assume the close/reopen issue lands".
  **This PR merges with sales#73, never before it.**

  It also arrived with no test at all — reverting the sentence broke nothing. It has one now, which is
  where the fourth mutation below comes from.

  22 tests, nine mutations checked: reverting any of the three messages, dropping Deal Status from the
  list, un-humanising the labels, losing the sentence's final "and", hardcoding row 18's field list,
  appending the API detail back onto it, and printing row 18's fields by column name instead of label.
  The row 17 revert survived every other test in the repo until its own gate existed, and row 18's
  revert did the same.

- aaf9189: Five defects the deal-lock stack (sales#72, #73, #78, #79, #80) merged with, and the three checks that were looking the wrong way.

  **A refused save put the caller's status back.** `saveDeclared` reverts `DealStatusTypeID` to its persisted value so the close lock sees a clean field — correct for a save that proceeds, a trap for one that refuses. A caller who read the refusal, fixed what it named and saved the SAME object got `planStatusTransition() === null` on `!field?.Dirty`: no close ran, the other edits committed, and `Save()` returned **true**. An open deal carrying a loss reason, and a caller told it worked. Restored in `refuseSave` rather than at each `return false`, for the same reason the `finally` above it exists — there are four exits and the bug is always the one added later.

  **A stamp failure was silent.** The `catch` around `stampCompanyFromPipeline`/`stampOwnerFromTeam` was `LogError` + `return false`, so `ResolveOwnerRoleID`'s "no active DealRole has IsOwnerRole = 1. Seed one before assigning an owner." — a message that names its own remedy — reached the user as "Unknown error creating record" (bc-aidp-next-golive#216). It now goes through `refuseSave`; the log line still contains the exact substring that issue tells people to grep for.

  **Row 18 printed column names.** `DEAL_FIELD_LABELS` holds exactly the editable-while-locked set plus `DealStatusTypeID` — the fields row 16 lists. Row 18 names the FROZEN fields, none of which were in the map, so every one fell through to its raw column name. The fallback now splits the column name and drops a trailing `ID`, so the map is an override rather than the only source of a label and a column added tomorrow cannot regress it.

  **The reopen test only ever saw one of two panels.** `source.indexOf('public async ConfirmReopen...')` returned the Pipeline panel's copy, so `MJSDealClosePanel` was invisible to it — permanently. That is how the Close panel shipped a reopen which never left edit mode under a green test named for exactly that. It now finds every declaration and asserts about each, and accepts either spelling of the reload (`RefreshRecord()` directly, or `refreshQuietly()`), because pinning one would have failed the panel that does it correctly. Verified against sales#72's tree, where it correctly fails `MJSDealClosePanel`.

  **A Playwright assertion outlived its string.** sales#79 rewrote the closing column's lock title to "Deals cannot be moved here."; `80-board-drag.spec.ts` still asserted `/closes and locks/i`. The Explorer harness is deliberately out of CI, so nothing caught it. `COVERAGE-MAP.md`'s row for that step had drifted independently — it claimed `/workspace/i` where the spec asserts `/form/i` — and now matches.

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

- 8df0584: Deal hero: drop a focus call that could never fire.

  `OnRecordRefreshed` fires after the parent form reloads the record from the database, so the record
  is saved by definition — and the first rule in `ShouldPlaceCursorInName` declines saved records. The
  call was unreachable. `ngAfterViewInit` is the one that places the cursor.

- 2647a12: Deal hero: put the cursor in Name when a new deal opens (#188).

  bc-aidp-next-golive#188 asks for three things. Two shipped already — a new deal no longer opens on a
  wall of validation warnings, and the deal number and name are no longer duplicated. This is the
  third: clicking New Deal now leaves the cursor in the name box rather than leaving the user to work
  out where typing starts.

  Name lives in the hero rather than in any panel, so the hero is the only component that can do it.
  Focus is taken only for an UNSAVED record, only in edit mode, only once per record, and never when
  the user has already reached another field — taking it on a saved record would fight anyone
  navigating by keyboard, and taking it twice would yank the caret back mid-sentence.

  The decision is a pure exported predicate so those rules are pinned by tests; the component keeps
  only the two lines that genuinely need a DOM.

- 6c2c6aa: Deal hero: show the deal number on a collapsed header too (#190).

  The hero's deal number was gated on the header being expanded. The deal-form UAT batch removed the
  Pipeline panel's Deal Number box, which made the hero the only place the number appears anywhere on
  the record form — and the header's collapsed state is a persisted per-user setting, sticky across
  sessions and across every deal. So anyone who had ever collapsed the header saw no deal number at
  all, which is the opposite of what #190 asks for.

  Collapsing hides the briefing — account, owner, stage, next step — not the fields that identify the
  record. Same reasoning already applied to the Name editor in the UAT batch.

- 0fb6903: Deal form: a new deal opens on Pipeline, where typing starts (#188).

  Declares `leadsWhenUnsaved` on the Deal Pipeline panel, so clicking New Deal opens the panel that
  asks for something rather than Overview. Overview is an exec briefing and stays the lead for a saved
  deal, which is what it is for; on a record with no data it is a page of blanks the user has to look
  past to find where to begin.

  This is the last of the three things bc-aidp-next-golive#188 asked for. It does nothing until a
  MemberJunction release carries the reader for the setting — see the PR for why nothing will report
  that in the meantime.

  - @mj-biz-apps/sales-entities@6.3.3

## 6.3.2

### Patch Changes

- 6d83182: Deal form: a new deal is not a deal that failed an audit (#188, #189, #190).

  The Pipeline panel listed `Name` and `DealNumber` while the hero directly above already
  renders both — `Name` as an editable field in edit mode, `DealNumber` beneath the title once
  the server assigns one. The form therefore offered two inputs bound to one column, and an
  empty textbox for a value the user does not get to choose. Both are gone from the panel; the
  hero's `Name` is the one that survives.

  Overview no longer greets an unsaved record with "No owner", "No next step" and "No account".
  A deal nobody has saved has not _failed_ to have those — nobody has had the chance to give it
  one. Health returns nothing until `IsSaved`, the same signal the container already uses to
  decide not to restore a stored rail position for a new record.

  Tests pin all three fixes and mutation-check that they hold.

  Not fixed here: that a new deal lands on Overview at all (the other half of #188). The
  container picks `spec.Groups[0]`, its coordinator is a private per-container provider, and the
  container is not exported for `ViewChild` — there is no seam a form can reach. It needs a small
  opt-in in MJ base-forms.

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

### Minor Changes

- 11b3613: A term start on subscription lines, defaulting to the order date (#32).

  A subscription line on a deal now carries its own **Term start**. It displays the embedded order's
  `OrderDate` as a default, writes `OrderLine.ServicePeriodStart` when the rep sets one, and stops
  following the order date once set. A reset action returns it to the default. Non-subscription lines do
  not show the field.

  **`sales-entities`** gains `term-start.ts` — `IsSubscriptionProduct`, `ShouldOfferTermStart`,
  `EffectiveTermStart`, `HasExplicitTermStart` — as pure rules with no Angular dependency, so the
  integration suite can check them without standing up a component. `ProductLookup` gains
  `SubscriptionTypeID`, and `PRODUCT_LOOKUP_FIELDS` is exported so the picker's query and the check that
  guards it read one list rather than two copies. That constant now carries an `as const satisfies`
  completeness check against `keyof ProductLookup`, because rebasing this branch onto #29 showed how the
  list fails: it produced no merge conflict at all — `next` had never carried the constant — so git took
  this branch's version whole and silently dropped the two fields #29 had added. Nothing would have
  failed until a line booked to the wrong company.

  **A note on the bump level.** `SubscriptionTypeID` is a REQUIRED member of the exported `ProductLookup`
  interface, so strictly any external code constructing one stops compiling. It is declared `minor` here
  anyway, and the reason is that the level makes no difference to what ships: #29's changeset is still
  pending in this same release, it declares `major`, and `.changeset/config.json` groups all six packages
  as `fixed` — so everything moves to **6.0.0 together** and this interface change goes out under a major
  either way.

  Were it deciding the number on its own, `minor` would still be the call: no consumer of this type exists
  outside this repository — verified across `bizapps-orders`, `bizapps-accounting`, `bizapps-contracts`,
  `bizapps-common`, `bizapps-tasks` and MJ — and Robert Kihm confirmed on 2026-08-29 that there is leeway
  on major/minor before LTS. Recorded rather than assumed, because the next required member added to this
  interface may not have a major already travelling with it.

  **This field has no effect until bizapps-orders#121 lands, and that is worse than it sounds.** Orders
  today overwrites `ServicePeriodStart` at confirm from `SubscriptionBehavior.ComputeStartDate`, whose
  context carries no field for a requested start at all — so the rep's date is discarded AND orders writes
  its own computed date back into the column. Reopening the deal then shows that computed date as though
  someone had deliberately chosen it, complete with the reset button and no "order date" hint. Sales and
  orders need testing together, which is what Andrew's note on both issues asks for.

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

### Minor Changes

- c2d8e5a: A deal may carry any company's product, and the line takes its company from the product (#29).

  **All six `@mj-biz-apps/*` packages move to 6.0.0 together.** `.changeset/config.json` declares them
  `fixed`, so a major anywhere moves the group — the `minor` below is what `sales-ng` would warrant on its
  own, not what it will ship. `sales-actions`, `sales-core-entities-server` and `sales-server` are
  unchanged by this PR and go along for the ride. Approved by Robert Kihm on 2026-08-29: moving Sales to v6
  brings it in line with the MJ major version, and there is leeway before LTS.

  **Breaking, `sales-entities`.** `ProductFilterFor(companyID, asOf)` is now `ProductFilterFor(asOf)`.
  The `CompanyID = <the deal's company>` clause is gone; `Status = 'Active'` and the availability
  window stay. Callers drop the first argument. There is no behavioural shim: a filter that silently ignored a company
  you passed it would be worse than one that fails.

  Note the failure is not always a compile error. Three `.mjs` harnesses in this repo called the two-argument
  form, and nothing type-checks `.mjs` — the GUID bound to `asOf` and they died at runtime on
  `asOf.getUTCFullYear is not a function`. All three are updated in this PR, and each now spells out its own
  company clause, since wanting products for ONE company is a real need the shared rule no longer expresses.

  `ProductLookup` additionally carries `CompanyID` and `Company` (the owning company's NAME, so the
  picker can distinguish two same-named products from different companies) — both additive — a line's company can no longer be
  inferred from the deal, so it has to come from the product the rep actually chose.

  **Why.** With both pipelines owned by Blue Cypress, that clause made every Betty and Sidecar product
  unsellable — an Account Director could not put one on a deal at all. Company ownership lives at the
  PRODUCT, not at the deal (Johanna Snider, Sales channel, 2026-08-26). `docs/DECISIONS.md` D5 has always
  said a deal lives in one company's pipeline while its lines carry their own company from the product,
  so the clause contradicted D5 and the picker now agrees with it. No tenancy boundary is being relaxed,
  because there was never one here.

  **`sales-ng`.** `OnProductChange` stamps the line's `CompanyID` from the chosen product rather than
  from the pipeline. Orders' `OrderLineEntityServer` derives the same value at save, so the stored value
  was already correct either way; the stamp exists for the browser, where `CanSave` runs
  `deal.Validate()` without that server subclass and `OrderLine.CompanyID` is NOT NULL. Left unset, the
  rep gets a disabled Save reading "Company ID cannot be null" against a form that looks complete. The
  deal header still derives its company from the pipeline, unchanged.

  Also adds a unit-test tier to this repo — `vitest` plus a root config shaped after bizapps-orders, and
  `test:unit` wired into `verify`. `test:unit` had been a dead script with no dependency and no config,
  which is why two of this issue's acceptance criteria had no coverage in any tier.

### Patch Changes

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

- c31077b: Deal lines can name a product from orders' catalogue.

  `DealLine.ProductID` has been carried on the entity since the previous release, but nothing populated it —
  a rep could record _that_ a line existed without saying _what_ it was for. This adds the picker, and the
  rule deciding what may appear in it.

  `ProductFilterFor(companyID, asOf)` lives in `sales-entities` rather than in the component, so the UI,
  the integration suite and (later) the close-won handoff all apply one rule instead of three re-typed
  copies of it. It filters on three conditions, each of which fails silently when wrong: the selling
  company, a sellable status, and the availability window evaluated **as of a date** rather than "now" —
  so a deal quoted last year and one quoted next year do not see the same catalogue.

  Orders may be absent entirely, and that stays supported: `DealLine.ProductID` is a soft reference with no
  foreign key crossing into orders' schema. `LoadProducts` checks the entity is registered before querying,
  because `RunView` against an unregistered entity logs a console error rather than returning a failure —
  which took the whole workspace screen down on a host without orders.

  Integration checks PP1–PP4 cover the filter against a live database. They are **not** in the default gate
  yet: they need orders' entity metadata, which cannot be registered on a Sales-only host. The reason, and
  what it would take, is recorded in `docs/KNOWN-ISSUES.md` KI-10.

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

- 952d9fa: Inline account and contact creation happens in a slide-in and selects the result back into the field.

  S-US1 says a rep can create a customer organization or primary contact "without leaving the deal."
  `CreateRelated()` opened a new Explorer tab and returned nothing to the picker, so the rep had to navigate
  back and re-find the record they had just made. It now opens a slide-in via `MJFormPresenterService` —
  omitting `RecordId` is the presenter's own contract for a new record — reads the created entity from
  `AfterSaved()`, reloads the lookups, and selects it.

  The old comment argued there was no reliable moment to come back at. That was true of a tab, which has no
  lifecycle the component can await, and false of a slide-in, which has exactly that moment. The half of the
  argument worth keeping is kept: an explicit switch over a `DealRelatedTarget` union writes only the field
  the rep launched from. The create button is now also hidden when that field is not editable, so a locked
  deal cannot create a record it would then fail to attach.

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
