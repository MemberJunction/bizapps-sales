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
import { FormsModule } from '@angular/forms';
import { CompositeKey, Metadata, RunView, type EntityInfo } from '@memberjunction/core';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel, BaseFormsModule } from '@memberjunction/ng-base-forms';
import { EntityViewerModule, type AfterDataLoadEventArgs, type RecordOpenedEvent } from '@memberjunction/ng-entity-viewer';
import {
    DealEntity,
    LoadDealStatusOptions,
    type DealStatusOption,
    type SalesCloseDealInput,
    type SalesCloseDealOutput,
} from '@mj-biz-apps/sales-entities';
import { DealActivityTimelineComponent } from '../activities/deal-activity-timeline.component';
import { SyntheticActivityView } from '../pages/deal-views';
import { MJS_ENTITIES, MJS_FOREIGN_ENTITIES } from '../data/entity-names';

const E = MJS_ENTITIES.Deal;

/** Sales' loss-reason table. Named here so the close action has one spelling of it. */
const E_LOSS_REASON = 'MJ_BizApps_Sales: Loss Reasons';

/** One pickable loss reason, with the flag that decides whether notes are mandatory. */
export interface LossReasonOption {
    ID: string;
    Name: string;
    RequiresNotes: boolean;
}

/**
 * The loss reasons a close may cite.
 *
 * Loaded even on a deal nobody will lose, because the alternative is fetching inside the click
 * handler: an empty dropdown then fails as a TIMEOUT rather than as a missing list, which is a slow
 * way to find out the table was never seeded.
 */
async function LoadLossReasons(): Promise<LossReasonOption[]> {
    const result = await new RunView().RunView<{ ID: string; Name: string; RequiresNotes: boolean }>({
        EntityName: E_LOSS_REASON,
        ExtraFilter: 'IsActive = 1',
        OrderBy: 'Name',
        ResultType: 'simple',
        Fields: ['ID', 'Name', 'RequiresNotes'],
    });
    if (!result?.Success) return [];
    return (result.Results ?? []).map((r) => ({
        ID: String(r.ID),
        Name: String(r.Name),
        RequiresNotes: r.RequiresNotes === true,
    }));
}

/**
 * `RouteOperation` is on the SQL Server / GraphQL provider, not on the `IMetadataProvider` interface
 * `Metadata.Provider` is declared as, so it has to be narrowed. Declared as a precise shape rather
 * than reached for with a loose cast, so the operation's input and output stay type-checked — which
 * is the whole value of calling a typed operation.
 */
interface DealCloseOperationRouter {
    RouteOperation<TInput, TOutput>(
        operationKey: string,
        input: TInput,
    ): Promise<{ Success: boolean; Output?: TOutput; ErrorMessage?: string }>;
}

const CLOSE_ACTION_STYLES = `
    .mjs-close-action {
        padding: var(--mj-space-4) var(--mj-space-5);
        border-bottom: 1px solid var(--mj-border-default);
        display: flex; flex-direction: column; gap: var(--mj-space-3);
    }
    .mjs-close-action__start {
        align-self: flex-start; cursor: pointer;
        padding: 6px 14px; border-radius: var(--mj-radius-sm);
        border: 1px solid var(--mj-border-default); background: var(--mj-bg-surface-card);
        font-weight: 600;
    }
    .mjs-close-action__start:hover { background: var(--mj-bg-surface-hover); }
    .mjs-close-action__hint { color: var(--mj-text-muted); font-size: 0.78rem; }
    .mjs-close-action__form { display: flex; flex-direction: column; gap: var(--mj-space-3); max-width: 520px; }
    .mjs-close-action__row { display: flex; gap: var(--mj-space-4); align-items: center; }
    .mjs-close-action__field { display: flex; flex-direction: column; gap: 4px; }
    .mjs-close-action__field > span { font-size: 0.78rem; color: var(--mj-text-muted); }
    .mjs-close-action__confirm {
        cursor: pointer; padding: 6px 14px; border-radius: var(--mj-radius-sm);
        border: 1px solid var(--mj-brand-primary); background: var(--mj-brand-primary); color: #fff;
        font-weight: 600;
    }
    .mjs-close-action__confirm:disabled { opacity: 0.5; cursor: not-allowed; }
    .mjs-close-action__cancel {
        cursor: pointer; padding: 6px 14px; border-radius: var(--mj-radius-sm);
        border: 1px solid var(--mj-border-default); background: transparent;
    }
    .mjs-close-action__msg { font-size: 0.82rem; color: var(--mj-status-success); }
    .mjs-close-action__msg.is-error { color: var(--mj-status-warning); font-weight: 500; }
    .mjs-close-action__issue { font-size: 0.78rem; color: var(--mj-status-warning); }
`;

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
        // A deal nobody has saved yet has not FAILED to have an owner, a next step or an account --
        // nobody has had the chance to give it one. Auditing a record the user is still filling in
        // reports the absence of work that has not started, which is why a brand-new deal opened on a
        // wall of warnings. The briefing stays quiet until there is something to brief on.
        if (!this.Record.IsSaved) return out;
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
    // `leadsWhenUnsaved` opens a NEW deal here rather than on Overview (bc-aidp-next-golive#188).
    //
    // INERT UNTIL MJ#4217 SHIPS, AND NOTHING WILL SAY SO. `FormPanelRegistrationMetadata` extends
    // `Record<string, unknown>`, so this key type-checks against the PUBLISHED base-forms package
    // exactly as it does against the branch that adds the reader. It compiles, it looks configured,
    // and a new deal keeps opening on Overview until a release carries MJ#4217. Declared here now so
    // the opt-in lands with the rest of the #188 work rather than being forgotten a release later.
    // Overview is an exec briefing and stays the lead for a SAVED deal, which is what it is for;
    // on a record with no data it is a page of blanks the user has to look past to find where
    // typing starts. This is the first panel that asks for anything.
    metadata: { entity: E, slot: 'after-fields', sortKey: 90, contributionKey: 'pipeline', leadsWhenUnsaved: true },
})
@Component({
    selector: 'mjs-deal-pipeline-panel',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, FormsModule, BaseFormsModule],
    styles: [FIELD_STYLES],
    template: `
        <mj-collapsible-panel SectionKey="pipeline" SectionName="Pipeline" Icon="fa-solid fa-diagram-project"
            [Form]="FormComponent" [FormContext]="FormContext">
            <div class="mjs-fields">
                @for (f of Fields; track f.name) {
                    <div class="mjs-field" [class.mjs-field--span]="f.span">
                        <mj-form-field [Record]="Record" [ShowLabel]="true" [FieldName]="f.name" [Type]="f.type"
                            [EditMode]="EditMode" [FormContext]="FormContext" [LinkType]="f.link ?? 'None'"
                            (Navigate)="FormComponent.OnFormNavigate($event)"></mj-form-field>
                    </div>
                }

                <!-- STATUS IS NOT A GENERIC FIELD HERE, and the reason is the whole of golive#205.
                     MJ's <mj-form-field> renders a foreign key as an unfiltered dropdown off the related
                     entity, so it offered Won and Lost — and picking one wrote the status without any of
                     the close running. The deal workspace has never offered them; this brings the form
                     into line with it rather than the other way round. One door, and it is the audited
                     one. -->
                <div class="mjs-field">
                    <div class="mj-forms-field">
                        <label class="mj-forms-field-label">Status</label>
                        @if (EditMode) {
                            <select [ngModel]="Record.DealStatusTypeID"
                                    (ngModelChange)="SetStatus($event)"
                                    [disabled]="!StatusIsEditable">
                                <option [ngValue]="null">— choose —</option>
                                @for (s of SelectableStatuses; track s.ID) {
                                    <option [ngValue]="s.ID">{{ s.Name }}</option>
                                }
                                <!-- The deal's OWN status when it is a closing one, so a closed deal reads
                                     "Won" rather than "— choose —". Never selectable: the list excludes it. -->
                                @if (CurrentStatusIsClosing) {
                                    <option [ngValue]="Record.DealStatusTypeID" disabled>{{ CurrentStatusName }}</option>
                                }
                            </select>
                            @if (CurrentStatusIsClosing) {
                                <small class="dw-field__hint">Closed. Reopen the deal to change this.</small>
                            } @else {
                                <small class="dw-field__hint">Use the Close action to win or lose a deal.</small>
                            }
                        } @else {
                            <div class="mj-forms-field-value">{{ CurrentStatusName || '—' }}</div>
                        }
                    </div>
                </div>
            </div>
        </mj-collapsible-panel>
    `,
})
export class MJSDealPipelinePanel extends BaseFormPanel<DealEntity> {
    /** Every active status, loaded once. Filtered for display; see SelectableStatuses. */
    private statuses: DealStatusOption[] = [];

    public async ngOnInit(): Promise<void> {
        // BaseFormPanel declares no lifecycle hook, so there is nothing to chain to. Angular calls this
        // on the component regardless of whether the base class has one.
        this.statuses = await LoadDealStatusOptions();
    }

    /**
     * The statuses a user may pick DIRECTLY — the non-locking ones.
     *
     * By FLAG, never by name, and `LocksDeal` specifically: that is the flag the server's refusal
     * reads, so this control and the save cannot disagree about which statuses are pickable. The deal
     * workspace filters the same way for the same reason.
     */
    public get SelectableStatuses(): DealStatusOption[] {
        return this.statuses.filter((s) => !s.LocksDeal);
    }

    /** The display name of whatever status the deal currently holds. */
    public get CurrentStatusName(): string {
        const id = String(this.Record?.DealStatusTypeID ?? '');
        return this.statuses.find((s) => s.ID.toLowerCase() === id.toLowerCase())?.Name ?? '';
    }

    /** True when the deal already sits in a closing status, so the control is showing a frozen value. */
    public get CurrentStatusIsClosing(): boolean {
        const id = String(this.Record?.DealStatusTypeID ?? '');
        return this.statuses.some((s) => s.ID.toLowerCase() === id.toLowerCase() && s.LocksDeal);
    }

    /**
     * A closed deal's status is not editable here. Reopening is the audited way back, and offering the
     * field would be the mirror of the defect this change closes: a status write that unlocks a deal
     * without the reopen having run.
     */
    public get StatusIsEditable(): boolean {
        return !this.CurrentStatusIsClosing;
    }

    public SetStatus(id: string | null): void {
        if (this.Record) {
            this.Record.DealStatusTypeID = id as never;
        }
    }

    public readonly Fields: DealFieldSpec[] = [
        // Name and DealNumber are deliberately NOT here. The hero directly above this panel already
        // renders Name as an editable field in edit mode, and shows DealNumber beneath the title once
        // the server has assigned one. Listing them again gave the form two inputs bound to the same
        // column, and offered an empty textbox for a value the user does not get to choose.
        { name: 'PipelineID', type: 'textbox', link: 'Record' },
        { name: 'PipelineStageID', type: 'textbox', link: 'Record' },
        { name: 'DealTypeID', type: 'textbox', link: 'Record' },
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
                            [EditMode]="EditMode" [FormContext]="FormContext" [LinkType]="f.link ?? 'None'"
                            (Navigate)="FormComponent.OnFormNavigate($event)"></mj-form-field>
                    </div>
                }
            </div>
        </mj-collapsible-panel>
    `,
})
export class MJSDealPartyPanel extends BaseFormPanel<DealEntity> {
    /**
     * Record links on these fields emit `Navigate` from `mj-form-field`. That output must be
     * forwarded to `FormComponent.OnFormNavigate`, which Explorer maps onto
     * `NavigationService.OpenEntityRecord`. Without the binding the cells look like links and
     * do nothing — the Overview / hero buttons already go through this path.
     */
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
                            [EditMode]="EditMode" [FormContext]="FormContext" [LinkType]="f.link ?? 'None'"
                            (Navigate)="FormComponent.OnFormNavigate($event)"></mj-form-field>
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
                            [EditMode]="EditMode" [FormContext]="FormContext" [LinkType]="f.link ?? 'None'"
                            (Navigate)="FormComponent.OnFormNavigate($event)"></mj-form-field>
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
    imports: [CommonModule, FormsModule, BaseFormsModule],
    styles: [FIELD_STYLES, CLOSE_ACTION_STYLES],
    template: `
        <mj-collapsible-panel SectionKey="close" SectionName="Close" Icon="fa-solid fa-flag-checkered"
            [Form]="FormComponent" [FormContext]="FormContext">

            <!-- THE ACTION, not a status field (bc-aidp-next-golive#205).
                 The deal workspace closes through Sales.CloseDeal and its status dropdown has never
                 offered a closing status. This form filters the same way now, which left it with no way
                 to close a deal at all -- the panel below is fields, and fields are not an action.
                 So the door the workspace uses is put here too. -->
            @if (CanClose) {
                <div class="mjs-close-action">
                    @if (!PanelOpen) {
                        <button type="button" class="mjs-close-action__start" (click)="OpenPanel()">
                            <i class="fa-solid fa-flag-checkered" aria-hidden="true"></i> Close this deal
                        </button>
                        <small class="mjs-close-action__hint">
                            Records the outcome, writes the stage history, and for a won B2B deal creates
                            the contract and finance tasks.
                        </small>
                    } @else {
                        <div class="mjs-close-action__form">
                            <div class="mjs-close-action__row">
                                <label>
                                    <input type="radio" name="dealCloseOutcome" value="won"
                                           [(ngModel)]="Outcome" [disabled]="Closing" /> Won
                                </label>
                                <label>
                                    <input type="radio" name="dealCloseOutcome" value="lost"
                                           [(ngModel)]="Outcome" [disabled]="Closing" /> Lost
                                </label>
                            </div>

                            @if (Outcome === 'lost') {
                                <label class="mjs-close-action__field">
                                    <span>Loss reason</span>
                                    <select [(ngModel)]="LossReasonID" [disabled]="Closing">
                                        <option [ngValue]="null">— choose —</option>
                                        @for (r of LossReasons; track r.ID) {
                                            <option [ngValue]="r.ID">{{ r.Name }}</option>
                                        }
                                    </select>
                                </label>
                                @if (LossReasonRequiresNotes) {
                                    <label class="mjs-close-action__field">
                                        <span>Loss notes <em>(required for this reason)</em></span>
                                        <textarea rows="2" [(ngModel)]="LossNotes" [disabled]="Closing"></textarea>
                                    </label>
                                }
                            }

                            <label class="mjs-close-action__field">
                                <span>Notes <em>(optional)</em></span>
                                <textarea rows="2" [(ngModel)]="Notes" [disabled]="Closing"></textarea>
                            </label>

                            <div class="mjs-close-action__row">
                                <button type="button" class="mjs-close-action__confirm"
                                        [disabled]="!CanConfirm" (click)="ConfirmClose()">
                                    {{ Closing ? 'Closing…' : 'Close deal' }}
                                </button>
                                <button type="button" class="mjs-close-action__cancel"
                                        [disabled]="Closing" (click)="CancelClose()">Cancel</button>
                            </div>
                        </div>
                    }

                    @if (Message) {
                        <div class="mjs-close-action__msg" [class.is-error]="MessageIsError">{{ Message }}</div>
                    }
                    @for (i of Issues; track i) {
                        <div class="mjs-close-action__issue">{{ i }}</div>
                    }
                </div>
            }

            <div class="mjs-fields">
                @for (f of Fields; track f.name) {
                    <div class="mjs-field" [class.mjs-field--span]="f.span">
                        <mj-form-field [Record]="Record" [ShowLabel]="true" [FieldName]="f.name" [Type]="f.type"
                            [EditMode]="EditMode" [FormContext]="FormContext" [LinkType]="f.link ?? 'None'"
                            (Navigate)="FormComponent.OnFormNavigate($event)"></mj-form-field>
                    </div>
                }
            </div>
        </mj-collapsible-panel>
    `,
})
export class MJSDealClosePanel extends BaseFormPanel<DealEntity> {
    public PanelOpen = false;
    public Closing = false;
    public Outcome: 'won' | 'lost' | null = null;
    public LossReasonID: string | null = null;
    public LossNotes = '';
    public Notes = '';
    public Message = '';
    public MessageIsError = false;
    public Issues: string[] = [];
    public LossReasons: LossReasonOption[] = [];

    private statuses: DealStatusOption[] = [];

    public async ngOnInit(): Promise<void> {
        [this.statuses, this.LossReasons] = await Promise.all([
            LoadDealStatusOptions(),
            LoadLossReasons(),
        ]);
    }

    /** Only an open, saved deal can be closed. A closed one shows its stamps and nothing else. */
    public get CanClose(): boolean {
        if (!this.Record?.IsSaved) return false;
        const id = String(this.Record.DealStatusTypeID ?? '').toLowerCase();
        return !this.statuses.some((x) => x.ID.toLowerCase() === id && x.LocksDeal);
    }

    public get LossReasonRequiresNotes(): boolean {
        return this.LossReasons.find((r) => r.ID === this.LossReasonID)?.RequiresNotes === true;
    }

    /**
     * What the operation will refuse anyway, refused here first.
     *
     * Not a second rule: `Sales.CloseDeal` validates the same things and is the one that matters,
     * since an import or an agent never comes through this panel. This only spares the round trip.
     */
    public get CanConfirm(): boolean {
        if (this.Closing || !this.Outcome) return false;
        if (this.Outcome === 'lost') {
            if (!this.LossReasonID) return false;
            if (this.LossReasonRequiresNotes && !this.LossNotes.trim()) return false;

        }
        return true;
    }

    public OpenPanel(): void {
        this.PanelOpen = true;
        this.Outcome = null;
        this.LossReasonID = null;
        this.LossNotes = '';
        this.Notes = '';
        this.Message = '';
        this.Issues = [];
    }

    public CancelClose(): void {
        this.PanelOpen = false;
        this.Message = '';
        this.Issues = [];
    }

    /**
     * Close the deal through the operation.
     *
     * UNSAVED EDITS ARE SAVED FIRST, for the reason the workspace records: a close routes the deal's
     * lines, so closing the persisted state would build an order from data the user is not looking at,
     * and discarding the edits would drop work silently. If the save is refused the close is NOT
     * attempted and the refusal stands on screen, with the deal intact and still open.
     *
     * THE TARGET STATUS IS FOUND BY FLAG. A deployment may call its winning status "Signed"; matching
     * on the word would report "no such status" on a perfectly good database.
     */
    public async ConfirmClose(): Promise<void> {
        if (!this.CanConfirm || !this.Record) return;

        const wantWon = this.Outcome === 'won';
        const target = this.statuses.find((x) => (wantWon ? x.IsWon : x.IsLost));
        if (!target) {
            this.Fail(`No active status carries Is${wantWon ? 'Won' : 'Lost'}. Seed the deal status types first.`);
            return;
        }

        this.Closing = true;
        this.Message = '';
        this.Issues = [];
        try {
            if (this.EditMode || this.Record.Dirty) {
                if (!(await this.FormComponent.SaveRecord(false))) {
                    this.Fail('The deal could not be saved, so it was not closed. Fix the errors above and try again.');
                    return;
                }
            }

            /**
             * TWO LAYERS OF SUCCESS, and checking only the outer one is a mistake this repo has made
             * before: `Success` on the envelope means the operation RAN. Whether the deal actually
             * closed is `Output.Success`.
             */
            const router = Metadata.Provider as unknown as DealCloseOperationRouter;
            const envelope = await router.RouteOperation<SalesCloseDealInput, SalesCloseDealOutput>(
                'Sales.CloseDeal',
                {
                    DealID: this.Record.ID,
                    DealStatusTypeID: target.ID,
                    LossReasonID: wantWon ? null : this.LossReasonID,
                    LossNotes: wantWon ? null : (this.LossNotes.trim() || null),
                    Notes: this.Notes.trim() || null,
                },
            );
            if (!envelope.Success) {
                this.Fail(envelope.ErrorMessage ?? 'Sales.CloseDeal could not be reached.');
                return;
            }
            const out = envelope.Output;
            if (!out?.Success) {
                this.Issues = (out?.Issues ?? []).map((i) => i.Message);
                this.Fail(out?.Issues?.[0]?.Message ?? 'The deal could not be closed.');
                return;
            }

            this.PanelOpen = false;
            this.MessageIsError = false;
            this.Message = out.IsWon ? 'Deal closed as won.' : 'Deal closed as lost.';
            // WARNINGS ON A SUCCESSFUL CLOSE are the interesting ones -- a stubbed downstream, a finance
            // task that could not be routed, an order status orders refused. Reporting only failures
            // would call a half-done close clean.
            this.Issues = (out.Issues ?? []).map((i) => i.Message);
            await this.FormComponent.RefreshRecord();
        } catch (err) {
            this.Fail(`The close did not complete: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            this.Closing = false;
        }
    }

    private Fail(message: string): void {
        this.MessageIsError = true;
        this.Message = message;
    }

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
