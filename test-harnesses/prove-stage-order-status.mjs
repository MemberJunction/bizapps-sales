/**
 * S-US5 / S-US7 / S-US8 against the SEEDED pipelines, on committed rows.
 *
 * The integration checks prove the MECHANISM inside a rolled-back transaction, and deliberately set the
 * stage values themselves so they do not depend on the seed. This proves the other half: that the
 * seeded B2B pipeline actually carries the values D-OS1 says it should, and that a deal walked through
 * it end to end behaves as S-US5, S-US7 and S-US8 describe.
 *
 * It is also the only place the S-US8 refusal is exercised on a real reopen path rather than a
 * constructed one.
 *
 * Cleans up after itself; not transactional.
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

const { Metadata } = await import('@memberjunction/core');
const md = new Metadata();

let bad = 0;
const ck = (ok, label, detail) => {
    console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
    if (!ok) bad++;
};
const q = async (text) => (await pool.request().query(text)).recordset;
const orderStatus = async (id) => (await q(`SELECT Status FROM __mj_BizAppsOrders.OrderHeader WHERE ID='${id}'`))[0]?.Status;
const dealStage = async (id) => (await q(`SELECT PipelineStageID FROM __mj_BizAppsSales.Deal WHERE ID='${id}'`))[0]?.PipelineStageID;

// ── the seeded B2B pipeline, read rather than assumed ──────────────────────
const stages = await q(`
    SELECT s.ID, s.Code, s.OrderStatusOnEntry
      FROM __mj_BizAppsSales.PipelineStage s
      JOIN __mj_BizAppsSales.Pipeline p ON p.ID = s.PipelineID
     WHERE p.Code = 'B2B' AND s.IsActive = 1
     ORDER BY s.DisplayOrder`);
const by = (code) => stages.find((s) => s.Code === code);
console.log(`\n  ${DB_DATABASE} — B2B stages: ${stages.map((s) => `${s.Code}=${s.OrderStatusOnEntry ?? '—'}`).join(' ')}\n`);

ck(by('DISC')?.OrderStatusOnEntry === null, 'DISC says nothing about the order (the default)');
ck(by('PROP')?.OrderStatusOnEntry === 'Quoted', 'PROP quotes it', by('PROP')?.OrderStatusOnEntry);
ck(by('LOST')?.OrderStatusOnEntry === 'Voided', 'LOST voids it (S-US7)', by('LOST')?.OrderStatusOnEntry);

const pipe = (await q("SELECT ID, CompanyID FROM __mj_BizAppsSales.Pipeline WHERE Code='B2B'"))[0];
const dtype = (await q('SELECT TOP 1 ID FROM __mj_BizAppsSales.DealType WHERE IsActive=1'))[0];
const open = (await q('SELECT TOP 1 ID FROM __mj_BizAppsSales.DealStatusType WHERE IsOpen=1 AND IsActive=1'))[0];
const account = (await q('SELECT TOP 1 ID FROM __mj_BizAppsSales.SalesAccount WHERE IsActive=1'))[0];

// ── a deal born on DISC: no stage opinion, so the order is orders' default ──
const deal = await md.GetEntityObject('MJ_BizApps_Sales: Deals', user);
deal.NewRecord();
deal.Name = `Stage-order walk ${Math.abs(Date.now() % 100000)}`;
deal.PipelineID = pipe.ID;
deal.PipelineStageID = by('DISC').ID;
deal.DealTypeID = dtype.ID;
deal.DealStatusTypeID = open.ID;
deal.AccountID = account?.ID ?? null;
deal.TermMonths = 12;
ck(await deal.Save(), 'a deal is created on DISC', deal.LatestResult?.CompleteMessage ?? '');
const orderID = deal.OrderID;
ck(!!orderID, 'and it provisioned an order', orderID ?? 'null');
ck(await orderStatus(orderID) === 'Draft', 'which is Draft — DISC named nothing', await orderStatus(orderID));

/** Moves the deal through the WRITE PATH and returns the warnings the save produced. */
async function move(toCode) {
    const d = await md.GetEntityObject('MJ_BizApps_Sales: Deals', user);
    await d.Load(deal.ID);
    d.PipelineStageID = by(toCode).ID;
    const ok = await d.Save();
    return { ok, warnings: d.OrderStatusWarnings ?? [], entity: d };
}

// ── S-US5: PROP names Quoted, and the order follows ───────────────────────
{
    const { ok, warnings } = await move('PROP');
    ck(ok, 'the deal moves to PROP');
    ck(warnings.length === 0, 'with no warnings', warnings.join(' | '));
    ck(await orderStatus(orderID) === 'Quoted', 'and the order is now Quoted (S-US5)', await orderStatus(orderID));
}

// ── a stage with no opinion leaves it alone ───────────────────────────────
{
    await move('QUAL');
    ck(await orderStatus(orderID) === 'Quoted', 'moving to QUAL (no opinion) leaves it Quoted', await orderStatus(orderID));
}

// ── S-US7: LOST voids it ──────────────────────────────────────────────────
{
    const { ok, warnings } = await move('LOST');
    ck(ok, 'the deal moves to LOST');
    ck(warnings.length === 0, 'with no warnings — Quoted to Voided is legal', warnings.join(' | '));
    ck(await orderStatus(orderID) === 'Voided', 'and the order is Voided (S-US7)', await orderStatus(orderID));
}

// ── S-US8: back to PROP is REFUSED, and the deal moves anyway ─────────────
{
    const { ok, warnings } = await move('PROP');
    ck(ok, 'the deal moves BACK to PROP even though the order cannot follow (S-US8)');
    ck(String(await dealStage(deal.ID)).toLowerCase() === String(by('PROP').ID).toLowerCase(),
       'the stage change reached the database');
    ck(await orderStatus(orderID) === 'Voided', 'the order stayed Voided — not half-moved', await orderStatus(orderID));
    ck(warnings.length === 1, 'and exactly one warning says so', String(warnings.length));
    if (warnings[0]) console.log(`\n      warning: ${warnings[0]}\n`);
}

// ── clean up ──────────────────────────────────────────────────────────────
await pool.request().query(`DELETE FROM __mj_BizAppsSales.DealStageEvent WHERE DealID='${deal.ID}'`);
await pool.request().query(`DELETE FROM __mj_BizAppsSales.DealTeamMember WHERE DealID='${deal.ID}'`);
await pool.request().query(`DELETE FROM __mj_BizAppsSales.DealPaymentSchedule WHERE DealID='${deal.ID}'`);
await pool.request().query(`UPDATE __mj_BizAppsSales.Deal SET OrderID=NULL WHERE ID='${deal.ID}'`);
await pool.request().query(`DELETE FROM __mj_BizAppsOrders.OrderLine WHERE OrderHeaderID='${orderID}'`);
await pool.request().query(`DELETE FROM __mj_BizAppsOrders.OrderHeader WHERE ID='${orderID}'`);
await pool.request().query(`DELETE FROM __mj_BizAppsSales.Deal WHERE ID='${deal.ID}'`);
const left = (await q(`SELECT COUNT(*) n FROM __mj_BizAppsSales.Deal WHERE ID='${deal.ID}'`))[0].n;
ck(left === 0, 'cleaned up after itself');

console.log(`\n  ${bad === 0 ? 'ALL CHECKS PASSED' : bad + ' CHECK(S) FAILED'}\n`);
await pool.close();
process.exit(bad === 0 ? 0 : 1);
