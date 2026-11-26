/**
 * @fileoverview Optional Deal Proposal & Executive Brief MJ Doc (`MJ: Artifacts`) preview panel.
 *
 * Implements the MJ Docs (`MJ: Artifacts`) vs. `MJ: Comments` vs. Quick Notes decision rubric
 * (`.mj/specs/mj-docs-deal-proposal-integration.md`):
 *   - Customer Proposals, Executive Deal Briefs, and Mutual Action Plans live in `MJ: Artifacts` +
 *     `MJ: Artifact Versions` (+ optional external `MJ: Artifact Guest Share Links`), linked via
 *     nullable `Deal.ProposalArtifactID`.
 *   - Threaded deal-desk reviews use `MJ: Comments`.
 *   - `DealStageEvent` provenance, `Common.Activity` logs, and `Deal.LossNotes` / `Description` /
 *     `NextStep` remain lightweight relational rows.
 *
 * Compatible with published `@memberjunction/ng-artifacts@6.3.0-edge.1` (`ArtifactsModule`,
 * `<mj-artifact-viewer-panel>`, `ArtifactIconService`). Never caches transactional `MJ: Artifacts`
 * rows in `SalesEngineBase` or module-level global caches.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    Output,
    SimpleChanges,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import {
    CompositeKey,
    Metadata,
    RunView,
    type IMetadataProvider,
    type IRunViewProvider,
    type RunViewParams,
    type UserInfo,
} from '@memberjunction/core';
import { UserInfoEngine } from '@memberjunction/core-entities';
import { EscapeSQLString, RegisterClassEx } from '@memberjunction/global';
import { ArtifactIconService, ArtifactsModule } from '@memberjunction/ng-artifacts';
import { BaseFormComponent, BaseFormPanel, BaseFormsModule } from '@memberjunction/ng-base-forms';
import { NavigationService } from '@memberjunction/ng-shared';
import { MJButtonDirective, MJRefreshButtonComponent } from '@memberjunction/ng-ui-components';
import { DealEntity, IsDealFieldEditableWhileLocked } from '@mj-biz-apps/sales-entities';
import type { DealFormLockState } from '../custom/deal-form.component';
import { MJS_ENTITIES, MJS_FOREIGN_ENTITIES } from '../data/entity-names';

/** Maximum character length for plain-text summary excerpts in the proposal card header. */
const SUMMARY_EXCERPT_MAX_CHARS = 240;

/** Maximum version metadata rows fetched per Deal proposal preview (newest first). */
const MAX_PREVIEW_VERSIONS = 25;

/** Maximum external guest share links fetched per Deal proposal preview. */
const MAX_PREVIEW_GUEST_SHARES = 25;

/** User preference key stored via `UserInfoEngine.Instance` (never `localStorage`). */
export const DEAL_PROPOSAL_PREVIEW_EXPANDED_PREF_KEY = 'mjs.deal.proposalPreview.expanded';

/** Lightweight `MJ: Artifacts` projection loaded via `ResultType: 'simple'` (no heavy blobs). */
export interface DealProposalArtifactSummary {
    ID: string;
    Name: string;
    Description: string | null;
    TypeID: string | null;
    Type: string | null;
    Visibility: string | null;
    DelegateEntityID: string | null;
    DelegateRecordID: string | null;
    __mj_UpdatedAt: string | Date | null;
}

/** Lightweight `MJ: Artifact Versions` projection loaded via `ResultType: 'simple'` (skips `Content`). */
export interface DealProposalArtifactVersionSummary {
    ID: string;
    ArtifactID: string;
    VersionNumber: number;
    Name: string | null;
    Description: string | null;
    Comments: string | null;
    __mj_CreatedAt: string | Date | null;
    __mj_UpdatedAt: string | Date | null;
}

/** Lightweight `MJ: Artifact Guest Share Links` projection loaded via `ResultType: 'simple'`. */
export interface DealProposalGuestShareLinkSummary {
    ID: string;
    MagicLinkInviteID: string;
    ArtifactID: string;
    ArtifactVersionID: string;
    CreatedByUserID: string | null;
    Label: string | null;
    __mj_CreatedAt: string | Date | null;
}

/** Deterministic UX phase discriminator for the optional Deal Proposal MJ Doc preview. */
export type DealProposalPreviewPhase =
    | 'unlinked'
    | 'loading'
    | 'linked'
    | 'no-versions'
    | 'unauthorized'
    | 'error';

/** Resolved view-model for a single `(Deal.ID, Deal.ProposalArtifactID)` lookup. */
export interface DealProposalPreviewState {
    Phase: DealProposalPreviewPhase;
    DealID: string | null;
    ArtifactID: string | null;
    Artifact: DealProposalArtifactSummary | null;
    Versions: ReadonlyArray<DealProposalArtifactVersionSummary>;
    LatestVersion: DealProposalArtifactVersionSummary | null;
    PinnedVersion: DealProposalArtifactVersionSummary | null;
    GuestShareLinks: ReadonlyArray<DealProposalGuestShareLinkSummary>;
    NoticeMessage: string | null;
}

/**
 * Null-prototype-safe own-property reader using `Object.prototype.hasOwnProperty.call(...)`
 * so custom-element and `Object.create(null)` records never throw `hasOwnProperty is not a function`.
 */
export function ReadOwnProperty<T extends object, K extends keyof T>(
    target: T | null | undefined,
    key: K,
): T[K] | undefined {
    if (target === null || target === undefined || typeof target !== 'object') {
        return undefined;
    }
    return Object.prototype.hasOwnProperty.call(target, key) ? target[key] : undefined;
}

/**
 * Strips raw Markdown syntax (`###`, `**bold**`, `` `code` ``, fenced blocks, `[label](url)`)
 * into clean plain text so summary cards never leak raw Markdown syntax into rendered DOM.
 */
export function StripMarkdownToPlainText(
    raw: string | null | undefined,
    maxChars: number = SUMMARY_EXCERPT_MAX_CHARS,
): string {
    if (typeof raw !== 'string') {
        return '';
    }
    const cleaned = raw
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/^\s{0,3}#{1,6}\s+/gm, '')
        .replace(/^\s*[-*+]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '')
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/(\*|_)(.*?)\1/g, '$2')
        .replace(/~~(.*?)~~/g, '$1')
        .replace(/^>\s?/gm, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (cleaned.length <= maxChars) {
        return cleaned;
    }
    return `${cleaned.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

/**
 * Resolves a Font Awesome 6 Free icon class for a linked Deal Proposal / Executive Brief artifact,
 * delegating to `ArtifactIconService.NormalizeMetadataIcon` when available.
 */
export function ResolveDealProposalIconClass(
    summary: Partial<DealProposalArtifactSummary> | null | undefined,
    iconService?: ArtifactIconService | null,
): string {
    const typeName = (ReadOwnProperty(summary, 'Type') ?? '').toLowerCase();
    const docName = (ReadOwnProperty(summary, 'Name') ?? '').toLowerCase();

    let rawIcon = 'fa-solid fa-file-signature';
    if (typeName.includes('slide') || typeName.includes('deck') || typeName.includes('presentation')) {
        rawIcon = 'fa-solid fa-display';
    } else if (docName.includes('brief') || docName.includes('executive') || typeName.includes('report')) {
        rawIcon = 'fa-solid fa-file-lines';
    } else if (docName.includes('mutual action') || docName.includes('plan')) {
        rawIcon = 'fa-solid fa-list-check';
    } else if (typeName.includes('code') || typeName.includes('json')) {
        rawIcon = 'fa-solid fa-file-code';
    }

    if (iconService && typeof iconService.NormalizeMetadataIcon === 'function') {
        return iconService.NormalizeMetadataIcon(rawIcon);
    }
    return rawIcon;
}

/** Normalized unlinked/empty state factory for legacy or early-stage deals (`ProposalArtifactID === null`). */
export function BuildUnlinkedDealProposalState(dealId: string | null = null): DealProposalPreviewState {
    return {
        Phase: 'unlinked',
        DealID: dealId,
        ArtifactID: null,
        Artifact: null,
        Versions: [],
        LatestVersion: null,
        PinnedVersion: null,
        GuestShareLinks: [],
        NoticeMessage: null,
    };
}

/** Type guard checking whether a metadata provider also implements `IRunViewProvider`. */
function isRunViewProvider(provider: IMetadataProvider | null | undefined): provider is IMetadataProvider & IRunViewProvider {
    if (!provider || typeof provider !== 'object') {
        return false;
    }
    const candidate = provider as Partial<IRunViewProvider>;
    return typeof candidate.RunView === 'function' && typeof candidate.RunViews === 'function';
}

/** Builds a provider-scoped `RunView` instance without casting through `any` or `unknown`. */
function createScopedRunView(provider: IMetadataProvider | null | undefined): RunView {
    if (isRunViewProvider(provider)) {
        return RunView.FromMetadataProvider(provider);
    }
    return new RunView();
}

/** Type guard narrowing `BaseFormComponent` to `DealFormLockState` without lazy casts. */
function hasDealFormLockState(form: BaseFormComponent | null | undefined): form is BaseFormComponent & DealFormLockState {
    if (!form || typeof form !== 'object') {
        return false;
    }
    return (
        'IsLocked' in form &&
        'IsLost' in form &&
        typeof (form as Partial<DealFormLockState>).IsLocked === 'boolean' &&
        typeof (form as Partial<DealFormLockState>).IsLost === 'boolean'
    );
}

/** Builds the 3 batched `RunViews` queries (`ResultType: 'simple'`, `ID IN (...)` / `ArtifactID IN (...)`). */
export function BuildDealProposalPreviewBatchParams(artifactIds: ReadonlyArray<string>): RunViewParams[] {
    const cleanedIds = artifactIds
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
    const inClause = cleanedIds.map((id) => `'${EscapeSQLString(id)}'`).join(', ');

    return [
        {
            EntityName: MJS_FOREIGN_ENTITIES.Artifact,
            Fields: [
                'ID',
                'Name',
                'Description',
                'TypeID',
                'Type',
                'Visibility',
                'DelegateEntityID',
                'DelegateRecordID',
                '__mj_UpdatedAt',
            ],
            ExtraFilter: `ID IN (${inClause})`,
            MaxRows: cleanedIds.length,
            ResultType: 'simple',
        },
        {
            EntityName: MJS_FOREIGN_ENTITIES.ArtifactVersion,
            Fields: [
                'ID',
                'ArtifactID',
                'VersionNumber',
                'Name',
                'Description',
                'Comments',
                '__mj_CreatedAt',
                '__mj_UpdatedAt',
            ],
            ExtraFilter: `ArtifactID IN (${inClause})`,
            OrderBy: 'VersionNumber DESC',
            MaxRows: MAX_PREVIEW_VERSIONS * cleanedIds.length,
            ResultType: 'simple',
        },
        {
            EntityName: MJS_FOREIGN_ENTITIES.ArtifactGuestShareLink,
            Fields: [
                'ID',
                'MagicLinkInviteID',
                'ArtifactID',
                'ArtifactVersionID',
                'CreatedByUserID',
                'Label',
                '__mj_CreatedAt',
            ],
            ExtraFilter: `ArtifactID IN (${inClause})`,
            MaxRows: MAX_PREVIEW_GUEST_SHARES * cleanedIds.length,
            ResultType: 'simple',
        },
    ];
}

/**
 * Provider-scoped, single-request batched loader for `MJ: Artifacts`, `MJ: Artifact Versions`,
 * and `MJ: Artifact Guest Share Links`.
 *
 * Follows the 5-Rule BizApps Performance Standard:
 *   - Single `RunViews([...])` batch with `ResultType: 'simple'`, `ID IN (...)` / `ArtifactID IN (...)`,
 *     and narrow `Fields` (never downloads `ArtifactVersion.Content` on the metadata pass;
 *     `<mj-artifact-viewer-panel>` loads version content lazily when rendered).
 *   - Respects caller RLS and entity `CanRead` permissions; never caches transactional artifacts in
 *     `SalesEngineBase`.
 */
export async function LoadDealProposalPreviewState(
    provider: IMetadataProvider | null | undefined,
    proposalArtifactId: string | null | undefined,
    dealId: string | null = null,
): Promise<DealProposalPreviewState> {
    const normalizedId = typeof proposalArtifactId === 'string' ? proposalArtifactId.trim() : '';
    if (!normalizedId) {
        return BuildUnlinkedDealProposalState(dealId);
    }

    const effectiveProvider = provider ?? Metadata.Provider;
    const currentUser = effectiveProvider?.CurrentUser;
    if (effectiveProvider && currentUser) {
        const artifactEntity = effectiveProvider.EntityByName(MJS_FOREIGN_ENTITIES.Artifact);
        if (artifactEntity && artifactEntity.GetUserPermisions(currentUser).CanRead !== true) {
            return {
                Phase: 'unauthorized',
                DealID: dealId,
                ArtifactID: normalizedId,
                Artifact: null,
                Versions: [],
                LatestVersion: null,
                PinnedVersion: null,
                GuestShareLinks: [],
                NoticeMessage:
                    'This deal links to an MJ Doc proposal or brief, but your role does not have read permission on MJ: Artifacts.',
            };
        }
    }

    const rv = createScopedRunView(effectiveProvider);
    const batchParams = BuildDealProposalPreviewBatchParams([normalizedId]);

    try {
        const [artifactResult, versionsResult, guestShareResult] = await rv.RunViews(batchParams);

        if (!artifactResult?.Success) {
            const errText = (artifactResult?.ErrorMessage ?? '').toLowerCase();
            const isAuthDenied =
                errText.includes('permission') ||
                errText.includes('unauthorized') ||
                errText.includes('denied') ||
                errText.includes('forbidden');
            return {
                Phase: isAuthDenied ? 'unauthorized' : 'error',
                DealID: dealId,
                ArtifactID: normalizedId,
                Artifact: null,
                Versions: [],
                LatestVersion: null,
                PinnedVersion: null,
                GuestShareLinks: [],
                NoticeMessage: isAuthDenied
                    ? 'You do not have permission to view the linked Proposal or Executive Brief under current access rules.'
                    : 'The linked Proposal or Executive Brief could not be loaded right now. Standard deal fields, stage history, and activities remain available.',
            };
        }

        const artifactRows = (artifactResult.Results ?? []) as DealProposalArtifactSummary[];
        const artifact = artifactRows[0] ?? null;
        if (!artifact) {
            return {
                Phase: 'unauthorized',
                DealID: dealId,
                ArtifactID: normalizedId,
                Artifact: null,
                Versions: [],
                LatestVersion: null,
                PinnedVersion: null,
                GuestShareLinks: [],
                NoticeMessage:
                    'A Proposal or Executive Brief is linked to this deal, but it is restricted under your current row-level permissions or is no longer available.',
            };
        }

        const guestShareLinks: DealProposalGuestShareLinkSummary[] = guestShareResult?.Success
            ? ((guestShareResult.Results ?? []) as DealProposalGuestShareLinkSummary[])
            : [];

        if (!versionsResult?.Success) {
            return {
                Phase: 'no-versions',
                DealID: dealId,
                ArtifactID: normalizedId,
                Artifact: artifact,
                Versions: [],
                LatestVersion: null,
                PinnedVersion: null,
                GuestShareLinks: guestShareLinks,
                NoticeMessage:
                    'Proposal versions could not be loaded under your current permissions. Standard deal details and stage history remain available.',
            };
        }

        const versions = ((versionsResult.Results ?? []) as DealProposalArtifactVersionSummary[])
            .slice()
            .sort((a, b) => (b.VersionNumber ?? 0) - (a.VersionNumber ?? 0));

        if (versions.length === 0) {
            return {
                Phase: 'no-versions',
                DealID: dealId,
                ArtifactID: normalizedId,
                Artifact: artifact,
                Versions: [],
                LatestVersion: null,
                PinnedVersion: null,
                GuestShareLinks: guestShareLinks,
                NoticeMessage:
                    'This linked Proposal or Executive Brief currently has no published versions. Publish a version in MJ Docs to preview it inline.',
            };
        }

        const latestVersion = versions[0] ?? null;
        const pinnedVersionId = guestShareLinks[0]?.ArtifactVersionID ?? null;
        const pinnedVersion =
            pinnedVersionId !== null
                ? (versions.find((v) => v.ID.toLowerCase() === pinnedVersionId.toLowerCase()) ?? latestVersion)
                : latestVersion;

        return {
            Phase: 'linked',
            DealID: dealId,
            ArtifactID: normalizedId,
            Artifact: artifact,
            Versions: versions,
            LatestVersion: latestVersion,
            PinnedVersion: pinnedVersion,
            GuestShareLinks: guestShareLinks,
            NoticeMessage: null,
        };
    } catch {
        return {
            Phase: 'error',
            DealID: dealId,
            ArtifactID: normalizedId,
            Artifact: null,
            Versions: [],
            LatestVersion: null,
            PinnedVersion: null,
            GuestShareLinks: [],
            NoticeMessage:
                'The linked Proposal or Executive Brief is temporarily unavailable. Standard deal fields, stage history, and activities remain available.',
        };
    }
}

/**
 * Reusable, `OnPush`, semantic-token-only MJ Doc preview component for `Deal.ProposalArtifactID`.
 *
 * Handles all required lifecycle UX states cleanly:
 *   1. Linked `ProposalArtifactID` with accessible `ArtifactVersion` row(s) -> embedded
 *      `@memberjunction/ng-artifacts` `<mj-artifact-viewer-panel>` preview with pinned version badge
 *      and external `ArtifactGuestShareLink` metadata indicator.
 *   2. `ProposalArtifactID === null` (legacy / early-stage deal) -> clean unlinked empty state.
 *   3. Loading state -> clean non-blocking spinner while batched `RunViews` executes.
 *   4. Unauthorized / load-error / zero-versions -> non-fatal graceful fallback with zero raw Markdown
 *      or stack traces leaked to the DOM.
 *   5. Rapid Deal switching -> monotonic `loadSequence` + active `(DealID, ProposalArtifactID)` key
 *      guard discarding stale async completions under `ChangeDetectionStrategy.OnPush`.
 */
@Component({
    selector: 'mjs-deal-proposal-preview',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [
        CommonModule,
        ArtifactsModule,
        MJButtonDirective,
        MJRefreshButtonComponent,
    ],
    template: `
        <section
            class="mjs-proposal-preview"
            [attr.data-proposal-phase]="State.Phase"
            data-testid="deal-proposal-preview"
            aria-label="Deal Proposal and Executive Brief Preview">
            <header class="mjs-proposal-preview__header">
                <div class="mjs-proposal-preview__identity">
                    <span class="mjs-proposal-preview__icon" aria-hidden="true">
                        <i [class]="DocumentIconClass"></i>
                    </span>
                    <div class="mjs-proposal-preview__heading">
                        <div class="mjs-proposal-preview__kicker">MJ Docs · Proposal &amp; Executive Brief</div>
                        <h4 class="mjs-proposal-preview__title">{{ DisplayTitle }}</h4>
                    </div>
                </div>
                <div class="mjs-proposal-preview__actions">
                    <span class="mjs-proposal-chip" [ngClass]="PhaseChipClass">
                        {{ PhaseLabel }}
                    </span>
                    @if (IsSaved && State.ArtifactID) {
                        <mj-refresh-button
                            Variant="flat"
                            Size="sm"
                            [ShowLabel]="false"
                            Title="Reload linked Proposal or Executive Brief metadata"
                            [Loading]="IsLoading"
                            (Clicked)="Refresh()" />
                    }
                </div>
            </header>

            @if (!IsSaved) {
                <div class="mjs-proposal-preview__empty" role="status" data-testid="deal-proposal-empty">
                    <i class="fa-solid fa-file-circle-plus" aria-hidden="true"></i>
                    <div>
                        <strong>Save this deal to link a Proposal or Executive Brief</strong>
                        <p>
                            Once saved, link a Customer Proposal, Executive Deal Brief, or Mutual Action Plan
                            stored in MJ Docs. Stage history, deal notes, and activity logs stay active immediately.
                        </p>
                    </div>
                </div>
            } @else if (State.Phase === 'loading') {
                <div class="mjs-proposal-preview__loading" role="status" data-testid="deal-proposal-loading">
                    <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
                    <span>Loading linked Proposal and version metadata…</span>
                </div>
            } @else if (State.Phase === 'unlinked') {
                <div class="mjs-proposal-preview__empty" role="status" data-testid="deal-proposal-empty">
                    <i class="fa-solid fa-file-lines" aria-hidden="true"></i>
                    <div>
                        <strong>No Proposal or Executive Brief linked</strong>
                        <p>
                            Link an optional Customer Proposal, Executive Deal Brief, or Mutual Action Plan
                            stored in MJ Docs to preview pinned versions and external guest share status inline.
                            Deal fields, stage events, and activity logs remain fully active.
                        </p>
                    </div>
                </div>
            } @else if (State.Phase === 'unauthorized' || State.Phase === 'error') {
                <div
                    class="mjs-proposal-preview__fallback"
                    role="alert"
                    [attr.data-fallback-kind]="State.Phase"
                    data-testid="deal-proposal-error">
                    <span class="mjs-proposal-preview__fallback-icon" aria-hidden="true">
                        <i [class]="State.Phase === 'unauthorized' ? 'fa-solid fa-lock' : 'fa-solid fa-triangle-exclamation'"></i>
                    </span>
                    <div class="mjs-proposal-preview__fallback-body">
                        <strong>
                            {{ State.Phase === 'unauthorized' ? 'Linked Proposal is restricted' : 'Could not load linked Proposal' }}
                        </strong>
                        <p>{{ State.NoticeMessage }}</p>
                    </div>
                </div>
            } @else if (State.Phase === 'no-versions') {
                <div
                    class="mjs-proposal-preview__fallback"
                    role="status"
                    data-fallback-kind="no-versions"
                    data-testid="deal-proposal-no-versions">
                    <span class="mjs-proposal-preview__fallback-icon" aria-hidden="true">
                        <i class="fa-solid fa-file-circle-question"></i>
                    </span>
                    <div class="mjs-proposal-preview__fallback-body">
                        <strong>No published proposal versions yet</strong>
                        <p>{{ State.NoticeMessage }}</p>
                    </div>
                </div>
            } @else if (State.Phase === 'linked' && State.Artifact && State.LatestVersion) {
                <div class="mjs-proposal-preview__summary" data-testid="deal-proposal-linked">
                    <div class="mjs-proposal-preview__meta-row">
                        @if (State.Artifact.Type) {
                            <span class="mjs-proposal-chip mjs-proposal-chip--info">{{ State.Artifact.Type }}</span>
                        }
                        <span class="mjs-proposal-chip mjs-proposal-chip--ok" data-testid="deal-proposal-version-badge">
                            <i class="fa-solid fa-thumbtack" aria-hidden="true"></i>
                            {{ VersionBadgeLabel }}
                        </span>
                        @if (HasGuestShareLinks) {
                            <span class="mjs-proposal-chip mjs-proposal-chip--share" data-testid="deal-proposal-guest-share-badge">
                                <i class="fa-solid fa-share-nodes" aria-hidden="true"></i>
                                {{ GuestShareSummaryLabel }}
                            </span>
                        }
                        @if (State.Artifact.Visibility) {
                            <span class="mjs-proposal-chip mjs-proposal-chip--muted">{{ State.Artifact.Visibility }}</span>
                        }
                        @if (LatestUpdatedAt) {
                            <span class="mjs-proposal-preview__timestamp">
                                Updated {{ LatestUpdatedAt | date: 'mediumDate' }}
                            </span>
                        }
                    </div>

                    @if (SummaryExcerpt) {
                        <p class="mjs-proposal-preview__excerpt" data-testid="deal-proposal-excerpt">{{ SummaryExcerpt }}</p>
                    }

                    @if (HasGuestShareLinks) {
                        <div class="mjs-proposal-preview__shares" aria-label="External guest share links">
                            @for (share of State.GuestShareLinks; track share.ID) {
                                <span class="mjs-proposal-share-pill">
                                    <i class="fa-solid fa-link" aria-hidden="true"></i>
                                    {{ share.Label || 'External guest share' }}
                                    @if (VersionNumberForShare(share); as shareVer) {
                                        <span class="mjs-proposal-share-pill__ver">v{{ shareVer }}</span>
                                    }
                                </span>
                            }
                        </div>
                    }

                    @if (State.Versions.length > 1) {
                        <div class="mjs-proposal-preview__versions" role="group" aria-label="Proposal versions">
                            @for (ver of State.Versions; track ver.ID) {
                                <button
                                    type="button"
                                    class="mjs-proposal-pill"
                                    [class.mjs-proposal-pill--active]="ver.VersionNumber === ActiveVersionNumber"
                                    (click)="SelectVersion(ver.VersionNumber)">
                                    v{{ ver.VersionNumber }}
                                </button>
                            }
                        </div>
                    }

                    <div class="mjs-proposal-preview__controls">
                        <button
                            type="button"
                            mjButton
                            variant="outline"
                            size="sm"
                            (click)="ToggleInlinePreview()">
                            <i [class]="IsPreviewExpanded ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'" aria-hidden="true"></i>
                            {{ IsPreviewExpanded ? 'Hide Inline Preview' : 'Show Inline Preview' }}
                        </button>
                        <button
                            type="button"
                            mjButton
                            variant="flat"
                            size="sm"
                            (click)="OpenInViewer()">
                            <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
                            Open in MJ Docs
                        </button>
                    </div>
                </div>

                @if (IsPreviewExpanded && State.ArtifactID) {
                    <div class="mjs-proposal-preview__viewer" aria-label="Embedded MJ Docs Proposal Viewer">
                        <mj-artifact-viewer-panel
                            [artifactId]="State.ArtifactID"
                            [VersionNumber]="ActiveVersionNumber"
                            [CurrentUser]="ResolvedCurrentUser"
                            [ShowHeader]="false"
                            [ShowTabs]="true"
                            [ShowSaveToCollection]="false"
                            [ShowCloseButton]="false"
                            [ShowMaximizeButton]="false"
                            [CanEdit]="false">
                        </mj-artifact-viewer-panel>
                    </div>
                }
            }
        </section>
    `,
    styles: [`
        .mjs-proposal-preview {
            display: flex;
            flex-direction: column;
            gap: var(--mj-space-3);
            padding: var(--mj-space-4);
            background: var(--mj-bg-surface-card);
            border: 1px solid var(--mj-border-default);
            border-radius: var(--mj-radius-md);
            color: var(--mj-text-primary);
        }
        .mjs-proposal-preview__header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: var(--mj-space-3);
        }
        .mjs-proposal-preview__identity {
            display: flex;
            align-items: center;
            gap: var(--mj-space-3);
            min-width: 0;
        }
        .mjs-proposal-preview__icon {
            flex: none;
            width: 36px;
            height: 36px;
            border-radius: var(--mj-radius-sm);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: var(--mj-status-info-bg);
            color: var(--mj-brand-primary);
            font-size: var(--mj-text-base);
        }
        .mjs-proposal-preview__heading {
            min-width: 0;
        }
        .mjs-proposal-preview__kicker {
            font-size: var(--mj-text-xs);
            font-weight: var(--mj-font-bold);
            letter-spacing: var(--mj-tracking-wide);
            text-transform: uppercase;
            color: var(--mj-text-muted);
        }
        .mjs-proposal-preview__title {
            margin: var(--mj-space-0-5) 0 0;
            font-size: var(--mj-text-base);
            font-weight: var(--mj-font-bold);
            color: var(--mj-text-primary);
            overflow-wrap: anywhere;
        }
        .mjs-proposal-preview__actions {
            display: flex;
            align-items: center;
            gap: var(--mj-space-2);
        }
        .mjs-proposal-chip {
            display: inline-flex;
            align-items: center;
            gap: var(--mj-space-1-5);
            padding: var(--mj-space-0-5) var(--mj-space-2-5);
            border-radius: var(--mj-radius-full);
            font-size: var(--mj-text-xs);
            font-weight: var(--mj-font-semibold);
            border: 1px solid var(--mj-border-default);
            background: var(--mj-bg-surface-sunken);
            color: var(--mj-text-secondary);
        }
        .mjs-proposal-chip--ok {
            background: var(--mj-status-success-bg);
            color: var(--mj-status-success-text);
            border-color: var(--mj-status-success-border);
        }
        .mjs-proposal-chip--info {
            background: var(--mj-status-info-bg);
            color: var(--mj-status-info-text);
            border-color: var(--mj-status-info-border);
        }
        .mjs-proposal-chip--share {
            background: var(--mj-brand-accent-subtle);
            color: var(--mj-brand-accent);
            border-color: var(--mj-border-strong);
        }
        .mjs-proposal-chip--warn {
            background: var(--mj-status-warning-bg);
            color: var(--mj-status-warning-text);
            border-color: var(--mj-status-warning-border);
        }
        .mjs-proposal-chip--error {
            background: var(--mj-status-error-bg);
            color: var(--mj-status-error-text);
            border-color: var(--mj-status-error-border);
        }
        .mjs-proposal-chip--muted {
            background: var(--mj-bg-surface-sunken);
            color: var(--mj-text-muted);
            border-color: var(--mj-border-subtle);
        }
        .mjs-proposal-preview__loading {
            display: flex;
            align-items: center;
            gap: var(--mj-space-2);
            padding: var(--mj-space-3);
            color: var(--mj-text-muted);
            font-size: var(--mj-text-sm);
        }
        .mjs-proposal-preview__empty,
        .mjs-proposal-preview__fallback {
            display: flex;
            align-items: flex-start;
            gap: var(--mj-space-3);
            padding: var(--mj-space-4);
            border-radius: var(--mj-radius-md);
            background: var(--mj-bg-surface-sunken);
            border: 1px dashed var(--mj-border-strong);
            color: var(--mj-text-secondary);
            font-size: var(--mj-text-sm);
        }
        .mjs-proposal-preview__fallback {
            border-style: solid;
            border-color: var(--mj-status-warning-border);
            background: var(--mj-status-warning-bg);
            color: var(--mj-status-warning-text);
        }
        .mjs-proposal-preview__fallback[data-fallback-kind='error'] {
            border-color: var(--mj-status-error-border);
            background: var(--mj-status-error-bg);
            color: var(--mj-status-error-text);
        }
        .mjs-proposal-preview__fallback-icon {
            flex: none;
            font-size: var(--mj-text-base);
            margin-top: var(--mj-space-0-5);
        }
        .mjs-proposal-preview__empty p,
        .mjs-proposal-preview__fallback-body p {
            margin: var(--mj-space-1) 0 0;
            line-height: var(--mj-leading-relaxed);
        }
        .mjs-proposal-preview__summary {
            display: flex;
            flex-direction: column;
            gap: var(--mj-space-3);
        }
        .mjs-proposal-preview__meta-row {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: var(--mj-space-2);
        }
        .mjs-proposal-preview__timestamp {
            font-size: var(--mj-text-xs);
            color: var(--mj-text-muted);
        }
        .mjs-proposal-preview__excerpt {
            margin: 0;
            font-size: var(--mj-text-sm);
            color: var(--mj-text-secondary);
            line-height: var(--mj-leading-relaxed);
        }
        .mjs-proposal-preview__shares {
            display: flex;
            flex-wrap: wrap;
            gap: var(--mj-space-2);
        }
        .mjs-proposal-share-pill {
            display: inline-flex;
            align-items: center;
            gap: var(--mj-space-1-5);
            padding: var(--mj-space-1) var(--mj-space-2-5);
            border-radius: var(--mj-radius-sm);
            background: var(--mj-bg-surface-sunken);
            border: 1px solid var(--mj-border-default);
            color: var(--mj-text-secondary);
            font-size: var(--mj-text-xs);
            font-weight: var(--mj-font-medium);
        }
        .mjs-proposal-share-pill__ver {
            padding: 0 var(--mj-space-1-5);
            border-radius: var(--mj-radius-sm);
            background: var(--mj-status-info-bg);
            color: var(--mj-status-info-text);
            font-weight: var(--mj-font-semibold);
        }
        .mjs-proposal-preview__versions {
            display: flex;
            flex-wrap: wrap;
            gap: var(--mj-space-2);
        }
        .mjs-proposal-pill {
            cursor: pointer;
            padding: var(--mj-space-1) var(--mj-space-2-5);
            border-radius: var(--mj-radius-full);
            border: 1px solid var(--mj-border-default);
            background: var(--mj-bg-surface);
            color: var(--mj-text-secondary);
            font: inherit;
            font-size: var(--mj-text-xs);
            font-weight: var(--mj-font-semibold);
        }
        .mjs-proposal-pill:hover {
            background: var(--mj-bg-surface-hover);
            color: var(--mj-text-primary);
        }
        .mjs-proposal-pill--active {
            background: var(--mj-brand-primary);
            border-color: var(--mj-brand-primary);
            color: var(--mj-brand-on-primary);
        }
        .mjs-proposal-preview__controls {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: var(--mj-space-2);
        }
        .mjs-proposal-preview__viewer {
            min-height: 360px;
            border: 1px solid var(--mj-border-default);
            border-radius: var(--mj-radius-md);
            background: var(--mj-bg-surface);
            overflow: hidden;
        }
    `],
})
export class DealProposalPreviewComponent implements OnInit, OnChanges, OnDestroy {
    private readonly cdr = inject(ChangeDetectorRef);
    private readonly iconService = inject(ArtifactIconService, { optional: true });
    private readonly navigationService = inject(NavigationService, { optional: true });

    /** Active Deal ID used alongside `ProposalArtifactID` to guard rapid Deal switching. */
    @Input() public DealID: string | null = null;

    /** Nullable `Deal.ProposalArtifactID` pointing to `[__mj].[Artifact]([ID])`. */
    @Input() public ProposalArtifactID: string | null = null;

    /** Optional joined `Deal.ProposalArtifact` display title fallback. */
    @Input() public ProposalArtifactName: string | null = null;

    /** Optional deal number shown in fallback title copy. */
    @Input() public DealNumber: string | null = null;

    /** Whether the hosting deal record has been persisted. */
    @Input() public IsSaved = true;

    /** Provider scoped to the host form (falls back to `Metadata.Provider`). */
    @Input() public Provider: IMetadataProvider | null = null;

    /** Optional explicit user context forwarded to `<mj-artifact-viewer-panel>`. */
    @Input() public CurrentUser: UserInfo | null = null;

    /** Emitted when the user clicks "Open in MJ Docs". */
    @Output() public OpenArtifactRequested = new EventEmitter<string>();

    public State: DealProposalPreviewState = BuildUnlinkedDealProposalState();
    public IsPreviewExpanded = true;
    public SelectedVersionNumber: number | undefined = undefined;

    /** Monotonically increasing sequence token guarding rapid Deal switches under `OnPush`. */
    private loadSequence = 0;
    private isDestroyed = false;

    public ngOnInit(): void {
        this.IsPreviewExpanded = this.restoreExpandedPreference();
        if (this.loadSequence === 0) {
            void this.LoadPreview();
        } else {
            this.cdr.markForCheck();
        }
    }

    public ngOnChanges(changes: SimpleChanges): void {
        if (
            Object.prototype.hasOwnProperty.call(changes, 'DealID') ||
            Object.prototype.hasOwnProperty.call(changes, 'ProposalArtifactID') ||
            Object.prototype.hasOwnProperty.call(changes, 'Provider') ||
            Object.prototype.hasOwnProperty.call(changes, 'IsSaved')
        ) {
            this.SelectedVersionNumber = undefined;
            void this.LoadPreview();
        }
    }

    public ngOnDestroy(): void {
        this.isDestroyed = true;
        this.loadSequence++;
    }

    public get IsLoading(): boolean {
        return this.State.Phase === 'loading';
    }

    public get HasGuestShareLinks(): boolean {
        return this.State.GuestShareLinks.length > 0;
    }

    public get DisplayTitle(): string {
        const artifactName = ReadOwnProperty(this.State.Artifact, 'Name');
        if (artifactName) {
            return artifactName;
        }
        if (this.ProposalArtifactName) {
            return this.ProposalArtifactName;
        }
        if (this.DealNumber) {
            return `Proposal & Executive Brief — ${this.DealNumber}`;
        }
        return 'Proposal & Executive Brief';
    }

    public get DocumentIconClass(): string {
        return ResolveDealProposalIconClass(this.State.Artifact, this.iconService);
    }

    public get SummaryExcerpt(): string {
        const desc = ReadOwnProperty(this.State.Artifact, 'Description');
        return StripMarkdownToPlainText(desc);
    }

    public get ActiveVersionNumber(): number | undefined {
        return (
            this.SelectedVersionNumber ??
            this.State.PinnedVersion?.VersionNumber ??
            this.State.LatestVersion?.VersionNumber
        );
    }

    public get VersionBadgeLabel(): string {
        const active = this.ActiveVersionNumber;
        if (active === undefined) {
            return 'No version';
        }
        const pinnedNum = this.State.PinnedVersion?.VersionNumber;
        const prefix = pinnedNum !== undefined && pinnedNum === active ? `Pinned v${active}` : `v${active}`;
        return this.State.Versions.length > 1
            ? `${prefix} · ${this.State.Versions.length} versions`
            : prefix;
    }

    public get GuestShareSummaryLabel(): string {
        const count = this.State.GuestShareLinks.length;
        return count === 1 ? 'External guest share · 1 link' : `External guest share · ${count} links`;
    }

    public get LatestUpdatedAt(): string | Date | null {
        return (
            ReadOwnProperty(this.State.LatestVersion, '__mj_UpdatedAt') ??
            ReadOwnProperty(this.State.Artifact, '__mj_UpdatedAt') ??
            null
        );
    }

    public get ResolvedCurrentUser(): UserInfo {
        return (this.CurrentUser ?? this.Provider?.CurrentUser ?? Metadata.Provider.CurrentUser) as UserInfo;
    }

    public get PhaseLabel(): string {
        switch (this.State.Phase) {
            case 'loading':
                return 'Checking link…';
            case 'linked':
                return 'Linked MJ Doc';
            case 'no-versions':
                return 'No versions';
            case 'unauthorized':
                return 'Restricted';
            case 'error':
                return 'Unavailable';
            case 'unlinked':
            default:
                return 'Not linked';
        }
    }

    public get PhaseChipClass(): string {
        switch (this.State.Phase) {
            case 'linked':
                return 'mjs-proposal-chip--ok';
            case 'no-versions':
            case 'unauthorized':
                return 'mjs-proposal-chip--warn';
            case 'error':
                return 'mjs-proposal-chip--error';
            case 'loading':
                return 'mjs-proposal-chip--info';
            case 'unlinked':
            default:
                return 'mjs-proposal-chip--muted';
        }
    }

    public VersionNumberForShare(share: DealProposalGuestShareLinkSummary): number | null {
        const targetId = share.ArtifactVersionID.toLowerCase();
        const found = this.State.Versions.find((v) => v.ID.toLowerCase() === targetId);
        return found ? found.VersionNumber : null;
    }

    public async Refresh(): Promise<void> {
        await this.LoadPreview();
    }

    public SelectVersion(versionNumber: number): void {
        this.SelectedVersionNumber = versionNumber;
        this.cdr.markForCheck();
    }

    public ToggleInlinePreview(): void {
        this.IsPreviewExpanded = !this.IsPreviewExpanded;
        this.persistExpandedPreference(this.IsPreviewExpanded);
        this.cdr.markForCheck();
    }

    public OpenInViewer(): void {
        const artifactId = this.State.ArtifactID;
        if (!artifactId) {
            return;
        }
        if (this.OpenArtifactRequested.observed) {
            this.OpenArtifactRequested.emit(artifactId);
            return;
        }
        this.navigationService?.OpenEntityRecord(
            MJS_FOREIGN_ENTITIES.Artifact,
            CompositeKey.FromID(artifactId),
        );
    }

    /** Computes the composite identity key of the currently bound Deal + ProposalArtifactID. */
    private currentRequestKey(): string {
        const dealPart = typeof this.DealID === 'string' ? this.DealID.trim().toLowerCase() : '';
        const artifactPart =
            typeof this.ProposalArtifactID === 'string' ? this.ProposalArtifactID.trim().toLowerCase() : '';
        return `${dealPart}::${artifactPart}`;
    }

    /**
     * Loads the linked `MJ: Artifacts`, `MJ: Artifact Versions`, and `MJ: Artifact Guest Share Links`
     * metadata for the active `(DealID, ProposalArtifactID)`. A monotonic sequence token paired with
     * the active `(DealID, ProposalArtifactID)` key guarantees stale async completions from a
     * previously selected Deal are discarded cleanly under `ChangeDetectionStrategy.OnPush`.
     */
    public async LoadPreview(): Promise<DealProposalPreviewState> {
        const token = ++this.loadSequence;
        const normalizedDealId = typeof this.DealID === 'string' && this.DealID.trim() ? this.DealID.trim() : null;
        const normalizedArtifactId =
            typeof this.ProposalArtifactID === 'string' ? this.ProposalArtifactID.trim() : '';
        const expectedKey = this.currentRequestKey();

        if (!this.IsSaved || !normalizedArtifactId) {
            const unlinked = BuildUnlinkedDealProposalState(normalizedDealId);
            this.State = unlinked;
            this.SelectedVersionNumber = undefined;
            this.cdr.markForCheck();
            return unlinked;
        }

        this.State = {
            Phase: 'loading',
            DealID: normalizedDealId,
            ArtifactID: normalizedArtifactId,
            Artifact: null,
            Versions: [],
            LatestVersion: null,
            PinnedVersion: null,
            GuestShareLinks: [],
            NoticeMessage: null,
        };
        this.cdr.markForCheck();

        const resolved = await LoadDealProposalPreviewState(
            this.Provider,
            normalizedArtifactId,
            normalizedDealId,
        );

        // Discard stale async completions if the user switched Deals or the component was destroyed.
        if (this.isDestroyed || token !== this.loadSequence || expectedKey !== this.currentRequestKey()) {
            return this.State;
        }

        this.State = resolved;
        if (resolved.PinnedVersion) {
            this.SelectedVersionNumber = resolved.PinnedVersion.VersionNumber;
        } else if (resolved.LatestVersion) {
            this.SelectedVersionNumber = resolved.LatestVersion.VersionNumber;
        } else {
            this.SelectedVersionNumber = undefined;
        }
        this.cdr.markForCheck();
        return resolved;
    }

    private restoreExpandedPreference(): boolean {
        try {
            const saved = UserInfoEngine.Instance.GetSetting(DEAL_PROPOSAL_PREVIEW_EXPANDED_PREF_KEY);
            if (saved === 'false') {
                return false;
            }
            if (saved === 'true') {
                return true;
            }
        } catch {
            /* UserInfoEngine unavailable in isolated tests — default to expanded */
        }
        return true;
    }

    private persistExpandedPreference(expanded: boolean): void {
        try {
            UserInfoEngine.Instance.SetSettingDebounced(
                DEAL_PROPOSAL_PREVIEW_EXPANDED_PREF_KEY,
                expanded ? 'true' : 'false',
            );
        } catch {
            /* UserInfoEngine unavailable — preference simply does not persist */
        }
    }
}

/**
 * Contributed `BaseFormPanel` mounting `<mjs-deal-proposal-preview>` onto `DealFormComponentExtended`
 * (`MJ_BizApps_Sales: Deals`) without replacing `@RegisterClass(BaseFormComponent, ...)`.
 */
@RegisterClassEx(BaseFormPanel, {
    key: 'sales:deal-proposal',
    skipNullKeyWarning: true,
    metadata: {
        entity: MJS_ENTITIES.Deal,
        slot: 'after-related',
        sortKey: 65,
        contributionKey: 'proposal',
        inclusion: 'Primary',
    },
})
@Component({
    selector: 'mjs-deal-proposal-panel',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    imports: [CommonModule, BaseFormsModule, DealProposalPreviewComponent],
    template: `
        <mj-collapsible-panel
            SectionKey="proposal"
            SectionName="Proposal &amp; brief"
            Icon="fa-solid fa-file-signature"
            [Form]="FormComponent"
            [FormContext]="FormContext">
            <div class="mjs-proposal-panel-body">
                @if (EditMode && Record) {
                    <div class="mjs-proposal-panel-field" data-field="ProposalArtifactID">
                        <mj-form-field
                            [Record]="Record"
                            [ShowLabel]="true"
                            FieldName="ProposalArtifactID"
                            Type="textbox"
                            LinkType="Record"
                            [EditMode]="EditMode && ProposalArtifactEditable"
                            [FormContext]="FormContext">
                        </mj-form-field>
                    </div>
                }
                <mjs-deal-proposal-preview
                    [DealID]="DealID"
                    [ProposalArtifactID]="ProposalArtifactID"
                    [ProposalArtifactName]="ProposalArtifactName"
                    [DealNumber]="DealNumber"
                    [IsSaved]="IsDealSaved"
                    [Provider]="ProviderToUse"
                    [CurrentUser]="CurrentUser"
                    (OpenArtifactRequested)="OnOpenArtifact($event)" />
            </div>
        </mj-collapsible-panel>
    `,
    styles: [`
        .mjs-proposal-panel-body {
            display: flex;
            flex-direction: column;
            gap: var(--mj-space-3);
            padding: var(--mj-space-4);
        }
        .mjs-proposal-panel-field {
            max-width: 480px;
        }
    `],
})
export class MJSDealProposalPanel extends BaseFormPanel<DealEntity> {
    public get DealID(): string | null {
        return this.Record?.ID ?? null;
    }

    public get ProposalArtifactID(): string | null {
        return this.Record?.ProposalArtifactID ?? null;
    }

    public get ProposalArtifactName(): string | null {
        return this.Record?.ProposalArtifact ?? null;
    }

    public get DealNumber(): string | null {
        return this.Record?.DealNumber ?? null;
    }

    public get IsDealSaved(): boolean {
        return Boolean(this.Record?.IsSaved);
    }

    public get ProposalArtifactEditable(): boolean {
        if (!hasDealFormLockState(this.FormComponent)) {
            return true;
        }
        return !this.FormComponent.IsLocked || IsDealFieldEditableWhileLocked('ProposalArtifactID', this.FormComponent.IsLost);
    }

    public get ProviderToUse(): IMetadataProvider {
        return this.FormComponent?.ProviderToUse ?? Metadata.Provider;
    }

    public get CurrentUser(): UserInfo | null {
        return this.ProviderToUse?.CurrentUser ?? null;
    }

    public OnOpenArtifact(artifactId: string): void {
        if (!artifactId) {
            return;
        }
        this.FormComponent?.OnFormNavigate({
            Kind: 'record',
            EntityName: MJS_FOREIGN_ENTITIES.Artifact,
            PrimaryKey: CompositeKey.FromID(artifactId),
        });
    }
}
