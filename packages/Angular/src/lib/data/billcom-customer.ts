/**
 * @fileoverview Whether a deal's account already has a Bill.com customer under the selling company.
 *
 * Orders keeps the link in `External Customers`: one row per bill-to organization per payment
 * provider row, and a Bill.com provider row belongs to one selling company. When an order is
 * invoiced through Bill.com and its organization has no row, Orders creates a new Bill.com customer
 * and records it. It never searches Bill.com for one that already exists, so an account that is
 * already a customer there but has no row gets a duplicate on its first invoice.
 *
 * The deal form reads this when a rep picks an account so the gap is found while the deal is open,
 * not when the invoice is sent. A company with no active Bill.com provider row invoices natively and
 * has nothing to warn about.
 *
 * A Sales Account shares its ID with its Organization, so the account ID is the bill-to
 * organization ID.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { RunView } from '@memberjunction/core';
import { MJS_ENTITIES, MJS_FOREIGN_ENTITIES } from './entity-names';

/** Orders' provider type code for Bill.com; the same key Orders registers its invoice rail under. */
export const BILLCOM_PROVIDER_TYPE_CODE = 'BillCom';

export type BillComCustomerCheck =
    /** The company does not invoice through Bill.com, or the deal has no account or company yet. */
    | { Kind: 'NotApplicable' }
    | { Kind: 'Linked' }
    | { Kind: 'Missing'; CompanyName: string | null };

export interface BillComProviderRow {
    ID: string;
    PaymentProviderTypeID: string;
    Company: string | null;
}

/**
 * The decision, kept apart from the reads so it can be tested without a database.
 *
 * `providers` are the company's active provider rows; `billComTypeIDs` the Bill.com type rows;
 * `linkedProviderIDs` the provider rows the account already has an External Customer under.
 */
export function DecideBillComCustomer(
    providers: readonly BillComProviderRow[],
    billComTypeIDs: readonly string[],
    linkedProviderIDs: readonly string[],
): BillComCustomerCheck {
    const typeIDs = new Set(billComTypeIDs.map(lower));
    const billCom = providers.filter((p) => typeIDs.has(lower(p.PaymentProviderTypeID)));
    if (!billCom.length) return { Kind: 'NotApplicable' };
    const linked = new Set(linkedProviderIDs.map(lower));
    if (billCom.some((p) => linked.has(lower(p.ID)))) return { Kind: 'Linked' };
    return { Kind: 'Missing', CompanyName: billCom[0].Company ?? null };
}

/** The line shown under the account. */
export function BillComCustomerWarning(check: BillComCustomerCheck): string | null {
    if (check.Kind !== 'Missing') return null;
    const company = check.CompanyName ? ` under ${check.CompanyName}` : '';
    return (
        `This account has no Bill.com customer ID${company}. Its first Bill.com invoice will create a new ` +
        `Bill.com customer. If it is already a customer in Bill.com, add its ID in External Customers ` +
        `before the deal is invoiced, or Bill.com will hold a duplicate.`
    );
}

/**
 * Reads the company's Bill.com provider rows and the account's External Customer rows under them.
 *
 * `companyID` is the deal's; a new deal has none until it is saved, so the pipeline's is read
 * instead, the same source the server stamps the deal's company from. Throws when a read fails.
 */
export async function CheckBillComCustomer(
    accountID: string | null,
    companyID: string | null,
    pipelineID: string | null,
): Promise<BillComCustomerCheck> {
    if (!isSet(accountID)) return { Kind: 'NotApplicable' };
    const company = isSet(companyID) ? companyID : await pipelineCompany(pipelineID);
    if (!company) return { Kind: 'NotApplicable' };

    const rv = new RunView();
    const [types, providers] = await rv.RunViews([
        {
            EntityName: MJS_FOREIGN_ENTITIES.PaymentProviderType,
            ExtraFilter: `Code = '${BILLCOM_PROVIDER_TYPE_CODE}'`,
            Fields: ['ID'],
            ResultType: 'simple',
        },
        {
            EntityName: MJS_FOREIGN_ENTITIES.PaymentProvider,
            ExtraFilter: `CompanyID = '${guid(company)}' AND IsActive = 1`,
            Fields: ['ID', 'PaymentProviderTypeID', 'Company'],
            ResultType: 'simple',
        },
    ]);
    if (!types.Success) throw new Error(types.ErrorMessage || 'Payment provider types could not be read.');
    if (!providers.Success) throw new Error(providers.ErrorMessage || 'Payment providers could not be read.');

    const typeIDs = (types.Results as Array<{ ID: string }>).map((t) => t.ID);
    const providerRows = providers.Results as BillComProviderRow[];
    const first = DecideBillComCustomer(providerRows, typeIDs, []);
    if (first.Kind === 'NotApplicable') return first;

    const typeSet = new Set(typeIDs.map(lower));
    const billComIDs = providerRows.filter((p) => typeSet.has(lower(p.PaymentProviderTypeID))).map((p) => `'${guid(p.ID)}'`);
    const customers = await rv.RunView<{ PaymentProviderID: string }>({
        EntityName: MJS_FOREIGN_ENTITIES.ExternalCustomer,
        ExtraFilter: `BillToOrganizationID = '${guid(accountID)}' AND PaymentProviderID IN (${billComIDs.join(',')})`,
        Fields: ['PaymentProviderID'],
        ResultType: 'simple',
    });
    if (!customers.Success) throw new Error(customers.ErrorMessage || 'External customers could not be read.');
    return DecideBillComCustomer(providerRows, typeIDs, customers.Results.map((c) => c.PaymentProviderID));
}

async function pipelineCompany(pipelineID: string | null): Promise<string | null> {
    if (!isSet(pipelineID)) return null;
    const result = await new RunView().RunView<{ CompanyID: string | null }>({
        EntityName: MJS_ENTITIES.Pipeline,
        ExtraFilter: `ID = '${guid(pipelineID)}'`,
        Fields: ['CompanyID'],
        ResultType: 'simple',
    });
    if (!result.Success) throw new Error(result.ErrorMessage || 'The pipeline could not be read.');
    return result.Results[0]?.CompanyID ?? null;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Refuses anything that is not a GUID before it reaches a filter string. */
function guid(value: string): string {
    if (!GUID.test(value.trim())) throw new Error(`Not an ID: ${value}`);
    return value.trim();
}

function isSet(value: string | null | undefined): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function lower(value: string): string {
    return value.toLowerCase();
}
