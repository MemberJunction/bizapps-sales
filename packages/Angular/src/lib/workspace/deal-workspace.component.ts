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
import { Metadata } from '@memberjunction/core';
import type {
    DealEntity,
    mjBizAppsSalesDealLineEntity,
    mjBizAppsSalesDealPaymentScheduleEntity,
    SalesCloseDealInput,
    SalesCloseDealOutput,
    SalesCloseRoutingResult,
    SalesReopenDealOutput,
} from '@mj-biz-apps/sales-entities';
import {
    IsDealFieldEditableWhileLocked,
    ResolveDealLockState,
    type DealLockState,
} from '@mj-biz-apps/sales-entities';

import { WorkspaceCardComponent } from '../vendored/workspace-tabs/workspace-card.component';
import { WorkspaceTabStore } from '../vendored/workspace-tabs/workspace-tab-store';
import type { WorkspaceTab } from '../vendored/workspace-tabs/workspace-tabs.types';
import type { TabReorder } from '../vendored/workspace-tabs/workspace-tab-strip.component';
import { DealWorkspaceService } from './deal-workspace.service';
import { FromDateInput, ToDateInput } from './deal-workspace.dates';
import type { ProductLookup } from '@mj-biz-apps/sales-entities';
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
    type DealStatusLookup,
    type DealLookup,
    type DealWorkspaceLookups,
    type DealWorkspacePane,
    type StageLookup,
} from './deal-workspace.types';

/**
 * The provider's remote-operation entry point, typed for the two calls this surface makes.
 *
 * `RouteOperation` lives on `ProviderBase` and is implemented by the GraphQL client provider, but it is
 * not part of the `IMetadataProvider` interface `Metadata.Provider` is declared as — so it has to be
 * narrowed here. Declared as a precise shape rather than reached for with a loose cast: the input and
 * output types stay checked, which is the whole value of calling a typed operation.
 */
interface RemoteOperationRouter {
    RouteOperation<TInput, TOutput>(
        operationKey: string,
        input: TInput,
    ): Promise<{ Success: boolean; Output?: TOutput; ErrorMessage?: string }>;
}

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

    /**
     * The products the ACTIVE deal may reference, refreshed when its selling company changes.
     *
     * Per-deal rather than per-session: products are per-company, and the company comes from the deal's
     * pipeline. A session-wide list would show the first-opened deal's catalogue on every other deal.
     */
    public Products: ProductLookup[] = [];
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
        await this.RefreshProducts();
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
        await this.RefreshProducts();
        // The lock is resolved on OPEN, not on save: a deal that arrives already closed must render
        // frozen from the first paint, rather than inviting an edit the server will refuse.
        await this.RefreshLock();
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

        // The company just moved, so the catalogue has too. Not awaited: this runs from a template
        // event handler, and the picker filling a moment later is better than blocking the select.
        void this.RefreshProducts();
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

    /* ── The close action (§7) ───────────────────────────────────────────────────────────────────
     *
     * WHY THIS EXISTS AT ALL. Until now the workspace could set `DealStatusTypeID` to a winning status
     * and save — which wrote the status field and NOTHING else. No routing, no order, no stage event.
     * A deal ended up Won with no provenance and no downstream record, and nothing said so. The close
     * flow was fully built and tested at the operation level; it simply had no caller in the UI.
     *
     * So closing goes through `Sales.CloseDeal`, and the status dropdown no longer offers a closing
     * status (see `SelectableStatuses`). One door, and it is the audited one.
     */

    /** True when the PERSISTED status locks the deal — resolved through the SHARED rule. */
    public Lock: DealLockState = { IsLocked: false, StatusName: null, Notice: null };

    public ClosePanelOpen = false;
    /** `null` until the user picks; drives which fields the panel demands. */
    public CloseOutcome: 'won' | 'lost' | null = null;
    public CloseLossReasonID: string | null = null;
    public CloseLossNotes = '';
    public CloseNotes = '';
    public readonly Closing = signal(false);
    /** What the close actually did downstream, shown to the user rather than buried in a stage event. */
    public CloseRouting: SalesCloseRoutingResult[] = [];
    /** Order/contract numbers resolved for display, keyed by routing RecordID. */
    public RoutedRecordNumbers: Record<string, string> = {};
    public ReopenReason = '';
    public ReopenPanelOpen = false;

    /**
     * The statuses a user may pick DIRECTLY.
     *
     * A closing status is excluded — by FLAG, never by name — because entering one is a transition with
     * downstream consequences, and those only happen inside the operation. `On Hold` is neither won nor
     * lost, so it survives: pausing a deal is not closing it.
     */
    public SelectableStatuses(): DealStatusLookup[] {
        return this.Lookups.DealStatusTypes.filter((s) => !s.IsWon && !s.IsLost);
    }

    /** Whether a field may be edited right now. One rule, shared with the server and the record form. */
    public IsFieldEditable(fieldName: string): boolean {
        return !this.Lock.IsLocked || IsDealFieldEditableWhileLocked(fieldName);
    }

    /** The chosen loss reason demands notes — read off the row's FLAG. */
    public LossReasonRequiresNotes(): boolean {
        const chosen = this.Lookups.LossReasons.find((r) => r.ID === this.CloseLossReasonID);
        return chosen?.RequiresNotes === true;
    }

    public OpenClosePanel(): void {
        this.ClosePanelOpen = true;
        this.CloseOutcome = null;
        this.CloseLossReasonID = null;
        this.CloseLossNotes = '';
        this.CloseNotes = '';
        this.CloseRouting = [];
        this.Message = '';
        this.cdr.detectChanges();
    }

    public CancelClose(): void {
        this.ClosePanelOpen = false;
        this.cdr.detectChanges();
    }

    /**
     * Closes the deal through the operation.
     *
     * ── UNSAVED EDITS ARE SAVED FIRST, DELIBERATELY ─────────────────────────────────────────────
     *
     * A close routes the deal's LINES to an order. If the user has edited lines and not saved, there
     * are three possible behaviours and only one is defensible:
     *
     *   · close the persisted state  -> the order is built from data the user is not looking at;
     *   · discard the edits          -> silently drops work, the same class of bug as a false success;
     *   · SAVE FIRST, then close     -> the order matches what is on screen.
     *
     * So this saves first. If the save is refused the close is NOT attempted, and the refusal shows in
     * the normal issue list — the user sees why, with the deal intact and still open.
     */
    public async ConfirmClose(): Promise<void> {
        const deal = this.Deal;
        if (!deal || this.Closing() || !this.CloseOutcome) {
            return;
        }

        const wantWon = this.CloseOutcome === 'won';
        const status = this.Lookups.DealStatusTypes.find((s) => (wantWon ? s.IsWon : s.IsLost));
        if (!status) {
            this.Fail(
                `No active status carries Is${wantWon ? 'Won' : 'Lost'}. Seed the deal status types first.`,
            );
            return;
        }

        this.Closing.set(true);
        this.Message = '';
        this.cdr.detectChanges();
        try {
            const tabId = this.store.ActiveId;
            const dirty = this.store.Tabs.find((t) => t.Id === tabId)?.Dirty === true;
            if (dirty) {
                await this.Save();
                if (this.MessageIsError) {
                    return; // the save was refused; its reason is already on screen
                }
            }

            const input: SalesCloseDealInput = {
                DealID: deal.ID,
                DealStatusTypeID: status.ID,
                LossReasonID: wantWon ? null : this.CloseLossReasonID,
                LossNotes: wantWon ? null : (this.CloseLossNotes.trim() || null),
                Notes: this.CloseNotes.trim() || null,
            };

            /**
             * TWO LAYERS OF SUCCESS, and checking only the outer one is a mistake this repo has already
             * made once (KNOWN-ISSUES, the contracts seam): `RemoteOpResult.Success` means the operation
             * RAN. Whether the deal actually closed is `Output.Success`.
             */
            const router = Metadata.Provider as unknown as RemoteOperationRouter;
            const envelope = await router.RouteOperation<SalesCloseDealInput, SalesCloseDealOutput>(
                'Sales.CloseDeal',
                input,
            );
            if (!envelope.Success) {
                this.Fail(envelope.ErrorMessage ?? 'Sales.CloseDeal could not be reached.');
                return;
            }
            const out = envelope.Output;
            if (!out?.Success) {
                this.ApplyCloseIssues(out?.Issues ?? []);
                this.Fail(out?.Issues?.[0]?.Message ?? 'The deal could not be closed.');
                return;
            }

            this.CloseRouting = out.Routing ?? [];
            await this.ResolveRoutedNumbers();
            this.ClosePanelOpen = false;
            this.MessageIsError = false;
            this.Message = out.IsWon ? 'Deal closed as won.' : 'Deal closed as lost.';
            await this.ReloadActiveDeal();
            await this.RefreshLock();
        } finally {
            this.Closing.set(false);
            this.cdr.detectChanges();
        }
    }

    /** Reopening — the one audited way back through the lock. The reason is required by the operation. */
    public async ReopenDeal(): Promise<void> {
        const deal = this.Deal;
        if (!deal || this.Closing()) {
            return;
        }
        if (!this.ReopenReason.trim()) {
            this.Fail('A reason is required to reopen a deal — it is recorded on the stage event.');
            return;
        }

        this.Closing.set(true);
        try {
            const router = Metadata.Provider as unknown as RemoteOperationRouter;
            const envelope = await router.RouteOperation<
                { DealID: string; Reason: string },
                SalesReopenDealOutput
            >('Sales.ReopenDeal', { DealID: deal.ID, Reason: this.ReopenReason.trim() });

            if (!envelope.Success) {
                this.Fail(envelope.ErrorMessage ?? 'Sales.ReopenDeal could not be reached.');
                return;
            }
            const out = envelope.Output;
            if (!out?.Success) {
                this.ApplyCloseIssues(out?.Issues ?? []);
                this.Fail(out?.Issues?.[0]?.Message ?? 'The deal could not be reopened.');
                return;
            }

            this.ReopenPanelOpen = false;
            this.ReopenReason = '';
            this.CloseRouting = [];
            this.MessageIsError = false;
            this.Message = 'Deal reopened. The close event remains in its history.';
            await this.ReloadActiveDeal();
            await this.RefreshLock();
        } finally {
            this.Closing.set(false);
            this.cdr.detectChanges();
        }
    }

    /**
     * Turns the operation's issues into the SAME list the surface already uses for validation.
     *
     * A refusal naming `LossReasonID` therefore lands against the pane that owns it, with the field
     * named, exactly like a validation failure — rather than in a second error channel the user has to
     * learn separately.
     */
    private ApplyCloseIssues(issues: SalesCloseDealOutput['Issues']): void {
        if (!issues?.length) {
            return;
        }
        const mapped = issues.map<DealWorkspaceIssue>((i) => ({
            Section: (i.Section ?? 'deal') as DealWorkspaceSection,
            Field: i.Field ?? null,
            Severity: i.Severity === 'warning' ? 'warning' : 'error',
            Message: i.Message,
            RowIndex: null,
        }));
        this.Validation = {
            IsValid: !mapped.some((i) => i.Severity === 'error'),
            Issues: mapped,
        };
    }

    /** Reads the NUMBER for each executed route, so the result names a record a human can go and find. */
    private async ResolveRoutedNumbers(): Promise<void> {
        this.RoutedRecordNumbers = {};
        for (const r of this.CloseRouting) {
            if (!r.Executed || !r.RecordID) {
                continue;
            }
            const number = await this.service.LookupRoutedRecordNumber(r.Target, r.RecordID);
            if (number) {
                this.RoutedRecordNumbers[r.RecordID] = number;
            }
        }
    }

    /** Re-resolves the lock after a close or reopen, so the surface reflects the new state immediately. */
    private async RefreshLock(): Promise<void> {
        const deal = this.Deal;
        const persisted =
            (deal?.GetFieldByName?.('DealStatusTypeID')?.OldValue as string | null | undefined)
            ?? (deal?.DealStatusTypeID as string | null | undefined);
        this.Lock = await ResolveDealLockState(persisted);
    }

    /**
     * Re-reads the deal after the operation changed it SERVER-SIDE.
     *
     * ── WHY THIS IS NOT OPTIONAL, AND WHAT IT COST TO LEARN ─────────────────────────────────────
     *
     * `Sales.CloseDeal` writes the status, the stage event and the downstream records itself. The
     * `DealEntity` this surface is holding took no part in that, so after a close it still carries the
     * OPEN status — and `RefreshLock` reads the PERSISTED status off that stale copy, concludes the deal
     * is not locked, and leaves every field editable on a deal the server has already frozen.
     *
     * The screen therefore looked closed (message, routing result) while behaving open, and the lock
     * appeared only after navigating away and back. `60-close-deal.spec.ts` caught exactly this; the
     * browser walkthrough that preceded it did not, because it happened to re-open the deal from the
     * roster before looking.
     *
     * So the record is re-read from the server, which is the only thing that can be right: the operation
     * may have changed more than the status.
     */
    private async ReloadActiveDeal(): Promise<void> {
        const tabId = this.store.ActiveId;
        const current = this.Deal;
        if (!tabId || !current?.ID) {
            return;
        }
        const fresh = await this.service.LoadDeal(current.ID);
        if (!fresh) {
            return;
        }
        this.store.UpdateState(tabId, { Deal: fresh, ActivePane: this.ActivePane }, false);
        this.store.MarkClean(tabId);
        this.Revalidate();
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

    /**
     * Reloads the product catalogue for whichever company the active deal sells for.
     *
     * Called when a deal is opened and when its pipeline changes, because those are the only two moments
     * `CompanyID` can move. Failure yields an empty list rather than an error: the picker then offers
     * nothing, which is visible, instead of a partial catalogue, which is not.
     */
    private async RefreshProducts(): Promise<void> {
        const deal = this.Deal;
        this.Products = deal ? await this.service.LoadProducts(deal.CompanyID) : [];
        this.cdr.detectChanges();
    }

    /**
     * The label a line shows for the product it references.
     *
     * Resolved from the loaded catalogue rather than stored on the line, so a renamed product reads
     * correctly next time the deal is opened. A line whose product is no longer offered — discontinued
     * since it was quoted — still shows its ID rather than silently reading as unset, because "this line
     * references something you can no longer sell" is a fact the rep needs.
     */
    public ProductLabel(line: mjBizAppsSalesDealLineEntity): string {
        if (!line.ProductID) {
            return '';
        }
        const hit = this.Products.find((x) => x.ID === line.ProductID);
        return hit ? (hit.SKU ? `${hit.Name} (${hit.SKU})` : hit.Name) : '(no longer offered)';
    }

    /**
     * Records the product a line references — the ID, never the name or SKU.
     *
     * `ProductName` is kept in step as a TRANSCRIPTION for the quote, not as identity: it is what the
     * line says it sells, and it must survive the product being renamed or withdrawn later. That is why
     * both are written rather than deriving the name at read time.
     */
    public OnProductChange(line: mjBizAppsSalesDealLineEntity, productID: string | null): void {
        line.ProductID = productID;
        const hit = productID ? this.Products.find((x) => x.ID === productID) : undefined;
        if (hit) {
            line.ProductName = hit.Name;
        }
        this.Touch();
    }

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
