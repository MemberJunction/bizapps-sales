# `scripts/dev/` — development-only seeds

Not migrations, not seeds that ship; nothing here belongs in a production database. Each script is
idempotent. `scripts/seed-demo-data.sh` runs all three, in the order below, once it has settled the
pipeline companies.

## `seed-orders-catalog.sql`

Seeds orders' `Product` catalogue for the product picker and the close-won handoff. The selling
company is the one the first active pipeline belongs to; a second company carries the products the
cross-tenant check (PP2) must not see. **The rows make each picker filter observable**, not realistic:
all four `Status` values, availability windows that are open-ended, already closed and not yet open,
and one subscription product so the term start shows.

Needs an active pipeline (`scripts/seed-dev-data.sh`), a second `Company`, and orders'
`metadata/product-types` and `metadata/revenue-recognition-types` pushed. Without orders'
`metadata/subscription-types` it still seeds, with no subscription product.

## `seed-revenue-stack.sql`

Makes a host able to book a close-won order. For every company it adds an `AccountingCompanyProfile`
(USD), journal-entry sequences for 2025–2028, nine GL accounts with a company-level link per role, and
a price rule for each `Active` product that has none — so it runs after the catalogue.

Needs accounting's `metadata/gl-account-roles` and `metadata/currencies` pushed; its header lists the
other metadata pushes it assumes.

## `seed-contract-template.sql`

Gives contracts a Published, usable `ContractTemplate` (a demo version of the shipped Master Agreement
type), so a close-won contract can be created on a host built from migrations. It does nothing when
contracts is not installed or already has a Published, usable template. Needs contracts'
`metadata/contract-template-types` pushed.
