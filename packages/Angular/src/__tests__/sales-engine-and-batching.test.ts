import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    BaseEngine,
    type BaseEnginePropertyConfig,
    type IMetadataProvider,
    Metadata,
    RunView,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
} from '@memberjunction/core';
import {
    SALES_ENGINE_ENTITIES,
    SalesEngineBase,
} from '@mj-biz-apps/sales-entities';

import { DealWorkspaceService, SECTION_LOOKUP_KEYS } from '../lib/workspace/deal-workspace.service';
import { MJSDealHeroPanel } from '../lib/form-panels/deal-hero.panel';
import { MJS_FOREIGN_ENTITIES } from '../lib/data/entity-names';

const ALL_ENGINE_ENTITIES = Object.values(SALES_ENGINE_ENTITIES);

function makeEngineProvider(): IMetadataProvider {
    const user = { ID: '00000000-0000-4000-8000-000000000001', Name: 'Rep' } as unknown as UserInfo;
    const entities = ALL_ENGINE_ENTITIES.map((name) => ({
        Name: name,
        GetUserPermisions: () => ({ CanRead: true }),
    }));
    return {
        CurrentUser: user,
        Entities: entities,
        EntityByName: (name: string) => entities.find((e) => e.Name === name),
    } as unknown as IMetadataProvider;
}

async function primeSalesEngine(provider: IMetadataProvider): Promise<void> {
    const rowsByEntity: Record<string, unknown[]> = {
        [SALES_ENGINE_ENTITIES.Pipelines]: [
            { ID: 'pipe-1', Name: 'B2B', IsActive: true, IncludeInForecast: true, IsDefault: true, DisplayRank: 1 },
        ],
        [SALES_ENGINE_ENTITIES.PipelineCompanies]: [
            { ID: 'pc-1', PipelineID: 'pipe-1', CompanyID: 'co-1', Company: 'Acme Corp', IsActive: true },
        ],
        [SALES_ENGINE_ENTITIES.PipelineStages]: [
            { ID: 'st-1', PipelineID: 'pipe-1', Name: 'Qualified', DisplayOrder: 1, IsActive: true },
        ],
        [SALES_ENGINE_ENTITIES.DealStatusTypes]: [
            { ID: 'status-open', Name: 'Open', IsActive: true, IsOpen: true, IsWon: false, IsLost: false, IsClosed: false, LocksDeal: false, DisplayRank: 1 },
            { ID: 'status-won', Name: 'Won', IsActive: true, IsOpen: false, IsWon: true, IsLost: false, IsClosed: true, LocksDeal: true, DisplayRank: 2 },
        ],
    };

    vi.spyOn(
        BaseEngine.prototype as unknown as {
            Load: (configs: Partial<BaseEnginePropertyConfig>[]) => Promise<void>;
        },
        'Load',
    ).mockImplementation(async function (this: SalesEngineBase & Record<string, unknown>, configs) {
        const dataMap = new Map<string, { loadedSuccessfully: boolean; data: unknown[] }>();
        for (const cfg of configs) {
            if (cfg.PropertyName && cfg.EntityName) {
                const rows = rowsByEntity[cfg.EntityName] ?? [];
                this[cfg.PropertyName] = rows;
                dataMap.set(cfg.PropertyName, { loadedSuccessfully: true, data: rows });
            }
        }
        this['_loaded'] = true;
        this['_dataMap'] = dataMap;
    });

    await SalesEngineBase.Instance.Config(true, provider.CurrentUser, provider);
}

afterEach(() => {
    SalesEngineBase.Instance.InvalidateCache();
    const internal = SalesEngineBase.Instance as unknown as Record<string, unknown>;
    internal['_loaded'] = false;
    internal['_cacheInvalidated'] = false;
    internal['_dataMap'] = new Map();
    vi.restoreAllMocks();
});

describe('DealWorkspaceService + SalesEngineBase integration', () => {
    it('serves bounded sales reference tables from SalesEngineBase and only queries dynamic MJ: Companies via RunViews', async () => {
        const provider = makeEngineProvider();
        await primeSalesEngine(provider);

        const originalProvider = Metadata.Provider;
        Object.defineProperty(Metadata, 'Provider', { value: provider, configurable: true });
        try {
            const batches: RunViewParams[][] = [];
            vi.spyOn(RunView.prototype, 'RunViews').mockImplementation(async (params: RunViewParams[]) => {
                batches.push(params);
                return params.map((p) => ({
                    Success: true,
                    Results: [{ ID: 'co-1', Name: `Row ${p.EntityName}` }],
                }) as RunViewResult);
            });

            const lookups = await new DealWorkspaceService().LoadLookups(SECTION_LOOKUP_KEYS);

            // Only MJ: Companies should hit RunViews — zero round trips for Pipelines/Stages/Statuses/PipelineCompanies.
            expect(batches).toHaveLength(1);
            expect(batches[0].map((p) => p.EntityName)).toEqual(['MJ: Companies']);

            expect(lookups.Pipelines.map((p) => `${p.ID}/${p.CompanyID}/${p.CompanyName}`)).toEqual(['pipe-1/co-1/Acme Corp']);
            expect(lookups.Stages.map((s) => s.ID)).toEqual(['st-1']);
            expect(lookups.DealStatusTypes.map((s) => s.ID)).toEqual(['status-open', 'status-won']);
            expect(lookups.Companies.map((c) => c.ID)).toEqual(['co-1']);
        } finally {
            Object.defineProperty(Metadata, 'Provider', { value: originalProvider, configurable: true });
        }
    });
});

describe('MJSDealHeroPanel post-lock batching', () => {
    it('collapses order reversals, contract executed-agreement check, and order-total freshness into a single RunViews call', async () => {
        const provider = makeEngineProvider();
        const batches: RunViewParams[][] = [];
        vi.spyOn(RunView, 'FromMetadataProvider').mockReturnValue({
            RunViews: vi.fn(async (params: RunViewParams[]) => {
                batches.push(params);
                return [
                    { Success: true, Results: [{ ID: 'rev-1' }] },
                    { Success: true, Results: [{ ID: 'ctr-1', ContractNumber: 'CTR-1', State: 'Draft', IsAwaitingDocument: true }] },
                ] as RunViewResult[];
            }),
        } as unknown as RunView);

        const panel = Object.create(MJSDealHeroPanel.prototype) as MJSDealHeroPanel;
        Object.defineProperty(panel, 'FormComponent', { value: { ProviderToUse: provider } });
        Object.defineProperty(panel, 'Record', {
            value: {
                ID: 'deal-1',
                IsSaved: true,
                OrderID: 'ord-1',
                ContractID: 'ctr-1',
                AmountIsComputed: true,
                Amount: 1000,
                GetFieldByName: () => ({ ReadOnly: false }),
            },
        });
        Object.assign(panel, {
            IsWon: true,
            IsLocked: true,
            AgreementWarning: null,
            AgreementContractID: null,
            StaleAmountNotice: null,
            reversalOrderIDs: [],
            reversalsGeneration: 0,
            agreementGeneration: 0,
        });

        await (panel as unknown as { resolvePostLockNoticesBatched(): Promise<void> }).resolvePostLockNoticesBatched();

        expect(batches).toHaveLength(1);
        expect(batches[0].map((p) => p.EntityName)).toEqual([
            MJS_FOREIGN_ENTITIES.OrderHeader,
            MJS_FOREIGN_ENTITIES.Contract,
        ]);
        expect(panel.AgreementWarning?.Label).toBe('No executed agreement');
        expect(panel.AgreementContractID).toBe('ctr-1');
    });
});
