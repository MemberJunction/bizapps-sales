/**
 * @fileoverview Accounts on the Sales Contact form (#442).
 *
 * The mirror of `account-contacts.panel.ts`. Common draws a person's Relationships on its own People
 * form, but a panel registered on a parent entity is not drawn on an IsA child's form, so a Sales
 * Contact showed no employer. This lists the Sales Accounts on the other end of the contact's active
 * Relationships; a click opens the account. There is no New button: an account created from this grid
 * would not get the Relationship row that puts it here. People are linked from the person.
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
import { ContactAccountsWhere } from './account-contacts';

const EMPTY_STATE_STYLES =
    '.mjs-deal-empty { margin: 0; padding: var(--mj-space-4) var(--mj-space-5); color: var(--mj-text-muted); }';

const SECTION = 'accounts';

@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:Sales Contacts:related:Accounts',
    priority: 10,
    metadata: {
        entity: MJS_ENTITIES.SalesContact,
        slot: 'after-related',
        sortKey: 60,
        relatedEntity: MJS_ENTITIES.SalesAccount,
        contributionKey: SECTION,
        inclusion: 'Primary',
    },
})
@Component({
    standalone: true,
    selector: 'mjs-contact-accounts-panel',
    imports: [CommonModule, BaseFormsModule],
    template: `
        <mj-collapsible-panel
            SectionKey="accounts"
            SectionName="Accounts"
            Icon="fa-solid fa-building"
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
                <p class="mjs-deal-empty">Save the contact first. Accounts are linked to them once they exist.</p>
            }
        </mj-collapsible-panel>
    `,
    styles: [EMPTY_STATE_STYLES],
})
export class MJSContactAccountsPanel extends BaseFormPanel<BaseEntity> {
    public readonly SectionKey = SECTION;
    private cachedFor: string | null = null;
    private cachedParams: RunViewParams | null = null;

    /**
     * Cached per contact ID: the grid reloads when it receives a new object, and a getter that built
     * one on every change-detection pass would make it reload continuously.
     */
    public get Params(): RunViewParams | null {
        const id = this.Record?.Get?.('ID');
        if (!id) return null;
        const contactId = String(id);
        if (this.cachedFor === contactId) return this.cachedParams;
        const relationships = new Metadata().EntityByName(MJS_FOREIGN_ENTITIES.Relationship);
        this.cachedFor = contactId;
        this.cachedParams = relationships
            ? { EntityName: MJS_ENTITIES.SalesAccount, ExtraFilter: ContactAccountsWhere(contactId, relationships) }
            : null;
        return this.cachedParams;
    }

    public OnDataLoad(event: AfterDataLoadEventArgs): void {
        this.FormComponent.SetSectionRowCount(SECTION, event.totalRowCount);
    }
}
