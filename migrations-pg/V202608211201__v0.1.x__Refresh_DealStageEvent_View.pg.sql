-- ============================================================================
-- PostgreSQL counterpart of migrations/V202608211201__v0.1.x__Refresh_DealStageEvent_View.sql
-- Written by hand. Nothing to run: the T-SQL file rebinds vwDealStageEvents with sp_refreshview
-- so the view's `d.*` picks up DealStageEvent.AmountAtTransitionIsComputed. PostgreSQL has no
-- sp_refreshview, and needs none here: the counterpart of V202608211200 already regenerates
-- vwDealStageEvents (its CodeGen section) against the table as it stands, new column included.
-- The statement below keeps this a migration Flyway records, so the two sets stay one to one.
-- ============================================================================

SELECT 1;
