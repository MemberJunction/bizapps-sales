# Lapsed Close Date Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A weekly digest of open deals whose expected close date has passed or was never set, sent to per-company leaders and portfolio-wide executives, with the audiences defined as data rather than code.

**Architecture:** Two new entities in `__mj_BizAppsSales` — `DealDigestAudienceType` (behaviour flags) and `DealDigestRecipient` (audience × company × employee). Pure selection, rendering and sender logic lives in `packages/CoreEntitiesServer/src/digest/`, following the `finance-exceptions/` precedent; a thin `BaseAgent` subclass in `packages/Server/src/custom/` is what the scheduled job invokes. One deterministic pass, no LLM.

**Tech Stack:** TypeScript, MemberJunction 6.2.1, Vitest, Flyway migrations (SQL Server + Postgres mirror), MJ MetadataSync.

**Spec:** `docs/superpowers/specs/2026-11-16-lapsed-close-date-digest-design.md`

## Global Constraints

- **No host's names, addresses, companies or pipeline rules in code or shipped metadata.** No recipient rows ship. Zero exceptions.
- **Never compare a stage or status name.** Branch on `DealStatusType.IsClosed`. `pnpm run test:vocabulary-gate` enforces this.
- **No arithmetic on money.** Display `Deal.Amount` per row; no subtotals, no portfolio total, no rounding. `pnpm run test:money-gate` watches for it. Currency *formatting* via `Intl.NumberFormat` is allowed.
- **Owner comes from `Deal.OwnerEmployeeID`.** Never join `DealTeamMember` — it triple-counts.
- **"Not closed" is `IsClosed = 0`, never `IsOpen = 1`.** `ONHOLD` ships as `IsOpen=0, IsClosed=0`; they are not inverses.
- **Every migration needs a Postgres mirror** at `migrations-pg/<same name>.pg.sql`. No CI gate parses it, so a missing or wrong mirror ships silently.
- **Migration naming:** `V<YYYYMMDDHHMM>__v6.32.x__<Name>.sql`. Current tip is `v6.31.x`; confirm `6.32.x` is still the shipping release at merge time.
- **Metadata PRs are declarative JSON only** — fields, `@lookup`, a `uuidgen` primaryKey, **no `sync` block**, no `*__Metadata_Sync.sql`. The build engineer generates one consolidated Metadata_Sync per release.
- **New vocabulary is a metadata row with a hardcoded UUID**, never a SQL `INSERT` in a migration.
- **CHECK constraints are for structural invariants only**, never domain vocabulary or cross-table rules.
- **This PR needs a `minor` changeset** — it touches `migrations/` and seeds metadata values.
- **Order of work for the schema:** migration → apply → `mj sync push` → `mj codegen` → write code against generated typed properties. Code written before CodeGen ends up using `.Get()`/`.Set()` or `as any`.
- **Generated code is committed.** Never hand-edit it.
- **Database prerequisite:** Tasks 1–3 need a local development database (`scripts/rebuild-db.sh`, `docs/WORKSPACE-SETUP.md`). Never run `mj migrate` / `mj codegen` / `mj sync push` against the test or production database.
- Tests are **Vitest** at `packages/*/src/**/*.test.ts`. Run with `npx vitest run <path>`.
- ~~The send action is looked up by **`DriverClass = '__SendSingleMessage'`**, not by name. Its params are `To`, `From`, `Subject`, `Body`, `Provider`, `MessageType`.~~
  **Superseded after the first live send.** That action has no HTML parameter, so the digest was delivered as plain text with its markup visible (MJ#6761, KI-30). The run resolves the provider and its `Email` message type from the `DigestProvider` setting and calls `CommunicationEngine.SendSingleMessage` directly, sending `HTMLBody` and a text `Body`.

## Review Focus

1. **A deal name containing HTML** (`<script>`, `&`, `"`) must render escaped in the body, never as markup — deal names come from user input and flow into an email. → Task 6.
2. **An `ExpectedCloseDate` equal to today in the business zone is NOT lapsed.** The classic off-by-one; a DATE read as UTC midnight and compared in a negative-offset zone looks a day early. → Task 4.
3. **`ExplorerBaseUrl` with a trailing slash** must not produce `//resource/record/...`. → Task 6.
4. **An employee deactivated after being seeded** must stop receiving the digest without anyone editing recipient rows. → Task 5.
5. **Days-lapsed arithmetic across a DST transition** must stay exact — compute from `FromCalendarDay()` UTC-midnight instants, never by adding 24h to a local time. → Task 4.

---

### Task 1: Schema — the two tables

**Files:**
- Create: `migrations/V202611191600__v6.33.x__Deal_Digest_Audiences.sql`
- Create: `migrations-pg/V202611191600__v6.33.x__Deal_Digest_Audiences.pg.sql`
- Create: `.changeset/lapsed-close-date-digest.md`

**Interfaces:**
- Produces: tables `__mj_BizAppsSales.DealDigestAudienceType` and `__mj_BizAppsSales.DealDigestRecipient`, consumed by every later task through generated entities.

- [ ] **Step 1: Write the SQL Server migration**

`DealDigestAudienceType` columns, in order: `ID` (uniqueidentifier, PK, default `newsequentialid()`), `Code` (nvarchar(50) NOT NULL, UNIQUE), `Name` (nvarchar(100) NOT NULL), `Description` (nvarchar(MAX) NULL), `IsPortfolioWide` (bit NOT NULL default 0), `MinDaysLapsed` (int NULL), `IncludeMissingCloseDate` (bit NOT NULL default 1), `SendWhenEmpty` (bit NOT NULL default 0), `GroupByCompany` (bit NOT NULL default 1), `SubjectTemplate` (nvarchar(255) NULL), `IntroTemplate` (nvarchar(MAX) NULL), `EmptyMessage` (nvarchar(500) NULL), `DisplayRank` (int NOT NULL default 0), `IsActive` (bit NOT NULL default 1).

`DealDigestRecipient` columns: `ID` (uniqueidentifier, PK, default `newsequentialid()`), `DealDigestAudienceTypeID` (uniqueidentifier NOT NULL, FK → `DealDigestAudienceType`), `CompanyID` (uniqueidentifier NULL, FK → `${mjSchema}.Company`), `EmployeeID` (uniqueidentifier NOT NULL, FK → `${mjSchema}.Employee`), `IsActive` (bit NOT NULL default 1).

One `CONSTRAINT UQ_DealDigestRecipient UNIQUE (DealDigestAudienceTypeID, CompanyID, EmployeeID)`. The only CHECK is `CK_DealDigestAudienceType_MinDaysLapsed CHECK (MinDaysLapsed IS NULL OR MinDaysLapsed >= 0)` — a non-negative numeric bound, which is structural. **Do not** add a CHECK tying `CompanyID` to `IsPortfolioWide`; that is cross-table and belongs in Task 5's `Save()` override.

Add `sp_addextendedproperty` descriptions on both tables and every column, as the sibling migrations do — CodeGen reads them into the generated entity docs.

Header comment must record: why the UNIQUE constraint treating NULLs as equal is the *intended* behaviour (one portfolio-wide row per person per audience), and why no CompanyID/IsPortfolioWide CHECK exists.

- [ ] **Step 2: Write the Postgres mirror**

Same objects in `migrations-pg/`, following the translation conventions in the neighbouring `.pg.sql` files (`uniqueidentifier`→`uuid`, `bit`→`boolean`, `nvarchar(n)`→`varchar(n)`, `nvarchar(MAX)`→`text`, extended properties→`COMMENT ON`). No CI gate parses this file; a reviewer is the only check.

**No teardown entry is needed for this task.** Both tables live in `__mj_BizAppsSales`, which
`mj app remove` drops wholesale (`DropAppSchema`) after running the teardown file, taking Task 2's
seeded rows with them. `migrations-teardown/V001` retires only rows seeded into *shared* schemas;
this PR's are seeded in Task 9, which owns that edit.

- [ ] **Step 3: Apply to the local development database**

Run: `npx mj migrate`
Expected: both migrations report success; `flyway_schema_history` shows the new version.

- [ ] **Step 4: Write the changeset**

`.changeset/lapsed-close-date-digest.md`, bump level `minor` for every published package this PR touches (`@mj-biz-apps/sales-entities`, `-core-entities-server`, `-server`), with a user-facing description of the digest.

- [ ] **Step 5: Commit**

```bash
git add migrations/ migrations-pg/ .changeset/
git commit -m "feat(sales): digest audience and recipient tables"
```

---

### Task 2: Seed the four audience types

**Files:**
- Create: `metadata/deal-digest-audience-types/.mj-sync.json`
- Create: `metadata/deal-digest-audience-types/.deal-digest-audience-types.json`

**Interfaces:**
- Consumes: Task 1's tables.
- Produces: four rows with fixed UUIDs, referenced by `Code` in later tests.

- [ ] **Step 1: Write the folder sync config**

Copy the shape of `metadata/deal-status-types/.mj-sync.json`, with `"entity": "MJ_BizApps_Sales: Deal Digest Audience Types"` and `newFileName` matching the seed file. Note the `pull` key is lowercase — a capital `Pull` is silently ignored.

- [ ] **Step 2: Write the four seed rows**

Each with a `uuidgen` primaryKey and **no `sync` block**. Exact flag values:

| Code | Name | IsPortfolioWide | MinDaysLapsed | IncludeMissingCloseDate | SendWhenEmpty | GroupByCompany | DisplayRank |
|---|---|---|---|---|---|---|---|
| `COMPANY_LEADER` | Company Leader | 0 | NULL | 1 | 0 | 0 | 10 |
| `CEO` | CEO | 1 | 14 | 1 | 1 | 1 | 20 |
| `CFO` | CFO | 1 | NULL | 1 | 1 | 1 | 30 |
| `CTO` | CTO | 1 | 14 | 1 | **0** | 1 | 40 |

`SubjectTemplate`, `IntroTemplate` and `EmptyMessage` are **NULL on all four** — code supplies neutral defaults, and host-authored copy goes on rows a host adds. A `_comments` block must say that a host wanting different behaviour should add its own audience row rather than edit these, because a later release that edits a shipped row overwrites a host's changes to it.

- [ ] **Step 3: Push and verify**

Run: `npx mj sync push --dir metadata`
Expected: four rows created; re-running reports no changes.

- [ ] **Step 4: Commit**

```bash
git add metadata/deal-digest-audience-types/
git commit -m "feat(sales): seed the four digest audience types"
```

---

### Task 3: CodeGen

**Files:**
- Modify (generated, do not hand-edit): `packages/Entities/src/generated/`, `packages/Angular/src/lib/generated/`, `packages/Server/src/generated/`

- [ ] **Step 1: Run CodeGen**

Run: `npx mj codegen`
Expected: `success: true`. Re-run until it does — a partial run drops objects (`docs/CODEGEN-PARTIAL-RUNS.md`).

- [ ] **Step 2: Verify the generated entities exist**

Run: `grep -c "mjBizAppsSalesDealDigestAudienceTypeSchema\|mjBizAppsSalesDealDigestRecipientSchema" packages/Entities/src/generated/entities/__mj_BizAppsSales.ts`
Expected: `2`

- [ ] **Step 3: Build**

Run: `pnpm run build:generated`
Expected: clean compile.

- [ ] **Step 4: Commit**

```bash
git add packages/*/src/generated/ packages/*/src/lib/generated/
git commit -m "chore(sales): codegen for the digest entities"
```

---

### Task 4: Audience selection — the pure core

**Files:**
- Create: `packages/CoreEntitiesServer/src/digest/audience.ts`
- Test: `packages/CoreEntitiesServer/src/__tests__/DigestAudience.test.ts`

**Interfaces:**
- Produces:
```typescript
export interface DigestAudience {
    ID: string; Code: string; Name: string;
    IsPortfolioWide: boolean; MinDaysLapsed: number | null;
    IncludeMissingCloseDate: boolean; SendWhenEmpty: boolean;
    GroupByCompany: boolean;
    SubjectTemplate: string | null; IntroTemplate: string | null; EmptyMessage: string | null;
    DisplayRank: number;
}
export interface LapsedDeal {
    ID: string; Name: string; CompanyID: string; CompanyName: string;
    OwnerName: string; Amount: number | null;
    ExpectedCloseDate: CalendarDay | null; DaysLapsed: number | null;
    StageName: string;
}
export interface CompanyGroup { CompanyID: string; CompanyName: string; Deals: LapsedDeal[] }

export function ComputeDaysLapsed(closeDate: CalendarDay | null, today: CalendarDay): number | null;
export function SelectForAudience(
    deals: readonly LapsedDeal[],
    audience: DigestAudience,
    recipientCompanyID: string | null,
): CompanyGroup[];
```
`CalendarDay` is imported from `@mj-biz-apps/common-entities`.

- [ ] **Step 1: Write the failing tests**

```typescript
describe('ComputeDaysLapsed', () => {
  it('returns null when the close date was never set', () => {
    expect(ComputeDaysLapsed(null, ToCalendarDay('2026-11-23')!)).toBeNull();
  });
  it('returns 0 for a deal closing today — today is not lapsed', () => {
    expect(ComputeDaysLapsed(ToCalendarDay('2026-11-23')!, ToCalendarDay('2026-11-23')!)).toBe(0);
  });
  it('counts whole days across a DST transition exactly', () => {
    // 1 Nov 2026 is the US DST fall-back; a naive local-time subtraction gives 14.04 days.
    expect(ComputeDaysLapsed(ToCalendarDay('2026-10-25')!, ToCalendarDay('2026-11-08')!)).toBe(14);
  });
});

describe('SelectForAudience', () => {
  it('keeps only the recipient company when the audience is not portfolio-wide', () => { /* two companies in, one group out */ });
  it('returns every company when the audience is portfolio-wide', () => { /* two groups, sorted by company name */ });
  it('applies MinDaysLapsed as a strict floor', () => { /* daysLapsed 14 excluded when MinDaysLapsed is 14; 15 kept */ });
  it('keeps never-set close dates regardless of MinDaysLapsed when IncludeMissingCloseDate', () => { /* null-date deal survives a 14-day floor */ });
  it('drops never-set close dates when IncludeMissingCloseDate is false', () => { /* empty result */ });
  it('sorts groups by company name, case-insensitively', () => { /* "signal.example" between "Mira" and "Terra Labs" */ });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run packages/CoreEntitiesServer/src/__tests__/DigestAudience.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `audience.ts`**

`ComputeDaysLapsed` takes the millisecond difference between `FromCalendarDay(today)` and `FromCalendarDay(closeDate)` divided by 86,400,000 — both are UTC-midnight instants, so the result is exact and DST-free. Clamp at 0. `SelectForAudience` filters then groups; sort with `localeCompare(…, { sensitivity: 'base' })`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run packages/CoreEntitiesServer/src/__tests__/DigestAudience.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/CoreEntitiesServer/src/digest/audience.ts packages/CoreEntitiesServer/src/__tests__/DigestAudience.test.ts
git commit -m "feat(sales): audience selection for the digest"
```

---

### Task 5: Recipients — loading, validation, dedupe

**Files:**
- Create: `packages/CoreEntitiesServer/src/digest/recipients.ts`
- Create: `packages/CoreEntitiesServer/src/DealDigestRecipientEntityServer.ts`
- Modify: `packages/CoreEntitiesServer/src/index.ts` (export both; add `DealDigestRecipientEntityServer` to the `LoadSalesCoreEntitiesServer()` anchor array)
- Test: `packages/CoreEntitiesServer/src/__tests__/DigestRecipients.test.ts`

**Interfaces:**
- Consumes: `DigestAudience` from Task 4.
- Produces:
```typescript
export interface DigestRecipient {
    AudienceTypeID: string; CompanyID: string | null;
    EmployeeID: string; Email: string; FirstName: string; FullName: string;
}
export function DedupeByEmail(recipients: readonly DigestRecipient[]): DigestRecipient[];
export async function LoadDigestRecipients(contextUser: UserInfo): Promise<DigestRecipient[]>;
```
`DealDigestRecipientEntityServer` is `@RegisterClass(BaseEntity, 'MJ_BizApps_Sales: Deal Digest Recipients')`.

- [ ] **Step 1: Write the failing tests**

```typescript
describe('DedupeByEmail', () => {
  it('collapses two employee records sharing one address', () => { /* Lena Petrov twice, one out */ });
  it('keeps the same address under two different audiences', () => { /* leader + CEO both survive */ });
  it('compares addresses case-insensitively', () => { /* Pat@x vs pat@x → one */ });
});

describe('DealDigestRecipientEntityServer.Save', () => {
  it('refuses a non-portfolio audience row with no CompanyID', () => { /* message names the audience */ });
  it('refuses an employee with no email address', () => { /* message names the employee */ });
  it('refuses an inactive employee', () => { /* Review Focus 4 */ });
  it('accepts a portfolio-wide row with a null CompanyID', () => { /* saves */ });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run packages/CoreEntitiesServer/src/__tests__/DigestRecipients.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement both files**

`LoadDigestRecipients` runs one `RunView` over `MJ_BizApps_Sales: Deal Digest Recipients` filtered `IsActive = 1`, then one batched `RunView` over `MJ: Employees` for the distinct `EmployeeID` values filtered `Active = 1`, joining in memory — a recipient whose employee is inactive is dropped here, not only at `Save()`. `DedupeByEmail` keys on the lower-cased address within one audience/company pair. The `Save()` override follows `DealEntityServer`'s refusal style: a friendly message naming the offending value, never a foreign-key error.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run packages/CoreEntitiesServer/src/__tests__/DigestRecipients.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/CoreEntitiesServer/src/digest/recipients.ts packages/CoreEntitiesServer/src/DealDigestRecipientEntityServer.ts packages/CoreEntitiesServer/src/index.ts packages/CoreEntitiesServer/src/__tests__/DigestRecipients.test.ts
git commit -m "feat(sales): digest recipient loading and validation"
```

---

### Task 6: Rendering

**Files:**
- Create: `packages/CoreEntitiesServer/src/digest/render.ts`
- Test: `packages/CoreEntitiesServer/src/__tests__/DigestRender.test.ts`

**Interfaces:**
- Consumes: `CompanyGroup`, `DigestAudience` (Task 4); `DigestRecipient` (Task 5).
- Produces:
```typescript
export interface RenderedDigest { Subject: string; BodyHtml: string }
export interface RenderContext {
    audience: DigestAudience; recipient: DigestRecipient;
    groups: readonly CompanyGroup[]; today: CalendarDay;
    explorerBaseUrl: string | null; totalDeals: number; truncated: boolean;
}
export function FillTemplate(template: string, values: Readonly<Record<string, string>>): string;
export function DealRecordUrl(baseUrl: string, dealID: string): string;
export function RenderDigest(ctx: RenderContext): RenderedDigest;
```

- [ ] **Step 1: Write the failing tests**

```typescript
describe('FillTemplate', () => {
  it('substitutes {Company}, {Count}, {Today} and {RecipientFirstName}', () => { /* … */ });
  it('leaves an unknown placeholder literally rather than throwing', () => { /* "{Nope}" survives */ });
});

describe('DealRecordUrl', () => {
  it('builds the Explorer route with the entity name encoded', () => {
    expect(DealRecordUrl('https://x.io', 'ABC')).toBe('https://x.io/resource/record/MJ_BizApps_Sales%3A%20Deals/ABC');
  });
  it('does not double the slash when the base URL ends in one', () => {
    expect(DealRecordUrl('https://x.io/', 'ABC')).toBe('https://x.io/resource/record/MJ_BizApps_Sales%3A%20Deals/ABC');
  });
});

describe('RenderDigest', () => {
  it('escapes HTML in a deal name', () => { /* '<script>' never appears unescaped in BodyHtml */ });
  it('renders "Not set" and "No close date" for a null close date', () => { /* … */ });
  it('renders the deal name as plain text when explorerBaseUrl is null', () => { /* no <a href */ });
  it('uses the audience EmptyMessage when there are no groups', () => { /* … */ });
  it('falls back to neutral default copy when SubjectTemplate and IntroTemplate are null', () => { /* subject names the count and the date */ });
  it('omits company section headers when GroupByCompany is false', () => { /* … */ });
  it('names the truncation in the footer when truncated is true', () => { /* Task 7's row cap */ });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run packages/CoreEntitiesServer/src/__tests__/DigestRender.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `render.ts`**

Table-based HTML, inline CSS, no remote images, built by string concatenation — no template engine dependency. Every value originating in deal or employee data goes through an `escapeHtml` helper; `IntroTemplate` and `SubjectTemplate` are host-authored and inserted without escaping, which is why a `_comments` note in Task 2 keeps them out of shipped rows. Amount formatting uses `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })` — formatting only, never arithmetic. `DealRecordUrl` strips trailing slashes from the base before joining.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run packages/CoreEntitiesServer/src/__tests__/DigestRender.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/CoreEntitiesServer/src/digest/render.ts packages/CoreEntitiesServer/src/__tests__/DigestRender.test.ts
git commit -m "feat(sales): digest rendering"
```

---

### Task 7: The deal query and the run

**Files:**
- Create: `packages/CoreEntitiesServer/src/digest/lapsed-deals.ts`
- Create: `packages/CoreEntitiesServer/src/digest/sender.ts`
- Create: `packages/CoreEntitiesServer/src/digest/run.ts`
- Test: `packages/CoreEntitiesServer/src/__tests__/DigestRun.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 4–6.
- Produces:
```typescript
export const MAX_DEALS_PER_RUN = 5000;
export interface LapsedDealsResult { Deals: LapsedDeal[]; Truncated: boolean }
export async function LoadLapsedDeals(contextUser: UserInfo, today: CalendarDay): Promise<LapsedDealsResult>;

export type SenderFromResolution = { From: string; FromName: string | null } | null;
export async function ResolveSender(companyID: string | null, contextUser: UserInfo): Promise<SenderFromResolution>;

export interface DigestRunOptions {
    dryRun?: boolean; captureRenderedEmails?: boolean;
    recipientOverride?: { name: string; email: string };
}
export interface DigestRunResult {
    Success: boolean; TotalLapsedDeals: number; Truncated: boolean;
    Sent: number; SkippedEmpty: number; Errors: string[];
    RenderedEmails: Array<{ To: string; From: string; Subject: string; BodyHtml: string; AudienceCode: string; CompanyName: string | null }>;
}
export async function RunLapsedCloseDateDigest(contextUser: UserInfo, options?: DigestRunOptions): Promise<DigestRunResult>;
```

- [ ] **Step 1: Write the failing tests**

```typescript
describe('LoadLapsedDeals', () => {
  it('filters on IsClosed = 0, not IsOpen = 1, so On Hold deals are included', () => { /* snapshot the ExtraFilter */ });
  it('treats a null DealStatusTypeID as not closed', () => { /* filter contains "IS NULL OR" */ });
  it('excludes pipelines with IncludeInForecast = 0', () => { /* … */ });
  it('compares the close date with < and not <=, so today is not lapsed', () => {
    // Review Focus 2. A deal closing today must not appear; only strictly earlier dates qualify.
  });
  it('reports Truncated when the result count reaches MAX_DEALS_PER_RUN', () => { /* … */ });
});

describe('ResolveSender', () => {
  it('prefers the company Mailbox identity', () => { /* … */ });
  it('falls back to the DigestFromAddress setting for a portfolio audience', () => { /* companyID null */ });
  it('returns null when neither resolves', () => { /* … */ });
});

describe('RunLapsedCloseDateDigest', () => {
  it('sends nothing and reports failure when no sender resolves', () => { /* Errors names the recipient */ });
  it('skips a company-leader digest when that company has nothing lapsed', () => { /* SkippedEmpty increments */ });
  it('sends an all-clear when the audience has SendWhenEmpty', () => { /* … */ });
  it('sends nothing for an empty audience without SendWhenEmpty', () => { /* the CTO case */ });
  it('continues after one failed send and reports both', () => { /* fail the 2nd of 4 */ });
  it('configures the communication engine and resolves the provider once per run', () => { /* superseded: see the note at the top */ });
  it('passes To, From, Subject, Body, Provider and MessageType on every call', () => { /* … */ });
  it('dryRun renders everything and calls RunAction zero times', () => { /* RenderedEmails populated */ });
  it('recipientOverride reroutes every send while subjects still name the real audience and company', () => { /* … */ });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run packages/CoreEntitiesServer/src/__tests__/DigestRun.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the three files**

`LoadLapsedDeals` resolves "today" through `BusinessTimeZoneEngine` → `TodayIn(zone)`, loads not-closed status-type IDs and excluded pipeline IDs in two small `RunView` calls, then one `RunView` over `MJ_BizApps_Sales: Deals` with `ResultType: 'simple'`, `MaxRows: MAX_DEALS_PER_RUN`, ordered by company then close date. Owner names come from one batched `RunView` over `MJ: Employees`.

`ResolveSender` uses `DefaultSenderForCompany` from `@mj-biz-apps/common-entities` against the company's `CompanySenderIdentity` rows, then the `DigestFromAddress` Application Setting via `ApplicationSettingEngine`.

`RunLapsedCloseDateDigest` orchestrates: load deals once → load audiences and recipients → per audience in `DisplayRank` order, per deduped recipient, select, render, send. Sending goes through `CommunicationEngine.SendSingleMessage` (see the superseded note above), which writes a `MJ: Communication Logs` row per send itself. The render path must be callable without the send path, so `dryRun` never reaches the provider.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run packages/CoreEntitiesServer/src/__tests__/DigestRun.test.ts`
Expected: PASS

- [ ] **Step 5: Run the whole suite and the gates**

Run: `npx vitest run && pnpm run test:vocabulary-gate && pnpm run test:money-gate`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/CoreEntitiesServer/src/digest/ packages/CoreEntitiesServer/src/__tests__/DigestRun.test.ts
git commit -m "feat(sales): the digest run — query, sender, orchestration"
```

---

### Task 8: The agent

**Files:**
- Create: `packages/Server/src/custom/lapsed-close-date-digest.agent.ts`
- Modify: `packages/Server/src/index.ts` (import and call `LoadLapsedCloseDateDigestAgent()`)
- Modify: `packages/Server/package.json` (add `@memberjunction/ai-agents` and `@memberjunction/ai-core-plus` at the MJ pin)
- Test: `packages/Server/src/__tests__/LapsedCloseDateDigestAgent.test.ts`

**Interfaces:**
- Consumes: `RunLapsedCloseDateDigest`, `DigestRunOptions`, `DigestRunResult` from Task 7.
- Produces: `@RegisterClass(BaseAgent, 'Sales.LapsedCloseDateDigest')`, and `export function LoadLapsedCloseDateDigestAgent(): void`.

- [ ] **Step 1: Write the failing tests**

```typescript
describe('LapsedCloseDateDigestAgent', () => {
  it('terminates with an error when there is no context user', () => { /* step: 'Failed' */ });
  it('parses dryRun, captureRenderedEmails and recipientOverride from the payload', () => { /* … */ });
  it('ignores a malformed recipientOverride rather than throwing', () => { /* missing email → undefined */ });
  it('returns step Failed when the run reports errors', () => { /* … */ });
  it('returns step Success and the tallies in newPayload when the run is clean', () => { /* … */ });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run packages/Server/src/__tests__/LapsedCloseDateDigestAgent.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the agent**

`executeAgentInternal` validates `params.contextUser`, parses `params.payload` into `DigestRunOptions` defensively (unknown and malformed fields ignored, never thrown), calls `RunLapsedCloseDateDigest`, and returns `{ finalStep: { terminate: true, step, message, newPayload }, stepCount: 1 }`. `LoadLapsedCloseDateDigestAgent()` exists purely to defeat tree-shaking — follow the comment style on `LoadSalesCoreEntitiesServer`.

- [ ] **Step 4: Run to verify they pass, then build**

Run: `npx vitest run packages/Server/src/__tests__/LapsedCloseDateDigestAgent.test.ts && pnpm run build:packages`
Expected: PASS, clean compile.

- [ ] **Step 5: Commit**

```bash
git add packages/Server/src/custom/lapsed-close-date-digest.agent.ts packages/Server/src/index.ts packages/Server/package.json packages/Server/src/__tests__/LapsedCloseDateDigestAgent.test.ts
git commit -m "feat(sales): the lapsed close date digest agent"
```

---

### Task 9: Agent and scheduled-job metadata

**Files:**
- Create: `metadata/agents/.mj-sync.json`, `metadata/agents/.sales-agents.json`
- Create: `metadata/scheduled-jobs/.sales-lapsed-close-date-scheduled-jobs.json`
- Create: `metadata/application-settings/.digest-settings.json`
- Create: `metadata/entity-permissions/.deal-digest.json`
- Modify: `metadata/.mj-sync.json` if it enumerates directories
- Modify: `migrations-teardown/V001__Retire_Sales_Core_Rows.sql`

**Interfaces:**
- Consumes: Task 8's `DriverClass`.

- [ ] **Step 1: Write the agent record**

`MJ: AI Agents` row: `Name` "Sales — Lapsed Close Date Digest", `TypeID` `@lookup:MJ: AI Agent Types.Name=Loop`, `DriverClass` `Sales.LapsedCloseDateDigest`, `ExecutionMode` Sequential, `MaxIterationsPerRun` 1, `Status` Active. Hardcoded `uuidgen` primaryKey.

- [ ] **Step 2: Write the scheduled job**

`MJ: Scheduled Jobs` row following `.sales-finance-exception-scheduled-jobs.json`: `JobTypeID` `@lookup:MJ: Scheduled Job Types.Name=Agent`, `CronExpression` `0 0 9 * * 1`, `Timezone` `America/New_York`, **`Status` `Disabled`**, `ConcurrencyMode` Skip, `MissedRunPolicy` RunOnce, `RunImmediatelyIfNeverRun` false, `Configuration` naming the agent.

A `_comments` block must record: why it ships Disabled; that the cron timezone governs *delivery* while `BizApps.BusinessTimeZone` governs which calendar day a deal is judged against, and that these are two deliberate settings rather than one inconsistency; and that the scheduler does not pick up job rows written out of process, so MJAPI must restart after a push.

- [ ] **Step 3: Write the two Application Settings**

`ExplorerBaseUrl` and `DigestFromAddress`, both shipping with an **empty** `Value`, `ApplicationID` `@lookup:MJ: Applications.Name=Sales`, fixed primary keys, and `Comments` explaining what each does and what happens when it is blank (a plain-text deal name; a failed send).

- [ ] **Step 4: Write the entity permissions**

Without these nobody can see or edit recipient rows in Explorer, and the whole premise — that an
administrator can see a wrong address and fix it — fails silently. Following
`metadata/entity-permissions/` and the deal-delete precedent: **Sales Admin** gets read, create,
update and delete on `MJ_BizApps_Sales: Deal Digest Recipients` and read on
`MJ_BizApps_Sales: Deal Digest Audience Types`; **Sales User** gets read on both. Neither gets
delete on the audience types — those are shipped vocabulary.

- [ ] **Step 5: Add the teardown roots**

Steps 1 and 2 seed two rows into `${mjSchema}` with fixed UUIDs. `mj app remove` does not reach
them, so without this they survive an uninstall and the next install fails on a primary-key
collision — the exact failure `migrations-teardown/V001__Retire_Sales_Core_Rows.sql` exists to
prevent. Append both to that file's `#SalesDoomed` INSERT list at `Depth 0`, in the existing style
(`${mjSchema}` placeholder, trailing comment naming the row), using the UUIDs minted above:

```sql
('${mjSchema}', 'AIAgent',      '<Step 1 primaryKey>', 0),  -- Sales -- Lapsed Close Date Digest
('${mjSchema}', 'ScheduledJob', '<Step 2 primaryKey>', 0),  -- Sales -- Lapsed Close Date Digest (weekly)
```

Add a comment recording what is deliberately **not** listed and why: the two Application Settings
from Step 3 (`ApplicationSetting.ApplicationID` is NOT NULL and the Sales `Application` row is
already a root, so they follow automatically) and the Step 4 entity permissions (`mj app remove`
walks those out from this app's `__mj.Entity` rows). `AIAgentRun` rows follow the agent on the
NOT NULL branch, which is the intended loss of run history.

- [ ] **Step 6: Push and verify**

Run: `npx mj sync push --dir metadata`
Expected: rows created; a re-run reports no changes.

- [ ] **Step 7: Verify the permissions took**

Run: `npx vitest run` and confirm the suite is still green, then check in Explorer that a Sales Admin
sees the Deal Digest Recipients entity and a Sales User cannot edit it.

- [ ] **Step 8: Commit**

```bash
git add metadata/ migrations-teardown/
git commit -m "feat(sales): digest agent, scheduled job, settings and permissions metadata"
```

---

### Task 10: Documentation and the PR

**Files:**
- Modify: `docs/README.md`, `docs/QA-GUIDE.md`, `README.md`

- [ ] **Step 1: Document the feature**

In `README.md`, add the digest to the entity model and feature list. In `docs/QA-GUIDE.md`, add the host setup sequence: seed recipients, set `DigestFromAddress` and `ExplorerBaseUrl`, run once with `{"dryRun": true}` in `StartingPayload`, check the rendered output, then run with `recipientOverride` to send a real test to one address, then enable the job and restart MJAPI. In `docs/README.md`, move the design doc's row from "Designs in progress" to a current entry and add the plan.

- [ ] **Step 2: Full verification**

Run: `npx vitest run && pnpm run build:packages && node scripts/assert-no-vocabulary-comparisons.mjs && node scripts/assert-no-money-arithmetic.mjs`
Expected: all green.

- [ ] **Step 3: Commit and mark the PR ready**

```bash
git add docs/ README.md
git commit -m "docs(sales): the lapsed close date digest"
git push
gh pr ready 614
```
