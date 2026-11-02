---
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-ng": minor
---

A pipeline names the person its close-won tasks go to, and an upgrade keeps it.

The Order Review and Contract Processing tasks raised when a deal closes Won were routed to `CloseWonTasks.AssigneeRecordID` inside the pipeline's Close Won Policy. The default pipelines ship that policy in metadata with the assignee empty, and installing the app writes the shipped policy back over the database, so an assignee a deployment set there was lost on the next upgrade.

Pipelines now have a `CloseWonAssigneePersonID` column, a foreign key to People, shown on the pipeline form. The app's metadata never sets it, so an upgrade leaves it alone, and the database refuses a person who does not exist. A won close uses it ahead of the policy's assignee; when it is empty the policy value is used as before, and when both are empty the tasks are created and reported as not routed.

The demo seed sets its partner rep on the new column instead of in the policy JSON.
