---
"@mj-biz-apps/sales-core-entities-server": patch
---

Closing a Won deal a second time finds the order-review task instead of raising another.

Reopening a Won deal and closing it again is a supported thing to do, and the second close correctly does not mint a second order. It did try to raise a second Order Review task, though, and on QA that attempt failed inside tasks and put the raw database error on the close panel — connection-state message, `DECLARE` statement and all. The duplicate was never wanted.

A task of the right type already linked to any of the task's targets is now reported rather than recreated, carrying an `AlreadyExisted` flag so a caller can tell "raised now" from "already there". Every target is checked rather than only the primary, because the primary moves between closes: the contract task points at the contract when there is one and falls back to the deal when there is not.

A lookup that fails creates the task anyway. Not knowing costs a duplicate row in a queue someone closes; refusing would cost finance the task entirely.

A genuine creation failure no longer prints SQL. The database error goes to the log, and the close panel gets a sentence saying the close itself held.
