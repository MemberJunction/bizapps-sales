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
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import sql from 'mssql';

dotenv.config();

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The bundle manifest — the SINGLE source of truth for how many checks each bundle holds and which
 * sibling app it needs. Shared with `scripts/assert-check-count.mjs` so the runner and the gate cannot
 * disagree about what this host should run.
 */
const MANIFEST = JSON.parse(readFileSync(join(REPO_ROOT, 'scripts', 'expected-check-counts.json'), 'utf8'));

/**
 * Everything printed is ALSO captured to a log file, because the coverage gate reads it.
 *
 * Done here rather than with a shell `| tee` on purpose: `tee` does not exist on a plain Windows shell,
 * and a pipe would make the runner's exit code the exit code of `tee`, so a failing suite would report
 * success. Capturing in-process keeps both the exit code and the log honest on every platform.
 */
const LOG_PATH = process.env.MJ_INTEGRATION_LOG ?? join(REPO_ROOT, 'test-harnesses', '.integration-log.txt');
const logLines = [];
for (const level of ['log', 'error', 'warn']) {
    const original = console[level].bind(console);
    console[level] = (...parts) => {
        logLines.push(parts.map((p) => (typeof p === 'string' ? p : String(p))).join(' '));
        original(...parts);
    };
}
function flushLog() {
    try {
        writeFileSync(LOG_PATH, `${logLines.join('\n')}\n`, 'utf8');
    } catch {
        // A log we cannot write must never fail a suite that otherwise passed — the gate will say so
        // for itself when it finds no log.
    }
}

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

/**
 * ORDERS, IF IT IS THERE — optional on purpose, and dynamic on purpose.
 *
 * The `close-won-handoff` bundle drives a real order through orders' own entity graph, and that needs
 * orders LOADED, not merely migrated: `OrderHeader.Lines` only exists on orders' generated subclass,
 * and `Orders.PriceOrder` only resolves once its `@RegisterClass` side effect has run. Without this the
 * failures are both misleading — `Cannot read properties of undefined (reading 'Create')` and a
 * ClassFactory falling back to the abstract base.
 *
 * A STATIC import would make orders a hard dependency of the sales test harness, which is precisely
 * what `DealLine.ProductID` being a soft reference exists to avoid: sales must still build, test and
 * run on a host where orders was never installed. So this is tried and shrugged off — the handoff
 * checks detect orders' absence themselves and skip rather than fail.
 */
const ORDERS_PACKAGES = [
    // [package, anti-tree-shaking anchor or null when the import's side effects are enough]
    //
    // ACCOUNTING COMES FIRST, and it is not optional padding. Orders BOOKS an order through
    // accounting's engine, and that engine serves `GLAccountLinks` from a cache it populates on load.
    // Without it every booking fails with `No GL account is linked for role 'Accounts Receivable'`
    // even when the links are sitting in the table — the resolver is reading an empty cache, not an
    // empty database, and the message cannot tell you which.
    // COMMON FIRST OF ALL, because the `activities` bundle writes through common's generated entity
    // subclasses. Without them `GetEntityObject` resolves a bare `BaseEntity`, which has no `Title` or
    // `ActivityTypeID` setter -- so every assignment silently becomes an own property, the save writes a
    // row of defaults, and the checks fail on an assertion about a field they appeared to set. That
    // failure names the field, not the missing import, which is why it is worth the comment.
    ['@mj-biz-apps/common-entities', 'LoadGeneratedEntities'],
    ['@mj-biz-apps/accounting-entities', 'LoadGeneratedEntities'],
    ['@mj-biz-apps/accounting-engine-base', null],
    ['@mj-biz-apps/accounting-core-entities-server', null],
    ['@mj-biz-apps/orders-entities', 'LoadGeneratedEntities'],
    ['@mj-biz-apps/orders-core-entities-server', null],
    // CONTRACTS, for the same reason and with the same ordering logic: `close-won-contract` resolves
    // contracts' entities by name, and `ContractsIsInstalled()` answers false until they are
    // registered. These were missing until now, which meant CT1–CT4 could not pass on ANY host — the
    // bundle reported a vacuous "4 passed" before the loud precondition landed, and a bare failure
    // after it. Absence here reads exactly like "contracts is not installed", which is why it went
    // unnoticed.
    ['@mj-biz-apps/contracts-entities', 'LoadGeneratedEntities'],
    ['@mj-biz-apps/contracts-core-entities-server', null],
];
const optionalLoads = [];

/**
 * Find a sibling workspace package by NAME, without depending on it.
 *
 * pnpm gives sales no `node_modules` entry for a package it does not declare, and the cross-repo
 * workspace does not hoist `@mj-biz-apps/*` to its root either — they live in a virtual store. So a
 * plain `import` of a sibling fails from here, and the useful fallback is to look for the package the
 * way a human would: scan the neighbouring repos for a `package.json` carrying that name.
 *
 * Folder names are NOT assumed (`EngineBase` vs `engine-base` vs `Entities`) — the name in
 * package.json is the only thing checked, so this keeps working when a sibling reorganises.
 */
async function resolveSiblingPackage(name) {
    const { readdirSync, existsSync, readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const parent = join(process.cwd(), '..');
    let repos = [];
    try {
        repos = readdirSync(parent, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
        return null;
    }
    for (const repo of repos) {
        const pkgDir = join(parent, repo, 'packages');
        if (!existsSync(pkgDir)) continue;
        let subs = [];
        try {
            subs = readdirSync(pkgDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
        } catch {
            continue;
        }
        for (const sub of subs) {
            const manifest = join(pkgDir, sub, 'package.json');
            if (!existsSync(manifest)) continue;
            try {
                if (JSON.parse(readFileSync(manifest, 'utf8')).name !== name) continue;
            } catch {
                continue;
            }
            const entry = join(pkgDir, sub, 'dist', 'index.js');
            return existsSync(entry) ? entry : null;
        }
    }
    return null;
}

// Escape hatch for bisecting: run the same host WITHOUT the downstream apps loaded, to tell a
// handoff problem apart from a host-data problem.
for (const [pkg, anchor] of (process.env.MJ_SKIP_DOWNSTREAM === '1' ? [] : ORDERS_PACKAGES)) {
    let mod = null;
    try {
        mod = await import(pkg);
    } catch {
        const entry = await resolveSiblingPackage(pkg);
        if (!entry) {
            optionalLoads.push(`${pkg}: absent`);
            continue;
        }
        try {
            const { pathToFileURL } = await import('node:url');
            mod = await import(pathToFileURL(entry).href);
        } catch (e) {
            // Reported, never swallowed: a sibling that is PRESENT but fails to load is a real problem
            // and must not read as "not installed".
            optionalLoads.push(`${pkg}: FAILED (${String(e.message).slice(0, 70)})`);
            continue;
        }
    }
    // NAMED anchors only. Calling every exported `Load*` looks tidier and is wrong: orders exports
    // `LoadPaymentProviderConfig`, a real configuration loader that THROWS when none is configured.
    if (anchor && typeof mod[anchor] === 'function') mod[anchor]();
    optionalLoads.push(`${pkg}: loaded`);
}
console.log(`  downstream packages -> ${optionalLoads.join(' | ')}`);

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
/**
 * The default run ADAPTS to what this host has linked.
 *
 * `save-deal` and `close-deal` always run — they need nothing but sales. The rest declare a `requires`
 * in the manifest and are included only when that app actually loaded above, which is what makes a
 * single `test:integration` mean "everything this host can prove": 30 checks standalone, 46 fully
 * linked.
 *
 * This replaced a hardcoded two-bundle list. That list was correct when orders could not be linked at
 * all, but it had become the reason a fully-linked host still ran only the default gate — the
 * conditional bundles existed, passed, and were never invoked by anything automatic.
 *
 * Note what is NOT done here: the list is still driven by the MANIFEST, not by
 * `registry.GetBundleNames()`. A bundle that fails to register must surface as "no checks matched",
 * not quietly shorten a still-green run.
 */
const linkedApps = new Set(
    Object.entries(MANIFEST.probes)
        .filter(([, pkg]) => optionalLoads.includes(`${pkg}: loaded`))
        .map(([app]) => app),
);
const ALL_BUNDLES = Object.entries(MANIFEST.bundles)
    .filter(([, spec]) => spec.requires === null || linkedApps.has(spec.requires))
    .map(([bundle]) => bundle);

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
    flushLog();
    await pool.close();
    process.exit(2);
}

flushLog();
await pool.close();
process.exit(fail === 0 ? 0 : 1);
