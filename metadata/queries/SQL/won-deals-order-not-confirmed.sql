-- Won deals whose order was never confirmed. Finance exception review, golive #279 type 3.
--
-- A deal won and never booked is never billed, and nothing else in the system says so: closing a
-- deal Won creates the contract and the review tasks, but the order stays at whatever status the
-- stage left it. This lists every won deal whose order is still not Confirmed, for finance to clear
-- at month end until the nightly exception check replaces it.
--
-- THE LINK IS Deal.OrderID. DealEntityServer.Save() provisions a Draft order on a deal's first save,
-- so an empty OrderID is the unusual case, not the normal one. It is still reported (OrderStatus is
-- NULL) because it is the same exception: nothing will bill this deal.
--
-- A VOIDED ORDER IS REPORTED TOO. A won deal whose order was voided and not replaced has the same
-- outcome as one never confirmed, and finance decides whether that was intended.
--
-- WON IS DealStatusType.IsWon, never a status name. Order Status is a CHECK-constrained column
-- (Draft, Quoted, Confirmed, Voided), not seeded vocabulary, so it is compared by value.
--
-- DATE DIMENSION: ActualCloseDate, falling back to the date part of ClosedAt for a deal closed
-- without one. DaysSinceClose counts to the business day from fnBusinessToday(), the same "today"
-- the orders views use, so a deal closed late in the evening does not age a day early.
--
-- MinDaysSinceClose is the grace period before a won deal counts as an exception. It is optional
-- until finance sets the threshold; omitted, every won deal with an unconfirmed order is listed.
WITH won AS (
    SELECT
        d.ID,
        d.DealNumber,
        d.Name,
        d.CompanyID,
        d.Company,
        d.AccountID,
        d.Account,
        d.OwnerEmployeeID,
        d.OwnerEmployee,
        d.Amount,
        d.OrderID,
        d.ClosedByUserID,
        d.ClosedByUser,
        COALESCE(d.ActualCloseDate, CAST(d.ClosedAt AS DATE)) AS CloseDate
    FROM [__mj_BizAppsSales].vwDeals d
    INNER JOIN [__mj_BizAppsSales].DealStatusType st
            ON st.ID = d.DealStatusTypeID
           AND st.IsWon = 1
)
SELECT
    w.ID                                    AS DealID,
    w.DealNumber,
    w.Name                                  AS DealName,
    w.CompanyID,
    w.Company                               AS CompanyName,
    w.AccountID,
    w.Account                               AS AccountName,
    w.OwnerEmployeeID,
    w.OwnerEmployee                         AS OwnerName,
    w.ClosedByUserID,
    w.ClosedByUser                          AS ClosedByUserName,
    w.CloseDate,
    DATEDIFF(DAY, w.CloseDate, bt.Today)    AS DaysSinceClose,
    w.Amount                                AS DealAmount,
    w.OrderID,
    o.OrderNumber,
    o.Status                                AS OrderStatus,
    o.TotalGross                            AS OrderTotalGross
FROM won w
CROSS JOIN [__mj_BizAppsCommon].[fnBusinessToday]() AS bt
LEFT JOIN [__mj_BizAppsOrders].vwOrderHeaders o
       ON o.ID = w.OrderID
WHERE (o.ID IS NULL OR o.Status <> N'Confirmed')
  {% if CompanyID %}
  AND w.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if MinDaysSinceClose %}
  AND DATEDIFF(DAY, w.CloseDate, bt.Today) >= {{ MinDaysSinceClose | sqlNumber }}
  {% endif %}
  {% if PeriodStart %}
  AND w.CloseDate >= {{ PeriodStart | sqlString }}
  {% endif %}
  {% if PeriodEnd %}
  AND w.CloseDate <= {{ PeriodEnd | sqlString }}
  {% endif %}
ORDER BY
    w.Company, w.CloseDate, w.DealNumber;
