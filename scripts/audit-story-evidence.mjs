/**
 * @fileoverview Database evidence for the story audit. READ-MOSTLY, and restores what it touches.
 *
 * The audit's rule is "prove met criteria against the database, not the screen", and most criteria are
 * already proven by the 49 integration checks. This covers the three that are not:
 *
 *   1. Every deal carries an embedded order, with the status its stage declares (#33, #115, #121).
 *   2. No deal-level line-item table or entity exists anywhere (#33, #114).
 *   3. Whether `Deal.OwnerEmployeeID` REFUSES a direct edit, or merely gets overwritten (#33).
 *
 * (3) is the only mutation. It writes one column on one open deal through the entity layer, reads it
 * back, and restores the original in SQL — verified by re-reading. It is deliberately not wrapped in a
 * transaction: the question is what SURVIVES a save, and a rolled-back save cannot answer it.
 *
 * USAGE  node scripts/audit-story-evidence.mjs
 */
import dotenv from 'dotenv';
import sql from 'mssql';
dotenv.config();

const { DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD } = process.env;
const pool = await new sql.ConnectionPool({
    server: DB_HOST, port: Number(DB_PORT ?? 1433), database: DB_DATABASE,
    user: DB_USERNAME, password: DB_PASSWORD,
    options: { trustServerCertificate: true, encrypt: true }, requestTimeout: 120000,
}).connect();

const { setupSQLServerClient, SQLServerProviderConfigData } = await import('@memberjunction/sqlserver-dataprovider');
const { UserCache } = await import('@memberjunction/generic-database-provider');
await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
await UserCache.Instance.Refresh(pool);
const user = UserCache.Users.find((u) => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
await import('@mj-biz-apps/sales-server').then((m) => m.LoadBizAppsSalesServer?.());
try { (await import('@mj-biz-apps/orders-server')).LoadBizAppsOrdersServer(); } catch { /* reported below */ }

const { Metadata } = await import('@memberjunction/core');
const md = new Metadata();
const q = async (text) => (await pool.request().query(text)).recordset;
const line = (s) => console.log(s);

// ── 1. Every deal, its order, and the status its stage declares ──────────────────────────────────
line('\n=== E1  every deal carries an embedded order in the status its stage declares ===');
const deals = await q(`
    SELECT d.DealNumber, d.OrderID, d.Amount, d.AmountIsComputed, d.AmountComputedAt, d.AmountSourceHash,
           s.Name AS Stage, s.OrderStatusOnEntry, o.Status AS OrderStatus, o.TotalGross,
           (SELECT COUNT(*) FROM __mj_BizAppsOrders.OrderLine l WHERE l.OrderHeaderID = d.OrderID) AS Lines
      FROM __mj_BizAppsSales.Deal d
      JOIN __mj_BizAppsSales.PipelineStage s ON s.ID = d.PipelineStageID
      LEFT JOIN __mj_BizAppsOrders.OrderHeader o ON o.ID = d.OrderID
     ORDER BY d.DealNumber`);
for (const d of deals) {
    const declared = d.OrderStatusOnEntry ?? '(none)';
    const agrees = !d.OrderStatusOnEntry || d.OrderStatusOnEntry === d.OrderStatus ? 'ok' : 'DIVERGES';
    line(`  ${d.DealNumber}  order=${d.OrderID ? 'yes' : 'NONE'}  status=${String(d.OrderStatus).padEnd(9)}` +
        ` stage=${String(d.Stage).padEnd(13)} declares=${String(declared).padEnd(8)} ${agrees}` +
        `  amount=${d.Amount}  computed=${d.AmountIsComputed ? 1 : 0} lines=${d.Lines}`);
}
line(`  -> ${deals.filter((d) => d.OrderID).length}/${deals.length} deals have an embedded order`);
line(`  -> ${deals.filter((d) => d.AmountIsComputed).length} priced, ${deals.filter((d) => !d.AmountIsComputed).length} stated`);

// ── 2. No deal-level line items, anywhere ────────────────────────────────────────────────────────
line('\n=== E2  no deal-level line-item records exist anywhere ===');
const tables = await q(`
    SELECT TABLE_SCHEMA + '.' + TABLE_NAME AS t FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_NAME LIKE '%DealLine%'`);
const entities = await q(`SELECT Name FROM __mj.Entity WHERE Name LIKE '%Deal Line%' OR BaseTable LIKE '%DealLine%'`);
const fields = await q(`SELECT COUNT(*) AS n FROM __mj.EntityField WHERE Name LIKE '%DealLine%'`);
line(`  tables matching DealLine:   ${tables.length ? tables.map((r) => r.t).join(', ') : 'none'}`);
line(`  entities matching Deal Line: ${entities.length ? entities.map((r) => r.Name).join(', ') : 'none'}`);
line(`  entity fields named DealLine*: ${fields[0].n}`);

// ── 3. Does OwnerEmployeeID refuse a direct edit, or just get overwritten? ───────────────────────
line('\n=== E3  a hand-set OwnerEmployeeID on a header-only save: refused, or persisted? ===');
const target = (await q(`
    SELECT TOP 1 d.ID, d.DealNumber, d.OwnerEmployeeID
      FROM __mj_BizAppsSales.Deal d
      JOIN __mj_BizAppsSales.PipelineStage s ON s.ID = d.PipelineStageID
      JOIN __mj_BizAppsSales.DealStatusType t ON t.ID = s.DealStatusTypeID
     WHERE t.IsOpen = 1 AND d.OwnerEmployeeID IS NOT NULL
     ORDER BY d.DealNumber`))[0];
const other = (await q(`
    SELECT TOP 1 ID FROM __mj.Employee WHERE Active = 1 AND ID <> '${target.OwnerEmployeeID}'`))[0];
line(`  deal ${target.DealNumber}: owner stamp is ${target.OwnerEmployeeID}`);
line(`  setting it directly to ${other.ID} and saving WITHOUT touching the team...`);

const deal = await md.GetEntityObject('MJ_BizApps_Sales: Deals', user);
await deal.Load(target.ID);
deal.OwnerEmployeeID = other.ID;
const saved = await deal.Save();
const after = (await q(`SELECT OwnerEmployeeID FROM __mj_BizAppsSales.Deal WHERE ID = '${target.ID}'`))[0];
const teamOwner = (await q(`
    SELECT tm.EmployeeID FROM __mj_BizAppsSales.DealTeamMember tm
      JOIN __mj_BizAppsSales.DealRole r ON r.ID = tm.DealRoleID
     WHERE tm.DealID = '${target.ID}' AND r.IsOwnerRole = 1`))[0];
line(`  save returned ${saved}; error: ${deal.LatestResult?.Message ?? '(none)'}`);
line(`  stamp in the database now: ${after.OwnerEmployeeID}`);
line(`  owner-role team member:    ${teamOwner?.EmployeeID ?? '(none)'}`);
line(after.OwnerEmployeeID === other.ID
    ? '  -> PERSISTED. The direct edit was NOT refused, and the stamp now disagrees with the team row.'
    : '  -> the direct edit did not survive the save.');

await pool.request().query(
    `UPDATE __mj_BizAppsSales.Deal SET OwnerEmployeeID = '${target.OwnerEmployeeID}' WHERE ID = '${target.ID}'`);
const restored = (await q(`SELECT OwnerEmployeeID FROM __mj_BizAppsSales.Deal WHERE ID = '${target.ID}'`))[0];
line(restored.OwnerEmployeeID === target.OwnerEmployeeID
    ? '  restored.'
    : `  !! RESTORE FAILED — set ${target.DealNumber} OwnerEmployeeID back to ${target.OwnerEmployeeID} by hand.`);

await pool.close();
