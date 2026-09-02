/**
 * @fileoverview Persistent hero on the Deal form — identity, forecast, amount provenance, close lock.
 *
 * Pattern 1 (`BaseFormPanel` in `before-fields`): the generated Deal form keeps regenerating; this
 * mounts above it and stays put across left-nav sections, the same way People/Org identity does.
 * Lock + stale-amount live HERE so the generated template does not have to know about them; the
 * Extended form class still owns EditableFieldNames because that is form behaviour, not chrome.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { ChangeDetectorRef, Component, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompositeKey, RunView } from '@memberjunction/core';
import { UserInfoEngine } from '@memberjunction/core-entities';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel, BaseFormsModule } from '@memberjunction/ng-base-forms';
import { DealEntity, ResolveDealLockState } from '@mj-biz-apps/sales-entities';
import { MJS_ENTITIES, MJS_FOREIGN_ENTITIES } from '../data/entity-names';

const E_ORDER_LINE = MJS_FOREIGN_ENTITIES.OrderLine;
const COLLAPSE_SETTING = 'mj.identityHeader.collapsed.deal';

function money(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    return Number(n).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-hero',
    skipNullKeyWarning: true,
    metadata: {
        entity: MJS_ENTITIES.Deal,
        slot: 'before-fields',
        sortKey: 100,
        contributionKey: 'header',
    },
})
@Component({
    selector: 'mjs-deal-hero-panel',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, BaseFormsModule],
    template: `
        <div class="mjs-deal-hero" [class.mjs-deal-hero--collapsed]="Collapsed">
            <div class="mjs-deal-hero__identity">
                <div class="mjs-deal-hero__avatar" aria-hidden="true">
                    <i class="fa-solid fa-handshake"></i>
                    @if (!EditMode) {
                        <span class="mjs-deal-hero__presence" [attr.data-tone]="StatusTone" [title]="StatusName || 'Deal'"></span>
                    }
                </div>
                <div class="mjs-deal-hero__copy">
                    <div class="mjs-deal-hero__title-row">
                        <h1 class="mjs-deal-hero__name">{{ Title }}</h1>
                    </div>
                    @if (Record.DealNumber && !Collapsed) {
                        <div class="mjs-deal-hero__aka">{{ Record.DealNumber }}</div>
                    }
                    <div class="mjs-deal-hero__badges">
                        <span class="mjs-deal-hero__entity-chip"><i class="fa-solid fa-handshake"></i> Deal</span>
                        @if (StatusName) {
                            <span class="mjs-deal-hero__chip" [attr.data-tone]="StatusTone">{{ StatusName }}</span>
                        }
                        @if (ForecastName) {
                            <span class="mjs-deal-hero__chip">{{ ForecastName }}</span>
                        }
                        @if (IsLocked) {
                            <span class="mjs-deal-hero__chip" data-tone="warning">
                                <i class="fa-solid fa-lock"></i> Locked
                            </span>
                        }
                    </div>
                </div>
                <button type="button" class="mjs-deal-hero__toggle"
                    [title]="Collapsed ? 'Expand header' : 'Collapse header'"
                    [attr.aria-label]="Collapsed ? 'Expand header' : 'Collapse header'"
                    (click)="ToggleCollapsed()">
                    <i [class]="Collapsed ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up'"></i>
                </button>
            </div>
            @if (!Collapsed) {
                <div class="mjs-deal-hero__summary">
                    <div class="mjs-deal-hero__stat">
                        <span class="mjs-deal-hero__stat-label">Account</span>
                        @if (Record.AccountID && AccountName) {
                            <button type="button" class="mjs-deal-hero__stat-val is-link" (click)="OpenAccount($event)">{{ AccountName }}</button>
                        } @else {
                            <span class="mjs-deal-hero__stat-val">{{ AccountName || '—' }}</span>
                        }
                    </div>
                    <div class="mjs-deal-hero__stat">
                        <span class="mjs-deal-hero__stat-label">Owner</span>
                        @if (Record.OwnerEmployeeID && OwnerName) {
                            <button type="button" class="mjs-deal-hero__stat-val is-link" (click)="OpenOwner($event)">{{ OwnerName }}</button>
                        } @else {
                            <span class="mjs-deal-hero__stat-val">{{ OwnerName || 'Unowned' }}</span>
                        }
                    </div>
                    <div class="mjs-deal-hero__stat">
                        <span class="mjs-deal-hero__stat-label">Stage</span>
                        <span class="mjs-deal-hero__stat-val">{{ StageName || '—' }}</span>
                    </div>
                    <div class="mjs-deal-hero__stat">
                        <span class="mjs-deal-hero__stat-label">Amount</span>
                        <span class="mjs-deal-hero__stat-val">{{ AmountText }}</span>
                    </div>
                    <div class="mjs-deal-hero__stat">
                        <span class="mjs-deal-hero__stat-label">Weighted</span>
                        <span class="mjs-deal-hero__stat-val">{{ WeightedText }}</span>
                    </div>
                    <div class="mjs-deal-hero__stat">
                        <span class="mjs-deal-hero__stat-label">Close</span>
                        <span class="mjs-deal-hero__stat-val">{{ (Record.ExpectedCloseDate | date: 'd MMM y') || '—' }}</span>
                    </div>
                    <div class="mjs-deal-hero__stat">
                        <span class="mjs-deal-hero__stat-label">Pipeline</span>
                        <span class="mjs-deal-hero__stat-val">{{ PipelineName || '—' }}</span>
                    </div>
                    <div class="mjs-deal-hero__stat">
                        <span class="mjs-deal-hero__stat-label">Type</span>
                        <span class="mjs-deal-hero__stat-val">{{ TypeName || '—' }}</span>
                    </div>
                </div>
                @if (Record.NextStep) {
                    <div class="mjs-deal-hero__next">
                        <span class="mjs-deal-hero__stat-label">Next step</span>
                        <span class="mjs-deal-hero__next-val">{{ Record.NextStep }}</span>
                        @if (Record.NextStepDate) {
                            <span class="mjs-deal-hero__next-when">{{ Record.NextStepDate | date: 'd MMM y' }}</span>
                        }
                    </div>
                }
                @if (EditMode) {
                    <div class="mjs-deal-hero__edit">
                        <div class="mjs-deal-hero__field">
                            <mj-form-field [Record]="Record" [ShowLabel]="true" FieldName="Name"
                                Type="textbox" [EditMode]="EditMode" [FormContext]="FormContext"></mj-form-field>
                        </div>
                    </div>
                }
                @if (LockNotice) { <div class="mjs-flag">{{ LockNotice }}</div> }
                @if (StaleAmountNotice) { <div class="mjs-flag">{{ StaleAmountNotice }}</div> }
            }
        </div>
    `,
    styles: [`
        .mjs-deal-hero {
            display: flex; flex-direction: column; gap: var(--mj-space-4);
            padding: 20px 24px; margin-bottom: var(--mj-space-4);
            background: var(--mj-bg-surface-card);
            border: 1px solid var(--mj-border-default);
            border-radius: var(--mj-radius-xl, 16px);
            box-shadow: var(--mj-shadow-md, 0 4px 16px rgba(0, 0, 0, .08));
            position: relative; overflow: hidden;
            container-type: inline-size; container-name: mjs-deal-hero;
        }
        .mjs-deal-hero::before {
            content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3.5px;
            background: linear-gradient(90deg, #38bdf8 0%, #6366f1 50%, #10b981 100%);
        }
        .mjs-deal-hero__identity { display: flex; align-items: center; gap: var(--mj-space-4); min-width: 0; }
        .mjs-deal-hero__avatar {
            flex: none; width: 60px; height: 60px; border-radius: var(--mj-radius-lg, 14px);
            position: relative; display: flex; align-items: center; justify-content: center;
            background: linear-gradient(135deg, color-mix(in srgb, var(--mj-brand-primary) 30%, var(--mj-bg-surface)) 0%, color-mix(in srgb, var(--mj-brand-accent, #6366f1) 25%, var(--mj-bg-surface)) 100%);
            color: var(--mj-brand-primary); font-size: 1.35rem;
            box-shadow: 0 4px 14px color-mix(in srgb, var(--mj-brand-primary) 25%, transparent);
            border: 2px solid color-mix(in srgb, var(--mj-brand-primary) 35%, transparent);
        }
        .mjs-deal-hero__presence {
            position: absolute; bottom: -2px; right: -2px; width: 13px; height: 13px;
            border-radius: 50%; border: 2.5px solid var(--mj-bg-surface-card);
            background: var(--mj-text-muted, #94a3b8);
        }
        .mjs-deal-hero__presence[data-tone='success'] { background: var(--mj-status-success, #10b981); }
        .mjs-deal-hero__presence[data-tone='warning'] { background: var(--mj-status-warning, #f59e0b); }
        .mjs-deal-hero__copy { min-width: 0; flex: 1; }
        .mjs-deal-hero__title-row {
            display: flex; align-items: center; flex-wrap: wrap;
            gap: var(--mj-space-2) var(--mj-space-3);
        }
        .mjs-deal-hero__name {
            margin: 0; font-size: var(--mj-text-lg, 18px); font-weight: 800;
            letter-spacing: -.02em; line-height: 1.25; color: var(--mj-text-primary);
        }
        .mjs-deal-hero__aka { margin-top: 2px; font-size: var(--mj-text-xs); color: var(--mj-text-muted); }
        .mjs-deal-hero__badges {
            display: flex; align-items: center; flex-wrap: wrap;
            gap: var(--mj-space-2); margin-top: var(--mj-space-2);
        }
        .mjs-deal-hero__entity-chip {
            display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px;
            border-radius: var(--mj-radius-sm);
            background: var(--mj-status-info-bg); color: var(--mj-brand-primary);
            font-size: var(--mj-text-xs); font-weight: 650;
        }
        .mjs-deal-hero__chip {
            display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px;
            border-radius: 999px; font-size: var(--mj-text-xs); font-weight: 650;
            letter-spacing: .02em;
            background: var(--mj-bg-surface-sunken); color: var(--mj-text-secondary);
            border: 1px solid var(--mj-border-default);
        }
        .mjs-deal-hero__chip[data-tone='success'] {
            background: var(--mj-status-success-bg); color: var(--mj-status-success-text);
            border-color: var(--mj-status-success);
        }
        .mjs-deal-hero__chip[data-tone='success']::before {
            content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--mj-status-success);
        }
        .mjs-deal-hero__chip[data-tone='warning'] {
            background: var(--mj-status-warning-bg); color: var(--mj-status-warning-text);
            border-color: var(--mj-status-warning);
        }
        .mjs-deal-hero__toggle {
            display: inline-flex; align-items: center; justify-content: center;
            flex: none; width: 32px; height: 32px; margin-left: auto; padding: 0;
            border: 1px solid var(--mj-border-default); border-radius: var(--mj-radius-md, 8px);
            background: var(--mj-bg-surface-sunken, rgba(255,255,255,.04));
            color: var(--mj-text-secondary); cursor: pointer; font-size: 12px;
        }
        .mjs-deal-hero__toggle:hover {
            background: var(--mj-bg-surface-hover, rgba(255,255,255,.08));
            color: var(--mj-text-primary); border-color: var(--mj-brand-primary);
        }
        .mjs-deal-hero__summary {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: var(--mj-space-3); padding-top: var(--mj-space-4);
            border-top: 1px solid var(--mj-border-default);
        }
        .mjs-deal-hero__stat { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .mjs-deal-hero__stat-label {
            font-size: var(--mj-text-xs); font-weight: 700; letter-spacing: .04em;
            text-transform: uppercase; color: var(--mj-text-muted);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .mjs-deal-hero__stat-val {
            font-size: 15px; font-weight: 650; color: var(--mj-text-primary);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        button.mjs-deal-hero__stat-val, .mjs-deal-hero__stat-val.is-link {
            border: 0; padding: 0; background: transparent; color: var(--mj-text-link);
            cursor: pointer; font: inherit; font-weight: 650; text-align: left;
        }
        button.mjs-deal-hero__stat-val:hover { text-decoration: underline; }
        .mjs-deal-hero__next {
            display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 14px;
            padding: var(--mj-space-3) var(--mj-space-4);
            background: var(--mj-bg-page); border: 1px solid var(--mj-border-default);
            border-radius: var(--mj-radius-md);
        }
        .mjs-deal-hero__next-val { font-weight: 700; font-size: 15px; }
        .mjs-deal-hero__next-when { color: var(--mj-text-muted); font-size: var(--mj-text-sm); }
        .mjs-deal-hero__edit {
            display: flex; flex-direction: column; gap: var(--mj-space-3);
            padding-top: var(--mj-space-3); border-top: 1px solid var(--mj-border-subtle, var(--mj-border-default));
        }
        .mjs-deal-hero__field { min-width: 0; }
        .mjs-deal-hero__field .mj-forms-field {
            display: flex; flex-direction: column; align-items: stretch; gap: 4px; padding: 0;
        }
        .mjs-deal-hero__field .mj-forms-field-label {
            font-size: var(--mj-text-xs); font-weight: 700; letter-spacing: .06em;
            text-transform: uppercase; color: var(--mj-text-muted);
        }
        .mjs-flag {
            background: var(--mj-status-warning-bg); border-left: 3px solid var(--mj-status-warning);
            padding: var(--mj-space-2) var(--mj-space-3); font-size: var(--mj-text-xs);
            color: var(--mj-status-warning-text); border-radius: 0 var(--mj-radius-sm) var(--mj-radius-sm) 0;
        }
        .mjs-deal-hero--collapsed { padding: 12px 20px; gap: 0; margin-bottom: var(--mj-space-3); }
        .mjs-deal-hero--collapsed .mjs-deal-hero__avatar { width: 42px; height: 42px; border-radius: var(--mj-radius-md, 10px); font-size: 1.05rem; }
        .mjs-deal-hero--collapsed .mjs-deal-hero__name { font-size: 1.15rem; }
        @media (max-width: 720px) {
            .mjs-deal-hero__identity { align-items: flex-start; }
            .mjs-deal-hero__summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
    `],
})
export class MJSDealHeroPanel extends BaseFormPanel<DealEntity> {
    private readonly cdr = inject(ChangeDetectorRef);
    public Collapsed = false;
    public IsLocked = false;
    public LockNotice: string | null = null;
    public StaleAmountNotice: string | null = null;

    public async ngOnInit(): Promise<void> {
        const raw = UserInfoEngine.Instance.GetSetting(COLLAPSE_SETTING);
        if (raw) {
            try { this.Collapsed = JSON.parse(raw) === true; } catch { this.Collapsed = false; }
        }
        await this.refreshNotices();
    }

    public override OnRecordRefreshed(_record: DealEntity): void {
        void this.refreshNotices();
    }

    public ToggleCollapsed(): void {
        this.Collapsed = !this.Collapsed;
        UserInfoEngine.Instance.SetSettingDebounced(COLLAPSE_SETTING, JSON.stringify(this.Collapsed));
    }

    public get Title(): string {
        return this.Record?.Name?.trim() || this.Record?.DealNumber || 'New deal';
    }
    public get StatusName(): string { return String(this.Record?.DealStatusType ?? this.Record?.Get?.('DealStatusType') ?? ''); }
    public get ForecastName(): string { return String(this.Record?.ForecastCategoryType ?? this.Record?.Get?.('ForecastCategoryType') ?? ''); }
    public get AccountName(): string { return String(this.Record?.Account ?? this.Record?.Get?.('Account') ?? ''); }
    public get OwnerName(): string { return String(this.Record?.OwnerEmployee ?? this.Record?.Get?.('OwnerEmployee') ?? ''); }
    public get StageName(): string { return String(this.Record?.PipelineStage ?? this.Record?.Get?.('PipelineStage') ?? ''); }
    public get PipelineName(): string { return String(this.Record?.Pipeline ?? this.Record?.Get?.('Pipeline') ?? ''); }
    public get TypeName(): string { return String(this.Record?.DealType ?? this.Record?.Get?.('DealType') ?? ''); }

    public get AmountText(): string { return money(this.Record?.Amount); }
    public get WeightedText(): string {
        const a = Number(this.Record?.Amount);
        const p = Number(this.Record?.Probability);
        if (!Number.isFinite(a) || !Number.isFinite(p)) return '—';
        return money(a * p / 100);
    }
    public get StatusTone(): 'success' | 'warning' | 'muted' {
        const s = this.StatusName.toLowerCase();
        if (!s) return 'muted';
        if (s.includes('won') || s === 'open' || s.includes('active')) return 'success';
        if (s.includes('lost') || s.includes('dead') || s.includes('disqual') || this.IsLocked) return 'warning';
        return 'muted';
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

    private async refreshNotices(): Promise<void> {
        await this.resolveLock();
        await this.resolveStale();
        this.cdr.detectChanges();
    }

    private async resolveLock(): Promise<void> {
        const persisted = this.Record?.GetFieldByName?.('DealStatusTypeID')?.OldValue as string | null | undefined;
        const lock = await ResolveDealLockState(persisted ?? this.Record?.DealStatusTypeID);
        this.IsLocked = lock.IsLocked;
        this.LockNotice = lock.Notice;
    }

    private async resolveStale(): Promise<void> {
        this.StaleAmountNotice = null;
        const computedAt = this.Record?.AmountComputedAt;
        if (!this.Record?.AmountIsComputed || !computedAt || !this.Record.OrderID) return;
        const rv = new RunView();
        const result = await rv.RunView<{ __mj_UpdatedAt: string | Date }>({
            EntityName: E_ORDER_LINE,
            ExtraFilter: `OrderHeaderID = '${String(this.Record.OrderID).replace(/'/g, "''")}'`,
            OrderBy: '__mj_UpdatedAt DESC',
            ResultType: 'simple',
            Fields: ['__mj_UpdatedAt'],
        });
        const newest = result?.Success ? (result.Results ?? [])[0]?.__mj_UpdatedAt : undefined;
        if (newest && new Date(newest).getTime() > new Date(computedAt).getTime()) {
            this.StaleAmountNotice =
                'A line has changed since this amount was priced, so the total shown is out of date. Reprice from Orders — Sales does not recalculate it here.';
        }
    }
}
