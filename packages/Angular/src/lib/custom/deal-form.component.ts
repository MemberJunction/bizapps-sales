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
 * only COMPARES the cached figure with the order's current total: if they differ, the number on screen
 * no longer describes the order it claims to, and the form says so.
 *
 * That comparison is not pricing. It is the difference between showing a number and vouching for one.
 *
 * It compares the NUMBER, not a timestamp, and `amount-freshness.ts` records why: the timestamp test
 * asked whether a line had been touched, and closing a deal touches every line without moving a price —
 * so every Won deal warned forever about an amount it was simultaneously forbidden to change
 * (golive#230).
 *
 * @module @mj-biz-apps/sales-ng
 */
import { Component } from '@angular/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {
    DealFieldsEditableWhileLocked,
    ResolveDealAmountFreshness,
    ResolveDealLockState,
} from '@mj-biz-apps/sales-entities';
import type { ValidationResult } from '@memberjunction/core';

import { mjBizAppsSalesDealFormComponent } from '../generated/Entities/mjBizAppsSalesDeal/mjbizappssalesdeal.form.component';

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

    /**
     * Whether the locking status is a LOSS — which decides exactly one field.
     *
     * golive#206 keeps Loss Notes editable on a lost deal and frozen on a won one. Resolved once, with
     * the lock, by `ResolveDealLockState`, and handed to the panels; nothing here reads a status name.
     */
    public IsLost = false;

    /**
     * Whether the locking status carries `IsWon` — read as its own flag, never inferred from `!IsLost`.
     * golive#231 labels the Overview's outcome tiles from this; see `DealLockState.IsWon`.
     */
    public IsWon = false;

    /** Shown when locked, so the greyed-out-ness the form cannot render is at least explained. */
    public LockNotice: string | null = null;

    /** Set when `Deal.Amount` no longer matches its order's total. Null when trustworthy, absent or locked. */
    public StaleAmountNotice: string | null = null;

    public override async ngOnInit(): Promise<void> {
        await super.ngOnInit();
        await this.resolveCloseLock();
        await this.resolveAmountFreshness();
        this.cdr?.detectChanges();
    }

    /** The fields a user may still edit right now — everything when open, the carve-outs when locked. */
    public EditableFieldNames(): readonly string[] | null {
        return this.IsLocked ? [...DealFieldsEditableWhileLocked(this.IsLost)] : null;
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
        this.IsLost = lock.IsLost;
        this.IsWon = lock.IsWon;
        this.LockNotice = lock.Notice;
    }

    /**
     * Compares the cached amount against the order it claims to describe. No arithmetic.
     *
     * The rule lives in `ResolveDealAmountFreshness` so this form and the deal hero cannot answer it
     * differently — the same reason `ResolveDealLockState` is shared. Read that file's header for why
     * this is no longer a timestamp comparison (golive#230).
     *
     * ORDER MATTERS: `resolveCloseLock()` runs first in `ngOnInit`, so `IsLocked` is settled before it
     * is passed here. A locked deal never warns.
     */
    private async resolveAmountFreshness(): Promise<void> {
        this.StaleAmountNotice = null;
        if (!this.record?.Get?.('ID')) {
            return;
        }

        const freshness = await ResolveDealAmountFreshness({
            IsLocked: this.IsLocked,
            AmountIsComputed: this.record.Get('AmountIsComputed') as boolean | null | undefined,
            Amount: this.record.Get('Amount') as number | string | null | undefined,
            OrderID: this.record.Get('OrderID') as string | null | undefined,
        });
        this.StaleAmountNotice = freshness.Notice;
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

        const editable = DealFieldsEditableWhileLocked(this.IsLost);
        const frozen = this.record.Fields.filter((f) => f.Dirty && !editable.has(f.Name));
        if (frozen.length === 0) {
            return result;
        }

        result.Success = false;
        for (const field of frozen) {
            result.Errors.push({
                Source: field.Name,
                /**
                 * golive#207 row 17, verbatim: "This deal is closed. Set the status back to Open
                 * before changing this field."
                 *
                 * The old text named `Sales.ReopenDeal` — an API operation — to a person who had just
                 * typed into a form field. It also said "Frozen:" twice over, once as a prefix and
                 * once as the sentence. What a person needs here is the one action that unblocks them,
                 * and since golive#205 that action is genuinely available from this form: the status
                 * control routes to the reopen.
                 */
                Message: 'This deal is closed. Set the status back to Open before changing this field.',
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
