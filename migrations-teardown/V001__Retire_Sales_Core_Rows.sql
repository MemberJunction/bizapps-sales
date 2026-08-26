-- =============================================================================================
-- BizApps Sales teardown -- retire this app's rows from the shared core schema on `mj app remove`
-- =============================================================================================
-- SCOPE. Dropping `__mj_BizAppsSales` reclaims everything Sales owns in its OWN schema, and
-- `mj app remove` separately walks the foreign-key graph out from this app's `__mj.Entity` rows
-- (RemoveAppEntityMetadata) and retires app-owned Applications and SchemaInfo. Neither reaches the
-- metadata-seed payload: the actions, queries, remote operations, scheduled jobs and task types
-- that `V202608251930__v5.2.x__Metadata_Sync.sql` writes into `__mj` and into bizapps-tasks'
-- schema. Without this file they survive a remove, and the next install re-INSERTs the same fixed
-- UUIDs and fails on a primary-key collision. That is the whole reason the file exists.
--
-- WHAT IS LISTED BELOW IS ONLY THE ROOTS -- 28 rows, the ones the seed creates that nothing else
-- creates. Their children are NOT listed, because listing them is what breaks: a static delete
-- list only orders rows the SEED made, while a real installation also holds runtime children
-- (action execution logs, scheduled-job runs, query permissions, tasks) that a pristine canary
-- database does not. bizapps-caliber shipped the static version first and had 11 of its deletes
-- blocked on a used database while passing cleanly on a fresh one. The engine below is ported from
-- `bizapps-forms/migrations-teardown/V001__Retire_Forms_Core_Rows.sql`, itself ported from
-- caliber's; the lessons in its comments were paid for there, not rediscovered here.
--
-- ── THE ROW THAT IS DELIBERATELY NOT HERE ────────────────────────────────────────────────────
--
-- `__mj.Company` 'Default Company' (C0DEFA17-0000-4000-A000-000000000001) is seeded by this app
-- and is NOT retired by it. Thirty NOT NULL foreign keys point at `Company` across MJ core,
-- bizapps-accounting and bizapps-orders -- `Employee.CompanyID`, `OrderHeader.CompanyID`,
-- `JournalEntry.CompanyID`, `GLAccount.CompanyID` among them -- and the metadata that seeds the
-- row explicitly invites a deployment to rename it and use it for real. Retiring it would
-- therefore let `mj app remove bizapps-sales` delete a deployment's employees, orders and ledger.
-- Removing an app must not be able to do that. The cost is one placeholder row left behind, and
-- the seed migration carries an `IF NOT EXISTS` guard on that one create so a reinstall still
-- works. That guard and this paragraph are two halves of one decision -- change neither alone.
--
-- ── HOW IT DECIDES ───────────────────────────────────────────────────────────────────────────
-- Dependents are discovered from `sys.foreign_keys` AT APPLY TIME:
--   • a NULLABLE reference is set to NULL -- that row belongs to the customer and merely points at
--     ours; deleting their record because it referenced our Action would destroy data that is not
--     ours to destroy;
--   • a NOT NULL reference is deleted and joins the doomed set, because a row that cannot exist
--     without its parent is meaningless once the parent is gone;
--   • a reference from OUR OWN schema is deleted whatever its column says, because
--     `mj app remove` runs this file BEFORE it drops `__mj_BizAppsSales` (HandleTeardown, then
--     DropAppSchema), so our rows are still there and still pointing at the rows we are retiring.
--
-- CONSEQUENCES WORTH STATING PLAINLY, because both remove rows a deployment created:
--   • The two seeded bizapps-tasks task types ('Order Review', 'Contract Processing') are retired,
--     and `__mj_BizAppsTasks.Task.TypeID` is NOT NULL -- so every task of those types goes with
--     them, along with their `TaskTypeStatus` rows. Those are the follow-ups Sales' close flow
--     creates; a task whose type no longer exists cannot be opened, so this is correct, but it is
--     work-tracking data rather than configuration.
--   • Retiring the three Actions dooms their `ActionExecutionLog` rows (NOT NULL), which is the
--     history of when they ran.
-- The plan is printed before it executes, which is the only reason either is discoverable at the
-- moment it happens rather than afterwards.
--
-- RUNTIME. MJ executes this file as ONE statement inside ONE transaction and rolls everything back
-- on error, so there is no `GO` here and no partial application. Exactly one placeholder is
-- substituted at teardown time: `${mjSchema}`. The app-schema placeholder used by regular
-- migrations is NOT substituted here and must never appear.
-- =============================================================================================

CREATE TABLE #SalesDoomed (
    SchemaName sysname NOT NULL,
    TableName  sysname NOT NULL,
    RowID      UNIQUEIDENTIFIER NOT NULL,
    Depth      INT NOT NULL,
    PRIMARY KEY (TableName, RowID)
);

INSERT INTO #SalesDoomed (SchemaName, TableName, RowID, Depth) VALUES
    -- Actions (ActionParam.ActionID is NOT NULL, so the 8 params follow automatically) and their
    -- category. ActionCategory's own dependents are all nullable, so nothing else is dragged in.
    ('${mjSchema}', 'Action',                  '5A1E5000-0000-4000-8000-000000000101', 0),  -- Sync Activities
    ('${mjSchema}', 'Action',                  '5A1E5000-0000-4000-8000-000000000111', 0),  -- Capture Forecast Snapshot
    ('${mjSchema}', 'Action',                  '5A1E5000-0000-4000-8000-000000000121', 0),  -- Log Activity
    ('${mjSchema}', 'ActionCategory',          '5A1E5000-0000-4000-8000-000000000001', 0),  -- Sales
    -- The Sales application. ApplicationEntity / ApplicationRole / UserApplication are NOT NULL
    -- children and follow automatically.
    ('${mjSchema}', 'Application',             'D4F8A162-A001-4E71-B0A8-3F17C5E2D803', 0),  -- Sales
    -- The 15 reporting queries. QueryEntity / QueryField / QueryParameter / QuerySQL /
    -- QueryPermission / QueryDependency all carry NOT NULL QueryID and follow automatically --
    -- 327 child rows on a fresh install, none of which is listed here for that reason.
    ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-000000000001', 0),  -- Sales: Pipeline Summary
    ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-000000000002', 0),  -- Sales: Forecast by Category
    ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-000000000003', 0),  -- Sales: Bookings by Period
    ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-000000000004', 0),  -- Sales: Win Rate by Count and Value
    ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-000000000005', 0),  -- Sales: Deal Cycle Time
    ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-000000000006', 0),  -- Sales: Stage Conversion and Dwell
    ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-000000000007', 0),  -- Sales: Slipped Deals
    ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-000000000008', 0),  -- Sales: Bookings by Owner
    ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-000000000009', 0),  -- Sales: Deal Involvement by Rep
    ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-00000000000A', 0),  -- Sales: Product Mix and Discount Depth
    ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-00000000000B', 0),  -- Sales: Deal Type Mix
    ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-00000000000C', 0),  -- Sales: Forecast History
    ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-00000000000D', 0),  -- Sales: Deal Roster
    ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-00000000000E', 0),  -- Sales: Dashboard Summary
    ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-00000000000F', 0),  -- Sales: Forecast by Owner
    ('${mjSchema}', 'QueryCategory',           '5A1E5000-0000-4000-A000-000000000001', 0),  -- Sales
    -- Remote operations. `RemoteOperation.CategoryID` is nullable, so the category is listed
    -- explicitly rather than left to a cascade that would only release the reference.
    ('${mjSchema}', 'RemoteOperation',         'D4F8A162-0002-4E71-B0A8-3F17C5E2D802', 0),  -- Close Deal
    ('${mjSchema}', 'RemoteOperation',         'D4F8A162-0003-4E71-B0A8-3F17C5E2D802', 0),  -- Reopen Deal
    ('${mjSchema}', 'RemoteOperationCategory', 'D4F8A162-9C35-4E71-B0A8-3F17C5E2D801', 0),  -- Deal Lifecycle
    -- Scheduled jobs. `ScheduledJobRun.ScheduledJobID` is NOT NULL, so the run history follows.
    ('${mjSchema}', 'ScheduledJob',            '5A1E5000-0000-4000-8000-000000000201', 0),  -- Sales -- Activity Sync (hourly)
    ('${mjSchema}', 'ScheduledJob',            '5A1E5000-0000-4000-8000-000000000202', 0),  -- Sales -- Forecast Snapshot (daily)
    -- bizapps-tasks task types. NOT in our schema and not in core -- the seed reaches into a
    -- SIBLING app's schema, which is why that schema appears in the walk below. See the
    -- consequence noted in the header: `Task.TypeID` is NOT NULL.
    ('__mj_BizAppsTasks', 'TaskType',          '87ACA0BD-2FF6-493D-99B0-469D41825D1C', 0),  -- Order Review
    ('__mj_BizAppsTasks', 'TaskType',          '890C23F2-39D6-4075-8BA7-EC742A2D1CA8', 0);  -- Contract Processing

-- MJ's own AtomicBatchScript sets this, and for the same reason: with XACT_ABORT OFF an error
-- inside EXEC sp_executesql does NOT abort the batch, so the loop would keep issuing destructive
-- statements against an already-doomed transaction.
SET XACT_ABORT ON;

-- ── The engine ────────────────────────────────────────────────────────────────────────────────
-- Discovers dependents from the catalog at apply time rather than trusting a build-time ordering.
-- Bounded, and it fails loudly rather than half-finishing.

DECLARE @pass INT = 0;
DECLARE @MAX_PASSES INT = 25;
DECLARE @changed INT = 1;

WHILE @changed > 0 AND @pass < @MAX_PASSES
BEGIN
    SET @pass += 1;
    SET @changed = 0;

    DECLARE @childSchema sysname, @childTable sysname, @childCol sysname,
            @parentTable sysname, @isNullable BIT, @sql NVARCHAR(MAX);

    DECLARE fk_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT DISTINCT SCHEMA_NAME(pt.schema_id), pt.name, pc.name, rt.name,
               -- EFFECTIVE nullability, not declared nullability. A row in OUR OWN schema is
               -- doomed whatever its column says, so it takes the delete branch below.
               CASE WHEN SCHEMA_NAME(pt.schema_id) = '__mj_BizAppsSales' THEN CAST(0 AS BIT)
                    ELSE pc.is_nullable END
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
        JOIN sys.tables  pt ON pt.object_id = fk.parent_object_id
        JOIN sys.columns pc ON pc.object_id = pt.object_id AND pc.column_id = fkc.parent_column_id
        JOIN sys.tables  rt ON rt.object_id = fk.referenced_object_id
        JOIN sys.columns rc ON rc.object_id = rt.object_id AND rc.column_id = fkc.referenced_column_id
        WHERE SCHEMA_NAME(rt.schema_id) IN ('${mjSchema}', '__mj_BizAppsSales', '__mj_BizAppsTasks')
          AND rc.name = 'ID'
          -- Single-column constraints only -- see the note on the levelling query.
          AND (SELECT COUNT(*) FROM sys.foreign_key_columns c2
               WHERE c2.constraint_object_id = fk.object_id) = 1
          -- Matched on SCHEMA **and** name. Matching on name alone is a live hazard here: the walk
          -- spans three schemas, and `TaskType` exists in both `__mj` and `__mj_BizAppsTasks` in
          -- any database that has this app installed, since bizapps-tasks is a hard dependency.
          -- Dooming one must not drag in the other.
          AND EXISTS (SELECT 1 FROM #SalesDoomed d
                       WHERE d.TableName = rt.name
                         AND d.SchemaName = SCHEMA_NAME(rt.schema_id));

    OPEN fk_cursor;
    FETCH NEXT FROM fk_cursor INTO @childSchema, @childTable, @childCol, @parentTable, @isNullable;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF @isNullable = 1
        BEGIN
            -- Someone else's row that merely points at ours. Release the reference, keep the row.
            SET @sql = N'UPDATE c SET c.[' + @childCol + N'] = NULL
                         FROM [' + @childSchema + N'].[' + @childTable + N'] c
                         WHERE c.[' + @childCol + N'] IN (SELECT RowID FROM #SalesDoomed WHERE TableName = @p)';
            EXEC sp_executesql @sql, N'@p sysname', @p = @parentTable;
            SET @changed += @@ROWCOUNT;
        END
        ELSE
        BEGIN
            -- Cannot exist without the parent, so it is doomed too.
            SET @sql = N'INSERT INTO #SalesDoomed (SchemaName, TableName, RowID, Depth)
                         SELECT ''' + @childSchema + N''', ''' + @childTable + N''', c.[ID], @pass
                         FROM [' + @childSchema + N'].[' + @childTable + N'] c
                         WHERE c.[' + @childCol + N'] IN (SELECT RowID FROM #SalesDoomed WHERE TableName = @p)
                           AND NOT EXISTS (SELECT 1 FROM #SalesDoomed d
                                           WHERE d.TableName = ''' + @childTable + N''' AND d.RowID = c.[ID])';
            EXEC sp_executesql @sql, N'@p sysname, @pass INT', @p = @parentTable, @pass = @pass;
            SET @changed += @@ROWCOUNT;
        END

        FETCH NEXT FROM fk_cursor INTO @childSchema, @childTable, @childCol, @parentTable, @isNullable;
    END
    CLOSE fk_cursor;
    DEALLOCATE fk_cursor;
END

IF @pass >= @MAX_PASSES AND @changed > 0
    THROW 51103, 'BizApps Sales teardown did not converge: the dependency graph is deeper than MAX_PASSES. Nothing has been committed.', 1;

-- ── Order the deletes by the FK graph, not by discovery order ─────────────────────────────────
-- Discovery depth is NOT a topological order: two tables can be discovered in the same pass from
-- different parents and still be parent and child of each other (caliber hit exactly this with
-- MagicLinkInvite reached from Role and MagicLinkInviteApplication reached from Application).
--
-- So compute a real level: a table sits one above every doomed table it references, and deletes
-- run highest level first. Relaxation is bounded; a non-nullable cycle would otherwise spin.
-- Keyed on SCHEMA + NAME, not name alone, for the `TaskType` reason given above.
CREATE TABLE #SalesLevel (SchemaName sysname NOT NULL, TableName sysname NOT NULL, Lvl INT NOT NULL, PRIMARY KEY (SchemaName, TableName));

INSERT INTO #SalesLevel (SchemaName, TableName, Lvl)
SELECT DISTINCT SchemaName, TableName, 0 FROM #SalesDoomed;

DECLARE @relax INT = 0;
DECLARE @MAX_RELAX INT = 50;
DECLARE @moved INT = 1;

WHILE @moved > 0 AND @relax < @MAX_RELAX
BEGIN
    SET @relax += 1;

    UPDATE child
    SET child.Lvl = parent.Lvl + 1
    FROM #SalesLevel child
    JOIN (
        SELECT DISTINCT
               SCHEMA_NAME(pt.schema_id) AS ChildSchema, pt.name AS ChildTable,
               SCHEMA_NAME(rt.schema_id) AS ParentSchema, rt.name AS ParentTable
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
        JOIN sys.tables  pt ON pt.object_id = fk.parent_object_id
        JOIN sys.columns pc ON pc.object_id = pt.object_id AND pc.column_id = fkc.parent_column_id
        JOIN sys.tables  rt ON rt.object_id = fk.referenced_object_id
        JOIN sys.columns rc ON rc.object_id = rt.object_id AND rc.column_id = fkc.referenced_column_id
        WHERE rc.name = 'ID'
          -- Same EFFECTIVE nullability rule as the discovery cursor. Without the own-schema arm
          -- here a doomed own-schema row would carry no level edge to the core row it points at,
          -- and the highest-level-first delete could run the parent first -- the exact FK failure
          -- this ordering pass exists to prevent.
          AND (pc.is_nullable = 0 OR SCHEMA_NAME(pt.schema_id) = '__mj_BizAppsSales')
          AND SCHEMA_NAME(rt.schema_id) IN ('${mjSchema}', '__mj_BizAppsSales', '__mj_BizAppsTasks')
          -- Single-column constraints only. MJ's EnumerateMjEntityFkGraph skips composites for the
          -- same reason: treating one column of a composite key as a standalone edge would null
          -- half a key or match a child on a partial reference.
          AND (SELECT COUNT(*) FROM sys.foreign_key_columns c2
               WHERE c2.constraint_object_id = fk.object_id) = 1
          AND NOT (pt.object_id = rt.object_id)
    ) edge ON edge.ChildTable = child.TableName AND edge.ChildSchema = child.SchemaName
    JOIN #SalesLevel parent ON parent.TableName = edge.ParentTable AND parent.SchemaName = edge.ParentSchema
    WHERE child.Lvl <= parent.Lvl;

    SET @moved = @@ROWCOUNT;
END

IF @moved > 0
    THROW 51105, 'BizApps Sales teardown could not order its deletes within MAX_RELAX passes: either a non-nullable foreign-key CYCLE among the doomed tables, or a dependency chain deeper than the bound. Nothing has been committed.', 1;

-- Announce the plan before executing it. MJ's own teardown prints what it is about to remove; an
-- unrecallable delete of "what your system did" should be announced rather than discovered.
-- RAISERROR(...,0,1) WITH NOWAIT so it streams immediately.
DECLARE @planLine NVARCHAR(400);
DECLARE plan_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT CONCAT('  delete ', d.SchemaName, '.', d.TableName, ' x', COUNT(*))
    FROM #SalesDoomed d GROUP BY d.SchemaName, d.TableName ORDER BY COUNT(*) DESC;
RAISERROR('BizApps Sales teardown plan (rows to remove from the shared core schema):', 0, 1) WITH NOWAIT;
OPEN plan_cursor;
FETCH NEXT FROM plan_cursor INTO @planLine;
WHILE @@FETCH_STATUS = 0
BEGIN
    RAISERROR(@planLine, 0, 1) WITH NOWAIT;
    FETCH NEXT FROM plan_cursor INTO @planLine;
END
CLOSE plan_cursor; DEALLOCATE plan_cursor;

DECLARE @lvl INT = (SELECT MAX(Lvl) FROM #SalesLevel);
WHILE @lvl >= 0
BEGIN
    DECLARE @delSchema sysname, @delTable sysname, @delSql NVARCHAR(MAX);
    DECLARE del_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT SchemaName, TableName FROM #SalesLevel WHERE Lvl = @lvl;
    OPEN del_cursor;
    FETCH NEXT FROM del_cursor INTO @delSchema, @delTable;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- Joined on SchemaName as well as TableName: identical GUIDs in two same-named tables in
        -- two schemas is not a shape to bet against in a multi-Open-App database.
        SET @delSql = N'DELETE t FROM [' + @delSchema + N'].[' + @delTable + N'] t
                        JOIN #SalesDoomed d ON d.RowID = t.[ID]
                        WHERE d.TableName = @t AND d.SchemaName = @s';
        EXEC sp_executesql @delSql, N'@t sysname, @s sysname', @t = @delTable, @s = @delSchema;
        FETCH NEXT FROM del_cursor INTO @delSchema, @delTable;
    END
    CLOSE del_cursor;
    DEALLOCATE del_cursor;
    SET @lvl -= 1;
END

-- Postcondition: every seeded root is gone. A teardown that reports success while leaving rows
-- behind is the failure this design exists to prevent, so it is asserted rather than assumed.
DECLARE @remaining INT = 0;
DECLARE @chkSchema sysname, @chkTable sysname, @chkSql NVARCHAR(MAX), @chkCount INT;
DECLARE chk_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT DISTINCT SchemaName, TableName FROM #SalesDoomed WHERE Depth = 0;
OPEN chk_cursor;
FETCH NEXT FROM chk_cursor INTO @chkSchema, @chkTable;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @chkSql = N'SELECT @c = COUNT(*) FROM [' + @chkSchema + N'].[' + @chkTable + N'] t
                    JOIN #SalesDoomed d ON d.RowID = t.[ID]
                    WHERE d.TableName = @t AND d.SchemaName = @s';
    EXEC sp_executesql @chkSql, N'@t sysname, @s sysname, @c INT OUTPUT', @t = @chkTable, @s = @chkSchema, @c = @chkCount OUTPUT;
    SET @remaining += ISNULL(@chkCount, 0);
    FETCH NEXT FROM chk_cursor INTO @chkSchema, @chkTable;
END
CLOSE chk_cursor;
DEALLOCATE chk_cursor;

IF @remaining > 0
    THROW 51104, 'BizApps Sales teardown finished with seeded rows still present. Nothing has been committed.', 1;

-- Unreachable on the THROW paths above, deliberately: MJ runs this inside a transaction and rolls
-- back on any error, and a ROLLBACK drops temp tables created inside it. Kept for the success path
-- because MJ can run several teardown files on the SAME connection in the SAME transaction.
DROP TABLE #SalesDoomed;
DROP TABLE #SalesLevel;
