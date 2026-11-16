/**
 * @fileoverview The rows the deal form's Companies panel shows (golive #484). Pure, so the order and
 * the locked flags are testable without a form.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { RequiredDealCompanyIDs } from '@mj-biz-apps/sales-entities';

/** A company the rep can add. */
export interface CompanyOption {
    ID: string;
    Name: string;
}

/** One company on the deal, and why it cannot be removed when it cannot. */
export interface DealCompanyRow {
    CompanyID: string;
    Name: string;
    /** The deal's own company, which issues its order, invoice and contract. */
    IsBilling: boolean;
    /** A product on the deal's order belongs to this company. */
    HasProducts: boolean;
}

/**
 * The billing company first, then each line company, then the other companies the rep listed, each
 * once. A required company shows even before the server has written its row.
 */
export function DealCompanyRows(
    billingCompanyID: string | null,
    lineCompanyIDs: readonly string[],
    listedCompanyIDs: readonly (string | null | undefined)[],
    companies: readonly CompanyOption[],
): DealCompanyRow[] {
    const key = (id: string) => id.trim().toLowerCase();
    const billing = billingCompanyID ? key(billingCompanyID) : null;
    const lines = new Set(lineCompanyIDs.map(key));
    const names = new Map(companies.map((c) => [key(c.ID), c.Name]));
    const ordered = RequiredDealCompanyIDs(billingCompanyID, [...lineCompanyIDs, ...listedCompanyIDs]);
    return ordered.map((id) => ({
        CompanyID: id,
        Name: names.get(key(id)) ?? 'Unknown company',
        IsBilling: key(id) === billing,
        HasProducts: lines.has(key(id)),
    }));
}
