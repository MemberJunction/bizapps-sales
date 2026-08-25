/**
 * Proves the ONE claim the CustomerXor fix rests on: the database rejects a Contract row with BOTH
 * CustomerOrganizationID and CustomerPersonID set, and accepts either one alone.
 *
 * ── WHY THIS NEEDS NO MJ AT ALL ─────────────────────────────────────────────────────────────────
 *
 * `CK_Contract_CustomerXor` is a CHECK constraint. It does not care about `Contracts.SaveContract`, the
 * contracts server package, or which MJ version is on disk -- so the fact that no workspace hosts both
 * halves of the seam (KI-19) does not stand in the way of proving the constraint itself. Raw SQL against
 * a database that HAS the constraint is the whole test.
 *
 * Everything runs inside one transaction and rolls back, so it writes nothing.
 *
 * Usage: DB_DATABASE=MJ_V6_Repro node test-harnesses/prove-customer-xor.mjs
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

console.log(`\n  database: ${DB}\n`);

// ── preconditions: never let a missing constraint read as a pass ────────────
const con = (await pool.request().query(
    "SELECT COUNT(*) n FROM sys.check_constraints WHERE name = 'CK_Contract_CustomerXor'")).recordset[0].n;
if (con === 0) {
    console.error(`\n    PRECONDITION FAILED: ${DB} has no CK_Contract_CustomerXor. ` +
                  `This proves nothing here -- use a database with contracts installed.\n`);
    process.exit(2);
}
ck(true, 'CK_Contract_CustomerXor exists on this database');

// Real FK targets, discovered rather than invented -- the insert must fail on the XOR, not on an FK.
const type = (await pool.request().query(
    'SELECT TOP 1 ID FROM __mj_BizAppsContracts.ContractType')).recordset[0];
const company = (await pool.request().query('SELECT TOP 1 ID FROM __mj.Company')).recordset[0];
const org = (await pool.request().query(
    'SELECT TOP 1 ID FROM __mj_BizAppsCommon.Organization')).recordset[0];
const person = (await pool.request().query(
    'SELECT TOP 1 ID FROM __mj_BizAppsCommon.Person')).recordset[0];
if (!type || !company || !org || !person) {
    console.error('\n    PRECONDITION FAILED: need a ContractType, a Company, an Organization and a Person.\n');
    process.exit(2);
}
ck(true, 'real FK targets found, so a failure can only be the XOR');

const tx = new sql.Transaction(pool);
await tx.begin();

/** One insert attempt. Returns the SQL error message, or null when it succeeded. */
async function attempt(label, orgID, personID) {
    const r = new sql.Request(tx);
    const sp = 'sp_' + Math.abs(Date.now() % 100000) + label.replace(/[^a-z]/gi, '');
    await r.batch(`SAVE TRANSACTION ${sp}`);
    try {
        await new sql.Request(tx).query(`
            INSERT INTO __mj_BizAppsContracts.Contract
                (ContractNumber, ContractTypeID, CompanyID, CustomerOrganizationID, CustomerPersonID)
            VALUES
                ('XOR-${label}', '${type.ID}', '${company.ID}',
                 ${orgID ? `'${orgID}'` : 'NULL'}, ${personID ? `'${personID}'` : 'NULL'})`);
        return null;
    } catch (e) {
        return e.message;
    } finally {
        // Undo whichever way it went, so each case starts clean.
        try { await new sql.Request(tx).batch(`ROLLBACK TRANSACTION ${sp}`); } catch { /* nothing to undo */ }
    }
}

// ── 1. BOTH set — the shape the seam used to send ──────────────────────────
const both = await attempt('both', org.ID, person.ID);
ck(both !== null, 'BOTH columns set is REJECTED — the bug the fix removes',
   both ? both.split('.')[0] : 'IT WAS ACCEPTED, so the fix rests on nothing');
if (both) {
    ck(/CK_Contract_CustomerXor/i.test(both), 'and it is rejected BY CK_Contract_CustomerXor specifically',
       both.match(/CK_[A-Za-z_]+/)?.[0] ?? 'a different constraint');
}

// ── 2. organization only — what the fix now sends ──────────────────────────
const orgOnly = await attempt('org', org.ID, null);
ck(orgOnly === null, 'ORGANIZATION only is ACCEPTED — the fixed shape', orgOnly ?? '');

// ── 3. person only — legitimate for a D2C contract ────────────────────────
const personOnly = await attempt('person', null, person.ID);
ck(personOnly === null, 'PERSON only is ACCEPTED — a person can be the customer', personOnly ?? '');

// ── 4. neither — the constraint is an XOR, not "at most one" ───────────────
const neither = await attempt('neither', null, null);
ck(neither !== null, 'NEITHER is also rejected — it is exactly-one, not at-most-one',
   neither ? (neither.match(/CK_[A-Za-z_]+/)?.[0] ?? 'rejected') : 'it was accepted');

await tx.rollback();
const left = (await pool.request().query(
    "SELECT COUNT(*) n FROM __mj_BizAppsContracts.Contract WHERE ContractNumber LIKE 'XOR-%'")).recordset[0].n;
ck(left === 0, 'rolled back — nothing written', `${left} stray row(s)`);

console.log(`\n  ${bad === 0 ? 'ALL CHECKS PASSED' : bad + ' CHECK(S) FAILED'}\n`);
await pool.close();
process.exit(bad === 0 ? 0 : 1);
