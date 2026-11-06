/**
 * @fileoverview A search box over common's party lookup queries that picks a record without writing a
 * field (bc-aidp-next-golive#435).
 *
 * `bizapps-party-field` writes the picked ID into a foreign key on a record. The create cards need a
 * pick that is not a field of the record being created: the existing Organization a new account starts
 * from, and the account a new contact works at (a Relationship row). This runs the same queries and
 * the same term rules (`PartyLookupParamsFor`) and hands the pick to the card.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogError, RunQuery } from '@memberjunction/core';
import { PARTY_LOOKUP_QUERIES, PartyLookupParamsFor, type PartyKind } from '@mj-biz-apps/common-ng';

export interface PartyPick {
    ID: string;
    Name: string;
    Detail: string | null;
}

interface PartyLookupRow {
    ID: string;
    Name: string;
    Detail?: string | null;
}

const SEARCH_DELAY_MS = 250;

@Component({
    standalone: true,
    selector: 'mjs-party-search',
    imports: [CommonModule],
    template: `
        <div class="mjs-party-search">
            <label class="mj-forms-field-label" [attr.for]="InputID">{{ Label }}</label>
            <input type="search" class="mjs-party-search__input" [id]="InputID" [placeholder]="Placeholder"
                   autocomplete="off" [value]="Term" (input)="OnInput($event)"
                   data-testid="party-search-input" />
            @if (Results.length) {
                <ul class="mjs-party-search__results" role="listbox">
                    @for (r of Results; track r.ID) {
                        <li role="option" (click)="Pick(r)" (keydown.enter)="Pick(r)" tabindex="0"
                            data-testid="party-search-result">
                            <span class="mjs-party-search__name">{{ r.Name }}</span>
                            @if (r.Detail) { <span class="mjs-party-search__detail">{{ r.Detail }}</span> }
                        </li>
                    }
                </ul>
            } @else if (Searched && Term.trim().length >= 2) {
                <p class="mjs-party-search__none">No match for "{{ Term.trim() }}".</p>
            }
        </div>
    `,
    styles: [`
        .mjs-party-search { display: flex; flex-direction: column; gap: var(--mj-space-1); }
        .mjs-party-search__input {
            padding: var(--mj-space-2) var(--mj-space-3); border: 1px solid var(--mj-border-default);
            border-radius: var(--mj-radius-md); background: var(--mj-bg-surface); color: var(--mj-text-primary);
        }
        .mjs-party-search__results {
            list-style: none; margin: 0; padding: 0; max-height: 240px; overflow-y: auto;
            border: 1px solid var(--mj-border-default); border-radius: var(--mj-radius-md);
        }
        .mjs-party-search__results li {
            display: flex; justify-content: space-between; gap: var(--mj-space-3);
            padding: var(--mj-space-2) var(--mj-space-3); cursor: pointer;
        }
        .mjs-party-search__results li:hover, .mjs-party-search__results li:focus { background: var(--mj-bg-surface-hover); }
        .mjs-party-search__detail, .mjs-party-search__none { color: var(--mj-text-muted); }
        .mjs-party-search__none { margin: 0; }
    `],
})
export class MJSPartySearchComponent implements OnDestroy {
    private readonly cdr = inject(ChangeDetectorRef);
    private timer: ReturnType<typeof setTimeout> | null = null;
    private latest = 0;

    @Input({ required: true }) Kind!: PartyKind;
    /** A query other than common's default for the kind, for example sales' accounts-only lookup. */
    @Input() QueryName?: string;
    @Input() CategoryPath?: string;
    @Input() Label = '';
    @Input() Placeholder = '';
    @Input() InputID = 'mjs-party-search';
    @Output() Picked = new EventEmitter<PartyPick>();

    public Term = '';
    public Results: PartyPick[] = [];
    public Searched = false;

    public ngOnDestroy(): void {
        if (this.timer) clearTimeout(this.timer);
    }

    public OnInput(event: Event): void {
        const value = event.target instanceof HTMLInputElement ? event.target.value : '';
        this.Term = value;
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.search(value), SEARCH_DELAY_MS);
    }

    public Pick(result: PartyPick): void {
        this.Results = [];
        this.Term = '';
        this.Searched = false;
        this.Picked.emit(result);
        this.cdr.detectChanges();
    }

    /** Runs the lookup; a reply that arrives after a newer search started is dropped. */
    private async search(raw: string): Promise<void> {
        const call = ++this.latest;
        const results = await this.lookup(raw);
        if (call !== this.latest) return;
        this.Results = results;
        this.Searched = true;
        this.cdr.detectChanges();
    }

    /** The matches for a term, or none under two characters or when the query fails (logged). */
    public async lookup(raw: string): Promise<PartyPick[]> {
        const params = PartyLookupParamsFor(this.Kind, raw);
        if (!params) return [];
        const query = this.QueryName
            ? { QueryName: this.QueryName, CategoryPath: this.CategoryPath }
            : PARTY_LOOKUP_QUERIES[this.Kind];
        const parameters: Record<string, string> = { Term: params.Term };
        if (params.Domain) parameters['Domain'] = params.Domain;
        const result = await new RunQuery().RunQuery({ ...query, Parameters: parameters });
        if (!result.Success) {
            LogError(`mjs-party-search: ${query.QueryName} failed: ${result.ErrorMessage ?? 'unknown error'}`);
            return [];
        }
        return (result.Results as PartyLookupRow[]).map((row) => ({
            ID: String(row.ID),
            Name: String(row.Name),
            Detail: row.Detail ?? null,
        }));
    }
}
