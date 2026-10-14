---
'@mj-biz-apps/sales-actions': patch
'@mj-biz-apps/sales-ng': patch
'@mj-biz-apps/sales-core-entities-server': patch
'@mj-biz-apps/sales-server': patch
---

The packages' dependencies on each other are caret ranges (`^6.15.0`) instead of exact versions. A host that pins or overrides one package of this app at a later compatible version no longer forces an exact-match copy of its siblings. Changesets keeps the caret and moves its floor on each release.
