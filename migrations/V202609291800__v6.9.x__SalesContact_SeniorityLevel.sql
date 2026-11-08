-- =============================================================================
-- Sales Contacts inherits Person.SeniorityLevelID (bizapps-common v5.45.x).
-- =============================================================================
-- Common's V202609211200 added SeniorityLevelID to __mj_BizAppsCommon.Person. Sales Contacts
-- IS-A People, so it needs the column in its base view and the inherited virtual EntityField.
-- No Sales migration shipped either (#148).
--
-- WHY THE VIEWS ARE REBUILT BY HAND, ABOVE THE CODEGEN BLOCK.
--
-- Sales Contacts has a layered base view (V202609190900 / V202609190901): CodeGen owns
-- vwSalesContactsGenerated, and vwSalesContacts is `SELECT g.*, <DisplayNameAndEmail>` over it.
-- SQL Server fixes a `*` view's column list when the view is created, so when the inner view gains
-- a column the wrapper keeps its old list and returns the values under the wrong names. Measured on
-- a migrations-only database: after CodeGen rebuilt the inner view, vwSalesContacts returned
-- SeniorityLevelID in its OwnerEmployee column, and CodeGen's entityFieldsSequenceCheck failed.
--
-- So the inner view gains the column here and the wrapper is refreshed before the CodeGen block
-- runs. The CodeGen block then recreates the inner view with the same column list, which leaves the
-- wrapper's binding valid, and sequences the new field against a view that already returns it.
--
-- The inner view below is CodeGen's current definition. If this entity is ever re-captured, the
-- generated view must keep the same column list as this one, or the wrapper needs another refresh.
-- =============================================================================

DROP VIEW [${flyway:defaultSchema}].[vwSalesContactsGenerated];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSalesContactsGenerated]
AS
SELECT
    s.*,
    __mj_isa_p1.[FirstName],
    __mj_isa_p1.[LastName],
    __mj_isa_p1.[MiddleName],
    __mj_isa_p1.[Prefix],
    __mj_isa_p1.[Suffix],
    __mj_isa_p1.[PreferredName],
    __mj_isa_p1.[Title],
    __mj_isa_p1.[Email],
    __mj_isa_p1.[Phone],
    __mj_isa_p1.[DateOfBirth],
    __mj_isa_p1.[Gender],
    __mj_isa_p1.[PhotoURL],
    __mj_isa_p1.[Bio],
    __mj_isa_p1.[LinkedUserID],
    __mj_isa_p1.[Status],
    __mj_isa_p1.[SeniorityLevelID],
    MJEmployee_OwnerEmployeeID.[FirstLast] AS [OwnerEmployee],
    mjBizAppsSalesLifecycleStageType_LifecycleStageTypeID.[Name] AS [LifecycleStageType],
    mjBizAppsSalesBuyingRoleType_BuyingRoleTypeID.[Name] AS [BuyingRoleType],
    mjBizAppsSalesLeadSourceType_LeadSourceTypeID.[Name] AS [LeadSourceType]
FROM
    [${flyway:defaultSchema}].[SalesContact] AS s
INNER JOIN
    [__mj_BizAppsCommon].[Person] AS __mj_isa_p1
  ON
    [s].[ID] = __mj_isa_p1.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[vwEmployees] AS MJEmployee_OwnerEmployeeID
  ON
    [s].[OwnerEmployeeID] = MJEmployee_OwnerEmployeeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[LifecycleStageType] AS mjBizAppsSalesLifecycleStageType_LifecycleStageTypeID
  ON
    [s].[LifecycleStageTypeID] = mjBizAppsSalesLifecycleStageType_LifecycleStageTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[BuyingRoleType] AS mjBizAppsSalesBuyingRoleType_BuyingRoleTypeID
  ON
    [s].[BuyingRoleTypeID] = mjBizAppsSalesBuyingRoleType_BuyingRoleTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[LeadSourceType] AS mjBizAppsSalesLeadSourceType_LeadSourceTypeID
  ON
    [s].[LeadSourceTypeID] = mjBizAppsSalesLeadSourceType_LeadSourceTypeID.[ID]
GO

EXEC sp_refreshview '[${flyway:defaultSchema}].[vwSalesContacts]';
GO


















































-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================


/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 1 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '92be72d3-13e6-4dd2-951b-bcb20ee2c446' OR (EntityID = '530174B2-654E-4E14-BF28-3EF29AC9833D' AND Name = 'SeniorityLevelID')) BEGIN
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
            '92be72d3-13e6-4dd2-951b-bcb20ee2c446',
            '530174B2-654E-4E14-BF28-3EF29AC9833D', -- Entity: MJ_BizApps_Sales: Sales Contacts
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '530174B2-654E-4E14-BF28-3EF29AC9833D'),
            'SeniorityLevelID',
            'Seniority Level ID',
            NULL,
            'uniqueidentifier',
            16,
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

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Update IS-A parent field SeniorityLevelID on MJ_BizApps_Sales: Sales Contacts */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='uniqueidentifier',
                      [Length]=16,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='92BE72D3-13E6-4DD2-951B-BCB20EE2C446';

/* Update entity timestamp for MJ_BizApps_Sales: Sales Contacts after IS-A field sync */
UPDATE [${mjSchema}].[Entity] SET [__mj_UpdatedAt]=GETUTCDATE() WHERE ID='530174B2-654E-4E14-BF28-3EF29AC9833D';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* PredictedWinRiskBand's field is resolved by entity and name, not by the ID V202609202353 pins:
   that migration inserts the field with its ID only when no field of that name exists, so a host
   whose field was created first by CodeGen or a metadata push holds it under another ID, and an
   insert keyed to the pinned ID fails on FK_EntityFieldValue_EntityField. */
DECLARE @RiskBandFieldID UNIQUEIDENTIFIER = (
    SELECT TOP 1 f.[ID] FROM [${mjSchema}].[EntityField] f
    JOIN [${mjSchema}].[Entity] e ON e.[ID] = f.[EntityID]
    WHERE e.[SchemaName] = '${flyway:defaultSchema}' AND e.[BaseTable] = 'Deal' AND f.[Name] = 'PredictedWinRiskBand'
    ORDER BY CASE WHEN f.[ID] = '7C778BDC-EC7E-4275-B8BE-49792D542D0B' THEN 0 ELSE 1 END);

/* SQL text to insert entity field value with ID bdf041e3-97e2-4f6a-b569-5bf9dafaf7af */
IF @RiskBandFieldID IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityFieldValue]
               WHERE [ID] = 'bdf041e3-97e2-4f6a-b569-5bf9dafaf7af' OR ([EntityFieldID] = @RiskBandFieldID AND [Value] = 'Critical'))
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('bdf041e3-97e2-4f6a-b569-5bf9dafaf7af', @RiskBandFieldID, 1, 'Critical', 'Critical', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 344436f1-0b9e-4dbd-8cda-e433b15c6fa3 */
IF @RiskBandFieldID IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityFieldValue]
               WHERE [ID] = '344436f1-0b9e-4dbd-8cda-e433b15c6fa3' OR ([EntityFieldID] = @RiskBandFieldID AND [Value] = 'High'))
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('344436f1-0b9e-4dbd-8cda-e433b15c6fa3', @RiskBandFieldID, 2, 'High', 'High', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID b39aa5a0-5bf0-435d-b222-ad21e1e52b37 */
IF @RiskBandFieldID IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityFieldValue]
               WHERE [ID] = 'b39aa5a0-5bf0-435d-b222-ad21e1e52b37' OR ([EntityFieldID] = @RiskBandFieldID AND [Value] = 'Low'))
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('b39aa5a0-5bf0-435d-b222-ad21e1e52b37', @RiskBandFieldID, 3, 'Low', 'Low', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 85305867-7ba6-48dc-8969-f6a93bb0b974 */
IF @RiskBandFieldID IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityFieldValue]
               WHERE [ID] = '85305867-7ba6-48dc-8969-f6a93bb0b974' OR ([EntityFieldID] = @RiskBandFieldID AND [Value] = 'Medium'))
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('85305867-7ba6-48dc-8969-f6a93bb0b974', @RiskBandFieldID, 4, 'Medium', 'Medium', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID 7C778BDC-EC7E-4275-B8BE-49792D542D0B */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID=@RiskBandFieldID;


/* Create Entity Relationship: MJ_BizApps_Accounting: Currencies -> MJ_BizApps_Sales: Deals (One To Many via CurrencyID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '58736666-44da-4a0e-be3d-f728b84db3e4'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('58736666-44da-4a0e-be3d-f728b84db3e4', 'D3329BE1-541B-4918-B1CB-3D7A0454EBA7', '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', 'CurrencyID', 'One To Many', 1, 1, 7, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ_BizApps_Contracts: Contracts -> MJ_BizApps_Sales: Deals (One To Many via ContractID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'e6c26395-ce33-4023-8ce4-b5e988926dcb'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('e6c26395-ce33-4023-8ce4-b5e988926dcb', '5DEB0B11-ED6C-48B3-9200-F4441396C5E2', '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', 'ContractID', 'One To Many', 1, 1, 4, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ_BizApps_Contracts: Contracts -> MJ_BizApps_Sales: Deals (One To Many via RenewsContractID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'a2098aee-84a2-41dc-acc6-d478ee538926'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('a2098aee-84a2-41dc-acc6-d478ee538926', '5DEB0B11-ED6C-48B3-9200-F4441396C5E2', '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', 'RenewsContractID', 'One To Many', 1, 1, 5, GETUTCDATE(), GETUTCDATE())
   END;

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to update entity field related entity name field map for entity field ID 9BC78A7F-4FF8-4707-8613-C0A960B71814 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='9BC78A7F-4FF8-4707-8613-C0A960B71814', @RelatedEntityNameFieldMap='SalesContact';

/* Base View SQL for MJ_BizApps_Sales: Deal Contact Roles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Contact Roles
-- Item: vwDealContactRoles
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Deal Contact Roles
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  DealContactRole
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwDealContactRoles]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwDealContactRoles];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwDealContactRoles]
AS
SELECT
    d.*,
    mjBizAppsSalesDeal_DealID.[Name] AS [Deal],
    mjBizAppsSalesSalesContact_SalesContactID.[DisplayNameAndEmail] AS [SalesContact],
    mjBizAppsSalesBuyingRoleType_BuyingRoleTypeID.[Name] AS [BuyingRoleType]
FROM
    [${flyway:defaultSchema}].[DealContactRole] AS d
INNER JOIN
    [${flyway:defaultSchema}].[Deal] AS mjBizAppsSalesDeal_DealID
  ON
    [d].[DealID] = mjBizAppsSalesDeal_DealID.[ID]
INNER JOIN
    [${flyway:defaultSchema}].[vwSalesContacts] AS mjBizAppsSalesSalesContact_SalesContactID
  ON
    [d].[SalesContactID] = mjBizAppsSalesSalesContact_SalesContactID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[BuyingRoleType] AS mjBizAppsSalesBuyingRoleType_BuyingRoleTypeID
  ON
    [d].[BuyingRoleTypeID] = mjBizAppsSalesBuyingRoleType_BuyingRoleTypeID.[ID]
GO
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDealContactRoles] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDealContactRoles] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDealContactRoles] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwDealContactRoles] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Sales: Deal Contact Roles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Contact Roles
-- Item: Permissions for vwDealContactRoles
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

REVOKE SELECT ON [${flyway:defaultSchema}].[vwDealContactRoles] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDealContactRoles] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDealContactRoles] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwDealContactRoles] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Sales: Deal Contact Roles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Contact Roles
-- Item: spCreateDealContactRole
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR DealContactRole
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateDealContactRole]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateDealContactRole];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateDealContactRole]
    @ID uniqueidentifier = NULL,
    @DealID uniqueidentifier,
    @SalesContactID uniqueidentifier,
    @BuyingRoleTypeID_Clear bit = 0,
    @BuyingRoleTypeID uniqueidentifier = NULL,
    @Influence_Clear bit = 0,
    @Influence decimal(5, 2) = NULL,
    @Notes_Clear bit = 0,
    @Notes nvarchar(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[DealContactRole]
            (
                [ID],
                [DealID],
                [SalesContactID],
                [BuyingRoleTypeID],
                [Influence],
                [Notes]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @DealID,
                @SalesContactID,
                CASE WHEN @BuyingRoleTypeID_Clear = 1 THEN NULL ELSE ISNULL(@BuyingRoleTypeID, NULL) END,
                CASE WHEN @Influence_Clear = 1 THEN NULL ELSE ISNULL(@Influence, NULL) END,
                CASE WHEN @Notes_Clear = 1 THEN NULL ELSE ISNULL(@Notes, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[DealContactRole]
            (
                [DealID],
                [SalesContactID],
                [BuyingRoleTypeID],
                [Influence],
                [Notes]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @DealID,
                @SalesContactID,
                CASE WHEN @BuyingRoleTypeID_Clear = 1 THEN NULL ELSE ISNULL(@BuyingRoleTypeID, NULL) END,
                CASE WHEN @Influence_Clear = 1 THEN NULL ELSE ISNULL(@Influence, NULL) END,
                CASE WHEN @Notes_Clear = 1 THEN NULL ELSE ISNULL(@Notes, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwDealContactRoles] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDealContactRole] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDealContactRole] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateDealContactRole] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Sales: Deal Contact Roles */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDealContactRole] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDealContactRole] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateDealContactRole] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Sales: Deal Contact Roles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Contact Roles
-- Item: spUpdateDealContactRole
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR DealContactRole
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateDealContactRole]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateDealContactRole];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateDealContactRole]
    @ID uniqueidentifier,
    @DealID uniqueidentifier = NULL,
    @SalesContactID uniqueidentifier = NULL,
    @BuyingRoleTypeID_Clear bit = 0,
    @BuyingRoleTypeID uniqueidentifier = NULL,
    @Influence_Clear bit = 0,
    @Influence decimal(5, 2) = NULL,
    @Notes_Clear bit = 0,
    @Notes nvarchar(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[DealContactRole]
    SET
        [DealID] = ISNULL(@DealID, [DealID]),
        [SalesContactID] = ISNULL(@SalesContactID, [SalesContactID]),
        [BuyingRoleTypeID] = CASE WHEN @BuyingRoleTypeID_Clear = 1 THEN NULL ELSE ISNULL(@BuyingRoleTypeID, [BuyingRoleTypeID]) END,
        [Influence] = CASE WHEN @Influence_Clear = 1 THEN NULL ELSE ISNULL(@Influence, [Influence]) END,
        [Notes] = CASE WHEN @Notes_Clear = 1 THEN NULL ELSE ISNULL(@Notes, [Notes]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwDealContactRoles] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwDealContactRoles]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDealContactRole] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDealContactRole] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDealContactRole] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the DealContactRole table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateDealContactRole]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateDealContactRole];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateDealContactRole
ON [${flyway:defaultSchema}].[DealContactRole]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[DealContactRole]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[DealContactRole] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Sales: Deal Contact Roles */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDealContactRole] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDealContactRole] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDealContactRole] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Sales: Deal Contact Roles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Contact Roles
-- Item: spDeleteDealContactRole
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR DealContactRole
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteDealContactRole]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteDealContactRole];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteDealContactRole]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[DealContactRole]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDealContactRole] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDealContactRole] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteDealContactRole] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Sales: Deal Contact Roles */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDealContactRole] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDealContactRole] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteDealContactRole] TO [cdp_Developer], [cdp_Integration];

/* SQL text to update entity field related entity name field map for entity field ID 15EE2878-83D2-4D3F-8010-E53132678BBC */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='15EE2878-83D2-4D3F-8010-E53132678BBC', @RelatedEntityNameFieldMap='PrimaryContact';

/* SQL text to update entity field related entity name field map for entity field ID 95BFECF9-D5DF-415D-955C-890F48086E91 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='95BFECF9-D5DF-415D-955C-890F48086E91', @RelatedEntityNameFieldMap='BillingContact';

/* Base View SQL for MJ_BizApps_Sales: Deals */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: vwDealsGenerated
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Deals
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  Deal
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwDealsGenerated]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwDealsGenerated];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwDealsGenerated]
AS
SELECT
    d.*,
    mjBizAppsSalesPipeline_PipelineID.[Name] AS [Pipeline],
    mjBizAppsSalesPipelineStage_PipelineStageID.[Name] AS [PipelineStage],
    mjBizAppsSalesDealType_DealTypeID.[Name] AS [DealType],
    mjBizAppsSalesDealStatusType_DealStatusTypeID.[Name] AS [DealStatusType],
    mjBizAppsSalesSalesAccount_AccountID.[Name] AS [Account],
    mjBizAppsSalesSalesContact_PrimaryContactID.[DisplayNameAndEmail] AS [PrimaryContact],
    mjBizAppsSalesSalesContact_BillingContactID.[DisplayNameAndEmail] AS [BillingContact],
    MJCompany_CompanyID.[Name] AS [Company],
    MJEmployee_OwnerEmployeeID.[FirstLast] AS [OwnerEmployee],
    mjBizAppsSalesForecastCategoryType_ForecastCategoryTypeID.[Name] AS [ForecastCategoryType],
    mjBizAppsSalesLossReason_LossReasonID.[Name] AS [LossReason],
    mjBizAppsSalesLeadSourceType_LeadSourceTypeID.[Name] AS [LeadSourceType],
    MJUser_ClosedByUserID.[Name] AS [ClosedByUser],
    mjBizAppsOrdersOrderHeader_OrderID.[OrderNumber] AS [Order]
FROM
    [${flyway:defaultSchema}].[Deal] AS d
INNER JOIN
    [${flyway:defaultSchema}].[Pipeline] AS mjBizAppsSalesPipeline_PipelineID
  ON
    [d].[PipelineID] = mjBizAppsSalesPipeline_PipelineID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[PipelineStage] AS mjBizAppsSalesPipelineStage_PipelineStageID
  ON
    [d].[PipelineStageID] = mjBizAppsSalesPipelineStage_PipelineStageID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[DealType] AS mjBizAppsSalesDealType_DealTypeID
  ON
    [d].[DealTypeID] = mjBizAppsSalesDealType_DealTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[DealStatusType] AS mjBizAppsSalesDealStatusType_DealStatusTypeID
  ON
    [d].[DealStatusTypeID] = mjBizAppsSalesDealStatusType_DealStatusTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[vwSalesAccounts] AS mjBizAppsSalesSalesAccount_AccountID
  ON
    [d].[AccountID] = mjBizAppsSalesSalesAccount_AccountID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[vwSalesContacts] AS mjBizAppsSalesSalesContact_PrimaryContactID
  ON
    [d].[PrimaryContactID] = mjBizAppsSalesSalesContact_PrimaryContactID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[vwSalesContacts] AS mjBizAppsSalesSalesContact_BillingContactID
  ON
    [d].[BillingContactID] = mjBizAppsSalesSalesContact_BillingContactID.[ID]
INNER JOIN
    [${mjSchema}].[Company] AS MJCompany_CompanyID
  ON
    [d].[CompanyID] = MJCompany_CompanyID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[vwEmployees] AS MJEmployee_OwnerEmployeeID
  ON
    [d].[OwnerEmployeeID] = MJEmployee_OwnerEmployeeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[ForecastCategoryType] AS mjBizAppsSalesForecastCategoryType_ForecastCategoryTypeID
  ON
    [d].[ForecastCategoryTypeID] = mjBizAppsSalesForecastCategoryType_ForecastCategoryTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[LossReason] AS mjBizAppsSalesLossReason_LossReasonID
  ON
    [d].[LossReasonID] = mjBizAppsSalesLossReason_LossReasonID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[LeadSourceType] AS mjBizAppsSalesLeadSourceType_LeadSourceTypeID
  ON
    [d].[LeadSourceTypeID] = mjBizAppsSalesLeadSourceType_LeadSourceTypeID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_ClosedByUserID
  ON
    [d].[ClosedByUserID] = MJUser_ClosedByUserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}_BizAppsOrders].[OrderHeader] AS mjBizAppsOrdersOrderHeader_OrderID
  ON
    [d].[OrderID] = mjBizAppsOrdersOrderHeader_OrderID.[ID]
GO
IF OBJECT_ID('[${flyway:defaultSchema}].[vwDeals]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwDeals] TO [cdp_UI], [cdp_Developer], [cdp_Integration]';
END;

/* Base View Permissions SQL for MJ_BizApps_Sales: Deals */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: Permissions for vwDeals
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

IF OBJECT_ID('[${flyway:defaultSchema}].[vwDeals]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwDeals] TO [cdp_UI], [cdp_Developer], [cdp_Integration]';
END;

/* spCreate SQL for MJ_BizApps_Sales: Deals */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: spCreateDeal
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR Deal
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateDeal]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateDeal];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateDeal]
    @ID uniqueidentifier = NULL,
    @DealNumber_Clear bit = 0,
    @DealNumber nvarchar(50) = NULL,
    @Name nvarchar(500),
    @PipelineID uniqueidentifier,
    @PipelineStageID_Clear bit = 0,
    @PipelineStageID uniqueidentifier = NULL,
    @DealTypeID_Clear bit = 0,
    @DealTypeID uniqueidentifier = NULL,
    @DealStatusTypeID_Clear bit = 0,
    @DealStatusTypeID uniqueidentifier = NULL,
    @AccountID_Clear bit = 0,
    @AccountID uniqueidentifier = NULL,
    @PrimaryContactID_Clear bit = 0,
    @PrimaryContactID uniqueidentifier = NULL,
    @BillingContactID_Clear bit = 0,
    @BillingContactID uniqueidentifier = NULL,
    @CompanyID uniqueidentifier,
    @OwnerEmployeeID_Clear bit = 0,
    @OwnerEmployeeID uniqueidentifier = NULL,
    @Amount_Clear bit = 0,
    @Amount decimal(19, 4) = NULL,
    @AmountIsComputed bit = NULL,
    @AmountComputedAt_Clear bit = 0,
    @AmountComputedAt datetimeoffset = NULL,
    @AmountSourceHash_Clear bit = 0,
    @AmountSourceHash nvarchar(128) = NULL,
    @CurrencyID_Clear bit = 0,
    @CurrencyID uniqueidentifier = NULL,
    @MRR_Clear bit = 0,
    @MRR decimal(19, 4) = NULL,
    @ARR_Clear bit = 0,
    @ARR decimal(19, 4) = NULL,
    @TermMonths_Clear bit = 0,
    @TermMonths int = NULL,
    @EstimatedProjectWeeks_Clear bit = 0,
    @EstimatedProjectWeeks int = NULL,
    @ExecutionDate_Clear bit = 0,
    @ExecutionDate date = NULL,
    @StartDate_Clear bit = 0,
    @StartDate date = NULL,
    @ExpectedCloseDate_Clear bit = 0,
    @ExpectedCloseDate date = NULL,
    @ActualCloseDate_Clear bit = 0,
    @ActualCloseDate date = NULL,
    @Probability_Clear bit = 0,
    @Probability decimal(5, 2) = NULL,
    @ForecastCategoryTypeID_Clear bit = 0,
    @ForecastCategoryTypeID uniqueidentifier = NULL,
    @LossReasonID_Clear bit = 0,
    @LossReasonID uniqueidentifier = NULL,
    @LossNotes_Clear bit = 0,
    @LossNotes nvarchar(MAX) = NULL,
    @LeadSourceTypeID_Clear bit = 0,
    @LeadSourceTypeID uniqueidentifier = NULL,
    @CampaignID_Clear bit = 0,
    @CampaignID uniqueidentifier = NULL,
    @ContractID_Clear bit = 0,
    @ContractID uniqueidentifier = NULL,
    @RenewsContractID_Clear bit = 0,
    @RenewsContractID uniqueidentifier = NULL,
    @AutoRenew bit = NULL,
    @AnnualIncreasePctOverride_Clear bit = 0,
    @AnnualIncreasePctOverride decimal(5, 2) = NULL,
    @CancellationNoticeDaysOverride_Clear bit = 0,
    @CancellationNoticeDaysOverride int = NULL,
    @PaymentMethod_Clear bit = 0,
    @PaymentMethod nvarchar(50) = NULL,
    @StandardAgreementModified bit = NULL,
    @ContractVariances_Clear bit = 0,
    @ContractVariances nvarchar(MAX) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @NextStep_Clear bit = 0,
    @NextStep nvarchar(1000) = NULL,
    @NextStepDate_Clear bit = 0,
    @NextStepDate date = NULL,
    @ClosedAt_Clear bit = 0,
    @ClosedAt datetimeoffset = NULL,
    @ClosedByUserID_Clear bit = 0,
    @ClosedByUserID uniqueidentifier = NULL,
    @OrderID_Clear bit = 0,
    @OrderID uniqueidentifier = NULL,
    @PredictedWinProbability_Clear bit = 0,
    @PredictedWinProbability decimal(5, 4) = NULL,
    @PredictedWinRiskBand_Clear bit = 0,
    @PredictedWinRiskBand nvarchar(20) = NULL,
    @PredictedWinScoredAt_Clear bit = 0,
    @PredictedWinScoredAt datetimeoffset = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[Deal]
            (
                [ID],
                [DealNumber],
                [Name],
                [PipelineID],
                [PipelineStageID],
                [DealTypeID],
                [DealStatusTypeID],
                [AccountID],
                [PrimaryContactID],
                [BillingContactID],
                [CompanyID],
                [OwnerEmployeeID],
                [Amount],
                [AmountIsComputed],
                [AmountComputedAt],
                [AmountSourceHash],
                [CurrencyID],
                [MRR],
                [ARR],
                [TermMonths],
                [EstimatedProjectWeeks],
                [ExecutionDate],
                [StartDate],
                [ExpectedCloseDate],
                [ActualCloseDate],
                [Probability],
                [ForecastCategoryTypeID],
                [LossReasonID],
                [LossNotes],
                [LeadSourceTypeID],
                [CampaignID],
                [ContractID],
                [RenewsContractID],
                [AutoRenew],
                [AnnualIncreasePctOverride],
                [CancellationNoticeDaysOverride],
                [PaymentMethod],
                [StandardAgreementModified],
                [ContractVariances],
                [Description],
                [NextStep],
                [NextStepDate],
                [ClosedAt],
                [ClosedByUserID],
                [OrderID],
                [PredictedWinProbability],
                [PredictedWinRiskBand],
                [PredictedWinScoredAt]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                CASE WHEN @DealNumber_Clear = 1 THEN NULL ELSE ISNULL(@DealNumber, NULL) END,
                @Name,
                @PipelineID,
                CASE WHEN @PipelineStageID_Clear = 1 THEN NULL ELSE ISNULL(@PipelineStageID, NULL) END,
                CASE WHEN @DealTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealTypeID, NULL) END,
                CASE WHEN @DealStatusTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealStatusTypeID, NULL) END,
                CASE WHEN @AccountID_Clear = 1 THEN NULL ELSE ISNULL(@AccountID, NULL) END,
                CASE WHEN @PrimaryContactID_Clear = 1 THEN NULL ELSE ISNULL(@PrimaryContactID, NULL) END,
                CASE WHEN @BillingContactID_Clear = 1 THEN NULL ELSE ISNULL(@BillingContactID, NULL) END,
                @CompanyID,
                CASE WHEN @OwnerEmployeeID_Clear = 1 THEN NULL ELSE ISNULL(@OwnerEmployeeID, NULL) END,
                CASE WHEN @Amount_Clear = 1 THEN NULL ELSE ISNULL(@Amount, NULL) END,
                ISNULL(@AmountIsComputed, 0),
                CASE WHEN @AmountComputedAt_Clear = 1 THEN NULL ELSE ISNULL(@AmountComputedAt, NULL) END,
                CASE WHEN @AmountSourceHash_Clear = 1 THEN NULL ELSE ISNULL(@AmountSourceHash, NULL) END,
                CASE WHEN @CurrencyID_Clear = 1 THEN NULL ELSE ISNULL(@CurrencyID, NULL) END,
                CASE WHEN @MRR_Clear = 1 THEN NULL ELSE ISNULL(@MRR, NULL) END,
                CASE WHEN @ARR_Clear = 1 THEN NULL ELSE ISNULL(@ARR, NULL) END,
                CASE WHEN @TermMonths_Clear = 1 THEN NULL ELSE ISNULL(@TermMonths, NULL) END,
                CASE WHEN @EstimatedProjectWeeks_Clear = 1 THEN NULL ELSE ISNULL(@EstimatedProjectWeeks, NULL) END,
                CASE WHEN @ExecutionDate_Clear = 1 THEN NULL ELSE ISNULL(@ExecutionDate, NULL) END,
                CASE WHEN @StartDate_Clear = 1 THEN NULL ELSE ISNULL(@StartDate, NULL) END,
                CASE WHEN @ExpectedCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ExpectedCloseDate, NULL) END,
                CASE WHEN @ActualCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ActualCloseDate, NULL) END,
                CASE WHEN @Probability_Clear = 1 THEN NULL ELSE ISNULL(@Probability, NULL) END,
                CASE WHEN @ForecastCategoryTypeID_Clear = 1 THEN NULL ELSE ISNULL(@ForecastCategoryTypeID, NULL) END,
                CASE WHEN @LossReasonID_Clear = 1 THEN NULL ELSE ISNULL(@LossReasonID, NULL) END,
                CASE WHEN @LossNotes_Clear = 1 THEN NULL ELSE ISNULL(@LossNotes, NULL) END,
                CASE WHEN @LeadSourceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@LeadSourceTypeID, NULL) END,
                CASE WHEN @CampaignID_Clear = 1 THEN NULL ELSE ISNULL(@CampaignID, NULL) END,
                CASE WHEN @ContractID_Clear = 1 THEN NULL ELSE ISNULL(@ContractID, NULL) END,
                CASE WHEN @RenewsContractID_Clear = 1 THEN NULL ELSE ISNULL(@RenewsContractID, NULL) END,
                ISNULL(@AutoRenew, 0),
                CASE WHEN @AnnualIncreasePctOverride_Clear = 1 THEN NULL ELSE ISNULL(@AnnualIncreasePctOverride, NULL) END,
                CASE WHEN @CancellationNoticeDaysOverride_Clear = 1 THEN NULL ELSE ISNULL(@CancellationNoticeDaysOverride, NULL) END,
                CASE WHEN @PaymentMethod_Clear = 1 THEN NULL ELSE ISNULL(@PaymentMethod, 'ACH') END,
                ISNULL(@StandardAgreementModified, 0),
                CASE WHEN @ContractVariances_Clear = 1 THEN NULL ELSE ISNULL(@ContractVariances, NULL) END,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                CASE WHEN @NextStep_Clear = 1 THEN NULL ELSE ISNULL(@NextStep, NULL) END,
                CASE WHEN @NextStepDate_Clear = 1 THEN NULL ELSE ISNULL(@NextStepDate, NULL) END,
                CASE WHEN @ClosedAt_Clear = 1 THEN NULL ELSE ISNULL(@ClosedAt, NULL) END,
                CASE WHEN @ClosedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ClosedByUserID, NULL) END,
                CASE WHEN @OrderID_Clear = 1 THEN NULL ELSE ISNULL(@OrderID, NULL) END,
                CASE WHEN @PredictedWinProbability_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinProbability, NULL) END,
                CASE WHEN @PredictedWinRiskBand_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinRiskBand, NULL) END,
                CASE WHEN @PredictedWinScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinScoredAt, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[Deal]
            (
                [DealNumber],
                [Name],
                [PipelineID],
                [PipelineStageID],
                [DealTypeID],
                [DealStatusTypeID],
                [AccountID],
                [PrimaryContactID],
                [BillingContactID],
                [CompanyID],
                [OwnerEmployeeID],
                [Amount],
                [AmountIsComputed],
                [AmountComputedAt],
                [AmountSourceHash],
                [CurrencyID],
                [MRR],
                [ARR],
                [TermMonths],
                [EstimatedProjectWeeks],
                [ExecutionDate],
                [StartDate],
                [ExpectedCloseDate],
                [ActualCloseDate],
                [Probability],
                [ForecastCategoryTypeID],
                [LossReasonID],
                [LossNotes],
                [LeadSourceTypeID],
                [CampaignID],
                [ContractID],
                [RenewsContractID],
                [AutoRenew],
                [AnnualIncreasePctOverride],
                [CancellationNoticeDaysOverride],
                [PaymentMethod],
                [StandardAgreementModified],
                [ContractVariances],
                [Description],
                [NextStep],
                [NextStepDate],
                [ClosedAt],
                [ClosedByUserID],
                [OrderID],
                [PredictedWinProbability],
                [PredictedWinRiskBand],
                [PredictedWinScoredAt]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                CASE WHEN @DealNumber_Clear = 1 THEN NULL ELSE ISNULL(@DealNumber, NULL) END,
                @Name,
                @PipelineID,
                CASE WHEN @PipelineStageID_Clear = 1 THEN NULL ELSE ISNULL(@PipelineStageID, NULL) END,
                CASE WHEN @DealTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealTypeID, NULL) END,
                CASE WHEN @DealStatusTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealStatusTypeID, NULL) END,
                CASE WHEN @AccountID_Clear = 1 THEN NULL ELSE ISNULL(@AccountID, NULL) END,
                CASE WHEN @PrimaryContactID_Clear = 1 THEN NULL ELSE ISNULL(@PrimaryContactID, NULL) END,
                CASE WHEN @BillingContactID_Clear = 1 THEN NULL ELSE ISNULL(@BillingContactID, NULL) END,
                @CompanyID,
                CASE WHEN @OwnerEmployeeID_Clear = 1 THEN NULL ELSE ISNULL(@OwnerEmployeeID, NULL) END,
                CASE WHEN @Amount_Clear = 1 THEN NULL ELSE ISNULL(@Amount, NULL) END,
                ISNULL(@AmountIsComputed, 0),
                CASE WHEN @AmountComputedAt_Clear = 1 THEN NULL ELSE ISNULL(@AmountComputedAt, NULL) END,
                CASE WHEN @AmountSourceHash_Clear = 1 THEN NULL ELSE ISNULL(@AmountSourceHash, NULL) END,
                CASE WHEN @CurrencyID_Clear = 1 THEN NULL ELSE ISNULL(@CurrencyID, NULL) END,
                CASE WHEN @MRR_Clear = 1 THEN NULL ELSE ISNULL(@MRR, NULL) END,
                CASE WHEN @ARR_Clear = 1 THEN NULL ELSE ISNULL(@ARR, NULL) END,
                CASE WHEN @TermMonths_Clear = 1 THEN NULL ELSE ISNULL(@TermMonths, NULL) END,
                CASE WHEN @EstimatedProjectWeeks_Clear = 1 THEN NULL ELSE ISNULL(@EstimatedProjectWeeks, NULL) END,
                CASE WHEN @ExecutionDate_Clear = 1 THEN NULL ELSE ISNULL(@ExecutionDate, NULL) END,
                CASE WHEN @StartDate_Clear = 1 THEN NULL ELSE ISNULL(@StartDate, NULL) END,
                CASE WHEN @ExpectedCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ExpectedCloseDate, NULL) END,
                CASE WHEN @ActualCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ActualCloseDate, NULL) END,
                CASE WHEN @Probability_Clear = 1 THEN NULL ELSE ISNULL(@Probability, NULL) END,
                CASE WHEN @ForecastCategoryTypeID_Clear = 1 THEN NULL ELSE ISNULL(@ForecastCategoryTypeID, NULL) END,
                CASE WHEN @LossReasonID_Clear = 1 THEN NULL ELSE ISNULL(@LossReasonID, NULL) END,
                CASE WHEN @LossNotes_Clear = 1 THEN NULL ELSE ISNULL(@LossNotes, NULL) END,
                CASE WHEN @LeadSourceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@LeadSourceTypeID, NULL) END,
                CASE WHEN @CampaignID_Clear = 1 THEN NULL ELSE ISNULL(@CampaignID, NULL) END,
                CASE WHEN @ContractID_Clear = 1 THEN NULL ELSE ISNULL(@ContractID, NULL) END,
                CASE WHEN @RenewsContractID_Clear = 1 THEN NULL ELSE ISNULL(@RenewsContractID, NULL) END,
                ISNULL(@AutoRenew, 0),
                CASE WHEN @AnnualIncreasePctOverride_Clear = 1 THEN NULL ELSE ISNULL(@AnnualIncreasePctOverride, NULL) END,
                CASE WHEN @CancellationNoticeDaysOverride_Clear = 1 THEN NULL ELSE ISNULL(@CancellationNoticeDaysOverride, NULL) END,
                CASE WHEN @PaymentMethod_Clear = 1 THEN NULL ELSE ISNULL(@PaymentMethod, 'ACH') END,
                ISNULL(@StandardAgreementModified, 0),
                CASE WHEN @ContractVariances_Clear = 1 THEN NULL ELSE ISNULL(@ContractVariances, NULL) END,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                CASE WHEN @NextStep_Clear = 1 THEN NULL ELSE ISNULL(@NextStep, NULL) END,
                CASE WHEN @NextStepDate_Clear = 1 THEN NULL ELSE ISNULL(@NextStepDate, NULL) END,
                CASE WHEN @ClosedAt_Clear = 1 THEN NULL ELSE ISNULL(@ClosedAt, NULL) END,
                CASE WHEN @ClosedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ClosedByUserID, NULL) END,
                CASE WHEN @OrderID_Clear = 1 THEN NULL ELSE ISNULL(@OrderID, NULL) END,
                CASE WHEN @PredictedWinProbability_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinProbability, NULL) END,
                CASE WHEN @PredictedWinRiskBand_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinRiskBand, NULL) END,
                CASE WHEN @PredictedWinScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinScoredAt, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwDeals] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Sales: Deals */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Sales: Deals */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: spUpdateDeal
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR Deal
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateDeal]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateDeal];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateDeal]
    @ID uniqueidentifier,
    @DealNumber_Clear bit = 0,
    @DealNumber nvarchar(50) = NULL,
    @Name nvarchar(500) = NULL,
    @PipelineID uniqueidentifier = NULL,
    @PipelineStageID_Clear bit = 0,
    @PipelineStageID uniqueidentifier = NULL,
    @DealTypeID_Clear bit = 0,
    @DealTypeID uniqueidentifier = NULL,
    @DealStatusTypeID_Clear bit = 0,
    @DealStatusTypeID uniqueidentifier = NULL,
    @AccountID_Clear bit = 0,
    @AccountID uniqueidentifier = NULL,
    @PrimaryContactID_Clear bit = 0,
    @PrimaryContactID uniqueidentifier = NULL,
    @BillingContactID_Clear bit = 0,
    @BillingContactID uniqueidentifier = NULL,
    @CompanyID uniqueidentifier = NULL,
    @OwnerEmployeeID_Clear bit = 0,
    @OwnerEmployeeID uniqueidentifier = NULL,
    @Amount_Clear bit = 0,
    @Amount decimal(19, 4) = NULL,
    @AmountIsComputed bit = NULL,
    @AmountComputedAt_Clear bit = 0,
    @AmountComputedAt datetimeoffset = NULL,
    @AmountSourceHash_Clear bit = 0,
    @AmountSourceHash nvarchar(128) = NULL,
    @CurrencyID_Clear bit = 0,
    @CurrencyID uniqueidentifier = NULL,
    @MRR_Clear bit = 0,
    @MRR decimal(19, 4) = NULL,
    @ARR_Clear bit = 0,
    @ARR decimal(19, 4) = NULL,
    @TermMonths_Clear bit = 0,
    @TermMonths int = NULL,
    @EstimatedProjectWeeks_Clear bit = 0,
    @EstimatedProjectWeeks int = NULL,
    @ExecutionDate_Clear bit = 0,
    @ExecutionDate date = NULL,
    @StartDate_Clear bit = 0,
    @StartDate date = NULL,
    @ExpectedCloseDate_Clear bit = 0,
    @ExpectedCloseDate date = NULL,
    @ActualCloseDate_Clear bit = 0,
    @ActualCloseDate date = NULL,
    @Probability_Clear bit = 0,
    @Probability decimal(5, 2) = NULL,
    @ForecastCategoryTypeID_Clear bit = 0,
    @ForecastCategoryTypeID uniqueidentifier = NULL,
    @LossReasonID_Clear bit = 0,
    @LossReasonID uniqueidentifier = NULL,
    @LossNotes_Clear bit = 0,
    @LossNotes nvarchar(MAX) = NULL,
    @LeadSourceTypeID_Clear bit = 0,
    @LeadSourceTypeID uniqueidentifier = NULL,
    @CampaignID_Clear bit = 0,
    @CampaignID uniqueidentifier = NULL,
    @ContractID_Clear bit = 0,
    @ContractID uniqueidentifier = NULL,
    @RenewsContractID_Clear bit = 0,
    @RenewsContractID uniqueidentifier = NULL,
    @AutoRenew bit = NULL,
    @AnnualIncreasePctOverride_Clear bit = 0,
    @AnnualIncreasePctOverride decimal(5, 2) = NULL,
    @CancellationNoticeDaysOverride_Clear bit = 0,
    @CancellationNoticeDaysOverride int = NULL,
    @PaymentMethod_Clear bit = 0,
    @PaymentMethod nvarchar(50) = NULL,
    @StandardAgreementModified bit = NULL,
    @ContractVariances_Clear bit = 0,
    @ContractVariances nvarchar(MAX) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @NextStep_Clear bit = 0,
    @NextStep nvarchar(1000) = NULL,
    @NextStepDate_Clear bit = 0,
    @NextStepDate date = NULL,
    @ClosedAt_Clear bit = 0,
    @ClosedAt datetimeoffset = NULL,
    @ClosedByUserID_Clear bit = 0,
    @ClosedByUserID uniqueidentifier = NULL,
    @OrderID_Clear bit = 0,
    @OrderID uniqueidentifier = NULL,
    @PredictedWinProbability_Clear bit = 0,
    @PredictedWinProbability decimal(5, 4) = NULL,
    @PredictedWinRiskBand_Clear bit = 0,
    @PredictedWinRiskBand nvarchar(20) = NULL,
    @PredictedWinScoredAt_Clear bit = 0,
    @PredictedWinScoredAt datetimeoffset = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[Deal]
    SET
        [DealNumber] = CASE WHEN @DealNumber_Clear = 1 THEN NULL ELSE ISNULL(@DealNumber, [DealNumber]) END,
        [Name] = ISNULL(@Name, [Name]),
        [PipelineID] = ISNULL(@PipelineID, [PipelineID]),
        [PipelineStageID] = CASE WHEN @PipelineStageID_Clear = 1 THEN NULL ELSE ISNULL(@PipelineStageID, [PipelineStageID]) END,
        [DealTypeID] = CASE WHEN @DealTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealTypeID, [DealTypeID]) END,
        [DealStatusTypeID] = CASE WHEN @DealStatusTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealStatusTypeID, [DealStatusTypeID]) END,
        [AccountID] = CASE WHEN @AccountID_Clear = 1 THEN NULL ELSE ISNULL(@AccountID, [AccountID]) END,
        [PrimaryContactID] = CASE WHEN @PrimaryContactID_Clear = 1 THEN NULL ELSE ISNULL(@PrimaryContactID, [PrimaryContactID]) END,
        [BillingContactID] = CASE WHEN @BillingContactID_Clear = 1 THEN NULL ELSE ISNULL(@BillingContactID, [BillingContactID]) END,
        [CompanyID] = ISNULL(@CompanyID, [CompanyID]),
        [OwnerEmployeeID] = CASE WHEN @OwnerEmployeeID_Clear = 1 THEN NULL ELSE ISNULL(@OwnerEmployeeID, [OwnerEmployeeID]) END,
        [Amount] = CASE WHEN @Amount_Clear = 1 THEN NULL ELSE ISNULL(@Amount, [Amount]) END,
        [AmountIsComputed] = ISNULL(@AmountIsComputed, [AmountIsComputed]),
        [AmountComputedAt] = CASE WHEN @AmountComputedAt_Clear = 1 THEN NULL ELSE ISNULL(@AmountComputedAt, [AmountComputedAt]) END,
        [AmountSourceHash] = CASE WHEN @AmountSourceHash_Clear = 1 THEN NULL ELSE ISNULL(@AmountSourceHash, [AmountSourceHash]) END,
        [CurrencyID] = CASE WHEN @CurrencyID_Clear = 1 THEN NULL ELSE ISNULL(@CurrencyID, [CurrencyID]) END,
        [MRR] = CASE WHEN @MRR_Clear = 1 THEN NULL ELSE ISNULL(@MRR, [MRR]) END,
        [ARR] = CASE WHEN @ARR_Clear = 1 THEN NULL ELSE ISNULL(@ARR, [ARR]) END,
        [TermMonths] = CASE WHEN @TermMonths_Clear = 1 THEN NULL ELSE ISNULL(@TermMonths, [TermMonths]) END,
        [EstimatedProjectWeeks] = CASE WHEN @EstimatedProjectWeeks_Clear = 1 THEN NULL ELSE ISNULL(@EstimatedProjectWeeks, [EstimatedProjectWeeks]) END,
        [ExecutionDate] = CASE WHEN @ExecutionDate_Clear = 1 THEN NULL ELSE ISNULL(@ExecutionDate, [ExecutionDate]) END,
        [StartDate] = CASE WHEN @StartDate_Clear = 1 THEN NULL ELSE ISNULL(@StartDate, [StartDate]) END,
        [ExpectedCloseDate] = CASE WHEN @ExpectedCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ExpectedCloseDate, [ExpectedCloseDate]) END,
        [ActualCloseDate] = CASE WHEN @ActualCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ActualCloseDate, [ActualCloseDate]) END,
        [Probability] = CASE WHEN @Probability_Clear = 1 THEN NULL ELSE ISNULL(@Probability, [Probability]) END,
        [ForecastCategoryTypeID] = CASE WHEN @ForecastCategoryTypeID_Clear = 1 THEN NULL ELSE ISNULL(@ForecastCategoryTypeID, [ForecastCategoryTypeID]) END,
        [LossReasonID] = CASE WHEN @LossReasonID_Clear = 1 THEN NULL ELSE ISNULL(@LossReasonID, [LossReasonID]) END,
        [LossNotes] = CASE WHEN @LossNotes_Clear = 1 THEN NULL ELSE ISNULL(@LossNotes, [LossNotes]) END,
        [LeadSourceTypeID] = CASE WHEN @LeadSourceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@LeadSourceTypeID, [LeadSourceTypeID]) END,
        [CampaignID] = CASE WHEN @CampaignID_Clear = 1 THEN NULL ELSE ISNULL(@CampaignID, [CampaignID]) END,
        [ContractID] = CASE WHEN @ContractID_Clear = 1 THEN NULL ELSE ISNULL(@ContractID, [ContractID]) END,
        [RenewsContractID] = CASE WHEN @RenewsContractID_Clear = 1 THEN NULL ELSE ISNULL(@RenewsContractID, [RenewsContractID]) END,
        [AutoRenew] = ISNULL(@AutoRenew, [AutoRenew]),
        [AnnualIncreasePctOverride] = CASE WHEN @AnnualIncreasePctOverride_Clear = 1 THEN NULL ELSE ISNULL(@AnnualIncreasePctOverride, [AnnualIncreasePctOverride]) END,
        [CancellationNoticeDaysOverride] = CASE WHEN @CancellationNoticeDaysOverride_Clear = 1 THEN NULL ELSE ISNULL(@CancellationNoticeDaysOverride, [CancellationNoticeDaysOverride]) END,
        [PaymentMethod] = CASE WHEN @PaymentMethod_Clear = 1 THEN NULL ELSE ISNULL(@PaymentMethod, [PaymentMethod]) END,
        [StandardAgreementModified] = ISNULL(@StandardAgreementModified, [StandardAgreementModified]),
        [ContractVariances] = CASE WHEN @ContractVariances_Clear = 1 THEN NULL ELSE ISNULL(@ContractVariances, [ContractVariances]) END,
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [NextStep] = CASE WHEN @NextStep_Clear = 1 THEN NULL ELSE ISNULL(@NextStep, [NextStep]) END,
        [NextStepDate] = CASE WHEN @NextStepDate_Clear = 1 THEN NULL ELSE ISNULL(@NextStepDate, [NextStepDate]) END,
        [ClosedAt] = CASE WHEN @ClosedAt_Clear = 1 THEN NULL ELSE ISNULL(@ClosedAt, [ClosedAt]) END,
        [ClosedByUserID] = CASE WHEN @ClosedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ClosedByUserID, [ClosedByUserID]) END,
        [OrderID] = CASE WHEN @OrderID_Clear = 1 THEN NULL ELSE ISNULL(@OrderID, [OrderID]) END,
        [PredictedWinProbability] = CASE WHEN @PredictedWinProbability_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinProbability, [PredictedWinProbability]) END,
        [PredictedWinRiskBand] = CASE WHEN @PredictedWinRiskBand_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinRiskBand, [PredictedWinRiskBand]) END,
        [PredictedWinScoredAt] = CASE WHEN @PredictedWinScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinScoredAt, [PredictedWinScoredAt]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwDeals] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwDeals]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the Deal table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateDeal]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateDeal];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateDeal
ON [${flyway:defaultSchema}].[Deal]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[Deal]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[Deal] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Sales: Deals */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Sales: Deals */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: spDeleteDeal
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR Deal
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteDeal]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteDeal];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteDeal]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[Deal]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Sales: Deals */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] TO [cdp_Developer], [cdp_Integration];

/* Index for Foreign Keys for SalesContact */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Sales Contacts
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key OwnerEmployeeID in table SalesContact
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SalesContact_OwnerEmployeeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SalesContact]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SalesContact_OwnerEmployeeID ON [${flyway:defaultSchema}].[SalesContact] ([OwnerEmployeeID]);

-- Index for foreign key LifecycleStageTypeID in table SalesContact
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SalesContact_LifecycleStageTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SalesContact]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SalesContact_LifecycleStageTypeID ON [${flyway:defaultSchema}].[SalesContact] ([LifecycleStageTypeID]);

-- Index for foreign key BuyingRoleTypeID in table SalesContact
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SalesContact_BuyingRoleTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SalesContact]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SalesContact_BuyingRoleTypeID ON [${flyway:defaultSchema}].[SalesContact] ([BuyingRoleTypeID]);

-- Index for foreign key LeadSourceTypeID in table SalesContact
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SalesContact_LeadSourceTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SalesContact]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SalesContact_LeadSourceTypeID ON [${flyway:defaultSchema}].[SalesContact] ([LeadSourceTypeID]);

/* Base View SQL for MJ_BizApps_Sales: Sales Contacts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Sales Contacts
-- Item: vwSalesContactsGenerated
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Sales Contacts
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  SalesContact
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSalesContactsGenerated]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSalesContactsGenerated];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSalesContactsGenerated]
AS
SELECT
    s.*,
    ${mjSchema}_isa_p1.[FirstName],
    ${mjSchema}_isa_p1.[LastName],
    ${mjSchema}_isa_p1.[MiddleName],
    ${mjSchema}_isa_p1.[Prefix],
    ${mjSchema}_isa_p1.[Suffix],
    ${mjSchema}_isa_p1.[PreferredName],
    ${mjSchema}_isa_p1.[Title],
    ${mjSchema}_isa_p1.[Email],
    ${mjSchema}_isa_p1.[Phone],
    ${mjSchema}_isa_p1.[DateOfBirth],
    ${mjSchema}_isa_p1.[Gender],
    ${mjSchema}_isa_p1.[PhotoURL],
    ${mjSchema}_isa_p1.[Bio],
    ${mjSchema}_isa_p1.[LinkedUserID],
    ${mjSchema}_isa_p1.[Status],
    ${mjSchema}_isa_p1.[SeniorityLevelID],
    MJEmployee_OwnerEmployeeID.[FirstLast] AS [OwnerEmployee],
    mjBizAppsSalesLifecycleStageType_LifecycleStageTypeID.[Name] AS [LifecycleStageType],
    mjBizAppsSalesBuyingRoleType_BuyingRoleTypeID.[Name] AS [BuyingRoleType],
    mjBizAppsSalesLeadSourceType_LeadSourceTypeID.[Name] AS [LeadSourceType]
FROM
    [${flyway:defaultSchema}].[SalesContact] AS s
INNER JOIN
    [${mjSchema}_BizAppsCommon].[Person] AS ${mjSchema}_isa_p1
  ON
    [s].[ID] = ${mjSchema}_isa_p1.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[vwEmployees] AS MJEmployee_OwnerEmployeeID
  ON
    [s].[OwnerEmployeeID] = MJEmployee_OwnerEmployeeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[LifecycleStageType] AS mjBizAppsSalesLifecycleStageType_LifecycleStageTypeID
  ON
    [s].[LifecycleStageTypeID] = mjBizAppsSalesLifecycleStageType_LifecycleStageTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[BuyingRoleType] AS mjBizAppsSalesBuyingRoleType_BuyingRoleTypeID
  ON
    [s].[BuyingRoleTypeID] = mjBizAppsSalesBuyingRoleType_BuyingRoleTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[LeadSourceType] AS mjBizAppsSalesLeadSourceType_LeadSourceTypeID
  ON
    [s].[LeadSourceTypeID] = mjBizAppsSalesLeadSourceType_LeadSourceTypeID.[ID]
GO
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSalesContacts]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'REVOKE SELECT ON [${flyway:defaultSchema}].[vwSalesContacts] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSalesContacts] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSalesContacts] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwSalesContacts] TO [cdp_UI], [cdp_Developer], [cdp_Integration]';
END;

/* Base View Permissions SQL for MJ_BizApps_Sales: Sales Contacts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Sales Contacts
-- Item: Permissions for vwSalesContacts
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

IF OBJECT_ID('[${flyway:defaultSchema}].[vwSalesContacts]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'REVOKE SELECT ON [${flyway:defaultSchema}].[vwSalesContacts] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSalesContacts] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSalesContacts] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwSalesContacts] TO [cdp_UI], [cdp_Developer], [cdp_Integration]';
END;

/* spCreate SQL for MJ_BizApps_Sales: Sales Contacts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Sales Contacts
-- Item: spCreateSalesContact
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR SalesContact
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSalesContact]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSalesContact];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSalesContact]
    @ID uniqueidentifier = NULL,
    @OwnerEmployeeID_Clear bit = 0,
    @OwnerEmployeeID uniqueidentifier = NULL,
    @LifecycleStageTypeID_Clear bit = 0,
    @LifecycleStageTypeID uniqueidentifier = NULL,
    @BuyingRoleTypeID_Clear bit = 0,
    @BuyingRoleTypeID uniqueidentifier = NULL,
    @LeadSourceTypeID_Clear bit = 0,
    @LeadSourceTypeID uniqueidentifier = NULL,
    @Seniority_Clear bit = 0,
    @Seniority nvarchar(50) = NULL,
    @OptedOutOfOutreach bit = NULL,
    @DoNotContactReason_Clear bit = 0,
    @DoNotContactReason nvarchar(500) = NULL,
    @LastEngagedAt_Clear bit = 0,
    @LastEngagedAt datetimeoffset = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @ActualID UNIQUEIDENTIFIER = ISNULL(@ID, NEWID())
    INSERT INTO
    [${flyway:defaultSchema}].[SalesContact]
        (
            [OwnerEmployeeID],
                [LifecycleStageTypeID],
                [BuyingRoleTypeID],
                [LeadSourceTypeID],
                [Seniority],
                [OptedOutOfOutreach],
                [DoNotContactReason],
                [LastEngagedAt],
                [ID]
        )
    VALUES
        (
            CASE WHEN @OwnerEmployeeID_Clear = 1 THEN NULL ELSE ISNULL(@OwnerEmployeeID, NULL) END,
                CASE WHEN @LifecycleStageTypeID_Clear = 1 THEN NULL ELSE ISNULL(@LifecycleStageTypeID, NULL) END,
                CASE WHEN @BuyingRoleTypeID_Clear = 1 THEN NULL ELSE ISNULL(@BuyingRoleTypeID, NULL) END,
                CASE WHEN @LeadSourceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@LeadSourceTypeID, NULL) END,
                CASE WHEN @Seniority_Clear = 1 THEN NULL ELSE ISNULL(@Seniority, NULL) END,
                ISNULL(@OptedOutOfOutreach, 0),
                CASE WHEN @DoNotContactReason_Clear = 1 THEN NULL ELSE ISNULL(@DoNotContactReason, NULL) END,
                CASE WHEN @LastEngagedAt_Clear = 1 THEN NULL ELSE ISNULL(@LastEngagedAt, NULL) END,
                @ActualID
        )
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSalesContacts] WHERE [ID] = @ActualID
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSalesContact] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSalesContact] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSalesContact] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Sales: Sales Contacts */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSalesContact] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSalesContact] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSalesContact] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Sales: Sales Contacts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Sales Contacts
-- Item: spUpdateSalesContact
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR SalesContact
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSalesContact]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSalesContact];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSalesContact]
    @ID uniqueidentifier,
    @OwnerEmployeeID_Clear bit = 0,
    @OwnerEmployeeID uniqueidentifier = NULL,
    @LifecycleStageTypeID_Clear bit = 0,
    @LifecycleStageTypeID uniqueidentifier = NULL,
    @BuyingRoleTypeID_Clear bit = 0,
    @BuyingRoleTypeID uniqueidentifier = NULL,
    @LeadSourceTypeID_Clear bit = 0,
    @LeadSourceTypeID uniqueidentifier = NULL,
    @Seniority_Clear bit = 0,
    @Seniority nvarchar(50) = NULL,
    @OptedOutOfOutreach bit = NULL,
    @DoNotContactReason_Clear bit = 0,
    @DoNotContactReason nvarchar(500) = NULL,
    @LastEngagedAt_Clear bit = 0,
    @LastEngagedAt datetimeoffset = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SalesContact]
    SET
        [OwnerEmployeeID] = CASE WHEN @OwnerEmployeeID_Clear = 1 THEN NULL ELSE ISNULL(@OwnerEmployeeID, [OwnerEmployeeID]) END,
        [LifecycleStageTypeID] = CASE WHEN @LifecycleStageTypeID_Clear = 1 THEN NULL ELSE ISNULL(@LifecycleStageTypeID, [LifecycleStageTypeID]) END,
        [BuyingRoleTypeID] = CASE WHEN @BuyingRoleTypeID_Clear = 1 THEN NULL ELSE ISNULL(@BuyingRoleTypeID, [BuyingRoleTypeID]) END,
        [LeadSourceTypeID] = CASE WHEN @LeadSourceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@LeadSourceTypeID, [LeadSourceTypeID]) END,
        [Seniority] = CASE WHEN @Seniority_Clear = 1 THEN NULL ELSE ISNULL(@Seniority, [Seniority]) END,
        [OptedOutOfOutreach] = ISNULL(@OptedOutOfOutreach, [OptedOutOfOutreach]),
        [DoNotContactReason] = CASE WHEN @DoNotContactReason_Clear = 1 THEN NULL ELSE ISNULL(@DoNotContactReason, [DoNotContactReason]) END,
        [LastEngagedAt] = CASE WHEN @LastEngagedAt_Clear = 1 THEN NULL ELSE ISNULL(@LastEngagedAt, [LastEngagedAt]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSalesContacts] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSalesContacts]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSalesContact] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSalesContact] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSalesContact] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the SalesContact table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSalesContact]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSalesContact];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSalesContact
ON [${flyway:defaultSchema}].[SalesContact]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SalesContact]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[SalesContact] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Sales: Sales Contacts */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSalesContact] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSalesContact] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSalesContact] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Sales: Sales Contacts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Sales Contacts
-- Item: spDeleteSalesContact
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR SalesContact
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSalesContact]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSalesContact];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSalesContact]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[SalesContact]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSalesContact] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSalesContact] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSalesContact] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Sales: Sales Contacts */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSalesContact] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSalesContact] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSalesContact] TO [cdp_Developer], [cdp_Integration];

/* SQL text to delete unneeded entity fields (1 scoped entities) */
EXEC [${mjSchema}].[spDeleteUnneededEntityFields] @ExcludedSchemaNames='', @EntityIDs='530174B2-654E-4E14-BF28-3EF29AC9833D', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to update existing entity fields from schema (1 scoped entities) */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='530174B2-654E-4E14-BF28-3EF29AC9833D', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Refresh custom base views for modified entities so schema changes are picked up */
EXEC sp_refreshview '${flyway:defaultSchema}.vwSalesContactsGenerated';
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSalesContacts]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'EXEC sp_refreshview ''${flyway:defaultSchema}.vwSalesContacts'';';
END;


/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 3 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '767b4256-0de1-4f94-8eec-0a06e0383864' OR (EntityID = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND Name = 'PrimaryContact')) BEGIN
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
            '767b4256-0de1-4f94-8eec-0a06e0383864',
            '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', -- Entity: MJ_BizApps_Sales: Deals
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'),
            'PrimaryContact',
            'Primary Contact',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '4d55882b-7546-456d-9b32-72118b107fd5' OR (EntityID = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND Name = 'BillingContact')) BEGIN
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
            '4d55882b-7546-456d-9b32-72118b107fd5',
            '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', -- Entity: MJ_BizApps_Sales: Deals
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'),
            'BillingContact',
            'Billing Contact',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '9bdd5f7e-f0c4-4ff0-bb0b-957f537be95f' OR (EntityID = '862535EB-36DD-4434-8B4E-E256363E781F' AND Name = 'SalesContact')) BEGIN
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
            '9bdd5f7e-f0c4-4ff0-bb0b-957f537be95f',
            '862535EB-36DD-4434-8B4E-E256363E781F', -- Entity: MJ_BizApps_Sales: Deal Contact Roles
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '862535EB-36DD-4434-8B4E-E256363E781F'),
            'SalesContact',
            'Sales Contact',
            NULL,
            'nvarchar',
            1408,
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

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Index for Foreign Keys for DealContactRole */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Contact Roles
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key DealID in table DealContactRole
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_DealContactRole_DealID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[DealContactRole]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_DealContactRole_DealID ON [${flyway:defaultSchema}].[DealContactRole] ([DealID]);

-- Index for foreign key SalesContactID in table DealContactRole
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_DealContactRole_SalesContactID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[DealContactRole]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_DealContactRole_SalesContactID ON [${flyway:defaultSchema}].[DealContactRole] ([SalesContactID]);

-- Index for foreign key BuyingRoleTypeID in table DealContactRole
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_DealContactRole_BuyingRoleTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[DealContactRole]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_DealContactRole_BuyingRoleTypeID ON [${flyway:defaultSchema}].[DealContactRole] ([BuyingRoleTypeID]);

/* Base View SQL for MJ_BizApps_Sales: Deal Contact Roles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Contact Roles
-- Item: vwDealContactRoles
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Deal Contact Roles
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  DealContactRole
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwDealContactRoles]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwDealContactRoles];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwDealContactRoles]
AS
SELECT
    d.*,
    mjBizAppsSalesDeal_DealID.[Name] AS [Deal],
    mjBizAppsSalesSalesContact_SalesContactID.[DisplayNameAndEmail] AS [SalesContact],
    mjBizAppsSalesBuyingRoleType_BuyingRoleTypeID.[Name] AS [BuyingRoleType]
FROM
    [${flyway:defaultSchema}].[DealContactRole] AS d
INNER JOIN
    [${flyway:defaultSchema}].[Deal] AS mjBizAppsSalesDeal_DealID
  ON
    [d].[DealID] = mjBizAppsSalesDeal_DealID.[ID]
INNER JOIN
    [${flyway:defaultSchema}].[vwSalesContacts] AS mjBizAppsSalesSalesContact_SalesContactID
  ON
    [d].[SalesContactID] = mjBizAppsSalesSalesContact_SalesContactID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[BuyingRoleType] AS mjBizAppsSalesBuyingRoleType_BuyingRoleTypeID
  ON
    [d].[BuyingRoleTypeID] = mjBizAppsSalesBuyingRoleType_BuyingRoleTypeID.[ID]
GO
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDealContactRoles] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDealContactRoles] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDealContactRoles] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwDealContactRoles] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Sales: Deal Contact Roles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Contact Roles
-- Item: Permissions for vwDealContactRoles
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

REVOKE SELECT ON [${flyway:defaultSchema}].[vwDealContactRoles] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDealContactRoles] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDealContactRoles] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwDealContactRoles] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Sales: Deal Contact Roles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Contact Roles
-- Item: spCreateDealContactRole
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR DealContactRole
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateDealContactRole]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateDealContactRole];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateDealContactRole]
    @ID uniqueidentifier = NULL,
    @DealID uniqueidentifier,
    @SalesContactID uniqueidentifier,
    @BuyingRoleTypeID_Clear bit = 0,
    @BuyingRoleTypeID uniqueidentifier = NULL,
    @Influence_Clear bit = 0,
    @Influence decimal(5, 2) = NULL,
    @Notes_Clear bit = 0,
    @Notes nvarchar(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[DealContactRole]
            (
                [ID],
                [DealID],
                [SalesContactID],
                [BuyingRoleTypeID],
                [Influence],
                [Notes]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @DealID,
                @SalesContactID,
                CASE WHEN @BuyingRoleTypeID_Clear = 1 THEN NULL ELSE ISNULL(@BuyingRoleTypeID, NULL) END,
                CASE WHEN @Influence_Clear = 1 THEN NULL ELSE ISNULL(@Influence, NULL) END,
                CASE WHEN @Notes_Clear = 1 THEN NULL ELSE ISNULL(@Notes, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[DealContactRole]
            (
                [DealID],
                [SalesContactID],
                [BuyingRoleTypeID],
                [Influence],
                [Notes]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @DealID,
                @SalesContactID,
                CASE WHEN @BuyingRoleTypeID_Clear = 1 THEN NULL ELSE ISNULL(@BuyingRoleTypeID, NULL) END,
                CASE WHEN @Influence_Clear = 1 THEN NULL ELSE ISNULL(@Influence, NULL) END,
                CASE WHEN @Notes_Clear = 1 THEN NULL ELSE ISNULL(@Notes, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwDealContactRoles] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDealContactRole] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDealContactRole] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateDealContactRole] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Sales: Deal Contact Roles */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDealContactRole] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDealContactRole] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateDealContactRole] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Sales: Deal Contact Roles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Contact Roles
-- Item: spUpdateDealContactRole
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR DealContactRole
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateDealContactRole]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateDealContactRole];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateDealContactRole]
    @ID uniqueidentifier,
    @DealID uniqueidentifier = NULL,
    @SalesContactID uniqueidentifier = NULL,
    @BuyingRoleTypeID_Clear bit = 0,
    @BuyingRoleTypeID uniqueidentifier = NULL,
    @Influence_Clear bit = 0,
    @Influence decimal(5, 2) = NULL,
    @Notes_Clear bit = 0,
    @Notes nvarchar(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[DealContactRole]
    SET
        [DealID] = ISNULL(@DealID, [DealID]),
        [SalesContactID] = ISNULL(@SalesContactID, [SalesContactID]),
        [BuyingRoleTypeID] = CASE WHEN @BuyingRoleTypeID_Clear = 1 THEN NULL ELSE ISNULL(@BuyingRoleTypeID, [BuyingRoleTypeID]) END,
        [Influence] = CASE WHEN @Influence_Clear = 1 THEN NULL ELSE ISNULL(@Influence, [Influence]) END,
        [Notes] = CASE WHEN @Notes_Clear = 1 THEN NULL ELSE ISNULL(@Notes, [Notes]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwDealContactRoles] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwDealContactRoles]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDealContactRole] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDealContactRole] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDealContactRole] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the DealContactRole table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateDealContactRole]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateDealContactRole];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateDealContactRole
ON [${flyway:defaultSchema}].[DealContactRole]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[DealContactRole]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[DealContactRole] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Sales: Deal Contact Roles */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDealContactRole] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDealContactRole] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDealContactRole] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Sales: Deal Contact Roles */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Contact Roles
-- Item: spDeleteDealContactRole
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR DealContactRole
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteDealContactRole]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteDealContactRole];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteDealContactRole]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[DealContactRole]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDealContactRole] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDealContactRole] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteDealContactRole] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Sales: Deal Contact Roles */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDealContactRole] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDealContactRole] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteDealContactRole] TO [cdp_Developer], [cdp_Integration];

/* Index for Foreign Keys for Deal */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key PipelineID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_PipelineID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_PipelineID ON [${flyway:defaultSchema}].[Deal] ([PipelineID]);

-- Index for foreign key PipelineStageID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_PipelineStageID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_PipelineStageID ON [${flyway:defaultSchema}].[Deal] ([PipelineStageID]);

-- Index for foreign key DealTypeID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_DealTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_DealTypeID ON [${flyway:defaultSchema}].[Deal] ([DealTypeID]);

-- Index for foreign key DealStatusTypeID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_DealStatusTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_DealStatusTypeID ON [${flyway:defaultSchema}].[Deal] ([DealStatusTypeID]);

-- Index for foreign key AccountID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_AccountID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_AccountID ON [${flyway:defaultSchema}].[Deal] ([AccountID]);

-- Index for foreign key PrimaryContactID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_PrimaryContactID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_PrimaryContactID ON [${flyway:defaultSchema}].[Deal] ([PrimaryContactID]);

-- Index for foreign key BillingContactID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_BillingContactID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_BillingContactID ON [${flyway:defaultSchema}].[Deal] ([BillingContactID]);

-- Index for foreign key CompanyID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_CompanyID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_CompanyID ON [${flyway:defaultSchema}].[Deal] ([CompanyID]);

-- Index for foreign key OwnerEmployeeID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_OwnerEmployeeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_OwnerEmployeeID ON [${flyway:defaultSchema}].[Deal] ([OwnerEmployeeID]);

-- Index for foreign key CurrencyID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_CurrencyID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_CurrencyID ON [${flyway:defaultSchema}].[Deal] ([CurrencyID]);

-- Index for foreign key ForecastCategoryTypeID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_ForecastCategoryTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_ForecastCategoryTypeID ON [${flyway:defaultSchema}].[Deal] ([ForecastCategoryTypeID]);

-- Index for foreign key LossReasonID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_LossReasonID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_LossReasonID ON [${flyway:defaultSchema}].[Deal] ([LossReasonID]);

-- Index for foreign key LeadSourceTypeID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_LeadSourceTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_LeadSourceTypeID ON [${flyway:defaultSchema}].[Deal] ([LeadSourceTypeID]);

-- Index for foreign key ContractID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_ContractID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_ContractID ON [${flyway:defaultSchema}].[Deal] ([ContractID]);

-- Index for foreign key RenewsContractID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_RenewsContractID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_RenewsContractID ON [${flyway:defaultSchema}].[Deal] ([RenewsContractID]);

-- Index for foreign key ClosedByUserID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_ClosedByUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_ClosedByUserID ON [${flyway:defaultSchema}].[Deal] ([ClosedByUserID]);

-- Index for foreign key OrderID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_OrderID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_OrderID ON [${flyway:defaultSchema}].[Deal] ([OrderID]);

/* Base View SQL for MJ_BizApps_Sales: Deals */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: vwDealsGenerated
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Deals
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  Deal
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwDealsGenerated]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwDealsGenerated];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwDealsGenerated]
AS
SELECT
    d.*,
    mjBizAppsSalesPipeline_PipelineID.[Name] AS [Pipeline],
    mjBizAppsSalesPipelineStage_PipelineStageID.[Name] AS [PipelineStage],
    mjBizAppsSalesDealType_DealTypeID.[Name] AS [DealType],
    mjBizAppsSalesDealStatusType_DealStatusTypeID.[Name] AS [DealStatusType],
    mjBizAppsSalesSalesAccount_AccountID.[Name] AS [Account],
    mjBizAppsSalesSalesContact_PrimaryContactID.[DisplayNameAndEmail] AS [PrimaryContact],
    mjBizAppsSalesSalesContact_BillingContactID.[DisplayNameAndEmail] AS [BillingContact],
    MJCompany_CompanyID.[Name] AS [Company],
    MJEmployee_OwnerEmployeeID.[FirstLast] AS [OwnerEmployee],
    mjBizAppsSalesForecastCategoryType_ForecastCategoryTypeID.[Name] AS [ForecastCategoryType],
    mjBizAppsSalesLossReason_LossReasonID.[Name] AS [LossReason],
    mjBizAppsSalesLeadSourceType_LeadSourceTypeID.[Name] AS [LeadSourceType],
    MJUser_ClosedByUserID.[Name] AS [ClosedByUser],
    mjBizAppsOrdersOrderHeader_OrderID.[OrderNumber] AS [Order]
FROM
    [${flyway:defaultSchema}].[Deal] AS d
INNER JOIN
    [${flyway:defaultSchema}].[Pipeline] AS mjBizAppsSalesPipeline_PipelineID
  ON
    [d].[PipelineID] = mjBizAppsSalesPipeline_PipelineID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[PipelineStage] AS mjBizAppsSalesPipelineStage_PipelineStageID
  ON
    [d].[PipelineStageID] = mjBizAppsSalesPipelineStage_PipelineStageID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[DealType] AS mjBizAppsSalesDealType_DealTypeID
  ON
    [d].[DealTypeID] = mjBizAppsSalesDealType_DealTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[DealStatusType] AS mjBizAppsSalesDealStatusType_DealStatusTypeID
  ON
    [d].[DealStatusTypeID] = mjBizAppsSalesDealStatusType_DealStatusTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[vwSalesAccounts] AS mjBizAppsSalesSalesAccount_AccountID
  ON
    [d].[AccountID] = mjBizAppsSalesSalesAccount_AccountID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[vwSalesContacts] AS mjBizAppsSalesSalesContact_PrimaryContactID
  ON
    [d].[PrimaryContactID] = mjBizAppsSalesSalesContact_PrimaryContactID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[vwSalesContacts] AS mjBizAppsSalesSalesContact_BillingContactID
  ON
    [d].[BillingContactID] = mjBizAppsSalesSalesContact_BillingContactID.[ID]
INNER JOIN
    [${mjSchema}].[Company] AS MJCompany_CompanyID
  ON
    [d].[CompanyID] = MJCompany_CompanyID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[vwEmployees] AS MJEmployee_OwnerEmployeeID
  ON
    [d].[OwnerEmployeeID] = MJEmployee_OwnerEmployeeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[ForecastCategoryType] AS mjBizAppsSalesForecastCategoryType_ForecastCategoryTypeID
  ON
    [d].[ForecastCategoryTypeID] = mjBizAppsSalesForecastCategoryType_ForecastCategoryTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[LossReason] AS mjBizAppsSalesLossReason_LossReasonID
  ON
    [d].[LossReasonID] = mjBizAppsSalesLossReason_LossReasonID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[LeadSourceType] AS mjBizAppsSalesLeadSourceType_LeadSourceTypeID
  ON
    [d].[LeadSourceTypeID] = mjBizAppsSalesLeadSourceType_LeadSourceTypeID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_ClosedByUserID
  ON
    [d].[ClosedByUserID] = MJUser_ClosedByUserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}_BizAppsOrders].[OrderHeader] AS mjBizAppsOrdersOrderHeader_OrderID
  ON
    [d].[OrderID] = mjBizAppsOrdersOrderHeader_OrderID.[ID]
GO
IF OBJECT_ID('[${flyway:defaultSchema}].[vwDeals]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwDeals] TO [cdp_UI], [cdp_Developer], [cdp_Integration]';
END;

/* Base View Permissions SQL for MJ_BizApps_Sales: Deals */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: Permissions for vwDeals
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

IF OBJECT_ID('[${flyway:defaultSchema}].[vwDeals]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwDeals] TO [cdp_UI], [cdp_Developer], [cdp_Integration]';
END;

/* spCreate SQL for MJ_BizApps_Sales: Deals */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: spCreateDeal
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR Deal
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateDeal]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateDeal];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateDeal]
    @ID uniqueidentifier = NULL,
    @DealNumber_Clear bit = 0,
    @DealNumber nvarchar(50) = NULL,
    @Name nvarchar(500),
    @PipelineID uniqueidentifier,
    @PipelineStageID_Clear bit = 0,
    @PipelineStageID uniqueidentifier = NULL,
    @DealTypeID_Clear bit = 0,
    @DealTypeID uniqueidentifier = NULL,
    @DealStatusTypeID_Clear bit = 0,
    @DealStatusTypeID uniqueidentifier = NULL,
    @AccountID_Clear bit = 0,
    @AccountID uniqueidentifier = NULL,
    @PrimaryContactID_Clear bit = 0,
    @PrimaryContactID uniqueidentifier = NULL,
    @BillingContactID_Clear bit = 0,
    @BillingContactID uniqueidentifier = NULL,
    @CompanyID uniqueidentifier,
    @OwnerEmployeeID_Clear bit = 0,
    @OwnerEmployeeID uniqueidentifier = NULL,
    @Amount_Clear bit = 0,
    @Amount decimal(19, 4) = NULL,
    @AmountIsComputed bit = NULL,
    @AmountComputedAt_Clear bit = 0,
    @AmountComputedAt datetimeoffset = NULL,
    @AmountSourceHash_Clear bit = 0,
    @AmountSourceHash nvarchar(128) = NULL,
    @CurrencyID_Clear bit = 0,
    @CurrencyID uniqueidentifier = NULL,
    @MRR_Clear bit = 0,
    @MRR decimal(19, 4) = NULL,
    @ARR_Clear bit = 0,
    @ARR decimal(19, 4) = NULL,
    @TermMonths_Clear bit = 0,
    @TermMonths int = NULL,
    @EstimatedProjectWeeks_Clear bit = 0,
    @EstimatedProjectWeeks int = NULL,
    @ExecutionDate_Clear bit = 0,
    @ExecutionDate date = NULL,
    @StartDate_Clear bit = 0,
    @StartDate date = NULL,
    @ExpectedCloseDate_Clear bit = 0,
    @ExpectedCloseDate date = NULL,
    @ActualCloseDate_Clear bit = 0,
    @ActualCloseDate date = NULL,
    @Probability_Clear bit = 0,
    @Probability decimal(5, 2) = NULL,
    @ForecastCategoryTypeID_Clear bit = 0,
    @ForecastCategoryTypeID uniqueidentifier = NULL,
    @LossReasonID_Clear bit = 0,
    @LossReasonID uniqueidentifier = NULL,
    @LossNotes_Clear bit = 0,
    @LossNotes nvarchar(MAX) = NULL,
    @LeadSourceTypeID_Clear bit = 0,
    @LeadSourceTypeID uniqueidentifier = NULL,
    @CampaignID_Clear bit = 0,
    @CampaignID uniqueidentifier = NULL,
    @ContractID_Clear bit = 0,
    @ContractID uniqueidentifier = NULL,
    @RenewsContractID_Clear bit = 0,
    @RenewsContractID uniqueidentifier = NULL,
    @AutoRenew bit = NULL,
    @AnnualIncreasePctOverride_Clear bit = 0,
    @AnnualIncreasePctOverride decimal(5, 2) = NULL,
    @CancellationNoticeDaysOverride_Clear bit = 0,
    @CancellationNoticeDaysOverride int = NULL,
    @PaymentMethod_Clear bit = 0,
    @PaymentMethod nvarchar(50) = NULL,
    @StandardAgreementModified bit = NULL,
    @ContractVariances_Clear bit = 0,
    @ContractVariances nvarchar(MAX) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @NextStep_Clear bit = 0,
    @NextStep nvarchar(1000) = NULL,
    @NextStepDate_Clear bit = 0,
    @NextStepDate date = NULL,
    @ClosedAt_Clear bit = 0,
    @ClosedAt datetimeoffset = NULL,
    @ClosedByUserID_Clear bit = 0,
    @ClosedByUserID uniqueidentifier = NULL,
    @OrderID_Clear bit = 0,
    @OrderID uniqueidentifier = NULL,
    @PredictedWinProbability_Clear bit = 0,
    @PredictedWinProbability decimal(5, 4) = NULL,
    @PredictedWinRiskBand_Clear bit = 0,
    @PredictedWinRiskBand nvarchar(20) = NULL,
    @PredictedWinScoredAt_Clear bit = 0,
    @PredictedWinScoredAt datetimeoffset = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[Deal]
            (
                [ID],
                [DealNumber],
                [Name],
                [PipelineID],
                [PipelineStageID],
                [DealTypeID],
                [DealStatusTypeID],
                [AccountID],
                [PrimaryContactID],
                [BillingContactID],
                [CompanyID],
                [OwnerEmployeeID],
                [Amount],
                [AmountIsComputed],
                [AmountComputedAt],
                [AmountSourceHash],
                [CurrencyID],
                [MRR],
                [ARR],
                [TermMonths],
                [EstimatedProjectWeeks],
                [ExecutionDate],
                [StartDate],
                [ExpectedCloseDate],
                [ActualCloseDate],
                [Probability],
                [ForecastCategoryTypeID],
                [LossReasonID],
                [LossNotes],
                [LeadSourceTypeID],
                [CampaignID],
                [ContractID],
                [RenewsContractID],
                [AutoRenew],
                [AnnualIncreasePctOverride],
                [CancellationNoticeDaysOverride],
                [PaymentMethod],
                [StandardAgreementModified],
                [ContractVariances],
                [Description],
                [NextStep],
                [NextStepDate],
                [ClosedAt],
                [ClosedByUserID],
                [OrderID],
                [PredictedWinProbability],
                [PredictedWinRiskBand],
                [PredictedWinScoredAt]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                CASE WHEN @DealNumber_Clear = 1 THEN NULL ELSE ISNULL(@DealNumber, NULL) END,
                @Name,
                @PipelineID,
                CASE WHEN @PipelineStageID_Clear = 1 THEN NULL ELSE ISNULL(@PipelineStageID, NULL) END,
                CASE WHEN @DealTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealTypeID, NULL) END,
                CASE WHEN @DealStatusTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealStatusTypeID, NULL) END,
                CASE WHEN @AccountID_Clear = 1 THEN NULL ELSE ISNULL(@AccountID, NULL) END,
                CASE WHEN @PrimaryContactID_Clear = 1 THEN NULL ELSE ISNULL(@PrimaryContactID, NULL) END,
                CASE WHEN @BillingContactID_Clear = 1 THEN NULL ELSE ISNULL(@BillingContactID, NULL) END,
                @CompanyID,
                CASE WHEN @OwnerEmployeeID_Clear = 1 THEN NULL ELSE ISNULL(@OwnerEmployeeID, NULL) END,
                CASE WHEN @Amount_Clear = 1 THEN NULL ELSE ISNULL(@Amount, NULL) END,
                ISNULL(@AmountIsComputed, 0),
                CASE WHEN @AmountComputedAt_Clear = 1 THEN NULL ELSE ISNULL(@AmountComputedAt, NULL) END,
                CASE WHEN @AmountSourceHash_Clear = 1 THEN NULL ELSE ISNULL(@AmountSourceHash, NULL) END,
                CASE WHEN @CurrencyID_Clear = 1 THEN NULL ELSE ISNULL(@CurrencyID, NULL) END,
                CASE WHEN @MRR_Clear = 1 THEN NULL ELSE ISNULL(@MRR, NULL) END,
                CASE WHEN @ARR_Clear = 1 THEN NULL ELSE ISNULL(@ARR, NULL) END,
                CASE WHEN @TermMonths_Clear = 1 THEN NULL ELSE ISNULL(@TermMonths, NULL) END,
                CASE WHEN @EstimatedProjectWeeks_Clear = 1 THEN NULL ELSE ISNULL(@EstimatedProjectWeeks, NULL) END,
                CASE WHEN @ExecutionDate_Clear = 1 THEN NULL ELSE ISNULL(@ExecutionDate, NULL) END,
                CASE WHEN @StartDate_Clear = 1 THEN NULL ELSE ISNULL(@StartDate, NULL) END,
                CASE WHEN @ExpectedCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ExpectedCloseDate, NULL) END,
                CASE WHEN @ActualCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ActualCloseDate, NULL) END,
                CASE WHEN @Probability_Clear = 1 THEN NULL ELSE ISNULL(@Probability, NULL) END,
                CASE WHEN @ForecastCategoryTypeID_Clear = 1 THEN NULL ELSE ISNULL(@ForecastCategoryTypeID, NULL) END,
                CASE WHEN @LossReasonID_Clear = 1 THEN NULL ELSE ISNULL(@LossReasonID, NULL) END,
                CASE WHEN @LossNotes_Clear = 1 THEN NULL ELSE ISNULL(@LossNotes, NULL) END,
                CASE WHEN @LeadSourceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@LeadSourceTypeID, NULL) END,
                CASE WHEN @CampaignID_Clear = 1 THEN NULL ELSE ISNULL(@CampaignID, NULL) END,
                CASE WHEN @ContractID_Clear = 1 THEN NULL ELSE ISNULL(@ContractID, NULL) END,
                CASE WHEN @RenewsContractID_Clear = 1 THEN NULL ELSE ISNULL(@RenewsContractID, NULL) END,
                ISNULL(@AutoRenew, 0),
                CASE WHEN @AnnualIncreasePctOverride_Clear = 1 THEN NULL ELSE ISNULL(@AnnualIncreasePctOverride, NULL) END,
                CASE WHEN @CancellationNoticeDaysOverride_Clear = 1 THEN NULL ELSE ISNULL(@CancellationNoticeDaysOverride, NULL) END,
                CASE WHEN @PaymentMethod_Clear = 1 THEN NULL ELSE ISNULL(@PaymentMethod, 'ACH') END,
                ISNULL(@StandardAgreementModified, 0),
                CASE WHEN @ContractVariances_Clear = 1 THEN NULL ELSE ISNULL(@ContractVariances, NULL) END,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                CASE WHEN @NextStep_Clear = 1 THEN NULL ELSE ISNULL(@NextStep, NULL) END,
                CASE WHEN @NextStepDate_Clear = 1 THEN NULL ELSE ISNULL(@NextStepDate, NULL) END,
                CASE WHEN @ClosedAt_Clear = 1 THEN NULL ELSE ISNULL(@ClosedAt, NULL) END,
                CASE WHEN @ClosedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ClosedByUserID, NULL) END,
                CASE WHEN @OrderID_Clear = 1 THEN NULL ELSE ISNULL(@OrderID, NULL) END,
                CASE WHEN @PredictedWinProbability_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinProbability, NULL) END,
                CASE WHEN @PredictedWinRiskBand_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinRiskBand, NULL) END,
                CASE WHEN @PredictedWinScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinScoredAt, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[Deal]
            (
                [DealNumber],
                [Name],
                [PipelineID],
                [PipelineStageID],
                [DealTypeID],
                [DealStatusTypeID],
                [AccountID],
                [PrimaryContactID],
                [BillingContactID],
                [CompanyID],
                [OwnerEmployeeID],
                [Amount],
                [AmountIsComputed],
                [AmountComputedAt],
                [AmountSourceHash],
                [CurrencyID],
                [MRR],
                [ARR],
                [TermMonths],
                [EstimatedProjectWeeks],
                [ExecutionDate],
                [StartDate],
                [ExpectedCloseDate],
                [ActualCloseDate],
                [Probability],
                [ForecastCategoryTypeID],
                [LossReasonID],
                [LossNotes],
                [LeadSourceTypeID],
                [CampaignID],
                [ContractID],
                [RenewsContractID],
                [AutoRenew],
                [AnnualIncreasePctOverride],
                [CancellationNoticeDaysOverride],
                [PaymentMethod],
                [StandardAgreementModified],
                [ContractVariances],
                [Description],
                [NextStep],
                [NextStepDate],
                [ClosedAt],
                [ClosedByUserID],
                [OrderID],
                [PredictedWinProbability],
                [PredictedWinRiskBand],
                [PredictedWinScoredAt]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                CASE WHEN @DealNumber_Clear = 1 THEN NULL ELSE ISNULL(@DealNumber, NULL) END,
                @Name,
                @PipelineID,
                CASE WHEN @PipelineStageID_Clear = 1 THEN NULL ELSE ISNULL(@PipelineStageID, NULL) END,
                CASE WHEN @DealTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealTypeID, NULL) END,
                CASE WHEN @DealStatusTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealStatusTypeID, NULL) END,
                CASE WHEN @AccountID_Clear = 1 THEN NULL ELSE ISNULL(@AccountID, NULL) END,
                CASE WHEN @PrimaryContactID_Clear = 1 THEN NULL ELSE ISNULL(@PrimaryContactID, NULL) END,
                CASE WHEN @BillingContactID_Clear = 1 THEN NULL ELSE ISNULL(@BillingContactID, NULL) END,
                @CompanyID,
                CASE WHEN @OwnerEmployeeID_Clear = 1 THEN NULL ELSE ISNULL(@OwnerEmployeeID, NULL) END,
                CASE WHEN @Amount_Clear = 1 THEN NULL ELSE ISNULL(@Amount, NULL) END,
                ISNULL(@AmountIsComputed, 0),
                CASE WHEN @AmountComputedAt_Clear = 1 THEN NULL ELSE ISNULL(@AmountComputedAt, NULL) END,
                CASE WHEN @AmountSourceHash_Clear = 1 THEN NULL ELSE ISNULL(@AmountSourceHash, NULL) END,
                CASE WHEN @CurrencyID_Clear = 1 THEN NULL ELSE ISNULL(@CurrencyID, NULL) END,
                CASE WHEN @MRR_Clear = 1 THEN NULL ELSE ISNULL(@MRR, NULL) END,
                CASE WHEN @ARR_Clear = 1 THEN NULL ELSE ISNULL(@ARR, NULL) END,
                CASE WHEN @TermMonths_Clear = 1 THEN NULL ELSE ISNULL(@TermMonths, NULL) END,
                CASE WHEN @EstimatedProjectWeeks_Clear = 1 THEN NULL ELSE ISNULL(@EstimatedProjectWeeks, NULL) END,
                CASE WHEN @ExecutionDate_Clear = 1 THEN NULL ELSE ISNULL(@ExecutionDate, NULL) END,
                CASE WHEN @StartDate_Clear = 1 THEN NULL ELSE ISNULL(@StartDate, NULL) END,
                CASE WHEN @ExpectedCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ExpectedCloseDate, NULL) END,
                CASE WHEN @ActualCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ActualCloseDate, NULL) END,
                CASE WHEN @Probability_Clear = 1 THEN NULL ELSE ISNULL(@Probability, NULL) END,
                CASE WHEN @ForecastCategoryTypeID_Clear = 1 THEN NULL ELSE ISNULL(@ForecastCategoryTypeID, NULL) END,
                CASE WHEN @LossReasonID_Clear = 1 THEN NULL ELSE ISNULL(@LossReasonID, NULL) END,
                CASE WHEN @LossNotes_Clear = 1 THEN NULL ELSE ISNULL(@LossNotes, NULL) END,
                CASE WHEN @LeadSourceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@LeadSourceTypeID, NULL) END,
                CASE WHEN @CampaignID_Clear = 1 THEN NULL ELSE ISNULL(@CampaignID, NULL) END,
                CASE WHEN @ContractID_Clear = 1 THEN NULL ELSE ISNULL(@ContractID, NULL) END,
                CASE WHEN @RenewsContractID_Clear = 1 THEN NULL ELSE ISNULL(@RenewsContractID, NULL) END,
                ISNULL(@AutoRenew, 0),
                CASE WHEN @AnnualIncreasePctOverride_Clear = 1 THEN NULL ELSE ISNULL(@AnnualIncreasePctOverride, NULL) END,
                CASE WHEN @CancellationNoticeDaysOverride_Clear = 1 THEN NULL ELSE ISNULL(@CancellationNoticeDaysOverride, NULL) END,
                CASE WHEN @PaymentMethod_Clear = 1 THEN NULL ELSE ISNULL(@PaymentMethod, 'ACH') END,
                ISNULL(@StandardAgreementModified, 0),
                CASE WHEN @ContractVariances_Clear = 1 THEN NULL ELSE ISNULL(@ContractVariances, NULL) END,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                CASE WHEN @NextStep_Clear = 1 THEN NULL ELSE ISNULL(@NextStep, NULL) END,
                CASE WHEN @NextStepDate_Clear = 1 THEN NULL ELSE ISNULL(@NextStepDate, NULL) END,
                CASE WHEN @ClosedAt_Clear = 1 THEN NULL ELSE ISNULL(@ClosedAt, NULL) END,
                CASE WHEN @ClosedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ClosedByUserID, NULL) END,
                CASE WHEN @OrderID_Clear = 1 THEN NULL ELSE ISNULL(@OrderID, NULL) END,
                CASE WHEN @PredictedWinProbability_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinProbability, NULL) END,
                CASE WHEN @PredictedWinRiskBand_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinRiskBand, NULL) END,
                CASE WHEN @PredictedWinScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinScoredAt, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwDeals] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Sales: Deals */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Sales: Deals */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: spUpdateDeal
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR Deal
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateDeal]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateDeal];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateDeal]
    @ID uniqueidentifier,
    @DealNumber_Clear bit = 0,
    @DealNumber nvarchar(50) = NULL,
    @Name nvarchar(500) = NULL,
    @PipelineID uniqueidentifier = NULL,
    @PipelineStageID_Clear bit = 0,
    @PipelineStageID uniqueidentifier = NULL,
    @DealTypeID_Clear bit = 0,
    @DealTypeID uniqueidentifier = NULL,
    @DealStatusTypeID_Clear bit = 0,
    @DealStatusTypeID uniqueidentifier = NULL,
    @AccountID_Clear bit = 0,
    @AccountID uniqueidentifier = NULL,
    @PrimaryContactID_Clear bit = 0,
    @PrimaryContactID uniqueidentifier = NULL,
    @BillingContactID_Clear bit = 0,
    @BillingContactID uniqueidentifier = NULL,
    @CompanyID uniqueidentifier = NULL,
    @OwnerEmployeeID_Clear bit = 0,
    @OwnerEmployeeID uniqueidentifier = NULL,
    @Amount_Clear bit = 0,
    @Amount decimal(19, 4) = NULL,
    @AmountIsComputed bit = NULL,
    @AmountComputedAt_Clear bit = 0,
    @AmountComputedAt datetimeoffset = NULL,
    @AmountSourceHash_Clear bit = 0,
    @AmountSourceHash nvarchar(128) = NULL,
    @CurrencyID_Clear bit = 0,
    @CurrencyID uniqueidentifier = NULL,
    @MRR_Clear bit = 0,
    @MRR decimal(19, 4) = NULL,
    @ARR_Clear bit = 0,
    @ARR decimal(19, 4) = NULL,
    @TermMonths_Clear bit = 0,
    @TermMonths int = NULL,
    @EstimatedProjectWeeks_Clear bit = 0,
    @EstimatedProjectWeeks int = NULL,
    @ExecutionDate_Clear bit = 0,
    @ExecutionDate date = NULL,
    @StartDate_Clear bit = 0,
    @StartDate date = NULL,
    @ExpectedCloseDate_Clear bit = 0,
    @ExpectedCloseDate date = NULL,
    @ActualCloseDate_Clear bit = 0,
    @ActualCloseDate date = NULL,
    @Probability_Clear bit = 0,
    @Probability decimal(5, 2) = NULL,
    @ForecastCategoryTypeID_Clear bit = 0,
    @ForecastCategoryTypeID uniqueidentifier = NULL,
    @LossReasonID_Clear bit = 0,
    @LossReasonID uniqueidentifier = NULL,
    @LossNotes_Clear bit = 0,
    @LossNotes nvarchar(MAX) = NULL,
    @LeadSourceTypeID_Clear bit = 0,
    @LeadSourceTypeID uniqueidentifier = NULL,
    @CampaignID_Clear bit = 0,
    @CampaignID uniqueidentifier = NULL,
    @ContractID_Clear bit = 0,
    @ContractID uniqueidentifier = NULL,
    @RenewsContractID_Clear bit = 0,
    @RenewsContractID uniqueidentifier = NULL,
    @AutoRenew bit = NULL,
    @AnnualIncreasePctOverride_Clear bit = 0,
    @AnnualIncreasePctOverride decimal(5, 2) = NULL,
    @CancellationNoticeDaysOverride_Clear bit = 0,
    @CancellationNoticeDaysOverride int = NULL,
    @PaymentMethod_Clear bit = 0,
    @PaymentMethod nvarchar(50) = NULL,
    @StandardAgreementModified bit = NULL,
    @ContractVariances_Clear bit = 0,
    @ContractVariances nvarchar(MAX) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @NextStep_Clear bit = 0,
    @NextStep nvarchar(1000) = NULL,
    @NextStepDate_Clear bit = 0,
    @NextStepDate date = NULL,
    @ClosedAt_Clear bit = 0,
    @ClosedAt datetimeoffset = NULL,
    @ClosedByUserID_Clear bit = 0,
    @ClosedByUserID uniqueidentifier = NULL,
    @OrderID_Clear bit = 0,
    @OrderID uniqueidentifier = NULL,
    @PredictedWinProbability_Clear bit = 0,
    @PredictedWinProbability decimal(5, 4) = NULL,
    @PredictedWinRiskBand_Clear bit = 0,
    @PredictedWinRiskBand nvarchar(20) = NULL,
    @PredictedWinScoredAt_Clear bit = 0,
    @PredictedWinScoredAt datetimeoffset = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[Deal]
    SET
        [DealNumber] = CASE WHEN @DealNumber_Clear = 1 THEN NULL ELSE ISNULL(@DealNumber, [DealNumber]) END,
        [Name] = ISNULL(@Name, [Name]),
        [PipelineID] = ISNULL(@PipelineID, [PipelineID]),
        [PipelineStageID] = CASE WHEN @PipelineStageID_Clear = 1 THEN NULL ELSE ISNULL(@PipelineStageID, [PipelineStageID]) END,
        [DealTypeID] = CASE WHEN @DealTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealTypeID, [DealTypeID]) END,
        [DealStatusTypeID] = CASE WHEN @DealStatusTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealStatusTypeID, [DealStatusTypeID]) END,
        [AccountID] = CASE WHEN @AccountID_Clear = 1 THEN NULL ELSE ISNULL(@AccountID, [AccountID]) END,
        [PrimaryContactID] = CASE WHEN @PrimaryContactID_Clear = 1 THEN NULL ELSE ISNULL(@PrimaryContactID, [PrimaryContactID]) END,
        [BillingContactID] = CASE WHEN @BillingContactID_Clear = 1 THEN NULL ELSE ISNULL(@BillingContactID, [BillingContactID]) END,
        [CompanyID] = ISNULL(@CompanyID, [CompanyID]),
        [OwnerEmployeeID] = CASE WHEN @OwnerEmployeeID_Clear = 1 THEN NULL ELSE ISNULL(@OwnerEmployeeID, [OwnerEmployeeID]) END,
        [Amount] = CASE WHEN @Amount_Clear = 1 THEN NULL ELSE ISNULL(@Amount, [Amount]) END,
        [AmountIsComputed] = ISNULL(@AmountIsComputed, [AmountIsComputed]),
        [AmountComputedAt] = CASE WHEN @AmountComputedAt_Clear = 1 THEN NULL ELSE ISNULL(@AmountComputedAt, [AmountComputedAt]) END,
        [AmountSourceHash] = CASE WHEN @AmountSourceHash_Clear = 1 THEN NULL ELSE ISNULL(@AmountSourceHash, [AmountSourceHash]) END,
        [CurrencyID] = CASE WHEN @CurrencyID_Clear = 1 THEN NULL ELSE ISNULL(@CurrencyID, [CurrencyID]) END,
        [MRR] = CASE WHEN @MRR_Clear = 1 THEN NULL ELSE ISNULL(@MRR, [MRR]) END,
        [ARR] = CASE WHEN @ARR_Clear = 1 THEN NULL ELSE ISNULL(@ARR, [ARR]) END,
        [TermMonths] = CASE WHEN @TermMonths_Clear = 1 THEN NULL ELSE ISNULL(@TermMonths, [TermMonths]) END,
        [EstimatedProjectWeeks] = CASE WHEN @EstimatedProjectWeeks_Clear = 1 THEN NULL ELSE ISNULL(@EstimatedProjectWeeks, [EstimatedProjectWeeks]) END,
        [ExecutionDate] = CASE WHEN @ExecutionDate_Clear = 1 THEN NULL ELSE ISNULL(@ExecutionDate, [ExecutionDate]) END,
        [StartDate] = CASE WHEN @StartDate_Clear = 1 THEN NULL ELSE ISNULL(@StartDate, [StartDate]) END,
        [ExpectedCloseDate] = CASE WHEN @ExpectedCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ExpectedCloseDate, [ExpectedCloseDate]) END,
        [ActualCloseDate] = CASE WHEN @ActualCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ActualCloseDate, [ActualCloseDate]) END,
        [Probability] = CASE WHEN @Probability_Clear = 1 THEN NULL ELSE ISNULL(@Probability, [Probability]) END,
        [ForecastCategoryTypeID] = CASE WHEN @ForecastCategoryTypeID_Clear = 1 THEN NULL ELSE ISNULL(@ForecastCategoryTypeID, [ForecastCategoryTypeID]) END,
        [LossReasonID] = CASE WHEN @LossReasonID_Clear = 1 THEN NULL ELSE ISNULL(@LossReasonID, [LossReasonID]) END,
        [LossNotes] = CASE WHEN @LossNotes_Clear = 1 THEN NULL ELSE ISNULL(@LossNotes, [LossNotes]) END,
        [LeadSourceTypeID] = CASE WHEN @LeadSourceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@LeadSourceTypeID, [LeadSourceTypeID]) END,
        [CampaignID] = CASE WHEN @CampaignID_Clear = 1 THEN NULL ELSE ISNULL(@CampaignID, [CampaignID]) END,
        [ContractID] = CASE WHEN @ContractID_Clear = 1 THEN NULL ELSE ISNULL(@ContractID, [ContractID]) END,
        [RenewsContractID] = CASE WHEN @RenewsContractID_Clear = 1 THEN NULL ELSE ISNULL(@RenewsContractID, [RenewsContractID]) END,
        [AutoRenew] = ISNULL(@AutoRenew, [AutoRenew]),
        [AnnualIncreasePctOverride] = CASE WHEN @AnnualIncreasePctOverride_Clear = 1 THEN NULL ELSE ISNULL(@AnnualIncreasePctOverride, [AnnualIncreasePctOverride]) END,
        [CancellationNoticeDaysOverride] = CASE WHEN @CancellationNoticeDaysOverride_Clear = 1 THEN NULL ELSE ISNULL(@CancellationNoticeDaysOverride, [CancellationNoticeDaysOverride]) END,
        [PaymentMethod] = CASE WHEN @PaymentMethod_Clear = 1 THEN NULL ELSE ISNULL(@PaymentMethod, [PaymentMethod]) END,
        [StandardAgreementModified] = ISNULL(@StandardAgreementModified, [StandardAgreementModified]),
        [ContractVariances] = CASE WHEN @ContractVariances_Clear = 1 THEN NULL ELSE ISNULL(@ContractVariances, [ContractVariances]) END,
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [NextStep] = CASE WHEN @NextStep_Clear = 1 THEN NULL ELSE ISNULL(@NextStep, [NextStep]) END,
        [NextStepDate] = CASE WHEN @NextStepDate_Clear = 1 THEN NULL ELSE ISNULL(@NextStepDate, [NextStepDate]) END,
        [ClosedAt] = CASE WHEN @ClosedAt_Clear = 1 THEN NULL ELSE ISNULL(@ClosedAt, [ClosedAt]) END,
        [ClosedByUserID] = CASE WHEN @ClosedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ClosedByUserID, [ClosedByUserID]) END,
        [OrderID] = CASE WHEN @OrderID_Clear = 1 THEN NULL ELSE ISNULL(@OrderID, [OrderID]) END,
        [PredictedWinProbability] = CASE WHEN @PredictedWinProbability_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinProbability, [PredictedWinProbability]) END,
        [PredictedWinRiskBand] = CASE WHEN @PredictedWinRiskBand_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinRiskBand, [PredictedWinRiskBand]) END,
        [PredictedWinScoredAt] = CASE WHEN @PredictedWinScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinScoredAt, [PredictedWinScoredAt]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwDeals] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwDeals]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the Deal table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateDeal]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateDeal];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateDeal
ON [${flyway:defaultSchema}].[Deal]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[Deal]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[Deal] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Sales: Deals */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Sales: Deals */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: spDeleteDeal
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR Deal
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteDeal]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteDeal];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteDeal]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[Deal]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Sales: Deals */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] TO [cdp_Developer], [cdp_Integration];

/* SQL text to delete unneeded entity fields (2 scoped entities) */
EXEC [${mjSchema}].[spDeleteUnneededEntityFields] @ExcludedSchemaNames='', @EntityIDs='79148DE5-7F99-44AC-ACD4-5EE7BA93D354,862535EB-36DD-4434-8B4E-E256363E781F', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to update existing entity fields from schema (2 scoped entities) */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='79148DE5-7F99-44AC-ACD4-5EE7BA93D354,862535EB-36DD-4434-8B4E-E256363E781F', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Refresh custom base views for modified entities so schema changes are picked up */
EXEC sp_refreshview '${flyway:defaultSchema}.vwDealsGenerated';
IF OBJECT_ID('[${flyway:defaultSchema}].[vwDeals]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'EXEC sp_refreshview ''${flyway:defaultSchema}.vwDeals'';';
END;


/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 2 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '17cd69c1-932d-471f-a5b7-48d5bf11d82b' OR (EntityID = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND Name = 'PrimaryContact')) BEGIN
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
            '17cd69c1-932d-471f-a5b7-48d5bf11d82b',
            '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', -- Entity: MJ_BizApps_Sales: Deals
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'),
            'PrimaryContact',
            'Primary Contact',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '8e9eacad-6c01-4866-a2c1-a220a0513f7b' OR (EntityID = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND Name = 'BillingContact')) BEGIN
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
            '8e9eacad-6c01-4866-a2c1-a220a0513f7b',
            '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', -- Entity: MJ_BizApps_Sales: Deals
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'),
            'BillingContact',
            'Billing Contact',
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

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Index for Foreign Keys for Deal */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key PipelineID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_PipelineID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_PipelineID ON [${flyway:defaultSchema}].[Deal] ([PipelineID]);

-- Index for foreign key PipelineStageID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_PipelineStageID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_PipelineStageID ON [${flyway:defaultSchema}].[Deal] ([PipelineStageID]);

-- Index for foreign key DealTypeID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_DealTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_DealTypeID ON [${flyway:defaultSchema}].[Deal] ([DealTypeID]);

-- Index for foreign key DealStatusTypeID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_DealStatusTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_DealStatusTypeID ON [${flyway:defaultSchema}].[Deal] ([DealStatusTypeID]);

-- Index for foreign key AccountID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_AccountID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_AccountID ON [${flyway:defaultSchema}].[Deal] ([AccountID]);

-- Index for foreign key PrimaryContactID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_PrimaryContactID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_PrimaryContactID ON [${flyway:defaultSchema}].[Deal] ([PrimaryContactID]);

-- Index for foreign key BillingContactID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_BillingContactID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_BillingContactID ON [${flyway:defaultSchema}].[Deal] ([BillingContactID]);

-- Index for foreign key CompanyID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_CompanyID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_CompanyID ON [${flyway:defaultSchema}].[Deal] ([CompanyID]);

-- Index for foreign key OwnerEmployeeID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_OwnerEmployeeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_OwnerEmployeeID ON [${flyway:defaultSchema}].[Deal] ([OwnerEmployeeID]);

-- Index for foreign key CurrencyID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_CurrencyID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_CurrencyID ON [${flyway:defaultSchema}].[Deal] ([CurrencyID]);

-- Index for foreign key ForecastCategoryTypeID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_ForecastCategoryTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_ForecastCategoryTypeID ON [${flyway:defaultSchema}].[Deal] ([ForecastCategoryTypeID]);

-- Index for foreign key LossReasonID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_LossReasonID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_LossReasonID ON [${flyway:defaultSchema}].[Deal] ([LossReasonID]);

-- Index for foreign key LeadSourceTypeID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_LeadSourceTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_LeadSourceTypeID ON [${flyway:defaultSchema}].[Deal] ([LeadSourceTypeID]);

-- Index for foreign key ContractID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_ContractID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_ContractID ON [${flyway:defaultSchema}].[Deal] ([ContractID]);

-- Index for foreign key RenewsContractID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_RenewsContractID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_RenewsContractID ON [${flyway:defaultSchema}].[Deal] ([RenewsContractID]);

-- Index for foreign key ClosedByUserID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_ClosedByUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_ClosedByUserID ON [${flyway:defaultSchema}].[Deal] ([ClosedByUserID]);

-- Index for foreign key OrderID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_OrderID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_OrderID ON [${flyway:defaultSchema}].[Deal] ([OrderID]);

/* Base View SQL for MJ_BizApps_Sales: Deals */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: vwDealsGenerated
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Deals
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  Deal
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwDealsGenerated]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwDealsGenerated];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwDealsGenerated]
AS
SELECT
    d.*,
    mjBizAppsSalesPipeline_PipelineID.[Name] AS [Pipeline],
    mjBizAppsSalesPipelineStage_PipelineStageID.[Name] AS [PipelineStage],
    mjBizAppsSalesDealType_DealTypeID.[Name] AS [DealType],
    mjBizAppsSalesDealStatusType_DealStatusTypeID.[Name] AS [DealStatusType],
    mjBizAppsSalesSalesAccount_AccountID.[Name] AS [Account],
    mjBizAppsSalesSalesContact_PrimaryContactID.[DisplayNameAndEmail] AS [PrimaryContact],
    mjBizAppsSalesSalesContact_BillingContactID.[DisplayNameAndEmail] AS [BillingContact],
    MJCompany_CompanyID.[Name] AS [Company],
    MJEmployee_OwnerEmployeeID.[FirstLast] AS [OwnerEmployee],
    mjBizAppsSalesForecastCategoryType_ForecastCategoryTypeID.[Name] AS [ForecastCategoryType],
    mjBizAppsSalesLossReason_LossReasonID.[Name] AS [LossReason],
    mjBizAppsSalesLeadSourceType_LeadSourceTypeID.[Name] AS [LeadSourceType],
    MJUser_ClosedByUserID.[Name] AS [ClosedByUser],
    mjBizAppsOrdersOrderHeader_OrderID.[OrderNumber] AS [Order]
FROM
    [${flyway:defaultSchema}].[Deal] AS d
INNER JOIN
    [${flyway:defaultSchema}].[Pipeline] AS mjBizAppsSalesPipeline_PipelineID
  ON
    [d].[PipelineID] = mjBizAppsSalesPipeline_PipelineID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[PipelineStage] AS mjBizAppsSalesPipelineStage_PipelineStageID
  ON
    [d].[PipelineStageID] = mjBizAppsSalesPipelineStage_PipelineStageID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[DealType] AS mjBizAppsSalesDealType_DealTypeID
  ON
    [d].[DealTypeID] = mjBizAppsSalesDealType_DealTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[DealStatusType] AS mjBizAppsSalesDealStatusType_DealStatusTypeID
  ON
    [d].[DealStatusTypeID] = mjBizAppsSalesDealStatusType_DealStatusTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[vwSalesAccounts] AS mjBizAppsSalesSalesAccount_AccountID
  ON
    [d].[AccountID] = mjBizAppsSalesSalesAccount_AccountID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[vwSalesContacts] AS mjBizAppsSalesSalesContact_PrimaryContactID
  ON
    [d].[PrimaryContactID] = mjBizAppsSalesSalesContact_PrimaryContactID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[vwSalesContacts] AS mjBizAppsSalesSalesContact_BillingContactID
  ON
    [d].[BillingContactID] = mjBizAppsSalesSalesContact_BillingContactID.[ID]
INNER JOIN
    [${mjSchema}].[Company] AS MJCompany_CompanyID
  ON
    [d].[CompanyID] = MJCompany_CompanyID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[vwEmployees] AS MJEmployee_OwnerEmployeeID
  ON
    [d].[OwnerEmployeeID] = MJEmployee_OwnerEmployeeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[ForecastCategoryType] AS mjBizAppsSalesForecastCategoryType_ForecastCategoryTypeID
  ON
    [d].[ForecastCategoryTypeID] = mjBizAppsSalesForecastCategoryType_ForecastCategoryTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[LossReason] AS mjBizAppsSalesLossReason_LossReasonID
  ON
    [d].[LossReasonID] = mjBizAppsSalesLossReason_LossReasonID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[LeadSourceType] AS mjBizAppsSalesLeadSourceType_LeadSourceTypeID
  ON
    [d].[LeadSourceTypeID] = mjBizAppsSalesLeadSourceType_LeadSourceTypeID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_ClosedByUserID
  ON
    [d].[ClosedByUserID] = MJUser_ClosedByUserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}_BizAppsOrders].[OrderHeader] AS mjBizAppsOrdersOrderHeader_OrderID
  ON
    [d].[OrderID] = mjBizAppsOrdersOrderHeader_OrderID.[ID]
GO
IF OBJECT_ID('[${flyway:defaultSchema}].[vwDeals]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwDeals] TO [cdp_UI], [cdp_Developer], [cdp_Integration]';
END;

/* Base View Permissions SQL for MJ_BizApps_Sales: Deals */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: Permissions for vwDeals
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

IF OBJECT_ID('[${flyway:defaultSchema}].[vwDeals]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwDeals] TO [cdp_UI], [cdp_Developer], [cdp_Integration]';
END;

/* spCreate SQL for MJ_BizApps_Sales: Deals */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: spCreateDeal
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR Deal
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateDeal]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateDeal];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateDeal]
    @ID uniqueidentifier = NULL,
    @DealNumber_Clear bit = 0,
    @DealNumber nvarchar(50) = NULL,
    @Name nvarchar(500),
    @PipelineID uniqueidentifier,
    @PipelineStageID_Clear bit = 0,
    @PipelineStageID uniqueidentifier = NULL,
    @DealTypeID_Clear bit = 0,
    @DealTypeID uniqueidentifier = NULL,
    @DealStatusTypeID_Clear bit = 0,
    @DealStatusTypeID uniqueidentifier = NULL,
    @AccountID_Clear bit = 0,
    @AccountID uniqueidentifier = NULL,
    @PrimaryContactID_Clear bit = 0,
    @PrimaryContactID uniqueidentifier = NULL,
    @BillingContactID_Clear bit = 0,
    @BillingContactID uniqueidentifier = NULL,
    @CompanyID uniqueidentifier,
    @OwnerEmployeeID_Clear bit = 0,
    @OwnerEmployeeID uniqueidentifier = NULL,
    @Amount_Clear bit = 0,
    @Amount decimal(19, 4) = NULL,
    @AmountIsComputed bit = NULL,
    @AmountComputedAt_Clear bit = 0,
    @AmountComputedAt datetimeoffset = NULL,
    @AmountSourceHash_Clear bit = 0,
    @AmountSourceHash nvarchar(128) = NULL,
    @CurrencyID_Clear bit = 0,
    @CurrencyID uniqueidentifier = NULL,
    @MRR_Clear bit = 0,
    @MRR decimal(19, 4) = NULL,
    @ARR_Clear bit = 0,
    @ARR decimal(19, 4) = NULL,
    @TermMonths_Clear bit = 0,
    @TermMonths int = NULL,
    @EstimatedProjectWeeks_Clear bit = 0,
    @EstimatedProjectWeeks int = NULL,
    @ExecutionDate_Clear bit = 0,
    @ExecutionDate date = NULL,
    @StartDate_Clear bit = 0,
    @StartDate date = NULL,
    @ExpectedCloseDate_Clear bit = 0,
    @ExpectedCloseDate date = NULL,
    @ActualCloseDate_Clear bit = 0,
    @ActualCloseDate date = NULL,
    @Probability_Clear bit = 0,
    @Probability decimal(5, 2) = NULL,
    @ForecastCategoryTypeID_Clear bit = 0,
    @ForecastCategoryTypeID uniqueidentifier = NULL,
    @LossReasonID_Clear bit = 0,
    @LossReasonID uniqueidentifier = NULL,
    @LossNotes_Clear bit = 0,
    @LossNotes nvarchar(MAX) = NULL,
    @LeadSourceTypeID_Clear bit = 0,
    @LeadSourceTypeID uniqueidentifier = NULL,
    @CampaignID_Clear bit = 0,
    @CampaignID uniqueidentifier = NULL,
    @ContractID_Clear bit = 0,
    @ContractID uniqueidentifier = NULL,
    @RenewsContractID_Clear bit = 0,
    @RenewsContractID uniqueidentifier = NULL,
    @AutoRenew bit = NULL,
    @AnnualIncreasePctOverride_Clear bit = 0,
    @AnnualIncreasePctOverride decimal(5, 2) = NULL,
    @CancellationNoticeDaysOverride_Clear bit = 0,
    @CancellationNoticeDaysOverride int = NULL,
    @PaymentMethod_Clear bit = 0,
    @PaymentMethod nvarchar(50) = NULL,
    @StandardAgreementModified bit = NULL,
    @ContractVariances_Clear bit = 0,
    @ContractVariances nvarchar(MAX) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @NextStep_Clear bit = 0,
    @NextStep nvarchar(1000) = NULL,
    @NextStepDate_Clear bit = 0,
    @NextStepDate date = NULL,
    @ClosedAt_Clear bit = 0,
    @ClosedAt datetimeoffset = NULL,
    @ClosedByUserID_Clear bit = 0,
    @ClosedByUserID uniqueidentifier = NULL,
    @OrderID_Clear bit = 0,
    @OrderID uniqueidentifier = NULL,
    @PredictedWinProbability_Clear bit = 0,
    @PredictedWinProbability decimal(5, 4) = NULL,
    @PredictedWinRiskBand_Clear bit = 0,
    @PredictedWinRiskBand nvarchar(20) = NULL,
    @PredictedWinScoredAt_Clear bit = 0,
    @PredictedWinScoredAt datetimeoffset = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[Deal]
            (
                [ID],
                [DealNumber],
                [Name],
                [PipelineID],
                [PipelineStageID],
                [DealTypeID],
                [DealStatusTypeID],
                [AccountID],
                [PrimaryContactID],
                [BillingContactID],
                [CompanyID],
                [OwnerEmployeeID],
                [Amount],
                [AmountIsComputed],
                [AmountComputedAt],
                [AmountSourceHash],
                [CurrencyID],
                [MRR],
                [ARR],
                [TermMonths],
                [EstimatedProjectWeeks],
                [ExecutionDate],
                [StartDate],
                [ExpectedCloseDate],
                [ActualCloseDate],
                [Probability],
                [ForecastCategoryTypeID],
                [LossReasonID],
                [LossNotes],
                [LeadSourceTypeID],
                [CampaignID],
                [ContractID],
                [RenewsContractID],
                [AutoRenew],
                [AnnualIncreasePctOverride],
                [CancellationNoticeDaysOverride],
                [PaymentMethod],
                [StandardAgreementModified],
                [ContractVariances],
                [Description],
                [NextStep],
                [NextStepDate],
                [ClosedAt],
                [ClosedByUserID],
                [OrderID],
                [PredictedWinProbability],
                [PredictedWinRiskBand],
                [PredictedWinScoredAt]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                CASE WHEN @DealNumber_Clear = 1 THEN NULL ELSE ISNULL(@DealNumber, NULL) END,
                @Name,
                @PipelineID,
                CASE WHEN @PipelineStageID_Clear = 1 THEN NULL ELSE ISNULL(@PipelineStageID, NULL) END,
                CASE WHEN @DealTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealTypeID, NULL) END,
                CASE WHEN @DealStatusTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealStatusTypeID, NULL) END,
                CASE WHEN @AccountID_Clear = 1 THEN NULL ELSE ISNULL(@AccountID, NULL) END,
                CASE WHEN @PrimaryContactID_Clear = 1 THEN NULL ELSE ISNULL(@PrimaryContactID, NULL) END,
                CASE WHEN @BillingContactID_Clear = 1 THEN NULL ELSE ISNULL(@BillingContactID, NULL) END,
                @CompanyID,
                CASE WHEN @OwnerEmployeeID_Clear = 1 THEN NULL ELSE ISNULL(@OwnerEmployeeID, NULL) END,
                CASE WHEN @Amount_Clear = 1 THEN NULL ELSE ISNULL(@Amount, NULL) END,
                ISNULL(@AmountIsComputed, 0),
                CASE WHEN @AmountComputedAt_Clear = 1 THEN NULL ELSE ISNULL(@AmountComputedAt, NULL) END,
                CASE WHEN @AmountSourceHash_Clear = 1 THEN NULL ELSE ISNULL(@AmountSourceHash, NULL) END,
                CASE WHEN @CurrencyID_Clear = 1 THEN NULL ELSE ISNULL(@CurrencyID, NULL) END,
                CASE WHEN @MRR_Clear = 1 THEN NULL ELSE ISNULL(@MRR, NULL) END,
                CASE WHEN @ARR_Clear = 1 THEN NULL ELSE ISNULL(@ARR, NULL) END,
                CASE WHEN @TermMonths_Clear = 1 THEN NULL ELSE ISNULL(@TermMonths, NULL) END,
                CASE WHEN @EstimatedProjectWeeks_Clear = 1 THEN NULL ELSE ISNULL(@EstimatedProjectWeeks, NULL) END,
                CASE WHEN @ExecutionDate_Clear = 1 THEN NULL ELSE ISNULL(@ExecutionDate, NULL) END,
                CASE WHEN @StartDate_Clear = 1 THEN NULL ELSE ISNULL(@StartDate, NULL) END,
                CASE WHEN @ExpectedCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ExpectedCloseDate, NULL) END,
                CASE WHEN @ActualCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ActualCloseDate, NULL) END,
                CASE WHEN @Probability_Clear = 1 THEN NULL ELSE ISNULL(@Probability, NULL) END,
                CASE WHEN @ForecastCategoryTypeID_Clear = 1 THEN NULL ELSE ISNULL(@ForecastCategoryTypeID, NULL) END,
                CASE WHEN @LossReasonID_Clear = 1 THEN NULL ELSE ISNULL(@LossReasonID, NULL) END,
                CASE WHEN @LossNotes_Clear = 1 THEN NULL ELSE ISNULL(@LossNotes, NULL) END,
                CASE WHEN @LeadSourceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@LeadSourceTypeID, NULL) END,
                CASE WHEN @CampaignID_Clear = 1 THEN NULL ELSE ISNULL(@CampaignID, NULL) END,
                CASE WHEN @ContractID_Clear = 1 THEN NULL ELSE ISNULL(@ContractID, NULL) END,
                CASE WHEN @RenewsContractID_Clear = 1 THEN NULL ELSE ISNULL(@RenewsContractID, NULL) END,
                ISNULL(@AutoRenew, 0),
                CASE WHEN @AnnualIncreasePctOverride_Clear = 1 THEN NULL ELSE ISNULL(@AnnualIncreasePctOverride, NULL) END,
                CASE WHEN @CancellationNoticeDaysOverride_Clear = 1 THEN NULL ELSE ISNULL(@CancellationNoticeDaysOverride, NULL) END,
                CASE WHEN @PaymentMethod_Clear = 1 THEN NULL ELSE ISNULL(@PaymentMethod, 'ACH') END,
                ISNULL(@StandardAgreementModified, 0),
                CASE WHEN @ContractVariances_Clear = 1 THEN NULL ELSE ISNULL(@ContractVariances, NULL) END,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                CASE WHEN @NextStep_Clear = 1 THEN NULL ELSE ISNULL(@NextStep, NULL) END,
                CASE WHEN @NextStepDate_Clear = 1 THEN NULL ELSE ISNULL(@NextStepDate, NULL) END,
                CASE WHEN @ClosedAt_Clear = 1 THEN NULL ELSE ISNULL(@ClosedAt, NULL) END,
                CASE WHEN @ClosedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ClosedByUserID, NULL) END,
                CASE WHEN @OrderID_Clear = 1 THEN NULL ELSE ISNULL(@OrderID, NULL) END,
                CASE WHEN @PredictedWinProbability_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinProbability, NULL) END,
                CASE WHEN @PredictedWinRiskBand_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinRiskBand, NULL) END,
                CASE WHEN @PredictedWinScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinScoredAt, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[Deal]
            (
                [DealNumber],
                [Name],
                [PipelineID],
                [PipelineStageID],
                [DealTypeID],
                [DealStatusTypeID],
                [AccountID],
                [PrimaryContactID],
                [BillingContactID],
                [CompanyID],
                [OwnerEmployeeID],
                [Amount],
                [AmountIsComputed],
                [AmountComputedAt],
                [AmountSourceHash],
                [CurrencyID],
                [MRR],
                [ARR],
                [TermMonths],
                [EstimatedProjectWeeks],
                [ExecutionDate],
                [StartDate],
                [ExpectedCloseDate],
                [ActualCloseDate],
                [Probability],
                [ForecastCategoryTypeID],
                [LossReasonID],
                [LossNotes],
                [LeadSourceTypeID],
                [CampaignID],
                [ContractID],
                [RenewsContractID],
                [AutoRenew],
                [AnnualIncreasePctOverride],
                [CancellationNoticeDaysOverride],
                [PaymentMethod],
                [StandardAgreementModified],
                [ContractVariances],
                [Description],
                [NextStep],
                [NextStepDate],
                [ClosedAt],
                [ClosedByUserID],
                [OrderID],
                [PredictedWinProbability],
                [PredictedWinRiskBand],
                [PredictedWinScoredAt]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                CASE WHEN @DealNumber_Clear = 1 THEN NULL ELSE ISNULL(@DealNumber, NULL) END,
                @Name,
                @PipelineID,
                CASE WHEN @PipelineStageID_Clear = 1 THEN NULL ELSE ISNULL(@PipelineStageID, NULL) END,
                CASE WHEN @DealTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealTypeID, NULL) END,
                CASE WHEN @DealStatusTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealStatusTypeID, NULL) END,
                CASE WHEN @AccountID_Clear = 1 THEN NULL ELSE ISNULL(@AccountID, NULL) END,
                CASE WHEN @PrimaryContactID_Clear = 1 THEN NULL ELSE ISNULL(@PrimaryContactID, NULL) END,
                CASE WHEN @BillingContactID_Clear = 1 THEN NULL ELSE ISNULL(@BillingContactID, NULL) END,
                @CompanyID,
                CASE WHEN @OwnerEmployeeID_Clear = 1 THEN NULL ELSE ISNULL(@OwnerEmployeeID, NULL) END,
                CASE WHEN @Amount_Clear = 1 THEN NULL ELSE ISNULL(@Amount, NULL) END,
                ISNULL(@AmountIsComputed, 0),
                CASE WHEN @AmountComputedAt_Clear = 1 THEN NULL ELSE ISNULL(@AmountComputedAt, NULL) END,
                CASE WHEN @AmountSourceHash_Clear = 1 THEN NULL ELSE ISNULL(@AmountSourceHash, NULL) END,
                CASE WHEN @CurrencyID_Clear = 1 THEN NULL ELSE ISNULL(@CurrencyID, NULL) END,
                CASE WHEN @MRR_Clear = 1 THEN NULL ELSE ISNULL(@MRR, NULL) END,
                CASE WHEN @ARR_Clear = 1 THEN NULL ELSE ISNULL(@ARR, NULL) END,
                CASE WHEN @TermMonths_Clear = 1 THEN NULL ELSE ISNULL(@TermMonths, NULL) END,
                CASE WHEN @EstimatedProjectWeeks_Clear = 1 THEN NULL ELSE ISNULL(@EstimatedProjectWeeks, NULL) END,
                CASE WHEN @ExecutionDate_Clear = 1 THEN NULL ELSE ISNULL(@ExecutionDate, NULL) END,
                CASE WHEN @StartDate_Clear = 1 THEN NULL ELSE ISNULL(@StartDate, NULL) END,
                CASE WHEN @ExpectedCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ExpectedCloseDate, NULL) END,
                CASE WHEN @ActualCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ActualCloseDate, NULL) END,
                CASE WHEN @Probability_Clear = 1 THEN NULL ELSE ISNULL(@Probability, NULL) END,
                CASE WHEN @ForecastCategoryTypeID_Clear = 1 THEN NULL ELSE ISNULL(@ForecastCategoryTypeID, NULL) END,
                CASE WHEN @LossReasonID_Clear = 1 THEN NULL ELSE ISNULL(@LossReasonID, NULL) END,
                CASE WHEN @LossNotes_Clear = 1 THEN NULL ELSE ISNULL(@LossNotes, NULL) END,
                CASE WHEN @LeadSourceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@LeadSourceTypeID, NULL) END,
                CASE WHEN @CampaignID_Clear = 1 THEN NULL ELSE ISNULL(@CampaignID, NULL) END,
                CASE WHEN @ContractID_Clear = 1 THEN NULL ELSE ISNULL(@ContractID, NULL) END,
                CASE WHEN @RenewsContractID_Clear = 1 THEN NULL ELSE ISNULL(@RenewsContractID, NULL) END,
                ISNULL(@AutoRenew, 0),
                CASE WHEN @AnnualIncreasePctOverride_Clear = 1 THEN NULL ELSE ISNULL(@AnnualIncreasePctOverride, NULL) END,
                CASE WHEN @CancellationNoticeDaysOverride_Clear = 1 THEN NULL ELSE ISNULL(@CancellationNoticeDaysOverride, NULL) END,
                CASE WHEN @PaymentMethod_Clear = 1 THEN NULL ELSE ISNULL(@PaymentMethod, 'ACH') END,
                ISNULL(@StandardAgreementModified, 0),
                CASE WHEN @ContractVariances_Clear = 1 THEN NULL ELSE ISNULL(@ContractVariances, NULL) END,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                CASE WHEN @NextStep_Clear = 1 THEN NULL ELSE ISNULL(@NextStep, NULL) END,
                CASE WHEN @NextStepDate_Clear = 1 THEN NULL ELSE ISNULL(@NextStepDate, NULL) END,
                CASE WHEN @ClosedAt_Clear = 1 THEN NULL ELSE ISNULL(@ClosedAt, NULL) END,
                CASE WHEN @ClosedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ClosedByUserID, NULL) END,
                CASE WHEN @OrderID_Clear = 1 THEN NULL ELSE ISNULL(@OrderID, NULL) END,
                CASE WHEN @PredictedWinProbability_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinProbability, NULL) END,
                CASE WHEN @PredictedWinRiskBand_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinRiskBand, NULL) END,
                CASE WHEN @PredictedWinScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinScoredAt, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwDeals] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Sales: Deals */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Sales: Deals */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: spUpdateDeal
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR Deal
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateDeal]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateDeal];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateDeal]
    @ID uniqueidentifier,
    @DealNumber_Clear bit = 0,
    @DealNumber nvarchar(50) = NULL,
    @Name nvarchar(500) = NULL,
    @PipelineID uniqueidentifier = NULL,
    @PipelineStageID_Clear bit = 0,
    @PipelineStageID uniqueidentifier = NULL,
    @DealTypeID_Clear bit = 0,
    @DealTypeID uniqueidentifier = NULL,
    @DealStatusTypeID_Clear bit = 0,
    @DealStatusTypeID uniqueidentifier = NULL,
    @AccountID_Clear bit = 0,
    @AccountID uniqueidentifier = NULL,
    @PrimaryContactID_Clear bit = 0,
    @PrimaryContactID uniqueidentifier = NULL,
    @BillingContactID_Clear bit = 0,
    @BillingContactID uniqueidentifier = NULL,
    @CompanyID uniqueidentifier = NULL,
    @OwnerEmployeeID_Clear bit = 0,
    @OwnerEmployeeID uniqueidentifier = NULL,
    @Amount_Clear bit = 0,
    @Amount decimal(19, 4) = NULL,
    @AmountIsComputed bit = NULL,
    @AmountComputedAt_Clear bit = 0,
    @AmountComputedAt datetimeoffset = NULL,
    @AmountSourceHash_Clear bit = 0,
    @AmountSourceHash nvarchar(128) = NULL,
    @CurrencyID_Clear bit = 0,
    @CurrencyID uniqueidentifier = NULL,
    @MRR_Clear bit = 0,
    @MRR decimal(19, 4) = NULL,
    @ARR_Clear bit = 0,
    @ARR decimal(19, 4) = NULL,
    @TermMonths_Clear bit = 0,
    @TermMonths int = NULL,
    @EstimatedProjectWeeks_Clear bit = 0,
    @EstimatedProjectWeeks int = NULL,
    @ExecutionDate_Clear bit = 0,
    @ExecutionDate date = NULL,
    @StartDate_Clear bit = 0,
    @StartDate date = NULL,
    @ExpectedCloseDate_Clear bit = 0,
    @ExpectedCloseDate date = NULL,
    @ActualCloseDate_Clear bit = 0,
    @ActualCloseDate date = NULL,
    @Probability_Clear bit = 0,
    @Probability decimal(5, 2) = NULL,
    @ForecastCategoryTypeID_Clear bit = 0,
    @ForecastCategoryTypeID uniqueidentifier = NULL,
    @LossReasonID_Clear bit = 0,
    @LossReasonID uniqueidentifier = NULL,
    @LossNotes_Clear bit = 0,
    @LossNotes nvarchar(MAX) = NULL,
    @LeadSourceTypeID_Clear bit = 0,
    @LeadSourceTypeID uniqueidentifier = NULL,
    @CampaignID_Clear bit = 0,
    @CampaignID uniqueidentifier = NULL,
    @ContractID_Clear bit = 0,
    @ContractID uniqueidentifier = NULL,
    @RenewsContractID_Clear bit = 0,
    @RenewsContractID uniqueidentifier = NULL,
    @AutoRenew bit = NULL,
    @AnnualIncreasePctOverride_Clear bit = 0,
    @AnnualIncreasePctOverride decimal(5, 2) = NULL,
    @CancellationNoticeDaysOverride_Clear bit = 0,
    @CancellationNoticeDaysOverride int = NULL,
    @PaymentMethod_Clear bit = 0,
    @PaymentMethod nvarchar(50) = NULL,
    @StandardAgreementModified bit = NULL,
    @ContractVariances_Clear bit = 0,
    @ContractVariances nvarchar(MAX) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @NextStep_Clear bit = 0,
    @NextStep nvarchar(1000) = NULL,
    @NextStepDate_Clear bit = 0,
    @NextStepDate date = NULL,
    @ClosedAt_Clear bit = 0,
    @ClosedAt datetimeoffset = NULL,
    @ClosedByUserID_Clear bit = 0,
    @ClosedByUserID uniqueidentifier = NULL,
    @OrderID_Clear bit = 0,
    @OrderID uniqueidentifier = NULL,
    @PredictedWinProbability_Clear bit = 0,
    @PredictedWinProbability decimal(5, 4) = NULL,
    @PredictedWinRiskBand_Clear bit = 0,
    @PredictedWinRiskBand nvarchar(20) = NULL,
    @PredictedWinScoredAt_Clear bit = 0,
    @PredictedWinScoredAt datetimeoffset = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[Deal]
    SET
        [DealNumber] = CASE WHEN @DealNumber_Clear = 1 THEN NULL ELSE ISNULL(@DealNumber, [DealNumber]) END,
        [Name] = ISNULL(@Name, [Name]),
        [PipelineID] = ISNULL(@PipelineID, [PipelineID]),
        [PipelineStageID] = CASE WHEN @PipelineStageID_Clear = 1 THEN NULL ELSE ISNULL(@PipelineStageID, [PipelineStageID]) END,
        [DealTypeID] = CASE WHEN @DealTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealTypeID, [DealTypeID]) END,
        [DealStatusTypeID] = CASE WHEN @DealStatusTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealStatusTypeID, [DealStatusTypeID]) END,
        [AccountID] = CASE WHEN @AccountID_Clear = 1 THEN NULL ELSE ISNULL(@AccountID, [AccountID]) END,
        [PrimaryContactID] = CASE WHEN @PrimaryContactID_Clear = 1 THEN NULL ELSE ISNULL(@PrimaryContactID, [PrimaryContactID]) END,
        [BillingContactID] = CASE WHEN @BillingContactID_Clear = 1 THEN NULL ELSE ISNULL(@BillingContactID, [BillingContactID]) END,
        [CompanyID] = ISNULL(@CompanyID, [CompanyID]),
        [OwnerEmployeeID] = CASE WHEN @OwnerEmployeeID_Clear = 1 THEN NULL ELSE ISNULL(@OwnerEmployeeID, [OwnerEmployeeID]) END,
        [Amount] = CASE WHEN @Amount_Clear = 1 THEN NULL ELSE ISNULL(@Amount, [Amount]) END,
        [AmountIsComputed] = ISNULL(@AmountIsComputed, [AmountIsComputed]),
        [AmountComputedAt] = CASE WHEN @AmountComputedAt_Clear = 1 THEN NULL ELSE ISNULL(@AmountComputedAt, [AmountComputedAt]) END,
        [AmountSourceHash] = CASE WHEN @AmountSourceHash_Clear = 1 THEN NULL ELSE ISNULL(@AmountSourceHash, [AmountSourceHash]) END,
        [CurrencyID] = CASE WHEN @CurrencyID_Clear = 1 THEN NULL ELSE ISNULL(@CurrencyID, [CurrencyID]) END,
        [MRR] = CASE WHEN @MRR_Clear = 1 THEN NULL ELSE ISNULL(@MRR, [MRR]) END,
        [ARR] = CASE WHEN @ARR_Clear = 1 THEN NULL ELSE ISNULL(@ARR, [ARR]) END,
        [TermMonths] = CASE WHEN @TermMonths_Clear = 1 THEN NULL ELSE ISNULL(@TermMonths, [TermMonths]) END,
        [EstimatedProjectWeeks] = CASE WHEN @EstimatedProjectWeeks_Clear = 1 THEN NULL ELSE ISNULL(@EstimatedProjectWeeks, [EstimatedProjectWeeks]) END,
        [ExecutionDate] = CASE WHEN @ExecutionDate_Clear = 1 THEN NULL ELSE ISNULL(@ExecutionDate, [ExecutionDate]) END,
        [StartDate] = CASE WHEN @StartDate_Clear = 1 THEN NULL ELSE ISNULL(@StartDate, [StartDate]) END,
        [ExpectedCloseDate] = CASE WHEN @ExpectedCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ExpectedCloseDate, [ExpectedCloseDate]) END,
        [ActualCloseDate] = CASE WHEN @ActualCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ActualCloseDate, [ActualCloseDate]) END,
        [Probability] = CASE WHEN @Probability_Clear = 1 THEN NULL ELSE ISNULL(@Probability, [Probability]) END,
        [ForecastCategoryTypeID] = CASE WHEN @ForecastCategoryTypeID_Clear = 1 THEN NULL ELSE ISNULL(@ForecastCategoryTypeID, [ForecastCategoryTypeID]) END,
        [LossReasonID] = CASE WHEN @LossReasonID_Clear = 1 THEN NULL ELSE ISNULL(@LossReasonID, [LossReasonID]) END,
        [LossNotes] = CASE WHEN @LossNotes_Clear = 1 THEN NULL ELSE ISNULL(@LossNotes, [LossNotes]) END,
        [LeadSourceTypeID] = CASE WHEN @LeadSourceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@LeadSourceTypeID, [LeadSourceTypeID]) END,
        [CampaignID] = CASE WHEN @CampaignID_Clear = 1 THEN NULL ELSE ISNULL(@CampaignID, [CampaignID]) END,
        [ContractID] = CASE WHEN @ContractID_Clear = 1 THEN NULL ELSE ISNULL(@ContractID, [ContractID]) END,
        [RenewsContractID] = CASE WHEN @RenewsContractID_Clear = 1 THEN NULL ELSE ISNULL(@RenewsContractID, [RenewsContractID]) END,
        [AutoRenew] = ISNULL(@AutoRenew, [AutoRenew]),
        [AnnualIncreasePctOverride] = CASE WHEN @AnnualIncreasePctOverride_Clear = 1 THEN NULL ELSE ISNULL(@AnnualIncreasePctOverride, [AnnualIncreasePctOverride]) END,
        [CancellationNoticeDaysOverride] = CASE WHEN @CancellationNoticeDaysOverride_Clear = 1 THEN NULL ELSE ISNULL(@CancellationNoticeDaysOverride, [CancellationNoticeDaysOverride]) END,
        [PaymentMethod] = CASE WHEN @PaymentMethod_Clear = 1 THEN NULL ELSE ISNULL(@PaymentMethod, [PaymentMethod]) END,
        [StandardAgreementModified] = ISNULL(@StandardAgreementModified, [StandardAgreementModified]),
        [ContractVariances] = CASE WHEN @ContractVariances_Clear = 1 THEN NULL ELSE ISNULL(@ContractVariances, [ContractVariances]) END,
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [NextStep] = CASE WHEN @NextStep_Clear = 1 THEN NULL ELSE ISNULL(@NextStep, [NextStep]) END,
        [NextStepDate] = CASE WHEN @NextStepDate_Clear = 1 THEN NULL ELSE ISNULL(@NextStepDate, [NextStepDate]) END,
        [ClosedAt] = CASE WHEN @ClosedAt_Clear = 1 THEN NULL ELSE ISNULL(@ClosedAt, [ClosedAt]) END,
        [ClosedByUserID] = CASE WHEN @ClosedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ClosedByUserID, [ClosedByUserID]) END,
        [OrderID] = CASE WHEN @OrderID_Clear = 1 THEN NULL ELSE ISNULL(@OrderID, [OrderID]) END,
        [PredictedWinProbability] = CASE WHEN @PredictedWinProbability_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinProbability, [PredictedWinProbability]) END,
        [PredictedWinRiskBand] = CASE WHEN @PredictedWinRiskBand_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinRiskBand, [PredictedWinRiskBand]) END,
        [PredictedWinScoredAt] = CASE WHEN @PredictedWinScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinScoredAt, [PredictedWinScoredAt]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwDeals] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwDeals]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the Deal table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateDeal]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateDeal];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateDeal
ON [${flyway:defaultSchema}].[Deal]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[Deal]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[Deal] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Sales: Deals */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Sales: Deals */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: spDeleteDeal
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR Deal
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteDeal]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteDeal];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteDeal]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[Deal]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Sales: Deals */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] TO [cdp_Developer], [cdp_Integration];

/* SQL text to delete unneeded entity fields (1 scoped entities) */
EXEC [${mjSchema}].[spDeleteUnneededEntityFields] @ExcludedSchemaNames='', @EntityIDs='79148DE5-7F99-44AC-ACD4-5EE7BA93D354', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to update existing entity fields from schema (1 scoped entities) */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='79148DE5-7F99-44AC-ACD4-5EE7BA93D354', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Refresh custom base views for modified entities so schema changes are picked up */
EXEC sp_refreshview '${flyway:defaultSchema}.vwDealsGenerated';
IF OBJECT_ID('[${flyway:defaultSchema}].[vwDeals]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'EXEC sp_refreshview ''${flyway:defaultSchema}.vwDeals'';';
END;


