/**
 * @fileoverview The full deal lifecycle through the browser, asserted against the database at every step.
 *
 * ── WHY THIS SPEC IS THE PRIORITY ───────────────────────────────────────────────────────────────
 *
 * The previous Explorer coverage was create, save and reopen. That is precisely why a close-won flow
 * that never invoked its own operation survived for days: nothing had ever driven a close through a
 * browser, so nothing noticed that the button did not reach `Sales.CloseDeal`.
 *
 * Every step below therefore asserts a ROW, not a rendering:
 *
 *   create      -> an OrderHeader exists, Draft, CompanyID from the pipeline, bill-to from the account
 *   add lines   -> OrderLine rows exist with a UnitPrice sales never sent
 *   stage move  -> the order's status became Quoted because the STAGE declared it
 *   close won   -> the order is UNCHANGED, both tasks exist and are linked to the ORDER, and a contract
 *                  exists with a CTR- number, the provenance pair, and no dates so it displays Draft
 *
 * ── THE ASSERTION THAT MATTERS MOST IS A NEGATIVE ───────────────────────────────────────────────
 *
 * Closed Won must NOT touch the order. That is what lets finance review and correct before the Confirm
 * that books the ledger, and it is the sort of rule an eager implementation breaks while looking correct.
 *
 * ── HOW TO MAKE IT FAIL ─────────────────────────────────────────────────────────────────────────
 *
 * In `CloseDealOperation`, wrap the task step's `if (target.IsWon)` as `if (false && target.IsWon)`. The
 * two task assertions fail and nothing else does. For the contract half, point the pipeline's
 * `CloseWonPolicy.ContractTypeCode` at a name contracts does not ship: the contract assertions fail with
 * the route's own reason. Both were used to prove this spec is not vacuous.
 */
import { expect, test } from '@playwright/test';

import { captureConsoleErrors, expectNoConsoleErrors } from '../lib/explorer';
import { QueryAll, QueryOne } from '../lib/db';
import { AddLines, AssertBaseline, ComposeDeal, PurgeDeal } from '../lib/deal-flow';
import { SelectFor, SelectByLabel, SaveDeal, OpenPane } from '../lib/workspace';

const RUN = `PW-LIFE-${Date.now().toString(36)}`;
let dealID = '';
let orderID = '';

test.describe('lifecycle — create, price, advance, close won', () => {
    test.afterAll(async () => {
        if (dealID) {
            await PurgeDeal(dealID, orderID || null);
        }
        const left = await QueryOne<{ N: number }>(
            `SELECT COUNT(*) AS N FROM __mj_BizAppsSales.Deal WHERE Name LIKE '${RUN}%'`,
        );
        expect(Number(left?.N ?? -1), 'the deal this spec created must be gone').toBe(0);
        await AssertBaseline();
    });

    test('every step writes the row it claims to', async ({ page }) => {
        test.setTimeout(900_000);
        const sink = captureConsoleErrors(page);

        /**
         * THE B2B PIPELINE BY POLICY, not by name. Close-won only creates a contract where the
         * pipeline's `CloseWonPolicy` says `CreateContract: true`, and picking the pipeline by its label
         * would silently test the D2C path the day the seed reorders them.
         */
        const pipeline = await QueryOne<{ Name: string; CompanyID: string }>(`
            SELECT TOP 1 Name, CompanyID FROM __mj_BizAppsSales.Pipeline
             WHERE IsActive = 1 AND ISJSON(CloseWonPolicy) = 1
               AND JSON_VALUE(CloseWonPolicy, '$.CreateContract') = 'true'
             ORDER BY DisplayRank`);
        expect(pipeline?.Name, 'a contract-creating pipeline is required for the close-won half').toBeTruthy();

        // ── 1. CREATE ───────────────────────────────────────────────────────
        const composed = await ComposeDeal(page, `${RUN} lifecycle`, pipeline!.Name);
        dealID = composed.DealID;
        orderID = composed.OrderID;

        const order = await QueryOne<{
            Status: string;
            CompanyID: string;
            BillToOrganizationID: string | null;
        }>(`
            SELECT Status, CompanyID, BillToOrganizationID
              FROM __mj_BizAppsOrders.OrderHeader WHERE ID = '${orderID}'`);
        expect(order, 'the embedded order must exist in orders, not merely be referenced').toBeTruthy();
        expect(String(order!.Status), 'a new deal\'s order starts in Draft').toBe('Draft');
        expect(
            String(order!.CompanyID).toLowerCase(),
            'and its CompanyID comes from the PIPELINE — the deal never chooses the selling company',
        ).toBe(String(pipeline!.CompanyID).toLowerCase());

        const deal = await QueryOne<{ AccountID: string | null }>(
            `SELECT AccountID FROM __mj_BizAppsSales.Deal WHERE ID = '${dealID}'`,
        );
        expect(
            String(order!.BillToOrganizationID ?? '').toLowerCase(),
            'and its bill-to is the deal\'s account, which is an Organization on the same UUID',
        ).toBe(String(deal!.AccountID ?? '').toLowerCase());

        // ── 2. LINES, PRICED BY ORDERS ──────────────────────────────────────
        const lineCount = await AddLines(page, orderID, 2);
        expect(lineCount, 'two catalogue lines must exist on the ORDER — the deal holds none').toBe(2);

        const lines = await QueryAll<{ UnitPrice: number | null; CompanyID: string | null }>(
            `SELECT UnitPrice, CompanyID FROM __mj_BizAppsOrders.OrderLine WHERE OrderHeaderID = '${orderID}'`,
        );
        for (const l of lines) {
            /**
             * SALES SENT PRODUCT AND QUANTITY AND NOTHING ELSE. `UnitPrice` is stamped by
             * `OrderLineEntityServer` from the product; a null here would mean the price never came back
             * and the app is showing a line it cannot cost.
             */
            expect(
                Number(l.UnitPrice ?? 0),
                'every line must carry an engine-set UnitPrice that sales never sent',
            ).toBeGreaterThan(0);
            expect(l.CompanyID, 'and a CompanyID orders stamped from the product').toBeTruthy();
        }

        // ── 3. ADVANCE THE STAGE, and the order follows ─────────────────────
        /**
         * The target stage is chosen by what it DECLARES, not by being called Proposal: the mechanism is
         * `PipelineStage.OrderStatusOnEntry`, and a spec keyed on the label would stop testing it the
         * moment a deployment renamed the stage — which is the whole point of the vocabulary rule.
         */
        const quoting = await QueryOne<{ Name: string }>(`
            SELECT TOP 1 Name FROM __mj_BizAppsSales.PipelineStage
             WHERE PipelineID = (SELECT PipelineID FROM __mj_BizAppsSales.Deal WHERE ID = '${dealID}')
               AND IsActive = 1 AND OrderStatusOnEntry = 'Quoted'
             ORDER BY DisplayOrder`);
        expect(quoting?.Name, 'the pipeline must have a stage that declares Quoted').toBeTruthy();

        await OpenPane(page, 'Party info');
        await SelectByLabel(page, 'Stage', quoting!.Name);
        await SaveDeal(page);

        const afterMove = await QueryOne<{ Status: string }>(
            `SELECT Status FROM __mj_BizAppsOrders.OrderHeader WHERE ID = '${orderID}'`,
        );
        expect(
            String(afterMove!.Status),
            'entering a stage that declares Quoted must move the ORDER — the stage is the writer',
        ).toBe('Quoted');

        // ── 4. CLOSE WON ────────────────────────────────────────────────────
        const closeBtn = page.getByRole('button', { name: /Close deal|Close won|Close/i }).first();
        await expect(closeBtn, 'the workspace must offer an explicit close action').toBeVisible({
            timeout: 30_000,
        });
        await closeBtn.click();
        await page.waitForTimeout(1_000);

        const wonStatus = await QueryOne<{ Name: string }>(
            `SELECT TOP 1 Name FROM __mj_BizAppsSales.DealStatusType WHERE IsWon = 1 AND IsActive = 1`,
        );
        const outcome = page.locator('.dw-close select, .dw-field select').filter({ hasText: /./ }).first();
        if (await outcome.isVisible().catch(() => false)) {
            await outcome.selectOption({ label: String(wonStatus!.Name) }).catch(() => undefined);
        }
        await page.getByRole('button', { name: /^(Close|Confirm|Close deal)$/i }).last().click();
        await page.waitForTimeout(6_000);

        const closed = await QueryOne<{ IsWon: boolean; OrderStatus: string; ContractID: string | null }>(`
            SELECT t.IsWon, o.Status AS OrderStatus, d.ContractID
              FROM __mj_BizAppsSales.Deal d
              JOIN __mj_BizAppsSales.DealStatusType t ON t.ID = d.DealStatusTypeID
              LEFT JOIN __mj_BizAppsOrders.OrderHeader o ON o.ID = d.OrderID
             WHERE d.ID = '${dealID}'`);
        expect(closed!.IsWon, 'the deal must land in a status carrying IsWon').toBe(true);

        // THE NEGATIVE THAT MATTERS: close-won must not touch the order.
        expect(
            String(closed!.OrderStatus),
            'Closed Won must leave the order UNCHANGED and editable — finance corrects it before the ' +
                'Confirm that books the ledger',
        ).toBe('Quoted');

        // ── 5. THE TASKS, LINKED TO THE ORDER ───────────────────────────────
        const links = await QueryAll<{ TaskName: string; RecordID: string; EntityName: string }>(`
            SELECT t.Name AS TaskName, tl.RecordID, e.Name AS EntityName
              FROM __mj_BizAppsTasks.TaskLink tl
              JOIN __mj_BizAppsTasks.Task t ON t.ID = tl.TaskID
              JOIN __mj.Entity e ON e.ID = tl.EntityID
             WHERE tl.RecordID IN ('${dealID}', '${orderID}')`);
        expect(links.length, 'the close must raise finance tasks').toBeGreaterThan(0);

        const orderLinked = links.filter((l) => l.RecordID.toLowerCase() === orderID.toLowerCase());
        expect(
            orderLinked.length,
            'the order-review task must link to the ORDER, not to the deal — it is the order finance reviews',
        ).toBeGreaterThan(0);

        // ── 6. THE CONTRACT ─────────────────────────────────────────────────
        expect(closed!.ContractID, 'a contract-creating policy must stamp the contract onto the deal')
            .toBeTruthy();

        const contract = await QueryOne<{
            ContractNumber: string;
            CreatingEntityID: string | null;
            CreatingRecordID: string | null;
            EffectiveDate: string | null;
            ExecutedDate: string | null;
            EndDate: string | null;
            TerminatedDate: string | null;
        }>(`
            SELECT ContractNumber, CreatingEntityID, CreatingRecordID,
                   EffectiveDate, ExecutedDate, EndDate, TerminatedDate
              FROM __mj_BizAppsContracts.Contract WHERE ID = '${closed!.ContractID}'`);
        expect(contract, 'and the contract row must be readable').toBeTruthy();
        expect(
            String(contract!.ContractNumber),
            'CONTRACTS mints the number, not sales — two apps generating into one sequence is how a ' +
                'duplicate contract number reaches a customer',
        ).toMatch(/^CTR-/);
        expect(
            String(contract!.CreatingRecordID ?? '').toLowerCase(),
            'and its provenance points at the deal that caused it',
        ).toBe(dealID.toLowerCase());
        expect(contract!.CreatingEntityID, 'with the entity half of the pair present too').toBeTruthy();

        for (const [label, value] of Object.entries({
            EffectiveDate: contract!.EffectiveDate,
            ExecutedDate: contract!.ExecutedDate,
            EndDate: contract!.EndDate,
            TerminatedDate: contract!.TerminatedDate,
        })) {
            expect(
                value,
                `${label} must be null — a contract has no stored status, so a new one displays Draft ` +
                    'precisely because it carries no dates',
            ).toBeNull();
        }

        expectNoConsoleErrors(sink, 'lifecycle');
    });
});
