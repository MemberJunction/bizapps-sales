/**
 * @fileoverview Deal form — the close lock.
 *
 * This class adds the one thing a *form* is the right place for: refusing an edit the server will
 * refuse. Lines, products and the roster are edited by the panels contributed onto this form
 * (`form-panels/`).
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
 * ── THE NOTICES ARE THE HEADER'S, NOT THIS CLASS'S ──────────────────────────────────────────────
 *
 * The lock notice and the stale-amount notice are worked out and shown by the deal header
 * (`deal-hero.panel.ts`). This class used to work out both as well, and its template showed neither,
 * so every open and every save of a deal with an order ran a second order-total read for nothing
 * (#386).
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
import { EntitySaveOptions, RunView } from '@memberjunction/core';

import { mjBizAppsSalesDealFormComponent } from '../generated/Entities/mjBizAppsSalesDeal/mjbizappssalesdeal.form.component';
import { MJS_ENTITIES } from '../data/entity-names';
import { ShouldStampCompanyFromPipeline, type PipelineCompanyRow } from './company-from-pipeline';

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
     * Whether the PERSISTED status is a WIN — read as its own flag, never inferred from `!IsLost`.
     *
     * golive#226: the Order and Contract chips belong on a won deal and on no other, because an open
     * deal's order is still a draft nobody should be editing directly. golive#231's outcome tiles read
     * the same flag. Resolved with the lock, from the same status row; the panels read it here rather
     * than asking again.
     */
    public IsWon = false;

    /**
     * The persisted status row no longer exists (#402). The deal is locked, but its status may be set
     * to an open one, which is how the server lets the orphan be repaired; the Status control and
     * `Validate()` read this so the form offers that one write and nothing else.
     */
    public IsStatusMissing = false;

    public override async ngOnInit(): Promise<void> {
        await super.ngOnInit();
        await this.resolveDealState();

        /**
         * RE-RESOLVE AFTER EVERY SAVE AND REFRESH, not only at init.
         *
         * `resolveCloseLock()` used to run once, in `ngOnInit`, and it reads the PERSISTED status
         * (`GetFieldByName('DealStatusTypeID').OldValue`). So a deal CLOSED in this form kept the
         * `IsLocked` it had when the form opened -- false -- for the rest of the session.
         *
         * Measured on a deal closed through the close panel: the hero's Locked chip rendered, and
         * `IsLocked` was still `false`. The chip reads the record; this did not.
         *
         * That is not cosmetic, because `IsLocked` is what the form reasons from:
         *   - `FieldEditable()` returns `!locked || ...`, so a stale `false` makes EVERY field report
         *     editable. The dedicated Pipeline control trusts it and renders an editable picker on a
         *     locked deal -- the "accepts typing, refuses on save" behaviour golive#206 item 3 exists
         *     to delete. Generic fields escaped only because base-forms re-checks the record itself.
         *   - `EditableFieldNames()` returns null instead of the locked carve-outs.
         *   - `ValidateAsync` reads it, and nothing else produces that signal.
         *
         * Subscribing to this component's OWN outputs needs no teardown: the emitters are fields of
         * this instance, so the subscriptions cannot outlive it.
         */
        this.RecordSaved.subscribe(() => { void this.resolveDealState(); });
        this.RecordRefreshed.subscribe(() => { void this.resolveDealState(); });
    }

    /** The lock, then a repaint: the panels read `IsLocked`, `IsLost` and `IsWon` off this instance. */
    private async resolveDealState(): Promise<void> {
        await this.resolveCloseLock();
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
     * in `ResolveDealLockState` so every surface that asks gets the same answer.
     */
    private async resolveCloseLock(): Promise<void> {
        const persisted = this.record?.GetFieldByName('DealStatusTypeID')?.OldValue as string | null | undefined;
        const lock = await ResolveDealLockState(persisted);
        this.IsLocked = lock.IsLocked;
        this.IsLost = lock.IsLost;
        this.IsWon = lock.IsWon;
        this.IsStatusMissing = lock.IsStatusMissing;
    }

    /**
     * Fills the selling company from the pipeline before the save is validated.
     *
     * WHY IT IS HERE AND NOT IN `Validate()`. `SaveRecord` calls `Validate()` and returns early when it
     * fails, so a stamp applied inside validation would be racing the thing it exists to satisfy. This
     * runs before `super.SaveRecord()` — which is what puts it ahead of the validator.
     *
     * `company-from-pipeline.ts` holds the decision and the reasoning, including why the client is
     * allowed to write a server-owned field at all. This method owns only the lookup.
     *
     * A pipeline that cannot be read is NOT an error here. The stamp is best-effort: if it fails, the
     * save proceeds and validation refuses exactly as it did before, which is the behaviour this is
     * replacing rather than something it makes worse. Swallowing a real problem is the risk, so the
     * refusal the user then sees still names `CompanyID`.
     */
    public override async SaveRecord(StopEditModeAfterSave: boolean): Promise<boolean> {
        await this.stampCompanyFromPipeline();
        return super.SaveRecord(StopEditModeAfterSave);
    }

    /**
     * A SAVE OF A CLEAN DEAL STILL REACHES THE SERVER WHEN ITS AMOUNT IS STALE (#399).
     *
     * The header tells the rep to save the deal when its cached amount no longer matches the order
     * (`DEAL_AMOUNT_STALE_NOTICE`). When the order changed somewhere else, the deal's own columns are
     * untouched, so the record is clean and `BaseEntity.Save()` returns without sending anything: the
     * notice stayed and the amount with it. The add-product path met the same wall and answers it the
     * same way, with `IgnoreDirtyState`.
     *
     * Forced only when the amount is actually stale, by the same rule the header uses, so an ordinary
     * clean save stays the no-op it always was. The freshness read runs only here, on a clean save
     * with nothing pending, never on open (#386). A dirty deal needs nothing: its save reaches the
     * entity server, which refreshes the amount from the order on every save of a computed amount.
     */
    protected override async InternalSaveRecord(): Promise<boolean> {
        const record = this.record;
        if (record && !record.Dirty && this.PendingRecords.length === 0 && (await this.amountIsStale())) {
            const options = new EntitySaveOptions();
            options.IgnoreDirtyState = true;
            return record.Save(options);
        }
        return super.InternalSaveRecord();
    }

    /** Whether the saved deal's cached amount disagrees with its order, through the shared rule. */
    private async amountIsStale(): Promise<boolean> {
        const record = this.record;
        if (!record?.IsSaved) {
            return false;
        }
        const freshness = await ResolveDealAmountFreshness({
            IsLocked: this.IsLocked,
            AmountIsComputed: record.Get('AmountIsComputed') as boolean | null | undefined,
            Amount: record.Get('Amount') as number | string | null | undefined,
            OrderID: record.Get('OrderID') as string | null | undefined,
        });
        return freshness.IsStale;
    }

    /** Reads the chosen pipeline's company and writes it to the deal. See `SaveRecord` for why. */
    private async stampCompanyFromPipeline(): Promise<void> {
        const record = this.record;
        const should = ShouldStampCompanyFromPipeline({
            HasRecord: !!record,
            PipelineID: (record?.Get('PipelineID') as string | null | undefined) ?? null,
            CompanyID: (record?.Get('CompanyID') as string | null | undefined) ?? null,
        });
        if (!should || !record) {
            return;
        }

        /**
         * `ResultType: 'simple'` returns plain rows, which is what is wanted: CodeGen generates no
         * `PipelineEntity` subclass, and nothing here mutates the pipeline — only reads one column off it.
         */
        const rv = new RunView();
        const result = await rv.RunView<PipelineCompanyRow>({
            EntityName: MJS_ENTITIES.Pipeline,
            ExtraFilter: `ID='${String(record.Get('PipelineID')).replace(/'/g, "''")}'`,
            ResultType: 'simple',
            Fields: ['CompanyID'],
        });
        // RunView does not throw — a failed read leaves the deal exactly as it was.
        if (!result.Success) {
            return;
        }

        const companyID = result.Results?.[0]?.CompanyID ?? null;
        if (companyID) {
            record.Set('CompanyID', companyID);
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

        const editable = DealFieldsEditableWhileLocked(this.IsLost);
        // The status repair the server allows on a deal whose status row is gone (#402).
        const statusRepair = (name: string): boolean => this.IsStatusMissing && name === 'DealStatusTypeID';
        const frozen = this.record.Fields.filter((f) => f.Dirty && !editable.has(f.Name) && !statusRepair(f.Name));
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
