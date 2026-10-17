/**
 * @fileoverview A won deal's schedule row, saved or deleted on its own, reaches the order
 * (bc-aidp-next-golive#290).
 *
 * The Explorer form's Payment schedule grid saves each row by itself, not through the deal. MJ saves a
 * deal's companion rows through a private graph path that never calls this override, so a deal save
 * carrying the schedule is handled by `DealEntityServer` and this class sees only the single-row path.
 *
 * Once the deal is Won, the row's write and the order's new schedule commit together or not at all:
 * the row is written, the deal's whole schedule is sent to `Orders.ReplacePaymentSchedule`, and a hard
 * refusal (an instalment already invoiced changed or removed, and the others named in
 * `deal-schedule-to-order.ts`) rolls the row back and refuses the save with orders' message. A soft
 * refusal (the rows do not tie yet, or one is still incomplete) keeps the row and says the order still
 * has its previous schedule.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import {
    BaseEntity,
    BaseEntityResult,
    DatabaseProviderBase,
    type EntityDeleteOptions,
    type EntitySaveOptions,
    type IMetadataProvider,
    LogError,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { DealPaymentScheduleEntity } from '@mj-biz-apps/sales-entities';

import { KeptOnDealNote, SendDealScheduleToOrder, WonDealOrderID } from './deal-schedule-to-order.js';

const DEAL_PAYMENT_SCHEDULE_ENTITY = 'MJ_BizApps_Sales: Deal Payment Schedules';

@RegisterClass(BaseEntity, DEAL_PAYMENT_SCHEDULE_ENTITY)
export class DealPaymentScheduleEntityServer extends DealPaymentScheduleEntity {
    public override async Save(options?: EntitySaveOptions): Promise<boolean> {
        // The deal the row was on and the one it is on now: a row moved between deals changes both.
        const before = this.IsSaved ? ((this.GetFieldByName('DealID')?.OldValue as string | null) ?? null) : null;
        const deals = [...new Set([before, this.DealID ?? null].filter((id): id is string => !!id).map((id) => id.toLowerCase()))];
        return this.withOrderSync(deals, 'save', () => super.Save(options));
    }

    public override async Delete(options?: EntityDeleteOptions): Promise<boolean> {
        const dealID = this.DealID ?? null;
        return this.withOrderSync(dealID ? [dealID] : [], 'delete', () => super.Delete(options));
    }

    /**
     * Run the row's write, then send each won deal's schedule to its order, in one transaction.
     * Deals that are not won (or have no order) cost one read each and nothing else.
     */
    private async withOrderSync(dealIDs: string[], type: 'save' | 'delete', write: () => Promise<boolean>): Promise<boolean> {
        const provider = this.ProviderToUse as unknown as IMetadataProvider;
        let won: Array<{ DealID: string; OrderID: string }>;
        try {
            won = await this.wonDeals(dealIDs, provider);
        } catch (err) {
            return this.refuse(type, `This deal's payment schedule could not be checked against its order, so nothing was changed: ${err instanceof Error ? err.message : String(err)}`);
        }
        if (!won.length) return write();

        const scope = await (provider as unknown as DatabaseProviderBase).BeginEntityTransaction();
        try {
            if (!(await write())) {
                await scope.Rollback();
                return false;
            }
            const warnings: string[] = [];
            for (const deal of won) {
                const outcome = await SendDealScheduleToOrder(deal.DealID, deal.OrderID, provider, this.ContextCurrentUser);
                if (outcome.Kind === 'Hard') {
                    await scope.Rollback();
                    return this.refuse(type, `This change was not saved, because the deal is won and its order refused the new schedule: ${outcome.Message}`);
                }
                if (outcome.Kind === 'Soft') warnings.push(KeptOnDealNote(outcome.Message));
            }
            await scope.Commit();
            // Saved, with what did not reach the order said on the result the caller reads.
            if (warnings.length) this.note(type, warnings.join(' '));
            return true;
        } catch (err) {
            try {
                await scope.Rollback();
            } catch (rollbackErr) {
                LogError(`DealPaymentScheduleEntityServer: rollback failed: ${rollbackErr}`);
            }
            return this.refuse(type, `This change was not saved: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    private async wonDeals(dealIDs: string[], provider: IMetadataProvider): Promise<Array<{ DealID: string; OrderID: string }>> {
        const out: Array<{ DealID: string; OrderID: string }> = [];
        for (const dealID of dealIDs) {
            const orderID = await WonDealOrderID(dealID, provider, this.ContextCurrentUser);
            if (orderID) out.push({ DealID: dealID, OrderID: orderID });
        }
        return out;
    }

    /** A successful write that still has something to say: the latest result carries the message. */
    private note(type: 'save' | 'delete', message: string): void {
        const latest = this.LatestResult;
        if (latest?.Success) {
            latest.Message = message;
            return;
        }
        const ok = new BaseEntityResult();
        ok.Success = true;
        ok.Type = type === 'delete' ? 'delete' : 'update';
        ok.Message = message;
        ok.StartedAt = new Date();
        ok.EndedAt = new Date();
        this.RegisterResultHistoryEntry(ok);
    }

    /** Log it, register a failed result, return false — the same contract as the deal's own refusals. */
    private refuse(type: 'save' | 'delete', message: string): false {
        LogError(`DealPaymentScheduleEntityServer.${type} refused: ${message}`);
        const failed = new BaseEntityResult();
        failed.Success = false;
        failed.Type = type === 'delete' ? 'delete' : this.IsSaved ? 'update' : 'create';
        failed.Message = message;
        failed.StartedAt = new Date();
        failed.EndedAt = new Date();
        failed.OriginalValues = this.Fields.map((f) => ({ FieldName: f.CodeName, Value: f.OldValue }));
        this.RegisterResultHistoryEntry(failed);
        return false;
    }
}

/** Anti-tree-shake anchor; see `LoadSalesCoreEntitiesServer`. */
export function LoadDealPaymentScheduleEntityServer(): void {
    void DealPaymentScheduleEntityServer;
}
