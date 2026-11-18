/**
 * @fileoverview The deal form's Companies panel (golive #484).
 *
 * A deal can involve several companies. The rep lists them here, above "What's being sold"; the list is
 * the deal's `Companies` collection (`DealCompany` rows), saved with the deal in one transaction.
 *
 * Two kinds of company are shown but cannot be removed, because the server would add them straight
 * back (`DealEntityServer`, `RequiredDealCompanyIDs`):
 *
 * - the billing company, `Deal.CompanyID`, which issues the order, invoice and contract. It is still
 *   chosen with the Company picker on the Pipeline panel; a deal with none takes the first company
 *   listed here;
 * - the company of every product already on the deal.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { ChangeDetectorRef, Component, inject, type OnDestroy, type OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LogError, RunView, type RunViewParams } from '@memberjunction/core';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel, BaseFormsModule } from '@memberjunction/ng-base-forms';
import {
    DefaultBillingCompanyID,
    RequiredDealCompanyIDs,
    type DealEntity,
} from '@mj-biz-apps/sales-entities';
import { MJS_ENTITIES, MJS_FOREIGN_ENTITIES } from '../data/entity-names';
import { DealCompanyRows, type DealCompanyRow, type CompanyOption } from './deal-companies';

const SECTION = 'companies';

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-companies',
    skipNullKeyWarning: true,
    metadata: {
        entity: MJS_ENTITIES.Deal, slot: 'after-related', sortKey: 95, contributionKey: SECTION, inclusion: 'Primary',
        relatedEntity: MJS_ENTITIES.DealCompany, relatedJoinField: 'DealID',
    },
})
@Component({
    selector: 'mjs-deal-companies-panel',
    standalone: true,
    imports: [CommonModule, FormsModule, BaseFormsModule],
    // Variant "default", not "related-entity": the form container hides related-entity panels in edit
    // mode, and edit mode is the only time this list can change.
    template: `
        <mj-collapsible-panel SectionKey="companies" SectionName="Companies" Icon="fa-solid fa-building"
            Variant="default" [Form]="FormComponent" [FormContext]="FormContext" [DefaultExpanded]="true"
            [BadgeCount]="Rows.length">
            <div class="mjs-deal-companies" data-testid="deal-companies">
                @if (LoadError) {
                    <p class="mjs-deal-companies__note" role="alert">{{ LoadError }}</p>
                }
                <ul class="mjs-deal-companies__list">
                    @for (row of Rows; track row.CompanyID) {
                        <li class="mjs-deal-companies__chip" [attr.data-company-id]="row.CompanyID">
                            <span>{{ row.Name }}</span>
                            @if (row.IsBilling) {
                                <span class="mjs-deal-companies__tag">Billing</span>
                            } @else if (row.HasProducts) {
                                <span class="mjs-deal-companies__tag">Has products</span>
                            }
                            @if (CanEdit && !row.IsBilling && !row.HasProducts) {
                                <button type="button" class="mjs-deal-companies__remove" [attr.aria-label]="'Remove ' + row.Name"
                                    data-testid="deal-companies-remove" (click)="Remove(row.CompanyID)">
                                    <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                                </button>
                            }
                        </li>
                    } @empty {
                        <li class="mjs-deal-companies__note">No companies yet.</li>
                    }
                </ul>
                @if (CanEdit && AddOptions.length > 0) {
                    <select class="mjs-deal-companies__add" data-testid="deal-companies-add" aria-label="Add a company"
                        [ngModel]="null" (ngModelChange)="Add($event)">
                        <option [ngValue]="null" disabled>Add a company</option>
                        @for (c of AddOptions; track c.ID) {
                            <option [ngValue]="c.ID">{{ c.Name }}</option>
                        }
                    </select>
                }
                <p class="mjs-deal-companies__note">
                    The billing company and the companies of products on the deal are always listed.
                </p>
            </div>
        </mj-collapsible-panel>
    `,
    styles: [`
        .mjs-deal-companies { display: flex; flex-direction: column; gap: var(--mj-space-3); padding: var(--mj-space-4) var(--mj-space-5); }
        .mjs-deal-companies__list { display: flex; flex-wrap: wrap; gap: var(--mj-space-2); margin: 0; padding: 0; list-style: none; }
        .mjs-deal-companies__chip { display: inline-flex; align-items: center; gap: var(--mj-space-2); padding: var(--mj-space-1) var(--mj-space-3);
            border: 1px solid var(--mj-border-default); border-radius: var(--mj-radius-sm); background: var(--mj-bg-surface-card); color: var(--mj-text-primary); }
        .mjs-deal-companies__tag { font-size: var(--mj-text-sm); color: var(--mj-text-muted); }
        .mjs-deal-companies__remove { border: none; background: none; padding: 0; cursor: pointer; color: var(--mj-text-muted); }
        .mjs-deal-companies__add { align-self: flex-start; padding: var(--mj-space-2); border: 1px solid var(--mj-border-default);
            border-radius: var(--mj-radius-sm); background: var(--mj-bg-surface-card); color: var(--mj-text-primary); }
        .mjs-deal-companies__note { margin: 0; color: var(--mj-text-muted); font-size: var(--mj-text-sm); }
    `],
})
export class MJSDealCompaniesPanel extends BaseFormPanel<DealEntity> implements OnInit, OnDestroy {
    private readonly cdr = inject(ChangeDetectorRef);

    /** Every company, by name, for the names and the Add list. */
    public Companies: CompanyOption[] = [];
    /** The company of each product on the deal's order. */
    public LineCompanyIDs: string[] = [];
    public LoadError: string | null = null;

    private subscriptions: Array<{ unsubscribe(): void }> = [];

    public ngOnInit(): void {
        const form = this.FormComponent;
        if (form) {
            this.subscriptions.push(form.RecordSaved.subscribe(() => void this.reload(true)));
            this.subscriptions.push(form.EditModeChanged.subscribe((editing: boolean) => {
                // A cancelled edit reverts the deal's fields but not its collections; put the list back too.
                if (!editing && this.Record?.Companies?.Dirty) void this.reload(true);
            }));
        }
        void this.reload(false);
    }

    public ngOnDestroy(): void {
        this.subscriptions.forEach((s) => s.unsubscribe());
    }

    public override OnRecordRefreshed(): void {
        void this.reload(true);
    }

    /** Editable in edit mode on a deal that is not locked; the close lock covers the rest. */
    public get CanEdit(): boolean {
        const locked = (this.FormComponent as unknown as { IsLocked?: boolean } | undefined)?.IsLocked === true;
        return this.EditMode && !locked && !!this.Record?.Companies;
    }

    /** The companies to show: billing first, then line companies, then the rest the rep listed. */
    public get Rows(): DealCompanyRow[] {
        const listed = (this.Record?.Companies?.Items ?? []).map((c) => c.CompanyID);
        return DealCompanyRows(this.Record?.CompanyID ?? null, this.LineCompanyIDs, listed, this.Companies);
    }

    /** Companies not on the list yet. */
    public get AddOptions(): CompanyOption[] {
        const shown = new Set(this.Rows.map((r) => r.CompanyID.toLowerCase()));
        return this.Companies.filter((c) => !shown.has(c.ID.toLowerCase()));
    }

    public async Add(companyID: string | null): Promise<void> {
        const record = this.Record;
        if (!record || !companyID || !this.CanEdit) return;
        const item = await record.Companies.Create();
        item.CompanyID = companyID;
        const billing = DefaultBillingCompanyID(record.CompanyID, record.Companies.Items.map((c) => c.CompanyID));
        if (billing) record.CompanyID = billing;
        this.cdr.detectChanges();
    }

    public Remove(companyID: string): void {
        const record = this.Record;
        if (!record || !this.CanEdit) return;
        const required = RequiredDealCompanyIDs(record.CompanyID, this.LineCompanyIDs).map((id) => id.toLowerCase());
        if (required.includes(companyID.toLowerCase())) return;
        const item = record.Companies.Items.find((c) => String(c.CompanyID).toLowerCase() === companyID.toLowerCase());
        if (item) record.Companies.Remove(item);
        this.cdr.detectChanges();
    }

    /** Reads the company names, the deal's list and its line companies. `force` re-reads a loaded list. */
    private async reload(force: boolean): Promise<void> {
        const record = this.Record;
        if (!record) return;
        try {
            await this.readCompaniesAndLines(record);
            if (record.IsSaved && record.Companies && (force || !record.Companies.IsLoaded) && !(record.Companies.Dirty && !force)) {
                await record.Companies.Load(force);
            }
            this.LoadError = null;
        } catch (err) {
            LogError(`MJSDealCompaniesPanel: ${err instanceof Error ? err.message : String(err)}`);
            this.LoadError = "The deal's companies could not be read. Reload the deal to try again.";
        }
        this.cdr.detectChanges();
    }

    private async readCompaniesAndLines(record: DealEntity): Promise<void> {
        const params: RunViewParams[] = [
            { EntityName: MJS_FOREIGN_ENTITIES.Company, ResultType: 'simple', Fields: ['ID', 'Name'], OrderBy: 'Name' },
        ];
        if (record.OrderID) {
            params.push({
                EntityName: MJS_FOREIGN_ENTITIES.OrderLine,
                ExtraFilter: `OrderHeaderID = '${record.OrderID}'`,
                ResultType: 'simple',
                Fields: ['CompanyID'],
            });
        }
        const results = await new RunView().RunViews(params);
        if (!results?.every((r) => r?.Success)) {
            throw new Error(results?.find((r) => !r?.Success)?.ErrorMessage ?? 'the reads returned no result');
        }
        this.Companies = (results[0].Results as Array<{ ID: string; Name: string }>).map((c) => ({ ID: String(c.ID), Name: c.Name }));
        this.LineCompanyIDs = results[1]
            ? (results[1].Results as Array<{ CompanyID: string | null }>).map((l) => String(l.CompanyID ?? '')).filter((id) => id.length > 0)
            : [];
    }
}
