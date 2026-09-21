---
'@mj-biz-apps/sales-ng': patch
---

The deal's product lines are listed in line-number order.

The grid's view parameters carried no `OrderBy`, so rows arrived in whatever order the view produced — a rep who added three products saw them as 2, 3, 1.

Sorted by `LineNumber` rather than a created-at stamp: orders stamps it through the collection's `applySequence()` and re-stamps by array index when lines move, so it is the sequence the order itself considers its lines to be in. Sorting by creation time would show a resequenced order in the order it was typed rather than the order it now has.
