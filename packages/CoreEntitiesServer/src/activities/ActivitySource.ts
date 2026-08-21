/**
 * @fileoverview The source seam — what everything downstream of the mailbox is written against.
 *
 * ── WHY A SEAM, AND WHY IT IS THE WHOLE POINT OF THIS DESIGN ────────────────────────────────────
 *
 * The real mailbox is unreachable: `MSGraphProvider` authenticates with `ClientSecretCredential`, which
 * is app-only auth, so `Mail.Read` is TENANT-WIDE until an Exchange Application Access Policy scopes the
 * app registration to a security group. That is a tenant-admin action and it has not happened. Pointing
 * anything at a live mailbox today would read every mailbox in the tenant.
 *
 * So the mailbox is the one thing behind this interface, and everything else — the relevance filter, the
 * participant resolver, the writer, dedupe, the watermark, the scheduled job — is on this side of it and
 * fully buildable and fully testable now. The real provider becomes a constructor swap the day the
 * credential is scoped, with no change to any consumer.
 *
 * This is the same shape `CloseDealOperation` already uses for its downstream apps (`LiveOrdersSeam`,
 * `LiveContractsSeam`, and a stub beside them), so it is the repository's existing pattern rather than a
 * new one to learn.
 *
 * ── ONE ITEM TYPE, TWO KINDS OF SOURCE ─────────────────────────────────────────────────────────
 *
 * `NormalizedItem` carries `TypeCode`, `EndedAt` and `Location`, so a CALENDAR source satisfies the same
 * interface a message source does and slots in beside it without redesign. That is deliberate: MJ's
 * `BaseCommunicationProvider` has no event surface at all — its abstract methods are `SendSingleMessage`,
 * `GetMessages`, `ForwardMessage`, `ReplyToMessage`, `CreateDraft` — so meetings will need either an
 * extension to MJ's provider base or a direct Graph `/events` call from here. Which of those is right is
 * recorded as a decision rather than chosen here (D-16); the interface is shaped so that neither answer
 * costs a rewrite.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import type { ActivityDirection, ActivityTypeCode } from '@mj-biz-apps/sales-entities';

/** One party on an item, as the SOURCE reports them — an address, not yet a person. */
export interface ItemParticipant {
    /** Lower-cased by the source. Matching is case-insensitive and the normalization belongs here. */
    Address: string;
    Name: string | null;
    /** The `ActivityLink.Role` this participant earns. */
    Role: 'From' | 'To' | 'Cc' | 'Bcc' | 'Organizer' | 'Attendee';
}

/**
 * A provider-neutral item, ready for the filter.
 *
 * Nothing downstream knows what produced it, which is what makes the fixture source a genuine substitute
 * rather than a mock: the fixture and the live provider hand over the same type, so a check exercises the
 * real code path and not a parallel one.
 */
export interface NormalizedItem {
    /**
     * The provider's own stable id — for Graph, the message id. Half of the dedupe key.
     *
     * NOT the RFC-822 `Message-ID` header, which has no column and lives in `Details`. The distinction
     * matters: the RFC header is stable across mailboxes and the Graph id is not, so keying on the Graph
     * id means a message ingested from two mailboxes yields two rows. Recorded as D-15.
     */
    ExternalID: string;
    /** Graph's conversation id. Groups replies; `Activity.ExternalThreadID`. */
    ExternalThreadID: string | null;
    TypeCode: ActivityTypeCode;
    Subject: string;
    /** Body or preview. Becomes `Activity.Description`. */
    Body: string | null;
    StartedAt: Date;
    /** Set for calendar items; null for messages. */
    EndedAt: Date | null;
    /** Set for calendar items. */
    Location: string | null;
    Direction: ActivityDirection;
    Participants: ItemParticipant[];
    /**
     * The item was called off and did not happen.
     *
     * A FIRST-CLASS FIELD rather than something to dig out of `Raw`, because the ingest branches on
     * it: `CK_Activity_Status` already allows `'Cancelled'`, so a cancelled meeting is recorded as
     * cancelled rather than as completed. Left in `Raw` it would have been a fact nothing could act
     * on without knowing which provider shape to look inside.
     *
     * Always false for messages: a sent mail cannot be un-sent.
     */
    Cancelled: boolean;

    /** The provider payload, verbatim. Stringified into `Activity.Details`. */
    Raw: Record<string, unknown>;
}

export interface ActivitySourceQuery {
    /** The mailbox to read, from `ActivitySyncConnection.Mailbox`. */
    Mailbox: string;
    /**
     * The watermark — `ActivitySyncConnection.LastSyncAt`. Null on a first run.
     *
     * ⚠ ADVISORY TO THE SOURCE, NOT A GUARANTEE. `GetMessagesParams` exposes only `Identifier`,
     * `NumMessages`, `UnreadOnly` and `IncludeHeaders` — **there is no date filter**. So a Graph-backed
     * source cannot ask for "messages since X"; it fetches the most recent `Limit` and the caller
     * discards what it has already seen. See D-17 for what that bounds.
     */
    Since: Date | null;
    /** Hard cap on items returned. Maps to `GetMessagesParams.NumMessages`. */
    Limit: number;
}

export interface ActivitySourceBatch {
    Items: NormalizedItem[];
    /**
     * WHAT THE WATERMARK MEANS, which differs by surface and is why this is the source's answer
     * rather than the caller's arithmetic.
     *
     * A message source may return `max(StartedAt)`: a mail item's `StartedAt` is when it was sent, so
     * it is always in the past and the newest one is a safe floor.
     *
     * A CALENDAR SOURCE MUST NOT. A meeting's `StartedAt` is when it BEGINS, which is routinely in the
     * future — so `max(StartedAt)` over a batch containing a December meeting sets the watermark to
     * December, and every meeting created afterwards for any earlier date is filtered out as
     * already-seen. Permanently, and with no error: the calendar simply stops ingesting.
     *
     * So a calendar source reports its own INGEST time (or a provider `ModifiedAt` where one exists) —
     * a value about when the source looked, not about when the event happens.
     */
    /**
     * The newest `StartedAt` in the batch, or null when it is empty.
     *
     * Advanced from the ITEMS rather than from the clock, deliberately. A wall-clock watermark skips
     * anything that arrives while the run is in flight; an item-derived one cannot, because it never
     * claims to have seen past the newest thing it actually saw.
     */
    HighWatermark: Date | null;
    /** Reported, never thrown — a partial batch is still worth filing. */
    Issues: string[];
}

/**
 * A source of activity items.
 *
 * `IsLive` is not decoration: the ingest refuses to write `Source: 'Integration'` rows from a fixture
 * source without being told to, so a fixture run cannot be mistaken for a real one in the database.
 */
export interface IActivitySource {
    /** Which surface this reads. A calendar source declares `'Calendar'` and needs no other change. */
    readonly Kind: 'Message' | 'Calendar';
    /** Must match an `ActivitySyncConnection.Provider` value — `CK_ActivitySyncConnection_Provider`. */
    readonly ProviderName: 'Microsoft365' | 'Gmail' | 'Zoom' | 'Generic';
    /** False for fixtures. True only when a real remote was contacted. */
    readonly IsLive: boolean;
    Fetch(query: ActivitySourceQuery): Promise<ActivitySourceBatch>;
}
