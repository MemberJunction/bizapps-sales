/**
 * @fileoverview `DealEntityServer` — a deal and everything hanging off it, written in ONE transaction.
 *
 * WHY A SERVER SUBCLASS AT ALL. A deal is not one row. Saving a header, then its lines, then its
 * instalments, as separate round trips means a failure partway leaves a numbered deal with nothing
 * under it — and there is no way for the caller to clean that up correctly, because it cannot know how
 * far the write got. Composing the tree here, behind one transaction, is what makes "save this deal"
 * an atomic statement.
 *
 * This is the pattern accounting established in `JournalEntryEntityServer`: transient child
 * collections on the header, and a `Save()` override that walks header → deletions → children inside
 * `BeginTransaction`/`CommitTransaction`. The ordering is not cosmetic — see the comments in
 * {@link DealEntityServer.Save}.
 *
 * WHAT LIVES HERE AND NOT IN THE UI. Everything that must hold regardless of who is writing. An
 * Action, an agent, a raw `BaseEntity.Save()` and the deal workspace all come through this method, so
 * a rule enforced here cannot be bypassed by a caller that forgot about it. That is why the close lock
 * (S4) belongs here rather than in a disabled Save button.
 *
 * WHAT THIS FILE MUST NEVER DO. Arithmetic on money. No summing lines into `Amount`, no applying
 * `RequestedDiscountPct`, no deriving `Total` from `AnnualGrossFees - DiscountAmount`, no checking
 * that the payment schedule adds up. `Amount` is a cached answer from `Orders.PreviewOrder` carrying
 * its own provenance; the signed figures on a line are transcriptions. Both are facts this app
 * records, not results it computes.
 *
 * ── STILL TO COME (deliberately not stubbed) ────────────────────────────────────────────────────
 *   - S4: the CLOSE LOCK. When the deal's status has `DealStatusType.LocksDeal = 1`, the header
 *     (except Description / NextStep), its lines and its team become immutable, and reopening goes
 *     through `Sales.ReopenDeal` with a recorded reason.
 *   - S4: `DealStageEvent` append on stage transition, stamping `AmountAtTransition` and
 *     `ProbabilityAtTransition`.
 * Each of those is a behaviour change with its own tests, so none of them is faked here.
 *
 * `DealNumber` assignment landed in Phase 2 — see step 0 of {@link DealEntityServer.Save}.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import {
    BaseEntity,
    DatabaseProviderBase,
    EntitySaveOptions,
    IMetadataProvider,
    IRunViewProvider,
    LogError,
    UserInfo,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
    mjBizAppsSalesDealEntity,
    mjBizAppsSalesDealLineEntity,
    mjBizAppsSalesDealPaymentScheduleEntity,
    mjBizAppsSalesDealTeamMemberEntity,
} from '@mj-biz-apps/sales-entities';

import { getNextDealNumber } from './SequenceService.js';

const DEAL_ENTITY = 'MJ_BizApps_Sales: Deals';
const DEAL_LINE_ENTITY = 'MJ_BizApps_Sales: Deal Lines';
const DEAL_SCHEDULE_ENTITY = 'MJ_BizApps_Sales: Deal Payment Schedules';
const DEAL_TEAM_ENTITY = 'MJ_BizApps_Sales: Deal Team Members';
const DEAL_ROLE_ENTITY = 'MJ_BizApps_Sales: Deal Roles';

@RegisterClass(BaseEntity, DEAL_ENTITY)
export class DealEntityServer extends mjBizAppsSalesDealEntity {
    private _lines: mjBizAppsSalesDealLineEntity[] = [];
    private _deletedLines: mjBizAppsSalesDealLineEntity[] = [];
    private _schedule: mjBizAppsSalesDealPaymentScheduleEntity[] = [];
    private _deletedSchedule: mjBizAppsSalesDealPaymentScheduleEntity[] = [];

    /**
     * Async validation always runs on this path. The base class defaults to skipping it; a deal that
     * composes a whole tree is exactly the case where you want it, and silently skipping validation
     * on the one code path every write takes would defeat the point of putting rules here.
     */
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    public get Lines(): mjBizAppsSalesDealLineEntity[] {
        return this._lines;
    }

    public get PaymentSchedule(): mjBizAppsSalesDealPaymentScheduleEntity[] {
        return this._schedule;
    }

    /* ── Lines ──────────────────────────────────────────────────────────────── */

    /**
     * Attaches an existing line entity to this deal. Sets the FK and a provisional `DisplayOrder`;
     * both are re-derived on save, so the array's order is what actually decides.
     */
    public AddLine(line: mjBizAppsSalesDealLineEntity): void {
        line.DealID = this.ID;
        line.DisplayOrder = (this._lines.length + 1) * 10;
        this._lines.push(line);
    }

    /**
     * Detaches a line. A line that has already been persisted goes onto the deletion queue rather than
     * simply vanishing from the array — otherwise the row would survive in the database while being
     * absent from the object, which is the silent-divergence bug this queue exists to prevent.
     */
    public RemoveLine(lineOrIndex: mjBizAppsSalesDealLineEntity | number): boolean {
        const idx = typeof lineOrIndex === 'number' ? lineOrIndex : this._lines.indexOf(lineOrIndex);
        if (idx < 0 || idx >= this._lines.length) {
            return false;
        }
        const [removed] = this._lines.splice(idx, 1);
        if (removed.IsSaved) {
            this._deletedLines.push(removed);
        }
        this.resequenceLines();
        return true;
    }

    /** Creates a new, empty line already attached to this deal. */
    public async CreateLine(contextUser?: UserInfo): Promise<mjBizAppsSalesDealLineEntity> {
        const provider = this.ProviderToUse as unknown as IMetadataProvider;
        const line = await provider.GetEntityObject<mjBizAppsSalesDealLineEntity>(
            DEAL_LINE_ENTITY,
            contextUser ?? this.ContextCurrentUser,
        );
        line.NewRecord();
        this.AddLine(line);
        return line;
    }

    /**
     * Loads this deal's persisted lines into the collection.
     *
     * THROWS on failure rather than returning an empty array. `RunView` does not throw on its own, and
     * a silently empty result here would make the next `Save()` treat every existing line as removed.
     * A load that failed and a deal with no lines must never look the same.
     */
    public async LoadLines(contextUser?: UserInfo): Promise<mjBizAppsSalesDealLineEntity[]> {
        if (!this.IsSaved) {
            return this._lines;
        }
        const provider = this.ProviderToUse as unknown as IRunViewProvider;
        const result = await provider.RunView<mjBizAppsSalesDealLineEntity>(
            {
                EntityName: DEAL_LINE_ENTITY,
                ExtraFilter: `DealID = '${this.ID}'`,
                OrderBy: 'DisplayOrder ASC',
                ResultType: 'entity_object',
            },
            contextUser ?? this.ContextCurrentUser,
        );
        if (!result.Success) {
            throw new Error(`DealEntityServer.LoadLines failed for deal ${this.ID}: ${result.ErrorMessage}`);
        }
        this._lines = result.Results ?? [];
        this._deletedLines = [];
        return this._lines;
    }

    /* ── Payment schedule ───────────────────────────────────────────────────── */

    public AddScheduleRow(row: mjBizAppsSalesDealPaymentScheduleEntity): void {
        row.DealID = this.ID;
        row.DisplayOrder = (this._schedule.length + 1) * 10;
        this._schedule.push(row);
    }

    public RemoveScheduleRow(rowOrIndex: mjBizAppsSalesDealPaymentScheduleEntity | number): boolean {
        const idx = typeof rowOrIndex === 'number' ? rowOrIndex : this._schedule.indexOf(rowOrIndex);
        if (idx < 0 || idx >= this._schedule.length) {
            return false;
        }
        const [removed] = this._schedule.splice(idx, 1);
        if (removed.IsSaved) {
            this._deletedSchedule.push(removed);
        }
        this.resequenceSchedule();
        return true;
    }

    public async CreateScheduleRow(contextUser?: UserInfo): Promise<mjBizAppsSalesDealPaymentScheduleEntity> {
        const provider = this.ProviderToUse as unknown as IMetadataProvider;
        const row = await provider.GetEntityObject<mjBizAppsSalesDealPaymentScheduleEntity>(
            DEAL_SCHEDULE_ENTITY,
            contextUser ?? this.ContextCurrentUser,
        );
        row.NewRecord();
        this.AddScheduleRow(row);
        return row;
    }

    /** Same contract as {@link LoadLines}, including throwing rather than returning empty. */
    public async LoadPaymentSchedule(contextUser?: UserInfo): Promise<mjBizAppsSalesDealPaymentScheduleEntity[]> {
        if (!this.IsSaved) {
            return this._schedule;
        }
        const provider = this.ProviderToUse as unknown as IRunViewProvider;
        const result = await provider.RunView<mjBizAppsSalesDealPaymentScheduleEntity>(
            {
                EntityName: DEAL_SCHEDULE_ENTITY,
                ExtraFilter: `DealID = '${this.ID}'`,
                OrderBy: 'DisplayOrder ASC',
                ResultType: 'entity_object',
            },
            contextUser ?? this.ContextCurrentUser,
        );
        if (!result.Success) {
            throw new Error(`DealEntityServer.LoadPaymentSchedule failed for deal ${this.ID}: ${result.ErrorMessage}`);
        }
        this._schedule = result.Results ?? [];
        this._deletedSchedule = [];
        return this._schedule;
    }

    /* ── Save ───────────────────────────────────────────────────────────────── */

    /**
     * Writes the deal and its children as one unit.
     *
     * THE ORDER INSIDE THE TRANSACTION IS LOAD-BEARING:
     *   1. HEADER FIRST — a new deal has no ID until it is saved, and every child needs it for its FK.
     *   2. DELETIONS NEXT — before inserts, so a re-sequenced `DisplayOrder` cannot collide with a row
     *      that is about to be removed.
     *   3. CHILDREN LAST, re-numbered from array position, so the collection order is the truth and
     *      gaps never accumulate.
     *
     * Any failure throws, which rolls the whole thing back: either the deal and all its children
     * landed, or nothing did.
     */
    public override async Save(options?: EntitySaveOptions): Promise<boolean> {
        const dbProvider = this.ProviderToUse as unknown as DatabaseProviderBase;

        try {
            await dbProvider.BeginTransaction();

            /**
             * 0. DEAL NUMBER, for a new deal that has none.
             *
             * INSIDE the transaction and BEFORE the header insert, both deliberately. Inside, so a save
             * that rolls back releases the number and the next deal reuses it — the counter stays
             * gap-free, which is the whole point of taking it from a locked row rather than from
             * `MAX(DealNumber) + 1`. Before, because `DealNumber` carries a filtered UNIQUE index and
             * assigning it after the insert would mean a second write to a row that is already visible.
             *
             * Only ever assigned once: an existing number is never regenerated, so re-saving a deal
             * cannot renumber it — a deal number appears in contracts, orders and people's email.
             */
            if (!this.IsSaved && !this.DealNumber) {
                this.DealNumber = await getNextDealNumber(
                    this.ContextCurrentUser,
                    this.ProviderToUse as unknown as IMetadataProvider,
                );
            }

            // 1. Header first — children need this.ID.
            const savedHeader = await super.Save(options);
            if (!savedHeader) {
                throw new Error(
                    `Failed to save Deal header: ${this.LatestResult?.CompleteMessage ?? 'unknown error'}`,
                );
            }

            // 2. Deletions before inserts.
            await this.flushDeletions(this._deletedLines, 'line', options);
            this._deletedLines = [];
            await this.flushDeletions(this._deletedSchedule, 'payment schedule row', options);
            this._deletedSchedule = [];

            // 3. Children, re-sequenced from array order.
            let order = 10;
            for (const line of this._lines) {
                line.DealID = this.ID;
                line.DisplayOrder = order;
                order += 10;
                if (!(await line.Save(options))) {
                    throw new Error(
                        `Failed to save deal line ${line.DisplayOrder}: ${line.LatestResult?.CompleteMessage ?? 'unknown error'}`,
                    );
                }
            }

            order = 10;
            for (const row of this._schedule) {
                row.DealID = this.ID;
                row.DisplayOrder = order;
                order += 10;
                if (!(await row.Save(options))) {
                    throw new Error(
                        `Failed to save payment schedule row ${row.DisplayOrder}: ${row.LatestResult?.CompleteMessage ?? 'unknown error'}`,
                    );
                }
            }

            await dbProvider.CommitTransaction();
            return true;
        } catch (err) {
            LogError(`Exception during DealEntityServer.Save(): ${err}`);
            try {
                await dbProvider.RollbackTransaction();
            } catch (rollbackErr) {
                LogError(`Failed to rollback transaction during DealEntityServer.Save(): ${rollbackErr}`);
            }
            return false;
        }
    }

    /* ── Owner stamp (§5.1) ─────────────────────────────────────────────────── */

    /**
     * Records who owns this deal, and maintains the denormalized `OwnerEmployeeID` stamp.
     *
     * `DealTeamMember` IS the source of truth for who is on a deal, including the owner;
     * `Deal.OwnerEmployeeID` exists only so "my deals" and per-rep boards need no join. That is why
     * this method writes the team row FIRST and derives the stamp from it, rather than the other way
     * round — and why nothing outside this class should ever assign `OwnerEmployeeID` directly.
     *
     * Called from `Sales.SaveDeal` when the caller expressed an owner as intent. Must run INSIDE the
     * caller's transaction, so it does not open one of its own.
     */
    public async SetOwner(employeeID: string, contextUser?: UserInfo): Promise<void> {
        const user = contextUser ?? this.ContextCurrentUser;
        const metaProvider = this.ProviderToUse as unknown as IMetadataProvider;
        const viewProvider = this.ProviderToUse as unknown as IRunViewProvider;

        // The owner role is whichever role carries IsOwnerRole — resolved from the FLAG, never from a
        // role name. That is what lets a deployment rename "Owner" to "Account Executive" with no code
        // change, and it is the rule the CI grep enforces.
        const roleResult = await viewProvider.RunView(
            {
                EntityName: DEAL_ROLE_ENTITY,
                ExtraFilter: 'IsOwnerRole = 1 AND IsActive = 1',
                ResultType: 'simple',
                Fields: ['ID'],
            },
            user,
        );
        if (!roleResult.Success) {
            throw new Error(`DealEntityServer.SetOwner: could not resolve the owner role: ${roleResult.ErrorMessage}`);
        }
        const ownerRole = (roleResult.Results ?? [])[0] as { ID?: string } | undefined;
        if (!ownerRole?.ID) {
            throw new Error(
                'DealEntityServer.SetOwner: no active DealRole has IsOwnerRole = 1. Seed one before assigning an owner.',
            );
        }

        // Is this employee already the owner? Then there is nothing to write.
        const existing = await viewProvider.RunView<mjBizAppsSalesDealTeamMemberEntity>(
            {
                EntityName: DEAL_TEAM_ENTITY,
                ExtraFilter: `DealID = '${this.ID}' AND DealRoleID = '${ownerRole.ID}'`,
                ResultType: 'entity_object',
            },
            user,
        );
        if (!existing.Success) {
            throw new Error(`DealEntityServer.SetOwner: could not read the deal team: ${existing.ErrorMessage}`);
        }

        const current = (existing.Results ?? [])[0];
        if (current) {
            if (current.EmployeeID === employeeID) {
                this.OwnerEmployeeID = employeeID;
                return;
            }
            // Exactly one member may hold the owner role, so an owner change REPLACES rather than adds.
            current.EmployeeID = employeeID;
            current.PersonID = null;
            if (!(await current.Save())) {
                throw new Error(
                    `DealEntityServer.SetOwner: failed to reassign the owner: ${current.LatestResult?.CompleteMessage ?? 'unknown error'}`,
                );
            }
        } else {
            const member = await metaProvider.GetEntityObject<mjBizAppsSalesDealTeamMemberEntity>(DEAL_TEAM_ENTITY, user);
            member.NewRecord();
            member.DealID = this.ID;
            member.EmployeeID = employeeID;
            member.DealRoleID = ownerRole.ID;
            member.IsActive = true;
            if (!(await member.Save())) {
                throw new Error(
                    `DealEntityServer.SetOwner: failed to create the owner team member: ${member.LatestResult?.CompleteMessage ?? 'unknown error'}`,
                );
            }
        }

        this.OwnerEmployeeID = employeeID;
    }

    /* ── Internals ──────────────────────────────────────────────────────────── */

    private async flushDeletions(
        rows: Array<mjBizAppsSalesDealLineEntity | mjBizAppsSalesDealPaymentScheduleEntity>,
        label: string,
        options?: EntitySaveOptions,
    ): Promise<void> {
        for (const row of rows) {
            if (!(await row.Delete(options))) {
                throw new Error(
                    `Failed to delete ${label}: ${row.LatestResult?.CompleteMessage ?? 'unknown error'}`,
                );
            }
        }
    }

    private resequenceLines(): void {
        this._lines.forEach((line, i) => {
            line.DisplayOrder = (i + 1) * 10;
        });
    }

    private resequenceSchedule(): void {
        this._schedule.forEach((row, i) => {
            row.DisplayOrder = (i + 1) * 10;
        });
    }
}
