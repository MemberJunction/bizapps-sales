-- ============================================================================
-- PostgreSQL counterpart of migrations/V202609202353__v6.4.0__Predictive_Deal_Win_Fields.sql
-- Sections 1-3 (the prediction columns and check, the layered-view flags, the EntityField rows)
-- and the vwDeals wrapper are written by hand from the T-SQL. vwDealsGenerated and the CodeGen
-- section are native PostgreSQL CodeGen (MJ 6.1.5), not translated T-SQL. The CodeGen section
-- leaves out CodeGen's double-wrapped vwDeals grant block, which does not parse (MJ#5552) and
-- repeats the grant above it.
-- ============================================================================

SET search_path TO __mj_bizappssales, public;
SET standard_conforming_strings = on;

---------------------------------------------------------------------------
-- 1. Deal: Add materialized prediction fields
---------------------------------------------------------------------------
-- The T-SQL guards each step on the catalog; IF NOT EXISTS and a NOT EXISTS check on
-- pg_constraint are the same guards here. COMMENT ON sets a description whether or not one exists,
-- which is what the T-SQL's update-or-add pair does.
ALTER TABLE __mj_bizappssales."Deal"
    ADD COLUMN IF NOT EXISTS "PredictedWinProbability" NUMERIC(5, 4) NULL,
    ADD COLUMN IF NOT EXISTS "PredictedWinRiskBand" VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS "PredictedWinScoredAt" TIMESTAMPTZ NULL;

DO $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = 'CK_Deal_PredictedWinRiskBand'
         AND conrelid = '__mj_bizappssales."Deal"'::regclass
  ) THEN
    ALTER TABLE __mj_bizappssales."Deal" ADD CONSTRAINT "CK_Deal_PredictedWinRiskBand"
        CHECK ("PredictedWinRiskBand" IN ('Low', 'Medium', 'High', 'Critical'));
  END IF;
END $$;

COMMENT ON COLUMN __mj_bizappssales."Deal"."PredictedWinProbability" IS '0.0000 to 1.0000 probability that the deal will close as Won.';
COMMENT ON COLUMN __mj_bizappssales."Deal"."PredictedWinRiskBand" IS 'Categorical priority/risk tier derived from deal win probability: Low, Medium, High, Critical.';
COMMENT ON COLUMN __mj_bizappssales."Deal"."PredictedWinScoredAt" IS 'Timestamp when the deal was last scored by the predictive deal win propensity model.';

---------------------------------------------------------------------------
-- 2. Establish Layered Base Views for Deals
---------------------------------------------------------------------------
UPDATE ${mjSchema}."Entity"
   SET "BaseViewGenerated" = FALSE,
       "GeneratedBaseViewName" = 'vwDealsGenerated'
 WHERE "Name" = 'MJ_BizApps_Sales: Deals'
   AND ("BaseViewGenerated" <> FALSE
        OR "GeneratedBaseViewName" IS NULL
        OR "GeneratedBaseViewName" <> 'vwDealsGenerated');

---------------------------------------------------------------------------
-- 3. EntityField rows: the three stored columns and the eight engineered features. The T-SQL
--    stages the features in a table variable and MERGEs them; INSERT ... SELECT ... WHERE NOT
--    EXISTS over a VALUES list does the same, with the same ROW_NUMBER sequence by name.
---------------------------------------------------------------------------
DO $$
DECLARE
  v_dealEntityID UUID := (SELECT "ID" FROM ${mjSchema}."Entity" WHERE "Name" = 'MJ_BizApps_Sales: Deals');
BEGIN
  IF v_dealEntityID IS NULL THEN
    RAISE EXCEPTION 'Entity not registered: MJ_BizApps_Sales: Deals';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = v_dealEntityID AND "Name" = 'PredictedWinProbability') THEN
    INSERT INTO ${mjSchema}."EntityField" (
        "ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale",
        "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed",
        "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView",
        "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt"
    ) VALUES (
        'f3e8b282-249c-4817-be3d-00efad3569d3', v_dealEntityID,
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = v_dealEntityID),
        'PredictedWinProbability', 'Predicted Win Probability',
        '0.0000 to 1.0000 probability that the deal will close as Won.',
        'decimal', 5, 5, 4, TRUE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = v_dealEntityID AND "Name" = 'PredictedWinRiskBand') THEN
    INSERT INTO ${mjSchema}."EntityField" (
        "ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale",
        "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed",
        "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView",
        "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt"
    ) VALUES (
        '7c778bdc-ec7e-4275-b8be-49792d542d0b', v_dealEntityID,
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = v_dealEntityID),
        'PredictedWinRiskBand', 'Predicted Win Risk Band',
        'Categorical priority/risk tier derived from deal win probability: Low, Medium, High, Critical.',
        'nvarchar', 20, 0, 0, TRUE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = v_dealEntityID AND "Name" = 'PredictedWinScoredAt') THEN
    INSERT INTO ${mjSchema}."EntityField" (
        "ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale",
        "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed",
        "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView",
        "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt"
    ) VALUES (
        'b1e35f02-c32a-4f17-b0e5-5577a1fd3950', v_dealEntityID,
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = v_dealEntityID),
        'PredictedWinScoredAt', 'Predicted Win Scored At',
        'Timestamp when the deal was last scored by the predictive deal win propensity model.',
        'datetimeoffset', 10, 34, 7, TRUE, NULL, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW()
    );
  END IF;

  -- Virtual engineered features
  INSERT INTO ${mjSchema}."EntityField"
      ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale",
       "AllowsNull", "DefaultInView", "IsVirtual", "AllowUpdateAPI", "Status")
  SELECT
      gen_random_uuid(),
      v_dealEntityID,
      (SELECT COALESCE(MAX("Sequence"), 0) FROM ${mjSchema}."EntityField" WHERE "EntityID" = v_dealEntityID)
          + ROW_NUMBER() OVER (ORDER BY f."Name"),
      f."Name", f."DisplayName", f."Description", f."Type", f."Length", f."Precision", f."Scale",
      TRUE, FALSE, TRUE, FALSE, 'Active'
  FROM (VALUES
      ('WinOutcome', 'Win Outcome', 'int', 4, 10, 0, 'Binary outcome: 1 if Closed Won, 0 if Closed Lost/Abandoned, NULL if active/open.'),
      ('DaysToExpectedClose', 'Days To Expected Close', 'int', 4, 10, 0, 'Projected deal cycle duration in days from start or creation to expected close.'),
      ('HasPaymentSchedule', 'Has Payment Schedule', 'bit', 1, 1, 0, '1 if the deal negotiated a customized milestone payment schedule, otherwise 0.'),
      ('TeamMemberCount', 'Team Member Count', 'int', 4, 10, 0, 'Number of assigned team members collaborated on this deal.'),
      ('HasPartnerInvolved', 'Has Partner Involved', 'bit', 1, 1, 0, '1 if a partner manager role is attached to the deal team, otherwise 0.'),
      ('IsEnterpriseTier', 'Is Enterprise Tier', 'bit', 1, 1, 0, '1 if deal amount is >= $100k enterprise tier threshold, otherwise 0.'),
      ('AutoRenewFlag', 'Auto Renew Flag', 'bit', 1, 1, 0, 'Binary indicator whether the deal contract specifies auto-renewal.'),
      ('StandardAgreementModifiedFlag', 'Standard Agreement Modified Flag', 'bit', 1, 1, 0, 'Binary indicator whether standard contractual terms were modified.')
  ) AS f ("Name", "DisplayName", "Type", "Length", "Precision", "Scale", "Description")
  WHERE NOT EXISTS (
      SELECT 1 FROM ${mjSchema}."EntityField" t
       WHERE t."EntityID" = v_dealEntityID AND t."Name" = f."Name");
END $$;
-- The inner view: CodeGen's PostgreSQL definition, as the T-SQL carries SQL Server CodeGen's.
-- The CodeGen section below regenerates it again with the CRUD functions; that run is a no-op.
-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deals
-- Item: vwDealsGenerated
-- ============================================================

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Deals
-----               SCHEMA:      __mj_bizappssales
-----               BASE TABLE:  Deal
-----               PRIMARY KEY: ID
------------------------------------------------------------
DO $vw_regen$
DECLARE
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW "__mj_bizappssales"."vwDealsGenerated"
AS
SELECT
    d.*,
    mjbizappssalesPipeline_PipelineID."Name" AS "Pipeline",
    mjbizappssalesPipelineStage_PipelineStageID."Name" AS "PipelineStage",
    mjbizappssalesDealType_DealTypeID."Name" AS "DealType",
    mjbizappssalesDealStatusType_DealStatusTypeID."Name" AS "DealStatusType",
    mjbizappssalesSalesAccount_AccountID."Name" AS "Account",
    mjbizappssalesSalesContact_PrimaryContactID."DisplayNameAndEmail" AS "PrimaryContact",
    mjbizappssalesSalesContact_BillingContactID."DisplayNameAndEmail" AS "BillingContact",
    MJCompany_CompanyID."Name" AS "Company",
    MJEmployee_OwnerEmployeeID."FirstLast" AS "OwnerEmployee",
    mjbizappssalesForecastCategoryType_ForecastCategoryTypeID."Name" AS "ForecastCategoryType",
    mjbizappssalesLossReason_LossReasonID."Name" AS "LossReason",
    mjbizappssalesLeadSourceType_LeadSourceTypeID."Name" AS "LeadSourceType",
    MJUser_ClosedByUserID."Name" AS "ClosedByUser",
    mjbizappsordersOrderHeader_OrderID."OrderNumber" AS "Order"
FROM
    "__mj_bizappssales"."Deal" AS d
INNER JOIN
    "__mj_bizappssales"."Pipeline" AS mjbizappssalesPipeline_PipelineID
  ON
    "d"."PipelineID" = mjbizappssalesPipeline_PipelineID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."PipelineStage" AS mjbizappssalesPipelineStage_PipelineStageID
  ON
    "d"."PipelineStageID" = mjbizappssalesPipelineStage_PipelineStageID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."DealType" AS mjbizappssalesDealType_DealTypeID
  ON
    "d"."DealTypeID" = mjbizappssalesDealType_DealTypeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."DealStatusType" AS mjbizappssalesDealStatusType_DealStatusTypeID
  ON
    "d"."DealStatusTypeID" = mjbizappssalesDealStatusType_DealStatusTypeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."vwSalesAccounts" AS mjbizappssalesSalesAccount_AccountID
  ON
    "d"."AccountID" = mjbizappssalesSalesAccount_AccountID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."vwSalesContacts" AS mjbizappssalesSalesContact_PrimaryContactID
  ON
    "d"."PrimaryContactID" = mjbizappssalesSalesContact_PrimaryContactID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."vwSalesContacts" AS mjbizappssalesSalesContact_BillingContactID
  ON
    "d"."BillingContactID" = mjbizappssalesSalesContact_BillingContactID."ID"
INNER JOIN
    ${mjSchema}."Company" AS MJCompany_CompanyID
  ON
    "d"."CompanyID" = MJCompany_CompanyID."ID"
LEFT OUTER JOIN
    ${mjSchema}."vwEmployees" AS MJEmployee_OwnerEmployeeID
  ON
    "d"."OwnerEmployeeID" = MJEmployee_OwnerEmployeeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."ForecastCategoryType" AS mjbizappssalesForecastCategoryType_ForecastCategoryTypeID
  ON
    "d"."ForecastCategoryTypeID" = mjbizappssalesForecastCategoryType_ForecastCategoryTypeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."LossReason" AS mjbizappssalesLossReason_LossReasonID
  ON
    "d"."LossReasonID" = mjbizappssalesLossReason_LossReasonID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."LeadSourceType" AS mjbizappssalesLeadSourceType_LeadSourceTypeID
  ON
    "d"."LeadSourceTypeID" = mjbizappssalesLeadSourceType_LeadSourceTypeID."ID"
LEFT OUTER JOIN
    ${mjSchema}."User" AS MJUser_ClosedByUserID
  ON
    "d"."ClosedByUserID" = MJUser_ClosedByUserID."ID"
LEFT OUTER JOIN
    "__mj_bizappsorders"."OrderHeader" AS mjbizappsordersOrderHeader_OrderID
  ON
    "d"."OrderID" = mjbizappsordersOrderHeader_OrderID."ID"
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
    AND tc.relname = 'vwDealsGenerated'
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
    AND tc.relname = 'vwDealsGenerated'
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
        AND tc.relname = 'vwDealsGenerated'
        AND tc.relkind IN ('v', 'm')
  );

  DROP VIEW IF EXISTS "__mj_bizappssales"."vwDealsGenerated" CASCADE;
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

-- The application-owned wrapper. vwDeals is dropped with CASCADE because the CodeGen CRUD
-- functions return SETOF vwDeals and PostgreSQL will not drop it otherwise; nothing else depends
-- on it. The CodeGen section below recreates spCreateDeal and spUpdateDeal.
--
-- Translated from the T-SQL, and only where the dialects differ:
--   * DATEDIFF(day, a, b) counts day boundaries; date - date is the same count here. The creation
--     day is taken in UTC, as CAST(<datetimeoffset> AS date) does on SQL Server.
--   * The eight engineered features keep the T-SQL's types for the int fields and are BOOLEAN for
--     the four registered as bit, which is how PostgreSQL types a bit field.
DROP VIEW IF EXISTS __mj_bizappssales."vwDeals" CASCADE;

CREATE VIEW __mj_bizappssales."vwDeals"
AS
SELECT
    g.*,
    CASE
        WHEN mjBizAppsSalesDealStatusType_DealStatusTypeID."Code" = 'WON' THEN 1
        WHEN mjBizAppsSalesDealStatusType_DealStatusTypeID."Code" IN ('LOST', 'ABANDONED') THEN 0
        ELSE NULL
    END AS "WinOutcome",
    CASE
        WHEN g."ExpectedCloseDate" IS NOT NULL AND g."StartDate" IS NOT NULL THEN g."ExpectedCloseDate" - g."StartDate"
        WHEN g."ExpectedCloseDate" IS NOT NULL THEN g."ExpectedCloseDate" - (g."__mj_CreatedAt" AT TIME ZONE 'UTC')::DATE
        ELSE NULL
    END AS "DaysToExpectedClose",
    COALESCE(ps."HasPaymentSchedule", FALSE) AS "HasPaymentSchedule",
    COALESCE(team."TeamMemberCount", 0) AS "TeamMemberCount",
    COALESCE(team."HasPartnerInvolved", FALSE) AS "HasPartnerInvolved",
    COALESCE(g."Amount" >= 100000, FALSE) AS "IsEnterpriseTier",
    COALESCE(g."AutoRenew" = TRUE, FALSE) AS "AutoRenewFlag",
    COALESCE(g."StandardAgreementModified" = TRUE, FALSE) AS "StandardAgreementModifiedFlag"
FROM
    __mj_bizappssales."vwDealsGenerated" AS g
LEFT OUTER JOIN
    __mj_bizappssales."DealStatusType" AS mjBizAppsSalesDealStatusType_DealStatusTypeID
  ON
    g."DealStatusTypeID" = mjBizAppsSalesDealStatusType_DealStatusTypeID."ID"
LEFT OUTER JOIN (
    SELECT "DealID", TRUE AS "HasPaymentSchedule"
    FROM __mj_bizappssales."DealPaymentSchedule"
    GROUP BY "DealID"
) AS ps ON ps."DealID" = g."ID"
LEFT OUTER JOIN (
    SELECT
        tm."DealID",
        COUNT(*)::INTEGER AS "TeamMemberCount",
        BOOL_OR(r."Code" = 'PARTNERMGR') AS "HasPartnerInvolved"
    FROM __mj_bizappssales."DealTeamMember" tm
    JOIN __mj_bizappssales."DealRole" r ON tm."DealRoleID" = r."ID"
    GROUP BY tm."DealID"
) AS team ON team."DealID" = g."ID";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cdp_UI') THEN
    GRANT SELECT ON __mj_bizappssales."vwDeals" TO "cdp_UI";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cdp_Developer') THEN
    GRANT SELECT ON __mj_bizappssales."vwDeals" TO "cdp_Developer";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cdp_Integration') THEN
    GRANT SELECT ON __mj_bizappssales."vwDeals" TO "cdp_Integration";
  END IF;
END $$;

-- ===================== CodeGen (native PG, baked) =====================

-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deals
-- Item: Index for Foreign Keys
-- ============================================================
CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_pipeline_id"
    ON "__mj_bizappssales"."Deal" ("PipelineID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_pipeline_stage_id"
    ON "__mj_bizappssales"."Deal" ("PipelineStageID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_deal_type_id"
    ON "__mj_bizappssales"."Deal" ("DealTypeID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_deal_status_type_id"
    ON "__mj_bizappssales"."Deal" ("DealStatusTypeID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_account_id"
    ON "__mj_bizappssales"."Deal" ("AccountID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_primary_contact_id"
    ON "__mj_bizappssales"."Deal" ("PrimaryContactID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_billing_contact_id"
    ON "__mj_bizappssales"."Deal" ("BillingContactID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_company_id"
    ON "__mj_bizappssales"."Deal" ("CompanyID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_owner_employee_id"
    ON "__mj_bizappssales"."Deal" ("OwnerEmployeeID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_forecast_category_type_id"
    ON "__mj_bizappssales"."Deal" ("ForecastCategoryTypeID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_loss_reason_id"
    ON "__mj_bizappssales"."Deal" ("LossReasonID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_lead_source_type_id"
    ON "__mj_bizappssales"."Deal" ("LeadSourceTypeID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_closed_by_user_id"
    ON "__mj_bizappssales"."Deal" ("ClosedByUserID");

CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_order_id"
    ON "__mj_bizappssales"."Deal" ("OrderID");

-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deals
-- Item: vwDealsGenerated
-- ============================================================

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Deals
-----               SCHEMA:      __mj_bizappssales
-----               BASE TABLE:  Deal
-----               PRIMARY KEY: ID
------------------------------------------------------------
DO $vw_regen$
DECLARE
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW "__mj_bizappssales"."vwDealsGenerated"
AS
SELECT
    d.*,
    mjbizappssalesPipeline_PipelineID."Name" AS "Pipeline",
    mjbizappssalesPipelineStage_PipelineStageID."Name" AS "PipelineStage",
    mjbizappssalesDealType_DealTypeID."Name" AS "DealType",
    mjbizappssalesDealStatusType_DealStatusTypeID."Name" AS "DealStatusType",
    mjbizappssalesSalesAccount_AccountID."Name" AS "Account",
    mjbizappssalesSalesContact_PrimaryContactID."DisplayNameAndEmail" AS "PrimaryContact",
    mjbizappssalesSalesContact_BillingContactID."DisplayNameAndEmail" AS "BillingContact",
    MJCompany_CompanyID."Name" AS "Company",
    MJEmployee_OwnerEmployeeID."FirstLast" AS "OwnerEmployee",
    mjbizappssalesForecastCategoryType_ForecastCategoryTypeID."Name" AS "ForecastCategoryType",
    mjbizappssalesLossReason_LossReasonID."Name" AS "LossReason",
    mjbizappssalesLeadSourceType_LeadSourceTypeID."Name" AS "LeadSourceType",
    MJUser_ClosedByUserID."Name" AS "ClosedByUser",
    mjbizappsordersOrderHeader_OrderID."OrderNumber" AS "Order"
FROM
    "__mj_bizappssales"."Deal" AS d
INNER JOIN
    "__mj_bizappssales"."Pipeline" AS mjbizappssalesPipeline_PipelineID
  ON
    "d"."PipelineID" = mjbizappssalesPipeline_PipelineID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."PipelineStage" AS mjbizappssalesPipelineStage_PipelineStageID
  ON
    "d"."PipelineStageID" = mjbizappssalesPipelineStage_PipelineStageID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."DealType" AS mjbizappssalesDealType_DealTypeID
  ON
    "d"."DealTypeID" = mjbizappssalesDealType_DealTypeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."DealStatusType" AS mjbizappssalesDealStatusType_DealStatusTypeID
  ON
    "d"."DealStatusTypeID" = mjbizappssalesDealStatusType_DealStatusTypeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."vwSalesAccounts" AS mjbizappssalesSalesAccount_AccountID
  ON
    "d"."AccountID" = mjbizappssalesSalesAccount_AccountID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."vwSalesContacts" AS mjbizappssalesSalesContact_PrimaryContactID
  ON
    "d"."PrimaryContactID" = mjbizappssalesSalesContact_PrimaryContactID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."vwSalesContacts" AS mjbizappssalesSalesContact_BillingContactID
  ON
    "d"."BillingContactID" = mjbizappssalesSalesContact_BillingContactID."ID"
INNER JOIN
    ${mjSchema}."Company" AS MJCompany_CompanyID
  ON
    "d"."CompanyID" = MJCompany_CompanyID."ID"
LEFT OUTER JOIN
    ${mjSchema}."vwEmployees" AS MJEmployee_OwnerEmployeeID
  ON
    "d"."OwnerEmployeeID" = MJEmployee_OwnerEmployeeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."ForecastCategoryType" AS mjbizappssalesForecastCategoryType_ForecastCategoryTypeID
  ON
    "d"."ForecastCategoryTypeID" = mjbizappssalesForecastCategoryType_ForecastCategoryTypeID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."LossReason" AS mjbizappssalesLossReason_LossReasonID
  ON
    "d"."LossReasonID" = mjbizappssalesLossReason_LossReasonID."ID"
LEFT OUTER JOIN
    "__mj_bizappssales"."LeadSourceType" AS mjbizappssalesLeadSourceType_LeadSourceTypeID
  ON
    "d"."LeadSourceTypeID" = mjbizappssalesLeadSourceType_LeadSourceTypeID."ID"
LEFT OUTER JOIN
    ${mjSchema}."User" AS MJUser_ClosedByUserID
  ON
    "d"."ClosedByUserID" = MJUser_ClosedByUserID."ID"
LEFT OUTER JOIN
    "__mj_bizappsorders"."OrderHeader" AS mjbizappsordersOrderHeader_OrderID
  ON
    "d"."OrderID" = mjbizappsordersOrderHeader_OrderID."ID"
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
    AND tc.relname = 'vwDealsGenerated'
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
    AND tc.relname = 'vwDealsGenerated'
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
        AND tc.relname = 'vwDealsGenerated'
        AND tc.relkind IN ('v', 'm')
  );

  DROP VIEW IF EXISTS "__mj_bizappssales"."vwDealsGenerated" CASCADE;
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

DO $if_view_exists$
BEGIN
  IF to_regclass('"__mj_bizappssales"."vwDeals"') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON "__mj_bizappssales"."vwDeals" TO "cdp_UI";
GRANT SELECT ON "__mj_bizappssales"."vwDeals" TO "cdp_Developer";
GRANT SELECT ON "__mj_bizappssales"."vwDeals" TO "cdp_Integration";';
  END IF;
END
$if_view_exists$;


DO $if_view_exists$
BEGIN
  IF to_regclass('"__mj_bizappssales"."vwDeals"') IS NOT NULL THEN
    EXECUTE 'SELECT ${mjSchema}."spRebindLayeredOuterView"(''__mj_bizappssales'', ''vwDeals'', ''vwDealsGenerated'');';
  END IF;
END
$if_view_exists$;


-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deals
-- Item: spCreateDeal
-- ============================================================

------------------------------------------------------------
----- CREATE FUNCTION FOR Deal
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spCreateDeal'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spCreateDeal"(
    p_id UUID DEFAULT NULL,
    p_dealnumber_clear boolean DEFAULT false,
    p_dealnumber varchar(50) DEFAULT NULL,
    p_name varchar(500) DEFAULT NULL,
    p_pipelineid UUID DEFAULT NULL,
    p_pipelinestageid_clear boolean DEFAULT false,
    p_pipelinestageid UUID DEFAULT NULL,
    p_dealtypeid_clear boolean DEFAULT false,
    p_dealtypeid UUID DEFAULT NULL,
    p_dealstatustypeid_clear boolean DEFAULT false,
    p_dealstatustypeid UUID DEFAULT NULL,
    p_accountid_clear boolean DEFAULT false,
    p_accountid UUID DEFAULT NULL,
    p_primarycontactid_clear boolean DEFAULT false,
    p_primarycontactid UUID DEFAULT NULL,
    p_billingcontactid_clear boolean DEFAULT false,
    p_billingcontactid UUID DEFAULT NULL,
    p_companyid UUID DEFAULT NULL,
    p_owneremployeeid_clear boolean DEFAULT false,
    p_owneremployeeid UUID DEFAULT NULL,
    p_amount_clear boolean DEFAULT false,
    p_amount decimal(19, 4) DEFAULT NULL,
    p_amountiscomputed BOOLEAN DEFAULT NULL,
    p_amountcomputedat_clear boolean DEFAULT false,
    p_amountcomputedat TIMESTAMPTZ DEFAULT NULL,
    p_amountsourcehash_clear boolean DEFAULT false,
    p_amountsourcehash varchar(128) DEFAULT NULL,
    p_currencyid_clear boolean DEFAULT false,
    p_currencyid UUID DEFAULT NULL,
    p_mrr_clear boolean DEFAULT false,
    p_mrr decimal(19, 4) DEFAULT NULL,
    p_arr_clear boolean DEFAULT false,
    p_arr decimal(19, 4) DEFAULT NULL,
    p_termmonths_clear boolean DEFAULT false,
    p_termmonths int DEFAULT NULL,
    p_estimatedprojectweeks_clear boolean DEFAULT false,
    p_estimatedprojectweeks int DEFAULT NULL,
    p_executiondate_clear boolean DEFAULT false,
    p_executiondate date DEFAULT NULL,
    p_startdate_clear boolean DEFAULT false,
    p_startdate date DEFAULT NULL,
    p_expectedclosedate_clear boolean DEFAULT false,
    p_expectedclosedate date DEFAULT NULL,
    p_actualclosedate_clear boolean DEFAULT false,
    p_actualclosedate date DEFAULT NULL,
    p_probability_clear boolean DEFAULT false,
    p_probability decimal(5, 2) DEFAULT NULL,
    p_forecastcategorytypeid_clear boolean DEFAULT false,
    p_forecastcategorytypeid UUID DEFAULT NULL,
    p_lossreasonid_clear boolean DEFAULT false,
    p_lossreasonid UUID DEFAULT NULL,
    p_lossnotes_clear boolean DEFAULT false,
    p_lossnotes TEXT DEFAULT NULL,
    p_leadsourcetypeid_clear boolean DEFAULT false,
    p_leadsourcetypeid UUID DEFAULT NULL,
    p_campaignid_clear boolean DEFAULT false,
    p_campaignid UUID DEFAULT NULL,
    p_contractid_clear boolean DEFAULT false,
    p_contractid UUID DEFAULT NULL,
    p_renewscontractid_clear boolean DEFAULT false,
    p_renewscontractid UUID DEFAULT NULL,
    p_autorenew BOOLEAN DEFAULT NULL,
    p_annualincreasepctoverride_clear boolean DEFAULT false,
    p_annualincreasepctoverride decimal(5, 2) DEFAULT NULL,
    p_cancellationnoticedaysoverride_clear boolean DEFAULT false,
    p_cancellationnoticedaysoverride int DEFAULT NULL,
    p_paymentmethod_clear boolean DEFAULT false,
    p_paymentmethod varchar(50) DEFAULT NULL,
    p_standardagreementmodified BOOLEAN DEFAULT NULL,
    p_contractvariances_clear boolean DEFAULT false,
    p_contractvariances TEXT DEFAULT NULL,
    p_description_clear boolean DEFAULT false,
    p_description TEXT DEFAULT NULL,
    p_nextstep_clear boolean DEFAULT false,
    p_nextstep varchar(1000) DEFAULT NULL,
    p_nextstepdate_clear boolean DEFAULT false,
    p_nextstepdate date DEFAULT NULL,
    p_closedat_clear boolean DEFAULT false,
    p_closedat TIMESTAMPTZ DEFAULT NULL,
    p_closedbyuserid_clear boolean DEFAULT false,
    p_closedbyuserid UUID DEFAULT NULL,
    p_orderid_clear boolean DEFAULT false,
    p_orderid UUID DEFAULT NULL,
    p_predictedwinprobability_clear boolean DEFAULT false,
    p_predictedwinprobability decimal(5, 4) DEFAULT NULL,
    p_predictedwinriskband_clear boolean DEFAULT false,
    p_predictedwinriskband varchar(20) DEFAULT NULL,
    p_predictedwinscoredat_clear boolean DEFAULT false,
    p_predictedwinscoredat TIMESTAMPTZ DEFAULT NULL
) RETURNS SETOF "__mj_bizappssales"."vwDeals" AS $$
DECLARE
    v_new_id UUID;
BEGIN
    v_new_id := COALESCE(p_id, gen_random_uuid());
    INSERT INTO "__mj_bizappssales"."Deal"
        (
            "ID",
            "DealNumber",
                "Name",
                "PipelineID",
                "PipelineStageID",
                "DealTypeID",
                "DealStatusTypeID",
                "AccountID",
                "PrimaryContactID",
                "BillingContactID",
                "CompanyID",
                "OwnerEmployeeID",
                "Amount",
                "AmountIsComputed",
                "AmountComputedAt",
                "AmountSourceHash",
                "CurrencyID",
                "MRR",
                "ARR",
                "TermMonths",
                "EstimatedProjectWeeks",
                "ExecutionDate",
                "StartDate",
                "ExpectedCloseDate",
                "ActualCloseDate",
                "Probability",
                "ForecastCategoryTypeID",
                "LossReasonID",
                "LossNotes",
                "LeadSourceTypeID",
                "CampaignID",
                "ContractID",
                "RenewsContractID",
                "AutoRenew",
                "AnnualIncreasePctOverride",
                "CancellationNoticeDaysOverride",
                "PaymentMethod",
                "StandardAgreementModified",
                "ContractVariances",
                "Description",
                "NextStep",
                "NextStepDate",
                "ClosedAt",
                "ClosedByUserID",
                "OrderID",
                "PredictedWinProbability",
                "PredictedWinRiskBand",
                "PredictedWinScoredAt"
        )
    VALUES
        (
            v_new_id,
            CASE WHEN p_dealnumber_clear = true THEN NULL ELSE COALESCE(p_dealnumber, NULL) END,
                p_name,
                p_pipelineid,
                CASE WHEN p_pipelinestageid_clear = true THEN NULL ELSE COALESCE(p_pipelinestageid, NULL) END,
                CASE WHEN p_dealtypeid_clear = true THEN NULL ELSE COALESCE(p_dealtypeid, NULL) END,
                CASE WHEN p_dealstatustypeid_clear = true THEN NULL ELSE COALESCE(p_dealstatustypeid, NULL) END,
                CASE WHEN p_accountid_clear = true THEN NULL ELSE COALESCE(p_accountid, NULL) END,
                CASE WHEN p_primarycontactid_clear = true THEN NULL ELSE COALESCE(p_primarycontactid, NULL) END,
                CASE WHEN p_billingcontactid_clear = true THEN NULL ELSE COALESCE(p_billingcontactid, NULL) END,
                p_companyid,
                CASE WHEN p_owneremployeeid_clear = true THEN NULL ELSE COALESCE(p_owneremployeeid, NULL) END,
                CASE WHEN p_amount_clear = true THEN NULL ELSE COALESCE(p_amount, NULL) END,
                COALESCE(p_amountiscomputed, FALSE),
                CASE WHEN p_amountcomputedat_clear = true THEN NULL ELSE COALESCE(p_amountcomputedat, NULL) END,
                CASE WHEN p_amountsourcehash_clear = true THEN NULL ELSE COALESCE(p_amountsourcehash, NULL) END,
                CASE WHEN p_currencyid_clear = true THEN NULL ELSE COALESCE(p_currencyid, NULL) END,
                CASE WHEN p_mrr_clear = true THEN NULL ELSE COALESCE(p_mrr, NULL) END,
                CASE WHEN p_arr_clear = true THEN NULL ELSE COALESCE(p_arr, NULL) END,
                CASE WHEN p_termmonths_clear = true THEN NULL ELSE COALESCE(p_termmonths, NULL) END,
                CASE WHEN p_estimatedprojectweeks_clear = true THEN NULL ELSE COALESCE(p_estimatedprojectweeks, NULL) END,
                CASE WHEN p_executiondate_clear = true THEN NULL ELSE COALESCE(p_executiondate, NULL) END,
                CASE WHEN p_startdate_clear = true THEN NULL ELSE COALESCE(p_startdate, NULL) END,
                CASE WHEN p_expectedclosedate_clear = true THEN NULL ELSE COALESCE(p_expectedclosedate, NULL) END,
                CASE WHEN p_actualclosedate_clear = true THEN NULL ELSE COALESCE(p_actualclosedate, NULL) END,
                CASE WHEN p_probability_clear = true THEN NULL ELSE COALESCE(p_probability, NULL) END,
                CASE WHEN p_forecastcategorytypeid_clear = true THEN NULL ELSE COALESCE(p_forecastcategorytypeid, NULL) END,
                CASE WHEN p_lossreasonid_clear = true THEN NULL ELSE COALESCE(p_lossreasonid, NULL) END,
                CASE WHEN p_lossnotes_clear = true THEN NULL ELSE COALESCE(p_lossnotes, NULL) END,
                CASE WHEN p_leadsourcetypeid_clear = true THEN NULL ELSE COALESCE(p_leadsourcetypeid, NULL) END,
                CASE WHEN p_campaignid_clear = true THEN NULL ELSE COALESCE(p_campaignid, NULL) END,
                CASE WHEN p_contractid_clear = true THEN NULL ELSE COALESCE(p_contractid, NULL) END,
                CASE WHEN p_renewscontractid_clear = true THEN NULL ELSE COALESCE(p_renewscontractid, NULL) END,
                COALESCE(p_autorenew, FALSE),
                CASE WHEN p_annualincreasepctoverride_clear = true THEN NULL ELSE COALESCE(p_annualincreasepctoverride, NULL) END,
                CASE WHEN p_cancellationnoticedaysoverride_clear = true THEN NULL ELSE COALESCE(p_cancellationnoticedaysoverride, NULL) END,
                CASE WHEN p_paymentmethod_clear = true THEN NULL ELSE COALESCE(p_paymentmethod, 'ACH') END,
                COALESCE(p_standardagreementmodified, FALSE),
                CASE WHEN p_contractvariances_clear = true THEN NULL ELSE COALESCE(p_contractvariances, NULL) END,
                CASE WHEN p_description_clear = true THEN NULL ELSE COALESCE(p_description, NULL) END,
                CASE WHEN p_nextstep_clear = true THEN NULL ELSE COALESCE(p_nextstep, NULL) END,
                CASE WHEN p_nextstepdate_clear = true THEN NULL ELSE COALESCE(p_nextstepdate, NULL) END,
                CASE WHEN p_closedat_clear = true THEN NULL ELSE COALESCE(p_closedat, NULL) END,
                CASE WHEN p_closedbyuserid_clear = true THEN NULL ELSE COALESCE(p_closedbyuserid, NULL) END,
                CASE WHEN p_orderid_clear = true THEN NULL ELSE COALESCE(p_orderid, NULL) END,
                CASE WHEN p_predictedwinprobability_clear = true THEN NULL ELSE COALESCE(p_predictedwinprobability, NULL) END,
                CASE WHEN p_predictedwinriskband_clear = true THEN NULL ELSE COALESCE(p_predictedwinriskband, NULL) END,
                CASE WHEN p_predictedwinscoredat_clear = true THEN NULL ELSE COALESCE(p_predictedwinscoredat, NULL) END
        )
    ;

    RETURN QUERY
    SELECT * FROM "__mj_bizappssales"."vwDeals"
    WHERE "ID" = v_new_id;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spCreateDeal" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spCreateDeal" TO "cdp_Integration";


-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deals
-- Item: spUpdateDeal
-- ============================================================

------------------------------------------------------------
----- UPDATE FUNCTION FOR Deal
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spUpdateDeal'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spUpdateDeal"(
    p_id UUID,
    p_dealnumber_clear boolean DEFAULT false,
    p_dealnumber varchar(50) DEFAULT NULL,
    p_name varchar(500) DEFAULT NULL,
    p_pipelineid UUID DEFAULT NULL,
    p_pipelinestageid_clear boolean DEFAULT false,
    p_pipelinestageid UUID DEFAULT NULL,
    p_dealtypeid_clear boolean DEFAULT false,
    p_dealtypeid UUID DEFAULT NULL,
    p_dealstatustypeid_clear boolean DEFAULT false,
    p_dealstatustypeid UUID DEFAULT NULL,
    p_accountid_clear boolean DEFAULT false,
    p_accountid UUID DEFAULT NULL,
    p_primarycontactid_clear boolean DEFAULT false,
    p_primarycontactid UUID DEFAULT NULL,
    p_billingcontactid_clear boolean DEFAULT false,
    p_billingcontactid UUID DEFAULT NULL,
    p_companyid UUID DEFAULT NULL,
    p_owneremployeeid_clear boolean DEFAULT false,
    p_owneremployeeid UUID DEFAULT NULL,
    p_amount_clear boolean DEFAULT false,
    p_amount decimal(19, 4) DEFAULT NULL,
    p_amountiscomputed BOOLEAN DEFAULT NULL,
    p_amountcomputedat_clear boolean DEFAULT false,
    p_amountcomputedat TIMESTAMPTZ DEFAULT NULL,
    p_amountsourcehash_clear boolean DEFAULT false,
    p_amountsourcehash varchar(128) DEFAULT NULL,
    p_currencyid_clear boolean DEFAULT false,
    p_currencyid UUID DEFAULT NULL,
    p_mrr_clear boolean DEFAULT false,
    p_mrr decimal(19, 4) DEFAULT NULL,
    p_arr_clear boolean DEFAULT false,
    p_arr decimal(19, 4) DEFAULT NULL,
    p_termmonths_clear boolean DEFAULT false,
    p_termmonths int DEFAULT NULL,
    p_estimatedprojectweeks_clear boolean DEFAULT false,
    p_estimatedprojectweeks int DEFAULT NULL,
    p_executiondate_clear boolean DEFAULT false,
    p_executiondate date DEFAULT NULL,
    p_startdate_clear boolean DEFAULT false,
    p_startdate date DEFAULT NULL,
    p_expectedclosedate_clear boolean DEFAULT false,
    p_expectedclosedate date DEFAULT NULL,
    p_actualclosedate_clear boolean DEFAULT false,
    p_actualclosedate date DEFAULT NULL,
    p_probability_clear boolean DEFAULT false,
    p_probability decimal(5, 2) DEFAULT NULL,
    p_forecastcategorytypeid_clear boolean DEFAULT false,
    p_forecastcategorytypeid UUID DEFAULT NULL,
    p_lossreasonid_clear boolean DEFAULT false,
    p_lossreasonid UUID DEFAULT NULL,
    p_lossnotes_clear boolean DEFAULT false,
    p_lossnotes TEXT DEFAULT NULL,
    p_leadsourcetypeid_clear boolean DEFAULT false,
    p_leadsourcetypeid UUID DEFAULT NULL,
    p_campaignid_clear boolean DEFAULT false,
    p_campaignid UUID DEFAULT NULL,
    p_contractid_clear boolean DEFAULT false,
    p_contractid UUID DEFAULT NULL,
    p_renewscontractid_clear boolean DEFAULT false,
    p_renewscontractid UUID DEFAULT NULL,
    p_autorenew BOOLEAN DEFAULT NULL,
    p_annualincreasepctoverride_clear boolean DEFAULT false,
    p_annualincreasepctoverride decimal(5, 2) DEFAULT NULL,
    p_cancellationnoticedaysoverride_clear boolean DEFAULT false,
    p_cancellationnoticedaysoverride int DEFAULT NULL,
    p_paymentmethod_clear boolean DEFAULT false,
    p_paymentmethod varchar(50) DEFAULT NULL,
    p_standardagreementmodified BOOLEAN DEFAULT NULL,
    p_contractvariances_clear boolean DEFAULT false,
    p_contractvariances TEXT DEFAULT NULL,
    p_description_clear boolean DEFAULT false,
    p_description TEXT DEFAULT NULL,
    p_nextstep_clear boolean DEFAULT false,
    p_nextstep varchar(1000) DEFAULT NULL,
    p_nextstepdate_clear boolean DEFAULT false,
    p_nextstepdate date DEFAULT NULL,
    p_closedat_clear boolean DEFAULT false,
    p_closedat TIMESTAMPTZ DEFAULT NULL,
    p_closedbyuserid_clear boolean DEFAULT false,
    p_closedbyuserid UUID DEFAULT NULL,
    p_orderid_clear boolean DEFAULT false,
    p_orderid UUID DEFAULT NULL,
    p_predictedwinprobability_clear boolean DEFAULT false,
    p_predictedwinprobability decimal(5, 4) DEFAULT NULL,
    p_predictedwinriskband_clear boolean DEFAULT false,
    p_predictedwinriskband varchar(20) DEFAULT NULL,
    p_predictedwinscoredat_clear boolean DEFAULT false,
    p_predictedwinscoredat TIMESTAMPTZ DEFAULT NULL
) RETURNS SETOF "__mj_bizappssales"."vwDeals" AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE "__mj_bizappssales"."Deal"
    SET
        "DealNumber" = CASE WHEN p_dealnumber_clear = true THEN NULL ELSE COALESCE(p_dealnumber, "DealNumber") END,
        "Name" = COALESCE(p_name, "Name"),
        "PipelineID" = COALESCE(p_pipelineid, "PipelineID"),
        "PipelineStageID" = CASE WHEN p_pipelinestageid_clear = true THEN NULL ELSE COALESCE(p_pipelinestageid, "PipelineStageID") END,
        "DealTypeID" = CASE WHEN p_dealtypeid_clear = true THEN NULL ELSE COALESCE(p_dealtypeid, "DealTypeID") END,
        "DealStatusTypeID" = CASE WHEN p_dealstatustypeid_clear = true THEN NULL ELSE COALESCE(p_dealstatustypeid, "DealStatusTypeID") END,
        "AccountID" = CASE WHEN p_accountid_clear = true THEN NULL ELSE COALESCE(p_accountid, "AccountID") END,
        "PrimaryContactID" = CASE WHEN p_primarycontactid_clear = true THEN NULL ELSE COALESCE(p_primarycontactid, "PrimaryContactID") END,
        "BillingContactID" = CASE WHEN p_billingcontactid_clear = true THEN NULL ELSE COALESCE(p_billingcontactid, "BillingContactID") END,
        "CompanyID" = COALESCE(p_companyid, "CompanyID"),
        "OwnerEmployeeID" = CASE WHEN p_owneremployeeid_clear = true THEN NULL ELSE COALESCE(p_owneremployeeid, "OwnerEmployeeID") END,
        "Amount" = CASE WHEN p_amount_clear = true THEN NULL ELSE COALESCE(p_amount, "Amount") END,
        "AmountIsComputed" = COALESCE(p_amountiscomputed, "AmountIsComputed"),
        "AmountComputedAt" = CASE WHEN p_amountcomputedat_clear = true THEN NULL ELSE COALESCE(p_amountcomputedat, "AmountComputedAt") END,
        "AmountSourceHash" = CASE WHEN p_amountsourcehash_clear = true THEN NULL ELSE COALESCE(p_amountsourcehash, "AmountSourceHash") END,
        "CurrencyID" = CASE WHEN p_currencyid_clear = true THEN NULL ELSE COALESCE(p_currencyid, "CurrencyID") END,
        "MRR" = CASE WHEN p_mrr_clear = true THEN NULL ELSE COALESCE(p_mrr, "MRR") END,
        "ARR" = CASE WHEN p_arr_clear = true THEN NULL ELSE COALESCE(p_arr, "ARR") END,
        "TermMonths" = CASE WHEN p_termmonths_clear = true THEN NULL ELSE COALESCE(p_termmonths, "TermMonths") END,
        "EstimatedProjectWeeks" = CASE WHEN p_estimatedprojectweeks_clear = true THEN NULL ELSE COALESCE(p_estimatedprojectweeks, "EstimatedProjectWeeks") END,
        "ExecutionDate" = CASE WHEN p_executiondate_clear = true THEN NULL ELSE COALESCE(p_executiondate, "ExecutionDate") END,
        "StartDate" = CASE WHEN p_startdate_clear = true THEN NULL ELSE COALESCE(p_startdate, "StartDate") END,
        "ExpectedCloseDate" = CASE WHEN p_expectedclosedate_clear = true THEN NULL ELSE COALESCE(p_expectedclosedate, "ExpectedCloseDate") END,
        "ActualCloseDate" = CASE WHEN p_actualclosedate_clear = true THEN NULL ELSE COALESCE(p_actualclosedate, "ActualCloseDate") END,
        "Probability" = CASE WHEN p_probability_clear = true THEN NULL ELSE COALESCE(p_probability, "Probability") END,
        "ForecastCategoryTypeID" = CASE WHEN p_forecastcategorytypeid_clear = true THEN NULL ELSE COALESCE(p_forecastcategorytypeid, "ForecastCategoryTypeID") END,
        "LossReasonID" = CASE WHEN p_lossreasonid_clear = true THEN NULL ELSE COALESCE(p_lossreasonid, "LossReasonID") END,
        "LossNotes" = CASE WHEN p_lossnotes_clear = true THEN NULL ELSE COALESCE(p_lossnotes, "LossNotes") END,
        "LeadSourceTypeID" = CASE WHEN p_leadsourcetypeid_clear = true THEN NULL ELSE COALESCE(p_leadsourcetypeid, "LeadSourceTypeID") END,
        "CampaignID" = CASE WHEN p_campaignid_clear = true THEN NULL ELSE COALESCE(p_campaignid, "CampaignID") END,
        "ContractID" = CASE WHEN p_contractid_clear = true THEN NULL ELSE COALESCE(p_contractid, "ContractID") END,
        "RenewsContractID" = CASE WHEN p_renewscontractid_clear = true THEN NULL ELSE COALESCE(p_renewscontractid, "RenewsContractID") END,
        "AutoRenew" = COALESCE(p_autorenew, "AutoRenew"),
        "AnnualIncreasePctOverride" = CASE WHEN p_annualincreasepctoverride_clear = true THEN NULL ELSE COALESCE(p_annualincreasepctoverride, "AnnualIncreasePctOverride") END,
        "CancellationNoticeDaysOverride" = CASE WHEN p_cancellationnoticedaysoverride_clear = true THEN NULL ELSE COALESCE(p_cancellationnoticedaysoverride, "CancellationNoticeDaysOverride") END,
        "PaymentMethod" = CASE WHEN p_paymentmethod_clear = true THEN NULL ELSE COALESCE(p_paymentmethod, "PaymentMethod") END,
        "StandardAgreementModified" = COALESCE(p_standardagreementmodified, "StandardAgreementModified"),
        "ContractVariances" = CASE WHEN p_contractvariances_clear = true THEN NULL ELSE COALESCE(p_contractvariances, "ContractVariances") END,
        "Description" = CASE WHEN p_description_clear = true THEN NULL ELSE COALESCE(p_description, "Description") END,
        "NextStep" = CASE WHEN p_nextstep_clear = true THEN NULL ELSE COALESCE(p_nextstep, "NextStep") END,
        "NextStepDate" = CASE WHEN p_nextstepdate_clear = true THEN NULL ELSE COALESCE(p_nextstepdate, "NextStepDate") END,
        "ClosedAt" = CASE WHEN p_closedat_clear = true THEN NULL ELSE COALESCE(p_closedat, "ClosedAt") END,
        "ClosedByUserID" = CASE WHEN p_closedbyuserid_clear = true THEN NULL ELSE COALESCE(p_closedbyuserid, "ClosedByUserID") END,
        "OrderID" = CASE WHEN p_orderid_clear = true THEN NULL ELSE COALESCE(p_orderid, "OrderID") END,
        "PredictedWinProbability" = CASE WHEN p_predictedwinprobability_clear = true THEN NULL ELSE COALESCE(p_predictedwinprobability, "PredictedWinProbability") END,
        "PredictedWinRiskBand" = CASE WHEN p_predictedwinriskband_clear = true THEN NULL ELSE COALESCE(p_predictedwinriskband, "PredictedWinRiskBand") END,
        "PredictedWinScoredAt" = CASE WHEN p_predictedwinscoredat_clear = true THEN NULL ELSE COALESCE(p_predictedwinscoredat, "PredictedWinScoredAt") END
    WHERE
        "ID" = p_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        -- Nothing was updated, return empty result set
        RETURN;
    END IF;

    -- Return the updated record from the base view
    RETURN QUERY
    SELECT * FROM "__mj_bizappssales"."vwDeals"
    WHERE "ID" = p_id;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spUpdateDeal" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spUpdateDeal" TO "cdp_Integration";


------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the Deal table
------------------------------------------------------------
CREATE OR REPLACE FUNCTION "__mj_bizappssales"."fn_trg_update_deal"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."__mj_UpdatedAt" := NOW() AT TIME ZONE 'UTC';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_update_deal" ON "__mj_bizappssales"."Deal";

CREATE TRIGGER "trg_update_deal"
BEFORE UPDATE ON "__mj_bizappssales"."Deal"
FOR EACH ROW
EXECUTE FUNCTION "__mj_bizappssales"."fn_trg_update_deal"();



-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deals
-- Item: spDeleteDeal
-- ============================================================

------------------------------------------------------------
----- DELETE FUNCTION FOR Deal
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spDeleteDeal'
               AND pronamespace = '__mj_bizappssales'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_bizappssales"."spDeleteDeal"(
    p_id UUID
) RETURNS TABLE("ID" UUID) AS $$
#variable_conflict use_column
DECLARE
    v_affected_count INTEGER;
BEGIN

    DELETE FROM "__mj_bizappssales"."Deal"
    WHERE "ID" = p_id;

    GET DIAGNOSTICS v_affected_count = ROW_COUNT;

    IF v_affected_count = 0 THEN
        RETURN QUERY SELECT NULL::UUID AS "ID";
    ELSE
        RETURN QUERY SELECT p_id AS "ID";
    END IF;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spDeleteDeal" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_bizappssales"."spDeleteDeal" TO "cdp_Integration";
