import { Component } from '@angular/core';
import { mjBizAppsSalesSalesAccountEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Sales Accounts') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalessalesaccount-form',
    templateUrl: './mjbizappssalessalesaccount.form.component.html'
})
export class mjBizAppsSalesSalesAccountFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesSalesAccountEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsSalesDeals', sectionName: 'Deals', isExpanded: false }
        ]);
    }
}

