/**
 * @fileoverview Deal Stage Event form — provenance is read, never written. "Pen, not pencil."
 *
 * `DealStageEvent` is APPEND-ONLY (the third rule this app upholds). Each row stamps
 * `AmountAtTransition` and `ProbabilityAtTransition` at the moment of a transition, and those stamps are
 * the only reason "what did we think the forecast was on the 1st" is answerable once amounts have moved.
 * Editing one does not correct history; it destroys the record that made history checkable.
 *
 * Unlike the Deal Line form, this one CAN be expressed exactly: the whole record is read-only, and
 * `BaseFormComponent.EditMode` is a whole-form switch. So this form simply refuses to enter edit mode
 * and says why, rather than offering an Edit button that leads to a wall.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { Component } from '@angular/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

import { mjBizAppsSalesDealStageEventFormComponent } from '../generated/Entities/mjBizAppsSalesDealStageEvent/mjbizappssalesdealstageevent.form.component';

/** See `deal-line-form.component.ts` for why the priority is explicit rather than import-order. */
@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Deal Stage Events', 2)
@Component({
    standalone: false,
    selector: 'mjs-deal-stage-event-form',
    templateUrl:
        '../generated/Entities/mjBizAppsSalesDealStageEvent/mjbizappssalesdealstageevent.form.component.html',
})
export class DealStageEventFormComponentExtended extends mjBizAppsSalesDealStageEventFormComponent {
    /** Shown instead of silently doing nothing, so a refused Edit click explains itself. */
    public ReadOnlyNotice: string | null = null;

    /**
     * Refuses edit mode outright.
     *
     * Overriding this rather than hiding the Edit button in a forked template: the button lives in
     * generated chrome, a fork would drift from CodeGen, and hiding a control is a weaker guarantee than
     * refusing the transition it triggers — a keyboard shortcut or a programmatic caller still lands here.
     */
    public override StartEditMode(): void {
        this.ReadOnlyNotice =
            'Stage events are append-only. This row records what the deal looked like at a transition, ' +
            'and editing it would rewrite the history the forecast is checked against. To change the ' +
            'deal, change the deal — a new event will be recorded.';
        this.cdr?.detectChanges();
    }
}

/** Anti-tree-shaking anchor. */
export function LoadDealStageEventForm(): void {
    /* keeps the registration alive */
}
