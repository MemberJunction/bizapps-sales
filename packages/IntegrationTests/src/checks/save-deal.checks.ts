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
    E_EMPLOYEE,
    E_SCHEDULE,
    E_STAGE,
    E_STAGE_EVENT,
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

/**
 * One row, asserted to exist. `TxOne` is the transaction-aware read this bundle uses; this wraps a plain
 * lookup where the absence of a row is a setup failure rather than the thing under test.
 */
async function QueryOneRow<T extends Record<string, unknown>>(
    ctx: Parameters<NamedCheck['Fn']>[0],
    sql: string,
): Promise<T> {
    const row = await TxOne<T>(ctx, sql);
    Assert(!!row, `setup query returned no row: ${sql}`);
    return row;
}

/** How many stage events a deal has. Append-only, so this only ever grows -- which is the point. */
async function stageEventCount(ctx: Parameters<NamedCheck['Fn']>[0], dealID: string): Promise<number> {
    const r = await new RunView().RunView<{ ID: string }>(
        {
            EntityName: E_STAGE_EVENT,
            ExtraFilter: `DealID = '${dealID}'`,
            ResultType: 'simple',
            Fields: ['ID'],
        },
        ctx.User,
    );
    Assert(r.Success, `reading stage events failed -- ${r.ErrorMessage}`);
    return (r.Results ?? []).length;
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
            ExtraFilter: ProductFilterFor(new Date()),
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

/**
 * The order's TOTAL, read from ORDERS rather than computed here.
 *
 * `TotalGross` is maintained by orders' own rollup trigger, so this is the one number the amount cache
 * is allowed to be compared against. A check that multiplied quantity by price to decide what to expect
 * would be breaking Rule 1 to test Rule 1, and would agree with an implementation that made the same
 * mistake.
 */
async function orderTotal(ctx: Parameters<NamedCheck['Fn']>[0], orderID: string): Promise<number | null> {
    const row = await orderRow(ctx, orderID, ['TotalGross']);
    const total = row.TotalGross;
    return total === null || total === undefined ? null : Number(total);
}

/** The embedded order's row, read back through the entity layer. */
/**
 * Raw SQL inside the check's transaction, for the two setups that cannot be expressed as entity saves.
 *
 * The cast is the same one `TxOne` uses and for the same reason: `ExecuteSQL` lives on the DATABASE
 * provider, not on the `IMetadataProvider` interface the check context exposes.
 */
async function execSql(ctx: Parameters<NamedCheck['Fn']>[0], sql: string, why: string): Promise<void> {
    const sqlProvider = ctx.Provider as unknown as {
        ExecuteSQL: (
            sql: string,
            params: Record<string, unknown>,
            options: { isMutation: boolean; description: string },
            user: unknown,
        ) => Promise<unknown>;
    };
    await sqlProvider.ExecuteSQL(sql, {}, { isMutation: true, description: why }, ctx.User);
}

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
                 *   const survivor = after.find((r) => String(r.ID) === String(before[0].ID));
                 *   Assert(!!survivor, 'the surviving line is the one that was KEPT, not merely one of the two');
                 *   AssertEqual(Number(survivor.LineNumber), 1, 'what remains was re-sequenced');
                 *
                 * NOTE THE `find`, AND DO NOT SIMPLIFY IT BACK. The earlier draft of this list read
                 * `after[0].ProductID` compared against `before[0].ProductID` — indexing a collection and
                 * then asserting WHICH row it is. That is the defect twice found and fixed elsewhere
                 * (close-won-tasks WT1, activities AC13): it passes until the row order shifts, then fails
                 * somewhere unrelated to its subject. Restoring the list verbatim would have reintroduced
                 * it the day KI-20 is fixed. Identify the row, then assert about it.
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
                 * Rule 1 exists to stop.
                 *
                 * ── BUT NON-NULL WAS NOT A CLAIM AT ALL, AND THAT WENT UNNOTICED ────────────────────
                 *
                 * The reasoning above is right and the assertion that followed it was empty.
                 * `__mj_BizAppsOrders.OrderLine.UnitPrice` is **NOT NULL** (verified against the live
                 * schema), so `UnitPrice !== null` is guaranteed by the database before any code runs.
                 * The check could not fail. It read as the app's central guarantee and asserted nothing.
                 *
                 * **Zero is not null.** A pricing bridge that returned 0.00 for every line — a resolver
                 * that silently found no price, a catalogue lookup that missed, an integration returning
                 * an empty envelope — satisfied every check in this repo and every assertion in the
                 * browser suite. That is the one failure mode Rule 1 exists to make impossible, and it
                 * was the one nothing looked for.
                 *
                 * `> 0` is the strongest claim sales can make WITHOUT knowing a price: it says orders
                 * returned a real number, not that it returned any particular one. It stays honest about
                 * the boundary — this repo still does not know what a thing costs — while refusing the
                 * one answer that means the engine did not actually price anything.
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
                Assert(
                    Number(row.UnitPrice) > 0,
                    'ORDERS priced it with a REAL figure — sales sent no price, and zero would mean the '
                    + 'engine priced nothing',
                );
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

    {
        Id: 'save-deal.SD21',
        Name: 'SD21: Deal.Amount is CACHED from the order total, with provenance stamped',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * THE DEFECT THIS CHECK EXISTS FOR WAS VISIBLE ON A DASHBOARD FOR DAYS.
                 *
                 * `Amount` cached an `Orders.PreviewOrder` answer and `AmountSourceHash` fingerprinted the
                 * `DealLine` set. `DealLine` is retired, so nothing repopulated it — and it did not go
                 * blank, it kept its last value. A pipeline figure with no relationship to the order
                 * underneath it, reported by the dashboard and the board as fact.
                 *
                 * The number is asserted against `OrderHeader.TotalGross` rather than against a figure
                 * this check computes. That is the whole point: if this check multiplied quantity by price
                 * to know what to expect, it would be doing the thing Rule 1 forbids and would agree with
                 * a wrong implementation that made the same mistake.
                 */
                const f = await ResolveSalesFixture(ctx);
                const deal = await newDeal(ctx, f, (d) => { d.Name = 'SD21 amount cache'; });
                await twoLines(ctx, deal);
                await saveOk(deal, 'the composed save');

                const [order] = await orderLines(ctx, deal.OrderID as string, ['ID']);
                Assert(!!order, 'the order has lines to total');

                const stored = await TxOne<{ Amount: number; AmountIsComputed: boolean; AmountSourceHash: string }>(
                    ctx,
                    `SELECT Amount, AmountIsComputed, AmountSourceHash FROM ${SALES_SCHEMA}.Deal WHERE ID = '${deal.ID}'`,
                );
                const total = await orderTotal(ctx, deal.OrderID as string);

                Assert(total !== null, 'the order carries a TotalGross for the amount to come from');
                AssertEqual(
                    Number(stored.Amount),
                    Number(total),
                    'Deal.Amount equals the order total ORDERS computed — sales added nothing up',
                );
                Assert(stored.AmountIsComputed === true, 'and it is marked COMPUTED, so a surface knows it is a cache');
                Assert(
                    !!stored.AmountSourceHash && stored.AmountSourceHash.length === 64,
                    `the source fingerprint is stamped, got '${stored.AmountSourceHash}'`,
                );
            }),
    },
    {
        Id: 'save-deal.SD22',
        Name: 'SD22: a HAND-TYPED amount is never overwritten by a computed one',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * L-2's SIMPLE DEAL, and the rule that keeps the provenance columns honest.
                 *
                 * `AmountIsComputed = 0` means a human typed the figure and is owed no explanation — the
                 * D2C motion works exactly this way, `RequiresDealLines = 0` and the amount entered by
                 * hand. A cache refresh that overwrote it would silently replace somebody's negotiated
                 * number with an order total, and they would find out from a report.
                 *
                 * The trap: the column DEFAULTS to 0, so "0" alone cannot mean hand-typed. What
                 * distinguishes them is whether an amount is actually there. SD21 covers the NULL case
                 * (filled, and marked computed); this covers the typed one.
                 */
                const f = await ResolveSalesFixture(ctx);
                const deal = await newDeal(ctx, f, (d) => {
                    d.Name = 'SD22 hand-typed';
                    d.Amount = 250000;
                    d.AmountIsComputed = false;
                });
                await twoLines(ctx, deal);
                await saveOk(deal, 'the save');

                const total = await orderTotal(ctx, deal.OrderID as string);
                Assert(total !== null && Number(total) !== 250000, `the order total must DIFFER from the typed figure, got ${total}`);

                const stored = await TxOne<{ Amount: number; AmountIsComputed: boolean; AmountSourceHash: string | null }>(
                    ctx,
                    `SELECT Amount, AmountIsComputed, AmountSourceHash FROM ${SALES_SCHEMA}.Deal WHERE ID = '${deal.ID}'`,
                );
                AssertEqual(Number(stored.Amount), 250000, 'the typed figure survived a save that had every reason to overwrite it');
                Assert(stored.AmountIsComputed === false, 'and it is still marked hand-typed');
                Assert(
                    stored.AmountSourceHash === null || stored.AmountSourceHash === undefined,
                    'with no source fingerprint, because it came from a person and not a computation',
                );
            }),
    },
    {
        Id: 'save-deal.SD23',
        Name: 'SD23: an order with no priced lines leaves the amount ALONE, rather than writing zero',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * "NOBODY HAS SAID YET" AND "PRICED AT NIL" ARE DIFFERENT ANSWERS, and a header-only deal
                 * is the first one. Writing 0 with `AmountIsComputed = 1` would state the second, and
                 * would also lock the deal out of ever being hand-typed — because a computed amount is a
                 * cache, and the cache is refreshed.
                 *
                 * This is the lineless motion S-US4 explicitly supports, so it is not an edge case: it is
                 * how every D2C deal starts.
                 */
                const f = await ResolveSalesFixture(ctx);
                const deal = await newDeal(ctx, f, (d) => { d.Name = 'SD23 no lines'; });
                await saveOk(deal, 'the save');

                Assert(!!deal.OrderID, 'the deal still provisioned an order');
                AssertEqual(await orderTotal(ctx, deal.OrderID as string), null, 'whose total is NULL — nothing priced');

                const stored = await TxOne<{ Amount: number | null; AmountIsComputed: boolean }>(
                    ctx, `SELECT Amount, AmountIsComputed FROM ${SALES_SCHEMA}.Deal WHERE ID = '${deal.ID}'`,
                );
                Assert(
                    stored.Amount === null || stored.Amount === undefined,
                    `the amount stays unset, not zero — got ${String(stored.Amount)}`,
                );
                Assert(stored.AmountIsComputed === false, 'and it is not claimed as computed');
            }),
    },
    {
        Id: 'save-deal.SD24',
        Name: 'SD24: an EXISTING deal with no order gets one on its next save',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * THE MIGRATION CASE, and it was broken until 2026-08-20.
                 *
                 * `provisionEmbeddedOrder()` returned early on `IsSaved`, so an order could only ever be
                 * created on a deal's FIRST save. Any deal that already existed without one could never
                 * acquire one — which is every SQL-seeded demo deal and every deal created before S-US4
                 * landed. Worse than merely missing: reaching for `OrderID_EnsureObject()` on such a deal
                 * built an UNSTAMPED order, and the save died inside orders on `CompanyID cannot be null`,
                 * two apps away from the cause. `scripts/seed-demo-lines.mjs` failed on four of five deals
                 * before this was fixed.
                 *
                 * The FK is cleared here rather than a deal being created without one, because
                 * provisioning now happens on the first save and there is no other way to reach the state
                 * a pre-redesign row is in.
                 */
                const f = await ResolveSalesFixture(ctx);
                const created = await newDeal(ctx, f, (d) => { d.Name = 'SD24 late provisioning'; });
                await saveOk(created, 'create');
                const firstOrder = created.OrderID;
                Assert(!!firstOrder, 'the deal provisioned an order on creation');

                // Now make it look like a deal from before the redesign: saved, and pointing at nothing.
                await execSql(
                    ctx,
                    `UPDATE ${SALES_SCHEMA}.Deal SET OrderID = NULL WHERE ID = '${created.ID}'`,
                    'SD24: simulate a pre-S-US4 deal',
                );
                const stale = await TxOne<{ OrderID: string | null }>(
                    ctx, `SELECT OrderID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${created.ID}'`,
                );
                Assert(!stale.OrderID, 'the deal now has no order, like a row that predates provisioning');

                const reopened = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await reopened.Load(created.ID), 'the order-less deal loads');
                reopened.NextStep = 'anything, so there is something to save';
                await saveOk(reopened, 'the save that should provision');

                const after = await TxOne<{ OrderID: string | null }>(
                    ctx, `SELECT OrderID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${created.ID}'`,
                );
                Assert(!!after.OrderID, 'an order was provisioned on a deal that already existed');
                Assert(
                    String(after.OrderID).toLowerCase() !== String(firstOrder).toLowerCase(),
                    'and it is a NEW order — the old one was orphaned by the UPDATE, not re-attached',
                );

                const row = await orderRow(ctx, after.OrderID as string, ['CompanyID', 'OrderType']);
                AssertEqual(
                    String(row.CompanyID).toLowerCase(),
                    f.PipelineCompanyID.toLowerCase(),
                    'STAMPED, which is the half that was failing: an unstamped order dies on CompanyID',
                );
                AssertEqual(String(row.OrderType), 'Sale', 'and carries the type sales states');
            }),
    },
    {
        Id: 'save-deal.SD25',
        Name: 'SD25: a provisioned order takes the status its STAGE declares, not Draft',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * THE HALF SD24 DOES NOT COVER, found by the story audit against seeded data rather than
                 * by reading: `DEAL-9003` sat at Proposal — a stage declaring `Quoted` — with its order
                 * in `Draft`.
                 *
                 * The status writer keys on `PipelineStageID` CHANGING, which is right for a move and
                 * wrong for a birth. A deal already at or above the agreement threshold when its order
                 * is provisioned never moved, so nothing ever asked the stage what the order should be,
                 * and the board displayed the mismatch without complaint. It would have hit every deal
                 * the HubSpot import lands past Proposal (S6).
                 *
                 * The stage is given an opinion HERE rather than relying on a seeded one, so the check
                 * does not depend on which pipelines a host happens to carry. The transaction rolls
                 * back, so the stage keeps whatever it had.
                 */
                const f = await ResolveSalesFixture(ctx);
                await execSql(
                    ctx,
                    `UPDATE ${SALES_SCHEMA}.PipelineStage SET OrderStatusOnEntry = 'Quoted' WHERE ID = '${f.StageID}'`,
                    'SD25: give the stage an opinion about the order',
                );

                const created = await newDeal(ctx, f, (d) => { d.Name = 'SD25 provisioned at a declaring stage'; });
                await saveOk(created, 'create');

                // Back to the pre-S-US4 state: saved, at this stage, pointing at no order.
                await execSql(
                    ctx,
                    `UPDATE ${SALES_SCHEMA}.Deal SET OrderID = NULL WHERE ID = '${created.ID}'`,
                    'SD25: simulate a deal that predates provisioning',
                );

                const reopened = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await reopened.Load(created.ID), 'the order-less deal loads');
                // Deliberately NOT a stage change: the whole point is that nothing moved.
                reopened.NextStep = 'a header edit, so the stage stays exactly where it is';
                await saveOk(reopened, 'the save that provisions');

                const after = await TxOne<{ OrderID: string | null; PipelineStageID: string }>(
                    ctx,
                    `SELECT OrderID, PipelineStageID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${created.ID}'`,
                );
                Assert(!!after.OrderID, 'an order was provisioned');
                AssertEqual(
                    String(after.PipelineStageID).toLowerCase(),
                    f.StageID.toLowerCase(),
                    'and the stage did not move — otherwise this would be testing a move, not a birth',
                );

                const row = await orderRow(ctx, after.OrderID as string, ['Status']);
                AssertEqual(
                    String(row.Status),
                    'Quoted',
                    'the new order took the status the stage declares. Draft here means provisioning ' +
                        'never asked the stage, which is the DEAL-9003 defect',
                );
            }),
    },
    {
        Id: 'save-deal.SD26',
        Name: 'SD26: a hand-set OwnerEmployeeID is REFUSED, not silently overwritten',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * S-US1 says the owner column "cannot be edited directly", and until this check existed
                 * it could — on the quieter of two paths, which is why nothing caught it.
                 *
                 * `stampOwnerFromTeam()` only re-derives the stamp when the ROSTER took part in the
                 * save, and that guard is right: without it an ordinary header edit would read an
                 * unloaded collection as "no owner" and clear the stamp. But it meant a header-only save
                 * carrying a hand-set stamp KEPT it, with no error — leaving the owner column and the
                 * owner-role team row naming different people. The stamp exists so per-rep rollups need
                 * no join, so a rollup could then disagree with the roster it was meant to shortcut.
                 * Proven against the database by `scripts/audit-story-evidence.mjs` (E3).
                 *
                 * ASSERTED AS A REFUSAL, NOT A CORRECTION. A save that quietly fixed the value would
                 * produce the same surprise — the owner is not who the caller said — with nothing to
                 * notice. `SD3` covers the legitimate path, `SetOwner()`, which is untouched by this:
                 * it loads the roster first, so the roster IS part of that save.
                 */
                const f = await ResolveSalesFixture(ctx);
                const created = await newDeal(ctx, f, (d) => { d.Name = 'SD26 owner stamp is not writable'; });
                await saveOk(created, 'create');

                const before = await TxOne<{ OwnerEmployeeID: string | null }>(
                    ctx, `SELECT OwnerEmployeeID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${created.ID}'`,
                );

                const other = await new RunView().RunView<{ ID: string }>(
                    {
                        EntityName: E_EMPLOYEE,
                        ExtraFilter: `Active = 1 AND ID <> '${f.EmployeeID}'`,
                        ResultType: 'simple',
                        Fields: ['ID'],
                    },
                    ctx.User,
                );
                Assert(other.Success, `reading employees failed — ${other.ErrorMessage}`);
                const otherID = (other.Results ?? [])[0]?.ID;
                Assert(!!otherID, 'the host needs a second active employee for this check to mean anything');

                // A HEADER-ONLY save: the roster is deliberately never loaded or touched.
                const edited = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await edited.Load(created.ID), 'the deal reloads');
                edited.OwnerEmployeeID = otherID;
                AssertEqual(await edited.Save(), false, 'setting the stamp directly must be REFUSED');

                const after = await TxOne<{ OwnerEmployeeID: string | null }>(
                    ctx, `SELECT OwnerEmployeeID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${created.ID}'`,
                );
                AssertEqual(
                    String(after.OwnerEmployeeID ?? '').toLowerCase(),
                    String(before.OwnerEmployeeID ?? '').toLowerCase(),
                    'and the stored stamp is exactly what it was — a refused save writes nothing',
                );

                /**
                 * AND THE REFUSAL IS NARROW. The same deal, the same header-only shape, a field that IS
                 * the caller's to set — this must still save. A guard that refused every header edit
                 * would pass the assertion above and break the app.
                 */
                const ordinary = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await ordinary.Load(created.ID), 'the deal reloads again');
                ordinary.NextStep = 'an ordinary header edit, which must still be allowed';
                await saveOk(ordinary, 'a header-only save that touches nothing server-owned');
            }),
    },
    {
        Id: 'save-deal.SD27',
        Name: 'SD27: a permitted edit to a LOCKED deal provisions NO order',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * THE LOCK AND THE PROVISIONER COULD NOT SEE EACH OTHER.
                 *
                 * `Description` is deliberately editable while locked, so a permitted edit passes the lock
                 * and reaches the rest of `Save()`. Provisioning then ran unconditionally: a closed legacy
                 * deal with no order got an empty Draft one INSERTED, `Deal.OrderID` rewritten on a frozen
                 * row, and the stage writer free to stamp that order from the CLOSING stage — `Voided`,
                 * for a lost deal. Three writes to provenance that is supposed to be immutable, from
                 * editing a description.
                 *
                 * The state is reached in SQL because there is no other way to get there: a deal that
                 * predates provisioning is exactly what the app can no longer create.
                 *
                 * ── HOW TO MAKE THIS FAIL ── remove the `if (!this._lockedAtSave)` guard around
                 * `provisionEmbeddedOrder()`.
                 */
                const f = await ResolveSalesFixture(ctx);
                const created = await newDeal(ctx, f, (d) => { d.Name = 'SD27 locked legacy deal'; });
                await saveOk(created, 'create');

                const lockingStatus = await TxOne<{ ID: string }>(
                    ctx,
                    `SELECT TOP 1 ID FROM ${SALES_SCHEMA}.DealStatusType WHERE LocksDeal = 1 AND IsActive = 1`,
                );
                Assert(!!lockingStatus.ID, 'setup: a locking status is required');

                // The legacy shape: locked, and pointing at no order. Both in SQL, so the app never had a
                // chance to provision on the way in.
                await execSql(
                    ctx,
                    `UPDATE ${SALES_SCHEMA}.Deal SET OrderID = NULL, DealStatusTypeID = '${lockingStatus.ID}'
                      WHERE ID = '${created.ID}'`,
                    'SD27: a closed deal that predates order provisioning',
                );

                const ordersBefore = await TxOne<{ N: number }>(
                    ctx, `SELECT COUNT(*) AS N FROM __mj_BizAppsOrders.OrderHeader`,
                );

                const edited = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await edited.Load(created.ID), 'the locked deal loads');
                edited.Description = 'SD27: a permitted edit to a frozen deal';
                await saveOk(edited, 'the permitted edit must be allowed — the lock is field-by-field');

                const after = await TxOne<{ OrderID: string | null }>(
                    ctx, `SELECT OrderID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${created.ID}'`,
                );
                AssertEqual(
                    after.OrderID,
                    null,
                    'a locked deal must NOT acquire an order from a description edit — rewriting OrderID on ' +
                        'a frozen row is a change to the record of what was agreed',
                );

                const ordersAfter = await TxOne<{ N: number }>(
                    ctx, `SELECT COUNT(*) AS N FROM __mj_BizAppsOrders.OrderHeader`,
                );
                AssertEqual(
                    Number(ordersAfter.N),
                    Number(ordersBefore.N),
                    'and no empty Draft order may be inserted into orders at all',
                );
            }),
    },
    {
        Id: 'save-deal.SD28',
        Name: 'SD28: an order with NO LINES is not "priced at zero" — the amount stays untouched',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * WHAT THIS ACTUALLY PINS, after the premise it was written for turned out to be wrong.
                 *
                 * It was written to catch "an empty order caches Amount = 0, AmountIsComputed = 1",
                 * on the stated grounds that orders' rollup is `SUM(ISNULL(l.LineTotal, 0))` and so
                 * returns 0. Measured: `OrderHeader.TotalGross` is **NULL** for an order with no lines,
                 * because `SUM` over no rows is NULL whatever the inner `ISNULL` does — and
                 * `OrderLine.UnitPrice` is NOT NULL, so a line cannot exist unpriced either. The 0 case
                 * is unreachable on this schema, and a guard written for it was removed rather than
                 * shipped as dead code in a money path.
                 *
                 * The check is KEPT because the behaviour is worth pinning on its own terms: an empty
                 * order must leave the amount alone, starting from a NULL amount — which is the state
                 * SD23 never reaches, since its fixture already carries a hand-typed figure and returns
                 * at the earlier guard. If `UnitPrice` ever becomes nullable, this is the check that will
                 * need a sibling for the lines-present-but-unpriced case.
                 *
                 * ── THE ORIGINAL NOTE, kept because the reasoning about WHY 0-marked-computed is bad
                 * still stands and is the reason to care ──
                 *
                 * `refreshAmountFromOrder` skipped when `TotalGross` was null, and its comment claimed
                 * that covered "no priced lines". It never did: orders' rollup is
                 * `SUM(ISNULL(l.LineTotal, 0))`, so an order with nothing on it returns **0**. Zero is
                 * finite, so it passed the guard and cached `Amount = 0, AmountIsComputed = 1`.
                 *
                 * That is worse than a stale figure in two ways. The priced/stated split counts the deal
                 * as PRICED at nothing — the very "computed amount of nothing" the method's own comment
                 * calls worse than either honest answer. And it permanently destroys the hand-typed
                 * protection: once `AmountIsComputed` is 1, the guard that refuses to overwrite a human's
                 * number no longer applies to that deal.
                 *
                 * SD23 did not catch it because its fixture already carries a hand-typed amount, so it
                 * returns at the earlier guard and never reaches this one. This check starts from a NULL
                 * amount, which is the state that exposes it.
                 *
                 * ── HOW TO MAKE THIS FAIL ── delete the `total === null` guard in
                 * `refreshAmountFromOrder`. That is the guard that actually carries this case.
                 */
                const f = await ResolveSalesFixture(ctx);
                const created = await newDeal(ctx, f, (d) => {
                    d.Name = 'SD28 no lines, no price';
                    d.Amount = null;
                });
                await saveOk(created, 'create');

                const lines = await orderLines(ctx, String(created.OrderID), ['ID']);
                AssertEqual(lines.length, 0, 'setup: this deal must have NO order lines');

                const row = await TxOne<{ Amount: number | null; AmountIsComputed: boolean; Hash: string | null }>(
                    ctx,
                    `SELECT Amount, AmountIsComputed, AmountSourceHash AS Hash FROM ${SALES_SCHEMA}.Deal
                      WHERE ID = '${created.ID}'`,
                );
                AssertEqual(
                    row.Amount,
                    null,
                    'an order with no lines must leave the amount NULL — 0 marked computed says the deal ' +
                        'was priced at nothing, which is a different and false claim',
                );
                AssertEqual(
                    row.AmountIsComputed === true,
                    false,
                    'and must NOT stamp AmountIsComputed, which is what destroys the hand-typed protection',
                );
                AssertEqual(row.Hash, null, 'and must write no source hash for a figure it did not compute');
            }),
    },
    {
        Id: 'save-deal.SD29',
        Name: 'SD29: a deal number drawn inside a ROLLED-BACK save does not survive in memory',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * THE DEAL THAT COULD NEVER BE SAVED AGAIN.
                 *
                 * `DealNumber` is drawn from the sequence inside the save's scope. When the save then
                 * failed, the rollback returned the counter but the value stayed on the in-memory record —
                 * and `Save()` decides whether to draw one by asking `this.IsSaved || this.DealNumber`. So
                 * the retry took the `assignNumber: false` branch and re-inserted a number the sequence
                 * had already re-issued.
                 *
                 * The deal was unsaveable for the life of the tab, and the error named a unique index on
                 * DealNumber — a field the rep had never touched — instead of whatever failed first.
                 *
                 * The failure is forced by breaking a NOT NULL the entity validates: that fails inside
                 * `super.Save`, which is exactly where a real failure lands, AFTER the number is drawn.
                 *
                 * ── HOW TO MAKE THIS FAIL ── remove `this.DealNumber = null` from the rollback branch.
                 */
                const f = await ResolveSalesFixture(ctx);
                const deal = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                deal.NewRecord();
                deal.Name = 'SD29 rolled back numbering';
                deal.PipelineID = f.PipelineID;
                deal.PipelineStageID = f.StageID;
                deal.DealTypeID = f.DealTypeID;
                deal.DealStatusTypeID = f.OpenStatusID;
                deal.AccountID = f.AccountID;

                // Invalid on purpose: Name is NOT NULL, so `super.Save` refuses AFTER the number is drawn.
                deal.Name = null as unknown as string;

                AssertEqual(await deal.Save(), false, 'the save must fail — that is the premise of the check');
                AssertEqual(
                    deal.DealNumber ?? null,
                    null,
                    'and the number must be cleared, or the retry re-inserts one the sequence has re-issued ' +
                        'and the deal is unsaveable until the tab is recreated',
                );
            }),
    },
    {
        Id: 'save-deal.SD30',
        Name: 'SD30: a deal whose stage is chosen TWICE before its first save gets NO stage event',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * ── A BIRTH IS NOT A MOVE, AND `OldValue` WAS THE WRONG WAY TO ASK ──────────────────
                 *
                 * `planStageEvent` inferred "this deal is new, so it owes no event" from
                 * `OldValue === null`. On MJ's create semantics the FIRST assignment becomes the
                 * `OldValue` — so a new deal whose stage is set twice before `Save()` looked exactly like
                 * a deal that had MOVED, and one row went into an append-only log describing a transition
                 * out of a stage the deal was never in.
                 *
                 * That is not a contrived sequence: it is what the workspace does. `NewDeal()` preselects
                 * a pipeline and its first stage so the form opens with something valid, and then the rep
                 * picks the stage they actually want. Every deal created through the UI that way carried a
                 * fictional event.
                 *
                 * `BD1` asserts a new deal owes no event and stayed green throughout, because it assigns
                 * the stage ONCE. The difference between the two checks is the second assignment, and that
                 * is the whole defect.
                 */
                const f = await ResolveSalesFixture(ctx);

                const stages = await new RunView().RunView<{ ID: string }>(
                    {
                        EntityName: E_STAGE,
                        ExtraFilter: `PipelineID = '${f.PipelineID}' AND ID <> '${f.StageID}'`,
                        OrderBy: 'DisplayOrder DESC',
                        ResultType: 'simple',
                        Fields: ['ID'],
                    },
                    ctx.User,
                );
                Assert(stages.Success, `reading stages failed — ${stages.ErrorMessage}`);
                const secondChoice = (stages.Results ?? [])[0]?.ID;
                Assert(!!secondChoice, 'the fixture pipeline needs a second stage for this check to mean anything');

                // THE SEQUENCE, EXACTLY AS THE WORKSPACE PRODUCES IT: preselected, then changed.
                const created = await newDeal(ctx, f, (d) => { d.Name = 'SD30 stage chosen twice'; });
                created.PipelineStageID = secondChoice;
                await saveOk(created, 'create with a stage the rep changed their mind about');

                AssertEqual(
                    await stageEventCount(ctx, created.ID),
                    0,
                    'a deal being CREATED owes no stage event, however many times its stage was set',
                );

                // And the stage that was actually chosen is the one stored — a guard that fixed the event
                // by ignoring the second assignment would be worse than the bug.
                const row = await TxOne<{ PipelineStageID: string }>(
                    ctx, `SELECT PipelineStageID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${created.ID}'`,
                );
                AssertEqual(
                    String(row.PipelineStageID).toLowerCase(),
                    String(secondChoice).toLowerCase(),
                    'and the deal is in the stage the rep chose second',
                );
            }),
    },
    {
        Id: 'save-deal.SD31',
        Name: 'SD31: a hand-set OwnerEmployeeID is refused ON CREATE too, not just on edit',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * ── SD26'S RULE, ON THE PATH SD26 COULD NOT REACH ───────────────────────────────────
                 *
                 * SD26 proves a hand-set owner stamp is refused on an EDIT. The refusal asked
                 * `GetFieldByName('OwnerEmployeeID').Dirty`, which is the right question on an update and
                 * useless on a create: a first assignment does not mark a field dirty, so an importer
                 * doing `NewRecord()` -> `OwnerEmployeeID = X` -> `Save()` walked straight past the guard
                 * and created the exact state SD26 exists to forbid — an owner column and an owner-role
                 * roster naming different people, on the highest-volume path there is.
                 *
                 * Both places now ask `callerSuppliedValue`, which knows that on a create the question is
                 * "is there a value here" rather than "did this save change it".
                 */
                const f = await ResolveSalesFixture(ctx);

                const other = await new RunView().RunView<{ ID: string }>(
                    {
                        EntityName: E_EMPLOYEE,
                        ExtraFilter: `Active = 1 AND ID <> '${f.EmployeeID}'`,
                        ResultType: 'simple',
                        Fields: ['ID'],
                    },
                    ctx.User,
                );
                Assert(other.Success, `reading employees failed — ${other.ErrorMessage}`);
                const otherID = (other.Results ?? [])[0]?.ID;
                Assert(!!otherID, 'the host needs a second active employee for this check to mean anything');

                const created = await newDeal(ctx, f, (d) => {
                    d.Name = 'SD31 owner stamp on create';
                    d.OwnerEmployeeID = otherID;
                });
                AssertEqual(
                    await created.Save(),
                    false,
                    'setting the owner stamp on a NEW deal must be refused, exactly as on an edit',
                );

                // A refused create writes nothing at all.
                const rows = await new RunView().RunView<{ ID: string }>(
                    {
                        EntityName: E_DEAL,
                        ExtraFilter: `Name = 'SD31 owner stamp on create'`,
                        ResultType: 'simple',
                        Fields: ['ID'],
                    },
                    ctx.User,
                );
                Assert(rows.Success, `reading deals failed — ${rows.ErrorMessage}`);
                AssertEqual((rows.Results ?? []).length, 0, 'and no deal row was written');

                /**
                 * AND THE REFUSAL IS STILL NARROW — the same create WITHOUT the stamp must succeed. The
                 * server fills it from the roster, which is the whole reason the column is not writable.
                 */
                const clean = await newDeal(ctx, f, (d) => { d.Name = 'SD31 ordinary create'; });
                await saveOk(clean, 'a create that leaves the server-owned stamp alone');
            }),
    },
    {
        Id: 'save-deal.SD32',
        Name: 'SD32: re-stating the SAME stage in a different letter case is not a move',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * ── A GUID IS A GUID IN EITHER CASE, AND ONE OF THREE WRITERS DISAGREED ─────────────
                 *
                 * `planStageEvent` compared the prior stage id to the new one with `===`, while the two
                 * writers either side of it — the order-status writer and the defaults writer — both
                 * lowercased first. SQL Server renders `uniqueidentifier` in UPPER case and client code
                 * generates lower, so any caller that normalised its ids on the way in was telling the
                 * server "the stage is unchanged" and being recorded as having MOVED THE DEAL TO THE STAGE
                 * IT WAS ALREADY IN — a self-transition, in an append-only log that cannot be corrected.
                 *
                 * Importers, Actions and anything round-tripping a deal through JSON all normalise. This
                 * is the shape of that save: load, re-state the same stage in the other case, save.
                 */
                const f = await ResolveSalesFixture(ctx);
                const created = await newDeal(ctx, f, (d) => { d.Name = 'SD32 same stage, other case'; });
                await saveOk(created, 'create');

                const stored = await TxOne<{ PipelineStageID: string }>(
                    ctx, `SELECT PipelineStageID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${created.ID}'`,
                );
                const asStored = String(stored.PipelineStageID);
                const flipped = asStored === asStored.toUpperCase() ? asStored.toLowerCase() : asStored.toUpperCase();
                Assert(
                    flipped !== asStored && flipped.toLowerCase() === asStored.toLowerCase(),
                    'setup: the flipped id must differ only in case',
                );

                const before = await stageEventCount(ctx, created.ID);

                const edited = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await edited.Load(created.ID), 'the deal reloads');
                edited.PipelineStageID = flipped;
                edited.NextStep = 'a normalised save that changes nothing about the stage';
                await saveOk(edited, 'a save that re-states the same stage in the other case');

                AssertEqual(
                    await stageEventCount(ctx, created.ID),
                    before,
                    'no event: the deal did not move, so the log must say nothing',
                );
            }),
    },
    {
        Id: 'save-deal.SD33',
        Name: 'SD33: a deal created with NO status takes the one its STAGE declares',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * ── A DEAL WITH NO STATUS IS INVISIBLE, AND NOTHING USED TO GIVE IT ONE ─────────────
                 *
                 * `NewDeal()` seeds no status and the column is nullable with no default, so a rep who
                 * never touched the Status select saved a deal that every `IsOpen`/`IsWon` rollup skipped
                 * — and while the roster and summary queries INNER JOINed that FK, invisible to every
                 * surface in the app. `PipelineStage.DealStatusTypeID` is seeded on every stage and the
                 * pipeline board already reads it as authoritative for `IsClosing`; this is the write path
                 * agreeing with the reader.
                 */
                const f = await ResolveSalesFixture(ctx);
                const stage = await QueryOneRow<{ DealStatusTypeID: string | null }>(
                    ctx, `SELECT DealStatusTypeID FROM ${SALES_SCHEMA}.PipelineStage WHERE ID = '${f.StageID}'`,
                );
                Assert(
                    !!stage.DealStatusTypeID,
                    'the fixture stage must declare a status, or this rule cannot be exercised',
                );

                const created = await newDeal(ctx, f, (d) => {
                    d.Name = 'SD33 status from the stage';
                    d.DealStatusTypeID = null;   // exactly what the workspace produces
                });
                await saveOk(created, 'create with no status');

                const row = await TxOne<{ DealStatusTypeID: string | null }>(
                    ctx, `SELECT DealStatusTypeID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${created.ID}'`,
                );
                AssertEqual(
                    String(row.DealStatusTypeID ?? '').toLowerCase(),
                    String(stage.DealStatusTypeID).toLowerCase(),
                    'the deal takes the status its stage declares — a NULL here is a deal no rollup counts',
                );
            }),
    },
    {
        Id: 'save-deal.SD34',
        Name: 'SD34: a status the caller STATED survives a stage move in the same save',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * THE OTHER HALF OF SD33, and the half that makes it fill-but-don't-overwrite rather than
                 * a second writer. A caller who states a status keeps it: it arrives dirty, so
                 * `callerSuppliedValue` answers "theirs" and the stage's declaration stands down — the same
                 * rule probability and forecast category follow.
                 *
                 * The status is chosen BY ITS FLAGS: not open, not won, not lost, and not locking. That is
                 * a status no stage in the fixture declares, which is what makes the comparison mean
                 * something — and picking it by flag rather than by name is what keeps this passing on a
                 * host that calls it something else (§3).
                 */
                const f = await ResolveSalesFixture(ctx);
                const held = await QueryOneRow<{ ID: string }>(
                    ctx,
                    `SELECT TOP 1 ID FROM ${SALES_SCHEMA}.DealStatusType
                      WHERE IsActive = 1 AND IsOpen = 0 AND IsWon = 0 AND IsLost = 0 AND LocksDeal = 0
                      ORDER BY DisplayRank`,
                );
                Assert(
                    !!held.ID,
                    'the host needs a non-open, non-closing status for this check to tell the two writers apart',
                );

                const created = await newDeal(ctx, f, (d) => { d.Name = 'SD34 stated status wins'; });
                await saveOk(created, 'create');

                const stages = await new RunView().RunView<{ ID: string; DealStatusTypeID: string | null }>(
                    {
                        EntityName: E_STAGE,
                        ExtraFilter: `PipelineID = '${f.PipelineID}' AND ID <> '${f.StageID}'`,
                        OrderBy: 'DisplayOrder ASC',
                        ResultType: 'simple',
                        Fields: ['ID', 'DealStatusTypeID'],
                    },
                    ctx.User,
                );
                Assert(stages.Success, `reading stages failed — ${stages.ErrorMessage}`);
                const target = (stages.Results ?? [])[0];
                Assert(!!target?.ID, 'the fixture pipeline needs a second stage');
                Assert(
                    String(target!.DealStatusTypeID ?? '').toLowerCase() !== String(held.ID).toLowerCase(),
                    'the arriving stage must declare a DIFFERENT status, or nothing is being distinguished',
                );

                // BOTH in one save — the stage moves and the caller states a status.
                const edited = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await edited.Load(created.ID), 'the deal reloads');
                edited.PipelineStageID = String(target!.ID);
                edited.DealStatusTypeID = String(held.ID);
                await saveOk(edited, 'a stage move carrying a stated status');

                const row = await TxOne<{ DealStatusTypeID: string | null; PipelineStageID: string }>(
                    ctx,
                    `SELECT DealStatusTypeID, PipelineStageID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${created.ID}'`,
                );
                AssertEqual(
                    String(row.DealStatusTypeID ?? '').toLowerCase(),
                    String(held.ID).toLowerCase(),
                    'the STATED status survives — the stage fills what the caller left alone, never overwrites',
                );
                AssertEqual(
                    String(row.PipelineStageID).toLowerCase(),
                    String(target!.ID).toLowerCase(),
                    'and the stage still moved, so this is not passing because nothing happened',
                );
            }),
    },
    {
        Id: 'save-deal.SD35',
        Name: 'SD35: moving into a stage whose status LOCKS does not close the deal',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * ── THE RULE SD33 NEARLY BROKE ──────────────────────────────────────────────────────
                 *
                 * Stages carry no `IsWon`/`IsClosed`; they point at a status that does, so that
                 * "Closed Won" is a LABEL and closing stays an explicit act — `Sales.CloseDeal` — even
                 * when the stage a deal enters is the one a pipeline calls Signed.
                 *
                 * Deriving the stage's status without a gate broke exactly that. The seeded pipelines
                 * declare a LOCKING status on their winning and losing stages, so an ordinary save that
                 * moved a deal there closed it by side effect: locked, `IsWon` set, and none of what a
                 * close owes — no routing, no contract, no tasks, no close event. A board drag would have
                 * booked revenue.
                 *
                 * Nothing in the suite caught it, because until then no stage could close a deal and so no
                 * check ever moved one into a closing stage. This is that check.
                 */
                const f = await ResolveSalesFixture(ctx);

                const closingStage = await QueryOneRow<{ ID: string; DealStatusTypeID: string }>(
                    ctx,
                    `SELECT TOP 1 s.ID, s.DealStatusTypeID
                       FROM ${SALES_SCHEMA}.PipelineStage s
                       JOIN ${SALES_SCHEMA}.DealStatusType t ON t.ID = s.DealStatusTypeID
                      WHERE s.PipelineID = '${f.PipelineID}' AND s.IsActive = 1 AND t.LocksDeal = 1
                      ORDER BY s.DisplayOrder`,
                );
                Assert(
                    !!closingStage.ID,
                    'the fixture pipeline needs a stage declaring a LOCKING status, or this rule cannot be ' +
                        'exercised',
                );

                const created = await newDeal(ctx, f, (d) => { d.Name = 'SD35 a stage cannot close a deal'; });
                await saveOk(created, 'create');
                const before = await TxOne<{ DealStatusTypeID: string }>(
                    ctx, `SELECT DealStatusTypeID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${created.ID}'`,
                );

                // A PLAIN SAVE into the closing stage. Not a close — nobody called Sales.CloseDeal.
                const moved = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await moved.Load(created.ID), 'the deal reloads');
                moved.PipelineStageID = String(closingStage.ID);
                await saveOk(moved, 'a plain stage move into a closing stage');

                const after = await TxOne<{ DealStatusTypeID: string; PipelineStageID: string }>(
                    ctx,
                    `SELECT DealStatusTypeID, PipelineStageID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${created.ID}'`,
                );
                AssertEqual(
                    String(after.PipelineStageID).toLowerCase(),
                    String(closingStage.ID).toLowerCase(),
                    'setup: the stage really did move',
                );
                AssertEqual(
                    String(after.DealStatusTypeID).toLowerCase(),
                    String(before.DealStatusTypeID).toLowerCase(),
                    'the STATUS is untouched — a stage may name the status a deal sits in, never close it',
                );

                // And the deal is still editable, which is the observable consequence of not being closed.
                const edit = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await edit.Load(created.ID), 'the deal reloads again');
                edit.NextStep = 'still editable, because nothing closed it';
                await saveOk(edit, 'an ordinary edit after the move into a closing stage');
            }),
    },
    {
        Id: 'save-deal.SD36',
        Name: 'SD36: a create that never touches Status lands the first OPEN status, not NULL',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * ── A DEAL WITH NO STATUS IS INVISIBLE, NOT MERELY UNTIDY ────────────────────────────
                 *
                 * `DealStatusTypeID` is nullable with no column default, and nothing in the write path
                 * required it. A deal saved without touching Status landed NULL, and every measure that
                 * reads the status through `JOIN DealStatusType` silently did not count it — a tile that
                 * UNDER-REPORTS rather than one that errors, which is the harder kind to notice.
                 *
                 * Asserted as the resolved vocabulary row rather than a hardcoded name, because the whole
                 * point is that the opening status is DATA. The expected value is computed the same way
                 * the server computes it, so a tenant that renames or re-ranks its statuses moves both
                 * together and this check keeps meaning the same thing.
                 */
                const f = await ResolveSalesFixture(ctx);
                const expected = await TxOne<{ ID: string }>(
                    ctx,
                    `SELECT TOP 1 ID FROM ${SALES_SCHEMA}.DealStatusType
                      WHERE IsActive = 1 AND IsOpen = 1 AND LocksDeal = 0 ORDER BY DisplayRank ASC`,
                );
                Assert(!!expected?.ID, 'setup: the host needs an active, open, non-locking status');

                /**
                 * ── CREATED IN A CLOSING STAGE, AND THAT IS THE ONLY HONEST FIXTURE ────────────────────
                 *
                 * The first version of this check created in the FIXTURE stage and was VACUOUS: `M-DS1`
                 * disabled the new default and SD36 stayed green, because the fixture stage declares an
                 * open status and `applyStageDefaults` had already filled it. The check was measuring
                 * code that predates the fix.
                 *
                 * A stage whose status LOCKS is the case only this default can serve: `planStageDefaults`
                 * deliberately contributes nothing there (it would close the deal), so the status is still
                 * null when the fallback runs. That makes the mutant land — and it asserts the safety
                 * property at the same time: a deal born in a winning stage comes out OPEN, not Won.
                 */
                const closingStage = await QueryOneRow<{ ID: string }>(
                    ctx,
                    `SELECT TOP 1 s.ID
                       FROM ${SALES_SCHEMA}.PipelineStage s
                       JOIN ${SALES_SCHEMA}.DealStatusType t ON t.ID = s.DealStatusTypeID
                      WHERE s.PipelineID = '${f.PipelineID}' AND s.IsActive = 1 AND t.LocksDeal = 1
                      ORDER BY s.DisplayOrder`,
                );
                Assert(
                    !!closingStage.ID,
                    'the fixture pipeline needs a stage declaring a LOCKING status, or the stage default '
                        + 'would cover this case and the check would prove nothing',
                );

                const created = await newDeal(ctx, f, (d) => {
                    d.Name = 'SD36 no status supplied';
                    // The gap exactly: a rep who never opened the Status select...
                    d.DealStatusTypeID = null;
                    // ...in the one stage whose own status cannot be borrowed.
                    d.PipelineStageID = String(closingStage.ID);
                });
                await saveOk(created, 'a create with no status, in a closing stage');

                const row = await TxOne<{ DealStatusTypeID: string | null }>(
                    ctx, `SELECT DealStatusTypeID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${created.ID}'`,
                );
                Assert(
                    !!row.DealStatusTypeID,
                    'the deal must not be saved with a NULL status — every status JOIN drops such a row, '
                        + 'so it exists and no measure counts it',
                );
                AssertEqual(
                    String(row.DealStatusTypeID).toLowerCase(),
                    String(expected.ID).toLowerCase(),
                    'and it must be the first ACTIVE, OPEN, NON-LOCKING status by rank. This deal sits in '
                        + 'a WINNING stage and must still be OPEN: a stage-derived default would have booked '
                        + 'it on creation, and a board drag would book revenue',
                );
            }),
    },
    {
        Id: 'save-deal.SD37',
        Name: 'SD37: the status default is creation-only and never overrides a caller',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * ── THE TWO DIRECTIONS SD36 CANNOT SEE ────────────────────────────────────────────
                 *
                 * SD36 would still pass if the default fired unconditionally — overwriting a status the
                 * rep chose, and re-filling one deliberately cleared on a later save. Both are worse than
                 * the gap: the first silently discards a decision, the second makes a field impossible to
                 * empty. So each is asserted in its own direction.
                 *
                 * The second half is what makes this creation-only rather than merely create-first: on an
                 * update the deal is `IsSaved`, so the default is not even considered, and clearing the
                 * status has to STICK. That is also what keeps this writer out of `applyStageDefaults`'
                 * way, which owns the status on a stage move.
                 */
                const f = await ResolveSalesFixture(ctx);
                const other = await TxOne<{ ID: string }>(
                    ctx,
                    `SELECT TOP 1 ID FROM ${SALES_SCHEMA}.DealStatusType
                      WHERE IsActive = 1 AND LocksDeal = 0 AND IsOpen = 0 ORDER BY DisplayRank ASC`,
                );

                // ── DIRECTION 1: a supplied status survives the create untouched.
                const supplied = other?.ID ?? f.OpenStatusID;
                const created = await newDeal(ctx, f, (d) => {
                    d.Name = 'SD37 caller supplied a status';
                    d.DealStatusTypeID = supplied;
                });
                await saveOk(created, 'a create WITH a status');
                const kept = await TxOne<{ DealStatusTypeID: string | null }>(
                    ctx, `SELECT DealStatusTypeID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${created.ID}'`,
                );
                AssertEqual(
                    String(kept.DealStatusTypeID).toLowerCase(),
                    String(supplied).toLowerCase(),
                    'a status the caller supplied must survive the create — the default fills what was '
                        + 'left empty, it does not have an opinion',
                );

                // ── DIRECTION 2: on an UPDATE the default must not fire at all.
                const edit = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await edit.Load(created.ID), 'the deal reloads');
                edit.DealStatusTypeID = null;
                await saveOk(edit, 'an update that clears the status');
                const cleared = await TxOne<{ DealStatusTypeID: string | null }>(
                    ctx, `SELECT DealStatusTypeID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${created.ID}'`,
                );
                Assert(
                    cleared.DealStatusTypeID === null,
                    'an update that clears the status must STICK — a default that fires here is not a '
                        + `creation default, it is a field that cannot be emptied. Got ${cleared.DealStatusTypeID}`,
                );
            }),
    },
    {
        Id: 'save-deal.SD38',
        Name: 'SD38: a create that brings its own DealNumber still gets an opening status',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * ── THE IMPORTER'S SHAPE, AND THE ONE THE GUARD CLAIMED TO COVER ────────────
                 *
                 * `Save()` routes on `this.IsSaved || this.DealNumber`, which is about NUMBERING. The
                 * status default is about CREATION. Conflating them hard-coded the default OFF for a
                 * create that supplies its own number — exactly what an importer does — so it took
                 * the numbered arm, got `needsStatusDefault: false`, and wrote NULL.
                 *
                 * That is the case the early-return guard in `saveWithinScope` names in its own comment
                 * as the reason it exists. The term and its caller disagreed, and the importer lost.
                 *
                 * A NULL status is invisible rather than broken: every measure joining `DealStatusType`
                 * silently drops the row, so an import of a thousand deals under-reports and nothing
                 * errors. SD36 covers the ordinary create; this covers the numbered one.
                 */
                const f = await ResolveSalesFixture(ctx);
                const expected = await TxOne<{ ID: string }>(
                    ctx,
                    `SELECT TOP 1 ID FROM ${SALES_SCHEMA}.DealStatusType
                      WHERE IsActive = 1 AND IsOpen = 1 AND LocksDeal = 0 ORDER BY DisplayRank ASC`,
                );
                Assert(!!expected?.ID, 'setup: an active, open, non-locking status must exist');

                /**
                 * IN A CLOSING STAGE, for the reason SD36 records: the fixture stage declares an OPEN
                 * status, so `applyStageDefaults` fills it and the check passes whether or not the
                 * creation default ran. Measured — the first version of this check passed with the fix
                 * reverted. A stage whose status LOCKS contributes nothing (planStageDefaults refuses to
                 * derive from it), so only the creation default can supply a status here.
                 */
                const closingStage = await QueryOneRow<{ ID: string }>(
                    ctx,
                    `SELECT TOP 1 s.ID
                       FROM ${SALES_SCHEMA}.PipelineStage s
                       JOIN ${SALES_SCHEMA}.DealStatusType t ON t.ID = s.DealStatusTypeID
                      WHERE s.PipelineID = '${f.PipelineID}' AND s.IsActive = 1 AND t.LocksDeal = 1
                      ORDER BY s.DisplayOrder`,
                );
                Assert(!!closingStage.ID, 'the fixture pipeline needs a stage declaring a LOCKING status');

                const supplied = `SD38-${Date.now().toString(36).toUpperCase()}`;
                const created = await newDeal(ctx, f, (d) => {
                    d.Name = 'SD38 importer supplies its own number';
                    d.DealStatusTypeID = null;      // the rep/importer never set one
                    d.DealNumber = supplied;        // ...but DID bring a number
                    d.PipelineStageID = String(closingStage.ID);
                });
                await saveOk(created, 'a create carrying its own DealNumber');

                const row = await TxOne<{ DealStatusTypeID: string | null; DealNumber: string }>(
                    ctx,
                    `SELECT DealStatusTypeID, DealNumber FROM ${SALES_SCHEMA}.Deal WHERE ID = '${created.ID}'`,
                );
                AssertEqual(
                    String(row.DealNumber), supplied,
                    'setup: the supplied number must survive — otherwise this is not the arm under test',
                );
                Assert(
                    !!row.DealStatusTypeID,
                    'a create that brought its own number must STILL get an opening status. NULL here is '
                        + 'invisible: every measure joining DealStatusType drops the row silently',
                );
                AssertEqual(
                    String(row.DealStatusTypeID).toLowerCase(),
                    String(expected.ID).toLowerCase(),
                    'and it must be the first active, open, non-locking status by rank',
                );
            }),
    },
    {
        Id: 'save-deal.SD39',
        Name: 'SD39: a successful save leaves the deal CLEAN, not holding four dirty fields',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * ── A LIE ABOUT STATE IS ACTED ON BY WHOEVER BELIEVES IT ────────────────────
                 *
                 * `refreshAmountFromOrder()` writes the amount cache to the database with raw SQL and
                 * then assigns the four provenance fields to the in-memory record so a caller reading the
                 * entity back sees what was written. That assignment happens AFTER `super.Save()` has
                 * already returned, so nothing clears the dirty flags it sets.
                 *
                 * The record is therefore DIRTY immediately after a save that fully succeeded. Anything
                 * that asks the entity whether it has unsaved work — a Save button's enabled state, a
                 * batch job skipping clean records, a guard that refuses to discard unsaved edits — gets
                 * the wrong answer, and gets it every time.
                 *
                 * Asserted on `Dirty` rather than on the four fields individually: the fields holding the
                 * right VALUES is not in question, and it is the flag that callers read.
                 */
                const f = await ResolveSalesFixture(ctx);
                const created = await newDeal(ctx, f, (d) => { d.Name = 'SD39 clean after save'; });
                await twoLines(ctx, created);
                await saveOk(created, 'create with lines, which refreshes the amount cache');

                Assert(
                    Number(created.Amount) > 0,
                    `setup: the amount cache must have been refreshed, or this proves nothing `
                        + `(Amount=${created.Amount}, IsComputed=${created.AmountIsComputed})`,
                );
                Assert(
                    !created.Dirty,
                    'a save that SUCCEEDED must leave the record clean. It is holding dirty fields that '
                        + 'were written by the same save, so every caller that reads Dirty to decide '
                        + 'whether to save is told there is unsaved work when there is none',
                );
            }),
    },
    {
        Id: 'save-deal.SD40',
        Name: 'SD40: a REFUSED save does not leave a declared transition standing',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * ── A DECLARATION GOVERNS ONE SAVE ──────────────────────────────────────
                 *
                 * `Save()` clears `_declaredTransition` near its end, and the comment there says why:
                 * left standing it "would suppress the stage defaults on the next unrelated edit to the
                 * same in-memory record and put its note on that edit's event".
                 *
                 * But three guards return BEFORE that line — the close-lock refusal, the owner-stamp
                 * refusal, and a failure resolving the server-maintained stamps. A caller that declares a
                 * transition and is then refused keeps the declaration, and the NEXT save of that same
                 * object inherits it: stage defaults suppressed, and the previous note stamped onto an
                 * unrelated event.
                 *
                 * Induced through the owner-stamp refusal because it is the one a check can trigger
                 * deterministically: setting `OwnerEmployeeID` directly, with no roster loaded, is
                 * refused by design.
                 */
                const f = await ResolveSalesFixture(ctx);
                const created = await newDeal(ctx, f, (d) => { d.Name = 'SD40 declaration outlives refusal'; });
                await saveOk(created, 'create');

                const deal = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await deal.Load(created.ID), 'the deal reloads');

                (deal as unknown as { DeclareTransition(kind: string, note: string): void })
                    .DeclareTransition('Close', 'SD40 note that must not survive');

                // Refused by the owner stamp: supplied directly, no roster in this save.
                deal.OwnerEmployeeID = f.EmployeeID;
                const refused = await deal.Save();
                Assert(refused === false, 'setup: the owner-stamp guard must refuse this save');

                // Now an ordinary edit on the SAME object. It must not inherit the declaration.
                deal.OwnerEmployeeID = null;
                deal.NextStep = 'an unrelated edit after the refusal';
                await saveOk(deal, 'the next, unrelated save');

                const stale = await TxOne<{ N: number }>(
                    ctx,
                    `SELECT COUNT(*) AS N FROM ${SALES_SCHEMA}.DealStageEvent
                      WHERE DealID = '${created.ID}' AND Notes LIKE '%SD40 note%'`,
                );
                AssertEqual(
                    Number(stale.N),
                    0,
                    'the note from a REFUSED save must not land on a later, unrelated event — a '
                        + 'declaration governs ONE save',
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
