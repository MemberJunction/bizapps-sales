# Explorer rework prep (#89) — run report

All three tracks attempted. **No UI was built** and **nothing was committed or pushed** — the conversion
branch is byte-identical to where it started.

**Read first:** `docs/explorer-ux-rework-plan.md` §8 — the five sign-off questions for Matt/Robert/Amith.
Then **D-XR7** below, which changes the ask you make of the bizapps-common team.

---

## Track 1 — the rework plan ✅

**`docs/explorer-ux-rework-plan.md`** (untracked, in the main checkout alongside `QA-GUIDE.md` and
`consolidation-notes.md`). Grounded in code, with file and line citations throughout. It covers:

- **The v6 target patterns**, each verified present in `6.1.0-edge.2` rather than assumed —
  `DeclareRelatedRecords`, `BaseFormComponent`/`NavigationService`, and the Explorer tab surface.
- **A current → target map** for every piece of Sales' custom UI, with line counts and a
  RETIRE / REPLACE / KEEP verdict each.
- **What must not be lost** when `DealDraft` (497 lines) and `SaveDealOperation` (325) retire — seven
  rules with a named new home apiece. This is the section most likely to prevent a silent regression.
- **A five-phase sequence**, each phase shippable and green.
- **Reference apps**, with a caveat: contracts is a *layout* template only (still pre-v6).
- **Five open questions**, chiefly which relationships become collections — with a recommendation and
  reasoning for all five Deal relationships.

### The finding that shaped the plan

**`mj-workspace-card` has landed in MJ v6** (`@memberjunction/ng-ui-components/dist/lib/workspace-tabs/`),
shipping the same five files Sales vendored — and its inputs are a **1:1 match** with what
`deal-workspace.component.html` already binds. So the 473-line vendored directory retires via an import
swap, which is why it is Phase 1: cheapest possible proof the v6 UI surface works.

This closes decision **D8**, whose own `VENDORED.md` said the copy should go "the moment it lands
upstream". Flagged in D-XR5 because my first probe reported the opposite — it short-circuited on an
unrelated file, and the corrected check is recorded.

---

## Track 2 — composition validated ✅ (with a consequential caveat)

**Composition generates real, typed, writable collections for Sales.** Declaring
`RelatedRecordCollection` on Deal → Deal Lines and Deal → Deal Payment Schedules and re-running CodeGen
(files-only pass, per the two-pass rule) emitted onto the **generated** `mjBizAppsSalesDealEntity`:

```typescript
public readonly Lines = this.DeclareRelatedRecords<mjBizAppsSalesDealLineEntity>({
    Name: 'Lines',
      RelatedEntity: 'MJ_BizApps_Sales: Deal Lines',
      RelatedEntityJoinField: 'DealID',
      OrderBy: 'DisplayOrder ASC',
      Load: 'explicit',
      OnRemove: 'delete',
      Source: 'database',
      Sequence: { Field: 'DisplayOrder', From: 1 },
});

public readonly PaymentSchedule = this.DeclareRelatedRecords<mjBizAppsSalesDealPaymentScheduleEntity>({
    Name: 'PaymentSchedule',
      RelatedEntity: 'MJ_BizApps_Sales: Deal Payment Schedules',
      RelatedEntityJoinField: 'DealID',
      OrderBy: 'DisplayOrder ASC',
      Load: 'explicit',
      OnRemove: 'delete',
      Source: 'database',
      Sequence: { Field: 'DisplayOrder', From: 1 },
});
```

Generated on the **generated** class, so the browser gets them too — which is the whole point. The v6
collection API is `Load` / `LoadEager` / `Create` / `Add` / `Remove` / `Clear`, i.e. genuinely writable.

Scope held exactly: the database showed **2** sales relationships carrying config (MJ core's own 8
untouched); Stage Events, Team Members and Contact Roles were left alone.

### Did it build 8/8? No — and that is the finding, not a failure

With the collections **and** `DealEntityServer`'s hand-rolled ones both present, the build fails with
**exactly four errors, all in one file**:

```
src/DealEntityServer.ts(79,16): error TS2416 / TS2611 — 'Lines' is defined as a property in class
'mjBizAppsSalesDealEntity', but is overridden here in 'DealEntityServer' as an accessor.
```

…and the identical pair for `PaymentSchedule`. **Nothing else in the app broke**, so the incompatibility
is a name collision, not a v6 problem.

**Consequence: turning composition on is not an additive step.** The metadata switch and the retirement
of the hand-rolled collections are one atomic change, rippling to **48 call sites across 6 files**
(`deal-workspace.component.ts`, `deal-workspace.service.ts`, `DealEntityServer.ts`,
`SaveDealOperation.ts`, `deal-draft.ts`, `save-deal.checks.ts`). Phase 2 of the plan is sized to that.

Since retiring those collections *is* the rework — explicitly out of scope tonight — **the validation was
reverted**: metadata cleared from the v6 DB, generated file restored, and a full rebuild confirms
**8/8 green**. The exact JSON is preserved in the plan's Appendix A, ready to re-apply.

---

## Track 3 — the common fix is CONFIRMED, and needs more than the team thinks ✅

Done in a detached scratch worktree of common's `origin/next`; **bizapps-common itself was never touched**
and is still clean on `main`.

**Confirmed: `UserCache` resolves and common builds 5/5.** But the ask in the brief — "bump the
`generic-database-provider` floor to `^6.1.0-edge.2`" — is **not sufficient on its own**. Three changes
are required, discovered one failure at a time:

| # | Change | Without it |
|---|---|---|
| 1 | `packages/CoreEntitiesServer` peer floor → `^6.1.0-edge.2` | edge.1 resolves, which has no `UserCache` at all |
| 2 | Anchor `@memberjunction/generic-database-provider: 6.1.0-edge.2` in **root `devDependencies`** | it is declared *only* as a peer, so nothing installs it — `pnpm install` succeeds and the package is simply absent |
| 3 | `pnpm.overrides` for `@memberjunction/core` **and** `@memberjunction/global`: exact `6.1.0-edge.0` → `6.1.0-edge.2` | import dies with `'@memberjunction/global' does not provide an export named 'IsPlainObject'` — edge.2's provider needs a newer `global` than common's own override pinned |

After all three: `typeof UserCache === 'function'`, and `pnpm run build` → **5/5 successful**.

**Why this matters for the ask:** a PR that only does #1 will look right, install cleanly, and still not
work. Give the common team all three.

### What I could not confirm

**Whether Sales' MJAPI then starts.** I linked the locally-built fixed common into the sales v6 worktree
(on port 4142, so your running v5 servers were never touched) and the API still failed — but with an
opaque `[Object: null prototype] {}` at 3.6s and **no error message**, which I could not attribute.

Cross-store `link:` overrides are a plausible cause — two pnpm stores can yield duplicate
`@memberjunction/*` / `reflect-metadata` / `type-graphql` copies, the single-copy hazard CLAUDE.md warns
about — but I probed for that and the result was inconclusive, so I am **not** claiming it. What is
established: the fix is confirmed at the build and module-resolution level; end-to-end startup remains
unverified and should be re-tested against a real published common rather than a cross-store link.

---

## Decisions queued

`EXPLORER-REWORK-DECISIONS.md`, D-XR1 … D-XR8. The two worth reading are **D-XR2** (composition is atomic,
48 call sites) and **D-XR7** (the three-part common fix).

---

## Environment — everything intact

- **v5 is untouched.** `MJ_BizAppsSales` never opened; the main checkout is still on
  `feature/deal-line-product-ref` with its pre-existing drift and its `.env` still pointing at the v5 DB
  and port 4141. **Your running v5 servers were never stopped** — the v6 API experiment used port 4142
  precisely to avoid that.
- **`C:\Dev\wtv6` is pristine**: `git status` clean apart from its own gitignored `.env`, identical to
  commit `f90a64e`, rebuilt and verified **8/8**. `GRAPHQL_PORT` restored to 4141, common overrides
  removed, `pnpm install` restored to the committed lockfile.
- **`MJ_BizAppsSales_V6`**: the two validation rows cleared back to `NULL`; MJ core's own 8 intact.
- **Branches unchanged, nothing pushed.** No commits were made tonight on any branch.
- **bizapps-common untouched** — clean, on `main`. All Track 3 edits were confined to a detached
  worktree.
- **Deliverables are untracked**: `docs/explorer-ux-rework-plan.md`, `EXPLORER-REWORK-DECISIONS.md`,
  this report.

### Leftovers

- `C:\Dev\cmn7` — the common scratch worktree with the verified fix in it. **Kept deliberately**: it is
  the working proof of D-XR7, so whoever writes the common PR can diff it. De-register with
  `git -C C:\Dev\MJ\bizapps-common worktree remove --force C:\Dev\cmn7`.
- `C:\Dev\cmn6` — last session's locked scratch dir, still undeletable (a `rollup...node` held by an
  unattributable node process). Harmless; goes after a reboot.

## Suggested next steps

1. **Get §8 answered** — especially Q1 (which relationships become collections). Everything in Phase 2
   depends on it.
2. **Send the common team all three changes from D-XR7**, not just the floor bump.
3. **Phase 1 is safe to start now** — retiring the vendored tabs needs no sign-off and no API.
