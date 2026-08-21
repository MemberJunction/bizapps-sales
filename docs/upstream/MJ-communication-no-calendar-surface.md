# Communication: there is no event or calendar surface, so meetings are an extension rather than configuration

**Component:** `@memberjunction/communication-base-types` — `BaseCommunicationProvider`
**Affects:** any app that needs calendar events alongside messages
**Observed on:** MJ `6.1.0-edge.2`
**Type:** platform question, not a defect — nothing here is broken

---

## Consequence first

**An app that needs meetings has to leave the abstraction to get them.** Not extend it, leave it: the
provider base has no method that returns an event, so the only routes are a change to MJ core or a
direct call to the underlying transport. Both are viable; they lead to different places, and the
choice is architectural rather than technical.

For us this is an acceptance criterion, not a nicety — the story reads *"Meetings involving a deal's
contacts appear on the deal without manual entry"* — so we need a ruling rather than a workaround.

## The surface as it stands

`BaseCommunicationProvider`'s abstract methods are:

```ts
public abstract Process(…): Promise<{ Success: boolean; Message?: string }>
public abstract SendSingleMessage(…)
public abstract GetMessages(…)
public abstract ForwardMessage(…)
public abstract ReplyToMessage(…)
public abstract CreateDraft(…)
```

Every one is message-shaped. There is no `GetEvents`, no calendar concept, and no generic
"items" method an event could arrive through. The gap is total rather than partial, which is worth
saying plainly: this is not a missing field on an existing call.

The transports do support it — Microsoft Graph exposes `/events` and `/calendarView` on the same
credential and the same permission model already used for `/messages` — so this is a question about
MJ's abstraction rather than about provider capability.

## The two routes, and why they are not equivalent

**1. Extend the provider base with a calendar surface.**
Right in the long run and benefits every app: one credential model, one provider registry, one place
where a new transport is taught about both messages and events. It is a change to MJ core, so no
consuming repository can make it alone, and it needs a shape that suits providers whose calendar model
differs from Graph's.

**2. Call the transport's calendar API directly from the consuming app.**
Available immediately and entirely under our control. It also creates, permanently, a second way of
reaching the same mail system: one path through `BaseCommunicationProvider` with its credential
handling and registry, and one beside it with its own. That duplication is what the provider
abstraction exists to prevent, and once two apps have done it the abstraction is no longer where a new
transport gets added.

## What we have done meanwhile

Neither — and the consuming interface is deliberately shaped so either fits later without redesign:

- our normalized item type already carries `TypeCode`, `EndedAt` and `Location`, which are the fields
  an event needs and a message does not;
- our source interface's `Kind` is `'Message' | 'Calendar'`, so a calendar source satisfies the same
  contract and slots in beside the message source.

Nothing about meetings is half-built. Whichever route is chosen, what changes is where the events come
from, not what happens to them afterwards.

## What we are asking for

A ruling on route 1 versus route 2, and if route 1, a rough sense of timing — because that determines
whether we ship route 2 as a documented stopgap or wait.

If it helps the decision, the minimum useful shape from our side is small:

```ts
public abstract GetEvents(params: GetEventsParams): Promise<GetEventsResult>
```

with `GetEventsParams` carrying an identifier, a date range and a limit, and each event carrying
start, end, subject, location, organizer and attendees. We do not need free/busy, recurrence
expansion, or write access. A read-only, date-ranged fetch covers the story we have — and a date range
here would avoid the gap that `GetMessages` has today, where the absence of a date filter makes
incremental sync lossy (written up separately).

## Notes for whoever picks this up

- Framing this as configuration versus extension is the useful distinction: today an app cannot get
  meetings by configuring anything, which is what makes it a platform question rather than an
  integration task.
- The permission and credential story is already solved — Graph calendar scopes sit alongside mail
  scopes on the same registration — so route 1 is mostly interface design rather than new plumbing.
- If route 2 is chosen, it would help to have it stated in MJ's own docs as the sanctioned answer, so
  the next app does not re-litigate it and a future route 1 knows what it has to absorb.
