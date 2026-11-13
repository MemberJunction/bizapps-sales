---
"@mj-biz-apps/sales-entities": minor
---

Installed databases now get the two promote-picker queries ("Sales: Party Lookup Promotable Accounts" and "Sales: Party Lookup Promotable Contacts") and Sales Contacts' FirstName marked as not a name field, with auto-update off (V202611131630 Metadata_Sync). Without the queries the promote dialog finds nothing; without the name-field change CodeGen can flag FirstName as a second name field and deal and account screens show a bare first name.
