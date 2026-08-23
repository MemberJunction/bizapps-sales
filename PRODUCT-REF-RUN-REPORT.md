# Deal-line product reference — run report

**Branch:** `feature/deal-line-product-ref`, cut from `s0-s1-bootstrap-and-baseline-schema`. Three
commits, all local, authored as Josue with no co-author trailer. **Never pushed** — no upstream, verified.

**First thing to look at:** the readiness chip in the deal workspace, in a browser. It is the one piece
of this PR that is build-verified but not *visually* verified (D-PR10) — nine lines of template reusing
the existing `dw-context__chip` pattern. Everything else is covered by tests. Second: **D-PR8** — the
`ProductID` column has no FK and nothing validates that an ID names a real product, which is correct
here but is the reviewer's cue that the resolver still owns that job.

---

## Status against the brief

| # | Item | State |
|---|---|---|
| 1 | Carry `DealLine.ProductID` end-to-end | **done — it already flowed; now verified** (PR1–PR3) |
| 2 | Order-readiness surface via the existing validation mechanism | **done, verified** (PR4–PR7) |
| 3 | Tests: round-trip + warning fires/clears | **done — PR1–PR7, 7/7; suite 19/19** |
| — | Schema change | **none.** No `migrations/`, no `.sql`, nothing generated. |
| — | Picker / resolver / local catalog | **not built**, by design |

**Definition of done — all met:**

- `ProductID` round-trips through save — PR1, and PR3 proves resolving an *existing* line persists too
- readiness warning fires and clears — PR4, PR5
- `npm run verify` **green**: vocabulary gate clean (10 server files scanned) + **build 8/8**
- `RUN_MUTATION_TESTS=1 npm run test:integration` — **19/19 passed, 0 failed, 0 skipped**
- three local commits on `feature/deal-line-product-ref`, **nothing pushed**
- **no schema change, no automation drift committed** (both verified against the commit range)

---

## What was built

**Scope item 1 turned out to be a verification job, not a plumbing job.** `ProductID` was already present
on `SalesDealLineInput`, on the `DealDraftLine` shape, in `ToSaveInput()` and in `SaveDealOperation`'s
`LINE_FIELDS`. The brief anticipated this ("if it already flows, confirm with a test and move on"), so it
is now pinned by PR1–PR3 rather than assumed. PR1 deliberately uses two *different* product IDs so a
cross-assignment bug would fail the check instead of passing on a one-line happy path.

**Order readiness is derived, never stored.** `DealDraft` gained three members —
`LinesMissingCatalogProduct()`, `IsOrderReady`, `OrderReadinessMessage()` — all computed from
`ProductID IS NULL`. There is no readiness column and there must not be one: a stored flag is a second
copy of an answer the lines already give, free to disagree with them.

`Validate()` raises **one aggregate warning**, not one per line (D-PR3), because the reader's question is
"can this deal become an order" and a count answers it better than N copies of a sentence.

**It is a warning, and PR6 exists to keep it that way.** PR6 asserts the draft stays `IsValid` while the
warning is present, so readiness cannot become a save gate by accident later. An early-stage deal
legitimately has no resolved products — the rep is transcribing an order form, and the catalog reference
belongs at the hand-off, not at entry.

**The workspace needed almost nothing, which is the good outcome.** The existing shared issue list already
renders warnings with their own icon and class, so the pane-level surface came for **free — zero Angular
changes**. The only addition is one conditional chip in the context band (9 lines of template, a getter,
and a CSS variant reusing `--mj-status-warning`), following the existing `--new` / "Unsaved" pattern. It
shows only when something is missing. Marcelo's layout is otherwise untouched.

**Not built, deliberately:** no picker, no resolver, no local catalog. Each commits the team to a
resolution approach (A/B/C in the design note) and to orders' catalog contract before those are chosen.
The plug point is just the column.

---

## Verified vs not

**Verified:**

- `ProductID` round-trips on create (PR1), persists NULL when unset (PR2), and persists when a
  **pre-existing** line is resolved in a later save (PR3) — against a live `MJ_BizAppsSales`, rolled back
- readiness fires, clears, counts only unresolved lines, pluralizes correctly, and never blocks a save
  (PR4–PR7)
- the mutation split works both ways: **7 of 7** with `RUN_MUTATION_TESTS=1`, **4 of 7 with 3 reported as
  skipped** without it — skipped and counted, not silently dropped
- vocabulary gate clean; full build 8/8; no `any` introduced
- no FK on `DealLine.ProductID`, and `DealLineType` has only One-Time / Recurring — both checked against
  the live DB, and both fed real decisions (D-PR4, D-PR8)

**Not verified:**

- **The chip's appearance in a browser** (D-PR10). It compiles and its logic is tested, but no Explorer
  session was run — that needs MJAPI + Explorer up and a Playwright login, outside this run's scope.
  "Compiles" is not "looks right".
- That any `ProductID` names a **real product**. Nothing checks this, by design (D-PR8) — it is the
  resolver's job.

**No CodeGen was run**, so nothing was regenerated and there was no new drift to exclude.

---

## Decisions queued (full text in `PRODUCT-REF-DECISIONS.md`)

| | Decision |
|---|---|
| D-PR1 | No plumbing needed — scope item 1 became tests (PR1–PR3) |
| D-PR2 | Readiness derived on the **draft**, not in the component; no stored flag, no schema change |
| D-PR3 | **One aggregate warning**, not one per line — so it does not mark individual rows |
| D-PR4 | **Every** line counts; no flag distinguishes "product" lines, and a future exclusion must use a flag, never a name |
| D-PR5 | A deal with **no lines** reports order-ready — narrow question, asserted deliberately (PR7) |
| D-PR6 | The message lives on the draft, so chip tooltip and pane text **cannot drift** |
| D-PR7 | The deal-level chip was in-pattern, so it was included |
| D-PR8 | **`ProductID` has no FK and should not get one** — the catalog is orders'; nothing validates the ID |
| D-PR9 | PR4–PR7 are `RequiresMutation: false`, honestly — they are pure logic |
| D-PR10 | The chip is **build-verified, not visually verified** |

D-PR3 (no per-row highlight), D-PR5 (empty deal = ready) and D-PR10 (eyeball the chip) are the three
worth a reviewer's opinion.

---

## The branch, and the working tree

```
65b9ec9  chore(sales): changeset for the deal-line product reference
fc57e75  test(sales): product-ref PR1-PR7 for ProductID and order readiness
fbfdbd6  feat(sales): carry DealLine.ProductID and surface order readiness
```

Eight files, all hand-authored:

```
.changeset/deal-line-product-ref-and-order-readiness.md
packages/Entities/src/deal-draft.ts
packages/Angular/src/lib/workspace/deal-workspace.component.{ts,html,css}
packages/IntegrationTests/src/checks/product-ref.checks.ts
packages/IntegrationTests/src/index.ts
test-harnesses/integration.mjs
```

**`git status` looks messy, and none of it is mine.** The working tree still carries the #31
`AutomationRule*` generated artifacts and line-ending-only churn in eleven `metadata/*.json` files, left
over from the previous run (D-CF9 in `CLOSE-FLOW-DECISIONS.md`). I did not run CodeGen and did not
`git add .`; every commit above was staged file by file, and the commit range was checked afterwards to
confirm **zero** generated or automation files landed. Those leftovers clear themselves the next time the
database is rebuilt from the baseline.

The close-flow work is **not** on this branch — as instructed, this was cut from
`s0-s1-bootstrap-and-baseline-schema`, so it is a clean companion PR rather than a stack on
`feature/close-flow`.

## Untracked, not committed

`PRODUCT-REF-RUN-REPORT.md`, `PRODUCT-REF-DECISIONS.md`, and the previous run's
`CLOSE-FLOW-*.md` / `plans/`.

## Suggested next steps

1. **Eyeball the chip** in the workspace (D-PR10).
2. Take the design note's open question 1 to the team — **A / B / C** (sales leans C). The column is now
   ready for whichever wins.
3. Ask the orders team how the catalog identifies a product (ID / SKU / name-match) — that shapes the
   resolver.
4. Decide D-PR3 and D-PR5: per-row highlighting, and whether "no lines" should count as not-ready.
