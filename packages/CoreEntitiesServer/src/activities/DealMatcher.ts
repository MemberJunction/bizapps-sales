/**
 * @fileoverview Which deal an item belongs to — and what to do when the answer is none.
 *
 * ── THE NO-DEAL-MATCH CASE IS A FIRST-CLASS OUTCOME ─────────────────────────────────────────────
 *
 * S-US10 asks that items "link to account and contact even where no deal match exists". That is only
 * expressible because `ActivityLink` has the unresolved-identity half of `CK_ActivityLink_Target`: a link
 * carries either a record or an `IdentityKind`/`IdentityValue` pair. So an item involving a known person
 * on no known deal is still filed against that person, and a later matcher can pick it up.
 *
 * What must NOT happen is inventing a party to hang it on. The common migration explicitly forbids
 * auto-creating stub People, and the reason is worth restating: a stub is indistinguishable from a real
 * record five minutes later, so every downstream count, dedupe and merge inherits it permanently.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { RunView, type UserInfo } from '@memberjunction/core';

import { escapeSql } from './ActivityWriterService.js';
import { E_DEAL, E_DEAL_STATUS_TYPE } from '@mj-biz-apps/sales-entities';
import type { KnownAddress } from './RelevanceFilter.js';

export interface DealMatch {
    DealID: string;
    /** Why this deal was chosen — carried so a surface can explain an attribution. */
    Basis: 'PrimaryContact' | 'Account';
    /** The matched party. Same ID as the common Person/Organization (shared-PK IsA). */
    PartyID: string;
}

/** One row of the candidate read. */
interface DealCandidate {
    ID: string;
    AccountID: string | null;
    PrimaryContactID: string | null;
    ExpectedCloseDate: string | Date | null;
}

export class DealMatcher {
    /**
     * The open deals a set of matched parties points at.
     *
     * ── ONE ITEM CAN BELONG TO SEVERAL DEALS, AND THAT IS CORRECT ──
     *
     * A customer with two live pursuits emails about both. Returning a single "best" deal would file the
     * message against one and hide it from the other, and picking between them would need to read the
     * message — which is a model call, and would put it before the relevance filter has finished its job.
     * So every match is returned and the item is linked to each. The activity row is shared; only its
     * `Regarding` links multiply.
     *
     * ── AND IT MATCHES ONLY OPEN DEALS ──
     *
     * A closed deal is provenance. Attaching new correspondence to it would change what the record of a
     * finished pursuit says, months later, without anyone acting — and a won deal is locked precisely so
     * that cannot happen. Mail about a closed deal that involves a known contact still lands: it becomes
     * a party-linked activity with no deal, which is the honest description of it.
     */
    public async MatchOpenDeals(matches: KnownAddress[], contextUser: UserInfo): Promise<DealMatch[]> {
        const personIDs = [...new Set(matches.map((m) => m.PersonID).filter((id): id is string => !!id))];
        const orgIDs = [...new Set(matches.map((m) => m.OrganizationID).filter((id): id is string => !!id))];
        if (personIDs.length === 0 && orgIDs.length === 0) {
            return [];
        }

        const clauses: string[] = [];
        if (personIDs.length) {
            clauses.push(`PrimaryContactID IN (${personIDs.map((id) => `'${escapeSql(id)}'`).join(', ')})`);
        }
        if (orgIDs.length) {
            clauses.push(`AccountID IN (${orgIDs.map((id) => `'${escapeSql(id)}'`).join(', ')})`);
        }

        /**
         * OPEN-ness comes from `DealStatusType.IsOpen`, a FLAG, never from a status name.
         *
         * Read as its own query rather than as a subquery in the filter. A subquery would have to name
         * `__mj_BizAppsSales.vwDealStatusTypes` literally, and this app is authored for PostgreSQL from
         * day one -- a hardcoded schema-qualified view name is exactly what the T-SQL converter cannot
         * carry across. Two reads and an `IN` list are portable and, at the scale of a type table,
         * free.
         */
        const statuses = await new RunView().RunView<{ ID: string }>(
            {
                EntityName: E_DEAL_STATUS_TYPE,
                ExtraFilter: 'IsOpen = 1 AND IsActive = 1',
                ResultType: 'simple',
                Fields: ['ID'],
            },
            contextUser,
        );
        const openIDs = statuses.Success ? (statuses.Results ?? []).map((row) => row.ID) : [];
        if (openIDs.length === 0) {
            return [];
        }
        const openList = openIDs.map((id) => `'${escapeSql(id)}'`).join(', ');

        const r = await new RunView().RunView<DealCandidate>(
            {
                EntityName: E_DEAL,
                ExtraFilter: `(${clauses.join(' OR ')}) AND DealStatusTypeID IN (${openList})`,
                ResultType: 'simple',
                Fields: ['ID', 'AccountID', 'PrimaryContactID', 'ExpectedCloseDate'],
            },
            contextUser,
        );
        if (!r.Success) {
            return [];
        }
        const personSet = new Set(personIDs.map((id) => id.toLowerCase()));
        const orgSet = new Set(orgIDs.map((id) => id.toLowerCase()));
        const found: DealMatch[] = [];

        for (const deal of r.Results ?? []) {
            const contact = deal.PrimaryContactID ? String(deal.PrimaryContactID).toLowerCase() : null;
            const account = deal.AccountID ? String(deal.AccountID).toLowerCase() : null;

            /**
             * THE PRIMARY CONTACT WINS OVER THE ACCOUNT when both match. A named individual on the deal
             * is a stronger signal than "somebody at this company", and the basis is reported so an
             * attribution can be explained rather than merely asserted.
             */
            if (contact && personSet.has(contact)) {
                found.push({ DealID: deal.ID, Basis: 'PrimaryContact', PartyID: contact });
            } else if (account && orgSet.has(account)) {
                found.push({ DealID: deal.ID, Basis: 'Account', PartyID: account });
            }
        }
        return found;
    }
}
