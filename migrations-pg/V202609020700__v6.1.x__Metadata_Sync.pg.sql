-- =============================================================================================
-- PostgreSQL counterpart of V202609020700__v6.1.x__Metadata_Sync.sql -- BizApps Sales v6.1.x Metadata_Sync
-- =============================================================================================
-- Same records, same values, same order as the T-SQL file; see its header for what ships and why.
--
-- HOW IT WAS MADE
--   * `mj sql-convert --from tsql --to postgres` (MJ CLI 6.1.5) on the T-SQL file's sync blocks,
--     with the schema placeholders written out for the run. Each record is a DO block that calls
--     the core or app function, in whichever signature the host has (jsonb or named parameters).
--   * The converter does not translate the lookups and guards the T-SQL file adds, so they are
--     written here by hand from the T-SQL ones, block for block:
--       - SELECT TOP 1 @x = [ID] ... ORDER BY ... becomes
--         p_x := COALESCE((SELECT "ID" ... ORDER BY ... LIMIT 1), p_x), which keeps the literal
--         ID when nothing matches, as the T-SQL assignment does.
--       - IF <guard> EXEC ... becomes IF <guard> THEN <call> END IF.
--   * Every string value is taken verbatim from the T-SQL file: the converter rewrites T-SQL
--     inside string literals.
--   * Core calls use ${mjSchema}; app schemas are written lowercase, as PostgreSQL stores them.
--   * The three deletes that retire Sales.SyncActivities are plain calls, converted the same way.
-- =============================================================================================

SET standard_conforming_strings = on;

-- Save MJ_BizApps_Common: Activity Sync Extensions (core SP call only)
DO $mj$
DECLARE
  p_ID_86d22f4b UUID;
  p_Name_86d22f4b VARCHAR(200);
  p_Description_86d22f4b TEXT;
  p_DriverClass_86d22f4b VARCHAR(200);
  p_ActivitySyncConnectionID_86d22f4b UUID;
  p_ActivitySyncProviderTypeID_86d22f4b UUID;
  p_Sequence_86d22f4b INTEGER;
  p_FailurePolicy_86d22f4b VARCHAR(20);
  p_TimeoutMS_86d22f4b INTEGER;
  p_IsEnabled_86d22f4b BOOLEAN;
  p_LastRunAt_86d22f4b TIMESTAMPTZ;
  p_LastError_86d22f4b TEXT;
BEGIN
  p_ID_86d22f4b := 'a7c4e2b1-5d83-4f0a-9c1e-6b8d2f4a90c3';
  p_Name_86d22f4b := 'Sales.DealLinker';
  p_Description_86d22f4b := 'Inside the Activity write transaction, link matched open deals as Regarding. DealMatcher stays in sales; Common never learns what a deal is.';
  p_DriverClass_86d22f4b := 'Sales.DealLinker';
  p_Sequence_86d22f4b := 10;
  p_FailurePolicy_86d22f4b := 'Skip';
  p_TimeoutMS_86d22f4b := 5000;
  p_IsEnabled_86d22f4b := TRUE;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '__mj_bizappscommon' AND p.proname = 'spCreateActivitySyncExtension'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM __mj_bizappscommon."spCreateActivitySyncExtension"(p_data := jsonb_build_object(
    'ID', p_ID_86d22f4b,
    'Name', p_Name_86d22f4b,
    'Description', p_Description_86d22f4b,
    'DriverClass', p_DriverClass_86d22f4b,
    'ActivitySyncConnectionID', p_ActivitySyncConnectionID_86d22f4b,
    'ActivitySyncProviderTypeID', p_ActivitySyncProviderTypeID_86d22f4b,
    'Sequence', p_Sequence_86d22f4b,
    'FailurePolicy', p_FailurePolicy_86d22f4b,
    'TimeoutMS', p_TimeoutMS_86d22f4b,
    'IsEnabled', p_IsEnabled_86d22f4b,
    'LastRunAt', p_LastRunAt_86d22f4b,
    'LastError', p_LastError_86d22f4b
  ));
  ELSE
    PERFORM __mj_bizappscommon."spCreateActivitySyncExtension"(p_ID := p_ID_86d22f4b, p_Name := p_Name_86d22f4b, p_Description := p_Description_86d22f4b, p_DriverClass := p_DriverClass_86d22f4b, p_ActivitySyncConnectionID := p_ActivitySyncConnectionID_86d22f4b, p_ActivitySyncConnectionID_Clear := TRUE, p_ActivitySyncProviderTypeID := p_ActivitySyncProviderTypeID_86d22f4b, p_ActivitySyncProviderTypeID_Clear := TRUE, p_Sequence := p_Sequence_86d22f4b, p_FailurePolicy := p_FailurePolicy_86d22f4b, p_TimeoutMS := p_TimeoutMS_86d22f4b, p_IsEnabled := p_IsEnabled_86d22f4b, p_LastRunAt := p_LastRunAt_86d22f4b, p_LastRunAt_Clear := TRUE, p_LastError := p_LastError_86d22f4b, p_LastError_Clear := TRUE);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_d1702abc VARCHAR(255);
  p_Description_d1702abc TEXT;
  p_AutoUpdateDescription_d1702abc BOOLEAN;
  p_IsPrimaryKey_d1702abc BOOLEAN;
  p_IsUnique_d1702abc BOOLEAN;
  p_Category_d1702abc VARCHAR(255);
  p_ValueListType_d1702abc VARCHAR(20);
  p_ExtendedType_d1702abc VARCHAR(50);
  p_CodeType_d1702abc VARCHAR(50);
  p_DefaultInView_d1702abc BOOLEAN;
  p_ViewCellTemplate_d1702abc TEXT;
  p_DefaultColumnWidth_d1702abc INTEGER;
  p_AllowUpdateAPI_d1702abc BOOLEAN;
  p_AllowUpdateInView_d1702abc BOOLEAN;
  p_IncludeInUserSearchAPI_d1702abc BOOLEAN;
  p_FullTextSearchEnabled_d1702abc BOOLEAN;
  p_UserSearchParamFormatAPI_d1702abc VARCHAR(500);
  p_IncludeInGeneratedForm_d1702abc BOOLEAN;
  p_GeneratedFormSection_d1702abc VARCHAR(10);
  p_IsNameField_d1702abc BOOLEAN;
  p_RelatedEntityID_d1702abc UUID;
  p_RelatedEntityFieldName_d1702abc VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_d1702abc BOOLEAN;
  p_RelatedEntityNameFieldMap_d1702abc VARCHAR(255);
  p_RelatedEntityDisplayType_d1702abc VARCHAR(20);
  p_EntityIDFieldName_d1702abc VARCHAR(100);
  p_ScopeDefault_d1702abc VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_d1702abc BOOLEAN;
  p_ValuesToPackWithSchema_d1702abc VARCHAR(10);
  p_Status_d1702abc VARCHAR(25);
  p_AutoUpdateIsNameField_d1702abc BOOLEAN;
  p_AutoUpdateDefaultInView_d1702abc BOOLEAN;
  p_AutoUpdateCategory_d1702abc BOOLEAN;
  p_AutoUpdateDisplayName_d1702abc BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_d1702abc BOOLEAN;
  p_Encrypt_d1702abc BOOLEAN;
  p_EncryptionKeyID_d1702abc UUID;
  p_AllowDecryptInAPI_d1702abc BOOLEAN;
  p_SendEncryptedValue_d1702abc BOOLEAN;
  p_IsSoftPrimaryKey_d1702abc BOOLEAN;
  p_IsSoftForeignKey_d1702abc BOOLEAN;
  p_RelatedEntityJoinFields_d1702abc TEXT;
  p_JSONType_d1702abc VARCHAR(255);
  p_JSONTypeIsArray_d1702abc BOOLEAN;
  p_JSONTypeDefinition_d1702abc TEXT;
  p_UserSearchPredicateAPI_d1702abc VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_d1702abc BOOLEAN;
  p_AutoUpdateFullTextSearch_d1702abc BOOLEAN;
  p_AutoUpdateExtendedType_d1702abc BOOLEAN;
  p_IsComputed_d1702abc BOOLEAN;
  p_EmbeddedRecord_d1702abc TEXT;
  p_Configuration_d1702abc TEXT;
  p_ID_d1702abc UUID;
BEGIN
  p_DisplayName_d1702abc := 'Deal Number';
  p_AutoUpdateDescription_d1702abc := TRUE;
  p_IsPrimaryKey_d1702abc := FALSE;
  p_IsUnique_d1702abc := TRUE;
  p_ValueListType_d1702abc := 'None';
  p_DefaultInView_d1702abc := TRUE;
  p_DefaultColumnWidth_d1702abc := 150;
  p_AllowUpdateAPI_d1702abc := TRUE;
  p_AllowUpdateInView_d1702abc := TRUE;
  p_IncludeInUserSearchAPI_d1702abc := FALSE;
  p_FullTextSearchEnabled_d1702abc := FALSE;
  p_IncludeInGeneratedForm_d1702abc := TRUE;
  p_GeneratedFormSection_d1702abc := 'Details';
  p_IsNameField_d1702abc := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_d1702abc := FALSE;
  p_RelatedEntityDisplayType_d1702abc := 'Search';
  p_AutoUpdateRelatedEntityInfo_d1702abc := TRUE;
  p_ValuesToPackWithSchema_d1702abc := 'Auto';
  p_Status_d1702abc := 'Active';
  p_AutoUpdateIsNameField_d1702abc := TRUE;
  p_AutoUpdateDefaultInView_d1702abc := TRUE;
  p_AutoUpdateCategory_d1702abc := TRUE;
  p_AutoUpdateDisplayName_d1702abc := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_d1702abc := TRUE;
  p_Encrypt_d1702abc := FALSE;
  p_AllowDecryptInAPI_d1702abc := FALSE;
  p_SendEncryptedValue_d1702abc := FALSE;
  p_IsSoftPrimaryKey_d1702abc := FALSE;
  p_IsSoftForeignKey_d1702abc := FALSE;
  p_JSONTypeIsArray_d1702abc := FALSE;
  p_UserSearchPredicateAPI_d1702abc := 'Contains';
  p_AutoUpdateUserSearchPredicate_d1702abc := TRUE;
  p_AutoUpdateFullTextSearch_d1702abc := TRUE;
  p_AutoUpdateExtendedType_d1702abc := TRUE;
  p_IsComputed_d1702abc := FALSE;
  p_ID_d1702abc := '939FFD49-39DA-4200-BE2E-906F14FE50E1';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_d1702abc,
    'Description', p_Description_d1702abc,
    'AutoUpdateDescription', p_AutoUpdateDescription_d1702abc,
    'IsPrimaryKey', p_IsPrimaryKey_d1702abc,
    'IsUnique', p_IsUnique_d1702abc,
    'Category', p_Category_d1702abc,
    'ValueListType', p_ValueListType_d1702abc,
    'ExtendedType', p_ExtendedType_d1702abc,
    'CodeType', p_CodeType_d1702abc,
    'DefaultInView', p_DefaultInView_d1702abc,
    'ViewCellTemplate', p_ViewCellTemplate_d1702abc,
    'DefaultColumnWidth', p_DefaultColumnWidth_d1702abc,
    'AllowUpdateAPI', p_AllowUpdateAPI_d1702abc,
    'AllowUpdateInView', p_AllowUpdateInView_d1702abc,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_d1702abc,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_d1702abc,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_d1702abc,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_d1702abc,
    'GeneratedFormSection', p_GeneratedFormSection_d1702abc,
    'IsNameField', p_IsNameField_d1702abc,
    'RelatedEntityID', p_RelatedEntityID_d1702abc,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_d1702abc,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_d1702abc,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_d1702abc,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_d1702abc,
    'EntityIDFieldName', p_EntityIDFieldName_d1702abc,
    'ScopeDefault', p_ScopeDefault_d1702abc,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_d1702abc,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_d1702abc,
    'Status', p_Status_d1702abc,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_d1702abc,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_d1702abc,
    'AutoUpdateCategory', p_AutoUpdateCategory_d1702abc,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_d1702abc,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_d1702abc,
    'Encrypt', p_Encrypt_d1702abc,
    'EncryptionKeyID', p_EncryptionKeyID_d1702abc,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_d1702abc,
    'SendEncryptedValue', p_SendEncryptedValue_d1702abc,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_d1702abc,
    'IsSoftForeignKey', p_IsSoftForeignKey_d1702abc,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_d1702abc,
    'JSONType', p_JSONType_d1702abc,
    'JSONTypeIsArray', p_JSONTypeIsArray_d1702abc,
    'JSONTypeDefinition', p_JSONTypeDefinition_d1702abc,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_d1702abc,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_d1702abc,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_d1702abc,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_d1702abc,
    'IsComputed', p_IsComputed_d1702abc
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_d1702abc,
    'Configuration', p_Configuration_d1702abc,
    'ID', p_ID_d1702abc
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_d1702abc, p_Description := p_Description_d1702abc, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_d1702abc, p_IsPrimaryKey := p_IsPrimaryKey_d1702abc, p_IsUnique := p_IsUnique_d1702abc, p_Category := p_Category_d1702abc, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_d1702abc, p_ExtendedType := p_ExtendedType_d1702abc, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_d1702abc, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_d1702abc, p_ViewCellTemplate := p_ViewCellTemplate_d1702abc, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_d1702abc, p_AllowUpdateAPI := p_AllowUpdateAPI_d1702abc, p_AllowUpdateInView := p_AllowUpdateInView_d1702abc, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_d1702abc, p_FullTextSearchEnabled := p_FullTextSearchEnabled_d1702abc, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_d1702abc, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_d1702abc, p_GeneratedFormSection := p_GeneratedFormSection_d1702abc, p_IsNameField := p_IsNameField_d1702abc, p_RelatedEntityID := p_RelatedEntityID_d1702abc, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_d1702abc, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_d1702abc, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_d1702abc, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_d1702abc, p_EntityIDFieldName := p_EntityIDFieldName_d1702abc, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_d1702abc, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_d1702abc, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_d1702abc, p_Status := p_Status_d1702abc, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_d1702abc, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_d1702abc, p_AutoUpdateCategory := p_AutoUpdateCategory_d1702abc, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_d1702abc, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_d1702abc, p_Encrypt := p_Encrypt_d1702abc, p_EncryptionKeyID := p_EncryptionKeyID_d1702abc, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_d1702abc, p_SendEncryptedValue := p_SendEncryptedValue_d1702abc, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_d1702abc, p_IsSoftForeignKey := p_IsSoftForeignKey_d1702abc, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_d1702abc, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_d1702abc, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_d1702abc, p_JSONTypeDefinition := p_JSONTypeDefinition_d1702abc, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_d1702abc, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_d1702abc, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_d1702abc, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_d1702abc, p_IsComputed := p_IsComputed_d1702abc, p_EmbeddedRecord := p_EmbeddedRecord_d1702abc, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_d1702abc, p_Configuration_Clear := TRUE, p_ID := p_ID_d1702abc);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_06df379f VARCHAR(255);
  p_Description_06df379f TEXT;
  p_AutoUpdateDescription_06df379f BOOLEAN;
  p_IsPrimaryKey_06df379f BOOLEAN;
  p_IsUnique_06df379f BOOLEAN;
  p_Category_06df379f VARCHAR(255);
  p_ValueListType_06df379f VARCHAR(20);
  p_ExtendedType_06df379f VARCHAR(50);
  p_CodeType_06df379f VARCHAR(50);
  p_DefaultInView_06df379f BOOLEAN;
  p_ViewCellTemplate_06df379f TEXT;
  p_DefaultColumnWidth_06df379f INTEGER;
  p_AllowUpdateAPI_06df379f BOOLEAN;
  p_AllowUpdateInView_06df379f BOOLEAN;
  p_IncludeInUserSearchAPI_06df379f BOOLEAN;
  p_FullTextSearchEnabled_06df379f BOOLEAN;
  p_UserSearchParamFormatAPI_06df379f VARCHAR(500);
  p_IncludeInGeneratedForm_06df379f BOOLEAN;
  p_GeneratedFormSection_06df379f VARCHAR(10);
  p_IsNameField_06df379f BOOLEAN;
  p_RelatedEntityID_06df379f UUID;
  p_RelatedEntityFieldName_06df379f VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_06df379f BOOLEAN;
  p_RelatedEntityNameFieldMap_06df379f VARCHAR(255);
  p_RelatedEntityDisplayType_06df379f VARCHAR(20);
  p_EntityIDFieldName_06df379f VARCHAR(100);
  p_ScopeDefault_06df379f VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_06df379f BOOLEAN;
  p_ValuesToPackWithSchema_06df379f VARCHAR(10);
  p_Status_06df379f VARCHAR(25);
  p_AutoUpdateIsNameField_06df379f BOOLEAN;
  p_AutoUpdateDefaultInView_06df379f BOOLEAN;
  p_AutoUpdateCategory_06df379f BOOLEAN;
  p_AutoUpdateDisplayName_06df379f BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_06df379f BOOLEAN;
  p_Encrypt_06df379f BOOLEAN;
  p_EncryptionKeyID_06df379f UUID;
  p_AllowDecryptInAPI_06df379f BOOLEAN;
  p_SendEncryptedValue_06df379f BOOLEAN;
  p_IsSoftPrimaryKey_06df379f BOOLEAN;
  p_IsSoftForeignKey_06df379f BOOLEAN;
  p_RelatedEntityJoinFields_06df379f TEXT;
  p_JSONType_06df379f VARCHAR(255);
  p_JSONTypeIsArray_06df379f BOOLEAN;
  p_JSONTypeDefinition_06df379f TEXT;
  p_UserSearchPredicateAPI_06df379f VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_06df379f BOOLEAN;
  p_AutoUpdateFullTextSearch_06df379f BOOLEAN;
  p_AutoUpdateExtendedType_06df379f BOOLEAN;
  p_IsComputed_06df379f BOOLEAN;
  p_EmbeddedRecord_06df379f TEXT;
  p_Configuration_06df379f TEXT;
  p_ID_06df379f UUID;
BEGIN
  p_DisplayName_06df379f := 'Pipeline';
  p_AutoUpdateDescription_06df379f := TRUE;
  p_IsPrimaryKey_06df379f := FALSE;
  p_IsUnique_06df379f := FALSE;
  p_ValueListType_06df379f := 'None';
  p_DefaultInView_06df379f := TRUE;
  p_DefaultColumnWidth_06df379f := 150;
  p_AllowUpdateAPI_06df379f := FALSE;
  p_AllowUpdateInView_06df379f := TRUE;
  p_IncludeInUserSearchAPI_06df379f := FALSE;
  p_FullTextSearchEnabled_06df379f := FALSE;
  p_IncludeInGeneratedForm_06df379f := TRUE;
  p_GeneratedFormSection_06df379f := 'Details';
  p_IsNameField_06df379f := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_06df379f := FALSE;
  p_RelatedEntityDisplayType_06df379f := 'Search';
  p_AutoUpdateRelatedEntityInfo_06df379f := TRUE;
  p_ValuesToPackWithSchema_06df379f := 'Auto';
  p_Status_06df379f := 'Active';
  p_AutoUpdateIsNameField_06df379f := TRUE;
  p_AutoUpdateDefaultInView_06df379f := TRUE;
  p_AutoUpdateCategory_06df379f := TRUE;
  p_AutoUpdateDisplayName_06df379f := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_06df379f := TRUE;
  p_Encrypt_06df379f := FALSE;
  p_AllowDecryptInAPI_06df379f := FALSE;
  p_SendEncryptedValue_06df379f := FALSE;
  p_IsSoftPrimaryKey_06df379f := FALSE;
  p_IsSoftForeignKey_06df379f := FALSE;
  p_JSONTypeIsArray_06df379f := FALSE;
  p_UserSearchPredicateAPI_06df379f := 'Contains';
  p_AutoUpdateUserSearchPredicate_06df379f := TRUE;
  p_AutoUpdateFullTextSearch_06df379f := TRUE;
  p_AutoUpdateExtendedType_06df379f := TRUE;
  p_IsComputed_06df379f := FALSE;
  p_ID_06df379f := '2AA2DC76-847E-452C-B01C-8CC4082921B2';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_06df379f,
    'Description', p_Description_06df379f,
    'AutoUpdateDescription', p_AutoUpdateDescription_06df379f,
    'IsPrimaryKey', p_IsPrimaryKey_06df379f,
    'IsUnique', p_IsUnique_06df379f,
    'Category', p_Category_06df379f,
    'ValueListType', p_ValueListType_06df379f,
    'ExtendedType', p_ExtendedType_06df379f,
    'CodeType', p_CodeType_06df379f,
    'DefaultInView', p_DefaultInView_06df379f,
    'ViewCellTemplate', p_ViewCellTemplate_06df379f,
    'DefaultColumnWidth', p_DefaultColumnWidth_06df379f,
    'AllowUpdateAPI', p_AllowUpdateAPI_06df379f,
    'AllowUpdateInView', p_AllowUpdateInView_06df379f,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_06df379f,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_06df379f,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_06df379f,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_06df379f,
    'GeneratedFormSection', p_GeneratedFormSection_06df379f,
    'IsNameField', p_IsNameField_06df379f,
    'RelatedEntityID', p_RelatedEntityID_06df379f,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_06df379f,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_06df379f,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_06df379f,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_06df379f,
    'EntityIDFieldName', p_EntityIDFieldName_06df379f,
    'ScopeDefault', p_ScopeDefault_06df379f,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_06df379f,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_06df379f,
    'Status', p_Status_06df379f,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_06df379f,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_06df379f,
    'AutoUpdateCategory', p_AutoUpdateCategory_06df379f,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_06df379f,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_06df379f,
    'Encrypt', p_Encrypt_06df379f,
    'EncryptionKeyID', p_EncryptionKeyID_06df379f,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_06df379f,
    'SendEncryptedValue', p_SendEncryptedValue_06df379f,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_06df379f,
    'IsSoftForeignKey', p_IsSoftForeignKey_06df379f,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_06df379f,
    'JSONType', p_JSONType_06df379f,
    'JSONTypeIsArray', p_JSONTypeIsArray_06df379f,
    'JSONTypeDefinition', p_JSONTypeDefinition_06df379f,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_06df379f,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_06df379f,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_06df379f,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_06df379f,
    'IsComputed', p_IsComputed_06df379f
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_06df379f,
    'Configuration', p_Configuration_06df379f,
    'ID', p_ID_06df379f
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_06df379f, p_Description := p_Description_06df379f, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_06df379f, p_IsPrimaryKey := p_IsPrimaryKey_06df379f, p_IsUnique := p_IsUnique_06df379f, p_Category := p_Category_06df379f, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_06df379f, p_ExtendedType := p_ExtendedType_06df379f, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_06df379f, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_06df379f, p_ViewCellTemplate := p_ViewCellTemplate_06df379f, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_06df379f, p_AllowUpdateAPI := p_AllowUpdateAPI_06df379f, p_AllowUpdateInView := p_AllowUpdateInView_06df379f, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_06df379f, p_FullTextSearchEnabled := p_FullTextSearchEnabled_06df379f, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_06df379f, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_06df379f, p_GeneratedFormSection := p_GeneratedFormSection_06df379f, p_IsNameField := p_IsNameField_06df379f, p_RelatedEntityID := p_RelatedEntityID_06df379f, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_06df379f, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_06df379f, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_06df379f, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_06df379f, p_EntityIDFieldName := p_EntityIDFieldName_06df379f, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_06df379f, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_06df379f, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_06df379f, p_Status := p_Status_06df379f, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_06df379f, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_06df379f, p_AutoUpdateCategory := p_AutoUpdateCategory_06df379f, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_06df379f, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_06df379f, p_Encrypt := p_Encrypt_06df379f, p_EncryptionKeyID := p_EncryptionKeyID_06df379f, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_06df379f, p_SendEncryptedValue := p_SendEncryptedValue_06df379f, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_06df379f, p_IsSoftForeignKey := p_IsSoftForeignKey_06df379f, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_06df379f, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_06df379f, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_06df379f, p_JSONTypeDefinition := p_JSONTypeDefinition_06df379f, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_06df379f, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_06df379f, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_06df379f, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_06df379f, p_IsComputed := p_IsComputed_06df379f, p_EmbeddedRecord := p_EmbeddedRecord_06df379f, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_06df379f, p_Configuration_Clear := TRUE, p_ID := p_ID_06df379f);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_e24b00ce VARCHAR(255);
  p_Description_e24b00ce TEXT;
  p_AutoUpdateDescription_e24b00ce BOOLEAN;
  p_IsPrimaryKey_e24b00ce BOOLEAN;
  p_IsUnique_e24b00ce BOOLEAN;
  p_Category_e24b00ce VARCHAR(255);
  p_ValueListType_e24b00ce VARCHAR(20);
  p_ExtendedType_e24b00ce VARCHAR(50);
  p_CodeType_e24b00ce VARCHAR(50);
  p_DefaultInView_e24b00ce BOOLEAN;
  p_ViewCellTemplate_e24b00ce TEXT;
  p_DefaultColumnWidth_e24b00ce INTEGER;
  p_AllowUpdateAPI_e24b00ce BOOLEAN;
  p_AllowUpdateInView_e24b00ce BOOLEAN;
  p_IncludeInUserSearchAPI_e24b00ce BOOLEAN;
  p_FullTextSearchEnabled_e24b00ce BOOLEAN;
  p_UserSearchParamFormatAPI_e24b00ce VARCHAR(500);
  p_IncludeInGeneratedForm_e24b00ce BOOLEAN;
  p_GeneratedFormSection_e24b00ce VARCHAR(10);
  p_IsNameField_e24b00ce BOOLEAN;
  p_RelatedEntityID_e24b00ce UUID;
  p_RelatedEntityFieldName_e24b00ce VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_e24b00ce BOOLEAN;
  p_RelatedEntityNameFieldMap_e24b00ce VARCHAR(255);
  p_RelatedEntityDisplayType_e24b00ce VARCHAR(20);
  p_EntityIDFieldName_e24b00ce VARCHAR(100);
  p_ScopeDefault_e24b00ce VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_e24b00ce BOOLEAN;
  p_ValuesToPackWithSchema_e24b00ce VARCHAR(10);
  p_Status_e24b00ce VARCHAR(25);
  p_AutoUpdateIsNameField_e24b00ce BOOLEAN;
  p_AutoUpdateDefaultInView_e24b00ce BOOLEAN;
  p_AutoUpdateCategory_e24b00ce BOOLEAN;
  p_AutoUpdateDisplayName_e24b00ce BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_e24b00ce BOOLEAN;
  p_Encrypt_e24b00ce BOOLEAN;
  p_EncryptionKeyID_e24b00ce UUID;
  p_AllowDecryptInAPI_e24b00ce BOOLEAN;
  p_SendEncryptedValue_e24b00ce BOOLEAN;
  p_IsSoftPrimaryKey_e24b00ce BOOLEAN;
  p_IsSoftForeignKey_e24b00ce BOOLEAN;
  p_RelatedEntityJoinFields_e24b00ce TEXT;
  p_JSONType_e24b00ce VARCHAR(255);
  p_JSONTypeIsArray_e24b00ce BOOLEAN;
  p_JSONTypeDefinition_e24b00ce TEXT;
  p_UserSearchPredicateAPI_e24b00ce VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_e24b00ce BOOLEAN;
  p_AutoUpdateFullTextSearch_e24b00ce BOOLEAN;
  p_AutoUpdateExtendedType_e24b00ce BOOLEAN;
  p_IsComputed_e24b00ce BOOLEAN;
  p_EmbeddedRecord_e24b00ce TEXT;
  p_Configuration_e24b00ce TEXT;
  p_ID_e24b00ce UUID;
BEGIN
  p_DisplayName_e24b00ce := 'Account';
  p_AutoUpdateDescription_e24b00ce := TRUE;
  p_IsPrimaryKey_e24b00ce := FALSE;
  p_IsUnique_e24b00ce := FALSE;
  p_ValueListType_e24b00ce := 'None';
  p_DefaultInView_e24b00ce := TRUE;
  p_DefaultColumnWidth_e24b00ce := 150;
  p_AllowUpdateAPI_e24b00ce := FALSE;
  p_AllowUpdateInView_e24b00ce := TRUE;
  p_IncludeInUserSearchAPI_e24b00ce := FALSE;
  p_FullTextSearchEnabled_e24b00ce := FALSE;
  p_IncludeInGeneratedForm_e24b00ce := TRUE;
  p_GeneratedFormSection_e24b00ce := 'Details';
  p_IsNameField_e24b00ce := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_e24b00ce := FALSE;
  p_RelatedEntityDisplayType_e24b00ce := 'Search';
  p_AutoUpdateRelatedEntityInfo_e24b00ce := TRUE;
  p_ValuesToPackWithSchema_e24b00ce := 'Auto';
  p_Status_e24b00ce := 'Active';
  p_AutoUpdateIsNameField_e24b00ce := TRUE;
  p_AutoUpdateDefaultInView_e24b00ce := TRUE;
  p_AutoUpdateCategory_e24b00ce := TRUE;
  p_AutoUpdateDisplayName_e24b00ce := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_e24b00ce := TRUE;
  p_Encrypt_e24b00ce := FALSE;
  p_AllowDecryptInAPI_e24b00ce := FALSE;
  p_SendEncryptedValue_e24b00ce := FALSE;
  p_IsSoftPrimaryKey_e24b00ce := FALSE;
  p_IsSoftForeignKey_e24b00ce := FALSE;
  p_JSONTypeIsArray_e24b00ce := FALSE;
  p_UserSearchPredicateAPI_e24b00ce := 'Contains';
  p_AutoUpdateUserSearchPredicate_e24b00ce := TRUE;
  p_AutoUpdateFullTextSearch_e24b00ce := TRUE;
  p_AutoUpdateExtendedType_e24b00ce := TRUE;
  p_IsComputed_e24b00ce := FALSE;
  p_ID_e24b00ce := '94114B63-4A39-4A2C-B774-16651DCC7944';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_e24b00ce,
    'Description', p_Description_e24b00ce,
    'AutoUpdateDescription', p_AutoUpdateDescription_e24b00ce,
    'IsPrimaryKey', p_IsPrimaryKey_e24b00ce,
    'IsUnique', p_IsUnique_e24b00ce,
    'Category', p_Category_e24b00ce,
    'ValueListType', p_ValueListType_e24b00ce,
    'ExtendedType', p_ExtendedType_e24b00ce,
    'CodeType', p_CodeType_e24b00ce,
    'DefaultInView', p_DefaultInView_e24b00ce,
    'ViewCellTemplate', p_ViewCellTemplate_e24b00ce,
    'DefaultColumnWidth', p_DefaultColumnWidth_e24b00ce,
    'AllowUpdateAPI', p_AllowUpdateAPI_e24b00ce,
    'AllowUpdateInView', p_AllowUpdateInView_e24b00ce,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_e24b00ce,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_e24b00ce,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_e24b00ce,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_e24b00ce,
    'GeneratedFormSection', p_GeneratedFormSection_e24b00ce,
    'IsNameField', p_IsNameField_e24b00ce,
    'RelatedEntityID', p_RelatedEntityID_e24b00ce,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_e24b00ce,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_e24b00ce,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_e24b00ce,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_e24b00ce,
    'EntityIDFieldName', p_EntityIDFieldName_e24b00ce,
    'ScopeDefault', p_ScopeDefault_e24b00ce,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_e24b00ce,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_e24b00ce,
    'Status', p_Status_e24b00ce,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_e24b00ce,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_e24b00ce,
    'AutoUpdateCategory', p_AutoUpdateCategory_e24b00ce,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_e24b00ce,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_e24b00ce,
    'Encrypt', p_Encrypt_e24b00ce,
    'EncryptionKeyID', p_EncryptionKeyID_e24b00ce,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_e24b00ce,
    'SendEncryptedValue', p_SendEncryptedValue_e24b00ce,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_e24b00ce,
    'IsSoftForeignKey', p_IsSoftForeignKey_e24b00ce,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_e24b00ce,
    'JSONType', p_JSONType_e24b00ce,
    'JSONTypeIsArray', p_JSONTypeIsArray_e24b00ce,
    'JSONTypeDefinition', p_JSONTypeDefinition_e24b00ce,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_e24b00ce,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_e24b00ce,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_e24b00ce,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_e24b00ce,
    'IsComputed', p_IsComputed_e24b00ce
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_e24b00ce,
    'Configuration', p_Configuration_e24b00ce,
    'ID', p_ID_e24b00ce
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_e24b00ce, p_Description := p_Description_e24b00ce, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_e24b00ce, p_IsPrimaryKey := p_IsPrimaryKey_e24b00ce, p_IsUnique := p_IsUnique_e24b00ce, p_Category := p_Category_e24b00ce, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_e24b00ce, p_ExtendedType := p_ExtendedType_e24b00ce, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_e24b00ce, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_e24b00ce, p_ViewCellTemplate := p_ViewCellTemplate_e24b00ce, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_e24b00ce, p_AllowUpdateAPI := p_AllowUpdateAPI_e24b00ce, p_AllowUpdateInView := p_AllowUpdateInView_e24b00ce, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_e24b00ce, p_FullTextSearchEnabled := p_FullTextSearchEnabled_e24b00ce, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_e24b00ce, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_e24b00ce, p_GeneratedFormSection := p_GeneratedFormSection_e24b00ce, p_IsNameField := p_IsNameField_e24b00ce, p_RelatedEntityID := p_RelatedEntityID_e24b00ce, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_e24b00ce, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_e24b00ce, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_e24b00ce, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_e24b00ce, p_EntityIDFieldName := p_EntityIDFieldName_e24b00ce, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_e24b00ce, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_e24b00ce, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_e24b00ce, p_Status := p_Status_e24b00ce, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_e24b00ce, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_e24b00ce, p_AutoUpdateCategory := p_AutoUpdateCategory_e24b00ce, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_e24b00ce, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_e24b00ce, p_Encrypt := p_Encrypt_e24b00ce, p_EncryptionKeyID := p_EncryptionKeyID_e24b00ce, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_e24b00ce, p_SendEncryptedValue := p_SendEncryptedValue_e24b00ce, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_e24b00ce, p_IsSoftForeignKey := p_IsSoftForeignKey_e24b00ce, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_e24b00ce, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_e24b00ce, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_e24b00ce, p_JSONTypeDefinition := p_JSONTypeDefinition_e24b00ce, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_e24b00ce, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_e24b00ce, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_e24b00ce, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_e24b00ce, p_IsComputed := p_IsComputed_e24b00ce, p_EmbeddedRecord := p_EmbeddedRecord_e24b00ce, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_e24b00ce, p_Configuration_Clear := TRUE, p_ID := p_ID_e24b00ce);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_95cc17cd VARCHAR(255);
  p_Description_95cc17cd TEXT;
  p_AutoUpdateDescription_95cc17cd BOOLEAN;
  p_IsPrimaryKey_95cc17cd BOOLEAN;
  p_IsUnique_95cc17cd BOOLEAN;
  p_Category_95cc17cd VARCHAR(255);
  p_ValueListType_95cc17cd VARCHAR(20);
  p_ExtendedType_95cc17cd VARCHAR(50);
  p_CodeType_95cc17cd VARCHAR(50);
  p_DefaultInView_95cc17cd BOOLEAN;
  p_ViewCellTemplate_95cc17cd TEXT;
  p_DefaultColumnWidth_95cc17cd INTEGER;
  p_AllowUpdateAPI_95cc17cd BOOLEAN;
  p_AllowUpdateInView_95cc17cd BOOLEAN;
  p_IncludeInUserSearchAPI_95cc17cd BOOLEAN;
  p_FullTextSearchEnabled_95cc17cd BOOLEAN;
  p_UserSearchParamFormatAPI_95cc17cd VARCHAR(500);
  p_IncludeInGeneratedForm_95cc17cd BOOLEAN;
  p_GeneratedFormSection_95cc17cd VARCHAR(10);
  p_IsNameField_95cc17cd BOOLEAN;
  p_RelatedEntityID_95cc17cd UUID;
  p_RelatedEntityFieldName_95cc17cd VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_95cc17cd BOOLEAN;
  p_RelatedEntityNameFieldMap_95cc17cd VARCHAR(255);
  p_RelatedEntityDisplayType_95cc17cd VARCHAR(20);
  p_EntityIDFieldName_95cc17cd VARCHAR(100);
  p_ScopeDefault_95cc17cd VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_95cc17cd BOOLEAN;
  p_ValuesToPackWithSchema_95cc17cd VARCHAR(10);
  p_Status_95cc17cd VARCHAR(25);
  p_AutoUpdateIsNameField_95cc17cd BOOLEAN;
  p_AutoUpdateDefaultInView_95cc17cd BOOLEAN;
  p_AutoUpdateCategory_95cc17cd BOOLEAN;
  p_AutoUpdateDisplayName_95cc17cd BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_95cc17cd BOOLEAN;
  p_Encrypt_95cc17cd BOOLEAN;
  p_EncryptionKeyID_95cc17cd UUID;
  p_AllowDecryptInAPI_95cc17cd BOOLEAN;
  p_SendEncryptedValue_95cc17cd BOOLEAN;
  p_IsSoftPrimaryKey_95cc17cd BOOLEAN;
  p_IsSoftForeignKey_95cc17cd BOOLEAN;
  p_RelatedEntityJoinFields_95cc17cd TEXT;
  p_JSONType_95cc17cd VARCHAR(255);
  p_JSONTypeIsArray_95cc17cd BOOLEAN;
  p_JSONTypeDefinition_95cc17cd TEXT;
  p_UserSearchPredicateAPI_95cc17cd VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_95cc17cd BOOLEAN;
  p_AutoUpdateFullTextSearch_95cc17cd BOOLEAN;
  p_AutoUpdateExtendedType_95cc17cd BOOLEAN;
  p_IsComputed_95cc17cd BOOLEAN;
  p_EmbeddedRecord_95cc17cd TEXT;
  p_Configuration_95cc17cd TEXT;
  p_ID_95cc17cd UUID;
BEGIN
  p_DisplayName_95cc17cd := 'Pipeline Stage';
  p_AutoUpdateDescription_95cc17cd := TRUE;
  p_IsPrimaryKey_95cc17cd := FALSE;
  p_IsUnique_95cc17cd := FALSE;
  p_ValueListType_95cc17cd := 'None';
  p_DefaultInView_95cc17cd := TRUE;
  p_DefaultColumnWidth_95cc17cd := 150;
  p_AllowUpdateAPI_95cc17cd := FALSE;
  p_AllowUpdateInView_95cc17cd := TRUE;
  p_IncludeInUserSearchAPI_95cc17cd := FALSE;
  p_FullTextSearchEnabled_95cc17cd := FALSE;
  p_IncludeInGeneratedForm_95cc17cd := TRUE;
  p_GeneratedFormSection_95cc17cd := 'Details';
  p_IsNameField_95cc17cd := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_95cc17cd := FALSE;
  p_RelatedEntityDisplayType_95cc17cd := 'Search';
  p_AutoUpdateRelatedEntityInfo_95cc17cd := TRUE;
  p_ValuesToPackWithSchema_95cc17cd := 'Auto';
  p_Status_95cc17cd := 'Active';
  p_AutoUpdateIsNameField_95cc17cd := TRUE;
  p_AutoUpdateDefaultInView_95cc17cd := TRUE;
  p_AutoUpdateCategory_95cc17cd := TRUE;
  p_AutoUpdateDisplayName_95cc17cd := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_95cc17cd := TRUE;
  p_Encrypt_95cc17cd := FALSE;
  p_AllowDecryptInAPI_95cc17cd := FALSE;
  p_SendEncryptedValue_95cc17cd := FALSE;
  p_IsSoftPrimaryKey_95cc17cd := FALSE;
  p_IsSoftForeignKey_95cc17cd := FALSE;
  p_JSONTypeIsArray_95cc17cd := FALSE;
  p_UserSearchPredicateAPI_95cc17cd := 'Contains';
  p_AutoUpdateUserSearchPredicate_95cc17cd := TRUE;
  p_AutoUpdateFullTextSearch_95cc17cd := TRUE;
  p_AutoUpdateExtendedType_95cc17cd := TRUE;
  p_IsComputed_95cc17cd := FALSE;
  p_ID_95cc17cd := 'E343398A-30E1-454C-AD9B-9B24D43ACCA3';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_95cc17cd,
    'Description', p_Description_95cc17cd,
    'AutoUpdateDescription', p_AutoUpdateDescription_95cc17cd,
    'IsPrimaryKey', p_IsPrimaryKey_95cc17cd,
    'IsUnique', p_IsUnique_95cc17cd,
    'Category', p_Category_95cc17cd,
    'ValueListType', p_ValueListType_95cc17cd,
    'ExtendedType', p_ExtendedType_95cc17cd,
    'CodeType', p_CodeType_95cc17cd,
    'DefaultInView', p_DefaultInView_95cc17cd,
    'ViewCellTemplate', p_ViewCellTemplate_95cc17cd,
    'DefaultColumnWidth', p_DefaultColumnWidth_95cc17cd,
    'AllowUpdateAPI', p_AllowUpdateAPI_95cc17cd,
    'AllowUpdateInView', p_AllowUpdateInView_95cc17cd,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_95cc17cd,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_95cc17cd,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_95cc17cd,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_95cc17cd,
    'GeneratedFormSection', p_GeneratedFormSection_95cc17cd,
    'IsNameField', p_IsNameField_95cc17cd,
    'RelatedEntityID', p_RelatedEntityID_95cc17cd,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_95cc17cd,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_95cc17cd,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_95cc17cd,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_95cc17cd,
    'EntityIDFieldName', p_EntityIDFieldName_95cc17cd,
    'ScopeDefault', p_ScopeDefault_95cc17cd,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_95cc17cd,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_95cc17cd,
    'Status', p_Status_95cc17cd,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_95cc17cd,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_95cc17cd,
    'AutoUpdateCategory', p_AutoUpdateCategory_95cc17cd,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_95cc17cd,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_95cc17cd,
    'Encrypt', p_Encrypt_95cc17cd,
    'EncryptionKeyID', p_EncryptionKeyID_95cc17cd,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_95cc17cd,
    'SendEncryptedValue', p_SendEncryptedValue_95cc17cd,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_95cc17cd,
    'IsSoftForeignKey', p_IsSoftForeignKey_95cc17cd,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_95cc17cd,
    'JSONType', p_JSONType_95cc17cd,
    'JSONTypeIsArray', p_JSONTypeIsArray_95cc17cd,
    'JSONTypeDefinition', p_JSONTypeDefinition_95cc17cd,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_95cc17cd,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_95cc17cd,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_95cc17cd,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_95cc17cd,
    'IsComputed', p_IsComputed_95cc17cd
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_95cc17cd,
    'Configuration', p_Configuration_95cc17cd,
    'ID', p_ID_95cc17cd
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_95cc17cd, p_Description := p_Description_95cc17cd, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_95cc17cd, p_IsPrimaryKey := p_IsPrimaryKey_95cc17cd, p_IsUnique := p_IsUnique_95cc17cd, p_Category := p_Category_95cc17cd, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_95cc17cd, p_ExtendedType := p_ExtendedType_95cc17cd, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_95cc17cd, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_95cc17cd, p_ViewCellTemplate := p_ViewCellTemplate_95cc17cd, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_95cc17cd, p_AllowUpdateAPI := p_AllowUpdateAPI_95cc17cd, p_AllowUpdateInView := p_AllowUpdateInView_95cc17cd, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_95cc17cd, p_FullTextSearchEnabled := p_FullTextSearchEnabled_95cc17cd, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_95cc17cd, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_95cc17cd, p_GeneratedFormSection := p_GeneratedFormSection_95cc17cd, p_IsNameField := p_IsNameField_95cc17cd, p_RelatedEntityID := p_RelatedEntityID_95cc17cd, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_95cc17cd, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_95cc17cd, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_95cc17cd, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_95cc17cd, p_EntityIDFieldName := p_EntityIDFieldName_95cc17cd, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_95cc17cd, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_95cc17cd, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_95cc17cd, p_Status := p_Status_95cc17cd, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_95cc17cd, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_95cc17cd, p_AutoUpdateCategory := p_AutoUpdateCategory_95cc17cd, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_95cc17cd, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_95cc17cd, p_Encrypt := p_Encrypt_95cc17cd, p_EncryptionKeyID := p_EncryptionKeyID_95cc17cd, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_95cc17cd, p_SendEncryptedValue := p_SendEncryptedValue_95cc17cd, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_95cc17cd, p_IsSoftForeignKey := p_IsSoftForeignKey_95cc17cd, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_95cc17cd, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_95cc17cd, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_95cc17cd, p_JSONTypeDefinition := p_JSONTypeDefinition_95cc17cd, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_95cc17cd, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_95cc17cd, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_95cc17cd, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_95cc17cd, p_IsComputed := p_IsComputed_95cc17cd, p_EmbeddedRecord := p_EmbeddedRecord_95cc17cd, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_95cc17cd, p_Configuration_Clear := TRUE, p_ID := p_ID_95cc17cd);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_51a02b68 VARCHAR(255);
  p_Description_51a02b68 TEXT;
  p_AutoUpdateDescription_51a02b68 BOOLEAN;
  p_IsPrimaryKey_51a02b68 BOOLEAN;
  p_IsUnique_51a02b68 BOOLEAN;
  p_Category_51a02b68 VARCHAR(255);
  p_ValueListType_51a02b68 VARCHAR(20);
  p_ExtendedType_51a02b68 VARCHAR(50);
  p_CodeType_51a02b68 VARCHAR(50);
  p_DefaultInView_51a02b68 BOOLEAN;
  p_ViewCellTemplate_51a02b68 TEXT;
  p_DefaultColumnWidth_51a02b68 INTEGER;
  p_AllowUpdateAPI_51a02b68 BOOLEAN;
  p_AllowUpdateInView_51a02b68 BOOLEAN;
  p_IncludeInUserSearchAPI_51a02b68 BOOLEAN;
  p_FullTextSearchEnabled_51a02b68 BOOLEAN;
  p_UserSearchParamFormatAPI_51a02b68 VARCHAR(500);
  p_IncludeInGeneratedForm_51a02b68 BOOLEAN;
  p_GeneratedFormSection_51a02b68 VARCHAR(10);
  p_IsNameField_51a02b68 BOOLEAN;
  p_RelatedEntityID_51a02b68 UUID;
  p_RelatedEntityFieldName_51a02b68 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_51a02b68 BOOLEAN;
  p_RelatedEntityNameFieldMap_51a02b68 VARCHAR(255);
  p_RelatedEntityDisplayType_51a02b68 VARCHAR(20);
  p_EntityIDFieldName_51a02b68 VARCHAR(100);
  p_ScopeDefault_51a02b68 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_51a02b68 BOOLEAN;
  p_ValuesToPackWithSchema_51a02b68 VARCHAR(10);
  p_Status_51a02b68 VARCHAR(25);
  p_AutoUpdateIsNameField_51a02b68 BOOLEAN;
  p_AutoUpdateDefaultInView_51a02b68 BOOLEAN;
  p_AutoUpdateCategory_51a02b68 BOOLEAN;
  p_AutoUpdateDisplayName_51a02b68 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_51a02b68 BOOLEAN;
  p_Encrypt_51a02b68 BOOLEAN;
  p_EncryptionKeyID_51a02b68 UUID;
  p_AllowDecryptInAPI_51a02b68 BOOLEAN;
  p_SendEncryptedValue_51a02b68 BOOLEAN;
  p_IsSoftPrimaryKey_51a02b68 BOOLEAN;
  p_IsSoftForeignKey_51a02b68 BOOLEAN;
  p_RelatedEntityJoinFields_51a02b68 TEXT;
  p_JSONType_51a02b68 VARCHAR(255);
  p_JSONTypeIsArray_51a02b68 BOOLEAN;
  p_JSONTypeDefinition_51a02b68 TEXT;
  p_UserSearchPredicateAPI_51a02b68 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_51a02b68 BOOLEAN;
  p_AutoUpdateFullTextSearch_51a02b68 BOOLEAN;
  p_AutoUpdateExtendedType_51a02b68 BOOLEAN;
  p_IsComputed_51a02b68 BOOLEAN;
  p_EmbeddedRecord_51a02b68 TEXT;
  p_Configuration_51a02b68 TEXT;
  p_ID_51a02b68 UUID;
BEGIN
  p_DisplayName_51a02b68 := 'Deal Status Type';
  p_AutoUpdateDescription_51a02b68 := TRUE;
  p_IsPrimaryKey_51a02b68 := FALSE;
  p_IsUnique_51a02b68 := FALSE;
  p_ValueListType_51a02b68 := 'None';
  p_DefaultInView_51a02b68 := TRUE;
  p_DefaultColumnWidth_51a02b68 := 150;
  p_AllowUpdateAPI_51a02b68 := FALSE;
  p_AllowUpdateInView_51a02b68 := TRUE;
  p_IncludeInUserSearchAPI_51a02b68 := FALSE;
  p_FullTextSearchEnabled_51a02b68 := FALSE;
  p_IncludeInGeneratedForm_51a02b68 := TRUE;
  p_GeneratedFormSection_51a02b68 := 'Details';
  p_IsNameField_51a02b68 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_51a02b68 := FALSE;
  p_RelatedEntityDisplayType_51a02b68 := 'Search';
  p_AutoUpdateRelatedEntityInfo_51a02b68 := TRUE;
  p_ValuesToPackWithSchema_51a02b68 := 'Auto';
  p_Status_51a02b68 := 'Active';
  p_AutoUpdateIsNameField_51a02b68 := TRUE;
  p_AutoUpdateDefaultInView_51a02b68 := TRUE;
  p_AutoUpdateCategory_51a02b68 := TRUE;
  p_AutoUpdateDisplayName_51a02b68 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_51a02b68 := TRUE;
  p_Encrypt_51a02b68 := FALSE;
  p_AllowDecryptInAPI_51a02b68 := FALSE;
  p_SendEncryptedValue_51a02b68 := FALSE;
  p_IsSoftPrimaryKey_51a02b68 := FALSE;
  p_IsSoftForeignKey_51a02b68 := FALSE;
  p_JSONTypeIsArray_51a02b68 := FALSE;
  p_UserSearchPredicateAPI_51a02b68 := 'Contains';
  p_AutoUpdateUserSearchPredicate_51a02b68 := TRUE;
  p_AutoUpdateFullTextSearch_51a02b68 := TRUE;
  p_AutoUpdateExtendedType_51a02b68 := TRUE;
  p_IsComputed_51a02b68 := FALSE;
  p_ID_51a02b68 := '0D7D2672-D189-402E-A84E-249EC5ABBD3E';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_51a02b68,
    'Description', p_Description_51a02b68,
    'AutoUpdateDescription', p_AutoUpdateDescription_51a02b68,
    'IsPrimaryKey', p_IsPrimaryKey_51a02b68,
    'IsUnique', p_IsUnique_51a02b68,
    'Category', p_Category_51a02b68,
    'ValueListType', p_ValueListType_51a02b68,
    'ExtendedType', p_ExtendedType_51a02b68,
    'CodeType', p_CodeType_51a02b68,
    'DefaultInView', p_DefaultInView_51a02b68,
    'ViewCellTemplate', p_ViewCellTemplate_51a02b68,
    'DefaultColumnWidth', p_DefaultColumnWidth_51a02b68,
    'AllowUpdateAPI', p_AllowUpdateAPI_51a02b68,
    'AllowUpdateInView', p_AllowUpdateInView_51a02b68,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_51a02b68,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_51a02b68,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_51a02b68,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_51a02b68,
    'GeneratedFormSection', p_GeneratedFormSection_51a02b68,
    'IsNameField', p_IsNameField_51a02b68,
    'RelatedEntityID', p_RelatedEntityID_51a02b68,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_51a02b68,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_51a02b68,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_51a02b68,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_51a02b68,
    'EntityIDFieldName', p_EntityIDFieldName_51a02b68,
    'ScopeDefault', p_ScopeDefault_51a02b68,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_51a02b68,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_51a02b68,
    'Status', p_Status_51a02b68,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_51a02b68,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_51a02b68,
    'AutoUpdateCategory', p_AutoUpdateCategory_51a02b68,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_51a02b68,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_51a02b68,
    'Encrypt', p_Encrypt_51a02b68,
    'EncryptionKeyID', p_EncryptionKeyID_51a02b68,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_51a02b68,
    'SendEncryptedValue', p_SendEncryptedValue_51a02b68,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_51a02b68,
    'IsSoftForeignKey', p_IsSoftForeignKey_51a02b68,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_51a02b68,
    'JSONType', p_JSONType_51a02b68,
    'JSONTypeIsArray', p_JSONTypeIsArray_51a02b68,
    'JSONTypeDefinition', p_JSONTypeDefinition_51a02b68,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_51a02b68,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_51a02b68,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_51a02b68,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_51a02b68,
    'IsComputed', p_IsComputed_51a02b68
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_51a02b68,
    'Configuration', p_Configuration_51a02b68,
    'ID', p_ID_51a02b68
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_51a02b68, p_Description := p_Description_51a02b68, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_51a02b68, p_IsPrimaryKey := p_IsPrimaryKey_51a02b68, p_IsUnique := p_IsUnique_51a02b68, p_Category := p_Category_51a02b68, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_51a02b68, p_ExtendedType := p_ExtendedType_51a02b68, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_51a02b68, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_51a02b68, p_ViewCellTemplate := p_ViewCellTemplate_51a02b68, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_51a02b68, p_AllowUpdateAPI := p_AllowUpdateAPI_51a02b68, p_AllowUpdateInView := p_AllowUpdateInView_51a02b68, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_51a02b68, p_FullTextSearchEnabled := p_FullTextSearchEnabled_51a02b68, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_51a02b68, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_51a02b68, p_GeneratedFormSection := p_GeneratedFormSection_51a02b68, p_IsNameField := p_IsNameField_51a02b68, p_RelatedEntityID := p_RelatedEntityID_51a02b68, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_51a02b68, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_51a02b68, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_51a02b68, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_51a02b68, p_EntityIDFieldName := p_EntityIDFieldName_51a02b68, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_51a02b68, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_51a02b68, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_51a02b68, p_Status := p_Status_51a02b68, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_51a02b68, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_51a02b68, p_AutoUpdateCategory := p_AutoUpdateCategory_51a02b68, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_51a02b68, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_51a02b68, p_Encrypt := p_Encrypt_51a02b68, p_EncryptionKeyID := p_EncryptionKeyID_51a02b68, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_51a02b68, p_SendEncryptedValue := p_SendEncryptedValue_51a02b68, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_51a02b68, p_IsSoftForeignKey := p_IsSoftForeignKey_51a02b68, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_51a02b68, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_51a02b68, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_51a02b68, p_JSONTypeDefinition := p_JSONTypeDefinition_51a02b68, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_51a02b68, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_51a02b68, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_51a02b68, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_51a02b68, p_IsComputed := p_IsComputed_51a02b68, p_EmbeddedRecord := p_EmbeddedRecord_51a02b68, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_51a02b68, p_Configuration_Clear := TRUE, p_ID := p_ID_51a02b68);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_4a4390a8 VARCHAR(255);
  p_Description_4a4390a8 TEXT;
  p_AutoUpdateDescription_4a4390a8 BOOLEAN;
  p_IsPrimaryKey_4a4390a8 BOOLEAN;
  p_IsUnique_4a4390a8 BOOLEAN;
  p_Category_4a4390a8 VARCHAR(255);
  p_ValueListType_4a4390a8 VARCHAR(20);
  p_ExtendedType_4a4390a8 VARCHAR(50);
  p_CodeType_4a4390a8 VARCHAR(50);
  p_DefaultInView_4a4390a8 BOOLEAN;
  p_ViewCellTemplate_4a4390a8 TEXT;
  p_DefaultColumnWidth_4a4390a8 INTEGER;
  p_AllowUpdateAPI_4a4390a8 BOOLEAN;
  p_AllowUpdateInView_4a4390a8 BOOLEAN;
  p_IncludeInUserSearchAPI_4a4390a8 BOOLEAN;
  p_FullTextSearchEnabled_4a4390a8 BOOLEAN;
  p_UserSearchParamFormatAPI_4a4390a8 VARCHAR(500);
  p_IncludeInGeneratedForm_4a4390a8 BOOLEAN;
  p_GeneratedFormSection_4a4390a8 VARCHAR(10);
  p_IsNameField_4a4390a8 BOOLEAN;
  p_RelatedEntityID_4a4390a8 UUID;
  p_RelatedEntityFieldName_4a4390a8 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_4a4390a8 BOOLEAN;
  p_RelatedEntityNameFieldMap_4a4390a8 VARCHAR(255);
  p_RelatedEntityDisplayType_4a4390a8 VARCHAR(20);
  p_EntityIDFieldName_4a4390a8 VARCHAR(100);
  p_ScopeDefault_4a4390a8 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_4a4390a8 BOOLEAN;
  p_ValuesToPackWithSchema_4a4390a8 VARCHAR(10);
  p_Status_4a4390a8 VARCHAR(25);
  p_AutoUpdateIsNameField_4a4390a8 BOOLEAN;
  p_AutoUpdateDefaultInView_4a4390a8 BOOLEAN;
  p_AutoUpdateCategory_4a4390a8 BOOLEAN;
  p_AutoUpdateDisplayName_4a4390a8 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_4a4390a8 BOOLEAN;
  p_Encrypt_4a4390a8 BOOLEAN;
  p_EncryptionKeyID_4a4390a8 UUID;
  p_AllowDecryptInAPI_4a4390a8 BOOLEAN;
  p_SendEncryptedValue_4a4390a8 BOOLEAN;
  p_IsSoftPrimaryKey_4a4390a8 BOOLEAN;
  p_IsSoftForeignKey_4a4390a8 BOOLEAN;
  p_RelatedEntityJoinFields_4a4390a8 TEXT;
  p_JSONType_4a4390a8 VARCHAR(255);
  p_JSONTypeIsArray_4a4390a8 BOOLEAN;
  p_JSONTypeDefinition_4a4390a8 TEXT;
  p_UserSearchPredicateAPI_4a4390a8 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_4a4390a8 BOOLEAN;
  p_AutoUpdateFullTextSearch_4a4390a8 BOOLEAN;
  p_AutoUpdateExtendedType_4a4390a8 BOOLEAN;
  p_IsComputed_4a4390a8 BOOLEAN;
  p_EmbeddedRecord_4a4390a8 TEXT;
  p_Configuration_4a4390a8 TEXT;
  p_ID_4a4390a8 UUID;
BEGIN
  p_DisplayName_4a4390a8 := 'Amount';
  p_Description_4a4390a8 := 'The deal value. A CACHED ANSWER returned by Orders.PreviewOrder for this deal''s line set — NOT computed here. For a simple (header-only) deal it is hand-entered and AmountIsComputed is 0. Never sum the order''s lines into this column; sales does no arithmetic.';
  p_AutoUpdateDescription_4a4390a8 := TRUE;
  p_IsPrimaryKey_4a4390a8 := FALSE;
  p_IsUnique_4a4390a8 := FALSE;
  p_ValueListType_4a4390a8 := 'None';
  p_DefaultInView_4a4390a8 := TRUE;
  p_DefaultColumnWidth_4a4390a8 := 150;
  p_AllowUpdateAPI_4a4390a8 := TRUE;
  p_AllowUpdateInView_4a4390a8 := TRUE;
  p_IncludeInUserSearchAPI_4a4390a8 := FALSE;
  p_FullTextSearchEnabled_4a4390a8 := FALSE;
  p_IncludeInGeneratedForm_4a4390a8 := TRUE;
  p_GeneratedFormSection_4a4390a8 := 'Details';
  p_IsNameField_4a4390a8 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_4a4390a8 := FALSE;
  p_RelatedEntityDisplayType_4a4390a8 := 'Search';
  p_AutoUpdateRelatedEntityInfo_4a4390a8 := TRUE;
  p_ValuesToPackWithSchema_4a4390a8 := 'Auto';
  p_Status_4a4390a8 := 'Active';
  p_AutoUpdateIsNameField_4a4390a8 := TRUE;
  p_AutoUpdateDefaultInView_4a4390a8 := TRUE;
  p_AutoUpdateCategory_4a4390a8 := TRUE;
  p_AutoUpdateDisplayName_4a4390a8 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_4a4390a8 := TRUE;
  p_Encrypt_4a4390a8 := FALSE;
  p_AllowDecryptInAPI_4a4390a8 := FALSE;
  p_SendEncryptedValue_4a4390a8 := FALSE;
  p_IsSoftPrimaryKey_4a4390a8 := FALSE;
  p_IsSoftForeignKey_4a4390a8 := FALSE;
  p_JSONTypeIsArray_4a4390a8 := FALSE;
  p_UserSearchPredicateAPI_4a4390a8 := 'Contains';
  p_AutoUpdateUserSearchPredicate_4a4390a8 := TRUE;
  p_AutoUpdateFullTextSearch_4a4390a8 := TRUE;
  p_AutoUpdateExtendedType_4a4390a8 := TRUE;
  p_IsComputed_4a4390a8 := FALSE;
  p_ID_4a4390a8 := '440893BB-B492-4D23-B250-EE48A590182F';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_4a4390a8,
    'Description', p_Description_4a4390a8,
    'AutoUpdateDescription', p_AutoUpdateDescription_4a4390a8,
    'IsPrimaryKey', p_IsPrimaryKey_4a4390a8,
    'IsUnique', p_IsUnique_4a4390a8,
    'Category', p_Category_4a4390a8,
    'ValueListType', p_ValueListType_4a4390a8,
    'ExtendedType', p_ExtendedType_4a4390a8,
    'CodeType', p_CodeType_4a4390a8,
    'DefaultInView', p_DefaultInView_4a4390a8,
    'ViewCellTemplate', p_ViewCellTemplate_4a4390a8,
    'DefaultColumnWidth', p_DefaultColumnWidth_4a4390a8,
    'AllowUpdateAPI', p_AllowUpdateAPI_4a4390a8,
    'AllowUpdateInView', p_AllowUpdateInView_4a4390a8,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_4a4390a8,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_4a4390a8,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_4a4390a8,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_4a4390a8,
    'GeneratedFormSection', p_GeneratedFormSection_4a4390a8,
    'IsNameField', p_IsNameField_4a4390a8,
    'RelatedEntityID', p_RelatedEntityID_4a4390a8,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_4a4390a8,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_4a4390a8,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_4a4390a8,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_4a4390a8,
    'EntityIDFieldName', p_EntityIDFieldName_4a4390a8,
    'ScopeDefault', p_ScopeDefault_4a4390a8,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_4a4390a8,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_4a4390a8,
    'Status', p_Status_4a4390a8,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_4a4390a8,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_4a4390a8,
    'AutoUpdateCategory', p_AutoUpdateCategory_4a4390a8,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_4a4390a8,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_4a4390a8,
    'Encrypt', p_Encrypt_4a4390a8,
    'EncryptionKeyID', p_EncryptionKeyID_4a4390a8,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_4a4390a8,
    'SendEncryptedValue', p_SendEncryptedValue_4a4390a8,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_4a4390a8,
    'IsSoftForeignKey', p_IsSoftForeignKey_4a4390a8,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_4a4390a8,
    'JSONType', p_JSONType_4a4390a8,
    'JSONTypeIsArray', p_JSONTypeIsArray_4a4390a8,
    'JSONTypeDefinition', p_JSONTypeDefinition_4a4390a8,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_4a4390a8,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_4a4390a8,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_4a4390a8,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_4a4390a8,
    'IsComputed', p_IsComputed_4a4390a8
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_4a4390a8,
    'Configuration', p_Configuration_4a4390a8,
    'ID', p_ID_4a4390a8
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_4a4390a8, p_Description := p_Description_4a4390a8, p_AutoUpdateDescription := p_AutoUpdateDescription_4a4390a8, p_IsPrimaryKey := p_IsPrimaryKey_4a4390a8, p_IsUnique := p_IsUnique_4a4390a8, p_Category := p_Category_4a4390a8, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_4a4390a8, p_ExtendedType := p_ExtendedType_4a4390a8, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_4a4390a8, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_4a4390a8, p_ViewCellTemplate := p_ViewCellTemplate_4a4390a8, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_4a4390a8, p_AllowUpdateAPI := p_AllowUpdateAPI_4a4390a8, p_AllowUpdateInView := p_AllowUpdateInView_4a4390a8, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_4a4390a8, p_FullTextSearchEnabled := p_FullTextSearchEnabled_4a4390a8, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_4a4390a8, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_4a4390a8, p_GeneratedFormSection := p_GeneratedFormSection_4a4390a8, p_IsNameField := p_IsNameField_4a4390a8, p_RelatedEntityID := p_RelatedEntityID_4a4390a8, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_4a4390a8, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_4a4390a8, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_4a4390a8, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_4a4390a8, p_EntityIDFieldName := p_EntityIDFieldName_4a4390a8, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_4a4390a8, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_4a4390a8, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_4a4390a8, p_Status := p_Status_4a4390a8, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_4a4390a8, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_4a4390a8, p_AutoUpdateCategory := p_AutoUpdateCategory_4a4390a8, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_4a4390a8, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_4a4390a8, p_Encrypt := p_Encrypt_4a4390a8, p_EncryptionKeyID := p_EncryptionKeyID_4a4390a8, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_4a4390a8, p_SendEncryptedValue := p_SendEncryptedValue_4a4390a8, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_4a4390a8, p_IsSoftForeignKey := p_IsSoftForeignKey_4a4390a8, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_4a4390a8, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_4a4390a8, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_4a4390a8, p_JSONTypeDefinition := p_JSONTypeDefinition_4a4390a8, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_4a4390a8, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_4a4390a8, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_4a4390a8, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_4a4390a8, p_IsComputed := p_IsComputed_4a4390a8, p_EmbeddedRecord := p_EmbeddedRecord_4a4390a8, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_4a4390a8, p_Configuration_Clear := TRUE, p_ID := p_ID_4a4390a8);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_606e0cc1 VARCHAR(255);
  p_Description_606e0cc1 TEXT;
  p_AutoUpdateDescription_606e0cc1 BOOLEAN;
  p_IsPrimaryKey_606e0cc1 BOOLEAN;
  p_IsUnique_606e0cc1 BOOLEAN;
  p_Category_606e0cc1 VARCHAR(255);
  p_ValueListType_606e0cc1 VARCHAR(20);
  p_ExtendedType_606e0cc1 VARCHAR(50);
  p_CodeType_606e0cc1 VARCHAR(50);
  p_DefaultInView_606e0cc1 BOOLEAN;
  p_ViewCellTemplate_606e0cc1 TEXT;
  p_DefaultColumnWidth_606e0cc1 INTEGER;
  p_AllowUpdateAPI_606e0cc1 BOOLEAN;
  p_AllowUpdateInView_606e0cc1 BOOLEAN;
  p_IncludeInUserSearchAPI_606e0cc1 BOOLEAN;
  p_FullTextSearchEnabled_606e0cc1 BOOLEAN;
  p_UserSearchParamFormatAPI_606e0cc1 VARCHAR(500);
  p_IncludeInGeneratedForm_606e0cc1 BOOLEAN;
  p_GeneratedFormSection_606e0cc1 VARCHAR(10);
  p_IsNameField_606e0cc1 BOOLEAN;
  p_RelatedEntityID_606e0cc1 UUID;
  p_RelatedEntityFieldName_606e0cc1 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_606e0cc1 BOOLEAN;
  p_RelatedEntityNameFieldMap_606e0cc1 VARCHAR(255);
  p_RelatedEntityDisplayType_606e0cc1 VARCHAR(20);
  p_EntityIDFieldName_606e0cc1 VARCHAR(100);
  p_ScopeDefault_606e0cc1 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_606e0cc1 BOOLEAN;
  p_ValuesToPackWithSchema_606e0cc1 VARCHAR(10);
  p_Status_606e0cc1 VARCHAR(25);
  p_AutoUpdateIsNameField_606e0cc1 BOOLEAN;
  p_AutoUpdateDefaultInView_606e0cc1 BOOLEAN;
  p_AutoUpdateCategory_606e0cc1 BOOLEAN;
  p_AutoUpdateDisplayName_606e0cc1 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_606e0cc1 BOOLEAN;
  p_Encrypt_606e0cc1 BOOLEAN;
  p_EncryptionKeyID_606e0cc1 UUID;
  p_AllowDecryptInAPI_606e0cc1 BOOLEAN;
  p_SendEncryptedValue_606e0cc1 BOOLEAN;
  p_IsSoftPrimaryKey_606e0cc1 BOOLEAN;
  p_IsSoftForeignKey_606e0cc1 BOOLEAN;
  p_RelatedEntityJoinFields_606e0cc1 TEXT;
  p_JSONType_606e0cc1 VARCHAR(255);
  p_JSONTypeIsArray_606e0cc1 BOOLEAN;
  p_JSONTypeDefinition_606e0cc1 TEXT;
  p_UserSearchPredicateAPI_606e0cc1 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_606e0cc1 BOOLEAN;
  p_AutoUpdateFullTextSearch_606e0cc1 BOOLEAN;
  p_AutoUpdateExtendedType_606e0cc1 BOOLEAN;
  p_IsComputed_606e0cc1 BOOLEAN;
  p_EmbeddedRecord_606e0cc1 TEXT;
  p_Configuration_606e0cc1 TEXT;
  p_ID_606e0cc1 UUID;
BEGIN
  p_DisplayName_606e0cc1 := 'Probability';
  p_AutoUpdateDescription_606e0cc1 := TRUE;
  p_IsPrimaryKey_606e0cc1 := FALSE;
  p_IsUnique_606e0cc1 := FALSE;
  p_ValueListType_606e0cc1 := 'None';
  p_DefaultInView_606e0cc1 := TRUE;
  p_DefaultColumnWidth_606e0cc1 := 150;
  p_AllowUpdateAPI_606e0cc1 := TRUE;
  p_AllowUpdateInView_606e0cc1 := TRUE;
  p_IncludeInUserSearchAPI_606e0cc1 := FALSE;
  p_FullTextSearchEnabled_606e0cc1 := FALSE;
  p_IncludeInGeneratedForm_606e0cc1 := TRUE;
  p_GeneratedFormSection_606e0cc1 := 'Details';
  p_IsNameField_606e0cc1 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_606e0cc1 := FALSE;
  p_RelatedEntityDisplayType_606e0cc1 := 'Search';
  p_AutoUpdateRelatedEntityInfo_606e0cc1 := TRUE;
  p_ValuesToPackWithSchema_606e0cc1 := 'Auto';
  p_Status_606e0cc1 := 'Active';
  p_AutoUpdateIsNameField_606e0cc1 := TRUE;
  p_AutoUpdateDefaultInView_606e0cc1 := TRUE;
  p_AutoUpdateCategory_606e0cc1 := TRUE;
  p_AutoUpdateDisplayName_606e0cc1 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_606e0cc1 := TRUE;
  p_Encrypt_606e0cc1 := FALSE;
  p_AllowDecryptInAPI_606e0cc1 := FALSE;
  p_SendEncryptedValue_606e0cc1 := FALSE;
  p_IsSoftPrimaryKey_606e0cc1 := FALSE;
  p_IsSoftForeignKey_606e0cc1 := FALSE;
  p_JSONTypeIsArray_606e0cc1 := FALSE;
  p_UserSearchPredicateAPI_606e0cc1 := 'Contains';
  p_AutoUpdateUserSearchPredicate_606e0cc1 := TRUE;
  p_AutoUpdateFullTextSearch_606e0cc1 := TRUE;
  p_AutoUpdateExtendedType_606e0cc1 := TRUE;
  p_IsComputed_606e0cc1 := FALSE;
  p_ID_606e0cc1 := 'C0D9A787-0AF2-4158-B5ED-E2BCEC3C84CB';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_606e0cc1,
    'Description', p_Description_606e0cc1,
    'AutoUpdateDescription', p_AutoUpdateDescription_606e0cc1,
    'IsPrimaryKey', p_IsPrimaryKey_606e0cc1,
    'IsUnique', p_IsUnique_606e0cc1,
    'Category', p_Category_606e0cc1,
    'ValueListType', p_ValueListType_606e0cc1,
    'ExtendedType', p_ExtendedType_606e0cc1,
    'CodeType', p_CodeType_606e0cc1,
    'DefaultInView', p_DefaultInView_606e0cc1,
    'ViewCellTemplate', p_ViewCellTemplate_606e0cc1,
    'DefaultColumnWidth', p_DefaultColumnWidth_606e0cc1,
    'AllowUpdateAPI', p_AllowUpdateAPI_606e0cc1,
    'AllowUpdateInView', p_AllowUpdateInView_606e0cc1,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_606e0cc1,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_606e0cc1,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_606e0cc1,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_606e0cc1,
    'GeneratedFormSection', p_GeneratedFormSection_606e0cc1,
    'IsNameField', p_IsNameField_606e0cc1,
    'RelatedEntityID', p_RelatedEntityID_606e0cc1,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_606e0cc1,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_606e0cc1,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_606e0cc1,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_606e0cc1,
    'EntityIDFieldName', p_EntityIDFieldName_606e0cc1,
    'ScopeDefault', p_ScopeDefault_606e0cc1,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_606e0cc1,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_606e0cc1,
    'Status', p_Status_606e0cc1,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_606e0cc1,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_606e0cc1,
    'AutoUpdateCategory', p_AutoUpdateCategory_606e0cc1,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_606e0cc1,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_606e0cc1,
    'Encrypt', p_Encrypt_606e0cc1,
    'EncryptionKeyID', p_EncryptionKeyID_606e0cc1,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_606e0cc1,
    'SendEncryptedValue', p_SendEncryptedValue_606e0cc1,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_606e0cc1,
    'IsSoftForeignKey', p_IsSoftForeignKey_606e0cc1,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_606e0cc1,
    'JSONType', p_JSONType_606e0cc1,
    'JSONTypeIsArray', p_JSONTypeIsArray_606e0cc1,
    'JSONTypeDefinition', p_JSONTypeDefinition_606e0cc1,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_606e0cc1,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_606e0cc1,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_606e0cc1,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_606e0cc1,
    'IsComputed', p_IsComputed_606e0cc1
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_606e0cc1,
    'Configuration', p_Configuration_606e0cc1,
    'ID', p_ID_606e0cc1
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_606e0cc1, p_Description := p_Description_606e0cc1, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_606e0cc1, p_IsPrimaryKey := p_IsPrimaryKey_606e0cc1, p_IsUnique := p_IsUnique_606e0cc1, p_Category := p_Category_606e0cc1, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_606e0cc1, p_ExtendedType := p_ExtendedType_606e0cc1, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_606e0cc1, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_606e0cc1, p_ViewCellTemplate := p_ViewCellTemplate_606e0cc1, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_606e0cc1, p_AllowUpdateAPI := p_AllowUpdateAPI_606e0cc1, p_AllowUpdateInView := p_AllowUpdateInView_606e0cc1, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_606e0cc1, p_FullTextSearchEnabled := p_FullTextSearchEnabled_606e0cc1, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_606e0cc1, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_606e0cc1, p_GeneratedFormSection := p_GeneratedFormSection_606e0cc1, p_IsNameField := p_IsNameField_606e0cc1, p_RelatedEntityID := p_RelatedEntityID_606e0cc1, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_606e0cc1, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_606e0cc1, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_606e0cc1, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_606e0cc1, p_EntityIDFieldName := p_EntityIDFieldName_606e0cc1, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_606e0cc1, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_606e0cc1, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_606e0cc1, p_Status := p_Status_606e0cc1, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_606e0cc1, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_606e0cc1, p_AutoUpdateCategory := p_AutoUpdateCategory_606e0cc1, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_606e0cc1, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_606e0cc1, p_Encrypt := p_Encrypt_606e0cc1, p_EncryptionKeyID := p_EncryptionKeyID_606e0cc1, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_606e0cc1, p_SendEncryptedValue := p_SendEncryptedValue_606e0cc1, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_606e0cc1, p_IsSoftForeignKey := p_IsSoftForeignKey_606e0cc1, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_606e0cc1, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_606e0cc1, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_606e0cc1, p_JSONTypeDefinition := p_JSONTypeDefinition_606e0cc1, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_606e0cc1, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_606e0cc1, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_606e0cc1, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_606e0cc1, p_IsComputed := p_IsComputed_606e0cc1, p_EmbeddedRecord := p_EmbeddedRecord_606e0cc1, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_606e0cc1, p_Configuration_Clear := TRUE, p_ID := p_ID_606e0cc1);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_66764eb3 VARCHAR(255);
  p_Description_66764eb3 TEXT;
  p_AutoUpdateDescription_66764eb3 BOOLEAN;
  p_IsPrimaryKey_66764eb3 BOOLEAN;
  p_IsUnique_66764eb3 BOOLEAN;
  p_Category_66764eb3 VARCHAR(255);
  p_ValueListType_66764eb3 VARCHAR(20);
  p_ExtendedType_66764eb3 VARCHAR(50);
  p_CodeType_66764eb3 VARCHAR(50);
  p_DefaultInView_66764eb3 BOOLEAN;
  p_ViewCellTemplate_66764eb3 TEXT;
  p_DefaultColumnWidth_66764eb3 INTEGER;
  p_AllowUpdateAPI_66764eb3 BOOLEAN;
  p_AllowUpdateInView_66764eb3 BOOLEAN;
  p_IncludeInUserSearchAPI_66764eb3 BOOLEAN;
  p_FullTextSearchEnabled_66764eb3 BOOLEAN;
  p_UserSearchParamFormatAPI_66764eb3 VARCHAR(500);
  p_IncludeInGeneratedForm_66764eb3 BOOLEAN;
  p_GeneratedFormSection_66764eb3 VARCHAR(10);
  p_IsNameField_66764eb3 BOOLEAN;
  p_RelatedEntityID_66764eb3 UUID;
  p_RelatedEntityFieldName_66764eb3 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_66764eb3 BOOLEAN;
  p_RelatedEntityNameFieldMap_66764eb3 VARCHAR(255);
  p_RelatedEntityDisplayType_66764eb3 VARCHAR(20);
  p_EntityIDFieldName_66764eb3 VARCHAR(100);
  p_ScopeDefault_66764eb3 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_66764eb3 BOOLEAN;
  p_ValuesToPackWithSchema_66764eb3 VARCHAR(10);
  p_Status_66764eb3 VARCHAR(25);
  p_AutoUpdateIsNameField_66764eb3 BOOLEAN;
  p_AutoUpdateDefaultInView_66764eb3 BOOLEAN;
  p_AutoUpdateCategory_66764eb3 BOOLEAN;
  p_AutoUpdateDisplayName_66764eb3 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_66764eb3 BOOLEAN;
  p_Encrypt_66764eb3 BOOLEAN;
  p_EncryptionKeyID_66764eb3 UUID;
  p_AllowDecryptInAPI_66764eb3 BOOLEAN;
  p_SendEncryptedValue_66764eb3 BOOLEAN;
  p_IsSoftPrimaryKey_66764eb3 BOOLEAN;
  p_IsSoftForeignKey_66764eb3 BOOLEAN;
  p_RelatedEntityJoinFields_66764eb3 TEXT;
  p_JSONType_66764eb3 VARCHAR(255);
  p_JSONTypeIsArray_66764eb3 BOOLEAN;
  p_JSONTypeDefinition_66764eb3 TEXT;
  p_UserSearchPredicateAPI_66764eb3 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_66764eb3 BOOLEAN;
  p_AutoUpdateFullTextSearch_66764eb3 BOOLEAN;
  p_AutoUpdateExtendedType_66764eb3 BOOLEAN;
  p_IsComputed_66764eb3 BOOLEAN;
  p_EmbeddedRecord_66764eb3 TEXT;
  p_Configuration_66764eb3 TEXT;
  p_ID_66764eb3 UUID;
BEGIN
  p_DisplayName_66764eb3 := 'Expected Close Date';
  p_AutoUpdateDescription_66764eb3 := TRUE;
  p_IsPrimaryKey_66764eb3 := FALSE;
  p_IsUnique_66764eb3 := FALSE;
  p_ValueListType_66764eb3 := 'None';
  p_DefaultInView_66764eb3 := TRUE;
  p_DefaultColumnWidth_66764eb3 := 150;
  p_AllowUpdateAPI_66764eb3 := TRUE;
  p_AllowUpdateInView_66764eb3 := TRUE;
  p_IncludeInUserSearchAPI_66764eb3 := FALSE;
  p_FullTextSearchEnabled_66764eb3 := FALSE;
  p_IncludeInGeneratedForm_66764eb3 := TRUE;
  p_GeneratedFormSection_66764eb3 := 'Details';
  p_IsNameField_66764eb3 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_66764eb3 := FALSE;
  p_RelatedEntityDisplayType_66764eb3 := 'Search';
  p_AutoUpdateRelatedEntityInfo_66764eb3 := TRUE;
  p_ValuesToPackWithSchema_66764eb3 := 'Auto';
  p_Status_66764eb3 := 'Active';
  p_AutoUpdateIsNameField_66764eb3 := TRUE;
  p_AutoUpdateDefaultInView_66764eb3 := TRUE;
  p_AutoUpdateCategory_66764eb3 := TRUE;
  p_AutoUpdateDisplayName_66764eb3 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_66764eb3 := TRUE;
  p_Encrypt_66764eb3 := FALSE;
  p_AllowDecryptInAPI_66764eb3 := FALSE;
  p_SendEncryptedValue_66764eb3 := FALSE;
  p_IsSoftPrimaryKey_66764eb3 := FALSE;
  p_IsSoftForeignKey_66764eb3 := FALSE;
  p_JSONTypeIsArray_66764eb3 := FALSE;
  p_UserSearchPredicateAPI_66764eb3 := 'Contains';
  p_AutoUpdateUserSearchPredicate_66764eb3 := TRUE;
  p_AutoUpdateFullTextSearch_66764eb3 := TRUE;
  p_AutoUpdateExtendedType_66764eb3 := TRUE;
  p_IsComputed_66764eb3 := FALSE;
  p_ID_66764eb3 := '6AC23D15-33D1-4618-B582-01EC9F40655B';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_66764eb3,
    'Description', p_Description_66764eb3,
    'AutoUpdateDescription', p_AutoUpdateDescription_66764eb3,
    'IsPrimaryKey', p_IsPrimaryKey_66764eb3,
    'IsUnique', p_IsUnique_66764eb3,
    'Category', p_Category_66764eb3,
    'ValueListType', p_ValueListType_66764eb3,
    'ExtendedType', p_ExtendedType_66764eb3,
    'CodeType', p_CodeType_66764eb3,
    'DefaultInView', p_DefaultInView_66764eb3,
    'ViewCellTemplate', p_ViewCellTemplate_66764eb3,
    'DefaultColumnWidth', p_DefaultColumnWidth_66764eb3,
    'AllowUpdateAPI', p_AllowUpdateAPI_66764eb3,
    'AllowUpdateInView', p_AllowUpdateInView_66764eb3,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_66764eb3,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_66764eb3,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_66764eb3,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_66764eb3,
    'GeneratedFormSection', p_GeneratedFormSection_66764eb3,
    'IsNameField', p_IsNameField_66764eb3,
    'RelatedEntityID', p_RelatedEntityID_66764eb3,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_66764eb3,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_66764eb3,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_66764eb3,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_66764eb3,
    'EntityIDFieldName', p_EntityIDFieldName_66764eb3,
    'ScopeDefault', p_ScopeDefault_66764eb3,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_66764eb3,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_66764eb3,
    'Status', p_Status_66764eb3,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_66764eb3,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_66764eb3,
    'AutoUpdateCategory', p_AutoUpdateCategory_66764eb3,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_66764eb3,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_66764eb3,
    'Encrypt', p_Encrypt_66764eb3,
    'EncryptionKeyID', p_EncryptionKeyID_66764eb3,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_66764eb3,
    'SendEncryptedValue', p_SendEncryptedValue_66764eb3,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_66764eb3,
    'IsSoftForeignKey', p_IsSoftForeignKey_66764eb3,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_66764eb3,
    'JSONType', p_JSONType_66764eb3,
    'JSONTypeIsArray', p_JSONTypeIsArray_66764eb3,
    'JSONTypeDefinition', p_JSONTypeDefinition_66764eb3,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_66764eb3,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_66764eb3,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_66764eb3,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_66764eb3,
    'IsComputed', p_IsComputed_66764eb3
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_66764eb3,
    'Configuration', p_Configuration_66764eb3,
    'ID', p_ID_66764eb3
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_66764eb3, p_Description := p_Description_66764eb3, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_66764eb3, p_IsPrimaryKey := p_IsPrimaryKey_66764eb3, p_IsUnique := p_IsUnique_66764eb3, p_Category := p_Category_66764eb3, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_66764eb3, p_ExtendedType := p_ExtendedType_66764eb3, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_66764eb3, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_66764eb3, p_ViewCellTemplate := p_ViewCellTemplate_66764eb3, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_66764eb3, p_AllowUpdateAPI := p_AllowUpdateAPI_66764eb3, p_AllowUpdateInView := p_AllowUpdateInView_66764eb3, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_66764eb3, p_FullTextSearchEnabled := p_FullTextSearchEnabled_66764eb3, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_66764eb3, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_66764eb3, p_GeneratedFormSection := p_GeneratedFormSection_66764eb3, p_IsNameField := p_IsNameField_66764eb3, p_RelatedEntityID := p_RelatedEntityID_66764eb3, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_66764eb3, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_66764eb3, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_66764eb3, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_66764eb3, p_EntityIDFieldName := p_EntityIDFieldName_66764eb3, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_66764eb3, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_66764eb3, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_66764eb3, p_Status := p_Status_66764eb3, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_66764eb3, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_66764eb3, p_AutoUpdateCategory := p_AutoUpdateCategory_66764eb3, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_66764eb3, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_66764eb3, p_Encrypt := p_Encrypt_66764eb3, p_EncryptionKeyID := p_EncryptionKeyID_66764eb3, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_66764eb3, p_SendEncryptedValue := p_SendEncryptedValue_66764eb3, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_66764eb3, p_IsSoftForeignKey := p_IsSoftForeignKey_66764eb3, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_66764eb3, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_66764eb3, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_66764eb3, p_JSONTypeDefinition := p_JSONTypeDefinition_66764eb3, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_66764eb3, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_66764eb3, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_66764eb3, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_66764eb3, p_IsComputed := p_IsComputed_66764eb3, p_EmbeddedRecord := p_EmbeddedRecord_66764eb3, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_66764eb3, p_Configuration_Clear := TRUE, p_ID := p_ID_66764eb3);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_11912065 VARCHAR(255);
  p_Description_11912065 TEXT;
  p_AutoUpdateDescription_11912065 BOOLEAN;
  p_IsPrimaryKey_11912065 BOOLEAN;
  p_IsUnique_11912065 BOOLEAN;
  p_Category_11912065 VARCHAR(255);
  p_ValueListType_11912065 VARCHAR(20);
  p_ExtendedType_11912065 VARCHAR(50);
  p_CodeType_11912065 VARCHAR(50);
  p_DefaultInView_11912065 BOOLEAN;
  p_ViewCellTemplate_11912065 TEXT;
  p_DefaultColumnWidth_11912065 INTEGER;
  p_AllowUpdateAPI_11912065 BOOLEAN;
  p_AllowUpdateInView_11912065 BOOLEAN;
  p_IncludeInUserSearchAPI_11912065 BOOLEAN;
  p_FullTextSearchEnabled_11912065 BOOLEAN;
  p_UserSearchParamFormatAPI_11912065 VARCHAR(500);
  p_IncludeInGeneratedForm_11912065 BOOLEAN;
  p_GeneratedFormSection_11912065 VARCHAR(10);
  p_IsNameField_11912065 BOOLEAN;
  p_RelatedEntityID_11912065 UUID;
  p_RelatedEntityFieldName_11912065 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_11912065 BOOLEAN;
  p_RelatedEntityNameFieldMap_11912065 VARCHAR(255);
  p_RelatedEntityDisplayType_11912065 VARCHAR(20);
  p_EntityIDFieldName_11912065 VARCHAR(100);
  p_ScopeDefault_11912065 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_11912065 BOOLEAN;
  p_ValuesToPackWithSchema_11912065 VARCHAR(10);
  p_Status_11912065 VARCHAR(25);
  p_AutoUpdateIsNameField_11912065 BOOLEAN;
  p_AutoUpdateDefaultInView_11912065 BOOLEAN;
  p_AutoUpdateCategory_11912065 BOOLEAN;
  p_AutoUpdateDisplayName_11912065 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_11912065 BOOLEAN;
  p_Encrypt_11912065 BOOLEAN;
  p_EncryptionKeyID_11912065 UUID;
  p_AllowDecryptInAPI_11912065 BOOLEAN;
  p_SendEncryptedValue_11912065 BOOLEAN;
  p_IsSoftPrimaryKey_11912065 BOOLEAN;
  p_IsSoftForeignKey_11912065 BOOLEAN;
  p_RelatedEntityJoinFields_11912065 TEXT;
  p_JSONType_11912065 VARCHAR(255);
  p_JSONTypeIsArray_11912065 BOOLEAN;
  p_JSONTypeDefinition_11912065 TEXT;
  p_UserSearchPredicateAPI_11912065 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_11912065 BOOLEAN;
  p_AutoUpdateFullTextSearch_11912065 BOOLEAN;
  p_AutoUpdateExtendedType_11912065 BOOLEAN;
  p_IsComputed_11912065 BOOLEAN;
  p_EmbeddedRecord_11912065 TEXT;
  p_Configuration_11912065 TEXT;
  p_ID_11912065 UUID;
BEGIN
  p_DisplayName_11912065 := 'Owner Employee';
  p_AutoUpdateDescription_11912065 := TRUE;
  p_IsPrimaryKey_11912065 := FALSE;
  p_IsUnique_11912065 := FALSE;
  p_ValueListType_11912065 := 'None';
  p_DefaultInView_11912065 := TRUE;
  p_DefaultColumnWidth_11912065 := 150;
  p_AllowUpdateAPI_11912065 := FALSE;
  p_AllowUpdateInView_11912065 := TRUE;
  p_IncludeInUserSearchAPI_11912065 := FALSE;
  p_FullTextSearchEnabled_11912065 := FALSE;
  p_IncludeInGeneratedForm_11912065 := TRUE;
  p_GeneratedFormSection_11912065 := 'Details';
  p_IsNameField_11912065 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_11912065 := FALSE;
  p_RelatedEntityDisplayType_11912065 := 'Search';
  p_AutoUpdateRelatedEntityInfo_11912065 := TRUE;
  p_ValuesToPackWithSchema_11912065 := 'Auto';
  p_Status_11912065 := 'Active';
  p_AutoUpdateIsNameField_11912065 := TRUE;
  p_AutoUpdateDefaultInView_11912065 := TRUE;
  p_AutoUpdateCategory_11912065 := TRUE;
  p_AutoUpdateDisplayName_11912065 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_11912065 := TRUE;
  p_Encrypt_11912065 := FALSE;
  p_AllowDecryptInAPI_11912065 := FALSE;
  p_SendEncryptedValue_11912065 := FALSE;
  p_IsSoftPrimaryKey_11912065 := FALSE;
  p_IsSoftForeignKey_11912065 := FALSE;
  p_JSONTypeIsArray_11912065 := FALSE;
  p_UserSearchPredicateAPI_11912065 := 'Contains';
  p_AutoUpdateUserSearchPredicate_11912065 := TRUE;
  p_AutoUpdateFullTextSearch_11912065 := TRUE;
  p_AutoUpdateExtendedType_11912065 := TRUE;
  p_IsComputed_11912065 := FALSE;
  p_ID_11912065 := '3442E4F5-F87C-4993-9AB3-38D7FBBECF88';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_11912065,
    'Description', p_Description_11912065,
    'AutoUpdateDescription', p_AutoUpdateDescription_11912065,
    'IsPrimaryKey', p_IsPrimaryKey_11912065,
    'IsUnique', p_IsUnique_11912065,
    'Category', p_Category_11912065,
    'ValueListType', p_ValueListType_11912065,
    'ExtendedType', p_ExtendedType_11912065,
    'CodeType', p_CodeType_11912065,
    'DefaultInView', p_DefaultInView_11912065,
    'ViewCellTemplate', p_ViewCellTemplate_11912065,
    'DefaultColumnWidth', p_DefaultColumnWidth_11912065,
    'AllowUpdateAPI', p_AllowUpdateAPI_11912065,
    'AllowUpdateInView', p_AllowUpdateInView_11912065,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_11912065,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_11912065,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_11912065,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_11912065,
    'GeneratedFormSection', p_GeneratedFormSection_11912065,
    'IsNameField', p_IsNameField_11912065,
    'RelatedEntityID', p_RelatedEntityID_11912065,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_11912065,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_11912065,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_11912065,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_11912065,
    'EntityIDFieldName', p_EntityIDFieldName_11912065,
    'ScopeDefault', p_ScopeDefault_11912065,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_11912065,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_11912065,
    'Status', p_Status_11912065,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_11912065,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_11912065,
    'AutoUpdateCategory', p_AutoUpdateCategory_11912065,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_11912065,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_11912065,
    'Encrypt', p_Encrypt_11912065,
    'EncryptionKeyID', p_EncryptionKeyID_11912065,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_11912065,
    'SendEncryptedValue', p_SendEncryptedValue_11912065,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_11912065,
    'IsSoftForeignKey', p_IsSoftForeignKey_11912065,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_11912065,
    'JSONType', p_JSONType_11912065,
    'JSONTypeIsArray', p_JSONTypeIsArray_11912065,
    'JSONTypeDefinition', p_JSONTypeDefinition_11912065,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_11912065,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_11912065,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_11912065,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_11912065,
    'IsComputed', p_IsComputed_11912065
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_11912065,
    'Configuration', p_Configuration_11912065,
    'ID', p_ID_11912065
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_11912065, p_Description := p_Description_11912065, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_11912065, p_IsPrimaryKey := p_IsPrimaryKey_11912065, p_IsUnique := p_IsUnique_11912065, p_Category := p_Category_11912065, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_11912065, p_ExtendedType := p_ExtendedType_11912065, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_11912065, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_11912065, p_ViewCellTemplate := p_ViewCellTemplate_11912065, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_11912065, p_AllowUpdateAPI := p_AllowUpdateAPI_11912065, p_AllowUpdateInView := p_AllowUpdateInView_11912065, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_11912065, p_FullTextSearchEnabled := p_FullTextSearchEnabled_11912065, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_11912065, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_11912065, p_GeneratedFormSection := p_GeneratedFormSection_11912065, p_IsNameField := p_IsNameField_11912065, p_RelatedEntityID := p_RelatedEntityID_11912065, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_11912065, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_11912065, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_11912065, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_11912065, p_EntityIDFieldName := p_EntityIDFieldName_11912065, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_11912065, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_11912065, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_11912065, p_Status := p_Status_11912065, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_11912065, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_11912065, p_AutoUpdateCategory := p_AutoUpdateCategory_11912065, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_11912065, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_11912065, p_Encrypt := p_Encrypt_11912065, p_EncryptionKeyID := p_EncryptionKeyID_11912065, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_11912065, p_SendEncryptedValue := p_SendEncryptedValue_11912065, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_11912065, p_IsSoftForeignKey := p_IsSoftForeignKey_11912065, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_11912065, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_11912065, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_11912065, p_JSONTypeDefinition := p_JSONTypeDefinition_11912065, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_11912065, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_11912065, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_11912065, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_11912065, p_IsComputed := p_IsComputed_11912065, p_EmbeddedRecord := p_EmbeddedRecord_11912065, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_11912065, p_Configuration_Clear := TRUE, p_ID := p_ID_11912065);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_92bac19c VARCHAR(255);
  p_Description_92bac19c TEXT;
  p_AutoUpdateDescription_92bac19c BOOLEAN;
  p_IsPrimaryKey_92bac19c BOOLEAN;
  p_IsUnique_92bac19c BOOLEAN;
  p_Category_92bac19c VARCHAR(255);
  p_ValueListType_92bac19c VARCHAR(20);
  p_ExtendedType_92bac19c VARCHAR(50);
  p_CodeType_92bac19c VARCHAR(50);
  p_DefaultInView_92bac19c BOOLEAN;
  p_ViewCellTemplate_92bac19c TEXT;
  p_DefaultColumnWidth_92bac19c INTEGER;
  p_AllowUpdateAPI_92bac19c BOOLEAN;
  p_AllowUpdateInView_92bac19c BOOLEAN;
  p_IncludeInUserSearchAPI_92bac19c BOOLEAN;
  p_FullTextSearchEnabled_92bac19c BOOLEAN;
  p_UserSearchParamFormatAPI_92bac19c VARCHAR(500);
  p_IncludeInGeneratedForm_92bac19c BOOLEAN;
  p_GeneratedFormSection_92bac19c VARCHAR(10);
  p_IsNameField_92bac19c BOOLEAN;
  p_RelatedEntityID_92bac19c UUID;
  p_RelatedEntityFieldName_92bac19c VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_92bac19c BOOLEAN;
  p_RelatedEntityNameFieldMap_92bac19c VARCHAR(255);
  p_RelatedEntityDisplayType_92bac19c VARCHAR(20);
  p_EntityIDFieldName_92bac19c VARCHAR(100);
  p_ScopeDefault_92bac19c VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_92bac19c BOOLEAN;
  p_ValuesToPackWithSchema_92bac19c VARCHAR(10);
  p_Status_92bac19c VARCHAR(25);
  p_AutoUpdateIsNameField_92bac19c BOOLEAN;
  p_AutoUpdateDefaultInView_92bac19c BOOLEAN;
  p_AutoUpdateCategory_92bac19c BOOLEAN;
  p_AutoUpdateDisplayName_92bac19c BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_92bac19c BOOLEAN;
  p_Encrypt_92bac19c BOOLEAN;
  p_EncryptionKeyID_92bac19c UUID;
  p_AllowDecryptInAPI_92bac19c BOOLEAN;
  p_SendEncryptedValue_92bac19c BOOLEAN;
  p_IsSoftPrimaryKey_92bac19c BOOLEAN;
  p_IsSoftForeignKey_92bac19c BOOLEAN;
  p_RelatedEntityJoinFields_92bac19c TEXT;
  p_JSONType_92bac19c VARCHAR(255);
  p_JSONTypeIsArray_92bac19c BOOLEAN;
  p_JSONTypeDefinition_92bac19c TEXT;
  p_UserSearchPredicateAPI_92bac19c VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_92bac19c BOOLEAN;
  p_AutoUpdateFullTextSearch_92bac19c BOOLEAN;
  p_AutoUpdateExtendedType_92bac19c BOOLEAN;
  p_IsComputed_92bac19c BOOLEAN;
  p_EmbeddedRecord_92bac19c TEXT;
  p_Configuration_92bac19c TEXT;
  p_ID_92bac19c UUID;
BEGIN
  p_DisplayName_92bac19c := 'Forecast Category Type';
  p_AutoUpdateDescription_92bac19c := TRUE;
  p_IsPrimaryKey_92bac19c := FALSE;
  p_IsUnique_92bac19c := FALSE;
  p_ValueListType_92bac19c := 'None';
  p_DefaultInView_92bac19c := TRUE;
  p_DefaultColumnWidth_92bac19c := 150;
  p_AllowUpdateAPI_92bac19c := FALSE;
  p_AllowUpdateInView_92bac19c := TRUE;
  p_IncludeInUserSearchAPI_92bac19c := FALSE;
  p_FullTextSearchEnabled_92bac19c := FALSE;
  p_IncludeInGeneratedForm_92bac19c := TRUE;
  p_GeneratedFormSection_92bac19c := 'Details';
  p_IsNameField_92bac19c := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_92bac19c := FALSE;
  p_RelatedEntityDisplayType_92bac19c := 'Search';
  p_AutoUpdateRelatedEntityInfo_92bac19c := TRUE;
  p_ValuesToPackWithSchema_92bac19c := 'Auto';
  p_Status_92bac19c := 'Active';
  p_AutoUpdateIsNameField_92bac19c := TRUE;
  p_AutoUpdateDefaultInView_92bac19c := TRUE;
  p_AutoUpdateCategory_92bac19c := TRUE;
  p_AutoUpdateDisplayName_92bac19c := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_92bac19c := TRUE;
  p_Encrypt_92bac19c := FALSE;
  p_AllowDecryptInAPI_92bac19c := FALSE;
  p_SendEncryptedValue_92bac19c := FALSE;
  p_IsSoftPrimaryKey_92bac19c := FALSE;
  p_IsSoftForeignKey_92bac19c := FALSE;
  p_JSONTypeIsArray_92bac19c := FALSE;
  p_UserSearchPredicateAPI_92bac19c := 'Contains';
  p_AutoUpdateUserSearchPredicate_92bac19c := TRUE;
  p_AutoUpdateFullTextSearch_92bac19c := TRUE;
  p_AutoUpdateExtendedType_92bac19c := TRUE;
  p_IsComputed_92bac19c := FALSE;
  p_ID_92bac19c := '646E4D6C-2A09-49E4-BBF5-E18A4D944DD2';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_92bac19c,
    'Description', p_Description_92bac19c,
    'AutoUpdateDescription', p_AutoUpdateDescription_92bac19c,
    'IsPrimaryKey', p_IsPrimaryKey_92bac19c,
    'IsUnique', p_IsUnique_92bac19c,
    'Category', p_Category_92bac19c,
    'ValueListType', p_ValueListType_92bac19c,
    'ExtendedType', p_ExtendedType_92bac19c,
    'CodeType', p_CodeType_92bac19c,
    'DefaultInView', p_DefaultInView_92bac19c,
    'ViewCellTemplate', p_ViewCellTemplate_92bac19c,
    'DefaultColumnWidth', p_DefaultColumnWidth_92bac19c,
    'AllowUpdateAPI', p_AllowUpdateAPI_92bac19c,
    'AllowUpdateInView', p_AllowUpdateInView_92bac19c,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_92bac19c,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_92bac19c,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_92bac19c,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_92bac19c,
    'GeneratedFormSection', p_GeneratedFormSection_92bac19c,
    'IsNameField', p_IsNameField_92bac19c,
    'RelatedEntityID', p_RelatedEntityID_92bac19c,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_92bac19c,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_92bac19c,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_92bac19c,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_92bac19c,
    'EntityIDFieldName', p_EntityIDFieldName_92bac19c,
    'ScopeDefault', p_ScopeDefault_92bac19c,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_92bac19c,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_92bac19c,
    'Status', p_Status_92bac19c,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_92bac19c,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_92bac19c,
    'AutoUpdateCategory', p_AutoUpdateCategory_92bac19c,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_92bac19c,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_92bac19c,
    'Encrypt', p_Encrypt_92bac19c,
    'EncryptionKeyID', p_EncryptionKeyID_92bac19c,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_92bac19c,
    'SendEncryptedValue', p_SendEncryptedValue_92bac19c,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_92bac19c,
    'IsSoftForeignKey', p_IsSoftForeignKey_92bac19c,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_92bac19c,
    'JSONType', p_JSONType_92bac19c,
    'JSONTypeIsArray', p_JSONTypeIsArray_92bac19c,
    'JSONTypeDefinition', p_JSONTypeDefinition_92bac19c,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_92bac19c,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_92bac19c,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_92bac19c,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_92bac19c,
    'IsComputed', p_IsComputed_92bac19c
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_92bac19c,
    'Configuration', p_Configuration_92bac19c,
    'ID', p_ID_92bac19c
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_92bac19c, p_Description := p_Description_92bac19c, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_92bac19c, p_IsPrimaryKey := p_IsPrimaryKey_92bac19c, p_IsUnique := p_IsUnique_92bac19c, p_Category := p_Category_92bac19c, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_92bac19c, p_ExtendedType := p_ExtendedType_92bac19c, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_92bac19c, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_92bac19c, p_ViewCellTemplate := p_ViewCellTemplate_92bac19c, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_92bac19c, p_AllowUpdateAPI := p_AllowUpdateAPI_92bac19c, p_AllowUpdateInView := p_AllowUpdateInView_92bac19c, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_92bac19c, p_FullTextSearchEnabled := p_FullTextSearchEnabled_92bac19c, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_92bac19c, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_92bac19c, p_GeneratedFormSection := p_GeneratedFormSection_92bac19c, p_IsNameField := p_IsNameField_92bac19c, p_RelatedEntityID := p_RelatedEntityID_92bac19c, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_92bac19c, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_92bac19c, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_92bac19c, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_92bac19c, p_EntityIDFieldName := p_EntityIDFieldName_92bac19c, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_92bac19c, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_92bac19c, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_92bac19c, p_Status := p_Status_92bac19c, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_92bac19c, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_92bac19c, p_AutoUpdateCategory := p_AutoUpdateCategory_92bac19c, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_92bac19c, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_92bac19c, p_Encrypt := p_Encrypt_92bac19c, p_EncryptionKeyID := p_EncryptionKeyID_92bac19c, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_92bac19c, p_SendEncryptedValue := p_SendEncryptedValue_92bac19c, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_92bac19c, p_IsSoftForeignKey := p_IsSoftForeignKey_92bac19c, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_92bac19c, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_92bac19c, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_92bac19c, p_JSONTypeDefinition := p_JSONTypeDefinition_92bac19c, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_92bac19c, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_92bac19c, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_92bac19c, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_92bac19c, p_IsComputed := p_IsComputed_92bac19c, p_EmbeddedRecord := p_EmbeddedRecord_92bac19c, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_92bac19c, p_Configuration_Clear := TRUE, p_ID := p_ID_92bac19c);
  END IF;
END $mj$;

-- Save MJ: Entity Fields (core SP call only)
DO $mj$
DECLARE
  p_DisplayName_5621e848 VARCHAR(255);
  p_Description_5621e848 TEXT;
  p_AutoUpdateDescription_5621e848 BOOLEAN;
  p_IsPrimaryKey_5621e848 BOOLEAN;
  p_IsUnique_5621e848 BOOLEAN;
  p_Category_5621e848 VARCHAR(255);
  p_ValueListType_5621e848 VARCHAR(20);
  p_ExtendedType_5621e848 VARCHAR(50);
  p_CodeType_5621e848 VARCHAR(50);
  p_DefaultInView_5621e848 BOOLEAN;
  p_ViewCellTemplate_5621e848 TEXT;
  p_DefaultColumnWidth_5621e848 INTEGER;
  p_AllowUpdateAPI_5621e848 BOOLEAN;
  p_AllowUpdateInView_5621e848 BOOLEAN;
  p_IncludeInUserSearchAPI_5621e848 BOOLEAN;
  p_FullTextSearchEnabled_5621e848 BOOLEAN;
  p_UserSearchParamFormatAPI_5621e848 VARCHAR(500);
  p_IncludeInGeneratedForm_5621e848 BOOLEAN;
  p_GeneratedFormSection_5621e848 VARCHAR(10);
  p_IsNameField_5621e848 BOOLEAN;
  p_RelatedEntityID_5621e848 UUID;
  p_RelatedEntityFieldName_5621e848 VARCHAR(255);
  p_IncludeRelatedEntityNameFieldInBaseView_5621e848 BOOLEAN;
  p_RelatedEntityNameFieldMap_5621e848 VARCHAR(255);
  p_RelatedEntityDisplayType_5621e848 VARCHAR(20);
  p_EntityIDFieldName_5621e848 VARCHAR(100);
  p_ScopeDefault_5621e848 VARCHAR(100);
  p_AutoUpdateRelatedEntityInfo_5621e848 BOOLEAN;
  p_ValuesToPackWithSchema_5621e848 VARCHAR(10);
  p_Status_5621e848 VARCHAR(25);
  p_AutoUpdateIsNameField_5621e848 BOOLEAN;
  p_AutoUpdateDefaultInView_5621e848 BOOLEAN;
  p_AutoUpdateCategory_5621e848 BOOLEAN;
  p_AutoUpdateDisplayName_5621e848 BOOLEAN;
  p_AutoUpdateIncludeInUserSearchAPI_5621e848 BOOLEAN;
  p_Encrypt_5621e848 BOOLEAN;
  p_EncryptionKeyID_5621e848 UUID;
  p_AllowDecryptInAPI_5621e848 BOOLEAN;
  p_SendEncryptedValue_5621e848 BOOLEAN;
  p_IsSoftPrimaryKey_5621e848 BOOLEAN;
  p_IsSoftForeignKey_5621e848 BOOLEAN;
  p_RelatedEntityJoinFields_5621e848 TEXT;
  p_JSONType_5621e848 VARCHAR(255);
  p_JSONTypeIsArray_5621e848 BOOLEAN;
  p_JSONTypeDefinition_5621e848 TEXT;
  p_UserSearchPredicateAPI_5621e848 VARCHAR(20);
  p_AutoUpdateUserSearchPredicate_5621e848 BOOLEAN;
  p_AutoUpdateFullTextSearch_5621e848 BOOLEAN;
  p_AutoUpdateExtendedType_5621e848 BOOLEAN;
  p_IsComputed_5621e848 BOOLEAN;
  p_EmbeddedRecord_5621e848 TEXT;
  p_Configuration_5621e848 TEXT;
  p_ID_5621e848 UUID;
BEGIN
  p_DisplayName_5621e848 := 'Next Step';
  p_AutoUpdateDescription_5621e848 := TRUE;
  p_IsPrimaryKey_5621e848 := FALSE;
  p_IsUnique_5621e848 := FALSE;
  p_ValueListType_5621e848 := 'None';
  p_DefaultInView_5621e848 := TRUE;
  p_DefaultColumnWidth_5621e848 := 150;
  p_AllowUpdateAPI_5621e848 := TRUE;
  p_AllowUpdateInView_5621e848 := TRUE;
  p_IncludeInUserSearchAPI_5621e848 := FALSE;
  p_FullTextSearchEnabled_5621e848 := FALSE;
  p_IncludeInGeneratedForm_5621e848 := TRUE;
  p_GeneratedFormSection_5621e848 := 'Details';
  p_IsNameField_5621e848 := FALSE;
  p_IncludeRelatedEntityNameFieldInBaseView_5621e848 := FALSE;
  p_RelatedEntityDisplayType_5621e848 := 'Search';
  p_AutoUpdateRelatedEntityInfo_5621e848 := TRUE;
  p_ValuesToPackWithSchema_5621e848 := 'Auto';
  p_Status_5621e848 := 'Active';
  p_AutoUpdateIsNameField_5621e848 := TRUE;
  p_AutoUpdateDefaultInView_5621e848 := TRUE;
  p_AutoUpdateCategory_5621e848 := TRUE;
  p_AutoUpdateDisplayName_5621e848 := TRUE;
  p_AutoUpdateIncludeInUserSearchAPI_5621e848 := TRUE;
  p_Encrypt_5621e848 := FALSE;
  p_AllowDecryptInAPI_5621e848 := FALSE;
  p_SendEncryptedValue_5621e848 := FALSE;
  p_IsSoftPrimaryKey_5621e848 := FALSE;
  p_IsSoftForeignKey_5621e848 := FALSE;
  p_JSONTypeIsArray_5621e848 := FALSE;
  p_UserSearchPredicateAPI_5621e848 := 'Contains';
  p_AutoUpdateUserSearchPredicate_5621e848 := TRUE;
  p_AutoUpdateFullTextSearch_5621e848 := TRUE;
  p_AutoUpdateExtendedType_5621e848 := TRUE;
  p_IsComputed_5621e848 := FALSE;
  p_ID_5621e848 := '4C449B35-EDD6-45D0-99C0-9D2A3C55BD66';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntityField'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_data := jsonb_build_object(
    'DisplayName', p_DisplayName_5621e848,
    'Description', p_Description_5621e848,
    'AutoUpdateDescription', p_AutoUpdateDescription_5621e848,
    'IsPrimaryKey', p_IsPrimaryKey_5621e848,
    'IsUnique', p_IsUnique_5621e848,
    'Category', p_Category_5621e848,
    'ValueListType', p_ValueListType_5621e848,
    'ExtendedType', p_ExtendedType_5621e848,
    'CodeType', p_CodeType_5621e848,
    'DefaultInView', p_DefaultInView_5621e848,
    'ViewCellTemplate', p_ViewCellTemplate_5621e848,
    'DefaultColumnWidth', p_DefaultColumnWidth_5621e848,
    'AllowUpdateAPI', p_AllowUpdateAPI_5621e848,
    'AllowUpdateInView', p_AllowUpdateInView_5621e848,
    'IncludeInUserSearchAPI', p_IncludeInUserSearchAPI_5621e848,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_5621e848,
    'UserSearchParamFormatAPI', p_UserSearchParamFormatAPI_5621e848,
    'IncludeInGeneratedForm', p_IncludeInGeneratedForm_5621e848,
    'GeneratedFormSection', p_GeneratedFormSection_5621e848,
    'IsNameField', p_IsNameField_5621e848,
    'RelatedEntityID', p_RelatedEntityID_5621e848,
    'RelatedEntityFieldName', p_RelatedEntityFieldName_5621e848,
    'IncludeRelatedEntityNameFieldInBaseView', p_IncludeRelatedEntityNameFieldInBaseView_5621e848,
    'RelatedEntityNameFieldMap', p_RelatedEntityNameFieldMap_5621e848,
    'RelatedEntityDisplayType', p_RelatedEntityDisplayType_5621e848,
    'EntityIDFieldName', p_EntityIDFieldName_5621e848,
    'ScopeDefault', p_ScopeDefault_5621e848,
    'AutoUpdateRelatedEntityInfo', p_AutoUpdateRelatedEntityInfo_5621e848,
    'ValuesToPackWithSchema', p_ValuesToPackWithSchema_5621e848,
    'Status', p_Status_5621e848,
    'AutoUpdateIsNameField', p_AutoUpdateIsNameField_5621e848,
    'AutoUpdateDefaultInView', p_AutoUpdateDefaultInView_5621e848,
    'AutoUpdateCategory', p_AutoUpdateCategory_5621e848,
    'AutoUpdateDisplayName', p_AutoUpdateDisplayName_5621e848,
    'AutoUpdateIncludeInUserSearchAPI', p_AutoUpdateIncludeInUserSearchAPI_5621e848,
    'Encrypt', p_Encrypt_5621e848,
    'EncryptionKeyID', p_EncryptionKeyID_5621e848,
    'AllowDecryptInAPI', p_AllowDecryptInAPI_5621e848,
    'SendEncryptedValue', p_SendEncryptedValue_5621e848,
    'IsSoftPrimaryKey', p_IsSoftPrimaryKey_5621e848,
    'IsSoftForeignKey', p_IsSoftForeignKey_5621e848,
    'RelatedEntityJoinFields', p_RelatedEntityJoinFields_5621e848,
    'JSONType', p_JSONType_5621e848,
    'JSONTypeIsArray', p_JSONTypeIsArray_5621e848,
    'JSONTypeDefinition', p_JSONTypeDefinition_5621e848,
    'UserSearchPredicateAPI', p_UserSearchPredicateAPI_5621e848,
    'AutoUpdateUserSearchPredicate', p_AutoUpdateUserSearchPredicate_5621e848,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_5621e848,
    'AutoUpdateExtendedType', p_AutoUpdateExtendedType_5621e848,
    'IsComputed', p_IsComputed_5621e848
  ) ||
  jsonb_build_object(
    'EmbeddedRecord', p_EmbeddedRecord_5621e848,
    'Configuration', p_Configuration_5621e848,
    'ID', p_ID_5621e848
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntityField"(p_DisplayName := p_DisplayName_5621e848, p_Description := p_Description_5621e848, p_Description_Clear := TRUE, p_AutoUpdateDescription := p_AutoUpdateDescription_5621e848, p_IsPrimaryKey := p_IsPrimaryKey_5621e848, p_IsUnique := p_IsUnique_5621e848, p_Category := p_Category_5621e848, p_Category_Clear := TRUE, p_ValueListType := p_ValueListType_5621e848, p_ExtendedType := p_ExtendedType_5621e848, p_ExtendedType_Clear := TRUE, p_CodeType := p_CodeType_5621e848, p_CodeType_Clear := TRUE, p_DefaultInView := p_DefaultInView_5621e848, p_ViewCellTemplate := p_ViewCellTemplate_5621e848, p_ViewCellTemplate_Clear := TRUE, p_DefaultColumnWidth := p_DefaultColumnWidth_5621e848, p_AllowUpdateAPI := p_AllowUpdateAPI_5621e848, p_AllowUpdateInView := p_AllowUpdateInView_5621e848, p_IncludeInUserSearchAPI := p_IncludeInUserSearchAPI_5621e848, p_FullTextSearchEnabled := p_FullTextSearchEnabled_5621e848, p_UserSearchParamFormatAPI := p_UserSearchParamFormatAPI_5621e848, p_UserSearchParamFormatAPI_Clear := TRUE, p_IncludeInGeneratedForm := p_IncludeInGeneratedForm_5621e848, p_GeneratedFormSection := p_GeneratedFormSection_5621e848, p_IsNameField := p_IsNameField_5621e848, p_RelatedEntityID := p_RelatedEntityID_5621e848, p_RelatedEntityID_Clear := TRUE, p_RelatedEntityFieldName := p_RelatedEntityFieldName_5621e848, p_RelatedEntityFieldName_Clear := TRUE, p_IncludeRelatedEntityNameFieldInBaseView := p_IncludeRelatedEntityNameFieldInBaseView_5621e848, p_RelatedEntityNameFieldMap := p_RelatedEntityNameFieldMap_5621e848, p_RelatedEntityNameFieldMap_Clear := TRUE, p_RelatedEntityDisplayType := p_RelatedEntityDisplayType_5621e848, p_EntityIDFieldName := p_EntityIDFieldName_5621e848, p_EntityIDFieldName_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_5621e848, p_ScopeDefault_Clear := TRUE, p_AutoUpdateRelatedEntityInfo := p_AutoUpdateRelatedEntityInfo_5621e848, p_ValuesToPackWithSchema := p_ValuesToPackWithSchema_5621e848, p_Status := p_Status_5621e848, p_AutoUpdateIsNameField := p_AutoUpdateIsNameField_5621e848, p_AutoUpdateDefaultInView := p_AutoUpdateDefaultInView_5621e848, p_AutoUpdateCategory := p_AutoUpdateCategory_5621e848, p_AutoUpdateDisplayName := p_AutoUpdateDisplayName_5621e848, p_AutoUpdateIncludeInUserSearchAPI := p_AutoUpdateIncludeInUserSearchAPI_5621e848, p_Encrypt := p_Encrypt_5621e848, p_EncryptionKeyID := p_EncryptionKeyID_5621e848, p_EncryptionKeyID_Clear := TRUE, p_AllowDecryptInAPI := p_AllowDecryptInAPI_5621e848, p_SendEncryptedValue := p_SendEncryptedValue_5621e848, p_IsSoftPrimaryKey := p_IsSoftPrimaryKey_5621e848, p_IsSoftForeignKey := p_IsSoftForeignKey_5621e848, p_RelatedEntityJoinFields := p_RelatedEntityJoinFields_5621e848, p_RelatedEntityJoinFields_Clear := TRUE, p_JSONType := p_JSONType_5621e848, p_JSONType_Clear := TRUE, p_JSONTypeIsArray := p_JSONTypeIsArray_5621e848, p_JSONTypeDefinition := p_JSONTypeDefinition_5621e848, p_JSONTypeDefinition_Clear := TRUE, p_UserSearchPredicateAPI := p_UserSearchPredicateAPI_5621e848, p_AutoUpdateUserSearchPredicate := p_AutoUpdateUserSearchPredicate_5621e848, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_5621e848, p_AutoUpdateExtendedType := p_AutoUpdateExtendedType_5621e848, p_IsComputed := p_IsComputed_5621e848, p_EmbeddedRecord := p_EmbeddedRecord_5621e848, p_EmbeddedRecord_Clear := TRUE, p_Configuration := p_Configuration_5621e848, p_Configuration_Clear := TRUE, p_ID := p_ID_5621e848);
  END IF;
END $mj$;

-- Save MJ: User Views (core SP call only)
DO $mj$
DECLARE
  p_ID_fc00be66 UUID;
  p_UserID_fc00be66 UUID;
  p_EntityID_fc00be66 UUID;
  p_Name_fc00be66 VARCHAR(100);
  p_Description_fc00be66 TEXT;
  p_CategoryID_fc00be66 UUID;
  p_IsShared_fc00be66 BOOLEAN;
  p_IsDefault_fc00be66 BOOLEAN;
  p_GridState_fc00be66 TEXT;
  p_FilterState_fc00be66 TEXT;
  p_CustomFilterState_fc00be66 BOOLEAN;
  p_SmartFilterEnabled_fc00be66 BOOLEAN;
  p_SmartFilterPrompt_fc00be66 TEXT;
  p_SmartFilterWhereClause_fc00be66 TEXT;
  p_SmartFilterExplanation_fc00be66 TEXT;
  p_WhereClause_fc00be66 TEXT;
  p_CustomWhereClause_fc00be66 BOOLEAN;
  p_SortState_fc00be66 TEXT;
  p_Thumbnail_fc00be66 TEXT;
  p_CardState_fc00be66 TEXT;
  p_DisplayState_fc00be66 TEXT;
  p_ViewTypeID_fc00be66 UUID;
BEGIN
  p_ID_fc00be66 := 'a11dea15-0001-4e71-b0a8-3f17c5e2d803';
  p_UserID_fc00be66 := 'ECAFCCEC-6A37-EF11-86D4-000D3A4E707E';
  p_EntityID_fc00be66 := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  p_Name_fc00be66 := 'Sales: Pipeline';
  p_Description_fc00be66 := 'Working columns for the deal pipeline: customer, stage, amount, probability, close, owner, forecast.';
  p_IsShared_fc00be66 := TRUE;
  p_IsDefault_fc00be66 := FALSE;
  p_GridState_fc00be66 := '{"sortSettings":[{"field":"ExpectedCloseDate","dir":"asc"}],"columnSettings":[{"Name":"Name","DisplayName":"Deal","orderIndex":0,"width":260,"pinned":"left"},{"Name":"DealNumber","DisplayName":"Number","orderIndex":1,"width":120},{"Name":"Account","DisplayName":"Customer","orderIndex":2,"width":180},{"Name":"Pipeline","DisplayName":"Pipeline","orderIndex":3,"width":140},{"Name":"PipelineStage","DisplayName":"Stage","orderIndex":4,"width":130},{"Name":"DealStatusType","DisplayName":"Status","orderIndex":5,"width":110,"format":{"type":"text","conditionalRules":[{"condition":"contains","value":"Won","style":{"color":"#047857","backgroundColor":"#d1fae5","bold":true}},{"condition":"contains","value":"Lost","style":{"color":"#b45309","backgroundColor":"#fef3c7"}},{"condition":"equals","value":"Open","style":{"color":"#1d4ed8","backgroundColor":"#dbeafe"}}]}},{"Name":"Amount","DisplayName":"Amount","orderIndex":6,"width":120,"format":{"type":"currency","currencyCode":"USD","decimals":0,"align":"right"}},{"Name":"Probability","DisplayName":"Prob","orderIndex":7,"width":80,"format":{"type":"number","decimals":0,"align":"right"}},{"Name":"ExpectedCloseDate","DisplayName":"Close","orderIndex":8,"width":120,"format":{"type":"date","dateFormat":"medium"}},{"Name":"OwnerEmployee","DisplayName":"Owner","orderIndex":9,"width":140},{"Name":"ForecastCategoryType","DisplayName":"Forecast","orderIndex":10,"width":130},{"Name":"NextStep","DisplayName":"Next step","orderIndex":11,"width":200}]}';
  p_FilterState_fc00be66 := '{"logic":"and","filters":[]}';
  p_CustomFilterState_fc00be66 := FALSE;
  p_SmartFilterEnabled_fc00be66 := FALSE;
  p_WhereClause_fc00be66 := '';
  p_CustomWhereClause_fc00be66 := FALSE;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateUserView'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spCreateUserView"(p_data := jsonb_build_object(
    'ID', p_ID_fc00be66,
    'UserID', p_UserID_fc00be66,
    'EntityID', p_EntityID_fc00be66,
    'Name', p_Name_fc00be66,
    'Description', p_Description_fc00be66,
    'CategoryID', p_CategoryID_fc00be66,
    'IsShared', p_IsShared_fc00be66,
    'IsDefault', p_IsDefault_fc00be66,
    'GridState', p_GridState_fc00be66,
    'FilterState', p_FilterState_fc00be66,
    'CustomFilterState', p_CustomFilterState_fc00be66,
    'SmartFilterEnabled', p_SmartFilterEnabled_fc00be66,
    'SmartFilterPrompt', p_SmartFilterPrompt_fc00be66,
    'SmartFilterWhereClause', p_SmartFilterWhereClause_fc00be66,
    'SmartFilterExplanation', p_SmartFilterExplanation_fc00be66,
    'WhereClause', p_WhereClause_fc00be66,
    'CustomWhereClause', p_CustomWhereClause_fc00be66,
    'SortState', p_SortState_fc00be66,
    'Thumbnail', p_Thumbnail_fc00be66,
    'CardState', p_CardState_fc00be66,
    'DisplayState', p_DisplayState_fc00be66,
    'ViewTypeID', p_ViewTypeID_fc00be66
  ));
  ELSE
    PERFORM "${mjSchema}"."spCreateUserView"(p_ID := p_ID_fc00be66, p_UserID := p_UserID_fc00be66, p_EntityID := p_EntityID_fc00be66, p_Name := p_Name_fc00be66, p_Description := p_Description_fc00be66, p_CategoryID := p_CategoryID_fc00be66, p_CategoryID_Clear := TRUE, p_IsShared := p_IsShared_fc00be66, p_IsDefault := p_IsDefault_fc00be66, p_GridState := p_GridState_fc00be66, p_FilterState := p_FilterState_fc00be66, p_CustomFilterState := p_CustomFilterState_fc00be66, p_SmartFilterEnabled := p_SmartFilterEnabled_fc00be66, p_SmartFilterPrompt := p_SmartFilterPrompt_fc00be66, p_SmartFilterPrompt_Clear := TRUE, p_SmartFilterWhereClause := p_SmartFilterWhereClause_fc00be66, p_SmartFilterWhereClause_Clear := TRUE, p_SmartFilterExplanation := p_SmartFilterExplanation_fc00be66, p_SmartFilterExplanation_Clear := TRUE, p_WhereClause := p_WhereClause_fc00be66, p_CustomWhereClause := p_CustomWhereClause_fc00be66, p_SortState := p_SortState_fc00be66, p_SortState_Clear := TRUE, p_Thumbnail := p_Thumbnail_fc00be66, p_Thumbnail_Clear := TRUE, p_CardState := p_CardState_fc00be66, p_CardState_Clear := TRUE, p_DisplayState := p_DisplayState_fc00be66, p_DisplayState_Clear := TRUE, p_ViewTypeID := p_ViewTypeID_fc00be66, p_ViewTypeID_Clear := TRUE);
  END IF;
END $mj$;

-- Save MJ: Entities (core SP call only)
DO $mj$
DECLARE
  p_ParentID_908cb0aa UUID;
  p_Name_908cb0aa VARCHAR(255);
  p_NameSuffix_908cb0aa VARCHAR(255);
  p_Description_908cb0aa TEXT;
  p_AutoUpdateDescription_908cb0aa BOOLEAN;
  p_BaseView_908cb0aa VARCHAR(255);
  p_BaseViewGenerated_908cb0aa BOOLEAN;
  p_VirtualEntity_908cb0aa BOOLEAN;
  p_TrackRecordChanges_908cb0aa BOOLEAN;
  p_AuditRecordAccess_908cb0aa BOOLEAN;
  p_AuditViewRuns_908cb0aa BOOLEAN;
  p_IncludeInAPI_908cb0aa BOOLEAN;
  p_AllowAllRowsAPI_908cb0aa BOOLEAN;
  p_AllowUpdateAPI_908cb0aa BOOLEAN;
  p_AllowCreateAPI_908cb0aa BOOLEAN;
  p_AllowDeleteAPI_908cb0aa BOOLEAN;
  p_CustomResolverAPI_908cb0aa BOOLEAN;
  p_AllowUserSearchAPI_908cb0aa BOOLEAN;
  p_FullTextSearchEnabled_908cb0aa BOOLEAN;
  p_FullTextCatalog_908cb0aa VARCHAR(255);
  p_FullTextCatalogGenerated_908cb0aa BOOLEAN;
  p_FullTextIndex_908cb0aa VARCHAR(255);
  p_FullTextIndexGenerated_908cb0aa BOOLEAN;
  p_FullTextSearchFunction_908cb0aa VARCHAR(255);
  p_FullTextSearchFunctionGenerated_908cb0aa BOOLEAN;
  p_UserViewMaxRows_908cb0aa INTEGER;
  p_spCreate_908cb0aa VARCHAR(255);
  p_spUpdate_908cb0aa VARCHAR(255);
  p_spDelete_908cb0aa VARCHAR(255);
  p_spCreateGenerated_908cb0aa BOOLEAN;
  p_spUpdateGenerated_908cb0aa BOOLEAN;
  p_spDeleteGenerated_908cb0aa BOOLEAN;
  p_CascadeDeletes_908cb0aa BOOLEAN;
  p_DeleteType_908cb0aa VARCHAR(10);
  p_AllowRecordMerge_908cb0aa BOOLEAN;
  p_spMatch_908cb0aa VARCHAR(255);
  p_RelationshipDefaultDisplayType_908cb0aa VARCHAR(20);
  p_UserFormGenerated_908cb0aa BOOLEAN;
  p_EntityObjectSubclassName_908cb0aa VARCHAR(255);
  p_EntityObjectSubclassImport_908cb0aa VARCHAR(255);
  p_PreferredCommunicationField_908cb0aa VARCHAR(255);
  p_Icon_908cb0aa VARCHAR(500);
  p_ScopeDefault_908cb0aa VARCHAR(100);
  p_RowsToPackWithSchema_908cb0aa VARCHAR(20);
  p_RowsToPackSampleMethod_908cb0aa VARCHAR(20);
  p_RowsToPackSampleCount_908cb0aa INTEGER;
  p_RowsToPackSampleOrder_908cb0aa TEXT;
  p_AutoRowCountFrequency_908cb0aa INTEGER;
  p_RowCount_908cb0aa BIGINT;
  p_RowCountRunAt_908cb0aa TIMESTAMPTZ;
  p_Status_908cb0aa VARCHAR(25);
  p_DisplayName_908cb0aa VARCHAR(255);
  p_AllowMultipleSubtypes_908cb0aa BOOLEAN;
  p_AutoUpdateFullTextSearch_908cb0aa BOOLEAN;
  p_AutoUpdateAllowUserSearchAPI_908cb0aa BOOLEAN;
  p_TrustServerCacheCompletely_908cb0aa BOOLEAN;
  p_SupportsGeoCoding_908cb0aa BOOLEAN;
  p_AutoUpdateSupportsGeoCoding_908cb0aa BOOLEAN;
  p_AllowCaching_908cb0aa BOOLEAN;
  p_DetectExternalChanges_908cb0aa BOOLEAN;
  p_ExternalDataSourceID_908cb0aa UUID;
  p_ExternalObjectName_908cb0aa VARCHAR(255);
  p_GeneratedBaseViewName_908cb0aa VARCHAR(255);
  p_AllowDirectSQLInsert_908cb0aa BOOLEAN;
  p_AllowDirectSQLUpdate_908cb0aa BOOLEAN;
  p_AllowDirectSQLDelete_908cb0aa BOOLEAN;
  p_Configuration_908cb0aa TEXT;
  p_ID_908cb0aa UUID;
BEGIN
  p_Name_908cb0aa := 'MJ_BizApps_Sales: Deals';
  p_Description_908cb0aa := 'A deal (opportunity). Amount is a CACHED answer from Orders.PreviewOrder carrying its own provenance, never a locally computed total — this app performs no pricing arithmetic of any kind. Closing a deal is a transaction that CREATES a contract and/or orders, not a notification that someone should.';
  p_AutoUpdateDescription_908cb0aa := TRUE;
  p_BaseView_908cb0aa := 'vwDeals';
  p_BaseViewGenerated_908cb0aa := TRUE;
  p_VirtualEntity_908cb0aa := FALSE;
  p_TrackRecordChanges_908cb0aa := TRUE;
  p_AuditRecordAccess_908cb0aa := FALSE;
  p_AuditViewRuns_908cb0aa := FALSE;
  p_IncludeInAPI_908cb0aa := TRUE;
  p_AllowAllRowsAPI_908cb0aa := FALSE;
  p_AllowUpdateAPI_908cb0aa := TRUE;
  p_AllowCreateAPI_908cb0aa := TRUE;
  p_AllowDeleteAPI_908cb0aa := TRUE;
  p_CustomResolverAPI_908cb0aa := FALSE;
  p_AllowUserSearchAPI_908cb0aa := TRUE;
  p_FullTextSearchEnabled_908cb0aa := FALSE;
  p_FullTextCatalogGenerated_908cb0aa := TRUE;
  p_FullTextIndexGenerated_908cb0aa := TRUE;
  p_FullTextSearchFunctionGenerated_908cb0aa := TRUE;
  p_UserViewMaxRows_908cb0aa := 1000;
  p_spCreateGenerated_908cb0aa := TRUE;
  p_spUpdateGenerated_908cb0aa := TRUE;
  p_spDeleteGenerated_908cb0aa := TRUE;
  p_CascadeDeletes_908cb0aa := FALSE;
  p_DeleteType_908cb0aa := 'Hard';
  p_AllowRecordMerge_908cb0aa := FALSE;
  p_RelationshipDefaultDisplayType_908cb0aa := 'Search';
  p_UserFormGenerated_908cb0aa := TRUE;
  p_RowsToPackWithSchema_908cb0aa := 'None';
  p_RowsToPackSampleMethod_908cb0aa := 'random';
  p_RowsToPackSampleCount_908cb0aa := 0;
  p_Status_908cb0aa := 'Active';
  p_DisplayName_908cb0aa := 'Deals';
  p_AllowMultipleSubtypes_908cb0aa := FALSE;
  p_AutoUpdateFullTextSearch_908cb0aa := TRUE;
  p_AutoUpdateAllowUserSearchAPI_908cb0aa := TRUE;
  p_TrustServerCacheCompletely_908cb0aa := TRUE;
  p_SupportsGeoCoding_908cb0aa := FALSE;
  p_AutoUpdateSupportsGeoCoding_908cb0aa := TRUE;
  p_AllowCaching_908cb0aa := FALSE;
  p_DetectExternalChanges_908cb0aa := FALSE;
  p_AllowDirectSQLInsert_908cb0aa := FALSE;
  p_AllowDirectSQLUpdate_908cb0aa := FALSE;
  p_AllowDirectSQLDelete_908cb0aa := FALSE;
  p_Configuration_908cb0aa := '{
  "UI": {
    "Form": {
      "Layout": "left-nav",
      "RelatedRolePolicy": "smart"
    }
  }
}';
  p_ID_908cb0aa := '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spUpdateEntity'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spUpdateEntity"(p_data := jsonb_build_object(
    'ParentID', p_ParentID_908cb0aa,
    'Name', p_Name_908cb0aa,
    'NameSuffix', p_NameSuffix_908cb0aa,
    'Description', p_Description_908cb0aa,
    'AutoUpdateDescription', p_AutoUpdateDescription_908cb0aa,
    'BaseView', p_BaseView_908cb0aa,
    'BaseViewGenerated', p_BaseViewGenerated_908cb0aa,
    'VirtualEntity', p_VirtualEntity_908cb0aa,
    'TrackRecordChanges', p_TrackRecordChanges_908cb0aa,
    'AuditRecordAccess', p_AuditRecordAccess_908cb0aa,
    'AuditViewRuns', p_AuditViewRuns_908cb0aa,
    'IncludeInAPI', p_IncludeInAPI_908cb0aa,
    'AllowAllRowsAPI', p_AllowAllRowsAPI_908cb0aa,
    'AllowUpdateAPI', p_AllowUpdateAPI_908cb0aa,
    'AllowCreateAPI', p_AllowCreateAPI_908cb0aa,
    'AllowDeleteAPI', p_AllowDeleteAPI_908cb0aa,
    'CustomResolverAPI', p_CustomResolverAPI_908cb0aa,
    'AllowUserSearchAPI', p_AllowUserSearchAPI_908cb0aa,
    'FullTextSearchEnabled', p_FullTextSearchEnabled_908cb0aa,
    'FullTextCatalog', p_FullTextCatalog_908cb0aa,
    'FullTextCatalogGenerated', p_FullTextCatalogGenerated_908cb0aa,
    'FullTextIndex', p_FullTextIndex_908cb0aa,
    'FullTextIndexGenerated', p_FullTextIndexGenerated_908cb0aa,
    'FullTextSearchFunction', p_FullTextSearchFunction_908cb0aa,
    'FullTextSearchFunctionGenerated', p_FullTextSearchFunctionGenerated_908cb0aa,
    'UserViewMaxRows', p_UserViewMaxRows_908cb0aa,
    'spCreate', p_spCreate_908cb0aa,
    'spUpdate', p_spUpdate_908cb0aa,
    'spDelete', p_spDelete_908cb0aa,
    'spCreateGenerated', p_spCreateGenerated_908cb0aa,
    'spUpdateGenerated', p_spUpdateGenerated_908cb0aa,
    'spDeleteGenerated', p_spDeleteGenerated_908cb0aa,
    'CascadeDeletes', p_CascadeDeletes_908cb0aa,
    'DeleteType', p_DeleteType_908cb0aa,
    'AllowRecordMerge', p_AllowRecordMerge_908cb0aa,
    'spMatch', p_spMatch_908cb0aa,
    'RelationshipDefaultDisplayType', p_RelationshipDefaultDisplayType_908cb0aa,
    'UserFormGenerated', p_UserFormGenerated_908cb0aa,
    'EntityObjectSubclassName', p_EntityObjectSubclassName_908cb0aa,
    'EntityObjectSubclassImport', p_EntityObjectSubclassImport_908cb0aa,
    'PreferredCommunicationField', p_PreferredCommunicationField_908cb0aa,
    'Icon', p_Icon_908cb0aa,
    'ScopeDefault', p_ScopeDefault_908cb0aa,
    'RowsToPackWithSchema', p_RowsToPackWithSchema_908cb0aa,
    'RowsToPackSampleMethod', p_RowsToPackSampleMethod_908cb0aa,
    'RowsToPackSampleCount', p_RowsToPackSampleCount_908cb0aa,
    'RowsToPackSampleOrder', p_RowsToPackSampleOrder_908cb0aa,
    'AutoRowCountFrequency', p_AutoRowCountFrequency_908cb0aa,
    'RowCount', p_RowCount_908cb0aa,
    'RowCountRunAt', p_RowCountRunAt_908cb0aa
  ) ||
  jsonb_build_object(
    'Status', p_Status_908cb0aa,
    'DisplayName', p_DisplayName_908cb0aa,
    'AllowMultipleSubtypes', p_AllowMultipleSubtypes_908cb0aa,
    'AutoUpdateFullTextSearch', p_AutoUpdateFullTextSearch_908cb0aa,
    'AutoUpdateAllowUserSearchAPI', p_AutoUpdateAllowUserSearchAPI_908cb0aa,
    'TrustServerCacheCompletely', p_TrustServerCacheCompletely_908cb0aa,
    'SupportsGeoCoding', p_SupportsGeoCoding_908cb0aa,
    'AutoUpdateSupportsGeoCoding', p_AutoUpdateSupportsGeoCoding_908cb0aa,
    'AllowCaching', p_AllowCaching_908cb0aa,
    'DetectExternalChanges', p_DetectExternalChanges_908cb0aa,
    'ExternalDataSourceID', p_ExternalDataSourceID_908cb0aa,
    'ExternalObjectName', p_ExternalObjectName_908cb0aa,
    'GeneratedBaseViewName', p_GeneratedBaseViewName_908cb0aa,
    'AllowDirectSQLInsert', p_AllowDirectSQLInsert_908cb0aa,
    'AllowDirectSQLUpdate', p_AllowDirectSQLUpdate_908cb0aa,
    'AllowDirectSQLDelete', p_AllowDirectSQLDelete_908cb0aa,
    'Configuration', p_Configuration_908cb0aa,
    'ID', p_ID_908cb0aa
  ));
  ELSE
    PERFORM "${mjSchema}"."spUpdateEntity"(p_ParentID := p_ParentID_908cb0aa, p_ParentID_Clear := TRUE, p_Name := p_Name_908cb0aa, p_NameSuffix := p_NameSuffix_908cb0aa, p_NameSuffix_Clear := TRUE, p_Description := p_Description_908cb0aa, p_AutoUpdateDescription := p_AutoUpdateDescription_908cb0aa, p_BaseView := p_BaseView_908cb0aa, p_BaseViewGenerated := p_BaseViewGenerated_908cb0aa, p_VirtualEntity := p_VirtualEntity_908cb0aa, p_TrackRecordChanges := p_TrackRecordChanges_908cb0aa, p_AuditRecordAccess := p_AuditRecordAccess_908cb0aa, p_AuditViewRuns := p_AuditViewRuns_908cb0aa, p_IncludeInAPI := p_IncludeInAPI_908cb0aa, p_AllowAllRowsAPI := p_AllowAllRowsAPI_908cb0aa, p_AllowUpdateAPI := p_AllowUpdateAPI_908cb0aa, p_AllowCreateAPI := p_AllowCreateAPI_908cb0aa, p_AllowDeleteAPI := p_AllowDeleteAPI_908cb0aa, p_CustomResolverAPI := p_CustomResolverAPI_908cb0aa, p_AllowUserSearchAPI := p_AllowUserSearchAPI_908cb0aa, p_FullTextSearchEnabled := p_FullTextSearchEnabled_908cb0aa, p_FullTextCatalog := p_FullTextCatalog_908cb0aa, p_FullTextCatalog_Clear := TRUE, p_FullTextCatalogGenerated := p_FullTextCatalogGenerated_908cb0aa, p_FullTextIndex := p_FullTextIndex_908cb0aa, p_FullTextIndex_Clear := TRUE, p_FullTextIndexGenerated := p_FullTextIndexGenerated_908cb0aa, p_FullTextSearchFunction := p_FullTextSearchFunction_908cb0aa, p_FullTextSearchFunction_Clear := TRUE, p_FullTextSearchFunctionGenerated := p_FullTextSearchFunctionGenerated_908cb0aa, p_UserViewMaxRows := p_UserViewMaxRows_908cb0aa, p_spCreate := p_spCreate_908cb0aa, p_spCreate_Clear := TRUE, p_spUpdate := p_spUpdate_908cb0aa, p_spUpdate_Clear := TRUE, p_spDelete := p_spDelete_908cb0aa, p_spDelete_Clear := TRUE, p_spCreateGenerated := p_spCreateGenerated_908cb0aa, p_spUpdateGenerated := p_spUpdateGenerated_908cb0aa, p_spDeleteGenerated := p_spDeleteGenerated_908cb0aa, p_CascadeDeletes := p_CascadeDeletes_908cb0aa, p_DeleteType := p_DeleteType_908cb0aa, p_AllowRecordMerge := p_AllowRecordMerge_908cb0aa, p_spMatch := p_spMatch_908cb0aa, p_spMatch_Clear := TRUE, p_RelationshipDefaultDisplayType := p_RelationshipDefaultDisplayType_908cb0aa, p_UserFormGenerated := p_UserFormGenerated_908cb0aa, p_EntityObjectSubclassName := p_EntityObjectSubclassName_908cb0aa, p_EntityObjectSubclassName_Clear := TRUE, p_EntityObjectSubclassImport := p_EntityObjectSubclassImport_908cb0aa, p_EntityObjectSubclassImport_Clear := TRUE, p_PreferredCommunicationField := p_PreferredCommunicationField_908cb0aa, p_PreferredCommunicationField_Clear := TRUE, p_Icon := p_Icon_908cb0aa, p_Icon_Clear := TRUE, p_ScopeDefault := p_ScopeDefault_908cb0aa, p_ScopeDefault_Clear := TRUE, p_RowsToPackWithSchema := p_RowsToPackWithSchema_908cb0aa, p_RowsToPackSampleMethod := p_RowsToPackSampleMethod_908cb0aa, p_RowsToPackSampleCount := p_RowsToPackSampleCount_908cb0aa, p_RowsToPackSampleOrder := p_RowsToPackSampleOrder_908cb0aa, p_RowsToPackSampleOrder_Clear := TRUE, p_AutoRowCountFrequency := p_AutoRowCountFrequency_908cb0aa, p_AutoRowCountFrequency_Clear := TRUE, p_RowCount := p_RowCount_908cb0aa, p_RowCount_Clear := TRUE, p_RowCountRunAt := p_RowCountRunAt_908cb0aa, p_RowCountRunAt_Clear := TRUE, p_Status := p_Status_908cb0aa, p_DisplayName := p_DisplayName_908cb0aa, p_AllowMultipleSubtypes := p_AllowMultipleSubtypes_908cb0aa, p_AutoUpdateFullTextSearch := p_AutoUpdateFullTextSearch_908cb0aa, p_AutoUpdateAllowUserSearchAPI := p_AutoUpdateAllowUserSearchAPI_908cb0aa, p_TrustServerCacheCompletely := p_TrustServerCacheCompletely_908cb0aa, p_SupportsGeoCoding := p_SupportsGeoCoding_908cb0aa, p_AutoUpdateSupportsGeoCoding := p_AutoUpdateSupportsGeoCoding_908cb0aa, p_AllowCaching := p_AllowCaching_908cb0aa, p_DetectExternalChanges := p_DetectExternalChanges_908cb0aa, p_ExternalDataSourceID := p_ExternalDataSourceID_908cb0aa, p_ExternalDataSourceID_Clear := TRUE, p_ExternalObjectName := p_ExternalObjectName_908cb0aa, p_ExternalObjectName_Clear := TRUE, p_GeneratedBaseViewName := p_GeneratedBaseViewName_908cb0aa, p_GeneratedBaseViewName_Clear := TRUE, p_AllowDirectSQLInsert := p_AllowDirectSQLInsert_908cb0aa, p_AllowDirectSQLUpdate := p_AllowDirectSQLUpdate_908cb0aa, p_AllowDirectSQLDelete := p_AllowDirectSQLDelete_908cb0aa, p_Configuration := p_Configuration_908cb0aa, p_ID := p_ID_908cb0aa);
  END IF;
END $mj$;

-- Delete MJ: Action Params (core SP call only)
DO $mj$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spDeleteActionParam'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spDeleteActionParam"(p_data := jsonb_build_object(
    'ID', '5A1E5000-0000-4000-8000-000000000102'
  ));
  ELSE
    PERFORM "${mjSchema}"."spDeleteActionParam"(p_ID := '5A1E5000-0000-4000-8000-000000000102');
  END IF;
END $mj$;

-- Delete MJ: Actions (core SP call only)
DO $mj$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spDeleteAction'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spDeleteAction"(p_data := jsonb_build_object(
    'ID', '5A1E5000-0000-4000-8000-000000000101'
  ));
  ELSE
    PERFORM "${mjSchema}"."spDeleteAction"(p_ID := '5A1E5000-0000-4000-8000-000000000101');
  END IF;
END $mj$;

-- Delete MJ: Scheduled Jobs (core SP call only)
DO $mj$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spDeleteScheduledJob'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spDeleteScheduledJob"(p_data := jsonb_build_object(
    'ID', '5A1E5000-0000-4000-8000-000000000201'
  ));
  ELSE
    PERFORM "${mjSchema}"."spDeleteScheduledJob"(p_ID := '5A1E5000-0000-4000-8000-000000000201');
  END IF;
END $mj$;
