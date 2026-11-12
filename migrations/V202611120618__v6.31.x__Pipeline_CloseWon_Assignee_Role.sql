-- =============================================================================
-- Pipeline: the MJ role close-won tasks are routed to (bc-aidp-next-golive#442).
-- =============================================================================
-- A deal closed Won raises an Order Review task, and on a B2B pipeline a Contract
-- Processing task. CloseWonAssigneePersonID routes them to one person. Finance
-- asked for a shared queue instead: every holder of a finance role sees the task
-- and is notified of it.
--
-- A task assignment is polymorphic (entity + record), so the task can be
-- assigned to the role itself: AssigneeEntity = MJ: Roles, AssigneeRecord = the
-- role's ID. The tasks app expands a role assignee to the role's current members
-- when it lists and notifies, so someone who joins the role later still sees the
-- open tasks.
--
-- A COLUMN, NOT THE POLICY JSON, for the reason CloseWonAssigneePersonID is one
-- (bc-aidp-next-golive#326): a metadata push writes the shipped CloseWonPolicy back
-- over the database, so an assignee typed into the JSON lasts until the next
-- install. This column is not in the metadata files, and its foreign key refuses
-- a role that is not there.
--
-- NOT THE SAME AS CloseWonTasks.AssigneeRoleID in the policy. That one is the
-- TaskRole the assignee holds on the task (Primary, Reviewer, Observer); this one
-- is the MJ role that IS the assignee.
--
-- NULLABLE. When both this and CloseWonAssigneePersonID are set, the person wins.
-- When neither is set, the policy JSON's assignee is used, and when that is empty
-- the tasks are created but not assigned.
-- =============================================================================

ALTER TABLE [${flyway:defaultSchema}].[Pipeline]
    ADD CloseWonAssigneeRoleID UNIQUEIDENTIFIER NULL
            CONSTRAINT FK_Pipeline_CloseWonAssigneeRole
                FOREIGN KEY REFERENCES [${mjSchema}].[Role] (ID);
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Role whose members all receive the Order Review and Contract Processing tasks raised when a deal on this pipeline closes Won: the task is assigned to the role, and everyone who holds it sees it and is notified. Set per deployment; the app''s metadata never sets it, so an upgrade keeps it. Close Won Assignee (a person) takes precedence when both are set. Empty, with no person, means CloseWonTasks.AssigneeRecordID in Close Won Policy is used, and when that is empty too the tasks are created but not assigned.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Pipeline',
    @level2type = N'COLUMN', @level2name = N'CloseWonAssigneeRoleID';
GO



-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================

/* SQL text to insert 1 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'c4a1a7e3-f222-4d37-9dc4-409bca411c4f' OR (EntityID = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND Name = 'CloseWonAssigneeRoleID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'c4a1a7e3-f222-4d37-9dc4-409bca411c4f',
            'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', -- Entity: MJ_BizApps_Sales: Pipelines
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2'),
            'CloseWonAssigneeRoleID',
            'Close Won Assignee Role ID',
            'Role whose members all receive the Order Review and Contract Processing tasks raised when a deal on this pipeline closes Won: the task is assigned to the role, and everyone who holds it sees it and is notified. Set per deployment; the app''s metadata never sets it, so an upgrade keeps it. Close Won Assignee (a person) takes precedence when both are set. Empty, with no person, means CloseWonTasks.AssigneeRecordID in Close Won Policy is used, and when that is empty too the tasks are created but not assigned.',
            'uniqueidentifier',
            16,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            'DA238F34-2837-EF11-86D4-6045BDEE16E6',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;


/* Create Entity Relationship: MJ: Roles -> MJ_BizApps_Sales: Pipelines (One To Many via CloseWonAssigneeRoleID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'f002bfe6-6fa5-475f-bfbc-21d3bf51fa44'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('f002bfe6-6fa5-475f-bfbc-21d3bf51fa44', 'DA238F34-2837-EF11-86D4-6045BDEE16E6', 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', 'CloseWonAssigneeRoleID', 'One To Many', 1, 1, 20, GETUTCDATE(), GETUTCDATE())
   END;

/* Index for Foreign Keys for Pipeline */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Pipelines
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key DealTypeID in table Pipeline
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Pipeline_DealTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Pipeline]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Pipeline_DealTypeID ON [${flyway:defaultSchema}].[Pipeline] ([DealTypeID]);

-- Index for foreign key DefaultForecastCategoryTypeID in table Pipeline
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Pipeline_DefaultForecastCategoryTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Pipeline]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Pipeline_DefaultForecastCategoryTypeID ON [${flyway:defaultSchema}].[Pipeline] ([DefaultForecastCategoryTypeID]);

-- Index for foreign key CloseWonAssigneePersonID in table Pipeline
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Pipeline_CloseWonAssigneePersonID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Pipeline]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Pipeline_CloseWonAssigneePersonID ON [${flyway:defaultSchema}].[Pipeline] ([CloseWonAssigneePersonID]);

-- Index for foreign key CloseWonAssigneeRoleID in table Pipeline
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Pipeline_CloseWonAssigneeRoleID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Pipeline]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Pipeline_CloseWonAssigneeRoleID ON [${flyway:defaultSchema}].[Pipeline] ([CloseWonAssigneeRoleID]);

/* SQL text to update entity field related entity name field map for entity field ID C4A1A7E3-F222-4D37-9DC4-409BCA411C4F */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='C4A1A7E3-F222-4D37-9DC4-409BCA411C4F', @RelatedEntityNameFieldMap='CloseWonAssigneeRole';

/* Base View SQL for MJ_BizApps_Sales: Pipelines */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Pipelines
-- Item: vwPipelines
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Pipelines
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  Pipeline
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwPipelines]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwPipelines];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwPipelines]
AS
SELECT
    p.*,
    mjBizAppsSalesDealType_DealTypeID.[Name] AS [DealType],
    mjBizAppsSalesForecastCategoryType_DefaultForecastCategoryTypeID.[Name] AS [DefaultForecastCategoryType],
    mjBizAppsCommonPerson_CloseWonAssigneePersonID.[DisplayName] AS [CloseWonAssigneePerson],
    MJRole_CloseWonAssigneeRoleID.[Name] AS [CloseWonAssigneeRole]
FROM
    [${flyway:defaultSchema}].[Pipeline] AS p
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[DealType] AS mjBizAppsSalesDealType_DealTypeID
  ON
    [p].[DealTypeID] = mjBizAppsSalesDealType_DealTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[ForecastCategoryType] AS mjBizAppsSalesForecastCategoryType_DefaultForecastCategoryTypeID
  ON
    [p].[DefaultForecastCategoryTypeID] = mjBizAppsSalesForecastCategoryType_DefaultForecastCategoryTypeID.[ID]
LEFT OUTER JOIN
    [${mjSchema}_BizAppsCommon].[Person] AS mjBizAppsCommonPerson_CloseWonAssigneePersonID
  ON
    [p].[CloseWonAssigneePersonID] = mjBizAppsCommonPerson_CloseWonAssigneePersonID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[Role] AS MJRole_CloseWonAssigneeRoleID
  ON
    [p].[CloseWonAssigneeRoleID] = MJRole_CloseWonAssigneeRoleID.[ID]
GO
REVOKE SELECT ON [${flyway:defaultSchema}].[vwPipelines] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwPipelines] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwPipelines] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwPipelines] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Sales: Pipelines */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Pipelines
-- Item: Permissions for vwPipelines
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

REVOKE SELECT ON [${flyway:defaultSchema}].[vwPipelines] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwPipelines] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwPipelines] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwPipelines] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Sales: Pipelines */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Pipelines
-- Item: spCreatePipeline
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR Pipeline
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreatePipeline]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreatePipeline];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreatePipeline]
    @ID uniqueidentifier = NULL,
    @Name nvarchar(200),
    @Code nvarchar(40),
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @DealTypeID_Clear bit = 0,
    @DealTypeID uniqueidentifier = NULL,
    @DefaultForecastCategoryTypeID_Clear bit = 0,
    @DefaultForecastCategoryTypeID uniqueidentifier = NULL,
    @RequiresDealLines bit = NULL,
    @CloseWonPolicy_Clear bit = 0,
    @CloseWonPolicy nvarchar(MAX) = NULL,
    @IsDefault bit = NULL,
    @DisplayRank int = NULL,
    @IsActive bit = NULL,
    @IncludeInForecast bit = NULL,
    @CloseWonAssigneePersonID_Clear bit = 0,
    @CloseWonAssigneePersonID uniqueidentifier = NULL,
    @CloseWonAssigneeRoleID_Clear bit = 0,
    @CloseWonAssigneeRoleID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[Pipeline]
            (
                [ID],
                [Name],
                [Code],
                [Description],
                [DealTypeID],
                [DefaultForecastCategoryTypeID],
                [RequiresDealLines],
                [CloseWonPolicy],
                [IsDefault],
                [DisplayRank],
                [IsActive],
                [IncludeInForecast],
                [CloseWonAssigneePersonID],
                [CloseWonAssigneeRoleID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @Name,
                @Code,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                CASE WHEN @DealTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealTypeID, NULL) END,
                CASE WHEN @DefaultForecastCategoryTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DefaultForecastCategoryTypeID, NULL) END,
                ISNULL(@RequiresDealLines, 1),
                CASE WHEN @CloseWonPolicy_Clear = 1 THEN NULL ELSE ISNULL(@CloseWonPolicy, NULL) END,
                ISNULL(@IsDefault, 0),
                ISNULL(@DisplayRank, 0),
                ISNULL(@IsActive, 1),
                ISNULL(@IncludeInForecast, 1),
                CASE WHEN @CloseWonAssigneePersonID_Clear = 1 THEN NULL ELSE ISNULL(@CloseWonAssigneePersonID, NULL) END,
                CASE WHEN @CloseWonAssigneeRoleID_Clear = 1 THEN NULL ELSE ISNULL(@CloseWonAssigneeRoleID, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[Pipeline]
            (
                [Name],
                [Code],
                [Description],
                [DealTypeID],
                [DefaultForecastCategoryTypeID],
                [RequiresDealLines],
                [CloseWonPolicy],
                [IsDefault],
                [DisplayRank],
                [IsActive],
                [IncludeInForecast],
                [CloseWonAssigneePersonID],
                [CloseWonAssigneeRoleID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @Name,
                @Code,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                CASE WHEN @DealTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealTypeID, NULL) END,
                CASE WHEN @DefaultForecastCategoryTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DefaultForecastCategoryTypeID, NULL) END,
                ISNULL(@RequiresDealLines, 1),
                CASE WHEN @CloseWonPolicy_Clear = 1 THEN NULL ELSE ISNULL(@CloseWonPolicy, NULL) END,
                ISNULL(@IsDefault, 0),
                ISNULL(@DisplayRank, 0),
                ISNULL(@IsActive, 1),
                ISNULL(@IncludeInForecast, 1),
                CASE WHEN @CloseWonAssigneePersonID_Clear = 1 THEN NULL ELSE ISNULL(@CloseWonAssigneePersonID, NULL) END,
                CASE WHEN @CloseWonAssigneeRoleID_Clear = 1 THEN NULL ELSE ISNULL(@CloseWonAssigneeRoleID, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwPipelines] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreatePipeline] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreatePipeline] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreatePipeline] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Sales: Pipelines */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreatePipeline] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreatePipeline] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreatePipeline] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Sales: Pipelines */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Pipelines
-- Item: spUpdatePipeline
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR Pipeline
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdatePipeline]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdatePipeline];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdatePipeline]
    @ID uniqueidentifier,
    @Name nvarchar(200) = NULL,
    @Code nvarchar(40) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @DealTypeID_Clear bit = 0,
    @DealTypeID uniqueidentifier = NULL,
    @DefaultForecastCategoryTypeID_Clear bit = 0,
    @DefaultForecastCategoryTypeID uniqueidentifier = NULL,
    @RequiresDealLines bit = NULL,
    @CloseWonPolicy_Clear bit = 0,
    @CloseWonPolicy nvarchar(MAX) = NULL,
    @IsDefault bit = NULL,
    @DisplayRank int = NULL,
    @IsActive bit = NULL,
    @IncludeInForecast bit = NULL,
    @CloseWonAssigneePersonID_Clear bit = 0,
    @CloseWonAssigneePersonID uniqueidentifier = NULL,
    @CloseWonAssigneeRoleID_Clear bit = 0,
    @CloseWonAssigneeRoleID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[Pipeline]
    SET
        [Name] = ISNULL(@Name, [Name]),
        [Code] = ISNULL(@Code, [Code]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [DealTypeID] = CASE WHEN @DealTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealTypeID, [DealTypeID]) END,
        [DefaultForecastCategoryTypeID] = CASE WHEN @DefaultForecastCategoryTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DefaultForecastCategoryTypeID, [DefaultForecastCategoryTypeID]) END,
        [RequiresDealLines] = ISNULL(@RequiresDealLines, [RequiresDealLines]),
        [CloseWonPolicy] = CASE WHEN @CloseWonPolicy_Clear = 1 THEN NULL ELSE ISNULL(@CloseWonPolicy, [CloseWonPolicy]) END,
        [IsDefault] = ISNULL(@IsDefault, [IsDefault]),
        [DisplayRank] = ISNULL(@DisplayRank, [DisplayRank]),
        [IsActive] = ISNULL(@IsActive, [IsActive]),
        [IncludeInForecast] = ISNULL(@IncludeInForecast, [IncludeInForecast]),
        [CloseWonAssigneePersonID] = CASE WHEN @CloseWonAssigneePersonID_Clear = 1 THEN NULL ELSE ISNULL(@CloseWonAssigneePersonID, [CloseWonAssigneePersonID]) END,
        [CloseWonAssigneeRoleID] = CASE WHEN @CloseWonAssigneeRoleID_Clear = 1 THEN NULL ELSE ISNULL(@CloseWonAssigneeRoleID, [CloseWonAssigneeRoleID]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwPipelines] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwPipelines]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdatePipeline] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdatePipeline] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdatePipeline] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the Pipeline table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdatePipeline]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdatePipeline];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdatePipeline
ON [${flyway:defaultSchema}].[Pipeline]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[Pipeline]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[Pipeline] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Sales: Pipelines */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdatePipeline] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdatePipeline] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdatePipeline] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Sales: Pipelines */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Pipelines
-- Item: spDeletePipeline
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR Pipeline
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeletePipeline]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeletePipeline];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeletePipeline]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[Pipeline]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeletePipeline] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeletePipeline] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeletePipeline] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Sales: Pipelines */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeletePipeline] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeletePipeline] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeletePipeline] TO [cdp_Developer], [cdp_Integration];

/* SQL text to insert 1 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '6c8e03ba-5fc7-438f-a229-3ecd21321abb' OR (EntityID = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND Name = 'CloseWonAssigneeRole')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '6c8e03ba-5fc7-438f-a229-3ecd21321abb',
            'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', -- Entity: MJ_BizApps_Sales: Pipelines
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2'),
            'CloseWonAssigneeRole',
            'Close Won Assignee Role',
            NULL,
            'nvarchar',
            100,
            0,
            0,
            1,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

/* Set categories for 3 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.CloseWonAssigneeRoleID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Automation & Policies',
   GeneratedFormSection = 'Category',
   DisplayName = 'Close Won Assignee Role'
WHERE 
   ID = 'C4A1A7E3-F222-4D37-9DC4-409BCA411C4F';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.CloseWonAssigneeRole 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Automation & Policies',
   GeneratedFormSection = 'Category',
   DisplayName = 'Close Won Assignee Role Name'
WHERE 
   ID = '6C8E03BA-5FC7-438F-A229-3ECD21321ABB';

