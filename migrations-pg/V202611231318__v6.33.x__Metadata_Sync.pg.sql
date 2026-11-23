-- =============================================================================================
-- PostgreSQL counterpart of V202611231318__v6.33.x__Metadata_Sync.sql
-- =============================================================================================
-- Same records, same values as the T-SQL file; see its header for what ships and why.
--
-- HOW IT WAS MADE: `mj sql-convert --from tsql --to postgres` (MJ CLI 6.2.1) on each block of the
-- push log, one block per run. Each create block's guard is then widened to match the T-SQL file
-- (ID or natural key, plus the lookups it needs, and for the job the agent it points to) and its
-- update branch removed, so every create is create-only. Core references use ${mjSchema}; this
-- app's schema stays literal (__mj_BizAppsSales, folded to lower case by PostgreSQL). String
-- values the converter rewrote are restored verbatim from the T-SQL file.
-- =============================================================================================

-- Save MJ_BizApps_Sales: Deal Digest Audience Types (core SP call only)
DO $mj$
DECLARE
  p_ID_cc208e7dfbbe UUID;
  p_Code_cc208e7dfbbe VARCHAR(50);
  p_Name_cc208e7dfbbe VARCHAR(100);
  p_Description_cc208e7dfbbe TEXT;
  p_IsPortfolioWide_cc208e7dfbbe BOOLEAN;
  p_MinDaysLapsed_cc208e7dfbbe INTEGER;
  p_IncludeMissingCloseDate_cc208e7dfbbe BOOLEAN;
  p_SendWhenEmpty_cc208e7dfbbe BOOLEAN;
  p_GroupByCompany_cc208e7dfbbe BOOLEAN;
  p_SubjectTemplate_cc208e7dfbbe VARCHAR(255);
  p_IntroTemplate_cc208e7dfbbe TEXT;
  p_EmptyMessage_cc208e7dfbbe VARCHAR(500);
  p_DisplayRank_cc208e7dfbbe INTEGER;
  p_IsActive_cc208e7dfbbe BOOLEAN;
BEGIN
  p_ID_cc208e7dfbbe := 'B76BCAD9-8D85-4EB7-9D23-AABC8E6B909F';
  p_Code_cc208e7dfbbe := 'COMPANY_LEADER';
  p_Name_cc208e7dfbbe := 'Company Leader';
  p_Description_cc208e7dfbbe := 'Leaders of a single company. Sees only that company''s lapsed deals, including deals with no expected close date, and is not emailed when there is nothing to report.';
  p_IsPortfolioWide_cc208e7dfbbe := FALSE;
  p_IncludeMissingCloseDate_cc208e7dfbbe := TRUE;
  p_SendWhenEmpty_cc208e7dfbbe := FALSE;
  p_GroupByCompany_cc208e7dfbbe := FALSE;
  p_DisplayRank_cc208e7dfbbe := 10;
  p_IsActive_cc208e7dfbbe := TRUE;
  IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales."DealDigestAudienceType"
                 WHERE "ID" = p_ID_cc208e7dfbbe OR "Code" = p_Code_cc208e7dfbbe) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '__mj_bizappssales' AND p.proname = 'spCreateDealDigestAudienceType'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM __mj_BizAppsSales."spCreateDealDigestAudienceType"(p_data := jsonb_build_object(
    'ID', p_ID_cc208e7dfbbe,
    'Code', p_Code_cc208e7dfbbe,
    'Name', p_Name_cc208e7dfbbe,
    'Description', p_Description_cc208e7dfbbe,
    'IsPortfolioWide', p_IsPortfolioWide_cc208e7dfbbe,
    'MinDaysLapsed', p_MinDaysLapsed_cc208e7dfbbe,
    'IncludeMissingCloseDate', p_IncludeMissingCloseDate_cc208e7dfbbe,
    'SendWhenEmpty', p_SendWhenEmpty_cc208e7dfbbe,
    'GroupByCompany', p_GroupByCompany_cc208e7dfbbe,
    'SubjectTemplate', p_SubjectTemplate_cc208e7dfbbe,
    'IntroTemplate', p_IntroTemplate_cc208e7dfbbe,
    'EmptyMessage', p_EmptyMessage_cc208e7dfbbe,
    'DisplayRank', p_DisplayRank_cc208e7dfbbe,
    'IsActive', p_IsActive_cc208e7dfbbe
  ));
    ELSE
      PERFORM __mj_BizAppsSales."spCreateDealDigestAudienceType"(p_ID := p_ID_cc208e7dfbbe, p_Code := p_Code_cc208e7dfbbe, p_Name := p_Name_cc208e7dfbbe, p_Description := p_Description_cc208e7dfbbe, p_IsPortfolioWide := p_IsPortfolioWide_cc208e7dfbbe, p_MinDaysLapsed := p_MinDaysLapsed_cc208e7dfbbe, p_MinDaysLapsed_Clear := TRUE, p_IncludeMissingCloseDate := p_IncludeMissingCloseDate_cc208e7dfbbe, p_SendWhenEmpty := p_SendWhenEmpty_cc208e7dfbbe, p_GroupByCompany := p_GroupByCompany_cc208e7dfbbe, p_SubjectTemplate := p_SubjectTemplate_cc208e7dfbbe, p_SubjectTemplate_Clear := TRUE, p_IntroTemplate := p_IntroTemplate_cc208e7dfbbe, p_IntroTemplate_Clear := TRUE, p_EmptyMessage := p_EmptyMessage_cc208e7dfbbe, p_EmptyMessage_Clear := TRUE, p_DisplayRank := p_DisplayRank_cc208e7dfbbe, p_IsActive := p_IsActive_cc208e7dfbbe);
    END IF;
  END IF;
END $mj$;

-- Save MJ_BizApps_Sales: Deal Digest Audience Types (core SP call only)
DO $mj$
DECLARE
  p_ID_72f04b4ac960 UUID;
  p_Code_72f04b4ac960 VARCHAR(50);
  p_Name_72f04b4ac960 VARCHAR(100);
  p_Description_72f04b4ac960 TEXT;
  p_IsPortfolioWide_72f04b4ac960 BOOLEAN;
  p_MinDaysLapsed_72f04b4ac960 INTEGER;
  p_IncludeMissingCloseDate_72f04b4ac960 BOOLEAN;
  p_SendWhenEmpty_72f04b4ac960 BOOLEAN;
  p_GroupByCompany_72f04b4ac960 BOOLEAN;
  p_SubjectTemplate_72f04b4ac960 VARCHAR(255);
  p_IntroTemplate_72f04b4ac960 TEXT;
  p_EmptyMessage_72f04b4ac960 VARCHAR(500);
  p_DisplayRank_72f04b4ac960 INTEGER;
  p_IsActive_72f04b4ac960 BOOLEAN;
BEGIN
  p_ID_72f04b4ac960 := '1C1A3DC1-F2EE-4B85-9855-4908814DDCA4';
  p_Code_72f04b4ac960 := 'CEO';
  p_Name_72f04b4ac960 := 'CEO';
  p_Description_72f04b4ac960 := 'Portfolio-wide view of deals lapsed more than 14 days, plus deals with no expected close date, grouped by company. Emailed even when there is nothing to report.';
  p_IsPortfolioWide_72f04b4ac960 := TRUE;
  p_MinDaysLapsed_72f04b4ac960 := 14;
  p_IncludeMissingCloseDate_72f04b4ac960 := TRUE;
  p_SendWhenEmpty_72f04b4ac960 := TRUE;
  p_GroupByCompany_72f04b4ac960 := TRUE;
  p_DisplayRank_72f04b4ac960 := 20;
  p_IsActive_72f04b4ac960 := TRUE;
  IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales."DealDigestAudienceType"
                 WHERE "ID" = p_ID_72f04b4ac960 OR "Code" = p_Code_72f04b4ac960) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '__mj_bizappssales' AND p.proname = 'spCreateDealDigestAudienceType'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM __mj_BizAppsSales."spCreateDealDigestAudienceType"(p_data := jsonb_build_object(
    'ID', p_ID_72f04b4ac960,
    'Code', p_Code_72f04b4ac960,
    'Name', p_Name_72f04b4ac960,
    'Description', p_Description_72f04b4ac960,
    'IsPortfolioWide', p_IsPortfolioWide_72f04b4ac960,
    'MinDaysLapsed', p_MinDaysLapsed_72f04b4ac960,
    'IncludeMissingCloseDate', p_IncludeMissingCloseDate_72f04b4ac960,
    'SendWhenEmpty', p_SendWhenEmpty_72f04b4ac960,
    'GroupByCompany', p_GroupByCompany_72f04b4ac960,
    'SubjectTemplate', p_SubjectTemplate_72f04b4ac960,
    'IntroTemplate', p_IntroTemplate_72f04b4ac960,
    'EmptyMessage', p_EmptyMessage_72f04b4ac960,
    'DisplayRank', p_DisplayRank_72f04b4ac960,
    'IsActive', p_IsActive_72f04b4ac960
  ));
    ELSE
      PERFORM __mj_BizAppsSales."spCreateDealDigestAudienceType"(p_ID := p_ID_72f04b4ac960, p_Code := p_Code_72f04b4ac960, p_Name := p_Name_72f04b4ac960, p_Description := p_Description_72f04b4ac960, p_IsPortfolioWide := p_IsPortfolioWide_72f04b4ac960, p_MinDaysLapsed := p_MinDaysLapsed_72f04b4ac960, p_IncludeMissingCloseDate := p_IncludeMissingCloseDate_72f04b4ac960, p_SendWhenEmpty := p_SendWhenEmpty_72f04b4ac960, p_GroupByCompany := p_GroupByCompany_72f04b4ac960, p_SubjectTemplate := p_SubjectTemplate_72f04b4ac960, p_SubjectTemplate_Clear := TRUE, p_IntroTemplate := p_IntroTemplate_72f04b4ac960, p_IntroTemplate_Clear := TRUE, p_EmptyMessage := p_EmptyMessage_72f04b4ac960, p_EmptyMessage_Clear := TRUE, p_DisplayRank := p_DisplayRank_72f04b4ac960, p_IsActive := p_IsActive_72f04b4ac960);
    END IF;
  END IF;
END $mj$;

-- Save MJ_BizApps_Sales: Deal Digest Audience Types (core SP call only)
DO $mj$
DECLARE
  p_ID_6228ef32690d UUID;
  p_Code_6228ef32690d VARCHAR(50);
  p_Name_6228ef32690d VARCHAR(100);
  p_Description_6228ef32690d TEXT;
  p_IsPortfolioWide_6228ef32690d BOOLEAN;
  p_MinDaysLapsed_6228ef32690d INTEGER;
  p_IncludeMissingCloseDate_6228ef32690d BOOLEAN;
  p_SendWhenEmpty_6228ef32690d BOOLEAN;
  p_GroupByCompany_6228ef32690d BOOLEAN;
  p_SubjectTemplate_6228ef32690d VARCHAR(255);
  p_IntroTemplate_6228ef32690d TEXT;
  p_EmptyMessage_6228ef32690d VARCHAR(500);
  p_DisplayRank_6228ef32690d INTEGER;
  p_IsActive_6228ef32690d BOOLEAN;
BEGIN
  p_ID_6228ef32690d := '940F62AB-118E-462C-813A-067B6111456D';
  p_Code_6228ef32690d := 'CFO';
  p_Name_6228ef32690d := 'CFO';
  p_Description_6228ef32690d := 'Portfolio-wide view of every lapsed deal at any age, plus deals with no expected close date, grouped by company. Emailed even when there is nothing to report.';
  p_IsPortfolioWide_6228ef32690d := TRUE;
  p_IncludeMissingCloseDate_6228ef32690d := TRUE;
  p_SendWhenEmpty_6228ef32690d := TRUE;
  p_GroupByCompany_6228ef32690d := TRUE;
  p_DisplayRank_6228ef32690d := 30;
  p_IsActive_6228ef32690d := TRUE;
  IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales."DealDigestAudienceType"
                 WHERE "ID" = p_ID_6228ef32690d OR "Code" = p_Code_6228ef32690d) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '__mj_bizappssales' AND p.proname = 'spCreateDealDigestAudienceType'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM __mj_BizAppsSales."spCreateDealDigestAudienceType"(p_data := jsonb_build_object(
    'ID', p_ID_6228ef32690d,
    'Code', p_Code_6228ef32690d,
    'Name', p_Name_6228ef32690d,
    'Description', p_Description_6228ef32690d,
    'IsPortfolioWide', p_IsPortfolioWide_6228ef32690d,
    'MinDaysLapsed', p_MinDaysLapsed_6228ef32690d,
    'IncludeMissingCloseDate', p_IncludeMissingCloseDate_6228ef32690d,
    'SendWhenEmpty', p_SendWhenEmpty_6228ef32690d,
    'GroupByCompany', p_GroupByCompany_6228ef32690d,
    'SubjectTemplate', p_SubjectTemplate_6228ef32690d,
    'IntroTemplate', p_IntroTemplate_6228ef32690d,
    'EmptyMessage', p_EmptyMessage_6228ef32690d,
    'DisplayRank', p_DisplayRank_6228ef32690d,
    'IsActive', p_IsActive_6228ef32690d
  ));
    ELSE
      PERFORM __mj_BizAppsSales."spCreateDealDigestAudienceType"(p_ID := p_ID_6228ef32690d, p_Code := p_Code_6228ef32690d, p_Name := p_Name_6228ef32690d, p_Description := p_Description_6228ef32690d, p_IsPortfolioWide := p_IsPortfolioWide_6228ef32690d, p_MinDaysLapsed := p_MinDaysLapsed_6228ef32690d, p_MinDaysLapsed_Clear := TRUE, p_IncludeMissingCloseDate := p_IncludeMissingCloseDate_6228ef32690d, p_SendWhenEmpty := p_SendWhenEmpty_6228ef32690d, p_GroupByCompany := p_GroupByCompany_6228ef32690d, p_SubjectTemplate := p_SubjectTemplate_6228ef32690d, p_SubjectTemplate_Clear := TRUE, p_IntroTemplate := p_IntroTemplate_6228ef32690d, p_IntroTemplate_Clear := TRUE, p_EmptyMessage := p_EmptyMessage_6228ef32690d, p_EmptyMessage_Clear := TRUE, p_DisplayRank := p_DisplayRank_6228ef32690d, p_IsActive := p_IsActive_6228ef32690d);
    END IF;
  END IF;
END $mj$;

-- Save MJ_BizApps_Sales: Deal Digest Audience Types (core SP call only)
DO $mj$
DECLARE
  p_ID_59fa4b758222 UUID;
  p_Code_59fa4b758222 VARCHAR(50);
  p_Name_59fa4b758222 VARCHAR(100);
  p_Description_59fa4b758222 TEXT;
  p_IsPortfolioWide_59fa4b758222 BOOLEAN;
  p_MinDaysLapsed_59fa4b758222 INTEGER;
  p_IncludeMissingCloseDate_59fa4b758222 BOOLEAN;
  p_SendWhenEmpty_59fa4b758222 BOOLEAN;
  p_GroupByCompany_59fa4b758222 BOOLEAN;
  p_SubjectTemplate_59fa4b758222 VARCHAR(255);
  p_IntroTemplate_59fa4b758222 TEXT;
  p_EmptyMessage_59fa4b758222 VARCHAR(500);
  p_DisplayRank_59fa4b758222 INTEGER;
  p_IsActive_59fa4b758222 BOOLEAN;
BEGIN
  p_ID_59fa4b758222 := '50DE2B54-6E5E-4472-B3E4-A9135E655A3D';
  p_Code_59fa4b758222 := 'CTO';
  p_Name_59fa4b758222 := 'CTO';
  p_Description_59fa4b758222 := 'Portfolio-wide view of deals lapsed more than 14 days, plus deals with no expected close date, grouped by company. Emailed even when there is nothing to report.';
  p_IsPortfolioWide_59fa4b758222 := TRUE;
  p_MinDaysLapsed_59fa4b758222 := 14;
  p_IncludeMissingCloseDate_59fa4b758222 := TRUE;
  p_SendWhenEmpty_59fa4b758222 := TRUE;
  p_GroupByCompany_59fa4b758222 := TRUE;
  p_DisplayRank_59fa4b758222 := 40;
  p_IsActive_59fa4b758222 := TRUE;
  IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales."DealDigestAudienceType"
                 WHERE "ID" = p_ID_59fa4b758222 OR "Code" = p_Code_59fa4b758222) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '__mj_bizappssales' AND p.proname = 'spCreateDealDigestAudienceType'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM __mj_BizAppsSales."spCreateDealDigestAudienceType"(p_data := jsonb_build_object(
    'ID', p_ID_59fa4b758222,
    'Code', p_Code_59fa4b758222,
    'Name', p_Name_59fa4b758222,
    'Description', p_Description_59fa4b758222,
    'IsPortfolioWide', p_IsPortfolioWide_59fa4b758222,
    'MinDaysLapsed', p_MinDaysLapsed_59fa4b758222,
    'IncludeMissingCloseDate', p_IncludeMissingCloseDate_59fa4b758222,
    'SendWhenEmpty', p_SendWhenEmpty_59fa4b758222,
    'GroupByCompany', p_GroupByCompany_59fa4b758222,
    'SubjectTemplate', p_SubjectTemplate_59fa4b758222,
    'IntroTemplate', p_IntroTemplate_59fa4b758222,
    'EmptyMessage', p_EmptyMessage_59fa4b758222,
    'DisplayRank', p_DisplayRank_59fa4b758222,
    'IsActive', p_IsActive_59fa4b758222
  ));
    ELSE
      PERFORM __mj_BizAppsSales."spCreateDealDigestAudienceType"(p_ID := p_ID_59fa4b758222, p_Code := p_Code_59fa4b758222, p_Name := p_Name_59fa4b758222, p_Description := p_Description_59fa4b758222, p_IsPortfolioWide := p_IsPortfolioWide_59fa4b758222, p_MinDaysLapsed := p_MinDaysLapsed_59fa4b758222, p_IncludeMissingCloseDate := p_IncludeMissingCloseDate_59fa4b758222, p_SendWhenEmpty := p_SendWhenEmpty_59fa4b758222, p_GroupByCompany := p_GroupByCompany_59fa4b758222, p_SubjectTemplate := p_SubjectTemplate_59fa4b758222, p_SubjectTemplate_Clear := TRUE, p_IntroTemplate := p_IntroTemplate_59fa4b758222, p_IntroTemplate_Clear := TRUE, p_EmptyMessage := p_EmptyMessage_59fa4b758222, p_EmptyMessage_Clear := TRUE, p_DisplayRank := p_DisplayRank_59fa4b758222, p_IsActive := p_IsActive_59fa4b758222);
    END IF;
  END IF;
END $mj$;

-- Save MJ: AI Agents (core SP call only)
DO $mj$
DECLARE
  p_ID_50931f96305f UUID;
  p_Name_50931f96305f VARCHAR(255);
  p_Description_50931f96305f TEXT;
  p_LogoURL_50931f96305f VARCHAR(255);
  p_ParentID_50931f96305f UUID;
  p_ExposeAsAction_50931f96305f BOOLEAN;
  p_ExecutionOrder_50931f96305f INTEGER;
  p_ExecutionMode_50931f96305f VARCHAR(20);
  p_EnableContextCompression_50931f96305f BOOLEAN;
  p_ContextCompressionMessageThreshold_50931f96305f INTEGER;
  p_ContextCompressionPromptID_50931f96305f UUID;
  p_ContextCompressionMessageRetentionCount_50931f96305f INTEGER;
  p_TypeID_50931f96305f UUID;
  p_Status_50931f96305f VARCHAR(20);
  p_DriverClass_50931f96305f VARCHAR(255);
  p_IconClass_50931f96305f VARCHAR(100);
  p_ModelSelectionMode_50931f96305f VARCHAR(50);
  p_PayloadDownstreamPaths_50931f96305f TEXT;
  p_PayloadUpstreamPaths_50931f96305f TEXT;
  p_PayloadSelfReadPaths_50931f96305f TEXT;
  p_PayloadSelfWritePaths_50931f96305f TEXT;
  p_PayloadScope_50931f96305f TEXT;
  p_FinalPayloadValidation_50931f96305f TEXT;
  p_FinalPayloadValidationMode_50931f96305f VARCHAR(25);
  p_FinalPayloadValidationMaxRetries_50931f96305f INTEGER;
  p_MaxCostPerRun_50931f96305f NUMERIC(10,4);
  p_MaxTokensPerRun_50931f96305f INTEGER;
  p_MaxIterationsPerRun_50931f96305f INTEGER;
  p_MaxTimePerRun_50931f96305f INTEGER;
  p_MinExecutionsPerRun_50931f96305f INTEGER;
  p_MaxExecutionsPerRun_50931f96305f INTEGER;
  p_StartingPayloadValidation_50931f96305f TEXT;
  p_StartingPayloadValidationMode_50931f96305f VARCHAR(25);
  p_DefaultPromptEffortLevel_50931f96305f INTEGER;
  p_ChatHandlingOption_50931f96305f VARCHAR(30);
  p_DefaultArtifactTypeID_50931f96305f UUID;
  p_OwnerUserID_50931f96305f UUID;
  p_InvocationMode_50931f96305f VARCHAR(20);
  p_ArtifactCreationMode_50931f96305f VARCHAR(20);
  p_FunctionalRequirements_50931f96305f TEXT;
  p_TechnicalDesign_50931f96305f TEXT;
  p_InjectNotes_50931f96305f BOOLEAN;
  p_MaxNotesToInject_50931f96305f INTEGER;
  p_NoteInjectionStrategy_50931f96305f VARCHAR(20);
  p_InjectExamples_50931f96305f BOOLEAN;
  p_MaxExamplesToInject_50931f96305f INTEGER;
  p_ExampleInjectionStrategy_50931f96305f VARCHAR(20);
  p_IsRestricted_50931f96305f BOOLEAN;
  p_MessageMode_50931f96305f VARCHAR(50);
  p_MaxMessages_50931f96305f INTEGER;
  p_AttachmentStorageProviderID_50931f96305f UUID;
  p_AttachmentRootPath_50931f96305f VARCHAR(500);
  p_InlineStorageThresholdBytes_50931f96305f INTEGER;
  p_AgentTypePromptParams_50931f96305f TEXT;
  p_ScopeConfig_50931f96305f TEXT;
  p_NoteRetentionDays_50931f96305f INTEGER;
  p_ExampleRetentionDays_50931f96305f INTEGER;
  p_AutoArchiveEnabled_50931f96305f BOOLEAN;
  p_RerankerConfiguration_50931f96305f TEXT;
  p_CategoryID_50931f96305f UUID;
  p_AllowEphemeralClientTools_50931f96305f BOOLEAN;
  p_DefaultStorageAccountID_50931f96305f UUID;
  p_SearchScopeAccess_50931f96305f VARCHAR(20);
  p_AcceptUnregisteredFiles_50931f96305f BOOLEAN;
  p_DefaultCoAgentID_50931f96305f UUID;
  p_TypeConfiguration_50931f96305f TEXT;
  p_AllowMemoryWrite_50931f96305f BOOLEAN;
  p_RecordingDefault_50931f96305f VARCHAR(20);
  p_RecordingStorageProviderID_50931f96305f UUID;
  p_DefaultMediaCollectionID_50931f96305f UUID;
  p_SupportsPlanMode_50931f96305f BOOLEAN;
  p_AcceptsSkills_50931f96305f VARCHAR(20);
  p_SkillActivationMode_50931f96305f VARCHAR(20);
  p_RequirePlanMode_50931f96305f BOOLEAN;
  p_ContextWindowMaxTokens_50931f96305f INTEGER;
  p_CompactionTriggerPercent_50931f96305f INTEGER;
  p_CompactionTargetPercent_50931f96305f INTEGER;
  p_ConversationSummaryPromptID_50931f96305f UUID;
  p_DeclareActionsAsNativeTools_50931f96305f BOOLEAN;
  p_MaxSubAgentConsultRounds_50931f96305f INTEGER;
BEGIN
  p_ID_50931f96305f := 'D5306AEA-0736-47C8-8B69-480389857481';
  p_Name_50931f96305f := 'Sales — Lapsed Close Date Digest';
  p_Description_50931f96305f := 'Emails each configured recipient the deals whose expected close date has lapsed, scoped by that recipient''s audience type. Runs from a scheduled job; pass {"dryRun": true} as the job''s StartingPayload to compose without sending.';
  p_ExposeAsAction_50931f96305f := FALSE;
  p_ExecutionOrder_50931f96305f := 0;
  p_ExecutionMode_50931f96305f := 'Sequential';
  p_EnableContextCompression_50931f96305f := FALSE;
  p_TypeID_50931f96305f := (SELECT "ID" FROM "${mjSchema}"."AIAgentType" WHERE LOWER("Name") = LOWER('Loop'));
  p_Status_50931f96305f := 'Active';
  p_DriverClass_50931f96305f := 'Sales.LapsedCloseDateDigest';
  p_ModelSelectionMode_50931f96305f := 'Agent Type';
  p_PayloadDownstreamPaths_50931f96305f := '["*"]';
  p_PayloadUpstreamPaths_50931f96305f := '["*"]';
  p_FinalPayloadValidationMode_50931f96305f := 'Retry';
  p_FinalPayloadValidationMaxRetries_50931f96305f := 3;
  p_MaxIterationsPerRun_50931f96305f := 1;
  p_StartingPayloadValidationMode_50931f96305f := 'Fail';
  p_InvocationMode_50931f96305f := 'Any';
  p_ArtifactCreationMode_50931f96305f := 'Always';
  p_InjectNotes_50931f96305f := TRUE;
  p_MaxNotesToInject_50931f96305f := 5;
  p_NoteInjectionStrategy_50931f96305f := 'Relevant';
  p_InjectExamples_50931f96305f := FALSE;
  p_MaxExamplesToInject_50931f96305f := 3;
  p_ExampleInjectionStrategy_50931f96305f := 'Semantic';
  p_IsRestricted_50931f96305f := FALSE;
  p_MessageMode_50931f96305f := 'None';
  p_NoteRetentionDays_50931f96305f := 90;
  p_ExampleRetentionDays_50931f96305f := 180;
  p_AutoArchiveEnabled_50931f96305f := TRUE;
  p_AllowEphemeralClientTools_50931f96305f := TRUE;
  p_SearchScopeAccess_50931f96305f := 'None';
  p_AcceptUnregisteredFiles_50931f96305f := FALSE;
  p_AllowMemoryWrite_50931f96305f := TRUE;
  p_SupportsPlanMode_50931f96305f := TRUE;
  p_AcceptsSkills_50931f96305f := 'None';
  p_SkillActivationMode_50931f96305f := 'RequestedOnly';
  p_RequirePlanMode_50931f96305f := FALSE;
  p_DeclareActionsAsNativeTools_50931f96305f := TRUE;
  IF p_TypeID_50931f96305f IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "${mjSchema}"."AIAgent"
                     WHERE "ID" = p_ID_50931f96305f OR "Name" = p_Name_50931f96305f) THEN
    PERFORM "${mjSchema}"."spCreateAIAgent"(p_data := jsonb_build_object(
    'ID', p_ID_50931f96305f,
    'Name', p_Name_50931f96305f,
    'Description', p_Description_50931f96305f,
    'LogoURL', p_LogoURL_50931f96305f,
    'ParentID', p_ParentID_50931f96305f,
    'ExposeAsAction', p_ExposeAsAction_50931f96305f,
    'ExecutionOrder', p_ExecutionOrder_50931f96305f,
    'ExecutionMode', p_ExecutionMode_50931f96305f,
    'EnableContextCompression', p_EnableContextCompression_50931f96305f,
    'ContextCompressionMessageThreshold', p_ContextCompressionMessageThreshold_50931f96305f,
    'ContextCompressionPromptID', p_ContextCompressionPromptID_50931f96305f,
    'ContextCompressionMessageRetentionCount', p_ContextCompressionMessageRetentionCount_50931f96305f,
    'TypeID', p_TypeID_50931f96305f,
    'Status', p_Status_50931f96305f,
    'DriverClass', p_DriverClass_50931f96305f,
    'IconClass', p_IconClass_50931f96305f,
    'ModelSelectionMode', p_ModelSelectionMode_50931f96305f,
    'PayloadDownstreamPaths', p_PayloadDownstreamPaths_50931f96305f,
    'PayloadUpstreamPaths', p_PayloadUpstreamPaths_50931f96305f,
    'PayloadSelfReadPaths', p_PayloadSelfReadPaths_50931f96305f,
    'PayloadSelfWritePaths', p_PayloadSelfWritePaths_50931f96305f,
    'PayloadScope', p_PayloadScope_50931f96305f,
    'FinalPayloadValidation', p_FinalPayloadValidation_50931f96305f,
    'FinalPayloadValidationMode', p_FinalPayloadValidationMode_50931f96305f,
    'FinalPayloadValidationMaxRetries', p_FinalPayloadValidationMaxRetries_50931f96305f,
    'MaxCostPerRun', p_MaxCostPerRun_50931f96305f,
    'MaxTokensPerRun', p_MaxTokensPerRun_50931f96305f,
    'MaxIterationsPerRun', p_MaxIterationsPerRun_50931f96305f,
    'MaxTimePerRun', p_MaxTimePerRun_50931f96305f,
    'MinExecutionsPerRun', p_MinExecutionsPerRun_50931f96305f,
    'MaxExecutionsPerRun', p_MaxExecutionsPerRun_50931f96305f,
    'StartingPayloadValidation', p_StartingPayloadValidation_50931f96305f,
    'StartingPayloadValidationMode', p_StartingPayloadValidationMode_50931f96305f,
    'DefaultPromptEffortLevel', p_DefaultPromptEffortLevel_50931f96305f,
    'ChatHandlingOption', p_ChatHandlingOption_50931f96305f,
    'DefaultArtifactTypeID', p_DefaultArtifactTypeID_50931f96305f,
    'OwnerUserID', p_OwnerUserID_50931f96305f,
    'InvocationMode', p_InvocationMode_50931f96305f,
    'ArtifactCreationMode', p_ArtifactCreationMode_50931f96305f,
    'FunctionalRequirements', p_FunctionalRequirements_50931f96305f,
    'TechnicalDesign', p_TechnicalDesign_50931f96305f,
    'InjectNotes', p_InjectNotes_50931f96305f,
    'MaxNotesToInject', p_MaxNotesToInject_50931f96305f,
    'NoteInjectionStrategy', p_NoteInjectionStrategy_50931f96305f,
    'InjectExamples', p_InjectExamples_50931f96305f,
    'MaxExamplesToInject', p_MaxExamplesToInject_50931f96305f,
    'ExampleInjectionStrategy', p_ExampleInjectionStrategy_50931f96305f,
    'IsRestricted', p_IsRestricted_50931f96305f,
    'MessageMode', p_MessageMode_50931f96305f,
    'MaxMessages', p_MaxMessages_50931f96305f
  ) ||
  jsonb_build_object(
    'AttachmentStorageProviderID', p_AttachmentStorageProviderID_50931f96305f,
    'AttachmentRootPath', p_AttachmentRootPath_50931f96305f,
    'InlineStorageThresholdBytes', p_InlineStorageThresholdBytes_50931f96305f,
    'AgentTypePromptParams', p_AgentTypePromptParams_50931f96305f,
    'ScopeConfig', p_ScopeConfig_50931f96305f,
    'NoteRetentionDays', p_NoteRetentionDays_50931f96305f,
    'ExampleRetentionDays', p_ExampleRetentionDays_50931f96305f,
    'AutoArchiveEnabled', p_AutoArchiveEnabled_50931f96305f,
    'RerankerConfiguration', p_RerankerConfiguration_50931f96305f,
    'CategoryID', p_CategoryID_50931f96305f,
    'AllowEphemeralClientTools', p_AllowEphemeralClientTools_50931f96305f,
    'DefaultStorageAccountID', p_DefaultStorageAccountID_50931f96305f,
    'SearchScopeAccess', p_SearchScopeAccess_50931f96305f,
    'AcceptUnregisteredFiles', p_AcceptUnregisteredFiles_50931f96305f,
    'DefaultCoAgentID', p_DefaultCoAgentID_50931f96305f,
    'TypeConfiguration', p_TypeConfiguration_50931f96305f,
    'AllowMemoryWrite', p_AllowMemoryWrite_50931f96305f,
    'RecordingDefault', p_RecordingDefault_50931f96305f,
    'RecordingStorageProviderID', p_RecordingStorageProviderID_50931f96305f,
    'DefaultMediaCollectionID', p_DefaultMediaCollectionID_50931f96305f,
    'SupportsPlanMode', p_SupportsPlanMode_50931f96305f,
    'AcceptsSkills', p_AcceptsSkills_50931f96305f,
    'SkillActivationMode', p_SkillActivationMode_50931f96305f,
    'RequirePlanMode', p_RequirePlanMode_50931f96305f,
    'ContextWindowMaxTokens', p_ContextWindowMaxTokens_50931f96305f,
    'CompactionTriggerPercent', p_CompactionTriggerPercent_50931f96305f,
    'CompactionTargetPercent', p_CompactionTargetPercent_50931f96305f,
    'ConversationSummaryPromptID', p_ConversationSummaryPromptID_50931f96305f,
    'DeclareActionsAsNativeTools', p_DeclareActionsAsNativeTools_50931f96305f,
    'MaxSubAgentConsultRounds', p_MaxSubAgentConsultRounds_50931f96305f
  ));
  END IF;
END $mj$;

-- Save MJ: Scheduled Jobs (core SP call only)
DO $mj$
DECLARE
  p_ID_e5223308c0ff UUID;
  p_JobTypeID_e5223308c0ff UUID;
  p_Name_e5223308c0ff VARCHAR(200);
  p_Description_e5223308c0ff TEXT;
  p_CronExpression_e5223308c0ff VARCHAR(120);
  p_Timezone_e5223308c0ff VARCHAR(64);
  p_StartAt_e5223308c0ff TIMESTAMPTZ;
  p_EndAt_e5223308c0ff TIMESTAMPTZ;
  p_Status_e5223308c0ff VARCHAR(20);
  p_Configuration_e5223308c0ff TEXT;
  p_OwnerUserID_e5223308c0ff UUID;
  p_LastRunAt_e5223308c0ff TIMESTAMPTZ;
  p_NextRunAt_e5223308c0ff TIMESTAMPTZ;
  p_RunCount_e5223308c0ff INTEGER;
  p_SuccessCount_e5223308c0ff INTEGER;
  p_FailureCount_e5223308c0ff INTEGER;
  p_NotifyOnSuccess_e5223308c0ff BOOLEAN;
  p_NotifyOnFailure_e5223308c0ff BOOLEAN;
  p_NotifyUserID_e5223308c0ff UUID;
  p_NotifyViaEmail_e5223308c0ff BOOLEAN;
  p_NotifyViaInApp_e5223308c0ff BOOLEAN;
  p_LockToken_e5223308c0ff UUID;
  p_LockedAt_e5223308c0ff TIMESTAMPTZ;
  p_LockedByInstance_e5223308c0ff VARCHAR(255);
  p_ExpectedCompletionAt_e5223308c0ff TIMESTAMPTZ;
  p_ConcurrencyMode_e5223308c0ff VARCHAR(20);
  p_RunImmediatelyIfNeverRun_e5223308c0ff BOOLEAN;
  p_MaxRuntimeMinutes_e5223308c0ff INTEGER;
  p_MissedRunPolicy_e5223308c0ff VARCHAR(20);
BEGIN
  p_ID_e5223308c0ff := '67069328-7126-4A91-8647-E58FA49A062B';
  p_JobTypeID_e5223308c0ff := (SELECT "ID" FROM "${mjSchema}"."ScheduledJobType" WHERE LOWER("Name") = LOWER('Agent'));
  p_Name_e5223308c0ff := 'Sales — Lapsed Close Date Digest (weekly)';
  p_Description_e5223308c0ff := 'Emails each digest recipient the deals whose expected close date has lapsed. Ships Disabled until a host has set the digest Application Settings and added recipients.';
  p_CronExpression_e5223308c0ff := '0 0 9 * * 1';
  p_Timezone_e5223308c0ff := 'America/New_York';
  p_Status_e5223308c0ff := 'Disabled';
  p_Configuration_e5223308c0ff := '{"AgentID":"D5306AEA-0736-47C8-8B69-480389857481"}';
  p_RunCount_e5223308c0ff := 0;
  p_SuccessCount_e5223308c0ff := 0;
  p_FailureCount_e5223308c0ff := 0;
  p_NotifyOnSuccess_e5223308c0ff := FALSE;
  p_NotifyOnFailure_e5223308c0ff := FALSE;
  p_NotifyViaEmail_e5223308c0ff := FALSE;
  p_NotifyViaInApp_e5223308c0ff := FALSE;
  p_ConcurrencyMode_e5223308c0ff := 'Skip';
  p_RunImmediatelyIfNeverRun_e5223308c0ff := FALSE;
  p_MaxRuntimeMinutes_e5223308c0ff := 15;
  p_MissedRunPolicy_e5223308c0ff := 'RunOnce';
  IF p_JobTypeID_e5223308c0ff IS NOT NULL
     AND EXISTS (SELECT 1 FROM "${mjSchema}"."AIAgent" WHERE "ID" = 'D5306AEA-0736-47C8-8B69-480389857481')
     AND NOT EXISTS (SELECT 1 FROM "${mjSchema}"."ScheduledJob"
                     WHERE "ID" = p_ID_e5223308c0ff OR "Name" = p_Name_e5223308c0ff) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateScheduledJob'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateScheduledJob"(p_data := jsonb_build_object(
    'ID', p_ID_e5223308c0ff,
    'JobTypeID', p_JobTypeID_e5223308c0ff,
    'Name', p_Name_e5223308c0ff,
    'Description', p_Description_e5223308c0ff,
    'CronExpression', p_CronExpression_e5223308c0ff,
    'Timezone', p_Timezone_e5223308c0ff,
    'StartAt', p_StartAt_e5223308c0ff,
    'EndAt', p_EndAt_e5223308c0ff,
    'Status', p_Status_e5223308c0ff,
    'Configuration', p_Configuration_e5223308c0ff,
    'OwnerUserID', p_OwnerUserID_e5223308c0ff,
    'LastRunAt', p_LastRunAt_e5223308c0ff,
    'NextRunAt', p_NextRunAt_e5223308c0ff,
    'RunCount', p_RunCount_e5223308c0ff,
    'SuccessCount', p_SuccessCount_e5223308c0ff,
    'FailureCount', p_FailureCount_e5223308c0ff,
    'NotifyOnSuccess', p_NotifyOnSuccess_e5223308c0ff,
    'NotifyOnFailure', p_NotifyOnFailure_e5223308c0ff,
    'NotifyUserID', p_NotifyUserID_e5223308c0ff,
    'NotifyViaEmail', p_NotifyViaEmail_e5223308c0ff,
    'NotifyViaInApp', p_NotifyViaInApp_e5223308c0ff,
    'LockToken', p_LockToken_e5223308c0ff,
    'LockedAt', p_LockedAt_e5223308c0ff,
    'LockedByInstance', p_LockedByInstance_e5223308c0ff,
    'ExpectedCompletionAt', p_ExpectedCompletionAt_e5223308c0ff,
    'ConcurrencyMode', p_ConcurrencyMode_e5223308c0ff,
    'RunImmediatelyIfNeverRun', p_RunImmediatelyIfNeverRun_e5223308c0ff,
    'MaxRuntimeMinutes', p_MaxRuntimeMinutes_e5223308c0ff,
    'MissedRunPolicy', p_MissedRunPolicy_e5223308c0ff
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateScheduledJob"(p_ID := p_ID_e5223308c0ff, p_JobTypeID := p_JobTypeID_e5223308c0ff, p_Name := p_Name_e5223308c0ff, p_Description := p_Description_e5223308c0ff, p_CronExpression := p_CronExpression_e5223308c0ff, p_Timezone := p_Timezone_e5223308c0ff, p_StartAt := p_StartAt_e5223308c0ff, p_StartAt_Clear := TRUE, p_EndAt := p_EndAt_e5223308c0ff, p_EndAt_Clear := TRUE, p_Status := p_Status_e5223308c0ff, p_Configuration := p_Configuration_e5223308c0ff, p_OwnerUserID := p_OwnerUserID_e5223308c0ff, p_OwnerUserID_Clear := TRUE, p_LastRunAt := p_LastRunAt_e5223308c0ff, p_LastRunAt_Clear := TRUE, p_NextRunAt := p_NextRunAt_e5223308c0ff, p_NextRunAt_Clear := TRUE, p_RunCount := p_RunCount_e5223308c0ff, p_SuccessCount := p_SuccessCount_e5223308c0ff, p_FailureCount := p_FailureCount_e5223308c0ff, p_NotifyOnSuccess := p_NotifyOnSuccess_e5223308c0ff, p_NotifyOnFailure := p_NotifyOnFailure_e5223308c0ff, p_NotifyUserID := p_NotifyUserID_e5223308c0ff, p_NotifyUserID_Clear := TRUE, p_NotifyViaEmail := p_NotifyViaEmail_e5223308c0ff, p_NotifyViaInApp := p_NotifyViaInApp_e5223308c0ff, p_LockToken := p_LockToken_e5223308c0ff, p_LockToken_Clear := TRUE, p_LockedAt := p_LockedAt_e5223308c0ff, p_LockedAt_Clear := TRUE, p_LockedByInstance := p_LockedByInstance_e5223308c0ff, p_LockedByInstance_Clear := TRUE, p_ExpectedCompletionAt := p_ExpectedCompletionAt_e5223308c0ff, p_ExpectedCompletionAt_Clear := TRUE, p_ConcurrencyMode := p_ConcurrencyMode_e5223308c0ff, p_RunImmediatelyIfNeverRun := p_RunImmediatelyIfNeverRun_e5223308c0ff, p_MaxRuntimeMinutes := p_MaxRuntimeMinutes_e5223308c0ff, p_MissedRunPolicy := p_MissedRunPolicy_e5223308c0ff);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Application Settings (core SP call only)
DO $mj$
DECLARE
  p_ID_8a490f73f370 UUID;
  p_ApplicationID_8a490f73f370 UUID;
  p_Name_8a490f73f370 VARCHAR(100);
  p_Value_8a490f73f370 TEXT;
  p_Comments_8a490f73f370 TEXT;
BEGIN
  p_ID_8a490f73f370 := '1B6FDB10-DB2F-41FE-8376-5A24DA469E46';
  p_ApplicationID_8a490f73f370 := (SELECT "ID" FROM "${mjSchema}"."Application" WHERE LOWER("Name") = LOWER('Sales'));
  p_Name_8a490f73f370 := 'ExplorerBaseUrl';
  p_Value_8a490f73f370 := '';
  p_Comments_8a490f73f370 := 'The base URL of this host''s MJ Explorer, for example https://explorer.example.com, used to turn each deal name in the digest into a link. Blank means deal names are rendered as plain text instead of links; nothing fails.';
  IF p_ApplicationID_8a490f73f370 IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "${mjSchema}"."ApplicationSetting"
                     WHERE "ID" = p_ID_8a490f73f370
                        OR ("ApplicationID" = p_ApplicationID_8a490f73f370 AND "Name" = p_Name_8a490f73f370)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateApplicationSetting'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateApplicationSetting"(p_data := jsonb_build_object(
    'ID', p_ID_8a490f73f370,
    'ApplicationID', p_ApplicationID_8a490f73f370,
    'Name', p_Name_8a490f73f370,
    'Value', p_Value_8a490f73f370,
    'Comments', p_Comments_8a490f73f370
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateApplicationSetting"(p_ID := p_ID_8a490f73f370, p_ApplicationID := p_ApplicationID_8a490f73f370, p_Name := p_Name_8a490f73f370, p_Value := p_Value_8a490f73f370, p_Comments := p_Comments_8a490f73f370);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Application Settings (core SP call only)
DO $mj$
DECLARE
  p_ID_21629d6394b3 UUID;
  p_ApplicationID_21629d6394b3 UUID;
  p_Name_21629d6394b3 VARCHAR(100);
  p_Value_21629d6394b3 TEXT;
  p_Comments_21629d6394b3 TEXT;
BEGIN
  p_ID_21629d6394b3 := '274BFCF7-FFBD-4901-9960-80B8906B1611';
  p_ApplicationID_21629d6394b3 := (SELECT "ID" FROM "${mjSchema}"."Application" WHERE LOWER("Name") = LOWER('Sales'));
  p_Name_21629d6394b3 := 'DigestFromAddress';
  p_Value_21629d6394b3 := '';
  p_Comments_21629d6394b3 := 'The fallback sender address for the digest, used for a recipient whose company has no CompanySenderIdentity. Blank means a send to such a recipient fails: the run records the error for that recipient and carries on with the others. The address must be one the configured provider is permitted to send as; a rejected sender fails the send.';
  IF p_ApplicationID_21629d6394b3 IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "${mjSchema}"."ApplicationSetting"
                     WHERE "ID" = p_ID_21629d6394b3
                        OR ("ApplicationID" = p_ApplicationID_21629d6394b3 AND "Name" = p_Name_21629d6394b3)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateApplicationSetting'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateApplicationSetting"(p_data := jsonb_build_object(
    'ID', p_ID_21629d6394b3,
    'ApplicationID', p_ApplicationID_21629d6394b3,
    'Name', p_Name_21629d6394b3,
    'Value', p_Value_21629d6394b3,
    'Comments', p_Comments_21629d6394b3
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateApplicationSetting"(p_ID := p_ID_21629d6394b3, p_ApplicationID := p_ApplicationID_21629d6394b3, p_Name := p_Name_21629d6394b3, p_Value := p_Value_21629d6394b3, p_Comments := p_Comments_21629d6394b3);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Application Settings (core SP call only)
DO $mj$
DECLARE
  p_ID_a7b2d0e38cb8 UUID;
  p_ApplicationID_a7b2d0e38cb8 UUID;
  p_Name_a7b2d0e38cb8 VARCHAR(100);
  p_Value_a7b2d0e38cb8 TEXT;
  p_Comments_a7b2d0e38cb8 TEXT;
BEGIN
  p_ID_a7b2d0e38cb8 := 'E001A9EB-E1EB-40C8-9629-E9E19C7A5159';
  p_ApplicationID_a7b2d0e38cb8 := (SELECT "ID" FROM "${mjSchema}"."Application" WHERE LOWER("Name") = LOWER('Sales'));
  p_Name_a7b2d0e38cb8 := 'DigestProvider';
  p_Value_a7b2d0e38cb8 := '';
  p_Comments_a7b2d0e38cb8 := 'The name of the communication provider that sends the digest, exactly as it appears in MJ: Communication Providers (for example the Microsoft Graph or SendGrid provider this host has configured). Blank means a real run stops up front with one error naming this setting. A dry run does not need it.';
  IF p_ApplicationID_a7b2d0e38cb8 IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "${mjSchema}"."ApplicationSetting"
                     WHERE "ID" = p_ID_a7b2d0e38cb8
                        OR ("ApplicationID" = p_ApplicationID_a7b2d0e38cb8 AND "Name" = p_Name_a7b2d0e38cb8)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateApplicationSetting'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateApplicationSetting"(p_data := jsonb_build_object(
    'ID', p_ID_a7b2d0e38cb8,
    'ApplicationID', p_ApplicationID_a7b2d0e38cb8,
    'Name', p_Name_a7b2d0e38cb8,
    'Value', p_Value_a7b2d0e38cb8,
    'Comments', p_Comments_a7b2d0e38cb8
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateApplicationSetting"(p_ID := p_ID_a7b2d0e38cb8, p_ApplicationID := p_ApplicationID_a7b2d0e38cb8, p_Name := p_Name_a7b2d0e38cb8, p_Value := p_Value_a7b2d0e38cb8, p_Comments := p_Comments_a7b2d0e38cb8);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Entity Permissions (core SP call only)
DO $mj$
DECLARE
  p_ID_9250ba664430 UUID;
  p_EntityID_9250ba664430 UUID;
  p_RoleID_9250ba664430 UUID;
  p_CanCreate_9250ba664430 BOOLEAN;
  p_CanRead_9250ba664430 BOOLEAN;
  p_CanUpdate_9250ba664430 BOOLEAN;
  p_CanDelete_9250ba664430 BOOLEAN;
  p_ReadRLSFilterID_9250ba664430 UUID;
  p_CreateRLSFilterID_9250ba664430 UUID;
  p_UpdateRLSFilterID_9250ba664430 UUID;
  p_DeleteRLSFilterID_9250ba664430 UUID;
  p_Type_9250ba664430 VARCHAR(10);
BEGIN
  p_ID_9250ba664430 := '8553B39C-5346-4935-907F-7E6D23A2CAE9';
  p_EntityID_9250ba664430 := (SELECT "ID" FROM "${mjSchema}"."Entity" WHERE LOWER("Name") = LOWER('MJ_BizApps_Sales: Deal Digest Recipients'));
  p_RoleID_9250ba664430 := (SELECT "ID" FROM "${mjSchema}"."Role" WHERE LOWER("Name") = LOWER('Sales Admin'));
  p_CanCreate_9250ba664430 := TRUE;
  p_CanRead_9250ba664430 := TRUE;
  p_CanUpdate_9250ba664430 := TRUE;
  p_CanDelete_9250ba664430 := TRUE;
  p_Type_9250ba664430 := 'Allow';
  IF p_EntityID_9250ba664430 IS NOT NULL AND p_RoleID_9250ba664430 IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "${mjSchema}"."EntityPermission"
                     WHERE "ID" = p_ID_9250ba664430
                        OR ("EntityID" = p_EntityID_9250ba664430 AND "RoleID" = p_RoleID_9250ba664430)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateEntityPermission'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateEntityPermission"(p_data := jsonb_build_object(
    'ID', p_ID_9250ba664430,
    'EntityID', p_EntityID_9250ba664430,
    'RoleID', p_RoleID_9250ba664430,
    'CanCreate', p_CanCreate_9250ba664430,
    'CanRead', p_CanRead_9250ba664430,
    'CanUpdate', p_CanUpdate_9250ba664430,
    'CanDelete', p_CanDelete_9250ba664430,
    'ReadRLSFilterID', p_ReadRLSFilterID_9250ba664430,
    'CreateRLSFilterID', p_CreateRLSFilterID_9250ba664430,
    'UpdateRLSFilterID', p_UpdateRLSFilterID_9250ba664430,
    'DeleteRLSFilterID', p_DeleteRLSFilterID_9250ba664430,
    'Type', p_Type_9250ba664430
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateEntityPermission"(p_ID := p_ID_9250ba664430, p_EntityID := p_EntityID_9250ba664430, p_RoleID := p_RoleID_9250ba664430, p_CanCreate := p_CanCreate_9250ba664430, p_CanRead := p_CanRead_9250ba664430, p_CanUpdate := p_CanUpdate_9250ba664430, p_CanDelete := p_CanDelete_9250ba664430, p_ReadRLSFilterID := p_ReadRLSFilterID_9250ba664430, p_ReadRLSFilterID_Clear := TRUE, p_CreateRLSFilterID := p_CreateRLSFilterID_9250ba664430, p_CreateRLSFilterID_Clear := TRUE, p_UpdateRLSFilterID := p_UpdateRLSFilterID_9250ba664430, p_UpdateRLSFilterID_Clear := TRUE, p_DeleteRLSFilterID := p_DeleteRLSFilterID_9250ba664430, p_DeleteRLSFilterID_Clear := TRUE, p_Type := p_Type_9250ba664430);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Entity Permissions (core SP call only)
DO $mj$
DECLARE
  p_ID_cac464c39f4e UUID;
  p_EntityID_cac464c39f4e UUID;
  p_RoleID_cac464c39f4e UUID;
  p_CanCreate_cac464c39f4e BOOLEAN;
  p_CanRead_cac464c39f4e BOOLEAN;
  p_CanUpdate_cac464c39f4e BOOLEAN;
  p_CanDelete_cac464c39f4e BOOLEAN;
  p_ReadRLSFilterID_cac464c39f4e UUID;
  p_CreateRLSFilterID_cac464c39f4e UUID;
  p_UpdateRLSFilterID_cac464c39f4e UUID;
  p_DeleteRLSFilterID_cac464c39f4e UUID;
  p_Type_cac464c39f4e VARCHAR(10);
BEGIN
  p_ID_cac464c39f4e := '3716A059-C26E-4430-AB14-87E56DC57D59';
  p_EntityID_cac464c39f4e := (SELECT "ID" FROM "${mjSchema}"."Entity" WHERE LOWER("Name") = LOWER('MJ_BizApps_Sales: Deal Digest Audience Types'));
  p_RoleID_cac464c39f4e := (SELECT "ID" FROM "${mjSchema}"."Role" WHERE LOWER("Name") = LOWER('Sales Admin'));
  p_CanCreate_cac464c39f4e := TRUE;
  p_CanRead_cac464c39f4e := TRUE;
  p_CanUpdate_cac464c39f4e := TRUE;
  p_CanDelete_cac464c39f4e := FALSE;
  p_Type_cac464c39f4e := 'Allow';
  IF p_EntityID_cac464c39f4e IS NOT NULL AND p_RoleID_cac464c39f4e IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "${mjSchema}"."EntityPermission"
                     WHERE "ID" = p_ID_cac464c39f4e
                        OR ("EntityID" = p_EntityID_cac464c39f4e AND "RoleID" = p_RoleID_cac464c39f4e)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateEntityPermission'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateEntityPermission"(p_data := jsonb_build_object(
    'ID', p_ID_cac464c39f4e,
    'EntityID', p_EntityID_cac464c39f4e,
    'RoleID', p_RoleID_cac464c39f4e,
    'CanCreate', p_CanCreate_cac464c39f4e,
    'CanRead', p_CanRead_cac464c39f4e,
    'CanUpdate', p_CanUpdate_cac464c39f4e,
    'CanDelete', p_CanDelete_cac464c39f4e,
    'ReadRLSFilterID', p_ReadRLSFilterID_cac464c39f4e,
    'CreateRLSFilterID', p_CreateRLSFilterID_cac464c39f4e,
    'UpdateRLSFilterID', p_UpdateRLSFilterID_cac464c39f4e,
    'DeleteRLSFilterID', p_DeleteRLSFilterID_cac464c39f4e,
    'Type', p_Type_cac464c39f4e
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateEntityPermission"(p_ID := p_ID_cac464c39f4e, p_EntityID := p_EntityID_cac464c39f4e, p_RoleID := p_RoleID_cac464c39f4e, p_CanCreate := p_CanCreate_cac464c39f4e, p_CanRead := p_CanRead_cac464c39f4e, p_CanUpdate := p_CanUpdate_cac464c39f4e, p_CanDelete := p_CanDelete_cac464c39f4e, p_ReadRLSFilterID := p_ReadRLSFilterID_cac464c39f4e, p_ReadRLSFilterID_Clear := TRUE, p_CreateRLSFilterID := p_CreateRLSFilterID_cac464c39f4e, p_CreateRLSFilterID_Clear := TRUE, p_UpdateRLSFilterID := p_UpdateRLSFilterID_cac464c39f4e, p_UpdateRLSFilterID_Clear := TRUE, p_DeleteRLSFilterID := p_DeleteRLSFilterID_cac464c39f4e, p_DeleteRLSFilterID_Clear := TRUE, p_Type := p_Type_cac464c39f4e);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Entity Permissions (core SP call only)
DO $mj$
DECLARE
  p_ID_4786fb67f808 UUID;
  p_EntityID_4786fb67f808 UUID;
  p_RoleID_4786fb67f808 UUID;
  p_CanCreate_4786fb67f808 BOOLEAN;
  p_CanRead_4786fb67f808 BOOLEAN;
  p_CanUpdate_4786fb67f808 BOOLEAN;
  p_CanDelete_4786fb67f808 BOOLEAN;
  p_ReadRLSFilterID_4786fb67f808 UUID;
  p_CreateRLSFilterID_4786fb67f808 UUID;
  p_UpdateRLSFilterID_4786fb67f808 UUID;
  p_DeleteRLSFilterID_4786fb67f808 UUID;
  p_Type_4786fb67f808 VARCHAR(10);
BEGIN
  p_ID_4786fb67f808 := '6334CFAA-5204-48EA-AAEE-7E8B7F95650B';
  p_EntityID_4786fb67f808 := (SELECT "ID" FROM "${mjSchema}"."Entity" WHERE LOWER("Name") = LOWER('MJ_BizApps_Sales: Deal Digest Recipients'));
  p_RoleID_4786fb67f808 := (SELECT "ID" FROM "${mjSchema}"."Role" WHERE LOWER("Name") = LOWER('Sales User'));
  p_CanCreate_4786fb67f808 := FALSE;
  p_CanRead_4786fb67f808 := TRUE;
  p_CanUpdate_4786fb67f808 := FALSE;
  p_CanDelete_4786fb67f808 := FALSE;
  p_Type_4786fb67f808 := 'Allow';
  IF p_EntityID_4786fb67f808 IS NOT NULL AND p_RoleID_4786fb67f808 IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "${mjSchema}"."EntityPermission"
                     WHERE "ID" = p_ID_4786fb67f808
                        OR ("EntityID" = p_EntityID_4786fb67f808 AND "RoleID" = p_RoleID_4786fb67f808)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateEntityPermission'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateEntityPermission"(p_data := jsonb_build_object(
    'ID', p_ID_4786fb67f808,
    'EntityID', p_EntityID_4786fb67f808,
    'RoleID', p_RoleID_4786fb67f808,
    'CanCreate', p_CanCreate_4786fb67f808,
    'CanRead', p_CanRead_4786fb67f808,
    'CanUpdate', p_CanUpdate_4786fb67f808,
    'CanDelete', p_CanDelete_4786fb67f808,
    'ReadRLSFilterID', p_ReadRLSFilterID_4786fb67f808,
    'CreateRLSFilterID', p_CreateRLSFilterID_4786fb67f808,
    'UpdateRLSFilterID', p_UpdateRLSFilterID_4786fb67f808,
    'DeleteRLSFilterID', p_DeleteRLSFilterID_4786fb67f808,
    'Type', p_Type_4786fb67f808
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateEntityPermission"(p_ID := p_ID_4786fb67f808, p_EntityID := p_EntityID_4786fb67f808, p_RoleID := p_RoleID_4786fb67f808, p_CanCreate := p_CanCreate_4786fb67f808, p_CanRead := p_CanRead_4786fb67f808, p_CanUpdate := p_CanUpdate_4786fb67f808, p_CanDelete := p_CanDelete_4786fb67f808, p_ReadRLSFilterID := p_ReadRLSFilterID_4786fb67f808, p_ReadRLSFilterID_Clear := TRUE, p_CreateRLSFilterID := p_CreateRLSFilterID_4786fb67f808, p_CreateRLSFilterID_Clear := TRUE, p_UpdateRLSFilterID := p_UpdateRLSFilterID_4786fb67f808, p_UpdateRLSFilterID_Clear := TRUE, p_DeleteRLSFilterID := p_DeleteRLSFilterID_4786fb67f808, p_DeleteRLSFilterID_Clear := TRUE, p_Type := p_Type_4786fb67f808);
    END IF;
  END IF;
END $mj$;

-- Save MJ: Entity Permissions (core SP call only)
DO $mj$
DECLARE
  p_ID_fb0463c1cc9e UUID;
  p_EntityID_fb0463c1cc9e UUID;
  p_RoleID_fb0463c1cc9e UUID;
  p_CanCreate_fb0463c1cc9e BOOLEAN;
  p_CanRead_fb0463c1cc9e BOOLEAN;
  p_CanUpdate_fb0463c1cc9e BOOLEAN;
  p_CanDelete_fb0463c1cc9e BOOLEAN;
  p_ReadRLSFilterID_fb0463c1cc9e UUID;
  p_CreateRLSFilterID_fb0463c1cc9e UUID;
  p_UpdateRLSFilterID_fb0463c1cc9e UUID;
  p_DeleteRLSFilterID_fb0463c1cc9e UUID;
  p_Type_fb0463c1cc9e VARCHAR(10);
BEGIN
  p_ID_fb0463c1cc9e := '3D3B31F9-252A-4BC2-B9EA-0CBF698E2C12';
  p_EntityID_fb0463c1cc9e := (SELECT "ID" FROM "${mjSchema}"."Entity" WHERE LOWER("Name") = LOWER('MJ_BizApps_Sales: Deal Digest Audience Types'));
  p_RoleID_fb0463c1cc9e := (SELECT "ID" FROM "${mjSchema}"."Role" WHERE LOWER("Name") = LOWER('Sales User'));
  p_CanCreate_fb0463c1cc9e := FALSE;
  p_CanRead_fb0463c1cc9e := TRUE;
  p_CanUpdate_fb0463c1cc9e := FALSE;
  p_CanDelete_fb0463c1cc9e := FALSE;
  p_Type_fb0463c1cc9e := 'Allow';
  IF p_EntityID_fb0463c1cc9e IS NOT NULL AND p_RoleID_fb0463c1cc9e IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "${mjSchema}"."EntityPermission"
                     WHERE "ID" = p_ID_fb0463c1cc9e
                        OR ("EntityID" = p_EntityID_fb0463c1cc9e AND "RoleID" = p_RoleID_fb0463c1cc9e)) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateEntityPermission'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM "${mjSchema}"."spCreateEntityPermission"(p_data := jsonb_build_object(
    'ID', p_ID_fb0463c1cc9e,
    'EntityID', p_EntityID_fb0463c1cc9e,
    'RoleID', p_RoleID_fb0463c1cc9e,
    'CanCreate', p_CanCreate_fb0463c1cc9e,
    'CanRead', p_CanRead_fb0463c1cc9e,
    'CanUpdate', p_CanUpdate_fb0463c1cc9e,
    'CanDelete', p_CanDelete_fb0463c1cc9e,
    'ReadRLSFilterID', p_ReadRLSFilterID_fb0463c1cc9e,
    'CreateRLSFilterID', p_CreateRLSFilterID_fb0463c1cc9e,
    'UpdateRLSFilterID', p_UpdateRLSFilterID_fb0463c1cc9e,
    'DeleteRLSFilterID', p_DeleteRLSFilterID_fb0463c1cc9e,
    'Type', p_Type_fb0463c1cc9e
  ));
    ELSE
      PERFORM "${mjSchema}"."spCreateEntityPermission"(p_ID := p_ID_fb0463c1cc9e, p_EntityID := p_EntityID_fb0463c1cc9e, p_RoleID := p_RoleID_fb0463c1cc9e, p_CanCreate := p_CanCreate_fb0463c1cc9e, p_CanRead := p_CanRead_fb0463c1cc9e, p_CanUpdate := p_CanUpdate_fb0463c1cc9e, p_CanDelete := p_CanDelete_fb0463c1cc9e, p_ReadRLSFilterID := p_ReadRLSFilterID_fb0463c1cc9e, p_ReadRLSFilterID_Clear := TRUE, p_CreateRLSFilterID := p_CreateRLSFilterID_fb0463c1cc9e, p_CreateRLSFilterID_Clear := TRUE, p_UpdateRLSFilterID := p_UpdateRLSFilterID_fb0463c1cc9e, p_UpdateRLSFilterID_Clear := TRUE, p_DeleteRLSFilterID := p_DeleteRLSFilterID_fb0463c1cc9e, p_DeleteRLSFilterID_Clear := TRUE, p_Type := p_Type_fb0463c1cc9e);
    END IF;
  END IF;
END $mj$;
