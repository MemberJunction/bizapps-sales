/**
 * @fileoverview Contacts on the Sales Account form (bizapps-sales#301).
 *
 * The generated Sales Account form shows Details and Deals only. Common draws an organization's
 * Relationships on its own Organizations form, but a panel registered on a parent entity is not drawn
 * on an IsA child's form, so opening an account from a deal showed nobody who works there.
 *
 * Same shape as `party-deals.panels.ts`: `mj-collapsible-panel` + `mj-explorer-entity-data-grid`,
 * navigating through the host form. The rows are Sales Contacts, so a click opens the contact. There is
 * no New button: a contact created from this grid would not get the Relationship row that puts it on
 * the account, so it would vanish from the list it was added to. People are linked from the person.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { Component } from '@angular/core';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel, BaseFormsModule } from '@memberjunction/ng-base-forms';
import type { AfterDataLoadEventArgs } from '@memberjunction/ng-entity-viewer';
import { Metadata, type BaseEntity, type RunViewParams } from '@memberjunction/core';
import { CommonModule } from '@angular/common';
import { MJS_ENTITIES, MJS_FOREIGN_ENTITIES } from '../data/entity-names';
import { AccountContactsWhere } from './account-contacts';

const EMPTY_STATE_STYLES =
    '.mjs-deal-empty { margin: 0; padding: var(--mj-space-4) var(--mj-space-5); color: var(--mj-text-muted); }';

const SECTION = 'contacts';

@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:Sales Accounts:related:Contacts',
    priority: 10,
    metadata: {
        entity: MJS_ENTITIES.SalesAccount,
        slot: 'after-related',
        sortKey: 60,
        relatedEntity: MJS_ENTITIES.SalesContact,
        contributionKey: SECTION,
        inclusion: 'Primary',
    },
})
@Component({
    standalone: true,
    selector: 'mjs-account-contacts-panel',
    imports: [CommonModule, BaseFormsModule],
    template: `
        <mj-collapsible-panel
            SectionKey="contacts"
            SectionName="Contacts"
            Icon="fa-solid fa-address-book"
            Variant="related-entity"
            [Form]="FormComponent"
            [FormContext]="FormContext"
            [DefaultExpanded]="false">
            @if (Record.IsSaved) {
                <mj-explorer-entity-data-grid
                    [Params]="Params"
                    [AllowLoad]="FormComponent.IsSectionExpanded(SectionKey)"
                    [ShowToolbar]="true"
                    [ShowNewButton]="false"
                    (Navigate)="FormComponent.OnFormNavigate($event)"
                    (AfterDataLoad)="OnDataLoad($event)">
                </mj-explorer-entity-data-grid>
            } @else {
                <p class="mjs-deal-empty">Save the account first. People are linked to it once it exists.</p>
            }
        </mj-collapsible-panel>
    `,
    styles: [EMPTY_STATE_STYLES],
})
export class MJSAccountContactsPanel extends BaseFormPanel<BaseEntity> {
    public readonly SectionKey = SECTION;
    private cachedFor: string | null = null;
    private cachedParams: RunViewParams | null = null;

    /**
     * Cached per account ID: the grid reloads when it receives a new object, and a getter that built
     * one on every change-detection pass would make it reload continuously.
     */
    public get Params(): RunViewParams | null {
        const id = this.Record?.Get?.('ID');
        if (!id) return null;
        const accountId = String(id);
        if (this.cachedFor === accountId) return this.cachedParams;
        const relationships = new Metadata().EntityByName(MJS_FOREIGN_ENTITIES.Relationship);
        this.cachedFor = accountId;
        this.cachedParams = relationships
            ? { EntityName: MJS_ENTITIES.SalesContact, ExtraFilter: AccountContactsWhere(accountId, relationships) }
            : null;
        return this.cachedParams;
    }

    public OnDataLoad(event: AfterDataLoadEventArgs): void {
        this.FormComponent.SetSectionRowCount(SECTION, event.totalRowCount);
    }
}
