import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The deal grids' own "New" button opens a new deal.
 *
 * `mj-entity-viewer` does not open a create form itself: its grid's New button emits
 * `CreateRecordRequested` and leaves routing to the host. The section bound only `RecordOpened`, so the
 * New button on All deals (and on the dashboard's Inspect grid) did nothing when clicked.
 */

const SECTION = readFileSync(new URL('../lib/sections/sales-section.component.html', import.meta.url), 'utf8');

/** Each `<mj-entity-viewer ...>` opening tag, attributes included. */
const viewers = [...SECTION.matchAll(/<mj-entity-viewer\b[^>]*>/g)].map((m) => m[0]);

describe('the deal grids route their New button', () => {
    it('finds the All deals and Inspect grids', () => {
        expect(viewers.some((tag) => tag.includes('[ViewEntity]="AllDealsView"'))).toBe(true);
        expect(viewers.some((tag) => tag.includes('[ViewEntity]="InspectView"'))).toBe(true);
    });

    it('binds CreateRecordRequested to the same action as the header New deal button', () => {
        for (const tag of viewers) {
            expect(tag, tag).toContain('(CreateRecordRequested)="StartPrimary()"');
        }
    });
});
