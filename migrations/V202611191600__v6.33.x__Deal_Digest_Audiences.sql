-- =============================================================================
-- Lapsed Close Date Digest: who receives it, and what each audience's email says.
-- =============================================================================
-- The weekly digest lists open deals whose expected close date has passed or was
-- never set. Who gets it, and how it reads, is DATA rather than code, so a new
-- audience or a changed recipient never needs a release:
--   * DealDigestAudienceType: behaviour flags per audience (Company Leader, CEO,
--     CFO, CTO). The digest builder reads the flags, never the Code or Name.
--   * DealDigestRecipient: audience x company x employee.
--
-- THE UNIQUE KEY TREATS NULLs AS EQUAL, ON PURPOSE. UQ_DealDigestRecipient covers
-- (DealDigestAudienceTypeID, CompanyID, EmployeeID), and CompanyID is empty on a
-- portfolio-wide audience. SQL Server counts two NULLs as the same value in a
-- UNIQUE constraint, so a person can hold ONE portfolio-wide row per audience,
-- which is the rule: a CFO who got the digest twice would be a duplicate send. It
-- is not a gap to close with a filtered index. (PostgreSQL treats NULLs as
-- distinct by default; the .pg.sql mirror says NULLS NOT DISTINCT to match.)
--
-- NO CHECK TIES CompanyID TO IsPortfolioWide. "A portfolio-wide audience's rows
-- have no company, any other audience's rows have one" compares a column here to
-- a column on another table, and a CHECK cannot see across tables. It is enforced
-- in the recipient's Save() override, where a message can say what to fix. The
-- only CHECK is MinDaysLapsed >= 0, a bound on one column.
--
-- Both tables are in this app's own schema, so `mj app remove` drops them with it;
-- the teardown file has nothing to retire for them. The foreign keys to Company
-- and Employee are the host's (${mjSchema}), as PipelineCompany's is.
-- =============================================================================

CREATE TABLE [${flyway:defaultSchema}].[DealDigestAudienceType] (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    Code NVARCHAR(50) NOT NULL,
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    IsPortfolioWide BIT NOT NULL DEFAULT 0,
    MinDaysLapsed INT NULL,
    IncludeMissingCloseDate BIT NOT NULL DEFAULT 1,
    SendWhenEmpty BIT NOT NULL DEFAULT 0,
    GroupByCompany BIT NOT NULL DEFAULT 1,
    SubjectTemplate NVARCHAR(255) NULL,
    IntroTemplate NVARCHAR(MAX) NULL,
    EmptyMessage NVARCHAR(500) NULL,
    DisplayRank INT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT PK_DealDigestAudienceType PRIMARY KEY (ID),
    CONSTRAINT UQ_DealDigestAudienceType_Code UNIQUE (Code),
    CONSTRAINT CK_DealDigestAudienceType_MinDaysLapsed CHECK (MinDaysLapsed IS NULL OR MinDaysLapsed >= 0)
);
GO

CREATE TABLE [${flyway:defaultSchema}].[DealDigestRecipient] (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    DealDigestAudienceTypeID UNIQUEIDENTIFIER NOT NULL,
    CompanyID UNIQUEIDENTIFIER NULL,
    EmployeeID UNIQUEIDENTIFIER NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT PK_DealDigestRecipient PRIMARY KEY (ID),
    CONSTRAINT UQ_DealDigestRecipient UNIQUE (DealDigestAudienceTypeID, CompanyID, EmployeeID),
    CONSTRAINT FK_DealDigestRecipient_DealDigestAudienceType FOREIGN KEY (DealDigestAudienceTypeID)
        REFERENCES [${flyway:defaultSchema}].[DealDigestAudienceType] (ID),
    CONSTRAINT FK_DealDigestRecipient_Company FOREIGN KEY (CompanyID)
        REFERENCES [${mjSchema}].[Company] (ID),
    CONSTRAINT FK_DealDigestRecipient_Employee FOREIGN KEY (EmployeeID)
        REFERENCES [${mjSchema}].[Employee] (ID)
);
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'One kind of audience for the Lapsed Close Date Digest (Company Leader, CEO, CFO, CTO). Behaviour comes from the flags on this row, never from the Code or Name: the digest builder reads IsPortfolioWide, MinDaysLapsed, IncludeMissingCloseDate, SendWhenEmpty and GroupByCompany, so adding an audience is a data change with no code impact.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealDigestAudienceType';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Stable identifier the seeds and the digest builder key on. Renaming Name is cosmetic; renaming Code changes an identifier.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealDigestAudienceType',
    @level2type = N'COLUMN', @level2name = N'Code';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Display name of the audience, as shown to the people who administer recipients.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealDigestAudienceType',
    @level2type = N'COLUMN', @level2name = N'Name';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'What this audience is for and who belongs in it.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealDigestAudienceType',
    @level2type = N'COLUMN', @level2name = N'Description';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When 1, recipients of this audience receive one digest covering every company, and their recipient rows carry no Company. When 0, each recipient row names the company the digest covers. Enforced in the recipient''s Save(), not by a CHECK, because it ties a column on this table to one on another.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealDigestAudienceType',
    @level2type = N'COLUMN', @level2name = N'IsPortfolioWide';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'A deal appears only once its expected close date is at least this many days past. Empty means no minimum: any deal whose date has passed appears. Never negative.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealDigestAudienceType',
    @level2type = N'COLUMN', @level2name = N'MinDaysLapsed';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When 1, open deals that never had an expected close date are listed too, after the lapsed ones. When 0 only deals whose date has passed appear.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealDigestAudienceType',
    @level2type = N'COLUMN', @level2name = N'IncludeMissingCloseDate';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When 1, a recipient with nothing lapsed still gets the email, carrying the Empty Message, so silence cannot be mistaken for a missed send. When 0 the email is skipped.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealDigestAudienceType',
    @level2type = N'COLUMN', @level2name = N'SendWhenEmpty';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When 1, the digest lists deals under a heading per company. When 0 it is one flat list.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealDigestAudienceType',
    @level2type = N'COLUMN', @level2name = N'GroupByCompany';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Subject line of the email. Empty means the digest builder''s built-in subject.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealDigestAudienceType',
    @level2type = N'COLUMN', @level2name = N'SubjectTemplate';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Opening text of the email, above the deal list. Empty means the digest builder''s built-in introduction.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealDigestAudienceType',
    @level2type = N'COLUMN', @level2name = N'IntroTemplate';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Text sent in place of the deal list when nothing is lapsed and Send When Empty is on.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealDigestAudienceType',
    @level2type = N'COLUMN', @level2name = N'EmptyMessage';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Order in which audiences are listed and processed; lowest first.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealDigestAudienceType',
    @level2type = N'COLUMN', @level2name = N'DisplayRank';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Whether this audience is sent at all. Clearing it pauses the audience without deleting its recipients.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealDigestAudienceType',
    @level2type = N'COLUMN', @level2name = N'IsActive';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'One person receiving one audience''s Lapsed Close Date Digest, for one company or, on a portfolio-wide audience, for all of them. The audience decides what the email contains; this row decides who gets it.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealDigestRecipient';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The audience this person receives.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealDigestRecipient',
    @level2type = N'COLUMN', @level2name = N'DealDigestAudienceTypeID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The company the digest covers for this person. Empty on a portfolio-wide audience, and required on any other; the recipient''s Save() enforces that pairing.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealDigestRecipient',
    @level2type = N'COLUMN', @level2name = N'CompanyID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The employee who receives the digest, at their work email.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealDigestRecipient',
    @level2type = N'COLUMN', @level2name = N'EmployeeID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Whether this person is sent the digest. Clearing it stops the email without deleting the row.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealDigestRecipient',
    @level2type = N'COLUMN', @level2name = N'IsActive';
GO

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================
-- Captured with `pnpm run mj:codegen` against a database built from migrations
-- alone. ONE statement CodeGen emitted was left out and re-stated by hand below
-- the closing banner: see the note there.
/* SQL generated to create new entity MJ_BizApps_Sales: Deal Digest Audience Types */

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
         'b16a4047-9415-4f1b-9f6c-59104e788c53',
         'MJ_BizApps_Sales: Deal Digest Audience Types',
         'Deal Digest Audience Types',
         'One kind of audience for the Lapsed Close Date Digest (Company Leader, CEO, CFO, CTO). Behaviour comes from the flags on this row, never from the Code or Name: the digest builder reads IsPortfolioWide, MinDaysLapsed, IncludeMissingCloseDate, SendWhenEmpty and GroupByCompany, so adding an audience is a data change with no code impact.',
         NULL,
         'DealDigestAudienceType',
         'vwDealDigestAudienceTypes',
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

/* SQL generated to add entity MJ_BizApps_Sales: Deal Digest Audience Types to application ID: '60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                    ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                    ('60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D', 'b16a4047-9415-4f1b-9f6c-59104e788c53', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Deal Digest Audience Types for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('b16a4047-9415-4f1b-9f6c-59104e788c53' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('b16a4047-9415-4f1b-9f6c-59104e788c53' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Deal Digest Audience Types for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('b16a4047-9415-4f1b-9f6c-59104e788c53' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('b16a4047-9415-4f1b-9f6c-59104e788c53' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Deal Digest Audience Types for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('b16a4047-9415-4f1b-9f6c-59104e788c53' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('b16a4047-9415-4f1b-9f6c-59104e788c53' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to create new entity MJ_BizApps_Sales: Deal Digest Recipients */

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
         '84246b5d-4431-489a-9186-df3c6de711ea',
         'MJ_BizApps_Sales: Deal Digest Recipients',
         'Deal Digest Recipients',
         'One person receiving one audience''s Lapsed Close Date Digest, for one company or, on a portfolio-wide audience, for all of them. The audience decides what the email contains; this row decides who gets it.',
         NULL,
         'DealDigestRecipient',
         'vwDealDigestRecipients',
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

/* SQL generated to add entity MJ_BizApps_Sales: Deal Digest Recipients to application ID: '60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                    ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                    ('60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D', '84246b5d-4431-489a-9186-df3c6de711ea', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Deal Digest Recipients for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('84246b5d-4431-489a-9186-df3c6de711ea' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('84246b5d-4431-489a-9186-df3c6de711ea' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Deal Digest Recipients for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('84246b5d-4431-489a-9186-df3c6de711ea' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('84246b5d-4431-489a-9186-df3c6de711ea' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Deal Digest Recipients for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('84246b5d-4431-489a-9186-df3c6de711ea' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('84246b5d-4431-489a-9186-df3c6de711ea' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.DealDigestAudienceType */
ALTER TABLE [${flyway:defaultSchema}].[DealDigestAudienceType] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.DealDigestAudienceType */
UPDATE [${flyway:defaultSchema}].[DealDigestAudienceType] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.DealDigestAudienceType */
ALTER TABLE [${flyway:defaultSchema}].[DealDigestAudienceType] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.DealDigestAudienceType */
ALTER TABLE [${flyway:defaultSchema}].[DealDigestAudienceType] ADD CONSTRAINT [DF___mj_BizAppsSales_DealDigestAudienceType___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.DealDigestAudienceType */
ALTER TABLE [${flyway:defaultSchema}].[DealDigestAudienceType] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.DealDigestAudienceType */
UPDATE [${flyway:defaultSchema}].[DealDigestAudienceType] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.DealDigestAudienceType */
ALTER TABLE [${flyway:defaultSchema}].[DealDigestAudienceType] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.DealDigestAudienceType */
ALTER TABLE [${flyway:defaultSchema}].[DealDigestAudienceType] ADD CONSTRAINT [DF___mj_BizAppsSales_DealDigestAudienceType___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.DealDigestRecipient */
ALTER TABLE [${flyway:defaultSchema}].[DealDigestRecipient] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.DealDigestRecipient */
UPDATE [${flyway:defaultSchema}].[DealDigestRecipient] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.DealDigestRecipient */
ALTER TABLE [${flyway:defaultSchema}].[DealDigestRecipient] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.DealDigestRecipient */
ALTER TABLE [${flyway:defaultSchema}].[DealDigestRecipient] ADD CONSTRAINT [DF___mj_BizAppsSales_DealDigestRecipient___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.DealDigestRecipient */
ALTER TABLE [${flyway:defaultSchema}].[DealDigestRecipient] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.DealDigestRecipient */
UPDATE [${flyway:defaultSchema}].[DealDigestRecipient] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.DealDigestRecipient */
ALTER TABLE [${flyway:defaultSchema}].[DealDigestRecipient] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.DealDigestRecipient */
ALTER TABLE [${flyway:defaultSchema}].[DealDigestRecipient] ADD CONSTRAINT [DF___mj_BizAppsSales_DealDigestRecipient___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to insert 23 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'ad7259cd-c7e9-4599-b118-2748beb3b1b4' OR (EntityID = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND Name = 'ID')) BEGIN
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
            'ad7259cd-c7e9-4599-b118-2748beb3b1b4',
            'B16A4047-9415-4F1B-9F6C-59104E788C53', -- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '413e6bb6-7ab6-4987-9149-b6ce0d9a8729' OR (EntityID = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND Name = 'Code')) BEGIN
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
            '413e6bb6-7ab6-4987-9149-b6ce0d9a8729',
            'B16A4047-9415-4F1B-9F6C-59104E788C53', -- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
            'Code',
            'Code',
            'Stable identifier the seeds and the digest builder key on. Renaming Name is cosmetic; renaming Code changes an identifier.',
            'nvarchar',
            100,
            0,
            0,
            0,
            NULL,
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
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'fb29262f-f418-444a-86b7-633df8a0e2fb' OR (EntityID = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND Name = 'Name')) BEGIN
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
            'fb29262f-f418-444a-86b7-633df8a0e2fb',
            'B16A4047-9415-4F1B-9F6C-59104E788C53', -- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
            'Name',
            'Name',
            'Display name of the audience, as shown to the people who administer recipients.',
            'nvarchar',
            200,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            1,
            1,
            0,
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '0afaa0e7-f80b-4d2d-ad1d-3593a0a50598' OR (EntityID = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND Name = 'Description')) BEGIN
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
            '0afaa0e7-f80b-4d2d-ad1d-3593a0a50598',
            'B16A4047-9415-4F1B-9F6C-59104E788C53', -- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
            'Description',
            'Description',
            'What this audience is for and who belongs in it.',
            'nvarchar',
            -1,
            0,
            0,
            1,
            NULL,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3689b893-4c73-451c-a1fe-54eb9f51480b' OR (EntityID = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND Name = 'IsPortfolioWide')) BEGIN
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
            '3689b893-4c73-451c-a1fe-54eb9f51480b',
            'B16A4047-9415-4F1B-9F6C-59104E788C53', -- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
            'IsPortfolioWide',
            'Is Portfolio Wide',
            'When 1, recipients of this audience receive one digest covering every company, and their recipient rows carry no Company. When 0, each recipient row names the company the digest covers. Enforced in the recipient''s Save(), not by a CHECK, because it ties a column on this table to one on another.',
            'bit',
            1,
            1,
            0,
            0,
            '(0)',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '62a9c710-a1be-413a-9433-ba97779e4cf2' OR (EntityID = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND Name = 'MinDaysLapsed')) BEGIN
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
            '62a9c710-a1be-413a-9433-ba97779e4cf2',
            'B16A4047-9415-4F1B-9F6C-59104E788C53', -- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
            'MinDaysLapsed',
            'Min Days Lapsed',
            'A deal appears only once its expected close date is at least this many days past. Empty means no minimum: any deal whose date has passed appears. Never negative.',
            'int',
            4,
            10,
            0,
            1,
            NULL,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '537b6ac9-cd1b-42a7-86ab-c60e7e09c83b' OR (EntityID = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND Name = 'IncludeMissingCloseDate')) BEGIN
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
            '537b6ac9-cd1b-42a7-86ab-c60e7e09c83b',
            'B16A4047-9415-4F1B-9F6C-59104E788C53', -- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
            'IncludeMissingCloseDate',
            'Include Missing Close Date',
            'When 1, open deals that never had an expected close date are listed too, after the lapsed ones. When 0 only deals whose date has passed appear.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3dcf0226-63ee-4526-9dcc-ca31720cea62' OR (EntityID = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND Name = 'SendWhenEmpty')) BEGIN
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
            '3dcf0226-63ee-4526-9dcc-ca31720cea62',
            'B16A4047-9415-4F1B-9F6C-59104E788C53', -- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
            'SendWhenEmpty',
            'Send When Empty',
            'When 1, a recipient with nothing lapsed still gets the email, carrying the Empty Message, so silence cannot be mistaken for a missed send. When 0 the email is skipped.',
            'bit',
            1,
            1,
            0,
            0,
            '(0)',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a0cfb168-c50c-4fbf-9198-e0571e69c495' OR (EntityID = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND Name = 'GroupByCompany')) BEGIN
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
            'a0cfb168-c50c-4fbf-9198-e0571e69c495',
            'B16A4047-9415-4F1B-9F6C-59104E788C53', -- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
            'GroupByCompany',
            'Group By Company',
            'When 1, the digest lists deals under a heading per company. When 0 it is one flat list.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '8945982e-635b-4cbc-93c2-28dbe50f8da5' OR (EntityID = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND Name = 'SubjectTemplate')) BEGIN
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
            '8945982e-635b-4cbc-93c2-28dbe50f8da5',
            'B16A4047-9415-4F1B-9F6C-59104E788C53', -- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
            'SubjectTemplate',
            'Subject Template',
            'Subject line of the email. Empty means the digest builder''s built-in subject.',
            'nvarchar',
            510,
            0,
            0,
            1,
            NULL,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'ce02923d-a19c-4951-b30d-d57fdee47bd4' OR (EntityID = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND Name = 'IntroTemplate')) BEGIN
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
            'ce02923d-a19c-4951-b30d-d57fdee47bd4',
            'B16A4047-9415-4F1B-9F6C-59104E788C53', -- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
            'IntroTemplate',
            'Intro Template',
            'Opening text of the email, above the deal list. Empty means the digest builder''s built-in introduction.',
            'nvarchar',
            -1,
            0,
            0,
            1,
            NULL,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '79c5b52f-022e-4161-afcb-b8c796af8d2d' OR (EntityID = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND Name = 'EmptyMessage')) BEGIN
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
            '79c5b52f-022e-4161-afcb-b8c796af8d2d',
            'B16A4047-9415-4F1B-9F6C-59104E788C53', -- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
            'EmptyMessage',
            'Empty Message',
            'Text sent in place of the deal list when nothing is lapsed and Send When Empty is on.',
            'nvarchar',
            1000,
            0,
            0,
            1,
            NULL,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '75e82953-084e-4d32-8d74-16b13c96f042' OR (EntityID = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND Name = 'DisplayRank')) BEGIN
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
            '75e82953-084e-4d32-8d74-16b13c96f042',
            'B16A4047-9415-4F1B-9F6C-59104E788C53', -- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
            'DisplayRank',
            'Display Rank',
            'Order in which audiences are listed and processed; lowest first.',
            'int',
            4,
            10,
            0,
            0,
            '(0)',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '522eb3e7-bf6e-4759-8532-7301bc58c25d' OR (EntityID = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND Name = 'IsActive')) BEGIN
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
            '522eb3e7-bf6e-4759-8532-7301bc58c25d',
            'B16A4047-9415-4F1B-9F6C-59104E788C53', -- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
            'IsActive',
            'Is Active',
            'Whether this audience is sent at all. Clearing it pauses the audience without deleting its recipients.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b6e73f12-a7e8-4616-8e44-221267d2b56b' OR (EntityID = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND Name = '__mj_CreatedAt')) BEGIN
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
            'b6e73f12-a7e8-4616-8e44-221267d2b56b',
            'B16A4047-9415-4F1B-9F6C-59104E788C53', -- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
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
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '123a10f9-5785-447b-82c4-ff4785429b82' OR (EntityID = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND Name = '__mj_UpdatedAt')) BEGIN
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
            '123a10f9-5785-447b-82c4-ff4785429b82',
            'B16A4047-9415-4F1B-9F6C-59104E788C53', -- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a55da574-d8cd-40a3-b21c-c5c36c587470' OR (EntityID = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND Name = 'ID')) BEGIN
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
            'a55da574-d8cd-40a3-b21c-c5c36c587470',
            '84246B5D-4431-489A-9186-DF3C6DE711EA', -- Entity: MJ_BizApps_Sales: Deal Digest Recipients
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '84246B5D-4431-489A-9186-DF3C6DE711EA'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '89cccbe5-36db-4da6-bd69-eac1819cd304' OR (EntityID = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND Name = 'DealDigestAudienceTypeID')) BEGIN
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
            '89cccbe5-36db-4da6-bd69-eac1819cd304',
            '84246B5D-4431-489A-9186-DF3C6DE711EA', -- Entity: MJ_BizApps_Sales: Deal Digest Recipients
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '84246B5D-4431-489A-9186-DF3C6DE711EA'),
            'DealDigestAudienceTypeID',
            'Deal Digest Audience Type ID',
            'The audience this person receives.',
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
            'B16A4047-9415-4F1B-9F6C-59104E788C53',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '0621f6c2-ab9d-4fec-a43b-e30d04de8510' OR (EntityID = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND Name = 'CompanyID')) BEGIN
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
            '0621f6c2-ab9d-4fec-a43b-e30d04de8510',
            '84246B5D-4431-489A-9186-DF3C6DE711EA', -- Entity: MJ_BizApps_Sales: Deal Digest Recipients
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '84246B5D-4431-489A-9186-DF3C6DE711EA'),
            'CompanyID',
            'Company ID',
            'The company the digest covers for this person. Empty on a portfolio-wide audience, and required on any other; the recipient''s Save() enforces that pairing.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '1aede892-ec14-4fd6-aff4-cfea9feba337' OR (EntityID = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND Name = 'EmployeeID')) BEGIN
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
            '1aede892-ec14-4fd6-aff4-cfea9feba337',
            '84246B5D-4431-489A-9186-DF3C6DE711EA', -- Entity: MJ_BizApps_Sales: Deal Digest Recipients
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '84246B5D-4431-489A-9186-DF3C6DE711EA'),
            'EmployeeID',
            'Employee ID',
            'The employee who receives the digest, at their work email.',
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
            'D5238F34-2837-EF11-86D4-6045BDEE16E6',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'ee5f6659-fc92-4c3e-af80-a9c08a3e9744' OR (EntityID = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND Name = 'IsActive')) BEGIN
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
            'ee5f6659-fc92-4c3e-af80-a9c08a3e9744',
            '84246B5D-4431-489A-9186-DF3C6DE711EA', -- Entity: MJ_BizApps_Sales: Deal Digest Recipients
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '84246B5D-4431-489A-9186-DF3C6DE711EA'),
            'IsActive',
            'Is Active',
            'Whether this person is sent the digest. Clearing it stops the email without deleting the row.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'f691662f-6bcd-47df-b894-85163407b296' OR (EntityID = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND Name = '__mj_CreatedAt')) BEGIN
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
            'f691662f-6bcd-47df-b894-85163407b296',
            '84246B5D-4431-489A-9186-DF3C6DE711EA', -- Entity: MJ_BizApps_Sales: Deal Digest Recipients
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '84246B5D-4431-489A-9186-DF3C6DE711EA'),
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
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '2d17a29b-bcc0-457d-a70b-f29d7e7f8a70' OR (EntityID = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND Name = '__mj_UpdatedAt')) BEGIN
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
            '2d17a29b-bcc0-457d-a70b-f29d7e7f8a70',
            '84246B5D-4431-489A-9186-DF3C6DE711EA', -- Entity: MJ_BizApps_Sales: Deal Digest Recipients
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '84246B5D-4431-489A-9186-DF3C6DE711EA'),
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



/* Create Entity Relationship: MJ_BizApps_Sales: Deal Digest Audience Types -> MJ_BizApps_Sales: Deal Digest Recipients (One To Many via DealDigestAudienceTypeID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'c82d6c0e-845f-4f87-899e-81745ebe10e0' OR ([EntityID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND [RelatedEntityID] = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND [RelatedEntityJoinField] = 'DealDigestAudienceTypeID')
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('c82d6c0e-845f-4f87-899e-81745ebe10e0', 'B16A4047-9415-4F1B-9F6C-59104E788C53', '84246B5D-4431-489A-9186-DF3C6DE711EA', 'DealDigestAudienceTypeID', 'One To Many', 1, 1, 1, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ: Companies -> MJ_BizApps_Sales: Deal Digest Recipients (One To Many via CompanyID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '393d542a-8506-405a-9224-8744e05634d7' OR ([EntityID] = 'D4238F34-2837-EF11-86D4-6045BDEE16E6' AND [RelatedEntityID] = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND [RelatedEntityJoinField] = 'CompanyID')
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('393d542a-8506-405a-9224-8744e05634d7', 'D4238F34-2837-EF11-86D4-6045BDEE16E6', '84246B5D-4431-489A-9186-DF3C6DE711EA', 'CompanyID', 'One To Many', 1, 1, 43, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ: Employees -> MJ_BizApps_Sales: Deal Digest Recipients (One To Many via EmployeeID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '5d3ac9f4-ed5b-4506-821c-c86f69a07082' OR ([EntityID] = 'D5238F34-2837-EF11-86D4-6045BDEE16E6' AND [RelatedEntityID] = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND [RelatedEntityJoinField] = 'EmployeeID')
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('5d3ac9f4-ed5b-4506-821c-c86f69a07082', 'D5238F34-2837-EF11-86D4-6045BDEE16E6', '84246B5D-4431-489A-9186-DF3C6DE711EA', 'EmployeeID', 'One To Many', 1, 1, 11, GETUTCDATE(), GETUTCDATE())
   END;

/* Index for Foreign Keys for DealDigestAudienceType */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

/* Index for Foreign Keys for DealDigestRecipient */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Digest Recipients
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key DealDigestAudienceTypeID in table DealDigestRecipient
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_DealDigestRecipient_DealDigestAudienceTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[DealDigestRecipient]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_DealDigestRecipient_DealDigestAudienceTypeID ON [${flyway:defaultSchema}].[DealDigestRecipient] ([DealDigestAudienceTypeID]);

-- Index for foreign key CompanyID in table DealDigestRecipient
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_DealDigestRecipient_CompanyID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[DealDigestRecipient]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_DealDigestRecipient_CompanyID ON [${flyway:defaultSchema}].[DealDigestRecipient] ([CompanyID]);

-- Index for foreign key EmployeeID in table DealDigestRecipient
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_DealDigestRecipient_EmployeeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[DealDigestRecipient]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_DealDigestRecipient_EmployeeID ON [${flyway:defaultSchema}].[DealDigestRecipient] ([EmployeeID]);

/* SQL text to update entity field related entity name field map for entity field ID 89CCCBE5-36DB-4DA6-BD69-EAC1819CD304 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='89CCCBE5-36DB-4DA6-BD69-EAC1819CD304', @RelatedEntityNameFieldMap='DealDigestAudienceType';

/* Base View SQL for MJ_BizApps_Sales: Deal Digest Audience Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
-- Item: vwDealDigestAudienceTypes
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Deal Digest Audience Types
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  DealDigestAudienceType
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwDealDigestAudienceTypes]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwDealDigestAudienceTypes];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwDealDigestAudienceTypes]
AS
SELECT
    d.*
FROM
    [${flyway:defaultSchema}].[DealDigestAudienceType] AS d
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwDealDigestAudienceTypes] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Sales: Deal Digest Audience Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
-- Item: Permissions for vwDealDigestAudienceTypes
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwDealDigestAudienceTypes] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Sales: Deal Digest Audience Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
-- Item: spCreateDealDigestAudienceType
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR DealDigestAudienceType
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateDealDigestAudienceType]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateDealDigestAudienceType];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateDealDigestAudienceType]
    @ID uniqueidentifier = NULL,
    @Code nvarchar(50),
    @Name nvarchar(100),
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @IsPortfolioWide bit = NULL,
    @MinDaysLapsed_Clear bit = 0,
    @MinDaysLapsed int = NULL,
    @IncludeMissingCloseDate bit = NULL,
    @SendWhenEmpty bit = NULL,
    @GroupByCompany bit = NULL,
    @SubjectTemplate_Clear bit = 0,
    @SubjectTemplate nvarchar(255) = NULL,
    @IntroTemplate_Clear bit = 0,
    @IntroTemplate nvarchar(MAX) = NULL,
    @EmptyMessage_Clear bit = 0,
    @EmptyMessage nvarchar(500) = NULL,
    @DisplayRank int = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[DealDigestAudienceType]
            (
                [ID],
                [Code],
                [Name],
                [Description],
                [IsPortfolioWide],
                [MinDaysLapsed],
                [IncludeMissingCloseDate],
                [SendWhenEmpty],
                [GroupByCompany],
                [SubjectTemplate],
                [IntroTemplate],
                [EmptyMessage],
                [DisplayRank],
                [IsActive]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @Code,
                @Name,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                ISNULL(@IsPortfolioWide, 0),
                CASE WHEN @MinDaysLapsed_Clear = 1 THEN NULL ELSE ISNULL(@MinDaysLapsed, NULL) END,
                ISNULL(@IncludeMissingCloseDate, 1),
                ISNULL(@SendWhenEmpty, 0),
                ISNULL(@GroupByCompany, 1),
                CASE WHEN @SubjectTemplate_Clear = 1 THEN NULL ELSE ISNULL(@SubjectTemplate, NULL) END,
                CASE WHEN @IntroTemplate_Clear = 1 THEN NULL ELSE ISNULL(@IntroTemplate, NULL) END,
                CASE WHEN @EmptyMessage_Clear = 1 THEN NULL ELSE ISNULL(@EmptyMessage, NULL) END,
                ISNULL(@DisplayRank, 0),
                ISNULL(@IsActive, 1)
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[DealDigestAudienceType]
            (
                [Code],
                [Name],
                [Description],
                [IsPortfolioWide],
                [MinDaysLapsed],
                [IncludeMissingCloseDate],
                [SendWhenEmpty],
                [GroupByCompany],
                [SubjectTemplate],
                [IntroTemplate],
                [EmptyMessage],
                [DisplayRank],
                [IsActive]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @Code,
                @Name,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                ISNULL(@IsPortfolioWide, 0),
                CASE WHEN @MinDaysLapsed_Clear = 1 THEN NULL ELSE ISNULL(@MinDaysLapsed, NULL) END,
                ISNULL(@IncludeMissingCloseDate, 1),
                ISNULL(@SendWhenEmpty, 0),
                ISNULL(@GroupByCompany, 1),
                CASE WHEN @SubjectTemplate_Clear = 1 THEN NULL ELSE ISNULL(@SubjectTemplate, NULL) END,
                CASE WHEN @IntroTemplate_Clear = 1 THEN NULL ELSE ISNULL(@IntroTemplate, NULL) END,
                CASE WHEN @EmptyMessage_Clear = 1 THEN NULL ELSE ISNULL(@EmptyMessage, NULL) END,
                ISNULL(@DisplayRank, 0),
                ISNULL(@IsActive, 1)
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwDealDigestAudienceTypes] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateDealDigestAudienceType] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Sales: Deal Digest Audience Types */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateDealDigestAudienceType] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Sales: Deal Digest Audience Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
-- Item: spUpdateDealDigestAudienceType
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR DealDigestAudienceType
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateDealDigestAudienceType]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateDealDigestAudienceType];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateDealDigestAudienceType]
    @ID uniqueidentifier,
    @Code nvarchar(50) = NULL,
    @Name nvarchar(100) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @IsPortfolioWide bit = NULL,
    @MinDaysLapsed_Clear bit = 0,
    @MinDaysLapsed int = NULL,
    @IncludeMissingCloseDate bit = NULL,
    @SendWhenEmpty bit = NULL,
    @GroupByCompany bit = NULL,
    @SubjectTemplate_Clear bit = 0,
    @SubjectTemplate nvarchar(255) = NULL,
    @IntroTemplate_Clear bit = 0,
    @IntroTemplate nvarchar(MAX) = NULL,
    @EmptyMessage_Clear bit = 0,
    @EmptyMessage nvarchar(500) = NULL,
    @DisplayRank int = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[DealDigestAudienceType]
    SET
        [Code] = ISNULL(@Code, [Code]),
        [Name] = ISNULL(@Name, [Name]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [IsPortfolioWide] = ISNULL(@IsPortfolioWide, [IsPortfolioWide]),
        [MinDaysLapsed] = CASE WHEN @MinDaysLapsed_Clear = 1 THEN NULL ELSE ISNULL(@MinDaysLapsed, [MinDaysLapsed]) END,
        [IncludeMissingCloseDate] = ISNULL(@IncludeMissingCloseDate, [IncludeMissingCloseDate]),
        [SendWhenEmpty] = ISNULL(@SendWhenEmpty, [SendWhenEmpty]),
        [GroupByCompany] = ISNULL(@GroupByCompany, [GroupByCompany]),
        [SubjectTemplate] = CASE WHEN @SubjectTemplate_Clear = 1 THEN NULL ELSE ISNULL(@SubjectTemplate, [SubjectTemplate]) END,
        [IntroTemplate] = CASE WHEN @IntroTemplate_Clear = 1 THEN NULL ELSE ISNULL(@IntroTemplate, [IntroTemplate]) END,
        [EmptyMessage] = CASE WHEN @EmptyMessage_Clear = 1 THEN NULL ELSE ISNULL(@EmptyMessage, [EmptyMessage]) END,
        [DisplayRank] = ISNULL(@DisplayRank, [DisplayRank]),
        [IsActive] = ISNULL(@IsActive, [IsActive])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwDealDigestAudienceTypes] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwDealDigestAudienceTypes]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDealDigestAudienceType] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the DealDigestAudienceType table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateDealDigestAudienceType]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateDealDigestAudienceType];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateDealDigestAudienceType
ON [${flyway:defaultSchema}].[DealDigestAudienceType]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[DealDigestAudienceType]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[DealDigestAudienceType] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Sales: Deal Digest Audience Types */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDealDigestAudienceType] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Sales: Deal Digest Audience Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
-- Item: spDeleteDealDigestAudienceType
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR DealDigestAudienceType
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteDealDigestAudienceType]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteDealDigestAudienceType];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteDealDigestAudienceType]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[DealDigestAudienceType]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteDealDigestAudienceType] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Sales: Deal Digest Audience Types */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteDealDigestAudienceType] TO [cdp_Developer], [cdp_Integration];

/* SQL text to update entity field related entity name field map for entity field ID 0621F6C2-AB9D-4FEC-A43B-E30D04DE8510 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='0621F6C2-AB9D-4FEC-A43B-E30D04DE8510', @RelatedEntityNameFieldMap='Company';

/* SQL text to update entity field related entity name field map for entity field ID 1AEDE892-EC14-4FD6-AFF4-CFEA9FEBA337 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='1AEDE892-EC14-4FD6-AFF4-CFEA9FEBA337', @RelatedEntityNameFieldMap='Employee';

/* Base View SQL for MJ_BizApps_Sales: Deal Digest Recipients */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Digest Recipients
-- Item: vwDealDigestRecipients
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Deal Digest Recipients
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  DealDigestRecipient
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwDealDigestRecipients]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwDealDigestRecipients];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwDealDigestRecipients]
AS
SELECT
    d.*,
    mjBizAppsSalesDealDigestAudienceType_DealDigestAudienceTypeID.[Name] AS [DealDigestAudienceType],
    MJCompany_CompanyID.[Name] AS [Company],
    MJEmployee_EmployeeID.[FirstLast] AS [Employee]
FROM
    [${flyway:defaultSchema}].[DealDigestRecipient] AS d
INNER JOIN
    [${flyway:defaultSchema}].[DealDigestAudienceType] AS mjBizAppsSalesDealDigestAudienceType_DealDigestAudienceTypeID
  ON
    [d].[DealDigestAudienceTypeID] = mjBizAppsSalesDealDigestAudienceType_DealDigestAudienceTypeID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[Company] AS MJCompany_CompanyID
  ON
    [d].[CompanyID] = MJCompany_CompanyID.[ID]
INNER JOIN
    [${mjSchema}].[vwEmployees] AS MJEmployee_EmployeeID
  ON
    [d].[EmployeeID] = MJEmployee_EmployeeID.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwDealDigestRecipients] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Sales: Deal Digest Recipients */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Digest Recipients
-- Item: Permissions for vwDealDigestRecipients
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwDealDigestRecipients] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Sales: Deal Digest Recipients */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Digest Recipients
-- Item: spCreateDealDigestRecipient
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR DealDigestRecipient
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateDealDigestRecipient]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateDealDigestRecipient];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateDealDigestRecipient]
    @ID uniqueidentifier = NULL,
    @DealDigestAudienceTypeID uniqueidentifier,
    @CompanyID_Clear bit = 0,
    @CompanyID uniqueidentifier = NULL,
    @EmployeeID uniqueidentifier,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[DealDigestRecipient]
            (
                [ID],
                [DealDigestAudienceTypeID],
                [CompanyID],
                [EmployeeID],
                [IsActive]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @DealDigestAudienceTypeID,
                CASE WHEN @CompanyID_Clear = 1 THEN NULL ELSE ISNULL(@CompanyID, NULL) END,
                @EmployeeID,
                ISNULL(@IsActive, 1)
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[DealDigestRecipient]
            (
                [DealDigestAudienceTypeID],
                [CompanyID],
                [EmployeeID],
                [IsActive]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @DealDigestAudienceTypeID,
                CASE WHEN @CompanyID_Clear = 1 THEN NULL ELSE ISNULL(@CompanyID, NULL) END,
                @EmployeeID,
                ISNULL(@IsActive, 1)
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwDealDigestRecipients] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateDealDigestRecipient] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Sales: Deal Digest Recipients */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateDealDigestRecipient] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Sales: Deal Digest Recipients */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Digest Recipients
-- Item: spUpdateDealDigestRecipient
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR DealDigestRecipient
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateDealDigestRecipient]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateDealDigestRecipient];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateDealDigestRecipient]
    @ID uniqueidentifier,
    @DealDigestAudienceTypeID uniqueidentifier = NULL,
    @CompanyID_Clear bit = 0,
    @CompanyID uniqueidentifier = NULL,
    @EmployeeID uniqueidentifier = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[DealDigestRecipient]
    SET
        [DealDigestAudienceTypeID] = ISNULL(@DealDigestAudienceTypeID, [DealDigestAudienceTypeID]),
        [CompanyID] = CASE WHEN @CompanyID_Clear = 1 THEN NULL ELSE ISNULL(@CompanyID, [CompanyID]) END,
        [EmployeeID] = ISNULL(@EmployeeID, [EmployeeID]),
        [IsActive] = ISNULL(@IsActive, [IsActive])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwDealDigestRecipients] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwDealDigestRecipients]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDealDigestRecipient] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the DealDigestRecipient table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateDealDigestRecipient]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateDealDigestRecipient];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateDealDigestRecipient
ON [${flyway:defaultSchema}].[DealDigestRecipient]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[DealDigestRecipient]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[DealDigestRecipient] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Sales: Deal Digest Recipients */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDealDigestRecipient] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Sales: Deal Digest Recipients */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Digest Recipients
-- Item: spDeleteDealDigestRecipient
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR DealDigestRecipient
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteDealDigestRecipient]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteDealDigestRecipient];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteDealDigestRecipient]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[DealDigestRecipient]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteDealDigestRecipient] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Sales: Deal Digest Recipients */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteDealDigestRecipient] TO [cdp_Developer], [cdp_Integration];

/* SQL text to insert 3 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'f80be1f3-8d83-4772-a873-e5962981a629' OR (EntityID = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND Name = 'DealDigestAudienceType')) BEGIN
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
            'f80be1f3-8d83-4772-a873-e5962981a629',
            '84246B5D-4431-489A-9186-DF3C6DE711EA', -- Entity: MJ_BizApps_Sales: Deal Digest Recipients
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '84246B5D-4431-489A-9186-DF3C6DE711EA'),
            'DealDigestAudienceType',
            'Deal Digest Audience Type',
            NULL,
            'nvarchar',
            200,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a8c65a-8a0c-4b3c-9508-6d65ed63f1c0' OR (EntityID = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND Name = 'Company')) BEGIN
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
            'e8a8c65a-8a0c-4b3c-9508-6d65ed63f1c0',
            '84246B5D-4431-489A-9186-DF3C6DE711EA', -- Entity: MJ_BizApps_Sales: Deal Digest Recipients
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '84246B5D-4431-489A-9186-DF3C6DE711EA'),
            'Company',
            'Company',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '01f39adb-01d3-4d1c-9b64-d4128df72f0f' OR (EntityID = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND Name = 'Employee')) BEGIN
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
            '01f39adb-01d3-4d1c-9b64-d4128df72f0f',
            '84246B5D-4431-489A-9186-DF3C6DE711EA', -- Entity: MJ_BizApps_Sales: Deal Digest Recipients
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '84246B5D-4431-489A-9186-DF3C6DE711EA'),
            'Employee',
            'Employee',
            NULL,
            'nvarchar',
            162,
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

/* Set field properties for entity */

               UPDATE [${mjSchema}].[EntityField]
               SET DefaultInView = 1
               WHERE ID = '75E82953-084E-4D32-8D74-16B13C96F042'
               AND AutoUpdateDefaultInView = 1;

               UPDATE [${mjSchema}].[EntityField]
               SET DefaultInView = 1
               WHERE ID = '522EB3E7-BF6E-4759-8532-7301BC58C25D'
               AND AutoUpdateDefaultInView = 1;

            UPDATE [${mjSchema}].[Entity]
            SET AllowUserSearchAPI = 0
            WHERE ID = 'B16A4047-9415-4F1B-9F6C-59104E788C53'
            AND AutoUpdateAllowUserSearchAPI = 1;

/* Set field properties for entity */

               UPDATE [${mjSchema}].[EntityField]
               SET DefaultInView = 1
               WHERE ID = 'F80BE1F3-8D83-4772-A873-E5962981A629'
               AND AutoUpdateDefaultInView = 1;

               UPDATE [${mjSchema}].[EntityField]
               SET DefaultInView = 1
               WHERE ID = 'E8A8C65A-8A0C-4B3C-9508-6D65ED63F1C0'
               AND AutoUpdateDefaultInView = 1;

               UPDATE [${mjSchema}].[EntityField]
               SET DefaultInView = 1
               WHERE ID = '01F39ADB-01D3-4D1C-9B64-D4128DF72F0F'
               AND AutoUpdateDefaultInView = 1;

/* Set categories for 16 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.ID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'AD7259CD-C7E9-4599-B118-2748BEB3B1B4';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.Code 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Audience Details',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '413E6BB6-7AB6-4987-9149-B6CE0D9A8729';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.Name 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Audience Details',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'FB29262F-F418-444A-86B7-633DF8A0E2FB';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.Description 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Audience Details',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '0AFAA0E7-F80B-4D2D-AD1D-3593A0A50598';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.IsPortfolioWide 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Behavior Settings',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '3689B893-4C73-451C-A1FE-54EB9F51480B';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.MinDaysLapsed 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Behavior Settings',
   GeneratedFormSection = 'Category',
   DisplayName = 'Minimum Days Lapsed'
WHERE 
   ID = '62A9C710-A1BE-413A-9433-BA97779E4CF2';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.IncludeMissingCloseDate 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Behavior Settings',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '537B6AC9-CD1B-42A7-86AB-C60E7E09C83B';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.SendWhenEmpty 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Behavior Settings',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '3DCF0226-63EE-4526-9DCC-CA31720CEA62';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.GroupByCompany 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Behavior Settings',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'A0CFB168-C50C-4FBF-9198-E0571E69C495';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.SubjectTemplate 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Email Templates',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '8945982E-635B-4CBC-93C2-28DBE50F8DA5';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.IntroTemplate 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Email Templates',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'CE02923D-A19C-4951-B30D-D57FDEE47BD4';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.EmptyMessage 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Email Templates',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '79C5B52F-022E-4161-AFCB-B8C796AF8D2D';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.DisplayRank 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Audience Details',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '75E82953-084E-4D32-8D74-16B13C96F042';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.IsActive 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Audience Details',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '522EB3E7-BF6E-4759-8532-7301BC58C25D';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.__mj_CreatedAt 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'B6E73F12-A7E8-4616-8E44-221267D2B56B';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.__mj_UpdatedAt 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '123A10F9-5785-447B-82C4-FF4785429B82';

/* Set entity icon to fa fa-bullhorn */

               UPDATE [${mjSchema}].[Entity]
               SET [Icon] = 'fa fa-bullhorn', [__mj_UpdatedAt] = GETUTCDATE()
               WHERE [ID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53';

/* Insert FieldCategoryInfo setting for entity */
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntitySetting] WHERE [EntityID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND [Name] = 'FieldCategoryInfo'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntitySetting] ([ID], [EntityID], [Name], [Value], [__mj_CreatedAt], [__mj_UpdatedAt])
               VALUES ('83350444-469b-5fe9-9ae0-dd6546b4e770', 'B16A4047-9415-4F1B-9F6C-59104E788C53', 'FieldCategoryInfo', '{
  "Audience Details": {
    "description": "Core identifying details and administrative settings for the audience type",
    "icon": "fa fa-id-card"
  },
  "Behavior Settings": {
    "description": "Flags and thresholds that control how the digest builder processes this audience",
    "icon": "fa fa-sliders-h"
  },
  "Email Templates": {
    "description": "Customizable content templates for emails sent to this audience",
    "icon": "fa fa-envelope-open-text"
  },
  "System Metadata": {
    "description": "System-managed audit and tracking fields",
    "icon": "fa fa-cog"
  }
}', GETUTCDATE(), GETUTCDATE())
   END;

/* Insert FieldCategoryIcons setting (legacy) */
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntitySetting] WHERE [EntityID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND [Name] = 'FieldCategoryIcons'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntitySetting] ([ID], [EntityID], [Name], [Value], [__mj_CreatedAt], [__mj_UpdatedAt])
               VALUES ('99fcd5c7-d169-5950-a770-a1f186f2c756', 'B16A4047-9415-4F1B-9F6C-59104E788C53', 'FieldCategoryIcons', '{
  "Audience Details": "fa fa-id-card",
  "Behavior Settings": "fa fa-sliders-h",
  "Email Templates": "fa fa-envelope-open-text",
  "System Metadata": "fa fa-cog"
}', GETUTCDATE(), GETUTCDATE())
   END;

/* Set DefaultForNewUser=false for NEW entity (category: reference, confidence: high) */

         UPDATE [${mjSchema}].[ApplicationEntity]
         SET [DefaultForNewUser] = 0, [__mj_UpdatedAt] = GETUTCDATE()
         WHERE [EntityID] = 'B16A4047-9415-4F1B-9F6C-59104E788C53';

/* Set categories for 10 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Recipients.ID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'A55DA574-D8CD-40A3-B21C-C5C36C587470';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Recipients.DealDigestAudienceTypeID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Recipient Configuration',
   GeneratedFormSection = 'Category',
   DisplayName = 'Deal Digest Audience Type'
WHERE 
   ID = '89CCCBE5-36DB-4DA6-BD69-EAC1819CD304';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Recipients.CompanyID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Recipient Configuration',
   GeneratedFormSection = 'Category',
   DisplayName = 'Company'
WHERE 
   ID = '0621F6C2-AB9D-4FEC-A43B-E30D04DE8510';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Recipients.EmployeeID 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Recipient Configuration',
   GeneratedFormSection = 'Category',
   DisplayName = 'Employee'
WHERE 
   ID = '1AEDE892-EC14-4FD6-AFF4-CFEA9FEBA337';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Recipients.IsActive 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Recipient Configuration',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'EE5F6659-FC92-4C3E-AF80-A9C08A3E9744';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Recipients.DealDigestAudienceType 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Recipient Configuration',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'F80BE1F3-8D83-4772-A873-E5962981A629';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Recipients.Company 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Recipient Configuration',
   GeneratedFormSection = 'Category',
   DisplayName = 'Company Name'
WHERE 
   ID = 'E8A8C65A-8A0C-4B3C-9508-6D65ED63F1C0';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Recipients.Employee 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Recipient Configuration',
   GeneratedFormSection = 'Category',
   DisplayName = 'Employee Name'
WHERE 
   ID = '01F39ADB-01D3-4D1C-9B64-D4128DF72F0F';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Recipients.__mj_CreatedAt 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'F691662F-6BCD-47DF-B894-85163407B296';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Recipients.__mj_UpdatedAt 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'System Metadata',
   GeneratedFormSection = 'Category'
WHERE 
   ID = '2D17A29B-BCC0-457D-A70B-F29D7E7F8A70';

/* Set entity icon to fa fa-envelope-open-text */

               UPDATE [${mjSchema}].[Entity]
               SET [Icon] = 'fa fa-envelope-open-text', [__mj_UpdatedAt] = GETUTCDATE()
               WHERE [ID] = '84246B5D-4431-489A-9186-DF3C6DE711EA';

/* Insert FieldCategoryInfo setting for entity */
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntitySetting] WHERE [EntityID] = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND [Name] = 'FieldCategoryInfo'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntitySetting] ([ID], [EntityID], [Name], [Value], [__mj_CreatedAt], [__mj_UpdatedAt])
               VALUES ('fb52b1c6-daa7-5d54-960f-070f48c57331', '84246B5D-4431-489A-9186-DF3C6DE711EA', 'FieldCategoryInfo', '{
  "Recipient Configuration": {
    "description": "Configuration settings determining who receives specific digest audiences and companies",
    "icon": "fa fa-users"
  },
  "System Metadata": {
    "description": "System-managed audit and tracking fields",
    "icon": "fa fa-cog"
  }
}', GETUTCDATE(), GETUTCDATE())
   END;

/* Insert FieldCategoryIcons setting (legacy) */
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntitySetting] WHERE [EntityID] = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND [Name] = 'FieldCategoryIcons'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntitySetting] ([ID], [EntityID], [Name], [Value], [__mj_CreatedAt], [__mj_UpdatedAt])
               VALUES ('a8ee8c56-4f32-5d12-adc3-dc32eacf8411', '84246B5D-4431-489A-9186-DF3C6DE711EA', 'FieldCategoryIcons', '{
  "Recipient Configuration": "fa fa-users",
  "System Metadata": "fa fa-cog"
}', GETUTCDATE(), GETUTCDATE())
   END;

/* Set DefaultForNewUser=true for NEW entity (category: supporting, confidence: high) */

         UPDATE [${mjSchema}].[ApplicationEntity]
         SET [DefaultForNewUser] = 1, [__mj_UpdatedAt] = GETUTCDATE()
         WHERE [EntityID] = '84246B5D-4431-489A-9186-DF3C6DE711EA';

/* Generated Validation Functions for MJ_BizApps_Sales: Deal Digest Audience Types */
-- CHECK constraint for MJ_BizApps_Sales: Deal Digest Audience Types: Field: MinDaysLapsed was newly set or modified since the last generation of the validation function, the code was regenerated and updating the GeneratedCode table with the new generated validation function
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[GeneratedCode] WHERE [CategoryID] = (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators') AND [LinkedEntityID] = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND [LinkedRecordPrimaryKey] = '62A9C710-A1BE-413A-9433-BA97779E4CF2'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[GeneratedCode] ([ID], [CategoryID], [GeneratedByModelID], [GeneratedAt], [Language], [Status], [Source], [Code], [Description], [Name], [LinkedEntityID], [LinkedRecordPrimaryKey])
VALUES ('ac9492a4-f306-44d3-aa24-3a289780dc09', (SELECT [ID] FROM [${mjSchema}].[vwGeneratedCodeCategories] WHERE [Name]='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', GETUTCDATE(), 'TypeScript', 'Approved', '([MinDaysLapsed] IS NULL OR [MinDaysLapsed]>=(0))', 'public ValidateMinDaysLapsedNonNegative(result: ValidationResult): void {
	if (this.MinDaysLapsed != null && this.MinDaysLapsed < 0) {
		result.Errors.push(new ValidationErrorInfo(
			"MinDaysLapsed",
			"Minimum days lapsed cannot be negative.",
			this.MinDaysLapsed,
			ValidationErrorType.Failure
		));
	}
}', 'Minimum days lapsed must be zero or a positive number when specified.', 'ValidateMinDaysLapsedNonNegative', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', '62A9C710-A1BE-413A-9433-BA97779E4CF2')
   END;


-- =============================================================================
-- END OF CODEGEN OUTPUT. Hand-written from here.
-- =============================================================================
-- FIELD SYNC FOR THE TWO NEW ENTITIES, SCOPED TO THEM.
--
-- CodeGen's special-date-field setup above adds __mj_CreatedAt and __mj_UpdatedAt
-- as NULL, backfills them, then ALTERs them to NOT NULL. `omitRecurringScriptsFromLog`
-- keeps the reconciler that copies a column's type, length and nullability into
-- __mj.EntityField out of the capture, so the migration carries it itself or every
-- host installed from migrations keeps the pre-ALTER nullability in its metadata.
--
-- Entity-scoped, never schema-wide: the schema-wide form reconciles entities this
-- migration never touched against whatever intermediate state a replay has reached.
-- @EntityIDs is comma-split by the proc, so both entities go in one call.
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='B16A4047-9415-4F1B-9F6C-59104E788C53,84246B5D-4431-489A-9186-DF3C6DE711EA', @IncludedSchemaNames='${flyway:defaultSchema}';
GO

-- CODEGEN'S SEARCH-FLAG HYGIENE, SCOPED TO THIS MIGRATION'S OWN ENTITY.
--
-- CodeGen emits this as a schema-wide sweep: it clears AllowUserSearchAPI on
-- every entity in the instance that has no searchable field, excluding a list of
-- schemas built from the GENERATING MACHINE's inventory. Shipped as emitted, it
-- would act on entities this migration never touched, in apps installed beside
-- this one, and the exclusion list would be whatever happened to exist on the
-- laptop that ran CodeGen. V202611062300 ships the scoped form instead, and so
-- does this.
--
-- Only Deal Digest Recipients appears here because the capture above already
-- carries CodeGen's own per-entity clear for Deal Digest Audience Types; the
-- sweep was the only thing covering Recipients. Both entities are created with
-- AllowUserSearchAPI = 1 and end this migration at 0.
-- AutoUpdateAllowUserSearchAPI = 1 is CodeGen's own guard: a host that set the
-- flag deliberately is left alone.
UPDATE [${mjSchema}].[Entity]
SET AllowUserSearchAPI = 0
WHERE ID = '84246B5D-4431-489A-9186-DF3C6DE711EA'
AND AutoUpdateAllowUserSearchAPI = 1;
GO
