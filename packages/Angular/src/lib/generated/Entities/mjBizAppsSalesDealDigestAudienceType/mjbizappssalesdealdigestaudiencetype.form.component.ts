import { Component } from '@angular/core';
import { mjBizAppsSalesDealDigestAudienceTypeEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import {  } from "@memberjunction/ng-entity-viewer"

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Deal Digest Audience Types') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesdealdigestaudiencetype-form',
    templateUrl: './mjbizappssalesdealdigestaudiencetype.form.component.html'
})
export class mjBizAppsSalesDealDigestAudienceTypeFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesDealDigestAudienceTypeEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'audienceDetails', sectionName: 'Audience Details', isExpanded: true },
            { sectionKey: 'behaviorSettings', sectionName: 'Behavior Settings', isExpanded: true },
            { sectionKey: 'emailTemplates', sectionName: 'Email Templates', isExpanded: true },
            { sectionKey: 'systemMetadata', sectionName: 'System Metadata', isExpanded: false },
            { sectionKey: 'mJBizAppsSalesDealDigestRecipients', sectionName: 'Deal Digest Recipients', isExpanded: false }
        ]);
    }
}

