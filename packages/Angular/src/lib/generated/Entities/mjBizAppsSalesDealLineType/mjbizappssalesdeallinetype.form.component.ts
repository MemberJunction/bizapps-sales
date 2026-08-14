import { Component } from '@angular/core';
import { mjBizAppsSalesDealLineTypeEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Deal Line Types') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesdeallinetype-form',
    templateUrl: './mjbizappssalesdeallinetype.form.component.html'
})
export class mjBizAppsSalesDealLineTypeFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesDealLineTypeEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true },
            { sectionKey: 'mJBizAppsSalesDealLines', sectionName: 'Deal Lines', isExpanded: false }
        ]);
    }
}

