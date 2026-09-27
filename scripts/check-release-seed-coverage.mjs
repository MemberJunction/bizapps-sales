#!/usr/bin/env node
/**
 * Release-readiness: is the metadata under metadata/ what shipped migrations/*.sql will write?
 *
 * Two checks:
 *
 *   1. COVERAGE — every primaryKey UUID declared under metadata/ appears in some migration.
 *   2. QUERY SQL CURRENCY — for every record whose SQL is `@file:`, the SQL the LATEST migration
 *      seeds for that record's ID equals the file. Check 1 cannot see this: a query's ID is in the
 *      migration that first created it, so an edited query passes coverage forever while every
 *      installed database keeps the old SQL (bizapps-sales#137 — upgraded installs kept the 5.2.0
 *      roster, and the dashboard read Weighted open as $0).
 *
 * A RELEASE GATE, NOT A PR GATE. PRs contribute JSON only; the build engineer generates one
 * Metadata_Sync per release, so between releases this fails by design. `publish.yml` runs it;
 * `verify` and the distribution-gate workflow do not.
 *
 *   node scripts/check-release-seed-coverage.mjs [repo-root]
 *
 * Exit 1 lists what the next Metadata_Sync must carry.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.argv[2] ? resolve(process.argv[2]) : join(dirname(fileURLToPath(import.meta.url)), '..');
const METADATA = join(ROOT, 'metadata');
const MIGRATIONS = join(ROOT, 'migrations');
const IGNORED_DIRS = new Set(['sql_logging', '.backups']);

/**
 * Records deliberately left out of the release Metadata_Sync. Each entry names the issue that ships
 * it; remove the entry in that issue's PR. Keyed by UPPERCASE ID.
 */
const HELD_BACK = new Map(
    [
        'C1A02E75-4C6E-49B0-96F3-79D1A8E23001', // ML training pipeline
        'C1A02E75-4C6E-49B0-96F3-79D1A8E23011', // ML model v1
        'C1A02E75-4C6E-49B0-96F3-79D1A8E23012', // ML model v2
        'C1A02E75-4C6E-49B0-96F3-79D1A8E23013', // ML model v3
        'C1A02E75-4C6E-49B0-96F3-79D1A8E23050', // record process (scheduled scoring)
        'C1A02E75-4C6E-49B0-96F3-79D1A8E23060', // ML model scoring binding
    ].map((id) => [id, 'bizapps-sales#138']),
);

function walkJson(dir, acc = []) {
    for (const name of readdirSync(dir).sort()) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            if (!IGNORED_DIRS.has(name)) walkJson(full, acc);
        } else if (name.endsWith('.json') && name !== '.mj-sync.json') {
            acc.push(full);
        }
    }
    return acc;
}

const UUID =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Every record node carrying a UUID primaryKey, at any depth (relatedEntities included). */
function collectRecords(node, acc) {
    if (Array.isArray(node)) {
        for (const item of node) collectRecords(item, acc);
        return;
    }
    if (!node || typeof node !== 'object') return;
    const pk = node.primaryKey;
    if (pk && typeof pk.ID === 'string' && UUID.test(pk.ID.trim())) acc.push(node);
    for (const value of Object.values(node)) collectRecords(value, acc);
}

const relativePath = (file) => relative(ROOT, file).split(sep).join('/');

// Filename order is Flyway's apply order for this directory (B baseline, then V by timestamp).
const migrations = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ name: f, text: readFileSync(join(MIGRATIONS, f), 'utf8') }));
const allSqlLower = migrations.map((m) => m.text).join('\n').toLowerCase();

const jsonFiles = walkJson(METADATA).map((file) => {
    const records = [];
    collectRecords(JSON.parse(readFileSync(file, 'utf8')), records);
    return { file, records };
});

// ── 1. Coverage ─────────────────────────────────────────────────────────────────────────────

function uncoveredIds() {
    const missing = [];
    for (const { file, records } of jsonFiles) {
        const ids = [...new Set(records.map((r) => r.primaryKey.ID.trim().toUpperCase()))];
        const unseen = ids.filter((id) => !HELD_BACK.has(id) && !allSqlLower.includes(id.toLowerCase()));
        if (unseen.length) missing.push({ file: relativePath(file), unseen });
    }
    return missing;
}

// ── 2. Query SQL currency ───────────────────────────────────────────────────────────────────

/**
 * Reads a T-SQL N'...' literal starting at `start` (the index of the opening quote). `''` is an
 * escaped quote; a lone `'` ends the literal.
 */
function readNString(text, start) {
    let out = '';
    for (let i = start + 1; i < text.length; i++) {
        if (text[i] !== "'") {
            out += text[i];
        } else if (text[i + 1] === "'") {
            out += "'";
            i++;
        } else {
            return out;
        }
    }
    throw new Error(`unterminated string literal at offset ${start}`);
}

/**
 * The SQL each migration seeds per record ID. The generator binds every column of a record to a
 * variable sharing one suffix — `@ID_2bbbe86f = '<uuid>'` beside `@SQL_2bbbe86f = N'...'` — for
 * spCreateQuery and spUpdateQuery alike. Later migrations overwrite earlier ones, as they would in a
 * database.
 */
function seededSqlById() {
    const seeded = new Map();
    for (const { name, text } of migrations) {
        for (const idMatch of text.matchAll(/@ID_(\w+)\s*=\s*'([0-9A-Fa-f-]{36})'/g)) {
            const [, suffix, id] = idMatch;
            const sqlMatch = new RegExp(`@SQL_${suffix}\\s*=\\s*N'`).exec(text);
            if (!sqlMatch) continue;
            const quote = sqlMatch.index + sqlMatch[0].length - 1;
            seeded.set(id.toUpperCase(), { migration: name, sql: readNString(text, quote) });
        }
    }
    return seeded;
}

/** Line endings and the one substitution the release step makes (docs/PUBLISHING.md). */
function normalize(sql) {
    return sql.replace(/\r\n/g, '\n').replaceAll('[${mjSchema}]', '[__mj]').trim();
}

function staleQuerySql() {
    const seeded = seededSqlById();
    const stale = [];
    for (const { file, records } of jsonFiles) {
        for (const record of records) {
            const ref = record.fields?.SQL;
            if (typeof ref !== 'string' || !ref.startsWith('@file:')) continue;
            const id = record.primaryKey.ID.trim().toUpperCase();
            if (HELD_BACK.has(id)) continue;
            const expected = normalize(readFileSync(join(dirname(file), ref.slice('@file:'.length)), 'utf8'));
            const found = seeded.get(id);
            if (!found) {
                stale.push({ name: record.fields.Name ?? id, reason: 'no migration seeds its SQL' });
            } else if (normalize(found.sql) !== expected) {
                stale.push({ name: record.fields.Name ?? id, reason: `${found.migration} seeds older SQL than ${ref.slice(6)}` });
            }
        }
    }
    return stale;
}

// ── Report ──────────────────────────────────────────────────────────────────────────────────

const missing = uncoveredIds();
const stale = staleQuerySql();

if (missing.length) {
    console.error('Release seed coverage — these metadata primaryKeys appear in no migration:\n');
    for (const row of missing) {
        console.error(`  ❌ ${row.file}: ${row.unseen.length} undeclared in SQL`);
        console.error(`       e.g. ${row.unseen[0]}`);
    }
    console.error('');
}
if (stale.length) {
    console.error('Release seed currency — installed databases would keep older SQL for these queries:\n');
    for (const row of stale) console.error(`  ❌ ${row.name}: ${row.reason}`);
    console.error('');
}
if (missing.length || stale.length) {
    console.error('Generate the release Metadata_Sync (docs/PUBLISHING.md), then re-run.');
    process.exit(1);
}

const held = HELD_BACK.size ? ` ${HELD_BACK.size} record(s) held back: ${[...new Set(HELD_BACK.values())].join(', ')}.` : '';
console.log(`Release seed passed — every metadata primaryKey is in migrations/ and every query's SQL is current.${held}`);
