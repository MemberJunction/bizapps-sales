import { Component } from '@angular/core';
import { mjBizAppsSalesPipelineStageEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Pipeline Stages') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalespipelinestage-form',
    templateUrl: './mjbizappssalespipelinestage.form.component.html'
})
export class mjBizAppsSalesPipelineStageFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesPipelineStageEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsSalesDealStageEventsFromStageID', sectionName: 'Deal Stage Events (From Stage ID)', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesDealStageEventsToStageID', sectionName: 'Deal Stage Events (To Stage ID)', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesDeals', sectionName: 'Deals', isExpanded: false }
        ]);
    }
}

