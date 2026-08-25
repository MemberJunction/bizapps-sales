/**
 * @fileoverview The forecast seam — what the snapshot job is written against.
 *
 * ── WHY THIS IS A SEAM, FOR THE SAME REASON THE MAILBOX WAS ─────────────────────────────────────
 *
 * The measures come from MJ Queries that another session is building right now: nothing named `%Deal%`,
 * `%Forecast%` or `%Pipeline%` exists in `MJ: Queries` yet, on any branch. So the queries are the one
 * thing behind this interface, and the snapshot writer, the period arithmetic, the re-run guard, the
 * Action and the scheduled job are all in front of it and provable today.
 *
 * When their queries land, a deployment swaps the factory and nothing else moves. That is the same shape
 * `IActivitySource` uses for the mailbox and `LiveOrdersSeam`/`LiveContractsSeam` use for the downstream
 * apps, so it is the third instance of an established pattern rather than a new idea.
 *
 * ── AND WHY SALES DOES NOT COMPUTE THESE ────────────────────────────────────────────────────────
 *
 * Nothing in this module adds, multiplies, weights or rounds. A `ForecastMeasureRow` arrives with its
 * four amounts already decided by whatever produced it, and the writer stores them. That is rule 1 —
 * sales never computes money — applied to the reporting side: a forecast is a QUERY's answer, and a job
 * that re-derived it would be a second implementation to disagree with the first.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */

/** The window a snapshot measures. Both dates inclusive; `CK_ForecastSnapshot_PeriodOrder` enforces order. */
export interface ForecastPeriod {
    PeriodStart: Date;
    PeriodEnd: Date;
}

/**
 * One row of measures — one `ForecastSnapshot`.
 *
 * The grain is (company, pipeline, owner). `PipelineID` and `OwnerEmployeeID` are both nullable on the
 * table, and null means "across all of them" rather than "unknown" — so a source can emit a company-wide
 * row and a per-pipeline row for the same period and both are meaningful.
 */
export interface ForecastMeasureRow {
    /** NOT NULL on the table. A source that cannot name the selling company cannot produce a snapshot. */
    CompanyID: string;
    PipelineID: string | null;
    OwnerEmployeeID: string | null;
    /**
     * The four §9.5 measures, with the names that SHIPPED.
     *
     * `*Amount`-suffixed, diverging from the master plan's bare `Commit`/`BestCase`/`Pipeline`/`Closed`
     * — `COMMIT` is reserved in both T-SQL and Postgres, and production is Postgres. `docs/DECISIONS.md`
     * D6 records that the shipped names are authoritative, so this interface uses them rather than
     * translating and giving two vocabularies for one thing.
     *
     * Nullable, and null is meaningful: "this source does not measure that" is different from zero.
     */
    CommitAmount: number | null;
    BestCaseAmount: number | null;
    PipelineAmount: number | null;
    ClosedAmount: number | null;
}

export interface ForecastSourceBatch {
    Rows: ForecastMeasureRow[];
    /** Reported, never thrown — a partial batch is still worth storing. */
    Issues: string[];
}

/**
 * A source of forecast measures.
 *
 * `IsLive` carries the same meaning it does on `IActivitySource`: false for a fixture. The writer stamps
 * it into `SnapshotJSON`, so a stored snapshot always says whether its numbers came from a real query —
 * which matters more here than for activities, because a forecast row looks identical either way.
 */
export interface IForecastSource {
    /** Identifies the source in `SnapshotJSON` provenance. A query name, or a fixture label. */
    readonly Name: string;
    readonly IsLive: boolean;
    Measure(period: ForecastPeriod): Promise<ForecastSourceBatch>;
}
