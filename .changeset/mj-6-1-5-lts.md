---
"@mj-biz-apps/sales-entities": patch
"@mj-biz-apps/sales-ng": patch
"@mj-biz-apps/sales-core-entities-server": patch
"@mj-biz-apps/sales-actions": patch
"@mj-biz-apps/sales-server": patch
"@mj-biz-apps/sales-integration-tests": patch
---

Requires MemberJunction 6.1.5, the 6.1 LTS release AIDP Next runs. Every `@memberjunction/*` range is `^6.1.5` and `mj-app.json` declares `>=6.1.5 <7.0.0`. 6.1.5 carries the CodeGen fix for MemberJunction/MJ#4603. Generated code regenerated on 6.1.5 from a database built from migrations is unchanged.
