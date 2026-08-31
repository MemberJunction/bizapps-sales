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
import { Component } from '@angular/core';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel, BaseFormsModule } from '@memberjunction/ng-base-forms';
import type { AfterDataLoadEventArgs } from '@memberjunction/ng-entity-viewer';
import type { BaseEntity, RunViewParams } from '@memberjunction/core';
import { CommonModule } from '@angular/common';
import { MJS_ENTITIES, MJS_FOREIGN_ENTITIES } from '../data/entity-names';

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
                <mj-explorer-entity-data-grid
                    [Params]="Params"
                    [NewRecordValues]="NewValues"
                    [AllowLoad]="FormComponent.IsSectionExpanded(SectionKey)"
                    [ShowToolbar]="true"
                    (Navigate)="FormComponent.OnFormNavigate($event)"
                    (AfterDataLoad)="OnDataLoad($event)">
                </mj-explorer-entity-data-grid>
            }
        </mj-collapsible-panel>
    `,
})
export class MJSOrganizationDealsPanel extends BaseFormPanel<BaseEntity> {
    public readonly DealEntity = MJS_ENTITIES.Deal;
    public readonly SectionKey = ORG_SECTION;
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
                <mj-explorer-entity-data-grid
                    [Params]="Params"
                    [NewRecordValues]="NewValues"
                    [AllowLoad]="FormComponent.IsSectionExpanded(SectionKey)"
                    [ShowToolbar]="true"
                    (Navigate)="FormComponent.OnFormNavigate($event)"
                    (AfterDataLoad)="OnDataLoad($event)">
                </mj-explorer-entity-data-grid>
            }
        </mj-collapsible-panel>
    `,
})
export class MJSPersonDealsPanel extends BaseFormPanel<BaseEntity> {
    public readonly DealEntity = MJS_ENTITIES.Deal;
    public readonly SectionKey = PERSON_SECTION;
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
            }
        </mj-collapsible-panel>
    `,
})
export class MJSPersonDealTeamPanel extends BaseFormPanel<BaseEntity> {
    public readonly TeamEntity = MJS_ENTITIES.DealTeamMember;
    public readonly SectionKey = TEAM_SECTION;
    public OnDataLoad(event: AfterDataLoadEventArgs): void {
        this.FormComponent.SetSectionRowCount(TEAM_SECTION, event.totalRowCount);
    }
}
