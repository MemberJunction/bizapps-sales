/**
 * @fileoverview A pipeline keeps its last active won stage and its last active lost stage
 * (bc-aidp-next-golive#345).
 *
 * `Sales.CloseDeal` moves a closed deal into the active stage on the deal's pipeline whose status
 * declares the outcome (`IsWon` or `IsLost`). When there is none, the close still succeeds but the deal
 * stays in an open stage, and the close returns a warning. This class stops a pipeline from getting into
 * that state through a stage edit: a save or delete that would take away the pipeline's LAST active
 * stage for an outcome is refused.
 *
 * ── WHAT IT DOES NOT REFUSE ────────────────────────────────────────────────────────────────────────
 *
 * A pipeline that never had such a stage. Only a change that REMOVES one is refused, so a pipeline
 * without a won or lost stage can still be edited stage by stage, and a new closing stage can be added
 * to it. Those pipelines are reported by the close warning instead. Refusing every save on them would
 * lock legacy pipelines that cannot be fixed in a single save.
 *
 * Creating a stage is never refused: a new row cannot take a closing stage away.
 *
 * ── WHAT "REMOVES" MEANS ───────────────────────────────────────────────────────────────────────────
 *
 * The row was, before this save, an active stage whose status declares an outcome, on some pipeline;
 * and after it, it no longer is on that pipeline for that outcome. That covers deactivating it, giving
 * it a status that does not declare the outcome, moving it to another pipeline, and deleting it. Each
 * outcome is checked on its own, by flag, never by status or stage name.
 */
import {
    BaseEntity,
    BaseEntityResult,
    type EntityDeleteOptions,
    type EntitySaveOptions,
    type IRunViewProvider,
    LogError,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsSalesPipelineStageEntity } from '@mj-biz-apps/sales-entities';

const PIPELINE_STAGE_ENTITY = 'MJ_BizApps_Sales: Pipeline Stages';
const DEAL_STATUS_ENTITY = 'MJ_BizApps_Sales: Deal Status Types';

/** The facts about the row the check compares: where it was before this save, and where it is now. */
interface StagePlacement {
    PipelineID: string | null;
    DealStatusTypeID: string | null;
    IsActive: boolean;
}

type Outcome = 'won' | 'lost';

@RegisterClass(BaseEntity, PIPELINE_STAGE_ENTITY)
export class PipelineStageEntityServer extends mjBizAppsSalesPipelineStageEntity {
    public override async Save(options?: EntitySaveOptions): Promise<boolean> {
        if (this.IsSaved) {
            const refusal = await this.guarded(() => this.closingStageRefusal(this.before(), this.after()));
            if (refusal) {
                return this.refuse(refusal, 'update');
            }
        }
        return super.Save(options);
    }

    public override async Delete(options?: EntityDeleteOptions): Promise<boolean> {
        const refusal = await this.guarded(() => this.closingStageRefusal(this.before(), null));
        if (refusal) {
            return this.refuse(refusal, 'delete');
        }
        return super.Delete(options);
    }

    /**
     * The refusal message when this change takes away the pipeline's last active stage for an outcome,
     * or null when it does not. `after` is null for a delete.
     */
    public async closingStageRefusal(before: StagePlacement, after: StagePlacement | null): Promise<string | null> {
        if (!before.IsActive || !before.PipelineID || !before.DealStatusTypeID) {
            return null;   // it was not an active stage with a status, so it held no outcome
        }

        const statusIDs = [before.DealStatusTypeID, after?.DealStatusTypeID].filter((id): id is string => !!id);
        const flags = await this.statusFlags(statusIDs);
        const was = flags.get(before.DealStatusTypeID.toLowerCase());
        if (!was || (!was.IsWon && !was.IsLost)) {
            return null;
        }

        const samePipeline =
            !!after && (after.PipelineID ?? '').toLowerCase() === before.PipelineID.toLowerCase();
        const now = after?.DealStatusTypeID ? flags.get(after.DealStatusTypeID.toLowerCase()) : undefined;
        const stillHolds = (outcome: Outcome): boolean =>
            !!after && after.IsActive && samePipeline && (outcome === 'won' ? !!now?.IsWon : !!now?.IsLost);

        for (const outcome of ['won', 'lost'] as const) {
            const held = outcome === 'won' ? was.IsWon : was.IsLost;
            if (!held || stillHolds(outcome)) {
                continue;
            }
            if (!(await this.pipelineHasAnother(before.PipelineID, outcome))) {
                return (
                    `This would leave the ${this.Pipeline} pipeline with no active ${outcome} stage, so ` +
                    `deals closed as ${outcome} would have no stage to move into. Add or activate another ` +
                    `${outcome} stage on the pipeline first, then change this one.`
                );
            }
        }
        return null;
    }

    /** The row as it was persisted, before this save. */
    private before(): StagePlacement {
        const old = <T>(field: string, current: T): T =>
            (this.IsSaved ? (this.GetFieldByName(field)?.OldValue as T) : current) ?? current;
        return {
            PipelineID: old<string | null>('PipelineID', this.PipelineID ?? null),
            DealStatusTypeID: old<string | null>('DealStatusTypeID', this.DealStatusTypeID ?? null),
            IsActive: old<boolean>('IsActive', this.IsActive ?? false),
        };
    }

    /** The row as this save would leave it. */
    private after(): StagePlacement {
        return {
            PipelineID: this.PipelineID ?? null,
            DealStatusTypeID: this.DealStatusTypeID ?? null,
            IsActive: this.IsActive === true,
        };
    }

    private async statusFlags(ids: string[]): Promise<Map<string, { IsWon: boolean; IsLost: boolean }>> {
        const quoted = [...new Set(ids.map((id) => id.toLowerCase()))].map((id) => `'${id}'`).join(', ');
        const view = this.ProviderToUse as unknown as IRunViewProvider;
        const r = await view.RunView<{ ID: string; IsWon: boolean | null; IsLost: boolean | null }>(
            {
                EntityName: DEAL_STATUS_ENTITY,
                ExtraFilter: `ID IN (${quoted})`,
                ResultType: 'simple',
                Fields: ['ID', 'IsWon', 'IsLost'],
            },
            this.ContextCurrentUser,
        );
        if (!r.Success) {
            throw new Error(`The deal statuses could not be read: ${r.ErrorMessage}`);
        }
        return new Map(
            (r.Results ?? []).map((row) => [
                String(row.ID).toLowerCase(),
                { IsWon: row.IsWon === true, IsLost: row.IsLost === true },
            ]),
        );
    }

    /** Whether the pipeline has an active stage OTHER than this row whose status declares the outcome. */
    private async pipelineHasAnother(pipelineID: string, outcome: Outcome): Promise<boolean> {
        const view = this.ProviderToUse as unknown as IRunViewProvider;
        const statuses = await view.RunView<{ ID: string }>(
            {
                EntityName: DEAL_STATUS_ENTITY,
                ExtraFilter: outcome === 'won' ? 'IsWon = 1' : 'IsLost = 1',
                ResultType: 'simple',
                Fields: ['ID'],
            },
            this.ContextCurrentUser,
        );
        if (!statuses.Success) {
            throw new Error(`The deal statuses could not be read: ${statuses.ErrorMessage}`);
        }
        const ids = (statuses.Results ?? []).map((row) => `'${String(row.ID)}'`);
        if (ids.length === 0) {
            return false;
        }
        const stages = await view.RunView<{ ID: string }>(
            {
                EntityName: PIPELINE_STAGE_ENTITY,
                ExtraFilter:
                    `PipelineID = '${pipelineID}' AND IsActive = 1 AND ID <> '${this.ID}' ` +
                    `AND DealStatusTypeID IN (${ids.join(', ')})`,
                ResultType: 'simple',
                Fields: ['ID'],
            },
            this.ContextCurrentUser,
        );
        if (!stages.Success) {
            throw new Error(`The pipeline's stages could not be read: ${stages.ErrorMessage}`);
        }
        return (stages.Results ?? []).length > 0;
    }

    /**
     * Fails closed on a read failure, as `DealTeamMemberEntityServer` does: a lookup that errored proves
     * nothing about whether the pipeline keeps its closing stages.
     */
    private async guarded(check: () => Promise<string | null>): Promise<string | null> {
        try {
            return await check();
        } catch (err) {
            return `Nothing was saved, because it could not be checked whether this pipeline would still have an active won and lost stage. Try again. Details: ${err}`;
        }
    }

    /** Mirrors `DealEntityServer.refuseSave`: log it, register a failed result, return false. */
    private refuse(message: string, type: 'update' | 'delete'): false {
        LogError(`PipelineStageEntityServer refused a ${type}: ${message}`);
        const failed = new BaseEntityResult();
        failed.Success = false;
        failed.Type = type;
        failed.Message = message;
        failed.StartedAt = new Date();
        failed.EndedAt = new Date();
        failed.OriginalValues = this.Fields.map((f) => ({ FieldName: f.CodeName, Value: f.OldValue }));
        this.RegisterResultHistoryEntry(failed);
        return false;
    }
}
