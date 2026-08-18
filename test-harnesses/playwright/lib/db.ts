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

    pool = await new sql.ConnectionPool({
        server: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 1433),
        database: process.env.DB_DATABASE ?? '',
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        options: { trustServerCertificate: true, encrypt: true },
        requestTimeout: 30_000,
    }).connect();
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
    return QueryOne(`
        SELECT CONVERT(varchar(36), d.ID) AS ID, d.DealNumber,
               s.Name AS StatusName, s.IsWon, s.IsLost, s.LocksDeal
        FROM __mj_BizAppsSales.Deal d
        JOIN __mj_BizAppsSales.DealStatusType s ON s.ID = d.DealStatusTypeID
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
