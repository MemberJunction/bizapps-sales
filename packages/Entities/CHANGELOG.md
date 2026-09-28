# @mj-biz-apps/sales-entities

## 6.8.2

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

- a8716f3: A pipeline can be flagged out of the forecast (bc-aidp-next-golive#257).

  New column `Pipeline.IncludeInForecast` (default 1). When it is 0, that pipeline's open deals are left
  out of `Sales: Pipeline Summary`, `Sales: Forecast by Category`, `Sales: Forecast by Owner`,
  `Sales: Dashboard Summary` and the dashboard's forecast stack, funnel, close buckets and open counts. The
  daily forecast snapshot reads `Sales: Forecast by Category`, so it follows. Won and lost deals in the
  pipeline still count toward bookings, win rate and the closed figures, and the board still shows the
  pipeline. Passing the pipeline's ID as `PipelineID` includes it.

  Previously no query read `Pipeline.IsActive`, so there was no way to keep a pipeline that holds
  historical deals out of the live forecast.

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

## 6.7.1

### Patch Changes

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

## 6.7.0

### Minor Changes

- 77278d7: `V202609202353__v6.4.0__Predictive_Deal_Win_Fields` could not apply on any host.

  The three `EntityField` inserts for `PredictedWinProbability`, `PredictedWinRiskBand` and
  `PredictedWinScoredAt` name `[RelatedEntityDisplayType]` in the column list and pass `NULL` for it.
  That column is `NOT NULL` in MJ core with a default of `N'Search'` — and an explicit `NULL` overrides
  a default rather than falling back to it, so the insert is rejected:

      Cannot insert the value NULL into column 'RelatedEntityDisplayType', table '<db>.__mj.EntityField';
      column does not allow nulls. INSERT fails.

  On AIDP Next stage this aborted the 6.6.0 upgrade at batch 12 of 22, after common, tasks, accounting,
  orders and contracts had already upgraded, leaving the sales app registered `Error`.

  Each insert now passes `'Search'` explicitly, matching the column's own default and what every other
  non-relational field in this migration would have received. The fields are not foreign keys, so the
  display type is immaterial to behaviour — it simply has to be a value.

  **Edited in place rather than superseded.** The column has been `NOT NULL` in MJ core throughout 6.x,
  so this migration cannot have applied successfully on any 6.x host; no host carries a checksum for it.
  Skyway recorded nothing on the failed run — no history row, no partial rows — so a corrected re-run
  starts clean.

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

- 2f1a3ea: Deal form: reach the order and the contract from a won deal's header, and stop offering the draft order on an open one (golive#226).

  A tester closed a deal as Won and could not get from it to either the order or the contract. The header carried Account, Owner, Stage and Amount and nothing else; the Motion panel showed **Contract ID** and **Renews Contract ID** as raw GUIDs in text boxes; and the one order link on the form appeared on **open** deals too, where the order is still a draft nobody should be editing directly.

  **The header row is not ours.** It is `bizapps-related-chips` from `@mj-biz-apps/common-ng` (golive#225), which is the row contracts and orders use as well. All this app decides is which relationships a deal has — Order and Contract on a won deal, the renewed contract at any status, because a rep needs to see what a renewal is renegotiating precisely while the deal is still open. Reading each record's name, and deciding when a chip must not be drawn at all (the sibling app is not installed, the record is not there, the user may not read it), belongs to the shared component and is tested there. That rule lives in `deal-related-links.ts` rather than in the panel, so a test can reach it without standing up DI.

  **The GUIDs were structural, not cosmetic.** `Deal.ContractID` and `Deal.RenewsContractID` are deliberately soft references — the link points down the dependency graph and contracts knows nothing about sales — so there is no FK, `EntityField.RelatedEntity` was unset, and `mj-form-field` had no name to show and nowhere to go. They now ship as MJ **soft foreign keys**: declarative metadata under `metadata/entity-fields/`, plus a matching declaration in `codegen-schema-info.json` so a rebuild-from-zero re-applies them instead of silently regressing the form to GUIDs. No constraint, no cascade, nothing to violate — the database is untouched. Both fields now render the contract number as a link, and `RenewsContractID` gains an FK search in edit mode instead of asking a rep to paste a UUID.

  **The order link came off the Motion panel entirely.** The header chip is the only route to the order now, and it is gated on the win, which is what item 4 asks for. Worth saying plainly in case it is ever read as more than it is: this is discoverability, not a lock. The draft order is still reachable by search, and anything that must actually refuse belongs in the entity server.

  `ResolveDealLockState` gained `IsWon`, read off the same status row it already fetches, by flag — a deployment may call its winning status "Signed". It is the one member of that shape **not** gated on `LocksDeal`: the rest answer "what may still be edited", a question only a locked deal has, while this answers "did we win", and tying a header decision to a field-editing one would drop the chips on a won deal whose status does not freeze it, with nothing on screen to explain the absence.

  20 tests. The one that matters most is a negative — no order chip on an open deal that holds an `OrderID` — because a rule that quietly started emitting it would look completely normal on the won deal everyone tests. Lost deals are asserted separately from open ones for the same reason: a future edit that gated on `IsLocked` instead of `IsWon` would pass every open-deal case and light both chips up on every lost deal.

- c3b23cc: Add predictive deal win propensity outcome columns, engineered training features, and layered base views.

  - Materializes `PredictedWinProbability`, `PredictedWinRiskBand`, and `PredictedWinScoredAt` on `Deal`.
  - Adds layered base views `vwDealsGenerated` and application wrapper `vwDeals` computing engineered training features (`WinOutcome`, `DaysToExpectedClose`, `HasPaymentSchedule`, `TeamMemberCount`, `HasPartnerInvolved`, `IsEnterpriseTier`, `AutoRenewFlag`, `StandardAgreementModifiedFlag`).
  - Configures scheduled scoring write-back binding targeting `PredictedWinProbability`.

### Patch Changes

- 40d8f7d: `Deal.AmountSourceHash`'s column description no longer names an action that does not exist.

  Closes #107. It told the reader the UI says _"this figure is stale, reprice"_. The UI has not said that
  since golive#230, and **no reprice control exists anywhere in this codebase** — the notice now reads
  "The products on this deal changed after the amount was calculated. Save the deal to update it."

  It matters because it is not prose. The description is a SQL extended property, which CodeGen syncs into
  `__mj.EntityField.Description`, which regenerates into `generated.ts` as the **GraphQL field
  description** — so a dead instruction reaches API consumers and Explorer tooltips.

  **A new migration, not an edit to the baseline.** The property is set by `V202608042101`, which has been
  applied to databases nobody will rebuild — the UAT host among them. Editing an applied migration changes
  its checksum and Flyway refuses the run. The repo already states this: `V202609020650` was numbered
  before its partner deliberately _"so no already-computed migration checksum changes"_. CLAUDE.md's
  BASELINE-IN-PLACE loop is explicitly conditioned on being pre-publish, and this repo left that state at
  `V202608251930`, the first `Metadata_Sync`.

  **The extended property is the whole fix**, and that is measured rather than assumed:
  `EntityField.AutoUpdateDescription` is 1 for this column, and the live row reads "the embedded order's
  line set" — the extended property's wording, not the baseline's generated `EntityField` insert ("the
  DealLine set"). The schema demonstrably wins, so the metadata row and the GraphQL description follow on
  the next CodeGen run. Nothing is hand-written into `__mj.EntityField`: PUBLISHING.md reserves that for
  the release `Metadata_Sync`.

  Applied against a live database: the old wording is gone, the new wording is present, and a second run
  is a clean no-op.

  **CLAUDE.md's migration loop is corrected with it.** Its BASELINE-IN-PLACE section still read as current
  instruction, and it is what this branch followed into editing an applied migration. The section now leads
  with the switch, names the evidence that it had already happened — five additive migrations after the
  baseline, the first publish at `V202608251930`, three weeks earlier — and keeps the original note below
  as history, since its reasoning is still correct for the phase it described. The `switch to
additive-only at first publish` bullet is struck through and dated.

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

## 6.5.0

### Minor Changes

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

### Patch Changes

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

- aaf9189: Five defects the deal-lock stack (sales#72, #73, #78, #79, #80) merged with, and the three checks that were looking the wrong way.

  **A refused save put the caller's status back.** `saveDeclared` reverts `DealStatusTypeID` to its persisted value so the close lock sees a clean field — correct for a save that proceeds, a trap for one that refuses. A caller who read the refusal, fixed what it named and saved the SAME object got `planStatusTransition() === null` on `!field?.Dirty`: no close ran, the other edits committed, and `Save()` returned **true**. An open deal carrying a loss reason, and a caller told it worked. Restored in `refuseSave` rather than at each `return false`, for the same reason the `finally` above it exists — there are four exits and the bug is always the one added later.

  **A stamp failure was silent.** The `catch` around `stampCompanyFromPipeline`/`stampOwnerFromTeam` was `LogError` + `return false`, so `ResolveOwnerRoleID`'s "no active DealRole has IsOwnerRole = 1. Seed one before assigning an owner." — a message that names its own remedy — reached the user as "Unknown error creating record" (bc-aidp-next-golive#216). It now goes through `refuseSave`; the log line still contains the exact substring that issue tells people to grep for.

  **Row 18 printed column names.** `DEAL_FIELD_LABELS` holds exactly the editable-while-locked set plus `DealStatusTypeID` — the fields row 16 lists. Row 18 names the FROZEN fields, none of which were in the map, so every one fell through to its raw column name. The fallback now splits the column name and drops a trailing `ID`, so the map is an override rather than the only source of a label and a column added tomorrow cannot regress it.

  **The reopen test only ever saw one of two panels.** `source.indexOf('public async ConfirmReopen...')` returned the Pipeline panel's copy, so `MJSDealClosePanel` was invisible to it — permanently. That is how the Close panel shipped a reopen which never left edit mode under a green test named for exactly that. It now finds every declaration and asserts about each, and accepts either spelling of the reload (`RefreshRecord()` directly, or `refreshQuietly()`), because pinning one would have failed the panel that does it correctly. Verified against sales#72's tree, where it correctly fails `MJSDealClosePanel`.

  **A Playwright assertion outlived its string.** sales#79 rewrote the closing column's lock title to "Deals cannot be moved here."; `80-board-drag.spec.ts` still asserted `/closes and locks/i`. The Explorer harness is deliberately out of CI, so nothing caught it. `COVERAGE-MAP.md`'s row for that step had drifted independently — it claimed `/workspace/i` where the spec asserts `/form/i` — and now matches.

## 6.4.0

## 6.3.3

## 6.3.2

## 6.3.1

### Patch Changes

- d40fd69: License declarations now agree on BUSL-1.1 everywhere.

  The Open App manifest (`mj-app.json`) declared `"license": "ISC"` and the README badge
  advertised ISC, while `LICENSE` and every `package.json` declared BUSL-1.1. The manifest is
  what an MJ deployment reads on install and the badge is the first thing a reader sees, so
  between them they were the repo's loudest license statement — and the wrong one. The badge
  now links to `LICENSE`.

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

## 6.2.0

### Minor Changes

- 4fc8b40: Unblock the Sales.SyncActivities retirement so 6.1.0's Metadata_Sync migration can apply.

  `V202609020700` retires Sales.SyncActivities with three core deletes. Those cannot succeed on any
  host where the job has actually run: every FK into `__mj.ScheduledJob` and `__mj.Action` is
  NO_ACTION, and the blocking columns are NOT NULL so the rows cannot be unlinked either. On AIDP
  stage the job had 158 `ScheduledJobRun` rows and its action 158 `ActionExecutionLog` rows, and the
  upgrade failed at batch 17/18 on `FK_ScheduledJobRun_ScheduledJob`.

  Adds `V202609020650`, numbered _before_ `V202609020700` so that file stays byte-identical and no
  migration checksum changes. It clears the retired job's and action's own run history, and stops
  with an explicit message — rather than a raw FK violation — if that history is itself referenced
  by other run records. Data-only, so no CodeGen output to append. Idempotent.

## 6.1.0

### Minor Changes

- f76f9c9: `Metadata_Sync` for the 6.x release — the DealLinker extension registration, the pipeline view, and the retirement of `Sales.SyncActivities`.

  Release seed coverage flagged 2 primaryKeys in no migration: the Activity Sync extension that
  registers `DealLinker` with bizapps-common's engine, and the Sales Pipeline user view. Without the
  first, a host installing from migrations gets the DealLinker code with nothing telling common's
  engine to call it.

  `V202609020700__v6.1.x__Metadata_Sync.sql` carries 161 records (2 created, 12 updated, 3 deleted,
  0 errors), generated against a database built from migrations only — MJ core v6.1.0-edge.5, common,
  tasks, accounting, orders, then this app.

  **The three deletes are deliberate.** They retire `Sales.SyncActivities` (an Action, its param, and
  its Scheduled Job), superseded by common's Activity Sync engine. All three were seeded by
  `V202608251930__v5.2.x__Metadata_Sync.sql`, so every host on 5.2.0 has them and needs them removed;
  they are declared as tombstones in `metadata/` via `deleteRecord: { delete: true }`, which is the
  mechanism MetadataSync provides for exactly this.

  Minor, not patch: this release carries a migration.

### Patch Changes

- 0e6b1a3: Move to MJ `6.1.0-edge.5`, and fix two stale root self-references that had the lockfile unbuildable.

  `pnpm install --frozen-lockfile` failed on **both `next` and `main`**, so the next release would have
  died at step one of `publish.yml`. Two root `package.json` entries pointed at versions that no longer
  exist in this workspace:

  | entry                                  | was      | problem                                                                                                                                                                                               |
  | -------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `@mj-biz-apps/sales-integration-tests` | `^5.0.0` | package is `private: true` and now `6.0.0`; the range no longer matched the workspace copy, so pnpm fell back to the registry — where a private package does not exist (`is not in the npm registry`) |
  | `@mj-biz-apps/sales-server`            | `^5.0.0` | resolved to the **published 5.2.0** copy instead of the workspace one, pulling a second, stale MJ tree at `6.1.0-edge.3` alongside the current one                                                    |

  Both are now `workspace:*`, which cannot drift as versions move.

  The second is the one worth noting: two copies of `@memberjunction/core` in one tree is exactly what
  splits the ClassFactory registry. After the fix a clean install resolves **one** MJ core, at edge.5,
  with zero `edge.3` packages anywhere.

  Every `@memberjunction/*` dependency now uses `^6.1.0-edge.5` — caret, never exact — matching the
  convention bizapps-orders adopted for the same reason.

  Verified: `--frozen-lockfile` exits 0, build 6/6, and all seven gates pass (unit, vocabulary, money,
  distribution, spec, discount, validation).

## 6.0.0

### Major Changes

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

- da0f69f: Foundation for the Deal→Order redesign: `Deal.OrderID` with a real FK to orders'
  `OrderHeader`, and the embedded-record declaration on `DealEntity`.

  Sales now depends on `@mj-biz-apps/orders-entities`. That is sanctioned — Amith
  ruled sales has a hard dependency on orders — but orders' packages are
  unpublished, so **sales is workspace-only until they are published**.

  DealLine is untouched by this changeset; retiring it is the next step.

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

- a2abcfd: The by-rep reports have something to return, and a slippage report that could never have run is fixed.

  Every `DealTeamMember` row sat on an OPEN deal, while both by-rep reports key on `ActualCloseDate` joined
  through that table. So `Sales: Bookings by Owner` and `Sales: Deal Involvement by Rep` returned **zero
  rows** on seeded data — the two reports §9.4 exists to distinguish, both silent, and a query that runs
  clean and returns nothing is indistinguishable from one that is broken.

  The two closed deals now carry real teams. Measured on the database: bookings-by-owner credits the won
  deal's 27,480 to the AE **once**, while the weighted report splits the same deal 16,488 / 6,870 / 4,122 —
  adding back to 27,480 exactly. The same three rows each carry `WonAmountOfDealsTouched = 27,480`, so summing
  that column gives 82,440 for a 27,480 deal: §9.4's triple-count, visible on screen.

  **`Sales: Slipped Deals` could never have returned a row.** It joined `d.ID = s.RecordID`, and
  `RecordChange.RecordID` is a composite-key string (`ID|<guid>`) — SQL Server converts toward
  `uniqueidentifier` and the statement dies. It looked healthy only because nothing qualified. Seeding a real
  date move exposed it on the first try.
