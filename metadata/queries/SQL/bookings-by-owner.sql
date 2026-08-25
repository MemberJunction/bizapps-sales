-- Bookings by OWNER. Master plan §9.4, and the first half of a deliberate PAIR.
--
-- ══ ATTRIBUTION BASIS: OWNER-ROLE FILTER. EVERY DEAL COUNTED EXACTLY ONCE. ══════════════════════
--
-- This is the "bookings by AE" question. It answers: whose number is this?
--
-- The join is filtered to `DealRole.IsOwnerRole = 1`, a FLAG, so a deal with an AE, an SE and an SDR
-- contributes its amount once — to the AE. §9.4 names the alternative as a trap in as many words:
-- summing `Deal.Amount` across `DealTeamMember` unfiltered TRIPLE-COUNTS that deal, and the resulting
-- total looks plausible enough to survive a review.
--
-- THE OTHER HALF IS `deal-involvement-by-rep.sql`, weighted by AttributionPct. The two are not
-- variants of one report and must never be substituted for each other: this one sums to the company's
-- actual bookings, that one does not and is not meant to. §9.4: "There is no safe default that works
-- for both."
--
-- ══ EVERY MONEY COLUMN HERE IS ADDITIVE, AND THAT IS THE POINT OF THE OWNER FILTER ════════════
--
-- BookedAmount, LostAmount, BookedStatedAmount and the counts all total correctly across rows,
-- because the IsOwnerRole filter means each deal appears on exactly ONE row. WinRateByCount is the
-- single exception -- it is a ratio, and ratios never average across rows.
--
-- Contrast the paired report, `deal-involvement-by-rep.sql`, where most columns are NOT additive:
-- there a deal appears once per team member. Measured on the seeded won deal, its
-- WonAmountOfDealsTouched column totals 82,440 for a deal worth 27,480. This query is the one to
-- reach for whenever a figure has to reconcile.
--
-- WHY NOT `Deal.OwnerEmployeeID`, WHICH IS RIGHT THERE. Because it is a DENORMALISED STAMP — server
-- code derives it FROM the owner-role team row on every save, and CLAUDE.md is explicit that
-- DealTeamMember is the source of truth for membership, including the owner. Reading the stamp would
-- agree today and drift the moment a save path is added that forgets it. Reading the team row cannot
-- drift, because there is nothing for it to drift from.
--
-- DATE DIMENSION: ActualCloseDate — bookings belong to the period the deal actually closed in.
SELECT
    tm.EmployeeID,
    emp.FirstName + ' ' + emp.LastName          AS OwnerName,
    r.Name                                      AS OwnerRoleName,
    d.CompanyID,
    d.Company                                   AS CompanyName,
    d.PipelineID,
    d.Pipeline                                  AS PipelineName,
    SUM(CASE WHEN st.IsWon  = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS BookedAmount,
    SUM(CASE WHEN st.IsWon  = 1 THEN 1 ELSE 0 END)                   AS WonCount,
    SUM(CASE WHEN st.IsLost = 1 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS LostAmount,
    SUM(CASE WHEN st.IsLost = 1 THEN 1 ELSE 0 END)                   AS LostCount,
    CAST(SUM(CASE WHEN st.IsWon = 1 THEN 1 ELSE 0 END) AS DECIMAL(18, 4))
        / NULLIF(COUNT(*), 0)                                        AS WinRateByCount,
    SUM(CASE WHEN st.IsWon = 1 AND d.AmountIsComputed = 0 THEN ISNULL(d.Amount, 0) ELSE 0 END) AS BookedStatedAmount
FROM [__mj_BizAppsSales].vwDeals d
INNER JOIN [__mj_BizAppsSales].DealStatusType st
        ON st.ID = d.DealStatusTypeID
       AND st.IsClosed = 1
INNER JOIN [__mj_BizAppsSales].DealTeamMember tm
        ON tm.DealID = d.ID
       AND tm.IsActive = 1
INNER JOIN [__mj_BizAppsSales].DealRole r
        ON r.ID = tm.DealRoleID
       AND r.IsOwnerRole = 1          -- THE FILTER THAT MAKES THIS ONE-PER-DEAL. Do not remove.
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
    tm.EmployeeID, emp.FirstName, emp.LastName, r.Name,
    d.CompanyID, d.Company, d.PipelineID, d.Pipeline
ORDER BY
    BookedAmount DESC;
