import { Component } from '@angular/core';
import { mjBizAppsSalesDealStatusTypeEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Deal Status Types') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesdealstatustype-form',
    templateUrl: './mjbizappssalesdealstatustype.form.component.html'
})
export class mjBizAppsSalesDealStatusTypeFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesDealStatusTypeEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsSalesPipelineStages', sectionName: 'Pipeline Stages', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesDealStageEventsFromDealStatusTypeID', sectionName: 'Deal Stage Events (From Deal Status Type ID)', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesDealStageEventsToDealStatusTypeID', sectionName: 'Deal Stage Events (To Deal Status Type ID)', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesDeals', sectionName: 'Deals', isExpanded: false }
        ]);
    }
}

