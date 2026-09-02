/**
 * WHICH order-line mutations reach the database through `deal.Save()`, and which need `order.Save()`.
 *
 * Written because `save-deal.SD6` and `SD14` failed on a real run: the deal saved successfully and the
 * removed line was still there. Insert propagates (SD1/SD19/SD20 pass), so "the embedded record joins
 * the parent's save graph" is true for some verbs and not others -- and a harness that answers the
 * matrix is worth more than a guess about which.
 *
 * Prints one row per verb x save-target. Cleans up after itself; not transactional.
 */
import dotenv from 'dotenv';
import sql from 'mssql';
dotenv.config();

const { DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD } = process.env;
const pool = await new sql.ConnectionPool({
    server: DB_HOST, port: Number(DB_PORT ?? 1433), database: DB_DATABASE,
    user: DB_USERNAME, password: DB_PASSWORD,
    options: { trustServerCertificate: true, encrypt: true }, requestTimeout: 60000,
}).connect();

const { setupSQLServerClient, SQLServerProviderConfigData } = await import('@memberjunction/sqlserver-dataprovider');
const { UserCache } = await import('@memberjunction/generic-database-provider');
await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
await UserCache.Instance.Refresh(pool);
const user = UserCache.Users.find((u) => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];

await import('@mj-biz-apps/sales-server').then((m) => m.LoadBizAppsSalesServer?.());
(await import('@mj-biz-apps/orders-server')).LoadBizAppsOrdersServer();

const { Metadata, RunView } = await import('@memberjunction/core');
const { ProductFilterFor } = await import('../packages/Entities/dist/product-filter.js');
const md = new Metadata();

const ck = (ok, label, detail) => console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
const dbLines = async (orderID) =>
    (await pool.request().query(
        `SELECT ID, LineNumber, Quantity FROM __mj_BizAppsOrders.OrderLine
          WHERE OrderHeaderID = '${orderID}' ORDER BY LineNumber`)).recordset;

const rv = new RunView();
const one = async (entity, filter, fields, orderBy) =>
    (await rv.RunView({ EntityName: entity, ExtraFilter: filter, ResultType: 'simple', Fields: fields, ...(orderBy ? { OrderBy: orderBy } : {}) }, user)).Results?.[0];

// The SAME pipeline the integration fixture picks -- first active -- so this harness and the checks are
// talking about the same company and the same catalogue.
const pipe = await one('MJ_BizApps_Sales: Pipelines', 'IsActive = 1', ['ID', 'Code', 'CompanyID']);
const stage = await one('MJ_BizApps_Sales: Pipeline Stages', `PipelineID = '${pipe.ID}' AND IsActive = 1`, ['ID'], 'DisplayOrder ASC');
const dtype = await one('MJ_BizApps_Sales: Deal Types', 'IsActive = 1', ['ID']);
const status = await one('MJ_BizApps_Sales: Deal Status Types', 'IsOpen = 1 AND IsActive = 1', ['ID']);
const account = await one('MJ_BizApps_Sales: Sales Accounts', 'IsActive = 1', ['ID']);
// RAW SQL, not RunView, and deliberately. A `RunView` over one of ORDERS' entities from this harness
// dies with `provider.QuoteSchemaAndView is not a function` -- an MJ skew between this checkout and the
// installed core, unrelated to what is being measured here. The picker's rule is still the source of the
// filter, so the harness cannot drift from it.
// COMPANY SCOPING IS EXPLICIT NOW. #29 removed the clause from `ProductFilterFor`, which is right for
// the picker — a deal may sell any company's product — but this harness wants a product belonging to a
// PARTICULAR company, so it says so itself rather than relying on a rule that no longer means that.
const products = (await pool.request().query(
    `SELECT ID FROM __mj_BizAppsOrders.Product WHERE CompanyID = '${String(pipe.CompanyID).replace(/'/g, "''")}' AND (${ProductFilterFor(new Date())}) ORDER BY Name`
)).recordset;
if (products.length < 2) { console.error('    PRECONDITION: need 2 sellable products'); process.exit(2); }

console.log(`\n  ${DB_DATABASE} — pipeline ${pipe.Code}\n`);

// ── a saved deal with two order lines ──────────────────────────────────────
const deal = await md.GetEntityObject('MJ_BizApps_Sales: Deals', user);
deal.NewRecord();
deal.Name = `Removal matrix ${Math.abs(Date.now() % 100000)}`;
deal.PipelineID = pipe.ID;
deal.PipelineStageID = stage.ID;
deal.DealTypeID = dtype.ID;
deal.DealStatusTypeID = status.ID;
deal.AccountID = account?.ID ?? null;
deal.TermMonths = 12;
const order0 = deal.OrderID_EnsureObject();
for (const p of products.slice(0, 2)) {
    const l = await order0.Lines.Create();
    l.ProductID = p.ID;
    l.Quantity = 2;
}
ck(await deal.Save(), 'setup: deal + 2 lines in one save', deal.LatestResult?.CompleteMessage ?? '');
const orderID = deal.OrderID;
ck((await dbLines(orderID)).length === 2, 'setup: two lines in the database');

// ── 1. INSERT through deal.Save() on a SAVED deal ─────────────────────────
{
    const d = await md.GetEntityObject('MJ_BizApps_Sales: Deals', user);
    await d.Load(deal.ID);
    await d.OrderID_Object.LoadRelatedRecords('Lines');
    const l = await d.OrderID_Object.Lines.Create();
    l.ProductID = products[0].ID;   // reused on purpose: a second line for the same product is legal
    l.Quantity = 9;
    const ok = await d.Save();
    const rows = await dbLines(orderID);
    ck(ok && rows.length === 3, 'INSERT  via deal.Save()', `${rows.length} row(s)`);
}

// ── 2. EDIT through deal.Save() ───────────────────────────────────────────
{
    const d = await md.GetEntityObject('MJ_BizApps_Sales: Deals', user);
    await d.Load(deal.ID);
    await d.OrderID_Object.LoadRelatedRecords('Lines');
    d.OrderID_Object.Lines.Items[0].Set('Quantity', 77);
    const ok = await d.Save();
    const rows = await dbLines(orderID);
    ck(ok && Number(rows[0].Quantity) === 77, 'EDIT    via deal.Save()', `Quantity=${rows[0].Quantity}`);
}

// ── 3. REMOVE through deal.Save() ─────────────────────────────────────────
{
    const d = await md.GetEntityObject('MJ_BizApps_Sales: Deals', user);
    await d.Load(deal.ID);
    await d.OrderID_Object.LoadRelatedRecords('Lines');
    const lines = d.OrderID_Object.Lines;
    lines.Remove(lines.Items[lines.Items.length - 1]);
    const ok = await d.Save();
    const rows = await dbLines(orderID);
    ck(ok && rows.length === 2, 'REMOVE  via deal.Save()', `save=${ok}, ${rows.length} row(s)`);
}

// ── 4. REMOVE through order.Save() — the same collection, saved on its OWNER ──
{
    const d = await md.GetEntityObject('MJ_BizApps_Sales: Deals', user);
    await d.Load(deal.ID);
    const order = d.OrderID_Object;
    await order.LoadRelatedRecords('Lines');
    const before = order.Lines.Items.length;
    order.Lines.Remove(order.Lines.Items[before - 1]);
    const ok = await order.Save();
    const rows = await dbLines(orderID);
    ck(ok && rows.length === before - 1, 'REMOVE  via order.Save()',
       `save=${ok}, ${before} -> ${rows.length} row(s)  ${ok ? '' : order.LatestResult?.CompleteMessage ?? ''}`);
}

// ── 5. REMOVE after Lines.Load() rather than LoadRelatedRecords() ─────────
// Same verb, different LOADER. If this one deletes and step 3 did not, the difference is how the
// collection was populated, not the save graph.
{
    const d = await md.GetEntityObject('MJ_BizApps_Sales: Deals', user);
    await d.Load(deal.ID);
    const order = d.OrderID_Object;
    await order.Lines.Load();
    const before = order.Lines.Items.length;
    order.Lines.Remove(order.Lines.Items[before - 1]);
    const ok = await order.Save();
    const rows = await dbLines(orderID);
    ck(ok && rows.length === before - 1, 'REMOVE  via Lines.Load() + order.Save()',
       `save=${ok}, ${before} -> ${rows.length} row(s)`);
}

// ── 6. THE CONTROL: remove one of the DEAL's OWN children ─────────────────
// `DealPaymentSchedule` is declared on the deal, so this is MJ's collection-removal machinery with no
// embedded record and no other app in the picture. If this fails too, the finding is about MJ; if it
// passes, the finding is about OrderHeader.Lines specifically.
{
    const seed = await md.GetEntityObject('MJ_BizApps_Sales: Deals', user);
    await seed.Load(deal.ID);
    await seed.LoadRelatedRecords('PaymentSchedule');
    for (const amount of [100, 200]) {
        const row = await seed.PaymentSchedule.Create();
        row.Amount = amount;
        row.Description = `instalment ${amount}`;
    }
    ck(await seed.Save(), 'control setup: two instalments added', seed.LatestResult?.CompleteMessage ?? '');

    const d = await md.GetEntityObject('MJ_BizApps_Sales: Deals', user);
    await d.Load(deal.ID);
    await d.LoadRelatedRecords('PaymentSchedule');
    const before = d.PaymentSchedule.Items.length;
    d.PaymentSchedule.Remove(d.PaymentSchedule.Items[before - 1]);
    const ok = await d.Save();
    const after = (await pool.request().query(
        `SELECT COUNT(*) n FROM __mj_BizAppsSales.DealPaymentSchedule WHERE DealID = '${deal.ID}'`)).recordset[0].n;
    ck(ok && after === before - 1, 'CONTROL: REMOVE a DEAL instalment via deal.Save()',
       `save=${ok}, ${before} -> ${after} row(s)`);
}

// ── clean up ──────────────────────────────────────────────────────────────
await pool.request().query(`DELETE FROM __mj_BizAppsSales.DealPaymentSchedule WHERE DealID = '${deal.ID}'`);
await pool.request().query(`DELETE FROM __mj_BizAppsSales.DealStageEvent WHERE DealID = '${deal.ID}'`);
await pool.request().query(`DELETE FROM __mj_BizAppsSales.DealTeamMember WHERE DealID = '${deal.ID}'`);
await pool.request().query(`UPDATE __mj_BizAppsSales.Deal SET OrderID = NULL WHERE ID = '${deal.ID}'`);
await pool.request().query(`DELETE FROM __mj_BizAppsOrders.OrderLine WHERE OrderHeaderID = '${orderID}'`);
await pool.request().query(`DELETE FROM __mj_BizAppsOrders.OrderHeader WHERE ID = '${orderID}'`);
await pool.request().query(`DELETE FROM __mj_BizAppsSales.Deal WHERE ID = '${deal.ID}'`);
console.log('\n  cleaned up\n');
await pool.close();
