---
'@mj-biz-apps/sales-entities': patch
---

The by-rep reports have something to return, and a slippage report that could never have run is fixed.

Every `DealTeamMember` row sat on an OPEN deal, while both by-rep reports key on `ActualCloseDate` joined
through that table. So `Sales: Bookings by Owner` and `Sales: Deal Involvement by Rep` returned **zero
rows** on seeded data — the two reports §9.4 exists to distinguish, both silent, and a query that runs
clean and returns nothing is indistinguishable from one that is broken.

The two closed deals now carry real teams. Measured on the database: bookings-by-owner credits the won
deal's 27,480 to the AE **once**, while the weighted report splits the same deal 16,488 / 6,870 / 4,122 —
adding back to 27,480 exactly. The same three rows each carry `WonAmountOfDealsTouched = 27,480`, so summing
that column gives 82,440 for a 27,480 deal: §9.4's triple-count, visible on screen.

**`Sales: Slipped Deals` could never have returned a row.** It joined `d.ID = s.RecordID`, and
`RecordChange.RecordID` is a composite-key string (`ID|<guid>`) — SQL Server converts toward
`uniqueidentifier` and the statement dies. It looked healthy only because nothing qualified. Seeding a real
date move exposed it on the first try.
