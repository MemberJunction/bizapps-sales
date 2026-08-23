# MJ v6 + pnpm conversion — decisions queued

Non-blocking calls made during the conversion. One blocking question was asked up front (which
`bizapps-common` ref supplies the v6 DB migrations → **`origin/next`**, freshly fetched).

---

## D-V6-1 — The workspace globs could NOT be copied from the siblings

The brief said to copy accounting's `pnpm-workspace.yaml` as "same `apps/*` / `packages/*` layout". It
isn't: **accounting and orders both list `packages/*` only, because neither ships an `apps/` directory.**
Sales is the only app in the family with `apps/MJAPI` and `apps/MJExplorer`.

**Chosen: copy accounting's file verbatim and add `apps/*`**, with a comment saying why it diverges.
A verbatim copy would have left both apps outside the workspace, and pnpm would have tried to resolve
their workspace-internal dependencies from the registry — which fails loudly for unpublished versions and,
worse, silently installs a stale copy for published ones.

---

## D-V6-2 — Version style follows orders exactly, which is finer-grained than the brief

The brief said "bump every `@memberjunction/*` dep → `6.1.0-edge.2`". Orders' `origin/next` distinguishes
three cases, and the distinction matters:

| Location | Style | Why |
|---|---|---|
| root `devDependencies` | exact `6.1.0-edge.2` | the anchor — one resolved copy for the whole workspace |
| leaf package deps | caret `^6.1.0-edge.2` | lets the anchor win without re-resolving |
| `peerDependencies` | **ranges, never exact** | orders has a dedicated commit for this (`peerDependencies must be ranges, not exact pins`) |

**Chosen: follow orders.** Note that accounting/orders currently float `^6.1.0-edge.0`/`edge.1` floors,
which resolve to the same `edge.2` build; sales pins the floor at `edge.2` as the brief specified.

---

## D-V6-3 — `@mj-biz-apps/common-*` goes to `^5.33.2`, and that is not a mismatch

Sales pinned `^5.32.0`. There is **no 6.x common on npm** — latest is `5.33.2`, and its only dist-tag is
`latest`.

**Chosen: `^5.33.2`.** The version number still reads 5.x, but that build is already targeted at v6: its
published `peerDependencies` require `@memberjunction/core ^6.1.0-edge.0` and
`@memberjunction/global ^6.1.0-edge.0`. Pairing common 5.33.2 with MJ v6 is the intended combination, and
pairing it with v5 would now be the mismatch.

**For review:** worth confirming with whoever owns common that 5.33.2 is the release intended to pair with
6.1.0-edge.2, since the version numbering gives no hint.

---

## D-V6-4 — Root `devDependencies` now anchor every workspace peer (16 packages)

Under npm's flat `node_modules`, a package declared only as a `peerDependency` in a workspace package
still resolved, because hoisting put *something* at the root. pnpm's nested store does not, so an
unsatisfied peer has no provider at all.

**Chosen: anchor all 16 MJ packages** that any workspace package declares as a peer, in root
`devDependencies` at exact `6.1.0-edge.2` — the same fix orders applied in `29da480` ("anchor every
workspace peer in root devDependencies"). The list is derived from **this repo's** peers rather than
copied from orders, so it stays correct as sales' packages change.

---

## D-V6-5 — Two genuine phantom dependencies, both real bugs npm was hiding

1. **`@memberjunction/cli`** — root scripts run `node node_modules/@memberjunction/cli/bin/run.js`, and
   *nothing in the repo ever declared it*. Every `npm run mj:*` script worked purely by hoisting
   accident. Fixed in the anchor list above.
2. **`dotenv`** — `mj.config.cjs` line 1 is `require('dotenv').config(...)`, never declared. This one
   **broke the v6 rebuild outright**: `mj migrate` failed with
   `ModuleLoadError … Cannot find module 'dotenv'` from `mj.config.cjs`. Fixed by adding
   `dotenv ^17.2.3` to root `devDependencies` — the same version orders declares, for the same reason.

Both are pre-existing latent defects that pnpm surfaced rather than caused. Neither is a v6 issue.

---

## D-V6-6 — `.npmrc` is committed empty, matching both siblings byte-for-byte

Accounting's and orders' `.npmrc` are **0 bytes**. Accounting's `pnpm-workspace.yaml` comment says peer
handling "lives in .npmrc", which is now stale — the file is empty in both.

**Chosen: create it empty anyway.** Its presence is what pins pnpm's config discovery to the repo root
rather than letting a developer's `~/.npmrc` leak in, and matching the siblings byte-for-byte keeps the
family diffable. Flagged because the stale comment invites someone to "fix" it by adding settings.

---

## D-V6-7 — The graphql / type-graphql / reflect-metadata pins stay, and matter more here

Accounting's `pnpm.overrides` has no such pins; sales' does.

**Chosen: keep all three verbatim in `pnpm.overrides`.** Sales runs an MJAPI, and a second copy of any of
`graphql`, `type-graphql` or `reflect-metadata` makes `buildSchema` die on a decorator that is perfectly
correct. Accounting has no `apps/` and therefore no such surface. This is one place sales must *not*
converge on the sibling config.

---

## D-V6-8 — `corepack pnpm`, not a global pnpm install

`corepack enable pnpm` failed with `EPERM` (it wants to write shims into `C:\Program Files\nodejs`, which
needs an elevated shell).

**Chosen: invoke `corepack pnpm`**, which honours the `packageManager` field and resolved **pnpm 10.33.0**
— the exact pinned version — with no global install and no elevation. Worth knowing before anyone
concludes pnpm "isn't installed" on this machine.

---

## D-V6-9 — `pnpm install` needs reduced network concurrency on this machine

The first install failed (`ERR_PNPM_META_FETCH_FAIL … ECONNRESET`) on several registry metadata fetches.

**Chosen: `--network-concurrency=4` with raised fetch retries**, which completed cleanly (2668 packages,
7m). This is a local-network characteristic, not a repo problem — recorded so the next person does not
read it as a broken lockfile. **Not** persisted into `.npmrc`, because that would diverge from the
siblings' empty file for a machine-specific reason.

---

## D-V6-10 — `npm run mj -- <cmd>` does not survive the switch, and four call sites needed fixing

pnpm forwards `--` as a **literal argument** rather than consuming it as npm does, so
`npm run mj -- sync push --dir metadata` becomes `mj -- sync push …` and the CLI dies with
`Error: command -- not found`. It broke the rebuild loop at the metadata-push step.

**Chosen: rewrite the four call sites to `pnpm mj sync push --dir metadata`** — `CLAUDE.md`,
`docs/DEMO.md`, and two in `scripts/rebuild-db.sh`.

This is slightly beyond a pure dependency conversion, and deliberately so: leaving them would ship a
documented rebuild loop that cannot complete, and the failure mode (`command -- not found`) gives no hint
that the package manager is the cause. Plain `npm run <script>` with no argument passing is unaffected and
was left alone.

---

## D-V6-11 — `mssql` pinned at `^11.0.1`, not latest

`test-harnesses/integration.mjs` imports `mssql` directly and never declared it. My first fix took
npm's latest (`^12.7.0`).

**Corrected to `^11.0.1`** after checking what the harness had actually been running against: the v5
tree's hoisted copy is `11.0.1`, and orders declares `^11.0.1`. Declaring a phantom dependency is a
chance to *record* the version already in use, not to silently take a major-version bump on a package the
harness calls directly.

---

## D-V6-12 — Workspace packages are declared at root by version range, not `workspace:*`

`integration.mjs` imports `@mj-biz-apps/sales-server` and `@mj-biz-apps/sales-integration-tests`. npm
symlinks every workspace package into the root `node_modules`; pnpm links one only where declared.

**Chosen: declare both at root as `^5.0.0`**, matching how orders declares its own. Combined with
`linkWorkspacePackages: true`, the range resolves to the **local** package rather than the registry —
which matters because neither is published, and the accounting comment warns that without that flag an
exact pin silently installs a stale registry copy instead.

---

## D-V6-13 — The only v6 source change is one moved import

`UserCache` moved from `@memberjunction/sqlserver-dataprovider` to
`@memberjunction/generic-database-provider`. Destructuring from the old package yields `undefined`
silently; the visible failure is `Cannot read properties of undefined (reading 'Instance')` several lines
later, which reads like a broken cache.

**Chosen: import it from the new package**, with a comment naming the move — the same fix bizapps-common
made in `302ea92`. `@memberjunction/generic-database-provider` was added to the root anchors; it was in
orders' anchor list already but not in sales', because no sales package declared it as a peer.

**Worth stating for the report:** this is the *entire* v6 API delta for sales. No application source file
changed. Everything else was a dependency declaration.

---

## D-V6-14 — CodeGen's AI-assisted steps fail without credentials, non-fatally

CodeGen pass 1 logged repeated `No suitable model found for prompt CodeGen: Check Constraint Parser` and
`AI credential circuit is open` errors, then completed successfully (406 entities, exit 0).

**Chosen: proceed.** These are optional LLM-assisted generation steps (check-constraint parsing, form
layout suggestions) and this environment has no AI credentials configured. The output is deterministic
without them.

**Flagged because the log is alarming out of context**, and because it means any generated artifact that
*would* have been AI-assisted is absent rather than wrong — if a future v6 CodeGen run is done on a
credentialed machine, expect additional generated content and diff it deliberately.
