/**
 * @fileoverview Force left-nav on the Deal form.
 *
 * Layout is supposed to come from `Entity.Configuration.UI.Form` (metadata). Deals were
 * deliberately left on accordion while the workspace was the composing surface. That split is
 * gone — the form IS the deal. This policy sets `Layout: 'left-nav'` so the rail appears even
 * before metadata is pushed. Membership is unchanged (DecorateChrome must not add/remove groups).
 *
 * @module @mj-biz-apps/sales-ng
 */
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPolicy, type FormChromeSpec } from '@memberjunction/ng-base-forms';
import { MJS_ENTITIES } from '../data/entity-names';

@RegisterClassEx(BaseFormPolicy, {
    key: 'form-policy:Deals',
    metadata: { entity: MJS_ENTITIES.Deal },
})
export class DealFormPolicy extends BaseFormPolicy {
    public override DecorateChrome(spec: FormChromeSpec): FormChromeSpec {
        spec.Layout = 'left-nav';
        return spec;
    }
}
