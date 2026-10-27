import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { MJGlobal } from '@memberjunction/global';
import {
    BaseFormPanel,
    RelatedEntitySectionKey,
    ResolveFormContributions,
    type FormContributionRegistration,
    type FormContributionRelationship,
    type FormPanelRegistrationMetadata,
} from '@memberjunction/ng-base-forms';
import '../lib/form-panels/contact-accounts.panel';
import { MJS_ENTITIES } from '../lib/data/entity-names';

/**
 * THE ACCOUNTS PANEL ADDS A SECTION AND HIDES NONE (#442, #435).
 *
 * A form panel that names a `relatedEntity` without a join field claims every relationship to that
 * entity, and the form then drops its own sections for them. The Accounts panel on the Sales Contact
 * form once named Sales Accounts, which hid "Accounts (default primary contact)" and
 * "Accounts (default billing contact)": the two sections #435 asked to rename. This runs MJ's own
 * resolver over the registered panel and the contact's relationships to Sales Accounts.
 */
const ACCOUNT_ID = 'a0000000-0000-4000-8000-000000000001';

function relationship(joinField: string, sequence: number): FormContributionRelationship {
    return {
        RelatedEntity: MJS_ENTITIES.SalesAccount,
        RelatedEntityID: ACCOUNT_ID,
        RelatedEntityJoinField: joinField,
        DisplayInForm: true,
        Sequence: sequence,
    };
}

function registeredPanel(): FormContributionRegistration {
    const [registration] = MJGlobal.Instance.ClassFactory.GetAllRegistrations(
        BaseFormPanel,
        'form-panel:Sales Contacts:related:Accounts',
    );
    expect(registration, 'the Accounts panel is registered').toBeDefined();
    return {
        Priority: registration.Priority,
        Metadata: registration.Metadata as unknown as FormPanelRegistrationMetadata,
    };
}

describe('the Sales Contact form with the Accounts panel', () => {
    it("still shows the form's default primary and billing contact sections", () => {
        const relationships = [relationship('DefaultPrimaryContactID', 4), relationship('DefaultBillingContactID', 5)];
        // The generated form bakes both sections; a claim would list them as hidden.
        const baked = relationships.map((r) => RelatedEntitySectionKey(r, relationships));
        const resolved = ResolveFormContributions({
            EntityName: MJS_ENTITIES.SalesContact,
            RelatedEntities: relationships,
            IsaChildEntityIDs: [],
            Registrations: [registeredPanel()],
            BakedSectionKeys: baked,
            ShowRelatedEntities: true,
        });
        expect(resolved.HiddenBakedSectionKeys).toEqual([]);
        expect(resolved.Winners.map((w) => w.ContributionKey)).toContain('accounts');
    });
});
