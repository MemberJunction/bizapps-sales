import { Component } from '@angular/core';
import { mjBizAppsSalesBuyingRoleTypeEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Buying Role Types') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesbuyingroletype-form',
    templateUrl: './mjbizappssalesbuyingroletype.form.component.html'
})
export class mjBizAppsSalesBuyingRoleTypeFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesBuyingRoleTypeEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsSalesDealContactRoles', sectionName: 'Deal Contact Roles', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesSalesContacts', sectionName: 'Sales Contacts', isExpanded: false }
        ]);
    }
}

