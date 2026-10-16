---
"@mj-biz-apps/sales-entities": patch
"@mj-biz-apps/sales-ng": patch
---

Choosing a deal's account fills its empty Primary and Billing Contact from the account's default contacts.

`DealEntity.FillContactsFromAccount()` reads the account's `DefaultPrimaryContactID` and `DefaultBillingContactID` and writes each into the deal only when the deal's own field is empty. The rep can still change or clear either. The account's billing default is written first, so it wins over the rule that copies a new Primary Contact into an empty Billing Contact; an account with no billing default leaves that rule to fill billing from the primary. If the account changes while the read is in flight, nothing is written.

The deal form (the Pipeline panel on a new deal, "Account & people" on a saved one) and the deal workspace both call it after the account changes. A failed read leaves the contacts as they were and says so.

The deal workspace's contact lists now label each person "Name (email)", the text the deal form's contact picker already shows, so two people with the same name can be told apart.
