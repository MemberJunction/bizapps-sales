/**
 * @fileoverview A source backed by handed-in items. The substitute the whole pipeline is proved against.
 *
 * NOT A MOCK, and the difference is the reason this exists. A mock would let a check assert that the
 * ingest called something; this hands over the same `NormalizedItem[]` the live provider hands over, so a
 * check exercises the real filter, the real resolver, the real writer and the real dedupe. What is
 * missing from the proof is exactly one thing — whether Graph's payload maps onto `NormalizedItem`
 * correctly — and that is the only claim a live mailbox is needed to settle.
 *
 * It also applies the watermark, which a Graph-backed source CANNOT (there is no date filter on
 * `GetMessages`). So the fixture is deliberately the STRICTER of the two: anything that passes here on
 * watermark behaviour will still need the caller-side discard when the live source is swapped in.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import type {
    ActivitySourceBatch,
    ActivitySourceQuery,
    IActivitySource,
    NormalizedItem,
} from './ActivitySource.js';

export class FixtureActivitySource implements IActivitySource {
    public readonly Kind: 'Message' | 'Calendar';
    public readonly ProviderName = 'Microsoft365' as const;
    /** FALSE, and load-bearing — see `IActivitySource.IsLive`. Nothing here contacted a remote. */
    public readonly IsLive = false;

    /** Every `Fetch` call made, so a check can assert the watermark was passed down. */
    public readonly Calls: ActivitySourceQuery[] = [];

    public constructor(
        private readonly items: NormalizedItem[],
        kind: 'Message' | 'Calendar' = 'Message',
        /** Issues to report alongside the batch, for exercising the failure-surfacing path. */
        private readonly issues: string[] = [],
    ) {
        this.Kind = kind;
    }

    public async Fetch(query: ActivitySourceQuery): Promise<ActivitySourceBatch> {
        this.Calls.push(query);

        const since = query.Since ? query.Since.getTime() : null;
        const eligible = this.items
            /**
             * STRICTLY GREATER THAN the watermark. `>=` would re-deliver the newest item on every run:
             * the watermark is set FROM that item, so the two are equal by construction. Dedupe would
             * catch it, but a pipeline that re-reads and re-discards the same item forever is a bug that
             * looks like idempotency working.
             */
            .filter((item) => since === null || item.StartedAt.getTime() > since)
            .sort((a, b) => a.StartedAt.getTime() - b.StartedAt.getTime())
            .slice(0, Math.max(0, query.Limit));

        return {
            Items: eligible,
            HighWatermark: eligible.length
                ? new Date(Math.max(...eligible.map((i) => i.StartedAt.getTime())))
                : null,
            Issues: [...this.issues],
        };
    }
}
