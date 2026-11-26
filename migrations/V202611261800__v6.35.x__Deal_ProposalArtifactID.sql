-- =============================================================================
-- Deal.ProposalArtifactID — additive nullable FK to MJ Docs (MJ: Artifacts).
-- =============================================================================
-- Links a Sales Deal to an optional MJ Docs (MJ: Artifacts) deliverable
-- (Customer Proposal, Executive Deal Brief, or Mutual Action Plan) while
-- preserving 100% backward compatibility for existing Deals (NULL default).
-- Strictly additive per PUBLISH_NO_BREAK_POLICY.md: zero drops, renames, or
-- NOT NULL constraints without defaults.
-- =============================================================================

ALTER TABLE [${flyway:defaultSchema}].[Deal]
    ADD [ProposalArtifactID] UNIQUEIDENTIFIER NULL
        CONSTRAINT [FK_Deal_ProposalArtifact] FOREIGN KEY REFERENCES [${mjSchema}].[Artifact]([ID]);
GO

CREATE NONCLUSTERED INDEX [IX_Deal_ProposalArtifactID]
    ON [${flyway:defaultSchema}].[Deal] ([ProposalArtifactID])
    WHERE [ProposalArtifactID] IS NOT NULL;
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'Optional foreign key referencing the MJ Docs (MJ: Artifacts) record for this Deal (Customer Proposal, Executive Deal Brief, or Mutual Action Plan).',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE',  @level1name = N'Deal',
    @level2type = N'COLUMN', @level2name = N'ProposalArtifactID';
GO




















































-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================
-- Captured from canonical `mj codegen` (MJ CLI 6.3.0-edge.1) scoped strictly to
-- MJ_BizApps_Sales: Deals after applying the additive DDL above.
-- =============================================================================

/* SQL text to insert 1 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '109a68cb-0a14-4abc-b9ec-779cdd159b7a' OR (EntityID = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND Name = 'ProposalArtifactID')) BEGIN
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
            '109a68cb-0a14-4abc-b9ec-779cdd159b7a',
            '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', -- Entity: MJ_BizApps_Sales: Deals
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'),
            'ProposalArtifactID',
            'Proposal Artifact ID',
            'Optional foreign key referencing the MJ Docs (MJ: Artifacts) record for this Deal (Customer Proposal, Executive Deal Brief, or Mutual Action Plan).',
            'uniqueidentifier',
            16,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            'F48D2341-8667-40BB-BCA8-87D7F80E16CD',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

/* Create Entity Relationship: MJ: Artifacts -> MJ_BizApps_Sales: Deals (One To Many via ProposalArtifactID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'cd835b73-d939-4bf1-9ea4-52208c16a808' OR ([EntityID] = 'F48D2341-8667-40BB-BCA8-87D7F80E16CD' AND [RelatedEntityID] = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND [RelatedEntityJoinField] = 'ProposalArtifactID')
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('cd835b73-d939-4bf1-9ea4-52208c16a808', 'F48D2341-8667-40BB-BCA8-87D7F80E16CD', '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', 'ProposalArtifactID', 'One To Many', 1, 1, 10, GETUTCDATE(), GETUTCDATE())
   END;

EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='109A68CB-0A14-4ABC-B9EC-779CDD159B7A', @RelatedEntityNameFieldMap='ProposalArtifact';

-- Index for foreign key ProposalArtifactID in table Deal
-- Skipped when the index exists or another unfiltered index already leads with the column.
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Deal_ProposalArtifactID'
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
    UNION ALL
    SELECT 1
    FROM sys.indexes i
    WHERE i.object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]')
    AND i.has_filter = 0
    AND i.is_disabled = 0
    AND i.is_hypothetical = 0
    AND (
        SELECT COUNT(*)
        FROM sys.index_columns ic
        WHERE ic.object_id = i.object_id
        AND ic.index_id = i.index_id
        AND ic.is_included_column = 0
        AND ((ic.key_ordinal = 1 AND COL_NAME(ic.object_id, ic.column_id) = 'ProposalArtifactID'))
    ) = 1
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Deal_ProposalArtifactID ON [${flyway:defaultSchema}].[Deal] ([ProposalArtifactID]);

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
    mjBizAppsOrdersOrderHeader_OrderID.[OrderNumber] AS [Order],
    MJArtifact_ProposalArtifactID.[Name] AS [ProposalArtifact]
FROM
    [${flyway:defaultSchema}].[Deal] AS d
LEFT OUTER JOIN
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
LEFT OUTER JOIN
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
LEFT OUTER JOIN
    [${mjSchema}].[Artifact] AS MJArtifact_ProposalArtifactID
  ON
    [d].[ProposalArtifactID] = MJArtifact_ProposalArtifactID.[ID]
GO
IF OBJECT_ID('[${flyway:defaultSchema}].[vwDeals]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_UI]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_Integration]
GRANT SELECT ON [${flyway:defaultSchema}].[vwDeals] TO [cdp_UI], [cdp_Developer], [cdp_Integration]';
END;

/* Refresh layered base view for MJ_BizApps_Sales: Deals after its inner view changed */
EXEC sp_refreshview '${flyway:defaultSchema}.vwDealsGenerated';
IF OBJECT_ID('[${flyway:defaultSchema}].[vwDeals]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'EXEC sp_refreshview ''${flyway:defaultSchema}.vwDeals'';';
END

GO

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
    EXEC sp_executesql N'REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_UI]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwDeals] FROM [cdp_Integration]
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
    @CreationDate datetimeoffset = NULL,
    @ProposalArtifactID_Clear bit = 0,
    @ProposalArtifactID uniqueidentifier = NULL
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
                [CreationDate],
                [ProposalArtifactID]
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
                ISNULL(@CreationDate, getutcdate()),
                CASE WHEN @ProposalArtifactID_Clear = 1 THEN NULL ELSE ISNULL(@ProposalArtifactID, NULL) END
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
                [CreationDate],
                [ProposalArtifactID]
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
                ISNULL(@CreationDate, getutcdate()),
                CASE WHEN @ProposalArtifactID_Clear = 1 THEN NULL ELSE ISNULL(@ProposalArtifactID, NULL) END
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
    @CreationDate datetimeoffset = NULL,
    @ProposalArtifactID_Clear bit = 0,
    @ProposalArtifactID uniqueidentifier = NULL
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
        [CreationDate] = ISNULL(@CreationDate, [CreationDate]),
        [ProposalArtifactID] = CASE WHEN @ProposalArtifactID_Clear = 1 THEN NULL ELSE ISNULL(@ProposalArtifactID, [ProposalArtifactID]) END,
        [__mj_UpdatedAt] = GETUTCDATE()
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
    IF NOT UPDATE([__mj_UpdatedAt])
    BEGIN
        UPDATE
            [${flyway:defaultSchema}].[Deal]
        SET
            __mj_UpdatedAt = GETUTCDATE()
        FROM
            [${flyway:defaultSchema}].[Deal] AS _organicTable
        INNER JOIN
            INSERTED AS I ON
            _organicTable.[ID] = I.[ID];
    END
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

/* SQL text to insert 1 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3c7c0de4-301f-40bc-a87b-cd829227d39b' OR (EntityID = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND Name = 'ProposalArtifact')) BEGIN
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
            '3c7c0de4-301f-40bc-a87b-cd829227d39b',
            '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', -- Entity: MJ_BizApps_Sales: Deals
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'),
            'ProposalArtifact',
            'Proposal Artifact',
            NULL,
            'nvarchar',
            510,
            0,
            0,
            1,
            NULL,
            0,
            0,
            1,
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

/* Refresh custom base views for modified entities so schema changes are picked up */
EXEC sp_refreshview '${flyway:defaultSchema}.vwDealsGenerated';
IF OBJECT_ID('[${flyway:defaultSchema}].[vwDeals]', 'V') IS NOT NULL
BEGIN
    EXEC sp_executesql N'EXEC sp_refreshview ''${flyway:defaultSchema}.vwDeals'';';
END
