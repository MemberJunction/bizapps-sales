/**
 * @fileoverview The seed for `close-won-handoff` — a won-ready deal whose lines name REAL products.
 *
 * Separate from `close-deal`'s seed on purpose. That one sets `ProductName` as free text, because it
 * was written when `DealLine.ProductID` was null on every row and the close routed to a stub. These
 * checks need the opposite: lines that carry actual `ProductID`s from orders' catalogue, chosen by the
 * same filter the picker uses, because the whole claim under test is that those IDs survive the
 * handoff onto order lines.
 *
 * The products are DISCOVERED, never hardcoded. A fixture naming a SKU would pass on the seeded host
 * and fail everywhere else, and worse, would keep passing if the picker's filter broke.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { RunView } from '@memberjunction/core';
import { Assert, type NamedCheck } from '@memberjunction/testing-integration';
import {
    E_ORDERS_PRODUCT,
    ProductFilterFor,
    type DealEntity,
    type mjBizAppsSalesDealLineEntity,
} from '@mj-biz-apps/sales-entities';

import { ProviderOf, type SalesFixture } from '../fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

const E_DEAL = 'MJ_BizApps_Sales: Deals';
const E_STATUS_TYPE = 'MJ_BizApps_Sales: Deal Status Types';

export interface SeededHandoffDeal {
    DealID: string;
    CompanyID: string;
    AccountID: string;
    /** The status whose `IsWon` flag is set — resolved by FLAG, never by name. */
    WonStatusID: string;
    /** The products the ONE-TIME lines carry, in the order they were added. */
    ExpectedOrderProductIDs: string[];
    ExpectedOrderQuantities: number[];
}

/** One product as the picker records it: the ID it references AND the name it transcribes. */
interface PickedProduct {
    ID: string;
    Name: string;
}

/** Two sellable products, chosen by the picker's own rule so the fixture cannot drift from it. */
async function sellableProducts(ctx: Ctx, companyID: string, count: number): Promise<PickedProduct[]> {
    const rv = new RunView();
    const r = await rv.RunView<{ ID: string; Name: string }>(
        {
            EntityName: E_ORDERS_PRODUCT,
            ExtraFilter: ProductFilterFor(companyID, new Date()),
            OrderBy: 'Name ASC',
            ResultType: 'simple',
            Fields: ['ID', 'Name'],
        },
        ctx.User,
    );
    Assert(r.Success, `setup: reading orders' catalogue failed — ${r.ErrorMessage}`);
    const found = (r.Results ?? []).map((p) => ({ ID: p.ID, Name: p.Name }));
    Assert(
        found.length >= count,
        `setup: the host needs at least ${count} sellable products for company ${companyID}, found ${found.length}`,
    );
    return found.slice(0, count);
}

/** The status carrying `IsWon` — by flag, because a deployment renames "Closed Won" freely. */
async function wonStatusID(ctx: Ctx): Promise<string> {
    const rv = new RunView();
    const r = await rv.RunView<{ ID: string }>(
        { EntityName: E_STATUS_TYPE, ExtraFilter: 'IsWon = 1 AND IsActive = 1', ResultType: 'simple', Fields: ['ID'] },
        ctx.User,
    );
    Assert(r.Success && (r.Results ?? []).length > 0, 'setup: no active WON status exists on this host');
    return (r.Results ?? [])[0].ID;
}

/** Which pipeline to seed on, and with how many one-time lines. */
export interface SeedTarget {
    PipelineID: string;
    StageID: string;
    /** The pipeline's OWN company — products are per-company, so this drives the picker's filter. */
    CompanyID: string;
    /** Zero is meaningful: a header-only deal, which is the whole point on a lineless motion. */
    LineCount: number;
}

/**
 * A saved, open deal on a NAMED pipeline, with `LineCount` one-time lines naming real products.
 *
 * All lines are one-time deliberately: the recurring path routes to a contract, and this fixture feeds
 * the ORDER checks.
 */
export async function SeedDealOnPipeline(ctx: Ctx, f: SalesFixture, target: SeedTarget): Promise<SeededHandoffDeal> {
    const products = target.LineCount > 0 ? await sellableProducts(ctx, target.CompanyID, target.LineCount) : [];
    const quantities = [3, 5, 7].slice(0, target.LineCount);

    const deal = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
    deal.NewRecord();
    deal.Name = `Handoff seam ${Math.abs(Date.now() % 100000)}`;
    deal.PipelineID = target.PipelineID;
    deal.PipelineStageID = target.StageID;
    deal.DealTypeID = f.DealTypeID;
    deal.DealStatusTypeID = f.OpenStatusID;
    deal.AccountID = f.AccountID;
    deal.CompanyID = target.CompanyID;
    deal.TermMonths = 12;

    for (let i = 0; i < products.length; i++) {
        const line: mjBizAppsSalesDealLineEntity = await deal.Lines.Create();
        line.DealLineTypeID = f.OneTimeLineTypeID;
        line.ProductID = products[i].ID;
        // BOTH, because that is what the picker writes: the reference orders needs, and the name that
        // keeps the line readable if orders is ever uninstalled. `DealLine.Validate()` requires the name.
        line.ProductName = products[i].Name;
        line.Quantity = quantities[i];
    }

    Assert(
        await deal.Save(),
        `setup: the deal could not be saved — ${deal.LatestResult?.CompleteMessage ?? 'unknown error'}`,
    );

    return {
        DealID: deal.ID,
        CompanyID: target.CompanyID,
        AccountID: f.AccountID,
        WonStatusID: await wonStatusID(ctx),
        ExpectedOrderProductIDs: products.map((p) => p.ID),
        ExpectedOrderQuantities: quantities,
    };
}

/**
 * A saved, open deal with two ONE-TIME lines naming real products, on the DEFAULT pipeline.
 *
 * Both lines are one-time deliberately: the recurring path routes to a contract, which is still
 * stubbed (D-CF4), so a recurring line here would test the half we cannot reach.
 */
export async function SeedDealWithLines(ctx: Ctx, f: SalesFixture): Promise<SeededHandoffDeal> {
    return SeedDealOnPipeline(ctx, f, {
        PipelineID: f.PipelineID,
        StageID: f.StageID,
        CompanyID: f.PipelineCompanyID,
        LineCount: 2,
    });
}
