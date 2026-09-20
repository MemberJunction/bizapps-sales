-- =============================================================================
-- V202609200100 — SELECT grants on the application-owned vwSalesContacts.
-- =============================================================================
-- V202609190901 DROPs and CREATEs `vwSalesContacts` as the layered wrapper, and
-- DROPPING A VIEW DISCARDS ITS PERMISSIONS. The view it replaced had them; the
-- new one is created bare.
--
-- ── THIS IS INSURANCE, NOT A REPAIR ────────────────────────────────────────────
--
-- CodeGen re-grants on exactly this kind of object. `codeGenDatabaseProvider`
-- describes its existence-guarded wrapper as being for "objects CodeGen refreshes
-- or GRANTS ON but does NOT create — specifically the application-owned outer view
-- of a layered entity", and a run against this database duly restored all three
-- roles. So on the documented install sequence (migrate -> codegen -> sync push)
-- the grants arrive without this file.
--
-- It ships anyway for the window in between, and for any path that applies
-- migrations WITHOUT a CodeGen run afterwards. Between V202609190901 and the next
-- CodeGen, no application role can read Sales Contacts — and the failure is
-- invisible to anyone testing as `sa`, which is how it went unnoticed until a
-- review asked what a non-privileged user sees.
--
-- bizapps-contracts grants explicitly in the migration that creates ITS layered
-- wrappers, for the same reason. Matching that is the point of this file: a
-- permission should not depend on a later, separate step having been run.
--
-- ── WHY NOT JUST EDIT V202609190901 ───────────────────────────────────────────
--
-- It is applied — flyway_schema_history has it at checksum -613052917. Changing
-- the file changes the checksum, and Flyway then reports the migration as altered
-- on every database that already ran it. Post-publish this repo is additive-only;
-- a new file is the only correct shape.
--
-- IDEMPOTENT AND GUARDED. `GRANT` on an existing grant is a no-op, and the whole
-- statement is skipped when the view is absent — which it legitimately is on a
-- database that has not reached the layering migrations yet.
-- =============================================================================

IF OBJECT_ID('[__mj_BizAppsSales].[vwSalesContacts]', 'V') IS NOT NULL
BEGIN
    -- Roles are granted individually so a deployment missing one of them still
    -- gets the other two, rather than failing the whole statement.
    IF DATABASE_PRINCIPAL_ID('cdp_UI') IS NOT NULL
        EXEC('GRANT SELECT ON [__mj_BizAppsSales].[vwSalesContacts] TO [cdp_UI]');
    IF DATABASE_PRINCIPAL_ID('cdp_Developer') IS NOT NULL
        EXEC('GRANT SELECT ON [__mj_BizAppsSales].[vwSalesContacts] TO [cdp_Developer]');
    IF DATABASE_PRINCIPAL_ID('cdp_Integration') IS NOT NULL
        EXEC('GRANT SELECT ON [__mj_BizAppsSales].[vwSalesContacts] TO [cdp_Integration]');
END
GO
