/**
 * @fileoverview `product-picker` — PP1–PP5. The rule deciding which of orders' products a deal line may
 * reference, checked against a live database.
 *
 * WHY THIS BUNDLE IS SMALL AND STILL WORTH HAVING. The picker is one `RunView` filter, and a filter is
 * exactly the kind of code that looks obviously right and is quietly wrong. Two of its three conditions
 * fail SILENTLY when broken: a missing company clause leaks another tenant's catalogue, and a missing
 * window clause offers something that cannot be sold. Neither throws, and neither is visible in a
 * screenshot — the list simply has the wrong rows in it.
 *
 * ⚠️ **`RUN_MUTATION_TESTS=1` IS MANDATORY** for the bundle to run at all, in line with the rest of the
 * suite. These particular checks only READ, but they read seeded rows the mutation gate implies.
 *
 * ── WHAT IT READS ───────────────────────────────────────────────────────────────────────────────
 *
 * `MJ_BizApps_Orders: Products`, which on this host is a **DEV-ONLY STAND-IN** — orders' real `Product`
 * DDL transcribed verbatim, because orders' full schema cannot be applied here (it has hard foreign keys
 * into `__mj_BizAppsAccounting`, which in turn has one into `__mj_BizAppsTasks`). The columns, the CHECK
 * constraints and the filtered-unique SKU index are orders' own, so the rule proved here is the rule that
 * will hold against the real schema. What is NOT proved is anything about orders' other 44 tables.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { RunView } from '@memberjunction/core';
import {
    Assert,
    AssertEqual,
    IntegrationCheckRegistry,
    type NamedCheck,
} from '@memberjunction/testing-integration';
import { E_ORDERS_PRODUCT, ProductFilterFor } from '@mj-biz-apps/sales-entities';

import { InRolledBackTransaction, ProviderOf, ResolveSalesFixture } from '../fixture.js';
import { type DealEntity } from '@mj-biz-apps/sales-entities';

/** Sales' Deals entity. Declared locally, as close-won-order.fixture.ts does — it is not re-exported. */
const E_DEAL = 'MJ_BizApps_Sales: Deals';

type Ctx = Parameters<NamedCheck['Fn']>[0];

/**
 * Runs the picker's own filter — the real one, not a re-typed copy — and returns IDS.
 *
 * It used to return names, which was safe only while the catalogue was scoped to one company. #29
 * widened it to all of them, and `Product.Name` carries no unique constraint (only SKU has a filtered
 * unique index). Two companies selling a same-named product is not a hypothetical here: it is the
 * premise of the issue, and the seed scripts already duplicate names across files. Matching on a name
 * lets PP2 — the check that IS #29 — pass while a foreign product is wrongly excluded, so long as a
 * same-named local one is offered.
 */
async function offered(ctx: Ctx, asOf: Date): Promise<string[]> {
    const rv = new RunView();
    const r = await rv.RunView<{ ID: string; Name: string }>(
        {
            EntityName: E_ORDERS_PRODUCT,
            ExtraFilter: ProductFilterFor(asOf),
            OrderBy: 'Name ASC',
            ResultType: 'simple',
            Fields: ['ID', 'Name'],
        },
        ctx.User,
    );
    Assert(r.Success, `the product query failed — ${r.ErrorMessage}`);
    return (r.Results ?? []).map((p) => String(p.ID).toLowerCase());
}

/** Everything in the catalogue, regardless of the rule — the denominator. */
interface CatalogueRow {
    ID: string;
    Name: string;
    Status: string;
    CompanyID: string;
    AvailableFrom: string | null;
    AvailableTo: string | null;
}

async function all(ctx: Ctx): Promise<CatalogueRow[]> {
    const rv = new RunView();
    const r = await rv.RunView<CatalogueRow>(
        /**
         * `ID` so callers can compare identities; `Name` is for MESSAGES only, never for matching.
         *
         * The WINDOW columns are here so a check can work out for itself which products ought to be
         * offered, rather than asking the picker and then asserting the picker's own answer back at it.
         * PP2 did the latter for a while and its loop could not fail.
         */
        {
            EntityName: E_ORDERS_PRODUCT,
            ResultType: 'simple',
            Fields: ['ID', 'Name', 'Status', 'CompanyID', 'AvailableFrom', 'AvailableTo'],
        },
        ctx.User,
    );
    Assert(r.Success, `reading the catalogue failed — ${r.ErrorMessage}`);
    return r.Results ?? [];
}

/**
 * The id of a product this suite refers to by its seeded name.
 *
 * PP3 and PP4 test the availability WINDOW against three specific seeded rows, so they have to name
 * them somehow. Naming them is fine; COMPARING by name is not, now that the catalogue spans every
 * company and `Product.Name` carries no unique constraint. This resolves the name to an identity once
 * and REFUSES if the seed is ambiguous, so a duplicate name fails loudly here instead of quietly
 * changing what PP3 and PP4 mean.
 */
function seedProductId(catalogue: { ID: string; Name: string }[], name: string): string {
    const hits = catalogue.filter((p) => p.Name === name);
    AssertEqual(
        hits.length,
        1,
        `the window checks name '${name}' expecting exactly one such product; found ${hits.length}. `
            + 'Seed it, or rename the duplicate — comparing by name across companies is what this avoids.',
    );
    return String(hits[0].ID).toLowerCase();
}

/** The company Sales' pipelines sell for — the same source the server stamps `Deal.CompanyID` from. */
async function sellingCompany(ctx: Ctx): Promise<string> {
    const f = await ResolveSalesFixture(ctx);
    return f.PipelineCompanyID;
}

const TODAY = new Date('2026-08-15T00:00:00Z');

export const ProductPickerChecks: NamedCheck[] = [
    {
        Id: 'product-picker.PP1',
        Name: 'PP1: only ACTIVE products are offered — Draft, Discontinued and EOL are not sellable',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const names = await offered(ctx, TODAY);
                const catalogue = await all(ctx);

                // Every non-Active product must be absent, from ANY company. Since #29 removed the
                // company clause the catalogue spans all of them, so scoping this to one company would
                // now test less than it used to rather than the same thing.
                const mine = catalogue;
                for (const p of mine) {
                    if (p.Status !== 'Active') { // vocabulary-grep-allow: Status belongs to ORDERS' Product, not to one of Sales' ten type tables. It is a CHECK-constrained enum in another app's schema with no flag table behind it, so there is no flag to read instead — and the whole point of this check is that the picker filters on exactly these literals.
                        Assert(
                            !names.includes(String(p.ID).toLowerCase()),
                            `'${p.Name}' has status ${p.Status} and must not be offered`,
                        );
                    }
                }
                Assert(
                    mine.some((p) => p.Status !== 'Active'), // vocabulary-grep-allow: Status belongs to ORDERS' Product, not to one of Sales' ten type tables. It is a CHECK-constrained enum in another app's schema with no flag table behind it, so there is no flag to read instead — and the whole point of this check is that the picker filters on exactly these literals.
                    'the seed must contain a non-Active product, or this check proves nothing',
                );
                Assert(names.length > 0, 'at least one active product must be offered');
            }),
    },
    {
        Id: 'product-picker.PP2',
        Name: 'PP2: products from OTHER companies ARE offered — a deal is not limited to its own company',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const company = await sellingCompany(ctx);
                const names = await offered(ctx, TODAY);
                const catalogue = await all(ctx);

                /**
                 * THIS CHECK USED TO ASSERT THE OPPOSITE, and the reversal is the point of issue #29.
                 *
                 * It read "another company's products are NEVER offered — the cross-tenant leak", on the
                 * reasoning that showing one company another's catalogue is a data leak. That framing was
                 * wrong for Blue Cypress: every deal is a Blue Cypress deal and company ownership lives at
                 * the PRODUCT (Johanna Snider, Sales channel, 2026-08-26). With both pipelines owned by
                 * Blue Cypress the old rule made every Betty and Sidecar product unsellable.
                 *
                 * There is no tenancy boundary being crossed. `DECISIONS.md` D5 has always said a deal
                 * lives in one company's pipeline while its LINES carry their own company, taken from the
                 * product — so the old clause contradicted D5 and this one agrees with it.
                 */
                const foreign = catalogue.filter((x) => x.CompanyID.toLowerCase() !== company.toLowerCase());
                Assert(foreign.length > 0, 'the seed must contain another company product, or this proves nothing');

                /**
                 * ── THE EXPECTATION IS COMPUTED, NOT BORROWED FROM THE ANSWER ────────────────────
                 *
                 * Two mistakes were made here in turn, and the second was worse.
                 *
                 * First this demanded every ACTIVE foreign product be offered — a rule stronger than the
                 * filter under test, which also applies the availability window. It passed only because
                 * both seeded foreign products have NULL windows.
                 *
                 * Then the window was added by filtering on `names.includes(...)` — the picker's own
                 * output — and the loop below went on asserting that same predicate. It could no longer
                 * fail. Reverting #29 entirely would still turn PP2 red, but on the anti-vacuity guard,
                 * whose message sends the reader to the seed script while the picker regression ships.
                 *
                 * So the expectation comes from the CATALOGUE's own columns. Active, and today inside its
                 * availability window, is what `ProductFilterFor` claims to mean; deriving it here and
                 * comparing against `names` is a real assertion about the picker.
                 */
                const day = TODAY.toISOString().slice(0, 10);
                const sellableForeign = foreign.filter(
                    (x) => x.Status === 'Active' // vocabulary-grep-allow: Status belongs to ORDERS' Product, not to Sales
                        && (!x.AvailableFrom || String(x.AvailableFrom).slice(0, 10) <= day)
                        && (!x.AvailableTo || String(x.AvailableTo).slice(0, 10) >= day),
                );
                Assert(
                    sellableForeign.length > 0,
                    'the seed must contain an ACTIVE product owned by another company, or this proves nothing',
                );

                for (const p of sellableForeign) {
                    Assert(
                        names.includes(String(p.ID).toLowerCase()),
                        `'${p.Name}' is Active and owned by another company, so it must be offered (#29)`,
                    );
                }
            }),
    },
    {
        Id: 'product-picker.PP3',
        Name: 'PP3: the availability window is respected at both ends, and NULL means always',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const names = await offered(ctx, TODAY);
                // Needed to resolve the seeded products below to IDS rather than matching on their names.
                const catalogue = await all(ctx);

                // Seeded specifically for this: Active, but the window closed / has not opened.
                Assert(
                    !names.includes(seedProductId(catalogue, 'Expired Promo Bundle')),
                    'a product whose AvailableTo has passed must not be offered, even though it is Active',
                );
                Assert(
                    !names.includes(seedProductId(catalogue, 'Next Year Programme')),
                    'a product whose AvailableFrom is in the future must not be offered yet',
                );
                // Both NULL — the common case, and the one an over-eager range test breaks.
                Assert(
                    names.includes(seedProductId(catalogue, 'Platform — Standard Seat')),
                    'a product with no window at all must be offered — NULL means always available',
                );
            }),
    },
    {
        Id: 'product-picker.PP4',
        Name: 'PP4: the window is evaluated AS OF a date, so the same catalogue answers differently in time',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const company = await sellingCompany(ctx);

                /**
                 * The filter takes the date as an argument rather than reading the clock, which is what
                 * makes this checkable at all. It also pins a real behaviour: a deal quoted last year and
                 * one quoted next year do not see the same catalogue, and the picker must not pretend
                 * otherwise.
                 */
                const during2025 = await offered(ctx, new Date('2025-06-01T00:00:00Z'));
                const during2027 = await offered(ctx, new Date('2027-08-01T00:00:00Z'));
                const catalogue = await all(ctx);
                const expired = seedProductId(catalogue, 'Expired Promo Bundle');
                const future = seedProductId(catalogue, 'Next Year Programme');

                Assert(
                    during2025.includes(expired),
                    'the promo WAS available in 2025 — the window is judged as of the date, not always "now"',
                );
                Assert(
                    !during2025.includes(future),
                    'the 2027 programme was not available in 2025',
                );
                Assert(
                    during2027.includes(future),
                    'the 2027 programme IS available in 2027',
                );
                AssertEqual(
                    during2027.includes(expired),
                    false,
                    'and the promo is NOT available in 2027 — otherwise the window is being ignored',
                );
            }),
    },
];


/**
 * PP5 — the ACCEPTANCE CRITERION the filter checks cannot reach.
 *
 * PP1-PP4 prove what the picker OFFERS. They say nothing about what happens when a rep actually puts a
 * foreign-company product on a deal, which is the half of #29 that touches money: the line has to book
 * revenue to the PRODUCT's company, not the deal's, or an intercompany settlement is mis-aimed.
 *
 * Deliberately asserted through the entity layer rather than the browser. `OnProductChange` stamps
 * `CompanyID` client-side so `deal.Validate()` can pass, but orders' `OrderLineEntityServer` is the
 * authority and overwrites it at save. This check pins the AUTHORITY. If the client stamp and the
 * server ever disagree, this is what still holds.
 */
ProductPickerChecks.push({
    Id: 'product-picker.PP5',
    Name: "PP5: a line's company comes from its PRODUCT, not from the deal — cross-company deals book correctly",
    RequiresMutation: true,
    Fn: async (ctx) =>
        InRolledBackTransaction(ctx, async () => {
            const f = await ResolveSalesFixture(ctx);
            const catalogue = await all(ctx);

            const foreign = catalogue.find(
                (x) =>
                    x.CompanyID.toLowerCase() !== f.PipelineCompanyID.toLowerCase() &&
                    x.Status === 'Active', // vocabulary-grep-allow: Status belongs to ORDERS' Product, not to Sales
            );
            Assert(
                !!foreign,
                'the seed must contain an ACTIVE product owned by another company, or this check proves nothing',
            );

            /**
             * The id comes straight off the row `all()` already returned.
             *
             * This used to re-query by `Name` and take `[0]` of an unordered result — a name-as-identity
             * lookup that this module's own header rules out, against a catalogue #29 widened to every
             * company. With two same-named products it could vet one row and then save a line against
             * the other, failing its own closing assertion against correct code, or passing for a reason
             * unrelated to what it claims.
             */
            const product = { ID: foreign!.ID, CompanyID: foreign!.CompanyID };

            const deal = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
            deal.NewRecord();
            deal.Name = `PP5 cross-company ${Math.abs(Date.now() % 100000)}`;
            deal.PipelineID = f.PipelineID;
            deal.PipelineStageID = f.StageID;
            deal.DealTypeID = f.DealTypeID;
            deal.DealStatusTypeID = f.OpenStatusID;
            deal.AccountID = f.AccountID;
            deal.CompanyID = f.PipelineCompanyID;
            deal.TermMonths = 12;
            Assert(
                await deal.Save(),
                `setup: the deal could not be saved — ${deal.LatestResult?.CompleteMessage ?? 'unknown error'}`,
            );

            const order = deal.OrderID_Object;
            Assert(!!order, 'setup: the deal saved without an embedded order');

            // NO CompanyID set here, deliberately -- the point is what the server derives from the product.
            const line = await order!.Lines.Create();
            line.ProductID = product.ID;
            line.Quantity = 1;
            Assert(
                await deal.Save(),
                `the line could not be saved — ${deal.LatestResult?.CompleteMessage ?? 'unknown error'}`,
            );

            const saved = await new RunView().RunView<{ CompanyID: string; ProductID: string }>(
                {
                    EntityName: 'MJ_BizApps_Orders: Order Lines',
                    ExtraFilter: `OrderHeaderID = '${order!.ID}'`,
                    ResultType: 'simple',
                    Fields: ['CompanyID', 'ProductID'],
                },
                ctx.User,
            );
            Assert(saved.Success, `reading the saved line failed — ${saved.ErrorMessage}`);
            const rows = saved.Results ?? [];
            AssertEqual(rows.length, 1, 'exactly one line should have been written');

            AssertEqual(
                rows[0].CompanyID.toLowerCase(),
                product.CompanyID.toLowerCase(),
                "the line must book to the PRODUCT's company",
            );
            Assert(
                rows[0].CompanyID.toLowerCase() !== f.PipelineCompanyID.toLowerCase(),
                'the line took the DEAL\'s company — the whole point of #29 is that it should not',
            );
        }),
});

for (const check of ProductPickerChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

IntegrationCheckRegistry.Instance.RegisterLifecycle('product-picker', {
    Setup: async () => {
        // Nothing to create: the stand-in catalogue is seeded with the host, like the rest of the fixture.
    },
    Teardown: async () => {
        // Nothing to sweep: PP1-PP4 only read, and PP5 writes inside a rolled-back transaction.
    },
});
