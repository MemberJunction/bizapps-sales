-- The deal roster — one row per deal, dimensioned, for a grid or a drill-through target.
--
-- WHY A LIST BELONGS IN A SET OF AGGREGATES. Every other query here answers a question with a number,
-- and the first thing anyone does with a number they distrust is ask which deals are in it. Without a
-- roster that shares the same filters, that question gets answered by someone writing ad-hoc SQL
-- against `Deal` — which is how a report and its drill-through quietly stop agreeing.
--
-- It is also what the dashboard's own tables need. `DealWorkspaceService.LoadRoster()` currently
-- builds this shape by hand in TypeScript; when the tiles are re-pointed at these queries (a later
-- step, deliberately not done here while another session is in that file), this is what they read.
--
-- NO RAW IDs FOR DISPLAY — S-US11 asks for names throughout — but the IDs are returned alongside,
-- because a grid needs the name and a drill-through needs the key.
--
-- STATUS FLAGS TRAVEL WITH THE ROW so a consumer can branch on IsOpen / IsWon / IsClosed without
-- either re-joining the type table or, worse, comparing the status NAME it was given for display.
-- That is the vocabulary rule reaching one layer further out than the query itself.
--
-- DATE DIMENSION: filtered on expected close for open deals and actual close for closed ones, so one
-- period filter behaves sensibly across a mixed set.
SELECT
    d.ID                                        AS DealID,
    d.DealNumber,
    d.Name                                      AS DealName,
    d.CompanyID,
    d.Company                                   AS CompanyName,
    d.AccountID,
    d.Account                                   AS AccountName,
    d.PipelineID,
    d.Pipeline                                  AS PipelineName,
    d.PipelineStageID,
    d.PipelineStage                             AS StageName,
    ps.DisplayOrder                             AS StageOrder,
    d.DealTypeID,
    d.DealType                                  AS DealTypeName,
    d.DealStatusTypeID,
    d.DealStatusType                            AS StatusName,
    st.IsOpen,
    st.IsWon,
    st.IsLost,
    st.IsClosed,
    d.ForecastCategoryType                      AS ForecastCategoryName,
    fc.IncludeInCommit,
    fc.IncludeInBestCase,
    d.OwnerEmployeeID,
    d.OwnerEmployee                             AS OwnerName,
    d.Amount,
    -- Provenance, so a grid can mark a stated figure rather than presenting it as settled. This is
    -- the same distinction the board and dashboard now render.
    d.AmountIsComputed,
    d.AmountComputedAt,
    d.Probability,
    ISNULL(d.Amount, 0) * ISNULL(d.Probability, 0) / 100.0 AS WeightedAmount,
    d.ExpectedCloseDate,
    d.ActualCloseDate,
    -- "Past its expected close and still open" — the slipped flag the dashboard shows. Computed in
    -- UTC because everything stored is UTC.
    CASE WHEN st.IsOpen = 1
          AND d.ExpectedCloseDate IS NOT NULL
          AND d.ExpectedCloseDate < CAST(SYSUTCDATETIME() AS DATE)
         THEN 1 ELSE 0 END                      AS IsPastExpectedClose,
    d.OrderID,
    d.ContractID,
    d.__mj_CreatedAt                            AS CreatedAt
FROM [__mj_BizAppsSales].vwDeals d
INNER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
LEFT OUTER JOIN [__mj_BizAppsSales].PipelineStage ps
        ON ps.ID = d.PipelineStageID
LEFT OUTER JOIN [__mj_BizAppsSales].ForecastCategoryType fc
        ON fc.ID = d.ForecastCategoryTypeID
WHERE 1 = 1
  {% if CompanyID %}
  AND d.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if PipelineID %}
  AND d.PipelineID = {{ PipelineID | sqlString }}
  {% endif %}
  {% if OwnerEmployeeID %}
  AND d.OwnerEmployeeID = {{ OwnerEmployeeID | sqlString }}
  {% endif %}
  {% if OpenOnly == "true" %}
  AND st.IsOpen = 1
  {% endif %}
  {% if PeriodStart %}
  AND COALESCE(d.ActualCloseDate, d.ExpectedCloseDate) >= {{ PeriodStart | sqlString }}
  {% endif %}
  {% if PeriodEnd %}
  AND COALESCE(d.ActualCloseDate, d.ExpectedCloseDate) <= {{ PeriodEnd | sqlString }}
  {% endif %}
ORDER BY
    CASE WHEN st.IsOpen = 1 THEN 0 ELSE 1 END,
    d.ExpectedCloseDate,
    d.Amount DESC;
