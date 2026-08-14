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
 * ── WHY THE WORKSPACE IS HIDDEN, NOT `@if`-ed ───────────────────────────────────────────────────
 *
 * The open-documents strip lives INSIDE `mjs-deal-workspace` (a deliberate divergence from contracts,
 * which hoists the card to its section). That makes the workspace self-contained — but it also means
 * destroying the component destroys every open deal. So the workspace is mounted once and hidden with
 * `[hidden]` when another page is showing: switching to the list and back keeps your drafts, which is
 * the whole point of an open-documents strip. Contracts gets the same outcome by holding drafts in the
 * section instead; both are valid, and this is the one that does not re-plumb a verified component.
 *
 * ── WHAT IS MJ'S AND WHAT IS OURS ───────────────────────────────────────────────────────────────
 *
 * Chrome is MJ page primitives; buttons are `mjButton`; loading is `mj-loading`. Hand-built is only the
 * KPI strip and the roster table — the roster is a table rather than `mj-explorer-entity-data-grid`
 * because a row here must open the DEAL WORKSPACE, and the grid's row activation opens an Explorer
 * record tab. Colour, spacing and radius come from `--mj-*` tokens throughout, so this tracks the host
 * theme and is correct in dark mode without a second stylesheet.
 *
 * THIS FILE COMPUTES NO PRICING. The dashboard sums `Deal.Amount` across deals, which is a reporting
 * rollup of figures that are already answers (master plan §9 defines the forecast measures the same
 * way). It never sums LINES into a deal total, never applies a discount, and never sums across
 * `DealTeamMember` — that last one triple-counts any deal with an AE, an SE and an SDR.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
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
import { DealWorkspaceComponent } from '../workspace/deal-workspace.component';
import { DealWorkspaceService, type DealRosterRow } from '../workspace/deal-workspace.service';
import type { DealStatusLookup } from '../workspace/deal-workspace.types';

/** One KPI tile. `Tone` drives colour only — no behaviour hangs off it. */
interface SalesKpi {
    Label: string;
    Value: string;
    Footnote: string;
    Tone?: 'warn' | 'err';
}

/**
 * The UTC date part of a value that may be an ISO string OR a `Date`.
 *
 * MJ v6 CHANGED THIS UNDER US. On v5 a `RunView` with `ResultType: 'simple'` handed back the raw
 * database shape, so a DATE column arrived as an ISO string and `.slice(0, 10)` was safe. On v6 the
 * same read can hand back a real `Date`, and the old code died with
 * `TypeError: d.ExpectedCloseDate.slice is not a function` — which took the whole Sales dashboard down
 * with it, because the getter runs during render.
 *
 * Accepting BOTH is deliberate rather than picking one: the value's type now depends on how the row was
 * fetched, and a KPI getter is the wrong place to care. Compared as a UTC date-only string because
 * everything stored is UTC — local-time getters would move the boundary by a day west of Greenwich.
 *
 * See bizapps-accounting docs/ui-architecture.md on `ResultType: 'entity_object'` vs `'simple'`; this is
 * the same hazard, and orders shipped it wrong for months.
 */
function UtcDatePart(value: string | Date): string {
    if (value instanceof Date) {
        return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
    }
    return String(value).slice(0, 10);
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
        DealWorkspaceComponent,
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

    /** The workspace is mounted once and hidden — see the file header. */
    @ViewChild(DealWorkspaceComponent) private workspace?: DealWorkspaceComponent;

    public Page = '';
    public Loading = true;
    public Deals: DealRosterRow[] = [];
    /** Set when the roster could not be read, or a row could not be opened. Shown verbatim. */
    public Message = '';

    /** Status flags, so nothing here has to compare a status NAME. */
    private statuses: DealStatusLookup[] = [];

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

    /** The header's primary verb. Every page's primary is "New deal", so it always lands here. */
    public StartPrimary(): void {
        this.Page = 'workspace';
        this.cdr.detectChanges();
        this.workspace?.NewDeal();
        this.cdr.detectChanges();
    }

    // ── Data ───────────────────────────────────────────────────────────────────

    public async Refresh(): Promise<void> {
        this.Loading = true;
        this.cdr.detectChanges();

        const [roster, lookups] = await Promise.all([
            this.service.LoadRoster(),
            // Only needed for the status FLAGS the KPIs branch on. The workspace loads its own copy;
            // one extra read on section mount is cheaper than threading state between the two.
            this.service.LoadLookups(),
        ]);
        this.Deals = roster;
        this.statuses = lookups.DealStatusTypes;
        this.Loading = false;
        if (!roster.length) {
            // Not an error — a first-run database has no deals. The template distinguishes the two.
            this.Message = '';
        }
        this.cdr.detectChanges();
    }

    // ── Rows → the workspace ───────────────────────────────────────────────────

    /**
     * Opens a deal in the workspace, switching to that page first.
     *
     * The order matters: the page has to be showing before `OpenDeal` runs, or the workspace's own
     * loading state is invisible and a slow read looks like a dead click.
     *
     * A failure SAYS SO and re-reads the roster. Contracts records that this was once a bare `return`,
     * which was indistinguishable from a broken control — and the likeliest cause is the least obvious
     * one: the deal was deleted by someone else since this list loaded.
     */
    public async OpenDeal(row: DealRosterRow): Promise<void> {
        this.Page = 'workspace';
        this.Message = '';
        this.cdr.detectChanges();

        if (!this.workspace) {
            this.Message = 'The workspace is not available on this screen.';
            this.cdr.detectChanges();
            return;
        }

        const opened = await this.workspace.OpenDeal(row.ID);
        if (!opened) {
            this.Message =
                `${row.DealNumber ?? row.Name} could not be opened. It may have been deleted since this ` +
                `page loaded — the list has been refreshed.`;
            await this.Refresh();
            return;
        }
        this.cdr.detectChanges();
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
        const open = this.Deals.filter((d) => this.hasFlag(d, 'IsOpen'));
        const won = this.Deals.filter((d) => this.hasFlag(d, 'IsWon'));
        const slipped = this.SlippedDeals;

        // A rollup of figures that are already answers — NOT pricing arithmetic. See the file header.
        const openValue = open.reduce((sum, d) => sum + (d.Amount ?? 0), 0);

        return [
            {
                Label: 'Open pipeline',
                Value: this.money(openValue),
                Footnote: `across ${open.length} open ${open.length === 1 ? 'deal' : 'deals'}`,
            },
            {
                Label: 'Open deals',
                Value: String(open.length),
                Footnote: `of ${this.Deals.length} total`,
            },
            {
                Label: 'Past expected close',
                Value: String(slipped.length),
                Footnote: 'still open, close date gone',
                Tone: slipped.length ? 'warn' : undefined,
            },
            {
                Label: 'Won',
                Value: String(won.length),
                Footnote: 'closed won to date',
            },
        ];
    }

    /**
     * Open deals whose expected close date has already passed.
     *
     * Compared in UTC against a date-only string, because `ExpectedCloseDate` is a DATE and everything
     * stored is UTC — using local-time getters here would move the boundary by a day for anyone west of
     * Greenwich.
     */
    public get SlippedDeals(): DealRosterRow[] {
        const today = new Date();
        const todayUtc = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
        return this.Deals.filter(
            (d) => this.hasFlag(d, 'IsOpen') && !!d.ExpectedCloseDate && UtcDatePart(d.ExpectedCloseDate) < todayUtc,
        );
    }

    public get Badges(): SalesNavBadges {
        return { Slipped: this.SlippedDeals.length };
    }

    /** The handful of deals worth showing on a dashboard — soonest expected close first. */
    public get ClosingSoon(): DealRosterRow[] {
        return this.Deals.filter((d) => this.hasFlag(d, 'IsOpen') && !!d.ExpectedCloseDate).slice(0, 8);
    }

    // ── Display helpers ────────────────────────────────────────────────────────

    /** True when a deal's status carries the given behaviour flag. */
    private hasFlag(row: DealRosterRow, flag: 'IsOpen' | 'IsWon' | 'IsLost' | 'IsClosed'): boolean {
        if (!row.DealStatusTypeID) {
            return false;
        }
        const status = this.statuses.find((s) => s.ID === row.DealStatusTypeID);
        return status ? status[flag] === true : false;
    }

    /**
     * A whole-currency figure. Formatting only — it neither derives nor rounds a stored value; the
     * number displayed is whatever came back, shown without decimals.
     */
    private money(value: number): string {
        return value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    }

    public Money(value: number | null): string {
        return value === null || value === undefined ? '—' : this.money(value);
    }

    /**
     * Tone for a status pill, derived from the FLAGS rather than the name — same rule as the counts.
     * Returns a class name; the CSS decides what it looks like.
     */
    public StatusTone(row: DealRosterRow): string {
        if (this.hasFlag(row, 'IsWon')) {
            return 'ok';
        }
        if (this.hasFlag(row, 'IsLost')) {
            return 'err';
        }
        if (this.hasFlag(row, 'IsOpen')) {
            return 'open';
        }
        return 'muted';
    }

    /** True when this deal's expected close has passed and it is still open. */
    public IsSlipped(row: DealRosterRow): boolean {
        return this.SlippedDeals.some((d) => d.ID === row.ID);
    }

    /** Whether the workspace should be visible. Mounted either way — see the file header. */
    public get ShowWorkspace(): boolean {
        return this.Page === 'workspace';
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
