-- =============================================================================
-- PipelineCompany — a pipeline can now serve several selling companies.
-- =============================================================================
-- Until now a pipeline belonged to exactly one company (Pipeline.CompanyID,
-- NOT NULL, docs/DECISIONS.md D5), and a company that sold the same motion got a
-- COPY of the pipeline and its stages (Sales.CopyDefaultPipelineToCompanies, #327).
-- This replaces the column with a link table, so one pipeline is shared by every
-- company it is linked to.
--
-- STRONGLY TYPED, NOT POLYMORPHIC. Accounting's GLAccountLink points at any record
-- through EntityID + RecordID because a GL account can be mapped from many kinds of
-- record. A pipeline only ever links to a company, so both sides are real foreign
-- keys and the database refuses a link to a company or pipeline that does not exist.
--
-- THE DEAL STILL CARRIES ONE COMPANY. Deal.CompanyID stays NOT NULL. The rep picks
-- the selling company first and is offered the pipelines linked to it; the entity
-- server refuses a deal whose company is not actively linked to its pipeline. That
-- replaces stampCompanyFromPipeline(), which copied the one company a pipeline had.
--
-- IsActive, NOT DELETE, retires a link. A company that stops selling a motion keeps
-- its open and historical deals on that pipeline; an inactive link stops new deals
-- from choosing it without orphaning the old ones.
--
-- THE BACKFILL. Every existing pipeline gets one active link to the company it
-- belonged to. Every existing deal's CompanyID already equals its pipeline's
-- company, so every existing deal passes the new check unchanged.
--
-- UQ_Pipeline_Company_Code GOES WITH THE COLUMN, AND NOTHING REPLACES IT. Code was
-- unique per company, and #327's copies share a Code across companies by design,
-- so a database-wide unique Code would fail on any deployment that ran the copy
-- action. Merging those copies into one linked pipeline moves deals and stages, and
-- is left to a deployment rather than done blind here.
-- =============================================================================

CREATE TABLE [${flyway:defaultSchema}].[PipelineCompany] (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    PipelineID UNIQUEIDENTIFIER NOT NULL,
    CompanyID UNIQUEIDENTIFIER NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT PK_PipelineCompany PRIMARY KEY (ID),
    CONSTRAINT UQ_PipelineCompany_Pipeline_Company UNIQUE (PipelineID, CompanyID),
    CONSTRAINT FK_PipelineCompany_Pipeline FOREIGN KEY (PipelineID)
        REFERENCES [${flyway:defaultSchema}].[Pipeline] (ID),
    CONSTRAINT FK_PipelineCompany_Company FOREIGN KEY (CompanyID)
        REFERENCES [${mjSchema}].[Company] (ID)
);
GO

-- Moves existing data, not seed data: one link per pipeline, to the company it had.
-- The two seeded pipelines, where they still sit on the seeded Default Company, take
-- the link IDs metadata/pipelines declares for that same pair. Otherwise the next
-- metadata push would insert its own row for the pair and fail on the unique key.
INSERT INTO [${flyway:defaultSchema}].[PipelineCompany] (ID, PipelineID, CompanyID, IsActive)
SELECT
    CASE
        WHEN c.Name = 'Default Company' AND p.ID = '90111111-0000-4000-A000-000000000001'
            THEN '260583E6-38B7-40E1-84AD-744153E5F624'
        WHEN c.Name = 'Default Company' AND p.ID = '90111111-0000-4000-A000-000000000002'
            THEN 'ABE024DA-8A45-40BA-B3F1-5B7B6A2713BE'
        ELSE NEWID()
    END,
    p.ID, p.CompanyID, 1
FROM [${flyway:defaultSchema}].[Pipeline] p
JOIN [${mjSchema}].[Company] c ON c.ID = p.CompanyID;
GO

-- The FK index is CodeGen's, created when the column was registered; it has to go
-- before the column can.
DROP INDEX [IDX_AUTO_MJ_FKEY_Pipeline_CompanyID] ON [${flyway:defaultSchema}].[Pipeline];
GO

ALTER TABLE [${flyway:defaultSchema}].[Pipeline] DROP CONSTRAINT [UQ_Pipeline_Company_Code];
GO

ALTER TABLE [${flyway:defaultSchema}].[Pipeline] DROP CONSTRAINT [FK_Pipeline_Company];
GO

ALTER TABLE [${flyway:defaultSchema}].[Pipeline] DROP COLUMN [CompanyID];
GO

-- vwPipelines is a `SELECT p.*` view joined to Company on the dropped column. The
-- CodeGen block below recreates it; until then it would not compile, so drop it
-- rather than leave an invalid view for CodeGen's field resequencing to read.
DROP VIEW [${flyway:defaultSchema}].[vwPipelines];
GO

-- CodeGen removes the EntityField rows for a dropped column (and the view's
-- virtual name column over it) in a recurring prune, and omitRecurringScriptsFromLog
-- keeps that prune out of the block below. The prune itself may not ship
-- (check-migration-no-prune), so the two rows are named here instead, so a host
-- installed from migrations loses them too.
DELETE FROM [${mjSchema}].[EntityFieldValue]
WHERE EntityFieldID IN (
    SELECT ID FROM [${mjSchema}].[EntityField]
    WHERE EntityID = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2'
      AND Name IN ('CompanyID', 'Company')
);
GO

DELETE FROM [${mjSchema}].[EntityField]
WHERE EntityID = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2'
  AND Name IN ('CompanyID', 'Company');
GO

-- The Companies -> Pipelines relationship joined on the dropped column. CodeGen
-- creates relationships but does not remove one whose join field is gone.
DELETE FROM [${mjSchema}].[EntityRelationship]
WHERE ID = '595f4beb-f95d-4ce5-a495-8c253db46f13';
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Links a pipeline to a company that sells through it. A pipeline can serve several companies; a deal''s company must be actively linked to the deal''s pipeline.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'PipelineCompany';
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'The pipeline the company sells through.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'PipelineCompany',
    @level2type = N'COLUMN', @level2name = N'PipelineID';
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'The selling company. Deals for this company can use the pipeline while the link is active.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'PipelineCompany',
    @level2type = N'COLUMN', @level2name = N'CompanyID';
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Whether new deals for the company can choose the pipeline. Clearing it retires the link without touching existing deals on the pipeline.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'PipelineCompany',
    @level2type = N'COLUMN', @level2name = N'IsActive';
GO

-- Pipeline's own descriptions named the one owning company.
EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'A sales pipeline: an ordered set of stages a deal moves through. Serves every company it is actively linked to through PipelineCompany.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Pipeline';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Short code for the pipeline. Not unique: deployments that copied the default pipeline per company hold several pipelines with the same code.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Pipeline',
    @level2type = N'COLUMN', @level2name = N'Code';
GO

-- Deal.CompanyID's description named the rule this migration retires.
EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The SELLING company, chosen by the rep. Must be actively linked to the deal''s pipeline through PipelineCompany; enforced by the entity server, since a CHECK cannot reach across the link. FK to __mj.Company.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Deal',
    @level2type = N'COLUMN', @level2name = N'CompanyID';
GO

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================
/* SQL generated to create new entity MJ_BizApps_Sales: Pipeline Companies */

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
         [AllowCaching]
         , [TrackRecordChanges]
         , [AuditRecordAccess]
         , [AuditViewRuns]
         , [AllowAllRowsAPI]
         , [AllowCreateAPI]
         , [AllowUpdateAPI]
         , [AllowDeleteAPI]
         , [UserViewMaxRows]
         , [__mj_CreatedAt]
         , [__mj_UpdatedAt]
      )
      VALUES (
         '521b0001-bbdc-4e58-9140-84684053e091',
         'MJ_BizApps_Sales: Pipeline Companies',
         'Pipeline Companies',
         'Links a pipeline to a company that sells through it. A pipeline can serve several companies; a deal''s company must be actively linked to the deal''s pipeline.',
         NULL,
         'PipelineCompany',
         'vwPipelineCompanies',
         '${flyway:defaultSchema}',
         1,
         1,
         0
         , 1
         , 0
         , 0
         , 0
         , 1
         , 1
         , 1
         , 1000
         , GETUTCDATE()
         , GETUTCDATE()
      );

/* SQL generated to add new entity MJ_BizApps_Sales: Pipeline Companies to application ID: '60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D', '521b0001-bbdc-4e58-9140-84684053e091', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Pipeline Companies for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('521b0001-bbdc-4e58-9140-84684053e091' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('521b0001-bbdc-4e58-9140-84684053e091' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Pipeline Companies for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('521b0001-bbdc-4e58-9140-84684053e091' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('521b0001-bbdc-4e58-9140-84684053e091' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Pipeline Companies for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('521b0001-bbdc-4e58-9140-84684053e091' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('521b0001-bbdc-4e58-9140-84684053e091' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.PipelineCompany */
ALTER TABLE [${flyway:defaultSchema}].[PipelineCompany] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.PipelineCompany */
UPDATE [${flyway:defaultSchema}].[PipelineCompany] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.PipelineCompany */
ALTER TABLE [${flyway:defaultSchema}].[PipelineCompany] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.PipelineCompany */
ALTER TABLE [${flyway:defaultSchema}].[PipelineCompany] ADD CONSTRAINT [DF___mj_BizAppsSales_PipelineCompany___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.PipelineCompany */
ALTER TABLE [${flyway:defaultSchema}].[PipelineCompany] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.PipelineCompany */
UPDATE [${flyway:defaultSchema}].[PipelineCompany] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.PipelineCompany */
ALTER TABLE [${flyway:defaultSchema}].[PipelineCompany] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.PipelineCompany */
ALTER TABLE [${flyway:defaultSchema}].[PipelineCompany] ADD CONSTRAINT [DF___mj_BizAppsSales_PipelineCompany___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to insert 9 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3e69c865-0f3a-4c4e-9aad-b3ebd07e9b4b' OR (EntityID = '521B0001-BBDC-4E58-9140-84684053E091' AND Name = 'ID')) BEGIN
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
            '3e69c865-0f3a-4c4e-9aad-b3ebd07e9b4b',
            '521B0001-BBDC-4E58-9140-84684053E091', -- Entity: MJ_BizApps_Sales: Pipeline Companies
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '521B0001-BBDC-4E58-9140-84684053E091'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'be0ae21a-e34e-475e-ab64-736786c1b6ed' OR (EntityID = '521B0001-BBDC-4E58-9140-84684053E091' AND Name = 'PipelineID')) BEGIN
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
            'be0ae21a-e34e-475e-ab64-736786c1b6ed',
            '521B0001-BBDC-4E58-9140-84684053E091', -- Entity: MJ_BizApps_Sales: Pipeline Companies
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '521B0001-BBDC-4E58-9140-84684053E091'),
            'PipelineID',
            'Pipeline ID',
            'The pipeline the company sells through.',
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
            'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a40a7c69-895d-4ff3-9f73-7e5ce26014e7' OR (EntityID = '521B0001-BBDC-4E58-9140-84684053E091' AND Name = 'CompanyID')) BEGIN
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
            'a40a7c69-895d-4ff3-9f73-7e5ce26014e7',
            '521B0001-BBDC-4E58-9140-84684053E091', -- Entity: MJ_BizApps_Sales: Pipeline Companies
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '521B0001-BBDC-4E58-9140-84684053E091'),
            'CompanyID',
            'Company ID',
            'The selling company. Deals for this company can use the pipeline while the link is active.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'c6d698a3-d493-4015-823c-16276f8d2532' OR (EntityID = '521B0001-BBDC-4E58-9140-84684053E091' AND Name = 'IsActive')) BEGIN
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
            'c6d698a3-d493-4015-823c-16276f8d2532',
            '521B0001-BBDC-4E58-9140-84684053E091', -- Entity: MJ_BizApps_Sales: Pipeline Companies
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '521B0001-BBDC-4E58-9140-84684053E091'),
            'IsActive',
            'Is Active',
            'Whether new deals for the company can choose the pipeline. Clearing it retires the link without touching existing deals on the pipeline.',
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
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '834e59d4-6d31-40cc-8c30-6e64333ded91' OR (EntityID = '521B0001-BBDC-4E58-9140-84684053E091' AND Name = '__mj_CreatedAt')) BEGIN
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
            '834e59d4-6d31-40cc-8c30-6e64333ded91',
            '521B0001-BBDC-4E58-9140-84684053E091', -- Entity: MJ_BizApps_Sales: Pipeline Companies
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '521B0001-BBDC-4E58-9140-84684053E091'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '669f2939-93b2-41a5-ae37-49ebf9e852bd' OR (EntityID = '521B0001-BBDC-4E58-9140-84684053E091' AND Name = '__mj_UpdatedAt')) BEGIN
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
            '669f2939-93b2-41a5-ae37-49ebf9e852bd',
            '521B0001-BBDC-4E58-9140-84684053E091', -- Entity: MJ_BizApps_Sales: Pipeline Companies
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '521B0001-BBDC-4E58-9140-84684053E091'),
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
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'f3d160de-39e3-4df3-af9e-4df4b3a01324' OR (EntityID = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND Name = 'DealType')) BEGIN
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
            'f3d160de-39e3-4df3-af9e-4df4b3a01324',
            'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', -- Entity: MJ_BizApps_Sales: Pipelines
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2'),
            'DealType',
            'Deal Type',
            NULL,
            'nvarchar',
            400,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'c61a870a-69cb-4149-ae4d-80b4ae4d0200' OR (EntityID = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND Name = 'DefaultForecastCategoryType')) BEGIN
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
            'c61a870a-69cb-4149-ae4d-80b4ae4d0200',
            'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', -- Entity: MJ_BizApps_Sales: Pipelines
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2'),
            'DefaultForecastCategoryType',
            'Default Forecast Category Type',
            NULL,
            'nvarchar',
            400,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '34172e71-9ea6-4a0b-8ffe-e3f8a19b31da' OR (EntityID = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND Name = 'CloseWonAssigneePerson')) BEGIN
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
            '34172e71-9ea6-4a0b-8ffe-e3f8a19b31da',
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


/* Create Entity Relationship: MJ: Companies -> MJ_BizApps_Sales: Pipeline Companies (One To Many via CompanyID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '4333b452-b348-4c5d-a53b-7f62ad63768e'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('4333b452-b348-4c5d-a53b-7f62ad63768e', 'D4238F34-2837-EF11-86D4-6045BDEE16E6', '521B0001-BBDC-4E58-9140-84684053E091', 'CompanyID', 'One To Many', 1, 1, 37, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ_BizApps_Sales: Pipelines -> MJ_BizApps_Sales: Pipeline Companies (One To Many via PipelineID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'affbbcb7-1bea-4480-895e-fb5e08d17251'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('affbbcb7-1bea-4480-895e-fb5e08d17251', 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', '521B0001-BBDC-4E58-9140-84684053E091', 'PipelineID', 'One To Many', 1, 1, 5, GETUTCDATE(), GETUTCDATE())
   END;

/* Index for Foreign Keys for PipelineCompany */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Pipeline Companies
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key PipelineID in table PipelineCompany
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_PipelineCompany_PipelineID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[PipelineCompany]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_PipelineCompany_PipelineID ON [${flyway:defaultSchema}].[PipelineCompany] ([PipelineID]);

-- Index for foreign key CompanyID in table PipelineCompany
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_PipelineCompany_CompanyID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[PipelineCompany]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_PipelineCompany_CompanyID ON [${flyway:defaultSchema}].[PipelineCompany] ([CompanyID]);

/* SQL text to update entity field related entity name field map for entity field ID BE0AE21A-E34E-475E-AB64-736786C1B6ED */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='BE0AE21A-E34E-475E-AB64-736786C1B6ED', @RelatedEntityNameFieldMap='Pipeline';

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
    mjBizAppsCommonPerson_CloseWonAssigneePersonID.[DisplayName] AS [CloseWonAssigneePerson]
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

/* SQL text to update entity field related entity name field map for entity field ID A40A7C69-895D-4FF3-9F73-7E5CE26014E7 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='A40A7C69-895D-4FF3-9F73-7E5CE26014E7', @RelatedEntityNameFieldMap='Company';

/* Base View SQL for MJ_BizApps_Sales: Pipeline Companies */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Pipeline Companies
-- Item: vwPipelineCompanies
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Pipeline Companies
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  PipelineCompany
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwPipelineCompanies]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwPipelineCompanies];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwPipelineCompanies]
AS
SELECT
    p.*,
    mjBizAppsSalesPipeline_PipelineID.[Name] AS [Pipeline],
    MJCompany_CompanyID.[Name] AS [Company]
FROM
    [${flyway:defaultSchema}].[PipelineCompany] AS p
INNER JOIN
    [${flyway:defaultSchema}].[Pipeline] AS mjBizAppsSalesPipeline_PipelineID
  ON
    [p].[PipelineID] = mjBizAppsSalesPipeline_PipelineID.[ID]
INNER JOIN
    [${mjSchema}].[Company] AS MJCompany_CompanyID
  ON
    [p].[CompanyID] = MJCompany_CompanyID.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwPipelineCompanies] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Sales: Pipeline Companies */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Pipeline Companies
-- Item: Permissions for vwPipelineCompanies
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwPipelineCompanies] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Sales: Pipeline Companies */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Pipeline Companies
-- Item: spCreatePipelineCompany
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR PipelineCompany
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreatePipelineCompany]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreatePipelineCompany];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreatePipelineCompany]
    @ID uniqueidentifier = NULL,
    @PipelineID uniqueidentifier,
    @CompanyID uniqueidentifier,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[PipelineCompany]
            (
                [ID],
                [PipelineID],
                [CompanyID],
                [IsActive]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @PipelineID,
                @CompanyID,
                ISNULL(@IsActive, 1)
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[PipelineCompany]
            (
                [PipelineID],
                [CompanyID],
                [IsActive]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @PipelineID,
                @CompanyID,
                ISNULL(@IsActive, 1)
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwPipelineCompanies] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreatePipelineCompany] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Sales: Pipeline Companies */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreatePipelineCompany] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Sales: Pipeline Companies */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Pipeline Companies
-- Item: spUpdatePipelineCompany
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR PipelineCompany
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdatePipelineCompany]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdatePipelineCompany];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdatePipelineCompany]
    @ID uniqueidentifier,
    @PipelineID uniqueidentifier = NULL,
    @CompanyID uniqueidentifier = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[PipelineCompany]
    SET
        [PipelineID] = ISNULL(@PipelineID, [PipelineID]),
        [CompanyID] = ISNULL(@CompanyID, [CompanyID]),
        [IsActive] = ISNULL(@IsActive, [IsActive])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwPipelineCompanies] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwPipelineCompanies]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdatePipelineCompany] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the PipelineCompany table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdatePipelineCompany]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdatePipelineCompany];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdatePipelineCompany
ON [${flyway:defaultSchema}].[PipelineCompany]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[PipelineCompany]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[PipelineCompany] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Sales: Pipeline Companies */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdatePipelineCompany] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Sales: Pipeline Companies */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Pipeline Companies
-- Item: spDeletePipelineCompany
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR PipelineCompany
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeletePipelineCompany]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeletePipelineCompany];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeletePipelineCompany]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[PipelineCompany]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeletePipelineCompany] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Sales: Pipeline Companies */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeletePipelineCompany] TO [cdp_Developer], [cdp_Integration];

/* SQL text to insert 2 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'd5db2957-d48d-419b-832d-13874b9f5434' OR (EntityID = '521B0001-BBDC-4E58-9140-84684053E091' AND Name = 'Pipeline')) BEGIN
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
            'd5db2957-d48d-419b-832d-13874b9f5434',
            '521B0001-BBDC-4E58-9140-84684053E091', -- Entity: MJ_BizApps_Sales: Pipeline Companies
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '521B0001-BBDC-4E58-9140-84684053E091'),
            'Pipeline',
            'Pipeline',
            NULL,
            'nvarchar',
            400,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '10fcb066-6181-4333-872f-ec03d30ea7aa' OR (EntityID = '521B0001-BBDC-4E58-9140-84684053E091' AND Name = 'Company')) BEGIN
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
            '10fcb066-6181-4333-872f-ec03d30ea7aa',
            '521B0001-BBDC-4E58-9140-84684053E091', -- Entity: MJ_BizApps_Sales: Pipeline Companies
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '521B0001-BBDC-4E58-9140-84684053E091'),
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
               WHERE ID = 'D5DB2957-D48D-419B-832D-13874B9F5434'
               AND AutoUpdateDefaultInView = 1;

               UPDATE [${mjSchema}].[EntityField]
               SET DefaultInView = 1
               WHERE ID = '10FCB066-6181-4333-872F-EC03D30EA7AA'
               AND AutoUpdateDefaultInView = 1;

            UPDATE [${mjSchema}].[Entity]
            SET AllowUserSearchAPI = 0
            WHERE ID = '521B0001-BBDC-4E58-9140-84684053E091'
            AND AutoUpdateAllowUserSearchAPI = 1;

/* Set categories for 3 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.DealType 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Deal & Forecast Settings',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'F3D160DE-39E3-4DF3-AF9E-4DF4B3A01324';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.DefaultForecastCategoryType 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Deal & Forecast Settings',
   GeneratedFormSection = 'Category',
   DisplayName = 'Default Forecast Category'
WHERE 
   ID = 'C61A870A-69CB-4149-AE4D-80B4AE4D0200';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.CloseWonAssigneePerson 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Automation & Policies',
   GeneratedFormSection = 'Category',
   DisplayName = 'Close Won Assignee'
WHERE 
   ID = '34172E71-9EA6-4A0B-8FFE-E3F8A19B31DA';

/* Set categories for 8 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipeline Companies.ID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '3E69C865-0F3A-4C4E-9AAD-B3EBD07E9B4B';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipeline Companies.PipelineID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Pipeline Assignment',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'BE0AE21A-E34E-475E-AB64-736786C1B6ED';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipeline Companies.Pipeline 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Pipeline Assignment',
   GeneratedFormSection = 'Category',
   DisplayName = 'Pipeline Name'
WHERE 
   ID = 'D5DB2957-D48D-419B-832D-13874B9F5434';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipeline Companies.CompanyID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Pipeline Assignment',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'A40A7C69-895D-4FF3-9F73-7E5CE26014E7';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipeline Companies.Company 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Pipeline Assignment',
   GeneratedFormSection = 'Category',
   DisplayName = 'Company Name'
WHERE 
   ID = '10FCB066-6181-4333-872F-EC03D30EA7AA';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipeline Companies.IsActive 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Status and Configuration',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'C6D698A3-D493-4015-823C-16276F8D2532';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipeline Companies.__mj_CreatedAt 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '834E59D4-6D31-40CC-8C30-6E64333DED91';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipeline Companies.__mj_UpdatedAt 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '669F2939-93B2-41A5-AE37-49EBF9E852BD';

/* Set entity icon to fa fa-link */

               UPDATE [${mjSchema}].[Entity]
               SET [Icon] = 'fa fa-link', [__mj_UpdatedAt] = GETUTCDATE()
               WHERE [ID] = '521B0001-BBDC-4E58-9140-84684053E091';

/* Insert FieldCategoryInfo setting for entity */
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntitySetting] WHERE [EntityID] = '521B0001-BBDC-4E58-9140-84684053E091' AND [Name] = 'FieldCategoryInfo'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntitySetting] ([ID], [EntityID], [Name], [Value], [__mj_CreatedAt], [__mj_UpdatedAt])
               VALUES ('416deab3-1ed8-5b55-8936-7aa25536f8bf', '521B0001-BBDC-4E58-9140-84684053E091', 'FieldCategoryInfo', '{
  "Pipeline Assignment": {
    "description": "Links between pipelines and companies",
    "icon": "fa fa-link"
  },
  "Status and Configuration": {
    "description": "Operational settings and status toggles",
    "icon": "fa fa-sliders-h"
  },
  "System Metadata": {
    "description": "System-managed audit and tracking fields",
    "icon": "fa fa-cog"
  }
}', GETUTCDATE(), GETUTCDATE())
   END;

/* Insert FieldCategoryIcons setting (legacy) */
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntitySetting] WHERE [EntityID] = '521B0001-BBDC-4E58-9140-84684053E091' AND [Name] = 'FieldCategoryIcons'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntitySetting] ([ID], [EntityID], [Name], [Value], [__mj_CreatedAt], [__mj_UpdatedAt])
               VALUES ('949b86e7-073d-52af-98b3-4c6ed3c43b46', '521B0001-BBDC-4E58-9140-84684053E091', 'FieldCategoryIcons', '{
  "Pipeline Assignment": "fa fa-link",
  "Status and Configuration": "fa fa-sliders-h",
  "System Metadata": "fa fa-cog"
}', GETUTCDATE(), GETUTCDATE())
   END;

/* Set DefaultForNewUser=false for NEW entity (category: junction, confidence: high) */

         UPDATE [${mjSchema}].[ApplicationEntity]
         SET [DefaultForNewUser] = 0, [__mj_UpdatedAt] = GETUTCDATE()
         WHERE [EntityID] = '521B0001-BBDC-4E58-9140-84684053E091';

-- =============================================================================
-- END OF CODEGEN OUTPUT. Hand-written from here.
-- =============================================================================
-- CodeGen's block above adds PipelineCompany's audit columns NULL, backfills them,
-- then ALTERs them to NOT NULL. omitRecurringScriptsFromLog keeps CodeGen's field
-- sync out of the block, so the entity-scoped sync runs here, after the view exists
-- (check-migration-column-sync).
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='521B0001-BBDC-4E58-9140-84684053E091', @IncludedSchemaNames='${flyway:defaultSchema}';
GO
