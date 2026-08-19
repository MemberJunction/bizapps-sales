/**
 * @fileoverview `save-deal` — SD1–SD14. Saving a deal and its children against a live database.
 *
 * WHY THIS BUNDLE EXISTS. Composing a deal is the one write in this app that spans four tables, and the
 * failure it exists to prevent — a numbered deal with no lines under it — is invisible to a unit test and
 * to any check that mocks the provider.
 *
 * ── WHAT CHANGED WHEN `Sales.SaveDeal` WAS RETIRED, AND WHY THESE CHECKS STILL MATTER ───────────
 *
 * These checks used to drive the `Sales.SaveDeal` remote operation, which rehydrated a client `DealDraft`
 * into a server-side entity tree. The deal now carries `Lines`, `PaymentSchedule` and `Team` as Related
 * Record Collections, so the path under test is `deal.Save()` — MJ builds a save plan and executes it in
 * one transaction. The operation is gone; the GUARANTEES are unchanged, which is exactly why the bundle
 * survived the rewrite rather than being deleted with the thing it tested.
 *
 * **ONE GUARANTEE DID CHANGE, and SD6/SD13 are the pair that pins it down.** The operation treated a
 * submitted `Lines` array as the COMPLETE DESIRED SET: a stored line absent from it was deleted. A
 * collection does not work that way — it deletes only what was explicitly `Remove()`d, and a row merely
 * missing from the array survives. That is a deliberate adoption of the framework's native semantics
 * rather than an oversight, so SD6 proves removal works and SD13 proves omission does NOT delete. Read
 * both before "fixing" either.
 *
 * ⚠️ **`RUN_MUTATION_TESTS=1` IS MANDATORY.** Every check below is `RequiresMutation`, so without that
 * variable the bundle runs ZERO checks and reports success — the vacuous pass `assert-check-count.mjs`
 * exists to catch. A green run that says "0 checks" is a failure wearing a pass.
 *
 * Each check rolls its transaction back, so the suite is safe to run repeatedly and leaves no rows.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { Metadata, RunView, ValidationErrorType } from '@memberjunction/core';
import {
    Assert,
    AssertEqual,
    IntegrationCheckRegistry,
    type NamedCheck,
} from '@memberjunction/testing-integration';
import type {
    DealEntity,
    mjBizAppsSalesDealLineEntity,
    mjBizAppsSalesDealPaymentScheduleEntity,
} from '@mj-biz-apps/sales-entities';

import {
    E_DEAL,
    E_DEAL_LINE,
    E_SCHEDULE,
    E_TEAM,
    InRolledBackTransaction,
    ProviderOf,
    ResolveSalesFixture,
    SALES_SCHEMA,
    TxOne,
    type SalesFixture,
} from '../fixture.js';

/** The collections these checks read and write. */
const COLLECTIONS = ['Lines', 'PaymentSchedule', 'Team'] as const;

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
    Assert(deal.Lines.IsLoaded, 'the Lines collection did not load');
    Assert(deal.PaymentSchedule.IsLoaded, 'the PaymentSchedule collection did not load');
    Assert(deal.Team.IsLoaded, 'the Team collection did not load');
    return deal;
}

/** Saves and asserts it worked, reporting the entity's own message rather than a generic failure. */
async function saveOk(deal: DealEntity, what: string): Promise<void> {
    const ok = await deal.Save();
    Assert(ok, `${what} failed: ${deal.LatestResult?.CompleteMessage ?? 'unknown error'}`);
}

/** Adds one line with figures transcribed as an account director would type them. */
async function addLine(
    deal: DealEntity,
    seed: Partial<Record<keyof mjBizAppsSalesDealLineEntity, unknown>> & { ProductName: string },
): Promise<mjBizAppsSalesDealLineEntity> {
    const line = await deal.Lines.Create();
    for (const [field, value] of Object.entries(seed)) {
        line.Set(field, value);
    }
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

/** Two lines: one recurring, one one-time. The shape most checks want. */
async function twoLines(deal: DealEntity, f: SalesFixture): Promise<void> {
    await addLine(deal, {
        ProductName: 'Platform — Enterprise Seat',
        DealLineTypeID: f.RecurringLineTypeID,
        Quantity: 100,
        AnnualGrossFees: 120000,
        DiscountAmount: 12000,
        Total: 108000,
    });
    await addLine(deal, {
        ProductName: 'Onboarding',
        DealLineTypeID: f.OneTimeLineTypeID,
        Quantity: 1,
        AnnualGrossFees: 20000,
        DiscountAmount: 0,
        Total: 20000,
    });
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

/** The ordered children — lines and instalments both sequence on DisplayOrder. */
const ORDERED = 'DisplayOrder ASC';

const seqOf = (dealNumber: string): number => Number(dealNumber.replace(/^DEAL-/, ''));

export const SaveDealChecks: NamedCheck[] = [
    {
        Id: 'save-deal.SD1',
        Name: 'SD1: a deal, its lines and its instalments are written by ONE save',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const deal = await newDeal(ctx, f, (d) => { d.Name = 'SD1 composed deal'; });
                await twoLines(deal, f);
                await addInstalment(deal, { PaymentDate: new Date('2026-10-01T00:00:00Z'), Amount: 64000, Description: '50% on execution' });
                await addInstalment(deal, { PaymentDate: new Date('2027-01-01T00:00:00Z'), Amount: 64000, Description: '50% on go-live' });

                await saveOk(deal, 'the composed save');
                Assert(deal.IsSaved, 'the deal reports itself saved');

                AssertEqual((await children(ctx, E_DEAL_LINE, deal.ID, ['ID'], ORDERED)).length, 2, 'two lines landed');
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
        Id: 'save-deal.SD4',
        Name: 'SD4: the Resolved* columns stay NULL — this app prices nothing',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const deal = await newDeal(ctx, f, (d) => { d.Name = 'SD4 no pricing'; });
                await twoLines(deal, f);
                await saveOk(deal, 'the save');

                // THE RULE MADE A TEST. The four Resolved* columns are write-only from an
                // Orders.PreviewOrder response. If a future change starts computing them locally — the
                // exact accretion Rule 1 exists to stop — this check is what notices.
                const lines = await children(ctx, E_DEAL_LINE, deal.ID, [
                    'ID', 'ResolvedUnitPrice', 'ResolvedExtendedAmount', 'PriceComponentsJSON', 'PricedAt',
                ], ORDERED);
                for (const line of lines) {
                    for (const col of ['ResolvedUnitPrice', 'ResolvedExtendedAmount', 'PriceComponentsJSON', 'PricedAt']) {
                        Assert(
                            line[col] === null || line[col] === undefined,
                            `${col} must be NULL until Orders.PreviewOrder fills it, got ${String(line[col])}`,
                        );
                    }
                }
            }),
    },
    {
        Id: 'save-deal.SD5',
        Name: 'SD5: the signed Total is stored VERBATIM, never derived from gross minus discount',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                // Deliberately INCONSISTENT figures: 100 − 10 is not 999. A server that "helpfully"
                // recomputed Total would overwrite 999, and one that validated the relationship would
                // refuse the save. Neither is allowed: the three numbers are transcribed from a signed
                // document, and the arithmetic on that page is the customer's.
                const deal = await newDeal(ctx, f, (d) => { d.Name = 'SD5 verbatim total'; });
                await addLine(deal, {
                    ProductName: 'Odd figures',
                    DealLineTypeID: f.OneTimeLineTypeID,
                    Quantity: 1,
                    AnnualGrossFees: 100,
                    DiscountAmount: 10,
                    Total: 999,
                });
                await saveOk(deal, 'the save (the server must not validate the arithmetic)');

                const lines = await children(ctx, E_DEAL_LINE, deal.ID, [
                    'AnnualGrossFees', 'DiscountAmount', 'Total',
                ], ORDERED);
                AssertEqual(Number(lines[0].Total), 999, 'Total was stored exactly as set');
                AssertEqual(Number(lines[0].AnnualGrossFees), 100, 'gross fees stored as set');
                AssertEqual(Number(lines[0].DiscountAmount), 10, 'discount stored as set');
            }),
    },
    {
        Id: 'save-deal.SD6',
        Name: 'SD6: Remove() DELETES the line, in the same transaction as the rest of the save',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const created = await newDeal(ctx, f, (d) => { d.Name = 'SD6 explicit removal'; });
                await twoLines(created, f);
                await saveOk(created, 'create');
                AssertEqual((await children(ctx, E_DEAL_LINE, created.ID, ['ID'], ORDERED)).length, 2, 'two lines to start with');

                // REMOVAL IS EXPLICIT. This is the semantics the collection actually implements, and the
                // reason it is right: `Remove()` records the row in the collection's removal list, which
                // is contributed to the save plan BEFORE the inserts and updates — so the delete, the
                // re-sequencing of what remains, and the header update are one atomic unit. Dropping the
                // row from the array instead would leave it in the database; SD13 is that case.
                const deal = await reopen(ctx, created.ID);
                const doomed = deal.Lines.Items.find((l) => l.ProductName === 'Onboarding');
                Assert(!!doomed, 'the line to remove was found after re-reading');
                deal.Lines.Remove(doomed!);
                AssertEqual(deal.Lines.Count, 1, 'the collection reports one line remaining before the save');

                await saveOk(deal, 'the save after removal');

                const after = await children(ctx, E_DEAL_LINE, created.ID, ['ID', 'ProductName', 'DisplayOrder'], ORDERED);
                AssertEqual(after.length, 1, 'the removed line was deleted');
                AssertEqual(String(after[0].ProductName), 'Platform — Enterprise Seat', 'the surviving line is the one that was kept');
                AssertEqual(Number(after[0].DisplayOrder), 1, 'what remains was re-sequenced, so no gap was left behind');
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
                await twoLines(deal, f);
                await addInstalment(deal, { Amount: 1, Description: 'first' });
                await addInstalment(deal, { Amount: 2, Description: 'second' });
                await addInstalment(deal, { Amount: 3, Description: 'third' });
                await saveOk(deal, 'the save');

                // FROM 1, STEP 1 — not 10/20/30 as the hand-rolled implementation used. The collection's
                // sequencer is `from + index` with no increment option, and the old 10-step was cosmetic
                // anyway: it looks like room to insert between two rows, but every add and remove
                // re-sequenced the whole collection, so a gap never survived the next mutation.
                const lines = await children(ctx, E_DEAL_LINE, deal.ID, ['DisplayOrder'], ORDERED);
                AssertEqual(lines.map((l) => Number(l.DisplayOrder)).join(','), '1,2', 'lines sequenced 1,2');
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
        Id: 'save-deal.SD12',
        Name: 'SD12: a RECURRING line stores a type whose IsRecurring flag is set',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const deal = await newDeal(ctx, f, (d) => { d.Name = 'SD12 recurring'; });
                await twoLines(deal, f);
                await saveOk(deal, 'the save');

                /**
                 * THE FLAG, NOT THE NAME. This is the assertion that makes `DealLineType` worth being a
                 * type table: it joins to the type row and reads `IsRecurring`, so the check keeps
                 * working after somebody renames "Recurring" to "Subscription" — and a version that
                 * compared the name would keep passing while measuring nothing.
                 */
                const joined = await TxOne<{ Recurring: number; OneTime: number }>(ctx, `
                    SELECT
                        SUM(CASE WHEN lt.IsRecurring = 1 THEN 1 ELSE 0 END) AS Recurring,
                        SUM(CASE WHEN lt.IsRecurring = 0 THEN 1 ELSE 0 END) AS OneTime
                    FROM ${SALES_SCHEMA}.DealLine dl
                    JOIN ${SALES_SCHEMA}.DealLineType lt ON lt.ID = dl.DealLineTypeID
                    WHERE dl.DealID = '${deal.ID}'`);

                AssertEqual(Number(joined.Recurring), 1, 'exactly one line is of a recurring type');
                AssertEqual(Number(joined.OneTime), 1, 'exactly one line is of a one-time type');
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
                await twoLines(created, f);
                await addInstalment(created, { Amount: 500, Description: 'deposit' });
                await saveOk(created, 'create');

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
                AssertEqual(deal.Lines.Count, 0, 'the collection is unloaded, so it holds nothing');
                Assert(deal.Lines.IsLoaded === false, 'and it knows it was never loaded — which is why it contributes no deletions');

                deal.NextStep = 'Send the redline';
                await saveOk(deal, 'the header-only save');

                AssertEqual((await children(ctx, E_DEAL_LINE, created.ID, ['ID'], ORDERED)).length, 2, 'both lines survived');
                AssertEqual((await children(ctx, E_SCHEDULE, created.ID, ['ID'], ORDERED)).length, 1, 'the instalment survived');
            }),
    },
    {
        Id: 'save-deal.SD16',
        Name: 'SD16: a caller-set Resolved* value is REFUSED — the pricing block is write-only',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const before = await TxOne<{ N: number }>(ctx, `SELECT COUNT(*) AS N FROM ${SALES_SCHEMA}.Deal`);

                /**
                 * SD4'S COMPLEMENT, and the one with teeth.
                 *
                 * SD4 proves the four provenance columns come back NULL when nobody touches them — which a
                 * save path that merely ignored them would also satisfy. This proves the stronger claim: a
                 * caller that DELIBERATELY sets one is refused.
                 *
                 * It matters because the guard is new. `Sales.SaveDeal` protected these columns with a
                 * field whitelist, and retiring the operation retired the whitelist; the generated Deal
                 * Lines form had always exposed them anyway. The rule now lives on the ENTITY, so it binds
                 * the browser, an Action, an agent and a raw `BaseEntity.Save()` identically.
                 */
                const deal = await newDeal(ctx, f, (d) => { d.Name = 'SD16 forged pricing'; });
                const line = await addLine(deal, {
                    ProductName: 'Forged price',
                    DealLineTypeID: f.OneTimeLineTypeID,
                    Quantity: 1,
                });

                // FIRST: prove the line subclass is live at all. Every other check sets a valid line, so
                // nothing until now has exercised a LINE-level rule — if the class factory were handing
                // back the generated entity, every rule in DealLineEntity would be silently absent and the
                // provenance assertion below would fail for a reason that has nothing to do with pricing.
                line.ProductName = '';
                const probe = deal.Validate();
                Assert(
                    probe.Errors.some((e) => e.Source?.endsWith('ProductName')),
                    'DealLineEntity.Validate is not running — the class factory resolved the generated entity',
                );
                line.ProductName = 'Forged price';

                line.ResolvedUnitPrice = 4200;

                const validation = deal.Validate();
                Assert(validation.Success === false, 'a forged ResolvedUnitPrice must not validate');
                const refusal = validation.Errors.find((e) => e.Source?.endsWith('ResolvedUnitPrice'));
                Assert(
                    !!refusal,
                    `the refusal must name the offending column, got ${JSON.stringify(validation.Errors.map((e) => e.Source))}`,
                );
                // Labelled through the collection, so a surface can point at the ROW as well as the field.
                Assert(
                    refusal!.Source.startsWith('Lines['),
                    `the refusal must identify WHICH line, got '${refusal!.Source}'`,
                );

                AssertEqual(await deal.Save(), false, 'and the save must be refused');
                const after = await TxOne<{ N: number }>(ctx, `SELECT COUNT(*) AS N FROM ${SALES_SCHEMA}.Deal`);
                AssertEqual(Number(after.N), Number(before.N), 'a refused deal wrote no row at all');
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
                 * `DealDraft`'s constructor pre-filled `PaymentMethod: 'ACH'`, and `AddLine` pre-filled
                 * `Quantity: 1`. Nothing replaced those in the component, because nothing needed to: both
                 * columns carry a database DEFAULT, CodeGen records it on `EntityField.DefaultValue`, and
                 * `NewRecord()` applies it. So the values still arrive — from metadata rather than from a
                 * UI model, which is the better place for them.
                 *
                 * "Still arrive" was an inference along a four-step chain, though, and the failure mode if
                 * any link broke is a quiet one: a deal saved with a NULL payment method, or a line saved
                 * with quantity NULL. This check is what turns the inference into a fact.
                 *
                 * It also pins the SQL-syntax stripping. The stored default is literally `('ACH')`, and an
                 * unstripped value would give every deal the payment method `('ACH')` — wrong in a way that
                 * looks like a typo rather than a framework detail.
                 */
                const deal = await newDeal(ctx, f, (d) => { d.Name = 'SD15 metadata defaults'; });
                AssertEqual(deal.PaymentMethod, 'ACH', 'PaymentMethod defaults from metadata, not from a UI model');

                const line = await deal.Lines.Create();
                line.ProductName = 'Defaulted line';
                line.DealLineTypeID = f.OneTimeLineTypeID;
                AssertEqual(Number(line.Quantity), 1, 'Quantity defaults to 1 without anyone setting it');

                await saveOk(deal, 'the save');

                const stored = await TxOne<{ PaymentMethod: string }>(
                    ctx, `SELECT PaymentMethod FROM ${SALES_SCHEMA}.Deal WHERE ID = '${deal.ID}'`,
                );
                AssertEqual(String(stored.PaymentMethod), 'ACH', 'and it is what actually reached the database');

                const lines = await children(ctx, E_DEAL_LINE, deal.ID, ['Quantity'], ORDERED);
                AssertEqual(Number(lines[0].Quantity), 1, 'the line stored quantity 1');
            }),
    },
    {
        Id: 'save-deal.SD14',
        Name: 'SD14: a line EDIT round-trips, and a position change is written even though the row is clean',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const created = await newDeal(ctx, f, (d) => { d.Name = 'SD14 edit and reorder'; });
                await twoLines(created, f);
                await saveOk(created, 'create');

                const deal = await reopen(ctx, created.ID);
                AssertEqual(deal.Lines.Count, 2, 'both lines came back');

                // An ordinary field edit on a loaded child.
                const first = deal.Lines.Items.find((l) => l.ProductName === 'Platform — Enterprise Seat');
                Assert(!!first, 'the recurring line was found');
                first!.Quantity = 150;

                // AND a REPOSITIONING, which is the subtle case. Removing the other line re-sequences what
                // remains; the surviving row's DisplayOrder changes without any field the user touched. It
                // is `IgnoreDirtyState`-independent here because the sequence write itself dirties the row —
                // this check exists to notice if that ever stops being true.
                const other = deal.Lines.Items.find((l) => l.ProductName === 'Onboarding');
                deal.Lines.Remove(other!);

                await saveOk(deal, 'the save after edit and removal');

                const after = await children(ctx, E_DEAL_LINE, created.ID, ['Quantity', 'DisplayOrder'], ORDERED);
                AssertEqual(after.length, 1, 'one line remains');
                AssertEqual(Number(after[0].Quantity), 150, 'the field edit was written');
                AssertEqual(Number(after[0].DisplayOrder), 1, 'and the surviving row took position 1');
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
                await twoLines(deal, f);
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
                const lines = await TxOne<{ N: number }>(
                    ctx, `SELECT COUNT(*) AS N FROM ${SALES_SCHEMA}.DealLine WHERE DealID = '${deal.ID}'`,
                );
                AssertEqual(Number(lines.N), 2, 'both lines must have persisted, or this check proved nothing');
            }),
    },
];

for (const check of SaveDealChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

/**
 * Setup and Teardown are BOTH NO-OPS, and that is the point rather than an omission.
 *
 * The fixture is DISCOVERED from the seeded database rather than created (see `fixture.ts`), and every
 * check rolls its own transaction back — so there is nothing to build up and nothing to sweep. Compare
 * orders, whose lifecycle creates a committed product catalog and then sweeps it in FK order.
 *
 * Registered explicitly, with the bodies spelled out, because `BundleLifecycle` requires both hooks and
 * because "this bundle deliberately needs neither" is worth stating where someone would look for them.
 */
IntegrationCheckRegistry.Instance.RegisterLifecycle('save-deal', {
    Setup: async () => {
        // Nothing to create: the fixture is discovered, not built.
    },
    Teardown: async () => {
        // Nothing to sweep: every check rolled back.
    },
});

/** Referenced by index.ts so the registration side effect cannot be tree-shaken away. */
export function LoadSaveDealChecks(): void {
    void Metadata;
}
