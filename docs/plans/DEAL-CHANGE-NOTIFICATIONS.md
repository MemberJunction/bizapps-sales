# Deal-team change notifications — implementation plan

| | |
|---|---|
| **Status** | Proposed. Not built. |
| **When** | **After AIDP go-live.** Not on the go-live path; nothing here changes how a deal saves, closes or prices today. |
| **Owner** | Boston Gunderson |
| **Asked for by** | Amith (the feature), Johanna (the triggers, and the global → deal type → contributor type configuration) |
| **MJ line** | Everything here exists on the 6.1 LTS line this repo pins (`@memberjunction/notifications@6.1.5` is already in `pnpm-lock.yaml`). |

## 1. What this is

When a deal changes in a way that matters, everyone contributing to it hears about it: the AE, the
SE, the SDR, the executive sponsor, the partner manager, the CS lead. Which changes matter, who hears
about each one, and what the message says are all **configuration**, not code:

- set **globally** for bizapps-sales,
- **overridable per deal type** (an Enterprise deal and a Renewal do not care about the same things),
- and **narrowable per contributor type** (an executive sponsor wants big swings, not every edit).

The message wording is **metadata-driven MJ Templates**, global with a per-deal-type override, so a
template change is a data change and never a release.

Delivery is MJ core's, not ours: `NotificationEngine` writes the in-app notification behind
Explorer's bell, sends the email, and honours each user's own channel preferences.

## 2. What already exists — do not rebuild

### In this repo

| Piece | Where | Used for |
|---|---|---|
| The contributor roster | `DealTeamMember` (`migrations/V202608042101__v0.1.x__Tables_and_Objects.sql:1121`): `DealID`, `EmployeeID` xor `PersonID`, `DealRoleID`, `IsActive`, `StartDate`, `EndDate` | Who is on the deal |
| Contributor types | `DealRole` (`:204`), seeded in `metadata/deal-roles/` (Owner/AE, SE, SDR, Executive Sponsor, Partner Manager, CS Lead) | The audience matrix |
| Deal types | `DealType` (`:169`) | The per-deal-type override key |
| Stage, close and reopen provenance | `DealStageEvent`, appended by `DealEntityServer.appendStageEvent()` (`packages/CoreEntitiesServer/src/DealEntityServer.ts`) inside the save's transaction, with the original `ChangedAt` preserved for imports | The stage / won / lost / reopened triggers |
| Notes and activities on a deal | An `ActivityLink` row pointing at the deal, written by `ActivityWriterService` (logged in the workspace) and `DealLinkerExtension` (synced email and meetings) | The activity trigger |
| Status meaning | `DealStatusType.IsWon` / `IsLost` / `LocksDeal` | Won, lost and reopened — read by flag, never by name |

### In MJ core (6.1.5)

| Piece | Where | Used for |
|---|---|---|
| `NotificationEngine.SendNotification({ userId, typeNameOrId, title, message, resourceTypeId, resourceRecordId, resourceConfiguration, templateData, allowedDeliveryChannels })` | `packages/Communication/notifications/src/NotificationEngine.ts` | All delivery |
| `MJ: User Notification Types` (`DefaultInApp`, `DefaultEmail`, `AllowUserPreference`, `EmailTemplateID`, `Icon`, `Priority`) and `MJ: User Notification Preferences` (per user, per type, per channel) | Explorer → Settings → Notifications already edits the preferences | Channel choice per user |
| `MJ: Templates`, `MJ: Template Contents` (typed `Text` / `HTML`, with `Priority`), `MJ: Template Params`; `TemplateEngineServer.RenderTemplate(template, content, data)` (Nunjucks, sandboxed) | `packages/Templates/engine/src/TemplateEngine.ts`; seeded as metadata the way `metadata/templates/.agent-completion-email-template.json` is in MJ | Message wording |
| Entity Actions: after-save triggers declared in metadata, with `EntityChangeContext` (`OldValues`, `NewValues`, `DidFieldChange`) filters and `RunMode = 'Durable'` | `packages/Actions/Base/src/EntityChangeContext.ts`, `DurableEntityActionSubmitter.ts`; migration `V202608081200__v6.1.x__Durable_EntityAction_Dispatch.sql` | Capturing changes off the save path |
| Scheduled jobs (`BaseScheduledJob`, `MJ: Scheduled Job Types`, `MJ: Scheduled Jobs`) | `packages/Scheduling/engine` | The dispatcher |

### Not in MJ core — do not wait for it

- **Digests / batching.** Nothing. This plan coalesces in the dispatcher (§6).
- **Follow / watch a record.** Nothing. Phase 2 adds a sales-side follower table.
- **Scoped notification configs** (`MJ: Scoped Notification Configs`) are **6.2 only**. Revisit when AIDP
  moves to 6.2; they could carry the per-deal-type *channel* rules.

### Do not copy

`bizapps-tasks` and `bizapps-committees` write `MJ: User Notifications` rows by hand
(`GetEntityObject<any>`, `.Set('Title', …)`), with no notification type and no user preferences. Use
`NotificationEngine`.

## 3. Triggers

A new type table, **`DealChangeType`**, seeded under `metadata/deal-change-types/`, addressed by
`Code` (the same "sales owns the row, the code names it" ruling `CloseWonTaskService` uses for task
types). The classifier emits codes; it never compares a stage or status name.

| Code | Fires when | Captured from | Default threshold |
|---|---|---|---|
| `STAGE_CHANGED` | The deal moves stage | `DealStageEvent` created, not a close or reopen | — |
| `CLOSED_WON` | Status moves to one with `IsWon = 1` | `DealStageEvent` created; `ToDealStatusTypeID` flags | — |
| `CLOSED_LOST` | Status moves to one with `IsLost = 1` | same | — |
| `REOPENED` | Status moves out of a `LocksDeal = 1` status | same | — |
| `AMOUNT_CHANGED` | `Amount` changes by at least the threshold | `Deal` updated, `DidFieldChange('Amount')` | 10% |
| `CLOSE_DATE_CHANGED` | `ExpectedCloseDate` moves by at least the threshold | `Deal` updated, `DidFieldChange('ExpectedCloseDate')` | 7 days |
| `ACTIVITY_LOGGED` | A note, call or meeting is logged against the deal | `ActivityLink` created to the deal, `Activity.Source = 'Manual'` | — |
| `TEAM_ADDED` | Someone is added to the deal team (they are told personally) | `DealTeamMember` created | — |

Phase 2: `ACTIVITY_SYNCED` (`Source = 'Integration'`; noisy, so off by default), `ARR_CHANGED`,
`OWNER_CHANGED`, `FORECAST_CATEGORY_CHANGED`.

## 4. Configuration — four layers, one question each

Splitting the configuration by the question it answers is what keeps precedence unambiguous. Each
layer is resolved by a **pure function in `sales-entities`**, so the server dispatches with it and a
future settings screen can preview with the same code.

### 4.1 Is this change material? — global, then deal type

- **Global:** columns on `DealChangeType`: `IsEnabled`, `ThresholdPct`, `ThresholdDays`.
- **Per deal type:** **`DealTypeChangeSetting`** (`DealTypeID`, `DealChangeTypeID`) with
  `IsEnabledOverride`, `ThresholdPctOverride`, `ThresholdDaysOverride`. **NULL means "use the global
  value"**, column by column, the same contract `Deal.AnnualIncreasePctOverride` already uses.
- A deal with no `DealTypeID` uses the global row.
- Example: amount ±10% globally, ±5% on Enterprise New Business, `ACTIVITY_LOGGED` off for Renewals.

If the change is not material, no event is written at all.

### 4.2 Which contributor types hear it? — global, then deal type, narrowed by role

- **`DealRoleChangeSubscription`** (`DealRoleID`, `DealChangeTypeID`, `DealTypeID` **NULL = global**):
  `IsSubscribed`, `MinThresholdPct`, `MinThresholdDays`.
- A row for the deal's type wins over the global row for that role and change type. No row means not
  subscribed.
- **A role's own threshold can only raise the bar, never lower it.** A change reaches a role when it is
  material (4.1) *and* its measured size is at least the role's minimum. That is the rule that lets
  "per contributor type" and "per deal type" coexist without either overriding the other.
- Someone holding two roles on one deal gets the union of both, and one notification.

Seeded global matrix (● = subscribed; all of it is data a deployment edits):

| | Owner/AE | SE | SDR | Exec Sponsor | Partner Mgr | CS Lead |
|---|---|---|---|---|---|---|
| Stage changed | ● | ● | ● | | ● | |
| Closed won | ● | ● | ● | ● | ● | ● |
| Closed lost | ● | ● | ● | ● | ● | |
| Reopened | ● | ● | | ● | ● | ● |
| Amount (≥10%) | ● | ● | | ● (min 25%) | ● | |
| Close date (≥7 days) | ● | ● | | ● | | ● |
| Note/activity logged | ● | ● | | | ● | |
| Added to the team | the person added, always — not a matrix row | | | | | |

### 4.3 What does the message say? — MJ Templates, global then deal type

See §5.

### 4.4 Which channel? — the user's own choice

Not ours. Each `DealChangeType` points at an **`MJ: User Notification Type`**; several change types share
one, so a user sets four preferences, not eight. Seeded by this repo under `metadata/notification-types/`:

| MJ notification type | Change types | Default |
|---|---|---|
| `Sales: Deal Status` | stage, won, lost, reopened | In-app + email |
| `Sales: Deal Value & Dates` | amount, close date | In-app + email |
| `Sales: Deal Activity` | activity logged | In-app |
| `Sales: Deal Team` | added to the team | In-app + email |

`AllowUserPreference = 1` on all four, so each user can turn a channel on or off, or mute the type, in
Explorer's existing notification settings.

## 5. Message templates (MJ Templates engine)

### 5.1 Model

Templates are ordinary **`MJ: Templates`** rows, authored and edited with MJ's template tooling.
Shipped defaults are seeded as metadata in `metadata/templates/`, each template file pointing at its
content with `@file:`, the pattern MJ uses for its own notification templates.

Each notification type has a **template set** of two templates:

| Part | MJ Template content | Used for |
|---|---|---|
| **Title** | one `Text` content | The in-app title and the email subject |
| **Body** | a `Text` content **and** an `HTML` content | `Text` → the in-app message; `HTML` → the email body |

A body template carrying both a `Text` and an `HTML` content is the shape MJ's own
`ProcessedMessage` already expects (`GetHighestPriorityContent('Text' | 'HTML')`), so nothing about
it is sales-specific.

**`DealNotificationTemplate`** binds a template set to a notification type, globally or for one deal
type:

| Column | |
|---|---|
| `NotificationTypeID` | FK `__mj.UserNotificationType`, NOT NULL |
| `DealTypeID` | FK `DealType`, **NULL = the global set** |
| `TitleTemplateID` | FK `__mj.Template`, NULL on an override row = inherit the global title |
| `BodyTemplateID` | FK `__mj.Template`, NULL on an override row = inherit the global body |

Rules:

- Exactly one global row per notification type, and it must set both templates (validated in the
  entity subclass; the CHECK constraint cannot see sibling rows).
- At most one row per notification type and deal type. Two filtered unique indexes, not UNIQUE
  constraints, for the reason the baseline's "NULLABLE UNIQUENESS" block gives.
- Resolution, per part: the deal type's row if it sets that part, else the global row.

So a Renewal deal type can replace just the email body and keep the global title.

### 5.2 The data a template receives

One versioned contract, built by the dispatcher, **plain JSON only**. The Nunjucks sandbox restricts
member access on non-plain values, and a `BaseEntity` would not spread anyway. Declare it as
`MJ: Template Params` on each shipped template so the template editor documents it.

```text
deal:      { Name, DealNumber, Url, DealType, Pipeline, Stage, Account, AmountDisplay, ExpectedCloseDateDisplay }
actor:     { Name }                         -- who made the change(s)
recipient: { FirstName, Roles[] }           -- the role names they hold on this deal
changes:   [ { Code, Label, Kind, Before, After, Note, ChangedAtDisplay } ]
            -- Kind: 'Value' | 'Event' | 'Activity' | 'Team' (structural, for layout)
schemaVersion: 1
```

- Money arrives as **display strings** formatted from orders' figures. Templates never do arithmetic
  (rule 1 — sales never computes money).
- `Before` / `After` are display strings the classifier produced, so a template never formats a date or a
  currency itself.
- `changes` is a list because one notification can carry several coalesced changes (§6.3).

### 5.3 Rendering, and the one gap in `NotificationEngine`

- The dispatcher renders **title** and **in-app message** with
  `TemplateEngineServer.RenderTemplate(template, template.GetHighestPriorityContent('Text'), data)` and
  passes the results as `title` / `message`.
- **Email is the gap.** At 6.1.6, `NotificationEngine` renders the email from the notification
  **type's** `EmailTemplateID`; there is no per-call template parameter, so it cannot pick a deal type's
  override by itself.
  - **Preferred, upstream:** add an optional `emailTemplateId` to `SendNotificationParams` on MJ `next`
    (additive, a few lines) and bring it to the line with the `backport lts/6.1` label.
  - **Until then:** each sales notification type's `EmailTemplateID` points at a sales **pass-through
    template** whose HTML content is `{{ emailHtml | safe }}`. The dispatcher renders the resolved
    body's `HTML` content itself and passes it as `templateData.emailHtml`. The spike (§9) must confirm
    the sandbox allows `safe`.
  - **Never** bypass `NotificationEngine` and send email directly. That would skip every user's channel
    preferences.

### 5.4 Shipped templates versus a deployment's own

A release's `Metadata_Sync` seed updates the shipped template rows it carries. Editing a shipped
template in place is therefore fragile. The supported path for a deployment is: **create its own
template and point a `DealNotificationTemplate` row at it** (a per-deal-type row, or the global row's
template columns). Document this in the README when it ships, and decide in review whether the global
binding rows are seeded once (left alone afterwards) or kept current by each release.

## 6. How a change becomes a notification

### 6.1 Capture → outbox

**Capture with Entity Actions** (metadata under `metadata/entity-actions/`), all calling one thin
action, `Sales: Record Deal Change`:

| Entity | Invocation | Filter |
|---|---|---|
| `MJ_BizApps_Sales: Deal Stage Events` | AfterCreate | — |
| `MJ_BizApps_Sales: Deals` | AfterUpdate | `Amount` or `ExpectedCloseDate` changed (an Action Filter using `DidFieldChange`) |
| `MJ_BizApps_Common: Activity Links` | AfterCreate | the link targets the Deals entity |
| `MJ_BizApps_Sales: Deal Team Members` | AfterCreate | — |

The action calls the pure **classifier** (`sales-entities`), which applies §4.1 and returns zero or
more changes, then writes one **`DealChangeEvent`** row per change.

Why Entity Actions rather than more code in `DealEntityServer.Save()`:

- the deal save path is untouched;
- they catch writes from every path: the form, the API, an agent, an importer;
- the trigger list is metadata;
- `Durable` survives a restart.

**Fallback if the spike fails:** call the same classifier and writer after commit from
`DealEntityServer`, `ActivityWriterService` and `DealTeamMemberEntityServer`, the way
`CloseWonTaskService` is wired into the close.

**`DealChangeEvent`** — the outbox and the history of what was considered material:

| Column | |
|---|---|
| `DealID` | FK `Deal` |
| `DealChangeTypeID` | FK `DealChangeType` |
| `ChangedByUserID` | FK `__mj.User`, nullable |
| `ChangedAt` | DATETIMEOFFSET; copied from the source row, so an import's original timestamp survives |
| `BeforeText`, `AfterText` | Display strings |
| `DetailJSON` | The measured size (percent, days) for role thresholds; the activity subject; the team member and role |
| `SourceEntityID`, `SourceRecordID` | The stage event, activity or team row it came from |
| `DispatchedAt`, `DispatchNote` | Written once, by the dispatcher (`DispatchNote` holds "stale" or "no recipients") |

Rows are never deleted, and the event columns are never edited.

### 6.2 Recipients

Built with **batched `RunViews`**, never a read per member:

1. The deal's team: `IsActive = 1`, and today inside `StartDate`..`EndDate`, where "today" is
   `BusinessTimeZoneEngine.Instance.Today()`.
2. Each member's subscriptions for the event (§4.2), with role minimums applied to `DetailJSON`.
3. Employee → MJ user through `MJ: Users.EmployeeID`; Person → MJ user through common
   `Person.LinkedUserID`.
   - **A member with no MJ user is skipped** and recorded in `DispatchNote`. Partner reps are usually
     outside the company, and emailing deal amounts to an external address must be an explicit decision
     (§10), not a default.
4. Drop the person who made the change, inactive MJ users, and anyone who cannot read deals.

### 6.3 Dispatch

A scheduled job type and job, **`Sales — Dispatch Deal Change Notifications`**:

- Runs every 2 minutes, `ConcurrencyMode = Skip`, seeded like the existing relink job in
  `metadata/scheduled-jobs/`.
- Driver: a `BaseScheduledJob` in `sales-core-entities-server`.
- `Configuration` JSON: `QuietPeriodSeconds` (180), `MaxHoldSeconds` (900), `StaleAfterHours` (24),
  `MaxEventsPerRun` (500).

Each run:

1. **Claim** undispatched events, oldest first, up to `MaxEventsPerRun`.
2. **Hold** a deal's events while it is still being edited: its newest event is younger than
   `QuietPeriodSeconds`, unless its oldest event has waited `MaxHoldSeconds`. A rep making five quick
   saves sends one message.
3. **Skip stale events** (`ChangedAt` older than `StaleAfterHours`) with `DispatchNote = 'stale'`. The
   HubSpot import preserves original timestamps, so this is what stops a backfill from emailing
   everyone.
4. **Group** by recipient × deal × notification type, then resolve the template set (§5.1) for the
   deal's type and render it.
5. **Send** with `NotificationEngine.SendNotification`:
   - linked to the deal: the `Records` resource type, `resourceRecordId` = the deal ID, and
     `resourceConfiguration = { "Entity": "MJ_BizApps_Sales: Deals" }`, so clicking it in Explorer
     opens the deal;
   - one notification per group.
6. **Mark** each event `DispatchedAt`.
   - **Claim-then-send (at most once):** a notification lost in a crash is better than a duplicate.
   - The cap is explicit, and a run that hits it says so in its result.

## 7. Data model — one migration

Five new tables in `__mj_BizAppsSales`:

- `DealChangeType`
- `DealTypeChangeSetting`
- `DealRoleChangeSubscription`
- `DealNotificationTemplate`
- `DealChangeEvent`

Rules for the migration:

- Foreign keys into `__mj` (`UserNotificationType`, `Template`, `User`, `Entity`) are fine, as the
  existing `__mj.Employee` and `__mj.Company` keys are.
- Follow this repo's migration rules:
  - plain DDL, no guards;
  - `MS_Description` on every column;
  - no `__mj_` timestamps and no foreign-key indexes;
  - filtered unique indexes wherever a nullable column takes part in uniqueness;
  - CHECK constraints only for structure (thresholds ≥ 0);
  - the CodeGen output appended below the banner, with no literal `Sequence`.
- A `minor` changeset.
- The PostgreSQL counterpart is release work.

## 8. Metadata — JSON only in the feature PR

| Directory | Rows |
|---|---|
| `metadata/notification-types/` | The four `Sales: Deal …` MJ notification types |
| `metadata/templates/` | Global title and body templates for each type, the pass-through email template, and their content files |
| `metadata/deal-change-types/` | The eight change types, with global thresholds |
| `metadata/deal-role-change-subscriptions/` | The global matrix in §4.2 |
| `metadata/deal-notification-templates/` | The four global bindings |
| `metadata/entity-actions/`, `metadata/actions/` | The four triggers and `Sales: Record Deal Change` |
| `metadata/scheduled-jobs/` | The dispatcher's job type and job |

- Add them to `metadata/.mj-sync.json` `directoryOrder` after what they look up:
  - notification types and templates before change types and bindings;
  - deal roles and change types before subscriptions;
  - actions before entity actions.
- No `sync` blocks. The release `Metadata_Sync` carries them (`docs/PUBLISHING.md`).

## 9. Phases

### Phase 0 — spike (about a day) — answers decide the capture path

- [ ] An AfterCreate / AfterUpdate Entity Action on a save made inside `BeginEntityTransaction`: does it
      run only after the commit, and not at all after a rollback?
- [ ] `RunMode = 'Durable'` works on 6.1.5 against the shared host.
- [ ] `{{ x | safe }}` renders unescaped inside MJ's Nunjucks sandbox.
- [ ] Does a `NotificationEngine` in-app notification reach Explorer's bell without a page refresh? MJ's
      own agent resolver publishes the push by hand, which suggests it does not.

### Phase 1 — the feature

- [ ] Migration and CodeGen for the five tables; a `minor` changeset.
- [ ] `sales-entities`:
  - [ ] the change-type code union;
  - [ ] the classifier;
  - [ ] the settings resolvers (§4.1, §4.2);
  - [ ] the template resolver (§5.1);
  - [ ] the template-data types (§5.2);
  - [ ] unit tests that are table-driven over precedence.
- [ ] `sales-core-entities-server`:
  - [ ] `DealChangeEventWriter`;
  - [ ] the `Sales: Record Deal Change` action;
  - [ ] the audience resolver;
  - [ ] the renderer;
  - [ ] the dispatcher job.
- [ ] `DealNotificationTemplate` entity subclass: the global-row-complete and one-row-per-scope rules.
- [ ] Metadata in §8, with the global templates written for the four types.
- [ ] Integration bundle `deal-notifications` in `packages/IntegrationTests`, and
      `scripts/expected-check-counts.json`. Checks:
  - [ ] a stage move writes one event;
  - [ ] a below-threshold amount writes none;
  - [ ] a deal-type override changes the threshold;
  - [ ] a role minimum withholds one role and not another;
  - [ ] the actor is never notified;
  - [ ] three saves within the quiet period send one notification;
  - [ ] a deal-type template overrides only the part it sets;
  - [ ] a stale event is skipped;
  - [ ] a member with no MJ user is skipped and noted.
- [ ] Vocabulary, money and token gates green. Mutation evidence for the new checks.
- [ ] Record the MJ asks below in `docs/UPSTREAM-BLOCKERS.md`.

### Phase 2

- [ ] `DealFollower` (`DealID`, `UserID`, `IsMuted`): follow a deal you are not on, or mute one you are.
  - Not a column on `DealTeamMember`: the team freezes when a deal closes (L-17), so a mute stored
    there could not be changed on a closed deal.
  - Not a "Follower" `DealRole`: that row would leak into every "deals I was on" rollup.
- [ ] The phase 2 triggers in §3.
- [ ] A settings matrix editor and a "preview this message" action in Pipeline studio, built on the
      §4 / §5 resolvers.
- [ ] A daily-digest option, if MJ core has not added digests by then.

### MJ core asks (fix on MJ `next`, `backport lts/6.1`)

1. `SendNotificationParams.emailTemplateId`: a per-call email template (§5.3).
2. A configurable email provider and From address. `NotificationEngine` hardcodes `'SendGrid'` and
   `NOTIFICATION_FROM_EMAIL`, while bizapps-orders made its provider configurable. This blocks email
   if AIDP sends mail any other way.
3. `NotificationEngine` publishes the bell push itself.
4. Digests and quiet hours.

## 10. Open questions

1. **"ACV".** There is no ACV column. A deal has `Amount` (the cached orders total), `MRR` and `ARR`.
   Which one is "amount / ACV": `Amount`, `ARR`, or both as separate triggers?
2. **Amount lags line edits.** `Deal.Amount` refreshes when the deal saves. A product edit saved only on
   the order does not move it until then. Accept the lag, or watch `OrderHeader.TotalGross` for deal
   orders instead?
3. **Money gate.** A percent threshold compares two figures orders computed and produces no money
   value, but `test:money-gate` may flag the arithmetic. Confirm it is acceptable, or notify on every
   change.
4. **Partner reps without an MJ login.** Skip them (the default here), or allow email to an external
   address as an explicit per-role opt-in?
5. **The owner's manager.** Should `Employee.SupervisorID` of the deal owner get a role-like subscription?
6. **Shipped templates.** Are the global template bindings seeded once, or kept current by each release
   (§5.4)?
