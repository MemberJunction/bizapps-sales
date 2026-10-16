-- =============================================================================================
-- PostgreSQL counterpart of V202610151200__v6.15.x__SalesAccount_Default_Contacts.sql
-- =============================================================================================
-- `mj sql-convert --from tsql --to postgres` (MJ CLI 6.1.5) output, finished by hand:
--   * Tables, columns, constraints, indexes, views, data and grants are the converter's.
--   * CodeGen's CRUD procedures (spCreate/spUpdate/spDelete), its __mj_UpdatedAt triggers and any
--     hierarchy functions are NOT here: the converter cannot translate T-SQL procedures, triggers
--     or table-valued functions. A PostgreSQL host runs `mj codegen` after installing, which
--     generates them natively. The converter's notes for them remain, fully commented out.
--   * 8 string values restored verbatim from the T-SQL: the converter re-indents text
--     inside string literals and rewrites T-SQL inside stored constraint text and display names.
--   * 2 statements the converter drops (CodeGen's name-field map updates, column
--     description updates) translated by hand at the end of the file.
-- Schema names are written unquoted, as the converter emits them, so they fold to the lowercase
-- schema a PostgreSQL install uses.
-- =============================================================================================

SET standard_conforming_strings = on;

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
CREATE SCHEMA IF NOT EXISTS __mj_bizappssales;
SET search_path TO __mj_bizappssales, public;

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

ALTER TABLE __mj_BizAppsSales."SalesAccount"
 ADD COLUMN IF NOT EXISTS "DefaultPrimaryContactID" UUID NULL
            CONSTRAINT "FK_SalesAccount_DefaultPrimaryContact"
                REFERENCES __mj_BizAppsSales."SalesContact" ("ID") DEFERRABLE INITIALLY DEFERRED,
 ADD COLUMN IF NOT EXISTS "DefaultBillingContactID" UUID NULL
            CONSTRAINT "FK_SalesAccount_DefaultBillingContact"
                REFERENCES __mj_BizAppsSales."SalesContact" ("ID") DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SalesAccount_OwnerEmployeeID" ON __mj_BizAppsSales."SalesAccount" ("OwnerEmployeeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SalesAccount_AccountTypeID" ON __mj_BizAppsSales."SalesAccount" ("AccountTypeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SalesAccount_LifecycleStageTypeID" ON __mj_BizAppsSales."SalesAccount" ("LifecycleStageTypeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SalesAccount_LeadSourceTypeID" ON __mj_BizAppsSales."SalesAccount" ("LeadSourceTypeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SalesAccount_DefaultPrimaryContactID" ON __mj_BizAppsSales."SalesAccount" ("DefaultPrimaryContactID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SalesAccount_DefaultBillingContactID" ON __mj_BizAppsSales."SalesAccount" ("DefaultBillingContactID");


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
    __mj."vwEmployees" AS "MJEmployee_OwnerEmployeeID"
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


-- ===================== Stored Procedures (sp*) =====================

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


-- ===================== Triggers =====================

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsSales].trgUpdateSalesAccount
-- ON "__mj_BizAppsSales"."SalesAccount"
-- AFTER UPDATE
-- AS
-- BEGIN
--     SET NOCOUNT ON;
--     UPDATE
--         "__mj_BizAppsSales"."SalesAccount"
--     SET
 


-- ===================== Data (INSERT/UPDATE/DELETE) =====================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM __mj."EntityField" WHERE "ID" = 'f32701f4-7647-4560-be0c-990d3ed1df85' OR ("EntityID" = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A' AND "Name" = 'DefaultPrimaryContactID')
    ) THEN
        INSERT INTO __mj."EntityField"
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
        'f32701f4-7647-4560-be0c-990d3ed1df85',
        '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A', -- "Entity": "MJ_BizApps_Sales": "Sales" "Accounts"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM __mj."EntityField" WHERE "EntityID" = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A'),
        'DefaultPrimaryContactID',
        'Default Primary Contact ID',
        'Contact a new deal for this account starts with as its Primary Contact. Copied onto a deal only when the deal''s Primary Contact is empty; the deal''s value stays editable.',
        'UUID',
        16,
        0,
        0,
        TRUE,
        NULL,
        FALSE,
        TRUE,
        FALSE,
        FALSE,
        '530174B2-654E-4E14-BF28-3EF29AC9833D',
        'ID',
        FALSE,
        FALSE,
        TRUE,
        FALSE,
        FALSE,
        FALSE,
        'Search',
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM __mj."EntityField" WHERE "ID" = 'cd977001-3c58-4a59-86bf-eb81ab9ec2fe' OR ("EntityID" = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A' AND "Name" = 'DefaultBillingContactID')
    ) THEN
        INSERT INTO __mj."EntityField"
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
        'cd977001-3c58-4a59-86bf-eb81ab9ec2fe',
        '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A', -- "Entity": "MJ_BizApps_Sales": "Sales" "Accounts"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM __mj."EntityField" WHERE "EntityID" = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A'),
        'DefaultBillingContactID',
        'Default Billing Contact ID',
        'Contact a new deal for this account starts with as its Billing Contact. Copied onto a deal only when the deal''s Billing Contact is empty; the deal''s value stays editable. Empty means the deal''s billing contact follows its primary contact.',
        'UUID',
        16,
        0,
        0,
        TRUE,
        NULL,
        FALSE,
        TRUE,
        FALSE,
        FALSE,
        '530174B2-654E-4E14-BF28-3EF29AC9833D',
        'ID',
        FALSE,
        FALSE,
        TRUE,
        FALSE,
        FALSE,
        FALSE,
        'Search',
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM __mj."EntityRelationship" WHERE "ID" = 'edd80ce5-4a99-4176-b9c0-f78b2a0af68c'
    ) THEN
        INSERT INTO __mj."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('edd80ce5-4a99-4176-b9c0-f78b2a0af68c', '530174B2-654E-4E14-BF28-3EF29AC9833D', '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A', 'DefaultPrimaryContactID', 'One To Many', TRUE, TRUE, 4, NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM __mj."EntityRelationship" WHERE "ID" = 'd5e97995-2571-4696-bb32-fedffa5e2e00'
    ) THEN
        INSERT INTO __mj."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('d5e97995-2571-4696-bb32-fedffa5e2e00', '530174B2-654E-4E14-BF28-3EF29AC9833D', '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A', 'DefaultBillingContactID', 'One To Many', TRUE, TRUE, 5, NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM __mj."EntityField" WHERE "ID" = 'cf73d195-9ab0-4034-84ec-a95c1906895c' OR ("EntityID" = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A' AND "Name" = 'DefaultPrimaryContact')
    ) THEN
        INSERT INTO __mj."EntityField"
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
        'cf73d195-9ab0-4034-84ec-a95c1906895c',
        '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A', -- "Entity": "MJ_BizApps_Sales": "Sales" "Accounts"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM __mj."EntityField" WHERE "EntityID" = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A'),
        'DefaultPrimaryContact',
        'Default Primary Contact',
        NULL,
        'TEXT',
        1408,
        0,
        0,
        TRUE,
        NULL,
        FALSE,
        FALSE,
        TRUE,
        FALSE,
        NULL,
        NULL,
        FALSE,
        FALSE,
        FALSE,
        FALSE,
        FALSE,
        FALSE,
        'Search',
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM __mj."EntityField" WHERE "ID" = '9a978798-796f-4c77-b2e1-2c7255f33baa' OR ("EntityID" = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A' AND "Name" = 'DefaultBillingContact')
    ) THEN
        INSERT INTO __mj."EntityField"
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
        '9a978798-796f-4c77-b2e1-2c7255f33baa',
        '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A', -- "Entity": "MJ_BizApps_Sales": "Sales" "Accounts"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM __mj."EntityField" WHERE "EntityID" = '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A'),
        'DefaultBillingContact',
        'Default Billing Contact',
        NULL,
        'TEXT',
        1408,
        0,
        0,
        TRUE,
        NULL,
        FALSE,
        FALSE,
        TRUE,
        FALSE,
        NULL,
        NULL,
        FALSE,
        FALSE,
        FALSE,
        FALSE,
        FALSE,
        FALSE,
        'Search',
        NOW(),
        NOW()
        );
    END IF;
END $$;


-- ===================== Grants =====================

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
/* SQL text to insert 2 new entity field(s) */


-- ===================== Comments =====================

COMMENT ON COLUMN __mj_BizAppsSales."SalesAccount"."DefaultPrimaryContactID" IS 'Contact a new deal for this account starts with as its Primary Contact. Copied onto a deal only when the deal''s Primary Contact is empty; the deal''s value stays editable.';

COMMENT ON COLUMN __mj_BizAppsSales."SalesAccount"."DefaultBillingContactID" IS 'Contact a new deal for this account starts with as its Billing Contact. Copied onto a deal only when the deal''s Billing Contact is empty; the deal''s value stays editable. Empty means the deal''s billing contact follows its primary contact.';


-- ===================== Other =====================

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================

/* SQL text to update existing entities from schema */

/* spUpdate Permissions for MJ_BizApps_Sales: Sales Accounts */

-- ===================== Skipped by the converter, translated by hand =====================
-- CodeGen's related-entity name-field map updates and changed column descriptions.
SELECT __mj."spUpdateEntityFieldRelatedEntityNameFieldMap"('F32701F4-7647-4560-BE0C-990D3ED1DF85'::uuid, 'DefaultPrimaryContact');
SELECT __mj."spUpdateEntityFieldRelatedEntityNameFieldMap"('CD977001-3C58-4A59-86BF-EB81AB9EC2FE'::uuid, 'DefaultBillingContact');
