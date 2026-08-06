import { Component } from '@angular/core';
import { mjBizAppsSalesDealPaymentScheduleEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Deal Payment Schedules') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesdealpaymentschedule-form',
    templateUrl: './mjbizappssalesdealpaymentschedule.form.component.html'
})
export class mjBizAppsSalesDealPaymentScheduleFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesDealPaymentScheduleEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

