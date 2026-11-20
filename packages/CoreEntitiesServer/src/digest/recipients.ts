import { RunView, type UserInfo } from '@memberjunction/core';
import { EscapeSQLString, NormalizeUUID } from '@memberjunction/global';

import { EMPLOYEE_ENTITY, RECIPIENT_ENTITY } from './shared.js';

/** One person who receives one audience's digest, joined to their employee record. */
export interface DigestRecipient {
    AudienceTypeID: string; CompanyID: string | null;
    EmployeeID: string; Email: string; FirstName: string; FullName: string;
}

/**
 * Drops a repeat of the same address within one audience and company, keeping the first. The same
 * address under another audience survives: each audience receives a different slice of deals.
 *
 * CompanyID is part of the key because one person can hold a leader row at several companies and must
 * receive one email per company. That only holds for a COMPANY audience: for a portfolio-wide one the
 * company has no effect on the digest, so two rows differing only in CompanyID are the same email
 * twice. `LoadDigestRecipients` clears the company on those rows before calling this, which is what
 * makes the key safe; call this with recipients it produced, not with raw table rows.
 */
export function DedupeByEmail(recipients: readonly DigestRecipient[]): DigestRecipient[] {
    const seen = new Set<string>();
    const kept: DigestRecipient[] = [];
    for (const r of recipients) {
        const key = `${NormalizeUUID(r.AudienceTypeID)}|${NormalizeUUID(r.CompanyID)}|${r.Email.trim().toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        kept.push(r);
    }
    return kept;
}

interface RecipientRow { DealDigestAudienceTypeID: string; CompanyID: string | null; EmployeeID: string }
interface EmployeeRow { ID: string; Email: string; FirstName: string; LastName: string }

/**
 * Active recipients joined to their active employees: two reads, joined in memory. A recipient whose
 * employee has been deactivated, or had their address blanked, since the row was saved is dropped here, so mail stops without anyone
 * editing recipient rows. Throws when a read fails, so a broken read cannot pass for "nobody to mail".
 *
 * `portfolioWideAudienceIDs` holds the `NormalizeUUID`d IDs of the audiences that cover the whole
 * portfolio; the caller already has them from the audience read. A recipient row on one of those
 * audiences has its CompanyID CLEARED here, because the company cannot change what that digest
 * contains: left in place, (CEO, NULL, E1) and (CEO, CompanyA, E1) survive the dedupe as two
 * recipients and that person receives the same CEO digest twice. `Save()` refuses such a row now, so
 * this covers the rows already in the table — and an audience switched to portfolio-wide after its
 * rows were written, which no save-time check can reach.
 *
 * An audience missing from the set is treated as company-scoped, which is the safe direction: the
 * company stays on the row, and a company audience's rows are keyed as they always were.
 */
export async function LoadDigestRecipients(
    contextUser: UserInfo,
    portfolioWideAudienceIDs: ReadonlySet<string>,
): Promise<DigestRecipient[]> {
    const rv = new RunView();
    const rows = await rv.RunView<RecipientRow>({
        EntityName: RECIPIENT_ENTITY,
        ExtraFilter: 'IsActive = 1',
        ResultType: 'simple',
        Fields: ['DealDigestAudienceTypeID', 'CompanyID', 'EmployeeID'],
    }, contextUser);
    if (!rows.Success) throw new Error(`Could not read the digest recipients: ${rows.ErrorMessage}`);
    const recipientRows = rows.Results ?? [];
    if (recipientRows.length === 0) return [];

    const ids = [...new Set(recipientRows.map((r) => String(r.EmployeeID)))];
    const inList = ids.map((id) => `'${EscapeSQLString(id)}'`).join(', ');
    const emps = await rv.RunView<EmployeeRow>({
        EntityName: EMPLOYEE_ENTITY,
        ExtraFilter: `Active = 1 AND ID IN (${inList})`,
        ResultType: 'simple',
        Fields: ['ID', 'Email', 'FirstName', 'LastName'],
    }, contextUser);
    if (!emps.Success) throw new Error(`Could not read the digest recipients' employees: ${emps.ErrorMessage}`);
    const byId = new Map((emps.Results ?? []).map((e) => [NormalizeUUID(String(e.ID)), e]));

    const out: DigestRecipient[] = [];
    for (const r of recipientRows) {
        const e = byId.get(NormalizeUUID(String(r.EmployeeID)));
        if (!e) continue;
        // Email is NOT NULL, so a blanked address is blank rather than null; Save() checked it once,
        // at creation, and does not re-run for a row nobody edits.
        if (!e.Email || e.Email.trim() === '') continue;
        const audienceTypeID = String(r.DealDigestAudienceTypeID);
        out.push({
            AudienceTypeID: audienceTypeID,
            CompanyID: portfolioWideAudienceIDs.has(NormalizeUUID(audienceTypeID)) ? null : (r.CompanyID ?? null),
            EmployeeID: String(r.EmployeeID),
            Email: e.Email.trim(),
            FirstName: e.FirstName,
            FullName: `${e.FirstName} ${e.LastName}`.trim(),
        });
    }
    return DedupeByEmail(out);
}
