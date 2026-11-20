-- =============================================================================================
-- PostgreSQL counterpart of V202611021600__v6.23.x__Deal_LeadSourceDetail.sql
-- =============================================================================================
-- `mj sql-convert --from tsql --to postgres --schema __mj_BizAppsSales` (MJ CLI 6.1.6) output,
-- finished by hand:
--   * Columns, indexes, the view, data, grants and the column comment are the converter's.
--   * CodeGen's CRUD procedures (spCreate/spUpdate/spDelete) and its __mj_UpdatedAt trigger are NOT
--     here: the converter cannot translate T-SQL procedures or triggers. A PostgreSQL host runs
--     `mj codegen` after installing, which generates them natively. The converter's notes for them
--     remain, fully commented out (the trigger's note needed finishing by hand).
--   * ${mjSchema} written as __mj, the core schema a PostgreSQL install uses.
--   * The T-SQL file's sp_refreshview calls have no counterpart: PostgreSQL views are re-created,
--     not refreshed.
-- Schema names are written unquoted, as the converter emits them, so they fold to the lowercase
-- schema a PostgreSQL install uses.
-- =============================================================================================

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

-- =============================================================================
-- Deal: the detail behind its lead source.
-- =============================================================================
-- LeadSourceTypeID records the channel a deal came from (Event, Referral, ...).
-- The CRM the deals are imported from also records the specific source within
-- that channel: the event, campaign or person, as free text. Sales asked to see
-- it on the deal, beside the lead source.
--
-- FREE TEXT, NOT A LOOKUP. The source holds about a thousand distinct values,
-- most used once, so a type table would be a second copy of the text.
--
-- NULLABLE. Most deals have no detail, and a rep is never required to add one.
-- =============================================================================

ALTER TABLE __mj_BizAppsSales."Deal"
 ADD COLUMN IF NOT EXISTS "LeadSourceDetail" VARCHAR(500) NULL;

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Deal_PipelineID" ON __mj_BizAppsSales."Deal" ("PipelineID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Deal_PipelineStageID" ON __mj_BizAppsSales."Deal" ("PipelineStageID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Deal_DealTypeID" ON __mj_BizAppsSales."Deal" ("DealTypeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Deal_DealStatusTypeID" ON __mj_BizAppsSales."Deal" ("DealStatusTypeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Deal_AccountID" ON __mj_BizAppsSales."Deal" ("AccountID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Deal_PrimaryContactID" ON __mj_BizAppsSales."Deal" ("PrimaryContactID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Deal_BillingContactID" ON __mj_BizAppsSales."Deal" ("BillingContactID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Deal_CompanyID" ON __mj_BizAppsSales."Deal" ("CompanyID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Deal_OwnerEmployeeID" ON __mj_BizAppsSales."Deal" ("OwnerEmployeeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Deal_CurrencyID" ON __mj_BizAppsSales."Deal" ("CurrencyID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Deal_ForecastCategoryTypeID" ON __mj_BizAppsSales."Deal" ("ForecastCategoryTypeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Deal_LossReasonID" ON __mj_BizAppsSales."Deal" ("LossReasonID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Deal_LeadSourceTypeID" ON __mj_BizAppsSales."Deal" ("LeadSourceTypeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Deal_ContractID" ON __mj_BizAppsSales."Deal" ("ContractID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Deal_RenewsContractID" ON __mj_BizAppsSales."Deal" ("RenewsContractID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Deal_ClosedByUserID" ON __mj_BizAppsSales."Deal" ("ClosedByUserID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Deal_OrderID" ON __mj_BizAppsSales."Deal" ("OrderID");


-- ===================== Views =====================

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsSales';
  v_target_name CONSTANT TEXT := 'vwDealsGenerated';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW __mj_BizAppsSales."vwDealsGenerated"
AS SELECT
    d.*,
    "mjBizAppsSalesPipeline_PipelineID"."Name" AS "Pipeline",
    "mjBizAppsSalesPipelineStage_PipelineStageID"."Name" AS "PipelineStage",
    "mjBizAppsSalesDealType_DealTypeID"."Name" AS "DealType",
    "mjBizAppsSalesDealStatusType_DealStatusTypeID"."Name" AS "DealStatusType",
    "mjBizAppsSalesSalesAccount_AccountID"."Name" AS "Account",
    "mjBizAppsSalesSalesContact_PrimaryContactID"."DisplayNameAndEmail" AS "PrimaryContact",
    "mjBizAppsSalesSalesContact_BillingContactID"."DisplayNameAndEmail" AS "BillingContact",
    "MJCompany_CompanyID"."Name" AS "Company",
    "MJEmployee_OwnerEmployeeID"."FirstLast" AS "OwnerEmployee",
    "mjBizAppsSalesForecastCategoryType_ForecastCategoryTypeID"."Name" AS "ForecastCategoryType",
    "mjBizAppsSalesLossReason_LossReasonID"."Name" AS "LossReason",
    "mjBizAppsSalesLeadSourceType_LeadSourceTypeID"."Name" AS "LeadSourceType",
    "MJUser_ClosedByUserID"."Name" AS "ClosedByUser",
    "mjBizAppsOrdersOrderHeader_OrderID"."OrderNumber" AS "Order"
FROM
    __mj_BizAppsSales."Deal" AS d
INNER JOIN
    __mj_BizAppsSales."Pipeline" AS "mjBizAppsSalesPipeline_PipelineID"
  ON
    d."PipelineID" = "mjBizAppsSalesPipeline_PipelineID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsSales."PipelineStage" AS "mjBizAppsSalesPipelineStage_PipelineStageID"
  ON
    d."PipelineStageID" = "mjBizAppsSalesPipelineStage_PipelineStageID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsSales."DealType" AS "mjBizAppsSalesDealType_DealTypeID"
  ON
    d."DealTypeID" = "mjBizAppsSalesDealType_DealTypeID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsSales."DealStatusType" AS "mjBizAppsSalesDealStatusType_DealStatusTypeID"
  ON
    d."DealStatusTypeID" = "mjBizAppsSalesDealStatusType_DealStatusTypeID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsSales."vwSalesAccounts" AS "mjBizAppsSalesSalesAccount_AccountID"
  ON
    d."AccountID" = "mjBizAppsSalesSalesAccount_AccountID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsSales."vwSalesContacts" AS "mjBizAppsSalesSalesContact_PrimaryContactID"
  ON
    d."PrimaryContactID" = "mjBizAppsSalesSalesContact_PrimaryContactID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsSales."vwSalesContacts" AS "mjBizAppsSalesSalesContact_BillingContactID"
  ON
    d."BillingContactID" = "mjBizAppsSalesSalesContact_BillingContactID"."ID"
INNER JOIN
    __mj."Company" AS "MJCompany_CompanyID"
  ON
    d."CompanyID" = "MJCompany_CompanyID"."ID"
LEFT OUTER JOIN
    __mj."vwEmployees" AS "MJEmployee_OwnerEmployeeID"
  ON
    d."OwnerEmployeeID" = "MJEmployee_OwnerEmployeeID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsSales."ForecastCategoryType" AS "mjBizAppsSalesForecastCategoryType_ForecastCategoryTypeID"
  ON
    d."ForecastCategoryTypeID" = "mjBizAppsSalesForecastCategoryType_ForecastCategoryTypeID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsSales."LossReason" AS "mjBizAppsSalesLossReason_LossReasonID"
  ON
    d."LossReasonID" = "mjBizAppsSalesLossReason_LossReasonID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsSales."LeadSourceType" AS "mjBizAppsSalesLeadSourceType_LeadSourceTypeID"
  ON
    d."LeadSourceTypeID" = "mjBizAppsSalesLeadSourceType_LeadSourceTypeID"."ID"
LEFT OUTER JOIN
    __mj."User" AS "MJUser_ClosedByUserID"
  ON
    d."ClosedByUserID" = "MJUser_ClosedByUserID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsOrders."OrderHeader" AS "mjBizAppsOrdersOrderHeader_OrderID"
  ON
    d."OrderID" = "mjBizAppsOrdersOrderHeader_OrderID"."ID"$vsql$;
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
-- CREATE PROCEDURE [__mj_BizAppsSales].[spCreateDeal]
--     @ID UUID = NULL,
--     @DealNumber_Clear bit = 0,
--     @DealNumber VARCHAR(50) = NULL,
--     @Name VARCHAR(500),
--     @PipelineID unique...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spUpdateDeal]
--     @ID UUID,
--     @DealNumber_Clear bit = 0,
--     @DealNumber VARCHAR(50) = NULL,
--     @Name VARCHAR(500) = NULL,
--     @PipelineID unique...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spDeleteDeal]
--     @ID UUID
-- AS
-- BEGIN
--     SET NOCOUNT ON;
-- 
--     DELETE FROM
--         [__mj_BizAppsSales].[Deal]
--     WHERE
--         [ID] = @ID
-- 
-- 
--     -- Chec...


-- ===================== Triggers =====================

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsSales].trgUpdateDeal
-- ON "__mj_BizAppsSales"."Deal"
-- AFTER UPDATE
-- AS
-- BEGIN
--     SET NOCOUNT ON;
--     UPDATE
--         "__mj_BizAppsSales"."Deal"
--     SET
--         __mj_UpdatedAt =  ...


-- ===================== Data (INSERT/UPDATE/DELETE) =====================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM __mj."EntityField" WHERE "ID" = '459c77a4-c2d4-41e9-879a-1ac5b68a077b' OR ("EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND "Name" = 'LeadSourceDetail')
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
        '459c77a4-c2d4-41e9-879a-1ac5b68a077b',
        '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', -- "Entity": "MJ_BizApps_Sales": "Deals"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM __mj."EntityField" WHERE "EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'),
        'LeadSourceDetail',
        'Lead Source Detail',
        'The specific source within the deal''s lead source type, such as the event, campaign or referring person. Free text; empty when not recorded.',
        'TEXT',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;


-- ===================== Grants =====================

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateDeal" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateDeal" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateDeal" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Sales: Deals */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateDeal" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateDeal" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateDeal" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateDeal" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateDeal" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateDeal" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateDeal" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateDeal" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateDeal" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteDeal" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteDeal" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteDeal" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete Permissions for MJ_BizApps_Sales: Deals */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteDeal" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteDeal" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteDeal" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* Refresh custom base views for modified entities so schema changes are picked up */


-- ===================== Comments =====================

COMMENT ON COLUMN __mj_BizAppsSales."Deal"."LeadSourceDetail" IS 'The specific source within the deal''s lead source type, such as the event, campaign or referring person. Free text; empty when not recorded.';


-- ===================== Other =====================

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================

/* SQL text to insert 1 new entity field(s) */

/* spUpdate Permissions for MJ_BizApps_Sales: Deals */
