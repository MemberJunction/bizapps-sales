-- =============================================================================================
-- PostgreSQL counterpart of V202611131630__v6.31.x__Metadata_Sync.sql
-- =============================================================================================
-- Same record, same values as the T-SQL file; see its header for what ships and why. The field's
-- ID is resolved by entity name + field name; nothing happens when the field is missing.
-- =============================================================================================

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
