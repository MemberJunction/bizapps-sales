/**
 * @fileoverview `product-ref` — PR1–PR7. `DealLine.ProductID` end-to-end, and the order-readiness
 * surface derived from it.
 *
 * WHY THIS BUNDLE EXISTS. Closing a won D2C deal is meant to create an order, and the binding reason it
 * cannot is product identity: orders requires a catalog `ProductID` on every order line, while a sales
 * deal line carries a transcribed `ProductName` and leaves `ProductID` null. This bundle proves the two
 * halves of the sales-owned groundwork — that a resolved reference has somewhere to live and survives a
 * round trip, and that a deal missing one SAYS SO rather than failing silently at close.
 *
 * ── TWO KINDS OF CHECK, AND WHY THE SPLIT IS HONEST ─────────────────────────────────────────────
 *
 * PR1–PR3 write to the database and are `RequiresMutation`. PR4–PR7 exercise `DealDraft.Validate()`,
 * which is pure client-side logic with no provider behind it, so they are marked `RequiresMutation:
 * false` — claiming otherwise would hide the readiness rules behind an environment variable they do not
 * need. It also means the readiness logic stays covered in a no-database run.
 *
 * ── WHAT `ProductID` IS, AND IS NOT ─────────────────────────────────────────────────────────────
 *
 * It is an unconstrained nullable `uniqueidentifier` with NO foreign key, which is why PR1 can use a
 * literal GUID. That is deliberate rather than sloppy: the catalog lives in ORDERS, and sales must never
 * host its own copy, so there is nothing in this database to point a constraint at. The consequence
 * worth knowing is that nothing here validates that the ID names a real product — checking that is the
 * resolver's job, and the resolver is exactly what this PR does not build.
 *
 * Each mutating check rolls its transaction back, so the suite is safe to run repeatedly.
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
import {
    DealDraft,
    SalesSaveDealOperation,
    type SalesDealLineInput,
    type SalesSaveDealInput,
    type SalesSaveDealOutput,
} from '@mj-biz-apps/sales-entities';

import {
    E_DEAL_LINE,
    InRolledBackTransaction,
    ResolveSalesFixture,
    type SalesFixture,
} from '../fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

/**
 * A stand-in for a resolved catalog product.
 *
 * A literal GUID rather than a lookup, because there is no catalog in this database to look one up from
 * — see the module header. What PR1 proves is that the COLUMN carries whatever the resolver eventually
 * puts in it, not that this particular value means anything.
 */
const RESOLVED_PRODUCT_A = 'A1B2C3D4-0001-4E71-B0A8-3F17C5E2D901';
const RESOLVED_PRODUCT_B = 'A1B2C3D4-0002-4E71-B0A8-3F17C5E2D901';

function draft(f: SalesFixture, lines: SalesDealLineInput[], name: string): SalesSaveDealInput {
    return {
        Name: name,
        PipelineID: f.PipelineID,
        PipelineStageID: f.StageID,
        DealTypeID: f.DealTypeID,
        DealStatusTypeID: f.OpenStatusID,
        AccountID: f.AccountID,
        TermMonths: 12,
        Lines: lines,
        PaymentSchedule: [],
    };
}

async function save(ctx: Ctx, input: SalesSaveDealInput): Promise<SalesSaveDealOutput> {
    const op = new SalesSaveDealOperation();
    const result = await op.Execute(input, { provider: ctx.Provider, user: ctx.User });
    const output = (result as { Output?: SalesSaveDealOutput })?.Output;
    Assert(!!output, `Sales.SaveDeal returned no Output envelope: ${JSON.stringify(result).slice(0, 300)}`);
    return output as SalesSaveDealOutput;
}

/** The persisted lines of a deal, ordered, read through the provider so the open transaction is visible. */
async function savedLines(ctx: Ctx, dealID: string): Promise<Array<Record<string, unknown>>> {
    const rv = new RunView();
    const r = await rv.RunView(
        {
            EntityName: E_DEAL_LINE,
            ExtraFilter: `DealID = '${dealID}'`,
            OrderBy: 'DisplayOrder ASC',
            ResultType: 'simple',
            Fields: ['ID', 'ProductID', 'ProductName', 'DisplayOrder'],
        },
        ctx.User,
    );
    Assert(r.Success, `reading deal lines failed — ${r.ErrorMessage}`);
    return (r.Results ?? []) as Array<Record<string, unknown>>;
}

/** A draft holding `count` lines, of which `withProduct` carry a catalog reference. */
function draftWithLines(count: number, withProduct: number): DealDraft {
    const d = new DealDraft({ Name: 'readiness', PipelineID: 'p', PipelineStageID: 's' });
    for (let i = 0; i < count; i++) {
        d.AddLine({
            ProductName: `Line ${i + 1}`,
            Quantity: 1,
            ProductID: i < withProduct ? RESOLVED_PRODUCT_A : null,
        });
    }
    return d;
}

/** The readiness warning, if the draft is currently raising one. */
function readinessWarning(d: DealDraft): { Message: string; Severity: string } | undefined {
    return d
        .Validate()
        .Issues.find((i) => i.Section === 'lines' && i.Field === 'ProductID' && i.ClientKey === null);
}

export const ProductRefChecks: NamedCheck[] = [
    {
        Id: 'product-ref.PR1',
        Name: 'PR1: a ProductID set on a line ROUND-TRIPS through Sales.SaveDeal',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                const out = await save(
                    ctx,
                    draft(
                        f,
                        [
                            {
                                ClientKey: 'l1',
                                DealLineTypeID: f.OneTimeLineTypeID,
                                ProductID: RESOLVED_PRODUCT_A,
                                ProductName: 'Onboarding',
                                Quantity: 1,
                                DisplayOrder: 1,
                            },
                            {
                                ClientKey: 'l2',
                                DealLineTypeID: f.RecurringLineTypeID,
                                ProductID: RESOLVED_PRODUCT_B,
                                ProductName: 'Platform — Enterprise Seat',
                                Quantity: 40,
                                DisplayOrder: 2,
                            },
                        ],
                        'PR1 resolved lines',
                    ),
                );
                Assert(out.Success, `the save failed: ${JSON.stringify(out.Issues)}`);

                const lines = await savedLines(ctx, out.DealID as string);
                AssertEqual(lines.length, 2, 'both lines landed');
                AssertEqual(
                    String(lines[0].ProductID).toLowerCase(),
                    RESOLVED_PRODUCT_A.toLowerCase(),
                    'the first line kept its catalog reference',
                );
                AssertEqual(
                    String(lines[1].ProductID).toLowerCase(),
                    RESOLVED_PRODUCT_B.toLowerCase(),
                    'the second line kept a DIFFERENT reference — they are not being cross-assigned',
                );
            }),
    },
    {
        Id: 'product-ref.PR2',
        Name: 'PR2: a line saved with no ProductID persists NULL — the gap this PR describes',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                // The status quo, asserted rather than assumed. A transcribed line carries a NAME and no
                // ID, which is precisely why it cannot become an order line yet.
                const out = await save(
                    ctx,
                    draft(
                        f,
                        [
                            {
                                ClientKey: 'l1',
                                DealLineTypeID: f.OneTimeLineTypeID,
                                ProductName: 'Whatever was written on the order form',
                                Quantity: 1,
                                DisplayOrder: 1,
                            },
                        ],
                        'PR2 unresolved line',
                    ),
                );
                Assert(out.Success, `the save failed: ${JSON.stringify(out.Issues)}`);

                const lines = await savedLines(ctx, out.DealID as string);
                AssertEqual(lines.length, 1, 'the line landed');
                Assert(!lines[0].ProductID, 'and its ProductID is NULL — no ID was invented for it');
                AssertEqual(
                    lines[0].ProductName,
                    'Whatever was written on the order form',
                    'while the transcribed name is preserved verbatim',
                );
            }),
    },
    {
        Id: 'product-ref.PR3',
        Name: 'PR3: resolving an EXISTING line later persists the reference — the plug point works',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const f = await ResolveSalesFixture(ctx);
                // This is the shape the eventual resolver will use: the deal already exists with
                // unresolved lines, and resolution is an UPDATE, not a re-entry.
                const first = await save(
                    ctx,
                    draft(
                        f,
                        [{ ClientKey: 'l1', DealLineTypeID: f.OneTimeLineTypeID, ProductName: 'Onboarding', Quantity: 1, DisplayOrder: 1 }],
                        'PR3 resolve later',
                    ),
                );
                Assert(first.Success, `the first save failed: ${JSON.stringify(first.Issues)}`);
                const dealID = first.DealID as string;
                const lineID = String((await savedLines(ctx, dealID))[0].ID);

                const second = await save(ctx, {
                    ...draft(
                        f,
                        [
                            {
                                ClientKey: 'l1',
                                ID: lineID,
                                DealLineTypeID: f.OneTimeLineTypeID,
                                ProductID: RESOLVED_PRODUCT_A,
                                ProductName: 'Onboarding',
                                Quantity: 1,
                                DisplayOrder: 1,
                            },
                        ],
                        'PR3 resolve later',
                    ),
                    ID: dealID,
                });
                Assert(second.Success, `the resolving save failed: ${JSON.stringify(second.Issues)}`);

                const lines = await savedLines(ctx, dealID);
                AssertEqual(lines.length, 1, 'still one line — it was updated, not duplicated');
                AssertEqual(String(lines[0].ID), lineID, 'and it is the SAME line row');
                AssertEqual(
                    String(lines[0].ProductID).toLowerCase(),
                    RESOLVED_PRODUCT_A.toLowerCase(),
                    'now carrying its catalog reference',
                );
            }),
    },
    {
        Id: 'product-ref.PR4',
        Name: 'PR4: the readiness warning FIRES when a line has no catalog product',
        RequiresMutation: false,
        Fn: async () => {
            const d = draftWithLines(3, 1);
            const issue = readinessWarning(d);

            Assert(!!issue, 'a deal with unresolved lines must raise the readiness issue');
            AssertEqual(issue?.Severity, 'warning', 'and it is a WARNING — an early deal legitimately has none');
            AssertEqual(
                issue?.Message,
                '2 lines need a catalog product before this deal can become an order.',
                'the message counts only the unresolved lines',
            );
            AssertEqual(d.LinesMissingCatalogProduct().length, 2, 'the derived count agrees');
            AssertEqual(d.IsOrderReady, false, 'and the deal is not order-ready');
        },
    },
    {
        Id: 'product-ref.PR5',
        Name: 'PR5: the readiness warning CLEARS once every line has a product',
        RequiresMutation: false,
        Fn: async () => {
            const d = draftWithLines(2, 0);
            Assert(!!readinessWarning(d), 'unresolved to begin with');

            // Resolve them in place — the same transition the resolver will perform.
            for (const line of d.Lines) {
                line.ProductID = RESOLVED_PRODUCT_A;
            }

            Assert(!readinessWarning(d), 'the warning is gone once nothing is missing');
            AssertEqual(d.LinesMissingCatalogProduct().length, 0, 'nothing left unresolved');
            AssertEqual(d.IsOrderReady, true, 'and the deal reports order-ready');
        },
    },
    {
        Id: 'product-ref.PR6',
        Name: 'PR6: readiness NEVER blocks a save — it is a warning, not a gate',
        RequiresMutation: false,
        Fn: async () => {
            const d = new DealDraft({ Name: 'PR6 early deal', PipelineID: 'p', PipelineStageID: 's' });
            d.AddLine({ ProductName: 'Something from the order form', Quantity: 1 });

            const v = d.Validate();
            Assert(!!readinessWarning(d), 'the readiness warning is present');
            Assert(
                v.IsValid,
                'and the draft is still VALID — blocking here would make the app unusable for the case it ' +
                    `exists to serve: ${JSON.stringify(v.Issues.filter((i) => i.Severity === 'error'))}`,
            );
            Assert(
                !v.Issues.some((i) => i.Field === 'ProductID' && i.Severity === 'error'),
                'and no ProductID issue is ever raised as an error',
            );
        },
    },
    {
        Id: 'product-ref.PR7',
        Name: 'PR7: one unresolved line reads "1 line needs", and an empty deal raises nothing',
        RequiresMutation: false,
        Fn: async () => {
            AssertEqual(
                readinessWarning(draftWithLines(1, 0))?.Message,
                '1 line needs a catalog product before this deal can become an order.',
                'singular reads as a sentence, not as "1 lines need"',
            );

            // A deal with no lines has no line missing a product, so it raises nothing. Asserted because
            // it looks wrong at a glance and is deliberate — readiness answers one narrow question, and
            // overloading it with "should this be an order at all" would make the signal mean two things.
            const empty = new DealDraft({ Name: 'PR7 empty', PipelineID: 'p', PipelineStageID: 's' });
            Assert(!readinessWarning(empty), 'an empty deal raises no readiness warning');
            AssertEqual(empty.IsOrderReady, true, 'and reports ready by that narrow definition');
        },
    },
];

for (const check of ProductRefChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

/**
 * Setup and Teardown are BOTH NO-OPS, as in the other bundles: the fixture is discovered from the seeded
 * database rather than created, and every mutating check rolls its own transaction back.
 */
IntegrationCheckRegistry.Instance.RegisterLifecycle('product-ref', {
    Setup: async () => {
        // Nothing to create: the fixture is discovered, not built.
    },
    Teardown: async () => {
        // Nothing to sweep: every mutating check rolled back.
    },
});

/** Referenced by index.ts so the registration side effect cannot be tree-shaken away. */
export function LoadProductRefChecks(): void {
    void Metadata;
}
