/**
 * Date-only columns are displayed by their UTC parts; instants are displayed in the viewer's zone
 * (bc-aidp-next-golive#168).
 *
 * `ExpectedCloseDate` and `NextStepDate` are `DATE` columns. The driver hands them back as UTC
 * midnight, so a `date` pipe with no zone argument formats them in the browser's zone — and west of
 * Greenwich, UTC midnight on the 30th is the evening of the 29th. The board card, the overview's "Next
 * move" and the hero's next step all showed the day before the one stored.
 *
 * `Activity.StartedAt` is the opposite case: a DATETIMEOFFSET instant. It was the one binding that DID
 * pass `'UTC'`, so a call logged at 3 PM Central displayed as 8 PM.
 *
 * THE ZONE IS PINNED to America/Chicago for the behavioural cases, because under `TZ=UTC` (which CI
 * runs) a missing zone argument and a `'UTC'` one format identically and this file would pass through
 * the defect it exists for. Node re-reads `process.env.TZ` on assignment.
 */
import '@angular/compiler';
import { formatDate } from '@angular/common';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DisplayDay } from '../lib/board/deal-board.component';

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8');

const BOARD = read('../lib/board/deal-board.component.html');
const FORM = read('../lib/form-panels/deal-form.panels.ts');
const HERO = read('../lib/form-panels/deal-hero.panel.ts');
const TIMELINE = read('../lib/activities/deal-activity-timeline.component.ts');

/** Every `date` pipe applied to `field` in `source`, as the text between the pipe and the closing `}}` or `)`. */
function pipesOn(source: string, field: string): string[] {
    const re = new RegExp(`${field.replace('.', '\\.')}\\)?\\s*\\|\\s*date\\s*:([^})]*)`, 'g');
    return [...source.matchAll(re)].map((m) => m[1].trim());
}

describe('the templates pass a zone for DATE columns and none for instants', () => {
    it('formats the board card close date in UTC', () => {
        const pipes = pipesOn(BOARD, 'ExpectedCloseDate');
        expect(pipes.length, 'the card must still render a close date').toBeGreaterThan(0);
        for (const p of pipes) expect(p).toMatch(/'UTC'$/);
    });

    it('formats NextStepDate in UTC on the overview and on the hero', () => {
        for (const [name, src] of [['deal-form.panels', FORM], ['deal-hero.panel', HERO]] as const) {
            const pipes = pipesOn(src, 'Record.NextStepDate');
            expect(pipes.length, `${name} must still render NextStepDate`).toBeGreaterThan(0);
            for (const p of pipes) expect(p, name).toMatch(/'UTC'$/);
        }
    });

    it('formats an activity\'s StartedAt in the viewer\'s zone, because it is an instant', () => {
        const pipes = pipesOn(TIMELINE, 'row.StartedAt');
        expect(pipes.length, 'the timeline must still render StartedAt').toBeGreaterThan(0);
        for (const p of pipes) expect(p).not.toMatch(/UTC/);
    });
});

describe('what those arguments do, west of Greenwich', () => {
    const original = process.env.TZ;
    beforeAll(() => {
        process.env.TZ = 'America/Chicago';
    });
    afterAll(() => {
        process.env.TZ = original;
    });

    /** 30 September as a DATE column delivers it. */
    const STORED_DAY = new Date('2026-09-30T00:00:00.000Z');

    it('premise: with no zone, a stored 30 September reads as the 29th in Chicago', () => {
        expect(formatDate(STORED_DAY, 'd MMM y', 'en-US')).toBe('29 Sep 2026');
    });

    it("with 'UTC', it reads as the 30th", () => {
        expect(formatDate(STORED_DAY, 'd MMM y', 'en-US', 'UTC')).toBe('30 Sep 2026');
    });

    it('an instant at 3 PM Central reads as 3 PM with no zone, and 8 PM with UTC', () => {
        const loggedAt = '2026-09-30T20:00:00.000Z';
        expect(formatDate(loggedAt, 'h a', 'en-US')).toBe('3 PM');
        expect(formatDate(loggedAt, 'h a', 'en-US', 'UTC')).toBe('8 PM');
    });
});

/**
 * The board's roster can deliver a `Date` or a string, and Angular parses a BARE `YYYY-MM-DD` string
 * as LOCAL midnight — which `'UTC'` would push back a day for anyone EAST of Greenwich. `DisplayDay`
 * normalises both shapes to UTC midnight so the one pipe argument is right on both sides.
 */
describe('DisplayDay gives the board one shape to format', () => {
    const original = process.env.TZ;
    afterAll(() => {
        process.env.TZ = original;
    });

    const shapes: Array<[string, string | Date]> = [
        ['a Date at UTC midnight', new Date('2026-09-30T00:00:00.000Z')],
        ['a full ISO string', '2026-09-30T00:00:00.000Z'],
        ['a bare day string', '2026-09-30'],
    ];

    for (const zone of ['America/Chicago', 'Asia/Tokyo']) {
        for (const [label, value] of shapes) {
            it(`${label} reads as 30 September in ${zone}`, () => {
                process.env.TZ = zone;
                expect(formatDate(DisplayDay(value)!, 'MMM d, y', 'en-US', 'UTC')).toBe('Sep 30, 2026');
            });
        }
    }

    it('is null for no date, so the card says "No date"', () => {
        expect(DisplayDay(null)).toBeNull();
        expect(DisplayDay(undefined)).toBeNull();
        expect(DisplayDay('')).toBeNull();
    });
});
