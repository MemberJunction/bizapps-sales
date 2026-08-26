/**
 * @fileoverview A forecast source backed by handed-in rows. What the snapshot job is proved against.
 *
 * Not a mock: it hands over the same `ForecastMeasureRow[]` a real query source hands over, so a check
 * exercises the real writer, the real re-run guard and the real period arithmetic. What a landed query
 * will add is one thing — whether `QueryForecastSource.readRow` maps its columns correctly.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import type {
    ForecastMeasureRow,
    ForecastPeriod,
    ForecastSourceBatch,
    IForecastSource,
} from './ForecastSource.js';

export class FixtureForecastSource implements IForecastSource {
    /** FALSE, and stamped into every snapshot's `SnapshotJSON` — see the writer's provenance note. */
    public readonly IsLive = false;

    /** Every period asked for, so a check can assert the window the job derived. */
    public readonly Calls: ForecastPeriod[] = [];

    public constructor(
        private readonly rows: ForecastMeasureRow[],
        public readonly Name = 'fixture',
        private readonly issues: string[] = [],
    ) {}

    public async Measure(period: ForecastPeriod): Promise<ForecastSourceBatch> {
        this.Calls.push(period);
        return { Rows: [...this.rows], Issues: [...this.issues] };
    }
}
