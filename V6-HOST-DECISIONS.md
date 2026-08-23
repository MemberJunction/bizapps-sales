# v6 host + Open App linking — decisions queued

One blocking question was asked up front (which drive hosts the workspace, given C: was at 99%) →
**C: after reclaiming scratch**. Everything below was decided in-flight and is recorded for review.

---

## D-VH1 — Parent at `C:\v6\`, not `C:\Dev\mjhost\`

The brief suggested cloning the host to `C:\Dev\mjhost`, but the linking model requires **MJ and every
member repo to be siblings under one common parent**, and the workspace tool refuses a parent that is
itself a git repo.

`C:\Dev` was unsuitable as that parent: it already holds Josue's materialization clone
(`C:\Dev\MJ\MJ`, which is off-limits), the v5 Sales checkout, and unrelated C++ projects — so a
`--dir C:\Dev` workspace would have swept them in as candidate members.

**Chosen: `C:\v6\` holding `MJ\`, `bizapps-common\`, `bizapps-sales\`.** Short (MAX_PATH headroom,
which has bitten this machine repeatedly), not a git repo, and contains nothing but this spike.

---

## D-VH2 — The Sales worktree was *moved*, not re-created

`C:\Dev\wtv6` was the verified-green conversion worktree with a working ~3G install.

**Chosen: `git worktree move` it to `C:\v6\bizapps-sales`**, preserving `node_modules` and the verified
state. Re-creating it would have cost a fresh install and ~3G of duplicate disk on a drive already at
99%. `git worktree list` confirms the new path; the branch and cleanliness are unchanged.

---

## D-VH3 — Reclaiming scratch freed almost nothing, and the reason matters

Deleting `cmn6` + `cmn7` + scratch (measured by `du` at ~3.8G) returned **0.1G**.

**Cause: pnpm hardlinks `node_modules` into the machine-wide content-addressable store.** `du` counts
the hardlinked bytes per tree, but deleting a tree only drops link counts — the store still holds the
content. Real reclamation needs `pnpm store prune`.

Not a problem in the end (free space rose to ~22G from other activity), but worth recording: **`du` on a
pnpm tree overstates what deleting it will give back**, which would mislead anyone sizing disk for this
work.

---

## D-VH4 — Host DB `MJ_V6_Host`, on SQL Server, on port 4143

**Chosen: a third, separate database** — `MJ_BizAppsSales` (v5, Josue's working env) and
`MJ_BizAppsSales_V6` (the conversion DB) are both untouched. SQL Server per the brief; the Postgres
decision is still pending and nothing here forecloses it.

**Port 4143** for the host API: 4141 is Josue's running v5 API and 4142 was used by an earlier
experiment. Chosen so **nothing of Josue's has to be stopped** for this spike.

Credentials and the Entra `TENANT_ID`/`WEB_CLIENT_ID` are copied from the Sales dev `.env` so the same
human login works. `packages/MJAPI/.env` is gitignored and never committed.

---

## D-VH5 — Sales' `apps/` retirement is a PREREQUISITE, not a cleanup

The brief listed retiring `apps/` as step 5, after linking. The linking spec makes it a precondition:

> "Producer repos contribute `packages/*` only, never `apps/*` — every member names its apps
> `mj_api`/`mj_explorer`, so contributing `apps/*` from more than one member collides."

Sales' apps are named exactly `mj_api` and `mj_explorer` (visible in every build log), so they would
collide head-on with the host's own. Sales is also the **only** sibling that still has an `apps/`
directory — accounting, orders and contracts have all retired theirs.

Two mitigations, and the difference matters: the generated parent `pnpm-workspace.yaml` globs
`bizapps-sales/packages/*` and therefore *excludes* `apps/` regardless — so linking works either way.
But Sales' **own** `pnpm-workspace.yaml` still declares `apps/*` (I added it during the v6 conversion,
D-V6-1), which is the trap: anyone installing from inside the Sales repo re-creates the nested-install
hazard the quickstart warns about.

**Chosen: keep the retirement as its own clearly-labelled commit on the conversion branch, and remove
the `apps/*` glob in the same commit.**

---

## D-VH6 — MJ `next` is on 6.1.0-edge.2 — the same edge as Sales

Checked before installing anything, because a host/app era mismatch would have invalidated the spike:
`packages/MJCore/package.json` on `next` reports **6.1.0-edge.2**, exactly what the Sales conversion
targets and what `@mj-biz-apps/common-*@5.33.2` declares as its peer floor.

**No version negotiation was needed.** Recorded because it is the single fact that made this a wiring
exercise rather than a compatibility exercise.

---

## D-VH7 — The common fix is re-applied from documentation, not copied from scratch

`C:\Dev\cmn7` (last session's proof) was deleted to reclaim disk before the fix was re-applied.

**Chosen: re-apply the three parts from `EXPLORER-REWORK-DECISIONS.md` D-XR7** into a fresh detached
worktree at `C:\v6\bizapps-common`. It rebuilt **5/5**, independently reconfirming the fix in a clean
checkout — which is a stronger result than reusing the original tree, since it proves the three changes
are sufficient and complete from a standing start.

`bizapps-common` itself is untouched: the checkout is a detached worktree, the repo stays clean on
`main`, and nothing was published or pushed.

---

## D-VH8 — `ERR_PNPM_NO_VERSIONS … mj_generatedentities` on the host install is expected

The host install logged `No versions available for mj_generatedentities. The package may be
unpublished.` and still exited **0** with +3220 packages.

**Chosen: proceed.** `mj_generatedentities` is the host's *generated* entities package — it does not
exist until CodeGen has run against a migrated database, which is a later step. Recorded because the
message reads like a broken lockfile and would otherwise invite a wrong fix.

---

## D-VH9 — `mj dev workspace` WORKED for detection, but its globs are incomplete for monorepo members

The tool detected all three members correctly (`bizapps-common`, `bizapps-sales`, `MJ`), classified them
(`mj-app-json`/`bizapps-packages`/`mj-monorepo`), reported devDependency conflicts with the winner named,
pinned `packageManager` from a member, and wrote the contract + a `.mj-dev-workspace.json` sentinel.
**That half is genuinely good.**

**The bug: it emitted only `MJ` and `MJ/packages/*`, while MJ's own `pnpm-workspace.yaml` declares 42
globs** (`packages/Actions/*`, `packages/AI/Providers/*`, `packages/TestingFramework/*`, …). The install
then failed hard:

```
ERR_PNPM_WORKSPACE_PKG_NOT_FOUND  In MJ: "@memberjunction/integration-test-suite@workspace:*" is in the
dependencies but no package named "@memberjunction/integration-test-suite" is present in the workspace
```

**Chosen: hand-expand the parent `pnpm-workspace.yaml`** to mirror each member's own globs, prefixed with
the member directory — 47 entries. This is exactly the brief's anticipated "fall back to hand-authored
parent files", applied surgically to the one file that was wrong rather than abandoning the tool.

**`bizapps-sales/apps/*` was deliberately NOT carried over** (spec §2: producer repos contribute
`packages/*` only). It is the sole glob dropped, and dropping it is the point.

**For Marcelo:** the generator should read each member's `pnpm-workspace.yaml` and re-emit its globs
prefixed, rather than assuming `packages/*`. Sales' own file also has comment lines inside the
`packages:` block, which a naive line parser skips past — worth handling.

---

## D-VH10 — Strict peers failed on two React packages; bridged, not disabled

The generated `.npmrc` sets `strict-peer-dependencies=true` (spec §2, the family's standing posture), and
the install exited non-zero on **exactly two** unmet peers — `react@^19.2.8` and `@types/react@^19.2.0`,
both from MJ's `ng-react`, with 19.1.x present.

**Chosen: bridge them in the parent's `pnpm.peerDependencyRules`** (`ignoreMissing` then
`allowedVersions: { react: '19', '@types/react': '19' }`), rather than take pnpm's suggested
`strictPeerDependencies: false`. Nothing on the Sales path — Angular Explorer and MJAPI — loads React, and
turning strict peers off globally would have disabled the check that protects the single-copy census the
whole linking model depends on.

---

## D-VH11 — The host DB needed bizapps-common's schema before Sales', and the error did not say so

Sales' migration failed at batch 11/465 with `Could not create constraint or index`. The real cause:
Sales' IsA extensions (`SalesAccount` → `Organization`, `SalesContact` → `Person`) FK **into
`__mj_BizAppsCommon`**, and the host DB had only `__mj` and `__mj_BizAppsSales`.

**Chosen: apply common's migrations to the host DB first** —
`mj migrate --schema __mj_BizAppsCommon --dir ../bizapps-common/migrations`, 7 applied — then drop the
partial `__mj_BizAppsSales` schema (1 table had landed) and re-run Sales.

`mj migrate` handled common's flyway placeholders fine, so the sqlcmd+sed workaround that
`scripts/rebuild-db.sh` uses in the standalone env was **not** needed here.

**Worth recording as a host-setup rule:** an Open App that extends another app's entities needs that
app's schema in the host database first. The linking spec covers package resolution and says nothing
about this, and the SQL error names neither the missing schema nor the app.
