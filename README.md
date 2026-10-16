<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/MemberJunction/MJ/raw/main/MJ_logo_dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/MemberJunction/MJ/raw/main/MJ_logo.webp">
    <img alt="MemberJunction" src="https://github.com/MemberJunction/MJ/raw/main/MJ_logo.webp" width="220">
  </picture>
</p>

<h1 align="center">BizApps Sales</h1>

<p align="center">
  <strong>Deal pipeline management for <a href="https://github.com/MemberJunction/MJ">MemberJunction</a>, at the top of the BizApps revenue stack: sales records what is being sold, and BizApps Orders prices it</strong>
</p>

<p align="center">
  <a href="#status">Status</a> &middot;
  <a href="#install">Install</a> &middot;
  <a href="#entity-model">Entity model</a> &middot;
  <a href="#documentation">Documentation</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@mj-biz-apps/sales-entities"><img alt="npm" src="https://img.shields.io/npm/v/@mj-biz-apps/sales-entities?style=flat-square&label=npm" /></a>
  <img alt="MJ Version" src="https://img.shields.io/badge/MemberJunction-6.1.6%2B-blue?style=flat-square" />
  <img alt="Angular" src="https://img.shields.io/badge/Angular-21-DD0031?style=flat-square&logo=angular&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="SQL Server" src="https://img.shields.io/badge/SQL%20Server-CC2927?style=flat-square&logo=microsoftsqlserver&logoColor=white" />
  <a href="./LICENSE"><img alt="License: BUSL-1.1" src="https://img.shields.io/badge/License-BUSL--1.1-green?style=flat-square" /></a>
</p>

---

BizApps Sales is an MJ Open App for accounts, contacts, pipelines, deals, deal teams and forecasting.
Each deal carries its own order in [BizApps Orders](https://github.com/MemberJunction/bizapps-orders):
sales records the products, quantities and requested discounts, and orders computes every price and
total. Closing a won deal can create its contract in
[BizApps Contracts](https://github.com/MemberJunction/bizapps-contracts) and raise finance tasks in
[BizApps Tasks](https://github.com/MemberJunction/bizapps-tasks), in the same transaction.

## Status

Released as an MJ Open App: five `@mj-biz-apps/sales-*` packages on npm and a `vX.Y.Z` git tag per
release, cut by `.github/workflows/publish.yml` when `next` is merged to `main`
([`docs/PUBLISHING.md`](docs/PUBLISHING.md)).

- **Database:** SQL Server. A PostgreSQL install is not possible yet: no migration has a PostgreSQL
  counterpart ([#197](https://github.com/MemberJunction/bizapps-sales/issues/197)).
- **Not built:** the HubSpot import, and quota and attainment (deferred to v2, `docs/DECISIONS.md` D2).
- **Defects:** [open issues](https://github.com/MemberJunction/bizapps-sales/issues). Risks that cannot
  be fixed from this repo are in [`docs/KNOWN-ISSUES.md`](docs/KNOWN-ISSUES.md).

## What it does

- **Each deal has an order.** Saving a deal provisions an `OrderHeader` in BizApps Orders
  (`Deal.OrderID`). The deal's lines are that order's `OrderLine` rows; orders prices them, and
  `Deal.Amount` caches `OrderHeader.TotalGross` with its provenance.
- **Pipelines and stages, per company.** A stage carries a probability, a forecast category, the
  `DealStatusType` a deal takes on entering it and, optionally, the status the deal's order takes
  (`OrderStatusOnEntry`). Every stage move appends a `DealStageEvent`.
- **Close and reopen** through the `Sales.CloseDeal` and `Sales.ReopenDeal` remote operations, each one
  transaction. A won deal follows its pipeline's `CloseWonPolicy`: a contract when the policy asks for
  one and BizApps Contracts is installed, plus finance tasks in BizApps Tasks. A closed deal is locked
  on the server until it is reopened.
- **Deal team and buying committee** (`DealTeamMember`, `DealContactRole`), and the agreed payment
  schedule (`DealPaymentSchedule`).
- **Dashboard and forecasting.** The dashboard reads the MJ Queries in `metadata/queries/`.
  `ForecastSnapshot` holds point-in-time forecast figures; its daily scheduled job captures each
  pipeline's forecast by owner from the `Sales: Forecast by Owner` query.
- **In MJExplorer**, the Sales application opens on a Deals section with Dashboard, All deals and Board
  views, beside the generated forms for every entity.

Three rules govern the code, and `CLAUDE.md` states them in full: sales never computes money; domain
vocabulary (statuses, stages, roles, categories) is data in type tables, never a string compared in
code; and provenance is immutable. CI enforces the first two with the money and vocabulary gates.

## Dependencies

Sales runs inside an MJ host at 6.1.6 or a later 6.x release and depends on five other BizApps apps.
The version ranges are in [`mj-app.json`](mj-app.json) (`mjVersionRange` and `dependencies`).

| App | What sales uses it for |
|---|---|
| [BizApps Common](https://github.com/MemberJunction/bizapps-common) | `Person` and `Organization`, the IsA parents of `SalesContact` and `SalesAccount`; the activity timeline |
| [BizApps Tasks](https://github.com/MemberJunction/bizapps-tasks) | The finance tasks a won deal raises |
| [BizApps Accounting](https://github.com/MemberJunction/bizapps-accounting) | `Deal.CurrencyID` |
| [BizApps Orders](https://github.com/MemberJunction/bizapps-orders) | Each deal's order, its lines and every price. A deal cannot be saved without it |
| [BizApps Contracts](https://github.com/MemberJunction/bizapps-contracts) | The contract a won deal creates when its pipeline's policy asks for one |

## Install

### Into an MJ host

```bash
mj app install https://github.com/MemberJunction/bizapps-sales                      # latest release
mj app install https://github.com/MemberJunction/bizapps-sales --version <x.y.z>    # a specific release
```

Run it with the host's MJ CLI, on a host whose MJ version satisfies `mjVersionRange`. The installer
resolves the apps under `dependencies` in `mj-app.json` and installs the ones the host lacks first,
creates the `__mj_BizAppsSales` schema, runs `migrations/`, and adds the packages to the host. Then
restart MJAPI and rebuild MJExplorer.

### For development

```bash
git clone https://github.com/MemberJunction/bizapps-sales.git
cd bizapps-sales
pnpm install            # pnpm 10.33 (packageManager); always at the repo root
cp .env.example .env    # then fill in your database settings
pnpm run build
pnpm run verify         # the static gates, build and unit tests
```

Sales has no MJAPI or MJExplorer of its own: its packages run inside an MJ host, with the other BizApps
apps checked out beside it. [`docs/WORKSPACE-SETUP.md`](docs/WORKSPACE-SETUP.md) covers the joined
workspace and the database, and [`docs/QA-GUIDE.md`](docs/QA-GUIDE.md) covers running and testing it.
[`CLAUDE.md`](CLAUDE.md) holds the working rules for this repo.

## Tests

| Command | What it runs |
|---|---|
| `pnpm run verify` | The vocabulary, money, comment-drift, distribution, spec-typecheck and selector gates, the build, unit tests, and the discount and validation gates |
| `pnpm run test:coverage-gate` | The integration suite against a live, seeded database; fails if fewer checks ran than `scripts/expected-check-counts.json` declares |
| `pnpm run test:explorer` | Create/read/update/delete runs through a host's MJExplorer ([`test-harnesses/playwright/README.md`](test-harnesses/playwright/README.md)) |

CI (`.github/workflows/ci.yml`) runs the static gates, the build and the unit tests on every pull
request and every push to `next`. The integration suite and the Explorer harness need a live database,
so they run locally.

## Entity model

Schema `__mj_BizAppsSales`; entity names are `MJ_BizApps_Sales: <name>`. The classes are generated into
[`packages/Entities/src/generated/entities/__mj_BizAppsSales.ts`](packages/Entities/src/generated/entities/__mj_BizAppsSales.ts).

| Entity | Table | What it holds |
|---|---|---|
| Deals | `Deal` | Pipeline, stage, type, status, account, primary and billing contacts, `CompanyID`, owner, `Amount` with its provenance (`AmountIsComputed`, `AmountComputedAt`, `AmountSourceHash`), term, contract terms and dates, forecast category, loss reason, lead source, `ContractID` / `RenewsContractID`, `OrderID`, and the predicted-win fields |
| Deal Team Members | `DealTeamMember` | The people working a deal: exactly one of `EmployeeID` or `PersonID` (a partner rep or contractor), in a `DealRole`, with an optional `AttributionPct` |
| Deal Contact Roles | `DealContactRole` | The customer's buying committee: a `SalesContact` in a `BuyingRoleType` |
| Deal Payment Schedules | `DealPaymentSchedule` | The agreed instalments: date, amount, description, display order |
| Deal Stage Events | `DealStageEvent` | Append-only log of stage and status changes, with `AmountAtTransition` and `ProbabilityAtTransition` |
| Deal Sequences | `DealSequence` | The counter behind `DealNumber` |
| Pipelines | `Pipeline` | Owned by a company (`CompanyID` is required); `CloseWonPolicy`, `RequiresDealLines`, `IncludeInForecast`, `IsDefault` |
| Pipeline Stages | `PipelineStage` | Display order, probability, forecast category, the `DealStatusType` a deal takes on entry, `OrderStatusOnEntry`, entry and exit criteria, required fields, rotting days, guidance |
| Forecast Snapshots | `ForecastSnapshot` | Commit, best-case, pipeline and closed amounts for a period, by company, pipeline and owner |
| Sales Accounts | `SalesAccount` | IsA child of common's `Organization`: owner, account type, lifecycle stage, lead source, territory, tier, ICP fit, industry, size bands, health |
| Sales Contacts | `SalesContact` | IsA child of common's `Person`: owner, lifecycle stage, buying role, lead source, seniority, outreach opt-out, last engaged |

**Type tables.** Each has `Code`, `Name`, `Description`, `DisplayRank` and `IsActive`, plus the fields
the engine branches on. Their rows are seeded from `metadata/`.

| Type table | Fields the engine reads |
|---|---|
| `DealStatusType` | `IsOpen`, `IsClosed`, `IsWon`, `IsLost`, `LocksDeal` |
| `DealType` | `RequiresContract`, `RequiresRenewalSource`, `DefaultPipelineID` |
| `DealRole` | `IsOwnerRole`, `AllowsMultiplePerDeal`, `DefaultAttributionPct`, `IsQuotaCarrying` |
| `ForecastCategoryType` | `IncludeInCommit`, `IncludeInBestCase`, `IncludeInPipeline` |
| `LossReason` | `Category`, `RequiresNotes`, `IsCompetitive` |
| `LeadSourceType` | `IsInbound`, `IsPaid`, `AttributionWindowDays` |
| `LifecycleStageType` | `IsMarketingQualified`, `IsSalesQualified`, `IsCustomer` |
| `BuyingRoleType` | `IsDecisionMaker`, `IsBlocker`, `InfluenceWeight` |
| `AccountType` | `IsCustomer`, `IsProspect`, `IsPartner` |

**References to other apps.** `Deal.OrderID` points at an orders `OrderHeader`; `ContractID` and
`RenewsContractID` at a contracts `Contract`; `CurrencyID` at an accounting `Currency`.
`DealTeamMember.PersonID` points at a common `Person`. Companies, employees and users come from MJ core:
`CompanyID` on `Deal`, `Pipeline` and `ForecastSnapshot`, the owner and team `EmployeeID`s, and
`ClosedByUserID` / `ChangedByUserID`.

## Documentation

- [`docs/README.md`](docs/README.md) — every doc in this repo, and whether it is current or history.
- [`CLAUDE.md`](CLAUDE.md) — the rules for working in this repo.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — the rulings that govern the app, with their reasoning.
- The original specification, `plans/bizapps-sales-master.md`, is on the
  [`an-master-plan`](https://github.com/MemberJunction/bizapps-sales/blob/an-master-plan/plans/bizapps-sales-master.md)
  branch. `docs/DECISIONS.md` records where the app departs from it.

## License

Business Source License 1.1 — see [LICENSE](./LICENSE) for details.

---

<p align="center">
  Built on <a href="https://github.com/MemberJunction/MJ">MemberJunction</a> — the metadata-driven application platform.
</p>
