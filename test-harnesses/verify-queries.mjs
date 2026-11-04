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
await UserCache.Instance.Refresh(provider);
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
    ['Sales: Forecast by Owner', { ...SLICED, OwnerEmployeeID: owner?.OwnerEmployeeID }],
    ['Sales: Deal Roster', { ...SLICED, OwnerEmployeeID: owner?.OwnerEmployeeID, OpenOnly: 'true' }],
    // WIDE included since the period selector: Won and the open figures take an optional window. Without
    // the period parameters the parameterised run would never reach those predicates, and a filter that
    // is never exercised reports clean — which is the exact failure shape this harness exists for.
    // The window is deliberately wide so the run still produces qualifying rows and EVIDENCE holds.
    ['Sales: Dashboard Summary', { CompanyID: company?.CompanyID, PipelineID: pipeline?.PipelineID, ...WIDE }],
    /**
     * THE FILTER BAR'S LISTS (bc-aidp-next-golive#350), each a `sqlIn` array. Run as a second entry per
     * query because MJ types these parameters `array` from the template: a run that passed only the
     * single-value parameters would never render an `IN (...)` and would report clean over a list path
     * nobody exercised. Product company is left out here because the slice's company need not own a
     * product on a line; `compare-dashboard-measures.mjs` exercises it with one taken from the lines.
     */
    ['Sales: Dashboard Summary', { CompanyIDs: [company?.CompanyID], PipelineIDs: [pipeline?.PipelineID], ...WIDE }],
    ['Sales: Win Rate by Count and Value', { CompanyIDs: [company?.CompanyID], PipelineIDs: [pipeline?.PipelineID], ...WIDE }],
    ['Sales: Deal Roster', { CompanyIDs: [company?.CompanyID], PipelineIDs: [pipeline?.PipelineID], OwnerEmployeeIDs: [owner?.OwnerEmployeeID] }],
    // The Board's read (bc-aidp-next-golive#351): the filter lists with the period as a closed-deal window.
    ['Sales: Deal Roster', { CompanyIDs: [company?.CompanyID], PipelineIDs: [pipeline?.PipelineID], ClosedSince: '2000-01-01', ClosedUntil: '2099-12-31' }],
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
    // An owner-grain forecast with no open or won deals behind it proves nothing about the join to
    // Employee or the owner GROUP BY, so require real deals rather than merely a row.
    'Sales: Forecast by Owner': (r) => Number(r.OpenDealCount ?? 0) + Number(r.WonDealCount ?? 0) > 0,
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

/**
 * Rolled-back transaction fixtures for edge-case query rows (#355 items 8-12, #418):
 *   1. Person-backed rep rows stay distinct in deal-involvement-by-rep.sql (not merged into one NULL row).
 *   2. A won deal with no active owner row reports under '(unassigned)' in bookings-by-owner.sql.
 *   3. Two currencies produce separate CurrencyCode rows in dashboard-summary.sql, win-rate.sql, forecast-by-owner.sql.
 *   4. An inactive ForecastCategoryType still reports under its name in forecast-by-owner.sql and forecast-by-category.sql.
 *   5. A won deal with NULL ActualCloseDate and NULL ClosedAt falls back to __mj_UpdatedAt in won-deals-order-not-confirmed.sql.
 */
import { readFileSync } from 'node:fs';
const sqlFile = (f) =>
    readFileSync(new URL(`../metadata/queries/SQL/${f}`, import.meta.url), 'utf8')
        .replace(/\{%[\s\S]*?%\}/g, '');

const tx = new sql.Transaction(pool);
await tx.begin();
try {
    const req = () => new sql.Request(tx);
    const seed = (await req().query(`
        SELECT TOP 1
            d.CompanyID,
            d.PipelineID,
            d.PipelineStageID,
            d.DealTypeID,
            (SELECT TOP 1 ID FROM __mj_BizAppsSales.DealStatusType WHERE IsWon = 1) AS WonStatusID,
            (SELECT TOP 1 ID FROM __mj_BizAppsSales.DealStatusType WHERE IsOpen = 1) AS OpenStatusID,
            (SELECT TOP 1 ID FROM __mj_BizAppsSales.DealRole WHERE IsOwnerRole = 0 AND IsActive = 1) AS RepRoleID,
            (SELECT TOP 1 ID FROM __mj_BizAppsAccounting.Currency WHERE Code = N'USD') AS UsdID,
            (SELECT TOP 1 ID FROM __mj_BizAppsAccounting.Currency WHERE Code <> N'USD') AS AltCurID
        FROM __mj_BizAppsSales.Deal d
        WHERE d.CompanyID IS NOT NULL AND d.PipelineID IS NOT NULL
    `)).recordset[0];

    if (seed?.CompanyID && seed?.PipelineID && seed?.WonStatusID && seed?.OpenStatusID) {
        // Fixture 1 & 2 & 5: two Person records, an unowned won deal with null close dates, and person team members
        await req().query(`
            DECLARE @p1 UNIQUEIDENTIFIER = NEWID(), @p2 UNIQUEIDENTIFIER = NEWID();
            INSERT INTO __mj_BizAppsCommon.Person (ID, FirstName, LastName, Status)
            VALUES (@p1, N'PartnerOne', N'VerifyFixture', N'Active'),
                   (@p2, N'PartnerTwo', N'VerifyFixture', N'Active');

            DECLARE @catInactive UNIQUEIDENTIFIER = NEWID();
            INSERT INTO __mj_BizAppsSales.ForecastCategoryType
                (ID, Code, Name, DisplayRank, IncludeInPipeline, IncludeInBestCase, IncludeInCommit, IsActive)
            VALUES (@catInactive, N'VERIFY_INACTIVE_CAT', N'Verify Inactive Category', 99, 1, 0, 0, 0);

            DECLARE @curAlt UNIQUEIDENTIFIER = ISNULL('${seed.AltCurID || ''}', NEWID());
            IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsAccounting.Currency WHERE ID = @curAlt)
                INSERT INTO __mj_BizAppsAccounting.Currency (ID, Code, Name, Symbol, DecimalPlaces, IsActive)
                VALUES (@curAlt, N'ZZZ', N'Verify Currency', N'Z', 2, 1);

            DECLARE @dWonUnowned UNIQUEIDENTIFIER = NEWID(), @dOpenAltCur UNIQUEIDENTIFIER = NEWID();
            INSERT INTO __mj_BizAppsSales.Deal
                (ID, CompanyID, Name, PipelineID, PipelineStageID, DealTypeID, DealStatusTypeID,
                 ForecastCategoryTypeID, Amount, Probability, ActualCloseDate, ClosedAt, CurrencyID)
            VALUES
                (@dWonUnowned, '${seed.CompanyID}', N'Verify Won Unowned Null Close', '${seed.PipelineID}',
                 '${seed.PipelineStageID}', '${seed.DealTypeID}', '${seed.WonStatusID}',
                 @catInactive, 1000, 100, NULL, NULL, '${seed.UsdID || ''}'),
                (@dOpenAltCur, '${seed.CompanyID}', N'Verify Open Alt Currency', '${seed.PipelineID}',
                 '${seed.PipelineStageID}', '${seed.DealTypeID}', '${seed.OpenStatusID}',
                 @catInactive, 2000, 50, NULL, NULL, @curAlt);

            IF '${seed.RepRoleID || ''}' <> ''
            BEGIN
                INSERT INTO __mj_BizAppsSales.DealTeamMember (ID, DealID, PersonID, RoleID, AttributionWeight, IsActive)
                VALUES (NEWID(), @dWonUnowned, @p1, '${seed.RepRoleID}', 50, 1),
                       (NEWID(), @dWonUnowned, @p2, '${seed.RepRoleID}', 50, 1);
            END
        `);

        const repRows = (await req().query(sqlFile('deal-involvement-by-rep.sql'))).recordset;
        const fixtureReps = repRows.filter((r) => String(r.RepName ?? '').includes('VerifyFixture'));
        if (fixtureReps.length < 2) {
            failed++;
            console.log(`  ✖ fixture: deal-involvement-by-rep.sql merged or dropped Person reps (got ${fixtureReps.length})`);
        } else {
            console.log('  ✔ fixture: deal-involvement-by-rep.sql keeps Person reps distinct');
        }

        const ownerBookings = (await req().query(sqlFile('bookings-by-owner.sql'))).recordset;
        if (!ownerBookings.some((r) => r.OwnerName === '(unassigned)' && Number(r.WonCount) >= 1)) {
            failed++;
            console.log('  ✖ fixture: bookings-by-owner.sql dropped unowned won deal');
        } else {
            console.log('  ✔ fixture: bookings-by-owner.sql includes unowned won deal under (unassigned)');
        }

        const summaryRows = (await req().query(sqlFile('dashboard-summary.sql'))).recordset;
        if (new Set(summaryRows.map((r) => r.CurrencyCode)).size < 2) {
            failed++;
            console.log('  ✖ fixture: dashboard-summary.sql did not group by CurrencyCode across multiple currencies');
        } else {
            console.log('  ✔ fixture: dashboard-summary.sql groups totals by CurrencyCode');
        }

        const catRows = (await req().query(sqlFile('forecast-by-category.sql'))).recordset;
        if (!catRows.some((r) => r.ForecastCategoryCode === 'VERIFY_INACTIVE_CAT')) {
            failed++;
            console.log('  ✖ fixture: forecast-by-category.sql hid inactive ForecastCategoryType');
        } else {
            console.log('  ✔ fixture: forecast-by-category.sql reports deals in inactive ForecastCategoryType');
        }

        const unconfirmedRows = (await req().query(sqlFile('won-deals-order-not-confirmed.sql'))).recordset;
        if (!unconfirmedRows.some((r) => r.DealName === 'Verify Won Unowned Null Close' && r.CloseDate != null)) {
            failed++;
            console.log('  ✖ fixture: won-deals-order-not-confirmed.sql did not fall back to __mj_UpdatedAt when close dates are NULL');
        } else {
            console.log('  ✔ fixture: won-deals-order-not-confirmed.sql falls back to __mj_UpdatedAt when close dates are NULL');
        }
    }
} finally {
    await tx.rollback();
}

await pool.close();
process.exit(failed ? 1 : 0);
