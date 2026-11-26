# AGENTS.md — MemberJunction BizApps Sales

This repository (`@mj-biz-apps/sales-*`) is the Sales OpenApp for MemberJunction. Read [`CLAUDE.md`](CLAUDE.md) for the complete architecture, non-negotiable domain rules, migration conventions, and testing guide. This file highlights the critical agent guardrails and the **Canonical 5-Rule Performance & Caching Standard**.

## Critical Guardrails

1. **No `any` types** (and no lazy `unknown` substitutes) in TypeScript; no `.Get()` / `.Set()` where generated entity properties exist.
2. **Domain vocabulary is DATA, never code** (`pnpm run test:vocabulary-gate`): never branch on status/stage/role/loss-reason/forecast-category names or codes; read schema flags (`IsWon`, `IsLost`, `IsClosed`, `IsOpen`, `LocksDeal`, `IsOwnerRole`, `RequiresNotes`, `IncludeInForecast`).
3. **Sales NEVER computes money** (`pnpm run test:money-gate`): `Orders.PreviewOrder` is the single authority for totals, discounts, and schedules.
4. **Never edit generated files** (`packages/*/src/generated/`, `packages/Angular/src/lib/generated/`), **never edit `ci/protect.mjs`**, and **never commit host artifacts** (`mj.config.*`, `GeneratedEntities`).
5. **No cross-package re-exports**: consumers import every type and class directly from its owning package.
6. **Git merge strategy**: feature branches target `next`; never commit directly to `next` or `main`; always merge PRs with standard merge commits (`gh pr merge --merge`), never squash-merge.

## Canonical 5-Rule BizApps Performance & Caching Standard

All code across `packages/Entities`, `packages/Angular`, `packages/CoreEntitiesServer`, and `packages/Server` MUST follow these five rules:

1. **Use `SalesEngineBase` for bounded reference/taxonomy tables.**
   - Read the 13 bounded non-RLS sales reference tables (`Pipelines`, `Pipeline Stages`, `Pipeline Companies`, `Deal Status Types`, `Deal Types`, `Forecast Category Types`, `Loss Reasons`, `Deal Roles`, `Account Types`, `Buying Role Types`, `Lead Source Types`, `Lifecycle Stage Types`, `Deal Digest Audience Types`) from `SalesEngineBase.Instance` (`@mj-biz-apps/sales-entities`) rather than issuing ad-hoc `RunView` queries.
   - Use its O(1) lookup helpers (`PipelineById`, `PipelineStageById`, `StagesForPipeline`, `PipelineCompaniesForPipeline`, `DealStatusTypeById`, `OpenDealStatusTypes`, `WonDealStatusTypes`, `LostDealStatusTypes`, `LockingDealStatusTypes`, `NonClosedDealStatusTypes`, `OwnerDealRole`, `ProspectAccountType`, `LossReasonById`, `DealDigestAudienceTypeById`, etc.).
   - Keep `LoadSalesEngineBase()` anchored in `LoadBizAppsSalesClient()` and `LoadBizAppsSalesServer()` so `@RegisterForStartup()` is never tree-shaken.

2. **Enforce multi-provider & impersonation safety on engines.**
   - Override `ProviderToUse` to return the active provider (`this._activeProvider ?? Metadata.Provider`) rather than latching a stale startup provider.
   - Gate every configured entity on `CanRead` for `contextUser`.
   - Evict cached arrays and indexes and force refresh whenever `contextUser.ID` changes across `Config()` calls.
   - Provide `InvalidateCache()` to clear state and force the next `Config(false)` call to reload.
   - Use `CacheLocal: true` only for shared non-RLS reference tables; RLS-scoped entities MUST use `CacheLocal: false`.

3. **Collapse independent queries into a single `RunViews([...])` batch.**
   - Never issue sequential `RunView` calls or `Promise.all([rv.RunView(...), rv.RunView(...)])` for independent reads sharing a provider and user — batch them in one `RunViews([...])` call with `ResultType: 'simple'` when not mutating records.
   - Never run `RunView` inside loops (N+1 queries); collect IDs and query once or memoize per key within the run.

4. **Bound all caches to containers — never globally cache transactional tables.**
   - Never put `Deals`, `DealLines`, `DealStageEvents`, `DealTeamMembers`, `SalesAccounts`, `SalesContacts`, `Orders`, `Contracts`, or `Activities` into `SalesEngineBase` or unbounded module-level caches.

5. **Use RLS-safe two-step entity reads — never `vw*` subqueries in `ExtraFilter`.**
   - Resolve filter IDs via `SalesEngineBase` or an explicit `RunView`/`RunViews` call under `contextUser`, then pass the resolved IDs to the target entity's `ExtraFilter`. Never write raw `SELECT ... FROM [schema].[vw*]` subqueries in `ExtraFilter`.

## MJ Docs (`MJ: Artifacts`) vs. `MJ: Comments` vs. Quick Notes Rubric

Full living specification: [`.mj/specs/mj-docs-deal-proposal-integration.md`](.mj/specs/mj-docs-deal-proposal-integration.md).

1. **MJ Docs (`MJ: Artifacts`)**: Use for **Customer Proposals**, **Executive Deal Briefs**, and **Mutual Action Plans** — rich, versioned deliverables supporting version pinning (`MJ: Artifact Versions`), external sharing via `ArtifactGuestShareLink`, and delegated permissions (`DelegateEntityID` / `DelegateRecordID`), linked from `[__mj_BizAppsSales].[Deal].[ProposalArtifactID]` (`UNIQUEIDENTIFIER NULL FK -> [__mj].[Artifact]([ID])`).
2. **`MJ: Comments`**: Use for threaded collaborative discussion, deal-desk review commentary, `@mentions`, and field suggestions attached to records.
3. **Quick Notes / Lightweight Relational Rows**: Keep `DealStageEvent` provenance, quick call/activity logs (`Common.Activity`), and close-reason / follow-up notes (`Deal.LossNotes`, `Deal.Description`, `Deal.NextStep`) as lightweight relational columns/rows for fast filtering, close-lock auditing, and reporting.
4. **Strict `PUBLISH_NO_BREAK_POLICY.md` & Dual-DBMS Parity**: All schema changes are strictly additive (nullable or defaulted columns only; never drop/rename/narrow). Pair every 4-part T-SQL migration in `migrations/` with a deterministic PostgreSQL `.pg.sql` in `migrations-pg/` produced via `mj migrate convert --split --bake-codegen` and stamped on line 1 with `-- @mj-pg-provenance: split-bake v1`.
5. **`@memberjunction/ng-artifacts` (`@memberjunction/*@6.3.0-edge.1`) UI Rules**: Add as caret peer `^6.3.0-edge.1` + exact devDep `6.3.0-edge.1` in `packages/Angular/package.json`; require `ChangeDetectionStrategy.OnPush`, request-token/`switchMap` async race guards on rapid Deal switching, semantic `--mj-*` tokens only (zero raw color literals), `UserInfoEngine.Instance` (zero `localStorage`), Dual Form Registration Parity anchored in `LoadBizAppsSalesClient()`, and zero `window.print()`.

## Required Verification Before Opening a PR

Run from the repository root:

```bash
node .github/scripts/check-dependency-model.mjs --self-test && node .github/scripts/check-dependency-model.mjs
TZ=America/Los_Angeles pnpm run verify
npm run test:mutate-harness && npm run test:one-copy-harness && npm run test:cleanup-harness
./.github/scripts/validate-package-repository.sh && ./.github/scripts/validate-package-files.sh
```

Every gate, build, and Vitest test must pass with 0 failures before pushing or merging.
