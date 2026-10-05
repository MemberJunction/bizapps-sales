---
"@mj-biz-apps/sales-entities": patch
"@mj-biz-apps/sales-core-entities-server": patch
"@mj-biz-apps/sales-actions": patch
"@mj-biz-apps/sales-server": patch
"@mj-biz-apps/sales-ng": patch
---

Raise the MemberJunction floor to the 6.1 LTS release (`^6.1.4`, `mjVersionRange >=6.1.4 <7.0.0`) and move bizapps-common to `^5.50.1`. The accounting packages sales depends on require MJ core 6.1.0-edge.7 or later; with the old `^6.1.0-edge.5` override the lockfile installed an edge.5 core under them and the first accounting read during a deal save failed. Common 5.50.1 carries the Tags metadata that pushes to an MJ v6 host.
