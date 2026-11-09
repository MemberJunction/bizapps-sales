-- =============================================================================
-- Close-won tasks: stop shipping an assignee that does not exist, and let an
-- order review reach the approvals inbox (bc-aidp-next-golive#326).
-- =============================================================================
-- WHAT WENT WRONG. The seeded CloseWonPolicy on both pipelines routed every
-- close-won task to People id C0111111-0000-4000-A000-000000000004. That row is
-- created in exactly one place -- scripts/seed-demo-data.sh, where it is the demo's
-- PARTNER REP -- so a host that ran the demo seed worked and every other host did
-- not. On QA it never existed, so the Order Review and Contract Processing tasks carried
-- an assignee that is not a person. TaskAssignment.AssigneeRecordID is polymorphic,
-- so there is no foreign key and nothing refused the row -- the tasks read as
-- assigned while no queue held them, which is why the order review control never ran.
--
-- WHY NULL AND NOT A DIFFERENT PERSON. There is no internal finance person seeded
-- anywhere to point at: People holds customer contacts, and the go-live staff rows
-- arrive with #325. Per #320, approval and review tasks route to person records and
-- the people who hold each role are loaded per deployment -- so the assignee is
-- deployment configuration, and shipping ANY id here would be guessing. NULL is the
-- documented unconfigured state, and the service now reports an unrouted task as an
-- Issue on the close rather than silently routing it to nobody.
--
-- ONLY WHERE THE DEAD ID IS STILL THERE. A deployment that has already pointed this
-- at a real person must not be reset by an upgrade, so the UPDATE is filtered on the
-- placeholder rather than applied to every pipeline. That also makes it idempotent.
-- =============================================================================

UPDATE [__mj_BizAppsSales].[Pipeline]
   SET CloseWonPolicy = REPLACE(
           CloseWonPolicy,
           '"AssigneeRecordID": "C0111111-0000-4000-A000-000000000004"',
           '"AssigneeRecordID": null')
 WHERE CloseWonPolicy LIKE '%"AssigneeRecordID": "C0111111-0000-4000-A000-000000000004"%';
GO

-- =============================================================================
-- Order Review is an approval, so the approvals inbox should list it.
-- =============================================================================
-- bizapps-tasks 1.7.0 added TaskType.IsApproval, and its approvals inbox lists every
-- type carrying the flag instead of only the seeded Approval Request. Order Review is
-- a gate -- its own description calls it "the control on money leaving the building"
-- and #320 section 5 makes confirm wait on it -- so it belongs there. Contract
-- Processing is deliberately NOT flagged: it is work to do, not a decision to make,
-- and it reaches its owner through My Tasks once the assignee above is real.
--
-- WHY A DIRECT UPDATE RATHER THAN spUpdateTaskType. Every parameter on that procedure
-- is required, so calling it would mean restating every column of a sibling app's table
-- -- a set that changes between tasks versions. One column, named explicitly, does not.
--
-- GUARDED, AND IN DYNAMIC SQL. Sales runs standalone by design: a deployment without
-- bizapps-tasks never pushes metadata/task-types and has no TaskType table at all. A
-- static reference to a column that is not there fails at compile time for the whole
-- batch, even inside IF, so the statement is deferred until the guard has passed.
-- =============================================================================

IF COL_LENGTH('[__mj_BizAppsTasks].[TaskType]', 'IsApproval') IS NOT NULL
BEGIN
    EXEC(N'UPDATE [__mj_BizAppsTasks].[TaskType]
              SET IsApproval = 1
            WHERE Code = ''ORDER_REVIEW''
              AND IsApproval = 0;');
END
GO
