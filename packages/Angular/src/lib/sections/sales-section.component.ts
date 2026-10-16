/**
 * @fileoverview The Sales Explorer section — the shell that makes `/app/sales` read as an app.
 *
 * STRUCTURE MIRRORS bizapps-contracts (which mirrors bizapps-orders), on purpose: the three revenue-stack
 * apps should feel like one suite, and describing the chrome the same way is cheaper and more durable
 * than styling it the same way afterwards.
 *
 *   mj-page-layout > mj-page-header (title, icon, subtitle, [actions]) >
 *   mj-page-body Direction="row" > mj-left-nav + mj-left-nav-content > mj-page-body-interior
 *
 * Top nav crosses SECTIONS and comes from the Application's `DefaultNavItems`; the rail moves within one.
 * See `nav/sales-nav.model.ts` for the IA and why there is only one section today.
 *
 * ── THE SCROLLER, AND WHY IT IS NOT OPTIONAL ────────────────────────────────────────────────────
 *
 * Inherited verbatim from contracts' hard-won comment, because the failure is silent and expensive:
 * `mj-left-nav-content` forces EVERY direct child to `display:flex` + `flex-direction:column` +
 * `height:100%` + `overflow:hidden` through an `::ng-deep` rule. Page content dropped straight into it
 * therefore stops being block flow, becomes a fixed-height flex column that CLIPS instead of scrolling,
 * and its layout becomes a function of the window height. `mj-page-body-interior` is the sanctioned
 * container and is named in that rule's `:not()` list precisely so it keeps `display:block`,
 * `flex:1 1 auto`, `overflow-y:auto`. ONE of them wraps every page, so all three scroll identically.
 *
 * ── RECORDS ARE EXPLORER TABS ───────────────────────────────────────────────────────────────────
 *
 * A deal click is `NavigationService.OpenEntityRecord`, a new deal is `OpenNewEntityRecord`. Explorer
 * owns the tab. There is no in-rail workspace — that nested document strip was the antipattern
 * orders already left. The custom deal form (close-lock + stale-amount) is what those tabs render.
 *
 * ── WHAT IS MJ'S AND WHAT IS OURS ───────────────────────────────────────────────────────────────
 *
 * Chrome is MJ page primitives; buttons are `mjButton`; loading is `mj-loading`. The roster is still
 * a table rather than `mj-explorer-entity-data-grid` because this pass keeps the existing list
 * surface and only changes where a row GOES. Colour, spacing and radius come from `--mj-*` tokens.
 *
 * THIS FILE COMPUTES NO PRICING. The dashboard sums `Deal.Amount` across deals, which is a reporting
 * rollup of figures that are already answers (master plan §9 defines the forecast measures the same
 * way). It never sums LINES into a deal total, never applies a discount, and never sums across
 * `DealTeamMember` — that last one triple-counts any deal with an AE, an SE and an SDR.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompositeKey, LogError, Metadata, type EntityInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent, NavigationService } from '@memberjunction/ng-shared';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { EntityViewerModule, type RecordOpenedEvent, type ViewRelatedRecordNavigation } from '@memberjunction/ng-entity-viewer';
import type { MJUserViewEntityExtended } from '@memberjunction/core-entities';
import {
    DealInListWhere,
    DealPipelineViewWith,
    DealStatusColourRules,
    DealWonInPeriodWhere,
    LoadDealPipelineViewTemplate,
    RelatedRecordTarget,
} from '../pages/deal-views';
import type { ResourceData } from '@memberjunction/core-entities';
import {
    MJButtonDirective,
    MJLeftNavComponent,
    MJLeftNavContentComponent,
    MJPageBodyComponent,
    MJPageBodyInteriorComponent,
    MJPageHeaderComponent,
    MJPageLayoutComponent,
    type MJLeftNavItem,
    type MJLeftNavSection,
} from '@memberjunction/ng-ui-components';

import {
    BuildLeftNavSections,
    DefaultPageFor,
    PrimaryActionFor,
    SubPagesFor,
    type SalesNavBadges,
    type SalesPrimaryAction,
} from '../nav/sales-nav.model';
import { BusinessTimeZoneEngine } from '@mj-biz-apps/common-entities';
import { DealBoardComponent, DEFAULT_DISPLAY_CURRENCY } from '../board/deal-board.component';
import {
    DealWorkspaceService,
    SECTION_LOOKUP_KEYS,
    type DealDashboardSummary,
    type DealRosterRow,
} from '../workspace/deal-workspace.service';
import type {
    DealStatusLookup,
    DealWorkspaceLookups,
    PipelineLookup,
    StageLookup,
} from '../workspace/deal-workspace.types';
import {
    CloseBuckets,
    ClosingSoon,
    FilterInspect,
    ForecastSlices,
    InForecast,
    TileSummary,
    OwnerCoverage,
    StageFunnel,
    FunnelPipelines,
    BusinessToday,
    WeightedOpen,
    type CloseBucket,
    type FunnelPipeline,
    type FunnelStage,
    type InspectKey,
    type OwnerBar,
} from '../pages/dashboard-inspect';
import {
    CALENDAR_YEAR_START,
    DescribeFiscalBasis,
    FormatWindow,
    PERIOD_OPTIONS,
    ResolvePeriod,
    type FiscalYearStartResolution,
    type PeriodKey,
    type PeriodWindow,
} from '../pages/dashboard-period';

/**
 * The account entity, for opening a customer as its own Explorer tab.
 *
 * `Sales Accounts` rather than common's `Organizations`: the deal's `AccountID` points at the IsA CHILD,
 * and that is the record a rep expects to land on — the sales-specific columns are the reason the child
 * exists. Explorer resolves the parent chain from there.
 */
const E_ACCOUNT = 'MJ_BizApps_Sales: Sales Accounts';
const E_DEAL = 'MJ_BizApps_Sales: Deals';
const E_DEAL_STATUS_TYPE = 'MJ_BizApps_Sales: Deal Status Types';

/** One KPI tile. `Tone` drives colour only — no behaviour hangs off it. */
interface SalesKpi {
    Label: string;
    Value: string;
    Footnote: string;
    Tone?: 'warn' | 'err';
    Filter?: InspectKey;
}

@Component({
    selector: 'mjs-sales-section',
    standalone: true,
    imports: [
        CommonModule,
        SharedGenericModule,
        MJPageLayoutComponent,
        MJPageHeaderComponent,
        MJPageBodyComponent,
        MJPageBodyInteriorComponent,
        MJLeftNavComponent,
        MJLeftNavContentComponent,
        MJButtonDirective,
        DealBoardComponent,
        EntityViewerModule,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './sales-section.component.html',
    styleUrls: ['./sales-section.component.css'],
})
export class MJSSalesSectionComponent implements OnInit {
    /** Which top-level section this mount represents. One today; see the nav model. */
    @Input() Section = 'deals';

    private readonly service = inject(DealWorkspaceService);
    private readonly cdr = inject(ChangeDetectorRef);
    /**
     * Opens a RECORD as its own Explorer tab — deals AND accounts.
     */
    private readonly nav = inject(NavigationService);

    public Page = '';
    /** The dashboard's figures (roster and summary) have not landed yet. */
    public Loading = true;
    /**
     * The reads the dashboard's figures do not need are still out: the board's lookups, the win rate
     * and the grids' view. The tiles show without waiting for them (bizapps-sales#261); each surface
     * that does need them shows its own loading state until this clears.
     */
    public DetailLoading = true;
    /**
     * Every open deal, and the closed deals closed since the start of the current fiscal quarter
     * (bizapps-sales#209). The BOARD renders from this, so a pipeline flagged out of the forecast stays
     * viewable. The dashboard reads only its open deals; won figures come from the summary query.
     */
    public Deals: DealRosterRow[] = [];
    /**
     * What the dashboard's current-book figures read: `Deals` minus open deals in pipelines flagged
     * out of the forecast. See `InForecast`.
     */
    private forecastDeals: DealRosterRow[] = [];
    /** Set when a row could not be opened. Shown verbatim. The roster's refusal is `RosterError`. */
    public Message = '';
    /**
     * Why the roster was refused, or null. Separate from `Message` because navigating clears that, and
     * the dashboard keeps its tiles unavailable for as long as this is set (see `TileSummary`).
     */
    public RosterError: string | null = null;
    /**
     * Why the last `Refresh()` could not finish, or null. While set, every page shows this with a
     * Retry button in place of its content (bizapps-sales#195).
     *
     * Separate from `RosterError`, which the dashboard survives with its tiles marked unavailable: this
     * one means the load as a whole stopped, so nothing below it is known to be current.
     */
    public LoadError: string | null = null;
    /** Identifies the newest `Refresh()`, so a slower superseded one cannot apply its replies, clear its spinner or set its error. */
    private refreshToken = 0;
    /** Identifies the newest inspect view request, so a slower superseded one cannot replace the grid. */
    private inspectToken = 0;
    /** Which slice the inspect grid is showing. Default is closing-soonest (the DB-oracle spec). */
    public InspectFilter: InspectKey = 'closing';
    /**
     * The dashboard's reporting period, and what it resolves to.
     *
     * ── WHAT IT DOES AND DOES NOT TOUCH (golive#232) ────────────────────────────────────────────
     *
     * It bounds exactly three things: the **Won** tile, the **Closed** segment of the forecast stack,
     * and the **win rate**. Open pipeline, open deals, past expected close, stage mix, close buckets
     * and commit by owner are the CURRENT BOOK and stay unwindowed — they answer "what is in front of
     * us now", which a period cannot narrow without changing the question.
     *
     * Defaults to the current fiscal quarter, reckoned from accounting's configured fiscal year start
     * (see `DealWorkspaceService.LoadFiscalYearStart`), not from the calendar.
     */
    public Period: PeriodKey = 'quarter';
    public readonly PeriodOptions = PERIOD_OPTIONS;
    /**
     * Where the fiscal year start came from. Starts at the calendar default with `pending` -- NOT
     * with `no-accounting`.
     *
     * The selector and its basis line sit in `.sechead`, which renders OUTSIDE the dashboard's
     * loading guard, so whatever this holds is on screen from the first paint. Seeding it with
     * `no-accounting` made that line read "calendar year (BizApps Accounting not installed)" on
     * every load of a host where accounting IS installed, and left that claim standing permanently
     * if the read never resolved. `pending` is a state the template can still describe, and it is
     * the true one until {@link DealWorkspaceService.LoadFiscalYearStart} answers.
     */
    public FiscalStart: FiscalYearStartResolution = { Start: CALENDAR_YEAR_START, Basis: 'pending' };
    /**
     * A period change is in flight. The figures it bounds are stale until it lands, and the pill and
     * the footnote have ALREADY moved -- so the template shows those three as pending rather than
     * letting a reader take last period's Won count for this period's.
     */
    public PeriodLoading = false;
    /** Identifies the newest period request, so a slower superseded one cannot apply late. */
    private periodToken = 0;
    public WinRateByCount: number | null = null;
    public WinRateByValue: number | null = null;
    public WinClosedCount = 0;
    public WinWonCount = 0;
    /**
     * The win rate query did not run. The card then shows "figures unavailable", as the tiles do,
     * rather than "0 won / 0 closed", which reads as nothing having closed.
     */
    public WinRateUnavailable = false;
    public DealEntityInfo: EntityInfo | null = null;
    public InspectView: MJUserViewEntityExtended | null = null;
    public AllDealsView: MJUserViewEntityExtended | null = null;
    /**
     * The shared pipeline view, read once per `Refresh()`. Both grids, and every inspect slice click,
     * take a copy of it instead of reading it again (bizapps-sales#261). Null when the Deals entity is
     * not in metadata.
     */
    private pipelineView: MJUserViewEntityExtended | null = null;


    /**
     * The four tile figures, from `Sales: Dashboard Summary`.
     *
     * NULL means the QUERY DID NOT RUN, which the template renders differently from a database with
     * no deals: the query aggregates, so it returns a row of zeroes over an empty table. Collapsing
     * those two states would show a confident set of zeroes when the truth is that nothing was read.
     */
    private summary: DealDashboardSummary | null = null;

    /**
     * Pipelines, stages and statuses the BOARD renders from.
     *
     * Public because they are `@Input()`s on the board; held here rather than fetched by the board so the
     * two pages read one roster and one lookup set, and cannot disagree about what exists.
     */
    public Pipelines: PipelineLookup[] = [];
    public Stages: StageLookup[] = [];
    public DealStatusTypes: DealStatusLookup[] = [];
    /**
     * The board's company and pipeline choice, null for the defaults. Held here rather than on the
     * board, which is rebuilt on every reload and page switch: held there, a drag on any pipeline but
     * the first reloaded the board onto the first one, with the moved card out of view.
     */
    public BoardCompanyID: string | null = null;
    public BoardPipelineID: string | null = null;

    public async ngOnInit(): Promise<void> {
        this.Page = DefaultPageFor(this.Section);
        await this.Refresh();
    }

    // ── Chrome ─────────────────────────────────────────────────────────────────

    public get NavSections(): MJLeftNavSection[] {
        return BuildLeftNavSections(SubPagesFor(this.Section), this.Badges);
    }

    public get PrimaryAction(): SalesPrimaryAction | null {
        return PrimaryActionFor(this.Page);
    }

    public get Title(): string {
        return 'Sales';
    }

    public get Subtitle(): string {
        return 'Deals, the lines they carry, and the terms they are signed on';
    }

    public OnNav(item: MJLeftNavItem): void {
        this.Page = item.id;
        this.Message = '';
        this.cdr.detectChanges();
    }

    /** The header's primary verb. Opens a new Explorer record tab — never an in-rail workspace. */
    public StartPrimary(): void {
        this.nav.OpenNewEntityRecord(E_DEAL);
    }

    // ── Data ───────────────────────────────────────────────────────────────────

    /**
     * Loads everything the section shows. Never rejects.
     *
     * ── WHY THE SPINNER IS CLEARED IN `finally` (bizapps-sales#195) ──────────────────────────────
     *
     * The data provider THROWS on a transport failure — a gateway 504, a timeout, a dropped
     * connection — rather than returning `Success: false`. Any one of the reads below can therefore
     * reject, and `Loading = false` used to sit after all of them: one failed request left the page on
     * its spinner for good, with the rejection unhandled because `ngOnInit` awaits this uncaught.
     * Clearing it in `finally` covers every exit, including ones added later; the failure is shown as
     * `LoadError` with a Retry instead. `DetailLoading` is cleared there for the same reason.
     *
     * `quiet` re-reads without the spinners, so the pages stay mounted and show their current data
     * until the new data lands. The board uses it after a drag: the card is already where it was
     * dropped, and tearing the board down to show a spinner made it flash on every move.
     */
    public async Refresh(quiet = false): Promise<void> {
        const token = ++this.refreshToken;
        if (!quiet) {
            this.Loading = true;
            this.DetailLoading = true;
        }
        this.LoadError = null;
        this.cdr.detectChanges();
        try {
            await this.load(token);
        } catch (e) {
            if (token === this.refreshToken) {
                this.LoadError = e instanceof Error ? e.message : String(e);
                LogError(`Sales: the section failed to load - ${this.LoadError}`);
            }
        } finally {
            if (token === this.refreshToken) {
                this.Loading = false;
                this.DetailLoading = false;
                this.cdr.detectChanges();
            }
        }
    }

    /** The reads behind `Refresh()`. Throws on any failure the reads themselves do not absorb. */
    private async load(token: number): Promise<void> {
        /**
         * THE BUSINESS ZONE IS LOADED BEFORE ANYTHING ASKS WHAT DAY IT IS (bc-aidp-next-golive#168).
         *
         * `this.Window` reads `BusinessToday()`, and so do the inspect filter and the close buckets.
         * The engine fails open to UTC when it has not been configured, which is silently the old
         * behaviour — so the call has to happen before the first read rather than be left to MJ's
         * startup sequence, which is the only other thing that would have done it. `Config(false)` is
         * idempotent and a no-op after the first call, so a refresh costs nothing.
         */
        await BusinessTimeZoneEngine.Instance.Config(false);

        /**
         * THE FISCAL START IS READ BEFORE THE WINDOWED QUERIES, NOT ALONGSIDE THEM.
         *
         * It is what the window is computed FROM, so firing it in the same `Promise.all` would send
         * the summary and win-rate queries a window derived from whatever `FiscalStart` still held —
         * on first load, the calendar default. The figures would be right for a January year and
         * quietly wrong for every other deployment, and they would settle to the correct values on
         * the next refresh, which is the hardest kind of wrong number to notice.
         */
        this.FiscalStart = await this.service.LoadFiscalYearStart();
        const window = this.Window;
        this.DealEntityInfo = new Metadata().Entities.find((e) => e.Name === E_DEAL) ?? null;

        const period = this.Period;

        /**
         * EVERY READ STARTS NOW; THE DASHBOARD WAITS ONLY FOR ITS OWN TWO (bizapps-sales#261).
         *
         * The tiles, the stack and the current-book cards read the roster and the summary and nothing
         * else, so they show as soon as those two land. The rest is already in flight and fills in
         * behind them. The no-op `catch` only stops a fast failure there from being reported as
         * unhandled while the first two are still awaited; `loadDetail` still awaits it and throws.
         */
        const detail = Promise.all([
            // Only the lists the BOARD and the status pill read. Accounts and contacts are the deal
            // workspace's pickers and grow with the customer base, so they are not loaded here.
            this.service.LoadLookups(SECTION_LOOKUP_KEYS),
            // The window reaches win rate through parameters the query ALREADY declared -- it filters
            // on ActualCloseDate, the same dimension the Won tile now uses, so the two cannot drift.
            this.service.LoadWinRate(window),
            // The grids' saved view, read once for both grids.
            this.DealEntityInfo ? LoadDealPipelineViewTemplate(this.DealEntityInfo) : Promise.resolve(null),
        ]);
        detail.catch(() => undefined);

        const [roster, summary] = await Promise.all([
            this.loadRoster(this.BoardClosedWindow.Start),
            // The four headline figures, reduced in SQL. See LoadDashboardSummary for why.
            this.service.LoadDashboardSummary(window),
        ]);
        // A newer Refresh() was started while these were out; its replies are the ones to show.
        if (token !== this.refreshToken) {
            return;
        }
        this.Deals = roster ?? [];
        this.forecastDeals = InForecast(this.Deals);
        // A period picked while this was out has already read its own summary; this one is stale.
        if (period === this.Period) {
            this.summary = TileSummary(summary, this.RosterError);
        }
        if (roster && !roster.length) {
            // Not an error — a first-run database has no deals. The template distinguishes the two.
            this.Message = '';
        }
        this.Loading = false;
        this.cdr.detectChanges();

        await this.loadDetail(detail, period, token);
    }

    /** The second half of `load()`: what the board, the win rate and the grids read. */
    private async loadDetail(
        detail: Promise<[DealWorkspaceLookups, Record<string, unknown>[] | null, MJUserViewEntityExtended | null]>,
        period: PeriodKey,
        token: number,
    ): Promise<void> {
        const [lookups, winRate, pipelineView] = await detail;
        if (token !== this.refreshToken) {
            return;
        }
        this.Pipelines = lookups.Pipelines;
        this.Stages = lookups.Stages;
        this.DealStatusTypes = lookups.DealStatusTypes;
        // A period picked while this was out has already read its own win rate; this one is stale.
        if (period === this.Period) {
            this.applyWinRate(winRate);
        }
        this.pipelineView = pipelineView;
        // Copies of the view already read; neither goes back to the server.
        await Promise.all([this.refreshInspectView(), this.refreshAllDealsView()]);
    }

    /**
     * The roster, or null when it could not be read, with the reason kept in `RosterError`.
     *
     * `LoadRoster` throws when the query definition is older than the app (bizapps-sales#137) or the
     * query fails. Left to escape, that rejects `Refresh()` with `Loading` still set, and the page spins
     * forever.
     */
    private async loadRoster(closedSince: string | null): Promise<DealRosterRow[] | null> {
        try {
            const roster = await this.service.LoadRoster(closedSince);
            this.RosterError = null;
            return roster;
        } catch (e) {
            this.RosterError = e instanceof Error ? e.message : String(e);
            LogError(this.RosterError);
            return null;
        }
    }

    /**
     * Opens a deal as an Explorer record tab.
     *
     * `OpenEntityRecord` is the orders/contracts pattern. The custom deal form (close-lock + stale
     * amount) is what that tab renders. A missing ID is not a click we can honour.
     */
    public OpenDeal(row: DealRosterRow): void {
        if (!row.ID) {
            return;
        }
        this.nav.OpenEntityRecord(E_DEAL, CompositeKey.FromID(row.ID));
    }

    /**
     * Opens the CUSTOMER behind a deal as its own Explorer tab.
     *
     * `stopPropagation` is load-bearing, not defensive: this cell sits inside a row whose click handler
     * opens the deal. Without it a click here would do BOTH.
     *
     * A row with no account is not a failure. `AccountID` is nullable by design (an early-stage
     * opportunity legitimately has no account yet), so the affordance simply is not offered — see the
     * template's `@if`.
     */
    public OpenCustomer(row: DealRosterRow, event: Event): void {
        event.stopPropagation();
        if (!row.AccountID) {
            return;
        }
        this.nav.OpenEntityRecord(E_ACCOUNT, CompositeKey.FromID(row.AccountID));
    }

    // ── Reporting period ───────────────────────────────────────────────────────

    /** The resolved bounds of the selected period. Recomputed rather than cached — it is arithmetic. */
    public get Window(): PeriodWindow {
        return ResolvePeriod(this.Period, this.FiscalStart.Start, BusinessToday());
    }

    /**
     * The closed deals the board shows: those closed in the current fiscal quarter, whatever period the
     * dashboard has selected (bizapps-sales#209). Fixed, so the board does not move when the period
     * selector does, and bounded, so the section's first load does not grow with deal history.
     */
    public get BoardClosedWindow(): PeriodWindow {
        return ResolvePeriod('quarter', this.FiscalStart.Start, BusinessToday());
    }

    /** "from 1 Jul 2026" — the board's closed-deal bound, for its header. */
    public get BoardClosedLabel(): string {
        return FormatWindow({ ...this.BoardClosedWindow, End: null });
    }

    /** "1 Jul 2026 – 30 Sep 2026" — the bounds spelled out, for a footnote. */
    public get WindowLabel(): string {
        return FormatWindow(this.Window);
    }

    /**
     * How the fiscal year start was arrived at, in one line.
     *
     * Rendered beside the selector because a period control whose boundaries are invisible is the
     * same defect golive#232 was filed about: a figure that looks settled while meaning something
     * other than what a reader assumes. If this host fell back to the calendar year, the reader
     * should learn that here rather than by reconciling a total by hand.
     */
    public get FiscalBasisLabel(): string {
        return DescribeFiscalBasis(this.FiscalStart);
    }

    /**
     * Change the reporting period and re-read ONLY what the period bounds.
     *
     * The roster is deliberately not refetched. It is not period-bound — the board, the stage mix,
     * the close buckets and commit-by-owner all read that same array and must not move when a
     * dashboard control changes — and re-fetching it would also blank those surfaces mid-interaction
     * for no gain. The stack's Closed segment is the summary's `WonAmount`, re-read here with the tile
     * (bizapps-sales#209).
     */
    public async SetPeriod(key: PeriodKey): Promise<void> {
        if (key === this.Period) {
            return;
        }
        this.Period = key;
        /**
         * EVERY RESPONSE IS CHECKED AGAINST THE SELECTION THAT IS CURRENT WHEN IT LANDS.
         *
         * Two clicks in quick succession put two pairs of queries in flight, and nothing orders the
         * responses. Without this token the slower one wins whenever it finishes last, leaving the
         * Won tile and the win rate showing All-time figures under a pill and a footnote that both
         * say "last quarter" -- and staying that way, because `Refresh()` is the only thing that
         * would correct it and a period change does not call it. A superseded reply is discarded
         * rather than applied late.
         */
        const token = ++this.periodToken;
        this.PeriodLoading = true;
        this.cdr.detectChanges();
        try {
            const window = this.Window;
            const [summary, winRate] = await Promise.all([
                this.service.LoadDashboardSummary(window),
                this.service.LoadWinRate(window),
            ]);
            if (token !== this.periodToken) {
                return;
            }
            this.summary = TileSummary(summary, this.RosterError);
            this.applyWinRate(winRate);
            // The Won slice is period-bound, so a narrowing period changes which deals Inspect should
            // be listing. Refreshing the view keeps the grid showing the set the tile just counted.
            if (this.InspectFilter === 'won') {
                await this.refreshInspectView();
            }
        } catch (e) {
            /**
             * A THROW USED TO ESCAPE AS AN UNHANDLED REJECTION, with `Period` already flipped -- so
             * the pills showed the new period, the figures were the old one's, and the early
             * `key === this.Period` return above meant clicking the same pill again would not retry.
             * Clearing the summary makes the failure visible (`Kpis` renders em-dashes and "figures
             * unavailable") instead of presenting stale numbers under a new label.
             */
            if (token === this.periodToken) {
                this.summary = null;
                this.applyWinRate(null);
                LogError(`Sales: reporting period '${key}' failed to load - ${e instanceof Error ? e.message : String(e)}`);
            }
        } finally {
            if (token === this.periodToken) {
                this.PeriodLoading = false;
                this.cdr.detectChanges();
            }
        }
    }

    // ── Dashboard ──────────────────────────────────────────────────────────────

    /**
     * The KPI strip.
     *
     * Every count branches on a `DealStatusType` FLAG resolved through `DealStatusTypeID` — never on the
     * status name. That is the vocabulary rule, and it is also the only version that survives somebody
     * renaming "Won" to "Signed".
     */
    public get Kpis(): SalesKpi[] {
        const s = this.summary;
        if (!s) {
            // The query did not run. Say so rather than rendering four zeroes, which would read as a
            // quiet, confident 'you have no pipeline'.
            return [
                { Label: 'Open pipeline', Value: '—', Footnote: 'figures unavailable', Tone: 'warn' },
                { Label: 'Open deals', Value: '—', Footnote: 'figures unavailable' },
                { Label: 'Past expected close', Value: '—', Footnote: 'figures unavailable' },
                { Label: 'Won', Value: '—', Footnote: 'figures unavailable' },
            ];
        }

        /**
         * HOW MUCH OF THAT TOTAL NOBODY PRICED.
         *
         * The tile is the most-read number on the page and it was the least qualified: a sum of stored
         * `Deal.Amount` values presented as one authoritative figure, with the provenance flag sitting
         * unread on every row that fed it. On the data in the host database every deal carries
         * `AmountIsComputed = 0`, so the tile was reporting entirely hand-typed money as pipeline value.
         * The footnote now says so.
         */
        /**
         * ── EXPRESSED FROM THE SUMMARY, NOT FROM A LOCAL THAT NO LONGER EXISTS ──────────────────────
         *
         * The board branch computed this by filtering an `open` array and dividing by `open.length`.
         * Neither survives the merge: the dashboard branch replaced that whole block with one summary
         * QUERY, so `open` and `openValue` are gone and this code would not have compiled. Auto-merge
         * kept the consumer and dropped the producer — the failure mode worth naming, because the file
         * still looked plausible.
         *
         * It resolves better than it started. `DealDashboardSummary` already carries
         * `OpenPricedAmount` / `OpenStatedAmount` / `OpenNoAmountCount`, computed in SQL over every open
         * deal rather than over whatever the roster page happened to load — so the footnote is now exact
         * where the hand-filtered version was limited to the rows on screen. It also reports MONEY rather
         * than a deal count, which is the question a reader of a money tile is actually asking.
         */
        const statedNote = s.OpenStatedAmount === 0
            ? ''
            : s.OpenPricedAmount === 0
                ? ' · all stated, none priced'
                : ` · ${this.money(s.OpenStatedAmount)} stated`;

        return [
            {
                Label: 'Open pipeline',
                Value: this.money(s.OpenAmount),
                // Dashboard's summary figures, with the board branch's provenance suffix. Both halves
                // are kept: the currency-correct total, and the caveat about who produced it.
                Footnote: `across ${s.OpenCount} open ${s.OpenCount === 1 ? 'deal' : 'deals'}${statedNote}`,
                Filter: 'pipe',
            },
            {
                Label: 'Open deals',
                Value: String(s.OpenCount),
                // Every open deal, Omitted ones included; the money figures leave those out, so say how many.
                Footnote: `of ${s.TotalCount} total${s.OpenOmittedCount ? ` · ${s.OpenOmittedCount} left out of the forecast` : ''}`,
                Filter: 'open',
            },
            {
                Label: 'Past expected close',
                Value: String(s.PastExpectedCloseCount),
                Footnote: 'still open, close date gone',
                Tone: s.PastExpectedCloseCount ? 'warn' : undefined,
                Filter: 'slipped',
            },
            {
                Label: 'Won',
                /**
                 * PENDING WHILE THE PERIOD IS CHANGING, because `Period` flips synchronously on the
                 * click and the footnote below moves with it, while `s.WonCount` is still the figure
                 * the PREVIOUS period returned. Rendering it would put last period's count under this
                 * period's dates for the length of a round trip — a tile that looks settled while
                 * meaning something else, which is the defect golive#232 was filed about.
                 */
                Value: this.PeriodLoading ? '…' : String(s.WonCount),
                /**
                 * THE FOOTNOTE NAMES THE PERIOD, because the tile's value no longer speaks for itself.
                 *
                 * It read "closed won to date" while the three tiles beside it described the current
                 * book, which is the mismatch golive#232 reported. Now that the figure is windowed,
                 * saying WHICH window is what stops the same confusion arriving from the other
                 * direction — a reader seeing a smaller number and assuming deals went missing.
                 */
                Footnote: this.PeriodLoading
                    ? `counting ${this.Period === 'alltime' ? 'all time' : this.WindowLabel}…`
                    : this.Period === 'alltime'
                        ? 'closed won · all time'
                        : `closed won · ${this.Window.Label.toLowerCase()} (${this.WindowLabel})`,
                Filter: 'won',
            },
        ];
    }

    /**
     * Open deals whose expected close date has already passed.
     *
     * READS THE FLAG THE ROSTER QUERY ALREADY APPLIED. `Sales: Deal Roster` computes
     * `IsPastExpectedClose` against the business day from `fnBusinessToday()` (golive#168 -- it was the
     * UTC day, which made a deal due today read as past due from 6 PM Central, 7 PM in daylight time),
     * so the comparison happens on the server against the server's clock.
     *
     * That is a real improvement over what this replaced, not just a relocation. The old version built
     * a UTC date string here with `getUTC*` getters specifically to avoid the boundary moving a day
     * for anyone west of Greenwich -- a correct workaround for a problem the browser should never have
     * been asked to solve. Now the client's clock is not involved at all.
     *
     * The COUNT on the tile comes from the summary query rather than from this list, so the badge and
     * the tile cannot disagree about how many there are while the roster is still loading.
     */
    public get SlippedDeals(): DealRosterRow[] {
        return this.forecastDeals.filter((d) => d.IsPastExpectedClose === true);
    }
    public get Badges(): SalesNavBadges {
        // The summary's count when it ran, the list's length otherwise -- so the badge still says
        // something true if the query failed but the roster loaded.
        return { Slipped: this.summary?.PastExpectedCloseCount ?? this.SlippedDeals.length };
    }

    /**
     * The handful of deals worth showing on a dashboard — soonest expected close first.
     *
     * IT SORTS, rather than trusting the roster query's `ORDER BY` to still be
     * `ExpectedCloseDate ASC` when someone changes it for a different reason. Correct output either way
     * today; the difference is that the comment above is now enforced by the code beneath it instead of
     * by a clause two files away. `slice()` first, so the copy is small and `sort()` never mutates the
     * shared `Deals` array — an in-place sort here would silently reorder the board.
     *
     * The dates are DATE strings in UTC (`YYYY-MM-DD`), so lexical comparison IS chronological. No
     * `new Date()` involved, which is what keeps this free of the local-midnight drift `SlippedDeals`
     * has to work around.
     */
    public get ClosingSoon(): DealRosterRow[] {
        return ClosingSoon(this.forecastDeals, 8);
    }

    /**
     * The roster rows behind the selected inspect slice. Empty for `won`: the roster holds only this
     * quarter's closed deals, so that slice is filtered on the server instead (see
     * `refreshInspectView`).
     */
    public get InspectRows(): DealRosterRow[] {
        if (this.InspectFilter === 'won') {
            return [];
        }
        return FilterInspect(this.forecastDeals, this.InspectFilter, BusinessToday());
    }

    /** How many deals the inspect grid lists. For `won`, the Won tile's count, which the grid matches. */
    public get InspectCount(): number | null {
        return this.InspectFilter === 'won' ? (this.summary?.WonCount ?? null) : this.InspectRows.length;
    }

    public get InspectLabel(): string {
        switch (this.InspectFilter) {
            case 'closing':
                return 'Open deals closing soonest';
            case 'commit':
                return 'Open deals marked for commit';
            case 'best':
                return 'Open best-case deals, including commit';
            case 'pipe':
                return 'Open pipeline';
            case 'open':
                return 'Every open deal, including those left out of the forecast';
            case 'remainder':
                return 'Open deals outside Commit and Best Case';
            case 'slipped':
                return 'Open deals past their expected close date';
            case 'noowner':
                return 'Open deals with no owner';
            case 'won':
                return this.Period === 'alltime' ? 'Won deals · all time' : `Won deals closed ${this.WindowLabel}`;
            case 'week':
                return 'Expected close in the next 7 days';
            case 'month':
                return 'Expected close later this month';
            case 'later':
                return 'Later, or no close date';
            default:
                return '';
        }
    }

    public SetInspect(key: InspectKey): void {
        this.InspectFilter = key;
        void this.refreshInspectView().then(() => this.cdr.detectChanges());
    }

    public OnInspectOpened(event: RecordOpenedEvent): void {
        const id = (event.compositeKey?.GetValueByFieldName('ID') ?? event.record?.['ID']) as string | undefined;
        if (id) {
            this.nav.OpenEntityRecord(E_DEAL, CompositeKey.FromID(id));
        }
    }

    private async refreshInspectView(): Promise<void> {
        const token = ++this.inspectToken;
        const view = this.pipelineView
            ? await DealPipelineViewWith(this.pipelineView, this.inspectWhere(), DealStatusColourRules(this.DealStatusTypes))
            : null;
        // Two slice clicks in quick succession: only the latest one's view is shown.
        if (token === this.inspectToken) {
            this.InspectView = view;
        }
    }

    /**
     * The inspect grid's filter. `won` is the Won tile's own predicate on the Deals view, so the grid
     * lists every won deal in the period, not only those in the roster (bizapps-sales#209). Every other
     * slice is a list of roster IDs.
     */
    private inspectWhere(): string {
        if (this.InspectFilter !== 'won') {
            return DealInListWhere(this.InspectRows.map((d) => d.ID));
        }
        const statusEntity = new Metadata().Entities.find((e) => e.Name === E_DEAL_STATUS_TYPE);
        return statusEntity ? DealWonInPeriodWhere(statusEntity, this.Window) : '1 = 0';
    }

    private async refreshAllDealsView(): Promise<void> {
        this.AllDealsView = this.pipelineView
            ? await DealPipelineViewWith(this.pipelineView, undefined, DealStatusColourRules(this.DealStatusTypes))
            : null;
    }

    public OnAllDealsOpened(event: RecordOpenedEvent): void {
        this.OnInspectOpened(event);
    }

    /** A linked cell (Customer, Stage, Owner...) in either grid: opens that record as an Explorer tab. */
    public OpenRelatedRecord(nav: ViewRelatedRecordNavigation): void {
        const target = RelatedRecordTarget(nav);
        if (target) {
            this.nav.OpenEntityRecord(target.EntityName, target.Key);
        }
    }

    /**
     * The forecast stack. `Closed` is bounded by the selected period; the open segments never are.
     *
     * `Closed` is the summary query's `WonAmount`, the amounts of the deals the Won tile counts. The
     * roster no longer carries every won deal (bizapps-sales#209), so the open segments come from the
     * roster and the closed one from SQL. While the summary is unavailable, so is `Closed`: 0, beside
     * the tiles' "figures unavailable".
     *
     * `Total` is therefore the sum of two different questions — what landed in the window, and what is
     * open right now — which is exactly what the card's header tells the reader. See
     * {@link ForecastSlices} for why it is built this way rather than windowing all four.
     */
    public get Stack(): { Closed: number; Commit: number; BestOnly: number; PipeOnly: number; Total: number } {
        const s = { ...ForecastSlices(this.forecastDeals, this.Window), Closed: this.summary?.WonAmount ?? 0 };
        const Total = s.Closed + s.Commit + s.BestOnly + s.PipeOnly;
        return { ...s, Total };
    }

    /** What the stack's Closed segment is bounded by, for the card header. */
    public get StackClosedNote(): string {
        return this.Period === 'alltime'
            ? 'Closed is all time · open segments are the current book'
            : `Closed is ${this.Window.Label.toLowerCase()} · open segments are the current book`;
    }

    public StackPct(part: number): string {
        const t = this.Stack.Total;
        if (t <= 0 || part <= 0) return '0%';
        return `${Math.max(2, Math.round((part / t) * 100))}%`;
    }

    /**
     * The pipeline the Stage mix card shows. Null until a reader picks one, which means the first of
     * {@link FunnelPipelineOptions}: the default pipeline when it has open deals.
     */
    public FunnelPipelineID: string | null = null;

    /** The pipelines with open deals. The card shows tabs only when there is more than one. */
    public get FunnelPipelineOptions(): FunnelPipeline[] {
        return FunnelPipelines(this.forecastDeals, this.Pipelines);
    }

    /** The picked pipeline while it still has open deals, otherwise the first one that does. */
    public get ActiveFunnelPipelineID(): string | null {
        const options = this.FunnelPipelineOptions;
        const picked = options.find((p) => p.ID.toLowerCase() === (this.FunnelPipelineID ?? '').toLowerCase());
        return (picked ?? options[0])?.ID ?? null;
    }

    public SelectFunnelPipeline(id: string): void {
        this.FunnelPipelineID = id;
        this.cdr.detectChanges();
    }

    public get Funnel(): FunnelStage[] {
        const pipelineID = this.ActiveFunnelPipelineID;
        return pipelineID ? StageFunnel(this.forecastDeals, pipelineID) : [];
    }

    public FunnelHeight(count: number): string {
        const max = Math.max(1, ...this.Funnel.map((s) => s.Count));
        return `${Math.max(8, Math.round((count / max) * 100))}%`;
    }

    public get Buckets(): CloseBucket[] {
        return CloseBuckets(this.forecastDeals, BusinessToday());
    }

    public get Owners(): OwnerBar[] {
        return OwnerCoverage(this.forecastDeals);
    }

    public OwnerPct(amount: number): string {
        const max = Math.max(1, ...this.Owners.map((o) => o.Amount));
        return `${Math.round((amount / max) * 100)}%`; // money-grep-allow: ratio of two stored amounts rendered as a bar width percentage — the result is a CSS length, not a money figure
    }

    public get Weighted(): number {
        return WeightedOpen(this.forecastDeals);
    }

    public get SilentCount(): number {
        // Last-activity from Common is not on the roster yet. Unowned + slipped + stuck-less
        // "needs a person" queues that we CAN answer without inventing a second activity query.
        return this.forecastDeals.filter((d) => d.IsOpen && !d.OwnerEmployee).length;
    }

    public get CommitCount(): number {
        return this.forecastDeals.filter((d) => d.IsOpen && d.IncludeInCommit).length;
    }

    public ForecastPill(row: DealRosterRow): string {
        if (row.IsWon) return 'closed';
        if (row.IncludeInCommit) return 'commit';
        if (row.IncludeInBestCase) return 'best';
        return 'pipe';
    }

    public ForecastLabel(row: DealRosterRow): string {
        if (row.IsWon) return 'Closed';
        if (row.IncludeInCommit) return 'Commit';
        if (row.IncludeInBestCase) return 'Best Case';
        return row.ForecastCategoryType || 'Pipeline';
    }

    /** Null means the query did not run: every figure is cleared and the card says so. */
    private applyWinRate(rows: Record<string, unknown>[] | null): void {
        this.WinRateUnavailable = rows === null;
        if (rows === null) {
            this.WinClosedCount = 0;
            this.WinWonCount = 0;
            this.WinRateByCount = null;
            this.WinRateByValue = null;
            return;
        }
        const num = (v: unknown): number => {
            const n = Number(v);
            return Number.isFinite(n) ? n : 0;
        };
        let closed = 0;
        let won = 0;
        let closedAmt = 0;
        let wonAmt = 0;
        for (const r of rows) {
            closed += num(r['ClosedCount']);
            won += num(r['WonCount']);
            closedAmt += num(r['WonAmount']) + num(r['LostAmount']);
            wonAmt += num(r['WonAmount']);
        }
        this.WinClosedCount = closed;
        this.WinWonCount = won;
        this.WinRateByCount = closed > 0 ? won / closed : null;
        this.WinRateByValue = closedAmt > 0 ? wonAmt / closedAmt : null;
    }

    // ── Display helpers ────────────────────────────────────────────────────────


    /**
     * A whole-currency figure. Formatting only — it neither derives nor rounds a stored value; the
     * number displayed is whatever came back, shown without decimals.
     */
    private money(value: number | string | null | undefined): string {
        /**
         * COERCE BEFORE FORMATTING, because `toLocaleString` fails SILENTLY on a string.
         *
         * `String.prototype.toLocaleString` exists and ignores the options object entirely, so a value
         * arriving as "27480.0000" renders as `27480.0000` -- no symbol, no separators, no error, and
         * nothing in the output saying formatting did not happen. It looks like a styling bug rather
         * than a type one, which is why it would survive review.
         *
         * Measured: this provider returns numbers today. The coercion is here because the cast that
         * guaranteed it was an assertion, and because the browser reaches these figures over a
         * transport this has not been tested against.
         */
        const n = Number(value);
        if (!Number.isFinite(n)) {
            // Never render NaN as money. An em dash is the same "no figure" the roster already uses.
            return '—';
        }
        return n.toLocaleString(undefined, {
            style: 'currency',
            currency: DEFAULT_DISPLAY_CURRENCY,
            maximumFractionDigits: 0,
        });
    }

    public Money(value: number | string | null): string {
        return value === null || value === undefined ? '—' : this.money(value);
    }

    /**
     * Tone for a status pill, derived from the FLAGS rather than the name — same rule as the counts.
     * Returns a class name; the CSS decides what it looks like.
     */
    public StatusTone(row: DealRosterRow): string {
        if (row.IsWon) {
            return 'ok';
        }
        if (row.IsLost) {
            return 'err';
        }
        if (row.IsOpen) {
            return 'open';
        }
        return 'muted';
    }

    public Pct(value: number | null): string {
        if (value === null || !Number.isFinite(value)) return '—';
        return `${Math.round(value * 100)}%`;
    }
}

/**
 * Deals — the Explorer nav target.
 *
 * The `@RegisterClass` key must match the `DriverClass` in
 * `metadata/applications/.bizapps-sales-application.json`. BOTH halves are required: metadata naming an
 * unregistered class renders a dead tab, and a registered class with no metadata never appears at all.
 */
@RegisterClass(BaseResourceComponent, 'SalesDealsSectionResource')
@Component({
    selector: 'mjs-deals-resource',
    standalone: true,
    imports: [MJSSalesSectionComponent],
    template: `<mjs-sales-section Section="deals"></mjs-sales-section>`,
})
export class SalesDealsSectionResource extends BaseResourceComponent implements OnInit {
    public ngOnInit(): void {
        super.ngOnInit();
        // Required of every BaseResourceComponent: Explorer waits on this before it stops showing a
        // loading state, so omitting it leaves the tab spinning forever. The section loads its own data
        // asynchronously underneath — this reports that the RESOURCE mounted, not that data arrived.
        this.NotifyLoadComplete();
    }

    public override async GetResourceDisplayName(_d: ResourceData): Promise<string> {
        return 'Deals';
    }

    public override async GetResourceIconClass(_d: ResourceData): Promise<string> {
        return 'fa-solid fa-handshake';
    }
}

/**
 * Tree-shaking anchor, called from `public-api.ts`.
 *
 * Registration is a side effect of import and nothing references these classes by name, so a production
 * build is entitled to drop them — and a dropped registration is a nav tab that mounts nothing, with no
 * error to explain it.
 */
export function LoadSalesSection(): void {
    // No-op by design.
}
