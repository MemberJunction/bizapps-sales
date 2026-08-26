/**
 * Preflight. Runs once before any test, and refuses to start unless the environment is actually
 * capable of the run — with the exact fix command in the failure, not a generic timeout later.
 *
 * The accounting harness learned this the expensive way: a stale MJAPI serving old metadata presents
 * as "the app is mysteriously absent from Explorer", and a dozen selector timeouts is a terrible way
 * to discover a server needs restarting.
 */
import { mkdirSync } from 'node:fs';
import { API_BASE_URL, ARTIFACTS_DIR, AUTH_DIR, EXPLORER_BASE_URL, ENTITY } from './env';

async function reachable(url: string, timeoutMs = 10_000): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

/** Ask MJAPI whether this app's entities are actually in the metadata it is serving. */
async function salesEntitiesPresent(): Promise<{ ok: boolean; detail: string }> {
  const apiKey = process.env.MJ_API_KEY;
  if (!apiKey) {
    return { ok: true, detail: 'skipped (no MJ_API_KEY in env — cannot query; not treated as a failure)' };
  }
  try {
    const res = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-mj-api-key': apiKey },
      body: JSON.stringify({
        query: '{ mjBizAppsSalesDealStatusType(ID: "1A7C4E20-0002-4B10-9E31-5C8A7D2F6011") { Code IsWon LocksDeal } }',
      }),
    });
    const json = (await res.json()) as { data?: { mjBizAppsSalesDealStatusType?: { Code?: string } }; errors?: unknown };
    const code = json?.data?.mjBizAppsSalesDealStatusType?.Code;
    if (code === 'WON') return { ok: true, detail: 'MJAPI serves sales metadata and the seeded WON status resolves' };
    return { ok: false, detail: `unexpected response: ${JSON.stringify(json).slice(0, 300)}` };
  } catch (e) {
    return { ok: false, detail: `query failed: ${(e as Error).message}` };
  }
}

export default async function globalSetup(): Promise<void> {
  mkdirSync(AUTH_DIR, { recursive: true });
  mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const problems: string[] = [];

  if (!(await reachable(API_BASE_URL))) {
    // NOT `npm run start:api` -- that script does not exist in this repo and never has. Sales retired
    // its own API, so both servers belong to the MJ host you link into. Naming a script that isn't
    // here sends the reader to fix the wrong thing; the usual cause is the port, not a dead server.
    problems.push(
      `MJAPI is not reachable at ${API_BASE_URL}\n` +
        `      check:  the HOST serves MJAPI on 4143 (docs/QA-GUIDE.md). Sales' own GRAPHQL_PORT=4141\n` +
        `              is vestigial. Override with MJAPI_PORT=<port> if yours differs.\n` +
        `      start:  from the MJ checkout, not from this repo`,
    );
  }
  if (!(await reachable(EXPLORER_BASE_URL))) {
    // Explorer is Angular. The old hint said "wait for Vite" -- wrong toolchain, wrong repo.
    problems.push(
      `MJExplorer is not reachable at ${EXPLORER_BASE_URL}\n` +
        `      check:  it must serve on 4341 -- the Entra redirect URI is registered for that origin,\n` +
        `              so another port fails the login round-trip rather than this check.\n` +
        `      start:  ng serve from the MJ host's MJExplorer, not from this repo`,
    );
  }

  if (problems.length) {
    throw new Error(
      `\nbizapps-sales Playwright harness — preflight FAILED.\n\n  - ${problems.join('\n  - ')}\n\n` +
        `This harness deliberately does not start servers; see test-harnesses/playwright/README.md.\n`,
    );
  }

  const meta = await salesEntitiesPresent();
  if (!meta.ok) {
    throw new Error(
      `\nMJAPI is up but is not serving this app's metadata correctly.\n  ${meta.detail}\n\n` +
        `The usual cause is MJAPI having booted BEFORE the schema/metadata landed — restart it:\n` +
        `      npm run start:api\n` +
        `If that does not fix it, the database may be missing the migration or the seeds:\n` +
        `      scripts/rebuild-db.sh && npm run mj:codegen && scripts/append-codegen.sh && npm run mj -- sync push --dir metadata\n`,
    );
  }

  console.log(`  preflight: MJAPI ${API_BASE_URL} up · MJExplorer ${EXPLORER_BASE_URL} up`);
  console.log(`  preflight: ${meta.detail}`);
  console.log(`  preflight: target entity "${ENTITY.Deals}"`);

  // PRE-CLEAN, not just teardown. A previous run that failed part way leaves a PW-VERIFY Pipeline
  // behind, and the next run then trips over UQ_Pipeline_Company_Code and fails for a reason that has
  // nothing to do with the code under test. Cleaning on the way IN makes the harness re-runnable even
  // after a hard crash that skipped teardown entirely.
  const { cleanup } = await import('./cleanup.mjs');
  cleanup();
}
