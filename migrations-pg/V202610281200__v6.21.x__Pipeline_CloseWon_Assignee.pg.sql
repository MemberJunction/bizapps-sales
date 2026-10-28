-- =============================================================================================
-- PostgreSQL counterpart of V202610281200__v6.21.x__Pipeline_CloseWon_Assignee.sql
-- =============================================================================================
-- `mj sql-convert --from tsql --to postgres` (MJ CLI 6.1.6) output, finished by hand:
--   * Tables, columns, constraints, indexes, views, data and grants are the converter's.
--   * CodeGen's CRUD procedures (spCreate/spUpdate/spDelete) and its __mj_UpdatedAt trigger are NOT
--     here: the converter cannot translate T-SQL procedures or triggers. A PostgreSQL host runs
--     `mj codegen` after installing, which generates them natively. The converter's notes for them
--     remain, fully commented out (the trigger's note needed finishing by hand).
--   * 2 string values restored verbatim from the T-SQL: the converter re-indents text inside
--     string literals.
--   * 1 statement the converter drops (CodeGen's name-field map update) translated by hand at the
--     end of the file.
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
-- Pipeline: the person close-won tasks are routed to (bc-aidp-next-golive#326).
-- =============================================================================
-- A deal closed Won raises an Order Review task, and on a B2B pipeline a Contract
-- Processing task. Until now the person they go to was set only inside the
-- pipeline's CloseWonPolicy JSON (CloseWonTasks.AssigneeRecordID). That has two
-- faults:
--
-- IT DOES NOT SURVIVE AN UPGRADE. The two default pipelines ship as rows in
-- metadata/pipelines, and a metadata push writes the file's values back over the
-- database. The file ships the assignee as null, because who reviews orders differs
-- per deployment. So an assignee a deployment set inside the JSON is reset to null
-- on the next install of this app, and close-won tasks stop being routed again.
-- This column is not in the metadata files, so a push never touches it.
--
-- NOTHING REFUSES A PERSON WHO IS NOT THERE. The JSON value is free text, and
-- TaskAssignment.AssigneeRecordID is polymorphic, so a mistyped or demo-only id
-- was accepted and produced tasks assigned to nobody. A foreign key to Person
-- refuses that id when the pipeline is saved, not when a deal closes.
--
-- NULLABLE. Empty means the pipeline falls back to the JSON value, and when that is
-- empty too, the close reports the tasks as not routed.
-- =============================================================================

ALTER TABLE __mj_BizAppsSales."Pipeline"
 ADD COLUMN IF NOT EXISTS "CloseWonAssigneePersonID" UUID NULL
            CONSTRAINT "FK_Pipeline_CloseWonAssigneePerson"
                REFERENCES __mj_BizAppsCommon."Person" ("ID") DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Pipeline_CompanyID" ON __mj_BizAppsSales."Pipeline" ("CompanyID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Pipeline_DealTypeID" ON __mj_BizAppsSales."Pipeline" ("DealTypeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Pipeline_DefaultForecastCategoryTypeID" ON __mj_BizAppsSales."Pipeline" ("DefaultForecastCategoryTypeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Pipeline_CloseWonAssigneePersonID" ON __mj_BizAppsSales."Pipeline" ("CloseWonAssigneePersonID");


-- ===================== Views =====================

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsSales';
  v_target_name CONSTANT TEXT := 'vwPipelines';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW __mj_BizAppsSales."vwPipelines"
AS SELECT
    p.*,
    "MJCompany_CompanyID"."Name" AS "Company",
    "mjBizAppsSalesDealType_DealTypeID"."Name" AS "DealType",
    "mjBizAppsSalesForecastCategoryType_DefaultForecastCategoryTypeID"."Name" AS "DefaultForecastCategoryType",
    "mjBizAppsCommonPerson_CloseWonAssigneePersonID"."DisplayName" AS "CloseWonAssigneePerson"
FROM
    __mj_BizAppsSales."Pipeline" AS p
INNER JOIN
    __mj."Company" AS "MJCompany_CompanyID"
  ON
    p."CompanyID" = "MJCompany_CompanyID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsSales."DealType" AS "mjBizAppsSalesDealType_DealTypeID"
  ON
    p."DealTypeID" = "mjBizAppsSalesDealType_DealTypeID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsSales."ForecastCategoryType" AS "mjBizAppsSalesForecastCategoryType_DefaultForecastCategoryTypeID"
  ON
    p."DefaultForecastCategoryTypeID" = "mjBizAppsSalesForecastCategoryType_DefaultForecastCategoryTypeID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsCommon."Person" AS "mjBizAppsCommonPerson_CloseWonAssigneePersonID"
  ON
    p."CloseWonAssigneePersonID" = "mjBizAppsCommonPerson_CloseWonAssigneePersonID"."ID"$vsql$;
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
-- CREATE PROCEDURE [__mj_BizAppsSales].[spCreatePipeline]
--     @ID UUID = NULL,
--     @CompanyID UUID,
--     @Name VARCHAR(200),
--     @Code VARCHAR(40),
--     @Description_Clear bit = ...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spUpdatePipeline]
--     @ID UUID,
--     @CompanyID UUID = NULL,
--     @Name VARCHAR(200) = NULL,
--     @Code VARCHAR(40) = NULL,
--     @Descriptio...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spDeletePipeline]
--     @ID UUID
-- AS
-- BEGIN
--     SET NOCOUNT ON;
-- 
--     DELETE FROM
--         [__mj_BizAppsSales].[Pipeline]
--     WHERE
--         [ID] = @ID
-- 
-- 
--    ...


-- ===================== Triggers =====================

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsSales].trgUpdatePipeline
-- ON "__mj_BizAppsSales"."Pipeline"
-- AFTER UPDATE
-- AS
-- BEGIN
--     SET NOCOUNT ON;
--     UPDATE
--         "__mj_BizAppsSales"."Pipeline"
--     SET
--         __mj_


-- ===================== Data (INSERT/UPDATE/DELETE) =====================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM __mj."EntityField" WHERE "ID" = '7492f4ec-a889-4cc7-9082-29652da221f4' OR ("EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND "Name" = 'CloseWonAssigneePersonID')
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
        '7492f4ec-a889-4cc7-9082-29652da221f4',
        'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', -- "Entity": "MJ_BizApps_Sales": "Pipelines"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM __mj."EntityField" WHERE "EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2'),
        'CloseWonAssigneePersonID',
        'Close Won Assignee Person ID',
        'Person who receives the Order Review and Contract Processing tasks raised when a deal on this pipeline closes Won. Set per deployment; the app''s metadata never sets it, so an upgrade keeps it. Takes precedence over CloseWonTasks.AssigneeRecordID in Close Won Policy. Empty means that policy value is used, and when both are empty the tasks are created but not assigned.',
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
        '7A94ADA9-7880-4FAE-97D8-DB0E934C3F5F',
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
        SELECT 1 FROM __mj."EntityRelationship" WHERE "ID" = '4fdf1cd9-f274-45a5-9d2e-478de4632402'
    ) THEN
        INSERT INTO __mj."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('4fdf1cd9-f274-45a5-9d2e-478de4632402', '7A94ADA9-7880-4FAE-97D8-DB0E934C3F5F', 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', 'CloseWonAssigneePersonID', 'One To Many', TRUE, TRUE, 30, NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM __mj."EntityField" WHERE "ID" = 'e5aef597-9a1d-41c5-983c-5f93386a8582' OR ("EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND "Name" = 'CloseWonAssigneePerson')
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
        'e5aef597-9a1d-41c5-983c-5f93386a8582',
        'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', -- "Entity": "MJ_BizApps_Sales": "Pipelines"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM __mj."EntityField" WHERE "EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2'),
        'CloseWonAssigneePerson',
        'Close Won Assignee Person',
        NULL,
        'TEXT',
        500,
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

UPDATE __mj."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '84FBEAAC-5A75-47C3-A025-5A4A7589A62D';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.CompanyID

UPDATE __mj."EntityField"
SET 
   "Category" = 'Pipeline Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '168D7BE1-2F44-4C5F-8D83-EBA34C62D775';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.Company

UPDATE __mj."EntityField"
SET 
   "Category" = 'Pipeline Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'EB8B1206-AC94-42A8-8013-A41EDE97FF62';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.Name

UPDATE __mj."EntityField"
SET 
   "Category" = 'Pipeline Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '92DA7E6E-7C0A-4D59-BC13-3FAA763E8D1A';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.Code

UPDATE __mj."EntityField"
SET 
   "Category" = 'Pipeline Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '755B44AE-CB92-4A62-9C79-93594846FD30';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.Description

UPDATE __mj."EntityField"
SET 
   "Category" = 'Pipeline Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '791C6A66-E771-45A2-AE31-D92972B1A6A0';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.IsDefault

UPDATE __mj."EntityField"
SET 
   "Category" = 'Pipeline Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'D873428B-249D-4782-89CC-206B4C563544';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.DisplayRank

UPDATE __mj."EntityField"
SET 
   "Category" = 'Pipeline Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '34E8CDD3-FEDE-4227-B454-99274637739E';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.IsActive

UPDATE __mj."EntityField"
SET 
   "Category" = 'Pipeline Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '7AFBF3D3-7442-4440-8552-D3D98384D38C';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.DealTypeID

UPDATE __mj."EntityField"
SET 
   "Category" = 'Deal & Forecast Settings',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'FD9BD0BD-1DE1-43AC-8508-059304F8B362';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.DealType

UPDATE __mj."EntityField"
SET 
   "Category" = 'Deal & Forecast Settings',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'F91BAE13-1A8D-4127-AA8D-8B73EEE098F5';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.DefaultForecastCategoryTypeID

UPDATE __mj."EntityField"
SET 
   "Category" = 'Deal & Forecast Settings',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '66FD46A6-1AAF-4DD2-A4B0-F1B6B5C9D9D2';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.DefaultForecastCategoryType

UPDATE __mj."EntityField"
SET 
   "Category" = 'Deal & Forecast Settings',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '35FED923-E812-4B72-92EE-F83B61401616';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.RequiresDealLines

UPDATE __mj."EntityField"
SET 
   "Category" = 'Deal & Forecast Settings',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'C613CB1E-4C10-4839-A34E-468F1E6959BE';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.IncludeInForecast

UPDATE __mj."EntityField"
SET 
   "Category" = 'Deal & Forecast Settings',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'A7DBE8B8-5CE6-4D97-AA83-3D60853F864D';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.CloseWonPolicy

UPDATE __mj."EntityField"
SET 
   "Category" = 'Automation & Policies',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'CDD765D8-6BA2-45F4-AB5F-7F27E3C84E23';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.CloseWonAssigneePersonID

UPDATE __mj."EntityField"
SET 
   "Category" = 'Automation & Policies',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Close Won Assignee'
WHERE 
   "ID" = '7492F4EC-A889-4CC7-9082-29652DA221F4';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.CloseWonAssigneePerson

UPDATE __mj."EntityField"
SET 
   "Category" = 'Automation & Policies',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Close Won Assignee Name'
WHERE 
   "ID" = 'E5AEF597-9A1D-41C5-983C-5F93386A8582';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.__mj_CreatedAt

UPDATE __mj."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '63F172BE-7B6B-4D58-832B-AFE8D54B6287';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.__mj_UpdatedAt

UPDATE __mj."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '4C25231A-E258-4429-BE8E-504941823EBE';

/* Set entity icon to fa fa-project-diagram */

UPDATE __mj."Entity"
               SET "Icon" = 'fa fa-project-diagram', "__mj_UpdatedAt" = NOW()
               WHERE "ID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2';

/* Insert FieldCategoryInfo setting for entity */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM __mj."EntitySetting" WHERE "EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND "Name" = 'FieldCategoryInfo'
    ) THEN
        INSERT INTO __mj."EntitySetting" ("ID", "EntityID", "Name", "Value", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('d0549c7f-14b5-51e1-be9e-2141b86b40ee', 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', 'FieldCategoryInfo', '{
  "Automation & Policies": {
    "description": "Policies and automation rules triggered when a deal is marked as won",
    "icon": "fa fa-robot"
  },
  "Deal & Forecast Settings": {
    "description": "Settings governing deal types, forecasting behavior, and pricing structure",
    "icon": "fa fa-chart-line"
  },
  "Pipeline Details": {
    "description": "Core identification and configuration settings for the pipeline",
    "icon": "fa fa-project-diagram"
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
        SELECT 1 FROM __mj."EntitySetting" WHERE "EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND "Name" = 'FieldCategoryIcons'
    ) THEN
        INSERT INTO __mj."EntitySetting" ("ID", "EntityID", "Name", "Value", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('98f7bf3e-dce6-5ad2-9898-f0a5ce7d09df', 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', 'FieldCategoryIcons', '{
  "Automation & Policies": "fa fa-robot",
  "Deal & Forecast Settings": "fa fa-chart-line",
  "Pipeline Details": "fa fa-project-diagram",
  "System Metadata": "fa fa-cog"
}', NOW(), NOW());
    END IF;
END $$;


-- ===================== Grants =====================

DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsSales."vwPipelines" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsSales."vwPipelines" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsSales."vwPipelines" FROM "cdp_UI"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON __mj_BizAppsSales."vwPipelines" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* Base View Permissions SQL for MJ_BizApps_Sales: Pipelines */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Pipelines
-- Item: Permissions for vwPipelines
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsSales."vwPipelines" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsSales."vwPipelines" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsSales."vwPipelines" FROM "cdp_UI"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON __mj_BizAppsSales."vwPipelines" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreatePipeline" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreatePipeline" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreatePipeline" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Sales: Pipelines */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreatePipeline" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spCreatePipeline" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreatePipeline" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdatePipeline" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdatePipeline" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdatePipeline" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdatePipeline" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdatePipeline" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdatePipeline" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
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
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spDeletePipeline" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spDeletePipeline" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spDeletePipeline" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete Permissions for MJ_BizApps_Sales: Pipelines */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spDeletePipeline" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsSales."spDeletePipeline" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spDeletePipeline" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* SQL text to insert 1 new entity field(s) */


-- ===================== Comments =====================

COMMENT ON COLUMN __mj_BizAppsSales."Pipeline"."CloseWonAssigneePersonID" IS 'Person who receives the Order Review and Contract Processing tasks raised when a deal on this pipeline closes Won. Set per deployment; the app''s metadata never sets it, so an upgrade keeps it. Takes precedence over CloseWonTasks.AssigneeRecordID in Close Won Policy. Empty means that policy value is used, and when both are empty the tasks are created but not assigned.';


-- ===================== Other =====================

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================

/* SQL text to insert 1 new entity field(s) */

/* spUpdate Permissions for MJ_BizApps_Sales: Pipelines */

-- ===================== Skipped by the converter, translated by hand =====================
-- CodeGen's related-entity name-field map update.
SELECT __mj."spUpdateEntityFieldRelatedEntityNameFieldMap"('7492F4EC-A889-4CC7-9082-29652DA221F4'::uuid, 'CloseWonAssigneePerson');
