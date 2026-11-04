-- =============================================================================
-- Deal.CreationDate — the business creation date, for deal aging (#532).
-- =============================================================================
-- WHY NOT `__mj_CreatedAt`. That column records WHEN THE ROW WAS WRITTEN, and for
-- imported history that is import day, not deal day. It is CodeGen-maintained and not
-- editable, so it cannot carry a corrected date. The repo already pays for the gap:
-- `metadata/queries/SQL/deal-cycle-time.sql` cannot use it and infers a start instead —
-- the earlier of `__mj_CreatedAt` and the first `DealStageEvent.ChangedAt` — because on
-- seeded data a naive DATEDIFF from the row stamp returns NEGATIVE cycle times. This
-- column is where that inferred date belongs.
--
-- EDITABLE, deliberately. A rep or an AD corrects a deal whose creation date arrived
-- wrong from an import. That is the whole point of a second column: the row stamp stays
-- immutable provenance, this one carries the business fact.
--
-- `GETUTCDATE()`, NOT `SYSUTCDATETIME()`, AND THE CHOICE IS LOAD-BEARING. CodeGen on the
-- MJ 6.1 LTS line emits a column default into the generated create procedure through
-- `SQLServerCodeGenProvider.formatDefaultValue`, whose inline-safe list holds `getdate()`,
-- `getutcdate()`, `sysdatetime()`, `sysdatetimeoffset()` and `current_timestamp` — but NOT
-- `sysutcdatetime()`. A default it does not recognise is emitted as a QUOTED STRING, so a
-- `SYSUTCDATETIME()` default becomes `ISNULL(@CreationDate, 'sysutcdatetime()')` and raises
-- a datetimeoffset conversion error for any caller that passes NULL. The two existing
-- columns with that default (`DealStageEvent.ChangedAt`, `ForecastSnapshot.CapturedAt`)
-- carry the broken form today and get away with it only because the server always supplies
-- a value. Upstream as MemberJunction/MJ#4000, fixed on `next` by MJ PR #6067, NOT
-- backported to `lts/6.1`. `GETUTCDATE()` is on the list, emits unquoted, and is MJ's own
-- idiom for a DATETIMEOFFSET stamp — CodeGen uses it for every `__mj_CreatedAt`. On this
-- column it differs only in fractional-second precision (3 digits against 7), which is
-- nothing for a day-grained aging measure.
--
-- THE BACKFILL IS NOT THE DEFAULT, AND THAT DISTINCTION IS THE WHOLE MIGRATION. Adding a
-- NOT NULL column with a default stamps EVERY EXISTING DEAL with this migration's run
-- instant — the same defect the cycle-time query exists to dodge, applied permanently to
-- every seeded and imported deal. So the UPDATE below re-derives each existing row from the
-- earliest evidence the deal existed, using the rule that query already uses. New rows take
-- the default; existing rows take their history.
--
-- NO CHECK CONSTRAINT. A `CreationDate <= ActualCloseDate` ordering check would reject real
-- imported data, and this table already made that call explicitly for ExecutionDate and
-- StartDate. The cycle-time query deliberately EXCLUDES a close stamped before its start so
-- it stays visible as a data gap rather than being clamped; moving that into a constraint
-- would turn a visible gap into a failed import.
-- =============================================================================

ALTER TABLE [${flyway:defaultSchema}].[Deal]
    ADD CreationDate DATETIMEOFFSET NOT NULL
        CONSTRAINT DF_Deal_CreationDate DEFAULT GETUTCDATE();
GO

-- Existing rows: the earliest evidence the deal existed, not this migration's run instant.
-- The correlated MIN is filtered to events EARLIER than the row stamp, so a deal whose
-- events all follow its creation (every natively-entered deal) falls through to ISNULL and
-- keeps `__mj_CreatedAt`. A deal with no events at all does the same.
UPDATE d
SET d.CreationDate = ISNULL(
        (SELECT MIN(e.ChangedAt)
           FROM [${flyway:defaultSchema}].[DealStageEvent] e
          WHERE e.DealID = d.ID
            AND e.ChangedAt < d.__mj_CreatedAt),
        d.__mj_CreatedAt)
FROM [${flyway:defaultSchema}].[Deal] d;
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Date and Time the Deal was created, defaulted to the record creation date but editable by the User. Used for deal aging.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Deal',
    @level2type = N'COLUMN', @level2name = N'CreationDate';
GO

-- vwDeals is a `SELECT d.*` layered view, and SQL Server fixes a view's column list when the
-- view is created. The CodeGen block below resequences Deal's fields from that view before it
-- recreates it, so without this refresh the new column is missing from the view, a lookup
-- column takes its sequence, and the EntityField insert fails on
-- UQ_EntityField_EntityID_Sequence on a fresh install. (The same note, and the same fix, as
-- V202609231400__v6.1.x__Pipeline_IncludeInForecast.sql.)
EXEC sp_refreshview '[${flyway:defaultSchema}].[vwDeals]';
GO

-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================
-- `mj codegen` (MJ CLI 6.1.6) against a database built from migrations only: MJ core v6.1.6,
-- bizapps-common v5.57.0, bizapps-tasks v1.10.0, bizapps-accounting v0.25.0,
-- bizapps-contracts v0.9.0, bizapps-orders v5.35.1 (not later: see V202610201332), then this
-- app's migrations at `next` plus the DDL above. Reported success with per-entity field/view
-- parity clean, and a second pass wrote no SQL and changed no file, so the run converges.
--
-- DEAL-SCOPED BLOCKS ONLY, matching V202611021600's selection. The same run also re-emitted
-- field categories for Deal's other 73 fields, the entity icon, the FieldCategoryInfo settings
-- and AI validation functions for eleven entities. None of that is caused by this column --- it
-- is output the committed state predates --- so shipping it here would put unrelated metadata
-- changes in a migration about one field. The one category statement BELOW is kept, because it
-- is this column's own: without it a host installed from migrations gets the field with no
-- Category or GeneratedFormSection while a host that ran CodeGen has both.
-- =============================================================================

/* SQL text to insert 1 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b3c1a716-5c4b-4b5c-ae60-4fa180e44480' OR (EntityID = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND Name = 'CreationDate')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'b3c1a716-5c4b-4b5c-ae60-4fa180e44480',
            '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', -- Entity: MJ_BizApps_Sales: Deals
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'),
            'CreationDate',
            'Creation Date',
            'Date and Time the Deal was created, defaulted to the record creation date but editable by the User. Used for deal aging.',
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

/* Index for Foreign Keys for Deal */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key PipelineID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_PipelineID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_PipelineID ON [${flyway:defaultSchema}].[Deal] ([PipelineID]);

-- Index for foreign key PipelineStageID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_PipelineStageID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_PipelineStageID ON [${flyway:defaultSchema}].[Deal] ([PipelineStageID]);

-- Index for foreign key DealTypeID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_DealTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_DealTypeID ON [${flyway:defaultSchema}].[Deal] ([DealTypeID]);

-- Index for foreign key DealStatusTypeID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_DealStatusTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_DealStatusTypeID ON [${flyway:defaultSchema}].[Deal] ([DealStatusTypeID]);

-- Index for foreign key AccountID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_AccountID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_AccountID ON [${flyway:defaultSchema}].[Deal] ([AccountID]);

-- Index for foreign key PrimaryContactID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_PrimaryContactID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_PrimaryContactID ON [${flyway:defaultSchema}].[Deal] ([PrimaryContactID]);

-- Index for foreign key BillingContactID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_BillingContactID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_BillingContactID ON [${flyway:defaultSchema}].[Deal] ([BillingContactID]);

-- Index for foreign key CompanyID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_CompanyID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_CompanyID ON [${flyway:defaultSchema}].[Deal] ([CompanyID]);

-- Index for foreign key OwnerEmployeeID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_OwnerEmployeeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_OwnerEmployeeID ON [${flyway:defaultSchema}].[Deal] ([OwnerEmployeeID]);

-- Index for foreign key CurrencyID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_CurrencyID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_CurrencyID ON [${flyway:defaultSchema}].[Deal] ([CurrencyID]);

-- Index for foreign key ForecastCategoryTypeID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_ForecastCategoryTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_ForecastCategoryTypeID ON [${flyway:defaultSchema}].[Deal] ([ForecastCategoryTypeID]);

-- Index for foreign key LossReasonID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_LossReasonID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_LossReasonID ON [${flyway:defaultSchema}].[Deal] ([LossReasonID]);

-- Index for foreign key LeadSourceTypeID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_LeadSourceTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_LeadSourceTypeID ON [${flyway:defaultSchema}].[Deal] ([LeadSourceTypeID]);

-- Index for foreign key ContractID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_ContractID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_ContractID ON [${flyway:defaultSchema}].[Deal] ([ContractID]);

-- Index for foreign key RenewsContractID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_RenewsContractID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_RenewsContractID ON [${flyway:defaultSchema}].[Deal] ([RenewsContractID]);

-- Index for foreign key ClosedByUserID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_ClosedByUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_ClosedByUserID ON [${flyway:defaultSchema}].[Deal] ([ClosedByUserID]);

-- Index for foreign key OrderID in table Deal
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_OrderID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_OrderID ON [${flyway:defaultSchema}].[Deal] ([OrderID]);

/* Base View SQL for MJ_BizApps_Sales: Deals */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: vwDealsGenerated
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Sales: Deals
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  Deal
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwDealsGenerated]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwDealsGenerated];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwDealsGenerated]
AS
SELECT
    d.*,
    mjBizAppsSalesPipeline_PipelineID.[Name] AS [Pipeline],
    mjBizAppsSalesPipelineStage_PipelineStageID.[Name] AS [PipelineStage],
    mjBizAppsSalesDealType_DealTypeID.[Name] AS [DealType],
    mjBizAppsSalesDealStatusType_DealStatusTypeID.[Name] AS [DealStatusType],
    mjBizAppsSalesSalesAccount_AccountID.[Name] AS [Account],
    mjBizAppsSalesSalesContact_PrimaryContactID.[DisplayNameAndEmail] AS [PrimaryContact],
    mjBizAppsSalesSalesContact_BillingContactID.[DisplayNameAndEmail] AS [BillingContact],
    MJCompany_CompanyID.[Name] AS [Company],
    MJEmployee_OwnerEmployeeID.[FirstLast] AS [OwnerEmployee],
    mjBizAppsSalesForecastCategoryType_ForecastCategoryTypeID.[Name] AS [ForecastCategoryType],
    mjBizAppsSalesLossReason_LossReasonID.[Name] AS [LossReason],
    mjBizAppsSalesLeadSourceType_LeadSourceTypeID.[Name] AS [LeadSourceType],
    MJUser_ClosedByUserID.[Name] AS [ClosedByUser],
    mjBizAppsOrdersOrderHeader_OrderID.[OrderNumber] AS [Order]
FROM
    [${flyway:defaultSchema}].[Deal] AS d
INNER JOIN
    [${flyway:defaultSchema}].[Pipeline] AS mjBizAppsSalesPipeline_PipelineID
  ON
    [d].[PipelineID] = mjBizAppsSalesPipeline_PipelineID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[PipelineStage] AS mjBizAppsSalesPipelineStage_PipelineStageID
  ON
    [d].[PipelineStageID] = mjBizAppsSalesPipelineStage_PipelineStageID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[DealType] AS mjBizAppsSalesDealType_DealTypeID
  ON
    [d].[DealTypeID] = mjBizAppsSalesDealType_DealTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[DealStatusType] AS mjBizAppsSalesDealStatusType_DealStatusTypeID
  ON
    [d].[DealStatusTypeID] = mjBizAppsSalesDealStatusType_DealStatusTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[vwSalesAccounts] AS mjBizAppsSalesSalesAccount_AccountID
  ON
    [d].[AccountID] = mjBizAppsSalesSalesAccount_AccountID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[vwSalesContacts] AS mjBizAppsSalesSalesContact_PrimaryContactID
  ON
    [d].[PrimaryContactID] = mjBizAppsSalesSalesContact_PrimaryContactID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[vwSalesContacts] AS mjBizAppsSalesSalesContact_BillingContactID
  ON
    [d].[BillingContactID] = mjBizAppsSalesSalesContact_BillingContactID.[ID]
INNER JOIN
    [${mjSchema}].[Company] AS MJCompany_CompanyID
  ON
    [d].[CompanyID] = MJCompany_CompanyID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[vwEmployees] AS MJEmployee_OwnerEmployeeID
  ON
    [d].[OwnerEmployeeID] = MJEmployee_OwnerEmployeeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[ForecastCategoryType] AS mjBizAppsSalesForecastCategoryType_ForecastCategoryTypeID
  ON
    [d].[ForecastCategoryTypeID] = mjBizAppsSalesForecastCategoryType_ForecastCategoryTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[LossReason] AS mjBizAppsSalesLossReason_LossReasonID
  ON
    [d].[LossReasonID] = mjBizAppsSalesLossReason_LossReasonID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[LeadSourceType] AS mjBizAppsSalesLeadSourceType_LeadSourceTypeID
  ON
    [d].[LeadSourceTypeID] = mjBizAppsSalesLeadSourceType_LeadSourceTypeID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_ClosedByUserID
  ON
    [d].[ClosedByUserID] = MJUser_ClosedByUserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}_BizAppsOrders].[OrderHeader] AS mjBizAppsOrdersOrderHeader_OrderID
  ON
    [d].[OrderID] = mjBizAppsOrdersOrderHeader_OrderID.[ID]
GO
IF OBJECT_ID('[${flyway:defaultSchema}].[vwDeals]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwDeals] TO [cdp_UI], [cdp_Developer], [cdp_Integration]';
END;

/* Base View Permissions SQL for MJ_BizApps_Sales: Deals */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: Permissions for vwDeals
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

IF OBJECT_ID('[${flyway:defaultSchema}].[vwDeals]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwDeals] TO [cdp_UI], [cdp_Developer], [cdp_Integration]';
END;

/* spCreate SQL for MJ_BizApps_Sales: Deals */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: spCreateDeal
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR Deal
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateDeal]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateDeal];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateDeal]
    @ID uniqueidentifier = NULL,
    @DealNumber_Clear bit = 0,
    @DealNumber nvarchar(50) = NULL,
    @Name nvarchar(500),
    @PipelineID uniqueidentifier,
    @PipelineStageID_Clear bit = 0,
    @PipelineStageID uniqueidentifier = NULL,
    @DealTypeID_Clear bit = 0,
    @DealTypeID uniqueidentifier = NULL,
    @DealStatusTypeID_Clear bit = 0,
    @DealStatusTypeID uniqueidentifier = NULL,
    @AccountID_Clear bit = 0,
    @AccountID uniqueidentifier = NULL,
    @PrimaryContactID_Clear bit = 0,
    @PrimaryContactID uniqueidentifier = NULL,
    @BillingContactID_Clear bit = 0,
    @BillingContactID uniqueidentifier = NULL,
    @CompanyID uniqueidentifier,
    @OwnerEmployeeID_Clear bit = 0,
    @OwnerEmployeeID uniqueidentifier = NULL,
    @Amount_Clear bit = 0,
    @Amount decimal(19, 4) = NULL,
    @AmountIsComputed bit = NULL,
    @AmountComputedAt_Clear bit = 0,
    @AmountComputedAt datetimeoffset = NULL,
    @AmountSourceHash_Clear bit = 0,
    @AmountSourceHash nvarchar(128) = NULL,
    @CurrencyID_Clear bit = 0,
    @CurrencyID uniqueidentifier = NULL,
    @MRR_Clear bit = 0,
    @MRR decimal(19, 4) = NULL,
    @ARR_Clear bit = 0,
    @ARR decimal(19, 4) = NULL,
    @TermMonths_Clear bit = 0,
    @TermMonths int = NULL,
    @EstimatedProjectWeeks_Clear bit = 0,
    @EstimatedProjectWeeks int = NULL,
    @ExecutionDate_Clear bit = 0,
    @ExecutionDate date = NULL,
    @StartDate_Clear bit = 0,
    @StartDate date = NULL,
    @ExpectedCloseDate_Clear bit = 0,
    @ExpectedCloseDate date = NULL,
    @ActualCloseDate_Clear bit = 0,
    @ActualCloseDate date = NULL,
    @Probability_Clear bit = 0,
    @Probability decimal(5, 2) = NULL,
    @ForecastCategoryTypeID_Clear bit = 0,
    @ForecastCategoryTypeID uniqueidentifier = NULL,
    @LossReasonID_Clear bit = 0,
    @LossReasonID uniqueidentifier = NULL,
    @LossNotes_Clear bit = 0,
    @LossNotes nvarchar(MAX) = NULL,
    @LeadSourceTypeID_Clear bit = 0,
    @LeadSourceTypeID uniqueidentifier = NULL,
    @CampaignID_Clear bit = 0,
    @CampaignID uniqueidentifier = NULL,
    @ContractID_Clear bit = 0,
    @ContractID uniqueidentifier = NULL,
    @RenewsContractID_Clear bit = 0,
    @RenewsContractID uniqueidentifier = NULL,
    @AutoRenew bit = NULL,
    @AnnualIncreasePctOverride_Clear bit = 0,
    @AnnualIncreasePctOverride decimal(5, 2) = NULL,
    @CancellationNoticeDaysOverride_Clear bit = 0,
    @CancellationNoticeDaysOverride int = NULL,
    @PaymentMethod_Clear bit = 0,
    @PaymentMethod nvarchar(50) = NULL,
    @StandardAgreementModified bit = NULL,
    @ContractVariances_Clear bit = 0,
    @ContractVariances nvarchar(MAX) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @NextStep_Clear bit = 0,
    @NextStep nvarchar(1000) = NULL,
    @NextStepDate_Clear bit = 0,
    @NextStepDate date = NULL,
    @ClosedAt_Clear bit = 0,
    @ClosedAt datetimeoffset = NULL,
    @ClosedByUserID_Clear bit = 0,
    @ClosedByUserID uniqueidentifier = NULL,
    @OrderID_Clear bit = 0,
    @OrderID uniqueidentifier = NULL,
    @PredictedWinProbability_Clear bit = 0,
    @PredictedWinProbability decimal(5, 4) = NULL,
    @PredictedWinRiskBand_Clear bit = 0,
    @PredictedWinRiskBand nvarchar(20) = NULL,
    @PredictedWinScoredAt_Clear bit = 0,
    @PredictedWinScoredAt datetimeoffset = NULL,
    @LeadSourceDetail_Clear bit = 0,
    @LeadSourceDetail nvarchar(500) = NULL,
    @CreationDate datetimeoffset = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[Deal]
            (
                [ID],
                [DealNumber],
                [Name],
                [PipelineID],
                [PipelineStageID],
                [DealTypeID],
                [DealStatusTypeID],
                [AccountID],
                [PrimaryContactID],
                [BillingContactID],
                [CompanyID],
                [OwnerEmployeeID],
                [Amount],
                [AmountIsComputed],
                [AmountComputedAt],
                [AmountSourceHash],
                [CurrencyID],
                [MRR],
                [ARR],
                [TermMonths],
                [EstimatedProjectWeeks],
                [ExecutionDate],
                [StartDate],
                [ExpectedCloseDate],
                [ActualCloseDate],
                [Probability],
                [ForecastCategoryTypeID],
                [LossReasonID],
                [LossNotes],
                [LeadSourceTypeID],
                [CampaignID],
                [ContractID],
                [RenewsContractID],
                [AutoRenew],
                [AnnualIncreasePctOverride],
                [CancellationNoticeDaysOverride],
                [PaymentMethod],
                [StandardAgreementModified],
                [ContractVariances],
                [Description],
                [NextStep],
                [NextStepDate],
                [ClosedAt],
                [ClosedByUserID],
                [OrderID],
                [PredictedWinProbability],
                [PredictedWinRiskBand],
                [PredictedWinScoredAt],
                [LeadSourceDetail],
                [CreationDate]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                CASE WHEN @DealNumber_Clear = 1 THEN NULL ELSE ISNULL(@DealNumber, NULL) END,
                @Name,
                @PipelineID,
                CASE WHEN @PipelineStageID_Clear = 1 THEN NULL ELSE ISNULL(@PipelineStageID, NULL) END,
                CASE WHEN @DealTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealTypeID, NULL) END,
                CASE WHEN @DealStatusTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealStatusTypeID, NULL) END,
                CASE WHEN @AccountID_Clear = 1 THEN NULL ELSE ISNULL(@AccountID, NULL) END,
                CASE WHEN @PrimaryContactID_Clear = 1 THEN NULL ELSE ISNULL(@PrimaryContactID, NULL) END,
                CASE WHEN @BillingContactID_Clear = 1 THEN NULL ELSE ISNULL(@BillingContactID, NULL) END,
                @CompanyID,
                CASE WHEN @OwnerEmployeeID_Clear = 1 THEN NULL ELSE ISNULL(@OwnerEmployeeID, NULL) END,
                CASE WHEN @Amount_Clear = 1 THEN NULL ELSE ISNULL(@Amount, NULL) END,
                ISNULL(@AmountIsComputed, 0),
                CASE WHEN @AmountComputedAt_Clear = 1 THEN NULL ELSE ISNULL(@AmountComputedAt, NULL) END,
                CASE WHEN @AmountSourceHash_Clear = 1 THEN NULL ELSE ISNULL(@AmountSourceHash, NULL) END,
                CASE WHEN @CurrencyID_Clear = 1 THEN NULL ELSE ISNULL(@CurrencyID, NULL) END,
                CASE WHEN @MRR_Clear = 1 THEN NULL ELSE ISNULL(@MRR, NULL) END,
                CASE WHEN @ARR_Clear = 1 THEN NULL ELSE ISNULL(@ARR, NULL) END,
                CASE WHEN @TermMonths_Clear = 1 THEN NULL ELSE ISNULL(@TermMonths, NULL) END,
                CASE WHEN @EstimatedProjectWeeks_Clear = 1 THEN NULL ELSE ISNULL(@EstimatedProjectWeeks, NULL) END,
                CASE WHEN @ExecutionDate_Clear = 1 THEN NULL ELSE ISNULL(@ExecutionDate, NULL) END,
                CASE WHEN @StartDate_Clear = 1 THEN NULL ELSE ISNULL(@StartDate, NULL) END,
                CASE WHEN @ExpectedCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ExpectedCloseDate, NULL) END,
                CASE WHEN @ActualCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ActualCloseDate, NULL) END,
                CASE WHEN @Probability_Clear = 1 THEN NULL ELSE ISNULL(@Probability, NULL) END,
                CASE WHEN @ForecastCategoryTypeID_Clear = 1 THEN NULL ELSE ISNULL(@ForecastCategoryTypeID, NULL) END,
                CASE WHEN @LossReasonID_Clear = 1 THEN NULL ELSE ISNULL(@LossReasonID, NULL) END,
                CASE WHEN @LossNotes_Clear = 1 THEN NULL ELSE ISNULL(@LossNotes, NULL) END,
                CASE WHEN @LeadSourceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@LeadSourceTypeID, NULL) END,
                CASE WHEN @CampaignID_Clear = 1 THEN NULL ELSE ISNULL(@CampaignID, NULL) END,
                CASE WHEN @ContractID_Clear = 1 THEN NULL ELSE ISNULL(@ContractID, NULL) END,
                CASE WHEN @RenewsContractID_Clear = 1 THEN NULL ELSE ISNULL(@RenewsContractID, NULL) END,
                ISNULL(@AutoRenew, 0),
                CASE WHEN @AnnualIncreasePctOverride_Clear = 1 THEN NULL ELSE ISNULL(@AnnualIncreasePctOverride, NULL) END,
                CASE WHEN @CancellationNoticeDaysOverride_Clear = 1 THEN NULL ELSE ISNULL(@CancellationNoticeDaysOverride, NULL) END,
                CASE WHEN @PaymentMethod_Clear = 1 THEN NULL ELSE ISNULL(@PaymentMethod, 'ACH') END,
                ISNULL(@StandardAgreementModified, 0),
                CASE WHEN @ContractVariances_Clear = 1 THEN NULL ELSE ISNULL(@ContractVariances, NULL) END,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                CASE WHEN @NextStep_Clear = 1 THEN NULL ELSE ISNULL(@NextStep, NULL) END,
                CASE WHEN @NextStepDate_Clear = 1 THEN NULL ELSE ISNULL(@NextStepDate, NULL) END,
                CASE WHEN @ClosedAt_Clear = 1 THEN NULL ELSE ISNULL(@ClosedAt, NULL) END,
                CASE WHEN @ClosedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ClosedByUserID, NULL) END,
                CASE WHEN @OrderID_Clear = 1 THEN NULL ELSE ISNULL(@OrderID, NULL) END,
                CASE WHEN @PredictedWinProbability_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinProbability, NULL) END,
                CASE WHEN @PredictedWinRiskBand_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinRiskBand, NULL) END,
                CASE WHEN @PredictedWinScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinScoredAt, NULL) END,
                CASE WHEN @LeadSourceDetail_Clear = 1 THEN NULL ELSE ISNULL(@LeadSourceDetail, NULL) END,
                ISNULL(@CreationDate, getutcdate())
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[Deal]
            (
                [DealNumber],
                [Name],
                [PipelineID],
                [PipelineStageID],
                [DealTypeID],
                [DealStatusTypeID],
                [AccountID],
                [PrimaryContactID],
                [BillingContactID],
                [CompanyID],
                [OwnerEmployeeID],
                [Amount],
                [AmountIsComputed],
                [AmountComputedAt],
                [AmountSourceHash],
                [CurrencyID],
                [MRR],
                [ARR],
                [TermMonths],
                [EstimatedProjectWeeks],
                [ExecutionDate],
                [StartDate],
                [ExpectedCloseDate],
                [ActualCloseDate],
                [Probability],
                [ForecastCategoryTypeID],
                [LossReasonID],
                [LossNotes],
                [LeadSourceTypeID],
                [CampaignID],
                [ContractID],
                [RenewsContractID],
                [AutoRenew],
                [AnnualIncreasePctOverride],
                [CancellationNoticeDaysOverride],
                [PaymentMethod],
                [StandardAgreementModified],
                [ContractVariances],
                [Description],
                [NextStep],
                [NextStepDate],
                [ClosedAt],
                [ClosedByUserID],
                [OrderID],
                [PredictedWinProbability],
                [PredictedWinRiskBand],
                [PredictedWinScoredAt],
                [LeadSourceDetail],
                [CreationDate]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                CASE WHEN @DealNumber_Clear = 1 THEN NULL ELSE ISNULL(@DealNumber, NULL) END,
                @Name,
                @PipelineID,
                CASE WHEN @PipelineStageID_Clear = 1 THEN NULL ELSE ISNULL(@PipelineStageID, NULL) END,
                CASE WHEN @DealTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealTypeID, NULL) END,
                CASE WHEN @DealStatusTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealStatusTypeID, NULL) END,
                CASE WHEN @AccountID_Clear = 1 THEN NULL ELSE ISNULL(@AccountID, NULL) END,
                CASE WHEN @PrimaryContactID_Clear = 1 THEN NULL ELSE ISNULL(@PrimaryContactID, NULL) END,
                CASE WHEN @BillingContactID_Clear = 1 THEN NULL ELSE ISNULL(@BillingContactID, NULL) END,
                @CompanyID,
                CASE WHEN @OwnerEmployeeID_Clear = 1 THEN NULL ELSE ISNULL(@OwnerEmployeeID, NULL) END,
                CASE WHEN @Amount_Clear = 1 THEN NULL ELSE ISNULL(@Amount, NULL) END,
                ISNULL(@AmountIsComputed, 0),
                CASE WHEN @AmountComputedAt_Clear = 1 THEN NULL ELSE ISNULL(@AmountComputedAt, NULL) END,
                CASE WHEN @AmountSourceHash_Clear = 1 THEN NULL ELSE ISNULL(@AmountSourceHash, NULL) END,
                CASE WHEN @CurrencyID_Clear = 1 THEN NULL ELSE ISNULL(@CurrencyID, NULL) END,
                CASE WHEN @MRR_Clear = 1 THEN NULL ELSE ISNULL(@MRR, NULL) END,
                CASE WHEN @ARR_Clear = 1 THEN NULL ELSE ISNULL(@ARR, NULL) END,
                CASE WHEN @TermMonths_Clear = 1 THEN NULL ELSE ISNULL(@TermMonths, NULL) END,
                CASE WHEN @EstimatedProjectWeeks_Clear = 1 THEN NULL ELSE ISNULL(@EstimatedProjectWeeks, NULL) END,
                CASE WHEN @ExecutionDate_Clear = 1 THEN NULL ELSE ISNULL(@ExecutionDate, NULL) END,
                CASE WHEN @StartDate_Clear = 1 THEN NULL ELSE ISNULL(@StartDate, NULL) END,
                CASE WHEN @ExpectedCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ExpectedCloseDate, NULL) END,
                CASE WHEN @ActualCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ActualCloseDate, NULL) END,
                CASE WHEN @Probability_Clear = 1 THEN NULL ELSE ISNULL(@Probability, NULL) END,
                CASE WHEN @ForecastCategoryTypeID_Clear = 1 THEN NULL ELSE ISNULL(@ForecastCategoryTypeID, NULL) END,
                CASE WHEN @LossReasonID_Clear = 1 THEN NULL ELSE ISNULL(@LossReasonID, NULL) END,
                CASE WHEN @LossNotes_Clear = 1 THEN NULL ELSE ISNULL(@LossNotes, NULL) END,
                CASE WHEN @LeadSourceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@LeadSourceTypeID, NULL) END,
                CASE WHEN @CampaignID_Clear = 1 THEN NULL ELSE ISNULL(@CampaignID, NULL) END,
                CASE WHEN @ContractID_Clear = 1 THEN NULL ELSE ISNULL(@ContractID, NULL) END,
                CASE WHEN @RenewsContractID_Clear = 1 THEN NULL ELSE ISNULL(@RenewsContractID, NULL) END,
                ISNULL(@AutoRenew, 0),
                CASE WHEN @AnnualIncreasePctOverride_Clear = 1 THEN NULL ELSE ISNULL(@AnnualIncreasePctOverride, NULL) END,
                CASE WHEN @CancellationNoticeDaysOverride_Clear = 1 THEN NULL ELSE ISNULL(@CancellationNoticeDaysOverride, NULL) END,
                CASE WHEN @PaymentMethod_Clear = 1 THEN NULL ELSE ISNULL(@PaymentMethod, 'ACH') END,
                ISNULL(@StandardAgreementModified, 0),
                CASE WHEN @ContractVariances_Clear = 1 THEN NULL ELSE ISNULL(@ContractVariances, NULL) END,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                CASE WHEN @NextStep_Clear = 1 THEN NULL ELSE ISNULL(@NextStep, NULL) END,
                CASE WHEN @NextStepDate_Clear = 1 THEN NULL ELSE ISNULL(@NextStepDate, NULL) END,
                CASE WHEN @ClosedAt_Clear = 1 THEN NULL ELSE ISNULL(@ClosedAt, NULL) END,
                CASE WHEN @ClosedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ClosedByUserID, NULL) END,
                CASE WHEN @OrderID_Clear = 1 THEN NULL ELSE ISNULL(@OrderID, NULL) END,
                CASE WHEN @PredictedWinProbability_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinProbability, NULL) END,
                CASE WHEN @PredictedWinRiskBand_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinRiskBand, NULL) END,
                CASE WHEN @PredictedWinScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinScoredAt, NULL) END,
                CASE WHEN @LeadSourceDetail_Clear = 1 THEN NULL ELSE ISNULL(@LeadSourceDetail, NULL) END,
                ISNULL(@CreationDate, getutcdate())
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwDeals] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Sales: Deals */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateDeal] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Sales: Deals */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: spUpdateDeal
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR Deal
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateDeal]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateDeal];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateDeal]
    @ID uniqueidentifier,
    @DealNumber_Clear bit = 0,
    @DealNumber nvarchar(50) = NULL,
    @Name nvarchar(500) = NULL,
    @PipelineID uniqueidentifier = NULL,
    @PipelineStageID_Clear bit = 0,
    @PipelineStageID uniqueidentifier = NULL,
    @DealTypeID_Clear bit = 0,
    @DealTypeID uniqueidentifier = NULL,
    @DealStatusTypeID_Clear bit = 0,
    @DealStatusTypeID uniqueidentifier = NULL,
    @AccountID_Clear bit = 0,
    @AccountID uniqueidentifier = NULL,
    @PrimaryContactID_Clear bit = 0,
    @PrimaryContactID uniqueidentifier = NULL,
    @BillingContactID_Clear bit = 0,
    @BillingContactID uniqueidentifier = NULL,
    @CompanyID uniqueidentifier = NULL,
    @OwnerEmployeeID_Clear bit = 0,
    @OwnerEmployeeID uniqueidentifier = NULL,
    @Amount_Clear bit = 0,
    @Amount decimal(19, 4) = NULL,
    @AmountIsComputed bit = NULL,
    @AmountComputedAt_Clear bit = 0,
    @AmountComputedAt datetimeoffset = NULL,
    @AmountSourceHash_Clear bit = 0,
    @AmountSourceHash nvarchar(128) = NULL,
    @CurrencyID_Clear bit = 0,
    @CurrencyID uniqueidentifier = NULL,
    @MRR_Clear bit = 0,
    @MRR decimal(19, 4) = NULL,
    @ARR_Clear bit = 0,
    @ARR decimal(19, 4) = NULL,
    @TermMonths_Clear bit = 0,
    @TermMonths int = NULL,
    @EstimatedProjectWeeks_Clear bit = 0,
    @EstimatedProjectWeeks int = NULL,
    @ExecutionDate_Clear bit = 0,
    @ExecutionDate date = NULL,
    @StartDate_Clear bit = 0,
    @StartDate date = NULL,
    @ExpectedCloseDate_Clear bit = 0,
    @ExpectedCloseDate date = NULL,
    @ActualCloseDate_Clear bit = 0,
    @ActualCloseDate date = NULL,
    @Probability_Clear bit = 0,
    @Probability decimal(5, 2) = NULL,
    @ForecastCategoryTypeID_Clear bit = 0,
    @ForecastCategoryTypeID uniqueidentifier = NULL,
    @LossReasonID_Clear bit = 0,
    @LossReasonID uniqueidentifier = NULL,
    @LossNotes_Clear bit = 0,
    @LossNotes nvarchar(MAX) = NULL,
    @LeadSourceTypeID_Clear bit = 0,
    @LeadSourceTypeID uniqueidentifier = NULL,
    @CampaignID_Clear bit = 0,
    @CampaignID uniqueidentifier = NULL,
    @ContractID_Clear bit = 0,
    @ContractID uniqueidentifier = NULL,
    @RenewsContractID_Clear bit = 0,
    @RenewsContractID uniqueidentifier = NULL,
    @AutoRenew bit = NULL,
    @AnnualIncreasePctOverride_Clear bit = 0,
    @AnnualIncreasePctOverride decimal(5, 2) = NULL,
    @CancellationNoticeDaysOverride_Clear bit = 0,
    @CancellationNoticeDaysOverride int = NULL,
    @PaymentMethod_Clear bit = 0,
    @PaymentMethod nvarchar(50) = NULL,
    @StandardAgreementModified bit = NULL,
    @ContractVariances_Clear bit = 0,
    @ContractVariances nvarchar(MAX) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @NextStep_Clear bit = 0,
    @NextStep nvarchar(1000) = NULL,
    @NextStepDate_Clear bit = 0,
    @NextStepDate date = NULL,
    @ClosedAt_Clear bit = 0,
    @ClosedAt datetimeoffset = NULL,
    @ClosedByUserID_Clear bit = 0,
    @ClosedByUserID uniqueidentifier = NULL,
    @OrderID_Clear bit = 0,
    @OrderID uniqueidentifier = NULL,
    @PredictedWinProbability_Clear bit = 0,
    @PredictedWinProbability decimal(5, 4) = NULL,
    @PredictedWinRiskBand_Clear bit = 0,
    @PredictedWinRiskBand nvarchar(20) = NULL,
    @PredictedWinScoredAt_Clear bit = 0,
    @PredictedWinScoredAt datetimeoffset = NULL,
    @LeadSourceDetail_Clear bit = 0,
    @LeadSourceDetail nvarchar(500) = NULL,
    @CreationDate datetimeoffset = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[Deal]
    SET
        [DealNumber] = CASE WHEN @DealNumber_Clear = 1 THEN NULL ELSE ISNULL(@DealNumber, [DealNumber]) END,
        [Name] = ISNULL(@Name, [Name]),
        [PipelineID] = ISNULL(@PipelineID, [PipelineID]),
        [PipelineStageID] = CASE WHEN @PipelineStageID_Clear = 1 THEN NULL ELSE ISNULL(@PipelineStageID, [PipelineStageID]) END,
        [DealTypeID] = CASE WHEN @DealTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealTypeID, [DealTypeID]) END,
        [DealStatusTypeID] = CASE WHEN @DealStatusTypeID_Clear = 1 THEN NULL ELSE ISNULL(@DealStatusTypeID, [DealStatusTypeID]) END,
        [AccountID] = CASE WHEN @AccountID_Clear = 1 THEN NULL ELSE ISNULL(@AccountID, [AccountID]) END,
        [PrimaryContactID] = CASE WHEN @PrimaryContactID_Clear = 1 THEN NULL ELSE ISNULL(@PrimaryContactID, [PrimaryContactID]) END,
        [BillingContactID] = CASE WHEN @BillingContactID_Clear = 1 THEN NULL ELSE ISNULL(@BillingContactID, [BillingContactID]) END,
        [CompanyID] = ISNULL(@CompanyID, [CompanyID]),
        [OwnerEmployeeID] = CASE WHEN @OwnerEmployeeID_Clear = 1 THEN NULL ELSE ISNULL(@OwnerEmployeeID, [OwnerEmployeeID]) END,
        [Amount] = CASE WHEN @Amount_Clear = 1 THEN NULL ELSE ISNULL(@Amount, [Amount]) END,
        [AmountIsComputed] = ISNULL(@AmountIsComputed, [AmountIsComputed]),
        [AmountComputedAt] = CASE WHEN @AmountComputedAt_Clear = 1 THEN NULL ELSE ISNULL(@AmountComputedAt, [AmountComputedAt]) END,
        [AmountSourceHash] = CASE WHEN @AmountSourceHash_Clear = 1 THEN NULL ELSE ISNULL(@AmountSourceHash, [AmountSourceHash]) END,
        [CurrencyID] = CASE WHEN @CurrencyID_Clear = 1 THEN NULL ELSE ISNULL(@CurrencyID, [CurrencyID]) END,
        [MRR] = CASE WHEN @MRR_Clear = 1 THEN NULL ELSE ISNULL(@MRR, [MRR]) END,
        [ARR] = CASE WHEN @ARR_Clear = 1 THEN NULL ELSE ISNULL(@ARR, [ARR]) END,
        [TermMonths] = CASE WHEN @TermMonths_Clear = 1 THEN NULL ELSE ISNULL(@TermMonths, [TermMonths]) END,
        [EstimatedProjectWeeks] = CASE WHEN @EstimatedProjectWeeks_Clear = 1 THEN NULL ELSE ISNULL(@EstimatedProjectWeeks, [EstimatedProjectWeeks]) END,
        [ExecutionDate] = CASE WHEN @ExecutionDate_Clear = 1 THEN NULL ELSE ISNULL(@ExecutionDate, [ExecutionDate]) END,
        [StartDate] = CASE WHEN @StartDate_Clear = 1 THEN NULL ELSE ISNULL(@StartDate, [StartDate]) END,
        [ExpectedCloseDate] = CASE WHEN @ExpectedCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ExpectedCloseDate, [ExpectedCloseDate]) END,
        [ActualCloseDate] = CASE WHEN @ActualCloseDate_Clear = 1 THEN NULL ELSE ISNULL(@ActualCloseDate, [ActualCloseDate]) END,
        [Probability] = CASE WHEN @Probability_Clear = 1 THEN NULL ELSE ISNULL(@Probability, [Probability]) END,
        [ForecastCategoryTypeID] = CASE WHEN @ForecastCategoryTypeID_Clear = 1 THEN NULL ELSE ISNULL(@ForecastCategoryTypeID, [ForecastCategoryTypeID]) END,
        [LossReasonID] = CASE WHEN @LossReasonID_Clear = 1 THEN NULL ELSE ISNULL(@LossReasonID, [LossReasonID]) END,
        [LossNotes] = CASE WHEN @LossNotes_Clear = 1 THEN NULL ELSE ISNULL(@LossNotes, [LossNotes]) END,
        [LeadSourceTypeID] = CASE WHEN @LeadSourceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@LeadSourceTypeID, [LeadSourceTypeID]) END,
        [CampaignID] = CASE WHEN @CampaignID_Clear = 1 THEN NULL ELSE ISNULL(@CampaignID, [CampaignID]) END,
        [ContractID] = CASE WHEN @ContractID_Clear = 1 THEN NULL ELSE ISNULL(@ContractID, [ContractID]) END,
        [RenewsContractID] = CASE WHEN @RenewsContractID_Clear = 1 THEN NULL ELSE ISNULL(@RenewsContractID, [RenewsContractID]) END,
        [AutoRenew] = ISNULL(@AutoRenew, [AutoRenew]),
        [AnnualIncreasePctOverride] = CASE WHEN @AnnualIncreasePctOverride_Clear = 1 THEN NULL ELSE ISNULL(@AnnualIncreasePctOverride, [AnnualIncreasePctOverride]) END,
        [CancellationNoticeDaysOverride] = CASE WHEN @CancellationNoticeDaysOverride_Clear = 1 THEN NULL ELSE ISNULL(@CancellationNoticeDaysOverride, [CancellationNoticeDaysOverride]) END,
        [PaymentMethod] = CASE WHEN @PaymentMethod_Clear = 1 THEN NULL ELSE ISNULL(@PaymentMethod, [PaymentMethod]) END,
        [StandardAgreementModified] = ISNULL(@StandardAgreementModified, [StandardAgreementModified]),
        [ContractVariances] = CASE WHEN @ContractVariances_Clear = 1 THEN NULL ELSE ISNULL(@ContractVariances, [ContractVariances]) END,
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [NextStep] = CASE WHEN @NextStep_Clear = 1 THEN NULL ELSE ISNULL(@NextStep, [NextStep]) END,
        [NextStepDate] = CASE WHEN @NextStepDate_Clear = 1 THEN NULL ELSE ISNULL(@NextStepDate, [NextStepDate]) END,
        [ClosedAt] = CASE WHEN @ClosedAt_Clear = 1 THEN NULL ELSE ISNULL(@ClosedAt, [ClosedAt]) END,
        [ClosedByUserID] = CASE WHEN @ClosedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@ClosedByUserID, [ClosedByUserID]) END,
        [OrderID] = CASE WHEN @OrderID_Clear = 1 THEN NULL ELSE ISNULL(@OrderID, [OrderID]) END,
        [PredictedWinProbability] = CASE WHEN @PredictedWinProbability_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinProbability, [PredictedWinProbability]) END,
        [PredictedWinRiskBand] = CASE WHEN @PredictedWinRiskBand_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinRiskBand, [PredictedWinRiskBand]) END,
        [PredictedWinScoredAt] = CASE WHEN @PredictedWinScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinScoredAt, [PredictedWinScoredAt]) END,
        [LeadSourceDetail] = CASE WHEN @LeadSourceDetail_Clear = 1 THEN NULL ELSE ISNULL(@LeadSourceDetail, [LeadSourceDetail]) END,
        [CreationDate] = ISNULL(@CreationDate, [CreationDate])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwDeals] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwDeals]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the Deal table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateDeal]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateDeal];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateDeal
ON [${flyway:defaultSchema}].[Deal]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[Deal]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[Deal] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Sales: Deals */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateDeal] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Sales: Deals */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Sales: Deals
-- Item: spDeleteDeal
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR Deal
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteDeal]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteDeal];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteDeal]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[Deal]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Sales: Deals */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteDeal] TO [cdp_Developer], [cdp_Integration];

/* Field category for the new column (from the same run's categorization pass) */
-- UPDATE Entity Field Category Info MJ_BizApps_Sales: Deals.CreationDate 
UPDATE [${mjSchema}].[EntityField]
SET 
   Category = 'Timeline & Milestones',
   GeneratedFormSection = 'Category'
WHERE 
   ID = 'B3C1A716-5C4B-4B5C-AE60-4FA180E44480';

/* Refresh custom base views for modified entities so schema changes are picked up */
EXEC sp_refreshview '${flyway:defaultSchema}.vwDealsGenerated';
IF OBJECT_ID('[${flyway:defaultSchema}].[vwDeals]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'EXEC sp_refreshview ''${flyway:defaultSchema}.vwDeals'';';
END;
