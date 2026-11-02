---
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-ng": minor
---

A discounted deal line now says where its concession stands: awaiting approval, rejected, or not recorded, with Record again on the last two, which opens the line editor to record a new one. The editor asks for a discount reason when orders' priced discount for the line is worth more than the largest Pending or Approved concession on it, instead of when the percent rose over the saved percent, so it asks again after a refused concession and when the quantity or price rises at the same percent. It asks nothing, and shows no "cannot be confirmed" notice, for a line orders records no price concession on (a product no rule prices, a renewal line). New exports from `sales-entities`: `LineDiscountNeedsConcession`, `LargestStandingConcessionValue`, `ResolveLineConcessionState`, `LoadLineConcessionRows`, `ConcessionIsPending`, `ConcessionWasRejected`. `DealLineCardRow` gains `OrderHeaderID`, `ProductPriceID` and `RenewsSubscriptionID`.
