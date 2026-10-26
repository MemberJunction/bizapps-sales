---
'@mj-biz-apps/sales-ng': minor
---

Fast Account and Contact pickers on the Deal form (bc-aidp-next-golive#372). Account, Primary Contact and Billing Contact now use common's `bizapps-party-field`: nothing is listed until two characters are typed, then one prefix search runs on indexed base columns (TOP 20, no count). Accounts match name, legal name or website domain; contacts match last name, display name, email or email domain. Two new queries, `Sales: Party Lookup Accounts` and `Sales: Party Lookup Contacts`, restrict results to organizations with a Sales Account and people with a Sales Contact, the rows the Deal can store. Requires `@mj-biz-apps/common-ng` 5.56.0 or later and the matching bizapps-common migration.
