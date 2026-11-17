import { describe, expect, it } from 'vitest';
import {
    AddPartyChoice,
    ChosenPartiesParam,
    DealPartyChoices,
    LinkedParties,
    type DealPartyFields,
} from '../lib/activities/deal-activity-parties';

/** bc-aidp-next-golive#408: choosing who a deal activity is linked to. */
const ORG = 'A0000000-0000-4000-8000-000000000001';
const PRIMARY = 'B0000000-0000-4000-8000-000000000001';
const BILLING = 'B0000000-0000-4000-8000-000000000002';
const BUYER = 'B0000000-0000-4000-8000-000000000003';

const DEAL: DealPartyFields = {
    AccountID: ORG, Account: 'Acme',
    PrimaryContactID: PRIMARY, PrimaryContact: 'Pat Primary',
    BillingContactID: BILLING, BillingContact: 'Bea Billing',
};

describe('the compose checklist', () => {
    it('ticks only the account and primary contact, so a plain log links what it did before', () => {
        const list = DealPartyChoices(DEAL, [{ SalesContactID: BUYER, SalesContact: 'Bo Buyer', BuyingRoleType: 'Champion' }]);
        expect(list.map((p) => [p.Kind, p.Name, p.Labels.join('+'), p.Checked])).toEqual([
            ['Organization', 'Acme', 'Account', true],
            ['Person', 'Pat Primary', 'Primary contact', true],
            ['Person', 'Bea Billing', 'Billing contact', false],
            ['Person', 'Bo Buyer', 'Champion', false],
        ]);
    });

    it('lists a person once, with every reason, ticked if any reason ticks them', () => {
        const list = DealPartyChoices({ ...DEAL, BillingContactID: PRIMARY.toLowerCase() }, [
            { SalesContactID: PRIMARY, SalesContact: 'Pat Primary', BuyingRoleType: null },
        ]);
        const pat = list.filter((p) => p.Kind === 'Person');
        expect(pat).toHaveLength(1);
        expect(pat[0]).toMatchObject({ Checked: true, Labels: ['Primary contact', 'Billing contact', 'Buying team'] });
    });

    it('skips what the deal does not have', () => {
        expect(DealPartyChoices(null, [])).toEqual([]);
        expect(DealPartyChoices({ ...DEAL, AccountID: null, BillingContactID: null }, [])).toHaveLength(1);
    });

    it('adds a searched-for party ticked, and re-ticks one already listed instead of repeating it', () => {
        let list = DealPartyChoices(DEAL, []);
        list = AddPartyChoice(list, 'Person', BILLING.toLowerCase(), 'Bea Billing');
        expect(list.filter((p) => p.Checked)).toHaveLength(3);
        expect(list).toHaveLength(3);
        list = AddPartyChoice(list, 'Organization', BUYER, 'Other Org');
        expect(list.at(-1)).toMatchObject({ Kind: 'Organization', Labels: ['Added'], Checked: true });
    });

    it('sends only the ticked lines, kind and ID', () => {
        const list = DealPartyChoices(DEAL, []).map((p) => (p.Kind === 'Organization' ? { ...p, Checked: false } : p));
        expect(JSON.parse(ChosenPartiesParam(list))).toEqual([{ Kind: 'Person', RecordID: PRIMARY }]);
    });
});

describe('what a logged activity shows it is linked to', () => {
    const IDS = { Deal: 'D', Person: 'P', Organization: 'O' };
    const DEAL_ID = 'C0000000-0000-4000-8000-000000000001';

    it('hides the anchor to this deal, names people and organizations, and shows identities as written', () => {
        const shown = LinkedParties(
            [
                { Role: 'Regarding', EntityID: 'd', RecordID: DEAL_ID.toLowerCase(), IdentityValue: null, Entity: 'Deals' },
                { Role: 'Participant', EntityID: 'P', RecordID: PRIMARY, IdentityValue: null, Entity: 'People' },
                { Role: 'Participant', EntityID: 'O', RecordID: ORG, IdentityValue: null, Entity: 'Organizations' },
                { Role: 'To', EntityID: null, RecordID: null, IdentityValue: 'who@else.com', Entity: null },
            ],
            IDS,
            DEAL_ID,
            new Map([[PRIMARY.toLowerCase(), 'Pat Primary']]),
        );
        expect(shown).toEqual([
            { Icon: 'person', Name: 'Pat Primary', Role: 'Participant' },
            { Icon: 'organization', Name: `Organizations ${ORG}`, Role: 'Participant' },
            { Icon: 'other', Name: 'who@else.com', Role: 'To' },
        ]);
    });
});
