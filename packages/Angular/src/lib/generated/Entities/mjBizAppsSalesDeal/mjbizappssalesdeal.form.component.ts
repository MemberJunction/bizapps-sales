import { Component } from '@angular/core';
import { mjBizAppsSalesDealEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Deals') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesdeal-form',
    templateUrl: './mjbizappssalesdeal.form.component.html'
})
export class mjBizAppsSalesDealFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesDealEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsSalesDealContactRoles', sectionName: 'Deal Contact Roles', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesDealStageEvents', sectionName: 'Deal Stage Events', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesDealTeamMembers', sectionName: 'Deal Team Members', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesDealPaymentSchedules', sectionName: 'Deal Payment Schedules', isExpanded: false }
        ]);
    }
}

