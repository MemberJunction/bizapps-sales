# What the Explorer suite actually covers — and what it doesn't

26 spec files under `specs/`, 33 tests. One row per spec below. **Drives** is the gesture. **Asserts**
is what fails the spec, and where it reads: the database (DB) or the screen. **Does NOT assert** is
what a reader might reasonably assume is covered and isn't.

The column that matters is **"Does NOT assert"**. The useful question is not "is it green" but *what
does this cover that a human walk would not, and what does a human walk cover that this can't*.

Run one spec headed and slowed down, from `test-harnesses/playwright`:

```bash
PW_SLOWMO=300 npx playwright test specs/10-deal-crud.spec.ts --project=crud --reporter=list
```

`PW_SLOWMO` pauses between gestures so a person can follow the run; it is not a timing fix and is off by
default, so unattended runs are unchanged.

## Latest measured run

**2026-10-02**, on a clean host, with the harness repairs that merged into `next` on 2026-10-07: 24 of 28
tests passed (`next` without them: 2 of 27). The four failures were `73-lock-across-tabs`
(not diagnosed), `10-deal-crud` (it stops at a different step on each run), one `60-close-deal` test (a
Deal form defect since fixed) and `75-dashboard` (the host was missing a migration).

By 2026-10-06 that result no longer reproduced on the same host. Explorer logged an MJ class-registration
error, `PromptCategory class does not have a Prompts property`, on every page load, and the eleven specs
that assert a clean console failed on it while their other assertions passed.

The suite is not in CI. CI typechecks the specs (`test:spec-gate`) and checks that every selector they
name is in mounted markup (`test:selector-gate`); it runs none of them.

---

## Per spec

| Spec | Drives | Asserts | Does NOT assert |
|---|---|---|---|
| `00-recon` | Opens Explorer with the saved session and walks shell → generated app → entity → form, printing what it finds | Screen: the saved session lands inside the app shell | Anything it prints; it is the map for re-deriving selectors |
| `01-probe-form-dom` | Skipped unless `PW_PROBE=1`. Prints the generated form's DOM around known field labels | Nothing | — |
| `02-probe-delete-affordance` | Skipped unless `PW_PROBE=1`. Lists every candidate delete control with its geometry and visibility | Nothing | — |
| `03-probe-column-panel` | Skipped unless `PW_PROBE=1`. Dumps the grid's view-settings (column) panel | Nothing | — |
| `04-landing-state-tripwire` | Writes a leftover entity selection into `DataExplorer.State`, as an earlier spec would, then enters the generated app the normal way | Screen: the entity list renders, and opening Deals lands on Deals | What the setting holds afterwards — the app writes it back itself |
| `10-deal-crud` | In the generated entity browser: creates a Pipeline, then a Deal; reloads the Deal, edits it, finds it in the grid, and deletes the Deal and the Pipeline from the record toolbar | Screen: `Pipeline.Company`, `Deal.Pipeline` and `Deal.Company` render required before save; FK names, not GUIDs, after a reload; values survive the reload and the edit; the provenance labels and three related sections render; no grid row remains after each delete | Provenance values (labels only); what the related sections hold; what a delete does to the deal's children. The edit checks are substring matches on the whole page |
| `20-demo-tour` | Tours eight generated grids, opens a seeded lined deal's "What's being sold" panel and one line in the line editor, then tries to open a Deal record | Screen: each grid is listed, titled, has rows and shows its seeded names; the editor shows unit price and line total as display values, not inputs; a clean console | Any column value or figure. Opening the record is reported, not asserted |
| `30-demo-setup-columns` | Adds the demo columns to six generated grids through Configure View, and saves | Screen: each added column shows in its grid after saving | Column order or content. It changes the signed-in user's saved grid views; re-running it skips columns already shown |
| `40-deal-form` | New deal → Name, Pipeline, Account, open status → save; deal type, term, execution date, contract variances and annual increase override across four panels → save; two catalogue lines through the line editor; reopen by route; read back in the generated Deals grid | DB: every typed header value reached its column; both lines are on the deal's order, for different products, each with a non-zero `UnitPrice`. Screen: the six working panels open; the editor's unit price and line total are non-zero, and differ on a multi-quantity line; Pipeline and Account show names after a reopen; both lines read back | Any specific price — this repo does not know one, by design. Payment schedule rows, which are MJ's generic grid |
| `41-deal-roundtrip` | Composes a deal with header dates and two lines, reopens by route, removes one saved line through the line editor, reopens again | DB and screen: both lines come back with product and quantity; `ExecutionDate` and `ExpectedCloseDate` come back bound, not blank; after the removal only the kept line remains, on the order and on screen | Instalment and owner round trips (dropped with the workspace) |
| `42-hero-short-window` | Saves a new deal in a 1100 × 617 window, then enters edit mode | Screen: the header card's rendered height covers its content, after the save and in edit mode | Any other panel at that size |
| `50-sales-shell` | Opens `/app/sales`, the dashboard and All deals; double-clicks a row; returns; opens New deal without saving | Screen: the section mounts inside MJ's page chrome; the rail offers Dashboard, All deals and Board, and no Workspace; the header offers New deal; four KPI tiles render; a row opens the Deal form; exactly one Deal form is visible after New deal; a clean console | Any dashboard figure (`75` owns those). It saves nothing |
| `60-close-deal` | Builds a B2B deal with a line, then: closes it Won; checks frozen fields; tries Lost without and then with a reason; closes Won and reopens with a reason | DB: a won close locks the deal and appends a stage event with a non-zero amount, an in-range probability and a destination stage; a lost close cannot be confirmed without a reason and closes with one; a reopen unlocks and adds an event without removing the close event. Screen: the Locked chip; Name and Pipeline read-only in edit mode; the close message is not an error | The order — it is created at first save (D-OS1), and `71` covers it on the lost path. The reopen reason's text |
| `70-activity-timeline` | Logs an activity from an open deal's Activity panel; forces an unparseable date; logs on a closed deal | DB: one `Activity`, with `LoggedByUserID` set, `Manual`, `Logged`, its type resolved by code, linked to the deal (`Regarding`) and to the account and primary contact under common's entities; a refused log leaves no activity without links; on a closed deal the timeline renders, Log activity is enabled and the activity lands with links. Screen: the new row is listed | Whether the forced refusal actually happened — it asserts the invariant either way |
| `70-lifecycle` | Creates a deal, adds two lines, moves it into a stage that declares `Quoted`, closes it Won | DB: the order exists in `Draft`, with the pipeline's company and the account as bill-to; lines carry an engine `UnitPrice` and the product's company; the stage move sets the order `Quoted`; the won close leaves the order unchanged, raises finance tasks linked to the order, and stamps a contract numbered by contracts, with provenance back to the deal and no dates | Who the tasks are assigned to; the contract's commercial terms |
| `71-lost-and-reopen` | Moves a deal into a stage that declares an order status, closes it Lost with a reason, reopens it | DB: the deal is lost with its loss reason and its order is `Voided`; the reopen succeeds; the log holds both events; the order returns to the status the restored stage declares where orders allows it, or the reopen warns why it could not | A loss reason that requires notes |
| `72-inline-create` | On a new deal, creates an account twice from the Account field's Create option, then saves the deal | DB: each create makes one Organization and its SalesAccount on the same ID; the saved deal holds the account created last. Screen: the Account field shows the new name, never blank | Creating a contact. The option list (a type-ahead has none) |
| `73-lock-across-tabs` | Opens a closed deal and an open deal by record route, then switches between their Explorer tabs | Screen: the closed deal shows the Locked chip and a read-only Name in edit mode; the open one shows no chip and stays editable; both still hold after switching back | Anything server-side (`close-deal.CD5` covers the refusal). Its header records it failing under the throwaway workspace, which restores no second tab |
| `74-stage-belongs-to-pipeline` | Saves a B2B deal without an account, picks a stage, switches the pipeline to D2C, saves | DB and screen: the Stage control offers exactly B2B's active stages, then exactly D2C's; the picked stage is stored; after the switch the stage is cleared on screen and in the database | Stage order or labels — it compares sets of IDs |
| `75-dashboard` | Opens Dashboard, reads the tiles, switches the period to All time | DB against screen: Open pipeline, Open deals and Past expected close equal SQL over the `IsOpen` / `IsWon` flags; Won equals the wins inside the window its footnote names, and every win under All time; the open tiles do not move with the period; Inspect is `mj-entity-viewer`; a clean console | The cards below the tiles and the Inspect rows. Its test title still names a closing-soon order and priced/stated markers; neither is asserted |
| `76-team-roster-owner-stamp` | Inserts a deal and its Owner / AE row directly, as an importer would, and saves that row from its own record page; then does the same with the deal page already open | DB: saving the team row stamps `Deal.OwnerEmployeeID` from the roster. Screen: the open page's Overview stops saying "No owner assigned" once its Internal team grid loads | That deactivating the owner row clears the owner — it does not. Adding a member through the grid. A save from the stale page (`save-deal.SD26` covers it) |
| `78-line-removal-tripwire` | Composes a deal with two lines and removes one through the line editor | DB: the removed line is off the order, the other survives, and it is renumbered to 1. Screen: the editor's error area stays empty | — |
| `79-embedded-order-refresh` | Creates a deal and adds its first line without reloading | DB: the line is on the order the deal points at; exactly one new order exists; no order is left unreferenced; a clean console | The line's price (`40` covers it) |
| `80-board-drag` | Creates a deal, drags its card to another non-closing stage, then tries to drop a card on a closing column | DB: the stage changed; exactly one stage event, carrying the probability and amount the deal held before the move, with the earlier events untouched; the order takes the new stage's declared status; nothing lands in, or records a move into, a closing stage. Screen: the closing column's lock title points at the deal form; a clean console | Column totals and the priced/stated card markers |
| `80-cross-company-products` | Composes a deal, then adds a line for an active product owned by another company | Screen: the picker offers it and the line can be saved. DB: the line keeps the product and books to the product's company, not the deal's | The line's price |
| `82-term-start` | Adds a subscription line and a one-time line in the line editor, sets and then empties the term start, and cancels | Screen: a one-time line has no term-start control; a subscription line shows the order date and says it is inherited; a typed date holds and the hint goes; emptying returns to the order date. Skips when the catalogue has no subscription product — the seed makes one only when orders' subscription types are pushed | Persistence — nothing is saved; `term-start.TS6` owns it |

---

## What the suite covers that a human walk would not

- **Silent no-ops.** Most specs that write read the database afterwards. A screen that says "saved"
  while nothing was written fails them; a person sees the message and moves on.
- **Append-only provenance.** `80-board-drag` compares the stage-event list before and after a drag,
  and `60` and `71` check that a reopen adds an event and keeps the close.
- **A gesture that must not work.** `80-board-drag` proves a drag cannot close a deal. Absence of an
  effect is invisible to a walkthrough.
- **Flags, not names.** `75` computes every tile from `IsOpen` / `IsWon`, and the close specs choose
  statuses by flag.
- **Leftovers.** `AssertBaseline` fails a run that changed the seeded deals.

## What a human walk covers that the suite cannot

- **Whether a figure is right.** Specs check that prices are non-zero and that tiles match SQL; none
  knows what a price should be.
- **Whether the screens tell a coherent story in sequence.** Each spec starts fresh.
- **Whether anything looks wrong.** Overlapping controls, alignment, currency rendering, dark mode.
  `42` is the only layout check.
- **Whether the language reads.** A spec can only check that a string is present.
