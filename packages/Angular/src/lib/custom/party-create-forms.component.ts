/**
 * @fileoverview Sales Account and Sales Contact forms — the create card (bc-aidp-next-golive#435).
 *
 * A new account or contact opened the generated form, whose one "Details" section lists every column
 * of the record and of the Organization or Person it extends. While the record is new these forms hide
 * that section; the create card (`form-panels/party-create.panel.ts`) asks for the agreed fields first
 * and keeps the rest under "More details". A saved record shows the generated layout unchanged, which
 * is why these classes reuse the generated templates rather than forking them.
 *
 * The account form also saves onto an existing Organization when the card picked one, and the contact
 * form links the new contact to the account the card picked. Both live here because both have to run
 * from the form's own Save.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { Component } from '@angular/core';
import { CompositeKey, type BaseEntity } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent, type FormContext } from '@memberjunction/ng-base-forms';

import { mjBizAppsSalesSalesAccountFormComponent } from '../generated/Entities/mjBizAppsSalesSalesAccount/mjbizappssalessalesaccount.form.component';
import { mjBizAppsSalesSalesContactFormComponent } from '../generated/Entities/mjBizAppsSalesSalesContact/mjbizappssalessalescontact.form.component';
import { MJS_ENTITIES } from '../data/entity-names';
import { LinkContactToAccount, OwnAccountValues, SalesAccountFromOrganization } from '../form-panels/party-create-data';
import type { PartyPick } from '../form-panels/party-search.component';

/** The generated forms' one field section, replaced by the create card while the record is new. */
export const GENERATED_DETAILS_SECTION = 'details';

/** The form context with the generated Details section hidden while the record is unsaved. */
export function CreateCardContext(context: FormContext, record: BaseEntity | null | undefined): FormContext {
    if (!record || record.IsSaved) return context;
    return { ...context, hiddenSectionKeys: [...(context.hiddenSectionKeys ?? []), GENERATED_DETAILS_SECTION] };
}

/** See `deal-stage-event-form.component.ts` for why the priority is explicit rather than import-order. */
@RegisterClass(BaseFormComponent, MJS_ENTITIES.SalesAccount, 2)
@Component({
    standalone: false,
    selector: 'mjs-sales-account-form',
    templateUrl: '../generated/Entities/mjBizAppsSalesSalesAccount/mjbizappssalessalesaccount.form.component.html',
})
export class SalesAccountFormComponentExtended extends mjBizAppsSalesSalesAccountFormComponent {
    /** The existing Organization the new account is for, picked on the create card. */
    public ExistingOrganization: PartyPick | null = null;

    public override get formContext(): FormContext {
        return CreateCardContext(super.formContext, this.record);
    }

    /**
     * With an existing Organization picked, Save adds the account to it instead of inserting a second
     * Organization, then opens the saved account and closes this new-record tab. The host only follows
     * the record it created, so the saved account is opened by navigation.
     */
    public override async SaveRecord(StopEditModeAfterSave: boolean): Promise<boolean> {
        if (!this.ExistingOrganization || this.record?.IsSaved) {
            return super.SaveRecord(StopEditModeAfterSave);
        }
        const result = await SalesAccountFromOrganization(this.ExistingOrganization.ID, OwnAccountValues(this.record));
        if (!result.Success || !result.ID) {
            this.Notification.emit({ Message: `Save failed: ${result.Message}`, Type: 'error', Duration: 6000 });
            return false;
        }
        this.Notification.emit({ Message: 'Sales account saved', Type: 'success', Duration: 2500 });
        this.record.Revert();
        this.Navigate.emit({ Kind: 'record', EntityName: MJS_ENTITIES.SalesAccount, PrimaryKey: CompositeKey.FromID(result.ID) });
        this.Navigate.emit({ Kind: 'dismiss', Reason: 'new-record-discarded' });
        return true;
    }
}

@RegisterClass(BaseFormComponent, MJS_ENTITIES.SalesContact, 2)
@Component({
    standalone: false,
    selector: 'mjs-sales-contact-form',
    templateUrl: '../generated/Entities/mjBizAppsSalesSalesContact/mjbizappssalessalescontact.form.component.html',
})
export class SalesContactFormComponentExtended extends mjBizAppsSalesSalesContactFormComponent {
    /** The account the new contact works at, picked on the create card. */
    public Account: PartyPick | null = null;
    /** How the contact relates to that account (a Person-to-Organization relationship type). */
    public RelationshipTypeID: string | null = null;

    public override get formContext(): FormContext {
        return CreateCardContext(super.formContext, this.record);
    }

    /** Refuses an account with no relationship type before anything is written. */
    public override async SaveRecord(StopEditModeAfterSave: boolean): Promise<boolean> {
        if (this.Account && !this.RelationshipTypeID && !this.record?.IsSaved) {
            this.Notification.emit({ Message: `Choose how the contact relates to ${this.Account.Name}.`, Type: 'warning', Duration: 6000 });
            return false;
        }
        return super.SaveRecord(StopEditModeAfterSave);
    }

    /**
     * Saves the contact, then links it to the picked account. The link needs the contact's ID, so it
     * follows the save; a failed link leaves the contact saved and says so.
     */
    protected override async InternalSaveRecord(): Promise<boolean> {
        const wasNew = !this.record?.IsSaved;
        const saved = await super.InternalSaveRecord();
        if (saved && wasNew && this.Account && this.RelationshipTypeID) {
            await this.linkAccount(this.Account, this.RelationshipTypeID);
        }
        return saved;
    }

    private async linkAccount(account: PartyPick, relationshipTypeID: string): Promise<void> {
        const title = (this.record.Get('Title') as string | null) ?? null;
        const result = await LinkContactToAccount(String(this.record.Get('ID')), account.ID, relationshipTypeID, title);
        if (!result.Success) {
            this.Notification.emit({
                Message: `The contact was saved, but not linked to ${account.Name}: ${result.Message}`,
                Type: 'warning',
                Duration: 8000,
            });
            return;
        }
        this.Account = null;
        this.RelationshipTypeID = null;
    }
}

/** Anti-tree-shaking anchor. */
export function LoadPartyCreateForms(): void {
    /* keeps the registrations alive */
}
