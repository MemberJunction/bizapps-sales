-- Won deal payments — one row per invoice of a won deal's order (bc-aidp-next-golive#487).
--
-- The drill-through behind the payment columns on the Deals view (InvoiceCount, InvoicedAmount,
-- PaidAmount, OutstandingBalance, PaymentStatus, NextPaymentDueDate). Those columns sum these rows, so
-- the two cannot disagree: both read [__mj_BizAppsSales].vwWonDealInvoices, and the status on every
-- row comes from fnDealPaymentStatus, the one place the rule is written.
--
-- ONE ROW PER INVOICE. An order with a payment schedule gives one row per instalment; an order without
-- one is billed as a single invoice and gives one row from its header. Canceled and written-off
-- instalments and voided orders are not listed: nothing is owed on them.
--
-- PaymentStatus is Not invoiced, Partly paid (AmountPaid > 0 and Balance > 0), Outstanding or Paid. There
-- is no overdue status: due dates on deals brought over from the old system are not reliable yet
-- (bc-aidp-next-golive#481).
--
-- WON IS DealStatusType.IsWon (applied in the view), never a status name. Sales computes no money here:
-- Amount, AmountPaid and Balance are orders' stored figures, read as they are.
--
-- THE FILTER BAR. CompanyIDs, OwnerEmployeeIDs, PipelineIDs and ProductCompanyIDs are lists rendered with
-- `sqlIn` and narrow the rows the way they narrow `Sales: Deal Roster`; the single-value CompanyID,
-- PipelineID and OwnerEmployeeID work too. "My deals" is OwnerEmployeeIDs set to the signed-in user.
SELECT
    d.ID                            AS DealID,
    d.DealNumber,
    d.Name                          AS DealName,
    d.CompanyID,
    d.Company                       AS CompanyName,
    d.AccountID,
    d.Account                       AS AccountName,
    d.PipelineID,
    d.Pipeline                      AS PipelineName,
    d.OwnerEmployeeID,
    d.OwnerEmployee                 AS OwnerName,
    d.ActualCloseDate,
    i.OrderID,
    i.OrderNumber,
    i.PaymentScheduleID,
    i.InstallmentNumber,
    i.DocumentNumber,
    i.SourceStatus,
    i.IsInvoiced,
    i.DueDate,
    i.Amount                        AS InvoiceAmount,
    i.AmountPaid,
    i.Balance,
    i.PaymentStatus
FROM [__mj_BizAppsSales].vwWonDealInvoices i
INNER JOIN [__mj_BizAppsSales].vwDeals d
        ON d.ID = i.DealID
WHERE 1 = 1
  {% if CompanyID %}
  AND d.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if CompanyIDs %}
  AND d.CompanyID IN {{ CompanyIDs | sqlIn }}
  {% endif %}
  {% if PipelineID %}
  AND d.PipelineID = {{ PipelineID | sqlString }}
  {% endif %}
  {% if PipelineIDs %}
  AND d.PipelineID IN {{ PipelineIDs | sqlIn }}
  {% endif %}
  {% if OwnerEmployeeID %}
  AND d.OwnerEmployeeID = {{ OwnerEmployeeID | sqlString }}
  {% endif %}
  {% if OwnerEmployeeIDs %}
  AND d.OwnerEmployeeID IN {{ OwnerEmployeeIDs | sqlIn }}
  {% endif %}
  {% if ProductCompanyIDs %}
  AND EXISTS (SELECT 1 FROM [__mj_BizAppsOrders].OrderLine ol
              WHERE ol.OrderHeaderID = d.OrderID
                AND ol.CompanyID IN {{ ProductCompanyIDs | sqlIn }})
  {% endif %}
ORDER BY
    d.Account, d.DealNumber, i.DueDate, i.InstallmentNumber;
