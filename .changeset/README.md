# Changesets

This folder is managed by [`@changesets/cli`](https://github.com/changesets/changesets). Each `*.md`
file here (other than this one) describes one user-visible change and the version bump it deserves;
`changeset version` consumes them, rolls the package versions and writes the changelog.

## The rule for this repo

**Every PR that changes a published package or anything under `migrations/` must carry a
changeset.** Create one with:

```bash
pnpm run change    # the changesets CLI; `npx changeset` is the same
```

**The bump level follows semver, and `minor` is required for exactly two things:** anything under
`migrations/`, and any change to a package's public API — a removed or renamed export, a changed
exported signature, a new required argument. Everything else is `patch`: user-facing copy, UI
behaviour, and server-side fixes that keep their signatures. `major` moves only with
MemberJunction's major version (this repo went to 6.x with MJ 6), and a schema change that is not
additive waits for it; MJ's
[`PUBLISH_NO_BREAK_POLICY.md`](https://github.com/MemberJunction/MJ/blob/next/packages/OpenApp/PUBLISH_NO_BREAK_POLICY.md)
lists what counts as additive.

`fixed: [["@mj-biz-apps/*"]]` in `config.json` moves every package in this repo to one version. The
level you pick sets that version and the CHANGELOG entry, not which packages move, so a migration-only
change can name any `@mj-biz-apps/*` package.

CI emits a **warning** — not a failure — when the PR adds no changeset. It compares the PR against
its base branch, so a changeset another PR left pending on `next` does not count. Warning rather than failing is deliberate: a hard gate would put a red X on documentation-only PRs
that legitimately have no version impact, and the sibling repo's experience is that such an X is
quickly learned and then ignored. Treat the warning as a review item.

The `migrations/` half of the rule is enforced: the `migration changeset` check fails a PR into `next`
that adds a migration with only a patch changeset, and `rr: minor bump` fails the release PR. Nothing
checks the public-API half.

`baseBranch` is **`next`**, the integration branch, not `main`. `main` is the release branch and only
ever receives the coordinating release PR.

`@mj-biz-apps/sales-integration-tests` is `private: true`, so `changeset publish` skips it; it still
versions with the `fixed` group. It is not in `ignore`, and should not be: `changeset version` refuses
a changeset that names both ignored and non-ignored packages.
