# `scripts/dev/` — development-only helpers

Not migrations, not seeds that ship. Nothing here runs automatically, and nothing here belongs in a
production database.

## `orders-product-standin.sql` + `orders-product-seed.sql`

A **stand-in** for `__mj_BizAppsOrders.Product` so the deal-line product picker can be built and
demonstrated on a host that does not have bizapps-orders.

**Why a stand-in rather than orders' real migrations:** orders cannot be applied to a Sales host. Its
schema has hard foreign keys into `__mj_BizAppsAccounting`, and accounting has one into
`__mj_BizAppsTasks` — so applying orders means applying three apps. `Product` itself is self-contained
(its only FKs are to four lookup tables in orders' own schema, to `__mj.Company`, and to itself), which
is what makes a faithful stand-in possible at all. See `docs/KNOWN-ISSUES.md` KI-10.

**The DDL is transcribed verbatim** from orders'
`migrations/V202607061432__v0.1.x__Tables_and_Objects.sql` — same columns, same CHECK constraints, same
filtered-unique SKU index. A picker built against it is built against real shapes.

**The seed is chosen to make each filter dimension observable**, not to look realistic: two companies,
all four `Status` values, and windows that are open-ended, already closed, and not yet open.

### Applying it

```bash
sqlcmd -S localhost,1433 -d <host-db> -U <user> -P <pass> -C -b -i scripts/dev/orders-product-standin.sql
sqlcmd -S localhost,1433 -d <host-db> -U <user> -P <pass> -C -b -i scripts/dev/orders-product-seed.sql
```

The entity still has to be registered for `RunView` to resolve it, and **hand-inserting metadata rows is
not enough** — see KI-10. That requires orders' own CodeGen.

### Removing it

```sql
DROP VIEW __mj_BizAppsOrders.vwProducts;
-- then drop the FKs, the five tables, and the schema
```

The real swap is: drop `__mj_BizAppsOrders` entirely and let orders' migrations create it. Nothing here
is shaped differently from what orders produces, so that is a deletion rather than a reconciliation.
