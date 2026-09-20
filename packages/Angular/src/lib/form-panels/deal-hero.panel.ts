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
import { AfterViewInit, ChangeDetectorRef, Component, DoCheck, ElementRef, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompositeKey } from '@memberjunction/core';
import { UserInfoEngine } from '@memberjunction/core-entities';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel, BaseFormsModule, FormChromeCoordinator } from '@memberjunction/ng-base-forms';
import { RelatedChipsComponent, type BizAppsRelatedLink } from '@mj-biz-apps/common-ng';
import {
    DealEntity,
    IsDealFieldEditableWhileLocked,
    ResolveDealAmountFreshness,
    ResolveDealLockState,
} from '@mj-biz-apps/sales-entities';
import { MJS_ENTITIES, MJS_FOREIGN_ENTITIES } from '../data/entity-names';
import { DealRelatedLinks, DealRelatedLinksKey } from './deal-related-links';


/**
 * Should the cursor be placed in the hero Name field?
 *
 * Pure and exported so the rules can be pinned without a DOM. The component owns only the two
 * things that genuinely need one: finding the input, and calling focus on it.
 *
 * bc-aidp-next-golive#188 asks for the cursor to land in Name when a NEW deal opens. Each clause
 * here is a way that would go wrong:
 *
 *  - a SAVED record must never have focus taken: it would fight anyone navigating by keyboard and
 *    move the caret out from under a reader who had already chosen where to be;
 *  - READ mode has no input to focus at all;
 *  - it happens ONCE per record, so a re-render does not yank the cursor back mid-sentence;
 *  - and if focus already reached another field, the user got there first and keeping it is worth
 *    more than the help.
 */
export function ShouldPlaceCursorInName(state: {
    HasRecord: boolean;
    IsSaved: boolean;
    EditMode: boolean;
    RecordKey: string;
    AlreadyPlacedFor: string | null;
    FocusAlreadyElsewhere: boolean;
}): boolean {
    if (!state.HasRecord) return false;
    if (state.IsSaved) return false;
    if (!state.EditMode) return false;
    if (state.AlreadyPlacedFor === state.RecordKey) return false;
    if (state.FocusAlreadyElsewhere) return false;
    return true;
}
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
    imports: [CommonModule, BaseFormsModule, RelatedChipsComponent],
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
                    <!-- Not collapsed-gated, for the same reason the Name editor is not: the
                         Pipeline panel used to carry a Deal Number box, so a collapsed header still
                         showed the number somewhere. Removing that duplicate
                         (bc-aidp-next-golive#190) made this the only place it appears, and Collapsed
                         is a persisted per-user setting. The number is identity, not briefing. -->
                    @if (Record.DealNumber) {
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
            <!--
                 THE RELATED ROW IS SHARED, NOT OURS (golive#225, #226).

                 All this hero decides is WHICH relationships a deal has - the rule is in
                 deal-related-links.ts, where a test can reach it. Reading each record's NAME, and
                 deciding when a chip must not be drawn at all (the app is not installed here, the
                 record is not there, the user may not read it), belongs to bizapps-related-chips
                 in common. Sales, contracts and orders each had their own answer to that or none,
                 which is the divergence golive#225 built the shared row to end.

                 OUTSIDE THE COLLAPSED REGION, for the reason the Name editor below is: Collapsed
                 is a persisted per-user setting, and these chips are now the ONLY route from a won
                 deal to its order - the Motion panel's order link came off with them (#226 item 4).
                 Gating them would mean anyone who had ever collapsed the header could not reach the
                 order at all, which is the bug this issue reported, reintroduced one fold deeper.
            -->
            <bizapps-related-chips
                [Links]="RelatedLinks"
                [Provider]="FormComponent.ProviderToUse"
                (Navigate)="FormComponent.OnFormNavigate($event)" />
            <!-- OUTSIDE the collapsed region, deliberately. Collapsing hides the BRIEFING - the
                 account/owner/stage stats - not the control that names the record. The Pipeline
                 panel used to carry a second Name box, so a collapsed header still left somewhere
                 to type; removing that duplicate (bc-aidp-next-golive#189) made this the only one.
                 Collapsed is a persisted per-user setting, so anyone who had ever collapsed the
                 header would otherwise have had no way to name a deal at all. -->
            @if (EditMode) {
                <div class="mjs-deal-hero__edit">
                    <div class="mjs-deal-hero__field">
                        <mj-form-field [Record]="Record" [ShowLabel]="true" FieldName="Name"
                            Type="textbox" [EditMode]="EditMode && NameEditable"
                            [FormContext]="FormContext"></mj-form-field>
                    </div>
                </div>
            }
            <!--
                 A NEW DEAL GETS GUIDANCE INSTEAD OF A BRIEFING.

                 Products live on the ORDER a deal mints when it is first saved, so there is nothing to
                 add them to until then. The "What's being sold" panel says so, but it is collapsed by
                 default and a rep reported no way to add products and no message saying why
                 (golive#216) — a hint nobody opens is not a hint. It is repeated here, where a new deal
                 already is, so the sequence is visible before the search for a missing button starts.

                 Outside the collapsed region for the same reason the Name editor is: Collapsed is a
                 persisted per-user setting, and this is the one instruction that makes the form usable.
            -->
            @if (!Record.IsSaved) {
                <div class="mjs-flag mjs-flag--guide">
                    Save this deal to create its order. Products are added after that.
                </div>
            }
            <!--
                 THE BRIEFING IS FOR A DEAL THAT EXISTS. Account, owner, amount, stage and next step are
                 all empty on a record nobody has saved, so an unsaved deal rendered a grid of dashes
                 under the name it was still being given. IsSaved, not EditMode: a saved deal being
                 edited still has all of this to show, and hiding it there would take the briefing away
                 from the only person who needs it.
            -->
            @if (!Collapsed && Record.IsSaved) {
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
                            <span class="mjs-deal-hero__stat-val">{{ OwnerName || 'No owner' }}</span>
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
                    <!-- A CLOSED DEAL REPORTS, IT DOES NOT FORECAST (golive#231 item 4). This stat
                         showed ExpectedCloseDate whatever had happened, so a deal that closed in March
                         still announced a February expectation under a label that reads as fact. -->
                    <div class="mjs-deal-hero__stat">
                        <span class="mjs-deal-hero__stat-label">{{ CloseStatLabel }}</span>
                        <span class="mjs-deal-hero__stat-val">{{ CloseStatValue }}</span>
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
        /* The chip row brings its own styling — design tokens, its own class prefix — so the hero
           only places it. 'display: contents' rather than a margin because the hero is a COLUMN FLEX
           WITH A GAP: a host box that renders nothing still takes a gap, so every open deal (no
           chips at all) would grow a band of dead space under its title. With 'contents' the host
           makes no box, and an empty row contributes no flex item and therefore no gap. */
        .mjs-deal-hero bizapps-related-chips { display: contents; }
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
        /**
         * Guidance, not a warning. .mjs-flag is the warning tone -- correct for a lock or a stale
         * amount, wrong for "here is the next step", which would otherwise tell a rep that naming a new
         * deal had gone wrong.
         *
         * Each token carries a fallback because only --mj-status-info-bg is in use anywhere in this
         * package; an undefined --mj-status-info would silently paint a transparent border and this
         * would read as an unstyled paragraph.
         */
        .mjs-flag--guide {
            background: var(--mj-status-info-bg, var(--mj-color-surface-raised));
            border-left-color: var(--mj-status-info, var(--mj-color-primary));
            color: var(--mj-status-info-text, var(--mj-color-text-primary));
            margin-top: var(--mj-space-2);
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
export class MJSDealHeroPanel extends BaseFormPanel<DealEntity> implements AfterViewInit, DoCheck {
    private readonly cdr = inject(ChangeDetectorRef);
    private readonly host = inject(ElementRef<HTMLElement>);
    /** The record the cursor has already been placed for, so it is never taken twice. */
    private focusedFor: string | null = null;
    public Collapsed = false;
    public IsLocked = false;
    /** Whether the locking status is a LOSS. Only Loss Notes turns on it (golive#206). */
    public IsLost = false;
    /** Whether the PERSISTED status is a WIN — its own flag, never `!IsLost`. Decides the Order and
     *  Contract chips (golive#226); the Overview's outcome tiles read it too (golive#231). */
    public IsWon = false;

    /** The links last published to the chip row, and the state they were built from. */
    private relatedFor: string | null = null;
    private relatedLinks: BizAppsRelatedLink[] = [];

    /**
     * May the deal's Name be typed into right now? (bc-aidp-next-golive#206 item 3)
     *
     * The issue asks for every field on "the header and ... the Pipeline, Account & people, Commercial,
     * Motion and Close panels" to render read-only on a locked deal, and the tester's own reproduction
     * lists Name FIRST: "Click Edit on the deal. Name, Pipeline, Account, Commercial, Motion and Close
     * fields all become editable." The five panels were gated and the header was not, which left Name as
     * the ONE field on the whole form that still accepted typing on a closed deal -- and the server then
     * refused it on save, which is precisely the behaviour item 3 exists to remove.
     *
     * Asks `IsDealFieldEditableWhileLocked`, the SAME rule the entity server enforces, rather than
     * testing `IsLocked` alone. Name is not in that set today; if it is ever added, this agrees with the
     * server automatically instead of having to be found and changed.
     */
    public get NameEditable(): boolean {
        return !this.IsLocked || IsDealFieldEditableWhileLocked('Name', this.IsLost);
    }
    public LockNotice: string | null = null;
    public StaleAmountNotice: string | null = null;

    public async ngOnInit(): Promise<void> {
        const raw = UserInfoEngine.Instance.GetSetting(COLLAPSE_SETTING);
        if (raw) {
            try { this.Collapsed = JSON.parse(raw) === true; } catch { this.Collapsed = false; }
        }
        await this.refreshNotices();
    }

    /**
     * No focus attempt here, deliberately. `OnRecordRefreshed` fires after the parent form reloads
     * the record FROM THE DATABASE, so the record is saved by definition — and the first rule in
     * `ShouldPlaceCursorInName` declines saved records. Calling it here could never place a cursor;
     * `ngAfterViewInit` is the one that does the work.
     */
    public override OnRecordRefreshed(_record: DealEntity): void {
        void this.refreshNotices();
    }

    /**
     * WHERE A DEAL GOES ONCE IT EXISTS.
     *
     * A NEW deal opens on Pipeline — the Pipeline panel declares `leadsWhenUnsaved`, deliberately
     * (golive#188), because a summary of a record with no data is a page of blanks. Once it is saved
     * that reasoning inverts: the summary now has something to summarise, and the rep has just
     * finished the thing Pipeline was for.
     *
     * MJ persists the active group only for a SAVED record (`ShouldPersistChromeActiveGroup`), so
     * nothing moved the rail on that transition and a rep was left looking at the form they had just
     * completed.
     *
     * ── WHY THE HERO AND NOT THE PIPELINE PANEL ─────────────────────────────────────────────────
     *
     * Two reasons, and the second is the load-bearing one. The hero is rendered for every section, so
     * it sees the save whichever rail item the rep happens to be on. And `MJSDealPipelinePanel`
     * deliberately avoids `inject()` — its own comment records that a `ChangeDetectorRef` would need
     * an injection context and `new MJSDealPipelinePanel()` would stop working in its tests.
     *
     * ── THE CROSSING IS THE WHOLE RULE ──────────────────────────────────────────────────────────
     *
     * Keyed on the TRANSITION, not on `IsSaved`: a deal that is already saved must never be dragged to
     * Overview, or a rep could not stay on any other section for the rest of its life. That single
     * test also makes it fire once — after the crossing `wasSaved` is true, so every later pass
     * returns. A separate once-per-record flag was written here first and a mutation proved it inert:
     * it guarded nothing the transition did not already guard, while reading as though it did.
     */
    private wasSaved: boolean | null = null;
    private readonly chrome = inject(FormChromeCoordinator, { optional: true });

    public ngDoCheck(): void {
        const record = this.Record;
        if (!record) return;

        const saved = !!record.IsSaved;
        const was = this.wasSaved;
        this.wasSaved = saved;

        // Only the crossing counts, and only once for this record.
        if (was !== false || !saved) return;
        this.chrome?.SetActiveGroup('overview');
    }

    public ngAfterViewInit(): void {
        this.focusNameOnNewRecord();
    }

    /**
     * Put the cursor in Name when a NEW deal opens (bc-aidp-next-golive#188).
     *
     * The report is explicit: clicking New Deal should open the form with focus in the name box
     * rather than leaving the user to notice where typing starts. Name lives in this hero rather
     * than in any panel, so this is the only component that can do it.
     *
     * ONLY FOR AN UNSAVED RECORD, AND ONLY ONCE. Taking focus when someone opens an EXISTING deal
     * would fight anyone navigating by keyboard and move the caret out from under a reader who had
     * already chosen where to be. A new record has exactly one sensible first field; a saved one
     * does not.
     *
     * It also declines if focus has already reached another field — a fast typist can get there
     * before the view settles, and taking it back is worse than not helping at all.
     *
     * It reaches into the DOM because `mj-form-field` exposes no focus API. The alternative is a
     * change to MJ and another release for a cursor position.
     */
    private focusNameOnNewRecord(): void {
        const record = this.Record;
        const key = record?.ID || 'new';

        // Cheap pre-check on what is knowable without the DOM, so the common case costs nothing.
        if (!ShouldPlaceCursorInName({
            HasRecord: !!record,
            IsSaved: !!record?.IsSaved,
            EditMode: this.EditMode,
            RecordKey: key,
            AlreadyPlacedFor: this.focusedFor,
            FocusAlreadyElsewhere: false,
        })) return;

        // After the current turn, so `mj-form-field` has rendered the input this looks for.
        setTimeout(() => {
            const el = this.host.nativeElement as HTMLElement;
            const input = el.querySelector<HTMLInputElement>('.mjs-deal-hero__field input');
            if (!input || input.disabled || input.readOnly) return;

            const active = document.activeElement;
            const elsewhere = active instanceof HTMLElement
                && !el.contains(active)
                && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName);

            if (!ShouldPlaceCursorInName({
                HasRecord: !!this.Record,
                IsSaved: !!this.Record?.IsSaved,
                EditMode: this.EditMode,
                RecordKey: key,
                AlreadyPlacedFor: this.focusedFor,
                FocusAlreadyElsewhere: elsewhere,
            })) return;

            this.focusedFor = key;
            input.focus();
        });
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

    /**
     * Has the deal actually closed? (golive#231)
     *
     * The CLOSE STAMPS, not the status — the same rule the Overview's `IsClosed` uses and for the same
     * reason: the stamps are what the server writes when the close really runs, so keying on the status
     * would report a deal closed the moment somebody picked Won. Either stamp counts; a legacy row may
     * carry only one.
     */
    public get IsClosed(): boolean {
        return !!(this.Record?.ClosedAt ?? this.Record?.ActualCloseDate);
    }

    /** "Closed" once it has happened, "Close" while it is still a forecast. */
    public get CloseStatLabel(): string { return this.IsClosed ? 'Closed' : 'Close'; }

    /** The date it closed on, or the date it is expected to. */
    public get CloseStatValue(): string {
        const when = this.IsClosed
            ? (this.Record?.ActualCloseDate ?? this.Record?.ClosedAt)
            : this.Record?.ExpectedCloseDate;
        if (!when) return '—';
        return new Date(when).toLocaleDateString(undefined, {
            day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
        });
    }

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

    /**
     * The relationships this deal offers, as descriptors for the shared chip row.
     *
     * RETURNS A STABLE ARRAY. `bizapps-related-chips` re-resolves whenever `Links` is a new
     * reference and reads the input on every change-detection pass, so a getter that built a fresh
     * array each pass would hold it in a permanent re-read loop. The key changes exactly when the
     * answer would, including on the record id — a form container reuses this panel across records,
     * and stale chips offer a click that opens the previous deal's order.
     */
    public get RelatedLinks(): BizAppsRelatedLink[] {
        const state = {
            IsWon: this.IsWon,
            OrderID: this.Record?.OrderID,
            ContractID: this.Record?.ContractID,
            RenewsContractID: this.Record?.RenewsContractID,
        };
        const key = DealRelatedLinksKey(this.Record?.ID, state);
        if (this.relatedFor !== key) {
            this.relatedFor = key;
            this.relatedLinks = DealRelatedLinks(state);
        }
        return this.relatedLinks;
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
        this.IsLost = lock.IsLost;
        this.IsWon = lock.IsWon;
        this.LockNotice = lock.Notice;
    }

    /**
     * Whether the cached amount still matches its order — through the SHARED rule, so this panel and the
     * Deal form cannot disagree. See `amount-freshness.ts` for why it is no longer a timestamp test
     * (golive#230), and note the ordering: `refreshNotices()` resolves the lock first, so `IsLocked` is
     * settled before it is passed here and a closed deal never warns.
     */
    private async resolveStale(): Promise<void> {
        this.StaleAmountNotice = null;
        if (!this.Record) return;
        const freshness = await ResolveDealAmountFreshness({
            IsLocked: this.IsLocked,
            AmountIsComputed: this.Record.AmountIsComputed,
            Amount: this.Record.Amount,
            OrderID: this.Record.OrderID,
        });
        this.StaleAmountNotice = freshness.Notice;
    }
}
