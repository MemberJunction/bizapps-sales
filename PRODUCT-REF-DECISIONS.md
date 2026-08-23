# Deal-line product reference — decisions queued during the run

Non-blocking calls made while building, each with the reasoning and the least-reversible-cost option
taken. Nothing here needed Josue to be awake; all of it is worth a glance.

---

## D-PR1 — No plumbing was needed; scope item 1 became a test

`ProductID` already flows end-to-end. It is present on `SalesDealLineInput` (the remote-op contract), on
the `DealDraftLine` shape, in `DealDraft.ToSaveInput()`, and in `SaveDealOperation`'s `LINE_FIELDS`.

**Chosen: change nothing, and pin it down with tests instead** (PR1–PR3), exactly as the brief allowed.
Adding code to a path that already works would have been churn, but leaving it *unverified* would have
meant the PR claimed a capability nobody had checked. PR1 also asserts two lines keep *different*
references, so a cross-assignment bug would be caught rather than passing on a single-line happy path.

---

## D-PR2 — Readiness is derived on the draft, not computed in the component

The count could have lived in the workspace component as a `filter().length`.

**Chosen: `DealDraft.LinesMissingCatalogProduct()` / `IsOrderReady` on the draft**, with the component
binding to them. The draft is where the rest of the validation lives, it is testable with no Angular or
database behind it (which is what makes PR4–PR7 cheap and fast), and a resolver added later will want the
same accessor. No stored flag and no schema change — a persisted readiness column would be a second copy
of an answer the lines already contain, free to disagree with them.

---

## D-PR3 — ONE aggregate warning, not one per line

Per-line warnings were the obvious alternative and would have reused `ClientKey` row attribution.

**Chosen: one aggregate issue** with `ClientKey: null`. The reader's question is "can this deal become an
order", and five copies of the same sentence answer it worse than "5 lines need a catalog product" does.
Per-line attribution already exists in the grid — the row's own `ProductID` is empty.

Consequence worth knowing: because the issue has `ClientKey: null`, it does **not** mark individual rows
via `IssuesForRow`. If reviewers want the offending rows highlighted too, that is an additive change.

---

## D-PR4 — Every line counts toward readiness

The brief says "any **product** line". There is no flag distinguishing a product line from a
non-product one: the only two seeded `DealLineType` rows are One-Time and Recurring, and both are things
sold that need a catalog product.

**Chosen: count every line.** The code records where to change this if a future line type ever
represents something that is *not* a catalog item — and that it must be excluded **by a flag on
`DealLineType`, never by a name**, so the vocabulary rule survives the change.

---

## D-PR5 — A deal with NO lines reports order-ready

Readiness asks one narrow question: is any line missing its product reference. An empty deal has no such
line, so it raises nothing.

**Chosen: leave it ready, and assert it** (PR7) so the behaviour is deliberate rather than incidental.
Whether an empty deal should become an order is a *different* question, and answering it through this
signal would make one indicator mean two things. If the team wants "an order needs at least one line",
that belongs as its own check.

---

## D-PR6 — The message lives on the draft, so the chip and the pane cannot drift

First pass duplicated the sentence in the component's tooltip getter. That is a latent bug: two copies of
a user-facing string drift the moment one is reworded, and the drift stays invisible until someone
notices the tooltip disagrees with the list beneath it.

**Chosen: `DealDraft.OrderReadinessMessage()` as the single source**, used by both `Validate()` and the
chip's tooltip.

---

## D-PR7 — The deal-level chip was in-pattern, so it was included

The brief made this conditional on being a small in-pattern addition. It is: the context band already
carries `dw-context__chip` elements, including a conditional `--new` ("Unsaved") variant with warning
tokens.

**Chosen: add one conditional chip**, reusing that pattern and the same `--mj-status-warning` tokens —
an error palette would overstate a deal that is merely early. It renders **only** when something is
missing, because a chip reading "order-ready" on every healthy deal is noise on the majority of screens.
Marcelo's layout is otherwise untouched; the pane-level surface needed **zero** Angular changes, since the
existing shared issue list already renders warnings with their own icon and class.

---

## D-PR8 — `ProductID` has no foreign key, and should not get one

Verified against the live database: `DealLine.ProductID` is an unconstrained nullable `uniqueidentifier`
with no FK.

**Chosen: leave it unconstrained** — this is not a gap to fix. The catalog lives in **orders**, and sales
must never host its own copy, so there is nothing in this database to point a constraint at. It is also
what lets a test use a literal GUID honestly.

The consequence is real and belongs in the review: **nothing validates that a `ProductID` names a real
product.** That check is the resolver's job, and the resolver is precisely what this PR does not build.
Recorded in the bundle header so a future reader does not mistake it for an oversight.

---

## D-PR9 — PR4–PR7 are marked `RequiresMutation: false`

Every existing check in the repo is `RequiresMutation`, and the suite header said so.

**Chosen: mark the four pure checks `false` and correct the header.** They exercise
`DealDraft.Validate()`, which has no provider behind it; gating them behind a database flag they do not
need would only hide them, and it keeps the readiness rules covered in a no-database run. Verified both
ways — 7 of 7 with the flag, 4 of 7 with **3 reported as skipped** (not silently dropped) without it.

---

## D-PR10 — The workspace chip is build-verified, not visually verified

`npm run verify` is green (Angular compiles, 8/8 tasks), and the readiness logic behind the chip is
covered by PR4–PR7. The chip has **not** been looked at in a browser: that needs MJAPI + Explorer running
and a Playwright session, which is outside this run's definition of done.

**Chosen: ship it and say so plainly.** It is nine lines of template reusing an existing chip class and
an existing CSS variable pair, so the risk is cosmetic rather than functional — but "compiles" is not
"looks right", and this is the one thing in the PR a human eye should confirm.
