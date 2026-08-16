---
'@mj-biz-apps/sales-entities': minor
'@mj-biz-apps/sales-ng': minor
'@mj-biz-apps/sales-integration-tests': minor
---

Deal lines can name a product from orders' catalogue.

`DealLine.ProductID` has been carried on the entity since the previous release, but nothing populated it —
a rep could record *that* a line existed without saying *what* it was for. This adds the picker, and the
rule deciding what may appear in it.

`ProductFilterFor(companyID, asOf)` lives in `sales-entities` rather than in the component, so the UI,
the integration suite and (later) the close-won handoff all apply one rule instead of three re-typed
copies of it. It filters on three conditions, each of which fails silently when wrong: the selling
company, a sellable status, and the availability window evaluated **as of a date** rather than "now" —
so a deal quoted last year and one quoted next year do not see the same catalogue.

Orders may be absent entirely, and that stays supported: `DealLine.ProductID` is a soft reference with no
foreign key crossing into orders' schema. `LoadProducts` checks the entity is registered before querying,
because `RunView` against an unregistered entity logs a console error rather than returning a failure —
which took the whole workspace screen down on a host without orders.

Integration checks PP1–PP4 cover the filter against a live database. They are **not** in the default gate
yet: they need orders' entity metadata, which cannot be registered on a Sales-only host. The reason, and
what it would take, is recorded in `docs/KNOWN-ISSUES.md` KI-10.
