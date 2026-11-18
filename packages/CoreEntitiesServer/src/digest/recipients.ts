import { RunView, type UserInfo } from '@memberjunction/core';

const RECIPIENT_ENTITY = 'MJ_BizApps_Sales: Deal Digest Recipients';
const EMPLOYEE_ENTITY = 'MJ: Employees';

/** One person who receives one audience's digest, joined to their employee record. */
export interface DigestRecipient {
    AudienceTypeID: string; CompanyID: string | null;
    EmployeeID: string; Email: string; FirstName: string; FullName: string;
}

const lower = (id: string | null): string => (id ?? '').toLowerCase();

/**
 * Drops a repeat of the same address within one audience and company, keeping the first. The same
 * address under another audience survives: each audience receives a different slice of deals.
 */
export function DedupeByEmail(recipients: readonly DigestRecipient[]): DigestRecipient[] {
    const seen = new Set<string>();
    const kept: DigestRecipient[] = [];
    for (const r of recipients) {
        const key = `${lower(r.AudienceTypeID)}|${lower(r.CompanyID)}|${r.Email.trim().toLowerCase()}`;
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
 * employee has been deactivated since the row was saved is dropped here, so mail stops without anyone
 * editing recipient rows. Throws when a read fails, so a broken read cannot pass for "nobody to mail".
 */
export async function LoadDigestRecipients(contextUser: UserInfo): Promise<DigestRecipient[]> {
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
    const inList = ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(', ');
    const emps = await rv.RunView<EmployeeRow>({
        EntityName: EMPLOYEE_ENTITY,
        ExtraFilter: `Active = 1 AND ID IN (${inList})`,
        ResultType: 'simple',
        Fields: ['ID', 'Email', 'FirstName', 'LastName'],
    }, contextUser);
    if (!emps.Success) throw new Error(`Could not read the digest recipients' employees: ${emps.ErrorMessage}`);
    const byId = new Map((emps.Results ?? []).map((e) => [lower(String(e.ID)), e]));

    const out: DigestRecipient[] = [];
    for (const r of recipientRows) {
        const e = byId.get(lower(String(r.EmployeeID)));
        if (!e) continue;
        out.push({
            AudienceTypeID: String(r.DealDigestAudienceTypeID),
            CompanyID: r.CompanyID ?? null,
            EmployeeID: String(r.EmployeeID),
            Email: e.Email.trim(),
            FirstName: e.FirstName,
            FullName: `${e.FirstName} ${e.LastName}`.trim(),
        });
    }
    return DedupeByEmail(out);
}
