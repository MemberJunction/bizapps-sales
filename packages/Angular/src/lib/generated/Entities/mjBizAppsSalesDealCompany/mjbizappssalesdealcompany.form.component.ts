import { Component } from '@angular/core';
import { mjBizAppsSalesDealCompanyEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Deal Companies') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesdealcompany-form',
    templateUrl: './mjbizappssalesdealcompany.form.component.html'
})
export class mjBizAppsSalesDealCompanyFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesDealCompanyEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'dealCompanyAssociation', sectionName: 'Deal Company Association', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false }
        ]);
    }
}

