-- =============================================================================================
-- PostgreSQL counterpart of V202610162136__v6.17.x__Metadata_Sync.sql -- BizApps Sales v6.17.x Metadata_Sync
-- =============================================================================================
-- Same records, same values, same order as the T-SQL file; see its header for what ships and why.
--
-- HOW IT WAS MADE
--   * `mj sql-convert --from tsql --to postgres` (MJ CLI 6.1.5) on the push log the T-SQL file
--     was generated from. Each record is a DO block that calls the app function, in
--     whichever signature the host has (jsonb or named parameters).
--   * The converter does not translate the lookups and guards the T-SQL file adds, so they are
--     written here by hand from the T-SQL ones, block for block:
--       - SELECT TOP 1 @x = [ID] ... ORDER BY ... becomes
--         p_x := COALESCE((SELECT "ID" ... ORDER BY ... LIMIT 1), p_x), which keeps the literal
--         ID when nothing matches, as the T-SQL assignment does.
--       - IF <guard> EXEC ... becomes IF <guard> THEN <call> END IF.
--   * Every string value is taken verbatim from the T-SQL file: the converter rewrites T-SQL
--     inside string literals.
--   * Core calls use ${mjSchema}; this app's schema is written as the converter emits it.
-- =============================================================================================

SET standard_conforming_strings = on;

-- Save MJ_BizApps_Sales: Pipeline Stages (core SP call only)
DO $mj$
DECLARE
  p_PipelineID_2c2057a96432 UUID;
  p_Name_2c2057a96432 VARCHAR(200);
  p_Code_2c2057a96432 VARCHAR(40);
  p_DisplayOrder_2c2057a96432 INTEGER;
  p_Probability_2c2057a96432 NUMERIC(5,2);
  p_ForecastCategoryTypeID_2c2057a96432 UUID;
  p_DealStatusTypeID_2c2057a96432 UUID;
  p_OrderStatusOnEntry_2c2057a96432 VARCHAR(20);
  p_RottingDays_2c2057a96432 INTEGER;
  p_EntryCriteria_2c2057a96432 TEXT;
  p_ExitCriteria_2c2057a96432 TEXT;
  p_RequiredFields_2c2057a96432 TEXT;
  p_GuidanceMarkdown_2c2057a96432 TEXT;
  p_IsActive_2c2057a96432 BOOLEAN;
  p_ID_2c2057a96432 UUID;
BEGIN
  p_PipelineID_2c2057a96432 := '90111111-0000-4000-A000-000000000002';
  p_Name_2c2057a96432 := 'Lost';
  p_Code_2c2057a96432 := 'LOST';
  p_DisplayOrder_2c2057a96432 := 40;
  p_Probability_2c2057a96432 := 0;
  p_ForecastCategoryTypeID_2c2057a96432 := '4DAF7153-0005-4E43-A164-8F1DA05C9344';
  p_DealStatusTypeID_2c2057a96432 := '1A7C4E20-0003-4B10-9E31-5C8A7D2F6011';
  p_OrderStatusOnEntry_2c2057a96432 := 'Voided';
  p_GuidanceMarkdown_2c2057a96432 := 'A loss reason is mandatory — it is the highest-value, most-skipped data in any CRM. Entering this stage VOIDS the order.';
  p_IsActive_2c2057a96432 := TRUE;
  p_ID_2c2057a96432 := '58CC2FFF-21E8-4FB2-A1BA-3BBB1AA372F7';
  IF EXISTS (SELECT 1 FROM ${flyway:defaultSchema}."PipelineStage" WHERE "ID" = p_ID_2c2057a96432)
   AND EXISTS (SELECT 1 FROM ${flyway:defaultSchema}."Pipeline" WHERE "ID" = p_PipelineID_2c2057a96432) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '__mj_bizappssales' AND p.proname = 'spUpdatePipelineStage'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM __mj_BizAppsSales."spUpdatePipelineStage"(p_data := jsonb_build_object(
      'PipelineID', p_PipelineID_2c2057a96432,
      'Name', p_Name_2c2057a96432,
      'Code', p_Code_2c2057a96432,
      'DisplayOrder', p_DisplayOrder_2c2057a96432,
      'Probability', p_Probability_2c2057a96432,
      'ForecastCategoryTypeID', p_ForecastCategoryTypeID_2c2057a96432,
      'DealStatusTypeID', p_DealStatusTypeID_2c2057a96432,
      'OrderStatusOnEntry', p_OrderStatusOnEntry_2c2057a96432,
      'RottingDays', p_RottingDays_2c2057a96432,
      'EntryCriteria', p_EntryCriteria_2c2057a96432,
      'ExitCriteria', p_ExitCriteria_2c2057a96432,
      'RequiredFields', p_RequiredFields_2c2057a96432,
      'GuidanceMarkdown', p_GuidanceMarkdown_2c2057a96432,
      'IsActive', p_IsActive_2c2057a96432,
      'ID', p_ID_2c2057a96432
    ));
    ELSE
      PERFORM __mj_BizAppsSales."spUpdatePipelineStage"(p_PipelineID := p_PipelineID_2c2057a96432, p_Name := p_Name_2c2057a96432, p_Code := p_Code_2c2057a96432, p_DisplayOrder := p_DisplayOrder_2c2057a96432, p_Probability := p_Probability_2c2057a96432, p_ForecastCategoryTypeID := p_ForecastCategoryTypeID_2c2057a96432, p_DealStatusTypeID := p_DealStatusTypeID_2c2057a96432, p_OrderStatusOnEntry := p_OrderStatusOnEntry_2c2057a96432, p_RottingDays := p_RottingDays_2c2057a96432, p_RottingDays_Clear := TRUE, p_EntryCriteria := p_EntryCriteria_2c2057a96432, p_EntryCriteria_Clear := TRUE, p_ExitCriteria := p_ExitCriteria_2c2057a96432, p_ExitCriteria_Clear := TRUE, p_RequiredFields := p_RequiredFields_2c2057a96432, p_RequiredFields_Clear := TRUE, p_GuidanceMarkdown := p_GuidanceMarkdown_2c2057a96432, p_IsActive := p_IsActive_2c2057a96432, p_ID := p_ID_2c2057a96432);
    END IF;
  END IF;
END $mj$;


-- ===================== Other =====================

-- End of SQL Logging Session
-- Session ID: f778d9da-6b34-4a1b-a08c-72d945466516
-- Completed: 2026-10-16T21:36:15.046Z
-- Duration: 3790ms
-- Total Statements: 1
