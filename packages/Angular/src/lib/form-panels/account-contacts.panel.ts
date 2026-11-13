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
 * the account, so it would vanish from the list it was added to.
 *
 * "Link person" (#443) writes that Relationship row instead: an existing Sales Contact, From the person
 * To the account, with a person-to-organization type. The picker lists Sales Contacts only; a plain
 * Person who is not a Sales Contact yet is still linked from the person's own form.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel, BaseFormsModule } from '@memberjunction/ng-base-forms';
import type { AfterDataLoadEventArgs } from '@memberjunction/ng-entity-viewer';
import { MJButtonDirective } from '@memberjunction/ng-ui-components';
import { Metadata, RunView, type BaseEntity, type RunViewParams } from '@memberjunction/core';
import type { mjBizAppsCommonRelationshipEntity } from '@mj-biz-apps/common-entities';
import { PartyFieldComponent } from '@mj-biz-apps/common-ng';
import { MJS_ENTITIES, MJS_FOREIGN_ENTITIES } from '../data/entity-names';
import { AccountContactsWhere, ExistingAccountLinkWhere, PERSON_TO_ORGANIZATION_TYPES_WHERE } from './account-contacts';

const EMPTY_STATE_STYLES =
    '.mjs-deal-empty { margin: 0; padding: var(--mj-space-4) var(--mj-space-5); color: var(--mj-text-muted); }';

const LINK_STYLES = `
.mjs-contacts-actions { display: flex; justify-content: flex-end; padding: var(--mj-space-2) var(--mj-space-4); }
.mjs-contacts-link { display: flex; flex-direction: column; gap: var(--mj-space-3); padding: var(--mj-space-4);
    border-bottom: 1px solid var(--mj-border-default); background: var(--mj-bg-surface); }
.mjs-contacts-link__label { display: flex; flex-direction: column; gap: var(--mj-space-1); color: var(--mj-text-secondary);
    font-size: var(--mj-text-sm); }
.mjs-contacts-link__label select { padding: var(--mj-space-2); border: 1px solid var(--mj-border-default);
    border-radius: var(--mj-radius-sm); background: var(--mj-bg-surface-card); color: var(--mj-text-primary); }
.mjs-contacts-link__error { margin: 0; color: var(--mj-status-error-text); }
.mjs-contacts-link__buttons { display: flex; gap: var(--mj-space-2); }
`;

/** The Sales Contacts lookup the Deal form's contact pickers use (`metadata/queries/.party-lookup-contacts.json`). */
const CONTACT_LOOKUP_QUERY = 'Sales: Party Lookup Contacts';

type RelationshipTypeOption = { ID: string; Name: string };

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
    imports: [CommonModule, FormsModule, BaseFormsModule, MJButtonDirective, PartyFieldComponent],
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
                @if (Draft) {
                    <div class="mjs-contacts-link" data-testid="account-contacts-link-form">
                        <bizapps-party-field [Record]="Draft" FieldName="FromPersonID" Kind="Person"
                            [QueryName]="ContactLookupQuery" [EditMode]="true" [AllowCreate]="false"></bizapps-party-field>
                        <label class="mjs-contacts-link__label">
                            Relationship type
                            <select data-testid="account-contacts-link-type" [ngModel]="Draft.RelationshipTypeID"
                                (ngModelChange)="OnTypeChange($event)">
                                <option [ngValue]="null" disabled>Choose a type</option>
                                @for (t of RelationshipTypes; track t.ID) {
                                    <option [ngValue]="t.ID">{{ t.Name }}</option>
                                }
                            </select>
                        </label>
                        @if (LinkError) {
                            <p class="mjs-contacts-link__error" role="alert">{{ LinkError }}</p>
                        }
                        <div class="mjs-contacts-link__buttons">
                            <button type="button" mjButton variant="primary" data-testid="account-contacts-link-save"
                                [disabled]="Saving" (click)="SaveLink()">Link</button>
                            <button type="button" mjButton variant="outline" [disabled]="Saving"
                                (click)="CancelLink()">Cancel</button>
                        </div>
                    </div>
                } @else {
                    <div class="mjs-contacts-actions">
                        <button type="button" mjButton variant="outline" data-testid="account-contacts-link-person"
                            (click)="StartLink()">Link person</button>
                    </div>
                }
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
    styles: [EMPTY_STATE_STYLES, LINK_STYLES],
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
        const accountId = this.accountId();
        if (!accountId) return null;
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

    // ── Link person (#443) ──────────────────────────────────────────────────────────────────────

    public readonly ContactLookupQuery = CONTACT_LOOKUP_QUERY;
    /** The unsaved Relationship the inline form edits; null while the form is closed. */
    public Draft: mjBizAppsCommonRelationshipEntity | null = null;
    public RelationshipTypes: RelationshipTypeOption[] = [];
    public LinkError: string | null = null;
    public Saving = false;
    private readonly cdr = inject(ChangeDetectorRef);

    /** Opens the inline form with a new Relationship From a person To this account. */
    public async StartLink(): Promise<void> {
        const accountId = this.accountId();
        if (!accountId) return;
        this.LinkError = null;
        const draft = await new Metadata().GetEntityObject<mjBizAppsCommonRelationshipEntity>(MJS_FOREIGN_ENTITIES.Relationship);
        draft.NewRecord();
        draft.ToOrganizationID = accountId;
        draft.Status = 'Active';
        this.Draft = draft;
        await this.loadRelationshipTypes();
        this.cdr.detectChanges();
    }

    public OnTypeChange(typeId: string | null): void {
        if (this.Draft && typeId) {
            this.Draft.RelationshipTypeID = typeId;
        }
    }

    public CancelLink(): void {
        this.Draft = null;
        this.LinkError = null;
        this.cdr.detectChanges();
    }

    /** Refuses a missing choice or an existing link, then saves; on success the grid reloads. */
    public async SaveLink(): Promise<void> {
        const draft = this.Draft;
        const accountId = this.accountId();
        if (!draft || !accountId || this.Saving) return;
        this.Saving = true;
        try {
            this.LinkError = await this.linkRefusal(draft, accountId);
            if (!this.LinkError && !(await draft.Save())) {
                this.LinkError = draft.LatestResult?.Message || 'The link was not saved.';
            }
            if (!this.LinkError) {
                this.Draft = null;
                this.cachedFor = null; // a new Params object makes the grid reload
            }
        } finally {
            this.Saving = false;
            this.cdr.detectChanges();
        }
    }

    /** Why the draft cannot be saved, or null. A failed duplicate read refuses rather than guessing. */
    private async linkRefusal(draft: mjBizAppsCommonRelationshipEntity, accountId: string): Promise<string | null> {
        if (!draft.FromPersonID) return 'Choose the person to link.';
        if (!draft.RelationshipTypeID) return 'Choose a relationship type.';
        const existing = await new RunView().RunView<{ ID: string }>({
            EntityName: MJS_FOREIGN_ENTITIES.Relationship,
            ExtraFilter: ExistingAccountLinkWhere(draft.FromPersonID, accountId),
            ResultType: 'simple',
            Fields: ['ID'],
            MaxRows: 1,
        });
        if (!existing.Success) return `Could not check for an existing link: ${existing.ErrorMessage}`;
        return (existing.Results ?? []).length > 0 ? 'This person is already linked to this account.' : null;
    }

    private async loadRelationshipTypes(): Promise<void> {
        const types = await new RunView().RunView<RelationshipTypeOption>({
            EntityName: MJS_FOREIGN_ENTITIES.RelationshipType,
            ExtraFilter: PERSON_TO_ORGANIZATION_TYPES_WHERE,
            OrderBy: 'Name',
            ResultType: 'simple',
            Fields: ['ID', 'Name'],
        });
        this.RelationshipTypes = types.Success ? (types.Results ?? []) : [];
        if (!types.Success) {
            this.LinkError = `Could not load relationship types: ${types.ErrorMessage}`;
        }
    }

    private accountId(): string | null {
        const id = this.Record?.Get?.('ID');
        return id ? String(id) : null;
    }
}
