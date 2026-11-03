---
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-ng": minor
---

Close and lock hardening: validate caller-supplied IDs and fail closed on loss-reason and deal-type lookup errors in `Sales.CloseDeal` and `Sales.ReopenDeal`; keep client-generated `ConcessionID` across discount-concession retries so a resend after a timeout is idempotent; return a specific refusal naming the deal and contract when a close or stale pre-close save hits an already-Won deal; and allow a closed deal whose persisted `AccountID` is blank to have its account set once without reopening.
