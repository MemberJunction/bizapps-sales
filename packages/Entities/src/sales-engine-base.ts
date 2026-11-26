/**
 * @fileoverview Shared bounded reference and taxonomy cache for BizApps Sales.
 *
 * Caches the 13 bounded reference/configuration tables in `__mj_BizAppsSales` so dashboards, boards,
 * forms, panels, entity servers, and remote operations read them in O(1) memory instead of issuing
 * repeated `RunView` round trips on every mount or save.
 *
 * ── DESIGN INVARIANTS (Canonical 5-Rule BizApps Performance & Caching Standard) ───────────────────
 *
 * 1. Bounded reference/taxonomy metadata ONLY. Unbounded transactional tables (`Deals`, `Sales Accounts`,
 *    `Sales Contacts`, `Deal Stage Events`, `Deal Team Members`, `Deal Payment Schedules`,
 *    `Deal Contact Roles`, `Forecast Snapshots`, `Deal Digest Recipients`) are NEVER cached here.
 * 2. Multi-provider & impersonation safety: overrides `ProviderToUse` to follow the active provider
 *    supplied to `Config()` (falling back to `Metadata.Provider`), detects `userId` changes to evict
 *    and force-refresh, gates every entity on `CanRead`, and exposes `InvalidateCache()`.
 * 3. Every entity here is a non-RLS shared lookup table (`CacheLocal: true`, `AutoRefresh: true`).
 *    If any entity later gains an RLS filter, set `CacheLocal: false` on that config immediately.
 * 4. Domain vocabulary is DATA, never code: semantic helpers (`OwnerDealRole`, `OpenDealStatusTypes`,
 *    `WonDealStatusTypes`, `LostDealStatusTypes`, `LockingDealStatusTypes`, `ProspectAccountType`)
 *    read type-table boolean flags, never display names.
 *
 * @module @mj-biz-apps/sales-entities
 */
import {
    BaseEngine,
    BaseEnginePropertyConfig,
    BaseEntity,
    IMetadataProvider,
    Metadata,
    RegisterForStartup,
    UserInfo,
} from '@memberjunction/core';
import { NormalizeUUID } from '@memberjunction/global';

import {
    mjBizAppsSalesAccountTypeEntity,
    mjBizAppsSalesBuyingRoleTypeEntity,
    mjBizAppsSalesDealDigestAudienceTypeEntity,
    mjBizAppsSalesDealRoleEntity,
    mjBizAppsSalesDealStatusTypeEntity,
    mjBizAppsSalesDealTypeEntity,
    mjBizAppsSalesForecastCategoryTypeEntity,
    mjBizAppsSalesLeadSourceTypeEntity,
    mjBizAppsSalesLifecycleStageTypeEntity,
    mjBizAppsSalesLossReasonEntity,
    mjBizAppsSalesPipelineCompanyEntity,
    mjBizAppsSalesPipelineEntity,
    mjBizAppsSalesPipelineStageEntity,
} from './generated/entity_subclasses.js';

/** Entity names cached by {@link SalesEngineBase}. */
export const SALES_ENGINE_ENTITIES = {
    Pipelines: 'MJ_BizApps_Sales: Pipelines',
    PipelineStages: 'MJ_BizApps_Sales: Pipeline Stages',
    PipelineCompanies: 'MJ_BizApps_Sales: Pipeline Companies',
    DealStatusTypes: 'MJ_BizApps_Sales: Deal Status Types',
    DealTypes: 'MJ_BizApps_Sales: Deal Types',
    ForecastCategoryTypes: 'MJ_BizApps_Sales: Forecast Category Types',
    LossReasons: 'MJ_BizApps_Sales: Loss Reasons',
    DealRoles: 'MJ_BizApps_Sales: Deal Roles',
    AccountTypes: 'MJ_BizApps_Sales: Account Types',
    BuyingRoleTypes: 'MJ_BizApps_Sales: Buying Role Types',
    LeadSourceTypes: 'MJ_BizApps_Sales: Lead Source Types',
    LifecycleStageTypes: 'MJ_BizApps_Sales: Lifecycle Stage Types',
    DealDigestAudienceTypes: 'MJ_BizApps_Sales: Deal Digest Audience Types',
} as const;

/** Valid backing property names managed by {@link SalesEngineBase}. */
export type SalesEnginePropertyName = keyof SalesEngineBackingArrays;

interface SalesConfigDefinition {
    PropertyName: SalesEnginePropertyName;
    EntityName: string;
    OrderBy: string;
    CacheLocal: boolean;
}

interface SalesEngineBackingArrays {
    _Pipelines: mjBizAppsSalesPipelineEntity[];
    _PipelineStages: mjBizAppsSalesPipelineStageEntity[];
    _PipelineCompanies: mjBizAppsSalesPipelineCompanyEntity[];
    _DealStatusTypes: mjBizAppsSalesDealStatusTypeEntity[];
    _DealTypes: mjBizAppsSalesDealTypeEntity[];
    _ForecastCategoryTypes: mjBizAppsSalesForecastCategoryTypeEntity[];
    _LossReasons: mjBizAppsSalesLossReasonEntity[];
    _DealRoles: mjBizAppsSalesDealRoleEntity[];
    _AccountTypes: mjBizAppsSalesAccountTypeEntity[];
    _BuyingRoleTypes: mjBizAppsSalesBuyingRoleTypeEntity[];
    _LeadSourceTypes: mjBizAppsSalesLeadSourceTypeEntity[];
    _LifecycleStageTypes: mjBizAppsSalesLifecycleStageTypeEntity[];
    _DealDigestAudienceTypes: mjBizAppsSalesDealDigestAudienceTypeEntity[];
}

/**
 * Canonical load configs for all 13 bounded reference/taxonomy tables.
 *
 * Ordering matches every UI and server surface so workspace, board, deal form, and server see
 * identical ordering (`DisplayRank ASC, Name ASC` for ranked taxonomies; `DisplayOrder ASC, Name ASC`
 * for stages; `__mj_CreatedAt ASC, ID ASC` for pipeline-company links so default-company resolution
 * stays deterministic).
 *
 * All 13 tables are shared, non-RLS reference metadata (`CacheLocal: true`).
 */
const SALES_ENGINE_CONFIG_DEFS: readonly SalesConfigDefinition[] = [
    { PropertyName: '_Pipelines', EntityName: SALES_ENGINE_ENTITIES.Pipelines, OrderBy: 'DisplayRank ASC, Name ASC', CacheLocal: true },
    { PropertyName: '_PipelineStages', EntityName: SALES_ENGINE_ENTITIES.PipelineStages, OrderBy: 'DisplayOrder ASC, Name ASC', CacheLocal: true },
    { PropertyName: '_PipelineCompanies', EntityName: SALES_ENGINE_ENTITIES.PipelineCompanies, OrderBy: '__mj_CreatedAt ASC, ID ASC', CacheLocal: true },
    { PropertyName: '_DealStatusTypes', EntityName: SALES_ENGINE_ENTITIES.DealStatusTypes, OrderBy: 'DisplayRank ASC, Name ASC', CacheLocal: true },
    { PropertyName: '_DealTypes', EntityName: SALES_ENGINE_ENTITIES.DealTypes, OrderBy: 'DisplayRank ASC, Name ASC', CacheLocal: true },
    { PropertyName: '_ForecastCategoryTypes', EntityName: SALES_ENGINE_ENTITIES.ForecastCategoryTypes, OrderBy: 'DisplayRank ASC, Name ASC', CacheLocal: true },
    { PropertyName: '_LossReasons', EntityName: SALES_ENGINE_ENTITIES.LossReasons, OrderBy: 'DisplayRank ASC, Name ASC', CacheLocal: true },
    { PropertyName: '_DealRoles', EntityName: SALES_ENGINE_ENTITIES.DealRoles, OrderBy: 'DisplayRank ASC, Name ASC', CacheLocal: true },
    { PropertyName: '_AccountTypes', EntityName: SALES_ENGINE_ENTITIES.AccountTypes, OrderBy: 'DisplayRank ASC, Name ASC', CacheLocal: true },
    { PropertyName: '_BuyingRoleTypes', EntityName: SALES_ENGINE_ENTITIES.BuyingRoleTypes, OrderBy: 'DisplayRank ASC, Name ASC', CacheLocal: true },
    { PropertyName: '_LeadSourceTypes', EntityName: SALES_ENGINE_ENTITIES.LeadSourceTypes, OrderBy: 'DisplayRank ASC, Name ASC', CacheLocal: true },
    { PropertyName: '_LifecycleStageTypes', EntityName: SALES_ENGINE_ENTITIES.LifecycleStageTypes, OrderBy: 'DisplayRank ASC, Name ASC', CacheLocal: true },
    { PropertyName: '_DealDigestAudienceTypes', EntityName: SALES_ENGINE_ENTITIES.DealDigestAudienceTypes, OrderBy: 'DisplayRank ASC, Name ASC', CacheLocal: true },
];

function normalizeId(value: string | null | undefined): string {
    return value ? NormalizeUUID(String(value)) : '';
}

function normalizeCode(value: string | null | undefined): string {
    return value ? String(value).trim().toLowerCase() : '';
}

function indexById<T extends { ID: string }>(rows: readonly T[]): Map<string, T> {
    const map = new Map<string, T>();
    for (const row of rows) {
        const key = normalizeId(row.ID);
        if (key) map.set(key, row);
    }
    return map;
}

function indexByCode<T extends { Code?: string | null }>(rows: readonly T[]): Map<string, T> {
    const map = new Map<string, T>();
    for (const row of rows) {
        const key = normalizeCode(row.Code);
        if (key) map.set(key, row);
    }
    return map;
}

function groupById<T>(rows: readonly T[], keyOf: (row: T) => string | null | undefined): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const row of rows) {
        const key = normalizeId(keyOf(row));
        if (!key) continue;
        const bucket = map.get(key);
        if (bucket) {
            bucket.push(row);
        } else {
            map.set(key, [row]);
        }
    }
    return map;
}

/**
 * Process-wide (and client-session-wide) engine for BizApps Sales bounded reference & taxonomy data.
 *
 * Uses `BaseSingleton` (inherited through `BaseEngine`) and `@RegisterForStartup()` so MJ loads it
 * automatically on startup and keeps every cached array synchronized via `BaseEntity` save/delete
 * events (`AutoRefresh: true`).
 */
@RegisterForStartup()
export class SalesEngineBase extends BaseEngine<SalesEngineBase> {
    protected constructor() {
        super();
    }

    public static get Instance(): SalesEngineBase {
        return super.getInstance<SalesEngineBase>();
    }

    // ── Multi-provider & impersonation state ─────────────────────────────────────────────────────
    private _activeProvider: IMetadataProvider | null = null;
    private _loadedForProvider: IMetadataProvider | null = null;
    private _loadedForUserId: string | null = null;
    private _cacheInvalidated = false;

    /**
     * Always follows the active provider supplied to `Config()`, falling back to `Metadata.Provider`.
     * Prevents `BaseEngine` from latching permanently onto the bootstrap provider during impersonation
     * or multi-provider testing.
     */
    public override get ProviderToUse(): IMetadataProvider {
        return this._activeProvider ?? Metadata.Provider;
    }

    // ── Backing arrays populated by BaseEngine.Load() ────────────────────────────────────────────
    private _Pipelines: mjBizAppsSalesPipelineEntity[] = [];
    private _PipelineStages: mjBizAppsSalesPipelineStageEntity[] = [];
    private _PipelineCompanies: mjBizAppsSalesPipelineCompanyEntity[] = [];
    private _DealStatusTypes: mjBizAppsSalesDealStatusTypeEntity[] = [];
    private _DealTypes: mjBizAppsSalesDealTypeEntity[] = [];
    private _ForecastCategoryTypes: mjBizAppsSalesForecastCategoryTypeEntity[] = [];
    private _LossReasons: mjBizAppsSalesLossReasonEntity[] = [];
    private _DealRoles: mjBizAppsSalesDealRoleEntity[] = [];
    private _AccountTypes: mjBizAppsSalesAccountTypeEntity[] = [];
    private _BuyingRoleTypes: mjBizAppsSalesBuyingRoleTypeEntity[] = [];
    private _LeadSourceTypes: mjBizAppsSalesLeadSourceTypeEntity[] = [];
    private _LifecycleStageTypes: mjBizAppsSalesLifecycleStageTypeEntity[] = [];
    private _DealDigestAudienceTypes: mjBizAppsSalesDealDigestAudienceTypeEntity[] = [];

    // ── O(1) lookup indexes rebuilt after every Load / AutoRefresh ───────────────────────────────
    private _pipelinesById = new Map<string, mjBizAppsSalesPipelineEntity>();
    private _pipelinesByCode = new Map<string, mjBizAppsSalesPipelineEntity>();
    private _stagesById = new Map<string, mjBizAppsSalesPipelineStageEntity>();
    private _stagesByPipelineId = new Map<string, mjBizAppsSalesPipelineStageEntity[]>();
    private _pipelineCompaniesByPipelineId = new Map<string, mjBizAppsSalesPipelineCompanyEntity[]>();
    private _pipelineCompaniesByCompanyId = new Map<string, mjBizAppsSalesPipelineCompanyEntity[]>();
    private _dealStatusTypesById = new Map<string, mjBizAppsSalesDealStatusTypeEntity>();
    private _dealStatusTypesByCode = new Map<string, mjBizAppsSalesDealStatusTypeEntity>();
    private _dealTypesById = new Map<string, mjBizAppsSalesDealTypeEntity>();
    private _dealTypesByCode = new Map<string, mjBizAppsSalesDealTypeEntity>();
    private _forecastCategoryTypesById = new Map<string, mjBizAppsSalesForecastCategoryTypeEntity>();
    private _forecastCategoryTypesByCode = new Map<string, mjBizAppsSalesForecastCategoryTypeEntity>();
    private _lossReasonsById = new Map<string, mjBizAppsSalesLossReasonEntity>();
    private _lossReasonsByCode = new Map<string, mjBizAppsSalesLossReasonEntity>();
    private _dealRolesById = new Map<string, mjBizAppsSalesDealRoleEntity>();
    private _dealRolesByCode = new Map<string, mjBizAppsSalesDealRoleEntity>();
    private _accountTypesById = new Map<string, mjBizAppsSalesAccountTypeEntity>();
    private _accountTypesByCode = new Map<string, mjBizAppsSalesAccountTypeEntity>();
    private _buyingRoleTypesById = new Map<string, mjBizAppsSalesBuyingRoleTypeEntity>();
    private _buyingRoleTypesByCode = new Map<string, mjBizAppsSalesBuyingRoleTypeEntity>();
    private _leadSourceTypesById = new Map<string, mjBizAppsSalesLeadSourceTypeEntity>();
    private _leadSourceTypesByCode = new Map<string, mjBizAppsSalesLeadSourceTypeEntity>();
    private _lifecycleStageTypesById = new Map<string, mjBizAppsSalesLifecycleStageTypeEntity>();
    private _lifecycleStageTypesByCode = new Map<string, mjBizAppsSalesLifecycleStageTypeEntity>();
    private _digestAudienceTypesById = new Map<string, mjBizAppsSalesDealDigestAudienceTypeEntity>();
    private _digestAudienceTypesByCode = new Map<string, mjBizAppsSalesDealDigestAudienceTypeEntity>();

    /**
     * Loads (or refreshes) all readable BizApps Sales reference & taxonomy entities in a single
     * batched `RunViews` round trip via `BaseEngine.Load()`.
     *
     * Automatically detects `userId` changes (for example during impersonation or login switches)
     * and forces a clean reload after evicting prior cached rows. Entities the effective user cannot
     * read (`CanRead === false`) or that are absent from metadata are skipped cleanly without errors.
     */
    public async Config(
        forceRefresh: boolean = false,
        contextUser?: UserInfo,
        provider?: IMetadataProvider,
    ): Promise<boolean> {
        this._activeProvider = provider ?? null;
        const activeProvider = this.ProviderToUse;
        const effectiveUser = contextUser ?? activeProvider?.CurrentUser;
        const userId = effectiveUser?.ID ? normalizeId(String(effectiveUser.ID)) : null;

        const userChanged = this.Loaded && this._loadedForUserId !== userId;
        const providerChanged =
            this.Loaded &&
            this._loadedForProvider !== null &&
            activeProvider !== this._loadedForProvider;

        if (userChanged || providerChanged) {
            this.clearBackingArraysAndIndexes();
        }

        const shouldForce = Boolean(forceRefresh) || userChanged || providerChanged || this._cacheInvalidated;
        const configs = this.buildPermittedConfigs(activeProvider, effectiveUser);

        if (configs.length === 0) {
            this.clearBackingArraysAndIndexes();
            this._loadedForUserId = userId;
            this._loadedForProvider = activeProvider ?? null;
            this._cacheInvalidated = false;
            return true;
        }

        await this.Load(configs, activeProvider, shouldForce, effectiveUser);
        this.rebuildIndexes();
        this._loadedForUserId = userId;
        this._loadedForProvider = activeProvider ?? null;
        this._cacheInvalidated = false;
        return this.Loaded;
    }

    /**
     * Clears all cached reference rows and lookup maps, and forces the next `Config()` call to
     * reload fresh rows from the active provider.
     */
    public InvalidateCache(): void {
        this.clearBackingArraysAndIndexes();
        this._loadedForUserId = null;
        this._loadedForProvider = null;
        this._cacheInvalidated = true;
    }

    /**
     * Ensures `SalesEngineBase` has loaded `propertyName` when an `IMetadataProvider` carrying the
     * entity's metadata is available. Returns `true` when the property is loaded and safe to read
     * from memory, or `false` when no provider/metadata is available or the entity is not readable
     * (so callers can degrade or fall back cleanly).
     */
    public async EnsurePropertyLoaded(
        propertyName: SalesEnginePropertyName,
        contextUser?: UserInfo,
        provider?: IMetadataProvider,
    ): Promise<boolean> {
        const def = SALES_ENGINE_CONFIG_DEFS.find((c) => c.PropertyName === propertyName);
        if (!def) return false;
        const candidateProvider = provider ?? this._activeProvider ?? Metadata.Provider;
        const effectiveUser = contextUser ?? candidateProvider?.CurrentUser;
        if (!this.canReadEntity(def.EntityName, candidateProvider, effectiveUser)) {
            return false;
        }
        const userId = effectiveUser?.ID ? normalizeId(String(effectiveUser.ID)) : null;
        const userChanged = this.Loaded && this._loadedForUserId !== userId;
        const providerChanged =
            this.Loaded &&
            this._loadedForProvider !== null &&
            candidateProvider !== this._loadedForProvider;
        if (!this.Loaded || this._cacheInvalidated || userChanged || providerChanged || !this.PropertyLoadedSuccessfully(propertyName)) {
            await this.Config(false, contextUser, provider);
        }
        return this.Loaded && this.PropertyLoadedSuccessfully(propertyName);
    }

    /** Rebuilds all O(1) lookup indexes after initial load and after every AutoRefresh reload. */
    protected override async AdditionalLoading(_contextUser?: UserInfo): Promise<void> {
        this.rebuildIndexes();
    }

    /** Keeps O(1) lookup indexes synchronized when `BaseEngine` mutates a cached array in place. */
    protected override NotifyDataChange(
        config: BaseEnginePropertyConfig,
        data: unknown[],
        changeType: 'refresh' | 'add' | 'update' | 'delete' = 'refresh',
        affectedEntity?: BaseEntity,
    ): void {
        this.rebuildIndexes();
        super.NotifyDataChange(config, data, changeType, affectedEntity);
    }

    private buildPermittedConfigs(
        provider: IMetadataProvider | null | undefined,
        user: UserInfo | undefined,
    ): Partial<BaseEnginePropertyConfig>[] {
        const configs: Partial<BaseEnginePropertyConfig>[] = [];
        for (const def of SALES_ENGINE_CONFIG_DEFS) {
            if (this.canReadEntity(def.EntityName, provider, user)) {
                configs.push({
                    Type: 'entity',
                    PropertyName: def.PropertyName,
                    EntityName: def.EntityName,
                    OrderBy: def.OrderBy,
                    AddToObject: true,
                    AutoRefresh: true,
                    CacheLocal: def.CacheLocal,
                });
            } else {
                this.resetBackingArray(def.PropertyName);
            }
        }
        return configs;
    }

    private canReadEntity(
        entityName: string,
        provider: IMetadataProvider | null | undefined,
        user: UserInfo | undefined,
    ): boolean {
        if (!provider) return false;
        const entity =
            typeof provider.EntityByName === 'function'
                ? provider.EntityByName(entityName)
                : provider.Entities?.find((e) => e.Name === entityName);
        if (!entity) return false;
        if (!user) return true;
        return entity.GetUserPermisions?.(user)?.CanRead !== false;
    }

    private resetBackingArray(propertyName: keyof SalesEngineBackingArrays): void {
        switch (propertyName) {
            case '_Pipelines': this._Pipelines = []; break;
            case '_PipelineStages': this._PipelineStages = []; break;
            case '_PipelineCompanies': this._PipelineCompanies = []; break;
            case '_DealStatusTypes': this._DealStatusTypes = []; break;
            case '_DealTypes': this._DealTypes = []; break;
            case '_ForecastCategoryTypes': this._ForecastCategoryTypes = []; break;
            case '_LossReasons': this._LossReasons = []; break;
            case '_DealRoles': this._DealRoles = []; break;
            case '_AccountTypes': this._AccountTypes = []; break;
            case '_BuyingRoleTypes': this._BuyingRoleTypes = []; break;
            case '_LeadSourceTypes': this._LeadSourceTypes = []; break;
            case '_LifecycleStageTypes': this._LifecycleStageTypes = []; break;
            case '_DealDigestAudienceTypes': this._DealDigestAudienceTypes = []; break;
        }
    }

    private clearBackingArraysAndIndexes(): void {
        for (const def of SALES_ENGINE_CONFIG_DEFS) {
            this.resetBackingArray(def.PropertyName);
        }
        this.rebuildIndexes();
    }

    private rebuildIndexes(): void {
        this._pipelinesById = indexById(this._Pipelines);
        this._pipelinesByCode = indexByCode(this._Pipelines);
        this._stagesById = indexById(this._PipelineStages);
        this._stagesByPipelineId = groupById(this._PipelineStages, (s) => s.PipelineID);
        this._pipelineCompaniesByPipelineId = groupById(this._PipelineCompanies, (pc) => pc.PipelineID);
        this._pipelineCompaniesByCompanyId = groupById(this._PipelineCompanies, (pc) => pc.CompanyID);
        this._dealStatusTypesById = indexById(this._DealStatusTypes);
        this._dealStatusTypesByCode = indexByCode(this._DealStatusTypes);
        this._dealTypesById = indexById(this._DealTypes);
        this._dealTypesByCode = indexByCode(this._DealTypes);
        this._forecastCategoryTypesById = indexById(this._ForecastCategoryTypes);
        this._forecastCategoryTypesByCode = indexByCode(this._ForecastCategoryTypes);
        this._lossReasonsById = indexById(this._LossReasons);
        this._lossReasonsByCode = indexByCode(this._LossReasons);
        this._dealRolesById = indexById(this._DealRoles);
        this._dealRolesByCode = indexByCode(this._DealRoles);
        this._accountTypesById = indexById(this._AccountTypes);
        this._accountTypesByCode = indexByCode(this._AccountTypes);
        this._buyingRoleTypesById = indexById(this._BuyingRoleTypes);
        this._buyingRoleTypesByCode = indexByCode(this._BuyingRoleTypes);
        this._leadSourceTypesById = indexById(this._LeadSourceTypes);
        this._leadSourceTypesByCode = indexByCode(this._LeadSourceTypes);
        this._lifecycleStageTypesById = indexById(this._LifecycleStageTypes);
        this._lifecycleStageTypesByCode = indexByCode(this._LifecycleStageTypes);
        this._digestAudienceTypesById = indexById(this._DealDigestAudienceTypes);
        this._digestAudienceTypesByCode = indexByCode(this._DealDigestAudienceTypes);
    }

    // ── Pipelines ────────────────────────────────────────────────────────────────────────────────

    public get Pipelines(): readonly mjBizAppsSalesPipelineEntity[] {
        return this._Pipelines;
    }

    public get ActivePipelines(): mjBizAppsSalesPipelineEntity[] {
        return this._Pipelines.filter((p) => p.IsActive === true);
    }

    /** Active pipelines plus retired ones still flagged `IncludeInForecast` (golive#423). */
    public get ForecastablePipelines(): mjBizAppsSalesPipelineEntity[] {
        return this._Pipelines.filter((p) => p.IsActive === true || p.IncludeInForecast === true);
    }

    public get DefaultPipeline(): mjBizAppsSalesPipelineEntity | undefined {
        return this._Pipelines.find((p) => p.IsDefault === true && p.IsActive === true)
            ?? this._Pipelines.find((p) => p.IsDefault === true);
    }

    public PipelineById(id: string | null | undefined): mjBizAppsSalesPipelineEntity | undefined {
        return this._pipelinesById.get(normalizeId(id));
    }

    public PipelineByCode(code: string | null | undefined): mjBizAppsSalesPipelineEntity | undefined {
        return this._pipelinesByCode.get(normalizeCode(code));
    }

    // ── Pipeline Stages ──────────────────────────────────────────────────────────────────────────

    public get PipelineStages(): readonly mjBizAppsSalesPipelineStageEntity[] {
        return this._PipelineStages;
    }

    public get ActivePipelineStages(): mjBizAppsSalesPipelineStageEntity[] {
        return this._PipelineStages.filter((s) => s.IsActive === true);
    }

    public PipelineStageById(id: string | null | undefined): mjBizAppsSalesPipelineStageEntity | undefined {
        return this._stagesById.get(normalizeId(id));
    }

    public StagesForPipeline(
        pipelineId: string | null | undefined,
        activeOnly: boolean = true,
    ): mjBizAppsSalesPipelineStageEntity[] {
        const list = this._stagesByPipelineId.get(normalizeId(pipelineId)) ?? [];
        return activeOnly ? list.filter((s) => s.IsActive === true) : [...list];
    }

    // ── Pipeline Companies ───────────────────────────────────────────────────────────────────────

    public get PipelineCompanies(): readonly mjBizAppsSalesPipelineCompanyEntity[] {
        return this._PipelineCompanies;
    }

    public get ActivePipelineCompanies(): mjBizAppsSalesPipelineCompanyEntity[] {
        return this._PipelineCompanies.filter((pc) => pc.IsActive === true);
    }

    public PipelineCompaniesForPipeline(
        pipelineId: string | null | undefined,
        activeOnly: boolean = false,
    ): mjBizAppsSalesPipelineCompanyEntity[] {
        const list = this._pipelineCompaniesByPipelineId.get(normalizeId(pipelineId)) ?? [];
        return activeOnly ? list.filter((pc) => pc.IsActive === true) : [...list];
    }

    public PipelineCompaniesForCompany(
        companyId: string | null | undefined,
        activeOnly: boolean = true,
    ): mjBizAppsSalesPipelineCompanyEntity[] {
        const list = this._pipelineCompaniesByCompanyId.get(normalizeId(companyId)) ?? [];
        return activeOnly ? list.filter((pc) => pc.IsActive === true) : [...list];
    }

    // ── Deal Status Types ────────────────────────────────────────────────────────────────────────

    public get DealStatusTypes(): readonly mjBizAppsSalesDealStatusTypeEntity[] {
        return this._DealStatusTypes;
    }

    public get ActiveDealStatusTypes(): mjBizAppsSalesDealStatusTypeEntity[] {
        return this._DealStatusTypes.filter((row) => row.IsActive === true);
    }

    public get OpenDealStatusTypes(): mjBizAppsSalesDealStatusTypeEntity[] {
        return this._DealStatusTypes.filter((row) => row.IsOpen === true && row.IsActive === true);
    }

    public get WonDealStatusTypes(): mjBizAppsSalesDealStatusTypeEntity[] {
        return this._DealStatusTypes.filter((row) => row.IsWon === true);
    }

    public get LostDealStatusTypes(): mjBizAppsSalesDealStatusTypeEntity[] {
        return this._DealStatusTypes.filter((row) => row.IsLost === true);
    }

    public get LockingDealStatusTypes(): mjBizAppsSalesDealStatusTypeEntity[] {
        return this._DealStatusTypes.filter((row) => row.LocksDeal === true);
    }

    public get NonClosedDealStatusTypes(): mjBizAppsSalesDealStatusTypeEntity[] {
        return this._DealStatusTypes.filter((row) => row.IsClosed !== true);
    }

    public DealStatusTypeById(id: string | null | undefined): mjBizAppsSalesDealStatusTypeEntity | undefined {
        return this._dealStatusTypesById.get(normalizeId(id));
    }

    public DealStatusTypeByCode(code: string | null | undefined): mjBizAppsSalesDealStatusTypeEntity | undefined {
        return this._dealStatusTypesByCode.get(normalizeCode(code));
    }

    // ── Deal Types ───────────────────────────────────────────────────────────────────────────────

    public get DealTypes(): readonly mjBizAppsSalesDealTypeEntity[] {
        return this._DealTypes;
    }

    public get ActiveDealTypes(): mjBizAppsSalesDealTypeEntity[] {
        return this._DealTypes.filter((row) => row.IsActive === true);
    }

    public DealTypeById(id: string | null | undefined): mjBizAppsSalesDealTypeEntity | undefined {
        return this._dealTypesById.get(normalizeId(id));
    }

    public DealTypeByCode(code: string | null | undefined): mjBizAppsSalesDealTypeEntity | undefined {
        return this._dealTypesByCode.get(normalizeCode(code));
    }

    // ── Forecast Category Types ──────────────────────────────────────────────────────────────────

    public get ForecastCategoryTypes(): readonly mjBizAppsSalesForecastCategoryTypeEntity[] {
        return this._ForecastCategoryTypes;
    }

    public get ActiveForecastCategoryTypes(): mjBizAppsSalesForecastCategoryTypeEntity[] {
        return this._ForecastCategoryTypes.filter((row) => row.IsActive === true);
    }

    public ForecastCategoryTypeById(id: string | null | undefined): mjBizAppsSalesForecastCategoryTypeEntity | undefined {
        return this._forecastCategoryTypesById.get(normalizeId(id));
    }

    public ForecastCategoryTypeByCode(code: string | null | undefined): mjBizAppsSalesForecastCategoryTypeEntity | undefined {
        return this._forecastCategoryTypesByCode.get(normalizeCode(code));
    }

    // ── Loss Reasons ─────────────────────────────────────────────────────────────────────────────

    public get LossReasons(): readonly mjBizAppsSalesLossReasonEntity[] {
        return this._LossReasons;
    }

    public get ActiveLossReasons(): mjBizAppsSalesLossReasonEntity[] {
        return this._LossReasons.filter((row) => row.IsActive === true);
    }

    public LossReasonById(id: string | null | undefined): mjBizAppsSalesLossReasonEntity | undefined {
        return this._lossReasonsById.get(normalizeId(id));
    }

    public LossReasonByCode(code: string | null | undefined): mjBizAppsSalesLossReasonEntity | undefined {
        return this._lossReasonsByCode.get(normalizeCode(code));
    }

    // ── Deal Roles ───────────────────────────────────────────────────────────────────────────────

    public get DealRoles(): readonly mjBizAppsSalesDealRoleEntity[] {
        return this._DealRoles;
    }

    public get ActiveDealRoles(): mjBizAppsSalesDealRoleEntity[] {
        return this._DealRoles.filter((row) => row.IsActive === true);
    }

    /** First active DealRole flagged `IsOwnerRole = true` (by flag, never by name). */
    public get OwnerDealRole(): mjBizAppsSalesDealRoleEntity | undefined {
        return this._DealRoles.find((row) => row.IsOwnerRole === true && row.IsActive === true);
    }

    public DealRoleById(id: string | null | undefined): mjBizAppsSalesDealRoleEntity | undefined {
        return this._dealRolesById.get(normalizeId(id));
    }

    public DealRoleByCode(code: string | null | undefined): mjBizAppsSalesDealRoleEntity | undefined {
        return this._dealRolesByCode.get(normalizeCode(code));
    }

    // ── Account Types ────────────────────────────────────────────────────────────────────────────

    public get AccountTypes(): readonly mjBizAppsSalesAccountTypeEntity[] {
        return this._AccountTypes;
    }

    public get ActiveAccountTypes(): mjBizAppsSalesAccountTypeEntity[] {
        return this._AccountTypes.filter((row) => row.IsActive === true);
    }

    /** First active AccountType flagged `IsProspect = true`, lowest DisplayRank then ID. */
    public get ProspectAccountType(): mjBizAppsSalesAccountTypeEntity | undefined {
        const candidates = this._AccountTypes
            .filter((row) => row.IsProspect === true && row.IsActive === true && Boolean(row.ID))
            .sort((a, b) => (a.DisplayRank ?? 0) - (b.DisplayRank ?? 0) || String(a.ID).localeCompare(String(b.ID)));
        return candidates[0];
    }

    public AccountTypeById(id: string | null | undefined): mjBizAppsSalesAccountTypeEntity | undefined {
        return this._accountTypesById.get(normalizeId(id));
    }

    public AccountTypeByCode(code: string | null | undefined): mjBizAppsSalesAccountTypeEntity | undefined {
        return this._accountTypesByCode.get(normalizeCode(code));
    }

    // ── Buying Role Types ────────────────────────────────────────────────────────────────────────

    public get BuyingRoleTypes(): readonly mjBizAppsSalesBuyingRoleTypeEntity[] {
        return this._BuyingRoleTypes;
    }

    public get ActiveBuyingRoleTypes(): mjBizAppsSalesBuyingRoleTypeEntity[] {
        return this._BuyingRoleTypes.filter((row) => row.IsActive === true);
    }

    public BuyingRoleTypeById(id: string | null | undefined): mjBizAppsSalesBuyingRoleTypeEntity | undefined {
        return this._buyingRoleTypesById.get(normalizeId(id));
    }

    public BuyingRoleTypeByCode(code: string | null | undefined): mjBizAppsSalesBuyingRoleTypeEntity | undefined {
        return this._buyingRoleTypesByCode.get(normalizeCode(code));
    }

    // ── Lead Source Types ────────────────────────────────────────────────────────────────────────

    public get LeadSourceTypes(): readonly mjBizAppsSalesLeadSourceTypeEntity[] {
        return this._LeadSourceTypes;
    }

    public get ActiveLeadSourceTypes(): mjBizAppsSalesLeadSourceTypeEntity[] {
        return this._LeadSourceTypes.filter((row) => row.IsActive === true);
    }

    public LeadSourceTypeById(id: string | null | undefined): mjBizAppsSalesLeadSourceTypeEntity | undefined {
        return this._leadSourceTypesById.get(normalizeId(id));
    }

    public LeadSourceTypeByCode(code: string | null | undefined): mjBizAppsSalesLeadSourceTypeEntity | undefined {
        return this._leadSourceTypesByCode.get(normalizeCode(code));
    }

    // ── Lifecycle Stage Types ────────────────────────────────────────────────────────────────────

    public get LifecycleStageTypes(): readonly mjBizAppsSalesLifecycleStageTypeEntity[] {
        return this._LifecycleStageTypes;
    }

    public get ActiveLifecycleStageTypes(): mjBizAppsSalesLifecycleStageTypeEntity[] {
        return this._LifecycleStageTypes.filter((row) => row.IsActive === true);
    }

    public LifecycleStageTypeById(id: string | null | undefined): mjBizAppsSalesLifecycleStageTypeEntity | undefined {
        return this._lifecycleStageTypesById.get(normalizeId(id));
    }

    public LifecycleStageTypeByCode(code: string | null | undefined): mjBizAppsSalesLifecycleStageTypeEntity | undefined {
        return this._lifecycleStageTypesByCode.get(normalizeCode(code));
    }

    // ── Deal Digest Audience Types ───────────────────────────────────────────────────────────────

    public get DealDigestAudienceTypes(): readonly mjBizAppsSalesDealDigestAudienceTypeEntity[] {
        return this._DealDigestAudienceTypes;
    }

    public get ActiveDealDigestAudienceTypes(): mjBizAppsSalesDealDigestAudienceTypeEntity[] {
        return this._DealDigestAudienceTypes.filter((row) => row.IsActive === true);
    }

    public DealDigestAudienceTypeById(id: string | null | undefined): mjBizAppsSalesDealDigestAudienceTypeEntity | undefined {
        return this._digestAudienceTypesById.get(normalizeId(id));
    }

    public DealDigestAudienceTypeByCode(code: string | null | undefined): mjBizAppsSalesDealDigestAudienceTypeEntity | undefined {
        return this._digestAudienceTypesByCode.get(normalizeCode(code));
    }
}

/** Anti-tree-shaking anchor keeping `@RegisterForStartup()` alive in bundles. */
export function LoadSalesEngineBase(): void {
    void SalesEngineBase;
}
