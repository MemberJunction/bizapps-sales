---
'@mj-biz-apps/sales-entities': minor
---

`V202609202353__v6.4.0__Predictive_Deal_Win_Fields` could not apply on any host.

The three `EntityField` inserts for `PredictedWinProbability`, `PredictedWinRiskBand` and
`PredictedWinScoredAt` name `[RelatedEntityDisplayType]` in the column list and pass `NULL` for it.
That column is `NOT NULL` in MJ core with a default of `N'Search'` — and an explicit `NULL` overrides
a default rather than falling back to it, so the insert is rejected:

    Cannot insert the value NULL into column 'RelatedEntityDisplayType', table '<db>.__mj.EntityField';
    column does not allow nulls. INSERT fails.

On AIDP Next stage this aborted the 6.6.0 upgrade at batch 12 of 22, after common, tasks, accounting,
orders and contracts had already upgraded, leaving the sales app registered `Error`.

Each insert now passes `'Search'` explicitly, matching the column's own default and what every other
non-relational field in this migration would have received. The fields are not foreign keys, so the
display type is immaterial to behaviour — it simply has to be a value.

**Edited in place rather than superseded.** The column has been `NOT NULL` in MJ core throughout 6.x,
so this migration cannot have applied successfully on any 6.x host; no host carries a checksum for it.
Skyway recorded nothing on the failed run — no history row, no partial rows — so a corrected re-run
starts clean.
