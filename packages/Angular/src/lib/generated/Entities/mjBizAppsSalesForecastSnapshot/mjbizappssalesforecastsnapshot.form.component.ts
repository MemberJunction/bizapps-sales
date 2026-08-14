import { Component } from '@angular/core';
import { mjBizAppsSalesForecastSnapshotEntity } from '@mj-biz-apps/sales-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Forecast Snapshots') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-mjbizappssalesforecastsnapshot-form',
    templateUrl: './mjbizappssalesforecastsnapshot.form.component.html'
})
export class mjBizAppsSalesForecastSnapshotFormComponent extends BaseFormComponent {
    public record!: mjBizAppsSalesForecastSnapshotEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

