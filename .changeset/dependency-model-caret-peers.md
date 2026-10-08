---
"@mj-biz-apps/sales-actions": patch
"@mj-biz-apps/sales-core-entities-server": patch
"@mj-biz-apps/sales-entities": patch
"@mj-biz-apps/sales-ng": patch
"@mj-biz-apps/sales-server": patch
---

MemberJunction and other BizApps packages are peer dependencies with caret ranges (nothing in `dependencies`), so a host keeps one copy of each. The common, orders and tasks packages moved from `dependencies` to `peerDependencies`; every such peer has an exact `devDependencies` anchor for local builds. Adds `check-dependency-model` to CI.
