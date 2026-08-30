-- =============================================================================================
-- Retire Sales.SyncActivities. Common owns the trigger; sales owns DealLinker only.
-- =============================================================================================
-- V202608251930 still CREATES the action, its Limit param, and the hourly ScheduledJob. That file
-- has already been applied on hosts and is not rewritten. This migration deletes those three
-- roots (and NOT NULL children: ActionParam, ScheduledJobRun) and seeds the DealLinker
-- extension row that metadata/activity-sync-extensions/ now holds.
--
-- Idempotent: a host that never had the action, or that already lost it, is a no-op.

DECLARE @SyncActionID UNIQUEIDENTIFIER = '5A1E5000-0000-4000-8000-000000000101';
DECLARE @SyncJobID UNIQUEIDENTIFIER = '5A1E5000-0000-4000-8000-000000000201';
DECLARE @DealLinkerID UNIQUEIDENTIFIER = 'A7C4E2B1-5D83-4F0A-9C1E-6B8D2F4A90C3';

IF OBJECT_ID('[${mjSchema}].[ScheduledJobRun]', 'U') IS NOT NULL
    DELETE FROM [${mjSchema}].[ScheduledJobRun] WHERE ScheduledJobID = @SyncJobID;

IF OBJECT_ID('[${mjSchema}].[ScheduledJob]', 'U') IS NOT NULL
    DELETE FROM [${mjSchema}].[ScheduledJob] WHERE ID = @SyncJobID;

IF OBJECT_ID('[${mjSchema}].[ActionParam]', 'U') IS NOT NULL
    DELETE FROM [${mjSchema}].[ActionParam] WHERE ActionID = @SyncActionID;

IF OBJECT_ID('[${mjSchema}].[ActionResultCode]', 'U') IS NOT NULL
    DELETE FROM [${mjSchema}].[ActionResultCode] WHERE ActionID = @SyncActionID;

IF OBJECT_ID('[${mjSchema}].[EntityAction]', 'U') IS NOT NULL
    DELETE FROM [${mjSchema}].[EntityAction] WHERE ActionID = @SyncActionID;

IF OBJECT_ID('[${mjSchema}].[ActionExecutionLog]', 'U') IS NOT NULL
    DELETE FROM [${mjSchema}].[ActionExecutionLog] WHERE ActionID = @SyncActionID;

IF OBJECT_ID('[${mjSchema}].[Action]', 'U') IS NOT NULL
    DELETE FROM [${mjSchema}].[Action] WHERE ID = @SyncActionID;
GO

-- Sales.DealLinker registration. The table lives in Common; the ROW is sales'.
-- Skip when Common's Activity Sync migration has not been applied on this host.
IF OBJECT_ID('[__mj_BizAppsCommon].[ActivitySyncExtension]', 'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM [__mj_BizAppsCommon].[ActivitySyncExtension]
         WHERE ID = 'A7C4E2B1-5D83-4F0A-9C1E-6B8D2F4A90C3'
   )
BEGIN
    INSERT INTO [__mj_BizAppsCommon].[ActivitySyncExtension] (
        ID, Name, Description, DriverClass, Sequence, FailurePolicy, TimeoutMS, IsEnabled
    ) VALUES (
        'A7C4E2B1-5D83-4F0A-9C1E-6B8D2F4A90C3',
        N'Sales.DealLinker',
        N'Inside the Activity write transaction, link matched open deals as Regarding. DealMatcher stays in sales; Common never learns what a deal is.',
        N'Sales.DealLinker',
        10,
        N'Skip',
        5000,
        1
    );
END
GO
