-- Win rate, BY COUNT AND BY VALUE. Master plan §9.3, measure 5.
--
-- BOTH, ALWAYS, AND NEVER ONE ALONE — which is why §9.3 names them together and why this query
-- refuses to pick. They diverge exactly when it matters: a team that wins nine small deals and loses
-- one large one has a 90% win rate by count and may be under 50% by value. Reporting either number
-- without the other is how a pipeline problem stays invisible for a quarter.
--
-- THE DENOMINATOR IS CLOSED DEALS ONLY (DealStatusType.IsClosed), because an open deal has not been
-- won or lost yet and including it would drag every rate toward zero as the pipeline grows. Won and
-- lost are read from IsWon / IsLost rather than from "not won", so a closed status that is neither —
-- if a deployment ever seeds one, such as "Closed - No Decision" — is visible as the gap between
-- ClosedCount and (WonCount + LostCount) instead of being silently counted as a loss.
--
-- DATE DIMENSION: ActualCloseDate. A win rate is about deals that closed in the window.
--
-- ── A MISSING CLOSE DATE IS EXCLUDED BY THE WINDOW, NOT BY A STANDING `IS NOT NULL` ─────────────
--
-- This WHERE used to open with an unconditional `d.ActualCloseDate IS NOT NULL`, which contradicted
-- the denominator stated three paragraphs up: a closed deal that never recorded its close date is
-- still a closed deal, and dropping it moved the rate without appearing in either count.
--
-- It also put this query out of step with the Won tile. `dashboard-summary.sql` counts every won
-- deal when no period is supplied, INCLUDING an undated one, so on "All time" the dashboard showed
-- a Won count next to an "N won / M closed" line computed over a different set, with nothing on
-- screen explaining the gap.
--
-- The guard is not needed for the bounded case either. A comparison against NULL is UNKNOWN, so a
-- row with no ActualCloseDate fails `>= PeriodStart` and `<= PeriodEnd` on its own -- the same
-- mechanism `dashboard-summary.sql` relies on inside its `WonCount` CASE. Both queries therefore
-- now read the same way: an undated win is outside every bounded window and inside the unbounded
-- one, so it is never invisible everywhere at once.
--
-- ── THE FILTER BAR (bc-aidp-next-golive#350) ────────────────────────────────────────────────────
--
-- CompanyIDs, OwnerEmployeeIDs, PipelineIDs and ProductCompanyIDs are lists, rendered with `sqlIn`,
-- and narrow the closed deals the rate is computed over, exactly as they narrow `Sales: Dashboard
-- Summary`, so the Win rate tile describes the same deals as the tiles beside it. The single-value
-- CompanyID and PipelineID still work. A list that is "All" is left out rather than sent empty, since
-- `sqlIn` renders an empty list as `(NULL)`, which matches nothing.
--
-- Product company matches a deal when at least one line of its order belongs to a selected company
-- (OrderLine.CompanyID). The deal counts once at its full amount; a deal with no lines cannot match.
--
-- NULLIF GUARDS BOTH RATES. A period with no closed deals returns NULL rather than dividing by zero,
-- and NULL is the honest answer: "no rate" is a different fact from "a rate of zero".
SELECT
    d.CompanyID,
    d.Company                                    AS CompanyName,
    d.PipelineID,
    d.Pipeline                                   AS PipelineName,
    d.DealTypeID,
    d.DealType                                   AS DealTypeName,
    COUNT(*)                                     AS ClosedCount,
    SUM(CASE WHEN st.IsWon  = 1 THEN 1 ELSE 0 END) AS WonCount,
    SUM(CASE WHEN st.IsLost = 1 THEN 1 ELSE 0 END) AS LostCount,
    CAST(SUM(CASE WHEN st.IsWon = 1 THEN 1 ELSE 0 END) AS DECIMAL(18, 4))
        / NULLIF(COUNT(*), 0)                    AS WinRateByCount,
    SUM(CASE WHEN st.IsWon  = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS WonAmount,
    SUM(CASE WHEN st.IsLost = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS LostAmount,
    CAST(SUM(CASE WHEN st.IsWon = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS DECIMAL(18, 4))
        / NULLIF(SUM(ISNULL(d.Amount, 0)), 0)    AS WinRateByValue
FROM [__mj_BizAppsSales].vwDeals d
INNER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
       AND st.IsClosed = 1
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
  {% if OwnerEmployeeIDs %}
  AND d.OwnerEmployeeID IN {{ OwnerEmployeeIDs | sqlIn }}
  {% endif %}
  {% if ProductCompanyIDs %}
  AND EXISTS (SELECT 1 FROM [__mj_BizAppsOrders].OrderLine ol
              WHERE ol.OrderHeaderID = d.OrderID
                AND ol.CompanyID IN {{ ProductCompanyIDs | sqlIn }})
  {% endif %}
  {% if PeriodStart %}
  AND d.ActualCloseDate >= {{ PeriodStart | sqlString }}
  {% endif %}
  {% if PeriodEnd %}
  AND d.ActualCloseDate <= {{ PeriodEnd | sqlString }}
  {% endif %}
GROUP BY
    d.CompanyID, d.Company, d.PipelineID, d.Pipeline, d.DealTypeID, d.DealType
ORDER BY
    d.Company, d.Pipeline, d.DealType;
