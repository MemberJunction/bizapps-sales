---
'@mj-biz-apps/sales-entities': patch
---

Move to MJ `6.1.0-edge.5`, and fix two stale root self-references that had the lockfile unbuildable.

`pnpm install --frozen-lockfile` failed on **both `next` and `main`**, so the next release would have
died at step one of `publish.yml`. Two root `package.json` entries pointed at versions that no longer
exist in this workspace:

| entry | was | problem |
|---|---|---|
| `@mj-biz-apps/sales-integration-tests` | `^5.0.0` | package is `private: true` and now `6.0.0`; the range no longer matched the workspace copy, so pnpm fell back to the registry — where a private package does not exist (`is not in the npm registry`) |
| `@mj-biz-apps/sales-server` | `^5.0.0` | resolved to the **published 5.2.0** copy instead of the workspace one, pulling a second, stale MJ tree at `6.1.0-edge.3` alongside the current one |

Both are now `workspace:*`, which cannot drift as versions move.

The second is the one worth noting: two copies of `@memberjunction/core` in one tree is exactly what
splits the ClassFactory registry. After the fix a clean install resolves **one** MJ core, at edge.5,
with zero `edge.3` packages anywhere.

Every `@memberjunction/*` dependency now uses `^6.1.0-edge.5` — caret, never exact — matching the
convention bizapps-orders adopted for the same reason.

Verified: `--frozen-lockfile` exits 0, build 6/6, and all seven gates pass (unit, vocabulary, money,
distribution, spec, discount, validation).
