import { Component } from '@angular/core';
import { mjBizAppsSalesDealStageEventEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Deal Stage Events') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesdealstageevent-form',
    templateUrl: './mjbizappssalesdealstageevent.form.component.html'
})
export class mjBizAppsSalesDealStageEventFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesDealStageEventEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

