/**
 * @fileoverview `mjs-deal-workspace` — one surface for viewing, editing and creating a deal.
 *
 * ONE SURFACE, NOT THREE. A deal being created is an unsaved `DealEntity`; a deal being edited is a saved
 * one. Nothing else differs, so nothing else is separate. Two surfaces for the same record drift apart
 * within a release, and the drift shows up as a field you can set on create but not on edit. This follows
 * bizapps-contracts' workspace, which merged them for the same reason.
 *
 * TWO INDEPENDENT TABBING SYSTEMS, and confusing them is the trap:
 *
 *   · The OUTER strip (from `mj-workspace-card`) is OPEN DEALS — several documents side by side, each
 *     closable, each holding its own entity. That is what makes "start a second deal without losing the
 *     first" work.
 *   · The INNER tabs are PANES OF ONE DEAL — party info, lines, schedule, terms, variances. A fixed set,
 *     always the same five.
 *
 * They are not the same widget and not the same state. The store owns the first; `ActivePane` owns the
 * second, per open deal.
 *
 * ── THE ENTITY IS THE MODEL. THREE THINGS THAT FOLLOW FROM IT ───────────────────────────────────
 *
 * This component used to bind to a `DealDraft` — a UI-side model with its own arrays — because the entity
 * a browser held had no child collections. It has them now (`Lines`, `PaymentSchedule`, `Team` as Related
 * Record Collections), so the surface binds to the real record and `Save()` persists the whole graph in
 * one transaction. Three consequences are load-bearing rather than incidental:
 *
 * 1. **REMOVING A ROW IS AN EXPLICIT `Remove()`.** The old model sent its lines as the complete desired
 *    set, so dropping a row from an array was enough to delete it. A collection does NOT work that way:
 *    it deletes only what was explicitly removed, and a row merely absent from the array survives in the
 *    database. Every delete affordance here therefore calls `collection.Remove(row)` — never a splice, a
 *    filter, or a rebuild.
 * 2. **THE COLLECTIONS ARE LOADED ONCE**, by the service, when the deal opens. Nothing here re-loads, and
 *    nothing may pass `force` — a load arriving mid-edit replaces the in-memory rows with the database's
 *    and takes the user's typing with it.
 * 3. **CHANGING SOMEBODY'S ROLE IS A REMOVE PLUS AN ADD**, not an edit, because `DealTeamMember` is
 *    unique on *(deal, person, role)*. `DealEntity.SetOwner` does exactly that; the picker calls it.
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
import type {
    DealEntity,
    mjBizAppsSalesDealLineEntity,
    mjBizAppsSalesDealPaymentScheduleEntity,
} from '@mj-biz-apps/sales-entities';

import { WorkspaceCardComponent } from '../vendored/workspace-tabs/workspace-card.component';
import { WorkspaceTabStore } from '../vendored/workspace-tabs/workspace-tab-store';
import type { WorkspaceTab } from '../vendored/workspace-tabs/workspace-tabs.types';
import type { TabReorder } from '../vendored/workspace-tabs/workspace-tab-strip.component';
import { DealWorkspaceService } from './deal-workspace.service';
import { FromDateInput, ToDateInput } from './deal-workspace.dates';
import {
    EmptyValidation,
    ProjectValidation,
    type DealWorkspaceIssue,
    type DealWorkspaceSection,
    type DealWorkspaceValidation,
} from './deal-workspace.validation';
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
    Deal: DealEntity;
    ActivePane: DealWorkspaceSection;
}

/**
 * The header's date fields, as a closed set.
 *
 * A union rather than a plain `string`, so `SetDealDate` can assign through it without a cast: every
 * member holds `Date | null`, which is what makes the indexed write type-check. Adding a date column to
 * the form means adding it here, and forgetting to is a compile error rather than a silently dead input.
 */
type DealDateField = 'ExecutionDate' | 'StartDate' | 'ExpectedCloseDate' | 'NextStepDate';

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
    public Validation: DealWorkspaceValidation = EmptyValidation();

    // ── Lifecycle ───────────────────────────────────────────────────────────────

    public async ngOnInit(): Promise<void> {
        this.Lookups = await this.service.LoadLookups();
        this.Loading.set(false);
        // Open one blank deal so the surface is never an empty frame with nothing to do.
        await this.NewDeal();
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

    public get Deal(): DealEntity | null {
        return this.Active?.Deal ?? null;
    }

    /** True when the active deal has never been saved — what the strip reads to say "New deal". */
    public get IsNew(): boolean {
        const deal = this.Deal;
        return !!deal && !deal.IsSaved;
    }

    /** Opens a fresh blank deal in its own tab. */
    public async NewDeal(): Promise<void> {
        const deal = await this.service.NewDeal();
        // A single pipeline is not a choice — preselect it, and take its stage defaults with it.
        if (this.Lookups.Pipelines.length === 1) {
            this.SelectPipeline(deal, this.Lookups.Pipelines[0].ID);
        }
        this.store.Open({
            Id: `deal-new-${this.store.Count + 1}-${this.Tabs.length}`,
            Label: 'New deal',
            Icon: 'fa-solid fa-file-circle-plus',
            Status: 'draft',
            State: { Deal: deal, ActivePane: 'party' },
        });
        this.Revalidate();
    }

    /**
     * Opens an existing deal, or focuses it if it is already open.
     *
     * Returns whether it opened, so a caller that owns a list can say something useful about the
     * failure — the likeliest causes are that the deal was deleted since that list loaded, or that one of
     * its child collections could not be read. A silent no-op is indistinguishable from a dead control.
     */
    public async OpenDeal(dealID: string): Promise<boolean> {
        const tabId = `deal-${dealID}`;
        if (this.store.Activate(tabId)) {
            this.cdr.detectChanges();
            return true;
        }
        this.Loading.set(true);
        this.cdr.detectChanges();

        const deal = await this.service.LoadDeal(dealID);
        this.Loading.set(false);

        if (!deal) {
            this.Fail(`Deal ${dealID} could not be loaded.`);
            return false;
        }
        this.store.Open({
            Id: tabId,
            Label: deal.Name || 'Deal',
            Icon: 'fa-solid fa-file-lines',
            Status: 'draft',
            State: { Deal: deal, ActivePane: 'party' },
        });
        this.store.MarkClean(tabId);
        this.Revalidate();
        return true;
    }

    public SelectTab(id: string): void {
        this.store.Activate(id);
        this.Revalidate();
    }

    public CloseTab(id: string): void {
        this.store.Close(id);
        if (this.store.Count === 0) {
            void this.NewDeal();
        }
        this.Revalidate();
    }

    public ReorderTabs(move: TabReorder): void {
        this.store.Reorder(move.previousIndex, move.currentIndex);
        this.cdr.detectChanges();
    }

    // ── The inner tabs: panes of the active deal ────────────────────────────────

    public get ActivePane(): DealWorkspaceSection {
        return this.Active?.ActivePane ?? 'party';
    }

    public SelectPane(key: DealWorkspaceSection): void {
        const active = this.Active;
        if (active) {
            active.ActivePane = key;
        }
        this.cdr.detectChanges();
    }

    /** Error count for a pane — what drives its badge. Warnings deliberately do not badge. */
    public ErrorCount(key: DealWorkspaceSection): number {
        return this.Validation.Issues.filter((i) => i.Section === key && i.Severity === 'error').length;
    }

    /** Issues for the pane on screen, so each pane can list its own problems. */
    public IssuesForPane(key: DealWorkspaceSection): DealWorkspaceIssue[] {
        return this.Validation.Issues.filter((i) => i.Section === key);
    }

    /**
     * Row-level issues, so a grid row can mark itself.
     *
     * Addressed by POSITION, because the collection is the model: the grid iterates `Items` and the
     * validator labels a child error `Lines[3].Quantity`, so both sides already agree on the index. The
     * retired draft needed a client-generated key because its rows predated any collection.
     */
    public IssuesForRow(section: DealWorkspaceSection, index: number): DealWorkspaceIssue[] {
        return this.Validation.Issues.filter((i) => i.Section === section && i.RowIndex === index);
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
                tab.Label = active.Deal.Name?.trim() || (active.Deal.IsSaved ? 'Deal' : 'New deal');
            }
        }
        this.Revalidate();
    }

    /**
     * Choosing a pipeline also chooses the selling company and the available stages, so it cannot be a
     * plain field binding.
     *
     * `CompanyID` is set here so the header can display it and so the record validates locally. The
     * pipeline remains the authority — it is the only source that can be correct about which company is
     * selling.
     */
    public SelectPipeline(deal: DealEntity, pipelineID: string | null): void {
        deal.PipelineID = pipelineID as string;
        const pipeline = this.Lookups.Pipelines.find((p) => p.ID === pipelineID) ?? null;
        if (pipeline) {
            deal.CompanyID = pipeline.CompanyID;
        }

        // A stage from the previous pipeline is meaningless now.
        const stages = this.StagesFor(pipelineID);
        if (!stages.some((s) => s.ID === deal.PipelineStageID)) {
            deal.PipelineStageID = stages[0]?.ID ?? null;
            this.ApplyStageDefaults(deal, deal.PipelineStageID);
        }
    }

    public StagesFor(pipelineID: string | null): StageLookup[] {
        if (!pipelineID) {
            return [];
        }
        return this.Lookups.Stages.filter((s) => s.PipelineID === pipelineID);
    }

    /**
     * A stage carries the probability and forecast category the pipeline designer chose for it, so moving
     * stages inherits them rather than asking the rep to retype what the process already knows. Both
     * remain editable afterwards.
     */
    public ApplyStageDefaults(deal: DealEntity, stageID: string | null): void {
        const stage = this.Lookups.Stages.find((s) => s.ID === stageID);
        if (!stage) {
            return;
        }
        deal.Probability = stage.Probability;
        deal.ForecastCategoryTypeID = stage.ForecastCategoryTypeID;
    }

    public OnStageChange(deal: DealEntity, stageID: string | null): void {
        deal.PipelineStageID = stageID;
        this.ApplyStageDefaults(deal, stageID);
        this.Touch();
    }

    /**
     * Records who owns the deal, through the team roster.
     *
     * NOT a plain binding to `OwnerEmployeeID`: that column is a server-maintained STAMP derived from the
     * `DealTeamMember` row carrying the owner role. `SetOwner` writes the roster (remove-then-add, because
     * the role is unique per deal) and sets the stamp optimistically so the picker reflects the choice
     * before the save.
     */
    public async OnOwnerChange(deal: DealEntity, employeeID: string | null): Promise<void> {
        try {
            await deal.SetOwner(employeeID);
        } catch (err) {
            this.Fail(err instanceof Error ? err.message : String(err));
            return;
        }
        this.Touch();
    }

    // ── The child collections ──────────────────────────────────────────────────

    public get Lines(): readonly mjBizAppsSalesDealLineEntity[] {
        return this.Deal?.Lines.Items ?? [];
    }

    public get Schedule(): readonly mjBizAppsSalesDealPaymentScheduleEntity[] {
        return this.Deal?.PaymentSchedule.Items ?? [];
    }

    public async AddLine(): Promise<void> {
        await this.Deal?.Lines.Create();
        this.Touch();
    }

    /**
     * Removes a line.
     *
     * `Remove()` — NOT a splice on `Items`, which is exposed as readonly for exactly this reason. The
     * collection tracks removals so it can DELETE the row inside the same transaction as the inserts. A
     * row that merely vanished from the array would survive in the database, and the screen would agree
     * with the user while the data did not.
     */
    public RemoveLine(line: mjBizAppsSalesDealLineEntity): void {
        this.Deal?.Lines.Remove(line);
        this.Touch();
    }

    public async AddScheduleRow(): Promise<void> {
        await this.Deal?.PaymentSchedule.Create();
        this.Touch();
    }

    /** See {@link RemoveLine} — the same explicit-removal contract applies. */
    public RemoveScheduleRow(row: mjBizAppsSalesDealPaymentScheduleEntity): void {
        this.Deal?.PaymentSchedule.Remove(row);
        this.Touch();
    }

    // ── Dates ──────────────────────────────────────────────────────────────────

    /**
     * The `yyyy-MM-dd` an `<input type="date">` binds to.
     *
     * Date fields cannot use `[(ngModel)]`: the element reads and writes strings, the field holds a
     * `Date`, and handing an input a `Date` renders it BLANK with no error. So every date binding is
     * `[ngModel]` through here plus `(ngModelChange)` through one of the setters below.
     */
    public DateInput(value: string | Date | null): string | null {
        return ToDateInput(value);
    }

    public SetDealDate(deal: DealEntity, field: DealDateField, value: string): void {
        deal[field] = FromDateInput(value);
        this.Touch();
    }

    public SetPaymentDate(row: mjBizAppsSalesDealPaymentScheduleEntity, value: string): void {
        row.PaymentDate = FromDateInput(value);
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
        const id = this.Deal?.AccountID;
        if (!id) {
            return 'No customer selected';
        }
        return this.Lookups.Accounts.find((a) => a.ID === id)?.Name ?? '(unknown account)';
    }

    public get CompanyName(): string | null {
        const id = this.Deal?.PipelineID;
        return this.Lookups.Pipelines.find((p) => p.ID === id)?.CompanyName ?? null;
    }

    public NameOf(list: DealLookup[], id: string | null): string {
        if (!id) {
            return '—';
        }
        return list.find((x) => x.ID === id)?.Name ?? '—';
    }

    public get CanSave(): boolean {
        return !!this.Deal && this.Validation.IsValid && !this.Saving();
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
     * One transactional call. The deal either lands whole — header, lines, schedule and roster — or
     * nothing changes; there is no path here that leaves a numbered deal with nothing under it.
     */
    public async Save(): Promise<void> {
        const deal = this.Deal;
        const tabId = this.store.ActiveId;
        if (!deal || !tabId || this.Saving()) {
            return;
        }

        // Client-side validation first, so an obviously incomplete record costs no round trip. It is the
        // SAME code the server will run, because the rules live on the entity.
        this.Revalidate();
        if (!this.Validation.IsValid) {
            this.Fail('Fix the highlighted fields first.');
            return;
        }

        this.Saving.set(true);
        this.Message = '';
        this.cdr.detectChanges();

        try {
            const outcome = await this.service.Save(deal);

            if (!outcome.Success) {
                // A refusal for being invalid REPLACES the client's issue list, so the surface shows the
                // authoritative reason rather than two competing explanations of the same problem.
                if (outcome.Validation.Issues.length) {
                    this.Validation = outcome.Validation;
                }
                this.Fail(
                    outcome.ErrorMessage
                    ?? outcome.Validation.Issues[0]?.Message
                    ?? 'The deal could not be saved.',
                );
                return;
            }

            // The same instance now carries the server's IDs, so this tab becomes an EDIT of a real
            // record — no reload, and no rebuilt copy that could drift from what is on screen.
            this.store.Close(tabId);
            this.store.Open({
                Id: `deal-${outcome.DealID}`,
                Label: deal.Name?.trim() || 'Deal',
                Icon: 'fa-solid fa-file-lines',
                Status: 'complete',
                State: { Deal: deal, ActivePane: this.ActivePane },
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

    /**
     * Drops the active tab's edits. For a saved deal, reloads it; for a new one, closes it.
     *
     * Reloading means closing the tab and opening the deal fresh, rather than calling `Load(force)` on the
     * record in place. That is deliberate: a fresh entity is unambiguously clean, whereas force-reloading
     * the collections of a record the surface still holds is the one operation that discards unsaved
     * children — correct here, but a pattern worth never establishing.
     */
    public async Discard(): Promise<void> {
        const deal = this.Deal;
        const tabId = this.store.ActiveId;
        if (!deal || !tabId) {
            return;
        }
        if (!deal.IsSaved) {
            this.CloseTab(tabId);
            this.Message = '';
            this.cdr.detectChanges();
            return;
        }
        const id = deal.ID;
        this.store.Close(tabId);
        await this.OpenDeal(id);
    }

    // ── Internals ──────────────────────────────────────────────────────────────

    private Revalidate(): void {
        const deal = this.Deal;
        if (!deal) {
            this.Validation = EmptyValidation();
            this.cdr.detectChanges();
            return;
        }

        const entity = ProjectValidation(deal.Validate());
        const advisories = this.LineAdvisories(deal);
        this.Validation = {
            // Advisories are warnings, so they never change whether the deal can be saved. Recomputing
            // rather than or-ing keeps that fact in one place.
            IsValid: entity.IsValid,
            Issues: [...entity.Issues, ...advisories],
        };
        this.cdr.detectChanges();
    }

    /**
     * Per-line advisories, which have to live HERE rather than on the entity.
     *
     * `RelatedRecordCollection.Validate()` pushes a child's errors only when the child's own result
     * FAILED, so a warning on an otherwise-valid line is discarded before it ever reaches the parent's
     * result. A `Warning` emitted from `DealLineEntity.Validate()` would therefore vanish silently —
     * which is worse than not emitting it, because the rule would look present in the code and be absent
     * on the screen.
     *
     * This one is inherited from the retired `DealDraft`, and it is worth keeping: a line with no type is
     * accepted by the database and by every rule in this app, but recurring and one-time lines diverge
     * sharply downstream — one produces a renewal, the other does not. That is a nudge, not a blocker.
     */
    private LineAdvisories(deal: DealEntity): DealWorkspaceIssue[] {
        return deal.Lines.Items.flatMap((line, index) =>
            line.DealLineTypeID
                ? []
                : [{
                    Section: 'lines' as const,
                    Field: 'DealLineTypeID',
                    RowIndex: index,
                    Severity: 'warning' as const,
                    Message:
                        `${line.ProductName?.trim() || 'This line'} has no type set — recurring and `
                        + 'one-time lines behave differently downstream.',
                }],
        );
    }

    private Fail(message: string): void {
        this.MessageIsError = true;
        this.Message = message;
        this.cdr.detectChanges();
    }
}
