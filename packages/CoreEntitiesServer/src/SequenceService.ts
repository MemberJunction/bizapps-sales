/**
 * @fileoverview `SequenceService` — calls the DB-level atomic numbering sproc from TypeScript, so
 * `DealEntityServer` can assign `DealNumber` before `super.Save()` commits the row.
 *
 * WHY THE COUNTER IS IN SQL AND THIS IS THE ONLY SQL-SHAPED THING HERE. `spAssignNextDealNumber` needs
 * `HOLDLOCK, UPDLOCK` read-modify-write semantics that have no application-level equivalent — two deals
 * created in the same instant must not take the same number, and no amount of careful TypeScript can
 * promise that. Everything else about numbering (when to assign, what to do when it fails) is here.
 *
 * PROVIDER: INJECTED AND REQUIRED, with no global fallback. The caller is the entity server, which
 * passes its own `ProviderToUse`, so the sproc call rides the SAME connection context — and therefore
 * the same transaction — as the save it is numbering. A global provider would take the number on a
 * different connection, and a rolled-back save would then leave the number consumed. Copied deliberately
 * from accounting's `SequenceService`, including that constraint.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { IMetadataProvider, UserInfo } from '@memberjunction/core';
import { SQLServerDataProvider } from '@memberjunction/sqlserver-dataprovider';

const SALES_SCHEMA = '__mj_BizAppsSales';

/**
 * Atomically increments the singleton deal counter and returns the formatted `DEAL-{seq:000000}`.
 *
 * Singleton rather than per-company, matching contracts' `ContractSequence` and orders'
 * `OrderSequence` — see the migration comment on `DealSequence` for why accounting's per-company,
 * per-fiscal-year scope is the exception and not the pattern.
 *
 * @throws when the sproc returns nothing, rather than letting a null number reach the row. A deal with
 *         no number is recoverable; a deal that silently stored `null` where a number was expected is
 *         the kind of thing found weeks later by a report that skips it.
 */
export async function getNextDealNumber(contextUser: UserInfo, provider: IMetadataProvider): Promise<string> {
    const sqlProvider = getSqlServerProvider(provider);
    const sql = `
        DECLARE @dealNumber NVARCHAR(50);
        EXEC ${SALES_SCHEMA}.spAssignNextDealNumber
            @DealNumber = @dealNumber OUTPUT;
        SELECT @dealNumber AS DealNumber;
    `;
    // ExecuteSQL binds an OBJECT of parameters BY NAME. An array is treated as positional (p0), which
    // would not match a named @-param — accounting's service records learning this the hard way, and the
    // note is kept here because the sproc taking no inputs makes it easy to reintroduce later.
    const rows = await sqlProvider.ExecuteSQL(
        sql,
        {},
        { isMutation: true, description: 'spAssignNextDealNumber' },
        contextUser,
    );
    const value = rows?.[0]?.DealNumber;
    if (!value || typeof value !== 'string') {
        throw new Error('SequenceService.getNextDealNumber: spAssignNextDealNumber returned no value');
    }
    return value;
}

function getSqlServerProvider(provider: IMetadataProvider): SQLServerDataProvider {
    if (!provider) {
        throw new Error('SequenceService: an IMetadataProvider must be injected — there is no global fallback');
    }
    return provider as SQLServerDataProvider;
}
