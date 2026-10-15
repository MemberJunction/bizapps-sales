---
"@mj-biz-apps/sales-ng": patch
---

The deal activity form's inputs and "Log it" button are visible again in both themes. The activity timeline, deal form, line editor and deal workspace styles used `--mj-*` names MemberJunction does not define, so those rules were dropped; they now use MJ's tokens, and a CI gate rejects any undefined `--mj-*` name.
