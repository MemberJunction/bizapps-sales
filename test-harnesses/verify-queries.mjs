/**
 * Exercises every Sales query against data that REACHES its joins, conversions and filters.
 *
 * ── WHY THIS EXISTS, AND WHY THE OBVIOUS CHECK WAS NOT ENOUGH ───────────────────────────────────
 *
 * The first pass over these queries reported "all 13 run clean". They did run, and the report was
 * still worthless for one of them: `Sales: Slipped Deals` joined `Deal.ID = RecordChange.RecordID`,
 * and `RecordID` holds MJ's composite-key string (`ID|<guid>`), not a bare guid. SQL Server converts
 * toward uniqueidentifier and dies with Msg 8169 — but ONLY once a row qualifies. Over an empty set
 * the conversion is never attempted and the statement is reported clean.
 *
 * That is the failure shape this harness hunts: **clean over an empty set, fatal over a populated
 * one.** Aggregates are the worst of it, because they return a row either way, so "it returned data"
 * proves nothing on its own.
 *
 * So each query is run TWICE — once unparameterised, once with every parameter supplied — and each
 * run reports whether any row was actually produced. A query that returns zero rows in both modes is
 * flagged as UNPROVEN rather than passed: it may be correct, but nothing here has demonstrated it.
 */
import 'dotenv/config';
import sql from 'mssql';

const pool = await new sql.ConnectionPool({
    server: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_DATABASE,
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
const { RunQuery } = await import('@memberjunction/core');

// Real values from the live data, so the parameterised run actually reaches the filters rather than
// excluding everything and proving nothing.
const one = async (q) => (await provider.ExecuteSQL(q))?.[0];
/**
 * THE COMPANY AND PIPELINE MUST CO-OCCUR ON A REAL DEAL, and the first version of this file got that
 * wrong in a way worth recording: it picked the company from one query and the pipeline from another,
 * so their AND matched nothing and thirteen of fourteen queries reported `params=0 rows`.
 *
 * That read exactly like a broken parameter path. It was a broken FIXTURE — every parameter works
 * individually, which is what the probe showed. A harness that selects a contradictory slice proves
 * nothing about the queries and looks like it proves a lot.
 */
const slice = await one(
    `SELECT TOP 1 CompanyID, PipelineID FROM __mj_BizAppsSales.Deal
      WHERE CompanyID IS NOT NULL AND PipelineID IS NOT NULL
      GROUP BY CompanyID, PipelineID ORDER BY COUNT(*) DESC`,
);
const company = { CompanyID: slice?.CompanyID };
const pipeline = { PipelineID: slice?.PipelineID };
const owner = await one(`SELECT TOP 1 OwnerEmployeeID FROM __mj_BizAppsSales.Deal WHERE OwnerEmployeeID IS NOT NULL`);

const WIDE = { PeriodStart: '2000-01-01', PeriodEnd: '2099-12-31' };
const SLICED = {
    CompanyID: company?.CompanyID,
    PipelineID: pipeline?.PipelineID,
    ...WIDE,
};

/** Every query, with the parameter set that drives it hardest. */
const QUERIES = [
    ['Sales: Pipeline Summary', SLICED],
    ['Sales: Forecast by Category', SLICED],
    ['Sales: Bookings by Period', { ...SLICED, Granularity: 'quarter' }],
    ['Sales: Win Rate by Count and Value', SLICED],
    ['Sales: Deal Cycle Time', SLICED],
    ['Sales: Stage Conversion and Dwell', SLICED],
    ['Sales: Slipped Deals', { ...SLICED, OpenOnly: 'true' }],
    ['Sales: Bookings by Owner', SLICED],
    ['Sales: Deal Involvement by Rep (Attribution-Weighted)', SLICED],
    ['Sales: Product Mix and Discount Depth', { ...SLICED, WonOnly: 'true' }],
    ['Sales: Deal Type Mix', SLICED],
    ['Sales: Forecast History', { ...SLICED, CapturedOnOrBefore: '2099-12-31' }],
    ['Sales: Deal Roster', { ...SLICED, OwnerEmployeeID: owner?.OwnerEmployeeID, OpenOnly: 'true' }],
    ['Sales: Dashboard Summary', { CompanyID: company?.CompanyID, PipelineID: pipeline?.PipelineID }],
];

// Aggregates return a row over an empty set, so "rows came back" does not prove the joins were
// reached. These name a column whose non-zero value means real input actually flowed through.
const EVIDENCE = {
    'Sales: Pipeline Summary': (r) => Number(r.DealCount ?? 0) > 0,
    'Sales: Forecast by Category': (r) => Number(r.OpenDealCount ?? 0) + Number(r.ClosedWonAmount ?? 0) > 0,
    'Sales: Bookings by Period': (r) => Number(r.WonCount ?? 0) + Number(r.LostCount ?? 0) > 0,
    'Sales: Win Rate by Count and Value': (r) => Number(r.ClosedCount ?? 0) > 0,
    'Sales: Deal Cycle Time': (r) => Number(r.DealCount ?? 0) > 0,
    'Sales: Stage Conversion and Dwell': (r) => Number(r.TransitionCount ?? 0) > 0,
    'Sales: Slipped Deals': (r) => Number(r.SlipCount ?? 0) > 0,
    'Sales: Bookings by Owner': (r) => Number(r.WonCount ?? 0) + Number(r.LostCount ?? 0) > 0,
    'Sales: Deal Involvement by Rep (Attribution-Weighted)': (r) => Number(r.DealsInvolvedIn ?? 0) > 0,
    'Sales: Product Mix and Discount Depth': (r) => Number(r.LineCount ?? 0) > 0,
    'Sales: Deal Type Mix': (r) => Number(r.WonCount ?? 0) + Number(r.OpenCount ?? 0) > 0,
    'Sales: Forecast History': () => true,
    'Sales: Deal Roster': () => true,
    'Sales: Dashboard Summary': (r) => Number(r.TotalCount ?? 0) > 0,
};

const results = [];
for (const [name, params] of QUERIES) {
    const run = async (label, p) => {
        try {
            const r = await new RunQuery().RunQuery({ QueryName: name, CategoryPath: 'Sales', Parameters: p }, user);
            if (!r?.Success) return { label, ok: false, note: (r?.ErrorMessage ?? 'unknown').slice(0, 150) };
            const rows = r.Results ?? [];
            const proved = rows.length > 0 && rows.some((row) => (EVIDENCE[name] ?? (() => true))(row));
            return { label, ok: true, rows: rows.length, proved };
        } catch (err) {
            return { label, ok: false, note: String(err).slice(0, 150) };
        }
    };
    const bare = await run('bare', undefined);
    const full = await run('params', params);
    results.push({ name, bare, full });
}

console.log(`\n  database: ${process.env.DB_DATABASE}\n`);
const w = Math.max(...results.map((r) => r.name.length));
let failed = 0;
let unproven = 0;
for (const r of results) {
    const bad = !r.bare.ok || !r.full.ok;
    const proved = r.bare.proved || r.full.proved;
    if (bad) failed++;
    else if (!proved) unproven++;
    const mark = bad ? '✖' : proved ? '✔' : '?';
    const detail = bad
        ? `  ${!r.bare.ok ? `bare: ${r.bare.note}` : `params: ${r.full.note}`}`
        : `  bare=${r.bare.rows} rows   params=${r.full.rows} rows${proved ? '' : '   UNPROVEN — no run produced qualifying data'}`;
    console.log(`  ${mark} ${r.name.padEnd(w)}${detail}`);
}
console.log(`\n  ${results.length - failed - unproven} proven, ${unproven} unproven, ${failed} FAILED\n`);
if (unproven) {
    console.log('  UNPROVEN is not a pass. It means no run reached the joins, so a conversion fault');
    console.log('  of the kind that killed Slipped Deals could still be hiding there.\n');
}
await pool.close();
process.exit(failed ? 1 : 0);
