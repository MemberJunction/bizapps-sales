/**
 * @fileoverview The gate: an item is captured only if a participant is a KNOWN contact.
 *
 * ── THIS RUNS FIRST, AND THE ORDERING IS A PRIVACY GUARANTEE ────────────────────────────────────
 *
 * Nothing in this file calls a model, and nothing downstream of it may run before it. That ordering is
 * what keeps personal mail out of an LLM: a message whose participants match no `ContactMethod` is
 * discarded here, having been read only by this comparison. If a summarizer or classifier is ever added
 * to the ingest, it belongs strictly AFTER this filter — putting it before would send the contents of
 * every message in the mailbox, including the private ones, to a third party.
 *
 * ── AND WHY IT MATCHES ADDRESSES, NEVER DOMAINS ─────────────────────────────────────────────────
 *
 * A domain rule looks equivalent and is not. `@bluecypress.io` would capture every internal message
 * anybody sent; a customer's domain would capture their whole company including people nobody at this
 * end has ever dealt with. Worse, both read as working — the activities appear, they are plausible, and
 * the mailbox owner's private correspondence with a colleague is now on a deal timeline. Only an exact
 * address match against a stored `ContactMethod` says "this is a person we have a relationship with".
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { RunView, type UserInfo } from '@memberjunction/core';

import { escapeSql } from './ActivityWriterService.js';
import { E_CONTACT_METHOD } from '@mj-biz-apps/sales-entities';
import type { NormalizedItem } from './ActivitySource.js';

/** A contact method that matched — the person or organization behind an address. */
export interface KnownAddress {
    Address: string;
    PersonID: string | null;
    OrganizationID: string | null;
}

export interface RelevanceVerdict {
    Item: NormalizedItem;
    /** True when at least one participant matched a stored contact method. */
    IsRelevant: boolean;
    /** The participants that matched, with the party behind each. */
    Matches: KnownAddress[];
    /** Addresses on the item that matched nothing. Recorded as unresolved identities, never invented. */
    Unmatched: string[];
}

export class RelevanceFilter {
    /**
     * Partitions a batch into what may be captured and what must not be.
     *
     * ONE QUERY FOR THE WHOLE BATCH. A per-item lookup would be a `RunView` in a loop — the thing the
     * performance rule forbids — and at a mailbox's scale it is the difference between one round trip
     * and one per message.
     */
    public async Apply(items: NormalizedItem[], contextUser: UserInfo): Promise<RelevanceVerdict[]> {
        if (items.length === 0) {
            return [];
        }

        const addresses = [
            ...new Set(
                items.flatMap((item) => item.Participants.map((p) => p.Address.trim().toLowerCase())).filter(Boolean),
            ),
        ];
        if (addresses.length === 0) {
            return items.map((item) => ({ Item: item, IsRelevant: false, Matches: [], Unmatched: [] }));
        }

        const known = await this.lookup(addresses, contextUser);

        return items.map((item) => {
            const itemAddresses = [
                ...new Set(item.Participants.map((p) => p.Address.trim().toLowerCase()).filter(Boolean)),
            ];
            const matches: KnownAddress[] = [];
            const unmatched: string[] = [];
            for (const address of itemAddresses) {
                const hit = known.get(address);
                if (hit) {
                    matches.push(hit);
                } else {
                    unmatched.push(address);
                }
            }
            return { Item: item, IsRelevant: matches.length > 0, Matches: matches, Unmatched: unmatched };
        });
    }

    /**
     * Every stored contact method among these addresses, keyed by lower-cased address.
     *
     * -- WHY THE FILTER LOWER-CASES THE COLUMN, DESPITE THE INDEX COST (D-19) --
     *
     * `ContactMethod.Value` is stored as entered, so an address may be `Ada@Example.com`. An `IN` list
     * relies on the DATABASE COLLATION being case-insensitive. SQL Server's default is; **PostgreSQL's
     * is not**, and production is Postgres.
     *
     * The earlier version used a bare `IN` and re-folded case in memory, which is correct on SQL Server
     * and silently wrong on Postgres: a differently-cased stored address simply would not come back, the
     * message would be judged irrelevant, and it would never link. No error, no missing row anyone
     * counts, no way to notice -- the worst failure shape available. So the comparison is made
     * case-insensitive IN THE QUERY, where it holds on both engines.
     *
     * The cost is real and accepted: `LOWER(Value)` is non-sargable, so any plain index on `Value` stops
     * being usable for this read. A functional index on `LOWER(Value)` in bizapps-common restores it and
     * is the proper fix; that is somebody else's schema, so it stays a recommendation rather than
     * something done from here. The in-memory fold is KEPT as well, because it is what makes the returned
     * map's keys match what the caller looks up.
     */
    private async lookup(addresses: string[], contextUser: UserInfo): Promise<Map<string, KnownAddress>> {
        const filter = BuildContactMethodFilter(addresses);
        const r = await new RunView().RunView<{
            Value: string;
            PersonID: string | null;
            OrganizationID: string | null;
        }>(
            {
                EntityName: E_CONTACT_METHOD,
                ExtraFilter: filter,
                ResultType: 'simple',
                Fields: ['Value', 'PersonID', 'OrganizationID'],
            },
            contextUser,
        );
        const known = new Map<string, KnownAddress>();
        if (!r.Success) {
            /**
             * FAIL CLOSED. A failed lookup means nothing is known, so nothing is relevant, so nothing is
             * captured — the safe direction. Failing open would capture the entire mailbox on a transient
             * database error, which is the one outcome this filter exists to prevent.
             */
            return known;
        }

        for (const row of r.Results ?? []) {
            const address = String(row.Value ?? '').trim().toLowerCase();
            if (!address) {
                continue;
            }
            const existing = known.get(address);
            if (existing) {
                // One address can appear on both a person and their organization; keep both halves.
                existing.PersonID = existing.PersonID ?? row.PersonID ?? null;
                existing.OrganizationID = existing.OrganizationID ?? row.OrganizationID ?? null;
                continue;
            }
            known.set(address, {
                Address: address,
                PersonID: row.PersonID ?? null,
                OrganizationID: row.OrganizationID ?? null,
            });
        }
        return known;
    }
}

/**
 * The `ContactMethod` filter for a set of addresses -- extracted so the claim can be TESTED.
 *
 * -- WHY THIS IS A SEPARATE, EXPORTED FUNCTION --
 *
 * The D-19 fix is that the case-fold happens in the QUERY rather than being left to the database
 * collation. On SQL Server, whose default collation is case-insensitive, both versions behave
 * identically -- so a behavioural check passes either way and proves nothing. Measured, not assumed:
 * reverting the fix and re-running the suite left all seventeen checks green.
 *
 * The only thing that differs on THIS engine is the SQL. So the filter is built here, once, and AC12
 * asserts it folds case explicitly. That turns an untestable intention into a testable one, and the
 * regression it guards -- silently dropping relevant mail after the Postgres conversion -- is worth a
 * white-box assertion.
 */
export function BuildContactMethodFilter(addresses: string[]): string {
    const list = addresses.map((a) => `'${escapeSql(a.trim().toLowerCase())}'`).join(', ');
    return `LOWER(Value) IN (${list})`;
}
