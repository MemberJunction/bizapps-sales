-- Bookings — closed-won amount by period. Master plan §9.3, measure 4.
--
-- DATE DIMENSION: ActualCloseDate. Bookings are recognised when the deal actually closed, not when
-- somebody expected it to, and the two differ for every deal that ever slipped. §9.2 requires the
-- statement; this is it.
--
-- WON IS A FLAG (DealStatusType.IsWon). Losses are counted alongside — from the same flag family, so
-- one pass answers both — because a bookings figure without the denominator invites the wrong
-- conclusion when a quarter's wins are up and its win RATE is down.
--
-- ONE ROW PER DEAL. This reads the deal grain, so no attribution question arises and no deal can be
-- counted twice. Bookings BY REP is a different query with a declared basis; see
-- bookings-by-owner.sql and the double-count note in §9.4.
--
-- GRANULARITY is a Nunjucks branch rather than a parameter substituted into SQL text: month, quarter
-- and year are three fixed expressions chosen by a branch, so no caller-supplied string ever reaches
-- the DATEPART argument.
--
-- THE BRANCH SITS IN ONE PLACE, THE CTE, AND EVERYTHING ELSE READS ITS PeriodStart. MJ's SQL parser
-- reads a query with every block tag removed and every branch kept. A branch repeated in the GROUP
-- BY left three expressions there with no commas between them, so the parse failed and the fallback
-- recorded tables named after words in these comments and no output columns (#417). In the CTE's
-- select list, first and each ending in a comma, the branches read as three columns of the CTE, so
-- the whole statement still parses. Only one of them is ever rendered.
WITH closed AS (
    SELECT
        {% if Granularity == "year" %}
        DATEFROMPARTS(YEAR(d.ActualCloseDate), 1, 1)                                    AS PeriodStart,
        {% elif Granularity == "quarter" %}
        DATEFROMPARTS(YEAR(d.ActualCloseDate), ((DATEPART(quarter, d.ActualCloseDate) - 1) * 3) + 1, 1) AS PeriodStart,
        {% else %}
        DATEFROMPARTS(YEAR(d.ActualCloseDate), MONTH(d.ActualCloseDate), 1)             AS PeriodStart,
        {% endif %}
        d.CompanyID,
        d.Company,
        d.PipelineID,
        d.Pipeline,
        d.Amount,
        d.AmountIsComputed,
        st.IsWon,
        st.IsLost
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
)
SELECT
    c.CompanyID,
    c.Company                                   AS CompanyName,
    c.PipelineID,
    c.Pipeline                                  AS PipelineName,
    c.PeriodStart,
    SUM(CASE WHEN c.IsWon  = 1 THEN ISNULL(c.Amount, 0) ELSE 0 END) AS BookedAmount,
    SUM(CASE WHEN c.IsWon  = 1 THEN 1 ELSE 0 END)                   AS WonCount,
    SUM(CASE WHEN c.IsLost = 1 THEN ISNULL(c.Amount, 0) ELSE 0 END) AS LostAmount,
    SUM(CASE WHEN c.IsLost = 1 THEN 1 ELSE 0 END)                   AS LostCount,
    -- Provenance rides along, for the same reason it does on the pipeline summary: a booked figure
    -- nobody priced is still a booked figure, but a reader deserves to know which it is.
    SUM(CASE WHEN c.IsWon = 1 AND c.AmountIsComputed = 1 THEN ISNULL(c.Amount, 0) ELSE 0 END) AS BookedPricedAmount,
    SUM(CASE WHEN c.IsWon = 1 AND c.AmountIsComputed = 0 THEN ISNULL(c.Amount, 0) ELSE 0 END) AS BookedStatedAmount
FROM closed c
GROUP BY
    c.CompanyID, c.Company, c.PipelineID, c.Pipeline, c.PeriodStart
ORDER BY
    c.PeriodStart DESC, c.Company, c.Pipeline;
