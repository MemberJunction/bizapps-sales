-- =============================================================================
-- Plain-language table and column descriptions.
-- =============================================================================
-- MJ shows a column's description as its grid-header tooltip and on its form, and
-- a table's description on the entity. Most of the descriptions the baseline and
-- two later migrations set were design notes (capitalized emphasis, references to
-- server classes, plan sections and other tables), and some were no longer true:
-- Deal and Deal.Amount named Orders.PreviewOrder and said closing creates orders,
-- and the two renewal overrides quoted fixed standard values the contract type
-- now owns. This replaces each with a sentence a user can act on.
--
-- THE RATIONALE THE OLD TEXT CARRIED STAYS IN THE MIGRATIONS THAT SET IT
-- (V202608042101, V202608211200, V202609181500) and in CLAUDE.md. The parts a
-- reader of the schema still needs:
--   * Deal.OwnerEmployeeID is written by DealEntityServer from the owner-role
--     DealTeamMember; never set it directly.
--   * Summing Deal.Amount across DealTeamMember counts a deal once per member;
--     filter to DealRole.IsOwnerRole = 1 or weight by AttributionPct.
--   * Deal.Amount is a cached copy of the order total, never computed in sales.
--   * A NULL renewal override means "use the contract type's standard", which is
--     a different fact from a typed value equal to today's standard.
--   * Bands (AnnualRevenueBand, EmployeeCountBand) are ranges on purpose: an
--     estimate stored as an exact figure later gets treated as fact.
--   * ForecastSnapshot.CommitAmount is not named Commit because COMMIT is
--     reserved in T-SQL and PostgreSQL.
--   * Deal.PaymentMethod is a label only; no code may branch on it. Payment
--     method becomes orders' vocabulary when code needs it, not a copy here.
--   * Deal.StandardAgreementModified is not derived from ContractVariances: an
--     empty variances field means nothing was written down, not that nothing
--     was negotiated (also in downstream-seams.ts).
-- DealPaymentSchedule.DisplayOrder's old text said the server re-sequences it on
-- every save; no code does, so that claim is dropped rather than kept.
--
-- Every property updated here already exists, so each call is an update.
-- EntityField.Description and Entity.Description follow on the next CodeGen run
-- (AutoUpdateDescription is on for all of them); the generated output is below.
-- =============================================================================

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The outcomes a deal can be in, such as Open, Won, Lost or On Hold. The flags on each status decide how a deal in it behaves.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealStatusType';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Short fixed identifier for the status. Renaming the status is safe; changing its code is not.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealStatusType',
    @level2type = N'COLUMN', @level2name = N'Code';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'When on, a deal in this status is locked until it is reopened: its lines, payment schedule, team and every field except Description and Next Step become read-only.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealStatusType',
    @level2type = N'COLUMN', @level2name = N'LocksDeal';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Marks the role that owns the deal. Only one team member per deal can hold it, and that person is shown as the deal''s owner.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealRole',
    @level2type = N'COLUMN', @level2name = N'IsOwnerRole';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Whether more than one person can hold this role on the same deal, for example two sales engineers.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealRole',
    @level2type = N'COLUMN', @level2name = N'AllowsMultiplePerDeal';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'How a deal counts in the forecast: Omitted, Pipeline, Best Case, Commit or Closed. The Include flags on each category decide which forecast totals it adds to.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'ForecastCategoryType';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Why a deal was lost. Closing a deal as lost requires one.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'LossReason';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'When on, a deal closed as lost with this reason must also have loss notes.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'LossReason',
    @level2type = N'COLUMN', @level2name = N'RequiresNotes';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Where a person or organization is in the customer journey, from Subscriber to Customer. A lead is a contact at the Lead stage, not a separate record.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'LifecycleStageType';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Sales details for an organization you sell to. The account and its organization are one record.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'SalesAccount';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The account''s ID, the same as its organization''s ID.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'SalesAccount',
    @level2type = N'COLUMN', @level2name = N'ID';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Sales territory label for the account. It is not used to route or assign accounts.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'SalesAccount',
    @level2type = N'COLUMN', @level2name = N'Territory';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Approximate annual revenue as a range, for example $1M-$5M.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'SalesAccount',
    @level2type = N'COLUMN', @level2name = N'AnnualRevenueBand';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Approximate number of employees as a range, for example 50-200.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'SalesAccount',
    @level2type = N'COLUMN', @level2name = N'EmployeeCountBand';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Sales details for a person you sell to. The contact and its person are one record.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'SalesContact';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The contact''s ID, the same as its person''s ID.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'SalesContact',
    @level2type = N'COLUMN', @level2name = N'ID';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The contact''s usual buying role. The role on a particular deal is set in that deal''s buying team.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'SalesContact',
    @level2type = N'COLUMN', @level2name = N'BuyingRoleTypeID';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The company that owns this pipeline. Every deal in the pipeline belongs to this company.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Pipeline',
    @level2type = N'COLUMN', @level2name = N'CompanyID';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Short identifier for the pipeline, unique within its company.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Pipeline',
    @level2type = N'COLUMN', @level2name = N'Code';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'What happens when a deal in this pipeline is won, stored as JSON: whether a contract is created and of which type, and which follow-up tasks are raised.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Pipeline',
    @level2type = N'COLUMN', @level2name = N'CloseWonPolicy';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Whether deals in this pipeline carry product lines priced by Orders, or a single amount entered by hand.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Pipeline',
    @level2type = N'COLUMN', @level2name = N'RequiresDealLines';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'An ordered stage within a pipeline. Each stage sets the status a deal takes on when it enters the stage.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'PipelineStage';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The status a deal takes on when it enters this stage.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'PipelineStage',
    @level2type = N'COLUMN', @level2name = N'DealStatusTypeID';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Conditions for leaving this stage, stored as JSON for reference. The app does not check them.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'PipelineStage',
    @level2type = N'COLUMN', @level2name = N'ExitCriteria';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Guidance for reps on what a deal should have at this stage, in Markdown.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'PipelineStage',
    @level2type = N'COLUMN', @level2name = N'GuidanceMarkdown';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'A sales opportunity with an account. Its amount comes from the deal''s order, and winning it follows the pipeline''s close-won policy.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Deal';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The deal value. For a deal with product lines it is the order total calculated by Orders; for a deal without lines it is entered by hand.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Deal',
    @level2type = N'COLUMN', @level2name = N'Amount';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'On when Amount is the order total calculated by Orders; off when it was entered by hand.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Deal',
    @level2type = N'COLUMN', @level2name = N'AmountIsComputed';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Fingerprint of the order lines the amount was calculated from, used to tell when the amount is out of date.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Deal',
    @level2type = N'COLUMN', @level2name = N'AmountSourceHash';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The deal owner: the team member in the owner role. Updated automatically from the deal team.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Deal',
    @level2type = N'COLUMN', @level2name = N'OwnerEmployeeID';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The company selling the deal. It must match the pipeline''s company.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Deal',
    @level2type = N'COLUMN', @level2name = N'CompanyID';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The contract this deal belongs to, in BizApps Contracts.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Deal',
    @level2type = N'COLUMN', @level2name = N'ContractID';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The contract this deal renews. Required for deal types that are renewals.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Deal',
    @level2type = N'COLUMN', @level2name = N'RenewsContractID';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The contact who receives the invoice. Leave empty to use the primary contact.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Deal',
    @level2type = N'COLUMN', @level2name = N'BillingContactID';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The date the agreement was signed. It can be after the start date when work begins before signature.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Deal',
    @level2type = N'COLUMN', @level2name = N'ExecutionDate';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The date the service or subscription begins. It can be before the execution date.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Deal',
    @level2type = N'COLUMN', @level2name = N'StartDate';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Estimated project length in weeks, from the statement of work. It does not affect the term or renewal dates.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Deal',
    @level2type = N'COLUMN', @level2name = N'EstimatedProjectWeeks';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Annual price increase agreed for this deal, as a percent. Leave empty to use the contract type''s standard increase.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Deal',
    @level2type = N'COLUMN', @level2name = N'AnnualIncreasePctOverride';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Cancellation notice period agreed for this deal, in days. Leave empty to use the contract type''s standard notice period.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Deal',
    @level2type = N'COLUMN', @level2name = N'CancellationNoticeDaysOverride';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'How the customer expects to pay, for example ACH. For reference only.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Deal',
    @level2type = N'COLUMN', @level2name = N'PaymentMethod';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Whether the deal moved off the standard agreement. Copied to the contract when the deal is won, where it tells finance to review the changes.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Deal',
    @level2type = N'COLUMN', @level2name = N'StandardAgreementModified';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Summary of the terms negotiated away from the standard agreement, for legal review.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Deal',
    @level2type = N'COLUMN', @level2name = N'ContractVariances';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Payment instalments agreed for a deal when they differ from the standard terms. A deal on standard terms has no rows here.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealPaymentSchedule';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The instalment amount as agreed. Can be negative for a refund or credit.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealPaymentSchedule',
    @level2type = N'COLUMN', @level2name = N'Amount';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Position of the instalment in the schedule, for instalments that share a date or have none yet.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealPaymentSchedule',
    @level2type = N'COLUMN', @level2name = N'DisplayOrder';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'A record of a deal moving from one stage to another, with the amount and probability at that moment. These rows are never edited.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealStageEvent';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'When the stage change happened. For imported deals this is the original date, not the import date.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealStageEvent',
    @level2type = N'COLUMN', @level2name = N'ChangedAt';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The deal amount at the time of this stage change.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealStageEvent',
    @level2type = N'COLUMN', @level2name = N'AmountAtTransition';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'On when the amount at this stage change was the order total, off when it was entered by hand. Empty for changes recorded before this was tracked.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealStageEvent',
    @level2type = N'COLUMN', @level2name = N'AmountAtTransitionIsComputed';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The customer''s buying team: which contact plays which role on a deal.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealContactRole';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The internal people on a deal and the role each holds, including the owner. Totals by rep must count only the owner role or weight by attribution, or a deal is counted once per member.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealTeamMember';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The team member, when they are an employee. Set this or Person, not both.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealTeamMember',
    @level2type = N'COLUMN', @level2name = N'EmployeeID';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The team member, when they are not an employee, such as a partner rep. Set this or Employee, not both.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'DealTeamMember',
    @level2type = N'COLUMN', @level2name = N'PersonID';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The forecast for a pipeline and owner as captured on a given day, so past forecasts can be compared with today''s.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'ForecastSnapshot';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'Total of deals in commit forecast categories when the snapshot was taken.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'ForecastSnapshot',
    @level2type = N'COLUMN', @level2name = N'CommitAmount';
GO

EXEC sp_updateextendedproperty
    @name = N'MS_Description',
    @value = N'The detail behind the snapshot''s totals, stored as JSON.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'ForecastSnapshot',
    @level2type = N'COLUMN', @level2name = N'SnapshotJSON';
GO


















































-- EntityField.Description follows the new column descriptions, for the 15 entities whose
-- columns are described above. Entity-scoped: CodeGen no longer captures this call, and the
-- schema-wide form would reconcile entities this migration does not touch (CLAUDE.md,
-- "Migrations — additive only").
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='79148DE5-7F99-44AC-ACD4-5EE7BA93D354,862535EB-36DD-4434-8B4E-E256363E781F,69B5DBE6-F0A4-4291-9947-0B2B8129F349,F1C22449-8F48-42A8-945C-CBE2EFD9E847,5AC3D14E-A9BA-4667-AF73-5928DAE446BF,27E8D79F-A8E2-4AC1-B208-5A0F11416197,A5BC9EE5-4C4E-408B-BB07-3C718227B616,DF087A57-A6C1-4EDC-9C52-EB784D95287C,4697F309-CD43-42DD-A2B5-2747473E5B98,7E187729-0E0C-4ED6-AE5A-FFD14452BF2A,827FE4A6-F190-4D4C-A042-9A31FD695886,F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2,D9B2404D-CA19-4339-8E87-CE62B1C30647,15A9B6F8-9566-4A37-8588-2D00E8F1CB9A,530174B2-654E-4E14-BF28-3EF29AC9833D', @IncludedSchemaNames='${flyway:defaultSchema}';

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================

/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

