---
"@mj-biz-apps/sales-entities": minor
---

Deals carry a `CreationDate` — the business creation date the deal ages from, defaulted to the
record's creation instant and editable afterwards (#532).

`__mj_CreatedAt` could not do this job: it records when the ROW was written, so an imported deal
carries import day rather than deal day, and it is not editable. Existing deals are backfilled from
the earliest evidence the deal existed — their row stamp, or their first stage transition when that
is earlier — the same rule `Sales: Deal Cycle Time` already infers at query time.

The field is on the deal form's Pipeline tab, beside the forecast fields. It is not offered while a
deal is unsaved, since the default is correct for a deal created here.
