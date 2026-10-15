---
"@mj-biz-apps/sales-ng": patch
---

A Sales Account now lists its contacts.

Sales Contacts carry no account column, and Common's Relationships panel is registered on Organizations only, so the Sales Account form showed Details and Deals and nobody who works there. A new Contacts panel on Sales Accounts lists the Sales Contacts on the other end of an active Common Relationship with the account, in either direction and of any relationship type. Rows open the contact. The panel has no New button: a contact created there would get no Relationship row and would not appear in the list it was added to.

The demo seed now links each demo contact to the account its deals are on (the partner rep is left unlinked), and its teardown removes those rows first.
