---
"@mj-biz-apps/sales-ng": minor
"@mj-biz-apps/sales-core-entities-server": minor
---

Deal form: plain-English copy on the Overview, header and save refusals (#207).

Rewrites sixteen strings on the Deal form into the wording the tester specified verbatim on
bc-aidp-next-golive#207 — the six Overview warnings, the green all-clear line, the Amount and
Forecast tile subtexts, the Close tile's undated label, the Situation card owner, the Next move
empty state, the "What's being sold" empty state, the stale-amount flag on both the header and the
form, and the server's owner-edit refusal. None of the phrasing is ours.

Copy only: which message appears and when is unchanged.

Five rows of the tester's table are deliberately not done, following the sequencing notes on the
issue itself. The three lock messages say "set the status back to Open", which is only true once the
close/reopen work lands, so they keep their current wording until it does. The Close tile's day
counts wait on the DATE to DATETIMEOFFSET conversion (golive#168, still open) — rewording first
would have converted deals reading "46272 days overdue" in full prose. The two field labels are
metadata rather than a string in a panel and travel separately.
