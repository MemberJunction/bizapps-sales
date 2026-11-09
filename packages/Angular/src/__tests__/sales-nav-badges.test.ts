import { describe, expect, it } from 'vitest';

import { BuildLeftNavSections, DEALS_SUB_PAGES } from '../lib/nav/sales-nav.model';

/**
 * THE SLIPPED-DEAL BADGE SAT ON A PAGE THAT DID NOT EXPLAIN IT.
 *
 * The rail badge counts open deals past their expected close date. It was on All deals, which lists
 * every deal with no marker, so the number matched nothing on that page. Dashboard shows the same count
 * on its "Past expected close" tile and lists those deals in its "Close date slipped" queue.
 */

function badgeOn(pageId: string, slipped: number): number | undefined {
    const items = BuildLeftNavSections(DEALS_SUB_PAGES, { Slipped: slipped }).flatMap((s) => s.items);
    const item = items.find((i) => i.id === pageId);
    expect(item, `the rail has a ${pageId} page`).toBeDefined();
    return item?.badge;
}

describe('the slipped-deal badge', () => {
    it('is on Dashboard', () => {
        expect(badgeOn('dashboard', 3)).toBe(3);
    });

    it('is not on All deals or Board', () => {
        expect(badgeOn('list', 3)).toBeUndefined();
        expect(badgeOn('board', 3)).toBeUndefined();
    });

    it('is omitted at zero', () => {
        expect(badgeOn('dashboard', 0)).toBeUndefined();
    });
});
