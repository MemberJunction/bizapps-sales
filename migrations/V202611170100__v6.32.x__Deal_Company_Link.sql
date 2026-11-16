-- =============================================================================
-- DealCompany — the companies a deal involves (golive #484).
-- =============================================================================
-- A deal carries one company column, Deal.CompanyID, and it is also the order's
-- company: it picks the invoice issuer, the Bill.com connection, the contract
-- company, the time zone and the forecast grain. A deal that sells products from
-- several companies had nowhere to record "these are the companies involved", so
-- the product picker and the filter bar could only see the one.
--
-- Deal.CompanyID STAYS, unchanged, as the selling (billing) company. It must be one
-- of the deal's companies; DealEntityServer adds it to this list on save, together
-- with the company of every line on the deal's order, so the list never omits a
-- company the deal is already selling for.
--
-- STRONGLY TYPED, like PipelineCompany: both sides are real foreign keys. No
-- IsActive column: the list is the deal's current set, and removing a company
-- removes its row. Nothing else points at a DealCompany row.
--
-- THE BACKFILL gives every existing deal a row for its company plus one for each
-- distinct company on its order's lines. UNION removes the duplicates.
-- =============================================================================

CREATE TABLE [${flyway:defaultSchema}].[DealCompany] (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    DealID UNIQUEIDENTIFIER NOT NULL,
    CompanyID UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT PK_DealCompany PRIMARY KEY (ID),
    CONSTRAINT UQ_DealCompany_Deal_Company UNIQUE (DealID, CompanyID),
    CONSTRAINT FK_DealCompany_Deal FOREIGN KEY (DealID)
        REFERENCES [${flyway:defaultSchema}].[Deal] (ID),
    CONSTRAINT FK_DealCompany_Company FOREIGN KEY (CompanyID)
        REFERENCES [${mjSchema}].[Company] (ID)
);
GO

INSERT INTO [${flyway:defaultSchema}].[DealCompany] (DealID, CompanyID)
SELECT d.ID, d.CompanyID
FROM [${flyway:defaultSchema}].[Deal] d
UNION
SELECT d.ID, ol.CompanyID
FROM [${flyway:defaultSchema}].[Deal] d
JOIN [__mj_BizAppsOrders].[OrderLine] ol ON ol.OrderHeaderID = d.OrderID;
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'A company involved in a deal. A deal can involve several companies; the deal''s own company (the billing company) is always one of them, and so is the company of every product on the deal.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealCompany';
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'The deal.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealCompany',
    @level2type = N'COLUMN', @level2name = N'DealID';
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'A company the deal involves. The product picker offers this company''s products, and the deal matches a filter on this company.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealCompany',
    @level2type = N'COLUMN', @level2name = N'CompanyID';
GO


















































-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================
/* SQL generated to create new entity MJ_BizApps_Sales: Deal Companies */

      INSERT INTO [${mjSchema}].[Entity] (
         [ID],
         [Name],
         [DisplayName],
         [Description],
         [NameSuffix],
         [BaseTable],
         [BaseView],
         [SchemaName],
         [IncludeInAPI],
         [AllowUserSearchAPI],
         [AllowCaching],
         [TrackRecordChanges],
         [AuditRecordAccess],
         [AuditViewRuns],
         [AllowAllRowsAPI],
         [AllowCreateAPI],
         [AllowUpdateAPI],
         [AllowDeleteAPI],
         [UserViewMaxRows]
         , [__mj_CreatedAt]
         , [__mj_UpdatedAt]
      )
      VALUES (
         'e9f916ef-3f17-4bd8-854e-0faedf692e5e',
         'MJ_BizApps_Sales: Deal Companies',
         'Deal Companies',
         'A company involved in a deal. A deal can involve several companies; the deal''s own company (the billing company) is always one of them, and so is the company of every product on the deal.',
         NULL,
         'DealCompany',
         'vwDealCompanies',
         '${flyway:defaultSchema}',
         1,
         1,
         0,
         1,
         0,
         0,
         0,
         1,
         1,
         1,
         1000
         , GETUTCDATE()
         , GETUTCDATE()
      );

/* SQL generated to add entity MJ_BizApps_Sales: Deal Companies to application ID: '60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                    ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                    ('60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D', 'e9f916ef-3f17-4bd8-854e-0faedf692e5e', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Deal Companies for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('e9f916ef-3f17-4bd8-854e-0faedf692e5e' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('e9f916ef-3f17-4bd8-854e-0faedf692e5e' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Deal Companies for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('e9f916ef-3f17-4bd8-854e-0faedf692e5e' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('e9f916ef-3f17-4bd8-854e-0faedf692e5e' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Deal Companies for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('e9f916ef-3f17-4bd8-854e-0faedf692e5e' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('e9f916ef-3f17-4bd8-854e-0faedf692e5e' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.DealCompany */
ALTER TABLE [${flyway:defaultSchema}].[DealCompany] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.DealCompany */
UPDATE [${flyway:defaultSchema}].[DealCompany] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.DealCompany */
ALTER TABLE [${flyway:defaultSchema}].[DealCompany] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.DealCompany */
ALTER TABLE [${flyway:defaultSchema}].[DealCompany] ADD CONSTRAINT [DF___mj_BizAppsSales_DealCompany___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.DealCompany */
ALTER TABLE [${flyway:defaultSchema}].[DealCompany] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.DealCompany */
UPDATE [${flyway:defaultSchema}].[DealCompany] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.DealCompany */
ALTER TABLE [${flyway:defaultSchema}].[DealCompany] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.DealCompany */
ALTER TABLE [${flyway:defaultSchema}].[DealCompany] ADD CONSTRAINT [DF___mj_BizAppsSales_DealCompany___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to insert 5 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a52a8019-9af7-409f-ba18-d53bfe41ed17' OR (EntityID = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND Name = 'ID')) BEGIN
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
            'a52a8019-9af7-409f-ba18-d53bfe41ed17',
            'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', -- Entity: MJ_BizApps_Sales: Deal Companies
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E'),
            'ID',
            'ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            'newsequentialid()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            1,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'cc38ea5d-182e-4add-bbd1-36aa2ca08728' OR (EntityID = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND Name = 'DealID')) BEGIN
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
            'cc38ea5d-182e-4add-bbd1-36aa2ca08728',
            'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', -- Entity: MJ_BizApps_Sales: Deal Companies
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E'),
            'DealID',
            'Deal ID',
            'The deal.',
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            '79148DE5-7F99-44AC-ACD4-5EE7BA93D354',
            'ID',
            0,
            0,
            1,
            0,
            0,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'd1799b22-adc4-40e7-9f96-47c102c1fa95' OR (EntityID = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND Name = 'CompanyID')) BEGIN
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
            'd1799b22-adc4-40e7-9f96-47c102c1fa95',
            'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', -- Entity: MJ_BizApps_Sales: Deal Companies
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E'),
            'CompanyID',
            'Company ID',
            'A company the deal involves. The product picker offers this company''s products, and the deal matches a filter on this company.',
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            'D4238F34-2837-EF11-86D4-6045BDEE16E6',
            'ID',
            0,
            0,
            1,
            0,
            0,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e47b9d02-2649-40dd-a18a-9e613b1e89db' OR (EntityID = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND Name = '__mj_CreatedAt')) BEGIN
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
            'e47b9d02-2649-40dd-a18a-9e613b1e89db',
            'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', -- Entity: MJ_BizApps_Sales: Deal Companies
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E'),
            '__mj_CreatedAt',
            'Created At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'ab3c0505-b385-4b46-99a5-d747379b67a9' OR (EntityID = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND Name = '__mj_UpdatedAt')) BEGIN
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
            'ab3c0505-b385-4b46-99a5-d747379b67a9',
            'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', -- Entity: MJ_BizApps_Sales: Deal Companies
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E'),
            '__mj_UpdatedAt',
            'Updated At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

/* Deterministic search-flag hygiene — clear AllowUserSearchAPI */

         UPDATE [${mjSchema}].[Entity]
         SET [AllowUserSearchAPI] = 0
         WHERE [ID] IN (
            SELECT e.[ID]
            FROM [${mjSchema}].[Entity] e
            WHERE e.[AllowUserSearchAPI] = 1
              AND e.[AutoUpdateAllowUserSearchAPI] = 1
              AND e.[VirtualEntity] = 0
              AND ISNULL(e.[FullTextSearchEnabled], 0) = 0
              AND e.[SchemaName] NOT IN ('${mjSchema}','__mj_BizAppsAccounting','__mj_BizAppsCommon','__mj_BizAppsContracts','__mj_BizAppsOrders','__mj_BizAppsTasks','sys')
              AND NOT EXISTS (
               SELECT 1 FROM [${mjSchema}].[EntityField] f2
               WHERE f2.[EntityID] = e.[ID]
                 AND f2.[IncludeInUserSearchAPI] = 1
            )
         );


/* Create Entity Relationship: MJ_BizApps_Sales: Deals -> MJ_BizApps_Sales: Deal Companies (One To Many via DealID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'b6c7e675-cad7-475c-9524-beb72ca24808' OR ([EntityID] = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND [RelatedEntityID] = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND [RelatedEntityJoinField] = 'DealID')
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('b6c7e675-cad7-475c-9524-beb72ca24808', '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', 'DealID', 'One To Many', 1, 1, 5, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ: Companies -> MJ_BizApps_Sales: Deal Companies (One To Many via CompanyID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '845cff3d-d3f8-4642-b003-4a88969ba77a' OR ([EntityID] = 'D4238F34-2837-EF11-86D4-6045BDEE16E6' AND [RelatedEntityID] = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND [RelatedEntityJoinField] = 'CompanyID')
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('845cff3d-d3f8-4642-b003-4a88969ba77a', 'D4238F34-2837-EF11-86D4-6045BDEE16E6', 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', 'CompanyID', 'One To Many', 1, 1, 43, GETUTCDATE(), GETUTCDATE())
   END;

/* Index for Foreign Keys for DealCompany */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Companies
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key DealID in table DealCompany
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_DealCompany_DealID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[DealCompany]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_DealCompany_DealID ON [${flyway:defaultSchema}].[DealCompany] ([DealID]);

-- Index for foreign key CompanyID in table DealCompany
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_DealCompany_CompanyID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[DealCompany]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_DealCompany_CompanyID ON [${flyway:defaultSchema}].[DealCompany] ([CompanyID]);

/* SQL text to update entity field related entity name field map for entity field ID CC38EA5D-182E-4ADD-BBD1-36AA2CA08728 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='CC38EA5D-182E-4ADD-BBD1-36AA2CA08728', @RelatedEntityNameFieldMap='Deal';

/* SQL text to update entity field related entity name field map for entity field ID D1799B22-ADC4-40E7-9F96-47C102C1FA95 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='D1799B22-ADC4-40E7-9F96-47C102C1FA95', @RelatedEntityNameFieldMap='Company';

/* Base View SQL for MJ_BizApps_Sales: Deal Companies */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Companies
-- Item: vwDealCompanies
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Deal Companies
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  DealCompany
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwDealCompanies]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwDealCompanies];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwDealCompanies]
AS
SELECT
    d.*,
    mjBizAppsSalesDeal_DealID.[Name] AS [Deal],
    MJCompany_CompanyID.[Name] AS [Company]
FROM
    [${flyway:defaultSchema}].[DealCompany] AS d
INNER JOIN
    [${flyway:defaultSchema}].[Deal] AS mjBizAppsSalesDeal_DealID
  ON
    [d].[DealID] = mjBizAppsSalesDeal_DealID.[ID]
INNER JOIN
    [${mjSchema}].[Company] AS MJCompany_CompanyID
  ON
    [d].[CompanyID] = MJCompany_CompanyID.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwDealCompanies] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Sales: Deal Companies */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Companies
-- Item: Permissions for vwDealCompanies
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwDealCompanies] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Sales: Deal Companies */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Companies
-- Item: spCreateDealCompany
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR DealCompany
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateDealCompany]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateDealCompany];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateDealCompany]
    @ID uniqueidentifier = NULL,
    @DealID uniqueidentifier,
    @CompanyID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[DealCompany]
            (
                [ID],
                [DealID],
                [CompanyID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @DealID,
                @CompanyID
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[DealCompany]
            (
                [DealID],
                [CompanyID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @DealID,
                @CompanyID
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwDealCompanies] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateDealCompany] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Sales: Deal Companies */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateDealCompany] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Sales: Deal Companies */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Companies
-- Item: spUpdateDealCompany
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR DealCompany
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateDealCompany]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateDealCompany];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateDealCompany]
    @ID uniqueidentifier,
    @DealID uniqueidentifier = NULL,
    @CompanyID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[DealCompany]
    SET
        [DealID] = ISNULL(@DealID, [DealID]),
        [CompanyID] = ISNULL(@CompanyID, [CompanyID])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwDealCompanies] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwDealCompanies]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDealCompany] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the DealCompany table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateDealCompany]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateDealCompany];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateDealCompany
ON [${flyway:defaultSchema}].[DealCompany]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[DealCompany]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[DealCompany] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Sales: Deal Companies */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDealCompany] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Sales: Deal Companies */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Companies
-- Item: spDeleteDealCompany
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR DealCompany
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteDealCompany]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteDealCompany];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteDealCompany]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[DealCompany]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteDealCompany] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Sales: Deal Companies */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteDealCompany] TO [cdp_Developer], [cdp_Integration];

/* SQL text to insert 2 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3812143b-fbf1-45cc-be85-8d80e2f33f74' OR (EntityID = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND Name = 'Deal')) BEGIN
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
            '3812143b-fbf1-45cc-be85-8d80e2f33f74',
            'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', -- Entity: MJ_BizApps_Sales: Deal Companies
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E'),
            'Deal',
            'Deal',
            NULL,
            'nvarchar',
            1000,
            0,
            0,
            0,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'aa6601cd-4ab8-43fe-ad8c-1135a9be3189' OR (EntityID = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND Name = 'Company')) BEGIN
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
            'aa6601cd-4ab8-43fe-ad8c-1135a9be3189',
            'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', -- Entity: MJ_BizApps_Sales: Deal Companies
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E'),
            'Company',
            'Company',
            NULL,
            'nvarchar',
            100,
            0,
            0,
            0,
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

/* Set field properties for entity */

               UPDATE [${mjSchema}].[EntityField]
               SET DefaultInView = 1
               WHERE ID = '3812143B-FBF1-45CC-BE85-8D80E2F33F74'
               AND AutoUpdateDefaultInView = 1;

               UPDATE [${mjSchema}].[EntityField]
               SET DefaultInView = 1
               WHERE ID = 'AA6601CD-4AB8-43FE-AD8C-1135A9BE3189'
               AND AutoUpdateDefaultInView = 1;

               UPDATE [${mjSchema}].[EntityField]
               SET IncludeInUserSearchAPI = 1
               WHERE ID = 'AA6601CD-4AB8-43FE-AD8C-1135A9BE3189'
               AND AutoUpdateIncludeInUserSearchAPI = 1;

               UPDATE [${mjSchema}].[EntityField]
               SET UserSearchPredicateAPI = 'BeginsWith'
               WHERE ID = 'AA6601CD-4AB8-43FE-AD8C-1135A9BE3189'
               AND AutoUpdateUserSearchPredicate = 1;

/* Set categories for 7 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Companies.ID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'A52A8019-9AF7-409F-BA18-D53BFE41ED17';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Companies.DealID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Deal Company Association',
   GeneratedFormSection = 'Category',
   DisplayName = 'Deal'
WHERE 
   ID = 'CC38EA5D-182E-4ADD-BBD1-36AA2CA08728';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Companies.CompanyID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Deal Company Association',
   GeneratedFormSection = 'Category',
   DisplayName = 'Company'
WHERE 
   ID = 'D1799B22-ADC4-40E7-9F96-47C102C1FA95';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Companies.Deal 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Deal Company Association',
   GeneratedFormSection = 'Category',
   DisplayName = 'Deal Name'
WHERE 
   ID = '3812143B-FBF1-45CC-BE85-8D80E2F33F74';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Companies.Company 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Deal Company Association',
   GeneratedFormSection = 'Category',
   DisplayName = 'Company Name'
WHERE 
   ID = 'AA6601CD-4AB8-43FE-AD8C-1135A9BE3189';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Companies.__mj_CreatedAt 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'E47B9D02-2649-40DD-A18A-9E613B1E89DB';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Companies.__mj_UpdatedAt 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'AB3C0505-B385-4B46-99A5-D747379B67A9';

/* Set entity icon to fa fa-handshake */

               UPDATE [${mjSchema}].[Entity]
               SET [Icon] = 'fa fa-handshake', [__mj_UpdatedAt] = GETUTCDATE()
               WHERE [ID] = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E';

/* Insert FieldCategoryInfo setting for entity */
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntitySetting] WHERE [EntityID] = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND [Name] = 'FieldCategoryInfo'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntitySetting] ([ID], [EntityID], [Name], [Value], [__mj_CreatedAt], [__mj_UpdatedAt])
               VALUES ('49c96e79-ffdb-5c6f-898c-bf06f186e71f', 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', 'FieldCategoryInfo', '{
  "Deal Company Association": {
    "description": "Links deals with their associated companies",
    "icon": "fa fa-link"
  },
  "System Metadata": {
    "description": "System-managed audit and tracking fields",
    "icon": "fa fa-cog"
  }
}', GETUTCDATE(), GETUTCDATE())
   END;

/* Insert FieldCategoryIcons setting (legacy) */
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntitySetting] WHERE [EntityID] = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND [Name] = 'FieldCategoryIcons'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntitySetting] ([ID], [EntityID], [Name], [Value], [__mj_CreatedAt], [__mj_UpdatedAt])
               VALUES ('62d32a00-a842-557f-bd06-8dbd48a31a5d', 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', 'FieldCategoryIcons', '{
  "Deal Company Association": "fa fa-link",
  "System Metadata": "fa fa-cog"
}', GETUTCDATE(), GETUTCDATE())
   END;

/* Set DefaultForNewUser=false for NEW entity (category: junction, confidence: high) */

         UPDATE [${mjSchema}].[ApplicationEntity]
         SET [DefaultForNewUser] = 0, [__mj_UpdatedAt] = GETUTCDATE()
         WHERE [EntityID] = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E';


-- =============================================================================
-- END OF CODEGEN OUTPUT. Hand-written from here.
-- =============================================================================
-- CodeGen's block above adds DealCompany's audit columns NULL, backfills them, then
-- ALTERs them to NOT NULL. omitRecurringScriptsFromLog keeps CodeGen's field sync
-- out of the block, so the entity-scoped sync runs here, after the view exists
-- (check-migration-column-sync).
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='e9f916ef-3f17-4bd8-854e-0faedf692e5e', @IncludedSchemaNames='${flyway:defaultSchema}';
GO
