/**
 * What the deal-line editor sends when a line's discount went up. NO `import` statements in this file:
 * CodeGen emits it verbatim into `remote_operations.ts` and resolves none (see
 * `sales-close-deal.input.ts`).
 */
export interface SalesRecordDiscountConcessionInput {
    /** The saved order line the discount is on. Orders values the concession from what it stores. */
    OrderLineID: string;
    /**
     * One of orders' concession reason categories. Typed as a string because orders owns the list
     * (its `CK_OrderConcession_ReasonCategory`), so a category it adds needs no sales release.
     */
    ReasonCategory: string;
    /** The rep's reason. Required: an approver decides on it. */
    Reason: string;
}
