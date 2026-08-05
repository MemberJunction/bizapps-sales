import { Component } from '@angular/core';
import { mjBizAppsSalesLossReasonEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Loss Reasons') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssaleslossreason-form',
    templateUrl: './mjbizappssaleslossreason.form.component.html'
})
export class mjBizAppsSalesLossReasonFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesLossReasonEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsSalesDeals', sectionName: 'Deals', isExpanded: false }
        ]);
    }
}

