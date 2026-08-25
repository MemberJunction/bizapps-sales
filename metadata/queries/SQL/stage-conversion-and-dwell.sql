-- Stage conversion and dwell time. Master plan §9.3, measure 7 — the TRANSITION grain (§9.1).
--
-- THIS IS THE ONE QUERY THAT CANNOT BE ANSWERED FROM `Deal`, and that is why DealStageEvent is
-- append-only. A deal's current stage says where it is; only the event log says where it has BEEN,
-- how long it sat there, and what it was worth on the way out. Reconstructing this from Deal is not
-- merely hard, it is impossible once a deal moves twice.
--
-- DATE DIMENSION: ChangedAt — the transition date. §9.2 lists it as its own dimension precisely
-- because it answers questions neither close date can.
--
-- DWELL COMES FROM THE STAMP, NOT FROM ARITHMETIC ACROSS ROWS. DealStageEvent.DaysInPreviousStage is
-- recorded at transition time. Deriving it here by joining each event to its predecessor would give a
-- different answer for any deal whose history was imported rather than lived — the HubSpot importer
-- preserves original ChangedAt values, so the gaps between events are real history and the stamps are
-- the authority on them.
--
-- SKIPPED STAGES FALL OUT OF THIS FOR FREE. Because rows are keyed on the (From, To) pair rather than
-- on adjacency, a jump from Discovery straight to Negotiation appears as its own pair rather than
-- being silently absorbed into two hops that never happened.
--
-- AMOUNT AT TRANSITION IS THE DEPARTING VALUE. The event stamps what the deal was worth on the way
-- OUT of the from-stage, so a conversion rate weighted by value reflects what was actually at stake
-- at that moment rather than what the deal is worth today.
SELECT
    p.ID                                        AS PipelineID,
    p.Name                                      AS PipelineName,
    e.FromStageID,
    fs.Name                                     AS FromStageName,
    fs.DisplayOrder                             AS FromStageOrder,
    e.ToStageID,
    ts.Name                                     AS ToStageName,
    ts.DisplayOrder                             AS ToStageOrder,
    -- A move that lands in a stage further down the board than the next one is a SKIP, and it is
    -- worth seeing: skipped stages are either a process shortcut worth adopting or a discipline
    -- problem worth naming.
    CASE WHEN ts.DisplayOrder > fs.DisplayOrder + 1 THEN 1 ELSE 0 END AS IsSkip,
    CASE WHEN ts.DisplayOrder < fs.DisplayOrder    THEN 1 ELSE 0 END AS IsBackward,
    COUNT(*)                                    AS TransitionCount,
    COUNT(DISTINCT e.DealID)                    AS DealCount,
    AVG(CAST(e.DaysInPreviousStage AS FLOAT))   AS AvgDaysInFromStage,
    MAX(e.DaysInPreviousStage)                  AS MaxDaysInFromStage,
    SUM(ISNULL(e.AmountAtTransition, 0))        AS AmountMoved,
    AVG(CAST(e.ProbabilityAtTransition AS FLOAT)) AS AvgProbabilityLeaving
FROM [__mj_BizAppsSales].DealStageEvent e
INNER JOIN [__mj_BizAppsSales].Deal d
        ON d.ID = e.DealID
INNER JOIN [__mj_BizAppsSales].Pipeline p
        ON p.ID = d.PipelineID
LEFT OUTER JOIN [__mj_BizAppsSales].PipelineStage fs
        ON fs.ID = e.FromStageID
LEFT OUTER JOIN [__mj_BizAppsSales].PipelineStage ts
        ON ts.ID = e.ToStageID
WHERE 1 = 1
  {% if CompanyID %}
  AND d.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if PipelineID %}
  AND d.PipelineID = {{ PipelineID | sqlString }}
  {% endif %}
  {% if PeriodStart %}
  AND e.ChangedAt >= {{ PeriodStart | sqlString }}
  {% endif %}
  {% if PeriodEnd %}
  AND e.ChangedAt <= {{ PeriodEnd | sqlString }}
  {% endif %}
GROUP BY
    p.ID, p.Name, e.FromStageID, fs.Name, fs.DisplayOrder,
    e.ToStageID, ts.Name, ts.DisplayOrder
ORDER BY
    p.Name, fs.DisplayOrder, ts.DisplayOrder;
