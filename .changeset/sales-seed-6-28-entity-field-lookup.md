---
"@mj-biz-apps/sales-entities": minor
---

The v6.28.x Metadata_Sync resolves each query field's `SourceEntityFieldID` on the target database from its source entity and field name, with the shipped ID first, and leaves it NULL when the field is not there. It wrote the build database's entity field IDs as literals, which differ between databases, so the install failed on `FK_QueryField_SourceEntityField`. The migration has not been applied anywhere, so it is corrected in place, Postgres counterpart included.
