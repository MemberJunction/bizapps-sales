# Outlook → Activities integration — plan for review

**Status:** for review, before any coding. **Audience:** Amith, Robert, Andrew.
**Author:** Josue (Sales). **Scope:** email messages **and** calendar meetings → Activity records on the
deal / contact timeline.

Every platform claim below was checked against the code in `C:\Dev\MJ\MJ`, `bizapps-common` and the
sibling apps. Where MJ does not provide something, it says so.

---

## 1. Purpose

Reps live in Outlook, not the CRM. The deal timeline is blind to what actually moved the deal. This
captures emails and meetings automatically as **Activity** records linked to the deal and its contacts,
so the timeline reflects reality without manual logging. Master plan §11 already names this
("MJ Communication … → `Activity` rows linked to contact, account and open deals. The timeline populates
itself.") and §8 assumes an activity timeline in the deal workspace and the account/contact 360.

## 2. The decision this needs FIRST — the Activity spine ⚑

**There is no Activity spine anywhere.** Verified three ways:

- `bizapps-common` ships `Address`, `AddressLink`, `AddressType`, `ContactMethod`, `ContactType`,
  `Organization`, `OrganizationType`, `Person`, `Relationship`, `RelationshipType` — **no Activity tables**.
- **MJ core has no `Activity` table either.**
- The sales master plan repeatedly cites a *"`bizapps-common` Activity spine plan"* (§4, §3.2, and the
  `UQ_Activity_Source` index). **That document does not exist on disk** — `grep -rl "Activity spine"`
  across every repo matches only bizapps-sales' own `CLAUDE.md` and `README.md`.

So the spine is not merely unbuilt; **the plan it is supposed to follow is missing too.** Nothing can
create "Activity records" until this is resolved, and it is not Sales' call alone — an activity is
inherently cross-app.

| Option | Meaning | Trade-off |
|---|---|---|
| **A — build the spine in `bizapps-common`** *(recommended)* | `Activity` / `ActivityType` / `ActivityLink` live in common | Right home for cross-app history. Needs an owner, a date, **and the missing plan written or reconstructed** |
| **B — local `SalesActivity`** | Sales owns a table now | Fast, but activities are *historical data*: if common later ships the spine, migrating history across schemas and rewriting every FK is far worse than a normal wrong call |
| **C — wait** | Nothing until common acts | Zero risk, blocks the feature entirely |

**Recommendation: A, unchanged** — and now with a sharper ask, because the referenced plan is missing:
name an owner, a date, **and confirm whether that plan ever existed** (if it did, it should be recovered
rather than rewritten from the master plan's citations).

**What the spine should mirror, if built.** Three existing patterns already solve its hard parts, and
reusing them costs nothing:

- **Polymorphic linking** — `bizapps-common`'s `AddressLink` (`AddressID` + `EntityID` + `RecordID` +
  `AddressTypeID` + `IsPrimary`) and MJ core's `MJ: Tagged Items` both use the `EntityID` + `RecordID`
  pair. `ActivityLink` should look the same rather than invent a third shape.
- **Original timestamps** — sales' `DealStageEvent.ChangedAt` exists as a real column precisely so an
  import can preserve history instead of stamping insert time. `ActivityDate` needs the same treatment,
  which the master plan §12 already calls a non-negotiable.
- **Re-runnable ingest** — the master plan's `UQ_Activity_Source` idea matches the filtered-unique-index
  pattern this repo now uses (`WHERE <col> IS NOT NULL`), so a re-run is safe and unnumbered rows do not
  collide.

## 3. Architecture

```
Outlook (Graph)  →  MSGraphProvider.GetMessages(mailbox)     [MJ, exists]
   →  hourly MJ Scheduled Job                                 [MJ, exists]
   →  per item: relevance filter → sensitivity prompt         [MJ prompt runner, exists]
   →  Activity + ActivityLink (→ Deal / Person) + tags        [spine MISSING; tags exist]
```

**Confirmed.** MJ ships a Microsoft Graph provider:
`packages/Communication/providers/MSGraph/src/MSGraphProvider.ts`, registered as
`@RegisterClass(BaseCommunicationProvider, 'Microsoft Graph')`. It implements `GetMessages`,
`SendSingleMessage`, `ReplyToMessage`, `ForwardMessage` against the contract in
`packages/Communication/base-types/src/BaseProvider.ts`.

`GetMessages(params: GetMessagesParams)` takes `Identifier` (**the mailbox address**), `NumMessages`,
`UnreadOnly`, `IncludeHeaders`, and `ContextData.Filter` (a raw OData `$filter`). It returns `From`,
`To`, `ReplyTo`, `Subject`, `Body`, `ThreadID`, `ExternalSystemRecordID`, `ReceivedAt`/`SentAt`, plus the
raw `SourceData`. **The mailbox being a parameter is what makes the single-inbox pilot in §5 native
rather than a workaround.**

**Three corrections to the draft:**

1. **No calendar support.** The provider is messages-only — there is no `/events` call anywhere in it.
   Meetings (draft P2) require **extending `MSGraphProvider` or a separate Graph call**, and that work is
   not currently costed. It is real work, not configuration.
2. **No polling loop and no webhooks.** `GetMessages` is a pull. Incremental reads are expressible as
   `ContextData.Filter = "receivedDateTime gt <watermark>"`, but **we own the watermark** — that is a
   small table or setting on our side, not something MJ tracks.
3. **`ThreadID` and `ExternalSystemRecordID` come back for free**, which is what makes the ingest
   idempotent (the `UQ_Activity_Source` idea in §2).

**The hourly poll is a first-class MJ mechanism.** `SchedulingEngine`
(`packages/Scheduling/engine/src/ScheduledJobEngine.ts`) drives the entities `MJ: Scheduled Jobs`,
`MJ: Scheduled Job Runs`, `MJ: Scheduled Job Types`, with `CronExpression`, `Timezone` and `NextRunAt`,
and pluggable drivers in `packages/Scheduling/engine/src/drivers/` (`ActionScheduledJobDriver`,
`AgentScheduledJobDriver`). **No external cron is needed.** (An older `ScheduledActionEngine` also exists
at `packages/Actions/ScheduledActions/src/scheduler.ts`; the Scheduled Jobs engine is the newer one and
is what MJAPI runs at startup.)

**Prior art: none for reading.** Only `bizapps-orders` touches MJ Communication —
`packages/CoreEntitiesServer/src/EmailDeliveryChannel.ts` calls
`CommunicationEngine.Instance.SendSingleMessage`. It is **send-only**. Sales would be the **first**
consumer of `GetMessages` in the family, so budget for being the ones who find its rough edges.

## 4. Relevance filter (what we capture at all)

Unchanged and still the right rule: capture an item **only if a participant's external address matches a
known Contact**, never by domain and never "everything in the inbox." Meetings match attendees the same
way. This is ours to implement — MJ has no such filter — and it runs **before** any LLM call, so personal
mail never reaches a model.

## 5. Security model

The credential is the highest-risk part, and the code confirms why. `providers/MSGraph/src/auth.ts` uses
`ClientSecretCredential` (`@azure/identity`) with scope `https://graph.microsoft.com/.default`, driven by
`AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_CLIENT_SECRET` / `AZURE_ACCOUNT_EMAIL`
(`providers/MSGraph/src/config.ts`). That is **app-only authentication with application permissions** —
`Mail.Read` granted this way is **tenant-wide**, exactly Amith's concern, and no amount of MJ-side code
narrows it.

- **The real lever is Graph-side, not MJ-side:** an Exchange Online **Application Access Policy** scopes
  the app registration to a mail-enabled security group. That is what actually enforces "this app may
  read only these mailboxes." **This should be a launch precondition, not a hardening step.**
- **Server-side only** — the credential lives in server env; nothing reaches the browser.
- **Scoped ramp** — single pilot mailbox → sales-role mailboxes → active deals' counterparties. The
  security-group membership is the enforcement; the `Identifier` parameter is the code-level expression
  of it.
- **RLS on Activity — real, but with a caveat.** `MJ: Row Level Security Filters` is a genuine feature:
  `RowLevelSecurityFilterInfo` (`packages/MJCore/src/generic/securityInfo.ts:332`) carries a `FilterText`
  SQL fragment with `{{UserField}}` token substitution and per-platform variants. **But MJ has no
  hierarchy primitive** — "a manager sees their reports'" must be written as SQL inside `FilterText`
  (a recursive CTE or `EXISTS` over a supervisor relationship). Feasible; not free, and not declarative.
  See open question 6 — I could not confirm the org chart exists as data.

## 6. Sensitivity filter

**Confirmed available, agent-free.** `AIPromptRunner.ExecutePrompt<T>(params: AIPromptParams)`
(`packages/AI/Prompts/src/AIPromptRunner.ts:660`) is the classical runner. `AIPromptParams`
(`packages/AI/CorePlus/src/prompt.types.ts:354`) takes `prompt`, `data`, `templateData`,
`configurationId`, `contextUser` and `cancellationToken`; **`agentRunId` is optional**, which is what
makes it usable without the agent stack. Child prompts execute in parallel, which covers bulk backfill.

- **Model pinning is metadata, not code** — `MJ: AI Prompt Models` binds a prompt to a model
  (`PromptID` → `ModelID`), so the model is a metadata row and swapping it needs no deploy.
- **The model receives the email body**, so *which* model runs this — and whether that keeps content
  inside the Microsoft/Azure boundary the mail already lives in — is a decision in its own right. See
  **open question 8**.
- **Correction on the return value:** the draft says "returns a 0–1 sensitivity score". The runner
  returns a typed result shaped by the prompt's `OutputExample` and validated against it — so we get a
  small **JSON object** (score + tags + reason), not a bare float. That is better for us: one call can
  return the score *and* the tags, which the draft already wanted.
- Thresholds and the review queue are unchanged from the draft (≥ 0.90 auto-accept; below → restricted
  queue, never the shared timeline). The threshold itself stays an open question.

**Tags are richer than assumed.** MJ ships `MJ: Tags`, `MJ: Tagged Items` (polymorphic, the same
`EntityID` + `RecordID` shape as `ActivityLink` should use), plus `Tag Scopes`, `Tag Synonyms`,
`Tag Suggestions`, `Tag Co Occurrences` and `Tag Audit Logs`, with an Angular component at
`packages/Angular/Generic/record-tags`. Auto-tagging writes `Tagged Items` — no new tagging concept
needed, and `Tag Audit Logs` gives the provenance an auditor will ask for.

## 7. Data model touch points

`Activity`, `ActivityType`, `ActivityLink` (spine — **missing**, §2) · `MJ: Tags` + `MJ: Tagged Items`
(exist) · a review-queue table for sub-threshold items (ours) · a **poll watermark** per mailbox (ours,
new — see §3 correction 2). Store metadata + a reference by default; bodies are open question 3.

## 8. Phasing

- **P0 — Activity spine decision + build.** Blocking (§2). Also: recover or rewrite the missing plan.
- **P0.5 — Application Access Policy** on the Graph app registration. Precondition for touching a real
  mailbox at all.
- **P1 — single-inbox pilot:** email only, known-contact relevance filter, sensitivity gate + review
  queue, links to deal/contact. Uses `GetMessages` + a Scheduled Job as-is.
- **P2 — expand:** sales-role mailboxes; **calendar meetings — includes extending the Graph provider**
  (§3 correction 1), which is the largest un-costed item in this plan.
- **P3 — hardening:** org-chart RLS filter, tag tuning, backfill at scale.

## 9. Open questions for the team

1. **Activity spine home, owner, date — and does the referenced common plan exist?** (§2) — Amith/Robert.
2. **Sensitivity threshold** (0.90?) and sub-threshold policy: review queue vs discard.
3. **Retention:** store email **bodies**, or metadata + link only? For how long?
4. **Consent/notice** to reps, and to customers, that mail and meetings are captured.
5. **Pilot mailbox:** whose, and for how long, before widening.
6. **Does the org chart exist as data?** The RLS hierarchy in §5 needs a supervisor relationship to walk.
   I could not verify `Employee.SupervisorID` — the sales dev database was unreachable at the time of
   writing. If it does not exist, "manager sees reports'" needs a source of truth before it can be a
   filter.
7. **Who owns extending `MSGraphProvider` for calendar** — sales, or MJ core as a platform contribution?
   It is provider-level code, so a core contribution likely serves everyone better.
8. **Which model runs the sensitivity filter?** The filter sends email bodies to the scoring model, so
   the choice carries a data-residency dimension worth deciding explicitly. Two viable options:
   **Gemini Flash-Lite** (Amith's suggestion) — very fast, cheap, high throughput (~10M tokens/min via
   Google), with email content processed by an external provider; or an **in-tenant / Azure-hosted
   model** — content stays inside the Microsoft/Azure boundary the mail already lives in, throughput and
   cost to be assessed. Both are workable; the security/residency call is Amith's and Robert's.

## 10. Explicitly NOT in this phase

Outbound email, two-way sync, thread reconstruction, attachment ingestion. One-directional capture only.

---

## Platform grounding

The MJ mechanisms this plan relies on, so a reviewer can confirm each is real.

| Capability | Status | Where |
|---|---|---|
| Outlook / Graph provider | **exists** | `packages/Communication/providers/MSGraph/src/MSGraphProvider.ts` — `@RegisterClass(BaseCommunicationProvider, 'Microsoft Graph')` |
| Inbound reading contract | **exists** | `BaseCommunicationProvider.GetMessages(GetMessagesParams)` — `packages/Communication/base-types/src/BaseProvider.ts` |
| Per-mailbox targeting | **exists** | `GetMessagesParams.Identifier` → Graph path `/{email}/messages` |
| Incremental filter | **exists (raw OData)** | `GetMessagesParams.ContextData.Filter` |
| Calendar / meetings | **MISSING** | no `/events` in the provider — needs extension |
| Webhooks / push | **MISSING** | pull only |
| Poll watermark | **MISSING (ours)** | not tracked by MJ |
| Graph auth | **exists** | `providers/MSGraph/src/auth.ts` (`ClientSecretCredential`, `/.default`), `config.ts` (env vars) |
| Mailbox least-privilege | **Graph-side** | Exchange **Application Access Policy** — outside MJ |
| Hourly scheduling | **exists** | `SchedulingEngine` — `packages/Scheduling/engine/src/ScheduledJobEngine.ts`; `MJ: Scheduled Jobs` (+ Runs, Types); drivers in `engine/src/drivers/` |
| Agent-free prompt runner | **exists** | `AIPromptRunner.ExecutePrompt<T>` — `packages/AI/Prompts/src/AIPromptRunner.ts:660`; `AIPromptParams` — `packages/AI/CorePlus/src/prompt.types.ts:354` (`agentRunId` optional) |
| Model pinning | **exists (metadata)** | `MJ: AI Prompt Models` (`PromptID` → `ModelID`) |
| Structured output | **exists** | prompt `OutputExample` drives + validates shape (not a bare scalar) |
| Row-Level Security | **exists** | `MJ: Row Level Security Filters`; `RowLevelSecurityFilterInfo` — `packages/MJCore/src/generic/securityInfo.ts:332` (`FilterText` + `{{UserField}}` tokens + platform variants) |
| Org-chart hierarchy in RLS | **not a primitive** | must be SQL inside `FilterText` |
| Tagging | **exists** | `MJ: Tags`, `MJ: Tagged Items`, `Tag Scopes/Synonyms/Suggestions/Co Occurrences/Audit Logs`; UI `packages/Angular/Generic/record-tags` |
| Activity spine | **MISSING everywhere** | not in `bizapps-common`, not in MJ core; referenced plan not on disk |
| Prior art for reading | **none** | orders' `EmailDeliveryChannel.ts` is send-only |
