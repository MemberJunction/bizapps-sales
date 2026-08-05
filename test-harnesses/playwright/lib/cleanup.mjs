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
const PREFIX = 'PW-VERIFY';
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
 * Child-first order. DealLine / DealTeamMember / DealStageEvent / DealContactRole all reference Deal;
 * Deal references Pipeline; PipelineStage references Pipeline. Deleting a parent first would be
 * refused by the very foreign keys the S1 baseline put there on purpose.
 */
const SQL = `
SET NOCOUNT ON;
DECLARE @p NVARCHAR(50) = N'${PREFIX}%';

DELETE dl FROM __mj_BizAppsSales.DealLine dl
  JOIN __mj_BizAppsSales.Deal d ON dl.DealID = d.ID WHERE d.Name LIKE @p;
DELETE tm FROM __mj_BizAppsSales.DealTeamMember tm
  JOIN __mj_BizAppsSales.Deal d ON tm.DealID = d.ID WHERE d.Name LIKE @p;
DELETE se FROM __mj_BizAppsSales.DealStageEvent se
  JOIN __mj_BizAppsSales.Deal d ON se.DealID = d.ID WHERE d.Name LIKE @p;
DELETE cr FROM __mj_BizAppsSales.DealContactRole cr
  JOIN __mj_BizAppsSales.Deal d ON cr.DealID = d.ID WHERE d.Name LIKE @p;

DELETE FROM __mj_BizAppsSales.Deal WHERE Name LIKE @p;

DELETE ps FROM __mj_BizAppsSales.PipelineStage ps
  JOIN __mj_BizAppsSales.Pipeline p ON ps.PipelineID = p.ID WHERE p.Name LIKE @p;
DELETE FROM __mj_BizAppsSales.Pipeline WHERE Name LIKE @p;

SELECT 'remaining_deals=' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.Deal WHERE Name LIKE @p;
SELECT 'remaining_pipelines=' + CAST(COUNT(*) AS varchar) FROM __mj_BizAppsSales.Pipeline WHERE Name LIKE @p;
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
    if (!quiet) {
      const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
      console.log(`  cleanup(${PREFIX}*): ${lines.join(' ')}`);
    }
    return true;
  } catch (e) {
    // Never fail a run because teardown could not reach the database — say so and move on.
    console.warn(`  cleanup(${PREFIX}*): SKIPPED — ${(e.message ?? e).toString().split('\n')[0]}`);
    return false;
  }
}

// Allow direct invocation: node lib/cleanup.mjs
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('cleanup.mjs')) {
  cleanup();
}
