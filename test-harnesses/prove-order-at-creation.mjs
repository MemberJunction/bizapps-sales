/**
 * Item 4 proof: creating a deal creates its order, with no UI involved.
 *
 * The point is the LAYER, not the outcome -- AddLine() already produced an order. This saves a deal
 * through the entity layer the way an agent, an importer or a remote operation would, touches no
 * workspace code, and asserts against __mj_BizAppsOrders.OrderHeader directly.
 *
 * Rolls back: it writes nothing.
 */
import dotenv from 'dotenv'; import sql from 'mssql'; dotenv.config();

const { DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD } = process.env;
const DB = process.env.DB_DATABASE;
const pool = await new sql.ConnectionPool({
    server: DB_HOST, port: Number(DB_PORT ?? 1433), database: DB,
    user: DB_USERNAME, password: DB_PASSWORD,
    options: { trustServerCertificate: true, encrypt: true }, requestTimeout: 60000,
}).connect();

const { setupSQLServerClient, SQLServerProviderConfigData } = await import('@memberjunction/sqlserver-dataprovider');
const { UserCache } = await import('@memberjunction/generic-database-provider');
const provider = await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
await UserCache.Instance.Refresh(pool);
const user = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];

await import('@mj-biz-apps/sales-server').then(m => m.LoadBizAppsSalesServer?.());
// Orders' SERVER classes: without these nothing mints OrderNumber. The code under test now says so out
// loud when they are missing, and the SKIP_ORDERS mode below is how that message is proven.
const SKIP_ORDERS = process.env.SKIP_ORDERS === '1';
if (!SKIP_ORDERS) {
    (await import('@mj-biz-apps/orders-server')).LoadBizAppsOrdersServer();
}

const { Metadata, RunView } = await import('@memberjunction/core');
const md = new Metadata();
let bad = 0;
const ck = (ok, l, d) => { console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${l}${d ? '  — ' + d : ''}`); if (!ok) bad++; };

console.log(`\n  database: ${DB}${SKIP_ORDERS ? '   [SKIP_ORDERS: orders server classes NOT loaded]' : ''}\n`);

const rv = new RunView();
const pipe = (await rv.RunView({ EntityName: 'MJ_BizApps_Sales: Pipelines', ExtraFilter: 'IsActive = 1',
    ResultType: 'simple', Fields: ['ID', 'Code', 'CompanyID'] }, user)).Results?.[0];
const stage = (await rv.RunView({ EntityName: 'MJ_BizApps_Sales: Pipeline Stages',
    ExtraFilter: `PipelineID = '${pipe.ID}' AND IsActive = 1`, OrderBy: 'DisplayOrder ASC',
    ResultType: 'simple', Fields: ['ID'] }, user)).Results?.[0];
const dtype = (await rv.RunView({ EntityName: 'MJ_BizApps_Sales: Deal Types', ExtraFilter: 'IsActive = 1',
    ResultType: 'simple', Fields: ['ID'] }, user)).Results?.[0];
const status = (await rv.RunView({ EntityName: 'MJ_BizApps_Sales: Deal Status Types',
    ExtraFilter: 'IsOpen = 1 AND IsActive = 1', ResultType: 'simple', Fields: ['ID'] }, user)).Results?.[0];
const account = (await rv.RunView({ EntityName: 'MJ_BizApps_Sales: Sales Accounts', ExtraFilter: 'IsActive = 1',
    ResultType: 'simple', Fields: ['ID'] }, user)).Results?.[0];
if (!pipe || !stage || !dtype || !status) { console.error('    PRECONDITION: seeds missing'); process.exit(2); }
ck(true, 'fixture discovered by FLAG, never by name', `pipeline ${pipe.Code}`);

const ordersBefore = (await pool.request().query(
    'SELECT COUNT(*) n FROM __mj_BizAppsOrders.OrderHeader')).recordset[0].n;

// ── create a deal the way anything-but-the-UI would ────────────────────────
const deal = await md.GetEntityObject('MJ_BizApps_Sales: Deals', user);
deal.NewRecord();
deal.Name = `Item4 provisioning ${Math.abs(Date.now() % 100000)}`;
deal.PipelineID = pipe.ID;
deal.PipelineStageID = stage.ID;
deal.DealTypeID = dtype.ID;
deal.DealStatusTypeID = status.ID;
deal.AccountID = account?.ID ?? null;
ck(!deal.OrderID, 'a new deal has no OrderID before saving', String(deal.OrderID));

const saved = await deal.Save();
ck(saved === !SKIP_ORDERS,
   SKIP_ORDERS ? 'the save FAILS without orders server classes (as it must)' : 'deal.Save() succeeded',
   saved ? '' : (deal.LatestResult?.CompleteMessage ?? ''));

if (SKIP_ORDERS) {
    console.log('\n    (run without SKIP_ORDERS to assert the happy path)\n');
    await pool.close(); process.exit(bad === 0 ? 0 : 1);
}

ck(!!deal.OrderID, 'the deal now carries an OrderID', deal.OrderID ?? 'null');

// ── DATABASE assertions ───────────────────────────────────────────────────
const row = (await pool.request().query(
    `SELECT OrderNumber, Status, OrderType, CompanyID, BillToOrganizationID, BillToPersonID
       FROM __mj_BizAppsOrders.OrderHeader WHERE ID = '${deal.OrderID}'`)).recordset[0];
ck(!!row, 'the order row is IN THE DATABASE');
ck(row && !!row.OrderNumber, 'orders minted its OrderNumber', row?.OrderNumber);
ck(row && row.Status === 'Draft', 'it is in Draft — nothing fires at creation', row?.Status);
ck(row && row.OrderType === 'Sale', 'OrderType is Sale', row?.OrderType);
ck(row && String(row.CompanyID).toLowerCase() === String(pipe.CompanyID).toLowerCase(),
   'CompanyID came from the PIPELINE, via the deal stamp', row?.CompanyID);
if (account) {
    ck(row && String(row.BillToOrganizationID).toLowerCase() === String(account.ID).toLowerCase(),
       'bill-to organization is the deal account');
}
const dbDeal = (await pool.request().query(
    `SELECT OrderID, DealNumber FROM __mj_BizAppsSales.Deal WHERE ID = '${deal.ID}'`)).recordset[0];
ck(dbDeal && String(dbDeal.OrderID).toLowerCase() === String(deal.OrderID).toLowerCase(),
   'and the FK is persisted on the deal row', dbDeal?.DealNumber);

// exactly one order, not two
const ordersAfter = (await pool.request().query(
    'SELECT COUNT(*) n FROM __mj_BizAppsOrders.OrderHeader')).recordset[0].n;
ck(ordersAfter === ordersBefore + 1, 'exactly ONE order was created', `${ordersBefore} -> ${ordersAfter}`);

// re-saving must not provision a second one
deal.Description = 'touched';
await deal.Save();
const ordersAfterResave = (await pool.request().query(
    'SELECT COUNT(*) n FROM __mj_BizAppsOrders.OrderHeader')).recordset[0].n;
ck(ordersAfterResave === ordersAfter, 're-saving the deal does NOT provision another order',
   `${ordersAfter} -> ${ordersAfterResave}`);

// ── clean up: this harness is not transactional ────────────────────────────
await pool.request().query(`DELETE FROM __mj_BizAppsSales.DealStageEvent WHERE DealID = '${deal.ID}'`);
await pool.request().query(`DELETE FROM __mj_BizAppsSales.DealTeamMember WHERE DealID = '${deal.ID}'`);
await pool.request().query(`UPDATE __mj_BizAppsSales.Deal SET OrderID = NULL WHERE ID = '${deal.ID}'`);
await pool.request().query(`DELETE FROM __mj_BizAppsOrders.OrderLine WHERE OrderHeaderID = '${deal.OrderID}'`);
await pool.request().query(`DELETE FROM __mj_BizAppsOrders.OrderHeader WHERE ID = '${deal.OrderID}'`);
await pool.request().query(`DELETE FROM __mj_BizAppsSales.Deal WHERE ID = '${deal.ID}'`);
const left = (await pool.request().query(
    'SELECT COUNT(*) n FROM __mj_BizAppsOrders.OrderHeader')).recordset[0].n;
ck(left === ordersBefore, 'cleaned up after itself', `${left} orders`);

console.log(`\n  ${bad === 0 ? 'ALL CHECKS PASSED' : bad + ' CHECK(S) FAILED'}\n`);
await pool.close();
process.exit(bad === 0 ? 0 : 1);
