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
import { E_CONTACT_METHOD } from './activity-vocabulary.js';
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
     * ── WHY THE MATCH IS DONE IN MEMORY RATHER THAN BY `LOWER()` IN THE FILTER ──
     *
     * `ContactMethod.Value` is stored as entered, so an address could be `Ada@Example.com`. A
     * `Value IN (...)` comparison relies on the database collation being case-insensitive, which it is on
     * SQL Server by default and is NOT on PostgreSQL — and production is Postgres. Wrapping the column in
     * `LOWER()` would be portable but non-sargable, discarding any index on `Value`. So the filter stays
     * an `IN` for the index, and the case-folding is redone here where it is certain. A row the database
     * returns case-insensitively still matches; one it misses on Postgres would be a genuine miss, which
     * is why `Value` should be normalized at write time — noted as D-19.
     */
    private async lookup(addresses: string[], contextUser: UserInfo): Promise<Map<string, KnownAddress>> {
        const list = addresses.map((a) => `'${escapeSql(a)}'`).join(', ');
        const r = await new RunView().RunView<{
            Value: string;
            PersonID: string | null;
            OrganizationID: string | null;
        }>(
            {
                EntityName: E_CONTACT_METHOD,
                ExtraFilter: `Value IN (${list})`,
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
