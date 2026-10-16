import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import type { GridColumnConfig } from '@memberjunction/ng-entity-viewer';
import type { ExplorerEntityDataGridComponent } from '@memberjunction/ng-base-forms';
import { DEAL_LINE_COLUMNS, MJSDealLinesPanel } from '../lib/form-panels/deal-form.panels';

/**
 * "WHAT'S BEING SOLD" NAMES ITS OWN COLUMNS, PRODUCT FIRST (sales#265).
 *
 * Without a list the grid inherited Order Line's default view: prices and line number first, the
 * product last and off-screen. Two things are asserted: the list itself, and that the panel actually
 * hands it to the grid, including a grid that appears after the panel rendered (a deal's first save).
 */

/** A stand-in for the explorer wrapper: only the inner grid the panel writes to. */
function fakeGrid() {
    const inner: { Columns: GridColumnConfig[] } = { Columns: [] };
    return { grid: { innerGrid: inner } as unknown as ExplorerEntityDataGridComponent, inner };
}

/** Assigns the panel's view query the way Angular does, through the property setter. */
function resolveQuery(panel: MJSDealLinesPanel, grid: ExplorerEntityDataGridComponent | undefined): void {
    (panel as unknown as { linesGrid: ExplorerEntityDataGridComponent | undefined }).linesGrid = grid;
}

const flushMicrotasks = () => Promise.resolve();

describe('the deal lines column list', () => {
    it('is product, quantity, unit price, line total, in that order', () => {
        expect(DEAL_LINE_COLUMNS.map((c) => c.field)).toEqual(['Product', 'Quantity', 'UnitPrice', 'LineTotalNet']);
    });

    it('leaves out fields that mean nothing on an open deal', () => {
        const fields = DEAL_LINE_COLUMNS.map((c) => c.field);
        expect(fields).not.toContain('FulfillmentStatus');
        expect(fields).not.toContain('LineNumber');
    });

    it('gives every column a title, so no raw field name reaches the header', () => {
        for (const c of DEAL_LINE_COLUMNS) expect(c.title, c.field).toBeTruthy();
    });
});

describe('the panel hands its columns to the grid', () => {
    it('sets them when the grid appears', async () => {
        const panel = Object.create(MJSDealLinesPanel.prototype) as MJSDealLinesPanel;
        const { grid, inner } = fakeGrid();
        resolveQuery(panel, grid);
        await flushMicrotasks();
        expect(inner.Columns).toBe(DEAL_LINE_COLUMNS);
    });

    it('sets them on a grid that appears later, after a first save', async () => {
        const panel = Object.create(MJSDealLinesPanel.prototype) as MJSDealLinesPanel;
        resolveQuery(panel, undefined);
        const { grid, inner } = fakeGrid();
        resolveQuery(panel, grid);
        await flushMicrotasks();
        expect(inner.Columns).toBe(DEAL_LINE_COLUMNS);
    });

    it('does not reset them when the same grid is re-reported', async () => {
        const panel = Object.create(MJSDealLinesPanel.prototype) as MJSDealLinesPanel;
        const { grid, inner } = fakeGrid();
        resolveQuery(panel, grid);
        await flushMicrotasks();
        inner.Columns = [];
        resolveQuery(panel, grid);
        await flushMicrotasks();
        expect(inner.Columns).toEqual([]);
    });
});
