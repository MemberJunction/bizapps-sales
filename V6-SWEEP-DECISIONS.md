# v6 date sweep + ProductID spec — decisions queued

---

## D-SW1 — The sweep found no *additional* date bugs, and that is a result rather than a shortfall

I enumerated all **19 date columns** in `__mj_BizAppsSales` from the live schema (not from memory), then
grepped every string operation, comparison, sort, `padStart`, template binding and date pipe against
them. **Every remaining site is already safe**, and the two fixes in `7e55bae` are the whole set.

**Why one fix covered so much, and it is worth knowing:** Sales funnels every date into the workspace
through **one** normalizing helper, `toDateInput` in `deal-workspace.service.ts` — seven call sites, all
seven of the draft's date fields. Fixing that boundary fixed every input bound to it. The roster path
bypasses the draft, which is why `SlippedDeals` needed its own `UtcDatePart` and was the second fix.

**The lesson for #89:** the single-boundary shape is what made this cheap. If the rework spreads date
mapping across components, the next shape change costs one fix per component instead of one per boundary.

Full site-by-site table in `V6-SWEEP-RUN-REPORT.md`.

---

## D-SW2 — `deal-draft.ts`'s date comparison is left as a string compare, deliberately

`deal-draft.ts:364` validates `line.ServicePeriodEnd < line.ServicePeriodStart` — a lexicographic
comparison of two `string | null` fields.

**Chosen: leave it.** It is correct *by contract*: every date entering a `DealDraft` passes through
`toDateInput`, which now returns `yyyy-MM-dd` or `null` for both input shapes. Lexicographic ordering on
`yyyy-MM-dd` is chronological ordering, and it stays correct even if a full ISO timestamp arrives.

**The risk is documented rather than removed:** the draft's `string | null` typing is only true because
that boundary holds. If a future path writes a raw `Date` into a draft, this comparison degrades silently
(`Date < Date` compares by valueOf, which happens to still work; `Date < string` does not). The durable
fix is to keep the boundary, not to defensively re-normalize inside every consumer — which would spread
the exact thing D-SW1 says made this cheap.

---

## D-SW3 — `DealLine.ProductID`: recommend keeping the soft reference **for #89**, contradicting #93's FK position

Issue **#93 says FK**. The spec (`docs/deal-line-product-spec.md` §2) recommends **keeping the soft
reference for the form work** and treating the FK as a separate, later decision.

**The reasoning is sequencing, not principle.** A real FK to `__mj_BizAppsOrders.Product` **ends
standalone Sales**: `rebuild-db.sh`, CI and every dev environment would need orders' schema present, and
the migration would fail without it. That cost is paid immediately by everyone, *before* the consolidated
environment that would justify it exists. We already hit the softer version of this hazard on the v6 host
— Sales' migration failed because its IsA extensions FK into `__mj_BizAppsCommon` and common had not been
applied, with an error naming neither.

**It is reversible in the direction that matters:** soft → FK is an additive migration later; FK → soft is
a retreat. The column shape is identical either way, so nothing in the #89 form design changes with the
answer.

**Needs a ruling.** If the team takes #93's FK now, the work is an additive migration plus adding orders
to Sales' rebuild script and CI — not a redesign.

---

## D-SW4 — The ProductID picker has an unmet prerequisite that is host setup, not Sales work

The spec's picker queries `MJ_BizApps_Orders: Products`. **Orders is not a member of the linked v6
workspace and its schema is not in `MJ_V6_Host`** — only `__mj`, `__mj_BizAppsCommon` and
`__mj_BizAppsSales` are.

**Chosen: state it in the spec and stop there.** Adding orders as a fourth workspace member and migrating
its schema is a host-setup task with its own ordering constraints; doing it speculatively tonight would
have expanded a spec-only track into another multi-hour environment build. It gates *end-to-end testing*
of the picker, not the #89 form design.

---

## D-SW5 — Playwright re-verification was run before the session could lapse

The brief said not to re-authenticate if the MSAL session had expired. It had **not** — the session
captured during Josue's login was still live, so the full UI verification re-ran and confirmed the date
fixes in the running host (dates bind, roster renders, panes populate).

**Recorded because the reverse would have been a real limitation:** with an expired session the code
fixes would still stand on build + integration evidence alone, and the UI claim would have had to be
marked unverified rather than quietly asserted.
