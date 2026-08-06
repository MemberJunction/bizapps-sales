import { Component } from '@angular/core';
import { mjBizAppsSalesLeadSourceTypeEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Lead Source Types') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesleadsourcetype-form',
    templateUrl: './mjbizappssalesleadsourcetype.form.component.html'
})
export class mjBizAppsSalesLeadSourceTypeFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesLeadSourceTypeEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsSalesSalesContacts', sectionName: 'Sales Contacts', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesDeals', sectionName: 'Deals', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesSalesAccounts', sectionName: 'Sales Accounts', isExpanded: false }
        ]);
    }
}

