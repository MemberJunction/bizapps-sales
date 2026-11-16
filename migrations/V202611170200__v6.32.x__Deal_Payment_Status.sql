-- =============================================================================
-- Deals: what has been invoiced and paid on a won deal (bc-aidp-next-golive#487).
-- =============================================================================
-- Once a deal is won and invoiced, the only way to tell whether the customer paid
-- was to open the deal, then its order, then the order's payments. Orders already
-- keeps the answer: AmountPaid and Balance on every instalment of a payment
-- schedule, and on the order header for an order billed as one invoice. Nothing in
-- Sales read it. This file reads it, in three objects:
--
--   1. fnDealPaymentStatus -- THE STATUS RULE, the only place it is written. Both
--      the per-invoice rows and the per-deal roll-up call it, so the two cannot
--      disagree:
--        Not invoiced  nothing invoiced yet
--        Partly paid   AmountPaid > 0 and Balance > 0
--        Outstanding   Balance > 0 and nothing paid
--        Paid          Balance <= 0 (negative means a credit owed to the customer)
--      There is no overdue status: due dates on deals brought over from the old
--      system are not reliable yet (bc-aidp-next-golive#481).
--
--   2. vwWonDealInvoices -- one row per invoice of a won deal's order. An order
--      with a payment schedule gives one row per instalment; an order without one
--      is billed as a single invoice, so the header gives one row. An instalment
--      counts as invoiced when its Status is Invoiced or Paid; a header when the
--      order is Confirmed. Canceled and WrittenOff instalments, and a Voided order,
--      are left out: nothing is owed on them. Won is DealStatusType.IsWon, never a
--      status name.
--
--   3. vwDeals gains six columns, summed from (2) over the invoiced rows:
--      InvoiceCount, InvoicedAmount, PaidAmount, OutstandingBalance, PaymentStatus
--      and NextPaymentDueDate. They are NULL on a deal that is not won or has no
--      order. "Paid" means every invoice issued so far is paid; instalments not yet
--      invoiced do not count against it, and NextPaymentDueDate still shows when
--      the next one falls due.
--
-- SALES STILL COMPUTES NO MONEY. Every amount here is a figure orders stored; the
-- roll-up only adds up a deal's own invoices, as the read models in
-- metadata/queries do. Nothing prices, discounts, prorates or rounds.
--
-- NextPaymentDueDate follows orders' NextDueDate on vwOrderHeaders: the earliest due
-- date among the live rows with a balance, invoiced or not.
--
-- vwDeals is restated whole: the columns before the new ones are unchanged.
-- =============================================================================

CREATE FUNCTION [${flyway:defaultSchema}].[fnDealPaymentStatus]
(
    @InvoiceCount INT,
    @AmountPaid   DECIMAL(38, 2),
    @Balance      DECIMAL(38, 2)
)
RETURNS TABLE
AS
RETURN
    SELECT CAST(
        CASE
            WHEN @InvoiceCount = 0                  THEN N'Not invoiced'
            WHEN @Balance > 0 AND @AmountPaid > 0   THEN N'Partly paid'
            WHEN @Balance > 0                       THEN N'Outstanding'
            WHEN @Balance <= 0                      THEN N'Paid'
        END AS NVARCHAR(20)) AS PaymentStatus;
GO

CREATE VIEW [${flyway:defaultSchema}].[vwWonDealInvoices]
AS
SELECT
    d.ID                    AS DealID,
    o.ID                    AS OrderID,
    o.OrderNumber,
    s.ID                    AS PaymentScheduleID,
    ISNULL(s.InstallmentNumber, 1) AS InstallmentNumber,
    -- The number the customer holds: the instalment's frozen document number, or the
    -- order number for an order billed as one invoice. NULL until invoiced.
    CASE WHEN s.ID IS NULL
         THEN CASE WHEN r.IsInvoiced = 1 THEN o.OrderNumber END
         ELSE s.DocumentNumber
    END                     AS DocumentNumber,
    CASE WHEN s.ID IS NULL THEN o.Status ELSE s.Status END AS SourceStatus,
    r.IsInvoiced,
    r.DueDate,
    r.Amount,
    r.AmountPaid,
    r.Balance,
    ps.PaymentStatus
FROM [${flyway:defaultSchema}].[Deal] AS d
INNER JOIN [${flyway:defaultSchema}].[DealStatusType] AS st
        ON st.ID = d.DealStatusTypeID
       AND st.IsWon = 1
INNER JOIN [${mjSchema}_BizAppsOrders].[OrderHeader] AS o
        ON o.ID = d.OrderID
LEFT OUTER JOIN [${mjSchema}_BizAppsOrders].[OrderHeaderPaymentSchedule] AS s
        ON s.OrderHeaderID = o.ID
CROSS APPLY (
    SELECT
        CASE WHEN s.ID IS NULL THEN o.DueDate    ELSE s.DueDate    END AS DueDate,
        CASE WHEN s.ID IS NULL THEN o.TotalGross ELSE s.Amount     END AS Amount,
        CASE WHEN s.ID IS NULL THEN o.AmountPaid ELSE s.AmountPaid END AS AmountPaid,
        CASE WHEN s.ID IS NULL THEN o.Balance    ELSE s.Balance    END AS Balance,
        CASE WHEN s.ID IS NULL
             THEN CASE WHEN o.Status = N'Confirmed' THEN 1 ELSE 0 END
             WHEN s.Status IN (N'Invoiced', N'Paid') THEN 1
             ELSE 0
        END AS IsInvoiced
) AS r
CROSS APPLY [${flyway:defaultSchema}].[fnDealPaymentStatus](r.IsInvoiced, r.AmountPaid, r.Balance) AS ps
WHERE (s.ID IS NULL AND o.Status <> N'Voided')
   OR s.Status NOT IN (N'Canceled', N'WrittenOff');
GO

IF DATABASE_PRINCIPAL_ID('cdp_UI') IS NOT NULL
    EXEC('GRANT SELECT ON [${flyway:defaultSchema}].[vwWonDealInvoices] TO [cdp_UI]');
IF DATABASE_PRINCIPAL_ID('cdp_Developer') IS NOT NULL
    EXEC('GRANT SELECT ON [${flyway:defaultSchema}].[vwWonDealInvoices] TO [cdp_Developer]');
IF DATABASE_PRINCIPAL_ID('cdp_Integration') IS NOT NULL
    EXEC('GRANT SELECT ON [${flyway:defaultSchema}].[vwWonDealInvoices] TO [cdp_Integration]');
GO

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
    CASE WHEN g.StandardAgreementModified = 1 THEN 1 ELSE 0 END AS [StandardAgreementModifiedFlag],
    pay.InvoiceCount AS [InvoiceCount],
    pay.InvoicedAmount AS [InvoicedAmount],
    pay.PaidAmount AS [PaidAmount],
    pay.OutstandingBalance AS [OutstandingBalance],
    pst.PaymentStatus AS [PaymentStatus],
    pay.NextPaymentDueDate AS [NextPaymentDueDate]
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
) AS team ON team.DealID = g.ID
LEFT OUTER JOIN (
    SELECT
        i.DealID,
        SUM(i.IsInvoiced) AS InvoiceCount,
        SUM(CASE WHEN i.IsInvoiced = 1 THEN i.Amount END) AS InvoicedAmount,
        SUM(CASE WHEN i.IsInvoiced = 1 THEN i.AmountPaid END) AS PaidAmount,
        SUM(CASE WHEN i.IsInvoiced = 1 THEN i.Balance END) AS OutstandingBalance,
        MIN(CASE WHEN i.Balance > 0 THEN i.DueDate END) AS NextPaymentDueDate
    FROM [${flyway:defaultSchema}].[vwWonDealInvoices] i
    GROUP BY i.DealID
) AS pay ON pay.DealID = g.ID
OUTER APPLY [${flyway:defaultSchema}].[fnDealPaymentStatus](pay.InvoiceCount, pay.PaidAmount, pay.OutstandingBalance) AS pst;
GO

IF DATABASE_PRINCIPAL_ID('cdp_UI') IS NOT NULL
    EXEC('GRANT SELECT ON [${flyway:defaultSchema}].[vwDeals] TO [cdp_UI]');
IF DATABASE_PRINCIPAL_ID('cdp_Developer') IS NOT NULL
    EXEC('GRANT SELECT ON [${flyway:defaultSchema}].[vwDeals] TO [cdp_Developer]');
IF DATABASE_PRINCIPAL_ID('cdp_Integration') IS NOT NULL
    EXEC('GRANT SELECT ON [${flyway:defaultSchema}].[vwDeals] TO [cdp_Integration]');
GO


















































-- =============================================================================
-- CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
-- =============================================================================
-- `mj codegen` (MJ CLI 6.2.1) against a throwaway database built from migrations only: MJ core
-- v6.2.1, then bizapps-common, -tasks, -accounting, -orders and -contracts from their checkouts,
-- then this app's migrations at `next` plus the DDL above. Reported success with per-entity
-- field/view parity clean, and a second pass wrote no SQL, so the run converges.
--
-- KEPT: the six new Deal EntityField rows, the only change the DDL above causes. vwDealsGenerated
-- and Deal's procedures are unchanged (Deal's table is not touched), so their regeneration is left
-- out, as are the field categories for all 80 of Deal's fields, the entity icon and the
-- FieldCategoryInfo settings the same run emitted: that output predates the committed state and is
-- not caused by these columns (the reasoning in V202611041530__v6.24.x__Deal_CreationDate.sql).
-- =============================================================================

/* SQL text to insert 6 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '5a8fdf75-8c2b-4a35-b08a-71432ea97222' OR (EntityID = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND Name = 'InvoiceCount')) BEGIN
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
            '5a8fdf75-8c2b-4a35-b08a-71432ea97222',
            '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', -- Entity: MJ_BizApps_Sales: Deals
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'),
            'InvoiceCount',
            'Invoice Count',
            NULL,
            'int',
            4,
            10,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'f96d0d34-76a3-417f-8921-7261f6dac26b' OR (EntityID = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND Name = 'InvoicedAmount')) BEGIN
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
            'f96d0d34-76a3-417f-8921-7261f6dac26b',
            '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', -- Entity: MJ_BizApps_Sales: Deals
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'),
            'InvoicedAmount',
            'Invoiced Amount',
            NULL,
            'decimal',
            17,
            38,
            2,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e9b17b84-ae23-4ce8-864c-282777a49e10' OR (EntityID = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND Name = 'PaidAmount')) BEGIN
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
            'e9b17b84-ae23-4ce8-864c-282777a49e10',
            '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', -- Entity: MJ_BizApps_Sales: Deals
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'),
            'PaidAmount',
            'Paid Amount',
            NULL,
            'decimal',
            17,
            38,
            2,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3b957b06-fc4e-43c2-a275-94ae5ae8c9eb' OR (EntityID = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND Name = 'OutstandingBalance')) BEGIN
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
            '3b957b06-fc4e-43c2-a275-94ae5ae8c9eb',
            '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', -- Entity: MJ_BizApps_Sales: Deals
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'),
            'OutstandingBalance',
            'Outstanding Balance',
            NULL,
            'decimal',
            17,
            38,
            2,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b66f526d-187d-4baa-a3d3-5293aaeb5b45' OR (EntityID = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND Name = 'PaymentStatus')) BEGIN
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
            'b66f526d-187d-4baa-a3d3-5293aaeb5b45',
            '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', -- Entity: MJ_BizApps_Sales: Deals
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'),
            'PaymentStatus',
            'Payment Status',
            NULL,
            'nvarchar',
            40,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '4a272108-4e2b-43b1-abad-a3532a2bf183' OR (EntityID = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354' AND Name = 'NextPaymentDueDate')) BEGIN
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
            '4a272108-4e2b-43b1-abad-a3532a2bf183',
            '79148DE5-7F99-44AC-ACD4-5EE7BA93D354', -- Entity: MJ_BizApps_Sales: Deals
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354'),
            'NextPaymentDueDate',
            'Next Payment Due Date',
            NULL,
            'date',
            3,
            10,
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

