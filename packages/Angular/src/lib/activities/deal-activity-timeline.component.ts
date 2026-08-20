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
import { Metadata, RunView } from '@memberjunction/core';
/** For `<mj-loading>` — the house rule is that spinner and no other. */
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';

/** Common's entity names. Strings, because sales must not import contracts' or common's classes here. */
const E_ACTIVITY = 'MJ_BizApps_Common: Activities';
const E_ACTIVITY_LINK = 'MJ_BizApps_Common: Activity Links';
const E_ACTIVITY_TYPE = 'MJ_BizApps_Common: Activity Types';
const E_DEAL = 'MJ_BizApps_Sales: Deals';

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
const LOGGABLE_CODES = ['Call', 'Meeting', 'Note', 'Email'] as const;

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
     * Writes one activity and its deal link.
     *
     * ── THE DUPLICATION HERE IS DELIBERATE AND BOUNDED ──
     *
     * `ActivityWriterService` is the canonical composition and it is server-side. A browser cannot call
     * it, and an Angular package importing a server one would put server code in the bundle. So this
     * writes the same two records the service writes — an `Activity` and its `Regarding` link — and
     * NOTHING ELSE: no party links, no external key, no dedupe. Those are the parts that need the deal's
     * account and contact resolved, and the parts the ingest depends on being exactly right.
     *
     * The honest reading is that this is the manual path's minimum, and a remote operation wrapping the
     * writer would let the browser use the real composition. Recorded as D-22 rather than half-built.
     */
    public async Save(): Promise<void> {
        if (!this.dealID || !this.DraftTitle.trim()) {
            return;
        }
        this.Saving = true;
        this.Error = null;
        this.cdr.detectChanges();

        try {
            const md = new Metadata();
            const typeID = await this.resolveTypeCode(this.DraftTypeCode);
            if (!typeID) {
                this.Error = `No activity type with code '${this.DraftTypeCode}' exists in this deployment.`;
                return;
            }

            const activity = await md.GetEntityObject(E_ACTIVITY);
            activity.NewRecord();
            activity.Set('ActivityTypeID', typeID);
            activity.Set('Title', this.DraftTitle.trim());
            activity.Set('StartedAt', this.DraftWhen ? new Date(this.DraftWhen) : new Date());
            activity.Set('Description', this.DraftNotes.trim() || null);
            activity.Set('Direction', 'Internal');
            activity.Set('Status', 'Logged');
            activity.Set('Visibility', 'Internal');
            activity.Set('Source', 'Manual');
            if (!(await activity.Save())) {
                this.Error = activity.LatestResult?.CompleteMessage ?? 'The activity could not be saved.';
                return;
            }

            const dealEntityID = md.Entities.find((e) => e.Name === E_DEAL)?.ID;
            if (!dealEntityID) {
                this.Error = 'The Deals entity is not registered, so the activity could not be linked.';
                return;
            }
            const link = await md.GetEntityObject(E_ACTIVITY_LINK);
            link.NewRecord();
            link.Set('ActivityID', activity.Get('ID'));
            link.Set('Role', 'Regarding');
            link.Set('EntityID', dealEntityID);
            link.Set('RecordID', this.dealID);
            link.Set('Sequence', 1);
            if (!(await link.Save())) {
                this.Error = 'The activity was saved but could not be linked to the deal.';
                return;
            }

            this.Adding = false;
            this.Logged.emit(String(activity.Get('ID')));
            await this.Load();
        } catch (err) {
            this.Error = `The activity could not be logged: ${String(err)}`;
        } finally {
            this.Saving = false;
            this.cdr.detectChanges();
        }
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

    /** The type row for a code. By CODE, never by the display name — see the vocabulary rule. */
    private async resolveTypeCode(code: string): Promise<string | null> {
        const r = await new RunView().RunView<{ ID: string }>({
            EntityName: E_ACTIVITY_TYPE,
            ExtraFilter: `Code = '${escape(code)}'`,
            ResultType: 'simple',
            Fields: ['ID'],
        });
        return r.Success ? ((r.Results ?? [])[0]?.ID ?? null) : null;
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
