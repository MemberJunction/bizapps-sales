import { Component } from '@angular/core';
import { mjBizAppsSalesDealLineEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Deal Lines') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesdealline-form',
    templateUrl: './mjbizappssalesdealline.form.component.html'
})
export class mjBizAppsSalesDealLineFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesDealLineEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

