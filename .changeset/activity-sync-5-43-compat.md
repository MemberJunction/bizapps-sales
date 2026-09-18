---
'@mj-biz-apps/sales-core-entities-server': patch
---

Integration checks compile against `common-activity-sync` 5.43.0, which is what the host already runs.

`packages/IntegrationTests` did not build against 5.43.0. CI was green only because `pnpm-lock.yaml`
pinned **5.37.0** — the declared range was `^5.37.0`, which resolves 5.43.0 on any install that does not
honour the lockfile, and on any workspace with a local `bizapps-common` checkout linked in.

**It silently disabled the mutation harness.** `mutate-checks.mjs` builds before applying each mutation,
so every mutation reported `BUILD FAILED` and then `skipped` — a skip, not a failure, which is the exact
shape `docs/CHECK-MUTATION-EVIDENCE.md` exists to warn about. The harness is how this repo proves a check
can fail, and it could not run at all for anyone resolving 5.43.

Two breaking changes had landed in common between 5.37 and 5.43, both inside a **minor** bump:

- **`NormalizedItem.HasAttachments` became required** (`4ad78ac`, *"honour IncludeAttachments instead of
  ignoring it"*). The `item()` fixture built the object without it; it now passes `false`, the honest
  default for a fixture carrying no attachments.
- **`MSGraphCalendarSyncProvider`'s second constructor argument is now an `ActivityMessageTransport`**
  (`Describe` / `IsLive` / `Fetch` returning a `RawBatch`) rather than a Graph client exposing
  `GetEvents()`. AC21's stub is rewritten to that seam, carrying the same raw Graph event, so what the
  check claims is unchanged — only the seam moved. `IsLive: true` is deliberate: before 5.43 the provider
  hard-coded it, and `FetchRaw` refuses only when live AND not allowed, so `false` would take the other
  branch and quietly stop testing the path AC21 was written for.

The range moves to `^5.43.0` and the lockfile follows, so the declared dependency now says what the code
actually requires. The MJ host in the linking spike already runs 5.43.0, so sales' server code was
executing against 5.43 while its tests compiled against 5.37 — those should not disagree.

No behaviour change: two test fixtures and a dependency range.
