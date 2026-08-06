# Demo walkthrough — BizApps Sales (S0/S1)

**What this demo is:** a CRUD-level Sales app running on MJ Explorer. Schema and CodeGen only, no
business logic. Every screen is a generated form over the S1 baseline.

**What it is not, and say so early:** there is no pipeline board, no deal workspace, no pricing, no
close automation. Those are S2–S5. What this proves is that the *foundation* is right — and the
foundation is where the app's guarantees live.

---

## Before you start

```bash
npm run start:api             # MJAPI      → http://localhost:4141
npm run start:explorer:msal   # MJExplorer → http://localhost:4341   ← NOTE :msal
```

**Use `start:explorer:msal`, not `start:explorer`.** Plain `ng serve` defaults to Angular's
`development` configuration, which selects the **Auth0 automation tenant** — service accounts, not
staff SSO, so your own credentials get rejected there. The `local_msal` configuration keeps
`environment.ts`'s `AUTH_TYPE: 'msal'` active so you log in as yourself against the Blue Cypress tenant.

Confirm you got the right build before you present:

```bash
curl -s http://localhost:4341/main.js | grep -o 'AUTH_TYPE: "[a-z]*"'    # want: msal
```

Then open <http://localhost:4341> and log in.

### Grid columns are already configured — nothing to do

All six demo grids have had their columns set up and **saved**, so they open ready to present. Verified
by `specs/30-demo-setup-columns.spec.ts`, which drives the real *Configure View* panel and asserts each
column actually appears in the grid afterwards.

| Grid | Columns, and why |
|---|---|
| **Deals** | Status · Amount · Close date · Probability · Pipeline · Stage · Company — a deal legible at a glance |
| **Pipeline Stages** | Order · Probability · Rotting Days · Pipeline · Forecast Category · **Deal Status Type** ← the whole argument |
| **Deal Team Members** | **Person ID** · Attribution · Deal · **Employee** · Role — the two ID columns adjacent, so D-6 is visible |
| **Deal Lines** | Quantity · Requested Discount · Line Type · **Resolved Unit Price · Resolved Extended · Priced At** ← deliberately empty |
| **Deal Stage Events** | Changed At · **Amount At Transition** · Probability At Transition · Days In Previous Stage |
| **Deal Status Types** | Code · Is Open · Is Closed · **Is Won · Is Lost · Locks Deal** — the behaviour flags themselves |

If the columns are ever lost (a reset user profile, a different login), re-apply them with:

```bash
PW_HEADLESS=1 npx playwright test --config test-harnesses/playwright/playwright.config.ts \
  --project crud --grep "demo setup"
```

> **This had to be done through the UI, not seeded.** Three SQL routes were tried and all left the grid
> unchanged, even after restarting MJAPI to clear its metadata cache: `__mj.UserApplicationEntity`,
> `__mj.UserFavorite` against the `MJ: Entities` meta-entity, and a shared `IsDefault` `__mj.UserView`
> carrying a complete `GridState.columnSettings`. MJ owns this state client-side. The inert rows were
> removed rather than left looking functional, and the Playwright route drives the same panel a human
> would — which is why it persists.

Seed (or re-seed) the demo data — idempotent, safe to re-run:

```bash
scripts/seed-demo-data.sh            # seed
scripts/seed-demo-data.sh --remove   # tear down again
```

Verify the whole tour renders before anyone is watching, and refresh the fallback screenshots:

```bash
PW_HEADLESS=1 npx playwright test --config test-harnesses/playwright/playwright.config.ts \
  --project crud --grep "demo tour"
# screenshots → test-harnesses/playwright/artifacts/demo-*.png
```

---

## Getting around

**Bookmark one URL: <http://localhost:4341/app/mjbizappssales>** — the generated Sales application.

| To do this | Do this |
|---|---|
| **Jump to any entity (the fast path)** | On the entity panel, hit **`/`** and type `deal` / `pipe` / `account` — the 19 cards filter as you type |
| Get to the entity panel | the **"All"** breadcrumb, top-left |
| Open a record | click the row's link |
| Edit | the **pencil** in the record toolbar |
| Delete | the **trash** in the record toolbar, then confirm |
| Filter rows within a grid | the **Filter records…** box |

**Use the search box, not scrolling.** The panel is a 19-card *alphabetical* grid, so Deals sits below
nine vocabulary tables. `/` then three letters is much faster than hunting, and it's the difference
between looking fluent and looking lost.

### Two things to know so they don't surprise you live

> ⚠️ **Per-entity URLs do not work.** `/app/entity/<EntityName>` looks like a deep link and resolves —
> but always shows the app's *default* entity regardless of what you asked for. Caught by row count:
> every such URL reported 6 records (the Deals count) even when asking for Pipelines, which has 2. Don't
> prepare per-screen bookmarks.

> ⚠️ **The landing screen varies.** Opening the app sometimes shows a grid and sometimes the entity
> panel, depending on what you last visited. `ApplicationEntity.Sequence` was reordered so that when it
> *does* land on a grid it's **Deals** (it used to be "Deal Contact Roles", entity 5 of 19). Either way,
> `/` + type is your first move.

**"My Favorites" is empty, and leave it that way unless you want to curate it by hand.** The toggle is
real, but it cannot be seeded from SQL — both `__mj.UserApplicationEntity` and `__mj.UserFavorite`
(against the `MJ: Entities` meta-entity) were tried and the panel still reported "0 entities". Whatever
backs it isn't reachable that way. If you want a short list, click the **star** on each entity in the UI
once and it sticks.

---

## Click-by-click script

Nine clicks, ~6 minutes. Screenshots of every step are in
`test-harnesses/playwright/artifacts/demo-*.png` — regenerate them any time with the `demo tour` spec.
Reaching a grid is always the same two moves, so it's written once here:

> **`[GO]` = click the "All" breadcrumb (top-left) → press `/` → type 3–4 letters → click the card.**
> The panel is a 19-card alphabetical grid; typing is much faster than hunting, and looks it.

| # | Click | On screen | Say |
|---|---|---|---|
| **0** | Open `localhost:4341/app/mjbizappssales` | The Sales app | *"This is generated from the schema. Nobody wrote a form."* |
| **1** | `[GO]` → `deals` | **6 deals** · Status · **Amount** · Close · Prob · Pipeline · Stage · Company | *"Two companies, two pipelines, one Won, one Lost."* |
| **2** | — *(stay here)* | Row 5: **Won**, stage **Signed** | *"Note the winning stage is called Signed."* |
| **3** | `[GO]` → `pipe` → **Pipeline Stages** | 9 stages. **"Booked" → Won** and **"Signed" → Won** | **The keystone.** *"Two stages, different names, both map to status Won. There is no string 'Closed Won' anywhere in the code — behaviour comes from `DealStatusType.IsWon`. Rename the stage, nothing changes."* |
| **4** | `[GO]` → `deal stat` → **Deal Status Types** | `Is Open · Is Closed · Is Won · Is Lost · Locks Deal` | *"That's the configuration layer. On Hold is neither open nor closed — which is why those two aren't inverses. And a CI grep fails the build if any server file ever compares a status name."* |
| **5** | `[GO]` → `sales acc` → **Sales Accounts** | Northwind / Cascade / Beacon | *"These names aren't columns in this table — they come from the parent Organization row. Sales extends the shared Person/Organization graph instead of forking identity."* |
| **6** | `[GO]` → `deal li` → **Deal Lines** | Qty 250, Disc 12 — **Resolved Unit Price / Resolved Extended / Priced At all `—`** | *"That emptiness is the feature. Sales records intent and asks `Orders.PreviewOrder` for the number. It never multiplies quantity by price."* |
| **7** | `[GO]` → `deal team` → **Deal Team Members** | Last row: **Person ID set, Employee empty**, role Partner Manager | *"That's D-6. A partner rep isn't an employee, so the table takes either — with a database constraint enforcing exactly one. Also: three rows on one deal, so summing Amount here triple-counts it."* |
| **8** | `[GO]` → `deal stage` → **Deal Stage Events** | **Amount At Transition: 120,000 → 120,000 → 150,000 → 185,000** | *"The deal is 185k today. In May it was 120k, and this table knows, because each transition stamped its own amount. Append-only, never edited."* |
| **9** | `[GO]` → `deals` → click **Northwind — Platform Rollout** → the **pencil** | The record form, then edit mode | *"Pipeline and Company resolve to names, not UUIDs — that's the generated base view. And these three: `Amount Is Computed`, `Amount Computed At`, `Amount Source Hash` — Amount is a cached answer with a receipt. Right now it's 0: a human typed it."* |

**If you only have two minutes:** steps 1 → 3 → 6. Deals for credibility, Pipeline Stages for the design
argument, Deal Lines for the money guarantee.

---

## The walkthrough — six things worth showing, in order

### 1. Deals — the pipeline (start here; it's already on screen)

Six deals across two companies and two pipelines (**B2B** and **D2C**): one in Negotiation at £185k, an
early-stage pilot, a renewal, a partner-SOURCED deal typed `New`, one **Won** upsell, one **Lost**.

Worth pointing at if asked: how a deal was *originated* (`LeadSourceType` = Partner) and what *kind of
motion* it is (`DealType` = New) are two different facts in two different columns — which is why a
partner-sourced deal is not a "partner" deal type.

**Say:** *"Every one of these screens is generated from the schema. Nobody wrote a form."*

### 2. Pipeline Stages — the point of the whole design

Open **Pipeline Stages**. The winning stage of the Enterprise pipeline is called **"Signed"**.

**Say:** *"There is no string `'Closed Won'` anywhere in this codebase. The stage doesn't carry
won-ness — it points at a `DealStatusType` row that has `IsWon = 1`. So a customer can call their
winning stage Signed, Booked or Enrolled and not one line of code changes."*

Then open **Deal Status Types** and show the flag columns: `IsOpen`, `IsClosed`, `IsWon`, `IsLost`,
**`LocksDeal`**. Point at "On Hold" — neither open nor closed, which is why those two flags aren't each
other's inverse.

**The kicker:** *"A CI grep fails the build if any server file ever compares a status or stage name.
It's green today, before there's any logic to break it."*

### 3. Sales Accounts / Sales Contacts — identity is shared, not forked

Open **Sales Accounts**. "Northwind Health Group" — that name is **not a column in this table**. It
comes from the parent `Organization` row; the account and the organization are one record with one UUID.

**Say:** *"Sales doesn't own customer identity. It extends the shared Person/Organization graph, so the
same human can be a sales contact here, an applicant in ATS and a member in certification — one row,
three apps."*

### 4. A Deal record — provenance, and money the app refuses to compute

Open **Northwind Health — Platform Rollout**. Note `Pipeline` and `Company` resolve to *names*, not
UUIDs — that's the generated base view's denormalized columns working.

Click the **pencil** to edit and point at three fields: **`Amount Is Computed`**,
**`Amount Computed At`**, **`Amount Source Hash`**.

**Say:** *"`Amount` is a cached answer, not a fact. These three columns are its receipt. When the pricing
bridge lands at S2, every number comes back from `Orders.PreviewOrder` and the hash fingerprints the
line set it came from — so the UI can say 'this figure is stale, reprice' instead of showing a number
nobody can trace. Right now `AmountIsComputed` is 0: a human typed it."*

Then open **Deal Lines**. `Quantity` 250, `Requested Discount` 12 — and **`Override Unit Price`,
`Resolved Unit Price`, `Resolved Extended Amount` are all empty.**

**Say:** *"That emptiness is the feature. Sales records intent — product, quantity, requested discount,
term — and asks orders for the number. It never multiplies quantity by price. The resolved columns are
write-only from a PreviewOrder response."*

### 5. Deal Team Members — the decision you ruled on tonight

Open **Deal Team Members**. The Northwind deal has three: an Owner/AE, a Sales Engineer, an SDR.

Then look at the Beacon deal's rows: one Owner, and a **Partner Manager whose `Employee` is empty and
whose `Person` is Ravi Shankar**.

**Say:** *"That's D-6. `Partner Manager` is a seeded role, and a partner rep isn't an employee — so the
table takes either an Employee or a Person, with a database constraint enforcing exactly one. The
alternative was discovering it on the first partner deal, after attribution data existed."*

**And the trap worth naming:** *"Three team rows on one deal. Sum `Deal.Amount` across this table and
you've triple-counted the deal. Every by-rep rollup either filters to the owner role or weights by
attribution — that's written into the column's own description."*

### 6. Deal Stage Events — why history is trustworthy

Open **Deal Stage Events**. Four rows for the Northwind deal, and look at `Amount At Transition`:
**120,000 → 120,000 → 150,000 → 185,000**.

**Say:** *"The deal is worth 185k today. But on the 20th of May it was 120k, and this table knows that,
because each transition stamped the amount as it stood. Read `Deal.Amount` alone and you'd report 185k
for every date in history. This table is append-only and never edited."*

Finish on **Forecast Snapshots**: one row, captured 1 August, holding commit/best-case/pipeline/closed
as they were then.

**Say:** *"'What's the forecast' and 'what did we think the forecast was on the 1st' are different
questions. The first reads Deal. The second reads this. You cannot reconstruct the second after the
fact, which is why it's captured."*

---

## If someone asks

**"Is it just tables?"** No — CRUD is proven at three layers: generated stored procedures, the GraphQL
API, and the real Explorer UI driven by Playwright (create a Pipeline and a Deal through the forms, read
back with FKs resolved, update, delete). The UI run is `npm run test:explorer`.

**"Why is `Contract ID` a raw UUID box?"** Because contracts isn't installed here, so there's no FK and
CodeGen can't offer a lookup. Same for `Currency ID` and `Campaign ID`. Note the family standard on
cross-app FK hardness is **currently being revised** — orders PR #29 withdraws the soft-reference
ruling in favour of hard, nullable FKs — so this is an open item, not a settled design.

**"Why does it say Mrr / Arr?"** CodeGen's PascalCase word-splitting doesn't know MRR and ARR are
acronyms. Cosmetic; fixable with a `DisplayName` in entity-field metadata.

**"Can I delete something?"** Yes, and it's a **soft** delete — the grid grows a "Recycle Bin" chip
afterwards. One known wrinkle: deleting a record whose tab is still open logs a console error as MJ's
tab manager tries to reload it (`docs/KNOWN-ISSUES.md` KI-5). The delete itself is fine.

**"What's next?"** S2 is the pricing bridge — `DealLine` ↔ `Orders.PreviewOrder` with provenance
stamping, plus the integration check that fails if `Deal.Amount` ever disagrees with PreviewOrder. It's
blocked on two seams that don't exist in orders yet (`Subscription.BillingMode` and the pricing-resolver
slot), which is the critical path for the whole revenue stack.

---

## Reset

```bash
scripts/seed-demo-data.sh --remove     # remove demo rows, keep schema + vocabulary
scripts/seed-demo-data.sh              # put them back
```

Full rebuild from zero, if the database gets into a state you don't trust:

```bash
scripts/rebuild-db.sh && npm run mj:codegen && scripts/append-codegen.sh \
  && npm run mj -- sync push --dir metadata \
  && scripts/seed-dev-data.sh josue.garcia@bluecypress.io \
  && scripts/seed-demo-data.sh && npm run build
```
