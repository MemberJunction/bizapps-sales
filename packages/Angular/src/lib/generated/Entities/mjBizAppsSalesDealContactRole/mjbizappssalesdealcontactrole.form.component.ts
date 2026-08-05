import { Component } from '@angular/core';
import { mjBizAppsSalesDealContactRoleEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Deal Contact Roles') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesdealcontactrole-form',
    templateUrl: './mjbizappssalesdealcontactrole.form.component.html'
})
export class mjBizAppsSalesDealContactRoleFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesDealContactRoleEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

