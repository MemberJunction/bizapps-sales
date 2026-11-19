-- =============================================================================================
-- PostgreSQL counterpart of V202611191600__v6.33.x__Deal_Digest_Audiences.sql
-- =============================================================================================
-- `mj sql-convert --from tsql --to postgres --schema __mj_BizAppsSales` (MJ CLI 6.2.1) output,
-- finished by hand. The converter reported 0 errors, 151 batches converted and 18 skipped.
--   * The tables, constraints, indexes, views, metadata rows, grants and comments are the
--     converter's, including the whole CodeGen half of the SQL Server file.
--   * CodeGen's CRUD procedures (spCreate/spUpdate/spDelete) and its __mj_UpdatedAt triggers are
--     NOT here: the converter cannot translate T-SQL procedures or triggers, and marks each place
--     it skipped one. A PostgreSQL host runs `mj codegen` after installing, which generates them
--     natively. Those eight skips are the 18 the summary counts, with the SQL Server-only
--     statements the converter drops by design (sp_addextendedproperty, re-emitted as COMMENT ON).
--   * UQ_DealDigestRecipient IS `NULLS NOT DISTINCT` (PostgreSQL 15+), WRITTEN BY HAND. The
--     converter emits a plain UNIQUE. SQL Server treats two NULL CompanyIDs as equal in a UNIQUE
--     constraint and that is the intended rule — one portfolio-wide row per person per audience —
--     while PostgreSQL's default treats NULLs as distinct and would let a person hold the same
--     portfolio-wide row twice.
--   * The two foreign keys into ${mjSchema} name the QUOTED "ID" column, corrected by hand: the
--     converter emits `(ID)` unquoted, which folds to `id` and does not resolve. The same
--     correction is recorded in V202611062300__v6.25.x__Pipeline_Company_Link.pg.sql.
--   * The entity-scoped spUpdateExistingEntityFieldsFromSchema call at the end is WRITTEN BY HAND,
--     in the function form that file uses. The converter does not translate `EXEC`.
--   * No CHECK ties CompanyID to IsPortfolioWide; see the SQL Server file's header.
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
-- Lapsed Close Date Digest: who receives it, and what each audience's email says.
-- =============================================================================
-- The weekly digest lists open deals whose expected close date has passed or was
-- never set. Who gets it, and how it reads, is DATA rather than code, so a new
-- audience or a changed recipient never needs a release:
-- * DealDigestAudienceType: behaviour flags per audience (Company Leader, CEO,
-- CFO, CTO). The digest builder reads the flags, never the Code or Name.
-- * DealDigestRecipient: audience x company x employee.
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

CREATE TABLE __mj_BizAppsSales."DealDigestAudienceType" (
 "ID" UUID NOT NULL DEFAULT gen_random_uuid(),
 "Code" VARCHAR(50) NOT NULL,
 "Name" VARCHAR(100) NOT NULL,
 "Description" TEXT NULL,
 "IsPortfolioWide" BOOLEAN NOT NULL DEFAULT FALSE,
 "MinDaysLapsed" INTEGER NULL,
 "IncludeMissingCloseDate" BOOLEAN NOT NULL DEFAULT TRUE,
 "SendWhenEmpty" BOOLEAN NOT NULL DEFAULT FALSE,
 "GroupByCompany" BOOLEAN NOT NULL DEFAULT TRUE,
 "SubjectTemplate" VARCHAR(255) NULL,
 "IntroTemplate" TEXT NULL,
 "EmptyMessage" VARCHAR(500) NULL,
 "DisplayRank" INTEGER NOT NULL DEFAULT 0,
 "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
 CONSTRAINT "PK_DealDigestAudienceType" PRIMARY KEY ("ID"),
 CONSTRAINT "UQ_DealDigestAudienceType_Code" UNIQUE ("Code"),
 CONSTRAINT "CK_DealDigestAudienceType_MinDaysLapsed" CHECK ("MinDaysLapsed" IS NULL OR "MinDaysLapsed" >= 0)
);

CREATE TABLE __mj_BizAppsSales."DealDigestRecipient" (
 "ID" UUID NOT NULL DEFAULT gen_random_uuid(),
 "DealDigestAudienceTypeID" UUID NOT NULL,
 "CompanyID" UUID NULL,
 "EmployeeID" UUID NOT NULL,
 "IsActive" BOOLEAN NOT NULL DEFAULT TRUE,
 CONSTRAINT "PK_DealDigestRecipient" PRIMARY KEY ("ID"),
 CONSTRAINT "UQ_DealDigestRecipient" UNIQUE NULLS NOT DISTINCT ("DealDigestAudienceTypeID", "CompanyID", "EmployeeID"),
 CONSTRAINT "FK_DealDigestRecipient_DealDigestAudienceType" FOREIGN KEY ("DealDigestAudienceTypeID")
 REFERENCES __mj_BizAppsSales."DealDigestAudienceType" ("ID"),
 CONSTRAINT "FK_DealDigestRecipient_Company" FOREIGN KEY ("CompanyID")
 REFERENCES ${mjSchema}."Company" ("ID"),
 CONSTRAINT "FK_DealDigestRecipient_Employee" FOREIGN KEY ("EmployeeID")
 REFERENCES ${mjSchema}."Employee" ("ID")
);

ALTER TABLE __mj_BizAppsSales."DealDigestAudienceType"
 ADD COLUMN IF NOT EXISTS "__mj_CreatedAt" TIMESTAMPTZ NULL;

/* SQL text to add special date field __mj_UpdatedAt to entity __mj_BizAppsSales.DealDigestAudienceType */
ALTER TABLE __mj_BizAppsSales."DealDigestAudienceType"
 ADD COLUMN IF NOT EXISTS "__mj_UpdatedAt" TIMESTAMPTZ NULL;

/* SQL text to add special date field __mj_CreatedAt to entity __mj_BizAppsSales.DealDigestRecipient */
ALTER TABLE __mj_BizAppsSales."DealDigestRecipient"
 ADD COLUMN IF NOT EXISTS "__mj_CreatedAt" TIMESTAMPTZ NULL;

/* SQL text to add special date field __mj_UpdatedAt to entity __mj_BizAppsSales.DealDigestRecipient */
ALTER TABLE __mj_BizAppsSales."DealDigestRecipient"
 ADD COLUMN IF NOT EXISTS "__mj_UpdatedAt" TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_DealDigestRecipient_DealDigestAudienceTypeID" ON __mj_BizAppsSales."DealDigestRecipient" ("DealDigestAudienceTypeID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_DealDigestRecipient_CompanyID" ON __mj_BizAppsSales."DealDigestRecipient" ("CompanyID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_DealDigestRecipient_EmployeeID" ON __mj_BizAppsSales."DealDigestRecipient" ("EmployeeID");


-- ===================== Views =====================

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsSales';
  v_target_name CONSTANT TEXT := 'vwDealDigestAudienceTypes';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW __mj_BizAppsSales."vwDealDigestAudienceTypes"
AS SELECT
    d.*
FROM
    __mj_BizAppsSales."DealDigestAudienceType" AS d$vsql$;
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
  v_target_name CONSTANT TEXT := 'vwDealDigestRecipients';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW __mj_BizAppsSales."vwDealDigestRecipients"
AS SELECT
    d.*,
    "mjBizAppsSalesDealDigestAudienceType_DealDigestAudienceTypeID"."Name" AS "DealDigestAudienceType",
    "MJCompany_CompanyID"."Name" AS "Company",
    "MJEmployee_EmployeeID"."FirstLast" AS "Employee"
FROM
    __mj_BizAppsSales."DealDigestRecipient" AS d
INNER JOIN
    __mj_BizAppsSales."DealDigestAudienceType" AS "mjBizAppsSalesDealDigestAudienceType_DealDigestAudienceTypeID"
  ON
    d."DealDigestAudienceTypeID" = "mjBizAppsSalesDealDigestAudienceType_DealDigestAudienceTypeID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."Company" AS "MJCompany_CompanyID"
  ON
    d."CompanyID" = "MJCompany_CompanyID"."ID"
INNER JOIN
    ${mjSchema}."vwEmployees" AS "MJEmployee_EmployeeID"
  ON
    d."EmployeeID" = "MJEmployee_EmployeeID"."ID"$vsql$;
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
-- CREATE PROCEDURE [__mj_BizAppsSales].[spCreateDealDigestAudienceType]
--     @ID UUID = NULL,
--     @Code VARCHAR(50),
--     @Name VARCHAR(100),
--     @Description_Clear bit = 0,
--     @Description...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spUpdateDealDigestAudienceType]
--     @ID UUID,
--     @Code VARCHAR(50) = NULL,
--     @Name VARCHAR(100) = NULL,
--     @Description_Clear bit = 0,
--     @Desc...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spDeleteDealDigestAudienceType]
--     @ID UUID
-- AS
-- BEGIN
--     SET NOCOUNT ON;
-- 
--     DELETE FROM
--         [__mj_BizAppsSales].[DealDigestAudienceType]
--     WH...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spCreateDealDigestRecipient]
--     @ID UUID = NULL,
--     @DealDigestAudienceTypeID UUID,
--     @CompanyID_Clear bit = 0,
--     @CompanyID uniquei...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spUpdateDealDigestRecipient]
--     @ID UUID,
--     @DealDigestAudienceTypeID UUID = NULL,
--     @CompanyID_Clear bit = 0,
--     @CompanyID uniquei...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spDeleteDealDigestRecipient]
--     @ID UUID
-- AS
-- BEGIN
--     SET NOCOUNT ON;
-- 
--     DELETE FROM
--         [__mj_BizAppsSales].[DealDigestRecipient]
--     WHERE
--   ...


-- ===================== Triggers =====================

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsSales].trgUpdateDealDigestAudienceType
ON "__mj_BizAppsSales"."DealDigestAudienceType"
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        "__mj_BizAppsSales"."Dea

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsSales".trgUpdateDealDigestRecipient
ON "__mj_BizAppsSales"."DealDigestRecipient"
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        "__mj_BizAppsSales".[DealDiges


-- ===================== Data (INSERT/UPDATE/DELETE) =====================

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
         "AllowCaching",
         "TrackRecordChanges",
         "AuditRecordAccess",
         "AuditViewRuns",
         "AllowAllRowsAPI",
         "AllowCreateAPI",
         "AllowUpdateAPI",
         "AllowDeleteAPI",
         "UserViewMaxRows"
         , "__mj_CreatedAt"
         , "__mj_UpdatedAt"
      )
      VALUES (
         'b16a4047-9415-4f1b-9f6c-59104e788c53',
         'MJ_BizApps_Sales: Deal Digest Audience Types',
         'Deal Digest Audience Types',
         'One kind of audience for the Lapsed Close Date Digest (Company Leader, CEO, CFO, CTO). Behaviour comes from the flags on this row, never from the Code or Name: the digest builder reads IsPortfolioWide, MinDaysLapsed, IncludeMissingCloseDate, SendWhenEmpty and GroupByCompany, so adding an audience is a data change with no code impact.',
         NULL,
         'DealDigestAudienceType',
         'vwDealDigestAudienceTypes',
         '__mj_BizAppsSales',
         1,
         1,
         0,
         1,
         0,
         0,
         0,
         1,
         1,
         1,
         1000
         , NOW()
         , NOW()
      );

/* SQL generated to add entity MJ_BizApps_Sales: Deal Digest Audience Types to application ID: '60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D' */

INSERT INTO ${mjSchema}."ApplicationEntity"
                                    ("ApplicationID", "EntityID", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES
                                    ('60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D', 'b16a4047-9415-4f1b-9f6c-59104e788c53', (SELECT COALESCE(MAX("Sequence"),0)+1 FROM ${mjSchema}."ApplicationEntity" WHERE "ApplicationID" = '60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D'), NOW(), NOW());

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Deal Digest Audience Types for role UI */

INSERT INTO ${mjSchema}."EntityPermission"
                ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
              SELECT CAST('b16a4047-9415-4f1b-9f6c-59104e788c53' AS UUID), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', 1, 0, 0, 0, NOW(), NOW()
              WHERE NOT EXISTS (
                SELECT 1 FROM ${mjSchema}."EntityPermission"
                WHERE "EntityID" = CAST('b16a4047-9415-4f1b-9f6c-59104e788c53' AS UUID) AND "RoleID" = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Deal Digest Audience Types for role Developer */

INSERT INTO ${mjSchema}."EntityPermission"
                ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
              SELECT CAST('b16a4047-9415-4f1b-9f6c-59104e788c53' AS UUID), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', 1, 1, 1, 1, NOW(), NOW()
              WHERE NOT EXISTS (
                SELECT 1 FROM ${mjSchema}."EntityPermission"
                WHERE "EntityID" = CAST('b16a4047-9415-4f1b-9f6c-59104e788c53' AS UUID) AND "RoleID" = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Deal Digest Audience Types for role Integration */

INSERT INTO ${mjSchema}."EntityPermission"
                ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
              SELECT CAST('b16a4047-9415-4f1b-9f6c-59104e788c53' AS UUID), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', 1, 1, 1, 1, NOW(), NOW()
              WHERE NOT EXISTS (
                SELECT 1 FROM ${mjSchema}."EntityPermission"
                WHERE "EntityID" = CAST('b16a4047-9415-4f1b-9f6c-59104e788c53' AS UUID) AND "RoleID" = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow'
              );

/* SQL generated to create new entity MJ_BizApps_Sales: Deal Digest Recipients */

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
         "AllowCaching",
         "TrackRecordChanges",
         "AuditRecordAccess",
         "AuditViewRuns",
         "AllowAllRowsAPI",
         "AllowCreateAPI",
         "AllowUpdateAPI",
         "AllowDeleteAPI",
         "UserViewMaxRows"
         , "__mj_CreatedAt"
         , "__mj_UpdatedAt"
      )
      VALUES (
         '84246b5d-4431-489a-9186-df3c6de711ea',
         'MJ_BizApps_Sales: Deal Digest Recipients',
         'Deal Digest Recipients',
         'One person receiving one audience''s Lapsed Close Date Digest, for one company or, on a portfolio-wide audience, for all of them. The audience decides what the email contains; this row decides who gets it.',
         NULL,
         'DealDigestRecipient',
         'vwDealDigestRecipients',
         '__mj_BizAppsSales',
         1,
         1,
         0,
         1,
         0,
         0,
         0,
         1,
         1,
         1,
         1000
         , NOW()
         , NOW()
      );

/* SQL generated to add entity MJ_BizApps_Sales: Deal Digest Recipients to application ID: '60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D' */

INSERT INTO ${mjSchema}."ApplicationEntity"
                                    ("ApplicationID", "EntityID", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES
                                    ('60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D', '84246b5d-4431-489a-9186-df3c6de711ea', (SELECT COALESCE(MAX("Sequence"),0)+1 FROM ${mjSchema}."ApplicationEntity" WHERE "ApplicationID" = '60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D'), NOW(), NOW());

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Deal Digest Recipients for role UI */

INSERT INTO ${mjSchema}."EntityPermission"
                ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
              SELECT CAST('84246b5d-4431-489a-9186-df3c6de711ea' AS UUID), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', 1, 0, 0, 0, NOW(), NOW()
              WHERE NOT EXISTS (
                SELECT 1 FROM ${mjSchema}."EntityPermission"
                WHERE "EntityID" = CAST('84246b5d-4431-489a-9186-df3c6de711ea' AS UUID) AND "RoleID" = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Deal Digest Recipients for role Developer */

INSERT INTO ${mjSchema}."EntityPermission"
                ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
              SELECT CAST('84246b5d-4431-489a-9186-df3c6de711ea' AS UUID), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', 1, 1, 1, 1, NOW(), NOW()
              WHERE NOT EXISTS (
                SELECT 1 FROM ${mjSchema}."EntityPermission"
                WHERE "EntityID" = CAST('84246b5d-4431-489a-9186-df3c6de711ea' AS UUID) AND "RoleID" = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Deal Digest Recipients for role Integration */

INSERT INTO ${mjSchema}."EntityPermission"
                ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
              SELECT CAST('84246b5d-4431-489a-9186-df3c6de711ea' AS UUID), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', 1, 1, 1, 1, NOW(), NOW()
              WHERE NOT EXISTS (
                SELECT 1 FROM ${mjSchema}."EntityPermission"
                WHERE "EntityID" = CAST('84246b5d-4431-489a-9186-df3c6de711ea' AS UUID) AND "RoleID" = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow'
              );

/* SQL text to add special date field __mj_CreatedAt to entity __mj_BizAppsSales."DealDigestAudienceType" */

/* SQL text to add special date field __mj_CreatedAt to entity __mj_BizAppsSales."DealDigestAudienceType" */
UPDATE "__mj_BizAppsSales"."DealDigestAudienceType" SET "__mj_CreatedAt" = NOW() WHERE "__mj_CreatedAt" IS NULL;

/* SQL text to add special date field __mj_CreatedAt to entity __mj_BizAppsSales.DealDigestAudienceType */
ALTER TABLE __mj_BizAppsSales."DealDigestAudienceType" ALTER COLUMN "__mj_CreatedAt" SET NOT NULL;

ALTER TABLE __mj_BizAppsSales."DealDigestAudienceType"
  ALTER COLUMN "__mj_CreatedAt" SET DEFAULT NOW();

/* SQL text to add special date field __mj_UpdatedAt to entity __mj_BizAppsSales."DealDigestAudienceType" */
UPDATE "__mj_BizAppsSales"."DealDigestAudienceType" SET "__mj_UpdatedAt" = NOW() WHERE "__mj_UpdatedAt" IS NULL;

/* SQL text to add special date field __mj_UpdatedAt to entity __mj_BizAppsSales.DealDigestAudienceType */
ALTER TABLE __mj_BizAppsSales."DealDigestAudienceType" ALTER COLUMN "__mj_UpdatedAt" SET NOT NULL;

ALTER TABLE __mj_BizAppsSales."DealDigestAudienceType"
  ALTER COLUMN "__mj_UpdatedAt" SET DEFAULT NOW();

/* SQL text to add special date field __mj_CreatedAt to entity __mj_BizAppsSales."DealDigestRecipient" */
UPDATE "__mj_BizAppsSales"."DealDigestRecipient" SET "__mj_CreatedAt" = NOW() WHERE "__mj_CreatedAt" IS NULL;

/* SQL text to add special date field __mj_CreatedAt to entity __mj_BizAppsSales.DealDigestRecipient */
ALTER TABLE __mj_BizAppsSales."DealDigestRecipient" ALTER COLUMN "__mj_CreatedAt" SET NOT NULL;

ALTER TABLE __mj_BizAppsSales."DealDigestRecipient"
  ALTER COLUMN "__mj_CreatedAt" SET DEFAULT NOW();

/* SQL text to add special date field __mj_UpdatedAt to entity __mj_BizAppsSales."DealDigestRecipient" */
UPDATE "__mj_BizAppsSales"."DealDigestRecipient" SET "__mj_UpdatedAt" = NOW() WHERE "__mj_UpdatedAt" IS NULL;

/* SQL text to add special date field __mj_UpdatedAt to entity __mj_BizAppsSales.DealDigestRecipient */
ALTER TABLE __mj_BizAppsSales."DealDigestRecipient" ALTER COLUMN "__mj_UpdatedAt" SET NOT NULL;

ALTER TABLE __mj_BizAppsSales."DealDigestRecipient"
  ALTER COLUMN "__mj_UpdatedAt" SET DEFAULT NOW();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'ad7259cd-c7e9-4599-b118-2748beb3b1b4' OR ("EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND "Name" = 'ID')
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
        'ad7259cd-c7e9-4599-b118-2748beb3b1b4',
        'B16A4047-9415-4F1B-9F6C-59104E788C53', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Audience" "Types"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
        'ID',
        'ID',
        NULL,
        'UUID',
        16,
        0,
        0,
        0,
        'gen_random_uuid()',
        0,
        0,
        0,
        0,
        NULL,
        NULL,
        0,
        0,
        0,
        0,
        1,
        1,
        'Search',
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '413e6bb6-7ab6-4987-9149-b6ce0d9a8729' OR ("EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND "Name" = 'Code')
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
        '413e6bb6-7ab6-4987-9149-b6ce0d9a8729',
        'B16A4047-9415-4F1B-9F6C-59104E788C53', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Audience" "Types"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
        'Code',
        'Code',
        'Stable identifier the seeds and the digest builder key on. Renaming Name is cosmetic; renaming Code changes an identifier.',
        'TEXT',
        100,
        0,
        0,
        0,
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
        1,
        0,
        1,
        'Search',
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'fb29262f-f418-444a-86b7-633df8a0e2fb' OR ("EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND "Name" = 'Name')
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
        'fb29262f-f418-444a-86b7-633df8a0e2fb',
        'B16A4047-9415-4F1B-9F6C-59104E788C53', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Audience" "Types"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
        'Name',
        'Name',
        'Display name of the audience, as shown to the people who administer recipients.',
        'TEXT',
        200,
        0,
        0,
        0,
        NULL,
        0,
        1,
        0,
        0,
        NULL,
        NULL,
        1,
        1,
        0,
        1,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '0afaa0e7-f80b-4d2d-ad1d-3593a0a50598' OR ("EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND "Name" = 'Description')
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
        '0afaa0e7-f80b-4d2d-ad1d-3593a0a50598',
        'B16A4047-9415-4F1B-9F6C-59104E788C53', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Audience" "Types"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
        'Description',
        'Description',
        'What this audience is for and who belongs in it.',
        'TEXT',
        -1,
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
        1,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '3689b893-4c73-451c-a1fe-54eb9f51480b' OR ("EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND "Name" = 'IsPortfolioWide')
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
        '3689b893-4c73-451c-a1fe-54eb9f51480b',
        'B16A4047-9415-4F1B-9F6C-59104E788C53', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Audience" "Types"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
        'IsPortfolioWide',
        'Is Portfolio Wide',
        'When 1, recipients of this audience receive one digest covering every company, and their recipient rows carry no Company. When 0, each recipient row names the company the digest covers. Enforced in the recipient''s Save(), not by a CHECK, because it ties a column on this table to one on another.',
        'BOOLEAN',
        1,
        1,
        0,
        0,
        '(0)',
        0,
        1,
        0,
        0,
        NULL,
        NULL,
        0,
        0,
        0,
        1,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '62a9c710-a1be-413a-9433-ba97779e4cf2' OR ("EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND "Name" = 'MinDaysLapsed')
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
        '62a9c710-a1be-413a-9433-ba97779e4cf2',
        'B16A4047-9415-4F1B-9F6C-59104E788C53', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Audience" "Types"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
        'MinDaysLapsed',
        'Min Days Lapsed',
        'A deal appears only once its expected close date is at least this many days past. Empty means no minimum: any deal whose date has passed appears. Never negative.',
        'INTEGER',
        4,
        10,
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '537b6ac9-cd1b-42a7-86ab-c60e7e09c83b' OR ("EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND "Name" = 'IncludeMissingCloseDate')
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
        '537b6ac9-cd1b-42a7-86ab-c60e7e09c83b',
        'B16A4047-9415-4F1B-9F6C-59104E788C53', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Audience" "Types"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
        'IncludeMissingCloseDate',
        'Include Missing Close Date',
        'When 1, open deals that never had an expected close date are listed too, after the lapsed ones. When 0 only deals whose date has passed appear.',
        'BOOLEAN',
        1,
        1,
        0,
        0,
        '(1)',
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '3dcf0226-63ee-4526-9dcc-ca31720cea62' OR ("EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND "Name" = 'SendWhenEmpty')
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
        '3dcf0226-63ee-4526-9dcc-ca31720cea62',
        'B16A4047-9415-4F1B-9F6C-59104E788C53', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Audience" "Types"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
        'SendWhenEmpty',
        'Send When Empty',
        'When 1, a recipient with nothing lapsed still gets the email, carrying the Empty Message, so silence cannot be mistaken for a missed send. When 0 the email is skipped.',
        'BOOLEAN',
        1,
        1,
        0,
        0,
        '(0)',
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'a0cfb168-c50c-4fbf-9198-e0571e69c495' OR ("EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND "Name" = 'GroupByCompany')
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
        'a0cfb168-c50c-4fbf-9198-e0571e69c495',
        'B16A4047-9415-4F1B-9F6C-59104E788C53', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Audience" "Types"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
        'GroupByCompany',
        'Group By Company',
        'When 1, the digest lists deals under a heading per company. When 0 it is one flat list.',
        'BOOLEAN',
        1,
        1,
        0,
        0,
        '(1)',
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '8945982e-635b-4cbc-93c2-28dbe50f8da5' OR ("EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND "Name" = 'SubjectTemplate')
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
        '8945982e-635b-4cbc-93c2-28dbe50f8da5',
        'B16A4047-9415-4F1B-9F6C-59104E788C53', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Audience" "Types"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
        'SubjectTemplate',
        'Subject Template',
        'Subject line of the email. Empty means the digest builder''s built-in subject.',
        'TEXT',
        510,
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'ce02923d-a19c-4951-b30d-d57fdee47bd4' OR ("EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND "Name" = 'IntroTemplate')
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
        'ce02923d-a19c-4951-b30d-d57fdee47bd4',
        'B16A4047-9415-4F1B-9F6C-59104E788C53', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Audience" "Types"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
        'IntroTemplate',
        'Intro Template',
        'Opening text of the email, above the deal list. Empty means the digest builder''s built-in introduction.',
        'TEXT',
        -1,
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '79c5b52f-022e-4161-afcb-b8c796af8d2d' OR ("EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND "Name" = 'EmptyMessage')
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
        '79c5b52f-022e-4161-afcb-b8c796af8d2d',
        'B16A4047-9415-4F1B-9F6C-59104E788C53', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Audience" "Types"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
        'EmptyMessage',
        'Empty Message',
        'Text sent in place of the deal list when nothing is lapsed and Send When Empty is on.',
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '75e82953-084e-4d32-8d74-16b13c96f042' OR ("EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND "Name" = 'DisplayRank')
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
        '75e82953-084e-4d32-8d74-16b13c96f042',
        'B16A4047-9415-4F1B-9F6C-59104E788C53', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Audience" "Types"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
        'DisplayRank',
        'Display Rank',
        'Order in which audiences are listed and processed; lowest first.',
        'INTEGER',
        4,
        10,
        0,
        0,
        '(0)',
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '522eb3e7-bf6e-4759-8532-7301bc58c25d' OR ("EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND "Name" = 'IsActive')
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
        '522eb3e7-bf6e-4759-8532-7301bc58c25d',
        'B16A4047-9415-4F1B-9F6C-59104E788C53', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Audience" "Types"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
        'IsActive',
        'Is Active',
        'Whether this audience is sent at all. Clearing it pauses the audience without deleting its recipients.',
        'BOOLEAN',
        1,
        1,
        0,
        0,
        '(1)',
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b6e73f12-a7e8-4616-8e44-221267d2b56b' OR ("EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND "Name" = '__mj_CreatedAt')
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
        'b6e73f12-a7e8-4616-8e44-221267d2b56b',
        'B16A4047-9415-4F1B-9F6C-59104E788C53', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Audience" "Types"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
        '__mj_CreatedAt',
        'Created At',
        NULL,
        'TIMESTAMPTZ',
        10,
        34,
        7,
        0,
        'NOW()',
        0,
        0,
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '123a10f9-5785-447b-82c4-ff4785429b82' OR ("EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND "Name" = '__mj_UpdatedAt')
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
        '123a10f9-5785-447b-82c4-ff4785429b82',
        'B16A4047-9415-4F1B-9F6C-59104E788C53', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Audience" "Types"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53'),
        '__mj_UpdatedAt',
        'Updated At',
        NULL,
        'TIMESTAMPTZ',
        10,
        34,
        7,
        0,
        'NOW()',
        0,
        0,
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'a55da574-d8cd-40a3-b21c-c5c36c587470' OR ("EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND "Name" = 'ID')
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
        'a55da574-d8cd-40a3-b21c-c5c36c587470',
        '84246B5D-4431-489A-9186-DF3C6DE711EA', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Recipients"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA'),
        'ID',
        'ID',
        NULL,
        'UUID',
        16,
        0,
        0,
        0,
        'gen_random_uuid()',
        0,
        0,
        0,
        0,
        NULL,
        NULL,
        0,
        0,
        0,
        0,
        1,
        1,
        'Search',
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '89cccbe5-36db-4da6-bd69-eac1819cd304' OR ("EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND "Name" = 'DealDigestAudienceTypeID')
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
        '89cccbe5-36db-4da6-bd69-eac1819cd304',
        '84246B5D-4431-489A-9186-DF3C6DE711EA', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Recipients"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA'),
        'DealDigestAudienceTypeID',
        'Deal Digest Audience Type ID',
        'The audience this person receives.',
        'UUID',
        16,
        0,
        0,
        0,
        NULL,
        0,
        1,
        0,
        0,
        'B16A4047-9415-4F1B-9F6C-59104E788C53',
        'ID',
        0,
        0,
        1,
        0,
        0,
        1,
        'Search',
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '0621f6c2-ab9d-4fec-a43b-e30d04de8510' OR ("EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND "Name" = 'CompanyID')
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
        '0621f6c2-ab9d-4fec-a43b-e30d04de8510',
        '84246B5D-4431-489A-9186-DF3C6DE711EA', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Recipients"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA'),
        'CompanyID',
        'Company ID',
        'The company the digest covers for this person. Empty on a portfolio-wide audience, and required on any other; the recipient''s Save() enforces that pairing.',
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
        'D4238F34-2837-EF11-86D4-6045BDEE16E6',
        'ID',
        0,
        0,
        1,
        0,
        0,
        1,
        'Search',
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '1aede892-ec14-4fd6-aff4-cfea9feba337' OR ("EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND "Name" = 'EmployeeID')
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
        '1aede892-ec14-4fd6-aff4-cfea9feba337',
        '84246B5D-4431-489A-9186-DF3C6DE711EA', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Recipients"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA'),
        'EmployeeID',
        'Employee ID',
        'The employee who receives the digest, at their work email.',
        'UUID',
        16,
        0,
        0,
        0,
        NULL,
        0,
        1,
        0,
        0,
        'D5238F34-2837-EF11-86D4-6045BDEE16E6',
        'ID',
        0,
        0,
        1,
        0,
        0,
        1,
        'Search',
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'ee5f6659-fc92-4c3e-af80-a9c08a3e9744' OR ("EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND "Name" = 'IsActive')
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
        'ee5f6659-fc92-4c3e-af80-a9c08a3e9744',
        '84246B5D-4431-489A-9186-DF3C6DE711EA', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Recipients"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA'),
        'IsActive',
        'Is Active',
        'Whether this person is sent the digest. Clearing it stops the email without deleting the row.',
        'BOOLEAN',
        1,
        1,
        0,
        0,
        '(1)',
        0,
        1,
        0,
        0,
        NULL,
        NULL,
        0,
        0,
        0,
        1,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'f691662f-6bcd-47df-b894-85163407b296' OR ("EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND "Name" = '__mj_CreatedAt')
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
        'f691662f-6bcd-47df-b894-85163407b296',
        '84246B5D-4431-489A-9186-DF3C6DE711EA', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Recipients"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA'),
        '__mj_CreatedAt',
        'Created At',
        NULL,
        'TIMESTAMPTZ',
        10,
        34,
        7,
        0,
        'NOW()',
        0,
        0,
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '2d17a29b-bcc0-457d-a70b-f29d7e7f8a70' OR ("EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND "Name" = '__mj_UpdatedAt')
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
        '2d17a29b-bcc0-457d-a70b-f29d7e7f8a70',
        '84246B5D-4431-489A-9186-DF3C6DE711EA', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Recipients"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA'),
        '__mj_UpdatedAt',
        'Updated At',
        NULL,
        'TIMESTAMPTZ',
        10,
        34,
        7,
        0,
        'NOW()',
        0,
        0,
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship" WHERE "ID" = 'c82d6c0e-845f-4f87-899e-81745ebe10e0' OR ("EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND "RelatedEntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND "RelatedEntityJoinField" = 'DealDigestAudienceTypeID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('c82d6c0e-845f-4f87-899e-81745ebe10e0', 'B16A4047-9415-4F1B-9F6C-59104E788C53', '84246B5D-4431-489A-9186-DF3C6DE711EA', 'DealDigestAudienceTypeID', 'One To Many', 1, 1, 1, NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship" WHERE "ID" = '393d542a-8506-405a-9224-8744e05634d7' OR ("EntityID" = 'D4238F34-2837-EF11-86D4-6045BDEE16E6' AND "RelatedEntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND "RelatedEntityJoinField" = 'CompanyID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('393d542a-8506-405a-9224-8744e05634d7', 'D4238F34-2837-EF11-86D4-6045BDEE16E6', '84246B5D-4431-489A-9186-DF3C6DE711EA', 'CompanyID', 'One To Many', 1, 1, 43, NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship" WHERE "ID" = '5d3ac9f4-ed5b-4506-821c-c86f69a07082' OR ("EntityID" = 'D5238F34-2837-EF11-86D4-6045BDEE16E6' AND "RelatedEntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND "RelatedEntityJoinField" = 'EmployeeID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('5d3ac9f4-ed5b-4506-821c-c86f69a07082', 'D5238F34-2837-EF11-86D4-6045BDEE16E6', '84246B5D-4431-489A-9186-DF3C6DE711EA', 'EmployeeID', 'One To Many', 1, 1, 11, NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'f80be1f3-8d83-4772-a873-e5962981a629' OR ("EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND "Name" = 'DealDigestAudienceType')
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
        'f80be1f3-8d83-4772-a873-e5962981a629',
        '84246B5D-4431-489A-9186-DF3C6DE711EA', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Recipients"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA'),
        'DealDigestAudienceType',
        'Deal Digest Audience Type',
        NULL,
        'TEXT',
        200,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'e8a8c65a-8a0c-4b3c-9508-6d65ed63f1c0' OR ("EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND "Name" = 'Company')
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
        'e8a8c65a-8a0c-4b3c-9508-6d65ed63f1c0',
        '84246B5D-4431-489A-9186-DF3C6DE711EA', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Recipients"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA'),
        'Company',
        'Company',
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '01f39adb-01d3-4d1c-9b64-d4128df72f0f' OR ("EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND "Name" = 'Employee')
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
        '01f39adb-01d3-4d1c-9b64-d4128df72f0f',
        '84246B5D-4431-489A-9186-DF3C6DE711EA', -- "Entity": "MJ_BizApps_Sales": "Deal" "Digest" "Recipients"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA'),
        'Employee',
        'Employee',
        NULL,
        'TEXT',
        162,
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
               SET "DefaultInView" = TRUE
               WHERE "ID" = '75E82953-084E-4D32-8D74-16B13C96F042'
               AND "AutoUpdateDefaultInView" = TRUE;

UPDATE ${mjSchema}."EntityField"
               SET "DefaultInView" = TRUE
               WHERE "ID" = '522EB3E7-BF6E-4759-8532-7301BC58C25D'
               AND "AutoUpdateDefaultInView" = TRUE;

UPDATE ${mjSchema}."Entity"
            SET "AllowUserSearchAPI" = FALSE
            WHERE "ID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53'
            AND "AutoUpdateAllowUserSearchAPI" = TRUE;

/* Set field properties for entity */

UPDATE ${mjSchema}."EntityField"
               SET "DefaultInView" = TRUE
               WHERE "ID" = 'F80BE1F3-8D83-4772-A873-E5962981A629'
               AND "AutoUpdateDefaultInView" = TRUE;

UPDATE ${mjSchema}."EntityField"
               SET "DefaultInView" = TRUE
               WHERE "ID" = 'E8A8C65A-8A0C-4B3C-9508-6D65ED63F1C0'
               AND "AutoUpdateDefaultInView" = TRUE;

UPDATE ${mjSchema}."EntityField"
               SET "DefaultInView" = TRUE
               WHERE "ID" = '01F39ADB-01D3-4D1C-9B64-D4128DF72F0F'
               AND "AutoUpdateDefaultInView" = TRUE;

/* Set categories for 16 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.ID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'AD7259CD-C7E9-4599-B118-2748BEB3B1B4';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.Code

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Audience Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '413E6BB6-7AB6-4987-9149-B6CE0D9A8729';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.Name

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Audience Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'FB29262F-F418-444A-86B7-633DF8A0E2FB';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.Description

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Audience Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '0AFAA0E7-F80B-4D2D-AD1D-3593A0A50598';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.IsPortfolioWide

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Behavior Settings',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '3689B893-4C73-451C-A1FE-54EB9F51480B';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.MinDaysLapsed

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Behavior Settings',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Minimum Days Lapsed'
WHERE 
   "ID" = '62A9C710-A1BE-413A-9433-BA97779E4CF2';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.IncludeMissingCloseDate

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Behavior Settings',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '537B6AC9-CD1B-42A7-86AB-C60E7E09C83B';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.SendWhenEmpty

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Behavior Settings',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '3DCF0226-63EE-4526-9DCC-CA31720CEA62';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.GroupByCompany

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Behavior Settings',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'A0CFB168-C50C-4FBF-9198-E0571E69C495';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.SubjectTemplate

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Email Templates',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '8945982E-635B-4CBC-93C2-28DBE50F8DA5';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.IntroTemplate

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Email Templates',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'CE02923D-A19C-4951-B30D-D57FDEE47BD4';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.EmptyMessage

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Email Templates',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '79C5B52F-022E-4161-AFCB-B8C796AF8D2D';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.DisplayRank

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Audience Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '75E82953-084E-4D32-8D74-16B13C96F042';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.IsActive

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Audience Details',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '522EB3E7-BF6E-4759-8532-7301BC58C25D';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.__mj_CreatedAt

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'B6E73F12-A7E8-4616-8E44-221267D2B56B';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Audience Types.__mj_UpdatedAt

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '123A10F9-5785-447B-82C4-FF4785429B82';

/* Set entity icon to fa fa-bullhorn */

UPDATE ${mjSchema}."Entity"
               SET "Icon" = 'fa fa-bullhorn', "__mj_UpdatedAt" = NOW()
               WHERE "ID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53';

/* Insert FieldCategoryInfo setting for entity */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntitySetting" WHERE "EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND "Name" = 'FieldCategoryInfo'
    ) THEN
        INSERT INTO ${mjSchema}."EntitySetting" ("ID", "EntityID", "Name", "Value", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('83350444-469b-5fe9-9ae0-dd6546b4e770', 'B16A4047-9415-4F1B-9F6C-59104E788C53', 'FieldCategoryInfo', '{
        "Audience Details": {
        "description": "Core identifying details and administrative settings for the audience type",
        "icon": "fa fa-id-card"
        },
        "Behavior Settings": {
        "description": "Flags and thresholds that control how the digest builder processes this audience",
        "icon": "fa fa-sliders-h"
        },
        "Email Templates": {
        "description": "Customizable content templates for emails sent to this audience",
        "icon": "fa fa-envelope-open-text"
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
        SELECT 1 FROM ${mjSchema}."EntitySetting" WHERE "EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53' AND "Name" = 'FieldCategoryIcons'
    ) THEN
        INSERT INTO ${mjSchema}."EntitySetting" ("ID", "EntityID", "Name", "Value", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('99fcd5c7-d169-5950-a770-a1f186f2c756', 'B16A4047-9415-4F1B-9F6C-59104E788C53', 'FieldCategoryIcons', '{
        "Audience Details": "fa fa-id-card",
        "Behavior Settings": "fa fa-sliders-h",
        "Email Templates": "fa fa-envelope-open-text",
        "System Metadata": "fa fa-cog"
        }', NOW(), NOW());
    END IF;
END $$;

UPDATE ${mjSchema}."ApplicationEntity"
         SET "DefaultForNewUser" = FALSE, "__mj_UpdatedAt" = NOW()
         WHERE "EntityID" = 'B16A4047-9415-4F1B-9F6C-59104E788C53';

/* Set categories for 10 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Recipients.ID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'A55DA574-D8CD-40A3-B21C-C5C36C587470';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Recipients.DealDigestAudienceTypeID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Recipient Configuration',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Deal Digest Audience Type'
WHERE 
   "ID" = '89CCCBE5-36DB-4DA6-BD69-EAC1819CD304';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Recipients.CompanyID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Recipient Configuration',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Company'
WHERE 
   "ID" = '0621F6C2-AB9D-4FEC-A43B-E30D04DE8510';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Recipients.EmployeeID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Recipient Configuration',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Employee'
WHERE 
   "ID" = '1AEDE892-EC14-4FD6-AFF4-CFEA9FEBA337';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Recipients.IsActive

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Recipient Configuration',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'EE5F6659-FC92-4C3E-AF80-A9C08A3E9744';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Recipients.DealDigestAudienceType

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Recipient Configuration',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'F80BE1F3-8D83-4772-A873-E5962981A629';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Recipients.Company

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Recipient Configuration',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Company Name'
WHERE 
   "ID" = 'E8A8C65A-8A0C-4B3C-9508-6D65ED63F1C0';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Recipients.Employee

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Recipient Configuration',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Employee Name'
WHERE 
   "ID" = '01F39ADB-01D3-4D1C-9B64-D4128DF72F0F';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Recipients.__mj_CreatedAt

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'F691662F-6BCD-47DF-B894-85163407B296';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Digest Recipients.__mj_UpdatedAt

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = '2D17A29B-BCC0-457D-A70B-F29D7E7F8A70';

/* Set entity icon to fa fa-envelope-open-text */

UPDATE ${mjSchema}."Entity"
               SET "Icon" = 'fa fa-envelope-open-text', "__mj_UpdatedAt" = NOW()
               WHERE "ID" = '84246B5D-4431-489A-9186-DF3C6DE711EA';

/* Insert FieldCategoryInfo setting for entity */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntitySetting" WHERE "EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND "Name" = 'FieldCategoryInfo'
    ) THEN
        INSERT INTO ${mjSchema}."EntitySetting" ("ID", "EntityID", "Name", "Value", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('fb52b1c6-daa7-5d54-960f-070f48c57331', '84246B5D-4431-489A-9186-DF3C6DE711EA', 'FieldCategoryInfo', '{
        "Recipient Configuration": {
        "description": "Configuration settings determining who receives specific digest audiences and companies",
        "icon": "fa fa-users"
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
        SELECT 1 FROM ${mjSchema}."EntitySetting" WHERE "EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA' AND "Name" = 'FieldCategoryIcons'
    ) THEN
        INSERT INTO ${mjSchema}."EntitySetting" ("ID", "EntityID", "Name", "Value", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('a8ee8c56-4f32-5d12-adc3-dc32eacf8411', '84246B5D-4431-489A-9186-DF3C6DE711EA', 'FieldCategoryIcons', '{
        "Recipient Configuration": "fa fa-users",
        "System Metadata": "fa fa-cog"
        }', NOW(), NOW());
    END IF;
END $$;

UPDATE ${mjSchema}."ApplicationEntity"
         SET "DefaultForNewUser" = TRUE, "__mj_UpdatedAt" = NOW()
         WHERE "EntityID" = '84246B5D-4431-489A-9186-DF3C6DE711EA';

/* Generated Validation Functions for MJ_BizApps_Sales: Deal Digest Audience Types */
-- CHECK constraint for MJ_BizApps_Sales: Deal Digest Audience Types: Field: MinDaysLapsed was newly set or modified since the last generation of the validation function, the code was regenerated and updating the GeneratedCode table with the new generated validation function

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."GeneratedCode" WHERE "CategoryID" = (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators') AND "LinkedEntityID" = 'DF238F34-2837-EF11-86D4-6045BDEE16E6' AND "LinkedRecordPrimaryKey" = '62A9C710-A1BE-413A-9433-BA97779E4CF2'
    ) THEN
        INSERT INTO ${mjSchema}."GeneratedCode" ("ID", "CategoryID", "GeneratedByModelID", "GeneratedAt", "Language", "Status", "Source", "Code", "Description", "Name", "LinkedEntityID", "LinkedRecordPrimaryKey")
        VALUES ('ac9492a4-f306-44d3-aa24-3a289780dc09', (SELECT "ID" FROM ${mjSchema}."vwGeneratedCodeCategories" WHERE "Name"='CodeGen: Validators'), '4B500A24-0259-4EFF-9E34-24E9F5EC9DAB', NOW(), 'TypeScript', 'Approved', '([MinDaysLapsed] IS NULL OR [MinDaysLapsed]>=(0))', 'public ValidateMinDaysLapsedNonNegative(result: ValidationResult): void {
        if (this.MinDaysLapsed != null && this.MinDaysLapsed < 0) {
        result.Errors.push(new ValidationErrorInfo(
        "MinDaysLapsed",
        "Minimum days lapsed cannot be negative.",
        this.MinDaysLapsed,
        ValidationErrorType.Failure
        ));
        }
        }', 'Minimum days lapsed must be zero or a positive number when specified.', 'ValidateMinDaysLapsedNonNegative', 'DF238F34-2837-EF11-86D4-6045BDEE16E6', '62A9C710-A1BE-413A-9433-BA97779E4CF2');
    END IF;
END $$;

-- CODEGEN'S SEARCH-FLAG HYGIENE, SCOPED TO THIS MIGRATION'S OWN ENTITY.
--
-- CodeGen emits this as a schema-wide sweep: it clears AllowUserSearchAPI on
-- every entity in the instance that has no searchable field, excluding a list of
-- schemas built from the GENERATING MACHINE's inventory. Shipped as emitted, it
-- would act on entities this migration never touched, in apps installed beside
-- this one, and the exclusion list would be whatever happened to exist on the
-- laptop that ran CodeGen. V202611062300 ships the scoped form instead, and so
-- does this.
--
-- Only Deal Digest Recipients appears here because the capture above already
-- carries CodeGen's own per-entity clear for Deal Digest Audience Types; the
-- sweep was the only thing covering Recipients. Both entities are created with
-- AllowUserSearchAPI = 1 and end this migration at 0.
-- AutoUpdateAllowUserSearchAPI = 1 is CodeGen's own guard: a host that set the
-- flag deliberately is left alone.
UPDATE ${mjSchema}."Entity"
SET "AllowUserSearchAPI" = FALSE
WHERE "ID" = '84246B5D-4431-489A-9186-DF3C6DE711EA'
AND "AutoUpdateAllowUserSearchAPI" = TRUE;


-- ===================== Grants =====================

DO $$ BEGIN GRANT SELECT ON __mj_BizAppsSales."vwDealDigestAudienceTypes" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* Base View Permissions SQL for MJ_BizApps_Sales: Deal Digest Audience Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
-- Item: Permissions for vwDealDigestAudienceTypes
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

DO $$ BEGIN GRANT SELECT ON __mj_BizAppsSales."vwDealDigestAudienceTypes" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate SQL for MJ_BizApps_Sales: Deal Digest Audience Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
-- Item: spCreateDealDigestAudienceType
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR DealDigestAudienceType
------------------------------------------------------------;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateDealDigestAudienceType" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Sales: Deal Digest Audience Types */

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateDealDigestAudienceType" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spUpdate SQL for MJ_BizApps_Sales: Deal Digest Audience Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
-- Item: spUpdateDealDigestAudienceType
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR DealDigestAudienceType
------------------------------------------------------------;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateDealDigestAudienceType" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateDealDigestAudienceType" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete SQL for MJ_BizApps_Sales: Deal Digest Audience Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Digest Audience Types
-- Item: spDeleteDealDigestAudienceType
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR DealDigestAudienceType
------------------------------------------------------------;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteDealDigestAudienceType" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete Permissions for MJ_BizApps_Sales: Deal Digest Audience Types */

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteDealDigestAudienceType" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* SQL text to update entity field related entity name field map for entity field ID 0621F6C2-AB9D-4FEC-A43B-E30D04DE8510 */

DO $$ BEGIN GRANT SELECT ON __mj_BizAppsSales."vwDealDigestRecipients" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* Base View Permissions SQL for MJ_BizApps_Sales: Deal Digest Recipients */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Digest Recipients
-- Item: Permissions for vwDealDigestRecipients
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

DO $$ BEGIN GRANT SELECT ON __mj_BizAppsSales."vwDealDigestRecipients" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate SQL for MJ_BizApps_Sales: Deal Digest Recipients */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Digest Recipients
-- Item: spCreateDealDigestRecipient
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR DealDigestRecipient
------------------------------------------------------------;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateDealDigestRecipient" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Sales: Deal Digest Recipients */

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateDealDigestRecipient" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spUpdate SQL for MJ_BizApps_Sales: Deal Digest Recipients */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Digest Recipients
-- Item: spUpdateDealDigestRecipient
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR DealDigestRecipient
------------------------------------------------------------;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateDealDigestRecipient" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateDealDigestRecipient" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete SQL for MJ_BizApps_Sales: Deal Digest Recipients */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Digest Recipients
-- Item: spDeleteDealDigestRecipient
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR DealDigestRecipient
------------------------------------------------------------;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteDealDigestRecipient" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete Permissions for MJ_BizApps_Sales: Deal Digest Recipients */

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteDealDigestRecipient" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* SQL text to insert 3 new entity field(s) */


-- ===================== Comments =====================

COMMENT ON TABLE __mj_BizAppsSales."DealDigestAudienceType" IS 'One kind of audience for the Lapsed Close Date Digest (Company Leader, CEO, CFO, CTO). Behaviour comes from the flags on this row, never from the Code or Name: the digest builder reads IsPortfolioWide, MinDaysLapsed, IncludeMissingCloseDate, SendWhenEmpty and GroupByCompany, so adding an audience is a data change with no code impact.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."Code" IS 'Stable identifier the seeds and the digest builder key on. Renaming Name is cosmetic; renaming Code changes an identifier.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."Name" IS 'Display name of the audience, as shown to the people who administer recipients.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."Description" IS 'What this audience is for and who belongs in it.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."IsPortfolioWide" IS 'When 1, recipients of this audience receive one digest covering every company, and their recipient rows carry no Company. When 0, each recipient row names the company the digest covers. Enforced in the recipient''s Save(), not by a CHECK, because it ties a column on this table to one on another.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."MinDaysLapsed" IS 'A deal appears only once its expected close date is at least this many days past. Empty means no minimum: any deal whose date has passed appears. Never negative.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."IncludeMissingCloseDate" IS 'When 1, open deals that never had an expected close date are listed too, after the lapsed ones. When 0 only deals whose date has passed appear.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."SendWhenEmpty" IS 'When 1, a recipient with nothing lapsed still gets the email, carrying the Empty Message, so silence cannot be mistaken for a missed send. When 0 the email is skipped.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."GroupByCompany" IS 'When 1, the digest lists deals under a heading per company. When 0 it is one flat list.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."SubjectTemplate" IS 'Subject line of the email. Empty means the digest builder''s built-in subject.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."IntroTemplate" IS 'Opening text of the email, above the deal list. Empty means the digest builder''s built-in introduction.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."EmptyMessage" IS 'Text sent in place of the deal list when nothing is lapsed and Send When Empty is on.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."DisplayRank" IS 'Order in which audiences are listed and processed; lowest first.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestAudienceType"."IsActive" IS 'Whether this audience is sent at all. Clearing it pauses the audience without deleting its recipients.';

COMMENT ON TABLE __mj_BizAppsSales."DealDigestRecipient" IS 'One person receiving one audience''s Lapsed Close Date Digest, for one company or, on a portfolio-wide audience, for all of them. The audience decides what the email contains; this row decides who gets it.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestRecipient"."DealDigestAudienceTypeID" IS 'The audience this person receives.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestRecipient"."CompanyID" IS 'The company the digest covers for this person. Empty on a portfolio-wide audience, and required on any other; the recipient''s Save() enforces that pairing.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestRecipient"."EmployeeID" IS 'The employee who receives the digest, at their work email.';

COMMENT ON COLUMN __mj_BizAppsSales."DealDigestRecipient"."IsActive" IS 'Whether this person is sent the digest. Clearing it stops the email without deleting the row.';


-- ===================== Other =====================

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================
-- Captured with `pnpm run mj:codegen` against a database built from migrations
-- alone. ONE statement CodeGen emitted was left out and re-stated by hand below
-- the closing banner: see the note there.
/* SQL generated to create new entity MJ_BizApps_Sales: Deal Digest Audience Types */

/* SQL text to insert 23 new entity field(s) */

/* spUpdate Permissions for MJ_BizApps_Sales: Deal Digest Audience Types */

/* spUpdate Permissions for MJ_BizApps_Sales: Deal Digest Recipients */


-- Entity-scoped field sync, written by hand: the converter does not translate `EXEC`, and the
-- SQL Server file's call is what keeps __mj.EntityField's nullability in step with the
-- __mj_CreatedAt / __mj_UpdatedAt columns this migration alters to NOT NULL. Function form and
-- argument order follow V202611062300__v6.25.x__Pipeline_Company_Link.pg.sql.
SELECT * FROM ${mjSchema}."spUpdateExistingEntityFieldsFromSchema"('', 'B16A4047-9415-4F1B-9F6C-59104E788C53,84246B5D-4431-489A-9186-DF3C6DE711EA', '__mj_BizAppsSales');
