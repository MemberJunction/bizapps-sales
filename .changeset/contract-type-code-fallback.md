---
"@mj-biz-apps/sales-core-entities-server": patch
---

Closed Won finds the contract type a policy names by contracts' `Code` first and its `Name` second,
so a policy keeps working before and after contracts adds `ContractType.Code`, and a renamed type no
longer stops contract creation once the policy names its code.
