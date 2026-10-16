---
"@mj-biz-apps/sales-entities": patch
"@mj-biz-apps/sales-core-entities-server": patch
---

Picking a deal's Primary Contact fills an empty Billing Contact with the same person, and the deal's order bills the Billing Contact.

The primary contact is usually the person invoiced, but Billing Contact stayed blank, so a rep searched for the same person twice. `DealEntity.Set` now copies a newly chosen Primary Contact into an empty Billing Contact. It runs for the deal form and the deal workspace alike, never overwrites a Billing Contact that is filled in, and the rep can still change or clear it. Loading a deal fills nothing.

When the server creates a deal's order, `BillToPersonID` now takes the Billing Contact, falling back to the Primary Contact when it is empty. Before, it read only the Primary Contact, so a different Billing Contact never reached the order. Orders already created keep their bill-to person.
