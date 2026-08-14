import { Component } from '@angular/core';
import { mjBizAppsSalesLifecycleStageTypeEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Lifecycle Stage Types') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssaleslifecyclestagetype-form',
    templateUrl: './mjbizappssaleslifecyclestagetype.form.component.html'
})
export class mjBizAppsSalesLifecycleStageTypeFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesLifecycleStageTypeEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsSalesSalesAccounts', sectionName: 'Sales Accounts', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesSalesContacts', sectionName: 'Sales Contacts', isExpanded: false }
        ]);
    }
}

