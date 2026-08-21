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
-- row per company × pipeline × period, on a daily ScheduledJob. This query reads them.
--
-- ⚠ OWNER GRAIN NEEDS THE COMPANION QUERY, and this query is built expecting it -- both LAG windows
-- below partition by OwnerEmployeeID and the Employee join projects OwnerName. `Sales: Forecast by
-- Category` groups by company and pipeline only, so an Action reading THAT writes every snapshot with
-- OwnerEmployeeID = NULL. That means "across all owners" and is correct for a rollup -- but it makes
-- this query render THIN rather than broken: one partition, no owner names, and nothing saying the
-- grain is absent rather than the data empty.
--
-- `Sales: Forecast by Owner` is the companion that closes it. Same measures, same flags, same date
-- split; it adds `OwnerEmployeeID` and `OwnerName` to the projection and nothing else. Point the
-- capture at that query and these windows partition by a real owner, with no change here and no
-- change to the Action -- its column mapping populates OwnerEmployeeID the moment a source query
-- projects it.
--
-- It is a COMPANION rather than a widened `Forecast by Category` deliberately: that query is
-- published, the dashboard consumes it, and changing a report's row shape to serve a second consumer
-- is how one consumer breaks another.
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
  AND fs.CapturedAt <= {{ CapturedOnOrBefore | sqlString }}
  {% endif %}
ORDER BY
    fs.CapturedAt DESC, co.Name, p.Name;
