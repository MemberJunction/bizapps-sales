# Incidents behind CLAUDE.md's working rules 5–8

Moved from `CLAUDE.md` on 2026-10-11. The rules are in `CLAUDE.md` under "CRITICAL RULES"; this file
keeps the measured incidents that produced them.

## Rule 5 — build after a merge from a far-behind branch

Two measured instances, both on merges from branches that were thousands of lines behind:

- **`sales-section.component.ts` appended a second, byte-identical `const E_ACCOUNT`.** Both sides added
  the *same* declaration at *different offsets*, so git saw two unrelated additions and kept both. A
  duplicate block-scoped `const` does not compile. Six files conflicted in that merge and every one of
  them resolved correctly; the only breakage came from the file that merged clean.
- **`sales-section.component.ts` kept a consumer and dropped its producer** (`open` / `openValue`) — the
  same file, a different merge, and the same shape: each side's edit was individually sensible and the
  combination was not.

The build catches this class in seconds. The suite is a slower instrument that can pass while a
duplicate declaration or an orphaned reference sits in a file no check imports. A merge that *should*
be content-neutral and is not has told you something, and the conflict list will not mention it.

## Rule 6 — never kill a process you cannot prove you own

Walking the parent chain until you reach `claude.exe` proves nothing; there were 20+ of those on the
machine. A session did exactly that and killed another session's runs.

`ps -W` prints no command-line arguments. A filter on `integration.mjs` or `mutate-checks.mjs` in its
output matches nothing, and a filter that matches nothing looks exactly like a filter that matched
safely — the same failure shape as a CSS selector that hits no elements, and as an assertion below an
unconditional `return`.

A Bash tool call that hits its ten-minute ceiling detaches the process rather than killing it. Six such
orphans survived up to two hours on one evening, each holding or queuing on the suite applock, so every
fresh attempt queued behind an earlier one *of the same session*, which read as a hang with no visible
cause.

## Rule 7 — while a mutation run is live, the tree is not evidence

Mid-merge, the anchor check reported a mutant's `from` string missing, and it was read as the merge
having reverted a repair. It had not: a background mutation run had that exact mutation applied at that
moment, so the anchor genuinely did not match its own mutated source. A `git add -A` there would have
committed a mutated source file, and the commit would have looked ordinary.

The sibling case: a full suite read *119 passed, 6 failed* against correct source, because the driver
had restored the source while `dist/` still held the mutation.

## Rule 8 — arrange for the claim to be re-checked when it is used

Measured instances:

| The claim | True when | Wrong by |
|---|---|---|
| `links[0]` is the row I mean | one row existed | a second row arrived |
| a mutant's `from` anchor matches | before the edit | the edit that moved the line |
| `next` is 222 commits behind | when the report was written | 20 commits later |
| "Sales runs standalone" | before `DealLine` was retired | the redesign |
| `selected === 0` catches a vacuous run | when zero was the only way to run nothing | 7 of 132 |
| a declaration is cleared | on the exit that had the clear | three exits added later |
| the tree is clean | before a mutation run started | the run |
| activities checks assume an empty host | before the feature was used | the first real ingest |

Every one of those was written by someone being careful, and several carry a comment correctly
predicting the failure that then happened anyway: the `_declaredTransition` clear describes its own
consequence precisely, and only one of four exits performed it. Of the two guards in the integration
runner, `skipped > 0` cannot be outgrown; `selected === 0` was outgrown twice.
