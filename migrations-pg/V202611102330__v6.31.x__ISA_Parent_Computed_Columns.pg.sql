-- ============================================================================
-- MemberJunction PostgreSQL Migration
-- Converted from SQL Server using TypeScript conversion pipeline
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schema
--
-- The schema name is emitted UNQUOTED, so PostgreSQL folds it to lowercase. That is deliberate and
-- self-consistent: everything downstream in a converted migration refers to it unquoted too, so
-- both definition and lookup land on the same folded name.
--
-- DOWNSTREAM NOTE for the build engineer: a PostgreSQL database that was populated by an EARLIER
-- converter — one that emitted a quoted, case-preserved name — already holds that mixed-case
-- schema: for a target named MySchema_Name, the quoted "MySchema_Name". Re-converting against
-- that database creates a SECOND, empty schema myschema_name rather than reusing the existing
-- one, because IF NOT EXISTS compares the folded name and finds no match. The repo's own committed
-- migrations-pg files are unaffected (the only quoted CREATE SCHEMAs there are the four pg_dump
-- baselines, which this path does not produce), so this is an open-app / downstream concern, not
-- one for this repo's Flyway history.
CREATE SCHEMA IF NOT EXISTS __mj_BizAppsSales;
SET search_path TO __mj_BizAppsSales, public;

-- Ensure backslashes in string literals are treated literally (not as escape sequences)
SET standard_conforming_strings = on;

-- NOTE: Earlier converter versions made INTEGER to BOOLEAN cast implicit by
-- modifying the system catalog so SS-style INSERT INTO bool_col VALUES (1)
-- would work. That modification required pg_catalog write privileges, which
-- managed PG (RDS, Aurora, Cloud SQL, Azure) does not grant. As of v5.30 all
-- bulk INSERTs are emitted with native TRUE/FALSE values directly, so the
-- cast modification is no longer needed. Removed to support managed-PG
-- installs out of the box.


-- ===================== DDL: Tables, PKs, Indexes =====================

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SalesAccount_OwnerEmployeeID" ON __mj_BizAppsSales."SalesAccount" ("OwnerEmployeeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SalesAccount_AccountTypeID" ON __mj_BizAppsSales."SalesAccount" ("AccountTypeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SalesAccount_LifecycleStageTypeID" ON __mj_BizAppsSales."SalesAccount" ("LifecycleStageTypeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SalesAccount_LeadSourceTypeID" ON __mj_BizAppsSales."SalesAccount" ("LeadSourceTypeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SalesAccount_DefaultPrimaryContactID" ON __mj_BizAppsSales."SalesAccount" ("DefaultPrimaryContactID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SalesAccount_DefaultBillingContactID" ON __mj_BizAppsSales."SalesAccount" ("DefaultBillingContactID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SalesContact_OwnerEmployeeID" ON __mj_BizAppsSales."SalesContact" ("OwnerEmployeeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SalesContact_LifecycleStageTypeID" ON __mj_BizAppsSales."SalesContact" ("LifecycleStageTypeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SalesContact_BuyingRoleTypeID" ON __mj_BizAppsSales."SalesContact" ("BuyingRoleTypeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SalesContact_LeadSourceTypeID" ON __mj_BizAppsSales."SalesContact" ("LeadSourceTypeID");


-- ===================== Views =====================

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsSales';
  v_target_name CONSTANT TEXT := 'vwSalesAccounts';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW __mj_BizAppsSales."vwSalesAccounts"
AS SELECT
    s.*,
    __mj_isa_p1."Name",
    __mj_isa_p1."LegalName",
    __mj_isa_p1."OrganizationTypeID",
    __mj_isa_p1."ParentID",
    __mj_isa_p1."Website",
    __mj_isa_p1."LogoURL",
    __mj_isa_p1."Description",
    __mj_isa_p1."Email",
    __mj_isa_p1."Phone",
    __mj_isa_p1."FoundedDate",
    __mj_isa_p1."TaxID",
    __mj_isa_p1."Status",
    __mj_isa_p1."WebsiteDomain",
    __mj_isa_p1."Acronym",
    "MJEmployee_OwnerEmployeeID"."FirstLast" AS "OwnerEmployee",
    "mjBizAppsSalesAccountType_AccountTypeID"."Name" AS "AccountType",
    "mjBizAppsSalesLifecycleStageType_LifecycleStageTypeID"."Name" AS "LifecycleStageType",
    "mjBizAppsSalesLeadSourceType_LeadSourceTypeID"."Name" AS "LeadSourceType",
    "mjBizAppsSalesSalesContact_DefaultPrimaryContactID"."DisplayNameAndEmail" AS "DefaultPrimaryContact",
    "mjBizAppsSalesSalesContact_DefaultBillingContactID"."DisplayNameAndEmail" AS "DefaultBillingContact"
FROM
    __mj_BizAppsSales."SalesAccount" AS s
INNER JOIN
    __mj_BizAppsCommon."Organization" AS __mj_isa_p1
  ON
    s."ID" = __mj_isa_p1."ID"
LEFT OUTER JOIN
    ${mjSchema}."vwEmployees" AS "MJEmployee_OwnerEmployeeID"
  ON
    s."OwnerEmployeeID" = "MJEmployee_OwnerEmployeeID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsSales."AccountType" AS "mjBizAppsSalesAccountType_AccountTypeID"
  ON
    s."AccountTypeID" = "mjBizAppsSalesAccountType_AccountTypeID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsSales."LifecycleStageType" AS "mjBizAppsSalesLifecycleStageType_LifecycleStageTypeID"
  ON
    s."LifecycleStageTypeID" = "mjBizAppsSalesLifecycleStageType_LifecycleStageTypeID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsSales."LeadSourceType" AS "mjBizAppsSalesLeadSourceType_LeadSourceTypeID"
  ON
    s."LeadSourceTypeID" = "mjBizAppsSalesLeadSourceType_LeadSourceTypeID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsSales."vwSalesContacts" AS "mjBizAppsSalesSalesContact_DefaultPrimaryContactID"
  ON
    s."DefaultPrimaryContactID" = "mjBizAppsSalesSalesContact_DefaultPrimaryContactID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsSales."vwSalesContacts" AS "mjBizAppsSalesSalesContact_DefaultBillingContactID"
  ON
    s."DefaultBillingContactID" = "mjBizAppsSalesSalesContact_DefaultBillingContactID"."ID"$vsql$;
  v_target_oid OID;
  v_dep RECORD;
  v_captured JSONB[] := ARRAY[]::JSONB[];
  v_n INTEGER;
BEGIN
  EXECUTE vsql;
EXCEPTION WHEN invalid_table_definition THEN
  -- Column list changed; need CASCADE. Preserve dependent views first.
  SELECT c.oid INTO v_target_oid
  FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = v_target_schema AND c.relname = v_target_name AND c.relkind = 'v';
  IF v_target_oid IS NOT NULL THEN
    FOR v_dep IN
      WITH RECURSIVE deps AS (
        SELECT c.oid, c.relname AS name, n.nspname AS schema, 1 AS depth
        FROM pg_rewrite r
        JOIN pg_depend d ON d.objid = r.oid
        JOIN pg_class c ON c.oid = r.ev_class
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE d.refobjid = v_target_oid AND d.deptype = 'n'
          AND c.oid <> v_target_oid AND c.relkind = 'v'
        UNION
        SELECT c.oid, c.relname, n.nspname, p.depth + 1
        FROM deps p
        JOIN pg_rewrite r ON TRUE
        JOIN pg_depend d ON d.objid = r.oid AND d.refobjid = p.oid
        JOIN pg_class c ON c.oid = r.ev_class
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE c.relkind = 'v' AND c.oid <> p.oid
      )
      SELECT oid, name, schema, MAX(depth) AS max_depth,
             pg_catalog.pg_get_viewdef(oid, true) AS viewdef
      FROM deps GROUP BY oid, name, schema
      ORDER BY MAX(depth) ASC
    LOOP
      v_captured := v_captured || jsonb_build_object(
        'schema', v_dep.schema, 'name', v_dep.name, 'def', v_dep.viewdef);
    END LOOP;
  END IF;
  EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', v_target_schema, v_target_name);
  EXECUTE vsql;
  IF v_captured IS NOT NULL AND array_length(v_captured, 1) > 0 THEN
    FOR v_n IN 1..array_length(v_captured, 1) LOOP
      BEGIN
        EXECUTE format('CREATE VIEW %I.%I AS %s',
          v_captured[v_n]->>'schema', v_captured[v_n]->>'name', v_captured[v_n]->>'def');
      EXCEPTION WHEN others THEN
        RAISE WARNING 'Could not restore dependent view %.%: %',
          v_captured[v_n]->>'schema', v_captured[v_n]->>'name', SQLERRM;
      END;
    END LOOP;
  END IF;
END;
$do$;

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsSales';
  v_target_name CONSTANT TEXT := 'vwSalesContactsGenerated';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW __mj_BizAppsSales."vwSalesContactsGenerated"
AS SELECT
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
    __mj_isa_p1."SeniorityLevelID",
    __mj_isa_p1."DisplayName",
    __mj_isa_p1."EmailDomain",
    "MJEmployee_OwnerEmployeeID"."FirstLast" AS "OwnerEmployee",
    "mjBizAppsSalesLifecycleStageType_LifecycleStageTypeID"."Name" AS "LifecycleStageType",
    "mjBizAppsSalesBuyingRoleType_BuyingRoleTypeID"."Name" AS "BuyingRoleType",
    "mjBizAppsSalesLeadSourceType_LeadSourceTypeID"."Name" AS "LeadSourceType"
FROM
    __mj_BizAppsSales."SalesContact" AS s
INNER JOIN
    __mj_BizAppsCommon."Person" AS __mj_isa_p1
  ON
    s."ID" = __mj_isa_p1."ID"
LEFT OUTER JOIN
    ${mjSchema}."vwEmployees" AS "MJEmployee_OwnerEmployeeID"
  ON
    s."OwnerEmployeeID" = "MJEmployee_OwnerEmployeeID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsSales."LifecycleStageType" AS "mjBizAppsSalesLifecycleStageType_LifecycleStageTypeID"
  ON
    s."LifecycleStageTypeID" = "mjBizAppsSalesLifecycleStageType_LifecycleStageTypeID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsSales."BuyingRoleType" AS "mjBizAppsSalesBuyingRoleType_BuyingRoleTypeID"
  ON
    s."BuyingRoleTypeID" = "mjBizAppsSalesBuyingRoleType_BuyingRoleTypeID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsSales."LeadSourceType" AS "mjBizAppsSalesLeadSourceType_LeadSourceTypeID"
  ON
    s."LeadSourceTypeID" = "mjBizAppsSalesLeadSourceType_LeadSourceTypeID"."ID"$vsql$;
  v_target_oid OID;
  v_dep RECORD;
  v_captured JSONB[] := ARRAY[]::JSONB[];
  v_n INTEGER;
BEGIN
  EXECUTE vsql;
EXCEPTION WHEN invalid_table_definition THEN
  -- Column list changed; need CASCADE. Preserve dependent views first.
  SELECT c.oid INTO v_target_oid
  FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = v_target_schema AND c.relname = v_target_name AND c.relkind = 'v';
  IF v_target_oid IS NOT NULL THEN
    FOR v_dep IN
      WITH RECURSIVE deps AS (
        SELECT c.oid, c.relname AS name, n.nspname AS schema, 1 AS depth
        FROM pg_rewrite r
        JOIN pg_depend d ON d.objid = r.oid
        JOIN pg_class c ON c.oid = r.ev_class
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE d.refobjid = v_target_oid AND d.deptype = 'n'
          AND c.oid <> v_target_oid AND c.relkind = 'v'
        UNION
        SELECT c.oid, c.relname, n.nspname, p.depth + 1
        FROM deps p
        JOIN pg_rewrite r ON TRUE
        JOIN pg_depend d ON d.objid = r.oid AND d.refobjid = p.oid
        JOIN pg_class c ON c.oid = r.ev_class
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE c.relkind = 'v' AND c.oid <> p.oid
      )
      SELECT oid, name, schema, MAX(depth) AS max_depth,
             pg_catalog.pg_get_viewdef(oid, true) AS viewdef
      FROM deps GROUP BY oid, name, schema
      ORDER BY MAX(depth) ASC
    LOOP
      v_captured := v_captured || jsonb_build_object(
        'schema', v_dep.schema, 'name', v_dep.name, 'def', v_dep.viewdef);
    END LOOP;
  END IF;
  EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', v_target_schema, v_target_name);
  EXECUTE vsql;
  IF v_captured IS NOT NULL AND array_length(v_captured, 1) > 0 THEN
    FOR v_n IN 1..array_length(v_captured, 1) LOOP
      BEGIN
        EXECUTE format('CREATE VIEW %I.%I AS %s',
          v_captured[v_n]->>'schema', v_captured[v_n]->>'name', v_captured[v_n]->>'def');
      EXCEPTION WHEN others THEN
        RAISE WARNING 'Could not restore dependent view %.%: %',
          v_captured[v_n]->>'schema', v_captured[v_n]->>'name', SQLERRM;
      END;
    END LOOP;
  END IF;
END;
$do$;


-- ===================== Stored Procedures (sp*) =====================

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spCreateDealStageEvent]
--     @ID UUID = NULL,
--     @DealID UUID,
--     @FromStageID_Clear bit = 0,
--     @FromStageID UUID = NULL,
--  ...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spCreateForecastSnapshot]
--     @ID UUID = NULL,
--     @CompanyID UUID,
--     @PipelineID_Clear bit = 0,
--     @PipelineID UUID = NULL...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spCreateSalesAccount]
--     @ID UUID = NULL,
--     @OwnerEmployeeID_Clear bit = 0,
--     @OwnerEmployeeID UUID = NULL,
--     @AccountTypeID_Clear ...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spUpdateSalesAccount]
--     @ID UUID,
--     @OwnerEmployeeID_Clear bit = 0,
--     @OwnerEmployeeID UUID = NULL,
--     @AccountTypeID_Clear bit = 0...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spCreateSalesContact]
--     @ID UUID = NULL,
--     @OwnerEmployeeID_Clear bit = 0,
--     @OwnerEmployeeID UUID = NULL,
--     @LifecycleStageTypeID...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spUpdateSalesContact]
--     @ID UUID,
--     @OwnerEmployeeID_Clear bit = 0,
--     @OwnerEmployeeID UUID = NULL,
--     @LifecycleStageTypeID_Clear ...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spDeleteSalesAccount]
--     @ID UUID
-- AS
-- BEGIN
--     SET NOCOUNT ON;
-- 
--     DELETE FROM
--         [__mj_BizAppsSales].[SalesAccount]
--     WHERE
--         [ID] = @...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spDeleteSalesContact]
--     @ID UUID
-- AS
-- BEGIN
--     SET NOCOUNT ON;
-- 
--     DELETE FROM
--         [__mj_BizAppsSales].[SalesContact]
--     WHERE
--         [ID] = @...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spCreatePipelineStage]
--     @ID UUID = NULL,
--     @PipelineID UUID,
--     @Name VARCHAR(200),
--     @Code VARCHAR(40),
--     @DisplayOrder INTEGER =...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spUpdatePipelineStage]
--     @ID UUID,
--     @PipelineID UUID = NULL,
--     @Name VARCHAR(200) = NULL,
--     @Code VARCHAR(40) = NULL,
--     @Disp...


-- ===================== Triggers =====================

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsSales].trgUpdateSalesAccount
ON "__mj_BizAppsSales"."SalesAccount"
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        "__mj_BizAppsSales"."SalesAccount"
    SET
 

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsSales].trgUpdateSalesContact
ON "__mj_BizAppsSales"."SalesContact"
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        "__mj_BizAppsSales"."SalesContact"
    SET
 

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsSales].trgUpdatePipelineStage
ON "__mj_BizAppsSales"."PipelineStage"
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        "__mj_BizAppsSales"."PipelineStage"
    SE


-- ===================== Data (INSERT/UPDATE/DELETE) =====================

UPDATE ${mjSchema}."EntityField"
                  SET "IsVirtual" = TRUE,
                      "Type"='TEXT',
                      "Length"=40,
                      "Precision"=0,
                      "Scale"=0,
                      "AllowsNull" = TRUE,
                      "AllowUpdateAPI" = TRUE,
                      "IncludeRelatedEntityNameFieldInBaseView" = FALSE,
                      "RelatedEntityID"=NULL,
                      "RelatedEntityFieldName"=NULL,
                      "RelatedEntityDisplayType"='Search'
                  WHERE "ID"='6139528B-32AB-4BF5-89C5-FD66070FD897';

/* Update entity timestamp for MJ_BizApps_Sales: Sales Accounts after IS-A field sync */

UPDATE ${mjSchema}."Entity" SET "__mj_UpdatedAt"=NOW() WHERE "ID"='15A9B6F8-9566-4A37-8588-2D00E8F1CB9A';

/* Update IS-A parent field SeniorityLevelID on MJ_BizApps_Sales: Sales Contacts */

UPDATE ${mjSchema}."EntityField"
                  SET "IsVirtual" = TRUE,
                      "Type"='UUID',
                      "Length"=16,
                      "Precision"=0,
                      "Scale"=0,
                      "AllowsNull" = TRUE,
                      "AllowUpdateAPI" = TRUE,
                      "IncludeRelatedEntityNameFieldInBaseView" = FALSE,
                      "RelatedEntityID"='ADCD72CB-B817-4FBC-97A4-80EE770376D1',
                      "RelatedEntityFieldName"='ID',
                      "RelatedEntityDisplayType"='Search'
                  WHERE "ID"='92BE72D3-13E6-4DD2-951B-BCB20EE2C446';

/* Update entity timestamp for MJ_BizApps_Sales: Sales Contacts after IS-A field sync */

UPDATE ${mjSchema}."Entity" SET "__mj_UpdatedAt"=NOW() WHERE "ID"='530174B2-654E-4E14-BF28-3EF29AC9833D';

/* spCreate SQL for MJ_BizApps_Sales: Deal Stage Events */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Stage Events
-- Item: spCreateDealStageEvent
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR DealStageEvent
------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'ee3e9ff7-e253-4c37-88c3-7b319d60d274' OR ("EntityID" = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A' AND "Name" = 'WebsiteDomain')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField"
        (
        "ID",
        "EntityID",
        "Sequence",
        "Name",
        "DisplayName",
        "Description",
        "Type",
        "Length",
        "Precision",
        "Scale",
        "AllowsNull",
        "DefaultValue",
        "AutoIncrement",
        "AllowUpdateAPI",
        "IsVirtual",
        "IsComputed",
        "RelatedEntityID",
        "RelatedEntityFieldName",
        "IsNameField",
        "IncludeInUserSearchAPI",
        "IncludeRelatedEntityNameFieldInBaseView",
        "DefaultInView",
        "IsPrimaryKey",
        "IsUnique",
        "RelatedEntityDisplayType",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES
        (
        'ee3e9ff7-e253-4c37-88c3-7b319d60d274',
        '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A', -- "Entity": "MJ_BizApps_Sales": "Sales" "Accounts"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A'),
        'WebsiteDomain',
        'Website Domain',
        NULL,
        'TEXT',
        510,
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '0ff9e885-4a05-4026-9c02-f62f01b40c6b' OR ("EntityID" = '530174B2-654E-4E14-BF28-3EF29AC9833D' AND "Name" = 'DisplayName')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField"
        (
        "ID",
        "EntityID",
        "Sequence",
        "Name",
        "DisplayName",
        "Description",
        "Type",
        "Length",
        "Precision",
        "Scale",
        "AllowsNull",
        "DefaultValue",
        "AutoIncrement",
        "AllowUpdateAPI",
        "IsVirtual",
        "IsComputed",
        "RelatedEntityID",
        "RelatedEntityFieldName",
        "IsNameField",
        "IncludeInUserSearchAPI",
        "IncludeRelatedEntityNameFieldInBaseView",
        "DefaultInView",
        "IsPrimaryKey",
        "IsUnique",
        "RelatedEntityDisplayType",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES
        (
        '0ff9e885-4a05-4026-9c02-f62f01b40c6b',
        '530174B2-654E-4E14-BF28-3EF29AC9833D', -- "Entity": "MJ_BizApps_Sales": "Sales" "Contacts"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '530174B2-654E-4E14-BF28-3EF29AC9833D'),
        'DisplayName',
        'Display Name',
        NULL,
        'TEXT',
        500,
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'adc2e69b-1094-41d6-be6b-1b0a50abfb58' OR ("EntityID" = '530174B2-654E-4E14-BF28-3EF29AC9833D' AND "Name" = 'EmailDomain')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField"
        (
        "ID",
        "EntityID",
        "Sequence",
        "Name",
        "DisplayName",
        "Description",
        "Type",
        "Length",
        "Precision",
        "Scale",
        "AllowsNull",
        "DefaultValue",
        "AutoIncrement",
        "AllowUpdateAPI",
        "IsVirtual",
        "IsComputed",
        "RelatedEntityID",
        "RelatedEntityFieldName",
        "IsNameField",
        "IncludeInUserSearchAPI",
        "IncludeRelatedEntityNameFieldInBaseView",
        "DefaultInView",
        "IsPrimaryKey",
        "IsUnique",
        "RelatedEntityDisplayType",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES
        (
        'adc2e69b-1094-41d6-be6b-1b0a50abfb58',
        '530174B2-654E-4E14-BF28-3EF29AC9833D', -- "Entity": "MJ_BizApps_Sales": "Sales" "Contacts"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '530174B2-654E-4E14-BF28-3EF29AC9833D'),
        'EmailDomain',
        'Email Domain',
        NULL,
        'TEXT',
        510,
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '4EB983C7-243C-45C3-B800-9A1197FABAC1';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.OwnerEmployeeID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Sales & Engagement',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'D1B8C35F-730E-4421-B45A-A4F7F0C1AC62';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.LifecycleStageTypeID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Sales & Engagement',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '61651CE0-2DFD-4B70-A354-D00089C121B8';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.BuyingRoleTypeID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Sales & Engagement',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '24ACC083-5F20-4C7C-B71A-900A524D42DC';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.LeadSourceTypeID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Sales & Engagement',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'BD342BE3-CA2E-496C-8C8E-6AFF70BC62A9';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.Seniority

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Sales & Engagement',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '8CB81B16-4BC8-4E73-A843-87D6F3742D0F';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.OptedOutOfOutreach

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Communication Preferences',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '241AEC9C-AC07-4332-9FC1-066DFF118497';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.DoNotContactReason

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Communication Preferences',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '6E309FE4-03BC-448E-AC7C-CCF000C490E8';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.LastEngagedAt

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Sales & Engagement',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'B4BA8089-65D5-4B55-8DD7-3570DBE953FB';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.DisplayName

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Sales & Engagement',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '0FF9E885-4A05-4026-9C02-F62F01B40C6B';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.EmailDomain

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Sales & Engagement',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'ADC2E69B-1094-41D6-BE6B-1B0A50ABFB58';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.OwnerEmployee

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Sales & Engagement',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '11E64D89-31B9-4120-B74F-14434B3ACE8E';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.LifecycleStageType

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Sales & Engagement',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '8D266773-DFAE-4986-AF34-02BD9C88EF39';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.BuyingRoleType

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Sales & Engagement',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '18294976-B17B-4AD4-AA15-61757D79F9CE';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.LeadSourceType

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Sales & Engagement',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '8F5C8C1B-32C4-4777-99CF-60791A2FB6DE';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.DisplayNameAndEmail

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Sales & Engagement',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '8E6D443E-F36B-1410-8688-007B559E242F';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.__mj_CreatedAt

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '02633FE9-23FA-44BC-9F5F-74EEDAFBB9DD';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.__mj_UpdatedAt

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '4533EE5C-D5CF-4C4F-96F0-0AFAD5EF44FF';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.FirstName

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'People Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '5879269B-0EAD-4C2C-8917-28A80207B31C';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.LastName

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'People Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '993A5DC1-3015-4D41-97BC-681E32FBFF2A';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.MiddleName

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'People Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '33C7957D-4BC3-43C6-BE31-DFC565038A55';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.Prefix

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'People Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'E49E7157-C3FC-41A1-B7AD-401DBAEFA56E';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.Suffix

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'People Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'CB4FA66C-F721-460D-9B6D-3BBD5C3253A3';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.PreferredName

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'People Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '2A962ACD-E3CD-4A48-A428-C3910689292A';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.Title

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'People Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '5DBABF4B-9D67-46FC-BF7F-BADE089980F8';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.Email

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'People Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '7C662F5A-468E-4715-BBF4-AC39D3EAC44C';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.Phone

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'People Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'A6A8211E-46DE-4E42-808D-411305F0E1F7';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.DateOfBirth

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'People Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '08EBCA68-B1A4-4B99-926F-AB78CF42AA8F';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.Gender

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'People Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'ACB02904-87DD-40EF-B4BB-621C08722A36';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.PhotoURL

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'People Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '859B9BBA-15FC-4D99-8E45-6E53441C277A';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.Bio

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'People Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'AC03153A-8CB8-43BD-A0CC-56CA79E17D68';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.LinkedUserID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'People Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'AA2B7302-83E0-4F32-B204-F5B7D16E283F';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.Status

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'People Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '11F1D8F4-A50C-4B1F-82AE-0184E3B99DC6';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Contacts.SeniorityLevelID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'People Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '92BE72D3-13E6-4DD2-951B-BCB20EE2C446';

/* Set entity icon to fa fa-id-card */

UPDATE ${mjSchema}."Entity"
               SET "Icon" = 'fa fa-id-card', "__mj_UpdatedAt" = NOW()
               WHERE "ID" = '530174B2-654E-4E14-BF28-3EF29AC9833D';

/* Insert FieldCategoryInfo setting for entity */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntitySetting" WHERE "EntityID" = '530174B2-654E-4E14-BF28-3EF29AC9833D' AND "Name" = 'FieldCategoryInfo'
    ) THEN
        INSERT INTO ${mjSchema}."EntitySetting" ("ID", "EntityID", "Name", "Value", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('7295e1e8-4933-58cb-ba2f-a28a8658c462', '530174B2-654E-4E14-BF28-3EF29AC9833D', 'FieldCategoryInfo', '{
        "Communication Preferences": {
        "description": "Preferences regarding outreach and contact restrictions",
        "icon": "fa fa-ban"
        },
        "People Details": {
        "description": "Fields inherited from the People entity representing personal and professional attributes",
        "icon": "fa fa-user",
        "inheritedFromEntityID": "7A94ADA9-7880-4FAE-97D8-DB0E934C3F5F",
        "inheritedFromEntityName": "MJ_BizApps_Common: People"
        },
        "Sales & Engagement": {
        "description": "Sales-specific details, engagement tracking, and role classifications",
        "icon": "fa fa-chart-line"
        },
        "System Metadata": {
        "description": "System-managed audit and tracking fields",
        "icon": "fa fa-cog"
        }
        }', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntitySetting" WHERE "EntityID" = '530174B2-654E-4E14-BF28-3EF29AC9833D' AND "Name" = 'FieldCategoryIcons'
    ) THEN
        INSERT INTO ${mjSchema}."EntitySetting" ("ID", "EntityID", "Name", "Value", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('5ea2c17d-9834-52da-9da5-7d232af250ce', '530174B2-654E-4E14-BF28-3EF29AC9833D', 'FieldCategoryIcons', '{
        "Communication Preferences": "fa fa-ban",
        "People Details": "fa fa-user",
        "Sales & Engagement": "fa fa-chart-line",
        "System Metadata": "fa fa-cog"
        }', NOW(), NOW());
    END IF;
END $$;

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '1AFC3C88-35B4-4EA3-910E-5217F648EE21';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.OwnerEmployeeID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Account Ownership',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '2B55D30F-7FB3-4B63-A268-338C2F129C07';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.OwnerEmployee

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Account Ownership',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '6E592FF2-14B9-4D2A-9DEA-81B6E38788BA';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.Territory

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Account Ownership',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'BCE4A5C9-6599-4BF7-B3E9-A9E5163B5706';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.AccountTypeID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Account Classification',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'E99F61DF-5A33-4DE9-B58A-FAEA31F00307';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.AccountType

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Account Classification',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '89E71D72-A0C8-47E2-B401-5A04189305D6';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.LifecycleStageTypeID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Account Classification',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '6FB01808-E192-4DC3-A7AB-F380B17299B0';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.LifecycleStageType

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Account Classification',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '85E1065E-DC51-430F-A160-D18FC186FFD4';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.LeadSourceTypeID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Account Classification',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'F20F2DD4-555D-487E-B5B7-9D02F36DC73D';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.LeadSourceType

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Account Classification',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '00D97007-4767-4D9C-A16C-F3691F3F85E6';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.Tier

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Account Metrics',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '96E22D90-F144-4CE7-BE21-AC8CE8BC06A3';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.ICPFitScore

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Account Metrics',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '6FE1F901-0ADD-424D-AC09-08C6D39ABDFF';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.IndustryCode

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Account Metrics',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '31545B45-6750-4874-900A-133CEEA4530B';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.EmployeeCountBand

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Account Metrics',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '95B4C59D-FC28-42EF-9767-C77654704F6F';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.AnnualRevenueBand

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Account Metrics',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'DF3CE559-EF38-447E-93A4-A809DDB808B8';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.HealthStatus

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Account Metrics',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'D89BE74B-8C08-4994-8D9D-890B3ACF3F40';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.FirstClosedWonDate

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Account Metrics',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '4004F72B-0BCA-42F4-BB0C-C16621BFC687';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.IsActive

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Account Metrics',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'F44B3B97-F2F7-4847-A589-F0C2CFDFD736';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.DefaultPrimaryContactID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Default Contacts',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'F32701F4-7647-4560-BE0C-990D3ED1DF85';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.DefaultPrimaryContact

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Default Contacts',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'CF73D195-9AB0-4034-84EC-A95C1906895C';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.DefaultBillingContactID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Default Contacts',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'CD977001-3C58-4A59-86BF-EB81AB9EC2FE';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.DefaultBillingContact

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Default Contacts',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '9A978798-796F-4C77-B2E1-2C7255F33BAA';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.WebsiteDomain

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Organizations Details',
   "GeneratedFormSection" = 'Category',
   "ExtendedType" = 'URL'
WHERE 
   "ID" = 'EE3E9FF7-E253-4C37-88C3-7B319D60D274';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.Name

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Organizations Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '5A23C3B3-0797-42C5-A31F-700D7180D826';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.LegalName

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Organizations Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'B150DF9A-29ED-4E22-BF5B-4FEB9C47B6D3';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.OrganizationTypeID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Organizations Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'B7C7DD83-392B-4326-AFF6-9B57C8B29E40';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.ParentID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Organizations Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '35E3A619-36ED-4DCE-AC9C-2F2C22BD7ACB';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.Website

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Organizations Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'E18E12A7-8802-4222-B2E1-492B4B3081B7';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.LogoURL

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Organizations Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'F0D548FE-0F5C-49B8-826C-A7B2BF4B21EB';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.Description

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Organizations Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '52CFD2A5-8F9A-4165-8EB3-B960CFC2F7C8';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.Email

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Organizations Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '0F0D41C8-9268-4898-A20B-EB46AEF161F2';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.Phone

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Organizations Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'EFEA6211-D9C1-47FB-A850-938E58A0A5D2';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.FoundedDate

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Organizations Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'DEC7A434-0264-4C00-9F40-D8E91A153A37';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.TaxID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Organizations Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'BA59DE44-0C12-4918-B8F0-A109894585C4';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.Status

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Organizations Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '94DFA130-60D4-44D5-ABF9-125A219ED586';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.Acronym

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Organizations Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '6139528B-32AB-4BF5-89C5-FD66070FD897';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.__mj_CreatedAt

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '5191DC06-F902-45F7-845C-47E52208B59C';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Sales Accounts.__mj_UpdatedAt

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'BFFE3743-D19F-4C1B-B98F-CB0131912B5E';

/* Set entity icon to fa fa-briefcase */

UPDATE ${mjSchema}."Entity"
               SET "Icon" = 'fa fa-briefcase', "__mj_UpdatedAt" = NOW()
               WHERE "ID" = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A';

/* Insert FieldCategoryInfo setting for entity */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntitySetting" WHERE "EntityID" = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A' AND "Name" = 'FieldCategoryInfo'
    ) THEN
        INSERT INTO ${mjSchema}."EntitySetting" ("ID", "EntityID", "Name", "Value", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('ea759720-2413-5994-8693-ac4411965864', '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A', 'FieldCategoryInfo', '{
        "Account Classification": {
        "description": "Categorization fields including account types, lifecycle stages, and lead sources",
        "icon": "fa fa-tags"
        },
        "Account Metrics": {
        "description": "Quantitative scores, tiers, and health status indicators for the account",
        "icon": "fa fa-chart-line"
        },
        "Account Ownership": {
        "description": "Information regarding account assignment, territory, and ownership",
        "icon": "fa fa-user"
        },
        "Default Contacts": {
        "description": "Default primary and billing contacts associated with new deals for this account",
        "icon": "fa fa-address-card"
        },
        "Organizations Details": {
        "description": "Fields inherited from the Organizations parent entity containing core corporate details",
        "icon": "fa fa-building",
        "inheritedFromEntityID": "C70448F9-9792-41D7-A82C-784B66429D54",
        "inheritedFromEntityName": "MJ_BizApps_Common: Organizations"
        },
        "System Metadata": {
        "description": "System-managed audit and tracking fields",
        "icon": "fa fa-cog"
        }
        }', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntitySetting" WHERE "EntityID" = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A' AND "Name" = 'FieldCategoryIcons'
    ) THEN
        INSERT INTO ${mjSchema}."EntitySetting" ("ID", "EntityID", "Name", "Value", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('4c0c42f1-475d-558c-ac55-4cda729b7de1', '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A', 'FieldCategoryIcons', '{
        "Account Classification": "fa fa-tags",
        "Account Metrics": "fa fa-chart-line",
        "Account Ownership": "fa fa-user",
        "Default Contacts": "fa fa-address-card",
        "Organizations Details": "fa fa-building",
        "System Metadata": "fa fa-cog"
        }', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = '262E0C4C-A814-4850-863A-64CCC28E5964'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('97a54054-286b-4f0a-abd1-5b33c0f948bc', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([Influence] IS NULL OR [Influence]>=(0) AND [Influence]<=(100))', 'public ValidateInfluenceRange(result: ValidationResult) {
        if (this.Influence != null && (this.Influence < 0 || this.Influence > 100)) {
        result.Errors.push(new ValidationErrorInfo(
        "Influence",
        "Influence must be between 0 and 100.",
        this.Influence,
        ValidationErrorType.Failure
        ));
        }
        }', 'Influence score must be between 0 and 100 percent if provided.', 'ValidateInfluenceRange', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', '262E0C4C-A814-4850-863A-64CCC28E5964');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = '9FFB3033-3FC1-420B-90D9-B9F922E4BE0F'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('44e53e83-5ed5-467d-aa50-ab9573cc56d6', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([DefaultAttributionPct] IS NULL OR [DefaultAttributionPct]>=(0) AND [DefaultAttributionPct]<=(100))', 'public ValidateDefaultAttributionPctRange(result: ValidationResult) {
        if (this.DefaultAttributionPct != null && (this.DefaultAttributionPct < 0 || this.DefaultAttributionPct > 100)) {
        result.Errors.push(new ValidationErrorInfo(
        "DefaultAttributionPct",
        "Default attribution percentage must be between 0 and 100.",
        this.DefaultAttributionPct,
        ValidationErrorType.Failure
        ));
        }
        }', 'Default attribution percentage must be between 0 and 100 when provided.', 'ValidateDefaultAttributionPctRange', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', '9FFB3033-3FC1-420B-90D9-B9F922E4BE0F');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = '77300090-4072-4057-943F-9F7EB3DD32B9'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('d8f231cc-bf01-478a-b440-b06e5f631cc5', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([ID]=TRUE)', 'public ValidateIDEqualsOne(result: ValidationResult) {
        if (this.ID !== 1) {
        result.Errors.push(new ValidationErrorInfo(
        "ID",
        "ID must be 1.",
        this.ID,
        ValidationErrorType.Failure
        ));
        }
        }', 'The record ID must always be equal to 1 to ensure a singleton pattern or fixed identifier.', 'ValidateIDEqualsOne', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', '77300090-4072-4057-943F-9F7EB3DD32B9');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = '91AD5C35-1F22-4DD7-881A-1E83F168BB43'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('2fb77fff-e3ca-4bb8-83c2-1292ded50add', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([NextSequenceNumber]>(0))', 'public ValidateNextSequenceNumberGreaterThanZero(result: ValidationResult) {
        if (this.NextSequenceNumber != null && this.NextSequenceNumber <= 0) {
        result.Errors.push(new ValidationErrorInfo(
        "NextSequenceNumber",
        "Next sequence number must be greater than zero.",
        this.NextSequenceNumber,
        ValidationErrorType.Failure
        ));
        }
        }', 'Next sequence number must be greater than zero.', 'ValidateNextSequenceNumberGreaterThanZero', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', '91AD5C35-1F22-4DD7-881A-1E83F168BB43');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = '9DDCE3FC-53BD-4076-A727-50408C538721'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('c1ff81ef-e811-4b24-b423-ec9d3b82adbc', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([DaysInPreviousStage] IS NULL OR [DaysInPreviousStage]>=(0))', 'public ValidateDaysInPreviousStageNonNegative(result: ValidationResult) {
        if (this.DaysInPreviousStage != null && this.DaysInPreviousStage < 0) {
        result.Errors.push(new ValidationErrorInfo(
        "DaysInPreviousStage",
        "Days in previous stage must be zero or greater.",
        this.DaysInPreviousStage,
        ValidationErrorType.Failure
        ));
        }
        }', 'Days in previous stage cannot be negative.', 'ValidateDaysInPreviousStageNonNegative', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', '9DDCE3FC-53BD-4076-A727-50408C538721');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = 'EF449DDC-B5A7-4CAD-A13A-8738625F87C4'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('8e8e02f4-aca9-47df-b63a-d74966e9540e', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([ProbabilityAtTransition] IS NULL OR [ProbabilityAtTransition]>=(0) AND [ProbabilityAtTransition]<=(100))', 'public ValidateProbabilityAtTransitionRange(result: ValidationResult) {
        if (this.ProbabilityAtTransition != null && (this.ProbabilityAtTransition < 0 || this.ProbabilityAtTransition > 100)) {
        result.Errors.push(new ValidationErrorInfo(
        "ProbabilityAtTransition",
        "Probability at transition must be between 0 and 100.",
        this.ProbabilityAtTransition,
        ValidationErrorType.Failure
        ));
        }
        }', 'Probability at transition must be between 0 and 100 percent, if specified.', 'ValidateProbabilityAtTransitionRange', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', 'EF449DDC-B5A7-4CAD-A13A-8738625F87C4');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'E0238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = '27E8D79F-A8E2-4AC1-B208-5A0F11416197' AND "Name" = 'ValidateIsWonAndIsLost'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('68064ace-6203-4ea8-a2f8-dfbad0604e42', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '(NOT ([IsWon]=TRUE AND [IsLost]=TRUE))', 'public ValidateIsWonAndIsLost(result: ValidationResult) {
        if (this.IsWon && this.IsLost) {
        result.Errors.push(new ValidationErrorInfo(
        "IsWon",
        "A stage cannot be marked as both Won and Lost simultaneously.",
        this.IsWon,
        ValidationErrorType.Failure
        ));
        }
        }', 'A deal stage cannot be marked as both won and lost at the same time.', 'ValidateIsWonAndIsLost', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', '27E8D79F-A8E2-4AC1-B208-5A0F11416197');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = '8E8AA967-D5FB-4CF1-BF14-ACCD9018544B'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('357f3db3-5960-4270-a79c-07743f86a1eb', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([AttributionPct] IS NULL OR [AttributionPct]>=(0) AND [AttributionPct]<=(100))', 'public ValidateAttributionPctRange(result: ValidationResult) {
        if (this.AttributionPct != null && (this.AttributionPct < 0 || this.AttributionPct > 100)) {
        result.Errors.push(new ValidationErrorInfo(
        "AttributionPct",
        "Attribution percentage must be between 0 and 100.",
        this.AttributionPct,
        ValidationErrorType.Failure
        ));
        }
        }', 'Attribution percentage must be between 0 and 100 if specified.', 'ValidateAttributionPctRange', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', '8E8AA967-D5FB-4CF1-BF14-ACCD9018544B');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'E0238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = 'A5BC9EE5-4C4E-408B-BB07-3C718227B616' AND "Name" = 'ValidateEmployeeIDOrPersonIDExclusive'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('2ef3b8a5-bb78-4706-a2a7-293c13acec85', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([EmployeeID] IS NOT NULL AND [PersonID] IS NULL OR [EmployeeID] IS NULL AND [PersonID] IS NOT NULL)', '	public ValidateEmployeeIDOrPersonIDExclusive(result: ValidationResult) {
        const hasEmployee = this.EmployeeID != null;
        const hasPerson = this.PersonID != null;
        
        if ((hasEmployee && hasPerson) || (!hasEmployee && !hasPerson)) {
        result.Errors.push(new ValidationErrorInfo(
        "EmployeeID",
        "Exactly one of Employee or Person must be specified.",
        this.EmployeeID,
        ValidationErrorType.Failure
        ));
        }
        }', 'Each record must be assigned to either an employee or a person, but cannot be assigned to both or neither.', 'ValidateEmployeeIDOrPersonIDExclusive', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', 'A5BC9EE5-4C4E-408B-BB07-3C718227B616');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'E0238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = 'A5BC9EE5-4C4E-408B-BB07-3C718227B616' AND "Name" = 'ValidateEndDateAfterStartDate'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('f9f76ded-6e5d-4b4a-8fea-9b79b7081888', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([StartDate] IS NULL OR [EndDate] IS NULL OR [EndDate]>=[StartDate])', 'public ValidateEndDateAfterStartDate(result: ValidationResult) {
        if (this.StartDate != null && this.EndDate != null && this.EndDate < this.StartDate) {
        result.Errors.push(new ValidationErrorInfo(
        "EndDate",
        "End date must be on or after the start date.",
        this.EndDate,
        ValidationErrorType.Failure
        ));
        }
        }', 'End date must be on or after start date.', 'ValidateEndDateAfterStartDate', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', 'A5BC9EE5-4C4E-408B-BB07-3C718227B616');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = '1537BCFD-762B-433F-9BD1-25CE8980CF65'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('a904d4e3-407c-44bd-9d77-9a4b4caa430c', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([AnnualIncreasePctOverride] IS NULL OR [AnnualIncreasePctOverride]>=(0) AND [AnnualIncreasePctOverride]<=(100))', 'public ValidateAnnualIncreasePctOverrideRange(result: ValidationResult) {
        if (this.AnnualIncreasePctOverride != null && (this.AnnualIncreasePctOverride < 0 || this.AnnualIncreasePctOverride > 100)) {
        result.Errors.push(new ValidationErrorInfo(
        "AnnualIncreasePctOverride",
        "Annual increase percentage override must be between 0 and 100.",
        this.AnnualIncreasePctOverride,
        ValidationErrorType.Failure
        ));
        }
        }', 'Annual increase percentage override must be between 0 and 100 percent when specified.', 'ValidateAnnualIncreasePctOverrideRange', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', '1537BCFD-762B-433F-9BD1-25CE8980CF65');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = '31B38196-ED24-47C6-9CC0-E49EB8DF3C9B'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('265019ce-de0d-45c5-98e6-30c48164491c', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([CancellationNoticeDaysOverride] IS NULL OR [CancellationNoticeDaysOverride]>=(0))', 'public ValidateCancellationNoticeDaysOverrideNonNegative(result: ValidationResult): void {
        if (this.CancellationNoticeDaysOverride != null && this.CancellationNoticeDaysOverride < 0) {
        result.Errors.push(new ValidationErrorInfo(
        "CancellationNoticeDaysOverride",
        "Cancellation notice days override must be zero or greater.",
        this.CancellationNoticeDaysOverride,
        ValidationErrorType.Failure
        ));
        }
        }', 'Cancellation notice days override must be zero or a positive number if specified.', 'ValidateCancellationNoticeDaysOverrideNonNegative', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', '31B38196-ED24-47C6-9CC0-E49EB8DF3C9B');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = 'FBE8B02C-D4FF-45A8-B86D-4A3CEA4D49F4'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('b18d6a89-8b3c-4dfd-bb24-4b496f7f55fa', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([EstimatedProjectWeeks] IS NULL OR [EstimatedProjectWeeks]>=(0))', 'public ValidateEstimatedProjectWeeksNonNegative(result: ValidationResult) {
        if (this.EstimatedProjectWeeks != null && this.EstimatedProjectWeeks < 0) {
        result.Errors.push(new ValidationErrorInfo(
        "EstimatedProjectWeeks",
        "Estimated project weeks must be greater than or equal to 0.",
        this.EstimatedProjectWeeks,
        ValidationErrorType.Failure
        ));
        }
        }', 'Estimated project duration in weeks cannot be negative.', 'ValidateEstimatedProjectWeeksNonNegative', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', 'FBE8B02C-D4FF-45A8-B86D-4A3CEA4D49F4');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = 'C0D9A787-0AF2-4158-B5ED-E2BCEC3C84CB'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('72b1b756-aba8-4647-937b-0a300f019aaf', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([Probability] IS NULL OR [Probability]>=(0) AND [Probability]<=(100))', 'public ValidateProbabilityRange(result: ValidationResult): void {
        if (this.Probability != null && (this.Probability < 0 || this.Probability > 100)) {
        result.Errors.push(new ValidationErrorInfo(
        "Probability",
        "Probability must be between 0 and 100.",
        this.Probability,
        ValidationErrorType.Failure
        ));
        }
        }', 'Deal probability must be between 0% and 100% when specified.', 'ValidateProbabilityRange', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', 'C0D9A787-0AF2-4158-B5ED-E2BCEC3C84CB');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = 'B7C9FF2E-788C-44EB-88AA-FF524256EBB6'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('ce254dc7-54e7-4912-8de5-34553f8de3b1', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([TermMonths] IS NULL OR [TermMonths]>=(0))', 'public ValidateTermMonthsNonNegative(result: ValidationResult): void {
        if (this.TermMonths != null && this.TermMonths < 0) {
        result.Errors.push(new ValidationErrorInfo(
        "TermMonths",
        "Term months cannot be negative. Please enter a value of 0 or greater.",
        this.TermMonths,
        ValidationErrorType.Failure
        ));
        }
        }', 'Term months must be zero or a positive number if provided.', 'ValidateTermMonthsNonNegative', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', 'B7C9FF2E-788C-44EB-88AA-FF524256EBB6');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'E0238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = '4697F309-CD43-42DD-A2B5-2747473E5B98' AND "Name" = 'ValidatePeriodEndAfterOrEqualPeriodStart'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('6974f5f1-f02b-468b-ba12-37470e7a68ea', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([PeriodEnd]>=[PeriodStart])', 'public ValidatePeriodEndAfterOrEqualPeriodStart(result: ValidationResult) {
        if (this.PeriodStart != null && this.PeriodEnd != null && new Date(this.PeriodEnd).getTime() < new Date(this.PeriodStart).getTime()) {
        result.Errors.push(new ValidationErrorInfo(
        "PeriodEnd",
        "Period end date must be on or after the period start date.",
        this.PeriodEnd,
        ValidationErrorType.Failure
        ));
        }
        }', 'Period end date must be on or after the period start date.', 'ValidatePeriodEndAfterOrEqualPeriodStart', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', '4697F309-CD43-42DD-A2B5-2747473E5B98');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = '23989190-BD6E-4BE7-803C-D3AF203D4F62'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('1f48c781-d2ff-4375-9bd4-88dd83f50419', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([AttributionWindowDays] IS NULL OR [AttributionWindowDays]>=(0))', 'public ValidateAttributionWindowDaysNonNegative(result: ValidationResult) {
        if (this.AttributionWindowDays != null && this.AttributionWindowDays < 0) {
        result.Errors.push(new ValidationErrorInfo(
        "AttributionWindowDays",
        "Attribution window days must be zero or greater.",
        this.AttributionWindowDays,
        ValidationErrorType.Failure
        ));
        }
        }', 'Attribution window days must be zero or a positive number when specified.', 'ValidateAttributionWindowDaysNonNegative', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', '23989190-BD6E-4BE7-803C-D3AF203D4F62');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = '6DA1263E-15C9-4750-AC5F-779129F61813'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('0a331212-ab3e-45bb-bf57-c498d1dcfef3', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([Probability] IS NULL OR [Probability]>=(0) AND [Probability]<=(100))', 'public ValidateProbabilityRange(result: ValidationResult) {
        if (this.Probability != null && (this.Probability < 0 || this.Probability > 100)) {
        result.Errors.push(new ValidationErrorInfo(
        "Probability",
        "Probability must be between 0 and 100.",
        this.Probability,
        ValidationErrorType.Failure
        ));
        }
        }', 'Probability, if provided, must be a value between 0 and 100 percent.', 'ValidateProbabilityRange', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', '6DA1263E-15C9-4750-AC5F-779129F61813');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = '8F6E7AE3-4DAC-424B-8CF4-5AA99A1CF277'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('c9b6c393-7609-46ce-b58a-178e7a002b94', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([RottingDays] IS NULL OR [RottingDays]>=(0))', 'public ValidateRottingDaysNonNegative(result: ValidationResult) {
        if (this.RottingDays != null && this.RottingDays < 0) {
        result.Errors.push(new ValidationErrorInfo(
        "RottingDays",
        "Rotting days cannot be negative.",
        this.RottingDays,
        ValidationErrorType.Failure
        ));
        }
        }', 'Rotting days must be zero or a positive number when specified.', 'ValidateRottingDaysNonNegative', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', '8F6E7AE3-4DAC-424B-8CF4-5AA99A1CF277');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = '6FE1F901-0ADD-424D-AC09-08C6D39ABDFF'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('a5252fb5-1f16-40e7-93bf-7c6faddf14df', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([ICPFitScore] IS NULL OR [ICPFitScore]>=(0) AND [ICPFitScore]<=(100))', 'public ValidateICPFitScoreRange(result: ValidationResult) {
        if (this.ICPFitScore != null && (this.ICPFitScore < 0 || this.ICPFitScore > 100)) {
        result.Errors.push(new ValidationErrorInfo(
        "ICPFitScore",
        "ICP Fit Score must be between 0 and 100.",
        this.ICPFitScore,
        ValidationErrorType.Failure
        ));
        }
        }', 'ICP Fit Score must be between 0 and 100 if specified.', 'ValidateICPFitScoreRange', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', '6FE1F901-0ADD-424D-AC09-08C6D39ABDFF');
    END IF;
END $$;


-- ===================== Grants =====================

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateDealStageEvent" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateDealStageEvent" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateDealStageEvent" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Sales: Deal Stage Events */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateDealStageEvent" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateDealStageEvent" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateDealStageEvent" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate SQL for MJ_BizApps_Sales: Forecast Snapshots */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Forecast Snapshots
-- Item: spCreateForecastSnapshot
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR ForecastSnapshot
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateForecastSnapshot" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateForecastSnapshot" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateForecastSnapshot" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Sales: Forecast Snapshots */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateForecastSnapshot" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateForecastSnapshot" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateForecastSnapshot" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* Index for Foreign Keys for SalesAccount */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Sales Accounts
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key OwnerEmployeeID in table SalesAccount;

DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsSales."vwSalesAccounts" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsSales."vwSalesAccounts" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsSales."vwSalesAccounts" FROM "cdp_UI"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON __mj_BizAppsSales."vwSalesAccounts" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* Base View Permissions SQL for MJ_BizApps_Sales: Sales Accounts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Sales Accounts
-- Item: Permissions for vwSalesAccounts
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsSales."vwSalesAccounts" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsSales."vwSalesAccounts" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsSales."vwSalesAccounts" FROM "cdp_UI"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON __mj_BizAppsSales."vwSalesAccounts" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateSalesAccount" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateSalesAccount" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateSalesAccount" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Sales: Sales Accounts */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateSalesAccount" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateSalesAccount" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateSalesAccount" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateSalesAccount" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateSalesAccount" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateSalesAccount" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateSalesAccount" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateSalesAccount" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateSalesAccount" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
-----               SCHEMA:      __mj_BizAppsSales
-----               BASE TABLE:  SalesContact
-----               PRIMARY KEY: ID
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateSalesContact" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateSalesContact" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateSalesContact" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Sales: Sales Contacts */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateSalesContact" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateSalesContact" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateSalesContact" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateSalesContact" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateSalesContact" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateSalesContact" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateSalesContact" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateSalesContact" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateSalesContact" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteSalesAccount" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteSalesAccount" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteSalesAccount" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete Permissions for MJ_BizApps_Sales: Sales Accounts */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteSalesAccount" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteSalesAccount" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteSalesAccount" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteSalesContact" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteSalesContact" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteSalesContact" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete Permissions for MJ_BizApps_Sales: Sales Contacts */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteSalesContact" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteSalesContact" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteSalesContact" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate SQL for MJ_BizApps_Sales: Pipeline Stages */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Pipeline Stages
-- Item: spCreatePipelineStage
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR PipelineStage
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreatePipelineStage" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreatePipelineStage" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreatePipelineStage" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Sales: Pipeline Stages */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreatePipelineStage" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreatePipelineStage" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreatePipelineStage" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spUpdate SQL for MJ_BizApps_Sales: Pipeline Stages */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Pipeline Stages
-- Item: spUpdatePipelineStage
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR PipelineStage
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdatePipelineStage" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdatePipelineStage" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdatePipelineStage" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdatePipelineStage" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdatePipelineStage" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdatePipelineStage" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* SQL text to insert 3 new entity field(s) */


-- ===================== Other =====================

-- IS-A parent COMPUTED columns reach the sales subtype views (CodeGen drift capture).
--
-- WHAT THIS IS. Captured CodeGen output, not hand-written SQL. Generated against MJ core v6.2.1 with
-- every sibling app at its 2026-11-10 `next` head, from a database built by applying migrations in
-- dependency order. `mj sync push --dir metadata` ran first, so remote operations generated from
-- metadata rows rather than silently missing.
--
-- WHY THERE IS DRIFT AT ALL. `InheritedParentColumns` (MJ CodeGenLib `sql_codegen.ts`) selects a
-- parent field that is `IsVirtual` AND `IsComputed`, because such a column lives on the parent table.
-- Three qualify and none of them had ever reached this app's views:
--   Organization.WebsiteDomain  (common V202610211654, v5.56.x)
--   Person.EmailDomain          (common V202610211654, v5.56.x)
--   Person.DisplayName          (common V202605131929, redefined V202610151049, PERSISTED NOT NULL)
-- The IS-A parent-field sync that MJ Setup runs does NOT add them: it skips virtual fields. So the
-- columns were absent from this app's views and nothing failed loudly -- they were simply missing,
-- and the next CodeGen run anywhere would have emitted them as uncommitted drift.
--
-- THIS IS NOT #531. That was a PLAIN parent column (Organization.Acronym) registered as an
-- EntityField while the view lacked the column, which failed every save. These three are the
-- opposite shape: no field row, no view column, no failure. Fixed deliberately here rather than
-- being picked up mid-PR by whoever next runs CodeGen for an unrelated change.
--
-- ONE PASS, AND WHY THAT IS WORTH SAYING. A first capture of this same drift took three passes to
-- settle (2626 lines, then 2067, then 884). That churn was not the one-pass lag in KNOWN-ISSUES
-- (KI-7) -- it was a name-field flip rewriting the same views twice. CodeGen's reconciler runs
-- `UPDATE EntityField SET IsNameField = 1 WHERE ID = <its own pick> AND AutoUpdateIsNameField = 1`,
-- which SETS but never CLEARS, so its pick is ADDED alongside a pinned one. Sales Contacts ended up
-- with two fields flagged IsNameField, and the view generator takes the lower Sequence: FirstName at
-- 12 beat the pinned DisplayNameAndEmail at 34. Every denormalized contact-name column in the schema
-- was then regenerated to join FirstName -- SalesContact on Deal Contact Roles, PrimaryContact and
-- BillingContact on Deals, DefaultPrimaryContact and DefaultBillingContact on Sales Accounts --
-- turning VARCHAR(753) into VARCHAR(100) and showing a bare first name on every deal and account
-- surface. It also inverted golive#259 exactly, since that fix is built by SUBTRACTING the name field
-- from the picker's column plan. `metadata/entity-fields/.sales-contact-name-field.json` clears both
-- flags on FirstName so the pin holds on every host; this file was captured with that pin in place,
-- and the reconciler emits no IsNameField write at all. Nothing in the suite asserts on a contact's
-- rendered name, so the broken version regenerated green -- it was caught by reading a
-- @MaxLength(753) -> @MaxLength(100) change in the generated GraphQL schema.
--
-- VERIFIED END STATE on the generating database: vwSalesAccounts.WebsiteDomain,
-- vwSalesContactsGenerated.DisplayName + .EmailDomain, and -- because CodeGen emits
-- `sp_refreshview` for the app-owned `vwSalesContacts` wrapper, which is `SELECT g.*` -- the wrapper
-- carries both new columns too. All 21 sales entities EntityField-count == view-column-count.
-- Sales Accounts 37 -> 38 fields, Sales Contacts 32 -> 34. Exactly one field flagged IsNameField on
-- Sales Contacts, and it is DisplayNameAndEmail. A second CodeGen pass emitted no SQL.
--
-- NO ALTER COLUMN here, so the scoped `spUpdateExistingEntityFieldsFromSchema` call that
-- check-migration-column-sync.mjs requires does not apply. No `spDeleteUnneededEntityFields`.
--

/* Update IS-A parent field Acronym on MJ_BizApps_Sales: Sales Accounts */

/* spUpdate Permissions for MJ_BizApps_Sales: Sales Accounts */

/* Base View Permissions SQL for MJ_BizApps_Sales: Sales Contacts */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Sales Contacts
-- Item: Permissions for vwSalesContacts
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

/* spUpdate Permissions for MJ_BizApps_Sales: Sales Contacts */

/* spUpdate Permissions for MJ_BizApps_Sales: Pipeline Stages */
