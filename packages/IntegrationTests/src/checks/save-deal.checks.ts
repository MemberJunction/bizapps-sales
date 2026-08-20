/**
 * @fileoverview `save-deal` — saving a deal, its embedded ORDER and its own children, live.
 *
 * WHY THIS BUNDLE EXISTS. Composing a deal is the one write in this app that spans several tables in
 * two SCHEMAS, and the failure it exists to prevent — a numbered deal with nothing under it — is
 * invisible to a unit test and to any check that mocks the provider.
 *
 * ─── WHAT MOVED WHEN `DealLine` WAS RETIRED (S-US4) ───────────────────────────────────
 *
 * A deal no longer holds lines. It holds an ORDER — an embedded record provisioned on its first save —
 * and the lines live on that. So every line assertion here reaches through `deal.OrderID_Object.Lines`
 * and reads `__mj_BizAppsOrders.OrderLine`, and the ones that cannot survive the move are GONE rather
 * than weakened:
 *
 *   · **SD4 / SD16** proved `DealLine.Resolved*` stayed NULL and refused a forged value. Those four
 *     columns do not exist. The rule they defended — Rule 1, sales never computes money — is asserted
 *     POSITIVELY instead, by SD19: sales sends product and quantity, and the price comes back.
 *   · **SD5** proved a transcribed `Total` was stored verbatim. Sales transcribes no line money at all
 *     now, so there is nothing to store verbatim and nothing to protect from a helpful recompute.
 *   · **SD12** proved a line carried a type whose `IsRecurring` flag was set. `DealLineType` is retired
 *     and nothing routes by line kind — see `docs/DECISIONS.md` D-DL1.
 *
 * Their IDs are NOT reused. A check ID travels into commit messages and CI logs, so SD4 meaning one
 * thing this month and another the next is worse than a gap in the numbering.
 *
 * ─── THE GUARANTEE THAT CHANGED WHEN `Sales.SaveDeal` WAS RETIRED ─────────────────────
 *
 * **SD6/SD13 are the pair that pins it down.** The operation treated a submitted `Lines` array as the
 * COMPLETE DESIRED SET: a stored line absent from it was deleted. A collection does not work that way —
 * it deletes only what was explicitly `Remove()`d, and a row merely missing from the array survives.
 * That is a deliberate adoption of the framework's native semantics, so SD6 proves removal works and
 * SD13 proves omission does NOT delete. Read both before "fixing" either.
 *
 * SD6, SD13 and SD14 now make that claim TWO levels down — deal → embedded order → lines — which is a
 * stronger statement about the save graph than the version they replace, and the one the workspace
 * depends on every time a rep edits a line and presses Save.
 *
 * ⚠️ **REQUIRES bizapps-orders.** Not "some checks do": a deal cannot be saved at all without it,
 * because `DealEntityServer` provisions the order inside `Save()`. `mj-app.json` declares orders a hard
 * dependency, so a host without it is misconfigured rather than minimal — and `Setup` says so out loud
 * rather than letting sixteen checks fail one by one on a missing entity.
 *
 * ⚠️ **`RUN_MUTATION_TESTS=1` IS MANDATORY.** Every check below is `RequiresMutation`, so without that
 * variable the bundle runs ZERO checks and reports success — the vacuous pass `assert-check-count.mjs`
 * exists to catch. A green run that says "0 checks" is a failure wearing a pass.
 *
 * Each check rolls its transaction back, so the suite is safe to run repeatedly and leaves no rows.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { Metadata, RunView, ValidationErrorType, type BaseEntity } from '@memberjunction/core';
import {
    Assert,
    AssertEqual,
    IntegrationCheckRegistry,
    type NamedCheck,
} from '@memberjunction/testing-integration';
import { OrdersIsInstalled } from '@mj-biz-apps/sales-core-entities-server';
import {
    E_ORDERS_PRODUCT,
    ProductFilterFor,
    type DealEntity,
    type mjBizAppsSalesDealPaymentScheduleEntity,
} from '@mj-biz-apps/sales-entities';

import {
    E_DEAL,
    E_SCHEDULE,
    E_TEAM,
    InRolledBackTransaction,
    ProviderOf,
    ResolveSalesFixture,
    SALES_SCHEMA,
    TxOne,
    type SalesFixture,
} from '../fixture.js';

/**
 * The DEAL's own collections. `Lines` is deliberately absent — the deal has none.
 *
 * The lines belong to the embedded order and are declared `Load: 'explicit'` there, so they need their
 * own load; {@link loadOrderLines} is that step, and every check that touches a line goes through it.
 */
const COLLECTIONS = ['PaymentSchedule', 'Team'] as const;

/** Orders' entities, referenced by NAME because sales holds no compile-time dependency on them. */
const E_ORDER_HEADER = 'MJ_BizApps_Orders: Order Headers';
const E_ORDER_LINE = 'MJ_BizApps_Orders: Order Lines';

/**
 * A minimal valid deal, not yet saved. `shape` mutates it for whatever the check is about.
 *
 * Built through the PROVIDER rather than a global `Metadata`, so the entity rides the same connection as
 * the check's open transaction — otherwise its writes would be invisible to the reads below and would not
 * be rolled back with everything else.
 *
 * `CompanyID` is set to the pipeline's here only so the record is coherent before it is saved. The server
 * overwrites it from the pipeline regardless; SD2 is the check that proves it.
 */
async function newDeal(
    ctx: Parameters<NamedCheck['Fn']>[0],
    f: SalesFixture,
    shape?: (deal: DealEntity) => void,
): Promise<DealEntity> {
    const deal = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
    deal.NewRecord();
    deal.Name = 'IT deal';
    deal.PipelineID = f.PipelineID;
    deal.PipelineStageID = f.StageID;
    deal.DealTypeID = f.DealTypeID;
    deal.DealStatusTypeID = f.OpenStatusID;
    deal.AccountID = f.AccountID;
    deal.CompanyID = f.PipelineCompanyID;
    deal.TermMonths = 12;
    shape?.(deal);
    return deal;
}

/** Re-reads a saved deal with its collections populated — what a surface does when it opens one. */
async function reopen(ctx: Parameters<NamedCheck['Fn']>[0], dealID: string): Promise<DealEntity> {
    const deal = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
    Assert(await deal.Load(dealID), `deal ${dealID} could not be re-read`);
    await deal.LoadRelatedRecords(...COLLECTIONS);
    Assert(deal.PaymentSchedule.IsLoaded, 'the PaymentSchedule collection did not load');
    Assert(deal.Team.IsLoaded, 'the Team collection did not load');
    await loadOrderLines(deal);
    return deal;
}

/**
 * Loads the lines of the deal's EMBEDDED ORDER, which `deal.LoadRelatedRecords` does not reach.
 *
 * Two hops, and the second is easy to forget: `LoadRelatedRecords` populates the collections declared on
 * THIS entity, and `Lines` is declared on `OrderHeader`. This is the same sequence
 * `DealWorkspaceService.LoadDeal` performs, and for the same reason — which is why it is one named
 * helper rather than two lines copied into nine checks.
 *
 * Returns `readonly BaseEntity[]`, not orders' generated line class: these checks must not take a
 * compile-time dependency on another app's entity package, so fields are reached with `Get`/`Set`. The
 * array is the collection's own, which is why it is readonly — mutate it through `Create`/`Remove`.
 */
async function loadOrderLines(deal: DealEntity): Promise<readonly BaseEntity[]> {
    const order = deal.OrderID_Object;
    Assert(
        !!order,
        `deal ${deal.ID} resolved no embedded order. Every SAVED deal provisions one in ` +
            'DealEntityServer.Save — SD18 is the check for that, so look there first.',
    );
    await order.LoadRelatedRecords('Lines');
    Assert(order.Lines.IsLoaded, 'the order Lines collection did not load');
    return order.Lines.Items;
}

/** Saves and asserts it worked, reporting the entity's own message rather than a generic failure. */
async function saveOk(deal: DealEntity, what: string): Promise<void> {
    const ok = await deal.Save();
    Assert(ok, `${what} failed: ${deal.LatestResult?.CompleteMessage ?? 'unknown error'}`);
}

/**
 * Adds one ORDER line to the deal's embedded order — product and quantity, and nothing else.
 *
 * That is the whole input a rep supplies (S-US4). The helper it replaces took `AnnualGrossFees`,
 * `DiscountAmount` and `Total`, transcribed money that went with `DealLine`; orders stamps `CompanyID`
 * from the product and prices `UnitPrice` itself, so setting either here would be this app computing
 * money — the thing Rule 1 forbids. SD19 is the check that proves both arrive anyway.
 *
 * `OrderID_EnsureObject()` works on an UNSAVED deal, which is what lets SD1 be a genuine single save:
 * the order is created in memory now and written with everything else.
 */
async function addLine(deal: DealEntity, productID: string, quantity: number): Promise<BaseEntity> {
    const line = await deal.OrderID_EnsureObject().Lines.Create();
    line.Set('ProductID', productID);
    line.Set('Quantity', quantity);
    return line;
}

async function addInstalment(
    deal: DealEntity,
    seed: Partial<Record<keyof mjBizAppsSalesDealPaymentScheduleEntity, unknown>>,
): Promise<mjBizAppsSalesDealPaymentScheduleEntity> {
    const row = await deal.PaymentSchedule.Create();
    for (const [field, value] of Object.entries(seed)) {
        row.Set(field, value);
    }
    return row;
}

/**
 * Two order lines carrying REAL catalogue products. The shape most checks want.
 *
 * There is no "one recurring, one one-time" any more — that distinction was `DealLineType`, and nothing
 * routes by it. Two lines are still what the checks need, for the reason they always did: one line
 * cannot demonstrate ordering, and removing the only line cannot demonstrate re-sequencing.
 *
 * The products are DISCOVERED through the picker's own filter, never hardcoded. `OrderLine.ProductID` is
 * a real FK, so an invented id fails on the constraint rather than on whatever the check is about; and a
 * check naming a SKU would pass on the seeded host, fail everywhere else, and keep passing if the
 * picker's filter itself broke.
 */
async function twoLines(ctx: Parameters<NamedCheck['Fn']>[0], deal: DealEntity): Promise<string[]> {
    const products = await sellableProducts(ctx, deal.CompanyID as string, 2);
    await addLine(deal, products[0], 100);
    await addLine(deal, products[1], 1);
    return products;
}

/** Sellable product ids for a company, by the PICKER's own rule so a check cannot drift from it. */
async function sellableProducts(
    ctx: Parameters<NamedCheck['Fn']>[0],
    companyID: string,
    count: number,
): Promise<string[]> {
    const r = await new RunView().RunView<{ ID: string }>(
        {
            EntityName: E_ORDERS_PRODUCT,
            ExtraFilter: ProductFilterFor(companyID, new Date()),
            OrderBy: 'Name ASC',
            ResultType: 'simple',
            Fields: ['ID'],
        },
        ctx.User,
    );
    Assert(r.Success, `setup: reading orders' catalogue failed — ${r.ErrorMessage}`);
    const ids = (r.Results ?? []).map((row) => row.ID);
    Assert(
        ids.length >= count,
        `setup: this host needs ${count} sellable product(s) for company ${companyID}, found ${ids.length}. ` +
            'Run scripts/seed-demo-data.sh in bizapps-orders.',
    );
    return ids.slice(0, count);
}

/**
 * Child rows of a deal, read through the provider so the open transaction is visible.
 *
 * `orderBy` is OPTIONAL because not every child is ordered. An earlier version hardcoded
 * `DisplayOrder ASC` for all of them and SD3 failed with `Invalid column name 'DisplayOrder'` —
 * `DealTeamMember` has no such column, and rightly: team membership is a set, not a sequence. Only
 * lines and instalments are ordered, and only they ask for it.
 */
async function children(
    ctx: Parameters<NamedCheck['Fn']>[0],
    entity: string,
    dealID: string,
    fields: string[],
    orderBy?: string,
): Promise<Record<string, unknown>[]> {
    const rv = new RunView();
    const r = await rv.RunView(
        {
            EntityName: entity,
            ExtraFilter: `DealID = '${dealID}'`,
            ...(orderBy ? { OrderBy: orderBy } : {}),
            ResultType: 'simple',
            Fields: fields,
        },
        ctx.User,
    );
    Assert(r.Success, `reading ${entity} failed — ${r.ErrorMessage}`);
    return (r.Results ?? []) as Record<string, unknown>[];
}

/** The deal's own ordered child — the payment schedule sequences on `DisplayOrder`. */
const ORDERED = 'DisplayOrder ASC';

/**
 * The ORDER's line rows, straight from the database, through the provider so the open transaction is
 * visible.
 *
 * Separate from {@link children} rather than a parameter on it, because order lines do not join on
 * `DealID` and do not sequence on `DisplayOrder`: the FK is `OrderHeaderID` and the sequence column is
 * `LineNumber`. Two differences in one call is exactly where a shared helper starts lying.
 */
async function orderLines(
    ctx: Parameters<NamedCheck['Fn']>[0],
    orderID: string,
    fields: string[],
): Promise<Record<string, unknown>[]> {
    const r = await new RunView().RunView(
        {
            EntityName: E_ORDER_LINE,
            ExtraFilter: `OrderHeaderID = '${orderID}'`,
            OrderBy: 'LineNumber ASC',
            ResultType: 'simple',
            Fields: fields,
        },
        ctx.User,
    );
    Assert(r.Success, `reading the order's lines failed — ${r.ErrorMessage}`);
    return (r.Results ?? []) as Record<string, unknown>[];
}

/** The embedded order's row, read back through the entity layer. */
async function orderRow(
    ctx: Parameters<NamedCheck['Fn']>[0],
    orderID: string,
    fields: string[],
): Promise<Record<string, unknown>> {
    const r = await new RunView().RunView(
        { EntityName: E_ORDER_HEADER, ExtraFilter: `ID = '${orderID}'`, ResultType: 'simple', Fields: fields },
        ctx.User,
    );
    Assert(r.Success, `reading the order header failed — ${r.ErrorMessage}`);
    const row = (r.Results ?? [])[0] as Record<string, unknown> | undefined;
    Assert(!!row, `the order ${orderID} was not readable`);
    return row as Record<string, unknown>;
}

/** The lines' ids, so a check can say "the same rows, not merely the same count". */
const idsOf = (rows: Record<string, unknown>[]): string =>
    rows.map((r) => String(r.ID).toLowerCase()).sort().join(',');

const seqOf = (dealNumber: string): number => Number(dealNumber.replace(/^DEAL-/, ''));

export const SaveDealChecks: NamedCheck[] = [
    {
        Id: 'save-deal.SD1',
        Name: 'SD1: a deal, its ORDER, its order lines and its instalments are written by ONE save',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * FOUR TABLES ACROSS TWO SCHEMAS, one `Save()`.
                 *
                 * `Deal` and `DealPaymentSchedule` in `__mj_BizAppsSales`; `OrderHeader` and `OrderLine`
                 * in `__mj_BizAppsOrders`. The order is not created by a second call and not by the UI —
                 * the lines are attached to an order that exists only in memory at this point, and the
                 * save graph writes the header, learns its key, and stamps it onto the lines.
                 *
                 * That is the claim worth a live check: a partial version of this leaves a numbered deal
                 * pointing at an order with no lines, which no unit test can see.
                 */
                const f = await ResolveSalesFixture(ctx);
                const deal = await newDeal(ctx, f, (d) => { d.Name = 'SD1 composed deal'; });
                await twoLines(ctx, deal);
                await addInstalment(deal, { PaymentDate: new Date('2026-10-01T00:00:00Z'), Amount: 64000, Description: '50% on execution' });
                await addInstalment(deal, { PaymentDate: new Date('2027-01-01T00:00:00Z'), Amount: 64000, Description: '50% on go-live' });

                await saveOk(deal, 'the composed save');
                Assert(deal.IsSaved, 'the deal reports itself saved');
                Assert(!!deal.OrderID, 'the composed save also wrote the embedded order and stamped its key');

                AssertEqual((await orderLines(ctx, deal.OrderID as string, ['ID'])).length, 2, 'two ORDER lines landed');
                AssertEqual((await children(ctx, E_SCHEDULE, deal.ID, ['ID'], ORDERED)).length, 2, 'two instalments landed');
            }),
    },
    {
        Id: 'save-deal.SD2',
        Name: 'SD2: CompanyID comes from the PIPELINE, not from whatever the client set',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                // A deliberately wrong company. Deal.CompanyID must equal Pipeline.CompanyID and a CHECK
                // cannot reach across the FK to compare them, so the server resolves it on every save —
                // and a client that gets it wrong (or lies) must not be able to store a mismatch.
                const bogus = '00000000-0000-0000-0000-000000000001';
                const deal = await newDeal(ctx, f, (d) => {
                    d.Name = 'SD2 company override';
                    d.CompanyID = bogus;
                });
                await saveOk(deal, 'the save');

                const row = await TxOne<{ CompanyID: string }>(
                    ctx, `SELECT CompanyID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${deal.ID}'`,
                );
                AssertEqual(
                    String(row.CompanyID).toLowerCase(),
                    f.PipelineCompanyID.toLowerCase(),
                    'the stored company must be the pipeline\'s, not the one the caller supplied',
                );
            }),
    },
    {
        Id: 'save-deal.SD3',
        Name: 'SD3: an owner becomes a DealTeamMember, and OwnerEmployeeID is DERIVED from it',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const deal = await newDeal(ctx, f, (d) => { d.Name = 'SD3 owner'; });
                await deal.SetOwner(f.EmployeeID);
                await saveOk(deal, 'the save');

                // DealTeamMember is the SOURCE OF TRUTH for who is on a deal, including the owner; the
                // column is only a denormalized stamp so "my deals" needs no join. So the row must exist,
                // and the stamp must match it.
                const team = await children(ctx, E_TEAM, deal.ID, ['ID', 'EmployeeID']);
                AssertEqual(team.length, 1, 'exactly one team member was created for the owner');
                AssertEqual(
                    String(team[0].EmployeeID).toLowerCase(),
                    f.EmployeeID.toLowerCase(),
                    'the team row names the employee that was set as the owner',
                );

                const stored = await TxOne<{ OwnerEmployeeID: string }>(
                    ctx, `SELECT OwnerEmployeeID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${deal.ID}'`,
                );
                AssertEqual(
                    String(stored.OwnerEmployeeID).toLowerCase(),
                    f.EmployeeID.toLowerCase(),
                    'the denormalized stamp agrees with the team row it is derived from',
                );
            }),
    },
    {
        Id: 'save-deal.SD6',
        Name: 'SD6: KI-20 TRIPWIRE — removing an order line is silently DROPPED (see the comment)',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const created = await newDeal(ctx, f, (d) => { d.Name = 'SD6 explicit removal'; });
                await twoLines(ctx, created);
                await saveOk(created, 'create');
                const orderID = created.OrderID as string;
                const before = await orderLines(ctx, orderID, ['ID', 'ProductID', 'LineNumber']);
                AssertEqual(before.length, 2, 'two lines to start with');

                /**
                 * ⚠️ THIS CHECK ASSERTS A DEFECT, DELIBERATELY. Read this before "fixing" it.
                 *
                 * It used to assert the requirement: `Remove()` records the row in the collection's removal
                 * list, that list is contributed to the save plan, and the delete, the re-sequencing of
                 * what remains and the header update land as one atomic unit. That is what the workspace's
                 * delete-line affordance depends on, and it is what SD13's complement is about.
                 *
                 * **It does not happen.** The save returns TRUE and the row survives — measured, with the
                 * full matrix, in `test-harnesses/prove-line-removal.mjs` and written up as KI-20. The
                 * cause is in orders, not here and not in MJ: `OrderEntityServer.Save()` passes
                 * `SkipRelatedCollections: true` (correctly — lines must not insert before they are priced)
                 * and its hand-rolled `savePendingLines()` iterates `this.Lines.Items`, so it handles
                 * inserts and updates and never asks the collection for its pending removals. The control
                 * in that harness — removing one of the DEAL's own instalments — deletes fine, which is how
                 * we know MJ's machinery works and only `OrderHeader.Lines` drops it.
                 *
                 * SO WHY KEEP THE CHECK AT ALL, POINTING THE WRONG WAY? The CD7 pattern. Deleting it would
                 * lose the requirement with no trace; leaving it red would make a permanently failing suite
                 * that people learn to skim past. Written this way, **the day orders fixes it this check
                 * FAILS, and that failure is the signal to invert it back** to the assertions preserved
                 * verbatim below.
                 *
                 * What it still proves in the meantime is not nothing: the SALES side does its part. The
                 * collection accepts the removal, reports the right count, and the save succeeds — so when
                 * the fix lands there is no second bug waiting behind this one.
                 *
                 * ── THE ASSERTIONS TO RESTORE, when KI-20 is fixed ──
                 *   AssertEqual(after.length, 1, 'the removed line was deleted');
                 *   AssertEqual(String(after[0].ProductID).toLowerCase(),
                 *               String(before[0].ProductID).toLowerCase(),
                 *               'the surviving line is the one that was kept, not merely one of the two');
                 *   AssertEqual(Number(after[0].LineNumber), 1, 'what remains was re-sequenced');
                 */
                const deal = await reopen(ctx, created.ID);
                const lines = deal.OrderID_Object!.Lines;
                const doomed = lines.Items[1];
                Assert(!!doomed, 'the line to remove was found after re-reading');
                lines.Remove(doomed);
                AssertEqual(lines.Count, 1, 'the collection accepts the removal and reports one line left');

                await saveOk(deal, 'the save after removal');

                const after = await orderLines(ctx, orderID, ['ID', 'ProductID', 'LineNumber']);
                AssertEqual(
                    after.length,
                    2,
                    'KI-20: the removal was DROPPED and both rows are still there. If this now reads 1, ' +
                        'orders has fixed savePendingLines() — restore the three assertions listed in the ' +
                        'comment above, delete this one, and close KI-20.',
                );
                AssertEqual(
                    idsOf(after),
                    idsOf(before),
                    'and they are the SAME two rows — nothing was deleted and nothing was replaced',
                );
            }),
    },
    {
        Id: 'save-deal.SD7',
        Name: 'SD7: children are sequenced from collection position, contiguously from 1',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const deal = await newDeal(ctx, f, (d) => { d.Name = 'SD7 ordering'; });
                await twoLines(ctx, deal);
                await addInstalment(deal, { Amount: 1, Description: 'first' });
                await addInstalment(deal, { Amount: 2, Description: 'second' });
                await addInstalment(deal, { Amount: 3, Description: 'third' });
                await saveOk(deal, 'the save');

                // FROM 1, STEP 1 — not 10/20/30 as the hand-rolled implementation used. The collection's
                // sequencer is `from + index` with no increment option, and the old 10-step was cosmetic
                // anyway: it looks like room to insert between two rows, but every add and remove
                // re-sequenced the whole collection, so a gap never survived the next mutation.
                //
                // TWO COLLECTIONS, TWO DIFFERENT SEQUENCE COLUMNS, one rule. Order lines sequence on
                // `LineNumber` and instalments on `DisplayOrder` — a single check over both is what stops
                // "we sequence from 1" from being true of the collection we happened to look at.
                const lines = await orderLines(ctx, deal.OrderID as string, ['LineNumber']);
                AssertEqual(lines.map((l) => Number(l.LineNumber)).join(','), '1,2', 'order lines sequenced 1,2');
                const sched = await children(ctx, E_SCHEDULE, deal.ID, ['DisplayOrder', 'Description'], ORDERED);
                AssertEqual(sched.map((s) => Number(s.DisplayOrder)).join(','), '1,2,3', 'instalments sequenced 1,2,3');
                AssertEqual(String(sched[0].Description), 'first', 'collection order is the stored order');
            }),
    },
    {
        Id: 'save-deal.SD8',
        Name: 'SD8: an invalid deal is refused with a STRUCTURED error and writes nothing',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const before = await TxOne<{ N: number }>(ctx, `SELECT COUNT(*) AS N FROM ${SALES_SCHEMA}.Deal`);

                const deal = await newDeal(ctx, f, (d) => { d.Name = ''; });

                // STRUCTURED, not a joined string: `Source` is what lets a field mark itself and a tab
                // badge itself. A refusal carrying only prose would force the UI to parse it. The rules
                // live on the ENTITY, so this is the same code the browser runs before it ever calls out.
                const validation = deal.Validate();
                Assert(validation.Success === false, 'a nameless deal must not validate');
                const nameError = validation.Errors.find((e) => e.Source === 'Name');
                Assert(!!nameError, `the refusal must name the offending field, got ${JSON.stringify(validation.Errors)}`);
                AssertEqual(nameError!.Type, ValidationErrorType.Failure, 'a blocker, not an advisory');

                AssertEqual(await deal.Save(), false, 'the save must be refused');

                const after = await TxOne<{ N: number }>(ctx, `SELECT COUNT(*) AS N FROM ${SALES_SCHEMA}.Deal`);
                AssertEqual(Number(after.N), Number(before.N), 'a refused deal wrote no row');
            }),
    },
    {
        Id: 'save-deal.SD9',
        Name: 'SD9: a new deal is numbered DEAL-{seq} on insert',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const deal = await newDeal(ctx, f, (d) => { d.Name = 'SD9 numbering'; });
                await saveOk(deal, 'the save');

                const row = await TxOne<{ DealNumber: string }>(
                    ctx, `SELECT DealNumber FROM ${SALES_SCHEMA}.Deal WHERE ID = '${deal.ID}'`,
                );
                Assert(
                    /^DEAL-\d{6}$/.test(String(row.DealNumber)),
                    `expected DEAL-{6 digits}, got ${String(row.DealNumber)}`,
                );
                AssertEqual(deal.DealNumber, row.DealNumber, 'the in-memory record carries the number it stored');
            }),
    },
    {
        Id: 'save-deal.SD10',
        Name: 'SD10: re-saving a deal does NOT renumber it',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const created = await newDeal(ctx, f, (d) => { d.Name = 'SD10 stable number'; });
                await saveOk(created, 'create');
                const first = created.DealNumber;

                // A deal number travels: it appears on a contract, in an order, and in people's email.
                // Renumbering on edit would silently break every one of those references.
                const deal = await reopen(ctx, created.ID);
                deal.Name = 'SD10 renamed';
                await saveOk(deal, 'update');

                const row = await TxOne<{ DealNumber: string }>(
                    ctx, `SELECT DealNumber FROM ${SALES_SCHEMA}.Deal WHERE ID = '${created.ID}'`,
                );
                AssertEqual(row.DealNumber, first, 'the number survived the update unchanged');
            }),
    },
    {
        Id: 'save-deal.SD11',
        Name: 'SD11: the counter advances by exactly one per deal — no gaps, no reuse',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const before = await TxOne<{ N: number }>(
                    ctx, `SELECT NextSequenceNumber AS N FROM ${SALES_SCHEMA}.DealSequence WHERE ID = 1`,
                );

                const a = await newDeal(ctx, f, (d) => { d.Name = 'SD11 first'; });
                await saveOk(a, 'the first save');
                const b = await newDeal(ctx, f, (d) => { d.Name = 'SD11 second'; });
                await saveOk(b, 'the second save');

                const after = await TxOne<{ N: number }>(
                    ctx, `SELECT NextSequenceNumber AS N FROM ${SALES_SCHEMA}.DealSequence WHERE ID = 1`,
                );

                AssertEqual(seqOf(a.DealNumber as string), Number(before.N), 'the first deal takes the number the counter was showing');
                AssertEqual(seqOf(b.DealNumber as string), seqOf(a.DealNumber as string) + 1, 'the second takes the very next one');
                AssertEqual(
                    Number(after.N) - Number(before.N),
                    2,
                    'two numbers taken advanced the counter by exactly two — a counter that skips leaves gaps ' +
                        'somebody later has to explain',
                );
            }),
    },
    {
        Id: 'save-deal.SD13',
        Name: 'SD13: a header-only save leaves the children ALONE — omission is not deletion',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const created = await newDeal(ctx, f, (d) => { d.Name = 'SD13 omission'; });
                await twoLines(ctx, created);
                await addInstalment(created, { Amount: 500, Description: 'deposit' });
                await saveOk(created, 'create');
                const orderID = created.OrderID as string;

                /**
                 * THE COMPLEMENT OF SD6, AND THE ONE BEHAVIOUR THAT CHANGED. The retired `Sales.SaveDeal`
                 * treated a submitted array as the complete desired set and DELETED anything missing from
                 * it. A collection deletes only what was explicitly removed.
                 *
                 * That difference is what makes this save safe: an Action that renames a deal, an agent
                 * that nudges `NextStep`, a header-only form — none of them has to know the deal has lines,
                 * and none of them can destroy them by not mentioning them. Under the old semantics every
                 * such caller had to load and re-send the full tree, and forgetting to was silent data
                 * loss.
                 */
                const deal = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await deal.Load(created.ID), 're-read the deal without touching its collections');
                AssertEqual(deal.PaymentSchedule.Count, 0, 'the collection is unloaded, so it holds nothing');
                Assert(
                    deal.PaymentSchedule.IsLoaded === false,
                    'and it knows it was never loaded — which is why it contributes no deletions',
                );

                /**
                 * THE EMBEDDED ORDER IS THE SHARPER HALF NOW. A plain `Load()` RESOLVES the order — it is
                 * a 1:1 peer, so it is fetched with the deal — but its `Lines` are declared
                 * `Load: 'explicit'` and stay empty. So the graph is holding an order whose line
                 * collection is present, loaded-flag false, and count zero.
                 *
                 * If an unloaded collection ever contributed deletions, THIS is the shape that would
                 * silently empty a customer's order: an Action renaming a deal, an agent nudging
                 * `NextStep`, a header-only form — none of them mentions lines, and none of them should be
                 * able to destroy them.
                 */
                const order = deal.OrderID_Object;
                Assert(!!order, 'a plain Load resolves the embedded order — it is a 1:1 peer, not a collection');
                Assert(order.Lines.IsLoaded === false, 'while the ORDER\'s lines are explicit-load, so they stay unloaded');
                AssertEqual(order.Lines.Count, 0, 'and hold nothing');

                deal.NextStep = 'Send the redline';
                await saveOk(deal, 'the header-only save');

                AssertEqual((await orderLines(ctx, orderID, ['ID'])).length, 2, 'both ORDER lines survived');
                AssertEqual((await children(ctx, E_SCHEDULE, created.ID, ['ID'], ORDERED)).length, 1, 'the instalment survived');
            }),
    },
    {
        Id: 'save-deal.SD15',
        Name: 'SD15: the defaults the retired draft pre-filled now come from ENTITY METADATA',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);

                /**
                 * A HIDDEN INVARIANT THE RETIREMENT COULD HAVE DROPPED IN SILENCE.
                 *
                 * `DealDraft`'s constructor pre-filled `PaymentMethod: 'ACH'`. Nothing replaced it in the
                 * component, because nothing needed to: the column carries a database DEFAULT, CodeGen
                 * records it on `EntityField.DefaultValue`, and `NewRecord()` applies it. So the value
                 * still arrives — from metadata rather than from a UI model, which is the better place for
                 * it.
                 *
                 * "Still arrives" was an inference along a four-step chain, though, and the failure mode if
                 * any link broke is a quiet one: a deal saved with a NULL payment method. This check is
                 * what turns the inference into a fact.
                 *
                 * IT USED TO ASSERT A SECOND DEFAULT — `AddLine` pre-filled `Quantity: 1`, and the check
                 * proved `DealLine.Quantity` came back as 1. That half is gone with the table. The line is
                 * an ORDER line now, so its default is orders' metadata, and sales asserting another app's
                 * column defaults would be a check that fails when a neighbouring team makes a decision
                 * that is theirs to make.
                 *
                 * It also pins the SQL-syntax stripping. The stored default is literally `('ACH')`, and an
                 * unstripped value would give every deal the payment method `('ACH')` — wrong in a way that
                 * looks like a typo rather than a framework detail.
                 */
                const deal = await newDeal(ctx, f, (d) => { d.Name = 'SD15 metadata defaults'; });
                AssertEqual(deal.PaymentMethod, 'ACH', 'PaymentMethod defaults from metadata, not from a UI model');

                await saveOk(deal, 'the save');

                const stored = await TxOne<{ PaymentMethod: string }>(
                    ctx, `SELECT PaymentMethod FROM ${SALES_SCHEMA}.Deal WHERE ID = '${deal.ID}'`,
                );
                AssertEqual(String(stored.PaymentMethod), 'ACH', 'and it is what actually reached the database');
            }),
    },
    {
        Id: 'save-deal.SD14',
        Name: 'SD14: an ORDER-LINE edit round-trips through the deal — two levels down, one save',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const created = await newDeal(ctx, f, (d) => { d.Name = 'SD14 edit and reorder'; });
                await twoLines(ctx, created);
                await saveOk(created, 'create');
                const orderID = created.OrderID as string;

                const deal = await reopen(ctx, created.ID);
                const lines = deal.OrderID_Object!.Lines;
                AssertEqual(lines.Count, 2, 'both lines came back');

                /**
                 * THE EDIT TRAVELS TWO LEVELS, and that is the whole claim: the row belongs to the deal's
                 * EMBEDDED ORDER, and the save is issued on the DEAL. Nothing in the schema says an
                 * embedded record's own collections join the parent's save plan; this is the assertion that
                 * they do, and the workspace depends on it every time a rep changes a quantity.
                 *
                 * IT USED TO ALSO ASSERT A REPOSITIONING — remove the neighbour, and watch the survivor's
                 * `LineNumber` change without any field the user touched. That half is gone, not because it
                 * stopped mattering but because removal does not happen at all: KI-20, and SD6 is the
                 * tripwire for it. When KI-20 is fixed, this is the second check to revisit.
                 */
                const first = lines.Items[0];
                first.Set('Quantity', 150);

                await saveOk(deal, 'the save after the edit');

                const after = await orderLines(ctx, orderID, ['ID', 'Quantity', 'LineNumber']);
                AssertEqual(after.length, 2, 'both lines are still there — nothing was removed');
                AssertEqual(
                    Number(after.find((r) => String(r.ID) === String(first.Get('ID')))?.Quantity),
                    150,
                    'the field edit reached the database, through the deal\'s save',
                );
            }),
    },
    {
        Id: 'save-deal.SD17',
        Name: 'SD17: a COMPOSITE save takes exactly ONE deal number — the graph does not re-enter Save()',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * THE GRAPH PATH, WHICH SD11 DOES NOT REACH.
                 *
                 * SD11 proves the counter for deals saved WITHOUT children, and those never build a save
                 * plan at all. A deal WITH children does: `Save()` routes to the graph, and until MJ
                 * `47ff71d68b` the graph executed the root by calling this record's public `Save()` a
                 * second time. `DealEntityServer` carried an early return on `EntitySaveOptions
                 * .IsGraphNodeSave` to stay idempotent through that; MJ then deleted the flag and made the
                 * node path private, so the guard was removed.
                 *
                 * If that reading is ever wrong — or MJ reverts to re-entering the public method — the
                 * preparation block runs twice and this deal consumes TWO numbers while keeping the second.
                 * `DealNumber` appears in contracts, orders and people's email, and the counter is sold as
                 * gap-free, so a silently skipped number is a defect somebody has to explain months later.
                 *
                 * Asserted on the COUNTER, not just the number: a double assignment would leave the deal
                 * holding a plausible-looking number and the gap sitting invisibly in `DealSequence`.
                 */
                const f = await ResolveSalesFixture(ctx);
                const before = await TxOne<{ N: number }>(
                    ctx, `SELECT NextSequenceNumber AS N FROM ${SALES_SCHEMA}.DealSequence WHERE ID = 1`,
                );

                const deal = await newDeal(ctx, f, (d) => { d.Name = 'SD17 composite'; });
                await twoLines(ctx, deal);
                await saveOk(deal, 'the composite save');

                const after = await TxOne<{ N: number }>(
                    ctx, `SELECT NextSequenceNumber AS N FROM ${SALES_SCHEMA}.DealSequence WHERE ID = 1`,
                );

                AssertEqual(
                    Number(after.N) - Number(before.N),
                    1,
                    'a deal saved together with its lines must consume exactly ONE number — more than one ' +
                        'means the preparation block ran again for the graph node',
                );
                AssertEqual(
                    seqOf(deal.DealNumber as string),
                    Number(before.N),
                    'and it must KEEP the number the counter was showing, not a later one',
                );

                // The children really were written — otherwise this passes by not taking the graph path.
                // Read through the entity layer rather than raw SQL: the rows are in orders' schema, and
                // hardcoding a neighbouring app's schema name here would be a second place to update.
                AssertEqual(
                    (await orderLines(ctx, deal.OrderID as string, ['ID'])).length,
                    2,
                    'both lines must have persisted, or this check proved nothing',
                );
            }),
    },
    {
        Id: 'save-deal.SD18',
        Name: 'SD18: saving a deal PROVISIONS its embedded order — once, in orders\' own default state',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * TRANSCRIBED FROM `test-harnesses/prove-order-at-creation.mjs`, which proved this and then
                 * could not defend it: a harness is not in CI and is not in the coverage gate, so the
                 * behaviour it established would have been unprotected from the next refactor.
                 *
                 * THE POINT IS THE LAYER, not the outcome. The workspace's `AddLine()` already produced an
                 * order, so a deal only got one when somebody added a line THROUGH THE UI — an agent, an
                 * importer or a plain `BaseEntity.Save()` produced a deal with no order at all. S-US4 puts
                 * the order at CREATION. This check saves a deal through the entity layer and touches no UI
                 * code, which is the same argument as the close lock: a rule the UI enforces holds only
                 * until something that is not the UI writes.
                 */
                const f = await ResolveSalesFixture(ctx);
                const deal = await newDeal(ctx, f, (d) => { d.Name = 'SD18 provisioning'; });
                Assert(!deal.OrderID, 'a new deal has no order before it is saved');
                Assert(deal.OrderID_Object === null, 'and no order object either — nothing is provisioned in NewRecord()');

                await saveOk(deal, 'the save');
                Assert(!!deal.OrderID, 'the saved deal carries an OrderID');

                const row = await orderRow(ctx, deal.OrderID as string, [
                    'OrderNumber', 'Status', 'OrderType', 'CompanyID', 'BillToOrganizationID',
                ]);
                Assert(
                    !!row.OrderNumber,
                    'orders minted the OrderNumber. An empty one means OrderEntityServer is not registered ' +
                        'in this process and ClassFactory fell back to the generated OrderHeader — see ' +
                        'DealEntityServer.explainOrderProvisioningFailure.',
                );
                AssertEqual(String(row.OrderType), 'Sale', 'OrderType is what SALES states it is');
                AssertEqual(
                    String(row.CompanyID).toLowerCase(),
                    f.PipelineCompanyID.toLowerCase(),
                    'the selling company came from the PIPELINE, through the deal stamp',
                );
                AssertEqual(
                    String(row.BillToOrganizationID).toLowerCase(),
                    f.AccountID.toLowerCase(),
                    'bill-to is the deal\'s account — a SalesAccount key IS an Organization key (IsA)',
                );

                /**
                 * SALES STATES NO LIFECYCLE, and this is how to assert that without naming a status.
                 *
                 * Comparing the stored value to a literal would be a vocabulary comparison and would also
                 * be the wrong claim — the value is orders' to choose. Comparing it to what a freshly
                 * `NewRecord()`ed order header carries asserts the thing sales is actually responsible
                 * for: that it did not overwrite the default. If orders changes its default tomorrow, this
                 * check follows it; if sales starts setting a status, it fails.
                 */
                const pristine = await ProviderOf(ctx).GetEntityObject<BaseEntity>(E_ORDER_HEADER, ctx.User);
                pristine.NewRecord();
                AssertEqual(
                    String(row.Status),
                    String(pristine.Get('Status')),
                    'the order is in the state ORDERS defaults a new one to — sales asserts no order lifecycle',
                );

                // EXACTLY ONE, and re-saving must not mint a second. `provisionEmbeddedOrder` guards on
                // `IsSaved || OrderID`, and a deal is saved many times over its life.
                const firstOrderID = deal.OrderID;
                deal.Description = 'touched after the first save';
                await saveOk(deal, 'the re-save');
                AssertEqual(deal.OrderID, firstOrderID, 're-saving the deal does NOT provision another order');
            }),
    },
    {
        Id: 'save-deal.SD19',
        Name: 'SD19: sales sends PRODUCT and QUANTITY; everything else on the line comes from orders',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * RULE 1, ASSERTED POSITIVELY. This is what replaces SD4 and SD16.
                 *
                 * Those two guarded `DealLine.Resolved*` — proving the columns stayed NULL, and that a
                 * caller setting one was refused. The columns are gone, but the rule they defended is the
                 * app's first rule, so it needs a check that still means something: sales supplies the two
                 * facts it actually knows, and the row comes back carrying three columns it never wrote.
                 *
                 * `OrderLine.CompanyID` and `LineNumber` are NOT NULL and sales sets neither. So this is
                 * not a soft "the price looks plausible" assertion — if orders' server classes were absent
                 * the insert itself would fail on a constraint.
                 *
                 * WHAT IT DELIBERATELY DOES NOT ASSERT: a figure. Checking that `UnitPrice` equals some
                 * expected number would mean this repo knowing a price, which is precisely the accretion
                 * Rule 1 exists to stop. Non-null is the strongest claim sales is entitled to make.
                 */
                const f = await ResolveSalesFixture(ctx);
                const deal = await newDeal(ctx, f, (d) => { d.Name = 'SD19 engine pricing'; });
                const [productID] = await sellableProducts(ctx, f.PipelineCompanyID, 1);
                const line = await addLine(deal, productID, 3);

                // `CompanyID` is the honest pre-save assertion: sales never writes it, and it is NOT NULL,
                // so a row that lands has been through orders. `LineNumber` is NOT asserted here -- the
                // collection assigns it at `Create()` time, before any save, so a pre-save check would be
                // testing MJ's sequencer rather than what sales supplied. It is asserted below instead.
                Assert(!line.Get('CompanyID'), 'sales sets no company on a line — the product decides it');

                await saveOk(deal, 'the save');

                const [row] = await orderLines(ctx, deal.OrderID as string, [
                    'ProductID', 'Quantity', 'UnitPrice', 'CompanyID', 'LineNumber',
                ]);
                Assert(!!row, 'the line reached the database');
                AssertEqual(String(row.ProductID).toLowerCase(), productID.toLowerCase(), 'the product is the one sales sent');
                AssertEqual(Number(row.Quantity), 3, 'the quantity round-trips exactly as sent');
                Assert(row.UnitPrice !== null && row.UnitPrice !== undefined, 'ORDERS priced it — sales sent no price');
                Assert(!!row.CompanyID, 'orders stamped CompanyID from the product');
                AssertEqual(Number(row.LineNumber), 1, 'and the collection numbered it');
            }),
    },
    {
        Id: 'save-deal.SD20',
        Name: 'SD20: reopening a deal brings its order lines back — the second load nobody remembers',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * THE BUG THIS CHECK IS ABOUT ALREADY HAPPENED ONCE. A rep saved lines, reopened the deal,
                 * and the workspace showed none — because `deal.LoadRelatedRecords(...)` populates the
                 * collections declared on the DEAL, and `Lines` is declared on `OrderHeader`. The data was
                 * never lost; the second load was missing.
                 *
                 * It is a two-hop read with a silent failure mode, so it gets its own check rather than
                 * riding along on SD1's counts: an empty collection and an unloaded collection look
                 * identical to a surface, and only one of them is a defect.
                 */
                const f = await ResolveSalesFixture(ctx);
                const created = await newDeal(ctx, f, (d) => { d.Name = 'SD20 reopen'; });
                await twoLines(ctx, created);
                await saveOk(created, 'create');
                const stored = await orderLines(ctx, created.OrderID as string, ['ID']);
                AssertEqual(stored.length, 2, 'two lines are in the database to be read back');

                const deal = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await deal.Load(created.ID), 'a FRESH read of the deal');
                const order = deal.OrderID_Object;
                Assert(!!order, 'resolves the embedded order');
                AssertEqual(String(order.ID).toLowerCase(), String(created.OrderID).toLowerCase(), 'the same order');
                Assert(order.Lines.IsLoaded === false, 'whose lines start UNLOADED — Load: explicit, by declaration');

                await order.LoadRelatedRecords('Lines');
                Assert(order.Lines.IsLoaded, 'LoadRelatedRecords on the ORDER is the hop that loads them');
                AssertEqual(order.Lines.Count, stored.length, 'and the collection matches the database, row for row');
                AssertEqual(
                    order.Lines.Items.map((l) => String(l.ID).toLowerCase()).sort().join(','),
                    idsOf(stored),
                    'the SAME rows, not merely the same number of them',
                );
            }),
    },
];

for (const check of SaveDealChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

/**
 * Setup CREATES NOTHING and Teardown sweeps nothing — the fixture is DISCOVERED from the seeded database
 * (see `fixture.ts`) and every check rolls its own transaction back. Compare orders, whose lifecycle
 * builds a committed product catalog and then sweeps it in FK order.
 *
 * Setup does one thing, and it is a REFUSAL. Saving a deal provisions an embedded order inside
 * `DealEntityServer.Save()`, so on a host without bizapps-orders every check here fails on a missing
 * entity — sixteen failures whose real cause is one missing app. Stating it once, in the place that runs
 * first, turns that into a single message that names the cause.
 *
 * The runner should not reach this on a sales-only host at all: `scripts/expected-check-counts.json`
 * marks this bundle `requires: "orders"`. This is the backstop for someone running the bundle directly.
 */
IntegrationCheckRegistry.Instance.RegisterLifecycle('save-deal', {
    Setup: async () => {
        Assert(
            OrdersIsInstalled(),
            'save-deal REQUIRES bizapps-orders. A deal cannot be saved without it — DealEntityServer ' +
                'provisions the deal\'s embedded order during Save() — so this is a misconfigured host ' +
                'rather than a minimal one. mj-app.json declares orders a hard dependency; see ' +
                'docs/WORKSPACE-SETUP.md for linking it.',
        );
    },
    Teardown: async () => {
        // Nothing to sweep: every check rolled back.
    },
});

/** Referenced by index.ts so the registration side effect cannot be tree-shaken away. */
export function LoadSaveDealChecks(): void {
    void Metadata;
}
