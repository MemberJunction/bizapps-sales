---
'@mj-biz-apps/sales-entities': minor
'@mj-biz-apps/sales-server': minor
'@mj-biz-apps/sales-ng': minor
---

Regenerated code: `vwDeals` and `vwDealContactRoles` now carry the contact name columns.

Giving `Sales Contacts` a name field (`DisplayNameAndEmail`) means every view with a foreign key to it gains a name column — `PrimaryContact` and `BillingContact` on Deals, `SalesContact` on Deal Contact Roles. This is the CodeGen output that registers them, so metadata and the views agree.

**CodeGen lags by exactly one pass when a new FK-name column appears, and the second pass repairs it.** Measured:

| | Deals | Deal Contact Roles | Result |
|---|---|---|---|
| Pass 1 | 59 fields / **61** columns | 10 / **11** | `success: false` |
| Pass 2 | **61 / 61** | **11 / 11** | `success: true`, 0 mismatches |

`createNewEntityFieldsFromSchema` builds `EntityField` rows by reading the base view's columns, so on the pass that CREATES those columns they are not yet visible to it. The next pass sees them, registers them and fixes the sequences.

**This contradicts the warning in `CLAUDE.md`**, which says a full second pass corrupts the database. In this case the second pass is what repaired it; the first pass left the corruption. The documented incident is the same lag seen from the other side — whichever pass introduces a new virtual column leaves metadata one behind. The safe rule is *run until it reports success and field/column parity is clean*, verified per entity, not *never run twice*.

**Why the intermediate state is dangerous, stated precisely.** The `Deal` TABLE never changes. `spCreateDeal` ends in `SELECT * FROM vwDeals`, and the client-side provider declares a `@ResultTable` with one column per `EntityField`, filled by a POSITIONAL `INSERT ... EXEC`. A 61-column result into a 59-column table fails with *"Column name or number of supplied values does not match table definition"* — so it is the save-capture width that breaks, not anything about the table.

CodeGen also moved the generated entities to a per-schema layout: `entity_subclasses.ts` is now a barrel re-exporting `entities/__mj_BizAppsSales.ts`, with the GraphQL schema split the same way.

Also converts the one dynamic `await import()` in the test suite to a static import. That test failed twice in full runs and could not be reproduced in twelve attempts afterwards; the cause was never identified, so this is not a fix presented as one — it removes the single construct that made the test different from its neighbours.
