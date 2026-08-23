# Sales on a v6 MJ host via OpenApp linking — run report

## How far it got

**Sales is linked into a running v6 MJ host and loads.** The host API boot log says it plainly:

```
Loading Open App server packages...
  Loaded Open App server package: @mj-biz-apps/sales-server (ran LoadBizAppsSalesServer) (+2 resolver paths)
```

Every step of the brief completed **except the in-browser UI check**, which is blocked on an interactive
MSAL login (detail below). Everything up to and including "the app is registered and its packages load in
a running host" is done and evidenced.

| Step | Result |
|---|---|
| Fresh MJ host on `next`, installed, built | ✅ clone + install (+3220 pkgs) + **build 299/299 and 271/271, 0 errors** |
| Host config authored (`.env`, `environment{,.development}.ts`) | ✅ own DB `MJ_V6_Host`, own port **4143** |
| MJ core migrated into the host DB | ✅ **46 migrations** |
| Local common fix applied and building | ✅ **5/5**, reconfirmed from a clean checkout |
| `mj dev workspace` linking | ⚠️ **worked, with one real bug** — see D-VH9 |
| Linking verified (linked vs REGISTRY) | ✅ `sales-server` → `bizapps-sales/packages/Server`; `@memberjunction/core` → `MJ/packages/MJCore` |
| Sales wired + registered (`dynamicPackages`, bootstrap import) | ✅ server **and** client |
| Sales schema migrated into the host DB | ✅ 23 tables, **22 entities registered** |
| Sales packages built inside the host | ✅ **6/6, 0 errors** |
| MJAPI runs with Sales loaded | ✅ boot log above; HTTP 401 on 4143 (listening, auth required) |
| Sales data present for a UI check | ✅ metadata pushed (54 rows) + seeds → 2 pipelines, 9 stages, **6 deals** |
| Host Explorer builds and serves | ✅ bundle built, **HTTP 200** on 4341, title `MemberJunction Explorer` |
| Sales app registered in host metadata | ✅ `Application: Sales — Deal pipeline management…` present in `__mj.Application` |
| Explorer UI check ("a deal renders") | ❌ **not completed** — MSAL cannot refresh the saved session silently in the host (`block_iframe_reload`); it redirects to login. Needs a human login |
| Retire Sales' `apps/` on the conversion branch | ✅ committed as `b98603f` |

---

## Did `mj dev workspace` work, or did it need the manual fallback?

**Both — and the split is worth reporting precisely, because the tool is closer than "rough".**

**What worked, unaided:** it auto-detected all three members and classified them
(`bizapps-common`/`bizapps-sales` as `mj-app-json`+`bizapps-packages`, `MJ` as `mj-monorepo`), reported
every devDependency conflict *with the winner named*, pinned `packageManager` from a member, wrote the
generated contract plus a `.mj-dev-workspace.json` sentinel, and printed correct teardown/status commands.
It also warned about app-shell auth peer choices. No hand-holding.

**The one real bug:** it emitted only `MJ` and `MJ/packages/*` as globs, while **MJ's own
`pnpm-workspace.yaml` declares 42** (`packages/Actions/*`, `packages/AI/Providers/*`,
`packages/TestingFramework/*`, …). The install then failed hard:

```
ERR_PNPM_WORKSPACE_PKG_NOT_FOUND  In MJ: "@memberjunction/integration-test-suite@workspace:*" is in the
dependencies but no package named "@memberjunction/integration-test-suite" is present in the workspace
```

**Fallback applied surgically:** I hand-expanded the parent `pnpm-workspace.yaml` to mirror each member's
own globs, prefixed with the member directory — 47 entries — rather than abandoning the tool or
hand-authoring all four files. Everything else the generator produced was kept as-is.

**For Marcelo:** read each member's `pnpm-workspace.yaml` and re-emit its globs prefixed, instead of
assuming `packages/*`. Note Sales' file has comment lines *inside* the `packages:` block, which a naive
line parser skips past — my own first parse hit exactly that and silently produced zero globs for Sales.

---

## The common fix

**Confirmed, and it is three changes, not one** (as first established in `EXPLORER-REWORK-DECISIONS.md`
D-XR7 and re-verified here from a clean checkout):

1. `packages/CoreEntitiesServer` peer floor → `^6.1.0-edge.2` (edge.1 has no `UserCache` at all)
2. anchor `@memberjunction/generic-database-provider: 6.1.0-edge.2` in **root `devDependencies`** — it is
   declared *only* as a peer, so without this nothing installs it and `pnpm install` still succeeds
3. `pnpm.overrides` for `@memberjunction/core` **and** `@memberjunction/global`: exact `6.1.0-edge.0` →
   `6.1.0-edge.2` (else `'@memberjunction/global' does not provide an export named 'IsPlainObject'`)

Result: `pnpm run build` → **5/5 successful**. A PR doing only #1 will look right, install cleanly, and
still not work.

---

## Every gotcha hit

The brief listed six to watch for. **Four fired, plus four the brief did not anticipate.**

| # | Gotcha | What happened |
|---|---|---|
| 1 | **Install from the parent** | Confirmed necessary. I removed all three members' `node_modules` before the parent install so no nested `.pnpm` could shadow. Later steps that mutate a member manifest also require re-installing **from the parent**, not the member |
| 2 | **Exact-pin non-linking** | Avoided by construction: the host dependency ranges were generated *from each linked package's own version* (`^5.0.0`), so `linkWorkspacePackages` resolves to local source. Verified LINKED, not REGISTRY |
| 3 | **The misleading credentials error** | Fired, in a different place than expected: `mj migrate` failed with *"Database credentials are missing or empty… dbDatabase, codeGenLogin, codeGenPassword"* — because the CLI reads `.env` from **the repo root**, and I had authored only `packages/MJAPI/.env`. The message names the fields but never says *which* `.env`. Fixed by adding a root copy |
| 4 | **Restart MJAPI after migrate/codegen** | Observed and honoured — restarted after the metadata push + seeds so the new entities were picked up |
| 5 | **Port collisions** | Avoided entirely: host API on **4143** (4141 is Josue's running v5 API, 4142 was a prior experiment). **Nothing of Josue's was stopped** for the API work |
| 6 | **Harmless peer warnings** | Fired as a *hard failure*, not a warning: the generated `.npmrc` sets `strict-peer-dependencies=true`, and exactly two unmet peers (`react@^19.2.8`, `@types/react@^19.2.0`, both from MJ's `ng-react`) exited the install non-zero. Bridged via the parent's `pnpm.peerDependencyRules` rather than disabling strict peers globally — nothing on the Sales path uses React |

**Not anticipated by the brief:**

| # | Gotcha | What happened |
|---|---|---|
| 7 | **The host DB needs bizapps-common's schema before Sales'** | Sales' migration failed at batch 11/465 with `Could not create constraint or index`. Cause: Sales' IsA extensions FK into `__mj_BizAppsCommon`, which the host DB did not have. Fixed by migrating common first (7 applied), dropping the partial Sales schema, and re-running. **The SQL error names neither the missing schema nor the app** |
| 8 | **`turbo --filter` must run from the parent** | `turbo build --filter="@mj-biz-apps/sales-*"` from inside `MJ/` matched **0 packages and exited 0** — a silent no-op that looks like success. From the parent it matched 6/6 |
| 9 | **`mj codegen manifest` mutates manifests and demands a reinstall** | It wired the client (`import * as __openAppClient0 from '@mj-biz-apps/sales-ng'`) but also *"Added 90 missing dependencies to package.json"*; MJAPI's prestart later added 2 more. Each needs a parent reinstall or the API fails to boot |
| 10 | **An opaque `[Object: null prototype] {}` API crash** | MJAPI died at ~3s with no message via the turbo/pnpm path. Root cause was the pending reinstall from #9; after reinstalling it booted cleanly. Worth knowing because the error text is useless — **if MJAPI dies with an empty object, suspect a stale install first**. (I saw the same signature in a previous session and could not attribute it then; this is the explanation.) |
| 11 | **`ERR_PNPM_NO_VERSIONS mj_generatedentities`** | Appears on every host install, exit 0. It is the host's *generated* entities package, absent until CodeGen runs. Reads like a broken lockfile; is not |
| 12 | **`du` overstates reclaimable space on pnpm trees** | Deleting ~3.8G of scratch returned 0.1G — pnpm hardlinks into the shared store, so deleting a tree only drops link counts. Real reclamation needs `pnpm store prune` |
| 13 | **A transitive dep of a linked package is invisible to the host app** | The Explorer build died with `TS2307: Cannot find module '@mj-biz-apps/sales-entities'` even though the chain was correctly linked (`MJExplorer -> sales-ng -> sales-entities`, all LINKED). Angular's compiler resolves from MJExplorer's own root, and pnpm's strict layout gives it only what it declares. Fixed by adding `@mj-biz-apps/sales-entities` to MJExplorer's dependencies. **Under npm's hoisting this would have resolved silently** — so expect one such declaration per package the app's UI types reach through |

---

## The one thing not verified, and why

The full stack runs — host API on 4143 with Sales loaded, host Explorer serving HTTP 200 on 4341 — but I
could not confirm *visually* that a deal renders. The saved Playwright MSAL session belongs to the v5
Explorer instance; in the host it fails to refresh silently:

```
[MSAL] Token refresh failed: BrowserAuthError: block_iframe_reload
Token refresh failed, redirecting to login: Authentication error. Please log in again.
```

The page therefore renders empty and redirects to login. **This is an auth-session limitation, not
evidence of a problem with the link** — the server-side proof is unambiguous (the boot log naming
`LoadBizAppsSalesServer`, 22 registered entities, the `Sales` application row, 6 seeded deals).

To finish it: start the host Explorer on **4341** (the Entra-registered redirect URI — MJ's default 4201
would fail the callback), log in once as a human, and the harness session can be re-captured from there.

```sh
cd C:6\MJ\packages\MJExplorer && pnpm exec ng serve --port 4341      # not `npx ng` — pnpm layout
```

Note the host API must be on 4143 to match `environment.ts`'s `GRAPHQL_URI`.

---

## Sales' `apps/` retired — commit `b98603f`

On `feature/mj6-pnpm-conversion`, as its own labelled commit: `git rm -r apps/` (38 files, 821 deletions,
recoverable from history), the `apps/*` workspace glob, and the six root scripts that filtered on
`mj_api`/`mj_explorer` and would now match nothing. Orders has none of those scripts either.

Sales was the last app in the family carrying its own shells, and their names — literally `mj_api` and
`mj_explorer` — are the collision the spec warns about.

---

## Decisions queued

`V6-HOST-DECISIONS.md`, **D-VH1 … D-VH11**. The ones worth reading: **D-VH5** (Sales' `apps/` retirement
is a *prerequisite*, not a cleanup — its apps are literally named `mj_api`/`mj_explorer` and would collide
with the host's), **D-VH9** (the workspace generator bug), and **D-VH11** (the common-schema ordering rule
that no document currently states).

---

## Environment — what was touched and what was not

- **Josue's materialization clone `C:\Dev\MJ\MJ` — never touched.** Read only for its remote URL and
  branch name; never checked out, built, or written to. Still on `claude/add-claude-md-installer-WJ2OZ`.
  It carries 18 modified files, and those are **pre-existing**: the newest mtime among them is
  2026-07-30, with the rest from June — nothing from today.
- **The v5 Sales environment — untouched.** `MJ_BizAppsSales` (v5 DB) never opened; the main checkout is
  still on `feature/deal-line-product-ref` with only its pre-existing drift plus this run's untracked
  reports. **Josue's v5 API and Explorer were never stopped** — the host runs on 4143.
- **`MJ_BizAppsSales_V6`** (the conversion DB) — untouched; the host uses a third database, `MJ_V6_Host`.
- **`bizapps-common`** — untouched, clean on `main`; the checkout under the parent is a detached worktree.
- **New on disk:** `C:\v6\` containing `MJ\` (fresh clone), `bizapps-common\` (detached worktree),
  `bizapps-sales\` (the conversion worktree, *moved* here from `C:\Dev\wtv6` with its install intact —
  `git worktree list` reflects the new path).
- **No commits, no pushes.** All host-side wiring (`mj.config.cjs`, `MJAPI`/`MJExplorer` package.json, the
  generated manifest, both `.env` files, the parent workspace files) is uncommitted local dev wiring, as
  the contracts doc requires.
