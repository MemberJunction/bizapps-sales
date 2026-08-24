# Explorer spec status — measured 2026-08-24

**Two full runs against `MJ_V6_Host`, HEAD `33dd263` merged into `test/explorer-status`.** Run 1 at
15.1m, run 2 at 13.9m. Both: **6 passed, 20 failed, 3 skipped.** The verdict below is run 2; run 1 was
identical test-for-test and cause-for-cause, which is itself the useful part — this is a stable picture,
not a flaky one.

Measured before fixing. The only change between the two runs was clearing one orphaned Explorer tab, and
it moved nothing, which is recorded below rather than quietly dropped.

## Getting a run at all

Two traps, both now known:

1. **The preflight defaults to MJAPI 4141 and this stack serves 4143.** Needs
   `MJAPI_PORT=4143 MJAPI_URL=http://localhost:4143` or it fails before the browser opens.
2. **An expired session makes re-auth impossible, silently.** `playwright.config.ts:94` sets
   `headless: HAVE_SESSION`, and `HAVE_SESSION` tests whether the file EXISTS, not whether it works. With
   a stale `user.json` on disk, `auth-setup` runs headless, lands on the account picker, and waits five
   minutes for a human who is never shown a window. `PW_FORCE_LOGIN=1` is the documented way out and it
   works — the file's own docblock warns about this, and it still cost two runs to hit.

The session captured 2026-08-21 16:54 had tokens expiring 21:54 and 22:14 the same day. A human logging
into `localhost:4341` in their own browser does **not** refresh it: Playwright uses an isolated context,
and `.auth/user.json` is only written by `auth.setup.ts` completing.

## The verdict

| Spec | Result | Cause | Product or spec? |
|---|---|---|---|
| `00-recon` | **PASS** | — | — |
| `01-probe-form-dom` | skip | probe, skipped by design | — |
| `02-probe-delete-affordance` | skip | probe | — |
| `03-probe-column-panel` | skip | probe | — |
| `10-deal-crud` | FAIL | `entity "Pipelines" must be listed in the app` | **product** — entity browser renders no grid |
| `20-demo-tour` | FAIL | `"Deals" must be listed in the app` | **product** — same |
| `30-demo-setup-columns` | FAIL | `"Deals" must be listed` | **product** — same |
| `40-deal-workspace` | FAIL | `locator.click` timeout on `.dw-addbtn` | **spec** — clicks Add line while it is disabled |
| `41-deal-roundtrip` | FAIL | `locator.click` timeout | **spec** — same shape |
| `50-sales-shell` | **PASS** | — | — |
| `60-close-deal` ×4 | FAIL | `locator.click` timeout | **spec** — all four, same shape |
| `70-activity-timeline` t1 | FAIL | `toHaveCount` on `.dat__error` | needs triage — see below |
| `70-activity-timeline` t2 | **PASS** | — | — |
| `70-lifecycle` | FAIL | console error asserted clean | **environment** — the orphaned tab |
| `71-lost-and-reopen` | FAIL | `the host must be back to its seven seeded deals` | **cascade** — earlier spec left rows |
| `72-inline-create` | FAIL | `the created account must be SELECTED, not merely offered` | **product** — plausible real defect |
| `73-lock-across-tabs` | FAIL | console error asserted clean | **environment** |
| `75-dashboard` | FAIL | console error asserted clean | **environment** |
| `78-line-removal-tripwire` | FAIL | `back to its seven seeded deals` | **cascade** |
| `79-embedded-order-refresh` | FAIL | console error asserted clean | **environment** |
| `80-board-drag` t1 | FAIL | `no console errors during a drag` | **environment** |
| `80-board-drag` t2 | **PASS** | — | — |
| `90-workspace-tab-state` t1 | FAIL | `locator.isEnabled` timeout | **spec** — mine, same Add-line shape |
| `90-workspace-tab-state` t2 | **PASS** | — | — |
| `90-workspace-tab-state` t3 | FAIL | `locator.isEnabled` timeout | **spec** — mine |

**So: 20 failures, four causes.**

### Cause 1 — the entity browser renders no grid (3 failures, and the 3 skips depend on it)

`10`, `20`, `30` all fail on the same assertion. The auth capture's own recon says it independently:
*"none of the probed entity-browser routes rendered a grid — see recon.json."* The three probe specs skip
because that route is their subject.

This is the largest single block and it is **product-side**: three specs assert the demo's own screens and
none of them can reach a grid. It is also the highest-value thing to chase next, because `20-demo-tour` is
literally "every screen the demo shows".

### Cause 2 — specs click `Add line` while it is disabled (8 failures)

`40`, `41`, `60`×4, `90`×2. The locator resolves and reports:

```
<button disabled class="dw-addbtn" title="Save the deal first — its order is created on the
 first save, and a product line needs it.">
```

That title is the product working as designed: `CanAddLine` is `!!this.Deal?.IsSaved`, and the order is
provisioned on first save (S-US4). The specs click before saving, or their save did not land. **Spec-side
on the evidence available** — but worth one caveat: eight failures with one shape can equally be one
product regression in the save path, and distinguishing those needs a single deal saved by hand through
the UI. I did not do that, so this is the one verdict in the table I would not defend hard.

Two of the eight are mine (`90` t1 and t3), which is the cost of having written that spec unrun.

### Cause 3 — one orphaned Explorer tab, five specs (5 failures)

Every page load emitted:

```
Error in BaseEntity.Load(MJ_BizApps_Sales: Pipelines, Key: ID=14FDE6FC-E12F-4212-93D8-FF66BD4A83BB)
```

That pipeline does not exist — the two seeded ones are `90111111-…-0001/0002`. It is a pipeline a previous
harness run created and deleted, still named by a restored tab in `__mj.Workspace.Configuration`. Five
specs assert a clean console and all five failed on it, none for a reason of its own.

**I fixed the sweep and it did not fix the runs, which is the honest result.** `lib/cleanup.mjs` now clears
workspace tabs naming rows it is about to delete, and the one existing orphan was repaired by ID. Console
occurrences dropped 14 → 2. **The tally did not move at all**, and the reference was back in
`__mj.Workspace` after the run.

So the loop is not closed. What is now known: `__mj.UserRecordLog` also holds that ID, and Explorer
appears to restore a recent-record tab from there and persist it back into `Workspace.Configuration`.
Clearing `Workspace` alone is therefore treating the symptom. **The next step is to confirm the
`UserRecordLog` → `Workspace` restore path and clear both** — and that is in MJ core's tables, so it wants
care rather than a quick delete.

### Cause 4 — cascade (2 failures)

`71` and `78` assert the host is back to seven seeded deals. They fail because earlier specs failed part
way and left rows. Nothing wrong with either spec; they are downstream of the other three causes and
should be re-judged only after those clear.

### Still needing triage (1)

`70-activity-timeline` t1 expects `.dat__error` to have count 1 and gets 0 — a refusal that did not
surface. Its sibling t2 passes. Could be product or spec; not determined.

## SETTLED 2026-08-24 — causes 2 and 3, both by observation

### Cause 2: the specs are stale. The product is fine.

Driven by hand through the UI (`probe-cause2.mjs`, a probe and not a spec — it asserts nothing and
lives outside `specs/`):

```
panes (badge = blocking issues): Party info 5 | Product lines | ...
blocking issues (7 rendered): Name cannot be null · Pipeline ID cannot be null ·
                              Company ID cannot be null · A deal needs a name. ·
                              Choose a pipeline. It determines the stages and the selling company. ·
                              No customer chosen yet
filled name + 8 selects  ->  panes: Party info (badge gone)
Save enabled: true
after save: "Deal created."
after save: Add line present, ENABLED, title "Add a product line"
```

`CanAddLine` is `!!Deal?.IsSaved` and it behaves exactly as written: disabled with "Save the deal
first" before, enabled with "Add a product line" after. **The save path is healthy.** The eight
failures are spec-side — they reach for `Add line` before a save has landed.

The likely reason they ever passed: a new deal now raises **five** blocking issues, and a spec that
fills fewer than the form demands never enables Save, so it never gets past the disabled button. Each
of the eight needs a complete Party-info fill and a confirmed save before it adds a line. That is
mechanical work, not a redesign.

Two probe bugs of my own are recorded in the file because they mislead in exactly the same way a
stale spec does: switching panes before filling made `fill` time out on a control that had gone
invisible, and reading "is this select already answered?" from `inputValue()` skipped every control on
the form, because Angular renders `[ngValue]="null"` as the literal string `"0: null"`, which is
truthy.

### Cause 3: not the entity browser, and not the Favorites toggle. The same orphaned record.

Ruled the harness out first, as instructed, and it is neither of the two candidates:

- **Favorites toggle:** the precondition holds — the user has zero favourites and so does every user
  on this host — but no toggle renders at all. `All Entities`, `My Favorites`, `Favorites` and
  `Entities` each return `count=0`.
- **Collapsed nav panel:** all four `DataExplorer.State` rows carry `navigationPanelCollapsed: true`,
  which produces the same symptom by a different key. Also not it.

What actually happens is that `/app/mjbizappssales` **redirects to a record route**:

```
url: .../app/mjbizappssales/record/MJ_BizApps_Sales:%20Pipelines/ID|14FDE6FC-E12F-4212-93D8-FF66BD4A83BB
screen: "Could not load MJ_BizApps_Sales: Pipelines record.
         InnerLoad returned false for key ID=14FDE6FC-..."
```

The app restores the last-open record, that record is the **same deleted pipeline** as the console-error
thread, and it therefore never reaches the entity list — so "Deals" is never listed. `Pipelines` does
render (count=1), because it is in the breadcrumb of the dead record page.

**So three of my four causes are one cause.** The orphaned reference accounts for the 3 "must be listed"
failures, the 3 probe skips that depend on that route, and the 5 console-error failures: **8 failures and
3 skips from one dead pipeline ID.** Nothing product-side has been filed, and nothing should be.

It also explains why clearing `__mj.Workspace` moved nothing: the restore is not driven from there.
`__mj.UserRecordLog` still holds the ID, and clearing all three homes — `UserRecordLog`, `Workspace` and
the `UserSetting` rows that name it — is the experiment that should close it. **I could not run it: the
`DELETE` against MJ core tables was refused by the sandbox, and I did not work around it.** It needs
either an approval or another session's hand.

## Baseline

| | Before | After two runs |
|---|---|---|
| deals | 7 | **7** |
| open pipeline | 251,220 | **251,220** |
| stage events | 5 | **5** |
| orders / lines | 57 / 63 | **57 / 63** |
| tasks | 0 | **4** |
| contracts | 0 | **2** |
| activities | 0 | 0 |

**The demo set is intact** — deals, amounts, stage events and orders all unchanged, and no harness-prefixed
row survived.

**But tasks and contracts are not swept.** Two runs left 4 tasks and 2 contracts: two apiece, from the
close-won a spec drives. `lib/cleanup.mjs` deletes deals, pipelines and orders by prefix and does not touch
tasks, contracts or activities — so those grow by two per run forever. That is a real gap in the sweep and
it is the tasks/contracts half of "the demo set has been eaten twice". Not fixed here: the rows carry no
prefix of their own, so they have to be found through the deal that raised them, which is exactly the link
the sweep has already deleted by that point. Same shape as the workspace-tab problem, and it wants the
same treatment — capture before deleting.

## What was fixed this round

- `60-close-deal:96` located the product picker by `hasText: /not linked/i`; the placeholder is now
  `— choose a product —`. Switched to `.dw-cell-product`. A locator that matches nothing fails at the next
  action rather than saying it went stale, so the spec would have reported a broken picker.
- `80-board-drag`'s header still declared "WRITTEN BUT NEVER RUN" after three measured passes. Corrected.
- Three specs never typechecked: `90:386` called `expectNoConsoleErrors` **without importing it** — a
  `ReferenceError` that would have killed its own test — plus arity bugs in `41:310` and `79:135`. All 21
  typecheck clean now. **The harness has no compile gate; it should have one.**
- `lib/cleanup.mjs` clears workspace tabs pointing at rows it deletes. Prospective only, and it did not
  move the tally.

## What was not done

The two follow-ons did not fit: two 15-minute runs, an interactive re-auth and this triage consumed the
round. Neither was started, so neither is half-finished.

- **The `ProductLabel()` provocation.** Still owed. The design stands: a scratch deal with a line pointing
  at a withdrawn product, dropped whole, because KI-20 means the line cannot be removed.
- **The DN-17 client-path test.** Still owed, and it is the more valuable of the two — the guard has no
  coverage and no server-side mutant can give it any, because the server path reaches it with the peer
  already exposed. It needs a plain `BaseEntity.Save()` from the browser, which is what this harness is
  for. Note it will land in the same neighbourhood as Cause 2: a client-path save test and eight failures
  about a save-gated button are close enough that the Cause 2 caveat should be settled first.
