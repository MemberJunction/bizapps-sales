---
'@mj-biz-apps/sales-core-entities-server': patch
---

A pipeline's Close Won Policy check now refuses keys named after built-in object properties (`constructor`, `toString`, `hasOwnProperty`, `__proto__`) with the normal "has a setting the close does not use" message. Before, `{"constructor": null}` saved as valid and `{"constructor": 1}` failed with "must be a undefined" (#474).
