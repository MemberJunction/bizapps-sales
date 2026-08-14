---
'@mj-biz-apps/sales-entities': minor
'@mj-biz-apps/sales-actions': minor
'@mj-biz-apps/sales-server': minor
'@mj-biz-apps/sales-core-entities-server': minor
'@mj-biz-apps/sales-ng': minor
---

MemberJunction v6 and pnpm.

Every `@memberjunction/*` dependency moves to **6.1.0-edge.2** and the repo moves from npm to
**pnpm 10.33.0** (`packageManager`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`; `package-lock.json` deleted,
npm's `overrides` moved to `pnpm.overrides`). `@mj-biz-apps/common-*` goes to `^5.33.2` — the 5.x version
number is misleading, that build's published peers already require MJ `^6.1.0-edge.0`. `mj-app.json`'s
`mjVersionRange` is now `>=6.0.0 <7.0.0`, and CI runs under pnpm.

**`apps/` is retired.** Sales no longer ships its own MJAPI and MJExplorer, because an Open App runs
*inside* an MJ host — and because those shells were named `mj_api`/`mj_explorer`, colliding with the host's
own in a linked workspace. Consumers who ran `pnpm run start:api` / `start:explorer` must now start the
host's servers instead; see `docs/QA-GUIDE.md`.

**Three v6 behaviour fixes**, all one root cause: v6 hands back `Date` objects where v5 handed back ISO
strings. `.slice()` on a date threw and took the dashboard down; `toDateInput` returned a `Date` an
`<input type="date">` renders blank; and the roster's `date` pipe formatted UTC-midnight values in local
time, showing the wrong day. Date handling now accepts either shape with UTC getters throughout, and the
row types say `string | Date | null` because that is what actually arrives.
