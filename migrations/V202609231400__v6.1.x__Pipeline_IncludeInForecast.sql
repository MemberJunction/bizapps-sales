-- =============================================================================
-- Pipeline.IncludeInForecast — whether a pipeline's OPEN deals count toward the
-- current book: open and weighted pipeline, the forecast buckets, and the
-- dashboard's open-deal figures.
-- =============================================================================
-- WHY A FLAG AND NOT IsActive. A pipeline that holds historical deals — a container
-- for records converted from another system, say — still has to be visible: its deals
-- are real, people open them, and the board must be able to show it. IsActive already
-- means "offered and shown", and overloading it to also mean "not forecast" would force
-- a choice between hiding real records and double-counting them. The two questions get
-- two columns.
--
-- WHAT IT DOES NOT TOUCH. Closed history. A won deal in an excluded pipeline is still a
-- booking and still counts toward win rate, bookings, cycle time, stage conversion and
-- the Closed/Won figures. Only OPEN deals are left out, because only an open deal can be
-- counted twice in the current book.
--
-- DEFAULT 1, so every existing pipeline keeps today's behaviour until someone says
-- otherwise. The flag is data, per this app's rule that behaviour lives in flags rather
-- than in names: no query may recognise a pipeline by its name or code.
-- =============================================================================

ALTER TABLE [${flyway:defaultSchema}].[Pipeline]
    ADD IncludeInForecast BIT NOT NULL
        CONSTRAINT DF_Pipeline_IncludeInForecast DEFAULT 1;
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Whether open deals in this pipeline count toward open and weighted pipeline, the forecast buckets and the dashboard''s open-deal figures. Set to 0 for a pipeline that only holds historical deals. Closed deals count toward bookings, win rate and other history regardless.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Pipeline',
    @level2type = N'COLUMN', @level2name = N'IncludeInForecast';
GO

-- vwPipelines is `SELECT p.*`, and SQL Server fixes a view's column list when the view is created.
-- The CodeGen block below resequences Pipeline's fields from that view before it recreates it, so
-- without this refresh the new column is missing from the view, a lookup column takes its sequence,
-- and the EntityField insert fails on UQ_EntityField_EntityID_Sequence on a fresh install.
EXEC sp_refreshview '[${flyway:defaultSchema}].[vwPipelines]';
GO


















































-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================

/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 2 new entity field(s) */
UPDATE [${mjSchema}].[EntityField]
         SET [Sequence] = [Sequence] + 100000
       WHERE [EntityID] = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2'
         AND [Sequence] < 100000
         AND NOT EXISTS (
             SELECT 1 FROM [${mjSchema}].[EntityField]
              WHERE [EntityID] = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2'
                AND [Sequence] >= 100000
         );

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a7dbe8b8-5ce6-4d97-aa83-3d60853f864d' OR (EntityID = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND Name = 'IncludeInForecast')) BEGIN
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
            'a7dbe8b8-5ce6-4d97-aa83-3d60853f864d',
            'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', -- Entity: MJ_BizApps_Sales: Pipelines
            15,
            'IncludeInForecast',
            'Include In Forecast',
            'Whether open deals in this pipeline count toward open and weighted pipeline, the forecast buckets and the dashboard''s open-deal figures. Set to 0 for a pipeline that only holds historical deals. Closed deals count toward bookings, win rate and other history regardless.',
            'bit',
            1,
            1,
            0,
            0,
            '(1)',
            0,
            1,
            0,
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

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Set soft FK for ${flyway:defaultSchema}.Deal.CurrencyID → Currency.ID */
UPDATE [${mjSchema}].[EntityField]
                                SET [__mj_UpdatedAt]=GETUTCDATE(),
                                    [RelatedEntityID] = 'D3329BE1-541B-4918-B1CB-3D7A0454EBA7',
                                    [RelatedEntityFieldName] = 'ID',
                                    [IsSoftForeignKey] = 1
                                WHERE [EntityID] = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND [Name] = 'CurrencyID';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

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
    mjBizAppsSalesForecastCategoryType_DefaultForecastCategoryTypeID.[Name] AS [DefaultForecastCategoryType]
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
GO
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
    @IncludeInForecast bit = NULL
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
                [IncludeInForecast]
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
                ISNULL(@IncludeInForecast, 1)
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
                [IncludeInForecast]
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
                ISNULL(@IncludeInForecast, 1)
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwPipelines] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreatePipeline] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Sales: Pipelines */

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
    @IncludeInForecast bit = NULL
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
        [IncludeInForecast] = ISNULL(@IncludeInForecast, [IncludeInForecast])
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
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeletePipeline] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Sales: Pipelines */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeletePipeline] TO [cdp_Developer], [cdp_Integration];

/* SQL text to delete unneeded entity fields (1 scoped entities) */
EXEC [${mjSchema}].[spDeleteUnneededEntityFields] @ExcludedSchemaNames='', @EntityIDs='F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to update existing entity fields from schema (1 scoped entities) */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Set soft FK for ${flyway:defaultSchema}.Deal.CurrencyID → Currency.ID */
UPDATE [${mjSchema}].[EntityField]
                                SET [__mj_UpdatedAt]=GETUTCDATE(),
                                    [RelatedEntityID] = 'D3329BE1-541B-4918-B1CB-3D7A0454EBA7',
                                    [RelatedEntityFieldName] = 'ID',
                                    [IsSoftForeignKey] = 1
                                WHERE [EntityID] = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND [Name] = 'CurrencyID';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

