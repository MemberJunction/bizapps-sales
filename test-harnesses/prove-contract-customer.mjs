/**
 * Item 3 proof: a won deal WITH a primary contact produces a contract the database accepts.
 *
 * ── WHY THIS IS A STANDALONE HARNESS AND NOT (YET) A CT CHECK ────────────────────────────────────
 *
 * It has to run where contracts EXISTS, which is MJ_V6_Repro and nowhere else. The integration bundle
 * cannot run there yet: packages/IntegrationTests does not compile (30 DealLine references, item 6), and
 * the repro workspace's own MJ predates DeclareEmbeddedRecord so this branch will not build against it.
 * So the code comes from the good workspace and only the DATABASE is repro's.
 *
 * The equivalent CT check lands with item 6/7, and this harness is what proves it before then.
 *
 * ── IT REFUSES TO PASS VACUOUSLY ────────────────────────────────────────────────────────────────
 *
 * A skipped bundle looks exactly like a passing one, and that shape has burned this project four times.
 * So this asserts the PRECONDITIONS first -- contracts schema present, seam resolvable -- and exits
 * non-zero if they are absent rather than reporting nothing-went-wrong.
 */
import dotenv from 'dotenv'; import sql from 'mssql'; dotenv.config();

const { DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD } = process.env;
const DB = process.env.DB_DATABASE;
const pool = await new sql.ConnectionPool({
    server: DB_HOST, port: Number(DB_PORT ?? 1433), database: DB,
    user: DB_USERNAME, password: DB_PASSWORD,
    options: { trustServerCertificate: true, encrypt: true }, requestTimeout: 60000,
}).connect();

let bad = 0;
const ck = (ok, l, d) => { console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${l}${d ? '  — ' + d : ''}`); if (!ok) bad++; };
const die = (m) => { console.error(`\n    PRECONDITION FAILED: ${m}\n`); process.exit(2); };

console.log(`\n  database: ${DB}\n`);

// ── preconditions, so a missing schema can never read as a pass ─────────────
const ct = await pool.request().query(
    "SELECT COUNT(*) n FROM sys.tables WHERE SCHEMA_NAME(schema_id)='__mj_BizAppsContracts'");
if (ct.recordset[0].n === 0) {
    die(`${DB} has no __mj_BizAppsContracts schema. This proof is meaningless here -- use MJ_V6_Repro.`);
}
ck(true, 'contracts schema is present', `${ct.recordset[0].n} tables`);

const xor = await pool.request().query(
    "SELECT COUNT(*) n FROM sys.check_constraints WHERE name='CK_Contract_CustomerXor'");
if (xor.recordset[0].n === 0) die('CK_Contract_CustomerXor is absent, so this proves nothing.');
ck(true, 'CK_Contract_CustomerXor exists — the constraint under test');

const { setupSQLServerClient, SQLServerProviderConfigData } = await import('@memberjunction/sqlserver-dataprovider');
const { UserCache } = await import('@memberjunction/generic-database-provider');
const provider = await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
await UserCache.Instance.Refresh(pool);
const user = UserCache.Users.find(u => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
if (!user) die('no context user in UserCache — run scripts/seed-dev-data.sh');

await import('@mj-biz-apps/sales-server').then(m => m.LoadBizAppsSalesServer?.());
const { ContractsIsInstalled, LiveContractsSeam } = await import('../packages/CoreEntitiesServer/dist/index.js');
if (!ContractsIsInstalled()) {
    die('ContractsIsInstalled() is false — contracts entities are not resolvable in this process.');
}
ck(true, 'ContractsIsInstalled() — the seam can reach contracts');

// ── a real account and a real contact, discovered not hardcoded ─────────────
const { RunView } = await import('@memberjunction/core');
const rv = new RunView();
const acc = await rv.RunView({ EntityName: 'MJ_BizApps_Sales: Sales Accounts', ExtraFilter: 'IsActive = 1',
    ResultType: 'simple', Fields: ['ID', 'Name', 'CompanyID'] }, user);
const account = (acc.Results ?? [])[0];
const con = await rv.RunView({ EntityName: 'MJ_BizApps_Sales: Sales Contacts',
    ResultType: 'simple', Fields: ['ID'] }, user);
const contact = (con.Results ?? [])[0];
if (!account || !contact) die('need one active SalesAccount and one SalesContact — run the seeds.');
ck(true, 'a real account and a real primary contact exist', `${account.Name}`);

// ── THE CASE THE OLD FIXTURE NEVER COVERED: a contact IS set ───────────────
const seam = new LiveContractsSeam(user, provider);
const before = (await pool.request().query('SELECT COUNT(*) n FROM __mj_BizAppsContracts.Contract')).recordset[0].n;

const result = await seam.CreateContractFromDeal({
    DealID: '00000000-0000-0000-0000-000000000000',
    CompanyID: account.CompanyID,
    ContractTypeCode: 'Standard',
    TermMonths: 12,
    AccountID: account.ID,
    PrimaryContactID: contact.ID,      // <-- the field that used to make the insert illegal
    StartDate: '2026-09-01',
    Lines: [],
});

ck(result.Success === true, 'a won deal WITH a primary contact creates its contract',
   result.Success ? '' : `refused: ${result.Message}`);
ck(!!result.ContractID, 'and it has a real ContractID', result.ContractID ?? 'none');

// ── DATABASE assertions: the XOR held, and the contact landed correctly ────
if (result.ContractID) {
    const row = (await pool.request().query(
        `SELECT CustomerOrganizationID, CustomerPersonID, PrimaryContactPersonID, Status, ContractNumber
           FROM __mj_BizAppsContracts.Contract WHERE ID = '${result.ContractID}'`)).recordset[0];
    ck(!!row, 'the contract row is IN THE DATABASE', row?.ContractNumber);
    ck(row && String(row.CustomerOrganizationID).toLowerCase() === String(account.ID).toLowerCase(),
       'the customer is the ACCOUNT');
    ck(row && row.CustomerPersonID === null,
       'CustomerPersonID is NULL — the contact is not a second customer',
       `got ${row?.CustomerPersonID}`);
    ck(row && String(row.PrimaryContactPersonID).toLowerCase() === String(contact.ID).toLowerCase(),
       'and the contact landed in PrimaryContactPersonID',
       `got ${row?.PrimaryContactPersonID}`);
    ck(row && row.Status === 'Draft', 'the contract lands in Draft — a close fires nothing', row?.Status);
    // clean up: this harness is not transactional
    await pool.request().query(`DELETE FROM __mj_BizAppsContracts.ContractTerm WHERE ContractID = '${result.ContractID}'`);
    await pool.request().query(`DELETE FROM __mj_BizAppsContracts.Contract WHERE ID = '${result.ContractID}'`);
    const after = (await pool.request().query('SELECT COUNT(*) n FROM __mj_BizAppsContracts.Contract')).recordset[0].n;
    ck(after === before, 'cleaned up after itself', `${before} -> ${after}`);
}

console.log(`\n  ${bad === 0 ? 'ALL CHECKS PASSED' : bad + ' CHECK(S) FAILED'}\n`);
await pool.close();
process.exit(bad === 0 ? 0 : 1);
