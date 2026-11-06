-- Orders invoiced without an executed agreement. Finance control, bc-aidp-next-golive#443.
--
-- An order is confirmed and swept to Bill.com on schedule, and nothing on that path knows whether the
-- contract behind it was ever signed: orders may not read contracts, and a contract can be saved
-- before any paper exists. Sales is the only app that sees deal, order and contract together, so the
-- check lives here. Sending is unchanged (g443.1 A); this lists the gaps for finance to clear.
--
-- WHICH ORDERS (g443.2 A): only the order a WON deal names through Deal.OrderID. Renewals, checkout
-- orders, conversions and reversals have no deal behind them and are not listed. Won is
-- DealStatusType.IsWon, never a status name.
--
-- "INVOICED" means the order is Confirmed (the external-invoicing worklist reads Confirmed orders) or
-- has a Bill.com invoice row in Sent. Order Status and ExternalInvoice Status are CHECK-constrained
-- columns, not seeded vocabulary, so they are compared by value.
--
-- WHICH CONTRACT: Deal.ContractID; when that is empty, a contract the deal's close created, found by
-- its provenance pair (CreatingEntity = the Deals entity, CreatingRecordID = the deal). The same
-- lookup the order header's From row uses (golive#445).
--
-- THE GAP: no such contract, or none that vwContracts reports as covered. IsAwaitingDocument is 1
-- when the contract's type requires executed paper and no file in the Executed Agreement category is
-- linked. A type with RequiresExecutedDocument = 0 (Payment Link) never reports awaiting, so an
-- order under one counts as COVERED.
--
-- The contract columns show the newest candidate, for reading; the gap test is over all of them.
-- Date dimension: none filters by date; OrderDate and LastInvoiceSentAt are reported.
-- Optional parameter: CompanyID (the order's company).
WITH won AS (
    SELECT
        d.ID,
        d.DealNumber,
        d.Name,
        d.AccountID,
        d.Account,
        d.OwnerEmployeeID,
        d.OwnerEmployee,
        d.ContractID,
        d.OrderID
    FROM [__mj_BizAppsSales].vwDeals d
    INNER JOIN [__mj_BizAppsSales].DealStatusType st
            ON st.ID = d.DealStatusTypeID
           AND st.IsWon = 1
    WHERE d.OrderID IS NOT NULL
),
candidates AS (
    SELECT
        w.ID                                AS DealID,
        c.ID                                AS ContractID,
        c.ContractNumber,
        c.State,
        c.IsAwaitingDocument,
        ROW_NUMBER() OVER (PARTITION BY w.ID ORDER BY c.__mj_CreatedAt DESC) AS Recency
    FROM won w
    INNER JOIN [__mj_BizAppsContracts].vwContracts c
            ON c.ID = w.ContractID
            OR (w.ContractID IS NULL
                AND c.CreatingEntity = N'MJ_BizApps_Sales: Deals'
                AND c.CreatingRecordID = CAST(w.ID AS NVARCHAR(450)))
),
invoices AS (
    SELECT
        ei.OrderHeaderID,
        COUNT(ei.ID)                                            AS InvoiceCount,
        COUNT(CASE WHEN ei.Status = N'Sent' THEN ei.ID END)     AS SentInvoiceCount,
        MAX(ei.SentAt)                                          AS LastInvoiceSentAt
    FROM [__mj_BizAppsOrders].vwExternalInvoices ei
    WHERE ei.Status <> N'Canceled'
    GROUP BY ei.OrderHeaderID
)
SELECT
    o.ID                                    AS OrderID,
    o.OrderNumber,
    o.Status                                AS OrderStatus,
    o.OrderDate,
    o.ConfirmedAt,
    o.CompanyID,
    o.Company                               AS CompanyName,
    o.TotalGross                            AS OrderTotalGross,
    o.Balance                               AS OrderBalance,
    w.ID                                    AS DealID,
    w.DealNumber,
    w.Name                                  AS DealName,
    w.AccountID,
    w.Account                               AS AccountName,
    w.OwnerEmployeeID,
    w.OwnerEmployee                         AS OwnerName,
    k.ContractID,
    k.ContractNumber,
    k.State                                 AS ContractState,
    CASE WHEN k.ContractID IS NULL THEN N'No contract'
         ELSE N'Awaiting executed agreement' END AS Gap,
    COALESCE(i.InvoiceCount, 0)             AS InvoiceCount,
    COALESCE(i.SentInvoiceCount, 0)         AS SentInvoiceCount,
    i.LastInvoiceSentAt,
    CASE WHEN i.SentInvoiceCount > 0 THEN N'Sent'
         WHEN i.InvoiceCount > 0 THEN N'Not sent yet'
         ELSE N'No invoice' END             AS InvoiceStatus
FROM won w
INNER JOIN [__mj_BizAppsOrders].vwOrderHeaders o
        ON o.ID = w.OrderID
LEFT JOIN candidates k
       ON k.DealID = w.ID
      AND k.Recency = 1
LEFT JOIN invoices i
       ON i.OrderHeaderID = o.ID
WHERE (o.Status = N'Confirmed' OR i.SentInvoiceCount > 0)
  AND NOT EXISTS (
        SELECT 1
        FROM candidates covered
        WHERE covered.DealID = w.ID
          AND covered.IsAwaitingDocument = 0
      )
  {% if CompanyID %}
  AND o.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
ORDER BY
    o.Company, o.OrderDate, o.OrderNumber;
