/**
 * Standalone runner for the sales integration checks.
 *
 * Resolves bundles from the SAME `IntegrationCheckRegistry` that `mj test` uses, so there is no drift
 * between "what the CLI runs" and "what this runs" — the registry is the single source, and this file
 * only supplies a provider, a user and a reporting loop. Modelled on bizapps-orders'
 * `test-harnesses/integration.mjs`.
 *
 * USAGE
 *   RUN_MUTATION_TESTS=1 node test-harnesses/integration.mjs              # every bundle
 *   RUN_MUTATION_TESTS=1 node test-harnesses/integration.mjs save-deal    # one bundle
 *   RUN_MUTATION_TESTS=1 node test-harnesses/integration.mjs save-deal.SD9  # one check
 *   IT_VERBOSE=1 ...                                                      # print stacks
 *
 * ⚠️ THE VACUOUS-PASS GUARD IS BUILT IN. Every sales check is `RequiresMutation`, so without
 * `RUN_MUTATION_TESTS=1` there is nothing to run — and a runner that printed "0 passed, 0 failed" and
 * exited 0 would be reporting success for having done nothing. That is the single most dangerous
 * outcome a test harness can produce, so **selecting zero checks is a FAILURE here**, with an exit code
 * and an explanation. Orders keeps that logic in a separate `assert-check-count.mjs`; it lives inside
 * the runner here so it cannot be skipped by running the runner directly.
 *
 * PRECONDITION: the seeds must have been run (`scripts/seed-dev-data.sh`, then
 * `scripts/seed-demo-data.sh`). The checks DISCOVER their fixture from those rows.
 */
import dotenv from 'dotenv';
import sql from 'mssql';

dotenv.config();

const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('-'));

const RUN_MUTATIONS = process.env.RUN_MUTATION_TESTS === '1';

const { DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD } = process.env;
if (!DB_DATABASE) {
    console.error('\n✖ DB_DATABASE is not set — is the repo-root .env present?\n');
    process.exit(2);
}

const pool = await new sql.ConnectionPool({
    server: DB_HOST ?? 'localhost',
    port: Number(DB_PORT ?? 1433),
    database: DB_DATABASE,
    user: DB_USERNAME,
    password: DB_PASSWORD,
    options: { trustServerCertificate: true, encrypt: true },
    pool: { max: 10, min: 1 },
    /**
     * `mssql` defaults `requestTimeout` to 15s. A save here writes a deal, its lines, its instalments
     * and a team row inside one transaction, and the whole thing runs on a laptop with SQL Server in a
     * container alongside everything else. Orders records losing several full-suite runs to a 15s
     * timeout that surfaced as an unrelated intermittent failure in a different check. 60s reflects what
     * this actually costs and still fails loudly on anything genuinely hung.
     */
    requestTimeout: 60_000,
}).connect();

const { setupSQLServerClient, SQLServerProviderConfigData } = await import(
    '@memberjunction/sqlserver-dataprovider'
);
/**
 * MJ v6 MOVED `UserCache` out of the SQL Server provider into the generic database provider.
 *
 * Destructuring it from `sqlserver-dataprovider` now silently yields `undefined`, and the first symptom
 * arrives several lines later as `Cannot read properties of undefined (reading 'Instance')` — which
 * reads like a broken cache rather than a moved import. bizapps-common hit the same wall and fixed it
 * the same way (302ea92, "import UserCache from generic-database-provider").
 */
const { UserCache } = await import('@memberjunction/generic-database-provider');
const provider = await setupSQLServerClient(
    new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'),
);

// The acting user, from MJ's own cache rather than a hand-rolled query — it arrives with roles and
// permissions already resolved, which is what the checks' RunView calls need.
await UserCache.Instance.Refresh(pool);
const user =
    UserCache.Users.find((u) => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
if (!user) {
    console.error('\n✖ no context user in UserCache — run scripts/seed-dev-data.sh first\n');
    process.exit(2);
}

// The server classes under test. Without this the ClassFactory resolves the GENERATED Deal entity and
// the suite measures nothing — see the note in packages/IntegrationTests/src/index.ts.
await import('@mj-biz-apps/sales-server').then((m) => m.LoadBizAppsSalesServer?.());

const { IntegrationCheckRegistry } = await import('@memberjunction/testing-integration');
await import('@mj-biz-apps/sales-integration-tests'); // side effect: registers the bundles

const registry = IntegrationCheckRegistry.Instance;
// Listed explicitly rather than taken from `registry.GetBundleNames()`, so that a bundle which fails to
// register — the failure mode a discovered list would hide as a shorter, still-green run — is a hard
// "no checks matched" instead.

/**
 * `product-picker` is DELIBERATELY ABSENT from the default gate, and this is not an oversight.
 *
 * PP1–PP4 read `MJ_BizApps_Orders: Products`, which needs orders' entity metadata registered in the
 * host. Orders' full schema cannot be applied here — it has hard foreign keys into
 * `__mj_BizAppsAccounting`, which has one into `__mj_BizAppsTasks` — and hand-registering the entity
 * does not make it resolvable to `Metadata`. So the checks are committed, compiled and runnable, but
 * they cannot pass on this host yet.
 *
 * They are LEFT OUT rather than made to pass vacuously, which is the failure mode this repo's own
 * `assert-check-count.mjs` exists to catch. Run them explicitly once orders' metadata is present:
 *
 *     RUN_MUTATION_TESTS=1 node test-harnesses/integration.mjs product-picker
 *
 * and add 'product-picker' back to this list in the same change.
 */
const ALL_BUNDLES = ['save-deal', 'close-deal'];

/**
 * `Storage` is only read by MJ's own cache bundles. A stub is honest here — ours never touch it, and
 * fabricating an instrumented cache would mean claiming to own the process for no benefit.
 */
const baseContext = {
    User: user,
    Provider: provider,
    Pool: pool,
    Schema: process.env.MJ_CORE_SCHEMA || '__mj',
    Storage: undefined,
};

const requested = only.length ? only : ALL_BUNDLES;
let pass = 0;
let fail = 0;
let skipped = 0;
let selected = 0;
const failures = [];

console.log(
    `\nsales integration checks — RUN_MUTATION_TESTS=${RUN_MUTATIONS ? '1' : '(unset)'} · db=${DB_DATABASE}`,
);

for (const request of requested) {
    const [bundle, ] = request.includes('.') ? request.split('.') : [request, null];
    const all = registry.GetBundle(bundle).filter((c) => !request.includes('.') || c.Id === request);
    if (all.length === 0) {
        console.error(`\n✖ no checks matched '${request}' — known bundles: ${registry.GetBundleNames().join(', ')}`);
        fail++;
        continue;
    }

    // THE GATE. A mutation check without the flag is SKIPPED and counted, never silently dropped.
    const checks = all.filter((c) => (c.RequiresMutation ? RUN_MUTATIONS : true));
    skipped += all.length - checks.length;
    selected += checks.length;

    console.log(`\n=== ${bundle} (${checks.length} of ${all.length} check${all.length === 1 ? '' : 's'}) ===`);
    if (checks.length === 0) {
        continue;
    }

    const ctx = { ...baseContext };
    const lifecycle = registry.GetLifecycle(bundle);

    try {
        if (lifecycle) await lifecycle.Setup(ctx);

        for (const check of checks) {
            const started = Date.now();
            try {
                await check.Fn(ctx);
                pass++;
                console.log(`  ✔ ${check.Name}  (${Date.now() - started}ms)`);
            } catch (e) {
                fail++;
                const message = String(e?.message ?? e).split('\n')[0];
                failures.push({ Id: check.Id, message, stack: e?.stack });
                console.log(`  ✖ ${check.Name}\n      ${message}`);
            }
        }
    } catch (e) {
        // A Setup failure fails the bundle, not the run — the remaining bundles still get a chance.
        fail++;
        failures.push({ Id: `${bundle}.<setup>`, message: String(e?.message ?? e), stack: e?.stack });
        // Print the WHOLE thing: mssql puts the useful part ('Invalid column name X') in nested
        // properties rather than the first line, and truncating it turns a two-minute fix into a bisect.
        console.log(`  ✖ bundle setup failed: ${String(e?.message ?? e)}`);
        for (const key of ['originalError', 'precedingErrors']) {
            const nested = e?.[key];
            if (!nested) continue;
            for (const n of Array.isArray(nested) ? nested : [nested]) {
                console.log(`      ↳ ${n?.message ?? n}`);
                if (n?.originalError?.message) console.log(`        ↳ ${n.originalError.message}`);
            }
        }
    } finally {
        if (lifecycle) await lifecycle.Teardown(ctx).catch((e) => console.warn(`  teardown warn: ${e?.message}`));
    }
}

if (failures.length && process.env.IT_VERBOSE) {
    console.log('\n=== stacks ===');
    for (const f of failures) console.log(`\n--- ${f.Id} ---\n${f.stack}`);
}

console.log(`\n${fail === 0 && selected > 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed, ${skipped} skipped`);

// ── The vacuous-pass guard ─────────────────────────────────────────────────────────────────────
if (selected === 0) {
    console.error(
        '\n✖ ZERO CHECKS RAN, so this run proves nothing.\n' +
            `  ${skipped} check(s) were skipped because they are RequiresMutation and ` +
            'RUN_MUTATION_TESTS is not set.\n' +
            '  Re-run as:  RUN_MUTATION_TESTS=1 npm run test:integration\n',
    );
    await pool.close();
    process.exit(2);
}

await pool.close();
process.exit(fail === 0 ? 0 : 1);
