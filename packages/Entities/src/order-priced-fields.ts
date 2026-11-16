/**
 * @fileoverview Which deal money fields come from the order, and when they may be typed (golive #485).
 *
 * `Amount`, `MRR` and `ARR` are copies of figures orders computes on the deal's order:
 * `OrderHeader.TotalGross`, `RecurringMonthlyTotal` and `RecurringAnnualTotal`
 * (`DealEntityServer.refreshAmountFromOrder`). Once the deal has products, the copy is the value, so a
 * typed figure would only be overwritten by the next save. Without products there is nothing to copy
 * and a person types them.
 *
 * "Has products" is the deal's PERSISTED `AmountIsComputed`: the refresh stamps it when it copies an
 * order total, which happens once the order has a line. Reading the persisted value (not the in-memory
 * one) keeps the rule the same for the form, which holds the loaded row, and for the entity server,
 * which reads `OldValue`. It also lets a deal whose amount was typed take its first products in the
 * same save: the refresh replaces the typed figure afterwards.
 *
 * One rule, read by the deal form's `FieldEditable` and by `DealEntityServer.Save()`, so the form never
 * offers a field the save refuses.
 *
 * @module @mj-biz-apps/sales-entities
 */

/** The deal fields copied from the order once the deal has products. */
export const DEAL_ORDER_PRICED_FIELDS: readonly string[] = ['Amount', 'MRR', 'ARR'];

/** Whether `fieldName` is one of {@link DEAL_ORDER_PRICED_FIELDS}. */
export function IsDealOrderPricedField(fieldName: string): boolean {
    return DEAL_ORDER_PRICED_FIELDS.includes(fieldName);
}

/**
 * Whether the deal's money fields come from its order, given the persisted `AmountIsComputed`.
 *
 * @param persistedAmountIsComputed the value on the saved row: `OldValue` on the server, the loaded
 *   value on the form. Null or undefined (a new deal) means no.
 */
export function DealMoneyComesFromOrder(persistedAmountIsComputed: boolean | null | undefined): boolean {
    return persistedAmountIsComputed === true;
}

/**
 * The refusal for a save that types an order-priced field on a deal with products, or null when the
 * save is allowed.
 *
 * @param persistedAmountIsComputed see {@link DealMoneyComesFromOrder}
 * @param dirtyFields the fields this save changes
 * @param label the display label for a field name
 */
export function DealOrderPricedEditRefusal(
    persistedAmountIsComputed: boolean | null | undefined,
    dirtyFields: readonly string[],
    label: (fieldName: string) => string = (name) => name,
): string | null {
    if (!DealMoneyComesFromOrder(persistedAmountIsComputed)) {
        return null;
    }
    const typed = DEAL_ORDER_PRICED_FIELDS.filter((name) => dirtyFields.includes(name));
    if (typed.length === 0) {
        return null;
    }
    return (
        `${typed.map(label).join(', ')} cannot be typed on a deal with products: they come from the ` +
        "deal's order and update when the products change. Change the products instead. Nothing was changed."
    );
}
