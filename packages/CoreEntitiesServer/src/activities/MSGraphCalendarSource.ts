/**
 * @fileoverview Meetings — a calendar source, satisfying the same interface the message source does.
 *
 * ── THE ASSUMPTION THIS IS BUILT ON, WHICH IS NOT SETTLED ───────────────────────────────────────
 *
 * Sales calls Graph `/events` **directly**, outside MJ's Communication abstraction. That is an assumption
 * recorded in D-16, not a ruling — and it is taken because there is nothing to extend today:
 * `BaseCommunicationProvider`'s abstract methods are `SendSingleMessage`, `GetMessages`,
 * `ForwardMessage`, `ReplyToMessage`, `CreateDraft`. Every one of them is message-shaped. There is no
 * event surface to implement against, so waiting for one would mean shipping no meetings at all.
 *
 * If Amith rules that a calendar surface belongs in MJ core, **only this file changes.** It is behind
 * `IActivitySource` exactly like the message source, so the filter, the matcher, the writer, the dedupe,
 * the watermark and the scheduled job neither know nor care which of the two produced an item. That is
 * the whole reason the seam was built before either source existed.
 *
 * ── WHAT IS SHARED WITH EMAIL, AND WHY THAT MATTERS ─────────────────────────────────────────────
 *
 * Nothing about meetings is special-cased downstream. An attendee is matched by the same
 * `RelevanceFilter` against the same `ContactMethod` rows; dedupe is the same `(SourceSystem,
 * ExternalID)` unique index; the type is resolved by the same `Code` lookup, asking for `Meeting`; an
 * unknown attendee becomes the same unresolved-identity link rather than an invented Person. The only
 * differences are on the item itself — `EndedAt` and `Location` are populated, and roles are
 * `Organizer`/`Attendee` instead of `From`/`To`.
 *
 * ── AND IT IS GATED THE SAME WAY ────────────────────────────────────────────────────────────────
 *
 * `Calendars.Read` under app-only auth is tenant-wide, exactly as `Mail.Read` is. The same Exchange
 * Application Access Policy scopes both, and this refuses until told otherwise for the same reason.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { LogError } from '@memberjunction/core';

import { SOURCE_SYSTEM_M365 } from '@mj-biz-apps/sales-entities';
import type {
    ActivitySourceBatch,
    ActivitySourceQuery,
    IActivitySource,
    ItemParticipant,
    NormalizedItem,
} from './ActivitySource.js';

/** One attendee as Graph reports it. */
export interface GraphAttendeeLike {
    type?: string;
    emailAddress?: { address?: string; name?: string };
}

/**
 * The subset of a Graph `event` this maps from.
 *
 * Described structurally rather than imported, for the same reason the message shape is: sales reads
 * these fields and takes no dependency on a Graph SDK type for the privilege.
 */
export interface GraphEventLike {
    id?: string;
    iCalUId?: string;
    subject?: string;
    bodyPreview?: string;
    /** Graph returns `{ dateTime, timeZone }`; `dateTime` has no offset, so `timeZone` is load-bearing. */
    start?: { dateTime?: string; timeZone?: string };
    end?: { dateTime?: string; timeZone?: string };
    location?: { displayName?: string };
    organizer?: { emailAddress?: { address?: string; name?: string } };
    attendees?: GraphAttendeeLike[];
    isCancelled?: boolean;
    seriesMasterId?: string;
}

/** What this class needs. A caller supplies the transport; this only maps. */
export interface GraphEventFetcher {
    GetEvents(params: {
        Mailbox: string;
        Since: Date | null;
        Top: number;
    }): Promise<{ Success?: boolean; ErrorMessage?: string; Events?: GraphEventLike[] }>;
}

export class MSGraphCalendarSource implements IActivitySource {
    public readonly Kind = 'Calendar' as const;
    public readonly ProviderName = SOURCE_SYSTEM_M365;
    public readonly IsLive = true;

    public constructor(
        private readonly fetcher: GraphEventFetcher,
        /** Default FALSE, so wiring this up by accident cannot read a tenant's calendars. */
        private readonly AllowLiveFetch: boolean = false,
    ) {}

    public async Fetch(query: ActivitySourceQuery): Promise<ActivitySourceBatch> {
        if (!this.AllowLiveFetch) {
            return {
                Items: [],
                HighWatermark: null,
                Issues: [
                    'Live Graph calendar fetch is disabled. App-only auth makes Calendars.Read tenant-wide, '
                        + 'so it reads EVERY calendar until an Exchange Application Access Policy scopes the app '
                        + 'registration to a security group — the same policy Mail.Read needs. Confirm it exists '
                        + 'before enabling this, and use FixtureActivitySource until then.',
                ],
            };
        }

        try {
            /**
             * UNLIKE `GetMessages`, A DATE FILTER IS AVAILABLE HERE. Calling `/events` directly means the
             * query can carry the watermark, so the calendar has no fetch-and-discard problem and none of
             * D-17's overflow risk. That is a genuine advantage of the direct call and worth weighing if
             * D-16 is ever decided the other way.
             */
            const response = await this.fetcher.GetEvents({
                Mailbox: query.Mailbox,
                Since: query.Since,
                Top: query.Limit,
            });

            if (response?.Success === false) {
                return {
                    Items: [],
                    HighWatermark: null,
                    Issues: [`Graph refused the calendar read: ${response.ErrorMessage ?? 'no reason given'}`],
                };
            }

            const issues: string[] = [];
            const items: NormalizedItem[] = [];
            for (const event of response?.Events ?? []) {
                const mapped = this.mapEvent(event, issues);
                if (mapped) {
                    items.push(mapped);
                }
            }

            return {
                Items: items,
                HighWatermark: items.length
                    ? new Date(Math.max(...items.map((i) => i.StartedAt.getTime())))
                    : null,
                Issues: issues,
            };
        } catch (err) {
            LogError(`MSGraphCalendarSource.Fetch failed for ${query.Mailbox}: ${err}`);
            return { Items: [], HighWatermark: null, Issues: [`Graph calendar read failed: ${String(err)}`] };
        }
    }

    /**
     * THE ONE UNPROVEN FUNCTION HERE, isolated for the same reason `mapMessage` is: when a scoped mailbox
     * exists, one live run against a handful of real events either confirms this mapping or does not.
     */
    private mapEvent(event: GraphEventLike, issues: string[]): NormalizedItem | null {
        const externalID = event.id?.trim();
        if (!externalID) {
            issues.push('An event carried no id and was skipped — it cannot be deduped.');
            return null;
        }

        const startedAt = graphDate(event.start);
        if (!startedAt) {
            issues.push(`Event ${externalID} had no usable start time and was skipped.`);
            return null;
        }

        /**
         * A CANCELLED MEETING IS STILL A FACT, and is captured rather than dropped -- "they
         * cancelled" is something a rep wants on the timeline.
         *
         * It is reported on `NormalizedItem.Cancelled`, and the ingest maps that to
         * `Activity.Status = 'Cancelled'` (D-25). Storing it as `Completed` was the earlier
         * behaviour and was simply wrong: a meeting that did not happen is not a completed activity.
         */
        const participants: ItemParticipant[] = [];
        const organizer = normalize(event.organizer?.emailAddress?.address);
        if (organizer) {
            participants.push({
                Address: organizer,
                Name: event.organizer?.emailAddress?.name ?? null,
                Role: 'Organizer',
            });
        }
        for (const attendee of event.attendees ?? []) {
            const address = normalize(attendee.emailAddress?.address);
            if (!address || address === organizer) {
                continue;
            }
            participants.push({
                Address: address,
                Name: attendee.emailAddress?.name ?? null,
                Role: 'Attendee',
            });
        }

        const endedAt = graphDate(event.end);

        return {
            ExternalID: externalID,
            /**
             * THE SERIES MASTER GROUPS A RECURRENCE, which is the calendar's analogue of a mail thread —
             * every occurrence of a weekly check-in shares it. `iCalUId` is the cross-mailbox identifier
             * and is kept in `Raw` for the same reason the RFC Message-ID is (D-15).
             */
            ExternalThreadID: event.seriesMasterId?.trim() || null,
            TypeCode: 'Meeting',
            Subject: event.subject?.trim() || '(no subject)',
            Body: event.bodyPreview ?? null,
            StartedAt: startedAt,
            /**
             * `CK_Activity_EndedAt` requires `EndedAt >= StartedAt`. A malformed pair would otherwise fail
             * at the database naming a constraint, which tells nobody which event was wrong — so a bad end
             * is dropped to null and the meeting is still filed.
             */
            EndedAt: endedAt && endedAt.getTime() >= startedAt.getTime() ? endedAt : null,
            Location: event.location?.displayName?.trim() || null,
            /**
             * A MEETING IS `Internal`, not Inbound or Outbound. Direction describes which way a message
             * travelled, and a meeting did not travel — it was attended. `CK_Activity_Direction` allows
             * exactly these three, and Internal is the one that makes no false claim.
             */
            Direction: 'Internal',
            Participants: participants,
            Cancelled: event.isCancelled === true,
            Raw: { ...event, iCalUId: event.iCalUId ?? null },
        };
    }
}

/** Lower-cased, trimmed; empty becomes null. */
function normalize(value: string | null | undefined): string | null {
    const trimmed = value?.trim().toLowerCase();
    return trimmed ? trimmed : null;
}

/**
 * A Graph `{ dateTime, timeZone }` pair as a real instant.
 *
 * ── WHY THE ZONE CANNOT BE IGNORED ──
 *
 * Graph returns `dateTime` WITHOUT an offset — `"2026-08-19T14:00:00.0000000"` — and states the zone
 * separately. `new Date()` on that string applies the SERVER's local zone, so the same meeting lands at a
 * different instant depending on where the job runs. Everything stored here is UTC, so a naive parse
 * would shift every meeting by the deployment's offset and nothing would look wrong.
 *
 * Graph is asked for UTC (`Prefer: outlook.timezone="UTC"` is the caller's job), so `timeZone` should
 * read `UTC` and appending `Z` is correct. When it says anything else the value is REFUSED rather than
 * guessed — a meeting an hour out is worse than a meeting missing, because the wrong one is believed.
 */
function graphDate(slot: { dateTime?: string; timeZone?: string } | undefined): Date | null {
    const raw = slot?.dateTime?.trim();
    if (!raw) {
        return null;
    }
    const zone = (slot?.timeZone ?? 'UTC').trim().toUpperCase();
    if (zone !== 'UTC' && !/[Zz]|[+-]\d{2}:?\d{2}$/.test(raw)) {
        return null;
    }
    const stamped = /[Zz]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`;
    const parsed = new Date(stamped);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
