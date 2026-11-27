---
"@mj-biz-apps/sales-core-entities-server": patch
---

A deal's empty commercial terms now fill on save (golive #486). On every save of an open deal, including the save that follows adding products, an empty Term (Months) takes the pipeline's Close Won Policy `TermMonths`, an empty Start Date takes the Expected Close Date, and an empty Currency takes the selling company's currency, which before applied only when the deal was created. A value already on the deal is never replaced, a closed deal is never touched, and Execution Date stays blank. At a won close, the deal's own term now beats the pipeline's when the contract is created or renewed; before, the pipeline's term replaced the one on the deal.
