# Communication: `GetMessageMessage` carries no direction and no Bcc, so delegate-sent mail is logged backwards

Not filed yet.

**Component:** `@memberjunction/communication-base-types` — `GetMessageMessage`
**Affects:** any consumer that records whether a message was sent or received
**Checked on:** MJ `next` (`8b8d645`), 2026-10-11
**Severity:** medium — a wrong value rather than a missing one, which is the harder kind to notice

---

## What is missing

`GetMessageMessage` (`packages/Communication/base-types/src/BaseProvider.ts:261-296`) has `From`, `To`,
`ToRecipients`, `CCRecipients`, `ReplyTo`, subject, body, external and thread IDs, and four timestamps. It has no
direction and no Bcc, although sending supports Bcc (`Message.BCCRecipients`, `:61`). The Graph
provider maps `from` only, and drops `sender` and `bccRecipients`
(`packages/Communication/providers/MSGraph/src/MSGraphProvider.ts:570-573`).

## Why direction cannot be inferred

The only inference available is comparing `From` with the mailbox being read. That is right for
ordinary mail and wrong for delegated send:

| Scenario | `From` | Mailbox read | Inferred | Truth |
|---|---|---|---|---|
| User sends | the user | the user | Outbound | Outbound ✓ |
| User receives | a customer | the user | Inbound | Inbound ✓ |
| **Assistant sends on an executive's behalf** | **the executive** | **the assistant** | **Inbound** | **Outbound ✗** |

`From` is the executive in the delegated case, so no comparison against the mailbox recovers the
answer. The transport knows: Graph's `sender` differs from `from`, and the message sits in Sent Items.
The signal is lost at MJ's message type, not at the provider.

bizapps-common's activity sync shows the cost. It reads Graph's raw payload from
`GetMessagesResult.SourceData` instead of `Messages`, and still infers direction by comparing `from`
with the mailbox (`packages/ActivitySync/src/providers/GraphMessageMapper.ts:68-75`), so a delegate's
sent mail is filed as inbound.

## Bcc

A Bcc is not delivered to recipients, so it exists only in the sender's own Sent Items, where it is
dropped. Either return it there, or document that `ToRecipients` + `CCRecipients` is not the complete
recipient set; a consumer doing compliance or audit work will otherwise assume it is.

## Suggested fix

```ts
export type GetMessageMessage = {
    …
    /** Set by the provider from transport metadata (folder, sender vs from, sent state).
     *  Callers must not infer this from From/Identifier — delegated send breaks that inference. */
    Direction?: 'Inbound' | 'Outbound';

    /** Present only when reading the sender's own mailbox; a Bcc is not delivered to recipients. */
    BCCRecipients?: string[];
};
```

Optional keeps it backward compatible. A provider that cannot determine direction leaves it
undefined, and the caller falls back to the inference knowing it is a guess. `Direction` is the
load-bearing half; the Bcc field could be declined, as long as the decision is written down where a
consumer will find it.
