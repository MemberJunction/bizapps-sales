-- ============================================================================
-- PostgreSQL counterpart of migrations/V202609231400__v6.1.x__Pipeline_IncludeInForecast.sql
-- The column and its description are written by hand from the T-SQL. The CodeGen metadata DML
-- (field resequence, the EntityField row, the Deal.CurrencyID soft-FK update) is converted from
-- the T-SQL (MJ 6.1.5 converter). The CodeGen section is native PostgreSQL CodeGen (MJ 6.1.5) for
-- Pipelines, not translated T-SQL; it also stands in for the T-SQL's sp_refreshview.
-- ============================================================================

SET search_path TO __mj_bizappssales, public;
SET standard_conforming_strings = on;

-- =============================================================================
-- Pipeline.IncludeInForecast — whether a pipeline's OPEN deals count toward the
-- current book: open and weighted pipeline, the forecast buckets, and the
-- dashboard's open-deal figures.
-- =============================================================================
-- WHY A FLAG AND NOT IsActive. A pipeline that holds historical deals — a container
-- for records converted from another system, say — still has to be visible: its deals
-- are real, people open them, and the board must be able to show it. IsActive already
-- means "offered and shown", and overloading it to also mean "not forecast" would force
-- a choice between hiding real records and double-counting them. The two questions get
-- two columns.
-- WHAT IT DOES NOT TOUCH. Closed history. A won deal in an excluded pipeline is still a
-- booking and still counts toward win rate, bookings, cycle time, stage conversion and
-- the Closed/Won figures. Only OPEN deals are left out, because only an open deal can be
-- counted twice in the current book.
-- DEFAULT 1, so every existing pipeline keeps today's behaviour until someone says
-- otherwise. The flag is data, per this app's rule that behaviour lives in flags rather
-- than in names: no query may recognise a pipeline by its name or code.
-- =============================================================================
ALTER TABLE __mj_bizappssales."Pipeline"
  ADD COLUMN "IncludeInForecast" BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN __mj_bizappssales."Pipeline"."IncludeInForecast" IS 'Whether open deals in this pipeline count toward open and weighted pipeline, the forecast buckets and the dashboard''s open-deal figures. Set to 0 for a pipeline that only holds historical deals. Closed deals count toward bookings, win rate and other history regardless.';

-- The T-SQL runs sp_refreshview here so vwPipelines' `p.*` picks up the column. PostgreSQL has
-- no sp_refreshview; the CodeGen section regenerates vwPipelines against the table instead.

-- SQL text to insert 2 new entity field(s)
UPDATE ${mjSchema}."EntityField" SET "Sequence" = "Sequence" + 100000
WHERE
  "EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2'
  AND "Sequence" < 100000
  AND NOT EXISTS(
    SELECT
      1
    FROM ${mjSchema}."EntityField"
    WHERE
      "EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND "Sequence" >= 100000
  );

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'a7dbe8b8-5ce6-4d97-aa83-3d60853f864d' OR ("EntityID" = 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' AND "Name" = 'IncludeInForecast')) THEN
    INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES ('a7dbe8b8-5ce6-4d97-aa83-3d60853f864d', 'F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2' /* Entity: MJ_BizApps_Sales: Pipelines */, 15, 'IncludeInForecast', 'Include In Forecast', 'Whether open deals in this pipeline count toward open and weighted pipeline, the forecast buckets and the dashboard''s open-deal figures. Set to 0 for a pipeline that only holds historical deals. Closed deals count toward bookings, win rate and other history regardless.', 'bit', 1, 1, 0, FALSE, '(1)', FALSE, TRUE, FALSE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
  END IF;
END $$;

-- Set soft FK for __mj_BizAppsSales.Deal.CurrencyID → Currency.ID
UPDATE ${mjSchema}."EntityField" SET "__mj_UpdatedAt" = NOW(), "RelatedEntityID" = 'D3329BE1-541B-4918-B1CB-3D7A0454EBA7', "RelatedEntityFieldName" = 'ID', "IsSoftForeignKey" = TRUE
WHERE
  "EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND "Name" = 'CurrencyID';

-- ===================== CodeGen (native PG, baked) =====================

-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Pipelines
-- Item: Index for Foreign Keys
-- ============================================================
CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_pipeline_company_id"
    ON "__mj_bizappssales"."Pipeline" ("CompanyID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_pipeline_deal_type_id"
    ON "__mj_bizappssales"."Pipeline" ("DealTypeID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_pipeline_default_forecast_category_type_id"
    ON "__mj_bizappssales"."Pipeline" ("DefaultForecastCategoryTypeID");

-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Pipelines
-- Item: vwPipelines
-- ============================================================

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Pipelines
-----               SCHEMA:      __mj_bizappssales
-----               BASE TABLE:  Pipeline
-----               PRIMARY KEY: ID
------------------------------------------------------------
DO $vw_regen$
DECLARE
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW "__mj_bizappssales"."vwPipelines"
AS
SELECT
    p.*,
    MJCompany_CompanyID."Name" AS "Company",
    mjbizappssalesDealType_DealTypeID."Name" AS "DealType",
    mjbizappssalesForecastCategoryType_DefaultForecastCategoryTypeID."Name" AS "DefaultForecastCategoryType"
FROM
    "__mj_bizappssales"."Pipeline" AS p
INNER JOIN
    ${mjSchema}."Company" AS MJCompany_CompanyID
  ON
    "p"."CompanyID" = MJCompany_CompanyID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."DealType" AS mjbizappssalesDealType_DealTypeID
  ON
    "p"."DealTypeID" = mjbizappssalesDealType_DealTypeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."ForecastCategoryType" AS mjbizappssalesForecastCategoryType_DefaultForecastCategoryTypeID
  ON
    "p"."DefaultForecastCategoryTypeID" = mjbizappssalesForecastCategoryType_DefaultForecastCategoryTypeID."ID"
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
    AND tc.relname = 'vwPipelines'
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
    AND tc.relname = 'vwPipelines'
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
        AND tc.relname = 'vwPipelines'
        AND tc.relkind IN ('v', 'm')
  );

  DROP VIEW IF EXISTS "__mj_bizappssales"."vwPipelines" CASCADE;
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
GRANT SELECT ON "__mj_bizappssales"."vwPipelines" TO "cdp_UI";
GRANT SELECT ON "__mj_bizappssales"."vwPipelines" TO "cdp_Developer";
GRANT SELECT ON "__mj_bizappssales"."vwPipelines" TO "cdp_Integration";

-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Pipelines
-- Item: spCreatePipeline
-- ============================================================

------------------------------------------------------------
----- CREATE FUNCTION FOR Pipeline
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spCreatePipeline'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spCreatePipeline"(
    p_id UUID DEFAULT NULL,
    p_companyid UUID DEFAULT NULL,
    p_name varchar(200) DEFAULT NULL,
    p_code varchar(40) DEFAULT NULL,
    p_description_clear boolean DEFAULT false,
    p_description TEXT DEFAULT NULL,
    p_dealtypeid_clear boolean DEFAULT false,
    p_dealtypeid UUID DEFAULT NULL,
    p_defaultforecastcategorytypeid_clear boolean DEFAULT false,
    p_defaultforecastcategorytypeid UUID DEFAULT NULL,
    p_requiresdeallines BOOLEAN DEFAULT NULL,
    p_closewonpolicy_clear boolean DEFAULT false,
    p_closewonpolicy TEXT DEFAULT NULL,
    p_isdefault BOOLEAN DEFAULT NULL,
    p_displayrank int DEFAULT NULL,
    p_isactive BOOLEAN DEFAULT NULL,
    p_includeinforecast BOOLEAN DEFAULT NULL
) RETURNS SETOF "__mj_bizappssales"."vwPipelines" AS $$
DECLARE
    v_new_id UUID;
BEGIN
    v_new_id := COALESCE(p_id, gen_random_uuid());
    INSERT INTO "__mj_bizappssales"."Pipeline"
        (
            "ID",
            "CompanyID",
                "Name",
                "Code",
                "Description",
                "DealTypeID",
                "DefaultForecastCategoryTypeID",
                "RequiresDealLines",
                "CloseWonPolicy",
                "IsDefault",
                "DisplayRank",
                "IsActive",
                "IncludeInForecast"
        )
    VALUES
        (
            v_new_id,
            p_companyid,
                p_name,
                p_code,
                CASE WHEN p_description_clear = true THEN NULL ELSE COALESCE(p_description, NULL) END,
                CASE WHEN p_dealtypeid_clear = true THEN NULL ELSE COALESCE(p_dealtypeid, NULL) END,
                CASE WHEN p_defaultforecastcategorytypeid_clear = true THEN NULL ELSE COALESCE(p_defaultforecastcategorytypeid, NULL) END,
                COALESCE(p_requiresdeallines, TRUE),
                CASE WHEN p_closewonpolicy_clear = true THEN NULL ELSE COALESCE(p_closewonpolicy, NULL) END,
                COALESCE(p_isdefault, FALSE),
                COALESCE(p_displayrank, 0),
                COALESCE(p_isactive, TRUE),
                COALESCE(p_includeinforecast, TRUE)
        )
    ;

    RETURN QUERY
    SELECT * FROM "__mj_bizappssales"."vwPipelines"
    WHERE "ID" = v_new_id;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spCreatePipeline" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spCreatePipeline" TO "cdp_Integration";


-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Pipelines
-- Item: spUpdatePipeline
-- ============================================================

------------------------------------------------------------
----- UPDATE FUNCTION FOR Pipeline
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spUpdatePipeline'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spUpdatePipeline"(
    p_id UUID,
    p_companyid UUID DEFAULT NULL,
    p_name varchar(200) DEFAULT NULL,
    p_code varchar(40) DEFAULT NULL,
    p_description_clear boolean DEFAULT false,
    p_description TEXT DEFAULT NULL,
    p_dealtypeid_clear boolean DEFAULT false,
    p_dealtypeid UUID DEFAULT NULL,
    p_defaultforecastcategorytypeid_clear boolean DEFAULT false,
    p_defaultforecastcategorytypeid UUID DEFAULT NULL,
    p_requiresdeallines BOOLEAN DEFAULT NULL,
    p_closewonpolicy_clear boolean DEFAULT false,
    p_closewonpolicy TEXT DEFAULT NULL,
    p_isdefault BOOLEAN DEFAULT NULL,
    p_displayrank int DEFAULT NULL,
    p_isactive BOOLEAN DEFAULT NULL,
    p_includeinforecast BOOLEAN DEFAULT NULL
) RETURNS SETOF "__mj_bizappssales"."vwPipelines" AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE "__mj_bizappssales"."Pipeline"
    SET
        "CompanyID" = COALESCE(p_companyid, "CompanyID"),
        "Name" = COALESCE(p_name, "Name"),
        "Code" = COALESCE(p_code, "Code"),
        "Description" = CASE WHEN p_description_clear = true THEN NULL ELSE COALESCE(p_description, "Description") END,
        "DealTypeID" = CASE WHEN p_dealtypeid_clear = true THEN NULL ELSE COALESCE(p_dealtypeid, "DealTypeID") END,
        "DefaultForecastCategoryTypeID" = CASE WHEN p_defaultforecastcategorytypeid_clear = true THEN NULL ELSE COALESCE(p_defaultforecastcategorytypeid, "DefaultForecastCategoryTypeID") END,
        "RequiresDealLines" = COALESCE(p_requiresdeallines, "RequiresDealLines"),
        "CloseWonPolicy" = CASE WHEN p_closewonpolicy_clear = true THEN NULL ELSE COALESCE(p_closewonpolicy, "CloseWonPolicy") END,
        "IsDefault" = COALESCE(p_isdefault, "IsDefault"),
        "DisplayRank" = COALESCE(p_displayrank, "DisplayRank"),
        "IsActive" = COALESCE(p_isactive, "IsActive"),
        "IncludeInForecast" = COALESCE(p_includeinforecast, "IncludeInForecast")
    WHERE
        "ID" = p_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        -- Nothing was updated, return empty result set
        RETURN;
    END IF;

    -- Return the updated record from the base view
    RETURN QUERY
    SELECT * FROM "__mj_bizappssales"."vwPipelines"
    WHERE "ID" = p_id;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spUpdatePipeline" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spUpdatePipeline" TO "cdp_Integration";


------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the Pipeline table
------------------------------------------------------------
CREATE OR REPLACE FUNCTION "__mj_bizappssales"."fn_trg_update_pipeline"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."__mj_UpdatedAt" := NOW() AT TIME ZONE 'UTC';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_update_pipeline" ON "__mj_bizappssales"."Pipeline";

CREATE TRIGGER "trg_update_pipeline"
BEFORE UPDATE ON "__mj_bizappssales"."Pipeline"
FOR EACH ROW
EXECUTE FUNCTION "__mj_bizappssales"."fn_trg_update_pipeline"();



-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Pipelines
-- Item: spDeletePipeline
-- ============================================================

------------------------------------------------------------
----- DELETE FUNCTION FOR Pipeline
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spDeletePipeline'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spDeletePipeline"(
    p_id UUID
) RETURNS TABLE("ID" UUID) AS $$
#variable_conflict use_column
DECLARE
    v_affected_count INTEGER;
BEGIN

    DELETE FROM "__mj_bizappssales"."Pipeline"
    WHERE "ID" = p_id;

    GET DIAGNOSTICS v_affected_count = ROW_COUNT;

    IF v_affected_count = 0 THEN
        RETURN QUERY SELECT NULL::UUID AS "ID";
    ELSE
        RETURN QUERY SELECT p_id AS "ID";
    END IF;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spDeletePipeline" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spDeletePipeline" TO "cdp_Integration";
