-- =============================================================================
-- BizAppsSales: Add Predictive Deal Win Propensity Fields & Layered Base Views
-- Materialized prediction write-back columns and engineered operational features
-- computed via layered vwDeals wrapper for Predictive Studio win classification.
-- =============================================================================

---------------------------------------------------------------------------
-- 1. Deal: Add materialized prediction fields
---------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('[${flyway:defaultSchema}].[Deal]') 
      AND name = 'PredictedWinProbability'
)
BEGIN
    ALTER TABLE [${flyway:defaultSchema}].[Deal] ADD
        [PredictedWinProbability] DECIMAL(5, 4) NULL,
        [PredictedWinRiskBand] NVARCHAR(20) NULL,
        [PredictedWinScoredAt] DATETIMEOFFSET NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints 
    WHERE object_id = OBJECT_ID('[${flyway:defaultSchema}].[CK_Deal_PredictedWinRiskBand]')
)
BEGIN
    ALTER TABLE [${flyway:defaultSchema}].[Deal] ADD CONSTRAINT [CK_Deal_PredictedWinRiskBand]
        CHECK ([PredictedWinRiskBand] IN ('Low', 'Medium', 'High', 'Critical'));
END
GO

IF EXISTS (
    SELECT 1 FROM fn_listextendedproperty(N'MS_Description', 'SCHEMA', N'${flyway:defaultSchema}', 'TABLE', N'Deal', 'COLUMN', N'PredictedWinProbability')
)
    EXEC sp_updateextendedproperty @name = N'MS_Description', @value = N'0.0000 to 1.0000 probability that the deal will close as Won.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Deal', @level2type = N'COLUMN', @level2name = N'PredictedWinProbability';
ELSE
    EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'0.0000 to 1.0000 probability that the deal will close as Won.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Deal', @level2type = N'COLUMN', @level2name = N'PredictedWinProbability';
GO

IF EXISTS (
    SELECT 1 FROM fn_listextendedproperty(N'MS_Description', 'SCHEMA', N'${flyway:defaultSchema}', 'TABLE', N'Deal', 'COLUMN', N'PredictedWinRiskBand')
)
    EXEC sp_updateextendedproperty @name = N'MS_Description', @value = N'Categorical priority/risk tier derived from deal win probability: Low, Medium, High, Critical.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Deal', @level2type = N'COLUMN', @level2name = N'PredictedWinRiskBand';
ELSE
    EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Categorical priority/risk tier derived from deal win probability: Low, Medium, High, Critical.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Deal', @level2type = N'COLUMN', @level2name = N'PredictedWinRiskBand';
GO

IF EXISTS (
    SELECT 1 FROM fn_listextendedproperty(N'MS_Description', 'SCHEMA', N'${flyway:defaultSchema}', 'TABLE', N'Deal', 'COLUMN', N'PredictedWinScoredAt')
)
    EXEC sp_updateextendedproperty @name = N'MS_Description', @value = N'Timestamp when the deal was last scored by the predictive deal win propensity model.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Deal', @level2type = N'COLUMN', @level2name = N'PredictedWinScoredAt';
ELSE
    EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Timestamp when the deal was last scored by the predictive deal win propensity model.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Deal', @level2type = N'COLUMN', @level2name = N'PredictedWinScoredAt';
GO

---------------------------------------------------------------------------
-- 2. Establish Layered Base Views for Deals
---------------------------------------------------------------------------
UPDATE [${mjSchema}].[Entity]
   SET [BaseViewGenerated] = 0,
       [GeneratedBaseViewName] = 'vwDealsGenerated'
 WHERE [Name] = 'MJ_BizApps_Sales: Deals'
   AND ([BaseViewGenerated] <> 0
        OR [GeneratedBaseViewName] IS NULL
        OR [GeneratedBaseViewName] <> 'vwDealsGenerated');
GO

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
    [d].[OrderID] = mjBizAppsOrdersOrderHeader_OrderID.[ID];
GO

IF OBJECT_ID('[${flyway:defaultSchema}].[vwDeals]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwDeals];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwDeals]
AS
SELECT
    g.*,
    CASE 
        WHEN mjBizAppsSalesDealStatusType_DealStatusTypeID.[Code] = 'WON' THEN 1 
        WHEN mjBizAppsSalesDealStatusType_DealStatusTypeID.[Code] IN ('LOST', 'ABANDONED') THEN 0 
        ELSE NULL 
    END AS [WinOutcome],
    CASE 
        WHEN g.ExpectedCloseDate IS NOT NULL AND g.StartDate IS NOT NULL THEN DATEDIFF(day, g.StartDate, g.ExpectedCloseDate) 
        WHEN g.ExpectedCloseDate IS NOT NULL THEN DATEDIFF(day, CAST(g.__mj_CreatedAt AS date), g.ExpectedCloseDate) 
        ELSE NULL 
    END AS [DaysToExpectedClose],
    ISNULL(ps.HasPaymentSchedule, 0) AS [HasPaymentSchedule],
    ISNULL(team.TeamMemberCount, 0) AS [TeamMemberCount],
    ISNULL(team.HasPartnerInvolved, 0) AS [HasPartnerInvolved],
    CASE WHEN g.Amount >= 100000 THEN 1 ELSE 0 END AS [IsEnterpriseTier],
    CASE WHEN g.AutoRenew = 1 THEN 1 ELSE 0 END AS [AutoRenewFlag],
    CASE WHEN g.StandardAgreementModified = 1 THEN 1 ELSE 0 END AS [StandardAgreementModifiedFlag]
FROM
    [${flyway:defaultSchema}].[vwDealsGenerated] AS g
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[DealStatusType] AS mjBizAppsSalesDealStatusType_DealStatusTypeID
  ON
    g.[DealStatusTypeID] = mjBizAppsSalesDealStatusType_DealStatusTypeID.[ID]
LEFT OUTER JOIN (
    SELECT DealID, 1 AS HasPaymentSchedule
    FROM [${flyway:defaultSchema}].[DealPaymentSchedule]
    GROUP BY DealID
) AS ps ON ps.DealID = g.ID
LEFT OUTER JOIN (
    SELECT 
        tm.DealID,
        COUNT(*) AS TeamMemberCount,
        MAX(CASE WHEN r.Code = 'PARTNERMGR' THEN 1 ELSE 0 END) AS HasPartnerInvolved
    FROM [${flyway:defaultSchema}].[DealTeamMember] tm
    JOIN [${flyway:defaultSchema}].[DealRole] r ON tm.DealRoleID = r.ID
    GROUP BY tm.DealID
) AS team ON team.DealID = g.ID;
GO

IF DATABASE_PRINCIPAL_ID('cdp_UI') IS NOT NULL
    EXEC('GRANT SELECT ON [${flyway:defaultSchema}].[vwDeals] TO [cdp_UI]');
IF DATABASE_PRINCIPAL_ID('cdp_Developer') IS NOT NULL
    EXEC('GRANT SELECT ON [${flyway:defaultSchema}].[vwDeals] TO [cdp_Developer]');
IF DATABASE_PRINCIPAL_ID('cdp_Integration') IS NOT NULL
    EXEC('GRANT SELECT ON [${flyway:defaultSchema}].[vwDeals] TO [cdp_Integration]');
GO


















































-- =============================================================================
-- GENERATED BY MemberJunction CodeGen — DO NOT EDIT BY HAND
-- =============================================================================

/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert new entity fields dynamically */
DECLARE @dealEntityID UNIQUEIDENTIFIER = (SELECT [ID] FROM [${mjSchema}].[Entity] WHERE [Name] = 'MJ_BizApps_Sales: Deals');
IF @dealEntityID IS NULL RAISERROR('Entity not registered: MJ_BizApps_Sales: Deals', 16, 1);

IF @dealEntityID IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = @dealEntityID AND [Name] = 'PredictedWinProbability')
    BEGIN
        INSERT INTO [${mjSchema}].[EntityField] (
            [ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale],
            [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed],
            [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView],
            [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt]
        ) VALUES (
            'f3e8b282-249c-4817-be3d-00efad3569d3', @dealEntityID,
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = @dealEntityID),
            'PredictedWinProbability', 'Predicted Win Probability',
            '0.0000 to 1.0000 probability that the deal will close as Won.',
            'decimal', 5, 5, 4, 1, NULL, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE()
        );
    END

    IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = @dealEntityID AND [Name] = 'PredictedWinRiskBand')
    BEGIN
        INSERT INTO [${mjSchema}].[EntityField] (
            [ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale],
            [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed],
            [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView],
            [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt]
        ) VALUES (
            '7c778bdc-ec7e-4275-b8be-49792d542d0b', @dealEntityID,
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = @dealEntityID),
            'PredictedWinRiskBand', 'Predicted Win Risk Band',
            'Categorical priority/risk tier derived from deal win probability: Low, Medium, High, Critical.',
            'nvarchar', 20, 0, 0, 1, NULL, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE()
        );
    END

    IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = @dealEntityID AND [Name] = 'PredictedWinScoredAt')
    BEGIN
        INSERT INTO [${mjSchema}].[EntityField] (
            [ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale],
            [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed],
            [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView],
            [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt]
        ) VALUES (
            'b1e35f02-c32a-4f17-b0e5-5577a1fd3950', @dealEntityID,
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = @dealEntityID),
            'PredictedWinScoredAt', 'Predicted Win Scored At',
            'Timestamp when the deal was last scored by the predictive deal win propensity model.',
            'datetimeoffset', 10, 34, 7, 1, NULL, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE()
        );
    END

    -- Virtual engineered features
    DECLARE @fields TABLE (
        Name NVARCHAR(100),
        DisplayName NVARCHAR(100),
        Type NVARCHAR(50),
        Length INT,
        Precision INT,
        Scale INT,
        Description NVARCHAR(500)
    );

    INSERT INTO @fields (Name, DisplayName, Type, Length, Precision, Scale, Description) VALUES
    ('WinOutcome', 'Win Outcome', 'int', 4, 10, 0, 'Binary outcome: 1 if Closed Won, 0 if Closed Lost/Abandoned, NULL if active/open.'),
    ('DaysToExpectedClose', 'Days To Expected Close', 'int', 4, 10, 0, 'Projected deal cycle duration in days from start or creation to expected close.'),
    ('HasPaymentSchedule', 'Has Payment Schedule', 'bit', 1, 1, 0, '1 if the deal negotiated a customized milestone payment schedule, otherwise 0.'),
    ('TeamMemberCount', 'Team Member Count', 'int', 4, 10, 0, 'Number of assigned team members collaborated on this deal.'),
    ('HasPartnerInvolved', 'Has Partner Involved', 'bit', 1, 1, 0, '1 if a partner manager role is attached to the deal team, otherwise 0.'),
    ('IsEnterpriseTier', 'Is Enterprise Tier', 'bit', 1, 1, 0, '1 if deal amount is >= $100k enterprise tier threshold, otherwise 0.'),
    ('AutoRenewFlag', 'Auto Renew Flag', 'bit', 1, 1, 0, 'Binary indicator whether the deal contract specifies auto-renewal.'),
    ('StandardAgreementModifiedFlag', 'Standard Agreement Modified Flag', 'bit', 1, 1, 0, 'Binary indicator whether standard contractual terms were modified.');

    MERGE INTO [${mjSchema}].[EntityField] AS target
    USING (
        SELECT 
            NEWID() AS ID,
            @dealEntityID AS EntityID,
            (SELECT ISNULL(MAX(Sequence), 0) FROM [${mjSchema}].[EntityField] WHERE EntityID = @dealEntityID) + 
                ROW_NUMBER() OVER (ORDER BY f.Name) AS Sequence,
            f.Name,
            f.DisplayName,
            f.Description,
            f.Type,
            f.Length,
            f.Precision,
            f.Scale,
            1 AS AllowsNull,
            0 AS DefaultInView,
            1 AS IsVirtual,
            0 AS AllowUpdateAPI,
            'Active' AS Status
        FROM @fields f
    ) AS source
    ON target.EntityID = source.EntityID AND target.Name = source.Name
    WHEN NOT MATCHED THEN
        INSERT (ID, EntityID, Sequence, Name, DisplayName, Description, Type, Length, Precision, Scale, AllowsNull, DefaultInView, IsVirtual, AllowUpdateAPI, Status)
        VALUES (source.ID, source.EntityID, source.Sequence, source.Name, source.DisplayName, source.Description, source.Type, source.Length, source.Precision, source.Scale, source.AllowsNull, source.DefaultInView, source.IsVirtual, source.AllowUpdateAPI, source.Status);
END
GO

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
-- Item: vwDeals
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
    @PredictedWinScoredAt datetimeoffset = NULL
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
                [PredictedWinScoredAt]
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
                CASE WHEN @PredictedWinScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinScoredAt, NULL) END
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
                [PredictedWinScoredAt]
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
                CASE WHEN @PredictedWinScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinScoredAt, NULL) END
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
    @PredictedWinScoredAt datetimeoffset = NULL
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
        [PredictedWinScoredAt] = CASE WHEN @PredictedWinScoredAt_Clear = 1 THEN NULL ELSE ISNULL(@PredictedWinScoredAt, [PredictedWinScoredAt]) END
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
