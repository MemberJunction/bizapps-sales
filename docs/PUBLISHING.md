# Publishing BizApps Sales as an Open App

**Who this is for:** whoever cuts the next release. It is the counterpart to
`docs/WORKSPACE-SETUP.md` — that one gets a stack running on your machine, this one gets the app
onto somebody else's.

---

## What "published" means here, and why it is three things and not one

An MJ Open App is installed with `mj app install https://github.com/MemberJunction/bizapps-sales`.
The install engine then needs **all three** of the following, and the app is unusable if any is
missing:

| # | Artifact | Who produces it | What breaks without it |
|---|---|---|---|
| 1 | The five `@mj-biz-apps/sales-*` packages on npm | `changeset publish`, in `publish.yml` | MJAPI and MJExplorer have no code to load |
| 2 | A **`vX.Y.Z` git tag** whose tree carries `mj-app.json` at that version | `ci/commit_push.mjs`, in `publish.yml` | `ResolveDependencyVersion` finds no candidate and the install fails at resolution |
| 3 | A **metadata seed migration** under `migrations/` | the build engineer, once per release — see below | the app installs with every table and no data; every step reports success |

Number 2 is the one that is easy to get wrong from this repo's history. Before the release
plumbing landed, the packages were published by hand and changesets was configured **without**
`fixed`, so it cut five per-package tags (`@mj-biz-apps/sales-entities@5.1.0`, …) and no `v5.1.0`.
The Open App resolver reads `v{major}.{minor}.{patch}` tags and releases; it cannot see a scoped
tag on a non-subpath app. So the packages existed on npm and the app was still not installable.
`.changeset/config.json` now sets `fixed: [["@mj-biz-apps/*"]]`, which is what makes a release
produce one tag for the whole app.

Number 3 is the one that is easy to get wrong *silently*. `mj-app.json`'s `metadata.directory` is
documentation — MJ's manifest schema says the install engine never reads it. **Seeding happens
exclusively through `migrations/`**, generated at release, not in the PR that added the JSON.
`npm run lint:distribution` checks only that shipped SQL uses placeholders `mj app install` can
resolve (Skyway leaves unknown `${...}` as literal strings). It does **not** prove the seed
contains a given metadata record — that proof is a clean install from migrations, once per release.

---

## The release, end to end

Releases run from `main`. `next` is the integration branch; **never commit to `main` directly** —
the merge is the release trigger.

```bash
# 1. On your feature branch, describe the change. A schema change (anything under migrations/)
#    must be at least a `minor` — publish.yml has a gate that refuses a patch carrying one.
pnpm run change

# 2. Merge the feature branch into next through a PR as usual. CI + the distribution gate run there.

# 3. Release: merge next into main.
git checkout main && git pull
git merge --ff-only origin/next     # or open a next -> main PR
git push origin main
```

Pushing `main` starts `.github/workflows/publish.yml`, which:

1. validates the lockfile's case-sensitivity, migration filenames, that every non-private
   `@mj-biz-apps/*` package already exists on npm, and each package's `repository.url` (npm
   provenance needs it);
2. runs the **distribution gate** — deliberately here as well as in its own paths-filtered
   workflow, so a `workflow_dispatch` release from a branch that touched no metadata cannot ship a
   stale seed;
3. reads the highest bump the pending changesets declare, and **refuses a patch release that
   carries a new migration**;
4. runs `changeset version`, then asserts the resulting version is the one it predicted;
5. rewrites `mj-app.json`'s `version` and derives `mjVersionRange` from
   `packages/Entities/package.json`'s `@memberjunction/core` peer dependency;
6. builds, publishes to npm via OIDC (no token), tags `vX.Y.Z`, pushes `main`, then merges `main`
   back into `next` and refreshes the lockfile.

### After it finishes

```bash
npm view @mj-biz-apps/sales-entities version      # the new version
gh api repos/MemberJunction/bizapps-sales/tags --jq '.[].name' | head -3   # vX.Y.Z present
```

---

## Regenerating the metadata seed — release work, not a PR

This follows MJ (`MJ/metadata/CLAUDE.md` §1b and §10):

1. **PRs contribute declarative JSON only** — fields, `@lookup` / `@file` / `@parent`, and a
   `primaryKey` UUID from `uuidgen`. No `sync` block (the release push writes that back). No
   `*__Metadata_Sync.sql` in the PR.
2. **The build engineer generates ONE consolidated Metadata_Sync per release**, by running
   `mj sync push` against a clean database at the last released version. Naming is
   `V<YYYYMMDDHHMM>__v<X.Y>.x__Metadata_Sync.sql`.
3. **Do not hand-author per-PR sync migrations.** They duplicate the release step, produce many
   small files instead of one per build, and drift from the real push output.

`lint:distribution` is not a currency gate. Nothing in CI currently proves that a metadata record
has a matching seed statement. That hole is known and accepted the same way bizapps-caliber and
bizapps-accounting document it: **the guard is the release process, not a PR gate.** The property
that matters is "can a stranger install this app from migrations alone and get a working one?" —
answered by a clean install from migrations, once per release, asserting that a sample of records
declared in `metadata/` are present afterward (`scripts/rebuild-db.sh` / bootstrap-clean-db).

The seed must be generated against a host where **this app's metadata has never been pushed**, so
that every statement the generator emits is a `spCreate*` rather than an `spUpdate*`. Pushing to a
host that already has the rows produces a file that updates rows a fresh install does not have.

```bash
# 1. A database built from MIGRATIONS ONLY. In dependency order:
#      MJ core, bizapps-common, bizapps-tasks, bizapps-accounting, bizapps-orders, then sales.
#    docs/WORKSPACE-SETUP.md §1-4 covers standing the clones up; the migrate calls are:
DB=MJ_Sales_Seed
DB_DATABASE=$DB pnpm exec mj migrate --schema __mj                    --dir ../MJ/migrations
DB_DATABASE=$DB pnpm exec mj migrate --schema __mj_BizAppsTasks       --dir ../bizapps-tasks/migrations
DB_DATABASE=$DB pnpm exec mj migrate --schema __mj_BizAppsAccounting  --dir ../bizapps-accounting/migrations
DB_DATABASE=$DB pnpm exec mj migrate --schema __mj_BizAppsOrders      --dir ../bizapps-orders/migrations
DB_DATABASE=$DB pnpm run mj:migrate

# 2. Push. `metadata/.mj-sync.json` has sqlLogging enabled, so this writes the SQL as a side effect.
DB_DATABASE=$DB pnpm exec mj sync push --dir metadata --ci
#    -> metadata/sql_logging/push_<timestamp>.sql

# 3. Turn that log into the release Metadata_Sync. ONE substitution and ONE hand edit; both are
#    documented in the header of the current seed, which is the template:
#      * `[__mj].` -> `[${mjSchema}].` everywhere (SP calls AND the JOINs inside seeded query SQL)
#      * re-apply the `IF NOT EXISTS` guard on the single `spCreateCompany` call
#    Sibling schemas (`__mj_BizAppsTasks`, `__mj_BizAppsOrders`) stay literal — `mj app install`
#    supplies only `${mjSchema}` and `${flyway:defaultSchema}`, and neither of those is theirs.

# 4. Placeholders only — there is no hash manifest to bump.
pnpm run lint:distribution
```

### Pending for the next release seed

These records are in `metadata/` and in **no** migration on `next`. The next consolidated
Metadata_Sync must carry them:

| Record | ID | Path |
|---|---|---|
| `Sales.DealLinker` extension | `A7C4E2B1-5D83-4F0A-9C1E-6B8D2F4A90C3` | `metadata/activity-sync-extensions/.activity-sync-extensions.json` |
| `Sales.SyncActivities` action tombstone | `5A1E5000-0000-4000-8000-000000000101` | `metadata/actions/.sales-actions.json` |
| Limit ActionParam tombstone | `5A1E5000-0000-4000-8000-000000000102` | same file, relatedEntities |
| Hourly job tombstone | `5A1E5000-0000-4000-8000-000000000201` | `metadata/scheduled-jobs/.sales-scheduled-jobs.json` |

### Two things to check before you trust the result

**Every `spUpdate*` must target an ID the migrations pin.** The seed updates rows the baseline's
CodeGen half created — 18 `Entity` rows and 32 `EntityRelationship` rows. If CodeGen had generated
those IDs with `NEWID()`, an update keyed to the one on *your* machine would target nothing on
anybody else's and would do it silently. Today all 50 are pinned as literals in
`V202608042101__v0.1.x__Tables_and_Objects.sql`. Check it, case-insensitively — CodeGen writes its
UUIDs lowercase and MetadataSync reads them back uppercase, so a case-sensitive grep reports a
false miss.

**Anything new the seed writes into `__mj` needs a teardown root.** `migrations-teardown/` retires
the seed's payload from the shared core schema on `mj app remove`; a row that is seeded but not
retired survives the remove and collides on its fixed UUID at the next install. The exception is
`Company`, and the reasoning for it is in both files — read it before adding a second exception.

### Proving it, rather than assuming it

The claim is that a database built from migrations alone ends up in the same state as one that had
`mj sync push` run against it. That is checkable and worth checking:

```sql
-- run against both, compare
SELECT 'entities', CHECKSUM_AGG(BINARY_CHECKSUM(e.ID, ISNULL(e.Icon,''), ISNULL(e.DisplayName,''),
       ISNULL(e.Description,''), ISNULL(CAST(e.ParentID AS char(36)),''))), COUNT(*)
FROM __mj.Entity e WHERE e.SchemaName='__mj_BizAppsSales'
UNION ALL
SELECT 'relationships', CHECKSUM_AGG(BINARY_CHECKSUM(er.ID, ISNULL(er.RelatedRecordCollection,''),
       ISNULL(er.DisplayLocation,''), ISNULL(CAST(er.Sequence AS int),-1))), COUNT(*)
FROM __mj.EntityRelationship er
WHERE er.EntityID IN (SELECT ID FROM __mj.Entity WHERE SchemaName='__mj_BizAppsSales');
```

A row count that matches while a checksum does not is the interesting failure: it means the seed
created the right *number* of things and not the right things.

---

## Adding a new publishable package

New `@mj-biz-apps/*` packages must exist on npm before `publish.yml` can publish them — the
workflow checks and fails early rather than partially publishing. This mirrors MJ's own
`NEW_PACKAGE_SETUP.md`.

```bash
npx setup-npm-trusted-publish @mj-biz-apps/sales-<name>
```

Then in the npm UI, under the package's **Settings → Publishing**, add a trusted publisher:
GitHub Actions · organization `MemberJunction` · repository `bizapps-sales` · workflow
`publish.yml` · environment blank.

A package marked `private: true` is skipped — changesets never publishes it, so it needs no
placeholder. `@mj-biz-apps/sales-integration-tests` is the one in this repo.

---

## Version policy

`fixed` versioning moves all five packages, `mj-app.json` and the git tag together, so there is one
number to reason about.

- **minor** — any change under `migrations/`. This is enforced, not conventional: `publish.yml`
  fails a patch release that carries a new migration.
- **patch** — code-only changes.
- **major** — a breaking schema change. Read
  [`PUBLISH_NO_BREAK_POLICY.md`](https://github.com/MemberJunction/MJ/blob/next/packages/OpenApp/PUBLISH_NO_BREAK_POLICY.md)
  first: within a published major, only additive schema changes are allowed. The baseline
  (`V202608042101`) was edited in place pre-publication; **that practice ends at the first
  release** and its own header says so. From here, schema changes are new `V…` files.

The dependency ranges in `mj-app.json` are resolved against the sibling repos' published tags, not
their `main` branches — `>=5.33.0 <6.0.0` for common, `>=1.2.0 <2.0.0` for tasks (the seed writes
`TaskType.Code`, which arrives in 1.2.x), `>=5.1.0 <6.0.0` for orders, `>=0.2.0 <1.0.0` for
accounting, `>=0.1.1 <1.0.0` for contracts. A range no published tag satisfies fails the install at
resolution with `no published version at … satisfies`; two of these were in exactly that state
before the first Open App release.
