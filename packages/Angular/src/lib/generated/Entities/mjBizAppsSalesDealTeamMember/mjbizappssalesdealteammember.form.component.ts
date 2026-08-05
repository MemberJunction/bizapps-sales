import { Component } from '@angular/core';
import { mjBizAppsSalesDealTeamMemberEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Deal Team Members') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesdealteammember-form',
    templateUrl: './mjbizappssalesdealteammember.form.component.html'
})
export class mjBizAppsSalesDealTeamMemberFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesDealTeamMemberEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

