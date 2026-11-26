---
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-ng": patch
"@mj-biz-apps/sales-core-entities-server": patch
"@mj-biz-apps/sales-server": patch
---

Add `SalesEngineBase` (`@RegisterForStartup()`, `BaseEngine` / `BaseSingleton`) in `@mj-biz-apps/sales-entities` to cache all 13 bounded non-RLS sales reference and taxonomy tables (`Pipelines`, `Pipeline Stages`, `Pipeline Companies`, `Deal Status Types`, `Deal Types`, `Forecast Category Types`, `Loss Reasons`, `Deal Roles`, `Account Types`, `Buying Role Types`, `Lead Source Types`, `Lifecycle Stage Types`, `Deal Digest Audience Types`) with active `ProviderToUse` override, `CanRead` gating, user-switch eviction, `InvalidateCache()`, and O(1) lookup helpers. Wire `SalesEngineBase` across forms, panels, workspace lookups, entity servers, remote operations, and digest runs, and collapse multi-query `RunView` waterfalls into single `RunViews` batches in `MJSDealHeroPanel`, `MJSDealLineCardsComponent`, `ActivityWriterService`, `LogActivityAction`, `SendDealScheduleToOrder`, and `LoadLapsedDeals`. Document the Canonical 5-Rule BizApps Performance & Caching Standard in `CLAUDE.md` and `AGENTS.md`.
