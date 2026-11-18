---
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-server": minor
---

Offboarding: two new Actions in the "Offboarding Holdings" category, "Sales: List Offboarding Holdings" and "Sales: Reassign Offboarding Holdings". The list shows the open sales responsibility a departed user holds (open deals they own, their seats on open deal teams, sales accounts and contacts they own, and pipelines whose close-won tasks go to them). The reassign moves those items to a successor, one record at a time through each record's own save, and reports refused saves as skipped. Only the leaver's supervisor or a Sales Admin may move them. Closed deals and history are not touched. Needs a bizapps-common release that ships the "Offboarding Holdings" action category. Adds a "Sales Offboarding" role that grants read and update on the records the reassign moves (plus create and delete on deal team members for the owner swap), for supervisors who hold no Sales role; holding it does not by itself allow a move. Admins assign it.
