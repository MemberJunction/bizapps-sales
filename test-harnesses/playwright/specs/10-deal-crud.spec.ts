/**
 * THE POINT OF THIS HARNESS: prove create → read → update → delete of a Deal **through the real
 * Explorer UI**, not through stored procedures or GraphQL.
 *
 * S1 already proved CRUD at the data layer (generated procs) and at the API layer (GraphQL mutations).
 * Neither proves the UI: a generated form can fail to render a field, a lookup can fail to resolve, a
 * save can silently no-op. This spec drives the browser the way a rep would.
 *
 * SHAPE
 *   - one serial test, because each step depends on the previous record existing
 *   - a Pipeline is created FIRST because Deal.PipelineID is NOT NULL (L-14 makes Pipeline.CompanyID
 *     NOT NULL too, so a Company must exist — scripts/seed-dev-data.sh provides one)
 *   - every created record is prefixed PW-VERIFY so cleanup is unambiguous
 *   - teardown deletes in FK order (Deal, then Pipeline) and runs even if the test fails
 *   - the console-error KEYSTONE is asserted at the end: a UI that renders but logs errors is broken
 *     in a way presence assertions cannot see
 *
 * Screenshots land in artifacts/ — one per step, for the demo.
 */
import { test, expect } from '@playwright/test';
import { ARTIFACTS_DIR, DEV_COMPANY_NAME, EXPLORER_BASE_URL, TEST_PREFIX } from '../lib/env';
import {
  captureConsoleErrors,
  clickNew,
  deleteRecordViaRecordView,
  gridRecordCount,
  enterEditMode,
  drain,
  expectNoConsoleErrors,
  expectOnlyKnownErrors,
  KNOWN_POST_DELETE_ERRORS,
  fieldLabelVisible,
  isRequiredEmpty,
  openAllEntities,
  closeRestoredRecordTabs,
  openSalesApp,
  readField,
  saveForm,
  setField,
  setLookup,
  shot,
} from '../lib/explorer';

const PIPELINE_NAME = `${TEST_PREFIX} Pipeline`;
const PIPELINE_CODE = `${TEST_PREFIX}-PIPE`;
const DEAL_NAME = `${TEST_PREFIX} Deal`;

/** Open one entity's grid from the app's entity list. */
async function openEntityGrid(page: import('@playwright/test').Page, label: string): Promise<void> {
  await openSalesApp(page);
  await openAllEntities(page);
  const item = page.getByText(new RegExp(`^\\s*${label}\\s*$`, 'i')).first();
  await expect(item, `entity "${label}" must be listed in the app`).toBeVisible({ timeout: 20_000 });
  await item.scrollIntoViewIfNeeded().catch(() => undefined);
  await item.click();
  await page.waitForTimeout(5000);
  await expect(page.getByText(new RegExp(`^\\s*${label}\\s*$`)).first()).toBeVisible({ timeout: 15_000 });
}

/**
 * Is a record visible on the current grid page?
 *
 * READS TEXT RATHER THAN DRIVING THE FILTER BOX ON PURPOSE. The breadcrumb bar overlays the grid's
 * filter input and intercepts pointer events, so clicking into it to type a search term is flaky by
 * construction (57 retries and a timeout, observed). The harness only ever creates one PW-VERIFY
 * record at a time, so a page-text check is both sufficient and immune to that overlay.
 */
async function findInGrid(page: import('@playwright/test').Page, name: string): Promise<boolean> {
  await page.waitForTimeout(3000);
  const text = await page.locator('body').innerText().catch(() => '');
  return text.includes(name);
}

test.describe.configure({ mode: 'serial' });

test('Deal CRUD through the Explorer UI', async ({ page }) => {
  const sink = captureConsoleErrors(page);

  /**
   * START FROM A CLEAN TAB STRIP, for correctness AND for speed.
   *
   * MJ's shell restores every recently-opened record as a tab and keeps each one's form in the DOM,
   * merely hiding the inactive ones. Two consequences, both of which bit this spec:
   *
   *   - Field lookups could resolve against a HIDDEN form belonging to another tab. That produced
   *     `field "Name" must be editable … Received: hidden` while the visible form was perfectly fine.
   *     `formField` now filters to visible elements, but starting clean removes the ambiguity entirely.
   *   - Every extra tab is another full form kept live, and this walk renders a lot of them. The run
   *     grew until it hit the 8-minute budget with real work still to do.
   */
  await page.goto(EXPLORER_BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const closed = await closeRestoredRecordTabs(page);
  if (closed) console.log(`  closed ${closed} restored tab(s) before starting`);

  // =============================================================================================
  // 1. CREATE a Pipeline (Deal.PipelineID is NOT NULL, so this must exist first)
  // =============================================================================================
  await test.step('create a Pipeline', async () => {
    await openEntityGrid(page, 'Pipelines');
    await shot(page, '10-pipelines-grid');
    await clickNew(page);
    await shot(page, '11-pipeline-new-form');

    // The schema's NOT NULL columns should surface as required in the UI. This is a real assertion
    // about the generated form honouring the schema, not decoration.
    expect(await isRequiredEmpty(page, 'Company'), 'Pipeline.Company is NOT NULL and must render required').toBe(true);

    await setField(page, 'Name', PIPELINE_NAME);
    await setField(page, 'Code', PIPELINE_CODE);
    await setLookup(page, 'Company', DEV_COMPANY_NAME);
    await shot(page, '12-pipeline-filled');

    await saveForm(page);
    await shot(page, '13-pipeline-saved');

    // Saved means the required-empty marker is gone from Company.
    expect(await isRequiredEmpty(page, 'Company'), 'Company should be populated after save').toBe(false);
    expect(await readField(page, 'Name'), 'Name should have persisted').toContain(TEST_PREFIX);
  });

  // =============================================================================================
  // 2. CREATE a Deal referencing it
  // =============================================================================================
  await test.step('create a Deal', async () => {
    await openEntityGrid(page, 'Deals');
    await shot(page, '14-deals-grid');
    await clickNew(page);
    await shot(page, '15-deal-new-form');

    expect(await isRequiredEmpty(page, 'Pipeline'), 'Deal.Pipeline is NOT NULL and must render required').toBe(true);
    expect(await isRequiredEmpty(page, 'Company'), 'Deal.Company is NOT NULL and must render required').toBe(true);

    await setField(page, 'Name', DEAL_NAME);
    await setLookup(page, 'Pipeline', PIPELINE_NAME);
    await setLookup(page, 'Company', DEV_COMPANY_NAME);
    await setField(page, 'Amount', '120000');
    await setField(page, 'Probability', '20');
    await setField(page, 'Term Months', '12');
    await setField(page, 'Next Step', 'Book technical validation');
    await shot(page, '16-deal-filled');

    await saveForm(page);
    await shot(page, '17-deal-saved');

    expect(await readField(page, 'Name'), 'Deal name should have persisted').toContain(TEST_PREFIX);
  });

  // =============================================================================================
  // 3. READ — the saved Deal, and the provenance + relationship surfaces
  // =============================================================================================
  await test.step('read the Deal back', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    await shot(page, '18-deal-reloaded');

    // VIEW MODE. Assert the values a rep actually sees, including the two FKs resolved to their
    // display names — which is what proves the generated base view's denormalised columns work, not
    // just that a UUID was stored.
    const viewText = await page.locator('body').innerText();
    expect(viewText, 'the Deal name renders').toContain(DEAL_NAME);
    expect(viewText, 'the Pipeline FK resolves to its name, not a UUID').toContain(PIPELINE_NAME);
    expect(viewText, 'the Company FK resolves to its name').toContain(DEV_COMPANY_NAME);
    expect(viewText, 'Amount survives a reload').toContain('120000');
    expect(viewText, 'Probability survives a reload').toContain('20');
    expect(viewText, 'Next Step survives a reload').toContain('Book technical validation');

    // EDIT MODE. View mode omits NULL fields, so the provenance trio — which is unset on a
    // hand-entered amount — can only be asserted here. These three columns are what make Deal.Amount
    // a traceable cached answer rather than a hand-edited number (master plan §4.3); if CodeGen ever
    // stops rendering them, the guarantee quietly becomes unenforceable in the UI.
    await enterEditMode(page);
    await shot(page, '18b-deal-edit-mode');
    for (const label of ['Amount Is Computed', 'Amount Computed At', 'Amount Source Hash']) {
      expect(
        await fieldLabelVisible(page, label),
        `the provenance field "${label}" must render on the edit form`,
      ).toBe(true);
    }

    // The child relationships CodeGen wired up.
    for (const tab of ['Deal Lines', 'Deal Team Members', 'Deal Stage Events', 'Deal Contact Roles']) {
      expect(
        await fieldLabelVisible(page, tab),
        `related-entity surface "${tab}" must be reachable`,
      ).toBe(true);
    }
  });

  // =============================================================================================
  // 4. UPDATE
  // =============================================================================================
  await test.step('update the Deal', async () => {
    await enterEditMode(page);
    await setField(page, 'Amount', '185000');
    await setField(page, 'Probability', '45');
    await setField(page, 'Term Months', '24');
    await saveForm(page);
    await shot(page, '19-deal-updated');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    const afterUpdate = await page.locator('body').innerText();
    expect(afterUpdate, 'updated Amount must persist across a reload').toContain('185000');
    expect(afterUpdate, 'updated Probability must persist').toContain('45');
    expect(afterUpdate, 'updated Term Months must persist').toContain('24');
    expect(afterUpdate, 'the OLD amount must be gone').not.toContain('120000');
    await shot(page, '20-deal-update-verified');

    // KEYSTONE, part 1 — asserted here rather than only at the end so that create/read/update are held
    // to a ZERO-error standard, uncontaminated by the known post-delete noise below.
    expectNoConsoleErrors(sink, 'creating, reading and updating a Deal through the UI');
    drain(sink);
  });

  // =============================================================================================
  // 5. DELETE
  // =============================================================================================
  await test.step('confirm the Deal is listed in the grid', async () => {
    await openEntityGrid(page, 'Deals');
    expect(
      await findInGrid(page, DEAL_NAME),
      'the Deal must appear in the entity grid — this is the list-level read',
    ).toBe(true);
    expect(await gridRecordCount(page), 'the grid should report at least one record').toBeGreaterThan(0);
    await shot(page, '21-deal-in-grid');
  });

  await test.step('delete the Deal', async () => {
    await deleteRecordViaRecordView(page, DEAL_NAME);
    await shot(page, '22-deal-deleted');

    // Re-navigate for a clean read of server state, then assert absence FROM THE GRID ROWS — not from
    // page text, because the open record tab keeps the name in the DOM after deletion.
    await openEntityGrid(page, 'Deals');
    const remainingRow = page
      .locator('tr, .ag-row, [role="row"]')
      .filter({ hasText: DEAL_NAME });
    expect(
      await remainingRow.count(),
      'no grid row for the Deal may remain after deletion',
    ).toBe(0);
    await shot(page, '23-deal-absent');
  });

  // =============================================================================================
  // 6. CLEAN UP the Pipeline through the UI too, so the whole run is UI-verified end to end.
  //    (global-teardown also sweeps PW-VERIFY rows in SQL, for the case where this step never runs.)
  // =============================================================================================
  await test.step('delete the Pipeline', async () => {
    await openEntityGrid(page, 'Pipelines');
    await deleteRecordViaRecordView(page, PIPELINE_NAME);
    await openEntityGrid(page, 'Pipelines');
    const remaining = page.locator('tr, .ag-row, [role="row"]').filter({ hasText: PIPELINE_NAME });
    expect(await remaining.count(), 'no grid row for the Pipeline may remain').toBe(0);
    await shot(page, '24-pipeline-absent');
  });

  // KEYSTONE, part 2 — the delete steps. Only the documented stale-tab reload is tolerated; anything
  // else still fails. See KNOWN_POST_DELETE_ERRORS for why that one is expected.
  expectOnlyKnownErrors(sink, KNOWN_POST_DELETE_ERRORS, 'deleting the Deal and Pipeline through the UI');

  console.log(`\n  screenshots -> ${ARTIFACTS_DIR}\n`);
});
