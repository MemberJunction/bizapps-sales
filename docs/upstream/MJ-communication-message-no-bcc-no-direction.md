# Communication: `GetMessageMessage` carries no direction and no Bcc, so delegate-sent mail is logged backwards

**Component:** `@memberjunction/communication-base-types` — `GetMessageMessage`
**Affects:** any consumer that records whether a message was sent or received
**Observed on:** MJ `6.1.0-edge.2`
**Severity:** medium — a wrong value rather than a missing one, which is the harder kind to notice

---

## Consequence first

**A message sent by an assistant on an executive's behalf is recorded as inbound.** It appears on the
timeline as something the customer sent us, when it is something we sent the customer. The record is
not incomplete; it is wrong in a way that reads as fact.

That matters most in exactly the accounts that have delegates — the largest ones — and it is
unfalsifiable from the stored data, because nothing carries the direction the transport actually knew.

## What is missing

```ts
// Communication/base-types/src/BaseProvider.ts
export type GetMessageMessage<T = Record<string, any>> = {
    From: string;
    To: string;
    ToRecipients?: string[];
    CCRecipients?: string[];
    Body: string;
    ReplyTo?: string[];
    Subject?: string;
    ExternalSystemRecordID?: string;
    ThreadID?: string;
    CreatedAt?: Date;
    LastModifiedAt?: Date;
    ReceivedAt?: Date;
    SentAt?: Date;
    SourceData?: T;
};
```

Two absences:

- **No direction.** Nothing states inbound versus outbound. `SentAt` and `ReceivedAt` are both
  optional and both are populated for ordinary mail, so they do not distinguish it either.
- **No Bcc.** There is `ToRecipients` and `CCRecipients` and no blind-copy field at all.

## Why direction cannot be reliably inferred

The only available inference is comparing `From` against the mailbox being read. That is correct for
ordinary mail and wrong for delegated send:

| Scenario | `From` | Mailbox read | Inferred | Truth |
|---|---|---|---|---|
| User sends | the user | the user | Outbound | Outbound ✓ |
| User receives | a customer | the user | Inbound | Inbound ✓ |
| **Assistant sends on exec's behalf** | **the exec** | **the assistant** | **Inbound** | **Outbound ✗** |

The transport knows. Graph exposes the parent folder, `sender` distinct from `from`, and
`sentDateTime` on items in Sent Items — all of which say outbound unambiguously. The signal is being
lost at MJ's message type, not at the provider.

Note that `From` is the *exec* in the delegated case, not the assistant — so no comparison against the
mailbox address recovers the right answer. This is not a matter of a smarter inference.

## The Bcc absence is probably fine, and should be recorded as accepted

A Bcc is deliberately invisible to recipients, so a provider reading a *recipient's* mailbox genuinely
cannot know about it — the information is not withheld by the type, it was never delivered. Reading
the *sender's* Sent Items is the one case where it exists and is dropped.

We are not asking for this to be fixed. We are asking for it to be an **accepted absence rather than
an unnoticed one**, because the two are indistinguishable from the outside and a future consumer will
otherwise assume `ToRecipients` + `CCRecipients` is the complete recipient set. For compliance or
audit use it is not.

## Suggested fix

Add direction as a value the provider supplies rather than something the caller derives:

```ts
export type GetMessageMessage<T = Record<string, any>> = {
    …
    /** Set by the provider from transport metadata (folder, sender vs from, sent state).
     *  Callers must not infer this from From/Identifier — delegated send breaks that inference. */
    Direction?: 'Inbound' | 'Outbound';

    /** Present only when reading the sender's own mailbox; a Bcc is not delivered to recipients. */
    BCCRecipients?: string[];
};
```

Optional keeps it backward compatible. A provider that genuinely cannot determine direction leaves it
undefined, and a caller can then fall back to the inference **knowingly** — which is materially better
than today, where the caller cannot tell whether it is guessing.

If `Direction` as an enum is contentious, a `Folder` or `IsFromSentItems` field would carry the same
fact with less semantics attached.

## Notes for whoever picks this up

- `Direction` is the load-bearing half. The Bcc field is a smaller matter and could be declined
  outright, as long as the decision is written down somewhere a consumer will find it.
- The type already carries provider-specific detail in `SourceData`, so a caller *can* dig direction
  out per provider — but doing so defeats the point of the abstraction and has to be written once per
  provider, which is what `BaseCommunicationProvider` exists to avoid.
