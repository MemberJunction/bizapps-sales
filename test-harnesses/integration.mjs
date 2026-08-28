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

/**
 * `--mutations` is equivalent to `RUN_MUTATION_TESTS=1`, and exists so `package.json` can turn the
 * suite on WITHOUT an env-var prefix, which is not portable across cmd, PowerShell and sh. The
 * documented command must run the checks; making that depend on the caller remembering a prefix is
 * what produced a green tick over 125 checks nobody ran.
 */
const RUN_MUTATIONS = process.env.RUN_MUTATION_TESTS === '1' || process.argv.includes('--mutations');

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

/**
 * ── THE SUITE SERIALISES ITSELF. Concurrent runs used to corrupt each other's results. ──────────
 *
 * Three sessions share one host, and the checks are not read-only: each one writes a deal, its lines,
 * its instalments and a team row inside a transaction, then rolls back. Two of those overlapping take
 * locks on the same tables in whatever order they happen to reach them, and SQL Server resolves the
 * cycle by killing one -- so a run loses a check to `Transaction ... was deadlocked ... chosen as the
 * deadlock victim`, surfaced to the reporter as a bland `create failed: unknown error`.
 *
 * WHAT MADE IT EXPENSIVE is that the victim is chosen by the server, so the FAILING CHECK CHANGES from
 * run to run. That does not read like contention -- it reads like a flaky suite, or worse, like the
 * change under test. It was diagnosed twice independently, and confirmed by running the pristine base
 * commit and watching it fail identically with a different victim. Results were quietly unreliable for
 * days before anyone proved why.
 *
 * The fix is to make concurrency SAFE rather than asking people to take turns, since "don't run the
 * suite while I'm running the suite" is a convention that holds right up until someone is in a hurry.
 * An exclusive application lock means a second run WAITS and then produces a real result, instead of
 * racing and producing a plausible-looking wrong one.
 *
 * Why an applock and not a table or a lock file: it is held by the SQL SESSION, so it cannot outlive
 * the process that took it. A killed run, a crashed run, a Ctrl-C -- the connection drops and the lock
 * is released by the server. A lock file would need cleanup logic that is itself a source of stale-lock
 * bugs, and would not survive a machine with two checkouts pointed at one database, which is exactly
 * this situation.
 *
 * THE LOCK GETS ITS OWN CONNECTION, at `max: 1`. `@LockOwner = 'Session'` binds the lock to the
 * session that took it, and a pooled request can be handed any connection in the pool -- so acquiring
 * on the shared `pool` could take the lock on one session and release it from another, which fails.
 * A dedicated single-connection pool makes "the session" unambiguous for the whole run.
 */
const LOCK_RESOURCE = 'bizapps-sales:integration-suite';
const LOCK_TIMEOUT_MS = Number(process.env.MJ_INTEGRATION_LOCK_TIMEOUT_MS ?? 15 * 60_000);

const lockPool = await new sql.ConnectionPool({
    server: DB_HOST ?? 'localhost',
    port: Number(DB_PORT ?? 1433),
    database: DB_DATABASE,
    user: DB_USERNAME,
    password: DB_PASSWORD,
    options: { trustServerCertificate: true, encrypt: true },
    pool: { max: 1, min: 1 },
    requestTimeout: LOCK_TIMEOUT_MS + 30_000, // the request must outlive the lock wait, or mssql times out first
}).connect();

/**
 * `sp_getapplock` returns >= 0 on success (0 granted immediately, 1 granted after waiting) and a
 * negative value on failure: -1 timeout, -2 cancelled, -3 deadlock victim, -999 parameter or other
 * error. It is a RETURN VALUE, not a result set, so it needs an output parameter to read.
 */
async function acquireApplock(timeoutMs) {
    const request = lockPool.request();
    // Names must match the proc's own parameter names exactly -- `.execute()` binds by name, so a
    // `timeout` input silently becomes `@timeout` and never reaches `@LockTimeout`.
    request.input('Resource', sql.NVarChar(255), LOCK_RESOURCE);
    request.input('LockMode', sql.NVarChar(32), 'Exclusive');
    request.input('LockOwner', sql.NVarChar(32), 'Session');
    request.input('LockTimeout', sql.Int, timeoutMs);
    const result = await request.execute('sp_getapplock');
    return result.returnValue;
}

/**
 * A ZERO-TIMEOUT PROBE FIRST, purely so the waiting message is honest.
 *
 * Printing "waiting" unconditionally would be a lie on the common path, and printing it only after the
 * blocking call returns would print it after the wait was already over. Probing with timeout 0 tells us
 * whether the lock is actually contended BEFORE committing to a blocking wait, so the message appears
 * at the moment the wait starts -- which is the only moment it is useful.
 *
 * A PAUSE THAT DOES NOT EXPLAIN ITSELF READS AS A HANG, and someone will Ctrl-C it and conclude the
 * suite is broken. That is the failure this message exists to prevent.
 */
/**
 * ── A PARENT MAY ALREADY HOLD THE LOCK ON THIS RUN'S BEHALF ─────────────────────────────────────
 *
 * `mutate-checks.mjs` runs this suite up to three times for one mutant when a deadlock forces a
 * retry. Each run used to acquire the lock for itself, so every attempt QUEUED AFRESH behind whatever
 * else was on the host -- a measured 46.6s on a quiet evening. Three attempts plus two builds then
 * exceeded the ten-minute ceiling the driver runs under, and a retry that exists to survive deadlocks
 * had turned into a multiplier on an unrelated wait.
 *
 * So the driver acquires ONCE, around the whole attempt sequence, and sets this variable. The
 * queue is paid once per mutant instead of once per attempt, and a deadlock retry re-runs
 * immediately.
 *
 * THE CONTRACT IS NARROW AND WORTH STATING: this only skips ACQUIRING. It does not weaken the
 * serialisation, because the parent is holding the same lock for the same resource for longer than
 * this process lives. Setting it by hand, with nothing actually holding the lock, disables the
 * protection entirely -- which is why it names a parent rather than reading like a "skip lock" flag.
 */
const PARENT_HOLDS_LOCK = process.env.MJ_INTEGRATION_LOCK_HELD_BY_PARENT === '1';

const probe = PARENT_HOLDS_LOCK ? 0 : await acquireApplock(0);
if (PARENT_HOLDS_LOCK) {
    console.log('  (suite lock held by the parent process — not re-acquiring)');
}
if (probe < 0) {
    console.log(
        `
  ⏳ another integration run holds the suite lock on ${DB_DATABASE}.` +
            `
     WAITING up to ${Math.round(LOCK_TIMEOUT_MS / 1000)}s for it to finish — this is not a hang.` +
            `
     Runs serialise on purpose: overlapping them deadlocks and silently corrupts results.
`,
    );
    const waitStart = Date.now();
    const granted = await acquireApplock(LOCK_TIMEOUT_MS);
    /**
     * AN UNACQUIRED LOCK IS A FAILURE, NOT A REASON TO CARRY ON. Proceeding anyway would reintroduce
     * exactly the contention this exists to prevent, while now also claiming the lock protected it.
     * Exit 2 -- the same code this runner uses for "the environment is wrong", distinct from 1 for
     * "checks failed" -- because nothing was measured either way.
     */
    if (granted < 0) {
        console.error(
            `
✖ could not acquire the suite lock '${LOCK_RESOURCE}' within ` +
                `${Math.round(LOCK_TIMEOUT_MS / 1000)}s (sp_getapplock returned ${granted}).` +
                `
  Another run is still holding it, or is wedged. Nothing was measured.` +
                `
  Raise MJ_INTEGRATION_LOCK_TIMEOUT_MS if the other run is legitimately this slow.
`,
        );
        await lockPool.close();
        await pool.close();
        process.exit(2);
    }
    console.log(`  ✔ suite lock acquired after ${((Date.now() - waitStart) / 1000).toFixed(1)}s — starting.
`);
}

/**
 * Released explicitly on the ordinary exits for tidiness, but correctness does not depend on it: the
 * lock is session-scoped, so closing the pool -- or dying without closing anything -- frees it.
 */
async function releaseRunLock() {
    try {
        // Nothing to release if the parent holds it; closing the pool is still correct and harmless.
        await lockPool.close();
    } catch {
        /* the session is gone, which already released the lock */
    }
}

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
    // TASKS, for close-won-tasks. Its entities have to be REGISTERED, not merely migrated: the checks
    // resolve Tasks/Task Links/Task Assignments by name and the service saves through them.
    ['@mj-biz-apps/tasks-entities', 'LoadGeneratedEntities'],
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
async function resolveFromConsumer(name) {
    const { createRequire } = await import('node:module');
    /**
     * ANCHORED AT THE PACKAGES THAT DECLARE IT, STARTING WITH `packages/IntegrationTests`.
     *
     * This probe used to `import(name)` from the REPO ROOT. That works under a hoisted node_modules and
     * fails under a strict one, because the root declares only sales' own two packages — it is not a
     * consumer of orders or common and has no business knowing about them. Under a clean registry
     * install every downstream package resolved as `absent`, the suite ran 13 checks of 127, and printed
     * a green tick.
     *
     * Declaring them at the root would fix the symptom by making a lie true: the root would carry
     * dependencies nothing there imports, and they would drift the day a package stopped importing them.
     * IntegrationTests owns these checks, so its resolution is the one that should matter — but it
     * declares only two of the nine probed names, so the other consumers follow it. `orders-entities`
     * lives in CoreEntitiesServer, Angular and Entities; anchoring solely at IntegrationTests would
     * resolve two and call the rest absent.
     */
    for (const consumer of ['IntegrationTests', 'CoreEntitiesServer', 'Entities', 'Angular', 'Server', 'Actions']) {
        try {
            const require = createRequire(join(REPO_ROOT, 'packages', consumer, 'package.json'));
            return require.resolve(name);
        } catch {
            // try the next consumer
        }
    }
    return null;
}

/**
 * Every `@mj-biz-apps/*` package some sales package DECLARES, read from the manifests at run time.
 *
 * This is the line between "not installed on this host" and "resolution is broken". Accounting,
 * contracts and `orders-core-entities-server` are declared NOWHERE in sales — they are optional
 * downstream apps and this runner is documented to run whichever of their bundles a host supports.
 * `common-entities`, `orders-entities` and `tasks-entities` ARE declared, so sales does not build
 * without them and they must always resolve. Computed, not listed, so it cannot drift.
 */
function declaredDownstream() {
    const out = new Set();
    const manifests = ['package.json', ...['Actions', 'Angular', 'CoreEntitiesServer', 'Entities',
        'IntegrationTests', 'Server'].map((d) => join('packages', d, 'package.json'))];
    for (const rel of manifests) {
        try {
            const m = JSON.parse(readFileSync(join(REPO_ROOT, rel), 'utf8'));
            for (const block of [m.dependencies, m.devDependencies]) {
                for (const name of Object.keys(block ?? {})) {
                    if (name.startsWith('@mj-biz-apps/') && !name.startsWith('@mj-biz-apps/sales')) out.add(name);
                }
            }
        } catch {
            // an unreadable manifest contributes nothing rather than failing the run
        }
    }
    return out;
}

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
        // The CONSUMER's resolution first: a registry install puts these under the package that
        // declares them, never under the root this file runs from.
        const entry = (await resolveFromConsumer(pkg)) ?? (await resolveSiblingPackage(pkg));
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

/**
 * ── AN UNRESOLVABLE *DECLARED* PACKAGE IS A FAILURE, NOT A LOG LINE ────────────────────
 *
 * `selected === 0` is the wrong threshold and it let the worst outcome through. With every downstream
 * package unresolvable the suite still selected THIRTEEN checks — the bundles needing no sibling — so
 * the zero-guard never fired and the run printed a GREEN TICK over 114 checks that never executed.
 * Measured against published packages. A green tick for work that did not happen is the failure this
 * harness exists to prevent, and it is worse than a red: nobody investigates a pass.
 *
 * SCOPED TO DECLARED PACKAGES, and the scope is the substance. "Any absence fails" would be wrong in
 * the other direction: accounting and contracts are declared nowhere, are optional per host, and this
 * runner is documented to run whichever of their bundles a host supports. What cannot legitimately be
 * absent is a package sales DECLARES, because sales does not build without it — so its absence means
 * resolution broke, which is the measured bug.
 *
 * `MJ_SKIP_DOWNSTREAM=1` is already the deliberate opt-out for bisecting, so no new switch is needed.
 */
const declaredPkgs = declaredDownstream();
const unavailable = optionalLoads.filter((l) => {
    if (!l.endsWith(': absent') && !l.includes(': FAILED')) return false;
    return declaredPkgs.has(l.slice(0, l.lastIndexOf(': ')));
});
if (unavailable.length > 0 && process.env.MJ_SKIP_DOWNSTREAM !== '1') {
    console.error(
        [
            '',
            `✖ ${unavailable.length} DECLARED DOWNSTREAM PACKAGE(S) COULD NOT BE LOADED. The bundles that`,
            '  need them will not register, so this run would report a PASS for checks that never ran.',
            '',
            ...unavailable.map((l) => `    ${l}`),
            '',
            '  These are packages sales DECLARES, so they cannot legitimately be missing. Optional apps',
            '  (accounting, contracts) are not counted here.',
            '',
            '  A failure rather than a warning because the COUNT guard cannot catch it: with every',
            '  downstream package missing the suite still selects the bundles that need none and exits 0',
            '  having run a fraction of the checks. Measured: 13 of 127.',
            '',
            '  If they ARE installed this is a RESOLUTION problem, not an install problem. They resolve',
            '  from the packages that declare them, starting with packages/IntegrationTests.',
            '',
            '  To run deliberately without them:  MJ_SKIP_DOWNSTREAM=1 npm run test:integration',
            '',
        ].join(String.fromCharCode(10)),
    );
    process.exit(2);
}

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
 * Every bundle declares a `requires` in the manifest and is included only when that app actually
 * loaded above, which is what makes a single `test:integration` mean "everything this host can prove".
 * Only `forecast` requires nothing.
 *
 * This paragraph used to say "`save-deal` and `close-deal` always run — they need nothing but sales",
 * which the manifest has contradicted for some time: both declare `"requires": "orders"`, and both
 * genuinely need it — a deal embeds an order, so save-deal cannot write one and CD24 cannot read
 * `OrderHeader` without orders present. The claim mattered because it is the thing you would consult
 * before adding an import to either file, and it would have told you the wrong answer.
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
/**
 * -- THE RUN'S OWN DURATION, REPORTED, BECAUSE IT IS THE DISCRIMINATOR ------------------------------
 *
 * This host produces intermittent failures whose IDENTITY changes between runs, and two sessions
 * independently found that the bad runs are SLOW: 170-187s against a normal ~120s. Duration is therefore
 * the one signal separating "a real failure" from "this run was fighting for the machine" -- and it was
 * not printed, so every report of a red had to be argued from a memory of how long it felt.
 *
 * Measured on a quiet host on 2026-08-21: six full runs at 90-102s, five of them 121/0 and one losing a
 * single activities check. Conditions varied deliberately -- quiet, immediately after a Playwright run,
 * and under a concurrent full build -- and none reproduced the multi-check failures seen earlier that day.
 * That is consistent with load, and this line is what makes the correlation checkable next time instead of
 * remembered.
 *
 * ── DO NOT READ AN INTERMEDIATE VALUE AS DIAGNOSTIC YET ────────────────────────────────────────────
 *
 * The floor itself moves. Runs called quiet by the same person on the same machine read 90-91s earlier in
 * the day and 63s that evening -- roughly 30% -- so there is no established baseline to measure a middling
 * number against. Only two things are currently defensible: over ~150s WITH a failure has correlated with
 * the multi-check red, and 60-102s has correlated with clean. Anything between is unclassified, and calling
 * a 130s run "slow" would be inventing a threshold rather than reporting one.
 *
 * The honest use of this number today is comparative -- same session, same conditions, one run against the
 * next -- not absolute.
 */
const RUN_STARTED_AT = Date.now();

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

const RUN_SECONDS = Math.round((Date.now() - RUN_STARTED_AT) / 1000);
console.log(`\n${fail === 0 && selected > 0 && skipped === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed, ${skipped} skipped` + ` -- ${RUN_SECONDS}s`);

/**
 * A red on a SLOW run is not evidence on its own. Said here, next to the failure, rather than in a
 * document nobody opens with a red in front of them.
 */
if (fail > 0 && RUN_SECONDS > 150) {
    console.log(
        `\n  WARNING: this run took ${RUN_SECONDS}s. Runs over ~150s on this host have produced failures`
        + `\n  whose identity changes between runs, so REPEAT before acting on the red, and say which runs`
        + `\n  you are reporting. A quiet host completes in 90-120s.`,
    );
}

/**
 * ── A SKIPPED CHECK IS A CHECK THAT DID NOT RUN, WHATEVER THE TALLY SAYS ──────────
 *
 * `selected === 0` was the wrong threshold for the SECOND time. The bare documented command printed
 * `✅ 7 passed, 0 failed, 125 skipped` in one second and exited 0, because seven is not zero — a
 * green tick over 125 checks nobody ran, on the exact command `docs/QA-GUIDE.md` tells a tester to
 * use. It reads as "the suite is fine"; it took a maintainer an hour to conclude the suite was broken.
 *
 * KEYED ON THE CAUSE, NOT ON A FRACTION. `skipped` has exactly one source in this runner —
 * `RequiresMutation && !RUN_MUTATIONS` at the filter above — so "any skip without an opt-out" is
 * precise and needs no threshold anybody would have to justify. Bundles excluded for a missing
 * sibling reduce the candidate set; they do not count as skips, so they are unaffected.
 *
 * The opt-out is explicit and the same shape as `MJ_SKIP_DOWNSTREAM`: a deliberate narrow run stays
 * green, an accidental one goes red.
 */
if (skipped > 0 && process.env.MJ_ALLOW_SKIPPED !== '1') {
    console.error(
        [
            '',
            `✖ ${skipped} OF ${skipped + selected} CHECKS DID NOT RUN, so this result proves far less than it`,
            '  appears to. They are RequiresMutation and RUN_MUTATION_TESTS is not set.',
            '',
            `  ${pass} passed / ${fail} failed is a tally over ${selected} check(s), not over the suite.`,
            '',
            '  Run the whole suite:      npm run test:integration',
            '  Deliberately narrow run:  MJ_ALLOW_SKIPPED=1 node test-harnesses/integration.mjs',
            '',
        ].join(String.fromCharCode(10)),
    );
    flushLog();
    await releaseRunLock();
    await pool.close();
    process.exit(2);
}

// ── The vacuous-pass guard ─────────────────────────────────────────────────────────────────────
if (selected === 0) {
    console.error(
        '\n✖ ZERO CHECKS RAN, so this run proves nothing.\n' +
            `  ${skipped} check(s) were skipped because they are RequiresMutation and ` +
            'RUN_MUTATION_TESTS is not set.\n' +
            '  Re-run as:  RUN_MUTATION_TESTS=1 npm run test:integration\n',
    );
    flushLog();
    await releaseRunLock();
    await pool.close();
    process.exit(2);
}

flushLog();
await releaseRunLock();
await pool.close();
process.exit(fail === 0 ? 0 : 1);
