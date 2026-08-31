# Design plan — Sales pipeline command center

**Locked direction:** Option A (pipeline command center).
**Locked mockup:** `plans/pipeline-command-center/mockups/option-a-command-center.html`

## Navigation

- Remove **Workspace** from the Deals rail.
- Dashboard, list, and board row/card clicks: `NavigationService.OpenEntityRecord('MJ_BizApps_Sales: Deals', …)`.
- New deal: `OpenNewEntityRecord`.
- Account clicks stay `OpenEntityRecord` on Sales Accounts.
- The deal **form** (close-lock + stale-amount) is what Explorer opens. Workspace files remain in the tree for a later fold into form panels; they are not mounted.

## Dashboard

Reuse shipped MJ Queries (`Sales: Dashboard Summary`, `Forecast by Category`, `Pipeline Summary`, `Win Rate by Count and Value`, `Forecast by Owner`, `Deal Roster`). No new SQL in this pass.

- Four headline tiles stay (open pipeline / open deals / past expected close / won) so the existing DB-oracle spec still has a home, then the command-center charts: stacked forecast (cumulative flags sliced), stage funnel, attention queues, close-date buckets, owner coverage, win rate, inspect grid.
- Inspect defaults to closing-soonest (same order the spec asserts). Clicks on tiles/queues/buckets filter the grid.
- Filters branch on **flags** (`IsOpen`, `IncludeInCommit`, `IsPastExpectedClose`), never status or category names.

## Build sequence

1. Nav + OpenEntityRecord
2. Roster mapping for forecast flags + weighted
3. Dashboard charts
4. Playwright: `50-sales-shell`, `75-dashboard`; board copy that said “workspace”
5. Build `@mj-biz-apps/sales-ng`
