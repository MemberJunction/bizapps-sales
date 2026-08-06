import { Component } from '@angular/core';
import { mjBizAppsSalesForecastCategoryTypeEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Forecast Category Types') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesforecastcategorytype-form',
    templateUrl: './mjbizappssalesforecastcategorytype.form.component.html'
})
export class mjBizAppsSalesForecastCategoryTypeFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesForecastCategoryTypeEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsSalesDeals', sectionName: 'Deals', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesPipelines', sectionName: 'Pipelines', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesPipelineStages', sectionName: 'Pipeline Stages', isExpanded: false }
        ]);
    }
}

