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
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsSalesDealsBillingContactID', sectionName: 'Deals (Billing Contact ID)', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesDealsPrimaryContactID', sectionName: 'Deals (Primary Contact ID)', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesDealContactRoles', sectionName: 'Deal Contact Roles', isExpanded: false }
        ]);
    }
}

