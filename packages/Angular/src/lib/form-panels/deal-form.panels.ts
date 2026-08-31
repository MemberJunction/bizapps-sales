/**
 * @fileoverview Deal form body — Overview plus organized rail sections.
 *
 * Replaces the generated `details` dump (one accordion of every column) with:
 *   Overview (exec briefing) · Pipeline · Account · Commercial · What's being sold
 *   Motion · Close · Internal team · Buying team · Activity · Stage history · Payment schedule
 *
 * `replacesSectionKey: 'details'` hides the generated field list. `contributionKey` equals each
 * panel's `SectionKey` so left-nav rail items attach. Overview is the only `inclusion: 'Primary'`
 * so it leads; the rest sort into the related band by `sortKey` (descending).
 *
 * @module @mj-biz-apps/sales-ng
 */
import { ChangeDetectorRef, Component, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompositeKey, Metadata, RunView, type EntityInfo } from '@memberjunction/core';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel, BaseFormsModule } from '@memberjunction/ng-base-forms';
import { EntityViewerModule, type AfterDataLoadEventArgs, type RecordOpenedEvent } from '@memberjunction/ng-entity-viewer';
import { DealEntity } from '@mj-biz-apps/sales-entities';
import { DealActivityTimelineComponent } from '../activities/deal-activity-timeline.component';
import { SyntheticActivityView } from '../pages/deal-views';
import { MJS_ENTITIES, MJS_FOREIGN_ENTITIES } from '../data/entity-names';

const E = MJS_ENTITIES.Deal;

function money(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    return Number(n).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function daysFrom(d: Date | string | null | undefined): number | null {
    if (!d) return null;
    const iso = d instanceof Date
        ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
        : String(d).slice(0, 10);
    const t = Date.parse(`${iso}T00:00:00Z`);
    if (!Number.isFinite(t)) return null;
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.round((t - today) / 86_400_000);
}

type DealFieldType =
    | 'textbox' | 'textarea' | 'number' | 'datepicker' | 'checkbox'
    | 'select' | 'autocomplete' | 'code' | 'dropdownlist' | 'numerictextbox';

interface DealFieldSpec {
    name: string;
    type: DealFieldType;
    link?: 'Record';
    span?: boolean;
}

const FIELD_STYLES = `
    .mjs-fields {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--mj-space-4) var(--mj-space-5);
        padding: var(--mj-space-4) var(--mj-space-5);
    }
    @media (max-width: 720px) { .mjs-fields { grid-template-columns: 1fr; } }
    .mjs-field { min-width: 0; }
    .mjs-field--span { grid-column: 1 / -1; }
    .mjs-field .mj-forms-field {
        display: flex; flex-direction: column; align-items: stretch; gap: 4px; padding: 0;
    }
    .mjs-field .mj-forms-field-label {
        font-size: var(--mj-text-xs); font-weight: 700; letter-spacing: .06em;
        text-transform: uppercase; color: var(--mj-text-muted);
    }
    .mjs-field .mj-forms-field--editing:hover { margin: 0; padding: 0; }
`;

/* ── Overview ─────────────────────────────────────────────────────────────── */

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-overview',
    skipNullKeyWarning: true,
    metadata: {
        entity: E,
        slot: 'after-fields',
        sortKey: 200,
        contributionKey: 'overview',
        inclusion: 'Primary',
        replacesSectionKey: 'details',
    },
})
@Component({
    selector: 'mjs-deal-overview-panel',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, BaseFormsModule],
    template: `
        <mj-collapsible-panel
            SectionKey="overview"
            SectionName="Overview"
            Icon="fa-solid fa-chart-pie"
            [Form]="FormComponent"
            [FormContext]="FormContext"
            [DefaultExpanded]="true">
            <div class="mjs-ov">
                @if (Health.length) {
                    <div class="mjs-ov-health">
                        @for (h of Health; track h) {
                            <div class="mjs-ov-alert">
                                <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                                {{ h }}
                            </div>
                        }
                    </div>
                } @else if (Record.IsSaved) {
                    <div class="mjs-ov-ok">
                        <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
                        Nothing is asking for a person on this deal.
                    </div>
                }

                <div class="mjs-ov-strip">
                    <div class="mjs-ov-kpi">
                        <div class="l">Amount</div>
                        <div class="v">{{ Money }}</div>
                        <div class="s">{{ Provenance }}</div>
                    </div>
                    <div class="mjs-ov-kpi">
                        <div class="l">Weighted</div>
                        <div class="v">{{ Weighted }}</div>
                        <div class="s">{{ Prob }} probability</div>
                    </div>
                    <div class="mjs-ov-kpi">
                        <div class="l">Forecast</div>
                        <div class="v">{{ G('ForecastCategoryType') || '—' }}</div>
                        <div class="s">{{ G('DealStatusType') || 'No status' }}</div>
                    </div>
                    <div class="mjs-ov-kpi" [attr.data-tone]="CloseClock.tone">
                        <div class="l">Close</div>
                        <div class="v">{{ CloseClock.label }}</div>
                        <div class="s">{{ CloseLabel }}</div>
                    </div>
                </div>

                <div class="mjs-ov-grid">
                    <article class="mjs-ov-card">
                        <header><i class="fa-solid fa-bullseye"></i> Situation</header>
                        <div class="mjs-ov-facts">
                            <div>
                                <div class="l">Account</div>
                                <div class="v">
                                    @if (Record.AccountID && G('Account')) {
                                        <button type="button" class="mjs-ov-link" (click)="OpenAccount($event)">{{ G('Account') }}</button>
                                    } @else { {{ G('Account') || '—' }} }
                                </div>
                            </div>
                            <div>
                                <div class="l">Owner</div>
                                <div class="v">
                                    @if (Record.OwnerEmployeeID && G('OwnerEmployee')) {
                                        <button type="button" class="mjs-ov-link" (click)="OpenOwner($event)">{{ G('OwnerEmployee') }}</button>
                                    } @else { {{ G('OwnerEmployee') || 'Unowned' }} }
                                </div>
                            </div>
                            <div><div class="l">Stage</div><div class="v">{{ G('PipelineStage') || '—' }}</div></div>
                            <div><div class="l">Pipeline</div><div class="v">{{ G('Pipeline') || '—' }}</div></div>
                            <div><div class="l">Type</div><div class="v">{{ G('DealType') || '—' }}</div></div>
                            <div><div class="l">Selling as</div><div class="v">{{ G('Company') || '—' }}</div></div>
                        </div>
                    </article>
                    <article class="mjs-ov-card">
                        <header><i class="fa-solid fa-calendar-day"></i> Timing</header>
                        <div class="mjs-ov-facts">
                            <div><div class="l">Expected close</div><div class="v">{{ CloseLabel }}</div></div>
                            <div><div class="l">Days to close</div><div class="v">{{ DaysToCloseLabel }}</div></div>
                            <div><div class="l">Term</div><div class="v">{{ TermLabel }}</div></div>
                            <div><div class="l">Start</div><div class="v">{{ DateLabel(Record.StartDate) }}</div></div>
                            <div><div class="l">Executed</div><div class="v">{{ DateLabel(Record.ExecutionDate) }}</div></div>
                            <div><div class="l">Actual close</div><div class="v">{{ DateLabel(Record.ActualCloseDate) }}</div></div>
                        </div>
                    </article>
                    <article class="mjs-ov-card mjs-ov-card--wide">
                        <header><i class="fa-solid fa-person-walking"></i> Next move</header>
                        @if (Record.NextStep) {
                            <p class="mjs-ov-next">{{ Record.NextStep }}</p>
                            @if (Record.NextStepDate) {
                                <div class="muted">Due {{ Record.NextStepDate | date: 'd MMM y' }}
                                    @if (NextStepOverdue) { · overdue }
                                </div>
                            }
                        } @else {
                            <p class="mjs-ov-empty">No next step. An AE would put one here — forecast without a next step is a wish.</p>
                        }
                    </article>
                </div>
            </div>
        </mj-collapsible-panel>
    `,
    styles: [`
        .mjs-ov { display: flex; flex-direction: column; gap: var(--mj-space-4); padding: var(--mj-space-3) var(--mj-space-4) var(--mj-space-5); }
        .mjs-ov-health { display: flex; flex-direction: column; gap: var(--mj-space-2); }
        .mjs-ov-alert {
            display: flex; align-items: center; gap: var(--mj-space-2);
            padding: var(--mj-space-2) var(--mj-space-3);
            background: var(--mj-status-warning-bg); color: var(--mj-status-warning-text);
            border-radius: var(--mj-radius-md); font-size: var(--mj-text-sm); font-weight: 600;
        }
        .mjs-ov-ok {
            display: flex; align-items: center; gap: var(--mj-space-2);
            padding: var(--mj-space-2) var(--mj-space-3);
            background: var(--mj-status-success-bg); color: var(--mj-status-success-text);
            border-radius: var(--mj-radius-md); font-size: var(--mj-text-sm); font-weight: 600;
        }
        .mjs-ov-strip {
            display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: var(--mj-space-3);
        }
        @media (max-width: 900px) { .mjs-ov-strip { grid-template-columns: 1fr 1fr; } }
        .mjs-ov-kpi {
            background: var(--mj-bg-page); border: 1px solid var(--mj-border-default);
            border-radius: var(--mj-radius-md); padding: var(--mj-space-3) var(--mj-space-4);
        }
        .mjs-ov-kpi .l {
            font-size: var(--mj-text-xs); text-transform: uppercase; letter-spacing: .04em;
            color: var(--mj-text-muted); font-weight: 700;
        }
        .mjs-ov-kpi .v { font-size: 1.35rem; font-weight: 800; letter-spacing: -.02em; margin-top: 4px; line-height: 1.2; }
        .mjs-ov-kpi .s { color: var(--mj-text-muted); font-size: var(--mj-text-sm); margin-top: 2px; }
        .mjs-ov-kpi[data-tone='warning'] .v { color: var(--mj-status-warning-text); }
        .mjs-ov-kpi[data-tone='success'] .v { color: var(--mj-status-success-text); }
        .mjs-ov-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--mj-space-3); }
        @media (max-width: 800px) { .mjs-ov-grid { grid-template-columns: 1fr; } }
        .mjs-ov-card {
            background: var(--mj-bg-page); border: 1px solid var(--mj-border-default);
            border-radius: var(--mj-radius-md); padding: var(--mj-space-3) var(--mj-space-4);
        }
        .mjs-ov-card--wide { grid-column: 1 / -1; }
        .mjs-ov-card header {
            display: flex; align-items: center; gap: 8px;
            font-weight: 700; margin-bottom: var(--mj-space-3); color: var(--mj-text-primary);
        }
        .mjs-ov-card header i { color: var(--mj-brand-primary); width: 1.1rem; text-align: center; }
        .mjs-ov-facts { display: grid; grid-template-columns: 1fr 1fr; gap: var(--mj-space-3); }
        .mjs-ov-facts .l {
            font-size: var(--mj-text-xs); text-transform: uppercase; letter-spacing: .04em;
            color: var(--mj-text-muted); font-weight: 700;
        }
        .mjs-ov-facts .v { font-weight: 650; margin-top: 2px; }
        .mjs-ov-link {
            border: 0; padding: 0; background: transparent; color: var(--mj-text-link);
            cursor: pointer; font: inherit; font-weight: 650; text-align: left;
        }
        .mjs-ov-link:hover { text-decoration: underline; }
        .mjs-ov-next { margin: 0; font-size: 1.05rem; font-weight: 650; }
        .mjs-ov-empty, .muted { color: var(--mj-text-muted); margin: 0; }
    `],
})
export class MJSDealOverviewPanel extends BaseFormPanel<DealEntity> {
    public G(field: string): string {
        const v = this.Record?.Get?.(field);
        return v == null || v === '' ? '' : String(v);
    }
    public get Money(): string { return money(this.Record?.Amount); }
    public get Weighted(): string {
        const a = Number(this.Record?.Amount);
        const p = Number(this.Record?.Probability);
        if (!Number.isFinite(a) || !Number.isFinite(p)) return '—';
        return money(a * p / 100);
    }
    public get Prob(): string {
        const p = this.Record?.Probability;
        return p == null ? '—' : `${p}%`;
    }
    public get Provenance(): string {
        if (this.Record?.Amount == null) return 'no figure yet';
        return this.Record.AmountIsComputed ? 'Orders priced' : 'Stated by a person';
    }
    public DateLabel(d: Date | string | null | undefined): string {
        if (!d) return '—';
        return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    }
    public get CloseLabel(): string { return this.DateLabel(this.Record?.ExpectedCloseDate); }
    public get DaysToCloseLabel(): string {
        const n = daysFrom(this.Record?.ExpectedCloseDate);
        if (n === null) return '—';
        if (n < 0) return `${Math.abs(n)}d past`;
        if (n === 0) return 'today';
        return `${n}d`;
    }
    public get CloseClock(): { label: string; tone: 'success' | 'warning' | 'muted' } {
        const n = daysFrom(this.Record?.ExpectedCloseDate);
        if (this.Record?.ActualCloseDate) return { label: 'Closed', tone: 'success' };
        if (n === null) return { label: 'Undated', tone: 'muted' };
        if (n < 0) return { label: `${Math.abs(n)}d past`, tone: 'warning' };
        if (n === 0) return { label: 'Today', tone: 'warning' };
        if (n <= 14) return { label: `${n}d`, tone: 'warning' };
        return { label: `${n}d`, tone: 'muted' };
    }
    public get TermLabel(): string {
        const m = this.Record?.TermMonths;
        return m ? `${m} mo` : '—';
    }
    public get NextStepOverdue(): boolean {
        const n = daysFrom(this.Record?.NextStepDate);
        return n !== null && n < 0;
    }
    public get Health(): string[] {
        const out: string[] = [];
        if (!this.Record) return out;
        const days = daysFrom(this.Record.ExpectedCloseDate);
        if (days !== null && days < 0 && !this.Record.ActualCloseDate) {
            out.push('Expected close is already past — re-date or close it.');
        }
        if (!this.Record.OwnerEmployeeID) out.push('No owner. Assign an AE.');
        if (!this.Record.NextStep) out.push('No next step. Forecast without a next step is a wish.');
        if (this.NextStepOverdue) out.push('The next step date is overdue.');
        if (!this.Record.AccountID) out.push('No account. Early is fine; Qualify should have one.');
        if (this.Record.Amount != null && this.Record.Probability == null) {
            out.push('Amount with no probability — weighted pipeline is unknown.');
        }
        return out;
    }
    public OpenAccount(event: MouseEvent): void {
        this.open(event, MJS_ENTITIES.SalesAccount, this.Record?.AccountID);
    }
    public OpenOwner(event: MouseEvent): void {
        this.open(event, MJS_FOREIGN_ENTITIES.Employee, this.Record?.OwnerEmployeeID);
    }
    private open(event: MouseEvent, entity: string, id: string | null | undefined): void {
        if (!id) return;
        event.preventDefault();
        this.FormComponent.OnFormNavigate({
            Kind: 'record',
            EntityName: entity,
            PrimaryKey: CompositeKey.FromID(id),
            OpenInNewTab: event.ctrlKey || event.metaKey,
        });
    }
}

/* ── Field sections ───────────────────────────────────────────────────────── */

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-pipeline',
    skipNullKeyWarning: true,
    metadata: { entity: E, slot: 'after-fields', sortKey: 90, contributionKey: 'pipeline' },
})
@Component({
    selector: 'mjs-deal-pipeline-panel',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, BaseFormsModule],
    styles: [FIELD_STYLES],
    template: `
        <mj-collapsible-panel SectionKey="pipeline" SectionName="Pipeline" Icon="fa-solid fa-diagram-project"
            [Form]="FormComponent" [FormContext]="FormContext">
            <div class="mjs-fields">
                @for (f of Fields; track f.name) {
                    <div class="mjs-field" [class.mjs-field--span]="f.span">
                        <mj-form-field [Record]="Record" [ShowLabel]="true" [FieldName]="f.name" [Type]="f.type"
                            [EditMode]="EditMode" [FormContext]="FormContext" [LinkType]="f.link ?? 'None'"></mj-form-field>
                    </div>
                }
            </div>
        </mj-collapsible-panel>
    `,
})
export class MJSDealPipelinePanel extends BaseFormPanel<DealEntity> {
    public readonly Fields: DealFieldSpec[] = [
        { name: 'Name', type: 'textbox' },
        { name: 'DealNumber', type: 'textbox' },
        { name: 'PipelineID', type: 'textbox', link: 'Record' },
        { name: 'PipelineStageID', type: 'textbox', link: 'Record' },
        { name: 'DealTypeID', type: 'textbox', link: 'Record' },
        { name: 'DealStatusTypeID', type: 'textbox', link: 'Record' },
        { name: 'ForecastCategoryTypeID', type: 'textbox', link: 'Record' },
        { name: 'Probability', type: 'number' },
    ];
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-party',
    skipNullKeyWarning: true,
    metadata: { entity: E, slot: 'after-fields', sortKey: 80, contributionKey: 'party' },
})
@Component({
    selector: 'mjs-deal-party-panel',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, BaseFormsModule],
    styles: [FIELD_STYLES],
    template: `
        <mj-collapsible-panel SectionKey="party" SectionName="Account &amp; people" Icon="fa-solid fa-building"
            [Form]="FormComponent" [FormContext]="FormContext">
            <div class="mjs-fields">
                @for (f of Fields; track f.name) {
                    <div class="mjs-field" [class.mjs-field--span]="f.span">
                        <mj-form-field [Record]="Record" [ShowLabel]="true" [FieldName]="f.name" [Type]="f.type"
                            [EditMode]="EditMode" [FormContext]="FormContext" [LinkType]="f.link ?? 'None'"></mj-form-field>
                    </div>
                }
            </div>
        </mj-collapsible-panel>
    `,
})
export class MJSDealPartyPanel extends BaseFormPanel<DealEntity> {
    public readonly Fields: DealFieldSpec[] = [
        { name: 'AccountID', type: 'textbox', link: 'Record' },
        { name: 'CompanyID', type: 'textbox', link: 'Record' },
        { name: 'OwnerEmployeeID', type: 'textbox', link: 'Record' },
        { name: 'PrimaryContactID', type: 'textbox', link: 'Record' },
        { name: 'BillingContactID', type: 'textbox', link: 'Record' },
    ];
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-commercial',
    skipNullKeyWarning: true,
    metadata: { entity: E, slot: 'after-fields', sortKey: 70, contributionKey: 'commercial' },
})
@Component({
    selector: 'mjs-deal-commercial-panel',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, BaseFormsModule],
    styles: [FIELD_STYLES],
    template: `
        <mj-collapsible-panel SectionKey="commercial" SectionName="Commercial" Icon="fa-solid fa-coins"
            [Form]="FormComponent" [FormContext]="FormContext">
            <div class="mjs-fields">
                @for (f of Fields; track f.name) {
                    <div class="mjs-field" [class.mjs-field--span]="f.span">
                        <mj-form-field [Record]="Record" [ShowLabel]="true" [FieldName]="f.name" [Type]="f.type"
                            [EditMode]="EditMode" [FormContext]="FormContext" [LinkType]="f.link ?? 'None'"></mj-form-field>
                    </div>
                }
            </div>
        </mj-collapsible-panel>
    `,
})
export class MJSDealCommercialPanel extends BaseFormPanel<DealEntity> {
    public readonly Fields: DealFieldSpec[] = [
        { name: 'Amount', type: 'number' },
        { name: 'CurrencyID', type: 'textbox' },
        { name: 'TermMonths', type: 'number' },
        { name: 'EstimatedProjectWeeks', type: 'number' },
        { name: 'MRR', type: 'number' },
        { name: 'ARR', type: 'number' },
        { name: 'ExpectedCloseDate', type: 'datepicker' },
        { name: 'StartDate', type: 'datepicker' },
        { name: 'ExecutionDate', type: 'datepicker' },
        { name: 'AutoRenew', type: 'checkbox' },
        { name: 'PaymentMethod', type: 'textbox' },
        { name: 'Description', type: 'textarea', span: true },
    ];
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-lines',
    skipNullKeyWarning: true,
    metadata: { entity: E, slot: 'after-related', sortKey: 68, contributionKey: 'lines' },
})
@Component({
    selector: 'mjs-deal-lines-panel',
    standalone: true,
    imports: [CommonModule, BaseFormsModule],
    template: `
        <mj-collapsible-panel SectionKey="lines" SectionName="What's being sold" Icon="fa-solid fa-boxes-stacked"
            Variant="related-entity" [Form]="FormComponent" [FormContext]="FormContext" [DefaultExpanded]="false"
            [BadgeCount]="FormComponent.GetSectionRowCount('lines')">
            @if (Record.IsSaved && Record.OrderID) {
                <mj-explorer-entity-data-grid
                    [Params]="Params"
                    [NewRecordValues]="NewValues"
                    [AllowLoad]="FormComponent.IsSectionExpanded('lines')"
                    [ShowToolbar]="true"
                    (Navigate)="FormComponent.OnFormNavigate($event)"
                    (AfterDataLoad)="OnDataLoad($event)">
                </mj-explorer-entity-data-grid>
            } @else if (Record.IsSaved) {
                <p class="mjs-deal-empty">This deal has no order yet, so there are no lines to show. Save a new deal and Sales mints a Draft order for the products.</p>
            }
        </mj-collapsible-panel>
    `,
    styles: [`.mjs-deal-empty { margin: 0; padding: var(--mj-space-4) var(--mj-space-5); color: var(--mj-text-muted); }`],
})
export class MJSDealLinesPanel extends BaseFormPanel<DealEntity> {
    public get Params() {
        const id = this.Record?.OrderID;
        if (!id) return null;
        return { EntityName: MJS_FOREIGN_ENTITIES.OrderLine, ExtraFilter: `OrderHeaderID = '${String(id).replace(/'/g, "''")}'` };
    }
    public get NewValues(): Record<string, unknown> {
        return this.Record?.OrderID ? { OrderHeaderID: this.Record.OrderID } : {};
    }
    public OnDataLoad(event: AfterDataLoadEventArgs): void {
        this.FormComponent.SetSectionRowCount('lines', event.totalRowCount);
    }
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-motion',
    skipNullKeyWarning: true,
    metadata: { entity: E, slot: 'after-fields', sortKey: 60, contributionKey: 'motion' },
})
@Component({
    selector: 'mjs-deal-motion-panel',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, BaseFormsModule],
    styles: [FIELD_STYLES],
    template: `
        <mj-collapsible-panel SectionKey="motion" SectionName="Motion" Icon="fa-solid fa-person-walking"
            [Form]="FormComponent" [FormContext]="FormContext">
            <div class="mjs-fields">
                @for (f of Fields; track f.name) {
                    <div class="mjs-field" [class.mjs-field--span]="f.span">
                        <mj-form-field [Record]="Record" [ShowLabel]="true" [FieldName]="f.name" [Type]="f.type"
                            [EditMode]="EditMode" [FormContext]="FormContext" [LinkType]="f.link ?? 'None'"></mj-form-field>
                    </div>
                }
            </div>
        </mj-collapsible-panel>
    `,
})
export class MJSDealMotionPanel extends BaseFormPanel<DealEntity> {
    public readonly Fields: DealFieldSpec[] = [
        { name: 'NextStep', type: 'textbox', span: true },
        { name: 'NextStepDate', type: 'datepicker' },
        { name: 'LeadSourceTypeID', type: 'textbox', link: 'Record' },
        { name: 'CampaignID', type: 'textbox' },
        { name: 'OrderID', type: 'textbox', link: 'Record' },
        { name: 'ContractID', type: 'textbox' },
        { name: 'RenewsContractID', type: 'textbox' },
        { name: 'ContractVariances', type: 'textarea', span: true },
    ];
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-close',
    skipNullKeyWarning: true,
    metadata: { entity: E, slot: 'after-fields', sortKey: 52, contributionKey: 'close' },
})
@Component({
    selector: 'mjs-deal-close-panel',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, BaseFormsModule],
    styles: [FIELD_STYLES],
    template: `
        <mj-collapsible-panel SectionKey="close" SectionName="Close" Icon="fa-solid fa-flag-checkered"
            [Form]="FormComponent" [FormContext]="FormContext">
            <div class="mjs-fields">
                @for (f of Fields; track f.name) {
                    <div class="mjs-field" [class.mjs-field--span]="f.span">
                        <mj-form-field [Record]="Record" [ShowLabel]="true" [FieldName]="f.name" [Type]="f.type"
                            [EditMode]="EditMode" [FormContext]="FormContext" [LinkType]="f.link ?? 'None'"></mj-form-field>
                    </div>
                }
            </div>
        </mj-collapsible-panel>
    `,
})
export class MJSDealClosePanel extends BaseFormPanel<DealEntity> {
    public readonly Fields: DealFieldSpec[] = [
        { name: 'ActualCloseDate', type: 'datepicker' },
        { name: 'ClosedAt', type: 'datepicker' },
        { name: 'ClosedByUserID', type: 'textbox', link: 'Record' },
        { name: 'LossReasonID', type: 'textbox', link: 'Record' },
        { name: 'StandardAgreementModified', type: 'checkbox' },
        { name: 'AnnualIncreasePctOverride', type: 'number' },
        { name: 'CancellationNoticeDaysOverride', type: 'number' },
        { name: 'LossNotes', type: 'textarea', span: true },
    ];
}

/* ── Related, renamed ─────────────────────────────────────────────────────── */

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-related-internal-team',
    skipNullKeyWarning: true,
    metadata: {
        entity: E, slot: 'after-related', sortKey: 50, contributionKey: 'internal-team',
        relatedEntity: MJS_ENTITIES.DealTeamMember, relatedJoinField: 'DealID',
    },
})
@Component({
    selector: 'mjs-deal-internal-team-panel',
    standalone: true,
    imports: [CommonModule, BaseFormsModule],
    template: `
        <mj-collapsible-panel SectionKey="internal-team" SectionName="Internal team" Icon="fa-solid fa-users"
            Variant="related-entity" [Form]="FormComponent" [FormContext]="FormContext" [DefaultExpanded]="false"
            [BadgeCount]="FormComponent.GetSectionRowCount('internal-team')">
            @if (Record.IsSaved) {
                <mj-explorer-entity-data-grid
                    [Params]="FormComponent.BuildRelationshipViewParamsByEntityName(Entity, 'DealID')"
                    [NewRecordValues]="FormComponent.NewRecordValues(Entity, 'DealID')"
                    [AllowLoad]="FormComponent.IsSectionExpanded('internal-team')"
                    [ShowToolbar]="true"
                    (Navigate)="FormComponent.OnFormNavigate($event)"
                    (AfterDataLoad)="OnDataLoad($event)">
                </mj-explorer-entity-data-grid>
            }
        </mj-collapsible-panel>
    `,
})
export class MJSDealTeamGridPanel extends BaseFormPanel<DealEntity> {
    public readonly Entity = MJS_ENTITIES.DealTeamMember;
    public OnDataLoad(event: AfterDataLoadEventArgs): void {
        this.FormComponent.SetSectionRowCount('internal-team', event.totalRowCount);
    }
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-related-buying-team',
    skipNullKeyWarning: true,
    metadata: {
        entity: E, slot: 'after-related', sortKey: 48, contributionKey: 'buying-team',
        relatedEntity: MJS_ENTITIES.DealContactRole, relatedJoinField: 'DealID',
    },
})
@Component({
    selector: 'mjs-deal-buying-team-panel',
    standalone: true,
    imports: [CommonModule, BaseFormsModule],
    template: `
        <mj-collapsible-panel SectionKey="buying-team" SectionName="Buying team" Icon="fa-solid fa-user-tag"
            Variant="related-entity" [Form]="FormComponent" [FormContext]="FormContext" [DefaultExpanded]="false"
            [BadgeCount]="FormComponent.GetSectionRowCount('buying-team')">
            @if (Record.IsSaved) {
                <mj-explorer-entity-data-grid
                    [Params]="FormComponent.BuildRelationshipViewParamsByEntityName(Entity, 'DealID')"
                    [NewRecordValues]="FormComponent.NewRecordValues(Entity, 'DealID')"
                    [AllowLoad]="FormComponent.IsSectionExpanded('buying-team')"
                    [ShowToolbar]="true"
                    (Navigate)="FormComponent.OnFormNavigate($event)"
                    (AfterDataLoad)="OnDataLoad($event)">
                </mj-explorer-entity-data-grid>
            }
        </mj-collapsible-panel>
    `,
})
export class MJSDealBuyingTeamPanel extends BaseFormPanel<DealEntity> {
    public readonly Entity = MJS_ENTITIES.DealContactRole;
    public OnDataLoad(event: AfterDataLoadEventArgs): void {
        this.FormComponent.SetSectionRowCount('buying-team', event.totalRowCount);
    }
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-related-activity',
    skipNullKeyWarning: true,
    metadata: {
        entity: E, slot: 'after-related', sortKey: 88, contributionKey: 'activity',
        relatedEntity: MJS_FOREIGN_ENTITIES.ActivityLink, relatedJoinField: 'RecordID',
    },
})
@Component({
    selector: 'mjs-deal-activity-panel',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, BaseFormsModule, EntityViewerModule, DealActivityTimelineComponent],
    template: `
        <mj-collapsible-panel SectionKey="activity" SectionName="Activity" Icon="fa-solid fa-timeline"
            Variant="related-entity" [Form]="FormComponent" [FormContext]="FormContext" [DefaultExpanded]="true">
            @if (Record.IsSaved) {
                <div class="mjs-deal-activity">
                    <mjs-deal-activity-timeline [DealID]="Record.ID" [ComposeOnly]="true"
                        (Logged)="OnLogged()"></mjs-deal-activity-timeline>
                    @if (ActivityEntity) {
                        <div class="mjs-deal-activity__viewer">
                            <mj-entity-viewer
                                [Entity]="ActivityEntity"
                                [ViewEntity]="ActivityView"
                                (RecordOpened)="OnActivityOpened($event)">
                            </mj-entity-viewer>
                        </div>
                    }
                </div>
            }
        </mj-collapsible-panel>
    `,
    styles: [`
        .mjs-deal-activity { display: flex; flex-direction: column; gap: var(--mj-space-3); padding: var(--mj-space-3) var(--mj-space-4) var(--mj-space-5); min-height: 0; }
        .mjs-deal-activity__viewer {
            min-height: 420px; height: 480px;
            display: flex; flex-direction: column;
            border: 1px solid var(--mj-border-default); border-radius: var(--mj-radius-md); overflow: hidden;
        }
        .mjs-deal-activity__viewer mj-entity-viewer {
            display: flex; flex-direction: column; flex: 1 1 auto; height: 100%; width: 100%;
        }
    `],
})
export class MJSDealActivityPanel extends BaseFormPanel<DealEntity> {
    private readonly cdr = inject(ChangeDetectorRef);
    public ActivityEntity: EntityInfo | null = null;
    public ActivityView: ReturnType<typeof SyntheticActivityView> | null = null;

    public async ngOnInit(): Promise<void> {
        const md = new Metadata();
        this.ActivityEntity = md.Entities.find((e) => e.Name === MJS_FOREIGN_ENTITIES.Activity) ?? null;
        await this.refreshView();
    }

    public override OnRecordRefreshed(_record: DealEntity): void {
        void this.refreshView();
    }

    public OnLogged(): void {
        void this.refreshView();
    }

    public OnActivityOpened(event: RecordOpenedEvent): void {
        const id = (event.compositeKey?.GetValueByFieldName('ID') ?? event.record?.['ID']) as string | undefined;
        if (!id) return;
        this.FormComponent.OnFormNavigate({
            Kind: 'record',
            EntityName: MJS_FOREIGN_ENTITIES.Activity,
            PrimaryKey: CompositeKey.FromID(id),
        });
    }

    private async refreshView(): Promise<void> {
        if (!this.ActivityEntity || !this.Record?.ID) {
            this.ActivityView = null;
            return;
        }
        const md = new Metadata();
        const dealEntityID = md.Entities.find((e) => e.Name === MJS_ENTITIES.Deal)?.ID;
        if (!dealEntityID) {
            this.ActivityView = SyntheticActivityView(this.ActivityEntity, '1 = 0');
            this.cdr.detectChanges();
            return;
        }
        const rv = new RunView();
        const anchors = await rv.RunView<{ ActivityID: string }>({
            EntityName: MJS_FOREIGN_ENTITIES.ActivityLink,
            ExtraFilter: `EntityID = '${dealEntityID.replace(/'/g, "''")}' AND RecordID = '${String(this.Record.ID).replace(/'/g, "''")}'`,
            Fields: ['ActivityID'],
            ResultType: 'simple',
        });
        const ids = anchors.Success
            ? [...new Set((anchors.Results ?? []).map((r) => String(r.ActivityID)).filter(Boolean))]
            : [];
        const where = ids.length
            ? `ID IN (${ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(',')})`
            : '1 = 0';
        this.ActivityView = SyntheticActivityView(this.ActivityEntity, where);
        this.cdr.detectChanges();
    }
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-related-stage-history',
    skipNullKeyWarning: true,
    metadata: {
        entity: E, slot: 'after-related', sortKey: 44, contributionKey: 'stage-history',
        relatedEntity: MJS_ENTITIES.DealStageEvent, relatedJoinField: 'DealID',
    },
})
@Component({
    selector: 'mjs-deal-history-panel',
    standalone: true,
    imports: [CommonModule, BaseFormsModule],
    template: `
        <mj-collapsible-panel SectionKey="stage-history" SectionName="Stage history" Icon="fa-solid fa-clock-rotate-left"
            Variant="related-entity" [Form]="FormComponent" [FormContext]="FormContext" [DefaultExpanded]="false"
            [BadgeCount]="FormComponent.GetSectionRowCount('stage-history')">
            @if (Record.IsSaved) {
                <mj-explorer-entity-data-grid
                    [Params]="FormComponent.BuildRelationshipViewParamsByEntityName(Entity, 'DealID')"
                    [NewRecordValues]="FormComponent.NewRecordValues(Entity, 'DealID')"
                    [AllowLoad]="FormComponent.IsSectionExpanded('stage-history')"
                    [ShowToolbar]="true"
                    (Navigate)="FormComponent.OnFormNavigate($event)"
                    (AfterDataLoad)="OnDataLoad($event)">
                </mj-explorer-entity-data-grid>
            }
        </mj-collapsible-panel>
    `,
})
export class MJSDealHistoryPanel extends BaseFormPanel<DealEntity> {
    public readonly Entity = MJS_ENTITIES.DealStageEvent;
    public OnDataLoad(event: AfterDataLoadEventArgs): void {
        this.FormComponent.SetSectionRowCount('stage-history', event.totalRowCount);
    }
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-related-payment-schedule',
    skipNullKeyWarning: true,
    metadata: {
        entity: E, slot: 'after-related', sortKey: 42, contributionKey: 'payment-schedule',
        relatedEntity: MJS_ENTITIES.DealPaymentSchedule, relatedJoinField: 'DealID',
    },
})
@Component({
    selector: 'mjs-deal-schedule-panel',
    standalone: true,
    imports: [CommonModule, BaseFormsModule],
    template: `
        <mj-collapsible-panel SectionKey="payment-schedule" SectionName="Payment schedule" Icon="fa-solid fa-calendar-week"
            Variant="related-entity" [Form]="FormComponent" [FormContext]="FormContext" [DefaultExpanded]="false"
            [BadgeCount]="FormComponent.GetSectionRowCount('payment-schedule')">
            @if (Record.IsSaved) {
                <mj-explorer-entity-data-grid
                    [Params]="FormComponent.BuildRelationshipViewParamsByEntityName(Entity, 'DealID')"
                    [NewRecordValues]="FormComponent.NewRecordValues(Entity, 'DealID')"
                    [AllowLoad]="FormComponent.IsSectionExpanded('payment-schedule')"
                    [ShowToolbar]="true"
                    (Navigate)="FormComponent.OnFormNavigate($event)"
                    (AfterDataLoad)="OnDataLoad($event)">
                </mj-explorer-entity-data-grid>
            }
        </mj-collapsible-panel>
    `,
})
export class MJSDealSchedulePanel extends BaseFormPanel<DealEntity> {
    public readonly Entity = MJS_ENTITIES.DealPaymentSchedule;
    public OnDataLoad(event: AfterDataLoadEventArgs): void {
        this.FormComponent.SetSectionRowCount('payment-schedule', event.totalRowCount);
    }
}
