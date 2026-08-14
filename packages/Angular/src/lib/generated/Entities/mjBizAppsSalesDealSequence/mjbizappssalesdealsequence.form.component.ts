import { Component } from '@angular/core';
import { mjBizAppsSalesDealSequenceEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Deal Sequences') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesdealsequence-form',
    templateUrl: './mjbizappssalesdealsequence.form.component.html'
})
export class mjBizAppsSalesDealSequenceFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesDealSequenceEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

