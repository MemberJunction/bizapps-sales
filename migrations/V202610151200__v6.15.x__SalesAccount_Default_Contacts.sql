-- =============================================================================
-- Sales Account: a default primary contact and a default billing contact (#254).
-- =============================================================================
-- A rep entering a deal picks the account, then searches every contact by name for
-- the primary and the billing contact. For an account that buys repeatedly those
-- are usually the same people each time. These two columns let the account say who
-- they are, and a deal fills its own empty contact fields from them when the
-- account is chosen. The deal's values stay editable; the account only supplies a
-- starting point.
--
-- BOTH NULLABLE. Most accounts will never set them, and an empty default means
-- "nothing to fill", not a missing value.
--
-- FOREIGN KEYS TO SalesContact, the same target as Deal.PrimaryContactID and
-- Deal.BillingContactID, so a default can be copied onto a deal without changing
-- what kind of record it names.
--
-- NOT RESTRICTED TO THE ACCOUNT'S OWN PEOPLE. A contact carries no link to an
-- account today (#301), so there is nothing to check the default against.
-- =============================================================================

ALTER TABLE [${flyway:defaultSchema}].[SalesAccount]
    ADD DefaultPrimaryContactID UNIQUEIDENTIFIER NULL
            CONSTRAINT FK_SalesAccount_DefaultPrimaryContact
                FOREIGN KEY REFERENCES [${flyway:defaultSchema}].[SalesContact] (ID),
        DefaultBillingContactID UNIQUEIDENTIFIER NULL
            CONSTRAINT FK_SalesAccount_DefaultBillingContact
                FOREIGN KEY REFERENCES [${flyway:defaultSchema}].[SalesContact] (ID);
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Contact a new deal for this account starts with as its Primary Contact. Copied onto a deal only when the deal''s Primary Contact is empty; the deal''s value stays editable.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'SalesAccount',
    @level2type = N'COLUMN', @level2name = N'DefaultPrimaryContactID';
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Contact a new deal for this account starts with as its Billing Contact. Copied onto a deal only when the deal''s Billing Contact is empty; the deal''s value stays editable. Empty means the deal''s billing contact follows its primary contact.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'SalesAccount',
    @level2type = N'COLUMN', @level2name = N'DefaultBillingContactID';
GO


















































-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================

/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 2 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'f32701f4-7647-4560-be0c-990d3ed1df85' OR (EntityID = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A' AND Name = 'DefaultPrimaryContactID')) BEGIN
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
            'f32701f4-7647-4560-be0c-990d3ed1df85',
            '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A', -- Entity: MJ_BizApps_Sales: Sales Accounts
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A'),
            'DefaultPrimaryContactID',
            'Default Primary Contact ID',
            'Contact a new deal for this account starts with as its Primary Contact. Copied onto a deal only when the deal''s Primary Contact is empty; the deal''s value stays editable.',
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
            '530174B2-654E-4E14-BF28-3EF29AC9833D',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'cd977001-3c58-4a59-86bf-eb81ab9ec2fe' OR (EntityID = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A' AND Name = 'DefaultBillingContactID')) BEGIN
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
            'cd977001-3c58-4a59-86bf-eb81ab9ec2fe',
            '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A', -- Entity: MJ_BizApps_Sales: Sales Accounts
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A'),
            'DefaultBillingContactID',
            'Default Billing Contact ID',
            'Contact a new deal for this account starts with as its Billing Contact. Copied onto a deal only when the deal''s Billing Contact is empty; the deal''s value stays editable. Empty means the deal''s billing contact follows its primary contact.',
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
            '530174B2-654E-4E14-BF28-3EF29AC9833D',
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

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';


/* Create Entity Relationship: MJ_BizApps_Sales: Sales Contacts -> MJ_BizApps_Sales: Sales Accounts (One To Many via DefaultPrimaryContactID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'edd80ce5-4a99-4176-b9c0-f78b2a0af68c'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('edd80ce5-4a99-4176-b9c0-f78b2a0af68c', '530174B2-654E-4E14-BF28-3EF29AC9833D', '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A', 'DefaultPrimaryContactID', 'One To Many', 1, 1, 4, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ_BizApps_Sales: Sales Contacts -> MJ_BizApps_Sales: Sales Accounts (One To Many via DefaultBillingContactID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'd5e97995-2571-4696-bb32-fedffa5e2e00'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('d5e97995-2571-4696-bb32-fedffa5e2e00', '530174B2-654E-4E14-BF28-3EF29AC9833D', '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A', 'DefaultBillingContactID', 'One To Many', 1, 1, 5, GETUTCDATE(), GETUTCDATE())
   END;

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Index for Foreign Keys for SalesAccount */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Sales Accounts
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key OwnerEmployeeID in table SalesAccount
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SalesAccount_OwnerEmployeeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SalesAccount]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SalesAccount_OwnerEmployeeID ON [${flyway:defaultSchema}].[SalesAccount] ([OwnerEmployeeID]);

-- Index for foreign key AccountTypeID in table SalesAccount
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SalesAccount_AccountTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SalesAccount]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SalesAccount_AccountTypeID ON [${flyway:defaultSchema}].[SalesAccount] ([AccountTypeID]);

-- Index for foreign key LifecycleStageTypeID in table SalesAccount
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SalesAccount_LifecycleStageTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SalesAccount]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SalesAccount_LifecycleStageTypeID ON [${flyway:defaultSchema}].[SalesAccount] ([LifecycleStageTypeID]);

-- Index for foreign key LeadSourceTypeID in table SalesAccount
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SalesAccount_LeadSourceTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SalesAccount]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SalesAccount_LeadSourceTypeID ON [${flyway:defaultSchema}].[SalesAccount] ([LeadSourceTypeID]);

-- Index for foreign key DefaultPrimaryContactID in table SalesAccount
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SalesAccount_DefaultPrimaryContactID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SalesAccount]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SalesAccount_DefaultPrimaryContactID ON [${flyway:defaultSchema}].[SalesAccount] ([DefaultPrimaryContactID]);

-- Index for foreign key DefaultBillingContactID in table SalesAccount
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SalesAccount_DefaultBillingContactID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SalesAccount]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SalesAccount_DefaultBillingContactID ON [${flyway:defaultSchema}].[SalesAccount] ([DefaultBillingContactID]);

/* SQL text to update entity field related entity name field map for entity field ID F32701F4-7647-4560-BE0C-990D3ED1DF85 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='F32701F4-7647-4560-BE0C-990D3ED1DF85', @RelatedEntityNameFieldMap='DefaultPrimaryContact';

/* SQL text to update entity field related entity name field map for entity field ID CD977001-3C58-4A59-86BF-EB81AB9EC2FE */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='CD977001-3C58-4A59-86BF-EB81AB9EC2FE', @RelatedEntityNameFieldMap='DefaultBillingContact';

/* Base View SQL for MJ_BizApps_Sales: Sales Accounts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Sales Accounts
-- Item: vwSalesAccounts
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Sales Accounts
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  SalesAccount
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSalesAccounts]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSalesAccounts];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSalesAccounts]
AS
SELECT
    s.*,
    ${mjSchema}_isa_p1.[Name],
    ${mjSchema}_isa_p1.[LegalName],
    ${mjSchema}_isa_p1.[OrganizationTypeID],
    ${mjSchema}_isa_p1.[ParentID],
    ${mjSchema}_isa_p1.[Website],
    ${mjSchema}_isa_p1.[LogoURL],
    ${mjSchema}_isa_p1.[Description],
    ${mjSchema}_isa_p1.[Email],
    ${mjSchema}_isa_p1.[Phone],
    ${mjSchema}_isa_p1.[FoundedDate],
    ${mjSchema}_isa_p1.[TaxID],
    ${mjSchema}_isa_p1.[Status],
    MJEmployee_OwnerEmployeeID.[FirstLast] AS [OwnerEmployee],
    mjBizAppsSalesAccountType_AccountTypeID.[Name] AS [AccountType],
    mjBizAppsSalesLifecycleStageType_LifecycleStageTypeID.[Name] AS [LifecycleStageType],
    mjBizAppsSalesLeadSourceType_LeadSourceTypeID.[Name] AS [LeadSourceType],
    mjBizAppsSalesSalesContact_DefaultPrimaryContactID.[DisplayNameAndEmail] AS [DefaultPrimaryContact],
    mjBizAppsSalesSalesContact_DefaultBillingContactID.[DisplayNameAndEmail] AS [DefaultBillingContact]
FROM
    [${flyway:defaultSchema}].[SalesAccount] AS s
INNER JOIN
    [${mjSchema}_BizAppsCommon].[Organization] AS ${mjSchema}_isa_p1
  ON
    [s].[ID] = ${mjSchema}_isa_p1.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[vwEmployees] AS MJEmployee_OwnerEmployeeID
  ON
    [s].[OwnerEmployeeID] = MJEmployee_OwnerEmployeeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[AccountType] AS mjBizAppsSalesAccountType_AccountTypeID
  ON
    [s].[AccountTypeID] = mjBizAppsSalesAccountType_AccountTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[LifecycleStageType] AS mjBizAppsSalesLifecycleStageType_LifecycleStageTypeID
  ON
    [s].[LifecycleStageTypeID] = mjBizAppsSalesLifecycleStageType_LifecycleStageTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[LeadSourceType] AS mjBizAppsSalesLeadSourceType_LeadSourceTypeID
  ON
    [s].[LeadSourceTypeID] = mjBizAppsSalesLeadSourceType_LeadSourceTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[vwSalesContacts] AS mjBizAppsSalesSalesContact_DefaultPrimaryContactID
  ON
    [s].[DefaultPrimaryContactID] = mjBizAppsSalesSalesContact_DefaultPrimaryContactID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[vwSalesContacts] AS mjBizAppsSalesSalesContact_DefaultBillingContactID
  ON
    [s].[DefaultBillingContactID] = mjBizAppsSalesSalesContact_DefaultBillingContactID.[ID]
GO
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSalesAccounts] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSalesAccounts] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSalesAccounts] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwSalesAccounts] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Sales: Sales Accounts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Sales Accounts
-- Item: Permissions for vwSalesAccounts
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

REVOKE SELECT ON [${flyway:defaultSchema}].[vwSalesAccounts] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSalesAccounts] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSalesAccounts] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwSalesAccounts] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Sales: Sales Accounts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Sales Accounts
-- Item: spCreateSalesAccount
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR SalesAccount
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSalesAccount]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSalesAccount];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSalesAccount]
    @ID uniqueidentifier = NULL,
    @OwnerEmployeeID_Clear bit = 0,
    @OwnerEmployeeID uniqueidentifier = NULL,
    @AccountTypeID_Clear bit = 0,
    @AccountTypeID uniqueidentifier = NULL,
    @LifecycleStageTypeID_Clear bit = 0,
    @LifecycleStageTypeID uniqueidentifier = NULL,
    @LeadSourceTypeID_Clear bit = 0,
    @LeadSourceTypeID uniqueidentifier = NULL,
    @Territory_Clear bit = 0,
    @Territory nvarchar(100) = NULL,
    @Tier_Clear bit = 0,
    @Tier nvarchar(50) = NULL,
    @ICPFitScore_Clear bit = 0,
    @ICPFitScore int = NULL,
    @IndustryCode_Clear bit = 0,
    @IndustryCode nvarchar(50) = NULL,
    @EmployeeCountBand_Clear bit = 0,
    @EmployeeCountBand nvarchar(50) = NULL,
    @AnnualRevenueBand_Clear bit = 0,
    @AnnualRevenueBand nvarchar(50) = NULL,
    @HealthStatus_Clear bit = 0,
    @HealthStatus nvarchar(50) = NULL,
    @FirstClosedWonDate_Clear bit = 0,
    @FirstClosedWonDate date = NULL,
    @IsActive bit = NULL,
    @DefaultPrimaryContactID_Clear bit = 0,
    @DefaultPrimaryContactID uniqueidentifier = NULL,
    @DefaultBillingContactID_Clear bit = 0,
    @DefaultBillingContactID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @ActualID UNIQUEIDENTIFIER = ISNULL(@ID, NEWID())
    INSERT INTO
    [${flyway:defaultSchema}].[SalesAccount]
        (
            [OwnerEmployeeID],
                [AccountTypeID],
                [LifecycleStageTypeID],
                [LeadSourceTypeID],
                [Territory],
                [Tier],
                [ICPFitScore],
                [IndustryCode],
                [EmployeeCountBand],
                [AnnualRevenueBand],
                [HealthStatus],
                [FirstClosedWonDate],
                [IsActive],
                [DefaultPrimaryContactID],
                [DefaultBillingContactID],
                [ID]
        )
    VALUES
        (
            CASE WHEN @OwnerEmployeeID_Clear = 1 THEN NULL ELSE ISNULL(@OwnerEmployeeID, NULL) END,
                CASE WHEN @AccountTypeID_Clear = 1 THEN NULL ELSE ISNULL(@AccountTypeID, NULL) END,
                CASE WHEN @LifecycleStageTypeID_Clear = 1 THEN NULL ELSE ISNULL(@LifecycleStageTypeID, NULL) END,
                CASE WHEN @LeadSourceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@LeadSourceTypeID, NULL) END,
                CASE WHEN @Territory_Clear = 1 THEN NULL ELSE ISNULL(@Territory, NULL) END,
                CASE WHEN @Tier_Clear = 1 THEN NULL ELSE ISNULL(@Tier, NULL) END,
                CASE WHEN @ICPFitScore_Clear = 1 THEN NULL ELSE ISNULL(@ICPFitScore, NULL) END,
                CASE WHEN @IndustryCode_Clear = 1 THEN NULL ELSE ISNULL(@IndustryCode, NULL) END,
                CASE WHEN @EmployeeCountBand_Clear = 1 THEN NULL ELSE ISNULL(@EmployeeCountBand, NULL) END,
                CASE WHEN @AnnualRevenueBand_Clear = 1 THEN NULL ELSE ISNULL(@AnnualRevenueBand, NULL) END,
                CASE WHEN @HealthStatus_Clear = 1 THEN NULL ELSE ISNULL(@HealthStatus, NULL) END,
                CASE WHEN @FirstClosedWonDate_Clear = 1 THEN NULL ELSE ISNULL(@FirstClosedWonDate, NULL) END,
                ISNULL(@IsActive, 1),
                CASE WHEN @DefaultPrimaryContactID_Clear = 1 THEN NULL ELSE ISNULL(@DefaultPrimaryContactID, NULL) END,
                CASE WHEN @DefaultBillingContactID_Clear = 1 THEN NULL ELSE ISNULL(@DefaultBillingContactID, NULL) END,
                @ActualID
        )
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSalesAccounts] WHERE [ID] = @ActualID
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSalesAccount] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSalesAccount] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSalesAccount] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Sales: Sales Accounts */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSalesAccount] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSalesAccount] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSalesAccount] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Sales: Sales Accounts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Sales Accounts
-- Item: spUpdateSalesAccount
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR SalesAccount
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSalesAccount]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSalesAccount];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSalesAccount]
    @ID uniqueidentifier,
    @OwnerEmployeeID_Clear bit = 0,
    @OwnerEmployeeID uniqueidentifier = NULL,
    @AccountTypeID_Clear bit = 0,
    @AccountTypeID uniqueidentifier = NULL,
    @LifecycleStageTypeID_Clear bit = 0,
    @LifecycleStageTypeID uniqueidentifier = NULL,
    @LeadSourceTypeID_Clear bit = 0,
    @LeadSourceTypeID uniqueidentifier = NULL,
    @Territory_Clear bit = 0,
    @Territory nvarchar(100) = NULL,
    @Tier_Clear bit = 0,
    @Tier nvarchar(50) = NULL,
    @ICPFitScore_Clear bit = 0,
    @ICPFitScore int = NULL,
    @IndustryCode_Clear bit = 0,
    @IndustryCode nvarchar(50) = NULL,
    @EmployeeCountBand_Clear bit = 0,
    @EmployeeCountBand nvarchar(50) = NULL,
    @AnnualRevenueBand_Clear bit = 0,
    @AnnualRevenueBand nvarchar(50) = NULL,
    @HealthStatus_Clear bit = 0,
    @HealthStatus nvarchar(50) = NULL,
    @FirstClosedWonDate_Clear bit = 0,
    @FirstClosedWonDate date = NULL,
    @IsActive bit = NULL,
    @DefaultPrimaryContactID_Clear bit = 0,
    @DefaultPrimaryContactID uniqueidentifier = NULL,
    @DefaultBillingContactID_Clear bit = 0,
    @DefaultBillingContactID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SalesAccount]
    SET
        [OwnerEmployeeID] = CASE WHEN @OwnerEmployeeID_Clear = 1 THEN NULL ELSE ISNULL(@OwnerEmployeeID, [OwnerEmployeeID]) END,
        [AccountTypeID] = CASE WHEN @AccountTypeID_Clear = 1 THEN NULL ELSE ISNULL(@AccountTypeID, [AccountTypeID]) END,
        [LifecycleStageTypeID] = CASE WHEN @LifecycleStageTypeID_Clear = 1 THEN NULL ELSE ISNULL(@LifecycleStageTypeID, [LifecycleStageTypeID]) END,
        [LeadSourceTypeID] = CASE WHEN @LeadSourceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@LeadSourceTypeID, [LeadSourceTypeID]) END,
        [Territory] = CASE WHEN @Territory_Clear = 1 THEN NULL ELSE ISNULL(@Territory, [Territory]) END,
        [Tier] = CASE WHEN @Tier_Clear = 1 THEN NULL ELSE ISNULL(@Tier, [Tier]) END,
        [ICPFitScore] = CASE WHEN @ICPFitScore_Clear = 1 THEN NULL ELSE ISNULL(@ICPFitScore, [ICPFitScore]) END,
        [IndustryCode] = CASE WHEN @IndustryCode_Clear = 1 THEN NULL ELSE ISNULL(@IndustryCode, [IndustryCode]) END,
        [EmployeeCountBand] = CASE WHEN @EmployeeCountBand_Clear = 1 THEN NULL ELSE ISNULL(@EmployeeCountBand, [EmployeeCountBand]) END,
        [AnnualRevenueBand] = CASE WHEN @AnnualRevenueBand_Clear = 1 THEN NULL ELSE ISNULL(@AnnualRevenueBand, [AnnualRevenueBand]) END,
        [HealthStatus] = CASE WHEN @HealthStatus_Clear = 1 THEN NULL ELSE ISNULL(@HealthStatus, [HealthStatus]) END,
        [FirstClosedWonDate] = CASE WHEN @FirstClosedWonDate_Clear = 1 THEN NULL ELSE ISNULL(@FirstClosedWonDate, [FirstClosedWonDate]) END,
        [IsActive] = ISNULL(@IsActive, [IsActive]),
        [DefaultPrimaryContactID] = CASE WHEN @DefaultPrimaryContactID_Clear = 1 THEN NULL ELSE ISNULL(@DefaultPrimaryContactID, [DefaultPrimaryContactID]) END,
        [DefaultBillingContactID] = CASE WHEN @DefaultBillingContactID_Clear = 1 THEN NULL ELSE ISNULL(@DefaultBillingContactID, [DefaultBillingContactID]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSalesAccounts] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSalesAccounts]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSalesAccount] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSalesAccount] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSalesAccount] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the SalesAccount table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSalesAccount]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSalesAccount];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSalesAccount
ON [${flyway:defaultSchema}].[SalesAccount]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SalesAccount]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[SalesAccount] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Sales: Sales Accounts */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSalesAccount] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSalesAccount] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSalesAccount] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Sales: Sales Accounts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Sales Accounts
-- Item: spDeleteSalesAccount
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR SalesAccount
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSalesAccount]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSalesAccount];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSalesAccount]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[SalesAccount]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSalesAccount] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSalesAccount] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSalesAccount] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Sales: Sales Accounts */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSalesAccount] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSalesAccount] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSalesAccount] TO [cdp_Developer], [cdp_Integration];

/* SQL text to delete unneeded entity fields (1 scoped entities) */
EXEC [${mjSchema}].[spDeleteUnneededEntityFields] @ExcludedSchemaNames='', @EntityIDs='15A9B6F8-9566-4A37-8588-2D00E8F1CB9A', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 2 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'cf73d195-9ab0-4034-84ec-a95c1906895c' OR (EntityID = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A' AND Name = 'DefaultPrimaryContact')) BEGIN
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
            'cf73d195-9ab0-4034-84ec-a95c1906895c',
            '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A', -- Entity: MJ_BizApps_Sales: Sales Accounts
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A'),
            'DefaultPrimaryContact',
            'Default Primary Contact',
            NULL,
            'nvarchar',
            1408,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '9a978798-796f-4c77-b2e1-2c7255f33baa' OR (EntityID = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A' AND Name = 'DefaultBillingContact')) BEGIN
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
            '9a978798-796f-4c77-b2e1-2c7255f33baa',
            '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A', -- Entity: MJ_BizApps_Sales: Sales Accounts
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A'),
            'DefaultBillingContact',
            'Default Billing Contact',
            NULL,
            'nvarchar',
            1408,
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

/* SQL text to update existing entity fields from schema (1 scoped entities) */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='15A9B6F8-9566-4A37-8588-2D00E8F1CB9A', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

