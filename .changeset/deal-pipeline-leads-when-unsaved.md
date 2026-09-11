---
"@mj-biz-apps/sales-ng": patch
---

Deal form: a new deal opens on Pipeline, where typing starts (#188).

Declares `leadsWhenUnsaved` on the Deal Pipeline panel, so clicking New Deal opens the panel that
asks for something rather than Overview. Overview is an exec briefing and stays the lead for a saved
deal, which is what it is for; on a record with no data it is a page of blanks the user has to look
past to find where to begin.

This is the last of the three things bc-aidp-next-golive#188 asked for. It does nothing until a
MemberJunction release carries the reader for the setting — see the PR for why nothing will report
that in the meantime.
