-- Forecast by category, AT OWNER GRAIN. The live companion to `forecast-history.sql`.
--
-- ══ WHY THIS EXISTS AS A COMPANION RATHER THAN AS A CHANGE TO THE OTHER QUERY ═══════════════════
--
-- `forecast-by-category.sql` groups by company and pipeline. `forecast-history.sql` partitions its
-- LAG windows by `OwnerEmployeeID` and joins Employee for an owner name — it is built expecting owner
-- grain, and `capture-forecast-snapshot.sql` writes rows at that grain. So the history report is
-- already owner-shaped while nothing reports the LIVE forecast the same way, and a forecast review
-- that asks "whose commit moved" has a history to read and no current number to compare it against.
--
-- Adding an owner column to the existing query would have been the smaller diff and the wrong change:
-- the dashboard consumes it, and widening a report's GROUP BY changes its row shape for every
-- consumer. One report gaining a dimension should not be another report's regression.
--
-- Same measures, same flags, same date handling as `forecast-by-category.sql`. Only the grain differs.
--
-- ══ §9.4 ATTRIBUTION BASIS: THE OWNER STAMP. EACH DEAL COUNTED EXACTLY ONCE. ════════════════════
--
-- This groups by `Deal.OwnerEmployeeID`, the server-maintained stamp, NOT by joining
-- `DealTeamMember`. Both halves of that matter:
--
--   ONE ROW PER DEAL. Joining the team table would multiply every deal by its team size — the seeded
--   won deal has three members, so its 27,480 would land in three owners' commit figures and the
--   company total would read 82,440. That is §9.4's double-count arriving through a forecast rather
--   than through a bookings report, and a forecast is where it would be least likely to be noticed,
--   because nobody reconciles a forecast to the penny.
--
--   IT MATCHES THE SNAPSHOT. `capture-forecast-snapshot.sql` groups by the same stamp for the same
--   reason, so this query and the history it is compared against slice the world identically. A live
--   report and its own history disagreeing about what an owner's commit is would be worse than having
--   no live report at all.
--
-- WHY THE STAMP IS SAFE HERE WHEN `bookings-by-owner.sql` DELIBERATELY AVOIDS IT. That query is a
-- reconciling revenue figure, so it reads `DealTeamMember` filtered to `DealRole.IsOwnerRole` —
-- CLAUDE.md makes the team table the source of truth for membership, and a bookings number must not
-- depend on a denormalised copy. This is a forecast SLICE: it groups deals BY an owner, it does not
-- attribute revenue TO one, and the stamp is derived from that same owner-role row on every save. If
-- the two ever disagree, the stamp is the bug and the team table is right — but the answer here would
-- still be a grouping, not a misstated total.
--
-- ══ ADDITIVITY ACROSS ROWS ═════════════════════════════════════════════════════════════════════
--
--   ADDITIVE      CommitAmount, BestCaseAmount, PipelineAmount, ClosedWonAmount, and every count.
--                 One deal, one row, so totalling any of them returns the company figure.
--   NOT ADDITIVE  The three forecast buckets ACROSS EACH OTHER — they overlap by design, since a
--                 commit category normally also counts toward best case and pipeline. Summing
--                 Commit + BestCase + Pipeline is meaningless in any grouping.
--
-- DATE DIMENSION: open deals placed by ExpectedCloseDate, won deals by ActualCloseDate — the same
-- split `forecast-by-category.sql` uses, because each answers a different question.
SELECT
    d.OwnerEmployeeID,
    -- An unowned deal is a real state, not a row to drop: it is forecast nobody is accountable for,
    -- which is exactly what a forecast review should see.
    ISNULL(emp.FirstName + ' ' + emp.LastName, '(unassigned)') AS OwnerName,
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
    SUM(CASE WHEN st.IsWon  = 1 THEN 1 ELSE 0 END)                                                 AS WonDealCount,
    SUM(CASE WHEN st.IsOpen = 1 AND d.ForecastCategoryTypeID IS NULL THEN 1 ELSE 0 END)            AS UncategorizedOpenCount,
    -- Provenance, at the grain a forecast review actually argues about. A commit figure nobody priced
    -- is a different kind of claim from one the orders engine produced, and this is the report where
    -- somebody is asked to stand behind the number.
    SUM(CASE WHEN st.IsOpen = 1 AND d.AmountIsComputed = 0 THEN ISNULL(d.Amount, 0) ELSE 0 END)    AS OpenStatedAmount
FROM [__mj_BizAppsSales].vwDeals d
INNER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
LEFT OUTER JOIN [__mj_BizAppsSales].ForecastCategoryType fc
        ON fc.ID = d.ForecastCategoryTypeID
       AND fc.IsActive = 1
LEFT OUTER JOIN [__mj].Employee emp
        ON emp.ID = d.OwnerEmployeeID
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
    d.OwnerEmployeeID, emp.FirstName, emp.LastName,
    d.CompanyID, d.Company, d.PipelineID, d.Pipeline
ORDER BY
    CommitAmount DESC, OwnerName;
