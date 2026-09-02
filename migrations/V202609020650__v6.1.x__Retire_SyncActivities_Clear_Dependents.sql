/*
  Clear the FK dependents that block the Sales.SyncActivities tombstones in
  V202609020700__v6.1.x__Metadata_Sync.sql.

  V202609020700 retires Sales.SyncActivities (superseded by bizapps-common's Activity Sync
  engine) with three core deletes:

      spDeleteActionParam  @ID = '5A1E5000-0000-4000-8000-000000000102'
      spDeleteAction       @ID = '5A1E5000-0000-4000-8000-000000000101'
      spDeleteScheduledJob @ID = '5A1E5000-0000-4000-8000-000000000201'

  Those deletes cannot succeed on any host where the job has actually run. Every FK into
  __mj.ScheduledJob and __mj.Action is NO_ACTION -- nothing cascades -- and both blocking
  columns are NOT NULL, so the rows cannot be unlinked instead. On AIDP stage the job had
  158 ScheduledJobRun rows and its action 158 ActionExecutionLog rows, and the upgrade
  failed at batch 17/18 with:

      The DELETE statement conflicted with the REFERENCE constraint
      "FK_ScheduledJobRun_ScheduledJob"

  This migration is numbered BEFORE 202609020700 deliberately: it runs first and leaves that
  file byte-identical, so no already-computed migration checksum changes.

  DATA REMOVED: the run/execution history of the one job and one action being retired. That
  history belongs to records V202609020700 deletes outright, so it cannot outlive them -- MJ
  provides no cascade and the FK columns reject NULL. Nothing else is touched; both deletes
  are scoped to these two IDs.

  NOT cleared, on purpose:
    * CompanyIntegration.ScheduledJobID / ContentSource.ScheduledJobID reference the job
      itself. Those are live features pointing AT the job rather than its own history, so
      deleting them would silently break an integration.
    * The five tables that reference the run rows below (see the guard) are themselves run
      histories with their own dependents; cascading into them from an app migration would
      reach arbitrarily far into core data.
  Both are 0 on AIDP stage. Where they are not, this migration stops with an explicit message
  instead of a raw FK violation, because that host needs a human decision, not a silent delete.

  Idempotent: deleting an absent row is a no-op, so a re-run -- and a host that never ran the
  job -- both succeed unchanged.
*/

DECLARE @JobID    UNIQUEIDENTIFIER = '5A1E5000-0000-4000-8000-000000000201';
DECLARE @ActionID UNIQUEIDENTIFIER = '5A1E5000-0000-4000-8000-000000000101';
DECLARE @Blocked  NVARCHAR(MAX) = NULL;

SELECT @Blocked = STUFF((
    SELECT ', ' + t FROM (
        SELECT '__mj.AIAgentRun' AS t
         WHERE EXISTS (SELECT 1 FROM [${mjSchema}].[AIAgentRun] r
                        JOIN [${mjSchema}].[ScheduledJobRun] j ON j.[ID] = r.[ScheduledJobRunID]
                       WHERE j.[ScheduledJobID] = @JobID)
        UNION ALL
        SELECT '__mj.CompanyIntegrationRun'
         WHERE EXISTS (SELECT 1 FROM [${mjSchema}].[CompanyIntegrationRun] r
                        JOIN [${mjSchema}].[ScheduledJobRun] j ON j.[ID] = r.[ScheduledJobRunID]
                       WHERE j.[ScheduledJobID] = @JobID)
        UNION ALL
        SELECT '__mj.ProcessRun'
         WHERE EXISTS (SELECT 1 FROM [${mjSchema}].[ProcessRun] r
                        JOIN [${mjSchema}].[ScheduledJobRun] j ON j.[ID] = r.[ScheduledJobRunID]
                       WHERE j.[ScheduledJobID] = @JobID)
        UNION ALL
        SELECT '__mj.UserRoutineRun'
         WHERE EXISTS (SELECT 1 FROM [${mjSchema}].[UserRoutineRun] r
                        JOIN [${mjSchema}].[ActionExecutionLog] l ON l.[ID] = r.[ActionExecutionLogID]
                       WHERE l.[ActionID] = @ActionID)
        UNION ALL
        SELECT '__mj.ProcessRunDetail'
         WHERE EXISTS (SELECT 1 FROM [${mjSchema}].[ProcessRunDetail] r
                        JOIN [${mjSchema}].[ActionExecutionLog] l ON l.[ID] = r.[ActionExecutionLogID]
                       WHERE l.[ActionID] = @ActionID)
    ) x FOR XML PATH('')), 1, 2, '');

IF @Blocked IS NOT NULL
    THROW 50000, N'Cannot retire Sales.SyncActivities: its run history is still referenced by other run records. Decide what should happen to those records, then re-run the upgrade.', 1;

DELETE FROM [${mjSchema}].[ScheduledJobRun]
 WHERE [ScheduledJobID] = @JobID;

DELETE FROM [${mjSchema}].[ActionExecutionLog]
 WHERE [ActionID] = @ActionID;
GO
