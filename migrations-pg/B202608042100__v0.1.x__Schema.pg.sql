-- ============================================================================
-- PostgreSQL counterpart of migrations/B202608042100__v0.1.x__Schema.sql
-- Written by hand from the T-SQL: the schema and its __mj.SchemaInfo row. See the T-SQL header
-- for why these two live apart from the baseline tables.
-- The schema name is lowercase, as PostgreSQL stores it and as every later counterpart refers to
-- it; the SchemaInfo row carries that same name so CodeGen's prefix rule matches the schema.
-- ============================================================================

SET standard_conforming_strings = on;

-- 1. SCHEMA
CREATE SCHEMA IF NOT EXISTS __mj_bizappssales;

-- 2. SCHEMA INFO -- entity-name prefix for CodeGen (must match mj.config.cjs)
INSERT INTO ${mjSchema}."SchemaInfo"
(
  "ID",
  "SchemaName",
  "EntityIDMin", "EntityIDMax",
  "Comments",
  "Description",
  "EntityNamePrefix", "EntityNameSuffix"
)
SELECT
  'D4F1C86B-3A57-4E09-B21D-7C5E8F0A9B43',
  '__mj_bizappssales',
  1, 1000000,
  NULL,
  'MemberJunction: BizApps Sales — deal pipeline management',
  'MJ_BizApps_Sales: ', NULL
WHERE NOT EXISTS (SELECT 1 FROM ${mjSchema}."SchemaInfo" WHERE "SchemaName" = '__mj_bizappssales');
