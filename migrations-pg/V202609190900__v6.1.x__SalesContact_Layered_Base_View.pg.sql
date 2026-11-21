-- ============================================================================
-- PostgreSQL counterpart of migrations/V202609190900__v6.1.x__SalesContact_Layered_Base_View.sql
-- The Entity flag update is written by hand from the T-SQL; see its header for why Sales
-- Contacts moves to a layered base view. vwSalesContactsGenerated is native PostgreSQL CodeGen
-- (MJ 6.1.5) for the entity with the new flags, where the T-SQL carries SQL Server CodeGen's
-- definition renamed. It is the only CodeGen object this file carries, as in the T-SQL.
-- On PostgreSQL, Person stores DisplayName, so the inner view inherits it as a column.
-- ============================================================================

SET search_path TO __mj_bizappssales, public;
SET standard_conforming_strings = on;

-- Hand the base view to the application: CodeGen writes vwSalesContactsGenerated from here on.
-- Keyed by entity NAME, as in the T-SQL; the UPDATE skips cleanly when the row is absent.
UPDATE ${mjSchema}."Entity"
   SET "BaseViewGenerated" = FALSE,
       "GeneratedBaseViewName" = 'vwSalesContactsGenerated'
 WHERE "Name" = 'MJ_BizApps_Sales: Sales Contacts'
   AND ("BaseViewGenerated" <> FALSE
        OR "GeneratedBaseViewName" IS NULL
        OR "GeneratedBaseViewName" <> 'vwSalesContactsGenerated');

-- ===================== CodeGen (native PG, baked) =====================

-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Sales Contacts
-- Item: vwSalesContactsGenerated
-- ============================================================

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Sales Contacts
-----               SCHEMA:      __mj_bizappssales
-----               BASE TABLE:  SalesContact
-----               PRIMARY KEY: ID
------------------------------------------------------------
DO $vw_regen$
DECLARE
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW "__mj_bizappssales"."vwSalesContactsGenerated"
AS
SELECT
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
    __mj_isa_p1."DisplayName",
    __mj_isa_p1."SeniorityLevelID",
    MJEmployee_OwnerEmployeeID."FirstLast" AS "OwnerEmployee",
    mjbizappssalesLifecycleStageType_LifecycleStageTypeID."Name" AS "LifecycleStageType",
    mjbizappssalesBuyingRoleType_BuyingRoleTypeID."Name" AS "BuyingRoleType",
    mjbizappssalesLeadSourceType_LeadSourceTypeID."Name" AS "LeadSourceType"
FROM
    "__mj_bizappssales"."SalesContact" AS s
INNER JOIN
    "__mj_bizappscommon"."Person" AS __mj_isa_p1
  ON
    "s"."ID" = __mj_isa_p1."ID"
LEFT OUTER JOIN
    ${mjSchema}."vwEmployees" AS MJEmployee_OwnerEmployeeID
  ON
    "s"."OwnerEmployeeID" = MJEmployee_OwnerEmployeeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."LifecycleStageType" AS mjbizappssalesLifecycleStageType_LifecycleStageTypeID
  ON
    "s"."LifecycleStageTypeID" = mjbizappssalesLifecycleStageType_LifecycleStageTypeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."BuyingRoleType" AS mjbizappssalesBuyingRoleType_BuyingRoleTypeID
  ON
    "s"."BuyingRoleTypeID" = mjbizappssalesBuyingRoleType_BuyingRoleTypeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."LeadSourceType" AS mjbizappssalesLeadSourceType_LeadSourceTypeID
  ON
    "s"."LeadSourceTypeID" = mjbizappssalesLeadSourceType_LeadSourceTypeID."ID"
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
    AND tc.relname = 'vwSalesContactsGenerated'
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
    AND tc.relname = 'vwSalesContactsGenerated'
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
        AND tc.relname = 'vwSalesContactsGenerated'
        AND tc.relkind IN ('v', 'm')
  );

  DROP VIEW IF EXISTS "__mj_bizappssales"."vwSalesContactsGenerated" CASCADE;
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
