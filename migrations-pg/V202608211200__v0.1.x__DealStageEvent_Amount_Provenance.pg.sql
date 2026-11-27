-- ============================================================================
-- PostgreSQL counterpart of migrations/V202608211200__v0.1.x__DealStageEvent_Amount_Provenance.sql
-- Sections 1-2 (the column, its description, its EntityField row) are written by hand from the
-- T-SQL; see its header for why the column exists and why it is nullable. Section 3 is native
-- PostgreSQL CodeGen (MJ 6.1.5) for Deal Stage Events in place of the T-SQL's hand-transformed
-- CRUD procedures: it regenerates vwDealStageEvents too, which PostgreSQL needs because a view's
-- `d.*` is expanded when the view is created and does not pick up the new column on its own.
-- ============================================================================

SET search_path TO __mj_bizappssales, public;
SET standard_conforming_strings = on;

-- 1. THE COLUMN (the T-SQL guards on sys.columns; IF NOT EXISTS is the same guard)
ALTER TABLE __mj_bizappssales."DealStageEvent" ADD COLUMN IF NOT EXISTS "AmountAtTransitionIsComputed" BOOLEAN NULL;

COMMENT ON COLUMN __mj_bizappssales."DealStageEvent"."AmountAtTransitionIsComputed" IS 'Whether AmountAtTransition came from the orders engine (1) or was stated by a person (0). NULL means the transition was recorded before this was tracked — it is not backfillable, because Deal.AmountIsComputed describes the deal as it is now, not as it was at the close.';

-- 2. THE ENTITY FIELD, so the entity layer can write it. Guarded on the entity existing, as the
--    T-SQL is; see its header for the rebuild case that guard exists for.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM ${mjSchema}."Entity" WHERE "ID" = '5AC3D14E-A9BA-4667-AF73-5928DAE446BF')
     AND NOT EXISTS (
       SELECT 1 FROM ${mjSchema}."EntityField"
        WHERE "ID" = 'b7f4a1c2-3d5e-4a68-9c07-1e2f3a4b5c6d'
           OR ("EntityID" = '5AC3D14E-A9BA-4667-AF73-5928DAE446BF' AND "Name" = 'AmountAtTransitionIsComputed')
     ) THEN
    INSERT INTO ${mjSchema}."EntityField"
    (
        "ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length",
        "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI",
        "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField",
        "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView",
        "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt"
    )
    VALUES
    (
        'b7f4a1c2-3d5e-4a68-9c07-1e2f3a4b5c6d',
        '5AC3D14E-A9BA-4667-AF73-5928DAE446BF', -- Entity: MJ_BizApps_Sales: Deal Stage Events
        (SELECT COALESCE(MAX("Sequence"), 0) FROM ${mjSchema}."EntityField"
          WHERE "EntityID" = '5AC3D14E-A9BA-4667-AF73-5928DAE446BF') + 10,
        'AmountAtTransitionIsComputed',
        'Amount At Transition Is Computed',
        'Whether AmountAtTransition came from the orders engine (1) or was stated by a person (0). NULL means the transition predates the column.',
        'bit',
        1,
        1,
        0,
        TRUE,       -- AllowsNull: NULL is a real answer here, see the T-SQL header
        NULL,
        FALSE,
        TRUE,       -- AllowUpdateAPI
        FALSE, FALSE,
        NULL, NULL,
        FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
        'Search',
        NOW(), NOW()
    );
  END IF;
END $$;

-- 3. THE CRUD FUNCTIONS AND THE VIEW: the CodeGen section below.

-- ===================== CodeGen (native PG, baked) =====================

-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deal Stage Events
-- Item: Index for Foreign Keys
-- ============================================================
CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_stage_event_deal_id"
    ON "__mj_bizappssales"."DealStageEvent" ("DealID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_stage_event_from_stage_id"
    ON "__mj_bizappssales"."DealStageEvent" ("FromStageID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_stage_event_to_stage_id"
    ON "__mj_bizappssales"."DealStageEvent" ("ToStageID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_stage_event_from_deal_status_type_id"
    ON "__mj_bizappssales"."DealStageEvent" ("FromDealStatusTypeID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_stage_event_to_deal_status_type_id"
    ON "__mj_bizappssales"."DealStageEvent" ("ToDealStatusTypeID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_stage_event_changed_by_user_id"
    ON "__mj_bizappssales"."DealStageEvent" ("ChangedByUserID");

-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deal Stage Events
-- Item: vwDealStageEvents
-- ============================================================

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Deal Stage Events
-----               SCHEMA:      __mj_bizappssales
-----               BASE TABLE:  DealStageEvent
-----               PRIMARY KEY: ID
------------------------------------------------------------
DO $vw_regen$
DECLARE
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW "__mj_bizappssales"."vwDealStageEvents"
AS
SELECT
    d.*,
    mjbizappssalesDeal_DealID."Name" AS "Deal",
    mjbizappssalesPipelineStage_FromStageID."Name" AS "FromStage",
    mjbizappssalesPipelineStage_ToStageID."Name" AS "ToStage",
    mjbizappssalesDealStatusType_FromDealStatusTypeID."Name" AS "FromDealStatusType",
    mjbizappssalesDealStatusType_ToDealStatusTypeID."Name" AS "ToDealStatusType",
    MJUser_ChangedByUserID."Name" AS "ChangedByUser"
FROM
    "__mj_bizappssales"."DealStageEvent" AS d
INNER JOIN
    "__mj_bizappssales"."Deal" AS mjbizappssalesDeal_DealID
  ON
    "d"."DealID" = mjbizappssalesDeal_DealID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."PipelineStage" AS mjbizappssalesPipelineStage_FromStageID
  ON
    "d"."FromStageID" = mjbizappssalesPipelineStage_FromStageID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."PipelineStage" AS mjbizappssalesPipelineStage_ToStageID
  ON
    "d"."ToStageID" = mjbizappssalesPipelineStage_ToStageID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."DealStatusType" AS mjbizappssalesDealStatusType_FromDealStatusTypeID
  ON
    "d"."FromDealStatusTypeID" = mjbizappssalesDealStatusType_FromDealStatusTypeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."DealStatusType" AS mjbizappssalesDealStatusType_ToDealStatusTypeID
  ON
    "d"."ToDealStatusTypeID" = mjbizappssalesDealStatusType_ToDealStatusTypeID."ID"
LEFT OUTER JOIN
    ${mjSchema}."User" AS MJUser_ChangedByUserID
  ON
    "d"."ChangedByUserID" = MJUser_ChangedByUserID."ID"
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
    AND tc.relname = 'vwDealStageEvents'
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
    AND tc.relname = 'vwDealStageEvents'
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
        AND tc.relname = 'vwDealStageEvents'
        AND tc.relkind IN ('v', 'm')
  );

  DROP VIEW IF EXISTS "__mj_bizappssales"."vwDealStageEvents" CASCADE;
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
GRANT SELECT ON "__mj_bizappssales"."vwDealStageEvents" TO "cdp_UI";
GRANT SELECT ON "__mj_bizappssales"."vwDealStageEvents" TO "cdp_Developer";
GRANT SELECT ON "__mj_bizappssales"."vwDealStageEvents" TO "cdp_Integration";

-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deal Stage Events
-- Item: spCreateDealStageEvent
-- ============================================================

------------------------------------------------------------
----- CREATE FUNCTION FOR DealStageEvent
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spCreateDealStageEvent'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spCreateDealStageEvent"(
    p_id UUID DEFAULT NULL,
    p_dealid UUID DEFAULT NULL,
    p_fromstageid_clear boolean DEFAULT false,
    p_fromstageid UUID DEFAULT NULL,
    p_tostageid_clear boolean DEFAULT false,
    p_tostageid UUID DEFAULT NULL,
    p_fromdealstatustypeid_clear boolean DEFAULT false,
    p_fromdealstatustypeid UUID DEFAULT NULL,
    p_todealstatustypeid_clear boolean DEFAULT false,
    p_todealstatustypeid UUID DEFAULT NULL,
    p_changedbyuserid_clear boolean DEFAULT false,
    p_changedbyuserid UUID DEFAULT NULL,
    p_changedat TIMESTAMPTZ DEFAULT NULL,
    p_daysinpreviousstage_clear boolean DEFAULT false,
    p_daysinpreviousstage int DEFAULT NULL,
    p_amountattransition_clear boolean DEFAULT false,
    p_amountattransition decimal(19, 4) DEFAULT NULL,
    p_amountattransitioniscomputed_clear boolean DEFAULT false,
    p_amountattransitioniscomputed BOOLEAN DEFAULT NULL,
    p_probabilityattransition_clear boolean DEFAULT false,
    p_probabilityattransition decimal(5, 2) DEFAULT NULL,
    p_notes_clear boolean DEFAULT false,
    p_notes TEXT DEFAULT NULL
) RETURNS SETOF "__mj_bizappssales"."vwDealStageEvents" AS $$
DECLARE
    v_new_id UUID;
BEGIN
    v_new_id := COALESCE(p_id, gen_random_uuid());
    INSERT INTO "__mj_bizappssales"."DealStageEvent"
        (
            "ID",
            "DealID",
                "FromStageID",
                "ToStageID",
                "FromDealStatusTypeID",
                "ToDealStatusTypeID",
                "ChangedByUserID",
                "ChangedAt",
                "DaysInPreviousStage",
                "AmountAtTransition",
                "AmountAtTransitionIsComputed",
                "ProbabilityAtTransition",
                "Notes"
        )
    VALUES
        (
            v_new_id,
            p_dealid,
                CASE WHEN p_fromstageid_clear = true THEN NULL ELSE COALESCE(p_fromstageid, NULL) END,
                CASE WHEN p_tostageid_clear = true THEN NULL ELSE COALESCE(p_tostageid, NULL) END,
                CASE WHEN p_fromdealstatustypeid_clear = true THEN NULL ELSE COALESCE(p_fromdealstatustypeid, NULL) END,
                CASE WHEN p_todealstatustypeid_clear = true THEN NULL ELSE COALESCE(p_todealstatustypeid, NULL) END,
                CASE WHEN p_changedbyuserid_clear = true THEN NULL ELSE COALESCE(p_changedbyuserid, NULL) END,
                COALESCE(p_changedat, NOW() AT TIME ZONE 'UTC'),
                CASE WHEN p_daysinpreviousstage_clear = true THEN NULL ELSE COALESCE(p_daysinpreviousstage, NULL) END,
                CASE WHEN p_amountattransition_clear = true THEN NULL ELSE COALESCE(p_amountattransition, NULL) END,
                CASE WHEN p_amountattransitioniscomputed_clear = true THEN NULL ELSE COALESCE(p_amountattransitioniscomputed, NULL) END,
                CASE WHEN p_probabilityattransition_clear = true THEN NULL ELSE COALESCE(p_probabilityattransition, NULL) END,
                CASE WHEN p_notes_clear = true THEN NULL ELSE COALESCE(p_notes, NULL) END
        )
    ;

    RETURN QUERY
    SELECT * FROM "__mj_bizappssales"."vwDealStageEvents"
    WHERE "ID" = v_new_id;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spCreateDealStageEvent" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spCreateDealStageEvent" TO "cdp_Integration";


-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deal Stage Events
-- Item: spUpdateDealStageEvent
-- ============================================================

------------------------------------------------------------
----- UPDATE FUNCTION FOR DealStageEvent
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spUpdateDealStageEvent'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spUpdateDealStageEvent"(
    p_id UUID,
    p_dealid UUID DEFAULT NULL,
    p_fromstageid_clear boolean DEFAULT false,
    p_fromstageid UUID DEFAULT NULL,
    p_tostageid_clear boolean DEFAULT false,
    p_tostageid UUID DEFAULT NULL,
    p_fromdealstatustypeid_clear boolean DEFAULT false,
    p_fromdealstatustypeid UUID DEFAULT NULL,
    p_todealstatustypeid_clear boolean DEFAULT false,
    p_todealstatustypeid UUID DEFAULT NULL,
    p_changedbyuserid_clear boolean DEFAULT false,
    p_changedbyuserid UUID DEFAULT NULL,
    p_changedat TIMESTAMPTZ DEFAULT NULL,
    p_daysinpreviousstage_clear boolean DEFAULT false,
    p_daysinpreviousstage int DEFAULT NULL,
    p_amountattransition_clear boolean DEFAULT false,
    p_amountattransition decimal(19, 4) DEFAULT NULL,
    p_amountattransitioniscomputed_clear boolean DEFAULT false,
    p_amountattransitioniscomputed BOOLEAN DEFAULT NULL,
    p_probabilityattransition_clear boolean DEFAULT false,
    p_probabilityattransition decimal(5, 2) DEFAULT NULL,
    p_notes_clear boolean DEFAULT false,
    p_notes TEXT DEFAULT NULL
) RETURNS SETOF "__mj_bizappssales"."vwDealStageEvents" AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE "__mj_bizappssales"."DealStageEvent"
    SET
        "DealID" = COALESCE(p_dealid, "DealID"),
        "FromStageID" = CASE WHEN p_fromstageid_clear = true THEN NULL ELSE COALESCE(p_fromstageid, "FromStageID") END,
        "ToStageID" = CASE WHEN p_tostageid_clear = true THEN NULL ELSE COALESCE(p_tostageid, "ToStageID") END,
        "FromDealStatusTypeID" = CASE WHEN p_fromdealstatustypeid_clear = true THEN NULL ELSE COALESCE(p_fromdealstatustypeid, "FromDealStatusTypeID") END,
        "ToDealStatusTypeID" = CASE WHEN p_todealstatustypeid_clear = true THEN NULL ELSE COALESCE(p_todealstatustypeid, "ToDealStatusTypeID") END,
        "ChangedByUserID" = CASE WHEN p_changedbyuserid_clear = true THEN NULL ELSE COALESCE(p_changedbyuserid, "ChangedByUserID") END,
        "ChangedAt" = COALESCE(p_changedat, "ChangedAt"),
        "DaysInPreviousStage" = CASE WHEN p_daysinpreviousstage_clear = true THEN NULL ELSE COALESCE(p_daysinpreviousstage, "DaysInPreviousStage") END,
        "AmountAtTransition" = CASE WHEN p_amountattransition_clear = true THEN NULL ELSE COALESCE(p_amountattransition, "AmountAtTransition") END,
        "AmountAtTransitionIsComputed" = CASE WHEN p_amountattransitioniscomputed_clear = true THEN NULL ELSE COALESCE(p_amountattransitioniscomputed, "AmountAtTransitionIsComputed") END,
        "ProbabilityAtTransition" = CASE WHEN p_probabilityattransition_clear = true THEN NULL ELSE COALESCE(p_probabilityattransition, "ProbabilityAtTransition") END,
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
    SELECT * FROM "__mj_bizappssales"."vwDealStageEvents"
    WHERE "ID" = p_id;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spUpdateDealStageEvent" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spUpdateDealStageEvent" TO "cdp_Integration";


------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the DealStageEvent table
------------------------------------------------------------
CREATE OR REPLACE FUNCTION "__mj_bizappssales"."fn_trg_update_deal_stage_event"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."__mj_UpdatedAt" := NOW() AT TIME ZONE 'UTC';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_update_deal_stage_event" ON "__mj_bizappssales"."DealStageEvent";

CREATE TRIGGER "trg_update_deal_stage_event"
BEFORE UPDATE ON "__mj_bizappssales"."DealStageEvent"
FOR EACH ROW
EXECUTE FUNCTION "__mj_bizappssales"."fn_trg_update_deal_stage_event"();



-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deal Stage Events
-- Item: spDeleteDealStageEvent
-- ============================================================

------------------------------------------------------------
----- DELETE FUNCTION FOR DealStageEvent
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spDeleteDealStageEvent'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spDeleteDealStageEvent"(
    p_id UUID
) RETURNS TABLE("ID" UUID) AS $$
#variable_conflict use_column
DECLARE
    v_affected_count INTEGER;
BEGIN

    DELETE FROM "__mj_bizappssales"."DealStageEvent"
    WHERE "ID" = p_id;

    GET DIAGNOSTICS v_affected_count = ROW_COUNT;

    IF v_affected_count = 0 THEN
        RETURN QUERY SELECT NULL::UUID AS "ID";
    ELSE
        RETURN QUERY SELECT p_id AS "ID";
    END IF;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spDeleteDealStageEvent" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spDeleteDealStageEvent" TO "cdp_Integration";
