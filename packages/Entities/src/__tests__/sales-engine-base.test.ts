import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    BaseEngine,
    type BaseEnginePropertyConfig,
    type IMetadataProvider,
    Metadata,
    type UserInfo,
} from '@memberjunction/core';

import {
    LoadSalesEngineBase,
    SALES_ENGINE_ENTITIES,
    SalesEngineBase,
} from '../sales-engine-base.js';

type FakeRow = Record<string, unknown>;

interface FakeProviderOptions {
    currentUser?: UserInfo;
    readableEntities?: string[];
    rowsByEntity?: Record<string, FakeRow[]>;
}

const ALL_ENGINE_ENTITY_NAMES = Object.values(SALES_ENGINE_ENTITIES);

function makeUser(id: string): UserInfo {
    return { ID: id, Name: `User ${id}` } as unknown as UserInfo;
}

function makeProvider(options: FakeProviderOptions = {}): {
    provider: IMetadataProvider;
    loadCalls: Array<{ configs: Partial<BaseEnginePropertyConfig>[]; forceRefresh: boolean; userId: string | null }>;
} {
    const readable = new Set(options.readableEntities ?? ALL_ENGINE_ENTITY_NAMES);
    const entities = ALL_ENGINE_ENTITY_NAMES.map((name) => ({
        Name: name,
        GetUserPermisions: (_user: UserInfo) => ({ CanRead: readable.has(name) }),
    }));
    const provider = {
        CurrentUser: options.currentUser,
        Entities: entities,
        EntityByName: (name: string) => entities.find((e) => e.Name === name),
    } as unknown as IMetadataProvider;

    return { provider, loadCalls: [] };
}

function sampleRows(): Record<string, FakeRow[]> {
    return {
        [SALES_ENGINE_ENTITIES.Pipelines]: [
            { ID: 'AAAA0000-0000-4000-8000-000000000001', Code: 'B2B', Name: 'B2B', IsActive: true, IsDefault: true, IncludeInForecast: true, DisplayRank: 1 },
            { ID: 'AAAA0000-0000-4000-8000-000000000002', Code: 'LEGACY', Name: 'Legacy', IsActive: false, IsDefault: false, IncludeInForecast: true, DisplayRank: 2 },
            { ID: 'AAAA0000-0000-4000-8000-000000000003', Code: 'ARCHIVED', Name: 'Archived', IsActive: false, IsDefault: false, IncludeInForecast: false, DisplayRank: 3 },
        ],
        [SALES_ENGINE_ENTITIES.PipelineStages]: [
            { ID: 'BBBB0000-0000-4000-8000-000000000001', PipelineID: 'aaaa0000-0000-4000-8000-000000000001', Name: 'Discovery', IsActive: true, DisplayOrder: 1 },
            { ID: 'BBBB0000-0000-4000-8000-000000000002', PipelineID: 'aaaa0000-0000-4000-8000-000000000001', Name: 'Retired Stage', IsActive: false, DisplayOrder: 2 },
        ],
        [SALES_ENGINE_ENTITIES.PipelineCompanies]: [
            { ID: 'CCCC0000-0000-4000-8000-000000000001', PipelineID: 'aaaa0000-0000-4000-8000-000000000001', CompanyID: 'DDDD0000-0000-4000-8000-000000000001', IsActive: true },
            { ID: 'CCCC0000-0000-4000-8000-000000000002', PipelineID: 'aaaa0000-0000-4000-8000-000000000001', CompanyID: 'DDDD0000-0000-4000-8000-000000000002', IsActive: false },
        ],
        [SALES_ENGINE_ENTITIES.DealStatusTypes]: [
            { ID: 'EEEE0000-0000-4000-8000-000000000001', Code: 'OPEN', Name: 'Open', IsActive: true, IsOpen: true, IsWon: false, IsLost: false, IsClosed: false, LocksDeal: false, DisplayRank: 1 },
            { ID: 'EEEE0000-0000-4000-8000-000000000002', Code: 'HOLD', Name: 'On Hold', IsActive: true, IsOpen: false, IsWon: false, IsLost: false, IsClosed: false, LocksDeal: false, DisplayRank: 2 },
            { ID: 'EEEE0000-0000-4000-8000-000000000003', Code: 'WON', Name: 'Won', IsActive: true, IsOpen: false, IsWon: true, IsLost: false, IsClosed: true, LocksDeal: true, DisplayRank: 3 },
            { ID: 'EEEE0000-0000-4000-8000-000000000004', Code: 'LOST', Name: 'Lost', IsActive: true, IsOpen: false, IsWon: false, IsLost: true, IsClosed: true, LocksDeal: true, DisplayRank: 4 },
        ],
        [SALES_ENGINE_ENTITIES.DealTypes]: [
            { ID: 'F0000000-0000-4000-8000-000000000001', Code: 'RENEWAL', Name: 'Renewal', IsActive: true, RequiresRenewalSource: true },
        ],
        [SALES_ENGINE_ENTITIES.ForecastCategoryTypes]: [
            { ID: 'F1000000-0000-4000-8000-000000000001', Code: 'COMMIT', Name: 'Commit', IsActive: true },
        ],
        [SALES_ENGINE_ENTITIES.LossReasons]: [
            { ID: 'F2000000-0000-4000-8000-000000000001', Code: 'BUDGET', Name: 'Budget', IsActive: true, RequiresNotes: true },
        ],
        [SALES_ENGINE_ENTITIES.DealRoles]: [
            { ID: 'F3000000-0000-4000-8000-000000000001', Code: 'SE', Name: 'SE', IsActive: true, IsOwnerRole: false },
            { ID: 'F3000000-0000-4000-8000-000000000002', Code: 'AE', Name: 'Owner', IsActive: true, IsOwnerRole: true },
        ],
        [SALES_ENGINE_ENTITIES.AccountTypes]: [
            { ID: 'F4000000-0000-4000-8000-000000000001', Code: 'CUST', Name: 'Customer', IsActive: true, IsProspect: false, DisplayRank: 1 },
            { ID: 'F4000000-0000-4000-8000-000000000002', Code: 'PROS', Name: 'Prospect', IsActive: true, IsProspect: true, DisplayRank: 2 },
        ],
        [SALES_ENGINE_ENTITIES.BuyingRoleTypes]: [
            { ID: 'F5000000-0000-4000-8000-000000000001', Code: 'CHAMP', Name: 'Champion', IsActive: true },
        ],
        [SALES_ENGINE_ENTITIES.LeadSourceTypes]: [
            { ID: 'F6000000-0000-4000-8000-000000000001', Code: 'INB', Name: 'Inbound', IsActive: true },
        ],
        [SALES_ENGINE_ENTITIES.LifecycleStageTypes]: [
            { ID: 'F7000000-0000-4000-8000-000000000001', Code: 'SQL', Name: 'SQL', IsActive: true },
        ],
        [SALES_ENGINE_ENTITIES.DealDigestAudienceTypes]: [
            { ID: 'F8000000-0000-4000-8000-000000000001', Code: 'REP', Name: 'Deal Owner', IsActive: true },
        ],
    };
}

/**
 * Intercepts `BaseEngine.prototype.Load` so tests verify the exact configs passed to `BaseEngine`,
 * populate backing properties and `_loaded` / `_propertyLoadResults`, and avoid touching a database.
 */
function stubEngineLoad(rowsByEntity: Record<string, FakeRow[]>) {
    const calls: Array<{
        configs: Partial<BaseEnginePropertyConfig>[];
        provider: IMetadataProvider | null;
        forceRefresh: boolean;
        userId: string | null;
    }> = [];

    const spy = vi
        .spyOn(BaseEngine.prototype as unknown as {
            Load: (
                configs: Partial<BaseEnginePropertyConfig>[],
                provider: IMetadataProvider | null,
                forceRefresh?: boolean,
                contextUser?: UserInfo,
            ) => Promise<void>;
        }, 'Load')
        .mockImplementation(async function (
            this: SalesEngineBase & Record<string, unknown>,
            configs,
            provider,
            forceRefresh = false,
            contextUser,
        ) {
            calls.push({
                configs,
                provider,
                forceRefresh,
                userId: contextUser?.ID ? String(contextUser.ID) : null,
            });
            if (this.Loaded && !forceRefresh) {
                return;
            }
            const dataMap = new Map<string, { loadedSuccessfully: boolean; data: unknown[] }>();
            for (const cfg of configs) {
                if (cfg.PropertyName && cfg.EntityName) {
                    const rows = rowsByEntity[cfg.EntityName] ?? [];
                    this[cfg.PropertyName] = rows;
                    dataMap.set(cfg.PropertyName, { loadedSuccessfully: true, data: rows });
                }
            }
            // Populate BaseEngine's internal loaded flags so Loaded & PropertyLoadedSuccessfully reflect reality.
            this['_loaded'] = true;
            this['_dataMap'] = dataMap;
        });

    return { calls, spy };
}

afterEach(() => {
    SalesEngineBase.Instance.InvalidateCache();
    const internal = SalesEngineBase.Instance as unknown as Record<string, unknown>;
    internal['_loaded'] = false;
    internal['_cacheInvalidated'] = false;
    internal['_dataMap'] = new Map();
    vi.restoreAllMocks();
});

describe('SalesEngineBase', () => {
    it('returns the same BaseSingleton instance and exposes LoadSalesEngineBase()', () => {
        LoadSalesEngineBase();
        expect(SalesEngineBase.Instance).toBe(SalesEngineBase.Instance);
    });

    it('loads all 13 bounded reference tables with CacheLocal:true & AutoRefresh:true and exposes O(1) lookups', async () => {
        const rows = sampleRows();
        const { calls } = stubEngineLoad(rows);
        const { provider } = makeProvider({ currentUser: makeUser('00000000-0000-4000-8000-000000000001') });

        const ok = await SalesEngineBase.Instance.Config(false, undefined, provider);
        expect(ok).toBe(true);
        expect(calls).toHaveLength(1);
        expect(calls[0].configs).toHaveLength(13);
        expect(calls[0].configs.every((c) => c.CacheLocal === true && c.AutoRefresh === true)).toBe(true);

        const eng = SalesEngineBase.Instance;
        expect(eng.PipelineById('aaaa0000-0000-4000-8000-000000000001')?.Name).toBe('B2B');
        expect(eng.PipelineByCode('b2b')?.Name).toBe('B2B');
        expect(eng.DefaultPipeline?.Code).toBe('B2B');
        expect(eng.ActivePipelines.map((p) => p.Code)).toEqual(['B2B']);
        expect(eng.ForecastablePipelines.map((p) => p.Code)).toEqual(['B2B', 'LEGACY']);

        expect(eng.PipelineStageById('bbbb0000-0000-4000-8000-000000000001')?.Name).toBe('Discovery');
        expect(eng.StagesForPipeline('AAAA0000-0000-4000-8000-000000000001', true)).toHaveLength(1);
        expect(eng.StagesForPipeline('AAAA0000-0000-4000-8000-000000000001', false)).toHaveLength(2);

        expect(eng.PipelineCompaniesForPipeline('AAAA0000-0000-4000-8000-000000000001', true)).toHaveLength(1);
        expect(eng.PipelineCompaniesForCompany('dddd0000-0000-4000-8000-000000000001', true)).toHaveLength(1);

        expect(eng.OpenDealStatusTypes.map((s) => s.Code)).toEqual(['OPEN']);
        expect(eng.WonDealStatusTypes.map((s) => s.Code)).toEqual(['WON']);
        expect(eng.LostDealStatusTypes.map((s) => s.Code)).toEqual(['LOST']);
        expect(eng.LockingDealStatusTypes.map((s) => s.Code)).toEqual(['WON', 'LOST']);
        expect(eng.NonClosedDealStatusTypes.map((s) => s.Code)).toEqual(['OPEN', 'HOLD']);

        expect(eng.DealTypeByCode('renewal')?.RequiresRenewalSource).toBe(true);
        expect(eng.ForecastCategoryTypeByCode('commit')?.Name).toBe('Commit');
        expect(eng.LossReasonByCode('budget')?.RequiresNotes).toBe(true);
        expect(eng.OwnerDealRole?.Code).toBe('AE');
        expect(eng.ProspectAccountType?.Code).toBe('PROS');
        expect(eng.BuyingRoleTypeByCode('champ')?.Name).toBe('Champion');
        expect(eng.LeadSourceTypeByCode('inb')?.Name).toBe('Inbound');
        expect(eng.LifecycleStageTypeByCode('sql')?.Name).toBe('SQL');
        expect(eng.DealDigestAudienceTypeByCode('rep')?.Name).toBe('Deal Owner');
    });

    it('overrides ProviderToUse dynamically without latching onto a prior provider', async () => {
        const { calls } = stubEngineLoad(sampleRows());
        const { provider: providerA } = makeProvider({ currentUser: makeUser('00000000-0000-4000-8000-000000000001') });
        const { provider: providerB } = makeProvider({ currentUser: makeUser('00000000-0000-4000-8000-000000000001') });

        await SalesEngineBase.Instance.Config(false, undefined, providerA);
        expect(SalesEngineBase.Instance.ProviderToUse).toBe(providerA);

        await SalesEngineBase.Instance.Config(false, undefined, providerB);
        expect(SalesEngineBase.Instance.ProviderToUse).toBe(providerB);
        // Switching providers forces a reload so data comes from providerB, never stale providerA rows.
        expect(calls[1].forceRefresh).toBe(true);
        expect(calls[1].provider).toBe(providerB);

        // Passing no provider falls back to Metadata.Provider.
        await SalesEngineBase.Instance.Config(false, undefined, undefined);
        expect(SalesEngineBase.Instance.ProviderToUse).toBe(Metadata.Provider);
    });

    it('gates entity loads on CanRead and clears restricted arrays cleanly', async () => {
        const { calls } = stubEngineLoad(sampleRows());
        const user = makeUser('00000000-0000-4000-8000-000000000001');
        const { provider } = makeProvider({
            currentUser: user,
            readableEntities: [SALES_ENGINE_ENTITIES.Pipelines, SALES_ENGINE_ENTITIES.DealStatusTypes],
        });

        await SalesEngineBase.Instance.Config(false, user, provider);
        expect(calls[0].configs.map((c) => c.EntityName)).toEqual([
            SALES_ENGINE_ENTITIES.Pipelines,
            SALES_ENGINE_ENTITIES.DealStatusTypes,
        ]);
        expect(SalesEngineBase.Instance.Pipelines).toHaveLength(3);
        expect(SalesEngineBase.Instance.LossReasons).toEqual([]);
        expect(
            await SalesEngineBase.Instance.EnsurePropertyLoaded('_LossReasons', user, provider),
        ).toBe(false);
    });

    it('evicts cached rows and forces a reload when contextUser changes', async () => {
        const { calls } = stubEngineLoad(sampleRows());
        const userA = makeUser('00000000-0000-4000-8000-00000000000a');
        const userB = makeUser('00000000-0000-4000-8000-00000000000b');
        const { provider } = makeProvider({ currentUser: userA });

        await SalesEngineBase.Instance.Config(false, userA, provider);
        expect(calls).toHaveLength(1);
        expect(calls[0].forceRefresh).toBe(false);

        // Same user: no forced refresh.
        await SalesEngineBase.Instance.Config(false, userA, provider);
        expect(calls).toHaveLength(2);
        expect(calls[1].forceRefresh).toBe(false);

        // Switched user: must force refresh after evicting prior user's cache.
        await SalesEngineBase.Instance.Config(false, userB, provider);
        expect(calls).toHaveLength(3);
        expect(calls[2].forceRefresh).toBe(true);
        expect(calls[2].userId).toBe(userB.ID);
    });

    it('clears backing arrays and forces reload after InvalidateCache()', async () => {
        const { calls } = stubEngineLoad(sampleRows());
        const user = makeUser('00000000-0000-4000-8000-000000000001');
        const { provider } = makeProvider({ currentUser: user });

        await SalesEngineBase.Instance.Config(false, user, provider);
        expect(SalesEngineBase.Instance.Pipelines).toHaveLength(3);

        SalesEngineBase.Instance.InvalidateCache();
        expect(SalesEngineBase.Instance.Pipelines).toEqual([]);
        expect(SalesEngineBase.Instance.PipelineByCode('B2B')).toBeUndefined();

        await SalesEngineBase.Instance.Config(false, user, provider);
        expect(calls[1].forceRefresh).toBe(true);
        expect(SalesEngineBase.Instance.Pipelines).toHaveLength(3);
    });
});
