---
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-server": minor
---

An order whose deal is not Won can no longer be confirmed.

A deal closed Won mints an order. Reopening the deal puts it back to Open — and the order could still be confirmed from the order screen, booking a journal entry, a subscription and twelve recognition entries against a deal sitting Open at 75%. Sales already refuses the reverse: `Sales.ReopenDeal` will not reopen a deal whose order has booked, because the ledger has moved.

Orders cannot enforce this alone. It does not depend on Sales, and there is no link to follow — `Deal.OrderID` points at the order, while `OrderHeader` carries no `DealID`. So Orders asks through `RegisterOrderConfirmVeto` and this answers, the same shape as the existing line-edit veto.

Decided by the `IsWon` flag, never by the status name, so a deployment that renames or adds a winning status stays covered. An order no deal points at is allowed without comment: orders are created directly too, and refusing those would make installing Sales break ordinary ordering.
