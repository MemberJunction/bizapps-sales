/**
 * @fileoverview Deal form — the close lock, and whether the cached amount can still be trusted.
 *
 * THIS STAYS A FORM. Composing a deal — adding lines, picking products, editing the roster — is the deal
 * workspace's job, and duplicating it here would give us two surfaces that must agree forever. What this
 * adds is the two things a *form* is the right place for: refusing an edit the server will refuse, and
 * saying out loud when a number on screen is stale.
 *
 * ── THE CLOSE LOCK ──────────────────────────────────────────────────────────────────────────────
 *
 * Once a deal reaches a status whose `DealStatusType.LocksDeal` is set, `DealEntityServer.Save()` refuses
 * every field except the carve-outs. The generated form knows none of that, so it presents a fully
 * editable record; the user edits, saves, and hits a wall with no indication which field caused it.
 *
 * The field list comes from `DEAL_FIELDS_EDITABLE_WHILE_LOCKED` in `sales-entities` — the SAME constant
 * the entity server enforces, not a copy. Integration check CD14 pins it to real server behaviour in both
 * directions, so this form cannot quietly start disagreeing with the wall it is protecting the user from.
 *
 * The lock is keyed on the PERSISTED status, matching the server: a deal being closed right now still has
 * an open status in the database, and reading the in-memory value would make a deal impossible to close.
 *
 * ── THE STALE AMOUNT ────────────────────────────────────────────────────────────────────────────
 *
 * `Deal.Amount` is a CACHED ANSWER from Orders, stamped with `AmountIsComputed` / `AmountComputedAt` /
 * `AmountSourceHash`. Sales never recomputes it — this form does not add, multiply or round anything. It
 * only COMPARES timestamps: if a line has been touched since the amount was computed, the amount on
 * screen predates the line set it claims to describe, and the form says so.
 *
 * That comparison is not pricing. It is the difference between showing a number and vouching for one.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { Component } from '@angular/core';
import { RunView } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import { DEAL_FIELDS_EDITABLE_WHILE_LOCKED, ResolveDealLockState } from '@mj-biz-apps/sales-entities';
import type { ValidationResult } from '@memberjunction/core';

import { mjBizAppsSalesDealFormComponent } from '../generated/Entities/mjBizAppsSalesDeal/mjbizappssalesdeal.form.component';

// The lines whose freshness the stale-amount notice checks are ORDER lines now (S-US4), reached
// through the deal's embedded order rather than by DealID -- see the filter below.
const E_ORDER_LINE = 'MJ_BizApps_Orders: Order Lines';

/** See `deal-stage-event-form.component.ts` for why the priority is explicit rather than import-order. */
@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Deals', 2)
@Component({
    standalone: false,
    selector: 'mjs-deal-form',
    templateUrl: '../generated/Entities/mjBizAppsSalesDeal/mjbizappssalesdeal.form.component.html',
})
export class DealFormComponentExtended extends mjBizAppsSalesDealFormComponent {
    /** True when the PERSISTED status locks the deal. Resolved once per load. */
    public IsLocked = false;

    /** Shown when locked, so the greyed-out-ness the form cannot render is at least explained. */
    public LockNotice: string | null = null;

    /** Set when `Deal.Amount` predates its line set. Null when the amount is trustworthy or absent. */
    public StaleAmountNotice: string | null = null;

    public override async ngOnInit(): Promise<void> {
        await super.ngOnInit();
        await this.resolveCloseLock();
        await this.resolveAmountFreshness();
        this.cdr?.detectChanges();
    }

    /** The fields a user may still edit right now — everything when open, the carve-outs when locked. */
    public EditableFieldNames(): readonly string[] | null {
        return this.IsLocked ? [...DEAL_FIELDS_EDITABLE_WHILE_LOCKED] : null;
    }

    /**
     * Resolves the lock through the SHARED rule in `sales-entities`.
     *
     * The lookup itself — read `LocksDeal` off the status row, by flag, off the PERSISTED status — lives
     * in `ResolveDealLockState` so this form and the deal workspace cannot answer it differently.
     */
    private async resolveCloseLock(): Promise<void> {
        const persisted = this.record?.GetFieldByName('DealStatusTypeID')?.OldValue as string | null | undefined;
        const lock = await ResolveDealLockState(persisted);
        this.IsLocked = lock.IsLocked;
        this.LockNotice = lock.Notice;
    }

    /**
     * Compares the amount's stamp against the lines it claims to describe. No arithmetic.
     */
    private async resolveAmountFreshness(): Promise<void> {
        const computedAt = this.record?.Get?.('AmountComputedAt') as string | Date | null | undefined;
        const isComputed = this.record?.Get?.('AmountIsComputed') as boolean | null | undefined;
        if (!isComputed || !computedAt || !this.record?.Get?.('ID')) {
            return;
        }

        // No order means no lines, so nothing can have gone stale.
        const orderID = this.record.Get('OrderID');
        if (!orderID) {
            return;
        }

        const rv = new RunView();
        /**
         * `__mj_UpdatedAt` is typed as `string | Date` because BOTH arrive.
         *
         * MJ v6 hands back real `Date` objects where v5 handed back ISO strings, and this repo has already
         * been caught by that once (`7e55bae`, "dates arrive as Date, not string — the Sales UI assumed
         * string"). Typing it `string` compiles perfectly and would be wrong at runtime the moment the
         * value is used as one. `new Date()` accepts either, so the comparison below is safe on both.
         */
        const result = await rv.RunView<{ __mj_UpdatedAt: string | Date }>({
            EntityName: E_ORDER_LINE,
            // BY OrderHeaderID, NOT DealID. An order line carries no DealID -- the deal reaches its lines
            // through OrderID. Filtering on the deal's own key would have matched nothing and the notice
            // would simply never appear again: a warning that silently stops warning.
            ExtraFilter: `OrderHeaderID = '${String(orderID).replace(/'/g, "''")}'`,
            OrderBy: '__mj_UpdatedAt DESC',
            ResultType: 'simple',
            Fields: ['__mj_UpdatedAt'],
        });
        const newest = result?.Success ? (result.Results ?? [])[0]?.__mj_UpdatedAt : undefined;
        if (!newest) {
            return;
        }

        if (new Date(newest).getTime() > new Date(computedAt).getTime()) {
            this.StaleAmountNotice =
                'A line has changed since this amount was priced, so the total shown is out of date. ' +
                'Reprice the deal to get a current figure from Orders — Sales does not recalculate it here.';
        }
    }

    /**
     * Refuses a locked edit BEFORE the round trip, naming the fields.
     *
     * The server would refuse anyway; the value here is that the user finds out while looking at the
     * field rather than after a save that reports a wall.
     */
    public override Validate(): ValidationResult {
        const result = super.Validate();
        if (!this.IsLocked || !this.record) {
            return result;
        }

        const frozen = this.record.Fields.filter(
            (f) => f.Dirty && !DEAL_FIELDS_EDITABLE_WHILE_LOCKED.has(f.Name),
        );
        if (frozen.length === 0) {
            return result;
        }

        result.Success = false;
        for (const field of frozen) {
            result.Errors.push({
                Source: field.Name,
                Message:
                    'Frozen: this deal is closed and locked. Reopen it through Sales.ReopenDeal, which ' +
                    'records a reason, if this genuinely needs to change.',
                Value: field.Value,
                Type: 'Failure',
            });
        }
        return result;
    }
}

/** Anti-tree-shaking anchor. */
export function LoadDealForm(): void {
    /* keeps the registration alive */
}
