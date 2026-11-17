-- =============================================================================================
-- PostgreSQL counterpart of V202611061600__v6.24.x__Metadata_Sync.sql -- BizApps Sales v6.24.x
-- Metadata_Sync, second part
-- =============================================================================================
-- Same record, same values as the T-SQL file; see its header for what ships and why. Written in
-- the shape of the action-param blocks in V202610201332: a DO block that calls the core function
-- in whichever signature the host has (jsonb or named parameters).
-- =============================================================================================

SET standard_conforming_strings = on;

-- Save MJ: Action Params (core SP call only)
DO $mj$
DECLARE
  p_ActionID_5a1e0127 UUID;
  p_Name_5a1e0127 VARCHAR(255);
  p_DefaultValue_5a1e0127 TEXT;
  p_Type_5a1e0127 CHAR(10);
  p_ValueType_5a1e0127 VARCHAR(30);
  p_IsArray_5a1e0127 BOOLEAN;
  p_Description_5a1e0127 TEXT;
  p_IsRequired_5a1e0127 BOOLEAN;
  p_MediaModality_5a1e0127 VARCHAR(20);
  p_LogValue_5a1e0127 BOOLEAN;
  p_ID_5a1e0127 UUID;
BEGIN
  p_ActionID_5a1e0127 := '5A1E5000-0000-4000-8000-000000000121';
  p_Name_5a1e0127 := 'Parties';
  p_Type_5a1e0127 := 'Input';
  p_ValueType_5a1e0127 := 'Scalar';
  p_IsArray_5a1e0127 := FALSE;
  p_Description_5a1e0127 := 'Optional JSON list of people and organizations to link, each {"Kind": "Person" or "Organization", "RecordID": "<id>"}. When given, exactly these are linked as participants (up to 50) instead of the deal''s account and primary contact.';
  p_IsRequired_5a1e0127 := FALSE;
  p_LogValue_5a1e0127 := TRUE;
  p_ID_5a1e0127 := '5A1E5000-0000-4000-8000-000000000127';
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateActionParam'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spCreateActionParam"(p_data := jsonb_build_object(
    'ActionID', p_ActionID_5a1e0127,
    'Name', p_Name_5a1e0127,
    'DefaultValue', p_DefaultValue_5a1e0127,
    'Type', p_Type_5a1e0127,
    'ValueType', p_ValueType_5a1e0127,
    'IsArray', p_IsArray_5a1e0127,
    'Description', p_Description_5a1e0127,
    'IsRequired', p_IsRequired_5a1e0127,
    'MediaModality', p_MediaModality_5a1e0127,
    'LogValue', p_LogValue_5a1e0127,
    'ID', p_ID_5a1e0127
  ));
  ELSE
    PERFORM "${mjSchema}"."spCreateActionParam"(p_ActionID := p_ActionID_5a1e0127, p_Name := p_Name_5a1e0127, p_DefaultValue := p_DefaultValue_5a1e0127, p_DefaultValue_Clear := TRUE, p_Type := p_Type_5a1e0127, p_ValueType := p_ValueType_5a1e0127, p_IsArray := p_IsArray_5a1e0127, p_Description := p_Description_5a1e0127, p_IsRequired := p_IsRequired_5a1e0127, p_MediaModality := p_MediaModality_5a1e0127, p_MediaModality_Clear := TRUE, p_LogValue := p_LogValue_5a1e0127, p_ID := p_ID_5a1e0127);
  END IF;
END $mj$;
