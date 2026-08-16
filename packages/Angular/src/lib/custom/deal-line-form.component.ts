/**
 * @fileoverview Deal Line form — the pricing provenance is the server's, not the user's.
 *
 * `DealLine.ResolvedUnitPrice`, `ResolvedExtendedAmount`, `PriceComponentsJSON` and `PricedAt` are
 * WRITE-ONLY from sales' point of view: they are populated from an orders pricing response and never
 * computed or hand-edited here (the first of the three rules this app exists to uphold).
 * `DealLineEntity.RefusePricingProvenanceEdits()` enforces that on save.
 *
 * The generated form does not know any of this and renders all four as ordinary editable fields. So a
 * user can type a price into a quote, press Save, and be refused — correctly, but only after the round
 * trip, and with nothing pointing at which field was the problem. This form moves that refusal forward
 * to the moment they try to save, and names the field.
 *
 * It does NOT grey the fields out, and that is a limitation rather than a choice: see
 * `server-owned-fields.mixin.ts` for why `BaseFormComponent` cannot express per-field read-only.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { Component } from '@angular/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import { PRICING_PROVENANCE_FIELDS } from '@mj-biz-apps/sales-entities';
import type { ValidationResult } from '@memberjunction/core';

import { mjBizAppsSalesDealLineFormComponent } from '../generated/Entities/mjBizAppsSalesDealLine/mjbizappssalesdealline.form.component';
import { RefuseServerOwnedEdits } from './server-owned-fields';

/**
 * Registered at PRIORITY 2, explicitly.
 *
 * The generated form registers under the same key at the auto-assigned priority, and MJ's ClassFactory
 * resolves the highest priority. Relying on import order instead — which is the common pattern — makes
 * the winner depend on which file the bundler happened to reach first, and that is not a property worth
 * betting a form on.
 */
@RegisterClass(BaseFormComponent, 'MJ_BizApps_Sales: Deal Lines', 2)
@Component({
    standalone: false,
    selector: 'mjs-deal-line-form',
    templateUrl: '../generated/Entities/mjBizAppsSalesDealLine/mjbizappssalesdealline.form.component.html',
})
export class DealLineFormComponentExtended extends mjBizAppsSalesDealLineFormComponent {
    /** The write-only pricing stamps, from the SAME list `DealLineEntity` refuses edits to. */
    public readonly ServerOwnedFields: readonly string[] = [...PRICING_PROVENANCE_FIELDS];

    public readonly ServerOwnedReason: string =
        'Priced by Orders, not editable here. Sales records what was asked for — product, quantity and ' +
        'requested discount — and Orders returns the money. To change a price, change the request and ' +
        'reprice.';

    public override Validate(): ValidationResult {
        return RefuseServerOwnedEdits(super.Validate(), this.record, this.ServerOwnedFields, this.ServerOwnedReason);
    }
}

/** Anti-tree-shaking anchor. Nothing references this class by name, so the import must be held open. */
export function LoadDealLineForm(): void {
    /* keeps the registration alive */
}
