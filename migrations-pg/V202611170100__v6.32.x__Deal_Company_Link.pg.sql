-- =============================================================================================
-- PostgreSQL counterpart of V202611170100__v6.32.x__Deal_Company_Link.sql
-- =============================================================================================
-- `mj sql-convert --from tsql --to postgres --schema __mj_BizAppsSales` (MJ CLI 6.2.1) output,
-- finished by hand. The converter reported 0 errors and 11 skipped objects.
--   * The table, constraints, indexes, view, metadata rows, grants and comments are the
--     converter's.
--   * CodeGen's CRUD procedures (spCreate/spUpdate/spDelete) and its __mj_UpdatedAt trigger are
--     NOT here: the converter cannot translate T-SQL procedures or triggers. A PostgreSQL host
--     runs `mj codegen` after installing, which generates them natively. The skipped trigger's
--     text is commented out in full; the converter left all but its first line live.
--   * `${mjSchema}."Company" (ID)` in the foreign key is quoted by hand.
--   * The entity-scoped field sync at the end is written by hand, as in the sibling files.
-- Schema names are left as the converter emits them. UNVALIDATED AGAINST A LIVE PostgreSQL
-- SERVER: this repo has no PostgreSQL host, as with every file in this directory.
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
-- DealCompany — the companies a deal involves (golive #484).
-- =============================================================================
-- A deal carries one company column, Deal.CompanyID, and it is also the order's
-- company: it picks the invoice issuer, the Bill.com connection, the contract
-- company, the time zone and the forecast grain. A deal that sells products from
-- several companies had nowhere to record "these are the companies involved", so
-- the product picker and the filter bar could only see the one.
--
-- Deal.CompanyID STAYS, unchanged, as the selling (billing) company. It must be one
-- of the deal's companies; DealEntityServer adds it to this list on save, together
-- with the company of every line on the deal's order, so the list never omits a
-- company the deal is already selling for.
--
-- STRONGLY TYPED, like PipelineCompany: both sides are real foreign keys. No
-- IsActive column: the list is the deal's current set, and removing a company
-- removes its row. Nothing else points at a DealCompany row.
--
-- THE BACKFILL gives every existing deal a row for its company plus one for each
-- distinct company on its order's lines. UNION removes the duplicates.
-- =============================================================================

CREATE TABLE __mj_BizAppsSales."DealCompany" (
 "ID" UUID NOT NULL DEFAULT gen_random_uuid(),
 "DealID" UUID NOT NULL,
 "CompanyID" UUID NOT NULL,
 CONSTRAINT "PK_DealCompany" PRIMARY KEY ("ID"),
 CONSTRAINT "UQ_DealCompany_Deal_Company" UNIQUE ("DealID", "CompanyID"),
 CONSTRAINT "FK_DealCompany_Deal" FOREIGN KEY ("DealID")
 REFERENCES __mj_BizAppsSales."Deal" ("ID"),
 CONSTRAINT "FK_DealCompany_Company" FOREIGN KEY ("CompanyID")
 REFERENCES ${mjSchema}."Company" ("ID")
);

ALTER TABLE __mj_BizAppsSales."DealCompany"
 ADD COLUMN IF NOT EXISTS "__mj_CreatedAt" TIMESTAMPTZ NULL;

/* SQL text to add special date field __mj_UpdatedAt to entity __mj_BizAppsSales.DealCompany */
ALTER TABLE __mj_BizAppsSales."DealCompany"
 ADD COLUMN IF NOT EXISTS "__mj_UpdatedAt" TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_DealCompany_DealID" ON __mj_BizAppsSales."DealCompany" ("DealID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_DealCompany_CompanyID" ON __mj_BizAppsSales."DealCompany" ("CompanyID");


-- ===================== Views =====================

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsSales';
  v_target_name CONSTANT TEXT := 'vwDealCompanies';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW __mj_BizAppsSales."vwDealCompanies"
AS SELECT
    d.*,
    "mjBizAppsSalesDeal_DealID"."Name" AS "Deal",
    "MJCompany_CompanyID"."Name" AS "Company"
FROM
    __mj_BizAppsSales."DealCompany" AS d
INNER JOIN
    __mj_BizAppsSales."Deal" AS "mjBizAppsSalesDeal_DealID"
  ON
    d."DealID" = "mjBizAppsSalesDeal_DealID"."ID"
INNER JOIN
    ${mjSchema}."Company" AS "MJCompany_CompanyID"
  ON
    d."CompanyID" = "MJCompany_CompanyID"."ID"$vsql$;
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
-- CREATE PROCEDURE [__mj_BizAppsSales].[spCreateDealCompany]
--     @ID UUID = NULL,
--     @DealID UUID,
--     @CompanyID UUID
-- AS
-- BEGIN
--     SET NOCOUNT ON;
--     DECLARE @Inse...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spUpdateDealCompany]
--     @ID UUID,
--     @DealID UUID = NULL,
--     @CompanyID UUID = NULL
-- AS
-- BEGIN
--     SET NOCOUNT ON;
--     UPDATE...

-- SKIPPED: procedure (auto-conversion not supported)
-- CREATE PROCEDURE [__mj_BizAppsSales].[spDeleteDealCompany]
--     @ID UUID
-- AS
-- BEGIN
--     SET NOCOUNT ON;
-- 
--     DELETE FROM
--         [__mj_BizAppsSales].[DealCompany]
--     WHERE
--         [ID] = @ID...


-- ===================== Triggers =====================

-- SKIPPED: trigger (auto-conversion not supported)
-- CREATE TRIGGER [__mj_BizAppsSales].trgUpdateDealCompany
-- ON "__mj_BizAppsSales"."DealCompany"
-- AFTER UPDATE
-- AS
-- BEGIN
--     SET NOCOUNT ON;
--     UPDATE
--         "__mj_BizAppsSales"."DealCompany"
--     SET


-- ===================== Data (INSERT/UPDATE/DELETE) =====================

INSERT INTO "__mj_BizAppsSales"."DealCompany" ("DealID", "CompanyID")
SELECT d."ID", d."CompanyID"
FROM "__mj_BizAppsSales"."Deal" d
UNION
SELECT d."ID", ol."CompanyID"
FROM "__mj_BizAppsSales"."Deal" d
JOIN "__mj_BizAppsOrders"."OrderLine" ol ON ol."OrderHeaderID" = d."OrderID";

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
         'e9f916ef-3f17-4bd8-854e-0faedf692e5e',
         'MJ_BizApps_Sales: Deal Companies',
         'Deal Companies',
         'A company involved in a deal. A deal can involve several companies; the deal''s own company (the billing company) is always one of them, and so is the company of every product on the deal.',
         NULL,
         'DealCompany',
         'vwDealCompanies',
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

/* SQL generated to add entity MJ_BizApps_Sales: Deal Companies to application ID: '60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D' */

INSERT INTO ${mjSchema}."ApplicationEntity"
                                    ("ApplicationID", "EntityID", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES
                                    ('60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D', 'e9f916ef-3f17-4bd8-854e-0faedf692e5e', (SELECT COALESCE(MAX("Sequence"),0)+1 FROM ${mjSchema}."ApplicationEntity" WHERE "ApplicationID" = '60EE99AB-09D0-4A6C-98AB-5CD0F3E9738D'), NOW(), NOW());

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Deal Companies for role UI */

INSERT INTO ${mjSchema}."EntityPermission"
                ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
              SELECT CAST('e9f916ef-3f17-4bd8-854e-0faedf692e5e' AS UUID), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', 1, 0, 0, 0, NOW(), NOW()
              WHERE NOT EXISTS (
                SELECT 1 FROM ${mjSchema}."EntityPermission"
                WHERE "EntityID" = CAST('e9f916ef-3f17-4bd8-854e-0faedf692e5e' AS UUID) AND "RoleID" = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Deal Companies for role Developer */

INSERT INTO ${mjSchema}."EntityPermission"
                ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
              SELECT CAST('e9f916ef-3f17-4bd8-854e-0faedf692e5e' AS UUID), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', 1, 1, 1, 1, NOW(), NOW()
              WHERE NOT EXISTS (
                SELECT 1 FROM ${mjSchema}."EntityPermission"
                WHERE "EntityID" = CAST('e9f916ef-3f17-4bd8-854e-0faedf692e5e' AS UUID) AND "RoleID" = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Sales: Deal Companies for role Integration */

INSERT INTO ${mjSchema}."EntityPermission"
                ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
              SELECT CAST('e9f916ef-3f17-4bd8-854e-0faedf692e5e' AS UUID), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', 1, 1, 1, 1, NOW(), NOW()
              WHERE NOT EXISTS (
                SELECT 1 FROM ${mjSchema}."EntityPermission"
                WHERE "EntityID" = CAST('e9f916ef-3f17-4bd8-854e-0faedf692e5e' AS UUID) AND "RoleID" = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow'
              );

/* SQL text to add special date field __mj_CreatedAt to entity __mj_BizAppsSales."DealCompany" */

/* SQL text to add special date field __mj_CreatedAt to entity __mj_BizAppsSales."DealCompany" */
UPDATE "__mj_BizAppsSales"."DealCompany" SET "__mj_CreatedAt" = NOW() WHERE "__mj_CreatedAt" IS NULL;

/* SQL text to add special date field __mj_CreatedAt to entity __mj_BizAppsSales.DealCompany */
ALTER TABLE __mj_BizAppsSales."DealCompany" ALTER COLUMN "__mj_CreatedAt" SET NOT NULL;

ALTER TABLE __mj_BizAppsSales."DealCompany"
  ALTER COLUMN "__mj_CreatedAt" SET DEFAULT NOW();

/* SQL text to add special date field __mj_UpdatedAt to entity __mj_BizAppsSales."DealCompany" */
UPDATE "__mj_BizAppsSales"."DealCompany" SET "__mj_UpdatedAt" = NOW() WHERE "__mj_UpdatedAt" IS NULL;

/* SQL text to add special date field __mj_UpdatedAt to entity __mj_BizAppsSales.DealCompany */
ALTER TABLE __mj_BizAppsSales."DealCompany" ALTER COLUMN "__mj_UpdatedAt" SET NOT NULL;

ALTER TABLE __mj_BizAppsSales."DealCompany"
  ALTER COLUMN "__mj_UpdatedAt" SET DEFAULT NOW();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'a52a8019-9af7-409f-ba18-d53bfe41ed17' OR ("EntityID" = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND "Name" = 'ID')
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
        'a52a8019-9af7-409f-ba18-d53bfe41ed17',
        'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', -- "Entity": "MJ_BizApps_Sales": "Deal" "Companies"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E'),
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'cc38ea5d-182e-4add-bbd1-36aa2ca08728' OR ("EntityID" = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND "Name" = 'DealID')
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
        'cc38ea5d-182e-4add-bbd1-36aa2ca08728',
        'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', -- "Entity": "MJ_BizApps_Sales": "Deal" "Companies"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E'),
        'DealID',
        'Deal ID',
        'The deal.',
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
        '79148DE5-7F99-44AC-ACD4-5EE7BA93D354',
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'd1799b22-adc4-40e7-9f96-47c102c1fa95' OR ("EntityID" = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND "Name" = 'CompanyID')
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
        'd1799b22-adc4-40e7-9f96-47c102c1fa95',
        'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', -- "Entity": "MJ_BizApps_Sales": "Deal" "Companies"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E'),
        'CompanyID',
        'Company ID',
        'A company the deal involves. The product picker offers this company''s products, and the deal matches a filter on this company.',
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'e47b9d02-2649-40dd-a18a-9e613b1e89db' OR ("EntityID" = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND "Name" = '__mj_CreatedAt')
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
        'e47b9d02-2649-40dd-a18a-9e613b1e89db',
        'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', -- "Entity": "MJ_BizApps_Sales": "Deal" "Companies"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E'),
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'ab3c0505-b385-4b46-99a5-d747379b67a9' OR ("EntityID" = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND "Name" = '__mj_UpdatedAt')
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
        'ab3c0505-b385-4b46-99a5-d747379b67a9',
        'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', -- "Entity": "MJ_BizApps_Sales": "Deal" "Companies"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E'),
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
        1,
        0,
        0,
        'Search',
        NOW(),
        NOW()
        );
    END IF;
END $$;

UPDATE ${mjSchema}."Entity"
         SET "AllowUserSearchAPI" = FALSE
         WHERE "ID" IN (
            SELECT e."ID"
            FROM ${mjSchema}."Entity" e
            WHERE e."AllowUserSearchAPI" = TRUE
              AND e."AutoUpdateAllowUserSearchAPI" = TRUE
              AND e."VirtualEntity" = FALSE
              AND COALESCE(e."FullTextSearchEnabled", 0) = 0
              AND e."SchemaName" NOT IN ('${mjSchema}','__mj_BizAppsAccounting','__mj_BizAppsCommon','__mj_BizAppsContracts','__mj_BizAppsOrders','__mj_BizAppsTasks','sys')
              AND NOT EXISTS (
               SELECT 1 FROM ${mjSchema}."EntityField" f2
               WHERE f2."EntityID" = e."ID"
                 AND f2."IncludeInUserSearchAPI" = TRUE
            )
         );


/* Create Entity Relationship: MJ_BizApps_Sales: Deals -> MJ_BizApps_Sales: Deal Companies (One To Many via DealID) */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship" WHERE "ID" = 'b6c7e675-cad7-475c-9524-beb72ca24808' OR ("EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND "RelatedEntityID" = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND "RelatedEntityJoinField" = 'DealID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b6c7e675-cad7-475c-9524-beb72ca24808', '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', 'DealID', 'One To Many', 1, 1, 5, NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship" WHERE "ID" = '845cff3d-d3f8-4642-b003-4a88969ba77a' OR ("EntityID" = 'D4238F34-2837-EF11-86D4-6045BDEE16E6' AND "RelatedEntityID" = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND "RelatedEntityJoinField" = 'CompanyID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('845cff3d-d3f8-4642-b003-4a88969ba77a', 'D4238F34-2837-EF11-86D4-6045BDEE16E6', 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', 'CompanyID', 'One To Many', 1, 1, 43, NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '3812143b-fbf1-45cc-be85-8d80e2f33f74' OR ("EntityID" = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND "Name" = 'Deal')
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
        '3812143b-fbf1-45cc-be85-8d80e2f33f74',
        'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', -- "Entity": "MJ_BizApps_Sales": "Deal" "Companies"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E'),
        'Deal',
        'Deal',
        NULL,
        'TEXT',
        1000,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'aa6601cd-4ab8-43fe-ad8c-1135a9be3189' OR ("EntityID" = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND "Name" = 'Company')
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
        'aa6601cd-4ab8-43fe-ad8c-1135a9be3189',
        'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', -- "Entity": "MJ_BizApps_Sales": "Deal" "Companies"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E'),
        'Company',
        'Company',
        NULL,
        'TEXT',
        100,
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

UPDATE ${mjSchema}."EntityField"
               SET "DefaultInView" = TRUE
               WHERE "ID" = '3812143B-FBF1-45CC-BE85-8D80E2F33F74'
               AND "AutoUpdateDefaultInView" = TRUE;

UPDATE ${mjSchema}."EntityField"
               SET "DefaultInView" = TRUE
               WHERE "ID" = 'AA6601CD-4AB8-43FE-AD8C-1135A9BE3189'
               AND "AutoUpdateDefaultInView" = TRUE;

UPDATE ${mjSchema}."EntityField"
               SET "IncludeInUserSearchAPI" = TRUE
               WHERE "ID" = 'AA6601CD-4AB8-43FE-AD8C-1135A9BE3189'
               AND "AutoUpdateIncludeInUserSearchAPI" = TRUE;

UPDATE ${mjSchema}."EntityField"
               SET "UserSearchPredicateAPI" = 'BeginsWith'
               WHERE "ID" = 'AA6601CD-4AB8-43FE-AD8C-1135A9BE3189'
               AND "AutoUpdateUserSearchPredicate" = TRUE;

/* Set categories for 7 fields */

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Companies.ID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'A52A8019-9AF7-409F-BA18-D53BFE41ED17';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Companies.DealID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Deal Company Association',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Deal'
WHERE 
   "ID" = 'CC38EA5D-182E-4ADD-BBD1-36AA2CA08728';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Companies.CompanyID

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Deal Company Association',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Company'
WHERE 
   "ID" = 'D1799B22-ADC4-40E7-9F96-47C102C1FA95';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Companies.Deal

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Deal Company Association',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Deal Name'
WHERE 
   "ID" = '3812143B-FBF1-45CC-BE85-8D80E2F33F74';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Companies.Company

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'Deal Company Association',
   "GeneratedFormSection" = 'Category',
   "DisplayName" = 'Company Name'
WHERE 
   "ID" = 'AA6601CD-4AB8-43FE-AD8C-1135A9BE3189';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Companies.__mj_CreatedAt

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'E47B9D02-2649-40DD-A18A-9E613B1E89DB';

-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deal Companies.__mj_UpdatedAt

UPDATE ${mjSchema}."EntityField"
SET 
   "Category" = 'System Metadata',
   "GeneratedFormSection" = 'Category'
WHERE 
   "ID" = 'AB3C0505-B385-4B46-99A5-D747379B67A9';

/* Set entity icon to fa fa-handshake */

UPDATE ${mjSchema}."Entity"
               SET "Icon" = 'fa fa-handshake', "__mj_UpdatedAt" = NOW()
               WHERE "ID" = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E';

/* Insert FieldCategoryInfo setting for entity */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntitySetting" WHERE "EntityID" = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND "Name" = 'FieldCategoryInfo'
    ) THEN
        INSERT INTO ${mjSchema}."EntitySetting" ("ID", "EntityID", "Name", "Value", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('49c96e79-ffdb-5c6f-898c-bf06f186e71f', 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', 'FieldCategoryInfo', '{
        "Deal Company Association": {
        "description": "Links deals with their associated companies",
        "icon": "fa fa-link"
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
        SELECT 1 FROM ${mjSchema}."EntitySetting" WHERE "EntityID" = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E' AND "Name" = 'FieldCategoryIcons'
    ) THEN
        INSERT INTO ${mjSchema}."EntitySetting" ("ID", "EntityID", "Name", "Value", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('62d32a00-a842-557f-bd06-8dbd48a31a5d', 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E', 'FieldCategoryIcons', '{
        "Deal Company Association": "fa fa-link",
        "System Metadata": "fa fa-cog"
        }', NOW(), NOW());
    END IF;
END $$;

UPDATE ${mjSchema}."ApplicationEntity"
         SET "DefaultForNewUser" = FALSE, "__mj_UpdatedAt" = NOW()
         WHERE "EntityID" = 'E9F916EF-3F17-4BD8-854E-0FAEDF692E5E';


-- =============================================================================
-- END OF CODEGEN OUTPUT. Hand-written from here.
-- =============================================================================
-- CodeGen's block above adds DealCompany's audit columns NULL, backfills them, then
-- ALTERs them to NOT NULL. omitRecurringScriptsFromLog keeps CodeGen's field sync
-- out of the block, so the entity-scoped sync runs here, after the view exists
-- (check-migration-column-sync).


-- ===================== Grants =====================

DO $$ BEGIN GRANT SELECT ON __mj_BizAppsSales."vwDealCompanies" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* Base View Permissions SQL for MJ_BizApps_Sales: Deal Companies */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Companies
-- Item: Permissions for vwDealCompanies
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

DO $$ BEGIN GRANT SELECT ON __mj_BizAppsSales."vwDealCompanies" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate SQL for MJ_BizApps_Sales: Deal Companies */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Companies
-- Item: spCreateDealCompany
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR DealCompany
------------------------------------------------------------;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateDealCompany" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Sales: Deal Companies */

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spCreateDealCompany" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spUpdate SQL for MJ_BizApps_Sales: Deal Companies */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Companies
-- Item: spUpdateDealCompany
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR DealCompany
------------------------------------------------------------;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateDealCompany" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spUpdateDealCompany" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete SQL for MJ_BizApps_Sales: Deal Companies */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deal Companies
-- Item: spDeleteDealCompany
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR DealCompany
------------------------------------------------------------;

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteDealCompany" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete Permissions for MJ_BizApps_Sales: Deal Companies */

DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsSales."spDeleteDealCompany" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* SQL text to insert 2 new entity field(s) */


-- ===================== Comments =====================

COMMENT ON TABLE __mj_BizAppsSales."DealCompany" IS 'A company involved in a deal. A deal can involve several companies; the deal''s own company (the billing company) is always one of them, and so is the company of every product on the deal.';

COMMENT ON COLUMN __mj_BizAppsSales."DealCompany"."DealID" IS 'The deal.';

COMMENT ON COLUMN __mj_BizAppsSales."DealCompany"."CompanyID" IS 'A company the deal involves. The product picker offers this company''s products, and the deal matches a filter on this company.';


-- ===================== Other =====================

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================
/* SQL generated to create new entity MJ_BizApps_Sales: Deal Companies */

/* SQL text to insert 5 new entity field(s) */

/* spUpdate Permissions for MJ_BizApps_Sales: Deal Companies */


-- Entity-scoped field sync for DealCompany, as in the T-SQL file (written by hand: it follows
-- the CodeGen block the converter emitted).
SELECT * FROM ${mjSchema}."spUpdateExistingEntityFieldsFromSchema"('', 'e9f916ef-3f17-4bd8-854e-0faedf692e5e', '__mj_BizAppsSales');
