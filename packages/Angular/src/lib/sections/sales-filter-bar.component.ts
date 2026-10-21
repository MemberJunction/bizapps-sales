/**
 * @fileoverview The Sales section's filter bar: period, selling company, product company, pipeline and
 * deal owner (bc-aidp-next-golive#350, #351).
 *
 * ONE COMPONENT FOR EVERY PAGE THAT FILTERS. The Dashboard and the Board both render this, so the
 * controls' labels, order and defaults cannot drift between them. It holds no state: the section owns
 * the period and the four lists, keeps them in the URL, and passes them in as `State`. A choice made
 * here goes back out as an event, the section applies it, and every page reads the same selection, so
 * switching pages never resets a filter.
 *
 * What each page does with the selection is the page's business: the Dashboard bounds its figures by
 * the period, the Board bounds its closed columns by it. See `MJSSalesSectionComponent`.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MJFilterPopoverComponent } from '@memberjunction/ng-ui-components';

import { HasID, SelectionLabel, type DashboardFilters, type FilterOption } from '../pages/dashboard-filters';
import { PERIOD_OPTIONS, type PeriodKey } from '../pages/dashboard-period';

/** Which filter list a control edits. */
export type FilterKind = keyof DashboardFilters;

/** What the bar shows. Built by the section from its own state. */
export interface SalesFilterBarState {
    Period: PeriodKey;
    /** The custom range's two days, `YYYY-MM-DD`, read only while `Period` is `custom`. */
    CustomStart: string | null;
    CustomEnd: string | null;
    /** "Jul 1, 2026 – Sep 30, 2026": the period's bounds spelled out. */
    WindowLabel: string;
    /** How the fiscal year start was arrived at, on the Period dropdown. */
    PeriodTooltip: string;
    Filters: DashboardFilters;
    /** The choices each list offers. */
    Options: Record<FilterKind, FilterOption[]>;
    /** The signed-in user's employee record; "My deals" is hidden without one. */
    MyEmployeeID: string | null;
    /** Deals a Product company filter leaves out because they have no lines yet; 0 hides the chip. */
    NoLinesLeftOut: number;
}

/** A custom range's two days as picked; empty is no bound on that side. */
export interface CustomRange {
    Start: string;
    End: string;
}

/** One list on the bar, in the order the bar shows them. */
interface FilterList {
    Kind: FilterKind;
    Label: string;
    TestID: string;
}

const FILTER_LISTS: readonly FilterList[] = [
    { Kind: 'CompanyIDs', Label: 'Selling company', TestID: 'sales-filter-company' },
    { Kind: 'ProductCompanyIDs', Label: 'Product company', TestID: 'sales-filter-product-company' },
    { Kind: 'PipelineIDs', Label: 'Pipeline', TestID: 'sales-filter-pipeline' },
    { Kind: 'OwnerEmployeeIDs', Label: 'Deal owner', TestID: 'sales-filter-owner' },
];

@Component({
    selector: 'mjs-sales-filter-bar',
    standalone: true,
    imports: [CommonModule, MJFilterPopoverComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './sales-filter-bar.component.html',
    styleUrls: ['./sales-filter-bar.component.css'],
})
export class MJSSalesFilterBarComponent {
    @Input({ required: true }) public State!: SalesFilterBarState;

    /** The Period dropdown's new key. */
    @Output() public readonly PeriodChange = new EventEmitter<string>();
    /** A custom range's date picker changed. */
    @Output() public readonly CustomRangeChange = new EventEmitter<CustomRange>();
    /** A checkbox in a list changed. */
    @Output() public readonly FilterToggled = new EventEmitter<{ Kind: FilterKind; ID: string }>();
    /** A list's Clear. */
    @Output() public readonly FilterCleared = new EventEmitter<FilterKind>();
    /** "My deals" was pressed. */
    @Output() public readonly MyDealsToggled = new EventEmitter<void>();

    public readonly PeriodOptions = PERIOD_OPTIONS;
    public readonly Lists = FILTER_LISTS;

    /** True when "My deals" is exactly the owner filter. */
    public get MyDealsOn(): boolean {
        const me = this.State.MyEmployeeID;
        const owners = this.State.Filters.OwnerEmployeeIDs;
        return !!me && owners.length === 1 && HasID(owners, me);
    }

    /** How many choices a list has picked; 0 is "All". */
    public Count(kind: FilterKind): number {
        return this.State.Filters[kind].length;
    }

    public IsPicked(kind: FilterKind, id: string): boolean {
        return HasID(this.State.Filters[kind], id);
    }

    /** "Selling company: Acme +2": the list's button. */
    public ButtonLabel(list: FilterList): string {
        return `${list.Label}: ${SelectionLabel(this.State.Filters[list.Kind], this.State.Options[list.Kind])}`;
    }
}
