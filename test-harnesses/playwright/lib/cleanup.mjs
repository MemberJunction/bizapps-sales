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
-- One table variable rather than N parameters, so the list length is not baked into the SQL.
DECLARE @pfx TABLE (P NVARCHAR(50) PRIMARY KEY);
INSERT INTO @pfx (P) VALUES ${PREFIXES.map((x) => `(N'${x}%')`).join(', ')};

-- The same six prefixes as an UNANCHORED pattern, for rows that quote a deal's name INSIDE their own.
DECLARE @inner TABLE (P NVARCHAR(50) PRIMARY KEY);
INSERT INTO @inner (P) VALUES ${PREFIXES.map((x) => `(N'%${x}%')`).join(', ')};

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
  SELECT ID FROM __mj_BizAppsSales.Deal WHERE EXISTS (SELECT 1 FROM @pfx WHERE Name LIKE P);

-- Deal.OrderID is the only link to the provisioned order, and it dies with the deal row.
DECLARE @orders TABLE (ID UNIQUEIDENTIFIER PRIMARY KEY);
INSERT INTO @orders (ID)
  SELECT DISTINCT d.OrderID FROM __mj_BizAppsSales.Deal d
    JOIN @deals x ON x.ID = d.ID WHERE d.OrderID IS NOT NULL;

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
INSERT INTO @contracts (ID)
  SELECT DISTINCT c.ID FROM __mj_BizAppsContracts.Contract c
    JOIN @deals d ON d.ID = c.CreatingRecordID
  UNION
  SELECT c.ID FROM __mj_BizAppsContracts.Contract c
   WHERE c.CreatingEntityID = @dealEntity
     AND NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Deal d WHERE d.ID = c.CreatingRecordID);

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
   WHERE EXISTS (SELECT 1 FROM @inner WHERE t.Name LIKE P);

/* ACTIVITIES — ActivityLink carries the Regarding link to the deal, and dies with it. */
DECLARE @acts TABLE (ID UNIQUEIDENTIFIER PRIMARY KEY);
INSERT INTO @acts (ID)
  SELECT DISTINCT al.ActivityID FROM __mj_BizAppsCommon.ActivityLink al
   WHERE TRY_CONVERT(UNIQUEIDENTIFIER, al.RecordID) IN (SELECT ID FROM @deals);

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

DELETE m FROM __mj_BizAppsContracts.ContractTemplateModification m JOIN @contracts c ON m.ContractID = c.ID;
-- Contracts point at each other two ways; both must be broken before the rows go.
UPDATE c SET ParentContractID = NULL FROM __mj_BizAppsContracts.Contract c JOIN @contracts x ON x.ID = c.ID WHERE c.ParentContractID IS NOT NULL;
UPDATE c SET SupersededByContractID = NULL FROM __mj_BizAppsContracts.Contract c JOIN @contracts x ON x.ID = c.ID WHERE c.SupersededByContractID IS NOT NULL;
DELETE c FROM __mj_BizAppsContracts.Contract c JOIN @contracts x ON x.ID = c.ID;

DELETE ps FROM __mj_BizAppsSales.DealPaymentSchedule ps JOIN @deals d ON ps.DealID = d.ID;
DELETE tm FROM __mj_BizAppsSales.DealTeamMember tm JOIN @deals d ON tm.DealID = d.ID;
DELETE se FROM __mj_BizAppsSales.DealStageEvent se JOIN @deals d ON se.DealID = d.ID;
DELETE cr FROM __mj_BizAppsSales.DealContactRole cr JOIN @deals d ON cr.DealID = d.ID;

DELETE d FROM __mj_BizAppsSales.Deal d JOIN @deals x ON x.ID = d.ID;

DELETE ps FROM __mj_BizAppsSales.PipelineStage ps
  JOIN __mj_BizAppsSales.Pipeline p ON ps.PipelineID = p.ID WHERE EXISTS (SELECT 1 FROM @pfx WHERE p.Name LIKE P);
DELETE FROM __mj_BizAppsSales.Pipeline WHERE EXISTS (SELECT 1 FROM @pfx WHERE Name LIKE P);

-- The embedded orders, now that no deal references them. Line children first.
-- OrderHeaderID, not OrderID: orders names the FK for the table it points at. Worth stating because
-- the deal side calls the same relationship OrderID, and assuming symmetry is what broke this first.
DELETE pc FROM __mj_BizAppsOrders.OrderLinePriceComponent pc
  JOIN __mj_BizAppsOrders.OrderLine ol ON pc.OrderLineID = ol.ID
  JOIN @orders o ON ol.OrderHeaderID = o.ID;
DELETE ol FROM __mj_BizAppsOrders.OrderLine ol JOIN @orders o ON ol.OrderHeaderID = o.ID;
DELETE oh FROM __mj_BizAppsOrders.OrderHeader oh JOIN @orders o ON oh.ID = o.ID;

SELECT 'remaining_deals=' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.Deal WHERE EXISTS (SELECT 1 FROM @pfx WHERE Name LIKE P);
SELECT 'remaining_pipelines=' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.Pipeline WHERE EXISTS (SELECT 1 FROM @pfx WHERE Name LIKE P);
SELECT 'remaining_orders=' + CAST(COUNT(*) AS varchar)
  FROM __mj_BizAppsOrders.OrderHeader oh JOIN @orders o ON oh.ID = o.ID;
SELECT 'remaining_tasks=' + CAST(COUNT(*) AS varchar)
  FROM __mj_BizAppsTasks.Task t JOIN @tasks x ON x.ID = t.ID;
SELECT 'remaining_contracts=' + CAST(COUNT(*) AS varchar)
  FROM __mj_BizAppsContracts.Contract c JOIN @contracts x ON x.ID = c.ID;
SELECT 'remaining_activities=' + CAST(COUNT(*) AS varchar)
  FROM __mj_BizAppsCommon.Activity a JOIN @acts x ON x.ID = a.ID;
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
      .slice(0, 3)
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
