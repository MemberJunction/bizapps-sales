/**
 * PHASE 1 DEFINITION OF DONE — an account director composes a complete deal through the custom
 * workspace, it PERSISTS, and it READS BACK.
 *
 * WHY THIS EXISTS AND `Sales.SaveDeal`'s SERVER-SIDE CHECKS DO NOT COVER IT. The operation is already
 * verified against a live database, so this spec is not here to test the transaction again. It is here
 * because a form can fail in ways no API-level test can see:
 *
 *   · a `<select>` renders but its options never load, so the field is un-fillable;
 *   · a bound field is spelled differently in the template than in the draft, so typing changes nothing;
 *   · the Save button is disabled by a validation rule that is wrong;
 *   · the save succeeds and the surface still shows the empty form.
 *
 * All four look identical to a passing GraphQL test, and all four make the app unusable.
 *
 * WHAT IT PROVES, in order:
 *   1. The hand-authored **Sales** application exists and its Deals nav item reaches the workspace.
 *      (Phase 2 put a section shell in front of it, so the nav item's `DriverClass` is now
 *      `SalesDealsSectionResource` and the workspace is one of its three rail pages —
 *      `50-sales-shell.spec.ts` covers the shell itself.)
 *   2. All five panes render and are reachable.
 *   3. A deal can be composed ACROSS panes — header on one, lines on a second, instalments on a third —
 *      and the panes keep their state while switching, because they are one draft and not five forms.
 *   4. Saving writes the deal AND both child collections in one action.
 *   5. Re-opening reads them all back with foreign keys resolved to NAMES.
 *   6. The console stays clean throughout (the keystone — an exception behind a working-looking screen
 *      is still a bug).
 *
 * IT LEAVES ITS DEAL BEHIND, on purpose, and every row it writes is tagged `PW-<base36 timestamp>`.
 * Deleting it would mean either driving the delete affordance (a second thing to debug when the real
 * subject is the save) or reaching around the UI into SQL from a UI test. Re-runs cannot collide,
 * because the tag is unique per run. To clear them out:
 *
 *   DELETE FROM __mj_BizAppsSales.DealPaymentSchedule WHERE DealID IN (SELECT ID FROM __mj_BizAppsSales.Deal WHERE Name LIKE 'Workspace smoke PW-%');
 *   DELETE FROM __mj_BizAppsSales.DealLine           WHERE DealID IN (SELECT ID FROM __mj_BizAppsSales.Deal WHERE Name LIKE 'Workspace smoke PW-%');
 *   DELETE FROM __mj_BizAppsSales.DealTeamMember     WHERE DealID IN (SELECT ID FROM __mj_BizAppsSales.Deal WHERE Name LIKE 'Workspace smoke PW-%');
 *   DELETE FROM __mj_BizAppsSales.Deal               WHERE Name LIKE 'Workspace smoke PW-%';
 *
 * A full `scripts/rebuild-db.sh` also clears them, since it drops the database.
 */
import { expect, test } from '@playwright/test';
import { EXPLORER_BASE_URL } from '../lib/env';
import { CloseDb, OrderLinesForDeal, QueryAll } from '../lib/db';
import { PurgeDeal } from '../lib/deal-flow';
import {
  captureConsoleErrors,
  closeRestoredRecordTabs,
  expectOnlyKnownErrors,
  KNOWN_POST_DELETE_ERRORS,
  shot,
} from '../lib/explorer';

/** The hand-authored app's route. Distinct from the GENERATED entity browser at /app/mjbizappssales. */
const SALES_WORKSPACE_APP_ROUTE = '/app/sales';

/** Unique per run, so a re-run never collides with a leftover and cleanup can find its own rows. */
const RUN_TAG = `PW-${Date.now().toString(36).toUpperCase()}`;
const DEAL_NAME = `Workspace smoke ${RUN_TAG}`;

/**
 * CLEANUP, WHICH LIVED IN A COMMENT.
 *
 * The docblock at the top of this file lists four DELETE statements to run "to clear them out", and
 * argues the case for not deleting from the spec: "Deleting it would mean either driving the delete
 * affordance (a second thing to debug when the real subject is the save) or reaching around the UI
 * into SQL from a UI test." The reasoning is sound about the DELETE AFFORDANCE and does not carry to
 * teardown -- 79-embedded-order-refresh reaches into SQL in exactly this way and is the better model.
 *
 * The cost of leaving it was paid by other files. 70-lifecycle, 71 and 78 open with AssertBaseline(),
 * which asserts the WHOLE host is back to its seven seeded deals, so a `Workspace smoke PW-...` left
 * here failed a spec several files later with "the host must be back to its seven seeded deals". This
 * is the third file tonight with cleanup written as instructions for a human -- 41 and 60 were the
 * others -- and all three docblocks still name DealLine, retired in 0d3d1ed.
 *
 * BY NAME rather than by a captured id, following 79: this spec composes its deal through the UI, so
 * a failure part-way leaves a real row that no variable in this file ever held.
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

/** The five panes, by their visible label. Keys live in `deal-workspace.types.ts`. */
const PANES = ['Party info', 'Product lines', 'Payment schedule', 'Terms', 'Variances'] as const;

/** Clicks an inner pane tab and waits for its content to swap in. */
async function openPane(page: import('@playwright/test').Page, label: string): Promise<void> {
  const tab = page.locator('.dw-panes__tab', { hasText: label }).first();
  await expect(tab, `pane tab "${label}" must be present`).toBeVisible({ timeout: 20_000 });
  await tab.click();
  await page.waitForTimeout(600);
}

/**
 * Sets a labelled field inside the workspace.
 *
 * Scoped to `.dw-field` rather than using `getByLabel`: the panes deliberately reuse short labels
 * ("Description" appears on a line and on the header), and an unscoped label lookup is ambiguous
 * exactly where it would be most confusing to debug.
 */
async function setWorkspaceField(
  page: import('@playwright/test').Page,
  label: string,
  value: string,
): Promise<void> {
  const field = page.locator('.dw-field', { hasText: label }).first();
  await expect(field, `field "${label}" must be visible`).toBeVisible({ timeout: 15_000 });
  const control = field.locator('input, textarea, select').first();
  const tag = await control.evaluate((el) => el.tagName.toLowerCase());
  if (tag === 'select') {
    await control.selectOption({ label: value });
  } else {
    await control.fill(value);
  }
  await page.waitForTimeout(250);
}

/** Picks the first REAL option of a labelled select (skipping the "— choose —" placeholder). */
async function selectFirstRealOption(
  page: import('@playwright/test').Page,
  label: string,
): Promise<string> {
  const field = page.locator('.dw-field', { hasText: label }).first();
  const select = field.locator('select').first();
  await expect(select, `select "${label}" must be visible`).toBeVisible({ timeout: 15_000 });

  const options = await select.locator('option').all();
  for (const option of options) {
    const text = ((await option.textContent()) ?? '').trim();
    // The placeholder is an em-dash sentinel; anything else is a real row.
    if (text && !text.startsWith('—')) {
      await select.selectOption({ label: text });
      await page.waitForTimeout(300);
      return text;
    }
  }
  throw new Error(`select "${label}" offered no real options — its lookup did not load`);
}


test.describe('deal workspace — Phase 1 definition of done', () => {
  test('compose a complete deal through the custom form, and read it back', async ({ page }) => {
    test.setTimeout(300_000);
    const sink = captureConsoleErrors(page);

    // ── 1. The hand-authored app resolves to the workspace ──────────────────
    await test.step('the Sales app opens the deal workspace', async () => {
      await page.goto(`${EXPLORER_BASE_URL}${SALES_WORKSPACE_APP_ROUTE}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(6000);

      /**
       * NAVIGATE TO THE WORKSPACE FIRST. Phase 2 put a section shell around this surface, so `/app/sales`
       * now lands on the DASHBOARD and the workspace is one of three rail pages. Before that it was the
       * whole app and rendered immediately — which is exactly what this step used to assume, and why the
       * Phase 2 change broke a passing spec.
       *
       * The rail item is a BUTTON whose accessible name is "<label> <description>", so this is a prefix
       * match by role: `mj-left-nav` also emits hidden switcher-label spans carrying the same words.
       */
      await page
        .locator('mj-left-nav')
        .getByRole('button', { name: /^Workspace/i })
        .first()
        .click({ timeout: 30_000 });
      await page.waitForTimeout(3000);

      // The workspace's own root — proof the resource registration resolved. If `DriverClass` had been
      // tree-shaken out, the nav item would render an empty tab with no error anywhere.
      const workspace = page.locator('mjs-deal-workspace');
      await expect(workspace, 'the deal workspace component must render').toBeVisible({ timeout: 40_000 });
      await shot(page, '40-01-workspace-open');
    });

    // ── 2. Every pane is reachable ──────────────────────────────────────────
    await test.step('all five panes render', async () => {
      for (const label of PANES) {
        await openPane(page, label);
      }
      await openPane(page, 'Party info');
      await shot(page, '40-02-panes');
    });

    // ── 3. Compose the deal ACROSS panes ────────────────────────────────────
    let pipelineName = '';
    let customerName = '';

    await test.step('party info', async () => {
      await setWorkspaceField(page, 'Deal name', DEAL_NAME);
      // Pipeline is the one field that drives others — it sets the selling company and the stage list.
      pipelineName = await selectFirstRealOption(page, 'Pipeline');
      customerName = await selectFirstRealOption(page, 'Customer');
      await selectFirstRealOption(page, 'Deal type');
      await selectFirstRealOption(page, 'Sales rep (owner)');
      await setWorkspaceField(page, 'Term (months)', '24');
      await setWorkspaceField(page, 'Execution date', '2026-09-15');

      // The persistent context header must now name the customer — the thing KI-8 means the deal row
      // cannot tell us on its own.
      const context = page.locator('.dw-context__customer');
      await expect(context, 'the customer-context header must show the chosen account').toContainText(
        customerName.slice(0, 12),
        { timeout: 10_000 },
      );
      await shot(page, '40-03-party');
    });

    /**
     * ── THE FIRST SAVE, WHICH THIS SPEC USED TO SKIP ──────────────────────────────────────────────
     *
     * `Add line` is gated on `CanAddLine`, which is `!!Deal?.IsSaved`, because the embedded order is
     * provisioned inside `DealEntityServer.Save()` on the first save (S-US4) -- there is no order to add
     * a line to before then. The button says so in its own title: "Save the deal first".
     *
     * So this step is not scaffolding, it is the thing being tested one line earlier: a deal is composed,
     * saved, and only then does it acquire the order that lines belong to. Skipping it made the spec fail
     * on a disabled button, which reads as a broken control rather than a missing step.
     *
     * The message is asserted rather than the click alone, because a save that silently did not land
     * leaves `Add line` disabled for exactly the same reason and would look identical here.
     */
    await test.step('save, so the deal acquires its embedded order', async () => {
      const firstSave = page.locator('button', { hasText: /^\s*Save deal\s*$/ }).first();
      await expect(firstSave, 'Save must be ENABLED once party info is complete').toBeEnabled({
        timeout: 15_000,
      });
      await firstSave.click();
      const msg = page.locator('.dw-msg');
      await expect(msg, 'the save must report something').toBeVisible({ timeout: 20_000 });
      await expect(msg, 'and it must not be an error').not.toHaveClass(/dw-msg--error/);
      await shot(page, '40-03b-first-save');
    });

    /**
     * DECLARED AT TEST SCOPE, not inside the step that fills it.
     *
     * The read-back step below is a separate closure, so a const declared inside the lines step is
     * not visible there. tsc caught it as "Cannot find name 'chosenProducts'" while the run went
     * GREEN -- because the read-back sits behind an `if (section is visible)` guard that did not
     * fire, so the ReferenceError was never reached.
     *
     * That is the ComposeDeal shape again: an assertion that cannot execute, passing quietly. Worth
     * the note because the harness has no compile gate, so only a hand-run tsc finds these.
     */
    const chosenProducts: string[] = [];

    await test.step('product lines — two of them', async () => {
      await openPane(page, 'Product lines');
      const add = page.locator('.dw-addbtn', { hasText: 'Add line' }).first();
      await expect(add, 'Add line must be enabled once the deal is saved').toBeEnabled({ timeout: 20_000 });

      await add.click();
      await page.waitForTimeout(500);
      await add.click();
      await page.waitForTimeout(500);

      const rows = page.locator('.dw-table tbody tr');
      await expect(rows, 'two line rows must exist').toHaveCount(2, { timeout: 10_000 });

      /**
       * ── REWRITTEN AGAINST THE ORDER-LINE GRID ─────────────────────────────────────────────────
       *
       * This transcribed a product NAME, annual gross fees, a discount amount and a total into five
       * positional inputs. That was the `DealLine` grid, and Andrew formally descoped `DealLine` this
       * morning — issues #36–#39 closed as not planned, with the note "An embedded Order record will
       * store products and prices associated with the deal" — which is the same conclusion
       * `docs/DECISIONS.md` D-DL1 (:461) reached from the invariant side.
       *
       * An `OrderLine` row is: a PRODUCT PICKER, a quantity, a read-only unit price, a read-only line
       * total, and a discount percent. So there is no name to type and no total to transcribe — the
       * two figures a rep supplies are quantity and discount, and the money comes back from the engine
       * (rule 1: sales never computes it).
       *
       * The failure this replaces was `Cannot type text into input[type=number]`: the first input is
       * now Quantity, so the old loop typed a product name into a number field.
       */
      const values = [
        { qty: '100', discountPct: '10' },
        { qty: '1', discountPct: '0' },
      ];
      /**
       * ── DELETED: THE RECURRING-PATH ASSERTIONS ────────────────────────────────────────────────
       *
       * RETIRED BY `docs/DECISIONS.md` D-DL1 (:461). Three references to one control went with it: the
       * "at least two types" precondition, the per-row type selection, and the "the two lines must
       * carry DIFFERENT types" check below.
       *
       * D-DL1 settled that nothing routes by line kind. Recurrence is a property of the PRODUCT the rep
       * already picks, so there is no sales behaviour left for a spec to assert — a sales spec claiming
       * it would be asserting orders' concern from the wrong side of the boundary.
       *
       * The control does not exist either: `select.dw-cell-linetype` appears nowhere in the template,
       * and the only line-level select is `.dw-cell-product`. That is why this failed as
       * "must offer at least two types, Received: 0" — not a shrunken vocabulary, an absent control.
       *
       * AND THE OLD DOCBLOCK POINTED SOMEWHERE RETIRED, which is worth correcting rather than
       * deleting silently: it deferred the flag semantics to integration check `SD12`. `SD12` is gone
       * along with `SD4`, `SD5` and `SD16`, and `save-deal.checks.ts:20` records that their ids are
       * deliberately not reused. So the pointer led nowhere, and there is no live check anywhere in the
       * suite asserting product recurrence. That is the state D-DL1 chose, not a gap to be filled here.
       */
      /**
       * DIFFERENT PRODUCTS PER ROW, so the read-back later proves two distinct children rather than one
       * written twice. Chosen by INDEX, not by SKU, so the spec does not rot when the catalogue changes
       * — the same reasoning 60 uses.
       */
      for (let i = 0; i < values.length; i++) {
        const row = rows.nth(i);

        const picker = row.locator('select.dw-cell-product');
        await picker.selectOption({ index: i + 1 });       // index 0 is the "choose a product" placeholder
        chosenProducts.push((await picker.locator('option:checked').innerText()).trim());

        // Quantity is the FIRST number input; discount percent is the second. Unit price and line total
        // sit between them and are read-only cells, not inputs, so they are not in this collection.
        const numbers = row.locator('td.dw-num input[type="number"]');
        await numbers.nth(0).fill(values[i].qty);
        await numbers.nth(1).fill(values[i].discountPct);

        await page.waitForTimeout(250);
      }

      expect(
        new Set(chosenProducts).size,
        'the two rows must reference DIFFERENT products, or the read-back cannot tell one child from two',
      ).toBe(2);

      await shot(page, '40-04-lines');
    });

    await test.step('payment schedule — the exception case', async () => {
      await openPane(page, 'Payment schedule');
      // Empty is the normal state and must READ as standard terms rather than as an unfinished form.
      await expect(
        page.locator('.dw-empty'),
        'an empty schedule must be labelled as standard terms, not as missing data',
      ).toContainText(/standard terms/i, { timeout: 10_000 });

      const add = page.locator('.dw-addbtn', { hasText: 'Add instalment' }).first();
      await add.click();
      await page.waitForTimeout(400);
      await add.click();
      await page.waitForTimeout(400);

      const rows = page.locator('.dw-table tbody tr');
      await expect(rows).toHaveCount(2, { timeout: 10_000 });
      const instalments = [
        { date: '2026-10-01', amount: '64000', note: '50% on execution' },
        { date: '2027-01-01', amount: '64000', note: '50% on go-live' },
      ];
      for (let i = 0; i < instalments.length; i++) {
        const inputs = rows.nth(i).locator('input');
        await inputs.nth(0).fill(instalments[i].date);
        await inputs.nth(1).fill(instalments[i].amount);
        await inputs.nth(2).fill(instalments[i].note);
        await page.waitForTimeout(200);
      }
      await shot(page, '40-05-schedule');
    });

    await test.step('terms and variances', async () => {
      await openPane(page, 'Terms');
      // Overriding the standard 5% — the whole point of the *Override columns being nullable.
      await setWorkspaceField(page, 'Annual increase % (override)', '3');
      await shot(page, '40-06-terms');

      await openPane(page, 'Variances');
      await setWorkspaceField(
        page,
        'Contract variances',
        `${RUN_TAG}: annual increase capped at 3% for years 2-3; 60-day termination for convenience.`,
      );
      await shot(page, '40-07-variances');
    });

    await test.step('state survived pane switching', async () => {
      // ONE DRAFT, NOT FIVE FORMS. If each pane were its own form, going back would show an empty one.
      await openPane(page, 'Party info');
      const nameInput = page.locator('.dw-field', { hasText: 'Deal name' }).first().locator('input').first();
      await expect(nameInput, 'the deal name must survive switching panes').toHaveValue(DEAL_NAME);

      await openPane(page, 'Product lines');
      await expect(page.locator('.dw-table tbody tr'), 'the lines must survive switching panes').toHaveCount(2);
    });

    // ── 4. Save ─────────────────────────────────────────────────────────────
    await test.step('save writes the deal and both child collections', async () => {
      const save = page.locator('button', { hasText: /^\s*Save deal\s*$/ }).first();
      await expect(save, 'the Save deal button must be present').toBeVisible({ timeout: 10_000 });
      await expect(save, 'Save must be ENABLED — a valid draft that cannot be saved is the bug').toBeEnabled({
        timeout: 10_000,
      });
      await save.click();

      // The surface reports the server's own words.
      const message = page.locator('.dw-msg');
      await expect(message, 'a save confirmation must appear').toContainText(/created|saved/i, { timeout: 45_000 });
      await expect(message, 'the save must not have failed').not.toHaveClass(/dw-msg--error/);
      await shot(page, '40-08-saved');
    });

    // ── 4b. THE PRICE THE ENGINE SENT BACK ──────────────────────────────────
    await test.step('the engine priced the lines, with real figures', async () => {
      /**
       * ── NOTHING IN 22 SPEC FILES READ A PRICE UNTIL THIS STEP ────────────────────────────────
       *
       * The suite drove every input AROUND the price and never looked at the price. `20` asserts the
       * two cells are read-only; this spec filled quantity and discount on either side of them. So a
       * pricing bridge that returned 0.00 for every line — a resolver that found no price, a
       * catalogue lookup that missed, an empty envelope — passed the entire browser suite. The
       * server-side twin had the same hole for the same reason: `save-deal.SD19` asserted
       * `UnitPrice !== null` on a column that is **NOT NULL in the schema**, so it could not fail.
       *
       * Rule 1 says sales never computes money and asks the engine instead. The engine ANSWERING is
       * the half that was never checked.
       *
       * WHY NON-ZERO RATHER THAN A FIGURE: asserting an expected number would mean this repo knowing
       * a price, which is the accretion Rule 1 exists to stop. `> 0` says a real number came back
       * without saying which — the strongest claim sales is entitled to make from this side of the
       * boundary.
       *
       * The em dash matters too: the template renders `{{ line.LineTotalNet ?? '—' }}`, so an
       * unpriced line shows a dash rather than a blank. "Present" was never the question.
       */
      await openPane(page, 'Product lines');

      const rows = page.locator('.dw-table tbody tr');
      await expect(rows, 'both saved lines must still be on the grid').toHaveCount(2, { timeout: 20_000 });

      // Prices arrive with the server's response to the save, so poll rather than assume the first
      // paint carries them.
      const priceCells = rows.first().locator('td.dw-readonly');
      await expect(priceCells, 'a line renders unit price and line total as read-only cells')
        .toHaveCount(2, { timeout: 10_000 });

      const asNumber = async (cell: import('@playwright/test').Locator): Promise<number> => {
        const raw = (await cell.innerText()).trim();
        // Strip currency, thousands separators and whitespace; an em dash becomes NaN, which is the
        // "the engine returned nothing" case and must NOT quietly read as zero-and-therefore-absent.
        const cleaned = raw.replace(/[^0-9.\-]/g, '');
        return cleaned === '' ? Number.NaN : Number(cleaned);
      };

      await expect
        .poll(async () => asNumber(priceCells.nth(0)), {
          timeout: 30_000,
          message:
            'the unit price cell never carried a real figure — a dash or 0.00 here means the pricing '
            + 'engine did not price the line, which is the one failure Rule 1 exists to make impossible',
        })
        .toBeGreaterThan(0);

      const unitPrice = await asNumber(priceCells.nth(0));
      const lineTotal = await asNumber(priceCells.nth(1));

      expect(
        lineTotal,
        'the line total must be a real figure too — it is what the deal amount is built from',
      ).toBeGreaterThan(0);

      /**
       * On a line whose quantity is more than one, the total cannot equal the unit price. This is NOT
       * a recomputation of the engine's arithmetic — sales does not multiply — it is the cheapest
       * available check that the two cells hold genuinely different answers rather than one number
       * rendered twice, which is what a stubbed or half-wired bridge tends to produce.
       *
       * The quantity is READ FROM THE ROW rather than assumed. This spec adds a line of 100 and a
       * line of 1, and nothing guarantees which the grid puts first; on the quantity-1 line the two
       * figures may legitimately match, and asserting otherwise would be inventing a rule.
       */
      const qty = Number(
        (await rows.first().locator('td.dw-num input[type="number"]').first().inputValue()) || '0',
      );
      if (qty > 1) {
        expect(
          lineTotal,
          `unit price and line total must be DIFFERENT answers on a line of ${qty}, not one number `
          + 'rendered into two cells',
        ).not.toBe(unitPrice);
      } else {
        console.log(`  (quantity is ${qty} — skipping the differ check, the two may legitimately match)`);
      }

      console.log(`  engine priced line 1: unit=${unitPrice} total=${lineTotal}`);
      await shot(page, '40-08b-priced');
    });

    // ── 4c. THE CHILDREN, READ BACK WHERE NAVIGATION CANNOT BREAK IT ────────
    await test.step('one save wrote the header AND both children', async () => {
      /**
       * ── THIS NO LONGER LOGS AND PASSES WHEN IT CANNOT LOOK ──────────────────────────────────────
       *
       * It used to. The whole block sat inside `if (section is visible) { assert } else { console.log }`,
       * with the reasoning that failing a run over an accordion was disproportionate. The effect was
       * that the STRONGEST claim in this file — one transactional save wrote the header and its
       * children, read back through a surface that did not write them — was the one assertion that
       * could quietly not run. It is the fourth assertion-that-cannot-fire found this week.
       *
       * The claim is now proven against the DATABASE, which is a legitimately different surface from
       * the workspace that wrote it — the same standard `60` and `80` are held to — and it cannot be
       * skipped by a missing affordance.
       *
       * WHY THE UI HALF MOVED RATHER THAN BEING MADE STRICT: the section it looked for is titled
       * "Deal Lines", and that entity no longer exists. Andrew closed issues #36-#39 as not planned
       * (`docs/DECISIONS.md` D-DL1); a deal's lines are rows on the embedded ORDER now, and the
       * generated Deal form has no section for them. So the old code was not merely guarded — it was
       * guarding a lookup that could never succeed, which is why it never once fired. Making it strict
       * would have produced a permanent red for a UI that is correct.
       */
      const lines = await OrderLinesForDeal(DEAL_NAME);

      expect(
        lines.length,
        'BOTH lines must have reached the database from ONE save — the header and its children '
        + 'together, or the transaction did not do what the surface said it did',
      ).toBe(2);

      // Priced by orders, on the way in — the same claim the UI step above makes, asserted where it
      // cannot be a rendering artefact.
      for (const [i, line] of lines.entries()) {
        expect(
          Number(line.UnitPrice),
          `line ${i + 1} must carry a REAL price from the engine, not zero`,
        ).toBeGreaterThan(0);
      }

      await shot(page, '40-08c-children');
    });


    // ── 5. Read back through the GENERATED entity browser ───────────────────
    // Deliberately read back through a DIFFERENT surface than the one that wrote it. Re-reading through
    // the workspace could pass on nothing but client state still sitting in memory.
    await test.step('reads back with FKs resolved to names', async () => {
      await page.goto(`${EXPLORER_BASE_URL}/app/mjbizappssales`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5000);

      /**
       * CLOSE WHAT THE SHELL REOPENED BEFORE READING ANYTHING.
       *
       * Without this the step reads a restored RECORD tab and asserts a deal name against a pipeline's
       * detail view — which fails while looking like a save bug. It is also why this spec passed when
       * run alone and failed in the full suite: the earlier specs are what leave the records open.
       */
      if (await closeRestoredRecordTabs(page)) {
        await page.goto(`${EXPLORER_BASE_URL}/app/mjbizappssales`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(4000);
      }

      const deals = page.getByText(/^\s*Deals\s*$/i).first();
      await expect(deals).toBeVisible({ timeout: 25_000 });
      await deals.click();
      await page.waitForTimeout(5000);

      const body = await page.locator('body').innerText();
      expect(body, 'the saved deal must appear in the Deals grid').toContain(DEAL_NAME);
      await shot(page, '40-09-readback-grid');

      /**
       * FK RESOLUTION IS ASSERTED ON THE RECORD, NOT THE GRID.
       *
       * An earlier version looked for the pipeline name in the grid's text and failed — correctly, but
       * for an irrelevant reason: the Deals view ships with ONE visible column (Name), and the 54
       * others are hidden. Column visibility is per-user UI state that a database rebuild wipes, so a
       * grid-text assertion is really an assertion about whether `30-demo-setup-columns` has been run
       * since the last rebuild. The record view always renders every field, so that is where the claim
       * belongs.
       */
      /**
       * SCOPED TO A VISIBLE ROW, which this originally was not.
       *
       * The Sales section's roster stays in the DOM when you navigate away — hidden, not removed, so the
       * workspace's open documents survive a page change. Its rows are `<tr>` too, and they carry the deal
       * name. So an unscoped `tr, .ag-row, [role="row"]` filter can resolve to a HIDDEN roster row instead
       * of the entity-browser grid, and then fail on visibility while the grid beside it is perfectly
       * correct. It is timing-dependent — whether the roster happens to have loaded this deal decides it —
       * which is the worst kind of spec failure to read.
       *
       * `:visible` is the fix, and `title` excludes the roster explicitly: its rows are titled
       * "Open <name> in the workspace", which the entity browser's are not. Same trap `50-sales-shell`
       * documents for `.wl`; scope by page, always.
       */
      const row = page
        .locator('tr:visible, .ag-row:visible, [role="row"]:visible')
        .filter({ hasText: DEAL_NAME })
        .filter({ hasNot: page.locator('[title^="Open "]') })
        .first();
      await expect(row, 'a grid row for the new deal must exist').toBeVisible({ timeout: 20_000 });
      const link = row.locator('a').first();
      if (await link.count()) {
        await link.click({ timeout: 15_000 });
      } else {
        await row.click({ timeout: 15_000 });
      }
      await page.waitForTimeout(6000);

      const record = await page.locator('body').innerText();
      expect(record, 'the record view must show the deal').toContain(DEAL_NAME);
      // The pipeline's NAME, not its GUID — the FK-resolution half of the definition of done.
      expect(record, 'the pipeline FK must resolve to its name on the record').toContain(pipelineName);
      await shot(page, '40-10-readback-record');

      /**
       * THE CHILD COLLECTIONS, WHICH ARE COLLAPSED BY DEFAULT.
       *
       * The generated Deal form declares its related-entity sections with `isExpanded: false` — Deal
       * Lines included — so their contents are not in the DOM until the section is opened. An earlier
       * version asserted the line total against the page text and failed on a record that was
       * perfectly correct. Expanding first is the difference between testing the data and testing the
       * default accordion state.
       */
      await shot(page, '40-10b-readback-done');
    });

    // ── 6. The keystone ─────────────────────────────────────────────────────
    await test.step('console stayed clean', async () => {
      expectOnlyKnownErrors(sink, KNOWN_POST_DELETE_ERRORS, 'deal workspace run');
    });
  });
});
