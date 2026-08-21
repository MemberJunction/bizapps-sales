/**
 * @fileoverview S-US9's surface — a deal's activities in chronological order, plus logging one.
 *
 * ── WHY THIS IS NOT A WORKSPACE PANE ────────────────────────────────────────────────────────────
 *
 * `DEAL_WORKSPACE_PANES` keys are `DealWorkspaceSection` values, and that union is what
 * `ProjectValidation()` tags issues with so a pane can badge its own error count. An activity timeline
 * has no validation state — it is a record of what happened, not a part of the draft being composed — so
 * adding `'activity'` to that union would mean widening a type the whole validation layer reads in order
 * to describe a section that can never carry an issue.
 *
 * It is a standalone component instead, which also keeps the merge surface to one line in the
 * workspace template. That was a constraint worth designing around rather than working against: another
 * instance is editing `deal-workspace.*` in the same window.
 *
 * ── AND WHY IT READS FOR ITSELF ─────────────────────────────────────────────────────────────────
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
import { ChangeDetectorRef, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Metadata, RunView, type IMetadataProvider } from '@memberjunction/core';
import { GraphQLActionClient, type GraphQLDataProvider } from '@memberjunction/graphql-dataprovider';
/**
 * The codes come from the SHARED package, not a list retyped here. That is why `activity-vocabulary`
 * moved out of `sales-core-entities-server`: an Angular package must not import a server one, and a
 * second copy of the four codes is exactly the drift this change removes.
 */
import type { ActivityTypeCode } from '@mj-biz-apps/sales-entities';
/** For `<mj-loading>` — the house rule is that spinner and no other. */
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';

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
    imports: [CommonModule, FormsModule, SharedGenericModule],
    template: `
        <section class="dat">
            <header class="dat__head">
                <h3 class="dat__title">
                    <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>
                    Activity
                </h3>
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

            @if (Loading) {
                <mj-loading></mj-loading>
            } @else if (Rows.length === 0) {
                <p class="dat__empty">Nothing logged on this deal yet.</p>
            } @else {
                <ol class="dat__list">
                    @for (row of Rows; track row.ID) {
                        <li class="dat__item">
                            <div class="dat__when">{{ row.StartedAt | date: 'medium' : 'UTC' }}</div>
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
                border: 1px solid var(--mj-border-color); border-radius: 4px;
                background: var(--mj-surface-raised); color: var(--mj-text-primary);
                padding: 5px 11px; font-size: 0.8125rem; cursor: pointer;
            }
            .dat__save { background: var(--mj-accent-primary); color: var(--mj-text-inverse); border-color: transparent; }
            .dat__add:disabled, .dat__save:disabled, .dat__cancel:disabled { opacity: 0.55; cursor: default; }
            .dat__form {
                display: flex; flex-wrap: wrap; gap: 10px;
                border: 1px solid var(--mj-border-color); border-radius: 4px;
                padding: 12px; background: var(--mj-surface-sunken);
            }
            .dat__field { display: flex; flex-direction: column; gap: 4px; font-size: 0.75rem; flex: 1 1 160px; }
            .dat__field--wide { flex: 1 1 100%; }
            .dat__field span { color: var(--mj-text-secondary); }
            .dat__field input, .dat__field select, .dat__field textarea {
                border: 1px solid var(--mj-border-color); border-radius: 3px;
                background: var(--mj-surface-raised); color: var(--mj-text-primary);
                padding: 5px 7px; font: inherit; font-size: 0.8125rem;
            }
            .dat__actions { display: flex; gap: 8px; flex: 1 1 100%; }
            .dat__error { flex: 1 1 100%; margin: 0; color: var(--mj-status-error); font-size: 0.8125rem; }
            .dat__empty { margin: 0; color: var(--mj-text-muted); font-size: 0.8125rem; }
            .dat__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
            .dat__item {
                display: flex; gap: 12px;
                border-left: 2px solid var(--mj-border-color); padding-left: 12px;
            }
            .dat__when {
                flex: 0 0 auto; font-size: 0.75rem; color: var(--mj-text-muted);
                font-variant-numeric: tabular-nums; min-width: 11ch;
            }
            .dat__body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
            .dat__row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
            .dat__type { font-size: 0.75rem; color: var(--mj-text-secondary); text-transform: uppercase; letter-spacing: 0.06em; }
            .dat__badge { font-size: 0.6875rem; color: var(--mj-text-muted); display: inline-flex; align-items: center; gap: 4px; }
            .dat__badge--sync { color: var(--mj-accent-primary); }
            .dat__subject { font-size: 0.875rem; color: var(--mj-text-primary); }
            .dat__notes { margin: 0; font-size: 0.8125rem; color: var(--mj-text-secondary); white-space: pre-wrap; }
        `,
    ],
})
export class DealActivityTimelineComponent {
    private readonly cdr = inject(ChangeDetectorRef);

    /** Setting this loads the timeline. Null means no deal is open, so there is nothing to show. */
    @Input()
    public set DealID(value: string | null) {
        this.dealID = value;
        void this.Load();
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
                this.Error = 'Logging an activity needs a GraphQL connection, which this session does not have.';
                return;
            }

            const actionID = this.logActivityActionID(provider);
            if (!actionID) {
                this.Error =
                    'The Log Activity action is not installed in this deployment. It is seeded from '
                    + 'metadata/actions/; run `mj sync push --dir metadata`.';
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

    /** `RunAction` takes an ID, so the name is resolved from metadata the provider already holds. */
    private logActivityActionID(provider: IMetadataProvider): string | null {
        const actions = (provider as unknown as { Actions?: { ID: string; Name: string }[] }).Actions ?? [];
        return actions.find((a) => a.Name === LOG_ACTIVITY_ACTION)?.ID ?? null;
    }

    /** Newest first, by when it HAPPENED rather than when it was filed. */
    public async Load(): Promise<void> {
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

