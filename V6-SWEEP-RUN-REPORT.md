# v6 date sweep + ProductID spec — run report

## Headline

**The sweep found no additional date bugs — the two fixes in `7e55bae` are the complete set.** That is a
verified result, not an assumption: I enumerated all **19 date columns** from the live schema and checked
every string operation, comparison, sort, template binding and date pipe against them.

**Why so few sites broke** is the useful part: Sales funnels every workspace date through **one**
normalizing helper (`toDateInput`, seven call sites), so fixing that boundary fixed every bound input at
once. The roster path bypasses the draft, which is why it needed its own helper and was the second bug.

**No new code changes were required, so there is no new fix commit.** The branch still stands at
`7e55bae`.

---

## The sweep, site by site

### The 19 date columns (from `MJ_V6_Host`, not from memory)

`Deal`: `ActualCloseDate`, `AmountComputedAt`, `ClosedAt`, `ExecutionDate`, `ExpectedCloseDate`,
`NextStepDate`, `StartDate` · `DealLine`: `PricedAt`, `ServicePeriodStart`, `ServicePeriodEnd` ·
`DealPaymentSchedule`: `PaymentDate` · `DealStageEvent`: `ChangedAt` · `DealTeamMember`: `StartDate`,
`EndDate` · `ForecastSnapshot`: `CapturedAt`, `PeriodStart`, `PeriodEnd` · `SalesAccount`:
`FirstClosedWonDate` · `SalesContact`: `LastEngagedAt`.

### Every site that touches one, and its verdict

| Site | What it does | Verdict |
|---|---|---|
| `deal-workspace.service.ts` `toDateInput` | normalizes 7 draft date fields | **FIXED in `7e55bae`** — accepts `string \| Date`, UTC getters |
| ↳ its 7 call sites (`ExecutionDate`, `StartDate`, `ExpectedCloseDate`, `NextStepDate`, `ServicePeriodStart/End`, `PaymentDate`) | feed the draft | **Safe via the boundary** — verified all seven route through it |
| `sales-section.component.ts` `SlippedDeals` | `.slice(0,10)` on a roster date | **FIXED in `7e55bae`** — now `UtcDatePart(string \| Date)` |
| `sales-section.component.html` ×2 | `\| date: 'mediumDate'` on `ExpectedCloseDate` | **Safe** — Angular's date pipe accepts both shapes. *This is why the roster showed the date while the workspace input sat blank* |
| `deal-workspace.component.html` ×4 | `<input type="date">` bound to `Header.ExecutionDate`, `.StartDate`, `.ExpectedCloseDate`, `row.PaymentDate` | **Safe** — all bind draft fields fed by the fixed helper. Re-verified live: the payment-schedule pane renders 3 rows |
| `deal-draft.ts:364` | `ServicePeriodEnd < ServicePeriodStart` | **Safe by contract** — lexicographic on `yyyy-MM-dd` is chronological. See D-SW2 for the caveat |
| `deal-draft.ts` type declarations | 7 date fields as `string \| null` | **Correct** — true *because* the boundary normalizes; deliberately not widened (D-SW2) |
| Row interfaces in `deal-workspace.service.ts` | `DealRow`, `DealLineRow`, `ScheduleRow`, `DealRosterRow` | **WIDENED in `7e55bae`** to `string \| Date \| null` so the types describe what actually arrives |
| `CoreEntitiesServer`, `Actions`, `Entities` (server paths) | — | **No date-field references at all** on this branch |
| `ForecastSnapshot`, `DealStageEvent`, `DealTeamMember`, `SalesAccount`, `SalesContact` dates | — | **No UI or code consumers yet** — columns exist, nothing reads them. Nothing to fix, and worth knowing they are unguarded when a surface is eventually built |

### The failure shapes I grepped for

`.slice` / `.substring` / `.split` / `.replace` / `.length` / `.localeCompare` / `.padStart` on a date
value; `<input type="date">` bindings; date pipes; `<` / `>` comparisons; `sort()` on dates;
`new Date(field)`. **The only surviving hits are inside the two fixed helpers, an array `.slice(0, 8)`
(`ClosingSoon`, not a date), and a `JSON.stringify(...).slice(0, 300)` in a test message.**

Cross-checked against bizapps-accounting `docs/ui-architecture.md` — the `ResultType: 'entity_object'`
vs `'simple'` hazard, which notes orders shipped a version of this for months (an allocator sorting ISO
strings with `localeCompare`). **Sales has no `localeCompare` on dates and no date sorts at all**; its
ordering comes from SQL (`OrderBy: 'ExpectedCloseDate ASC'`), which is immune.

---

## Verification

| Check | Result |
|---|---|
| Vocabulary gate | **clean** — 9 server files scanned |
| Build (`turbo --filter="@mj-biz-apps/sales-*"` from the workspace parent) | **6/6, 0 errors** |
| Integration suite (`RUN_MUTATION_TESTS=1`, against `MJ_V6_Host`) | **12/12 passed, 0 failed, 0 skipped** |
| Playwright against the live v6 host | **re-ran — session was still alive** |

**Playwright did NOT need Josue's login.** The session captured at his login was still valid, so the UI
re-verification ran in full:

- dashboard KPIs: `OPEN PIPELINE $351,000 across 4 open deals · OPEN DEALS 4 of 6`
- roster: **6 rows**
- workspace: **Expected close bound to `2026-09-30`**
- **payment schedule: 3 rows** — the fourth date-bound input, not covered by the earlier check
- console: only a pre-existing unrelated 404

Screenshot: `C:\Users\josue\Downloads\v6-host-verification\07-sweep-verify.png`.

---

## Secondary track — broader v6 runtime pass

**Partially done, and I want to be precise about the limit.** The surfaces exercised live are: the
dashboard (KPIs), the roster (6 rows, all columns), the workspace (Party info, Product lines, Payment
schedule) and deal open-from-roster. Those all render correctly.

**Not exercised: creating a deal, editing and saving through the UI, and the Terms/Variances panes.** The
integration suite covers the save path at the operation level (12/12, including create, numbering,
child re-sequencing and delete-by-omission), so the *server* contract is proven — but a UI save on the v6
host has not been clicked through. Nothing suggests a problem; it is simply untested, and I would rather
say so than imply coverage.

No other v6 shape or API changes surfaced beyond the dates.

---

## Track 3 — the ProductID spec

**`docs/deal-line-product-spec.md`** (untracked, in the main checkout with the other plan docs).

Grounded in orders' real `Product` table on `origin/next`, not assumption. The parts that matter:

- **A product is identified by `ID`.** `SKU` is unique *only when present* (filtered unique index) and
  `Name` is not unique at all — so **no name-matching resolver can be an identity mechanism**, only a
  suggestion a human confirms.
- **A picker must filter by `CompanyID`** (products are per-company — otherwise a rep can select another
  tenant's product), **`Status = 'Active'`**, and the `AvailableFrom`/`AvailableTo` window.
- **`StandaloneSellingPrice` should not be displayed** in v1 — a catalog price beside a transcribed
  amount invites reconciliation, and Sales computes no money.
- **The FK question (§2, and D-SW3):** recommend keeping the soft reference *for the #89 form work*,
  contradicting #93's FK position — because an FK to orders **ends standalone Sales** (`rebuild-db.sh`,
  CI and every dev env would need orders' schema), and that cost lands before the consolidated
  environment justifying it exists. It is reversible in the direction that matters: soft → FK is additive
  later. **Needs a ruling.**
- **An unmet prerequisite:** orders is not a workspace member and its schema is not in `MJ_V6_Host`, so
  the picker cannot query anything end-to-end yet (D-SW4).

Nothing was built and no schema was touched.

---

## Commits

**None added this run** — the sweep required no code changes. The branch stands at:

```
7e55bae  fix(v6): dates arrive as Date, not string — the Sales UI assumed string
b98603f  refactor(sales): retire apps/ — Sales runs inside an MJ host, not its own shell
f90a64e  chore(codegen): regenerate against MJ v6 core
```

Nothing pushed.

---

## Environment

- **v5 untouched**: `MJ_BizAppsSales` never opened; the main checkout is still on
  `feature/deal-line-product-ref` with only its pre-existing drift plus this run's untracked docs. Josue's
  **v5 API is still running on 4141**.
- **v5 Explorer is still stopped** — the host Explorer holds 4341 (as you asked, for the login). Say the
  word and I'll swap them back.
- The Sales worktree's `.env` was pointed at `MJ_V6_Host` for the integration run and **restored** to
  `MJ_BizAppsSales_V6` afterwards.
- `metadata/*.json` show sync-checksum churn from the earlier host push — left unstaged, as before.
- Materialization clone `C:\Dev\MJ\MJ` untouched; `bizapps-common` clean on `main`.
