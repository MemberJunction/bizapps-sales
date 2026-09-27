/**
 * @fileoverview The columns `LoadRoster` reads from `Sales: Deal Roster`, and the check that they came back.
 *
 * WHY A MISSING COLUMN IS AN ERROR AND NOT A DEFAULT (bizapps-sales#137). The roster's mapper coerces
 * every flag with `bool()`, and `bool(undefined)` is `false`. So a database still holding an older
 * definition of the query — one written before a column existed — produced rows that mapped cleanly and
 * were wrong: `PipelineIncludeInForecast` absent read as "every pipeline is out of the forecast",
 * `InForecast` dropped every open deal, and Weighted open read $0 beside a correct Open pipeline tile.
 * Nothing reported an error. An app/data version mismatch has to surface as one.
 *
 * The check reads the first returned row rather than the query's registered field metadata, because the
 * row is what the mapper actually consumes. An empty roster is not checked: there is nothing to
 * mis-compute.
 *
 * @module @mj-biz-apps/sales-ng
 */

/**
 * Every `Sales: Deal Roster` column `LoadRoster` maps. The mapper reads rows typed as {@link DealRosterResultRow},
 * so reading a column that is not listed here does not compile.
 */
export const DEAL_ROSTER_COLUMNS = [
    'DealID',
    'DealNumber',
    'DealName',
    'AccountID',
    'AccountName',
    'Amount',
    'AmountIsComputed',
    'Probability',
    'ExpectedCloseDate',
    'ActualCloseDate',
    'PipelineName',
    'StageName',
    'DealTypeName',
    'StatusName',
    'OwnerName',
    'ForecastCategoryName',
    'DealStatusTypeID',
    'PipelineID',
    'PipelineStageID',
    'PipelineIncludeInForecast',
    'CurrencyID',
    'IsOpen',
    'IsWon',
    'IsLost',
    'IsClosed',
    'IsPastExpectedClose',
    'IncludeInCommit',
    'IncludeInBestCase',
    'WeightedAmount',
    'StageOrder',
] as const;

export type DealRosterColumn = (typeof DEAL_ROSTER_COLUMNS)[number];

/** A roster row whose expected columns have been checked present. Values are still unvalidated. */
export type DealRosterResultRow = Record<DealRosterColumn, unknown>;

/** The expected columns absent from a returned row. A column present with a NULL value is not missing. */
export function MissingRosterColumns(row: Record<string, unknown>): DealRosterColumn[] {
    return DEAL_ROSTER_COLUMNS.filter((column) => !Object.prototype.hasOwnProperty.call(row, column));
}

/**
 * Throws when the roster came back without a column the mapper depends on.
 *
 * @throws Error naming the missing columns and the likely cause.
 */
export function AssertRosterColumns(rows: Record<string, unknown>[]): asserts rows is DealRosterResultRow[] {
    if (!rows.length) {
        return;
    }
    const missing = MissingRosterColumns(rows[0]);
    if (missing.length) {
        throw new Error(
            `Sales: Deal Roster returned no ${missing.join(', ')} column. The query definition in this ` +
                'database is older than the installed Sales app; apply the app\'s latest migrations.',
        );
    }
}
