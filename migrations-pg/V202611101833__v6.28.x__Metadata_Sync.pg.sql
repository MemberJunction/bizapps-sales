-- =============================================================================================
-- PostgreSQL counterpart of V202611101833__v6.28.x__Metadata_Sync.sql
-- =============================================================================================
-- Same records, same values as the T-SQL file; see its header for what ships and why.
--
-- HOW IT WAS MADE: `mj sql-convert --from tsql --to postgres` (MJ CLI 6.2.1) on each block of the
-- push log, one block per run (the converter merges a multi-block log into one). Each block's
-- guard is then widened to match the T-SQL file (ID, or the natural key) and its update branch
-- removed, so every record is create-only. Core references use ${mjSchema}. The converter rewrote
-- some string values (the query SQL, field type names); those are restored verbatim from the T-SQL
-- file. The last block sets the query's approved fingerprint only while it has none.
-- =============================================================================================

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_ID_aa249e805c8d UUID;
  p_Name_aa249e805c8d VARCHAR(255);
  p_CategoryID_aa249e805c8d UUID;
  p_UserQuestion_aa249e805c8d TEXT;
  p_Description_aa249e805c8d TEXT;
  p_SQL_aa249e805c8d TEXT;
  p_TechnicalDescription_aa249e805c8d TEXT;
  p_OriginalSQL_aa249e805c8d TEXT;
  p_Feedback_aa249e805c8d TEXT;
  p_Status_aa249e805c8d VARCHAR(15);
  p_QualityRank_aa249e805c8d INTEGER;
  p_ExecutionCostRank_aa249e805c8d INTEGER;
  p_UsesTemplate_aa249e805c8d BOOLEAN;
  p_AuditQueryRuns_aa249e805c8d BOOLEAN;
  p_CacheEnabled_aa249e805c8d BOOLEAN;
  p_CacheTTLMinutes_aa249e805c8d INTEGER;
  p_CacheMaxSize_aa249e805c8d INTEGER;
  p_EmbeddingVector_aa249e805c8d TEXT;
  p_EmbeddingModelID_aa249e805c8d UUID;
  p_CacheValidationSQL_aa249e805c8d TEXT;
  p_SQLDialectID_aa249e805c8d UUID;
  p_Reusable_aa249e805c8d BOOLEAN;
  p_ExternalDataSourceID_aa249e805c8d UUID;
  p_IsMaterialized_aa249e805c8d BOOLEAN;
  p_Configuration_aa249e805c8d TEXT;
  p_EmbeddingVectorBinary_aa249e805c8d BYTEA;
  p_ApprovalComments_aa249e805c8d TEXT;
  p_ApprovedByUserID_aa249e805c8d UUID;
  p_ApprovedAt_aa249e805c8d TIMESTAMPTZ;
  p_ApprovedFingerprint_aa249e805c8d VARCHAR(100);
  p_ExtractedSQLHash_aa249e805c8d VARCHAR(64);
  p_ExtractionStatus_aa249e805c8d VARCHAR(20);
  p_ExtractionMessage_aa249e805c8d TEXT;
BEGIN
  p_ID_aa249e805c8d := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_aa249e805c8d := 'Sales: Confirmed Orders Missing Agreement';
  -- The Sales query category this app ships, found by name with its own ID first: a database can
  -- hold more than one category named Sales.
  p_CategoryID_aa249e805c8d := COALESCE((SELECT "ID" FROM "${mjSchema}"."QueryCategory" WHERE "Name" = 'Sales' ORDER BY CASE WHEN "ID" = '5A1E5000-0000-4000-A000-000000000001' THEN 0 ELSE 1 END LIMIT 1), '5A1E5000-0000-4000-A000-000000000001');
  p_UserQuestion_aa249e805c8d := 'Which confirmed orders have no deal, no contract, or no executed contract, so should not be invoiced yet?';
  p_Description_aa249e805c8d := 'Confirmed orders that have no deal, no contract, no signed date on the contract, or no file in the Executed Agreement category. Web orders, returns, subscription auto-renewals and migrated orders are left out, and Payment Link orders are checked for a deal only.';
  p_SQL_aa249e805c8d := '-- Confirmed orders with no deal, no contract, or no executed contract. golive #388.
--
-- Finance must not invoice before the agreement is signed. This lists every confirmed order that
-- fails any one check, one row per order, with a bit per check so finance sees which one failed.
-- A User Routine in aidp-next runs it weekly; the same query runs on demand from Explorer.
--
-- THE WALK IS order -> deal -> contract. OrderHeader holds neither a deal nor a contract (sales
-- depends on orders and contracts, not the reverse), so the deal is the vwDeals row whose OrderID
-- is the order, and the contract is that deal''s ContractID. Deal.OrderID is not unique, so the
-- deal checked is a Won one first (DealStatusType.IsWon), then the newest, with ID breaking a tie.
-- order-related.panel.ts (oldest) and DealOrderLink.ts (lowest ID) pick differently; they are not
-- changed here.
--
-- RENEWAL DEALS: a won renewal deal gets no ContractID while renewals are unbuilt (D-11), only
-- RenewsContractID, so the contract is COALESCE(ContractID, RenewsContractID).
--
-- EXCLUDED (Andrew, 2026-10-28):
--   * Web orders: checkout terms stand in for an agreement. A checkout order is the one with a
--     SourceCheckoutWidgetID, the FK checkout stamps beside Origin = ''Widget''; the FK is read
--     instead of the free-text Origin.
--   * Returns, and subscription cancellations: both reverse an order this report already covers.
--     Excluded by ReversesOrderHeaderID, and by OrderType (CHECK-constrained, compared by value
--     like Status) for one whose link was never set.
--   * Subscription auto-renewals: a renewal-ONLY order, where every top-level, non-reversal line
--     has RenewsSubscriptionID. Orders spawns these with no deal. This is the same test as orders''
--     OrderReviewExemption (order-review.ts). An order that renews one subscription and sells
--     something new stays on the report.
--   * Migrated orders (Andrew, PR #497 review): Origin = ''Migration'', loaded by data conversion
--     with no deal, so every one would fail HasDeal and bury the live orders. Origin is NOT NULL
--     (default ''Direct''), so the <> needs no NULL handling.
--
-- PAYMENT LINK is not named. It is the contract type with RequiresExecutedDocument = 0 (the
-- customer accepts terms at payment). An order whose contract has that flag off is checked for a
-- deal only. An order with no contract cannot be known to be Payment Link, so it is flagged.
--
-- "EXECUTED" MEANS BOTH: the contract''s ExecutedDate (HasSignedDate) and a file in the
-- ''Executed Agreement'' file category (HasExecutedDocument). The second is vwContracts''
-- IsAwaitingDocument, which is 1 exactly when the type requires the document and no such file is
-- linked, so it covers every contract this report checks.
--
-- A check that does not apply reads 1: a Payment Link order has HasSignedDate and
-- HasExecutedDocument = 1. A check that cannot run because an earlier one failed reads 0.
WITH checked AS (
    SELECT
        o.ID                                        AS OrderID,
        o.OrderNumber,
        o.OrderType,
        o.OrderDate,
        o.ConfirmedAt,
        o.CompanyID,
        o.Company                                   AS CompanyName,
        COALESCE(o.BillToOrganization, o.BillToPerson) AS CustomerName,
        o.TotalGross,
        o.Balance,
        o.SalesRepUser                              AS SalesRepName,
        d.ID                                        AS DealID,
        d.DealNumber,
        d.Name                                      AS DealName,
        d.OwnerEmployee                             AS DealOwnerName,
        c.ID                                        AS ContractID,
        c.ContractNumber,
        c.ContractType,
        c.State                                     AS ContractState,
        c.ExecutedDate,
        CAST(CASE WHEN d.ID IS NULL THEN 0 ELSE 1 END AS bit) AS HasDeal,
        CAST(CASE WHEN c.ID IS NOT NULL OR ct.RequiresExecutedDocument = 0 THEN 1 ELSE 0 END AS bit) AS HasContract,
        CAST(CASE WHEN ct.RequiresExecutedDocument = 0 OR c.ExecutedDate IS NOT NULL THEN 1 ELSE 0 END AS bit) AS HasSignedDate,
        CAST(CASE WHEN ct.RequiresExecutedDocument = 0 OR c.IsAwaitingDocument = 0 THEN 1 ELSE 0 END AS bit) AS HasExecutedDocument
    FROM [__mj_BizAppsOrders].vwOrderHeaders o
    OUTER APPLY (
        SELECT TOP 1 x.ID, x.DealNumber, x.Name, x.OwnerEmployee, COALESCE(x.ContractID, x.RenewsContractID) AS ContractID
        FROM [__mj_BizAppsSales].vwDeals x
        LEFT JOIN [__mj_BizAppsSales].DealStatusType xs
               ON xs.ID = x.DealStatusTypeID
        WHERE x.OrderID = o.ID
        ORDER BY CASE WHEN xs.IsWon = 1 THEN 0 ELSE 1 END, x.__mj_CreatedAt DESC, x.ID
    ) d
    LEFT JOIN [__mj_BizAppsContracts].vwContracts c
           ON c.ID = d.ContractID
    LEFT JOIN [__mj_BizAppsContracts].ContractType ct
           ON ct.ID = c.ContractTypeID
    WHERE o.Status = N''Confirmed''
      AND o.SourceCheckoutWidgetID IS NULL
      AND o.Origin <> N''Migration''
      AND o.ReversesOrderHeaderID IS NULL
      AND o.OrderType NOT IN (N''Return'', N''Cancellation'')
      AND NOT (
          EXISTS (
              SELECT 1 FROM [__mj_BizAppsOrders].OrderLine ol
              WHERE ol.OrderHeaderID = o.ID
                AND ol.ParentOrderLineID IS NULL
                AND ol.ReversesOrderLineID IS NULL
                AND ol.RenewsSubscriptionID IS NOT NULL
          )
          AND NOT EXISTS (
              SELECT 1 FROM [__mj_BizAppsOrders].OrderLine ol
              WHERE ol.OrderHeaderID = o.ID
                AND ol.ParentOrderLineID IS NULL
                AND ol.ReversesOrderLineID IS NULL
                AND ol.RenewsSubscriptionID IS NULL
          )
      )
      {% if CompanyID %}
      AND o.CompanyID = {{ CompanyID | sqlString }}
      {% endif %}
      {% if CompanyIDs %}
      AND o.CompanyID IN {{ CompanyIDs | sqlIn }}
      {% endif %}
)
-- Columns listed, not *: MJ''s field extraction reads * as every column of every joined view.
SELECT
    OrderID, OrderNumber, OrderType, OrderDate, ConfirmedAt, CompanyID, CompanyName, CustomerName,
    TotalGross, Balance, SalesRepName, DealID, DealNumber, DealName, DealOwnerName, ContractID,
    ContractNumber, ContractType, ContractState, ExecutedDate,
    HasDeal, HasContract, HasSignedDate, HasExecutedDocument
FROM checked
WHERE HasDeal = 0 OR HasContract = 0 OR HasSignedDate = 0 OR HasExecutedDocument = 0
ORDER BY CompanyName, ConfirmedAt, OrderNumber;
';
  p_TechnicalDescription_aa249e805c8d := 'Grain: OrderHeader, one row per failing order (golive #388). Confirmed is Status = ''Confirmed''. Excludes checkout orders (SourceCheckoutWidgetID set) reversals (ReversesOrderHeaderID set, or OrderType Return or Cancellation) and subscription auto-renewals (renewal-only orders: at least one top-level, non-reversal OrderLine and every such line has RenewsSubscriptionID, matching orders'' OrderReviewExemption) and migrated orders (Origin = ''Migration'', loaded by data conversion with no deal; Origin is NOT NULL, default ''Direct''). The deal is the vwDeals row with OrderID = the order, Won (DealStatusType.IsWon) first, then newest, then ID; the contract is that deal''s COALESCE(ContractID, RenewsContractID), so a won renewal deal is checked against the contract it renews. Payment Link is ContractType.RequiresExecutedDocument = 0, never a name: those orders read HasContract, HasSignedDate and HasExecutedDocument = 1. HasSignedDate is Contract.ExecutedDate IS NOT NULL; HasExecutedDocument is vwContracts.IsAwaitingDocument = 0 (a file in the ''Executed Agreement'' FileCategory). A check that cannot run because an earlier one failed reads 0. Date dimension: ConfirmedAt, for ordering only. Optional parameters: CompanyID (single) and CompanyIDs (array, sqlIn).';
  p_Status_aa249e805c8d := 'Approved';
  p_QualityRank_aa249e805c8d := 8;
  p_ExecutionCostRank_aa249e805c8d := 2;
  p_UsesTemplate_aa249e805c8d := TRUE;
  p_AuditQueryRuns_aa249e805c8d := FALSE;
  p_CacheEnabled_aa249e805c8d := FALSE;
  p_Reusable_aa249e805c8d := FALSE;
  p_IsMaterialized_aa249e805c8d := FALSE;
  p_ApprovedByUserID_aa249e805c8d := 'ECAFCCEC-6A37-EF11-86D4-000D3A4E707E';
  p_ApprovedAt_aa249e805c8d := '2026-11-10T18:31:48.242Z';
  p_ExtractedSQLHash_aa249e805c8d := '95d25ced120e41721dee5e985f62e99f323d5bef5d8099a8ae58cf5840811110';
  p_ExtractionStatus_aa249e805c8d := 'OK';
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."Query"
                 WHERE "ID" = p_ID_aa249e805c8d
                    OR ("CategoryID" = p_CategoryID_aa249e805c8d AND "Name" = p_Name_aa249e805c8d)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQuery'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQuery"(p_data := jsonb_build_object(
    'ID', p_ID_aa249e805c8d,
    'Name', p_Name_aa249e805c8d,
    'CategoryID', p_CategoryID_aa249e805c8d,
    'UserQuestion', p_UserQuestion_aa249e805c8d,
    'Description', p_Description_aa249e805c8d,
    'SQL', p_SQL_aa249e805c8d,
    'TechnicalDescription', p_TechnicalDescription_aa249e805c8d,
    'OriginalSQL', p_OriginalSQL_aa249e805c8d,
    'Feedback', p_Feedback_aa249e805c8d,
    'Status', p_Status_aa249e805c8d,
    'QualityRank', p_QualityRank_aa249e805c8d,
    'ExecutionCostRank', p_ExecutionCostRank_aa249e805c8d,
    'UsesTemplate', p_UsesTemplate_aa249e805c8d,
    'AuditQueryRuns', p_AuditQueryRuns_aa249e805c8d,
    'CacheEnabled', p_CacheEnabled_aa249e805c8d,
    'CacheTTLMinutes', p_CacheTTLMinutes_aa249e805c8d,
    'CacheMaxSize', p_CacheMaxSize_aa249e805c8d,
    'EmbeddingVector', p_EmbeddingVector_aa249e805c8d,
    'EmbeddingModelID', p_EmbeddingModelID_aa249e805c8d,
    'CacheValidationSQL', p_CacheValidationSQL_aa249e805c8d,
    'SQLDialectID', p_SQLDialectID_aa249e805c8d,
    'Reusable', p_Reusable_aa249e805c8d,
    'ExternalDataSourceID', p_ExternalDataSourceID_aa249e805c8d,
    'IsMaterialized', p_IsMaterialized_aa249e805c8d,
    'Configuration', p_Configuration_aa249e805c8d,
    'EmbeddingVectorBinary', p_EmbeddingVectorBinary_aa249e805c8d,
    'ApprovalComments', p_ApprovalComments_aa249e805c8d,
    'ApprovedByUserID', p_ApprovedByUserID_aa249e805c8d,
    'ApprovedAt', p_ApprovedAt_aa249e805c8d,
    'ApprovedFingerprint', p_ApprovedFingerprint_aa249e805c8d,
    'ExtractedSQLHash', p_ExtractedSQLHash_aa249e805c8d,
    'ExtractionStatus', p_ExtractionStatus_aa249e805c8d,
    'ExtractionMessage', p_ExtractionMessage_aa249e805c8d
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQuery"(p_ID := p_ID_aa249e805c8d, p_Name := p_Name_aa249e805c8d, p_CategoryID := p_CategoryID_aa249e805c8d, p_UserQuestion := p_UserQuestion_aa249e805c8d, p_Description := p_Description_aa249e805c8d, p_SQL := p_SQL_aa249e805c8d, p_TechnicalDescription := p_TechnicalDescription_aa249e805c8d, p_OriginalSQL := p_OriginalSQL_aa249e805c8d, p_OriginalSQL_Clear := TRUE, p_Feedback := p_Feedback_aa249e805c8d, p_Feedback_Clear := TRUE, p_Status := p_Status_aa249e805c8d, p_QualityRank := p_QualityRank_aa249e805c8d, p_ExecutionCostRank := p_ExecutionCostRank_aa249e805c8d, p_UsesTemplate := p_UsesTemplate_aa249e805c8d, p_AuditQueryRuns := p_AuditQueryRuns_aa249e805c8d, p_CacheEnabled := p_CacheEnabled_aa249e805c8d, p_CacheTTLMinutes := p_CacheTTLMinutes_aa249e805c8d, p_CacheTTLMinutes_Clear := TRUE, p_CacheMaxSize := p_CacheMaxSize_aa249e805c8d, p_CacheMaxSize_Clear := TRUE, p_EmbeddingVector := p_EmbeddingVector_aa249e805c8d, p_EmbeddingVector_Clear := TRUE, p_EmbeddingModelID := p_EmbeddingModelID_aa249e805c8d, p_EmbeddingModelID_Clear := TRUE, p_CacheValidationSQL := p_CacheValidationSQL_aa249e805c8d, p_CacheValidationSQL_Clear := TRUE, p_SQLDialectID := p_SQLDialectID_aa249e805c8d, p_Reusable := p_Reusable_aa249e805c8d, p_ExternalDataSourceID := p_ExternalDataSourceID_aa249e805c8d, p_ExternalDataSourceID_Clear := TRUE, p_IsMaterialized := p_IsMaterialized_aa249e805c8d, p_Configuration := p_Configuration_aa249e805c8d, p_Configuration_Clear := TRUE, p_EmbeddingVectorBinary := p_EmbeddingVectorBinary_aa249e805c8d, p_EmbeddingVectorBinary_Clear := TRUE, p_ApprovalComments := p_ApprovalComments_aa249e805c8d, p_ApprovalComments_Clear := TRUE, p_ApprovedByUserID := p_ApprovedByUserID_aa249e805c8d, p_ApprovedAt := p_ApprovedAt_aa249e805c8d, p_ApprovedFingerprint := p_ApprovedFingerprint_aa249e805c8d, p_ApprovedFingerprint_Clear := TRUE, p_ExtractedSQLHash := p_ExtractedSQLHash_aa249e805c8d, p_ExtractionStatus := p_ExtractionStatus_aa249e805c8d, p_ExtractionMessage := p_ExtractionMessage_aa249e805c8d, p_ExtractionMessage_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_4650558f75c6 UUID;
  p_QueryID_4650558f75c6 UUID;
  p_Name_4650558f75c6 VARCHAR(255);
  p_Description_4650558f75c6 TEXT;
  p_Sequence_4650558f75c6 INTEGER;
  p_SQLBaseType_4650558f75c6 VARCHAR(50);
  p_SQLFullType_4650558f75c6 VARCHAR(100);
  p_SourceEntityID_4650558f75c6 UUID;
  p_SourceFieldName_4650558f75c6 VARCHAR(255);
  p_IsComputed_4650558f75c6 BOOLEAN;
  p_ComputationDescription_4650558f75c6 TEXT;
  p_IsSummary_4650558f75c6 BOOLEAN;
  p_SummaryDescription_4650558f75c6 TEXT;
  p_DetectionMethod_4650558f75c6 VARCHAR(50);
  p_AutoDetectConfidenceScore_4650558f75c6 NUMERIC(3,2);
  p_SourceEntityFieldID_4650558f75c6 UUID;
  p_IsNullable_4650558f75c6 BOOLEAN;
  p_SourceObjectName_4650558f75c6 VARCHAR(500);
BEGIN
  p_ID_4650558f75c6 := '51ec0c59-3178-489d-bc20-6ad697c61756';
  p_QueryID_4650558f75c6 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_4650558f75c6 := 'OrderID';
  p_Sequence_4650558f75c6 := 1;
  p_SQLBaseType_4650558f75c6 := 'uniqueidentifier';
  p_SQLFullType_4650558f75c6 := 'uniqueidentifier';
  p_SourceEntityID_4650558f75c6 := 'FC529BC8-FF09-44A9-B454-26EAFDAC791B';
  p_SourceFieldName_4650558f75c6 := 'ID';
  p_IsComputed_4650558f75c6 := FALSE;
  p_IsSummary_4650558f75c6 := FALSE;
  p_DetectionMethod_4650558f75c6 := 'Database';
  p_SourceEntityFieldID_4650558f75c6 := '142D7CE2-5C12-4A68-B7CC-797CBDA164C1';
  p_IsNullable_4650558f75c6 := FALSE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_4650558f75c6 := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_4650558f75c6 AND "Name" = p_SourceFieldName_4650558f75c6
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_4650558f75c6 THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_4650558f75c6
                    OR ("QueryID" = p_QueryID_4650558f75c6 AND "Name" = p_Name_4650558f75c6)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_4650558f75c6,
    'QueryID', p_QueryID_4650558f75c6,
    'Name', p_Name_4650558f75c6,
    'Description', p_Description_4650558f75c6,
    'Sequence', p_Sequence_4650558f75c6,
    'SQLBaseType', p_SQLBaseType_4650558f75c6,
    'SQLFullType', p_SQLFullType_4650558f75c6,
    'SourceEntityID', p_SourceEntityID_4650558f75c6,
    'SourceFieldName', p_SourceFieldName_4650558f75c6,
    'IsComputed', p_IsComputed_4650558f75c6,
    'ComputationDescription', p_ComputationDescription_4650558f75c6,
    'IsSummary', p_IsSummary_4650558f75c6,
    'SummaryDescription', p_SummaryDescription_4650558f75c6,
    'DetectionMethod', p_DetectionMethod_4650558f75c6,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_4650558f75c6,
    'SourceEntityFieldID', p_SourceEntityFieldID_4650558f75c6,
    'IsNullable', p_IsNullable_4650558f75c6,
    'SourceObjectName', p_SourceObjectName_4650558f75c6
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_4650558f75c6, p_QueryID := p_QueryID_4650558f75c6, p_Name := p_Name_4650558f75c6, p_Description := p_Description_4650558f75c6, p_Description_Clear := TRUE, p_Sequence := p_Sequence_4650558f75c6, p_SQLBaseType := p_SQLBaseType_4650558f75c6, p_SQLFullType := p_SQLFullType_4650558f75c6, p_SourceEntityID := p_SourceEntityID_4650558f75c6, p_SourceFieldName := p_SourceFieldName_4650558f75c6, p_IsComputed := p_IsComputed_4650558f75c6, p_ComputationDescription := p_ComputationDescription_4650558f75c6, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_4650558f75c6, p_SummaryDescription := p_SummaryDescription_4650558f75c6, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_4650558f75c6, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_4650558f75c6, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_4650558f75c6, p_IsNullable := p_IsNullable_4650558f75c6, p_SourceObjectName := p_SourceObjectName_4650558f75c6, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_b36b46aff51c UUID;
  p_QueryID_b36b46aff51c UUID;
  p_Name_b36b46aff51c VARCHAR(255);
  p_Description_b36b46aff51c TEXT;
  p_Sequence_b36b46aff51c INTEGER;
  p_SQLBaseType_b36b46aff51c VARCHAR(50);
  p_SQLFullType_b36b46aff51c VARCHAR(100);
  p_SourceEntityID_b36b46aff51c UUID;
  p_SourceFieldName_b36b46aff51c VARCHAR(255);
  p_IsComputed_b36b46aff51c BOOLEAN;
  p_ComputationDescription_b36b46aff51c TEXT;
  p_IsSummary_b36b46aff51c BOOLEAN;
  p_SummaryDescription_b36b46aff51c TEXT;
  p_DetectionMethod_b36b46aff51c VARCHAR(50);
  p_AutoDetectConfidenceScore_b36b46aff51c NUMERIC(3,2);
  p_SourceEntityFieldID_b36b46aff51c UUID;
  p_IsNullable_b36b46aff51c BOOLEAN;
  p_SourceObjectName_b36b46aff51c VARCHAR(500);
BEGIN
  p_ID_b36b46aff51c := '6539ca7c-bf15-4392-a423-5743767965c0';
  p_QueryID_b36b46aff51c := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_b36b46aff51c := 'OrderNumber';
  p_Description_b36b46aff51c := 'Human-readable order identifier. Unique.';
  p_Sequence_b36b46aff51c := 2;
  p_SQLBaseType_b36b46aff51c := 'nvarchar';
  p_SQLFullType_b36b46aff51c := 'nvarchar(40)';
  p_SourceEntityID_b36b46aff51c := 'FC529BC8-FF09-44A9-B454-26EAFDAC791B';
  p_SourceFieldName_b36b46aff51c := 'OrderNumber';
  p_IsComputed_b36b46aff51c := FALSE;
  p_IsSummary_b36b46aff51c := FALSE;
  p_DetectionMethod_b36b46aff51c := 'Database';
  p_SourceEntityFieldID_b36b46aff51c := '37ED0567-5213-4E33-9123-C88CF3E9A851';
  p_IsNullable_b36b46aff51c := FALSE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_b36b46aff51c := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_b36b46aff51c AND "Name" = p_SourceFieldName_b36b46aff51c
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_b36b46aff51c THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_b36b46aff51c
                    OR ("QueryID" = p_QueryID_b36b46aff51c AND "Name" = p_Name_b36b46aff51c)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_b36b46aff51c,
    'QueryID', p_QueryID_b36b46aff51c,
    'Name', p_Name_b36b46aff51c,
    'Description', p_Description_b36b46aff51c,
    'Sequence', p_Sequence_b36b46aff51c,
    'SQLBaseType', p_SQLBaseType_b36b46aff51c,
    'SQLFullType', p_SQLFullType_b36b46aff51c,
    'SourceEntityID', p_SourceEntityID_b36b46aff51c,
    'SourceFieldName', p_SourceFieldName_b36b46aff51c,
    'IsComputed', p_IsComputed_b36b46aff51c,
    'ComputationDescription', p_ComputationDescription_b36b46aff51c,
    'IsSummary', p_IsSummary_b36b46aff51c,
    'SummaryDescription', p_SummaryDescription_b36b46aff51c,
    'DetectionMethod', p_DetectionMethod_b36b46aff51c,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_b36b46aff51c,
    'SourceEntityFieldID', p_SourceEntityFieldID_b36b46aff51c,
    'IsNullable', p_IsNullable_b36b46aff51c,
    'SourceObjectName', p_SourceObjectName_b36b46aff51c
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_b36b46aff51c, p_QueryID := p_QueryID_b36b46aff51c, p_Name := p_Name_b36b46aff51c, p_Description := p_Description_b36b46aff51c, p_Sequence := p_Sequence_b36b46aff51c, p_SQLBaseType := p_SQLBaseType_b36b46aff51c, p_SQLFullType := p_SQLFullType_b36b46aff51c, p_SourceEntityID := p_SourceEntityID_b36b46aff51c, p_SourceFieldName := p_SourceFieldName_b36b46aff51c, p_IsComputed := p_IsComputed_b36b46aff51c, p_ComputationDescription := p_ComputationDescription_b36b46aff51c, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_b36b46aff51c, p_SummaryDescription := p_SummaryDescription_b36b46aff51c, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_b36b46aff51c, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_b36b46aff51c, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_b36b46aff51c, p_IsNullable := p_IsNullable_b36b46aff51c, p_SourceObjectName := p_SourceObjectName_b36b46aff51c, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_456b8611c764 UUID;
  p_QueryID_456b8611c764 UUID;
  p_Name_456b8611c764 VARCHAR(255);
  p_Description_456b8611c764 TEXT;
  p_Sequence_456b8611c764 INTEGER;
  p_SQLBaseType_456b8611c764 VARCHAR(50);
  p_SQLFullType_456b8611c764 VARCHAR(100);
  p_SourceEntityID_456b8611c764 UUID;
  p_SourceFieldName_456b8611c764 VARCHAR(255);
  p_IsComputed_456b8611c764 BOOLEAN;
  p_ComputationDescription_456b8611c764 TEXT;
  p_IsSummary_456b8611c764 BOOLEAN;
  p_SummaryDescription_456b8611c764 TEXT;
  p_DetectionMethod_456b8611c764 VARCHAR(50);
  p_AutoDetectConfidenceScore_456b8611c764 NUMERIC(3,2);
  p_SourceEntityFieldID_456b8611c764 UUID;
  p_IsNullable_456b8611c764 BOOLEAN;
  p_SourceObjectName_456b8611c764 VARCHAR(500);
BEGIN
  p_ID_456b8611c764 := 'fcdeaa4c-caab-43fd-8728-2b35f7d2f9db';
  p_QueryID_456b8611c764 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_456b8611c764 := 'OrderType';
  p_Description_456b8611c764 := 'Sale | Return | Cancellation | Amendment | AccountCredit. Non-Sale types are the correction/reversal document family (BO-D9/D15). AccountCredit is a DELIBERATELY ISSUED credit document; an ordinary Sale order can also carry a credit balance simply by being over-paid, and both are spendable through the Account Credit payment type (D68).';
  p_Sequence_456b8611c764 := 3;
  p_SQLBaseType_456b8611c764 := 'nvarchar';
  p_SQLFullType_456b8611c764 := 'nvarchar(20)';
  p_SourceEntityID_456b8611c764 := 'FC529BC8-FF09-44A9-B454-26EAFDAC791B';
  p_SourceFieldName_456b8611c764 := 'OrderType';
  p_IsComputed_456b8611c764 := FALSE;
  p_IsSummary_456b8611c764 := FALSE;
  p_DetectionMethod_456b8611c764 := 'Database';
  p_SourceEntityFieldID_456b8611c764 := 'C7C1BD22-6968-499B-9FFA-1931BEB97C0C';
  p_IsNullable_456b8611c764 := FALSE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_456b8611c764 := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_456b8611c764 AND "Name" = p_SourceFieldName_456b8611c764
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_456b8611c764 THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_456b8611c764
                    OR ("QueryID" = p_QueryID_456b8611c764 AND "Name" = p_Name_456b8611c764)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_456b8611c764,
    'QueryID', p_QueryID_456b8611c764,
    'Name', p_Name_456b8611c764,
    'Description', p_Description_456b8611c764,
    'Sequence', p_Sequence_456b8611c764,
    'SQLBaseType', p_SQLBaseType_456b8611c764,
    'SQLFullType', p_SQLFullType_456b8611c764,
    'SourceEntityID', p_SourceEntityID_456b8611c764,
    'SourceFieldName', p_SourceFieldName_456b8611c764,
    'IsComputed', p_IsComputed_456b8611c764,
    'ComputationDescription', p_ComputationDescription_456b8611c764,
    'IsSummary', p_IsSummary_456b8611c764,
    'SummaryDescription', p_SummaryDescription_456b8611c764,
    'DetectionMethod', p_DetectionMethod_456b8611c764,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_456b8611c764,
    'SourceEntityFieldID', p_SourceEntityFieldID_456b8611c764,
    'IsNullable', p_IsNullable_456b8611c764,
    'SourceObjectName', p_SourceObjectName_456b8611c764
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_456b8611c764, p_QueryID := p_QueryID_456b8611c764, p_Name := p_Name_456b8611c764, p_Description := p_Description_456b8611c764, p_Sequence := p_Sequence_456b8611c764, p_SQLBaseType := p_SQLBaseType_456b8611c764, p_SQLFullType := p_SQLFullType_456b8611c764, p_SourceEntityID := p_SourceEntityID_456b8611c764, p_SourceFieldName := p_SourceFieldName_456b8611c764, p_IsComputed := p_IsComputed_456b8611c764, p_ComputationDescription := p_ComputationDescription_456b8611c764, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_456b8611c764, p_SummaryDescription := p_SummaryDescription_456b8611c764, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_456b8611c764, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_456b8611c764, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_456b8611c764, p_IsNullable := p_IsNullable_456b8611c764, p_SourceObjectName := p_SourceObjectName_456b8611c764, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_b3eda0508a03 UUID;
  p_QueryID_b3eda0508a03 UUID;
  p_Name_b3eda0508a03 VARCHAR(255);
  p_Description_b3eda0508a03 TEXT;
  p_Sequence_b3eda0508a03 INTEGER;
  p_SQLBaseType_b3eda0508a03 VARCHAR(50);
  p_SQLFullType_b3eda0508a03 VARCHAR(100);
  p_SourceEntityID_b3eda0508a03 UUID;
  p_SourceFieldName_b3eda0508a03 VARCHAR(255);
  p_IsComputed_b3eda0508a03 BOOLEAN;
  p_ComputationDescription_b3eda0508a03 TEXT;
  p_IsSummary_b3eda0508a03 BOOLEAN;
  p_SummaryDescription_b3eda0508a03 TEXT;
  p_DetectionMethod_b3eda0508a03 VARCHAR(50);
  p_AutoDetectConfidenceScore_b3eda0508a03 NUMERIC(3,2);
  p_SourceEntityFieldID_b3eda0508a03 UUID;
  p_IsNullable_b3eda0508a03 BOOLEAN;
  p_SourceObjectName_b3eda0508a03 VARCHAR(500);
BEGIN
  p_ID_b3eda0508a03 := 'a297e981-afe1-49a8-ae6d-8760c1fb600d';
  p_QueryID_b3eda0508a03 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_b3eda0508a03 := 'OrderDate';
  p_Description_b3eda0508a03 := 'Effective date of the order; used as the journal entry EffectiveDate and the as-of date for GL-account link resolution.';
  p_Sequence_b3eda0508a03 := 4;
  p_SQLBaseType_b3eda0508a03 := 'date';
  p_SQLFullType_b3eda0508a03 := 'date';
  p_SourceEntityID_b3eda0508a03 := 'FC529BC8-FF09-44A9-B454-26EAFDAC791B';
  p_SourceFieldName_b3eda0508a03 := 'OrderDate';
  p_IsComputed_b3eda0508a03 := FALSE;
  p_IsSummary_b3eda0508a03 := FALSE;
  p_DetectionMethod_b3eda0508a03 := 'Database';
  p_SourceEntityFieldID_b3eda0508a03 := '41E3A5E2-F717-4220-AC33-8ABC132F8DD0';
  p_IsNullable_b3eda0508a03 := FALSE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_b3eda0508a03 := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_b3eda0508a03 AND "Name" = p_SourceFieldName_b3eda0508a03
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_b3eda0508a03 THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_b3eda0508a03
                    OR ("QueryID" = p_QueryID_b3eda0508a03 AND "Name" = p_Name_b3eda0508a03)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_b3eda0508a03,
    'QueryID', p_QueryID_b3eda0508a03,
    'Name', p_Name_b3eda0508a03,
    'Description', p_Description_b3eda0508a03,
    'Sequence', p_Sequence_b3eda0508a03,
    'SQLBaseType', p_SQLBaseType_b3eda0508a03,
    'SQLFullType', p_SQLFullType_b3eda0508a03,
    'SourceEntityID', p_SourceEntityID_b3eda0508a03,
    'SourceFieldName', p_SourceFieldName_b3eda0508a03,
    'IsComputed', p_IsComputed_b3eda0508a03,
    'ComputationDescription', p_ComputationDescription_b3eda0508a03,
    'IsSummary', p_IsSummary_b3eda0508a03,
    'SummaryDescription', p_SummaryDescription_b3eda0508a03,
    'DetectionMethod', p_DetectionMethod_b3eda0508a03,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_b3eda0508a03,
    'SourceEntityFieldID', p_SourceEntityFieldID_b3eda0508a03,
    'IsNullable', p_IsNullable_b3eda0508a03,
    'SourceObjectName', p_SourceObjectName_b3eda0508a03
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_b3eda0508a03, p_QueryID := p_QueryID_b3eda0508a03, p_Name := p_Name_b3eda0508a03, p_Description := p_Description_b3eda0508a03, p_Sequence := p_Sequence_b3eda0508a03, p_SQLBaseType := p_SQLBaseType_b3eda0508a03, p_SQLFullType := p_SQLFullType_b3eda0508a03, p_SourceEntityID := p_SourceEntityID_b3eda0508a03, p_SourceFieldName := p_SourceFieldName_b3eda0508a03, p_IsComputed := p_IsComputed_b3eda0508a03, p_ComputationDescription := p_ComputationDescription_b3eda0508a03, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_b3eda0508a03, p_SummaryDescription := p_SummaryDescription_b3eda0508a03, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_b3eda0508a03, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_b3eda0508a03, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_b3eda0508a03, p_IsNullable := p_IsNullable_b3eda0508a03, p_SourceObjectName := p_SourceObjectName_b3eda0508a03, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_8e66273a4ad7 UUID;
  p_QueryID_8e66273a4ad7 UUID;
  p_Name_8e66273a4ad7 VARCHAR(255);
  p_Description_8e66273a4ad7 TEXT;
  p_Sequence_8e66273a4ad7 INTEGER;
  p_SQLBaseType_8e66273a4ad7 VARCHAR(50);
  p_SQLFullType_8e66273a4ad7 VARCHAR(100);
  p_SourceEntityID_8e66273a4ad7 UUID;
  p_SourceFieldName_8e66273a4ad7 VARCHAR(255);
  p_IsComputed_8e66273a4ad7 BOOLEAN;
  p_ComputationDescription_8e66273a4ad7 TEXT;
  p_IsSummary_8e66273a4ad7 BOOLEAN;
  p_SummaryDescription_8e66273a4ad7 TEXT;
  p_DetectionMethod_8e66273a4ad7 VARCHAR(50);
  p_AutoDetectConfidenceScore_8e66273a4ad7 NUMERIC(3,2);
  p_SourceEntityFieldID_8e66273a4ad7 UUID;
  p_IsNullable_8e66273a4ad7 BOOLEAN;
  p_SourceObjectName_8e66273a4ad7 VARCHAR(500);
BEGIN
  p_ID_8e66273a4ad7 := '411d4ea8-6f5c-4c85-b96b-0640c223d519';
  p_QueryID_8e66273a4ad7 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_8e66273a4ad7 := 'ConfirmedAt';
  p_Description_8e66273a4ad7 := 'UTC timestamp of the first transition to Confirmed.';
  p_Sequence_8e66273a4ad7 := 5;
  p_SQLBaseType_8e66273a4ad7 := 'datetimeoffset';
  p_SQLFullType_8e66273a4ad7 := 'datetimeoffset(7)';
  p_SourceEntityID_8e66273a4ad7 := 'FC529BC8-FF09-44A9-B454-26EAFDAC791B';
  p_SourceFieldName_8e66273a4ad7 := 'ConfirmedAt';
  p_IsComputed_8e66273a4ad7 := FALSE;
  p_IsSummary_8e66273a4ad7 := FALSE;
  p_DetectionMethod_8e66273a4ad7 := 'Database';
  p_SourceEntityFieldID_8e66273a4ad7 := '565015DD-BE0A-4024-BF1F-6CB2A147A5C9';
  p_IsNullable_8e66273a4ad7 := TRUE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_8e66273a4ad7 := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_8e66273a4ad7 AND "Name" = p_SourceFieldName_8e66273a4ad7
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_8e66273a4ad7 THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_8e66273a4ad7
                    OR ("QueryID" = p_QueryID_8e66273a4ad7 AND "Name" = p_Name_8e66273a4ad7)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_8e66273a4ad7,
    'QueryID', p_QueryID_8e66273a4ad7,
    'Name', p_Name_8e66273a4ad7,
    'Description', p_Description_8e66273a4ad7,
    'Sequence', p_Sequence_8e66273a4ad7,
    'SQLBaseType', p_SQLBaseType_8e66273a4ad7,
    'SQLFullType', p_SQLFullType_8e66273a4ad7,
    'SourceEntityID', p_SourceEntityID_8e66273a4ad7,
    'SourceFieldName', p_SourceFieldName_8e66273a4ad7,
    'IsComputed', p_IsComputed_8e66273a4ad7,
    'ComputationDescription', p_ComputationDescription_8e66273a4ad7,
    'IsSummary', p_IsSummary_8e66273a4ad7,
    'SummaryDescription', p_SummaryDescription_8e66273a4ad7,
    'DetectionMethod', p_DetectionMethod_8e66273a4ad7,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_8e66273a4ad7,
    'SourceEntityFieldID', p_SourceEntityFieldID_8e66273a4ad7,
    'IsNullable', p_IsNullable_8e66273a4ad7,
    'SourceObjectName', p_SourceObjectName_8e66273a4ad7
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_8e66273a4ad7, p_QueryID := p_QueryID_8e66273a4ad7, p_Name := p_Name_8e66273a4ad7, p_Description := p_Description_8e66273a4ad7, p_Sequence := p_Sequence_8e66273a4ad7, p_SQLBaseType := p_SQLBaseType_8e66273a4ad7, p_SQLFullType := p_SQLFullType_8e66273a4ad7, p_SourceEntityID := p_SourceEntityID_8e66273a4ad7, p_SourceFieldName := p_SourceFieldName_8e66273a4ad7, p_IsComputed := p_IsComputed_8e66273a4ad7, p_ComputationDescription := p_ComputationDescription_8e66273a4ad7, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_8e66273a4ad7, p_SummaryDescription := p_SummaryDescription_8e66273a4ad7, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_8e66273a4ad7, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_8e66273a4ad7, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_8e66273a4ad7, p_IsNullable := p_IsNullable_8e66273a4ad7, p_SourceObjectName := p_SourceObjectName_8e66273a4ad7, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_efaff430ccdc UUID;
  p_QueryID_efaff430ccdc UUID;
  p_Name_efaff430ccdc VARCHAR(255);
  p_Description_efaff430ccdc TEXT;
  p_Sequence_efaff430ccdc INTEGER;
  p_SQLBaseType_efaff430ccdc VARCHAR(50);
  p_SQLFullType_efaff430ccdc VARCHAR(100);
  p_SourceEntityID_efaff430ccdc UUID;
  p_SourceFieldName_efaff430ccdc VARCHAR(255);
  p_IsComputed_efaff430ccdc BOOLEAN;
  p_ComputationDescription_efaff430ccdc TEXT;
  p_IsSummary_efaff430ccdc BOOLEAN;
  p_SummaryDescription_efaff430ccdc TEXT;
  p_DetectionMethod_efaff430ccdc VARCHAR(50);
  p_AutoDetectConfidenceScore_efaff430ccdc NUMERIC(3,2);
  p_SourceEntityFieldID_efaff430ccdc UUID;
  p_IsNullable_efaff430ccdc BOOLEAN;
  p_SourceObjectName_efaff430ccdc VARCHAR(500);
BEGIN
  p_ID_efaff430ccdc := '748767da-b5a5-4e08-b00a-aae85f4978dc';
  p_QueryID_efaff430ccdc := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_efaff430ccdc := 'CompanyID';
  p_Description_efaff430ccdc := 'The ORIGINATING/owning company (D6): document, visibility, and sales-attribution anchor (pairs with SalesRepUserID). NEVER used for GL resolution — revenue company is per line via the product''s company. FK to __mj.Company.';
  p_Sequence_efaff430ccdc := 6;
  p_SQLBaseType_efaff430ccdc := 'uniqueidentifier';
  p_SQLFullType_efaff430ccdc := 'uniqueidentifier';
  p_SourceEntityID_efaff430ccdc := 'FC529BC8-FF09-44A9-B454-26EAFDAC791B';
  p_SourceFieldName_efaff430ccdc := 'CompanyID';
  p_IsComputed_efaff430ccdc := FALSE;
  p_IsSummary_efaff430ccdc := FALSE;
  p_DetectionMethod_efaff430ccdc := 'Database';
  p_SourceEntityFieldID_efaff430ccdc := '197A4A78-E556-465F-9B0E-FE0F68653B48';
  p_IsNullable_efaff430ccdc := FALSE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_efaff430ccdc := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_efaff430ccdc AND "Name" = p_SourceFieldName_efaff430ccdc
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_efaff430ccdc THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_efaff430ccdc
                    OR ("QueryID" = p_QueryID_efaff430ccdc AND "Name" = p_Name_efaff430ccdc)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_efaff430ccdc,
    'QueryID', p_QueryID_efaff430ccdc,
    'Name', p_Name_efaff430ccdc,
    'Description', p_Description_efaff430ccdc,
    'Sequence', p_Sequence_efaff430ccdc,
    'SQLBaseType', p_SQLBaseType_efaff430ccdc,
    'SQLFullType', p_SQLFullType_efaff430ccdc,
    'SourceEntityID', p_SourceEntityID_efaff430ccdc,
    'SourceFieldName', p_SourceFieldName_efaff430ccdc,
    'IsComputed', p_IsComputed_efaff430ccdc,
    'ComputationDescription', p_ComputationDescription_efaff430ccdc,
    'IsSummary', p_IsSummary_efaff430ccdc,
    'SummaryDescription', p_SummaryDescription_efaff430ccdc,
    'DetectionMethod', p_DetectionMethod_efaff430ccdc,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_efaff430ccdc,
    'SourceEntityFieldID', p_SourceEntityFieldID_efaff430ccdc,
    'IsNullable', p_IsNullable_efaff430ccdc,
    'SourceObjectName', p_SourceObjectName_efaff430ccdc
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_efaff430ccdc, p_QueryID := p_QueryID_efaff430ccdc, p_Name := p_Name_efaff430ccdc, p_Description := p_Description_efaff430ccdc, p_Sequence := p_Sequence_efaff430ccdc, p_SQLBaseType := p_SQLBaseType_efaff430ccdc, p_SQLFullType := p_SQLFullType_efaff430ccdc, p_SourceEntityID := p_SourceEntityID_efaff430ccdc, p_SourceFieldName := p_SourceFieldName_efaff430ccdc, p_IsComputed := p_IsComputed_efaff430ccdc, p_ComputationDescription := p_ComputationDescription_efaff430ccdc, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_efaff430ccdc, p_SummaryDescription := p_SummaryDescription_efaff430ccdc, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_efaff430ccdc, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_efaff430ccdc, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_efaff430ccdc, p_IsNullable := p_IsNullable_efaff430ccdc, p_SourceObjectName := p_SourceObjectName_efaff430ccdc, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_ec38d97c1167 UUID;
  p_QueryID_ec38d97c1167 UUID;
  p_Name_ec38d97c1167 VARCHAR(255);
  p_Description_ec38d97c1167 TEXT;
  p_Sequence_ec38d97c1167 INTEGER;
  p_SQLBaseType_ec38d97c1167 VARCHAR(50);
  p_SQLFullType_ec38d97c1167 VARCHAR(100);
  p_SourceEntityID_ec38d97c1167 UUID;
  p_SourceFieldName_ec38d97c1167 VARCHAR(255);
  p_IsComputed_ec38d97c1167 BOOLEAN;
  p_ComputationDescription_ec38d97c1167 TEXT;
  p_IsSummary_ec38d97c1167 BOOLEAN;
  p_SummaryDescription_ec38d97c1167 TEXT;
  p_DetectionMethod_ec38d97c1167 VARCHAR(50);
  p_AutoDetectConfidenceScore_ec38d97c1167 NUMERIC(3,2);
  p_SourceEntityFieldID_ec38d97c1167 UUID;
  p_IsNullable_ec38d97c1167 BOOLEAN;
  p_SourceObjectName_ec38d97c1167 VARCHAR(500);
BEGIN
  p_ID_ec38d97c1167 := '1daaf027-acf4-4994-a1c0-c136f79811b0';
  p_QueryID_ec38d97c1167 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_ec38d97c1167 := 'CompanyName';
  p_Sequence_ec38d97c1167 := 7;
  p_SQLBaseType_ec38d97c1167 := 'nvarchar';
  p_SQLFullType_ec38d97c1167 := 'nvarchar(50)';
  p_SourceEntityID_ec38d97c1167 := 'FC529BC8-FF09-44A9-B454-26EAFDAC791B';
  p_SourceFieldName_ec38d97c1167 := 'Company';
  p_IsComputed_ec38d97c1167 := FALSE;
  p_IsSummary_ec38d97c1167 := FALSE;
  p_DetectionMethod_ec38d97c1167 := 'Database';
  p_SourceEntityFieldID_ec38d97c1167 := '54079149-DE80-4CEE-B857-AE5ADFFD41A6';
  p_IsNullable_ec38d97c1167 := FALSE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_ec38d97c1167 := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_ec38d97c1167 AND "Name" = p_SourceFieldName_ec38d97c1167
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_ec38d97c1167 THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_ec38d97c1167
                    OR ("QueryID" = p_QueryID_ec38d97c1167 AND "Name" = p_Name_ec38d97c1167)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_ec38d97c1167,
    'QueryID', p_QueryID_ec38d97c1167,
    'Name', p_Name_ec38d97c1167,
    'Description', p_Description_ec38d97c1167,
    'Sequence', p_Sequence_ec38d97c1167,
    'SQLBaseType', p_SQLBaseType_ec38d97c1167,
    'SQLFullType', p_SQLFullType_ec38d97c1167,
    'SourceEntityID', p_SourceEntityID_ec38d97c1167,
    'SourceFieldName', p_SourceFieldName_ec38d97c1167,
    'IsComputed', p_IsComputed_ec38d97c1167,
    'ComputationDescription', p_ComputationDescription_ec38d97c1167,
    'IsSummary', p_IsSummary_ec38d97c1167,
    'SummaryDescription', p_SummaryDescription_ec38d97c1167,
    'DetectionMethod', p_DetectionMethod_ec38d97c1167,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_ec38d97c1167,
    'SourceEntityFieldID', p_SourceEntityFieldID_ec38d97c1167,
    'IsNullable', p_IsNullable_ec38d97c1167,
    'SourceObjectName', p_SourceObjectName_ec38d97c1167
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_ec38d97c1167, p_QueryID := p_QueryID_ec38d97c1167, p_Name := p_Name_ec38d97c1167, p_Description := p_Description_ec38d97c1167, p_Description_Clear := TRUE, p_Sequence := p_Sequence_ec38d97c1167, p_SQLBaseType := p_SQLBaseType_ec38d97c1167, p_SQLFullType := p_SQLFullType_ec38d97c1167, p_SourceEntityID := p_SourceEntityID_ec38d97c1167, p_SourceFieldName := p_SourceFieldName_ec38d97c1167, p_IsComputed := p_IsComputed_ec38d97c1167, p_ComputationDescription := p_ComputationDescription_ec38d97c1167, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_ec38d97c1167, p_SummaryDescription := p_SummaryDescription_ec38d97c1167, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_ec38d97c1167, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_ec38d97c1167, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_ec38d97c1167, p_IsNullable := p_IsNullable_ec38d97c1167, p_SourceObjectName := p_SourceObjectName_ec38d97c1167, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_6b41248e6550 UUID;
  p_QueryID_6b41248e6550 UUID;
  p_Name_6b41248e6550 VARCHAR(255);
  p_Description_6b41248e6550 TEXT;
  p_Sequence_6b41248e6550 INTEGER;
  p_SQLBaseType_6b41248e6550 VARCHAR(50);
  p_SQLFullType_6b41248e6550 VARCHAR(100);
  p_SourceEntityID_6b41248e6550 UUID;
  p_SourceFieldName_6b41248e6550 VARCHAR(255);
  p_IsComputed_6b41248e6550 BOOLEAN;
  p_ComputationDescription_6b41248e6550 TEXT;
  p_IsSummary_6b41248e6550 BOOLEAN;
  p_SummaryDescription_6b41248e6550 TEXT;
  p_DetectionMethod_6b41248e6550 VARCHAR(50);
  p_AutoDetectConfidenceScore_6b41248e6550 NUMERIC(3,2);
  p_SourceEntityFieldID_6b41248e6550 UUID;
  p_IsNullable_6b41248e6550 BOOLEAN;
  p_SourceObjectName_6b41248e6550 VARCHAR(500);
BEGIN
  p_ID_6b41248e6550 := '43db15d9-c756-4f38-aa23-731f93e484e9';
  p_QueryID_6b41248e6550 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_6b41248e6550 := 'CustomerName';
  p_Sequence_6b41248e6550 := 8;
  p_SQLBaseType_6b41248e6550 := 'nvarchar';
  p_SQLFullType_6b41248e6550 := 'nvarchar(255)';
  p_IsComputed_6b41248e6550 := TRUE;
  p_IsSummary_6b41248e6550 := FALSE;
  p_DetectionMethod_6b41248e6550 := 'Database';
  p_IsNullable_6b41248e6550 := TRUE;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_6b41248e6550
                    OR ("QueryID" = p_QueryID_6b41248e6550 AND "Name" = p_Name_6b41248e6550)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_6b41248e6550,
    'QueryID', p_QueryID_6b41248e6550,
    'Name', p_Name_6b41248e6550,
    'Description', p_Description_6b41248e6550,
    'Sequence', p_Sequence_6b41248e6550,
    'SQLBaseType', p_SQLBaseType_6b41248e6550,
    'SQLFullType', p_SQLFullType_6b41248e6550,
    'SourceEntityID', p_SourceEntityID_6b41248e6550,
    'SourceFieldName', p_SourceFieldName_6b41248e6550,
    'IsComputed', p_IsComputed_6b41248e6550,
    'ComputationDescription', p_ComputationDescription_6b41248e6550,
    'IsSummary', p_IsSummary_6b41248e6550,
    'SummaryDescription', p_SummaryDescription_6b41248e6550,
    'DetectionMethod', p_DetectionMethod_6b41248e6550,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_6b41248e6550,
    'SourceEntityFieldID', p_SourceEntityFieldID_6b41248e6550,
    'IsNullable', p_IsNullable_6b41248e6550,
    'SourceObjectName', p_SourceObjectName_6b41248e6550
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_6b41248e6550, p_QueryID := p_QueryID_6b41248e6550, p_Name := p_Name_6b41248e6550, p_Description := p_Description_6b41248e6550, p_Description_Clear := TRUE, p_Sequence := p_Sequence_6b41248e6550, p_SQLBaseType := p_SQLBaseType_6b41248e6550, p_SQLFullType := p_SQLFullType_6b41248e6550, p_SourceEntityID := p_SourceEntityID_6b41248e6550, p_SourceEntityID_Clear := TRUE, p_SourceFieldName := p_SourceFieldName_6b41248e6550, p_SourceFieldName_Clear := TRUE, p_IsComputed := p_IsComputed_6b41248e6550, p_ComputationDescription := p_ComputationDescription_6b41248e6550, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_6b41248e6550, p_SummaryDescription := p_SummaryDescription_6b41248e6550, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_6b41248e6550, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_6b41248e6550, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_6b41248e6550, p_SourceEntityFieldID_Clear := TRUE, p_IsNullable := p_IsNullable_6b41248e6550, p_SourceObjectName := p_SourceObjectName_6b41248e6550, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_6dd2ec82dde8 UUID;
  p_QueryID_6dd2ec82dde8 UUID;
  p_Name_6dd2ec82dde8 VARCHAR(255);
  p_Description_6dd2ec82dde8 TEXT;
  p_Sequence_6dd2ec82dde8 INTEGER;
  p_SQLBaseType_6dd2ec82dde8 VARCHAR(50);
  p_SQLFullType_6dd2ec82dde8 VARCHAR(100);
  p_SourceEntityID_6dd2ec82dde8 UUID;
  p_SourceFieldName_6dd2ec82dde8 VARCHAR(255);
  p_IsComputed_6dd2ec82dde8 BOOLEAN;
  p_ComputationDescription_6dd2ec82dde8 TEXT;
  p_IsSummary_6dd2ec82dde8 BOOLEAN;
  p_SummaryDescription_6dd2ec82dde8 TEXT;
  p_DetectionMethod_6dd2ec82dde8 VARCHAR(50);
  p_AutoDetectConfidenceScore_6dd2ec82dde8 NUMERIC(3,2);
  p_SourceEntityFieldID_6dd2ec82dde8 UUID;
  p_IsNullable_6dd2ec82dde8 BOOLEAN;
  p_SourceObjectName_6dd2ec82dde8 VARCHAR(500);
BEGIN
  p_ID_6dd2ec82dde8 := 'eb934ead-e286-428b-901d-be904e55fcc2';
  p_QueryID_6dd2ec82dde8 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_6dd2ec82dde8 := 'TotalGross';
  p_Description_6dd2ec82dde8 := 'Engine-materialized order total = SUM(OrderLine.LineTotalGross). Never user-entered; frozen after Confirm.';
  p_Sequence_6dd2ec82dde8 := 9;
  p_SQLBaseType_6dd2ec82dde8 := 'decimal';
  p_SQLFullType_6dd2ec82dde8 := 'decimal(18,2)';
  p_SourceEntityID_6dd2ec82dde8 := 'FC529BC8-FF09-44A9-B454-26EAFDAC791B';
  p_SourceFieldName_6dd2ec82dde8 := 'TotalGross';
  p_IsComputed_6dd2ec82dde8 := FALSE;
  p_IsSummary_6dd2ec82dde8 := FALSE;
  p_DetectionMethod_6dd2ec82dde8 := 'Database';
  p_SourceEntityFieldID_6dd2ec82dde8 := '7AEB02A2-1574-4FC4-ADF1-299328154295';
  p_IsNullable_6dd2ec82dde8 := TRUE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_6dd2ec82dde8 := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_6dd2ec82dde8 AND "Name" = p_SourceFieldName_6dd2ec82dde8
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_6dd2ec82dde8 THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_6dd2ec82dde8
                    OR ("QueryID" = p_QueryID_6dd2ec82dde8 AND "Name" = p_Name_6dd2ec82dde8)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_6dd2ec82dde8,
    'QueryID', p_QueryID_6dd2ec82dde8,
    'Name', p_Name_6dd2ec82dde8,
    'Description', p_Description_6dd2ec82dde8,
    'Sequence', p_Sequence_6dd2ec82dde8,
    'SQLBaseType', p_SQLBaseType_6dd2ec82dde8,
    'SQLFullType', p_SQLFullType_6dd2ec82dde8,
    'SourceEntityID', p_SourceEntityID_6dd2ec82dde8,
    'SourceFieldName', p_SourceFieldName_6dd2ec82dde8,
    'IsComputed', p_IsComputed_6dd2ec82dde8,
    'ComputationDescription', p_ComputationDescription_6dd2ec82dde8,
    'IsSummary', p_IsSummary_6dd2ec82dde8,
    'SummaryDescription', p_SummaryDescription_6dd2ec82dde8,
    'DetectionMethod', p_DetectionMethod_6dd2ec82dde8,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_6dd2ec82dde8,
    'SourceEntityFieldID', p_SourceEntityFieldID_6dd2ec82dde8,
    'IsNullable', p_IsNullable_6dd2ec82dde8,
    'SourceObjectName', p_SourceObjectName_6dd2ec82dde8
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_6dd2ec82dde8, p_QueryID := p_QueryID_6dd2ec82dde8, p_Name := p_Name_6dd2ec82dde8, p_Description := p_Description_6dd2ec82dde8, p_Sequence := p_Sequence_6dd2ec82dde8, p_SQLBaseType := p_SQLBaseType_6dd2ec82dde8, p_SQLFullType := p_SQLFullType_6dd2ec82dde8, p_SourceEntityID := p_SourceEntityID_6dd2ec82dde8, p_SourceFieldName := p_SourceFieldName_6dd2ec82dde8, p_IsComputed := p_IsComputed_6dd2ec82dde8, p_ComputationDescription := p_ComputationDescription_6dd2ec82dde8, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_6dd2ec82dde8, p_SummaryDescription := p_SummaryDescription_6dd2ec82dde8, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_6dd2ec82dde8, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_6dd2ec82dde8, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_6dd2ec82dde8, p_IsNullable := p_IsNullable_6dd2ec82dde8, p_SourceObjectName := p_SourceObjectName_6dd2ec82dde8, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_db2f27c049ed UUID;
  p_QueryID_db2f27c049ed UUID;
  p_Name_db2f27c049ed VARCHAR(255);
  p_Description_db2f27c049ed TEXT;
  p_Sequence_db2f27c049ed INTEGER;
  p_SQLBaseType_db2f27c049ed VARCHAR(50);
  p_SQLFullType_db2f27c049ed VARCHAR(100);
  p_SourceEntityID_db2f27c049ed UUID;
  p_SourceFieldName_db2f27c049ed VARCHAR(255);
  p_IsComputed_db2f27c049ed BOOLEAN;
  p_ComputationDescription_db2f27c049ed TEXT;
  p_IsSummary_db2f27c049ed BOOLEAN;
  p_SummaryDescription_db2f27c049ed TEXT;
  p_DetectionMethod_db2f27c049ed VARCHAR(50);
  p_AutoDetectConfidenceScore_db2f27c049ed NUMERIC(3,2);
  p_SourceEntityFieldID_db2f27c049ed UUID;
  p_IsNullable_db2f27c049ed BOOLEAN;
  p_SourceObjectName_db2f27c049ed VARCHAR(500);
BEGIN
  p_ID_db2f27c049ed := '665837cf-a354-45d7-8e1a-b4d79ab46d1b';
  p_QueryID_db2f27c049ed := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_db2f27c049ed := 'Balance';
  p_Description_db2f27c049ed := 'Engine-materialized open balance = TotalGross - AmountPaid. Negative means a credit memo owed to the customer.';
  p_Sequence_db2f27c049ed := 10;
  p_SQLBaseType_db2f27c049ed := 'decimal';
  p_SQLFullType_db2f27c049ed := 'decimal(18,2)';
  p_SourceEntityID_db2f27c049ed := 'FC529BC8-FF09-44A9-B454-26EAFDAC791B';
  p_SourceFieldName_db2f27c049ed := 'Balance';
  p_IsComputed_db2f27c049ed := FALSE;
  p_IsSummary_db2f27c049ed := FALSE;
  p_DetectionMethod_db2f27c049ed := 'Database';
  p_SourceEntityFieldID_db2f27c049ed := 'B66538B2-A77C-4B69-9B58-30D0D2016CC4';
  p_IsNullable_db2f27c049ed := TRUE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_db2f27c049ed := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_db2f27c049ed AND "Name" = p_SourceFieldName_db2f27c049ed
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_db2f27c049ed THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_db2f27c049ed
                    OR ("QueryID" = p_QueryID_db2f27c049ed AND "Name" = p_Name_db2f27c049ed)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_db2f27c049ed,
    'QueryID', p_QueryID_db2f27c049ed,
    'Name', p_Name_db2f27c049ed,
    'Description', p_Description_db2f27c049ed,
    'Sequence', p_Sequence_db2f27c049ed,
    'SQLBaseType', p_SQLBaseType_db2f27c049ed,
    'SQLFullType', p_SQLFullType_db2f27c049ed,
    'SourceEntityID', p_SourceEntityID_db2f27c049ed,
    'SourceFieldName', p_SourceFieldName_db2f27c049ed,
    'IsComputed', p_IsComputed_db2f27c049ed,
    'ComputationDescription', p_ComputationDescription_db2f27c049ed,
    'IsSummary', p_IsSummary_db2f27c049ed,
    'SummaryDescription', p_SummaryDescription_db2f27c049ed,
    'DetectionMethod', p_DetectionMethod_db2f27c049ed,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_db2f27c049ed,
    'SourceEntityFieldID', p_SourceEntityFieldID_db2f27c049ed,
    'IsNullable', p_IsNullable_db2f27c049ed,
    'SourceObjectName', p_SourceObjectName_db2f27c049ed
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_db2f27c049ed, p_QueryID := p_QueryID_db2f27c049ed, p_Name := p_Name_db2f27c049ed, p_Description := p_Description_db2f27c049ed, p_Sequence := p_Sequence_db2f27c049ed, p_SQLBaseType := p_SQLBaseType_db2f27c049ed, p_SQLFullType := p_SQLFullType_db2f27c049ed, p_SourceEntityID := p_SourceEntityID_db2f27c049ed, p_SourceFieldName := p_SourceFieldName_db2f27c049ed, p_IsComputed := p_IsComputed_db2f27c049ed, p_ComputationDescription := p_ComputationDescription_db2f27c049ed, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_db2f27c049ed, p_SummaryDescription := p_SummaryDescription_db2f27c049ed, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_db2f27c049ed, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_db2f27c049ed, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_db2f27c049ed, p_IsNullable := p_IsNullable_db2f27c049ed, p_SourceObjectName := p_SourceObjectName_db2f27c049ed, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_302d8d081857 UUID;
  p_QueryID_302d8d081857 UUID;
  p_Name_302d8d081857 VARCHAR(255);
  p_Description_302d8d081857 TEXT;
  p_Sequence_302d8d081857 INTEGER;
  p_SQLBaseType_302d8d081857 VARCHAR(50);
  p_SQLFullType_302d8d081857 VARCHAR(100);
  p_SourceEntityID_302d8d081857 UUID;
  p_SourceFieldName_302d8d081857 VARCHAR(255);
  p_IsComputed_302d8d081857 BOOLEAN;
  p_ComputationDescription_302d8d081857 TEXT;
  p_IsSummary_302d8d081857 BOOLEAN;
  p_SummaryDescription_302d8d081857 TEXT;
  p_DetectionMethod_302d8d081857 VARCHAR(50);
  p_AutoDetectConfidenceScore_302d8d081857 NUMERIC(3,2);
  p_SourceEntityFieldID_302d8d081857 UUID;
  p_IsNullable_302d8d081857 BOOLEAN;
  p_SourceObjectName_302d8d081857 VARCHAR(500);
BEGIN
  p_ID_302d8d081857 := '61684fc2-131f-45d3-8281-34a7b4d08b28';
  p_QueryID_302d8d081857 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_302d8d081857 := 'SalesRepName';
  p_Sequence_302d8d081857 := 11;
  p_SQLBaseType_302d8d081857 := 'nvarchar';
  p_SQLFullType_302d8d081857 := 'nvarchar(100)';
  p_SourceEntityID_302d8d081857 := 'FC529BC8-FF09-44A9-B454-26EAFDAC791B';
  p_SourceFieldName_302d8d081857 := 'SalesRepUser';
  p_IsComputed_302d8d081857 := FALSE;
  p_IsSummary_302d8d081857 := FALSE;
  p_DetectionMethod_302d8d081857 := 'Database';
  p_SourceEntityFieldID_302d8d081857 := 'B0F46D44-A139-4CBB-8737-8265D5052238';
  p_IsNullable_302d8d081857 := TRUE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_302d8d081857 := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_302d8d081857 AND "Name" = p_SourceFieldName_302d8d081857
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_302d8d081857 THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_302d8d081857
                    OR ("QueryID" = p_QueryID_302d8d081857 AND "Name" = p_Name_302d8d081857)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_302d8d081857,
    'QueryID', p_QueryID_302d8d081857,
    'Name', p_Name_302d8d081857,
    'Description', p_Description_302d8d081857,
    'Sequence', p_Sequence_302d8d081857,
    'SQLBaseType', p_SQLBaseType_302d8d081857,
    'SQLFullType', p_SQLFullType_302d8d081857,
    'SourceEntityID', p_SourceEntityID_302d8d081857,
    'SourceFieldName', p_SourceFieldName_302d8d081857,
    'IsComputed', p_IsComputed_302d8d081857,
    'ComputationDescription', p_ComputationDescription_302d8d081857,
    'IsSummary', p_IsSummary_302d8d081857,
    'SummaryDescription', p_SummaryDescription_302d8d081857,
    'DetectionMethod', p_DetectionMethod_302d8d081857,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_302d8d081857,
    'SourceEntityFieldID', p_SourceEntityFieldID_302d8d081857,
    'IsNullable', p_IsNullable_302d8d081857,
    'SourceObjectName', p_SourceObjectName_302d8d081857
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_302d8d081857, p_QueryID := p_QueryID_302d8d081857, p_Name := p_Name_302d8d081857, p_Description := p_Description_302d8d081857, p_Description_Clear := TRUE, p_Sequence := p_Sequence_302d8d081857, p_SQLBaseType := p_SQLBaseType_302d8d081857, p_SQLFullType := p_SQLFullType_302d8d081857, p_SourceEntityID := p_SourceEntityID_302d8d081857, p_SourceFieldName := p_SourceFieldName_302d8d081857, p_IsComputed := p_IsComputed_302d8d081857, p_ComputationDescription := p_ComputationDescription_302d8d081857, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_302d8d081857, p_SummaryDescription := p_SummaryDescription_302d8d081857, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_302d8d081857, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_302d8d081857, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_302d8d081857, p_IsNullable := p_IsNullable_302d8d081857, p_SourceObjectName := p_SourceObjectName_302d8d081857, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_68a1a3b41e59 UUID;
  p_QueryID_68a1a3b41e59 UUID;
  p_Name_68a1a3b41e59 VARCHAR(255);
  p_Description_68a1a3b41e59 TEXT;
  p_Sequence_68a1a3b41e59 INTEGER;
  p_SQLBaseType_68a1a3b41e59 VARCHAR(50);
  p_SQLFullType_68a1a3b41e59 VARCHAR(100);
  p_SourceEntityID_68a1a3b41e59 UUID;
  p_SourceFieldName_68a1a3b41e59 VARCHAR(255);
  p_IsComputed_68a1a3b41e59 BOOLEAN;
  p_ComputationDescription_68a1a3b41e59 TEXT;
  p_IsSummary_68a1a3b41e59 BOOLEAN;
  p_SummaryDescription_68a1a3b41e59 TEXT;
  p_DetectionMethod_68a1a3b41e59 VARCHAR(50);
  p_AutoDetectConfidenceScore_68a1a3b41e59 NUMERIC(3,2);
  p_SourceEntityFieldID_68a1a3b41e59 UUID;
  p_IsNullable_68a1a3b41e59 BOOLEAN;
  p_SourceObjectName_68a1a3b41e59 VARCHAR(500);
BEGIN
  p_ID_68a1a3b41e59 := 'db5a68be-c21a-4a58-a850-2143b6912f19';
  p_QueryID_68a1a3b41e59 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_68a1a3b41e59 := 'DealID';
  p_Sequence_68a1a3b41e59 := 12;
  p_SQLBaseType_68a1a3b41e59 := 'uniqueidentifier';
  p_SQLFullType_68a1a3b41e59 := 'uniqueidentifier';
  p_SourceEntityID_68a1a3b41e59 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_68a1a3b41e59 := 'ID';
  p_IsComputed_68a1a3b41e59 := FALSE;
  p_IsSummary_68a1a3b41e59 := FALSE;
  p_DetectionMethod_68a1a3b41e59 := 'Database';
  p_SourceEntityFieldID_68a1a3b41e59 := '3D52AFFE-C851-46F7-8C49-5263BECB0C9B';
  p_IsNullable_68a1a3b41e59 := TRUE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_68a1a3b41e59 := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_68a1a3b41e59 AND "Name" = p_SourceFieldName_68a1a3b41e59
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_68a1a3b41e59 THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_68a1a3b41e59
                    OR ("QueryID" = p_QueryID_68a1a3b41e59 AND "Name" = p_Name_68a1a3b41e59)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_68a1a3b41e59,
    'QueryID', p_QueryID_68a1a3b41e59,
    'Name', p_Name_68a1a3b41e59,
    'Description', p_Description_68a1a3b41e59,
    'Sequence', p_Sequence_68a1a3b41e59,
    'SQLBaseType', p_SQLBaseType_68a1a3b41e59,
    'SQLFullType', p_SQLFullType_68a1a3b41e59,
    'SourceEntityID', p_SourceEntityID_68a1a3b41e59,
    'SourceFieldName', p_SourceFieldName_68a1a3b41e59,
    'IsComputed', p_IsComputed_68a1a3b41e59,
    'ComputationDescription', p_ComputationDescription_68a1a3b41e59,
    'IsSummary', p_IsSummary_68a1a3b41e59,
    'SummaryDescription', p_SummaryDescription_68a1a3b41e59,
    'DetectionMethod', p_DetectionMethod_68a1a3b41e59,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_68a1a3b41e59,
    'SourceEntityFieldID', p_SourceEntityFieldID_68a1a3b41e59,
    'IsNullable', p_IsNullable_68a1a3b41e59,
    'SourceObjectName', p_SourceObjectName_68a1a3b41e59
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_68a1a3b41e59, p_QueryID := p_QueryID_68a1a3b41e59, p_Name := p_Name_68a1a3b41e59, p_Description := p_Description_68a1a3b41e59, p_Description_Clear := TRUE, p_Sequence := p_Sequence_68a1a3b41e59, p_SQLBaseType := p_SQLBaseType_68a1a3b41e59, p_SQLFullType := p_SQLFullType_68a1a3b41e59, p_SourceEntityID := p_SourceEntityID_68a1a3b41e59, p_SourceFieldName := p_SourceFieldName_68a1a3b41e59, p_IsComputed := p_IsComputed_68a1a3b41e59, p_ComputationDescription := p_ComputationDescription_68a1a3b41e59, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_68a1a3b41e59, p_SummaryDescription := p_SummaryDescription_68a1a3b41e59, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_68a1a3b41e59, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_68a1a3b41e59, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_68a1a3b41e59, p_IsNullable := p_IsNullable_68a1a3b41e59, p_SourceObjectName := p_SourceObjectName_68a1a3b41e59, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_20c3912f5006 UUID;
  p_QueryID_20c3912f5006 UUID;
  p_Name_20c3912f5006 VARCHAR(255);
  p_Description_20c3912f5006 TEXT;
  p_Sequence_20c3912f5006 INTEGER;
  p_SQLBaseType_20c3912f5006 VARCHAR(50);
  p_SQLFullType_20c3912f5006 VARCHAR(100);
  p_SourceEntityID_20c3912f5006 UUID;
  p_SourceFieldName_20c3912f5006 VARCHAR(255);
  p_IsComputed_20c3912f5006 BOOLEAN;
  p_ComputationDescription_20c3912f5006 TEXT;
  p_IsSummary_20c3912f5006 BOOLEAN;
  p_SummaryDescription_20c3912f5006 TEXT;
  p_DetectionMethod_20c3912f5006 VARCHAR(50);
  p_AutoDetectConfidenceScore_20c3912f5006 NUMERIC(3,2);
  p_SourceEntityFieldID_20c3912f5006 UUID;
  p_IsNullable_20c3912f5006 BOOLEAN;
  p_SourceObjectName_20c3912f5006 VARCHAR(500);
BEGIN
  p_ID_20c3912f5006 := 'b88078b8-8e24-4fc9-af75-836c60d2ea8a';
  p_QueryID_20c3912f5006 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_20c3912f5006 := 'DealNumber';
  p_Sequence_20c3912f5006 := 13;
  p_SQLBaseType_20c3912f5006 := 'nvarchar';
  p_SQLFullType_20c3912f5006 := 'nvarchar(50)';
  p_SourceEntityID_20c3912f5006 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_20c3912f5006 := 'DealNumber';
  p_IsComputed_20c3912f5006 := FALSE;
  p_IsSummary_20c3912f5006 := FALSE;
  p_DetectionMethod_20c3912f5006 := 'Database';
  p_SourceEntityFieldID_20c3912f5006 := '939FFD49-39DA-4200-BE2E-906F14FE50E1';
  p_IsNullable_20c3912f5006 := TRUE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_20c3912f5006 := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_20c3912f5006 AND "Name" = p_SourceFieldName_20c3912f5006
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_20c3912f5006 THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_20c3912f5006
                    OR ("QueryID" = p_QueryID_20c3912f5006 AND "Name" = p_Name_20c3912f5006)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_20c3912f5006,
    'QueryID', p_QueryID_20c3912f5006,
    'Name', p_Name_20c3912f5006,
    'Description', p_Description_20c3912f5006,
    'Sequence', p_Sequence_20c3912f5006,
    'SQLBaseType', p_SQLBaseType_20c3912f5006,
    'SQLFullType', p_SQLFullType_20c3912f5006,
    'SourceEntityID', p_SourceEntityID_20c3912f5006,
    'SourceFieldName', p_SourceFieldName_20c3912f5006,
    'IsComputed', p_IsComputed_20c3912f5006,
    'ComputationDescription', p_ComputationDescription_20c3912f5006,
    'IsSummary', p_IsSummary_20c3912f5006,
    'SummaryDescription', p_SummaryDescription_20c3912f5006,
    'DetectionMethod', p_DetectionMethod_20c3912f5006,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_20c3912f5006,
    'SourceEntityFieldID', p_SourceEntityFieldID_20c3912f5006,
    'IsNullable', p_IsNullable_20c3912f5006,
    'SourceObjectName', p_SourceObjectName_20c3912f5006
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_20c3912f5006, p_QueryID := p_QueryID_20c3912f5006, p_Name := p_Name_20c3912f5006, p_Description := p_Description_20c3912f5006, p_Description_Clear := TRUE, p_Sequence := p_Sequence_20c3912f5006, p_SQLBaseType := p_SQLBaseType_20c3912f5006, p_SQLFullType := p_SQLFullType_20c3912f5006, p_SourceEntityID := p_SourceEntityID_20c3912f5006, p_SourceFieldName := p_SourceFieldName_20c3912f5006, p_IsComputed := p_IsComputed_20c3912f5006, p_ComputationDescription := p_ComputationDescription_20c3912f5006, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_20c3912f5006, p_SummaryDescription := p_SummaryDescription_20c3912f5006, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_20c3912f5006, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_20c3912f5006, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_20c3912f5006, p_IsNullable := p_IsNullable_20c3912f5006, p_SourceObjectName := p_SourceObjectName_20c3912f5006, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_c67b1782eb9a UUID;
  p_QueryID_c67b1782eb9a UUID;
  p_Name_c67b1782eb9a VARCHAR(255);
  p_Description_c67b1782eb9a TEXT;
  p_Sequence_c67b1782eb9a INTEGER;
  p_SQLBaseType_c67b1782eb9a VARCHAR(50);
  p_SQLFullType_c67b1782eb9a VARCHAR(100);
  p_SourceEntityID_c67b1782eb9a UUID;
  p_SourceFieldName_c67b1782eb9a VARCHAR(255);
  p_IsComputed_c67b1782eb9a BOOLEAN;
  p_ComputationDescription_c67b1782eb9a TEXT;
  p_IsSummary_c67b1782eb9a BOOLEAN;
  p_SummaryDescription_c67b1782eb9a TEXT;
  p_DetectionMethod_c67b1782eb9a VARCHAR(50);
  p_AutoDetectConfidenceScore_c67b1782eb9a NUMERIC(3,2);
  p_SourceEntityFieldID_c67b1782eb9a UUID;
  p_IsNullable_c67b1782eb9a BOOLEAN;
  p_SourceObjectName_c67b1782eb9a VARCHAR(500);
BEGIN
  p_ID_c67b1782eb9a := '6ffc6044-b021-4a16-a83d-b3c1f5f1509b';
  p_QueryID_c67b1782eb9a := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_c67b1782eb9a := 'DealName';
  p_Sequence_c67b1782eb9a := 14;
  p_SQLBaseType_c67b1782eb9a := 'nvarchar';
  p_SQLFullType_c67b1782eb9a := 'nvarchar(500)';
  p_SourceEntityID_c67b1782eb9a := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_c67b1782eb9a := 'Name';
  p_IsComputed_c67b1782eb9a := FALSE;
  p_IsSummary_c67b1782eb9a := FALSE;
  p_DetectionMethod_c67b1782eb9a := 'Database';
  p_SourceEntityFieldID_c67b1782eb9a := '379450E4-178C-4CDD-90B3-9081E903B51D';
  p_IsNullable_c67b1782eb9a := TRUE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_c67b1782eb9a := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_c67b1782eb9a AND "Name" = p_SourceFieldName_c67b1782eb9a
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_c67b1782eb9a THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_c67b1782eb9a
                    OR ("QueryID" = p_QueryID_c67b1782eb9a AND "Name" = p_Name_c67b1782eb9a)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_c67b1782eb9a,
    'QueryID', p_QueryID_c67b1782eb9a,
    'Name', p_Name_c67b1782eb9a,
    'Description', p_Description_c67b1782eb9a,
    'Sequence', p_Sequence_c67b1782eb9a,
    'SQLBaseType', p_SQLBaseType_c67b1782eb9a,
    'SQLFullType', p_SQLFullType_c67b1782eb9a,
    'SourceEntityID', p_SourceEntityID_c67b1782eb9a,
    'SourceFieldName', p_SourceFieldName_c67b1782eb9a,
    'IsComputed', p_IsComputed_c67b1782eb9a,
    'ComputationDescription', p_ComputationDescription_c67b1782eb9a,
    'IsSummary', p_IsSummary_c67b1782eb9a,
    'SummaryDescription', p_SummaryDescription_c67b1782eb9a,
    'DetectionMethod', p_DetectionMethod_c67b1782eb9a,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_c67b1782eb9a,
    'SourceEntityFieldID', p_SourceEntityFieldID_c67b1782eb9a,
    'IsNullable', p_IsNullable_c67b1782eb9a,
    'SourceObjectName', p_SourceObjectName_c67b1782eb9a
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_c67b1782eb9a, p_QueryID := p_QueryID_c67b1782eb9a, p_Name := p_Name_c67b1782eb9a, p_Description := p_Description_c67b1782eb9a, p_Description_Clear := TRUE, p_Sequence := p_Sequence_c67b1782eb9a, p_SQLBaseType := p_SQLBaseType_c67b1782eb9a, p_SQLFullType := p_SQLFullType_c67b1782eb9a, p_SourceEntityID := p_SourceEntityID_c67b1782eb9a, p_SourceFieldName := p_SourceFieldName_c67b1782eb9a, p_IsComputed := p_IsComputed_c67b1782eb9a, p_ComputationDescription := p_ComputationDescription_c67b1782eb9a, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_c67b1782eb9a, p_SummaryDescription := p_SummaryDescription_c67b1782eb9a, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_c67b1782eb9a, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_c67b1782eb9a, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_c67b1782eb9a, p_IsNullable := p_IsNullable_c67b1782eb9a, p_SourceObjectName := p_SourceObjectName_c67b1782eb9a, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_49941ac810d6 UUID;
  p_QueryID_49941ac810d6 UUID;
  p_Name_49941ac810d6 VARCHAR(255);
  p_Description_49941ac810d6 TEXT;
  p_Sequence_49941ac810d6 INTEGER;
  p_SQLBaseType_49941ac810d6 VARCHAR(50);
  p_SQLFullType_49941ac810d6 VARCHAR(100);
  p_SourceEntityID_49941ac810d6 UUID;
  p_SourceFieldName_49941ac810d6 VARCHAR(255);
  p_IsComputed_49941ac810d6 BOOLEAN;
  p_ComputationDescription_49941ac810d6 TEXT;
  p_IsSummary_49941ac810d6 BOOLEAN;
  p_SummaryDescription_49941ac810d6 TEXT;
  p_DetectionMethod_49941ac810d6 VARCHAR(50);
  p_AutoDetectConfidenceScore_49941ac810d6 NUMERIC(3,2);
  p_SourceEntityFieldID_49941ac810d6 UUID;
  p_IsNullable_49941ac810d6 BOOLEAN;
  p_SourceObjectName_49941ac810d6 VARCHAR(500);
BEGIN
  p_ID_49941ac810d6 := 'b68b5940-cc2f-4a5a-9025-5cd5f5ae6ccf';
  p_QueryID_49941ac810d6 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_49941ac810d6 := 'DealOwnerName';
  p_Sequence_49941ac810d6 := 15;
  p_SQLBaseType_49941ac810d6 := 'nvarchar';
  p_SQLFullType_49941ac810d6 := 'nvarchar(81)';
  p_SourceEntityID_49941ac810d6 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_SourceFieldName_49941ac810d6 := 'OwnerEmployee';
  p_IsComputed_49941ac810d6 := FALSE;
  p_IsSummary_49941ac810d6 := FALSE;
  p_DetectionMethod_49941ac810d6 := 'Database';
  p_SourceEntityFieldID_49941ac810d6 := '3442E4F5-F87C-4993-9AB3-38D7FBBECF88';
  p_IsNullable_49941ac810d6 := TRUE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_49941ac810d6 := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_49941ac810d6 AND "Name" = p_SourceFieldName_49941ac810d6
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_49941ac810d6 THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_49941ac810d6
                    OR ("QueryID" = p_QueryID_49941ac810d6 AND "Name" = p_Name_49941ac810d6)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_49941ac810d6,
    'QueryID', p_QueryID_49941ac810d6,
    'Name', p_Name_49941ac810d6,
    'Description', p_Description_49941ac810d6,
    'Sequence', p_Sequence_49941ac810d6,
    'SQLBaseType', p_SQLBaseType_49941ac810d6,
    'SQLFullType', p_SQLFullType_49941ac810d6,
    'SourceEntityID', p_SourceEntityID_49941ac810d6,
    'SourceFieldName', p_SourceFieldName_49941ac810d6,
    'IsComputed', p_IsComputed_49941ac810d6,
    'ComputationDescription', p_ComputationDescription_49941ac810d6,
    'IsSummary', p_IsSummary_49941ac810d6,
    'SummaryDescription', p_SummaryDescription_49941ac810d6,
    'DetectionMethod', p_DetectionMethod_49941ac810d6,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_49941ac810d6,
    'SourceEntityFieldID', p_SourceEntityFieldID_49941ac810d6,
    'IsNullable', p_IsNullable_49941ac810d6,
    'SourceObjectName', p_SourceObjectName_49941ac810d6
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_49941ac810d6, p_QueryID := p_QueryID_49941ac810d6, p_Name := p_Name_49941ac810d6, p_Description := p_Description_49941ac810d6, p_Description_Clear := TRUE, p_Sequence := p_Sequence_49941ac810d6, p_SQLBaseType := p_SQLBaseType_49941ac810d6, p_SQLFullType := p_SQLFullType_49941ac810d6, p_SourceEntityID := p_SourceEntityID_49941ac810d6, p_SourceFieldName := p_SourceFieldName_49941ac810d6, p_IsComputed := p_IsComputed_49941ac810d6, p_ComputationDescription := p_ComputationDescription_49941ac810d6, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_49941ac810d6, p_SummaryDescription := p_SummaryDescription_49941ac810d6, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_49941ac810d6, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_49941ac810d6, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_49941ac810d6, p_IsNullable := p_IsNullable_49941ac810d6, p_SourceObjectName := p_SourceObjectName_49941ac810d6, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_285578b72efc UUID;
  p_QueryID_285578b72efc UUID;
  p_Name_285578b72efc VARCHAR(255);
  p_Description_285578b72efc TEXT;
  p_Sequence_285578b72efc INTEGER;
  p_SQLBaseType_285578b72efc VARCHAR(50);
  p_SQLFullType_285578b72efc VARCHAR(100);
  p_SourceEntityID_285578b72efc UUID;
  p_SourceFieldName_285578b72efc VARCHAR(255);
  p_IsComputed_285578b72efc BOOLEAN;
  p_ComputationDescription_285578b72efc TEXT;
  p_IsSummary_285578b72efc BOOLEAN;
  p_SummaryDescription_285578b72efc TEXT;
  p_DetectionMethod_285578b72efc VARCHAR(50);
  p_AutoDetectConfidenceScore_285578b72efc NUMERIC(3,2);
  p_SourceEntityFieldID_285578b72efc UUID;
  p_IsNullable_285578b72efc BOOLEAN;
  p_SourceObjectName_285578b72efc VARCHAR(500);
BEGIN
  p_ID_285578b72efc := '77ad7b40-fabc-448c-9770-149b94f500c4';
  p_QueryID_285578b72efc := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_285578b72efc := 'ContractID';
  p_Sequence_285578b72efc := 16;
  p_SQLBaseType_285578b72efc := 'uniqueidentifier';
  p_SQLFullType_285578b72efc := 'uniqueidentifier';
  p_SourceEntityID_285578b72efc := '5DEB0B11-ED6C-48B3-9200-F4441396C5E2';
  p_SourceFieldName_285578b72efc := 'ID';
  p_IsComputed_285578b72efc := FALSE;
  p_IsSummary_285578b72efc := FALSE;
  p_DetectionMethod_285578b72efc := 'Database';
  p_SourceEntityFieldID_285578b72efc := '04E8AA9D-C2DC-489D-B081-75C4E6DDFA6B';
  p_IsNullable_285578b72efc := TRUE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_285578b72efc := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_285578b72efc AND "Name" = p_SourceFieldName_285578b72efc
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_285578b72efc THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_285578b72efc
                    OR ("QueryID" = p_QueryID_285578b72efc AND "Name" = p_Name_285578b72efc)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_285578b72efc,
    'QueryID', p_QueryID_285578b72efc,
    'Name', p_Name_285578b72efc,
    'Description', p_Description_285578b72efc,
    'Sequence', p_Sequence_285578b72efc,
    'SQLBaseType', p_SQLBaseType_285578b72efc,
    'SQLFullType', p_SQLFullType_285578b72efc,
    'SourceEntityID', p_SourceEntityID_285578b72efc,
    'SourceFieldName', p_SourceFieldName_285578b72efc,
    'IsComputed', p_IsComputed_285578b72efc,
    'ComputationDescription', p_ComputationDescription_285578b72efc,
    'IsSummary', p_IsSummary_285578b72efc,
    'SummaryDescription', p_SummaryDescription_285578b72efc,
    'DetectionMethod', p_DetectionMethod_285578b72efc,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_285578b72efc,
    'SourceEntityFieldID', p_SourceEntityFieldID_285578b72efc,
    'IsNullable', p_IsNullable_285578b72efc,
    'SourceObjectName', p_SourceObjectName_285578b72efc
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_285578b72efc, p_QueryID := p_QueryID_285578b72efc, p_Name := p_Name_285578b72efc, p_Description := p_Description_285578b72efc, p_Description_Clear := TRUE, p_Sequence := p_Sequence_285578b72efc, p_SQLBaseType := p_SQLBaseType_285578b72efc, p_SQLFullType := p_SQLFullType_285578b72efc, p_SourceEntityID := p_SourceEntityID_285578b72efc, p_SourceFieldName := p_SourceFieldName_285578b72efc, p_IsComputed := p_IsComputed_285578b72efc, p_ComputationDescription := p_ComputationDescription_285578b72efc, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_285578b72efc, p_SummaryDescription := p_SummaryDescription_285578b72efc, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_285578b72efc, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_285578b72efc, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_285578b72efc, p_IsNullable := p_IsNullable_285578b72efc, p_SourceObjectName := p_SourceObjectName_285578b72efc, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_b1d24f35a8e9 UUID;
  p_QueryID_b1d24f35a8e9 UUID;
  p_Name_b1d24f35a8e9 VARCHAR(255);
  p_Description_b1d24f35a8e9 TEXT;
  p_Sequence_b1d24f35a8e9 INTEGER;
  p_SQLBaseType_b1d24f35a8e9 VARCHAR(50);
  p_SQLFullType_b1d24f35a8e9 VARCHAR(100);
  p_SourceEntityID_b1d24f35a8e9 UUID;
  p_SourceFieldName_b1d24f35a8e9 VARCHAR(255);
  p_IsComputed_b1d24f35a8e9 BOOLEAN;
  p_ComputationDescription_b1d24f35a8e9 TEXT;
  p_IsSummary_b1d24f35a8e9 BOOLEAN;
  p_SummaryDescription_b1d24f35a8e9 TEXT;
  p_DetectionMethod_b1d24f35a8e9 VARCHAR(50);
  p_AutoDetectConfidenceScore_b1d24f35a8e9 NUMERIC(3,2);
  p_SourceEntityFieldID_b1d24f35a8e9 UUID;
  p_IsNullable_b1d24f35a8e9 BOOLEAN;
  p_SourceObjectName_b1d24f35a8e9 VARCHAR(500);
BEGIN
  p_ID_b1d24f35a8e9 := '41f7cfa7-014c-4754-afd4-2a6284cd804a';
  p_QueryID_b1d24f35a8e9 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_b1d24f35a8e9 := 'ContractNumber';
  p_Description_b1d24f35a8e9 := 'CTR-000001, minted by spAssignNextContractNumber from the seq_ContractNumber database SEQUENCE. Unique. NULLABLE at the schema level because MJ cannot express ''NOT NULL, assigned by the server on insert'' -- ContractEntityServer.Save() is what guarantees every contract has one. Gaps are normal and are not to be ''fixed'': a save that fails after taking a number leaves one behind, and UQ_Contract_ContractNumber is what guarantees no two contracts share a number.';
  p_Sequence_b1d24f35a8e9 := 17;
  p_SQLBaseType_b1d24f35a8e9 := 'nvarchar';
  p_SQLFullType_b1d24f35a8e9 := 'nvarchar(50)';
  p_SourceEntityID_b1d24f35a8e9 := '5DEB0B11-ED6C-48B3-9200-F4441396C5E2';
  p_SourceFieldName_b1d24f35a8e9 := 'ContractNumber';
  p_IsComputed_b1d24f35a8e9 := FALSE;
  p_IsSummary_b1d24f35a8e9 := FALSE;
  p_DetectionMethod_b1d24f35a8e9 := 'Database';
  p_SourceEntityFieldID_b1d24f35a8e9 := '8677055B-2482-4250-98C1-AFC3DAE57393';
  p_IsNullable_b1d24f35a8e9 := TRUE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_b1d24f35a8e9 := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_b1d24f35a8e9 AND "Name" = p_SourceFieldName_b1d24f35a8e9
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_b1d24f35a8e9 THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_b1d24f35a8e9
                    OR ("QueryID" = p_QueryID_b1d24f35a8e9 AND "Name" = p_Name_b1d24f35a8e9)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_b1d24f35a8e9,
    'QueryID', p_QueryID_b1d24f35a8e9,
    'Name', p_Name_b1d24f35a8e9,
    'Description', p_Description_b1d24f35a8e9,
    'Sequence', p_Sequence_b1d24f35a8e9,
    'SQLBaseType', p_SQLBaseType_b1d24f35a8e9,
    'SQLFullType', p_SQLFullType_b1d24f35a8e9,
    'SourceEntityID', p_SourceEntityID_b1d24f35a8e9,
    'SourceFieldName', p_SourceFieldName_b1d24f35a8e9,
    'IsComputed', p_IsComputed_b1d24f35a8e9,
    'ComputationDescription', p_ComputationDescription_b1d24f35a8e9,
    'IsSummary', p_IsSummary_b1d24f35a8e9,
    'SummaryDescription', p_SummaryDescription_b1d24f35a8e9,
    'DetectionMethod', p_DetectionMethod_b1d24f35a8e9,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_b1d24f35a8e9,
    'SourceEntityFieldID', p_SourceEntityFieldID_b1d24f35a8e9,
    'IsNullable', p_IsNullable_b1d24f35a8e9,
    'SourceObjectName', p_SourceObjectName_b1d24f35a8e9
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_b1d24f35a8e9, p_QueryID := p_QueryID_b1d24f35a8e9, p_Name := p_Name_b1d24f35a8e9, p_Description := p_Description_b1d24f35a8e9, p_Sequence := p_Sequence_b1d24f35a8e9, p_SQLBaseType := p_SQLBaseType_b1d24f35a8e9, p_SQLFullType := p_SQLFullType_b1d24f35a8e9, p_SourceEntityID := p_SourceEntityID_b1d24f35a8e9, p_SourceFieldName := p_SourceFieldName_b1d24f35a8e9, p_IsComputed := p_IsComputed_b1d24f35a8e9, p_ComputationDescription := p_ComputationDescription_b1d24f35a8e9, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_b1d24f35a8e9, p_SummaryDescription := p_SummaryDescription_b1d24f35a8e9, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_b1d24f35a8e9, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_b1d24f35a8e9, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_b1d24f35a8e9, p_IsNullable := p_IsNullable_b1d24f35a8e9, p_SourceObjectName := p_SourceObjectName_b1d24f35a8e9, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_32f423237cd3 UUID;
  p_QueryID_32f423237cd3 UUID;
  p_Name_32f423237cd3 VARCHAR(255);
  p_Description_32f423237cd3 TEXT;
  p_Sequence_32f423237cd3 INTEGER;
  p_SQLBaseType_32f423237cd3 VARCHAR(50);
  p_SQLFullType_32f423237cd3 VARCHAR(100);
  p_SourceEntityID_32f423237cd3 UUID;
  p_SourceFieldName_32f423237cd3 VARCHAR(255);
  p_IsComputed_32f423237cd3 BOOLEAN;
  p_ComputationDescription_32f423237cd3 TEXT;
  p_IsSummary_32f423237cd3 BOOLEAN;
  p_SummaryDescription_32f423237cd3 TEXT;
  p_DetectionMethod_32f423237cd3 VARCHAR(50);
  p_AutoDetectConfidenceScore_32f423237cd3 NUMERIC(3,2);
  p_SourceEntityFieldID_32f423237cd3 UUID;
  p_IsNullable_32f423237cd3 BOOLEAN;
  p_SourceObjectName_32f423237cd3 VARCHAR(500);
BEGIN
  p_ID_32f423237cd3 := '25996d02-26b1-4d24-8a16-ac554d86fcc0';
  p_QueryID_32f423237cd3 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_32f423237cd3 := 'ContractType';
  p_Sequence_32f423237cd3 := 18;
  p_SQLBaseType_32f423237cd3 := 'nvarchar';
  p_SQLFullType_32f423237cd3 := 'nvarchar(100)';
  p_SourceEntityID_32f423237cd3 := '5DEB0B11-ED6C-48B3-9200-F4441396C5E2';
  p_SourceFieldName_32f423237cd3 := 'ContractType';
  p_IsComputed_32f423237cd3 := FALSE;
  p_IsSummary_32f423237cd3 := FALSE;
  p_DetectionMethod_32f423237cd3 := 'Database';
  p_SourceEntityFieldID_32f423237cd3 := '14BDA941-CE85-4A14-8FDC-3681B8C52418';
  p_IsNullable_32f423237cd3 := TRUE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_32f423237cd3 := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_32f423237cd3 AND "Name" = p_SourceFieldName_32f423237cd3
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_32f423237cd3 THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_32f423237cd3
                    OR ("QueryID" = p_QueryID_32f423237cd3 AND "Name" = p_Name_32f423237cd3)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_32f423237cd3,
    'QueryID', p_QueryID_32f423237cd3,
    'Name', p_Name_32f423237cd3,
    'Description', p_Description_32f423237cd3,
    'Sequence', p_Sequence_32f423237cd3,
    'SQLBaseType', p_SQLBaseType_32f423237cd3,
    'SQLFullType', p_SQLFullType_32f423237cd3,
    'SourceEntityID', p_SourceEntityID_32f423237cd3,
    'SourceFieldName', p_SourceFieldName_32f423237cd3,
    'IsComputed', p_IsComputed_32f423237cd3,
    'ComputationDescription', p_ComputationDescription_32f423237cd3,
    'IsSummary', p_IsSummary_32f423237cd3,
    'SummaryDescription', p_SummaryDescription_32f423237cd3,
    'DetectionMethod', p_DetectionMethod_32f423237cd3,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_32f423237cd3,
    'SourceEntityFieldID', p_SourceEntityFieldID_32f423237cd3,
    'IsNullable', p_IsNullable_32f423237cd3,
    'SourceObjectName', p_SourceObjectName_32f423237cd3
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_32f423237cd3, p_QueryID := p_QueryID_32f423237cd3, p_Name := p_Name_32f423237cd3, p_Description := p_Description_32f423237cd3, p_Description_Clear := TRUE, p_Sequence := p_Sequence_32f423237cd3, p_SQLBaseType := p_SQLBaseType_32f423237cd3, p_SQLFullType := p_SQLFullType_32f423237cd3, p_SourceEntityID := p_SourceEntityID_32f423237cd3, p_SourceFieldName := p_SourceFieldName_32f423237cd3, p_IsComputed := p_IsComputed_32f423237cd3, p_ComputationDescription := p_ComputationDescription_32f423237cd3, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_32f423237cd3, p_SummaryDescription := p_SummaryDescription_32f423237cd3, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_32f423237cd3, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_32f423237cd3, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_32f423237cd3, p_IsNullable := p_IsNullable_32f423237cd3, p_SourceObjectName := p_SourceObjectName_32f423237cd3, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_0868a158aa4a UUID;
  p_QueryID_0868a158aa4a UUID;
  p_Name_0868a158aa4a VARCHAR(255);
  p_Description_0868a158aa4a TEXT;
  p_Sequence_0868a158aa4a INTEGER;
  p_SQLBaseType_0868a158aa4a VARCHAR(50);
  p_SQLFullType_0868a158aa4a VARCHAR(100);
  p_SourceEntityID_0868a158aa4a UUID;
  p_SourceFieldName_0868a158aa4a VARCHAR(255);
  p_IsComputed_0868a158aa4a BOOLEAN;
  p_ComputationDescription_0868a158aa4a TEXT;
  p_IsSummary_0868a158aa4a BOOLEAN;
  p_SummaryDescription_0868a158aa4a TEXT;
  p_DetectionMethod_0868a158aa4a VARCHAR(50);
  p_AutoDetectConfidenceScore_0868a158aa4a NUMERIC(3,2);
  p_SourceEntityFieldID_0868a158aa4a UUID;
  p_IsNullable_0868a158aa4a BOOLEAN;
  p_SourceObjectName_0868a158aa4a VARCHAR(500);
BEGIN
  p_ID_0868a158aa4a := 'a0c941d8-8b82-424a-97d8-1ba1fd86b042';
  p_QueryID_0868a158aa4a := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_0868a158aa4a := 'ContractState';
  p_Sequence_0868a158aa4a := 19;
  p_SQLBaseType_0868a158aa4a := 'varchar';
  p_SQLFullType_0868a158aa4a := 'varchar(10)';
  p_SourceEntityID_0868a158aa4a := '5DEB0B11-ED6C-48B3-9200-F4441396C5E2';
  p_SourceFieldName_0868a158aa4a := 'State';
  p_IsComputed_0868a158aa4a := FALSE;
  p_IsSummary_0868a158aa4a := FALSE;
  p_DetectionMethod_0868a158aa4a := 'Database';
  p_SourceEntityFieldID_0868a158aa4a := '0E1B433E-F36B-1410-8489-00031FE78EB9';
  p_IsNullable_0868a158aa4a := TRUE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_0868a158aa4a := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_0868a158aa4a AND "Name" = p_SourceFieldName_0868a158aa4a
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_0868a158aa4a THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_0868a158aa4a
                    OR ("QueryID" = p_QueryID_0868a158aa4a AND "Name" = p_Name_0868a158aa4a)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_0868a158aa4a,
    'QueryID', p_QueryID_0868a158aa4a,
    'Name', p_Name_0868a158aa4a,
    'Description', p_Description_0868a158aa4a,
    'Sequence', p_Sequence_0868a158aa4a,
    'SQLBaseType', p_SQLBaseType_0868a158aa4a,
    'SQLFullType', p_SQLFullType_0868a158aa4a,
    'SourceEntityID', p_SourceEntityID_0868a158aa4a,
    'SourceFieldName', p_SourceFieldName_0868a158aa4a,
    'IsComputed', p_IsComputed_0868a158aa4a,
    'ComputationDescription', p_ComputationDescription_0868a158aa4a,
    'IsSummary', p_IsSummary_0868a158aa4a,
    'SummaryDescription', p_SummaryDescription_0868a158aa4a,
    'DetectionMethod', p_DetectionMethod_0868a158aa4a,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_0868a158aa4a,
    'SourceEntityFieldID', p_SourceEntityFieldID_0868a158aa4a,
    'IsNullable', p_IsNullable_0868a158aa4a,
    'SourceObjectName', p_SourceObjectName_0868a158aa4a
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_0868a158aa4a, p_QueryID := p_QueryID_0868a158aa4a, p_Name := p_Name_0868a158aa4a, p_Description := p_Description_0868a158aa4a, p_Description_Clear := TRUE, p_Sequence := p_Sequence_0868a158aa4a, p_SQLBaseType := p_SQLBaseType_0868a158aa4a, p_SQLFullType := p_SQLFullType_0868a158aa4a, p_SourceEntityID := p_SourceEntityID_0868a158aa4a, p_SourceFieldName := p_SourceFieldName_0868a158aa4a, p_IsComputed := p_IsComputed_0868a158aa4a, p_ComputationDescription := p_ComputationDescription_0868a158aa4a, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_0868a158aa4a, p_SummaryDescription := p_SummaryDescription_0868a158aa4a, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_0868a158aa4a, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_0868a158aa4a, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_0868a158aa4a, p_IsNullable := p_IsNullable_0868a158aa4a, p_SourceObjectName := p_SourceObjectName_0868a158aa4a, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_7169530cd3da UUID;
  p_QueryID_7169530cd3da UUID;
  p_Name_7169530cd3da VARCHAR(255);
  p_Description_7169530cd3da TEXT;
  p_Sequence_7169530cd3da INTEGER;
  p_SQLBaseType_7169530cd3da VARCHAR(50);
  p_SQLFullType_7169530cd3da VARCHAR(100);
  p_SourceEntityID_7169530cd3da UUID;
  p_SourceFieldName_7169530cd3da VARCHAR(255);
  p_IsComputed_7169530cd3da BOOLEAN;
  p_ComputationDescription_7169530cd3da TEXT;
  p_IsSummary_7169530cd3da BOOLEAN;
  p_SummaryDescription_7169530cd3da TEXT;
  p_DetectionMethod_7169530cd3da VARCHAR(50);
  p_AutoDetectConfidenceScore_7169530cd3da NUMERIC(3,2);
  p_SourceEntityFieldID_7169530cd3da UUID;
  p_IsNullable_7169530cd3da BOOLEAN;
  p_SourceObjectName_7169530cd3da VARCHAR(500);
BEGIN
  p_ID_7169530cd3da := '13bd8974-3c1c-445d-8f7d-3fb1db9d7f89';
  p_QueryID_7169530cd3da := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_7169530cd3da := 'ExecutedDate';
  p_Description_7169530cd3da := 'When it was signed. May legitimately PRECEDE EffectiveDate — sign in December for a January start is the ordinary case. There is deliberately no constraint ordering the two; v1 had one and it rejected exactly the data a correct contract produces.';
  p_Sequence_7169530cd3da := 20;
  p_SQLBaseType_7169530cd3da := 'date';
  p_SQLFullType_7169530cd3da := 'date';
  p_SourceEntityID_7169530cd3da := '5DEB0B11-ED6C-48B3-9200-F4441396C5E2';
  p_SourceFieldName_7169530cd3da := 'ExecutedDate';
  p_IsComputed_7169530cd3da := FALSE;
  p_IsSummary_7169530cd3da := FALSE;
  p_DetectionMethod_7169530cd3da := 'Database';
  p_SourceEntityFieldID_7169530cd3da := '9ED4A8CC-E0B8-4880-945A-4BD6DD6368C6';
  p_IsNullable_7169530cd3da := TRUE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_7169530cd3da := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_7169530cd3da AND "Name" = p_SourceFieldName_7169530cd3da
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_7169530cd3da THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_7169530cd3da
                    OR ("QueryID" = p_QueryID_7169530cd3da AND "Name" = p_Name_7169530cd3da)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_7169530cd3da,
    'QueryID', p_QueryID_7169530cd3da,
    'Name', p_Name_7169530cd3da,
    'Description', p_Description_7169530cd3da,
    'Sequence', p_Sequence_7169530cd3da,
    'SQLBaseType', p_SQLBaseType_7169530cd3da,
    'SQLFullType', p_SQLFullType_7169530cd3da,
    'SourceEntityID', p_SourceEntityID_7169530cd3da,
    'SourceFieldName', p_SourceFieldName_7169530cd3da,
    'IsComputed', p_IsComputed_7169530cd3da,
    'ComputationDescription', p_ComputationDescription_7169530cd3da,
    'IsSummary', p_IsSummary_7169530cd3da,
    'SummaryDescription', p_SummaryDescription_7169530cd3da,
    'DetectionMethod', p_DetectionMethod_7169530cd3da,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_7169530cd3da,
    'SourceEntityFieldID', p_SourceEntityFieldID_7169530cd3da,
    'IsNullable', p_IsNullable_7169530cd3da,
    'SourceObjectName', p_SourceObjectName_7169530cd3da
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_7169530cd3da, p_QueryID := p_QueryID_7169530cd3da, p_Name := p_Name_7169530cd3da, p_Description := p_Description_7169530cd3da, p_Sequence := p_Sequence_7169530cd3da, p_SQLBaseType := p_SQLBaseType_7169530cd3da, p_SQLFullType := p_SQLFullType_7169530cd3da, p_SourceEntityID := p_SourceEntityID_7169530cd3da, p_SourceFieldName := p_SourceFieldName_7169530cd3da, p_IsComputed := p_IsComputed_7169530cd3da, p_ComputationDescription := p_ComputationDescription_7169530cd3da, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_7169530cd3da, p_SummaryDescription := p_SummaryDescription_7169530cd3da, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_7169530cd3da, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_7169530cd3da, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_7169530cd3da, p_IsNullable := p_IsNullable_7169530cd3da, p_SourceObjectName := p_SourceObjectName_7169530cd3da, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_f7e84ceed937 UUID;
  p_QueryID_f7e84ceed937 UUID;
  p_Name_f7e84ceed937 VARCHAR(255);
  p_Description_f7e84ceed937 TEXT;
  p_Sequence_f7e84ceed937 INTEGER;
  p_SQLBaseType_f7e84ceed937 VARCHAR(50);
  p_SQLFullType_f7e84ceed937 VARCHAR(100);
  p_SourceEntityID_f7e84ceed937 UUID;
  p_SourceFieldName_f7e84ceed937 VARCHAR(255);
  p_IsComputed_f7e84ceed937 BOOLEAN;
  p_ComputationDescription_f7e84ceed937 TEXT;
  p_IsSummary_f7e84ceed937 BOOLEAN;
  p_SummaryDescription_f7e84ceed937 TEXT;
  p_DetectionMethod_f7e84ceed937 VARCHAR(50);
  p_AutoDetectConfidenceScore_f7e84ceed937 NUMERIC(3,2);
  p_SourceEntityFieldID_f7e84ceed937 UUID;
  p_IsNullable_f7e84ceed937 BOOLEAN;
  p_SourceObjectName_f7e84ceed937 VARCHAR(500);
BEGIN
  p_ID_f7e84ceed937 := '8d88f1b8-124f-4837-ac19-02efc659011d';
  p_QueryID_f7e84ceed937 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_f7e84ceed937 := 'HasDeal';
  p_Sequence_f7e84ceed937 := 21;
  p_SQLBaseType_f7e84ceed937 := 'bit';
  p_SQLFullType_f7e84ceed937 := 'bit';
  p_IsComputed_f7e84ceed937 := TRUE;
  p_IsSummary_f7e84ceed937 := FALSE;
  p_DetectionMethod_f7e84ceed937 := 'Database';
  p_IsNullable_f7e84ceed937 := TRUE;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_f7e84ceed937
                    OR ("QueryID" = p_QueryID_f7e84ceed937 AND "Name" = p_Name_f7e84ceed937)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_f7e84ceed937,
    'QueryID', p_QueryID_f7e84ceed937,
    'Name', p_Name_f7e84ceed937,
    'Description', p_Description_f7e84ceed937,
    'Sequence', p_Sequence_f7e84ceed937,
    'SQLBaseType', p_SQLBaseType_f7e84ceed937,
    'SQLFullType', p_SQLFullType_f7e84ceed937,
    'SourceEntityID', p_SourceEntityID_f7e84ceed937,
    'SourceFieldName', p_SourceFieldName_f7e84ceed937,
    'IsComputed', p_IsComputed_f7e84ceed937,
    'ComputationDescription', p_ComputationDescription_f7e84ceed937,
    'IsSummary', p_IsSummary_f7e84ceed937,
    'SummaryDescription', p_SummaryDescription_f7e84ceed937,
    'DetectionMethod', p_DetectionMethod_f7e84ceed937,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_f7e84ceed937,
    'SourceEntityFieldID', p_SourceEntityFieldID_f7e84ceed937,
    'IsNullable', p_IsNullable_f7e84ceed937,
    'SourceObjectName', p_SourceObjectName_f7e84ceed937
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_f7e84ceed937, p_QueryID := p_QueryID_f7e84ceed937, p_Name := p_Name_f7e84ceed937, p_Description := p_Description_f7e84ceed937, p_Description_Clear := TRUE, p_Sequence := p_Sequence_f7e84ceed937, p_SQLBaseType := p_SQLBaseType_f7e84ceed937, p_SQLFullType := p_SQLFullType_f7e84ceed937, p_SourceEntityID := p_SourceEntityID_f7e84ceed937, p_SourceEntityID_Clear := TRUE, p_SourceFieldName := p_SourceFieldName_f7e84ceed937, p_SourceFieldName_Clear := TRUE, p_IsComputed := p_IsComputed_f7e84ceed937, p_ComputationDescription := p_ComputationDescription_f7e84ceed937, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_f7e84ceed937, p_SummaryDescription := p_SummaryDescription_f7e84ceed937, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_f7e84ceed937, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_f7e84ceed937, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_f7e84ceed937, p_SourceEntityFieldID_Clear := TRUE, p_IsNullable := p_IsNullable_f7e84ceed937, p_SourceObjectName := p_SourceObjectName_f7e84ceed937, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_4bf66d01a43e UUID;
  p_QueryID_4bf66d01a43e UUID;
  p_Name_4bf66d01a43e VARCHAR(255);
  p_Description_4bf66d01a43e TEXT;
  p_Sequence_4bf66d01a43e INTEGER;
  p_SQLBaseType_4bf66d01a43e VARCHAR(50);
  p_SQLFullType_4bf66d01a43e VARCHAR(100);
  p_SourceEntityID_4bf66d01a43e UUID;
  p_SourceFieldName_4bf66d01a43e VARCHAR(255);
  p_IsComputed_4bf66d01a43e BOOLEAN;
  p_ComputationDescription_4bf66d01a43e TEXT;
  p_IsSummary_4bf66d01a43e BOOLEAN;
  p_SummaryDescription_4bf66d01a43e TEXT;
  p_DetectionMethod_4bf66d01a43e VARCHAR(50);
  p_AutoDetectConfidenceScore_4bf66d01a43e NUMERIC(3,2);
  p_SourceEntityFieldID_4bf66d01a43e UUID;
  p_IsNullable_4bf66d01a43e BOOLEAN;
  p_SourceObjectName_4bf66d01a43e VARCHAR(500);
BEGIN
  p_ID_4bf66d01a43e := '7bdc93a5-cff6-40fa-9bb4-8c4c2e32c31f';
  p_QueryID_4bf66d01a43e := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_4bf66d01a43e := 'HasContract';
  p_Sequence_4bf66d01a43e := 22;
  p_SQLBaseType_4bf66d01a43e := 'bit';
  p_SQLFullType_4bf66d01a43e := 'bit';
  p_IsComputed_4bf66d01a43e := TRUE;
  p_IsSummary_4bf66d01a43e := FALSE;
  p_DetectionMethod_4bf66d01a43e := 'Database';
  p_IsNullable_4bf66d01a43e := TRUE;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_4bf66d01a43e
                    OR ("QueryID" = p_QueryID_4bf66d01a43e AND "Name" = p_Name_4bf66d01a43e)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_4bf66d01a43e,
    'QueryID', p_QueryID_4bf66d01a43e,
    'Name', p_Name_4bf66d01a43e,
    'Description', p_Description_4bf66d01a43e,
    'Sequence', p_Sequence_4bf66d01a43e,
    'SQLBaseType', p_SQLBaseType_4bf66d01a43e,
    'SQLFullType', p_SQLFullType_4bf66d01a43e,
    'SourceEntityID', p_SourceEntityID_4bf66d01a43e,
    'SourceFieldName', p_SourceFieldName_4bf66d01a43e,
    'IsComputed', p_IsComputed_4bf66d01a43e,
    'ComputationDescription', p_ComputationDescription_4bf66d01a43e,
    'IsSummary', p_IsSummary_4bf66d01a43e,
    'SummaryDescription', p_SummaryDescription_4bf66d01a43e,
    'DetectionMethod', p_DetectionMethod_4bf66d01a43e,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_4bf66d01a43e,
    'SourceEntityFieldID', p_SourceEntityFieldID_4bf66d01a43e,
    'IsNullable', p_IsNullable_4bf66d01a43e,
    'SourceObjectName', p_SourceObjectName_4bf66d01a43e
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_4bf66d01a43e, p_QueryID := p_QueryID_4bf66d01a43e, p_Name := p_Name_4bf66d01a43e, p_Description := p_Description_4bf66d01a43e, p_Description_Clear := TRUE, p_Sequence := p_Sequence_4bf66d01a43e, p_SQLBaseType := p_SQLBaseType_4bf66d01a43e, p_SQLFullType := p_SQLFullType_4bf66d01a43e, p_SourceEntityID := p_SourceEntityID_4bf66d01a43e, p_SourceEntityID_Clear := TRUE, p_SourceFieldName := p_SourceFieldName_4bf66d01a43e, p_SourceFieldName_Clear := TRUE, p_IsComputed := p_IsComputed_4bf66d01a43e, p_ComputationDescription := p_ComputationDescription_4bf66d01a43e, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_4bf66d01a43e, p_SummaryDescription := p_SummaryDescription_4bf66d01a43e, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_4bf66d01a43e, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_4bf66d01a43e, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_4bf66d01a43e, p_SourceEntityFieldID_Clear := TRUE, p_IsNullable := p_IsNullable_4bf66d01a43e, p_SourceObjectName := p_SourceObjectName_4bf66d01a43e, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_716fbf4cb000 UUID;
  p_QueryID_716fbf4cb000 UUID;
  p_Name_716fbf4cb000 VARCHAR(255);
  p_Description_716fbf4cb000 TEXT;
  p_Sequence_716fbf4cb000 INTEGER;
  p_SQLBaseType_716fbf4cb000 VARCHAR(50);
  p_SQLFullType_716fbf4cb000 VARCHAR(100);
  p_SourceEntityID_716fbf4cb000 UUID;
  p_SourceFieldName_716fbf4cb000 VARCHAR(255);
  p_IsComputed_716fbf4cb000 BOOLEAN;
  p_ComputationDescription_716fbf4cb000 TEXT;
  p_IsSummary_716fbf4cb000 BOOLEAN;
  p_SummaryDescription_716fbf4cb000 TEXT;
  p_DetectionMethod_716fbf4cb000 VARCHAR(50);
  p_AutoDetectConfidenceScore_716fbf4cb000 NUMERIC(3,2);
  p_SourceEntityFieldID_716fbf4cb000 UUID;
  p_IsNullable_716fbf4cb000 BOOLEAN;
  p_SourceObjectName_716fbf4cb000 VARCHAR(500);
BEGIN
  p_ID_716fbf4cb000 := '3f8e8597-5115-4e02-8414-c8ffb8f511cc';
  p_QueryID_716fbf4cb000 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_716fbf4cb000 := 'HasSignedDate';
  p_Sequence_716fbf4cb000 := 23;
  p_SQLBaseType_716fbf4cb000 := 'bit';
  p_SQLFullType_716fbf4cb000 := 'bit';
  p_IsComputed_716fbf4cb000 := TRUE;
  p_IsSummary_716fbf4cb000 := FALSE;
  p_DetectionMethod_716fbf4cb000 := 'Database';
  p_IsNullable_716fbf4cb000 := TRUE;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_716fbf4cb000
                    OR ("QueryID" = p_QueryID_716fbf4cb000 AND "Name" = p_Name_716fbf4cb000)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_716fbf4cb000,
    'QueryID', p_QueryID_716fbf4cb000,
    'Name', p_Name_716fbf4cb000,
    'Description', p_Description_716fbf4cb000,
    'Sequence', p_Sequence_716fbf4cb000,
    'SQLBaseType', p_SQLBaseType_716fbf4cb000,
    'SQLFullType', p_SQLFullType_716fbf4cb000,
    'SourceEntityID', p_SourceEntityID_716fbf4cb000,
    'SourceFieldName', p_SourceFieldName_716fbf4cb000,
    'IsComputed', p_IsComputed_716fbf4cb000,
    'ComputationDescription', p_ComputationDescription_716fbf4cb000,
    'IsSummary', p_IsSummary_716fbf4cb000,
    'SummaryDescription', p_SummaryDescription_716fbf4cb000,
    'DetectionMethod', p_DetectionMethod_716fbf4cb000,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_716fbf4cb000,
    'SourceEntityFieldID', p_SourceEntityFieldID_716fbf4cb000,
    'IsNullable', p_IsNullable_716fbf4cb000,
    'SourceObjectName', p_SourceObjectName_716fbf4cb000
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_716fbf4cb000, p_QueryID := p_QueryID_716fbf4cb000, p_Name := p_Name_716fbf4cb000, p_Description := p_Description_716fbf4cb000, p_Description_Clear := TRUE, p_Sequence := p_Sequence_716fbf4cb000, p_SQLBaseType := p_SQLBaseType_716fbf4cb000, p_SQLFullType := p_SQLFullType_716fbf4cb000, p_SourceEntityID := p_SourceEntityID_716fbf4cb000, p_SourceEntityID_Clear := TRUE, p_SourceFieldName := p_SourceFieldName_716fbf4cb000, p_SourceFieldName_Clear := TRUE, p_IsComputed := p_IsComputed_716fbf4cb000, p_ComputationDescription := p_ComputationDescription_716fbf4cb000, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_716fbf4cb000, p_SummaryDescription := p_SummaryDescription_716fbf4cb000, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_716fbf4cb000, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_716fbf4cb000, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_716fbf4cb000, p_SourceEntityFieldID_Clear := TRUE, p_IsNullable := p_IsNullable_716fbf4cb000, p_SourceObjectName := p_SourceObjectName_716fbf4cb000, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_1917c93cf6d9 UUID;
  p_QueryID_1917c93cf6d9 UUID;
  p_Name_1917c93cf6d9 VARCHAR(255);
  p_Description_1917c93cf6d9 TEXT;
  p_Sequence_1917c93cf6d9 INTEGER;
  p_SQLBaseType_1917c93cf6d9 VARCHAR(50);
  p_SQLFullType_1917c93cf6d9 VARCHAR(100);
  p_SourceEntityID_1917c93cf6d9 UUID;
  p_SourceFieldName_1917c93cf6d9 VARCHAR(255);
  p_IsComputed_1917c93cf6d9 BOOLEAN;
  p_ComputationDescription_1917c93cf6d9 TEXT;
  p_IsSummary_1917c93cf6d9 BOOLEAN;
  p_SummaryDescription_1917c93cf6d9 TEXT;
  p_DetectionMethod_1917c93cf6d9 VARCHAR(50);
  p_AutoDetectConfidenceScore_1917c93cf6d9 NUMERIC(3,2);
  p_SourceEntityFieldID_1917c93cf6d9 UUID;
  p_IsNullable_1917c93cf6d9 BOOLEAN;
  p_SourceObjectName_1917c93cf6d9 VARCHAR(500);
BEGIN
  p_ID_1917c93cf6d9 := 'b0c9676a-e94a-4627-950d-f799087771a3';
  p_QueryID_1917c93cf6d9 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_1917c93cf6d9 := 'HasExecutedDocument';
  p_Sequence_1917c93cf6d9 := 24;
  p_SQLBaseType_1917c93cf6d9 := 'bit';
  p_SQLFullType_1917c93cf6d9 := 'bit';
  p_IsComputed_1917c93cf6d9 := TRUE;
  p_IsSummary_1917c93cf6d9 := FALSE;
  p_DetectionMethod_1917c93cf6d9 := 'Database';
  p_IsNullable_1917c93cf6d9 := TRUE;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_1917c93cf6d9
                    OR ("QueryID" = p_QueryID_1917c93cf6d9 AND "Name" = p_Name_1917c93cf6d9)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_1917c93cf6d9,
    'QueryID', p_QueryID_1917c93cf6d9,
    'Name', p_Name_1917c93cf6d9,
    'Description', p_Description_1917c93cf6d9,
    'Sequence', p_Sequence_1917c93cf6d9,
    'SQLBaseType', p_SQLBaseType_1917c93cf6d9,
    'SQLFullType', p_SQLFullType_1917c93cf6d9,
    'SourceEntityID', p_SourceEntityID_1917c93cf6d9,
    'SourceFieldName', p_SourceFieldName_1917c93cf6d9,
    'IsComputed', p_IsComputed_1917c93cf6d9,
    'ComputationDescription', p_ComputationDescription_1917c93cf6d9,
    'IsSummary', p_IsSummary_1917c93cf6d9,
    'SummaryDescription', p_SummaryDescription_1917c93cf6d9,
    'DetectionMethod', p_DetectionMethod_1917c93cf6d9,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_1917c93cf6d9,
    'SourceEntityFieldID', p_SourceEntityFieldID_1917c93cf6d9,
    'IsNullable', p_IsNullable_1917c93cf6d9,
    'SourceObjectName', p_SourceObjectName_1917c93cf6d9
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_1917c93cf6d9, p_QueryID := p_QueryID_1917c93cf6d9, p_Name := p_Name_1917c93cf6d9, p_Description := p_Description_1917c93cf6d9, p_Description_Clear := TRUE, p_Sequence := p_Sequence_1917c93cf6d9, p_SQLBaseType := p_SQLBaseType_1917c93cf6d9, p_SQLFullType := p_SQLFullType_1917c93cf6d9, p_SourceEntityID := p_SourceEntityID_1917c93cf6d9, p_SourceEntityID_Clear := TRUE, p_SourceFieldName := p_SourceFieldName_1917c93cf6d9, p_SourceFieldName_Clear := TRUE, p_IsComputed := p_IsComputed_1917c93cf6d9, p_ComputationDescription := p_ComputationDescription_1917c93cf6d9, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_1917c93cf6d9, p_SummaryDescription := p_SummaryDescription_1917c93cf6d9, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_1917c93cf6d9, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_1917c93cf6d9, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_1917c93cf6d9, p_SourceEntityFieldID_Clear := TRUE, p_IsNullable := p_IsNullable_1917c93cf6d9, p_SourceObjectName := p_SourceObjectName_1917c93cf6d9, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Parameters (core SP call only)
DO $mj$
DECLARE
  p_ID_c062f5aa20cd UUID;
  p_QueryID_c062f5aa20cd UUID;
  p_Name_c062f5aa20cd VARCHAR(255);
  p_Type_c062f5aa20cd VARCHAR(50);
  p_IsRequired_c062f5aa20cd BOOLEAN;
  p_DefaultValue_c062f5aa20cd TEXT;
  p_Description_c062f5aa20cd TEXT;
  p_SampleValue_c062f5aa20cd TEXT;
  p_ValidationFilters_c062f5aa20cd TEXT;
  p_DetectionMethod_c062f5aa20cd VARCHAR(50);
  p_AutoDetectConfidenceScore_c062f5aa20cd NUMERIC(3,2);
  p_IsServerSet_c062f5aa20cd BOOLEAN;
BEGIN
  p_ID_c062f5aa20cd := '0922a1ba-0681-42ba-a6c5-e9482549563a';
  p_QueryID_c062f5aa20cd := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_c062f5aa20cd := 'CompanyID';
  p_Type_c062f5aa20cd := 'string';
  p_IsRequired_c062f5aa20cd := FALSE;
  p_DetectionMethod_c062f5aa20cd := 'Parser';
  p_IsServerSet_c062f5aa20cd := FALSE;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryParameter"
                 WHERE "ID" = p_ID_c062f5aa20cd
                    OR ("QueryID" = p_QueryID_c062f5aa20cd AND "Name" = p_Name_c062f5aa20cd)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryParameter'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_data := jsonb_build_object(
    'ID', p_ID_c062f5aa20cd,
    'QueryID', p_QueryID_c062f5aa20cd,
    'Name', p_Name_c062f5aa20cd,
    'Type', p_Type_c062f5aa20cd,
    'IsRequired', p_IsRequired_c062f5aa20cd,
    'DefaultValue', p_DefaultValue_c062f5aa20cd,
    'Description', p_Description_c062f5aa20cd,
    'SampleValue', p_SampleValue_c062f5aa20cd,
    'ValidationFilters', p_ValidationFilters_c062f5aa20cd,
    'DetectionMethod', p_DetectionMethod_c062f5aa20cd,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_c062f5aa20cd,
    'IsServerSet', p_IsServerSet_c062f5aa20cd
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_ID := p_ID_c062f5aa20cd, p_QueryID := p_QueryID_c062f5aa20cd, p_Name := p_Name_c062f5aa20cd, p_Type := p_Type_c062f5aa20cd, p_IsRequired := p_IsRequired_c062f5aa20cd, p_DefaultValue := p_DefaultValue_c062f5aa20cd, p_DefaultValue_Clear := TRUE, p_Description := p_Description_c062f5aa20cd, p_Description_Clear := TRUE, p_SampleValue := p_SampleValue_c062f5aa20cd, p_SampleValue_Clear := TRUE, p_ValidationFilters := p_ValidationFilters_c062f5aa20cd, p_ValidationFilters_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_c062f5aa20cd, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_c062f5aa20cd, p_AutoDetectConfidenceScore_Clear := TRUE, p_IsServerSet := p_IsServerSet_c062f5aa20cd);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Parameters (core SP call only)
DO $mj$
DECLARE
  p_ID_37c6371c6abc UUID;
  p_QueryID_37c6371c6abc UUID;
  p_Name_37c6371c6abc VARCHAR(255);
  p_Type_37c6371c6abc VARCHAR(50);
  p_IsRequired_37c6371c6abc BOOLEAN;
  p_DefaultValue_37c6371c6abc TEXT;
  p_Description_37c6371c6abc TEXT;
  p_SampleValue_37c6371c6abc TEXT;
  p_ValidationFilters_37c6371c6abc TEXT;
  p_DetectionMethod_37c6371c6abc VARCHAR(50);
  p_AutoDetectConfidenceScore_37c6371c6abc NUMERIC(3,2);
  p_IsServerSet_37c6371c6abc BOOLEAN;
BEGIN
  p_ID_37c6371c6abc := 'd35e9f0d-372b-44c5-a466-13f73176e5fd';
  p_QueryID_37c6371c6abc := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_Name_37c6371c6abc := 'CompanyIDs';
  p_Type_37c6371c6abc := 'array';
  p_IsRequired_37c6371c6abc := FALSE;
  p_DetectionMethod_37c6371c6abc := 'Parser';
  p_IsServerSet_37c6371c6abc := FALSE;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryParameter"
                 WHERE "ID" = p_ID_37c6371c6abc
                    OR ("QueryID" = p_QueryID_37c6371c6abc AND "Name" = p_Name_37c6371c6abc)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryParameter'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_data := jsonb_build_object(
    'ID', p_ID_37c6371c6abc,
    'QueryID', p_QueryID_37c6371c6abc,
    'Name', p_Name_37c6371c6abc,
    'Type', p_Type_37c6371c6abc,
    'IsRequired', p_IsRequired_37c6371c6abc,
    'DefaultValue', p_DefaultValue_37c6371c6abc,
    'Description', p_Description_37c6371c6abc,
    'SampleValue', p_SampleValue_37c6371c6abc,
    'ValidationFilters', p_ValidationFilters_37c6371c6abc,
    'DetectionMethod', p_DetectionMethod_37c6371c6abc,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_37c6371c6abc,
    'IsServerSet', p_IsServerSet_37c6371c6abc
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_ID := p_ID_37c6371c6abc, p_QueryID := p_QueryID_37c6371c6abc, p_Name := p_Name_37c6371c6abc, p_Type := p_Type_37c6371c6abc, p_IsRequired := p_IsRequired_37c6371c6abc, p_DefaultValue := p_DefaultValue_37c6371c6abc, p_DefaultValue_Clear := TRUE, p_Description := p_Description_37c6371c6abc, p_Description_Clear := TRUE, p_SampleValue := p_SampleValue_37c6371c6abc, p_SampleValue_Clear := TRUE, p_ValidationFilters := p_ValidationFilters_37c6371c6abc, p_ValidationFilters_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_37c6371c6abc, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_37c6371c6abc, p_AutoDetectConfidenceScore_Clear := TRUE, p_IsServerSet := p_IsServerSet_37c6371c6abc);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_4d57fb8734a1 UUID;
  p_QueryID_4d57fb8734a1 UUID;
  p_EntityID_4d57fb8734a1 UUID;
  p_DetectionMethod_4d57fb8734a1 VARCHAR(50);
  p_AutoDetectConfidenceScore_4d57fb8734a1 NUMERIC(3,2);
  p_AlternateBaseViewID_4d57fb8734a1 UUID;
BEGIN
  p_ID_4d57fb8734a1 := 'e84b13d5-a5e2-4377-b19e-a1691e223e91';
  p_QueryID_4d57fb8734a1 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_EntityID_4d57fb8734a1 := 'FC529BC8-FF09-44A9-B454-26EAFDAC791B';
  p_DetectionMethod_4d57fb8734a1 := 'Parser';
  p_AutoDetectConfidenceScore_4d57fb8734a1 := 1;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
                 WHERE "ID" = p_ID_4d57fb8734a1
                    OR ("QueryID" = p_QueryID_4d57fb8734a1 AND "EntityID" = p_EntityID_4d57fb8734a1)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
    'ID', p_ID_4d57fb8734a1,
    'QueryID', p_QueryID_4d57fb8734a1,
    'EntityID', p_EntityID_4d57fb8734a1,
    'DetectionMethod', p_DetectionMethod_4d57fb8734a1,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_4d57fb8734a1,
    'AlternateBaseViewID', p_AlternateBaseViewID_4d57fb8734a1
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_4d57fb8734a1, p_QueryID := p_QueryID_4d57fb8734a1, p_EntityID := p_EntityID_4d57fb8734a1, p_DetectionMethod := p_DetectionMethod_4d57fb8734a1, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_4d57fb8734a1, p_AlternateBaseViewID := p_AlternateBaseViewID_4d57fb8734a1, p_AlternateBaseViewID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_7b722f42b662 UUID;
  p_QueryID_7b722f42b662 UUID;
  p_EntityID_7b722f42b662 UUID;
  p_DetectionMethod_7b722f42b662 VARCHAR(50);
  p_AutoDetectConfidenceScore_7b722f42b662 NUMERIC(3,2);
  p_AlternateBaseViewID_7b722f42b662 UUID;
BEGIN
  p_ID_7b722f42b662 := '909ed876-d33c-4f09-90f4-e7fd073c4d11';
  p_QueryID_7b722f42b662 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_EntityID_7b722f42b662 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_DetectionMethod_7b722f42b662 := 'Parser';
  p_AutoDetectConfidenceScore_7b722f42b662 := 1;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
                 WHERE "ID" = p_ID_7b722f42b662
                    OR ("QueryID" = p_QueryID_7b722f42b662 AND "EntityID" = p_EntityID_7b722f42b662)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
    'ID', p_ID_7b722f42b662,
    'QueryID', p_QueryID_7b722f42b662,
    'EntityID', p_EntityID_7b722f42b662,
    'DetectionMethod', p_DetectionMethod_7b722f42b662,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_7b722f42b662,
    'AlternateBaseViewID', p_AlternateBaseViewID_7b722f42b662
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_7b722f42b662, p_QueryID := p_QueryID_7b722f42b662, p_EntityID := p_EntityID_7b722f42b662, p_DetectionMethod := p_DetectionMethod_7b722f42b662, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_7b722f42b662, p_AlternateBaseViewID := p_AlternateBaseViewID_7b722f42b662, p_AlternateBaseViewID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_9d98efc66ced UUID;
  p_QueryID_9d98efc66ced UUID;
  p_EntityID_9d98efc66ced UUID;
  p_DetectionMethod_9d98efc66ced VARCHAR(50);
  p_AutoDetectConfidenceScore_9d98efc66ced NUMERIC(3,2);
  p_AlternateBaseViewID_9d98efc66ced UUID;
BEGIN
  p_ID_9d98efc66ced := '9dc5539f-af2f-4f76-bc60-00c6e09b6b1e';
  p_QueryID_9d98efc66ced := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_EntityID_9d98efc66ced := '27E8D79F-A8E2-4AC1-B208-5A0F11416197';
  p_DetectionMethod_9d98efc66ced := 'Parser';
  p_AutoDetectConfidenceScore_9d98efc66ced := 1;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
                 WHERE "ID" = p_ID_9d98efc66ced
                    OR ("QueryID" = p_QueryID_9d98efc66ced AND "EntityID" = p_EntityID_9d98efc66ced)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
    'ID', p_ID_9d98efc66ced,
    'QueryID', p_QueryID_9d98efc66ced,
    'EntityID', p_EntityID_9d98efc66ced,
    'DetectionMethod', p_DetectionMethod_9d98efc66ced,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_9d98efc66ced,
    'AlternateBaseViewID', p_AlternateBaseViewID_9d98efc66ced
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_9d98efc66ced, p_QueryID := p_QueryID_9d98efc66ced, p_EntityID := p_EntityID_9d98efc66ced, p_DetectionMethod := p_DetectionMethod_9d98efc66ced, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_9d98efc66ced, p_AlternateBaseViewID := p_AlternateBaseViewID_9d98efc66ced, p_AlternateBaseViewID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_8af058fb6740 UUID;
  p_QueryID_8af058fb6740 UUID;
  p_EntityID_8af058fb6740 UUID;
  p_DetectionMethod_8af058fb6740 VARCHAR(50);
  p_AutoDetectConfidenceScore_8af058fb6740 NUMERIC(3,2);
  p_AlternateBaseViewID_8af058fb6740 UUID;
BEGIN
  p_ID_8af058fb6740 := '17194d65-4698-4ceb-a386-1ab3b1e99f1b';
  p_QueryID_8af058fb6740 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_EntityID_8af058fb6740 := '5DEB0B11-ED6C-48B3-9200-F4441396C5E2';
  p_DetectionMethod_8af058fb6740 := 'Parser';
  p_AutoDetectConfidenceScore_8af058fb6740 := 1;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
                 WHERE "ID" = p_ID_8af058fb6740
                    OR ("QueryID" = p_QueryID_8af058fb6740 AND "EntityID" = p_EntityID_8af058fb6740)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
    'ID', p_ID_8af058fb6740,
    'QueryID', p_QueryID_8af058fb6740,
    'EntityID', p_EntityID_8af058fb6740,
    'DetectionMethod', p_DetectionMethod_8af058fb6740,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_8af058fb6740,
    'AlternateBaseViewID', p_AlternateBaseViewID_8af058fb6740
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_8af058fb6740, p_QueryID := p_QueryID_8af058fb6740, p_EntityID := p_EntityID_8af058fb6740, p_DetectionMethod := p_DetectionMethod_8af058fb6740, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_8af058fb6740, p_AlternateBaseViewID := p_AlternateBaseViewID_8af058fb6740, p_AlternateBaseViewID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_15ddebad80a7 UUID;
  p_QueryID_15ddebad80a7 UUID;
  p_EntityID_15ddebad80a7 UUID;
  p_DetectionMethod_15ddebad80a7 VARCHAR(50);
  p_AutoDetectConfidenceScore_15ddebad80a7 NUMERIC(3,2);
  p_AlternateBaseViewID_15ddebad80a7 UUID;
BEGIN
  p_ID_15ddebad80a7 := 'b4b2ec86-3087-4c2a-9990-3401639379d6';
  p_QueryID_15ddebad80a7 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_EntityID_15ddebad80a7 := 'C8909A57-6DDB-4585-BE00-E707C5B4F262';
  p_DetectionMethod_15ddebad80a7 := 'Parser';
  p_AutoDetectConfidenceScore_15ddebad80a7 := 1;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
                 WHERE "ID" = p_ID_15ddebad80a7
                    OR ("QueryID" = p_QueryID_15ddebad80a7 AND "EntityID" = p_EntityID_15ddebad80a7)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
    'ID', p_ID_15ddebad80a7,
    'QueryID', p_QueryID_15ddebad80a7,
    'EntityID', p_EntityID_15ddebad80a7,
    'DetectionMethod', p_DetectionMethod_15ddebad80a7,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_15ddebad80a7,
    'AlternateBaseViewID', p_AlternateBaseViewID_15ddebad80a7
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_15ddebad80a7, p_QueryID := p_QueryID_15ddebad80a7, p_EntityID := p_EntityID_15ddebad80a7, p_DetectionMethod := p_DetectionMethod_15ddebad80a7, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_15ddebad80a7, p_AlternateBaseViewID := p_AlternateBaseViewID_15ddebad80a7, p_AlternateBaseViewID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_c3abd4074109 UUID;
  p_QueryID_c3abd4074109 UUID;
  p_EntityID_c3abd4074109 UUID;
  p_DetectionMethod_c3abd4074109 VARCHAR(50);
  p_AutoDetectConfidenceScore_c3abd4074109 NUMERIC(3,2);
  p_AlternateBaseViewID_c3abd4074109 UUID;
BEGIN
  p_ID_c3abd4074109 := '4fb92e53-08c8-4743-a20f-13d86c9e95e8';
  p_QueryID_c3abd4074109 := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  p_EntityID_c3abd4074109 := '66D82C24-9C9F-4CD6-B019-53C20274AB00';
  p_DetectionMethod_c3abd4074109 := 'Parser';
  p_AutoDetectConfidenceScore_c3abd4074109 := 1;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
                 WHERE "ID" = p_ID_c3abd4074109
                    OR ("QueryID" = p_QueryID_c3abd4074109 AND "EntityID" = p_EntityID_c3abd4074109)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
    'ID', p_ID_c3abd4074109,
    'QueryID', p_QueryID_c3abd4074109,
    'EntityID', p_EntityID_c3abd4074109,
    'DetectionMethod', p_DetectionMethod_c3abd4074109,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_c3abd4074109,
    'AlternateBaseViewID', p_AlternateBaseViewID_c3abd4074109
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_c3abd4074109, p_QueryID := p_QueryID_c3abd4074109, p_EntityID := p_EntityID_c3abd4074109, p_DetectionMethod := p_DetectionMethod_c3abd4074109, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_c3abd4074109, p_AlternateBaseViewID := p_AlternateBaseViewID_c3abd4074109, p_AlternateBaseViewID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_ApprovedFingerprint_aa249e805c8d VARCHAR(100);
  p_ID_aa249e805c8d UUID;
BEGIN
  p_ApprovedFingerprint_aa249e805c8d := '703b01f6bfd651a7903665d9b568c65e61be2174696a4b565eba58b1dd2f0fff';
  p_ID_aa249e805c8d := '41FF0F8F-D263-407B-9164-2C5BDE21D8B7';
  -- Set only while the query has no approved fingerprint, so a host's own approval is kept.
  IF EXISTS (SELECT 1 FROM "${mjSchema}"."Query"
             WHERE "ID" = p_ID_aa249e805c8d AND "ApprovedFingerprint" IS NULL) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQuery'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spUpdateQuery"(p_data := jsonb_build_object(
      'ApprovedFingerprint', p_ApprovedFingerprint_aa249e805c8d,
      'ID', p_ID_aa249e805c8d
    ));
    ELSE
      PERFORM "${mjSchema}"."spUpdateQuery"(p_ApprovedFingerprint := p_ApprovedFingerprint_aa249e805c8d, p_ID := p_ID_aa249e805c8d);
    END IF;
  END IF;
END $mj$;
