-- Deal involvement by rep, ATTRIBUTION-WEIGHTED. Master plan §9.4, the second half of the pair.
--
-- ══ ATTRIBUTION BASIS: WEIGHTED BY DealTeamMember.AttributionPct. CREDIT IS SPLIT. ══════════════
--
-- This is the "deals I was involved in" question. It answers: who contributed to this, and how much?
--
-- Every active team member appears — AE, SE, SDR, partner rep — and each one's share of the deal is
-- `Amount * AttributionPct / 100`. That is a CREDIT SPLIT, not a booking. It exists so an SE who
-- supported nine deals is visible at all, which the owner-filtered report cannot show by design.
--
-- ══ THIS DOES NOT SUM TO THE COMPANY'S BOOKINGS, AND THAT IS NOT A BUG ══════════════════════════
--
-- Nothing constrains a deal's AttributionPct values to total 100. If a deal's three members carry 60
-- / 30 / 30, this reports 120% of it; if they carry 50 / 20, it reports 70%. Both are legitimate
-- statements about credit and neither is a statement about revenue.
--
-- ── WHAT ACTUALLY EXPOSES THAT, AND A CORRECTION ────────────────────────────────────────────────
--
-- This comment used to promise an `AttributionCoveragePct` column. THERE IS NO SUCH COLUMN — the SELECT
-- ships `AvgAttributionPct` and `UnstatedAttributionCount`. Caught by seeding the demo data these
-- reports read and then looking at the output instead of the comment. Corrected here rather than by
-- adding the column, because a per-rep row is the wrong grain for a coverage ratio: coverage is a
-- property of a DEAL (do its members' shares total 100?), and this query groups by rep. A row saying
-- "this rep averaged 27.5%" cannot tell you which deal was over-attributed.
--
-- So the honest position: `AvgAttributionPct` and `UnstatedAttributionCount` tell a reader that shares
-- are unstated or unusual and worth investigating. A per-deal coverage report is a separate query that
-- does not exist yet; DECISIONS-NEEDED.md records it rather than leaving this comment implying it is
-- here. A silent 120% is still precisely the double-count §9.4 warns about, and the fix is still to make
-- it visible rather than to normalise it here and hide a data-entry problem.
--
-- USE `bookings-by-owner.sql` FOR ANY NUMBER THAT HAS TO RECONCILE — a board figure, a commission
-- input, an accounting tie-out. Use this one for coverage and involvement. §9.4: "There is no safe
-- default that works for both."
--
-- NULL AttributionPct IS TREATED AS ZERO CREDIT, NOT AS FULL CREDIT. A member nobody assigned a share
-- to has an unstated contribution, and inventing 100 for them would manufacture the exact overcount
-- this query is built to expose. They still appear, with their zero visible.
--
-- DATE DIMENSION: ActualCloseDate.
SELECT
    tm.EmployeeID,
    emp.FirstName + ' ' + emp.LastName          AS RepName,
    tm.DealRoleID,
    r.Name                                      AS RoleName,
    r.IsOwnerRole,
    d.CompanyID,
    d.Company                                   AS CompanyName,
    COUNT(*)                                    AS DealsInvolvedIn,
    SUM(CASE WHEN st.IsWon = 1 THEN 1 ELSE 0 END) AS WonDealsInvolvedIn,
    -- The weighted credit. Amount and AttributionPct are both stored values; this splits a figure,
    -- it does not price anything.
    SUM(CASE WHEN st.IsWon = 1
             THEN ISNULL(d.Amount, 0) * ISNULL(tm.AttributionPct, 0) / 100.0
             ELSE 0 END)                        AS WeightedWonAmount,
    SUM(CASE WHEN st.IsWon = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS UnweightedWonAmount,
    AVG(CAST(ISNULL(tm.AttributionPct, 0) AS FLOAT))                AS AvgAttributionPct,
    SUM(CASE WHEN tm.AttributionPct IS NULL THEN 1 ELSE 0 END)      AS UnstatedAttributionCount
FROM [__mj_BizAppsSales].vwDeals d
INNER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
       AND st.IsClosed = 1
INNER JOIN [__mj_BizAppsSales].DealTeamMember tm
        ON tm.DealID = d.ID
       AND tm.IsActive = 1
       -- NO IsOwnerRole FILTER. Its absence is the definition of this report, not an omission.
INNER JOIN [__mj_BizAppsSales].DealRole r
        ON r.ID = tm.DealRoleID
LEFT OUTER JOIN [__mj].Employee emp
        ON emp.ID = tm.EmployeeID
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
GROUP BY
    tm.EmployeeID, emp.FirstName, emp.LastName, tm.DealRoleID, r.Name, r.IsOwnerRole,
    d.CompanyID, d.Company
ORDER BY
    WeightedWonAmount DESC;
