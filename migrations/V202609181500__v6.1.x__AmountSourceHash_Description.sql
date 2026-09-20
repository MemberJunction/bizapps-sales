/*
  Correct the `Deal.AmountSourceHash` column description, which names an action that does not exist.

  It reads: "... so the UI can say \"this figure is stale, reprice\" instead of showing a number
  nobody can trace." The UI has not said that since bc-aidp-next-golive#230, and there is no reprice
  control anywhere in this codebase -- the notice now reads "The products on this deal changed after
  the amount was calculated. Save the deal to update it."

  WHY THIS IS NOT AN EDIT TO THE BASELINE. The description lives in an extended property set by
  V202608042101, and that migration has been applied to databases nobody is going to rebuild --
  the UAT host among them. Editing an applied migration changes its checksum and Flyway refuses the
  whole run; the repo already states the principle in V202609020650's header, which was numbered
  before its partner deliberately "so no already-computed migration checksum changes". The
  BASELINE-IN-PLACE loop in CLAUDE.md is explicitly conditioned on being pre-publish, and this repo
  left that state at V202608251930 (the first Metadata_Sync).

  WHY THE EXTENDED PROPERTY IS THE WHOLE FIX. `EntityField.AutoUpdateDescription` is 1 for this
  column, so CodeGen syncs `__mj.EntityField.Description` from the schema. Measured on a live
  database: the row reads "the embedded order's line set", which is the extended property's wording
  and NOT the baseline's generated EntityField insert ("the DealLine set") -- so the schema is
  demonstrably the source that wins. The metadata row, and the GraphQL field description generated
  from it, follow on the next CodeGen run. Nothing is hand-written into `__mj.EntityField` here:
  PUBLISHING.md reserves that for the release Metadata_Sync, and `spUpdateEntityField` takes some
  thirty generated parameters that have no business being typed by hand.

  The schema is named literally, matching the property this replaces. Extended properties take the
  schema as a STRING argument, and V202608042101 wrote `N'__mj_BizAppsSales'` there; a placeholder
  would target a different object than the one being corrected on any host that did not install to
  the default schema.

  Idempotent: the property is updated when present and added when not, so a re-run and a host that
  somehow lacks it both succeed.
*/

IF EXISTS (
    SELECT 1
    FROM sys.extended_properties ep
    JOIN sys.columns c  ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
    JOIN sys.tables  t  ON t.object_id = c.object_id
    JOIN sys.schemas s  ON s.schema_id = t.schema_id
    WHERE ep.name = N'MS_Description'
      AND s.name  = N'__mj_BizAppsSales'
      AND t.name  = N'Deal'
      AND c.name  = N'AmountSourceHash'
)
    EXEC sp_updateextendedproperty
        @name = N'MS_Description',
        @value = N'Fingerprint of the embedded order''s line set Amount was computed from. Compare it against the current lines to detect a STALE amount, so the UI can say the products changed after the amount was calculated, instead of showing a number nobody can trace. Without this column Amount becomes a hand-edited field within a month.',
        @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsSales',
        @level1type = N'TABLE',  @level1name = N'Deal',
        @level2type = N'COLUMN', @level2name = N'AmountSourceHash';
ELSE
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Fingerprint of the embedded order''s line set Amount was computed from. Compare it against the current lines to detect a STALE amount, so the UI can say the products changed after the amount was calculated, instead of showing a number nobody can trace. Without this column Amount becomes a hand-edited field within a month.',
        @level0type = N'SCHEMA', @level0name = N'__mj_BizAppsSales',
        @level1type = N'TABLE',  @level1name = N'Deal',
        @level2type = N'COLUMN', @level2name = N'AmountSourceHash';
GO
