-- =============================================================================
-- V202609190901 — the application-owned WRAPPER view, and the name field it adds.
-- =============================================================================
-- The second half of the layered base view started in V202609190900. That file set
-- the flags and created CodeGen's inner view; this one creates the view the
-- application owns and tells MJ about the column it adds.
--
-- WHY IT IS A SEPARATE FILE FROM THE FLAGS. A view cannot be created before the view
-- it selects FROM — SQL Server has deferred name resolution for procedure bodies but
-- not for views — so vwSalesContactsGenerated has to be committed before
-- vwSalesContacts can compile. Same reason contracts' layering costs three files.
--
-- WHAT IS DERIVED, AND WHY IT IS NOT STORED. `DisplayNameAndEmail` is a projection of
-- facts the row already holds. A stored copy could only agree or lie, and the lie
-- would be silent: a contact who changed their email would keep introducing
-- themselves by the old one in every picker until someone noticed.
--
-- WHY IT JOINS vwPeople RATHER THAN RE-DERIVING THE TWO PARTS.
--
-- Both halves are COMPUTED IN COMMON'S VIEW, not stored on the Person table:
-- `DisplayName` comes out of common's own generated inner view, and `PrimaryEmail`
-- is `COALESCE(cm_email.Value, g.Email)` — a contact-method lookup with a fallback.
-- Re-deriving either here would copy common's rules into sales, where they would
-- drift the first time common changed one, and would put a second app in charge of
-- what a person is called. Reading the view cannot disagree with it.
--
-- The INNER JOIN is safe and is not a filter: vwSalesContactsGenerated already INNER
-- JOINs [__mj_BizAppsCommon].[Person] on the same key, because a SalesContact IS a
-- Person (same ID). A contact with no person row cannot exist to be dropped.
--
-- CONCAT, NOT `+`, ON THE NAME SIDE. `NULL + ' (' + email + ')'` is NULL, which would
-- have produced a BLANK name field — reintroducing the exact defect this migration
-- exists to fix, in the one case nobody would test. CONCAT treats NULL as empty. The
-- CASE still handles the email side explicitly, because "no email" must yield the
-- bare display name rather than a trailing empty bracket.
-- =============================================================================

IF OBJECT_ID('[__mj_BizAppsSales].[vwSalesContacts]', 'V') IS NOT NULL
    DROP VIEW [__mj_BizAppsSales].[vwSalesContacts];
GO

CREATE VIEW [__mj_BizAppsSales].[vwSalesContacts]
AS
SELECT
    g.*,
    CASE
        WHEN NULLIF(LTRIM(RTRIM(p.[PrimaryEmail])), '') IS NULL
            THEN p.[DisplayName]
        ELSE CONCAT(p.[DisplayName], ' (', LTRIM(RTRIM(p.[PrimaryEmail])), ')')
    END AS [DisplayNameAndEmail]
FROM
    [__mj_BizAppsSales].[vwSalesContactsGenerated] AS g
INNER JOIN
    [__mj_BizAppsCommon].[vwPeople] AS p
  ON
    g.[ID] = p.[ID];
GO

-- =============================================================================
-- Grants, because DROPPING A VIEW DISCARDS ITS PERMISSIONS.
-- =============================================================================
-- The DROP above takes the previous view's grants with it and CREATE makes a bare
-- one. CodeGen does re-grant on exactly this kind of object — its guard is
-- described as being for "objects CodeGen refreshes or GRANTS ON but does NOT
-- create — specifically the application-owned outer view of a layered entity" —
-- so on the documented install sequence (migrate -> codegen -> sync push) the
-- grants arrive anyway.
--
-- They are stated here for the window in between, and for any path that applies
-- migrations WITHOUT a CodeGen run afterwards: until that run, no application
-- role can read Sales Contacts. The failure is invisible to anyone connected as
-- `sa`, which is how it survived a day of testing. bizapps-contracts grants
-- explicitly in the migration that creates ITS layered wrappers, for the same
-- reason: a permission should not depend on a separate later step.
--
-- Each role is granted separately so a deployment missing one still gets the
-- others, and GRANT over an existing grant is a no-op.
-- =============================================================================

IF DATABASE_PRINCIPAL_ID('cdp_UI') IS NOT NULL
    EXEC('GRANT SELECT ON [__mj_BizAppsSales].[vwSalesContacts] TO [cdp_UI]');
IF DATABASE_PRINCIPAL_ID('cdp_Developer') IS NOT NULL
    EXEC('GRANT SELECT ON [__mj_BizAppsSales].[vwSalesContacts] TO [cdp_Developer]');
IF DATABASE_PRINCIPAL_ID('cdp_Integration') IS NOT NULL
    EXEC('GRANT SELECT ON [__mj_BizAppsSales].[vwSalesContacts] TO [cdp_Integration]');
GO

-- =============================================================================
-- Register the derived column, and make it the entity's NAME field.
-- =============================================================================
-- AN EXPLICIT INSERT, NOT A CODEGEN CAPTURE. A capture carries
-- spDeleteUnneededEntityFields sweeps that compare metadata against the LIVE base
-- view, so replaying one anywhere the wrapper did not yet exist DELETES the very row
-- it just inserted. Contracts hit this and moved to explicit INSERTs; this follows.
--
-- SEQUENCE IS COMPUTED AT APPLY TIME, never a literal. MJ's rule: the number CodeGen
-- writes is a placeholder that a REPEATABLE script renumbers, and Flyway runs every
-- versioned migration before any repeatable script — so on a from-scratch database a
-- literal never gets renumbered in time and collides on
-- UQ_EntityField_EntityID_Sequence, reporting itself as an unrelated foreign-key
-- error. It cannot fail on a working dev database; it fails only on fresh installs.
--
-- LENGTH IS READ FROM THE VIEW rather than guessed. The expression's width is SQL
-- Server's to decide, and a metadata Length that disagrees with the column is the
-- kind of quiet mismatch that shows up later as truncation in a grid.
-- =============================================================================

INSERT INTO [${mjSchema}].[EntityField]
    ([EntityID], [Sequence], [Name], [DisplayName], [Description],
     [Type], [Length], [AllowsNull], [IsVirtual], [IsNameField],
     [AllowUpdateAPI], [AllowUpdateInView], [IncludeInGeneratedForm],
     [AutoUpdateIsNameField], [AutoUpdateDisplayName], [AutoUpdateDescription])
SELECT
    e.[ID],
    (SELECT ISNULL(MAX(f2.[Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] f2 WHERE f2.[EntityID] = e.[ID]),
    'DisplayNameAndEmail',
    'Name and Email',
    'The contact''s display name, followed by their primary email in brackets when they have one. Derived in vwSalesContacts; this is what lookups to a Sales Contact show instead of a GUID.',
    'nvarchar',
    ISNULL((SELECT c.[CHARACTER_MAXIMUM_LENGTH] FROM [INFORMATION_SCHEMA].[COLUMNS] c
             WHERE c.[TABLE_SCHEMA] = '__mj_BizAppsSales'
               AND c.[TABLE_NAME]  = 'vwSalesContacts'
               AND c.[COLUMN_NAME] = 'DisplayNameAndEmail'), 1000),
    1,   -- AllowsNull: a person with no email still has a name, and the expression never fails
    1,   -- IsVirtual: it exists in the view only
    1,   -- IsNameField: the entire point
    0,   -- AllowUpdateAPI: derived, so there is nothing to write back to
    0,   -- AllowUpdateInView
    0,   -- IncludeInGeneratedForm: it repeats fields the form already shows
    /**
     * THE THREE AUTO-UPDATE FLAGS ARE OFF, and that is what makes this survive.
     *
     * They default to 1, which means the next CodeGen run RE-DERIVES each value from
     * the schema — and schema-derivation is exactly what produced no name field in
     * the first place, because no inherited column is called Name. Left on,
     * AutoUpdateIsNameField would quietly clear the flag on the next codegen and the
     * pickers would go back to GUIDs with nothing in the diff to explain it.
     */
    0,   -- AutoUpdateIsNameField
    0,   -- AutoUpdateDisplayName
    0    -- AutoUpdateDescription
FROM [${mjSchema}].[Entity] e
WHERE e.[Name] = 'MJ_BizApps_Sales: Sales Contacts'
  AND NOT EXISTS (
        SELECT 1 FROM [${mjSchema}].[EntityField] f
         WHERE f.[EntityID] = e.[ID] AND f.[Name] = 'DisplayNameAndEmail');
GO

-- Exactly one name field per entity. There is none today, so this is a no-op now and
-- a correction later — asked as "anything that is not this one", which survives a
-- future column that CodeGen decides to mark on its own.
UPDATE f
   SET f.[IsNameField] = 0
  FROM [${mjSchema}].[EntityField] f
  JOIN [${mjSchema}].[Entity] e ON e.[ID] = f.[EntityID]
 WHERE e.[Name] = 'MJ_BizApps_Sales: Sales Contacts'
   AND f.[Name] <> 'DisplayNameAndEmail'
   AND f.[IsNameField] = 1;
GO
