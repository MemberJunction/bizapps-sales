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
-- ── HOW THIS WAS FOUND, BECAUSE THE FAILURE SHAPE IS WORTH KNOWING ─────────────────────────────
--
-- The first version of this query joined `d.ID = rc.RecordID` directly and was reported as running
-- clean. It was not: it was measured over data where NO row qualified, so the conversion was never
-- attempted. The moment a real expected-close date moved, the same statement died with Msg 8169.
--
-- A statement that is clean over an empty set and fatal over a populated one is the shape to hunt in
-- anything that joins, converts or casts. `test-harnesses/verify-queries.mjs` now exercises every
-- query against data that reaches its joins, for exactly this reason.
--
-- The one thing it depends on: RecordChange rows survive. They are audit data, so nothing prunes them
-- today, but a retention policy on that table would silently shorten this report's history rather
-- than break it. Worth knowing before someone adds one.
--
-- DATE DIMENSION: RecordChange.ChangedAt — when the slip was RECORDED, which is the only date that
-- answers "how much slipped this month". The dates being moved FROM and TO are reported as values.
--
-- THE PERIOD IS IN BUSINESS DAYS (#289). ChangedAt is a DATETIMEOFFSET and PeriodStart/PeriodEnd are
-- date-only, so comparing them directly put both bounds at UTC midnight: a slip recorded on the last
-- evening of the period (after 6 PM Central, 7 PM in daylight time) fell out, and one from the evening
-- before the period fell in. Each bound is now judged on `[__mj_BizAppsCommon].[fnBusinessDayOf]()`,
-- the business day of the instant — a function, not an inline `AT TIME ZONE`, which MJ's SQL parser
-- cannot read (see deal-cycle-time.sql). The padded UTC range beside it (a day before the start, two
-- after the end) is wider than any zone offset and only lets an index on ChangedAt narrow the scan.
--
-- EVERY JSON_VALUE SITS INSIDE `CASE WHEN ISJSON(...) = 1`. SQL Server does not evaluate a WHERE
-- clause left to right: the plan may run JSON_VALUE before the ISJSON test or the join to Deals has
-- removed a row. RecordChange holds ChangesJSON that is not JSON — MJ core's own migrations leave
-- entries cut off at 4,000 characters, and orders writes some too — and one such row anywhere in the
-- table failed the whole query with Msg 13609. A CASE is evaluated in order, so the guard holds
-- whatever plan is chosen.
--
-- FIRST AND LAST ARE BY ChangedAt, NOT BY DATE VALUE (#353). A deal moved Oct 1 -> Dec 1 -> Nov 1
-- started at Oct 1 and ends at Nov 1, net +31 days. MIN(FromDate) and MAX(ToDate) gave Dec 1 and +61,
-- and a deal pulled in twice read as not moved. `moves` ranks each deal's moves in the window both
-- ways by ChangedAt (the RecordChange ID breaks a tie), so the first move's FromDate and the last
-- move's ToDate are picked by position. ROW_NUMBER() OVER exists in PostgreSQL unchanged.
--
-- POSITIVE DAYS = SLIPPED LATER, which is the case people mean. A negative figure is a deal PULLED
-- FORWARD and is kept rather than filtered, because a report that only ever shows bad news is one
-- people learn to discount.
WITH slips AS (
    SELECT
        /**
         * THE DEAL ID, PARSED OUT OF A COMPOSITE KEY STRING.
         *
         * `RecordChange.RecordID` is NVARCHAR and holds MJ's composite-key encoding -- for a
         * single-column primary key that is `ID|<guid>`, e.g. `ID|261709E2-7106-43B0-9CB9-...`. It is
         * NOT a bare guid, and joining it straight to `Deal.ID` is fatal: SQL Server converts toward
         * uniqueidentifier and raises
         *
         *     Msg 8169 -- Conversion failed when converting from a character string to uniqueidentifier
         *
         * TRY_CONVERT, not CONVERT, and that is the load-bearing half. A row whose key does not parse
         * yields NULL and drops out of the join; with plain CONVERT it would kill the whole statement.
         * Composite keys with more than one column encode as `A|1|B|2`, which is not this table's
         * shape today but is exactly the input that would otherwise turn a report into an outage.
         */
        TRY_CONVERT(UNIQUEIDENTIFIER, SUBSTRING(rc.RecordID, CHARINDEX('|', rc.RecordID) + 1, 36)) AS DealID,
        rc.ID                                   AS ChangeID,
        rc.ChangedAt,
        TRY_CONVERT(DATE, CASE WHEN ISJSON(rc.ChangesJSON) = 1
                               THEN JSON_VALUE(rc.ChangesJSON, '$.ExpectedCloseDate.oldValue') END) AS FromDate,
        TRY_CONVERT(DATE, CASE WHEN ISJSON(rc.ChangesJSON) = 1
                               THEN JSON_VALUE(rc.ChangesJSON, '$.ExpectedCloseDate.newValue') END) AS ToDate
    FROM [__mj].RecordChange rc
    INNER JOIN [__mj].Entity e
            ON e.ID = rc.EntityID
           AND e.Name = 'MJ_BizApps_Sales: Deals'
    WHERE rc.Type = 'Update'
      AND ISJSON(rc.ChangesJSON) = 1
      AND CASE WHEN ISJSON(rc.ChangesJSON) = 1
               THEN JSON_VALUE(rc.ChangesJSON, '$.ExpectedCloseDate.field') END IS NOT NULL
      {% if PeriodStart %}
      AND rc.ChangedAt >= DATEADD(day, -1, {{ PeriodStart | sqlString }})
      AND [__mj_BizAppsCommon].[fnBusinessDayOf](rc.ChangedAt) >= {{ PeriodStart | sqlString }}
      {% endif %}
      {% if PeriodEnd %}
      AND rc.ChangedAt < DATEADD(day, 2, {{ PeriodEnd | sqlString }})
      AND [__mj_BizAppsCommon].[fnBusinessDayOf](rc.ChangedAt) <= {{ PeriodEnd | sqlString }}
      {% endif %}
),
moves AS (
    SELECT
        s.DealID,
        s.ChangedAt,
        s.FromDate,
        s.ToDate,
        ROW_NUMBER() OVER (PARTITION BY s.DealID ORDER BY s.ChangedAt ASC, s.ChangeID ASC)   AS FirstRank,
        ROW_NUMBER() OVER (PARTITION BY s.DealID ORDER BY s.ChangedAt DESC, s.ChangeID DESC) AS LastRank
    FROM slips s
    WHERE s.DealID IS NOT NULL
      AND s.FromDate IS NOT NULL
      AND s.ToDate IS NOT NULL
      AND s.FromDate <> s.ToDate
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
    -- The first move's FromDate: where the deal was expected before the window's first move.
    MAX(CASE WHEN m.FirstRank = 1 THEN m.FromDate END) AS EarliestExpected,
    -- The last move's ToDate: where the window's last move left it.
    MAX(CASE WHEN m.LastRank = 1 THEN m.ToDate END)    AS CurrentExpected,
    -- Net movement across every slip in the window: where it was first expected, versus where it
    -- ended up. Summing each individual slip would double-count a deal moved twice in one direction.
    DATEDIFF(day, MAX(CASE WHEN m.FirstRank = 1 THEN m.FromDate END),
                  MAX(CASE WHEN m.LastRank = 1 THEN m.ToDate END)) AS NetDaysSlipped,
    MAX(m.ChangedAt)                            AS LastSlippedAt
FROM moves m
INNER JOIN [__mj_BizAppsSales].vwDeals d
        ON d.ID = m.DealID
INNER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
WHERE 1 = 1
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
