/**
 * @fileoverview S-US9's surface — a deal's activities in chronological order, plus logging one.
 *
 * A standalone component, so the deal form's Activity panel and any other host can mount it.
 *
 * ── WHY IT READS FOR ITSELF ─────────────────────────────────────────────────────────────────
 *
 * `ActivityReader` lives in `sales-core-entities-server`, and an Angular component must not import a
 * server package — that is the layering, and it is also how a server-only dependency ends up in a
 * browser bundle. The two reads here are the same shape as the reader's, deliberately, so the surface and
 * the API agree about what a timeline is. `deal-workspace.service.ts` reads its own data the same way;
 * there is no shared read layer in this app to reuse.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Metadata, RunQuery, RunView, type IMetadataProvider } from '@memberjunction/core';
import { GraphQLActionClient, type GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
/**
 * The codes come from the SHARED package, not a list retyped here. That is why `activity-vocabulary`
 * moved out of `sales-core-entities-server`: an Angular package must not import a server one, and a
 * second copy of the four codes is exactly the drift this change removes.
 */
import type { ActivityTypeCode } from '@mj-biz-apps/sales-entities';
/** For `<mj-loading>` — the house rule is that spinner and no other. */
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { MJComboboxComponent } from '@memberjunction/ng-ui-components';
import { PARTY_LOOKUP_QUERIES, PartyLookupParamsFor, type PartyOption } from '@mj-biz-apps/common-ng';
import { MJS_ENTITIES } from '../data/entity-names';
import {
    AddPartyChoice,
    ChosenPartiesParam,
    DealPartyChoices,
    type BuyingTeamFields,
    type DealPartyFields,
    type PartyChoice,
    type PartyKind,
} from './deal-activity-parties';

/** Common's entity names. Strings, because sales must not import contracts' or common's classes here. */
const E_ACTIVITY = 'MJ_BizApps_Common: Activities';
const E_ACTIVITY_LINK = 'MJ_BizApps_Common: Activity Links';
const E_DEAL = 'MJ_BizApps_Sales: Deals';

/** The seeded Action this pane calls. Its display Name, which is what `Action.Name` holds. */
const LOG_ACTIVITY_ACTION = 'Log Activity';

/** What the timeline shows for one activity. */
export interface DealActivityRow {
    ID: string;
    TypeName: string;
    Title: string;
    Description: string | null;
    StartedAt: Date | string;
    Direction: string;
    /** Non-null on ingested rows — the badge that says this came from Outlook rather than a person. */
    SourceSystem: string | null;
    Source: string;
}

/** The four codes a person can log by hand. Meetings arrive from the calendar, not from this form. */
const LOGGABLE_CODES: readonly ActivityTypeCode[] = ['Call', 'Meeting', 'Note', 'Email'];

@Component({
    selector: 'mjs-deal-activity-timeline',
    standalone: true,
    imports: [CommonModule, FormsModule, SharedGenericModule, MJComboboxComponent],
    template: `
        <section class="dat">
            <header class="dat__head">
                @if (!ComposeOnly) {
                    <h3 class="dat__title">
                        <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>
                        Activity
                    </h3>
                }
                @if (!Adding) {
                    <button type="button" class="dat__add" (click)="StartAdd()" [disabled]="!DealID">
                        <i class="fa-solid fa-plus" aria-hidden="true"></i> Log activity
                    </button>
                }
            </header>

            @if (Adding) {
                <!--
                  CONFIRM LEFT, CANCEL RIGHT — the house rule. The type list is the four things a person
                  logs by hand; a meeting ingested from a calendar is not entered here.
                -->
                <form class="dat__form" (ngSubmit)="Save()">
                    <label class="dat__field">
                        <span>Type</span>
                        <select [(ngModel)]="DraftTypeCode" name="type">
                            @for (code of Codes; track code) {
                                <option [value]="code">{{ code }}</option>
                            }
                        </select>
                    </label>
                    <label class="dat__field dat__field--wide">
                        <span>Subject</span>
                        <input type="text" [(ngModel)]="DraftTitle" name="title" maxlength="500" />
                    </label>
                    <label class="dat__field dat__field--wide">
                        <span>Notes</span>
                        <textarea [(ngModel)]="DraftNotes" name="notes" rows="3"></textarea>
                    </label>
                    <label class="dat__field">
                        <span>When</span>
                        <input type="datetime-local" [(ngModel)]="DraftWhen" name="when" />
                    </label>
                    <!--
                      WHO IT IS LINKED TO (#408). The deal itself is always linked and is not listed. When the
                      list could not be read, nothing is sent and the server links the account and primary
                      contact as it always has.
                    -->
                    <fieldset class="dat__field dat__field--wide dat__links">
                        <legend>Linked to <span class="dat__hint">(the deal is always linked)</span></legend>
                        @if (PartiesLoading) {
                            <mj-loading></mj-loading>
                        } @else if (!PartiesLoaded) {
                            <p class="dat__hint">The deal's people could not be read, so its account and primary
                                contact will be linked.</p>
                        } @else {
                            @for (party of Parties; track party.Kind + party.RecordID) {
                                <label class="dat__check">
                                    <input type="checkbox" [(ngModel)]="party.Checked"
                                        [name]="'party-' + party.RecordID" />
                                    <i class="fa-solid" [class.fa-building]="party.Kind === 'Organization'"
                                        [class.fa-user]="party.Kind === 'Person'" aria-hidden="true"></i>
                                    {{ party.Name }}
                                    <span class="dat__hint">{{ party.Labels.join(', ') }}</span>
                                </label>
                            }
                            <div class="dat__pickers">
                                <mj-combobox #personPick class="dat__picker" TextField="Name" ValueField="ID"
                                    [Data]="Options.Person" [ValuePrimitive]="true" [Filterable]="false"
                                    Placeholder="Add person: type 2+ characters"
                                    (FilterChange)="Search('Person', $event)"
                                    (ValueChange)="AddParty('Person', $event, personPick)"></mj-combobox>
                                <mj-combobox #orgPick class="dat__picker" TextField="Name" ValueField="ID"
                                    [Data]="Options.Organization" [ValuePrimitive]="true" [Filterable]="false"
                                    Placeholder="Add organization: type 2+ characters"
                                    (FilterChange)="Search('Organization', $event)"
                                    (ValueChange)="AddParty('Organization', $event, orgPick)"></mj-combobox>
                            </div>
                        }
                    </fieldset>
                    @if (Error) {
                        <p class="dat__error">{{ Error }}</p>
                    }
                    <div class="dat__actions">
                        <button type="submit" class="dat__save" [disabled]="Saving || !DraftTitle.trim()">
                            {{ Saving ? 'Saving…' : 'Log it' }}
                        </button>
                        <button type="button" class="dat__cancel" (click)="CancelAdd()" [disabled]="Saving">
                            Cancel
                        </button>
                    </div>
                </form>
            }

            @if (!ComposeOnly && Loading) {
                <mj-loading></mj-loading>
            } @else if (!ComposeOnly && Rows.length === 0) {
                <p class="dat__empty">Nothing logged on this deal yet.</p>
            } @else if (!ComposeOnly) {
                <ol class="dat__list">
                    @for (row of Rows; track row.ID) {
                        <li class="dat__item">
                            <div class="dat__when">{{ row.StartedAt | date: 'medium' }}</div>
                            <div class="dat__body">
                                <div class="dat__row">
                                    <span class="dat__type">{{ row.TypeName }}</span>
                                    <!--
                                      BOTH PROVENANCES ARE MARKED. An ingested activity and a hand-logged
                                      one are different kinds of fact, and marking only one would leave the
                                      other identified by an absence nobody reads.
                                    -->
                                    @if (row.SourceSystem) {
                                        <span class="dat__badge dat__badge--sync"
                                              [title]="'Ingested automatically from ' + row.SourceSystem">
                                            <i class="fa-solid fa-inbox" aria-hidden="true"></i> {{ row.SourceSystem }}
                                        </span>
                                    } @else {
                                        <span class="dat__badge" title="Logged by a person">
                                            <i class="fa-solid fa-pen" aria-hidden="true"></i> logged
                                        </span>
                                    }
                                </div>
                                <div class="dat__subject">{{ row.Title }}</div>
                                @if (row.Description) {
                                    <p class="dat__notes">{{ row.Description }}</p>
                                }
                            </div>
                        </li>
                    }
                </ol>
            }
        </section>
    `,
    styles: [
        `
            .dat { display: flex; flex-direction: column; gap: 12px; }
            .dat__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
            .dat__title {
                display: flex; align-items: center; gap: 8px; margin: 0;
                font-size: 0.9375rem; color: var(--mj-text-primary);
            }
            .dat__add, .dat__save, .dat__cancel {
                border: 1px solid var(--mj-border-default); border-radius: 4px;
                background: var(--mj-bg-surface); color: var(--mj-text-primary);
                padding: 5px 11px; font-size: 0.8125rem; cursor: pointer;
            }
            .dat__save { background: var(--mj-brand-primary); color: var(--mj-brand-on-primary); border-color: var(--mj-brand-primary); }
            .dat__add:disabled, .dat__save:disabled, .dat__cancel:disabled { opacity: 0.55; cursor: default; }
            .dat__form {
                display: flex; flex-wrap: wrap; gap: 10px;
                border: 1px solid var(--mj-border-default); border-radius: 4px;
                padding: 12px; background: var(--mj-bg-surface-sunken);
            }
            .dat__field { display: flex; flex-direction: column; gap: 4px; font-size: 0.75rem; flex: 1 1 160px; }
            .dat__field--wide { flex: 1 1 100%; }
            .dat__field span { color: var(--mj-text-secondary); }
            .dat__field input, .dat__field select, .dat__field textarea {
                border: 1px solid var(--mj-border-default); border-radius: 3px;
                background: var(--mj-bg-surface); color: var(--mj-text-primary);
                padding: 5px 7px; font: inherit; font-size: 0.8125rem;
            }
            .dat__actions { display: flex; gap: 8px; flex: 1 1 100%; }
            .dat__links { border: 0; margin: 0; padding: 0; gap: 6px; }
            .dat__links legend { padding: 0; margin-bottom: 4px; color: var(--mj-text-secondary); }
            .dat__check { display: flex; align-items: center; gap: 6px; font-size: 0.8125rem; color: var(--mj-text-primary); }
            .dat__hint { color: var(--mj-text-muted); font-size: 0.75rem; margin: 0; }
            .dat__pickers { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
            .dat__picker { flex: 1 1 220px; }
            .dat__error { flex: 1 1 100%; margin: 0; color: var(--mj-status-error); font-size: 0.8125rem; }
            .dat__empty { margin: 0; color: var(--mj-text-muted); font-size: 0.8125rem; }
            .dat__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
            .dat__item {
                display: flex; gap: 12px;
                border-left: 2px solid var(--mj-border-default); padding-left: 12px;
            }
            .dat__when {
                flex: 0 0 auto; font-size: 0.75rem; color: var(--mj-text-muted);
                font-variant-numeric: tabular-nums; min-width: 11ch;
            }
            .dat__body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
            .dat__row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
            .dat__type { font-size: 0.75rem; color: var(--mj-text-secondary); text-transform: uppercase; letter-spacing: 0.06em; }
            .dat__badge { font-size: 0.6875rem; color: var(--mj-text-muted); display: inline-flex; align-items: center; gap: 4px; }
            .dat__badge--sync { color: var(--mj-brand-primary); }
            .dat__subject { font-size: 0.875rem; color: var(--mj-text-primary); }
            .dat__notes { margin: 0; font-size: 0.8125rem; color: var(--mj-text-secondary); white-space: pre-wrap; }
        `,
    ],
})
export class DealActivityTimelineComponent {
    private readonly cdr = inject(ChangeDetectorRef);
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

    /**
     * When true, only the compose form is shown — the list is owned by `mj-entity-viewer`
     * on the Deal form Activity section.
     */
    @Input() public ComposeOnly = false;

    /** Setting this loads the timeline. Null means no deal is open, so there is nothing to show. */
    @Input()
    public set DealID(value: string | null) {
        this.dealID = value;
        queueMicrotask(() => {
            if (!this.ComposeOnly) void this.Load();
        });
    }
    public get DealID(): string | null {
        return this.dealID;
    }
    private dealID: string | null = null;

    /** Raised after a successful log, so a host can refresh anything that counts activities. */
    @Output() public readonly Logged = new EventEmitter<string>();

    public Rows: DealActivityRow[] = [];
    public Loading = false;
    public Adding = false;
    public Saving = false;
    public Error: string | null = null;

    public readonly Codes = LOGGABLE_CODES;
    public DraftTypeCode: string = 'Call';
    public DraftTitle = '';
    public DraftNotes = '';
    public DraftWhen = '';

    /** The compose checklist (#408). Sent only when it loaded, so a failed read falls back to the server's choice. */
    public Parties: PartyChoice[] = [];
    public PartiesLoading = false;
    public PartiesLoaded = false;
    public Options: Record<PartyKind, PartyOption[]> = { Person: [], Organization: [] };
    /** Drops a search answer that arrives after a newer one was asked. */
    private searchSeq: Record<PartyKind, number> = { Person: 0, Organization: 0 };

    public StartAdd(): void {
        this.Adding = true;
        this.Error = null;
        this.DraftTitle = '';
        this.DraftNotes = '';
        this.DraftTypeCode = 'Call';
        /**
         * Prefilled with NOW, in the local zone, because `datetime-local` has no zone and a browser will
         * not accept a UTC string here. It is converted back on save — everything persisted is UTC.
         */
        this.DraftWhen = localInputValue(new Date());
        this.cdr.detectChanges();
        void this.loadParties();
    }

    /** The deal's account, contacts and buying team, read as the caller: one `RunViews` round trip. */
    private async loadParties(): Promise<void> {
        this.Parties = [];
        this.PartiesLoaded = false;
        this.PartiesLoading = true;
        this.cdr.detectChanges();
        try {
            const id = escape(this.dealID ?? '');
            const [deal, team] = await new RunView().RunViews([
                {
                    EntityName: E_DEAL,
                    ExtraFilter: `ID = '${id}'`,
                    Fields: ['AccountID', 'Account', 'PrimaryContactID', 'PrimaryContact', 'BillingContactID', 'BillingContact'],
                    ResultType: 'simple',
                },
                {
                    EntityName: MJS_ENTITIES.DealContactRole,
                    ExtraFilter: `DealID = '${id}'`,
                    Fields: ['SalesContactID', 'SalesContact', 'BuyingRoleType'],
                    ResultType: 'simple',
                },
            ]);
            if (!deal?.Success || !team?.Success) {
                console.error('Deal activity: could not read the deal parties', deal?.ErrorMessage, team?.ErrorMessage);
                return;
            }
            this.Parties = DealPartyChoices(
                (deal.Results?.[0] as DealPartyFields | undefined) ?? null,
                (team.Results ?? []) as BuyingTeamFields[],
            );
            this.PartiesLoaded = true;
        } catch (err) {
            console.error('Deal activity: could not read the deal parties', err);
        } finally {
            this.PartiesLoading = false;
            this.cdr.detectChanges();
        }
    }

    /**
     * The search the deal form's own party fields run (common's lookup queries), so "Add person" finds
     * the same people the Primary contact field does.
     */
    public async Search(kind: PartyKind, text: string): Promise<void> {
        const seq = ++this.searchSeq[kind];
        const params = PartyLookupParamsFor(kind, text);
        if (!params) {
            this.Options = { ...this.Options, [kind]: [] };
            this.cdr.detectChanges();
            return;
        }
        const parameters: Record<string, string> = { Term: params.Term };
        if (params.Domain) parameters['Domain'] = params.Domain;
        const result = await new RunQuery().RunQuery({ ...PARTY_LOOKUP_QUERIES[kind], Parameters: parameters });
        if (seq !== this.searchSeq[kind]) return;
        if (!result.Success) {
            console.error(`Deal activity: ${kind} search failed`, result.ErrorMessage);
        }
        const rows = (result.Success ? result.Results : []) as PartyOption[];
        this.Options = { ...this.Options, [kind]: rows };
        this.cdr.detectChanges();
    }

    public AddParty(kind: PartyKind, value: unknown, picker: MJComboboxComponent): void {
        const id = typeof value === 'string' ? value : null;
        if (!id) return;
        const name = this.Options[kind].find((o) => o.ID === id)?.Name ?? id;
        this.Parties = AddPartyChoice(this.Parties, kind, id, name);
        /**
         * Cleared after the combobox finishes its own selection, so it is ready for the next one. Reset
         * through `writeValue`, not an ngModel binding: a model that goes null -> ID -> null inside one
         * change-detection pass never reaches the control, and the box was left showing the raw ID.
         */
        void Promise.resolve().then(() => {
            picker.writeValue(null);
            this.Options = { ...this.Options, [kind]: [] };
            this.cdr.detectChanges();
        });
    }

    /**
     * Opens the compose form if it is closed, scrolls it into view and puts the cursor in its title. For
     * a host whose own New button should log an activity here, such as the deal form's Activity grid.
     * A draft already in progress is kept.
     */
    public FocusCompose(): void {
        if (!this.Adding) {
            this.StartAdd();
        }
        const form = this.host.nativeElement.querySelector('.dat__form');
        form?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        form?.querySelector<HTMLInputElement>('input[name="title"]')?.focus();
    }

    public CancelAdd(): void {
        this.Adding = false;
        this.Error = null;
        this.cdr.detectChanges();
    }

    /**
     * Logs the activity by calling `Sales.LogActivity`. This component composes NOTHING.
     *
     * ── WHAT THIS REPLACED, AND WHY IT WAS NOT A MISSING FIELD ──
     *
     * The previous version wrote the `Activity` and its `ActivityLink` here, by hand. It never set
     * `LoggedByUserID`, which is NOT NULL with no default, so **every attempt to log an activity from
     * this pane failed at the database** with a raw constraint error the rep could do nothing with. The
     * feature had never worked.
     *
     * Adding the field would have fixed the error and left the real defect: two independent saves, so a
     * link failure committed an activity no surface could ever reach, and a second copy of a composition
     * that `ActivityWriterService`'s own header had already predicted would drift. It drifted in exactly
     * the way that header warned about.
     *
     * So the composition is gone from here. The service stamps the user, resolves the deal's account and
     * primary contact as participants, and wraps the activity and every link in ONE transaction — which
     * a browser cannot open at all, and which is the strongest reason this could never have been correct
     * client-side.
     *
     * ── WHY AN ACTION CALL AND NOT A REMOTE OPERATION ──
     *
     * `GraphQLActionClient.RunAction` is the browser-reachable path, and the one MJ's own
     * `interactive-form-apply.service.ts` uses. A remote operation would read better beside
     * `Sales.CloseDeal`, but operation shells are CodeGen output and CodeGen is not run here to close a
     * gap — see `docs/CODEGEN-PARTIAL-RUNS.md`.
     */
    public async Save(): Promise<void> {
        if (!this.dealID || !this.DraftTitle.trim()) {
            return;
        }
        this.Saving = true;
        this.Error = null;
        this.cdr.detectChanges();

        try {
            const provider = Metadata.Provider;
            const client = this.actionClient(provider);
            if (!client) {
                this.Error = 'Activities cannot be logged from this page, because it is not connected to the server. Reload the page and try again.';
                return;
            }

            const actionID = await this.logActivityActionID(provider);
            if (!actionID) {
                this.Error =
                    'The Log Activity action is not installed in this deployment. Ask an administrator to '
                    + 'load the Sales app\'s metadata (run `mj sync push --dir metadata`).';
                return;
            }

            const result = await client.RunAction(actionID, [
                { Name: 'DealID', Value: this.dealID, Type: 'Input' },
                { Name: 'TypeCode', Value: this.DraftTypeCode, Type: 'Input' },
                { Name: 'Title', Value: this.DraftTitle.trim(), Type: 'Input' },
                { Name: 'Notes', Value: this.DraftNotes.trim(), Type: 'Input' },
                /**
                 * SENT AS AN INSTANT, not as the `datetime-local` text. That input carries no zone, so
                 * handing its string to the server would have it read in the server's zone — everything
                 * stored here is UTC and the shift would be invisible.
                 */
                {
                    Name: 'StartedAt',
                    Value: (this.DraftWhen ? new Date(this.DraftWhen) : new Date()).toISOString(),
                    Type: 'Input',
                },
                ...(this.PartiesLoaded
                    ? [{ Name: 'Parties', Value: ChosenPartiesParam(this.Parties), Type: 'Input' as const }]
                    : []),
            ]);

            if (result?.Success !== true) {
                /**
                 * The action's own message is shown verbatim. It names the actual refusal — a bad type
                 * code, an unreadable date, a missing deal — which is worth more to a rep than anything
                 * this component could paraphrase.
                 */
                this.Error = actionMessage(result) ?? 'The activity could not be logged.';
                return;
            }

            this.Adding = false;
            this.Logged.emit(this.dealID);
            await this.Load();
        } catch (err) {
            this.Error = `The activity could not be logged: ${String(err)}`;
        } finally {
            this.Saving = false;
            this.cdr.detectChanges();
        }
    }

    /**
     * The action client, or null when this provider cannot reach one.
     *
     * Duck-checked on `ExecuteGQL` rather than by `instanceof`: the provider is typed as
     * `IMetadataProvider` and only the GraphQL one can run an action, so the test has to be about the
     * capability rather than the class.
     */
    private actionClient(provider: IMetadataProvider): GraphQLActionClient | null {
        const gql = provider as unknown as GraphQLDataProvider;
        if (typeof (gql as { ExecuteGQL?: unknown })?.ExecuteGQL !== 'function') {
            return null;
        }
        return new GraphQLActionClient(gql);
    }

    /**
     * Resolve the action's ID by NAME, with a RunView against `MJ: Actions`.
     *
     * THIS READ `provider.Actions` AND THAT PROPERTY DOES NOT EXIST. `IMetadataProvider` exposes no
     * `Actions` member, so the cast produced `undefined`, `?? []` turned that into an empty array, and
     * the lookup returned null on every call. The component then reported
     *
     *     The Log Activity action is not installed in this deployment.
     *
     * which is a specific, actionable and completely wrong diagnosis: measured 2026-08-25, the action
     * row is present, Active, in the Sales category, with DriverClass Sales.LogActivity, and identical
     * to the row on a freshly seeded database. Anyone following that message ran `mj sync push` -- as I
     * did -- and changed nothing, because nothing was missing. `?? []` is what made a missing property
     * indistinguishable from a missing row.
     *
     * The pattern here is MJ's own, from `interactive-form-apply.service.ts`, the same service this
     * component's docblock already cites for using GraphQLActionClient: "Falls back to a direct RunView
     * against the Action entity when ActionEngine isn't loaded." ActionEngineBase would also work, but
     * it needs Config() and is not initialised on this surface -- which is precisely the case MJ's
     * fallback exists for.
     */
    private async logActivityActionID(provider: IMetadataProvider): Promise<string | null> {
        try {
            const rv = RunView.FromMetadataProvider(provider);
            const result = await rv.RunView({
                EntityName: 'MJ: Actions',
                ExtraFilter: `Name='${LOG_ACTIVITY_ACTION.replace(/'/g, "''")}'`,
                Fields: ['ID'],
                MaxRows: 1,
                ResultType: 'simple',
            });
            return result.Success ? ((result.Results?.[0] as { ID?: string })?.ID ?? null) : null;
        } catch {
            return null;
        }
    }

    /** Newest first, by when it HAPPENED rather than when it was filed. */
    public async Load(): Promise<void> {
        if (this.ComposeOnly) {
            this.Rows = [];
            this.cdr.detectChanges();
            return;
        }
        if (!this.dealID) {
            this.Rows = [];
            this.cdr.detectChanges();
            return;
        }
        this.Loading = true;
        this.cdr.detectChanges();

        try {
            const md = new Metadata();
            if (!md.Entities.some((e) => e.Name === E_ACTIVITY)) {
                // Common is not installed here. An empty timeline says that perfectly well.
                this.Rows = [];
                return;
            }
            const dealEntityID = md.Entities.find((e) => e.Name === E_DEAL)?.ID;
            if (!dealEntityID) {
                this.Rows = [];
                return;
            }

            const anchors = await new RunView().RunView<{ ActivityID: string }>({
                EntityName: E_ACTIVITY_LINK,
                ExtraFilter: `EntityID = '${escape(dealEntityID)}' AND RecordID = '${escape(this.dealID)}'`,
                ResultType: 'simple',
                Fields: ['ActivityID'],
            });
            const ids = anchors.Success
                ? [...new Set((anchors.Results ?? []).map((r) => String(r.ActivityID)))]
                : [];
            if (ids.length === 0) {
                this.Rows = [];
                return;
            }

            const list = ids.map((id) => `'${escape(id)}'`).join(', ');
            const found = await new RunView().RunView<DealActivityRow & { ActivityType: string | null }>({
                EntityName: E_ACTIVITY,
                ExtraFilter: `ID IN (${list})`,
                OrderBy: 'StartedAt DESC',
                ResultType: 'simple',
            });
            this.Rows = (found.Success ? (found.Results ?? []) : []).map((row) => ({
                ID: row.ID,
                TypeName: row.ActivityType ?? '—',
                Title: row.Title,
                Description: row.Description ?? null,
                StartedAt: row.StartedAt,
                Direction: row.Direction,
                SourceSystem: row.SourceSystem ?? null,
                Source: row.Source,
            }));
        } finally {
            this.Loading = false;
            this.cdr.detectChanges();
        }
    }

}

function escape(value: string): string {
    return String(value).replace(/'/g, "''");
}

/** A `Date` as `datetime-local` wants it: local wall time, no zone, minutes precision. */
function localInputValue(when: Date): string {
    const pad = (n: number): string => String(n).padStart(2, '0');
    return (
        `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`
        + `T${pad(when.getHours())}:${pad(when.getMinutes())}`
    );
}

/**
 * The message off an action result, whatever shape it came back in.
 *
 * `ActionResult` does not expose `Message` or `ResultCode` at the top level — MJ's own caller reaches
 * through `Result` for the code — so this reads defensively rather than asserting a shape that is not
 * guaranteed. Returning null lets the caller supply its own fallback rather than showing "undefined".
 */
function actionMessage(result: unknown): string | null {
    const r = result as { Message?: string; Result?: { Message?: string; ResultCode?: string } } | null;
    return r?.Message ?? r?.Result?.Message ?? r?.Result?.ResultCode ?? null;
}

