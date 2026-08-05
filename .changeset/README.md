# Changesets

This folder is managed by [`@changesets/cli`](https://github.com/changesets/changesets). Each `*.md`
file here (other than this one) describes one user-visible change and the version bump it deserves;
`changeset version` consumes them, rolls the package versions and writes the changelog.

## The rule for this repo

**A PR that adds or edits anything under `migrations/`, or changes a published package, MUST carry a
changeset with at least a `minor` bump.** Create one with:

```bash
npx changeset
```

CI emits a **warning** — not a failure — when a PR has none. That is deliberate: a hard gate would put a
red X on documentation-only PRs that legitimately have no version impact, and the sibling repo's
experience is that such an X is quickly learned and then ignored. Treat the warning as a review item.

`baseBranch` is **`next`**, the integration branch, not `main`. `main` is the release branch and only
ever receives the coordinating release PR.

`@mj-biz-apps/sales-integration-tests` is in `ignore` because it is `private: true` — it is never
published, so it has no version anyone consumes.
