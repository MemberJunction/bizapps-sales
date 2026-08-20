/**
 * Proves `LiveContractsSeam.CreateContractFromDeal` end to end against a database where
 * bizapps-contracts is actually installed — which, until 2026-08-20, no database was.
 *
 * WHY THIS IS A STANDALONE SCRIPT AND NOT A CHECK BUNDLE. The check bundles are another instance's
 * working area this week. This reads only, writes inside one transaction, and rolls back.
 *
 * WHAT IT ASSERTS, AND WHERE FROM. Every assertion reads the CONTRACT ROW BACK OUT OF THE DATABASE
 * with raw SQL inside the same transaction. The seam's return value is used only to obtain the ID —
 * a service that reports an ID it never wrote is exactly the failure a return-value assertion cannot
 * see.
 */
import 'dotenv/config';
import sql from 'mssql';

const DB = process.env.DB_DATABASE;
const results = [];
const record = (ok, label, detail) => results.push({ ok, label, detail });

const pool = await new sql.ConnectionPool({
    server: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 1433),
    database: DB,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    options: { trustServerCertificate: true, encrypt: false },
    requestTimeout: 60_000,
}).connect();

const { setupSQLServerClient, SQLServerProviderConfigData } = await import(
    '@memberjunction/sqlserver-dataprovider'
);
const { UserCache } = await import('@memberjunction/generic-database-provider');
const provider = await setupSQLServerClient(
    new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'),
);
await UserCache.Instance.Refresh(pool);
const user =
    UserCache.Users.find((u) => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];

// Sales' own server classes, then CONTRACTS' — without the second, ClassFactory resolves the
// generated ContractEntity, nothing mints ContractNumber, and the insert dies on a NOT NULL.
await import('@mj-biz-apps/contracts-core-entities-server').then((m) =>
    m.LoadMjBizappsContractsEntitiesServer?.(),
);

const { LiveContractsSeam, ContractsIsInstalled } = await import(
    '@mj-biz-apps/sales-core-entities-server'
);

console.log(`\n  database: ${DB}`);
record(ContractsIsInstalled(), 'ContractsIsInstalled() is true', 'the guard that refused every prior call');

// A real deal to hang the contract off — the fixture is the live data, not an invention.
const dealRow = (
    await pool.request().query(`
    SELECT TOP 1 d.ID, d.CompanyID, d.AccountID, d.PrimaryContactID, d.ContractVariances,
           d.AutoRenew, d.AnnualIncreasePctOverride, d.CancellationNoticeDaysOverride
      FROM __mj_BizAppsSales.Deal d
     WHERE d.AccountID IS NOT NULL AND d.CompanyID IS NOT NULL`)
).recordset[0];
if (!dealRow) {
    console.error('  ✖ no deal with an account and a company — nothing to prove against');
    process.exit(2);
}

/**
 * THE TRANSACTION HAS TO BE THE PROVIDER'S OWN, and the first version of this file got that wrong.
 *
 * It opened a bare `mssql` transaction and assigned it to `provider.TransactionObject`, on the
 * assumption that the provider would then enlist in it. It does not: the provider ran the save on its
 * own connection, the rollback rolled back an empty transaction, and a REAL contract row survived in a
 * shared database. The final assertion caught it -- which is the whole reason it asserts the rollback
 * rather than trusting it -- but the row still had to be deleted by hand.
 *
 * `BeginTransaction()` on the provider is what the integration fixture uses, for exactly this reason.
 */
let contractID = null;
let seamResult = null;
const db = provider;
await db.BeginTransaction();
try {

    const seam = new LiveContractsSeam(user, provider);
    seamResult = await seam.CreateContractFromDeal({
        DealID: dealRow.ID,
        CompanyID: dealRow.CompanyID,
        AccountID: dealRow.AccountID,
        PrimaryContactID: dealRow.PrimaryContactID,
        ContractVariances: dealRow.ContractVariances,
        AutoRenew: dealRow.AutoRenew,
        AnnualIncreasePctOverride: dealRow.AnnualIncreasePctOverride,
        CancellationNoticeDaysOverride: dealRow.CancellationNoticeDaysOverride,
        ContractTypeCode: 'Order Form',
    });

    record(seamResult.Success === true, 'the seam reports success', seamResult.Message ?? '');
    contractID = seamResult.ContractID;

    if (contractID) {
        const row = (
            await db.ExecuteSQL(`SELECT * FROM __mj_BizAppsContracts.Contract WHERE ID = '${contractID}'`)
        )?.[0];

        record(!!row, 'THE ROW EXISTS in __mj_BizAppsContracts.Contract', `ID ${contractID}`);
        if (row) {
            record(
                !!row.ContractNumber && /^CTR-/.test(row.ContractNumber),
                'ContractNumber was minted by ContractEntityServer.Save()',
                `= ${row.ContractNumber}`,
            );
            const dealEntityID = (
                await db.ExecuteSQL(`SELECT ID FROM __mj.Entity WHERE Name = 'MJ_BizApps_Sales: Deals'`)
            )?.[0]?.ID;
            record(
                String(row.CreatingEntityID).toLowerCase() === String(dealEntityID).toLowerCase(),
                'CreatingEntityID points at the Deals entity',
                `${row.CreatingEntityID}`,
            );
            record(
                String(row.CreatingRecordID).toLowerCase() === String(dealRow.ID).toLowerCase(),
                'CreatingRecordID points at the originating deal',
                `${row.CreatingRecordID}`,
            );
            record(row.HasModifications !== null, 'HasModifications is set', `= ${row.HasModifications}`);
            record(
                String(row.CustomerOrganizationID).toLowerCase() === String(dealRow.AccountID).toLowerCase(),
                'CustomerOrganizationID is the deal account',
                '',
            );
            // THE ONE THAT MATTERS FOR DISPLAY. Lifecycle is derived from dates; any date at all and a
            // freshly created contract announces itself as in force before a human has read the paper.
            const dates = ['EffectiveDate', 'ExecutedDate', 'EndDate', 'TerminatedDate'];
            const populated = dates.filter((d) => row[d] !== null);
            record(
                populated.length === 0,
                'NO dates are populated — so it displays as Draft, not Active',
                populated.length ? `populated: ${populated.join(', ')}` : 'all four null',
            );
            record(
                row.ContractTemplateID === null,
                'ContractTemplateID left null (selection deliberately unimplemented)',
                '',
            );
            // The renewal fields: whatever the deal stated, and nothing invented.
            record(
                (row.AnnualIncreasePercent === null) === (dealRow.AnnualIncreasePctOverride === null),
                'AnnualIncreasePercent mirrors the deal override (null stays null)',
                `deal=${dealRow.AnnualIncreasePctOverride} contract=${row.AnnualIncreasePercent}`,
            );
            record(
                row.RenewalNoticeDays === null,
                'RenewalNoticeDays left null — sales holds no equivalent field',
                '',
            );
        }
    }
} catch (err) {
    record(false, 'the seam threw', String(err));
} finally {
    try {
        await db.RollbackTransaction();
    } catch {
        // Nothing to roll back if the body already failed out of one; swallowing keeps the real
        // failure visible rather than replacing it with a cleanup error.
    }
}

// The rollback must have taken the contract AND its sequence number with it.
if (contractID) {
    const after = (
        await pool
            .request()
            .query(`SELECT COUNT(*) AS N FROM __mj_BizAppsContracts.Contract WHERE ID = '${contractID}'`)
    ).recordset[0].N;
    record(Number(after) === 0, 'the rollback removed it — the host is left clean', `rows after = ${after}`);
}

console.log('');
for (const r of results) {
    console.log(`  ${r.ok ? '✔' : '✖'} ${r.label}${r.detail ? `  — ${r.detail}` : ''}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n  ${results.length - failed} passed, ${failed} failed\n`);
if (!seamResult?.Success) {
    console.log(`  seam message: ${seamResult?.Message ?? '(none)'}\n`);
}
await pool.close();
process.exit(failed ? 1 : 0);
