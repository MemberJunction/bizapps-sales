import { describe, expect, it } from 'vitest';
import {
    DatabaseProviderBase,
    type EntityInfo,
    type IMetadataProvider,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
} from '@memberjunction/core';
import type { ArtifactDelegateContext } from '@memberjunction/core-entities';
import { DealArtifactPermissionDelegate } from '../DealArtifactPermissionDelegate.js';

interface FakePerms {
    CanRead: boolean;
    CanUpdate: boolean;
    CanDelete: boolean;
}

function buildMockContext(
    perms: FakePerms,
    dealRows: Array<{ ID: string }>,
    recordId: string,
): { context: ArtifactDelegateContext; user: UserInfo } {
    const fakeEntity = {
        Name: 'MJ_BizApps_Sales: Deals',
        GetUserPermisions: (_u: UserInfo) => perms,
    } as EntityInfo;

    const provider = Object.create(DatabaseProviderBase.prototype) as DatabaseProviderBase;
    Object.defineProperty(provider, 'Entities', {
        value: [fakeEntity],
        configurable: true,
    });
    provider.RunView = async <T>(_params: RunViewParams): Promise<RunViewResult<T>> => ({
        Success: true,
        Results: dealRows as T[],
        RowCount: dealRows.length,
        TotalRowCount: dealRows.length,
        ExecutionTime: 1,
        ErrorMessage: '',
        UserViewRunID: '',
    });

    const user = {
        ID: 'D0C50003-4B26-4E10-A800-000000000001',
        Name: 'elena.rostova@apexcommercial.example',
        Email: 'elena.rostova@apexcommercial.example',
    } as UserInfo;

    const context: ArtifactDelegateContext = {
        ArtifactID: 'D0C50007-4B26-4E10-A800-000000000001',
        ArtifactOwnerUserID: user.ID,
        DelegateEntityID: '79148DE5-7F99-44AC-ACD4-5EE7BA93D354',
        DelegateEntityName: 'MJ_BizApps_Sales: Deals',
        DelegateRecordID: recordId,
        Provider: provider as IMetadataProvider,
        Depth: 0,
        VisitedArtifactIDs: new Set<string>(),
    };

    return { context, user };
}

describe('DealArtifactPermissionDelegate', () => {
    const delegate = new DealArtifactPermissionDelegate();
    const validDealId = 'D0C50006-4B26-4E10-A800-000000000001';

    it('allows CanRead, CanEdit, CanShare, and CanDelete when caller has host Deal permissions and Deal is visible', async () => {
        const { context, user } = buildMockContext(
            { CanRead: true, CanUpdate: true, CanDelete: true },
            [{ ID: validDealId }],
            validDealId,
        );
        expect(await delegate.CanRead(context, user)).toBe('Allow');
        expect(await delegate.CanEdit(context, user)).toBe('Allow');
        expect(await delegate.CanShare(context, user)).toBe('Allow');
        expect(await delegate.CanDelete(context, user)).toBe('Allow');
    });

    it('allows CanRead but denies CanEdit/CanShare/CanDelete for read-only Deal callers', async () => {
        const { context, user } = buildMockContext(
            { CanRead: true, CanUpdate: false, CanDelete: false },
            [{ ID: validDealId }],
            validDealId,
        );
        expect(await delegate.CanRead(context, user)).toBe('Allow');
        expect(await delegate.CanEdit(context, user)).toBe('Deny');
        expect(await delegate.CanShare(context, user)).toBe('Deny');
        expect(await delegate.CanDelete(context, user)).toBe('Deny');
    });

    it('denies unauthorized callers with no Deal read permission', async () => {
        const { context, user } = buildMockContext(
            { CanRead: false, CanUpdate: false, CanDelete: false },
            [{ ID: validDealId }],
            validDealId,
        );
        expect(await delegate.CanRead(context, user)).toBe('Deny');
        expect(await delegate.CanEdit(context, user)).toBe('Deny');
        expect(await delegate.CanShare(context, user)).toBe('Deny');
        expect(await delegate.CanDelete(context, user)).toBe('Deny');
    });

    it('denies access when host Deal is hidden by RLS or missing, or when DelegateRecordID is malformed', async () => {
        const hidden = buildMockContext(
            { CanRead: true, CanUpdate: true, CanDelete: true },
            [],
            validDealId,
        );
        expect(await delegate.CanRead(hidden.context, hidden.user)).toBe('Deny');

        const malformed = buildMockContext(
            { CanRead: true, CanUpdate: true, CanDelete: true },
            [{ ID: validDealId }],
            'not-a-uuid',
        );
        expect(await delegate.CanRead(malformed.context, malformed.user)).toBe('Deny');
    });
});
