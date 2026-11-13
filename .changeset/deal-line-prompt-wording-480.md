---
"@mj-biz-apps/sales-ng": patch
"@mj-biz-apps/sales-core-entities-server": patch
---

The deal line prompt for a product the customer already has uses the order line's new wording (golive #480): it asks "Is this line a renewal of that subscription, or a new one?" and the choices read "Renew <subscription>" and "Create new subscription". The Close Won and stage-change messages that send a rep to the prompt use the same words. Wording only: what each answer does is unchanged.
