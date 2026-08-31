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
import { CompositeKey, Metadata, type EntityInfo } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent, NavigationService } from '@memberjunction/ng-shared';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { EntityViewerModule, type RecordOpenedEvent } from '@memberjunction/ng-entity-viewer';
import type { MJUserViewEntityExtended } from '@memberjunction/core-entities';
import { LoadDealPipelineView, DealInListWhere } from '../pages/deal-views';
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
import { DealBoardComponent, DEFAULT_DISPLAY_CURRENCY } from '../board/deal-board.component';
import {
    DealWorkspaceService,
    type DealDashboardSummary,
    type DealRosterRow,
} from '../workspace/deal-workspace.service';
import type { DealStatusLookup, PipelineLookup, StageLookup } from '../workspace/deal-workspace.types';
import {
    CloseBuckets,
    ClosingSoon,
    FilterInspect,
    ForecastSlices,
    OwnerCoverage,
    StageFunnel,
    TodayUtc,
    WeightedOpen,
    type CloseBucket,
    type FunnelStage,
    type InspectKey,
    type OwnerBar,
} from '../pages/dashboard-inspect';

/**
 * The account entity, for opening a customer as its own Explorer tab.
 *
 * `Sales Accounts` rather than common's `Organizations`: the deal's `AccountID` points at the IsA CHILD,
 * and that is the record a rep expects to land on — the sales-specific columns are the reason the child
 * exists. Explorer resolves the parent chain from there.
 */
const E_ACCOUNT = 'MJ_BizApps_Sales: Sales Accounts';
const E_DEAL = 'MJ_BizApps_Sales: Deals';

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
    public Loading = true;
    public Deals: DealRosterRow[] = [];
    /** Set when the roster could not be read, or a row could not be opened. Shown verbatim. */
    public Message = '';
    /** Which slice the inspect grid is showing. Default is closing-soonest (the DB-oracle spec). */
    public InspectFilter: InspectKey = 'closing';
    public WinRateByCount: number | null = null;
    public WinRateByValue: number | null = null;
    public WinClosedCount = 0;
    public WinWonCount = 0;
    public DealEntityInfo: EntityInfo | null = null;
    public InspectView: MJUserViewEntityExtended | null = null;
    public AllDealsView: MJUserViewEntityExtended | null = null;


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

    public async Refresh(): Promise<void> {
        this.Loading = true;
        this.cdr.detectChanges();

        const [roster, lookups, summary, winRate] = await Promise.all([
            this.service.LoadRoster(),
            // Still needed: the BOARD renders from these, and StatusTone reads them for the roster
            // pill. The KPI tiles no longer do -- their flags are applied server-side by the query.
            this.service.LoadLookups(),
            // The four headline figures, reduced in SQL. See LoadDashboardSummary for why.
            this.service.LoadDashboardSummary(),
            this.service.RunNamedQuery('Sales: Win Rate by Count and Value'),
        ]);
        this.Deals = roster;
        this.summary = summary;
        this.Pipelines = lookups.Pipelines;
        this.Stages = lookups.Stages;
        this.DealStatusTypes = lookups.DealStatusTypes;
        this.applyWinRate(winRate);
        this.DealEntityInfo = new Metadata().Entities.find((e) => e.Name === E_DEAL) ?? null;
        await this.refreshInspectView();
        await this.refreshAllDealsView();
        this.Loading = false;
        if (!roster.length) {
            // Not an error — a first-run database has no deals. The template distinguishes the two.
            this.Message = '';
        }
        this.cdr.detectChanges();
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
                Footnote: `of ${s.TotalCount} total`,
                Filter: 'pipe',
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
                Value: String(s.WonCount),
                Footnote: 'closed won to date',
                Filter: 'won',
            },
        ];
    }

    /**
     * Open deals whose expected close date has already passed.
     *
     * READS THE FLAG THE ROSTER QUERY ALREADY APPLIED. `Sales: Deal Roster` computes
     * `IsPastExpectedClose` against `CAST(SYSUTCDATETIME() AS DATE)`, so the comparison happens on the
     * server against the server's clock.
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
        return this.Deals.filter((d) => d.IsPastExpectedClose === true);
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
        return ClosingSoon(this.Deals, 8);
    }

    public get InspectRows(): DealRosterRow[] {
        return FilterInspect(this.Deals, this.InspectFilter, TodayUtc());
    }

    public get InspectLabel(): string {
        switch (this.InspectFilter) {
            case 'closing':
                return 'Closing soonest · click a deal → Explorer tab';
            case 'commit':
                return 'IncludeInCommit, still open';
            case 'best':
                return 'IncludeInBestCase (includes Commit)';
            case 'pipe':
                return 'Open pipeline';
            case 'slipped':
                return 'ExpectedCloseDate already past, still open';
            case 'noowner':
                return 'Open, no owner';
            case 'won':
                return 'IsWon';
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
        if (!this.DealEntityInfo) {
            this.InspectView = null;
            return;
        }
        const where = DealInListWhere(this.InspectRows.map((d) => d.ID));
        this.InspectView = await LoadDealPipelineView(this.DealEntityInfo, where);
    }

    private async refreshAllDealsView(): Promise<void> {
        if (!this.DealEntityInfo) {
            this.AllDealsView = null;
            return;
        }
        this.AllDealsView = await LoadDealPipelineView(this.DealEntityInfo);
    }

    public OnAllDealsOpened(event: RecordOpenedEvent): void {
        this.OnInspectOpened(event);
    }

    public get Stack(): { Closed: number; Commit: number; BestOnly: number; PipeOnly: number; Total: number } {
        const s = ForecastSlices(this.Deals);
        const Total = s.Closed + s.Commit + s.BestOnly + s.PipeOnly;
        return { ...s, Total };
    }

    public StackPct(part: number): string {
        const t = this.Stack.Total;
        if (t <= 0 || part <= 0) return '0%';
        return `${Math.max(2, Math.round((part / t) * 100))}%`;
    }

    public get Funnel(): FunnelStage[] {
        return StageFunnel(this.Deals);
    }

    public FunnelHeight(count: number): string {
        const max = Math.max(1, ...this.Funnel.map((s) => s.Count));
        return `${Math.max(8, Math.round((count / max) * 100))}%`;
    }

    public get Buckets(): CloseBucket[] {
        return CloseBuckets(this.Deals, TodayUtc());
    }

    public get Owners(): OwnerBar[] {
        return OwnerCoverage(this.Deals);
    }

    public OwnerPct(amount: number): string {
        const max = Math.max(1, ...this.Owners.map((o) => o.Amount));
        return `${Math.round((amount / max) * 100)}%`;
    }

    public get Weighted(): number {
        return WeightedOpen(this.Deals);
    }

    public get SilentCount(): number {
        // Last-activity from Common is not on the roster yet. Unowned + slipped + stuck-less
        // "needs a person" queues that we CAN answer without inventing a second activity query.
        return this.Deals.filter((d) => d.IsOpen && !d.OwnerEmployee).length;
    }

    public get CommitCount(): number {
        return this.Deals.filter((d) => d.IsOpen && d.IncludeInCommit).length;
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

    private applyWinRate(rows: Record<string, unknown>[]): void {
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

    /** True when this deal's expected close has passed and it is still open. */
    public IsSlipped(row: DealRosterRow): boolean {
        return this.SlippedDeals.some((d) => d.ID === row.ID);
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
