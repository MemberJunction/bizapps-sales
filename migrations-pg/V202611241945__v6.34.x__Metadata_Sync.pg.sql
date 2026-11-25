-- =============================================================================================
-- PostgreSQL counterpart of V202611241945__v6.34.x__Metadata_Sync.sql
-- =============================================================================================
-- Same record, same value as the T-SQL file; see its header for what ships and why.
--
-- HOW IT WAS MADE: `mj sql-convert --from tsql --to postgres` (MJ CLI 6.2.1) on the push log's one
-- block. The update is then guarded as in the T-SQL file: it runs only while the task type still
-- holds the previous release's description. bizapps-tasks' schema stays literal
-- (__mj_BizAppsTasks, folded to lower case by PostgreSQL). String values are untouched.
-- =============================================================================================

-- Save MJ_BizApps_Tasks: Task Types (core SP call only)
DO $mj$
DECLARE
  p_Description_9af8036ee330 TEXT;
  p_ID_9af8036ee330 UUID;
BEGIN
  p_Description_9af8036ee330 := 'Process the contract a won deal created: upload the signed agreement in the contract''s Executed agreement section and mark it as the executed agreement (a file attached from the toolbar must also be marked), confirm the agreement version against what it cites, record the executed/effective/end dates, validate whether the template was modified, and move the contract to active.';
  p_ID_9af8036ee330 := '890C23F2-39D6-4075-8BA7-EC742A2D1CA8';
  -- Only while the task type still holds the description the previous release shipped: a host
  -- that edited it keeps its own.
  IF EXISTS (SELECT 1 FROM __mj_BizAppsTasks."TaskType"
             WHERE "ID" = p_ID_9af8036ee330 AND "Description" = 'Process the contract a won deal created: attach the executed document, confirm the agreement version against what it cites, record the executed/effective/end dates, validate whether the template was modified, and move the contract to active.') THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = '__mj_bizappstasks' AND p.proname = 'spUpdateTaskType'
         AND p.pronargs = 1 AND p.proargtypes[0] = 'jsonb'::regtype
    ) THEN
      PERFORM __mj_BizAppsTasks."spUpdateTaskType"(p_data := jsonb_build_object(
      'Description', p_Description_9af8036ee330,
      'ID', p_ID_9af8036ee330
    ));
    ELSE
      PERFORM __mj_BizAppsTasks."spUpdateTaskType"(p_Description := p_Description_9af8036ee330, p_ID := p_ID_9af8036ee330);
    END IF;
  END IF;
END $mj$;
