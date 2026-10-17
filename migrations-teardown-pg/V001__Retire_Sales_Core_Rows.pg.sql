-- =============================================================================================
-- PostgreSQL counterpart of migrations-teardown/V001__Retire_Sales_Core_Rows.sql
-- =============================================================================================
-- Written by hand from the T-SQL: the same 38 roots, the same engine, the same rules. See the
-- T-SQL header for the scope, the row deliberately left behind (`Default Company`), how the
-- engine decides between releasing and deleting a dependent, and the consequences of each.
-- `mj app remove` on a PostgreSQL host reads this directory (the teardown directory plus `-pg`).
--
-- HOW IT DIFFERS FROM THE T-SQL FILE, AND ONLY HOW
--   * Dependents are discovered from pg_constraint and pg_attribute instead of sys.foreign_keys;
--     a column's nullability is pg_attribute.attnotnull.
--   * The whole file is one DO block, so MJ still runs it as ONE statement inside ONE
--     transaction, as the T-SQL header requires. The temp tables are dropped at the end, as in
--     the T-SQL, for the case of several teardown files on one connection and one transaction.
--   * THROW becomes RAISE EXCEPTION with the same message; the plan is printed with RAISE NOTICE.
--   * This app's and the sibling apps' schema names are written lowercase, as PostgreSQL stores
--     them. Exactly one placeholder is substituted at teardown time: `${mjSchema}`.
-- =============================================================================================

DO $teardown$
DECLARE
  c_own_schema   CONSTANT TEXT := '__mj_bizappssales';
  c_max_passes   CONSTANT INT  := 25;
  c_max_relax    CONSTANT INT  := 50;
  v_pass         INT := 0;
  v_changed      INT := 1;
  v_rows         INT;
  v_relax        INT := 0;
  v_moved        INT := 1;
  v_lvl          INT;
  v_remaining    INT := 0;
  v_count        INT;
  r              RECORD;
BEGIN
  CREATE TEMP TABLE sales_doomed (
      schema_name TEXT NOT NULL,
      table_name  TEXT NOT NULL,
      row_id      UUID NOT NULL,
      depth       INT  NOT NULL,
      PRIMARY KEY (table_name, row_id)
  );

  INSERT INTO sales_doomed (schema_name, table_name, row_id, depth) VALUES
      -- Actions (ActionParam.ActionID is NOT NULL, so the 8 params follow automatically) and their
      -- category. ActionCategory's own dependents are all nullable, so nothing else is dragged in.
      ('${mjSchema}', 'Action',                  '5A1E5000-0000-4000-8000-000000000101', 0),  -- Sync Activities (retired; kept so a host that stopped before the retire migration still uninstalls)
      ('${mjSchema}', 'Action',                  '5A1E5000-0000-4000-8000-000000000111', 0),  -- Capture Forecast Snapshot
      ('${mjSchema}', 'Action',                  '5A1E5000-0000-4000-8000-000000000121', 0),  -- Log Activity
      ('${mjSchema}', 'Action',                  'A5EDE4FB-14FF-4BC3-9EAC-CE8B5B89F8B9', 0),  -- Detect Won Deals With Unconfirmed Orders
      ('${mjSchema}', 'ActionCategory',          '5A1E5000-0000-4000-8000-000000000001', 0),  -- Sales
      -- The Sales application. ApplicationEntity / ApplicationRole / UserApplication are NOT NULL
      -- children and follow automatically.
      ('${mjSchema}', 'Application',             'D4F8A162-A001-4E71-B0A8-3F17C5E2D803', 0),  -- Sales
      -- The 17 reporting queries. QueryEntity / QueryField / QueryParameter / QuerySQL /
      -- QueryPermission / QueryDependency all carry NOT NULL QueryID and follow automatically --
      -- 327 child rows on a fresh install, none of which is listed here for that reason.
      ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-000000000001', 0),  -- Sales: Pipeline Summary
      ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-000000000002', 0),  -- Sales: Forecast by Category
      ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-000000000003', 0),  -- Sales: Bookings by Period
      ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-000000000004', 0),  -- Sales: Win Rate by Count and Value
      ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-000000000005', 0),  -- Sales: Deal Cycle Time
      ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-000000000006', 0),  -- Sales: Stage Conversion and Dwell
      ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-000000000007', 0),  -- Sales: Slipped Deals
      ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-000000000008', 0),  -- Sales: Bookings by Owner
      ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-000000000009', 0),  -- Sales: Deal Involvement by Rep
      ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-00000000000A', 0),  -- Sales: Product Mix and Discount Depth
      ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-00000000000B', 0),  -- Sales: Deal Type Mix
      ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-00000000000C', 0),  -- Sales: Forecast History
      ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-00000000000D', 0),  -- Sales: Deal Roster
      ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-00000000000E', 0),  -- Sales: Dashboard Summary
      ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-00000000000F', 0),  -- Sales: Forecast by Owner
      ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-000000000010', 0),  -- Sales: Won Deals With Unconfirmed Orders
      ('${mjSchema}', 'Query',                   '5A1E5000-0001-4000-A000-000000000011', 0),  -- Sales: Deal Owners Without a Linked Login
      ('${mjSchema}', 'QueryCategory',           '5A1E5000-0000-4000-A000-000000000001', 0),  -- Sales
      ('${mjSchema}', 'Action',                  'DD7CEF7B-C75B-42F8-8D7A-45B9503A6D19', 0),  -- Relink Won Deal Orders To Contracts
      ('${mjSchema}', 'Action',                  '097952C6-0D37-4395-87FD-998AEDD8ECA4', 0),  -- Copy Default Pipeline To Companies
      -- Remote operations. `RemoteOperation.CategoryID` is nullable, so the category is listed
      -- explicitly rather than left to a cascade that would only release the reference.
      ('${mjSchema}', 'RemoteOperation',         'D4F8A162-0002-4E71-B0A8-3F17C5E2D802', 0),  -- Close Deal
      ('${mjSchema}', 'RemoteOperation',         'D4F8A162-0003-4E71-B0A8-3F17C5E2D802', 0),  -- Reopen Deal
      ('${mjSchema}', 'RemoteOperationCategory', 'D4F8A162-9C35-4E71-B0A8-3F17C5E2D801', 0),  -- Deal Lifecycle
      -- API scopes. APIApplicationScope.ScopeID and APIKeyScope.ScopeID are NOT NULL, so MJAPI's
      -- ceiling row and any key's grant follow; the child is listed too, since APIScope.ParentID
      -- is nullable and would otherwise only be released.
      ('${mjSchema}', 'APIScope',                '038C63C1-2247-47D8-ADFB-594666717C86', 0),  -- sales:write
      ('${mjSchema}', 'APIScope',                '080F5DDA-E5CD-444A-9D61-1A89AE5DF423', 0),  -- sales
      -- Scheduled jobs. `ScheduledJobRun.ScheduledJobID` is NOT NULL, so the run history follows.
      ('${mjSchema}', 'ScheduledJob',            '5A1E5000-0000-4000-8000-000000000201', 0),  -- Sales -- Activity Sync (hourly) (retired; same reason as the Action row)
      ('__mj_bizappscommon', 'ActivitySyncExtension', 'A7C4E2B1-5D83-4F0A-9C1E-6B8D2F4A90C3', 0),  -- Sales.DealLinker
      ('${mjSchema}', 'ScheduledJob',            '5A1E5000-0000-4000-8000-000000000202', 0),  -- Sales -- Forecast Snapshot (daily)
      ('${mjSchema}', 'ScheduledJob',            'FEB6F8D5-17B0-4AE6-BD8A-F0495F7CE36F', 0),  -- Sales -- Won Deals With Unconfirmed Orders (nightly)
      ('${mjSchema}', 'ScheduledJob',            'B1E51D67-B681-40F7-A2AD-FF84D2C2A6EC', 0),  -- Sales -- Relink Won Deal Orders To Contracts (daily)
      -- bizapps-tasks task types. NOT in our schema and not in core -- the seed reaches into a
      -- SIBLING app's schema, which is why that schema appears in the walk below. See the
      -- consequence noted in the header: `Task.TypeID` is NOT NULL.
      ('__mj_bizappstasks', 'TaskType',          '87ACA0BD-2FF6-493D-99B0-469D41825D1C', 0),  -- Order Review
      ('__mj_bizappstasks', 'TaskType',          '890C23F2-39D6-4075-8BA7-EC742A2D1CA8', 0);  -- Contract Processing

  -- ── The engine ──────────────────────────────────────────────────────────────────────────────
  -- Discovers dependents from the catalog at apply time rather than trusting a build-time
  -- ordering. Bounded, and it fails loudly rather than half-finishing.
  WHILE v_changed > 0 AND v_pass < c_max_passes LOOP
    v_pass := v_pass + 1;
    v_changed := 0;

    FOR r IN
      SELECT DISTINCT
             pn.nspname AS child_schema,
             pt.relname AS child_table,
             pa.attname AS child_col,
             rt.relname AS parent_table,
             -- EFFECTIVE nullability, not declared nullability. A row in OUR OWN schema is doomed
             -- whatever its column says, so it takes the delete branch below.
             CASE WHEN pn.nspname = c_own_schema THEN FALSE ELSE NOT pa.attnotnull END AS is_nullable
        FROM pg_constraint fk
        JOIN pg_class pt      ON pt.oid = fk.conrelid
        JOIN pg_namespace pn  ON pn.oid = pt.relnamespace
        JOIN pg_attribute pa  ON pa.attrelid = pt.oid AND pa.attnum = fk.conkey[1]
        JOIN pg_class rt      ON rt.oid = fk.confrelid
        JOIN pg_namespace rn  ON rn.oid = rt.relnamespace
        JOIN pg_attribute ra  ON ra.attrelid = rt.oid AND ra.attnum = fk.confkey[1]
       WHERE fk.contype = 'f'
         AND rn.nspname IN ('${mjSchema}', '__mj_bizappssales', '__mj_bizappstasks')
         AND ra.attname = 'ID'
         -- Single-column constraints only -- see the note on the levelling query.
         AND array_length(fk.conkey, 1) = 1
         -- Matched on SCHEMA **and** name: `TaskType` exists in both core and bizapps-tasks.
         AND EXISTS (SELECT 1 FROM sales_doomed d
                      WHERE d.table_name = rt.relname
                        AND d.schema_name = rn.nspname)
    LOOP
      IF r.is_nullable THEN
        -- Someone else's row that merely points at ours. Release the reference, keep the row.
        EXECUTE format(
          'UPDATE %I.%I SET %I = NULL WHERE %I IN (SELECT row_id FROM sales_doomed WHERE table_name = $1)',
          r.child_schema, r.child_table, r.child_col, r.child_col)
          USING r.parent_table;
      ELSE
        -- Cannot exist without the parent, so it is doomed too.
        EXECUTE format(
          'INSERT INTO sales_doomed (schema_name, table_name, row_id, depth)
           SELECT %L, %L, c."ID", $2
             FROM %I.%I c
            WHERE c.%I IN (SELECT row_id FROM sales_doomed WHERE table_name = $1)
              AND NOT EXISTS (SELECT 1 FROM sales_doomed d
                               WHERE d.table_name = %L AND d.row_id = c."ID")',
          r.child_schema, r.child_table, r.child_schema, r.child_table, r.child_col, r.child_table)
          USING r.parent_table, v_pass;
      END IF;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_changed := v_changed + v_rows;
    END LOOP;
  END LOOP;

  IF v_pass >= c_max_passes AND v_changed > 0 THEN
    RAISE EXCEPTION 'BizApps Sales teardown did not converge: the dependency graph is deeper than MAX_PASSES. Nothing has been committed.';
  END IF;

  -- ── Order the deletes by the FK graph, not by discovery order ───────────────────────────────
  -- A table sits one above every doomed table it references, and deletes run highest level
  -- first. Relaxation is bounded; a non-nullable cycle would otherwise spin. Keyed on SCHEMA +
  -- NAME, not name alone, for the `TaskType` reason given above.
  CREATE TEMP TABLE sales_level (
      schema_name TEXT NOT NULL,
      table_name  TEXT NOT NULL,
      lvl         INT  NOT NULL,
      PRIMARY KEY (schema_name, table_name)
  );

  INSERT INTO sales_level (schema_name, table_name, lvl)
  SELECT DISTINCT schema_name, table_name, 0 FROM sales_doomed;

  WHILE v_moved > 0 AND v_relax < c_max_relax LOOP
    v_relax := v_relax + 1;

    UPDATE sales_level child
       SET lvl = parent.lvl + 1
      FROM (
        SELECT DISTINCT
               pn.nspname AS child_schema, pt.relname AS child_table,
               rn.nspname AS parent_schema, rt.relname AS parent_table
          FROM pg_constraint fk
          JOIN pg_class pt      ON pt.oid = fk.conrelid
          JOIN pg_namespace pn  ON pn.oid = pt.relnamespace
          JOIN pg_attribute pa  ON pa.attrelid = pt.oid AND pa.attnum = fk.conkey[1]
          JOIN pg_class rt      ON rt.oid = fk.confrelid
          JOIN pg_namespace rn  ON rn.oid = rt.relnamespace
          JOIN pg_attribute ra  ON ra.attrelid = rt.oid AND ra.attnum = fk.confkey[1]
         WHERE fk.contype = 'f'
           AND ra.attname = 'ID'
           -- Same EFFECTIVE nullability rule as the discovery loop.
           AND (pa.attnotnull OR pn.nspname = c_own_schema)
           AND rn.nspname IN ('${mjSchema}', '__mj_bizappssales', '__mj_bizappstasks')
           -- Single-column constraints only, as MJ's EnumerateMjEntityFkGraph does.
           AND array_length(fk.conkey, 1) = 1
           AND pt.oid <> rt.oid
      ) edge,
      sales_level parent
     WHERE edge.child_table = child.table_name AND edge.child_schema = child.schema_name
       AND parent.table_name = edge.parent_table AND parent.schema_name = edge.parent_schema
       AND child.lvl <= parent.lvl;

    GET DIAGNOSTICS v_moved = ROW_COUNT;
  END LOOP;

  IF v_moved > 0 THEN
    RAISE EXCEPTION 'BizApps Sales teardown could not order its deletes within MAX_RELAX passes: either a non-nullable foreign-key CYCLE among the doomed tables, or a dependency chain deeper than the bound. Nothing has been committed.';
  END IF;

  -- Announce the plan before executing it.
  RAISE NOTICE 'BizApps Sales teardown plan (rows to remove from the shared core schema):';
  FOR r IN
    SELECT d.schema_name, d.table_name, COUNT(*) AS n
      FROM sales_doomed d GROUP BY d.schema_name, d.table_name ORDER BY COUNT(*) DESC
  LOOP
    RAISE NOTICE '  delete %.% x%', r.schema_name, r.table_name, r.n;
  END LOOP;

  SELECT MAX(lvl) INTO v_lvl FROM sales_level;
  WHILE v_lvl >= 0 LOOP
    FOR r IN SELECT schema_name, table_name FROM sales_level WHERE lvl = v_lvl LOOP
      -- Joined on schema as well as table name, as in the T-SQL.
      EXECUTE format(
        'DELETE FROM %I.%I t USING sales_doomed d
          WHERE d.row_id = t."ID" AND d.table_name = $1 AND d.schema_name = $2',
        r.schema_name, r.table_name)
        USING r.table_name, r.schema_name;
    END LOOP;
    v_lvl := v_lvl - 1;
  END LOOP;

  -- Postcondition: every seeded root is gone, asserted rather than assumed.
  FOR r IN SELECT DISTINCT schema_name, table_name FROM sales_doomed WHERE depth = 0 LOOP
    EXECUTE format(
      'SELECT COUNT(*) FROM %I.%I t JOIN sales_doomed d ON d.row_id = t."ID"
        WHERE d.table_name = $1 AND d.schema_name = $2',
      r.schema_name, r.table_name)
      INTO v_count
      USING r.table_name, r.schema_name;
    v_remaining := v_remaining + COALESCE(v_count, 0);
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'BizApps Sales teardown finished with seeded rows still present. Nothing has been committed.';
  END IF;

  DROP TABLE sales_doomed;
  DROP TABLE sales_level;
END $teardown$;
