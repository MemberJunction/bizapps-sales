#!/usr/bin/env node
/**
 * check-migration-column-sync.mjs
 *
 * A new migration that ALTERs an existing column must sync that entity's fields itself, and no new
 * migration may run the schema-wide field sync.
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────────
 * `omitRecurringScriptsFromLog` is true in mj.config.cjs (#345), so CodeGen no longer writes the
 * reconcilers it runs every pass into the migration it captures. One of those is
 * spUpdateExistingEntityFieldsFromSchema, which copies a column's length, type and nullability into
 * __mj.EntityField. Without it in the migration, every host installed from migrations keeps the old
 * values in EntityField, and nothing reports it: the column changed, the metadata did not.
 *
 * So a migration containing `ALTER COLUMN` must carry the entity-scoped form (a non-empty
 * `@EntityIDs`). The schema-wide form (no `@EntityIDs`, or an empty one) is refused in every new
 * migration: it reconciles entities the migration never touched, against whatever intermediate schema
 * a replay has reached. CLAUDE.md ("Migrations — additive only") states the rule.
 *
 * ── SCOPE ───────────────────────────────────────────────────────────────────────
 * SQL Server versioned migrations under `migrations/` that the change ADDS. Applied migrations are
 * never edited, so an older file is not re-judged, and `migrations-pg/` counterparts are converted
 * from these. Comments and string literals are masked before matching, so an `ALTER COLUMN` in a
 * comment does not count; the `@EntityIDs` value is read from the source at the masked position.
 *
 * Usage (from any directory inside the repository):
 *   node check-migration-column-sync.mjs                 # local form: added since merge-base(origin/next, HEAD), plus untracked
 *   node check-migration-column-sync.mjs <base> <head>   # CI form
 *   node check-migration-column-sync.mjs --self-test     # test fixtures
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { stripSqlComments } from './strip-sql-comments.mjs';

const RED = '\x1b[0;31m', YELLOW = '\x1b[0;33m', GREEN = '\x1b[0;32m', NC = '\x1b[0m';
const GIT_MAX_BUFFER = Number(process.env.MJ_GIT_MAX_BUFFER) || 256 * 1024 * 1024;

const MIGRATION_RE = /^migrations\/V\d{12}__[^/]*\.sql$/;
export const inScope = (f) => MIGRATION_RE.test(f);

const ALTER_COLUMN_RE = /\bALTER\s+COLUMN\b/i;
const FIELD_SYNC_RE = /\bspUpdateExistingEntityFieldsFromSchema\b/gi;
const ENTITY_IDS_RE = /@EntityIDs\s*=\s*N?'([^']*)'/i;

/** 1-indexed line of an offset. */
const lineOf = (text, offset) => text.slice(0, offset).split('\n').length;

/**
 * Judge one migration's SQL.
 *
 * @returns `{ alters, scoped, schemaWide }`: the lines with `ALTER COLUMN`, the lines with an
 *          entity-scoped field sync, and the lines with a schema-wide one.
 */
export function scanContent(rawSql) {
    const masked = stripSqlComments(rawSql);
    const result = { alters: [], scoped: [], schemaWide: [] };

    masked.split('\n').forEach((line, i) => {
        if (ALTER_COLUMN_RE.test(line)) result.alters.push(i + 1);
    });

    for (const m of masked.matchAll(FIELD_SYNC_RE)) {
        // The statement runs to its semicolon; a semicolon inside a string is masked out.
        const end = masked.indexOf(';', m.index);
        const statement = rawSql.slice(m.index, end === -1 ? rawSql.length : end);
        const ids = ENTITY_IDS_RE.exec(statement)?.[1]?.trim();
        (ids ? result.scoped : result.schemaWide).push(lineOf(rawSql, m.index));
    }
    return result;
}

/** The problems in one migration, as messages. Empty when it passes. */
export function problems(rawSql) {
    const { alters, scoped, schemaWide } = scanContent(rawSql);
    const out = [];
    for (const line of schemaWide) {
        out.push(`line ${line}: schema-wide spUpdateExistingEntityFieldsFromSchema; pass @EntityIDs for the entities this migration alters`);
    }
    if (alters.length > 0 && scoped.length === 0) {
        out.push(
            `line ${alters[0]}: ALTER COLUMN with no entity-scoped spUpdateExistingEntityFieldsFromSchema; ` +
                "add one after the entity's view refresh",
        );
    }
    return out;
}

const SCOPED = "EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2', @IncludedSchemaNames='${flyway:defaultSchema}';";
const SCHEMA_WIDE = "EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @IncludedSchemaNames='${flyway:defaultSchema}';";
const ALTER = 'ALTER TABLE [${flyway:defaultSchema}].[Deal] ALTER COLUMN [Name] NVARCHAR(400) NOT NULL;';

export const SELF_TEST_FIXTURES = [
    ['ALTER COLUMN with a scoped sync passes', true, `${ALTER}\nGO\n${SCOPED}`],
    ['ALTER COLUMN with no sync fails', false, ALTER],
    ['ALTER COLUMN with only a schema-wide sync fails', false, `${ALTER}\n${SCHEMA_WIDE}`],
    ['a schema-wide sync alone fails', false, SCHEMA_WIDE],
    ['an empty @EntityIDs is schema-wide', false, SCHEMA_WIDE.replace("@IncludedSchemaNames", "@EntityIDs='', @IncludedSchemaNames")],
    ['a sync split over lines is read whole', true, `${ALTER}\nEXEC [__mj].[spUpdateExistingEntityFieldsFromSchema]\n    @ExcludedSchemaNames='',\n    @EntityIDs='F363D8C9-FBDE-4DF5-99C6-D1543D3BD3B2';`],
    ['ALTER COLUMN in a comment does not count', true, `-- ALTER TABLE x ALTER COLUMN y INT\n/* ALTER COLUMN */\nCREATE TABLE t (ID INT);`],
    ['ALTER COLUMN in a string does not count', true, "SELECT 'ALTER COLUMN' AS Note;"],
    ['ADD COLUMN needs no sync', true, 'ALTER TABLE [x].[Deal] ADD [Note] NVARCHAR(100) NULL;'],
];

const SCOPE_TEST_FIXTURES = [
    ['a versioned migration is in scope', true, 'migrations/V202610191200__v6.18.x__Widen_Name.sql'],
    ['a PostgreSQL counterpart is not', false, 'migrations-pg/V202610191200__v6.18.x__Widen_Name.sql'],
    ['a baseline is not', false, 'migrations/B202608042100__v0.1.x__Schema.sql'],
    ['captured CodeGen output is not', false, 'migrations/codegen/V202610191200__run.sql'],
];

export function runSelfTest() {
    let failed = 0;
    const report = (name, ok) => {
        if (ok) {
            console.log(`${GREEN}PASS${NC} ${name}`);
        } else {
            console.error(`${RED}FAIL${NC} ${name}`);
            failed++;
        }
    };
    for (const [name, passes, sql] of SELF_TEST_FIXTURES) report(name, (problems(sql).length === 0) === passes);
    for (const [name, expected, path] of SCOPE_TEST_FIXTURES) report(name, inScope(path) === expected);
    if (failed > 0) {
        console.error(`\n${RED}Self-test failed: ${failed} fixture(s) failed.${NC}`);
        process.exit(1);
    }
    console.log(`\n${GREEN}Self-test passed: all fixtures behaved as expected.${NC}`);
}

function git(args, opts = {}) {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER, ...opts });
}

const lines = (text) => text.split('\n').map((f) => f.trim()).filter(Boolean);

/** Migrations the change adds: CI compares two commits; local adds untracked files. */
function addedMigrations(root, args) {
    if (args.length >= 2) {
        return lines(git(['diff', '--name-only', '--diff-filter=A', args[0], args[1]], { cwd: root })).filter(inScope);
    }
    const baseRef = process.env.BASE_REF || 'origin/next';
    let mergeBase;
    try {
        mergeBase = git(['merge-base', baseRef, 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch (err) {
        console.error(`${RED}✗ could not resolve base ref '${baseRef}'${NC}`);
        console.error(`  ${err.stderr?.toString().trim() || err.message}`);
        console.error('  Fetch it (e.g. `git fetch origin next`), or set BASE_REF to a ref that resolves.');
        process.exit(1);
    }
    const added = lines(git(['diff', '--name-only', '--diff-filter=A', mergeBase], { cwd: root }));
    const untracked = lines(git(['ls-files', '--others', '--exclude-standard'], { cwd: root }));
    return [...new Set([...added, ...untracked])].filter(inScope);
}

function main() {
    const args = process.argv.slice(2);
    if (args.includes('--self-test')) {
        runSelfTest();
        return;
    }
    const root = git(['rev-parse', '--show-toplevel']).trim();
    let violations = 0;
    for (const file of addedMigrations(root, args)) {
        const abs = join(root, file);
        if (!existsSync(abs)) continue;
        const found = problems(readFileSync(abs, 'utf8'));
        if (found.length === 0) continue;
        console.error(`${RED}✗ ${file}${NC}`);
        for (const p of found) console.error(`    ${YELLOW}${p}${NC}`);
        violations += found.length;
    }
    if (violations > 0) {
        console.error(`
${RED}A new migration's field sync is missing or schema-wide.${NC}
CodeGen no longer writes spUpdateExistingEntityFieldsFromSchema into migrations
(omitRecurringScriptsFromLog: true), so a migration that alters a column adds the
entity-scoped call itself, after the entity's view refresh:

  EXEC [\${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='', @EntityIDs='<entity ID>', @IncludedSchemaNames='\${flyway:defaultSchema}';

See CLAUDE.md, "Migrations — additive only".`);
        process.exit(1);
    }
    console.log(`${GREEN}✓ every new migration that alters a column syncs its entity's fields${NC}`);
}

const isEntry = () => {
    try {
        return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
    } catch {
        return false;
    }
};

if (isEntry()) {
    main();
}
