# Communication: `GetMessages` has no date filter, so busy mailboxes lose messages permanently

**Component:** `@memberjunction/communication-base-types` — `GetMessagesParams`, `BaseCommunicationProvider.GetMessages`
**Affects:** any incremental sync built on the Communication abstraction
**Observed on:** MJ `6.1.0-edge.2`
**Severity:** highest of the Communication gaps — this one loses data silently

---

## Consequence first

**Messages are missed and never retried.** Not delayed, not duplicated — dropped, with no error and
nothing in the record to indicate anything is absent.

`GetMessages` cannot be asked for "everything since the last run". It returns the most recent
`NumMessages` and the caller discards what it has already seen. If more messages arrive between two
runs than that limit, the oldest of them fall off the end of the fetch — and because the caller's
watermark advances to the newest message it *did* see, those messages are never inside any future
window either.

The failure is invisible from the data. A deal's timeline simply has a gap, and it looks like a quiet
week rather than a lost fetch.

## What is missing

```ts
// Communication/base-types/src/BaseProvider.ts
export type GetMessagesParams<T = Record<string, any>> = {
    Identifier?: string;
    NumMessages: number;
    UnreadOnly?: boolean;
    ContextData?: T;
    IncludeHeaders?: boolean;
};
```

There is no `Since`, no `After`, no date range of any kind. `UnreadOnly` is the only filter, and it is
not a substitute: read state is a property of the mailbox owner's behaviour, not of the sync, so a
user reading their own mail on a phone silently changes what an unrelated background job can see.

The underlying transports generally do support this. Microsoft Graph's `/messages` accepts
`$filter=receivedDateTime ge …`, so the capability is being lost at MJ's abstraction rather than at
the provider.

## How it bounds a real deployment

The exposure is one window of `NumMessages` per run, per mailbox:

| | |
|---|---|
| Fetch limit | `NumMessages` (we use 100) |
| Cadence | hourly |
| Safe if | fewer than 100 messages arrive in any mailbox in any hour |
| Lost if | more do — the excess is dropped and never re-fetched |

A quiet personal mailbox never notices. A shared `sales@` or `support@` alias on a busy afternoon is
exactly the case that breaks, and it is also the mailbox whose messages matter most. Raising
`NumMessages` widens the window without closing it, at the cost of fetching and discarding more on
every run — the work is proportional to the limit, not to what actually changed.

## What we do meanwhile, and why it is not enough

The caller applies the watermark after the fetch and discards what it has already recorded. To avoid
failing silently we also raise an explicit issue when **every message in the batch was newer than the
watermark AND the batch came back full** — the one observable signature of an overflow.

That signature is genuine but weak. It says an overflow *may* have happened; it cannot say how many
messages were lost or which, because by definition they were never fetched. It is a smoke alarm, not
a record.

## Suggested fix

Add a date bound to `GetMessagesParams`:

```ts
export type GetMessagesParams<T = Record<string, any>> = {
    …
    /** Return only messages received at or after this time. Providers that cannot filter
     *  server-side should filter after fetching rather than ignoring it. */
    Since?: Date;
};
```

Two properties matter more than the exact name:

1. **Providers that can push the filter down should.** Graph, IMAP and most REST mail APIs support a
   received-after filter, which makes the fetch proportional to what changed rather than to the limit.
2. **Providers that cannot must still honour it,** by filtering after fetching. A parameter that is
   silently ignored by some providers is worse than none, because the caller cannot tell which
   behaviour it got.

A companion signal would close the remaining gap: a `MoreAvailable`/`HasMore` flag on the result, so a
caller can page rather than guess from batch fullness. With `Since` plus paging, "everything since the
watermark" becomes expressible and the loss window disappears entirely.

## Notes for whoever picks this up

- `UnreadOnly` in the same type shows the shape is already there for optional filters; this is an
  addition rather than a redesign.
- The fix is backward compatible: existing callers that pass no `Since` keep today's behaviour exactly.
- If a date filter is contentious, an opaque cursor/delta token would serve the same purpose and match
  what Graph's delta queries already provide — but `Since` is portable across providers and a cursor is
  not.
