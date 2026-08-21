-- Forecast by category — commit, best case, pipeline. Master plan §9.3, measure 3.
--
-- THE THREE BUCKETS ARE FLAGS, AND THAT IS THE WHOLE POINT OF THIS QUERY.
-- ForecastCategoryType carries IncludeInCommit / IncludeInBestCase / IncludeInPipeline, and §9.3 says
-- "never a string comparison" in as many words. A deployment can rename "Commit" to "Committed" or
-- add a fourth category; nothing here changes.
--
-- THEY ARE NOT MUTUALLY EXCLUSIVE, AND MUST NOT BE READ AS IF THEY WERE. One category can set more
-- than one flag — a Commit category almost always also counts toward best case and toward pipeline,
-- because commit is the floor of the forecast rather than a slice of it. So CommitAmount,
-- BestCaseAmount and PipelineAmount are three OVERLAPPING answers to three different questions, and
-- adding them together produces a number that means nothing. The columns are separate SUMs for
-- exactly that reason.
--
-- DATE DIMENSION: ExpectedCloseDate — a forecast is about the period a deal is expected to land in.
--
-- CLOSED IS REPORTED ALONGSIDE, NOT MIXED IN. ClosedAmount sums won deals in the same period, using
-- ActualCloseDate, so a forecast review can see attainment against the same window without a second
-- query. It is a different date column on purpose and is labelled as such.
SELECT
    d.CompanyID,
    d.Company                                   AS CompanyName,
    d.PipelineID,
    d.Pipeline                                  AS PipelineName,
    SUM(CASE WHEN fc.IncludeInCommit    = 1 AND st.IsOpen = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS CommitAmount,
    SUM(CASE WHEN fc.IncludeInBestCase  = 1 AND st.IsOpen = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS BestCaseAmount,
    SUM(CASE WHEN fc.IncludeInPipeline  = 1 AND st.IsOpen = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS PipelineAmount,
    SUM(CASE WHEN st.IsWon = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END)                                AS ClosedWonAmount,
    SUM(CASE WHEN fc.IncludeInCommit    = 1 AND st.IsOpen = 1 THEN 1 ELSE 0 END)                   AS CommitDealCount,
    SUM(CASE WHEN st.IsOpen = 1 THEN 1 ELSE 0 END)                                                 AS OpenDealCount,
    SUM(CASE WHEN st.IsOpen = 1 AND d.ForecastCategoryTypeID IS NULL THEN 1 ELSE 0 END)            AS UncategorizedOpenCount
FROM [__mj_BizAppsSales].vwDeals d
INNER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
LEFT OUTER JOIN [__mj_BizAppsSales].ForecastCategoryType fc
        ON fc.ID = d.ForecastCategoryTypeID
       AND fc.IsActive = 1
WHERE 1 = 1
  {% if CompanyID %}
  AND d.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if PipelineID %}
  AND d.PipelineID = {{ PipelineID | sqlString }}
  {% endif %}
  -- Open deals are placed by EXPECTED close; won deals by ACTUAL close. Same window, and each row
  -- uses the date that actually answers its question.
  {% if PeriodStart %}
  AND (
        (st.IsOpen = 1 AND d.ExpectedCloseDate >= {{ PeriodStart | sqlString }})
     OR (st.IsWon  = 1 AND d.ActualCloseDate   >= {{ PeriodStart | sqlString }})
      )
  {% endif %}
  {% if PeriodEnd %}
  AND (
        (st.IsOpen = 1 AND d.ExpectedCloseDate <= {{ PeriodEnd | sqlString }})
     OR (st.IsWon  = 1 AND d.ActualCloseDate   <= {{ PeriodEnd | sqlString }})
      )
  {% endif %}
GROUP BY
    d.CompanyID, d.Company, d.PipelineID, d.Pipeline
ORDER BY
    d.Company, d.Pipeline;
