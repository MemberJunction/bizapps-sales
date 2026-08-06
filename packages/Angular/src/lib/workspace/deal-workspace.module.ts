/**
 * @fileoverview The one NgModule sales' custom UI needs.
 *
 * It exists for a single reason: `BaseResourceComponent` subclasses are instantiated by Explorer
 * through an NgModule, so `DealWorkspaceResourceComponent` cannot be standalone and must be declared
 * somewhere. Everything else in this package is standalone and merely IMPORTED here.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DealWorkspaceComponent } from './deal-workspace.component';
import { DealWorkspaceResourceComponent } from './deal-workspace-resource.component';

@NgModule({
    declarations: [DealWorkspaceResourceComponent],
    imports: [CommonModule, DealWorkspaceComponent],
    exports: [DealWorkspaceResourceComponent, DealWorkspaceComponent],
})
export class DealWorkspaceModule {}
