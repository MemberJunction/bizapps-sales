-- =============================================================================================
-- PostgreSQL counterpart of V202611062300__v6.25.x__Pipeline_Company_Link.sql
-- =============================================================================================
-- `mj sql-convert --from tsql --to postgres --schema __mj_BizAppsSales` (MJ CLI 6.1.6) output,
-- finished by hand. The converter reported 0 errors and 18 skipped objects.
--   * The table, constraints, indexes, views, metadata rows, grants and comments are the
--     converter's.
--   * CodeGen's CRUD procedures (spCreate/spUpdate/spDelete) and its __mj_UpdatedAt triggers are
--     NOT here: the converter cannot translate T-SQL procedures or triggers. A PostgreSQL host
--     runs `mj codegen` after installing, which generates them natively.
--   * REORDERED BY HAND. The converter groups statements by kind (DDL, then data), which put the
--     backfill after the column it reads was dropped. The backfill now follows CREATE TABLE.
--   * vwPipelines is dropped before the column, not after as in the T-SQL: PostgreSQL refuses to
--     drop a column a view depends on. The converter left the view drop out and emitted the index
--     drop in T-SQL syntax at the end; both are written by hand ahead of the column drop.
--   * The backfill's IsActive is TRUE rather than the converter's 1, which PostgreSQL rejects for
--     a boolean column.
--   * The converter rewrote `__mj_BizAppsCommon` to `${mjSchema}_BizAppsCommon` in vwPipelines, and
--     left `${mjSchema}."Company" (ID)` unquoted; both corrected.
--   * ${mjSchema} is otherwise left as the placeholder the converter emits, as in the sibling files.
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
-- PipelineCompany — a pipeline can now serve several selling companies.
-- =============================================================================
-- Until now a pipeline belonged to exactly one company (Pipeline.CompanyID,
-- NOT NULL, docs/DECISIONS.md D5), and a company that sold the same motion got a
-- COPY of the pipeline and its stages (Sales.CopyDefaultPipelineToCompanies, #327).
-- This replaces the column with a link table, so one pipeline is shared by every
-- company it is linked to.
--
-- STRONGLY TYPED, NOT POLYMORPHIC. Accounting's GLAccountLink points at any record
-- through EntityID + RecordID because a GL account can be mapped from many kinds of
-- record. A pipeline only ever links to a company, so both sides are real foreign
-- keys and the database refuses a link to a company or pipeline that does not exist.
--
-- THE DEAL STILL CARRIES ONE COMPANY. Deal.CompanyID stays NOT NULL. The rep picks
-- the selling company first and is offered the pipelines linked to it; the entity
-- server refuses a deal whose company is not actively linked to its pipeline. That
-- replaces stampCompanyFromPipeline(), which copied the one company a pipeline had.
--
-- IsActive, NOT DELETE, retires a link. A company that stops selling a motion keeps
-- its open and historical deals on that pipeline; an inactive link stops new deals
-- from choosing it without orphaning the old ones.
--
-- THE BACKFILL. Every existing pipeline gets one active link to the company it
-- belonged to. Every existing deal's CompanyID already equals its pipeline's
-- company, so every existing deal passes the new check unchanged.
--
-- UQ_Pipeline_Company_Code GOES WITH THE COLUMN, AND NOTHING REPLACES IT. Code was
-- unique per company, and #327's copies share a Code across companies by design,
-- so a database-wide unique Code would fail on any deployment that ran the copy
-- action. Merging those copies into one linked pipeline moves deals and stages, and
-- is left to a deployment rather than done blind here.
-- =============================================================================

CREATE TABLE __mj_BizAppsSales."PipelineCompany" (
 "ID" UUID NOT NULL DEFAULT gen_random_uuid(),
 "PipelineID" UUID NOT NULL,
 "CompanyID" UUID NOT NULL,
 "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
 CONSTRAINT "PK_PipelineCompany" PRIMARY KEY ("ID"),
 CONSTRAINT "UQ_PipelineCompany_Pipeline_Company" UNIQUE ("PipelineID", "CompanyID"),
 CONSTRAINT "FK_PipelineCompany_Pipeline" FOREIGN KEY ("PipelineID")
 REFERENCES __mj_BizAppsSales."Pipeline" ("ID"),
 CONSTRAINT "FK_PipelineCompany_Company" FOREIGN KEY ("CompanyID")
 REFERENCES ${mjSchema}."Company" ("ID")
);

-- Moves existing data, not seed data: one link per pipeline, to the company it had.
-- The two seeded pipelines, where they still sit on the seeded Default Company, take
-- the link IDs metadata/pipelines declares for that same pair. Otherwise the next
-- metadata push would insert its own row for the pair and fail on the unique key.
INSERT INTO "__mj_BizAppsSales"."PipelineCompany" ("ID", "PipelineID", "CompanyID", "IsActive")
SELECT
    CASE
        WHEN c."Name" = 'Default Company' AND p."ID" = '90111111-0000-4000-A000-000000000001'
            THEN '260583E6-38B7-40E1-84AD-744153E5F624'
        WHEN c."Name" = 'Default Company' AND p."ID" = '90111111-0000-4000-A000-000000000002'
            THEN 'ABE024DA-8A45-40BA-B3F1-5B7B6A2713BE'
        ELSE gen_random_uuid()
    END,
    p."ID", p."CompanyID", TRUE
FROM "__mj_BizAppsSales"."Pipeline" p
JOIN ${mjSchema}."Company" c ON c."ID" = p."CompanyID";

-- vwPipelines selects the column being dropped, and PostgreSQL refuses to drop a column a
-- view depends on. Dropped here, ahead of the column; CodeGen's block below recreates it.
DROP VIEW __mj_BizAppsSales."vwPipelines";

-- The FK index is CodeGen's, created when the column was registered.
DROP INDEX __mj_BizAppsSales."IDX_AUTO_MJ_FKEY_Pipeline_CompanyID";

ALTER TABLE __mj_BizAppsSales."Pipeline" DROP CONSTRAINT "UQ_Pipeline_Company_Code";

ALTER TABLE __mj_BizAppsSales."Pipeline" DROP CONSTRAINT "FK_Pipeline_Company";

ALTER TABLE __mj_BizAppsSales."Pipeline" DROP COLUMN "CompanyID";

ALTER TABLE __mj_BizAppsSales."PipelineCompany"
 ADD COLUMN IF NOT EXISTS "__mj_CreatedAt" TIMESTAMPTZ NULL;

/* SQL text to add special date field __mj_UpdatedAt to entity __mj_BizAppsSales.PipelineCompany */
ALTER TABLE __mj_BizAppsSales."PipelineCompany"
 ADD COLUMN IF NOT EXISTS "__mj_UpdatedAt" TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_PipelineCompany_PipelineID" ON __mj_BizAppsSales."PipelineCompany" ("PipelineID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_PipelineCompany_CompanyID" ON __mj_BizAppsSales."PipelineCompany" ("CompanyID");

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
    "mjBizAppsSalesDealType_DealTypeID"."Name" AS "DealType",
    "mjBizAppsSalesForecastCategoryType_DefaultForecastCategoryTypeID"."Name" AS "DefaultForecastCategoryType",
    "mjBizAppsCommonPerson_CloseWonAssigneePersonID"."DisplayName" AS "CloseWonAssigneePerson"
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

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsSales';
  v_target_name CONSTANT TEXT := 'vwPipelineCompanies';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW __mj_BizAppsSales."vwPipelineCompanies"
AS SELECT
    p.*,
    "mjBizAppsSalesPipeline_PipelineID"."Name" AS "Pipeline",
    "MJCompany_CompanyID"."Name" AS "Company"
FROM
    __mj_BizAppsSales."PipelineCompany" AS p
INNER JOIN
    __mj_BizAppsSales."Pipeline" AS "mjBizAppsSalesPipeline_PipelineID"
  ON
    p."PipelineID" = "mjBizAppsSalesPipeline_PipelineID"."ID"
INNER JOIN
    ${mjSchema}."Company" AS "MJCompany_CompanyID"
  ON
    p."CompanyID" = "MJCompany_CompanyID"."ID"$vsql$;
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

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spCreatePipelineCompany]
--     @ID UUID = NULL,
--     @PipelineID UUID,
--     @CompanyID UUID,
--     @IsActive bit = NULL
-- AS
-- BEGIN
--    ...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spUpdatePipelineCompany]
--     @ID UUID,
--     @PipelineID UUID = NULL,
--     @CompanyID UUID = NULL,
--     @IsActive bit = NULL
-- AS
-- BE...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spDeletePipelineCompany]
--     @ID UUID
-- AS
-- BEGIN
--     SET NOCOUNT ON;
-- 
--     DELETE FROM
--         [__mj_BizAppsSales].[PipelineCompany]
--     WHERE
--         [I...


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

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsSales].trgUpdatePipelineCompany
-- ON "__mj_BizAppsSales"."PipelineCompany"
-- AFTER UPDATE
-- AS
-- BEGIN
--     SET NOCOUNT ON;
--     UPDATE
--         "__mj_BizAppsSales"."PipelineCompany"


-- ===================== Data (INSERT/UPDATE/DELETE) =====================


-- CodeGen removes the EntityField rows for a dropped column (and the view's
-- virtual name column over it) in a recurring prune, and omitRecurringScriptsFromLog
-- keeps that prune out of the block below. The prune itself may not ship
-- (check-migration-no-prune), so the two rows are named here instead, so a host
-- installed from migrations loses them too.
DELETE FROM ${mjSchema}."EntityFieldValue"
WHERE "EntityFieldID" IN (
    SELECT "ID" FROM ${mjSchema}."EntityField"
    WHERE "EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2'
      AND "Name" IN ('CompanyID', 'Company')
);

DELETE FROM ${mjSchema}."EntityField"
WHERE "EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2'
  AND "Name" IN ('CompanyID', 'Company');

-- The Companies -> Pipelines relationship joined on the dropped column. CodeGen
-- creates relationships but does not remove one whose join field is gone.
DELETE FROM ${mjSchema}."EntityRelationship"
WHERE "ID" = '595f4beb-f95d-4ce5-a495-8c253db46f13';

INSERT INTO ${mjSchema}."Entity" (
         "ID",
         "Name",
         "DisplayName",
         "Description",
         "NameSuffix",
         "BaseTable",
         "BaseView",
         "SchemaName",
         "IncludeInAPI",
         "AllowUserSearchAPI",
         "AllowCaching"
         , "TrackRecordChanges"
         , "AuditRecordAccess"
         , "AuditViewRuns"
         , "AllowAllRowsAPI"
         , "AllowCreateAPI"
         , "AllowUpdateAPI"
         , "AllowDeleteAPI"
         , "UserViewMaxRows"
         , "__mj_CreatedAt"
         , "__mj_UpdatedAt"
      )
      VALUES (
         '521b0001-bbdc-4e58-9140-84684053e091',
         'MJ_BizApps_Sales: Pipeline Companies',
         'Pipeline Companies',
         'Links a pipeline to a company that sells through it. A pipeline can serve several companies; a deal''s company must be actively linked to the deal''s pipeline.',
         NULL,
         'PipelineCompany',
         'vwPipelineCompanies',
         '__mj_BizAppsSales',
         TRUE,
         TRUE,
         FALSE
         , TRUE
         , FALSE
         , FALSE
         , FALSE
         , TRUE
         , TRUE
         , TRUE
         , 1000
         , NOW()
         , NOW()
      );

/* SQL generated to add new entity MJ_BizApps_Sales: Pipeline Companies to application ID: '60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D' */

INSERT INTO ${mjSchema}."ApplicationEntity"
                                       ("ApplicationID", "EntityID", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES
                                       ('60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D', '521b0001-bbdc-4e58-9140-84684053e091', (SELECT COALESCE(MAX("Sequence"),0)+1 FROM ${mjSchema}."ApplicationEntity" WHERE "ApplicationID" = '60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D'), NOW(), NOW());

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Pipeline Companies for role UI */

INSERT INTO ${mjSchema}."EntityPermission"
                ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
              SELECT CAST('521b0001-bbdc-4e58-9140-84684053e091' AS UUID), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', TRUE, FALSE, FALSE, FALSE, NOW(), NOW()
              WHERE NOT EXISTS (
                SELECT 1 FROM ${mjSchema}."EntityPermission"
                WHERE "EntityID" = CAST('521b0001-bbdc-4e58-9140-84684053e091' AS UUID) AND "RoleID" = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Pipeline Companies for role Developer */

INSERT INTO ${mjSchema}."EntityPermission"
                ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
              SELECT CAST('521b0001-bbdc-4e58-9140-84684053e091' AS UUID), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', TRUE, TRUE, TRUE, TRUE, NOW(), NOW()
              WHERE NOT EXISTS (
                SELECT 1 FROM ${mjSchema}."EntityPermission"
                WHERE "EntityID" = CAST('521b0001-bbdc-4e58-9140-84684053e091' AS UUID) AND "RoleID" = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Pipeline Companies for role Integration */

INSERT INTO ${mjSchema}."EntityPermission"
                ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
              SELECT CAST('521b0001-bbdc-4e58-9140-84684053e091' AS UUID), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', TRUE, TRUE, TRUE, TRUE, NOW(), NOW()
              WHERE NOT EXISTS (
                SELECT 1 FROM ${mjSchema}."EntityPermission"
                WHERE "EntityID" = CAST('521b0001-bbdc-4e58-9140-84684053e091' AS UUID) AND "RoleID" = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow'
              );

/* SQL text to add special date field __mj_CreatedAt to entity __mj_BizAppsSales."PipelineCompany" */

/* SQL text to add special date field __mj_CreatedAt to entity __mj_BizAppsSales."PipelineCompany" */
UPDATE "__mj_BizAppsSales"."PipelineCompany" SET "__mj_CreatedAt" = NOW() WHERE "__mj_CreatedAt" IS NULL;

/* SQL text to add special date field __mj_CreatedAt to entity __mj_BizAppsSales.PipelineCompany */
ALTER TABLE __mj_BizAppsSales."PipelineCompany" ALTER COLUMN "__mj_CreatedAt" SET NOT NULL;

ALTER TABLE __mj_BizAppsSales."PipelineCompany"
  ALTER COLUMN "__mj_CreatedAt" SET DEFAULT NOW();

/* SQL text to add special date field __mj_UpdatedAt to entity __mj_BizAppsSales."PipelineCompany" */
UPDATE "__mj_BizAppsSales"."PipelineCompany" SET "__mj_UpdatedAt" = NOW() WHERE "__mj_UpdatedAt" IS NULL;

/* SQL text to add special date field __mj_UpdatedAt to entity __mj_BizAppsSales.PipelineCompany */
ALTER TABLE __mj_BizAppsSales."PipelineCompany" ALTER COLUMN "__mj_UpdatedAt" SET NOT NULL;

ALTER TABLE __mj_BizAppsSales."PipelineCompany"
  ALTER COLUMN "__mj_UpdatedAt" SET DEFAULT NOW();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '3e69c865-0f3a-4c4e-9aad-b3ebd07e9b4b' OR ("EntityID" = '521B0001-BBDC-4E58-9140-84684053E091' AND "Name" = 'ID')
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
        '3e69c865-0f3a-4c4e-9aad-b3ebd07e9b4b',
        '521B0001-BBDC-4E58-9140-84684053E091', -- "Entity": "MJ_BizApps_Sales": "Pipeline" "Companies"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '521B0001-BBDC-4E58-9140-84684053E091'),
        'ID',
        'ID',
        NULL,
        'UUID',
        16,
        0,
        0,
        FALSE,
        'gen_random_uuid()',
        FALSE,
        FALSE,
        FALSE,
        FALSE,
        NULL,
        NULL,
        FALSE,
        FALSE,
        FALSE,
        FALSE,
        TRUE,
        TRUE,
        'Search',
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'be0ae21a-e34e-475e-ab64-736786c1b6ed' OR ("EntityID" = '521B0001-BBDC-4E58-9140-84684053E091' AND "Name" = 'PipelineID')
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
        'be0ae21a-e34e-475e-ab64-736786c1b6ed',
        '521B0001-BBDC-4E58-9140-84684053E091', -- "Entity": "MJ_BizApps_Sales": "Pipeline" "Companies"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '521B0001-BBDC-4E58-9140-84684053E091'),
        'PipelineID',
        'Pipeline ID',
        'The pipeline the company sells through.',
        'UUID',
        16,
        0,
        0,
        FALSE,
        NULL,
        FALSE,
        TRUE,
        FALSE,
        FALSE,
        'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2',
        'ID',
        FALSE,
        FALSE,
        TRUE,
        FALSE,
        FALSE,
        TRUE,
        'Search',
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'a40a7c69-895d-4ff3-9f73-7e5ce26014e7' OR ("EntityID" = '521B0001-BBDC-4E58-9140-84684053E091' AND "Name" = 'CompanyID')
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
        'a40a7c69-895d-4ff3-9f73-7e5ce26014e7',
        '521B0001-BBDC-4E58-9140-84684053E091', -- "Entity": "MJ_BizApps_Sales": "Pipeline" "Companies"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '521B0001-BBDC-4E58-9140-84684053E091'),
        'CompanyID',
        'Company ID',
        'The selling company. Deals for this company can use the pipeline while the link is active.',
        'UUID',
        16,
        0,
        0,
        FALSE,
        NULL,
        FALSE,
        TRUE,
        FALSE,
        FALSE,
        'D4238F34-2837-EF11-86D4-6045BDEE16E6',
        'ID',
        FALSE,
        FALSE,
        TRUE,
        FALSE,
        FALSE,
        TRUE,
        'Search',
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'c6d698a3-d493-4015-823c-16276f8d2532' OR ("EntityID" = '521B0001-BBDC-4E58-9140-84684053E091' AND "Name" = 'IsActive')
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
        'c6d698a3-d493-4015-823c-16276f8d2532',
        '521B0001-BBDC-4E58-9140-84684053E091', -- "Entity": "MJ_BizApps_Sales": "Pipeline" "Companies"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '521B0001-BBDC-4E58-9140-84684053E091'),
        'IsActive',
        'Is Active',
        'Whether new deals for the company can choose the pipeline. Clearing it retires the link without touching existing deals on the pipeline.',
        'BOOLEAN',
        1,
        1,
        0,
        FALSE,
        '(1)',
        FALSE,
        TRUE,
        FALSE,
        FALSE,
        NULL,
        NULL,
        FALSE,
        FALSE,
        FALSE,
        TRUE,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '834e59d4-6d31-40cc-8c30-6e64333ded91' OR ("EntityID" = '521B0001-BBDC-4E58-9140-84684053E091' AND "Name" = '__mj_CreatedAt')
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
        '834e59d4-6d31-40cc-8c30-6e64333ded91',
        '521B0001-BBDC-4E58-9140-84684053E091', -- "Entity": "MJ_BizApps_Sales": "Pipeline" "Companies"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '521B0001-BBDC-4E58-9140-84684053E091'),
        '__mj_CreatedAt',
        'Created At',
        NULL,
        'TIMESTAMPTZ',
        10,
        34,
        7,
        FALSE,
        'NOW()',
        FALSE,
        FALSE,
        FALSE,
        FALSE,
        NULL,
        NULL,
        FALSE,
        FALSE,
        FALSE,
        TRUE,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '669f2939-93b2-41a5-ae37-49ebf9e852bd' OR ("EntityID" = '521B0001-BBDC-4E58-9140-84684053E091' AND "Name" = '__mj_UpdatedAt')
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
        '669f2939-93b2-41a5-ae37-49ebf9e852bd',
        '521B0001-BBDC-4E58-9140-84684053E091', -- "Entity": "MJ_BizApps_Sales": "Pipeline" "Companies"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '521B0001-BBDC-4E58-9140-84684053E091'),
        '__mj_UpdatedAt',
        'Updated At',
        NULL,
        'TIMESTAMPTZ',
        10,
        34,
        7,
        FALSE,
        'NOW()',
        FALSE,
        FALSE,
        FALSE,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'f3d160de-39e3-4df3-af9e-4df4b3a01324' OR ("EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND "Name" = 'DealType')
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
        'f3d160de-39e3-4df3-af9e-4df4b3a01324',
        'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', -- "Entity": "MJ_BizApps_Sales": "Pipelines"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2'),
        'DealType',
        'Deal Type',
        NULL,
        'TEXT',
        400,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'c61a870a-69cb-4149-ae4d-80b4ae4d0200' OR ("EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND "Name" = 'DefaultForecastCategoryType')
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
        'c61a870a-69cb-4149-ae4d-80b4ae4d0200',
        'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', -- "Entity": "MJ_BizApps_Sales": "Pipelines"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2'),
        'DefaultForecastCategoryType',
        'Default Forecast Category Type',
        NULL,
        'TEXT',
        400,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '34172e71-9ea6-4a0b-8ffe-e3f8a19b31da' OR ("EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND "Name" = 'CloseWonAssigneePerson')
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
        '34172e71-9ea6-4a0b-8ffe-e3f8a19b31da',
        'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', -- "Entity": "MJ_BizApps_Sales": "Pipelines"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2'),
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship" WHERE "ID" = '4333b452-b348-4c5d-a53b-7f62ad63768e'
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('4333b452-b348-4c5d-a53b-7f62ad63768e', 'D4238F34-2837-EF11-86D4-6045BDEE16E6', '521B0001-BBDC-4E58-9140-84684053E091', 'CompanyID', 'One To Many', TRUE, TRUE, 37, NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship" WHERE "ID" = 'affbbcb7-1bea-4480-895e-fb5e08d17251'
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('affbbcb7-1bea-4480-895e-fb5e08d17251', 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', '521B0001-BBDC-4E58-9140-84684053E091', 'PipelineID', 'One To Many', TRUE, TRUE, 5, NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'd5db2957-d48d-419b-832d-13874b9f5434' OR ("EntityID" = '521B0001-BBDC-4E58-9140-84684053E091' AND "Name" = 'Pipeline')
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
        'd5db2957-d48d-419b-832d-13874b9f5434',
        '521B0001-BBDC-4E58-9140-84684053E091', -- "Entity": "MJ_BizApps_Sales": "Pipeline" "Companies"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '521B0001-BBDC-4E58-9140-84684053E091'),
        'Pipeline',
        'Pipeline',
        NULL,
        'TEXT',
        400,
        0,
        0,
        FALSE,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '10fcb066-6181-4333-872f-ec03d30ea7aa' OR ("EntityID" = '521B0001-BBDC-4E58-9140-84684053E091' AND "Name" = 'Company')
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
        '10fcb066-6181-4333-872f-ec03d30ea7aa',
        '521B0001-BBDC-4E58-9140-84684053E091', -- "Entity": "MJ_BizApps_Sales": "Pipeline" "Companies"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '521B0001-BBDC-4E58-9140-84684053E091'),
        'Company',
        'Company',
        NULL,
        'TEXT',
        100,
        0,
        0,
        FALSE,
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

UPDATE ${mjSchema}."EntityField"
               SET "DefaultInView" = TRUE
               WHERE "ID" = 'D5DB2957-D48D-419B-832D-13874B9F5434'
               AND "AutoUpdateDefaultInView" = TRUE;

UPDATE ${mjSchema}."EntityField"
               SET "DefaultInView" = TRUE
               WHERE "ID" = '10FCB066-6181-4333-872F-EC03D30EA7AA'
               AND "AutoUpdateDefaultInView" = TRUE;

UPDATE ${mjSchema}."Entity"
            SET "AllowUserSearchAPI" = FALSE
            WHERE "ID" = '521B0001-BBDC-4E58-9140-84684053E091'
            AND "AutoUpdateAllowUserSearchAPI" = TRUE;

/* Set categories for 3 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.DealType

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Deal & Forecast Settings',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'F3D160DE-39E3-4DF3-AF9E-4DF4B3A01324';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.DefaultForecastCategoryType

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Deal & Forecast Settings',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Default Forecast Category'
WHERE 
   "ID" = 'C61A870A-69CB-4149-AE4D-80B4AE4D0200';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipelines.CloseWonAssigneePerson

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Automation & Policies',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Close Won Assignee'
WHERE 
   "ID" = '34172E71-9EA6-4A0B-8FFE-E3F8A19B31DA';

/* Set categories for 8 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipeline Companies.ID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '3E69C865-0F3A-4C4E-9AAD-B3EBD07E9B4B';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipeline Companies.PipelineID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Pipeline Assignment',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'BE0AE21A-E34E-475E-AB64-736786C1B6ED';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipeline Companies.Pipeline

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Pipeline Assignment',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Pipeline Name'
WHERE 
   "ID" = 'D5DB2957-D48D-419B-832D-13874B9F5434';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipeline Companies.CompanyID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Pipeline Assignment',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'A40A7C69-895D-4FF3-9F73-7E5CE26014E7';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipeline Companies.Company

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Pipeline Assignment',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Company Name'
WHERE 
   "ID" = '10FCB066-6181-4333-872F-EC03D30EA7AA';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipeline Companies.IsActive

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Status and Configuration',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'C6D698A3-D493-4015-823C-16276F8D2532';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipeline Companies.__mj_CreatedAt

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '834E59D4-6D31-40CC-8C30-6E64333DED91';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Pipeline Companies.__mj_UpdatedAt

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '669F2939-93B2-41A5-AE37-49EBF9E852BD';

/* Set entity icon to fa fa-link */

UPDATE ${mjSchema}."Entity"
               SET "Icon" = 'fa fa-link', "__mj_UpdatedAt" = NOW()
               WHERE "ID" = '521B0001-BBDC-4E58-9140-84684053E091';

/* Insert FieldCategoryInfo setting for entity */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntitySetting" WHERE "EntityID" = '521B0001-BBDC-4E58-9140-84684053E091' AND "Name" = 'FieldCategoryInfo'
    ) THEN
        INSERT INTO ${mjSchema}."EntitySetting" ("ID", "EntityID", "Name", "Value", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('416deab3-1ed8-5b55-8936-7aa25536f8bf', '521B0001-BBDC-4E58-9140-84684053E091', 'FieldCategoryInfo', '{
        "Pipeline Assignment": {
        "description": "Links between pipelines and companies",
        "icon": "fa fa-link"
        },
        "Status and Configuration": {
        "description": "Operational settings and status toggles",
        "icon": "fa fa-sliders-h"
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
        SELECT 1 FROM ${mjSchema}."EntitySetting" WHERE "EntityID" = '521B0001-BBDC-4E58-9140-84684053E091' AND "Name" = 'FieldCategoryIcons'
    ) THEN
        INSERT INTO ${mjSchema}."EntitySetting" ("ID", "EntityID", "Name", "Value", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('949b86e7-073d-52af-98b3-4c6ed3c43b46', '521B0001-BBDC-4E58-9140-84684053E091', 'FieldCategoryIcons', '{
        "Pipeline Assignment": "fa fa-link",
        "Status and Configuration": "fa fa-sliders-h",
        "System Metadata": "fa fa-cog"
        }', NOW(), NOW());
    END IF;
END $$;

UPDATE ${mjSchema}."ApplicationEntity"
         SET "DefaultForNewUser" = FALSE, "__mj_UpdatedAt" = NOW()
         WHERE "EntityID" = '521B0001-BBDC-4E58-9140-84684053E091';


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
/* SQL text to update entity field related entity name field map for entity field ID A40A7C69-895D-4FF3-9F73-7E5CE26014E7 */

DO $$ BEGIN GRANT SELECT ON __mj_BizAppsSales."vwPipelineCompanies" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* Base View Permissions SQL for MJ_BizApps_Sales: Pipeline Companies */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Pipeline Companies
-- Item: Permissions for vwPipelineCompanies
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

DO $$ BEGIN GRANT SELECT ON __mj_BizAppsSales."vwPipelineCompanies" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate SQL for MJ_BizApps_Sales: Pipeline Companies */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Pipeline Companies
-- Item: spCreatePipelineCompany
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR PipelineCompany
------------------------------------------------------------;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreatePipelineCompany" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Sales: Pipeline Companies */

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreatePipelineCompany" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spUpdate SQL for MJ_BizApps_Sales: Pipeline Companies */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Pipeline Companies
-- Item: spUpdatePipelineCompany
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR PipelineCompany
------------------------------------------------------------;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdatePipelineCompany" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdatePipelineCompany" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete SQL for MJ_BizApps_Sales: Pipeline Companies */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Pipeline Companies
-- Item: spDeletePipelineCompany
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR PipelineCompany
------------------------------------------------------------;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spDeletePipelineCompany" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete Permissions for MJ_BizApps_Sales: Pipeline Companies */

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spDeletePipelineCompany" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* SQL text to insert 2 new entity field(s) */


-- ===================== Comments =====================

COMMENT ON TABLE __mj_BizAppsSales."PipelineCompany" IS 'Links a pipeline to a company that sells through it. A pipeline can serve several companies; a deal''s company must be actively linked to the deal''s pipeline.';

COMMENT ON COLUMN __mj_BizAppsSales."PipelineCompany"."PipelineID" IS 'The pipeline the company sells through.';

COMMENT ON COLUMN __mj_BizAppsSales."PipelineCompany"."CompanyID" IS 'The selling company. Deals for this company can use the pipeline while the link is active.';

COMMENT ON COLUMN __mj_BizAppsSales."PipelineCompany"."IsActive" IS 'Whether new deals for the company can choose the pipeline. Clearing it retires the link without touching existing deals on the pipeline.';

COMMENT ON TABLE __mj_BizAppsSales."Pipeline" IS 'A sales pipeline: an ordered set of stages a deal moves through. Serves every company it is actively linked to through PipelineCompany.';

COMMENT ON COLUMN __mj_BizAppsSales."Pipeline"."Code" IS 'Short code for the pipeline. Not unique: deployments that copied the default pipeline per company hold several pipelines with the same code.';

COMMENT ON COLUMN __mj_BizAppsSales."Deal"."CompanyID" IS 'The SELLING company, chosen by the rep. Must be actively linked to the deal''s pipeline through PipelineCompany; enforced by the entity server, since a CHECK cannot reach across the link. FK to __mj.Company.';


-- ===================== Other =====================


-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================
/* SQL generated to create new entity MJ_BizApps_Sales: Pipeline Companies */

/* SQL text to insert 9 new entity field(s) */

/* spUpdate Permissions for MJ_BizApps_Sales: Pipelines */

/* spUpdate Permissions for MJ_BizApps_Sales: Pipeline Companies */

-- =============================================================================
-- END OF CODEGEN OUTPUT. Hand-written from here.
-- =============================================================================
-- Entity-scoped field sync for PipelineCompany, as in the T-SQL file (written by hand: it follows
-- the CodeGen block the converter emitted).
SELECT * FROM ${mjSchema}."spUpdateExistingEntityFieldsFromSchema"('', '521B0001-BBDC-4E58-9140-84684053E091', '__mj_BizAppsSales');
