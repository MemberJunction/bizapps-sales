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
