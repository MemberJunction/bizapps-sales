/**
 * @fileoverview The real source. Written, typechecked, and deliberately never run.
 *
 * ── READ THIS BEFORE POINTING IT AT ANYTHING ────────────────────────────────────────────────────
 *
 * `MSGraphProvider` authenticates with `ClientSecretCredential` — **app-only auth**. An app-only
 * `Mail.Read` grant is TENANT-WIDE: it does not read one mailbox, it reads every mailbox in the tenant.
 * Scoping it requires an Exchange **Application Access Policy** binding the app registration to a
 * security group, which is a tenant-admin action that has not been performed.
 *
 * So this class is complete and unexercised. `Fetch` refuses unless `AllowLiveFetch` was explicitly
 * passed, and the refusal names the policy rather than the missing credential — because a missing
 * credential invites someone to supply one, and supplying one here is precisely the mistake.
 *
 * ── WHAT IS UNPROVEN, EXACTLY ───────────────────────────────────────────────────────────────────
 *
 * One thing: whether `GetMessageMessage` maps onto `NormalizedItem` the way `mapMessage` below assumes.
 * Everything downstream is proved against fixtures. The mapping is the entire remaining risk, and it is
 * concentrated in one function on purpose so that a single live run settles it.
 *
 * ── THE TWO CONTRACT GAPS FOUND WHILE WRITING IT ────────────────────────────────────────────────
 *
 *   1. **No date filter.** `GetMessagesParams` is `{ Identifier, NumMessages, UnreadOnly,
 *      IncludeHeaders, ContextData }`. There is no "since". Incremental sync is therefore
 *      fetch-N-and-discard, not a bounded query — see D-17.
 *   2. **No Bcc, and no direction.** `GetMessageMessage` carries `From`, `To`, `ToRecipients`,
 *      `CCRecipients`, `ReplyTo` — no Bcc field — and nothing states inbound vs outbound. Direction is
 *      therefore INFERRED from whether the mailbox owner is the sender, which is correct for ordinary
 *      mail and wrong for a message sent by a delegate. See D-18.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { LogError } from '@memberjunction/core';

import { SOURCE_SYSTEM_M365 } from './activity-vocabulary.js';
import type {
    ActivitySourceBatch,
    ActivitySourceQuery,
    IActivitySource,
    ItemParticipant,
    NormalizedItem,
} from './ActivitySource.js';

/**
 * The subset of `GetMessageMessage` this maps from.
 *
 * DESCRIBED STRUCTURALLY rather than imported, so sales does not take a dependency on
 * `@memberjunction/communication-types` for a shape it only reads. If MJ changes the type this stops
 * compiling at the adapter — which is where a break should surface — rather than deep inside the ingest.
 */
export interface GraphMessageLike {
    From: string;
    To: string;
    ToRecipients?: string[];
    CCRecipients?: string[];
    ReplyTo?: string[];
    Body: string;
    Subject?: string;
    /** Graph's message id. The dedupe key. */
    ExternalSystemRecordID?: string;
    /** Graph's conversation id. */
    ThreadID?: string;
    SentAt?: Date;
    ReceivedAt?: Date;
    CreatedAt?: Date;
}

/** What this class needs from a provider, and nothing more. */
export interface GraphMessageFetcher {
    GetMessages(params: {
        Identifier?: string;
        NumMessages: number;
        UnreadOnly?: boolean;
        IncludeHeaders?: boolean;
    }): Promise<{ Success?: boolean; ErrorMessage?: string; Messages?: GraphMessageLike[] }>;
}

export class MSGraphActivitySource implements IActivitySource {
    public readonly Kind = 'Message' as const;
    public readonly ProviderName = SOURCE_SYSTEM_M365;
    public readonly IsLive = true;

    public constructor(
        private readonly fetcher: GraphMessageFetcher,
        /**
         * The tenant-admin gate, in code.
         *
         * Default FALSE so that wiring this class up by accident cannot read a tenant. Turning it on is a
         * deliberate act by someone who has confirmed the Application Access Policy exists.
         */
        private readonly AllowLiveFetch: boolean = false,
    ) {}

    public async Fetch(query: ActivitySourceQuery): Promise<ActivitySourceBatch> {
        if (!this.AllowLiveFetch) {
            return {
                Items: [],
                HighWatermark: null,
                Issues: [
                    'Live Graph fetch is disabled. MSGraphProvider uses app-only auth, so Mail.Read reads '
                        + 'EVERY mailbox in the tenant until an Exchange Application Access Policy scopes the '
                        + 'app registration to a security group. Confirm that policy exists before enabling '
                        + 'this, and use FixtureActivitySource until then.',
                ],
            };
        }

        try {
            const response = await this.fetcher.GetMessages({
                Identifier: query.Mailbox,
                NumMessages: query.Limit,
                UnreadOnly: false,
                // Asked for so the RFC-822 Message-ID reaches `Raw` and can be promoted later (D-15).
                IncludeHeaders: true,
            });

            if (response?.Success === false) {
                return {
                    Items: [],
                    HighWatermark: null,
                    Issues: [`Graph refused the read: ${response.ErrorMessage ?? 'no reason given'}`],
                };
            }

            const issues: string[] = [];
            const mailbox = query.Mailbox.trim().toLowerCase();
            const items: NormalizedItem[] = [];

            for (const message of response?.Messages ?? []) {
                const mapped = this.mapMessage(message, mailbox);
                if (mapped) {
                    items.push(mapped);
                } else {
                    /**
                     * COUNTED, NOT DROPPED SILENTLY. A message with no id cannot be deduped, so filing it
                     * would create a duplicate on every subsequent run — but a mailbox quietly yielding
                     * fewer items than it holds is exactly the failure nobody notices.
                     */
                    issues.push('A message carried no ExternalSystemRecordID and was skipped — it cannot be deduped.');
                }
            }

            /**
             * THE CALLER-SIDE DISCARD the contract forces on us. `GetMessages` has no date filter, so the
             * watermark is applied here, after the fetch, rather than in the query.
             */
            const since = query.Since ? query.Since.getTime() : null;
            const fresh = since === null ? items : items.filter((i) => i.StartedAt.getTime() > since);
            if (since !== null && fresh.length === items.length && items.length === query.Limit) {
                issues.push(
                    `Every one of the ${items.length} messages fetched was newer than the watermark and the `
                        + 'batch was full, so older unseen messages may exist beyond it. Raise the limit or '
                        + 'run more often.',
                );
            }

            return {
                Items: fresh,
                HighWatermark: fresh.length
                    ? new Date(Math.max(...fresh.map((i) => i.StartedAt.getTime())))
                    : null,
                Issues: issues,
            };
        } catch (err) {
            LogError(`MSGraphActivitySource.Fetch failed for ${query.Mailbox}: ${err}`);
            return { Items: [], HighWatermark: null, Issues: [`Graph read failed: ${String(err)}`] };
        }
    }

    /**
     * THE ONE UNPROVEN FUNCTION IN THIS FEATURE. Everything else is exercised against fixtures.
     *
     * Isolated deliberately: when a scoped mailbox exists, one live run against a handful of real
     * messages either confirms this mapping or does not, and nothing else is in question.
     */
    private mapMessage(message: GraphMessageLike, mailbox: string): NormalizedItem | null {
        const externalID = message.ExternalSystemRecordID?.trim();
        if (!externalID) {
            return null;
        }

        const from = normalizeAddress(message.From);
        const participants: ItemParticipant[] = [];
        if (from) {
            participants.push({ Address: from, Name: null, Role: 'From' });
        }
        for (const address of recipients(message.ToRecipients, message.To)) {
            participants.push({ Address: address, Name: null, Role: 'To' });
        }
        for (const address of recipients(message.CCRecipients)) {
            participants.push({ Address: address, Name: null, Role: 'Cc' });
        }
        // No Bcc: `GetMessageMessage` has no such field. See D-18.

        /**
         * SentAt, then ReceivedAt, then CreatedAt — all three are optional in the contract, and a
         * message with none of them has no place on a timeline, so it is dated `StartedAt` from the only
         * remaining honest answer: nothing. Rather than invent `new Date()`, which would file it as
         * having happened during the sync run, the item is refused.
         */
        const when = message.SentAt ?? message.ReceivedAt ?? message.CreatedAt;
        if (!when) {
            return null;
        }

        return {
            ExternalID: externalID,
            ExternalThreadID: message.ThreadID?.trim() || null,
            TypeCode: 'Email',
            Subject: message.Subject?.trim() || '(no subject)',
            Body: message.Body ?? null,
            StartedAt: new Date(when),
            EndedAt: null,
            Location: null,
            /** Inferred, and imperfect — see D-18. */
            Direction: from && from === mailbox ? 'Outbound' : 'Inbound',
            Participants: participants,
            /** A sent message cannot be un-sent. Only the calendar has a cancellation. */
            Cancelled: false,
            Raw: { ...message },
        };
    }
}

/** Lower-cased, trimmed, empty becomes null. Normalizing here keeps matching case-insensitive. */
function normalizeAddress(value: string | null | undefined): string | null {
    const trimmed = value?.trim().toLowerCase();
    return trimmed ? trimmed : null;
}

/** The first non-empty list, normalized and de-duplicated. */
function recipients(...candidates: (string[] | string | undefined)[]): string[] {
    for (const candidate of candidates) {
        const list = Array.isArray(candidate) ? candidate : candidate ? [candidate] : [];
        const cleaned = [...new Set(list.map(normalizeAddress).filter((a): a is string => !!a))];
        if (cleaned.length) {
            return cleaned;
        }
    }
    return [];
}
