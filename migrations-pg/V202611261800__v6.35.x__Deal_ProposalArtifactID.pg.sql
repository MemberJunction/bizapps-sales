-- @mj-pg-provenance: split-bake v1 source=V202611261800__v6.35.x__Deal_ProposalArtifactID.sql source-sha256=3aed4d7383d42cae607cdfc3e2d8c425e23f191b77c4cbce774bc87366bccc19 mode=needs-hand-rebaked
-- ============================================================================
-- MemberJunction PostgreSQL Migration — V202611261800__v6.35.x__Deal_ProposalArtifactID.sql
-- Split-and-regenerate with INLINE NATIVE CodeGen baking: hand-written DDL transpiled
-- (AST dialect), metadata DML inline, and CodeGen objects (views/sprocs/triggers/grants)
-- baked natively from `mj codegen`. Applies standalone via `mj migrate` — no deploy codegen.
-- ============================================================================

-- None required: UUID defaults use the built-in gen_random_uuid() (PostgreSQL 13+).
CREATE SCHEMA IF NOT EXISTS "__mj_BizAppsSales";
SET search_path TO "__mj_BizAppsSales", public;
SET standard_conforming_strings = on;

ALTER TABLE "__mj_BizAppsSales"."Deal"
  ADD COLUMN "ProposalArtifactID" UUID NULL CONSTRAINT "FK_Deal_ProposalArtifact" REFERENCES "__mj"."Artifact" (
    "ID"
  );

CREATE INDEX "IX_Deal_ProposalArtifactID" ON "__mj_BizAppsSales"."Deal"("ProposalArtifactID")
WHERE
  "ProposalArtifactID" IS NOT NULL;

COMMENT ON COLUMN "__mj_BizAppsSales"."Deal"."ProposalArtifactID" IS 'Optional foreign key referencing the MJ Docs (MJ: Artifacts) record for this Deal (Customer Proposal, Executive Deal Brief, or Mutual Action Plan).';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "__mj"."EntityField" WHERE "ID" = '109a68cb-0a14-4abc-b9ec-779cdd159b7a' OR ("EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND "Name" = 'ProposalArtifactID')) THEN
    INSERT INTO "__mj"."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES ('109a68cb-0a14-4abc-b9ec-779cdd159b7a', '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' /* Entity: MJ_BizApps_Sales: Deals */, (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM "__mj"."EntityField" WHERE "EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'), 'ProposalArtifactID', 'Proposal Artifact ID', 'Optional foreign key referencing the MJ Docs (MJ: Artifacts) record for this Deal (Customer Proposal, Executive Deal Brief, or Mutual Action Plan).', 'uniqueidentifier', 16, 0, 0, TRUE, NULL, FALSE, TRUE, FALSE, FALSE, 'F48D2341-8667-40BB-BCA8-87D7F80E16CD', 'ID', FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "__mj"."EntityRelationship" WHERE "ID" = 'cd835b73-d939-4bf1-9ea4-52208c16a808' OR ("EntityID" = 'F48D2341-8667-40BB-BCA8-87D7F80E16CD' AND "RelatedEntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND "RelatedEntityJoinField" = 'ProposalArtifactID')) THEN
    INSERT INTO "__mj"."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES ('cd835b73-d939-4bf1-9ea4-52208c16a808', 'F48D2341-8667-40BB-BCA8-87D7F80E16CD', '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', 'ProposalArtifactID', 'One To Many', TRUE, TRUE, 10, NOW(), NOW());
  END IF;
END $$;

-- Resolved conversion gap [1]: PostgreSQL equivalent of EXEC [__mj].[spUpdateEntityFieldRelatedEntityNameFieldMap]
UPDATE "__mj"."EntityField"
SET "RelatedEntityNameFieldMap" = 'ProposalArtifact',
    "__mj_UpdatedAt" = NOW()
WHERE "EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'
  AND "Name" = 'ProposalArtifactID';

-- Resolved conversion gap [2]: FK index guard matching SQL Server IDX_AUTO_MJ_FKEY_Deal_ProposalArtifactID
CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_Deal_ProposalArtifactID"
  ON "__mj_BizAppsSales"."Deal" ("ProposalArtifactID");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "__mj"."EntityField" WHERE "ID" = '3c7c0de4-301f-40bc-a87b-cd829227d39b' OR ("EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND "Name" = 'ProposalArtifact')) THEN
    INSERT INTO "__mj"."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt") VALUES ('3c7c0de4-301f-40bc-a87b-cd829227d39b', '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' /* Entity: MJ_BizApps_Sales: Deals */, (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM "__mj"."EntityField" WHERE "EntityID" = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'), 'ProposalArtifact', 'Proposal Artifact', NULL, 'nvarchar', 510, 0, 0, TRUE, NULL, FALSE, FALSE, TRUE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
  END IF;
END $$;

-- ===================== CodeGen (native PG, baked) =====================

-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deals
-- Item: Index for Foreign Keys
-- ============================================================
-- Skipped when another non-partial index already leads with the column.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index ix
        INNER JOIN pg_class t ON t.oid = ix.indrelid
        INNER JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = '__mj_BizAppsSales'
          AND t.relname = 'Deal'
          AND ix.indpred IS NULL
          AND ix.indnkeyatts >= 1
              AND ix.indkey[0] = (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attname = 'PipelineID')
    ) THEN
        CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_pipeline_id"
            ON "__mj_BizAppsSales"."Deal" ("PipelineID");
    END IF;
END
$$;

-- Skipped when another non-partial index already leads with the column.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index ix
        INNER JOIN pg_class t ON t.oid = ix.indrelid
        INNER JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = '__mj_BizAppsSales'
          AND t.relname = 'Deal'
          AND ix.indpred IS NULL
          AND ix.indnkeyatts >= 1
              AND ix.indkey[0] = (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attname = 'PipelineStageID')
    ) THEN
        CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_pipeline_stage_id"
            ON "__mj_BizAppsSales"."Deal" ("PipelineStageID");
    END IF;
END
$$;

-- Skipped when another non-partial index already leads with the column.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index ix
        INNER JOIN pg_class t ON t.oid = ix.indrelid
        INNER JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = '__mj_BizAppsSales'
          AND t.relname = 'Deal'
          AND ix.indpred IS NULL
          AND ix.indnkeyatts >= 1
              AND ix.indkey[0] = (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attname = 'DealTypeID')
    ) THEN
        CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_deal_type_id"
            ON "__mj_BizAppsSales"."Deal" ("DealTypeID");
    END IF;
END
$$;

-- Skipped when another non-partial index already leads with the column.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index ix
        INNER JOIN pg_class t ON t.oid = ix.indrelid
        INNER JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = '__mj_BizAppsSales'
          AND t.relname = 'Deal'
          AND ix.indpred IS NULL
          AND ix.indnkeyatts >= 1
              AND ix.indkey[0] = (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attname = 'DealStatusTypeID')
    ) THEN
        CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_deal_status_type_id"
            ON "__mj_BizAppsSales"."Deal" ("DealStatusTypeID");
    END IF;
END
$$;

-- Skipped when another non-partial index already leads with the column.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index ix
        INNER JOIN pg_class t ON t.oid = ix.indrelid
        INNER JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = '__mj_BizAppsSales'
          AND t.relname = 'Deal'
          AND ix.indpred IS NULL
          AND ix.indnkeyatts >= 1
              AND ix.indkey[0] = (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attname = 'AccountID')
    ) THEN
        CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_account_id"
            ON "__mj_BizAppsSales"."Deal" ("AccountID");
    END IF;
END
$$;

-- Skipped when another non-partial index already leads with the column.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index ix
        INNER JOIN pg_class t ON t.oid = ix.indrelid
        INNER JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = '__mj_BizAppsSales'
          AND t.relname = 'Deal'
          AND ix.indpred IS NULL
          AND ix.indnkeyatts >= 1
              AND ix.indkey[0] = (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attname = 'PrimaryContactID')
    ) THEN
        CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_primary_contact_id"
            ON "__mj_BizAppsSales"."Deal" ("PrimaryContactID");
    END IF;
END
$$;

-- Skipped when another non-partial index already leads with the column.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index ix
        INNER JOIN pg_class t ON t.oid = ix.indrelid
        INNER JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = '__mj_BizAppsSales'
          AND t.relname = 'Deal'
          AND ix.indpred IS NULL
          AND ix.indnkeyatts >= 1
              AND ix.indkey[0] = (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attname = 'BillingContactID')
    ) THEN
        CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_billing_contact_id"
            ON "__mj_BizAppsSales"."Deal" ("BillingContactID");
    END IF;
END
$$;

-- Skipped when another non-partial index already leads with the column.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index ix
        INNER JOIN pg_class t ON t.oid = ix.indrelid
        INNER JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = '__mj_BizAppsSales'
          AND t.relname = 'Deal'
          AND ix.indpred IS NULL
          AND ix.indnkeyatts >= 1
              AND ix.indkey[0] = (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attname = 'CompanyID')
    ) THEN
        CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_company_id"
            ON "__mj_BizAppsSales"."Deal" ("CompanyID");
    END IF;
END
$$;

-- Skipped when another non-partial index already leads with the column.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index ix
        INNER JOIN pg_class t ON t.oid = ix.indrelid
        INNER JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = '__mj_BizAppsSales'
          AND t.relname = 'Deal'
          AND ix.indpred IS NULL
          AND ix.indnkeyatts >= 1
              AND ix.indkey[0] = (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attname = 'OwnerEmployeeID')
    ) THEN
        CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_owner_employee_id"
            ON "__mj_BizAppsSales"."Deal" ("OwnerEmployeeID");
    END IF;
END
$$;

-- Skipped when another non-partial index already leads with the column.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index ix
        INNER JOIN pg_class t ON t.oid = ix.indrelid
        INNER JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = '__mj_BizAppsSales'
          AND t.relname = 'Deal'
          AND ix.indpred IS NULL
          AND ix.indnkeyatts >= 1
              AND ix.indkey[0] = (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attname = 'CurrencyID')
    ) THEN
        CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_currency_id"
            ON "__mj_BizAppsSales"."Deal" ("CurrencyID");
    END IF;
END
$$;

-- Skipped when another non-partial index already leads with the column.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index ix
        INNER JOIN pg_class t ON t.oid = ix.indrelid
        INNER JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = '__mj_BizAppsSales'
          AND t.relname = 'Deal'
          AND ix.indpred IS NULL
          AND ix.indnkeyatts >= 1
              AND ix.indkey[0] = (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attname = 'ForecastCategoryTypeID')
    ) THEN
        CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_forecast_category_type_id"
            ON "__mj_BizAppsSales"."Deal" ("ForecastCategoryTypeID");
    END IF;
END
$$;

-- Skipped when another non-partial index already leads with the column.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index ix
        INNER JOIN pg_class t ON t.oid = ix.indrelid
        INNER JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = '__mj_BizAppsSales'
          AND t.relname = 'Deal'
          AND ix.indpred IS NULL
          AND ix.indnkeyatts >= 1
              AND ix.indkey[0] = (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attname = 'LossReasonID')
    ) THEN
        CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_loss_reason_id"
            ON "__mj_BizAppsSales"."Deal" ("LossReasonID");
    END IF;
END
$$;

-- Skipped when another non-partial index already leads with the column.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index ix
        INNER JOIN pg_class t ON t.oid = ix.indrelid
        INNER JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = '__mj_BizAppsSales'
          AND t.relname = 'Deal'
          AND ix.indpred IS NULL
          AND ix.indnkeyatts >= 1
              AND ix.indkey[0] = (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attname = 'LeadSourceTypeID')
    ) THEN
        CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_lead_source_type_id"
            ON "__mj_BizAppsSales"."Deal" ("LeadSourceTypeID");
    END IF;
END
$$;

-- Skipped when another non-partial index already leads with the column.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index ix
        INNER JOIN pg_class t ON t.oid = ix.indrelid
        INNER JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = '__mj_BizAppsSales'
          AND t.relname = 'Deal'
          AND ix.indpred IS NULL
          AND ix.indnkeyatts >= 1
              AND ix.indkey[0] = (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attname = 'ContractID')
    ) THEN
        CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_contract_id"
            ON "__mj_BizAppsSales"."Deal" ("ContractID");
    END IF;
END
$$;

-- Skipped when another non-partial index already leads with the column.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index ix
        INNER JOIN pg_class t ON t.oid = ix.indrelid
        INNER JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = '__mj_BizAppsSales'
          AND t.relname = 'Deal'
          AND ix.indpred IS NULL
          AND ix.indnkeyatts >= 1
              AND ix.indkey[0] = (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attname = 'RenewsContractID')
    ) THEN
        CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_renews_contract_id"
            ON "__mj_BizAppsSales"."Deal" ("RenewsContractID");
    END IF;
END
$$;

-- Skipped when another non-partial index already leads with the column.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index ix
        INNER JOIN pg_class t ON t.oid = ix.indrelid
        INNER JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = '__mj_BizAppsSales'
          AND t.relname = 'Deal'
          AND ix.indpred IS NULL
          AND ix.indnkeyatts >= 1
              AND ix.indkey[0] = (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attname = 'ClosedByUserID')
    ) THEN
        CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_closed_by_user_id"
            ON "__mj_BizAppsSales"."Deal" ("ClosedByUserID");
    END IF;
END
$$;

-- Skipped when another non-partial index already leads with the column.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index ix
        INNER JOIN pg_class t ON t.oid = ix.indrelid
        INNER JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = '__mj_BizAppsSales'
          AND t.relname = 'Deal'
          AND ix.indpred IS NULL
          AND ix.indnkeyatts >= 1
              AND ix.indkey[0] = (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attname = 'OrderID')
    ) THEN
        CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_order_id"
            ON "__mj_BizAppsSales"."Deal" ("OrderID");
    END IF;
END
$$;

-- Skipped when another non-partial index already leads with the column.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index ix
        INNER JOIN pg_class t ON t.oid = ix.indrelid
        INNER JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = '__mj_BizAppsSales'
          AND t.relname = 'Deal'
          AND ix.indpred IS NULL
          AND ix.indnkeyatts >= 1
              AND ix.indkey[0] = (SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attname = 'ProposalArtifactID')
    ) THEN
        CREATE INDEX IF NOT EXISTS "idx_auto_mj_fkey_deal_proposal_artifact_id"
            ON "__mj_BizAppsSales"."Deal" ("ProposalArtifactID");
    END IF;
END
$$;

-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deals
-- Item: vwDealsGenerated
-- ============================================================

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Deals
-----               SCHEMA:      __mj_BizAppsSales
-----               BASE TABLE:  Deal
-----               PRIMARY KEY: ID
------------------------------------------------------------
DO $vw_regen$
DECLARE
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW "__mj_BizAppsSales"."vwDealsGenerated"
AS
SELECT
    d.*,
    mjBizAppsSalesPipeline_PipelineID."Name" AS "Pipeline",
    mjBizAppsSalesPipelineStage_PipelineStageID."Name" AS "PipelineStage",
    mjBizAppsSalesDealType_DealTypeID."Name" AS "DealType",
    mjBizAppsSalesDealStatusType_DealStatusTypeID."Name" AS "DealStatusType",
    mjBizAppsSalesSalesAccount_AccountID."Name" AS "Account",
    mjBizAppsSalesSalesContact_PrimaryContactID."DisplayNameAndEmail" AS "PrimaryContact",
    mjBizAppsSalesSalesContact_BillingContactID."DisplayNameAndEmail" AS "BillingContact",
    MJCompany_CompanyID."Name" AS "Company",
    MJEmployee_OwnerEmployeeID."FirstLast" AS "OwnerEmployee",
    mjBizAppsSalesForecastCategoryType_ForecastCategoryTypeID."Name" AS "ForecastCategoryType",
    mjBizAppsSalesLossReason_LossReasonID."Name" AS "LossReason",
    mjBizAppsSalesLeadSourceType_LeadSourceTypeID."Name" AS "LeadSourceType",
    MJUser_ClosedByUserID."Name" AS "ClosedByUser",
    mjBizAppsOrdersOrderHeader_OrderID."OrderNumber" AS "Order",
    MJArtifact_ProposalArtifactID."Name" AS "ProposalArtifact"
FROM
    "__mj_BizAppsSales"."Deal" AS d
LEFT OUTER JOIN
    "__mj_BizAppsSales"."Pipeline" AS mjBizAppsSalesPipeline_PipelineID
  ON
    "d"."PipelineID" = mjBizAppsSalesPipeline_PipelineID."ID"
LEFT OUTER JOIN
    "__mj_BizAppsSales"."PipelineStage" AS mjBizAppsSalesPipelineStage_PipelineStageID
  ON
    "d"."PipelineStageID" = mjBizAppsSalesPipelineStage_PipelineStageID."ID"
LEFT OUTER JOIN
    "__mj_BizAppsSales"."DealType" AS mjBizAppsSalesDealType_DealTypeID
  ON
    "d"."DealTypeID" = mjBizAppsSalesDealType_DealTypeID."ID"
LEFT OUTER JOIN
    "__mj_BizAppsSales"."DealStatusType" AS mjBizAppsSalesDealStatusType_DealStatusTypeID
  ON
    "d"."DealStatusTypeID" = mjBizAppsSalesDealStatusType_DealStatusTypeID."ID"
LEFT OUTER JOIN
    "__mj_BizAppsSales"."vwSalesAccounts" AS mjBizAppsSalesSalesAccount_AccountID
  ON
    "d"."AccountID" = mjBizAppsSalesSalesAccount_AccountID."ID"
LEFT OUTER JOIN
    "__mj_BizAppsSales"."vwSalesContacts" AS mjBizAppsSalesSalesContact_PrimaryContactID
  ON
    "d"."PrimaryContactID" = mjBizAppsSalesSalesContact_PrimaryContactID."ID"
LEFT OUTER JOIN
    "__mj_BizAppsSales"."vwSalesContacts" AS mjBizAppsSalesSalesContact_BillingContactID
  ON
    "d"."BillingContactID" = mjBizAppsSalesSalesContact_BillingContactID."ID"
LEFT OUTER JOIN
    "__mj"."Company" AS MJCompany_CompanyID
  ON
    "d"."CompanyID" = MJCompany_CompanyID."ID"
LEFT OUTER JOIN
    "__mj"."vwEmployees" AS MJEmployee_OwnerEmployeeID
  ON
    "d"."OwnerEmployeeID" = MJEmployee_OwnerEmployeeID."ID"
LEFT OUTER JOIN
    "__mj_BizAppsSales"."ForecastCategoryType" AS mjBizAppsSalesForecastCategoryType_ForecastCategoryTypeID
  ON
    "d"."ForecastCategoryTypeID" = mjBizAppsSalesForecastCategoryType_ForecastCategoryTypeID."ID"
LEFT OUTER JOIN
    "__mj_BizAppsSales"."LossReason" AS mjBizAppsSalesLossReason_LossReasonID
  ON
    "d"."LossReasonID" = mjBizAppsSalesLossReason_LossReasonID."ID"
LEFT OUTER JOIN
    "__mj_BizAppsSales"."LeadSourceType" AS mjBizAppsSalesLeadSourceType_LeadSourceTypeID
  ON
    "d"."LeadSourceTypeID" = mjBizAppsSalesLeadSourceType_LeadSourceTypeID."ID"
LEFT OUTER JOIN
    "__mj"."User" AS MJUser_ClosedByUserID
  ON
    "d"."ClosedByUserID" = MJUser_ClosedByUserID."ID"
LEFT OUTER JOIN
    "__mj_BizAppsOrders"."OrderHeader" AS mjBizAppsOrdersOrderHeader_OrderID
  ON
    "d"."OrderID" = mjBizAppsOrdersOrderHeader_OrderID."ID"
LEFT OUTER JOIN
    "__mj"."Artifact" AS MJArtifact_ProposalArtifactID
  ON
    "d"."ProposalArtifactID" = MJArtifact_ProposalArtifactID."ID"
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
    grants_sql  TEXT,
    depth       INT
  ) ON COMMIT DROP;
  DELETE FROM _vw_regen_deps;

  -- Every view that DROP ... CASCADE removes: direct dependents AND theirs, transitively.
  -- Capturing only direct dependents restored vwTestRuns after a vwTestSuiteRuns regen but
  -- not vwConversations / vwConversationDetails, which select from vwTestRuns — they and their
  -- CRUD functions stayed permanently missing. depth is the LONGEST path from the target, so
  -- replaying in depth order always recreates a view after every view it reads.
  CREATE TEMP TABLE IF NOT EXISTS _vw_regen_dep_oids (
    view_oid OID,
    depth    INT
  ) ON COMMIT DROP;
  DELETE FROM _vw_regen_dep_oids;
  INSERT INTO _vw_regen_dep_oids (view_oid, depth)
  WITH RECURSIVE deps(view_oid, depth) AS (
      SELECT DISTINCT dc.oid, 1
      FROM pg_depend d
      JOIN pg_rewrite r ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
      JOIN pg_class dc ON dc.oid = r.ev_class AND dc.relkind IN ('v', 'm')
      JOIN pg_class tc ON tc.oid = d.refobjid
      JOIN pg_namespace tn ON tn.oid = tc.relnamespace
      WHERE tn.nspname = '__mj_BizAppsSales'
        AND tc.relname = 'vwDealsGenerated'
        AND tc.relkind IN ('v', 'm')
        AND dc.oid <> tc.oid
    UNION
      SELECT dc.oid, deps.depth + 1
      FROM deps
      JOIN pg_depend d ON d.refobjid = deps.view_oid
      JOIN pg_rewrite r ON r.oid = d.objid AND d.classid = 'pg_rewrite'::regclass
      JOIN pg_class dc ON dc.oid = r.ev_class AND dc.relkind IN ('v', 'm')
      WHERE dc.oid <> deps.view_oid
        AND deps.depth < 50
  )
  SELECT view_oid, MAX(depth) FROM deps GROUP BY view_oid;

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
  INSERT INTO _vw_regen_deps (schema_name, view_name, relkind, definition, grants_sql, depth)
  SELECT
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
       WHERE g.privilege IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')),
      o.depth
  FROM _vw_regen_dep_oids o
  JOIN pg_class dc ON dc.oid = o.view_oid
  JOIN pg_namespace dn ON dn.oid = dc.relnamespace;

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
  -- The set is the target view plus every view captured above, because CASCADE drops the
  -- functions of each of them, not only the target's.
  INSERT INTO _vw_regen_fn_deps (schema_name, fn_name, fn_oid, definition)
  SELECT DISTINCT
      pn.nspname,
      pp.proname,
      pp.oid,
      pg_get_functiondef(pp.oid)
  FROM pg_proc pp
  JOIN pg_namespace pn ON pn.oid = pp.pronamespace
  WHERE pp.prokind IN ('f', 'p')
    AND EXISTS (
      SELECT 1
      FROM pg_class c
      WHERE (c.oid IN (SELECT view_oid FROM _vw_regen_dep_oids)
             OR c.oid = (SELECT tc.oid FROM pg_class tc
                         JOIN pg_namespace tn ON tn.oid = tc.relnamespace
                         WHERE tn.nspname = '__mj_BizAppsSales'
                           AND tc.relname = 'vwDealsGenerated'
                           AND tc.relkind IN ('v', 'm')))
        AND (pp.prorettype = c.reltype
             OR EXISTS (SELECT 1 FROM pg_depend d
                        WHERE d.classid = 'pg_proc'::regclass
                          AND d.objid = pp.oid
                          AND d.refobjid = c.oid))
  );

  DROP VIEW IF EXISTS "__mj_BizAppsSales"."vwDealsGenerated" CASCADE;
  EXECUTE vsql;

  -- Replay captured dependents. Best-effort: log + continue on failure.
  -- IMPORTANT: the CREATE VIEW and the GRANTs run in SEPARATE inner BEGIN
  -- blocks. PL/pgSQL's BEGIN ... EXCEPTION creates an implicit savepoint
  -- and rolls back EVERY statement in the block on any exception. If we
  -- combined CREATE+GRANT in one block and a GRANT failed (e.g. role not
  -- present in target environment), the just-recreated VIEW would also
  -- get rolled back and stay missing — the exact failure mode this
  -- wrapper exists to prevent.
  FOR rec IN SELECT schema_name, view_name, relkind, definition, grants_sql FROM _vw_regen_deps ORDER BY depth, view_name LOOP
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
  DROP TABLE _vw_regen_dep_oids;
  DROP TABLE _vw_regen_fn_deps;
END $vw_regen$;

DO $if_view_exists$
BEGIN
  IF to_regclass('"__mj_BizAppsSales"."vwDeals"') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON "__mj_BizAppsSales"."vwDeals" TO "cdp_Developer";
GRANT SELECT ON "__mj_BizAppsSales"."vwDeals" TO "cdp_Integration";
GRANT SELECT ON "__mj_BizAppsSales"."vwDeals" TO "cdp_UI";';
  END IF;
END
$if_view_exists$;


DO $if_view_exists$
BEGIN
  IF to_regclass('"__mj_BizAppsSales"."vwDeals"') IS NOT NULL THEN
    EXECUTE 'SELECT "__mj"."spRebindLayeredOuterView"(''__mj_BizAppsSales'', ''vwDeals'', ''vwDealsGenerated'');';
  END IF;
END
$if_view_exists$;


-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deals
-- Item: Permissions for vwDeals
-- ============================================================
DO $if_view_exists$
BEGIN
  IF to_regclass('"__mj_BizAppsSales"."vwDeals"') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON "__mj_BizAppsSales"."vwDeals" TO "cdp_Developer";
GRANT SELECT ON "__mj_BizAppsSales"."vwDeals" TO "cdp_Integration";
GRANT SELECT ON "__mj_BizAppsSales"."vwDeals" TO "cdp_UI";';
  END IF;
END
$if_view_exists$;


-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deals
-- Item: spCreateDeal
-- ============================================================

------------------------------------------------------------
----- CREATE FUNCTION FOR Deal (JSON-arg shape)
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spCreateDeal'
               AND pronamespace = '"__mj_BizAppsSales"'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_BizAppsSales"."spCreateDeal"(p_data JSONB)
RETURNS SETOF "__mj_BizAppsSales"."vwDeals"
AS $$
DECLARE
    v_id UUID;
    v_field_name TEXT;
    v_cast_expr  TEXT;
    v_col_list   TEXT;
    v_val_list   TEXT;
    v_sql        TEXT;
BEGIN
    IF p_data ? 'ID' THEN
        v_id := (p_data->>'ID')::UUID;
    ELSE
        v_id := gen_random_uuid();
    END IF;

    v_col_list := quote_ident('ID');
    v_val_list := quote_literal(v_id) || '::UUID';

    -- Build column / value lists from keys present in p_data. Absent keys are
    -- omitted entirely so the column's DEFAULT applies (matching the typed-arg
    -- sproc's default-substitution semantics).
    FOREACH v_field_name IN ARRAY ARRAY['DealNumber', 'Name', 'PipelineID', 'PipelineStageID', 'DealTypeID', 'DealStatusTypeID', 'AccountID', 'PrimaryContactID', 'BillingContactID', 'CompanyID', 'OwnerEmployeeID', 'Amount', 'AmountIsComputed', 'AmountComputedAt', 'AmountSourceHash', 'CurrencyID', 'MRR', 'ARR', 'TermMonths', 'EstimatedProjectWeeks', 'ExecutionDate', 'StartDate', 'ExpectedCloseDate', 'ActualCloseDate', 'Probability', 'ForecastCategoryTypeID', 'LossReasonID', 'LossNotes', 'LeadSourceTypeID', 'CampaignID', 'ContractID', 'RenewsContractID', 'AutoRenew', 'AnnualIncreasePctOverride', 'CancellationNoticeDaysOverride', 'PaymentMethod', 'StandardAgreementModified', 'ContractVariances', 'Description', 'NextStep', 'NextStepDate', 'ClosedAt', 'ClosedByUserID', 'OrderID', 'PredictedWinProbability', 'PredictedWinRiskBand', 'PredictedWinScoredAt', 'LeadSourceDetail', 'CreationDate', 'ProposalArtifactID']
    LOOP
        IF p_data ? v_field_name THEN
            v_cast_expr := CASE v_field_name
        WHEN 'DealNumber' THEN '($1->>''DealNumber'')'
        WHEN 'Name' THEN '($1->>''Name'')'
        WHEN 'PipelineID' THEN '($1->>''PipelineID'')::UUID'
        WHEN 'PipelineStageID' THEN '($1->>''PipelineStageID'')::UUID'
        WHEN 'DealTypeID' THEN '($1->>''DealTypeID'')::UUID'
        WHEN 'DealStatusTypeID' THEN '($1->>''DealStatusTypeID'')::UUID'
        WHEN 'AccountID' THEN '($1->>''AccountID'')::UUID'
        WHEN 'PrimaryContactID' THEN '($1->>''PrimaryContactID'')::UUID'
        WHEN 'BillingContactID' THEN '($1->>''BillingContactID'')::UUID'
        WHEN 'CompanyID' THEN '($1->>''CompanyID'')::UUID'
        WHEN 'OwnerEmployeeID' THEN '($1->>''OwnerEmployeeID'')::UUID'
        WHEN 'Amount' THEN '($1->>''Amount'')::DECIMAL(19, 4)'
        WHEN 'AmountIsComputed' THEN 'COALESCE(($1->>''AmountIsComputed'')::BOOLEAN, FALSE)'
        WHEN 'AmountComputedAt' THEN '($1->>''AmountComputedAt'')::TIMESTAMPTZ'
        WHEN 'AmountSourceHash' THEN '($1->>''AmountSourceHash'')'
        WHEN 'CurrencyID' THEN '($1->>''CurrencyID'')::UUID'
        WHEN 'MRR' THEN '($1->>''MRR'')::DECIMAL(19, 4)'
        WHEN 'ARR' THEN '($1->>''ARR'')::DECIMAL(19, 4)'
        WHEN 'TermMonths' THEN '($1->>''TermMonths'')::INT'
        WHEN 'EstimatedProjectWeeks' THEN '($1->>''EstimatedProjectWeeks'')::INT'
        WHEN 'ExecutionDate' THEN '($1->>''ExecutionDate'')::DATE'
        WHEN 'StartDate' THEN '($1->>''StartDate'')::DATE'
        WHEN 'ExpectedCloseDate' THEN '($1->>''ExpectedCloseDate'')::DATE'
        WHEN 'ActualCloseDate' THEN '($1->>''ActualCloseDate'')::DATE'
        WHEN 'Probability' THEN '($1->>''Probability'')::DECIMAL(5, 2)'
        WHEN 'ForecastCategoryTypeID' THEN '($1->>''ForecastCategoryTypeID'')::UUID'
        WHEN 'LossReasonID' THEN '($1->>''LossReasonID'')::UUID'
        WHEN 'LossNotes' THEN '($1->>''LossNotes'')'
        WHEN 'LeadSourceTypeID' THEN '($1->>''LeadSourceTypeID'')::UUID'
        WHEN 'CampaignID' THEN '($1->>''CampaignID'')::UUID'
        WHEN 'ContractID' THEN '($1->>''ContractID'')::UUID'
        WHEN 'RenewsContractID' THEN '($1->>''RenewsContractID'')::UUID'
        WHEN 'AutoRenew' THEN 'COALESCE(($1->>''AutoRenew'')::BOOLEAN, FALSE)'
        WHEN 'AnnualIncreasePctOverride' THEN '($1->>''AnnualIncreasePctOverride'')::DECIMAL(5, 2)'
        WHEN 'CancellationNoticeDaysOverride' THEN '($1->>''CancellationNoticeDaysOverride'')::INT'
        WHEN 'PaymentMethod' THEN '($1->>''PaymentMethod'')'
        WHEN 'StandardAgreementModified' THEN 'COALESCE(($1->>''StandardAgreementModified'')::BOOLEAN, FALSE)'
        WHEN 'ContractVariances' THEN '($1->>''ContractVariances'')'
        WHEN 'Description' THEN '($1->>''Description'')'
        WHEN 'NextStep' THEN '($1->>''NextStep'')'
        WHEN 'NextStepDate' THEN '($1->>''NextStepDate'')::DATE'
        WHEN 'ClosedAt' THEN '($1->>''ClosedAt'')::TIMESTAMPTZ'
        WHEN 'ClosedByUserID' THEN '($1->>''ClosedByUserID'')::UUID'
        WHEN 'OrderID' THEN '($1->>''OrderID'')::UUID'
        WHEN 'PredictedWinProbability' THEN '($1->>''PredictedWinProbability'')::DECIMAL(5, 4)'
        WHEN 'PredictedWinRiskBand' THEN '($1->>''PredictedWinRiskBand'')'
        WHEN 'PredictedWinScoredAt' THEN '($1->>''PredictedWinScoredAt'')::TIMESTAMPTZ'
        WHEN 'LeadSourceDetail' THEN '($1->>''LeadSourceDetail'')'
        WHEN 'CreationDate' THEN 'COALESCE(($1->>''CreationDate'')::TIMESTAMPTZ, NOW() AT TIME ZONE ''UTC'')'
        WHEN 'ProposalArtifactID' THEN '($1->>''ProposalArtifactID'')::UUID'
            END;
            v_col_list := v_col_list || ', ' || quote_ident(v_field_name);
            v_val_list := v_val_list || ', ' || v_cast_expr;
        END IF;
    END LOOP;

    v_sql := format(
        'INSERT INTO "__mj_BizAppsSales"."Deal" (%s) VALUES (%s)',
        v_col_list,
        v_val_list
    );
    -- Pass p_data as a positional parameter so the cast expressions inside
    -- v_val_list (which reference $1) can read the JSONB payload.
    EXECUTE v_sql USING p_data;

    RETURN QUERY
    SELECT * FROM "__mj_BizAppsSales"."vwDeals"
    WHERE "ID" = v_id;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_BizAppsSales"."spCreateDeal" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_BizAppsSales"."spCreateDeal" TO "cdp_Integration";
GRANT EXECUTE ON FUNCTION "__mj_BizAppsSales"."spCreateDeal" TO "cdp_UI";


-- ============================================================
-- PostgreSQL Generated SQL for Entity: MJ_BizApps_Sales: Deals
-- Item: spUpdateDeal
-- ============================================================

------------------------------------------------------------
----- UPDATE FUNCTION FOR Deal (JSON-arg shape)
------------------------------------------------------------
DO $do$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS sig
             FROM pg_proc
             WHERE proname = 'spUpdateDeal'
               AND pronamespace = '"__mj_BizAppsSales"'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_BizAppsSales"."spUpdateDeal"(p_data JSONB)
RETURNS SETOF "__mj_BizAppsSales"."vwDeals"
AS $$
DECLARE
    v_id UUID := (p_data->>'ID')::UUID;
    v_updated_count INTEGER;
BEGIN
    IF p_data IS NULL OR NOT (p_data ? 'ID') THEN
        RAISE EXCEPTION 'spUpdateDeal: p_data must include "ID"';
    END IF;

    UPDATE "__mj_BizAppsSales"."Deal"
    SET
        "DealNumber" = CASE WHEN p_data ? 'DealNumber' THEN (p_data->>'DealNumber') ELSE "DealNumber" END,
        "Name" = CASE WHEN p_data ? 'Name' THEN (p_data->>'Name') ELSE "Name" END,
        "PipelineID" = CASE WHEN p_data ? 'PipelineID' THEN (p_data->>'PipelineID')::UUID ELSE "PipelineID" END,
        "PipelineStageID" = CASE WHEN p_data ? 'PipelineStageID' THEN (p_data->>'PipelineStageID')::UUID ELSE "PipelineStageID" END,
        "DealTypeID" = CASE WHEN p_data ? 'DealTypeID' THEN (p_data->>'DealTypeID')::UUID ELSE "DealTypeID" END,
        "DealStatusTypeID" = CASE WHEN p_data ? 'DealStatusTypeID' THEN (p_data->>'DealStatusTypeID')::UUID ELSE "DealStatusTypeID" END,
        "AccountID" = CASE WHEN p_data ? 'AccountID' THEN (p_data->>'AccountID')::UUID ELSE "AccountID" END,
        "PrimaryContactID" = CASE WHEN p_data ? 'PrimaryContactID' THEN (p_data->>'PrimaryContactID')::UUID ELSE "PrimaryContactID" END,
        "BillingContactID" = CASE WHEN p_data ? 'BillingContactID' THEN (p_data->>'BillingContactID')::UUID ELSE "BillingContactID" END,
        "CompanyID" = CASE WHEN p_data ? 'CompanyID' THEN (p_data->>'CompanyID')::UUID ELSE "CompanyID" END,
        "OwnerEmployeeID" = CASE WHEN p_data ? 'OwnerEmployeeID' THEN (p_data->>'OwnerEmployeeID')::UUID ELSE "OwnerEmployeeID" END,
        "Amount" = CASE WHEN p_data ? 'Amount' THEN (p_data->>'Amount')::DECIMAL(19, 4) ELSE "Amount" END,
        "AmountIsComputed" = CASE WHEN p_data ? 'AmountIsComputed' THEN (p_data->>'AmountIsComputed')::BOOLEAN ELSE "AmountIsComputed" END,
        "AmountComputedAt" = CASE WHEN p_data ? 'AmountComputedAt' THEN (p_data->>'AmountComputedAt')::TIMESTAMPTZ ELSE "AmountComputedAt" END,
        "AmountSourceHash" = CASE WHEN p_data ? 'AmountSourceHash' THEN (p_data->>'AmountSourceHash') ELSE "AmountSourceHash" END,
        "CurrencyID" = CASE WHEN p_data ? 'CurrencyID' THEN (p_data->>'CurrencyID')::UUID ELSE "CurrencyID" END,
        "MRR" = CASE WHEN p_data ? 'MRR' THEN (p_data->>'MRR')::DECIMAL(19, 4) ELSE "MRR" END,
        "ARR" = CASE WHEN p_data ? 'ARR' THEN (p_data->>'ARR')::DECIMAL(19, 4) ELSE "ARR" END,
        "TermMonths" = CASE WHEN p_data ? 'TermMonths' THEN (p_data->>'TermMonths')::INT ELSE "TermMonths" END,
        "EstimatedProjectWeeks" = CASE WHEN p_data ? 'EstimatedProjectWeeks' THEN (p_data->>'EstimatedProjectWeeks')::INT ELSE "EstimatedProjectWeeks" END,
        "ExecutionDate" = CASE WHEN p_data ? 'ExecutionDate' THEN (p_data->>'ExecutionDate')::DATE ELSE "ExecutionDate" END,
        "StartDate" = CASE WHEN p_data ? 'StartDate' THEN (p_data->>'StartDate')::DATE ELSE "StartDate" END,
        "ExpectedCloseDate" = CASE WHEN p_data ? 'ExpectedCloseDate' THEN (p_data->>'ExpectedCloseDate')::DATE ELSE "ExpectedCloseDate" END,
        "ActualCloseDate" = CASE WHEN p_data ? 'ActualCloseDate' THEN (p_data->>'ActualCloseDate')::DATE ELSE "ActualCloseDate" END,
        "Probability" = CASE WHEN p_data ? 'Probability' THEN (p_data->>'Probability')::DECIMAL(5, 2) ELSE "Probability" END,
        "ForecastCategoryTypeID" = CASE WHEN p_data ? 'ForecastCategoryTypeID' THEN (p_data->>'ForecastCategoryTypeID')::UUID ELSE "ForecastCategoryTypeID" END,
        "LossReasonID" = CASE WHEN p_data ? 'LossReasonID' THEN (p_data->>'LossReasonID')::UUID ELSE "LossReasonID" END,
        "LossNotes" = CASE WHEN p_data ? 'LossNotes' THEN (p_data->>'LossNotes') ELSE "LossNotes" END,
        "LeadSourceTypeID" = CASE WHEN p_data ? 'LeadSourceTypeID' THEN (p_data->>'LeadSourceTypeID')::UUID ELSE "LeadSourceTypeID" END,
        "CampaignID" = CASE WHEN p_data ? 'CampaignID' THEN (p_data->>'CampaignID')::UUID ELSE "CampaignID" END,
        "ContractID" = CASE WHEN p_data ? 'ContractID' THEN (p_data->>'ContractID')::UUID ELSE "ContractID" END,
        "RenewsContractID" = CASE WHEN p_data ? 'RenewsContractID' THEN (p_data->>'RenewsContractID')::UUID ELSE "RenewsContractID" END,
        "AutoRenew" = CASE WHEN p_data ? 'AutoRenew' THEN (p_data->>'AutoRenew')::BOOLEAN ELSE "AutoRenew" END,
        "AnnualIncreasePctOverride" = CASE WHEN p_data ? 'AnnualIncreasePctOverride' THEN (p_data->>'AnnualIncreasePctOverride')::DECIMAL(5, 2) ELSE "AnnualIncreasePctOverride" END,
        "CancellationNoticeDaysOverride" = CASE WHEN p_data ? 'CancellationNoticeDaysOverride' THEN (p_data->>'CancellationNoticeDaysOverride')::INT ELSE "CancellationNoticeDaysOverride" END,
        "PaymentMethod" = CASE WHEN p_data ? 'PaymentMethod' THEN (p_data->>'PaymentMethod') ELSE "PaymentMethod" END,
        "StandardAgreementModified" = CASE WHEN p_data ? 'StandardAgreementModified' THEN (p_data->>'StandardAgreementModified')::BOOLEAN ELSE "StandardAgreementModified" END,
        "ContractVariances" = CASE WHEN p_data ? 'ContractVariances' THEN (p_data->>'ContractVariances') ELSE "ContractVariances" END,
        "Description" = CASE WHEN p_data ? 'Description' THEN (p_data->>'Description') ELSE "Description" END,
        "NextStep" = CASE WHEN p_data ? 'NextStep' THEN (p_data->>'NextStep') ELSE "NextStep" END,
        "NextStepDate" = CASE WHEN p_data ? 'NextStepDate' THEN (p_data->>'NextStepDate')::DATE ELSE "NextStepDate" END,
        "ClosedAt" = CASE WHEN p_data ? 'ClosedAt' THEN (p_data->>'ClosedAt')::TIMESTAMPTZ ELSE "ClosedAt" END,
        "ClosedByUserID" = CASE WHEN p_data ? 'ClosedByUserID' THEN (p_data->>'ClosedByUserID')::UUID ELSE "ClosedByUserID" END,
        "OrderID" = CASE WHEN p_data ? 'OrderID' THEN (p_data->>'OrderID')::UUID ELSE "OrderID" END,
        "PredictedWinProbability" = CASE WHEN p_data ? 'PredictedWinProbability' THEN (p_data->>'PredictedWinProbability')::DECIMAL(5, 4) ELSE "PredictedWinProbability" END,
        "PredictedWinRiskBand" = CASE WHEN p_data ? 'PredictedWinRiskBand' THEN (p_data->>'PredictedWinRiskBand') ELSE "PredictedWinRiskBand" END,
        "PredictedWinScoredAt" = CASE WHEN p_data ? 'PredictedWinScoredAt' THEN (p_data->>'PredictedWinScoredAt')::TIMESTAMPTZ ELSE "PredictedWinScoredAt" END,
        "LeadSourceDetail" = CASE WHEN p_data ? 'LeadSourceDetail' THEN (p_data->>'LeadSourceDetail') ELSE "LeadSourceDetail" END,
        "CreationDate" = CASE WHEN p_data ? 'CreationDate' THEN (p_data->>'CreationDate')::TIMESTAMPTZ ELSE "CreationDate" END,
        "ProposalArtifactID" = CASE WHEN p_data ? 'ProposalArtifactID' THEN (p_data->>'ProposalArtifactID')::UUID ELSE "ProposalArtifactID" END,
        "__mj_UpdatedAt" = NOW()
    WHERE
        "ID" = v_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        -- Nothing was updated, return empty result set
        RETURN;
    END IF;

    -- Return the updated record from the base view
    RETURN QUERY
    SELECT * FROM "__mj_BizAppsSales"."vwDeals"
    WHERE "ID" = v_id;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_BizAppsSales"."spUpdateDeal" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_BizAppsSales"."spUpdateDeal" TO "cdp_Integration";
GRANT EXECUTE ON FUNCTION "__mj_BizAppsSales"."spUpdateDeal" TO "cdp_UI";


------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the Deal table
------------------------------------------------------------
CREATE OR REPLACE FUNCTION "__mj_BizAppsSales"."fn_trg_update_deal"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."__mj_UpdatedAt" := NOW() AT TIME ZONE 'UTC';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_update_deal" ON "__mj_BizAppsSales"."Deal";

CREATE TRIGGER "trg_update_deal"
BEFORE UPDATE ON "__mj_BizAppsSales"."Deal"
FOR EACH ROW
EXECUTE FUNCTION "__mj_BizAppsSales"."fn_trg_update_deal"();



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
               AND pronamespace = '"__mj_BizAppsSales"'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig::text;
    END LOOP;
END
$do$;

CREATE OR REPLACE FUNCTION "__mj_BizAppsSales"."spDeleteDeal"(
    p_id UUID
) RETURNS TABLE("ID" UUID) AS $$
#variable_conflict use_column
DECLARE
    v_affected_count INTEGER;
BEGIN

    DELETE FROM "__mj_BizAppsSales"."Deal"
    WHERE "ID" = p_id;

    GET DIAGNOSTICS v_affected_count = ROW_COUNT;

    IF v_affected_count = 0 THEN
        RETURN QUERY SELECT NULL::UUID AS "ID";
    ELSE
        RETURN QUERY SELECT p_id AS "ID";
    END IF;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION "__mj_BizAppsSales"."spDeleteDeal" TO "cdp_Developer";
GRANT EXECUTE ON FUNCTION "__mj_BizAppsSales"."spDeleteDeal" TO "cdp_Integration";
GRANT EXECUTE ON FUNCTION "__mj_BizAppsSales"."spDeleteDeal" TO "cdp_UI";
