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

/**
 * A linked cell (Customer, Pipeline, Stage, Owner, Forecast) opens its record. The viewer does not open
 * it itself: it emits `OpenRelatedRecordRequested` and leaves routing to the host, which the section did
 * not listen for, so the click was dropped.
 */
describe('the deal grids route their linked cells', () => {
    it('binds OpenRelatedRecordRequested on every grid', () => {
        for (const tag of viewers) {
            expect(tag, tag).toContain('(OpenRelatedRecordRequested)="OpenRelatedRecord($event)"');
        }
    });
});

/** The deal form's Activity grid: linked cells open through the form, New goes to the compose form. */
const PANELS = readFileSync(new URL('../lib/form-panels/deal-form.panels.ts', import.meta.url), 'utf8');
const activityPanel = PANELS.slice(PANELS.indexOf("selector: 'mjs-deal-activity-panel'"));
const activityViewer = activityPanel.match(/<mj-entity-viewer\b[^>]*>/)?.[0] ?? '';

describe('the deal form Activity grid', () => {
    it('is found', () => {
        expect(activityViewer).toContain('[ViewEntity]="ActivityView"');
    });

    it('routes its linked cells through the form', () => {
        expect(activityViewer).toContain('(OpenRelatedRecordRequested)="OnActivityRelatedRecord($event)"');
    });

    it('sends New to the compose form above the grid', () => {
        expect(activityPanel).toMatch(/<mjs-deal-activity-timeline #compose\b/);
        expect(activityViewer).toContain('(CreateRecordRequested)="compose.FocusCompose()"');
    });
});
