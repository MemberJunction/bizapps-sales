-- =============================================================================================
-- PostgreSQL counterpart of V202611131630__v6.31.x__Metadata_Sync.sql
-- =============================================================================================
-- Same records, same values as the T-SQL file; see its header for what ships and why.
--
-- HOW IT WAS MADE: `mj sql-convert --from tsql --to postgres` (MJ CLI 6.2.1) on each block of the
-- push log, one block per run. Each create block's guard is then widened to match the T-SQL file
-- (ID, or the natural key) and its update branch removed, so every record is create-only. The query
-- category and the query fields' source entity fields are resolved on the target database as in
-- the T-SQL file, and each approved fingerprint is set only while the query has none. Core
-- references use ${mjSchema}. String values the converter rewrote are restored verbatim from the
-- T-SQL file. The Sales Contacts FirstName block resolves its field by entity name + field name.
-- =============================================================================================

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_ID_a865a1b0f501 UUID;
  p_Name_a865a1b0f501 VARCHAR(255);
  p_CategoryID_a865a1b0f501 UUID;
  p_UserQuestion_a865a1b0f501 TEXT;
  p_Description_a865a1b0f501 TEXT;
  p_SQL_a865a1b0f501 TEXT;
  p_TechnicalDescription_a865a1b0f501 TEXT;
  p_OriginalSQL_a865a1b0f501 TEXT;
  p_Feedback_a865a1b0f501 TEXT;
  p_Status_a865a1b0f501 VARCHAR(15);
  p_QualityRank_a865a1b0f501 INTEGER;
  p_ExecutionCostRank_a865a1b0f501 INTEGER;
  p_UsesTemplate_a865a1b0f501 BOOLEAN;
  p_AuditQueryRuns_a865a1b0f501 BOOLEAN;
  p_CacheEnabled_a865a1b0f501 BOOLEAN;
  p_CacheTTLMinutes_a865a1b0f501 INTEGER;
  p_CacheMaxSize_a865a1b0f501 INTEGER;
  p_EmbeddingVector_a865a1b0f501 TEXT;
  p_EmbeddingModelID_a865a1b0f501 UUID;
  p_CacheValidationSQL_a865a1b0f501 TEXT;
  p_SQLDialectID_a865a1b0f501 UUID;
  p_Reusable_a865a1b0f501 BOOLEAN;
  p_ExternalDataSourceID_a865a1b0f501 UUID;
  p_IsMaterialized_a865a1b0f501 BOOLEAN;
  p_Configuration_a865a1b0f501 TEXT;
  p_EmbeddingVectorBinary_a865a1b0f501 BYTEA;
  p_ApprovalComments_a865a1b0f501 TEXT;
  p_ApprovedByUserID_a865a1b0f501 UUID;
  p_ApprovedAt_a865a1b0f501 TIMESTAMPTZ;
  p_ApprovedFingerprint_a865a1b0f501 VARCHAR(100);
  p_ExtractedSQLHash_a865a1b0f501 VARCHAR(64);
  p_ExtractionStatus_a865a1b0f501 VARCHAR(20);
  p_ExtractionMessage_a865a1b0f501 TEXT;
BEGIN
  p_ID_a865a1b0f501 := '18456E6E-A8E6-4852-990B-713E1EACCAF2';
  p_Name_a865a1b0f501 := 'Sales: Party Lookup Promotable Accounts';
  -- The Sales query category this app ships, found by name with its own ID first: a database can
  -- hold more than one category named Sales.
  p_CategoryID_a865a1b0f501 := COALESCE((SELECT "ID" FROM "${mjSchema}"."QueryCategory" WHERE "Name" = 'Sales' ORDER BY CASE WHEN "ID" = '5A1E5000-0000-4000-A000-000000000001' THEN 0 ELSE 1 END LIMIT 1), '5A1E5000-0000-4000-A000-000000000001');
  p_UserQuestion_a865a1b0f501 := 'Which organizations could be added as sales accounts?';
  p_Description_a865a1b0f501 := 'Search for the promote dialog: organizations that do NOT yet have a sales account row, whose name, legal name, acronym or website domain starts with the term.';
  p_SQL_a865a1b0f501 := '-- Promote picker (D-PR3): the EXACT COMPLEMENT of "Sales: Party Lookup Accounts" -- organizations that
-- do NOT have a SalesAccount row, and so cannot yet be a deal''s customer. The two queries differ in one
-- token, EXISTS against NOT EXISTS, and that is deliberate: a rep who cannot find a company in the
-- account picker is looking at a company this query returns, and creating a duplicate is the failure
-- this pair exists to prevent (bc-aidp-next-golive#259).
--
-- WHY THIS IS A SEPARATE QUERY RATHER THAN A RELAXED FILTER ON THE OTHER ONE: the account picker is
-- common''s bizapps-party-field, which has no way to mark a row as unselectable and no BeforeSelect hook.
-- Returning a promotable organization THERE would let a rep pick one, setting Deal.AccountID to a row the
-- server must refuse -- which is what PL1 and PL3 assert against. Promotion happens in a sales-owned
-- dialog that reads this query instead, so the picker''s guarantee is untouched.
--
-- Result contract shared by every party lookup query: ID, Name, Detail; parameters Term (required) and
-- Domain (optional, set by the caller when the term looks like a web address).
-- Prefix matches on indexed base columns only, TOP 20, no view, no count. sqlLikeBegins escapes %, _ and [ (and drops a trailing %).
-- Detail shows the acronym and the website domain ("NAR · nar.realtor"), whichever exist, so two
-- organizations with the same name can be told apart. Each operand goes through NULLIF so a stored empty
-- string is skipped like NULL (CONCAT_WS skips NULLs only).
SELECT TOP 20
    o.ID,
    o.Name,
    NULLIF(CONCAT_WS(N'' · '', NULLIF(o.Acronym, N''''), NULLIF(o.WebsiteDomain, N'''')), N'''') AS Detail
FROM [__mj_BizAppsCommon].Organization o
WHERE (
       o.Name      LIKE {{ Term | sqlLikeBegins }}
    OR o.LegalName LIKE {{ Term | sqlLikeBegins }}
    OR o.Acronym   LIKE {{ Term | sqlLikeBegins }}
    {% if Domain %}
    OR o.WebsiteDomain LIKE {{ Domain | sqlLikeBegins }}
    {% endif %}
)
  AND NOT EXISTS (SELECT 1 FROM [__mj_BizAppsSales].SalesAccount sa WHERE sa.ID = o.ID)
ORDER BY o.Name, o.ID
';
  p_TechnicalDescription_a865a1b0f501 := 'Grain: Organization WITHOUT a SalesAccount row -- the exact complement of ''Sales: Party Lookup Accounts'', differing only in EXISTS vs NOT EXISTS. Party lookup contract (bc-aidp-next-golive#372): columns ID, Name, Detail (Acronym and WebsiteDomain joined by '' · '', whichever are set); parameters Term (required) and Domain (optional; matched against Organization.WebsiteDomain). Prefix LIKE on indexed base columns (Name, LegalName, Acronym, WebsiteDomain), TOP 20 ordered by Name, no view and no count. Read by the sales-owned promote dialog, NOT by bizapps-party-field: that control cannot mark a row unselectable, so a promotable organization must never reach the deal''s account picker (PL1/PL3).';
  p_Status_a865a1b0f501 := 'Approved';
  p_QualityRank_a865a1b0f501 := 8;
  p_ExecutionCostRank_a865a1b0f501 := 1;
  p_UsesTemplate_a865a1b0f501 := TRUE;
  p_AuditQueryRuns_a865a1b0f501 := FALSE;
  p_CacheEnabled_a865a1b0f501 := FALSE;
  p_Reusable_a865a1b0f501 := FALSE;
  p_IsMaterialized_a865a1b0f501 := FALSE;
  p_ApprovedByUserID_a865a1b0f501 := 'ECAFCCEC-6A37-EF11-86D4-000D3A4E707E';
  p_ApprovedAt_a865a1b0f501 := '2026-11-13T16:45:21.289Z';
  p_ExtractedSQLHash_a865a1b0f501 := 'ff53adeced492817fdf6677f4e3a2516268ca6c926521334f11189e1e17caa29';
  p_ExtractionStatus_a865a1b0f501 := 'OK';
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."Query"
                 WHERE "ID" = p_ID_a865a1b0f501
                    OR ("CategoryID" = p_CategoryID_a865a1b0f501 AND "Name" = p_Name_a865a1b0f501)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQuery'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQuery"(p_data := jsonb_build_object(
    'ID', p_ID_a865a1b0f501,
    'Name', p_Name_a865a1b0f501,
    'CategoryID', p_CategoryID_a865a1b0f501,
    'UserQuestion', p_UserQuestion_a865a1b0f501,
    'Description', p_Description_a865a1b0f501,
    'SQL', p_SQL_a865a1b0f501,
    'TechnicalDescription', p_TechnicalDescription_a865a1b0f501,
    'OriginalSQL', p_OriginalSQL_a865a1b0f501,
    'Feedback', p_Feedback_a865a1b0f501,
    'Status', p_Status_a865a1b0f501,
    'QualityRank', p_QualityRank_a865a1b0f501,
    'ExecutionCostRank', p_ExecutionCostRank_a865a1b0f501,
    'UsesTemplate', p_UsesTemplate_a865a1b0f501,
    'AuditQueryRuns', p_AuditQueryRuns_a865a1b0f501,
    'CacheEnabled', p_CacheEnabled_a865a1b0f501,
    'CacheTTLMinutes', p_CacheTTLMinutes_a865a1b0f501,
    'CacheMaxSize', p_CacheMaxSize_a865a1b0f501,
    'EmbeddingVector', p_EmbeddingVector_a865a1b0f501,
    'EmbeddingModelID', p_EmbeddingModelID_a865a1b0f501,
    'CacheValidationSQL', p_CacheValidationSQL_a865a1b0f501,
    'SQLDialectID', p_SQLDialectID_a865a1b0f501,
    'Reusable', p_Reusable_a865a1b0f501,
    'ExternalDataSourceID', p_ExternalDataSourceID_a865a1b0f501,
    'IsMaterialized', p_IsMaterialized_a865a1b0f501,
    'Configuration', p_Configuration_a865a1b0f501,
    'EmbeddingVectorBinary', p_EmbeddingVectorBinary_a865a1b0f501,
    'ApprovalComments', p_ApprovalComments_a865a1b0f501,
    'ApprovedByUserID', p_ApprovedByUserID_a865a1b0f501,
    'ApprovedAt', p_ApprovedAt_a865a1b0f501,
    'ApprovedFingerprint', p_ApprovedFingerprint_a865a1b0f501,
    'ExtractedSQLHash', p_ExtractedSQLHash_a865a1b0f501,
    'ExtractionStatus', p_ExtractionStatus_a865a1b0f501,
    'ExtractionMessage', p_ExtractionMessage_a865a1b0f501
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQuery"(p_ID := p_ID_a865a1b0f501, p_Name := p_Name_a865a1b0f501, p_CategoryID := p_CategoryID_a865a1b0f501, p_UserQuestion := p_UserQuestion_a865a1b0f501, p_Description := p_Description_a865a1b0f501, p_SQL := p_SQL_a865a1b0f501, p_TechnicalDescription := p_TechnicalDescription_a865a1b0f501, p_OriginalSQL := p_OriginalSQL_a865a1b0f501, p_OriginalSQL_Clear := TRUE, p_Feedback := p_Feedback_a865a1b0f501, p_Feedback_Clear := TRUE, p_Status := p_Status_a865a1b0f501, p_QualityRank := p_QualityRank_a865a1b0f501, p_ExecutionCostRank := p_ExecutionCostRank_a865a1b0f501, p_UsesTemplate := p_UsesTemplate_a865a1b0f501, p_AuditQueryRuns := p_AuditQueryRuns_a865a1b0f501, p_CacheEnabled := p_CacheEnabled_a865a1b0f501, p_CacheTTLMinutes := p_CacheTTLMinutes_a865a1b0f501, p_CacheTTLMinutes_Clear := TRUE, p_CacheMaxSize := p_CacheMaxSize_a865a1b0f501, p_CacheMaxSize_Clear := TRUE, p_EmbeddingVector := p_EmbeddingVector_a865a1b0f501, p_EmbeddingVector_Clear := TRUE, p_EmbeddingModelID := p_EmbeddingModelID_a865a1b0f501, p_EmbeddingModelID_Clear := TRUE, p_CacheValidationSQL := p_CacheValidationSQL_a865a1b0f501, p_CacheValidationSQL_Clear := TRUE, p_SQLDialectID := p_SQLDialectID_a865a1b0f501, p_Reusable := p_Reusable_a865a1b0f501, p_ExternalDataSourceID := p_ExternalDataSourceID_a865a1b0f501, p_ExternalDataSourceID_Clear := TRUE, p_IsMaterialized := p_IsMaterialized_a865a1b0f501, p_Configuration := p_Configuration_a865a1b0f501, p_Configuration_Clear := TRUE, p_EmbeddingVectorBinary := p_EmbeddingVectorBinary_a865a1b0f501, p_EmbeddingVectorBinary_Clear := TRUE, p_ApprovalComments := p_ApprovalComments_a865a1b0f501, p_ApprovalComments_Clear := TRUE, p_ApprovedByUserID := p_ApprovedByUserID_a865a1b0f501, p_ApprovedAt := p_ApprovedAt_a865a1b0f501, p_ApprovedFingerprint := p_ApprovedFingerprint_a865a1b0f501, p_ApprovedFingerprint_Clear := TRUE, p_ExtractedSQLHash := p_ExtractedSQLHash_a865a1b0f501, p_ExtractionStatus := p_ExtractionStatus_a865a1b0f501, p_ExtractionMessage := p_ExtractionMessage_a865a1b0f501, p_ExtractionMessage_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_7754f6b1c629 UUID;
  p_QueryID_7754f6b1c629 UUID;
  p_Name_7754f6b1c629 VARCHAR(255);
  p_Description_7754f6b1c629 TEXT;
  p_Sequence_7754f6b1c629 INTEGER;
  p_SQLBaseType_7754f6b1c629 VARCHAR(50);
  p_SQLFullType_7754f6b1c629 VARCHAR(100);
  p_SourceEntityID_7754f6b1c629 UUID;
  p_SourceFieldName_7754f6b1c629 VARCHAR(255);
  p_IsComputed_7754f6b1c629 BOOLEAN;
  p_ComputationDescription_7754f6b1c629 TEXT;
  p_IsSummary_7754f6b1c629 BOOLEAN;
  p_SummaryDescription_7754f6b1c629 TEXT;
  p_DetectionMethod_7754f6b1c629 VARCHAR(50);
  p_AutoDetectConfidenceScore_7754f6b1c629 NUMERIC(3,2);
  p_SourceEntityFieldID_7754f6b1c629 UUID;
  p_IsNullable_7754f6b1c629 BOOLEAN;
  p_SourceObjectName_7754f6b1c629 VARCHAR(500);
BEGIN
  p_ID_7754f6b1c629 := '09932439-f38e-4cb4-be6e-3dee779b3dad';
  p_QueryID_7754f6b1c629 := '18456E6E-A8E6-4852-990B-713E1EACCAF2';
  p_Name_7754f6b1c629 := 'ID';
  p_Sequence_7754f6b1c629 := 1;
  p_SQLBaseType_7754f6b1c629 := 'uniqueidentifier';
  p_SQLFullType_7754f6b1c629 := 'uniqueidentifier';
  p_SourceEntityID_7754f6b1c629 := 'C70448F9-9792-41D7-A82C-784B66429D54';
  p_SourceFieldName_7754f6b1c629 := 'ID';
  p_IsComputed_7754f6b1c629 := FALSE;
  p_IsSummary_7754f6b1c629 := FALSE;
  p_DetectionMethod_7754f6b1c629 := 'Database';
  p_SourceEntityFieldID_7754f6b1c629 := 'B194EE44-85DB-4D2A-A76F-9FEB0B5F1AEB';
  p_IsNullable_7754f6b1c629 := FALSE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_7754f6b1c629 := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_7754f6b1c629 AND "Name" = p_SourceFieldName_7754f6b1c629
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_7754f6b1c629 THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_7754f6b1c629
                    OR ("QueryID" = p_QueryID_7754f6b1c629 AND "Name" = p_Name_7754f6b1c629)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_7754f6b1c629,
    'QueryID', p_QueryID_7754f6b1c629,
    'Name', p_Name_7754f6b1c629,
    'Description', p_Description_7754f6b1c629,
    'Sequence', p_Sequence_7754f6b1c629,
    'SQLBaseType', p_SQLBaseType_7754f6b1c629,
    'SQLFullType', p_SQLFullType_7754f6b1c629,
    'SourceEntityID', p_SourceEntityID_7754f6b1c629,
    'SourceFieldName', p_SourceFieldName_7754f6b1c629,
    'IsComputed', p_IsComputed_7754f6b1c629,
    'ComputationDescription', p_ComputationDescription_7754f6b1c629,
    'IsSummary', p_IsSummary_7754f6b1c629,
    'SummaryDescription', p_SummaryDescription_7754f6b1c629,
    'DetectionMethod', p_DetectionMethod_7754f6b1c629,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_7754f6b1c629,
    'SourceEntityFieldID', p_SourceEntityFieldID_7754f6b1c629,
    'IsNullable', p_IsNullable_7754f6b1c629,
    'SourceObjectName', p_SourceObjectName_7754f6b1c629
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_7754f6b1c629, p_QueryID := p_QueryID_7754f6b1c629, p_Name := p_Name_7754f6b1c629, p_Description := p_Description_7754f6b1c629, p_Description_Clear := TRUE, p_Sequence := p_Sequence_7754f6b1c629, p_SQLBaseType := p_SQLBaseType_7754f6b1c629, p_SQLFullType := p_SQLFullType_7754f6b1c629, p_SourceEntityID := p_SourceEntityID_7754f6b1c629, p_SourceFieldName := p_SourceFieldName_7754f6b1c629, p_IsComputed := p_IsComputed_7754f6b1c629, p_ComputationDescription := p_ComputationDescription_7754f6b1c629, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_7754f6b1c629, p_SummaryDescription := p_SummaryDescription_7754f6b1c629, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_7754f6b1c629, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_7754f6b1c629, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_7754f6b1c629, p_IsNullable := p_IsNullable_7754f6b1c629, p_SourceObjectName := p_SourceObjectName_7754f6b1c629, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_0f0e23a262a0 UUID;
  p_QueryID_0f0e23a262a0 UUID;
  p_Name_0f0e23a262a0 VARCHAR(255);
  p_Description_0f0e23a262a0 TEXT;
  p_Sequence_0f0e23a262a0 INTEGER;
  p_SQLBaseType_0f0e23a262a0 VARCHAR(50);
  p_SQLFullType_0f0e23a262a0 VARCHAR(100);
  p_SourceEntityID_0f0e23a262a0 UUID;
  p_SourceFieldName_0f0e23a262a0 VARCHAR(255);
  p_IsComputed_0f0e23a262a0 BOOLEAN;
  p_ComputationDescription_0f0e23a262a0 TEXT;
  p_IsSummary_0f0e23a262a0 BOOLEAN;
  p_SummaryDescription_0f0e23a262a0 TEXT;
  p_DetectionMethod_0f0e23a262a0 VARCHAR(50);
  p_AutoDetectConfidenceScore_0f0e23a262a0 NUMERIC(3,2);
  p_SourceEntityFieldID_0f0e23a262a0 UUID;
  p_IsNullable_0f0e23a262a0 BOOLEAN;
  p_SourceObjectName_0f0e23a262a0 VARCHAR(500);
BEGIN
  p_ID_0f0e23a262a0 := '8d5dc0c5-3d62-41bf-9b7d-17973e05098d';
  p_QueryID_0f0e23a262a0 := '18456E6E-A8E6-4852-990B-713E1EACCAF2';
  p_Name_0f0e23a262a0 := 'Name';
  p_Description_0f0e23a262a0 := 'Common or display name of the organization';
  p_Sequence_0f0e23a262a0 := 2;
  p_SQLBaseType_0f0e23a262a0 := 'nvarchar';
  p_SQLFullType_0f0e23a262a0 := 'nvarchar(255)';
  p_SourceEntityID_0f0e23a262a0 := 'C70448F9-9792-41D7-A82C-784B66429D54';
  p_SourceFieldName_0f0e23a262a0 := 'Name';
  p_IsComputed_0f0e23a262a0 := FALSE;
  p_IsSummary_0f0e23a262a0 := FALSE;
  p_DetectionMethod_0f0e23a262a0 := 'Database';
  p_SourceEntityFieldID_0f0e23a262a0 := '9F465E98-0614-4987-BED8-90B8A1450685';
  p_IsNullable_0f0e23a262a0 := FALSE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_0f0e23a262a0 := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_0f0e23a262a0 AND "Name" = p_SourceFieldName_0f0e23a262a0
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_0f0e23a262a0 THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_0f0e23a262a0
                    OR ("QueryID" = p_QueryID_0f0e23a262a0 AND "Name" = p_Name_0f0e23a262a0)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_0f0e23a262a0,
    'QueryID', p_QueryID_0f0e23a262a0,
    'Name', p_Name_0f0e23a262a0,
    'Description', p_Description_0f0e23a262a0,
    'Sequence', p_Sequence_0f0e23a262a0,
    'SQLBaseType', p_SQLBaseType_0f0e23a262a0,
    'SQLFullType', p_SQLFullType_0f0e23a262a0,
    'SourceEntityID', p_SourceEntityID_0f0e23a262a0,
    'SourceFieldName', p_SourceFieldName_0f0e23a262a0,
    'IsComputed', p_IsComputed_0f0e23a262a0,
    'ComputationDescription', p_ComputationDescription_0f0e23a262a0,
    'IsSummary', p_IsSummary_0f0e23a262a0,
    'SummaryDescription', p_SummaryDescription_0f0e23a262a0,
    'DetectionMethod', p_DetectionMethod_0f0e23a262a0,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_0f0e23a262a0,
    'SourceEntityFieldID', p_SourceEntityFieldID_0f0e23a262a0,
    'IsNullable', p_IsNullable_0f0e23a262a0,
    'SourceObjectName', p_SourceObjectName_0f0e23a262a0
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_0f0e23a262a0, p_QueryID := p_QueryID_0f0e23a262a0, p_Name := p_Name_0f0e23a262a0, p_Description := p_Description_0f0e23a262a0, p_Sequence := p_Sequence_0f0e23a262a0, p_SQLBaseType := p_SQLBaseType_0f0e23a262a0, p_SQLFullType := p_SQLFullType_0f0e23a262a0, p_SourceEntityID := p_SourceEntityID_0f0e23a262a0, p_SourceFieldName := p_SourceFieldName_0f0e23a262a0, p_IsComputed := p_IsComputed_0f0e23a262a0, p_ComputationDescription := p_ComputationDescription_0f0e23a262a0, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_0f0e23a262a0, p_SummaryDescription := p_SummaryDescription_0f0e23a262a0, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_0f0e23a262a0, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_0f0e23a262a0, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_0f0e23a262a0, p_IsNullable := p_IsNullable_0f0e23a262a0, p_SourceObjectName := p_SourceObjectName_0f0e23a262a0, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_d59a25b3d65b UUID;
  p_QueryID_d59a25b3d65b UUID;
  p_Name_d59a25b3d65b VARCHAR(255);
  p_Description_d59a25b3d65b TEXT;
  p_Sequence_d59a25b3d65b INTEGER;
  p_SQLBaseType_d59a25b3d65b VARCHAR(50);
  p_SQLFullType_d59a25b3d65b VARCHAR(100);
  p_SourceEntityID_d59a25b3d65b UUID;
  p_SourceFieldName_d59a25b3d65b VARCHAR(255);
  p_IsComputed_d59a25b3d65b BOOLEAN;
  p_ComputationDescription_d59a25b3d65b TEXT;
  p_IsSummary_d59a25b3d65b BOOLEAN;
  p_SummaryDescription_d59a25b3d65b TEXT;
  p_DetectionMethod_d59a25b3d65b VARCHAR(50);
  p_AutoDetectConfidenceScore_d59a25b3d65b NUMERIC(3,2);
  p_SourceEntityFieldID_d59a25b3d65b UUID;
  p_IsNullable_d59a25b3d65b BOOLEAN;
  p_SourceObjectName_d59a25b3d65b VARCHAR(500);
BEGIN
  p_ID_d59a25b3d65b := '0791e09a-1dd8-49aa-a0ba-a7acbe8a4112';
  p_QueryID_d59a25b3d65b := '18456E6E-A8E6-4852-990B-713E1EACCAF2';
  p_Name_d59a25b3d65b := 'Detail';
  p_Sequence_d59a25b3d65b := 3;
  p_SQLBaseType_d59a25b3d65b := 'nvarchar';
  p_SQLFullType_d59a25b3d65b := 'nvarchar(278)';
  p_IsComputed_d59a25b3d65b := TRUE;
  p_IsSummary_d59a25b3d65b := FALSE;
  p_DetectionMethod_d59a25b3d65b := 'Database';
  p_IsNullable_d59a25b3d65b := TRUE;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_d59a25b3d65b
                    OR ("QueryID" = p_QueryID_d59a25b3d65b AND "Name" = p_Name_d59a25b3d65b)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_d59a25b3d65b,
    'QueryID', p_QueryID_d59a25b3d65b,
    'Name', p_Name_d59a25b3d65b,
    'Description', p_Description_d59a25b3d65b,
    'Sequence', p_Sequence_d59a25b3d65b,
    'SQLBaseType', p_SQLBaseType_d59a25b3d65b,
    'SQLFullType', p_SQLFullType_d59a25b3d65b,
    'SourceEntityID', p_SourceEntityID_d59a25b3d65b,
    'SourceFieldName', p_SourceFieldName_d59a25b3d65b,
    'IsComputed', p_IsComputed_d59a25b3d65b,
    'ComputationDescription', p_ComputationDescription_d59a25b3d65b,
    'IsSummary', p_IsSummary_d59a25b3d65b,
    'SummaryDescription', p_SummaryDescription_d59a25b3d65b,
    'DetectionMethod', p_DetectionMethod_d59a25b3d65b,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_d59a25b3d65b,
    'SourceEntityFieldID', p_SourceEntityFieldID_d59a25b3d65b,
    'IsNullable', p_IsNullable_d59a25b3d65b,
    'SourceObjectName', p_SourceObjectName_d59a25b3d65b
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_d59a25b3d65b, p_QueryID := p_QueryID_d59a25b3d65b, p_Name := p_Name_d59a25b3d65b, p_Description := p_Description_d59a25b3d65b, p_Description_Clear := TRUE, p_Sequence := p_Sequence_d59a25b3d65b, p_SQLBaseType := p_SQLBaseType_d59a25b3d65b, p_SQLFullType := p_SQLFullType_d59a25b3d65b, p_SourceEntityID := p_SourceEntityID_d59a25b3d65b, p_SourceEntityID_Clear := TRUE, p_SourceFieldName := p_SourceFieldName_d59a25b3d65b, p_SourceFieldName_Clear := TRUE, p_IsComputed := p_IsComputed_d59a25b3d65b, p_ComputationDescription := p_ComputationDescription_d59a25b3d65b, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_d59a25b3d65b, p_SummaryDescription := p_SummaryDescription_d59a25b3d65b, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_d59a25b3d65b, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_d59a25b3d65b, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_d59a25b3d65b, p_SourceEntityFieldID_Clear := TRUE, p_IsNullable := p_IsNullable_d59a25b3d65b, p_SourceObjectName := p_SourceObjectName_d59a25b3d65b, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Parameters (core SP call only)
DO $mj$
DECLARE
  p_ID_5b275f8b51c0 UUID;
  p_QueryID_5b275f8b51c0 UUID;
  p_Name_5b275f8b51c0 VARCHAR(255);
  p_Type_5b275f8b51c0 VARCHAR(50);
  p_IsRequired_5b275f8b51c0 BOOLEAN;
  p_DefaultValue_5b275f8b51c0 TEXT;
  p_Description_5b275f8b51c0 TEXT;
  p_SampleValue_5b275f8b51c0 TEXT;
  p_ValidationFilters_5b275f8b51c0 TEXT;
  p_DetectionMethod_5b275f8b51c0 VARCHAR(50);
  p_AutoDetectConfidenceScore_5b275f8b51c0 NUMERIC(3,2);
  p_IsServerSet_5b275f8b51c0 BOOLEAN;
BEGIN
  p_ID_5b275f8b51c0 := 'ae8028a8-ff6f-4938-b5d8-daf21433e9ff';
  p_QueryID_5b275f8b51c0 := '18456E6E-A8E6-4852-990B-713E1EACCAF2';
  p_Name_5b275f8b51c0 := 'Term';
  p_Type_5b275f8b51c0 := 'string';
  p_IsRequired_5b275f8b51c0 := TRUE;
  p_DetectionMethod_5b275f8b51c0 := 'Parser';
  p_IsServerSet_5b275f8b51c0 := FALSE;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryParameter"
                 WHERE "ID" = p_ID_5b275f8b51c0
                    OR ("QueryID" = p_QueryID_5b275f8b51c0 AND "Name" = p_Name_5b275f8b51c0)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryParameter'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_data := jsonb_build_object(
    'ID', p_ID_5b275f8b51c0,
    'QueryID', p_QueryID_5b275f8b51c0,
    'Name', p_Name_5b275f8b51c0,
    'Type', p_Type_5b275f8b51c0,
    'IsRequired', p_IsRequired_5b275f8b51c0,
    'DefaultValue', p_DefaultValue_5b275f8b51c0,
    'Description', p_Description_5b275f8b51c0,
    'SampleValue', p_SampleValue_5b275f8b51c0,
    'ValidationFilters', p_ValidationFilters_5b275f8b51c0,
    'DetectionMethod', p_DetectionMethod_5b275f8b51c0,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_5b275f8b51c0,
    'IsServerSet', p_IsServerSet_5b275f8b51c0
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_ID := p_ID_5b275f8b51c0, p_QueryID := p_QueryID_5b275f8b51c0, p_Name := p_Name_5b275f8b51c0, p_Type := p_Type_5b275f8b51c0, p_IsRequired := p_IsRequired_5b275f8b51c0, p_DefaultValue := p_DefaultValue_5b275f8b51c0, p_DefaultValue_Clear := TRUE, p_Description := p_Description_5b275f8b51c0, p_Description_Clear := TRUE, p_SampleValue := p_SampleValue_5b275f8b51c0, p_SampleValue_Clear := TRUE, p_ValidationFilters := p_ValidationFilters_5b275f8b51c0, p_ValidationFilters_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_5b275f8b51c0, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_5b275f8b51c0, p_AutoDetectConfidenceScore_Clear := TRUE, p_IsServerSet := p_IsServerSet_5b275f8b51c0);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Parameters (core SP call only)
DO $mj$
DECLARE
  p_ID_65d08ec88601 UUID;
  p_QueryID_65d08ec88601 UUID;
  p_Name_65d08ec88601 VARCHAR(255);
  p_Type_65d08ec88601 VARCHAR(50);
  p_IsRequired_65d08ec88601 BOOLEAN;
  p_DefaultValue_65d08ec88601 TEXT;
  p_Description_65d08ec88601 TEXT;
  p_SampleValue_65d08ec88601 TEXT;
  p_ValidationFilters_65d08ec88601 TEXT;
  p_DetectionMethod_65d08ec88601 VARCHAR(50);
  p_AutoDetectConfidenceScore_65d08ec88601 NUMERIC(3,2);
  p_IsServerSet_65d08ec88601 BOOLEAN;
BEGIN
  p_ID_65d08ec88601 := '8912af16-f502-4976-86bd-4cc82a65da4b';
  p_QueryID_65d08ec88601 := '18456E6E-A8E6-4852-990B-713E1EACCAF2';
  p_Name_65d08ec88601 := 'Domain';
  p_Type_65d08ec88601 := 'string';
  p_IsRequired_65d08ec88601 := FALSE;
  p_DetectionMethod_65d08ec88601 := 'Parser';
  p_IsServerSet_65d08ec88601 := FALSE;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryParameter"
                 WHERE "ID" = p_ID_65d08ec88601
                    OR ("QueryID" = p_QueryID_65d08ec88601 AND "Name" = p_Name_65d08ec88601)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryParameter'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_data := jsonb_build_object(
    'ID', p_ID_65d08ec88601,
    'QueryID', p_QueryID_65d08ec88601,
    'Name', p_Name_65d08ec88601,
    'Type', p_Type_65d08ec88601,
    'IsRequired', p_IsRequired_65d08ec88601,
    'DefaultValue', p_DefaultValue_65d08ec88601,
    'Description', p_Description_65d08ec88601,
    'SampleValue', p_SampleValue_65d08ec88601,
    'ValidationFilters', p_ValidationFilters_65d08ec88601,
    'DetectionMethod', p_DetectionMethod_65d08ec88601,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_65d08ec88601,
    'IsServerSet', p_IsServerSet_65d08ec88601
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_ID := p_ID_65d08ec88601, p_QueryID := p_QueryID_65d08ec88601, p_Name := p_Name_65d08ec88601, p_Type := p_Type_65d08ec88601, p_IsRequired := p_IsRequired_65d08ec88601, p_DefaultValue := p_DefaultValue_65d08ec88601, p_DefaultValue_Clear := TRUE, p_Description := p_Description_65d08ec88601, p_Description_Clear := TRUE, p_SampleValue := p_SampleValue_65d08ec88601, p_SampleValue_Clear := TRUE, p_ValidationFilters := p_ValidationFilters_65d08ec88601, p_ValidationFilters_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_65d08ec88601, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_65d08ec88601, p_AutoDetectConfidenceScore_Clear := TRUE, p_IsServerSet := p_IsServerSet_65d08ec88601);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_97e75bb4e8ea UUID;
  p_QueryID_97e75bb4e8ea UUID;
  p_EntityID_97e75bb4e8ea UUID;
  p_DetectionMethod_97e75bb4e8ea VARCHAR(50);
  p_AutoDetectConfidenceScore_97e75bb4e8ea NUMERIC(3,2);
  p_AlternateBaseViewID_97e75bb4e8ea UUID;
BEGIN
  p_ID_97e75bb4e8ea := 'afc16608-7ef5-4603-8bbe-ab57cd014ebe';
  p_QueryID_97e75bb4e8ea := '18456E6E-A8E6-4852-990B-713E1EACCAF2';
  p_EntityID_97e75bb4e8ea := 'C70448F9-9792-41D7-A82C-784B66429D54';
  p_DetectionMethod_97e75bb4e8ea := 'Parser';
  p_AutoDetectConfidenceScore_97e75bb4e8ea := 1;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
                 WHERE "ID" = p_ID_97e75bb4e8ea
                    OR ("QueryID" = p_QueryID_97e75bb4e8ea AND "EntityID" = p_EntityID_97e75bb4e8ea)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
    'ID', p_ID_97e75bb4e8ea,
    'QueryID', p_QueryID_97e75bb4e8ea,
    'EntityID', p_EntityID_97e75bb4e8ea,
    'DetectionMethod', p_DetectionMethod_97e75bb4e8ea,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_97e75bb4e8ea,
    'AlternateBaseViewID', p_AlternateBaseViewID_97e75bb4e8ea
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_97e75bb4e8ea, p_QueryID := p_QueryID_97e75bb4e8ea, p_EntityID := p_EntityID_97e75bb4e8ea, p_DetectionMethod := p_DetectionMethod_97e75bb4e8ea, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_97e75bb4e8ea, p_AlternateBaseViewID := p_AlternateBaseViewID_97e75bb4e8ea, p_AlternateBaseViewID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_414b1362ef68 UUID;
  p_QueryID_414b1362ef68 UUID;
  p_EntityID_414b1362ef68 UUID;
  p_DetectionMethod_414b1362ef68 VARCHAR(50);
  p_AutoDetectConfidenceScore_414b1362ef68 NUMERIC(3,2);
  p_AlternateBaseViewID_414b1362ef68 UUID;
BEGIN
  p_ID_414b1362ef68 := '76df489a-496e-4eb5-ba3b-875c2066063b';
  p_QueryID_414b1362ef68 := '18456E6E-A8E6-4852-990B-713E1EACCAF2';
  p_EntityID_414b1362ef68 := '15A9B6F8-9566-4A37-8588-2D00E8F1CB9A';
  p_DetectionMethod_414b1362ef68 := 'Parser';
  p_AutoDetectConfidenceScore_414b1362ef68 := 1;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
                 WHERE "ID" = p_ID_414b1362ef68
                    OR ("QueryID" = p_QueryID_414b1362ef68 AND "EntityID" = p_EntityID_414b1362ef68)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
    'ID', p_ID_414b1362ef68,
    'QueryID', p_QueryID_414b1362ef68,
    'EntityID', p_EntityID_414b1362ef68,
    'DetectionMethod', p_DetectionMethod_414b1362ef68,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_414b1362ef68,
    'AlternateBaseViewID', p_AlternateBaseViewID_414b1362ef68
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_414b1362ef68, p_QueryID := p_QueryID_414b1362ef68, p_EntityID := p_EntityID_414b1362ef68, p_DetectionMethod := p_DetectionMethod_414b1362ef68, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_414b1362ef68, p_AlternateBaseViewID := p_AlternateBaseViewID_414b1362ef68, p_AlternateBaseViewID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_ApprovedFingerprint_a865a1b0f501 VARCHAR(100);
  p_ID_a865a1b0f501 UUID;
BEGIN
  p_ApprovedFingerprint_a865a1b0f501 := 'dbdfa152bd26ee15a61693e1d6bf4082f251aafb5cac7752b587431569305002';
  p_ID_a865a1b0f501 := '18456E6E-A8E6-4852-990B-713E1EACCAF2';
  -- Set only while the query has no approved fingerprint, so a host's own approval is kept.
  IF EXISTS (SELECT 1 FROM "${mjSchema}"."Query"
             WHERE "ID" = p_ID_a865a1b0f501 AND "ApprovedFingerprint" IS NULL) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQuery'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spUpdateQuery"(p_data := jsonb_build_object(
      'ApprovedFingerprint', p_ApprovedFingerprint_a865a1b0f501,
      'ID', p_ID_a865a1b0f501
    ));
    ELSE
      PERFORM "${mjSchema}"."spUpdateQuery"(p_ApprovedFingerprint := p_ApprovedFingerprint_a865a1b0f501, p_ID := p_ID_a865a1b0f501);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_ID_0a06044dd790 UUID;
  p_Name_0a06044dd790 VARCHAR(255);
  p_CategoryID_0a06044dd790 UUID;
  p_UserQuestion_0a06044dd790 TEXT;
  p_Description_0a06044dd790 TEXT;
  p_SQL_0a06044dd790 TEXT;
  p_TechnicalDescription_0a06044dd790 TEXT;
  p_OriginalSQL_0a06044dd790 TEXT;
  p_Feedback_0a06044dd790 TEXT;
  p_Status_0a06044dd790 VARCHAR(15);
  p_QualityRank_0a06044dd790 INTEGER;
  p_ExecutionCostRank_0a06044dd790 INTEGER;
  p_UsesTemplate_0a06044dd790 BOOLEAN;
  p_AuditQueryRuns_0a06044dd790 BOOLEAN;
  p_CacheEnabled_0a06044dd790 BOOLEAN;
  p_CacheTTLMinutes_0a06044dd790 INTEGER;
  p_CacheMaxSize_0a06044dd790 INTEGER;
  p_EmbeddingVector_0a06044dd790 TEXT;
  p_EmbeddingModelID_0a06044dd790 UUID;
  p_CacheValidationSQL_0a06044dd790 TEXT;
  p_SQLDialectID_0a06044dd790 UUID;
  p_Reusable_0a06044dd790 BOOLEAN;
  p_ExternalDataSourceID_0a06044dd790 UUID;
  p_IsMaterialized_0a06044dd790 BOOLEAN;
  p_Configuration_0a06044dd790 TEXT;
  p_EmbeddingVectorBinary_0a06044dd790 BYTEA;
  p_ApprovalComments_0a06044dd790 TEXT;
  p_ApprovedByUserID_0a06044dd790 UUID;
  p_ApprovedAt_0a06044dd790 TIMESTAMPTZ;
  p_ApprovedFingerprint_0a06044dd790 VARCHAR(100);
  p_ExtractedSQLHash_0a06044dd790 VARCHAR(64);
  p_ExtractionStatus_0a06044dd790 VARCHAR(20);
  p_ExtractionMessage_0a06044dd790 TEXT;
BEGIN
  p_ID_0a06044dd790 := '2DC466E2-C634-48EC-AB6E-73A6E7D961DF';
  p_Name_0a06044dd790 := 'Sales: Party Lookup Promotable Contacts';
  -- The Sales query category this app ships, found by name with its own ID first: a database can
  -- hold more than one category named Sales.
  p_CategoryID_0a06044dd790 := COALESCE((SELECT "ID" FROM "${mjSchema}"."QueryCategory" WHERE "Name" = 'Sales' ORDER BY CASE WHEN "ID" = '5A1E5000-0000-4000-A000-000000000001' THEN 0 ELSE 1 END LIMIT 1), '5A1E5000-0000-4000-A000-000000000001');
  p_UserQuestion_0a06044dd790 := 'Which people could be added as sales contacts?';
  p_Description_0a06044dd790 := 'Search for the promote dialog: people who do NOT yet have a sales contact row, whose last name, display name or email starts with the term.';
  p_SQL_0a06044dd790 := '-- Promote picker (D-PR3): the EXACT COMPLEMENT of "Sales: Party Lookup Contacts" -- people who do NOT
-- have a SalesContact row, and so cannot yet be named on a deal. The two queries differ in one token,
-- EXISTS against NOT EXISTS, and that is deliberate: a rep who cannot find a person in the contact picker
-- is looking at a person this query returns, and creating a duplicate is the failure this pair exists to
-- prevent (bc-aidp-next-golive#259).
--
-- WHY THIS IS A SEPARATE QUERY RATHER THAN A RELAXED FILTER ON THE OTHER ONE: the contact picker is
-- common''s bizapps-party-field, which has no way to mark a row as unselectable and no BeforeSelect hook.
-- Returning a promotable person THERE would let a rep pick one, setting a deal''s contact FK to a row the
-- server must refuse -- which is what PL1 asserts against. Promotion happens in a sales-owned dialog that
-- reads this query instead, so the picker''s guarantee is untouched.
--
-- Result contract shared by every party lookup query: ID, Name, Detail; parameters Term (required) and
-- Domain (optional, set by the caller when the term looks like part of an email address).
-- Prefix matches on indexed base columns only, TOP 20, no view, no count. sqlLikeBegins escapes %, _ and [ (and drops a trailing %).
SELECT TOP 20
    p.ID,
    p.DisplayName AS Name,
    p.Email       AS Detail
FROM [__mj_BizAppsCommon].Person p
WHERE (
       p.LastName    LIKE {{ Term | sqlLikeBegins }}
    OR p.DisplayName LIKE {{ Term | sqlLikeBegins }}
    OR p.Email       LIKE {{ Term | sqlLikeBegins }}
    {% if Domain %}
    OR p.EmailDomain LIKE {{ Domain | sqlLikeBegins }}
    {% endif %}
)
  AND NOT EXISTS (SELECT 1 FROM [__mj_BizAppsSales].SalesContact sc WHERE sc.ID = p.ID)
ORDER BY p.DisplayName, p.ID
';
  p_TechnicalDescription_0a06044dd790 := 'Grain: Person WITHOUT a SalesContact row -- the exact complement of ''Sales: Party Lookup Contacts'', differing only in EXISTS vs NOT EXISTS. Party lookup contract (bc-aidp-next-golive#372): columns ID, Name (Person.DisplayName), Detail (Person.Email); parameters Term (required) and Domain (optional; matched against Person.EmailDomain). Prefix LIKE on indexed base columns (LastName, DisplayName, Email, EmailDomain), TOP 20 ordered by DisplayName, no view and no count. Read by the sales-owned promote dialog, NOT by bizapps-party-field: that control cannot mark a row unselectable, so a promotable person must never reach a deal''s contact picker (PL1).';
  p_Status_0a06044dd790 := 'Approved';
  p_QualityRank_0a06044dd790 := 8;
  p_ExecutionCostRank_0a06044dd790 := 1;
  p_UsesTemplate_0a06044dd790 := TRUE;
  p_AuditQueryRuns_0a06044dd790 := FALSE;
  p_CacheEnabled_0a06044dd790 := FALSE;
  p_Reusable_0a06044dd790 := FALSE;
  p_IsMaterialized_0a06044dd790 := FALSE;
  p_ApprovedByUserID_0a06044dd790 := 'ECAFCCEC-6A37-EF11-86D4-000D3A4E707E';
  p_ApprovedAt_0a06044dd790 := '2026-11-13T16:45:22.049Z';
  p_ExtractedSQLHash_0a06044dd790 := '4c4f01a702cc544ee32006f9abf799daa164b888b9de2207fed2e58b0a7d746a';
  p_ExtractionStatus_0a06044dd790 := 'OK';
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."Query"
                 WHERE "ID" = p_ID_0a06044dd790
                    OR ("CategoryID" = p_CategoryID_0a06044dd790 AND "Name" = p_Name_0a06044dd790)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQuery'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQuery"(p_data := jsonb_build_object(
    'ID', p_ID_0a06044dd790,
    'Name', p_Name_0a06044dd790,
    'CategoryID', p_CategoryID_0a06044dd790,
    'UserQuestion', p_UserQuestion_0a06044dd790,
    'Description', p_Description_0a06044dd790,
    'SQL', p_SQL_0a06044dd790,
    'TechnicalDescription', p_TechnicalDescription_0a06044dd790,
    'OriginalSQL', p_OriginalSQL_0a06044dd790,
    'Feedback', p_Feedback_0a06044dd790,
    'Status', p_Status_0a06044dd790,
    'QualityRank', p_QualityRank_0a06044dd790,
    'ExecutionCostRank', p_ExecutionCostRank_0a06044dd790,
    'UsesTemplate', p_UsesTemplate_0a06044dd790,
    'AuditQueryRuns', p_AuditQueryRuns_0a06044dd790,
    'CacheEnabled', p_CacheEnabled_0a06044dd790,
    'CacheTTLMinutes', p_CacheTTLMinutes_0a06044dd790,
    'CacheMaxSize', p_CacheMaxSize_0a06044dd790,
    'EmbeddingVector', p_EmbeddingVector_0a06044dd790,
    'EmbeddingModelID', p_EmbeddingModelID_0a06044dd790,
    'CacheValidationSQL', p_CacheValidationSQL_0a06044dd790,
    'SQLDialectID', p_SQLDialectID_0a06044dd790,
    'Reusable', p_Reusable_0a06044dd790,
    'ExternalDataSourceID', p_ExternalDataSourceID_0a06044dd790,
    'IsMaterialized', p_IsMaterialized_0a06044dd790,
    'Configuration', p_Configuration_0a06044dd790,
    'EmbeddingVectorBinary', p_EmbeddingVectorBinary_0a06044dd790,
    'ApprovalComments', p_ApprovalComments_0a06044dd790,
    'ApprovedByUserID', p_ApprovedByUserID_0a06044dd790,
    'ApprovedAt', p_ApprovedAt_0a06044dd790,
    'ApprovedFingerprint', p_ApprovedFingerprint_0a06044dd790,
    'ExtractedSQLHash', p_ExtractedSQLHash_0a06044dd790,
    'ExtractionStatus', p_ExtractionStatus_0a06044dd790,
    'ExtractionMessage', p_ExtractionMessage_0a06044dd790
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQuery"(p_ID := p_ID_0a06044dd790, p_Name := p_Name_0a06044dd790, p_CategoryID := p_CategoryID_0a06044dd790, p_UserQuestion := p_UserQuestion_0a06044dd790, p_Description := p_Description_0a06044dd790, p_SQL := p_SQL_0a06044dd790, p_TechnicalDescription := p_TechnicalDescription_0a06044dd790, p_OriginalSQL := p_OriginalSQL_0a06044dd790, p_OriginalSQL_Clear := TRUE, p_Feedback := p_Feedback_0a06044dd790, p_Feedback_Clear := TRUE, p_Status := p_Status_0a06044dd790, p_QualityRank := p_QualityRank_0a06044dd790, p_ExecutionCostRank := p_ExecutionCostRank_0a06044dd790, p_UsesTemplate := p_UsesTemplate_0a06044dd790, p_AuditQueryRuns := p_AuditQueryRuns_0a06044dd790, p_CacheEnabled := p_CacheEnabled_0a06044dd790, p_CacheTTLMinutes := p_CacheTTLMinutes_0a06044dd790, p_CacheTTLMinutes_Clear := TRUE, p_CacheMaxSize := p_CacheMaxSize_0a06044dd790, p_CacheMaxSize_Clear := TRUE, p_EmbeddingVector := p_EmbeddingVector_0a06044dd790, p_EmbeddingVector_Clear := TRUE, p_EmbeddingModelID := p_EmbeddingModelID_0a06044dd790, p_EmbeddingModelID_Clear := TRUE, p_CacheValidationSQL := p_CacheValidationSQL_0a06044dd790, p_CacheValidationSQL_Clear := TRUE, p_SQLDialectID := p_SQLDialectID_0a06044dd790, p_Reusable := p_Reusable_0a06044dd790, p_ExternalDataSourceID := p_ExternalDataSourceID_0a06044dd790, p_ExternalDataSourceID_Clear := TRUE, p_IsMaterialized := p_IsMaterialized_0a06044dd790, p_Configuration := p_Configuration_0a06044dd790, p_Configuration_Clear := TRUE, p_EmbeddingVectorBinary := p_EmbeddingVectorBinary_0a06044dd790, p_EmbeddingVectorBinary_Clear := TRUE, p_ApprovalComments := p_ApprovalComments_0a06044dd790, p_ApprovalComments_Clear := TRUE, p_ApprovedByUserID := p_ApprovedByUserID_0a06044dd790, p_ApprovedAt := p_ApprovedAt_0a06044dd790, p_ApprovedFingerprint := p_ApprovedFingerprint_0a06044dd790, p_ApprovedFingerprint_Clear := TRUE, p_ExtractedSQLHash := p_ExtractedSQLHash_0a06044dd790, p_ExtractionStatus := p_ExtractionStatus_0a06044dd790, p_ExtractionMessage := p_ExtractionMessage_0a06044dd790, p_ExtractionMessage_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_ad5394dcb4bc UUID;
  p_QueryID_ad5394dcb4bc UUID;
  p_Name_ad5394dcb4bc VARCHAR(255);
  p_Description_ad5394dcb4bc TEXT;
  p_Sequence_ad5394dcb4bc INTEGER;
  p_SQLBaseType_ad5394dcb4bc VARCHAR(50);
  p_SQLFullType_ad5394dcb4bc VARCHAR(100);
  p_SourceEntityID_ad5394dcb4bc UUID;
  p_SourceFieldName_ad5394dcb4bc VARCHAR(255);
  p_IsComputed_ad5394dcb4bc BOOLEAN;
  p_ComputationDescription_ad5394dcb4bc TEXT;
  p_IsSummary_ad5394dcb4bc BOOLEAN;
  p_SummaryDescription_ad5394dcb4bc TEXT;
  p_DetectionMethod_ad5394dcb4bc VARCHAR(50);
  p_AutoDetectConfidenceScore_ad5394dcb4bc NUMERIC(3,2);
  p_SourceEntityFieldID_ad5394dcb4bc UUID;
  p_IsNullable_ad5394dcb4bc BOOLEAN;
  p_SourceObjectName_ad5394dcb4bc VARCHAR(500);
BEGIN
  p_ID_ad5394dcb4bc := '730a71da-ede8-4676-9286-a17b26721d9b';
  p_QueryID_ad5394dcb4bc := '2DC466E2-C634-48EC-AB6E-73A6E7D961DF';
  p_Name_ad5394dcb4bc := 'ID';
  p_Sequence_ad5394dcb4bc := 1;
  p_SQLBaseType_ad5394dcb4bc := 'uniqueidentifier';
  p_SQLFullType_ad5394dcb4bc := 'uniqueidentifier';
  p_SourceEntityID_ad5394dcb4bc := '7A94ADA9-7880-4FAE-97D8-DB0E934C3F5F';
  p_SourceFieldName_ad5394dcb4bc := 'ID';
  p_IsComputed_ad5394dcb4bc := FALSE;
  p_IsSummary_ad5394dcb4bc := FALSE;
  p_DetectionMethod_ad5394dcb4bc := 'Database';
  p_SourceEntityFieldID_ad5394dcb4bc := '2A0B54F1-94F8-466C-86C2-931E200258C1';
  p_IsNullable_ad5394dcb4bc := FALSE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_ad5394dcb4bc := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_ad5394dcb4bc AND "Name" = p_SourceFieldName_ad5394dcb4bc
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_ad5394dcb4bc THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_ad5394dcb4bc
                    OR ("QueryID" = p_QueryID_ad5394dcb4bc AND "Name" = p_Name_ad5394dcb4bc)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_ad5394dcb4bc,
    'QueryID', p_QueryID_ad5394dcb4bc,
    'Name', p_Name_ad5394dcb4bc,
    'Description', p_Description_ad5394dcb4bc,
    'Sequence', p_Sequence_ad5394dcb4bc,
    'SQLBaseType', p_SQLBaseType_ad5394dcb4bc,
    'SQLFullType', p_SQLFullType_ad5394dcb4bc,
    'SourceEntityID', p_SourceEntityID_ad5394dcb4bc,
    'SourceFieldName', p_SourceFieldName_ad5394dcb4bc,
    'IsComputed', p_IsComputed_ad5394dcb4bc,
    'ComputationDescription', p_ComputationDescription_ad5394dcb4bc,
    'IsSummary', p_IsSummary_ad5394dcb4bc,
    'SummaryDescription', p_SummaryDescription_ad5394dcb4bc,
    'DetectionMethod', p_DetectionMethod_ad5394dcb4bc,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_ad5394dcb4bc,
    'SourceEntityFieldID', p_SourceEntityFieldID_ad5394dcb4bc,
    'IsNullable', p_IsNullable_ad5394dcb4bc,
    'SourceObjectName', p_SourceObjectName_ad5394dcb4bc
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_ad5394dcb4bc, p_QueryID := p_QueryID_ad5394dcb4bc, p_Name := p_Name_ad5394dcb4bc, p_Description := p_Description_ad5394dcb4bc, p_Description_Clear := TRUE, p_Sequence := p_Sequence_ad5394dcb4bc, p_SQLBaseType := p_SQLBaseType_ad5394dcb4bc, p_SQLFullType := p_SQLFullType_ad5394dcb4bc, p_SourceEntityID := p_SourceEntityID_ad5394dcb4bc, p_SourceFieldName := p_SourceFieldName_ad5394dcb4bc, p_IsComputed := p_IsComputed_ad5394dcb4bc, p_ComputationDescription := p_ComputationDescription_ad5394dcb4bc, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_ad5394dcb4bc, p_SummaryDescription := p_SummaryDescription_ad5394dcb4bc, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_ad5394dcb4bc, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_ad5394dcb4bc, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_ad5394dcb4bc, p_IsNullable := p_IsNullable_ad5394dcb4bc, p_SourceObjectName := p_SourceObjectName_ad5394dcb4bc, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_834aa67e2336 UUID;
  p_QueryID_834aa67e2336 UUID;
  p_Name_834aa67e2336 VARCHAR(255);
  p_Description_834aa67e2336 TEXT;
  p_Sequence_834aa67e2336 INTEGER;
  p_SQLBaseType_834aa67e2336 VARCHAR(50);
  p_SQLFullType_834aa67e2336 VARCHAR(100);
  p_SourceEntityID_834aa67e2336 UUID;
  p_SourceFieldName_834aa67e2336 VARCHAR(255);
  p_IsComputed_834aa67e2336 BOOLEAN;
  p_ComputationDescription_834aa67e2336 TEXT;
  p_IsSummary_834aa67e2336 BOOLEAN;
  p_SummaryDescription_834aa67e2336 TEXT;
  p_DetectionMethod_834aa67e2336 VARCHAR(50);
  p_AutoDetectConfidenceScore_834aa67e2336 NUMERIC(3,2);
  p_SourceEntityFieldID_834aa67e2336 UUID;
  p_IsNullable_834aa67e2336 BOOLEAN;
  p_SourceObjectName_834aa67e2336 VARCHAR(500);
BEGIN
  p_ID_834aa67e2336 := '0f9a2b52-dd31-439c-8b01-356ec3e4616a';
  p_QueryID_834aa67e2336 := '2DC466E2-C634-48EC-AB6E-73A6E7D961DF';
  p_Name_834aa67e2336 := 'Name';
  p_Description_834aa67e2336 := 'Full name for display: FirstName LastName Suffix ("John Smith Jr."). Blank parts are skipped; empty when every part is blank. Computed and stored; this is the entity name field.';
  p_Sequence_834aa67e2336 := 2;
  p_SQLBaseType_834aa67e2336 := 'nvarchar';
  p_SQLFullType_834aa67e2336 := 'nvarchar(250)';
  p_SourceEntityID_834aa67e2336 := '7A94ADA9-7880-4FAE-97D8-DB0E934C3F5F';
  p_SourceFieldName_834aa67e2336 := 'DisplayName';
  p_IsComputed_834aa67e2336 := TRUE;
  p_IsSummary_834aa67e2336 := FALSE;
  p_DetectionMethod_834aa67e2336 := 'Database';
  p_SourceEntityFieldID_834aa67e2336 := '76D49448-C586-4701-9FFF-63F390EC78C0';
  p_IsNullable_834aa67e2336 := FALSE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_834aa67e2336 := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_834aa67e2336 AND "Name" = p_SourceFieldName_834aa67e2336
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_834aa67e2336 THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_834aa67e2336
                    OR ("QueryID" = p_QueryID_834aa67e2336 AND "Name" = p_Name_834aa67e2336)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_834aa67e2336,
    'QueryID', p_QueryID_834aa67e2336,
    'Name', p_Name_834aa67e2336,
    'Description', p_Description_834aa67e2336,
    'Sequence', p_Sequence_834aa67e2336,
    'SQLBaseType', p_SQLBaseType_834aa67e2336,
    'SQLFullType', p_SQLFullType_834aa67e2336,
    'SourceEntityID', p_SourceEntityID_834aa67e2336,
    'SourceFieldName', p_SourceFieldName_834aa67e2336,
    'IsComputed', p_IsComputed_834aa67e2336,
    'ComputationDescription', p_ComputationDescription_834aa67e2336,
    'IsSummary', p_IsSummary_834aa67e2336,
    'SummaryDescription', p_SummaryDescription_834aa67e2336,
    'DetectionMethod', p_DetectionMethod_834aa67e2336,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_834aa67e2336,
    'SourceEntityFieldID', p_SourceEntityFieldID_834aa67e2336,
    'IsNullable', p_IsNullable_834aa67e2336,
    'SourceObjectName', p_SourceObjectName_834aa67e2336
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_834aa67e2336, p_QueryID := p_QueryID_834aa67e2336, p_Name := p_Name_834aa67e2336, p_Description := p_Description_834aa67e2336, p_Sequence := p_Sequence_834aa67e2336, p_SQLBaseType := p_SQLBaseType_834aa67e2336, p_SQLFullType := p_SQLFullType_834aa67e2336, p_SourceEntityID := p_SourceEntityID_834aa67e2336, p_SourceFieldName := p_SourceFieldName_834aa67e2336, p_IsComputed := p_IsComputed_834aa67e2336, p_ComputationDescription := p_ComputationDescription_834aa67e2336, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_834aa67e2336, p_SummaryDescription := p_SummaryDescription_834aa67e2336, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_834aa67e2336, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_834aa67e2336, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_834aa67e2336, p_IsNullable := p_IsNullable_834aa67e2336, p_SourceObjectName := p_SourceObjectName_834aa67e2336, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Fields (core SP call only)
DO $mj$
DECLARE
  p_ID_1edd869384fc UUID;
  p_QueryID_1edd869384fc UUID;
  p_Name_1edd869384fc VARCHAR(255);
  p_Description_1edd869384fc TEXT;
  p_Sequence_1edd869384fc INTEGER;
  p_SQLBaseType_1edd869384fc VARCHAR(50);
  p_SQLFullType_1edd869384fc VARCHAR(100);
  p_SourceEntityID_1edd869384fc UUID;
  p_SourceFieldName_1edd869384fc VARCHAR(255);
  p_IsComputed_1edd869384fc BOOLEAN;
  p_ComputationDescription_1edd869384fc TEXT;
  p_IsSummary_1edd869384fc BOOLEAN;
  p_SummaryDescription_1edd869384fc TEXT;
  p_DetectionMethod_1edd869384fc VARCHAR(50);
  p_AutoDetectConfidenceScore_1edd869384fc NUMERIC(3,2);
  p_SourceEntityFieldID_1edd869384fc UUID;
  p_IsNullable_1edd869384fc BOOLEAN;
  p_SourceObjectName_1edd869384fc VARCHAR(500);
BEGIN
  p_ID_1edd869384fc := '16314a79-dc35-4b91-9c8a-01e0f6867934';
  p_QueryID_1edd869384fc := '2DC466E2-C634-48EC-AB6E-73A6E7D961DF';
  p_Name_1edd869384fc := 'Detail';
  p_Description_1edd869384fc := 'Primary email address for this person';
  p_Sequence_1edd869384fc := 3;
  p_SQLBaseType_1edd869384fc := 'nvarchar';
  p_SQLFullType_1edd869384fc := 'nvarchar(255)';
  p_SourceEntityID_1edd869384fc := '7A94ADA9-7880-4FAE-97D8-DB0E934C3F5F';
  p_SourceFieldName_1edd869384fc := 'Email';
  p_IsComputed_1edd869384fc := FALSE;
  p_IsSummary_1edd869384fc := FALSE;
  p_DetectionMethod_1edd869384fc := 'Database';
  p_SourceEntityFieldID_1edd869384fc := 'F6B2A29B-CFE9-410D-9732-3AE2ACF44DC0';
  p_IsNullable_1edd869384fc := TRUE;
  -- The source entity field is found on this database by entity and field name (the shipped ID
  -- first): entity field IDs can differ between databases. NULL when the field is not there.
  p_SourceEntityFieldID_1edd869384fc := (SELECT "ID" FROM "${mjSchema}"."EntityField"
      WHERE "EntityID" = p_SourceEntityID_1edd869384fc AND "Name" = p_SourceFieldName_1edd869384fc
      ORDER BY CASE WHEN "ID" = p_SourceEntityFieldID_1edd869384fc THEN 0 ELSE 1 END LIMIT 1);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryField"
                 WHERE "ID" = p_ID_1edd869384fc
                    OR ("QueryID" = p_QueryID_1edd869384fc AND "Name" = p_Name_1edd869384fc)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryField"(p_data := jsonb_build_object(
    'ID', p_ID_1edd869384fc,
    'QueryID', p_QueryID_1edd869384fc,
    'Name', p_Name_1edd869384fc,
    'Description', p_Description_1edd869384fc,
    'Sequence', p_Sequence_1edd869384fc,
    'SQLBaseType', p_SQLBaseType_1edd869384fc,
    'SQLFullType', p_SQLFullType_1edd869384fc,
    'SourceEntityID', p_SourceEntityID_1edd869384fc,
    'SourceFieldName', p_SourceFieldName_1edd869384fc,
    'IsComputed', p_IsComputed_1edd869384fc,
    'ComputationDescription', p_ComputationDescription_1edd869384fc,
    'IsSummary', p_IsSummary_1edd869384fc,
    'SummaryDescription', p_SummaryDescription_1edd869384fc,
    'DetectionMethod', p_DetectionMethod_1edd869384fc,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_1edd869384fc,
    'SourceEntityFieldID', p_SourceEntityFieldID_1edd869384fc,
    'IsNullable', p_IsNullable_1edd869384fc,
    'SourceObjectName', p_SourceObjectName_1edd869384fc
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryField"(p_ID := p_ID_1edd869384fc, p_QueryID := p_QueryID_1edd869384fc, p_Name := p_Name_1edd869384fc, p_Description := p_Description_1edd869384fc, p_Sequence := p_Sequence_1edd869384fc, p_SQLBaseType := p_SQLBaseType_1edd869384fc, p_SQLFullType := p_SQLFullType_1edd869384fc, p_SourceEntityID := p_SourceEntityID_1edd869384fc, p_SourceFieldName := p_SourceFieldName_1edd869384fc, p_IsComputed := p_IsComputed_1edd869384fc, p_ComputationDescription := p_ComputationDescription_1edd869384fc, p_ComputationDescription_Clear := TRUE, p_IsSummary := p_IsSummary_1edd869384fc, p_SummaryDescription := p_SummaryDescription_1edd869384fc, p_SummaryDescription_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_1edd869384fc, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_1edd869384fc, p_AutoDetectConfidenceScore_Clear := TRUE, p_SourceEntityFieldID := p_SourceEntityFieldID_1edd869384fc, p_IsNullable := p_IsNullable_1edd869384fc, p_SourceObjectName := p_SourceObjectName_1edd869384fc, p_SourceObjectName_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Parameters (core SP call only)
DO $mj$
DECLARE
  p_ID_8c169b74fed6 UUID;
  p_QueryID_8c169b74fed6 UUID;
  p_Name_8c169b74fed6 VARCHAR(255);
  p_Type_8c169b74fed6 VARCHAR(50);
  p_IsRequired_8c169b74fed6 BOOLEAN;
  p_DefaultValue_8c169b74fed6 TEXT;
  p_Description_8c169b74fed6 TEXT;
  p_SampleValue_8c169b74fed6 TEXT;
  p_ValidationFilters_8c169b74fed6 TEXT;
  p_DetectionMethod_8c169b74fed6 VARCHAR(50);
  p_AutoDetectConfidenceScore_8c169b74fed6 NUMERIC(3,2);
  p_IsServerSet_8c169b74fed6 BOOLEAN;
BEGIN
  p_ID_8c169b74fed6 := '940d3f95-6d07-4bf0-8819-88bb071111f5';
  p_QueryID_8c169b74fed6 := '2DC466E2-C634-48EC-AB6E-73A6E7D961DF';
  p_Name_8c169b74fed6 := 'Term';
  p_Type_8c169b74fed6 := 'string';
  p_IsRequired_8c169b74fed6 := TRUE;
  p_DetectionMethod_8c169b74fed6 := 'Parser';
  p_IsServerSet_8c169b74fed6 := FALSE;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryParameter"
                 WHERE "ID" = p_ID_8c169b74fed6
                    OR ("QueryID" = p_QueryID_8c169b74fed6 AND "Name" = p_Name_8c169b74fed6)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryParameter'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_data := jsonb_build_object(
    'ID', p_ID_8c169b74fed6,
    'QueryID', p_QueryID_8c169b74fed6,
    'Name', p_Name_8c169b74fed6,
    'Type', p_Type_8c169b74fed6,
    'IsRequired', p_IsRequired_8c169b74fed6,
    'DefaultValue', p_DefaultValue_8c169b74fed6,
    'Description', p_Description_8c169b74fed6,
    'SampleValue', p_SampleValue_8c169b74fed6,
    'ValidationFilters', p_ValidationFilters_8c169b74fed6,
    'DetectionMethod', p_DetectionMethod_8c169b74fed6,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_8c169b74fed6,
    'IsServerSet', p_IsServerSet_8c169b74fed6
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_ID := p_ID_8c169b74fed6, p_QueryID := p_QueryID_8c169b74fed6, p_Name := p_Name_8c169b74fed6, p_Type := p_Type_8c169b74fed6, p_IsRequired := p_IsRequired_8c169b74fed6, p_DefaultValue := p_DefaultValue_8c169b74fed6, p_DefaultValue_Clear := TRUE, p_Description := p_Description_8c169b74fed6, p_Description_Clear := TRUE, p_SampleValue := p_SampleValue_8c169b74fed6, p_SampleValue_Clear := TRUE, p_ValidationFilters := p_ValidationFilters_8c169b74fed6, p_ValidationFilters_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_8c169b74fed6, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_8c169b74fed6, p_AutoDetectConfidenceScore_Clear := TRUE, p_IsServerSet := p_IsServerSet_8c169b74fed6);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Parameters (core SP call only)
DO $mj$
DECLARE
  p_ID_44db561907ce UUID;
  p_QueryID_44db561907ce UUID;
  p_Name_44db561907ce VARCHAR(255);
  p_Type_44db561907ce VARCHAR(50);
  p_IsRequired_44db561907ce BOOLEAN;
  p_DefaultValue_44db561907ce TEXT;
  p_Description_44db561907ce TEXT;
  p_SampleValue_44db561907ce TEXT;
  p_ValidationFilters_44db561907ce TEXT;
  p_DetectionMethod_44db561907ce VARCHAR(50);
  p_AutoDetectConfidenceScore_44db561907ce NUMERIC(3,2);
  p_IsServerSet_44db561907ce BOOLEAN;
BEGIN
  p_ID_44db561907ce := 'f9372741-b767-4bf5-9c2c-9619d4a79a60';
  p_QueryID_44db561907ce := '2DC466E2-C634-48EC-AB6E-73A6E7D961DF';
  p_Name_44db561907ce := 'Domain';
  p_Type_44db561907ce := 'string';
  p_IsRequired_44db561907ce := FALSE;
  p_DetectionMethod_44db561907ce := 'Parser';
  p_IsServerSet_44db561907ce := FALSE;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryParameter"
                 WHERE "ID" = p_ID_44db561907ce
                    OR ("QueryID" = p_QueryID_44db561907ce AND "Name" = p_Name_44db561907ce)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryParameter'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_data := jsonb_build_object(
    'ID', p_ID_44db561907ce,
    'QueryID', p_QueryID_44db561907ce,
    'Name', p_Name_44db561907ce,
    'Type', p_Type_44db561907ce,
    'IsRequired', p_IsRequired_44db561907ce,
    'DefaultValue', p_DefaultValue_44db561907ce,
    'Description', p_Description_44db561907ce,
    'SampleValue', p_SampleValue_44db561907ce,
    'ValidationFilters', p_ValidationFilters_44db561907ce,
    'DetectionMethod', p_DetectionMethod_44db561907ce,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_44db561907ce,
    'IsServerSet', p_IsServerSet_44db561907ce
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryParameter"(p_ID := p_ID_44db561907ce, p_QueryID := p_QueryID_44db561907ce, p_Name := p_Name_44db561907ce, p_Type := p_Type_44db561907ce, p_IsRequired := p_IsRequired_44db561907ce, p_DefaultValue := p_DefaultValue_44db561907ce, p_DefaultValue_Clear := TRUE, p_Description := p_Description_44db561907ce, p_Description_Clear := TRUE, p_SampleValue := p_SampleValue_44db561907ce, p_SampleValue_Clear := TRUE, p_ValidationFilters := p_ValidationFilters_44db561907ce, p_ValidationFilters_Clear := TRUE, p_DetectionMethod := p_DetectionMethod_44db561907ce, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_44db561907ce, p_AutoDetectConfidenceScore_Clear := TRUE, p_IsServerSet := p_IsServerSet_44db561907ce);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_3a6cb723bc4b UUID;
  p_QueryID_3a6cb723bc4b UUID;
  p_EntityID_3a6cb723bc4b UUID;
  p_DetectionMethod_3a6cb723bc4b VARCHAR(50);
  p_AutoDetectConfidenceScore_3a6cb723bc4b NUMERIC(3,2);
  p_AlternateBaseViewID_3a6cb723bc4b UUID;
BEGIN
  p_ID_3a6cb723bc4b := 'c23b4b2c-95aa-4c26-98c4-6f030a2fa8bb';
  p_QueryID_3a6cb723bc4b := '2DC466E2-C634-48EC-AB6E-73A6E7D961DF';
  p_EntityID_3a6cb723bc4b := '7A94ADA9-7880-4FAE-97D8-DB0E934C3F5F';
  p_DetectionMethod_3a6cb723bc4b := 'Parser';
  p_AutoDetectConfidenceScore_3a6cb723bc4b := 1;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
                 WHERE "ID" = p_ID_3a6cb723bc4b
                    OR ("QueryID" = p_QueryID_3a6cb723bc4b AND "EntityID" = p_EntityID_3a6cb723bc4b)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
    'ID', p_ID_3a6cb723bc4b,
    'QueryID', p_QueryID_3a6cb723bc4b,
    'EntityID', p_EntityID_3a6cb723bc4b,
    'DetectionMethod', p_DetectionMethod_3a6cb723bc4b,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_3a6cb723bc4b,
    'AlternateBaseViewID', p_AlternateBaseViewID_3a6cb723bc4b
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_3a6cb723bc4b, p_QueryID := p_QueryID_3a6cb723bc4b, p_EntityID := p_EntityID_3a6cb723bc4b, p_DetectionMethod := p_DetectionMethod_3a6cb723bc4b, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_3a6cb723bc4b, p_AlternateBaseViewID := p_AlternateBaseViewID_3a6cb723bc4b, p_AlternateBaseViewID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Query Entities (core SP call only)
DO $mj$
DECLARE
  p_ID_cc62aadf81b2 UUID;
  p_QueryID_cc62aadf81b2 UUID;
  p_EntityID_cc62aadf81b2 UUID;
  p_DetectionMethod_cc62aadf81b2 VARCHAR(50);
  p_AutoDetectConfidenceScore_cc62aadf81b2 NUMERIC(3,2);
  p_AlternateBaseViewID_cc62aadf81b2 UUID;
BEGIN
  p_ID_cc62aadf81b2 := 'c7f73067-3870-4440-9ec5-2c1bf207c620';
  p_QueryID_cc62aadf81b2 := '2DC466E2-C634-48EC-AB6E-73A6E7D961DF';
  p_EntityID_cc62aadf81b2 := '530174B2-654E-4E14-BF28-3EF29AC9833D';
  p_DetectionMethod_cc62aadf81b2 := 'Parser';
  p_AutoDetectConfidenceScore_cc62aadf81b2 := 1;
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."QueryEntity"
                 WHERE "ID" = p_ID_cc62aadf81b2
                    OR ("QueryID" = p_QueryID_cc62aadf81b2 AND "EntityID" = p_EntityID_cc62aadf81b2)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateQueryEntity'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_data := jsonb_build_object(
    'ID', p_ID_cc62aadf81b2,
    'QueryID', p_QueryID_cc62aadf81b2,
    'EntityID', p_EntityID_cc62aadf81b2,
    'DetectionMethod', p_DetectionMethod_cc62aadf81b2,
    'AutoDetectConfidenceScore', p_AutoDetectConfidenceScore_cc62aadf81b2,
    'AlternateBaseViewID', p_AlternateBaseViewID_cc62aadf81b2
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateQueryEntity"(p_ID := p_ID_cc62aadf81b2, p_QueryID := p_QueryID_cc62aadf81b2, p_EntityID := p_EntityID_cc62aadf81b2, p_DetectionMethod := p_DetectionMethod_cc62aadf81b2, p_AutoDetectConfidenceScore := p_AutoDetectConfidenceScore_cc62aadf81b2, p_AlternateBaseViewID := p_AlternateBaseViewID_cc62aadf81b2, p_AlternateBaseViewID_Clear := TRUE);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Queries (core SP call only)
DO $mj$
DECLARE
  p_ApprovedFingerprint_0a06044dd790 VARCHAR(100);
  p_ID_0a06044dd790 UUID;
BEGIN
  p_ApprovedFingerprint_0a06044dd790 := 'f323d4be4e0a7139a5338d41e47af6e9b31f06786ca62d1029c63980b30b3c89';
  p_ID_0a06044dd790 := '2DC466E2-C634-48EC-AB6E-73A6E7D961DF';
  -- Set only while the query has no approved fingerprint, so a host's own approval is kept.
  IF EXISTS (SELECT 1 FROM "${mjSchema}"."Query"
             WHERE "ID" = p_ID_0a06044dd790 AND "ApprovedFingerprint" IS NULL) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateQuery'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spUpdateQuery"(p_data := jsonb_build_object(
      'ApprovedFingerprint', p_ApprovedFingerprint_0a06044dd790,
      'ID', p_ID_0a06044dd790
    ));
    ELSE
      PERFORM "${mjSchema}"."spUpdateQuery"(p_ApprovedFingerprint := p_ApprovedFingerprint_0a06044dd790, p_ID := p_ID_0a06044dd790);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_IsNameField_80ba1c8ddc78 BOOLEAN;
  p_AutoUpdateIsNameField_80ba1c8ddc78 BOOLEAN;
  p_ID_80ba1c8ddc78 UUID;
BEGIN
  p_IsNameField_80ba1c8ddc78 := FALSE;
  p_AutoUpdateIsNameField_80ba1c8ddc78 := FALSE;
  SELECT ef."ID" INTO p_ID_80ba1c8ddc78
    FROM "${mjSchema}"."EntityField" ef
    JOIN "${mjSchema}"."Entity" e ON e."ID" = ef."EntityID"
   WHERE e."Name" = 'MJ_BizApps_Sales: Sales Contacts' AND ef."Name" = 'FirstName'
   LIMIT 1;
  IF p_ID_80ba1c8ddc78 IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
      'IsNameField', p_IsNameField_80ba1c8ddc78,
      'AutoUpdateIsNameField', p_AutoUpdateIsNameField_80ba1c8ddc78,
      'ID', p_ID_80ba1c8ddc78
    ));
    ELSE
      PERFORM "${mjSchema}"."spUpdateEntityField"(p_IsNameField := p_IsNameField_80ba1c8ddc78, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_80ba1c8ddc78, p_ID := p_ID_80ba1c8ddc78);
    END IF;
  END IF;
END $mj$;
