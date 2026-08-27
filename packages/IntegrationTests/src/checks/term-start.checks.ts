/**
 * @fileoverview `term-start` — TS1–TS6. The term start a deal states for a subscription line (#32).
 *
 * WHY THIS BUNDLE EXISTS. The feature is one nullable column and three small rules, and every one of its
 * failure modes is SILENT. A default that is written instead of displayed looks identical on screen and
 * freezes the field forever. A predicate that drifts from orders' offers a term start on a line that will
 * never receive a term. A `Fields` list that loses `SubscriptionTypeID` makes the control vanish for
 * everyone, with no error anywhere. None of these throw, and none are visible in a screenshot — which is
 * this repo's recurring defect class, so it is the one the checks are pointed at.
 *
 * ── WHY MOST OF THESE ARE PURE ──────────────────────────────────────────────────────────────────────
 *
 * The rules live in `@mj-biz-apps/sales-entities` (`term-start.ts`) precisely so they can be asserted
 * without a browser: the deal workspace delegates to them and adds only the binding. That is the same
 * shape `ProductFilterFor` and the discount helpers already have here. TS5 and TS6 are the two claims
 * that genuinely need the database, and they are the two the pure checks cannot make.
 *
 * ── WHAT THIS BUNDLE DOES *NOT* PROVE, AND MUST NOT BE READ AS PROVING ──────────────────────────────
 *
 * That a confirmed order's term STARTS on the date entered here. It does not, yet. Orders overwrites the
 * column at confirm — `OrderEntityServer.materializeSubscriptions` states it outright ("the line's stored
 * service period reflects the TERM, not what a user typed") — and the companion orders issue is what
 * changes `SubscriptionBehavior.ComputeStartDate` to honour it. #32's last acceptance criterion depends
 * on that issue and is deliberately not asserted here; a check written to pass today would have to be
 * rewritten the moment orders changed, which is a check that stops guarding.
 *
 * ⚠️ **THE SEEDED CATALOGUE HAS NO SUBSCRIPTION PRODUCTS.** Measured on the recording host 2026-08-27:
 * 9 products, 0 with a `SubscriptionTypeID`. So on a default host NO line offers a term start, and a
 * tester will correctly report the field as missing. That is a seed gap, not a defect in this feature —
 * TS5 is written to fail loudly if the plumbing breaks while staying green on a host whose catalogue
 * simply has none.
 *
 * ⚠️ **`RUN_MUTATION_TESTS=1` IS MANDATORY** for the bundle to run at all, in line with the rest of the
 * suite.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { RunView, type BaseEntity } from '@memberjunction/core';
import {
    Assert,
    AssertEqual,
    IntegrationCheckRegistry,
    type NamedCheck,
} from '@memberjunction/testing-integration';
import { OrdersIsInstalled } from '@mj-biz-apps/sales-core-entities-server';
import {
    E_ORDERS_PRODUCT,
    EffectiveTermStart,
    PRODUCT_LOOKUP_FIELDS,
    HasExplicitTermStart,
    IsSubscriptionProduct,
    ProductFilterFor,
    ShouldOfferTermStart,
    type DealEntity,
} from '@mj-biz-apps/sales-entities';

import {
    E_DEAL,
    InRolledBackTransaction,
    ProviderOf,
    ResolveSalesFixture,
    TxOne,
    type SalesFixture,
} from '../fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

/** An order date to reason from. Fixed, because a rule tested against `new Date()` is untestable. */
const ORDER_DATE = new Date('2026-08-27T00:00:00Z');
/** The same order, re-dated. Used to prove which values follow the order date and which do not. */
const MOVED_ORDER_DATE = new Date('2026-09-15T00:00:00Z');
/** What a rep types when they want a term starting on the first of the month. */
const CHOSEN = new Date('2026-09-01T00:00:00Z');

/** A catalogue row as the picker returns it — only the field the rule reads. */
const subscriptionProduct = { SubscriptionTypeID: '0f8f7d1e-0000-4000-8000-000000000001' };
const oneTimeProduct = { SubscriptionTypeID: null };

/** The date part of whatever shape a rule returned, which is what the control would display. */
function shown(value: Date | string | null | undefined): string | null {
    if (!value) {
        return null;
    }
    return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

/** A deal shaped like every other bundle's, so a failure here is about the term start and nothing else. */
async function newDeal(ctx: Ctx, f: SalesFixture): Promise<DealEntity> {
    const deal = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
    deal.NewRecord();
    deal.Name = 'IT term start';
    deal.PipelineID = f.PipelineID;
    deal.PipelineStageID = f.StageID;
    deal.DealTypeID = f.DealTypeID;
    deal.DealStatusTypeID = f.OpenStatusID;
    deal.AccountID = f.AccountID;
    deal.CompanyID = f.PipelineCompanyID;
    deal.TermMonths = 12;
    return deal;
}

/** One sellable product id, DISCOVERED through the picker's own filter rather than named. */
async function sellableProduct(ctx: Ctx, companyID: string): Promise<string> {
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
    Assert(r.Success, `reading the catalogue failed — ${r.ErrorMessage}`);
    const id = (r.Results ?? [])[0]?.ID;
    Assert(!!id, 'the catalogue offered no sellable product for this company — the fixture is not seeded');
    return id;
}

/** The lines of a deal's embedded order. Two hops: `Lines` is declared on `OrderHeader`, not on `Deal`. */
async function orderLines(deal: DealEntity): Promise<readonly BaseEntity[]> {
    const order = deal.OrderID_Object;
    Assert(!!order, `deal ${deal.ID} resolved no embedded order — see save-deal.SD18 first`);
    await order.LoadRelatedRecords('Lines');
    Assert(order.Lines.IsLoaded, 'the order Lines collection did not load');
    return order.Lines.Items;
}

async function saveOk(deal: DealEntity, what: string): Promise<void> {
    const ok = await deal.Save();
    Assert(ok, `${what} failed: ${deal.LatestResult?.CompleteMessage ?? 'unknown error'}`);
}

export const TermStartChecks: NamedCheck[] = [
    {
        Id: 'term-start.TS1',
        Name: 'TS1: a term start is offered on subscription lines only — orders\' own predicate',
        RequiresMutation: true,
        Fn: async () => {
            /**
             * The predicate has to be ORDERS'. `materializeSubscriptions` picks the lines it builds terms
             * for with `SubscriptionTypeID IS NOT NULL`; if this app used any other test, the field would
             * appear on lines that never receive a term (a promise the confirm does not keep) or hide on
             * lines that do (a term the rep could not set).
             */
            AssertEqual(
                IsSubscriptionProduct(subscriptionProduct),
                true,
                'a product carrying a SubscriptionTypeID is a subscription product',
            );
            AssertEqual(
                IsSubscriptionProduct(oneTimeProduct),
                false,
                'a product with no SubscriptionTypeID is NOT a subscription product',
            );

            AssertEqual(
                ShouldOfferTermStart(true, subscriptionProduct, null),
                true,
                'a subscription line offers a term start',
            );
            AssertEqual(
                ShouldOfferTermStart(true, oneTimeProduct, null),
                false,
                'a one-time line does NOT offer a term start — #32 requirement 3',
            );
            AssertEqual(
                ShouldOfferTermStart(false, null, null),
                false,
                'a line with no product chosen offers nothing',
            );
        },
    },
    {
        Id: 'term-start.TS2',
        Name: 'TS2: an EMPTY SubscriptionTypeID is not a subscription — the shape that would flip every line',
        RequiresMutation: true,
        Fn: async () => {
            /**
             * The trap this check exists for: `'' != null` is TRUE. A bare `!= null` test would mark every
             * product carrying an empty-string id as a subscription, which is every product on a host that
             * reads the column through a path returning `''` rather than `null`. The failure is total and
             * silent — a term start on every line, including one-time ones.
             */
            for (const empty of ['', '   ', null, undefined]) {
                AssertEqual(
                    IsSubscriptionProduct({ SubscriptionTypeID: empty as unknown as string | null }),
                    false,
                    `an empty SubscriptionTypeID (${JSON.stringify(empty)}) must not read as a subscription`,
                );
            }
        },
    },
    {
        Id: 'term-start.TS3',
        Name: 'TS3: the order date is DISPLAYED as a default, and a stored term start stops following it',
        RequiresMutation: true,
        Fn: async () => {
            // Nothing stored: the field shows the order date.
            AssertEqual(
                shown(EffectiveTermStart(null, ORDER_DATE)),
                '2026-08-27',
                'with no explicit term start the field displays the order date',
            );

            // Still nothing stored, order date moved: the display follows it.
            AssertEqual(
                shown(EffectiveTermStart(null, MOVED_ORDER_DATE)),
                '2026-09-15',
                'with no explicit term start, moving the order date moves the displayed default',
            );

            // Stored: the display is the stored value, and moving the order date does NOT change it.
            AssertEqual(
                shown(EffectiveTermStart(CHOSEN, ORDER_DATE)),
                '2026-09-01',
                'an explicit term start is what the field displays',
            );
            AssertEqual(
                shown(EffectiveTermStart(CHOSEN, MOVED_ORDER_DATE)),
                '2026-09-01',
                'an explicit term start does NOT move when the order date does — the point of the feature',
            );

            // Cleared: back to following the order date. This is what "reset to order date" produces.
            AssertEqual(
                shown(EffectiveTermStart(null, MOVED_ORDER_DATE)),
                '2026-09-15',
                'clearing the stored value returns the field to the order date',
            );

            AssertEqual(HasExplicitTermStart(CHOSEN), true, 'a stored value reads as explicit');
            AssertEqual(HasExplicitTermStart(null), false, 'a cleared value reads as inherited');
            AssertEqual(
                HasExplicitTermStart(''),
                false,
                'a blank reads as inherited, not as a term start of the epoch',
            );
        },
    },
    {
        Id: 'term-start.TS4',
        Name: 'TS4: a WITHDRAWN product keeps a term start visible rather than hiding a stored value',
        RequiresMutation: true,
        Fn: async () => {
            /**
             * A product quoted last quarter can be gone from the catalogue today, and the picker then
             * cannot say whether it was a subscription. Answering "not a subscription" would hide a term
             * start the rep had already set: the value stays in the database, still governs the term, and
             * has no control on screen to see or clear it. So for an unknown product the stored value
             * decides — and nothing is invented for a line that never had one.
             */
            AssertEqual(
                ShouldOfferTermStart(true, null, CHOSEN),
                true,
                'a withdrawn product with a stored term start still shows it',
            );
            AssertEqual(
                ShouldOfferTermStart(true, null, null),
                false,
                'a withdrawn product with no stored term start shows nothing',
            );
        },
    },
    {
        Id: 'term-start.TS5',
        Name: 'TS5: the picker can actually read SubscriptionTypeID — the field that makes the control vanish',
        RequiresMutation: true,
        Fn: async (ctx) => {
            /**
             * THE SILENT-DISAPPEARANCE GUARD. `LoadProducts` asks for `SubscriptionTypeID` by name; drop it
             * from that `Fields` list, or lose it from the entity's metadata, and every product arrives
             * with `undefined` — so no line is a subscription, no line offers a term start, and there is no
             * error anywhere. The screen just quietly loses a feature.
             *
             * This asserts the read SUCCEEDS and the property is PRESENT, not that any product has a value:
             * whether the seeded catalogue contains a subscription product is a seed question, and a check
             * that demanded one would fail on a correct host with a different catalogue.
             */
            const f = await ResolveSalesFixture(ctx);
            const r = await new RunView().RunView<Record<string, unknown>>(
                {
                    EntityName: E_ORDERS_PRODUCT,
                    ExtraFilter: ProductFilterFor(f.PipelineCompanyID, new Date()),
                    OrderBy: 'Name ASC',
                    ResultType: 'simple',
                    // THE PICKER'S OWN LIST, not a copy of it. A re-typed list would keep this check
                    // green while LoadProducts quietly stopped asking for SubscriptionTypeID.
                    Fields: [...PRODUCT_LOOKUP_FIELDS],
                },
                ctx.User,
            );
            Assert(
                r.Success,
                'the catalogue read including SubscriptionTypeID FAILED — the term start control cannot '
                    + `appear on any line while this is true. ${r.ErrorMessage}`,
            );
            const rows = r.Results ?? [];
            Assert(rows.length > 0, 'the catalogue offered nothing for this company — the fixture is not seeded');
            for (const row of rows) {
                Assert(
                    Object.prototype.hasOwnProperty.call(row, 'SubscriptionTypeID'),
                    'a catalogue row came back WITHOUT a SubscriptionTypeID property. Every line would '
                        + 'then read as non-subscription and the term start would disappear silently.',
                );
            }
        },
    },
    {
        Id: 'term-start.TS6',
        Name: 'TS6: an explicit term start on a deal\'s line survives save and reload',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * The one claim the pure checks cannot make: that the column sales writes actually
                 * persists through the deal's save graph — deal → embedded order → lines — and comes back
                 * on a fresh read. The workspace writes exactly this and nothing else.
                 */
                const f = await ResolveSalesFixture(ctx);
                const deal = await newDeal(ctx, f);
                await saveOk(deal, 'the first save of the deal');

                const productID = await sellableProduct(ctx, f.PipelineCompanyID);
                const line = await deal.OrderID_EnsureObject().Lines.Create();
                line.Set('ProductID', productID);
                line.Set('Quantity', 1);
                line.Set('ServicePeriodStart', CHOSEN);
                await saveOk(deal, 'saving the deal with a term start on its line');

                const dealID = deal.ID;
                const reread = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await reread.Load(dealID), `deal ${dealID} could not be re-read`);
                const lines = await orderLines(reread);
                AssertEqual(lines.length, 1, 'the deal should have exactly one line');

                AssertEqual(
                    shown(lines[0].Get('ServicePeriodStart') as Date | string | null),
                    '2026-09-01',
                    'the term start written on the deal must survive save and reload — if this is null, '
                        + 'the column never reached the database and the field is decorative',
                );

                /**
                 * And nothing else was written. `ServicePeriodEnd` is orders' to compute at confirm; a
                 * value guessed here would be sales stating a commercial term, which is the boundary this
                 * app does not cross (#32 requirement 2).
                 */
                AssertEqual(
                    lines[0].Get('ServicePeriodEnd') ?? null,
                    null,
                    'sales must not write a term END — orders computes it from the subscription cadence',
                );

                /**
                 * The reset path, proved on a real row rather than in the abstract: clearing the column
                 * persists as NULL, which is what returns the field to following the order date. A save
                 * that silently kept the old value would leave "reset to order date" doing nothing.
                 */
                lines[0].Set('ServicePeriodStart', null);
                await saveOk(reread, 'saving the deal after resetting the term start');

                const after = await TxOne<{ ServicePeriodStart: Date | string | null }>(
                    ctx,
                    `SELECT ServicePeriodStart FROM __mj_BizAppsOrders.OrderLine WHERE ID = '${lines[0].Get('ID')}'`,
                );
                AssertEqual(
                    shown(after?.ServicePeriodStart ?? null),
                    null,
                    'resetting the term start must clear the stored value, not leave the previous one',
                );
            }),
    },
];

for (const check of TermStartChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

IntegrationCheckRegistry.Instance.RegisterLifecycle('term-start', {
    Setup: async () => {
        Assert(
            OrdersIsInstalled(),
            'term-start REQUIRES bizapps-orders: the column it writes is OrderLine.ServicePeriodStart, on '
                + 'the deal\'s embedded order. A host without orders is misconfigured rather than minimal '
                + '— see docs/WORKSPACE-SETUP.md.',
        );
    },
    Teardown: async () => {
        // Nothing to sweep: TS6 rolled back and the rest never touched the database.
    },
});
