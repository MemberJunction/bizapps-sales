/**
 * Proof for the Deal -> embedded Order foundation. Temporary; not committed.
 *
 * Exit criterion: a Deal whose OrderID_Object resolves to a REAL OrderHeader.
 * Everything asserted here goes through the ENTITY LAYER — the claim is about the
 * entity contract, so raw SQL is used only to name the database.
 */
import dotenv from 'dotenv';
import sql from 'mssql';
dotenv.config();

const { DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD } = process.env;
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
const { UserCache } = await import('@memberjunction/generic-database-provider');
const provider = await setupSQLServerClient(
    new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'),
);
await UserCache.Instance.Refresh(pool);
const user = UserCache.Users.find((u) => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
if (!user) { console.error('no context user'); process.exit(2); }

await import('@mj-biz-apps/sales-server').then((m) => m.LoadBizAppsSalesServer?.());
// ORDERS' SERVER CLASSES. Not optional here: without them ClassFactory resolves the GENERATED
// OrderHeader, which does not mint OrderNumber (NOT NULL), so the embedded insert fails. Errors are
// NOT swallowed — a silent miss here produced a save that reported success and wrote nothing.
try {
    const om = await import('@mj-biz-apps/orders-server');
    if (typeof om.LoadBizAppsOrdersServer !== 'function') {
        throw new Error('orders-server has no LoadBizAppsOrdersServer export');
    }
    om.LoadBizAppsOrdersServer();
    console.log('    orders server classes: LOADED');
} catch (e) {
    console.log('    orders server classes: FAILED TO LOAD — ' + e.message);
    process.exitCode = 2;
}

const { Metadata, RunView } = await import('@memberjunction/core');
const md = new Metadata();

let failures = 0;
const check = (ok, label, detail) => {
    console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
    if (!ok) failures++;
};
const line = (s) => console.log('    ' + s);

console.log(`\n  database: ${DB_DATABASE}\n`);

// ── 1. OrderID is a registered field, not merely a column ──────────────────
const dealEI = provider.EntityByName('MJ_BizApps_Sales: Deals');
const f = dealEI?.Fields.find((x) => x.Name === 'OrderID');
check(!!f, 'OrderID is a registered EntityField',
    f ? `${f.Type}, nullable=${f.AllowsNull}, related=${f.RelatedEntity ?? 'none'}` : 'NOT FOUND');

// ── 2. a real deal to work with ────────────────────────────────────────────
const rv = new RunView();
const found = await rv.RunView({
    EntityName: 'MJ_BizApps_Sales: Deals',
    ExtraFilter: 'DealNumber IS NOT NULL',
    OrderBy: 'DealNumber ASC',
    ResultType: 'simple',
    Fields: ['ID', 'DealNumber', 'Name', 'CompanyID', 'OrderID'],
}, user);
const seed = (found.Results ?? [])[0];
if (!seed) { console.error('    no deals on this host'); process.exit(2); }
line(`deal ${seed.DealNumber} — "${seed.Name}"  (OrderID before: ${seed.OrderID ?? 'null'})`);

// ── 3. the embed is reachable through the entity ───────────────────────────
const deal = await md.GetEntityObject('MJ_BizApps_Sales: Deals', user);
check(!!deal, 'GetEntityObject returned a Deal', deal?.constructor?.name);
check(await deal.Load(seed.ID), 'Deal.Load() succeeded');
check(typeof deal.OrderID_EnsureObject === 'function', 'OrderID_EnsureObject() exists');

// ── 4. Ensure() provisions a real OrderHeader ─────────────────────────────
const order = deal.OrderID_EnsureObject();
check(!!order, 'Ensure() returned an object', order?.constructor?.name);
check(order?.EntityInfo?.Name === 'MJ_BizApps_Orders: Order Headers',
    'the embedded peer IS an OrderHeader', `EntityInfo.Name = ${order?.EntityInfo?.Name}`);
check(order?.Status === 'Draft', "orders defaulted Status to 'Draft'", `Status = ${order?.Status}`);

// ── 5. one save writes the graph ──────────────────────────────────────────
order.CompanyID = deal.CompanyID;
const saved = await deal.Save();
check(saved, 'deal.Save() persisted the graph',
    saved ? '' : (deal.LatestResult?.CompleteMessage ?? 'unknown error'));
check(!!deal.OrderID, 'Deal.OrderID stamped by the save', `${deal.OrderID ?? 'null'}`);
check(!!order.ID && !!order.OrderNumber, 'orders minted the order number',
    `OrderNumber = ${order.OrderNumber ?? 'null'}`);

// ── 6. THE EXIT CRITERION — a fresh read resolves the embedded order ──────
const fresh = await md.GetEntityObject('MJ_BizApps_Sales: Deals', user);
await fresh.Load(seed.ID);
const emb = fresh.OrderID_Object;
check(!!emb, 'a freshly loaded Deal resolves OrderID_Object');
check(emb?.EntityInfo?.Name === 'MJ_BizApps_Orders: Order Headers',
    'and it is a real OrderHeader', `${emb?.EntityInfo?.Name}`);
check(String(emb?.ID).toLowerCase() === String(deal.OrderID).toLowerCase(),
    'and it is THE order the deal points at', `${emb?.OrderNumber} / ${emb?.ID}`);
check(emb?.IsSaved === true, 'and it is a persisted row, not a new one');

console.log(`\n  ${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}\n`);
await pool.close();
process.exit(failures === 0 ? 0 : 1);
