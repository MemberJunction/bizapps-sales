import { Component } from '@angular/core';
import { mjBizAppsSalesDealRoleEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Deal Roles') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesdealrole-form',
    templateUrl: './mjbizappssalesdealrole.form.component.html'
})
export class mjBizAppsSalesDealRoleFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesDealRoleEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsSalesDealTeamMembers', sectionName: 'Deal Team Members', isExpanded: false }
        ]);
    }
}

