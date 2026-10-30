-- ============================================================================
-- PostgreSQL counterpart of migrations/V202609020650__v6.1.x__Retire_SyncActivities_Clear_Dependents.sql
-- Written by hand from the T-SQL: same check, same message, same two deletes, scoped to the same
-- two IDs. See the T-SQL header for why the run history has to go before
-- V202609020700 retires the job and its action, and why the five run tables in the check stop the
-- upgrade instead of being cleared.
-- The T-SQL builds the list of blocking tables with FOR XML PATH; string_agg does the same here.
-- The list only decides whether to stop, as in the T-SQL, whose message does not include it.
-- ============================================================================

DO $$
DECLARE
  v_JobID    CONSTANT UUID := '5A1E5000-0000-4000-8000-000000000201';
  v_ActionID CONSTANT UUID := '5A1E5000-0000-4000-8000-000000000101';
  v_Blocked  TEXT;
BEGIN
  SELECT string_agg(t, ', ') INTO v_Blocked FROM (
      SELECT '__mj.AIAgentRun' AS t
       WHERE EXISTS (SELECT 1 FROM ${mjSchema}."AIAgentRun" r
                      JOIN ${mjSchema}."ScheduledJobRun" j ON j."ID" = r."ScheduledJobRunID"
                     WHERE j."ScheduledJobID" = v_JobID)
      UNION ALL
      SELECT '__mj.CompanyIntegrationRun'
       WHERE EXISTS (SELECT 1 FROM ${mjSchema}."CompanyIntegrationRun" r
                      JOIN ${mjSchema}."ScheduledJobRun" j ON j."ID" = r."ScheduledJobRunID"
                     WHERE j."ScheduledJobID" = v_JobID)
      UNION ALL
      SELECT '__mj.ProcessRun'
       WHERE EXISTS (SELECT 1 FROM ${mjSchema}."ProcessRun" r
                      JOIN ${mjSchema}."ScheduledJobRun" j ON j."ID" = r."ScheduledJobRunID"
                     WHERE j."ScheduledJobID" = v_JobID)
      UNION ALL
      SELECT '__mj.UserRoutineRun'
       WHERE EXISTS (SELECT 1 FROM ${mjSchema}."UserRoutineRun" r
                      JOIN ${mjSchema}."ActionExecutionLog" l ON l."ID" = r."ActionExecutionLogID"
                     WHERE l."ActionID" = v_ActionID)
      UNION ALL
      SELECT '__mj.ProcessRunDetail'
       WHERE EXISTS (SELECT 1 FROM ${mjSchema}."ProcessRunDetail" r
                      JOIN ${mjSchema}."ActionExecutionLog" l ON l."ID" = r."ActionExecutionLogID"
                     WHERE l."ActionID" = v_ActionID)
  ) x;

  IF v_Blocked IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot retire Sales.SyncActivities: its run history is still referenced by other run records. Decide what should happen to those records, then re-run the upgrade.';
  END IF;

  DELETE FROM ${mjSchema}."ScheduledJobRun"
   WHERE "ScheduledJobID" = v_JobID;

  DELETE FROM ${mjSchema}."ActionExecutionLog"
   WHERE "ActionID" = v_ActionID;
END $$;
