---
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-actions": minor
"@mj-biz-apps/sales-server": minor
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-ng": minor
---

Ship BizApps Sales as an installable Open App.

The npm packages have been published since 5.1.0, but the app itself could not be installed: there
was no release workflow, no `vX.Y.Z` tag for the Open App resolver to find, two dependency ranges
that no published version could satisfy, and — the substantive one — no metadata seed.

- **`migrations/V202608251930__v5.2.x__Metadata_Sync.sql`.** MJ never reads `mj-app.json`'s
  `metadata.directory` at install; seeding happens exclusively through `migrations/`. Until this
  file, all 22 directories under `metadata/` shipped nowhere, so a clean `mj app install` produced
  every table, view and CRUD proc and no deal status types, no pipelines, no stages, no queries, no
  actions, no remote operations and no application. Every install step reported success. 424
  creates, all with hardcoded UUIDs; 50 updates, every one keyed to an ID the baseline pins.
- **`migrations-teardown/V001__Retire_Sales_Core_Rows.sql`** retires that payload from the shared
  core schema on `mj app remove`, so a reinstall does not collide on the same fixed UUIDs. The
  seeded placeholder `Company` is deliberately excluded — 30 NOT NULL keys point at `Company`
  across core, accounting and orders — and the seed's one `spCreateCompany` is guarded instead.
- **`scripts/check-distribution-seed.mjs`** (+ self-test, + `Distribution Gate` workflow) fails the
  build when metadata changes without the seed being regenerated, and when shipped SQL carries a
  placeholder `mj app install` cannot resolve.
- **Dependency ranges corrected.** `mj-bizapps-common` asked for `>=1.0.0 <2.0.0` and
  `mj-bizapps-orders` for `>=0.1.0 <1.0.0`; the only published versions are `5.x` in both cases, so
  install would have failed at resolution. `mj-bizapps-tasks` is raised to `>=1.2.0` because the
  seed writes `TaskType.Code`, which arrives in 1.2.x.
- **`fixed` versioning + `publish.yml`**, so a release cuts one `vX.Y.Z` tag — the form the Open App
  version resolver reads — instead of five per-package tags.
