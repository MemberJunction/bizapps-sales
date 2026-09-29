---
'@mj-biz-apps/sales-entities': minor
---

The 6.9 Metadata_Sync ships this app's metadata for the first time since 6.1, so hosts get it and not only a developer's own database. It includes the current SQL of the six dashboard and roster queries (#137), the Won Deals With Unconfirmed Orders query, the Deals labels and Contract soft foreign keys, and the curated user-search settings. The seed is idempotent and safe on a host that already ran `mj sync push`. It also merges the Deals entity's two `fields` blocks in metadata/, whose duplicate key had silently dropped `AllowUserSearchAPI`. The ML models, training pipeline, scoring binding and scoring record process under metadata/ are not included.
