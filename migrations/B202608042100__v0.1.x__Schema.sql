-- =============================================================================
--  BizApps Sales — schema creation and CodeGen schema registration.
--
--  SPLIT FROM THE MAIN BASELINE so that the two things which must be true before any table
--  exists — the schema, and the __mj.SchemaInfo row that tells CodeGen how to name entities in
--  it — are established in their own committed transaction. Migrations run as ONE TRANSACTION
--  PER FILE (skyway wraps each file), and the sibling V file is the one that churns: it is
--  edited in place pre-release and carries the whole CodeGen output below its banner. Keeping
--  the schema registration out of that file means a rebuild can trim and regenerate the
--  generated half without ever touching the row CodeGen reads to decide entity names.
--
--  (bizapps-orders splits its baseline for a harder reason — a user-defined table type cannot be
--  created and then referenced by a compiling trigger inside one transaction without deadlocking.
--  Sales declares no table types at S1 and so does not have that problem; the split here is for
--  the reason above, and the file is named Schema.sql rather than Schema_and_Types.sql to say so.)
--
--  Everything else lives in the sibling V...__Tables_and_Objects.sql.
-- =============================================================================

-- =============================================================================
-- 1. SCHEMA
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = '__mj_BizAppsSales')
    EXEC('CREATE SCHEMA __mj_BizAppsSales');
GO

-- =============================================================================
-- 2. SCHEMA INFO — entity-name prefix for CodeGen (must match mj.config.cjs)
-- =============================================================================
-- The prefix here and the NameRulesBySchema entry in mj.config.cjs must agree. They are read at
-- different times by different tools — CodeGen reads the config when it GENERATES, MJ reads this
-- row when it RESOLVES an entity by name — so a mismatch produces entities that generate under
-- one name and are looked up under another, which presents as "entity not found" for an entity
-- plainly sitting in the metadata.
IF NOT EXISTS (SELECT 1 FROM __mj.SchemaInfo WHERE SchemaName = '__mj_BizAppsSales')
INSERT INTO __mj.SchemaInfo
(
  ID,
  SchemaName,
  EntityIDMin, EntityIDMax,
  Comments,
  Description,
  EntityNamePrefix, EntityNameSuffix
)
VALUES
(
  'D4F1C86B-3A57-4E09-B21D-7C5E8F0A9B43',
  '__mj_BizAppsSales',
  1, 1000000,
  NULL,
  'MemberJunction: BizApps Sales — deal pipeline management',
  'MJ_BizApps_Sales: ', NULL
);
GO
