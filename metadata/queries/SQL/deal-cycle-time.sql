-- Average cycle time — how long a deal takes from creation to close. Master plan §9.3, measure 6.
--
-- DATE DIMENSION: two of them, and the pair is the measure. The window is selected on
-- ActualCloseDate (which deals count), and the duration is measured from the deal's START to that
-- same close (how long each took). §9.2 asks reports to say which date they use; this one uses both,
-- they do different jobs, and the start date is not the obvious column — see below.
--
-- ── WHERE THE CLOCK STARTS, WHICH IS NOT SIMPLY `__mj_CreatedAt` ────────────────────────────────
--
-- The obvious answer is row creation, and for a deal entered in this app it is the right one: a deal
-- exists from the moment it is created, and deals that never moved stage still closed. Measuring from
-- the first `DealStageEvent` alone would silently exclude every straight-to-close deal and shorten the
-- average by dropping the fastest cases — the opposite of the error most people would predict.
--
-- But `__mj_CreatedAt` is WHEN THE ROW WAS WRITTEN, and for imported history that is import day, not
-- deal day. The HubSpot importer preserves original `DealStageEvent.ChangedAt` values (CLAUDE.md rule
-- 3), so an imported deal that ran for eight months arrives with stage events spanning those months
-- and a creation stamp of this morning — a NEGATIVE cycle time.
--
-- Measured on the demo data: both closed deals carry ActualCloseDate in July against a creation stamp
-- of 2026-08-18, so a naive DATEDIFF returns negative values and the whole measure reads as garbage.
--
-- So the clock starts at the EARLIEST evidence the deal existed: its creation stamp, or its first
-- stage transition, whichever came first. Native deals are unaffected (creation is always earliest);
-- imported and seeded deals get a duration that reflects what actually happened.
--
-- WON AND LOST ARE REPORTED SEPARATELY because they answer different questions. Time-to-win is a
-- sales-cycle measure; time-to-lose is a qualification measure, and a team that loses fast is
-- healthier than one that loses slowly. Averaging them together hides both.
--
-- MEDIAN AS WELL AS MEAN. PERCENTILE_CONT is a window function, so it is computed in a subquery and
-- then aggregated — one long-running enterprise deal moves a mean far more than it moves a median,
-- and on the small deal counts a single company produces, that difference is most of the signal.
WITH closed AS (
    SELECT
        d.CompanyID,
        d.Company,
        d.PipelineID,
        d.Pipeline,
        st.IsWon,
        st.IsLost,
        DATEDIFF(day, started.StartedAt, d.ActualCloseDate) AS DaysToClose
    FROM [__mj_BizAppsSales].vwDeals d
    INNER JOIN [__mj_BizAppsSales].DealStatusType st
            ON st.ID = d.DealStatusTypeID
           AND st.IsClosed = 1
    CROSS APPLY (
        SELECT CAST(
            CASE WHEN ev.FirstEventAt IS NOT NULL AND ev.FirstEventAt < d.__mj_CreatedAt
                 THEN ev.FirstEventAt ELSE d.__mj_CreatedAt END AS DATE) AS StartedAt
        FROM (
            SELECT MIN(e.ChangedAt) AS FirstEventAt
            FROM [__mj_BizAppsSales].DealStageEvent e
            WHERE e.DealID = d.ID
        ) ev
    ) started
    WHERE d.ActualCloseDate IS NOT NULL
      -- A close still stamped before ANY evidence the deal existed is a data fault rather than a
      -- zero-day cycle. Excluded rather than clamped, so it stays visible as a gap instead of
      -- quietly flattering the average.
      AND d.ActualCloseDate >= started.StartedAt
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
),
ranked AS (
    SELECT
        c.*,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(c.DaysToClose AS FLOAT))
            OVER (PARTITION BY c.CompanyID, c.PipelineID, c.IsWon) AS MedianDaysToClose
    FROM closed c
)
SELECT
    r.CompanyID,
    r.Company                       AS CompanyName,
    r.PipelineID,
    r.Pipeline                      AS PipelineName,
    CASE WHEN r.IsWon = 1 THEN 'Won' WHEN r.IsLost = 1 THEN 'Lost' ELSE 'Closed (neither)' END AS Outcome,
    COUNT(*)                        AS DealCount,
    AVG(CAST(r.DaysToClose AS FLOAT)) AS AvgDaysToClose,
    MIN(r.MedianDaysToClose)        AS MedianDaysToClose,
    MIN(r.DaysToClose)              AS FastestDays,
    MAX(r.DaysToClose)              AS SlowestDays
FROM ranked r
GROUP BY
    r.CompanyID, r.Company, r.PipelineID, r.Pipeline, r.IsWon, r.IsLost
ORDER BY
    r.Company, r.Pipeline, Outcome;
