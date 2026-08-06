# VENDORED CODE — do not edit these files

Everything in this directory is a **verbatim copy** of code that belongs to another repository. It is
here because of a decision (D8), not because it was written here.

## Where it came from

| | |
|---|---|
| **Source repo** | `bizapps-accounting` |
| **Source path** | `packages/Angular/src/lib/transfer-pending/workspace-tabs/` |
| **Commit** | `4eacf247f4d56a6c47d9f287d3452466578aa1c9` (2026-07-29) |
| **Author of the design** | Marcelo, dated in the file headers (2026-07-16 mockup round 2, 2026-07-21 thin-wrapper note) |

Files: `workspace-card.component.{ts,css}` · `workspace-tab-strip.component.{ts,css}` ·
`workspace-tabs.types.ts` · `workspace-tip.directive.ts` · `workspace-tab-store.ts`

## Why a copy and not an import

`mj-workspace-card` is the frame every workspace screen in this family shares, and re-inventing it
would guarantee three apps that look almost alike. But it cannot be imported here:

1. **It is not published.** It lives inside accounting's own Angular package, which sales does not
   depend on.
2. **Sales must stay standalone this phase.** Depending on accounting would create the cross-app edge
   the Phase 1 brief explicitly forbids, and would drag accounting's whole dependency graph in behind
   it for one card component.
3. **Its upstream home is MJ core, not accounting.** The source directory is called
   `transfer-pending` for exactly that reason — it is staged to move into MJ core. Building against
   accounting's copy would mean depending on a path that is *known* to be temporary.

Copying is the smaller wrong answer, and it is a decision on record rather than an accident.

## The rule while it lives here

**Do not edit these files.** They are byte-identical to the upstream commit above, and that is
load-bearing: it means `diff` against the upstream (or eventually the MJ core) version returns
nothing, so the day this lands in core the swap is a *deletion plus an import change*, not an
archaeology exercise reconstructing which local edits mattered.

If something needs to change:

- **Behaviour that only sales wants** → wrap or compose around the card in
  `packages/Angular/src/lib/workspace/`, where sales code belongs. The card is deliberately thin and
  slotted (`[workspaceHeader]`, the default body slot, `[workspaceFooterNote]`), so almost everything
  can be projected in rather than edited.
- **A genuine bug in the card itself** → fix it **upstream**, in accounting or in core, and re-copy
  the whole directory. Then update the commit hash in the table above.

## How to retire this directory

When `mj-workspace-card` ships in MJ core:

1. `diff -r` this directory against the core version. It should be empty or explainable.
2. Delete this directory.
3. Repoint the imports in `packages/Angular/src/lib/workspace/` at the core package.
4. Drop `@angular/cdk` from `packages/Angular/package.json` if nothing else needs it (the tab strip's
   drag-to-reorder is the only current consumer).

## Dependency note

`workspace-tab-strip.component.ts` imports `@angular/cdk/drag-drop` for tab reordering. `@angular/cdk`
is declared as a peer dependency of `@mj-biz-apps/sales-ng` **because of this vendored code only** —
which is why step 4 above exists.
