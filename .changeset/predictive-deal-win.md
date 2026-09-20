---
"@mj-biz-apps/sales-entities": minor
---

Add predictive deal win propensity outcome columns, engineered training features, and layered base views.

- Materializes `PredictedWinProbability`, `PredictedWinRiskBand`, and `PredictedWinScoredAt` on `Deal`.
- Adds layered base views `vwDealsGenerated` and application wrapper `vwDeals` computing engineered training features (`WinOutcome`, `DaysToExpectedClose`, `HasPaymentSchedule`, `TeamMemberCount`, `HasPartnerInvolved`, `IsEnterpriseTier`, `AutoRenewFlag`, `StandardAgreementModifiedFlag`).
- Configures scheduled scoring write-back binding targeting `PredictedWinProbability`.
