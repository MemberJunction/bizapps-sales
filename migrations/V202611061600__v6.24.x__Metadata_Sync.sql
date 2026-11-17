-- =============================================================================================
-- BizApps Sales v6.24.x -- Metadata_Sync, second part
-- =============================================================================================
-- V202611061330 was generated before the change that adds the optional "Parties" input to the
-- "Log Deal Activity" action reached next. This file ships that one record, so the 6.24 release
-- carries every metadata change made since V202611061330. Written in the shape `mj sync push`
-- emits for an action param (as in V202608251930), with the values from
-- metadata/actions/.sales-activity-actions.json.
--
-- CREATED:
--   * Action param "Parties" (5A1E5000-...-000000000127) on "Log Deal Activity"
--     (5A1E5000-...-000000000121). Absent means the deal's account and primary contact are linked,
--     as before; present means exactly the listed people and organizations are linked.
-- =============================================================================================
-- Save MJ: Action Params (core SP call only)
DECLARE @ID_5a1e0127 UNIQUEIDENTIFIER,
@ActionID_5a1e0127 UNIQUEIDENTIFIER,
@Name_5a1e0127 NVARCHAR(255),
@DefaultValue_5a1e0127 NVARCHAR(MAX),
@Type_5a1e0127 NCHAR(10),
@ValueType_5a1e0127 NVARCHAR(30),
@IsArray_5a1e0127 BIT,
@Description_5a1e0127 NVARCHAR(MAX),
@IsRequired_5a1e0127 BIT,
@MediaModality_5a1e0127 NVARCHAR(20),
@LogValue_5a1e0127 BIT
SET
  @ID_5a1e0127 = '5A1E5000-0000-4000-8000-000000000127'
SET
  @ActionID_5a1e0127 = '5A1E5000-0000-4000-8000-000000000121'
SET
  @Name_5a1e0127 = N'Parties'
SET
  @Type_5a1e0127 = N'Input'
SET
  @ValueType_5a1e0127 = N'Scalar'
SET
  @IsArray_5a1e0127 = 0
SET
  @Description_5a1e0127 = N'Optional JSON list of people and organizations to link, each {"Kind": "Person" or "Organization", "RecordID": "<id>"}. When given, exactly these are linked as participants (up to 50) instead of the deal''s account and primary contact.'
SET
  @IsRequired_5a1e0127 = 0
SET
  @LogValue_5a1e0127 = 1
EXEC [${mjSchema}].spCreateActionParam @ID = @ID_5a1e0127,
  @ActionID = @ActionID_5a1e0127,
  @Name = @Name_5a1e0127,
  @DefaultValue = @DefaultValue_5a1e0127,
  @DefaultValue_Clear = 1,
  @Type = @Type_5a1e0127,
  @ValueType = @ValueType_5a1e0127,
  @IsArray = @IsArray_5a1e0127,
  @Description = @Description_5a1e0127,
  @IsRequired = @IsRequired_5a1e0127,
  @MediaModality = @MediaModality_5a1e0127,
  @MediaModality_Clear = 1,
  @LogValue = @LogValue_5a1e0127;

GO
