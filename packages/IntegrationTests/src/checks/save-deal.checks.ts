/**
 * @fileoverview `save-deal` — SD1–SD12. `Sales.SaveDeal` against a live database, nothing mocked.
 *
 * WHY THIS BUNDLE EXISTS. Composing a deal is the one write in this app that spans three tables, and the
 * failure it exists to prevent — a numbered deal with no lines under it — is invisible to a unit test and
 * to any check that mocks the provider. These checks were developed as a scratch script during Phase 1,
 * proved the operation worked, and were then promoted here so they run on every `mj test` instead of
 * living in a file only one person knew about.
 *
 * ⚠️ **`RUN_MUTATION_TESTS=1` IS MANDATORY.** Every check below is `RequiresMutation`, so without that
 * variable the bundle runs ZERO checks and reports success — the vacuous pass `assert-check-count.mjs`
 * exists to catch. A green run that says "0 checks" is a failure wearing a pass.
 *
 * Each check rolls its transaction back, so the suite is safe to run repeatedly and leaves no rows.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { Metadata, RunView } from '@memberjunction/core';
import {
    Assert,
    AssertEqual,
    IntegrationCheckRegistry,
    type NamedCheck,
} from '@memberjunction/testing-integration';
import { SalesSaveDealOperation, type SalesSaveDealInput, type SalesSaveDealOutput } from '@mj-biz-apps/sales-entities';

import {
    E_DEAL,
    E_DEAL_LINE,
    E_SCHEDULE,
    E_TEAM,
    InRolledBackTransaction,
    ResolveSalesFixture,
    SALES_SCHEMA,
    TxOne,
    type SalesFixture,
} from '../fixture.js';

/** A minimal valid draft. Callers override what their check is about and nothing else. */
function draft(f: SalesFixture, overrides: Partial<SalesSaveDealInput> = {}): SalesSaveDealInput {
    return {
        Name: 'IT deal',
        PipelineID: f.PipelineID,
        PipelineStageID: f.StageID,
        DealTypeID: f.DealTypeID,
        DealStatusTypeID: f.OpenStatusID,
        AccountID: f.AccountID,
        TermMonths: 12,
        Lines: [],
        PaymentSchedule: [],
        ...overrides,
    };
}

/** Two lines: one recurring, one one-time, with figures transcribed as an AD would type them. */
function twoLines(f: SalesFixture): SalesSaveDealInput['Lines'] {
    return [
        {
            ClientKey: 'l1',
            ProductName: 'Platform — Enterprise Seat',
            DealLineTypeID: f.RecurringLineTypeID,
            Quantity: 100,
            AnnualGrossFees: 120000,
            DiscountAmount: 12000,
            Total: 108000,
        },
        {
            ClientKey: 'l2',
            ProductName: 'Onboarding',
            DealLineTypeID: f.OneTimeLineTypeID,
            Quantity: 1,
            AnnualGrossFees: 20000,
            DiscountAmount: 0,
            Total: 20000,
        },
    ];
}

/** Runs the operation the way a resolver does, and asserts it did not fail outright. */
async function save(
    ctx: Parameters<NamedCheck['Fn']>[0],
    input: SalesSaveDealInput,
): Promise<SalesSaveDealOutput> {
    const op = new SalesSaveDealOperation();
    // `provider` and `user` are the whole of the server-side invoke contract — `RemoteOpInvokeOptions`
    // has no `contextUser`. Passing the provider explicitly is what puts the operation on the SAME
    // connection as the check's open transaction, so its writes are visible to the reads below and get
    // rolled back with everything else.
    const result = await op.Execute(input, { provider: ctx.Provider, user: ctx.User });
    const output = (result as { Output?: SalesSaveDealOutput })?.Output;
    Assert(!!output, `Sales.SaveDeal returned no Output envelope: ${JSON.stringify(result).slice(0, 300)}`);
    return output as SalesSaveDealOutput;
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
        Name: 'SD1: a deal, its lines and its instalments are written by ONE call',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const out = await save(ctx, draft(f, {
                    Name: 'SD1 composed deal',
                    Lines: twoLines(f),
                    PaymentSchedule: [
                        { ClientKey: 'p1', PaymentDate: '2026-10-01', Amount: 64000, Description: '50% on execution' },
                        { ClientKey: 'p2', PaymentDate: '2027-01-01', Amount: 64000, Description: '50% on go-live' },
                    ],
                }));

                Assert(out.Success, `the save failed: ${JSON.stringify(out.Issues)}`);
                Assert(out.Created === true, 'a deal with no ID must report Created');
                AssertEqual((await children(ctx, E_DEAL_LINE, out.DealID as string, ['ID'], ORDERED)).length, 2, 'two lines landed');
                AssertEqual((await children(ctx, E_SCHEDULE, out.DealID as string, ['ID'], ORDERED)).length, 2, 'two instalments landed');
            }),
    },
    {
        Id: 'save-deal.SD2',
        Name: 'SD2: CompanyID comes from the PIPELINE, not from whatever the client sent',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                // A deliberately wrong company. Deal.CompanyID must equal Pipeline.CompanyID and a CHECK
                // cannot reach across the FK to compare them, so the server resolves it — and a client
                // that gets it wrong (or lies) must not be able to store a mismatch.
                const bogus = '00000000-0000-0000-0000-000000000001';
                const out = await save(ctx, draft(f, { Name: 'SD2 company override', CompanyID: bogus }));
                Assert(out.Success, `the save failed: ${JSON.stringify(out.Issues)}`);

                const row = await TxOne<{ CompanyID: string }>(
                    ctx, `SELECT CompanyID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${out.DealID}'`,
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
                const out = await save(ctx, draft(f, { Name: 'SD3 owner', OwnerEmployeeID: f.EmployeeID }));
                Assert(out.Success, `the save failed: ${JSON.stringify(out.Issues)}`);

                // DealTeamMember is the SOURCE OF TRUTH for who is on a deal, including the owner; the
                // column is only a denormalized stamp so "my deals" needs no join. So the row must exist,
                // and the stamp must match it.
                const team = await children(ctx, E_TEAM, out.DealID as string, ['ID', 'EmployeeID']);
                AssertEqual(team.length, 1, 'exactly one team member was created for the owner');
                AssertEqual(
                    String(team[0].EmployeeID).toLowerCase(),
                    f.EmployeeID.toLowerCase(),
                    'the team row names the employee that was sent as the owner',
                );

                const deal = await TxOne<{ OwnerEmployeeID: string }>(
                    ctx, `SELECT OwnerEmployeeID FROM ${SALES_SCHEMA}.Deal WHERE ID = '${out.DealID}'`,
                );
                AssertEqual(
                    String(deal.OwnerEmployeeID).toLowerCase(),
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
                const out = await save(ctx, draft(f, { Name: 'SD4 no pricing', Lines: twoLines(f) }));
                Assert(out.Success, `the save failed: ${JSON.stringify(out.Issues)}`);

                // THE RULE MADE A TEST. The four Resolved* columns are write-only from an
                // Orders.PreviewOrder response. If a future change starts computing them locally — the
                // exact accretion Rule 1 exists to stop — this check is what notices.
                const lines = await children(ctx, E_DEAL_LINE, out.DealID as string, [
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
                // recomputed Total would overwrite 999, and a server that validated the relationship
                // would refuse the save. Neither is allowed: the three numbers are transcribed from a
                // signed document, and the arithmetic on that page is the customer's.
                const out = await save(ctx, draft(f, {
                    Name: 'SD5 verbatim total',
                    Lines: [{
                        ClientKey: 'l1', ProductName: 'Odd figures', DealLineTypeID: f.OneTimeLineTypeID,
                        Quantity: 1, AnnualGrossFees: 100, DiscountAmount: 10, Total: 999,
                    }],
                }));
                Assert(out.Success, `the save was refused — the server must not validate the arithmetic: ${JSON.stringify(out.Issues)}`);

                const lines = await children(ctx, E_DEAL_LINE, out.DealID as string, [
                    'AnnualGrossFees', 'DiscountAmount', 'Total',
                ], ORDERED);
                AssertEqual(Number(lines[0].Total), 999, 'Total was stored exactly as sent');
                AssertEqual(Number(lines[0].AnnualGrossFees), 100, 'gross fees stored as sent');
                AssertEqual(Number(lines[0].DiscountAmount), 10, 'discount stored as sent');
            }),
    },
    {
        Id: 'save-deal.SD6',
        Name: 'SD6: a line absent from the payload is DELETED — the array is the complete desired set',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const created = await save(ctx, draft(f, { Name: 'SD6 complete set', Lines: twoLines(f) }));
                Assert(created.Success, `create failed: ${JSON.stringify(created.Issues)}`);
                AssertEqual(created.Lines.length, 2, 'two lines to start with');

                const keep = created.Lines.find((l) => l.ClientKey === 'l1');
                Assert(!!keep, 'the first line came back with its ClientKey echoed');

                const updated = await save(ctx, {
                    ID: created.DealID as string,
                    Name: 'SD6 complete set',
                    PipelineID: f.PipelineID,
                    Lines: [{
                        ClientKey: 'l1', ID: keep!.ID, ProductName: 'Platform — Enterprise Seat',
                        DealLineTypeID: f.RecurringLineTypeID, Quantity: 100,
                    }],
                });
                Assert(updated.Success, `update failed: ${JSON.stringify(updated.Issues)}`);
                Assert(updated.Created === false, 'an update must not report Created');

                const after = await children(ctx, E_DEAL_LINE, created.DealID as string, ['ID'], ORDERED);
                AssertEqual(after.length, 1, 'the omitted line was deleted, not left behind');
            }),
    },
    {
        Id: 'save-deal.SD7',
        Name: 'SD7: children are re-sequenced from array order on every save',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const out = await save(ctx, draft(f, {
                    Name: 'SD7 ordering',
                    Lines: twoLines(f),
                    PaymentSchedule: [
                        { ClientKey: 'p1', Amount: 1, Description: 'first' },
                        { ClientKey: 'p2', Amount: 2, Description: 'second' },
                        { ClientKey: 'p3', Amount: 3, Description: 'third' },
                    ],
                }));
                Assert(out.Success, `the save failed: ${JSON.stringify(out.Issues)}`);

                const lines = await children(ctx, E_DEAL_LINE, out.DealID as string, ['DisplayOrder'], ORDERED);
                AssertEqual(lines.map((l) => Number(l.DisplayOrder)).join(','), '10,20', 'lines sequenced 10,20');
                const sched = await children(ctx, E_SCHEDULE, out.DealID as string, ['DisplayOrder', 'Description'], ORDERED);
                AssertEqual(sched.map((s) => Number(s.DisplayOrder)).join(','), '10,20,30', 'instalments sequenced 10,20,30');
                AssertEqual(String(sched[0].Description), 'first', 'submitted order is the stored order');
            }),
    },
    {
        Id: 'save-deal.SD8',
        Name: 'SD8: an invalid draft is refused with a STRUCTURED issue and writes nothing',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const before = await TxOne<{ N: number }>(ctx, `SELECT COUNT(*) AS N FROM ${SALES_SCHEMA}.Deal`);

                const out = await save(ctx, draft(f, { Name: '' }));
                Assert(out.Success === false, 'a nameless deal must be refused');
                // STRUCTURED, not a joined string: Section is what lets a tab badge itself and Field is
                // what lets the field mark itself. A refusal that only carried prose would force the UI
                // to parse it.
                Assert(out.Issues.length > 0, 'the refusal must carry issues');
                AssertEqual(out.Issues[0].Section, 'party', 'the issue names the pane it belongs to');
                AssertEqual(out.Issues[0].Field, 'Name', 'the issue names the offending field');
                AssertEqual(out.Issues[0].Severity, 'error', 'a blocker, not an advisory');

                const after = await TxOne<{ N: number }>(ctx, `SELECT COUNT(*) AS N FROM ${SALES_SCHEMA}.Deal`);
                AssertEqual(Number(after.N), Number(before.N), 'a refused draft wrote no deal row');
            }),
    },
    {
        Id: 'save-deal.SD9',
        Name: 'SD9: a new deal is numbered DEAL-{seq} on insert',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const out = await save(ctx, draft(f, { Name: 'SD9 numbering' }));
                Assert(out.Success, `the save failed: ${JSON.stringify(out.Issues)}`);

                const row = await TxOne<{ DealNumber: string }>(
                    ctx, `SELECT DealNumber FROM ${SALES_SCHEMA}.Deal WHERE ID = '${out.DealID}'`,
                );
                Assert(
                    /^DEAL-\d{6}$/.test(String(row.DealNumber)),
                    `expected DEAL-{6 digits}, got ${String(row.DealNumber)}`,
                );
                AssertEqual(out.DealNumber, row.DealNumber, 'the operation reports the number it stored');
            }),
    },
    {
        Id: 'save-deal.SD10',
        Name: 'SD10: re-saving a deal does NOT renumber it',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const created = await save(ctx, draft(f, { Name: 'SD10 stable number' }));
                Assert(created.Success, `create failed: ${JSON.stringify(created.Issues)}`);
                const first = created.DealNumber;

                // A deal number travels: it appears on a contract, in an order, and in people's email.
                // Renumbering on edit would silently break every one of those references.
                const updated = await save(ctx, {
                    ID: created.DealID as string, Name: 'SD10 renamed', PipelineID: f.PipelineID,
                });
                Assert(updated.Success, `update failed: ${JSON.stringify(updated.Issues)}`);

                const row = await TxOne<{ DealNumber: string }>(
                    ctx, `SELECT DealNumber FROM ${SALES_SCHEMA}.Deal WHERE ID = '${created.DealID}'`,
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

                const a = await save(ctx, draft(f, { Name: 'SD11 first' }));
                const b = await save(ctx, draft(f, { Name: 'SD11 second' }));
                Assert(a.Success && b.Success, 'both saves succeeded');

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
                const out = await save(ctx, draft(f, { Name: 'SD12 recurring', Lines: twoLines(f) }));
                Assert(out.Success, `the save failed: ${JSON.stringify(out.Issues)}`);

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
                    WHERE dl.DealID = '${out.DealID}'`);

                AssertEqual(Number(joined.Recurring), 1, 'exactly one line is of a recurring type');
                AssertEqual(Number(joined.OneTime), 1, 'exactly one line is of a one-time type');
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
