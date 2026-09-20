import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { MJSDealHeroPanel } from '../lib/form-panels/deal-hero.panel';

/**
 * WHERE A DEAL GOES ONCE IT EXISTS.
 *
 * A new deal opens on Pipeline — that panel declares `leadsWhenUnsaved`, deliberately (golive#188),
 * because a summary of a record with no data is a page of blanks. Once saved the reasoning inverts, and
 * MJ persists the active group only for a SAVED record, so nothing moved the rail on that transition:
 * a rep was left looking at the form they had just finished.
 */

function hero(opts: { id?: string } = {}) {
    const groups: string[] = [];
    const h = Object.create(MJSDealHeroPanel.prototype) as {
        ngDoCheck(): void;
        Groups: string[];
        SetRecord(saved: boolean, id?: string): void;
    };
    let record: { IsSaved: boolean; Get: (f: string) => string } | null = null;
    Object.defineProperty(h, 'Record', { get: () => record });
    Object.defineProperty(h, 'chrome', { value: { SetActiveGroup: (k: string) => groups.push(k) } });
    Object.defineProperty(h, 'wasSaved', { value: null, writable: true });
    Object.defineProperty(h, 'Groups', { get: () => groups });
    Object.defineProperty(h, 'SetRecord', {
        value: (saved: boolean, id = opts.id ?? 'deal-1') => {
            record = { IsSaved: saved, Get: () => id };
        },
    });
    return h;
}

describe('after a new deal is saved', () => {
    it('moves to the Overview, which now has something to summarise', () => {
        const h = hero();
        h.SetRecord(false);
        h.ngDoCheck();            // composing
        h.SetRecord(true);
        h.ngDoCheck();            // just saved
        expect(h.Groups).toEqual(['overview']);
    });

    /**
     * KEYED ON THE CROSSING, not on IsSaved. A deal that is already saved must never be dragged to
     * Overview, or a rep could not stay on another section for the rest of its life.
     */
    it('leaves an already-saved deal where the rep put it', () => {
        const h = hero();
        h.SetRecord(true);
        h.ngDoCheck();
        h.ngDoCheck();
        h.ngDoCheck();
        expect(h.Groups).toEqual([]);
    });

    it('navigates once, not on every change-detection pass', () => {
        const h = hero();
        h.SetRecord(false);
        h.ngDoCheck();
        h.SetRecord(true);
        h.ngDoCheck();
        h.ngDoCheck();
        h.ngDoCheck();
        expect(h.Groups).toEqual(['overview']);
    });

    it('does nothing while the deal is still being composed', () => {
        const h = hero();
        h.SetRecord(false);
        h.ngDoCheck();
        h.ngDoCheck();
        expect(h.Groups).toEqual([]);
    });

    it('survives having no record at all', () => {
        const h = hero();
        expect(() => h.ngDoCheck()).not.toThrow();
        expect(h.Groups).toEqual([]);
    });
});
