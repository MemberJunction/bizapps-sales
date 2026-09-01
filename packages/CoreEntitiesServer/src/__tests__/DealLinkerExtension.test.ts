import { describe, expect, it } from 'vitest';
import type { UserInfo } from '@memberjunction/core';
import type { ActivityWriteContext } from '@mj-biz-apps/common-activity-sync';

import { DealLinkerExtension } from '../activities/DealLinkerExtension.js';
import type { DealMatcher, DealMatchResult } from '../activities/DealMatcher.js';

function ctx(overrides: Partial<ActivityWriteContext> = {}): ActivityWriteContext {
    return {
        Activity: { ID: 'act-1' } as ActivityWriteContext['Activity'],
        Links: [],
        Item: {} as ActivityWriteContext['Item'],
        ResolvedParties: [{ Kind: 'Person', RecordID: 'person-1', Role: 'From' }],
        UnresolvedParties: [],
        ConnectionID: 'conn-1',
        ProviderTypeCode: 'Microsoft365',
        ContextUser: { ID: 'user-1' } as UserInfo,
        Provider: {
            Entities: [
                { Name: 'MJ_BizApps_Sales: Deals', ID: 'deal-entity-id' },
                { Name: 'MJ_BizApps_Common: People', ID: 'person-entity-id' },
                { Name: 'MJ_BizApps_Common: Organizations', ID: 'org-entity-id' },
            ],
            GetEntityObject: async () => {
                const row: Record<string, unknown> = {
                    Sequence: 0,
                    RecordID: '',
                    EntityID: '',
                    Role: '',
                    NewRecord: () => undefined,
                    Save: async () => true,
                    LatestResult: { CompleteMessage: '' },
                };
                return row;
            },
        } as unknown as ActivityWriteContext['Provider'],
        ...overrides,
    };
}

function match(
    dealID: string,
    extras: { AccountID?: string | null; PrimaryContactID?: string | null; Basis?: 'PrimaryContact' | 'Account'; PartyID?: string } = {},
): DealMatchResult['Matches'][number] {
    return {
        DealID: dealID,
        Basis: extras.Basis ?? 'PrimaryContact',
        PartyID: extras.PartyID ?? extras.PrimaryContactID ?? extras.AccountID ?? dealID,
        AccountID: extras.AccountID ?? null,
        PrimaryContactID: extras.PrimaryContactID ?? null,
    };
}

describe('DealLinkerExtension', () => {
    it('throws on ReadFailed so FailurePolicy can see it — a failed read is not no matches', async () => {
        const matcher = {
            MatchOpenDeals: async (): Promise<DealMatchResult> => ({ Matches: [], ReadFailed: true }),
        } as DealMatcher;
        const ext = new DealLinkerExtension(matcher);
        await expect(ext.Enrich(ctx())).rejects.toThrow(/could not read open deals/);
    });

    it('does nothing when Common resolved no parties', async () => {
        const matcher = {
            MatchOpenDeals: async (): Promise<DealMatchResult> => {
                throw new Error('should not match');
            },
        } as DealMatcher;
        const ext = new DealLinkerExtension(matcher);
        await expect(ext.Enrich(ctx({ ResolvedParties: [] }))).resolves.toBeUndefined();
    });

    it('writes a Regarding deal link plus LoggedFor snapshots of the deal person and org', async () => {
        const matcher = {
            MatchOpenDeals: async (): Promise<DealMatchResult> => ({
                Matches: [match('deal-a', { Basis: 'PrimaryContact', PrimaryContactID: 'person-1', AccountID: 'org-1' })],
                ReadFailed: false,
            }),
        } as DealMatcher;
        const context = ctx();
        const ext = new DealLinkerExtension(matcher);
        await ext.Enrich(context);
        expect(context.Links).toHaveLength(3);
        expect(context.Links[0]).toMatchObject({
            Role: 'Regarding',
            EntityID: 'deal-entity-id',
            RecordID: 'deal-a',
            Sequence: 1,
        });
        expect(context.Links[1]).toMatchObject({
            Role: 'LoggedFor',
            EntityID: 'person-entity-id',
            RecordID: 'person-1',
            Sequence: 2,
        });
        expect(context.Links[2]).toMatchObject({
            Role: 'LoggedFor',
            EntityID: 'org-entity-id',
            RecordID: 'org-1',
            Sequence: 3,
        });
    });

    it('does not duplicate a person or org ingest already linked (any role)', async () => {
        const matcher = {
            MatchOpenDeals: async (): Promise<DealMatchResult> => ({
                Matches: [match('deal-a', { PrimaryContactID: 'person-1', AccountID: 'org-1' })],
                ReadFailed: false,
            }),
        } as DealMatcher;
        const existing = {
            Sequence: 1,
            EntityID: 'person-entity-id',
            RecordID: 'person-1',
            Role: 'From',
        } as ActivityWriteContext['Links'][number];
        const context = ctx({ Links: [existing] });
        const ext = new DealLinkerExtension(matcher);
        await ext.Enrich(context);
        // existing From + Regarding deal + LoggedFor org (person skipped)
        expect(context.Links).toHaveLength(3);
        expect(context.Links.map((l) => `${l.Role}:${l.RecordID}`)).toEqual([
            'From:person-1',
            'Regarding:deal-a',
            'LoggedFor:org-1',
        ]);
    });

    it('still sequences Regarding links after existing links when two deals match', async () => {
        const matcher = {
            MatchOpenDeals: async (): Promise<DealMatchResult> => ({
                Matches: [
                    match('deal-a', { Basis: 'PrimaryContact', PrimaryContactID: 'person-1', AccountID: 'org-1' }),
                    match('deal-b', { Basis: 'Account', PartyID: 'org-1', AccountID: 'org-1', PrimaryContactID: 'person-2' }),
                ],
                ReadFailed: false,
            }),
        } as DealMatcher;
        const existing = { Sequence: 1, EntityID: 'other', RecordID: 'x' } as ActivityWriteContext['Links'][number];
        const context = ctx({ Links: [existing] });
        const ext = new DealLinkerExtension(matcher);
        await ext.Enrich(context);
        const regarding = context.Links.filter((l) => l.Role === 'Regarding');
        expect(regarding.map((l) => l.RecordID)).toEqual(['deal-a', 'deal-b']);
        expect(regarding[0].Sequence).toBe(2);
    });
});
