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

/**
 * The stage events a deal has accumulated, newest first. Append-only, so this only ever grows.
 *
 * The TRANSITION STAMPS are selected because they are the reason the row is worth keeping. Without
 * `AmountAtTransition` / `ProbabilityAtTransition`, "what did we think the forecast was on the 1st" is
 * unanswerable once the amounts move — which is the whole of Rule 3. They were previously not selected,
 * so no browser spec could assert them on the close path even though `80` asserts them on the drag path.
 */
export async function StageEventsFor(dealID: string): Promise<
    {
        ID: string;
        Notes: string | null;
        AmountAtTransition: number | null;
        ProbabilityAtTransition: number | null;
        FromStageID: string | null;
        ToStageID: string | null;
    }[]
> {
    return QueryAll(`
        SELECT CONVERT(varchar(36), ID) AS ID, Notes,
               AmountAtTransition, ProbabilityAtTransition,
               CONVERT(varchar(36), FromStageID) AS FromStageID,
               CONVERT(varchar(36), ToStageID) AS ToStageID
        FROM __mj_BizAppsSales.DealStageEvent
        WHERE DealID = '${dealID}'
        ORDER BY ChangedAt DESC`);
}

/**
 * The embedded order's lines for a deal, joined through `Deal.OrderID`.
 *
 * NOT through `OrderHeader.Description`, which is what `OrdersForDealNamed` matches on. That column is
 * set by `CloseDealOperation.buildOrderInput` at CLOSE time; an order provisioned with the deal on first
 * save leaves it NULL — measured, most orders on this host have a null description. A read-back that
 * joined on the name would therefore find nothing for an unclosed deal and, depending on how it was
 * written, either fail confusingly or pass vacuously.
 */
export async function OrderLinesForDeal(dealName: string): Promise<
    { ProductID: string; Quantity: number; UnitPrice: number; LineNumber: number }[]
> {
    return QueryAll(`
        SELECT CONVERT(varchar(36), l.ProductID) AS ProductID, l.Quantity, l.UnitPrice, l.LineNumber
        FROM __mj_BizAppsSales.Deal d
        JOIN __mj_BizAppsOrders.OrderLine l ON l.OrderHeaderID = d.OrderID
        WHERE d.Name = '${dealName.replace(/'/g, "''")}'
        ORDER BY l.LineNumber`);
}

/**
 * Orders whose description names this deal.
 *
 * `CloseDealOperation.buildOrderInput` sets the order header's `Description` to the DEAL NAME, and the
 * run tag in every spec's deal name keeps that unambiguous across re-runs.
 *
 * ── CORRECTION: `Deal.OrderID` EXISTS, and this docblock said it did not ─────────────────────────
 *
 * It claimed "there is no `Deal.OrderID` column (that is a separate architecture decision)". There is
 * one — nullable, verified against the live schema, and `save-deal.checks.ts` reads `deal.OrderID`
 * directly. The column arrived with the embedded-order work and this comment was never updated.
 *
 * The distinction MATTERS, and reading the stale comment sent a read-back down the wrong path once:
 * `Description` is set at CLOSE time, so an order provisioned with the deal on first save leaves it
 * NULL — measured, most orders on this host have a null description. Joining on the name therefore
 * finds nothing for an unclosed deal.
 *
 * So: use `OrderLinesForDeal` (below), which joins through `Deal.OrderID`, for anything about a deal's
 * own order. This helper stays for the CLOSED case, where the description is the thing that was set.
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
