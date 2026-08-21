# playwright/ — Explorer GUI harness (bizapps-sales)

Proves **create → read → update → delete of a Deal through the real MJ Explorer UI**, not through
stored procedures or GraphQL. S1 already proved CRUD at both of those layers; neither proves the UI. A
generated form can fail to render a field, a foreign-key lookup can fail to resolve, a save can
silently no-op — and all three look identical to a passing API test.

Re-runnable, self-cleaning, and it needs a human **once** (to log in) and never again.

## Run it

```bash
# from the repo root — servers must already be up (see below)
npm run test:explorer:auth     # ONE TIME: headed, you complete the login. Saves .auth/user.json
npm run test:explorer          # the CRUD run — no login, headed so you can watch
PW_HEADLESS=1 npm run test:explorer      # unattended
npm run test:explorer:report   # open the HTML report
```

The harness does **not** start servers. `lib/global-setup.ts` asserts they are reachable and fails with
the exact fix command if not:

```bash
# Sales ships no shells (apps/ was retired — an Open App runs inside an MJ host), so the servers
# are the HOST's. From your MJ checkout, with bizapps-sales linked in:
#   MJAPI      -> the port in the host's packages/MJAPI/.env  (4143 in the linking spike)
#   MJExplorer -> MUST be 4341, the port the Entra redirect URI is registered for:
#                 cd <MJ>/packages/MJExplorer && pnpm exec ng serve --port 4341
# Full setup: docs/QA-GUIDE.md. The harness reads MJEXPLORER_URL / MJEXPLORER_PORT if you differ.
```

## Auth — how login works, and why it is the way it is

**A human logs in once; the session is reused forever after.** The setup project opens a headed browser,
waits up to 5 minutes for the authenticated app shell to appear, and saves the browser session to
`.auth/user.json`. It types nothing into the login form and stores no username or password.

**`storageState` reuse works here because both MJ auth providers cache in `localStorage`** — verified in
`@memberjunction/ng-auth-services/dist/lib/providers/mjexplorer-{msal,auth0}-provider.service.js`
(`cacheLocation: 'localStorage'`). Once captured, `auth-setup` short-circuits: it is seeded with the
saved state, detects "already authenticated", and exits in seconds without opening a window.

> **This is the opposite of the `bizapps-accounting` harness, deliberately.** That one authenticates
> with an MJ magic-link token, which lives in **sessionStorage** — `storageState` cannot capture it, so
> every one of its specs re-consumes the link. Same family, different auth mechanics, different correct
> design. Do not "align" one with the other.

### Which identity provider you get

Angular's `ng serve` defaults to the **`development`** configuration, which swaps in
`environment.development.ts` — and that file selects **Auth0** (`bluecypress-dev.us.auth0.com`), by
design, for headless automation.

That tenant is the **"Headless Automation Test App"**: it has service accounts, **not** staff SSO, so
normal `@bluecypress.io` credentials are rejected there. For a human-driven run use the `local_msal`
configuration instead — it is `development` minus the environment-file replacement, so
`environment.ts`'s `AUTH_TYPE: 'msal'` stays active and you authenticate against the real Blue Cypress
tenant:

```bash
cd <MJ-checkout>/packages/MJExplorer && pnpm exec ng serve --port 4341
```

The harness itself is **provider-agnostic** — it waits for the app shell, not for a particular login
form — so either provider works.

### Redirect URIs, and a trick worth reusing

Both providers set their redirect from `window.location.origin`, so the port must be registered with the
IdP. Probing the IdP directly answers that in seconds, with no login attempt burned:

```bash
# Auth0: an unregistered callback answers "Callback URL mismatch"
curl -s "https://bluecypress-dev.us.auth0.com/authorize?client_id=<CID>&response_type=code&scope=openid&redirect_uri=http%3A%2F%2Flocalhost%3A4341"
# Azure: an unregistered redirect answers AADSTS50011
curl -s "https://login.microsoftonline.com/<TID>/oauth2/v2.0/authorize?client_id=<CID>&response_type=code&scope=openid&redirect_uri=http%3A%2F%2Flocalhost%3A4341"
```

Findings as of 2026-08-04: **Auth0 allows only ports 4200 and 4201.** **Azure allows any localhost
port** (it has a documented localhost exception for public/SPA clients), which is why MSAL works on the
plan's real 4341 with no IdP change at all.

## Navigation — there is no hand-built UI yet, and none is needed

This app ships no custom application or navigation until S3, but **CodeGen auto-creates one MJ
Application per schema**, so the entities are fully reachable today:

```
/app/mjbizappssales     the generated Sales application
  ↳ opens an entity grid automatically and collapses its left rail to icons
  ↳ the "All" breadcrumb returns to the full entity list (19 entities)
  ↳ each grid: (Default) view selector · filter box · Create · Export · view settings · ⋮ More actions
  ↳ each record: a full generated form, Save Changes / Discard, and child-relationship sections
```

`specs/00-recon.spec.ts` re-derives all of this at runtime and prints it. Run it first when anything
below stops matching — it is the map, and it is cheaper than guessing.

## Files

| Path | Role |
|---|---|
| `playwright.config.ts` | Two projects: `auth-setup` (headed, human login, once) and `crud` (reuses the session). Serial, 1 worker. |
| `lib/env.ts` | Ports, URLs, entity names, the `PW-VERIFY` prefix, the seeded dev company. All env-overridable. |
| `lib/global-setup.ts` | Preflight: servers reachable, MJAPI serving this app's metadata, plus a **pre-clean**. |
| `lib/global-teardown.ts` | Unconditional cleanup, so a failed run never poisons the next one. |
| `lib/cleanup.mjs` | FK-ordered SQL delete of every `PW-VERIFY*` row. Also runnable directly. |
| `lib/explorer.ts` | The console-error **keystone**, navigation, and the generated-form helpers. |
| `auth.setup.ts` | One-time interactive auth capture + a recon dump. |
| `specs/00-recon.spec.ts` | Living diagnostic: maps shell → app → entity → form. |
| `specs/01-probe-form-dom.spec.ts` | Dumps form DOM around known labels (`PW_PROBE=1`). |
| `specs/02-probe-delete-affordance.spec.ts` | Enumerates delete controls with geometry (`PW_PROBE=1`). |
| `specs/10-deal-crud.spec.ts` | **The actual verification** — CRUD through the *generated* entity browser. |
| `specs/40-deal-workspace.spec.ts` | Composes a deal across all five workspace panes and reads it back through a **different** surface. |
| `specs/41-deal-roundtrip.spec.ts` | **The related-record-collection round trip** — save, RE-OPEN, and prove the lines, instalment, dates and owner all came back; then remove a line and prove the removal survives another re-open. |
| `specs/50-sales-shell.spec.ts` | The Phase 2 section layout, the rail, and the roster opening the workspace. |
| `specs/70-activity-timeline.spec.ts` | **NEVER RUN.** Logs an activity from the workspace and asserts the `Activity` row, its `LoggedByUserID`, and the deal/account/contact links the `Sales.LogActivity` Action attaches. Plus: a refused log leaves no unreachable activity. |
| `specs/80-board-drag.spec.ts` | **NEVER RUN.** Drags a card between stages and asserts the stage change, exactly one append-only event stamped with the DEPARTING probability and amount, and the order following the new stage. Plus: a drop onto a closing column is refused with a hint. |

### Two specs are written and have never been executed

`70-activity-timeline` and `80-board-drag` cover the two newest surfaces in the tree, both of which had
no spec at all. They were authored while Explorer and `MJ_V6_Host` were in use by another session, so
**neither has run once** — not green, not red, not at all.

That is recorded rather than hidden because an unrun spec and a passing spec look identical in a file
listing, and the difference matters: **a spec that has never failed has never been shown to test
anything.** Each file ends with a numbered list of mutations — the specific line to break and the
assertion that must go red. The first thing the post-merge pass should do is work that list, THEN run
them green. Doing it the other way round produces a green result with no evidence behind it, which is
the state this harness exists to avoid.

The precedent is in-repo: an integration check (`AC14`) spent a day asserting a defect, passing the
whole time, because the fixture it drove reproduced the bug it was meant to catch. Only a mutation
found it.

### Three traps these specs have already hit

None of them looks like a selector bug when it fires — all three read as data bugs, which is why they cost
real time:

1. **Every rail page stays in the DOM — hidden, not removed**, so the workspace's open documents survive a
   page change. An unscoped `tr` / `.wl` locator therefore matches a HIDDEN roster row and fails on
   visibility while the grid it meant to read is perfectly correct. Scope by page, or filter to `:visible`.
2. **`innerText` cannot see an `<input>`'s value.** The workspace grids hold their data in inputs, so a
   text assertion silently matches nothing but the `<select>` option labels. Read `inputValue()` instead —
   `41-deal-roundtrip.spec.ts` has a `lineNames()` helper for exactly this.
3. **The roster does not re-read after a save.** It loads its rows when the rail page mounts, so a deal
   created in the same session is absent from it until the page is reloaded. A spec that saves and then
   looks for its deal in the roster will fail in a way that reads exactly like a lost save. Reload first —
   which is also the stronger test, since it discards all client state.

**Both specs leave their deals behind on purpose** (tagged `PW-…` / `RT-…`, unique per run) and only
`PW-VERIFY*` rows are auto-cleaned. Re-running them repeatedly during debugging accumulates deals, and
enough of them push a newly created one off the first page of the Deals grid — at which point the
read-back assertion in `40` fails for a reason that has nothing to do with the code. Each spec's header
carries the SQL to clear its own rows.

`.auth/`, `artifacts/`, `playwright-report/` and `test-results/` are all gitignored.
**`.auth/user.json` is a live bearer token for a real account — never commit it.**

## The keystone

A UI that renders but logs a console error is broken in a way presence assertions cannot see, so every
run captures `console.error` + `pageerror` and asserts the list is empty. Create/read/update are held to
a **zero-error** standard; the delete steps tolerate exactly one documented error (below) and fail on
anything else.

The allowlist in `lib/explorer.ts` is deliberately tiny. Two entries earn their place — the Font Awesome
kit's 403 on localhost, and MSAL's 404 for a user with no Graph profile photo. A 404 on a *static asset*
is noise; a 404 on anything else stays a real signal, because a blanket 404 filter would mask genuine
backend failures.

## Findings from building this

Things the harness surfaced that are worth knowing, and are not bugs in this app's schema:

1. **Delete is a SOFT delete.** After deleting, the grid gains a `Recycle Bin · N deleted records`
   chip. So "the row left the grid" is the correct UI-level assertion — not absence from the database.
2. **Deleting a record whose tab is still open logs an error**:
   `Error in BaseEntity.Load(MJ_BizApps_Sales: Deals, Key: ID=…)`. MJ Explorer's tab manager re-Loads
   the now-deleted record. Reproducible for every entity; the delete itself succeeds. An MJ-core
   tab-lifecycle concern — scoped in `KNOWN_POST_DELETE_ERRORS` rather than globally ignored.
3. **The generated grid has no Delete control**, even with a row selected, and the `⋮ More actions`
   overflow does not add one. Deletion is a **record-level** action: `button[title="Delete this Record"]`
   on the open record, then a "Confirm Deletion" dialog.
4. **There are two "Delete" buttons in the DOM.** One is a hidden, pre-rendered confirmation button that
   still reports a non-zero bounding box — so "visible and sized" heuristics accept it and the click
   then times out. The real one carries a trash icon; the harness discriminates on that.
5. **NOT NULL surfaces in the UI.** Required-but-empty fields get
   `.mj-forms-field--required-empty`, which the spec asserts for `Deal.Pipeline`, `Deal.Company` and
   `Pipeline.Company` — a real check that the generated form honours the schema.
6. **View mode omits NULL fields entirely.** It is not a read-only copy of the edit form, so a nullable
   field can only be asserted to render in edit mode. This is why the provenance trio
   (`Amount Is Computed` / `Amount Computed At` / `Amount Source Hash`) is checked after
   `enterEditMode`.
7. **Soft cross-app references surface as raw UUID text boxes** — `Currency ID`, `Campaign ID`,
   `Contract ID`, `Renews Contract ID` — because they carry no FK (DG-6), so CodeGen cannot offer a
   lookup. Correct for S1, and a real UX item for S3 to address.
8. **`MRR`/`ARR` render as "Mrr"/"Arr".** CodeGen's PascalCase word-splitting does not know they are
   acronyms. Cosmetic; fixable with a `DisplayName` in entity-field metadata.
