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
            { sectionKey: 'accountOwnership', sectionName: 'Account Ownership', isExpanded: true },
            { sectionKey: 'accountClassification', sectionName: 'Account Classification', isExpanded: true },
            { sectionKey: 'accountMetrics', sectionName: 'Account Metrics', isExpanded: true },
            { sectionKey: 'defaultContacts', sectionName: 'Default Contacts', isExpanded: true },
            { sectionKey: 'organizationsDetails', sectionName: 'Organizations Details', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesDeals', sectionName: 'Deals', isExpanded: false }
        ]);
    }
}

