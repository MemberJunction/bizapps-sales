import { Component } from '@angular/core';
import { mjBizAppsSalesPipelineEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Pipelines') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalespipeline-form',
    templateUrl: './mjbizappssalespipeline.form.component.html'
})
export class mjBizAppsSalesPipelineFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesPipelineEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsSalesDealTypes', sectionName: 'Deal Types', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesForecastSnapshots', sectionName: 'Forecast Snapshots', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesPipelineStages', sectionName: 'Pipeline Stages', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesDeals', sectionName: 'Deals', isExpanded: false }
        ]);
    }
}

