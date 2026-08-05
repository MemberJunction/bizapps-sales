require('dotenv').config({ quiet: true });

/** @type {import('@memberjunction/config').MJConfig} */
module.exports = {
  /**
   * Database connection for the CLI tools that DON'T go through MJServer's config merging —
   * `mj test` and `mj sync` read these keys directly and fail with "Database configuration
   * missing" without them. Values come from .env, which stays the single place credentials live.
   */
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 1433,
  dbDatabase: process.env.DB_DATABASE,
  dbUsername: process.env.DB_USERNAME,
  dbPassword: process.env.DB_PASSWORD,
  dbTrustServerCertificate:
    process.env.DB_TRUST_SERVER_CERTIFICATE === '1' || process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  coreSchema: process.env.MJ_CORE_SCHEMA || '__mj',

  /**
   * MemberJunction CodeGen + server configuration for BizApps Sales.
   *
   * Minimal-distribution style: most settings come from package defaults
   * (@memberjunction/codegen-lib DEFAULT_CODEGEN_CONFIG, @memberjunction/server
   * DEFAULT_SERVER_CONFIG). Only deployment-specific settings live here.
   * Database/auth come from .env.
   */

  // ============================================================================
  // DEPLOYMENT-SPECIFIC CONFIGURATION (Required)
  // ============================================================================

  /**
   * Single-package (string) form: CodeGen generates THIS app's entity subclasses
   * into packages/Entities and everything imports them as
   * '@mj-biz-apps/sales-entities'.
   *
   * We intentionally do NOT use the schema->package MAP form that `mj app install`
   * writes. The map treats every listed schema as "external, skip local
   * generation" (CodeGenLib getExternalEntitySchemas), which is for pure OpenApp
   * consumers. This repo is the app under DEVELOPMENT: it generates the
   * __mj_BizAppsSales schema locally and pulls its dependencies (common, and later
   * orders/contracts) from their installed npm packages / soft UUID refs. Those
   * dependency schemas are kept out of CodeGen via excludeSchemas below.
   */
  entityPackageName: '@mj-biz-apps/sales-entities',

  /**
   * Additional schema info CodeGen can't infer from the DB. Declares the IsA
   * (Table-Per-Type) inheritance pairs (SalesAccount IS-A Organization,
   * SalesContact IS-A Person) so CodeGen sets Entity.ParentID, mirrors parent
   * fields as virtual fields on the child, and JOINs the parent in the child's
   * base view.
   */
  additionalSchemaInfo: 'codegen-schema-info.json',

  /**
   * Output paths for code generation (specific to this repo's layout).
   */
  output: [
    { type: 'SQL', directory: './SQL Scripts/generated', appendOutputCode: true },
    {
      type: 'Angular',
      directory: './packages/Angular/src/lib/generated',
      options: [{ name: 'maxComponentsPerModule', value: 20 }],
    },
    { type: 'GraphQLServer', directory: './packages/Server/src/generated' },
    { type: 'ActionSubclasses', directory: './packages/Actions/src/generated' },
    { type: 'EntitySubclasses', directory: './packages/Entities/src/generated' },
    { type: 'DBSchemaJSON', directory: './Schema Files' },
  ],

  /**
   * Build commands to run after code generation. Left EMPTY for the initial
   * scaffold: the first CodeGen run only needs to generate + persist entity
   * metadata. Package builds are run explicitly via `npm run build` once the
   * generated code exists.
   */
  commands: [],

  /**
   * Open App installer layout. This distribution puts its server/client apps
   * under apps/ (not the MJ-repo default of packages/MJAPI + packages/MJExplorer).
   */
  openApps: {
    serverPackagePath: 'apps/MJAPI',
    clientPackagePath: 'apps/MJExplorer',
  },

  // ============================================================================
  // CodeGen Overrides
  // ============================================================================

  newEntityDefaults: {
    NameRulesBySchema: [
      { SchemaName: '${mj_core_schema}', EntityNamePrefix: 'MJ: ' },
      // BizApps family convention (matches published bizapps-common /
      // bizapps-accounting / bizapps-orders). Prefixes this app's entities so
      // their MJ entity names are globally unambiguous, e.g.
      // 'MJ_BizApps_Sales: Deals'.
      { SchemaName: '__mj_BizAppsSales', EntityNamePrefix: 'MJ_BizApps_Sales: ', EntityNameSuffix: '' },
    ],
  },

  /**
   * Exclude core (__mj) AND every dependency schema.
   *
   * __mj_BizAppsCommon is the one that matters right now: sales takes REAL foreign keys into it
   * (SalesAccount.ID -> Organization.ID and SalesContact.ID -> Person.ID are the IsA links, which
   * are hard FKs by construction), but common's ENTITIES ship from its own published packages and
   * must not be regenerated here. Common's own migrations already registered them in __mj.Entity,
   * which is what lets the IsA declaration in codegen-schema-info.json resolve its parents.
   *
   * The orders/contracts schemas are listed ahead of need: DealLine.ProductID and Deal.ContractID
   * are SOFT references (no FK — DG-6), so those schemas may legitimately be absent from the
   * database entirely. Listing them is harmless when absent and correct when present.
   */
  excludeSchemas: [
    'sys',
    'staging',
    'dbo',
    '__mj',
    '__mj_BizAppsCommon',
    '__mj_BizAppsTasks',
    '__mj_BizAppsAccounting',
    '__mj_BizAppsOrders',
    '__mj_BizAppsContracts',
  ],

  /**
   * Integration testing. `mj test` loads these modules before resolving a
   * `MJ: Tests` record's check bundles, which is the extension seam MJ's testing
   * framework exposes for external adopters. Our package registers its bundles on
   * `IntegrationCheckRegistry` as an import side effect.
   *
   * NOTE the module must be resolvable from the CLI's location — run the WORKSPACE
   * cli (`./node_modules/.bin/mj`), never a globally installed one, which ships its
   * own published testing packages and cannot see this private package.
   *
   * REMINDER: RUN_MUTATION_TESTS=1 is mandatory or the suites run ZERO checks and
   * pass vacuously.
   */
  testing: {
    checkModules: ['@mj-biz-apps/sales-integration-tests'],
  },

  SQLOutput: {
    enabled: true,
    folderPath: './migrations/codegen/',
    appendToFile: false,
    convertCoreSchemaToFlywayMigrationFile: true,
    omitRecurringScriptsFromLog: false,
    schemaPlaceholders: [
      // Order matters: the more-specific schema must come first because
      // substitution runs sequentially with a greedy regex. If '__mj' were
      // first it would also match the '__mj' prefix of '__mj_BizAppsSales'.
      { schema: '__mj_BizAppsSales', placeholder: '${flyway:defaultSchema}' },
      { schema: '__mj', placeholder: '${mjSchema}' },
    ],
  },
};
