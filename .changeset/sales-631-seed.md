---
"@mj-biz-apps/sales-entities": minor
---

Installed databases now get Sales Contacts' FirstName marked as not a name field, with auto-update off (V202611131630 Metadata_Sync). Without it, CodeGen can flag FirstName as a second name field and deal and account screens show a bare first name instead of the contact's display name and email.
