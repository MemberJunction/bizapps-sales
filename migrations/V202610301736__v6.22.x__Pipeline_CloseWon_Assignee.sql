-- =============================================================================
-- Pipeline: the person close-won tasks are routed to (bc-aidp-next-golive#326).
-- =============================================================================
-- A deal closed Won raises an Order Review task, and on a B2B pipeline a Contract
-- Processing task. Until now the person they go to was set only inside the
-- pipeline's CloseWonPolicy JSON (CloseWonTasks.AssigneeRecordID). That has two
-- faults:
--
-- IT DOES NOT SURVIVE AN UPGRADE. The two default pipelines ship as rows in
-- metadata/pipelines, and a metadata push writes the file's values back over the
-- database. The file ships the assignee as null, because who reviews orders differs
-- per deployment. So an assignee a deployment set inside the JSON is reset to null
-- on the next install of this app, and close-won tasks stop being routed again.
-- This column is not in the metadata files, so a push never touches it.
--
-- NOTHING REFUSES A PERSON WHO IS NOT THERE. The JSON value is free text, and
-- TaskAssignment.AssigneeRecordID is polymorphic, so a mistyped or demo-only id
-- was accepted and produced tasks assigned to nobody. A foreign key to Person
-- refuses that id when the pipeline is saved, not when a deal closes.
--
-- NULLABLE. Empty means the pipeline falls back to the JSON value, and when that is
-- empty too, the close reports the tasks as not routed.
-- =============================================================================

ALTER TABLE [${flyway:defaultSchema}].[Pipeline]
    ADD CloseWonAssigneePersonID UNIQUEIDENTIFIER NULL
            CONSTRAINT FK_Pipeline_CloseWonAssigneePerson
                FOREIGN KEY REFERENCES [__mj_BizAppsCommon].[Person] (ID);
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Person who receives the Order Review and Contract Processing tasks raised when a deal on this pipeline closes Won. Set per deployment; the app''s metadata never sets it, so an upgrade keeps it. Takes precedence over CloseWonTasks.AssigneeRecordID in Close Won Policy. Empty means that policy value is used, and when both are empty the tasks are created but not assigned.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Pipeline',
    @level2type = N'COLUMN', @level2name = N'CloseWonAssigneePersonID';
GO



-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================

/* SQL text to insert 1 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '7492f4ec-a889-4cc7-9082-29652da221f4' OR (EntityID = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND Name = 'CloseWonAssigneePersonID')) BEGIN
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
            '7492f4ec-a889-4cc7-9082-29652da221f4',
            'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', -- Entity: MJ_BizApps_Sales: Pipelines
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2'),
            'CloseWonAssigneePersonID',
            'Close Won Assignee Person ID',
            'Person who receives the Order Review and Contract Processing tasks raised when a deal on this pipeline closes Won. Set per deployment; the app''s metadata never sets it, so an upgrade keeps it. Takes precedence over CloseWonTasks.AssigneeRecordID in Close Won Policy. Empty means that policy value is used, and when both are empty the tasks are created but not assigned.',
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
            '7A94ADA9-7880-4FAE-97D8-DB0E934C3F5F',
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


/* Create Entity Relationship: MJ_BizApps_Common: People -> MJ_BizApps_Sales: Pipelines (One To Many via CloseWonAssigneePersonID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '4fdf1cd9-f274-45a5-9d2e-478de4632402'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('4fdf1cd9-f274-45a5-9d2e-478de4632402', '7A94ADA9-7880-4FAE-97D8-DB0E934C3F5F', 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', 'CloseWonAssigneePersonID', 'One To Many', 1, 1, 30, GETUTCDATE(), GETUTCDATE())
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
-- Index for foreign key CompanyID in table Pipeline
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Pipeline_CompanyID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Pipeline]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Pipeline_CompanyID ON [${flyway:defaultSchema}].[Pipeline] ([CompanyID]);

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

/* SQL text to update entity field related entity name field map for entity field ID 7492F4EC-A889-4CC7-9082-29652DA221F4 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='7492F4EC-A889-4CC7-9082-29652DA221F4', @RelatedEntityNameFieldMap='CloseWonAssigneePerson';

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
    MJCompany_CompanyID.[Name] AS [Company],
    mjBizAppsSalesDealType_DealTypeID.[Name] AS [DealType],
    mjBizAppsSalesForecastCategoryType_DefaultForecastCategoryTypeID.[Name] AS [DefaultForecastCategoryType],
    mjBizAppsCommonPerson_CloseWonAssigneePersonID.[DisplayName] AS [CloseWonAssigneePerson]
FROM
    [${flyway:defaultSchema}].[Pipeline] AS p
INNER JOIN
    [${mjSchema}].[Company] AS MJCompany_CompanyID
  ON
    [p].[CompanyID] = MJCompany_CompanyID.[ID]
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
    @CompanyID uniqueidentifier,
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
    @CloseWonAssigneePersonID uniqueidentifier = NULL
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
                [CompanyID],
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
                [CloseWonAssigneePersonID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @CompanyID,
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
                CASE WHEN @CloseWonAssigneePersonID_Clear = 1 THEN NULL ELSE ISNULL(@CloseWonAssigneePersonID, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[Pipeline]
            (
                [CompanyID],
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
                [CloseWonAssigneePersonID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @CompanyID,
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
                CASE WHEN @CloseWonAssigneePersonID_Clear = 1 THEN NULL ELSE ISNULL(@CloseWonAssigneePersonID, NULL) END
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
    @CompanyID uniqueidentifier = NULL,
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
    @CloseWonAssigneePersonID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[Pipeline]
    SET
        [CompanyID] = ISNULL(@CompanyID, [CompanyID]),
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
        [CloseWonAssigneePersonID] = CASE WHEN @CloseWonAssigneePersonID_Clear = 1 THEN NULL ELSE ISNULL(@CloseWonAssigneePersonID, [CloseWonAssigneePersonID]) END
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e5aef597-9a1d-41c5-983c-5f93386a8582' OR (EntityID = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND Name = 'CloseWonAssigneePerson')) BEGIN
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
            'e5aef597-9a1d-41c5-983c-5f93386a8582',
            'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', -- Entity: MJ_BizApps_Sales: Pipelines
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2'),
            'CloseWonAssigneePerson',
            'Close Won Assignee Person',
            NULL,
            'nvarchar',
            500,
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

/* Set categories for 20 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.ID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '84FBEAAC-5A75-47C3-A025-5A4A7589A62D';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.CompanyID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Pipeline Details',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '168D7BE1-2F44-4C5F-8D83-EBA34C62D775';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.Company 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Pipeline Details',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'EB8B1206-AC94-42A8-8013-A41EDE97FF62';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.Name 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Pipeline Details',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '92DA7E6E-7C0A-4D59-BC13-3FAA763E8D1A';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.Code 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Pipeline Details',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '755B44AE-CB92-4A62-9C79-93594846FD30';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.Description 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Pipeline Details',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '791C6A66-E771-45A2-AE31-D92972B1A6A0';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.IsDefault 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Pipeline Details',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'D873428B-249D-4782-89CC-206B4C563544';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.DisplayRank 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Pipeline Details',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '34E8CDD3-FEDE-4227-B454-99274637739E';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.IsActive 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Pipeline Details',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '7AFBF3D3-7442-4440-8552-D3D98384D38C';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.DealTypeID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Deal & Forecast Settings',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'FD9BD0BD-1DE1-43AC-8508-059304F8B362';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.DealType 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Deal & Forecast Settings',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'F91BAE13-1A8D-4127-AA8D-8B73EEE098F5';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.DefaultForecastCategoryTypeID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Deal & Forecast Settings',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '66FD46A6-1AAF-4DD2-A4B0-F1B6B5C9D9D2';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.DefaultForecastCategoryType 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Deal & Forecast Settings',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '35FED923-E812-4B72-92EE-F83B61401616';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.RequiresDealLines 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Deal & Forecast Settings',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'C613CB1E-4C10-4839-A34E-468F1E6959BE';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.IncludeInForecast 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Deal & Forecast Settings',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'A7DBE8B8-5CE6-4D97-AA83-3D60853F864D';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.CloseWonPolicy 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Automation & Policies',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'CDD765D8-6BA2-45F4-AB5F-7F27E3C84E23';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.CloseWonAssigneePersonID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Automation & Policies',
   GeneratedFormSection = 'Category',
   DisplayName = 'Close Won Assignee'
WHERE 
   ID = '7492F4EC-A889-4CC7-9082-29652DA221F4';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.CloseWonAssigneePerson 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Automation & Policies',
   GeneratedFormSection = 'Category',
   DisplayName = 'Close Won Assignee Name'
WHERE 
   ID = 'E5AEF597-9A1D-41C5-983C-5F93386A8582';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.__mj_CreatedAt 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '63F172BE-7B6B-4D58-832B-AFE8D54B6287';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.__mj_UpdatedAt 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '4C25231A-E258-4429-BE8E-504941823EBE';

/* Set entity icon to fa fa-project-diagram */

               UPDATE [${mjSchema}].[Entity]
               SET [Icon] = 'fa fa-project-diagram', [__mj_UpdatedAt] = GETUTCDATE()
               WHERE [ID] = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2';

/* Insert FieldCategoryInfo setting for entity */
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntitySetting] WHERE [EntityID] = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND [Name] = 'FieldCategoryInfo'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntitySetting] ([ID], [EntityID], [Name], [Value], [__mj_CreatedAt], [__mj_UpdatedAt])
               VALUES ('d0549c7f-14b5-51e1-be9e-2141b86b40ee', 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', 'FieldCategoryInfo', '{
  "Automation & Policies": {
    "description": "Policies and automation rules triggered when a deal is marked as won",
    "icon": "fa fa-robot"
  },
  "Deal & Forecast Settings": {
    "description": "Settings governing deal types, forecasting behavior, and pricing structure",
    "icon": "fa fa-chart-line"
  },
  "Pipeline Details": {
    "description": "Core identification and configuration settings for the pipeline",
    "icon": "fa fa-project-diagram"
  },
  "System Metadata": {
    "description": "System-managed audit and tracking fields",
    "icon": "fa fa-cog"
  }
}', GETUTCDATE(), GETUTCDATE())
   END;

/* Insert FieldCategoryIcons setting (legacy) */
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntitySetting] WHERE [EntityID] = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND [Name] = 'FieldCategoryIcons'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntitySetting] ([ID], [EntityID], [Name], [Value], [__mj_CreatedAt], [__mj_UpdatedAt])
               VALUES ('98f7bf3e-dce6-5ad2-9898-f0a5ce7d09df', 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', 'FieldCategoryIcons', '{
  "Automation & Policies": "fa fa-robot",
  "Deal & Forecast Settings": "fa fa-chart-line",
  "Pipeline Details": "fa fa-project-diagram",
  "System Metadata": "fa fa-cog"
}', GETUTCDATE(), GETUTCDATE())
   END;

