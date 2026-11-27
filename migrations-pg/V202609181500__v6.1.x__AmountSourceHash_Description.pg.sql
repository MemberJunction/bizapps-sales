-- ============================================================================
-- PostgreSQL counterpart of migrations/V202609181500__v6.1.x__AmountSourceHash_Description.sql
-- Written by hand from the T-SQL; see its header for why the description changes and why the
-- schema description is the whole fix. The T-SQL updates the extended property when present and
-- adds it when not; COMMENT ON sets the column comment either way, so one statement covers both.
-- ============================================================================

COMMENT ON COLUMN __mj_bizappssales."Deal"."AmountSourceHash" IS 'Fingerprint of the embedded order''s line set Amount was computed from. Compare it against the current lines to detect a STALE amount, so the UI can say the products changed after the amount was calculated, instead of showing a number nobody can trace. Without this column Amount becomes a hand-edited field within a month.';
