---
'@mj-biz-apps/sales-ng': patch
---

Date-only fields display the stored day (bc-aidp-next-golive#168). The pipeline board's close date and the deal overview's and hero's next-step date formatted UTC midnight in the viewer's zone, so they showed the day before the stored one west of Greenwich; they now format in UTC. An activity's logged time is an instant and now shows in the viewer's zone rather than UTC. The `Sales: Deal Roster` and `Sales: Dashboard Summary` queries judge "past expected close" against the business day from `fnBusinessToday()` instead of the UTC day, so a deal due today no longer reads as past due after 7 PM Central, and `Sales: Deal Cycle Time` takes the start day in the business zone to match `ActualCloseDate`. The query changes are metadata and reach a host through the release's regenerated Metadata_Sync migration.
