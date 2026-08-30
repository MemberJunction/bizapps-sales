/**
 * Item 2 proof: a saved deal's order lines come back when the deal is re-read.
 *
 * Asserts DATABASE state as well as entity state -- the close-won gap survived for days because the
 * UI check never looked at what got written.
 */
import dotenv from 'dotenv'; import sql from 'mssql'; dotenv.config();
const { DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD } = process.env;
const pool = await new sql.ConnectionPool({ server: DB_HOST, port: Number(DB_PORT ?? 1433), database: DB_DATABASE,
  user: DB_USERNAME, password: DB_PASSWORD, options: { trustServerCertificate: true, encrypt: true }, requestTimeout: 60000 }).connect();
const { setupSQLServerClient, SQLServerProviderConfigData } = await import('@memberjunction/sqlserver-dataprovider');
const { UserCache } = await import('@memberjunction/generic-database-provider');
await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
await UserCache.Instance.Refresh(pool);
const user = UserCache.Users.find(u => u?.Type?.trim().toLowerCase()==='owner') ?? UserCache.Users[0];
await import('@mj-biz-apps/sales-server').then(m => m.LoadBizAppsSalesServer?.());
(await import('@mj-biz-apps/orders-server')).LoadBizAppsOrdersServer();
const { Metadata, RunView } = await import('@memberjunction/core');
const md = new Metadata();

let bad = 0;
const ck = (ok,l,d)=>{ console.log(`    ${ok?'PASS':'FAIL'}  ${l}${d?'  — '+d:''}`); if(!ok) bad++; };

// a deal that already has an order
const r = await new RunView().RunView({ EntityName:'MJ_BizApps_Sales: Deals',
  ExtraFilter:'OrderID IS NOT NULL', ResultType:'simple', Fields:['ID','DealNumber','OrderID','CompanyID'] }, user);
const seed = (r.Results ?? [])[0];
if (!seed) { console.error('    no deal with an order — run prove-embed.mjs first'); process.exit(2); }
console.log(`\n  ${DB_DATABASE} — deal ${seed.DealNumber}, order ${seed.OrderID}\n`);

// a sellable product for this deal's company
const { ProductFilterFor } = await import('../packages/Entities/dist/product-filter.js');
const pr = await new RunView().RunView({ EntityName:'MJ_BizApps_Orders: Products',
  ExtraFilter: `CompanyID = '${String(seed.CompanyID).replace(/'/g, "''")}' AND (${ProductFilterFor(new Date())})`, OrderBy:'Name ASC', ResultType:'simple', Fields:['ID','Name'] }, user);
const product = (pr.Results ?? [])[0];
ck(!!product, 'a sellable product exists for the deal company', product?.Name);
if (!product) { process.exit(1); }

// ── add a line through the deal's embedded order, then save the DEAL ────────
const deal = await md.GetEntityObject('MJ_BizApps_Sales: Deals', user);
await deal.Load(seed.ID);
const order = deal.OrderID_Object;
ck(!!order, 'the deal resolves its embedded order on load', order?.OrderNumber);
await order.LoadRelatedRecords('Lines');
const before = order.Lines.Items.length;
const line = await order.Lines.Create();
line.ProductID = product.ID;
line.Quantity = 3;
const saved = await deal.Save();
ck(saved, 'saving the DEAL persisted the new order line', saved ? '' : deal.LatestResult?.CompleteMessage);

// ── DATABASE assertion, not entity state ───────────────────────────────────
const dbq = await pool.request().query(
  `SELECT LineNumber, Quantity, UnitPrice, DiscountPct, LineTotalNet, CompanyID
     FROM __mj_BizAppsOrders.OrderLine WHERE OrderHeaderID = '${seed.OrderID}' ORDER BY LineNumber`);
ck(dbq.recordset.length === before + 1, 'the row is IN THE DATABASE', `${dbq.recordset.length} line(s)`);
const row = dbq.recordset[dbq.recordset.length - 1];
ck(row && Number(row.Quantity) === 3, 'quantity persisted as sent', `Quantity=${row?.Quantity}`);
ck(row && row.UnitPrice !== null, 'orders PRICED it — sales sent no price', `UnitPrice=${row?.UnitPrice}`);
ck(row && row.CompanyID !== null, 'orders stamped CompanyID from the product', `CompanyID=${row?.CompanyID}`);

// ── ITEM 2: a FRESH read brings the lines back ─────────────────────────────
const fresh = await md.GetEntityObject('MJ_BizApps_Sales: Deals', user);
await fresh.Load(seed.ID);
const freshOrder = fresh.OrderID_Object;
ck(!!freshOrder, 'a fresh deal load resolves the order');
ck(freshOrder.Lines.IsLoaded === false, 'and its Lines start UNLOADED (Load: explicit)',
   `IsLoaded=${freshOrder.Lines.IsLoaded}`);
await freshOrder.LoadRelatedRecords('Lines');
ck(freshOrder.Lines.IsLoaded === true, 'LoadRelatedRecords loads them');
ck(freshOrder.Lines.Items.length === dbq.recordset.length,
   'and the count matches the database', `${freshOrder.Lines.Items.length} vs ${dbq.recordset.length}`);

console.log(`\n  ${bad===0?'ALL CHECKS PASSED':bad+' FAILED'}\n`);
await pool.close(); process.exit(bad===0?0:1);
