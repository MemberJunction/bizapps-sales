/**
 * @fileoverview `mjs-deal-workspace` — one surface for viewing, editing and creating a deal.
 *
 * ONE SURFACE, NOT THREE. A deal being created is a draft whose `ID` is null; a deal being edited is a
 * draft whose `ID` is set. Nothing else differs, so nothing else is separate. Two surfaces for the same
 * record drift apart within a release, and the drift shows up as a field you can set on create but not
 * on edit. This follows bizapps-contracts' workspace, which merged them for the same reason.
 *
 * TWO INDEPENDENT TABBING SYSTEMS, and confusing them is the trap:
 *
 *   · The OUTER strip (from `mj-workspace-card`) is OPEN DEALS — several documents side by side, each
 *     closable, each holding its own draft. That is what makes "start a second deal without losing the
 *     first" work.
 *   · The INNER tabs are PANES OF ONE DEAL — party info, lines, schedule, terms, variances. A fixed
 *     set, always the same five.
 *
 * They are not the same widget and not the same state. The store owns the first; `ActivePane` owns the
 * second, per open deal.
 *
 * WHY THE DRAFT AND NOT THE ENTITY. A browser holds the GENERATED `mjBizAppsSalesDealEntity`, which has
 * no `.Lines`, so a deal and its children cannot be saved together through it — see `deal-draft.ts`.
 * Every edit here mutates a `DealDraft`, and saving sends the whole tree to `Sales.SaveDeal` in one
 * transaction.
 *
 * THIS COMPONENT COMPUTES NO MONEY. It does not total the lines, does not derive `Total` from
 * `AnnualGrossFees - DiscountAmount`, and does not check that the payment schedule adds up to anything.
 * Those three figures are transcribed from a signed document and the arithmetic on the page is the
 * customer's, not this app's. The one place a sum WOULD be legitimate — "is this deal worth what we
 * think" — is answered by `Orders.PreviewOrder` in a later phase, not here.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import {
    DealDraft,
    type DealDraftIssue,
    type DealDraftLine,
    type DealDraftScheduleRow,
    type DealDraftSection,
    type DealDraftValidation,
} from '@mj-biz-apps/sales-entities';

import { WorkspaceCardComponent } from '../vendored/workspace-tabs/workspace-card.component';
import { WorkspaceTabStore } from '../vendored/workspace-tabs/workspace-tab-store';
import type { WorkspaceTab } from '../vendored/workspace-tabs/workspace-tabs.types';
import type { TabReorder } from '../vendored/workspace-tabs/workspace-tab-strip.component';
import { DealWorkspaceService } from './deal-workspace.service';
import {
    DEAL_WORKSPACE_PANES,
    EmptyLookups,
    STANDARD_ANNUAL_INCREASE_PCT,
    STANDARD_CANCELLATION_NOTICE_DAYS,
    type DealLookup,
    type DealWorkspaceLookups,
    type DealWorkspacePane,
    type StageLookup,
} from './deal-workspace.types';

/** What one open document in the outer strip carries. */
interface OpenDeal {
    Draft: DealDraft;
    ActivePane: DealDraftSection;
}

@Component({
    standalone: true,
    selector: 'mjs-deal-workspace',
    imports: [CommonModule, FormsModule, SharedGenericModule, WorkspaceCardComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './deal-workspace.component.html',
    styleUrls: ['./deal-workspace.component.css'],
})
export class DealWorkspaceComponent implements OnInit {
    private readonly service = inject(DealWorkspaceService);
    private readonly cdr = inject(ChangeDetectorRef);

    /** The outer strip's state: which deals are open, and which is in front. */
    private readonly store = new WorkspaceTabStore<OpenDeal>();

    public readonly Panes: readonly DealWorkspacePane[] = DEAL_WORKSPACE_PANES;
    public readonly StandardAnnualIncreasePct = STANDARD_ANNUAL_INCREASE_PCT;
    public readonly StandardCancellationNoticeDays = STANDARD_CANCELLATION_NOTICE_DAYS;

    public Lookups: DealWorkspaceLookups = EmptyLookups();
    public readonly Loading = signal(true);
    public readonly Saving = signal(false);
    /** Last outcome, shown verbatim. The server's words, not a paraphrase of them. */
    public Message = '';
    public MessageIsError = false;

    /** Recomputed after every edit so tab badges and field markers agree by construction. */
    public Validation: DealDraftValidation = { IsValid: true, Issues: [] };

    // ── Lifecycle ───────────────────────────────────────────────────────────────

    public async ngOnInit(): Promise<void> {
        this.Lookups = await this.service.LoadLookups();
        this.Loading.set(false);
        // Open one blank deal so the surface is never an empty frame with nothing to do.
        this.NewDeal();
        this.cdr.detectChanges();
    }

    // ── The outer strip: open deals ─────────────────────────────────────────────

    public get Tabs(): WorkspaceTab<OpenDeal>[] {
        return this.store.Tabs;
    }

    public get ActiveId(): string | null {
        return this.store.ActiveId;
    }

    public get Active(): OpenDeal | null {
        return this.store.ActiveTab?.State ?? null;
    }

    public get Draft(): DealDraft | null {
        return this.Active?.Draft ?? null;
    }

    /** Opens a fresh blank deal in its own tab. */
    public NewDeal(): void {
        const draft = new DealDraft();
        // A single pipeline is not a choice — preselect it, and take its stage defaults with it.
        if (this.Lookups.Pipelines.length === 1) {
            this.SelectPipeline(draft, this.Lookups.Pipelines[0].ID);
        }
        this.store.Open({
            Id: `deal-new-${this.store.Count + 1}-${this.Tabs.length}`,
            Label: 'New deal',
            Icon: 'fa-solid fa-file-circle-plus',
            Status: 'draft',
            State: { Draft: draft, ActivePane: 'party' },
        });
        this.Revalidate();
    }

    /** Opens an existing deal, or focuses it if it is already open. */
    public async OpenDeal(dealID: string): Promise<void> {
        const tabId = `deal-${dealID}`;
        if (this.store.Activate(tabId)) {
            this.cdr.detectChanges();
            return;
        }
        this.Loading.set(true);
        this.cdr.detectChanges();

        const draft = await this.service.LoadDraft(dealID);
        this.Loading.set(false);

        if (!draft) {
            this.Fail(`Deal ${dealID} could not be loaded.`);
            return;
        }
        this.store.Open({
            Id: tabId,
            Label: draft.Header.Name || 'Deal',
            Icon: 'fa-solid fa-file-lines',
            Status: 'draft',
            State: { Draft: draft, ActivePane: 'party' },
        });
        this.store.MarkClean(tabId);
        this.Revalidate();
    }

    public SelectTab(id: string): void {
        this.store.Activate(id);
        this.Revalidate();
    }

    public CloseTab(id: string): void {
        this.store.Close(id);
        if (this.store.Count === 0) {
            this.NewDeal();
        }
        this.Revalidate();
    }

    public ReorderTabs(move: TabReorder): void {
        this.store.Reorder(move.previousIndex, move.currentIndex);
        this.cdr.detectChanges();
    }

    // ── The inner tabs: panes of the active deal ────────────────────────────────

    public get ActivePane(): DealDraftSection {
        return this.Active?.ActivePane ?? 'party';
    }

    public SelectPane(key: DealDraftSection): void {
        const active = this.Active;
        if (active) {
            active.ActivePane = key;
        }
        this.cdr.detectChanges();
    }

    /** Error count for a pane — what drives its badge. Warnings deliberately do not badge. */
    public ErrorCount(key: DealDraftSection): number {
        return this.Validation.Issues.filter((i) => i.Section === key && i.Severity === 'error').length;
    }

    /** Issues for the pane on screen, so each pane can list its own problems. */
    public IssuesForPane(key: DealDraftSection): DealDraftIssue[] {
        return this.Validation.Issues.filter((i) => i.Section === key);
    }

    /** Row-level issues, so a grid row can mark itself. */
    public IssuesForRow(clientKey: string): DealDraftIssue[] {
        return this.Validation.Issues.filter((i) => i.ClientKey === clientKey);
    }

    // ── Editing ────────────────────────────────────────────────────────────────

    /**
     * Called on every field change. Revalidates and marks the tab dirty — one entry point, so a new
     * field cannot forget to do either.
     */
    public Touch(): void {
        const id = this.store.ActiveId;
        const active = this.Active;
        if (id && active) {
            this.store.UpdateState(id, active, true);
            const tab = this.store.Tabs.find((t) => t.Id === id);
            if (tab) {
                // Keep the strip label honest as the deal gets named.
                tab.Label = active.Draft.Header.Name?.trim() || (active.Draft.IsNew ? 'New deal' : 'Deal');
            }
        }
        this.Revalidate();
    }

    /**
     * Choosing a pipeline also chooses the selling company and the available stages, so it cannot be a
     * plain field binding.
     *
     * `CompanyID` is set here only so the header can DISPLAY it — the server derives it from the
     * pipeline on save regardless and ignores whatever the client sent, because the pipeline is the only
     * source that can be correct.
     */
    public SelectPipeline(draft: DealDraft, pipelineID: string | null): void {
        draft.Header.PipelineID = pipelineID;
        const pipeline = this.Lookups.Pipelines.find((p) => p.ID === pipelineID) ?? null;
        draft.Header.CompanyID = pipeline?.CompanyID ?? null;

        // A stage from the previous pipeline is meaningless now.
        const stages = this.StagesFor(pipelineID);
        if (!stages.some((s) => s.ID === draft.Header.PipelineStageID)) {
            draft.Header.PipelineStageID = stages[0]?.ID ?? null;
            this.ApplyStageDefaults(draft, draft.Header.PipelineStageID);
        }
    }

    public StagesFor(pipelineID: string | null): StageLookup[] {
        if (!pipelineID) {
            return [];
        }
        return this.Lookups.Stages.filter((s) => s.PipelineID === pipelineID);
    }

    /**
     * A stage carries the probability and forecast category the pipeline designer chose for it, so
     * moving stages inherits them rather than asking the rep to retype what the process already knows.
     * Both remain editable afterwards.
     */
    public ApplyStageDefaults(draft: DealDraft, stageID: string | null): void {
        const stage = this.Lookups.Stages.find((s) => s.ID === stageID);
        if (!stage) {
            return;
        }
        draft.Header.Probability = stage.Probability;
        draft.Header.ForecastCategoryTypeID = stage.ForecastCategoryTypeID;
    }

    public OnStageChange(draft: DealDraft, stageID: string | null): void {
        draft.Header.PipelineStageID = stageID;
        this.ApplyStageDefaults(draft, stageID);
        this.Touch();
    }

    public AddLine(): void {
        this.Draft?.AddLine();
        this.Touch();
    }

    public RemoveLine(line: DealDraftLine): void {
        this.Draft?.RemoveLine(line);
        this.Touch();
    }

    public AddScheduleRow(): void {
        this.Draft?.AddScheduleRow();
        this.Touch();
    }

    public RemoveScheduleRow(row: DealDraftScheduleRow): void {
        this.Draft?.RemoveScheduleRow(row);
        this.Touch();
    }

    // ── Display helpers ────────────────────────────────────────────────────────

    /**
     * The customer name for the persistent context header.
     *
     * Resolved from the lookup list rather than read off the deal, because a Deal row CANNOT resolve its
     * own account name — `AccountID` points at an IsA child whose Name lives on the parent, and CodeGen
     * generates no join through that edge (KI-8).
     */
    public get CustomerName(): string {
        const id = this.Draft?.Header.AccountID;
        if (!id) {
            return 'No customer selected';
        }
        return this.Lookups.Accounts.find((a) => a.ID === id)?.Name ?? '(unknown account)';
    }

    public get CompanyName(): string | null {
        const id = this.Draft?.Header.PipelineID;
        return this.Lookups.Pipelines.find((p) => p.ID === id)?.CompanyName ?? null;
    }

    public NameOf(list: DealLookup[], id: string | null): string {
        if (!id) {
            return '—';
        }
        return list.find((x) => x.ID === id)?.Name ?? '—';
    }

    public get CanSave(): boolean {
        return !!this.Draft && this.Validation.IsValid && !this.Saving();
    }

    /** Tooltip on a disabled Save — the reason, not just the fact. */
    public get SaveBlockedReason(): string | null {
        if (this.Saving()) {
            return 'Saving…';
        }
        if (!this.Validation.IsValid) {
            const first = this.Validation.Issues.find((i) => i.Severity === 'error');
            return first ? `${first.Message}` : 'The deal is not ready to save.';
        }
        return null;
    }

    // ── Saving ─────────────────────────────────────────────────────────────────

    /**
     * One transactional call. The draft either lands whole — header, lines and schedule — or nothing
     * changes; there is no path here that leaves a numbered deal with nothing under it.
     */
    public async Save(): Promise<void> {
        const draft = this.Draft;
        const tabId = this.store.ActiveId;
        if (!draft || !tabId || this.Saving()) {
            return;
        }

        // Client-side validation first, so an obviously incomplete draft costs no round trip.
        this.Revalidate();
        if (!this.Validation.IsValid) {
            this.Fail('Fix the highlighted fields first.');
            return;
        }

        this.Saving.set(true);
        this.Message = '';
        this.cdr.detectChanges();

        try {
            const outcome = await this.service.Save(draft);

            if (!outcome.Success) {
                // Server issues REPLACE the client's, so the surface shows the authoritative refusal
                // rather than two competing explanations of the same problem.
                if (outcome.Issues.length) {
                    this.Validation = {
                        IsValid: false,
                        Issues: outcome.Issues.map((i) => ({
                            Section: i.Section as DealDraftSection,
                            Field: i.Field ?? null,
                            ClientKey: i.ClientKey ?? null,
                            Severity: i.Severity,
                            Message: i.Message,
                        })),
                    };
                }
                this.Fail(outcome.ErrorMessage ?? outcome.Issues[0]?.Message ?? 'The deal could not be saved.');
                return;
            }

            // The draft now carries the server's IDs, so this tab becomes an EDIT of a real record.
            this.store.Close(tabId);
            this.store.Open({
                Id: `deal-${outcome.DealID}`,
                Label: draft.Header.Name?.trim() || 'Deal',
                Icon: 'fa-solid fa-file-lines',
                Status: 'complete',
                State: { Draft: draft, ActivePane: this.ActivePane },
            });
            this.store.MarkClean(`deal-${outcome.DealID}`);
            this.MessageIsError = false;
            this.Message = outcome.Created ? 'Deal created.' : 'Deal saved.';
            this.Revalidate();
        } finally {
            this.Saving.set(false);
            this.cdr.detectChanges();
        }
    }

    /** Drops the active tab's edits. For a saved deal, reloads it; for a new one, closes it. */
    public async Discard(): Promise<void> {
        const draft = this.Draft;
        const tabId = this.store.ActiveId;
        if (!draft || !tabId) {
            return;
        }
        if (draft.IsNew) {
            this.CloseTab(tabId);
            this.Message = '';
            this.cdr.detectChanges();
            return;
        }
        const id = draft.Header.ID as string;
        this.store.Close(tabId);
        await this.OpenDeal(id);
    }

    // ── Internals ──────────────────────────────────────────────────────────────

    private Revalidate(): void {
        this.Validation = this.Draft?.Validate() ?? { IsValid: true, Issues: [] };
        this.cdr.detectChanges();
    }

    private Fail(message: string): void {
        this.MessageIsError = true;
        this.Message = message;
        this.cdr.detectChanges();
    }
}
