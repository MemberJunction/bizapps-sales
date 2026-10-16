/**
 * DATES ENTERED BEFORE A DEAL'S FIRST SAVE — saved, and shown after the save (#313).
 *
 * ── WHY THIS IS ITS OWN SPEC ────────────────────────────────────────────────────────────────────
 *
 * `40-deal-form` and `41-deal-roundtrip` both set their dates AFTER `ComposeDeal`, which has already
 * saved the deal. That is an UPDATE. A rep who fills in Expected Close Date on a brand-new deal and
 * then saves takes the CREATE path instead, and nothing drove it: #313 reports the date empty after
 * exactly that save.
 *
 * ── WHAT IT SEPARATES ───────────────────────────────────────────────────────────────────────────
 *
 * An empty field after the save has two causes that look the same on screen: the value never reached
 * the row, or it reached the row and the form cannot show it. So each run reads the DATABASE first,
 * then the form the save left behind, then the form reopened from its route. Whichever assertion fails
 * first names the half that is broken.
 *
 * ── TWO WAYS OF ENTERING THE DATE ───────────────────────────────────────────────────────────────
 *
 * `fill()` sets the whole value at once and fires one change, which is what choosing a day from the
 * calendar does. Typing the date key by key fires a change per completed segment, with intermediate
 * values (a year of 0002, then 0020, ...) in between. Both are what reps do, and the shared date
 * control writes on `change`, so both are driven.
 *
 * The date is the last day of a year, as in the report: the case most exposed to a day or year being
 * shifted by a time zone on the way through.
 */
import { expect, test } from '../lib/test';
import type { Locator, Page } from '@playwright/test';
import { CloseDb, QueryAll, QueryOne } from '../lib/db';
import { PurgeDeal, ReopenRecord } from '../lib/deal-flow';
import {
    EditDeal,
    Field,
    FirstOpenStageOf,
    FirstOpenStatus,
    OpenNewDeal,
    PickLookup,
    PipelineByName,
    SaveDeal,
    SetPipelineByID,
    SetStageByID,
    SetStatusByID,
    SetText,
} from '../lib/deal-form';
import { captureConsoleErrors, expectOnlyKnownErrors } from '../lib/explorer';

const RUN_TAG = `PW-${Date.now().toString(36).toUpperCase()}`;

/** Distinct from each other, so a value landing in the wrong field reads as wrong rather than plausible. */
const EXPECTED_CLOSE = '2026-12-31';
const EXECUTION_DATE = '2026-10-01';

test.afterAll(async () => {
    const deals = await QueryAll<{ ID: string; OrderID: string | null }>(
        `SELECT ID, OrderID FROM __mj_BizAppsSales.Deal WHERE Name LIKE '${RUN_TAG}%'`,
    );
    for (const d of deals) {
        await PurgeDeal(d.ID, d.OrderID ? String(d.OrderID) : null);
    }
    await CloseDb();
});

/** A date field's input, which exists only in edit mode. */
async function dateInput(page: Page, fieldName: string): Promise<Locator> {
    return (await Field(page, fieldName)).locator('.mj-forms-field--editing input[type="date"]').first();
}

/** Types a `yyyy-MM-dd` date into a date input key by key, the way a rep using the keyboard does. */
async function typeDate(page: Page, fieldName: string, isoDay: string): Promise<void> {
    const input = await dateInput(page, fieldName);
    await expect(input, `field ${fieldName} must be editable`).toBeVisible({ timeout: 15_000 });
    const [y, m, d] = isoDay.split('-');
    await input.click();
    // The segment order follows the browser locale; the harness runs en-US, so month, day, year.
    await input.pressSequentially(`${m}${d}${y}`, { delay: 50 });
    await input.blur().catch(() => undefined);
    await page.waitForTimeout(300);
}

/** The stored day, read as text so no driver or zone conversion stands between the row and the check. */
async function storedDays(name: string): Promise<{ ExpectedCloseDate: string | null; ExecutionDate: string | null } | undefined> {
    return QueryOne<{ ExpectedCloseDate: string | null; ExecutionDate: string | null }>(`
        SELECT CONVERT(varchar(10), ExpectedCloseDate, 23) AS ExpectedCloseDate,
               CONVERT(varchar(10), ExecutionDate, 23) AS ExecutionDate
        FROM __mj_BizAppsSales.Deal WHERE Name = '${name}'`);
}

const ENTRY: { label: string; enter: (page: Page, field: string, day: string) => Promise<void> }[] = [
    { label: 'chosen whole (calendar)', enter: SetText },
    { label: 'typed key by key', enter: typeDate },
];

test.describe('new deal — dates entered before the first save', () => {
    for (const { label, enter } of ENTRY) {
        test(`Expected Close Date ${label} is saved and shown after the first save`, async ({ page }) => {
            test.setTimeout(240_000);
            const sink = captureConsoleErrors(page);
            const name = `${RUN_TAG} new deal dates ${label}`;

            await test.step('compose a new deal with both dates set BEFORE saving', async () => {
                await OpenNewDeal(page);
                await SetText(page, 'Name', name);
                const pipeline = await PipelineByName();
                await SetPipelineByID(page, pipeline.ID);
                await SetStageByID(page, (await FirstOpenStageOf(pipeline.ID)).ID);
                await PickLookup(page, 'AccountID');
                await SetStatusByID(page, (await FirstOpenStatus()).ID);

                await enter(page, 'ExpectedCloseDate', EXPECTED_CLOSE);
                await enter(page, 'ExecutionDate', EXECUTION_DATE);
                await expect(await dateInput(page, 'ExpectedCloseDate'), 'the input must hold the date before saving')
                    .toHaveValue(EXPECTED_CLOSE);

                await SaveDeal(page);
            });

            await test.step('the database holds both days exactly', async () => {
                let row: Awaited<ReturnType<typeof storedDays>>;
                await expect
                    .poll(async () => (row = await storedDays(name)) !== undefined, {
                        timeout: 30_000,
                        message: `the deal "${name}" must exist after saving`,
                    })
                    .toBe(true);
                expect(row!.ExpectedCloseDate, 'Expected Close Date set before the first save must be stored')
                    .toBe(EXPECTED_CLOSE);
                expect(row!.ExecutionDate, 'Execution Date set before the first save must be stored')
                    .toBe(EXECUTION_DATE);
            });

            await test.step('the form the save left behind still shows the date', async () => {
                await EditDeal(page);
                await expect(await dateInput(page, 'ExpectedCloseDate'), 'the saved form must show the date, not blank')
                    .toHaveValue(EXPECTED_CLOSE);
            });

            await test.step('the deal reopened from its route shows the date', async () => {
                await ReopenRecord(page, name);
                await EditDeal(page);
                await expect(await dateInput(page, 'ExpectedCloseDate'), 'the reopened form must show the date')
                    .toHaveValue(EXPECTED_CLOSE);
            });

            expectOnlyKnownErrors(sink, [], `saving a new deal with dates (${label})`);
        });
    }
});
