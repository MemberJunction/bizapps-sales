/**
 * @fileoverview Keeps `Deal.OwnerEmployeeID` following the roster when the ROSTER is what changed.
 *
 * ── THE GAP ─────────────────────────────────────────────────────────────────────────────────────
 *
 * `DealEntityServer.stampOwnerFromTeam()` derives the stamp from the team, and it is guarded by
 * `RosterDrivesThisSave` — the team must be part of the save. That is true when the deal is saved
 * with its roster, which is how `DealEntity.SetOwner()` and the workspace's owner picker work.
 *
 * It is NOT true when a `DealTeamMember` row is saved on its own, which is exactly what the Deal
 * form's Internal team grid does: `<mj-explorer-entity-data-grid>` saves the child row and nothing
 * else. So adding yourself as Owner / AE there left the grid showing an owner and the deal still
 * reporting "No owner assigned." (bc-aidp-next-golive#291).
 *
 * The sharpest version of that: `DealEntityServer.ownerStampEditRefusal()` refuses a hand-set owner
 * with *"The owner is set from the deal team. Change the Owner role on the Internal team panel
 * instead."* — and the Internal team panel was the one path that did not update it.
 *
 * ── WHY A CHILD SUBCLASS AND NOT A FORM FIX ─────────────────────────────────────────────────────
 *
 * The grid is MJ's generic related-entity grid; there is no panel hook to attach to, and a fix there
 * would cover one caller. An importer, an Action or a direct API write against `DealTeamMember`
 * reaches the same state, and the rule — the stamp follows the roster — is the deal's, not a form's.
 *
 * ── IT RE-DERIVES RATHER THAN ASSIGNING ─────────────────────────────────────────────────────────
 *
 * This does not compute an owner and write it. It loads the deal WITH its team and saves, which makes
 * `RosterDrivesThisSave` true and lets `stampOwnerFromTeam()` do exactly what it already does. One
 * derivation, in one place, reached from both paths — the alternative is a second implementation that
 * agrees with the first until it does not.
 *
 * ── AND IT DOES NOT RECURSE ─────────────────────────────────────────────────────────────────────
 *
 * Saving the parent from a child's save looks circular and is not. `BaseEntity.Save()` on a deal with
 * children builds a save plan and routes to `saveGraph`, which executes every node -- the root
 * included -- through `saveAsGraphNode`, and that calls `_InnerSave` directly. Team rows saved as part
 * of a deal's graph therefore never re-enter the `Save()` override below. `DealEntityServer.Save()`
 * documents the same guarantee for itself, which is what makes its own preparation run exactly once.
 *
 * The override fires for the case it is written for: a team row saved on its OWN, which is what the
 * grid does.
 *
 * That also means a CLOSED deal is handled correctly without a special case. `checkCloseLock` freezes
 * `OwnerEmployeeID`, but it keys on the field being dirty and the stamp is applied after it runs, so
 * a roster-driven change passes — which golive#206 item 2 requires, because reassigning a rep on a
 * closed deal is record-keeping. `checkCloseLock`'s own comment says this path "leav[es] this field
 * clean, so it passed".
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import {
    BaseEntity,
    BaseEntityResult,
    EntitySaveOptions,
    type EntityDeleteOptions,
    type IMetadataProvider,
    type IRunViewProvider,
    LogError,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsSalesDealTeamMemberEntity } from '@mj-biz-apps/sales-entities';
import { DealEntityServer } from './DealEntityServer.js';

const DEAL_TEAM_MEMBER_ENTITY = 'MJ_BizApps_Sales: Deal Team Members';
const DEAL_ENTITY = 'MJ_BizApps_Sales: Deals';
const DEAL_ROLE_ENTITY = 'MJ_BizApps_Sales: Deal Roles';

@RegisterClass(BaseEntity, DEAL_TEAM_MEMBER_ENTITY)
export class DealTeamMemberEntityServer extends mjBizAppsSalesDealTeamMemberEntity {
    /**
     * The deal and role this row held BEFORE this save, captured while `OldValue` still describes the
     * persisted row.
     *
     * Both halves matter. A row that STOPS being the owner — its role changed, or it was deactivated —
     * leaves the deal owned by nobody, and asking only about the row's current role would miss it. A
     * row that MOVES to another deal leaves two deals needing a re-derivation, not one.
     */
    private priorSnapshot(): { dealID: string | null; roleID: string | null; isActive: boolean } {
        const old = <T>(field: string, current: T): T =>
            (this.IsSaved ? (this.GetFieldByName(field)?.OldValue as T) : current) ?? current;
        return {
            dealID: old<string | null>('DealID', this.DealID ?? null),
            roleID: old<string | null>('DealRoleID', this.DealRoleID ?? null),
            isActive: old<boolean>('IsActive', this.IsActive ?? false),
        };
    }

    public override async Save(options?: EntitySaveOptions): Promise<boolean> {
        /**
         * ONE HOLDER FOR A ROLE THAT SAYS SO (`DealRole.AllowsMultiplePerDeal = 0`).
         *
         * The seed sets this false for Owner / AE and true for every other role, and NOTHING read it.
         * So a rep "taking" a deal added a SECOND Owner / AE row, saw themselves listed as owner, and
         * the deal stayed with the first one — because `stampOwnerFromTeam()` resolves with
         *
         *     this.Team.Items.find((m) => m.DealRoleID === ownerRoleID)
         *
         * and `find` returns the OLDEST matching row. Reports, rollups and anything crediting the
         * owner kept pointing at the previous rep while the grid showed the new one. Refusing here is
         * what the flag already means, and it is read from the ROLE rather than keyed on Owner, so a
         * future single-holder role is covered without another change.
         *
         * INACTIVE ROWS COUNT. `stampOwnerFromTeam` never reads `IsActive` — an inactive Owner / AE
         * row still owns the deal — so an inactive row still holds the seat here. Counting it keeps
         * this check and the derivation answering the same question. Whether ownership should respect
         * `IsActive` at all is open and deliberately not decided here.
         */
        let duplicate: string | null;
        try {
            duplicate = await this.duplicateRoleRefusal();
        } catch (err) {
            // Fail closed on a READ failure, the same way the stage/pipeline check does: a lookup that
            // errored proves nothing, and the message names the lookup rather than the row.
            return this.refuseSave(`could not check this deal's team for a duplicate role: ${err}`);
        }
        if (duplicate) {
            return this.refuseSave(duplicate);
        }

        const before = this.priorSnapshot();
        const saved = await super.Save(options);
        if (!saved) {
            return saved;
        }
        /**
         * UNCONDITIONAL ON PURPOSE — there is no "did anything owner-relevant change" gate here, and
         * one should not be added from the snapshot above.
         *
         * `stampOwnerFromTeam()` derives the owner by finding the row whose `DealRoleID` is the owner
         * role and taking its `EmployeeID`:
         *
         *     const owner = this.Team.Items.find((m) => m.DealRoleID === ownerRoleID);
         *     this.OwnerEmployeeID = owner?.EmployeeID ?? null;
         *
         * So the fields that can change the answer are `DealID`, `DealRoleID` and `EmployeeID`.
         * `priorSnapshot()` carries the first two and NOT the third, so a gate built from it would
         * miss an employee swap: same deal, same role, different person, no re-stamp, and the deal
         * keeps the old owner — which is the exact defect this class exists to fix, arriving through
         * a different door.
         *
         * Re-deriving every time is therefore the cheap, correct choice: `restampDeal` loads the deal
         * and saves it, so a team-row edit that cannot affect the owner still costs one deal save.
         * That is paid knowingly. Gate it only after the snapshot captures everything the derivation
         * reads — and then by comparing against the derivation, not against a hand-listed set.
         *
         * (`#146`'s stage/pipeline refusal does NOT fire on these saves: it returns early unless
         * `PipelineStageID` or `PipelineID` is dirty, and a re-stamp dirties neither.)
         */
        // Both the deal it was on and the deal it is on now: a row moved between deals changes two.
        await this.restampDeals([before.dealID, this.DealID ?? null]);
        return saved;
    }

    public override async Delete(options?: EntityDeleteOptions): Promise<boolean> {
        // Captured before the delete, because afterwards the fields are gone.
        const dealID = this.DealID ?? null;
        const deleted = await super.Delete(options);
        if (deleted) {
            await this.restampDeals([dealID]);
        }
        return deleted;
    }

    /**
     * Refuses a second holder of a role the data says admits only one.
     *
     * Reads the rule from `DealRole.AllowsMultiplePerDeal` rather than naming Owner, so this is the
     * flag's enforcement and not a special case — the seed already sets it false for Owner / AE and
     * true for the other five roles.
     *
     * NULL means "no objection", and that includes a role row that cannot be read: a role lookup that
     * comes back empty is not evidence of a duplicate, and refusing every team edit because a
     * reference row is missing would be a worse failure than the one being prevented. A failed READ
     * throws instead, and `Save` turns that into a refusal that names the lookup.
     */
    private async duplicateRoleRefusal(): Promise<string | null> {
        const dealID = this.DealID;
        const roleID = this.DealRoleID;
        if (!dealID || !roleID) {
            return null;
        }

        const view = this.ProviderToUse as unknown as IRunViewProvider;

        const roleRead = await view.RunView<{ Name: string | null; AllowsMultiplePerDeal: boolean | null }>(
            {
                EntityName: DEAL_ROLE_ENTITY,
                ExtraFilter: `ID = '${roleID}'`,
                ResultType: 'simple',
                Fields: ['Name', 'AllowsMultiplePerDeal'],
            },
            this.ContextCurrentUser,
        );
        if (!roleRead.Success) {
            throw new Error(`could not read the deal role: ${roleRead.ErrorMessage}`);
        }
        const role = (roleRead.Results ?? [])[0];
        // Truthy means the role admits several, which is the default for everything but Owner / AE.
        if (!role || role.AllowsMultiplePerDeal) {
            return null;
        }

        /**
         * EXCLUDE SELF, or every later edit to the owner row refuses itself. `IsSaved` is the test
         * rather than `ID`, because an unsaved row has no id to exclude and no row to collide with.
         */
        const notSelf = this.IsSaved && this.ID ? ` AND ID <> '${this.ID}'` : '';
        const held = await view.RunView<{ Employee: string | null }>(
            {
                EntityName: DEAL_TEAM_MEMBER_ENTITY,
                ExtraFilter: `DealID = '${dealID}' AND DealRoleID = '${roleID}'${notSelf}`,
                ResultType: 'simple',
                Fields: ['Employee'],
            },
            this.ContextCurrentUser,
        );
        if (!held.Success) {
            throw new Error(`could not check the deal's existing ${role.Name ?? 'role'} rows: ${held.ErrorMessage}`);
        }
        const existing = (held.Results ?? [])[0];
        if (!existing) {
            return null;
        }

        const roleName = role.Name ?? 'that role';
        const who = existing.Employee ? ` (${existing.Employee})` : '';
        return (
            `This deal already has a ${roleName}${who}. Change that row's employee instead of adding a `
            + `second one.`
        );
    }

    /** Mirrors `DealEntityServer.refuseSave`: log it, register a failed result, return false. */
    private refuseSave(message: string): false {
        LogError(`DealTeamMemberEntityServer.Save refused: ${message}`);
        const failed = new BaseEntityResult();
        failed.Success = false;
        failed.Type = this.IsSaved ? 'update' : 'create';
        failed.Message = message;
        failed.StartedAt = new Date();
        failed.EndedAt = new Date();
        failed.OriginalValues = this.Fields.map((f) => ({ FieldName: f.CodeName, Value: f.OldValue }));
        this.RegisterResultHistoryEntry(failed);
        return false;
    }

    /**
     * Re-derives the owner stamp on each deal named, once.
     *
     * ── FAILURE DOES NOT UNDO THE ROSTER EDIT ───────────────────────────────────────────────────
     *
     * The row is already committed by the time this runs, and the roster is the authority — a deal
     * whose stamp is briefly stale still has a correct team, and the next save of either fixes it.
     * Throwing here would report a failure for a write that succeeded, and rolling the row back would
     * discard a correct edit because a derived field could not be refreshed. Logged instead, which is
     * what `seedOwnerOnCreate` does with the same reasoning about a default nobody asked for.
     */
    private async restampDeals(dealIDs: Array<string | null>): Promise<void> {
        const wanted = [...new Set(dealIDs.filter((id): id is string => Boolean(id)).map((id) => id.toLowerCase()))];
        for (const dealID of wanted) {
            try {
                await this.restampDeal(dealID);
            } catch (e) {
                LogError(
                    `DealTeamMemberEntityServer: the team row saved, but deal ${dealID}'s owner stamp could not be `
                        + `refreshed from it. ${e instanceof Error ? e.message : String(e)}`,
                );
            }
        }
    }

    private async restampDeal(dealID: string): Promise<void> {
        const provider = this.ProviderToUse as unknown as IMetadataProvider;
        const deal = await provider.GetEntityObject<DealEntityServer>(DEAL_ENTITY, this.ContextCurrentUser);
        if (!(await deal.Load(dealID))) {
            throw new Error(`deal ${dealID} could not be loaded`);
        }

        /**
         * LOADING THE TEAM IS THE WHOLE MECHANISM, not a convenience. `RosterDrivesThisSave` asks
         * `Team.IsLoaded`, and `stampOwnerFromTeam()` returns early without it — so a save here that
         * skipped this line would do nothing at all, silently, which is the bug being fixed.
         */
        await deal.Team.Load();


        if (!(await deal.Save())) {
            throw new Error(`deal ${dealID} refused the save that refreshes its owner stamp`);
        }
    }
}

/**
 * Anti-tree-shake anchor. Importing this module is what fires `@RegisterClass`, and nothing references
 * the class by name — see the note on `LoadSalesCoreEntitiesServer`.
 */
export function LoadDealTeamMemberEntityServer(): void {
    void DealTeamMemberEntityServer;
}
