/**
 * @fileoverview The pipeline board — deals as cards, pipeline stages as columns.
 *
 * WHAT THIS IS FOR. The roster answers "where does this deal stand"; the board answers "where is
 * everything, and what needs pushing". Same deals, same data, a different question — which is why it is a
 * rail page beside the dashboard and the roster rather than a section of its own.
 *
 * ── WHY THIS IS NOT AN MJ GENERIC KANBAN ────────────────────────────────────────────────────────
 *
 * CLAUDE.md lists `kanban` among MJ's Angular Generic components. **At MJ v5.51.0 it does not exist** —
 * there is no `@memberjunction/ng-kanban`, and no kanban export anywhere under `@memberjunction/*`
 * (`ng-timeline`, `ng-filter-builder`, `ng-entity-card` and `ng-join-grid` all do exist, so the list is
 * aspirational rather than wrong). Recorded in BOARD-DECISIONS.md D-BD1.
 *
 * So the columns are laid out here, but the DRAG is not invented: it uses `@angular/cdk/drag-drop`, which
 * is already the in-house primitive in this very package — `vendored/workspace-tabs/workspace-tab-strip`
 * imports `CdkDropList`/`CdkDrag` for tab reordering. Same library, same idiom, no new dependency. When a
 * generic kanban lands, this component is the thing to delete.
 *
 * ── WHAT IT REFUSES TO DO ───────────────────────────────────────────────────────────────────────
 *
 * A drag NEVER closes a deal. Dropping onto a stage whose `DealStatusType.LocksDeal` is set is refused
 * with a hint pointing at the explicit close action, because a lock freezes the deal, its lines and its
 * team, and an accidental mouse gesture is not an adequate signature on that. It also never calls the
 * orders or contracts seams — closing is `Sales.CloseDeal`, deliberately explicit.
 *
 * ── VOCABULARY IS DATA ──────────────────────────────────────────────────────────────────────────
 *
 * Columns come from `PipelineStage` rows ordered by `DisplayOrder`. Whether a column is a closing column
 * is read from the `DealStatusType.LocksDeal` FLAG its stage points at. No status name, stage name or
 * pipeline name is compared anywhere in this file.
 *
 * ── IT COMPUTES NO MONEY ────────────────────────────────────────────────────────────────────────
 *
 * A column total is `SUM(Deal.Amount)` over the cards in that column — stored values, added up for
 * display, exactly as the dashboard does it. Nothing is priced, derived, discounted or prorated. The sum
 * is taken over DEALS, never over team members, which is the attribution double-count trap: a deal with
 * an AE, an SE and an SDR has three `DealTeamMember` rows and would be counted three times.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import {
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Input,
    Output,
    inject,
} from '@angular/core';

import { DealWorkspaceService, type DealRosterRow } from '../workspace/deal-workspace.service';
import type { DealStatusLookup, PipelineLookup, StageLookup } from '../workspace/deal-workspace.types';

/**
 * The one currency a set of cards shares, or NULL when they do not share one.
 *
 * Uniformly-NULL counts as sharing: `Deal.CurrencyID` is unpopulated on every deal today, so treating
 * that as a disagreement would suppress every total on the board and help nobody. What it must not do
 * is treat NULL as the display default -- unknown and dollars are different claims, and conflating
 * them is how a EUR deal ends up rendered as $48,000.
 */
export function SingleCurrencyOf(cards: readonly DealRosterRow[]): string | null {
    if (cards.length === 0) {
        return null;
    }
    const distinct = new Set(cards.map((d) => d.CurrencyID ?? ''));
    if (distinct.size > 1) {
        return null;
    }
    const only = [...distinct][0];
    return only === '' ? DEFAULT_DISPLAY_CURRENCY : only;
}

/**
 * What a figure is LABELLED as when no deal states a currency.
 *
 * A display default, not a fact about the money. It is here as one named constant rather than three
 * hardcoded 'USD' literals so that the assumption is stated once, in a place a reader meets it, and
 * so populating `Deal.CurrencyID` is a data change rather than a code hunt.
 */
export const DEFAULT_DISPLAY_CURRENCY = 'USD';

/** One column: a stage, the deals sitting in it, and the two figures its header shows. */
export interface BoardColumn {
    StageID: string;
    Label: string;
    /** Set when arriving here would lock the deal — the column refuses drops. */
    IsClosing: boolean;
    Cards: DealRosterRow[];
    /** `SUM(Deal.Amount)` over `Cards`. Stored amounts, added for display. */
    Total: number;
    /**
     * The currency every card in this column is denominated in, or NULL when they disagree.
     *
     * NULL means DO NOT RENDER THE TOTAL. Three display sites used to hardcode 'USD', so a deal priced
     * in EUR rendered as dollars and was added into a dollar column total -- a number that is wrong in
     * a way no reader can see. Refusing beats guessing: a missing figure prompts a question, a
     * confidently wrong one does not.
     */
    Currency: string | null;
    /** True when the cards disagree about currency, so the template can say why the total is absent. */
    MixedCurrency: boolean;
    /** Deals whose amount is null, so a footnote can say the total is partial rather than wrong. */
    Unpriced: number;
}

@Component({
    selector: 'mjs-deal-board',
    standalone: true,
    imports: [CommonModule, CdkDropList, CdkDrag],
    templateUrl: './deal-board.component.html',
    styleUrls: ['./deal-board.component.css'],
})
export class DealBoardComponent {
    private readonly service = inject(DealWorkspaceService);
    private readonly cdr = inject(ChangeDetectorRef);

    /** The roster, owned by the section so the board and the list cannot disagree about what exists. */
    @Input() public Deals: DealRosterRow[] = [];
    @Input() public Pipelines: PipelineLookup[] = [];
    @Input() public Stages: StageLookup[] = [];
    @Input() public DealStatusTypes: DealStatusLookup[] = [];

    /** A card was clicked — the section opens it in the workspace, exactly as a roster row does. */
    @Output() public readonly DealOpened = new EventEmitter<DealRosterRow>();
    /** A move persisted; the section re-reads the roster so every page sees the new stage. */
    @Output() public readonly StageMoved = new EventEmitter<void>();

    public SelectedPipelineID: string | null = null;
    /** Shown verbatim. A refused or failed move must say why rather than silently snapping back. */
    public Message: string | null = null;
    public Moving = false;

    /** The pipeline actually in view — the chosen one, or the first that has any stages. */
    public get ActivePipelineID(): string | null {
        if (this.SelectedPipelineID) {
            return this.SelectedPipelineID;
        }
        const withStages = this.Pipelines.find((p) => this.Stages.some((s) => s.PipelineID === p.ID));
        return withStages?.ID ?? this.Pipelines[0]?.ID ?? null;
    }

    /**
     * The columns, in `DisplayOrder`.
     *
     * Recomputed on read rather than cached, matching how the workspace's `IssuesForPane` and the
     * dashboard's tiles already work. The card counts here are small — a pipeline has a handful of stages
     * and a rep has tens of deals, not thousands — so the clarity is worth more than the memoization.
     */
    public get Columns(): BoardColumn[] {
        const pipelineID = this.ActivePipelineID;
        if (!pipelineID) {
            return [];
        }

        const locking = new Set(
            this.DealStatusTypes.filter((s) => s.LocksDeal).map((s) => s.ID),
        );

        return this.Stages.filter((s) => s.PipelineID === pipelineID)
            .slice()
            .sort((a, b) => a.DisplayOrder - b.DisplayOrder)
            .map<BoardColumn>((stage) => {
                const cards = this.Deals.filter((d) => d.PipelineStageID === stage.ID);
                return {
                    StageID: stage.ID,
                    Label: stage.Name,
                    IsClosing: !!stage.DealStatusTypeID && locking.has(stage.DealStatusTypeID),
                    Cards: cards,
                    // One pass over the cards. Each deal contributes its own stored amount exactly once.
                    /**
                     * A SUM OF STORED ANSWERS, AND THE NARROWEST DEFENSIBLE READING OF RULE #1.
                     *
                     * Sales never computes money -- it never multiplies quantity by price, applies a
                     * discount, or derives a total from parts. This adds up figures that are already
                     * answers, which is reporting rather than pricing, and is the same position the
                     * dashboard's own file header takes.
                     *
                     * WHERE THIS SHOULD END UP: in a query. `Sales: Pipeline Summary` already computes
                     * OpenAmount per pipeline AND stage server-side -- the exact grain of a board
                     * column. It is not wired up here yet for one honest reason: that query is
                     * open-deals-only, and this board renders closing columns too, so swapping it in
                     * today would make closed columns read zero. Closing that gap means either a
                     * board-shaped query or an all-status variant, and both are a bigger change than
                     * this fix.
                     *
                     * `?? 0` treats a missing amount as zero for the SUM only. It is not a substitute
                     * for the value: `Unpriced` below counts those cards, and the template renders the
                     * count as a caveat ON the number rather than as a separate fact beside it.
                     */
                    Total: cards.reduce((sum, d) => sum + (d.Amount ?? 0), 0),
                    Currency: SingleCurrencyOf(cards),
                    MixedCurrency: SingleCurrencyOf(cards) === null && cards.length > 0
                        && new Set(cards.map((d) => d.CurrencyID ?? '')).size > 1,
                    Unpriced: cards.filter((d) => d.Amount === null || d.Amount === undefined).length,
                };
            });
    }

    /** Deals on this pipeline that have no stage set — otherwise they would vanish from the board. */
    public get Unstaged(): DealRosterRow[] {
        const pipelineID = this.ActivePipelineID;
        return this.Deals.filter((d) => d.PipelineID === pipelineID && !d.PipelineStageID);
    }

    /** The drop-list ids CDK needs to know a card may travel between columns. */
    public get ColumnIDs(): string[] {
        return this.Columns.map((c) => `col-${c.StageID}`);
    }

    public SelectPipeline(pipelineID: string): void {
        this.SelectedPipelineID = pipelineID;
        this.Message = null;
        this.cdr.detectChanges();
    }

    public OpenCard(deal: DealRosterRow): void {
        this.DealOpened.emit(deal);
    }

    /** CDK asks per drop list whether a given drag may land. This is where the lock is refused. */
    public CanDropInto = (column: BoardColumn) => (): boolean => !column.IsClosing && !this.Moving;

    /**
     * A card was dropped on a column.
     *
     * The move goes through `Sales.SaveDeal` — the same operation the workspace saves with — rather than a
     * bespoke write. That is what earns the stage event, the validation and the company resolution without
     * this component knowing they exist; the operation appends the append-only `DealStageEvent` itself when
     * it sees the stage change. Reusing `LoadDraft` also means the deal's lines and instalments round-trip
     * intact, which matters because the operation treats a present array as the complete desired set.
     */
    public async OnDrop(event: CdkDragDrop<BoardColumn>, target: BoardColumn): Promise<void> {
        this.Message = null;

        const deal = event.item.data as DealRosterRow;
        if (!deal) {
            return;
        }
        if (deal.PipelineStageID === target.StageID) {
            return;
        }
        if (target.IsClosing) {
            // Belt and braces: `CanDropInto` already refuses this, but a lock is worth two guards.
            this.Message =
                `"${target.Label}" closes and locks a deal. Open it in the workspace and close it there, ` +
                'so the win or loss is recorded deliberately.';
            this.cdr.detectChanges();
            return;
        }

        this.Moving = true;
        this.cdr.detectChanges();

        try {
            const draft = await this.service.LoadDeal(deal.ID);
            if (!draft) {
                this.Message = `"${deal.Name}" could not be read, so it was not moved.`;
                return;
            }

            draft.PipelineStageID = target.StageID;

            const outcome = await this.service.Save(draft);
            if (!outcome.Success) {
                this.Message =
                    outcome.Validation?.Issues[0]?.Message ??
                    outcome.ErrorMessage ??
                    `"${deal.Name}" could not be moved.`;
                return;
            }

            // Optimistic local update so the card stays where it was dropped, then the section re-reads
            // the roster as the authority.
            deal.PipelineStageID = target.StageID;
            deal.PipelineStage = target.Label;
            this.StageMoved.emit();
        } catch (err) {
            this.Message = `"${deal.Name}" could not be moved: ${err}`;
        } finally {
            this.Moving = false;
            this.cdr.detectChanges();
        }
    }

    /**
     * ── THE BOARD DOES NOT WRITE STAGE DEFAULTS EITHER ──────────────────────────────────────────────
     *
     * `ApplyStageDefaults` was here too, assigning `Probability` and `ForecastCategoryTypeID`
     * unconditionally onto the dragged card's header — with a comment saying it was deliberately the same
     * rule as the workspace's, so that "a drag and a dropdown must not produce different deals". The
     * intent was right and the implementation destroyed a rep-typed probability, in both places, before
     * the server could apply its fill-but-don't-overwrite rule.
     *
     * Both copies are gone. The server applies the stage's answer inside the save (same trigger, same
     * transaction), and the board re-reads the row afterwards, so the card shows what was actually
     * written rather than what the client guessed. A drag and a dropdown now produce the same deal
     * because they go through the same single writer, which is a stronger guarantee than two clients
     * agreeing with each other.
     */

    public NameOf(pipelineID: string | null): string {
        return this.Pipelines.find((p) => p.ID === pipelineID)?.Name ?? '—';
    }

    /** Track by ID so a re-render does not tear down every card. */
    public TrackCard = (_: number, deal: DealRosterRow): string => deal.ID;
    /** Exposed for the template's per-card fallback. See DEFAULT_DISPLAY_CURRENCY. */
    public readonly DefaultCurrency = DEFAULT_DISPLAY_CURRENCY;

    public TrackColumn = (_: number, column: BoardColumn): string => column.StageID;
}
