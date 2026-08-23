# Explorer rework prep — decisions queued

Calls made while producing the #89 plan and validating the composition mechanism. The **design** questions
are deliberately *not* decided here — they are the sign-off items in
`docs/explorer-ux-rework-plan.md` §8.

---

## D-XR1 — The validation was reverted, and the branch left exactly as committed

Track 2 asked for composition to be proven **and** for the branch to still build 8/8. Those turned out to
be mutually exclusive (see D-XR2), so a choice was needed.

**Chosen: prove it, capture the evidence, then revert everything.** `feature/mj6-pnpm-conversion` is
byte-identical to commit `f90a64e`, the two `EntityRelationship` rows are back to `NULL`, and a full
rebuild after the revert confirms **8/8**.

The metadata is preserved verbatim in the plan (Appendix A) so re-applying it is a two-minute job. The
alternative — leaving it enabled — would have parked the conversion branch in a state that does not
compile, on work that is explicitly waiting for sign-off.

---

## D-XR2 — Composition is NOT an additive change, and that reshapes the plan

The most consequential finding of the night. Enabling the collections while `DealEntityServer` still has
its hand-rolled `Lines` / `PaymentSchedule` accessors fails the build with **exactly four errors, all in
that one file**:

```
error TS2611: 'Lines' is defined as a property in class 'mjBizAppsSalesDealEntity',
              but is overridden here in 'DealEntityServer' as an accessor.
```

**Nothing else broke** — which is the good news: the incompatibility is a name collision, not a
v6 problem.

**Consequence:** the metadata switch and the retirement of the hand-rolled collections are **one atomic
change**, rippling to **48 call sites across 6 files**. Phase 2 of the plan is sized accordingly. Anyone
estimating "turn on composition" as a small metadata edit would be wrong by that margin.

---

## D-XR3 — Only Lines and PaymentSchedule were enabled; the other three were left alone

Scope discipline, per the brief.

**Chosen: exactly the two named**, verified in the database (2 sales rows carried the config, MJ core's
own 8 untouched). Stage Events, Team Members and Contact Roles each need a design call and are Q1 in the
plan — with a recommendation for each, including the **read-only** shape for the append-only
`DealStageEvent`, which accounting already uses for `Members`.

---

## D-XR4 — The collection config mirrors what `SaveDeal` already does, rather than inventing semantics

`OnRemove: 'delete'` matches the operation's documented "a present array is the complete desired set".
`Sequence: { Field: 'DisplayOrder', From: 1 }` matches its re-sequencing from array order (integration
check SD7), and `DisplayOrder` is `NOT NULL` so something must maintain it. `Load: 'explicit'` because
the normal payment schedule is **zero rows** and a deal should not pay for a child query it usually does
not need.

Deliberately **not** set: `RelatedEntity` / `RelatedEntityJoinField`. They are already columns on the
same `EntityRelationship` row, and accounting's comments warn that duplicating them creates two sources
of truth with the JSON copy winning silently.

---

## D-XR5 — The vendored workspace-tabs directory can be retired, and I nearly reported the opposite

`mj-workspace-card` **has** landed in MJ v6 —
`@memberjunction/ng-ui-components/dist/lib/workspace-tabs/`, shipping the same five files Sales vendored.
The v6 component's inputs are a **1:1 match** with what `deal-workspace.component.html` already binds, so
the swap is an import change rather than a rewrite.

**Worth flagging:** my first probe reported it absent, because the loop short-circuited on an unrelated
file (`tab-chrome-guard`). The corrected check is a direct `grep -rl` across all MJ packages. The
plan's Phase 1 rests on this, so it is stated here with the evidence rather than as an assertion.

This also closes decision **D8** (the vendoring decision), whose own `VENDORED.md` named MJ core as the
intended home and said the copy should be replaced "the moment it lands upstream".

---

## D-XR6 — `bizapps-contracts` is a layout template only, not a v6 reference

The brief names contracts as the copy template. Its `origin/next` is still on `package-lock.json` with no
pnpm/v6 conversion (last commit 2026-08-06).

**Chosen: copy layout and shell conventions from contracts, but nothing about dependencies, MJ versions
or entity patterns** — take those from accounting, which is converted and has already done the
composition migration. Recorded as Q5 in the plan, since it may mean Sales sets the family's v6
precedent rather than following one.

---

## D-XR7 — The common fix needs THREE changes, not the one the brief assumed

Track 3 was framed as "bump `generic-database-provider` floor to `^6.1.0-edge.2`". That alone is
insufficient. Verified by doing it, one failure at a time:

1. **Bump the peer floor** to `^6.1.0-edge.2` — necessary, and by itself installs *nothing*, because
   common declares it **only** as a `peerDependency` with no local provider.
2. **Anchor it in root `devDependencies`** at `6.1.0-edge.2` — the pattern orders and sales already use.
   Now it resolves… and still fails at runtime.
3. **Bump `pnpm.overrides` for `@memberjunction/core` and `@memberjunction/global`** from exact
   `6.1.0-edge.0` to `6.1.0-edge.2`. Without this the import dies with
   `'@memberjunction/global' does not provide an export named 'IsPlainObject'` — edge.2's
   generic-database-provider needs a newer `global` than common's own override was pinning.

After all three, `typeof UserCache === 'function'`. **This matters for the team's ask:** a PR that only
bumps the floor will look correct, install cleanly, and still not work.

---

## D-XR8 — Common was modified only in a detached scratch worktree

Track 3 required editing another team's repo.

**Chosen: a detached `git worktree` at `origin/next`** (`C:\Dev\cmn7`), with all three edits confined to
it. `bizapps-common` itself was never checked out, never modified, and remains clean on `main`. Nothing
was published and nothing was pushed. The three edits are recorded in D-XR7 precisely enough to be
re-applied by whoever owns that repo.
