#!/usr/bin/env node
/**
 * Release-readiness: is the metadata under metadata/ what shipped migrations/*.sql will write?
 *
 * Three checks:
 *
 *   1. COVERAGE — every primaryKey UUID declared under metadata/ appears in some migration, and no
 *      HELD_BACK ID does (an entry left behind after its issue shipped the record).
 *   2. QUERY SQL CURRENCY — for every record whose SQL is `@file:`, the SQL the LATEST migration
 *      seeds for that record's ID equals the file. Check 1 cannot see this: a query's ID is in the
 *      migration that first created it, so an edited query passes coverage forever while every
 *      installed database keeps the old SQL (bizapps-sales#137 — upgraded installs kept the 5.2.0
 *      roster, and the dashboard read Weighted open as $0).
 *   3. NOTHING CHANGED SINCE THE LATEST SEED — every metadata record, whatever its key (a UUID or an
 *      `@lookup:`), is compared with its state in the commit that added the latest
 *      `*__Metadata_Sync.sql`. Checks 1 and 2 cannot see an edited label, description or status, or
 *      any record keyed by lookup. `_comments` and `sync` blocks are ignored; `@file:` values are
 *      compared by content. Needs git history (publish.yml checks out with fetch-depth: 0).
 *
 * A RELEASE GATE, NOT A PR GATE. PRs contribute JSON only; the build engineer generates one
 * Metadata_Sync per release, so between releases this fails by design. `publish.yml` runs it;
 * `verify` and the distribution-gate workflow do not.
 *
 *   node scripts/check-release-seed-coverage.mjs [repo-root]
 *
 * Exit 1 lists what the next Metadata_Sync must carry.
 */
import { execFileSync } from 'node:child_process';
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
/** @type {Map<string, string>} */
const HELD_BACK = new Map();

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

/** HELD_BACK IDs a migration already carries: the entry outlived the issue that shipped the record. */
function shippedHeldBack() {
    return [...HELD_BACK].filter(([id]) => allSqlLower.includes(id.toLowerCase())).map(([id, issue]) => ({ id, issue }));
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

// ── 3. Nothing changed since the latest seed ────────────────────────────────────────────────

function git(args) {
    return execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

/**
 * Every record node carrying any primaryKey.ID — a UUID or an `@lookup:` — at any depth, with its key.
 * A child's key is prefixed with its parent's: `@lookup:...&EntityID=@parent:ID` is the same string
 * under every parent, so on its own it would collide.
 */
function collectKeyedRecords(node, acc, parentKey = '') {
    if (Array.isArray(node)) {
        for (const item of node) collectKeyedRecords(item, acc, parentKey);
        return;
    }
    if (!node || typeof node !== 'object') return;
    let key = parentKey;
    if (node.fields && typeof node.primaryKey?.ID === 'string') {
        key = parentKey ? `${parentKey} > ${node.primaryKey.ID.trim()}` : node.primaryKey.ID.trim();
        acc.push({ key, record: node });
    }
    for (const value of Object.values(node)) collectKeyedRecords(value, acc, key);
}

/** Sorted-key JSON, so key order in a file is not a change. */
function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

/**
 * What a record writes: its fields and key, with `@file:` values replaced by the file's content.
 * Children are compared as records of their own, so `relatedEntities` is left out here, as are
 * `_comments` and `sync`, which no migration writes.
 */
function canonical(record, readRelative) {
    const fields = {};
    for (const [name, value] of Object.entries(record.fields)) {
        fields[name] = typeof value === 'string' && value.startsWith('@file:') ? readRelative(value.slice(6)) : value;
    }
    return stableStringify({ fields, primaryKey: record.primaryKey });
}

const heldBackKey = (key) => HELD_BACK.has(key.trim().toUpperCase());

function recordsByKey(files) {
    const byKey = new Map();
    for (const { path, text, readRelative } of files) {
        const records = [];
        collectKeyedRecords(JSON.parse(text), records);
        for (const { key, record } of records) {
            if (heldBackKey(record.primaryKey.ID)) continue;
            // Keyed by file as well: one record can be updated from several files, each setting
            // different fields (Deals is in both entities/.entities.json and entities/.form-chrome.json).
            // A record moved between files therefore reads as removed and added, which is worth a look.
            byKey.set(`${path} :: ${key}`, { path, key, value: canonical(record, readRelative) });
        }
    }
    return byKey;
}

const isMetadataJson = (path) =>
    path.endsWith('.json') && !path.endsWith('/.mj-sync.json') && !path.split('/').some((part) => IGNORED_DIRS.has(part));

/**
 * Records added, changed or removed since the commit that added the latest Metadata_Sync. Returns
 * `{ skipped }` when that seed is not committed yet — the release engineer checking a seed just
 * generated from this tree, which is by construction current.
 */
function changedSinceSeed() {
    const seeds = migrations.map((m) => m.name).filter((n) => n.endsWith('__Metadata_Sync.sql'));
    if (!seeds.length) return { changes: [], seed: null };
    const seed = seeds[seeds.length - 1];
    if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') {
        throw new Error('shallow clone: check 3 needs full history (actions/checkout fetch-depth: 0)');
    }
    const commit = git(['log', '-1', '--diff-filter=A', '--format=%H', '--', `migrations/${seed}`]).trim();
    if (!commit) return { changes: [], seed, skipped: true };

    const show = (path) => git(['show', `${commit}:${path}`]);
    const thenFiles = git(['ls-tree', '-r', '--name-only', commit, '--', 'metadata'])
        .split('\n')
        .filter(isMetadataJson)
        .map((path) => ({ path, text: show(path), readRelative: (ref) => show(`${dirname(path)}/${ref}`) }));
    const nowFiles = jsonFiles.map(({ file }) => ({
        path: relativePath(file),
        text: readFileSync(file, 'utf8'),
        readRelative: (ref) => readFileSync(join(dirname(file), ref), 'utf8'),
    }));

    const then = recordsByKey(thenFiles);
    const now = recordsByKey(nowFiles);
    const changes = [];
    for (const [id, record] of now) {
        const before = then.get(id);
        if (!before) changes.push({ kind: 'added', key: record.key, path: record.path });
        else if (before.value !== record.value) changes.push({ kind: 'changed', key: record.key, path: record.path });
    }
    for (const [id, record] of then) {
        if (now.has(id)) continue;
        // A removed record that no migration ever seeded never reached an installed database, so
        // there is nothing for the next seed to carry (records held back from every seed, then
        // dropped from metadata/). Records keyed by `@lookup:` cannot be checked this way and stay
        // reported.
        if (UUID.test(record.key) && !allSqlLower.includes(record.key.toLowerCase())) continue;
        changes.push({ kind: 'removed', key: record.key, path: record.path });
    }
    return { changes, seed, commit };
}

// ── Report ──────────────────────────────────────────────────────────────────────────────────

const missing = uncoveredIds();
const leftBehind = shippedHeldBack();
const stale = staleQuerySql();
const sinceSeed = changedSinceSeed();

if (missing.length) {
    console.error('Release seed coverage — these metadata primaryKeys appear in no migration:\n');
    for (const row of missing) {
        console.error(`  ❌ ${row.file}: ${row.unseen.length} undeclared in SQL`);
        console.error(`       e.g. ${row.unseen[0]}`);
    }
    console.error('');
}
if (leftBehind.length) {
    console.error('Held back, but already in a migration — remove these entries from HELD_BACK:\n');
    for (const row of leftBehind) console.error(`  ❌ ${row.id} (${row.issue})`);
    console.error('');
}
if (stale.length) {
    console.error('Release seed currency — installed databases would keep older SQL for these queries:\n');
    for (const row of stale) console.error(`  ❌ ${row.name}: ${row.reason}`);
    console.error('');
}
if (sinceSeed.changes.length) {
    console.error(
        `Release seed currency — metadata changed since ${sinceSeed.seed} was added (${sinceSeed.commit.slice(0, 7)}); ` +
            'installed databases would not receive:\n',
    );
    for (const row of sinceSeed.changes) console.error(`  ❌ ${row.kind}: ${row.path} — ${row.key}`);
    console.error('');
}
if (missing.length || leftBehind.length || stale.length || sinceSeed.changes.length) {
    console.error('Generate the release Metadata_Sync (docs/PUBLISHING.md), then re-run.');
    process.exit(1);
}

const held = HELD_BACK.size ? ` ${HELD_BACK.size} record(s) held back: ${[...new Set(HELD_BACK.values())].join(', ')}.` : '';
const since = sinceSeed.skipped ? ` Check 3 skipped: ${sinceSeed.seed} is not committed yet.` : '';
console.log(`Release seed passed — metadata matches what migrations/ writes.${held}${since}`);
