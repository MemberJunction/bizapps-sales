/**
 * @fileoverview The promote affordance on Common's Organization and Person forms.
 *
 * Same seam as `party-deals.panels.ts`: `@RegisterClassEx(BaseFormPanel)` against
 * `MJ_BizApps_Common: Organizations` / `People`, Common is not modified. Where that file draws a
 * grid and explains why New is hidden, this one offers the fix — promoting the record into sales
 * (D-PR3 entry point 1).
 *
 * IT RENDERS NOTHING once the record is a sales record, and nothing while the check is unanswered.
 * The card is the whole component, so a promoted Organization's form is exactly as it was before this
 * panel existed. An unanswered check hides it too: offering a promotion we cannot tell is needed
 * would invite the second promotion that `PromoteParty` exists to refuse.
 *
 * NO CONFIRM STEP, deliberately. Promotion inserts one subtype row, writes nothing to the parent, and
 * the rep arrived by clicking a button that says what it does. Before anyone adds an undo next to it:
 * undoing a promotion is NOT symmetric — `IS8` records that deleting a Sales Contact which is its
 * Person's only subtype deletes the Person too. An "undo" built from a child delete can therefore
 * destroy a record this app does not own.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { ChangeDetectionStrategy, Component, Directive, DoCheck, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel, BaseFormsModule } from '@memberjunction/ng-base-forms';
import { MJButtonDirective } from '@memberjunction/ng-ui-components';
import type { BaseEntity } from '@memberjunction/core';
import { MJS_ENTITIES, MJS_FOREIGN_ENTITIES } from '../data/entity-names';
import {
    PromoteParty,
    ReadProspectAccountTypeID,
    SalesPartyRowExists,
    type PartyRowReader,
    type PromoteOutcome,
} from '../data/promote-party';

const PROMOTE_STYLES = `
.mjs-promote {
    margin: 0 0 var(--mj-space-4);
    padding: var(--mj-space-4) var(--mj-space-5);
    background: var(--mj-status-warning-bg);
    border: 1px solid var(--mj-status-warning-border);
    border-radius: var(--mj-radius-md, 8px);
}
.mjs-promote__text { margin: 0 0 var(--mj-space-3); color: var(--mj-status-warning-text); }
.mjs-promote__note { margin: var(--mj-space-2) 0 0; font-size: var(--mj-text-sm); color: var(--mj-text-muted); }
.mjs-promote__error { margin: var(--mj-space-2) 0 0; font-size: var(--mj-text-sm); color: var(--mj-status-error-text); }
`;

/** Fields a promotion prefills. Resolved per promotion kind; `{}` means "set nothing". */
export type PromotePrefillReader = () => Promise<Record<string, unknown>>;

/** The prefill for a Sales Account: its type, by flag, or nothing when no row carries the flag (D-PR1). */
export async function AccountPromotePrefill(): Promise<Record<string, unknown>> {
    return { AccountTypeID: await ReadProspectAccountTypeID() };
}

/** A Sales Contact takes no defaults — every classification on it is the rep's to choose. */
export async function ContactPromotePrefill(): Promise<Record<string, unknown>> {
    return {};
}

@Directive()
abstract class SalesPromotePanel extends BaseFormPanel<BaseEntity> implements DoCheck {
    /** The sales entity this record would be promoted into. */
    protected abstract readonly ChildEntity: string;
    /** The sentence shown above the button. */
    public abstract readonly Prompt: string;
    public abstract readonly ActionLabel: string;
    protected abstract readonly Prefill: PromotePrefillReader;

    /** True when the record has no sales row, false when it has one, null while unknown. */
    public readonly NeedsPromotion = signal<boolean | null>(null);
    public readonly Busy = signal(false);
    /** A refusal to show. Success removes the card instead of narrating itself. */
    public readonly Error = signal<string | null>(null);

    /** Replaced in tests. */
    public ReadPartyRow: PartyRowReader = SalesPartyRowExists;
    public Promote: typeof PromoteParty = PromoteParty;

    private checkedID: string | null = null;

    public ngDoCheck(): void {
        if (this.RecordID() !== this.checkedID) void this.CheckNeedsPromotion();
    }

    /** A refresh re-asks, because promoting elsewhere on the form is exactly what a refresh follows. */
    public override OnRecordRefreshed(record: BaseEntity): void {
        super.OnRecordRefreshed(record);
        this.checkedID = null;
        void this.CheckNeedsPromotion();
    }

    /** Reads once per record ID; a later ID starts a new read and the earlier answer is discarded. */
    public async CheckNeedsPromotion(): Promise<void> {
        const id = this.RecordID();
        if (id === this.checkedID) return;
        this.checkedID = id;
        this.NeedsPromotion.set(null);
        this.Error.set(null);
        if (!id) return;
        const exists = await this.ReadPartyRow(this.ChildEntity, id);
        if (this.checkedID !== id) return;
        this.NeedsPromotion.set(exists === false);
    }

    public async RunPromotion(): Promise<void> {
        const id = this.RecordID();
        if (!id || this.Busy()) return;
        this.Busy.set(true);
        this.Error.set(null);
        try {
            this.Apply(await this.Promote(this.ChildEntity, id, await this.Prefill()));
        } finally {
            this.Busy.set(false);
        }
    }

    /** One place that turns an outcome into what the rep sees, so no arm is left unhandled. */
    private Apply(outcome: PromoteOutcome): void {
        switch (outcome.Kind) {
            case 'Promoted':
            case 'AlreadyPromoted':
                this.NeedsPromotion.set(false);
                void this.FormComponent.RefreshRecord();
                return;
            case 'NoParent':
                this.Error.set('This record no longer exists. Reload the page.');
                return;
            default:
                this.Error.set(outcome.Message);
        }
    }

    protected RecordID(): string | null {
        const raw = this.Record?.IsSaved ? this.Record.Get?.('ID') : null;
        return raw ? String(raw) : null;
    }
}

const PROMOTE_TEMPLATE = `
    @if (NeedsPromotion() === true) {
        <div class="mjs-promote" data-testid="promote-card">
            <p class="mjs-promote__text">{{ Prompt }}</p>
            <button
                type="button"
                mjButton
                Variant="primary"
                data-testid="promote-confirm"
                [disabled]="Busy()"
                (click)="RunPromotion()">
                {{ Busy() ? 'Adding…' : ActionLabel }}
            </button>
            @if (Error()) {
                <p class="mjs-promote__error" data-testid="promote-error">{{ Error() }}</p>
            }
            <p class="mjs-promote__note">The {{ ParentNoun }} itself is not changed — this only adds it to sales.</p>
        </div>
    }
`;

@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:Organizations:sales:Promote',
    priority: 10,
    metadata: {
        entity: MJS_FOREIGN_ENTITIES.Organization,
        slot: 'before-fields',
        sortKey: 90,
        contributionKey: 'sales-promote',
        presentation: 'bare',
    },
})
@Component({
    standalone: true,
    selector: 'mjs-organization-promote-panel',
    imports: [CommonModule, BaseFormsModule, MJButtonDirective],
    template: PROMOTE_TEMPLATE,
    styles: [PROMOTE_STYLES],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MJSOrganizationPromotePanel extends SalesPromotePanel {
    public readonly Prompt = 'This organization is not a sales account yet, so it cannot be a deal’s customer.';
    public readonly ActionLabel = 'Add as sales account';
    public readonly ParentNoun = 'organization';
    protected readonly ChildEntity = MJS_ENTITIES.SalesAccount;
    protected readonly Prefill: PromotePrefillReader = AccountPromotePrefill;
}

@RegisterClassEx(BaseFormPanel, {
    key: 'form-panel:People:sales:Promote',
    priority: 10,
    metadata: {
        entity: MJS_FOREIGN_ENTITIES.Person,
        slot: 'before-fields',
        sortKey: 90,
        contributionKey: 'sales-promote',
        presentation: 'bare',
    },
})
@Component({
    standalone: true,
    selector: 'mjs-person-promote-panel',
    imports: [CommonModule, BaseFormsModule, MJButtonDirective],
    template: PROMOTE_TEMPLATE,
    styles: [PROMOTE_STYLES],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MJSPersonPromotePanel extends SalesPromotePanel {
    public readonly Prompt = 'This person is not a sales contact yet, so they cannot be named on a deal.';
    public readonly ActionLabel = 'Add as sales contact';
    public readonly ParentNoun = 'person';
    protected readonly ChildEntity = MJS_ENTITIES.SalesContact;
    protected readonly Prefill: PromotePrefillReader = ContactPromotePrefill;
}
