---
"@mj-biz-apps/sales-ng": patch
---

Deal hero: put the cursor in Name when a new deal opens (#188).

bc-aidp-next-golive#188 asks for three things. Two shipped already — a new deal no longer opens on a
wall of validation warnings, and the deal number and name are no longer duplicated. This is the
third: clicking New Deal now leaves the cursor in the name box rather than leaving the user to work
out where typing starts.

Name lives in the hero rather than in any panel, so the hero is the only component that can do it.
Focus is taken only for an UNSAVED record, only in edit mode, only once per record, and never when
the user has already reached another field — taking it on a saved record would fight anyone
navigating by keyboard, and taking it twice would yank the caret back mid-sentence.

The decision is a pure exported predicate so those rules are pinned by tests; the component keeps
only the two lines that genuinely need a DOM.
