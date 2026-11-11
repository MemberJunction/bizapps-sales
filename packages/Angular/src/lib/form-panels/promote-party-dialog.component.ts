/**
 * @fileoverview Search an Organization or Person that is not yet a sales record, and promote it.
 *
 * This is the dialog behind D-PR3's other two entry points: the Sales Accounts rail page ("add an
 * existing organization") and the deal form ("not finding the company?"). One component serves both,
 * because the question is the same in both places.
 *
 * WHY THIS IS A SALES-OWNED CONTROL AND NOT A RELAXED ACCOUNT PICKER. The deal's account picker is
 * common's `bizapps-party-field`, which renders Name and Detail and offers no way to mark a row
 * unselectable — no row template, no chips, no `BeforeSelect`. Returning a promotable organization
 * there would let a rep PICK one, setting `Deal.AccountID` to a row the server must refuse; `PL1` and
 * `PL3` assert against exactly that. So the promotable rows live in their own queries
 * (`Sales: Party Lookup Promotable {Accounts,Contacts}`, the EXACT complement of the picker's) and are
 * only ever shown here, where selecting one promotes it instead of storing it.
 *
 * The term and domain come from common's own `PartyLookupParamsFor`, not a local copy, so this
 * searches on precisely the rule the picker searches on — including its two-character minimum.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { A11yModule } from '@angular/cdk/a11y';
import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnDestroy,
    OnInit,
    Output,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MJButtonDirective } from '@memberjunction/ng-ui-components';
import { PartyLookupParamsFor, type PartyKind } from '@mj-biz-apps/common-ng';
import { RunQuery } from '@memberjunction/core';
import { MJS_ENTITIES } from '../data/entity-names';
import {
    AccountPromotePrefill,
    ContactPromotePrefill,
    type PromotePrefillReader,
} from './promote-party.panels';
import { CreateParty, PromoteParty, type PromoteOutcome } from '../data/promote-party';

/** Which promotion this dialog is doing. */
export type PromoteKind = 'Account' | 'Contact';

/** A row the dialog can promote. The party lookup contract: ID, Name, Detail. */
export interface PromotableRow {
    ID: string;
    Name: string | null;
    Detail: string | null;
    /**
     * True when the sales row ALREADY exists, so the row is chosen outright and nothing is written.
     * The dialog shows both states in one list because "is this company already an account?" is not
     * a question the rep should have to answer before searching -- it is what they came to find out.
     */
    IsSalesParty: boolean;
}

interface PromoteKindConfig {
    Kind: PartyKind;
    QueryName: string;
    ChildEntity: string;
    Title: string;
    /** The confirm button when the chosen row must be PROMOTED. */
    Confirm: string;
    /** The query returning rows that already have their sales row. */
    ExistingQueryName: string;
    /** What a brand-new record is called, and the fields it needs. */
    CreateLabel: string;
    /** Person needs FirstName + LastName; Organization needs only Name. */
    CreateFields: 'name' | 'person';
    Placeholder: string;
    Empty: string;
    Prefill: PromotePrefillReader;
}

/** Everything that differs between the two promotions, in one table rather than spread through the class. */
export const PROMOTE_KINDS: Record<PromoteKind, PromoteKindConfig> = {
    Account: {
        Kind: 'Organization',
        QueryName: 'Sales: Party Lookup Promotable Accounts',
        ExistingQueryName: 'Sales: Party Lookup Accounts',
        ChildEntity: MJS_ENTITIES.SalesAccount,
        Title: 'Find or add a Sales Account',
        Confirm: 'Promote to Sales Account',
        CreateLabel: 'Sales Account',
        CreateFields: 'name',
        Placeholder: 'Search Organizations by name, acronym or website',
        Empty: 'No Organization matches.',
        Prefill: AccountPromotePrefill,
    },
    Contact: {
        Kind: 'Person',
        QueryName: 'Sales: Party Lookup Promotable Contacts',
        ExistingQueryName: 'Sales: Party Lookup Contacts',
        ChildEntity: MJS_ENTITIES.SalesContact,
        Title: 'Find or add a Sales Contact',
        Confirm: 'Promote to Sales Contact',
        CreateLabel: 'Sales Contact',
        CreateFields: 'person',
        Placeholder: 'Search People by name or email',
        Empty: 'No Person matches.',
        Prefill: ContactPromotePrefill,
    },
};

/** How long to wait after a keystroke before searching. Common's own picker uses the same figure. */
const DEBOUNCE_MS = 250;

@Component({
    standalone: true,
    selector: 'mjs-promote-party-dialog',
    imports: [CommonModule, FormsModule, A11yModule, MJButtonDirective],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="mjs-pp__scrim" (click)="Cancel()"></div>
        <div
            class="mjs-pp"
            role="dialog"
            aria-modal="true"
            data-testid="promote-dialog"
            [attr.aria-label]="Config.Title"
            tabindex="-1"
            cdkTrapFocus
            (keydown.escape)="OnEscape($event)">
            <header class="mjs-pp__head">
                <h2 class="mjs-pp__title">{{ Config.Title }}</h2>
                <button type="button" class="mjs-pp__close" aria-label="Close" data-testid="promote-dialog-close" (click)="Cancel()">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </header>

            <div class="mjs-pp__body">
                <input
                    type="text"
                    class="mjs-pp__search"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-controls="mjs-pp-results"
                    [attr.aria-expanded]="Rows().length > 0"
                    [placeholder]="Config.Placeholder"
                    [disabled]="Busy()"
                    data-testid="promote-search"
                    [ngModel]="Term()"
                    (ngModelChange)="OnTermChange($event)" />

                @if (Searching()) {
                    <p class="mjs-pp__note">Searching…</p>
                } @else if (Term().length > 0 && !Params()) {
                    <p class="mjs-pp__note" data-testid="promote-too-short">Keep typing — two characters at least.</p>
                } @else if (CanOfferCreate()) {
                    <!-- Offered only AFTER a search found nothing, so creating is the last resort
                         rather than the first one -- which is the duplicate this feature removes. -->
                    <div class="mjs-pp__create" data-testid="promote-create">
                        <p class="mjs-pp__note">{{ Config.Empty }} Create a new {{ Config.CreateLabel }}?</p>
                        @if (Config.CreateFields === 'person') {
                            <div class="mjs-pp__create-row">
                                <input type="text" class="mjs-pp__search" placeholder="First name"
                                       data-testid="promote-create-first"
                                       [ngModel]="NewFirst()" (ngModelChange)="NewFirst.set($event)" />
                                <input type="text" class="mjs-pp__search" placeholder="Last name"
                                       data-testid="promote-create-last"
                                       [ngModel]="NewLast()" (ngModelChange)="NewLast.set($event)" />
                            </div>
                        } @else {
                            <input type="text" class="mjs-pp__search" placeholder="Name"
                                   data-testid="promote-create-name"
                                   [ngModel]="NewName()" (ngModelChange)="NewName.set($event)" />
                        }
                        <button type="button" mjButton Variant="outline" class="mjs-pp__create-btn"
                                data-testid="promote-create-confirm"
                                [disabled]="!CanCreate() || Busy()" (click)="CreateNew()">
                            {{ Busy() ? 'Creating…' : 'Create ' + Config.CreateLabel }}
                        </button>
                    </div>
                }

                <ul id="mjs-pp-results" class="mjs-pp__rows" role="listbox" [attr.aria-label]="Config.Title">
                    @for (row of Rows(); track row.ID) {
                        <li>
                            <button
                                type="button"
                                class="mjs-pp__row"
                                role="option"
                                [attr.aria-selected]="Selected()?.ID === row.ID"
                                [class.is-selected]="Selected()?.ID === row.ID"
                                [disabled]="Busy()"
                                data-testid="promote-row"
                                (click)="Choose(row)">
                                <span class="mjs-pp__row-name">
                                    {{ row.Name }}
                                    @if (row.IsSalesParty) {
                                        <span class="mjs-pp__badge" data-testid="promote-row-existing">{{ Config.CreateLabel }}</span>
                                    } @else {
                                        <span class="mjs-pp__badge mjs-pp__badge--new" data-testid="promote-row-promotable">Not yet</span>
                                    }
                                </span>
                                @if (row.Detail) {
                                    <span class="mjs-pp__row-detail">{{ row.Detail }}</span>
                                }
                            </button>
                        </li>
                    }
                </ul>

                @if (Error()) {
                    <p class="mjs-pp__error" data-testid="promote-dialog-error">{{ Error() }}</p>
                }
            </div>

            <!-- Confirm LEFT, cancel RIGHT (CLAUDE.md). -->
            <footer class="mjs-pp__foot">
                <button
                    type="button"
                    mjButton
                    Variant="primary"
                    data-testid="promote-dialog-confirm"
                    [disabled]="!Selected() || Busy()"
                    (click)="Confirm()">
                    {{ ConfirmLabel() }}
                </button>
                <button type="button" mjButton Variant="outline" [disabled]="Busy()" data-testid="promote-dialog-cancel" (click)="Cancel()">
                    Cancel
                </button>
                @if (!Selected() && !Busy()) {
                    <span class="mjs-pp__note">Pick a row first.</span>
                }
            </footer>
        </div>
    `,
    styles: [
        `
            .mjs-pp__scrim {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.35);
                z-index: 1000;
            }
            .mjs-pp {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: min(560px, calc(100vw - 32px));
                max-height: calc(100vh - 64px);
                display: flex;
                flex-direction: column;
                z-index: 1001;
                background: var(--mj-bg-surface-card);
                color: var(--mj-text-primary);
                border: 1px solid var(--mj-border-default);
                border-radius: var(--mj-radius-xl, 16px);
                box-shadow: var(--mj-shadow-lg, 0 12px 32px rgba(0, 0, 0, 0.22));
            }
            .mjs-pp__head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: var(--mj-space-3);
                padding: var(--mj-space-4) var(--mj-space-5);
                border-bottom: 1px solid var(--mj-border-subtle);
            }
            .mjs-pp__title {
                margin: 0;
                font-size: var(--mj-text-lg);
                color: var(--mj-text-primary);
            }
            .mjs-pp__close {
                background: none;
                border: 0;
                cursor: pointer;
                color: var(--mj-text-muted);
            }
            /*
             * ONE HEIGHT FOR EVERY STATE. The body held whatever was in it, so the dialog grew and
             * shrank as results arrived, emptied, or gave way to the create block -- and it did it
             * at the exact moment the pointer was travelling toward a row. A fixed body turns that
             * into whitespace: the list scrolls inside it, the create block sits in the same space,
             * and the footer never moves under the cursor.
             *
             * min() rather than a flat height so a short viewport shrinks it instead of pushing the
             * footer off screen; the shell's own max-height then has nothing left to clamp.
             */
            .mjs-pp__body {
                flex: 0 0 auto;
                height: min(340px, 50vh);
                box-sizing: border-box;
                padding: var(--mj-space-4) var(--mj-space-5);
                overflow-y: auto;
            }
            .mjs-pp__search {
                width: 100%;
                padding: var(--mj-space-2) var(--mj-space-3);
                background: var(--mj-bg-surface-elevated);
                color: var(--mj-text-primary);
                border: 1px solid var(--mj-border-default);
                border-radius: var(--mj-radius-md, 8px);
            }
            .mjs-pp__rows {
                list-style: none;
                margin: var(--mj-space-3) 0 0;
                padding: 0;
            }
            .mjs-pp__row {
                display: flex;
                flex-direction: column;
                gap: 2px;
                width: 100%;
                text-align: left;
                padding: var(--mj-space-2) var(--mj-space-3);
                background: none;
                border: 1px solid transparent;
                border-radius: var(--mj-radius-md, 8px);
                cursor: pointer;
                color: var(--mj-text-primary);
            }
            .mjs-pp__row:hover {
                background: var(--mj-bg-surface-hover);
            }
            .mjs-pp__row.is-selected {
                border-color: var(--mj-brand-primary);
                background: var(--mj-bg-surface-hover);
            }
            .mjs-pp__badge {
                margin-left: var(--mj-space-2);
                padding: 1px var(--mj-space-2);
                border-radius: var(--mj-radius-md, 8px);
                font-size: var(--mj-text-xs);
                background: var(--mj-bg-surface-sunken);
                color: var(--mj-text-secondary);
            }
            .mjs-pp__badge--new {
                background: var(--mj-status-warning-bg);
                color: var(--mj-status-warning-text);
            }
            .mjs-pp__create {
                margin-top: var(--mj-space-3);
                padding-top: var(--mj-space-3);
                border-top: 1px solid var(--mj-border-subtle);
            }
            .mjs-pp__create-row {
                display: flex;
                gap: var(--mj-space-2);
            }
            .mjs-pp__create-btn {
                margin-top: var(--mj-space-2);
            }
            .mjs-pp__row-detail {
                font-size: var(--mj-text-sm);
                color: var(--mj-text-secondary);
            }
            .mjs-pp__note {
                margin: var(--mj-space-3) 0 0;
                font-size: var(--mj-text-sm);
                color: var(--mj-text-muted);
            }
            .mjs-pp__error {
                margin: var(--mj-space-3) 0 0;
                font-size: var(--mj-text-sm);
                color: var(--mj-status-error-text);
            }
            .mjs-pp__foot {
                display: flex;
                align-items: center;
                gap: var(--mj-space-3);
                padding: var(--mj-space-4) var(--mj-space-5);
                border-top: 1px solid var(--mj-border-subtle);
            }
        `,
    ],
})
export class MJSPromotePartyDialog implements OnInit, OnDestroy {
    @Input() public PromoteKind: PromoteKind = 'Account';
    /**
     * The sales party the rep ended on, whether it was selected, promoted or created. Its ID IS the
     * parent's ID (IS-A). Named for the outcome rather than the route, because the caller stores the
     * same thing either way.
     */
    @Output() public readonly PartyChosen = new EventEmitter<string>();
    @Output() public readonly Closed = new EventEmitter<void>();

    public readonly Term = signal('');
    public readonly Rows = signal<readonly PromotableRow[]>([]);
    public readonly Selected = signal<PromotableRow | null>(null);
    public readonly Searching = signal(false);
    public readonly Busy = signal(false);
    public readonly Error = signal<string | null>(null);

    /** Replaced in tests. */
    public Search: (queryName: string, term: string, domain: string | null) => Promise<readonly PromotableRow[]> =
        RunPromotableLookup;
    public Promote: typeof PromoteParty = PromoteParty;
    public Create: typeof CreateParty = CreateParty;

    private timer: ReturnType<typeof setTimeout> | null = null;
    private opener: HTMLElement | null = null;
    private sequence = 0;

    public get Config(): PromoteKindConfig {
        return PROMOTE_KINDS[this.PromoteKind];
    }

    /** The lookup parameters for the current term, or null while the term is too short. */
    public Params(): { Term: string; Domain: string | null } | null {
        return PartyLookupParamsFor(this.Config.Kind, this.Term());
    }

    public ngOnInit(): void {
        this.opener = typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null);
    }

    public ngOnDestroy(): void {
        if (this.timer) clearTimeout(this.timer);
        this.opener?.focus?.();
    }

    public OnTermChange(value: string): void {
        this.Term.set(value ?? '');
        this.Selected.set(null);
        this.Error.set(null);
        if (this.timer) clearTimeout(this.timer);
        const params = this.Params();
        if (!params) {
            this.Rows.set([]);
            this.Searching.set(false);
            return;
        }
        this.Searching.set(true);
        this.timer = setTimeout(() => void this.RunSearch(), DEBOUNCE_MS);
    }

    /**
     * Runs BOTH halves and merges them. The two queries are the exact complement of one another
     * (`PL7`/`PL8` assert they partition the set), so the union is every matching party exactly once
     * -- no de-duplication needed, and nothing can be missing from it. Each row carries which half it
     * came from, which is the only difference the rep sees.
     *
     * Only the newest search may write results; an earlier one that lands late is discarded.
     */
    public async RunSearch(): Promise<void> {
        const params = this.Params();
        if (!params) return;
        const mine = ++this.sequence;
        try {
            const [existing, promotable] = await Promise.all([
                this.Search(this.Config.ExistingQueryName, params.Term, params.Domain),
                this.Search(this.Config.QueryName, params.Term, params.Domain),
            ]);
            if (mine !== this.sequence) return;
            const rows = [
                ...existing.map((r) => ({ ...r, IsSalesParty: true })),
                ...promotable.map((r) => ({ ...r, IsSalesParty: false })),
            ].sort((a, b) => String(a.Name ?? '').localeCompare(String(b.Name ?? '')));
            this.Rows.set(rows);
        } catch {
            if (mine === this.sequence) {
                this.Rows.set([]);
                this.Error.set('The search failed. Try again.');
            }
        } finally {
            if (mine === this.sequence) this.Searching.set(false);
        }
    }

    public Choose(row: PromotableRow): void {
        if (this.Busy()) return;
        this.Selected.set(row);
        this.Error.set(null);
    }

    /** The confirm button's label: a row that is already a sales party is CHOSEN, not promoted. */
    public ConfirmLabel(): string {
        if (this.Busy()) return this.Selected()?.IsSalesParty ? 'Selecting…' : 'Promoting…';
        return this.Selected()?.IsSalesParty ? 'Select' : this.Config.Confirm;
    }

    public async Confirm(): Promise<void> {
        const row = this.Selected();
        if (!row || this.Busy()) return;
        // Already a sales party: nothing to write. Choosing it is the whole action, and promoting it
        // would be the second promotion `PromoteParty` exists to refuse.
        if (row.IsSalesParty) {
            this.PartyChosen.emit(row.ID);
            this.Closed.emit();
            return;
        }
        this.Busy.set(true);
        this.Error.set(null);
        try {
            this.Apply(await this.Promote(this.Config.ChildEntity, row.ID, await this.Config.Prefill()), row);
        } finally {
            this.Busy.set(false);
        }
    }

    // ── Creating one that does not exist at all ───────────────────────────────

    public readonly NewName = signal('');
    public readonly NewFirst = signal('');
    public readonly NewLast = signal('');

    /** Offered only once a search has run and found nothing — never as a first resort. */
    public CanOfferCreate(): boolean {
        return !!this.Params() && !this.Searching() && this.Rows().length === 0;
    }

    public CanCreate(): boolean {
        return this.Config.CreateFields === 'person'
            ? !!this.NewFirst().trim() && !!this.NewLast().trim()
            : !!this.NewName().trim();
    }

    public async CreateNew(): Promise<void> {
        if (!this.CanCreate() || this.Busy()) return;
        this.Busy.set(true);
        this.Error.set(null);
        try {
            const fields =
                this.Config.CreateFields === 'person'
                    ? { FirstName: this.NewFirst().trim(), LastName: this.NewLast().trim() }
                    : { Name: this.NewName().trim() };
            const outcome = await this.Create(this.Config.ChildEntity, {
                ...fields,
                ...(await this.Config.Prefill()),
            });
            if (outcome.Kind === 'Promoted') {
                this.PartyChosen.emit(outcome.ID);
                this.Closed.emit();
                return;
            }
            this.Error.set(outcome.Kind === 'Failed' ? outcome.Message : 'It could not be created.');
        } finally {
            this.Busy.set(false);
        }
    }

    /** One place that turns an outcome into what the user sees, so no arm is left unhandled. */
    private Apply(outcome: PromoteOutcome, row: PromotableRow): void {
        switch (outcome.Kind) {
            case 'Promoted':
            case 'AlreadyPromoted':
                this.PartyChosen.emit(outcome.Kind === 'Promoted' ? outcome.ID : row.ID);
                this.Closed.emit();
                return;
            case 'NoParent':
                // `AttachToParent` returns false when the parent did not LOAD. Deleted is only one
                // reason; unreadable here (no permission, or the owning app's server package not
                // installed on this host) looks identical from the client. Say what is known.
                this.Error.set('That record could not be loaded — it may have been deleted, or may not be available here. Search again.');
                this.Rows.set(this.Rows().filter((r) => r.ID !== row.ID));
                this.Selected.set(null);
                return;
            default:
                this.Error.set(outcome.Message);
        }
    }

    public OnEscape(event: Event): void {
        event.preventDefault();
        if (!this.Busy()) this.Cancel();
    }

    public Cancel(): void {
        if (this.Busy()) return;
        this.Closed.emit();
    }
}

/** Reads one of the promotable lookup queries. Separate so the dialog tests without a provider. */
export async function RunPromotableLookup(
    queryName: string,
    term: string,
    domain: string | null,
): Promise<readonly PromotableRow[]> {
    const result = await new RunQuery().RunQuery({
        QueryName: queryName,
        CategoryPath: 'Sales',
        Parameters: domain ? { Term: term, Domain: domain } : { Term: term },
    });
    if (!result?.Success) return [];
    return (result.Results ?? []) as PromotableRow[];
}
