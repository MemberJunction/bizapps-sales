/**
 * Settles one question for orders: does `OrderHeader.Lines.Dirty` become true when a line is REMOVED,
 * or does it only track additions and edits?
 *
 * ── WHY IT MATTERS ENOUGH TO RUN ────────────────────────────────────────────────────────────────
 *
 * The natural fix for orders' dropped-removal bug is to gate a new delete pass on the collection being
 * dirty:
 *
 *     if (this.Lines.Dirty) { … process removals … }
 *
 * If `Dirty` does not reflect removals, that fix does nothing for the bug it was written for — while
 * passing any test that adds a line and then removes it, because the ADDITION sets the flag. The only
 * test that catches it is one that removes without adding, which is the exact case the bug is about.
 *
 * Reading the getter off a `.d.ts` does not settle it: `Dirty` is a getter and what it consults is the
 * question. So this drives the real object.
 *
 * ── DISCIPLINE ──────────────────────────────────────────────────────────────────────────────────
 *
 * In-process, inside one transaction that is always rolled back, and it modifies nothing in the orders
 * repository. This is a behavioural question, not a change.
 *
 * The two controls are the point. A bare "Dirty is false after removal" could mean removals are not
 * tracked OR that `Dirty` is inert on this collection for every operation. Running an edit and an add
 * against the same collection distinguishes those, and only the first is a finding.
 */
import 'dotenv/config';
import sql from 'mssql';

const out = [];
const say = (label, value, note) => out.push({ label, value, note });

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

// Orders' SERVER subclass, or ClassFactory resolves the generated OrderHeader and the collection
// under test is not the one the app actually runs.
await import('@mj-biz-apps/orders-core-entities-server').then((m) =>
    m.LoadOrdersCoreEntitiesServer?.(),
);

const one = async (q) => (await provider.ExecuteSQL(q))?.[0];

// An order that actually has more than one line, so a removal leaves something behind and the
// collection is not merely emptied.
const target = await one(`
    SELECT TOP 1 ol.OrderHeaderID AS ID, COUNT(*) AS LineCount
      FROM __mj_BizAppsOrders.OrderLine ol
     GROUP BY ol.OrderHeaderID
    HAVING COUNT(*) > 1
     ORDER BY COUNT(*) DESC`);

if (!target) {
    console.error('\n  ✖ no order with more than one line — cannot run the probe\n');
    process.exit(2);
}

console.log(`\n  database: ${process.env.DB_DATABASE}`);
console.log(`  order:    ${target.ID}  (${target.LineCount} lines)\n`);

const db = provider;
await db.BeginTransaction();
try {
    /**
     * THE CHILD COLLECTION MUST BE LOADED EXPLICITLY, and the first run of this probe did not do it.
     *
     * `order.Load()` does not populate `Lines.Items` -- the collection exposes its own `Load()`. So the
     * first attempt read `Items.length === 0`, called `Remove(undefined)`, and reported `Dirty === false`.
     * That looked exactly like the answer being sought and was measured over an empty collection: a
     * removal that never happened cannot dirty anything.
     *
     * Worth recording because it is the same failure shape as the query that was 'clean' over zero rows.
     * The guard below makes it impossible to repeat silently.
     */
    const load = async () => {
        const o = await provider.GetEntityObject('MJ_BizApps_Orders: Order Headers', user);
        if (!(await o.Load(target.ID))) throw new Error('could not load the order');
        await o.Lines.Load();
        if (o.Lines.Items.length === 0) {
            throw new Error('Lines.Items is empty after Load() -- the probe would measure nothing');
        }
        return o;
    };

    /* ── THE QUESTION ───────────────────────────────────────────────────────────────────────── */
    {
        const order = await load();
        const before = order.Lines.Items.length;
        const dirtyBefore = order.Lines.Dirty;
        const removedId = order.Lines.Items[0].ID;
        order.Lines.Remove(order.Lines.Items[0]);
        say('Items before removal', before);
        say('Lines.Dirty BEFORE any change', dirtyBefore, 'must be false, or nothing below means anything');
        say('Items after Remove()', order.Lines.Items.length, 'confirms the removal was applied to the collection');
        say('Lines.Dirty after REMOVAL ONLY', order.Lines.Dirty, '← THE ANSWER');

        // If Dirty is false, orders needs another route to find removals. Report what the object
        // actually exposes rather than leaving them to search for it.
        const surface = [];
        for (const k of ['DeletedItems', 'RemovedItems', 'Deletions', 'PendingDeletes', 'Removed']) {
            if (k in order.Lines) surface.push(`${k}=${JSON.stringify(order.Lines[k]?.length ?? order.Lines[k])}`);
        }
        const keys = [
            ...Object.keys(order.Lines),
            ...Object.getOwnPropertyNames(Object.getPrototypeOf(order.Lines)),
        ].filter((k) => !k.startsWith('_') && k !== 'constructor');
        say('Removal-tracking members present', surface.length ? surface.join(', ') : 'none of the obvious names');
        // What `Removed` actually holds matters more than that it exists: if it carries the removed
        // ENTITY, a fix can read primary keys straight off it rather than diffing against a reload.
        const removedList = order.Lines.Removed ?? [];
        const first = removedList[0];
        say('Removed[0] is the line that was removed',
            first ? (String(first.ID ?? '').toLowerCase() === String(removedId).toLowerCase() ? 'yes' : 'NO - different row') : 'n/a',
            first ? `ID ${first.ID}` : '');
        say('Removed[0] type', first ? (typeof first.Save === 'function' ? 'a BaseEntity (has Save)' : typeof first) : 'n/a',
            'determines whether a fix can call Delete() on it directly');
        say('Collection public surface', [...new Set(keys)].join(', '));
    }

    /* ── CONTROL 1: does Dirty respond to an EDIT on this same collection? ──────────────────── */
    {
        const order = await load();
        const line = order.Lines.Items[0];
        line.Quantity = Number(line.Quantity ?? 1) + 1;
        say('Lines.Dirty after an EDIT', order.Lines.Dirty, 'control — proves Dirty is not simply inert');
    }

    /* ── CONTROL 2: does Dirty respond to an ADD? ───────────────────────────────────────────── */
    {
        const order = await load();
        const added = await order.Lines.Create();
        say('Lines.Dirty after an ADD', order.Lines.Dirty, 'control — the case a naive test would use');
        say('  (added item present)', added ? 'yes' : 'no');
    }
} catch (err) {
    say('THREW', String(err).slice(0, 300));
} finally {
    try {
        await db.RollbackTransaction();
    } catch {
        /* nothing to roll back */
    }
}

const w = Math.max(...out.map((o) => o.label.length));
for (const o of out) {
    console.log(`  ${o.label.padEnd(w)}  ${String(o.value)}${o.note ? `    ${o.note}` : ''}`);
}
console.log('');
await pool.close();
