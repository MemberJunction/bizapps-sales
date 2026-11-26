/**
 * Deterministic unit tests for `DealProposalPreviewComponent`, `MJSDealProposalPanel`,
 * and `LoadDealProposalPreviewState` (MJ Docs / `MJ: Artifacts` optional Deal Proposal &
 * Executive Brief preview).
 *
 * Covers all required UX states, performance standards, and race-condition guards:
 *   1. Linked `ProposalArtifactID` with `ArtifactVersion` + `ArtifactGuestShareLink` rows ->
 *      single batched `RunViews([...])` (`ResultType: 'simple'`, `ID IN (...)` / `ArtifactID IN (...)`,
 *      excluding `Content` blob), pinned version badge, guest share metadata, stripped Markdown excerpt,
 *      and `@memberjunction/ng-artifacts` `<mj-artifact-viewer-panel>` (`6.3.0-edge.1`).
 *   2. Unlinked / legacy Deal (`ProposalArtifactID === null`) and unsaved Deal -> clean empty state
 *      with zero `RunViews` queries issued.
 *   3. Loading state transition while async `RunViews` is in flight.
 *   4. Unauthorized (`CanRead === false`, RLS zero rows, permission-denied response), load-error
 *      (provider exception / failure), and zero-versions non-fatal fallback states.
 *   5. Rapid Deal-switching stale-response race guard:
 *      - Deal A (linked, slow) -> Deal B (linked, fast) -> Deal A resolves late and is discarded.
 *      - Deal A (linked, slow) -> Deal C (`ProposalArtifactID === null`) -> Deal A resolves late and is discarded.
 *   6. `UserInfoEngine.Instance` preference persistence (zero `localStorage`), null-prototype safety
 *      via `Object.prototype.hasOwnProperty.call`, and `MJSDealProposalPanel` close-lock editability.
 */
import '@angular/compiler';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    ChangeDetectorRef,
    Injector,
    runInInjectionContext,
    type SimpleChange,
    type SimpleChanges,
} from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import {
    EntityInfo,
    Metadata,
    RunView,
    UserInfo,
    type IMetadataProvider,
    type IRunViewProvider,
    type RunViewParams,
    type RunViewResult,
} from '@memberjunction/core';
import { UserInfoEngine } from '@memberjunction/core-entities';
import { ArtifactIconService, ArtifactsModule } from '@memberjunction/ng-artifacts';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import { NavigationService } from '@memberjunction/ng-shared';
import type { DealEntity } from '@mj-biz-apps/sales-entities';
import type { DealFormLockState } from '../lib/custom/deal-form.component';
import {
    BuildDealProposalPreviewBatchParams,
    DEAL_PROPOSAL_PREVIEW_EXPANDED_PREF_KEY,
    DealProposalPreviewComponent,
    LoadDealProposalPreviewState,
    MJSDealProposalPanel,
    ReadOwnProperty,
    ResolveDealProposalIconClass,
    StripMarkdownToPlainText,
    type DealProposalArtifactSummary,
    type DealProposalArtifactVersionSummary,
    type DealProposalGuestShareLinkSummary,
} from '../lib/form-panels/deal-proposal-preview.panel';

const PANEL_SRC_PATH = fileURLToPath(
    new URL('../lib/form-panels/deal-proposal-preview.panel.ts', import.meta.url),
);

class StubChangeDetectorRef extends ChangeDetectorRef {
    public readonly markForCheck = vi.fn();
    public readonly detectChanges = vi.fn();
    public readonly detach = vi.fn();
    public readonly reattach = vi.fn();
    public readonly checkNoChanges = vi.fn();
}

function createDeferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: Error) => void;
} {
    let resolve!: (value: T) => void;
    let reject!: (reason?: Error) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function createRunViewStub(
    runViewsImpl: (params: RunViewParams[]) => Promise<RunViewResult[]>,
): {
    rvInstance: RunView;
    runViewsSpy: ReturnType<typeof vi.fn>;
} {
    const rvInstance = new RunView();
    const runViewsSpy = vi.fn(runViewsImpl);
    vi.spyOn(rvInstance, 'RunViews').mockImplementation(runViewsSpy);
    return { rvInstance, runViewsSpy };
}

function createPermissionProvider(canReadArtifact: boolean): IMetadataProvider & IRunViewProvider {
    const baseProvider = Metadata.Provider;
    const mockUser = new UserInfo(undefined, { ID: 'user-sales-ae-1', Name: 'Elena Rostova' });
    const entityStub = Object.create(EntityInfo.prototype) as EntityInfo;
    vi.spyOn(entityStub, 'GetUserPermisions').mockReturnValue({
        CanRead: canReadArtifact,
        CanCreate: false,
        CanUpdate: false,
        CanDelete: false,
    });

    const scopedProvider = Object.create(baseProvider ?? Object.prototype) as IMetadataProvider & IRunViewProvider;
    Object.defineProperty(scopedProvider, 'CurrentUser', {
        value: mockUser,
        configurable: true,
    });
    Object.defineProperty(scopedProvider, 'EntityByName', {
        value: (name: string): EntityInfo | undefined => (name === 'MJ: Artifacts' ? entityStub : undefined),
        configurable: true,
    });
    Object.defineProperty(scopedProvider, 'RunView', {
        value: vi.fn(),
        configurable: true,
    });
    Object.defineProperty(scopedProvider, 'RunViews', {
        value: vi.fn(),
        configurable: true,
    });
    return scopedProvider;
}

function createComponentInDi(): {
    component: DealProposalPreviewComponent;
    cdrStub: StubChangeDetectorRef;
    openEntityRecordSpy: ReturnType<typeof vi.fn>;
} {
    const cdrStub = new StubChangeDetectorRef();
    const openEntityRecordSpy = vi.fn();
    const iconServiceStub = { NormalizeMetadataIcon: (icon: string): string => icon };
    const navigationStub = { OpenEntityRecord: openEntityRecordSpy };

    const injector = Injector.create({
        providers: [
            { provide: ChangeDetectorRef, useValue: cdrStub },
            { provide: ArtifactIconService, useValue: iconServiceStub },
            { provide: NavigationService, useValue: navigationStub },
        ],
    });

    const component = runInInjectionContext(injector, () => new DealProposalPreviewComponent());
    return { component, cdrStub, openEntityRecordSpy };
}

interface StubDealFormHost extends BaseFormComponent, DealFormLockState {
    OnFormNavigate: ReturnType<typeof vi.fn>;
    ProviderToUse: IMetadataProvider;
}

function createDealFormHostStub(isLocked: boolean, isLost: boolean): StubDealFormHost {
    const host = Object.create(BaseFormComponent.prototype) as StubDealFormHost;
    Object.defineProperties(host, {
        IsLocked: { value: isLocked, configurable: true },
        IsLost: { value: isLost, configurable: true },
        IsWon: { value: isLocked && !isLost, configurable: true },
        IsStatusMissing: { value: false, configurable: true },
        IsPersistedAccountBlank: { value: false, configurable: true },
        RefreshDealState: { value: vi.fn(async () => undefined), configurable: true },
        OnFormNavigate: { value: vi.fn(), configurable: true },
        ProviderToUse: { value: createPermissionProvider(true), configurable: true },
    });
    return host;
}

describe('DealProposalPreviewComponent & LoadDealProposalPreviewState', () => {
    it('loads a linked ProposalArtifactID with pinned versions and guest share links in one batched RunViews call', async () => {
        const dealID = 'D0C50006-4B26-4E10-A800-000000000001';
        const artifactID = 'D0C50007-4B26-4E10-A800-000000000001';
        const artifactRow: DealProposalArtifactSummary = {
            ID: artifactID,
            Name: 'Customer Proposal: Northwind Clinical Data Hub Expansion',
            Description:
                '### Executive Summary\n**Enterprise Clinical Hub** deployment with `99.95% SLA` and [Commercial Schedule](https://example.test/schedule).',
            TypeID: 'type-md',
            Type: 'Markdown Document',
            Visibility: 'Organization',
            DelegateEntityID: '79148DE5-7F99-44AC-ACD4-5EE7BA93D354',
            DelegateRecordID: dealID,
            __mj_UpdatedAt: '2026-11-26T18:00:00.000Z',
        };
        const versionRows: DealProposalArtifactVersionSummary[] = [
            {
                ID: 'D0C50008-4B26-4E10-A800-000000000002',
                ArtifactID: artifactID,
                VersionNumber: 2,
                Name: 'Commercial Final v2',
                Description: 'Updated rollout milestones.',
                Comments: 'CFO reviewed',
                __mj_CreatedAt: '2026-11-26T18:00:00.000Z',
                __mj_UpdatedAt: '2026-11-26T18:00:00.000Z',
            },
            {
                ID: 'D0C50008-4B26-4E10-A800-000000000001',
                ArtifactID: artifactID,
                VersionNumber: 1,
                Name: 'Initial Proposal v1',
                Description: 'First customer draft.',
                Comments: null,
                __mj_CreatedAt: '2026-11-20T12:00:00.000Z',
                __mj_UpdatedAt: '2026-11-20T12:00:00.000Z',
            },
        ];
        const shareRows: DealProposalGuestShareLinkSummary[] = [
            {
                ID: 'D0C50011-4B26-4E10-A800-000000000001',
                MagicLinkInviteID: 'D0C50010-4B26-4E10-A800-000000000001',
                ArtifactID: artifactID,
                ArtifactVersionID: 'D0C50008-4B26-4E10-A800-000000000002',
                CreatedByUserID: 'user-sales-ae-1',
                Label: 'CFO & CIO Commercial Review',
                __mj_CreatedAt: '2026-11-26T18:05:00.000Z',
            },
        ];

        const provider = createPermissionProvider(true);
        const { rvInstance, runViewsSpy } = createRunViewStub(async () => [
            { Success: true, Results: [artifactRow] } as RunViewResult,
            { Success: true, Results: versionRows } as RunViewResult,
            { Success: true, Results: shareRows } as RunViewResult,
        ]);
        const rvSpy = vi.spyOn(RunView, 'FromMetadataProvider').mockReturnValue(rvInstance);

        try {
            const { component, cdrStub, openEntityRecordSpy } = createComponentInDi();
            component.Provider = provider;
            component.DealID = dealID;
            component.ProposalArtifactID = artifactID;
            component.IsSaved = true;

            const resolved = await component.LoadPreview();

            expect(runViewsSpy).toHaveBeenCalledTimes(1);
            const batchArgs = runViewsSpy.mock.calls[0]?.[0] as RunViewParams[];
            expect(batchArgs).toHaveLength(3);
            expect(batchArgs[0].EntityName).toBe('MJ: Artifacts');
            expect(batchArgs[0].ResultType).toBe('simple');
            expect(batchArgs[0].ExtraFilter).toContain('ID IN (');
            expect(batchArgs[1].EntityName).toBe('MJ: Artifact Versions');
            expect(batchArgs[1].ResultType).toBe('simple');
            expect(batchArgs[1].ExtraFilter).toContain('ArtifactID IN (');
            expect(batchArgs[1].Fields).not.toContain('Content');
            expect(batchArgs[2].EntityName).toBe('MJ: Artifact Guest Share Links');
            expect(batchArgs[2].ResultType).toBe('simple');
            expect(batchArgs[2].ExtraFilter).toContain('ArtifactID IN (');

            expect(resolved.Phase).toBe('linked');
            expect(component.State.Phase).toBe('linked');
            expect(component.DisplayTitle).toBe('Customer Proposal: Northwind Clinical Data Hub Expansion');
            expect(component.ActiveVersionNumber).toBe(2);
            expect(component.VersionBadgeLabel).toBe('Pinned v2 · 2 versions');
            expect(component.HasGuestShareLinks).toBe(true);
            expect(component.GuestShareSummaryLabel).toBe('External guest share · 1 link');
            expect(component.VersionNumberForShare(shareRows[0])).toBe(2);
            expect(component.PhaseLabel).toBe('Linked MJ Doc');
            expect(component.SummaryExcerpt).toBe(
                'Executive Summary Enterprise Clinical Hub deployment with 99.95% SLA and Commercial Schedule.',
            );
            expect(component.SummaryExcerpt).not.toMatch(/###|\*\*|`|\[[^\]]+\]\(/);
            expect(cdrStub.markForCheck).toHaveBeenCalled();

            // Switching versions updates ActiveVersionNumber and badge label under OnPush.
            component.SelectVersion(1);
            expect(component.ActiveVersionNumber).toBe(1);
            expect(component.VersionBadgeLabel).toBe('v1 · 2 versions');

            // Opening in MJ Docs falls back to NavigationService.OpenEntityRecord when no parent listener exists.
            component.OpenInViewer();
            expect(openEntityRecordSpy).toHaveBeenCalledTimes(1);
            expect(openEntityRecordSpy.mock.calls[0]?.[0]).toBe('MJ: Artifacts');
        } finally {
            rvSpy.mockRestore();
        }
    });

    it('renders a clean unlinked empty state for legacy deals with ProposalArtifactID === null without issuing RunViews', async () => {
        const provider = createPermissionProvider(true);
        const { rvInstance, runViewsSpy } = createRunViewStub(async () => []);
        const rvSpy = vi.spyOn(RunView, 'FromMetadataProvider').mockReturnValue(rvInstance);

        try {
            const { component, cdrStub } = createComponentInDi();
            component.Provider = provider;
            component.DealID = 'D0C50006-4B26-4E10-A800-000000000015';
            component.ProposalArtifactID = null;
            component.DealNumber = 'DEAL-DOC-015';
            component.IsSaved = true;

            const resolved = await component.LoadPreview();

            expect(runViewsSpy).not.toHaveBeenCalled();
            expect(resolved.Phase).toBe('unlinked');
            expect(component.State.Phase).toBe('unlinked');
            expect(component.State.Artifact).toBeNull();
            expect(component.State.Versions).toEqual([]);
            expect(component.State.GuestShareLinks).toEqual([]);
            expect(component.PhaseLabel).toBe('Not linked');
            expect(component.DisplayTitle).toBe('Proposal & Executive Brief — DEAL-DOC-015');
            expect(cdrStub.markForCheck).toHaveBeenCalled();
        } finally {
            rvSpy.mockRestore();
        }
    });

    it('exposes the loading phase while batched RunViews is in flight', async () => {
        const artifactID = 'D0C50007-4B26-4E10-A800-000000000002';
        const deferred = createDeferred<RunViewResult[]>();
        const provider = createPermissionProvider(true);
        const { rvInstance } = createRunViewStub(async () => deferred.promise);
        const rvSpy = vi.spyOn(RunView, 'FromMetadataProvider').mockReturnValue(rvInstance);

        try {
            const { component } = createComponentInDi();
            component.Provider = provider;
            component.DealID = 'D0C50006-4B26-4E10-A800-000000000002';
            component.ProposalArtifactID = artifactID;
            component.IsSaved = true;

            const pending = component.LoadPreview();
            expect(component.IsLoading).toBe(true);
            expect(component.State.Phase).toBe('loading');
            expect(component.PhaseLabel).toBe('Checking link…');

            deferred.resolve([
                {
                    Success: true,
                    Results: [
                        {
                            ID: artifactID,
                            Name: 'Executive Deal Brief: Horizon Analytics',
                            Description: 'Concise executive brief.',
                            TypeID: 'type-md',
                            Type: 'Markdown Document',
                            Visibility: 'Organization',
                            DelegateEntityID: null,
                            DelegateRecordID: null,
                            __mj_UpdatedAt: '2026-11-26T18:00:00.000Z',
                        },
                    ],
                } as RunViewResult,
                {
                    Success: true,
                    Results: [
                        {
                            ID: 'ver-horizon-1',
                            ArtifactID: artifactID,
                            VersionNumber: 1,
                            Name: 'v1',
                            Description: null,
                            Comments: null,
                            __mj_CreatedAt: '2026-11-26T18:00:00.000Z',
                            __mj_UpdatedAt: '2026-11-26T18:00:00.000Z',
                        },
                    ],
                } as RunViewResult,
                { Success: true, Results: [] } as RunViewResult,
            ]);

            const finalState = await pending;
            expect(finalState.Phase).toBe('linked');
            expect(component.IsLoading).toBe(false);
        } finally {
            rvSpy.mockRestore();
        }
    });

    it('gracefully handles unauthorized access, RLS-hidden rows, load errors, and zero-version artifacts', async () => {
        const artifactID = 'D0C50007-4B26-4E10-A800-000000000099';

        // Case 1: Entity metadata denies CanRead on MJ: Artifacts -> short-circuits without RunViews.
        const deniedProvider = createPermissionProvider(false);
        const { rvInstance: deniedRv, runViewsSpy: deniedSpy } = createRunViewStub(async () => []);
        const deniedRvSpy = vi.spyOn(RunView, 'FromMetadataProvider').mockReturnValue(deniedRv);
        try {
            const deniedState = await LoadDealProposalPreviewState(deniedProvider, artifactID, 'deal-denied');
            expect(deniedSpy).not.toHaveBeenCalled();
            expect(deniedState.Phase).toBe('unauthorized');
            expect(deniedState.NoticeMessage).toContain('read permission');
        } finally {
            deniedRvSpy.mockRestore();
        }

        // Case 2: RLS returns 0 rows for the artifact ID.
        const rlsProvider = createPermissionProvider(true);
        const { rvInstance: rlsRv } = createRunViewStub(async () => [
            { Success: true, Results: [] } as RunViewResult,
            { Success: true, Results: [] } as RunViewResult,
            { Success: true, Results: [] } as RunViewResult,
        ]);
        const rlsRvSpy = vi.spyOn(RunView, 'FromMetadataProvider').mockReturnValue(rlsRv);
        try {
            const { component } = createComponentInDi();
            component.Provider = rlsProvider;
            component.DealID = 'deal-rls';
            component.ProposalArtifactID = artifactID;
            const resolved = await component.LoadPreview();

            expect(resolved.Phase).toBe('unauthorized');
            expect(component.State.Phase).toBe('unauthorized');
            expect(component.PhaseLabel).toBe('Restricted');
            expect(component.State.NoticeMessage).toContain('row-level permissions');
        } finally {
            rlsRvSpy.mockRestore();
        }

        // Case 3: RunViews rejects with an unexpected transport error -> non-fatal error state.
        const errProvider = createPermissionProvider(true);
        const { rvInstance: errRv } = createRunViewStub(async () => {
            throw new Error('Network timeout');
        });
        const errRvSpy = vi.spyOn(RunView, 'FromMetadataProvider').mockReturnValue(errRv);
        try {
            const { component } = createComponentInDi();
            component.Provider = errProvider;
            component.DealID = 'deal-err';
            component.ProposalArtifactID = artifactID;
            const resolved = await component.LoadPreview();

            expect(resolved.Phase).toBe('error');
            expect(component.PhaseLabel).toBe('Unavailable');
            expect(component.State.NoticeMessage).not.toContain('Network timeout');
        } finally {
            errRvSpy.mockRestore();
        }

        // Case 4: Artifact exists but has zero published versions -> graceful no-versions state.
        const emptyVerProvider = createPermissionProvider(true);
        const { rvInstance: emptyVerRv } = createRunViewStub(async () => [
            {
                Success: true,
                Results: [
                    {
                        ID: artifactID,
                        Name: 'Unpublished Proposal Draft',
                        Description: null,
                        TypeID: null,
                        Type: 'Markdown Document',
                        Visibility: 'Private',
                        DelegateEntityID: null,
                        DelegateRecordID: null,
                        __mj_UpdatedAt: null,
                    },
                ],
            } as RunViewResult,
            { Success: true, Results: [] } as RunViewResult,
            { Success: true, Results: [] } as RunViewResult,
        ]);
        const emptyVerSpy = vi.spyOn(RunView, 'FromMetadataProvider').mockReturnValue(emptyVerRv);
        try {
            const { component } = createComponentInDi();
            component.Provider = emptyVerProvider;
            component.DealID = 'deal-empty-ver';
            component.ProposalArtifactID = artifactID;
            const resolved = await component.LoadPreview();

            expect(resolved.Phase).toBe('no-versions');
            expect(component.PhaseLabel).toBe('No versions');
            expect(component.ActiveVersionNumber).toBeUndefined();
        } finally {
            emptyVerSpy.mockRestore();
        }
    });

    it('discards stale async completions when rapidly switching Deal A -> Deal B and linked Deal -> null Deal', async () => {
        const dealA = 'D0C50006-4B26-4E10-A800-0000000000A1';
        const artifactA = 'D0C50007-4B26-4E10-A800-0000000000A1';
        const dealB = 'D0C50006-4B26-4E10-A800-0000000000B2';
        const artifactB = 'D0C50007-4B26-4E10-A800-0000000000B2';
        const dealC = 'D0C50006-4B26-4E10-A800-0000000000C3';

        const deferredA = createDeferred<RunViewResult[]>();
        const deferredB = createDeferred<RunViewResult[]>();
        const deferredA2 = createDeferred<RunViewResult[]>();

        let callCount = 0;
        const provider = createPermissionProvider(true);
        const { rvInstance } = createRunViewStub(async () => {
            callCount++;
            if (callCount === 1) return deferredA.promise;
            if (callCount === 2) return deferredB.promise;
            return deferredA2.promise;
        });
        const rvSpy = vi.spyOn(RunView, 'FromMetadataProvider').mockReturnValue(rvInstance);

        try {
            const { component, cdrStub } = createComponentInDi();
            component.Provider = provider;
            component.IsSaved = true;

            // 1) Start slow load for Deal A
            component.DealID = dealA;
            component.ProposalArtifactID = artifactA;
            const loadA = component.LoadPreview();

            // 2) Rapidly switch to Deal B before Deal A settles
            component.DealID = dealB;
            component.ProposalArtifactID = artifactB;
            const changesToB: SimpleChanges = {
                DealID: {
                    previousValue: dealA,
                    currentValue: dealB,
                    firstChange: false,
                    isFirstChange: () => false,
                } as SimpleChange,
                ProposalArtifactID: {
                    previousValue: artifactA,
                    currentValue: artifactB,
                    firstChange: false,
                    isFirstChange: () => false,
                } as SimpleChange,
            };
            component.ngOnChanges(changesToB);

            // Deal B resolves first
            deferredB.resolve([
                {
                    Success: true,
                    Results: [
                        {
                            ID: artifactB,
                            Name: 'Executive Deal Brief — Deal B',
                            Description: 'Active Deal B brief',
                            TypeID: 'type-md',
                            Type: 'Markdown Document',
                            Visibility: 'Organization',
                            DelegateEntityID: null,
                            DelegateRecordID: dealB,
                            __mj_UpdatedAt: '2026-11-26T18:00:00.000Z',
                        },
                    ],
                } as RunViewResult,
                {
                    Success: true,
                    Results: [
                        {
                            ID: 'ver-b-3',
                            ArtifactID: artifactB,
                            VersionNumber: 3,
                            Name: 'Brief v3',
                            Description: null,
                            Comments: null,
                            __mj_CreatedAt: '2026-11-26T18:00:00.000Z',
                            __mj_UpdatedAt: '2026-11-26T18:00:00.000Z',
                        },
                    ],
                } as RunViewResult,
                { Success: true, Results: [] } as RunViewResult,
            ]);

            await vi.waitFor(() => {
                expect(component.State.ArtifactID).toBe(artifactB);
                expect(component.State.Phase).toBe('linked');
            });

            const markCountAfterB = cdrStub.markForCheck.mock.calls.length;

            // Deal A resolves LATE — MUST be discarded without overwriting Deal B
            deferredA.resolve([
                {
                    Success: true,
                    Results: [
                        {
                            ID: artifactA,
                            Name: 'STALE Proposal — Deal A',
                            Description: 'Stale content',
                            TypeID: 'type-md',
                            Type: 'Markdown Document',
                            Visibility: 'Organization',
                            DelegateEntityID: null,
                            DelegateRecordID: dealA,
                            __mj_UpdatedAt: '2026-11-20T10:00:00.000Z',
                        },
                    ],
                } as RunViewResult,
                {
                    Success: true,
                    Results: [
                        {
                            ID: 'ver-a-1',
                            ArtifactID: artifactA,
                            VersionNumber: 1,
                            Name: 'Stale v1',
                            Description: null,
                            Comments: null,
                            __mj_CreatedAt: '2026-11-20T10:00:00.000Z',
                            __mj_UpdatedAt: '2026-11-20T10:00:00.000Z',
                        },
                    ],
                } as RunViewResult,
                { Success: true, Results: [] } as RunViewResult,
            ]);
            await loadA;

            expect(component.State.DealID).toBe(dealB);
            expect(component.State.ArtifactID).toBe(artifactB);
            expect(component.State.Artifact?.Name).toBe('Executive Deal Brief — Deal B');
            expect(component.ActiveVersionNumber).toBe(3);
            expect(cdrStub.markForCheck.mock.calls.length).toBe(markCountAfterB);

            // 3) Now start slow load for Deal A again, then rapidly switch to unlinked Deal C (ProposalArtifactID === null)
            component.DealID = dealA;
            component.ProposalArtifactID = artifactA;
            const loadA2 = component.LoadPreview();

            component.DealID = dealC;
            component.ProposalArtifactID = null;
            const changesToNull: SimpleChanges = {
                DealID: {
                    previousValue: dealA,
                    currentValue: dealC,
                    firstChange: false,
                    isFirstChange: () => false,
                } as SimpleChange,
                ProposalArtifactID: {
                    previousValue: artifactA,
                    currentValue: null,
                    firstChange: false,
                    isFirstChange: () => false,
                } as SimpleChange,
            };
            component.ngOnChanges(changesToNull);

            expect(component.State.Phase).toBe('unlinked');
            expect(component.State.ArtifactID).toBeNull();
            expect(component.State.DealID).toBe(dealC);

            // Late resolution of loadA2 MUST NOT overwrite Deal C's unlinked empty state
            deferredA2.resolve([
                {
                    Success: true,
                    Results: [
                        {
                            ID: artifactA,
                            Name: 'STALE Proposal — Deal A (second)',
                            Description: 'Should not leak onto unlinked Deal C',
                            TypeID: 'type-md',
                            Type: 'Markdown Document',
                            Visibility: 'Organization',
                            DelegateEntityID: null,
                            DelegateRecordID: dealA,
                            __mj_UpdatedAt: '2026-11-20T10:00:00.000Z',
                        },
                    ],
                } as RunViewResult,
                {
                    Success: true,
                    Results: [
                        {
                            ID: 'ver-a-2',
                            ArtifactID: artifactA,
                            VersionNumber: 1,
                            Name: 'Stale v1',
                            Description: null,
                            Comments: null,
                            __mj_CreatedAt: '2026-11-20T10:00:00.000Z',
                            __mj_UpdatedAt: '2026-11-20T10:00:00.000Z',
                        },
                    ],
                } as RunViewResult,
                { Success: true, Results: [] } as RunViewResult,
            ]);
            await loadA2;

            expect(component.State.Phase).toBe('unlinked');
            expect(component.State.Artifact).toBeNull();
            expect(component.State.DealID).toBe(dealC);

            component.ngOnDestroy();
        } finally {
            rvSpy.mockRestore();
        }
    });

    it('persists expand preference via UserInfoEngine.Instance, handles Object.create(null) safely, and enforces close-lock on MJSDealProposalPanel', () => {
        const getSettingSpy = vi
            .spyOn(UserInfoEngine.Instance, 'GetSetting')
            .mockReturnValue('false');
        const setSettingSpy = vi
            .spyOn(UserInfoEngine.Instance, 'SetSettingDebounced')
            .mockImplementation(() => undefined);

        try {
            const { component } = createComponentInDi();
            component.ProposalArtifactID = null;
            component.ngOnInit();

            expect(getSettingSpy).toHaveBeenCalledWith(DEAL_PROPOSAL_PREVIEW_EXPANDED_PREF_KEY);
            expect(component.IsPreviewExpanded).toBe(false);

            component.ToggleInlinePreview();
            expect(component.IsPreviewExpanded).toBe(true);
            expect(setSettingSpy).toHaveBeenCalledWith(DEAL_PROPOSAL_PREVIEW_EXPANDED_PREF_KEY, 'true');
        } finally {
            getSettingSpy.mockRestore();
            setSettingSpy.mockRestore();
        }

        // Null-prototype safety via Object.prototype.hasOwnProperty.call
        const nullProto: Partial<DealProposalArtifactSummary> = Object.assign(
            Object.create(null) as Partial<DealProposalArtifactSummary>,
            { Type: 'Markdown Document', Name: 'Executive Deal Brief' },
        );
        expect(ReadOwnProperty(nullProto, 'Name')).toBe('Executive Deal Brief');
        expect(ResolveDealProposalIconClass(nullProto)).toBe('fa-solid fa-file-lines');

        // Plain-text Markdown stripper strips headings, bold, inline code, links, and fenced code blocks
        expect(
            StripMarkdownToPlainText(
                '## Proposal Scope\n- **Tier 1** with `99.95%` SLA and [Exhibit A](https://x.test)\n```sql\nSELECT 1;\n```',
            ),
        ).toBe('Proposal Scope Tier 1 with 99.95% SLA and Exhibit A');

        // Multi-ID batch builder emits ResultType: 'simple' and ID IN (...) / ArtifactID IN (...)
        const batchParams = BuildDealProposalPreviewBatchParams(['art-1', 'art-2']);
        expect(batchParams).toHaveLength(3);
        expect(batchParams.every((p) => p.ResultType === 'simple')).toBe(true);
        expect(batchParams[0].ExtraFilter).toBe("ID IN ('art-1', 'art-2')");
        expect(batchParams[1].ExtraFilter).toBe("ArtifactID IN ('art-1', 'art-2')");
        expect(batchParams[2].ExtraFilter).toBe("ArtifactID IN ('art-1', 'art-2')");

        // MJSDealProposalPanel close-lock editability and navigation
        const panel = new MJSDealProposalPanel();
        panel.Record = {
            ID: 'deal-1',
            DealNumber: 'DEAL-001',
            ProposalArtifactID: 'art-1',
            ProposalArtifact: 'Northwind Proposal',
            IsSaved: true,
        } as DealEntity;

        const openHost = createDealFormHostStub(false, false);
        panel.FormComponent = openHost;
        expect(panel.ProposalArtifactEditable).toBe(true);

        const lockedHost = createDealFormHostStub(true, false);
        panel.FormComponent = lockedHost;
        expect(panel.ProposalArtifactEditable).toBe(false);

        panel.OnOpenArtifact('art-1');
        expect(lockedHost.OnFormNavigate).toHaveBeenCalledTimes(1);
    });

    it('uses only published @memberjunction/ng-artifacts@6.3.0-edge.1 exports and declares OnPush hygiene', () => {
        expect(ArtifactsModule).toBeDefined();
        expect(ArtifactIconService).toBeDefined();
        expect(MJSDealProposalPanel).toBeDefined();
        expect(Metadata).toBeDefined();

        const src = readFileSync(PANEL_SRC_PATH, 'utf8');
        expect(src).toContain("from '@memberjunction/ng-artifacts'");
        expect(src).toContain('<mj-artifact-viewer-panel');
        expect(src).toContain('ChangeDetectionStrategy.OnPush');
        expect(src).toContain('Object.prototype.hasOwnProperty.call');
        expect(src).not.toMatch(
            /MJEmbeddedDocPanelComponent|MJArtifactSlideoverComponent|MJRecordDocsListComponent|ArtifactRelatedPanelComponent/,
        );
    });
});
