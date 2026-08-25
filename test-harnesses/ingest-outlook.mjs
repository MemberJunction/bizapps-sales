/**
 * Ingest an exported Outlook/Graph payload through the REAL activity pipeline.
 *
 *   node test-harnesses/ingest-outlook.mjs <export.json> [--reset] [--reset-watermark]
 *
 * ── WHY THIS IS A COMMITTED SCRIPT AND NOT A SCRATCH FILE ───────────────────────────────────────
 *
 * A reseed clears activities. So without this the demo's Outlook act works exactly ONCE — the next
 * `seed-demo-data.sh` leaves an empty timeline and no way to refill it, which is the same failure mode
 * the seeded contact method exists to prevent (see `scripts/seed-demo-data.sh`, CONTACT METHOD block).
 * The two belong together: the seed makes the mail matchable, this puts the mail back.
 *
 * ── WHAT IT DOES NOT DO ────────────────────────────────────────────────────────────────────────
 *
 * It reimplements nothing. `ActivityIngestService` does the filtering, matching, dedupe, watermarking,
 * participant mapping and writing; this builds the provider the way `integration.mjs` does, points
 * `ImportedGraphActivitySource` at a file, and calls `RunSync`. Every number it prints comes from the
 * shipped code.
 *
 * ── FLAGS, AND WHY THE TWO RESETS ARE SEPARATE ─────────────────────────────────────────────────
 *
 *   --reset             delete the ingested activities AND clear the watermark — a clean first run.
 *   --reset-watermark   clear ONLY the watermark, keeping the activities.
 *
 * They are separate because the demo makes two DIFFERENT claims that a single reset would conflate:
 *
 *   · run twice with no reset  -> the WATERMARK stops the re-fetch  (fetched 0)
 *   · run with --reset-watermark -> DEDUPE stops the re-write        (fetched N, written 0, duplicates N)
 *
 * A pass that fetches nothing proves only the watermark; it says nothing about whether dedupe works.
 * Clearing the watermark while keeping the rows is the only way to exercise dedupe on its own.
 *
 * Only rows this pipeline wrote are touched — `Source <> 'Manual'` — so hand-entered activities survive.
 */
import 'dotenv/config';
import sql from 'mssql';

const EXPORT_PATH = process.argv[2];
const RESET = process.argv.includes('--reset');
const RESET_WATERMARK = process.argv.includes('--reset-watermark');
const CONNECTION_NAME = 'Outlook demo import';
const MAILBOX = process.env.OUTLOOK_DEMO_MAILBOX ?? 'josue.garcia@bluecypress.io';

if (!EXPORT_PATH) {
    console.error('usage: node test-harnesses/ingest-outlook.mjs <export.json> [--reset] [--reset-watermark]');
    process.exit(2);
}

const { DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD } = process.env;
if (!DB_DATABASE) {
    console.error('no DB_DATABASE in env — run from the repo root so .env is picked up');
    process.exit(2);
}

const pool = await new sql.ConnectionPool({
    server: DB_HOST ?? 'localhost',
    port: Number(DB_PORT ?? 1433),
    database: DB_DATABASE,
    user: DB_USERNAME,
    password: DB_PASSWORD,
    options: { trustServerCertificate: true, encrypt: true },
    pool: { max: 10, min: 1 },
    requestTimeout: 60_000,
}).connect();

const { setupSQLServerClient, SQLServerProviderConfigData } = await import('@memberjunction/sqlserver-dataprovider');
/** v6 moved UserCache out of the SQL Server provider — see the note in integration.mjs. */
const { UserCache } = await import('@memberjunction/generic-database-provider');
const provider = await setupSQLServerClient(
    new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'),
);
await UserCache.Instance.Refresh(pool);
const user = UserCache.Users.find((u) => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
if (!user) {
    console.error('no context user in UserCache — run scripts/seed-dev-data.sh first');
    process.exit(2);
}

/**
 * COMMON FIRST. The activities bundle writes through common's generated entity subclasses; without them
 * `GetEntityObject` resolves a bare `BaseEntity` that has no `Load`, and the run dies with
 * `row.Load is not a function` — which reads like a broken entity rather than a missing import.
 */
for (const [pkg, anchor] of [
    ['@mj-biz-apps/common-entities', 'LoadGeneratedEntities'],
    ['@mj-biz-apps/orders-entities', 'LoadGeneratedEntities'],
    ['@mj-biz-apps/orders-core-entities-server', null],
    ['@mj-biz-apps/tasks-entities', 'LoadGeneratedEntities'],
]) {
    try {
        const mod = await import(pkg);
        if (anchor && typeof mod[anchor] === 'function') mod[anchor]();
    } catch (error) {
        console.log(`  (skipped ${pkg}: ${String(error).slice(0, 70)})`);
    }
}
await import('@mj-biz-apps/sales-server').then((m) => m.LoadBizAppsSalesServer?.());

const { ActivityIngestService, ImportedGraphActivitySource } =
    await import('@mj-biz-apps/sales-core-entities-server');

// ── the connection row, created once and reused so the watermark persists between runs ──
const found = await pool.request().query(
    `SELECT TOP 1 CONVERT(varchar(36), ID) AS ID FROM __mj_BizAppsCommon.ActivitySyncConnection
      WHERE Name = '${CONNECTION_NAME}'`);
let connectionID = found.recordset[0]?.ID ?? null;
if (!connectionID) {
    const made = await pool.request().query(
        `DECLARE @id UNIQUEIDENTIFIER = NEWID();
         DECLARE @owner UNIQUEIDENTIFIER = (SELECT TOP 1 ID FROM __mj.[User] WHERE Email = '${user.Email}');
         INSERT INTO __mj_BizAppsCommon.ActivitySyncConnection (ID, Name, Provider, Mailbox, Status, OwnerUserID)
         VALUES (@id, '${CONNECTION_NAME}', 'Microsoft365', '${MAILBOX}', 'Active', @owner);
         SELECT CONVERT(varchar(36), @id) AS ID;`);
    connectionID = made.recordset[0].ID;
    console.log(`created ActivitySyncConnection ${connectionID}`);
}

if (RESET) {
    const r = await pool.request().query(`
        DELETE FROM __mj_BizAppsCommon.ActivityLink
         WHERE ActivityID IN (SELECT ID FROM __mj_BizAppsCommon.Activity WHERE Source <> 'Manual');
        DECLARE @links INT = @@ROWCOUNT;
        DELETE FROM __mj_BizAppsCommon.Activity WHERE Source <> 'Manual';
        DECLARE @acts INT = @@ROWCOUNT;
        UPDATE __mj_BizAppsCommon.ActivitySyncConnection SET LastSyncAt = NULL WHERE ID = '${connectionID}';
        SELECT @links AS Links, @acts AS Activities;`);
    const row = r.recordset[0];
    console.log(`--reset: removed ${row.Activities} activities and ${row.Links} links, watermark cleared`);
} else if (RESET_WATERMARK) {
    await pool.request().query(
        `UPDATE __mj_BizAppsCommon.ActivitySyncConnection SET LastSyncAt = NULL WHERE ID = '${connectionID}'`);
    console.log('--reset-watermark: watermark cleared, activities kept (this exercises DEDUPE)');
}

const before = await pool.request().query(
    `SELECT CONVERT(varchar(30), LastSyncAt, 126) AS W FROM __mj_BizAppsCommon.ActivitySyncConnection WHERE ID='${connectionID}'`);
console.log(`watermark before: ${before.recordset[0]?.W ?? 'null'}`);

const result = await new ActivityIngestService().RunSync(
    connectionID,
    new ImportedGraphActivitySource(EXPORT_PATH),
    provider,
    user,
    100,
);

console.log('\n===== ingest result =====');
console.log(JSON.stringify({
    Success: result.Success,
    Fetched: result.Fetched,
    Relevant: result.Relevant,
    Irrelevant: result.Irrelevant,
    Written: result.Written,
    Duplicates: result.Duplicates,
    Unattributed: result.Unattributed,
    Failed: result.Failed,
}, null, 2));
for (const issue of result.Issues ?? []) console.log(`  issue: ${issue}`);
if (result.Error) console.log(`  error: ${result.Error}`);

/**
 * VERIFY THE ATTRIBUTION, not just the counters. "The ingest reported success" and "the mail is on the
 * right deal" are different claims, and only the second is what a demo shows.
 */
const perDeal = await pool.request().query(`
    SELECT d.DealNumber, COUNT(DISTINCT a.ID) AS Activities
      FROM __mj_BizAppsSales.Deal d
      JOIN __mj.Entity e ON e.Name = 'MJ_BizApps_Sales: Deals'
      JOIN __mj_BizAppsCommon.ActivityLink l ON l.EntityID = e.ID AND l.RecordID = CONVERT(varchar(36), d.ID)
      JOIN __mj_BizAppsCommon.Activity a ON a.ID = l.ActivityID
     GROUP BY d.DealNumber ORDER BY d.DealNumber`);
console.log('\nmatched-per-deal:');
if (!perDeal.recordset.length) console.log('  (none)');
for (const r of perDeal.recordset) console.log(`  ${r.DealNumber}: ${r.Activities}`);

const acts = await pool.request().query(`
    SELECT LEFT(a.Title, 56) AS Title, a.Direction,
           CONVERT(varchar(19), a.StartedAt, 120) AS StartedAt,
           LEFT(ISNULL(a.ExternalThreadID, '(none)'), 12) AS Thread
      FROM __mj_BizAppsCommon.Activity a WHERE a.Source <> 'Manual' ORDER BY a.StartedAt`);
console.log(`\nactivities from this pipeline (${acts.recordset.length}):`);
for (const r of acts.recordset) console.log(`  ${r.StartedAt}  ${r.Direction.padEnd(8)} [thr ${r.Thread}] ${r.Title}`);
console.log(`distinct threads: ${new Set(acts.recordset.map((r) => r.Thread)).size}`);

const after = await pool.request().query(
    `SELECT CONVERT(varchar(30), LastSyncAt, 126) AS W FROM __mj_BizAppsCommon.ActivitySyncConnection WHERE ID='${connectionID}'`);
console.log(`watermark after: ${after.recordset[0]?.W ?? 'null'}`);

await pool.close();
