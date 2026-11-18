# Lapsed Close Date Digest — design

Status: built. Branch `feat/lapsed-close-date-digest` off `next`.

## Intent and why

A weekly pipeline-hygiene nudge. Open deals whose expected close date has passed — or was never
entered — are surfaced to the people who can push on them: each company's leaders get their own
company's list, and portfolio-wide executives get a rolled-up view.

The reason it exists: deal owners let close dates slip, which cascades into stale stages, stale
amounts and a forecast nobody trusts. A low-friction Monday email is the cheapest intervention.

This is a **migration, not a new idea**. It ran on CDP as `LapsedCloseDateAgent` and worked. It was
paused because the business moved to aidp-next, and CDP's version cannot follow: every address,
company and pipeline rule in it is a TypeScript constant, and its query is shaped around CDP's
HubSpot-flavoured `Deals` entity, which this app does not have.

Source material, for the behaviour this must reproduce:
`CDP/plans/Lapsed_Close_Date_Agent_Brief.md` and `CDP/packages/CustomAgents/src/LapsedCloseDateAgent.ts`.

## Goals

1. Reproduce CDP's behaviour: per-company leader digests that are skipped when a company has
   nothing lapsed; portfolio-wide executive digests that always send, where an empty digest is
   itself the all-clear.
2. **Audiences are data.** Adding a CTO digest, or changing the CEO's 14-day threshold, is rows in
   a type table — not a code change and not a deploy.
3. **Ships inert.** Installing or upgrading sales changes nothing for any host: no recipients are
   seeded and the scheduled job ships `Disabled`, matching the precedent set by
   `.sales-finance-exception-scheduled-jobs.json`.
4. Every send is independently auditable, as CDP's was.

## Non-goals

- No LLM reasoning, no per-deal commentary or recommendations. This is a nudge, not analysis.
- No CC/BCC of deal owners — the brief's premise is that the leader pushes owners directly.
- No attachments or CSV exports.
- No reply-to threading; each week's digest stands alone.
- Not a forecast tool. `ForecastSnapshot` already exists and is a different job.

## Anti-goals

These would make the work a failure even if it ran correctly.

- **Any host's names, addresses, companies or pipeline rules in code or in shipped metadata.** This
  app is published to npm and installed by `mj app install`. CDP's `DEFAULT_COMPANY_LEADERS`,
  `PORTFOLIO_COMPANIES` and `EXCLUDED_PIPELINES_BY_COMPANY` have no equivalent here and must not
  acquire one.
- **Any comparison of a stage or status name.** `pnpm run test:vocabulary-gate` would catch it, and
  it is the exact mistake CDP made (`DealStage NOT IN ('Closed Won','Closed Lost')`).
- **Any arithmetic on money.** The digest displays `Deal.Amount` per row and nothing else — no
  per-company subtotals, no portfolio total, no "pipeline at risk" figure, however much an executive
  digest invites one. Rule 1, and `test:money-gate` watches for it. CDP's digests carried deal
  *counts* only; that stays true.
- **Double-counting through `DealTeamMember`.** Owner comes from `Deal.OwnerEmployeeID`, which the
  server already maintains from the owner-role team member. The digest never joins the team table.

## Constraints

- Metadata PRs are declarative JSON only — fields, `@lookup`, a `uuidgen` primary key, no `sync`
  block, no `*__Metadata_Sync.sql`. The build engineer generates one consolidated Metadata_Sync per
  release (`docs/PUBLISHING.md`).
- New vocabulary is a metadata row with a hardcoded UUID, never a SQL `INSERT` in a migration.
- CHECK constraints are for structural invariants only, never domain vocabulary.
- Order of work for the schema change: migration → apply → `mj sync push` → `mj codegen` → write
  code against the generated typed properties.
- Tests are Vitest (`vitest.config.ts` at the root), not `node:test`.

## Approaches considered

**A. Two new entities — a digest audience type table plus recipient rows. (Chosen.)**
Audience behaviour lives as flags on a type table; who receives what lives as rows joining an
audience to a company and an employee. Adding the CTO is one vocabulary row and one recipient row.
Costs a migration, CodeGen, metadata and forms — the largest build of the three.

**B. MJ Roles plus Employee Roles.** New roles as distribution lists, per-company leaders derived
from `Employee.CompanyID`. **Rejected on the data.** The real roster has one person leading a
company they are not employed by (a Junction Labs leader on a `@example.invalid` address) and one person
leading two companies. `Employee.CompanyID` holds a single value and can express neither. It also
makes a permission grant double as a mail subscription, which invites a later accident.

**C. One Application Settings row holding the roster as JSON.** Cheapest by a wide margin — no
migration, no CodeGen, editable in Explorer today, and it matches the existing `HidePipelines`
pattern. Rejected for the product repo because a mistyped address fails silently, there is no
per-recipient Record Changes history, and it duplicates addresses that already exist on
`MJ: Employees`. It remains the sensible fallback if the schedule for getting Monday's email
flowing again turns out to matter more than the data model; its JSON maps one-to-one onto A's seed
rows, so nothing is wasted by starting there.

Chosen: **A**, because the stated requirement was that the audiences be definable, and A is the only
option where defining one is data.

## What the new schema looks like

Two tables in `__mj_BizAppsSales`.

### `DealDigestAudienceType` — vocabulary, with the behaviour flags

| Column | Type | Meaning |
|---|---|---|
| `ID` | uniqueidentifier, PK | |
| `Code` | nvarchar(50), NOT NULL, UNIQUE | stable key, e.g. `COMPANY_LEADER` |
| `Name` | nvarchar(100), NOT NULL | display |
| `Description` | nvarchar(MAX), NULL | |
| `IsPortfolioWide` | bit, NOT NULL, default 0 | 0 = the recipient's own company only; 1 = every company |
| `MinDaysLapsed` | int, NULL | NULL = everything lapsed; 14 = only deals more than 14 days past |
| `IncludeMissingCloseDate` | bit, NOT NULL, default 1 | whether deals with no close date qualify |
| `SendWhenEmpty` | bit, NOT NULL, default 0 | 0 = skip the send; 1 = send the all-clear |
| `GroupByCompany` | bit, NOT NULL, default 1 | render per-company section headers |
| `SubjectTemplate` | nvarchar(255), NULL | subject copy, with placeholders |
| `IntroTemplate` | nvarchar(MAX), NULL | the opening paragraph |
| `EmptyMessage` | nvarchar(500), NULL | copy used when `SendWhenEmpty` and there is nothing |
| `DisplayRank` | int, NOT NULL, default 0 | send order |
| `IsActive` | bit, NOT NULL, default 1 | |

The flags are what make this configurable rather than three hard-coded branches. CDP's three digests
become three rows:

| Code | PortfolioWide | MinDaysLapsed | SendWhenEmpty | GroupByCompany |
|---|---|---|---|---|
| `COMPANY_LEADER` | 0 | NULL | 0 | 0 |
| `CEO` | 1 | 14 | 1 | 1 |
| `CFO` | 1 | NULL | 1 | 1 |
| `CTO` | 1 | 14 | **0** | 1 |

The CTO is the CEO's slice — portfolio-wide, more than 14 days past, plus never-set close dates —
but it does not send when there is nothing. All four flags already existed, so the CTO needed no
schema change: it is four values in a seed row, which is the claim approach A was chosen to make.

`SubjectTemplate` and `IntroTemplate` are columns rather than code because CDP's copy had host
specifics welded into it — its leader intro names a particular person to contact when deals vanish
from the CRM. Shipping that text from an npm package would be wrong. Code supplies neutral defaults
when either is NULL, so a host that sets nothing still gets sensible subjects and intros.

**Placeholders**, rendered by a small typed substitution in this package rather than a templating
dependency (CDP used nunjucks; nothing here depends on a template engine and one class of digest does
not justify adding one): `{Company}`, `{Count}`, `{Today}`, `{RecipientFirstName}`. Unknown
placeholders render literally rather than throwing. Every value interpolated into the HTML body is
escaped; the intro and subject are host-authored and treated as trusted, deal and employee data never
is.

**Editing a shipped row is a host's choice with a known cost.** The four audience rows ship with
fixed UUIDs, and a release's generated seed emits an update for any shipped record whose `metadata/`
copy changed, so if a later sales release edits one of these rows it will overwrite a host's edits to
it. This is the same exposure `HidePipelines` already carries and accepts. Two things follow, and both
belong in the host documentation: sales must not casually edit these four rows after release, and a
host wanting different behaviour should **add its own audience row rather than edit a shipped one** —
which is the mechanism this design exists to provide, and which is immune to the problem.

### `DealDigestRecipient` — who gets what

| Column | Type | Meaning |
|---|---|---|
| `ID` | uniqueidentifier, PK | |
| `DealDigestAudienceTypeID` | uniqueidentifier, NOT NULL, FK | |
| `CompanyID` | uniqueidentifier, NULL, FK → `MJ: Companies` | required when the audience is not portfolio-wide; ignored when it is |
| `EmployeeID` | uniqueidentifier, NOT NULL, FK → `MJ: Employees` | name and address come from here |
| `IsActive` | bit, NOT NULL, default 1 | |

One `UNIQUE (DealDigestAudienceTypeID, CompanyID, EmployeeID)`. Note deliberately: SQL Server treats
NULLs as **equal** in a UNIQUE constraint, so portfolio-wide rows (`CompanyID IS NULL`) get exactly
one row per person per audience — which is the intent here, not a trap to work around.

Nothing ties `CompanyID`-is-required to the audience's `IsPortfolioWide` as a CHECK: that is a
cross-table rule, and CHECKs here are for structural invariants only. It is enforced in a
`DealDigestRecipientEntityServer.Save()` override, alongside a refusal when the chosen employee has
no email address — a silent empty `To` is the failure mode most likely to go unnoticed for weeks.

Taking the address from `MJ: Employees` rather than storing it is what buys FK integrity, Record
Changes history, and an employee who leaves being `Active = 0` in one place.

### What ships, and what does not

Ships: the four audience-type rows (vocabulary — `CEO`, `CFO`, `CTO` and `COMPANY_LEADER` are
universal enough to be app vocabulary), the agent record, the scheduled job as `Disabled`, the
`ExplorerBaseUrl`, `DigestFromAddress` and `DigestProvider` Application Settings with empty values, and entity and permission metadata.

Does not ship: **a single recipient row**. Recipients are host data. A fresh install sends nothing to
nobody until someone seeds them and enables the job.

## How a run works

One deterministic pass, no LLM. For each active audience type in `DisplayRank` order, for each of its
active recipients, render and send.

**The business day.** CDP fired its cron in Eastern and did its date arithmetic in Central — a
latent off-by-one for any deal sitting on the boundary. Here there is one zone:
`BusinessTimeZoneEngine` from bizapps-common, the instance-wide setting that already governs every
other business-day judgement in the stack, failing open to UTC. `TodayIn(zone)` and `IsBeforeDay`
from `business-day.ts` do the comparison; no new date helpers.

**Which deals are not yet closed.** Not a name comparison, and **not `IsOpen = 1`**. In this app
`IsOpen` and `IsClosed` are deliberately not inverses: the shipped `ONHOLD` status type is
`IsOpen = 0, IsClosed = 0`. Filtering on `IsOpen = 1` would silently drop every On Hold deal, and
CDP's `DealStage NOT IN ('Closed Won','Closed Lost')` included them. So: one small RunView over
`MJ_BizApps_Sales: Deal Status Types` where `IsClosed = 0` collects the IDs, and the deal filter
reads `(DealStatusTypeID IS NULL OR DealStatusTypeID IN (…))`. A NULL status counts as not-closed,
defensively, as CDP treated a NULL stage — better to over-report a broken deal than to drop one.

My call, open to correction: a deal parked On Hold with a close date three months gone is exactly the
hygiene problem this exists to surface, so it belongs in the digest.

**This is deliberately broader than the app's existing `IsPastExpectedClose`.** The shipped
`deal-roster.sql` computes that flag as `ISNULL(st.IsOpen,0) = 1 AND ExpectedCloseDate IS NOT NULL
AND ExpectedCloseDate < bt.Today` — it excludes On Hold deals *and* deals with no close date at all.
The digest must include never-set close dates; surfacing them as "Not set" rows is one of its stated
features, and CDP flagged them as a distinct category of broken. So the two definitions cannot be
made identical without changing the roster. The divergence is recorded here on purpose: a leader who
opens the Deals dashboard after reading the digest will see a smaller "past expected close" count
than the email showed, and that needs to be explainable rather than discovered. Aligning the roster
is a separate change and not in this scope.

**Which pipelines count.** `Pipeline.IncludeInForecast = 0` is excluded, replacing CDP's universal
`EXCLUDED_PIPELINES`. A host that keeps a pipeline out of the forecast almost certainly does not want
hygiene nagging about it either, and a second flag that hosts must remember to set would be a worse
default than reusing the one they already set.

**The limitation this leaves, stated honestly.** CDP also had a *per-company* exclusion list, because
Junction Labs's "Sales Pipeline" was a legacy non-revenue lane while the same name meant real revenue
elsewhere. That cannot be expressed here: `V202611062300__v6.25.x__Pipeline_Company_Link.sql` dropped
`Pipeline.CompanyID` so that one pipeline row is shared by every company linked to it through
`PipelineCompany`, while `IncludeInForecast` stayed on `Pipeline`. Excluding a shared pipeline
excludes it for everyone. **Checked against aidp-next production on 2026-11-16: every one of the 31
pipeline rows is linked to exactly one company**, so the shared-row case does not arise there and the
limitation is theoretical for this host. If it ever becomes real, the right home is a flag on
`PipelineCompany`, not another column on `Pipeline` — a later change, not this one.

**The deal query.** One RunView over `MJ_BizApps_Sales: Deals`, `ResultType: 'simple'`:

```
(DealStatusTypeID IS NULL OR DealStatusTypeID IN (<status types with IsClosed = 0>))
AND PipelineID NOT IN (<pipelines with IncludeInForecast = 0>)
AND (ExpectedCloseDate IS NULL OR ExpectedCloseDate < <today in the business zone>)
```

`MaxRows` is set explicitly **and checked**: a bare RunView is silently capped at the entity's
`UserViewMaxRows` (1000 by default), and a truncated sweep reports success while dropping deals from
the bottom of the CFO's digest. If the result count equals the cap, the run records a warning in its
result payload and in the email footer rather than pretending it saw everything. CDP set a cap and
never checked it.

**Audience slicing.** One query feeds every digest. Each audience filters the same enriched set by
its own flags: `MinDaysLapsed` (NULL means no floor), `IncludeMissingCloseDate`, and
`IsPortfolioWide` (otherwise, the recipient's `CompanyID`). An audience with no qualifying deals is
skipped unless `SendWhenEmpty`.

**Per-row contents.** Deal name, owner, amount as currency, expected close date or "Not set", days
lapsed or "No close date", and stage. Owner names come from one batched RunView over
`MJ: Employees` for the distinct `OwnerEmployeeID` values.

**The link back.** CDP linked each row to the deal in HubSpot, built from a portal ID and an
external record ID stored on the deal row. Neither column exists here — `ExternalSystemRecordID`
appears nowhere in this app — so there is nothing to port. Each row instead links to the deal in MJ
Explorer:

```
{ExplorerBaseUrl}/resource/record/{encodeURIComponent('MJ_BizApps_Sales: Deals')}/{dealID}
```

That is Explorer's own route (`resource/record/:entityName/:recordId`), so the link lands on the
Deal form the recipient would otherwise navigate to by hand, and it needs no CRM, no integration
mapping and no per-host URL template. It also means the digest sends people into the system of
record rather than out to a third party, which is the right default for an app that does not assume
any particular CRM is present.

The server has no way to know where Explorer is hosted, so `ExplorerBaseUrl` is an Application
Setting, read through `ApplicationSettingEngine` exactly as `HidePipelines` already is. Precedent
for the shape: orders' `RenewalPaymentLinkBaseUrl`, which declines the feature with a named reason
when the setting is blank. Here the consequence is softer — when `ExplorerBaseUrl` is unset the deal
name renders as plain text and the run records one warning, because a digest without hyperlinks is
still worth sending. The existing Sales Settings page in Explorer is where an administrator sets it.

One consequence to be aware of rather than design around: an Explorer link is only useful to a
recipient who can sign in to Explorer. A leader who works deals in a CRM and has an employee record
but no MJ login will get a link that asks them to log in. That was not true of CDP's HubSpot links.
It is the right trade for a shipped app, and it is also an argument for giving digest recipients
logins — but it is a change in who the email serves, not just how it is built.

**Sending.** Sales has no email capability today. The run uses MJ's core `Send Single Message`
action through `ActionEngineServer.RunAction` — params `To`, `From`, `Subject`, `Body`, `Provider`,
`MessageType`. Going through the registered Action rather than calling the communication engine
directly buys a row in `MJ: Action Execution Logs` per send, which is load-bearing for a tool whose
value depends on people believing the digests actually went out. The action is looked up once per
run, not once per send.

One recipient per send, each with their own first-name greeting — CDP settled this after a live
review, and the action takes a single `To` anyway. A company with two leaders gets two emails.

**The From address.** Resolution order, with no address anywhere in code or shipped metadata:

1. `DefaultSenderForCompany` from bizapps-common — the company's `CompanySenderIdentity` row with
   `Kind = 'Mailbox'` and `IsDefault`. Used for a company-scoped digest.
2. The `DigestFromAddress` Application Setting, which ships **empty**. Used for portfolio-wide
   digests, and as the fallback when a company has no default mailbox.
3. Nothing resolves → that send **fails with a recorded error and the run reports failure.**

The provider is a host's choice too, so it is not in code either. `Send Single Message` takes a
`Provider` by name, and which provider is configured (Microsoft Graph, SendGrid, Gmail) differs by host,
so the name comes from a third Application Setting, `DigestProvider`, shipped empty like the other two.
A real run with it empty stops up front with one error naming the setting, rather than failing every
send separately with the provider's own "not found"; a dry run sends nothing and does not need it. The
message type is not a setting: `Email` is MJ's base HTML-carrying type, the same on every host.

Step 3 is deliberate and matches the refusal for an employee with no email address: the failure mode
worth engineering against is a Monday where nothing arrives and nobody notices. A run that reports
failure gets looked at. This also answers, as data, the one question CDP's plan never closed — its
§8 #1 shipped a placeholder address with a note that the mailbox was unverified.

Because the sender depends on bizapps-common host data, a first install has nothing to send *from*
until someone sets either a company mailbox identity or `DigestFromAddress`, and has no provider to send
*through* until `DigestProvider` is set. That is consistent with
the job shipping `Disabled`: both have to be deliberately turned on.

**Failure isolation.** One failed send records an error against that recipient and the run continues.
A run reports success only when every attempted send succeeded.

## Validating a run before it reaches executives

CDP carried `dryRun`, `captureRenderedEmails`, three per-audience recipient overrides and a
`fromEmailOverride`, plus a local harness script — all so that a test send could not leak to the real
list. That need does not go away here, and without it the only way to check a digest is to seed
yourself as the recipient, run, then re-seed the real roster, which is exactly the sequence that ends
with a half-reverted roster mailing executives.

The scheduled job's `StartingPayload` accepts:

| Field | Effect |
|---|---|
| `dryRun` | Render everything, send nothing. Skips loading the send action, so it works where that action is not registered. |
| `captureRenderedEmails` | Return each rendered digest — recipient, From, subject, HTML — in the run payload. Always on under `dryRun`; off by default otherwise, so a normal Monday does not write megabytes of HTML into the agent-run audit record. |
| `recipientOverride` | One `{ name, email }` that **every** send is rerouted to for this run. |

`recipientOverride` is where this gets simpler than CDP. Because recipients are rows rather than
constants, there is no need for per-audience override maps: one address catches every digest the run
would produce, with the real audience and company still named in each subject, so one test run shows
you the whole Monday in your own inbox.

The render path is therefore kept separable from the send path — a structural requirement, not a
convenience, since retrofitting a dry run after the two are entangled means restructuring both.

## Where the code goes

The agent is a `@RegisterClass(BaseAgent, …)` driver class with `MaxIterationsPerRun: 1`, mirroring
CDP's shape, plus its metadata: an `MJ: AI Agents` row of type Loop, and an `MJ: Scheduled Jobs` row
of type Agent pointing at it, cron `0 0 9 * * 1`, shipped `Disabled`, `ConcurrencyMode` Skip,
`MissedRunPolicy` RunOnce.

It lands in `packages/Server` (`@mj-biz-apps/sales-server`) — my call. That package is already
server-only and already in the bootstrap path, so registration needs no new tree-shaking guard and
the host installs nothing extra. The alternative, a new published `@mj-biz-apps/sales-agents`
package, adds a seventh release artefact and a new entry in `mj-app.json` for a single class.

**One factor worth stating plainly, then proceeding:** an agent brings `@memberjunction/ai-agents`
and `ai-core-plus` into this app for the first time — no package here depends on them today, and the
repo's own precedent for scheduled work is an Action (`Sales.DetectWonDealsWithUnconfirmedOrders`),
which would need no new dependency at all. An agent was asked for explicitly, so that is what this
designs; the note exists so the cost is visible, not to reopen the choice.

## Tests

Vitest, porting the intent of CDP's suite and adding what the new model makes testable:

- Context user missing, and the send action unregistered, both terminate before any send.
- **On Hold deals appear** — the regression guard for the `IsOpen` / `IsClosed` trap above.
- `dryRun` renders every digest and calls the send action zero times; `recipientOverride` reroutes
  every send to one address while subjects still name the real audience and company.
- From-address resolution: company mailbox wins; `DigestFromAddress` covers portfolio digests; with
  neither, the send errors and the run reports failure.
- Filter construction: the open-status and excluded-pipeline ID lists are built from data; a
  snapshot pins the `ExtraFilter` shape.
- **Row-cap truncation is detected** and surfaced, not swallowed.
- Empty company → no leader send; empty portfolio audience with `SendWhenEmpty = 0` → no send, with
  `SendWhenEmpty = 1` → the all-clear copy.
- `MinDaysLapsed` honoured; `IncludeMissingCloseDate = 0` excludes never-set deals while
  `= 1` includes them.
- **A new audience row with `MinDaysLapsed = 30` produces a 30-day digest with no code change** —
  the test that proves the configurability claim.
- Recipient validation refusals: non-portfolio audience with no `CompanyID`; employee with no email.
- **Two employee records sharing one email, under the same audience and company, produce one send** —
  and a person on two *different* audiences still gets both.
- An inactive employee is not a recipient.
- One failed send does not abort the remaining sends.
- Every `RunAction` call carries a complete, non-empty param set.
- The send action is loaded exactly once per run.
- Days-lapsed arithmetic across a DST boundary in a non-UTC business zone.
- Greeting construction from an employee's first name.

## Left to the builder

- The HTML markup, within the usual constraints: table-based, inline CSS, no remote images, every
  user-originated value escaped.
- Whether `Send Single Message` needs a particular `MessageType` to render an HTML body, and which
  `Provider` value to pass — to be read off the action at implementation time.
- Column ordering, index choices, and the exact shape of the two migrations.
- Whether the Explorer forms for the new entities are generated-only or warrant a custom form.

## What the data says, measured

Read-only queries against aidp-next production on 2026-11-16, with the owner's explicit go.

**The schema fits. No column needs adding.**

- `Deal.CompanyID` is populated per company — 17 companies carry deals. `DealEntityServer` stamps it
  from the deal's pipeline, so the per-company leader digest works as designed.
- 11 of the 14 CDP leaders already exist as `MJ: Employees` rows with addresses (386 employees, none
  missing an email). So `DealDigestRecipient.EmployeeID` can stay NOT NULL and **no override-address
  column is needed** — the gap is three employee records, which is host data work, not schema.
- `Employee.CompanyID` confirms why approach B had to be rejected: the CEO, the CFO and one company
  leader are all employed by `NWHQ`, not by the companies they lead.

**Every leader has an employee record. CDP's address list is what was stale** — which is the
clearest possible argument for taking addresses from `MJ: Employees` rather than from a constant:

| CDP's constant | The actual employee record |
|---|---|
| `c.nolan@example.invalid` | `casey-nolan@example.invalid` |
| `former-arcadia-lead@example.invalid` (Arcadia) | `victor-alonso@example.invalid`, EVP Consulting Services at Northwind Consulting — and he covers Arcadia *and* Northwind Consulting |
| `former-ad@signal.example` | `sana-oyelaran@example.invalid`, Account Director, signal.example |

Had this shipped as code, three of fifteen weekly emails would have been bouncing into a void with
nobody the wiser. Rows in a table that an administrator can see and fix are the point.

**One person legitimately has several employee records, one per company.** Lena Petrov has three
active rows (`lena.petrov@example.invalid` at Junction Labs, `lena-petrov@example.invalid` at Lumen Teams,
`lena.petrov@example.invalid` at NWHQ); Rowan Vale has two (Clearwave and Trailhead). The recipient
model handles this naturally — Junction Labs's leader row points at the Junction Labs employee row — and it is
also what made approach B look briefly plausible. **Design consequence:** a single rendered digest
must be deduplicated by email address before sending, because two employee records for one human
under the same audience and company would otherwise mail them twice. Deduplication is *within* one
digest only — Imani Clarke receiving both the Northwind Group leader digest and the CEO digest is
deliberate, as it was at CDP.

**Still outstanding, and host data rather than code:**

1. **There are zero `CompanySenderIdentity` rows in production.** Step 1 of From-address resolution
   resolves nothing today, so by this design's own rule every send would fail. The
   `DigestFromAddress` Application Setting must be set, or mailbox identities created, before the job
   is enabled. This is the single most likely cause of a silent-but-for-the-error-log first Monday.
2. **Felix Hartmann (signal.example, `Title = CEO`) has `Active = 0`.** Recipients filter on an active
   employee, so signal.example has no leader until that is resolved. Moot for the 23rd — signal.example has nothing
   lapsed.
3. **Two active employees hold `Chief Financial Officer`:** Dana Whitfield (`dana-whitfield@example.invalid`,
   CDP's CFO) and Priya Raman (`priya-raman@example.invalid`). The `CFO` audience needs to know which,
   or both.
4. **Two test logins carry leadership titles** — `test-login+ceo@example.invalid` ("CEO Test")
   and `test-login+ad@example.invalid`. Seeding recipients by title would mail them. Seed by
   named employee, never by a title query.

For reference, the CTO audience the owner asked for resolves to Jordan Reyes, `Chief Technology
Officer`. CDP achieved roughly this by CC'ing him on the CFO digest from a hardcoded constant; a
`CTO` audience row is the same outcome as data.

**What Monday 23 November would actually contain**, run against the live filter:

| | Deals |
|---|---|
| Northwind Consulting | 4 (2 with no close date, 2 newly past) |
| Pebble Bot | 2 (both with no close date) |
| Everything else | 0 |
| **Deals more than 14 days past** | **0** |

So: two leader digests, and the CEO, CFO and CTO digests carrying the four never-set-close-date deals
(which bypass the 14-day floor by design). Nothing is empty, so the CTO's new `SendWhenEmpty = 0`
does not suppress anything on the first run.

That is a very small first digest, and it is worth knowing why rather than being surprised: of 9,918
deals, only 157 are open, and **every open deal's close date is in the future** — the earliest is
17 November. The portfolio is clean right now. The volume CDP used to report came from pipelines that
are now all Won or Lost. This does not argue against building it; it argues that the first few runs
will be quiet and that a near-empty digest is the correct output, not a bug to chase.

## The one decision left: how this reaches production by the 23rd

There is a tension between "implement in bizapps-sales" and "email goes out Monday the 23rd", and it
is mine to surface rather than resolve quietly.

bizapps-sales is a published app. For anything built here to send a real email on the 23rd it must
travel: PR into `next` → a sales release (version packages, and **one consolidated Metadata_Sync
generated by the build engineer from a clean database**) → aidp-next bumps its `@mj-biz-apps/sales-*`
pins from 6.31.0 → lockfile closure and PR to `stage` → MJ Setup on the test server → verification →
promotion PR `stage` → `prod` → MJ Setup on production → seed recipients and the three missing
employees → set the From address → enable the job → restart MJAPI, because the scheduler does not pick
up job rows written out of process.

That is seven days, spanning two MJ Setups, a release cut by another person, and a production
promotion on a fixed date. It is possible and it is tight, and the tightness is all in the release
train rather than in the code.

Worth noting: approach C would **not** meaningfully help. C removes the migration and the CodeGen
step, but the agent code still has to reach production by the same release path, so C buys a day of
schema work and none of the train. The genuine alternative, if the date is firm, is to build the
digest in aidp-next itself for the 23rd — it deploys through its own workflow with no npm release and
no pin bump, and `sales-entities` is already installed there — and then port it to bizapps-sales
properly without a deadline. That trades throwaway work for certainty about Monday.

This is a sequencing call for the owner, recorded here as open.

## Decisions taken 2026-11-16, and the roster they produce

- **CFO** is Dana Whitfield. Priya Raman's identical title is not seeded.
- **Felix Hartmann is left out** entirely; his inactive record is not to be reactivated for this.
- **Owen Mbeki leads both signal.example and Junction Labs.** Worth noting why this is expressible at all: his
  only employee record sits at `NWHQ`, so `CompanyID` has to live on the recipient row rather than be
  derived from the employee. This single requirement is what ruled out approach B, and it is now a
  live case rather than a hypothetical one.
- **Account Directors are not Company Leaders.** Sana Oyelaran (signal.example), Lena Petrov (Lumen Teams)
  and Harriet Lowe (signal.example) are therefore not seeded as leaders, which drops two names CDP
  carried.

Seed roster, to be created as `DealDigestRecipient` rows by hand on the host — not shipped:

| Audience | Company | Employee |
|---|---|---|
| `COMPANY_LEADER` | Pebble Bot | Casey Nolan `casey-nolan@example.invalid`; Imani Dorsey `imani-dorsey@example.invalid` |
| `COMPANY_LEADER` | Arcadia | Victor Alonso `victor-alonso@example.invalid` |
| `COMPANY_LEADER` | signal.example | Owen Mbeki |
| `COMPANY_LEADER` | Junction Labs | Owen Mbeki |
| `COMPANY_LEADER` | Mira | Theo Marsh `theo-marsh@example.invalid` |
| `COMPANY_LEADER` | Harbor | Tomas Berg `tomas-berg@example.invalid` |
| `COMPANY_LEADER` | Lumen Teams | Nadia Prasad; Theo Marsh `theo-marsh@example.invalid` |
| `COMPANY_LEADER` | Clearwave | Rowan Vale `rowan-vale@example.invalid` |
| `CEO` | — | Imani Clarke |
| `CFO` | — | Dana Whitfield |
| `CTO` | — | Jordan Reyes |

**Still unseeded, and needing a decision:** Northwind Consulting, which CDP called "Northwind Group"
and gave Imani Clarke and Owen Mbeki, and where Victor Alonso is now EVP Consulting Services. It
holds 51 open deals and is one of only two companies with anything lapsed on the 23rd, so it cannot
be left out. `MemberJunction` (2 open deals) and `NWHQ` (1) also have no leader in CDP's roster.

## Production readiness, measured 2026-11-16

**There is no version gap.** Production is current with the repository on every axis the digest
touches, so nothing needs upgrading to make room for it:

| | Deployed in prod | Repo / required |
|---|---|---|
| bizapps-sales schema | `v6.31.x` Metadata Sync, applied 13 Nov | aidp-next pins `6.31.0`; `next` is `6.31.0` |
| bizapps-common schema | `v5.66.x`, applied 13 Nov | aidp-next pins `^5.66.0` |
| MJ core | MJ Setup run 13–14 Nov | `@memberjunction/cli` `6.2.1`; `mjVersionRange >=6.2.1 <7.0.0` |
| `Agent` scheduled-job type | present | required |
| AI agents already running | 95 | — |
| `BizApps.BusinessTimeZone` | `America/Chicago` / Central Standard Time | required by the day math |

The only version difference is forward-looking: the digest needs a bizapps-sales release that does
not exist yet (6.32.0). Nothing deployed is behind.

**But there is no outbound mail path.** This is the real blocker, and it is bigger than the sender
row it looks like:

- All four communication providers — Microsoft Graph, SendGrid, Gmail, Twilio — are `Active` with
  **`DefaultCredentialID` NULL**, and there is no mail credential of any kind in `MJ: Credentials`
  (only HubSpot keys, Stripe, Teams webhooks and ad platforms).
- `__mj_BizAppsCommon.CompanySenderIdentity` has **zero rows**.
- CDP did not rely on any of this: it carried its own Azure app registration in
  `NOTIFICATIONS_AZURE_*` and its own `SendEmailMS` action, neither of which exists here.

Graph *may* still be configured through the box environment (`MJAPI_APP_ENV_PROD` or `operator.env`),
which is not readable from a laptop. That needs confirming before anything is promised for a date.
Either way the work is Azure AD and secrets, outside both repositories, and it sits on the critical
path ahead of any code.

**One more thing that shapes what the digest would report:** all twelve HubSpot integration syncs in
production are `Paused` (eleven) or `Disabled` (one). Deal data is therefore static. The finding that
every open deal's close date is still in the future may itself be an artifact of a sync that stopped,
rather than a genuinely clean pipeline — and a digest built to nag about stale close dates reporting
on a stalled feed is worth knowing about before it goes to the CEO.

## Correction to the timezone note above

The earlier framing — that CDP's Eastern cron and Central date arithmetic were a latent bug — is too
strong, and the production setting clarifies it. Delivery time and business day are two legitimate,
independent choices: firing at 09:00 `America/New_York` is about when the mail lands, while judging
"lapsed" in `America/Chicago` is about which calendar day a date belongs to. CDP's actual fault was
that neither was stated, so the two looked like one inconsistent decision. Here both are explicit: the
scheduled job's `Timezone` governs when it fires, and `BizApps.BusinessTimeZone` governs every date
comparison. Keeping the cron at 09:00 Eastern reproduces CDP's delivery habit, and the Central
business zone reproduces its arithmetic exactly.

## Sender resolved

The From address is **`notifications@example.invalid`, display name "BC Notifications"** — the address
CDP's plan proposed and never verified.

`CompanySenderIdentity` rows are seeded by aidp-next
[PR #307](https://github.com/BlueCypress/aidp-next/pull/307): one `Kind='Mailbox'`, `IsDefault` row
per company for the eleven companies that either have a seeded digest leader or currently have open
deals. `CompanyID` uses `@lookup` rather than a UUID there, because the rows push to the test server
as well as production and a company's ID is not guaranteed to match across the two — a hardcoded ID
would either fail to resolve or silently attach the identity to the wrong company.

With those rows in place, step 1 of From-address resolution works and the `DigestFromAddress`
Application Setting is needed only for portfolio-wide digests, which have no company to resolve
against. It should be set to the same address.

**What is still not done:** mail does not work yet. No MJ communication provider has a
`DefaultCredentialID` and there is no mail credential at all, so Microsoft Graph must still be
credentialed and authorized to send as this mailbox. A sender-identity row records an address; it
does not grant the right to send from it. That work is Azure AD and secrets, outside both
repositories, and it remains first on the critical path.
