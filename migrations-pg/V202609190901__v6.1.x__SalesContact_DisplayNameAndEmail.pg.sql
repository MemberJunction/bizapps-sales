-- ============================================================================
-- PostgreSQL counterpart of migrations/V202609190901__v6.1.x__SalesContact_DisplayNameAndEmail.sql
-- Written by hand from the T-SQL: the application-owned wrapper view, its grants, the
-- DisplayNameAndEmail EntityField row and the single-name-field update. See the T-SQL header for
-- why the column is derived in the view and why it joins vwPeople.
--
-- HOW IT DIFFERS FROM THE T-SQL FILE, AND ONLY HOW
--   * CREATE OR REPLACE VIEW instead of DROP + CREATE. The CodeGen CRUD functions return SETOF
--     vwSalesContacts, so PostgreSQL refuses to drop the view without CASCADE, which would drop
--     them too. The wrapper's columns are the generated view's columns plus one at the end, which
--     is the change CREATE OR REPLACE allows, and the functions keep working.
--   * The role checks become a pg_roles lookup; each grant still runs only for a role that exists.
--   * Length is read from information_schema as in the T-SQL. PostgreSQL types the expression as
--     unbounded text, so the T-SQL's fallback of 1000 is what lands.
-- ============================================================================

CREATE OR REPLACE VIEW __mj_bizappssales."vwSalesContacts"
AS
SELECT
    g.*,
    CASE
        WHEN NULLIF(LTRIM(RTRIM(p."PrimaryEmail")), '') IS NULL
            THEN p."DisplayName"
        ELSE CONCAT(p."DisplayName", ' (', LTRIM(RTRIM(p."PrimaryEmail")), ')')
    END AS "DisplayNameAndEmail"
FROM
    __mj_bizappssales."vwSalesContactsGenerated" AS g
INNER JOIN
    __mj_bizappscommon."vwPeople" AS p
  ON
    g."ID" = p."ID";

-- Grants, because the T-SQL's DROP discards them; see its comment. CREATE OR REPLACE keeps the
-- existing grants, so these are no-ops on a host that already has them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cdp_UI') THEN
    GRANT SELECT ON __mj_bizappssales."vwSalesContacts" TO "cdp_UI";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cdp_Developer') THEN
    GRANT SELECT ON __mj_bizappssales."vwSalesContacts" TO "cdp_Developer";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cdp_Integration') THEN
    GRANT SELECT ON __mj_bizappssales."vwSalesContacts" TO "cdp_Integration";
  END IF;
END $$;

-- Register the derived column, and make it the entity's NAME field. See the T-SQL for why this
-- is an explicit INSERT, why Sequence is computed at apply time, and why the three AutoUpdate
-- flags are off.
INSERT INTO ${mjSchema}."EntityField"
    ("EntityID", "Sequence", "Name", "DisplayName", "Description",
     "Type", "Length", "AllowsNull", "IsVirtual", "IsNameField",
     "AllowUpdateAPI", "AllowUpdateInView", "IncludeInGeneratedForm",
     "AutoUpdateIsNameField", "AutoUpdateDisplayName", "AutoUpdateDescription")
SELECT
    e."ID",
    (SELECT COALESCE(MAX(f2."Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" f2 WHERE f2."EntityID" = e."ID"),
    'DisplayNameAndEmail',
    'Name and Email',
    'The contact''s display name, followed by their primary email in brackets when they have one. Derived in vwSalesContacts; this is what lookups to a Sales Contact show instead of a GUID.',
    'nvarchar',
    COALESCE((SELECT c.character_maximum_length FROM information_schema.columns c
               WHERE c.table_schema = '__mj_bizappssales'
                 AND c.table_name   = 'vwSalesContacts'
                 AND c.column_name  = 'DisplayNameAndEmail'), 1000),
    TRUE,    -- AllowsNull: a person with no email still has a name, and the expression never fails
    TRUE,    -- IsVirtual: it exists in the view only
    TRUE,    -- IsNameField: the entire point
    FALSE,   -- AllowUpdateAPI: derived, so there is nothing to write back to
    FALSE,   -- AllowUpdateInView
    FALSE,   -- IncludeInGeneratedForm: it repeats fields the form already shows
    FALSE,   -- AutoUpdateIsNameField
    FALSE,   -- AutoUpdateDisplayName
    FALSE    -- AutoUpdateDescription
FROM ${mjSchema}."Entity" e
WHERE e."Name" = 'MJ_BizApps_Sales: Sales Contacts'
  AND NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" f
         WHERE f."EntityID" = e."ID" AND f."Name" = 'DisplayNameAndEmail');

-- Exactly one name field per entity, asked as "anything that is not this one", as in the T-SQL.
UPDATE ${mjSchema}."EntityField" f
   SET "IsNameField" = FALSE
  FROM ${mjSchema}."Entity" e
 WHERE e."ID" = f."EntityID"
   AND e."Name" = 'MJ_BizApps_Sales: Sales Contacts'
   AND f."Name" <> 'DisplayNameAndEmail'
   AND f."IsNameField" = TRUE;
