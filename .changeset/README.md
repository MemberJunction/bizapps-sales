# Changesets

This folder is managed by [`@changesets/cli`](https://github.com/changesets/changesets). Each `*.md`
file here (other than this one) describes one user-visible change and the version bump it deserves;
`changeset version` consumes them, rolls the package versions and writes the changelog.

## The rule for this repo

**Every PR that changes a published package must carry a changeset.** Create one with:

```bash
npx changeset
```

**The bump level follows semver, and `minor` is required for exactly two things:** anything under
`migrations/`, and any change to a package's public API — a removed or renamed export, a changed
exported signature, a new required argument. Everything else is `patch`: user-facing copy, UI
behaviour, and server-side fixes that keep their signatures. `major` is for a break a consumer
cannot absorb by reading the CHANGELOG.

> This file used to say *"or changes a published package, MUST carry a changeset with at least a
> `minor` bump"*. That is stricter than MJ's rule and stricter than what this repo actually merges,
> and it produced one wrong review finding before anyone checked it against practice. `CLAUDE.md`
> was corrected; this file was not, so the two contradicted each other on a rule that had already
> misled a review once. See **Changesets** in `CLAUDE.md`, which remains the fuller statement.

CI emits a **warning** — not a failure — when a PR has none. That is deliberate: a hard gate would put a
red X on documentation-only PRs that legitimately have no version impact, and the sibling repo's
experience is that such an X is quickly learned and then ignored. Treat the warning as a review item.

`baseBranch` is **`next`**, the integration branch, not `main`. `main` is the release branch and only
ever receives the coordinating release PR.

`@mj-biz-apps/sales-integration-tests` is in `ignore` because it is `private: true` — it is never
published, so it has no version anyone consumes.
