/**
 * @fileoverview The create cards on new Sales Account and Sales Contact forms (bc-aidp-next-golive#435).
 *
 * Drawn only while the record is new; the forms (`custom/party-create-forms.component.ts`) hide the
 * generated Details section for the same span. Each card asks for the agreed fields first and keeps
 * every other field the user may set under a collapsed "More details", with the field's metadata
 * description as help text.
 *
 * The account card starts with a search over existing Organizations: an account for an organization
 * that exists already is that organization's account, so it inherits every Organization field instead
 * of re-typing them into a duplicate. The contact card adds the account the contact works at.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { ChangeDetectorRef, Component, ViewEncapsulation, inject, type OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RegisterClassEx } from '@memberjunction/global';
import { CompositeKey, type BaseEntity, type EntityInfo } from '@memberjunction/core';
import { BaseFormPanel, BaseFormsModule } from '@memberjunction/ng-base-forms';
import { PartyFieldComponent } from '@mj-biz-apps/common-ng';

import { MJS_ENTITIES } from '../data/entity-names';
import { SalesAccountFormComponentExtended, SalesContactFormComponentExtended } from '../custom/party-create-forms.component';
import {
    ACCOUNT_CREATE_FIELDS,
    ACCOUNT_ORGANIZATION_FIELDS,
    CONTACT_CREATE_FIELDS,
    CreateFields,
    MoreDetailFields,
    type CreateFieldSpec,
} from './party-create';
import { IsSalesAccount, PersonToOrganizationTypes, type RelationshipTypeOption } from './party-create-data';
import { MJSPartySearchComponent, type PartyPick } from './party-search.component';

/** Foreign keys drawn with common's party search rather than an unfiltered dropdown of every organization. */
const PARTY_SEARCH_FIELDS: ReadonlySet<string> = new Set(['ParentID']);

const CARD_STYLES = `
    .mjs-create-card { display: flex; flex-direction: column; gap: var(--mj-space-4); padding: var(--mj-space-4) var(--mj-space-5); }
    .mjs-create-card__fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--mj-space-3) var(--mj-space-4); }
    /* The deal form's field look (label above the control), scoped here so the card does not depend
       on the deal panels' stylesheet having loaded first. */
    .mjs-create-card .mjs-field { min-width: 0; }
    .mjs-create-card .mjs-field .mj-forms-field { display: flex; flex-direction: column; align-items: stretch; gap: 4px; padding: 0; }
    .mjs-create-card .mjs-field .mj-forms-field-label {
        font-size: var(--mj-text-xs); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--mj-text-muted);
    }
    .mjs-create-card .mj-forms-field--editing:hover { margin: 0; padding: 0; }
    .mjs-create-card select {
        padding: var(--mj-space-2) var(--mj-space-3); border: 1px solid var(--mj-border-default);
        border-radius: var(--mj-radius-md); background: var(--mj-bg-surface); color: var(--mj-text-primary); font: inherit;
    }
    .mjs-create-card__help { margin: var(--mj-space-1) 0 0; color: var(--mj-text-muted); font-size: var(--mj-text-sm); }
    .mjs-create-card__picked {
        display: flex; align-items: center; justify-content: space-between; gap: var(--mj-space-3);
        padding: var(--mj-space-3) var(--mj-space-4); border: 1px solid var(--mj-border-default); border-radius: var(--mj-radius-md);
    }
    .mjs-create-card__picked p { margin: 0; }
    .mjs-create-card__muted { color: var(--mj-text-muted); }
    .mjs-create-card__more { padding: var(--mj-space-2) var(--mj-space-4); }
`;

const FIELD_GRID = `
    <div class="mjs-create-card__fields">
        @for (f of Fields; track f.Name) {
            <div class="mjs-field" [attr.data-field]="f.Name">
                @if (PartySearchField(f)) {
                    <bizapps-party-field [Record]="Record" [FieldName]="f.Name" Kind="Organization"
                        [EditMode]="FormComponent.EditMode" [FormContext]="FormContext"></bizapps-party-field>
                } @else {
                    <mj-form-field [Record]="Record" [ShowLabel]="true" [FieldName]="f.Name" [Type]="f.Type"
                        [LinkType]="f.LinkType" [EditMode]="FormComponent.EditMode" [FormContext]="FormContext"></mj-form-field>
                }
            </div>
        }
    </div>
`;

const MORE_DETAILS = `
    <mj-collapsible-panel SectionKey="create-more-details" SectionName="More details" Icon="fa-solid fa-list"
        [Form]="FormComponent" [FormContext]="FormContext" [DefaultExpanded]="false">
        <div class="mjs-create-card__fields mjs-create-card__more">
            @for (f of MoreFields; track f.Name) {
                <div class="mjs-field" [attr.data-field]="f.Name">
                    <mj-form-field [Record]="Record" [ShowLabel]="true" [FieldName]="f.Name" [Type]="f.Type"
                        [LinkType]="f.LinkType" [EditMode]="FormComponent.EditMode" [FormContext]="FormContext"></mj-form-field>
                    @if (f.Help) { <p class="mjs-create-card__help">{{ f.Help }}</p> }
                </div>
            }
        </div>
    </mj-collapsible-panel>
`;

/** What both cards share: the field lists, read once from the record's entity. */
abstract class PartyCreatePanelBase extends BaseFormPanel<BaseEntity> {
    protected readonly cdr = inject(ChangeDetectorRef);
    public Fields: CreateFieldSpec[] = [];
    public MoreFields: CreateFieldSpec[] = [];

    protected entity(): EntityInfo | null {
        return this.Record?.EntityInfo ?? null;
    }

    public PartySearchField(f: CreateFieldSpec): boolean {
        return PARTY_SEARCH_FIELDS.has(f.Name);
    }
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:account-create',
    skipNullKeyWarning: true,
    metadata: { entity: MJS_ENTITIES.SalesAccount, slot: 'before-fields', sortKey: 10, contributionKey: 'create-card' },
})
@Component({
    selector: 'mjs-account-create-panel',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, BaseFormsModule, PartyFieldComponent, MJSPartySearchComponent],
    template: `
        @if (!Record.IsSaved) {
            <section class="mjs-create-card" data-testid="account-create-card">
                @if (Organization; as org) {
                    <div class="mjs-create-card__picked" data-testid="account-create-organization">
                        <p>For the existing organization <strong>{{ org.Name }}</strong>
                            @if (org.Detail) { <span class="mjs-create-card__muted">({{ org.Detail }})</span> }.
                            Its name, website, phone and parent come from the organization.</p>
                        <button type="button" class="mj-btn mj-btn-secondary" (click)="ClearOrganization()">Use a new organization</button>
                    </div>
                } @else {
<div class="mjs-field">
                    <mjs-party-search Kind="Organization" InputID="mjs-account-create-organization"
                        Label="Start from an existing organization"
                        Placeholder="Search organizations by name or website"
                        (Picked)="PickOrganization($event)"></mjs-party-search>
                    </div>
                    @if (AlreadyAccount; as existing) {
                        <div class="mjs-create-card__picked" role="status">
                            <p>{{ existing.Name }} is already a sales account.</p>
                            <button type="button" class="mj-btn mj-btn-primary" (click)="OpenAccount(existing)">Open it</button>
                        </div>
                    }
                }
                ${FIELD_GRID}
                ${MORE_DETAILS}
            </section>
        }
    `,
    styles: [CARD_STYLES],
})
export class MJSAccountCreatePanel extends PartyCreatePanelBase implements OnInit {
    public AlreadyAccount: PartyPick | null = null;

    private get form(): SalesAccountFormComponentExtended | null {
        return this.FormComponent instanceof SalesAccountFormComponentExtended ? this.FormComponent : null;
    }

    public get Organization(): PartyPick | null {
        return this.form?.ExistingOrganization ?? null;
    }

    public ngOnInit(): void {
        this.refreshFields();
    }

    /** An organization that is already a sales account is opened, not added twice. */
    public async PickOrganization(org: PartyPick): Promise<void> {
        this.AlreadyAccount = null;
        if (await IsSalesAccount(org.ID)) {
            this.AlreadyAccount = org;
        } else if (this.form) {
            this.form.ExistingOrganization = org;
        }
        this.refreshFields();
        this.cdr.detectChanges();
    }

    public ClearOrganization(): void {
        if (this.form) this.form.ExistingOrganization = null;
        this.refreshFields();
        this.cdr.detectChanges();
    }

    public OpenAccount(account: PartyPick): void {
        this.FormComponent.OnFormNavigate({
            Kind: 'record',
            EntityName: MJS_ENTITIES.SalesAccount,
            PrimaryKey: CompositeKey.FromID(account.ID),
        });
    }

    /** With an organization picked, only the account's own fields are asked for. */
    private refreshFields(): void {
        const entity = this.entity();
        if (!entity) return;
        const own = !!this.Organization;
        const first = own ? ACCOUNT_CREATE_FIELDS.filter((n) => !ACCOUNT_ORGANIZATION_FIELDS.includes(n)) : ACCOUNT_CREATE_FIELDS;
        this.Fields = CreateFields(entity, first);
        this.MoreFields = MoreDetailFields(entity, ACCOUNT_CREATE_FIELDS).filter((f) => !own || !this.inherited(entity, f));
    }

    private inherited(entity: EntityInfo, f: CreateFieldSpec): boolean {
        return entity.Fields.find((x) => x.Name === f.Name)?.IsVirtual === true;
    }
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:contact-create',
    skipNullKeyWarning: true,
    metadata: { entity: MJS_ENTITIES.SalesContact, slot: 'before-fields', sortKey: 10, contributionKey: 'create-card' },
})
@Component({
    selector: 'mjs-contact-create-panel',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, FormsModule, BaseFormsModule, PartyFieldComponent, MJSPartySearchComponent],
    template: `
        @if (!Record.IsSaved) {
            <section class="mjs-create-card" data-testid="contact-create-card">
                ${FIELD_GRID}
                @if (Account; as account) {
                    <div class="mjs-create-card__picked" data-testid="contact-create-account">
                        <p>Works at <strong>{{ account.Name }}</strong></p>
                        <button type="button" class="mj-btn mj-btn-secondary" (click)="ClearAccount()">Change</button>
                    </div>
                    <div class="mjs-field"><div class="mj-forms-field mj-forms-field--editing">
                        <label class="mj-forms-field-label" for="mjs-contact-create-relationship">Relationship to {{ account.Name }}</label>
                        <select id="mjs-contact-create-relationship" [ngModel]="RelationshipTypeID"
                                (ngModelChange)="SetRelationshipType($event)" data-testid="contact-create-relationship">
                            <option [ngValue]="null">Choose…</option>
                            @for (t of RelationshipTypes; track t.ID) { <option [ngValue]="t.ID">{{ t.Name }}</option> }
                        </select>
                    </div></div>
                } @else {
<div class="mjs-field">
                    <mjs-party-search Kind="Organization" QueryName="Sales: Party Lookup Accounts" CategoryPath="Sales"
                        InputID="mjs-contact-create-account" Label="Account"
                        Placeholder="Search sales accounts by name or website"
                        (Picked)="PickAccount($event)"></mjs-party-search>
                    </div>
                }
                ${MORE_DETAILS}
            </section>
        }
    `,
    styles: [CARD_STYLES],
})
export class MJSContactCreatePanel extends PartyCreatePanelBase implements OnInit {
    public RelationshipTypes: RelationshipTypeOption[] = [];

    private get form(): SalesContactFormComponentExtended | null {
        return this.FormComponent instanceof SalesContactFormComponentExtended ? this.FormComponent : null;
    }

    public get Account(): PartyPick | null {
        return this.form?.Account ?? null;
    }

    public get RelationshipTypeID(): string | null {
        return this.form?.RelationshipTypeID ?? null;
    }

    public ngOnInit(): void {
        const entity = this.entity();
        if (!entity) return;
        this.Fields = CreateFields(entity, CONTACT_CREATE_FIELDS);
        this.MoreFields = MoreDetailFields(entity, CONTACT_CREATE_FIELDS);
    }

    /** The relationship types are read when an account is first picked, not on every new contact. */
    public async PickAccount(account: PartyPick): Promise<void> {
        if (!this.form) return;
        this.form.Account = account;
        if (this.RelationshipTypes.length === 0) {
            this.RelationshipTypes = await PersonToOrganizationTypes();
        }
        this.cdr.detectChanges();
    }

    public ClearAccount(): void {
        if (!this.form) return;
        this.form.Account = null;
        this.form.RelationshipTypeID = null;
        this.cdr.detectChanges();
    }

    public SetRelationshipType(id: string | null): void {
        if (this.form) this.form.RelationshipTypeID = id;
    }
}
