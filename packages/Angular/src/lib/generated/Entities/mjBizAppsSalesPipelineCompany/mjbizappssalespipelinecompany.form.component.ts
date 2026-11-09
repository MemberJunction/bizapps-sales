import { Component } from '@angular/core';
import { mjBizAppsSalesPipelineCompanyEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Pipeline Companies') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalespipelinecompany-form',
    templateUrl: './mjbizappssalespipelinecompany.form.component.html'
})
export class mjBizAppsSalesPipelineCompanyFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesPipelineCompanyEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'pipelineAssignment', sectionName: 'Pipeline Assignment', isExpanded: true },
            { sectionKey: 'statusAndConfiguration', sectionName: 'Status and Configuration', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false }
        ]);
    }
}

