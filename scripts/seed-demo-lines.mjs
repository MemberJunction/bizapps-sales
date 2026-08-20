/**
 * @fileoverview The second half of the demo seed: order lines, through the ENTITY LAYER.
 *
 * ── WHY THIS IS NOT IN seed-demo-data.sh ────────────────────────────────────────────────────────
 *
 * Because SQL cannot write an order line honestly. `OrderLine.UnitPrice` and `CompanyID` are stamped by
 * `OrderLineEntityServer` from the product, and `LineTotalGross` comes from orders' pricing engine — so a
 * SQL seed can only produce them by inventing money, which is the one thing Rule 1 forbids. The old seed
 * sidestepped that by writing `DealLine` rows with transcribed figures; that table is retired, and this
 * is what replaces it.
 *
 * It also fixes something the SQL seed cannot: a deal seeded by INSERT has NO EMBEDDED ORDER at all,
 * because provisioning lives in `DealEntityServer.Save()`. Every seeded deal was missing the object the
 * whole redesign is about. Loading and saving each one through the entity layer is what gives it one.
 *
 * ── WHAT IT LEAVES ALONE, AND WHY THAT IS THE POINT ─────────────────────────────────────────────
 *
 * The D2C deals keep their STATED amounts and get no lines. Their pipeline carries
 * `RequiresDealLines = 0`, which is the L-2 simple motion: a human types a figure and is owed no
 * explanation. So after this runs the demo shows BOTH cases on screen — deals whose amount is a cache of
 * what orders priced (`AmountIsComputed = 1`, stamped and fingerprinted) and deals whose amount is
 * somebody's word (`AmountIsComputed = 0`, untouched). One without the other makes the distinction
 * invisible, which was the gap this closes.
 *
 * Idempotent: existing lines on a target deal are cleared first, so the demo lands in a known state
 * however many times it is run.
 *
 * USAGE  node scripts/seed-demo-lines.mjs        (after scripts/seed-demo-data.sh, and after a build)
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

/**
 * ORDERS' SERVER CLASSES ARE MANDATORY HERE, and the failure without them is misleading: nothing mints
 * `OrderNumber`, the insert dies on a NOT NULL violation inside the save graph, and what surfaces names
 * an entity rather than a missing import. So it is checked rather than discovered.
 */
try {
    const orders = await import('@mj-biz-apps/orders-server');
    orders.LoadBizAppsOrdersServer();
} catch (err) {
    console.error(
        '\n  bizapps-orders is not resolvable from this repo, so order lines cannot be seeded.\n' +
        '  The deals themselves are already seeded by scripts/seed-demo-data.sh; this step adds the\n' +
        '  lines that make Deal.Amount a computed figure rather than a stated one.\n' +
        `  (${err instanceof Error ? err.message : String(err)})\n`,
    );
    await pool.close();
    process.exit(2);
}

const { Metadata } = await import('@memberjunction/core');
const md = new Metadata();
const q = async (text) => (await pool.request().query(text)).recordset;

/**
 * What each deal should end up carrying, by SKU and quantity.
 *
 * QUANTITIES ONLY — no prices, not even as a comment. The catalogue prices these (PLAT-STD is 406 per
 * unit today), and writing an expected total here would be this file quietly doing the arithmetic the
 * app refuses to do. What the deal is worth is whatever orders says it is worth after this runs.
 *
 * The two D2C deals are absent on purpose. See the header.
 */
const PLAN = [
    { Deal: 'DEAL-9001', Lines: [['PLAT-STD', 250], ['PLAT-PRM', 100]] },
    { Deal: 'DEAL-9002', Lines: [['PLAT-STD', 40]] },
    { Deal: 'DEAL-9003', Lines: [['PLAT-STD', 180]] },
    { Deal: 'DEAL-9005', Lines: [['PLAT-PRM', 120]] },
    { Deal: 'DEAL-9006', Lines: [['PLAT-STD', 30]] },
];

/**
 * Clears an order's lines, children first.
 *
 * A line is not a leaf: orders records a `OrderLinePriceComponent` per line — the breakdown behind the
 * price it resolved — plus dimensions and allocations. The first version of this deleted lines directly
 * and hit `FK_OLPC_OrderLine`, which is orders telling us the price it computed is a record in its own
 * right and not a derived value to be thrown away silently.
 *
 * Only the tables that can exist on a freshly-priced demo line are cleared. Subscriptions, entitlements,
 * payment lines and reversals arrive from CONFIRMING an order, which the demo seed never does — if this
 * ever fails on one of those FKs, the seed has started booking and the fix is to stop, not to widen this.
 */
async function clearOrderLines(orderID) {
    const child = ['OrderLinePriceComponent', 'OrderLineDimension', 'OrderAdjustmentAllocation', 'OrderChargeAllocation'];
    for (const table of child) {
        await pool.request().query(`
            DELETE c FROM __mj_BizAppsOrders.${table} c
              JOIN __mj_BizAppsOrders.OrderLine l ON l.ID = c.OrderLineID
             WHERE l.OrderHeaderID = '${orderID}'`);
    }
    await pool.request().query(`DELETE FROM __mj_BizAppsOrders.OrderLine WHERE OrderHeaderID='${orderID}'`);
}

let failures = 0;
const note = (ok, text) => { console.log(`    ${ok ? '·' : '!'} ${text}`); if (!ok) failures++; };

console.log(`\n  Seeding order lines through the entity layer — ${DB_DATABASE}\n`);

const openStatus = (await q("SELECT TOP 1 ID FROM __mj_BizAppsSales.DealStatusType WHERE IsOpen=1 AND IsActive=1"))[0];

for (const plan of PLAN) {
    const row = (await q(`
        SELECT d.ID, d.DealNumber, d.CompanyID, d.DealStatusTypeID, st.LocksDeal
          FROM __mj_BizAppsSales.Deal d
          JOIN __mj_BizAppsSales.DealStatusType st ON st.ID = d.DealStatusTypeID
         WHERE d.DealNumber = '${plan.Deal}'`))[0];
    if (!row) { note(false, `${plan.Deal} not found — run scripts/seed-demo-data.sh first`); continue; }

    /**
     * A CLOSED DEAL IS LOCKED, and the lock is doing its job — `DealEntityServer.Save()` refuses every
     * write once the persisted status carries `LocksDeal`. A seed is constructing a PAST state rather
     * than editing a live deal, so it lifts the status in SQL, builds the order through the entity
     * layer, and puts the status back. Deliberately not via `Sales.ReopenDeal`: that records a reason in
     * the append-only log, and a demo fixture inventing audit history is worse than none.
     */
    const wasLocked = row.LocksDeal === true;
    if (wasLocked) {
        await pool.request().query(
            `UPDATE __mj_BizAppsSales.Deal SET DealStatusTypeID='${openStatus.ID}' WHERE ID='${row.ID}'`);
    }

    try {
        // Idempotent: clear whatever is there, so a re-run lands in the same place. Deleting demo rows in
        // SQL is what the rest of the seed does; it is not a workaround for KI-20, which is about the
        // APP being unable to delete a line a user removed.
        const existingOrder = (await q(`SELECT OrderID FROM __mj_BizAppsSales.Deal WHERE ID='${row.ID}'`))[0]?.OrderID;
        if (existingOrder) {
            await clearOrderLines(existingOrder);
        }

        /**
         * THE STATED AMOUNT IS CLEARED FIRST, and this is the seed making a declaration rather than a
         * workaround. `DealEntityServer` refuses to overwrite a hand-typed figure (save-deal.SD22), and
         * the SQL seed types one onto every deal — so a lined deal would keep its stated number and the
         * cache would never fire, which is exactly the gap this script exists to close. Setting it back
         * to "nobody has said" is how the seed says this deal's worth is owed by its order.
         */
        await pool.request().query(`
            UPDATE __mj_BizAppsSales.Deal
               SET Amount = NULL, AmountIsComputed = 0, AmountComputedAt = NULL, AmountSourceHash = NULL
             WHERE ID = '${row.ID}'`);

        const deal = await md.GetEntityObject('MJ_BizApps_Sales: Deals', user);
        if (!(await deal.Load(row.ID))) { note(false, `${plan.Deal} could not be loaded`); continue; }

        // The save below provisions the order when the deal has none — which is every SQL-seeded deal.
        const order = deal.OrderID_EnsureObject();
        if (deal.OrderID) {
            await order.LoadRelatedRecords('Lines');
        }

        for (const [sku, qty] of plan.Lines) {
            const product = (await q(`
                SELECT TOP 1 ID FROM __mj_BizAppsOrders.Product
                 WHERE SKU='${sku}' AND CompanyID='${row.CompanyID}' AND Status='Active'`))[0];
            if (!product) { note(false, `${plan.Deal}: no active product ${sku} for its company`); continue; }
            const line = await order.Lines.Create();
            line.ProductID = product.ID;
            line.Quantity = qty;
            // NO PRICE SET. Orders resolves UnitPrice and stamps CompanyID from the product.
        }

        if (!(await deal.Save())) {
            note(false, `${plan.Deal} did not save — ${deal.LatestResult?.CompleteMessage ?? 'no message'}`);
            continue;
        }
        note(true, `${plan.Deal}: ${plan.Lines.length} line(s) priced by orders`);
    } finally {
        if (wasLocked) {
            await pool.request().query(
                `UPDATE __mj_BizAppsSales.Deal SET DealStatusTypeID='${row.DealStatusTypeID}' WHERE ID='${row.ID}'`);
        }
    }
}

/**
 * The closed deals' orders are moved to the status their STAGE names, because that is where they would
 * have arrived had the deal been closed through the app rather than INSERTed closed. Driven through the
 * entity layer so orders' own transition rules decide whether each move is legal.
 */
console.log('');
// The alias is `ordStatus` rather than `current` because CURRENT is reserved in T-SQL — the first
// version of this query failed with `Incorrect syntax near the keyword 'current'`.
//
// EVERY DEAL, NOT JUST THE TWO CLOSED ONES. It was the closed pair for a while, and the story audit
// caught what that missed: DEAL-9003 sits at Proposal, a stage declaring `Quoted`, with its order in
// Draft. The product defect behind it is fixed (provisioning now asks the stage — save-deal.SD25), but
// these seven deals were provisioned before that landed, so the seed has to bring them into line.
// Deals whose stage says nothing are skipped by the `!row.target` guard below.
for (const dealNumber of PLAN.map((x) => x.Deal).concat(['DEAL-9004', 'DEAL-9007'])) {
    const row = (await q(`
        SELECT d.OrderID, s.OrderStatusOnEntry target, o.Status AS ordStatus
          FROM __mj_BizAppsSales.Deal d
          JOIN __mj_BizAppsSales.PipelineStage s ON s.ID = d.PipelineStageID
          LEFT JOIN __mj_BizAppsOrders.OrderHeader o ON o.ID = d.OrderID
         WHERE d.DealNumber = '${dealNumber}'`))[0];
    if (!row?.OrderID || !row.target || row.ordStatus === row.target) { continue; }
    const order = await md.GetEntityObject('MJ_BizApps_Orders: Order Headers', user);
    if (!(await order.Load(row.OrderID))) { note(false, `${dealNumber}: its order could not be loaded`); continue; }
    order.Status = row.target;
    note(await order.Save(),
        `${dealNumber}: order ${row.ordStatus} -> ${row.target}, the state its stage names` +
        (order.LatestResult?.Success === false ? ` (refused: ${order.LatestResult?.CompleteMessage})` : ''));
}

/**
 * THE STATED DEALS GET AN ORDER TOO — just no lines.
 *
 * S-US4 says every deal carries one, and a demo where two deals have none contradicts the model it is
 * demonstrating. Saving them through the entity layer provisions one and touches nothing else: the
 * amount writer sees a `TotalGross` of NULL and leaves their stated figures exactly where they are,
 * which is the case save-deal.SD23 pins down. So the demo ends up showing all three states — priced,
 * stated-with-an-empty-order, and the order statuses a stage put there.
 */
console.log('');
for (const dealNumber of ['DEAL-9004', 'DEAL-9007']) {
    const row = (await q(`SELECT ID, OrderID FROM __mj_BizAppsSales.Deal WHERE DealNumber='${dealNumber}'`))[0];
    if (!row || row.OrderID) { continue; }
    const deal = await md.GetEntityObject('MJ_BizApps_Sales: Deals', user);
    if (!(await deal.Load(row.ID))) { note(false, `${dealNumber} could not be loaded`); continue; }
    // Touched deliberately so there is something to save; the amount is NOT among the fields set.
    deal.NextStep = deal.NextStep ?? 'Confirm scope';
    const ok = await deal.Save();
    note(ok, ok
        ? `${dealNumber}: order provisioned, no lines, stated amount untouched`
        : `${dealNumber} did not save — ${deal.LatestResult?.CompleteMessage ?? 'no message'}`);
}

// ── VERIFY AGAINST THE DATABASE, not against what this script believes it did ──────────────────
console.log('\n  === Deal.Amount provenance, read back from the database ===\n');
const check = await q(`
    SELECT d.DealNumber, p.RequiresDealLines rdl, d.Amount, d.AmountIsComputed ic,
           d.AmountComputedAt at, d.AmountSourceHash hash, o.Status ordStatus, o.TotalGross tg,
           (SELECT COUNT(*) FROM __mj_BizAppsOrders.OrderLine l WHERE l.OrderHeaderID = o.ID) lines
      FROM __mj_BizAppsSales.Deal d
      JOIN __mj_BizAppsSales.Pipeline p ON p.ID = d.PipelineID
      LEFT JOIN __mj_BizAppsOrders.OrderHeader o ON o.ID = d.OrderID
     WHERE d.DealNumber LIKE 'DEAL-9%'
     ORDER BY d.DealNumber`);

for (const r of check) {
    const priced = r.ic === true;
    console.log(
        `    ${r.DealNumber}  ${(priced ? 'PRICED' : 'stated').padEnd(7)}` +
        `amount=${String(r.Amount ?? '—').padStart(9)}  lines=${String(r.lines).padStart(2)}  ` +
        `order=${String(r.ordStatus ?? '—').padEnd(8)}total=${String(r.tg ?? '—').padStart(9)}  ` +
        `stampedAt=${r.at ? 'yes' : 'no '}  hash=${r.hash ? 'yes' : 'no '}`,
    );
    if (priced) {
        if (Number(r.Amount) !== Number(r.tg)) { note(false, `${r.DealNumber}: amount ${r.Amount} != order total ${r.tg}`); }
        if (!r.at) { note(false, `${r.DealNumber}: computed with no AmountComputedAt`); }
        if (!r.hash) { note(false, `${r.DealNumber}: computed with no AmountSourceHash`); }
    } else {
        if (r.hash) { note(false, `${r.DealNumber}: STATED yet carries a source hash`); }
        if (r.lines > 0) { note(false, `${r.DealNumber}: stated amount but ${r.lines} order line(s)`); }
        if (!r.ordStatus) { note(false, `${r.DealNumber}: no order at all — every deal carries one (S-US4)`); }
    }
}

const pricedCount = check.filter((r) => r.ic === true).length;
const statedCount = check.filter((r) => r.ic !== true).length;
console.log(`\n  ${pricedCount} priced, ${statedCount} stated — both cases are on screen.`);
if (pricedCount === 0 || statedCount === 0) {
    note(false, 'the demo needs BOTH: one case alone makes the distinction invisible');
}

console.log(failures === 0 ? '\n  Order lines seeded.\n' : `\n  ${failures} problem(s) — see the ! lines above.\n`);
await pool.close();
process.exit(failures === 0 ? 0 : 1);
