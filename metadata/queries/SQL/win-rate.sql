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
WHERE d.ActualCloseDate IS NOT NULL
  {% if CompanyID %}
  AND d.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if PipelineID %}
  AND d.PipelineID = {{ PipelineID | sqlString }}
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
