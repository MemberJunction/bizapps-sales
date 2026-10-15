---
"@mj-biz-apps/sales-core-entities-server": minor
---

Close-won tasks stop being routed to somebody who is not there.

The seeded `CloseWonPolicy` on both pipelines sent every Order Review and Contract Processing task to a People id created in exactly one place: `scripts/seed-demo-data.sh`, where it is the demo's partner rep. A host that ran the demo seed worked; every other host did not. On QA that row never existed, so the tasks read as assigned while no queue held them and the order review control never ran. `TaskAssignment.AssigneeRecordID` is polymorphic, so there is no foreign key and nothing refused the row.

`CloseWonTaskService` now reads the assignee record before writing the assignment. A record that is not there refuses to route and names the id, the entity and the policy key to fix — an unrouted task at least reads as unrouted. A check that cannot run routes anyway and records that it could not tell, so a transient database problem does not quietly stop routing a deployment that is configured correctly.

The policy ships with `AssigneeRecordID` null, which is the documented unconfigured state: there is no internal finance person seeded to point at, and per bc-aidp-next-golive#320 the people who hold each role are loaded per deployment. The migration clears the placeholder only where it is still the placeholder, so a deployment that already configured a real person keeps it.

`Order Review` is also flagged `IsApproval`, so the approvals inbox lists it — its own description calls it the control on money leaving the building. `Contract Processing` is deliberately not flagged: it is work to do rather than a decision to make, and reaches its owner through My Tasks. This raises the declared floor on bizapps-tasks to >=1.7.0, where `TaskType.IsApproval` arrives.
