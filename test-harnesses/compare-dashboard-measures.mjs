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
 * The browser path cannot be exercised here, so this recomputes every figure from plain deal rows
 * with the rules the dashboard's predicates state — same flag lookup through a separate statuses
 * fetch, same business-day "today" (golive#168), same reduce. That duplication is deliberate: it is
 * the control in the experiment.
 *
 * It runs the summary under several periods and filter-bar choices (bc-aidp-next-golive#350): All
 * time, the current calendar quarter, and one selling company, owner, pipeline and product company
 * each, taken from the data. Each period-bound figure is checked on its own date: open figures on
 * ExpectedCloseDate, Won on ActualCloseDate.
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
await UserCache.Instance.Refresh(provider);
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
                'ExpectedCloseDate', 'ActualCloseDate', 'Pipeline', 'PipelineStage', 'DealType', 'DealStatusType',
                'OwnerEmployee', 'OwnerEmployeeID', 'CompanyID', 'OrderID', 'ForecastCategoryType', 'DealStatusTypeID',
                'PipelineID', 'PipelineStageID', 'ForecastCategoryTypeID',
            ],
        },
        {
            EntityName: 'MJ_BizApps_Sales: Deal Status Types',
            ResultType: 'simple',
            Fields: ['ID', 'IsOpen', 'IsWon', 'IsLost', 'IsClosed'],
        },
        {
            EntityName: 'MJ_BizApps_Sales: Forecast Category Types',
            ResultType: 'simple',
            Fields: ['ID', 'IncludeInPipeline', 'IncludeInCommit', 'IncludeInBestCase'],
        },
        { EntityName: 'MJ_BizApps_Sales: Pipelines', ResultType: 'simple', Fields: ['ID', 'IncludeInForecast'] },
        { EntityName: 'MJ_BizApps_Orders: Order Lines', ResultType: 'simple', Fields: ['OrderHeaderID', 'CompanyID'] },
    ],
    user,
);
const deals = rv?.[0]?.Results ?? [];
const statuses = rv?.[1]?.Results ?? [];
const categories = rv?.[2]?.Results ?? [];
const pipelines = rv?.[3]?.Results ?? [];
const lines = rv?.[4]?.Results ?? [];
const id = (v) => String(v ?? '').toLowerCase();

const category = (row) => categories.find((x) => id(x.ID) === id(row.ForecastCategoryTypeID));
// An open deal counts toward the pipeline money unless its forecast category leaves it out (Omitted).
// No category counts, as the dashboard's `InPipeline` and the summary query treat it.
const inPipeline = (row) => (row.ForecastCategoryTypeID ? category(row)?.IncludeInPipeline !== false : true);
const catFlag = (row, flag) => category(row)?.[flag] === true;

// `hasFlag`, verbatim in behaviour: resolve the status row by ID, read the flag, default false.
const hasFlag = (row, flag) => {
    if (!row.DealStatusTypeID) return false;
    const s = statuses.find((x) => id(x.ID) === id(row.DealStatusTypeID));
    return s ? s[flag] === true : false;
};
const pipelineInForecast = (row) => pipelines.find((p) => id(p.ID) === id(row.PipelineID))?.IncludeInForecast !== false;
const productCompanies = (row) => new Set(lines.filter((l) => row.OrderID && id(l.OrderHeaderID) === id(row.OrderID)).map((l) => id(l.CompanyID)));

/**
 * TODAY IS THE BUSINESS DAY (golive#168). The component takes it from BusinessTimeZoneEngine and the
 * queries from fnBusinessToday(); both read the same instance-configuration row. Read from the function
 * rather than rebuilt in JS, so this harness cannot pick a different zone than the instance uses.
 */
const todayBusiness = (
    await pool.request().query('SELECT CONVERT(char(10), Today, 23) AS Today FROM __mj_BizAppsCommon.fnBusinessToday()')
).recordset[0].Today;
const utcDatePart = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const within = (day, window) => !!day && (!window.Start || utcDatePart(day) >= window.Start) && (!window.End || utcDatePart(day) <= window.End);

/**
 * THE CLIENT PATH, as the dashboard's predicates define each figure (bc-aidp-next-golive#350): the
 * filter bar narrows the rows; open figures count open deals expected to close in the window; Won
 * counts wins closed in it; the attention counts ignore the window. A named pipeline includes a
 * pipeline flagged out of the forecast, as the query does.
 */
function clientFigures(window, filters) {
    const unbounded = !window.Start && !window.End;
    const scoped = deals.filter((d) => {
        if (filters.CompanyIDs && !filters.CompanyIDs.map(id).includes(id(d.CompanyID))) return false;
        if (filters.OwnerEmployeeIDs && !filters.OwnerEmployeeIDs.map(id).includes(id(d.OwnerEmployeeID))) return false;
        if (filters.PipelineIDs && !filters.PipelineIDs.map(id).includes(id(d.PipelineID))) return false;
        if (!filters.PipelineIDs && hasFlag(d, 'IsOpen') && !pipelineInForecast(d)) return false;
        return true;
    });
    const rows = filters.ProductCompanyIDs
        ? scoped.filter((d) => filters.ProductCompanyIDs.some((c) => productCompanies(d).has(id(c))))
        : scoped;
    const open = rows.filter((d) => hasFlag(d, 'IsOpen'));
    const openIn = open.filter((d) => !hasFlag(d, 'IsWon') && (unbounded || within(d.ExpectedCloseDate, window)));
    const pipe = openIn.filter(inPipeline);
    const sum = (set, f = (d) => d.Amount ?? 0) => set.reduce((n, d) => n + f(d), 0);
    const commit = pipe.filter((d) => catFlag(d, 'IncludeInCommit'));
    const best = pipe.filter((d) => !catFlag(d, 'IncludeInCommit') && catFlag(d, 'IncludeInBestCase'));
    const rest = pipe.filter((d) => !catFlag(d, 'IncludeInCommit') && !catFlag(d, 'IncludeInBestCase'));
    const won = rows.filter((d) => hasFlag(d, 'IsWon') && (unbounded || within(d.ActualCloseDate, window)));
    return {
        OpenAmount: sum(pipe),
        OpenCount: openIn.length,
        OpenOmittedCount: openIn.length - pipe.length,
        CommitAmount: sum(commit),
        CommitCount: commit.length,
        BestCaseOnlyAmount: sum(best),
        PipelineOnlyAmount: sum(rest),
        // Rounded to the cent on both sides: a sum of products is not exact in floating point.
        WeightedAmount: Math.round(sum(pipe, (d) => ((d.Amount ?? 0) * (d.Probability ?? 0)) / 100) * 100) / 100,
        OpenPricedAmount: sum(pipe.filter((d) => d.AmountIsComputed === true)),
        OpenStatedAmount: sum(pipe.filter((d) => d.AmountIsComputed !== true)),
        TotalCount: rows.length,
        PastExpectedCloseCount: open.filter((d) => !!d.ExpectedCloseDate && utcDatePart(d.ExpectedCloseDate) < todayBusiness).length,
        NoOwnerCount: open.filter((d) => !d.OwnerEmployeeID).length,
        NoCloseDateCount: open.filter((d) => !d.ExpectedCloseDate).length,
        WonCount: won.length,
        WonAmount: sum(won),
        NoLinesDealCount: scoped.filter((d) => productCompanies(d).size === 0).length,
    };
}

/* ── PATH B: the query ───────────────────────────────────────────────────────────────────────── */

async function serverFigures(window, filters) {
    const Parameters = { ...filters };
    if (window.Start) Parameters.PeriodStart = window.Start;
    if (window.End) Parameters.PeriodEnd = window.End;
    const q = await new RunQuery().RunQuery({ QueryName: 'Sales: Dashboard Summary', CategoryPath: 'Sales', Parameters }, user);
    if (!q?.Success) {
        console.error(`\n  ✖ the query did not run: ${q?.ErrorMessage ?? 'unknown error'}\n`);
        process.exit(2);
    }
    return q.Results?.[0] ?? {};
}

/** The calendar quarter today falls in: a bounded window the seeded deals straddle. */
const [ty, tm] = todayBusiness.split('-').map(Number);
const qStart = new Date(Date.UTC(ty, Math.floor((tm - 1) / 3) * 3, 1));
const qEnd = new Date(Date.UTC(ty, Math.floor((tm - 1) / 3) * 3 + 3, 0));
const QUARTER = { Start: utcDatePart(qStart), End: utcDatePart(qEnd) };
const ALL_TIME = { Start: null, End: null };

// One filter of each kind, taken from the data so the case is not vacuous.
const firstOf = (values) => [...new Set(values.filter(Boolean).map(String))].slice(0, 1);
const CASES = [
    ['all time', ALL_TIME, {}],
    [`${QUARTER.Start}..${QUARTER.End}`, QUARTER, {}],
    ['all time, one selling company', ALL_TIME, { CompanyIDs: firstOf(deals.map((d) => d.CompanyID)) }],
    ['all time, one owner', ALL_TIME, { OwnerEmployeeIDs: firstOf(deals.map((d) => d.OwnerEmployeeID)) }],
    ['all time, one pipeline', ALL_TIME, { PipelineIDs: firstOf(deals.map((d) => d.PipelineID)) }],
    ['all time, one product company', ALL_TIME, { ProductCompanyIDs: firstOf(lines.map((l) => l.CompanyID)) }],
];

const FIGURES = Object.keys(clientFigures(ALL_TIME, {}));
for (const [name, window, filters] of CASES) {
    const client = clientFigures(window, filters);
    const server = await serverFigures(window, filters);
    for (const figure of FIGURES) {
        const serverValue = figure === 'WeightedAmount' ? Math.round(Number(server[figure] ?? 0) * 100) / 100 : Number(server[figure] ?? 0);
        record(`${name}: ${figure}`, client[figure], serverValue);
    }
    // The split must also RECONSTITUTE the whole, or one branch is silently dropping rows.
    record(`${name}: priced + stated = open amount`, client.OpenAmount, Number(server.OpenPricedAmount ?? 0) + Number(server.OpenStatedAmount ?? 0));
    record(`${name}: segments = open amount`, client.OpenAmount,
        Number(server.CommitAmount ?? 0) + Number(server.BestCaseOnlyAmount ?? 0) + Number(server.PipelineOnlyAmount ?? 0));
}
const pastDue = deals.filter(
    (d) => hasFlag(d, 'IsOpen') && !!d.ExpectedCloseDate && utcDatePart(d.ExpectedCloseDate) < todayBusiness,
);

/* ── The two tables ──────────────────────────────────────────────────────────────────────────── */

const roster = await new RunQuery().RunQuery(
    { QueryName: 'Sales: Deal Roster', CategoryPath: 'Sales' },
    user,
);
if (roster?.Success) {
    record('Roster row count', deals.length, roster.Results?.length ?? 0);

    // ClosingSoon: open deals expected to close from today through 30 days on, soonest first.
    const [y, m, dd] = todayBusiness.split('-').map(Number);
    const closingEnd = utcDatePart(new Date(Date.UTC(y, m - 1, dd + 30)));
    const soon = (rows, isOpen, close) => rows
        .filter((d) => isOpen(d) && !!close(d) && utcDatePart(close(d)) >= todayBusiness && utcDatePart(close(d)) <= closingEnd)
        .sort((a, b) => utcDatePart(close(a)).localeCompare(utcDatePart(close(b))));
    const clientSoon = soon(deals, (d) => hasFlag(d, 'IsOpen'), (d) => d.ExpectedCloseDate).map((d) => d.ID.toLowerCase());
    const querySoon = soon(roster.Results ?? [], (d) => d.IsOpen === true || d.IsOpen === 1, (d) => d.ExpectedCloseDate)
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
