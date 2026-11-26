/**
 * @fileoverview Delegated MJ Docs (`MJ: Artifacts`) permission delegate for
 * `MJ_BizApps_Sales: Deals`.
 *
 * When a Deal proposal, executive deal brief, or mutual action plan artifact sets
 * `DelegateEntityID` to `MJ_BizApps_Sales: Deals` and `DelegateRecordID` to the host
 * Deal's ID, `ArtifactPermissionEngine` resolves `CanRead` / `CanEdit` / `CanShare` /
 * `CanDelete` through this registered delegate. Without a registered delegate for the
 * host entity, `ArtifactPermissionEngine` fails closed and denies non-system callers.
 *
 * Authorization follows the host Deal's entity-level RBAC and record-level visibility
 * (via `RunView` under the caller's `UserInfo`, `ResultType: 'simple'`, `Fields: ['ID']`),
 * ensuring unauthorized users are denied while authorized sales users inherit access from
 * the Deal they can view or edit.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import {
    Metadata,
    RunView,
    type IMetadataProvider,
    type IRunViewProvider,
    type UserInfo,
} from '@memberjunction/core';
import {
    BaseArtifactPermissionDelegate,
    type ArtifactDelegateContext,
    type DelegatePermissionDecision,
} from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';

const DEAL_ENTITY_NAME = 'MJ_BizApps_Sales: Deals';
const GUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface DealIdRow {
    ID: string;
}

function isRunViewProvider(provider: IMetadataProvider): provider is IMetadataProvider & IRunViewProvider {
    return typeof (provider as IMetadataProvider & Partial<IRunViewProvider>).RunView === 'function';
}

@RegisterClass(BaseArtifactPermissionDelegate, DEAL_ENTITY_NAME)
export class DealArtifactPermissionDelegate extends BaseArtifactPermissionDelegate {
    private async canAccessDealRecord(
        context: ArtifactDelegateContext,
        user: UserInfo,
        mode: 'read' | 'update' | 'delete',
    ): Promise<DelegatePermissionDecision> {
        const recordId = context.DelegateRecordID?.trim();
        if (!recordId || !GUID_PATTERN.test(recordId)) {
            return 'Deny';
        }

        const provider = context.Provider ?? Metadata.Provider;
        const entity = provider.Entities.find((e) => e.Name === DEAL_ENTITY_NAME);
        if (!entity) {
            return 'Deny';
        }

        const perms = entity.GetUserPermisions(user);
        const roleAllowed =
            mode === 'read'
                ? perms.CanRead
                : mode === 'update'
                    ? perms.CanRead && perms.CanUpdate
                    : perms.CanRead && perms.CanDelete;

        if (!roleAllowed) {
            return 'Deny';
        }

        const rv = isRunViewProvider(provider) ? new RunView(provider) : new RunView();
        const res = await rv.RunView<DealIdRow>(
            {
                EntityName: DEAL_ENTITY_NAME,
                ExtraFilter: `ID = '${recordId}'`,
                ResultType: 'simple',
                Fields: ['ID'],
                MaxRows: 1,
            },
            user,
        );

        if (!res.Success || !Array.isArray(res.Results) || res.Results.length === 0) {
            return 'Deny';
        }
        return 'Allow';
    }

    public override async CanRead(
        context: ArtifactDelegateContext,
        user: UserInfo,
    ): Promise<DelegatePermissionDecision> {
        return this.canAccessDealRecord(context, user, 'read');
    }

    public override async CanEdit(
        context: ArtifactDelegateContext,
        user: UserInfo,
    ): Promise<DelegatePermissionDecision> {
        return this.canAccessDealRecord(context, user, 'update');
    }

    public override async CanShare(
        context: ArtifactDelegateContext,
        user: UserInfo,
    ): Promise<DelegatePermissionDecision> {
        return this.canAccessDealRecord(context, user, 'update');
    }

    public override async CanDelete(
        context: ArtifactDelegateContext,
        user: UserInfo,
    ): Promise<DelegatePermissionDecision> {
        return this.canAccessDealRecord(context, user, 'delete');
    }
}
