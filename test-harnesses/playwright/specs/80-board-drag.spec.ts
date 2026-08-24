/**
 * DRAGGING A CARD BETWEEN STAGES — and proving the three writes a drag owes.
 *
 * **STATUS: RUN AND GREEN.** Three consecutive passes when the rework landed — 13.0s, 15.4s, 12.8s. The
 * header said "WRITTEN BUT NEVER RUN" for two rounds after that stopped being true, which is its own small
 * lesson: a status written into a file ages badly, because nothing forces it to agree with a run. It is
 * corrected here rather than deleted so the next person can see how long a stale claim survived.
 *
 * The failure demonstration at the bottom of this file has NOT been re-worked since the rework, so the
 * mutations there are the part still owed.
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
import { ComposeDeal } from '../lib/deal-flow';

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
/**
 * ── THIS SPEC DRAGS ITS OWN DEAL NOW, AND THAT IS A CORRECTNESS FIX RATHER THAN TIDYING ─────────────
 *
 * It used to pick the newest OPEN seeded deal and drag that. Every run therefore moved a real demo deal
 * and appended `DealStageEvent` rows to it — and `DealStageEvent` is APPEND-ONLY by design, so no
 * teardown can ever remove them. The host's event count grew by two per run and the seeded deal ended
 * wherever the last drag left it. No better sweep can fix that: the rows are permanent on purpose.
 *
 * A spec that creates its own deal does not have the property at all. The deal carries the harness
 * prefix, so `cleanup.mjs` reaches it, and its events go with it when it is deleted — provenance for a
 * deal that no longer exists is not a problem, provenance welded to demo data is.
 *
 * ── CREATED THROUGH THE WORKSPACE, NOT BY INSERT ───────────────────────────────────────────────────
 *
 * `ComposeDeal` drives the real UI, so the deal arrives with the embedded order that
 * `DealEntityServer.Save()` provisions. A raw INSERT would be faster and would produce a deal with no
 * order — and this spec asserts that a drag MOVES THE ORDER, so it would pass while testing nothing,
 * which is exactly the failure mode the old helper's own error message warned about.
 */
async function movableDeal(page: Page): Promise<DealRow> {
    const name = `${RUN_TAG} board drag subject`;
    await ComposeDeal(page, name);

    const row = await QueryOne<DealRow>(`
        SELECT TOP 1 CAST(d.ID AS nvarchar(50)) AS ID, d.Name,
               CAST(d.PipelineID AS nvarchar(50)) AS PipelineID,
               CAST(d.PipelineStageID AS nvarchar(50)) AS PipelineStageID,
               d.Probability, d.Amount, CAST(d.OrderID AS nvarchar(50)) AS OrderID
        FROM __mj_BizAppsSales.Deal d
        JOIN __mj_BizAppsSales.DealStatusType s ON s.ID = d.DealStatusTypeID
        JOIN __mj_BizAppsSales.PipelineStage ps ON ps.ID = d.PipelineStageID
        LEFT JOIN __mj_BizAppsSales.DealStatusType pst ON pst.ID = ps.DealStatusTypeID
        WHERE d.Name = '${name}'
          AND s.IsOpen = 1 AND s.IsActive = 1
          AND d.OrderID IS NOT NULL
          AND ISNULL(pst.LocksDeal, 0) = 0`);
    expect(
        row,
        `the deal this spec just created ("${name}") is not readable as an OPEN deal with an embedded `
            + 'order on a non-closing stage. Without an order the drag would pass while never testing the '
            + 'order-status rule it claims to.',
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
    /**
     * NO 'Deals' HOP. `mj-left-nav` renders the SUB-PAGES of the sales section — Dashboard, All deals,
     * Board, Workspace (`sales-nav.model.ts:75-78`). The 'Deals' entry at line 64 of that same file is
     * the APP-level item and lives on a different surface entirely, so clicking for it inside
     * `mj-left-nav` waits thirty seconds and times out. The route already lands in the section.
     */
    await railItem(page, 'Board').click();
    await expect(page.locator('.db-cols')).toBeVisible({ timeout: 20_000 });
}

const cardNamed = (page: Page, name: string) =>
    page.locator('.db-card', { has: page.locator('.db-card__name', { hasText: name }) }).first();

/**
 * ── BY aria-label, BECAUSE `#col-<stageID>` DOES NOT EXIST ──────────────────────────────────────────
 *
 * This was `page.locator('#col-' + stageID)` and the board renders no such id: the column is
 * `<section class="db-col" [attr.aria-label]="column.Label">` with no id attribute at all. So the
 * locator resolved to nothing and `boundingBox()` spent thirty seconds timing out — which is what made
 * this spec look flaky rather than broken, because the timeout lands in a helper two frames from the
 * assertion that reports it.
 *
 * The column is addressed by the label it already publishes for accessibility, so no product change is
 * needed to make the board testable. Taking the stage's NAME rather than its id follows from that, and
 * the caller resolves the name from the same row it resolved the id from.
 */
const columnDrop = (page: Page, stageName: string) =>
    page.locator('.db-col').filter({ has: page.locator('.db-col__name', { hasText: stageName }) }).first();

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
        const deal = await movableDeal(page);
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
        await dragCardTo(page, cardNamed(page, deal.Name), columnDrop(page, target!.Name));

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

    test('a CLOSING column cannot be entered at all, and says why on the column itself', async ({ page }) => {
        const deal = await movableDeal(page);
        const stages = await stagesOf(deal.PipelineID);
        const closing = stages.find((s) => s.IsClosing === 1);
        test.skip(!closing, 'this pipeline has no closing stage, so there is nothing to refuse');

        const before = await dealNow(deal.ID);
        const eventsBefore = await eventsFor(deal.ID);

        await openBoard(page);
        await dragCardTo(page, cardNamed(page, deal.Name), columnDrop(page, closing!.Name));
        await page.waitForTimeout(1_500);
        await shot(page, `board-refused-closing-${RUN_TAG}`);

        /**
         * THE HINT MUST NAME THE WAY TO DO IT PROPERLY. A bare refusal teaches nothing and invites a second
         * attempt; the message points at the workspace and the explicit close, so the win or loss is
         * recorded deliberately.
         */
        /**
         * ── THE BOARD PREVENTS THE DROP; IT DOES NOT REFUSE IT AFTERWARDS ────────────────────────────
         *
         * This asserted a `.db-msg` naming the explicit close, and it failed three runs in a row — a
         * consistent red, so actionable rather than flake. The reason is that the assertion described the
         * wrong mechanism, and the better one:
         *
         *     [cdkDropListEnterPredicate]="CanDropInto(column)"
         *     CanDropInto = (column) => () => !column.IsClosing && !this.Moving;
         *
         * CDK therefore refuses to let the card ENTER a closing column, `cdkDropListDropped` never fires,
         * `OnDrop` never runs, and no message is set. `OnDrop`'s own `if (target.IsClosing)` block is
         * labelled "belt and braces" in the source precisely because the predicate already handled it — so
         * the only path that produces the message is one the UI cannot reach.
         *
         * A card that will not enter is clearer to a rep than one that snaps back with an error, so the
         * design is right and the spec was wrong. What IS asserted now is what the app actually guarantees:
         * the deal does not move, and the column carries a permanent explanation rather than a transient
         * one.
         */
        const lockHint = page
            .locator('.db-col')
            .filter({ has: page.locator('.db-col__name', { hasText: closing!.Name }) })
            .locator('.db-col__lock');
        await expect(
            lockHint,
            'the closing column must carry the lock affordance — it is the standing hint that replaces the '
                + 'message a prevented drop never produces',
        ).toBeVisible();
        await expect(lockHint).toHaveAttribute('title', /closes and locks/i);
        await expect(lockHint).toHaveAttribute('title', /workspace/i);

        // And no transient message either, because nothing was dropped.
        await expect(
            page.locator('.db-msg'),
            'a prevented drop reports nothing, because OnDrop never ran',
        ).toHaveCount(0);

        /**
         * ── THE GUARANTEE IS "NEVER LANDS IN A CLOSING STAGE", NOT "DOES NOT MOVE AT ALL" ────────────
         *
         * The first version asserted the stage was byte-identical afterwards, and it failed: the stage HAD
         * changed. That is not a defect, it is how CDK works. A horizontal board puts other droppable
         * columns between the card and the closing one, and a drag that crosses them leaves the card in the
         * last container that ACCEPTED it. Dragging past Negotiation to reach Signed legitimately lands the
         * card in Negotiation.
         *
         * So asserting "unchanged" was really asserting a pointer path, and it would keep breaking as
         * columns were reordered. The property the app actually promises — and the one the rule cares
         * about — is that a drag can never put a deal in a CLOSING stage, and can never close one. That
         * holds regardless of what the pointer crossed on the way.
         */
        const after = await dealNow(deal.ID);
        expect(
            after.PipelineStageID.toLowerCase(),
            'a drag must NEVER land a deal in a closing stage — closing is Sales.CloseDeal, an explicit act',
        ).not.toBe(closing!.ID.toLowerCase());

        // Resolved from the stage list this test already loaded, rather than a new query.
        const landed = stages.find((x) => x.ID.toLowerCase() === after.PipelineStageID.toLowerCase());
        expect(landed, 'the deal must be in a stage this pipeline actually owns').toBeTruthy();
        expect(
            landed!.IsClosing,
            'and whatever column it did land in must be a non-closing one, so nothing locked the deal',
        ).toBe(0);

        /**
         * The event count may legitimately have grown by one, if the card came to rest in an intermediate
         * column — that IS a real move and owes provenance. What must not happen is an event naming the
         * closing stage as its destination.
         */
        const events = await eventsFor(deal.ID);
        expect(
            events.filter((e) => String(e.ToStageID ?? '').toLowerCase() === closing!.ID.toLowerCase()).length,
            'no stage event may record a transition INTO the closing stage',
        ).toBe(0);
        expect(
            events.length - eventsBefore.length,
            'and at most one event, for at most one landing',
        ).toBeLessThanOrEqual(1);
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
 * 3. **Two events per move.** In `DealEntityServer.saveWithinScope`, duplicate the
 *    `await this.appendStageEvent(work.stageMove)` call (:393).
 *    → the exactly-one assertion must fail.
 *
 * 4. **The order stops following.** In `DealEntityServer`, make `planStageOrderStatus()` return null.
 *    → assertion 3 must fail on a pipeline whose target stage sets `OrderStatusOnEntry`. Note it will
 *    SKIP, not fail, where the stage sets nothing — so check the seed has a stage that does, or this
 *    mutation proves nothing.
 *
 * 5. **The lock guard removed.** In `deal-board.component.ts`, change `CanDropInto` to
 *    `() => !this.Moving`. Deleting `OnDrop`'s `if (target.IsClosing)` block as well is optional and
 *    proves nothing on its own: that block is unreachable from the UI while the predicate stands, which
 *    is why this test asserts the PREVENTION and the column's own lock hint rather than a message.
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
