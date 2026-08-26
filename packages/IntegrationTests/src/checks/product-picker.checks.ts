/**
 * @fileoverview `product-picker` — PP1–PP4. The rule deciding which of orders' products a deal line may
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

import { InRolledBackTransaction, ResolveSalesFixture } from '../fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

/** Runs the picker's own filter — the real one, not a re-typed copy. */
async function offered(ctx: Ctx, companyID: string, asOf: Date): Promise<string[]> {
    const rv = new RunView();
    const r = await rv.RunView<{ ID: string; Name: string }>(
        {
            EntityName: E_ORDERS_PRODUCT,
            ExtraFilter: ProductFilterFor(companyID, asOf),
            OrderBy: 'Name ASC',
            ResultType: 'simple',
            Fields: ['ID', 'Name'],
        },
        ctx.User,
    );
    Assert(r.Success, `the product query failed — ${r.ErrorMessage}`);
    return (r.Results ?? []).map((p) => p.Name);
}

/** Everything in the catalogue, regardless of the rule — the denominator. */
async function all(ctx: Ctx): Promise<{ Name: string; Status: string; CompanyID: string }[]> {
    const rv = new RunView();
    const r = await rv.RunView<{ Name: string; Status: string; CompanyID: string }>(
        { EntityName: E_ORDERS_PRODUCT, ResultType: 'simple', Fields: ['Name', 'Status', 'CompanyID'] },
        ctx.User,
    );
    Assert(r.Success, `reading the catalogue failed — ${r.ErrorMessage}`);
    return r.Results ?? [];
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
                const company = await sellingCompany(ctx);
                const names = await offered(ctx, company, TODAY);
                const catalogue = await all(ctx);

                // Every non-Active product for this company must be absent.
                const mine = catalogue.filter((x) => x.CompanyID.toLowerCase() === company.toLowerCase());
                for (const p of mine) {
                    if (p.Status !== 'Active') { // vocabulary-grep-allow: Status belongs to ORDERS' Product, not to one of Sales' ten type tables. It is a CHECK-constrained enum in another app's schema with no flag table behind it, so there is no flag to read instead — and the whole point of this check is that the picker filters on exactly these literals.
                        Assert(
                            !names.includes(p.Name),
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
        Name: 'PP2: another company products are NEVER offered — the cross-tenant leak',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const company = await sellingCompany(ctx);
                const names = await offered(ctx, company, TODAY);
                const catalogue = await all(ctx);

                /**
                 * THE MOST CONSEQUENTIAL OF THE THREE CONDITIONS. A missing status or window clause
                 * offers something unsellable, which a human notices. A missing company clause shows one
                 * tenant another tenant's catalogue, which nobody notices, and which is a data leak
                 * rather than a mistake.
                 */
                const foreign = catalogue.filter((x) => x.CompanyID.toLowerCase() !== company.toLowerCase());
                Assert(foreign.length > 0, 'the seed must contain another company product, or this proves nothing');

                for (const p of foreign) {
                    Assert(!names.includes(p.Name), `'${p.Name}' belongs to another company and must not be offered`);
                }
            }),
    },
    {
        Id: 'product-picker.PP3',
        Name: 'PP3: the availability window is respected at both ends, and NULL means always',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const company = await sellingCompany(ctx);
                const names = await offered(ctx, company, TODAY);

                // Seeded specifically for this: Active, but the window closed / has not opened.
                Assert(
                    !names.includes('Expired Promo Bundle'),
                    'a product whose AvailableTo has passed must not be offered, even though it is Active',
                );
                Assert(
                    !names.includes('Next Year Programme'),
                    'a product whose AvailableFrom is in the future must not be offered yet',
                );
                // Both NULL — the common case, and the one an over-eager range test breaks.
                Assert(
                    names.includes('Platform — Standard Seat'),
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
                const during2025 = await offered(ctx, company, new Date('2025-06-01T00:00:00Z'));
                const during2027 = await offered(ctx, company, new Date('2027-08-01T00:00:00Z'));

                Assert(
                    during2025.includes('Expired Promo Bundle'),
                    'the promo WAS available in 2025 — the window is judged as of the date, not always "now"',
                );
                Assert(
                    !during2025.includes('Next Year Programme'),
                    'the 2027 programme was not available in 2025',
                );
                Assert(
                    during2027.includes('Next Year Programme'),
                    'the 2027 programme IS available in 2027',
                );
                AssertEqual(
                    during2027.includes('Expired Promo Bundle'),
                    false,
                    'and the promo is NOT available in 2027 — otherwise the window is being ignored',
                );
            }),
    },
];

for (const check of ProductPickerChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

IntegrationCheckRegistry.Instance.RegisterLifecycle('product-picker', {
    Setup: async () => {
        // Nothing to create: the stand-in catalogue is seeded with the host, like the rest of the fixture.
    },
    Teardown: async () => {
        // Nothing to sweep: these checks only read.
    },
});
