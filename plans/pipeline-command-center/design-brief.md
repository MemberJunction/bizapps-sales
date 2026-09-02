# Design brief — Sales pipeline dashboard + Contracts obligation dashboard

**Status:** exploration. Mockups first so we can lock a direction; not a build spec yet.

## What is wrong today (architecture)

Orders (and accounting CoA) treat Explorer as the record host:

- Rail pages are **jobs**: dashboard, list, fulfillment, queues.
- A row click is `NavigationService.OpenEntityRecord(...)` / `OpenNewEntityRecord(...)`.
- Explorer owns the record tab. The Open App never hosts a second document strip.
- The orders dashboard may switch *views* with `mj-tab-nav`. That is not a nested record host.

Sales **does not**. `sales-nav.model.ts` puts a **Workspace** on the Deals rail. `sales-section.component.html` opens every roster/dashboard row into `mjs-deal-workspace` (`OpenDeal`), which keeps its own open-documents strip **and** inner pane tabs. Account clicks correctly use `OpenEntityRecord`. The generated deal form (`DealFormComponentExtended` — close-lock + stale-amount) is bypassed for the primary job.

That is the antipattern: an app-inside-an-app for records. Nested tabs (Explorer tab → workspace strip → deal panes) and a dashboard that cannot use `mj-explorer-entity-data-grid` because row activation would open a record tab instead of the workspace.

**Contracts did not repeat it.** Rails are dashboard / all contracts / renewals / awaiting / modifications. Lists use `mj-explorer-entity-data-grid`. FK and row opens go through `NavigationService.OpenEntityRecord`. There is no in-rail contract workspace. Marcelo’s remaining miss is the **dashboard content**: five count pills and a manifesto card (“what this app is, and is not”). Architecturally correct, operationally thin.

## What already exists and the dashboard ignores (sales)

Master-plan §9 queries, already shipped:

| Query | Dashboard should use it for |
|---|---|
| `Sales: Forecast by Category` | Commit / Best Case / Pipeline / Closed Won. Flags are **cumulative** — do not add the three numbers. |
| `Sales: Forecast by Owner` | Coverage bars |
| `Sales: Forecast History` | Waterfall vs the 1st-of-period snapshot |
| `Sales: Stage Conversion and Dwell` | Funnel + stuck-in-stage |
| `Sales: Slippage` | Close dates that moved (`RecordChange`) |
| `Sales: Win Rate` | By count **and** by value |
| `Sales: Dashboard Summary` | Today’s four tiles (keep as a subset) |
| `Sales: Deal Roster` | Inspect grid (`IsPastExpectedClose`) |

Quota / attainment is **v2** (D-3, no `Quota` table). Option A compares commit to **last-period booked**, not a fake quota.

The custom **deal form** stays. After we drop the workspace rail, `OpenEntityRecord` is what surfaces it. Board remains a *view* of deals; Signed is not a drop target (close from the form).

## Personas

| App | Primary | Job on open |
|---|---|---|
| Sales | Account director / VP Sales (Blue Cypress + Harbor House) | Know if this month is real, what is stuck, who to coach, open the deal in Explorer |
| Contracts | Legal/ops who owns paper | Know which agreements need a person this week (notice, missing executed copy, ending), open the contract in Explorer |

## Success

- Zero nested record navigation. Deals and contracts open as Explorer tabs.
- Sales dashboard is **pipeline reporting**, not a “closing soonest” table: stacked forecast, commit vs last period, stage conversion, forecast waterfall, stall/slip/silence, activity from Common.
- Contracts dashboard is **obligation command**, not ARR (plan §1: contracts is not money). Same derived columns the worklists already use, so tiles and lists cannot disagree.
- Board stays a **view** of deals (kanban), not a record host.

## Non-goals

- Rebuilding the deal **form** (custom form panels stay; they become what Explorer opens).
- Putting billing/pricing on the contracts dashboard.
- A `Quota` table (v2).
- Live Graph mailbox (Activity Sync still refuses live fetch until wired).
- A third in-app tab system.

## Constraint

MJ Explorer chrome: app switcher, application nav items as **sections**, left rail **within** a section, `OpenEntityRecord` for records. Tokens `--mj-*`. Light theme default, matching orders mockups.

## Recommendation (not locked)

**Sales A** (pipeline command center) + **Contracts A** (obligation command). Hybrid allowed: keep the board as a rail page, fold C’s analyst later. Drop the Workspace rail in every option.
