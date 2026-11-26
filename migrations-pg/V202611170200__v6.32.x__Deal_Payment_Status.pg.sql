-- =============================================================================================
-- PostgreSQL counterpart of V202611170200__v6.32.x__Deal_Payment_Status.sql
-- =============================================================================================
-- `mj sql-convert --from tsql --to postgres --schema __mj_BizAppsSales` (MJ CLI 6.2.1) output,
-- finished by hand. The converter reported 0 errors and 4 skipped batches: the CODEGEN banner
-- comment, the T-SQL `DROP VIEW vwDeals` (the converted view is created with CREATE OR REPLACE,
-- which drops and restores dependants itself when the column list changes) and the two T-SQL
-- grant blocks, which are written by hand at the end of this file.
--   * fnDealPaymentStatus WAS REWRITTEN BY HAND: the converter kept T-SQL's inline table-valued
--     function form (RETURNS TABLE AS RETURN SELECT ...), which PostgreSQL rejects. It is now a
--     LANGUAGE sql function returning one "PaymentStatus" column. The rule is unchanged.
--   * `CROSS JOIN LATERAL (...) ON TRUE` became `INNER JOIN LATERAL (...) ON TRUE`: the converter
--     added ON TRUE to a CROSS JOIN, which takes no ON clause. Same rows.
--   * DealStatusType.IsWon is compared with TRUE, not 1: the column is a boolean in PostgreSQL.
--   * Everything else, the vwDeals restatement included, is the converter's.
-- ${mjSchema} is left as the placeholder the converter emits, as in the sibling files.
-- UNVALIDATED AGAINST A LIVE PostgreSQL SERVER: this repo has no PostgreSQL host, as with every
-- file in this directory.
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


-- ===================== Helper Functions (fn*) =====================

-- =============================================================================
-- Deals: what has been invoiced and paid on a won deal (bc-aidp-next-golive#487).
-- =============================================================================
-- Once a deal is won and invoiced, the only way to tell whether the customer paid
-- was to open the deal, then its order, then the order's payments. Orders already
-- keeps the answer: AmountPaid and Balance on every instalment of a payment
-- schedule, and on the order header for an order billed as one invoice. Nothing in
-- Sales read it. This file reads it, in three objects:
--
--   1. fnDealPaymentStatus -- THE STATUS RULE, the only place it is written. Both
--      the per-invoice rows and the per-deal roll-up call it, so the two cannot
--      disagree:
--        Not invoiced  nothing invoiced yet
--        Partly paid   AmountPaid > 0 and Balance > 0
--        Outstanding   Balance > 0 and nothing paid
--        Paid          Balance <= 0 (negative means a credit owed to the customer)
--      There is no overdue status: due dates on deals brought over from the old
--      system are not reliable yet (bc-aidp-next-golive#481).
--
--   2. vwWonDealInvoices -- one row per invoice of a won deal's order. An order
--      with a payment schedule gives one row per instalment; an order without one
--      is billed as a single invoice, so the header gives one row. An instalment
--      counts as invoiced when its Status is Invoiced or Paid; a header when the
--      order is Confirmed. Canceled and WrittenOff instalments, and a Voided order,
--      are left out: nothing is owed on them. Won is DealStatusType.IsWon, never a
--      status name.
--
--   3. vwDeals gains six columns, summed from (2) over the invoiced rows:
--      InvoiceCount, InvoicedAmount, PaidAmount, OutstandingBalance, PaymentStatus
--      and NextPaymentDueDate. They are NULL on a deal that is not won or has no
--      order. "Paid" means every invoice issued so far is paid; instalments not yet
--      invoiced do not count against it, and NextPaymentDueDate still shows when
--      the next one falls due.
--
-- SALES STILL COMPUTES NO MONEY. Every amount here is a figure orders stored; the
-- roll-up only adds up a deal's own invoices, as the read models in
-- metadata/queries do. Nothing prices, discounts, prorates or rounds.
--
-- NextPaymentDueDate follows orders' NextDueDate on vwOrderHeaders: the earliest due
-- date among the live rows with a balance, invoiced or not.
--
-- vwDeals is restated whole: the columns before the new ones are unchanged.
-- =============================================================================

CREATE FUNCTION __mj_BizAppsSales."fnDealPaymentStatus"
(
    p_InvoiceCount INTEGER,
    p_AmountPaid   NUMERIC(38, 2),
    p_Balance      NUMERIC(38, 2)
)
RETURNS TABLE ("PaymentStatus" VARCHAR(20))
LANGUAGE sql
IMMUTABLE
AS $fn$
    SELECT CAST(
        CASE
            WHEN p_InvoiceCount = 0                 THEN 'Not invoiced'
            WHEN p_Balance > 0 AND p_AmountPaid > 0 THEN 'Partly paid'
            WHEN p_Balance > 0                      THEN 'Outstanding'
            WHEN p_Balance <= 0                     THEN 'Paid'
        END AS VARCHAR(20))
$fn$;


-- ===================== Views =====================

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsSales';
  v_target_name CONSTANT TEXT := 'vwWonDealInvoices';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW __mj_BizAppsSales."vwWonDealInvoices"
AS SELECT
    d."ID"                    AS "DealID",
    o."ID"                    AS "OrderID",
    o."OrderNumber",
    s."ID"                    AS "PaymentScheduleID",
    COALESCE(s."InstallmentNumber", 1) AS "InstallmentNumber",
    -- The number the customer holds: the instalment's frozen document number, or the
    -- order number for an order billed as one invoice. NULL until invoiced.
    CASE WHEN s."ID" IS NULL
         THEN CASE WHEN r."IsInvoiced" = 1 THEN o."OrderNumber" END
         ELSE s."DocumentNumber"
    END                     AS "DocumentNumber",
    CASE WHEN s."ID" IS NULL THEN o."Status" ELSE s."Status" END AS "SourceStatus",
    r."IsInvoiced",
    r."DueDate",
    r."Amount",
    r."AmountPaid",
    r."Balance",
    ps."PaymentStatus"
FROM __mj_BizAppsSales."Deal" AS d
INNER JOIN __mj_BizAppsSales."DealStatusType" AS "st"
        ON st."ID" = d."DealStatusTypeID"
       AND st."IsWon" = TRUE
INNER JOIN ${mjSchema}_BizAppsOrders."OrderHeader" AS o
        ON o."ID" = d."OrderID"
LEFT OUTER JOIN ${mjSchema}_BizAppsOrders."OrderHeaderPaymentSchedule" AS s
        ON s."OrderHeaderID" = o."ID"
INNER JOIN LATERAL (
    SELECT
        CASE WHEN s."ID" IS NULL THEN o."DueDate"    ELSE s."DueDate"    END AS "DueDate",
        CASE WHEN s."ID" IS NULL THEN o."TotalGross" ELSE s."Amount"     END AS "Amount",
        CASE WHEN s."ID" IS NULL THEN o."AmountPaid" ELSE s."AmountPaid" END AS "AmountPaid",
        CASE WHEN s."ID" IS NULL THEN o."Balance"    ELSE s."Balance"    END AS "Balance",
        CASE WHEN s."ID" IS NULL
             THEN CASE WHEN o."Status" = 'Confirmed' THEN 1 ELSE 0 END
             WHEN s."Status" IN ('Invoiced', 'Paid') THEN 1
             ELSE 0
        END AS "IsInvoiced"
) AS r
    ON TRUE
INNER JOIN LATERAL (SELECT * FROM __mj_BizAppsSales."fnDealPaymentStatus"(r."IsInvoiced", r."AmountPaid", r."Balance")) AS "ps"
    ON TRUE
WHERE (s."ID" IS NULL AND o."Status" <> 'Voided')
   OR s."Status" NOT IN ('Canceled', 'WrittenOff')$vsql$;
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
  v_target_name CONSTANT TEXT := 'vwDeals';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW __mj_BizAppsSales."vwDeals"
AS SELECT
    g.*,
    CASE
        WHEN "mjBizAppsSalesDealStatusType_DealStatusTypeID"."Code" = 'WON' THEN 1
        WHEN "mjBizAppsSalesDealStatusType_DealStatusTypeID"."Code" IN ('LOST', 'ABANDONED') THEN 0
        ELSE NULL
    END AS "WinOutcome",
    CASE
        WHEN g."ExpectedCloseDate" IS NOT NULL AND g."StartDate" IS NOT NULL THEN EXTRACT(DAY FROM (g."ExpectedCloseDate"::TIMESTAMPTZ - g."StartDate"::TIMESTAMPTZ))
        WHEN g."ExpectedCloseDate" IS NOT NULL THEN EXTRACT(DAY FROM (g."ExpectedCloseDate"::TIMESTAMPTZ - CAST(g.__mj_CreatedAt AS date)::TIMESTAMPTZ))
        ELSE NULL
    END AS "DaysToExpectedClose",
    COALESCE(ps."HasPaymentSchedule", 0) AS "HasPaymentSchedule",
    COALESCE(team."TeamMemberCount", 0) AS "TeamMemberCount",
    COALESCE(team."HasPartnerInvolved", 0) AS "HasPartnerInvolved",
    CASE WHEN g."Amount" >= 100000 THEN 1 ELSE 0 END AS "IsEnterpriseTier",
    CASE WHEN g."AutoRenew" = 1 THEN 1 ELSE 0 END AS "AutoRenewFlag",
    CASE WHEN g."StandardAgreementModified" = 1 THEN 1 ELSE 0 END AS "StandardAgreementModifiedFlag",
    pay."InvoiceCount" AS "InvoiceCount",
    pay."InvoicedAmount" AS "InvoicedAmount",
    pay."PaidAmount" AS "PaidAmount",
    pay."OutstandingBalance" AS "OutstandingBalance",
    pst."PaymentStatus" AS "PaymentStatus",
    pay."NextPaymentDueDate" AS "NextPaymentDueDate"
FROM
    __mj_BizAppsSales."vwDealsGenerated" AS g
LEFT OUTER JOIN
    __mj_BizAppsSales."DealStatusType" AS "mjBizAppsSalesDealStatusType_DealStatusTypeID"
  ON
    g."DealStatusTypeID" = "mjBizAppsSalesDealStatusType_DealStatusTypeID"."ID"
LEFT OUTER JOIN (
    SELECT "DealID", 1 AS "HasPaymentSchedule"
    FROM __mj_BizAppsSales."DealPaymentSchedule"
    GROUP BY "DealID"
) AS "ps" ON ps."DealID" = g."ID"
LEFT OUTER JOIN (
    SELECT
        tm."DealID",
        COUNT(*) AS "TeamMemberCount",
        MAX(CASE WHEN r."Code" = 'PARTNERMGR' THEN 1 ELSE 0 END) AS "HasPartnerInvolved"
    FROM __mj_BizAppsSales."DealTeamMember" tm
    JOIN __mj_BizAppsSales."DealRole" r ON tm."DealRoleID" = r."ID"
    GROUP BY tm."DealID"
) AS "team" ON team."DealID" = g."ID"
LEFT OUTER JOIN (
    SELECT
        i."DealID",
        SUM(i."IsInvoiced") AS "InvoiceCount",
        SUM(CASE WHEN i."IsInvoiced" = 1 THEN i."Amount" END) AS "InvoicedAmount",
        SUM(CASE WHEN i."IsInvoiced" = 1 THEN i."AmountPaid" END) AS "PaidAmount",
        SUM(CASE WHEN i."IsInvoiced" = 1 THEN i."Balance" END) AS "OutstandingBalance",
        MIN(CASE WHEN i."Balance" > 0 THEN i."DueDate" END) AS "NextPaymentDueDate"
    FROM __mj_BizAppsSales."vwWonDealInvoices" i
    GROUP BY i."DealID"
) AS "pay" ON pay."DealID" = g."ID"
LEFT JOIN LATERAL (SELECT * FROM __mj_BizAppsSales."fnDealPaymentStatus"(pay."InvoiceCount", pay."PaidAmount", pay."OutstandingBalance")) AS "pst"
    ON TRUE$vsql$;
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


-- ===================== Data (INSERT/UPDATE/DELETE) =====================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '5a8fdf75-8c2b-4a35-b08a-71432ea97222' OR ("EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND "Name" = 'InvoiceCount')
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
        '5a8fdf75-8c2b-4a35-b08a-71432ea97222',
        '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', -- "Entity": "MJ_BizApps_Sales": "Deals"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'),
        'InvoiceCount',
        'Invoice Count',
        NULL,
        'INTEGER',
        4,
        10,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'f96d0d34-76a3-417f-8921-7261f6dac26b' OR ("EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND "Name" = 'InvoicedAmount')
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
        'f96d0d34-76a3-417f-8921-7261f6dac26b',
        '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', -- "Entity": "MJ_BizApps_Sales": "Deals"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'),
        'InvoicedAmount',
        'Invoiced Amount',
        NULL,
        'decimal',
        17,
        38,
        2,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'e9b17b84-ae23-4ce8-864c-282777a49e10' OR ("EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND "Name" = 'PaidAmount')
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
        'e9b17b84-ae23-4ce8-864c-282777a49e10',
        '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', -- "Entity": "MJ_BizApps_Sales": "Deals"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'),
        'PaidAmount',
        'Paid Amount',
        NULL,
        'decimal',
        17,
        38,
        2,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '3b957b06-fc4e-43c2-a275-94ae5ae8c9eb' OR ("EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND "Name" = 'OutstandingBalance')
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
        '3b957b06-fc4e-43c2-a275-94ae5ae8c9eb',
        '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', -- "Entity": "MJ_BizApps_Sales": "Deals"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'),
        'OutstandingBalance',
        'Outstanding Balance',
        NULL,
        'decimal',
        17,
        38,
        2,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b66f526d-187d-4baa-a3d3-5293aaeb5b45' OR ("EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND "Name" = 'PaymentStatus')
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
        'b66f526d-187d-4baa-a3d3-5293aaeb5b45',
        '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', -- "Entity": "MJ_BizApps_Sales": "Deals"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'),
        'PaymentStatus',
        'Payment Status',
        NULL,
        'TEXT',
        40,
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
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '4a272108-4e2b-43b1-abad-a3532a2bf183' OR ("EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND "Name" = 'NextPaymentDueDate')
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
        '4a272108-4e2b-43b1-abad-a3532a2bf183',
        '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', -- "Entity": "MJ_BizApps_Sales": "Deals"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'),
        'NextPaymentDueDate',
        'Next Payment Due Date',
        NULL,
        'date',
        3,
        10,
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


-- ===================== Other =====================

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================
-- `mj codegen` (MJ CLI 6.2.1) against a throwaway database built from migrations only: MJ core
-- v6.2.1, then bizapps-common, -tasks, -accounting, -orders and -contracts from their checkouts,
-- then this app's migrations at `next` plus the DDL above. Reported success with per-entity
-- field/view parity clean, and a second pass wrote no SQL, so the run converges.
--
-- KEPT: the six new Deal EntityField rows, the only change the DDL above causes. vwDealsGenerated
-- and Deal's procedures are unchanged (Deal's table is not touched), so their regeneration is left
-- out, as are the field categories for all 80 of Deal's fields, the entity icon and the
-- FieldCategoryInfo settings the same run emitted: that output predates the committed state and is
-- not caused by these columns (the reasoning in V202611041530__v6.24.x__Deal_CreationDate.sql).
-- =============================================================================

/* SQL text to insert 6 new entity field(s) */

-- ===================== Grants =====================
-- Written by hand: the converter skipped the T-SQL `IF DATABASE_PRINCIPAL_ID(...) EXEC('GRANT ...')`
-- blocks. A role that does not exist is skipped here the same way.
DO $$ BEGIN GRANT SELECT ON __mj_BizAppsSales."vwWonDealInvoices" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON __mj_BizAppsSales."vwDeals" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
