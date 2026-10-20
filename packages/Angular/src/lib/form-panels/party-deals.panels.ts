/**
 * @fileoverview Deals on Common's Person and Organization forms.
 *
 * Orders' pattern (`person-orders.panel.ts`): `@RegisterClassEx(BaseFormPanel)` against
 * `MJ_BizApps_Common: People` / `Organizations`, `relatedEntity` so the contribution replaces a
 * baked grid if one exists, `mj-collapsible-panel` + `mj-explorer-entity-data-grid`, navigate via
 * the HOST form. Common is not modified. Sales Accounts is an IsA child of Organizations, so
 * `Deal.AccountID` equals the Organization ID (TPT). Sales Contacts is an IsA child of People, so
 * `PrimaryContactID` / `BillingContactID` equal the Person ID.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { Component, Directive, DoCheck, signal } from '@angular/core';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel, BaseFormsModule } from '@memberjunction/ng-base-forms';
import type { AfterDataLoadEventArgs } from '@memberjunction/ng-entity-viewer';
import { RunView, type BaseEntity, type RunViewParams } from '@memberjunction/core';
import { CommonModule } from '@angular/common';
import { MJS_ENTITIES, MJS_FOREIGN_ENTITIES } from '../data/entity-names';

const EMPTY_STATE_STYLES =
    '.mjs-deal-empty { margin: 0; padding: var(--mj-space-4) var(--mj-space-5); color: var(--mj-text-muted); }';

/** Reads whether a row exists in an entity by ID. A seam so the gate tests without a provider. */
export type PartyRowReader = (entityName: string, id: string) => Promise<boolean | null>;

/**
 * Whether the Sales Account or Sales Contact row exists for this ID: true, false, or null when the read
 * failed. IsA means it shares the Organization's or Person's ID, so one read by ID answers it.
 */
export async function SalesPartyRowExists(entityName: string, id: string): Promise<boolean | null> {
    const result = await new RunView().RunView<{ ID: string }>({
        EntityName: entityName,
        ExtraFilter: `ID = '${id.replace(/'/g, "''")}'`,
        ResultType: 'simple',
        Fields: ['ID'],
    });
    if (!result?.Success) return null;
    return (result.Results ?? []).length > 0;
}

/**
 * ── NEW IS OFFERED ONLY WHERE A DEAL CAN BE SAVED ─────────────────────────────────────────────
 *
 * The Deals panel shows on every Organization and Person, and its New pre-fills the record's ID as
 * the deal's customer or contact. The server accepts only Sales Accounts and Sales Contacts, so on a
 * record that is neither the rep filled in a deal that could not be saved. The panel reads once per
 * record whether the sales row exists, hides New when it does not, and says why. Until the read
 * answers, New stays hidden; a read that FAILS leaves New shown, and the server's refusal then names
 * the case.
 */
@Directive()
abstract class SalesPartyDealsPanel extends BaseFormPanel<BaseEntity> implements DoCheck {
    /** The sales entity that extends this record (IsA). */
    protected abstract readonly SalesEntity: string;

    /** True when New may be offered, false when the record is not set up for sales, null while unknown. */
    public readonly CanCreateDeal = signal<boolean | null>(null);

    /** Replaced in tests. */
    public ReadPartyRow: PartyRowReader = SalesPartyRowExists;

    private checkedID: string | null = null;

    public ngDoCheck(): void {
        if (this.recordID() !== this.checkedID) {
            void this.CheckSalesParty();
        }
    }

    /** Reads once per record ID; a later ID starts a new read and the earlier answer is discarded. */
    public async CheckSalesParty(): Promise<void> {
        const id = this.recordID();
        if (id === this.checkedID) return;
        this.checkedID = id;
        this.CanCreateDeal.set(null);
        if (!id) return;
        const exists = await this.ReadPartyRow(this.SalesEntity, id);
        if (this.checkedID === id) {
            this.CanCreateDeal.set(exists !== false);
        }
    }

    private recordID(): string | null {
        const raw = this.Record?.IsSaved ? this.Record.Get?.('ID') : null;
        return raw ? String(raw) : null;
    }
}

const ORG_SECTION = 'deals';
const PERSON_SECTION = 'deals';
const TEAM_SECTION = 'deal-team';

@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:Organizations:related:Deals',
    priority: 10,
    metadata: {
        entity: MJS_FOREIGN_ENTITIES.Organization,
        slot: 'after-related',
        sortKey: 65,
        relatedEntity: MJS_ENTITIES.Deal,
        relatedJoinField: 'AccountID',
        contributionKey: ORG_SECTION,
        inclusion: 'Primary',
    },
})
@Component({
    standalone: true,
    selector: 'mjs-organization-deals-panel',
    imports: [CommonModule, BaseFormsModule],
    template: `
        <mj-collapsible-panel
            SectionKey="deals"
            SectionName="Deals"
            Icon="fa-solid fa-handshake"
            Variant="related-entity"
            [Form]="FormComponent"
            [FormContext]="FormContext"
            [DefaultExpanded]="false">
            @if (Record.IsSaved) {
                @if (CanCreateDeal() === false) {
                    <p class="mjs-deal-empty" data-testid="party-deals-not-sales">Not a sales customer. Add it as an account to create deals.</p>
                }
                <mj-explorer-entity-data-grid
                    [Params]="Params"
                    [NewRecordValues]="NewValues"
                    [ShowNewButton]="CanCreateDeal() === true"
                    [AllowLoad]="FormComponent.IsSectionExpanded(SectionKey)"
                    [ShowToolbar]="true"
                    (Navigate)="FormComponent.OnFormNavigate($event)"
                    (AfterDataLoad)="OnDataLoad($event)">
                </mj-explorer-entity-data-grid>
            } @else {
                <p class="mjs-deal-empty">Save the organization first. Deals are linked to it once it exists.</p>
            }
        </mj-collapsible-panel>
    `,
    styles: [EMPTY_STATE_STYLES],
})
export class MJSOrganizationDealsPanel extends SalesPartyDealsPanel {
    public readonly DealEntity = MJS_ENTITIES.Deal;
    public readonly SectionKey = ORG_SECTION;
    protected readonly SalesEntity = MJS_ENTITIES.SalesAccount;
    /**
     * `AccountID` points at Sales Accounts, an IsA child of Organizations. TPT means the child
     * ID equals the Organization ID, so filtering Deal.AccountID to this org's ID is correct
     * without a relationship row from Organizations → Deals (that FK is not declared on Common).
     */
    public get Params(): RunViewParams | null {
        const id = this.Record?.Get?.('ID');
        if (!id) return null;
        return { EntityName: MJS_ENTITIES.Deal, ExtraFilter: `AccountID = '${String(id).replace(/'/g, "''")}'` };
    }
    public get NewValues(): Record<string, unknown> {
        const id = this.Record?.Get?.('ID');
        return id ? { AccountID: String(id) } : {};
    }
    public OnDataLoad(event: AfterDataLoadEventArgs): void {
        this.FormComponent.SetSectionRowCount(ORG_SECTION, event.totalRowCount);
    }
}

@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:People:related:Deals',
    priority: 10,
    metadata: {
        entity: MJS_FOREIGN_ENTITIES.Person,
        slot: 'after-related',
        sortKey: 65,
        relatedEntity: MJS_ENTITIES.Deal,
        contributionKey: PERSON_SECTION,
        inclusion: 'Primary',
    },
})
@Component({
    standalone: true,
    selector: 'mjs-person-deals-panel',
    imports: [CommonModule, BaseFormsModule],
    template: `
        <mj-collapsible-panel
            SectionKey="deals"
            SectionName="Deals"
            Icon="fa-solid fa-handshake"
            Variant="related-entity"
            [Form]="FormComponent"
            [FormContext]="FormContext"
            [DefaultExpanded]="false">
            @if (Record.IsSaved) {
                @if (CanCreateDeal() === false) {
                    <p class="mjs-deal-empty" data-testid="party-deals-not-sales">Not a sales contact. Add them as a contact to create deals.</p>
                }
                <mj-explorer-entity-data-grid
                    [Params]="Params"
                    [NewRecordValues]="NewValues"
                    [ShowNewButton]="CanCreateDeal() === true"
                    [AllowLoad]="FormComponent.IsSectionExpanded(SectionKey)"
                    [ShowToolbar]="true"
                    (Navigate)="FormComponent.OnFormNavigate($event)"
                    (AfterDataLoad)="OnDataLoad($event)">
                </mj-explorer-entity-data-grid>
            } @else {
                <p class="mjs-deal-empty">Save the person first. Deals are linked to them once they exist.</p>
            }
        </mj-collapsible-panel>
    `,
    styles: [EMPTY_STATE_STYLES],
})
export class MJSPersonDealsPanel extends SalesPartyDealsPanel {
    public readonly DealEntity = MJS_ENTITIES.Deal;
    public readonly SectionKey = PERSON_SECTION;
    protected readonly SalesEntity = MJS_ENTITIES.SalesContact;
    /**
     * Primary/Billing contact FKs point at Sales Contacts (IsA of People). TPT: contact ID = person ID.
     */
    public get Params(): RunViewParams | null {
        const id = this.Record?.Get?.('ID');
        if (!id) return null;
        const lit = String(id).replace(/'/g, "''");
        return {
            EntityName: MJS_ENTITIES.Deal,
            ExtraFilter: `PrimaryContactID = '${lit}' OR BillingContactID = '${lit}'`,
        };
    }
    public get NewValues(): Record<string, unknown> {
        const id = this.Record?.Get?.('ID');
        return id ? { PrimaryContactID: String(id) } : {};
    }
    public OnDataLoad(event: AfterDataLoadEventArgs): void {
        this.FormComponent.SetSectionRowCount(PERSON_SECTION, event.totalRowCount);
    }
}

@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:People:related:DealTeamMembers',
    priority: 10,
    metadata: {
        entity: MJS_FOREIGN_ENTITIES.Person,
        slot: 'after-related',
        sortKey: 55,
        relatedEntity: MJS_ENTITIES.DealTeamMember,
        relatedJoinField: 'PersonID',
        contributionKey: TEAM_SECTION,
        inclusion: 'More',
    },
})
@Component({
    standalone: true,
    selector: 'mjs-person-deal-team-panel',
    imports: [CommonModule, BaseFormsModule],
    template: `
        <mj-collapsible-panel
            SectionKey="deal-team"
            SectionName="Deal team"
            Icon="fa-solid fa-users"
            Variant="related-entity"
            [Form]="FormComponent"
            [FormContext]="FormContext"
            [DefaultExpanded]="false">
            @if (Record.IsSaved) {
                <mj-explorer-entity-data-grid
                    [Params]="FormComponent.BuildRelationshipViewParamsByEntityName(TeamEntity, 'PersonID')"
                    [NewRecordValues]="FormComponent.NewRecordValues(TeamEntity, 'PersonID')"
                    [AllowLoad]="FormComponent.IsSectionExpanded(SectionKey)"
                    [ShowToolbar]="true"
                    (Navigate)="FormComponent.OnFormNavigate($event)"
                    (AfterDataLoad)="OnDataLoad($event)">
                </mj-explorer-entity-data-grid>
            } @else {
                <p class="mjs-deal-empty">Save the person first. Their role on a deal is recorded once they exist.</p>
            }
        </mj-collapsible-panel>
    `,
    styles: [EMPTY_STATE_STYLES],
})
export class MJSPersonDealTeamPanel extends BaseFormPanel<BaseEntity> {
    public readonly TeamEntity = MJS_ENTITIES.DealTeamMember;
    public readonly SectionKey = TEAM_SECTION;
    public OnDataLoad(event: AfterDataLoadEventArgs): void {
        this.FormComponent.SetSectionRowCount(TEAM_SECTION, event.totalRowCount);
    }
}
