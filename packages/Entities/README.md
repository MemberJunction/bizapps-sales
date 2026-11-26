# `@mj-biz-apps/sales-entities`

Strongly typed MemberJunction entity subclasses, client-safe remote-operation contracts, domain validation rules, and the bounded reference/taxonomy engine for **BizApps Sales** (`__mj_BizAppsSales`).

## Architecture & Exports

| Export | Responsibility |
|---|---|
| `generated/entity_subclasses.ts` | Deterministic MJ CodeGen entity classes (`mjBizAppsSalesDealEntity`, `mjBizAppsSalesPipelineEntity`, `mjBizAppsSalesSalesAccountEntity`, `mjBizAppsSalesSalesContactEntity`, etc.) and Zod schemas (`mjBizAppsSalesDealSchema`, ...). Never edit by hand. |
| `deal-entity.ts` (`DealEntity`) | Shared client/server `Deal` entity subclass extending `mjBizAppsSalesDealEntity` with `Team` and `PaymentSchedule` Related Record Collections and cross-tier validation. |
| `sales-engine-base.ts` (`SalesEngineBase`) | Bounded reference/taxonomy engine (`BaseSingleton` + `@RegisterForStartup()`) loading the 13 non-RLS sales type/pipeline tables in one batched call with O(1) lookup helpers and multi-provider/impersonation safety. |
| `close-lock.ts` | Single source of truth for deal close-lock field mutability (`DealFieldsEditableWhileLocked`, `IsDealFieldEditableWhileLocked`, `DealFieldLabel`, `DealCloseStampFields`). |
| `discount-conversion.ts` & `discount-concession.ts` | Percent-vs-fraction discount conversion and price-concession helpers (Sales never computes money — `Orders.PreviewOrder` is the sole pricing authority). |
| `amount-freshness.ts`, `product-filter.ts`, `term-start.ts`, `stage-event-append-only.ts` | Shared framework-free rules consumed identically by Angular UI, server entities, and integration tests. |

## `Deal.ProposalArtifactID` — MJ Docs (`MJ: Artifacts`) Contract

Enterprise deals link rich, customer- or leadership-facing deliverables (**Customer Proposals**, **Executive Deal Briefs**, and **Mutual Action Plans**) via a nullable foreign key on `[__mj_BizAppsSales].[Deal]`:

- **Column**: `[ProposalArtifactID] UNIQUEIDENTIFIER NULL` (`FK_Deal_ProposalArtifact` → `[__mj].[Artifact]([ID])`), backed by filtered non-clustered index `[IX_Deal_ProposalArtifactID]` (`WHERE [ProposalArtifactID] IS NOT NULL`).
- **Generated Entity Properties** (`mjBizAppsSalesDealEntity` / `DealEntity`):
  - `ProposalArtifactID: string | null` — nullable UUID of the linked `MJ: Artifacts` document (`null` for early-stage or legacy deals with no linked document).
  - `ProposalArtifact: string | null` — read-only virtual name projected from `[__mj].[Artifact].[Name]` in `vwDealsGenerated` / `vwDeals`.
- **Versioning, Permissions & External Sharing**:
  - Immutable revision snapshots and version pinning live in `[__mj].[ArtifactVersion]` (`MJ: Artifact Versions`).
  - Host-record permission delegation binds via `[__mj].[Artifact].[DelegateEntityID]` (`MJ_BizApps_Sales: Deals`) and `[__mj].[Artifact].[DelegateRecordID]` (`Deal.ID`), enforced at runtime by `DealArtifactPermissionDelegate` (`@mj-biz-apps/sales-core-entities-server`) and `ArtifactPermissionEngine`.
  - External prospect sharing binds pinned versions via `[__mj].[ArtifactGuestShareLink]` (`MagicLinkInviteID`, `ArtifactID`, `ArtifactVersionID`, `CreatedByUserID`, `Label`).
- **Close-Lock Semantics**:
  - `DealFieldLabel('ProposalArtifactID')` derives `'Proposal Artifact'` (matching `metadata/entity-fields/.deal-proposal-artifact.json`).
  - `ProposalArtifactID` is **not** in `DealFieldsEditableWhileLocked(...)`: once a deal enters a status with `DealStatusType.LocksDeal = 1`, changing or unlinking `ProposalArtifactID` is refused until the deal is reopened through `Sales.ReopenDeal`.

### Storage Decision Rubric

Full specification: [`.mj/specs/mj-docs-deal-proposal-integration.md`](../../.mj/specs/mj-docs-deal-proposal-integration.md).

| Storage Primitive | Use For in BizApps Sales |
|---|---|
| **MJ Docs (`MJ: Artifacts`)** | Customer Proposals, Executive Deal Briefs, Mutual Action Plans (versioned, pinnable, externally shareable via `ArtifactGuestShareLink`). |
| **`MJ: Comments`** | Threaded collaborative review, deal-desk Q&A, `@mentions`, and field suggestions attached to records. |
| **Quick Notes / Relational Rows** | `DealStageEvent` transition provenance, `Common.Activity` call/meeting logs, and `Deal.LossNotes` / `Deal.Description` / `Deal.NextStep`. |

## Performance & Caching Guardrails (5-Rule Standard)

1. Read the 13 bounded reference/taxonomy tables from `SalesEngineBase.Instance` rather than ad-hoc `RunView` queries.
2. Preserve `ProviderToUse`, `CanRead` gating, `contextUser.ID` switch eviction, and `InvalidateCache()` on engines.
3. Collapse independent reads into a single `RunViews([...])` call with `ResultType: 'simple'` and explicit `Fields` (zero `RunView` loops).
4. Never cache transactional tables (`Deals`, `DealStageEvents`, `SalesAccounts`, `Artifacts`, etc.) globally.
5. Use RLS-safe two-step reads with explicit `ID IN (...)` filters — never raw `SELECT ... FROM [schema].[vw*]` subqueries inside `ExtraFilter`.

## Strict Type Hygiene

All source and test files in this package compile against `@memberjunction/*@6.3.0-edge.1` with:
- Zero `any` and zero lazy `unknown` casts in hand-written code.
- Zero legacy `BaseEntity.Get()` / `BaseEntity.Set()` calls where generated typed properties exist.
- Domain behavior driven exclusively by schema flags (`IsWon`, `IsLost`, `IsClosed`, `IsOpen`, `LocksDeal`, `IsOwnerRole`, `RequiresNotes`), never vocabulary string comparisons.

## Development & Verification

```bash
# Build all workspace packages
pnpm run build

# Run unit tests (including DealProposalArtifact and StaticHygiene suites)
TZ=America/Los_Angeles pnpm run test:unit

# Run all static gates + build + unit tests
TZ=America/Los_Angeles pnpm run verify
```
