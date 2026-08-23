/**
 * Run `Sales.CloseDeal` ONCE against the live host, and report exactly what it produced.
 *
 * ── WHY THIS EXISTS AS A SCRIPT AND NOT A CHECK ─────────────────────────────────────────────────
 *
 * Every close in `packages/IntegrationTests` runs inside `InRolledBackTransaction`, which is correct for
 * a check and useless for this question. The demo's centrepiece is close-won, and nothing on this host
 * had ever been closed through the operation — `DEAL-9005` was SEEDED Won. So the tasks, links and
 * contract a close is supposed to produce were unobserved rather than merely unrehearsed, and a rolled
 * back transaction cannot tell you what a committed one leaves behind.
 *
 * This therefore COMMITS. It is not a test and must never be wired into one.
 *
 * ── HOW IT IS MADE SAFE ─────────────────────────────────────────────────────────────────────────
 *
 *   1. `--preview` runs with `PreviewOnly: true`, which the operation honours by rolling back and
 *      returning the routing plan. Always run that first; the plan is most of the answer.
 *   2. A COPY_ONLY backup is taken by hand before the committing run. COPY_ONLY because this host is
 *      shared: it leaves the log chain and anybody else's differential base untouched.
 *   3. The deal is named on the command line rather than defaulted, so nothing closes by accident.
 *   4. Everything the close writes is counted before and after, so the undo is surgical rather than a
 *      full restore — which on a shared host would destroy two other sessions' work.
 *
 * ── WHY NOT DEAL-9001 ───────────────────────────────────────────────────────────────────────────
 *
 * It is the flagship and the only two-line deal in the set, so it is the only place an order-line demo
 * is reachable at all. Closing it would lock it (`DealStatusType.LocksDeal = 1` on Won) and spend the
 * one card that can show a multi-line order.
 *
 * USAGE
 *   node test-harnesses/run-close-won-once.mjs DEAL-9002 --preview
 *   node test-harnesses/run-close-won-once.mjs DEAL-9002 --commit
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import dotenv from 'dotenv';
import sql from 'mssql';

const dealNumber = process.argv[2];
const mode = process.argv.includes('--commit') ? 'commit'
    : process.argv.includes('--preview') ? 'preview' : null;
if (!dealNumber || !mode) {
    console.error('usage: node test-harnesses/run-close-won-once.mjs <DEAL-NUMBER> --preview|--commit');
    process.exit(2);
}

dotenv.config({ path: join(process.cwd(), '.env') });

const pool = await new sql.ConnectionPool({
    server: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 1433),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    options: { trustServerCertificate: true, encrypt: true },
    pool: { max: 10, min: 1 },
    requestTimeout: 60_000,
}).connect();

const { setupSQLServerClient, SQLServerProviderConfigData } = await import('@memberjunction/sqlserver-dataprovider');
const { UserCache } = await import('@memberjunction/generic-database-provider');
const provider = await setupSQLServerClient(
    new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'),
);
await UserCache.Instance.Refresh(pool);
const user = UserCache.Users.find((u) => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
if (!user) { console.error('no context user in UserCache'); process.exit(2); }

// The server subclasses. Without these the ClassFactory hands back the GENERATED Deal and the close
// runs against a class that has none of the behaviour under observation.
await import('@mj-biz-apps/sales-server').then((m) => m.LoadBizAppsSalesServer?.());
for (const [pkg, anchor] of [
    ['@mj-biz-apps/common-entities', 'LoadGeneratedEntities'],
    ['@mj-biz-apps/accounting-entities', 'LoadGeneratedEntities'],
    ['@mj-biz-apps/accounting-engine-base', null],
    ['@mj-biz-apps/accounting-core-entities-server', null],
    ['@mj-biz-apps/orders-entities', 'LoadGeneratedEntities'],
    ['@mj-biz-apps/orders-core-entities-server', null],
    ['@mj-biz-apps/contracts-entities', 'LoadGeneratedEntities'],
    ['@mj-biz-apps/contracts-core-entities-server', null],
    ['@mj-biz-apps/tasks-entities', 'LoadGeneratedEntities'],
]) {
    try {
        const m = await import(pkg);
        if (anchor && typeof m[anchor] === 'function') m[anchor]();
    } catch (err) {
        console.log(`  (optional) ${pkg} not loaded: ${String(err).slice(0, 90)}`);
    }
}

const q = async (text) => (await pool.request().query(text)).recordset;
const one = async (text) => (await q(text))[0];

const deal = await one(`
    SELECT CAST(d.ID AS varchar(40)) AS ID, d.DealNumber, d.Name,
           CAST(d.OrderID AS varchar(40)) AS OrderID, oh.OrderNumber, oh.Status AS OrderStatus,
           ps.Name AS Stage, st.Name AS Status, p.Code AS Pipeline
      FROM __mj_BizAppsSales.Deal d
      LEFT JOIN __mj_BizAppsOrders.OrderHeader oh ON oh.ID = d.OrderID
      LEFT JOIN __mj_BizAppsSales.PipelineStage ps ON ps.ID = d.PipelineStageID
      LEFT JOIN __mj_BizAppsSales.DealStatusType st ON st.ID = d.DealStatusTypeID
      LEFT JOIN __mj_BizAppsSales.Pipeline p ON p.ID = d.PipelineID
     WHERE d.DealNumber = '${dealNumber.replace(/'/g, "''")}'`);
if (!deal) { console.error(`no deal numbered ${dealNumber}`); process.exit(2); }
if (deal.DealNumber === 'DEAL-9001') { console.error('refusing DEAL-9001: flagship, and the only two-line deal'); process.exit(2); }

// Resolved BY FLAG, never by name — the vocabulary is data.
const wonStatus = await one(`SELECT CAST(ID AS varchar(40)) AS ID, Name FROM __mj_BizAppsSales.DealStatusType WHERE IsWon = 1`);
const closingStage = await one(`
    SELECT CAST(ps.ID AS varchar(40)) AS ID, ps.Name, ISNULL(ps.OrderStatusOnEntry,'(none)') AS OrderStatusOnEntry
      FROM __mj_BizAppsSales.PipelineStage ps
      JOIN __mj_BizAppsSales.DealStatusType st ON st.ID = ps.DealStatusTypeID
     WHERE st.IsWon = 1 AND ps.PipelineID = (SELECT PipelineID FROM __mj_BizAppsSales.Deal WHERE ID = '${deal.ID}')`);

const snapshot = async () => ({
    stageEvents: (await one(`SELECT COUNT(*) n FROM __mj_BizAppsSales.DealStageEvent`)).n,
    tasks: (await one(`SELECT COUNT(*) n FROM __mj_BizAppsTasks.Task`)).n,
    taskLinks: (await one(`SELECT COUNT(*) n FROM __mj_BizAppsTasks.TaskLink`)).n,
    taskAssignments: (await one(`SELECT COUNT(*) n FROM __mj_BizAppsTasks.TaskAssignment`)).n,
    contracts: (await one(`SELECT COUNT(*) n FROM __mj_BizAppsContracts.Contract`)).n,
    orderStatus: (await one(`SELECT Status s FROM __mj_BizAppsOrders.OrderHeader WHERE ID = '${deal.OrderID}'`))?.s,
    orderLines: (await one(`SELECT COUNT(*) n FROM __mj_BizAppsOrders.OrderLine WHERE OrderHeaderID = '${deal.OrderID}'`)).n,
    orderTotal: (await one(`SELECT CAST(ISNULL(TotalGross,0) AS decimal(12,2)) t FROM __mj_BizAppsOrders.OrderHeader WHERE ID = '${deal.OrderID}'`))?.t,
    orderUpdated: (await one(`SELECT CONVERT(varchar(23), __mj_UpdatedAt, 121) u FROM __mj_BizAppsOrders.OrderHeader WHERE ID = '${deal.OrderID}'`))?.u,
});

console.log(`\n  deal      ${deal.DealNumber} — ${deal.Name}`);
console.log(`  pipeline  ${deal.Pipeline}   stage ${deal.Stage}   status ${deal.Status}`);
console.log(`  order     ${deal.OrderNumber} (${deal.OrderStatus})`);
console.log(`  closing   into "${wonStatus.Name}" at stage "${closingStage?.Name}" (OrderStatusOnEntry ${closingStage?.OrderStatusOnEntry})`);
console.log(`  mode      ${mode.toUpperCase()}\n`);

const before = await snapshot();
console.log('  before:', JSON.stringify(before));

const { SalesCloseDealOperation } = await import('@mj-biz-apps/sales-core-entities-server');
const op = new SalesCloseDealOperation();
const result = await op.Execute(
    {
        DealID: deal.ID,
        DealStatusTypeID: wonStatus.ID,
        ClosingStageID: closingStage?.ID ?? null,
        Notes: mode === 'commit'
            ? 'First close-won executed through Sales.CloseDeal on this host, to capture what it produces.'
            : 'preview only',
        PreviewOnly: mode === 'preview',
    },
    { provider, user },
);
const out = result?.Output ?? result;

console.log('\n  ── the envelope ──');
console.log(`  Success ${out?.Success}   IsWon ${out?.IsWon}   IsLost ${out?.IsLost}   Locked ${out?.Locked}   WasPreview ${out?.WasPreview}`);
console.log(`  Issues (${(out?.Issues ?? []).length}):`);
for (const i of out?.Issues ?? []) console.log(`     [${i.Severity ?? i.Kind ?? '?'}] ${i.Scope ?? ''} ${i.Message}`);
console.log(`  Routing (${(out?.Routing ?? []).length}):`);
for (const r of out?.Routing ?? []) console.log(`     ${JSON.stringify(r)}`);

const after = await snapshot();
console.log('\n  after: ', JSON.stringify(after));
console.log('  delta: ', JSON.stringify(Object.fromEntries(
    Object.keys(before).map((k) => [k, before[k] === after[k] ? 'unchanged' : `${before[k]} -> ${after[k]}`]),
)));

if (mode === 'commit') {
    console.log('\n  ── what it actually left behind ──');
    // WRAPPED, because the close has already committed by the time this runs. A throw in the REPORT
    // destroys the only account of what an un-repeatable operation did. See the Contract note below.
    try {
    for (const row of await q(`
        SELECT LEFT(t.Name,70) AS TaskName, ISNULL(tt.Code,'(no type)') AS TypeCode, t.Status,
               ISNULL(CONVERT(varchar(10), t.DueAt, 23),'(NULL DueAt)') AS DueAt,
               (SELECT COUNT(*) FROM __mj_BizAppsTasks.TaskLink tl WHERE tl.TaskID = t.ID) AS Links
          FROM __mj_BizAppsTasks.Task t
          LEFT JOIN __mj_BizAppsTasks.TaskType tt ON tt.ID = t.TypeID
         ORDER BY t.__mj_CreatedAt DESC`)) {
        console.log(`     task  ${row.TypeCode.padEnd(14)} links=${row.Links}  due=${row.DueAt}  ${row.TaskName}`);
    }
    for (const row of await q(`
        SELECT LEFT(ISNULL(t.Name,'?'),46) AS TaskName, ISNULL(e.Name,'(no entity)') AS Entity,
               CAST(tl.RecordID AS varchar(40)) AS RecordID
          FROM __mj_BizAppsTasks.TaskLink tl
          LEFT JOIN __mj_BizAppsTasks.Task t ON t.ID = tl.TaskID
          LEFT JOIN __mj.Entity e ON e.ID = tl.EntityID`)) {
        console.log(`     link  ${row.Entity.padEnd(34)} ${row.RecordID}  <- ${row.TaskName}`);
    }
    /**
     * `Contract` HAS NO `Status` COLUMN, and an earlier version of this script selected one.
     *
     * It threw `Invalid column name 'Status'` AFTER the close had already committed, so the write
     * landed and the report did not -- the worst possible ordering for a script whose only job is to
     * report on a write that cannot be replayed. DN-16 records that contracts' v2 rebuild removed
     * `Contract.Status` along with `ContractTerm` and `ContractLine`, and that a check was asserting it
     * at the time; this repeated the same stale assumption a day later.
     *
     * Columns are read rather than assumed now. Note there is no `ContractLine` table at all, which is
     * why the routing plan reports `LineCount: 0` -- structural, not a failure to route.
     */
    for (const row of await q(`
        SELECT ISNULL(c.ContractNumber,'(no number)') AS ContractNumber,
               ISNULL(ct.Name,'(no type)') AS ContractType,
               ISNULL(CONVERT(varchar(10), c.EffectiveDate, 23),'(NULL EffectiveDate)') AS EffectiveDate,
               ISNULL(CONVERT(varchar(10), c.EndDate, 23),'(NULL EndDate)') AS EndDate,
               ISNULL(e.Name,'(none)') AS CreatingEntity
          FROM __mj_BizAppsContracts.Contract c
          LEFT JOIN __mj_BizAppsContracts.ContractType ct ON ct.ID = c.ContractTypeID
          LEFT JOIN __mj.Entity e ON e.ID = c.CreatingEntityID`)) {
        console.log(`     contract ${row.ContractNumber}  ${row.ContractType}  ${row.EffectiveDate} -> ${row.EndDate}  from ${row.CreatingEntity}`);
    }
    for (const row of await q(`
        SELECT ISNULL(fs.Name,'(none)') AS FromStage, ISNULL(ts.Name,'(none)') AS ToStage,
               CAST(ISNULL(se.AmountAtTransition,-1) AS decimal(12,2)) AS Amt,
               CAST(ISNULL(se.ProbabilityAtTransition,-1) AS varchar) AS Prob,
               LEFT(ISNULL(se.Notes,'(no note)'),56) AS Notes
          FROM __mj_BizAppsSales.DealStageEvent se
          LEFT JOIN __mj_BizAppsSales.PipelineStage fs ON fs.ID = se.FromStageID
          LEFT JOIN __mj_BizAppsSales.PipelineStage ts ON ts.ID = se.ToStageID
         WHERE se.DealID = '${deal.ID}' ORDER BY se.ChangedAt`)) {
        console.log(`     event ${row.FromStage} -> ${row.ToStage}  amt=${row.Amt} prob=${row.Prob}  ${row.Notes}`);
    }
    } catch (err) {
        console.error(`\n  THE CLOSE COMMITTED AND THIS REPORT FAILED: ${String(err).slice(0, 200)}`);
        console.error('  Query the host directly -- the write is done and cannot be replayed.');
    }
}

await pool.close();
process.exit(0);
