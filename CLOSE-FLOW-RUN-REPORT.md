# Close-flow night run — report

**Branch:** `feature/close-flow`, cut from `s0-s1-bootstrap-and-baseline-schema`. Three commits, all
local. **Never pushed** — the branch has no upstream, verified.

**The one thing to look at first:** `CLOSE-FLOW-DECISIONS.md` **D-CF10**. The seeded D2C policy asks for
an order state that `Orders.CreateOrderInState` explicitly rejects. It is invisible today because the
seam is stubbed, and it will present at S2 as orders refusing a perfectly well-formed close. Everything
else in this report is either working or honestly labelled.

---

## Status against the brief

| # | Item | State |
|---|---|---|
| 1 | `Sales.CloseDeal` — one atomic transaction | **done, verified** |
| 2 | Routing by `CloseWonPolicy`, no name comparisons | **done, verified** (CD1–CD3) |
| 3 | D2C → Order via `Orders.CreateOrderInState` | **typed seam + stub** — orders unbuildable, see below |
| 4 | B2B → Contract via `Contracts.CreateFromDeal` | **typed seam + stub** — operation does not exist |
| 5 | Close lock in `DealEntityServer.Save()`; reopen with a reason | **done, verified** (CD5, CD6, CD10, CD11) |
| 6 | Integration checks | **done — CD1–CD12, 12/12 green** |
| — | Schema change needed? | **No.** Baseline untouched. |

Verification, all run after the final code change:

- `npm run build` — **8/8 turbo tasks**
- `npm run test:vocabulary-gate` — **clean**, 11 server files scanned
- `RUN_MUTATION_TESTS=1 npm run test:integration` — **24/24 passed** (12 save-deal + 12 close-deal)

Nothing in this run is UNVERIFIED. The database came back (see below), so every check ran against a live
`MJ_BizAppsSales` with nothing mocked.

---

## The database

`sqlcmd` to `localhost:1433` was refused because the sales container `mj-sql` had **exited**, not because
anything was broken. `docker start mj-sql` restored it; the 6 demo deals were intact. Nothing was
dropped, recreated, or reseeded, and the healthy container on 1444 was not touched.

**No rebuild was needed or run**, because there is no schema change. `mj sync push` (2 remote-operation
rows created) and `mj:codegen:files` (`--skipdb`, per KI-7) were the only DB-adjacent operations.

---

## What was built

**`Sales.CloseDeal`** — `packages/CoreEntitiesServer/src/CloseDealOperation.ts`. One provider transaction;
any throw rolls back the routing, the stage event and the close stamps together. It validates (loss
reason mandatory on the lost path, and notes mandatory when the reason's `RequiresNotes` flag is set),
resolves the effective policy as *pipeline default ← caller overrides*, routes, appends the
`DealStageEvent` with `AmountAtTransition` / `ProbabilityAtTransition`, and stamps `ClosedAt` /
`ClosedByUserID` / `ActualCloseDate`. `PreviewOnly` returns the same routing plan and writes nothing.

**The vocabulary rule held.** Every branch reads a flag: `IsWon` / `IsLost` / `LocksDeal` off
`DealStatusType`, `IsRecurring` off `DealLineType` for the line split, `RequiresRenewalSource` off
`DealType` for the renewal fork, and routing from `CloseWonPolicy`. No status name, pipeline name, or
`'B2B'` / `'D2C'` string appears anywhere in the flow.

**Sales still computes no money.** The close maps product, quantity, requested discount and service
period onto the seam and stops. `UnitPrice` is omitted entirely when unset rather than sent as 0 — which
turns out to match orders' own instruction on that field verbatim ("Omit it — do not send 0; zero is a
deliberate free line, not 'unset'").

**The close lock** — `DealEntityServer.Save()`. It reads the **persisted** status, so clearing the field
in memory cannot unlock the row, and it **fails closed** if the status cannot be read. `Description` and
`NextStep` stay editable per §7.3. `Sales.ReopenDeal` demands a reason, writes its own stage event
*first* so the fact that a close happened survives the close being undone, and suspends the lock through
a single self-restoring scoped call rather than a mutable flag anyone else can reach.

**The seams** — `packages/Entities/src/downstream-seams.ts`. Fully typed against the real orders and
contracts shapes, with `StubDownstreamSeam` standing in. `SetDownstreamSeam()` is the swap point.

---

## Why 3 and 4 are stubs

Both were investigated rather than assumed, and the blockers are verified facts:

**Orders.** `Orders.CreateOrderInState` **does exist on orders' `next`** — better than the brief expected,
which placed it on `mjdev/orders-flow`. But:

- **`bizapps-orders` has never had `npm install` run** — no `node_modules`, no `dist` anywhere. It cannot
  be linked or built without an install-and-build cycle of its own, which is exactly the "don't spend the
  night fighting it" case.
- **`Subscription.BillingMode` (C0) does not exist** in orders at all. Confirmed by grep across the repo.
- **`OrderLineInput.ProductID` is required** (non-optional `string`), while **`DealLine.ProductID` is
  nullable and 0 of 3 rows populate it**. Verified in both the type and the live database. Even a
  perfectly linked orders could not accept a deal's lines today.

That third point is the real one: the blocker is not plumbing, it is that sales deal lines currently
carry a product *name* and no product *ID*. Worth deciding at S2 whether the line gets a resolved
`ProductID` or the seam resolves it.

**Contracts.** `Contracts.CreateFromDeal` and `Contracts.RenewTerm` do not exist; contracts is
README-only. Nothing to link.

The stub is deliberately unhelpful in the right way: it returns `Success: false` with the actual blocker
text and **no record ID**, never a fabricated success. CD7 asserts exactly that, and is written to start
**failing** once orders links — which is the signal to replace it with the real check.

---

## Decisions taken (full text in `CLOSE-FLOW-DECISIONS.md`)

| | Decision |
|---|---|
| D-CF1 | A close **commits** even when the downstream is stubbed; routing intent is written into `DealStageEvent.Notes` |
| D-CF2 | **No schema change** — `ActualCloseDate`, `ClosedAt`, `ClosedByUserID`, `ContractID`, `RenewsContractID` all already exist |
| D-CF3 | Orders wiring stubbed — three verified blockers above |
| D-CF4 | Contracts seam typed and stubbed — operations do not exist |
| D-CF5 | §7's "write an Activity" step **skipped, not faked** — the Activity spine does not exist in common or MJ core |
| D-CF6 | Policy overrides arrive via operation input, not a new column |
| D-CF7 | The lock is enforced field-by-field, so §7.3's `Description`/`NextStep` carve-out works |
| D-CF8 | Reopen clears the close stamps; the event log preserves the history |
| D-CF9 | The #31 automation-rule generated artifacts are **excluded from commits** on this branch |
| D-CF10 | **The seeded D2C policy's `OrderState: "Draft"` is rejected by `CreateOrderInState`** — recorded, unchanged |

D-CF8 and D-CF10 are the two flagged for your confirmation.

---

## The branch, and one thing you should know about the working tree

Three commits, authored as Josue, no co-author trailer, no upstream:

```
2ed66f7  chore(sales): changeset for the S4 close flow
f310abd  test(sales): close-deal CD1-CD12 against a live database
b76db5d  feat(sales): Sales.CloseDeal and Sales.ReopenDeal, with the close lock
```

**The working tree has 33 uncommitted files, and that is intentional (D-CF9).** The live database still
carries the four `AutomationRule*` tables from the #31 prototype, so CodeGen generated entity subclasses,
resolvers and four Angular form directories for them — on a branch with no migration creating those
tables. Committing them would break a from-zero `rebuild-db.sh`. They were left **unstaged rather than
discarded**, because discarding would have thrown away #31 work that exists only in this working tree.
The rest of the churn is line-ending-only diffs in eleven `metadata/*.json` files.

So: `git status` looks messy on purpose. Nothing there is close-flow work.

---

## What I did not touch

Issue #31 and the AutomationRule engine, the Outlook plan, the baseline migration, the demo data, the
1444 container, and anything in `bizapps-orders` / `bizapps-contracts` / `bizapps-common`.

## Suggested next steps, in order

1. **Settle D-CF10** — reseed the D2C policy to `"Confirmed"`, or have the close choose
   `Orders.SaveOrder` vs `Orders.CreateOrderInState` from the requested state.
2. **Decide where `DealLine.ProductID` comes from.** This gates the orders seam more firmly than C0 does.
3. Confirm D-CF8 (reopen clearing the close stamps).
4. When orders is installed and built, replace `StubDownstreamSeam` via `SetDownstreamSeam()` and let CD7
   fail on purpose.
