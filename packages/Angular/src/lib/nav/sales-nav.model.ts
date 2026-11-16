/**
 * @fileoverview The information architecture, as data.
 *
 * SHAPED AFTER bizapps-contracts' `contracts-nav.model.ts`, deliberately: the three revenue-stack apps
 * should feel like one suite, and the cheapest way to guarantee that is to describe the nav the same way
 * rather than to style it the same way afterwards.
 *
 * MJ'S RULE: **top nav crosses SECTIONS, the left rail moves within one.** Top nav is the Application's
 * `DefaultNavItems`, each pointing at a registered resource class — it is not something a component
 * draws. Contracts records a version that rendered a section switcher with `mj-tab-nav` inside its page
 * header: it looked like a top nav bar and was not one. So the rail below is *within* Deals, and adding
 * a second section later means adding an Application nav item plus a resource, not a widget here.
 *
 * ONE SECTION TODAY. Contracts has three (Contracts / Billing / Setup) because it has three distinct
 * jobs. Sales has one job worth its own section so far — working deals. Accounts and Contacts are rail
 * pages here (the entity grids) until they have work of their own; forecasting is a section later, and
 * absent rather than stubbed because **a nav item pointing at an unregistered component mounts a blank
 * tab with no error anywhere**.
 *
 * The pipeline BOARD is a rail page here rather than a section of its own, and that is a claim about what
 * it is: another way to look at the same deals, alongside the dashboard and the roster — not a different
 * job. It sits between them because that is the order of narrowing: what is happening, where things
 * stand, then this specific deal.
 *
 * DECLARING THE RAIL HERE rather than inside the component keeps the whole IA readable in one file,
 * gives badge counts a single injection point, and makes the nav testable without instantiating Angular.
 *
 * @module @mj-biz-apps/sales-ng
 */

import type { MJLeftNavSection } from '@memberjunction/ng-ui-components';

/** A top-level section. `Id` is what the shell stores and what each resource passes in. */
export interface SalesSection {
    Id: string;
    Label: string;
    Icon: string;
}

/** A page within a section. `Id` doubles as the shell's page-state key. */
export interface SalesSubPage {
    /** Stable key. Renaming one would reset anyone's place if this were ever persisted. */
    Id: string;
    Label: string;
    /** Font Awesome class. */
    Icon: string;
    /** Optional muted second line in the rail. */
    Description?: string;
    /** Rail group header. Items sharing a group render under one heading. */
    Group?: string;
}

/**
 * Live counts the rail surfaces as badges, supplied by the shell from real data.
 *
 * Deliberately counts, never amounts: a badge is "there is something here for you", and a currency
 * figure in a 20-pixel pill is unreadable and invites being treated as authoritative.
 */
export interface SalesNavBadges {
    /** Open deals whose expected close date has already passed — someone has to re-date or lose them. */
    Slipped?: number;
}

export const SALES_SECTIONS: SalesSection[] = [
    { Id: 'deals', Label: 'Deals', Icon: 'fa-solid fa-handshake' },
];

/**
 * Deals — find one, open one, write one.
 *
 * Records are Explorer tabs (`OpenEntityRecord` / `OpenNewEntityRecord`), not a rail page. New deal
 * is the header primary. There is no Workspace rail — that nested document strip was the antipattern
 * orders already left.
 */
export const DEALS_SUB_PAGES: SalesSubPage[] = [
    { Id: 'dashboard', Label: 'Dashboard', Icon: 'fa-solid fa-gauge-high', Description: 'What is moving, what has stalled' },
    { Id: 'list', Label: 'All deals', Icon: 'fa-solid fa-table-list' },
    { Id: 'board', Label: 'Board', Icon: 'fa-solid fa-diagram-project', Description: 'Move deals through the pipeline' },
    // The accounts and people deals are sold to. Each is the entity's own grid, opening records as
    // Explorer tabs, so the app can find and create them without the generated entity browser.
    { Id: 'accounts', Label: 'Accounts', Icon: 'fa-solid fa-building', Group: 'Customers' },
    { Id: 'contacts', Label: 'Contacts', Icon: 'fa-solid fa-address-book', Group: 'Customers' },
];

/**
 * Settings for the whole instance, such as hiding pipelines. Shown only to users who may change the
 * Sales application settings; see `SalesSettings.CanChange`.
 */
export const SETTINGS_SUB_PAGE: SalesSubPage = {
    Id: 'settings',
    Label: 'Settings',
    Icon: 'fa-solid fa-sliders',
    Description: 'How Sales works for everyone',
    Group: 'Admin',
};

/** Who is looking at the rail. */
export interface SalesNavAudience {
    /** The user may change the Sales settings, so the Settings page is listed. */
    CanChangeSettings?: boolean;
}

/** The rail for a section id. An unknown id gives an empty rail rather than throwing. */
export function SubPagesFor(sectionId: string, audience: SalesNavAudience = {}): SalesSubPage[] {
    switch (sectionId) {
        case 'deals':
            return audience.CanChangeSettings ? [...DEALS_SUB_PAGES, SETTINGS_SUB_PAGE] : DEALS_SUB_PAGES;
        default:
            return [];
    }
}

/** The page a section opens on. */
export function DefaultPageFor(sectionId: string): string {
    return SubPagesFor(sectionId)[0]?.Id ?? '';
}

/** Which badge, if any, belongs on a page. */
function badgeFor(pageId: string, badges: SalesNavBadges): number | undefined {
    switch (pageId) {
        case 'dashboard':
            // Slipped deals, not the total count. A deal count is the pipeline existing; a slipped one
            // is a person's problem, and a badge should mean the second thing. On Dashboard because
            // its "Past expected close" tile and "Close date slipped" queue show the same count; All
            // deals lists every deal with no marker, so a badge there matched nothing on the page.
            return badges.Slipped;
        default:
            return undefined;
    }
}

/**
 * Turn a page list into the `MJLeftNavSection[]` `<mj-left-nav>` consumes, grouping by each page's
 * `Group` and dropping zero badges.
 *
 * A zero badge is omitted rather than rendered as "0": a badge means "there is something here", and a
 * grey zero is noise that trains people to ignore the badge that matters. Lifted from contracts, and
 * worth keeping identical so the two apps behave the same way at the same moment.
 */
export function BuildLeftNavSections(pages: SalesSubPage[], badges: SalesNavBadges = {}): MJLeftNavSection[] {
    const sections: MJLeftNavSection[] = [];
    // Insertion order matters: ungrouped items lead, then each group in the order it first appears,
    // which is the order the author wrote them in.
    const byGroup = new Map<string, SalesSubPage[]>();
    for (const page of pages) {
        const key = page.Group ?? '';
        const list = byGroup.get(key);
        if (list) {
            list.push(page);
        } else {
            byGroup.set(key, [page]);
        }
    }

    for (const [group, groupPages] of byGroup) {
        sections.push({
            label: group || undefined,
            items: groupPages.map((page) => {
                const badge = badgeFor(page.Id, badges);
                return {
                    id: page.Id,
                    label: page.Label,
                    icon: page.Icon,
                    description: page.Description,
                    ...(badge ? { badge } : {}),
                };
            }),
        });
    }
    return sections;
}

/** The primary action for a page — the one button whose label changes with what you are looking at. */
export interface SalesPrimaryAction {
    Label: string;
    Icon: string;
    /**
     * What the button does. The three `*` kinds CREATE a record; the two `promote-*` kinds open the
     * promote dialog instead, because the record already exists and only its sales half is missing.
     */
    Creates: 'deal' | 'account' | 'contact' | 'promote-account' | 'promote-contact';
}

/**
 * Contracts varies its primary action per page rather than per section, because "New contract" on a
 * commitments page answers a question nobody asked. Same reasoning here.
 *
 * Returns null where no primary action makes sense, and the header then renders no button at all rather
 * than a disabled one.
 */
export function PrimaryActionFor(pageId: string): SalesPrimaryAction | null {
    switch (pageId) {
        case 'dashboard':
        case 'list':
        case 'board':
            return { Label: 'New deal', Icon: 'fa-solid fa-plus', Creates: 'deal' };
        case 'accounts':
            return NEW_ACCOUNT;
        case 'contacts':
            return { Label: 'New contact', Icon: 'fa-solid fa-plus', Creates: 'contact' };
        default:
            // Settings creates nothing.
            return null;
    }
}

const NEW_ACCOUNT: SalesPrimaryAction = { Label: 'New account', Icon: 'fa-solid fa-building', Creates: 'account' };

/**
 * ADD EXISTING, beside NEW. A Sales Account is the sales half of an Organization Common may already
 * hold, so "New account" is the wrong verb for most of them — and a rep who cannot find a company
 * does not conclude it needs promoting, they create a second one (bc-aidp-next-golive#259). Offering
 * both verbs on the page where accounts are managed is what makes the existing one findable (D-PR3).
 */
const ADD_EXISTING_ACCOUNT: SalesPrimaryAction = {
    Label: 'Add existing',
    Icon: 'fa-solid fa-building-circle-arrow-right',
    Creates: 'promote-account',
};
const ADD_EXISTING_CONTACT: SalesPrimaryAction = {
    Label: 'Add existing',
    Icon: 'fa-solid fa-user-plus',
    Creates: 'promote-contact',
};

/**
 * A second, outline button beside the primary. The dashboard offers a new account, because that is
 * the other thing someone starting work there needs and the Accounts page is otherwise a click away.
 * Accounts and Contacts offer the EXISTING one instead: on those pages "New" is already the primary,
 * and the thing that page cannot otherwise do is reach a record Common already has.
 */
export function SecondaryActionFor(pageId: string): SalesPrimaryAction | null {
    switch (pageId) {
        case 'dashboard':
            return NEW_ACCOUNT;
        case 'accounts':
            return ADD_EXISTING_ACCOUNT;
        case 'contacts':
            return ADD_EXISTING_CONTACT;
        default:
            return null;
    }
}
