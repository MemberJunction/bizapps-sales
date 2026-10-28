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
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
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
    InspectCriteriaWhere,
    LoadDealPipelineViewTemplate,
    RelatedRecordTarget,
    type InspectTables,
} from '../pages/deal-views';
import {
    DEFAULT_SALES_URL_STATE,
    ParseSalesUrlState,
    SalesUrlParams,
    SameSalesUrlState,
    type SalesUrlState,
} from './sales-url-state';
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
import { DealBoardComponent, DEFAULT_DISPLAY_CURRENCY, StageIdleFor } from '../board/deal-board.component';
import {
    DealWorkspaceService,
    SECTION_LOOKUP_KEYS,
    type DealDashboardSummary,
    type DealRosterRow,
} from '../workspace/deal-workspace.service';
import type {
    DealLookup,
    DealStatusLookup,
    DealWorkspaceLookups,
    PipelineLookup,
    StageLookup,
} from '../workspace/deal-workspace.types';
import {
    CloseBuckets,
    ClosingSoon,
    BookSlippedCount,
    FilterInspect,
    InForecast,
    TileSummary,
    OwnerCoverage,
    StageFunnel,
    FunnelPipelines,
    BusinessToday,
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
import {
    CleanIDs,
    HasFilters,
    HasID,
    NO_FILTERS,
    PipelineOptionsFor,
    PipelinesWithinCompanies,
    SameFilters,
    SortedOptions,
    ToggleID,
    type DashboardFilters,
    type FilterOption,
} from '../pages/dashboard-filters';
import { PipelineCompanies, PipelineLabel } from '../data/company-pipelines';
import { MJSSalesFilterBarComponent, type FilterKind, type SalesFilterBarState } from './sales-filter-bar.component';

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
const E_PIPELINE = 'MJ_BizApps_Sales: Pipelines';
const E_FORECAST_CATEGORY_TYPE = 'MJ_BizApps_Sales: Forecast Category Types';
const E_ORDER_LINE = 'MJ_BizApps_Orders: Order Lines';

/** The defaults a null URL field stands for. */
const DEFAULT_PERIOD: PeriodKey = 'quarter';
const DEFAULT_INSPECT: InspectKey = 'closing';

/** An entity's schema and base view from metadata, or null when it is not loaded. */
function tableOf(entityName: string): { SchemaName: string; BaseView: string } | null {
    return new Metadata().Entities.find((e) => e.Name === entityName) ?? null;
}

/** A thrown value as the sentence a reader is shown. */
function reasonOf(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

/** "1 deal" / "3 deals". */
function deals(n: number): string {
    return `${n} ${n === 1 ? 'deal' : 'deals'}`;
}

/** One headline tile. `Tone` drives colour only — no behaviour hangs off it. */
interface SalesKpi {
    Label: string;
    Value: string;
    Footnote: string;
    /** A second footnote line, when the tile has two facts to qualify it. */
    Footnote2?: string;
    /** One sentence saying what the figure counts. */
    Tooltip: string;
    Tone?: 'warn' | 'err';
    Filter: InspectKey;
}

/** One Needs attention row. */
interface AttentionRow {
    Key: InspectKey;
    Icon: string;
    Label: string;
    Note: string;
    Tooltip: string;
    Count: number | null;
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
        MJSSalesFilterBarComponent,
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

    /**
     * The state the tab's URL names (bizapps-sales#371). Set by the resource from the query params on
     * mount and on back/forward. Each field that differs from what the section shows is applied; an
     * echo of the section's own write therefore changes nothing.
     */
    @Input() public set UrlState(state: SalesUrlState | null) {
        this.urlState = state ?? DEFAULT_SALES_URL_STATE;
        if (this.initialized) {
            this.applyUrlState(this.urlState);
        }
    }
    /** The section's page, period, filters, deal list or Board choice changed; the resource writes the URL. */
    @Output() public readonly UrlStateChange = new EventEmitter<SalesUrlState>();
    private urlState: SalesUrlState = DEFAULT_SALES_URL_STATE;
    private initialized = false;
    /** One URL write per burst of changes (a company change also clears the pipeline). */
    private urlEmitQueued = false;

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
     * (bizapps-sales#209), whatever the filter bar holds. The filter lists' choices (owners, product
     * companies) and the rail's badge read this, so picking one owner does not hide the others from the
     * list.
     */
    public Deals: DealRosterRow[] = [];
    /**
     * The deals in the filter bar's scope (bc-aidp-next-golive#351): every open deal, and the closed
     * deals closed in the selected period, narrowed by the four lists in `Sales: Deal Roster` itself.
     * The BOARD renders these. With no filter and the default period this is `Deals`, so no second read
     * is made.
     */
    public BoardDeals: DealRosterRow[] = [];
    /**
     * The rows the dashboard's grouped cards read (stage, owner, dates, attention): `BoardDeals`, less
     * open deals in pipelines flagged out of the forecast unless the Pipeline filter names them.
     */
    private dashboardDeals: DealRosterRow[] = [];
    /** Set when a row could not be opened. Shown verbatim. The roster's refusal is `RosterError`. */
    public Message = '';
    /**
     * Why the roster was refused, or null. Separate from `Message` because navigating clears that, and
     * the dashboard keeps its tiles unavailable for as long as this is set (see `TileSummary`).
     */
    public RosterError: string | null = null;
    /**
     * Why one of the reads the dashboard's figures do not need failed, or null (bizapps-sales#371). Each
     * is shown only where it is used, so a failed win rate no longer replaces figures that loaded.
     *
     * `LookupsError` is the pipelines, stages, statuses and companies: the Board, the stage tabs and the
     * filter lists. `WinRateError` is the Win rate tile. `ViewError` is the grids' saved view.
     */
    public LookupsError: string | null = null;
    public WinRateError: string | null = null;
    public ViewError: string | null = null;
    /** Why the last period or filter change failed, or null. Shown under the filter bar with a Retry. */
    public PeriodError: string | null = null;
    /**
     * Why the last `Refresh()` could not finish, or null. While set, every page shows this with a
     * Retry button in place of its content (bizapps-sales#195).
     */
    public LoadError: string | null = null;
    /** Identifies the newest `Refresh()`, so a slower superseded one cannot apply its replies, clear its spinner or set its error. */
    private refreshToken = 0;
    /** Identifies the newest deal list request, so a slower superseded one cannot replace the grid. */
    private inspectToken = 0;
    /** Which figure the deal list is showing. Default is closing in the next 30 days. */
    public InspectFilter: InspectKey = DEFAULT_INSPECT;
    /** The list's argument: the stage for `stage`, the owner for `owner`. */
    public InspectArg: string | null = null;
    /**
     * The dashboard's reporting period, and what it resolves to.
     *
     * ── WHAT IT BOUNDS (bc-aidp-next-golive#350) ─────────────────────────────────────────────────
     *
     * Every figure that answers "how are we doing this period" or "what is coming": Won (on the day a
     * win closed), the Commit, Open pipeline and Weighted tiles, the forecast, Open deals by stage,
     * Commit by deal owner and the dated Expected to close buckets (on the day each open deal is
     * expected to close), and the win rate. Needs attention and the "No date" bucket are about the
     * open book today and ignore it.
     *
     * Defaults to the current fiscal quarter, reckoned from accounting's configured fiscal year start
     * (see `DealWorkspaceService.LoadFiscalYearStart`), not from the calendar.
     */
    public Period: PeriodKey = DEFAULT_PERIOD;
    /** The custom range's two days, `YYYY-MM-DD`, read only while `Period` is `custom`. */
    public CustomStart: string | null = null;
    public CustomEnd: string | null = null;
    /** The filter bar's lists. Every list empty is "All". */
    public Filters: DashboardFilters = NO_FILTERS;
    /**
     * Where the fiscal year start came from. Starts at the calendar default with `pending` -- NOT with
     * `no-accounting`, which would assert "accounting not installed" on every load of a host where it
     * is, until `LoadFiscalYearStart` answers.
     */
    public FiscalStart: FiscalYearStartResolution = { Start: CALENDAR_YEAR_START, Basis: 'pending' };
    /**
     * A period or filter change is in flight. The figures are stale until it lands and the controls
     * have ALREADY moved, so every figure shows as pending rather than letting a reader take the last
     * selection's numbers for this one's.
     */
    public PeriodLoading = false;
    /** Identifies the newest period or filter request, so a slower superseded one cannot apply late. */
    private periodToken = 0;
    public WinRateByCount: number | null = null;
    public WinRateByValue: number | null = null;
    public WinClosedCount = 0;
    public WinWonCount = 0;
    /**
     * The win rate query did not run. The tile then shows "figures unavailable", as the others do,
     * rather than "0 won / 0 closed", which reads as nothing having closed.
     */
    public WinRateUnavailable = false;
    public DealEntityInfo: EntityInfo | null = null;
    public InspectView: MJUserViewEntityExtended | null = null;
    public AllDealsView: MJUserViewEntityExtended | null = null;
    /**
     * The shared pipeline view, read once per `Refresh()`. Both grids, and every deal list click, take a
     * copy of it instead of reading it again (bizapps-sales#261). Null when the Deals entity is not in
     * metadata.
     */
    private pipelineView: MJUserViewEntityExtended | null = null;

    /**
     * The headline figures, from `Sales: Dashboard Summary`.
     *
     * NULL means the QUERY DID NOT RUN, which the template renders differently from a database with
     * no deals: the query aggregates, so it returns a row of zeroes over an empty table.
     */
    private summary: DealDashboardSummary | null = null;

    /**
     * Pipelines, stages, statuses and companies. Public because the first three are `@Input()`s on the
     * board; held here so the two pages read one roster and one lookup set.
     */
    public Pipelines: PipelineLookup[] = [];
    public Stages: StageLookup[] = [];
    public DealStatusTypes: DealStatusLookup[] = [];
    private companies: DealLookup[] = [];
    /** The day each open deal entered its stage, for the idle flag (bizapps-sales#450). */
    public StageEnteredOn: ReadonlyMap<string, string> = new Map();
    /**
     * The board's pipeline tab, null for the first. Held here rather than on the board, which is rebuilt
     * on every reload and page switch. Which pipelines it may be is the filter bar's (#351).
     */
    public BoardPipelineID: string | null = null;

    public async ngOnInit(): Promise<void> {
        // The URL's state is in place BEFORE the first load, so the period and filters it names are read.
        const url = this.urlState;
        this.Page = this.pageOrDefault(url.Page);
        this.Period = url.Period ?? DEFAULT_PERIOD;
        this.CustomStart = url.PeriodStart;
        this.CustomEnd = url.PeriodEnd;
        this.Filters = this.filtersOf(url);
        this.InspectFilter = url.Inspect ?? DEFAULT_INSPECT;
        this.InspectArg = url.InspectArg;
        this.BoardPipelineID = url.Pipeline;
        this.initialized = true;
        await this.Refresh();
    }

    // ── URL state ──────────────────────────────────────────────────────────────

    /** What the URL should say now. Defaults are null or empty, so they stay out of the address. */
    public get CurrentUrlState(): SalesUrlState {
        const custom = this.Period === 'custom';
        return {
            Page: this.Page === DefaultPageFor(this.Section) ? null : this.Page || null,
            Period: this.Period === DEFAULT_PERIOD ? null : this.Period,
            PeriodStart: custom ? this.CustomStart : null,
            PeriodEnd: custom ? this.CustomEnd : null,
            Companies: [...this.Filters.CompanyIDs],
            ProductCompanies: [...this.Filters.ProductCompanyIDs],
            Owners: [...this.Filters.OwnerEmployeeIDs],
            Pipelines: [...this.Filters.PipelineIDs],
            Inspect: this.InspectFilter === DEFAULT_INSPECT ? null : this.InspectFilter,
            InspectArg: this.InspectArg,
            Pipeline: this.BoardPipelineID,
        };
    }

    private filtersOf(url: SalesUrlState): DashboardFilters {
        return {
            CompanyIDs: url.Companies,
            ProductCompanyIDs: url.ProductCompanies,
            OwnerEmployeeIDs: url.Owners,
            PipelineIDs: url.Pipelines,
        };
    }

    private pageOrDefault(page: string | null): string {
        return page && SubPagesFor(this.Section).some((p) => p.Id === page) ? page : DefaultPageFor(this.Section);
    }

    /** Applies a URL (back/forward, or a link opened into a mounted tab). Writes nothing back. */
    private applyUrlState(url: SalesUrlState): void {
        if (SameSalesUrlState(url, this.CurrentUrlState)) {
            return;
        }
        this.Page = this.pageOrDefault(url.Page);
        this.BoardPipelineID = url.Pipeline;
        const inspect = url.Inspect ?? DEFAULT_INSPECT;
        const inspectChanged = inspect !== this.InspectFilter || url.InspectArg !== this.InspectArg;
        this.InspectFilter = inspect;
        this.InspectArg = url.InspectArg;
        const filters = this.filtersOf(url);
        const filtersChanged = !SameFilters(filters, this.Filters);
        const period = url.Period ?? DEFAULT_PERIOD;
        const periodChanged = period !== this.Period || url.PeriodStart !== this.CustomStart || url.PeriodEnd !== this.CustomEnd;
        this.Filters = filters;
        this.Period = period;
        this.CustomStart = url.PeriodStart;
        this.CustomEnd = url.PeriodEnd;
        if (filtersChanged || periodChanged) {
            // The figures re-read also re-reads the Board's deals and re-filters the deal list.
            void this.reloadFigures();
        } else if (inspectChanged) {
            void this.refreshInspectView().then(() => this.cdr.detectChanges());
        }
        this.cdr.detectChanges();
    }

    /** Tells the resource the state changed, once per burst, and only when the URL would change. */
    private emitUrlState(): void {
        if (this.urlEmitQueued) {
            return;
        }
        this.urlEmitQueued = true;
        void Promise.resolve().then(() => {
            this.urlEmitQueued = false;
            const state = this.CurrentUrlState;
            if (!SameSalesUrlState(state, this.urlState)) {
                this.urlState = state;
                this.UrlStateChange.emit(state);
            }
        });
    }

    /** The Board's pipeline tab changed. */
    public OnBoardPipeline(pipelineID: string | null): void {
        this.BoardPipelineID = pipelineID;
        this.emitUrlState();
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
        this.emitUrlState();
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
     * The data provider THROWS on a transport failure rather than returning `Success: false`, so any
     * read below can reject. Clearing the spinners in `finally` covers every exit; the failure is shown
     * as `LoadError` with a Retry instead.
     *
     * `quiet` re-reads without the spinners, so the pages stay mounted and show their current data
     * until the new data lands. The board uses it after a drag.
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
                this.LoadError = reasonOf(e);
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
        // The business zone is loaded before anything asks what day it is (bc-aidp-next-golive#168):
        // the engine fails open to UTC when it has not been configured, silently the old behaviour.
        await BusinessTimeZoneEngine.Instance.Config(false);

        // The fiscal start is read BEFORE the windowed queries: it is what the window is computed from.
        this.FiscalStart = await this.service.LoadFiscalYearStart();
        const window = this.Window;
        const filters = this.Filters;
        const figures = this.figuresKey();
        this.DealEntityInfo = new Metadata().Entities.find((e) => e.Name === E_DEAL) ?? null;
        this.MyEmployeeID = this.readMyEmployeeID();

        /**
         * EVERY READ STARTS NOW; THE DASHBOARD WAITS ONLY FOR ITS OWN (bizapps-sales#261). Each detail
         * read settles to a value or its own reason (bizapps-sales#371), shown only where it is used.
         */
        const detail: DetailReads = {
            Lookups: settle(this.service.LoadLookups(SECTION_LOOKUP_KEYS)),
            WinRate: settle(this.service.LoadWinRate(window, filters)),
            View: settle(this.DealEntityInfo ? LoadDealPipelineViewTemplate(this.DealEntityInfo) : Promise.resolve(null)),
            StageEntries: settle(this.service.LoadStageEntries()),
        };

        const [roster, summary, scoped] = await Promise.all([
            this.loadRoster(() => this.readScope(this.BoardClosedWindow, NO_FILTERS)),
            this.service.LoadDashboardSummary(window, filters),
            // The filter bar's deals. On the default period with no filter, the first read serves.
            this.readsOwnScope(window, filters) ? this.loadRoster(() => this.readScope(window, filters)) : Promise.resolve(null),
        ]);
        if (token !== this.refreshToken) {
            return;
        }
        this.Deals = roster ?? [];
        // A period or filter picked while this was out has already read its own figures; these are stale.
        if (figures === this.figuresKey()) {
            this.applyScopedRows(scoped ?? this.Deals, filters);
            this.summary = TileSummary(summary, this.RosterError);
        }
        this.Message = '';
        this.Loading = false;
        this.cdr.detectChanges();

        await this.loadDetail(detail, figures, token);
    }

    /** The second half of `load()`: what the board, the win rate and the grids read. Never throws. */
    private async loadDetail(detail: DetailReads, figures: string, token: number): Promise<void> {
        const [lookups, winRate, pipelineView, entries] = await Promise.all([
            detail.Lookups, detail.WinRate, detail.View, detail.StageEntries,
        ]);
        if (token !== this.refreshToken) {
            return;
        }
        this.LookupsError = lookups.Error;
        const lists = lookups.Value;
        this.Pipelines = lists?.Pipelines ?? [];
        this.Stages = lists?.Stages ?? [];
        this.DealStatusTypes = lists?.DealStatusTypes ?? [];
        this.companies = lists?.Companies ?? [];
        if (figures === this.figuresKey()) {
            this.WinRateError = winRate.Error;
            this.applyWinRate(winRate.Error ? null : winRate.Value);
        }
        this.ViewError = pipelineView.Error;
        // Without the history no deal is flagged idle; the failure is logged below rather than shown.
        this.StageEnteredOn = entries.Value ?? new Map();
        this.pipelineView = pipelineView.Value;
        this.cdr.detectChanges();
        await Promise.all([this.refreshInspectView(), this.refreshAllDealsView()]);
        for (const failed of [lookups.Error, winRate.Error, pipelineView.Error, entries.Error]) {
            if (failed) {
                LogError(`Sales: part of the section failed to load - ${failed}`);
            }
        }
    }

    /**
     * A roster read, or null when it could not be read, with the reason kept in `RosterError`.
     *
     * `LoadRoster` throws when the query definition is older than the app (bizapps-sales#137) or the
     * query fails. Left to escape, that rejects `Refresh()` with `Loading` still set.
     */
    private async loadRoster(read: () => Promise<DealRosterRow[]>): Promise<DealRosterRow[] | null> {
        try {
            const roster = await read();
            this.RosterError = null;
            return roster;
        } catch (e) {
            this.RosterError = reasonOf(e);
            LogError(this.RosterError);
            return null;
        }
    }

    /**
     * True when the filter bar's deals need a read of their own: a filter is set, or the period's closed
     * deals are not the current quarter's that the first read carries.
     */
    private readsOwnScope(window: PeriodWindow, filters: DashboardFilters): boolean {
        const first = this.BoardClosedWindow;
        return HasFilters(filters) || window.Start !== first.Start || window.End !== first.End;
    }

    /**
     * The filter bar's deals: every open deal, and those closed in the period, narrowed by the lists
     * (bc-aidp-next-golive#351). The period bounds only the closed rows: the Board shows every open deal.
     */
    private readScope(window: PeriodWindow, filters: DashboardFilters): Promise<DealRosterRow[]> {
        return this.service.LoadRoster(window.Start, filters, window.End);
    }

    /**
     * The filter bar's deals land. The Board shows them all; the dashboard's grouped cards leave out open
     * deals in pipelines flagged out of the forecast, as `Sales: Dashboard Summary` does, unless the
     * Pipeline filter names pipelines, which includes them there too.
     */
    private applyScopedRows(rows: readonly DealRosterRow[], filters: DashboardFilters): void {
        this.BoardDeals = [...rows];
        this.dashboardDeals = filters.PipelineIDs.length ? [...rows] : InForecast(rows);
    }

    /** Identifies the period and filters a set of figures was read for. */
    private figuresKey(): string {
        return JSON.stringify([this.Period, this.CustomStart, this.CustomEnd, this.Filters]);
    }

    /**
     * Opens a deal as an Explorer record tab. The custom deal form (close-lock + stale amount) is what
     * that tab renders. A missing ID is not a click we can honour.
     */
    public OpenDeal(row: DealRosterRow): void {
        if (!row.ID) {
            return;
        }
        this.nav.OpenEntityRecord(E_DEAL, CompositeKey.FromID(row.ID));
    }

    /**
     * Opens the CUSTOMER behind a deal as its own Explorer tab. `stopPropagation` is load-bearing: the
     * cell sits inside a row whose click opens the deal.
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
        return ResolvePeriod(this.Period, this.FiscalStart.Start, BusinessToday(), { Start: this.CustomStart, End: this.CustomEnd });
    }

    /**
     * The closed deals the first roster read carries: those closed in the current fiscal quarter, both
     * ends bounded (bizapps-sales#209). On the default period this is also what the Board shows, so the
     * Board's header and its cards agree; another period reads its own (bc-aidp-next-golive#351).
     */
    public get BoardClosedWindow(): PeriodWindow {
        return ResolvePeriod('quarter', this.FiscalStart.Start, BusinessToday());
    }

    /** What the Board's columns hold, for its header: open deals, and the period's closed ones. */
    public get BoardScope(): string {
        const window = this.Window;
        if (window.Start === null && window.End === null) {
            return 'Open deals, and every closed deal';
        }
        return `Open deals, and deals closed ${FormatWindow(window)}`;
    }

    /** "Jul 1, 2026 – Sep 30, 2026" — the bounds spelled out. */
    public get WindowLabel(): string {
        return FormatWindow(this.Window);
    }

    /** The period in a sentence: "this quarter", "all time", or the dates of a custom range. */
    public get PeriodPhrase(): string {
        if (this.Period === 'alltime') return 'all time';
        if (this.Period === 'custom') return this.WindowLabel;
        return this.Window.Label.toLowerCase();
    }

    /**
     * How the fiscal year start was arrived at, as the Period dropdown's tooltip. A period control whose
     * boundaries are invisible is a figure that looks settled while meaning something else, so the
     * basis stays one hover away.
     */
    public get PeriodTooltip(): string {
        const basis = DescribeFiscalBasis(this.FiscalStart);
        return `${basis.charAt(0).toUpperCase()}${basis.slice(1)}. ${this.WindowLabel}.`;
    }

    /** The Period dropdown changed. An unknown value is ignored. */
    public async SetPeriod(key: string): Promise<void> {
        const option = PERIOD_OPTIONS.find((o) => o.Key === key);
        if (!option || (option.Key === this.Period && !this.PeriodError)) {
            return;
        }
        this.Period = option.Key;
        this.emitUrlState();
        await this.reloadFigures();
    }

    /** A custom range's date picker changed. Empty is no bound on that side. */
    public async SetCustomRange(start: string, end: string): Promise<void> {
        this.CustomStart = start || null;
        this.CustomEnd = end || null;
        this.emitUrlState();
        await this.reloadFigures();
    }

    /** Reads the current figures again after a failure (bizapps-sales#371). */
    public RetryPeriod(): Promise<void> {
        return this.reloadFigures();
    }

    /**
     * Re-reads what the period and the filters bound: the summary, the win rate and the filter bar's
     * deals, which the Board and the grouped cards read. Then re-filters the deal list.
     *
     * EVERY RESPONSE IS CHECKED AGAINST THE SELECTION THAT IS CURRENT WHEN IT LANDS. Two changes in
     * quick succession put two sets of reads in flight and nothing orders the replies; a superseded
     * one is discarded rather than applied late.
     */
    private async reloadFigures(): Promise<void> {
        const token = ++this.periodToken;
        this.PeriodLoading = true;
        this.PeriodError = null;
        this.cdr.detectChanges();
        try {
            const window = this.Window;
            const filters = this.Filters;
            const [summary, winRate, scoped] = await Promise.all([
                this.service.LoadDashboardSummary(window, filters),
                this.service.LoadWinRate(window, filters),
                this.readsOwnScope(window, filters) ? this.readScope(window, filters) : Promise.resolve(null),
            ]);
            if (token !== this.periodToken) {
                return;
            }
            this.applyScopedRows(scoped ?? this.Deals, filters);
            this.summary = TileSummary(summary, this.RosterError);
            this.WinRateError = null;
            this.applyWinRate(winRate);
            await this.refreshInspectView();
        } catch (e) {
            this.failFigures(token, e);
        } finally {
            if (token === this.periodToken) {
                this.PeriodLoading = false;
                this.cdr.detectChanges();
            }
        }
    }

    /**
     * A failed period or filter change clears the figures, so the tiles read "figures unavailable"
     * rather than presenting the last selection's numbers under the new one, and says why beside a Retry.
     */
    private failFigures(token: number, e: unknown): void {
        if (token !== this.periodToken) {
            return;
        }
        this.summary = null;
        this.applyWinRate(null);
        this.PeriodError = reasonOf(e);
        LogError(`Sales: the dashboard figures for ${this.PeriodPhrase} failed to load - ${this.PeriodError}`);
    }

    /** The selected period's label, for the failure line. */
    public get PeriodLabel(): string {
        return this.Window.Label;
    }

    // ── Filter bar ─────────────────────────────────────────────────────────────

    /** Selling companies: the companies that own a pipeline. */
    public get CompanyOptions(): FilterOption[] {
        return SortedOptions(PipelineCompanies(this.Pipelines).map((c) => ({ ID: c.CompanyID, Name: c.CompanyName ?? 'Unnamed company' })));
    }

    /** Product companies: those on any loaded deal's lines, and any already selected. */
    public get ProductCompanyOptions(): FilterOption[] {
        const ids = CleanIDs([...this.Deals.flatMap((d) => d.ProductCompanyIDs), ...this.Filters.ProductCompanyIDs]);
        return SortedOptions(ids.map((id) => ({ ID: id, Name: this.companyName(id) })));
    }

    /** Deal owners: those on any loaded deal, and any already selected. */
    public get OwnerOptions(): FilterOption[] {
        const named = this.Deals.filter((d) => d.OwnerEmployeeID).map((d) => ({ ID: d.OwnerEmployeeID!, Name: d.OwnerEmployee || 'Unnamed owner' }));
        const selected = this.Filters.OwnerEmployeeIDs.map((id) => ({ ID: id, Name: id === this.MyEmployeeID ? 'Me' : 'Selected owner' }));
        return SortedOptions([...named, ...selected]);
    }

    /** Pipelines of the selected selling companies, or every pipeline when none is selected. */
    public get PipelineOptions(): FilterOption[] {
        const several = PipelineCompanies(this.Pipelines).length > 1 && !this.Filters.CompanyIDs.length;
        return PipelineOptionsFor(this.Pipelines, this.Filters.CompanyIDs)
            .map((p) => ({ ID: p.ID, Name: several ? PipelineLabel(p) : p.Name }));
    }

    private companyName(id: string): string {
        return this.companies.find((c) => HasID([c.ID], id))?.Name
            ?? PipelineCompanies(this.Pipelines).find((c) => HasID([c.CompanyID], id))?.CompanyName
            ?? 'Unnamed company';
    }

    /** The signed-in user's employee record, or null: "My deals" is hidden without one. Read on load. */
    public MyEmployeeID: string | null = null;

    /** `User.EmployeeID` of the signed-in user. Null with no provider yet, or a user linked to no employee. */
    private readMyEmployeeID(): string | null {
        try {
            const id = new Metadata().CurrentUser?.EmployeeID;
            return id === null || id === undefined || String(id) === '' ? null : String(id);
        } catch {
            return null;
        }
    }

    /** True when "My deals" is exactly the owner filter. */
    private get myDealsOn(): boolean {
        const me = this.MyEmployeeID;
        return !!me && this.Filters.OwnerEmployeeIDs.length === 1 && HasID(this.Filters.OwnerEmployeeIDs, me);
    }

    /** What the filter bar shows, on whichever page renders it. */
    public get FilterBarState(): SalesFilterBarState {
        return {
            Period: this.Period,
            CustomStart: this.CustomStart,
            CustomEnd: this.CustomEnd,
            WindowLabel: this.WindowLabel,
            PeriodTooltip: this.PeriodTooltip,
            Filters: this.Filters,
            Options: {
                CompanyIDs: this.CompanyOptions,
                ProductCompanyIDs: this.ProductCompanyOptions,
                PipelineIDs: this.PipelineOptions,
                OwnerEmployeeIDs: this.OwnerOptions,
            },
            MyEmployeeID: this.MyEmployeeID,
            NoLinesLeftOut: this.NoLinesLeftOut,
        };
    }

    /** A checkbox in a filter list changed. */
    public ToggleFilter(kind: FilterKind, id: string): void {
        this.setFilters({ ...this.Filters, [kind]: ToggleID(this.Filters[kind], id) });
    }

    /** A filter list's Clear. */
    public ClearFilter(kind: FilterKind): void {
        this.setFilters({ ...this.Filters, [kind]: [] });
    }

    /** "My deals": the owner filter becomes the signed-in user alone, or back to every owner. */
    public ToggleMyDeals(): void {
        const me = this.MyEmployeeID;
        if (me) {
            this.setFilters({ ...this.Filters, OwnerEmployeeIDs: this.myDealsOn ? [] : [me] });
        }
    }

    /** Applies new filters: a selected pipeline outside the selected companies is dropped. */
    private setFilters(next: DashboardFilters): void {
        const filters = { ...next, PipelineIDs: PipelinesWithinCompanies(next.PipelineIDs, this.Pipelines, next.CompanyIDs) };
        if (SameFilters(filters, this.Filters)) {
            return;
        }
        this.Filters = filters;
        this.emitUrlState();
        void this.reloadFigures();
    }

    /**
     * How many deals a Product company filter leaves out because their order has no lines yet. Shown in
     * the filter chip, so the drop in the figures is explained.
     */
    public get NoLinesLeftOut(): number {
        return this.Filters.ProductCompanyIDs.length ? (this.summary?.NoLinesDealCount ?? 0) : 0;
    }

    // ── Dashboard ──────────────────────────────────────────────────────────────

    /** Money for a tile, or pending while a period or filter change is in flight. */
    private tileMoney(value: number): string {
        return this.PeriodLoading ? '…' : this.money(value);
    }

    /**
     * The five headline tiles, every one bounded by the period and clickable (bc-aidp-next-golive#350).
     *
     * Each comes from `Sales: Dashboard Summary` or `Sales: Win Rate by Count and Value`, and each
     * lists its deals with the same predicate (`InspectCriteriaWhere`), so a tile and its list agree.
     */
    public get Kpis(): SalesKpi[] {
        const s = this.summary;
        if (!s) {
            // The query did not run. Say so rather than rendering zeroes, which would read as a quiet,
            // confident "you have no pipeline".
            return KPI_SHELLS.map((k) => ({ ...k, Value: '—', Footnote: 'figures unavailable' }));
        }
        return [this.wonTile(s), this.commitTile(s), this.pipelineTile(s), this.weightedTile(s), this.winRateTile()];
    }

    private wonTile(s: DealDashboardSummary): SalesKpi {
        return {
            ...KPI_SHELLS[0],
            Value: this.tileMoney(s.WonAmount),
            Footnote: this.PeriodLoading ? 'counting…' : `${deals(s.WonCount)} won · ${this.PeriodPhrase}`,
        };
    }

    private commitTile(s: DealDashboardSummary): SalesKpi {
        return { ...KPI_SHELLS[1], Value: this.tileMoney(s.CommitAmount), Footnote: this.PeriodLoading ? 'counting…' : `${s.CommitCount} Commit ${s.CommitCount === 1 ? 'deal' : 'deals'}` };
    }

    /**
     * Open pipeline, with its deal count and how much of it was typed by hand rather than priced: the
     * most-read number on the page is a sum of stored amounts, and a reader should know when nobody
     * priced them.
     */
    private pipelineTile(s: DealDashboardSummary): SalesKpi {
        const pipelineCount = s.OpenCount - (s.OpenOmittedCount ?? 0);
        const statedNote = s.OpenStatedAmount === 0
            ? ''
            : s.OpenPricedAmount === 0
                ? ' · all entered by hand'
                : ` · ${this.money(s.OpenStatedAmount)} entered by hand`;
        return {
            ...KPI_SHELLS[2],
            Value: this.tileMoney(s.OpenAmount),
            Footnote: this.PeriodLoading ? 'counting…' : `${pipelineCount} open ${pipelineCount === 1 ? 'deal' : 'deals'}${statedNote}`,
            // Every open deal in the period, Omitted ones included; the money leaves those out, so say how many.
            Footnote2: s.OpenOmittedCount && !this.PeriodLoading ? `${s.OpenCount} total · ${s.OpenOmittedCount} excluded from the forecast` : undefined,
        };
    }

    private weightedTile(s: DealDashboardSummary): SalesKpi {
        return { ...KPI_SHELLS[3], Value: this.tileMoney(s.WeightedAmount), Footnote: 'each deal at its probability' };
    }

    /** By value, with the counts in the footnote. Pending while its own read is still out. */
    private winRateTile(): SalesKpi {
        const pending = this.PeriodLoading || this.DetailLoading;
        return {
            ...KPI_SHELLS[4],
            Value: pending ? '…' : this.Pct(this.WinRateByValue),
            Footnote: pending ? 'counting…' : this.WinRateUnavailable ? 'figures unavailable' : `${this.WinWonCount} won / ${this.WinClosedCount} closed`,
        };
    }

    /** True when the deal list is showing `key` (and `arg`, for a figure that takes one). */
    public IsSelected(key: InspectKey, arg: string | null = null): boolean {
        return this.InspectFilter === key && (arg === null || (this.InspectArg ?? '').toLowerCase() === arg.toLowerCase());
    }

    public get Badges(): SalesNavBadges {
        // The whole book's count, whatever the filter bar holds: the badge is outside the dashboard.
        return { Slipped: BookSlippedCount(this.Deals, this.summary?.PastExpectedCloseCount, HasFilters(this.Filters)) };
    }

    /** The default list: open deals expected to close in the next 30 days, soonest first. */
    public get ClosingSoon(): DealRosterRow[] {
        return ClosingSoon(this.dashboardDeals, BusinessToday());
    }

    /**
     * The roster rows behind the selected figure. Empty for `won` and `closed`: the dashboard's rows are
     * open deals, so those two are listed from the server alone (see `inspectWhere`).
     */
    public get InspectRows(): DealRosterRow[] {
        if (this.InspectFilter === 'won' || this.InspectFilter === 'closed') {
            return [];
        }
        return FilterInspect(this.dashboardDeals, this.InspectFilter, BusinessToday(), this.Window, this.InspectArg, this.IdleIDs);
    }

    /** How many deals the list shows: the figure's own count where the query reports one. */
    public get InspectCount(): number | null {
        const s = this.summary;
        switch (this.InspectFilter) {
            case 'won': return s?.WonCount ?? null;
            case 'closed': return this.WinRateUnavailable ? null : this.WinClosedCount;
            case 'commit': return s?.CommitCount ?? null;
            case 'slipped': return s?.PastExpectedCloseCount ?? null;
            case 'noowner': return s?.NoOwnerCount ?? null;
            case 'nodate': return s?.NoCloseDateCount ?? null;
            default: return this.InspectRows.length;
        }
    }

    /** What the deal list is showing, in the words of the figure that was clicked. */
    public get InspectLabel(): string {
        switch (this.InspectFilter) {
            case 'closing': return 'Closing in the next 30 days';
            case 'commit': return 'Commit deals';
            case 'best': return 'Best case deals, not counting Commit';
            case 'pipe': return 'Open pipeline';
            case 'weighted': return 'Deals in the weighted pipeline';
            case 'remainder': return 'Pipeline deals, not in Commit or Best case';
            case 'slipped': return 'Open deals past their expected close date';
            case 'noowner': return 'Open deals with no owner';
            case 'nodate': return 'Open deals with no expected close date';
            case 'idle': return 'Open deals idle past their stage limit';
            case 'won': return 'Won deals';
            case 'closed': return 'Closed deals, won and lost';
            case 'week': return 'Expected to close in the next 7 days';
            case 'month': return 'Expected to close later this month';
            case 'later': return 'Expected to close after this month';
            case 'stage': return `Open deals in ${this.stageName(this.InspectArg)}`;
            case 'owner': return `Commit deals owned by ${this.ownerName(this.InspectArg)}`;
            default: return '';
        }
    }

    /** "Showing Commit deals · 12", with the period when the figure is bounded by one. */
    public get InspectChip(): string {
        const count = this.InspectCount;
        const counted = count === null ? '' : ` · ${count}`;
        return `Showing ${this.InspectLabel.charAt(0).toLowerCase()}${this.InspectLabel.slice(1)}${counted}`;
    }

    private stageName(arg: string | null): string {
        if (!arg || arg.startsWith('unstaged')) return 'no stage';
        return this.Stages.find((s) => HasID([s.ID], arg))?.Name ?? 'the chosen stage';
    }

    private ownerName(arg: string | null): string {
        if (!arg || arg === 'none') return 'no one';
        return this.Owners.find((o) => o.Key === arg.toLowerCase())?.Name ?? 'the chosen owner';
    }

    /** Selects the figure the deal list shows. */
    public SetInspect(key: InspectKey, arg: string | null = null): void {
        this.InspectFilter = key;
        this.InspectArg = key === 'stage' || key === 'owner' ? arg : null;
        void this.refreshInspectView().then(() => this.cdr.detectChanges());
        this.emitUrlState();
    }

    public OnInspectOpened(event: RecordOpenedEvent): void {
        const id = (event.compositeKey?.GetValueByFieldName('ID') ?? event.record?.['ID']) as string | undefined;
        if (id) {
            this.nav.OpenEntityRecord(E_DEAL, CompositeKey.FromID(id));
        }
    }

    private async refreshInspectView(): Promise<void> {
        const token = ++this.inspectToken;
        try {
            const view = this.pipelineView
                ? await DealPipelineViewWith(this.pipelineView, this.inspectWhere())
                : null;
            // Two clicks in quick succession: only the latest one's view is shown.
            if (token === this.inspectToken) {
                this.InspectView = view;
            }
        } catch (e) {
            if (token === this.inspectToken) {
                this.ViewError = reasonOf(e);
            }
        }
    }

    /**
     * The deal list's filter (bizapps-sales#449, bc-aidp-next-golive#350): the clicked figure's own
     * criteria with the period and the filter bar, the same predicate the query used to count it, so
     * the list holds the deals the figure counted. `idle` is worked out from stage history in the
     * browser, so it is a list of at most the open deals' IDs.
     */
    private inspectWhere(): string {
        const key = this.InspectFilter;
        if (key === 'idle') {
            return DealInListWhere([...this.IdleIDs]);
        }
        const tables = this.inspectTables(key === 'won' || key === 'closed');
        if (!tables) {
            // Without the type tables a won or closed list cannot be expressed; the open ones fall back
            // to the roster's IDs, which the filter bar has already narrowed.
            return key === 'won' || key === 'closed' ? '1 = 0' : DealInListWhere(this.InspectRows.map((d) => d.ID));
        }
        return InspectCriteriaWhere(key, tables, BusinessToday(), { Window: this.Window, Filters: this.Filters, Arg: this.InspectArg });
    }

    /**
     * The tables the criteria read, or null when one it needs is missing from metadata. `closedOnly`:
     * the Won and closed lists read only the status flags, so they need only the status table — the
     * Won list must not fall back to matching nothing because an unrelated table is missing.
     */
    private inspectTables(closedOnly: boolean): InspectTables | null {
        const status = tableOf(E_DEAL_STATUS_TYPE);
        const pipeline = closedOnly ? status : tableOf(E_PIPELINE);
        const forecast = closedOnly ? status : tableOf(E_FORECAST_CATEGORY_TYPE);
        return status && pipeline && forecast ? { Status: status, Pipeline: pipeline, Forecast: forecast, OrderLine: tableOf(E_ORDER_LINE) } : null;
    }

    /**
     * All deals takes the saved view's sort: open deals first (no ClosedAt), then soonest expected close
     * (bizapps-sales#371).
     */
    private async refreshAllDealsView(): Promise<void> {
        try {
            this.AllDealsView = this.pipelineView ? await DealPipelineViewWith(this.pipelineView) : null;
        } catch (e) {
            this.ViewError = reasonOf(e);
        }
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
     * The forecast: Won in the period, then the open pipeline deals expected to close in it, each in its
     * highest category. Every segment is a column of `Sales: Dashboard Summary`, so the Commit segment
     * is the Commit tile's figure. While the summary is unavailable, every segment is 0.
     */
    public get Stack(): { Closed: number; Commit: number; BestOnly: number; PipeOnly: number; Total: number } {
        const s = this.summary;
        const Closed = s?.WonAmount ?? 0;
        const Commit = s?.CommitAmount ?? 0;
        const BestOnly = s?.BestCaseOnlyAmount ?? 0;
        const PipeOnly = s?.PipelineOnlyAmount ?? 0;
        return { Closed, Commit, BestOnly, PipeOnly, Total: Closed + Commit + BestOnly + PipeOnly };
    }

    /** "Deals expected to close this quarter, by forecast category". */
    public get StackNote(): string {
        return this.Period === 'alltime'
            ? 'Every deal, by forecast category'
            : `Deals expected to close ${this.Period === 'custom' ? this.WindowLabel : this.PeriodPhrase}, by forecast category`;
    }

    /** Open deals with no expected close date: outside every bounded period, so counted here. */
    public get NoCloseDateCount(): number {
        return this.summary?.NoCloseDateCount ?? 0;
    }

    public StackPct(part: number): string {
        const t = this.Stack.Total;
        if (t <= 0 || part <= 0) return '0%';
        return `${Math.max(2, Math.round((part / t) * 100))}%`;
    }

    /**
     * The pipeline Open deals by stage shows. Null until a reader picks one, which means the first of
     * {@link FunnelPipelineOptions}.
     */
    public FunnelPipelineID: string | null = null;

    /**
     * The pipelines the stage card can show. One selected in the filter bar: that one, with no tabs.
     * Several: those. None: every pipeline with open deals.
     */
    public get FunnelPipelineOptions(): FunnelPipeline[] {
        const withDeals = FunnelPipelines(this.dashboardDeals, this.Pipelines);
        const selected = this.Filters.PipelineIDs;
        if (!selected.length) {
            return withDeals;
        }
        return selected.map((id) => withDeals.find((p) => HasID([p.ID], id))
            ?? { ID: id, Name: this.Pipelines.find((p) => HasID([p.ID], id))?.Name ?? 'Pipeline' });
    }

    /** The picked pipeline while it is offered, otherwise the first one that is. */
    public get ActiveFunnelPipelineID(): string | null {
        const options = this.FunnelPipelineOptions;
        const picked = options.find((p) => HasID([p.ID], this.FunnelPipelineID));
        return (picked ?? options[0])?.ID ?? null;
    }

    public SelectFunnelPipeline(id: string): void {
        this.FunnelPipelineID = id;
        this.cdr.detectChanges();
    }

    public get Funnel(): FunnelStage[] {
        const pipelineID = this.ActiveFunnelPipelineID;
        return pipelineID ? StageFunnel(this.dashboardDeals, pipelineID, this.Window) : [];
    }

    /** A stage column's deal list argument. "No stage" carries its pipeline, since it has no stage ID. */
    public StageArg(col: FunnelStage): string {
        return col.Key === 'unstaged' ? `unstaged:${this.ActiveFunnelPipelineID ?? ''}` : col.Key;
    }

    public FunnelHeight(count: number): string {
        const max = Math.max(1, ...this.Funnel.map((s) => s.Count));
        return `${Math.max(8, Math.round((count / max) * 100))}%`;
    }

    /** Expected to close: the dated buckets follow the period; No date lists every undated open deal. */
    public get Buckets(): CloseBucket[] {
        return CloseBuckets(this.dashboardDeals, BusinessToday(), this.Window);
    }

    /** Commit by deal owner, for the period. */
    public get Owners(): OwnerBar[] {
        return OwnerCoverage(this.dashboardDeals, this.Window);
    }

    public OwnerPct(amount: number): string {
        const max = Math.max(1, ...this.Owners.map((o) => o.Amount));
        return `${Math.round((amount / max) * 100)}%`; // money-grep-allow: ratio of two stored amounts rendered as a bar width percentage — the result is a CSS length, not a money figure
    }

    /**
     * Open deals that have sat in their stage longer than the stage's limit (bizapps-sales#450), from
     * the stage history the Board reads. Lower-cased IDs.
     */
    public get IdleIDs(): ReadonlySet<string> {
        const today = BusinessToday();
        const limits = new Map(this.Stages.map((s) => [s.ID.toLowerCase(), s.RottingDays]));
        const ids = new Set<string>();
        for (const d of this.dashboardDeals) {
            const id = d.ID.toLowerCase();
            if (StageIdleFor(d, limits.get(String(d.PipelineStageID ?? '').toLowerCase()), this.StageEnteredOn.get(id), today)) {
                ids.add(id);
            }
        }
        return ids;
    }

    /**
     * Needs attention: open deals that need a person, today. The filter bar narrows them; the period
     * does not, because a slipped or ownerless deal needs attention whatever period is being read.
     */
    public get Attention(): AttentionRow[] {
        const s = this.summary;
        return [
            { Key: 'slipped', Icon: 'fa-calendar-xmark', Label: 'Past close date', Note: 'Open deals past their expected close date', Tooltip: 'Open deals whose expected close date is before today', Count: s?.PastExpectedCloseCount ?? null },
            { Key: 'noowner', Icon: 'fa-user-slash', Label: 'No owner', Note: 'Open deals with no employee in the owner role', Tooltip: 'Open deals where no employee on the deal team holds the owner role. A person who is not an employee in that role does not count as the owner', Count: s?.NoOwnerCount ?? null },
            { Key: 'nodate', Icon: 'fa-calendar', Label: 'No close date', Note: 'Open deals with no expected close date', Tooltip: 'Open deals that cannot be placed in any period until someone sets an expected close date', Count: s?.NoCloseDateCount ?? null },
            { Key: 'idle', Icon: 'fa-hourglass-half', Label: 'Idle past stage limit', Note: 'Open deals in their stage longer than it allows', Tooltip: 'Open deals that have sat in their current stage longer than the stage\'s day limit', Count: this.DetailLoading ? null : this.IdleIDs.size },
        ];
    }

    /** Null means the query did not run: every figure is cleared and the tile says so. */
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
     * A whole-currency figure. Formatting only — it neither derives nor rounds a stored value.
     *
     * COERCE BEFORE FORMATTING, because `toLocaleString` fails SILENTLY on a string: a value arriving as
     * "27480.0000" would render as `27480.0000` with no symbol and no error.
     */
    private money(value: number | string | null | undefined): string {
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
 * The five tiles' fixed parts: label, what they count, and the figure they list. Every tile is bounded
 * by the period (bc-aidp-next-golive#350).
 */
const KPI_SHELLS: readonly Omit<SalesKpi, 'Value' | 'Footnote'>[] = [
    { Label: 'Won', Tooltip: 'Deals won in the period, by the day they closed.', Filter: 'won' },
    { Label: 'Commit', Tooltip: 'Open deals in a Commit forecast category, expected to close in the period.', Filter: 'commit' },
    { Label: 'Open pipeline', Tooltip: 'Open deals expected to close in the period, not counting deals left out of the forecast.', Filter: 'pipe' },
    { Label: 'Weighted pipeline', Tooltip: 'The open pipeline with each deal counted at its probability of closing.', Filter: 'weighted' },
    { Label: 'Win rate', Tooltip: 'Share of closed deal value that was won, over deals closed in the period.', Filter: 'closed' },
];

/** A read that settled: its value, or why it failed. */
interface Settled<T> {
    Value: T | null;
    Error: string | null;
}

/** Resolves to the value or the reason; never rejects. */
function settle<T>(read: Promise<T>): Promise<Settled<T>> {
    return read.then(
        (Value) => ({ Value, Error: null }),
        (e: unknown) => ({ Value: null, Error: reasonOf(e) }),
    );
}

/** The reads `load()` starts for the board, the win rate and the grids. */
interface DetailReads {
    Lookups: Promise<Settled<DealWorkspaceLookups>>;
    WinRate: Promise<Settled<Record<string, unknown>[] | null>>;
    View: Promise<Settled<MJUserViewEntityExtended | null>>;
    StageEntries: Promise<Settled<Map<string, string>>>;
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
    template: `<mjs-sales-section Section="deals" [UrlState]="UrlState" (UrlStateChange)="OnUrlStateChange($event)"></mjs-sales-section>`,
})
export class SalesDealsSectionResource extends BaseResourceComponent implements OnInit {
    /**
     * The tab's query params as section state (bizapps-sales#371): read on mount, replaced on
     * back/forward or a link opened into this tab, and written when the section changes.
     */
    public UrlState: SalesUrlState | null = null;

    public ngOnInit(): void {
        // Before the base class subscribes: its first delivery may arrive synchronously, and the
        // section reads this on its own init.
        this.UrlState = this.parseUrl(this.GetQueryParams());
        super.ngOnInit();
        // Required of every BaseResourceComponent: Explorer waits on this before it stops showing a
        // loading state, so omitting it leaves the tab spinning forever. The section loads its own data
        // asynchronously underneath — this reports that the RESOURCE mounted, not that data arrived.
        this.NotifyLoadComplete();
    }

    /** Back/forward, or a deep link into a mounted tab. The section applies only what differs. */
    protected override OnQueryParamsChanged(params: Record<string, string>, _source: 'popstate' | 'deeplink'): void {
        this.UrlState = this.parseUrl(params);
        this.RefreshView();
    }

    /** The section moved; record it in the URL so a reload or a shared link comes back to it. */
    public OnUrlStateChange(state: SalesUrlState): void {
        this.UpdateQueryParams(SalesUrlParams(state));
    }

    private parseUrl(params: Record<string, string>): SalesUrlState {
        return ParseSalesUrlState(params, SubPagesFor('deals').map((p) => p.Id));
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
