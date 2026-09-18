---
'@mj-biz-apps/sales-entities': patch
'@mj-biz-apps/sales-ng': patch
---

Deal Overview and header: a closed deal now reports what happened instead of forecasting (golive#231).

golive#206 item 4 fixed the tile VALUES on a closed deal and left the static labels alone, which produced
the worst of both: correct data under headings that promise something else. A won deal read
"Forecast: Won" — Won is not a forecast — and the Timing card showed a close DATE under a row labeled
"Days to close".

**Labels now move with the outcome.** The Close tile reads Won / Lost / Closes; the Forecast tile becomes
Outcome once there is one, with the stage the deal closed from beneath it. The header's Close stat, which
rendered `ExpectedCloseDate` unconditionally with no reference to the close stamps at all, becomes
"Closed" with the real date.

**The Timing card reports rather than counts.** A closed deal gains a "Closed won" / "Closed lost" row
and a **Sales cycle** (creation to close), and loses the countdown; "Expected close" is kept either way so
the variance stays legible, which is what the Close tile's new sub-line reports — "on time", "4 days
early", "3 days late". A lost deal gains a **Loss reason** row with its notes, and hides Term / Start /
Executed, which describe a deal being delivered — but never hides one that is actually set, since that
would conceal real data.

**Won and Lost are read as FLAGS, and `IsWon` is now carried on `DealLockState` rather than inferred.**
They are not complements: `Abandoned` carries `IsLost` alongside `Lost`, and a status can lock a deal
while carrying neither — so `!IsLost` would print "Won" over a deal nobody won, a lie that reads
perfectly. One check fails only against that inferred version. This keeps "Closed Won" a label a pipeline
can rename, per the vocabulary rule.

The open-deal countdown is also spelled out — "in 12 days", "today", "3 days overdue" rather than "12d"
and "3d past" — since the tile is read at a glance by someone not holding the convention in their head.

27 new checks. Each pins a label AND the value it sits over, as a pair: a check that looked at only one
of them would pass against exactly the half-fixed state this issue is about.
