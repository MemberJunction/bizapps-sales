---
"@mj-biz-apps/sales-ng": patch
---

Deal form fixes:
- A new deal's Status hint no longer calls it open or points to a Close action it cannot have yet; it says the deal saves as open and can be closed after saving.
- Weighted shows "—" instead of "$0" when the deal has no amount or no probability, on the header and the Overview.
- The deal owner can be changed from the Account & people panel on a saved deal; the pick is recorded on the deal team as owner. The Company field says it is set by the pipeline and changed with Company on the Pipeline panel.
- A refused close or reopen shows each reason once; the first reason is no longer repeated under the message, and an info note is never the message.
- After a product is saved, a refused deal save is reported beside the products, and a successful one re-checks the stale-amount and lock notices.
