---
"@mj-biz-apps/sales-ng": minor
---

New sales accounts and contacts open on a short create card instead of every field of the record (bc-aidp-next-golive#435).

A new account asks for Name, Account Type, Owner, Website, Phone and Parent, and starts with a search over existing organizations: picking one saves the account onto that organization, so its details are inherited rather than typed into a duplicate. A new contact asks for First and Last name, Email, Phone, Title and the account they work at, which is saved as a Relationship. Every other field is under a collapsed "More details". Tax ID gets help text from its field description (metadata). Saved records keep the generated layout.
