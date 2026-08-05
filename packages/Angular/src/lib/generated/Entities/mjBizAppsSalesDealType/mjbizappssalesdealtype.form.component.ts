import { Component } from '@angular/core';
import { mjBizAppsSalesDealTypeEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Deal Types') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesdealtype-form',
    templateUrl: './mjbizappssalesdealtype.form.component.html'
})
export class mjBizAppsSalesDealTypeFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesDealTypeEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsSalesDeals', sectionName: 'Deals', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesPipelines', sectionName: 'Pipelines', isExpanded: false }
        ]);
    }
}

