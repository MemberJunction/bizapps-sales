-- ============================================================================
-- PostgreSQL counterpart of migrations/V202609291800__v6.9.x__SalesContact_SeniorityLevel.sql
-- The CodeGen metadata DML (the SeniorityLevelID EntityField, the IS-A field update, the entity
-- relationships, the new name-field rows) is converted from the T-SQL (MJ 6.1.5 converter). Written
-- by hand from the T-SQL: the PredictedWinRiskBand value list (the converter cannot translate
-- its variable lookup), the related-entity name maps the converter drops, and the view rebuild
-- explained above the CodeGen section. The CodeGen section is native PostgreSQL CodeGen
-- (MJ 6.1.5) for Sales Contacts, Deal Contact Roles and Deals, the entities the T-SQL regenerates,
-- minus CodeGen's double-wrapped grant blocks for the two layered views, which do not parse
-- (MJ#5552) and repeat the grants above them.
-- ============================================================================

SET search_path TO __mj_bizappssales, public;
SET standard_conforming_strings = on;

-- Sales Contacts inherits Person.SeniorityLevelID (bizapps-common v5.45.x).
-- =============================================================================
-- Common's V202609211200 added SeniorityLevelID to __mj_BizAppsCommon.Person. Sales Contacts
-- IS-A People, so it needs the column in its base view and the inherited virtual EntityField.
-- No Sales migration shipped either (#148).

-- SQL text to insert 1 new entity field(s)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '92be72d3-13e6-4dd2-951b-bcb20ee2c446' OR ("EntityID" = '530174B2-654E-4E14-BF28-3EF29AC9833D' AND "Name" = 'SeniorityLevelID')) THEN
    INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES ('92be72d3-13e6-4dd2-951b-bcb20ee2c446', '530174B2-654E-4E14-BF28-3EF29AC9833D' /* Entity: MJ_BizApps_Sales: Sales Contacts */, (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '530174B2-654E-4E14-BF28-3EF29AC9833D'), 'SeniorityLevelID', 'Seniority Level ID', NULL, 'uniqueidentifier', 16, 0, 0, TRUE, NULL, FALSE, FALSE, TRUE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
  END IF;
END $$;

-- Update IS-A parent field SeniorityLevelID on MJ_BizApps_Sales: Sales Contacts
UPDATE ${mjSchema}."EntityField" SET "IsVirtual" = TRUE, "Type" = 'uniqueidentifier', "Length" = 16, "Precision" = 0, "Scale" = 0, "AllowsNull" = TRUE, "AllowUpdateAPI" = TRUE
WHERE
  "ID" = '92BE72D3-13E6-4DD2-951B-BCB20EE2C446';
-- Update entity timestamp for MJ_BizApps_Sales: Sales Contacts after IS-A field sync
UPDATE ${mjSchema}."Entity" SET "__mj_UpdatedAt" = NOW()
WHERE
  "ID" = '530174B2-654E-4E14-BF28-3EF29AC9833D';

-- PredictedWinRiskBand's field is resolved by entity and name, not by the ID V202609202353 pins:
-- that migration inserts the field with its ID only when no field of that name exists, so a host
-- whose field was created first by CodeGen or a metadata push holds it under another ID, and an
-- insert keyed to the pinned ID fails on FK_EntityFieldValue_EntityField.
DO $$
DECLARE
  v_RiskBandFieldID UUID := (
    SELECT f."ID" FROM ${mjSchema}."EntityField" f
    JOIN ${mjSchema}."Entity" e ON e."ID" = f."EntityID"
    WHERE e."SchemaName" = '__mj_bizappssales' AND e."BaseTable" = 'Deal' AND f."Name" = 'PredictedWinRiskBand'
    ORDER BY CASE WHEN f."ID" = '7C778BDC-EC7E-4275-B8BE-49792D542D0B' THEN 0 ELSE 1 END
    LIMIT 1);
BEGIN
  -- SQL text to insert entity field value with ID bdf041e3-97e2-4f6a-b569-5bf9dafaf7af
  IF v_RiskBandFieldID IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityFieldValue"
                 WHERE "ID" = 'bdf041e3-97e2-4f6a-b569-5bf9dafaf7af' OR ("EntityFieldID" = v_RiskBandFieldID AND "Value" = 'Critical')) THEN
    INSERT INTO ${mjSchema}."EntityFieldValue" ("ID", "EntityFieldID", "Sequence", "Value", "Code", "__mj_CreatedAt", "__mj_UpdatedAt")
    VALUES ('bdf041e3-97e2-4f6a-b569-5bf9dafaf7af', v_RiskBandFieldID, 1, 'Critical', 'Critical', NOW(), NOW());
  END IF;

  -- SQL text to insert entity field value with ID 344436f1-0b9e-4dbd-8cda-e433b15c6fa3
  IF v_RiskBandFieldID IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityFieldValue"
                 WHERE "ID" = '344436f1-0b9e-4dbd-8cda-e433b15c6fa3' OR ("EntityFieldID" = v_RiskBandFieldID AND "Value" = 'High')) THEN
    INSERT INTO ${mjSchema}."EntityFieldValue" ("ID", "EntityFieldID", "Sequence", "Value", "Code", "__mj_CreatedAt", "__mj_UpdatedAt")
    VALUES ('344436f1-0b9e-4dbd-8cda-e433b15c6fa3', v_RiskBandFieldID, 2, 'High', 'High', NOW(), NOW());
  END IF;

  -- SQL text to insert entity field value with ID b39aa5a0-5bf0-435d-b222-ad21e1e52b37
  IF v_RiskBandFieldID IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityFieldValue"
                 WHERE "ID" = 'b39aa5a0-5bf0-435d-b222-ad21e1e52b37' OR ("EntityFieldID" = v_RiskBandFieldID AND "Value" = 'Low')) THEN
    INSERT INTO ${mjSchema}."EntityFieldValue" ("ID", "EntityFieldID", "Sequence", "Value", "Code", "__mj_CreatedAt", "__mj_UpdatedAt")
    VALUES ('b39aa5a0-5bf0-435d-b222-ad21e1e52b37', v_RiskBandFieldID, 3, 'Low', 'Low', NOW(), NOW());
  END IF;

  -- SQL text to insert entity field value with ID 85305867-7ba6-48dc-8969-f6a93bb0b974
  IF v_RiskBandFieldID IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityFieldValue"
                 WHERE "ID" = '85305867-7ba6-48dc-8969-f6a93bb0b974' OR ("EntityFieldID" = v_RiskBandFieldID AND "Value" = 'Medium')) THEN
    INSERT INTO ${mjSchema}."EntityFieldValue" ("ID", "EntityFieldID", "Sequence", "Value", "Code", "__mj_CreatedAt", "__mj_UpdatedAt")
    VALUES ('85305867-7ba6-48dc-8969-f6a93bb0b974', v_RiskBandFieldID, 4, 'Medium', 'Medium', NOW(), NOW());
  END IF;

  -- SQL text to update ValueListType for entity field ID 7C778BDC-EC7E-4275-B8BE-49792D542D0B
  UPDATE ${mjSchema}."EntityField" SET "ValueListType" = 'List' WHERE "ID" = v_RiskBandFieldID;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityRelationship" WHERE "ID" = '58736666-44da-4a0e-be3d-f728b84db3e4') THEN
    INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES ('58736666-44da-4a0e-be3d-f728b84db3e4', 'D3329BE1-541B-4918-B1CB-3D7A0454EBA7', '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', 'CurrencyID', 'One To Many', TRUE, TRUE, 7, NOW(), NOW());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityRelationship" WHERE "ID" = 'e6c26395-ce33-4023-8ce4-b5e988926dcb') THEN
    INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES ('e6c26395-ce33-4023-8ce4-b5e988926dcb', '5DEB0B11-ED6C-48B3-9200-F4441396C5E2', '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', 'ContractID', 'One To Many', TRUE, TRUE, 4, NOW(), NOW());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityRelationship" WHERE "ID" = 'a2098aee-84a2-41dc-acc6-d478ee538926') THEN
    INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES ('a2098aee-84a2-41dc-acc6-d478ee538926', '5DEB0B11-ED6C-48B3-9200-F4441396C5E2', '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', 'RenewsContractID', 'One To Many', TRUE, TRUE, 5, NOW(), NOW());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '767b4256-0de1-4f94-8eec-0a06e0383864' OR ("EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND "Name" = 'PrimaryContact')) THEN
    INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES ('767b4256-0de1-4f94-8eec-0a06e0383864', '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' /* Entity: MJ_BizApps_Sales: Deals */, (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'), 'PrimaryContact', 'Primary Contact', NULL, 'nvarchar', 1408, 0, 0, TRUE, NULL, FALSE, FALSE, TRUE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '4d55882b-7546-456d-9b32-72118b107fd5' OR ("EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND "Name" = 'BillingContact')) THEN
    INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES ('4d55882b-7546-456d-9b32-72118b107fd5', '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' /* Entity: MJ_BizApps_Sales: Deals */, (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'), 'BillingContact', 'Billing Contact', NULL, 'nvarchar', 1408, 0, 0, TRUE, NULL, FALSE, FALSE, TRUE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '9bdd5f7e-f0c4-4ff0-bb0b-957f537be95f' OR ("EntityID" = '862535EB-36DD-4434-8B4E-E256363E781F' AND "Name" = 'SalesContact')) THEN
    INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES ('9bdd5f7e-f0c4-4ff0-bb0b-957f537be95f', '862535EB-36DD-4434-8B4E-E256363E781F' /* Entity: MJ_BizApps_Sales: Deal Contact Roles */, (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '862535EB-36DD-4434-8B4E-E256363E781F'), 'SalesContact', 'Sales Contact', NULL, 'nvarchar', 1408, 0, 0, FALSE, NULL, FALSE, FALSE, TRUE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '17cd69c1-932d-471f-a5b7-48d5bf11d82b' OR ("EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND "Name" = 'PrimaryContact')) THEN
    INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES ('17cd69c1-932d-471f-a5b7-48d5bf11d82b', '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' /* Entity: MJ_BizApps_Sales: Deals */, (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'), 'PrimaryContact', 'Primary Contact', NULL, 'nvarchar', 1408, 0, 0, TRUE, NULL, FALSE, FALSE, TRUE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '8e9eacad-6c01-4866-a2c1-a220a0513f7b' OR ("EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND "Name" = 'BillingContact')) THEN
    INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES ('8e9eacad-6c01-4866-a2c1-a220a0513f7b', '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' /* Entity: MJ_BizApps_Sales: Deals */, (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'), 'BillingContact', 'Billing Contact', NULL, 'nvarchar', 1408, 0, 0, TRUE, NULL, FALSE, FALSE, TRUE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
  END IF;
END $$;

-- SQL text to update entity field related entity name field map for entity field ID 9BC78A7F-4FF8-4707-8613-C0A960B71814
SELECT 1 FROM ${mjSchema}."spUpdateEntityFieldRelatedEntityNameFieldMap"(p_entityfieldid := '9BC78A7F-4FF8-4707-8613-C0A960B71814', p_relatedentitynamefieldmap := 'SalesContact');

-- SQL text to update entity field related entity name field map for entity field ID 15EE2878-83D2-4D3F-8010-E53132678BBC
SELECT 1 FROM ${mjSchema}."spUpdateEntityFieldRelatedEntityNameFieldMap"(p_entityfieldid := '15EE2878-83D2-4D3F-8010-E53132678BBC', p_relatedentitynamefieldmap := 'PrimaryContact');

-- SQL text to update entity field related entity name field map for entity field ID 95BFECF9-D5DF-415D-955C-890F48086E91
SELECT 1 FROM ${mjSchema}."spUpdateEntityFieldRelatedEntityNameFieldMap"(p_entityfieldid := '95BFECF9-D5DF-415D-955C-890F48086E91', p_relatedentitynamefieldmap := 'BillingContact');

-- WHY THE VIEWS ARE REBUILT BY HAND, ABOVE THE CODEGEN BLOCK, AS IN THE T-SQL.
--
-- The inner view vwSalesContactsGenerated gains SeniorityLevelID in the middle of its column list,
-- which CREATE OR REPLACE cannot do, so it is dropped. On PostgreSQL that drop has to CASCADE, and
-- the cascade takes the two layered wrappers built on it with it: vwSalesContacts directly, and
-- vwDeals through vwDealsGenerated, which joins vwSalesContacts for its contact names. CodeGen's
-- own view regeneration restores only the direct dependents of the view it replaces, and does not
-- recreate an application-owned wrapper, so it cannot rebuild this chain on its own.
--
-- So the chain is rebuilt here in dependency order: the two inner views as CodeGen's current
-- PostgreSQL definitions, and the two wrappers exactly as V202609190901 and V202609202353 create
-- them. The CodeGen section below then regenerates the same views (a no-op), and recreates the
-- CRUD functions the cascade dropped.
DROP VIEW __mj_bizappssales."vwSalesContactsGenerated" CASCADE;

CREATE VIEW "__mj_bizappssales"."vwSalesContactsGenerated"
AS
SELECT
    s.*,
    __mj_isa_p1."FirstName",
    __mj_isa_p1."LastName",
    __mj_isa_p1."MiddleName",
    __mj_isa_p1."Prefix",
    __mj_isa_p1."Suffix",
    __mj_isa_p1."PreferredName",
    __mj_isa_p1."Title",
    __mj_isa_p1."Email",
    __mj_isa_p1."Phone",
    __mj_isa_p1."DateOfBirth",
    __mj_isa_p1."Gender",
    __mj_isa_p1."PhotoURL",
    __mj_isa_p1."Bio",
    __mj_isa_p1."LinkedUserID",
    __mj_isa_p1."Status",
    __mj_isa_p1."DisplayName",
    __mj_isa_p1."SeniorityLevelID",
    MJEmployee_OwnerEmployeeID."FirstLast" AS "OwnerEmployee",
    mjbizappssalesLifecycleStageType_LifecycleStageTypeID."Name" AS "LifecycleStageType",
    mjbizappssalesBuyingRoleType_BuyingRoleTypeID."Name" AS "BuyingRoleType",
    mjbizappssalesLeadSourceType_LeadSourceTypeID."Name" AS "LeadSourceType"
FROM
    "__mj_bizappssales"."SalesContact" AS s
INNER JOIN
    "__mj_bizappscommon"."Person" AS __mj_isa_p1
  ON
    "s"."ID" = __mj_isa_p1."ID"
LEFT OUTER JOIN
    ${mjSchema}."vwEmployees" AS MJEmployee_OwnerEmployeeID
  ON
    "s"."OwnerEmployeeID" = MJEmployee_OwnerEmployeeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."LifecycleStageType" AS mjbizappssalesLifecycleStageType_LifecycleStageTypeID
  ON
    "s"."LifecycleStageTypeID" = mjbizappssalesLifecycleStageType_LifecycleStageTypeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."BuyingRoleType" AS mjbizappssalesBuyingRoleType_BuyingRoleTypeID
  ON
    "s"."BuyingRoleTypeID" = mjbizappssalesBuyingRoleType_BuyingRoleTypeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."LeadSourceType" AS mjbizappssalesLeadSourceType_LeadSourceTypeID
  ON
    "s"."LeadSourceTypeID" = mjbizappssalesLeadSourceType_LeadSourceTypeID."ID";

CREATE VIEW __mj_bizappssales."vwSalesContacts"
AS
SELECT
    g.*,
    CASE
        WHEN NULLIF(LTRIM(RTRIM(p."PrimaryEmail")), '') IS NULL
            THEN p."DisplayName"
        ELSE CONCAT(p."DisplayName", ' (', LTRIM(RTRIM(p."PrimaryEmail")), ')')
    END AS "DisplayNameAndEmail"
FROM
    __mj_bizappssales."vwSalesContactsGenerated" AS g
INNER JOIN
    __mj_bizappscommon."vwPeople" AS p
  ON
    g."ID" = p."ID";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cdp_UI') THEN
    GRANT SELECT ON __mj_bizappssales."vwSalesContacts" TO "cdp_UI";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cdp_Developer') THEN
    GRANT SELECT ON __mj_bizappssales."vwSalesContacts" TO "cdp_Developer";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cdp_Integration') THEN
    GRANT SELECT ON __mj_bizappssales."vwSalesContacts" TO "cdp_Integration";
  END IF;
END $$;

CREATE VIEW "__mj_bizappssales"."vwDealsGenerated"
AS
SELECT
    d.*,
    mjbizappssalesPipeline_PipelineID."Name" AS "Pipeline",
    mjbizappssalesPipelineStage_PipelineStageID."Name" AS "PipelineStage",
    mjbizappssalesDealType_DealTypeID."Name" AS "DealType",
    mjbizappssalesDealStatusType_DealStatusTypeID."Name" AS "DealStatusType",
    mjbizappssalesSalesAccount_AccountID."Name" AS "Account",
    mjbizappssalesSalesContact_PrimaryContactID."DisplayNameAndEmail" AS "PrimaryContact",
    mjbizappssalesSalesContact_BillingContactID."DisplayNameAndEmail" AS "BillingContact",
    MJCompany_CompanyID."Name" AS "Company",
    MJEmployee_OwnerEmployeeID."FirstLast" AS "OwnerEmployee",
    mjbizappssalesForecastCategoryType_ForecastCategoryTypeID."Name" AS "ForecastCategoryType",
    mjbizappssalesLossReason_LossReasonID."Name" AS "LossReason",
    mjbizappssalesLeadSourceType_LeadSourceTypeID."Name" AS "LeadSourceType",
    MJUser_ClosedByUserID."Name" AS "ClosedByUser",
    mjbizappsordersOrderHeader_OrderID."OrderNumber" AS "Order"
FROM
    "__mj_bizappssales"."Deal" AS d
INNER JOIN
    "__mj_bizappssales"."Pipeline" AS mjbizappssalesPipeline_PipelineID
  ON
    "d"."PipelineID" = mjbizappssalesPipeline_PipelineID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."PipelineStage" AS mjbizappssalesPipelineStage_PipelineStageID
  ON
    "d"."PipelineStageID" = mjbizappssalesPipelineStage_PipelineStageID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."DealType" AS mjbizappssalesDealType_DealTypeID
  ON
    "d"."DealTypeID" = mjbizappssalesDealType_DealTypeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."DealStatusType" AS mjbizappssalesDealStatusType_DealStatusTypeID
  ON
    "d"."DealStatusTypeID" = mjbizappssalesDealStatusType_DealStatusTypeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."vwSalesAccounts" AS mjbizappssalesSalesAccount_AccountID
  ON
    "d"."AccountID" = mjbizappssalesSalesAccount_AccountID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."vwSalesContacts" AS mjbizappssalesSalesContact_PrimaryContactID
  ON
    "d"."PrimaryContactID" = mjbizappssalesSalesContact_PrimaryContactID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."vwSalesContacts" AS mjbizappssalesSalesContact_BillingContactID
  ON
    "d"."BillingContactID" = mjbizappssalesSalesContact_BillingContactID."ID"
INNER JOIN
    ${mjSchema}."Company" AS MJCompany_CompanyID
  ON
    "d"."CompanyID" = MJCompany_CompanyID."ID"
LEFT OUTER JOIN
    ${mjSchema}."vwEmployees" AS MJEmployee_OwnerEmployeeID
  ON
    "d"."OwnerEmployeeID" = MJEmployee_OwnerEmployeeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."ForecastCategoryType" AS mjbizappssalesForecastCategoryType_ForecastCategoryTypeID
  ON
    "d"."ForecastCategoryTypeID" = mjbizappssalesForecastCategoryType_ForecastCategoryTypeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."LossReason" AS mjbizappssalesLossReason_LossReasonID
  ON
    "d"."LossReasonID" = mjbizappssalesLossReason_LossReasonID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."LeadSourceType" AS mjbizappssalesLeadSourceType_LeadSourceTypeID
  ON
    "d"."LeadSourceTypeID" = mjbizappssalesLeadSourceType_LeadSourceTypeID."ID"
LEFT OUTER JOIN
    ${mjSchema}."User" AS MJUser_ClosedByUserID
  ON
    "d"."ClosedByUserID" = MJUser_ClosedByUserID."ID"
LEFT OUTER JOIN
    "__mj_bizappsorders"."OrderHeader" AS mjbizappsordersOrderHeader_OrderID
  ON
    "d"."OrderID" = mjbizappsordersOrderHeader_OrderID."ID";

CREATE VIEW __mj_bizappssales."vwDeals"
AS
SELECT
    g.*,
    CASE
        WHEN mjBizAppsSalesDealStatusType_DealStatusTypeID."Code" = 'WON' THEN 1
        WHEN mjBizAppsSalesDealStatusType_DealStatusTypeID."Code" IN ('LOST', 'ABANDONED') THEN 0
        ELSE NULL
    END AS "WinOutcome",
    CASE
        WHEN g."ExpectedCloseDate" IS NOT NULL AND g."StartDate" IS NOT NULL THEN g."ExpectedCloseDate" - g."StartDate"
        WHEN g."ExpectedCloseDate" IS NOT NULL THEN g."ExpectedCloseDate" - (g."__mj_CreatedAt" AT TIME ZONE 'UTC')::DATE
        ELSE NULL
    END AS "DaysToExpectedClose",
    COALESCE(ps."HasPaymentSchedule", FALSE) AS "HasPaymentSchedule",
    COALESCE(team."TeamMemberCount", 0) AS "TeamMemberCount",
    COALESCE(team."HasPartnerInvolved", FALSE) AS "HasPartnerInvolved",
    COALESCE(g."Amount" >= 100000, FALSE) AS "IsEnterpriseTier",
    COALESCE(g."AutoRenew" = TRUE, FALSE) AS "AutoRenewFlag",
    COALESCE(g."StandardAgreementModified" = TRUE, FALSE) AS "StandardAgreementModifiedFlag"
FROM
    __mj_bizappssales."vwDealsGenerated" AS g
LEFT OUTER JOIN
    __mj_bizappssales."DealStatusType" AS mjBizAppsSalesDealStatusType_DealStatusTypeID
  ON
    g."DealStatusTypeID" = mjBizAppsSalesDealStatusType_DealStatusTypeID."ID"
LEFT OUTER JOIN (
    SELECT "DealID", TRUE AS "HasPaymentSchedule"
    FROM __mj_bizappssales."DealPaymentSchedule"
    GROUP BY "DealID"
) AS ps ON ps."DealID" = g."ID"
LEFT OUTER JOIN (
    SELECT
        tm."DealID",
        COUNT(*)::INTEGER AS "TeamMemberCount",
        BOOL_OR(r."Code" = 'PARTNERMGR') AS "HasPartnerInvolved"
    FROM __mj_bizappssales."DealTeamMember" tm
    JOIN __mj_bizappssales."DealRole" r ON tm."DealRoleID" = r."ID"
    GROUP BY tm."DealID"
) AS team ON team."DealID" = g."ID";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cdp_UI') THEN
    GRANT SELECT ON __mj_bizappssales."vwDeals" TO "cdp_UI";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cdp_Developer') THEN
    GRANT SELECT ON __mj_bizappssales."vwDeals" TO "cdp_Developer";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cdp_Integration') THEN
    GRANT SELECT ON __mj_bizappssales."vwDeals" TO "cdp_Integration";
  END IF;
END $$;

-- ===================== CodeGen (native PG, baked) =====================

-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Sales Contacts
-- Item: Index for Foreign Keys
-- ============================================================
CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_sales_contact_owner_employee_id"
    ON "__mj_bizappssales"."SalesContact" ("OwnerEmployeeID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_sales_contact_lifecycle_stage_type_id"
    ON "__mj_bizappssales"."SalesContact" ("LifecycleStageTypeID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_sales_contact_buying_role_type_id"
    ON "__mj_bizappssales"."SalesContact" ("BuyingRoleTypeID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_sales_contact_lead_source_type_id"
    ON "__mj_bizappssales"."SalesContact" ("LeadSourceTypeID");

-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Sales Contacts
-- Item: vwSalesContactsGenerated
-- ============================================================

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Sales Contacts
-----               SCHEMA:      __mj_bizappssales
-----               BASE TABLE:  SalesContact
-----               PRIMARY KEY: ID
------------------------------------------------------------
DO $vw_regen$
DECLARE
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW "__mj_bizappssales"."vwSalesContactsGenerated"
AS
SELECT
    s.*,
    __mj_isa_p1."FirstName",
    __mj_isa_p1."LastName",
    __mj_isa_p1."MiddleName",
    __mj_isa_p1."Prefix",
    __mj_isa_p1."Suffix",
    __mj_isa_p1."PreferredName",
    __mj_isa_p1."Title",
    __mj_isa_p1."Email",
    __mj_isa_p1."Phone",
    __mj_isa_p1."DateOfBirth",
    __mj_isa_p1."Gender",
    __mj_isa_p1."PhotoURL",
    __mj_isa_p1."Bio",
    __mj_isa_p1."LinkedUserID",
    __mj_isa_p1."Status",
    __mj_isa_p1."DisplayName",
    __mj_isa_p1."SeniorityLevelID",
    MJEmployee_OwnerEmployeeID."FirstLast" AS "OwnerEmployee",
    mjbizappssalesLifecycleStageType_LifecycleStageTypeID."Name" AS "LifecycleStageType",
    mjbizappssalesBuyingRoleType_BuyingRoleTypeID."Name" AS "BuyingRoleType",
    mjbizappssalesLeadSourceType_LeadSourceTypeID."Name" AS "LeadSourceType"
FROM
    "__mj_bizappssales"."SalesContact" AS s
INNER JOIN
    "__mj_bizappscommon"."Person" AS __mj_isa_p1
  ON
    "s"."ID" = __mj_isa_p1."ID"
LEFT OUTER JOIN
    ${mjSchema}."vwEmployees" AS MJEmployee_OwnerEmployeeID
  ON
    "s"."OwnerEmployeeID" = MJEmployee_OwnerEmployeeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."LifecycleStageType" AS mjbizappssalesLifecycleStageType_LifecycleStageTypeID
  ON
    "s"."LifecycleStageTypeID" = mjbizappssalesLifecycleStageType_LifecycleStageTypeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."BuyingRoleType" AS mjbizappssalesBuyingRoleType_BuyingRoleTypeID
  ON
    "s"."BuyingRoleTypeID" = mjbizappssalesBuyingRoleType_BuyingRoleTypeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."LeadSourceType" AS mjbizappssalesLeadSourceType_LeadSourceTypeID
  ON
    "s"."LeadSourceTypeID" = mjbizappssalesLeadSourceType_LeadSourceTypeID."ID"
$vsql$;
  rec RECORD;
BEGIN
  EXECUTE vsql;
EXCEPTION WHEN invalid_table_definition THEN
  -- 42P16: column rename/reorder/type change. CREATE OR REPLACE can't handle
  -- non-additive shape changes — must DROP CASCADE + recreate. CASCADE drops
  -- every dependent view (anything that JOINs this view in its body), so we
  -- capture each dependent's definition + grants BEFORE the drop and replay
  -- them afterward (best-effort). Without this, on a fresh-DB replay where
  -- one entity's wrapper triggers (e.g. vwAIModelTypes shape changed since
  -- baseline V202605021056), CASCADE wipes downstream views (vwAIModels)
  -- that the wrapper for this entity doesn't know how to recreate, and
  -- those views stay permanently missing.
  CREATE TEMP TABLE IF NOT EXISTS _vw_regen_deps (
    schema_name TEXT,
    view_name   TEXT,
    relkind     CHAR(1),
    definition  TEXT,
    grants_sql  TEXT
  ) ON COMMIT DROP;
  DELETE FROM _vw_regen_deps;

  -- Capture dependent FUNCTIONS too. CASCADE drops every function with
  -- RETURNS SETOF <view> (the codegen-emitted spCreate/spUpdate/spDelete
  -- pattern) when the target view is dropped. Without restoring them,
  -- post-codegen CRUD validation reports those routines as missing —
  -- e.g. "MJ: Recommendation Items → missing create routine
  -- spCreateRecommendationItem" — even though the next codegen pass
  -- emits them. The restored definitions are pg_get_functiondef() output
  -- which is a complete CREATE OR REPLACE FUNCTION statement plus a
  -- trailing semicolon; replaying them verbatim recreates the function
  -- with its original body, parameter list, and return type.
  CREATE TEMP TABLE IF NOT EXISTS _vw_regen_fn_deps (
    schema_name TEXT,
    fn_name     TEXT,
    fn_oid      OID,
    definition  TEXT
  ) ON COMMIT DROP;
  DELETE FROM _vw_regen_fn_deps;

  -- Capture dependents. NOTES on the grants_sql build:
  --   - Resolve role name via pg_get_userbyid(oid) — returns the bare,
  --     unquoted role name (or 'unknown (OID=N)' if the oid no longer
  --     exists). pg_get_userbyid is a public catalog function available to
  --     every database user, including unprivileged accounts on managed
  --     PostgreSQL services (Amazon RDS, Azure Database for PostgreSQL,
  --     Cloud SQL) where pg_authid is restricted to the rds_superuser /
  --     azure_pg_admin / cloudsqlsuperuser group. Earlier revisions joined
  --     to pg_authid which works on self-hosted PG but fails with
  --     "permission denied for table pg_authid" on managed services.
  --   - The earlier (broken) approach cast (aclexplode).grantee::regrole::text
  --     which RETURNS the role name pre-quoted when it contains uppercase
  --     (e.g. cdp_Developer comes back already wrapped); calling quote_ident
  --     on the already-quoted string double-wrapped and the GRANT failed at
  --     replay with "role does not exist". Using
  --     pg_get_userbyid returns a bare name and lets quote_ident wrap it
  --     correctly exactly once.
  --   - PUBLIC is grantee oid 0; pg_get_userbyid(0) returns 'unknown
  --     (OID=0)' so handle the PUBLIC case explicitly and use it as the
  --     literal 'PUBLIC' rather than quote_ident on the synthetic name.
  INSERT INTO _vw_regen_deps (schema_name, view_name, relkind, definition, grants_sql)
  SELECT DISTINCT
      dn.nspname,
      dc.relname,
      dc.relkind,
      pg_get_viewdef(dc.oid),
      (SELECT string_agg(
          'GRANT ' || g.privilege || ' ON ' || quote_ident(dn.nspname) || '.' || quote_ident(dc.relname) ||
          ' TO ' || (CASE WHEN g.grantee_oid = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(g.grantee_oid)) END) || ';',
          E'
')
       FROM (
           SELECT (aclexplode(dc.relacl)).grantee AS grantee_oid,
                  (aclexplode(dc.relacl)).privilege_type AS privilege
       ) g
       WHERE g.privilege IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'))
  FROM pg_depend d
  JOIN pg_rewrite r ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
  JOIN pg_class dc ON dc.oid = r.ev_class AND dc.relkind IN ('v', 'm')
  JOIN pg_namespace dn ON dn.oid = dc.relnamespace
  JOIN pg_class tc ON tc.oid = d.refobjid
  JOIN pg_namespace tn ON tn.oid = tc.relnamespace
  WHERE tn.nspname = '__mj_bizappssales'
    AND tc.relname = 'vwSalesContactsGenerated'
    AND tc.relkind IN ('v', 'm')
    AND dc.oid <> tc.oid;

  -- Capture dependent functions. Two paths matter on PG:
  --   1. Functions whose RETURN type references the view (RETURNS SETOF
  --      <view>) — pg_depend records this as type=pg_type → pg_class.
  --   2. Functions whose body references the view (used by sql functions
  --      and by some plpgsql edge cases) — pg_depend records this as
  --      pg_proc → pg_class.
  -- pg_get_functiondef returns a complete CREATE OR REPLACE FUNCTION
  -- statement that we replay verbatim. We DO include RETURNS-only
  -- references because that's the dominant codegen pattern (sp* CRUD
  -- functions all RETURNS SETOF the matching vwX).
  INSERT INTO _vw_regen_fn_deps (schema_name, fn_name, fn_oid, definition)
  SELECT DISTINCT
      pn.nspname,
      pp.proname,
      pp.oid,
      pg_get_functiondef(pp.oid)
  FROM pg_depend d
  JOIN pg_proc pp ON pp.oid = d.objid AND d.classid = 'pg_proc'::regclass
  JOIN pg_namespace pn ON pn.oid = pp.pronamespace
  JOIN pg_class tc ON tc.oid = d.refobjid
  JOIN pg_namespace tn ON tn.oid = tc.relnamespace
  WHERE tn.nspname = '__mj_bizappssales'
    AND tc.relname = 'vwSalesContactsGenerated'
    AND tc.relkind IN ('v', 'm')
  UNION
  SELECT DISTINCT
      pn.nspname,
      pp.proname,
      pp.oid,
      pg_get_functiondef(pp.oid)
  FROM pg_depend d
  JOIN pg_type pt ON pt.oid = d.refobjid AND d.refclassid = 'pg_type'::regclass
  JOIN pg_proc pp ON pp.prorettype = pt.oid OR pt.typrelid = pp.oid
  JOIN pg_namespace pn ON pn.oid = pp.pronamespace
  WHERE EXISTS (
      SELECT 1 FROM pg_class tc
      JOIN pg_namespace tn ON tn.oid = tc.relnamespace
      WHERE tc.reltype = pt.oid
        AND tn.nspname = '__mj_bizappssales'
        AND tc.relname = 'vwSalesContactsGenerated'
        AND tc.relkind IN ('v', 'm')
  );

  DROP VIEW IF EXISTS "__mj_bizappssales"."vwSalesContactsGenerated" CASCADE;
  EXECUTE vsql;

  -- Replay captured dependents. Best-effort: log + continue on failure.
  -- IMPORTANT: the CREATE VIEW and the GRANTs run in SEPARATE inner BEGIN
  -- blocks. PL/pgSQL's BEGIN ... EXCEPTION creates an implicit savepoint
  -- and rolls back EVERY statement in the block on any exception. If we
  -- combined CREATE+GRANT in one block and a GRANT failed (e.g. role not
  -- present in target environment), the just-recreated VIEW would also
  -- get rolled back and stay missing — the exact failure mode this
  -- wrapper exists to prevent.
  FOR rec IN SELECT schema_name, view_name, relkind, definition, grants_sql FROM _vw_regen_deps LOOP
    BEGIN
      IF rec.relkind = 'm' THEN
        EXECUTE 'CREATE MATERIALIZED VIEW ' || quote_ident(rec.schema_name) || '.' || quote_ident(rec.view_name) || ' AS ' || rec.definition;
      ELSE
        EXECUTE 'CREATE VIEW ' || quote_ident(rec.schema_name) || '.' || quote_ident(rec.view_name) || ' AS ' || rec.definition;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Best-effort restore skipped dependent %.%: %', rec.schema_name, rec.view_name, SQLERRM;
    END;

    IF rec.grants_sql IS NOT NULL THEN
      BEGIN
        EXECUTE rec.grants_sql;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Best-effort grant restore skipped %.%: %', rec.schema_name, rec.view_name, SQLERRM;
      END;
    END IF;
  END LOOP;

  -- Replay captured dependent functions AFTER all dependent views are
  -- restored — most codegen-emitted sp* functions reference both the
  -- target view AND the dependent views in their bodies/return types.
  -- Wrapped per-function in its own savepoint so a single failure
  -- doesn't poison subsequent restores or the just-recreated target.
  FOR rec IN SELECT schema_name, fn_name, definition FROM _vw_regen_fn_deps LOOP
    BEGIN
      EXECUTE rec.definition;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Best-effort restore skipped dependent function %.%: %', rec.schema_name, rec.fn_name, SQLERRM;
    END;
  END LOOP;

  DROP TABLE _vw_regen_deps;
  DROP TABLE _vw_regen_fn_deps;
END $vw_regen$;

DO $if_view_exists$
BEGIN
  IF to_regclass('"__mj_bizappssales"."vwSalesContacts"') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON "__mj_bizappssales"."vwSalesContacts" TO "cdp_UI";
GRANT SELECT ON "__mj_bizappssales"."vwSalesContacts" TO "cdp_Developer";
GRANT SELECT ON "__mj_bizappssales"."vwSalesContacts" TO "cdp_Integration";';
  END IF;
END
$if_view_exists$;


DO $if_view_exists$
BEGIN
  IF to_regclass('"__mj_bizappssales"."vwSalesContacts"') IS NOT NULL THEN
    EXECUTE 'SELECT ${mjSchema}."spRebindLayeredOuterView"(''__mj_bizappssales'', ''vwSalesContacts'', ''vwSalesContactsGenerated'');';
  END IF;
END
$if_view_exists$;


-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Sales Contacts
-- Item: spCreateSalesContact
-- ============================================================

------------------------------------------------------------
----- CREATE FUNCTION FOR SalesContact
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spCreateSalesContact'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spCreateSalesContact"(
    p_id UUID DEFAULT NULL,
    p_owneremployeeid_clear boolean DEFAULT false,
    p_owneremployeeid UUID DEFAULT NULL,
    p_lifecyclestagetypeid_clear boolean DEFAULT false,
    p_lifecyclestagetypeid UUID DEFAULT NULL,
    p_buyingroletypeid_clear boolean DEFAULT false,
    p_buyingroletypeid UUID DEFAULT NULL,
    p_leadsourcetypeid_clear boolean DEFAULT false,
    p_leadsourcetypeid UUID DEFAULT NULL,
    p_seniority_clear boolean DEFAULT false,
    p_seniority varchar(50) DEFAULT NULL,
    p_optedoutofoutreach BOOLEAN DEFAULT NULL,
    p_donotcontactreason_clear boolean DEFAULT false,
    p_donotcontactreason varchar(500) DEFAULT NULL,
    p_lastengagedat_clear boolean DEFAULT false,
    p_lastengagedat TIMESTAMPTZ DEFAULT NULL
) RETURNS SETOF "__mj_bizappssales"."vwSalesContacts" AS $$
DECLARE
    v_new_id UUID;
BEGIN
    v_new_id := COALESCE(p_id, gen_random_uuid());
    INSERT INTO "__mj_bizappssales"."SalesContact"
        (
            "ID",
            "OwnerEmployeeID",
                "LifecycleStageTypeID",
                "BuyingRoleTypeID",
                "LeadSourceTypeID",
                "Seniority",
                "OptedOutOfOutreach",
                "DoNotContactReason",
                "LastEngagedAt"
        )
    VALUES
        (
            v_new_id,
            CASE WHEN p_owneremployeeid_clear = true THEN NULL ELSE COALESCE(p_owneremployeeid, NULL) END,
                CASE WHEN p_lifecyclestagetypeid_clear = true THEN NULL ELSE COALESCE(p_lifecyclestagetypeid, NULL) END,
                CASE WHEN p_buyingroletypeid_clear = true THEN NULL ELSE COALESCE(p_buyingroletypeid, NULL) END,
                CASE WHEN p_leadsourcetypeid_clear = true THEN NULL ELSE COALESCE(p_leadsourcetypeid, NULL) END,
                CASE WHEN p_seniority_clear = true THEN NULL ELSE COALESCE(p_seniority, NULL) END,
                COALESCE(p_optedoutofoutreach, FALSE),
                CASE WHEN p_donotcontactreason_clear = true THEN NULL ELSE COALESCE(p_donotcontactreason, NULL) END,
                CASE WHEN p_lastengagedat_clear = true THEN NULL ELSE COALESCE(p_lastengagedat, NULL) END
        )
    ;

    RETURN QUERY
    SELECT * FROM "__mj_bizappssales"."vwSalesContacts"
    WHERE "ID" = v_new_id;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spCreateSalesContact" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spCreateSalesContact" TO "cdp_Integration";


-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Sales Contacts
-- Item: spUpdateSalesContact
-- ============================================================

------------------------------------------------------------
----- UPDATE FUNCTION FOR SalesContact
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spUpdateSalesContact'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spUpdateSalesContact"(
    p_id UUID,
    p_owneremployeeid_clear boolean DEFAULT false,
    p_owneremployeeid UUID DEFAULT NULL,
    p_lifecyclestagetypeid_clear boolean DEFAULT false,
    p_lifecyclestagetypeid UUID DEFAULT NULL,
    p_buyingroletypeid_clear boolean DEFAULT false,
    p_buyingroletypeid UUID DEFAULT NULL,
    p_leadsourcetypeid_clear boolean DEFAULT false,
    p_leadsourcetypeid UUID DEFAULT NULL,
    p_seniority_clear boolean DEFAULT false,
    p_seniority varchar(50) DEFAULT NULL,
    p_optedoutofoutreach BOOLEAN DEFAULT NULL,
    p_donotcontactreason_clear boolean DEFAULT false,
    p_donotcontactreason varchar(500) DEFAULT NULL,
    p_lastengagedat_clear boolean DEFAULT false,
    p_lastengagedat TIMESTAMPTZ DEFAULT NULL
) RETURNS SETOF "__mj_bizappssales"."vwSalesContacts" AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE "__mj_bizappssales"."SalesContact"
    SET
        "OwnerEmployeeID" = CASE WHEN p_owneremployeeid_clear = true THEN NULL ELSE COALESCE(p_owneremployeeid, "OwnerEmployeeID") END,
        "LifecycleStageTypeID" = CASE WHEN p_lifecyclestagetypeid_clear = true THEN NULL ELSE COALESCE(p_lifecyclestagetypeid, "LifecycleStageTypeID") END,
        "BuyingRoleTypeID" = CASE WHEN p_buyingroletypeid_clear = true THEN NULL ELSE COALESCE(p_buyingroletypeid, "BuyingRoleTypeID") END,
        "LeadSourceTypeID" = CASE WHEN p_leadsourcetypeid_clear = true THEN NULL ELSE COALESCE(p_leadsourcetypeid, "LeadSourceTypeID") END,
        "Seniority" = CASE WHEN p_seniority_clear = true THEN NULL ELSE COALESCE(p_seniority, "Seniority") END,
        "OptedOutOfOutreach" = COALESCE(p_optedoutofoutreach, "OptedOutOfOutreach"),
        "DoNotContactReason" = CASE WHEN p_donotcontactreason_clear = true THEN NULL ELSE COALESCE(p_donotcontactreason, "DoNotContactReason") END,
        "LastEngagedAt" = CASE WHEN p_lastengagedat_clear = true THEN NULL ELSE COALESCE(p_lastengagedat, "LastEngagedAt") END
    WHERE
        "ID" = p_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        -- Nothing was updated, return empty result set
        RETURN;
    END IF;

    -- Return the updated record from the base view
    RETURN QUERY
    SELECT * FROM "__mj_bizappssales"."vwSalesContacts"
    WHERE "ID" = p_id;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spUpdateSalesContact" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spUpdateSalesContact" TO "cdp_Integration";


------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the SalesContact table
------------------------------------------------------------
CREATE OR REPLACE FUNCTION "__mj_bizappssales"."fn_trg_update_sales_contact"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."__mj_UpdatedAt" := NOW() AT TIME ZONE 'UTC';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_update_sales_contact" ON "__mj_bizappssales"."SalesContact";

CREATE TRIGGER "trg_update_sales_contact"
BEFORE UPDATE ON "__mj_bizappssales"."SalesContact"
FOR EACH ROW
EXECUTE FUNCTION "__mj_bizappssales"."fn_trg_update_sales_contact"();



-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Sales Contacts
-- Item: spDeleteSalesContact
-- ============================================================

------------------------------------------------------------
----- DELETE FUNCTION FOR SalesContact
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spDeleteSalesContact'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spDeleteSalesContact"(
    p_id UUID
) RETURNS TABLE("ID" UUID) AS $$
#variable_conflict use_column
DECLARE
    v_affected_count INTEGER;
BEGIN

    DELETE FROM "__mj_bizappssales"."SalesContact"
    WHERE "ID" = p_id;

    GET DIAGNOSTICS v_affected_count = ROW_COUNT;

    IF v_affected_count = 0 THEN
        RETURN QUERY SELECT NULL::UUID AS "ID";
    ELSE
        RETURN QUERY SELECT p_id AS "ID";
    END IF;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spDeleteSalesContact" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spDeleteSalesContact" TO "cdp_Integration";

-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deal Contact Roles
-- Item: Index for Foreign Keys
-- ============================================================
CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_contact_role_deal_id"
    ON "__mj_bizappssales"."DealContactRole" ("DealID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_contact_role_sales_contact_id"
    ON "__mj_bizappssales"."DealContactRole" ("SalesContactID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_contact_role_buying_role_type_id"
    ON "__mj_bizappssales"."DealContactRole" ("BuyingRoleTypeID");

-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deal Contact Roles
-- Item: vwDealContactRoles
-- ============================================================

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Deal Contact Roles
-----               SCHEMA:      __mj_bizappssales
-----               BASE TABLE:  DealContactRole
-----               PRIMARY KEY: ID
------------------------------------------------------------
DO $vw_regen$
DECLARE
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW "__mj_bizappssales"."vwDealContactRoles"
AS
SELECT
    d.*,
    mjbizappssalesDeal_DealID."Name" AS "Deal",
    mjbizappssalesSalesContact_SalesContactID."DisplayNameAndEmail" AS "SalesContact",
    mjbizappssalesBuyingRoleType_BuyingRoleTypeID."Name" AS "BuyingRoleType"
FROM
    "__mj_bizappssales"."DealContactRole" AS d
INNER JOIN
    "__mj_bizappssales"."Deal" AS mjbizappssalesDeal_DealID
  ON
    "d"."DealID" = mjbizappssalesDeal_DealID."ID"
INNER JOIN
    "__mj_bizappssales"."vwSalesContacts" AS mjbizappssalesSalesContact_SalesContactID
  ON
    "d"."SalesContactID" = mjbizappssalesSalesContact_SalesContactID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."BuyingRoleType" AS mjbizappssalesBuyingRoleType_BuyingRoleTypeID
  ON
    "d"."BuyingRoleTypeID" = mjbizappssalesBuyingRoleType_BuyingRoleTypeID."ID"
$vsql$;
  rec RECORD;
BEGIN
  EXECUTE vsql;
EXCEPTION WHEN invalid_table_definition THEN
  -- 42P16: column rename/reorder/type change. CREATE OR REPLACE can't handle
  -- non-additive shape changes — must DROP CASCADE + recreate. CASCADE drops
  -- every dependent view (anything that JOINs this view in its body), so we
  -- capture each dependent's definition + grants BEFORE the drop and replay
  -- them afterward (best-effort). Without this, on a fresh-DB replay where
  -- one entity's wrapper triggers (e.g. vwAIModelTypes shape changed since
  -- baseline V202605021056), CASCADE wipes downstream views (vwAIModels)
  -- that the wrapper for this entity doesn't know how to recreate, and
  -- those views stay permanently missing.
  CREATE TEMP TABLE IF NOT EXISTS _vw_regen_deps (
    schema_name TEXT,
    view_name   TEXT,
    relkind     CHAR(1),
    definition  TEXT,
    grants_sql  TEXT
  ) ON COMMIT DROP;
  DELETE FROM _vw_regen_deps;

  -- Capture dependent FUNCTIONS too. CASCADE drops every function with
  -- RETURNS SETOF <view> (the codegen-emitted spCreate/spUpdate/spDelete
  -- pattern) when the target view is dropped. Without restoring them,
  -- post-codegen CRUD validation reports those routines as missing —
  -- e.g. "MJ: Recommendation Items → missing create routine
  -- spCreateRecommendationItem" — even though the next codegen pass
  -- emits them. The restored definitions are pg_get_functiondef() output
  -- which is a complete CREATE OR REPLACE FUNCTION statement plus a
  -- trailing semicolon; replaying them verbatim recreates the function
  -- with its original body, parameter list, and return type.
  CREATE TEMP TABLE IF NOT EXISTS _vw_regen_fn_deps (
    schema_name TEXT,
    fn_name     TEXT,
    fn_oid      OID,
    definition  TEXT
  ) ON COMMIT DROP;
  DELETE FROM _vw_regen_fn_deps;

  -- Capture dependents. NOTES on the grants_sql build:
  --   - Resolve role name via pg_get_userbyid(oid) — returns the bare,
  --     unquoted role name (or 'unknown (OID=N)' if the oid no longer
  --     exists). pg_get_userbyid is a public catalog function available to
  --     every database user, including unprivileged accounts on managed
  --     PostgreSQL services (Amazon RDS, Azure Database for PostgreSQL,
  --     Cloud SQL) where pg_authid is restricted to the rds_superuser /
  --     azure_pg_admin / cloudsqlsuperuser group. Earlier revisions joined
  --     to pg_authid which works on self-hosted PG but fails with
  --     "permission denied for table pg_authid" on managed services.
  --   - The earlier (broken) approach cast (aclexplode).grantee::regrole::text
  --     which RETURNS the role name pre-quoted when it contains uppercase
  --     (e.g. cdp_Developer comes back already wrapped); calling quote_ident
  --     on the already-quoted string double-wrapped and the GRANT failed at
  --     replay with "role does not exist". Using
  --     pg_get_userbyid returns a bare name and lets quote_ident wrap it
  --     correctly exactly once.
  --   - PUBLIC is grantee oid 0; pg_get_userbyid(0) returns 'unknown
  --     (OID=0)' so handle the PUBLIC case explicitly and use it as the
  --     literal 'PUBLIC' rather than quote_ident on the synthetic name.
  INSERT INTO _vw_regen_deps (schema_name, view_name, relkind, definition, grants_sql)
  SELECT DISTINCT
      dn.nspname,
      dc.relname,
      dc.relkind,
      pg_get_viewdef(dc.oid),
      (SELECT string_agg(
          'GRANT ' || g.privilege || ' ON ' || quote_ident(dn.nspname) || '.' || quote_ident(dc.relname) ||
          ' TO ' || (CASE WHEN g.grantee_oid = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(g.grantee_oid)) END) || ';',
          E'
')
       FROM (
           SELECT (aclexplode(dc.relacl)).grantee AS grantee_oid,
                  (aclexplode(dc.relacl)).privilege_type AS privilege
       ) g
       WHERE g.privilege IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'))
  FROM pg_depend d
  JOIN pg_rewrite r ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
  JOIN pg_class dc ON dc.oid = r.ev_class AND dc.relkind IN ('v', 'm')
  JOIN pg_namespace dn ON dn.oid = dc.relnamespace
  JOIN pg_class tc ON tc.oid = d.refobjid
  JOIN pg_namespace tn ON tn.oid = tc.relnamespace
  WHERE tn.nspname = '__mj_bizappssales'
    AND tc.relname = 'vwDealContactRoles'
    AND tc.relkind IN ('v', 'm')
    AND dc.oid <> tc.oid;

  -- Capture dependent functions. Two paths matter on PG:
  --   1. Functions whose RETURN type references the view (RETURNS SETOF
  --      <view>) — pg_depend records this as type=pg_type → pg_class.
  --   2. Functions whose body references the view (used by sql functions
  --      and by some plpgsql edge cases) — pg_depend records this as
  --      pg_proc → pg_class.
  -- pg_get_functiondef returns a complete CREATE OR REPLACE FUNCTION
  -- statement that we replay verbatim. We DO include RETURNS-only
  -- references because that's the dominant codegen pattern (sp* CRUD
  -- functions all RETURNS SETOF the matching vwX).
  INSERT INTO _vw_regen_fn_deps (schema_name, fn_name, fn_oid, definition)
  SELECT DISTINCT
      pn.nspname,
      pp.proname,
      pp.oid,
      pg_get_functiondef(pp.oid)
  FROM pg_depend d
  JOIN pg_proc pp ON pp.oid = d.objid AND d.classid = 'pg_proc'::regclass
  JOIN pg_namespace pn ON pn.oid = pp.pronamespace
  JOIN pg_class tc ON tc.oid = d.refobjid
  JOIN pg_namespace tn ON tn.oid = tc.relnamespace
  WHERE tn.nspname = '__mj_bizappssales'
    AND tc.relname = 'vwDealContactRoles'
    AND tc.relkind IN ('v', 'm')
  UNION
  SELECT DISTINCT
      pn.nspname,
      pp.proname,
      pp.oid,
      pg_get_functiondef(pp.oid)
  FROM pg_depend d
  JOIN pg_type pt ON pt.oid = d.refobjid AND d.refclassid = 'pg_type'::regclass
  JOIN pg_proc pp ON pp.prorettype = pt.oid OR pt.typrelid = pp.oid
  JOIN pg_namespace pn ON pn.oid = pp.pronamespace
  WHERE EXISTS (
      SELECT 1 FROM pg_class tc
      JOIN pg_namespace tn ON tn.oid = tc.relnamespace
      WHERE tc.reltype = pt.oid
        AND tn.nspname = '__mj_bizappssales'
        AND tc.relname = 'vwDealContactRoles'
        AND tc.relkind IN ('v', 'm')
  );

  DROP VIEW IF EXISTS "__mj_bizappssales"."vwDealContactRoles" CASCADE;
  EXECUTE vsql;

  -- Replay captured dependents. Best-effort: log + continue on failure.
  -- IMPORTANT: the CREATE VIEW and the GRANTs run in SEPARATE inner BEGIN
  -- blocks. PL/pgSQL's BEGIN ... EXCEPTION creates an implicit savepoint
  -- and rolls back EVERY statement in the block on any exception. If we
  -- combined CREATE+GRANT in one block and a GRANT failed (e.g. role not
  -- present in target environment), the just-recreated VIEW would also
  -- get rolled back and stay missing — the exact failure mode this
  -- wrapper exists to prevent.
  FOR rec IN SELECT schema_name, view_name, relkind, definition, grants_sql FROM _vw_regen_deps LOOP
    BEGIN
      IF rec.relkind = 'm' THEN
        EXECUTE 'CREATE MATERIALIZED VIEW ' || quote_ident(rec.schema_name) || '.' || quote_ident(rec.view_name) || ' AS ' || rec.definition;
      ELSE
        EXECUTE 'CREATE VIEW ' || quote_ident(rec.schema_name) || '.' || quote_ident(rec.view_name) || ' AS ' || rec.definition;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Best-effort restore skipped dependent %.%: %', rec.schema_name, rec.view_name, SQLERRM;
    END;

    IF rec.grants_sql IS NOT NULL THEN
      BEGIN
        EXECUTE rec.grants_sql;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Best-effort grant restore skipped %.%: %', rec.schema_name, rec.view_name, SQLERRM;
      END;
    END IF;
  END LOOP;

  -- Replay captured dependent functions AFTER all dependent views are
  -- restored — most codegen-emitted sp* functions reference both the
  -- target view AND the dependent views in their bodies/return types.
  -- Wrapped per-function in its own savepoint so a single failure
  -- doesn't poison subsequent restores or the just-recreated target.
  FOR rec IN SELECT schema_name, fn_name, definition FROM _vw_regen_fn_deps LOOP
    BEGIN
      EXECUTE rec.definition;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Best-effort restore skipped dependent function %.%: %', rec.schema_name, rec.fn_name, SQLERRM;
    END;
  END LOOP;

  DROP TABLE _vw_regen_deps;
  DROP TABLE _vw_regen_fn_deps;
END $vw_regen$;
GRANT SELECT ON "__mj_bizappssales"."vwDealContactRoles" TO "cdp_UI";
GRANT SELECT ON "__mj_bizappssales"."vwDealContactRoles" TO "cdp_Developer";
GRANT SELECT ON "__mj_bizappssales"."vwDealContactRoles" TO "cdp_Integration";

-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deal Contact Roles
-- Item: spCreateDealContactRole
-- ============================================================

------------------------------------------------------------
----- CREATE FUNCTION FOR DealContactRole
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spCreateDealContactRole'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spCreateDealContactRole"(
    p_id UUID DEFAULT NULL,
    p_dealid UUID DEFAULT NULL,
    p_salescontactid UUID DEFAULT NULL,
    p_buyingroletypeid_clear boolean DEFAULT false,
    p_buyingroletypeid UUID DEFAULT NULL,
    p_influence_clear boolean DEFAULT false,
    p_influence decimal(5, 2) DEFAULT NULL,
    p_notes_clear boolean DEFAULT false,
    p_notes TEXT DEFAULT NULL
) RETURNS SETOF "__mj_bizappssales"."vwDealContactRoles" AS $$
DECLARE
    v_new_id UUID;
BEGIN
    v_new_id := COALESCE(p_id, gen_random_uuid());
    INSERT INTO "__mj_bizappssales"."DealContactRole"
        (
            "ID",
            "DealID",
                "SalesContactID",
                "BuyingRoleTypeID",
                "Influence",
                "Notes"
        )
    VALUES
        (
            v_new_id,
            p_dealid,
                p_salescontactid,
                CASE WHEN p_buyingroletypeid_clear = true THEN NULL ELSE COALESCE(p_buyingroletypeid, NULL) END,
                CASE WHEN p_influence_clear = true THEN NULL ELSE COALESCE(p_influence, NULL) END,
                CASE WHEN p_notes_clear = true THEN NULL ELSE COALESCE(p_notes, NULL) END
        )
    ;

    RETURN QUERY
    SELECT * FROM "__mj_bizappssales"."vwDealContactRoles"
    WHERE "ID" = v_new_id;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spCreateDealContactRole" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spCreateDealContactRole" TO "cdp_Integration";


-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deal Contact Roles
-- Item: spUpdateDealContactRole
-- ============================================================

------------------------------------------------------------
----- UPDATE FUNCTION FOR DealContactRole
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spUpdateDealContactRole'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spUpdateDealContactRole"(
    p_id UUID,
    p_dealid UUID DEFAULT NULL,
    p_salescontactid UUID DEFAULT NULL,
    p_buyingroletypeid_clear boolean DEFAULT false,
    p_buyingroletypeid UUID DEFAULT NULL,
    p_influence_clear boolean DEFAULT false,
    p_influence decimal(5, 2) DEFAULT NULL,
    p_notes_clear boolean DEFAULT false,
    p_notes TEXT DEFAULT NULL
) RETURNS SETOF "__mj_bizappssales"."vwDealContactRoles" AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE "__mj_bizappssales"."DealContactRole"
    SET
        "DealID" = COALESCE(p_dealid, "DealID"),
        "SalesContactID" = COALESCE(p_salescontactid, "SalesContactID"),
        "BuyingRoleTypeID" = CASE WHEN p_buyingroletypeid_clear = true THEN NULL ELSE COALESCE(p_buyingroletypeid, "BuyingRoleTypeID") END,
        "Influence" = CASE WHEN p_influence_clear = true THEN NULL ELSE COALESCE(p_influence, "Influence") END,
        "Notes" = CASE WHEN p_notes_clear = true THEN NULL ELSE COALESCE(p_notes, "Notes") END
    WHERE
        "ID" = p_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        -- Nothing was updated, return empty result set
        RETURN;
    END IF;

    -- Return the updated record from the base view
    RETURN QUERY
    SELECT * FROM "__mj_bizappssales"."vwDealContactRoles"
    WHERE "ID" = p_id;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spUpdateDealContactRole" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spUpdateDealContactRole" TO "cdp_Integration";


------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the DealContactRole table
------------------------------------------------------------
CREATE OR REPLACE FUNCTION "__mj_bizappssales"."fn_trg_update_deal_contact_role"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."__mj_UpdatedAt" := NOW() AT TIME ZONE 'UTC';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_update_deal_contact_role" ON "__mj_bizappssales"."DealContactRole";

CREATE TRIGGER "trg_update_deal_contact_role"
BEFORE UPDATE ON "__mj_bizappssales"."DealContactRole"
FOR EACH ROW
EXECUTE FUNCTION "__mj_bizappssales"."fn_trg_update_deal_contact_role"();



-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deal Contact Roles
-- Item: spDeleteDealContactRole
-- ============================================================

------------------------------------------------------------
----- DELETE FUNCTION FOR DealContactRole
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spDeleteDealContactRole'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spDeleteDealContactRole"(
    p_id UUID
) RETURNS TABLE("ID" UUID) AS $$
#variable_conflict use_column
DECLARE
    v_affected_count INTEGER;
BEGIN

    DELETE FROM "__mj_bizappssales"."DealContactRole"
    WHERE "ID" = p_id;

    GET DIAGNOSTICS v_affected_count = ROW_COUNT;

    IF v_affected_count = 0 THEN
        RETURN QUERY SELECT NULL::UUID AS "ID";
    ELSE
        RETURN QUERY SELECT p_id AS "ID";
    END IF;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spDeleteDealContactRole" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spDeleteDealContactRole" TO "cdp_Integration";

-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deals
-- Item: Index for Foreign Keys
-- ============================================================
CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_pipeline_id"
    ON "__mj_bizappssales"."Deal" ("PipelineID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_pipeline_stage_id"
    ON "__mj_bizappssales"."Deal" ("PipelineStageID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_deal_type_id"
    ON "__mj_bizappssales"."Deal" ("DealTypeID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_deal_status_type_id"
    ON "__mj_bizappssales"."Deal" ("DealStatusTypeID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_account_id"
    ON "__mj_bizappssales"."Deal" ("AccountID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_primary_contact_id"
    ON "__mj_bizappssales"."Deal" ("PrimaryContactID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_billing_contact_id"
    ON "__mj_bizappssales"."Deal" ("BillingContactID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_company_id"
    ON "__mj_bizappssales"."Deal" ("CompanyID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_owner_employee_id"
    ON "__mj_bizappssales"."Deal" ("OwnerEmployeeID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_currency_id"
    ON "__mj_bizappssales"."Deal" ("CurrencyID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_forecast_category_type_id"
    ON "__mj_bizappssales"."Deal" ("ForecastCategoryTypeID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_loss_reason_id"
    ON "__mj_bizappssales"."Deal" ("LossReasonID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_lead_source_type_id"
    ON "__mj_bizappssales"."Deal" ("LeadSourceTypeID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_contract_id"
    ON "__mj_bizappssales"."Deal" ("ContractID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_renews_contract_id"
    ON "__mj_bizappssales"."Deal" ("RenewsContractID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_closed_by_user_id"
    ON "__mj_bizappssales"."Deal" ("ClosedByUserID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_order_id"
    ON "__mj_bizappssales"."Deal" ("OrderID");

-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deals
-- Item: vwDealsGenerated
-- ============================================================

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Deals
-----               SCHEMA:      __mj_bizappssales
-----               BASE TABLE:  Deal
-----               PRIMARY KEY: ID
------------------------------------------------------------
DO $vw_regen$
DECLARE
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW "__mj_bizappssales"."vwDealsGenerated"
AS
SELECT
    d.*,
    mjbizappssalesPipeline_PipelineID."Name" AS "Pipeline",
    mjbizappssalesPipelineStage_PipelineStageID."Name" AS "PipelineStage",
    mjbizappssalesDealType_DealTypeID."Name" AS "DealType",
    mjbizappssalesDealStatusType_DealStatusTypeID."Name" AS "DealStatusType",
    mjbizappssalesSalesAccount_AccountID."Name" AS "Account",
    mjbizappssalesSalesContact_PrimaryContactID."DisplayNameAndEmail" AS "PrimaryContact",
    mjbizappssalesSalesContact_BillingContactID."DisplayNameAndEmail" AS "BillingContact",
    MJCompany_CompanyID."Name" AS "Company",
    MJEmployee_OwnerEmployeeID."FirstLast" AS "OwnerEmployee",
    mjbizappssalesForecastCategoryType_ForecastCategoryTypeID."Name" AS "ForecastCategoryType",
    mjbizappssalesLossReason_LossReasonID."Name" AS "LossReason",
    mjbizappssalesLeadSourceType_LeadSourceTypeID."Name" AS "LeadSourceType",
    MJUser_ClosedByUserID."Name" AS "ClosedByUser",
    mjbizappsordersOrderHeader_OrderID."OrderNumber" AS "Order"
FROM
    "__mj_bizappssales"."Deal" AS d
INNER JOIN
    "__mj_bizappssales"."Pipeline" AS mjbizappssalesPipeline_PipelineID
  ON
    "d"."PipelineID" = mjbizappssalesPipeline_PipelineID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."PipelineStage" AS mjbizappssalesPipelineStage_PipelineStageID
  ON
    "d"."PipelineStageID" = mjbizappssalesPipelineStage_PipelineStageID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."DealType" AS mjbizappssalesDealType_DealTypeID
  ON
    "d"."DealTypeID" = mjbizappssalesDealType_DealTypeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."DealStatusType" AS mjbizappssalesDealStatusType_DealStatusTypeID
  ON
    "d"."DealStatusTypeID" = mjbizappssalesDealStatusType_DealStatusTypeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."vwSalesAccounts" AS mjbizappssalesSalesAccount_AccountID
  ON
    "d"."AccountID" = mjbizappssalesSalesAccount_AccountID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."vwSalesContacts" AS mjbizappssalesSalesContact_PrimaryContactID
  ON
    "d"."PrimaryContactID" = mjbizappssalesSalesContact_PrimaryContactID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."vwSalesContacts" AS mjbizappssalesSalesContact_BillingContactID
  ON
    "d"."BillingContactID" = mjbizappssalesSalesContact_BillingContactID."ID"
INNER JOIN
    ${mjSchema}."Company" AS MJCompany_CompanyID
  ON
    "d"."CompanyID" = MJCompany_CompanyID."ID"
LEFT OUTER JOIN
    ${mjSchema}."vwEmployees" AS MJEmployee_OwnerEmployeeID
  ON
    "d"."OwnerEmployeeID" = MJEmployee_OwnerEmployeeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."ForecastCategoryType" AS mjbizappssalesForecastCategoryType_ForecastCategoryTypeID
  ON
    "d"."ForecastCategoryTypeID" = mjbizappssalesForecastCategoryType_ForecastCategoryTypeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."LossReason" AS mjbizappssalesLossReason_LossReasonID
  ON
    "d"."LossReasonID" = mjbizappssalesLossReason_LossReasonID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."LeadSourceType" AS mjbizappssalesLeadSourceType_LeadSourceTypeID
  ON
    "d"."LeadSourceTypeID" = mjbizappssalesLeadSourceType_LeadSourceTypeID."ID"
LEFT OUTER JOIN
    ${mjSchema}."User" AS MJUser_ClosedByUserID
  ON
    "d"."ClosedByUserID" = MJUser_ClosedByUserID."ID"
LEFT OUTER JOIN
    "__mj_bizappsorders"."OrderHeader" AS mjbizappsordersOrderHeader_OrderID
  ON
    "d"."OrderID" = mjbizappsordersOrderHeader_OrderID."ID"
$vsql$;
  rec RECORD;
BEGIN
  EXECUTE vsql;
EXCEPTION WHEN invalid_table_definition THEN
  -- 42P16: column rename/reorder/type change. CREATE OR REPLACE can't handle
  -- non-additive shape changes — must DROP CASCADE + recreate. CASCADE drops
  -- every dependent view (anything that JOINs this view in its body), so we
  -- capture each dependent's definition + grants BEFORE the drop and replay
  -- them afterward (best-effort). Without this, on a fresh-DB replay where
  -- one entity's wrapper triggers (e.g. vwAIModelTypes shape changed since
  -- baseline V202605021056), CASCADE wipes downstream views (vwAIModels)
  -- that the wrapper for this entity doesn't know how to recreate, and
  -- those views stay permanently missing.
  CREATE TEMP TABLE IF NOT EXISTS _vw_regen_deps (
    schema_name TEXT,
    view_name   TEXT,
    relkind     CHAR(1),
    definition  TEXT,
    grants_sql  TEXT
  ) ON COMMIT DROP;
  DELETE FROM _vw_regen_deps;

  -- Capture dependent FUNCTIONS too. CASCADE drops every function with
  -- RETURNS SETOF <view> (the codegen-emitted spCreate/spUpdate/spDelete
  -- pattern) when the target view is dropped. Without restoring them,
  -- post-codegen CRUD validation reports those routines as missing —
  -- e.g. "MJ: Recommendation Items → missing create routine
  -- spCreateRecommendationItem" — even though the next codegen pass
  -- emits them. The restored definitions are pg_get_functiondef() output
  -- which is a complete CREATE OR REPLACE FUNCTION statement plus a
  -- trailing semicolon; replaying them verbatim recreates the function
  -- with its original body, parameter list, and return type.
  CREATE TEMP TABLE IF NOT EXISTS _vw_regen_fn_deps (
    schema_name TEXT,
    fn_name     TEXT,
    fn_oid      OID,
    definition  TEXT
  ) ON COMMIT DROP;
  DELETE FROM _vw_regen_fn_deps;

  -- Capture dependents. NOTES on the grants_sql build:
  --   - Resolve role name via pg_get_userbyid(oid) — returns the bare,
  --     unquoted role name (or 'unknown (OID=N)' if the oid no longer
  --     exists). pg_get_userbyid is a public catalog function available to
  --     every database user, including unprivileged accounts on managed
  --     PostgreSQL services (Amazon RDS, Azure Database for PostgreSQL,
  --     Cloud SQL) where pg_authid is restricted to the rds_superuser /
  --     azure_pg_admin / cloudsqlsuperuser group. Earlier revisions joined
  --     to pg_authid which works on self-hosted PG but fails with
  --     "permission denied for table pg_authid" on managed services.
  --   - The earlier (broken) approach cast (aclexplode).grantee::regrole::text
  --     which RETURNS the role name pre-quoted when it contains uppercase
  --     (e.g. cdp_Developer comes back already wrapped); calling quote_ident
  --     on the already-quoted string double-wrapped and the GRANT failed at
  --     replay with "role does not exist". Using
  --     pg_get_userbyid returns a bare name and lets quote_ident wrap it
  --     correctly exactly once.
  --   - PUBLIC is grantee oid 0; pg_get_userbyid(0) returns 'unknown
  --     (OID=0)' so handle the PUBLIC case explicitly and use it as the
  --     literal 'PUBLIC' rather than quote_ident on the synthetic name.
  INSERT INTO _vw_regen_deps (schema_name, view_name, relkind, definition, grants_sql)
  SELECT DISTINCT
      dn.nspname,
      dc.relname,
      dc.relkind,
      pg_get_viewdef(dc.oid),
      (SELECT string_agg(
          'GRANT ' || g.privilege || ' ON ' || quote_ident(dn.nspname) || '.' || quote_ident(dc.relname) ||
          ' TO ' || (CASE WHEN g.grantee_oid = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(g.grantee_oid)) END) || ';',
          E'
')
       FROM (
           SELECT (aclexplode(dc.relacl)).grantee AS grantee_oid,
                  (aclexplode(dc.relacl)).privilege_type AS privilege
       ) g
       WHERE g.privilege IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'))
  FROM pg_depend d
  JOIN pg_rewrite r ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
  JOIN pg_class dc ON dc.oid = r.ev_class AND dc.relkind IN ('v', 'm')
  JOIN pg_namespace dn ON dn.oid = dc.relnamespace
  JOIN pg_class tc ON tc.oid = d.refobjid
  JOIN pg_namespace tn ON tn.oid = tc.relnamespace
  WHERE tn.nspname = '__mj_bizappssales'
    AND tc.relname = 'vwDealsGenerated'
    AND tc.relkind IN ('v', 'm')
    AND dc.oid <> tc.oid;

  -- Capture dependent functions. Two paths matter on PG:
  --   1. Functions whose RETURN type references the view (RETURNS SETOF
  --      <view>) — pg_depend records this as type=pg_type → pg_class.
  --   2. Functions whose body references the view (used by sql functions
  --      and by some plpgsql edge cases) — pg_depend records this as
  --      pg_proc → pg_class.
  -- pg_get_functiondef returns a complete CREATE OR REPLACE FUNCTION
  -- statement that we replay verbatim. We DO include RETURNS-only
  -- references because that's the dominant codegen pattern (sp* CRUD
  -- functions all RETURNS SETOF the matching vwX).
  INSERT INTO _vw_regen_fn_deps (schema_name, fn_name, fn_oid, definition)
  SELECT DISTINCT
      pn.nspname,
      pp.proname,
      pp.oid,
      pg_get_functiondef(pp.oid)
  FROM pg_depend d
  JOIN pg_proc pp ON pp.oid = d.objid AND d.classid = 'pg_proc'::regclass
  JOIN pg_namespace pn ON pn.oid = pp.pronamespace
  JOIN pg_class tc ON tc.oid = d.refobjid
  JOIN pg_namespace tn ON tn.oid = tc.relnamespace
  WHERE tn.nspname = '__mj_bizappssales'
    AND tc.relname = 'vwDealsGenerated'
    AND tc.relkind IN ('v', 'm')
  UNION
  SELECT DISTINCT
      pn.nspname,
      pp.proname,
      pp.oid,
      pg_get_functiondef(pp.oid)
  FROM pg_depend d
  JOIN pg_type pt ON pt.oid = d.refobjid AND d.refclassid = 'pg_type'::regclass
  JOIN pg_proc pp ON pp.prorettype = pt.oid OR pt.typrelid = pp.oid
  JOIN pg_namespace pn ON pn.oid = pp.pronamespace
  WHERE EXISTS (
      SELECT 1 FROM pg_class tc
      JOIN pg_namespace tn ON tn.oid = tc.relnamespace
      WHERE tc.reltype = pt.oid
        AND tn.nspname = '__mj_bizappssales'
        AND tc.relname = 'vwDealsGenerated'
        AND tc.relkind IN ('v', 'm')
  );

  DROP VIEW IF EXISTS "__mj_bizappssales"."vwDealsGenerated" CASCADE;
  EXECUTE vsql;

  -- Replay captured dependents. Best-effort: log + continue on failure.
  -- IMPORTANT: the CREATE VIEW and the GRANTs run in SEPARATE inner BEGIN
  -- blocks. PL/pgSQL's BEGIN ... EXCEPTION creates an implicit savepoint
  -- and rolls back EVERY statement in the block on any exception. If we
  -- combined CREATE+GRANT in one block and a GRANT failed (e.g. role not
  -- present in target environment), the just-recreated VIEW would also
  -- get rolled back and stay missing — the exact failure mode this
  -- wrapper exists to prevent.
  FOR rec IN SELECT schema_name, view_name, relkind, definition, grants_sql FROM _vw_regen_deps LOOP
    BEGIN
      IF rec.relkind = 'm' THEN
        EXECUTE 'CREATE MATERIALIZED VIEW ' || quote_ident(rec.schema_name) || '.' || quote_ident(rec.view_name) || ' AS ' || rec.definition;
      ELSE
        EXECUTE 'CREATE VIEW ' || quote_ident(rec.schema_name) || '.' || quote_ident(rec.view_name) || ' AS ' || rec.definition;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Best-effort restore skipped dependent %.%: %', rec.schema_name, rec.view_name, SQLERRM;
    END;

    IF rec.grants_sql IS NOT NULL THEN
      BEGIN
        EXECUTE rec.grants_sql;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Best-effort grant restore skipped %.%: %', rec.schema_name, rec.view_name, SQLERRM;
      END;
    END IF;
  END LOOP;

  -- Replay captured dependent functions AFTER all dependent views are
  -- restored — most codegen-emitted sp* functions reference both the
  -- target view AND the dependent views in their bodies/return types.
  -- Wrapped per-function in its own savepoint so a single failure
  -- doesn't poison subsequent restores or the just-recreated target.
  FOR rec IN SELECT schema_name, fn_name, definition FROM _vw_regen_fn_deps LOOP
    BEGIN
      EXECUTE rec.definition;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Best-effort restore skipped dependent function %.%: %', rec.schema_name, rec.fn_name, SQLERRM;
    END;
  END LOOP;

  DROP TABLE _vw_regen_deps;
  DROP TABLE _vw_regen_fn_deps;
END $vw_regen$;

DO $if_view_exists$
BEGIN
  IF to_regclass('"__mj_bizappssales"."vwDeals"') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON "__mj_bizappssales"."vwDeals" TO "cdp_UI";
GRANT SELECT ON "__mj_bizappssales"."vwDeals" TO "cdp_Developer";
GRANT SELECT ON "__mj_bizappssales"."vwDeals" TO "cdp_Integration";';
  END IF;
END
$if_view_exists$;


DO $if_view_exists$
BEGIN
  IF to_regclass('"__mj_bizappssales"."vwDeals"') IS NOT NULL THEN
    EXECUTE 'SELECT ${mjSchema}."spRebindLayeredOuterView"(''__mj_bizappssales'', ''vwDeals'', ''vwDealsGenerated'');';
  END IF;
END
$if_view_exists$;


-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deals
-- Item: spCreateDeal
-- ============================================================

------------------------------------------------------------
----- CREATE FUNCTION FOR Deal
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spCreateDeal'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spCreateDeal"(
    p_id UUID DEFAULT NULL,
    p_dealnumber_clear boolean DEFAULT false,
    p_dealnumber varchar(50) DEFAULT NULL,
    p_name varchar(500) DEFAULT NULL,
    p_pipelineid UUID DEFAULT NULL,
    p_pipelinestageid_clear boolean DEFAULT false,
    p_pipelinestageid UUID DEFAULT NULL,
    p_dealtypeid_clear boolean DEFAULT false,
    p_dealtypeid UUID DEFAULT NULL,
    p_dealstatustypeid_clear boolean DEFAULT false,
    p_dealstatustypeid UUID DEFAULT NULL,
    p_accountid_clear boolean DEFAULT false,
    p_accountid UUID DEFAULT NULL,
    p_primarycontactid_clear boolean DEFAULT false,
    p_primarycontactid UUID DEFAULT NULL,
    p_billingcontactid_clear boolean DEFAULT false,
    p_billingcontactid UUID DEFAULT NULL,
    p_companyid UUID DEFAULT NULL,
    p_owneremployeeid_clear boolean DEFAULT false,
    p_owneremployeeid UUID DEFAULT NULL,
    p_amount_clear boolean DEFAULT false,
    p_amount decimal(19, 4) DEFAULT NULL,
    p_amountiscomputed BOOLEAN DEFAULT NULL,
    p_amountcomputedat_clear boolean DEFAULT false,
    p_amountcomputedat TIMESTAMPTZ DEFAULT NULL,
    p_amountsourcehash_clear boolean DEFAULT false,
    p_amountsourcehash varchar(128) DEFAULT NULL,
    p_currencyid_clear boolean DEFAULT false,
    p_currencyid UUID DEFAULT NULL,
    p_mrr_clear boolean DEFAULT false,
    p_mrr decimal(19, 4) DEFAULT NULL,
    p_arr_clear boolean DEFAULT false,
    p_arr decimal(19, 4) DEFAULT NULL,
    p_termmonths_clear boolean DEFAULT false,
    p_termmonths int DEFAULT NULL,
    p_estimatedprojectweeks_clear boolean DEFAULT false,
    p_estimatedprojectweeks int DEFAULT NULL,
    p_executiondate_clear boolean DEFAULT false,
    p_executiondate date DEFAULT NULL,
    p_startdate_clear boolean DEFAULT false,
    p_startdate date DEFAULT NULL,
    p_expectedclosedate_clear boolean DEFAULT false,
    p_expectedclosedate date DEFAULT NULL,
    p_actualclosedate_clear boolean DEFAULT false,
    p_actualclosedate date DEFAULT NULL,
    p_probability_clear boolean DEFAULT false,
    p_probability decimal(5, 2) DEFAULT NULL,
    p_forecastcategorytypeid_clear boolean DEFAULT false,
    p_forecastcategorytypeid UUID DEFAULT NULL,
    p_lossreasonid_clear boolean DEFAULT false,
    p_lossreasonid UUID DEFAULT NULL,
    p_lossnotes_clear boolean DEFAULT false,
    p_lossnotes TEXT DEFAULT NULL,
    p_leadsourcetypeid_clear boolean DEFAULT false,
    p_leadsourcetypeid UUID DEFAULT NULL,
    p_campaignid_clear boolean DEFAULT false,
    p_campaignid UUID DEFAULT NULL,
    p_contractid_clear boolean DEFAULT false,
    p_contractid UUID DEFAULT NULL,
    p_renewscontractid_clear boolean DEFAULT false,
    p_renewscontractid UUID DEFAULT NULL,
    p_autorenew BOOLEAN DEFAULT NULL,
    p_annualincreasepctoverride_clear boolean DEFAULT false,
    p_annualincreasepctoverride decimal(5, 2) DEFAULT NULL,
    p_cancellationnoticedaysoverride_clear boolean DEFAULT false,
    p_cancellationnoticedaysoverride int DEFAULT NULL,
    p_paymentmethod_clear boolean DEFAULT false,
    p_paymentmethod varchar(50) DEFAULT NULL,
    p_standardagreementmodified BOOLEAN DEFAULT NULL,
    p_contractvariances_clear boolean DEFAULT false,
    p_contractvariances TEXT DEFAULT NULL,
    p_description_clear boolean DEFAULT false,
    p_description TEXT DEFAULT NULL,
    p_nextstep_clear boolean DEFAULT false,
    p_nextstep varchar(1000) DEFAULT NULL,
    p_nextstepdate_clear boolean DEFAULT false,
    p_nextstepdate date DEFAULT NULL,
    p_closedat_clear boolean DEFAULT false,
    p_closedat TIMESTAMPTZ DEFAULT NULL,
    p_closedbyuserid_clear boolean DEFAULT false,
    p_closedbyuserid UUID DEFAULT NULL,
    p_orderid_clear boolean DEFAULT false,
    p_orderid UUID DEFAULT NULL,
    p_predictedwinprobability_clear boolean DEFAULT false,
    p_predictedwinprobability decimal(5, 4) DEFAULT NULL,
    p_predictedwinriskband_clear boolean DEFAULT false,
    p_predictedwinriskband varchar(20) DEFAULT NULL,
    p_predictedwinscoredat_clear boolean DEFAULT false,
    p_predictedwinscoredat TIMESTAMPTZ DEFAULT NULL
) RETURNS SETOF "__mj_bizappssales"."vwDeals" AS $$
DECLARE
    v_new_id UUID;
BEGIN
    v_new_id := COALESCE(p_id, gen_random_uuid());
    INSERT INTO "__mj_bizappssales"."Deal"
        (
            "ID",
            "DealNumber",
                "Name",
                "PipelineID",
                "PipelineStageID",
                "DealTypeID",
                "DealStatusTypeID",
                "AccountID",
                "PrimaryContactID",
                "BillingContactID",
                "CompanyID",
                "OwnerEmployeeID",
                "Amount",
                "AmountIsComputed",
                "AmountComputedAt",
                "AmountSourceHash",
                "CurrencyID",
                "MRR",
                "ARR",
                "TermMonths",
                "EstimatedProjectWeeks",
                "ExecutionDate",
                "StartDate",
                "ExpectedCloseDate",
                "ActualCloseDate",
                "Probability",
                "ForecastCategoryTypeID",
                "LossReasonID",
                "LossNotes",
                "LeadSourceTypeID",
                "CampaignID",
                "ContractID",
                "RenewsContractID",
                "AutoRenew",
                "AnnualIncreasePctOverride",
                "CancellationNoticeDaysOverride",
                "PaymentMethod",
                "StandardAgreementModified",
                "ContractVariances",
                "Description",
                "NextStep",
                "NextStepDate",
                "ClosedAt",
                "ClosedByUserID",
                "OrderID",
                "PredictedWinProbability",
                "PredictedWinRiskBand",
                "PredictedWinScoredAt"
        )
    VALUES
        (
            v_new_id,
            CASE WHEN p_dealnumber_clear = true THEN NULL ELSE COALESCE(p_dealnumber, NULL) END,
                p_name,
                p_pipelineid,
                CASE WHEN p_pipelinestageid_clear = true THEN NULL ELSE COALESCE(p_pipelinestageid, NULL) END,
                CASE WHEN p_dealtypeid_clear = true THEN NULL ELSE COALESCE(p_dealtypeid, NULL) END,
                CASE WHEN p_dealstatustypeid_clear = true THEN NULL ELSE COALESCE(p_dealstatustypeid, NULL) END,
                CASE WHEN p_accountid_clear = true THEN NULL ELSE COALESCE(p_accountid, NULL) END,
                CASE WHEN p_primarycontactid_clear = true THEN NULL ELSE COALESCE(p_primarycontactid, NULL) END,
                CASE WHEN p_billingcontactid_clear = true THEN NULL ELSE COALESCE(p_billingcontactid, NULL) END,
                p_companyid,
                CASE WHEN p_owneremployeeid_clear = true THEN NULL ELSE COALESCE(p_owneremployeeid, NULL) END,
                CASE WHEN p_amount_clear = true THEN NULL ELSE COALESCE(p_amount, NULL) END,
                COALESCE(p_amountiscomputed, FALSE),
                CASE WHEN p_amountcomputedat_clear = true THEN NULL ELSE COALESCE(p_amountcomputedat, NULL) END,
                CASE WHEN p_amountsourcehash_clear = true THEN NULL ELSE COALESCE(p_amountsourcehash, NULL) END,
                CASE WHEN p_currencyid_clear = true THEN NULL ELSE COALESCE(p_currencyid, NULL) END,
                CASE WHEN p_mrr_clear = true THEN NULL ELSE COALESCE(p_mrr, NULL) END,
                CASE WHEN p_arr_clear = true THEN NULL ELSE COALESCE(p_arr, NULL) END,
                CASE WHEN p_termmonths_clear = true THEN NULL ELSE COALESCE(p_termmonths, NULL) END,
                CASE WHEN p_estimatedprojectweeks_clear = true THEN NULL ELSE COALESCE(p_estimatedprojectweeks, NULL) END,
                CASE WHEN p_executiondate_clear = true THEN NULL ELSE COALESCE(p_executiondate, NULL) END,
                CASE WHEN p_startdate_clear = true THEN NULL ELSE COALESCE(p_startdate, NULL) END,
                CASE WHEN p_expectedclosedate_clear = true THEN NULL ELSE COALESCE(p_expectedclosedate, NULL) END,
                CASE WHEN p_actualclosedate_clear = true THEN NULL ELSE COALESCE(p_actualclosedate, NULL) END,
                CASE WHEN p_probability_clear = true THEN NULL ELSE COALESCE(p_probability, NULL) END,
                CASE WHEN p_forecastcategorytypeid_clear = true THEN NULL ELSE COALESCE(p_forecastcategorytypeid, NULL) END,
                CASE WHEN p_lossreasonid_clear = true THEN NULL ELSE COALESCE(p_lossreasonid, NULL) END,
                CASE WHEN p_lossnotes_clear = true THEN NULL ELSE COALESCE(p_lossnotes, NULL) END,
                CASE WHEN p_leadsourcetypeid_clear = true THEN NULL ELSE COALESCE(p_leadsourcetypeid, NULL) END,
                CASE WHEN p_campaignid_clear = true THEN NULL ELSE COALESCE(p_campaignid, NULL) END,
                CASE WHEN p_contractid_clear = true THEN NULL ELSE COALESCE(p_contractid, NULL) END,
                CASE WHEN p_renewscontractid_clear = true THEN NULL ELSE COALESCE(p_renewscontractid, NULL) END,
                COALESCE(p_autorenew, FALSE),
                CASE WHEN p_annualincreasepctoverride_clear = true THEN NULL ELSE COALESCE(p_annualincreasepctoverride, NULL) END,
                CASE WHEN p_cancellationnoticedaysoverride_clear = true THEN NULL ELSE COALESCE(p_cancellationnoticedaysoverride, NULL) END,
                CASE WHEN p_paymentmethod_clear = true THEN NULL ELSE COALESCE(p_paymentmethod, 'ACH') END,
                COALESCE(p_standardagreementmodified, FALSE),
                CASE WHEN p_contractvariances_clear = true THEN NULL ELSE COALESCE(p_contractvariances, NULL) END,
                CASE WHEN p_description_clear = true THEN NULL ELSE COALESCE(p_description, NULL) END,
                CASE WHEN p_nextstep_clear = true THEN NULL ELSE COALESCE(p_nextstep, NULL) END,
                CASE WHEN p_nextstepdate_clear = true THEN NULL ELSE COALESCE(p_nextstepdate, NULL) END,
                CASE WHEN p_closedat_clear = true THEN NULL ELSE COALESCE(p_closedat, NULL) END,
                CASE WHEN p_closedbyuserid_clear = true THEN NULL ELSE COALESCE(p_closedbyuserid, NULL) END,
                CASE WHEN p_orderid_clear = true THEN NULL ELSE COALESCE(p_orderid, NULL) END,
                CASE WHEN p_predictedwinprobability_clear = true THEN NULL ELSE COALESCE(p_predictedwinprobability, NULL) END,
                CASE WHEN p_predictedwinriskband_clear = true THEN NULL ELSE COALESCE(p_predictedwinriskband, NULL) END,
                CASE WHEN p_predictedwinscoredat_clear = true THEN NULL ELSE COALESCE(p_predictedwinscoredat, NULL) END
        )
    ;

    RETURN QUERY
    SELECT * FROM "__mj_bizappssales"."vwDeals"
    WHERE "ID" = v_new_id;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spCreateDeal" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spCreateDeal" TO "cdp_Integration";


-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deals
-- Item: spUpdateDeal
-- ============================================================

------------------------------------------------------------
----- UPDATE FUNCTION FOR Deal
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spUpdateDeal'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spUpdateDeal"(
    p_id UUID,
    p_dealnumber_clear boolean DEFAULT false,
    p_dealnumber varchar(50) DEFAULT NULL,
    p_name varchar(500) DEFAULT NULL,
    p_pipelineid UUID DEFAULT NULL,
    p_pipelinestageid_clear boolean DEFAULT false,
    p_pipelinestageid UUID DEFAULT NULL,
    p_dealtypeid_clear boolean DEFAULT false,
    p_dealtypeid UUID DEFAULT NULL,
    p_dealstatustypeid_clear boolean DEFAULT false,
    p_dealstatustypeid UUID DEFAULT NULL,
    p_accountid_clear boolean DEFAULT false,
    p_accountid UUID DEFAULT NULL,
    p_primarycontactid_clear boolean DEFAULT false,
    p_primarycontactid UUID DEFAULT NULL,
    p_billingcontactid_clear boolean DEFAULT false,
    p_billingcontactid UUID DEFAULT NULL,
    p_companyid UUID DEFAULT NULL,
    p_owneremployeeid_clear boolean DEFAULT false,
    p_owneremployeeid UUID DEFAULT NULL,
    p_amount_clear boolean DEFAULT false,
    p_amount decimal(19, 4) DEFAULT NULL,
    p_amountiscomputed BOOLEAN DEFAULT NULL,
    p_amountcomputedat_clear boolean DEFAULT false,
    p_amountcomputedat TIMESTAMPTZ DEFAULT NULL,
    p_amountsourcehash_clear boolean DEFAULT false,
    p_amountsourcehash varchar(128) DEFAULT NULL,
    p_currencyid_clear boolean DEFAULT false,
    p_currencyid UUID DEFAULT NULL,
    p_mrr_clear boolean DEFAULT false,
    p_mrr decimal(19, 4) DEFAULT NULL,
    p_arr_clear boolean DEFAULT false,
    p_arr decimal(19, 4) DEFAULT NULL,
    p_termmonths_clear boolean DEFAULT false,
    p_termmonths int DEFAULT NULL,
    p_estimatedprojectweeks_clear boolean DEFAULT false,
    p_estimatedprojectweeks int DEFAULT NULL,
    p_executiondate_clear boolean DEFAULT false,
    p_executiondate date DEFAULT NULL,
    p_startdate_clear boolean DEFAULT false,
    p_startdate date DEFAULT NULL,
    p_expectedclosedate_clear boolean DEFAULT false,
    p_expectedclosedate date DEFAULT NULL,
    p_actualclosedate_clear boolean DEFAULT false,
    p_actualclosedate date DEFAULT NULL,
    p_probability_clear boolean DEFAULT false,
    p_probability decimal(5, 2) DEFAULT NULL,
    p_forecastcategorytypeid_clear boolean DEFAULT false,
    p_forecastcategorytypeid UUID DEFAULT NULL,
    p_lossreasonid_clear boolean DEFAULT false,
    p_lossreasonid UUID DEFAULT NULL,
    p_lossnotes_clear boolean DEFAULT false,
    p_lossnotes TEXT DEFAULT NULL,
    p_leadsourcetypeid_clear boolean DEFAULT false,
    p_leadsourcetypeid UUID DEFAULT NULL,
    p_campaignid_clear boolean DEFAULT false,
    p_campaignid UUID DEFAULT NULL,
    p_contractid_clear boolean DEFAULT false,
    p_contractid UUID DEFAULT NULL,
    p_renewscontractid_clear boolean DEFAULT false,
    p_renewscontractid UUID DEFAULT NULL,
    p_autorenew BOOLEAN DEFAULT NULL,
    p_annualincreasepctoverride_clear boolean DEFAULT false,
    p_annualincreasepctoverride decimal(5, 2) DEFAULT NULL,
    p_cancellationnoticedaysoverride_clear boolean DEFAULT false,
    p_cancellationnoticedaysoverride int DEFAULT NULL,
    p_paymentmethod_clear boolean DEFAULT false,
    p_paymentmethod varchar(50) DEFAULT NULL,
    p_standardagreementmodified BOOLEAN DEFAULT NULL,
    p_contractvariances_clear boolean DEFAULT false,
    p_contractvariances TEXT DEFAULT NULL,
    p_description_clear boolean DEFAULT false,
    p_description TEXT DEFAULT NULL,
    p_nextstep_clear boolean DEFAULT false,
    p_nextstep varchar(1000) DEFAULT NULL,
    p_nextstepdate_clear boolean DEFAULT false,
    p_nextstepdate date DEFAULT NULL,
    p_closedat_clear boolean DEFAULT false,
    p_closedat TIMESTAMPTZ DEFAULT NULL,
    p_closedbyuserid_clear boolean DEFAULT false,
    p_closedbyuserid UUID DEFAULT NULL,
    p_orderid_clear boolean DEFAULT false,
    p_orderid UUID DEFAULT NULL,
    p_predictedwinprobability_clear boolean DEFAULT false,
    p_predictedwinprobability decimal(5, 4) DEFAULT NULL,
    p_predictedwinriskband_clear boolean DEFAULT false,
    p_predictedwinriskband varchar(20) DEFAULT NULL,
    p_predictedwinscoredat_clear boolean DEFAULT false,
    p_predictedwinscoredat TIMESTAMPTZ DEFAULT NULL
) RETURNS SETOF "__mj_bizappssales"."vwDeals" AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE "__mj_bizappssales"."Deal"
    SET
        "DealNumber" = CASE WHEN p_dealnumber_clear = true THEN NULL ELSE COALESCE(p_dealnumber, "DealNumber") END,
        "Name" = COALESCE(p_name, "Name"),
        "PipelineID" = COALESCE(p_pipelineid, "PipelineID"),
        "PipelineStageID" = CASE WHEN p_pipelinestageid_clear = true THEN NULL ELSE COALESCE(p_pipelinestageid, "PipelineStageID") END,
        "DealTypeID" = CASE WHEN p_dealtypeid_clear = true THEN NULL ELSE COALESCE(p_dealtypeid, "DealTypeID") END,
        "DealStatusTypeID" = CASE WHEN p_dealstatustypeid_clear = true THEN NULL ELSE COALESCE(p_dealstatustypeid, "DealStatusTypeID") END,
        "AccountID" = CASE WHEN p_accountid_clear = true THEN NULL ELSE COALESCE(p_accountid, "AccountID") END,
        "PrimaryContactID" = CASE WHEN p_primarycontactid_clear = true THEN NULL ELSE COALESCE(p_primarycontactid, "PrimaryContactID") END,
        "BillingContactID" = CASE WHEN p_billingcontactid_clear = true THEN NULL ELSE COALESCE(p_billingcontactid, "BillingContactID") END,
        "CompanyID" = COALESCE(p_companyid, "CompanyID"),
        "OwnerEmployeeID" = CASE WHEN p_owneremployeeid_clear = true THEN NULL ELSE COALESCE(p_owneremployeeid, "OwnerEmployeeID") END,
        "Amount" = CASE WHEN p_amount_clear = true THEN NULL ELSE COALESCE(p_amount, "Amount") END,
        "AmountIsComputed" = COALESCE(p_amountiscomputed, "AmountIsComputed"),
        "AmountComputedAt" = CASE WHEN p_amountcomputedat_clear = true THEN NULL ELSE COALESCE(p_amountcomputedat, "AmountComputedAt") END,
        "AmountSourceHash" = CASE WHEN p_amountsourcehash_clear = true THEN NULL ELSE COALESCE(p_amountsourcehash, "AmountSourceHash") END,
        "CurrencyID" = CASE WHEN p_currencyid_clear = true THEN NULL ELSE COALESCE(p_currencyid, "CurrencyID") END,
        "MRR" = CASE WHEN p_mrr_clear = true THEN NULL ELSE COALESCE(p_mrr, "MRR") END,
        "ARR" = CASE WHEN p_arr_clear = true THEN NULL ELSE COALESCE(p_arr, "ARR") END,
        "TermMonths" = CASE WHEN p_termmonths_clear = true THEN NULL ELSE COALESCE(p_termmonths, "TermMonths") END,
        "EstimatedProjectWeeks" = CASE WHEN p_estimatedprojectweeks_clear = true THEN NULL ELSE COALESCE(p_estimatedprojectweeks, "EstimatedProjectWeeks") END,
        "ExecutionDate" = CASE WHEN p_executiondate_clear = true THEN NULL ELSE COALESCE(p_executiondate, "ExecutionDate") END,
        "StartDate" = CASE WHEN p_startdate_clear = true THEN NULL ELSE COALESCE(p_startdate, "StartDate") END,
        "ExpectedCloseDate" = CASE WHEN p_expectedclosedate_clear = true THEN NULL ELSE COALESCE(p_expectedclosedate, "ExpectedCloseDate") END,
        "ActualCloseDate" = CASE WHEN p_actualclosedate_clear = true THEN NULL ELSE COALESCE(p_actualclosedate, "ActualCloseDate") END,
        "Probability" = CASE WHEN p_probability_clear = true THEN NULL ELSE COALESCE(p_probability, "Probability") END,
        "ForecastCategoryTypeID" = CASE WHEN p_forecastcategorytypeid_clear = true THEN NULL ELSE COALESCE(p_forecastcategorytypeid, "ForecastCategoryTypeID") END,
        "LossReasonID" = CASE WHEN p_lossreasonid_clear = true THEN NULL ELSE COALESCE(p_lossreasonid, "LossReasonID") END,
        "LossNotes" = CASE WHEN p_lossnotes_clear = true THEN NULL ELSE COALESCE(p_lossnotes, "LossNotes") END,
        "LeadSourceTypeID" = CASE WHEN p_leadsourcetypeid_clear = true THEN NULL ELSE COALESCE(p_leadsourcetypeid, "LeadSourceTypeID") END,
        "CampaignID" = CASE WHEN p_campaignid_clear = true THEN NULL ELSE COALESCE(p_campaignid, "CampaignID") END,
        "ContractID" = CASE WHEN p_contractid_clear = true THEN NULL ELSE COALESCE(p_contractid, "ContractID") END,
        "RenewsContractID" = CASE WHEN p_renewscontractid_clear = true THEN NULL ELSE COALESCE(p_renewscontractid, "RenewsContractID") END,
        "AutoRenew" = COALESCE(p_autorenew, "AutoRenew"),
        "AnnualIncreasePctOverride" = CASE WHEN p_annualincreasepctoverride_clear = true THEN NULL ELSE COALESCE(p_annualincreasepctoverride, "AnnualIncreasePctOverride") END,
        "CancellationNoticeDaysOverride" = CASE WHEN p_cancellationnoticedaysoverride_clear = true THEN NULL ELSE COALESCE(p_cancellationnoticedaysoverride, "CancellationNoticeDaysOverride") END,
        "PaymentMethod" = CASE WHEN p_paymentmethod_clear = true THEN NULL ELSE COALESCE(p_paymentmethod, "PaymentMethod") END,
        "StandardAgreementModified" = COALESCE(p_standardagreementmodified, "StandardAgreementModified"),
        "ContractVariances" = CASE WHEN p_contractvariances_clear = true THEN NULL ELSE COALESCE(p_contractvariances, "ContractVariances") END,
        "Description" = CASE WHEN p_description_clear = true THEN NULL ELSE COALESCE(p_description, "Description") END,
        "NextStep" = CASE WHEN p_nextstep_clear = true THEN NULL ELSE COALESCE(p_nextstep, "NextStep") END,
        "NextStepDate" = CASE WHEN p_nextstepdate_clear = true THEN NULL ELSE COALESCE(p_nextstepdate, "NextStepDate") END,
        "ClosedAt" = CASE WHEN p_closedat_clear = true THEN NULL ELSE COALESCE(p_closedat, "ClosedAt") END,
        "ClosedByUserID" = CASE WHEN p_closedbyuserid_clear = true THEN NULL ELSE COALESCE(p_closedbyuserid, "ClosedByUserID") END,
        "OrderID" = CASE WHEN p_orderid_clear = true THEN NULL ELSE COALESCE(p_orderid, "OrderID") END,
        "PredictedWinProbability" = CASE WHEN p_predictedwinprobability_clear = true THEN NULL ELSE COALESCE(p_predictedwinprobability, "PredictedWinProbability") END,
        "PredictedWinRiskBand" = CASE WHEN p_predictedwinriskband_clear = true THEN NULL ELSE COALESCE(p_predictedwinriskband, "PredictedWinRiskBand") END,
        "PredictedWinScoredAt" = CASE WHEN p_predictedwinscoredat_clear = true THEN NULL ELSE COALESCE(p_predictedwinscoredat, "PredictedWinScoredAt") END
    WHERE
        "ID" = p_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        -- Nothing was updated, return empty result set
        RETURN;
    END IF;

    -- Return the updated record from the base view
    RETURN QUERY
    SELECT * FROM "__mj_bizappssales"."vwDeals"
    WHERE "ID" = p_id;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spUpdateDeal" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spUpdateDeal" TO "cdp_Integration";


------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the Deal table
------------------------------------------------------------
CREATE OR REPLACE FUNCTION "__mj_bizappssales"."fn_trg_update_deal"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."__mj_UpdatedAt" := NOW() AT TIME ZONE 'UTC';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_update_deal" ON "__mj_bizappssales"."Deal";

CREATE TRIGGER "trg_update_deal"
BEFORE UPDATE ON "__mj_bizappssales"."Deal"
FOR EACH ROW
EXECUTE FUNCTION "__mj_bizappssales"."fn_trg_update_deal"();



-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deals
-- Item: spDeleteDeal
-- ============================================================

------------------------------------------------------------
----- DELETE FUNCTION FOR Deal
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spDeleteDeal'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spDeleteDeal"(
    p_id UUID
) RETURNS TABLE("ID" UUID) AS $$
#variable_conflict use_column
DECLARE
    v_affected_count INTEGER;
BEGIN

    DELETE FROM "__mj_bizappssales"."Deal"
    WHERE "ID" = p_id;

    GET DIAGNOSTICS v_affected_count = ROW_COUNT;

    IF v_affected_count = 0 THEN
        RETURN QUERY SELECT NULL::UUID AS "ID";
    ELSE
        RETURN QUERY SELECT p_id AS "ID";
    END IF;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spDeleteDeal" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spDeleteDeal" TO "cdp_Integration";
