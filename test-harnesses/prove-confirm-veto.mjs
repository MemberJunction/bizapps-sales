/**
 * Proves the golive#323 confirm veto against the LIVE database, with no mocks anywhere.
 *
 * WHY THIS EXISTS. Both unit suites stub the other half: orders registers a fake vetoer, sales
 * mocks `RunView` and matches entity names with `includes()`. Neither can catch a wrong entity or
 * field name — and because the vetoer FAILS CLOSED, a wrong name would refuse every confirm on a
 * host that runs Sales. That failure cannot be reached from a mock, only from a database.
 *
 * READ ONLY. It calls `MayConfirm` and reads rows. It writes nothing and opens no transaction.
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
    server: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 1433),
    database: DB,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    options: { trustServerCertificate: true, encrypt: false },
    requestTimeout: 60_000,
}).connect();

const { setupSQLServerClient, SQLServerProviderConfigData } = await import('@memberjunction/sqlserver-dataprovider');
const { UserCache } = await import('@memberjunction/generic-database-provider');
const { importSibling } = await import('./sibling-resolve.mjs');
await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
await UserCache.Instance.Refresh(pool);
const user = UserCache.Users.find((u) => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];

console.log(`\n  database: ${DB}\n  user: ${user?.Name ?? '(none)'}`);

// Sales' bootstrap is what registers the vetoer; orders' lookup is what the save consults.
const salesCES = await importSibling('@mj-biz-apps/sales-core-entities-server');
const orders = await importSibling('@mj-biz-apps/orders-entities');

console.log('\n-- the seam is wired on a real host --');
ok('nothing registered before bootstrap', orders.HostOrderConfirmVeto() === null);
salesCES.LoadDealNotWonConfirmVeto();
const veto = orders.HostOrderConfirmVeto();
ok('orders sees the vetoer sales registered', veto !== null);

// Real pairs, read from the database rather than invented.
const rows = (await pool.request().query(`
    SELECT d.DealNumber, st.IsWon, o.ID AS OrderID, o.OrderNumber, o.Status
      FROM __mj_BizAppsSales.Deal d
      JOIN __mj_BizAppsOrders.OrderHeader o ON o.ID = d.OrderID
      LEFT JOIN __mj_BizAppsSales.DealStatusType st ON st.ID = d.DealStatusTypeID
     WHERE d.OrderID IS NOT NULL`)).recordset;

console.log(`\n-- ${rows.length} real deal/order pairs --`);
for (const r of rows) {
    const refusal = await veto.MayConfirm({ OrderHeaderID: r.OrderID, FromStatus: r.Status, ContextUser: user });
    const won = r.IsWon === true || r.IsWon === 1;
    const label = `${r.DealNumber} (IsWon=${won ? 1 : 0}) / ${r.OrderNumber}`;
    if (won) ok(`${label} -> allowed`, refusal === null, String(refusal));
    else {
        ok(`${label} -> REFUSED`, refusal !== null);
        if (refusal) ok(`   refusal names the deal`, String(refusal).includes(r.DealNumber), String(refusal));
    }
}

// An order no deal points at must be allowed, or installing Sales breaks ordinary ordering.
const orphan = (await pool.request().query(`
    SELECT TOP 1 o.ID, o.OrderNumber FROM __mj_BizAppsOrders.OrderHeader o
     WHERE NOT EXISTS (SELECT 1 FROM __mj_BizAppsSales.Deal d WHERE d.OrderID = o.ID)`)).recordset[0];
console.log('\n-- an order with no deal --');
if (orphan) {
    const r = await veto.MayConfirm({ OrderHeaderID: orphan.ID, FromStatus: 'Quoted', ContextUser: user });
    ok(`${orphan.OrderNumber} (no deal points at it) -> allowed`, r === null, String(r));
} else console.log('  (none on this host)');

orders.RegisterOrderConfirmVeto(null);
await pool.close();
console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
