-- =============================================================================================
-- PostgreSQL counterpart of V202611061000__v6.25.x__Pipeline_CloseWon_Assignee_Role.sql
-- =============================================================================================
-- `mj sql-convert --from tsql --to postgres --schema __mj_BizAppsSales` (MJ CLI 6.1.6) output,
-- finished by hand. The converter reported 0 errors and 8 skipped objects.
--   * The column, indexes, view, EntityField and EntityRelationship rows, grants and the column
--     comment are the converter's.
--   * THE FOREIGN KEY'S TARGET COLUMN WAS QUOTED BY HAND. The converter emitted `(ID)` against
--     ${mjSchema}."Role", which PostgreSQL folds to `id`; it is now `("ID")`, DEFERRABLE INITIALLY
--     DEFERRED as in V202610301736__v6.22.x__Pipeline_CloseWon_Assignee.pg.sql.
--   * CodeGen's CRUD procedures (spCreate/spUpdate/spDelete) and its __mj_UpdatedAt trigger are
--     NOT here: the converter cannot translate T-SQL procedures or triggers. A PostgreSQL host
--     runs `mj codegen` after installing, which generates them natively. Their notes remain,
--     fully commented out (the trigger's note needed finishing by hand).
--   * 1 statement the converter drops (CodeGen's name-field map update) translated by hand at the
--     end of the file.
-- Schema names are written unquoted, as the converter emits them, so they fold to the lowercase
-- schema a PostgreSQL install uses. UNVALIDATED AGAINST A LIVE PostgreSQL SERVER: this repo has
-- no PostgreSQL host, as with every file in this directory.
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
-- Pipeline: the MJ role close-won tasks are routed to (bc-aidp-next-golive#442).
-- =============================================================================
-- A deal closed Won raises an Order Review task, and on a B2B pipeline a Contract
-- Processing task. CloseWonAssigneePersonID routes them to one person. Finance
-- asked for a shared queue instead: every holder of a finance role sees the task
-- and is notified of it.
--
-- A task assignment is polymorphic (entity + record), so the task can be
-- assigned to the role itself: AssigneeEntity = MJ: Roles, AssigneeRecord = the
-- role's ID. The tasks app expands a role assignee to the role's current members
-- when it lists and notifies, so someone who joins the role later still sees the
-- open tasks.
--
-- A COLUMN, NOT THE POLICY JSON, for the reason CloseWonAssigneePersonID is one
-- (bc-aidp-next-golive#326): a metadata push writes the shipped CloseWonPolicy back
-- over the database, so an assignee typed into the JSON lasts until the next
-- install. This column is not in the metadata files, and its foreign key refuses
-- a role that is not there.
--
-- NOT THE SAME AS CloseWonTasks.AssigneeRoleID in the policy. That one is the
-- TaskRole the assignee holds on the task (Primary, Reviewer, Observer); this one
-- is the MJ role that IS the assignee.
--
-- NULLABLE. When both this and CloseWonAssigneePersonID are set, the person wins.
-- When neither is set, the policy JSON's assignee is used, and when that is empty
-- the tasks are created but not assigned.
-- =============================================================================

ALTER TABLE __mj_BizAppsSales."Pipeline"
 ADD COLUMN IF NOT EXISTS "CloseWonAssigneeRoleID" UUID NULL
            CONSTRAINT "FK_Pipeline_CloseWonAssigneeRole"
                REFERENCES ${mjSchema}."Role" ("ID") DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Pipeline_DealTypeID" ON __mj_BizAppsSales."Pipeline" ("DealTypeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Pipeline_DefaultForecastCategoryTypeID" ON __mj_BizAppsSales."Pipeline" ("DefaultForecastCategoryTypeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Pipeline_CloseWonAssigneePersonID" ON __mj_BizAppsSales."Pipeline" ("CloseWonAssigneePersonID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Pipeline_CloseWonAssigneeRoleID" ON __mj_BizAppsSales."Pipeline" ("CloseWonAssigneeRoleID");


-- ===================== Views =====================

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsSales';
  v_target_name CONSTANT TEXT := 'vwPipelines';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW __mj_BizAppsSales."vwPipelines"
AS SELECT
    p.*,
    "mjBizAppsSalesDealType_DealTypeID"."Name" AS "DealType",
    "mjBizAppsSalesForecastCategoryType_DefaultForecastCategoryTypeID"."Name" AS "DefaultForecastCategoryType",
    "mjBizAppsCommonPerson_CloseWonAssigneePersonID"."DisplayName" AS "CloseWonAssigneePerson",
    "MJRole_CloseWonAssigneeRoleID"."Name" AS "CloseWonAssigneeRole"
FROM
    __mj_BizAppsSales."Pipeline" AS p
LEFT OUTER JOIN
    __mj_BizAppsSales."DealType" AS "mjBizAppsSalesDealType_DealTypeID"
  ON
    p."DealTypeID" = "mjBizAppsSalesDealType_DealTypeID"."ID"
LEFT OUTER JOIN
    __mj_BizAppsSales."ForecastCategoryType" AS "mjBizAppsSalesForecastCategoryType_DefaultForecastCategoryTypeID"
  ON
    p."DefaultForecastCategoryTypeID" = "mjBizAppsSalesForecastCategoryType_DefaultForecastCategoryTypeID"."ID"
LEFT OUTER JOIN
    ${mjSchema}_BizAppsCommon."Person" AS "mjBizAppsCommonPerson_CloseWonAssigneePersonID"
  ON
    p."CloseWonAssigneePersonID" = "mjBizAppsCommonPerson_CloseWonAssigneePersonID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."Role" AS "MJRole_CloseWonAssigneeRoleID"
  ON
    p."CloseWonAssigneeRoleID" = "MJRole_CloseWonAssigneeRoleID"."ID"$vsql$;
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
--     @Name VARCHAR(200),
--     @Code VARCHAR(40),
--     @Description_Clear bit = 0,
--     @Description TEXT...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spUpdatePipeline]
--     @ID UUID,
--     @Name VARCHAR(200) = NULL,
--     @Code VARCHAR(40) = NULL,
--     @Description_Clear bit = 0,
--     @Description nvarch...

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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'c4a1a7e3-f222-4d37-9dc4-409bca411c4f' OR ("EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND "Name" = 'CloseWonAssigneeRoleID')
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
        'c4a1a7e3-f222-4d37-9dc4-409bca411c4f',
        'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', -- "Entity": "MJ_BizApps_Sales": "Pipelines"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2'),
        'CloseWonAssigneeRoleID',
        'Close Won Assignee Role ID',
        'Role whose members all receive the Order Review and Contract Processing tasks raised when a deal on this pipeline closes Won: the task is assigned to the role, and everyone who holds it sees it and is notified. Set per deployment; the app''s metadata never sets it, so an upgrade keeps it. Close Won Assignee (a person) takes precedence when both are set. Empty, with no person, means CloseWonTasks.AssigneeRecordID in Close Won Policy is used, and when that is empty too the tasks are created but not assigned.',
        'UUID',
        16,
        0,
        0,
        1,
        NULL,
        0,
        1,
        0,
        0,
        'DA238F34-2837-EF11-86D4-6045BDEE16E6',
        'ID',
        0,
        0,
        1,
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
        SELECT 1 FROM ${mjSchema}."EntityRelationship" WHERE "ID" = 'f002bfe6-6fa5-475f-bfbc-21d3bf51fa44'
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('f002bfe6-6fa5-475f-bfbc-21d3bf51fa44', 'DA238F34-2837-EF11-86D4-6045BDEE16E6', 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', 'CloseWonAssigneeRoleID', 'One To Many', 1, 1, 20, NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '6c8e03ba-5fc7-438f-a229-3ecd21321abb' OR ("EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND "Name" = 'CloseWonAssigneeRole')
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
        '6c8e03ba-5fc7-438f-a229-3ecd21321abb',
        'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', -- "Entity": "MJ_BizApps_Sales": "Pipelines"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2'),
        'CloseWonAssigneeRole',
        'Close Won Assignee Role',
        NULL,
        'TEXT',
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
        NOW(),
        NOW()
        );
    END IF;
END $$;

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Automation & Policies',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Close Won Assignee Role'
WHERE 
   "ID" = 'C4A1A7E3-F222-4D37-9DC4-409BCA411C4F';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.CloseWonAssigneeRole

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Automation & Policies',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Close Won Assignee Role Name'
WHERE 
   "ID" = '6C8E03BA-5FC7-438F-A229-3ECD21321ABB';


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

COMMENT ON COLUMN __mj_BizAppsSales."Pipeline"."CloseWonAssigneeRoleID" IS 'Role whose members all receive the Order Review and Contract Processing tasks raised when a deal on this pipeline closes Won: the task is assigned to the role, and everyone who holds it sees it and is notified. Set per deployment; the app''s metadata never sets it, so an upgrade keeps it. Close Won Assignee (a person) takes precedence when both are set. Empty, with no person, means CloseWonTasks.AssigneeRecordID in Close Won Policy is used, and when that is empty too the tasks are created but not assigned.';


-- ===================== Other =====================

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================

/* SQL text to insert 1 new entity field(s) */

/* spUpdate Permissions for MJ_BizApps_Sales: Pipelines */

-- ===================== Skipped by the converter, translated by hand =====================
-- CodeGen's related-entity name-field map update.
SELECT __mj."spUpdateEntityFieldRelatedEntityNameFieldMap"('C4A1A7E3-F222-4D37-9DC4-409BCA411C4F'::uuid, 'CloseWonAssigneeRole');
