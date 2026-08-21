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
-- AN EARLIER VERSION OF THIS COMMENT PROMISED AN "AttributionCoveragePct" COLUMN. It does not
-- exist, and the fix is to delete the promise rather than add the column: coverage is a property of a
-- DEAL (do its members' shares total 100?), and this query groups by REP. A per-rep row has no
-- coverage to report, so the column could only ever have been misleading here.
--
-- `UnstatedAttributionCount` below is the part of that intent this grain CAN honestly carry: it
-- counts members whose share was never stated, which is the most common cause of coverage being off.
--
-- Deal-level coverage belongs in a deal-grained report. It is not built; noted so the next person
-- reads an absence rather than a broken reference.
--
-- ══ WHICH COLUMNS ARE ADDITIVE ACROSS ROWS, BECAUSE ONLY SOME ARE ═════════════════════════════
--
--   ADDITIVE      WeightedWonAmount -- shares of a deal, so totalling them returns the deal.
--   ADDITIVE      UnstatedAttributionCount -- a count of member rows, and rows are what this grain is.
--   NOT ADDITIVE  WonAmountOfDealsTouched -- the whole deal, repeated per member. See its note.
--   NOT ADDITIVE  DealsInvolvedIn / WonDealsInvolvedIn -- one deal counts once per member who touched it.
--   NOT ADDITIVE  AvgAttributionPct -- an average; averaging averages across reps is not an average.
--
-- Stated here rather than left to a reader's judgement because the failure is silent: every one of
-- those non-additive columns produces a plausible-looking number when summed.
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
    /**
     * NOT ADDITIVE ACROSS ROWS. Renamed from "UnweightedWonAmount", which read like something you
     * could total up. It is the FULL value of the deals this rep touched, repeated in full on every
     * member's row -- so summing the column across reps multiplies each shared deal by its team size.
     *
     * Measured on the seeded won deal: 27,480 split 60/25/15 gives 16,488 + 6,870 + 4,122, which sums
     * back to 27,480 exactly. The same deal contributes 27,480 to all three rows here, so summing
     * this column gives 82,440 -- three times a deal that was worth 27,480 once. That is §9.4's
     * double-count, arriving through a column name rather than through a missing filter.
     */
    SUM(CASE WHEN st.IsWon = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS WonAmountOfDealsTouched,
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
