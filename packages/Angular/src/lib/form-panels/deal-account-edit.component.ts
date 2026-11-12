/**
 * @fileoverview "Edit account" under a deal's Account field: edits the SELECTED account in a slide-in.
 *
 * The field's own controls offer two things: its "Create new" footer makes a NEW account, and its
 * record link opens the account in another Explorer tab. A rep correcting the customer's details
 * mid-deal needs neither — they want the account already chosen, over the deal they are working on.
 *
 * A component of its own rather than a method on the deal field panels, because opening a slide-in
 * needs `MJFormPresenterService`, and `inject()` needs an injection context those panels deliberately
 * do without so that tests can build them with `new` (see `MJSDealPipelinePanel.statuses`).
 */
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { BaseFormComponent, MJFormPresenterService } from '@memberjunction/ng-base-forms';
import type { DealEntity } from '@mj-biz-apps/sales-entities';

import { MJS_ENTITIES } from '../data/entity-names';

@Component({
    selector: 'mjs-deal-account-edit',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (Record?.AccountID) {
            <button type="button" class="mjs-account-edit" data-testid="deal-edit-account" (click)="Edit()">
                <i class="fa-solid fa-pen"></i> Edit account
            </button>
        }
    `,
    styles: [`
        .mjs-account-edit {
            margin-top: var(--mj-space-1); padding: 0; border: 0; background: none; cursor: pointer;
            font: inherit; font-size: 0.82rem; color: var(--mj-brand-primary);
        }
        .mjs-account-edit:hover { text-decoration: underline; }
    `],
})
export class MJSDealAccountEditComponent {
    private readonly forms = inject(MJFormPresenterService);

    @Input() public Record: DealEntity | null = null;
    @Input() public Form: BaseFormComponent | null = null;
    /** The deal's edit mode (not the account's), which decides whether the deal can be re-read afterwards. */
    @Input() public DealEditMode = false;

    /**
     * Opens the account in a slide-in, editable whether or not the deal is: the account is its own
     * record, and its form and save enforce its own permissions. A locked deal does not lock its
     * customer.
     *
     * After a save the deal is re-read so a renamed account shows its new name, but only when that
     * cannot discard anything: a refresh in edit mode does nothing (`canRefreshRecord()` is
     * `IsSaved && !EditMode`), and one over unsaved typing would lose it. Otherwise the new name
     * shows on the deal's next load.
     */
    public async Edit(): Promise<void> {
        const deal = this.Record;
        const id = deal?.AccountID;
        if (!deal || !id) return;
        const ref = this.forms.Open({
            EntityName: MJS_ENTITIES.SalesAccount,
            RecordId: id,
            Presentation: 'slide-in',
            EditMode: true,
            Title: deal.Account?.trim() || 'Account',
        });
        const saved = await ref.AfterSaved();
        if (!saved || this.DealEditMode || deal.Dirty || !this.Form) return;
        await this.Form.RefreshRecord();
    }
}
