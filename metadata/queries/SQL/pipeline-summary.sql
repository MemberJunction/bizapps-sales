-- Open and weighted pipeline, by pipeline and stage. Master plan §9.3, measures 1 and 2.
--
-- DATE DIMENSION: ExpectedCloseDate. This is a forward-looking question — "what is in the pipeline
-- for this period" — so a deal belongs to the period it is expected to CLOSE in, not the one it was
-- created in. §9.2 requires reports to say which date they use; this is that statement.
--
-- OPEN IS A FLAG. DealStatusType.IsOpen, never a status name. A pipeline whose winning stage is
-- called "Signed" is excluded here for the right reason: the status it points at is not open.
--
-- WEIGHTED IS Amount * Probability, which §9.3 names in exactly those words. It is a forecast
-- weighting, not a price — nothing bills from it, and sales computes no money. Probability is stored
-- on the deal (applied from the stage), so this multiplies two stored values to answer a likelihood
-- question.
--
-- AMOUNT PROVENANCE TRAVELS WITH THE FIGURE. StatedAmount / PricedAmount split the same total by
-- Deal.AmountIsComputed, because a hand-typed number and an orders-engine answer are different kinds
-- of fact and a consumer that cannot tell them apart will present both as settled. On today's data
-- every deal is stated, which is exactly the thing worth surfacing rather than hiding.
SELECT
    d.PipelineID,
    d.Pipeline                                      AS PipelineName,
    d.PipelineStageID,
    d.PipelineStage                                 AS StageName,
    ps.DisplayOrder                                 AS StageOrder,
    d.CompanyID,
    d.Company                                       AS CompanyName,
    COUNT(*)                                        AS DealCount,
    SUM(ISNULL(d.Amount, 0))                        AS OpenAmount,
    SUM(ISNULL(d.Amount, 0) * ISNULL(d.Probability, 0) / 100.0) AS WeightedAmount,
    SUM(CASE WHEN d.AmountIsComputed = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS PricedAmount,
    SUM(CASE WHEN d.AmountIsComputed = 1 THEN 0 ELSE ISNULL(d.Amount, 0) END) AS StatedAmount,
    SUM(CASE WHEN d.Amount IS NULL THEN 1 ELSE 0 END)                         AS NoAmountCount
FROM [__mj_BizAppsSales].vwDeals d
INNER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
       AND st.IsOpen = 1
LEFT OUTER JOIN [__mj_BizAppsSales].PipelineStage ps
        ON ps.ID = d.PipelineStageID
WHERE 1 = 1
  {% if CompanyID %}
  AND d.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if PipelineID %}
  AND d.PipelineID = {{ PipelineID | sqlString }}
  {% endif %}
  {% if PeriodStart %}
  AND d.ExpectedCloseDate >= {{ PeriodStart | sqlString }}
  {% endif %}
  {% if PeriodEnd %}
  AND d.ExpectedCloseDate <= {{ PeriodEnd | sqlString }}
  {% endif %}
GROUP BY
    d.PipelineID, d.Pipeline, d.PipelineStageID, d.PipelineStage, ps.DisplayOrder,
    d.CompanyID, d.Company
ORDER BY
    d.Pipeline, ps.DisplayOrder;
