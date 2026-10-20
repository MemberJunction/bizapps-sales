-- New vs renewal vs expansion mix. Master plan §9.3, measure 10 — via the DealType dimension (§9.2).
--
-- THE MIX IS READ FROM THE TYPE TABLE, NOT FROM TYPE NAMES. §9.3 phrases this measure as "new vs
-- renewal vs expansion", which are the labels the seeded rows happen to carry — but nothing here
-- compares them. Rows group by `DealTypeID` and render `DealType.Name` for display only, so a
-- deployment that adds a fourth motion, or renames "Expansion" to "Upsell", gets a correct extra row
-- rather than a silently miscounted one.
--
-- `RequiresRenewalSource` IS THE ONE FLAG THIS QUERY BRANCHES ON, and it is the same flag
-- `CloseDealOperation` uses to decide whether a close takes the renewal door. Reporting it here means
-- the mix and the routing agree by construction: a type the engine treats as a renewal is a type this
-- report counts as one.
--
-- DATE DIMENSION: ActualCloseDate for closed deals, ExpectedCloseDate for open ones — the mix
-- question is "what are we selling in this period", and an open deal belongs to the period it is
-- expected to land in. Both are reported separately below so the two are never silently added.
--
-- PIPELINES FLAGGED OUT OF THE FORECAST LOSE THEIR OPEN DEALS, AS IN PIPELINE SUMMARY AND THE
-- DASHBOARD. Pipeline.IncludeInForecast = 0 marks a pipeline that holds historical deals; its open
-- rows are not the current book, so counting them here made OpenCount and OpenAmount disagree with
-- every other forecast query. Its won and lost deals stay. Naming the pipeline in PipelineID includes it.
SELECT
    d.DealTypeID,
    dt.Name                                     AS DealTypeName,
    dt.RequiresRenewalSource,
    d.CompanyID,
    d.Company                                   AS CompanyName,
    d.PipelineID,
    d.Pipeline                                  AS PipelineName,
    SUM(CASE WHEN st.IsWon = 1 THEN 1 ELSE 0 END)                    AS WonCount,
    SUM(CASE WHEN st.IsWon = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END)  AS WonAmount,
    SUM(CASE WHEN st.IsOpen = 1 THEN 1 ELSE 0 END)                   AS OpenCount,
    SUM(CASE WHEN st.IsOpen = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS OpenAmount,
    SUM(CASE WHEN st.IsLost = 1 THEN 1 ELSE 0 END)                   AS LostCount,
    -- A renewal deal that names no source contract is a data gap worth seeing rather than a row to
    -- filter out: it means the routing had nothing to renew against.
    SUM(CASE WHEN dt.RequiresRenewalSource = 1 AND d.RenewsContractID IS NULL THEN 1 ELSE 0 END)
                                                AS RenewalsMissingSource
FROM [__mj_BizAppsSales].vwDeals d
INNER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
INNER JOIN [__mj_BizAppsSales].DealType dt
        ON dt.ID = d.DealTypeID
INNER JOIN [__mj_BizAppsSales].Pipeline p
        ON p.ID = d.PipelineID
WHERE 1 = 1
  {% if CompanyID %}
  AND d.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if PipelineID %}
  AND d.PipelineID = {{ PipelineID | sqlString }}
  {% else %}
  AND (st.IsOpen = 0 OR p.IncludeInForecast = 1)
  {% endif %}
  {% if PeriodStart %}
  AND COALESCE(d.ActualCloseDate, d.ExpectedCloseDate) >= {{ PeriodStart | sqlString }}
  {% endif %}
  {% if PeriodEnd %}
  AND COALESCE(d.ActualCloseDate, d.ExpectedCloseDate) <= {{ PeriodEnd | sqlString }}
  {% endif %}
GROUP BY
    d.DealTypeID, dt.Name, dt.RequiresRenewalSource,
    d.CompanyID, d.Company, d.PipelineID, d.Pipeline
ORDER BY
    WonAmount DESC;
