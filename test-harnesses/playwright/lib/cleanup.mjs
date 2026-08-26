#!/usr/bin/env node
/**
 * Delete every record this harness creates, in foreign-key order.
 *
 * WHY THIS IS SQL AND NOT MORE UI CLICKING. The CRUD spec proves deletion through the UI — that is its
 * job and it asserts it. But a spec that fails PART WAY leaves residue, and the next run then trips
 * over `UQ_Pipeline_Company_Code` and fails for a reason that has nothing to do with the code under
 * test. A guaranteed teardown that does not depend on the UI being healthy is what makes the harness
 * genuinely re-runnable, which B4 asks for.
 *
 * Safe by construction: it only ever touches rows whose Name starts with the loud PW-VERIFY prefix.
 * It cannot delete real data, and its deletes are ordered child-first so the FKs never block it.
 *
 * Usage:  node lib/cleanup.mjs [--quiet]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
/**
 * `PW-`, NOT `PW-VERIFY`.
 *
 * The teardown was keyed to `PW-VERIFY%` while the lifecycle specs name their deals `PW-LIFE-...`,
 * `PW-LOST-...` and `PW-KI20-...`. So the global sweep could not see three of the seven specs' rows,
 * and a failed run left real deals on the host — three of them, which is how the count came back 10
 * against a baseline of 7. Every prefix this harness uses begins `PW-`, and nothing a human would
 * name does.
 */
/**
 * EVERY harness prefix, not just this file's original one.
 *
 * It was `PW-VERIFY`, then `PW-`, and both were too narrow in the same way: specs written by other
 * sessions name their rows with their own tag. `70-activity-timeline`, `80-board-drag` and
 * `90-workspace-tab-state` all use `TS-<timestamp>`, so their deals were invisible to this sweep and
 * seven of them accumulated on the host across three runs.
 *
 * A prefix list rather than a wildcard: the point is that only rows a harness created are deletable, and
 * a pattern loose enough to catch anything would eventually catch a real deal.
 *
 * ── THE LIST IS DERIVED FROM THE SPECS, NOT GUESSED ────────────────────────────────────────────────
 *
 * Every tag was collected by grepping the specs for their own `RUN`/`RUN_TAG` constants, which turned up
 * SIX distinct prefixes where this file had two: `PW-`, `TS-`, `BD-`, `AT-`, `CL-`, `RT-`. Each addition
 * so far has been discovered the same way — by finding rows left on the host — so the grep is the
 * maintenance instruction:
 *
 *     grep -rhoE "const RUN(_TAG)? = .[A-Za-z-]+" test-harnesses/playwright/specs/*.ts
 *
 * A spec that invents a seventh tag and does not add it here leaks silently, which is why the sweep
 * REPORTS its remaining counts rather than just running.
 */
const PREFIXES = ['PW-', 'TS-', 'BD-', 'AT-', 'CL-', 'RT-'];
const PREFIX = PREFIXES.join('/');
const quiet = process.argv.includes('--quiet');

/** Read the repo-root .env without adding a dotenv dependency to the harness. */
function readEnv() {
  const raw = readFileSync(path.join(REPO_ROOT, '.env'), 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (m) out[m[1]] = m[2];
  }
  /**
   * process.env WINS over the file, and that is the whole point.
   *
   * This returned the FILE only. On a multi-database machine .env names one database -- here
   * MJ_V6_Host, the recording host -- so DB_DATABASE=<other> node cleanup.mjs swept a database
   * nobody was testing, found nothing, and reported success. Every run left its deals behind on
   * the database under test and the next run inherited them.
   *
   * Measured 2026-08-26: 14 residue deals before, cleanup reports remaining_deals=0, 14 after.
   * Two identical full suites scored 26/2 then 23/5, differing only in how dirty they started.
   * lib/db.ts already gets this right via dotenv, and its header says the assertions only mean
   * something when harness and app share a database. The teardown was the piece not honouring it.
   */
  for (const k of ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE']) {
    if (process.env[k]) out[k] = process.env[k];
  }
  return out;
}

/**
 * Child-first order. DealTeamMember / DealStageEvent / DealContactRole / DealPaymentSchedule all
 * reference Deal; Deal references Pipeline; PipelineStage references Pipeline. Deleting a parent first
 * would be refused by the very foreign keys the S1 baseline put there on purpose.
 *
 * ── THIS SCRIPT HAD NOT RUN AT ALL, AND SAID SO IN A LINE NOBODY READ ───────────────────────────────
 *
 * Its first statement deleted from `__mj_BizAppsSales.DealLine`, a table RETIRED when the deal stopped
 * holding lines (S-US4 -- lines belong to the embedded order). With `-b`, sqlcmd aborts on the first
 * error, so every delete below it was unreachable. The `catch` then reported
 * `cleanup(PW-VERIFY*): SKIPPED` and returned true-ish silence, deliberately never failing a run over
 * teardown -- which is the right policy and is exactly why a broken teardown could hide for a phase.
 *
 * Three things were wrong once it could run at all:
 *
 *   1. `DealLine` does not exist. Removed.
 *   2. `DealPaymentSchedule` was never listed, and the workspace creates instalments. Residue.
 *   3. **Every deal now provisions an EMBEDDED ORDER inside `DealEntityServer.Save()`**, in the
 *      `__mj_BizAppsOrders` schema, which this script had no reason to know about when it was written.
 *      A harness deal leaves an OrderHeader and its lines behind forever. `Deal.OrderID` points AT the
 *      order, so the order can only be deleted after the deal -- the ids are captured into a table
 *      variable first, because after the delete there is nothing left to join to.
 *
 * Still safe by construction: every statement is keyed to the loud PW-VERIFY name prefix, and the order
 * deletes are restricted to ids captured from those same rows.
 */
const SQL = `
SET NOCOUNT ON;
/*
 * ONE PATTERN TABLE, UNANCHORED. There were two: @pfx as N'PW-%' and @inner as N'%PW-%'. The anchored
 * one is gone because nothing should use it -- the specs put the prefix in the MIDDLE of a name
 * ("Workspace smoke PW-...", "Close CL-... won"), so anchoring matched nothing and the sweep reported
 * success over 30 surviving deals. Leaving @pfx declared-but-unused would invite somebody to reach for
 * the wrong one again.
 *
 * A table variable rather than N parameters, so the list length is not baked into the SQL.
 */
DECLARE @inner TABLE (P NVARCHAR(50) PRIMARY KEY);
INSERT INTO @inner (P) VALUES ${PREFIXES.map((x) => `(N'%${x}%')`).join(', ')};

/*
 * ── THE SEEDED SET, EXCLUDED EXPLICITLY, BECAUSE THE PATTERN BELOW IS UNANCHORED ────────────────
 *
 * Matching a prefix anywhere in the name is what makes this sweep work at all -- the specs name deals
 * "Workspace smoke PW-...", "Round trip RT-...", "Close CL-... won", so the prefix sits in the MIDDLE
 * and an anchored LIKE 'PW-%' matched none of them. That is why the host reached 37 deals and 87
 * orders while the sweep reported remaining_deals=0 on every run.
 *
 * But unanchored matching is sharp in both directions. %RT-% also matches SMART-, PART-, ALERT-;
 * %CL-% matches CYCL-. On a shared dev host that is somebody's real deal, deleted silently by a
 * cleanup step nobody was watching.
 *
 * So the demo set is named and excluded rather than trusted to not collide. DEAL-90% is the seeded
 * range and it is stable -- these are the seven rows every measurement in docs/DEMO-INVENTORY.md is
 * counted against. Belt and braces with the print below: the exclusion stops the known-precious rows,
 * and the print lets a human stop the unknown ones.
 */
DECLARE @keep TABLE (ID UNIQUEIDENTIFIER PRIMARY KEY);
INSERT INTO @keep (ID)
  SELECT ID FROM __mj_BizAppsSales.Deal WHERE DealNumber LIKE 'DEAL-90%';

/* ── EVERYTHING IS CAPTURED BEFORE ANYTHING IS DELETED ──────────────────────────────────────────
 *
 * Deals, pipelines and orders are findable by prefix. Tasks, contracts and activities are NOT: they
 * carry no prefix of their own and are reachable only THROUGH the deal that raised them. Sweeping in
 * source order therefore deleted the deal first and then had nothing left to follow, which is why every
 * Explorer run leaked two tasks and two contracts.
 *
 * So the order is inverted: collect ids while the links still exist, then delete children before
 * parents. Every DELETE below is keyed to an id captured here, never to a live join.
 */
DECLARE @deals TABLE (ID UNIQUEIDENTIFIER PRIMARY KEY);
INSERT INTO @deals (ID)
  SELECT ID FROM __mj_BizAppsSales.Deal
   WHERE EXISTS (SELECT 1 FROM @inner WHERE Name LIKE P)
     AND ID NOT IN (SELECT ID FROM @keep);

/*
 * NAMED BEFORE DELETED, not counted after.
 *
 * A count printed afterwards cannot be second-guessed: "12 deals removed" is unreviewable, and if one
 * of them was a human's SMART- or CYCL- deal nobody will ever know. The names go to stdout first, so a
 * person reading the run output can see what went and challenge it.
 */
SELECT 'will_delete: ' + LEFT(Name, 70) FROM __mj_BizAppsSales.Deal d
  JOIN @deals x ON x.ID = d.ID ORDER BY Name;

-- Deal.OrderID is the only link to the provisioned order, and it dies with the deal row.
DECLARE @orders TABLE (ID UNIQUEIDENTIFIER PRIMARY KEY);
INSERT INTO @orders (ID)
  SELECT DISTINCT d.OrderID FROM __mj_BizAppsSales.Deal d
    JOIN @deals x ON x.ID = d.ID WHERE d.OrderID IS NOT NULL;

/*
 * THE EXPLORER TABS THAT POINT AT WHAT WE ARE ABOUT TO DELETE.
 *
 * Captured HERE, with @orders, for the same reason: once the rows are gone their names are gone, and the
 * only thing left tying a stale tab to this harness is an ID nothing can attribute any more.
 *
 * Measured, and it cost most of one measurement run. Deleting a harness Pipeline leaves the row gone and
 * __mj.Workspace.Configuration still holding a restored TAB naming it. Explorer rebuilds those tabs on
 * every page load, the load fails, and the shell emits
 *
 *   Error in BaseEntity.Load(MJ_BizApps_Sales: Pipelines, Key: ID=the-deleted-id)
 *
 * on EVERY navigation, for the rest of that host's life. Five specs assert a clean console and all five
 * failed on it -- 70-lifecycle, 73-lock-across-tabs, 75-dashboard, 79-embedded-order-refresh and
 * 80-board-drag's first test -- not one of them for a reason of its own. One orphaned tab, five red
 * specs, and a product behaving correctly throughout.
 *
 * closeRestoredRecordTabs() cannot prevent it: it closes tabs through the UI, and the error is emitted
 * during restore, before any of it is reachable. Only two specs call it in any case.
 */
DECLARE @doomed TABLE (ID UNIQUEIDENTIFIER PRIMARY KEY);
INSERT INTO @doomed (ID)
  SELECT ID FROM @deals                                     -- already unanchored and keep-filtered
  UNION
  SELECT ID FROM __mj_BizAppsSales.Pipeline
   WHERE EXISTS (SELECT 1 FROM @inner WHERE Name LIKE P);

/*
 * The four DealPaymentSchedule / DealTeamMember / DealStageEvent / DealContactRole deletes that
 * used to sit here are GONE, not lost. They ran the same four deletes as the block further down,
 * filtered by prefix through a live join instead of by captured id -- and the comment above @deals
 * states the rule they broke: every DELETE is keyed to an id captured up front, never to a live
 * join. Running them here also put them BEFORE the task and contract capture, which is the wrong
 * side of the child-first ordering this file depends on.
 */

DECLARE @dealEntity UNIQUEIDENTIFIER =
  (SELECT TOP 1 ID FROM __mj.Entity WHERE Name = 'MJ_BizApps_Sales: Deals');

/* CONTRACTS — two routes, and the second is not optional.
 *
 *   1. Contract.CreatingRecordID names the deal that raised it. That is the principled route and it
 *      works for anything a completed run created.
 *   2. Residue from runs that swept BEFORE this fix: their deal is already gone, so route 1 finds
 *      nothing and the row is unreachable forever. A contract whose CreatingEntityID is the Deal entity
 *      and whose CreatingRecordID matches no surviving deal is, on this host, exactly that residue --
 *      the only thing that deletes deals here is this sweep.
 */
DECLARE @contracts TABLE (ID UNIQUEIDENTIFIER PRIMARY KEY);
IF OBJECT_ID('__mj_BizAppsContracts.Contract', 'U') IS NOT NULL
BEGIN
INSERT INTO @contracts (ID)
  SELECT DISTINCT c.ID FROM __mj_BizAppsContracts.Contract c
    JOIN @deals d ON d.ID = c.CreatingRecordID
  UNION
  SELECT c.ID FROM __mj_BizAppsContracts.Contract c
   WHERE c.CreatingEntityID = @dealEntity
     AND NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Deal d WHERE d.ID = c.CreatingRecordID);
END;

/* TASKS — three routes.
 *
 *   1. TaskLink pointing at a harness deal, its order, or a contract captured above.
 *   2. The task NAME. CloseWonTaskService names a task after the deal it came from -- "Review order for
 *      PW-LIFE-xxxx lifecycle" -- which is the whole point of WT15, and it means the harness prefix
 *      travels INSIDE the name. This is what makes an already-orphaned task reachable at all: the four
 *      leaked rows on this host had NO TaskLink whatsoever, so route 1 could never have found them.
 *   3. Nothing else. A task with neither a link nor a name mentioning a harness deal is not ours.
 *
 * Route 2 matches the prefix anywhere in the string rather than anchored, which is wider than the deal
 * sweep. Acceptable because these six prefixes are declared in this file as harness-only and this runs
 * against a development host -- but it IS wider, and that is said here rather than discovered later.
 */
DECLARE @tasks TABLE (ID UNIQUEIDENTIFIER PRIMARY KEY);
INSERT INTO @tasks (ID)
  SELECT DISTINCT tl.TaskID FROM __mj_BizAppsTasks.TaskLink tl
   WHERE TRY_CONVERT(UNIQUEIDENTIFIER, tl.RecordID) IN (
           SELECT ID FROM @deals UNION SELECT ID FROM @orders UNION SELECT ID FROM @contracts)
  UNION
  SELECT t.ID FROM __mj_BizAppsTasks.Task t
   WHERE EXISTS (SELECT 1 FROM @inner WHERE t.Name LIKE P)
  UNION
  /*
   * RESIDUE FROM AN EARLIER RUN -- a task whose TaskLink names a Deal row that is already gone.
   *
   * Neither route above reaches it: the link's RecordID is not in @deals because the deal no longer
   * exists, and a task raised for a deal whose name did not carry a harness prefix has no prefix of its
   * own either. Same shape as the second @contracts route, added for the same reason -- the residue
   * counter now detects this class, so the sweep has to be able to clean it.
   */
  SELECT DISTINCT tl.TaskID FROM __mj_BizAppsTasks.TaskLink tl
   WHERE tl.EntityID = @dealEntity
     AND NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Deal d
                      WHERE d.ID = TRY_CONVERT(UNIQUEIDENTIFIER, tl.RecordID));

/* ACTIVITIES — ActivityLink carries the Regarding link to the deal, and dies with it. */
DECLARE @acts TABLE (ID UNIQUEIDENTIFIER PRIMARY KEY);
INSERT INTO @acts (ID)
  SELECT DISTINCT al.ActivityID FROM __mj_BizAppsCommon.ActivityLink al
   WHERE TRY_CONVERT(UNIQUEIDENTIFIER, al.RecordID) IN (SELECT ID FROM @deals)
  UNION
  /*
   * RESIDUE FROM AN EARLIER RUN, the same second route @contracts already has.
   *
   * An activity linked to a deal THIS run is deleting is caught above. An activity linked to a deal a
   * PREVIOUS run already deleted is caught by nothing: its deal is not in @deals because the row is
   * gone. It is unreachable forever, and it is one of the leak classes the header block names.
   *
   * Added because the residue counter at the bottom now detects exactly this. A detector that reports
   * a leak the sweep cannot clean would fail every run from then on -- the capture and the check have
   * to cover the same class, by different routes.
   */
  SELECT DISTINCT al.ActivityID FROM __mj_BizAppsCommon.ActivityLink al
   WHERE al.EntityID = @dealEntity
     AND NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Deal d
                      WHERE d.ID = TRY_CONVERT(UNIQUEIDENTIFIER, al.RecordID));

/* ── DELETE: CHILDREN BEFORE PARENTS, ALWAYS ────────────────────────────────────────────────────
 *
 * A delete that reports rows and changes nothing is the failure mode here: an earlier attempt reported
 * four rows and left all four, because TaskActivity has to go before Task and the count printed was of
 * rows the statement MATCHED, not rows it removed. Every parent below has its children deleted first,
 * and the remaining_* counts at the bottom are read from the table afterwards rather than from @@ROWCOUNT.
 */
DELETE td FROM __mj_BizAppsTasks.TaskDecision td JOIN @tasks t ON td.TaskID = t.ID;
DELETE ta FROM __mj_BizAppsTasks.TaskActivity ta JOIN @tasks t ON ta.TaskID = t.ID;
DELETE tc FROM __mj_BizAppsTasks.TaskComment tc JOIN @tasks t ON tc.TaskID = t.ID;
DELETE tn FROM __mj_BizAppsTasks.TaskNotificationLog tn JOIN @tasks t ON tn.TaskID = t.ID;
DELETE tg FROM __mj_BizAppsTasks.TaskTagLink tg JOIN @tasks t ON tg.TaskID = t.ID;
DELETE tl FROM __mj_BizAppsTasks.TaskLink tl JOIN @tasks t ON tl.TaskID = t.ID;
-- Both ends of the dependency, or a surviving row on either side blocks the parent.
DELETE dp FROM __mj_BizAppsTasks.TaskDependency dp JOIN @tasks t ON dp.TaskID = t.ID;
DELETE dp FROM __mj_BizAppsTasks.TaskDependency dp JOIN @tasks t ON dp.DependsOnTaskID = t.ID;
DELETE ta FROM __mj_BizAppsTasks.TaskAssignment ta JOIN @tasks t ON ta.TaskID = t.ID;
-- Task.ParentID is a self-reference: break it before deleting, or the parent blocks its own child.
UPDATE t SET ParentID = NULL FROM __mj_BizAppsTasks.Task t JOIN @tasks x ON x.ID = t.ID WHERE t.ParentID IS NOT NULL;
DELETE t FROM __mj_BizAppsTasks.Task t JOIN @tasks x ON x.ID = t.ID;

DELETE af FROM __mj_BizAppsCommon.ActivityFile af JOIN @acts a ON af.ActivityID = a.ID;
DELETE al FROM __mj_BizAppsCommon.ActivityLink al JOIN @acts a ON al.ActivityID = a.ID;
UPDATE a SET ParentActivityID = NULL FROM __mj_BizAppsCommon.Activity a JOIN @acts x ON x.ID = a.ID WHERE a.ParentActivityID IS NOT NULL;
DELETE a FROM __mj_BizAppsCommon.Activity a JOIN @acts x ON x.ID = a.ID;

IF OBJECT_ID('__mj_BizAppsContracts.Contract', 'U') IS NOT NULL
DELETE m FROM __mj_BizAppsContracts.ContractTemplateModification m JOIN @contracts c ON m.ContractID = c.ID;
-- Contracts point at each other two ways; both must be broken before the rows go.
IF OBJECT_ID('__mj_BizAppsContracts.Contract', 'U') IS NOT NULL
UPDATE c SET ParentContractID = NULL FROM __mj_BizAppsContracts.Contract c JOIN @contracts x ON x.ID = c.ID WHERE c.ParentContractID IS NOT NULL;
IF OBJECT_ID('__mj_BizAppsContracts.Contract', 'U') IS NOT NULL
UPDATE c SET SupersededByContractID = NULL FROM __mj_BizAppsContracts.Contract c JOIN @contracts x ON x.ID = c.ID WHERE c.SupersededByContractID IS NOT NULL;
IF OBJECT_ID('__mj_BizAppsContracts.Contract', 'U') IS NOT NULL
DELETE c FROM __mj_BizAppsContracts.Contract c JOIN @contracts x ON x.ID = c.ID;

DELETE ps FROM __mj_BizAppsSales.DealPaymentSchedule ps JOIN @deals d ON ps.DealID = d.ID;
DELETE tm FROM __mj_BizAppsSales.DealTeamMember tm JOIN @deals d ON tm.DealID = d.ID;
DELETE se FROM __mj_BizAppsSales.DealStageEvent se JOIN @deals d ON se.DealID = d.ID;
DELETE cr FROM __mj_BizAppsSales.DealContactRole cr JOIN @deals d ON cr.DealID = d.ID;

/*
 * AUDIT ROWS GO WITH THE RECORDS THEY DESCRIBE.
 *
 * RecordID IS NOT A BARE UUID. MJ writes it as a composite key -- ID pipe uuid -- on some paths and
 * bare on others, in the same table. Matching only the bare form cleared 11 rows and left 3, and the
 * demo tour kept failing on the ones that stayed. Both forms are matched.
 *
 * RecordChange is written by BaseEntity.Save() and keyed by RecordID as text. Deleting a deal or a
 * pipeline left its audit rows behind pointing at nothing, and Explorer FOLLOWS them: the demo tour
 * loads the referenced record and logs
 *
 *     Error in BaseEntity.Load(MJ_BizApps_Sales: Pipelines, Key: ID=<gone>)
 *
 * which fails 20-demo-tour on console errors, for records this sweep deleted. Measured 2026-08-26:
 * 4 orphaned pipeline rows and 257 orphaned deal rows after a clean run.
 *
 * CLI-2 recorded this as the cause of the orphaned-tab thread and left it open: the sweep should not
 * delete rows the app still points at. This is that fix, scoped to exactly what the sweep removes --
 * it never touches audit history for records that survive.
 */
DELETE rc FROM [__mj].RecordChange rc
  JOIN @deals x ON rc.RecordID IN (CAST(x.ID AS NVARCHAR(750)), 'ID|' + CAST(x.ID AS NVARCHAR(750)));

DELETE d FROM __mj_BizAppsSales.Deal d JOIN @deals x ON x.ID = d.ID;

/*
 * Pipeline IDs are captured BEFORE the delete, the same way @deals is, because the record-log cleanup
 * below needs to know what was removed and the rows are gone by then.
 */
DECLARE @pipes TABLE (ID UNIQUEIDENTIFIER PRIMARY KEY);
INSERT INTO @pipes (ID)
  SELECT ID FROM __mj_BizAppsSales.Pipeline WHERE EXISTS (SELECT 1 FROM @inner WHERE Name LIKE P);

DELETE ps FROM __mj_BizAppsSales.PipelineStage ps
  JOIN __mj_BizAppsSales.Pipeline p ON ps.PipelineID = p.ID WHERE EXISTS (SELECT 1 FROM @inner WHERE p.Name LIKE P);
-- Same for pipelines: capture the ids first, drop their audit rows, then the rows themselves.
DECLARE @pipeIds TABLE (ID UNIQUEIDENTIFIER PRIMARY KEY);
INSERT INTO @pipeIds (ID)
  SELECT ID FROM __mj_BizAppsSales.Pipeline WHERE EXISTS (SELECT 1 FROM @inner WHERE Name LIKE P);
DELETE rc FROM [__mj].RecordChange rc
  JOIN @pipeIds x ON rc.RecordID IN (CAST(x.ID AS NVARCHAR(750)), 'ID|' + CAST(x.ID AS NVARCHAR(750)));

DELETE FROM __mj_BizAppsSales.Pipeline WHERE EXISTS (SELECT 1 FROM @inner WHERE Name LIKE P);

/*
 * AND ANY AUDIT ROW LEFT POINTING AT A SALES RECORD THAT NO LONGER EXISTS.
 *
 * The scoped deletes above only cover what THIS sweep removes. Specs also delete their own deals and
 * pipelines through PurgeDeal, and those rows are already orphaned by the time the sweep runs -- the
 * name match finds nothing, because the record it would have matched is gone. Explorer still follows
 * them, and 20-demo-tour still fails on the console error.
 *
 * So this is a general orphan clean, restricted to sales entities. It cannot touch history for a
 * record that still exists, which is the only property that matters.
 *
 * RecordID is matched in BOTH forms: MJ writes it bare on some paths and as a composite key on
 * others, in the same table.
 */
DELETE rc FROM [__mj].RecordChange rc
  JOIN [__mj].Entity e ON e.ID = rc.EntityID
 WHERE e.Name IN ('MJ_BizApps_Sales: Deals', 'MJ_BizApps_Sales: Pipelines')
   AND NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Deal d
                    WHERE rc.RecordID IN (CAST(d.ID AS NVARCHAR(750)), 'ID|' + CAST(d.ID AS NVARCHAR(750))))
   AND NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Pipeline p
                    WHERE rc.RecordID IN (CAST(p.ID AS NVARCHAR(750)), 'ID|' + CAST(p.ID AS NVARCHAR(750))));

/*
 * ── THE RECORD LOG, WHICH IS WHY THIS TABLE KEPT GETTING CLEARED BY HAND ─────────────────────────
 *
 * __mj.UserRecordLog is how Explorer knows which records you last had open, and it is what the app
 * uses to restore them. Deleting a deal without deleting its log row leaves a reference to a record
 * that no longer exists, and the app then does exactly the right thing with it: tries to load it,
 * fails, and writes a console error.
 *
 *     Error in BaseEntity.Load(MJ_BizApps_Sales: Deals, Key: ID=23549B45-...)
 *
 * That is not a product defect and it is not cosmetic. It broke 10-deal-crud at its console keystone,
 * which is a genuine assertion doing its job, and it had accumulated 15 orphans across one evening —
 * one deal and one pipeline per run, every run. The table has now been cleared by hand three times.
 *
 * IT STOPS BEING OURS THE MOMENT SOMEONE ELSE LOGS IN. The log is per-user, so a tester who opens a
 * deal this sweep later deletes gets console errors in their own session, on a correct application,
 * with nothing in the UI to explain it. Cleaning up after ourselves is the whole fix.
 *
 * DELIBERATELY EVERY DEAD REFERENCE, not only the ones this run deleted.
 *
 * The first version scoped it to the IDs this sweep removed, which is tighter and does not solve
 * the problem: a run that finished before this fix, a crashed run, or a human deleting a deal by
 * hand all leave references this sweep would walk straight past. Measured right after shipping the
 * narrow version — the next run still failed on two orphans left by the run before it, so the table
 * would have gone on needing to be cleared by hand, which is the thing being fixed.
 *
 * Deleting a log row whose record NO LONGER EXISTS is safe by construction: the reference is
 * already dead, it cannot be restored, and its only remaining effect is a console error. Scoped to
 * the two Sales entities this sweep is responsible for, so it never reaches another app's data.
 */
DECLARE @logCleared INT;
DELETE l FROM __mj.UserRecordLog l
  JOIN __mj.Entity e ON e.ID = l.EntityID
 WHERE e.Name IN ('MJ_BizApps_Sales: Deals', 'MJ_BizApps_Sales: Pipelines')
   AND NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Deal d     WHERE CONVERT(varchar(36), d.ID) = l.RecordID)
   AND NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Pipeline p WHERE CONVERT(varchar(36), p.ID) = l.RecordID);
SET @logCleared = @@ROWCOUNT;

/*
 * Tabs blanked, layout reset, nothing else touched -- and ONLY for a workspace that actually names one of
 * the rows this sweep is removing. Deliberately not "clear every workspace": on a shared dev host that
 * would throw away a human's real layout. A tab pointing at a record we just deleted is debris by
 * definition; a tab pointing at a live record is somebody's work.
 */
UPDATE w
   SET Configuration = N'{"version":1,"layout":{"root":{"type":"row","content":[]}},"tabs":[]}'
  FROM __mj.Workspace w
 WHERE EXISTS (
         SELECT 1 FROM @doomed x
          WHERE CAST(w.Configuration AS NVARCHAR(MAX)) LIKE N'%' + CAST(x.ID AS NVARCHAR(40)) + N'%'
       );
DECLARE @wsCleared INT = @@ROWCOUNT;

-- The embedded orders, now that no deal references them. Line children first.
-- OrderHeaderID, not OrderID: orders names the FK for the table it points at. Worth stating because
-- the deal side calls the same relationship OrderID, and assuming symmetry is what broke this first.
DELETE pc FROM __mj_BizAppsOrders.OrderLinePriceComponent pc
  JOIN __mj_BizAppsOrders.OrderLine ol ON pc.OrderLineID = ol.ID
  JOIN @orders o ON ol.OrderHeaderID = o.ID;
DELETE ol FROM __mj_BizAppsOrders.OrderLine ol JOIN @orders o ON ol.OrderHeaderID = o.ID;
DELETE oh FROM __mj_BizAppsOrders.OrderHeader oh JOIN @orders o ON oh.ID = o.ID;

SELECT 'workspace_tabs_cleared=' + CAST(@wsCleared AS varchar);
SELECT 'record_log_cleared=' + CAST(@logCleared AS varchar);
/*
 * THESE ASK THE SAME QUESTION THE DELETE ASKED, and that is the whole point of changing them.
 *
 * They used the anchored table while the delete used it too, so they agreed -- and both were wrong
 * together, which
 * is how "remaining_deals=0" was printed over 30 surviving rows for days. A verification that shares
 * the defect of the thing it verifies is not verification.
 *
 * ── THE PRINCIPLE ABOVE WAS ONLY APPLIED TO TWO OF THE SIX ──────────────────────────────────────
 *
 * remaining_deals and remaining_pipelines re-derive from the prefix, independently of what the
 * sweep captured. The other four re-joined @orders / @tasks / @contracts / @acts -- the very
 * table variables the DELETEs above consumed. That answers "did the delete I ATTEMPTED succeed?",
 * which is a real question but a much smaller one, and it is structurally blind to the failure that
 * actually leaks rows: **a row the capture never saw in the first place.**
 *
 * Those are precisely the classes this file documents at the top:
 *
 *     a task with no TaskLink          -- never entered @tasks, so @tasks cannot reveal it
 *     a contract whose deal was swept  -- never entered @contracts
 *     an activity whose deal is gone   -- never entered @acts
 *
 * A capture-based check cannot see a capture miss. So three of the four now re-derive from the
 * SURVIVING evidence instead: the harness prefix, and the dangling reference a leak leaves behind.
 */
SELECT 'remaining_deals=' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.Deal
  WHERE EXISTS (SELECT 1 FROM @inner WHERE Name LIKE P) AND ID NOT IN (SELECT ID FROM @keep);
SELECT 'remaining_pipelines=' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.Pipeline
  WHERE EXISTS (SELECT 1 FROM @inner WHERE Name LIKE P);

/*
 * ORDERS ARE THE ONE HONEST EXCEPTION, AND IT IS LABELLED RATHER THAN PAPERED OVER.
 *
 * An OrderHeader carries no harness marker of its own. It is reachable only through Deal.OrderID,
 * and once the deal row is gone there is nothing on the order that distinguishes a leaked harness
 * order from one of the ~50 standalone orders in the seed. Orphan-ness is not a marker either: most
 * seeded orders belong to no deal.
 *
 * So this counter genuinely can only verify the attempted delete, and it says so in its name. The
 * defence against the leak class is structural instead -- @orders is captured BEFORE the deal rows
 * are deleted, which is the inversion the header block describes. If that capture is ever moved
 * after the delete, nothing here will catch it; that is a fact worth knowing rather than hiding.
 */
SELECT 'remaining_orders_attempted=' + CAST(COUNT(*) AS varchar)
  FROM __mj_BizAppsOrders.OrderHeader oh JOIN @orders o ON oh.ID = o.ID;

/*
 * TASKS -- re-derived two ways, neither of them from @tasks.
 *
 * By name, which is how CloseWonTaskService names a task after the deal that raised it
 * ("Review order for PW-LIFE-xxxx"), and by a TaskLink still pointing at a Deal row that no longer
 * exists. The second is what catches a task the name route missed: the link is the dangling evidence
 * a leak leaves behind, and it survives the sweep precisely when the sweep failed.
 */
SELECT 'remaining_tasks=' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsTasks.Task t
 WHERE EXISTS (SELECT 1 FROM @inner WHERE t.Name LIKE P)
    OR EXISTS (
         SELECT 1 FROM __mj_BizAppsTasks.TaskLink tl
          WHERE tl.TaskID = t.ID
            AND tl.EntityID = @dealEntity
            AND NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Deal d
                             WHERE d.ID = TRY_CONVERT(UNIQUEIDENTIFIER, tl.RecordID)));

/* CONTRACTS -- a deal-created contract whose creating deal no longer exists. The documented class. */
IF OBJECT_ID('__mj_BizAppsContracts.Contract', 'U') IS NOT NULL
BEGIN
SELECT 'remaining_contracts=' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsContracts.Contract c
 WHERE c.CreatingEntityID = @dealEntity
   AND NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Deal d WHERE d.ID = c.CreatingRecordID);
END;

/* ACTIVITIES -- an activity still linked to a Deal row that is gone. */
SELECT 'remaining_activities=' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsCommon.Activity a
 WHERE EXISTS (
         SELECT 1 FROM __mj_BizAppsCommon.ActivityLink al
          WHERE al.ActivityID = a.ID
            AND al.EntityID = @dealEntity
            AND NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Deal d
                             WHERE d.ID = TRY_CONVERT(UNIQUEIDENTIFIER, al.RecordID)));
`;

export function cleanup() {
  const env = readEnv();
  const args = [
    '-S', `${env.DB_HOST ?? 'localhost'},${env.DB_PORT ?? '1433'}`,
    '-U', env.DB_USERNAME ?? 'sa',
    '-P', env.DB_PASSWORD ?? '',
    '-d', env.DB_DATABASE ?? 'MJ_BizAppsSales',
    '-C', '-N', 'o', '-b', '-h', '-1', '-W',
    '-Q', SQL,
  ];
  try {
    const out = execFileSync('sqlcmd', args, { encoding: 'utf8', timeout: 60_000 });
    const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!quiet) {
      console.log(`  cleanup(${PREFIX}*): ${lines.join(' ')}`);
    }
    /**
     * RESIDUE IS REPORTED LOUDLY, because "the script ran" and "the rows are gone" are different
     * claims and this function used to conflate them. A non-zero remaining_* count means a delete was
     * refused -- an FK this list does not know about -- and the next run will trip over it.
     */
    const left = lines.filter((l) => /^remaining_\w+=[1-9]/.test(l));
    if (left.length > 0) {
      console.warn(`  cleanup(${PREFIX}*): ROWS LEFT BEHIND -> ${left.join(' ')}`);
      return false;
    }
    return true;
  } catch (e) {
    /**
     * Never fail a RUN because teardown could not reach the database -- but print what sqlcmd actually
     * said. The old version printed only `e.message`, whose first line is the command line with the
     * `-Q` payload elided, so the real error (`Invalid object name`) was never shown and the teardown
     * looked like an environment problem for a phase.
     */
    const detail = [e.stdout, e.stderr]
      .map((v) => (v ?? '').toString().trim())
      .filter(Boolean)
      .join(' | ')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      // ERRORS ARRIVE LAST. This took the FIRST three lines, but stdout begins with the
      // will_delete SELECT rows, so the actual sqlcmd error was sliced off every time and the
      // warning showed a list of rows it had just failed to delete. Prefer anything that names an
      // error, and fall back to the TAIL rather than the head.
      .filter((v) => v.length > 0)
      .flatMap((v) => v.split(String.fromCharCode(10)))
      .filter((l) => l.trim().length > 0)
      .filter((l, _i, all) => {
        const errs = all.filter((x) => /Msg |error|Invalid|constraint|conflict/i.test(x));
        return errs.length > 0 ? errs.includes(l) : true;
      })
      .slice(-3)
      .join(' ');
    console.warn(
      `  cleanup(${PREFIX}*): SKIPPED — ${detail || (e.message ?? e).toString().split('\n')[0]}`,
    );
    return false;
  }
}

// Allow direct invocation: node lib/cleanup.mjs
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('cleanup.mjs')) {
  cleanup();
}
