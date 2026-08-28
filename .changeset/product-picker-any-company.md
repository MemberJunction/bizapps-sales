---
"@mj-biz-apps/sales-entities": major
"@mj-biz-apps/sales-ng": minor
---

A deal may carry any company's product, and the line takes its company from the product (#29).

**Breaking, `sales-entities`.** `ProductFilterFor(companyID, asOf)` is now `ProductFilterFor(asOf)`.
The `CompanyID = <the deal's company>` clause is gone; `Status = 'Active'` and the availability
window stay. Callers drop the first argument — there is no behavioural shim, because a filter that
silently ignored a company you passed it would be worse than one that refuses to compile.

`ProductLookup` additionally carries `CompanyID`, which is additive — a line's company can no longer be
inferred from the deal, so it has to come from the product the rep actually chose.

**Why.** With both pipelines owned by Blue Cypress, that clause made every Betty and Sidecar product
unsellable — an Account Director could not put one on a deal at all. Company ownership lives at the
PRODUCT, not at the deal (Johanna Snider, Sales channel, 2026-08-26). `docs/DECISIONS.md` D5 has always
said a deal lives in one company's pipeline while its lines carry their own company from the product,
so the clause contradicted D5 and the picker now agrees with it. No tenancy boundary is being relaxed,
because there was never one here.

**`sales-ng`.** `OnProductChange` stamps the line's `CompanyID` from the chosen product rather than
from the pipeline. Orders' `OrderLineEntityServer` derives the same value at save, so the stored value
was already correct either way; the stamp exists for the browser, where `CanSave` runs
`deal.Validate()` without that server subclass and `OrderLine.CompanyID` is NOT NULL. Left unset, the
rep gets a disabled Save reading "Company ID cannot be null" against a form that looks complete. The
deal header still derives its company from the pipeline, unchanged.

Also adds a unit-test tier to this repo — `vitest` plus a root config shaped after bizapps-orders, and
`test:unit` wired into `verify`. `test:unit` had been a dead script with no dependency and no config,
which is why two of this issue's acceptance criteria had no coverage in any tier.
