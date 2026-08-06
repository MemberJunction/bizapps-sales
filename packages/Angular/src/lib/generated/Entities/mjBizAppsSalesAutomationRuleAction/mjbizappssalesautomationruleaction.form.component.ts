import { Component } from '@angular/core';
import { mjBizAppsSalesAutomationRuleActionEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Automation Rule Actions') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesautomationruleaction-form',
    templateUrl: './mjbizappssalesautomationruleaction.form.component.html'
})
export class mjBizAppsSalesAutomationRuleActionFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesAutomationRuleActionEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

