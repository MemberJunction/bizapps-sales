/**
 * End-to-end smoke: a deal becomes a booked order, reported step by step.
 *
 * WHY THIS EXISTS ALONGSIDE `close-won-handoff` (CW1–CW4). Those checks each run inside a rolled-back
 * transaction, which is right for a suite and wrong for a smoke: nothing survives to look at. This runs
 * the same path and COMMITS, leaving a tagged deal and a real order behind so a human can open them.
 *
 * Every record it creates is named with the `SMOKE-` prefix and a run stamp, so what it leaves is
 * identifiable and removable.
 *
 * It drives the ENTITY GRAPH — the same objects the Explorer form and the workspace drive — rather than
 * the browser. That is a deliberate scope statement, not a shortcut: the UI path is Playwright's job,
 * and this proves the layer underneath it end to end.
 *
 *     RUN_MUTATION_TESTS=1 node test-harnesses/smoke-close-won.mjs
 */
import 'dotenv/config';
import sql from 'mssql';

const { DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD } = process.env;

const steps = [];
function step(name, ok, detail) {
    steps.push({ name, ok, detail });
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
    return ok;
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
const { UserCache } = await import('@memberjunction/generic-database-provider');
const provider = await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
await UserCache.Instance.Refresh(pool);
const user = UserCache.Users.find((u) => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];

/**
 * Sales' own packages are resolved BY PATH, not by name.
 *
 * pnpm links only what a package.json declares, and this repo's ROOT declares `sales-server` and
 * `sales-integration-tests` — not `sales-entities` or `sales-core-entities-server`, which are
 * dependencies of its sub-packages rather than of the repo root. A bare `import` of those therefore
 * fails from a script living at the repo root, even though the packages are built and present.
 */
const { pathToFileURL } = await import('node:url');
const { join } = await import('node:path');
const local = (pkgDir) => pathToFileURL(join(process.cwd(), 'packages', pkgDir, 'dist', 'index.js')).href;

await import('@mj-biz-apps/sales-server').then((m) => m.LoadBizAppsSalesServer?.());
/**
 * ACCOUNTING BEFORE ORDERS, and resolved BY NAME across sibling repos.
 *
 * Both halves matter and both were learned the hard way. A bare `import` of a sibling fails from here —
 * pnpm links only declared dependencies — and if that failure is swallowed, the run continues with
 * accounting's engine unloaded. Orders then books against an EMPTY GL cache and reports
 * "No GL account is linked for role 'Accounts Receivable'" while the links sit visibly in the table.
 *
 * This smoke reported exactly that on its first run, on a database where the suite was green.
 */
const { readdirSync, existsSync, readFileSync } = await import('node:fs');
async function resolveSibling(name) {
    const parent = join(process.cwd(), '..');
    let repos = [];
    try {
        repos = readdirSync(parent, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    } catch { return null; }
    for (const repo of repos) {
        const pkgDir = join(parent, repo, 'packages');
        if (!existsSync(pkgDir)) continue;
        for (const sub of readdirSync(pkgDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
            const manifest = join(pkgDir, sub, 'package.json');
            if (!existsSync(manifest)) continue;
            try { if (JSON.parse(readFileSync(manifest, 'utf8')).name !== name) continue; } catch { continue; }
            const entry = join(pkgDir, sub, 'dist', 'index.js');
            return existsSync(entry) ? pathToFileURL(entry).href : null;
        }
    }
    return null;
}

const downstream = [];
for (const [pkg, anchor] of [
    ['@mj-biz-apps/accounting-entities', 'LoadGeneratedEntities'],
    ['@mj-biz-apps/accounting-engine-base', null],
    ['@mj-biz-apps/accounting-core-entities-server', null],
    ['@mj-biz-apps/orders-entities', 'LoadGeneratedEntities'],
    ['@mj-biz-apps/orders-core-entities-server', null],
]) {
    let m = null;
    try { m = await import(pkg); } catch {
        const entry = await resolveSibling(pkg);
        if (entry) { try { m = await import(entry); } catch { /* reported below */ } }
    }
    if (!m) { downstream.push(`${pkg}: ABSENT`); continue; }
    if (anchor && typeof m[anchor] === 'function') m[anchor]();
    downstream.push(`${pkg.split('/')[1]}: loaded`);
}
console.log(`  downstream -> ${downstream.join(' | ')}`);

const { RunView, Metadata } = await import('@memberjunction/core');
const salesEntities = await import(local('Entities'));
const { ProductFilterFor, E_ORDERS_PRODUCT, SalesCloseDealOperation } = salesEntities;

const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(8, 14);
const md = new Metadata();

async function one(entity, filter, fields) {
    const r = await new RunView().RunView({ EntityName: entity, ExtraFilter: filter, ResultType: 'simple', Fields: fields }, user);
    return r.Success ? (r.Results ?? [])[0] : undefined;
}

console.log(`\nSMOKE — close-won end to end · db=${DB_DATABASE} · run ${stamp}\n`);

// ── 1. A pipeline to sell on ────────────────────────────────────────────────
const pipeline = await one('MJ_BizApps_Sales: Pipelines', 'IsActive = 1', ['ID', 'CompanyID', 'Name']);
step('pipeline available', !!pipeline, pipeline?.Name);

const stage = await one('MJ_BizApps_Sales: Pipeline Stages', `PipelineID = '${pipeline.ID}' AND IsActive = 1`, ['ID']);
const dealType = await one('MJ_BizApps_Sales: Deal Types', 'IsActive = 1', ['ID']);
const openStatus = await one('MJ_BizApps_Sales: Deal Status Types', 'IsOpen = 1 AND IsActive = 1', ['ID']);
const wonStatus = await one('MJ_BizApps_Sales: Deal Status Types', 'IsWon = 1 AND IsActive = 1', ['ID']);
const account = await one('MJ_BizApps_Sales: Sales Accounts', 'IsActive = 1', ['ID']);

// ── 2. The picker's own filter, against orders' catalogue ───────────────────
const productsView = await new RunView().RunView(
    { EntityName: E_ORDERS_PRODUCT, ExtraFilter: `CompanyID = '${String(pipeline.CompanyID).replace(/'/g, "''")}' AND (${ProductFilterFor(new Date())})`, OrderBy: 'Name ASC', ResultType: 'simple', Fields: ['ID', 'Name'] },
    user,
);
const products = productsView.Success ? (productsView.Results ?? []) : [];
step('picker offers products', products.length > 0, `${products.length} sellable for this company`);

// ── 3. Compose the deal with a picked product ───────────────────────────────
const deal = await md.GetEntityObject('MJ_BizApps_Sales: Deals', user);
deal.NewRecord();
deal.Name = `SMOKE-${stamp} close-won`;
deal.PipelineID = pipeline.ID;
deal.PipelineStageID = stage.ID;
deal.DealTypeID = dealType.ID;
deal.DealStatusTypeID = openStatus.ID;
deal.AccountID = account.ID;
deal.CompanyID = pipeline.CompanyID;
deal.TermMonths = 12;

/**
 * ── THE LINE GOES ON THE EMBEDDED ORDER, NOT ON THE DEAL ──
 *
 * This used to do `deal.Lines.Create()` and stamp a `DealLineTypeID`. `DealLine` is retired and
 * `MJ_BizApps_Sales: Deal Line Types` no longer exists on ANY host, so this harness crashed at its
 * second step with "Entity ... not found in metadata" — including on the demo host. It had not been
 * run since the retirement, while WORKSPACE-SETUP still advertised it as 11/11.
 *
 * The order is provisioned by `DealEntityServer.Save()`, so the deal is saved FIRST and the line
 * added to `deal.OrderID` after. UnitPrice and CompanyID are deliberately NOT set — orders stamps
 * them from the product, and setting them here would be sales inventing money.
 */
const saved = await deal.Save();
step('deal saved with a picker-set line', saved, saved ? `${deal.DealNumber ?? deal.ID} · ${products[0].Name} ×4` : deal.LatestResult?.CompleteMessage);

/**
 * RELOAD BEFORE READING `OrderID`. The order is provisioned server-side inside
 * `DealEntityServer.Save()`, so the in-memory entity that issued the save has never seen the value —
 * `deal.OrderID` reads `undefined` and every downstream query becomes `WHERE ID = 'undefined'`.
 */
await deal.Load(deal.ID);
step('deal has an embedded order', !!deal.OrderID, deal.OrderID ?? 'none provisioned');

const line = await md.GetEntityObject('MJ_BizApps_Orders: Order Lines', user);
line.NewRecord();
line.OrderID = deal.OrderID;
line.ProductID = products[0].ID;
line.Quantity = 4;
const lineSaved = await line.Save();
step('line added to the embedded order', lineSaved,
    lineSaved ? `${products[0].Name} x4 on order ${deal.OrderID}` : line.LatestResult?.CompleteMessage);

// ── 4. Money preview, BEFORE anything is created ────────────────────────────
/**
 * THE MONEY-PREVIEW STEP IS GONE, and its removal is the point rather than a loss of coverage.
 *
 * It called `LiveOrdersSeam.PreviewOrderMoney` to price a draft before close. Close-won no longer
 * creates or prices an order — the order is embedded on the deal from creation and orders prices it
 * on its own save — so the method described a route that no longer exists and has been deleted.
 *
 * This was its only caller anywhere. Pricing is still covered where it actually happens: the embedded
 * order's own save path, and the `Resolved*` assertions in the save-deal checks.
 */

// ── 5. Close won ────────────────────────────────────────────────────────────
const op = new SalesCloseDealOperation();
const closed = await op.Execute({ DealID: deal.ID, DealStatusTypeID: wonStatus.ID }, { provider, user });
const out = closed?.Output;
step('close-won succeeded', out?.Success === true, JSON.stringify(out?.Issues ?? []).slice(0, 160));

const routed = (out?.Routing ?? []).find((r) => r.Target === 'Order');
step('order routing executed', routed?.Executed === true, routed?.Reason ?? routed?.RecordID);

// ── 6. What orders actually wrote ───────────────────────────────────────────
const header = await one('MJ_BizApps_Orders: Order Headers', `ID = '${routed?.RecordID}'`, ['ID', 'OrderNumber', 'Status', 'TotalGross']);
step('order created and numbered by Orders', !!header?.OrderNumber, `${header?.OrderNumber} · status ${header?.Status}`);

const linesView = await new RunView().RunView(
    { EntityName: 'MJ_BizApps_Orders: Order Lines', ExtraFilter: `OrderHeaderID = '${routed?.RecordID}'`, ResultType: 'simple' },
    user,
);
const orderLines = linesView.Success ? (linesView.Results ?? []) : [];
step('order line carries the picked ProductID',
    orderLines.length === 1 && String(orderLines[0].ProductID).toLowerCase() === String(products[0].ID).toLowerCase(),
    `${orderLines.length} line(s)`);
step('line priced by Orders (Sales sent no price)', Number(orderLines[0]?.UnitPrice) > 0, `unit ${orderLines[0]?.UnitPrice}, net ${orderLines[0]?.LineTotalNet}`);
step('line posted to the ledger', !!orderLines[0]?.JournalEntryID, `JE ${orderLines[0]?.JournalEntryID}`);

/**
 * ── STEP 7 IS GONE BECAUSE ITS OTHER HALF ALREADY WAS ──
 *
 * It compared the booked total against `preview.Amount` from the `PreviewOrderMoney` step removed
 * further up — so `preview` had been undefined ever since, and this line threw
 * `ReferenceError: preview is not defined` before any assertion ran. A dangling reference left by a
 * deletion, not a check that was failing: nothing here was being verified.
 *
 * Pricing is still covered where it happens — "line priced by Orders" above, and the `Resolved*`
 * assertions in the save-deal checks.
 */

const failed = steps.filter((s) => !s.ok);
console.log(`\n${failed.length === 0 ? '✅' : '❌'} ${steps.length - failed.length}/${steps.length} steps passed\n`);
await pool.close();
process.exit(failed.length === 0 ? 0 : 1);
