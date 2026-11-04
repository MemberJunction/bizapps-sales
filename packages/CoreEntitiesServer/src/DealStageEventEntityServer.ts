/**
 * @fileoverview A `DealStageEvent` is appended once and never changed or deleted (#348).
 *
 * Each row stamps `AmountAtTransition` and `ProbabilityAtTransition` at the moment a deal moved, and
 * those stamps are what make "what did we think the forecast was on the 1st" answerable once amounts
 * change. The Explorer form already refuses edit mode, but a form is one caller. This class refuses an
 * update and a delete on the server, so an Action, an agent, the GraphQL API or a raw
 * `BaseEntity.Save()` hits the same wall.
 *
 * Inserting is never refused: `DealEntityServer.appendStageEvent` is the writer, and an insert cannot
 * rewrite history that does not exist yet.
 *
 * The entity's `AllowUpdateAPI` and `AllowDeleteAPI` flags are off as well (`metadata/entities/`). They
 * take the update and delete mutations out of the generated GraphQL schema, and MemberJunction's own
 * save and delete paths check them too. This class still earns its place: it says WHY the change is
 * refused instead of "Update API is disabled", and the rule holds on a host whose metadata has not been
 * pushed yet or has had the flags turned back on.
 */
import {
    BaseEntity,
    BaseEntityResult,
    type EntityDeleteOptions,
    type EntityInfo,
    EntityLifecyclePolicyEngine,
    type EntitySaveOptions,
    type IEntityLifecyclePolicy,
    LogError,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
    DEAL_STAGE_EVENT_APPEND_ONLY_MESSAGE,
    mjBizAppsSalesDealStageEventEntity,
} from '@mj-biz-apps/sales-entities';

const DEAL_STAGE_EVENT_ENTITY = 'MJ_BizApps_Sales: Deal Stage Events';

/**
 * Declarative platform write-authority policy for `MJ_BizApps_Sales: Deal Stage Events`.
 * Registered with {@link EntityLifecyclePolicyEngine} so `BaseEntity.Validate()`,
 * `BaseEntity._innerSave` / `_innerDelete`, `DatabaseProviderBase`, and `ResolverBase`
 * enforce append-only semantics with the domain refusal message.
 */
export const DEAL_STAGE_EVENT_LIFECYCLE_POLICY: IEntityLifecyclePolicy = {
    writeAuthority: {
        mode: 'AppendOnly',
        errorMessage: DEAL_STAGE_EVENT_APPEND_ONLY_MESSAGE,
    },
};

export function RegisterDealStageEventLifecyclePolicy(): void {
    EntityLifecyclePolicyEngine?.Instance?.RegisterPolicy(
        DEAL_STAGE_EVENT_ENTITY,
        DEAL_STAGE_EVENT_LIFECYCLE_POLICY,
    );
}

RegisterDealStageEventLifecyclePolicy();

@RegisterClass(BaseEntity, DEAL_STAGE_EVENT_ENTITY)
export class DealStageEventEntityServer extends mjBizAppsSalesDealStageEventEntity {
    public override async Save(options?: EntitySaveOptions): Promise<boolean> {
        if (this.IsSaved) {
            return this.refuse('update', this.resolveAppendOnlyRefusal('Update'));
        }
        return super.Save(options);
    }

    public override async Delete(_options?: EntityDeleteOptions): Promise<boolean> {
        return this.refuse('delete', this.resolveAppendOnlyRefusal('Delete'));
    }

    private resolveAppendOnlyRefusal(operation: 'Update' | 'Delete'): string {
        if (this.EntityInfo?.Name && EntityLifecyclePolicyEngine?.Instance) {
            const gateMessage = EntityLifecyclePolicyEngine.Instance.CheckWritePermissionGate(
                this,
                operation,
                this.ContextCurrentUser,
                true,
            );
            if (gateMessage) {
                return gateMessage;
            }
        }
        const policy = EntityLifecyclePolicyEngine?.Instance?.ResolvePolicy({
            Name: DEAL_STAGE_EVENT_ENTITY,
        } as EntityInfo);
        return policy?.writeAuthority?.errorMessage ?? DEAL_STAGE_EVENT_APPEND_ONLY_MESSAGE;
    }

    /** Mirrors `DealEntityServer.refuseSave`: log it, register a failed result, return false. */
    private refuse(type: 'update' | 'delete', message: string = DEAL_STAGE_EVENT_APPEND_ONLY_MESSAGE): false {
        LogError(`DealStageEventEntityServer refused a ${type}: ${message}`);
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
