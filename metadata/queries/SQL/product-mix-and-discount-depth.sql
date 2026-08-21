-- Product mix, attach rate and discount depth. Master plan §9.3 (measure 11) at the LINE grain
-- (§9.1), with the Product dimension of §9.2.
--
-- ══ REBASED FROM DealLine ONTO OrderLine ═══════════════════════════════════════════════════════
--
-- §9.1 names the Line grain as `DealLine` and §9.2 sources Product from `DealLine → orders catalog`.
-- `DealLine` no longer exists. The embedded-order rework retired it: a deal now carries `OrderID`,
-- and what the rep adds in the workspace writes `OrderLine` rows on that order.
--
-- This is the SAME CONSOLIDATION that retired the table, not a new modelling decision. The grain is
-- still one row per product line, the dimension is still the orders catalog, and the measures are
-- unchanged. Only the source table moved, and it moved closer to the catalog rather than further —
-- `OrderLine.ProductID` is NOT NULL with a real FK, where `DealLine` carried a nullable one.
--
-- ══ SALES DOES NOT COMPUTE MONEY, AND THIS IS THE QUERY WHERE THAT MATTERS MOST ════════════════
--
-- Every money column below is READ AS STORED from `OrderLine`, which the orders engine wrote:
-- UnitPrice, DiscountPct, DiscountAmount, LineTotalNet. Nothing here multiplies quantity by price or
-- derives a discount — that is orders' job and it already did it. `AvgDiscountPct` is an average of
-- stored percentages, which is a statistic about them rather than a re-computation of them.
--
-- ATTACH RATE is the share of DEALS carrying at least one line of a product, which is why the
-- denominator is a distinct deal count rather than a line count. A product on three lines of one deal
-- has not attached three times.
--
-- DATE DIMENSION: the DEAL's ActualCloseDate when closed, ExpectedCloseDate otherwise — because this
-- report is about what was sold, and a line belongs to the period its deal lands in.
WITH deal_lines AS (
    SELECT
        d.ID                    AS DealID,
        d.CompanyID,
        d.Company,
        d.PipelineID,
        d.Pipeline,
        st.IsWon,
        st.IsOpen,
        ol.ProductID,
        ol.Quantity,
        ol.UnitPrice,
        ol.DiscountPct,
        ol.DiscountAmount,
        ol.LineTotalNet
    FROM [__mj_BizAppsSales].vwDeals d
    INNER JOIN [__mj_BizAppsSales].DealStatusType st
            ON st.ID = d.DealStatusTypeID
    INNER JOIN [__mj_BizAppsOrders].OrderLine ol
            ON ol.OrderHeaderID = d.OrderID
    WHERE d.OrderID IS NOT NULL
      {% if CompanyID %}
      AND d.CompanyID = {{ CompanyID | sqlString }}
      {% endif %}
      {% if PipelineID %}
      AND d.PipelineID = {{ PipelineID | sqlString }}
      {% endif %}
      {% if WonOnly == "true" %}
      AND st.IsWon = 1
      {% endif %}
      {% if PeriodStart %}
      AND COALESCE(d.ActualCloseDate, d.ExpectedCloseDate) >= {{ PeriodStart | sqlString }}
      {% endif %}
      {% if PeriodEnd %}
      AND COALESCE(d.ActualCloseDate, d.ExpectedCloseDate) <= {{ PeriodEnd | sqlString }}
      {% endif %}
),
totals AS (
    SELECT COUNT(DISTINCT DealID) AS DealsWithLines FROM deal_lines
)
SELECT
    dl.ProductID,
    p.Name                                      AS ProductName,
    p.ProductType                               AS ProductTypeName,
    dl.CompanyID,
    dl.Company                                  AS CompanyName,
    COUNT(*)                                    AS LineCount,
    COUNT(DISTINCT dl.DealID)                   AS DealCount,
    -- Attach rate: of the deals that carry any line at all, how many carry THIS product.
    CAST(COUNT(DISTINCT dl.DealID) AS DECIMAL(18, 4))
        / NULLIF((SELECT DealsWithLines FROM totals), 0) AS AttachRate,
    SUM(ISNULL(dl.Quantity, 0))                 AS TotalQuantity,
    SUM(ISNULL(dl.LineTotalNet, 0))             AS TotalNet,
    -- Discount depth, read as orders stored it. Both forms are reported: a percentage answers "how
    -- deep", an amount answers "how much did it cost us", and a mix of percent- and amount-based
    -- discounts makes either alone misleading.
    AVG(CAST(ISNULL(dl.DiscountPct, 0) AS FLOAT)) AS AvgDiscountPct,
    MAX(dl.DiscountPct)                         AS MaxDiscountPct,
    SUM(ISNULL(dl.DiscountAmount, 0))           AS TotalDiscountAmount,
    SUM(CASE WHEN ISNULL(dl.DiscountPct, 0) > 0 OR ISNULL(dl.DiscountAmount, 0) > 0
             THEN 1 ELSE 0 END)                 AS DiscountedLineCount
FROM deal_lines dl
LEFT OUTER JOIN [__mj_BizAppsOrders].vwProducts p
        ON p.ID = dl.ProductID
GROUP BY
    dl.ProductID, p.Name, p.ProductType, dl.CompanyID, dl.Company
ORDER BY
    TotalNet DESC;
