import { Component } from '@angular/core';
import { mjBizAppsSalesAutomationRuleTriggerTypeEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Automation Rule Trigger Types') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesautomationruletriggertype-form',
    templateUrl: './mjbizappssalesautomationruletriggertype.form.component.html'
})
export class mjBizAppsSalesAutomationRuleTriggerTypeFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesAutomationRuleTriggerTypeEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsSalesAutomationRules', sectionName: 'Automation Rules', isExpanded: false }
        ]);
    }
}

