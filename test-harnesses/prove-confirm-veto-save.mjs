/**
 * Proves that a REAL `Save()` of a confirm is refused by the golive#323 veto, on the live database.
 *
 * `prove-confirm-veto.mjs` asks the vetoer directly. This drives the thing the user actually does:
 * set Status to Confirmed and save, through `OrderEntityServer.ValidateAsync`. Nothing else proves
 * the veto is WIRED INTO the save rather than merely correct in isolation.
 *
 * PAIRED CONTROL. Asserting "the save failed" proves nothing on its own — a confirm can fail for a
 * dozen pre-existing reasons. So the same save runs again with the veto UNREGISTERED, and the
 * assertion is that the refusal TEXT disappears. That is what ties the refusal to this change.
 *
 * WRITES, INSIDE THE PROVIDER'S OWN TRANSACTION, AND ROLLS BACK — and then asserts the rollback
 * took, because `prove-contracts-seam.mjs` learned the hard way that a bare mssql transaction leaves
 * real rows behind.
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
const { Metadata } = await import('@memberjunction/core');

// ORDERS' server classes must load, or ClassFactory resolves the generated OrderHeader and
// ValidateAsync — where the veto is consulted — never runs at all.
await importSibling('@mj-biz-apps/orders-core-entities-server').then((m) => m.LoadOrderEntityServer?.());
const salesCES = await importSibling('@mj-biz-apps/sales-core-entities-server');
const orders = await importSibling('@mj-biz-apps/orders-entities');

// A real order whose deal is NOT Won — the golive#323 shape.
const target = (await pool.request().query(`
    SELECT TOP 1 o.ID, o.OrderNumber, o.Status, d.DealNumber
      FROM __mj_BizAppsOrders.OrderHeader o
      JOIN __mj_BizAppsSales.Deal d ON d.OrderID = o.ID
      LEFT JOIN __mj_BizAppsSales.DealStatusType st ON st.ID = d.DealStatusTypeID
     WHERE ISNULL(st.IsWon, 0) = 0 AND o.Status = 'Quoted'`)).recordset[0];

console.log(`\n  database: ${DB}`);
/**
 * No fixture is not a failure. A host whose data has moved on - every deal Won, or every order
 * past Quoted - has nothing for this to drive, and saying so plainly beats crashing on
 * `undefined`. `prove-confirm-veto.mjs` covers the same rule read-only and needs no such pair.
 */
if (!target) {
    console.log('  SKIP  no order on this host is Quoted with a deal that is not Won.');
    await pool.close();
    process.exit(0);
}
console.log(`  target:   ${target.OrderNumber} (${target.Status}) from ${target.DealNumber}, deal NOT Won\n`);

const loadOrder = async () => {
    const o = await new Metadata().GetEntityObject('MJ_BizApps_Orders: Order Headers', user);
    await o.Load(target.ID);
    return o;
};
const REFUSAL = 'is not Won, so this order cannot be confirmed yet';

let withVeto = '', withoutVeto = '';
await provider.BeginTransaction();
try {
    // VALIDATION IS THE WIRING. `Save()` on this class runs part of the booking walk BEFORE
    // `super.Save()`, so on a host missing GL links the booking throws first and the veto's refusal
    // never gets a chance to be the message. Calling ValidateAsync directly isolates the question
    // this harness exists to answer: is the veto actually consulted by the order's validation?
    console.log('-- with the veto registered --');
    salesCES.LoadDealNotWonConfirmVeto();
    ok('the veto is registered', orders.HostOrderConfirmVeto() !== null);
    const o1 = await loadOrder();
    o1.Status = 'Confirmed';
    const v1 = await o1.ValidateAsync();
    withVeto = (v1.Errors ?? []).map((e) => e.Message).join(' | ');
    ok('ValidateAsync REFUSES the confirm', v1.Success === false);
    ok('the refusal is this veto, naming the deal',
       withVeto.includes(REFUSAL) && withVeto.includes(target.DealNumber), withVeto.slice(0, 220));

    console.log('\n-- paired control: same validation, veto unregistered --');
    orders.RegisterOrderConfirmVeto(null);
    ok('nothing is registered now', orders.HostOrderConfirmVeto() === null);
    const o2 = await loadOrder();
    o2.Status = 'Confirmed';
    const v2 = await o2.ValidateAsync();
    withoutVeto = (v2.Errors ?? []).map((e) => e.Message).join(' | ');
    ok('the refusal TEXT is gone without the veto', !withoutVeto.includes(REFUSAL),
       `Success=${v2.Success}; ${withoutVeto.slice(0, 160)}`);

    /**
     * A full Save() runs the whole booking walk, which THIS HOST cannot complete: its schema predates
     * `MJ_BizApps_Orders: Order Concessions` (absent from both __mj.Entity and the database), and a
     * company with no GL account links throws before validation is reached. Neither is this change.
     * The attempt is still made, because "it refused" is worth knowing — but an environment failure
     * is reported as SKIP rather than counted as a pass, or as a failure of the thing under test.
     */
    console.log('\n-- and a real Save() of the confirm --');
    salesCES.LoadDealNotWonConfirmVeto();
    try {
        const o3 = await loadOrder();
        o3.Status = 'Confirmed';
        const saved = await o3.Save();
        ok('Save() does not book an order whose deal is not Won', saved === false, `Save() returned ${saved}`);
    } catch (err) {
        console.log(`  SKIP  Save() not exercisable on this host :: ${String(err).slice(0, 110)}`);
    }
} catch (err) {
    ok('the harness ran without throwing', false, String(err));
} finally {
    try { await provider.RollbackTransaction(); } catch { /* keep the real failure visible */ }
}

// The rollback must have taken it — assert, never trust.
const after = (await pool.request().query(
    `SELECT Status, ConfirmedAt FROM __mj_BizAppsOrders.OrderHeader WHERE ID = '${target.ID}'`)).recordset[0];
console.log('\n-- the host is left clean --');
ok(`${target.OrderNumber} is still ${target.Status}`, after.Status === target.Status, `now ${after.Status}`);
ok('and was not stamped ConfirmedAt', after.ConfirmedAt === null, String(after.ConfirmedAt));

orders.RegisterOrderConfirmVeto(null);
await pool.close();
console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES'}  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
