import { describe, expect, it, vi } from 'vitest';
import type { UserInfo } from '@memberjunction/core';
import type { ActivityWriteContext } from '@mj-biz-apps/common-activity-sync';

import { DealLinkerExtension } from '../activities/DealLinkerExtension.js';
import type { DealMatcher, DealMatchResult } from '../activities/DealMatcher.js';

function ctx(overrides: Partial<ActivityWriteContext> = {}): ActivityWriteContext {
    const saved: Array<{ Sequence: number; RecordID: string }> = [];
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
            Entities: [{ Name: 'MJ_BizApps_Sales: Deals', ID: 'deal-entity-id' }],
            GetEntityObject: async () => {
                const row = {
                    Sequence: 0,
                    RecordID: '',
                    NewRecord: () => undefined,
                    Save: async () => {
                        saved.push({ Sequence: row.Sequence, RecordID: row.RecordID });
                        return true;
                    },
                    LatestResult: { CompleteMessage: '' },
                };
                return row;
            },
        } as unknown as ActivityWriteContext['Provider'],
        ...overrides,
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

    it('writes one Regarding link per open deal, sequences after existing links', async () => {
        const matcher = {
            MatchOpenDeals: async (): Promise<DealMatchResult> => ({
                Matches: [
                    { DealID: 'deal-a', Basis: 'PrimaryContact', PartyID: 'person-1' },
                    { DealID: 'deal-b', Basis: 'Account', PartyID: 'org-1' },
                ],
                ReadFailed: false,
            }),
        } as DealMatcher;
        const existing = { Sequence: 1 } as ActivityWriteContext['Links'][number];
        const context = ctx({ Links: [existing] });
        const ext = new DealLinkerExtension(matcher);
        await ext.Enrich(context);
        expect(context.Links).toHaveLength(3);
        expect(context.Links[1]).toMatchObject({ Sequence: 2, RecordID: 'deal-a' });
        expect(context.Links[2]).toMatchObject({ Sequence: 3, RecordID: 'deal-b' });
    });
});
