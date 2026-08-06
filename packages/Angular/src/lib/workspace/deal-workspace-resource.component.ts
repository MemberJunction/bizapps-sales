/**
 * @fileoverview Explorer resource shim for the deal workspace.
 *
 * An MJ Application nav item with `ResourceType: 'Custom'` and `DriverClass: 'DealWorkspaceResource'`
 * resolves to THIS class through the ClassFactory, and this class does nothing but host the real
 * component. The indirection is MJ's, not ours: nav items address a resource, and a resource is what
 * knows its own display name and icon.
 *
 * `standalone: false` deliberately — Explorer instantiates resources through an NgModule, so this must
 * be DECLARED (see `deal-workspace.module.ts`). The workspace it hosts is standalone, per house style;
 * the module imports it.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { Component, OnInit } from '@angular/core';
import { ResourceData } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseResourceComponent } from '@memberjunction/ng-shared';

@RegisterClass(BaseResourceComponent, 'DealWorkspaceResource')
@Component({
    standalone: false,
    selector: 'mjs-deal-workspace-resource',
    template: `<mjs-deal-workspace></mjs-deal-workspace>`,
})
export class DealWorkspaceResourceComponent extends BaseResourceComponent implements OnInit {
    public ngOnInit(): void {
        super.ngOnInit();
        // Required of every BaseResourceComponent — Explorer waits on it before it stops showing a
        // loading state, so omitting it leaves the tab spinning forever.
        this.NotifyLoadComplete();
    }

    public async GetResourceDisplayName(_data: ResourceData): Promise<string> {
        return 'Deals';
    }

    public async GetResourceIconClass(_data: ResourceData): Promise<string> {
        return 'fa-solid fa-handshake';
    }
}

/**
 * Tree-shaking anchor, called from `public-api.ts`.
 *
 * Registration happens as a side effect of import, and nothing references this class by name — so a
 * bundler is right to drop it, and the nav item would then resolve to nothing with no error anywhere.
 */
export function LoadDealWorkspaceResource(): void {
    // No-op by design.
}
