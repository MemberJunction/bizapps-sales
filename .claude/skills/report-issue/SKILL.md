---
name: report-issue
description: File a bug on the right MemberJunction / BizApps repo with the house fields (what happened, steps, confidence, environment, severity, target line, duplicate search), after searching for duplicates and judging them. Use when the user says "report this", "file an issue", "/report-issue", or when an agent has hit a bug it should not work around silently. If the bug already exists, posts an occurrence comment on the original instead of a new issue.
---

# /report-issue

You are filing a bug report that a human triager will read cold. Your job: put it in the repo
where the fix lives, with the fields that let a second person reproduce it, and without creating
a duplicate. You never close, relabel, or transfer anything. Confidence is a field, not a gate:
file honestly, mark what you know.

## 0. Decide whether to file at all

- A **nit** (cosmetic, no user impact, no data risk) does **not** get filed during the pilot.
  Note it in the workspace's local log (`BUGS.md`, `MJDEV-ISSUES.md`, or the repo's
  `plans/ISSUES.md` if one exists) and stop.
- If you are an agent acting without a human asking you to file: file only when you have a
  **minimal repro**, or you have seen the **same fingerprint twice** this session. A single
  inferred-from-code suspicion stays in the local log. At most **five** filings per session; the
  sixth and later collapse into one digest issue titled "Digest: N further findings from <date>".

## 1. Pick the repo where the fix lives

Ask: which code has to change? Not "where did I see it".

| Symptom lives in | Repo | Note |
|---|---|---|
| MJ core, Explorer, MJAPI, CodeGen, an `@memberjunction/*` package | `MemberJunction/MJ` | Add the `upstream` label on the app repo only if you are ALSO filing an app-side issue |
| An open app's own code (`bizapps-orders`, `bizapps-accounting`, `bizapps-caliber`, …) | that app's repo | |
| The mjdev tool (instances, dev-link, the `mjdev` CLI) | `MemberJunction/MJDev` | |
| Unsure between app and MJ | the app repo, say so in Duplicate search | Triage moves it |

**Always pass `--repo`.** Worktrees here have no `gh` default repo and fall back to a remote that is
often the wrong one. If the user named a repo, use it.

## 2. Capture the environment (automatically, from the workspace)

Run what applies and paste the results; do not ask the user for things you can read:

```sh
git rev-parse --abbrev-ref HEAD; git rev-parse --short HEAD          # branch @ commit
node -e "console.log(require('./node_modules/@memberjunction/core/package.json').version)" 2>/dev/null \
  || cat packages/MJCore/package.json | grep '"version"'               # ACTUAL MJ version
cat package.json | grep -E '"(name|version)"' | head -2                # this app's name + version
ls node_modules/@memberjunction/ 2>/dev/null | head -0; for d in ../*/package.json; do :; done   # (adapt) linked apps + versions
node -v; sw_vers -productVersion 2>/dev/null || uname -sr               # Node, OS
```

Report the actual MJ version AND the branch; they diverge. Name linked open apps with versions.

## 3. Search for duplicates, then judge

1. Build the fingerprint: error string with hex addresses, UUIDs, line numbers, timestamps
   stripped; top file path or component; symptom words.
2. Three searches, all states, in the target repo (and MJ when the symptom could be upstream):
   ```sh
   gh search issues --repo <owner/repo> --limit 10 "\"<normalized error>\""
   gh search issues --repo <owner/repo> --limit 10 "<file path or component>"
   gh search issues --repo <owner/repo> --limit 10 "<symptom words>"
   ```
3. Read the full body of at most five candidates (`gh issue view N --repo … --json title,body,state,labels,comments`).
   Judge each: **duplicate** / **related** / **unrelated**, one line of reasoning.
   - Duplicate of an **open** issue → go to step 5 (occurrence comment). Do not file.
   - Match against a **closed, fixed** issue → it is a possible **regression**: file a NEW issue,
     say "regression of #N" in the title line, and ask triage to add the `regression` label.
   - Related → file, and cite it under Duplicate search.
   - When unsure between duplicate and related, treat it as related and file. A wrong merge hides a
     real bug; a wrong duplicate costs one comment.

## 4. File the issue

Write the body with **exactly these headings** (the web form produces the same ones, and the
intake workflow parses them):

```md
### What happened
Expected: …
Actual: …

### Steps to reproduce
1. …

### Confidence
Reproduced with a minimal repro (attached above) | Observed directly, no minimal repro yet | Inferred from code, not observed

### Environment
MJ <ver> · <app> <ver> @ <branch> <sha>
<linked apps + versions>
<OS> · Node <ver> · <pm> <ver>

### Severity proposed
blocker | breaking | vulnerability | degraded | minor

### Target line
next | next + backport to the current release line

### Duplicate search
Searched "<terms>", "<terms>", "<terms>" — found #N (related: …), #M (unrelated: …).

### Blocking?
<Blocked — … | Not blocked — …>

### Suspected cause (optional)
<how you think it happens: code path, component or change, file:line if known. A lead, not evidence; say "Not verified" when it is not.>

### Proposed fix (optional) — tested? yes / no
Proposed: …
Tested: no
```

Title: the symptom, not the theory. Severity meanings: blocker = someone cannot work; breaking =
feature does not work, no workaround; vulnerability = security; degraded = works with a
workaround; minor = cosmetic. Target line is `next` unless a blocker/breaking/vulnerability is
live on a release line.

Then:

```sh
# labels: use only the ones the repo has (check first); the workflow adds sev:/target: from the body
gh label list --repo <owner/repo> --limit 200 --json name -q '.[].name' > /tmp/labels.txt
LABELS="bug"
grep -qx needs-triage /tmp/labels.txt && LABELS="$LABELS,needs-triage"
grep -qx origin:human  /tmp/labels.txt && LABELS="$LABELS,origin:human"   # origin:agent when you are filing autonomously
gh issue create --repo <owner/repo> --title "<symptom>" --body-file /tmp/issue.md --label "$LABELS"
```

Print the URL. If the workspace has a receipt log (`MJDEV-ISSUES.md` for mjdev, `MJ-UPSTREAM.md`
for MJ bugs, the instance's `BUGS.md` otherwise), append a one-line receipt: link, title, status.

If `gh` fails (auth, network), write the full body into that local log, mark it
`PROMOTE-PENDING`, and tell the user it could not be filed. Never drop the report.

## 5. Or: post an occurrence comment on the existing issue

When the search found an open duplicate, add a comment using `templates/occurrence-comment.md`
(fixed heading, your environment, what differs). Carry your environment: the version boundary
where a bug appears is usually the most useful fact in the whole thread. Then print the URL and
stop. Do not file a second issue.

## Rules

- Never close, relabel (beyond the creation labels), transfer, or assign.
- Never present an untested theory as a diagnosis; say "Tested: no".
- Never file a nit; never file more than five issues in a session without collapsing to a digest.
- Report what you did and did not verify, exactly as it happened.
