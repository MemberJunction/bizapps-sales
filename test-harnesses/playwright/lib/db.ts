/**
 * A read-only database handle for the Explorer specs.
 *
 * ── WHY A UI HARNESS TALKS TO THE DATABASE AT ALL ───────────────────────────────────────────────
 *
 * Normally it should not: a UI test that reaches past the UI is usually testing the wrong thing. This
 * one exception is the whole reason the close gap survived so long.
 *
 * Closing a deal is supposed to do three things the SCREEN CANNOT SHOW: create an order in another
 * app's schema, append a stage event, and apply the lock. Before this, the workspace could set a
 * winning status and save — the screen said "Deal saved", the deal read Won, and *none* of those three
 * happened. Every visible signal was identical to a real close. Only the database could tell them
 * apart, so the spec that guards this reads it.
 *
 * Read-only by construction: every helper here runs SELECTs. Nothing in a UI spec should be writing
 * rows behind the surface it is testing.
 */
import sql from 'mssql';

import { REPO_ROOT } from './env';

let pool: sql.ConnectionPool | null = null;

/**
 * The pool, opened lazily and reused.
 *
 * Reads the SAME `.env` the app does rather than taking its own configuration, so a spec can never
 * assert against a different database from the one the Explorer under test is writing to — which would
 * fail in the most confusing possible way.
 */
export async function Db(): Promise<sql.ConnectionPool> {
    if (pool) {
        return pool;
    }
    const dotenv = await import('dotenv');
    dotenv.config({ path: `${REPO_ROOT}/.env` });

    const database = process.env.DB_DATABASE ?? '';
    /**
     * ANNOUNCED, because getting this wrong is silent and expensive.
     *
     * These assertions only mean something if this is the SAME database the Explorer under test writes
     * to. On a standalone stack sales' `.env` is that database; on an MJ HOST stack it is not — the host
     * has its own, and the spec would then report a missing order that in fact exists, blaming the
     * feature for a configuration mistake. `dotenv` does not overwrite an already-set variable, so
     * `DB_DATABASE=... npx playwright test` wins; printing it makes the choice checkable in the log.
     */
    console.log(`  db: asserting against "${database}" (override with DB_DATABASE=...)`);

    pool = await new sql.ConnectionPool({
        server: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 1433),
        database,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        options: { trustServerCertificate: true, encrypt: true },
        requestTimeout: 30_000,
    }).connect();

    // A database with no sales schema cannot be the right one; say so now rather than as a SQL error
    // inside an assertion.
    const r = await pool.request().query(
        "SELECT COUNT(*) AS n FROM sys.schemas WHERE name = '__mj_BizAppsSales'",
    );
    if ((r.recordset[0]?.n ?? 0) === 0) {
        throw new Error(
            `"${database}" has no __mj_BizAppsSales schema, so it is not the database this Explorer is `
            + 'writing to. Set DB_DATABASE to the host\'s database before running these specs.',
        );
    }
    return pool;
}

export async function CloseDb(): Promise<void> {
    await pool?.close();
    pool = null;
}

/** One row, or undefined. */
export async function QueryOne<T extends Record<string, unknown>>(text: string): Promise<T | undefined> {
    const db = await Db();
    const r = await db.request().query(text);
    return r.recordset[0] as T | undefined;
}

/** Every row. */
export async function QueryAll<T extends Record<string, unknown>>(text: string): Promise<T[]> {
    const db = await Db();
    const r = await db.request().query(text);
    return r.recordset as T[];
}

/** A deal by name, with the flags a close is judged by. Escaped because names carry apostrophes. */
export async function DealByName(name: string): Promise<
    { ID: string; DealNumber: string; StatusName: string; IsWon: boolean; IsLost: boolean; LocksDeal: boolean } | undefined
> {
    /**
     * LEFT JOIN, and the difference is not academic.
     *
     * `DealStatusTypeID` is nullable, and a deal saved without a status is perfectly legal. An INNER
     * JOIN silently DROPS that row, so this returned `undefined` for a deal that plainly existed — and
     * the spec then failed with "Cannot read properties of undefined", blaming the feature for a defect
     * in its own query. A helper whose job is "does this row exist" must never be able to answer no
     * because of a join.
     *
     * The flags are coalesced to false so callers can read them without null-checking: no status means
     * not won, not lost, not locked, which is exactly right.
     */
    return QueryOne(`
        SELECT CONVERT(varchar(36), d.ID) AS ID, d.DealNumber,
               ISNULL(s.Name, '(none)') AS StatusName,
               ISNULL(s.IsWon, 0) AS IsWon, ISNULL(s.IsLost, 0) AS IsLost,
               ISNULL(s.LocksDeal, 0) AS LocksDeal
        FROM __mj_BizAppsSales.Deal d
        LEFT JOIN __mj_BizAppsSales.DealStatusType s ON s.ID = d.DealStatusTypeID
        WHERE d.Name = '${name.replace(/'/g, "''")}'`);
}

/** The stage events a deal has accumulated, newest first. Append-only, so this only ever grows. */
export async function StageEventsFor(dealID: string): Promise<{ ID: string; Notes: string | null }[]> {
    return QueryAll(`
        SELECT CONVERT(varchar(36), ID) AS ID, Notes
        FROM __mj_BizAppsSales.DealStageEvent
        WHERE DealID = '${dealID}'
        ORDER BY ChangedAt DESC`);
}

/**
 * Orders whose description names this deal.
 *
 * `CloseDealOperation.buildOrderInput` sets the order header's `Description` to the DEAL NAME, which is
 * the only link from an order back to its deal today — there is no `Deal.OrderID` column (that is a
 * separate architecture decision). Matching on it is therefore the honest available join, and the run
 * tag in every spec's deal name keeps it unambiguous across re-runs.
 */
export async function OrdersForDealNamed(dealName: string): Promise<
    { ID: string; OrderNumber: string | null; Status: string; TotalGross: number | null }[]
> {
    return QueryAll(`
        SELECT CONVERT(varchar(36), ID) AS ID, OrderNumber, Status, TotalGross
        FROM __mj_BizAppsOrders.OrderHeader
        WHERE Description = '${dealName.replace(/'/g, "''")}'`);
}

/** Whether orders is even installed on this host — the order assertions are meaningless without it. */
export async function OrdersSchemaPresent(): Promise<boolean> {
    const row = await QueryOne<{ n: number }>(
        "SELECT COUNT(*) AS n FROM sys.schemas WHERE name = '__mj_BizAppsOrders'",
    );
    return (row?.n ?? 0) > 0;
}
