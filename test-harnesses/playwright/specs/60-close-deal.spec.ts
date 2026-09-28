/**
 * CLOSING A DEAL THROUGH THE UI — and proving the close actually happened.
 *
 * ── THE GAP THIS EXISTS TO CLOSE ────────────────────────────────────────────────────────────────
 *
 * The close flow was fully built and tested at the operation level — 46 integration checks, the
 * Confirmed/Draft policy contrast proven — and the Explorer still could not close a deal. Setting the
 * Status dropdown to a winning status and saving wrote the status column and NOTHING else: no routing,
 * no order, no stage event, no lock. The screen said "Deal saved." and the deal read Won.
 *
 * Every visible signal was identical to a real close. That is exactly why no test caught it: an
 * API-level check closes through the operation and passes, and a UI-level check that only reads the
 * screen sees a deal marked Won and passes too. The only thing that can tell a real close from a
 * status write is the database — hence `lib/db.ts`.
 *
 * SO THE FIRST TEST HERE IS THE POINT OF THE WHOLE FILE: close through the UI, then assert against the
 * database that a STAGE EVENT WAS APPENDED and the DEAL IS LOCKED.
 *
 * ── WHAT ELSE IT PINS ───────────────────────────────────────────────────────────────────────────
 *
 *   · a closed deal renders its frozen fields READ-ONLY;
 *   · close-lost without a reason cannot be confirmed, and closes once one is chosen;
 *   · reopen unlocks, and the close event SURVIVES (append-only).
 *
 * ── THE SURFACE IS THE DEAL FORM'S CLOSE PANEL (#88) ────────────────────────────────────────────
 *
 * This drove the deal workspace, which nothing mounts any more. The close now lives in the Deal form's
 * Close panel (`mjs-deal-close-panel`), driven through `lib/deal-flow.ts`. Closing targets are chosen by
 * status FLAG from the database, never by name.
 *
 * Deals are tagged `Close CL-<base36 timestamp>` so re-runs cannot collide; `afterAll` removes this
 * run's deals.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { captureConsoleErrors, expectOnlyKnownErrors, shot } from '../lib/explorer';
import { CloseDb, DealByName, QueryAll, QueryOne, StageEventsFor } from '../lib/db';
import { AddLines, CloseWon, ComposeDeal, PurgeDeal, ReopenDeal } from '../lib/deal-flow';
import { ByTestId, DealForm, EditDeal, FieldIsEditable, OpenSection } from '../lib/deal-form';

const RUN_TAG = `CL-${Date.now().toString(36).toUpperCase()}`;

/**
 * Builds a saved, line-carrying deal through the Deal form and returns its name.
 *
 * A LINE IS NOT OPTIONAL here: a header-only deal would close successfully with nothing to route, and
 * the stamps asserted below would be taken from a deal that never carried anything.
 *
 * The B2B pipeline is asked for by search text, as before: it decides the selling company, and the
 * company decides the product catalogue. `ComposeDeal` also picks a customer — `Sales.CloseDeal`
 * refuses a won deal with no account, because an order needs a payer.
 */
async function createDealWithLine(page: Page, suffix: string): Promise<string> {
    const name = `Close ${RUN_TAG} ${suffix}`;
    const composed = await ComposeDeal(page, name, 'B2B');
    const lines = await AddLines(page, composed.OrderID, 1);
    expect(lines, `fixture: "${name}" must carry a line before it is closed`).toBeGreaterThan(0);

    // Confirm the ROW before any test builds on it. A fixture returning the name of a deal that was
    // never persisted turns every later assertion into "Cannot read properties of undefined".
    const saved = await DealByName(name);
    expect(saved, `fixture: "${name}" reported saved but no row exists`).toBeTruthy();
    return name;
}

/** The close panel's outcome message, once it is showing. */
function closeMessage(page: Page): Locator {
    return DealForm(page).locator('[data-testid="close-message"]:visible').first();
}

/** The first active LOST status that locks, by rank — chosen by flag, never by name. */
async function lostStatusID(): Promise<string> {
    const row = await QueryOne<{ ID: string }>(
        `SELECT TOP 1 ID FROM __mj_BizAppsSales.DealStatusType
          WHERE IsActive = 1 AND IsLost = 1 AND LocksDeal = 1 ORDER BY DisplayRank`,
    );
    expect(row?.ID, 'the host needs an active locking status with IsLost = 1').toBeTruthy();
    return String(row!.ID);
}

/**
 * Removes this run's deals. `PurgeByPrefix` is unavailable — it refuses any prefix not starting with
 * `PW-` — so they are resolved by THIS run's tag and handed to `PurgeDeal`, which removes children
 * first. Scoped to the run tag so a concurrent run's rows are never touched.
 */
test.afterAll(async () => {
    const deals = await QueryAll<{ ID: string; OrderID: string | null }>(
        `SELECT ID, OrderID FROM __mj_BizAppsSales.Deal WHERE Name LIKE 'Close ${RUN_TAG} %'`,
    );
    for (const d of deals) {
        await PurgeDeal(d.ID, d.OrderID ? String(d.OrderID) : null);
    }
    await CloseDb();
});

test.describe('closing a deal through the Explorer', () => {
    test('a UI close appends a STAMPED stage event and locks the deal', async ({ page }) => {
        test.setTimeout(420_000);
        const errors = captureConsoleErrors(page);
        const name = await createDealWithLine(page, 'won');

        await CloseWon(page);
        await shot(page, 'close-won-result');

        /**
         * THE ASSERTIONS THE SCREEN CANNOT MAKE.
         *
         * Before the close action existed, the deal below would have read Won and every one of these
         * would have failed — which is precisely the state that shipped unnoticed.
         */
        const deal = await DealByName(name);
        expect(deal, 'the deal must exist').toBeTruthy();
        expect(deal!.IsWon, 'the deal must be in a WON status').toBe(true);
        expect(deal!.LocksDeal, 'a won deal must be locked').toBe(true);

        const events = await StageEventsFor(deal!.ID);
        expect(
            events.length,
            'closing must APPEND a stage event — without it the close has no provenance',
        ).toBeGreaterThan(0);

        /**
         * ── THE STAMPS, WHICH ARE THE REASON THE ROW IS KEPT ────────────────────────────────────
         *
         * Counting events proves something was written, not that it is worth having.
         * `AmountAtTransition` and `ProbabilityAtTransition` are what make "what did we think the
         * forecast was on the 1st" answerable after the amounts move — Rule 3's payload — and an event
         * written with nulls in them satisfies a count and answers nothing.
         *
         * Not compared to an expected figure: the amount comes from the engine and this repo does not
         * know it. What is asserted is that the stamps carry REAL values.
         */
        const closeEvent = events[0];
        expect(
            closeEvent.AmountAtTransition,
            'the close event must stamp the amount the deal held on the way out — a null stamp is a '
            + 'row that answers no question later',
        ).not.toBeNull();
        expect(
            Number(closeEvent.AmountAtTransition),
            'and that amount must be a real figure, not zero',
        ).toBeGreaterThan(0);

        expect(
            closeEvent.ProbabilityAtTransition,
            'the close event must stamp the probability it held on the way out',
        ).not.toBeNull();
        const prob = Number(closeEvent.ProbabilityAtTransition);
        expect(prob, 'and that probability must be in range').toBeGreaterThanOrEqual(0);
        expect(prob, 'and that probability must be in range').toBeLessThanOrEqual(100);

        // WHERE IT WENT: a close event that records no destination cannot reconstruct the path.
        expect(
            closeEvent.ToStageID,
            'the close event must record the stage the deal moved INTO',
        ).not.toBeNull();

        /**
         * No order-creation assertion: `docs/DECISIONS.md` D-OS1 provisions the order with the deal on
         * first save, not at close, and `close-won-order.CO3` asserts what a close does to it.
         *
         * THE USER IS TOLD WHAT HAPPENED. The workspace had a routing summary (`close-routing`); the
         * form's equivalent is the panel's outcome message, which renders outside the close gate so it
         * survives the refresh that locks the deal. It must be there and must not be an error.
         */
        await expect(closeMessage(page), 'the close must report its outcome on the form').toBeVisible();
        await expect(closeMessage(page), 'and the outcome must not be an error').not.toHaveClass(/is-error/);
        expectOnlyKnownErrors(errors, [], 'close through the UI');
    });

    test('a closed deal renders its frozen fields read-only', async ({ page }) => {
        test.setTimeout(420_000);
        const name = await createDealWithLine(page, 'readonly');

        await CloseWon(page);

        /**
         * THE LOCK IS SHOWN. The hero's Locked chip, rather than its lock notice: the notice sits in the
         * collapsible briefing, and Collapsed is a persisted per-user setting.
         */
        await expect(
            DealForm(page).locator('.mjs-deal-hero__chip .fa-lock').first(),
            'a locked deal must say so',
        ).toBeVisible({ timeout: 20_000 });

        /**
         * FROZEN FIELDS RENDER READ-ONLY EVEN IN EDIT MODE, rather than being refused later. Name and
         * Pipeline are both outside `DEAL_FIELDS_EDITABLE_WHILE_LOCKED`.
         *
         * Status is NOT asserted frozen any more: on the form it is deliberately reachable on a closed
         * deal, as the audited door to a reopen (golive#205), where the workspace disabled it.
         */
        await EditDeal(page);
        expect(await FieldIsEditable(page, 'Name'), 'the deal name is frozen on a closed deal').toBe(false);
        expect(await FieldIsEditable(page, 'PipelineID'), 'the pipeline is frozen on a closed deal').toBe(false);

        const deal = await DealByName(name);
        expect(deal!.LocksDeal).toBe(true);
    });

    test('close-lost cannot be confirmed without a reason, and closes with one', async ({ page }) => {
        test.setTimeout(420_000);
        const name = await createDealWithLine(page, 'lost');

        await OpenSection(page, 'close');
        await ByTestId(page, 'close-open').click();
        const panel = ByTestId(page, 'close-panel');
        await expect(panel, 'the close panel must open').toBeVisible({ timeout: 20_000 });

        // Choose the LOST target by the status row's ID, matched case-insensitively.
        const lostID = await lostStatusID();
        const radios = panel.locator('[data-testid="close-target"]');
        const values = await radios.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
        const index = values.findIndex((v) => v.toLowerCase() === lostID.toLowerCase());
        expect(index, `the close panel must offer the lost status ${lostID}; it offers ${values.join(', ')}`)
            .toBeGreaterThanOrEqual(0);
        await radios.nth(index).check();

        /**
         * THE REFUSAL HAPPENS BEFORE THE ROUND TRIP. The workspace let the confirm through and reported
         * the operation's refusal; the form's `CanConfirm` withholds the button until a reason is chosen.
         * `Sales.CloseDeal` still enforces the same rule for every other caller.
         */
        const confirm = ByTestId(page, 'close-confirm');
        await expect(confirm, 'a lost close without a reason must not be confirmable').toBeDisabled();
        const stillOpen = await DealByName(name);
        expect(stillOpen!.IsLost, 'a refused close must NOT have closed the deal').toBe(false);

        // Now supply one: the first real option the panel's own picker offers.
        const reason = ByTestId(page, 'close-loss-reason');
        await expect(reason, 'closing as lost must demand a loss reason').toBeVisible({ timeout: 20_000 });
        const reasons = (await reason.locator('option').allTextContents())
            .map((o) => o.trim())
            .filter((o) => o && !o.startsWith('—'));
        expect(reasons.length, 'the loss-reason picker must offer a reason').toBeGreaterThan(0);
        await reason.selectOption({ label: reasons[0] });

        // Rendered only when the chosen reason declares RequiresNotes.
        const notes = ByTestId(page, 'close-loss-notes');
        if (await notes.isVisible().catch(() => false)) {
            await notes.fill('Lost on price during the dry run.');
        }

        await expect(confirm, 'with a reason the close must be confirmable').toBeEnabled({ timeout: 10_000 });
        await confirm.click();
        await expect(ByTestId(page, 'reopen-open'), 'a closed deal must offer Reopen').toBeVisible({
            timeout: 60_000,
        });

        const closed = await DealByName(name);
        expect(closed!.IsLost, 'with a reason the close must succeed').toBe(true);
    });

    test('reopen with a reason unlocks the deal, and the close event survives', async ({ page }) => {
        test.setTimeout(420_000);
        const name = await createDealWithLine(page, 'reopen');

        await CloseWon(page);

        const closed = await DealByName(name);
        const eventsAfterClose = await StageEventsFor(closed!.ID);

        await ReopenDeal(page, 'Customer returned to renegotiate the term.');

        const reopened = await DealByName(name);
        expect(reopened!.LocksDeal, 'a reopened deal must no longer be locked').toBe(false);

        /**
         * PROVENANCE IS PEN, NOT PENCIL. Reopening ADDS an event; it never removes the close. If this
         * ever shrinks, history is being rewritten.
         */
        const eventsAfterReopen = await StageEventsFor(reopened!.ID);
        expect(eventsAfterReopen.length).toBeGreaterThanOrEqual(eventsAfterClose.length + 1);
    });
});
