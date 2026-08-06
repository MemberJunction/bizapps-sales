import { Component } from '@angular/core';
import { mjBizAppsSalesAutomationRuleEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Automation Rules') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesautomationrule-form',
    templateUrl: './mjbizappssalesautomationrule.form.component.html'
})
export class mjBizAppsSalesAutomationRuleFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesAutomationRuleEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsSalesAutomationRuleActions', sectionName: 'Automation Rule Actions', isExpanded: false }
        ]);
    }
}

