/**
 * @fileoverview The deal's payment schedule reaches its order (bc-aidp-next-golive#290).
 *
 * A rep authors instalments on the deal; invoices come from the order. Nothing moved the deal's rows
 * onto the order, so the order booked and invoiced its whole value at once while the deal showed four
 * instalments. This module sends the deal's whole schedule to orders' `Orders.ReplacePaymentSchedule`
 * and reports what orders said.
 *
 * ── WHEN IT RUNS ────────────────────────────────────────────────────────────────────────────────
 *
 * At Close Won (`Sales.CloseDeal`), and on every later change to a won deal's schedule: a deal save
 * that carries the schedule (`DealEntityServer`) and a single row saved or deleted on its own
 * (`DealPaymentScheduleEntityServer`, the Explorer grid's path). Before Won the rows stay on the deal;
 * the order's lines are still moving and nothing bills from a quote.
 *
 * ── WHY ORDERS WRITES THE ROWS ──────────────────────────────────────────────────────────────────
 *
 * Orders owns the schedule table, numbers the instalments, keeps the rows already invoiced, and checks
 * the tie against its own lines. Sales sends the list and does no arithmetic on it (rule 1): nothing
 * here adds, splits or rounds an amount.
 *
 * ── WHAT A REFUSAL MEANS FOR THE DEAL ────────────────────────────────────────────────────────────
 *
 * `Soft` refusals leave the deal's change standing and the order's schedule as it was: the rows do not
 * add up to the order yet (`TIE_FAILED`), or a row still has no date or amount (`INVALID_ROW`). A rep
 * editing one row at a time passes through both states, and refusing them would make a multi-row
 * change impossible in the grid. The next edit sends the whole list again, so the order catches up as
 * soon as the deal's rows tie. Every other refusal (an instalment already invoiced changed or removed,
 * a voided order, an order billed in full without a schedule) is `Hard`: the caller rolls the deal's
 * change back and shows orders' message, because the deal would otherwise say something the order can
 * never match.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { type IMetadataProvider, type IRunViewProvider, type UserInfo } from '@memberjunction/core';
import { ToCalendarDay } from '@mj-biz-apps/common-entities';
import {
    OrdersReplacePaymentScheduleOperation,
    type OrdersReplacePaymentScheduleOutput,
    type ReplacePaymentScheduleRow,
} from '@mj-biz-apps/orders-entities';

import { OrdersIsInstalled } from './orders-availability.js';

const DEAL_ENTITY = 'MJ_BizApps_Sales: Deals';
const DEAL_STATUS_ENTITY = 'MJ_BizApps_Sales: Deal Status Types';
const DEAL_PAYMENT_SCHEDULE_ENTITY = 'MJ_BizApps_Sales: Deal Payment Schedules';
const ORDER_LINE_ENTITY = 'MJ_BizApps_Orders: Order Lines';

/** Orders' refusals that leave the deal's change standing. See the module comment. */
const SOFT_REFUSALS = new Set(['TIE_FAILED', 'INVALID_ROW']);

/** What sending the schedule came to. */
export type DealScheduleSyncOutcome =
    | { Kind: 'Skipped'; Note?: string }
    | { Kind: 'Synced'; Changed: boolean }
    | { Kind: 'Soft'; Message: string }
    | { Kind: 'Hard'; Message: string };

/** One deal schedule row as read for the copy. Both columns are nullable on the deal. */
interface DealScheduleRowFacts {
    PaymentDate: string | Date | null;
    Amount: number | null;
    Description: string | null;
}

/**
 * Send the deal's current schedule, as stored, to its order.
 *
 * Reads the rows itself, so call it AFTER the deal-side write it follows, inside the same transaction.
 * `Skipped` when there is no order or orders is not installed.
 *
 * `skipWhenEmpty`: at Close Won a deal with no rows leaves the order's own schedule alone, since the
 * deal never authored one. After Won, removing the last row is a real change and is sent.
 */
export async function SendDealScheduleToOrder(
    dealID: string,
    orderID: string | null | undefined,
    provider: IMetadataProvider,
    user: UserInfo,
    skipWhenEmpty = false,
): Promise<DealScheduleSyncOutcome> {
    if (!orderID || !OrdersIsInstalled()) return { Kind: 'Skipped' };

    const read = await (provider as unknown as IRunViewProvider).RunView<DealScheduleRowFacts>(
        {
            EntityName: DEAL_PAYMENT_SCHEDULE_ENTITY,
            ExtraFilter: `DealID = '${dealID}'`,
            OrderBy: 'PaymentDate ASC, DisplayOrder ASC',
            Fields: ['PaymentDate', 'Amount', 'Description'],
            ResultType: 'simple',
            BypassCache: true,
        },
        user,
    );
    if (!read.Success) {
        return { Kind: 'Hard', Message: `The deal's payment schedule could not be read to send to its order: ${read.ErrorMessage ?? 'unknown error'}` };
    }
    const rows = read.Results ?? [];
    if (skipWhenEmpty && rows.length === 0) return { Kind: 'Skipped' };

    /**
     * A HEADER-ONLY DEAL'S ORDER HAS NO LINES, so there is nothing for an instalment to bill and orders
     * would refuse any schedule as not tying. The rows stay on the deal; a won deal's lines are frozen,
     * so this does not change later.
     */
    const lines = await (provider as unknown as IRunViewProvider).RunView<{ ID: string }>(
        { EntityName: ORDER_LINE_ENTITY, ExtraFilter: `OrderHeaderID = '${orderID}'`, Fields: ['ID'], MaxRows: 1, ResultType: 'simple', BypassCache: true },
        user,
    );
    if (!lines.Success) {
        return { Kind: 'Hard', Message: `The order's lines could not be read to send it the payment schedule: ${lines.ErrorMessage ?? 'unknown error'}` };
    }
    if (!(lines.Results ?? []).length) {
        return rows.length
            ? { Kind: 'Skipped', Note: "The deal's order has no lines, so its payment schedule stays on the deal: there is nothing on the order for an instalment to bill." }
            : { Kind: 'Skipped' };
    }

    const envelope = await new OrdersReplacePaymentScheduleOperation().Execute(
        { OrderHeaderID: orderID, Rows: rows.map(ToOrderRow) },
        { provider, user },
    );
    return ReadOutcome(envelope.Success ? (envelope.Output ?? null) : null, envelope.ErrorMessage);
}

/**
 * A deal row as orders takes it. The date is read as the calendar day it names (UTC parts, never
 * local). A row with no date or amount is sent as it is so that orders refuses it by name.
 */
export function ToOrderRow(row: DealScheduleRowFacts): ReplacePaymentScheduleRow {
    return {
        DueDate: row.PaymentDate ? (ToCalendarDay(row.PaymentDate) ?? '') : '',
        Amount: row.Amount === null || row.Amount === undefined ? Number.NaN : Number(row.Amount),
        Description: row.Description ?? null,
    };
}

/**
 * TWO LAYERS OF SUCCESS: the envelope says the operation ran, `Output.Success` says orders accepted
 * the schedule. Reading only the outer one would report a schedule that was never written.
 */
export function ReadOutcome(output: OrdersReplacePaymentScheduleOutput | null, envelopeError?: string): DealScheduleSyncOutcome {
    if (!output) {
        return { Kind: 'Hard', Message: `The deal's payment schedule could not be sent to its order: ${envelopeError ?? 'the operation did not run'}` };
    }
    if (output.Success) return { Kind: 'Synced', Changed: output.Changed };
    const message = output.Message ?? 'orders refused the payment schedule.';
    return { Kind: output.Code && SOFT_REFUSALS.has(output.Code) ? 'Soft' : 'Hard', Message: message };
}

/** What a rep reads when a soft refusal let the deal's change stand. */
export function KeptOnDealNote(ordersMessage: string): string {
    return (
        `The deal's payment schedule was saved, but its order still has the previous schedule: ${ordersMessage} ` +
        `The order is updated as soon as the deal's rows are complete and tie.`
    );
}

/**
 * Whether a change to this deal's schedule should reach its order: the deal is Won (by the status ROW's
 * flag, never its name) and has an order. Returns the order's ID, or null.
 *
 * THROWS when a read fails. Answering null would let a won deal's change through without reaching the
 * order, which is the defect this module exists to end; the caller refuses the change instead.
 */
export async function WonDealOrderID(dealID: string, provider: IMetadataProvider, user: UserInfo): Promise<string | null> {
    if (!OrdersIsInstalled()) return null;
    const view = provider as unknown as IRunViewProvider;
    const deal = await view.RunView<{ OrderID: string | null; DealStatusTypeID: string | null }>(
        { EntityName: DEAL_ENTITY, ExtraFilter: `ID = '${dealID}'`, Fields: ['OrderID', 'DealStatusTypeID'], ResultType: 'simple', BypassCache: true },
        user,
    );
    if (!deal.Success) throw new Error(`the deal could not be read: ${deal.ErrorMessage ?? 'unknown error'}`);
    const row = deal.Results?.[0];
    if (!row?.OrderID || !row.DealStatusTypeID) return null;
    return (await StatusIsWon(row.DealStatusTypeID, provider, user)) ? row.OrderID : null;
}

/** The status row's `IsWon` flag. A missing row answers false; a failed read throws. */
export async function StatusIsWon(statusID: string, provider: IMetadataProvider, user: UserInfo): Promise<boolean> {
    const status = await (provider as unknown as IRunViewProvider).RunView<{ IsWon: boolean }>(
        { EntityName: DEAL_STATUS_ENTITY, ExtraFilter: `ID = '${statusID}'`, Fields: ['IsWon'], ResultType: 'simple' },
        user,
    );
    if (!status.Success) throw new Error(`the deal's status could not be read: ${status.ErrorMessage ?? 'unknown error'}`);
    return status.Results?.[0]?.IsWon === true;
}
