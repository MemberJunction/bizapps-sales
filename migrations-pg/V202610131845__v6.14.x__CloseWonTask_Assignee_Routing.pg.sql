-- =============================================================================================
-- PostgreSQL counterpart of V202610131845__v6.14.x__CloseWonTask_Assignee_Routing.sql
-- =============================================================================================
-- Same two statements, same order, same filters; see the T-SQL file's header for what the
-- defect was and why the assignee becomes NULL rather than a different person.
--
-- HOW IT DIFFERS FROM THE T-SQL FILE, AND ONLY HOW
--   * Identifiers are quoted, because this family's schema, table and column names are mixed
--     case and Postgres folds unquoted names to lower case.
--   * The T-SQL guard `COL_LENGTH(...) IS NOT NULL` becomes an information_schema lookup inside
--     a DO block. The reason for deferring the statement is the same in both dialects: a static
--     reference to a column that is not there fails when the statement is prepared, even on a
--     branch that never runs, so the UPDATE stays inside EXECUTE until the guard has passed.
--   * `IsApproval` is BIT in T-SQL and BOOLEAN here, so the values are TRUE/FALSE.
--
-- Both statements are filtered on the state they change, so re-running this file is a no-op.
-- =============================================================================================

SET standard_conforming_strings = on;

-- 1. Stop pointing the close-won tasks at a People row only the demo seed creates.
--    Filtered on the placeholder, so a deployment that already configured a real person keeps it.
UPDATE "__mj_BizAppsSales"."Pipeline"
   SET "CloseWonPolicy" = REPLACE(
           "CloseWonPolicy",
           '"AssigneeRecordID": "C0111111-0000-4000-A000-000000000004"',
           '"AssigneeRecordID": null')
 WHERE "CloseWonPolicy" LIKE '%"AssigneeRecordID": "C0111111-0000-4000-A000-000000000004"%';

-- 2. Order Review is an approval, so the approvals inbox should list it. Contract Processing is
--    deliberately not flagged -- it is work to do, not a decision to make.
--    Guarded because Sales runs standalone: a host without bizapps-tasks has no TaskType table.
DO $mj$
BEGIN
  IF EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = '__mj_BizAppsTasks'
         AND table_name   = 'TaskType'
         AND column_name  = 'IsApproval'
  ) THEN
    EXECUTE 'UPDATE "__mj_BizAppsTasks"."TaskType"
                SET "IsApproval" = TRUE
              WHERE "Code" = ''ORDER_REVIEW''
                AND "IsApproval" = FALSE';
  END IF;
END $mj$;
