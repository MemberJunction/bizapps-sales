import { Component } from '@angular/core';
import { mjBizAppsSalesAutomationRuleActionTypeEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Automation Rule Action Types') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesautomationruleactiontype-form',
    templateUrl: './mjbizappssalesautomationruleactiontype.form.component.html'
})
export class mjBizAppsSalesAutomationRuleActionTypeFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesAutomationRuleActionTypeEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsSalesAutomationRuleActions', sectionName: 'Automation Rule Actions', isExpanded: false }
        ]);
    }
}

