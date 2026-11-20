-- Deals whose owner-role team row names a Person instead of an Employee (#438).
--
-- The deal's owner is read from the owner-role row's EmployeeID. A row saved with a Person leaves the
-- deal with no owner (Deal.OwnerEmployeeID empty) while the team grid still shows someone in the owner
-- role. Saves like that are now refused, but rows saved before the refusal are still there, and every
-- later save of such a row is refused until it names an employee. This lists them so they can be
-- fixed on the deal's Internal team panel: pick the employee in Employee, which clears Person.
--
-- MatchingEmployeeID is a suggestion, not a fix: it is set only when exactly one employee has the
-- person's primary email. The person may be a partner rep with no employee record at all, and then
-- the owner has to be decided by someone who knows the deal.
--
-- OWNER ROLE IS DealRole.IsOwnerRole, never a role name. Open is DealStatusType.IsOpen; closed deals
-- are listed too, because a won deal with no owner has no one to credit.
SELECT
    d.ID                    AS DealID,
    d.DealNumber,
    d.Name                  AS DealName,
    d.CompanyID,
    d.Company               AS CompanyName,
    d.DealStatusType        AS StatusName,
    ISNULL(st.IsOpen, 0)    AS IsOpen,
    d.OwnerEmployeeID,
    tm.ID                   AS TeamMemberID,
    tm.DealRole             AS RoleName,
    tm.IsActive             AS TeamMemberActive,
    tm.PersonID,
    tm.Person               AS PersonName,
    p.PrimaryEmail          AS PersonEmail,
    CASE WHEN m.MatchCount = 1 THEN one.EmployeeID END AS MatchingEmployeeID,
    ISNULL(m.MatchCount, 0) AS MatchingEmployeeCount
FROM [__mj_BizAppsSales].vwDealTeamMembers tm
INNER JOIN [__mj_BizAppsSales].DealRole r
        ON r.ID = tm.DealRoleID
       AND r.IsOwnerRole = 1
INNER JOIN [__mj_BizAppsSales].vwDeals d
        ON d.ID = tm.DealID
LEFT JOIN [__mj_BizAppsSales].DealStatusType st
       ON st.ID = d.DealStatusTypeID
LEFT JOIN [__mj_BizAppsCommon].vwPeople p
       ON p.ID = tm.PersonID
OUTER APPLY (
    SELECT COUNT(*) AS MatchCount
    FROM [__mj].Employee e
    WHERE e.Email = p.PrimaryEmail
) m
OUTER APPLY (
    SELECT TOP 1 e.ID AS EmployeeID
    FROM [__mj].Employee e
    WHERE e.Email = p.PrimaryEmail
) one
WHERE tm.EmployeeID IS NULL
  AND tm.PersonID IS NOT NULL
  {% if CompanyID %}
  AND d.CompanyID = {{ CompanyID | sqlString }}
  {% endif %}
ORDER BY ISNULL(st.IsOpen, 0) DESC, d.DealNumber;
