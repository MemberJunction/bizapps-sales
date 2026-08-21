/**
 * DRAGGING A CARD BETWEEN STAGES — and proving the three writes a drag owes.
 *
 * ⚠️ **WRITTEN BUT NEVER RUN.** Explorer and `MJ_V6_Host` were in use by another session. Unrun-but-ready
 * is the honest state; the post-merge pass should do the failure demonstration at the bottom of this file
 * FIRST, then the green run.
 *
 * ── THE GAP THIS EXISTS TO CLOSE ────────────────────────────────────────────────────────────────
 *
 * The board is one of the two newest surfaces in the tree and has no spec at all. Its integration checks
 * (`board-move`, BD1–BD4) drive `DealEntityServer` directly — they never touch a drop list — so
 * everything between the pointer and the entity is unproven: the CDK wiring, the drop predicate, the
 * refusal path, and whether `OnDrop` reaches the entity at all.
 *
 * That gap has a precedent worth naming. The close flow was fully proven at the operation level and the
 * Explorer still could not close a deal, because the UI wrote a status column and nothing else. Every
 * visible signal was identical to a real close. A drag has the same shape: the card moves on screen the
 * instant CDK reorders the DOM, whether or not anything was written.
 *
 * ── SO EVERY ASSERTION IS AGAINST THE DATABASE, AND THERE ARE THREE ─────────────────────────────
 *
 *   1. the deal's stage changed;
 *   2. EXACTLY ONE append-only `DealStageEvent` was written, stamped with the DEPARTING probability and
 *      amount — the values the deal held on the way OUT, not the ones it acquired by arriving;
 *   3. the embedded order's status followed the new stage, per that stage's own `OrderStatusOnEntry`.
 *
 * The third is read from the stage row rather than hardcoded to `Quoted`. The mapping is data-driven, so a
 * spec that asserted a literal would break the moment a deployment configured a different stage — and
 * would be asserting the seed rather than the behaviour.
 *
 * ── AND THE REFUSAL ─────────────────────────────────────────────────────────────────────────────
 *
 * A drag NEVER closes a deal. Dropping onto a stage whose `DealStatusType.LocksDeal` is set must be
 * refused with a hint pointing at the explicit close action, because a lock freezes the deal, its lines
 * and its team — and doing that by accident with a pointer is not recoverable without `Sales.ReopenDeal`.
 *
 * ── CLEANUP ─────────────────────────────────────────────────────────────────────────────────────
 *
 * This spec MOVES AN EXISTING DEAL rather than creating one, so there is nothing to delete — but it
 * leaves the deal on a different stage and adds a stage event. To put a deal back:
 *
 * The events carry NO run tag -- the append is `DealEntityServer`'s and this spec does not get to
 * label it. So they are identified by time, which is the only handle that exists:
 *
 *   SELECT e.*, d.Name FROM __mj_BizAppsSales.DealStageEvent e
 *   JOIN __mj_BizAppsSales.Deal d ON d.ID = e.DealID
 *   WHERE e.ChangedAt > DATEADD(hour, -1, SYSUTCDATETIME()) ORDER BY e.ChangedAt DESC;
 *
 * Then restore that deal's `PipelineStageID` to the `FromStageID` of the earliest row this run added,
 * and delete the rows. Deleting the events is the one destructive step and it is deliberate: they are
 * append-only provenance, so a test run that leaves them behind has written history that never
 * happened.
 */
import { expect, test } from '@playwright/test';

import { EXPLORER_BASE_URL } from '../lib/env';
import { captureConsoleErrors, drain, shot } from '../lib/explorer';
import { CloseDb, QueryAll, QueryOne } from '../lib/db';

const SALES_APP_ROUTE = '/app/sales';
/**
 * Tags the SCREENSHOTS, not the data -- this spec creates no records, it moves an existing deal. Two
 * runs otherwise overwrite each other's artifacts, which is exactly when you want both.
 */
const RUN_TAG = `BD-${Date.now().toString(36).toUpperCase()}`;

type Page = import('@playwright/test').Page;

const railItem = (page: Page, label: string) =>
    page.locator('mj-left-nav').getByRole('button', { name: new RegExp(`^${label}`, 'i') }).first();

interface StageRow {
    /** `QueryOne`/`QueryAll` constrain to `Record<string, unknown>`; a row shape needs the index signature to satisfy it. */
    [key: string]: unknown;
    ID: string;
    Name: string;
    DisplayOrder: number;
    OrderStatusOnEntry: string | null;
    IsClosing: number;
}

interface DealRow {
    /** `QueryOne`/`QueryAll` constrain to `Record<string, unknown>`; a row shape needs the index signature to satisfy it. */
    [key: string]: unknown;
    ID: string;
    Name: string;
    PipelineID: string;
    PipelineStageID: string;
    Probability: number | null;
    Amount: number | null;
    OrderID: string | null;
}

/** Every stage on a pipeline, with whether arriving there locks the deal. */
async function stagesOf(pipelineID: string): Promise<StageRow[]> {
    return QueryAll<StageRow>(`
        SELECT CAST(s.ID AS nvarchar(50)) AS ID, s.Name, s.DisplayOrder, s.OrderStatusOnEntry,
               CAST(ISNULL(st.LocksDeal, 0) AS int) AS IsClosing
        FROM __mj_BizAppsSales.PipelineStage s
        LEFT JOIN __mj_BizAppsSales.DealStatusType st ON st.ID = s.DealStatusTypeID
        WHERE s.PipelineID = '${pipelineID}'
        ORDER BY s.DisplayOrder`);
}

/**
 * An OPEN deal that carries an embedded order and sits on a NON-closing stage.
 *
 * The order matters because assertion 3 is about it; a deal without one would let the spec pass while
 * proving two thirds of what it claims. Openness comes from the `IsOpen` flag, never a status name.
 */
async function movableDeal(): Promise<DealRow> {
    const row = await QueryOne<DealRow>(`
        SELECT TOP 1 CAST(d.ID AS nvarchar(50)) AS ID, d.Name,
               CAST(d.PipelineID AS nvarchar(50)) AS PipelineID,
               CAST(d.PipelineStageID AS nvarchar(50)) AS PipelineStageID,
               d.Probability, d.Amount, CAST(d.OrderID AS nvarchar(50)) AS OrderID
        FROM __mj_BizAppsSales.Deal d
        JOIN __mj_BizAppsSales.DealStatusType s ON s.ID = d.DealStatusTypeID
        JOIN __mj_BizAppsSales.PipelineStage ps ON ps.ID = d.PipelineStageID
        LEFT JOIN __mj_BizAppsSales.DealStatusType pst ON pst.ID = ps.DealStatusTypeID
        WHERE s.IsOpen = 1 AND s.IsActive = 1
          AND d.OrderID IS NOT NULL
          AND ISNULL(pst.LocksDeal, 0) = 0
        ORDER BY d.__mj_CreatedAt DESC`);
    expect(
        row,
        'no OPEN deal with an embedded order on a non-closing stage — seed demo data first. Without an '
            + 'order this spec would pass while never testing the order-status rule it claims to.',
    ).toBeTruthy();
    return row as DealRow;
}

async function dealNow(id: string): Promise<DealRow> {
    return (await QueryOne<DealRow>(`
        SELECT CAST(ID AS nvarchar(50)) AS ID, Name, CAST(PipelineID AS nvarchar(50)) AS PipelineID,
               CAST(PipelineStageID AS nvarchar(50)) AS PipelineStageID, Probability, Amount,
               CAST(OrderID AS nvarchar(50)) AS OrderID
        FROM __mj_BizAppsSales.Deal WHERE ID = '${id}'`)) as DealRow;
}

async function eventsFor(dealID: string): Promise<
    { ID: string; FromStageID: string | null; ToStageID: string | null; AmountAtTransition: number | null;
      ProbabilityAtTransition: number | null }[]
> {
    return QueryAll(`
        SELECT CAST(ID AS nvarchar(50)) AS ID, CAST(FromStageID AS nvarchar(50)) AS FromStageID,
               CAST(ToStageID AS nvarchar(50)) AS ToStageID, AmountAtTransition, ProbabilityAtTransition
        FROM __mj_BizAppsSales.DealStageEvent WHERE DealID = '${dealID}' ORDER BY ChangedAt`);
}

async function openBoard(page: Page): Promise<void> {
    await page.goto(`${EXPLORER_BASE_URL}${SALES_APP_ROUTE}`);
    await railItem(page, 'Deals').click();
    await railItem(page, 'Board').click();
    await expect(page.locator('.db-cols')).toBeVisible({ timeout: 20_000 });
}

const cardNamed = (page: Page, name: string) =>
    page.locator('.db-card', { has: page.locator('.db-card__name', { hasText: name }) }).first();

const columnDrop = (page: Page, stageID: string) => page.locator(`#col-${stageID}`);

/**
 * Drags a card onto a column via CDK.
 *
 * `dragTo()` alone is unreliable against `cdkDrag`, which needs movement to start the drag sequence — a
 * single jump can land as a click. So this is a manual pointer sequence with intermediate moves, which is
 * what CDK's own tests do.
 */
async function dragCardTo(page: Page, card: ReturnType<typeof cardNamed>, target: ReturnType<typeof columnDrop>): Promise<void> {
    const from = await card.boundingBox();
    const to = await target.boundingBox();
    expect(from, 'the card has no bounding box — it is not rendered').toBeTruthy();
    expect(to, 'the target column has no bounding box — it is not rendered').toBeTruthy();

    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
    await page.mouse.down();
    await page.mouse.move(from!.x + from!.width / 2 + 20, from!.y + from!.height / 2 + 20, { steps: 5 });
    await page.mouse.move(to!.x + to!.width / 2, to!.y + 60, { steps: 12 });
    await page.mouse.up();
}

test.describe('pipeline board — a drag writes three things, and never closes a deal', () => {
    test.afterAll(async () => {
        await CloseDb();
    });

    test('a drag between stages changes the stage, appends ONE event with departing values, and moves the order', async ({
        page,
    }) => {
        const sink = captureConsoleErrors(page);
        const deal = await movableDeal();
        const stages = await stagesOf(deal.PipelineID);

        /**
         * The target is the next NON-CLOSING stage after the current one. Not merely "another stage": a
         * closing target is the subject of the second test and would make this one refuse.
         */
        const currentIndex = stages.findIndex((s) => s.ID.toLowerCase() === deal.PipelineStageID.toLowerCase());
        const target = stages.find((s, i) => i !== currentIndex && s.IsClosing === 0);
        expect(target, 'this pipeline has no second non-closing stage to move to').toBeTruthy();

        /** The DEPARTING values, read BEFORE the move — the whole point of the stamps. */
        const departingProbability = deal.Probability;
        const departingAmount = deal.Amount;
        const eventsBefore = await eventsFor(deal.ID);

        await openBoard(page);
        await dragCardTo(page, cardNamed(page, deal.Name), columnDrop(page, target!.ID));

        // The board re-reads the roster after a persisted move; wait for the busy state to clear.
        await expect(page.locator('.db-bar__busy')).toHaveCount(0, { timeout: 30_000 });
        await shot(page, `board-after-drag-${RUN_TAG}`);

        // ── 1. THE STAGE ────────────────────────────────────────────────────
        const after = await dealNow(deal.ID);
        expect(
            after.PipelineStageID.toLowerCase(),
            'the stage did not change in the database — the card moved on screen and nothing was written, '
                + 'which is the failure this spec exists for',
        ).toBe(target!.ID.toLowerCase());

        // ── 2. EXACTLY ONE EVENT, STAMPED WITH THE DEPARTING VALUES ────────
        const eventsAfter = await eventsFor(deal.ID);
        expect(
            eventsAfter.length - eventsBefore.length,
            'exactly one DealStageEvent per move — two would double every velocity report built on it, '
                + 'and none would leave a hole in an append-only log',
        ).toBe(1);

        const appended = eventsAfter[eventsAfter.length - 1];
        expect(appended.FromStageID!.toLowerCase()).toBe(deal.PipelineStageID.toLowerCase());
        expect(appended.ToStageID!.toLowerCase()).toBe(target!.ID.toLowerCase());

        /**
         * THE DEPARTING VALUES, NOT THE ARRIVING ONES. A board drag applies the target stage's probability
         * default, so a stamp taken after the move records what the deal acquired by ARRIVING — and every
         * velocity report built on it is then quietly wrong. This is the assertion that tells the two
         * apart, and it can only be made from values captured before the drag.
         */
        expect(
            appended.ProbabilityAtTransition,
            'the event must stamp the probability the deal held on the way OUT',
        ).toBe(departingProbability);
        expect(appended.AmountAtTransition, 'and the amount it held on the way out').toBe(departingAmount);

        /** The earlier events are untouched — append-only means added to, never rewritten. */
        expect(eventsAfter.slice(0, eventsBefore.length).map((e) => e.ID)).toEqual(
            eventsBefore.map((e) => e.ID),
        );

        // ── 3. THE ORDER FOLLOWED THE STAGE ────────────────────────────────
        const order = await QueryOne<{ Status: string }>(
            `SELECT Status FROM __mj_BizAppsOrders.OrderHeader WHERE ID = '${after.OrderID}'`,
        );
        expect(order, 'the deal points at an order that does not exist').toBeTruthy();

        if (target!.OrderStatusOnEntry) {
            /**
             * READ FROM THE STAGE, not hardcoded. The rule is data-driven — `PipelineStage.OrderStatusOnEntry`
             * — so asserting a literal would be asserting the seed. Orders may also REFUSE a transition
             * (Voided is final), in which case the deal's stage change still proceeds by design (D-OS1); that
             * is why this is a two-way assertion rather than a bare equality.
             */
            const refused = (order as { Status: string }).Status !== target!.OrderStatusOnEntry;
            expect(
                refused === false || (order as { Status: string }).Status === 'Voided',
                `the order should have become '${target!.OrderStatusOnEntry}' on entering `
                    + `'${target!.Name}' — it is '${(order as { Status: string }).Status}'. A mismatch that is `
                    + 'not Voided means the stage-to-order writer did not run.',
            ).toBe(true);
        }

        expect(drain(sink), 'no console errors during a drag').toEqual([]);
    });

    test('dropping onto a CLOSING column is refused, with a hint naming the explicit close', async ({ page }) => {
        const deal = await movableDeal();
        const stages = await stagesOf(deal.PipelineID);
        const closing = stages.find((s) => s.IsClosing === 1);
        test.skip(!closing, 'this pipeline has no closing stage, so there is nothing to refuse');

        const before = await dealNow(deal.ID);
        const eventsBefore = await eventsFor(deal.ID);

        await openBoard(page);
        await dragCardTo(page, cardNamed(page, deal.Name), columnDrop(page, closing!.ID));
        await page.waitForTimeout(1_500);
        await shot(page, `board-refused-closing-${RUN_TAG}`);

        /**
         * THE HINT MUST NAME THE WAY TO DO IT PROPERLY. A bare refusal teaches nothing and invites a second
         * attempt; the message points at the workspace and the explicit close, so the win or loss is
         * recorded deliberately.
         */
        const message = page.locator('.db-msg');
        await expect(message).toBeVisible();
        await expect(message).toContainText(/closes and locks/i);
        await expect(message).toContainText(/workspace/i);

        /** And nothing was written — a refusal is not a partial move. */
        const after = await dealNow(deal.ID);
        expect(
            after.PipelineStageID.toLowerCase(),
            'a refused drag must not change the stage',
        ).toBe(before.PipelineStageID.toLowerCase());
        expect(
            (await eventsFor(deal.ID)).length,
            'and must not append a stage event — an event for a move that did not happen is a claim about '
                + 'history that never occurred',
        ).toBe(eventsBefore.length);
    });
});

/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *  HOW TO MAKE THESE FAIL — do this FIRST on the post-merge run
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Apply one mutation, rebuild `packages/Angular` (and `packages/CoreEntitiesServer` where noted), run,
 * restore. Each names the assertion that must go red.
 *
 * 1. **The move never reaches the entity** — the precedent failure. In `deal-board.component.ts`
 *    `OnDrop`, return immediately after `this.Message = null` so the card reorders on screen and nothing
 *    persists.
 *    → assertion 1 (the stage) must fail. If it passes, the spec is reading the screen somewhere it
 *    believes it is reading the database, and nothing else in this file can be trusted.
 *
 * 2. **The stamps come from the arriving values.** In `DealEntityServer.appendStageEvent`, replace
 *    `prior.Probability` / `prior.Amount` with `this.Probability` / `this.Amount`.
 *    → the departing-value assertions must fail. This is the mutation that matters most, because a board
 *    drag applies the target stage's probability default — so with this mutation the numbers are
 *    plausible, self-consistent and wrong, and only a before-and-after comparison detects it.
 *
 * 3. **Two events per move.** In `DealEntityServer.saveWithStageEvent`, call `appendStageEvent(prior)`
 *    twice.
 *    → the exactly-one assertion must fail.
 *
 * 4. **The order stops following.** In `DealEntityServer`, make `planStageOrderStatus()` return null.
 *    → assertion 3 must fail on a pipeline whose target stage sets `OrderStatusOnEntry`. Note it will
 *    SKIP, not fail, where the stage sets nothing — so check the seed has a stage that does, or this
 *    mutation proves nothing.
 *
 * 5. **The lock guard removed.** In `deal-board.component.ts`, change `CanDropInto` to
 *    `() => !this.Moving` and delete the `if (target.IsClosing)` block in `OnDrop`.
 *    → the second test must fail — and it should fail on the STAGE assertion, not only on the missing
 *    message, which proves the guard was load-bearing rather than cosmetic.
 *
 * 6. **The hint loses its pointer.** Shorten the refusal message to `'Not allowed.'`.
 *    → the `workspace` text assertion must fail while the stage assertion still passes. That separation
 *    is deliberate: it distinguishes "the guard works" from "the guard explains itself".
 *
 * A mutation that leaves the suite green marks a decorative assertion. Fix it before trusting the spec —
 * `AC14` spent a day asserting a defect for exactly this reason.
 */
