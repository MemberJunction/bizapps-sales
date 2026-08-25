/**
 * Runs BOTH dashboard implementations over the same data and fails on any disagreement.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────────
 *
 * Re-pointing the dashboard onto MJ Queries (master plan §9.5) is a MECHANISM change, not a measure
 * change: every tile is supposed to mean exactly what it meant before. So a figure that moves is a
 * bug in one of the two implementations, and the useful thing is to find out WHICH before shipping
 * rather than to reconcile it quietly afterwards.
 *
 * The browser path cannot be exercised here, so this reimplements it EXACTLY as
 * `sales-section.component.ts` computes it — same RunView, same flag lookup through a separate
 * statuses fetch, same UTC date string built with getUTC* getters, same reduce. That duplication is
 * deliberate and temporary: it is the control in the experiment, and it goes when the component's
 * client-side path goes.
 *
 * Run:  node test-harnesses/compare-dashboard-measures.mjs
 */
import 'dotenv/config';
import sql from 'mssql';

const rows = [];
const record = (label, clientVal, queryVal, note) =>
    rows.push({ label, clientVal, queryVal, agree: String(clientVal) === String(queryVal), note });

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

const { RunView, RunQuery } = await import('@memberjunction/core');

console.log(`\n  database: ${process.env.DB_DATABASE}`);

/* ── PATH A: the client-side implementation, reproduced exactly ──────────────────────────────── */

const rv = await new RunView().RunViews(
    [
        {
            EntityName: 'MJ_BizApps_Sales: Deals',
            OrderBy: 'ExpectedCloseDate ASC, Name ASC',
            ResultType: 'simple',
            Fields: [
                'ID', 'DealNumber', 'Name', 'AccountID', 'Amount', 'AmountIsComputed', 'Probability',
                'ExpectedCloseDate', 'Pipeline', 'PipelineStage', 'DealType', 'DealStatusType',
                'OwnerEmployee', 'ForecastCategoryType', 'DealStatusTypeID', 'PipelineID', 'PipelineStageID',
            ],
        },
        {
            EntityName: 'MJ_BizApps_Sales: Deal Status Types',
            ResultType: 'simple',
            Fields: ['ID', 'IsOpen', 'IsWon', 'IsLost', 'IsClosed'],
        },
    ],
    user,
);
const deals = rv?.[0]?.Results ?? [];
const statuses = rv?.[1]?.Results ?? [];

// `hasFlag`, verbatim in behaviour: resolve the status row by ID, read the flag, default false.
const hasFlag = (row, flag) => {
    if (!row.DealStatusTypeID) return false;
    const s = statuses.find((x) => String(x.ID).toLowerCase() === String(row.DealStatusTypeID).toLowerCase());
    return s ? s[flag] === true : false;
};

// The component's UTC date string, built the same way — this is the comparison the tile relies on.
const now = new Date();
const todayUtc = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
const utcDatePart = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

const open = deals.filter((d) => hasFlag(d, 'IsOpen'));
const won = deals.filter((d) => hasFlag(d, 'IsWon'));
/**
 * ── PAST DUE, NOT "SLIPPED" — the naming matters and it used to collide ─────────────────────────
 *
 * This set is OPEN DEALS WHOSE EXPECTED CLOSE DATE HAS PASSED. It backs the dashboard's "Past expected
 * close" tile and it was called `slipped`, which is a different thing: `Sales: Slipped Deals` reports
 * deals whose expected close date was MOVED, reconstructed from __mj.RecordChange, and on the seeded data
 * the two answer with DIFFERENT deals -- DEAL-9002 is past due, DEAL-9003 is the one that slipped.
 *
 * Both user-facing labels were already distinct; only the internal name overlapped, which is the worst
 * place for it: a reader comparing this harness against that query would have found two "slipped" figures
 * that disagree and no way to tell which was wrong. Renamed here rather than in the query, because
 * "slipped" conventionally means the date moved and the query is the one using it correctly.
 */
const pastDue = deals.filter(
    (d) => hasFlag(d, 'IsOpen') && !!d.ExpectedCloseDate && utcDatePart(d.ExpectedCloseDate) < todayUtc,
);
const client = {
    OpenAmount: open.reduce((sum, d) => sum + (d.Amount ?? 0), 0),
    /**
     * THE PRICED/STATED SPLIT, WHICH ONLY BECAME TESTABLE ONCE THE DATA CHANGED.
     *
     * Every deal carried AmountIsComputed = 0 when this harness was written, so these two columns
     * were uniform: one was the whole open figure and the other was zero. A comparison over that data
     * could not distinguish a correct split from a swapped one, or from a CASE that always took the
     * same branch. Five deals are engine-priced now, so it can.
     *
     * That is the same lesson Slipped Deals taught -- a check is only as good as the data it was
     * given -- applied before it costs anything rather than after.
     */
    OpenPricedAmount: open.filter((d) => d.AmountIsComputed === true).reduce((sum, d) => sum + (d.Amount ?? 0), 0),
    OpenStatedAmount: open.filter((d) => d.AmountIsComputed !== true).reduce((sum, d) => sum + (d.Amount ?? 0), 0),
    OpenCount: open.length,
    TotalCount: deals.length,
    PastExpectedCloseCount: pastDue.length,
    WonCount: won.length,
};

/* ── PATH B: the query ───────────────────────────────────────────────────────────────────────── */

const q = await new RunQuery().RunQuery({ QueryName: 'Sales: Dashboard Summary', CategoryPath: 'Sales' }, user);
if (!q?.Success) {
    console.error(`\n  ✖ the query did not run: ${q?.ErrorMessage ?? 'unknown error'}\n`);
    process.exit(2);
}
const server = q.Results?.[0] ?? {};

record('Open pipeline amount', client.OpenAmount, Number(server.OpenAmount ?? 0));
record('Open deal count', client.OpenCount, Number(server.OpenCount ?? 0));
record('Total deal count', client.TotalCount, Number(server.TotalCount ?? 0));
record('Past expected close', client.PastExpectedCloseCount, Number(server.PastExpectedCloseCount ?? 0));
record('Won count', client.WonCount, Number(server.WonCount ?? 0));
record('Open priced amount', client.OpenPricedAmount, Number(server.OpenPricedAmount ?? 0));
record('Open stated amount', client.OpenStatedAmount, Number(server.OpenStatedAmount ?? 0));
// The split must also RECONSTITUTE the whole, or one branch is silently dropping rows.
record(
    'Priced + stated = open amount',
    client.OpenAmount,
    Number(server.OpenPricedAmount ?? 0) + Number(server.OpenStatedAmount ?? 0),
);

/* ── The two tables ──────────────────────────────────────────────────────────────────────────── */

const roster = await new RunQuery().RunQuery(
    { QueryName: 'Sales: Deal Roster', CategoryPath: 'Sales' },
    user,
);
if (roster?.Success) {
    record('Roster row count', deals.length, roster.Results?.length ?? 0);

    // ClosingSoon: open deals with an expected close, soonest first, capped at 8.
    const clientSoon = deals
        .filter((d) => hasFlag(d, 'IsOpen') && !!d.ExpectedCloseDate)
        .slice()
        .sort((a, b) => utcDatePart(a.ExpectedCloseDate).localeCompare(utcDatePart(b.ExpectedCloseDate)))
        .slice(0, 8)
        .map((d) => d.ID.toLowerCase());
    const querySoon = (roster.Results ?? [])
        .filter((d) => d.IsOpen === true && !!d.ExpectedCloseDate)
        .sort((a, b) => utcDatePart(a.ExpectedCloseDate).localeCompare(utcDatePart(b.ExpectedCloseDate)))
        .slice(0, 8)
        .map((d) => String(d.DealID).toLowerCase());
    record('Closing-soon deal IDs, in order', clientSoon.join(','), querySoon.join(','));

    // The past-due set by IDENTITY, not merely by count — two different deals would still tally.
    const clientPastDue = pastDue.map((d) => d.ID.toLowerCase()).sort().join(',');
    const queryPastDue = (roster.Results ?? [])
        .filter((d) => d.IsPastExpectedClose === 1 || d.IsPastExpectedClose === true)
        .map((d) => String(d.DealID).toLowerCase())
        .sort()
        .join(',');
    record('Past-due deal IDs', clientPastDue, queryPastDue);
} else {
    record('Deal Roster query ran', 'yes', `NO — ${roster?.ErrorMessage ?? 'unknown'}`);
}

console.log('');
const w = Math.max(...rows.map((r) => r.label.length));
for (const r of rows) {
    const mark = r.agree ? '✔' : '✖';
    console.log(`  ${mark} ${r.label.padEnd(w)}   client=${r.clientVal}   query=${r.queryVal}`);
}
const bad = rows.filter((r) => !r.agree);
console.log(`\n  ${rows.length - bad.length} agree, ${bad.length} DIFFER\n`);
if (bad.length) {
    console.log('  A difference is a bug in one of the two paths. Find out which before shipping.\n');
}
await pool.close();
process.exit(bad.length ? 1 : 0);
