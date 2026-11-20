import { Component } from '@angular/core';
import { mjBizAppsSalesDealDigestRecipientEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Deal Digest Recipients') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesdealdigestrecipient-form',
    templateUrl: './mjbizappssalesdealdigestrecipient.form.component.html'
})
export class mjBizAppsSalesDealDigestRecipientFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesDealDigestRecipientEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'recipientConfiguration', sectionName: 'Recipient Configuration', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false }
        ]);
    }
}

