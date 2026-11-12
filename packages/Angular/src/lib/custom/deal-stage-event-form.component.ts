/**
 * @fileoverview Deal Stage Event form — provenance is read, never written. "Pen, not pencil."
 *
 * `DealStageEvent` is APPEND-ONLY (the third rule this app upholds). Each row stamps
 * `AmountAtTransition` and `ProbabilityAtTransition` at the moment of a transition, and those stamps are
 * the only reason "what did we think the forecast was on the 1st" is answerable once amounts have moved.
 * Editing one does not correct history; it destroys the record that made history checkable.
 *
 * Unlike the Deal Line form, this one CAN be expressed exactly: the whole record is read-only, and
 * `BaseFormComponent.EditMode` is a whole-form switch. So this form offers no Edit button and refuses
 * to enter edit mode, and `MJSDealStageEventNoticePanel` says why on the record itself.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { Component } from '@angular/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

import { STAGE_EVENT_APPEND_ONLY_NOTICE } from '../form-panels/deal-stage-event-notice.panel';

import { mjBizAppsSalesDealStageEventFormComponent } from '../generated/Entities/mjBizAppsSalesDealStageEvent/mjbizappssalesdealstageevent.form.component';

/**
 * The registration priority is EXPLICIT rather than left to import order.
 *
 * `@RegisterClass` resolves last-registration-wins, so two subclasses for one entity would be decided by
 * whichever module the bundler happened to import second -- stable in dev and not necessarily in a
 * different build. Stating the priority makes the winner a decision instead of an accident.
 */
@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Deal Stage Events', 2)
@Component({
    standalone: false,
    selector: 'mjs-deal-stage-event-form',
    templateUrl:
        '../generated/Entities/mjBizAppsSalesDealStageEvent/mjbizappssalesdealstageevent.form.component.html',
})
export class DealStageEventFormComponentExtended extends mjBizAppsSalesDealStageEventFormComponent {
    /**
     * The append-only explanation. Rendered by `MJSDealStageEventNoticePanel` in the `before-fields`
     * slot; kept here so a caller holding the form can read the same sentence.
     */
    public get ReadOnlyNotice(): string {
        return STAGE_EVENT_APPEND_ONLY_NOTICE;
    }

    /**
     * No Edit button. The toolbar shows Edit when `ShowEditButton && UserCanEdit`, and the base getter
     * answers from the entity's Update permission, which a user can hold on an append-only table. The
     * button then led to a refusal that rendered nothing (bizapps-sales#284).
     */
    public override get UserCanEdit(): boolean {
        return false;
    }

    /**
     * Refuses edit mode outright, for callers that do not go through the toolbar.
     *
     * Overriding this rather than only hiding the button: hiding a control is a weaker guarantee than
     * refusing the transition it triggers — a keyboard shortcut or a programmatic caller still lands
     * here. Nothing to show on refusal: the notice panel is already on the record.
     */
    public override StartEditMode(): void {
        /* append-only: never enters edit mode */
    }
}

/** Anti-tree-shaking anchor. */
export function LoadDealStageEventForm(): void {
    /* keeps the registration alive */
}
