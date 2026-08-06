---
"@mj-biz-apps/sales-core-entities-server": minor
"@mj-biz-apps/sales-entities": minor
"@mj-biz-apps/sales-server": minor
"@mj-biz-apps/sales-ng": minor
---

Phase 1 — the fields a deal needs to become a contract, and the first hand-authored surface

An account director can now compose a complete deal — party info, product lines, a negotiated payment
schedule and contract terms — through a custom form, and it persists as one transaction.

**Schema.** `Deal` gains nine columns (`BillingContactID`, `ExecutionDate`, `StartDate`,
`EstimatedProjectWeeks`, `AutoRenew`, `AnnualIncreasePctOverride`, `CancellationNoticeDaysOverride`,
`PaymentMethod`, `ContractVariances`). `DealLine` gains `ProductName`, `DealLineTypeID`,
`AnnualGrossFees`, `DiscountAmount` and `Total`, and loses the free-text `LineType`. Two new tables:
`DealLineType` (a type table whose `IsRecurring` flag is what code branches on) and
`DealPaymentSchedule` (the exception schedule — no rows means standard terms).

The three signed figures are **transcribed inputs, never derived**. Nothing in the app computes `Total`
from `AnnualGrossFees - DiscountAmount`, or checks that they agree, or sums the payment schedule: the
arithmetic on a signed order form belongs to the customer, not to this app.

**Vocabulary re-seeded to master plan §4.2** — `DealType` is now `New` / `Upsell` / `Renewal` and the
pipelines are `B2B` / `D2C`. Pure metadata edits with no code impact, which is the vocabulary rule
paying for itself.

**`Sales.SaveDeal`.** A browser holds the generated `DealEntity`, not the server subclass, so a deal
and its children cannot cross the entity-save boundary together. `DealDraft` (framework-free, in the
entities package) plus this remote operation is how they do: one transactional call, all-or-none, with
structured `Section`/`Field`/`Severity` issues so a tab can badge itself and a field can mark itself.
`DealEntityServer` composes header, lines and schedule inside one transaction and derives
`Deal.OwnerEmployeeID` from the `DealTeamMember` row rather than accepting it as a field.

**The deal workspace** (`@mj-biz-apps/sales-ng`) is one surface for viewing, editing and creating —
a deal being created is just a draft whose ID is null. Reached from a new hand-authored **Sales**
application; the generated entity browser is untouched. Deliberately basic.

**Three latent schema bugs fixed.** `UNIQUE` over a nullable column allows exactly one NULL on SQL
Server and unlimited on PostgreSQL, so the schema was enforcing a stricter rule in dev than in
production. In practice: only one unnumbered deal could exist at a time, a second Sales Engineer could
not be added to a deal despite `AllowsMultiplePerDeal`, and the D-6 partner-rep path was blocked. All
four such constraints are now filtered unique indexes, which state the real invariant and make both
databases agree.
