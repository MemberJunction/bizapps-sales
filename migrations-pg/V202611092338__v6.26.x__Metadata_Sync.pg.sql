-- =============================================================================================
-- PostgreSQL counterpart of V202611092338__v6.26.x__Metadata_Sync.sql
-- =============================================================================================
-- Same record, same values as the T-SQL file; see its header for what ships and why.
--
-- HOW IT WAS MADE: `mj sql-convert --from tsql --to postgres` (MJ CLI 6.2.1) on the T-SQL file. The
-- converter does not translate the lookup and guard the T-SQL file adds, so they are written here
-- from the T-SQL ones: SELECT TOP 1 ... becomes p_x := COALESCE((SELECT ... LIMIT 1), p_x), and the
-- IF NOT EXISTS guard wraps the call in IF ... THEN ... END IF. The create runs only when the host
-- has no HidePipelines row, so a host's value is never overwritten. Core references use ${mjSchema}.
-- =============================================================================================
-- Save MJ: Application Settings (core SP call only)
DO $mj$
DECLARE
  p_ID_a9e0d2665182 UUID;
  p_ApplicationID_a9e0d2665182 UUID;
  p_Name_a9e0d2665182 VARCHAR(100);
  p_Value_a9e0d2665182 TEXT;
  p_Comments_a9e0d2665182 TEXT;
BEGIN
  p_ID_a9e0d2665182 := '39E2F5E0-6FA2-44AC-BCCA-568C062C27CB';
  p_Name_a9e0d2665182 := 'HidePipelines';
  p_Value_a9e0d2665182 := 'false';
  p_Comments_a9e0d2665182 := '"true" runs every deal on its company''s default pipeline and hides pipelines across the Sales app: choosing a deal''s company chooses its pipeline, which the rep cannot change; the board and the stage card name companies instead of pipelines; and the Pipeline filter and column are gone. A company''s default pipeline is the first one linked to it: the pipeline marked IsDefault when it is linked, otherwise the lowest DisplayRank. "false" (the default) shows pipelines as before.';
  p_ApplicationID_a9e0d2665182 := COALESCE((SELECT "ID" FROM "${mjSchema}"."Application" WHERE "Name" = 'Sales' ORDER BY CASE WHEN "ID" = p_ApplicationID_a9e0d2665182 THEN 0 ELSE 1 END LIMIT 1), p_ApplicationID_a9e0d2665182);
  IF NOT EXISTS (SELECT 1 FROM "${mjSchema}"."ApplicationSetting"
                 WHERE "ID" = p_ID_a9e0d2665182
                    OR ("ApplicationID" = p_ApplicationID_a9e0d2665182 AND "Name" = p_Name_a9e0d2665182)) THEN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = '${mjSchema}' AND p.proname = 'spCreateApplicationSetting'
       AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
  ) THEN
    PERFORM "${mjSchema}"."spCreateApplicationSetting"(p_data := jsonb_build_object(
    'ID', p_ID_a9e0d2665182,
    'ApplicationID', p_ApplicationID_a9e0d2665182,
    'Name', p_Name_a9e0d2665182,
    'Value', p_Value_a9e0d2665182,
    'Comments', p_Comments_a9e0d2665182
  ));
  ELSE
    PERFORM "${mjSchema}"."spCreateApplicationSetting"(p_ID := p_ID_a9e0d2665182, p_ApplicationID := p_ApplicationID_a9e0d2665182, p_Name := p_Name_a9e0d2665182, p_Value := p_Value_a9e0d2665182, p_Comments := p_Comments_a9e0d2665182);
  END IF;
  END IF;
END $mj$;
