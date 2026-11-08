-- Deal owners whose employee record is not linked to exactly one login. Finance exception review,
-- golive #279.
--
-- A deal owner is an Employee, not a login. The finance exception check for won deals with an
-- unconfirmed order needs the owner's login, so the owner cannot clear an exception raised against
-- their own deal. It finds it through __mj.[User].EmployeeID, which is optional. An owner with no
-- linked login, or with more than one, makes that check raise the exception as creator unresolved,
-- and accounting refuses to clear it until the link is fixed. This lists who needs fixing, so the
-- links can be set up before the nightly job is enabled and checked afterwards.
--
-- LinkedLoginCount counts every login pointing at the employee, active or not: an inactive login is
-- still that person, so it resolves the owner the same way.
--
-- WON AND OPEN ARE DealStatusType.IsWon / IsOpen, never a status name. A deal with no status counts
-- only toward DealCount.
WITH owners AS (
    SELECT
        d.OwnerEmployeeID,
        MAX(d.OwnerEmployee)                              AS OwnerName,
        COUNT(*)                                          AS DealCount,
        SUM(CASE WHEN st.IsOpen = 1 THEN 1 ELSE 0 END)    AS OpenDealCount,
        SUM(CASE WHEN st.IsWon  = 1 THEN 1 ELSE 0 END)    AS WonDealCount
    FROM [__mj_BizAppsSales].vwDeals d
    LEFT JOIN [__mj_BizAppsSales].DealStatusType st
           ON st.ID = d.DealStatusTypeID
    WHERE d.OwnerEmployeeID IS NOT NULL
      {% if CompanyID %}
      AND d.CompanyID = {{ CompanyID | sqlString }}
      {% endif %}
    GROUP BY d.OwnerEmployeeID
)
SELECT
    o.OwnerEmployeeID,
    o.OwnerName,
    e.Email                   AS OwnerEmail,
    e.Active                  AS EmployeeActive,
    ISNULL(u.LinkedLoginCount, 0) AS LinkedLoginCount,
    o.DealCount,
    o.OpenDealCount,
    o.WonDealCount
FROM owners o
LEFT JOIN [__mj].Employee e
       ON e.ID = o.OwnerEmployeeID
OUTER APPLY (
    SELECT COUNT(*) AS LinkedLoginCount
    FROM [__mj].[User] lu
    WHERE lu.EmployeeID = o.OwnerEmployeeID
) u
WHERE ISNULL(u.LinkedLoginCount, 0) <> 1
ORDER BY o.WonDealCount DESC, o.OwnerName;
