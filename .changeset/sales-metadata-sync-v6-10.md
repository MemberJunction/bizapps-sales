---
'@mj-biz-apps/sales-entities': minor
---

The 6.10 Metadata_Sync ships the won-deal finance exception check to hosts: the `Detect Won Deals With Unconfirmed Orders` Action, its nightly scheduled job (shipped Disabled) and the `Sales: Deal Owners Without a Linked Login` query, all added in 6.9.1 as metadata that no migration carried. The seed is idempotent and safe on a host that already ran `mj sync push`, and the three rows are teardown roots so `mj app remove` retires them. The ML models, training pipeline, scoring binding and scoring record process under metadata/ are still not included.
