-- Deal Primary/Billing Contact picker (bc-aidp-next-golive#372). Common's "Common: Party Lookup People"
-- restricted to people who have a SalesContact row: Deal's contact FKs point at SalesContact, whose ID is
-- the Person's ID (IsA), so a person without one cannot be stored.
--
-- Result contract shared by every party lookup query: ID, Name, Detail; parameters Term (required) and
-- Domain (optional, set by the picker when the term looks like part of an email address).
-- Prefix matches on indexed base columns only, TOP 20, no view, no count: this is what keeps it under a
-- second on a party file of a million people. sqlLikeBegins escapes %, _ and [.
SELECT TOP 20
    p.ID,
    p.DisplayName AS Name,
    p.Email       AS Detail
FROM [__mj_BizAppsCommon].Person p
WHERE (
       p.LastName    LIKE {{ Term | sqlLikeBegins }}
    OR p.DisplayName LIKE {{ Term | sqlLikeBegins }}
    OR p.Email       LIKE {{ Term | sqlLikeBegins }}
    {% if Domain %}
    OR p.EmailDomain LIKE {{ Domain | sqlLikeBegins }}
    {% endif %}
)
  AND EXISTS (SELECT 1 FROM [__mj_BizAppsSales].SalesContact sc WHERE sc.ID = p.ID)
ORDER BY p.DisplayName, p.ID
