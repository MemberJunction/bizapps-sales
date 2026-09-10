---
"@mj-biz-apps/sales-ng": patch
---

Deal hero: drop a focus call that could never fire.

`OnRecordRefreshed` fires after the parent form reloads the record from the database, so the record
is saved by definition — and the first rule in `ShouldPlaceCursorInName` declines saved records. The
call was unreachable. `ngAfterViewInit` is the one that places the cursor.
