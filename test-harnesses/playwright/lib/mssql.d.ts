/**
 * @fileoverview Minimal ambient types for `mssql`, which ships none and has no `@types/mssql` here.
 *
 * ── WHY NOT `declare module 'mssql';` ───────────────────────────────────────────────────────────
 *
 * The shorthand form types the whole module as `any`, which would switch off checking for every call
 * `lib/db.ts` makes — and this repo's rule two is that `any` is never the answer. It would also make
 * this gate weakest exactly where it touches the database, which is where a wrong call is most
 * expensive to debug.
 *
 * ── WHY NOT ADD `@types/mssql` ─────────────────────────────────────────────────────────────────
 *
 * It is not in the dependency tree, and pulling it in means a root install for a harness that is
 * deliberately not an npm workspace. The surface actually used is small and lives in ONE file, so
 * declaring it honestly costs less than a dependency and documents what the harness relies on.
 *
 * ── WHY `export =` A NAMESPACE AND NOT A DEFAULT CONST ─────────────────────────────────────────
 *
 * `lib/db.ts` uses `sql` in BOTH positions: `new sql.ConnectionPool(...)` is a value, and
 * `sql.ConnectionPool | null` is a type. A default-exported object satisfies only the first, and the
 * second fails with "Cannot find namespace 'sql'". A namespace satisfies both, which is what the real
 * package does.
 *
 * SCOPE: exactly what `lib/db.ts` calls, and nothing speculative. If a spec needs more of `mssql`, add
 * it here with real types rather than widening anything to `any`.
 */
declare module 'mssql' {
    namespace mssql {
        interface IResult<T> {
            recordset: T[];
            rowsAffected: number[];
        }

        interface IRequest {
            query<T = Record<string, unknown>>(command: string): Promise<IResult<T>>;
        }

        interface IPoolOptions {
            trustServerCertificate?: boolean;
            encrypt?: boolean;
        }

        interface IConnectionConfig {
            server: string;
            port?: number;
            database?: string;
            user?: string;
            password?: string;
            options?: IPoolOptions;
            requestTimeout?: number;
        }

        class ConnectionPool {
            constructor(config: IConnectionConfig);
            connect(): Promise<ConnectionPool>;
            request(): IRequest;
            close(): Promise<void>;
        }
    }

    export = mssql;
}
