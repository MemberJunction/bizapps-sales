-- Confirmed orders with no deal, no contract, or no executed contract. golive #388.
--
-- Finance must not invoice before the agreement is signed. This lists every confirmed order that
-- fails any one check, one row per order, with a bit per check so finance sees which one failed.
-- A User Routine in aidp-next runs it weekly; the same query runs on demand from Explorer.
--
-- THE WALK IS order -> deal -> contract. OrderHeader holds neither a deal nor a contract (sales
-- depends on orders and contracts, not the reverse), so the deal is the vwDeals row whose OrderID
-- is the order, and the contract is that deal's ContractID. Deal.OrderID is not unique, so the
-- most recently created deal on the order is the one checked.
--
-- EXCLUDED (Andrew, 2026-10-28):
--   * Web orders: checkout terms stand in for an agreement. A checkout order is the one with a
--     SourceCheckoutWidgetID, the FK checkout stamps beside Origin = 'Widget'; the FK is read
--     instead of the free-text Origin.
--   * Returns, and subscription cancellations: both reverse an order this report already covers.
--     Excluded by ReversesOrderHeaderID, and by OrderType (CHECK-constrained, compared by value
--     like Status) for one whose link was never set.
--
-- PAYMENT LINK is not named. It is the contract type with RequiresExecutedDocument = 0 (the
-- customer accepts terms at payment). An order whose contract has that flag off is checked for a
-- deal only. An order with no contract cannot be known to be Payment Link, so it is flagged.
--
-- "EXECUTED" MEANS BOTH: the contract's ExecutedDate (HasSignedDate) and a file in the
-- 'Executed Agreement' file category (HasExecutedDocument). The second is vwContracts'
-- IsAwaitingDocument, which is 1 exactly when the type requires the document and no such file is
-- linked, so it covers every contract this report checks.
--
-- A check that does not apply reads 1: a Payment Link order has HasSignedDate and
-- HasExecutedDocument = 1. A check that cannot run because an earlier one failed reads 0.
WITH checked AS (
    SELECT
        o.ID                                        AS OrderID,
        o.OrderNumber,
        o.OrderType,
        o.OrderDate,
        o.ConfirmedAt,
        o.CompanyID,
        o.Company                                   AS CompanyName,
        COALESCE(o.BillToOrganization, o.BillToPerson) AS CustomerName,
        o.TotalGross,
        o.Balance,
        o.SalesRepUser                              AS SalesRepName,
        d.ID                                        AS DealID,
        d.DealNumber,
        d.Name                                      AS DealName,
        d.OwnerEmployee                             AS DealOwnerName,
        c.ID                                        AS ContractID,
        c.ContractNumber,
        c.ContractType,
        c.State                                     AS ContractState,
        c.ExecutedDate,
        CAST(CASE WHEN d.ID IS NULL THEN 0 ELSE 1 END AS bit) AS HasDeal,
        CAST(CASE WHEN c.ID IS NOT NULL OR ct.RequiresExecutedDocument = 0 THEN 1 ELSE 0 END AS bit) AS HasContract,
        CAST(CASE WHEN ct.RequiresExecutedDocument = 0 OR c.ExecutedDate IS NOT NULL THEN 1 ELSE 0 END AS bit) AS HasSignedDate,
        CAST(CASE WHEN ct.RequiresExecutedDocument = 0 OR c.IsAwaitingDocument = 0 THEN 1 ELSE 0 END AS bit) AS HasExecutedDocument
    FROM [__mj_BizAppsOrders].vwOrderHeaders o
    OUTER APPLY (
        SELECT TOP 1 x.ID, x.DealNumber, x.Name, x.OwnerEmployee, x.ContractID
        FROM [__mj_BizAppsSales].vwDeals x
        WHERE x.OrderID = o.ID
        ORDER BY x.__mj_CreatedAt DESC
    ) d
    LEFT JOIN [__mj_BizAppsContracts].vwContracts c
           ON c.ID = d.ContractID
    LEFT JOIN [__mj_BizAppsContracts].ContractType ct
           ON ct.ID = c.ContractTypeID
    WHERE o.Status = N'Confirmed'
      AND o.SourceCheckoutWidgetID IS NULL
      AND o.ReversesOrderHeaderID IS NULL
      AND o.OrderType NOT IN (N'Return', N'Cancellation')
      {% if CompanyIDs %}
      AND o.CompanyID IN {{ CompanyIDs | sqlIn }}
      {% endif %}
)
-- Columns listed, not *: MJ's field extraction reads * as every column of every joined view.
SELECT
    OrderID, OrderNumber, OrderType, OrderDate, ConfirmedAt, CompanyID, CompanyName, CustomerName,
    TotalGross, Balance, SalesRepName, DealID, DealNumber, DealName, DealOwnerName, ContractID,
    ContractNumber, ContractType, ContractState, ExecutedDate,
    HasDeal, HasContract, HasSignedDate, HasExecutedDocument
FROM checked
WHERE HasDeal = 0 OR HasContract = 0 OR HasSignedDate = 0 OR HasExecutedDocument = 0
ORDER BY CompanyName, ConfirmedAt, OrderNumber;
