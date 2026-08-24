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

-- Captured BEFORE the deal rows go: Deal.OrderID is the only link to the provisioned order.
DECLARE @orders TABLE (ID UNIQUEIDENTIFIER PRIMARY KEY);
INSERT INTO @orders (ID)
  SELECT DISTINCT OrderID FROM __mj_BizAppsSales.Deal
   WHERE (EXISTS (SELECT 1 FROM @pfx WHERE Name LIKE P)) AND OrderID IS NOT NULL;

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
  SELECT ID FROM __mj_BizAppsSales.Deal     WHERE EXISTS (SELECT 1 FROM @pfx WHERE Name LIKE P)
  UNION
  SELECT ID FROM __mj_BizAppsSales.Pipeline WHERE EXISTS (SELECT 1 FROM @pfx WHERE Name LIKE P);

DELETE ps FROM __mj_BizAppsSales.DealPaymentSchedule ps
  JOIN __mj_BizAppsSales.Deal d ON ps.DealID = d.ID WHERE EXISTS (SELECT 1 FROM @pfx WHERE d.Name LIKE P);
DELETE tm FROM __mj_BizAppsSales.DealTeamMember tm
  JOIN __mj_BizAppsSales.Deal d ON tm.DealID = d.ID WHERE EXISTS (SELECT 1 FROM @pfx WHERE d.Name LIKE P);
DELETE se FROM __mj_BizAppsSales.DealStageEvent se
  JOIN __mj_BizAppsSales.Deal d ON se.DealID = d.ID WHERE EXISTS (SELECT 1 FROM @pfx WHERE d.Name LIKE P);
DELETE cr FROM __mj_BizAppsSales.DealContactRole cr
  JOIN __mj_BizAppsSales.Deal d ON cr.DealID = d.ID WHERE EXISTS (SELECT 1 FROM @pfx WHERE d.Name LIKE P);

DELETE FROM __mj_BizAppsSales.Deal WHERE EXISTS (SELECT 1 FROM @pfx WHERE Name LIKE P);

DELETE ps FROM __mj_BizAppsSales.PipelineStage ps
  JOIN __mj_BizAppsSales.Pipeline p ON ps.PipelineID = p.ID WHERE EXISTS (SELECT 1 FROM @pfx WHERE p.Name LIKE P);
DELETE FROM __mj_BizAppsSales.Pipeline WHERE EXISTS (SELECT 1 FROM @pfx WHERE Name LIKE P);

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
SELECT 'remaining_deals=' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.Deal WHERE EXISTS (SELECT 1 FROM @pfx WHERE Name LIKE P);
SELECT 'remaining_pipelines=' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.Pipeline WHERE EXISTS (SELECT 1 FROM @pfx WHERE Name LIKE P);
SELECT 'remaining_orders=' + CAST(COUNT(*) AS varchar)
  FROM __mj_BizAppsOrders.OrderHeader oh JOIN @orders o ON oh.ID = o.ID;
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
