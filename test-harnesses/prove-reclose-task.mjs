/**
 * Proves the golive#324 fix against the LIVE database: a second close finds the order-review task
 * the first one raised, instead of trying to create another.
 *
 * WHY THIS AND NOT THE UI. The defect is server-side — `CloseWonTaskService.raise` — so driving the
 * service directly tests the thing that changed, with real `RunView` reads against real rows. The
 * unit suite stubs those reads and so cannot catch a wrong entity or field name; only a database can.
 *
 * PAIRED CONTROL. "The second call created nothing" proves little on its own, so the run asserts the
 * FIRST call created exactly one task and the SECOND found that same id — the delta is the fix.
 *
 * WRITES, INSIDE THE PROVIDER'S OWN TRANSACTION, AND ROLLS BACK, then asserts the rollback took,
 * because `prove-contracts-seam.mjs` records what a bare mssql transaction leaves behind.
 */
import 'dotenv/config';
import sql from 'mssql';

const DB = process.env.DB_DATABASE;
let pass = 0, fail = 0;
const ok = (label, cond, detail = '') => {
    if (cond) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}${detail ? ' :: ' + detail : ''}`); }
};

const pool = await new sql.ConnectionPool({
    server: process.env.DB_HOST, port: Number(process.env.DB_PORT || 1433), database: DB,
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
    options: { trustServerCertificate: true, encrypt: false }, requestTimeout: 60_000,
}).connect();

const { setupSQLServerClient, SQLServerProviderConfigData } = await import('@memberjunction/sqlserver-dataprovider');
const { UserCache } = await import('@memberjunction/generic-database-provider');
const { importSibling } = await import('./sibling-resolve.mjs');
const provider = await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
await UserCache.Instance.Refresh(pool);
const user = UserCache.Users.find((u) => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];

// Tasks' own server classes, or ClassFactory resolves a bare BaseEntity and nothing mints a task.
await importSibling('@mj-biz-apps/tasks-server').then((m) => m.LoadBizAppsTasksServer?.());
const { CloseWonTaskService, CloseWonTaskDueAt } = await importSibling('@mj-biz-apps/sales-core-entities-server');

// A real deal with a real order behind it — the fixture is the live data, not an invention.
const target = (await pool.request().query(`
    SELECT TOP 1 d.ID AS DealID, d.Name AS DealName, d.PipelineID, o.ID AS OrderID, o.OrderNumber
      FROM __mj_BizAppsSales.Deal d
      JOIN __mj_BizAppsOrders.OrderHeader o ON o.ID = d.OrderID
     WHERE d.PipelineID IS NOT NULL`)).recordset[0];

console.log(`\n  database: ${DB}`);
if (!target) {
    console.log('  SKIP  no deal on this host has both an order and a pipeline.\n');
    await pool.close();
    process.exit(0);
}
console.log(`  target:   ${target.OrderNumber} from ${target.DealName ?? target.DealID}\n`);

/**
 * Counted on a SEPARATE connection from the provider's transaction, so it must read DIRTY: the rows
 * under test are written inside that open transaction and its locks would otherwise block this read
 * until the 60s request timeout. `NOLOCK` is what makes the uncommitted rows visible here, and is
 * safe precisely because this is a test harness asserting on a transaction it owns.
 */
const countTasks = async () => (await pool.request().query(`
    SELECT COUNT(*) AS N
      FROM __mj_BizAppsTasks.Task t WITH (NOLOCK)
      JOIN __mj_BizAppsTasks.TaskLink l WITH (NOLOCK) ON l.TaskID = t.ID
      JOIN __mj.Entity e WITH (NOLOCK) ON e.ID = l.EntityID
     WHERE e.Name = 'MJ_BizApps_Orders: Order Headers' AND l.RecordID = '${target.OrderID}'`)).recordset[0].N;

const input = {
    DealID: target.DealID,
    DealName: target.DealName || target.DealID,
    OrderID: target.OrderID,
    PipelineID: target.PipelineID,
    DueAt: CloseWonTaskDueAt(new Date(), null),
};

const before = await countTasks();
let first = null, second = null;
await provider.BeginTransaction();
try {
    console.log('-- first close --');
    first = await new CloseWonTaskService().CreateCloseWonTasks(input, provider, user);
    const review1 = first.Tasks.find((t) => t.Kind === 'OrderReview');
    ok('raises an order-review task', !!review1, JSON.stringify(first.Issues));
    ok('and reports it as newly raised', review1?.AlreadyExisted === false, String(review1?.AlreadyExisted));
    ok('the task is really on the order', (await countTasks()) === before + 1, `${before} -> ${await countTasks()}`);

    console.log('\n-- second close, the re-close --');
    second = await new CloseWonTaskService().CreateCloseWonTasks(input, provider, user);
    const review2 = second.Tasks.find((t) => t.Kind === 'OrderReview');
    ok('finds the SAME task', review2?.TaskID === review1?.TaskID, `${review1?.TaskID} vs ${review2?.TaskID}`);
    ok('and reports it as pre-existing', review2?.AlreadyExisted === true, String(review2?.AlreadyExisted));
    ok('creates no second task', (await countTasks()) === before + 1, `now ${await countTasks()}`);

    const text = (second.Issues ?? []).join(' ');
    ok('says nothing on the close panel', (second.Issues ?? []).length === 0, text.slice(0, 160));
    ok('and no SQL reaches it', !/DECLARE|Query:|SentClientRequest/.test(text), text.slice(0, 160));
} catch (err) {
    ok('the harness ran without throwing', false, String(err).slice(0, 200));
} finally {
    try { await provider.RollbackTransaction(); } catch { /* keep the real failure visible */ }
}

console.log('\n-- the host is left clean --');
ok(`task count is back to ${before}`, (await countTasks()) === before, `now ${await countTasks()}`);

await pool.close();
console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
