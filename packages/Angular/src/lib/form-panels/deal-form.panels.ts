/**
 * @fileoverview Deal form body — Overview plus organized rail sections.
 *
 * Replaces the generated `details` dump (one accordion of every column) with:
 *   Overview (exec briefing) · Pipeline · Account · Commercial · What's being sold
 *   Motion · Close · Internal team · Buying team · Activity · Stage history · Payment schedule
 *
 * `replacesSectionKey: 'details'` hides the generated field list. `contributionKey` equals each
 * panel's `SectionKey` so left-nav rail items attach. Overview is the only `inclusion: 'Primary'`
 * so it leads; the rest sort into the related band by `sortKey` (descending).
 *
 * @module @mj-biz-apps/sales-ng
 */
import { ChangeDetectorRef, Component, ViewChild, ViewEncapsulation, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompositeKey, Metadata, RunView, type EntityInfo } from '@memberjunction/core';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseFormPanel, BaseFormsModule, ExplorerEntityDataGridComponent } from '@memberjunction/ng-base-forms';
import {
    EntityViewerModule,
    type AfterDataLoadEventArgs,
    type AfterRowDoubleClickEventArgs,
    type RecordOpenedEvent,
} from '@memberjunction/ng-entity-viewer';
import {
    DealEntity,
    IsDealFieldEditableWhileLocked,
    LoadDealStatusOptions,
    type DealStatusOption,
    type SalesCloseDealInput,
    type SalesCloseDealOutput,
    type SalesReopenDealInput,
    type SalesReopenDealOutput,
} from '@mj-biz-apps/sales-entities';
import { DealActivityTimelineComponent } from '../activities/deal-activity-timeline.component';
import { SyntheticActivityView } from '../pages/deal-views';
import { MJS_ENTITIES, MJS_FOREIGN_ENTITIES } from '../data/entity-names';
import { MJSDealLineEditorComponent } from './deal-line-editor.component';

const E = MJS_ENTITIES.Deal;

/** Sales' loss-reason table. Named here so the close action has one spelling of it. */
const E_LOSS_REASON = 'MJ_BizApps_Sales: Loss Reasons';

/** One pickable loss reason, with the flag that decides whether notes are mandatory. */
export interface LossReasonOption {
    ID: string;
    Name: string;
    RequiresNotes: boolean;
}

/**
 * The loss reasons a close may cite.
 *
 * Loaded even on a deal nobody will lose, because the alternative is fetching inside the click
 * handler: an empty dropdown then fails as a TIMEOUT rather than as a missing list, which is a slow
 * way to find out the table was never seeded.
 */
async function LoadLossReasons(): Promise<LossReasonOption[]> {
    const result = await new RunView().RunView<{ ID: string; Name: string; RequiresNotes: boolean }>({
        EntityName: E_LOSS_REASON,
        ExtraFilter: 'IsActive = 1',
        // DisplayRank first, matching `deal-workspace.service.ts` — the column exists precisely so an
        // admin can order this list, and sorting by Name alone silently ignored what they set.
        OrderBy: 'DisplayRank ASC, Name ASC',
        ResultType: 'simple',
        Fields: ['ID', 'Name', 'RequiresNotes'],
    });
    if (!result?.Success) return [];
    return (result.Results ?? []).map((r) => ({
        ID: String(r.ID),
        Name: String(r.Name),
        RequiresNotes: r.RequiresNotes === true,
    }));
}

/**
 * `RouteOperation` is on the SQL Server / GraphQL provider, not on the `IMetadataProvider` interface
 * `Metadata.Provider` is declared as, so it has to be narrowed. Declared as a precise shape rather
 * than reached for with a loose cast, so the operation's input and output stay type-checked — which
 * is the whole value of calling a typed operation.
 */
interface DealCloseOperationRouter {
    RouteOperation<TInput, TOutput>(
        operationKey: string,
        input: TInput,
    ): Promise<{ Success: boolean; Output?: TOutput; ErrorMessage?: string }>;
}

/** What a surface needs back from a close or a reopen, without either of them re-deriving it. */
interface ReopenOutcome {
    ok: boolean;
    message: string;
    issues: string[];
}

/**
 * `Sales.ReopenDeal`, called in ONE place.
 *
 * Two surfaces reach the reopen now -- the Status control (golive#205 D9: "Changing Deal Status from
 * Won or Lost back to Open should reopen the deal") and the Close panel's button. A second copy of the
 * envelope-versus-Output handling is exactly the drift the review found between this form and the deal
 * workspace, so there is one.
 *
 * TWO LAYERS OF SUCCESS. `Success` on the envelope means the operation RAN; whether the deal reopened
 * is `Output.Success`. And a SUCCESSFUL reopen still carries issues worth showing: S-US8 reopens behind
 * an order orders treats as terminal, and that list is the only thing between the rep and a live deal
 * pointing at a dead order.
 */
/**
 * Whether a close has everything `Sales.CloseDeal` will demand of it.
 *
 * ONE RULE, because two surfaces ask it now -- the Status field and the Close panel's button. A second
 * copy would drift on exactly the condition that is easy to forget: `RequiresNotes` is a per-reason
 * flag, so "a loss reason was chosen" is not the same question as "this close is complete".
 *
 * Not a second enforcement. The operation validates the same things and is the one that matters, since
 * an import or an agent never comes through either surface. This only spares the round trip.
 */
function CloseDetailComplete(
    target: DealStatusOption | null,
    lossReasonID: string | null,
    lossNotes: string,
    reasons: LossReasonOption[],
): boolean {
    if (!target) return false;
    if (!target.IsLost) return true;
    if (!lossReasonID) return false;
    const needsNotes = reasons.find((r) => r.ID === lossReasonID)?.RequiresNotes === true;
    return !needsNotes || lossNotes.trim().length > 0;
}

/** What a close needs from whichever surface collected it. */
interface CloseRequest {
    dealID: string;
    target: DealStatusOption;
    lossReasonID: string | null;
    lossNotes: string;
    notes: string;
}

/**
 * `Sales.CloseDeal`, called in ONE place, for the same reason `RunReopen` is.
 *
 * Two surfaces reach the close: picking a closing status on the Status field (golive#205: "Changing
 * Deal Status to Won or Lost should close the deal properly") and the Close panel's button. The
 * envelope-versus-Output split is the mistake this repo has made before, and it should exist once.
 */
async function RunClose(req: CloseRequest): Promise<ReopenOutcome> {
    try {
        const router = Metadata.Provider as unknown as DealCloseOperationRouter;
        const envelope = await router.RouteOperation<SalesCloseDealInput, SalesCloseDealOutput>(
            'Sales.CloseDeal',
            {
                DealID: req.dealID,
                DealStatusTypeID: req.target.ID,
                LossReasonID: req.target.IsLost ? req.lossReasonID : null,
                LossNotes: req.target.IsLost ? (req.lossNotes.trim() || null) : null,
                Notes: req.notes.trim() || null,
            },
        );
        if (!envelope.Success) {
            return { ok: false, message: envelope.ErrorMessage ?? 'Sales.CloseDeal could not be reached.', issues: [] };
        }
        const out = envelope.Output;
        if (!out?.Success) {
            const issues = (out?.Issues ?? []).map((i) => i.Message);
            return { ok: false, message: issues[0] ?? 'The deal could not be closed.', issues };
        }
        // WARNINGS ON A SUCCESSFUL CLOSE are the interesting ones -- a stubbed downstream, a finance
        // task that could not be routed, an order status orders refused. Reporting only failures would
        // call a half-done close clean.
        return {
            ok: true,
            message: `Deal closed as ${req.target.Name}.`,
            issues: (out.Issues ?? []).map((i) => i.Message),
        };
    } catch (err) {
        return {
            ok: false,
            message: `The close did not complete: ${err instanceof Error ? err.message : String(err)}`,
            issues: [],
        };
    }
}

/**
 * The reason a reopen is recorded under: what the user wrote, or a statement of what they did.
 *
 * ── WHY IT IS NOT REQUIRED, AND STILL ALWAYS PRESENT ────────────────────────────────────────────
 *
 * golive#205 asks for it in so many words: "No reopen reason should be required in this path." Master
 * plan 7.3 says the opposite for the OPERATION -- undoing a lock has to be explainable -- and
 * `Sales.ReopenDeal` refuses a blank one, which `close-deal.CD10` pins.
 *
 * Both hold, because they are not actually about the same thing. 7.3 is about the audit trail; #205 is
 * about whether a person is made to type before the button works. So nobody is prompted, and nothing
 * lands unexplained: this supplies a sentence stating how the deal was reopened and into what, which
 * is what someone reading that trail in six months wants to know and the one thing this code can say
 * truthfully without asking.
 *
 * ── WHY IT IS MODULE-LEVEL ─────────────────────────────────────────────────────────────────────
 *
 * TWO panels offer a reopen -- the Close section's explicit button and the Pipeline section's status
 * picker -- and they had different rules for the same operation on the same form: one demanded a
 * reason, the other did not. Two copies of a rule drift, and the drift here was already visible to a
 * user as "the button works over there and not over here."
 */
export function ReopenReasonOrDefault(typed: string, targetStatusName: string | null): string {
    const written = typed.trim();
    if (written) return written;
    const target = targetStatusName?.trim();
    return target
        ? `Reopened from the deal form by setting the status to ${target}. No reason was given.`
        : 'Reopened from the deal form. No reason was given.';
}

async function RunReopen(dealID: string, reason: string, targetStatusID: string | null): Promise<ReopenOutcome> {
    try {
        const router = Metadata.Provider as unknown as DealCloseOperationRouter;
        const envelope = await router.RouteOperation<SalesReopenDealInput, SalesReopenDealOutput>(
            'Sales.ReopenDeal',
            { DealID: dealID, Reason: reason.trim(), DealStatusTypeID: targetStatusID },
        );
        if (!envelope.Success) {
            return { ok: false, message: envelope.ErrorMessage ?? 'Sales.ReopenDeal could not be reached.', issues: [] };
        }
        const out = envelope.Output;
        if (!out?.Success) {
            const issues = (out?.Issues ?? []).map((i) => i.Message);
            return { ok: false, message: issues[0] ?? 'The deal could not be reopened.', issues };
        }
        return {
            ok: true,
            message: 'Deal reopened. The close event remains in its history.',
            issues: (out.Issues ?? []).map((i) => i.Message),
        };
    } catch (err) {
        return {
            ok: false,
            message: `The reopen did not complete: ${err instanceof Error ? err.message : String(err)}`,
            issues: [],
        };
    }
}

const CLOSE_ACTION_STYLES = `
    .mjs-close-action {
        padding: var(--mj-space-4) var(--mj-space-5);
        border-bottom: 1px solid var(--mj-border-default);
        display: flex; flex-direction: column; gap: var(--mj-space-3);
    }
    .mjs-close-action__start {
        align-self: flex-start; cursor: pointer;
        padding: 6px 14px; border-radius: var(--mj-radius-sm);
        border: 1px solid var(--mj-border-default); background: var(--mj-bg-surface-card);
        font-weight: 600;
    }
    .mjs-close-action__start:hover { background: var(--mj-bg-surface-hover); }
    .mjs-close-action__hint { color: var(--mj-text-muted); font-size: 0.78rem; }
    .mjs-close-action__form { display: flex; flex-direction: column; gap: var(--mj-space-3); max-width: 520px; }
    .mjs-close-action__row { display: flex; gap: var(--mj-space-4); align-items: center; }
    .mjs-close-action__field { display: flex; flex-direction: column; gap: 4px; }
    .mjs-close-action__field > span { font-size: 0.78rem; color: var(--mj-text-muted); }
    .mjs-close-action__confirm {
        cursor: pointer; padding: 6px 14px; border-radius: var(--mj-radius-sm);
        border: 1px solid var(--mj-brand-primary); background: var(--mj-brand-primary); color: var(--mj-text-on-brand);
        font-weight: 600;
    }
    .mjs-close-action__confirm:disabled { opacity: 0.5; cursor: not-allowed; }
    .mjs-close-action__cancel {
        cursor: pointer; padding: 6px 14px; border-radius: var(--mj-radius-sm);
        border: 1px solid var(--mj-border-default); background: transparent;
    }
    .mjs-close-action__msg { font-size: 0.82rem; color: var(--mj-status-success); }
    .mjs-close-action__msg.is-error { color: var(--mj-status-warning); font-weight: 500; }
    .mjs-close-action__issue { font-size: 0.78rem; color: var(--mj-status-warning); }
`;

function money(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    return Number(n).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function daysFrom(d: Date | string | null | undefined): number | null {
    if (!d) return null;
    const iso = d instanceof Date
        ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
        : String(d).slice(0, 10);
    const t = Date.parse(`${iso}T00:00:00Z`);
    if (!Number.isFinite(t)) return null;
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.round((t - today) / 86_400_000);
}

/**
 * Whole days from one date to another, both read as UTC days.
 *
 * SEPARATE FROM {@link daysFrom}, which measures against TODAY. A sales cycle and a close variance are
 * both statements about two dates in the record, and expressing either through a today-relative helper
 * would make the number change every day after the deal closed — a figure about the past that keeps
 * moving. Everything stored is UTC (CLAUDE.md), so both sides are floored to a UTC day before
 * subtracting; using local getters here shifts the answer by a day either side of midnight.
 */
function daysBetween(
    from: Date | string | null | undefined,
    to: Date | string | null | undefined,
): number | null {
    const utcDay = (d: Date | string): number | null => {
        const iso = d instanceof Date
            ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
            : String(d).slice(0, 10);
        const t = Date.parse(`${iso}T00:00:00Z`);
        return Number.isFinite(t) ? t : null;
    };
    if (!from || !to) return null;
    const a = utcDay(from);
    const b = utcDay(to);
    if (a === null || b === null) return null;
    return Math.round((b - a) / 86_400_000);
}

/** "1 day" / "N days" — so a one-day cycle does not read "1 days". */
function dayCount(n: number): string {
    return `${n} ${n === 1 ? 'day' : 'days'}`;
}

type DealFieldType =
    | 'textbox' | 'textarea' | 'number' | 'datepicker' | 'checkbox'
    | 'select' | 'autocomplete' | 'code' | 'dropdownlist' | 'numerictextbox';

/**
 * The deal panels that render a list of fields, and therefore have to honour the close lock.
 *
 * ── WHAT THIS FIXES (bc-aidp-next-golive#206 item 3) ────────────────────────────────────────────
 *
 * "Every other field ... should render read-only, instead of accepting typing and refusing on save."
 * A tester clicked Edit on a closed deal, every field opened for typing, and they only found out a
 * field was frozen when the save came back refused. That is a correct refusal delivered at the worst
 * possible moment, after the work.
 *
 * ── WHY A BASE CLASS AND NOT FIVE COPIES ────────────────────────────────────────────────────────
 *
 * Five panels render fields this way. Five copies of the rule is five chances for one of them to
 * disagree with the server, and a panel that offers a field the server refuses is the exact failure
 * `close-lock.ts` exists to prevent -- it says so in its own header.
 *
 * ── WHY IT READS THE FORM AND NOT THE STATUS ────────────────────────────────────────────────────
 *
 * `DealFormComponentExtended` already resolves the lock once per load, through the same shared
 * `ResolveDealLockState` the server uses. Resolving it again here would be a second answer to a
 * question that already has one, and five more database reads per form.
 *
 * ── WHY `FormComponent` IS THE EXTENDED CLASS, WHICH IS WORTH PROVING ───────────────────────────
 *
 * This is the first panel code to read an EXTENDED member off `FormComponent` -- everything else here
 * uses `BaseFormComponent`'s own API -- and it fails OPEN if the member is missing, which is the
 * dangerous direction: a locked deal would render fully editable and nobody would see an error.
 *
 * The chain: `MJGlobal.ClassFactory` resolves 'MJ_BizApps_Sales: Deals' to
 * `DealFormComponentExtended` (registered at priority 2, above the generated form), that class
 * renders the GENERATED template, and the template passes `[FormComponent]="this"` into the panel
 * slot -- so `this` is the extended instance.
 *
 * The evidence it holds at runtime is in golive#206 itself. The tester reported "I only find out a
 * field is frozen when the save is refused", and that refusal is produced by
 * `DealFormComponentExtended.ValidateAsync` reading `this.IsLocked`. Nothing else produces it. A
 * tester seeing it is a tester whose Explorer resolved the extended class.
 */
abstract class MJSDealFieldPanel extends BaseFormPanel<DealEntity> {
    /** The fields this panel renders, in order. */
    public abstract readonly Fields: DealFieldSpec[];

    /**
     * May this field be typed into right now?
     *
     * The membership test is `IsDealFieldEditableWhileLocked` -- the SAME rule the entity server
     * enforces, not a copy -- so the form cannot offer a field the save would refuse, or grey out one
     * it would have accepted.
     *
     * DEAL STATUS IS NOT IN THAT SET and is deliberately not special-cased here. The status moves
     * through the Pipeline panel's own control, which routes to `Sales.CloseDeal` / `Sales.ReopenDeal`
     * (golive#205); the generic field for it stays read-only on a locked deal, because writing it
     * directly is exactly what the server refuses.
     */
    public FieldEditable(fieldName: string): boolean {
        /**
         * SERVER-MAINTAINED STAMPS ARE NEVER EDITABLE, on an open deal or a closed one.
         *
         * Checked BEFORE the lock, because the lock is not the reason: `stampCompanyFromPipeline()`
         * overwrites a supplied CompanyID from the pipeline's company, and `ownerStampEditRefusal()`
         * REFUSES a supplied OwnerEmployeeID outright -- the owner comes from the deal team via
         * `stampOwnerFromTeam()`. Offering either as an editable control invites a rep to choose a
         * value the save then discards or rejects, which is the "accepts typing, refuses on save"
         * behaviour golive#206 item 3 exists to delete.
         *
         * They stay RENDERED and keep `link: 'Record'`, so the company and the owner are still
         * visible and still navigable. What goes away is the invitation to type into them.
         */
        if (this.Fields?.find((f) => f.name === fieldName)?.serverMaintained === true) return false;

        const form = this.FormComponent as unknown as { IsLocked?: boolean; IsLost?: boolean } | undefined;
        const locked = form?.IsLocked === true;
        // The outcome rides along with the lock, from the same resolver, because golive#206 keeps Loss
        // Notes editable on a LOST deal and frozen on a won one.
        return !locked || IsDealFieldEditableWhileLocked(fieldName, form?.IsLost === true);
    }

    /**
     * Persist whatever the user has typed, so the reload that follows an operation cannot discard it.
     *
     * ── WHAT THIS FIXES (#73 review) ────────────────────────────────────────────────────────────
     *
     * `RefreshRecord()` re-reads the row and overwrites the in-memory one. Every caller below runs it
     * after an operation, so anything the user had typed and not saved went with it -- silently, with
     * no prompt and no message. A locked deal is not a read-only deal: six fields stay editable, seven
     * on a lost one, and the panels render them. A rep who wrote a Description and then reopened the
     * deal from the status control lost the Description.
     *
     * ── WHY SAVING IS LEGAL HERE, WHICH AN EARLIER COMMENT DENIED ───────────────────────────────
     *
     * That comment said a reopen "must not save first: the close lock would refuse the save and turn a
     * legal reopen into a refusal". It refuses less than that. `DealEntityServer.checkCloseLock`
     * filters `f.Dirty && !editable.has(f.Name)` -- only a DIRTY FROZEN field is refused -- so a save
     * carrying nothing but editable ones passes straight through it, and that is the only kind of edit
     * these panels can produce: `FieldEditable` above renders the rest read-only.
     *
     * A frozen field that IS dirty makes this return false, which is the outcome worth having rather
     * than the one to avoid. `DealFormComponentExtended.Validate()` refuses it before the round trip
     * and names the field; the caller then abandons the operation instead of running it over the top,
     * so the deal is left as it was and the typing is still on screen to correct. Discarding it to get
     * the operation through would be the defect this method exists to close, wearing the other costume.
     *
     * ── WHY `Record.Dirty` AND NOT `EditMode || Record.Dirty` LIKE `ConfirmClose` ───────────────
     *
     * The reopen control renders only inside `@if (EditMode)`, so that condition is always true there
     * and would save on every reopen, including one with nothing to save -- a write to a locked row
     * for no reason. `Dirty` is the question actually being asked: is there anything a reload would
     * destroy? It covers companions and the IsA parent as well as fields (`BaseEntity.Dirty`), so a
     * team or payment-schedule edit counts. The form's PENDING records are not in it and do not need
     * to be: they live on the form component, not on the record, so `RefreshRecord()` cannot reach
     * them, and `SaveRecord` folds them in on any save that does run.
     *
     * @returns true when it is safe to proceed -- either nothing needed saving, or the save succeeded.
     */
    protected async SaveBeforeReload(): Promise<boolean> {
        if (!this.Record?.Dirty) {
            return true;
        }
        // `true` also ends edit mode, which every caller needs anyway: `canRefreshRecord()` is
        // `record && record.IsSaved && !this.EditMode`, so a refresh in edit mode reloads nothing.
        return await this.FormComponent.SaveRecord(true);
    }
}

/**
 * The party fields a PERSON sets, which move to the Overview while a deal is being created.
 *
 * ONE LIST, READ BY BOTH PANELS. The Overview renders these while the deal is unsaved and the party
 * panel drops exactly these for as long as it does — so the same column is never bound twice at once.
 * Two separate lists would agree today and drift the first time somebody added a fourth contact
 * field, which is the shape golive#189/#190 already cost a round of UAT.
 *
 * `CompanyID` and `OwnerEmployeeID` are NOT here. Both are server-maintained stamps, so a rep cannot
 * set either while creating, and rendering two permanently-blank read-only boxes under "Who is this
 * deal with?" would answer the question with nothing.
 */
const CREATION_PARTY_FIELDS: readonly string[] = ['AccountID', 'PrimaryContactID', 'BillingContactID'];

/**
 * The PIPELINE fields a rep chooses while creating, borrowed by the Overview the same way.
 *
 * `PipelineID` is required and decides the selling company, so a deal cannot be saved without it —
 * having it on another rail item was half of why creating one meant hopping sections. `DealTypeID` is
 * the other choice made at the same moment.
 *
 * Stage, forecast category and probability are NOT here. The server fills them from the stage on
 * create (`applyStageDefaults`), so offering them during creation invites a rep to set values that
 * are about to be derived. The status control is not here either: it routes to close/reopen, which is
 * meaningless on a deal that does not exist yet.
 */
const CREATION_PIPELINE_FIELDS: readonly string[] = ['PipelineID', 'DealTypeID'];

/**
 * Every field the party panel owns, at module scope rather than as an instance initializer.
 *
 * `Object.create(prototype)` — how these panels are built in tests, because they inject nothing —
 * does NOT run property initializers, so an instance-level array reads as undefined there. This
 * file's own header already records that trap for the Pipeline panel's `Fields`; a getter over a
 * module constant has neither problem.
 */
const PARTY_FIELDS: readonly DealFieldSpec[] = [
    { name: 'AccountID', type: 'textbox', link: 'Record' },
    // Derived by stampCompanyFromPipeline() / stampOwnerFromTeam(); see serverMaintained.
    { name: 'CompanyID', type: 'textbox', link: 'Record', serverMaintained: true },
    { name: 'OwnerEmployeeID', type: 'textbox', link: 'Record', serverMaintained: true },
    { name: 'PrimaryContactID', type: 'textbox', link: 'Record' },
    { name: 'BillingContactID', type: 'textbox', link: 'Record' },
];

interface DealFieldSpec {
    name: string;
    type: DealFieldType;
    link?: 'Record';
    span?: boolean;
    /**
     * A SERVER-MAINTAINED STAMP: rendered, navigable, never editable.
     *
     * Not the same thing as the close lock. The lock freezes a field because the deal is closed;
     * this freezes it because no caller may set it AT ALL -- `DealEntityServer` derives the value
     * and either overwrites what you supplied or refuses the save outright. CLAUDE.md states it
     * directly: "Deal.OwnerEmployeeID and DealLine.CompanyID are written by entity-server code.
     * Never hand-set them."
     */
    serverMaintained?: boolean;
}

const EMPTY_STATE_STYLES =
    '.mjs-deal-empty { margin: 0; padding: var(--mj-space-4) var(--mj-space-5); color: var(--mj-text-muted); }';

const FIELD_STYLES = `
    .mjs-fields {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--mj-space-4) var(--mj-space-5);
        padding: var(--mj-space-4) var(--mj-space-5);
    }
    @media (max-width: 720px) { .mjs-fields { grid-template-columns: 1fr; } }
    .mjs-field { min-width: 0; }
    .mjs-field--span { grid-column: 1 / -1; }
    /* The Status control's hints. Previously dw-field__hint, which is defined only in the deal
       WORKSPACE's stylesheet under emulated encapsulation, so the rule could never match markup in
       this component and both hints rendered as unstyled body text. FIELD_STYLES is a template
       literal, so no backticks in here. */
    .mjs-field__hint { display: block; margin-top: var(--mj-space-1); color: var(--mj-text-muted); font-size: 0.78rem; }
    .mjs-reopen { display: flex; flex-direction: column; gap: var(--mj-space-2); margin-top: var(--mj-space-2); }
    .mjs-reopen__field { display: flex; flex-direction: column; gap: var(--mj-space-1); font-size: 0.82rem; }
    .mjs-reopen__field textarea { width: 100%; font: inherit; }
    .mjs-reopen__row { display: flex; gap: var(--mj-space-2); }
    .mjs-reopen__confirm {
        border: 1px solid var(--mj-brand-primary); background: var(--mj-brand-primary);
        color: var(--mj-text-on-brand); border-radius: var(--mj-radius-sm);
        padding: var(--mj-space-1) var(--mj-space-3); cursor: pointer; font: inherit;
    }
    .mjs-reopen__confirm:disabled { opacity: 0.55; cursor: not-allowed; }
    .mjs-reopen__cancel {
        border: 1px solid var(--mj-border-default); background: transparent; color: var(--mj-text-default);
        border-radius: var(--mj-radius-sm); padding: var(--mj-space-1) var(--mj-space-3); cursor: pointer; font: inherit;
    }
    .mjs-reopen__msg { font-size: 0.82rem; color: var(--mj-status-success); }
    .mjs-reopen__msg.is-error { color: var(--mj-status-warning); font-weight: 500; }
    .mjs-reopen__issue { font-size: 0.78rem; color: var(--mj-status-warning); }
    .mjs-field .mj-forms-field {
        display: flex; flex-direction: column; align-items: stretch; gap: 4px; padding: 0;
    }
    .mjs-field .mj-forms-field-label {
        font-size: var(--mj-text-xs); font-weight: 700; letter-spacing: .06em;
        text-transform: uppercase; color: var(--mj-text-muted);
    }
    .mjs-field .mj-forms-field--editing:hover { margin: 0; padding: 0; }
`;

/* ── Overview ─────────────────────────────────────────────────────────────── */

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-overview',
    skipNullKeyWarning: true,
    metadata: {
        entity: E,
        slot: 'after-fields',
        sortKey: 200,
        contributionKey: 'overview',
        inclusion: 'Primary',
        replacesSectionKey: 'details',
    },
})
@Component({
    selector: 'mjs-deal-overview-panel',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, BaseFormsModule],
    template: `
        <mj-collapsible-panel
            SectionKey="overview"
            SectionName="Overview"
            Icon="fa-solid fa-chart-pie"
            [Form]="FormComponent"
            [FormContext]="FormContext"
            [DefaultExpanded]="true">
            <div class="mjs-ov">
                <!--
                     WHO THE DEAL IS WITH, WHILE IT IS BEING CREATED.

                     Account and the two contacts normally live in "Account & people", a different
                     left-nav section — and left-nav shows one section at a time, so composing a new
                     deal meant setting the name here, the pipeline there, and the customer somewhere
                     else again. A rep asked for them to sit with the fields they are already filling
                     in.

                     THE PARTY PANEL DROPS THEM WHILE THIS IS SHOWN, so the same column is never bound
                     twice at once — golive#189/#190 were exactly that defect, two inputs over one
                     column, and this must not reintroduce it one section across. CreationParty is
                     the single list both panels read, so they cannot disagree about who owns them.

                     Once the deal is saved they go home. This is a composing aid, not a new home: a
                     saved deal's customer belongs with its people, not under its KPIs.
                -->
                @if (!Record.IsSaved) {
                    <div class="mjs-ov-create">
                        <div class="mjs-ov-create__head">Where does this deal sit?</div>
                        <div class="mjs-fields">
                            @for (f of CreationPipeline; track f.name) {
                                <div class="mjs-field">
                                    <mj-form-field [Record]="Record" [ShowLabel]="true" [FieldName]="f.name"
                                        [Type]="f.type" [EditMode]="EditMode && FieldEditable(f.name)"
                                        [FormContext]="FormContext" [LinkType]="f.link ?? 'None'"
                                        (Navigate)="FormComponent.OnFormNavigate($event)"></mj-form-field>
                                </div>
                            }
                        </div>
                    </div>
                    <div class="mjs-ov-create">
                        <div class="mjs-ov-create__head">Who is this deal with?</div>
                        <div class="mjs-fields">
                            @for (f of CreationParty; track f.name) {
                                <div class="mjs-field">
                                    <mj-form-field [Record]="Record" [ShowLabel]="true" [FieldName]="f.name"
                                        [Type]="f.type" [EditMode]="EditMode && FieldEditable(f.name)"
                                        [FormContext]="FormContext"
                                        [LinkType]="f.link ?? 'None'"
                                        (Navigate)="FormComponent.OnFormNavigate($event)"></mj-form-field>
                                </div>
                            }
                        </div>
                    </div>
                }
                @if (Health.length) {
                    <div class="mjs-ov-health">
                        @for (h of Health; track h) {
                            <div class="mjs-ov-alert">
                                <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                                {{ h }}
                            </div>
                        }
                    </div>
                } @else if (Record.IsSaved) {
                    <div class="mjs-ov-ok">
                        <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
                        Nothing needs attention on this deal.
                    </div>
                }

                <!--
                     THE FIGURES ARE FOR A DEAL THAT EXISTS. Amount, Weighted, the outcome tiles and
                     the Situation card all describe a record with history; on one nobody has saved
                     they render zeroes and dashes under the fields still being filled in. Same
                     reasoning as the hero briefing, one surface down.
                -->
                @if (Record.IsSaved) {
                <div class="mjs-ov-strip">
                    <div class="mjs-ov-kpi">
                        <div class="l">Amount</div>
                        <div class="v">{{ Money }}</div>
                        <div class="s">{{ Provenance }}</div>
                    </div>
                    <div class="mjs-ov-kpi">
                        <div class="l">Weighted</div>
                        <div class="v">{{ Weighted }}</div>
                        <div class="s">{{ Prob }} probability</div>
                    </div>
                    <!-- THE LABELS MOVE WITH THE OUTCOME, not just the values (golive#231).
                         #206 item 4 made these tiles show the right DATA on a closed deal and left the
                         static labels alone, so a won deal read "Forecast: Won" and "Close: 14 Mar" —
                         correct figures sitting under headings that promise something else. -->
                    <div class="mjs-ov-kpi">
                        <div class="l">{{ OutcomeTileLabel }}</div>
                        <div class="v">{{ ForecastHeadline }}</div>
                        <div class="s">{{ OutcomeTileSub }}</div>
                    </div>
                    <div class="mjs-ov-kpi" [attr.data-tone]="CloseClock.tone">
                        <div class="l">{{ CloseTileLabel }}</div>
                        <div class="v">{{ CloseClock.label }}</div>
                        <div class="s">{{ CloseTileSub }}</div>
                    </div>
                </div>

                <div class="mjs-ov-grid">
                    <article class="mjs-ov-card">
                        <header><i class="fa-solid fa-bullseye"></i> Situation</header>
                        <div class="mjs-ov-facts">
                            <div>
                                <div class="l">Account</div>
                                <div class="v">
                                    @if (Record.AccountID && G('Account')) {
                                        <button type="button" class="mjs-ov-link" (click)="OpenAccount($event)">{{ G('Account') }}</button>
                                    } @else { {{ G('Account') || '—' }} }
                                </div>
                            </div>
                            <div>
                                <div class="l">Owner</div>
                                <div class="v">
                                    @if (Record.OwnerEmployeeID && G('OwnerEmployee')) {
                                        <button type="button" class="mjs-ov-link" (click)="OpenOwner($event)">{{ G('OwnerEmployee') }}</button>
                                    } @else { {{ G('OwnerEmployee') || 'No owner' }} }
                                </div>
                            </div>
                            <div><div class="l">Stage</div><div class="v">{{ G('PipelineStage') || '—' }}</div></div>
                            <div><div class="l">Pipeline</div><div class="v">{{ G('Pipeline') || '—' }}</div></div>
                            <div><div class="l">Type</div><div class="v">{{ G('DealType') || '—' }}</div></div>
                            <div><div class="l">Selling as</div><div class="v">{{ G('Company') || '—' }}</div></div>
                            <!-- WHY A DEAL WAS LOST is the single most useful thing on a lost deal, and
                                 nothing anywhere reported it (golive#231). Shown only when lost: on a won
                                 or open deal it is an empty row asking a question with no answer. -->
                            @if (ShowLossReason) {
                                <div class="mjs-ov-fact--span">
                                    <div class="l">Loss reason</div>
                                    <div class="v">{{ G('LossReason') || '—' }}</div>
                                    @if (Record.LossNotes) {
                                        <div class="s">{{ Record.LossNotes }}</div>
                                    }
                                </div>
                            }
                        </div>
                    </article>
                    <article class="mjs-ov-card">
                        <header><i class="fa-solid fa-calendar-day"></i> Timing</header>
                        <div class="mjs-ov-facts">
                            <!-- CLOSED FIRST, because on a finished deal what happened outranks what was
                                 expected. "Expected close" is KEPT either way so the variance stays
                                 legible — that is the whole point of the sub-line on the Close tile. -->
                            @if (IsClosed) {
                                <div><div class="l">{{ ClosedRowLabel }}</div><div class="v">{{ ClosedDateLabel }}</div></div>
                            }
                            <div><div class="l">Expected close</div><div class="v">{{ CloseLabel }}</div></div>
                            <!-- "Days to close" counted DOWN to a date that has already arrived, and
                                 #206 item 4 made it render the close DATE instead — a date under a label
                                 promising a count (golive#231). Closed deals get the sales cycle, which
                                 is the question actually worth asking afterwards; open ones keep the
                                 countdown under a label that means it. -->
                            @if (IsClosed) {
                                <div><div class="l">Sales cycle</div><div class="v">{{ SalesCycleLabel }}</div></div>
                            } @else {
                                <div><div class="l">Days to close</div><div class="v">{{ DaysToCloseLabel }}</div></div>
                            }
                            <!-- Term, Start and Executed describe a deal that is being DELIVERED. On a
                                 lost deal they are three empty rows reporting the absence of things that
                                 were never going to exist, so they appear only if actually set. -->
                            @if (ShowDeliveryRows) {
                                <div><div class="l">Start</div><div class="v">{{ DateLabel(Record.StartDate) }}</div></div>
                                <div><div class="l">Term</div><div class="v">{{ TermLabel }}</div></div>
                                <div><div class="l">Executed</div><div class="v">{{ DateLabel(Record.ExecutionDate) }}</div></div>
                            }
                        </div>
                    </article>
                    <article class="mjs-ov-card mjs-ov-card--wide">
                        <header><i class="fa-solid fa-person-walking"></i> Next move</header>
                        @if (Record.NextStep) {
                            <p class="mjs-ov-next">{{ Record.NextStep }}</p>
                            @if (Record.NextStepDate) {
                                <div class="muted">Due {{ Record.NextStepDate | date: 'd MMM y' }}
                                    @if (NextStepOverdue) { · overdue }
                                </div>
                            }
                        } @else if (!IsClosed) {
                            <p class="mjs-ov-empty">No next step recorded.</p>
                        }
                    </article>
                </div>
                }
            </div>
        </mj-collapsible-panel>
    `,
    styles: [`
        .mjs-ov { display: flex; flex-direction: column; gap: var(--mj-space-4); padding: var(--mj-space-3) var(--mj-space-4) var(--mj-space-5); }
        .mjs-ov-create { margin-bottom: var(--mj-space-4); }
        .mjs-ov-create__head {
            font-weight: 600; margin-bottom: var(--mj-space-2); color: var(--mj-text-default);
        }
        .mjs-ov-health { display: flex; flex-direction: column; gap: var(--mj-space-2); }
        .mjs-ov-alert {
            display: flex; align-items: center; gap: var(--mj-space-2);
            padding: var(--mj-space-2) var(--mj-space-3);
            background: var(--mj-status-warning-bg); color: var(--mj-status-warning-text);
            border-radius: var(--mj-radius-md); font-size: var(--mj-text-sm); font-weight: 600;
        }
        .mjs-ov-ok {
            display: flex; align-items: center; gap: var(--mj-space-2);
            padding: var(--mj-space-2) var(--mj-space-3);
            background: var(--mj-status-success-bg); color: var(--mj-status-success-text);
            border-radius: var(--mj-radius-md); font-size: var(--mj-text-sm); font-weight: 600;
        }
        .mjs-ov-strip {
            display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: var(--mj-space-3);
        }
        @media (max-width: 900px) { .mjs-ov-strip { grid-template-columns: 1fr 1fr; } }
        .mjs-ov-kpi {
            background: var(--mj-bg-page); border: 1px solid var(--mj-border-default);
            border-radius: var(--mj-radius-md); padding: var(--mj-space-3) var(--mj-space-4);
        }
        .mjs-ov-kpi .l {
            font-size: var(--mj-text-xs); text-transform: uppercase; letter-spacing: .04em;
            color: var(--mj-text-muted); font-weight: 700;
        }
        .mjs-ov-kpi .v { font-size: 1.35rem; font-weight: 800; letter-spacing: -.02em; margin-top: 4px; line-height: 1.2; }
        .mjs-ov-kpi .s { color: var(--mj-text-muted); font-size: var(--mj-text-sm); margin-top: 2px; }
        .mjs-ov-kpi[data-tone='warning'] .v { color: var(--mj-status-warning-text); }
        .mjs-ov-kpi[data-tone='success'] .v { color: var(--mj-status-success-text); }
        .mjs-ov-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--mj-space-3); }
        @media (max-width: 800px) { .mjs-ov-grid { grid-template-columns: 1fr; } }
        .mjs-ov-card {
            background: var(--mj-bg-page); border: 1px solid var(--mj-border-default);
            border-radius: var(--mj-radius-md); padding: var(--mj-space-3) var(--mj-space-4);
        }
        .mjs-ov-card--wide { grid-column: 1 / -1; }
        .mjs-ov-card header {
            display: flex; align-items: center; gap: 8px;
            font-weight: 700; margin-bottom: var(--mj-space-3); color: var(--mj-text-primary);
        }
        .mjs-ov-card header i { color: var(--mj-brand-primary); width: 1.1rem; text-align: center; }
        .mjs-ov-facts { display: grid; grid-template-columns: 1fr 1fr; gap: var(--mj-space-3); }
        .mjs-ov-facts .l {
            font-size: var(--mj-text-xs); text-transform: uppercase; letter-spacing: .04em;
            color: var(--mj-text-muted); font-weight: 700;
        }
        .mjs-ov-facts .v { font-weight: 650; margin-top: 2px; }
        /* The loss reason carries free-text notes under it, so it takes the full row rather than
           squeezing a sentence into a half-width cell. */
        .mjs-ov-fact--span { grid-column: 1 / -1; }
        .mjs-ov-fact--span .s {
            margin-top: 2px; font-weight: 450; color: var(--mj-text-muted);
            white-space: pre-wrap; overflow-wrap: anywhere;
        }
        .mjs-ov-link {
            border: 0; padding: 0; background: transparent; color: var(--mj-text-link);
            cursor: pointer; font: inherit; font-weight: 650; text-align: left;
        }
        .mjs-ov-link:hover { text-decoration: underline; }
        .mjs-ov-next { margin: 0; font-size: 1.05rem; font-weight: 650; }
        .mjs-ov-empty, .muted { color: var(--mj-text-muted); margin: 0; }
    `],
})
export class MJSDealOverviewPanel extends BaseFormPanel<DealEntity> {
    /**
     * Account and contacts, rendered here only while the deal is unsaved. See `CREATION_PARTY_FIELDS`
     * for why this list is shared with the party panel rather than restated.
     *
     * `link: 'Record'` matches what the party panel gives them, so a chosen account is navigable from
     * here too — the `Navigate` output is forwarded the same way.
     */
    public get CreationParty(): DealFieldSpec[] {
        return PARTY_FIELDS.filter((f) => CREATION_PARTY_FIELDS.includes(f.name));
    }

    /** The pipeline choices a rep makes while creating. @see CREATION_PIPELINE_FIELDS */
    public get CreationPipeline(): DealFieldSpec[] {
        return PIPELINE_FIELDS.filter((f) => CREATION_PIPELINE_FIELDS.includes(f.name));
    }

    /**
     * May this creation field be typed into? The same question `MJSDealFieldPanel.FieldEditable` asks,
     * answered from the same shared rule rather than a copy of it.
     *
     * It reads vacuous — an UNSAVED deal cannot be locked, and this block only renders while unsaved.
     * It is here because a bare `[EditMode]="EditMode"` is how the lock gets bypassed, and
     * `deal-locked-fields-readonly` refuses one anywhere on this form for exactly that reason. Keying
     * it on the lock rather than on "we know it cannot be locked here" is what survives someone later
     * rendering this block somewhere it can be.
     */
    public FieldEditable(fieldName: string): boolean {
        const form = this.FormComponent as unknown as { IsLocked?: boolean; IsLost?: boolean } | undefined;
        if (form?.IsLocked !== true) return true;
        return IsDealFieldEditableWhileLocked(fieldName, form?.IsLost === true);
    }

    public G(field: string): string {
        const v = this.Record?.Get?.(field);
        return v == null || v === '' ? '' : String(v);
    }
    public get Money(): string { return money(this.Record?.Amount); }
    public get Weighted(): string {
        const a = Number(this.Record?.Amount);
        const p = Number(this.Record?.Probability);
        if (!Number.isFinite(a) || !Number.isFinite(p)) return '—';
        return money(a * p / 100);
    }
    public get Prob(): string {
        const p = this.Record?.Probability;
        return p == null ? '—' : `${p}%`;
    }
    public get Provenance(): string {
        if (this.Record?.Amount == null) return 'No amount yet';
        return this.Record.AmountIsComputed ? 'Priced by Orders' : 'Entered manually';
    }
    public DateLabel(d: Date | string | null | undefined): string {
        if (!d) return '—';
        return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    }
    public get CloseLabel(): string { return this.DateLabel(this.Record?.ExpectedCloseDate); }
    /**
     * The countdown, for an OPEN deal only — the template swaps the whole row for "Sales cycle" once the
     * deal has closed (golive#231).
     *
     * #206 item 4 had made this return the close DATE when closed, which is how a date came to sit under
     * a label reading "Days to close". That branch is gone rather than left unreachable: a dead branch is
     * a claim about a caller that no longer exists, and the next reader has no way to tell.
     */
    public get DaysToCloseLabel(): string {
        const n = daysFrom(this.Record?.ExpectedCloseDate);
        if (n === null) return '—';
        if (n < 0) return `${dayCount(Math.abs(n))} overdue`;
        if (n === 0) return 'today';
        return dayCount(n);
    }
    /**
     * Has this deal been closed? (bc-aidp-next-golive#206 item 4)
     *
     * Read off the CLOSE STAMPS rather than the status flags, because the stamps are what the server
     * writes when the close actually runs, and a panel that keyed on the status would call a deal
     * closed before any of the close had happened. Either stamp counts: `ClosedAt` is the instant,
     * `ActualCloseDate` the day, and a legacy row may carry only one.
     */
    public get IsClosed(): boolean {
        return !!(this.Record?.ClosedAt ?? this.Record?.ActualCloseDate);
    }

    /**
     * The Forecast tile's headline: the OUTCOME once a deal is closed, the forecast category while it
     * is open. A forecast is a statement about a deal that might still move; Won is not a forecast.
     */
    public get ForecastHeadline(): string {
        if (this.IsClosed) return String(this.Record?.Get?.('DealStatusType') ?? '') || '—';
        return String(this.Record?.Get?.('ForecastCategoryType') ?? '') || '—';
    }

    public get CloseClock(): { label: string; tone: 'success' | 'warning' | 'muted' } {
        const n = daysFrom(this.Record?.ExpectedCloseDate);
        // A closed deal shows WHEN it closed. Counting days against an expected date it already met
        // (or missed) is advice on a decision nobody can take any more.
        if (this.IsClosed) {
            return {
                label: this.DateLabel(this.Record?.ActualCloseDate ?? this.Record?.ClosedAt),
                tone: this.IsLost ? 'muted' : 'success',
            };
        }
        if (this.Record?.ActualCloseDate) return { label: 'Closed', tone: 'success' };
        if (n === null) return { label: 'No close date', tone: 'muted' };
        // SPELLED OUT, not "12d" / "3d past" (golive#231). The tile is read at a glance by someone who
        // is not holding the convention in their head, and "3d past" has to be decoded.
        if (n < 0) return { label: `${dayCount(Math.abs(n))} overdue`, tone: 'warning' };
        if (n === 0) return { label: 'today', tone: 'warning' };
        if (n <= 14) return { label: `in ${dayCount(n)}`, tone: 'warning' };
        return { label: `in ${dayCount(n)}`, tone: 'muted' };
    }

    /* ── The outcome labels (bc-aidp-next-golive#231) ───────────────────────────────────────────
     *
     * WON AND LOST ARE READ AS FLAGS, never as status names and never as each other's negation. The
     * flags come from `DealStatusType` through `ResolveDealLockState`, which is what makes "Closed Won"
     * a label a pipeline can rename (CLAUDE.md rule 2), and reading `!IsLost` as "won" would print
     * "Won" over any other locking status — a lie that reads perfectly.
     */

    /** Whether the PERSISTED status carries `IsLost`, as the form component resolved it once. */
    public get IsLost(): boolean {
        return (this.FormComponent as unknown as { IsLost?: boolean } | undefined)?.IsLost === true;
    }

    /** Whether the PERSISTED status carries `IsWon`. */
    public get IsWon(): boolean {
        return (this.FormComponent as unknown as { IsWon?: boolean } | undefined)?.IsWon === true;
    }

    /** "Outcome" once there is one; "Forecast" while the deal can still move. */
    public get OutcomeTileLabel(): string { return this.IsClosed ? 'Outcome' : 'Forecast'; }

    /** The stage it closed FROM once closed, the status while open. */
    public get OutcomeTileSub(): string {
        if (this.IsClosed) {
            const stage = this.G('PipelineStage');
            return stage ? `from ${stage}` : 'Closed';
        }
        return this.G('DealStatusType') || 'No status set';
    }

    /** "Won" / "Lost" once decided, "Closes" while it is still ahead. */
    public get CloseTileLabel(): string {
        if (!this.IsClosed) return 'Closes';
        if (this.IsWon) return 'Won';
        if (this.IsLost) return 'Lost';
        return 'Closed';
    }

    /**
     * Under the close date: how it landed against the expectation, or why it was lost.
     *
     * On an open deal this stays the expected date, which is what the value is counting down to.
     */
    public get CloseTileSub(): string {
        if (!this.IsClosed) return this.CloseLabel;
        if (this.IsLost) return this.G('LossReason') || 'No reason recorded';
        return this.CloseVariance;
    }

    /**
     * "on time" / "N days early" / "N days late" — the close against the date it was expected on.
     *
     * Empty when either date is missing: a variance needs both, and inventing "on time" from an absent
     * expectation would be a claim nobody made.
     */
    public get CloseVariance(): string {
        const n = daysBetween(this.Record?.ExpectedCloseDate, this.Record?.ActualCloseDate ?? this.Record?.ClosedAt);
        if (n === null) return '';
        if (n === 0) return 'on time';
        return n < 0 ? `${dayCount(Math.abs(n))} early` : `${dayCount(n)} late`;
    }

    /** "Closed won" / "Closed lost" — the Timing row that reports what happened. */
    public get ClosedRowLabel(): string {
        if (this.IsWon) return 'Closed won';
        if (this.IsLost) return 'Closed lost';
        return 'Closed';
    }

    /** The day it closed. */
    public get ClosedDateLabel(): string {
        return this.DateLabel(this.Record?.ActualCloseDate ?? this.Record?.ClosedAt);
    }

    /**
     * Creation to close, in days — the question worth asking about a finished deal, and one nothing
     * reported anywhere. Measured from `__mj_CreatedAt`, which is the only creation stamp there is.
     */
    public get SalesCycleLabel(): string {
        const n = daysBetween(
            this.Record?.Get?.('__mj_CreatedAt') as Date | string | null | undefined,
            this.Record?.ActualCloseDate ?? this.Record?.ClosedAt,
        );
        // A close back-dated before the deal was created is data, not an error to hide -- but it is not
        // a sales cycle either, and "-4 days" reads as a bug. Say nothing rather than something wrong.
        if (n === null || n < 0) return '—';
        return dayCount(n);
    }

    /**
     * Term / Start / Executed describe a deal being DELIVERED, so a lost deal hides them — unless one is
     * actually set, in which case hiding it would conceal real data.
     */
    public get ShowDeliveryRows(): boolean {
        if (!this.IsClosed || !this.IsLost) return true;
        return !!(this.Record?.TermMonths || this.Record?.StartDate || this.Record?.ExecutionDate);
    }

    /** The loss reason row appears only on a deal that was actually lost. */
    public get ShowLossReason(): boolean {
        return this.IsClosed && this.IsLost;
    }
    public get TermLabel(): string {
        const m = this.Record?.TermMonths;
        return m ? `${m} mo` : '—';
    }
    public get NextStepOverdue(): boolean {
        // Nothing is overdue on a deal that is finished.
        if (this.IsClosed) return false;
        const n = daysFrom(this.Record?.NextStepDate);
        return n !== null && n < 0;
    }
    public get Health(): string[] {
        const out: string[] = [];
        if (!this.Record) return out;
        // A deal nobody has saved yet has not FAILED to have an owner, a next step or an account --
        // nobody has had the chance to give it one. Auditing a record the user is still filling in
        // reports the absence of work that has not started, which is why a brand-new deal opened on a
        // wall of warnings. The briefing stays quiet until there is something to brief on.
        if (!this.Record.IsSaved) return out;
        // A closed deal is not coached. Every line below asks someone to do something about a deal
        // that is finished -- re-date it, assign it, give it a next step -- and none of it applies.
        if (this.IsClosed) return out;
        const days = daysFrom(this.Record.ExpectedCloseDate);
        if (days !== null && days < 0 && !this.Record.ActualCloseDate) {
            out.push('The expected close date has passed. Update the date or close the deal.');
        }
        if (!this.Record.OwnerEmployeeID) out.push('No owner assigned.');
        if (!this.Record.NextStep) out.push('No next step recorded.');
        if (this.NextStepOverdue) out.push('The next step is overdue.');
        if (!this.Record.AccountID) out.push('No account selected.');
        if (this.Record.Amount != null && this.Record.Probability == null) {
            out.push('The deal has an amount but no probability, so it cannot be weighted.');
        }
        return out;
    }
    public OpenAccount(event: MouseEvent): void {
        this.open(event, MJS_ENTITIES.SalesAccount, this.Record?.AccountID);
    }
    public OpenOwner(event: MouseEvent): void {
        this.open(event, MJS_FOREIGN_ENTITIES.Employee, this.Record?.OwnerEmployeeID);
    }
    private open(event: MouseEvent, entity: string, id: string | null | undefined): void {
        if (!id) return;
        event.preventDefault();
        this.FormComponent.OnFormNavigate({
            Kind: 'record',
            EntityName: entity,
            PrimaryKey: CompositeKey.FromID(id),
            OpenInNewTab: event.ctrlKey || event.metaKey,
        });
    }
}

/* ── Field sections ───────────────────────────────────────────────────────── */

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-pipeline',
    skipNullKeyWarning: true,
    // `leadsWhenUnsaved` opens a NEW deal here rather than on Overview (bc-aidp-next-golive#188).
    //
    // INERT UNTIL MJ#4217 SHIPS, AND NOTHING WILL SAY SO. `FormPanelRegistrationMetadata` extends
    // `Record<string, unknown>`, so this key type-checks against the PUBLISHED base-forms package
    // exactly as it does against the branch that adds the reader. It compiles, it looks configured,
    // and a new deal keeps opening on Overview until a release carries MJ#4217. Declared here now so
    // the opt-in lands with the rest of the #188 work rather than being forgotten a release later.
    // Overview is an exec briefing and stays the lead for a SAVED deal, which is what it is for;
    // on a record with no data it is a page of blanks the user has to look past to find where
    // typing starts. This is the first panel that asks for anything.
    metadata: { entity: E, slot: 'after-fields', sortKey: 90, contributionKey: 'pipeline', leadsWhenUnsaved: true },
})
@Component({
    selector: 'mjs-deal-pipeline-panel',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, FormsModule, BaseFormsModule],
    styles: [FIELD_STYLES],
    template: `
        <mj-collapsible-panel SectionKey="pipeline" SectionName="Pipeline" Icon="fa-solid fa-diagram-project"
            [Form]="FormComponent" [FormContext]="FormContext">
            <div class="mjs-fields">
                @for (f of Fields; track f.name) {
                    <div class="mjs-field" [class.mjs-field--span]="f.span">
                        <mj-form-field [Record]="Record" [ShowLabel]="true" [FieldName]="f.name" [Type]="f.type"
                            [EditMode]="EditMode && FieldEditable(f.name)" [FormContext]="FormContext" [LinkType]="f.link ?? 'None'"
                            (Navigate)="FormComponent.OnFormNavigate($event)"></mj-form-field>
                    </div>
                }

                <!-- STATUS IS NOT A GENERIC FIELD HERE, and the reason is the whole of golive#205.
                     MJ's <mj-form-field> renders a foreign key as an unfiltered dropdown off the related
                     entity, so it offered Won and Lost — and picking one wrote the status without any of
                     the close running. The deal workspace has never offered them; this brings the form
                     into line with it rather than the other way round. One door, and it is the audited
                     one. -->
                <div class="mjs-field">
                    <div class="mj-forms-field">
                        <label class="mj-forms-field-label">Status</label>
                        @if (EditMode) {
                            <select [ngModel]="Record.DealStatusTypeID"
                                    (ngModelChange)="SetStatus($event)"
                                    [compareWith]="CompareStatus"
                                    [disabled]="!StatusIsEditable">
                                <!-- Pickable only on a deal nobody has saved. On a saved one it writes
                                     NULL, and a deal with no status is invisible to every rollup. -->
                                <option [ngValue]="null" [disabled]="Record.IsSaved">— choose —</option>
                                @for (s of SelectableStatuses; track s.ID) {
                                    <option [ngValue]="s.ID">{{ s.Name }}</option>
                                }
                                <!-- The deal's OWN status when it is a closing one, so a closed deal reads
                                     "Won" rather than "— choose —". Never selectable: the list excludes it. -->
                                @if (CurrentStatusIsClosing) {
                                    <option [ngValue]="Record.DealStatusTypeID" disabled>{{ CurrentStatusName }}</option>
                                }
                            </select>
                            @if (PendingCloseStatusID) {
                                <!-- golive#205: "Changing Deal Status to Won or Lost should close the
                                     deal properly." Picking it does not WRITE it -- the close has to
                                     run, and a Lost close needs a reason the dropdown cannot carry. -->
                                <div class="mjs-reopen">
                                    @if (PendingCloseStatus?.IsLost) {
                                        <label class="mjs-reopen__field">
                                            <span>Loss reason</span>
                                            <select [(ngModel)]="LossReasonID" (ngModelChange)="OnLossReasonChange()"
                                                    [disabled]="Busy">
                                                <option [ngValue]="null">— choose —</option>
                                                @for (r of LossReasons(); track r.ID) {
                                                    <option [ngValue]="r.ID">{{ r.Name }}</option>
                                                }
                                            </select>
                                        </label>
                                        @if (LossReasonRequiresNotes) {
                                            <label class="mjs-reopen__field">
                                                <span>Loss notes <em>(required for this reason)</em></span>
                                                <textarea rows="2" [(ngModel)]="LossNotes" [disabled]="Busy"></textarea>
                                            </label>
                                        }
                                    }
                                    <label class="mjs-reopen__field">
                                        <span>Notes <em>(optional)</em></span>
                                        <textarea rows="2" [(ngModel)]="CloseNotes" [disabled]="Busy"></textarea>
                                    </label>
                                    <div class="mjs-reopen__row">
                                        <button type="button" class="mjs-reopen__confirm"
                                                [disabled]="!CanConfirmClose" (click)="ConfirmClose()">
                                            {{ Busy ? 'Closing\u2026' : 'Close as ' + PendingCloseStatusName }}
                                        </button>
                                        <button type="button" class="mjs-reopen__cancel"
                                                [disabled]="Busy" (click)="CancelClose()">Cancel</button>
                                    </div>
                                </div>
                            }
                            @if (PendingReopenStatusID) {
                                <!-- golive#205 D9: the status field IS the way back. Picking an open
                                     status on a closed deal does not write it -- Sales.ReopenDeal has
                                     to run -- so this confirms here and the operation moves the status
                                     itself.

                                     THE REASON IS OPTIONAL, which golive#205 asks for in so many words:
                                     "No reopen reason should be required in this path." It is still
                                     RECORDED either way -- see ReopenReasonOrDefault -- because master
                                     plan 7.3 requires undoing a lock to be explainable, and an
                                     unexplained reopen in the audit trail is what that rule is against.
                                     Not prompting is not the same as not recording. -->
                                <div class="mjs-reopen">
                                    <label class="mjs-reopen__field">
                                        <span>Reopen as {{ PendingReopenStatusName }} — reason <em>(optional)</em></span>
                                        <textarea rows="2" [(ngModel)]="ReopenReason" [disabled]="Busy"></textarea>
                                    </label>
                                    <div class="mjs-reopen__row">
                                        <button type="button" class="mjs-reopen__confirm"
                                                [disabled]="!CanConfirmReopen" (click)="ConfirmReopen()">
                                            {{ Busy ? 'Reopening…' : 'Reopen deal' }}
                                        </button>
                                        <button type="button" class="mjs-reopen__cancel"
                                                [disabled]="Busy" (click)="CancelReopen()">Cancel</button>
                                    </div>
                                </div>
                            }
                            <!-- BOTH HINTS NAME THIS CONTROL FIRST, and the Close panel second.
                                 The open-deal one used to read "Use the Close action on the Close
                                 panel to win or lose a deal" -- which sent the user away from the
                                 control that does the job. Picking a closing status here IS the close
                                 (golive#205), and it collects the same target, loss reason, loss notes
                                 and notes the Close panel does, through the same operation. There is no
                                 second route to describe, only a second door.

                                 A CLOSING STATUS, never a list of names: a deployment can rename Won,
                                 and this one already has TWO losing statuses. -->
                            @if (CurrentStatusIsClosing && !PendingReopenStatusID) {
                                <small class="mjs-field__hint">Closed. Pick an open status to reopen it, or use Reopen on the Close panel.</small>
                            } @else if (!CurrentStatusIsClosing) {
                                <small class="mjs-field__hint">Open. Pick a closing status to close the deal, or use Close on the Close panel.</small>
                            }
                        } @else {
                            <div class="mj-forms-field-value">{{ CurrentStatusName || '—' }}</div>
                        }

                        <!-- OUTSIDE the EditMode gate, deliberately. The outcome of an operation has to
                             outlive the mode it was started in. ConfirmClose ends edit mode BEFORE the
                             close runs, via SaveRecord(true), so by the time these are assigned the gate
                             above is already false: a close that half-succeeded said "Deal closed as Won"
                             and hid "the contract was planned but not created" in the same breath, and
                             the rep only ever saw it by clicking Edit again. The reopen reaches here the
                             same way now that it ends edit mode too.

                             NO BACKTICKS IN HERE: this comment sits inside the component's template
                             literal, and one would end it. -->
                        @if (ActionMessage) {
                            <div class="mjs-reopen__msg" [class.is-error]="ActionFailed">{{ ActionMessage }}</div>
                        }
                        @for (i of ActionIssues; track $index) {
                            <div class="mjs-reopen__issue">{{ i }}</div>
                        }
                    </div>
                </div>
            </div>
        </mj-collapsible-panel>
    `,
})
export class MJSDealPipelinePanel extends MJSDealFieldPanel {
    /** Every active status, loaded once. Filtered for display; see SelectableStatuses. */
    /**
     * A SIGNAL rather than a plain array, and not for style.
     *
     * The host container is OnPush, and nothing marked it dirty when this promise resolved -- the
     * control painted with an empty list and stayed that way until an unrelated click ticked the tree.
     * A ChangeDetectorRef would also fix that, but `inject()` needs an injection context, which means
     * the panel can no longer be constructed in a unit test. A signal read through the template marks
     * the component itself, needs no DI, and leaves `new MJSDealPipelinePanel()` working.
     */
    private readonly statuses = signal<DealStatusOption[]>([]);

    public async ngOnInit(): Promise<void> {
        // BaseFormPanel declares no lifecycle hook, so there is nothing to chain to. Angular calls this
        // on the component regardless of whether the base class has one.
        const settled = await Promise.allSettled([LoadDealStatusOptions(), LoadLossReasons()]);
        const valueOf = <T>(r: PromiseSettledResult<T>): T | null =>
            r.status === 'fulfilled' ? r.value : null; // vocabulary-grep-allow: PromiseSettledResult discriminant, not a domain status
        const loadedStatuses = valueOf(settled[0] as PromiseSettledResult<DealStatusOption[]>);
        const loadedReasons = valueOf(settled[1] as PromiseSettledResult<LossReasonOption[]>);
        if (loadedStatuses) {
            this.statuses.set(loadedStatuses);
        }
        if (loadedReasons) {
            this.LossReasons.set(loadedReasons);
        }
        if (!loadedStatuses || !loadedReasons) {
            this.ActionFailed = true;
            this.ActionMessage = 'Some of this panel could not load. Reload the page before closing this deal.';
        }
    }

    /**
     * The loaded row for the deal's current status, or null when the list does not contain it.
     *
     * One resolver, so every question below answers from the same place. Null has two causes and the
     * callers treat them alike, deliberately: the list has not resolved yet, or the deal sits in a
     * status an admin has since deactivated (the loader filters IsActive = 1). In both cases the
     * honest answer is "not known", never "not closing".
     */
    private get currentStatus(): DealStatusOption | null {
        const id = String(this.Record?.DealStatusTypeID ?? '').toLowerCase();
        if (!id) return null;
        return this.statuses().find((s) => s.ID.toLowerCase() === id) ?? null;
    }

    /**
     * Angular's select matches the model against each option by strict identity, while every getter
     * here lowercases both sides because ids arrive cased either way. Without this the control renders
     * with nothing selected on a deal that plainly has a status, while read mode two lines below shows
     * the name correctly -- one record answering differently in two places.
     */
    public readonly CompareStatus = (a: unknown, b: unknown): boolean =>
        String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();

    /**
     * The statuses a user may pick DIRECTLY — the non-locking ones.
     *
     * By FLAG, never by name, and `LocksDeal` specifically: that is the flag the server's refusal
     * reads, so this control and the save cannot disagree about which statuses are pickable.
     *
     * NOT the predicate the deal workspace uses -- it filters !IsWon && !IsLost. The two coincide on
     * today's seed and diverge on a status that locks without being either: the workspace would offer
     * it as an ordinary field write, and the server would run a full close on it. Said this way round
     * because an earlier version of this comment asserted a parity that does not exist; migrating the
     * workspace onto the flag is its own change.
     */
    public get SelectableStatuses(): DealStatusOption[] {
        // A CLOSED deal may only move to a non-locking status, and that move is a reopen. Offering it
        // another closing status would be neither a close nor a reopen, and the server has no path for it.
        if (this.CurrentStatusIsClosing) {
            return this.statuses().filter((s) => !s.LocksDeal);
        }
        return this.statuses();
    }

    /** The display name of whatever status the deal currently holds. */
    public get CurrentStatusName(): string {
        return this.currentStatus?.Name ?? '';
    }

    /** True when the deal already sits in a closing status, so the control is showing a frozen value. */
    public get CurrentStatusIsClosing(): boolean {
        return this.currentStatus?.LocksDeal === true;
    }

    /**
     * A closed deal's status is not editable here. Reopening is the audited way back, and offering the
     * field would be the mirror of the defect this change closes: a status write that unlocks a deal
     * without the reopen having run.
     */
    /**
     * EDITABLE ON A LOCKED DEAL TOO, which is golive#205 D9 and #206 item 3 asking for the same thing:
     * "Deal Status should stay editable so the deal can be set back to Open, which is how a closed deal
     * is reopened."
     *
     * What makes that safe is that picking an open status here does NOT write it. {@link SetStatus}
     * holds the pick and routes it into `Sales.ReopenDeal` instead, which is the audited way through,
     * and the operation moves the status itself.
     *
     * THE SERVER WOULD NOW COPE EITHER WAY ── a status write out of a locking status is a reopen the
     * entity server runs for itself, which `close-deal.CD27` measures. Routing through the operation is
     * still what this panel does, because a reopen the server runs on its own behalf has to invent a
     * reason, and the one thing a person reopening a deal can supply that nothing else can is why.
     *
     * STILL FAILS CLOSED on a status it cannot resolve: an unknown status means the lock state is
     * unknown, and offering either path on that is guessing.
     */
    public get StatusIsEditable(): boolean {
        if (this.Busy) return false;                               // one in flight
        if (this.statuses().length === 0) return false;                 // list never resolved
        if (this.Record?.IsSaved && !this.currentStatus) return false;  // status not in the active list
        return true;
    }

    public SetStatus(id: string | null): void {
        if (!this.Record) return;
        /**
         * The blank option exists so a NEW deal can start without a status. Writing it to a SAVED deal
         * clears the column, and the server cannot put it back: the opening default is creation-only,
         * and applyStageDefaults sees a deliberate null as caller-supplied and leaves it alone. The
         * result is the state DealEntityServer's own comment calls fatal -- a deal every IsOpen/IsWon
         * rollup skips. The option is disabled in the template as well; this is the half that does not
         * depend on a template being right.
         */
        if (id === null && this.Record.IsSaved) return;
        /**
         * ON A CLOSED DEAL THIS IS A REOPEN REQUEST, not a field edit. Writing the status directly
         * would unlock the deal with none of the reopen having run -- no event, stamps still set, order
         * still voided -- and nothing downstream would refuse it. So the pick is held, the reason is
         * asked for, and `Sales.ReopenDeal` performs the status change.
         */
        if (this.CurrentStatusIsClosing) {
            this.PendingReopenStatusID = id;
            this.ReopenReason = '';
            this.ActionMessage = '';
            this.ActionIssues = [];
            this.ActionFailed = false;
            return;
        }
        /**
         * AND A CLOSING PICK IS A CLOSE REQUEST, for the same reason (golive#205: "Changing Deal Status
         * to Won or Lost should close the deal properly").
         *
         * The server would now run the close on a bare write — `close-deal.CD27` measures that — so this
         * is not the last line of defence it once was. What it is for is the LOSS REASON. A Lost close
         * needs one, the panel has not collected it at the moment of the pick, and a status write
         * without it is refused outright before anything is saved. Holding the pick is how the reason
         * gets collected, and it is the same reason `ConfirmClose` exists rather than a plain write.
         */
        const picked = this.statuses().find((s) => s.ID.toLowerCase() === String(id).toLowerCase());
        if (picked?.LocksDeal) {
            this.PendingCloseStatusID = picked.ID;
            this.LossReasonID = null;
            this.LossNotes = '';
            this.CloseNotes = '';
            this.ActionMessage = '';
            this.ActionIssues = [];
            this.ActionFailed = false;
            return;
        }
        this.Record.DealStatusTypeID = id;
    }

    /* -- Closing from the Status control (golive#205) ------------------------------------ */

    /** The closing status the user picked on an open deal, held until the close is confirmed. */
    public PendingCloseStatusID: string | null = null;
    public LossReasonID: string | null = null;
    public LossNotes = '';
    public CloseNotes = '';
    public readonly LossReasons = signal<LossReasonOption[]>([]);

    public get PendingCloseStatus(): DealStatusOption | null {
        const id = String(this.PendingCloseStatusID ?? '').toLowerCase();
        if (!id) return null;
        return this.statuses().find((s) => s.ID.toLowerCase() === id) ?? null;
    }

    public get PendingCloseStatusName(): string {
        return this.PendingCloseStatus?.Name ?? '';
    }

    public get LossReasonRequiresNotes(): boolean {
        return this.LossReasons().find((r) => r.ID === this.LossReasonID)?.RequiresNotes === true;
    }

    /** The shared rule, so this surface and the Close panel cannot disagree about a complete close. */
    public get CanConfirmClose(): boolean {
        if (this.Busy) return false;
        return CloseDetailComplete(this.PendingCloseStatus, this.LossReasonID, this.LossNotes, this.LossReasons());
    }

    /** A reason that no longer needs notes must not carry the old ones into the close. */
    public OnLossReasonChange(): void {
        if (!this.LossReasonRequiresNotes) {
            this.LossNotes = '';
        }
    }

    public CancelClose(): void {
        this.PendingCloseStatusID = null;
        this.LossReasonID = null;
        this.LossNotes = '';
        this.CloseNotes = '';
        this.ActionMessage = '';
        this.ActionIssues = [];
        this.ActionFailed = false;
    }

    public async ConfirmClose(): Promise<void> {
        const target = this.PendingCloseStatus;
        if (!this.CanConfirmClose || !this.Record || !target) return;
        this.Busy = true;
        this.ActionMessage = '';
        this.ActionIssues = [];
        try {
            /**
             * UNSAVED EDITS ARE SAVED FIRST. A close routes the deal's lines, so closing the persisted
             * state would build an order from data the user is not looking at. `true` ends edit mode,
             * which is what lets the refresh below actually run -- `canRefreshRecord()` is
             * `record && IsSaved && !EditMode`.
             */
            if (this.EditMode || this.Record.Dirty) {
                if (!(await this.FormComponent.SaveRecord(true))) {
                    this.ActionFailed = true;
                    this.ActionMessage = 'The deal could not be saved, so it was not closed. Fix the errors above and try again.';
                    return;
                }
            }
            const result = await RunClose({
                dealID: this.Record.ID,
                target,
                lossReasonID: this.LossReasonID,
                lossNotes: this.LossNotes,
                notes: this.CloseNotes,
            });
            this.ActionFailed = !result.ok;
            this.ActionMessage = result.message;
            this.ActionIssues = result.issues;
            if (result.ok) {
                this.CancelPendingOnly();
                await this.refreshQuietly();
            }
        } finally {
            this.Busy = false;
        }
    }

    /** Clears the pending pick without wiping the message the caller just set. */
    private CancelPendingOnly(): void {
        this.PendingCloseStatusID = null;
        this.LossReasonID = null;
        this.LossNotes = '';
        this.CloseNotes = '';
    }

    private async refreshQuietly(): Promise<void> {
        // The operation has committed by here; a reload that throws is a stale screen, not a failure,
        // and must not rewrite the message above it.
        try {
            await this.FormComponent.RefreshRecord();
        } catch {
            this.ActionIssues = [...this.ActionIssues, 'The deal was updated, but this page could not reload. Refresh to see it.'];
        }
    }

    /* -- Reopening from the Status control (golive#205 D9) ------------------------------- */

    /** The open status the user picked on a closed deal, held until they give a reason. */
    public PendingReopenStatusID: string | null = null;
    public ReopenReason = '';
    public Busy = false;
    public ActionMessage = '';
    public ActionFailed = false;
    public ActionIssues: string[] = [];

    public get PendingReopenStatusName(): string {
        const id = String(this.PendingReopenStatusID ?? '').toLowerCase();
        return this.statuses().find((s) => s.ID.toLowerCase() === id)?.Name ?? '';
    }

    /**
     * Confirmable as soon as a target is picked. The reason is NOT part of this test.
     *
     * golive#205: "No reopen reason should be required in this path." `Sales.ReopenDeal` still refuses
     * a blank one -- CD10 pins that, and it is right for an API or agent caller, where an unexplained
     * reopen has no human at the other end to have meant anything by it. This path always sends one,
     * so both hold: nobody is made to type, and nothing lands unexplained.
     */
    public get CanConfirmReopen(): boolean {
        return !this.Busy && !!this.PendingReopenStatusID;
    }

    /** See the module-level {@link ReopenReasonOrDefault}: one rule, both panels. */
    public ResolvedReopenReason(): string {
        return ReopenReasonOrDefault(this.ReopenReason, this.PendingReopenStatusName);
    }

    public CancelReopen(): void {
        this.PendingReopenStatusID = null;
        this.ReopenReason = '';
        this.ActionMessage = '';
        this.ActionIssues = [];
        this.ActionFailed = false;
    }

    public async ConfirmReopen(): Promise<void> {
        if (!this.CanConfirmReopen || !this.Record) return;
        this.Busy = true;
        this.ActionMessage = '';
        this.ActionIssues = [];
        try {
            /**
             * WHAT THE USER TYPED IS SAVED FIRST -- see {@link MJSDealFieldPanel.SaveBeforeReload} for
             * why that is legal under the close lock, which this method's own comment used to deny.
             *
             * BEFORE THE OPERATION, NEVER AFTER, and the order is the load-bearing part. Once
             * `Sales.ReopenDeal` has committed, this record still holds the CLOSED status in both
             * `Value` and `OldValue` -- the operation moved the ROW, not the copy in the browser, and
             * {@link SetStatus} only ever HELD the pick. A save at that point writes the stale closing
             * status straight back over the reopened row.
             *
             * AND NOTHING WOULD REFUSE IT, which is what makes the ordering a correctness matter rather
             * than a tidiness one. Both halves of the status field are equal, so it is CLEAN:
             * `planStatusTransition` returns null on `!field?.Dirty` and never runs the close, and the
             * golive#205 trigger therefore never sees this at all. The write still happens — an MJ update
             * sends every field with `AllowUpdateAPI` and applies no dirty filter — so the row ends up
             * closed again with `ClosedAt` still cleared by the reopen, and no refusal anywhere. It is
             * the shape of the defect #205 was filed about, arrived at by the one route #205's own guard
             * cannot cover. The refresh below is the only thing that may follow the operation.
             */
            if (!(await this.SaveBeforeReload())) {
                this.ActionFailed = true;
                this.ActionMessage =
                    'Your unsaved changes could not be saved, so the deal was not reopened. Fix the errors above and try again.';
                return;
            }
            const result = await RunReopen(this.Record.ID, this.ResolvedReopenReason(), this.PendingReopenStatusID);
            this.ActionFailed = !result.ok;
            this.ActionMessage = result.message;
            this.ActionIssues = result.issues;
            if (result.ok) {
                this.PendingReopenStatusID = null;
                this.ReopenReason = '';
                /**
                 * EDIT MODE HAS TO END BEFORE THE RELOAD, and that is load-bearing rather than tidy.
                 *
                 * `BaseFormComponent.canRefreshRecord()` is `record && record.IsSaved && !this.EditMode`,
                 * and this control renders ONLY inside `@if (EditMode)` -- so EVERY reopen that reaches
                 * here started in edit mode, `RefreshRecord()` returned false, and the form went on
                 * showing a Won, locked deal the server had already reopened: stale badges, stale stage,
                 * and a lock notice telling the user to reopen a deal that was open. It returns false
                 * rather than throwing, so the catch below never covered it either.
                 *
                 * A BARE `EndEditMode()` AND NOT `SaveRecord(true)`, but no longer because saving is
                 * forbidden here -- it is not, and {@link MJSDealFieldPanel.SaveBeforeReload} above has
                 * already done it. This call is what covers the case that method deliberately skips: a
                 * reopen with nothing dirty saves nothing, so nothing has ended edit mode yet, and
                 * without this the refresh below would reload nothing.
                 *
                 * It is a no-op on the path where the save ran -- `SaveRecord(true)` ends edit mode
                 * itself -- and calling it anyway is cheaper than asking which path we are on.
                 */
                this.FormComponent.EndEditMode();
                // The reopen is committed by now; a reload that throws afterwards is a stale screen,
                // not a failed reopen, so it must not rewrite the message above.
                try {
                    await this.FormComponent.RefreshRecord();
                } catch {
                    this.ActionIssues = [...this.ActionIssues, 'The deal was reopened, but this page could not reload. Refresh to see it.'];
                }
            }
        } finally {
            this.Busy = false;
        }
    }

    /** @see PIPELINE_FIELDS — a getter so the Overview can borrow the creation ones while unsaved. */
    public get Fields(): DealFieldSpec[] {
        // See the party panel: absence is not the same state as unsaved.
        if (!this.Record || this.Record.IsSaved) return [...PIPELINE_FIELDS];
        return PIPELINE_FIELDS.filter((f) => !CREATION_PIPELINE_FIELDS.includes(f.name));
    }
}

const PIPELINE_FIELDS: readonly DealFieldSpec[] = [
        // Name and DealNumber are deliberately NOT here. The hero directly above this panel already
        // renders Name as an editable field in edit mode, and shows DealNumber beneath the title once
        // the server has assigned one. Listing them again gave the form two inputs bound to the same
        // column, and offered an empty textbox for a value the user does not get to choose.
        { name: 'PipelineID', type: 'textbox', link: 'Record' },
        { name: 'PipelineStageID', type: 'textbox', link: 'Record' },
        { name: 'DealTypeID', type: 'textbox', link: 'Record' },
        { name: 'ForecastCategoryTypeID', type: 'textbox', link: 'Record' },
        { name: 'Probability', type: 'number' },
];

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-party',
    skipNullKeyWarning: true,
    metadata: { entity: E, slot: 'after-fields', sortKey: 80, contributionKey: 'party' },
})
@Component({
    selector: 'mjs-deal-party-panel',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, BaseFormsModule],
    styles: [FIELD_STYLES],
    template: `
        <mj-collapsible-panel SectionKey="party" SectionName="Account &amp; people" Icon="fa-solid fa-building"
            [Form]="FormComponent" [FormContext]="FormContext">
            <div class="mjs-fields">
                @for (f of Fields; track f.name) {
                    <div class="mjs-field" [class.mjs-field--span]="f.span">
                        <mj-form-field [Record]="Record" [ShowLabel]="true" [FieldName]="f.name" [Type]="f.type"
                            [EditMode]="EditMode && FieldEditable(f.name)" [FormContext]="FormContext" [LinkType]="f.link ?? 'None'"
                            (Navigate)="FormComponent.OnFormNavigate($event)"></mj-form-field>
                    </div>
                }
            </div>
        </mj-collapsible-panel>
    `,
})
export class MJSDealPartyPanel extends MJSDealFieldPanel {
    /**
     * Record links on these fields emit `Navigate` from `mj-form-field`. That output must be
     * forwarded to `FormComponent.OnFormNavigate`, which Explorer maps onto
     * `NavigationService.OpenEntityRecord`. Without the binding the cells look like links and
     * do nothing — the Overview / hero buttons already go through this path.
     */
    /**
     * While the deal is UNSAVED the Overview renders the party fields a person sets, so this panel
     * drops exactly those — one binding per column, never two.
     *
     * FILTERED BY THE SHARED LIST, not by restating three names. `CREATION_PARTY_FIELDS` is what the
     * Overview iterates, so a field added there leaves here automatically and the two cannot end up
     * both claiming it.
     *
     * The server-maintained pair stays either way. On a new deal both are empty, which is honest:
     * Company fills itself from the pipeline on save, and Owner comes from the deal team — which
     * cannot be edited until the deal exists.
     */
    public get Fields(): DealFieldSpec[] {
        // NO RECORD MEANS NO BORROW. `Record?.IsSaved` alone read undefined as "unsaved" and handed
        // back the filtered list to a panel that had no deal at all — hiding fields on the strength of
        // a record nobody had set yet. The borrow is a fact about an UNSAVED DEAL, not about absence.
        if (!this.Record || this.Record.IsSaved) return [...PARTY_FIELDS];
        return PARTY_FIELDS.filter((f) => !CREATION_PARTY_FIELDS.includes(f.name));
    }
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-commercial',
    skipNullKeyWarning: true,
    metadata: { entity: E, slot: 'after-fields', sortKey: 70, contributionKey: 'commercial' },
})
@Component({
    selector: 'mjs-deal-commercial-panel',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, BaseFormsModule],
    styles: [FIELD_STYLES],
    template: `
        <mj-collapsible-panel SectionKey="commercial" SectionName="Commercial" Icon="fa-solid fa-coins"
            [Form]="FormComponent" [FormContext]="FormContext">
            <div class="mjs-fields">
                @for (f of Fields; track f.name) {
                    <div class="mjs-field" [class.mjs-field--span]="f.span">
                        <mj-form-field [Record]="Record" [ShowLabel]="true" [FieldName]="f.name" [Type]="f.type"
                            [EditMode]="EditMode && FieldEditable(f.name)" [FormContext]="FormContext" [LinkType]="f.link ?? 'None'"
                            (Navigate)="FormComponent.OnFormNavigate($event)"></mj-form-field>
                    </div>
                }
            </div>
        </mj-collapsible-panel>
    `,
})
export class MJSDealCommercialPanel extends MJSDealFieldPanel {
    public readonly Fields: DealFieldSpec[] = [
        { name: 'Amount', type: 'number' },
        { name: 'CurrencyID', type: 'textbox' },
        { name: 'TermMonths', type: 'number' },
        { name: 'EstimatedProjectWeeks', type: 'number' },
        { name: 'MRR', type: 'number' },
        { name: 'ARR', type: 'number' },
        { name: 'ExpectedCloseDate', type: 'datepicker' },
        { name: 'StartDate', type: 'datepicker' },
        { name: 'ExecutionDate', type: 'datepicker' },
        { name: 'AutoRenew', type: 'checkbox' },
        { name: 'PaymentMethod', type: 'textbox' },
        { name: 'Description', type: 'textarea', span: true },
    ];
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-lines',
    skipNullKeyWarning: true,
    metadata: { entity: E, slot: 'after-related', sortKey: 68, contributionKey: 'lines' },
})
@Component({
    selector: 'mjs-deal-lines-panel',
    standalone: true,
    imports: [CommonModule, BaseFormsModule, MJSDealLineEditorComponent],
    template: `
        <mj-collapsible-panel SectionKey="lines" SectionName="What's being sold" Icon="fa-solid fa-boxes-stacked"
            Variant="related-entity" [Form]="FormComponent" [FormContext]="FormContext" [DefaultExpanded]="!Record.IsSaved"
            [BadgeCount]="FormComponent.GetSectionRowCount('lines')">
            @if (Record.IsSaved && Record.OrderID) {
                <!-- OUR OWN ADD BUTTON, because the grid's New opened the generic Order Line form
                     (golive#229). Hidden on a locked deal for the same reason the grid's New was. -->
                @if (!IsLocked) {
                    <div class="mjs-deal-lines__bar">
                        <button type="button" class="mjs-deal-lines__add" (click)="AddLine()">
                            <i class="fa-solid fa-plus" aria-hidden="true"></i> Add a product
                        </button>
                    </div>
                } @else {
                    <!-- SAYS WHY, where the control used to be. Hiding Add told a rep nothing, and the
                         row double-click is now refused as well (golive#206 item 1) — so without this
                         the panel would simply stop responding with no account of itself. One sentence,
                         the same one the server's refusal and the deal workspace use. -->
                    <p class="mjs-deal-empty">
                        <i class="fa-solid fa-lock" aria-hidden="true"></i>
                        {{ LineEditBlockedReason }}
                    </p>
                }
                <!-- NEW IS HIDDEN ON A LOCKED DEAL (bc-aidp-next-golive#206 item 1). The tester added a
                     line to a Won deal through this toolbar and it saved: "the grid should hide its New
                     and delete buttons when the deal is locked".

                     DELETE IS NOT BOUND HERE ON PURPOSE. ShowDeleteButton defaults to FALSE, so the
                     toolbar never offers delete on any deal; binding it to !IsLocked would START showing
                     it on open ones, which is the opposite of what the issue asks. Stage history sets it
                     to false explicitly for the same reason it sets New to false: there, both are off on
                     every deal.

                     THIS IS THE FORM HALF ONLY. The server half -- refusing the line save whichever path
                     it arrives by -- needs the order-line veto from bizapps-orders#206, which is not
                     published yet. Hiding a button is not a lock, and this comment is here so nobody
                     reads it as one. -->

                <!-- NEW IS HIDDEN ON A LOCKED DEAL (bc-aidp-next-golive#206 item 1). The tester added a
                     line to a Won deal through this toolbar and it saved: "the grid should hide its New
                     and delete buttons when the deal is locked".

                     DELETE IS NOT BOUND HERE ON PURPOSE. ShowDeleteButton defaults to FALSE, so the
                     toolbar never offers delete on any deal; binding it to !IsLocked would START showing
                     it on open ones, which is the opposite of what the issue asks. Stage history sets it
                     to false explicitly for the same reason it sets New to false: there, both are off on
                     every deal.

                     THIS IS THE FORM HALF ONLY. The server half -- refusing the line save whichever path
                     it arrives by -- needs the order-line veto from bizapps-orders#206, which is not
                     published yet. Hiding a button is not a lock, and this comment is here so nobody
                     reads it as one. -->
                <!-- ShowNewButton and NavigateOnDoubleClick are BOTH off, and that pair is the fix
                     (golive#229). Either one left on re-opens the generic Order Line form, which
                     renders Unit Price as a plain editable field and lets a rep type any price with no
                     discount recorded — the thing D-DL2 says must be impossible. A row double-click now
                     opens the restricted editor instead; Navigate is left unbound because with
                     NavigateOnDoubleClick off the grid never emits it. -->
                <mj-explorer-entity-data-grid
                    [Params]="Params"
                    [AllowLoad]="FormComponent.IsSectionExpanded('lines')"
                    [ShowToolbar]="true"
                    [ShowNewButton]="false"
                    [NavigateOnDoubleClick]="false"
                    (AfterRowDoubleClick)="EditLine($event)"
                    (AfterDataLoad)="OnDataLoad($event)">
                </mj-explorer-entity-data-grid>
            } @else if (!Record.IsSaved) {
                <!-- THE CASE THE HINT EXISTS FOR (bc-aidp-next-golive#216). This branch used to be
                     gated on Record.IsSaved, so it told a SAVED deal to save and showed a brand-new
                     one nothing at all: neither branch matched, the panel rendered empty, and a tester
                     reported no way to add products and no message saying why. -->
                <p class="mjs-deal-empty">
                    <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
                    Save this deal to create its order, then add products here. A deal has no order —
                    and so nowhere to put a product — until it has been saved once.
                </p>
            } @else {
                <!-- Saved, but no order to hang lines on. A deal mints its order on save, so this is the
                     legacy row that closed before that was true: DealEntityServer deliberately does not
                     mint one for a deal whose whole point has passed. Telling that rep to save would be
                     the same wrong answer as before, one case over. -->
                <p class="mjs-deal-empty">This deal has no order, so there is nothing to add products to.</p>
            }

            @if (EditorOpen) {
                <mjs-deal-line-editor
                    [Deal]="Record"
                    [LineID]="EditingLineID"
                    (Saved)="OnLineSaved()"
                    (Closed)="CloseEditor()">
                </mjs-deal-line-editor>
            }
        </mj-collapsible-panel>
    `,
    styles: [`
        .mjs-deal-empty { margin: 0; padding: var(--mj-space-4) var(--mj-space-5); color: var(--mj-text-muted); display: flex; gap: 8px; align-items: baseline; }
        .mjs-deal-lines__bar { display: flex; padding: var(--mj-space-3) var(--mj-space-5) 0; }
        .mjs-deal-lines__add {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 6px 12px; border-radius: var(--mj-radius-md, 8px); cursor: pointer;
            border: 1px solid var(--mj-border-default); background: var(--mj-bg-surface);
            color: var(--mj-text-default); font: inherit; font-weight: 600;
        }
        .mjs-deal-lines__add:hover { background: var(--mj-bg-surface-hover); }
    `],
})
export class MJSDealLinesPanel extends BaseFormPanel<DealEntity> {
    /**
     * Whether the deal's persisted status locks it.
     *
     * Read off the form component, which resolved it once per load through the shared
     * `ResolveDealLockState` -- the same answer the field panels gate on. Resolving it again here would
     * be a second answer to a question that already has one.
     */
    /**
     * Why lines cannot be changed, for the panel and for anything that needs to say so.
     *
     * Word for word what `DealLockRefusal('update')` produces on the server and what the deal
     * workspace shows, so a rep meets ONE sentence wherever the same lock refuses them. Repeated
     * rather than imported because the server helper lives in a package that cannot be bundled for a
     * browser; `deal-lock-refusal-copy` pins the copies together.
     */
    public get LineEditBlockedReason(): string {
        return 'This deal is closed. Set the status back to Open before changing what was sold.';
    }

    public get IsLocked(): boolean {
        return (this.FormComponent as unknown as { IsLocked?: boolean } | undefined)?.IsLocked === true;
    }

    public get Params() {
        const id = this.Record?.OrderID;
        if (!id) return null;
        return { EntityName: MJS_FOREIGN_ENTITIES.OrderLine, ExtraFilter: `OrderHeaderID = '${String(id).replace(/'/g, "''")}'` };
    }
    public OnDataLoad(event: AfterDataLoadEventArgs): void {
        this.FormComponent.SetSectionRowCount('lines', event.totalRowCount);
    }

    /* ── The restricted line editor (bc-aidp-next-golive#229) ─────────────────────────────────── */

    /** Whether the editor dialog is mounted. */
    public EditorOpen = false;
    /** The line being edited; null means a new one. */
    public EditingLineID: string | null = null;

    /** The grid itself, so a saved line can make it re-read rather than leaving it stale. */
    @ViewChild(ExplorerEntityDataGridComponent) private linesGrid?: ExplorerEntityDataGridComponent;

    public AddLine(): void {
        this.EditingLineID = null;
        this.EditorOpen = true;
    }

    /**
     * Opens the restricted editor for a row.
     *
     * The grid hands back the ROW, not an entity, so the primary key is read off it. A row without an
     * ID is not a click that can be honoured — silently doing nothing beats opening an empty editor
     * that would save a second, unrelated line.
     */
    public EditLine(event: AfterRowDoubleClickEventArgs): void {
        /**
         * A CLOSED DEAL DOES NOT OPEN THE EDITOR (golive#206 item 1).
         *
         * The grid renders OUTSIDE this panel's `@if (!IsLocked)` block — deliberately, because a
         * locked deal must still show what was sold — so the Add button disappearing did not take the
         * double-click with it. A rep could open a Won deal's line and type into all four fields; the
         * refusal arrived from the server veto after they pressed Save.
         *
         * Nothing is lost by refusing: the grid already displays product, quantity, discount and the
         * priced figures, so the editor offers no READING this panel does not. That is the difference
         * from the workspace's full line detail, which carries fields with no other surface and so
         * opens read-only instead of not at all.
         *
         * The reason is already on screen — the panel renders it where the Add button would be — so a
         * double-click that does nothing is explained rather than silent.
         */
        if (this.IsLocked) return;

        const row = event?.row as Record<string, unknown> | undefined;
        const id = row?.['ID'];
        if (!id) return;
        this.EditingLineID = String(id);
        this.EditorOpen = true;
    }

    public CloseEditor(): void {
        this.EditorOpen = false;
        this.EditingLineID = null;
    }

    /**
     * A saved line must change the GRID, not just close the dialog.
     *
     * Without the re-read the rep saves a product and the panel still shows the old set — which reads
     * exactly like a save that silently did nothing, the failure mode the Explorer harness exists to
     * catch.
     */
    public OnLineSaved(): void {
        this.CloseEditor();
        void this.linesGrid?.Refresh();
    }
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-motion',
    skipNullKeyWarning: true,
    metadata: { entity: E, slot: 'after-fields', sortKey: 60, contributionKey: 'motion' },
})
@Component({
    selector: 'mjs-deal-motion-panel',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, BaseFormsModule],
    styles: [FIELD_STYLES],
    template: `
        <mj-collapsible-panel SectionKey="motion" SectionName="Motion" Icon="fa-solid fa-person-walking"
            [Form]="FormComponent" [FormContext]="FormContext">
            <div class="mjs-fields">
                @for (f of Fields; track f.name) {
                    <div class="mjs-field" [class.mjs-field--span]="f.span">
                        <mj-form-field [Record]="Record" [ShowLabel]="true" [FieldName]="f.name" [Type]="f.type"
                            [EditMode]="EditMode && FieldEditable(f.name)" [FormContext]="FormContext" [LinkType]="f.link ?? 'None'"
                            (Navigate)="FormComponent.OnFormNavigate($event)"></mj-form-field>
                    </div>
                }
            </div>
        </mj-collapsible-panel>
    `,
})
export class MJSDealMotionPanel extends MJSDealFieldPanel {
    /**
     * ── THE TWO ORDER/CONTRACT CHANGES HERE (bc-aidp-next-golive#226) ───────────────────────────
     *
     * **`OrderID` CARRIES NO LINK ANY MORE** (item 4). It used to open the order from every deal,
     * including an OPEN one whose order is still a draft nobody should be editing directly. Reps
     * price inside the deal; the order becomes reachable once the deal is won, and the hero's chip
     * row is where that now happens because only it knows the outcome. The row stays as a READ of
     * the order's name — the provenance is worth showing — it is just not a way in.
     *
     * Deliberately not gated on `IsWon` here instead: a link that appears and disappears from a
     * field list is harder to reason about than one place that owns the rule, and the hero already
     * owns it.
     *
     * **THE TWO CONTRACT FIELDS NOW LINK** (item 3). They rendered raw GUIDs because they are SOFT
     * references — `Deal.ContractID`'s own column comment says so — so `EntityField.RelatedEntity`
     * was unset and `mj-form-field` had no name to show and nowhere to go. The soft FK now ships as
     * metadata (`metadata/entity-fields/.deal-contract-soft-fk.json`), which is what makes
     * `LinkType='Record'` resolve the contract number here AND gives the field an FK search in edit
     * mode instead of asking a rep to paste a UUID. The chips cannot serve this: `RenewsContractID`
     * has to be SET on a renewal deal, and a chip is a link.
     */
    public readonly Fields: DealFieldSpec[] = [
        { name: 'NextStep', type: 'textbox', span: true },
        { name: 'NextStepDate', type: 'datepicker' },
        { name: 'LeadSourceTypeID', type: 'textbox', link: 'Record' },
        { name: 'CampaignID', type: 'textbox' },
        { name: 'OrderID', type: 'textbox' },
        { name: 'ContractID', type: 'textbox', link: 'Record' },
        { name: 'RenewsContractID', type: 'textbox', link: 'Record' },
        { name: 'ContractVariances', type: 'textarea', span: true },
    ];
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-close',
    skipNullKeyWarning: true,
    metadata: { entity: E, slot: 'after-fields', sortKey: 52, contributionKey: 'close' },
})
@Component({
    selector: 'mjs-deal-close-panel',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, FormsModule, BaseFormsModule],
    styles: [FIELD_STYLES, CLOSE_ACTION_STYLES],
    template: `
        <mj-collapsible-panel SectionKey="close" SectionName="Close" Icon="fa-solid fa-flag-checkered"
            [Form]="FormComponent" [FormContext]="FormContext">

            <!-- THE ACTION, not a status field (bc-aidp-next-golive#205).
                 The deal workspace closes through Sales.CloseDeal and its status dropdown has never
                 offered a closing status. This form filters the same way now, which left it with no way
                 to close a deal at all -- the panel below is fields, and fields are not an action.
                 So the door the workspace uses is put here too. -->
            @if (CanClose) {
                <div class="mjs-close-action">
                    @if (!PanelOpen) {
                        <button type="button" class="mjs-close-action__start" (click)="OpenPanel()">
                            <i class="fa-solid fa-flag-checkered" aria-hidden="true"></i> Close this deal
                        </button>
                        <small class="mjs-close-action__hint">
                            Records the outcome, writes the stage history, and for a won B2B deal creates
                            the contract and finance tasks.
                        </small>
                    } @else {
                        <div class="mjs-close-action__form">
                            <!-- The real closing statuses, by name, from the flags. A Won/Lost pair
                                 could not express a deployment with more than one losing status, and
                                 this one has two: Lost and Abandoned both carry IsLost, so resolving
                                 the target with find(IsLost) picked whichever sorted first and left
                                 Abandoned unreachable from the form entirely. -->
                            <div class="mjs-close-action__row">
                                @for (s of ClosingStatuses; track s.ID) {
                                    <label>
                                        <input type="radio" name="dealCloseTarget" [value]="s.ID"
                                               [(ngModel)]="TargetStatusID" (ngModelChange)="OnTargetChange()"
                                               [disabled]="Closing" /> {{ s.Name }}
                                    </label>
                                }
                            </div>

                            @if (SelectedStatus?.IsLost) {
                                <label class="mjs-close-action__field">
                                    <span>Loss reason</span>
                                    <select [(ngModel)]="LossReasonID" (ngModelChange)="OnLossReasonChange()"
                                            [disabled]="Closing">
                                        <option [ngValue]="null">— choose —</option>
                                        @for (r of LossReasons(); track r.ID) {
                                            <option [ngValue]="r.ID">{{ r.Name }}</option>
                                        }
                                    </select>
                                </label>
                                @if (LossReasonRequiresNotes) {
                                    <label class="mjs-close-action__field">
                                        <span>Loss notes <em>(required for this reason)</em></span>
                                        <textarea rows="2" [(ngModel)]="LossNotes" [disabled]="Closing"></textarea>
                                    </label>
                                }
                            }

                            <label class="mjs-close-action__field">
                                <span>Notes <em>(optional)</em></span>
                                <textarea rows="2" [(ngModel)]="Notes" [disabled]="Closing"></textarea>
                            </label>

                            <div class="mjs-close-action__row">
                                <button type="button" class="mjs-close-action__confirm"
                                        [disabled]="!CanConfirm" (click)="ConfirmClose()">
                                    {{ Closing ? 'Closing…' : 'Close deal' }}
                                </button>
                                <button type="button" class="mjs-close-action__cancel"
                                        [disabled]="Closing" (click)="CancelClose()">Cancel</button>
                            </div>
                        </div>
                    }

                </div>
            }

            <!-- REOPENING, the other half of bc-aidp-next-golive#205 (golive#206 item 3 keeps Deal
                 Status frozen, so this is the only way back). The report named two defects, not one:
                 "no contract was created ... and there is no way to reopen it". Filtering the closing
                 statuses out fixed the first and left the second exactly as it was, while the Status
                 hint now tells the user to reopen the deal — a promise the form could not keep. -->
            @if (CanReopen) {
                <div class="mjs-close-action">
                    @if (!ReopenPanelOpen) {
                        <button type="button" class="mjs-close-action__start" (click)="OpenReopenPanel()">
                            <i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Reopen this deal
                        </button>
                        <small class="mjs-close-action__hint">
                            Records the reason on the stage history, clears the close stamps and returns
                            the order to the pipeline. Refused if the order has already booked.
                        </small>
                    } @else {
                        <div class="mjs-close-action__form">
                            <label class="mjs-close-action__field">
                                <span>Reason <em>(optional)</em></span>
                                <textarea rows="2" [(ngModel)]="ReopenReason" [disabled]="Closing"></textarea>
                            </label>
                            <div class="mjs-close-action__row">
                                <button type="button" class="mjs-close-action__confirm"
                                        [disabled]="!CanConfirmReopen" (click)="ConfirmReopen()">
                                    {{ Closing ? 'Reopening…' : 'Reopen deal' }}
                                </button>
                                <button type="button" class="mjs-close-action__cancel"
                                        [disabled]="Closing" (click)="CancelReopen()">Cancel</button>
                            </div>
                        </div>
                    }
                </div>
            }

            <!-- OUTSIDE both gates, deliberately. These used to sit inside the CanClose block, and
                 ConfirmClose ends with RefreshRecord() - which locks the deal, flips CanClose to false
                 and unmounted the whole block. The confirmation and every warning the close produced
                 were destroyed by the refresh that produced them, so a close whose contract was stubbed
                 or whose finance task could not be routed reported NOTHING. golive#205 asks for exactly
                 the opposite: "Any downstream step that did not happen ... should show on the form
                 after the save." -->
            @if (Message || Issues.length) {
                <div class="mjs-close-action">
                    @if (Message) {
                        <div class="mjs-close-action__msg" [class.is-error]="MessageIsError">{{ Message }}</div>
                    }
                    <!-- Tracked by index: the operation pushes one issue per task, so two tasks
                         failing the same way produce two identical strings, and tracking by the string
                         itself is a duplicate-key error. -->
                    @for (i of Issues; track $index) {
                        <div class="mjs-close-action__issue">{{ i }}</div>
                    }
                </div>
            }

            <div class="mjs-fields">
                @for (f of Fields; track f.name) {
                    <div class="mjs-field" [class.mjs-field--span]="f.span">
                        <mj-form-field [Record]="Record" [ShowLabel]="true" [FieldName]="f.name" [Type]="f.type"
                            [EditMode]="EditMode && FieldEditable(f.name)" [FormContext]="FormContext" [LinkType]="f.link ?? 'None'"
                            (Navigate)="FormComponent.OnFormNavigate($event)"></mj-form-field>
                    </div>
                }
            </div>
        </mj-collapsible-panel>
    `,
})
export class MJSDealClosePanel extends MJSDealFieldPanel {
    public PanelOpen = false;
    public ReopenPanelOpen = false;
    public ReopenReason = '';
    /**
     * One in-flight flag for BOTH operations, not two.
     *
     * Close and reopen are mutually exclusive by lock state — `CanClose` and `CanReopen` can never be
     * true at once — so a second flag could only ever disagree with this one. It keeps its name because
     * the close came first; the button label says which is running.
     */
    public Closing = false;
    public TargetStatusID: string | null = null;
    public LossReasonID: string | null = null;
    public LossNotes = '';
    public Notes = '';
    public Message = '';
    public MessageIsError = false;
    public Issues: string[] = [];
    /** Signals for the same reason the Pipeline panel uses them -- see the note on `statuses` there. */
    public readonly LossReasons = signal<LossReasonOption[]>([]);

    private readonly statuses = signal<DealStatusOption[]>([]);

    public async ngOnInit(): Promise<void> {
        /**
         * Settled rather than all-or-nothing. `Promise.all` rejects on the first failure, and an
         * unhandled rejection in `ngOnInit` left BOTH lists empty with nothing on screen to say so --
         * a loss-reason outage would have taken the close action down with it. Each list now fails on
         * its own, and `CanClose` treats an unresolved status list as "not offerable" rather than
         * guessing.
         */
        const settled = await Promise.allSettled([LoadDealStatusOptions(), LoadLossReasons()]);
        const valueOf = <T>(r: PromiseSettledResult<T>): T | null =>
            r.status === 'fulfilled' ? r.value : null; // vocabulary-grep-allow: PromiseSettledResult discriminant, not a domain status

        const loadedStatuses = valueOf(settled[0] as PromiseSettledResult<DealStatusOption[]>);
        const loadedReasons = valueOf(settled[1] as PromiseSettledResult<LossReasonOption[]>);
        if (loadedStatuses) {
            this.statuses.set(loadedStatuses);
        }
        if (loadedReasons) {
            this.LossReasons.set(loadedReasons);
        }
        if (!loadedStatuses || !loadedReasons) {
            this.Fail('Some of this panel could not load. Reload the page before closing this deal.');
        }
    }

    /**
     * The loaded row for the deal's current status, or null when the list does not contain it.
     *
     * Same resolver, same reasoning as the Pipeline panel: an unresolved status means "not known", and
     * both actions below treat not-knowing as a reason to offer nothing.
     */
    private get currentStatus(): DealStatusOption | null {
        const id = String(this.Record?.DealStatusTypeID ?? '').toLowerCase();
        if (!id) return null;
        return this.statuses().find((s) => s.ID.toLowerCase() === id) ?? null;
    }

    /**
     * Only an open, saved deal can be closed — and FAILS CLOSED on a status it cannot resolve.
     *
     * The earlier version asked `!some(locks)`, so an empty or still-loading list answered "nothing
     * locks, therefore it is open" and offered Close on a deal that was already closed. That is the
     * same fail-open shape the Pipeline panel had, and the two now agree: unknown means neither action.
     */
    public get CanClose(): boolean {
        if (!this.Record?.IsSaved) return false;
        const current = this.currentStatus;
        return current !== null && !current.LocksDeal;
    }

    /**
     * The mirror of {@link CanClose}: only a saved, CLOSED deal can be reopened.
     *
     * Deliberately NOT `!CanClose` — that would offer the action on an unsaved deal, which has nothing
     * to reopen, and on a deal whose status list failed to load, where nothing is known to lock. Both
     * read the same resolver, so a status that vanishes from the list leaves BOTH actions hidden rather
     * than leaving the form offering one the server would refuse.
     */
    public get CanReopen(): boolean {
        if (!this.Record?.IsSaved) return false;
        return this.currentStatus?.LocksDeal === true;
    }

    /**
     * `Sales.ReopenDeal` REQUIRES a reason — §7.3 makes undoing a lock explainable, and CD10 pins it.
     *
     * Worth stating because golive#205 asks for the opposite ("No reopen reason should be required in
     * this path"). Refusing here rather than letting the operation refuse keeps the round trip off a
     * request that cannot succeed, and matches how the workspace's reopen behaves.
     */
    /**
     * Confirmable as soon as the panel is open. The reason is NOT part of this test, for the same
     * reason it is not on the Pipeline panel -- see the module-level {@link ReopenReasonOrDefault}.
     * This panel used to demand one while that one did not, which a user saw as the same button
     * working in one place and not the other.
     */
    public get CanConfirmReopen(): boolean {
        return !this.Closing;
    }

    /** See the module-level {@link ReopenReasonOrDefault}: one rule, both panels. */
    public ResolvedReopenReason(): string {
        return ReopenReasonOrDefault(this.ReopenReason, null);
    }

    /** The statuses a close may land in, by flag. Their names are the user's choice of outcome. */
    public get ClosingStatuses(): DealStatusOption[] {
        return this.statuses().filter((s) => s.LocksDeal);
    }

    /** The row the user picked, or null before they pick one. */
    public get SelectedStatus(): DealStatusOption | null {
        if (!this.TargetStatusID) return null;
        const id = this.TargetStatusID.toLowerCase();
        return this.statuses().find((s) => s.ID.toLowerCase() === id) ?? null;
    }

    public get LossReasonRequiresNotes(): boolean {
        return this.LossReasons().find((r) => r.ID === this.LossReasonID)?.RequiresNotes === true;
    }

    /**
     * Changing the outcome drops the loss detail that belonged to the old one.
     *
     * The notes field only RENDERS while a reason needing notes is selected, so a user who typed notes
     * against "Competitor" and then switched to "Price" could not see that the text was still there --
     * and it was still submitted, against a reason that contradicts it. Nothing downstream could tell.
     */
    public OnTargetChange(): void {
        if (!this.SelectedStatus?.IsLost) {
            this.LossReasonID = null;
            this.LossNotes = '';
        }
    }

    public OnLossReasonChange(): void {
        if (!this.LossReasonRequiresNotes) {
            this.LossNotes = '';
        }
    }

    /**
     * What the operation will refuse anyway, refused here first.
     *
     * Not a second rule: `Sales.CloseDeal` validates the same things and is the one that matters,
     * since an import or an agent never comes through this panel. This only spares the round trip.
     */
    public get CanConfirm(): boolean {
        if (this.Closing) return false;
        const target = this.SelectedStatus;
        if (!target) return false;
        if (target.IsLost) {
            if (!this.LossReasonID) return false;
            if (this.LossReasonRequiresNotes && !this.LossNotes.trim()) return false;
        }
        return true;
    }

    public OpenPanel(): void {
        this.PanelOpen = true;
        this.TargetStatusID = null;
        this.LossReasonID = null;
        this.LossNotes = '';
        this.Notes = '';
        this.Message = '';
        this.Issues = [];
    }

    public CancelClose(): void {
        this.PanelOpen = false;
        this.Message = '';
        this.Issues = [];
    }

    /**
     * Close the deal through the operation.
     *
     * UNSAVED EDITS ARE SAVED FIRST, for the reason the workspace records: a close routes the deal's
     * lines, so closing the persisted state would build an order from data the user is not looking at,
     * and discarding the edits would drop work silently. If the save is refused the close is NOT
     * attempted and the refusal stands on screen, with the deal intact and still open.
     *
     * THE TARGET STATUS IS FOUND BY FLAG. A deployment may call its winning status "Signed"; matching
     * on the word would report "no such status" on a perfectly good database.
     */
    public async ConfirmClose(): Promise<void> {
        if (!this.CanConfirm || !this.Record) return;

        const target = this.SelectedStatus;
        if (!target) {
            this.Fail('Pick an outcome first.');
            return;
        }

        this.Closing = true;
        this.Message = '';
        this.Issues = [];
        try {
            /**
             * `true` ENDS EDIT MODE, and that is load-bearing rather than cosmetic.
             *
             * `BaseFormComponent.canRefreshRecord()` is `record && record.IsSaved && !this.EditMode`,
             * so with edit mode still on, the `RefreshRecord()` at the end of this method returned
             * false and reloaded nothing -- on exactly the path that took it. The form went on showing
             * the pre-close record: old status, blank close stamps, and `CanClose` still true, so the
             * button re-rendered and a second click fired `Sales.CloseDeal` at a locked deal.
             */
            if (this.EditMode || this.Record.Dirty) {
                if (!(await this.FormComponent.SaveRecord(true))) {
                    this.Fail('The deal could not be saved, so it was not closed. Fix the errors above and try again.');
                    return;
                }
            }

            /**
             * TWO LAYERS OF SUCCESS, and checking only the outer one is a mistake this repo has made
             * before: `Success` on the envelope means the operation RAN. Whether the deal actually
             * closed is `Output.Success`.
             */
            const router = Metadata.Provider as unknown as DealCloseOperationRouter;
            const envelope = await router.RouteOperation<SalesCloseDealInput, SalesCloseDealOutput>(
                'Sales.CloseDeal',
                {
                    DealID: this.Record.ID,
                    DealStatusTypeID: target.ID,
                    LossReasonID: target.IsLost ? this.LossReasonID : null,
                    LossNotes: target.IsLost ? (this.LossNotes.trim() || null) : null,
                    Notes: this.Notes.trim() || null,
                },
            );
            if (!envelope.Success) {
                this.Fail(envelope.ErrorMessage ?? 'Sales.CloseDeal could not be reached.');
                return;
            }
            const out = envelope.Output;
            if (!out?.Success) {
                this.Issues = (out?.Issues ?? []).map((i) => i.Message);
                this.Fail(out?.Issues?.[0]?.Message ?? 'The deal could not be closed.');
                return;
            }

            this.PanelOpen = false;
            this.MessageIsError = false;
            this.Message = `Deal closed as ${target.Name}.`;
            // WARNINGS ON A SUCCESSFUL CLOSE are the interesting ones -- a stubbed downstream, a finance
            // task that could not be routed, an order status orders refused. Reporting only failures
            // would call a half-done close clean.
            this.Issues = (out.Issues ?? []).map((i) => i.Message);
            // OUTSIDE the try that wraps the operation. The close is committed by this point, and a
            // reload that throws afterwards is a display problem -- letting it reach the catch below
            // replaced "Deal closed as Won." with "The close did not complete", on a deal that closed.
            await this.refreshQuietly();
        } catch (err) {
            this.Fail(`The close did not complete: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            this.Closing = false;
        }
    }

    public OpenReopenPanel(): void {
        this.ReopenPanelOpen = true;
        this.ReopenReason = '';
        this.Message = '';
        this.MessageIsError = false;
        this.Issues = [];
    }

    public CancelReopen(): void {
        this.ReopenPanelOpen = false;
        this.ReopenReason = '';
        this.Message = '';
        this.MessageIsError = false;
        this.Issues = [];
    }

    /**
     * The audited way back through the lock (bc-aidp-next-golive#205).
     *
     * Mirrors {@link ConfirmClose}, including the part that is easy to drop: a reopen can return
     * `Success: true` WITH issues, and those are the ones that matter most. S-US8's reopen asks the
     * order to come back while it sits at `Voided`, which orders treats as terminal — the deal reopens
     * regardless, because an order-side refusal must never block a stage change, so this list is the
     * only thing standing between the rep and a live deal pointing at a dead order.
     *
     * IT DOES SAVE FIRST, which this comment used to say it must not. The old reasoning was that "a
     * locked deal has almost nothing editable, and the close lock would refuse the save anyway". Both
     * halves were wrong in the same direction: the carve-out is six fields and this panel renders one
     * of them (Loss Notes, on a lost deal), and the lock refuses only a DIRTY FROZEN field -- see
     * {@link MJSDealFieldPanel.SaveBeforeReload}.
     *
     * UNLIKE THE STATUS CONTROL, this button is not inside `@if (EditMode)`, so it is reachable in read
     * mode as well. There the record is clean, nothing is saved and nothing changes. In EDIT mode it
     * used to reopen the deal and then reload nothing at all -- `canRefreshRecord()` is false while
     * edit mode is on -- leaving a reopened deal rendered as closed and locked, which is the same stale
     * screen the Pipeline panel's reopen fixed for itself and this one was left with.
     */
    public async ConfirmReopen(): Promise<void> {
        if (!this.CanConfirmReopen || !this.Record) return;

        this.Closing = true;
        this.Message = '';
        this.Issues = [];
        try {
            // Before the operation, never after: the record still holds the CLOSED status afterwards,
            // so a save then would write it back over the reopened row. Same reasoning as the Pipeline
            // panel's reopen, which spells it out.
            if (!(await this.SaveBeforeReload())) {
                this.Fail('Your unsaved changes could not be saved, so the deal was not reopened. Fix the errors above and try again.');
                return;
            }
            // The SAME runner the Status control uses. Two surfaces reach the reopen now and a second
            // copy of the envelope-versus-Output handling is exactly the drift the review found between
            // this form and the deal workspace. No target status: this door does not choose one, so the
            // operation applies its own default.
            const result = await RunReopen(this.Record.ID, this.ResolvedReopenReason(), null);
            this.Issues = result.issues;
            if (!result.ok) {
                this.Fail(result.message);
                return;
            }
            this.ReopenPanelOpen = false;
            this.ReopenReason = '';
            this.MessageIsError = false;
            this.Message = result.message;
            // Covers the reopen that had nothing to save, exactly as it does on the Pipeline panel: with
            // edit mode still on, `refreshQuietly()` reloads nothing and reports no failure either.
            this.FormComponent.EndEditMode();
            await this.refreshQuietly();
        } finally {
            this.Closing = false;
        }
    }

    /**
     * Reload the record without letting a reload failure rewrite the outcome.
     *
     * Both operations commit server-side before this runs, so a throw here means the screen is stale,
     * not that the deal did not close. The message already on screen is the true one; this only adds a
     * line saying the view is behind.
     */
    private async refreshQuietly(): Promise<void> {
        try {
            await this.FormComponent.RefreshRecord();
        } catch {
            this.Issues = [...this.Issues, 'The deal was updated, but this page could not reload. Refresh to see it.'];
        }
    }

    private Fail(message: string): void {
        this.MessageIsError = true;
        this.Message = message;
    }

    public readonly Fields: DealFieldSpec[] = [
        { name: 'ActualCloseDate', type: 'datepicker' },
        { name: 'ClosedAt', type: 'datepicker' },
        { name: 'ClosedByUserID', type: 'textbox', link: 'Record' },
        { name: 'LossReasonID', type: 'textbox', link: 'Record' },
        { name: 'StandardAgreementModified', type: 'checkbox' },
        { name: 'AnnualIncreasePctOverride', type: 'number' },
        { name: 'CancellationNoticeDaysOverride', type: 'number' },
        { name: 'LossNotes', type: 'textarea', span: true },
    ];
}

/* ── Related, renamed ─────────────────────────────────────────────────────── */

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-related-internal-team',
    skipNullKeyWarning: true,
    metadata: {
        entity: E, slot: 'after-related', sortKey: 50, contributionKey: 'internal-team',
        relatedEntity: MJS_ENTITIES.DealTeamMember, relatedJoinField: 'DealID',
    },
})
@Component({
    selector: 'mjs-deal-internal-team-panel',
    standalone: true,
    imports: [CommonModule, BaseFormsModule],
    template: `
        <mj-collapsible-panel SectionKey="internal-team" SectionName="Internal team" Icon="fa-solid fa-users"
            Variant="related-entity" [Form]="FormComponent" [FormContext]="FormContext" [DefaultExpanded]="!Record.IsSaved"
            [BadgeCount]="FormComponent.GetSectionRowCount('internal-team')">
            @if (Record.IsSaved) {
                <mj-explorer-entity-data-grid
                    [Params]="FormComponent.BuildRelationshipViewParamsByEntityName(Entity, 'DealID')"
                    [NewRecordValues]="FormComponent.NewRecordValues(Entity, 'DealID')"
                    [AllowLoad]="FormComponent.IsSectionExpanded('internal-team')"
                    [ShowToolbar]="true"
                    (Navigate)="FormComponent.OnFormNavigate($event)"
                    (AfterDataLoad)="OnDataLoad($event)">
                </mj-explorer-entity-data-grid>
            } @else {
                <p class="mjs-deal-empty">Save the deal first. Team members are recorded against it once it exists.</p>
            }
        </mj-collapsible-panel>
    `,
    styles: [EMPTY_STATE_STYLES],
})
export class MJSDealTeamGridPanel extends BaseFormPanel<DealEntity> {
    public readonly Entity = MJS_ENTITIES.DealTeamMember;
    public OnDataLoad(event: AfterDataLoadEventArgs): void {
        this.FormComponent.SetSectionRowCount('internal-team', event.totalRowCount);
    }
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-related-buying-team',
    skipNullKeyWarning: true,
    metadata: {
        entity: E, slot: 'after-related', sortKey: 48, contributionKey: 'buying-team',
        relatedEntity: MJS_ENTITIES.DealContactRole, relatedJoinField: 'DealID',
    },
})
@Component({
    selector: 'mjs-deal-buying-team-panel',
    standalone: true,
    imports: [CommonModule, BaseFormsModule],
    template: `
        <mj-collapsible-panel SectionKey="buying-team" SectionName="Buying team" Icon="fa-solid fa-user-tag"
            Variant="related-entity" [Form]="FormComponent" [FormContext]="FormContext" [DefaultExpanded]="!Record.IsSaved"
            [BadgeCount]="FormComponent.GetSectionRowCount('buying-team')">
            @if (Record.IsSaved) {
                <mj-explorer-entity-data-grid
                    [Params]="FormComponent.BuildRelationshipViewParamsByEntityName(Entity, 'DealID')"
                    [NewRecordValues]="FormComponent.NewRecordValues(Entity, 'DealID')"
                    [AllowLoad]="FormComponent.IsSectionExpanded('buying-team')"
                    [ShowToolbar]="true"
                    (Navigate)="FormComponent.OnFormNavigate($event)"
                    (AfterDataLoad)="OnDataLoad($event)">
                </mj-explorer-entity-data-grid>
            } @else {
                <p class="mjs-deal-empty">Save the deal first. Contacts are linked to it once it exists.</p>
            }
        </mj-collapsible-panel>
    `,
    styles: [EMPTY_STATE_STYLES],
})
export class MJSDealBuyingTeamPanel extends BaseFormPanel<DealEntity> {
    public readonly Entity = MJS_ENTITIES.DealContactRole;
    public OnDataLoad(event: AfterDataLoadEventArgs): void {
        this.FormComponent.SetSectionRowCount('buying-team', event.totalRowCount);
    }
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-related-activity',
    skipNullKeyWarning: true,
    metadata: {
        entity: E, slot: 'after-related', sortKey: 88, contributionKey: 'activity',
        relatedEntity: MJS_FOREIGN_ENTITIES.ActivityLink, relatedJoinField: 'RecordID',
    },
})
@Component({
    selector: 'mjs-deal-activity-panel',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, BaseFormsModule, EntityViewerModule, DealActivityTimelineComponent],
    template: `
        <mj-collapsible-panel SectionKey="activity" SectionName="Activity" Icon="fa-solid fa-timeline"
            Variant="related-entity" [Form]="FormComponent" [FormContext]="FormContext" [DefaultExpanded]="true">
            @if (Record.IsSaved) {
                <div class="mjs-deal-activity">
                    <mjs-deal-activity-timeline [DealID]="Record.ID" [ComposeOnly]="true"
                        (Logged)="OnLogged()"></mjs-deal-activity-timeline>
                    @if (ActivityEntity) {
                        <div class="mjs-deal-activity__viewer">
                            <mj-entity-viewer
                                [Entity]="ActivityEntity"
                                [ViewEntity]="ActivityView"
                                (RecordOpened)="OnActivityOpened($event)">
                            </mj-entity-viewer>
                        </div>
                    }
                </div>
            } @else {
                <p class="mjs-deal-empty">Save the deal first. Activity is logged against it from then on.</p>
            }
        </mj-collapsible-panel>
    `,
    styles: [EMPTY_STATE_STYLES, `
        .mjs-deal-activity { display: flex; flex-direction: column; gap: var(--mj-space-3); padding: var(--mj-space-3) var(--mj-space-4) var(--mj-space-5); min-height: 0; }
        .mjs-deal-activity__viewer {
            min-height: 420px; height: 480px;
            display: flex; flex-direction: column;
            border: 1px solid var(--mj-border-default); border-radius: var(--mj-radius-md); overflow: hidden;
        }
        .mjs-deal-activity__viewer mj-entity-viewer {
            display: flex; flex-direction: column; flex: 1 1 auto; height: 100%; width: 100%;
        }
    `],
})
export class MJSDealActivityPanel extends BaseFormPanel<DealEntity> {
    private readonly cdr = inject(ChangeDetectorRef);
    public ActivityEntity: EntityInfo | null = null;
    public ActivityView: ReturnType<typeof SyntheticActivityView> | null = null;

    public async ngOnInit(): Promise<void> {
        const md = new Metadata();
        this.ActivityEntity = md.Entities.find((e) => e.Name === MJS_FOREIGN_ENTITIES.Activity) ?? null;
        await this.refreshView();
    }

    public override OnRecordRefreshed(_record: DealEntity): void {
        void this.refreshView();
    }

    public OnLogged(): void {
        void this.refreshView();
    }

    public OnActivityOpened(event: RecordOpenedEvent): void {
        const id = (event.compositeKey?.GetValueByFieldName('ID') ?? event.record?.['ID']) as string | undefined;
        if (!id) return;
        this.FormComponent.OnFormNavigate({
            Kind: 'record',
            EntityName: MJS_FOREIGN_ENTITIES.Activity,
            PrimaryKey: CompositeKey.FromID(id),
        });
    }

    private async refreshView(): Promise<void> {
        if (!this.ActivityEntity || !this.Record?.ID) {
            this.ActivityView = null;
            return;
        }
        const md = new Metadata();
        const dealEntityID = md.Entities.find((e) => e.Name === MJS_ENTITIES.Deal)?.ID;
        if (!dealEntityID) {
            this.ActivityView = SyntheticActivityView(this.ActivityEntity, '1 = 0');
            this.cdr.detectChanges();
            return;
        }
        const rv = new RunView();
        const anchors = await rv.RunView<{ ActivityID: string }>({
            EntityName: MJS_FOREIGN_ENTITIES.ActivityLink,
            ExtraFilter: `EntityID = '${dealEntityID.replace(/'/g, "''")}' AND RecordID = '${String(this.Record.ID).replace(/'/g, "''")}'`,
            Fields: ['ActivityID'],
            ResultType: 'simple',
        });
        const ids = anchors.Success
            ? [...new Set((anchors.Results ?? []).map((r) => String(r.ActivityID)).filter(Boolean))]
            : [];
        const where = ids.length
            ? `ID IN (${ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(',')})`
            : '1 = 0';
        this.ActivityView = SyntheticActivityView(this.ActivityEntity, where);
        this.cdr.detectChanges();
    }
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-related-stage-history',
    skipNullKeyWarning: true,
    metadata: {
        entity: E, slot: 'after-related', sortKey: 44, contributionKey: 'stage-history',
        relatedEntity: MJS_ENTITIES.DealStageEvent, relatedJoinField: 'DealID',
    },
})
@Component({
    selector: 'mjs-deal-history-panel',
    standalone: true,
    imports: [CommonModule, BaseFormsModule],
    template: `
        <mj-collapsible-panel SectionKey="stage-history" SectionName="Stage history" Icon="fa-solid fa-clock-rotate-left"
            Variant="related-entity" [Form]="FormComponent" [FormContext]="FormContext" [DefaultExpanded]="!Record.IsSaved"
            [BadgeCount]="FormComponent.GetSectionRowCount('stage-history')">
            @if (Record.IsSaved) {
                <mj-explorer-entity-data-grid
                    [Params]="FormComponent.BuildRelationshipViewParamsByEntityName(Entity, 'DealID')"
                    [NewRecordValues]="FormComponent.NewRecordValues(Entity, 'DealID')"
                    [AllowLoad]="FormComponent.IsSectionExpanded('stage-history')"
                    [ShowToolbar]="true"
                    [ShowNewButton]="false"
                    [ShowDeleteButton]="false"
                    (Navigate)="FormComponent.OnFormNavigate($event)"
                    (AfterDataLoad)="OnDataLoad($event)">
                </mj-explorer-entity-data-grid>
            } @else {
                <p class="mjs-deal-empty">Save the deal first. Stage changes are recorded from then on.</p>
            }
        </mj-collapsible-panel>
    `,
    styles: [EMPTY_STATE_STYLES],
})
/**
 * READ-ONLY ON EVERY DEAL, open or closed (bc-aidp-next-golive#206 item 5).
 *
 * These rows are written by the server as part of each save -- they are the deal's audit trail, and a
 * hand-typed one is a lie about what happened. The toolbar stays for search and export; only the two
 * write affordances go.
 *
 * `ShowDeleteButton` already defaults to false. It is set anyway, because a default is not a decision
 * and this panel should not quietly grow a delete button if that default ever changes.
 */
export class MJSDealHistoryPanel extends BaseFormPanel<DealEntity> {
    public readonly Entity = MJS_ENTITIES.DealStageEvent;
    public OnDataLoad(event: AfterDataLoadEventArgs): void {
        this.FormComponent.SetSectionRowCount('stage-history', event.totalRowCount);
    }
}

@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-related-payment-schedule',
    skipNullKeyWarning: true,
    metadata: {
        entity: E, slot: 'after-related', sortKey: 42, contributionKey: 'payment-schedule',
        relatedEntity: MJS_ENTITIES.DealPaymentSchedule, relatedJoinField: 'DealID',
    },
})
@Component({
    selector: 'mjs-deal-schedule-panel',
    standalone: true,
    imports: [CommonModule, BaseFormsModule],
    template: `
        <mj-collapsible-panel SectionKey="payment-schedule" SectionName="Payment schedule" Icon="fa-solid fa-calendar-week"
            Variant="related-entity" [Form]="FormComponent" [FormContext]="FormContext" [DefaultExpanded]="!Record.IsSaved"
            [BadgeCount]="FormComponent.GetSectionRowCount('payment-schedule')">
            @if (Record.IsSaved) {
                <mj-explorer-entity-data-grid
                    [Params]="FormComponent.BuildRelationshipViewParamsByEntityName(Entity, 'DealID')"
                    [NewRecordValues]="FormComponent.NewRecordValues(Entity, 'DealID')"
                    [AllowLoad]="FormComponent.IsSectionExpanded('payment-schedule')"
                    [ShowToolbar]="true"
                    (Navigate)="FormComponent.OnFormNavigate($event)"
                    (AfterDataLoad)="OnDataLoad($event)">
                </mj-explorer-entity-data-grid>
            } @else {
                <p class="mjs-deal-empty">Save the deal first. Payments are scheduled against it once it exists.</p>
            }
        </mj-collapsible-panel>
    `,
    styles: [EMPTY_STATE_STYLES],
})
export class MJSDealSchedulePanel extends BaseFormPanel<DealEntity> {
    public readonly Entity = MJS_ENTITIES.DealPaymentSchedule;
    public OnDataLoad(event: AfterDataLoadEventArgs): void {
        this.FormComponent.SetSectionRowCount('payment-schedule', event.totalRowCount);
    }
}
