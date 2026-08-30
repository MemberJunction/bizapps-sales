-- =============================================================================================
-- Metadata Sync — retire Sales.SyncActivities (action, Limit param, hourly job)
-- =============================================================================================
-- Generated from `mj sync push --dir metadata --include actions,scheduled-jobs --delete-db-only --ci`
-- on 2026-08-30. The JSON tombstones are metadata/actions/.sales-actions.json and
-- metadata/scheduled-jobs/.sales-scheduled-jobs.json (`deleteRecord.delete = true`).
--
-- The generator emitted one spDelete* per ActionExecutionLog / ScheduledJobRun row on the
-- machine that ran the push. Those IDs are host-specific. This file keeps the three explicit
-- deletes and replaces the 84 runtime children with set deletes keyed to the parent IDs, so
-- every host loses this job's history rather than this machine's 42 run IDs.
--
-- Placeholder: `[${mjSchema}]` for core SPs and tables, same as V202608251930.
-- Idempotent: IF EXISTS so a host that already lost these rows is a no-op.

DECLARE @SyncActionID UNIQUEIDENTIFIER = '5A1E5000-0000-4000-8000-000000000101';
DECLARE @SyncParamID UNIQUEIDENTIFIER = '5A1E5000-0000-4000-8000-000000000102';
DECLARE @SyncJobID UNIQUEIDENTIFIER = '5A1E5000-0000-4000-8000-000000000201';

-- Runtime children first (NOT NULL FKs). Set-based, not the per-row IDs from the push log.
IF OBJECT_ID('[${mjSchema}].[ScheduledJobRun]', 'U') IS NOT NULL
    DELETE FROM [${mjSchema}].[ScheduledJobRun] WHERE ScheduledJobID = @SyncJobID;

IF OBJECT_ID('[${mjSchema}].[ActionExecutionLog]', 'U') IS NOT NULL
    DELETE FROM [${mjSchema}].[ActionExecutionLog] WHERE ActionID = @SyncActionID;
GO

-- Delete MJ: Action Params (core SP call only)
IF EXISTS (SELECT 1 FROM [${mjSchema}].[ActionParam] WHERE ID = '5A1E5000-0000-4000-8000-000000000102')
    EXEC [${mjSchema}].[spDeleteActionParam] @ID = '5A1E5000-0000-4000-8000-000000000102';
GO

-- Delete MJ: Scheduled Jobs (core SP call only)
IF EXISTS (SELECT 1 FROM [${mjSchema}].[ScheduledJob] WHERE ID = '5A1E5000-0000-4000-8000-000000000201')
    EXEC [${mjSchema}].[spDeleteScheduledJob] @ID = '5A1E5000-0000-4000-8000-000000000201';
GO

-- Delete MJ: Actions (core SP call only)
IF EXISTS (SELECT 1 FROM [${mjSchema}].[Action] WHERE ID = '5A1E5000-0000-4000-8000-000000000101')
    EXEC [${mjSchema}].[spDeleteAction] @ID = '5A1E5000-0000-4000-8000-000000000101';
GO
