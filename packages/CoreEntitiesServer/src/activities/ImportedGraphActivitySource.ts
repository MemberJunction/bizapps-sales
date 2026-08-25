/**
 * @fileoverview An activity source backed by an EXPORTED Graph payload. Real data, no remote contacted.
 *
 * ── WHY THIS IS NOT CALLED A "LIVE" SOURCE, AND WHY `IsLive` IS FALSE ──────────────────────────
 *
 * The data is real: a genuine mailbox produced it, with all the shapes a hand-written fixture would
 * never contain. But `IActivitySource.IsLive` does not mean "the data is real" — its contract is
 * *"True only when a real remote was contacted"*, and this class contacts nothing. It reads a file.
 *
 * That distinction is load-bearing rather than pedantic. The ingest refuses to write
 * `Source: 'Integration'` rows from a non-live source without being told to, which is what stops an
 * import being mistaken for a sync in the database afterwards. Setting `IsLive = true` here to make the
 * rows look better would defeat the one safeguard that keeps the two apart.
 *
 * So: an IMPORT source. It sits beside `FixtureActivitySource` as the second non-live implementation,
 * and it exists because the interesting failures live in the MAPPING (`GraphMessageMapper`), which a
 * fixture cannot exercise — a fixture starts at `NormalizedItem`, after the risky part has happened.
 *
 * When delegated `Mail.Read` consent lands, the live source is this class with the file read replaced
 * by a Graph call and `IsLive = true`. Nothing downstream changes.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { readFile } from 'node:fs/promises';
import type {
    ActivitySourceBatch,
    ActivitySourceQuery,
    IActivitySource,
} from './ActivitySource.js';
import { MapGraphMessages } from './GraphMessageMapper.js';

export class ImportedGraphActivitySource implements IActivitySource {
    public readonly Kind = 'Message' as const;
    public readonly ProviderName = 'Microsoft365' as const;
    /** FALSE — see the block above. Real data, but nothing remote was contacted. */
    public readonly IsLive = false;

    /** Every `Fetch` made, so a check can assert the watermark was passed down. */
    public readonly Calls: ActivitySourceQuery[] = [];

    /**
     * @param payloadPath  A Graph `/messages` response saved to disk — the envelope or a bare array.
     */
    public constructor(private readonly payloadPath: string) {}

    public async Fetch(query: ActivitySourceQuery): Promise<ActivitySourceBatch> {
        this.Calls.push(query);

        let parsed: unknown;
        try {
            parsed = JSON.parse(await readFile(this.payloadPath, 'utf8'));
        } catch (error) {
            /**
             * REPORTED, NOT THROWN, matching the interface's contract that a partial batch is still worth
             * filing. A missing export file is an operational fact, not a reason to fail a sync run that
             * may have other sources.
             */
            return {
                Items: [],
                HighWatermark: null,
                Issues: [`could not read ${this.payloadPath}: ${error instanceof Error ? error.message : String(error)}`],
            };
        }

        const { Items, Issues } = MapGraphMessages(parsed, query.Mailbox);

        /**
         * THE WATERMARK IS APPLIED HERE, which a Graph-backed source cannot do.
         *
         * `GetMessagesParams` has no date filter, so a live source fetches the newest N and the caller
         * discards what it has seen. A file has the same limitation in reverse — it holds whatever was
         * exported — so this filters on the way out, exactly as `FixtureActivitySource` does. That keeps
         * the import source the stricter of the two and means a second run genuinely returns nothing.
         *
         * STRICTLY GREATER THAN: the watermark is set FROM the newest item, so `>=` would re-deliver it
         * on every run forever, with dedupe quietly absorbing it.
         */
        const since = query.Since ? query.Since.getTime() : null;
        const eligible = Items
            .filter((item) => since === null || item.StartedAt.getTime() > since)
            .sort((a, b) => a.StartedAt.getTime() - b.StartedAt.getTime())
            .slice(0, Math.max(0, query.Limit));

        return {
            Items: eligible,
            /** Messages: `max(StartedAt)`, always in the past. Never the clock — see the interface. */
            HighWatermark: eligible.length
                ? new Date(Math.max(...eligible.map((i) => i.StartedAt.getTime())))
                : null,
            Issues,
        };
    }
}
