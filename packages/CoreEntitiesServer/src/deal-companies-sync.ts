/**
 * @fileoverview Keeps a deal's company list holding its billing company and every line's company
 * (golive #484).
 *
 * `DealCompany` lists the companies a deal involves. The rep picks them on the deal form, but two
 * kinds are not the rep's choice: the deal's own company (`Deal.CompanyID`, the billing company) and
 * the company orders stamps on each of the deal's order lines. A deal selling a product involves that
 * product's company, so the server adds whichever of these is missing rather than refusing the save.
 *
 * Runs inside the deal save's transaction, after the deal and its order lines are written, so it sees
 * this save's lines and a failure rolls the whole save back. It only ever adds rows: removing a
 * company the rep listed is the rep's call.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { type IMetadataProvider, type IRunViewProvider, type UserInfo } from '@memberjunction/core';
import { MissingDealCompanyIDs, RequiredDealCompanyIDs, type mjBizAppsSalesDealCompanyEntity } from '@mj-biz-apps/sales-entities';

export const DEAL_COMPANY_ENTITY = 'MJ_BizApps_Sales: Deal Companies';
const ORDER_LINE_ENTITY = 'MJ_BizApps_Orders: Order Lines';
const GUID_SHAPE = /^[0-9a-fA-F-]{36}$/;

/** What the sync needs to know about the deal being saved. */
export interface DealCompanySubject {
    DealID: string;
    CompanyID: string | null;
    OrderID: string | null;
}

/**
 * Adds the deal's missing required companies, and returns the ids it added.
 *
 * Throws when a read or a write fails, so the caller's transaction rolls back: a deal saved without its
 * billing company in the list would drop out of the filters that read the list.
 */
export async function AddMissingDealCompanies(
    subject: DealCompanySubject,
    provider: IMetadataProvider,
    user: UserInfo | undefined,
): Promise<string[]> {
    requireGuid(subject.DealID, 'deal');
    if (subject.OrderID) requireGuid(subject.OrderID, 'order');

    const { Listed, LineCompanies } = await readCompanies(subject, provider, user);
    const missing = MissingDealCompanyIDs(RequiredDealCompanyIDs(subject.CompanyID, LineCompanies), Listed);
    for (const companyID of missing) {
        await insertDealCompany(subject.DealID, companyID, provider, user);
    }
    return missing;
}

/** The companies already listed for the deal, and the company of each of its order's lines. */
async function readCompanies(
    subject: DealCompanySubject,
    provider: IMetadataProvider,
    user: UserInfo | undefined,
): Promise<{ Listed: string[]; LineCompanies: string[] }> {
    const views = provider as unknown as IRunViewProvider;
    const params = [
        { EntityName: DEAL_COMPANY_ENTITY, ExtraFilter: `DealID = '${subject.DealID}'`, ResultType: 'simple' as const, Fields: ['CompanyID'] },
    ];
    if (subject.OrderID) {
        params.push({
            EntityName: ORDER_LINE_ENTITY,
            ExtraFilter: `OrderHeaderID = '${subject.OrderID}'`,
            ResultType: 'simple' as const,
            Fields: ['CompanyID'],
        });
    }
    const reads = await views.RunViews(params, user);
    if (reads?.length !== params.length) {
        throw new Error("could not read the deal's companies: the reads returned no result");
    }
    for (const read of reads) {
        if (!read?.Success) throw new Error(`could not read the deal's companies: ${read?.ErrorMessage ?? 'no result'}`);
    }
    const ids = (rows: unknown[] | undefined) => (rows as Array<{ CompanyID: string | null }> | undefined ?? []).map((r) => String(r.CompanyID ?? ''));
    return { Listed: ids(reads[0].Results), LineCompanies: reads[1] ? ids(reads[1].Results) : [] };
}

async function insertDealCompany(dealID: string, companyID: string, provider: IMetadataProvider, user: UserInfo | undefined): Promise<void> {
    const row = await provider.GetEntityObject<mjBizAppsSalesDealCompanyEntity>(DEAL_COMPANY_ENTITY, user);
    row.NewRecord();
    row.DealID = dealID;
    row.CompanyID = companyID;
    if (!(await row.Save())) {
        throw new Error(`could not add company ${companyID} to the deal: ${row.LatestResult?.CompleteMessage ?? 'the save was refused'}`);
    }
}

function requireGuid(id: string, what: string): void {
    if (!GUID_SHAPE.test(id)) throw new Error(`the ${what} id "${id}" is not a valid id`);
}
