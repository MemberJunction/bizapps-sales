/**
 * PHASE 1 DEFINITION OF DONE — a rep composes a complete deal through the Deal record form, it PERSISTS,
 * and it READS BACK.
 *
 * ── WHAT CHANGED (#88) ──────────────────────────────────────────────────────────────────────────
 *
 * This drove `mjs-deal-workspace` through its five inner panes. The workspace is no longer mounted:
 * deals are Explorer record tabs rendering `mjs-deal-form`, so the spec now drives that form through
 * `lib/deal-form.ts`. Two workspace-only claims went with it — that five pane tabs exist, and that
 * state survives switching between them (one draft across panes). The form is one record with
 * collapsible panels, so there is no pane switch to survive. Payment-schedule rows are not composed
 * here any more: on the form they are MJ's generic related-entity grid, not code this app owns.
 *
 * ── WHY THIS EXISTS AND `Sales.SaveDeal`'s SERVER-SIDE CHECKS DO NOT COVER IT ───────────────────
 *
 * A form can fail in ways no API-level test can see:
 *
 *   · a lookup renders but offers no rows, so the field is un-fillable;
 *   · a bound field is spelled differently in the template than on the entity, so typing changes nothing;
 *   · the save is refused by a validation rule that is wrong;
 *   · the line editor saves nothing while closing as if it had.
 *
 * All four look identical to a passing GraphQL test, and all four make the app unusable. Every value
 * typed is therefore read back from the DATABASE, not from the screen that typed it.
 *
 * WHAT IT PROVES, in order:
 *   1. The Sales app's New deal opens the Deal record form, with its working panels.
 *   2. A deal composed across panels saves, and every typed header value reaches its column.
 *   3. Two catalogue lines added through the line editor reach the embedded order, priced by the engine.
 *   4. The record reads back, fresh, with foreign keys resolved to NAMES.
 *   5. The console stays clean throughout.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { EXPLORER_BASE_URL } from '../lib/env';
import { CloseDb, OrderLinesForDeal, QueryAll, QueryOne } from '../lib/db';
import { AddLines, ComposeDeal, PurgeDeal, ReopenRecord } from '../lib/deal-flow';
import { DealForm, EditDeal, Field, OpenSection, PickLookup, SaveDeal, SetText } from '../lib/deal-form';
import {
    captureConsoleErrors,
    closeRestoredRecordTabs,
    expectOnlyKnownErrors,
    KNOWN_POST_DELETE_ERRORS,
    openAllEntities,
    shot,
} from '../lib/explorer';

/** Unique per run, so a re-run never collides with a leftover and cleanup can find its own rows. */
const RUN_TAG = `PW-${Date.now().toString(36).toUpperCase()}`;
const DEAL_NAME = `Deal form smoke ${RUN_TAG}`;

const TERM_MONTHS = 24;
const EXECUTION_DATE = '2026-09-15';
const ANNUAL_INCREASE_OVERRIDE = 3;
const VARIANCES = `${RUN_TAG}: annual increase capped at 3% for years 2-3; 60-day termination for convenience.`;

/**
 * Cleanup BY NAME rather than by a captured id: the deal is composed through the UI, so a failure
 * part-way leaves a real row that no variable in this file ever held. 70, 71 and 78 open with
 * `AssertBaseline()`, so residue here fails them several files later.
 */
test.afterAll(async () => {
    const deals = await QueryAll<{ ID: string; OrderID: string | null }>(
        `SELECT ID, OrderID FROM __mj_BizAppsSales.Deal WHERE Name = '${DEAL_NAME}'`,
    );
    for (const d of deals) {
        await PurgeDeal(d.ID, d.OrderID ? String(d.OrderID) : null);
    }
    await CloseDb();
});

/** The panels a rep composes a deal through. Keys are the panels' `SectionKey`s in `deal-form.panels.ts`. */
const WORKING_PANELS = ['pipeline', 'party', 'commercial', 'lines', 'motion', 'close'] as const;

/** The AG Grid rows of the "What's being sold" panel on the active form. */
function lineRows(page: Page): Locator {
    return DealForm(page)
        .locator('.mj-forms-panel[data-section-key="lines"]')
        .locator('.ag-center-cols-container .ag-row:visible');
}

/**
 * Opens a saved line in the restricted line editor by double-clicking its grid row.
 *
 * Local to this spec (and duplicated in 41) because `lib/deal-form.ts` has no row-level line helper
 * yet. Waits for the product select, which renders only once the editor has loaded the line.
 */
async function openLineEditor(page: Page, row: Locator): Promise<Locator> {
    await row.dblclick();
    const editor = page.locator('[data-testid="line-editor"]:visible').first();
    await expect(editor, 'double-clicking a line must open the line editor').toBeVisible({ timeout: 20_000 });
    await expect(editor.locator('[data-testid="line-product"]'), 'the editor must load the line').toBeVisible({
        timeout: 20_000,
    });
    return editor;
}

/** Closes the line editor without saving. */
async function cancelLineEditor(editor: Locator): Promise<void> {
    await editor.getByRole('button', { name: /^\s*Cancel\s*$/ }).click();
    await expect(editor, 'Cancel must close the line editor').toBeHidden({ timeout: 15_000 });
}

/**
 * A money cell as a number. An em dash or an ellipsis becomes NaN — "the engine returned nothing" and
 * "still pricing" must not quietly read as zero-and-therefore-absent.
 */
async function asNumber(cell: Locator): Promise<number> {
    const cleaned = (await cell.innerText()).trim().replace(/[^0-9.\-]/g, '');
    return cleaned === '' ? Number.NaN : Number(cleaned);
}

test.describe('deal form — Phase 1 definition of done', () => {
    test('compose a complete deal through the Deal form, and read it back', async ({ page }) => {
        test.setTimeout(300_000);
        const sink = captureConsoleErrors(page);

        let dealID = '';
        let orderID = '';

        // ── 1. New deal opens the record form ───────────────────────────────
        await test.step('the Sales app opens a new deal as the Deal record form, with its panels', async () => {
            /**
             * `ComposeDeal` opens the form through the header's New deal, fills Name, Pipeline, Account and
             * the first OPEN status (chosen by flag), saves, and waits for the embedded order. It asserts
             * the form rendered and the row and its order landed, so none of that is repeated here.
             */
            const composed = await ComposeDeal(page, DEAL_NAME);
            dealID = composed.DealID;
            orderID = composed.OrderID;

            // Every working panel is present and expands. A missing panel means its registration was
            // tree-shaken or its slot lost, which renders nothing and logs nothing.
            for (const key of WORKING_PANELS) {
                await OpenSection(page, key);
            }
            await shot(page, '40-01-form-open');
        });

        // ── 2. Compose the rest of the header ACROSS panels ─────────────────
        await test.step('the rest of the header, across the pipeline, commercial, motion and close panels', async () => {
            await EditDeal(page);
            await PickLookup(page, 'DealTypeID');
            await SetText(page, 'TermMonths', String(TERM_MONTHS));
            await SetText(page, 'ExecutionDate', EXECUTION_DATE);
            await SetText(page, 'ContractVariances', VARIANCES);
            // Overriding the standard 5% — the whole point of the *Override columns being nullable.
            await SetText(page, 'AnnualIncreasePctOverride', String(ANNUAL_INCREASE_OVERRIDE));
            await SaveDeal(page);
            await shot(page, '40-02-header-saved');
        });

        await test.step('every typed header value reached its column', async () => {
            /**
             * The DATABASE, not the form. A template bound to a misspelled field accepts the typing, shows
             * it, and saves nothing — only a read from the other side of the save can tell.
             */
            const row = await QueryOne<{
                DealTypeID: string | null;
                TermMonths: number | null;
                ExecutionDate: string | null;
                AnnualIncreasePctOverride: number | null;
                ContractVariances: string | null;
            }>(`
                SELECT DealTypeID, TermMonths, CONVERT(varchar(10), ExecutionDate, 23) AS ExecutionDate,
                       AnnualIncreasePctOverride, ContractVariances
                  FROM __mj_BizAppsSales.Deal WHERE ID = '${dealID}'`);
            expect(row, 'the deal must still exist after the second save').toBeTruthy();
            expect(row!.DealTypeID, 'the deal type picked must be saved').toBeTruthy();
            expect(Number(row!.TermMonths), 'the term typed must be saved').toBe(TERM_MONTHS);
            expect(row!.ExecutionDate, 'the execution date typed must be saved, exactly').toBe(EXECUTION_DATE);
            expect(Number(row!.AnnualIncreasePctOverride), 'the annual-increase override must be saved').toBe(
                ANNUAL_INCREASE_OVERRIDE,
            );
            expect(row!.ContractVariances, 'the contract variances typed must be saved').toBe(VARIANCES);
        });

        // ── 3. Lines, through the line editor ───────────────────────────────
        await test.step('two catalogue lines, added through the line editor', async () => {
            /**
             * `AddLines` throws when the picker offers nothing, and returns the ORDER's line count from the
             * database — the editor saves the order, not the deal, so the order is where the lines live.
             */
            const count = await AddLines(page, orderID, 2);
            expect(count, 'both lines must reach the embedded order').toBe(2);
            await expect(lineRows(page), 'and both must show on the lines grid').toHaveCount(2, { timeout: 30_000 });
            await shot(page, '40-03-lines');
        });

        await test.step('the lines reference DIFFERENT products and carry real engine prices', async () => {
            const lines = await OrderLinesForDeal(DEAL_NAME);
            expect(lines.length, 'both lines must be on the deal\'s order').toBe(2);
            expect(
                new Set(lines.map((l) => l.ProductID.toLowerCase())).size,
                'the two lines must reference DIFFERENT products, or the read-back cannot tell one child from two',
            ).toBe(2);
            // Priced by orders, on the way in — asserted where it cannot be a rendering artefact.
            for (const [i, line] of lines.entries()) {
                expect(Number(line.UnitPrice), `line ${i + 1} must carry a REAL price from the engine, not zero`)
                    .toBeGreaterThan(0);
            }
        });

        await test.step('the engine\'s price is what the editor shows for a saved line', async () => {
            /**
             * ── WHY NON-ZERO RATHER THAN A FIGURE ─────────────────────────────────────────────────────
             *
             * Asserting an expected number would mean this repo knowing a price, which is the accretion
             * Rule 1 exists to stop. `> 0` says a real number came back without saying which. The editor
             * renders an em dash for an unpriced line and an ellipsis while pricing, both NaN here.
             *
             * The row is opened by double-click, so the editor LOADS the saved line rather than showing a
             * draft still in memory. Quantity is read from the editor, not assumed from the order the grid
             * lists lines in: on a quantity-1 line the two figures may legitimately match.
             */
            const editor = await openLineEditor(page, lineRows(page).first());
            const figures = editor.locator('.mjs-le__readonly .mjs-le__ro-val');
            await expect(figures, 'the editor renders unit price and line total, read-only').toHaveCount(2);

            await expect
                .poll(() => asNumber(figures.nth(0)), {
                    timeout: 30_000,
                    message:
                        'the unit price never carried a real figure — a dash or 0.00 here means the pricing '
                        + 'engine did not price the line, which is the one failure Rule 1 exists to make impossible',
                })
                .toBeGreaterThan(0);
            const unitPrice = await asNumber(figures.nth(0));
            const lineTotal = await asNumber(figures.nth(1));
            expect(lineTotal, 'the line total must be a real figure too').toBeGreaterThan(0);

            const qty = Number((await editor.locator('[data-testid="line-quantity"]').inputValue()) || '0');
            if (qty > 1) {
                expect(
                    lineTotal,
                    `unit price and line total must be DIFFERENT answers on a line of ${qty}, not one number `
                        + 'rendered twice',
                ).not.toBe(unitPrice);
            } else {
                console.log(`  (quantity is ${qty} — skipping the differ check, the two may legitimately match)`);
            }
            console.log(`  engine priced the line: unit=${unitPrice} total=${lineTotal}`);
            await shot(page, '40-04-priced');
            await cancelLineEditor(editor);
        });

        // ── 4. Read back ────────────────────────────────────────────────────
        await test.step('the saved deal appears in the generated Deals grid', async () => {
            await page.goto(`${EXPLORER_BASE_URL}/app/mjbizappssales`, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(5000);

            // The shell restores recently opened records as tabs; reading one of those instead of the
            // grid fails while looking like a save bug.
            if (await closeRestoredRecordTabs(page)) {
                await page.goto(`${EXPLORER_BASE_URL}/app/mjbizappssales`, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(4000);
            }

            // DataExplorer lands on whichever entity was last opened; `openAllEntities` returns to the list.
            await openAllEntities(page);

            const deals = page.getByText(/^\s*Deals\s*$/i).first();
            await expect(deals).toBeVisible({ timeout: 25_000 });
            await deals.click();
            await page.waitForTimeout(5000);

            const body = await page.locator('body').innerText();
            expect(body, 'the saved deal must appear in the Deals grid').toContain(DEAL_NAME);
            await shot(page, '40-05-readback-grid');
        });

        await test.step('the record reopens fresh, with FKs resolved to names', async () => {
            /**
             * `ReopenRecord` loads the record route by database id in a new page load, so nothing the form
             * held in memory can satisfy this. The names come from `vwDeals`, the view the form reads, and
             * are asserted on the field wrappers — GUIDs on screen are the failure.
             */
            const names = await QueryOne<{ Pipeline: string | null; Account: string | null }>(
                `SELECT Pipeline, Account FROM __mj_BizAppsSales.vwDeals WHERE ID = '${dealID}'`,
            );
            expect(names?.Pipeline, 'the saved deal must have a pipeline to resolve').toBeTruthy();
            expect(names?.Account, 'the saved deal must have an account to resolve').toBeTruthy();

            await ReopenRecord(page, DEAL_NAME);
            await expect(await Field(page, 'PipelineID'), 'the pipeline FK must resolve to its name').toContainText(
                String(names!.Pipeline),
                { timeout: 20_000 },
            );
            await expect(await Field(page, 'AccountID'), 'the account FK must resolve to its name').toContainText(
                String(names!.Account),
                { timeout: 20_000 },
            );

            await OpenSection(page, 'lines');
            await expect(lineRows(page), 'both lines must read back on the reopened record').toHaveCount(2, {
                timeout: 30_000,
            });
            await shot(page, '40-06-readback-record');
        });

        // ── 5. The keystone ─────────────────────────────────────────────────
        await test.step('console stayed clean', async () => {
            expectOnlyKnownErrors(sink, KNOWN_POST_DELETE_ERRORS, 'deal form run');
        });
    });
});
