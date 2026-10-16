---
"@mj-biz-apps/sales-ng": minor
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-server": minor
---

MemberJunction floor raised to 6.1.6, and a batch of non-UX fixes:

- Breaking for direct importers of `@mj-biz-apps/sales-ng`: the unmounted `DealWorkspaceComponent` and the validation helpers only it used (`DiscountRefusalIssues`, `ShouldRefuseLineRemoval`, `LineRemovalRefusedIssues`, `UnlinkedLineIssues`, `MergeValidation`) are removed (#291). `IDownstreamSeam` gains `UpdateContractFromDeal` (#278).
- Closing a reopened Won deal Won again reuses its contract, refreshing unsigned terms, instead of creating a second one (#278).
- Changing a deal's contact or account moves its order's bill-to while the order is Draft or Quoted and still bills the previous party (#319).
- Deal stage events refuse updates and deletes on the server, and the API no longer offers them (#348).
- Slipped Deals, Stage Conversion and Forecast History count whole business days at both period bounds; Slipped Deals no longer fails on audit rows that are not JSON (#289).
- The Deal form's inline-create key workaround is removed now that MJ 6.1.6 sends the written key (#207).
- CodeGen no longer writes recurring reconcilers, including the field prune, into migrations (#345).
