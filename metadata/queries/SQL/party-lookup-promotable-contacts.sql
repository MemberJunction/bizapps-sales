-- Promote picker (D-PR3): the EXACT COMPLEMENT of "Sales: Party Lookup Contacts" -- people who do NOT
-- have a SalesContact row, and so cannot yet be named on a deal. The two queries differ in one token,
-- EXISTS against NOT EXISTS, and that is deliberate: a rep who cannot find a person in the contact picker
-- is looking at a person this query returns, and creating a duplicate is the failure this pair exists to
-- prevent (bc-aidp-next-golive#259).
--
-- WHY THIS IS A SEPARATE QUERY RATHER THAN A RELAXED FILTER ON THE OTHER ONE: the contact picker is
-- common's bizapps-party-field, which has no way to mark a row as unselectable and no BeforeSelect hook.
-- Returning a promotable person THERE would let a rep pick one, setting a deal's contact FK to a row the
-- server must refuse -- which is what PL1 asserts against. Promotion happens in a sales-owned dialog that
-- reads this query instead, so the picker's guarantee is untouched.
--
-- Result contract shared by every party lookup query: ID, Name, Detail; parameters Term (required) and
-- Domain (optional, set by the caller when the term looks like part of an email address).
-- Prefix matches on indexed base columns only, TOP 20, no view, no count. sqlLikeBegins escapes %, _ and [ (and drops a trailing %).
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
  AND NOT EXISTS (SELECT 1 FROM [__mj_BizAppsSales].SalesContact sc WHERE sc.ID = p.ID)
ORDER BY p.DisplayName, p.ID
