---
"@mj-biz-apps/sales-core-entities-server": patch
---

A pipeline's Close Won Policy can now say `"CloseWonTasks": {"RaiseOrderReviewTask": false}`.

The close has read that switch since the order-review-by-trigger release (bc-aidp-next-golive#320 §5), but the save check added in #448 listed only the older task keys, so any pipeline save that set it was refused as "a setting the close does not use". The check now accepts it as a boolean.
