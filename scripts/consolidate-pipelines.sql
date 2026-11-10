/*
  consolidate-pipelines.sql — run every deal on ONE pipeline, for a site that turns on Hide pipelines.

  WHAT IT DOES, in one transaction:
    1. Maps each stage of every other pipeline to a stage of the target pipeline: same Code, else same
       Name (case-insensitive), else, for a closed stage, the target's stage with the same deal status
       (Won to Won, Lost to Lost). Stops, changing nothing, if a stage that holds deals has no match.
    2. Copies Deal (ID, PipelineID, PipelineStageID), Pipeline and PipelineCompany into backup tables
       named with today's date, so the move can be undone.
    3. Links the target pipeline to every company (MJ: Companies), and reactivates a retired link to it.
    4. Makes the target the only IsDefault pipeline.
    5. Moves every deal on another pipeline to the target and its mapped stage.
    6. Retires every other pipeline (IsActive = 0, IncludeInForecast = 0) and its company links.

  WHAT IT LEAVES ALONE:
    - DealStageEvent: the stage history keeps the stages the deal really moved through. Retired stages
      stay in the database, so that history still resolves.
    - ForecastSnapshot: snapshots stay on the pipeline they were taken for; the forecast history query
      reads retired pipelines.
    - Each deal's status, probability, forecast category, amounts and dates.
    - Closed deals are locked against app saves. This script writes them directly, which is why it is a
      reviewed, one-time script with a backup rather than an action.

  HOW TO RUN. Dry run first (Apply=0 rolls everything back and prints what it would do):
    sqlcmd -S <host>,<port> -d <db> -U <user> -P <pw> -C -I -b \
      -v TargetPipelineID="<pipeline id>" Apply=0 -i scripts/consolidate-pipelines.sql
  Then the same with Apply=1. Afterwards RESTART MJAPI: pipelines and links are cached in memory, and
  rows written by SQL never reach that cache.

  UNDO (after Apply=1), from the backup tables this run printed:
    UPDATE d SET PipelineID = b.PipelineID, PipelineStageID = b.PipelineStageID
      FROM __mj_BizAppsSales.Deal d JOIN __mj_BizAppsSales.<Deal backup> b ON b.ID = d.ID;
    and restore Pipeline (IsDefault, IsActive, IncludeInForecast) and PipelineCompany (IsActive) the
    same way; delete PipelineCompany rows whose ID is not in the PipelineCompany backup.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Target UNIQUEIDENTIFIER = '$(TargetPipelineID)';
DECLARE @Apply BIT = $(Apply);
DECLARE @Stamp NVARCHAR(8) = CONVERT(NVARCHAR(8), SYSUTCDATETIME(), 112);
DECLARE @sql NVARCHAR(MAX);

IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Pipeline WHERE ID = @Target AND IsActive = 1)
BEGIN
    RAISERROR('Target pipeline %s does not exist or is not active.', 16, 1, '$(TargetPipelineID)');
    RETURN;
END;

BEGIN TRANSACTION;

/* 1. Stage map ------------------------------------------------------------------------------------ */
SELECT
    s.ID AS FromStageID,
    s.PipelineID AS FromPipelineID,
    COALESCE(byCode.ID, byName.ID, byStatus.ID) AS ToStageID,
    CASE WHEN byCode.ID IS NOT NULL THEN 'code' WHEN byName.ID IS NOT NULL THEN 'name' WHEN byStatus.ID IS NOT NULL THEN 'status' END AS MatchedBy,
    (SELECT COUNT(*) FROM __mj_BizAppsSales.Deal d WHERE d.PipelineStageID = s.ID) AS Deals
INTO #StageMap
FROM __mj_BizAppsSales.PipelineStage s
OUTER APPLY (SELECT TOP 1 t.ID FROM __mj_BizAppsSales.PipelineStage t
             WHERE t.PipelineID = @Target AND t.Code = s.Code ORDER BY t.DisplayOrder) byCode
OUTER APPLY (SELECT TOP 1 t.ID FROM __mj_BizAppsSales.PipelineStage t
             WHERE t.PipelineID = @Target AND LOWER(t.Name) = LOWER(s.Name) ORDER BY t.DisplayOrder) byName
OUTER APPLY (SELECT TOP 1 t.ID FROM __mj_BizAppsSales.PipelineStage t
             JOIN __mj_BizAppsSales.DealStatusType st ON st.ID = s.DealStatusTypeID AND st.IsClosed = 1
             WHERE t.PipelineID = @Target AND t.DealStatusTypeID = s.DealStatusTypeID ORDER BY t.DisplayOrder) byStatus
WHERE s.PipelineID <> @Target;

PRINT 'Stage map (stages that hold deals):';
SELECT p.Name AS FromPipeline, f.Name AS FromStage, f.Code AS FromCode, t.Name AS ToStage, m.MatchedBy, m.Deals
FROM #StageMap m
JOIN __mj_BizAppsSales.PipelineStage f ON f.ID = m.FromStageID
JOIN __mj_BizAppsSales.Pipeline p ON p.ID = m.FromPipelineID
LEFT JOIN __mj_BizAppsSales.PipelineStage t ON t.ID = m.ToStageID
WHERE m.Deals > 0
ORDER BY p.DisplayRank, p.Name, f.DisplayOrder;

-- A deal on another pipeline with no stage, or on a stage that does not belong to its pipeline.
DECLARE @Stray INT = (SELECT COUNT(*) FROM __mj_BizAppsSales.Deal d
                      LEFT JOIN __mj_BizAppsSales.PipelineStage s ON s.ID = d.PipelineStageID
                      WHERE d.PipelineID <> @Target AND (s.ID IS NULL OR s.PipelineID <> d.PipelineID));
DECLARE @Unmapped INT = (SELECT COUNT(*) FROM #StageMap WHERE ToStageID IS NULL AND Deals > 0);
IF @Unmapped > 0 OR @Stray > 0
BEGIN
    PRINT 'STOPPED: stages holding deals with no match, or deals whose stage is not on their pipeline. Nothing changed.';
    SELECT p.Name AS Pipeline, s.Name AS Stage, s.Code, m.Deals
    FROM #StageMap m
    JOIN __mj_BizAppsSales.PipelineStage s ON s.ID = m.FromStageID
    JOIN __mj_BizAppsSales.Pipeline p ON p.ID = m.FromPipelineID
    WHERE m.ToStageID IS NULL AND m.Deals > 0;
    SELECT @Stray AS DealsWithStageOffTheirPipeline;
    ROLLBACK;
    RETURN;
END;

/* 2. Backups -------------------------------------------------------------------------------------- */
DECLARE @DealBackup SYSNAME = 'Deal_PipelineBackup_' + @Stamp;
DECLARE @PipelineBackup SYSNAME = 'Pipeline_Backup_' + @Stamp;
DECLARE @LinkBackup SYSNAME = 'PipelineCompany_Backup_' + @Stamp;
IF @Apply = 1
BEGIN
    SET @sql = N'SELECT ID, PipelineID, PipelineStageID INTO __mj_BizAppsSales.' + QUOTENAME(@DealBackup) + N' FROM __mj_BizAppsSales.Deal;
                 SELECT ID, IsDefault, IsActive, IncludeInForecast INTO __mj_BizAppsSales.' + QUOTENAME(@PipelineBackup) + N' FROM __mj_BizAppsSales.Pipeline;
                 SELECT ID, PipelineID, CompanyID, IsActive INTO __mj_BizAppsSales.' + QUOTENAME(@LinkBackup) + N' FROM __mj_BizAppsSales.PipelineCompany;';
    EXEC sp_executesql @sql;
    PRINT 'Backups: __mj_BizAppsSales.' + @DealBackup + ', ' + @PipelineBackup + ', ' + @LinkBackup;
END;

/* 3. Link the target to every company ------------------------------------------------------------- */
UPDATE __mj_BizAppsSales.PipelineCompany SET IsActive = 1 WHERE PipelineID = @Target AND IsActive = 0;
PRINT CONCAT('Links reactivated: ', @@ROWCOUNT);

-- Inserted after the existing links, so the company the target was first linked to stays the company
-- a new deal starts in (the app reads links oldest first).
INSERT INTO __mj_BizAppsSales.PipelineCompany (ID, PipelineID, CompanyID, IsActive)
SELECT NEWID(), @Target, c.ID, 1
FROM __mj.Company c
WHERE NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.PipelineCompany pc WHERE pc.PipelineID = @Target AND pc.CompanyID = c.ID);
PRINT CONCAT('Companies linked: ', @@ROWCOUNT);

/* 4. One default ---------------------------------------------------------------------------------- */
UPDATE __mj_BizAppsSales.Pipeline SET IsDefault = CASE WHEN ID = @Target THEN 1 ELSE 0 END
WHERE IsDefault <> CASE WHEN ID = @Target THEN 1 ELSE 0 END;
PRINT CONCAT('Pipelines whose IsDefault changed: ', @@ROWCOUNT);

/* 5. Move the deals ------------------------------------------------------------------------------- */
UPDATE d SET PipelineID = @Target, PipelineStageID = m.ToStageID
FROM __mj_BizAppsSales.Deal d
JOIN #StageMap m ON m.FromStageID = d.PipelineStageID
WHERE d.PipelineID <> @Target;
PRINT CONCAT('Deals moved: ', @@ROWCOUNT);

/* 6. Retire the rest ------------------------------------------------------------------------------ */
UPDATE __mj_BizAppsSales.Pipeline SET IsActive = 0, IncludeInForecast = 0
WHERE ID <> @Target AND (IsActive = 1 OR IncludeInForecast = 1);
PRINT CONCAT('Pipelines retired: ', @@ROWCOUNT);

UPDATE __mj_BizAppsSales.PipelineCompany SET IsActive = 0 WHERE PipelineID <> @Target AND IsActive = 1;
PRINT CONCAT('Other pipelines'' links retired: ', @@ROWCOUNT);

/* Check ------------------------------------------------------------------------------------------- */
SELECT
    (SELECT COUNT(*) FROM __mj_BizAppsSales.Deal WHERE PipelineID <> @Target) AS DealsElsewhere,
    (SELECT COUNT(*) FROM __mj_BizAppsSales.Deal d JOIN __mj_BizAppsSales.PipelineStage s ON s.ID = d.PipelineStageID
      WHERE s.PipelineID <> d.PipelineID) AS DealsOnForeignStage,
    (SELECT COUNT(*) FROM __mj.Company c WHERE NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.PipelineCompany pc
      WHERE pc.PipelineID = @Target AND pc.CompanyID = c.ID AND pc.IsActive = 1)) AS CompaniesNotLinked,
    (SELECT COUNT(*) FROM __mj_BizAppsSales.Pipeline WHERE IsActive = 1) AS ActivePipelines;

IF @Apply = 1
BEGIN
    COMMIT;
    PRINT 'APPLIED. Restart MJAPI so its cached pipelines and links are re-read.';
END
ELSE
BEGIN
    ROLLBACK;
    PRINT 'DRY RUN: rolled back. Run again with Apply=1 to keep the changes.';
END;
