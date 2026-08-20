/**
 * @fileoverview Declares the hand-authored per-entity forms (#89 P3).
 *
 * A SEPARATE module from `GeneratedFormsModule` because that one is generated and CodeGen owns it —
 * adding declarations there would survive exactly until the next run.
 *
 * The three components reuse their generated siblings' TEMPLATES rather than forking them, which is the
 * point: layout stays CodeGen's, and these classes contribute behaviour only. Reusing a template means
 * inheriting its directive dependencies, so this module imports the same set `GeneratedFormsModule`
 * does. Miss one and the failure is an `NG8002` naming a binding on a component that plainly exists —
 * confusing, because the template is fine and it is the MODULE that is short.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { BaseFormsModule } from '@memberjunction/ng-base-forms';
import { EntityViewerModule } from '@memberjunction/ng-entity-viewer';
import { LinkDirectivesModule } from '@memberjunction/ng-link-directives';

import { DealFormComponentExtended } from './deal-form.component';
import { DealStageEventFormComponentExtended } from './deal-stage-event-form.component';

@NgModule({
    declarations: [DealFormComponentExtended, DealStageEventFormComponentExtended],
    imports: [CommonModule, FormsModule, BaseFormsModule, EntityViewerModule, LinkDirectivesModule],
    exports: [DealFormComponentExtended, DealStageEventFormComponentExtended],
})
export class SalesCustomFormsModule {}
