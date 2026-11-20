/**
 * @fileoverview Who a deal activity is linked to (bc-aidp-next-golive#408): the compose form's checklist,
 * and the labels the Activity panel shows for a logged activity. Pure; the reads live in the components.
 *
 * @module @mj-biz-apps/sales-ng
 */
import type { mjBizAppsCommonActivityLinkEntity } from '@mj-biz-apps/common-entities';
import type { DealEntity, mjBizAppsSalesDealContactRoleEntity } from '@mj-biz-apps/sales-entities';

export type PartyKind = 'Person' | 'Organization';

/** The deal fields the checklist starts from. `AccountID` IS the Organization ID; the contact IDs ARE Person IDs. */
export type DealPartyFields = Pick<
    DealEntity,
    'AccountID' | 'Account' | 'PrimaryContactID' | 'PrimaryContact' | 'BillingContactID' | 'BillingContact'
>;
export type BuyingTeamFields = Pick<mjBizAppsSalesDealContactRoleEntity, 'SalesContactID' | 'SalesContact' | 'BuyingRoleType'>;

/** One line of the compose checklist. */
export interface PartyChoice {
    Kind: PartyKind;
    RecordID: string;
    Name: string;
    /** Why this person is here: "Primary contact", "Billing contact", a buying role, "Added". */
    Labels: string[];
    Checked: boolean;
}

/**
 * The account, primary contact, billing contact and buying team as one list, one line per record.
 *
 * Only the account and primary contact start ticked: those are what a plain log linked before #408, so
 * not touching the list writes the same links as before.
 */
export function DealPartyChoices(deal: DealPartyFields | null, team: readonly BuyingTeamFields[]): PartyChoice[] {
    const list: PartyChoice[] = [];
    const add = (kind: PartyKind, id: string | null, name: string | null, label: string, checked: boolean): void => {
        if (!id) return;
        const found = list.find((p) => p.Kind === kind && sameID(p.RecordID, id));
        if (!found) {
            list.push({ Kind: kind, RecordID: id, Name: name || id, Labels: [label], Checked: checked });
            return;
        }
        if (!found.Labels.includes(label)) found.Labels.push(label);
        found.Checked = found.Checked || checked;
    };
    add('Organization', deal?.AccountID ?? null, deal?.Account ?? null, 'Account', true);
    add('Person', deal?.PrimaryContactID ?? null, deal?.PrimaryContact ?? null, 'Primary contact', true);
    add('Person', deal?.BillingContactID ?? null, deal?.BillingContact ?? null, 'Billing contact', false);
    for (const member of team) {
        add('Person', member.SalesContactID, member.SalesContact, member.BuyingRoleType || 'Buying team', false);
    }
    return list;
}

/** Adds a searched-for person or organization, ticked. One already listed is ticked rather than repeated. */
export function AddPartyChoice(list: readonly PartyChoice[], kind: PartyKind, id: string, name: string): PartyChoice[] {
    const found = list.find((p) => p.Kind === kind && sameID(p.RecordID, id));
    if (found) {
        return list.map((p) => (p === found ? { ...p, Checked: true } : p));
    }
    return [...list, { Kind: kind, RecordID: id, Name: name || id, Labels: ['Added'], Checked: true }];
}

/** The `Parties` param of `Sales.LogActivity`: the ticked lines, kind and ID only. */
export function ChosenPartiesParam(list: readonly PartyChoice[]): string {
    return JSON.stringify(list.filter((p) => p.Checked).map((p) => ({ Kind: p.Kind, RecordID: p.RecordID })));
}

export type ActivityLinkFields = Pick<
    mjBizAppsCommonActivityLinkEntity,
    'Role' | 'EntityID' | 'RecordID' | 'IdentityValue' | 'Entity'
>;

/** One thing a logged activity is linked to, as the Activity panel shows it. */
export interface LinkedParty {
    Icon: 'person' | 'organization' | 'other';
    Name: string;
    Role: string;
}

/**
 * The links worth showing for one activity: everything except its anchor to the deal being viewed.
 * `names` maps a lower-cased record ID to its display name; an unknown one shows its ID.
 */
export function LinkedParties(
    links: readonly ActivityLinkFields[],
    entityIDs: { Deal: string; Person: string; Organization: string },
    dealID: string,
    names: ReadonlyMap<string, string>,
): LinkedParty[] {
    return links
        .filter((l) => !(sameID(l.EntityID, entityIDs.Deal) && sameID(l.RecordID, dealID)))
        .map((l) => {
            const icon = sameID(l.EntityID, entityIDs.Person)
                ? 'person'
                : sameID(l.EntityID, entityIDs.Organization) ? 'organization' : 'other';
            const name = l.RecordID
                ? (names.get(l.RecordID.toLowerCase()) ?? `${l.Entity ?? 'Record'} ${l.RecordID}`)
                : (l.IdentityValue ?? '');
            return { Icon: icon, Name: name, Role: l.Role };
        });
}

function sameID(a: string | null | undefined, b: string | null | undefined): boolean {
    return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}
