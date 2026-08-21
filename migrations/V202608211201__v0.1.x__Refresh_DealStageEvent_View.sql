--
--  Rebind vwDealStageEvents after adding DealStageEvent.AmountAtTransitionIsComputed.
--
--  ── WHY THIS IS A SEPARATE STEP, AND WHY IT IS NOT OPTIONAL ──────────────────────────────────────
--
--  The previous migration reasoned that the base view needed no change because it is `SELECT d.*` plus
--  named lookup columns, so a new base-table column "flows through". That is true of the TEXT and false
--  of the OBJECT: SQL Server resolves `*` when the view is created and caches the column list. Adding a
--  column to the table therefore does NOT appear in the view until it is rebound.
--
--  Measured immediately after that migration applied:
--
--      EntityField rows for Deal Stage Events : 21
--      columns returned by vwDealStageEvents  : 20
--
--  That is the exact shape of the corruption CLAUDE.md records for `vwDeals`: `SQLServerDataProvider`
--  builds its `@ResultTable` from ENTITY METADATA and then does `INSERT INTO @ResultTable EXEC sp...`, so
--  a view or proc returning fewer columns than the entity has fields fails every insert with "Column name
--  or number of supplied values does not match table definition" — inside a transaction that then aborts.
--  For this table that would have broken every stage event, which is to say every close, every reopen and
--  every board drag.
--
--  `sp_refreshview` re-resolves the `*` against the current table. It is idempotent and safe to re-run.
--
GO

EXEC sp_refreshview N'__mj_BizAppsSales.vwDealStageEvents';
GO
