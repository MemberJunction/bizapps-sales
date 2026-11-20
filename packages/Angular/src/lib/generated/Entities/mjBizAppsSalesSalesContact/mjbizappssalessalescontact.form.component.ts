import { Component } from '@angular/core';
import { mjBizAppsSalesSalesContactEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Sales Contacts') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalessalescontact-form',
    templateUrl: './mjbizappssalessalescontact.form.component.html'
})
export class mjBizAppsSalesSalesContactFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesSalesContactEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'salesEngagement', sectionName: 'Sales & Engagement', isExpanded: true },
            { sectionKey: 'communicationPreferences', sectionName: 'Communication Preferences', isExpanded: true },
            { sectionKey: 'peopleDetails', sectionName: 'People Details', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesDealsBillingContactID', sectionName: 'Deals (Billing Contact)', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesDealsPrimaryContactID', sectionName: 'Deals (Primary Contact)', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesDealContactRoles', sectionName: 'Buying roles', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesSalesAccountsDefaultPrimaryContactID', sectionName: 'Accounts (default primary contact)', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesSalesAccountsDefaultBillingContactID', sectionName: 'Accounts (default billing contact)', isExpanded: false }
        ]);
    }
}

