/**
 * @fileoverview Raw Microsoft Graph message JSON -> `NormalizedItem`. The half a live mailbox risks.
 *
 * ── WHY THIS MAPS FROM RAW JSON AND NOT THROUGH MJ'S PROVIDER ───────────────────────────────────
 *
 * `MSGraphProvider.GetMessages` returns MJ's `Message` shape, and it sets `To` from `replyTo[0]` rather
 * than from any recipient collection — confirmed against real mail. On a GitHub notification, where
 * `replyTo` is the tracker's reply-back address and the actual recipient is a mailing list, that yields
 * a `To` nobody was ever sent to. Every downstream address decision would inherit it.
 *
 * So this reads Graph's own payload directly. That is not a workaround around a seam we own — it avoids
 * an upstream defect in code we do not own, and it costs nothing, because `NormalizedItem` is the shape
 * we need either way.
 *
 * ── SHAPES REAL MAIL PRODUCED, ALL FOUND IN A 25-MESSAGE EXPORT ─────────────────────────────────
 *
 * These are not hypotheticals; each one is in the sample and each one breaks a naive mapper.
 *
 *   1. **A sender with no address at all.** `from.emailAddress` was `{ name: 'Bean', address: 'pmtauser' }`.
 *      Not an address — no `@`, no domain. A mapper that assumes an address is an address writes
 *      `pmtauser` into the participant table, where it can never match anything and looks like data.
 *
 *   2. **The mailbox owner in `ccRecipients`, with a mailing list in `toRecipients`.** So "who was this
 *      sent to" is not `toRecipients[0]`, and the owner's own role on the message is `Cc`.
 *
 *   3. **`replyTo` empty on three of five, and the sender's reply-back address on the other two.** It is
 *      not a recipient, it is where a reply should go — which is exactly the confusion above.
 *
 *   4. **Messages the owner sent to himself**, where the same address is both `From` and `To`.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import type { ActivityDirection } from '@mj-biz-apps/sales-entities';
import type { ItemParticipant, NormalizedItem } from './ActivitySource.js';

/** The bits of a Graph message this mapper reads. Everything else rides along in `Raw`. */
export interface GraphEmailAddress {
    name?: string | null;
    address?: string | null;
}

export interface GraphRecipient {
    emailAddress?: GraphEmailAddress | null;
}

export interface GraphMessage {
    id?: string | null;
    conversationId?: string | null;
    subject?: string | null;
    bodyPreview?: string | null;
    body?: { content?: string | null } | null;
    sentDateTime?: string | null;
    receivedDateTime?: string | null;
    from?: GraphRecipient | null;
    sender?: GraphRecipient | null;
    toRecipients?: GraphRecipient[] | null;
    ccRecipients?: GraphRecipient[] | null;
    bccRecipients?: GraphRecipient[] | null;
    replyTo?: GraphRecipient[] | null;
    [key: string]: unknown;
}

export interface MapResult {
    Items: NormalizedItem[];
    /** Reported, never thrown — one unusable message must not cost the other twenty-four. */
    Issues: string[];
}

/**
 * Is this string usable as an email address?
 *
 * DELIBERATELY CRUDE, and crude is correct here. This is not validating conformance to RFC 5322 — it is
 * answering one question: can this value ever match a contact method? An address without an `@` cannot,
 * ever, by any resolver. `pmtauser` is the real example and it came from a real message.
 *
 * The alternative — letting it through — is worse than dropping it, because it arrives in the database
 * looking like a participant that simply has not been linked yet.
 */
function isUsableAddress(trimmed: string): boolean {
    if (!trimmed) return false;
    const at = trimmed.indexOf('@');
    return at > 0 && at < trimmed.length - 1 && !/\s/.test(trimmed);
}

/** Lower-cased, trimmed. Normalization belongs at the source — see `ItemParticipant.Address`. */
function normalize(value: string): string {
    return value.trim().toLowerCase();
}

function participantFrom(
    recipient: GraphRecipient | null | undefined,
    role: ItemParticipant['Role'],
    issues: string[],
    context: string,
): ItemParticipant | null {
    const ea = recipient?.emailAddress ?? null;
    const raw = (ea?.address ?? '').trim();
    const name = (ea?.name ?? '').trim() || null;

    if (!isUsableAddress(raw)) {
        if (raw) {
            /**
             * NAMED IN THE ISSUES RATHER THAN DROPPED SILENTLY. The value is real and a human may need to
             * explain where an expected message went; "we ignored `pmtauser`" is an answer, and an
             * unexplained absence is not.
             */
            issues.push(`${context}: ${role} address is not usable and was dropped: ${JSON.stringify(raw)}`);
        }
        return null;
    }
    return { Address: normalize(raw), Name: name, Role: role };
}

/**
 * Direction, decided from the mailbox rather than from a flag.
 *
 * Graph has no "direction" — it has folders, and this export carries no folder. So direction is derived:
 * the mailbox sent it (Outbound), someone else did (Inbound), or the mailbox is the only party involved
 * (Internal, which is what a note-to-self is and what five of the sample's messages are).
 *
 * `Internal` matters more than it looks: those are exactly the messages a person writes to themselves
 * about a deal, and calling them Inbound would put a rep's own notes on the wrong side of a conversation.
 */
function decideDirection(mailbox: string, participants: ItemParticipant[]): ActivityDirection {
    const box = normalize(mailbox);
    const from = participants.find((p) => p.Role === 'From');
    const others = participants.filter((p) => p.Role !== 'From' && p.Address !== box);
    const sentByMailbox = !!from && from.Address === box;

    if (sentByMailbox && others.length === 0) return 'Internal';
    return sentByMailbox ? 'Outbound' : 'Inbound';
}

/**
 * Map one Graph message.
 *
 * Returns null only when the message cannot be identified at all — no `id` means no dedupe key, and an
 * item that cannot be deduped will be written again on every run.
 */
export function MapGraphMessage(
    message: GraphMessage,
    mailbox: string,
    issues: string[],
): NormalizedItem | null {
    const id = (message.id ?? '').trim();
    const context = `message ${id ? id.slice(0, 24) : '(no id)'}`;
    if (!id) {
        issues.push('a message arrived with no id and was skipped — it has no dedupe key');
        return null;
    }

    const participants: ItemParticipant[] = [];
    const push = (p: ItemParticipant | null): void => {
        if (p) participants.push(p);
    };

    // `from` first, falling back to `sender` — Graph populates `sender` on delegated sends.
    push(participantFrom(message.from ?? message.sender, 'From', issues, context));
    for (const r of message.toRecipients ?? []) push(participantFrom(r, 'To', issues, context));
    for (const r of message.ccRecipients ?? []) push(participantFrom(r, 'Cc', issues, context));
    for (const r of message.bccRecipients ?? []) push(participantFrom(r, 'Bcc', issues, context));

    /**
     * `replyTo` IS NOT A PARTICIPANT AND IS NOT MAPPED. This is the upstream defect stated as code: it
     * is where a reply should be addressed, not somebody who received this message. It stays in `Raw`,
     * where anything that genuinely needs it can find it.
     */

    /**
     * `sentDateTime` before `receivedDateTime`. For a message the rep SENT there is no received time,
     * and for one they received the two differ by delivery latency — the sent instant is the one a human
     * means by "when was this".
     */
    const stamp = (message.sentDateTime ?? message.receivedDateTime ?? '').trim();
    const startedAt = stamp ? new Date(stamp) : null;
    if (!startedAt || Number.isNaN(startedAt.getTime())) {
        issues.push(`${context}: no usable sentDateTime/receivedDateTime, skipped`);
        return null;
    }

    return {
        ExternalID: id,
        ExternalThreadID: (message.conversationId ?? '').trim() || null,
        TypeCode: 'Email',
        Subject: (message.subject ?? '').trim() || '(no subject)',
        Body: (message.bodyPreview ?? message.body?.content ?? '').trim() || null,
        StartedAt: startedAt,
        EndedAt: null,
        Location: null,
        Direction: decideDirection(mailbox, participants),
        Participants: participants,
        /** A sent mail cannot be un-sent — see `NormalizedItem.Cancelled`. */
        Cancelled: false,
        Raw: message as Record<string, unknown>,
    };
}

/**
 * Map a Graph `/messages` payload — either the envelope (`{ value: [...] }`) or a bare array.
 *
 * Both are accepted because both occur: the API returns the envelope, and anything that has already
 * unwrapped it hands over the array.
 */
export function MapGraphMessages(payload: unknown, mailbox: string): MapResult {
    const issues: string[] = [];
    const raw = payload as { value?: unknown } | unknown[] | null;
    const list: unknown[] = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { value?: unknown })?.value)
            ? ((raw as { value: unknown[] }).value)
            : [];

    if (!list.length) {
        issues.push('payload contained no messages — expected an array or an object with a `value` array');
        return { Items: [], Issues: issues };
    }

    const items: NormalizedItem[] = [];
    for (const entry of list) {
        const mapped = MapGraphMessage(entry as GraphMessage, mailbox, issues);
        if (mapped) items.push(mapped);
    }
    return { Items: items, Issues: issues };
}
