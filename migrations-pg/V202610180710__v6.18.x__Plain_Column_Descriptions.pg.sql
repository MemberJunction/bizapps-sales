-- =============================================================================================
-- PostgreSQL counterpart of V202610180710__v6.18.x__Plain_Column_Descriptions.sql
-- =============================================================================================
-- Same descriptions, same order as the T-SQL file; see its header for why they changed.
--
-- HOW IT WAS MADE
--   * Each `sp_updateextendedproperty` becomes `COMMENT ON TABLE` or `COMMENT ON COLUMN`, the
--     PostgreSQL equivalent; the converter has no translation for extended properties. Written by
--     a script over the T-SQL file, so every value is the T-SQL string verbatim ('' escapes kept).
--   * `COMMENT ON` replaces any existing comment, so the add/update distinction the T-SQL file
--     keeps does not apply.
--   * The T-SQL file's CodeGen trailer (the four __mj schema-refresh procedures) is not here: a
--     PostgreSQL host runs `mj codegen` after installing, which copies these comments into
--     EntityField.Description and Entity.Description.
-- Schema names use ${flyway:defaultSchema}, as the T-SQL file does.
-- =============================================================================================

SET standard_conforming_strings = on;

COMMENT ON TABLE ${flyway:defaultSchema}."DealStatusType" IS 'The outcomes a deal can be in, such as Open, Won, Lost or On Hold. The flags on each status decide how a deal in it behaves.';

COMMENT ON COLUMN ${flyway:defaultSchema}."DealStatusType"."Code" IS 'Short fixed identifier for the status. Renaming the status is safe; changing its code is not.';

COMMENT ON COLUMN ${flyway:defaultSchema}."DealStatusType"."LocksDeal" IS 'When on, a deal in this status is locked until it is reopened: its lines, payment schedule, team and every field except Description and Next Step become read-only.';

COMMENT ON COLUMN ${flyway:defaultSchema}."DealRole"."IsOwnerRole" IS 'Marks the role that owns the deal. Only one team member per deal can hold it, and that person is shown as the deal''s owner.';

COMMENT ON COLUMN ${flyway:defaultSchema}."DealRole"."AllowsMultiplePerDeal" IS 'Whether more than one person can hold this role on the same deal, for example two sales engineers.';

COMMENT ON TABLE ${flyway:defaultSchema}."ForecastCategoryType" IS 'How a deal counts in the forecast: Omitted, Pipeline, Best Case, Commit or Closed. The Include flags on each category decide which forecast totals it adds to.';

COMMENT ON TABLE ${flyway:defaultSchema}."LossReason" IS 'Why a deal was lost. Closing a deal as lost requires one.';

COMMENT ON COLUMN ${flyway:defaultSchema}."LossReason"."RequiresNotes" IS 'When on, a deal closed as lost with this reason must also have loss notes.';

COMMENT ON TABLE ${flyway:defaultSchema}."LifecycleStageType" IS 'Where a person or organization is in the customer journey, from Subscriber to Customer. A lead is a contact at the Lead stage, not a separate record.';

COMMENT ON TABLE ${flyway:defaultSchema}."SalesAccount" IS 'Sales details for an organization you sell to. The account and its organization are one record.';

COMMENT ON COLUMN ${flyway:defaultSchema}."SalesAccount"."ID" IS 'The account''s ID, the same as its organization''s ID.';

COMMENT ON COLUMN ${flyway:defaultSchema}."SalesAccount"."Territory" IS 'Sales territory label for the account. It is not used to route or assign accounts.';

COMMENT ON COLUMN ${flyway:defaultSchema}."SalesAccount"."AnnualRevenueBand" IS 'Approximate annual revenue as a range, for example $1M-$5M.';

COMMENT ON COLUMN ${flyway:defaultSchema}."SalesAccount"."EmployeeCountBand" IS 'Approximate number of employees as a range, for example 50-200.';

COMMENT ON TABLE ${flyway:defaultSchema}."SalesContact" IS 'Sales details for a person you sell to. The contact and its person are one record.';

COMMENT ON COLUMN ${flyway:defaultSchema}."SalesContact"."ID" IS 'The contact''s ID, the same as its person''s ID.';

COMMENT ON COLUMN ${flyway:defaultSchema}."SalesContact"."BuyingRoleTypeID" IS 'The contact''s usual buying role. The role on a particular deal is set in that deal''s buying team.';

COMMENT ON COLUMN ${flyway:defaultSchema}."Pipeline"."CompanyID" IS 'The company that owns this pipeline. Every deal in the pipeline belongs to this company.';

COMMENT ON COLUMN ${flyway:defaultSchema}."Pipeline"."Code" IS 'Short identifier for the pipeline, unique within its company.';

COMMENT ON COLUMN ${flyway:defaultSchema}."Pipeline"."CloseWonPolicy" IS 'What happens when a deal in this pipeline is won, stored as JSON: whether a contract is created and of which type, and which follow-up tasks are raised.';

COMMENT ON COLUMN ${flyway:defaultSchema}."Pipeline"."RequiresDealLines" IS 'Whether deals in this pipeline carry product lines priced by Orders, or a single amount entered by hand.';

COMMENT ON TABLE ${flyway:defaultSchema}."PipelineStage" IS 'An ordered stage within a pipeline. Each stage sets the status a deal takes on when it enters the stage.';

COMMENT ON COLUMN ${flyway:defaultSchema}."PipelineStage"."DealStatusTypeID" IS 'The status a deal takes on when it enters this stage.';

COMMENT ON COLUMN ${flyway:defaultSchema}."PipelineStage"."ExitCriteria" IS 'Conditions for leaving this stage, stored as JSON for reference. The app does not check them.';

COMMENT ON COLUMN ${flyway:defaultSchema}."PipelineStage"."GuidanceMarkdown" IS 'Guidance for reps on what a deal should have at this stage, in Markdown.';

COMMENT ON TABLE ${flyway:defaultSchema}."Deal" IS 'A sales opportunity with an account. Its amount comes from the deal''s order, and winning it follows the pipeline''s close-won policy.';

COMMENT ON COLUMN ${flyway:defaultSchema}."Deal"."Amount" IS 'The deal value. For a deal with product lines it is the order total calculated by Orders; for a deal without lines it is entered by hand.';

COMMENT ON COLUMN ${flyway:defaultSchema}."Deal"."AmountIsComputed" IS 'On when Amount is the order total calculated by Orders; off when it was entered by hand.';

COMMENT ON COLUMN ${flyway:defaultSchema}."Deal"."AmountSourceHash" IS 'Fingerprint of the order lines the amount was calculated from, used to tell when the amount is out of date.';

COMMENT ON COLUMN ${flyway:defaultSchema}."Deal"."OwnerEmployeeID" IS 'The deal owner: the team member in the owner role. Updated automatically from the deal team.';

COMMENT ON COLUMN ${flyway:defaultSchema}."Deal"."CompanyID" IS 'The company selling the deal. It must match the pipeline''s company.';

COMMENT ON COLUMN ${flyway:defaultSchema}."Deal"."ContractID" IS 'The contract this deal belongs to, in BizApps Contracts.';

COMMENT ON COLUMN ${flyway:defaultSchema}."Deal"."RenewsContractID" IS 'The contract this deal renews. Required for deal types that are renewals.';

COMMENT ON COLUMN ${flyway:defaultSchema}."Deal"."BillingContactID" IS 'The contact who receives the invoice. Leave empty to use the primary contact.';

COMMENT ON COLUMN ${flyway:defaultSchema}."Deal"."ExecutionDate" IS 'The date the agreement was signed. It can be after the start date when work begins before signature.';

COMMENT ON COLUMN ${flyway:defaultSchema}."Deal"."StartDate" IS 'The date the service or subscription begins. It can be before the execution date.';

COMMENT ON COLUMN ${flyway:defaultSchema}."Deal"."EstimatedProjectWeeks" IS 'Estimated project length in weeks, from the statement of work. It does not affect the term or renewal dates.';

COMMENT ON COLUMN ${flyway:defaultSchema}."Deal"."AnnualIncreasePctOverride" IS 'Annual price increase agreed for this deal, as a percent. Leave empty to use the contract type''s standard increase.';

COMMENT ON COLUMN ${flyway:defaultSchema}."Deal"."CancellationNoticeDaysOverride" IS 'Cancellation notice period agreed for this deal, in days. Leave empty to use the contract type''s standard notice period.';

COMMENT ON COLUMN ${flyway:defaultSchema}."Deal"."PaymentMethod" IS 'How the customer expects to pay, for example ACH. For reference only.';

COMMENT ON COLUMN ${flyway:defaultSchema}."Deal"."StandardAgreementModified" IS 'Whether the deal moved off the standard agreement. Copied to the contract when the deal is won, where it tells finance to review the changes.';

COMMENT ON COLUMN ${flyway:defaultSchema}."Deal"."ContractVariances" IS 'Summary of the terms negotiated away from the standard agreement, for legal review.';

COMMENT ON TABLE ${flyway:defaultSchema}."DealPaymentSchedule" IS 'Payment instalments agreed for a deal when they differ from the standard terms. A deal on standard terms has no rows here.';

COMMENT ON COLUMN ${flyway:defaultSchema}."DealPaymentSchedule"."Amount" IS 'The instalment amount as agreed. Can be negative for a refund or credit.';

COMMENT ON COLUMN ${flyway:defaultSchema}."DealPaymentSchedule"."DisplayOrder" IS 'Position of the instalment in the schedule, for instalments that share a date or have none yet.';

COMMENT ON TABLE ${flyway:defaultSchema}."DealStageEvent" IS 'A record of a deal moving from one stage to another, with the amount and probability at that moment. These rows are never edited.';

COMMENT ON COLUMN ${flyway:defaultSchema}."DealStageEvent"."ChangedAt" IS 'When the stage change happened. For imported deals this is the original date, not the import date.';

COMMENT ON COLUMN ${flyway:defaultSchema}."DealStageEvent"."AmountAtTransition" IS 'The deal amount at the time of this stage change.';

COMMENT ON COLUMN ${flyway:defaultSchema}."DealStageEvent"."AmountAtTransitionIsComputed" IS 'On when the amount at this stage change was the order total, off when it was entered by hand. Empty for changes recorded before this was tracked.';

COMMENT ON TABLE ${flyway:defaultSchema}."DealContactRole" IS 'The customer''s buying team: which contact plays which role on a deal.';

COMMENT ON TABLE ${flyway:defaultSchema}."DealTeamMember" IS 'The internal people on a deal and the role each holds, including the owner. Totals by rep must count only the owner role or weight by attribution, or a deal is counted once per member.';

COMMENT ON COLUMN ${flyway:defaultSchema}."DealTeamMember"."EmployeeID" IS 'The team member, when they are an employee. Set this or Person, not both.';

COMMENT ON COLUMN ${flyway:defaultSchema}."DealTeamMember"."PersonID" IS 'The team member, when they are not an employee, such as a partner rep. Set this or Employee, not both.';

COMMENT ON TABLE ${flyway:defaultSchema}."ForecastSnapshot" IS 'The forecast for a pipeline and owner as captured on a given day, so past forecasts can be compared with today''s.';

COMMENT ON COLUMN ${flyway:defaultSchema}."ForecastSnapshot"."CommitAmount" IS 'Total of deals in commit forecast categories when the snapshot was taken.';

COMMENT ON COLUMN ${flyway:defaultSchema}."ForecastSnapshot"."SnapshotJSON" IS 'The detail behind the snapshot''s totals, stored as JSON.';
