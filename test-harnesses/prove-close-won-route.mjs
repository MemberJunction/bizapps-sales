/**
 * Proves the WHOLE close-won contract route, not just the seam.
 *
 * ── HOW THIS DIFFERS FROM prove-contracts-seam.mjs ──────────────────────────────────────────────
 *
 * That one calls `LiveContractsSeam.CreateContractFromDeal` directly. This runs `Sales.CloseDeal` —
 * the actual remote operation — so the routing decision, the policy read, the seam call and
 * `ContractEntityServer.Save()` all execute in the order a real close executes them.
 *
 * ── AND HOW IT DIFFERS FROM THE RUNNING API ─────────────────────────────────────────────────────
 *
 * It loads exactly the packages MJAPI loads, through the same `StartupExport` functions named in
 * `mj.config.cjs` `dynamicPackages.server`. What it does NOT exercise is the GraphQL transport: MJAPI
 * answers 401 and the cached Playwright bearer token expired, so an HTTP call needs an interactive
 * human login. Everything above the wire is the same code path; the wire itself is not covered here
 * and should not be claimed as covered.
 *
 * Writes inside one provider transaction and rolls back, so the shared host is left clean — and the
 * rollback is asserted rather than assumed, because a silent no-rollback already happened once.
 */
import 'dotenv/config';
import sql from 'mssql';

const results = [];
const record = (ok, label, detail) => results.push({ ok, label, detail });

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

/**
 * THE ENTITY-SERVER TIER, which is the tier that decides this route.
 *
 * The `*-server` packages MJAPI names in `dynamicPackages` are the GRAPHQL layer: they register
 * resolvers and pull in type-graphql. Nothing in a close touches a resolver — `Sales.CloseDeal` runs
 * server-side and reaches contracts through `LiveContractsSeam`, so what has to be registered is
 * `ContractEntityServer`, which lives in contracts-core-entities-server and is what
 * contracts-server re-exports the registration of.
 *
 * Loading the entity-server packages directly keeps type-graphql, graphql and reflect-metadata out of
 * this process entirely — CLAUDE.md records that they must collapse to a single copy or buildSchema
 * dies on a decorator that is perfectly correct, and a proof script is not worth that risk. MJAPI
 * itself loads the full server packages and was verified doing so; this covers the layer beneath.
 */
await import('@mj-biz-apps/orders-core-entities-server').then((m) => m.LoadOrdersCoreEntitiesServer?.());
await import('@mj-biz-apps/contracts-core-entities-server').then((m) =>
    m.LoadMjBizappsContractsEntitiesServer?.(),
);
await import('@mj-biz-apps/sales-core-entities-server').then((m) => m.LoadSalesCoreEntitiesServer?.());

const { CloseDealOperation } = await import('@mj-biz-apps/sales-core-entities-server');

const db = provider;
const one = async (q) => (await db.ExecuteSQL(q))?.[0];

console.log(`\n  database: ${process.env.DB_DATABASE}`);

// A CONTRACT-CREATING pipeline, chosen by its policy FLAG rather than by its name.
const pipes = await db.ExecuteSQL(
    `SELECT ID, Name, CloseWonPolicy FROM __mj_BizAppsSales.Pipeline WHERE IsActive = 1`,
);
const contractPipe = (pipes ?? []).find((p) => {
    try {
        return JSON.parse(p.CloseWonPolicy ?? '{}').CreateContract === true;
    } catch {
        return false;
    }
});
record(!!contractPipe, 'a pipeline whose policy sets CreateContract = true exists', contractPipe?.Name ?? '');
if (!contractPipe) process.exit(2);

const policy = JSON.parse(contractPipe.CloseWonPolicy);

// Does the type code the policy names actually exist in contracts' vocabulary?
const typeRow = await one(
    `SELECT ID, Name FROM __mj_BizAppsContracts.ContractType WHERE Name = '${String(policy.ContractTypeCode ?? '').replace(/'/g, "''")}'`,
);
record(
    !!typeRow,
    `the policy's ContractTypeCode '${policy.ContractTypeCode}' resolves to a seeded contract type`,
    typeRow ? typeRow.Name : 'NO MATCH — v2 seeds Order Form / Statement of Work / Payment Link / Change Order',
);

const openIDs = (
    await db.ExecuteSQL(
        `SELECT ID FROM __mj_BizAppsSales.DealStatusType WHERE IsOpen = 1 AND IsActive = 1`,
    )
).map((r) => String(r.ID).toLowerCase());
const won = await one(
    `SELECT TOP 1 ID FROM __mj_BizAppsSales.DealStatusType WHERE IsWon = 1 AND IsActive = 1`,
);
const deal = (
    await db.ExecuteSQL(
        `SELECT ID, Name, DealStatusTypeID FROM __mj_BizAppsSales.Deal WHERE PipelineID = '${contractPipe.ID}'`,
    )
).find((d) => openIDs.includes(String(d.DealStatusTypeID).toLowerCase()));
record(!!deal, 'an OPEN deal exists on that pipeline to close', deal?.Name ?? '');
if (!deal || !won) process.exit(2);

const before = Number((await one(`SELECT COUNT(*) AS N FROM __mj_BizAppsContracts.Contract`)).N);

await db.BeginTransaction();
let out = null;
try {
    /**
     * CORRECT THE STALE TYPE CODE IN-TRANSACTION, so the two questions stay separate.
     *
     * As seeded, the B2B policy names 'Standard' — v1 contracts vocabulary (MSA / Standard /
     * Membership / Evergreen / Pilot) that the 2026-08-18 rebuild replaced with document-shaped names.
     * The assertion above records that as the defect it is. But leaving it there would conflate a
     * STALE SEED VALUE with a BROKEN ROUTE, and they need different fixes by different people.
     *
     * So the policy is pointed at a type that actually exists, inside the transaction, and rolled back
     * with everything else. If the route then works, the route is fine and only the seed is wrong.
     */
    /**
     * 'Order Form', which is what S-US2 names as the default -- and picking it by RULE rather than
     * alphabetically matters. The first attempt took `ORDER BY Name` and got 'Change Order', whose
     * `ParentStatusRequirement = 'Required'` made contracts refuse the save: a change order that amends
     * nothing would never appear in the original agreement's lineage. That refusal is contracts' own
     * validation working exactly as designed, so the filter below asks for a type that STANDS ALONE
     * rather than assuming any active type will do.
     */
    const validType = await one(
        `SELECT TOP 1 Name FROM __mj_BizAppsContracts.ContractType
          WHERE Status = 'Active' AND ParentStatusRequirement IS NULL ORDER BY Name`,
    );
    const fixed = { ...policy, ContractTypeCode: validType.Name };
    await db.ExecuteSQL(
        `UPDATE __mj_BizAppsSales.Pipeline SET CloseWonPolicy = '${JSON.stringify(fixed).replace(/'/g, "''")}' WHERE ID = '${contractPipe.ID}'`,
    );
    record(true, `policy repointed in-transaction to '${validType.Name}' (rolled back after)`, '');

    const op = new CloseDealOperation();
    const raw = await op.Execute(
        { DealID: deal.ID, DealStatusTypeID: won.ID },
        { provider, user },
    );
    out = raw?.Output ?? raw;

    record(out?.Success === true, 'Sales.CloseDeal reports success', JSON.stringify(out?.Issues ?? []).slice(0, 220));

    const plans = out?.Routing ?? out?.Plans ?? [];
    const contractPlan = (Array.isArray(plans) ? plans : []).find((p) => p.Target === 'Contract');
    record(!!contractPlan, 'the close planned a Contract route', JSON.stringify(contractPlan ?? {}).slice(0, 200));
    record(
        contractPlan?.Executed === true,
        'and that route EXECUTED',
        contractPlan?.Executed ? `ContractID ${contractPlan.RecordID}` : `reason: ${contractPlan?.Reason ?? 'n/a'}`,
    );

    if (contractPlan?.RecordID) {
        const row = await one(
            `SELECT * FROM __mj_BizAppsContracts.Contract WHERE ID = '${contractPlan.RecordID}'`,
        );
        record(!!row, 'the contract row exists in the database', `CTR ${row?.ContractNumber ?? '?'}`);
        record(
            !!row && !row.EffectiveDate && !row.ExecutedDate && !row.EndDate && !row.TerminatedDate,
            'it carries no dates, so it displays as Draft',
            '',
        );
        const dealAfter = await one(
            `SELECT ContractID FROM __mj_BizAppsSales.Deal WHERE ID = '${deal.ID}'`,
        );
        record(
            String(dealAfter?.ContractID ?? '').toLowerCase() === String(contractPlan.RecordID).toLowerCase(),
            'the deal was stamped with its ContractID (S-US2 step 4)',
            `${dealAfter?.ContractID}`,
        );
    }
} catch (err) {
    record(false, 'the close threw', String(err).slice(0, 300));
} finally {
    try {
        await db.RollbackTransaction();
    } catch {
        /* nothing to roll back */
    }
}

const after = Number((await one(`SELECT COUNT(*) AS N FROM __mj_BizAppsContracts.Contract`)).N);
record(after === before, 'the rollback left the host clean', `contracts before=${before} after=${after}`);

console.log('');
for (const r of results) console.log(`  ${r.ok ? '✔' : '✖'} ${r.label}${r.detail ? `  — ${r.detail}` : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n  ${results.length - failed} passed, ${failed} failed\n`);
await pool.close();
process.exit(failed ? 1 : 0);
