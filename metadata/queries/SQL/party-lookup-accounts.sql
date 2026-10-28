-- Deal Account picker (bc-aidp-next-golive#372). Common's "Common: Party Lookup Organizations" restricted
-- to organizations that have a SalesAccount row: Deal.AccountID points at SalesAccount, whose ID is the
-- Organization's ID (IsA), so an organization without one cannot be stored.
--
-- Result contract shared by every party lookup query: ID, Name, Detail; parameters Term (required) and
-- Domain (optional, set by the picker when the term looks like a web address).
-- Prefix matches on indexed base columns only, TOP 20, no view, no count. sqlLikeBegins escapes %, _ and [ (and drops a trailing %).
-- Detail shows the acronym and the website domain ("NAR · nar.realtor"), whichever exist, so two accounts
-- with the same name or acronym can be told apart.
SELECT TOP 20
    o.ID,
    o.Name,
    NULLIF(CONCAT_WS(N' · ', o.Acronym, o.WebsiteDomain), N'') AS Detail
FROM [__mj_BizAppsCommon].Organization o
WHERE (
       o.Name      LIKE {{ Term | sqlLikeBegins }}
    OR o.LegalName LIKE {{ Term | sqlLikeBegins }}
    OR o.Acronym   LIKE {{ Term | sqlLikeBegins }}
    {% if Domain %}
    OR o.WebsiteDomain LIKE {{ Domain | sqlLikeBegins }}
    {% endif %}
)
  AND EXISTS (SELECT 1 FROM [__mj_BizAppsSales].SalesAccount sa WHERE sa.ID = o.ID)
ORDER BY o.Name, o.ID
