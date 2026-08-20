-- Slippage — deals whose expected close date MOVED. Master plan §9.3, measure 8.
--
-- ── WHERE THE HISTORY COMES FROM, BECAUSE IT IS NOT WHERE YOU WOULD LOOK FIRST ──────────────────
--
-- §9.3 defines slippage as "deals whose expected close moved", which needs the PREVIOUS value of
-- ExpectedCloseDate. `Deal` holds only the current one, and `DealStageEvent` stamps amount and
-- probability at transition but not dates — so the obvious two sources cannot answer this.
--
-- MJ's own audit trail can. `Entity.TrackRecordChanges` is 1 on Deals, so every update writes a
-- `__mj.RecordChange` row whose `ChangesJSON` carries `{"Field":{"field","oldValue","newValue"}}` per
-- changed column. That is a real, already-working source of exactly this fact, and it means slippage
-- needs no new column and no new stamp — a conclusion worth recording, because the alternative
-- reading is that the schema is missing something.
--
-- The one thing it depends on: RecordChange rows survive. They are audit data, so nothing prunes them
-- today, but a retention policy on that table would silently shorten this report's history rather
-- than break it. Worth knowing before someone adds one.
--
-- DATE DIMENSION: RecordChange.ChangedAt — when the slip was RECORDED, which is the only date that
-- answers "how much slipped this month". The dates being moved FROM and TO are reported as values.
--
-- POSITIVE DAYS = SLIPPED LATER, which is the case people mean. A negative figure is a deal PULLED
-- FORWARD and is kept rather than filtered, because a report that only ever shows bad news is one
-- people learn to discount.
WITH slips AS (
    SELECT
        rc.RecordID,
        rc.ChangedAt,
        TRY_CONVERT(DATE, JSON_VALUE(rc.ChangesJSON, '$.ExpectedCloseDate.oldValue')) AS FromDate,
        TRY_CONVERT(DATE, JSON_VALUE(rc.ChangesJSON, '$.ExpectedCloseDate.newValue')) AS ToDate
    FROM [__mj].RecordChange rc
    INNER JOIN [__mj].Entity e
            ON e.ID = rc.EntityID
           AND e.Name = 'MJ_BizApps_Sales: Deals'
    WHERE rc.Type = 'Update'
      AND ISJSON(rc.ChangesJSON) = 1
      AND JSON_VALUE(rc.ChangesJSON, '$.ExpectedCloseDate.field') IS NOT NULL
      {% if PeriodStart %}
      AND rc.ChangedAt >= {{ PeriodStart | sqlString }}
      {% endif %}
      {% if PeriodEnd %}
      AND rc.ChangedAt <= {{ PeriodEnd | sqlString }}
      {% endif %}
)
SELECT
    d.ID                                        AS DealID,
    d.DealNumber,
    d.Name                                      AS DealName,
    d.CompanyID,
    d.Company                                   AS CompanyName,
    d.PipelineID,
    d.Pipeline                                  AS PipelineName,
    d.PipelineStage                             AS StageName,
    d.OwnerEmployee                             AS OwnerName,
    d.Amount,
    d.AmountIsComputed,
    st.IsOpen                                   AS IsStillOpen,
    COUNT(*)                                    AS SlipCount,
    MIN(s.FromDate)                             AS EarliestExpected,
    MAX(s.ToDate)                               AS CurrentExpected,
    -- Net movement across every slip in the window: where it was first expected, versus where it
    -- ended up. Summing each individual slip would double-count a deal moved twice in one direction.
    DATEDIFF(day, MIN(s.FromDate), MAX(s.ToDate)) AS NetDaysSlipped,
    MAX(s.ChangedAt)                            AS LastSlippedAt
FROM slips s
INNER JOIN [__mj_BizAppsSales].vwDeals d
        ON d.ID = s.RecordID
INNER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
WHERE s.FromDate IS NOT NULL
  AND s.ToDate IS NOT NULL
  AND s.FromDate <> s.ToDate
  {% if CompanyID %}
  AND d.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if PipelineID %}
  AND d.PipelineID = {{ PipelineID | sqlString }}
  {% endif %}
  {% if OpenOnly == "true" %}
  AND st.IsOpen = 1
  {% endif %}
GROUP BY
    d.ID, d.DealNumber, d.Name, d.CompanyID, d.Company, d.PipelineID, d.Pipeline,
    d.PipelineStage, d.OwnerEmployee, d.Amount, d.AmountIsComputed, st.IsOpen
ORDER BY
    NetDaysSlipped DESC, d.Amount DESC;
