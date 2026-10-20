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
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Input,
    Output,
    inject,
} from '@angular/core';

import { FromCalendarDay, ToCalendarDay } from '@mj-biz-apps/common-entities';

import { DealWorkspaceService, DEFAULT_DISPLAY_CURRENCY, type DealRosterRow } from '../workspace/deal-workspace.service';
import { BusinessToday, DayLabel, UtcDatePart } from '../pages/dashboard-dates';
import type { DealStatusLookup, PipelineLookup, StageLookup } from '../workspace/deal-workspace.types';
import { OrderPipelinesByCompany, PipelineLabel, type CompanyPipeline } from '../data/company-pipelines';
import { HasID } from '../pages/dashboard-filters';

/**
 * A `DATE` column's day, as a value the `date` pipe can format with `'UTC'` (bc-aidp-next-golive#168).
 *
 * `ExpectedCloseDate` is a calendar day handed back as UTC midnight, so formatting it in the viewer's
 * zone shows the PREVIOUS day to anyone west of Greenwich — 30 September read as "Sep 29" in Chicago.
 * The card now passes `'UTC'`, and this normalises the value first because the roster can deliver a
 * `Date` OR a string: Angular parses a bare `YYYY-MM-DD` string as LOCAL midnight, which `'UTC'` would
 * then move back a day for anyone EAST of Greenwich. Through `ToCalendarDay` both shapes become the
 * same UTC midnight, so one pipe argument is right everywhere.
 */
export function DisplayDay(value: string | Date | null | undefined): Date | null {
    const day = ToCalendarDay(value);
    return day ? FromCalendarDay(day) : null;
}

/** The roster fields a card's close date is chosen from. */
type CardDates = Pick<DealRosterRow, 'IsClosed' | 'ActualCloseDate' | 'ExpectedCloseDate'>;

/**
 * True when the card shows the day the deal closed rather than its forecast.
 *
 * Read off the roster's `IsClosed` flag, never a status name. A closed row with no `ActualCloseDate`
 * (one closed before the day was stamped) is false, so its card shows the expected day unlabelled
 * rather than calling a forecast the close.
 */
export function CardClosed(deal: CardDates): boolean {
    return deal.IsClosed && !!deal.ActualCloseDate;
}

/** The day a card shows: the close day once the deal has closed, otherwise the expected close day. */
export function CardCloseDay(deal: CardDates): Date | null {
    return DisplayDay(CardClosed(deal) ? deal.ActualCloseDate : deal.ExpectedCloseDate);
}

/** A card's close day as text, in the shape every Sales date uses ("Jul 1, 2026"), or '' for none. */
export function CardDayLabel(deal: CardDates): string {
    return DayLabel(CardCloseDay(deal));
}

/** Whole days from `fromDay` to `today`, both `YYYY-MM-DD`. Never negative. */
export function DaysBetween(fromDay: string, today: string): number {
    const at = (iso: string): number => {
        const [y, m, d] = UtcDatePart(iso).split('-').map(Number);
        return Date.UTC(y, m - 1, d);
    };
    return Math.max(0, Math.round((at(today) - at(fromDay)) / 86_400_000));
}

/** What a card says when its deal has sat in its stage too long, or null when it has not. */
export interface StageIdle {
    Days: number;
    Limit: number;
    Label: string;
}

/**
 * Whether an open deal has sat in its stage longer than the stage's `RottingDays` (bizapps-sales#450).
 *
 * Null when the deal is closed, the stage sets no limit, or the day it entered the stage is unknown.
 * "Longer than": a deal on its limit's last day is not yet flagged.
 */
export function StageIdleFor(
    deal: Pick<DealRosterRow, 'IsOpen'>,
    rottingDays: number | null | undefined,
    enteredDay: string | null | undefined,
    today: string,
): StageIdle | null {
    if (!deal.IsOpen || rottingDays == null || !enteredDay) {
        return null;
    }
    const days = DaysBetween(enteredDay, today);
    if (days <= rottingDays) {
        return null;
    }
    return {
        Days: days,
        Limit: rottingDays,
        Label: `In this stage ${days} days, past its ${rottingDays}-day limit`,
    };
}

/**
 * The closing column a drag was released over, or null (#305).
 *
 * `CanDropInto` keeps a card out of a closing column, so CDK reports the drop on the last column that
 * accepted the card — usually its own, which looks like "nothing changed". The pointer position is the
 * only trace of where the rep let go, so the column under it is read from the DOM: closing columns
 * carry their label in `data-closing`. A release inside the reporting column is an ordinary drop.
 */
export function ClosingColumnUnder(
    event: Pick<CdkDragDrop<unknown>, 'isPointerOverContainer' | 'dropPoint'>,
    doc: Pick<Document, 'elementFromPoint'>,
): string | null {
    if (event.isPointerOverContainer) {
        return null;
    }
    const under = doc.elementFromPoint(event.dropPoint.x, event.dropPoint.y);
    return under?.closest('[data-closing]')?.getAttribute('data-closing') ?? null;
}

/** What the board says when a card is let go over a closing column. */
export function ClosingRefusal(columnLabel: string): string {
    return `"${columnLabel}" closes and locks a deal, so a card cannot be moved there. Close it from the `
        + 'deal form, so the win or loss is recorded deliberately.';
}

/**
 * The one currency code a set of cards shares, or NULL when they do not share one.
 *
 * Compared on `CurrencyCode`, not `CurrencyID`: the ID is a record key the currency pipe would print
 * verbatim, and a deal with no currency (read as the display default) shares a column with one stamped
 * in that same currency. What it must not do is fold different codes together -- that is how a EUR deal
 * ends up rendered as $48,000.
 */
export function SingleCurrencyOf(cards: readonly DealRosterRow[]): string | null {
    const distinct = new Set(cards.map((d) => d.CurrencyCode));
    return distinct.size === 1 ? [...distinct][0] : null;
}

/** Defined beside the roster row it labels; exported here too for the section's figures. */
export { DEFAULT_DISPLAY_CURRENCY };

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
    /**
     * Cards in this column whose figure did NOT come from the orders engine.
     *
     * WIDENED, and the old definition was the more dangerous of the two. It counted only cards with a
     * null amount, so a figure a human typed was counted as priced and folded into the total with no
     * caveat at all -- and on the seeded data every deal carries `AmountIsComputed = 0`, which made this
     * read `0 unpriced` on a board where nothing whatsoever was priced. A missing figure at least looks
     * missing; a stated one looks authoritative, which is why it is the case that needed counting.
     *
     * A null amount is still counted -- it is certainly not priced -- so the footnote keeps one
     * vocabulary rather than growing a second.
     */
    Unpriced: number;
    /** True when NOTHING in the column was priced, so the footnote can say so rather than count to N. */
    NonePriced: boolean;
}

/**
 * The pipelines the Board offers as tabs (bc-aidp-next-golive#351): those the section's filter bar
 * allows, in picker order. The Pipeline list when it names any; else the selling companies' pipelines;
 * else every pipeline, including those flagged out of the forecast, which the Board still shows.
 */
export function BoardPipelines<T extends CompanyPipeline>(
    pipelines: readonly T[],
    companyIDs: readonly string[],
    pipelineIDs: readonly string[],
): T[] {
    return OrderPipelinesByCompany(pipelines).filter(
        (p) => (!companyIDs.length || HasID(companyIDs, p.CompanyID)) && (!pipelineIDs.length || HasID(pipelineIDs, p.ID)),
    );
}

@Component({
    selector: 'mjs-deal-board',
    standalone: true,
    imports: [CommonModule, FormsModule, CdkDropList, CdkDrag],
    templateUrl: './deal-board.component.html',
    styleUrls: ['./deal-board.component.css'],
})
export class DealBoardComponent {
    private readonly service = inject(DealWorkspaceService);
    private readonly cdr = inject(ChangeDetectorRef);
    private readonly document = inject(DOCUMENT);

    /** The roster, owned by the section so the board and the list cannot disagree about what exists. */
    @Input() public Deals: DealRosterRow[] = [];
    @Input() public Pipelines: PipelineLookup[] = [];
    @Input() public Stages: StageLookup[] = [];
    @Input() public DealStatusTypes: DealStatusLookup[] = [];
    /**
     * The day each open deal entered its current stage, keyed by lower-cased deal ID, for the idle
     * flag (bizapps-sales#450). Empty means unknown, and no card is flagged.
     */
    @Input() public StageEnteredOn: ReadonlyMap<string, string> = new Map();

    /** A card was clicked — the section opens it as an Explorer record tab. */
    @Output() public readonly DealOpened = new EventEmitter<DealRosterRow>();
    /** A move persisted; the section re-reads the roster so every page sees the new stage. */
    @Output() public readonly StageMoved = new EventEmitter<void>();

    /**
     * The filter bar's Selling company and Pipeline lists, owned by the section and shared with the
     * Dashboard (bc-aidp-next-golive#351). Empty is "All". They decide which pipelines are tabs; the deals
     * themselves arrive already narrowed by every filter.
     */
    @Input() public CompanyIDs: readonly string[] = [];
    @Input() public PipelineIDs: readonly string[] = [];

    /**
     * The pipeline tab's choice; null until a rep picks one. Owned by the section and bound two-way,
     * because the section tears this board down on every reload, and a choice held only here reset to
     * the first pipeline after each drag.
     */
    @Input() public SelectedPipelineID: string | null = null;
    @Output() public readonly SelectedPipelineIDChange = new EventEmitter<string | null>();
    /** Shown verbatim. A refused or failed move must say why rather than silently snapping back. */
    public Message: string | null = null;
    public Moving = false;

    /** The tabs: the pipelines the filter bar allows, in picker order. See {@link BoardPipelines}. */
    public get TabPipelines(): PipelineLookup[] {
        return BoardPipelines(this.Pipelines, this.CompanyIDs, this.PipelineIDs);
    }

    /**
     * The pipeline actually in view: the chosen tab while the filters still allow it, else the first
     * tab that has any stages. A chosen pipeline the filters have since ruled out is not shown.
     *
     * The choice is matched ignoring case, as the tabs are (a GUID in a URL may come back lower-cased),
     * and the pipeline's own ID is returned, so the tab highlight and the columns match it.
     */
    public get ActivePipelineID(): string | null {
        const pipelines = this.TabPipelines;
        const selected = this.SelectedPipelineID;
        const chosen = selected ? pipelines.find((p) => HasID([selected], p.ID)) : undefined;
        if (chosen) {
            return chosen.ID;
        }
        const withStages = pipelines.find((p) => this.Stages.some((s) => s.PipelineID === p.ID));
        return withStages?.ID ?? pipelines[0]?.ID ?? null;
    }

    /** A tab's text: with more than one selling company among the tabs, the company too. */
    public TabLabel(pipeline: Pick<PipelineLookup, 'Name' | 'CompanyName'>): string {
        const tabs = this.TabPipelines;
        const companies = new Set(tabs.map((p) => String(p.CompanyID).toLowerCase()));
        return companies.size > 1 ? PipelineLabel(pipeline) : pipeline.Name;
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
                     *
                     * ── AND THE ARGUMENT IS NOW MACHINE-VISIBLE, BECAUSE PROSE IS NOT A DECISION ─────
                     *
                     * `scripts/assert-no-money-arithmetic.mjs` fires on this line and is right to: a
                     * regex cannot tell a rollup from a derivation, so the rule is that a legitimate case
                     * is ANNOTATED rather than excused by weakening the pattern. The comment above made
                     * the argument and left no reviewable record of it. The trailing annotation is that
                     * record.
                     *
                     * Three things were checked rather than asserted before allowing it:
                     *
                     *   1. **The identical operation already exists, in SQL.**
                     *      `metadata/queries/SQL/dashboard-summary.sql:41` is
                     *      `SUM(CASE WHEN st.IsOpen = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END)`. Same
                     *      addition over the same column. The gate's own header states SQL is unscanned
                     *      *by design*, so this operation is accepted by policy where it runs in the
                     *      database. The difference here is WHERE it happens, not WHAT it is.
                     *   2. **Nothing consumes the result.** Rule #1 forbids deriving a figure that gets
                     *      STORED or SENT -- a line total, a header total, a discounted price. This total
                     *      is recomputed on every render, written to no column, and passed to no app.
                     *      `Deal.Amount` remains the only cached answer, and it keeps its provenance
                     *      (`AmountIsComputed` / `AmountComputedAt` / `AmountSourceHash`) untouched.
                     *   3. **The grain blocker is real, not reluctance.**
                     *      `metadata/queries/SQL/pipeline-summary.sql:36` carries `AND st.IsOpen = 1`, so
                     *      it cannot serve a board that renders closing columns -- they would read zero.
                     *      Moving this into a query is blocked on that, and the fix is an all-status
                     *      variant or a board-shaped query.
                     *
                     * The one honest caveat: on this host every deal carries `AmountIsComputed = 0`, so
                     * this total is currently a sum of HAND-TYPED figures. That is a labelling problem
                     * rather than an arithmetic one, and it is already disclosed -- `Unpriced`,
                     * `NonePriced` and `PricingNote` exist for exactly that.
                     */
                    Total: cards.reduce((sum, d) => sum + (d.Amount ?? 0), 0),   // money-grep-allow: a rollup of stored answers for display -- never stored, never sent. The same SUM runs in dashboard-summary.sql:41; moving it into a query is blocked on pipeline-summary.sql:36 being open-deals-only. See the note above.
                    Currency: SingleCurrencyOf(cards),
                    MixedCurrency: SingleCurrencyOf(cards) === null && cards.length > 0,
                    /**
                     * `AmountIsComputed` is the provenance flag, and reading it is the whole point: a
                     * null amount and a typed one are both un-priced, and the second is the one a reader
                     * would otherwise trust. Never a comparison on any status or stage name.
                     */
                    Unpriced: cards.filter((d) => !d.AmountIsComputed).length,
                    NonePriced: cards.length > 0 && cards.every((d) => !d.AmountIsComputed),
                };
            });
    }

    /** Deals on this pipeline that have no stage set — otherwise they would vanish from the board. */
    public get Unstaged(): DealRosterRow[] {
        const pipelineID = this.ActivePipelineID;
        return this.Deals.filter((d) => d.PipelineID === pipelineID && !d.PipelineStageID);
    }

    /**
     * The drop-list ids CDK needs to know a card may travel between columns.
     *
     * ── CACHED BY VALUE, BECAUSE THIS FEEDS `[cdkDropListConnectedTo]` ──────────────────
     *
     * `.map()` returns a NEW ARRAY IDENTITY on every call, this component runs default change
     * detection, and CDK re-wires its drop-list connections whenever that input's identity changes.
     * During a drag Angular runs change detection on every `pointermove`, so the board was tearing down
     * and rebuilding the connection graph continuously — on the one gesture the demo shows.
     *
     * The sibling `Products` getter in the workspace already documents this exact hazard and returns a
     * stable reference for it. The reasoning was there; it had not reached here.
     *
     * Rebuilt only when the JOINED ids actually change, so adding, removing or reordering a stage still
     * re-wires — which is the behaviour that must not be lost by caching. Comparing the joined
     * string rather than the array means a re-render that produces equal ids reuses the reference,
     * which is the whole point.
     */
    public get ColumnIDs(): string[] {
        const ids = this.Columns.map((c) => `col-${c.StageID}`);
        const key = ids.join('|');
        if (key !== this._columnIDsKey) {
            this._columnIDsKey = key;
            this._columnIDs = ids;
        }
        return this._columnIDs;
    }

    private _columnIDsKey = ' ';   // not '' — an empty board must still populate the cache once
    private _columnIDs: string[] = [];

    public SelectPipeline(pipelineID: string): void {
        this.SelectedPipelineID = pipelineID;
        this.SelectedPipelineIDChange.emit(pipelineID);
        this.Message = null;
        this.cdr.detectChanges();
    }

    public OpenCard(deal: DealRosterRow): void {
        this.DealOpened.emit(deal);
    }

    /** CDK asks per drop list whether a given drag may land. This is where the lock is refused. */
    public CanDropInto = (column: BoardColumn) => (): boolean => !column.IsClosing && !this.Moving;

    /** A card was dropped on a column. The save is {@link moveDeal}'s, shared with "Move to stage". */
    public async OnDrop(event: CdkDragDrop<BoardColumn>, target: BoardColumn): Promise<void> {
        this.Message = null;

        const deal = event.item.data as DealRosterRow;
        if (!deal) {
            return;
        }
        // Checked before the same-stage return: a refused drag comes back to the card's own column (or to
        // a column it crossed on the way), and without this it snapped back with no word said.
        const closing = ClosingColumnUnder(event, this.document);
        if (closing !== null) {
            this.Message = ClosingRefusal(closing);
            this.cdr.detectChanges();
            return;
        }
        if (deal.PipelineStageID === target.StageID) {
            return;
        }
        if (target.IsClosing) {
            // Belt and braces: `CanDropInto` already refuses this, but a lock is worth two guards.
            this.Message = ClosingRefusal(target.Label);
            this.cdr.detectChanges();
            return;
        }

        await this.moveDeal(deal, target);
    }

    /**
     * The stages a card's "Move to stage" control offers: every column of its pipeline but its own and
     * the closing ones, which a move must not reach (see the class header). A closed deal offers none,
     * whatever column it sits in: it is locked, and it reopens from the deal form. A closing column's
     * stage is optional, so a won or lost deal can sit in an ordinary column; `IsOpen` decides.
     */
    public MoveTargets(columns: readonly BoardColumn[], deal: DealRosterRow): BoardColumn[] {
        if (!deal.IsOpen || columns.some((c) => c.IsClosing && c.StageID === deal.PipelineStageID)) {
            return [];
        }
        return columns.filter((c) => !c.IsClosing && c.StageID !== deal.PipelineStageID);
    }

    /** The stage picked in each card's "Move to stage" control, by deal ID, until it is applied. */
    public readonly PendingMove = new Map<string, string>();

    /** The keyboard path to a stage change (bizapps-sales#371): the same save as a drop. */
    public async MoveToPicked(deal: DealRosterRow): Promise<void> {
        const target = this.Columns.find((c) => c.StageID === this.PendingMove.get(deal.ID));
        if (!target || target.IsClosing) {
            return;
        }
        this.Message = null;
        this.PendingMove.delete(deal.ID);
        await this.moveDeal(deal, target);
    }

    /**
     * Moves the card at once, then saves (bizapps-sales#371).
     *
     * Columns are built from the deals' `PipelineStageID`, so setting it moves the card before the save
     * goes out; it used to stay in its old column for the whole save and then jump, which read as a
     * refused move. A failed save puts the card back and says why. On success the section re-reads the
     * roster as the authority.
     */
    private async moveDeal(deal: DealRosterRow, target: BoardColumn): Promise<void> {
        const from = { StageID: deal.PipelineStageID, Stage: deal.PipelineStage };
        deal.PipelineStageID = target.StageID;
        deal.PipelineStage = target.Label;
        this.Moving = true;
        this.cdr.detectChanges();

        const failure = await this.saveStage(deal, target);
        if (failure) {
            deal.PipelineStageID = from.StageID;
            deal.PipelineStage = from.Stage;
            this.Message = failure;
        } else {
            this.StageMoved.emit();
        }
        this.Moving = false;
        this.cdr.detectChanges();
    }

    /**
     * Saves the stage through `Sales.SaveDeal` — the same operation the workspace saves with — rather
     * than a bespoke write. That is what earns the stage event, the validation and the company
     * resolution without this component knowing they exist; the operation appends the append-only
     * `DealStageEvent` itself when it sees the stage change. Reusing `LoadDeal` also means the deal's
     * lines and instalments round-trip intact, which matters because the operation treats a present
     * array as the complete desired set.
     *
     * @returns why the move failed, or null when it saved.
     */
    private async saveStage(deal: DealRosterRow, target: BoardColumn): Promise<string | null> {
        try {
            const draft = await this.service.LoadDeal(deal.ID);
            if (!draft) {
                return `"${deal.Name}" could not be read, so it was not moved.`;
            }
            draft.PipelineStageID = target.StageID;
            const outcome = await this.service.Save(draft);
            if (!outcome.Success) {
                return outcome.Validation?.Issues[0]?.Message ?? outcome.ErrorMessage ?? `"${deal.Name}" could not be moved.`;
            }
            return null;
        } catch (err) {
            return `"${deal.Name}" could not be moved: ${err instanceof Error ? err.message : String(err)}`;
        }
    }

    /** The idle flag for a card, or null. See {@link StageIdleFor}. */
    public IdleFor(deal: DealRosterRow): StageIdle | null {
        const stage = this.Stages.find((s) => s.ID === deal.PipelineStageID);
        return StageIdleFor(deal, stage?.RottingDays, this.StageEnteredOn.get(deal.ID.toLowerCase()), BusinessToday());
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

    /** Exposed for the card's close date. See {@link CardCloseDay} and {@link DisplayDay}. */
    public readonly CardCloseDay = CardCloseDay;
    public readonly CardClosed = CardClosed;
    public readonly CardDayLabel = CardDayLabel;
    /** Track by ID so a re-render does not tear down every card. */
    public TrackCard = (_: number, deal: DealRosterRow): string => deal.ID;
    /** Exposed for the template's per-card fallback. See DEFAULT_DISPLAY_CURRENCY. */
    public readonly DefaultCurrency = DEFAULT_DISPLAY_CURRENCY;
    /**
     * What the stated-amount footnote says when a reader hovers it.
     *
     * In the component rather than the template because it is a sentence, and a sentence built out of
     * a ternary inside a binding is unreadable in both places at once.
     */
    public PricingNote(column: BoardColumn): string {
        return column.NonePriced
            ? 'No deal in this stage has been priced by the orders engine. Every figure in this total '
                + 'was typed by a person.'
            : `${column.Unpriced} of ${column.Cards.length} deals in this stage were not priced by the `
                + 'orders engine, so part of this total was typed by a person.';
    }

    public TrackColumn = (_: number, column: BoardColumn): string => column.StageID;
}
