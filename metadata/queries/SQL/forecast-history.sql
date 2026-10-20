-- Forecast history — what we THOUGHT the forecast was, on a past date. Master plan §9.4.
--
-- ══ THIS IS A DIFFERENT QUESTION FROM `forecast-by-category.sql`, NOT A VARIANT OF IT ═══════════
--
-- §9.4: "'What is the forecast' and 'what did we think the forecast was on the 1st' are different
-- queries. The first reads `Deal`; the second reads `ForecastSnapshot`."
--
-- The distinction is not stylistic. Reconstructing a past forecast from `Deal` is IMPOSSIBLE, not
-- merely inaccurate: amounts change, expected close dates move, deals are recategorised, and none of
-- those leave the current row carrying what it used to say. A forecast review that asks "we called
-- 4.2 million on the first — where did it go?" cannot be answered from live data at all.
--
-- So the answer has to be captured, not derived. The `Sales.CaptureForecastSnapshot` Action writes one
-- row per company × pipeline × owner × period, on a daily ScheduledJob. This query reads them.
--
-- THE ACTION IS THE WRITER (D-31): exactly one thing writes ForecastSnapshot, and
-- `scripts/capture-forecast-snapshot.sql` is a manual tool that is deliberately unseeded rather than a
-- second path. So "what grain do these rows have" is a question about WHICH QUERY THE ACTION READS.
--
-- It reads `Sales: Forecast by Owner` by default (D-32, #216), which groups by the deal's owner stamp. So
-- both LAG windows below partition by a real OwnerEmployeeID and the Employee join projects OwnerName.
-- A NULL owner is an unassigned deal. Snapshots captured from `Sales: Forecast by Category` instead carry
-- OwnerEmployeeID = NULL meaning "across all owners", and render as one partition with no owner names.
--
-- It is a COMPANION rather than a widened `Forecast by Category` deliberately: that query is published,
-- the dashboard consumes it, and changing a report's row shape to serve a second consumer is how one
-- consumer breaks another.
--
-- ══ THE COLUMN NAMES DIVERGE FROM THE MASTER PLAN, DELIBERATELY ════════════════════════════════
--
-- §9.5 lists the columns as `Commit` / `BestCase` / `Pipeline` / `Closed`. The shipped table has
-- `CommitAmount` / `BestCaseAmount` / `PipelineAmount` / `ClosedAmount`, and the shipped names are
-- authoritative — `docs/DECISIONS.md` D6. `COMMIT` is reserved in T-SQL and in Postgres, and
-- production is Postgres.
--
-- DATE DIMENSION: CapturedAt — when the picture was taken. PeriodStart/PeriodEnd describe which
-- period the snapshot was ABOUT, which is a different thing and is filtered separately.
--
-- CapturedOnOrBefore IS A BUSINESS DAY (#289). CapturedAt is a DATETIMEOFFSET and the parameter is
-- date-only, so comparing them directly put the bound at UTC midnight at the START of that day: "as
-- we saw it on the 1st" left out every snapshot taken on the 1st itself. The bound is now judged on
-- `[__mj_BizAppsCommon].[fnBusinessDayOf]()`, the business day of the instant — a function, not an
-- inline `AT TIME ZONE`, which MJ's SQL parser cannot read (see deal-cycle-time.sql). The padded UTC
-- bound beside it (two days past the date) is wider than any zone offset and only lets an index on
-- CapturedAt narrow the scan.
SELECT
    fs.CapturedAt,
    fs.PeriodStart,
    fs.PeriodEnd,
    fs.CompanyID,
    co.Name                                     AS CompanyName,
    fs.PipelineID,
    p.Name                                      AS PipelineName,
    fs.OwnerEmployeeID,
    emp.FirstName + ' ' + emp.LastName          AS OwnerName,
    fs.CommitAmount,
    fs.BestCaseAmount,
    fs.PipelineAmount,
    fs.ClosedAmount,
    -- Movement since the PREVIOUS capture for the same slice. This is the column a forecast review
    -- actually reads: not the level, but the change, and where it came from.
    fs.CommitAmount - LAG(fs.CommitAmount) OVER (
        PARTITION BY fs.CompanyID, fs.PipelineID, fs.OwnerEmployeeID, fs.PeriodStart
        ORDER BY fs.CapturedAt
    )                                           AS CommitChangeSincePrior,
    fs.ClosedAmount - LAG(fs.ClosedAmount) OVER (
        PARTITION BY fs.CompanyID, fs.PipelineID, fs.OwnerEmployeeID, fs.PeriodStart
        ORDER BY fs.CapturedAt
    )                                           AS ClosedChangeSincePrior
FROM [__mj_BizAppsSales].ForecastSnapshot fs
LEFT OUTER JOIN [__mj].Company co  ON co.ID  = fs.CompanyID
LEFT OUTER JOIN [__mj_BizAppsSales].Pipeline p ON p.ID = fs.PipelineID
LEFT OUTER JOIN [__mj].Employee emp ON emp.ID = fs.OwnerEmployeeID
WHERE 1 = 1
  {% if CompanyID %}
  AND fs.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
  {% if PipelineID %}
  AND fs.PipelineID = {{ PipelineID | sqlString }}
  {% endif %}
  -- The period the snapshot is ABOUT.
  {% if PeriodStart %}
  AND fs.PeriodStart >= {{ PeriodStart | sqlString }}
  {% endif %}
  {% if PeriodEnd %}
  AND fs.PeriodEnd <= {{ PeriodEnd | sqlString }}
  {% endif %}
  -- When the picture was TAKEN. "As we saw it on the 1st" is this filter, not the two above.
  {% if CapturedOnOrBefore %}
  AND fs.CapturedAt < DATEADD(day, 2, {{ CapturedOnOrBefore | sqlString }})
  AND [__mj_BizAppsCommon].[fnBusinessDayOf](fs.CapturedAt) <= {{ CapturedOnOrBefore | sqlString }}
  {% endif %}
ORDER BY
    fs.CapturedAt DESC, co.Name, p.Name;
