/**
 * @fileoverview The seed for `close-won-order` — a won-ready deal whose lines are ORDER lines.
 *
 * Replaces `close-won-handoff.fixture.ts`. That one built `DealLine` rows and set `ProductName` as a
 * transcription beside `ProductID`; the deal holds no lines at all now (S-US4), so the seeder reaches
 * through the deal's embedded order instead.
 *
 * ── WHAT CHANGED, AND WHY IT IS SHORTER ─────────────────────────────────────────────────────────
 *
 * The old seeder had to state a line TYPE (`DealLineTypeID`, one-time vs recurring) and a NAME. Neither
 * exists on an order line: the type table is retired, and orders resolves the product name at read time
 * rather than storing a transcription. So a seeded line is now product + quantity, which is exactly what
 * S-US4 says a rep supplies — orders stamps `CompanyID` from the product and prices `UnitPrice` itself.
 *
 * It also no longer needs a `NameOnly` mode. That existed to build the KI-14 shape — a name with a null
 * `ProductID` — which `OrderLine.ProductID` being `NOT NULL` makes unconstructible.
 *
 * Products are DISCOVERED through the picker's own filter, never hardcoded. A fixture naming a SKU would
 * pass on the seeded host, fail everywhere else, and keep passing if the picker's filter broke.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { RunView } from '@memberjunction/core';
import { Assert, type NamedCheck } from '@memberjunction/testing-integration';
import { E_ORDERS_PRODUCT, ProductFilterFor, type DealEntity } from '@mj-biz-apps/sales-entities';

import { ProviderOf, type SalesFixture } from '../fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

const E_DEAL = 'MJ_BizApps_Sales: Deals';
const E_STATUS_TYPE = 'MJ_BizApps_Sales: Deal Status Types';

export interface SeededOrderDeal {
    DealID: string;
    /** The order the deal provisioned for itself on save. Never null: a saved deal always has one. */
    OrderID: string;
    CompanyID: string;
    AccountID: string;
    /** The status whose `IsWon` flag is set — resolved by FLAG, never by name. */
    WonStatusID: string;
    /** The products the order lines carry, in the order they were added. */
    ExpectedProductIDs: string[];
    ExpectedQuantities: number[];
}

/**
 * Sellable products for ONE company, for seeding.
 *
 * ── WHY THIS STILL SCOPES BY COMPANY WHEN THE PICKER NO LONGER DOES ──
 *
 * It used to get the scoping for free: `ProductFilterFor` carried a `CompanyID` clause, so "the
 * picker's rule" and "this company's products" were the same query. Issue #29 removed that clause, and
 * for a moment this function kept calling the picker's rule and silently became company-BLIND — it
 * takes `found.slice(0, count)` off an alphabetical list, so the close-won and close-deal bundles
 * would have started seeding lines that reference OTHER companies' products.
 *
 * Those checks passed anyway, which is the danger: roughly twenty of them would have gone on being
 * green while exercising a different scenario than the one they were written for. Nothing about
 * close-won is supposed to vary by whose product is on the line.
 *
 * So the company clause moved HERE, where it is a deliberate property of the fixture rather than an
 * accident of the picker's rule. Cross-company selection is a real behaviour and it is tested — by PP5
 * below, on purpose, rather than leaking into every other bundle.
 */
async function sellableProducts(ctx: Ctx, companyID: string, count: number): Promise<{ ID: string; Name: string }[]> {
    if (count === 0) {
        return [];
    }
    const scoped = `CompanyID = '${companyID.replace(/'/g, "''")}' AND (${ProductFilterFor(new Date())})`;
    const r = await new RunView().RunView<{ ID: string; Name: string }>(
        {
            EntityName: E_ORDERS_PRODUCT,
            ExtraFilter: scoped,
            OrderBy: 'Name ASC',
            ResultType: 'simple',
            Fields: ['ID', 'Name'],
        },
        ctx.User,
    );
    Assert(r.Success, `setup: reading orders' catalogue failed — ${r.ErrorMessage}`);
    const found = r.Results ?? [];
    Assert(
        found.length >= count,
        `setup: the host needs at least ${count} sellable product(s) for company ${companyID}, found ${found.length}`,
    );
    return found.slice(0, count);
}

/** The status carrying `IsWon` — by flag, because a deployment renames "Closed Won" freely. */
async function wonStatusID(ctx: Ctx): Promise<string> {
    const r = await new RunView().RunView<{ ID: string }>(
        { EntityName: E_STATUS_TYPE, ExtraFilter: 'IsWon = 1 AND IsActive = 1', ResultType: 'simple', Fields: ['ID'] },
        ctx.User,
    );
    Assert(r.Success && (r.Results ?? []).length > 0, 'setup: no active WON status exists on this host');
    return (r.Results ?? [])[0].ID;
}

/** Which pipeline to seed on, and with how many order lines. */
export interface SeedTarget {
    PipelineID: string;
    StageID: string;
    /** The pipeline's OWN company — products are per-company, so this drives the picker's filter. */
    CompanyID: string;
    /** Zero is meaningful: a header-only deal, which is the whole point on a lineless motion. */
    LineCount: number;
}

/**
 * A saved, open deal on a NAMED pipeline, with `LineCount` lines on its embedded order.
 *
 * The order is not created here. `DealEntityServer` provisions it on the deal's first save, so this seeder
 * saves the deal FIRST and then adds lines to the order that appeared — which is also the sequence a rep
 * takes, and means the fixture exercises the provisioning rather than working around it.
 */
export async function SeedDealOnPipeline(ctx: Ctx, f: SalesFixture, target: SeedTarget): Promise<SeededOrderDeal> {
    const products = await sellableProducts(ctx, target.CompanyID, target.LineCount);
    const quantities = [3, 5, 7].slice(0, target.LineCount);

    const deal = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
    deal.NewRecord();
    deal.Name = `Close-won order ${Math.abs(Date.now() % 100000)}`;
    deal.PipelineID = target.PipelineID;
    deal.PipelineStageID = target.StageID;
    deal.DealTypeID = f.DealTypeID;
    deal.DealStatusTypeID = f.OpenStatusID;
    deal.AccountID = f.AccountID;
    deal.CompanyID = target.CompanyID;
    deal.TermMonths = 12;

    Assert(
        await deal.Save(),
        `setup: the deal could not be saved — ${deal.LatestResult?.CompleteMessage ?? 'unknown error'}`,
    );
    Assert(
        !!deal.OrderID,
        'setup: the deal saved without provisioning an order. If OrderNumber is the complaint, orders\' ' +
            'server classes are not loaded in this process — see DealEntityServer.explainOrderProvisioningFailure.',
    );

    if (products.length > 0) {
        const order = deal.OrderID_Object;
        Assert(!!order, 'setup: the deal has an OrderID but its embedded order did not resolve');
        for (let i = 0; i < products.length; i++) {
            const line = await order.Lines.Create();
            line.ProductID = products[i].ID;
            line.Quantity = quantities[i];
        }
        Assert(
            await deal.Save(),
            `setup: the order lines could not be saved — ${deal.LatestResult?.CompleteMessage ?? 'unknown error'}`,
        );
    }

    return {
        DealID: deal.ID,
        OrderID: deal.OrderID as string,
        CompanyID: target.CompanyID,
        AccountID: f.AccountID,
        WonStatusID: await wonStatusID(ctx),
        ExpectedProductIDs: products.map((p) => p.ID),
        ExpectedQuantities: quantities,
    };
}
