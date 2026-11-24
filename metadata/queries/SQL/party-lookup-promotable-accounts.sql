-- Promote picker (D-PR3): the EXACT COMPLEMENT of "Sales: Party Lookup Accounts" -- organizations that
-- do NOT have a SalesAccount row, and so cannot yet be a deal's customer. The two queries differ in one
-- token, EXISTS against NOT EXISTS, and that is deliberate: a rep who cannot find a company in the
-- account picker is looking at a company this query returns, and creating a duplicate is the failure
-- this pair exists to prevent (bc-aidp-next-golive#259).
--
-- WHY THIS IS A SEPARATE QUERY RATHER THAN A RELAXED FILTER ON THE OTHER ONE: the account picker is
-- common's bizapps-party-field, which has no way to mark a row as unselectable and no BeforeSelect hook.
-- Returning a promotable organization THERE would let a rep pick one, setting Deal.AccountID to a row the
-- server must refuse -- which is what PL1 and PL3 assert against. Promotion happens in a sales-owned
-- dialog that reads this query instead, so the picker's guarantee is untouched.
--
-- Result contract shared by every party lookup query: ID, Name, Detail; parameters Term (required) and
-- Domain (optional, set by the caller when the term looks like a web address).
-- Prefix matches on indexed base columns only, TOP 20, no view, no count. sqlLikeBegins escapes %, _ and [ (and drops a trailing %).
-- Detail shows the acronym and the website domain ("NAR · nar.realtor"), whichever exist, so two
-- organizations with the same name can be told apart. Each operand goes through NULLIF so a stored empty
-- string is skipped like NULL (CONCAT_WS skips NULLs only).
SELECT TOP 20
    o.ID,
    o.Name,
    NULLIF(CONCAT_WS(N' · ', NULLIF(o.Acronym, N''), NULLIF(o.WebsiteDomain, N'')), N'') AS Detail
FROM [__mj_BizAppsCommon].Organization o
WHERE (
       o.Name      LIKE {{ Term | sqlLikeBegins }}
    OR o.LegalName LIKE {{ Term | sqlLikeBegins }}
    OR o.Acronym   LIKE {{ Term | sqlLikeBegins }}
    {% if Domain %}
    OR o.WebsiteDomain LIKE {{ Domain | sqlLikeBegins }}
    {% endif %}
)
  AND NOT EXISTS (SELECT 1 FROM [__mj_BizAppsSales].SalesAccount sa WHERE sa.ID = o.ID)
ORDER BY o.Name, o.ID
