# `@mj-biz-apps/sales-ng`

Angular client bootstrap, Explorer section resources, generated forms, and contributed `BaseFormPanel` surfaces for the **BizApps Sales** Open App (`__mj_BizAppsSales`).

## Bootstrap & OpenApp v3 Registrations

`mj-app.json` anchors the client bundle to `LoadBizAppsSalesClient()` (`src/public-api.ts`):

- **Entity & Engine Bootstrap**: Anchors `LoadSalesDealEntities()` and `LoadSalesEngineBase()` from `@mj-biz-apps/sales-entities` so shared entity validation and the 13-table `SalesEngineBase` reference cache are never tree-shaken.
- **Dual Form Registration Parity**:
  - Every Sales entity retains an active `@RegisterClass(BaseFormComponent, '<EntityName>')` form class (21 generated forms + priority-2 overrides `DealFormComponentExtended` for `MJ_BizApps_Sales: Deals` and `DealStageEventFormComponentExtended` for `MJ_BizApps_Sales: Deal Stage Events`).
  - Hand-authored panels mount inside host forms via `@RegisterClassEx(BaseFormPanel, ...)` and never replace `BaseFormComponent`.
- **Navigation & Resource Parity**:
  - `SalesDealsSectionResource` (`@RegisterClass(BaseResourceComponent, 'SalesDealsSectionResource')`) matches `DefaultNavItems` in [`metadata/applications/.bizapps-sales-application.json`](../../metadata/applications/.bizapps-sales-application.json), wraps its shell (`MJSSalesSectionComponent`) in `<mj-page-layout>`, uses `ChangeDetectionStrategy.OnPush`, and calls `this.NotifyLoadComplete()`.

## Deal Proposal & Executive Brief MJ Doc Preview

`packages/Angular/src/lib/form-panels/deal-proposal-preview.panel.ts` integrates **MJ Docs (`MJ: Artifacts`)** into the Deal form against published `@memberjunction/ng-artifacts@6.3.0-edge.1` (declared as `peerDependencies: "^6.3.0-edge.1"` and `devDependencies: "6.3.0-edge.1"`):

| Export | Responsibility |
|---|---|
| `MJSDealProposalPanel` | Contributed `BaseFormPanel` (`@RegisterClassEx(BaseFormPanel, { key: 'sales:deal-proposal', metadata: { entity: 'MJ_BizApps_Sales: Deals', slot: 'after-related', sortKey: 65, contributionKey: 'proposal', inclusion: 'Primary' } })`) mounting the `Proposal & brief` rail section on `DealFormComponentExtended`. Honors the Deal close lock (`IsDealFieldEditableWhileLocked('ProposalArtifactID', ...)`) in edit mode. |
| `DealProposalPreviewComponent` | Standalone `OnPush` preview component (`<mjs-deal-proposal-preview>`) rendering linked Customer Proposals, Executive Deal Briefs, and Mutual Action Plans via `<mj-artifact-viewer-panel>` (`@memberjunction/ng-artifacts@6.3.0-edge.1`), pinned version badges, and external `MJ: Artifact Guest Share Links` indicators. |
| `LoadDealProposalPreviewState` | Provider-scoped, single-request `RunViews([...])` (`ResultType: 'simple'`, `ID IN (...)` / `ArtifactID IN (...)`, narrow `Fields` excluding `Content`) loader across `MJ: Artifacts`, `MJ: Artifact Versions`, and `MJ: Artifact Guest Share Links`, gated by `CanRead` on `MJ: Artifacts`. |
| `StripMarkdownToPlainText` & `ReadOwnProperty` | Strips raw Markdown syntax from summary card excerpts (zero raw Markdown leaks in rendered DOM) and reads properties via `Object.prototype.hasOwnProperty.call(...)` for null-prototype / custom-element safety. |

### UX States & Async Race Guard

1. **Linked Proposal / Executive Brief (`Phase === 'linked'`)**: Displays artifact title, type chip, pinned version badge (`Pinned vN`), external guest share link badges (`ArtifactGuestShareLink.Label` + pinned version), plain-text summary excerpt, version switcher pills, inline preview toggle (persisted via `UserInfoEngine.Instance`, never `localStorage`), **Open in MJ Docs** navigation, and embedded `<mj-artifact-viewer-panel>`.
2. **Unlinked / Legacy Deal (`ProposalArtifactID === null` or unsaved deal -> `Phase === 'unlinked'`)**: Renders a clean, domain-neutral empty state without issuing `RunViews` queries, keeping standard Deal fields, stage history, and activities unobstructed.
3. **Loading (`Phase === 'loading'`)**: Non-blocking inline spinner while the batched `RunViews` call resolves.
4. **Unauthorized / Error / No Versions (`Phase === 'unauthorized' | 'error' | 'no-versions'`)**: Graceful non-blocking alert with zero stack traces and zero uncaught exceptions.
5. **Stale-Response Race Guard**: Every `LoadPreview()` call captures a monotonic sequence token (`loadSequence`) and active `(DealID, ProposalArtifactID)` composite key. When a user rapidly switches from Deal A to Deal B or from a linked Deal to an unlinked Deal (`ProposalArtifactID === null`), late completions for Deal A are discarded before touching component state.

### Storage Decision Rubric

See [`.mj/specs/mj-docs-deal-proposal-integration.md`](../../.mj/specs/mj-docs-deal-proposal-integration.md):
- **MJ Docs (`MJ: Artifacts`)**: Customer Proposals, Executive Deal Briefs, and Mutual Action Plans (`Deal.ProposalArtifactID`).
- **`MJ: Comments`**: Threaded deal-desk reviews, `@mentions`, and field suggestions.
- **Quick Notes / Relational Rows**: `DealStageEvent` provenance, `Common.Activity` call/meeting logs, and `Deal.LossNotes` / `Deal.Description` / `Deal.NextStep`.

## UI Hygiene & Performance Standards

- **`ChangeDetectionStrategy.OnPush`** on all new components with explicit `ChangeDetectorRef.markForCheck()`.
- **Semantic `--mj-*` CSS design tokens only**: Zero raw `#hex`, `rgb()`, `rgba()`, `hsl()`, or `hsla()` color literals in Angular component styles; every `--mj-*` variable must exist in [`scripts/mj-tokens.json`](../../scripts/mj-tokens.json) (`pnpm run test:token-gate`).
- **Zero `window.print()`**: Document export delegates to `@memberjunction/ng-artifacts` / server-side actions.
- **Zero `localStorage` / `sessionStorage`**: User preferences persist exclusively via `UserInfoEngine.Instance`.
- **Zero `any`, zero `unknown`, zero `.Get()`/`.Set()`** in new source and test files.
- **5-Rule Caching Standard**: Never cache `Deals` or `MJ: Artifacts` globally; read the 13 bounded reference tables from `SalesEngineBase.Instance`.

## Build & Test Commands

```bash
# Build all workspace packages (including @mj-biz-apps/sales-ng via ngc)
pnpm run build

# Run all Vitest unit and DOM tests (including DealProposalPreview & OpenAppRegistrationAndTokens)
TZ=America/Los_Angeles pnpm run test:unit

# Verify MJ design tokens, vocabulary gate, money gate, build, and tests together
TZ=America/Los_Angeles pnpm run verify

# Verify host-provided packages are bounded peers only
node .github/scripts/check-dependency-model.mjs --self-test && node .github/scripts/check-dependency-model.mjs
```
