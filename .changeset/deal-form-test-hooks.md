---
"@mj-biz-apps/sales-ng": patch
---

Deal form: stable `data-testid` and `data-field` hooks for the Explorer harness (#88)

The deal workspace's test hooks went with it when deals became Explorer record tabs, so the harness
had nothing stable to drive on the form that replaced it. The Pipeline panel's Status control, the
Close panel's close and reopen flow, the lines panel's Add, the line editor and the Sales header's
primary action now carry `data-testid`s, and every panel field wrapper carries `data-field="<column>"`.
Attributes only; no behaviour changes.
